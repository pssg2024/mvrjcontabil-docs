/**
 * Lógica de Legislação Trabalhista e Tributária Brasileira
 * Módulo de Cálculo Salarial (INSS progressivo, IRRF e Salário Líquido)
 */

export interface INSSBracketDetail {
  bracketNumber: number;
  from: number;
  to: number;
  rate: number; // e.g. 0.075 for 7.5%
  rateLabel: string;
  taxableAmountInBracket: number;
  contribution: number;
}

export interface INSSCalculationResult {
  totalContribution: number;
  effectiveRate: number; // in percent, e.g. 8.45%
  isCapped: boolean; // atingiu o teto
  ceilingSalary: number;
  maxContribution: number;
  bracketBreakdown: INSSBracketDetail[];
}

export interface IRRFCalculationResult {
  calculationBase: number;
  dependentsCount: number;
  dependentsDeductionTotal: number;
  methodUsed: 'legal_deductions' | 'simplified_discount';
  deductionsApplied: number;
  nominalRate: number; // 0, 7.5, 15, 22.5, 27.5
  deductionShare: number; // Parcela a deduzir
  irrfDue: number; // Valor final descontado
  effectiveRate: number; // in percent
  isExempt: boolean;
  legalMethod: {
    base: number;
    tax: number;
  };
  simplifiedMethod: {
    base: number;
    tax: number;
    discountAmount: number;
  };
}

export interface SalarySimulationResult {
  grossSalary: number;
  dependentsCount: number;
  otherDeductions: number;
  inss: INSSCalculationResult;
  irrf: IRRFCalculationResult;
  totalDeductions: number;
  netSalary: number;
  percentageNet: number;
  percentageINSS: number;
  percentageIRRF: number;
  percentageOther: number;
  totalDeductionsPercentage: number;
}

// Constantes vigentes da Legislação Brasileira
export const SALARY_CONSTANTS = {
  MINIMUM_WAGE: 1518.00, // Salário Mínimo Vigente
  INSS_CEILING_SALARY: 8157.41, // Teto Máximo de Contribuição do INSS
  IRRF_DEPENDENT_DEDUCTION: 189.59, // Dedução por Dependente Mensal
  IRRF_SIMPLIFIED_DISCOUNT: 564.80, // Desconto Simplificado Mensal (Lei 14.663)
  INSS_BRACKETS: [
    { from: 0, to: 1518.00, rate: 0.075, label: '7,5%' },
    { from: 1518.00, to: 2793.88, rate: 0.09, label: '9,0%' },
    { from: 2793.88, to: 4190.83, rate: 0.12, label: '12,0%' },
    { from: 4190.83, to: 8157.41, rate: 0.14, label: '14,0%' },
  ],
  IRRF_BRACKETS: [
    { upTo: 2259.20, rate: 0.00, deduction: 0.00, label: 'Isento' },
    { upTo: 2826.65, rate: 0.075, deduction: 169.44, label: '7,5%' },
    { upTo: 3751.05, rate: 0.150, deduction: 381.44, label: '15,0%' },
    { upTo: 4664.68, rate: 0.225, deduction: 662.77, label: '22,5%' },
    { upTo: Infinity, rate: 0.275, deduction: 896.00, label: '27,5%' },
  ],
};

/**
 * Realiza o cálculo progressivo do INSS respeitando faixas e teto legal
 */
export function calculateINSS(grossSalary: number): INSSCalculationResult {
  const safeSalary = Math.max(0, Number(grossSalary) || 0);
  const brackets = SALARY_CONSTANTS.INSS_BRACKETS;
  const ceilingSalary = SALARY_CONSTANTS.INSS_CEILING_SALARY;

  const bracketBreakdown: INSSBracketDetail[] = [];
  let totalContribution = 0;

  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i];
    const bracketWidth = bracket.to - bracket.from;

    if (safeSalary > bracket.from) {
      // Valor do salário que cai dentro desta faixa específica
      const taxable = Math.min(safeSalary, bracket.to) - bracket.from;
      const contribution = Number((taxable * bracket.rate).toFixed(2));
      totalContribution += contribution;

      bracketBreakdown.push({
        bracketNumber: i + 1,
        from: bracket.from,
        to: bracket.to,
        rate: bracket.rate,
        rateLabel: bracket.label,
        taxableAmountInBracket: Number(taxable.toFixed(2)),
        contribution,
      });
    } else {
      bracketBreakdown.push({
        bracketNumber: i + 1,
        from: bracket.from,
        to: bracket.to,
        rate: bracket.rate,
        rateLabel: bracket.label,
        taxableAmountInBracket: 0,
        contribution: 0,
      });
    }
  }

  // Teto máximo teórico somando todas as faixas preenchidas
  const maxContribution = Number(
    (
      (1518.00 * 0.075) +
      ((2793.88 - 1518.00) * 0.09) +
      ((4190.83 - 2793.88) * 0.12) +
      ((8157.41 - 4190.83) * 0.14)
    ).toFixed(2)
  );

  const isCapped = safeSalary >= ceilingSalary;
  const finalContribution = isCapped ? maxContribution : Number(totalContribution.toFixed(2));
  const effectiveRate = safeSalary > 0 
    ? Number(((finalContribution / safeSalary) * 100).toFixed(2)) 
    : 0;

  return {
    totalContribution: finalContribution,
    effectiveRate,
    isCapped,
    ceilingSalary,
    maxContribution,
    bracketBreakdown,
  };
}

/**
 * Calcula o imposto nominal baseado em uma dada base de cálculo
 */
function getIRRFAmountForBase(base: number): { tax: number; rate: number; deduction: number } {
  const safeBase = Math.max(0, base);
  const brackets = SALARY_CONSTANTS.IRRF_BRACKETS;

  for (const b of brackets) {
    if (safeBase <= b.upTo) {
      if (b.rate === 0) {
        return { tax: 0, rate: 0, deduction: 0 };
      }
      const rawTax = (safeBase * b.rate) - b.deduction;
      return {
        tax: Math.max(0, Number(rawTax.toFixed(2))),
        rate: b.rate * 100,
        deduction: b.deduction,
      };
    }
  }

  // Acima de R$ 4.664,68
  const topBracket = brackets[brackets.length - 1];
  const rawTax = (safeBase * topBracket.rate) - topBracket.deduction;
  return {
    tax: Math.max(0, Number(rawTax.toFixed(2))),
    rate: topBracket.rate * 100,
    deduction: topBracket.deduction,
  };
}

/**
 * Realiza o cálculo do IRRF (Imposto de Renda Retido na Fonte),
 * comparando as Deduções Legais e o Desconto Simplificado Mensal (Lei 14.663),
 * aplicando automaticamente o mais favorável ao trabalhador.
 */
export function calculateIRRF(
  grossSalary: number,
  inssContribution: number,
  dependentsCount: number = 0,
  otherLegalDeductions: number = 0
): IRRFCalculationResult {
  const safeGross = Math.max(0, Number(grossSalary) || 0);
  const safeDeps = Math.max(0, Math.floor(Number(dependentsCount) || 0));
  const safeInss = Math.max(0, Number(inssContribution) || 0);
  const safeOtherLegal = Math.max(0, Number(otherLegalDeductions) || 0);

  const dependentsDeductionTotal = safeDeps * SALARY_CONSTANTS.IRRF_DEPENDENT_DEDUCTION;
  const totalLegalDeductions = safeInss + dependentsDeductionTotal + safeOtherLegal;

  // 1. Método das Deduções Legais
  const legalBase = Math.max(0, safeGross - totalLegalDeductions);
  const legalCalc = getIRRFAmountForBase(legalBase);

  // 2. Método do Desconto Simplificado (R$ 564,80)
  const simplifiedDiscount = SALARY_CONSTANTS.IRRF_SIMPLIFIED_DISCOUNT;
  const simplifiedBase = Math.max(0, safeGross - simplifiedDiscount);
  const simplifiedCalc = getIRRFAmountForBase(simplifiedBase);

  // Seleciona a opção mais vantajosa (menor imposto a pagar)
  const useSimplified = simplifiedCalc.tax < legalCalc.tax;
  const chosenMethod: 'legal_deductions' | 'simplified_discount' = useSimplified
    ? 'simplified_discount'
    : 'legal_deductions';

  const calculationBase = useSimplified ? simplifiedBase : legalBase;
  const chosenCalc = useSimplified ? simplifiedCalc : legalCalc;
  const deductionsApplied = useSimplified ? simplifiedDiscount : totalLegalDeductions;

  const irrfDue = chosenCalc.tax;
  const effectiveRate = safeGross > 0 ? Number(((irrfDue / safeGross) * 100).toFixed(2)) : 0;
  const isExempt = irrfDue === 0;

  return {
    calculationBase: Number(calculationBase.toFixed(2)),
    dependentsCount: safeDeps,
    dependentsDeductionTotal: Number(dependentsDeductionTotal.toFixed(2)),
    methodUsed: chosenMethod,
    deductionsApplied: Number(deductionsApplied.toFixed(2)),
    nominalRate: chosenCalc.rate,
    deductionShare: chosenCalc.deduction,
    irrfDue,
    effectiveRate,
    isExempt,
    legalMethod: {
      base: Number(legalBase.toFixed(2)),
      tax: legalCalc.tax,
    },
    simplifiedMethod: {
      base: Number(simplifiedBase.toFixed(2)),
      tax: simplifiedCalc.tax,
      discountAmount: simplifiedDiscount,
    },
  };
}

/**
 * Calcula a simulação completa de salário líquido com todos os totais e percentuais
 */
export function calculateNetSalary(
  grossSalary: number,
  dependentsCount: number = 0,
  otherDeductions: number = 0
): SalarySimulationResult {
  const safeGross = Math.max(0, Number(grossSalary) || 0);
  const safeDeps = Math.max(0, Math.floor(Number(dependentsCount) || 0));
  const safeOther = Math.max(0, Number(otherDeductions) || 0);

  const inss = calculateINSS(safeGross);
  const irrf = calculateIRRF(safeGross, inss.totalContribution, safeDeps);

  const totalDeductions = Number((inss.totalContribution + irrf.irrfDue + safeOther).toFixed(2));
  const netSalary = Math.max(0, Number((safeGross - totalDeductions).toFixed(2)));

  const percentageNet = safeGross > 0 ? Number(((netSalary / safeGross) * 100).toFixed(1)) : 0;
  const percentageINSS = safeGross > 0 ? Number(((inss.totalContribution / safeGross) * 100).toFixed(1)) : 0;
  const percentageIRRF = safeGross > 0 ? Number(((irrf.irrfDue / safeGross) * 100).toFixed(1)) : 0;
  const percentageOther = safeGross > 0 ? Number(((safeOther / safeGross) * 100).toFixed(1)) : 0;
  const totalDeductionsPercentage = safeGross > 0 ? Number(((totalDeductions / safeGross) * 100).toFixed(1)) : 0;

  return {
    grossSalary: safeGross,
    dependentsCount: safeDeps,
    otherDeductions: safeOther,
    inss,
    irrf,
    totalDeductions,
    netSalary,
    percentageNet,
    percentageINSS,
    percentageIRRF,
    percentageOther,
    totalDeductionsPercentage,
  };
}

/**
 * Formata valor numérico para Moeda Brasileira (R$)
 */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}
