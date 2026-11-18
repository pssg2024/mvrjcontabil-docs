import { UserProfile } from '../types';

const SESSION_TOKEN_KEY = 'mvrj_session_token';
const SESSION_USER_KEY = 'mvrj_session_user';

export function getStoredSessionToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY) || localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  const token = getStoredSessionToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export function saveSessionCredentials(token: string, user: UserProfile) {
  try {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    localStorage.setItem(SESSION_TOKEN_KEY, token);
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  } catch {}
}

export function clearSessionCredentials() {
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
  } catch {}
}

export async function issueServerSessionToken(user: UserProfile): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        sector: user.sector,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.token && typeof data.token === 'string') {
      saveSessionCredentials(data.token, data.user || user);
      return data.token;
    }
    return null;
  } catch {
    return null;
  }
}

export function downloadCsvFile(filename: string, headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) {
  const escapeCell = (val: string | number | boolean | null | undefined): string => {
    const str = val === null || val === undefined ? '' : String(val);
    const cleaned = str.replace(/\r?\n/g, ' ');
    if (cleaned.includes(';') || cleaned.includes('"') || cleaned.includes(',')) {
      return `"${cleaned.replace(/"/g, '""')}"`;
    }
    return cleaned;
  };

  // Semicolon separator + UTF-8 BOM so Microsoft Excel (PT-BR) opens columns and accents cleanly
  const lines = [
    headers.map(escapeCell).join(';'),
    ...rows.map((r) => r.map(escapeCell).join(';')),
  ];
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
