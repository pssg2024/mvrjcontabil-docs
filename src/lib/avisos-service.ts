import { getSupabase } from './supabase';
import { AvisoItem, AvisoTipo } from '../types';

const BROADCAST_CHANNEL_NAME = 'mvrj-avisos-channel';

/**
 * Avisos padrão de contingência
 */
export const DEFAULT_AVISOS: AvisoItem[] = [
  {
    id: 'aviso-padrao-1',
    titulo: 'Fechamento Mensal de Folha e eSocial',
    mensagem: 'Lembramos a todos os clientes que os apontamentos e horas extras devem ser enviados até o dia 05 para processamento tempestivo da folha.',
    tipo: 'alerta',
    autor_nome: 'Departamento Pessoal MVRJ',
    ativo: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'aviso-padrao-2',
    titulo: 'Prazo de Entrega DCTFWeb & EFD-Reinf',
    mensagem: 'Evite multas e retenções. Os documentos comprobatórios devem ser anexados na pasta Fiscal com antecedência mínima de 48 horas úteis.',
    tipo: 'info',
    autor_nome: 'Setor Fiscal & Tributário',
    ativo: true,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
];

/**
 * Busca todos os avisos ativos no Supabase ou via API de fallback
 */
export async function fetchAvisos(): Promise<AvisoItem[]> {
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('avisos_sistema')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as AvisoItem[];
      }
    }

    // Fallback: API local do servidor
    const res = await fetch('/api/avisos');
    if (res.ok) {
      const json = await res.json();
      if (json.avisos && Array.isArray(json.avisos) && json.avisos.length > 0) {
        return json.avisos as AvisoItem[];
      }
    }
  } catch (err) {
    console.warn('Erro ao carregar avisos do Supabase/API:', err);
  }

  return DEFAULT_AVISOS;
}

/**
 * Insere um novo aviso no Supabase e propaga para todos os clientes
 */
export async function insertAviso(novoAviso: {
  titulo: string;
  mensagem: string;
  tipo: AvisoTipo;
  autor_nome: string;
  ativo?: boolean;
}): Promise<AvisoItem | null> {
  const payload = {
    titulo: novoAviso.titulo.trim(),
    mensagem: novoAviso.mensagem.trim(),
    tipo: novoAviso.tipo || 'info',
    autor_nome: novoAviso.autor_nome.trim() || 'Administração',
    ativo: novoAviso.ativo ?? true,
    created_at: new Date().toISOString(),
  };

  let savedItem: AvisoItem | null = null;

  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('avisos_sistema')
        .insert([payload])
        .select()
        .single();

      if (!error && data) {
        savedItem = data as AvisoItem;
      }
    }
  } catch (err) {
    console.warn('Falha ao inserir aviso via Supabase SDK:', err);
  }

  // Sincronizar também com o backend Node.js
  try {
    const res = await fetch('/api/avisos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(savedItem || payload),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.aviso) {
        savedItem = json.aviso as AvisoItem;
      }
    }
  } catch (err) {
    console.warn('Falha ao sincronizar aviso com API de contingência:', err);
  }

  const finalItem: AvisoItem = savedItem || {
    id: 'aviso-' + Date.now(),
    ...payload,
  };

  // Notificar outras abas do navegador via BroadcastChannel
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.postMessage({ type: 'NOVO_AVISO', aviso: finalItem });
      bc.close();
    }
  } catch {}

  return finalItem;
}

/**
 * Atualiza um aviso existente no Supabase e backend local
 */
export async function updateAviso(
  id: string,
  updates: Partial<Omit<AvisoItem, 'id' | 'created_at'>>
): Promise<AvisoItem | null> {
  let updatedItem: AvisoItem | null = null;

  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('avisos_sistema')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        updatedItem = data as AvisoItem;
      }
    }
  } catch (err) {
    console.warn('Falha ao atualizar aviso via Supabase SDK:', err);
  }

  try {
    const res = await fetch(`/api/avisos/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.aviso) {
        updatedItem = json.aviso as AvisoItem;
      }
    }
  } catch (err) {
    console.warn('Falha ao sincronizar atualização de aviso com API:', err);
  }

  const finalItem: AvisoItem = updatedItem || {
    id,
    titulo: updates.titulo || '',
    mensagem: updates.mensagem || '',
    tipo: updates.tipo || 'info',
    autor_nome: updates.autor_nome || 'Administração',
    ativo: updates.ativo ?? true,
    created_at: new Date().toISOString(),
  };

  // Notificar outras abas do navegador via BroadcastChannel
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.postMessage({ type: 'NOVO_AVISO', aviso: finalItem });
      bc.close();
    }
  } catch {}

  return finalItem;
}

/**
 * Exclui / desativa um aviso no Supabase e propaga em tempo real
 */
export async function deleteAviso(id: string): Promise<boolean> {
  let success = false;

  try {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase
        .from('avisos_sistema')
        .delete()
        .eq('id', id);
      if (!error) success = true;
    }
  } catch (err) {
    console.warn('Erro ao deletar aviso no Supabase:', err);
  }

  // Notificar backend local
  try {
    const res = await fetch(`/api/avisos/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) success = true;
  } catch (err) {
    console.warn('Erro ao deletar aviso no servidor local:', err);
  }

  // Broadcast para todas as outras abas
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.postMessage({ type: 'DELETE_AVISO', id });
      bc.close();
    }
  } catch {}

  return success;
}

/**
 * Ativa a escuta em Tempo Real (Supabase Realtime + BroadcastChannel)
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
                onInsertOrUpdate(payload.new as AvisoItem);
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
          onInsertOrUpdate(event.data.aviso as AvisoItem);
        } else if (event.data?.type === 'DELETE_AVISO' && event.data.id && onDelete) {
          onDelete(event.data.id);
        }
      };
    }
  } catch {}

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
  };
}
