import React, { useMemo } from 'react';
import { DocumentFile } from '../types';
import { isDueAlert } from '../lib/due-date-utils';
import { Bell, ArrowRight, Clock, AlertTriangle } from 'lucide-react';

interface DueNoticeBannerProps {
  files: DocumentFile[];
  onOpenDueNoticeModal: () => void;
}

export const DueNoticeBanner: React.FC<DueNoticeBannerProps> = ({
  files,
  onOpenDueNoticeModal,
}) => {
  const dueCount = useMemo(() => {
    return files.filter(f => !f.is_archived && isDueAlert(f.due_date)).length;
  }, [files]);

  const pendingNotificationCount = useMemo(() => {
    return files.filter(f => !f.is_archived && isDueAlert(f.due_date) && !f.notification_sent).length;
  }, [files]);

  // Só deve aparecer se houver guias a vencer nos próximos 5 dias ou vencidas
  if (dueCount === 0) {
    return null;
  }

  const guideWord = dueCount === 1 ? 'guia' : 'guias';
  const existWord = dueCount === 1 ? 'existe' : 'existem';

  return (
    <section 
      id="due-notice-header-banner"
      aria-label="Alerta de guias com vencimento próximo"
      className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-2.5 mb-2"
    >
      <div 
        id="due-notice-banner-container"
        className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-200 backdrop-blur-md shadow-sm transition-all"
      >
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0 shadow-xs">
            <Bell className="w-5 h-5 animate-bounce" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm leading-snug">
            <span className="font-medium text-amber-100">
              🔔 Atenção: {existWord} <strong className="font-bold text-amber-300 underline underline-offset-2">{dueCount} {guideWord}</strong> com vencimento próximo exigindo aviso aos clientes.
            </span>
            {pendingNotificationCount > 0 && (
              <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/30 w-fit">
                <Clock className="w-3 h-3 mr-1" />
                {pendingNotificationCount} {pendingNotificationCount === 1 ? 'pendente de envio' : 'pendentes de envio'}
              </span>
            )}
          </div>
        </div>

        <button
          id="btn-open-due-notice-modal"
          type="button"
          onClick={onOpenDueNoticeModal}
          className="w-full sm:w-auto shrink-0 bg-gradient-to-r from-[#C59B4B] to-[#DFC17B] text-slate-900 font-bold text-xs px-4 py-2 rounded-xl shadow hover:opacity-95 transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
        >
          <span>Gerenciar Avisos de Vencimento</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </button>
      </div>
    </section>
  );
};
