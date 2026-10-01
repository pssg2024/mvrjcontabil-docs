import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  X, 
  DollarSign, 
  Users, 
  TrendingDown, 
  Check, 
  Copy, 
  Info, 
  FileSpreadsheet, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Building2,
  ArrowRight,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { 
  calculateNetSalary, 
  formatBRL, 
  SALARY_CONSTANTS,
  SalarySimulationResult 
} from '../lib/salary-calculator';

interface SalaryCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SalaryCalculatorModal: React.FC<SalaryCalculatorModalProps> = ({
  isOpen,
  onClose,
}) => {
  // Inputs do Usuário
  const [grossSalaryInput, setGrossSalaryInput] = useState<string>('4500,00');
  const [dependentsCount, setDependentsCount] = useState<number>(0);
  const [otherDeductionsInput, setOtherDeductionsInput] = useState<string>('0,00');

  // Estados de Interface
  const [showDetailedMemory, setShowDetailedMemory] = useState<boolean>(true);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  // Conversor estrito de máscara numérica (BRL com vírgula)
  const parseInputValue = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const parsedGrossSalary = useMemo(() => parseInputValue(grossSalaryInput), [grossSalaryInput]);
  const parsedOtherDeductions = useMemo(() => parseInputValue(otherDeductionsInput), [otherDeductionsInput]);

  // Execução do cálculo matemático isolado
  const result: SalarySimulationResult = useMemo(() => {
    return calculateNetSalary(parsedGrossSalary, dependentsCount, parsedOtherDeductions);
  }, [parsedGrossSalary, dependentsCount, parsedOtherDeductions]);

  // Presets rápidos com valores de referência do mercado
  const setQuickSalary = (val: number) => {
    setGrossSalaryInput(val.toFixed(2).replace('.', ','));
  };

  // Cópia do relatório executivo
  const handleCopySummary = () => {
    const text = `📊 MVRJ CONTÁBIL - SIMULAÇÃO DE SALÁRIO LÍQUIDO
--------------------------------------------------
💵 Salário Bruto: ${formatBRL(result.grossSalary)}
👥 Dependentes: ${result.dependentsCount} (${formatBRL(result.irrf.dependentsDeductionTotal)} de dedução)

🔻 DESCONTOS:
• INSS (${result.inss.effectiveRate}% efetiva): ${formatBRL(result.inss.totalContribution)}
• IRRF (${result.irrf.isExempt ? 'Isento' : `${result.irrf.nominalRate}% nominal / ${result.irrf.effectiveRate}% efetiva`}): ${formatBRL(result.irrf.irrfDue)}
• Outros Descontos: ${formatBRL(result.otherDeductions)}
👉 Total de Descontos: ${formatBRL(result.totalDeductions)} (${result.totalDeductionsPercentage}%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 SALÁRIO LÍQUIDO FINAL: ${formatBRL(result.netSalary)} (${result.percentageNet}% do bruto)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cálculo efetuado com a Tabela Progressiva do INSS e Dedução/Simplificado do IRRF (Lei nº 14.663).`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    });
  };

  if (!isOpen) return null;

  // Cálculos visuais para o Gráfico Donut SVG
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const netOffset = circumference * (1 - result.percentageNet / 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-4xl mx-auto rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[94vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 font-sans"
        role="dialog"
        aria-modal="true"
        aria-labelledby="salary-modal-title"
      >
        {/* Header no Padrão SaaS (Stripe/Vercel) */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 bg-[#1B357B] text-amber-300 rounded-xl shadow-xs ring-1 ring-white/20">
              <Calculator className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="salary-modal-title" className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  Simulador de Salário Líquido & Trabalhista
                </h2>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Legislação 2026 Vigente
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
                Previdência Social (INSS progressivo), IRRF com dedução por dependente e memória de contracheque
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopySummary}
              className="px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              title="Copiar Resumo da Simulação"
            >
              {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span className="hidden sm:inline">{copiedSummary ? 'Copiado' : 'Copiar Resumo'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corpo com Scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Grade Principal: Inputs à Esquerda / Resultados à Direita */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* 1. SEÇÃO DE INPUTS (5 colunas) */}
            <div className="lg:col-span-5 space-y-4 bg-slate-50/80 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Parâmetros de Entrada
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setGrossSalaryInput('4500,00');
                    setDependentsCount(0);
                    setOtherDeductionsInput('0,00');
                  }}
                  className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Redefinir
                </button>
              </div>

              {/* Input 1: Salário Bruto */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-gross-salary" className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Salário Bruto</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-normal">Base tributável</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-xs select-none">
                    R$
                  </span>
                  <input
                    id="input-gross-salary"
                    type="text"
                    value={grossSalaryInput}
                    onChange={(e) => setGrossSalaryInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white text-base focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all shadow-2xs [font-variant-numeric:tabular-nums]"
                  />
                </div>

                {/* Presets Rápidos Estilo Stripe */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setQuickSalary(SALARY_CONSTANTS.MINIMUM_WAGE)}
                    className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 transition-colors shadow-2xs cursor-pointer"
                  >
                    Mínimo (R$ 1.518)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickSalary(3000)}
                    className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 transition-colors shadow-2xs cursor-pointer"
                  >
                    R$ 3.000
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickSalary(5000)}
                    className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 transition-colors shadow-2xs cursor-pointer"
                  >
                    R$ 5.000
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickSalary(SALARY_CONSTANTS.INSS_CEILING_SALARY)}
                    className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 transition-colors shadow-2xs cursor-pointer"
                    title="Teto da Previdência Social"
                  >
                    Teto INSS (R$ 8.157,41)
                  </button>
                </div>
              </div>

              {/* Input 2: Número de Dependentes */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-dependents" className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Número de Dependentes</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    -R$ 189,59/dep.
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setDependentsCount(prev => Math.max(0, prev - 1))}
                    disabled={dependentsCount <= 0}
                    className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
                  >
                    -
                  </button>
                  <input
                    id="input-dependents"
                    type="number"
                    min="0"
                    max="20"
                    value={dependentsCount}
                    onChange={(e) => setDependentsCount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="flex-1 text-center py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white text-base focus:ring-2 focus:ring-blue-600 outline-none shadow-2xs [font-variant-numeric:tabular-nums]"
                  />
                  <button
                    type="button"
                    onClick={() => setDependentsCount(prev => prev + 1)}
                    className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Input 3: Outros Descontos */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-other-deductions" className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Outros Descontos (R$)</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-normal">VT, VA, Plano de Saúde</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-xs select-none">
                    R$
                  </span>
                  <input
                    id="input-other-deductions"
                    type="text"
                    value={otherDeductionsInput}
                    onChange={(e) => setOtherDeductionsInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white text-base focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all shadow-2xs [font-variant-numeric:tabular-nums]"
                  />
                </div>
              </div>

              {/* Box de Informação da Regra Tributária */}
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-blue-900 dark:text-blue-300 font-bold">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Método do IRRF Aplicado:</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  {result.irrf.methodUsed === 'simplified_discount' ? (
                    <span>
                      Optou-se pelo <strong>Desconto Simplificado de R$ 564,80</strong> (Lei nº 14.663), mais vantajoso que as deduções legais.
                    </span>
                  ) : (
                    <span>
                      Optou-se pelas <strong>Deduções Legais</strong> (INSS + dependentes), gerando menor retenção de imposto.
                    </span>
                  )}
                </p>
              </div>

            </div>

            {/* 2. SEÇÃO DE RESULTADOS & CARD EM DESTAQUE (7 colunas) */}
            <div className="lg:col-span-7 space-y-5">
              
              {/* Card Destaque: SALÁRIO LÍQUIDO FINAL (GRADIENTE VERDE SAAS) */}
              <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 text-white shadow-xl shadow-emerald-950/20 border border-emerald-500/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-xs border border-white/20">
                        Disponível em Conta
                      </span>
                      <span className="text-xs font-mono font-medium text-emerald-100">
                        {result.percentageNet}% do bruto
                      </span>
                    </div>
                    <div className="mt-2.5">
                      <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider block">
                        Salário Líquido Final
                      </span>
                      <p className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-white drop-shadow-sm [font-variant-numeric:tabular-nums]">
                        {formatBRL(result.netSalary)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end justify-center bg-black/20 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 shrink-0">
                    <span className="text-[11px] font-medium text-emerald-100">Total de Descontos</span>
                    <span className="text-lg font-bold font-mono text-emerald-200 [font-variant-numeric:tabular-nums]">
                      -{formatBRL(result.totalDeductions)}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-200/80">
                      ({result.totalDeductionsPercentage}% retido)
                    </span>
                  </div>
                </div>

                {/* Barra Visual Comparativa Stacked */}
                <div className="mt-5 pt-4 border-t border-white/15">
                  <div className="flex justify-between text-[11px] font-medium text-emerald-100 mb-1.5 font-mono">
                    <span>Bruto Total: {formatBRL(result.grossSalary)}</span>
                    <span>100%</span>
                  </div>
                  <div className="h-3 w-full bg-emerald-950/60 rounded-full overflow-hidden p-0.5 flex gap-0.5">
                    {/* Fatia Líquida */}
                    <div 
                      className="h-full bg-white rounded-l-full transition-all duration-300"
                      style={{ width: `${Math.max(0, result.percentageNet)}%` }}
                      title={`Líquido: ${formatBRL(result.netSalary)} (${result.percentageNet}%)`}
                    />
                    {/* Fatia INSS */}
                    <div 
                      className="h-full bg-sky-300 transition-all duration-300"
                      style={{ width: `${Math.max(0, result.percentageINSS)}%` }}
                      title={`INSS: ${formatBRL(result.inss.totalContribution)} (${result.percentageINSS}%)`}
                    />
                    {/* Fatia IRRF */}
                    <div 
                      className="h-full bg-amber-300 transition-all duration-300"
                      style={{ width: `${Math.max(0, result.percentageIRRF)}%` }}
                      title={`IRRF: ${formatBRL(result.irrf.irrfDue)} (${result.percentageIRRF}%)`}
                    />
                    {/* Fatia Outros */}
                    <div 
                      className="h-full bg-rose-300 rounded-r-full transition-all duration-300"
                      style={{ width: `${Math.max(0, result.percentageOther)}%` }}
                      title={`Outros: ${formatBRL(result.otherDeductions)} (${result.percentageOther}%)`}
                    />
                  </div>

                  {/* Legenda com Alinhamento Tabular */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 text-[11px] text-white/95 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-white shrink-0"></span>
                      <span className="truncate">Líquido <strong className="font-mono font-bold">({result.percentageNet}%)</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-300 shrink-0"></span>
                      <span className="truncate">INSS <strong className="font-mono font-bold">({result.percentageINSS}%)</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-300 shrink-0"></span>
                      <span className="truncate">IRRF <strong className="font-mono font-bold">({result.percentageIRRF}%)</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-300 shrink-0"></span>
                      <span className="truncate">Outros <strong className="font-mono font-bold">({result.percentageOther}%)</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cards Detalhados dos Tributos (INSS e IRRF) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Card INSS */}
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
                      <span className="font-semibold text-xs text-slate-700 dark:text-slate-200">Desconto INSS</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {result.inss.isCapped ? 'Teto Atingido' : `${result.inss.effectiveRate}% Efetiva`}
                    </span>
                  </div>

                  <div className="pt-1">
                    <p className="text-xl font-extrabold font-mono text-slate-900 dark:text-white [font-variant-numeric:tabular-nums]">
                      -{formatBRL(result.inss.totalContribution)}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-normal">
                      {result.inss.isCapped 
                        ? `Contribuição travada no teto legal de ${formatBRL(result.inss.maxContribution)}.` 
                        : `Alíquota média ponderada de ${result.inss.effectiveRate}% sobre o salário bruto.`}
                    </p>
                  </div>
                </div>

                {/* Card IRRF */}
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                      <span className="font-semibold text-xs text-slate-700 dark:text-slate-200">Desconto IRRF</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      {result.irrf.isExempt ? 'Isento' : `${result.irrf.nominalRate}% Nominal`}
                    </span>
                  </div>

                  <div className="pt-1">
                    <p className="text-xl font-extrabold font-mono text-slate-900 dark:text-white [font-variant-numeric:tabular-nums]">
                      {result.irrf.isExempt ? 'R$ 0,00' : `-${formatBRL(result.irrf.irrfDue)}`}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-normal">
                      {result.irrf.isExempt 
                        ? 'Base de cálculo isenta de retenção na fonte.' 
                        : `Alíquota efetiva de ${result.irrf.effectiveRate}% sobre o salário bruto.`}
                    </p>
                  </div>
                </div>

              </div>

              {/* Donut Chart SVG & Holerite Resumido */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-5">
                
                {/* Donut Circular SVG */}
                <div className="relative flex items-center justify-center shrink-0">
                  <svg className="w-22 h-22 -rotate-90 transform" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      className="text-slate-200 dark:text-slate-700 stroke-current"
                      strokeWidth="9"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      className="text-emerald-600 stroke-current transition-all duration-500"
                      strokeWidth="9"
                      strokeDasharray={circumference}
                      strokeDashoffset={netOffset}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
                    <span className="text-xs font-extrabold font-mono text-slate-900 dark:text-white [font-variant-numeric:tabular-nums]">
                      {result.percentageNet}%
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Líquido
                    </span>
                  </div>
                </div>

                {/* Linhas Contábeis (Holerite) com Numerais Tabulares */}
                <div className="flex-1 w-full space-y-1.5 text-xs font-normal">
                  <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700/60">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Salário Base (Bruto):</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white [font-variant-numeric:tabular-nums]">{formatBRL(result.grossSalary)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700/60">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Previdência Social (INSS):</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400 [font-variant-numeric:tabular-nums]">-{formatBRL(result.inss.totalContribution)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700/60">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Imposto de Renda Retido (IRRF):</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 [font-variant-numeric:tabular-nums]">-{formatBRL(result.irrf.irrfDue)}</span>
                  </div>
                  {result.otherDeductions > 0 && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700/60">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">Outros Descontos Extras:</span>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400 [font-variant-numeric:tabular-nums]">-{formatBRL(result.otherDeductions)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1 font-bold">
                    <span className="text-emerald-700 dark:text-emerald-400">Total Líquido a Receber:</span>
                    <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-400 text-sm [font-variant-numeric:tabular-nums]">{formatBRL(result.netSalary)}</span>
                  </div>
                </div>

              </div>

            </div>

          </div>

          {/* 3. SEÇÃO EXPANSÍVEL: TABELAS E MEMÓRIA DE CÁLCULO PROFISSIONAL */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
            <button
              type="button"
              onClick={() => setShowDetailedMemory(!showDetailedMemory)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                  Memória de Cálculo Detalhada (Faixas do INSS e Deduções do IRRF)
                </span>
              </div>
              <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span>{showDetailedMemory ? 'Recolher' : 'Expandir'}</span>
                {showDetailedMemory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showDetailedMemory && (
              <div className="p-5 border-t border-slate-200 dark:border-slate-800 space-y-6 text-xs bg-slate-50/50 dark:bg-slate-900/60 animate-in fade-in duration-200">
                
                {/* Tabela 1: Cálculo Progressivo do INSS */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      Cálculo Progressivo do INSS por Faixas
                    </h4>
                    <span className="text-[10px] text-slate-500 font-mono">Tabela Previdência 2026</span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <th className="p-3">Faixa Salarial</th>
                          <th className="p-3 text-center">Alíquota</th>
                          <th className="p-3 text-right">Valor Tributado</th>
                          <th className="p-3 text-right">Contribuição</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px] [font-variant-numeric:tabular-nums]">
                        {result.inss.bracketBreakdown.map((b) => (
                          <tr key={b.bracketNumber} className={b.taxableAmountInBracket > 0 ? 'bg-blue-50/20 dark:bg-blue-950/15' : 'opacity-40'}>
                            <td className="p-3 font-sans font-medium text-slate-700 dark:text-slate-300">
                              {b.bracketNumber}ª Faixa ({formatBRL(b.from)} até {formatBRL(b.to)})
                            </td>
                            <td className="p-3 text-center">
                              <span className="inline-block px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-mono font-bold text-[11px] border border-blue-200/90 dark:border-blue-800/90 shadow-2xs">
                                {b.rateLabel}
                              </span>
                            </td>
                            <td className="p-3 text-right text-slate-600 dark:text-slate-300">{formatBRL(b.taxableAmountInBracket)}</td>
                            <td className="p-3 text-right font-bold text-slate-900 dark:text-white">{formatBRL(b.contribution)}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold border-t-2 border-slate-300 dark:border-slate-700">
                          <td colSpan={3} className="p-3 font-sans text-slate-800 dark:text-slate-200">
                            Total Desconto INSS Devido:
                          </td>
                          <td className="p-3 text-right text-blue-700 dark:text-blue-300 font-bold text-xs [font-variant-numeric:tabular-nums]">
                            {formatBRL(result.inss.totalContribution)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tabela 2: Memória do IRRF */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Memória de Cálculo do IRRF (Imposto de Renda Retido)
                    </h4>
                    <span className="text-[10px] text-slate-500 font-mono">Lei nº 14.663</span>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2 text-xs shadow-2xs font-normal">
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-600 dark:text-slate-400">Salário Base (Bruto):</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white [font-variant-numeric:tabular-nums]">{formatBRL(result.grossSalary)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-blue-600 dark:text-blue-400">
                      <span>(-) Dedução da Previdência Social (INSS):</span>
                      <span className="font-mono font-bold [font-variant-numeric:tabular-nums]">-{formatBRL(result.inss.totalContribution)}</span>
                    </div>
                    {result.dependentsCount > 0 && (
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-400">
                        <span>(-) Dedução por Dependentes ({result.dependentsCount} &times; R$ 189,59):</span>
                        <span className="font-mono font-bold [font-variant-numeric:tabular-nums]">-{formatBRL(result.irrf.dependentsDeductionTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1.5 bg-slate-50 dark:bg-slate-800/60 px-2.5 rounded-lg font-bold">
                      <span className="text-slate-800 dark:text-slate-200">Base de Cálculo Efetiva do IRRF:</span>
                      <span className="font-mono text-slate-900 dark:text-white [font-variant-numeric:tabular-nums]">{formatBRL(result.irrf.calculationBase)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      <span>Alíquota Nominal da Faixa:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white [font-variant-numeric:tabular-nums]">{result.irrf.nominalRate}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      <span>(-) Parcela a Deduzir do Imposto:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white [font-variant-numeric:tabular-nums]">{formatBRL(result.irrf.deductionShare)}</span>
                    </div>
                    <div className="flex justify-between py-2 text-amber-700 dark:text-amber-300 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                      <span>Imposto de Renda Retido na Fonte (IRRF Devido):</span>
                      <span className="font-mono text-sm [font-variant-numeric:tabular-nums]">{formatBRL(result.irrf.irrfDue)}</span>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>

        {/* Rodapé SaaS */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="hidden sm:inline font-normal">Cálculos auditados conforme a tabela oficial da Receita Federal e Previdência.</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copiedSummary ? 'Copiado' : 'Copiar Simulação'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-[#1B357B] hover:bg-[#13275c] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
