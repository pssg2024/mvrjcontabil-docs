import React from 'react';
import { AlertOctagon, Phone, ShieldAlert, XCircle, HardDrive } from 'lucide-react';
import { formatBytes } from '../lib/optimization';

interface StorageLimitModalProps {
  isOpen: boolean;
  onClose?: () => void;
  usedBytes?: number;
  totalCapacityBytes?: number;
}

export const StorageLimitModal: React.FC<StorageLimitModalProps> = ({
  isOpen,
  onClose,
  usedBytes = 10 * 1024 * 1024 * 1024,
  totalCapacityBytes = 10 * 1024 * 1024 * 1024,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      id="storage-limit-blocked-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="storage-limit-title"
    >
      <div className="bg-white dark:bg-slate-900 border-2 border-rose-500/80 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-900 dark:text-slate-100">
        
        {/* Top critical bar */}
        <div className="bg-rose-600 px-6 py-4 text-white flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <AlertOctagon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 id="storage-limit-title" className="text-base sm:text-lg font-bold leading-tight">
              Limite de Armazenamento Atingido
            </h3>
            <p className="text-xs text-rose-100 mt-0.5">
              Envio e gravação de novos documentos temporariamente bloqueados
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Status highlight */}
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-start space-x-3 text-xs text-rose-900 dark:text-rose-200">
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-rose-950 dark:text-rose-100">
                A capacidade do Cloudflare R2 chegou a 100% da cota contratada ({formatBytes(totalCapacityBytes)}).
              </p>
              <p className="text-rose-700 dark:text-rose-300">
                Por políticas de segurança e integridade, nenhum novo arquivo pode ser carregado até que o espaço seja expandido ou liberado.
              </p>
            </div>
          </div>

          {/* Quota details */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
              <HardDrive className="w-4 h-4 text-slate-400" />
              <span>Consumo Atual:</span>
            </div>
            <div className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
              {formatBytes(usedBytes)} / {formatBytes(totalCapacityBytes)} (100%)
            </div>
          </div>

          {/* IT Support Contact Card */}
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-blue-950 dark:text-blue-200">
              <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Contato Imediato com o Suporte:</span>
            </div>
            
            <p className="text-xs text-blue-900 dark:text-blue-300">
              Para solicitar liberação ou expansão do plano de armazenamento, entre em contato direto com o <strong>Administrador / Suporte de TI</strong>:
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white dark:bg-slate-900 rounded-lg border border-blue-100 dark:border-blue-900">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                  Telefone / WhatsApp Suporte TI
                </span>
                <span className="text-base font-extrabold font-mono text-blue-600 dark:text-blue-400 tracking-wider">
                  (21) 97396-0077
                </span>
              </div>
              <a 
                href="https://wa.me/5521973960077?text=Ol%C3%A1%2C%20o%20limite%20de%20armazenamento%20do%20GED%20MVRJCONT%C3%81BIL%20foi%20atingido.%20Preciso%20de%20suporte." 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
              >
                Chamar no WhatsApp
              </a>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end pt-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Entendi, fechar aviso
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
