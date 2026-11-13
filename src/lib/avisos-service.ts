import { getSupabase } from './supabase';
import { AvisoItem, AvisoTipo } from '../types';

const BROADCAST_CHANNEL_NAME = 'mvrj-avisos-channel';
const SAME_TAB_EVENT_NAME = 'mvrj-avisos-sync';

/**
 * Avisos padrão de contingência (usados apenas se o servidor estiver offline)
 */
export const DEFAULT_AVISOS: AvisoItem[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    titulo: 'Fechamento Mensal de Folha e eSocial',
    mensagem: 'Lembramos a todos os clientes que os apontamentos e horas extras devem ser enviados até o dia 05 para processamento tempestivo da folha de pagamento.',
    tipo: 'alerta',
    autor_nome: 'Departamento Pessoal MVRJ',
    ativo: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    titulo: 'Prazo de Entrega DCTFWeb & EFD-Reinf',
    mensagem: 'Evite multas e retenções. Os documentos comprobatórios devem ser anexados na pasta Fiscal & Tributário com antecedência mínima de 48 horas úteis.',
    tipo: 'info',
    autor_nome: 'Setor Fiscal & Tributário',
    ativo: true,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
];

function normalizeAviso(raw: any): AvisoItem {
  return {
    id: String(raw?.id || ''),
    titulo: String(raw?.titulo || ''),
    mensagem: String(raw?.mensagem ?? raw?.conteudo ?? ''),
    tipo: (['info', 'alerta', 'urgente'].includes(raw?.tipo) ? raw.tipo : 'info') as AvisoTipo,
    autor_nome: String(raw?.autor_nome || 'Administração'),
    ativo: raw?.ativo !== false,
    created_at: String(raw?.created_at || new Date().toISOString()),
  };
}

function broadcastAvisoEvent(
  detail: { type: 'NOVO_AVISO'; aviso: AvisoItem } | { type: 'DELETE_AVISO'; id: string }
) {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT_NAME, { detail }));
    }
  } catch {}

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.postMessage(detail);
      bc.close();
    }
  } catch {}
}

/**
 * Busca todos os avisos ativos na API persistida (R2 + Supabase + Disco)
 */
export async function fetchAvisos(): Promise<AvisoItem[]> {
  try {
    const res = await fetch(`/api/avisos?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.avisos)) {
        return json.avisos.map(normalizeAviso);
      }
    }
  } catch (err) {
    console.warn('Erro ao carregar avisos da API /api/avisos:', err);
  }

  // Fallback de contingência direta no Supabase se API estiver indisponível
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('avisos_sistema')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map(normalizeAviso);
      }
    }
  } catch (err) {
    console.warn('Erro ao carregar avisos do Supabase:', err);
  }

  return DEFAULT_AVISOS;
}

/**
 * Insere um novo aviso de forma persistente (R2 + Disco + Supabase) e propaga em tempo real
 */
export async function insertAviso(novoAviso: {
  titulo: string;
  mensagem: string;
  tipo: AvisoTipo;
  autor_nome: string;
  ativo?: boolean;
}): Promise<AvisoItem> {
  const payload = {
    titulo: novoAviso.titulo.trim(),
    mensagem: novoAviso.mensagem.trim(),
    tipo: novoAviso.tipo || 'info',
    autor_nome: novoAviso.autor_nome.trim() || 'Administração',
    ativo: novoAviso.ativo ?? true,
    created_at: new Date().toISOString(),
  };

  const res = await fetch('/api/avisos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson?.error || `Falha ao salvar comunicado (${res.status})`);
  }

  const json = await res.json();
  if (!json?.aviso) {
    throw new Error('Resposta inválida ao salvar comunicado.');
  }

  const finalItem = normalizeAviso(json.aviso);
  broadcastAvisoEvent({ type: 'NOVO_AVISO', aviso: finalItem });
  return finalItem;
}

/**
 * Atualiza um aviso existente de forma persistente (R2 + Disco + Supabase)
 */
export async function updateAviso(
  id: string,
  updates: Partial<Omit<AvisoItem, 'id' | 'created_at'>>
): Promise<AvisoItem> {
  const res = await fetch(`/api/avisos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson?.error || `Falha ao atualizar comunicado (${res.status})`);
  }

  const json = await res.json();
  if (!json?.aviso) {
    throw new Error('Resposta inválida ao atualizar comunicado.');
  }

  const finalItem = normalizeAviso(json.aviso);
  broadcastAvisoEvent({ type: 'NOVO_AVISO', aviso: finalItem });
  return finalItem;
}

/**
 * Exclui um aviso de forma persistente (R2 + Disco + Supabase) e propaga em tempo real
 */
export async function deleteAviso(id: string): Promise<boolean> {
  const res = await fetch(`/api/avisos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson?.error || `Falha ao excluir comunicado (${res.status})`);
  }

  broadcastAvisoEvent({ type: 'DELETE_AVISO', id });
  return true;
}

/**
 * Ativa a escuta em Tempo Real (Supabase Realtime + BroadcastChannel + Evento na mesma aba)
 */
export function subscribeAvisosRealtime(
  onInsertOrUpdate: (aviso: AvisoItem) => void,
  onDelete?: (id: string) => void
): () => void {
  const supabase = getSupabase();
  let channel: any = null;
  let bc: BroadcastChannel | null = null;

  // 1. Supabase Realtime Channel
  if (supabase) {
    try {
      channel = supabase
        .channel('realtime-avisos-sistema')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'avisos_sistema' },
          (payload: any) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              if (payload.new && payload.new.ativo !== false) {
                onInsertOrUpdate(normalizeAviso(payload.new));
              } else if (payload.new && payload.new.ativo === false && onDelete) {
                onDelete(payload.new.id);
              }
            } else if (payload.eventType === 'DELETE' && onDelete && payload.old) {
              onDelete(payload.old.id);
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Erro ao assinar canal Supabase Realtime para avisos:', err);
    }
  }

  // 2. BroadcastChannel multi-aba
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (event.data?.type === 'NOVO_AVISO' && event.data.aviso) {
          onInsertOrUpdate(normalizeAviso(event.data.aviso));
        } else if (event.data?.type === 'DELETE_AVISO' && event.data.id && onDelete) {
          onDelete(event.data.id);
        }
      };
    }
  } catch {}

  // 3. Sincronização instantânea entre instâncias na mesma aba (ex: Mobile slim-bar <-> Desktop card)
  const handleSameTabEvent = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail?.type === 'NOVO_AVISO' && detail.aviso) {
      onInsertOrUpdate(normalizeAviso(detail.aviso));
    } else if (detail?.type === 'DELETE_AVISO' && detail.id && onDelete) {
      onDelete(detail.id);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(SAME_TAB_EVENT_NAME, handleSameTabEvent);
  }

  // Cleanup function
  return () => {
    if (supabase && channel) {
      try {
        supabase.removeChannel(channel);
      } catch {}
    }
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener(SAME_TAB_EVENT_NAME, handleSameTabEvent);
    }
  };
}
