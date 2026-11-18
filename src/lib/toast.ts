export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastPayload {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

type ToastListener = (toast: ToastPayload) => void;

const listeners = new Set<ToastListener>();

export function subscribeToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function showToast(
  message: string,
  type: ToastType = 'info',
  options?: { title?: string; duration?: number }
): void {
  const payload: ToastPayload = {
    id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    title: options?.title,
    message,
    duration: options?.duration ?? (type === 'error' ? 5200 : 3800),
  };
  listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch {}
  });
}
