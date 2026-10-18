import React from 'react';
import { X, Sparkles } from 'lucide-react';
import { UserProfile, SiteBackgroundConfig, AuthHeaderConfig } from '../types';
import { AuthHeaderCustomizer } from './AuthHeaderCustomizer';

interface BackgroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  currentConfig?: SiteBackgroundConfig;
  onConfigChange?: (newConfig: SiteBackgroundConfig) => void;
  authHeaderConfig: AuthHeaderConfig;
  onAuthHeaderConfigChange: (newConfig: AuthHeaderConfig) => void;
  initialTab?: string;
  onAuditLog?: (details: Record<string, any>) => void;
}

export const BackgroundModal: React.FC<BackgroundModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  authHeaderConfig,
  onAuthHeaderConfigChange,
  onAuditLog,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-5xl bg-slate-50 rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 overflow-hidden my-4 sm:my-8 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="bg-white px-5 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#1B357B]/10 text-[#1B357B] border border-[#1B357B]/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-[#1B357B]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-black text-gray-900 leading-tight truncate">
                  Personalização do Cabeçalho de Login
                </h2>
                <span className="hidden sm:inline-block bg-[#C59B4B]/20 text-[#967028] border border-[#C59B4B]/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0">
                  MVRJ Admin
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate">
                Identidade visual, marca e logotipo na tela de autenticação
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Fechar Janela"
            aria-label="Fechar Janela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <AuthHeaderCustomizer
            currentUser={currentUser}
            currentConfig={authHeaderConfig}
            onConfigChange={(newConf) => {
              onAuthHeaderConfigChange(newConf);
            }}
            onAuditLog={onAuditLog}
          />
        </div>

        {/* Modal Footer */}
        <div className="bg-white px-5 sm:px-6 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-gray-500 text-center sm:text-left">
            As alterações no cabeçalho do login são sincronizadas no servidor e ficam visíveis na tela inicial.
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    </div>
  );
};
