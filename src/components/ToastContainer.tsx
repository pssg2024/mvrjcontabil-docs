import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { subscribeToasts, ToastPayload } from '../lib/toast';

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToasts((toast) => {
      setToasts((prev) => [...prev.slice(-3), toast]);
      const duration = toast.duration ?? 3800;
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id));
      }, duration);
    });
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => {
        const tone =
          toast.type === 'success'
            ? 'bg-[#091124]/95 border-emerald-500/40 text-emerald-100'
            : toast.type === 'error'
            ? 'bg-[#091124]/95 border-rose-500/45 text-rose-100'
            : toast.type === 'warning'
            ? 'bg-[#091124]/95 border-amber-500/45 text-amber-100'
            : 'bg-[#091124]/95 border-slate-700 text-slate-100';

        const icon =
          toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : toast.type === 'error' ? (
            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          ) : toast.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-[#DFB76C] shrink-0 mt-0.5" />
          );

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 ${tone}`}
          >
            {icon}
            <div className="flex-1 min-w-0 text-xs leading-relaxed">
              {toast.title && (
                <p className="font-bold text-white mb-0.5 tracking-tight">{toast.title}</p>
              )}
              <p className="text-slate-200 break-words">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== toast.id))}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              aria-label="Fechar notificação"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
