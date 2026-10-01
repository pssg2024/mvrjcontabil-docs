import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Trash2, 
  Plus, 
  Clock, 
  User, 
  Edit2,
  Megaphone,
  CheckCircle2,
  KeyRound,
  ShieldCheck
} from 'lucide-react';
import { AvisoItem, UserProfile } from '../types';
import { deleteAviso } from '../lib/avisos-service';
import { ModalConfirmarSenhaExclusao } from './ModalConfirmarSenhaExclusao';

interface ModalGerenciarAvisosProps {
  isOpen: boolean;
  onClose: () => void;
  avisos: AvisoItem[];
  currentUser: UserProfile;
  isAdmin: boolean;
  onAvisoDeleted: (id: string) => void;
  onOpenNovoAviso: () => void;
  onOpenEditarAviso: (aviso: AvisoItem) => void;
}

export const ModalGerenciarAvisos: React.FC<ModalGerenciarAvisosProps> = ({
  isOpen,
  onClose,
  avisos,
  currentUser,
  isAdmin,
  onAvisoDeleted,
  onOpenNovoAviso,
  onOpenEditarAviso,
}) => {
  const [targetDeleteAviso, setTargetDeleteAviso] = useState<AvisoItem | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Trava de rolagem rigorosa na página ao fundo (Body Scroll Lock)
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.width = originalBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // Tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPasswordModalOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isPasswordModalOpen]);

  if (!isOpen) return null;

  // Acionar modal de confirmação por senha
  const handleRequestDelete = (aviso: AvisoItem) => {
    setTargetDeleteAviso(aviso);
    setIsPasswordModalOpen(true);
  };

  // Executar exclusão após senha confirmada
  const handleExecuteDelete = async () => {
    if (!targetDeleteAviso) return;

    const id = targetDeleteAviso.id;
    await deleteAviso(id);
    onAvisoDeleted(id);
    setTargetDeleteAviso(null);
    setIsPasswordModalOpen(false);
    setSuccessMsg('Publicação excluída com sucesso após autenticação!');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const isToday = new Date().toDateString() === date.toDateString();
      if (isToday) {
        return `Hoje às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      }
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const getBadgeStyle = (tipo: string) => {
    switch (tipo) {
      case 'urgente':
        return {
          bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300 dark:border-rose-800',
          dot: 'bg-rose-500',
          label: 'URGENTE',
        };
      case 'alerta':
        return {
          bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800',
          dot: 'bg-amber-500',
          label: 'ALERTA',
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300 dark:border-blue-800',
          dot: 'bg-blue-500',
          label: 'COMUNICADO',
        };
    }
  };

  const modalContent = (
    <>
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm overscroll-contain animate-in fade-in duration-200 select-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-gerenciar-avisos-title"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isPasswordModalOpen) onClose();
        }}
        onTouchMove={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
          }
        }}
      >
        <div 
          className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 overscroll-contain animate-in zoom-in-95 duration-200 select-text"
          onClick={(e) => e.stopPropagation()}
        >
          
          {/* Cabeçalho Fixo */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-950/60 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#1B357B] text-white flex items-center justify-center shadow-xs shrink-0">
                <Megaphone className="w-5 h-5 text-[#DFB76C]" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 id="modal-gerenciar-avisos-title" className="font-bold text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                    Mural de Comunicados Internos
                  </h3>
                  {isAdmin && (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-[10px] font-bold border border-blue-200 dark:border-blue-800">
                      <ShieldCheck className="w-3 h-3 text-[#DFB76C]" />
                      <span>Modo Administrador</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {avisos.length} {avisos.length === 1 ? 'publicação ativa' : 'publicações ativas'} no mural corporativo
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenNovoAviso();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B357B] hover:bg-[#14285d] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>+ Novo Comunicado</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mensagem de sucesso */}
          {successMsg && (
            <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center space-x-2 animate-in fade-in shrink-0">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Lista de Publicações com Rolagem Contida */}
          <div className="p-5 space-y-3.5 overflow-y-auto overscroll-contain flex-1">
            {avisos.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <Megaphone className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                  Nenhum comunicado ativo no momento.
                </p>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenNovoAviso();
                    }}
                    className="px-4 py-2 bg-[#1B357B] text-white rounded-xl text-xs font-bold hover:bg-[#14285d] transition-colors cursor-pointer"
                  >
                    + Criar Primeiro Comunicado
                  </button>
                )}
              </div>
            ) : (
              avisos.map((aviso) => {
                const b = getBadgeStyle(aviso.tipo);

                return (
                  <div
                    key={aviso.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  >
                    {/* Informações da Publicação */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold font-mono tracking-wider ${b.bg}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${b.dot}`}></span>
                          <span>{b.label}</span>
                        </span>

                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#DFB76C]" />
                          <span>{formatDate(aviso.created_at)}</span>
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                        {aviso.titulo}
                      </h4>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                        {aviso.mensagem}
                      </p>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                        <User className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span>Publicado por: <strong className="font-semibold text-slate-700 dark:text-slate-300">{aviso.autor_nome}</strong></span>
                      </div>
                    </div>

                    {/* Botões de Ação Administrativa (Editar e Excluir com Senha) */}
                    {isAdmin && (
                      <div className="sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800 flex items-center gap-2">
                        {/* Botão EDITAR */}
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenEditarAviso(aviso);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
                          title="Editar este comunicado"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Editar</span>
                        </button>

                        {/* Botão EXCLUIR (Requer Senha) */}
                        <button
                          type="button"
                          onClick={() => handleRequestDelete(aviso)}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer group shadow-2xs"
                          title="Excluir esta publicação (requer senha de administrador)"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Rodapé Fixo */}
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/40 shrink-0 text-xs text-slate-500">
            <div className="flex items-center space-x-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-500" />
              <span>Exclusão protegida por senha de administrador</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer transition-colors"
            >
              Fechar
            </button>
          </div>

        </div>
      </div>

      {/* Modal de Confirmação por Senha */}
      {isPasswordModalOpen && targetDeleteAviso && (
        <ModalConfirmarSenhaExclusao
          isOpen={isPasswordModalOpen}
          onClose={() => {
            setIsPasswordModalOpen(false);
            setTargetDeleteAviso(null);
          }}
          onConfirm={handleExecuteDelete}
          aviso={targetDeleteAviso}
          currentUser={currentUser}
        />
      )}
    </>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
