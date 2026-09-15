import React, { useState, useEffect } from 'react';
import { X, Palette, Image as ImageIcon, Sparkles } from 'lucide-react';
import { UserProfile, SiteBackgroundConfig, AuthHeaderConfig } from '../types';
import { BackgroundCustomizer } from './BackgroundCustomizer';
import { AuthHeaderCustomizer } from './AuthHeaderCustomizer';

interface BackgroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  currentConfig: SiteBackgroundConfig;
  onConfigChange: (newConfig: SiteBackgroundConfig) => void;
  authHeaderConfig: AuthHeaderConfig;
  onAuthHeaderConfigChange: (newConfig: AuthHeaderConfig) => void;
  initialTab?: 'site-background' | 'auth-header';
  onAuditLog?: (details: Record<string, any>) => void;
}

export const BackgroundModal: React.FC<BackgroundModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentConfig,
  onConfigChange,
  authHeaderConfig,
  onAuthHeaderConfigChange,
  initialTab = 'site-background',
  onAuditLog,
}) => {
  const [activeTab, setActiveTab] = useState<'site-background' | 'auth-header'>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-5xl bg-slate-50 rounded-2xl shadow-2xl border border-gray-200 overflow-hidden my-8 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900 leading-tight">
                Central de Personalização Visual & Branding
              </h2>
              <p className="text-xs text-gray-500">
                Acesso exclusivo para Administradores da MVRJCONTÁBIL
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Tab Selector */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('site-background')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeTab === 'site-background'
                    ? 'bg-white text-purple-700 shadow-xs font-black'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                <span>Fundo do Site</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('auth-header')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeTab === 'auth-header'
                    ? 'bg-white text-blue-700 shadow-xs font-black'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Cabeçalho de Login</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'site-background' ? (
            <BackgroundCustomizer
              currentUser={currentUser}
              currentConfig={currentConfig}
              onConfigChange={(newConf) => {
                onConfigChange(newConf);
              }}
              onAuditLog={onAuditLog}
            />
          ) : (
            <AuthHeaderCustomizer
              currentUser={currentUser}
              currentConfig={authHeaderConfig}
              onConfigChange={(newConf) => {
                onAuthHeaderConfigChange(newConf);
              }}
              onAuditLog={onAuditLog}
            />
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-gray-500">
            {activeTab === 'site-background' ? (
              <span>Modificações do plano de fundo afetam a visualização de todos os colaboradores e clientes.</span>
            ) : (
              <span>As alterações no cabeçalho do login ficam visíveis imediatamente na tela inicial do sistema.</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    </div>
  );
};
