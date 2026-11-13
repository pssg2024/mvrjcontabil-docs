import {
  InadimplenciaAlertaAutomatico,
  InadimplenciaClassificacao,
  InadimplenciaItem,
  InadimplenciaSummary,
} from '../types';

const INADIMPLENCIA_SYNC_EVENT = 'mvrj-inadimplencia-sync';
const INADIMPLENCIA_CHANNEL = 'mvrj-inadimplencia-channel';

export interface InadimplenciaResponseData {
  active: InadimplenciaItem[];
  settled: InadimplenciaItem[];
  all: InadimplenciaItem[];
  summary: InadimplenciaSummary;
}

export interface OverdueCandidate {
  file_id: string;
  cliente_nome: string;
  telefone: string;
  descricao: string;
  valor_total: number;
  data_vencimento: string;
  dias_em_atraso: number;
  classificacao: InadimplenciaClassificacao;
}

export function broadcastInadimplenciaUpdate() {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(INADIMPLENCIA_SYNC_EVENT));
    }
  } catch {}
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(INADIMPLENCIA_CHANNEL);
      bc.postMessage({ type: 'REFRESH' });
      bc.close();
    }
  } catch {}
}

export function subscribeInadimplenciaSync(onRefresh: () => void): () => void {
  const handleEvent = () => onRefresh();
  let bc: BroadcastChannel | null = null;

  if (typeof window !== 'undefined') {
    window.addEventListener(INADIMPLENCIA_SYNC_EVENT, handleEvent);
  }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(INADIMPLENCIA_CHANNEL);
      bc.onmessage = (event) => {
        if (event.data?.type === 'REFRESH') onRefresh();
      };
    }
  } catch {}

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(INADIMPLENCIA_SYNC_EVENT, handleEvent);
    }
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
  };
}

export function calculateDaysOverdueClient(dueDateStr?: string): number {
  if (!dueDateStr) return 0;
  try {
    const cleanDate = String(dueDateStr).slice(0, 10);
    const parts = cleanDate.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return 0;
    const dueUtc = Date.UTC(parts[0], parts[1] - 1, parts[2]);
    const now = new Date();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.floor((todayUtc - dueUtc) / 86400000);
    return diff > 0 ? diff : 0;
  } catch {
    return 0;
  }
}

export function computeAutoClassificationClient(
  dueDateStr: string,
  valorRestante: number
): { diasEmAtraso: number; classificacao: InadimplenciaClassificacao } {
  const diasEmAtraso = calculateDaysOverdueClient(dueDateStr);
  let classificacao: InadimplenciaClassificacao = 'Leve';
  if (diasEmAtraso > 60 || (diasEmAtraso >= 31 && valorRestante >= 10000)) {
    classificacao = 'Severa';
  } else if (diasEmAtraso >= 31) {
    classificacao = 'Alta';
  } else if (diasEmAtraso >= 16) {
    classificacao = 'Moderada';
  }
  return { diasEmAtraso, classificacao };
}

export function formatCurrencyBRL(value?: number): string {
  const num = Number(value || 0);
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function buildWhatsAppCobrancaUrl(item: InadimplenciaItem): string {
  const digits = (item.telefone || '').replace(/\D/g, '');
  const phone = digits.length <= 11 && !digits.startsWith('55') ? `55${digits}` : digits;
  const pagamentoInfo = item.dados_pagamento
    ? `\n\n💳 *Dados para Pagamento (${item.forma_pagamento || 'PIX'}):*\n${item.dados_pagamento}`
    : '';
  const msg =
    `Olá, *${item.cliente_nome}*! Aqui é da *MVRJ Contábil*.\n\n` +
    `Identificamos pendência financeira em aberto:\n` +
    `• *Descrição:* ${item.descricao}\n` +
    `• *Vencimento:* ${item.data_vencimento.split('-').reverse().join('/')}\n` +
    `• *Valor em aberto:* ${formatCurrencyBRL(item.valor_restante)}\n` +
    `• *Classificação:* ${item.classificacao}${item.dias_em_atraso > 0 ? ` (${item.dias_em_atraso} dias em atraso)` : ''}` +
    pagamentoInfo +
    `\n\nAssim que efetuar o pagamento, por favor nos envie o comprovante para darmos baixa imediata no sistema.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export async function fetchInadimplenciaData(): Promise<InadimplenciaResponseData> {
  const res = await fetch(`/api/inadimplencia?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Erro ao carregar inadimplência (${res.status})`);
  }
  return res.json();
}

export async function detectOverdueCandidates(): Promise<OverdueCandidate[]> {
  const res = await fetch(`/api/inadimplencia/detectar-vencidos?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.candidates) ? data.candidates : [];
}

export async function createInadimplencia(payload: {
  cliente_nome: string;
  documento_cpf_cnpj?: string;
  telefone: string;
  email?: string;
  descricao: string;
  valor_total: number;
  valor_pago?: number;
  data_vencimento: string;
  forma_pagamento?: string;
  dados_pagamento?: string;
  observacoes?: string;
  classificacao?: InadimplenciaClassificacao;
  classificacao_manual?: boolean;
  criado_por: string;
}): Promise<{
  item: InadimplenciaItem;
  alerta_automatico: InadimplenciaAlertaAutomatico;
  quitadoAutomaticamente: boolean;
}> {
  const res = await fetch('/api/inadimplencia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Falha ao registrar inadimplência (${res.status})`);
  }
  broadcastInadimplenciaUpdate();
  return json;
}

export async function updateInadimplencia(
  id: string,
  updates: Partial<InadimplenciaItem>
): Promise<{ item: InadimplenciaItem; quitadoAutomaticamente: boolean }> {
  const res = await fetch(`/api/inadimplencia/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Falha ao atualizar registro (${res.status})`);
  }
  broadcastInadimplenciaUpdate();
  return json;
}

export async function registerInadimplenciaPayment(
  id: string,
  payload: {
    valor_pagamento?: number;
    quitar_total?: boolean;
    forma_pagamento?: string;
    dados_pagamento?: string;
    comprovante_info?: string;
    observacoes?: string;
    data_pagamento?: string;
    registrado_por: string;
  }
): Promise<{ item: InadimplenciaItem; quitadoAutomaticamente: boolean }> {
  const res = await fetch(`/api/inadimplencia/${encodeURIComponent(id)}/pagamento`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Falha ao registrar pagamento (${res.status})`);
  }
  broadcastInadimplenciaUpdate();
  return json;
}

export async function deleteInadimplencia(id: string): Promise<void> {
  const res = await fetch(`/api/inadimplencia/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Falha ao excluir registro (${res.status})`);
  }
  broadcastInadimplenciaUpdate();
}
