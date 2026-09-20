import { CompanyCnpjData } from '../types';

/**
 * Remove qualquer caractere não numérico do CNPJ
 */
export function cleanCnpj(value: string): string {
  return (value || '').replace(/\D/g, '');
}

/**
 * Aplica máscara de CNPJ: 00.000.000/0000-00
 */
export function formatCnpj(value: string): string {
  const digits = cleanCnpj(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

/**
 * Validação dos dígitos verificadores de CNPJ
 */
export function isValidCnpj(value: string): boolean {
  const cnpj = cleanCnpj(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  const digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0), 10)) return false;

  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  return resultado === parseInt(digitos.charAt(1), 10);
}

/**
 * Formata data ISO (YYYY-MM-DD) para padrão brasileiro DD/MM/AAAA
 */
export function formatBrDate(dateStr?: string): string {
  if (!dateStr) return 'Não informada';
  const clean = dateStr.trim();
  if (clean.includes('/')) return clean;
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Formata código CNAE (ex: 6422100 -> 64.22-1/00)
 */
export function formatCnaeCode(code?: number | string): string {
  if (!code) return '';
  const str = String(code).replace(/\D/g, '').padStart(7, '0');
  if (str.length === 7) {
    return `${str.slice(0, 2)}.${str.slice(2, 4)}-${str.slice(4, 5)}/${str.slice(5, 7)}`;
  }
  return String(code);
}

/**
 * Consulta a empresa pelo CNPJ através do backend ou direto pela BrasilAPI
 */
export async function fetchCompanyByCnpj(rawCnpj: string): Promise<CompanyCnpjData> {
  const digits = cleanCnpj(rawCnpj);

  if (digits.length !== 14) {
    throw new Error('CNPJ inválido. Digite os 14 dígitos do CNPJ.');
  }

  // 1. Tentar rota do backend (/api/cnpj/:cnpj)
  try {
    const backendRes = await fetch(`/api/cnpj/${digits}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (backendRes.ok) {
      const json = await backendRes.json();
      if (json.data) return json.data as CompanyCnpjData;
    }

    if (backendRes.status === 404) {
      throw new Error('Empresa não encontrada na base da Receita Federal.');
    }
  } catch (backendErr: any) {
    if (backendErr.message === 'Empresa não encontrada na base da Receita Federal.') {
      throw backendErr;
    }
    // Caso o backend falhe por proxy ou timeout, continua para fallback direto
  }

  // 2. Fallback direto para BrasilAPI pública
  try {
    const directRes = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (directRes.ok) {
      const data = await directRes.json();
      return data as CompanyCnpjData;
    }

    if (directRes.status === 404) {
      throw new Error('Empresa não encontrada na base da Receita Federal.');
    }

    const errJson = await directRes.json().catch(() => ({}));
    throw new Error(errJson.message || 'Empresa não encontrada na base da Receita Federal.');
  } catch (err: any) {
    if (err.message && err.message.includes('não encontrada')) {
      throw err;
    }
    throw new Error(err.message || 'Não foi possível consultar os dados da Receita Federal.');
  }
}
