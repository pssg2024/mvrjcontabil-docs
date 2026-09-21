import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseClient) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      try {
        supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
      } catch (e) {
        console.warn('Erro ao instanciar Supabase Client:', e);
      }
    }
  }
  return supabaseClient;
}

export async function getSupabaseAsync(): Promise<SupabaseClient | null> {
  const existing = getSupabase();
  if (existing) return existing;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const res = await fetch('/api/supabase-config');
      if (res.ok) {
        const data = await res.json();
        if (data.supabaseUrl && data.supabaseAnonKey) {
          supabaseClient = createClient(data.supabaseUrl, data.supabaseAnonKey);
          console.log('[Supabase Client] Inicializado com sucesso via /api/supabase-config');
          return supabaseClient;
        }
      }
    } catch (e) {
      console.warn('Não foi possível obter config do Supabase via API:', e);
    }
    return null;
  })();

  return initPromise;
}

// Keep export for backward compatibility
export const supabase = getSupabase();
