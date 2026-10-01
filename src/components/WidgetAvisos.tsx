import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User, 
  Trash2, 
  Edit2, 
  BellRing,
  ChevronDown,
  Layers,
  Sparkles
} from 'lucide-react';
import { AvisoItem, UserProfile } from '../types';
import { fetchAvisos, deleteAviso, subscribeAvisosRealtime, DEFAULT_AVISOS } from '../lib/avisos-service';
import { ModalNovoAviso } from './ModalNovoAviso';
import { ModalConfirmarSenhaExclusao } from './ModalConfirmarSenhaExclusao';

interface WidgetAvisosProps {
  currentUser: UserProfile;
  isAdmin?: boolean;
}

export const WidgetAvisos: React.FC<WidgetAvisosProps> = ({
  currentUser,
  isAdmin = false,
}) => {
  const [avisos, setAvisos] = useState<AvisoItem[]>(DEFAULT_AVISOS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estado dos modais e abas
  const [isNovoModalOpen, setIsNovoModalOpen] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<'novo' | 'gerenciar'>('novo');
  const [editingAviso, setEditingAviso] = useState<AvisoItem | null>(null);

  // Menu suspenso de ações dentro de "Novo"
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Modal de senha para exclusão direta
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Verificação rigorosa e abrangente de permissão administrativa
  const userIsAdmin = 
    Boolean(isAdmin) || 
    currentUser?.role === 'admin' || 
    (currentUser?.role as string) === 'ADMIN' || 
    (currentUser as any)?.role === 'Diretoria' || 
    currentUser?.sector === 'Diretoria' ||
    (currentUser as any)?.setor === 'Diretoria' ||
    (currentUser?.email || '').toLowerCase().includes('evandro');

  // Fechar menu de opções ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Carregamento inicial e assinatura em Tempo Real (Supabase Realtime + BroadcastChannel)
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const items = await fetchAvisos();
      if (isMounted && items && items.length > 0) {
        setAvisos(items);
      }
      if (isMounted) setIsLoading(false);
    }

    loadData();

    const unsubscribe = subscribeAvisosRealtime(
      (newOrUpdated) => {
        setAvisos((prev) => {
          const index = prev.findIndex((a) => a.id === newOrUpdated.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = newOrUpdated;
            return updated;
          }
          setCurrentIndex(0);
          return [newOrUpdated, ...prev];
        });
      },
      (deletedId) => {
        setAvisos((prev) => {
          const next = prev.filter((a) => a.id !== deletedId);
          return next;
        });
        setCurrentIndex(0);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleNext = () => {
    if (avisos.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % avisos.length);
  };

  const handlePrev = () => {
    if (avisos.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + avisos.length) % avisos.length);
  };

  const currentAviso = avisos[currentIndex] || avisos[0];

  // Ações a partir do botão/menu "Novo"
  const handleOpenNewModal = () => {
    setEditingAviso(null);
    setModalInitialTab('novo');
    setIsNovoModalOpen(true);
    setIsMenuOpen(false);
  };

  const handleOpenEditCurrent = () => {
    if (!currentAviso) return;
    setEditingAviso(currentAviso);
    setModalInitialTab('novo');
    setIsNovoModalOpen(true);
    setIsMenuOpen(false);
  };

  const handleOpenManageList = () => {
    setEditingAviso(null);
    setModalInitialTab('gerenciar');
    setIsNovoModalOpen(true);
    setIsMenuOpen(false);
  };

  const handleOpenDeleteCurrent = () => {
    setIsMenuOpen(false);
    setIsPasswordModalOpen(true);
  };

  const handleExecuteDelete = async () => {
    if (!currentAviso) return;
    await deleteAviso(currentAviso.id);
    setAvisos((prev) => prev.filter((a) => a.id !== currentAviso.id));
    setCurrentIndex(0);
    setIsPasswordModalOpen(false);
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
          bg: 'bg-rose-500/25 border-rose-400/40 text-rose-200',
          dot: 'bg-rose-400',
          label: 'URGENTE',
        };
      case 'alerta':
        return {
          bg: 'bg-amber-400/25 border-amber-400/40 text-amber-200',
          dot: 'bg-amber-400',
          label: 'ALERTA',
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-400/25 border-blue-400/35 text-blue-200',
          dot: 'bg-blue-400',
          label: 'COMUNICADO',
        };
    }
  };

  return (
    <>
      <div 
        id="widget-mural-avisos"
        className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3.5 sm:p-4 w-full shadow-xs flex flex-col justify-between gap-2.5 text-white transition-all select-none min-h-[160px] relative overflow-hidden"
        role="region"
        aria-label="Mural de Avisos Internos em Tempo Real"
      >
        {currentAviso ? (
          <>
            {/* LINHA 1: Topo Descongestionado - Badge de Tipo + Controles de Navegação */}
            <div className="flex items-center justify-between gap-2 w-full">
              {/* Badge de tipo com ponto pulsante */}
              {(() => {
                const b = getBadgeStyle(currentAviso.tipo);
                return (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold font-mono tracking-wider shadow-2xs shrink-0 ${b.bg}`}>
                    <span className="relative flex h-1.5 w-1.5">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${b.dot} opacity-75`}></span>
                      <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${b.dot}`}></span>
                    </span>
                    <span>{b.label}</span>
                  </span>
                );
              })()}

              {/* Controles de Navegação e Contador de Avisos */}
              <div className="flex items-center gap-1.5 shrink-0">
                {avisos.length > 1 && (
                  <div className="flex items-center bg-black/25 rounded-lg p-0.5 border border-white/15 text-[10px] font-mono">
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="p-1 rounded text-white/70 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                      title="Aviso anterior"
                      aria-label="Anterior"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-1.5 text-white font-bold tracking-tight">
                      {currentIndex + 1}/{avisos.length}
                    </span>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="p-1 rounded text-white/70 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                      title="Próximo aviso"
                      aria-label="Próximo"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* LINHA 2: Conteúdo Central Limpo e Sem Sobreposição */}
            <div className="space-y-1 my-auto">
              <h4 className="font-bold text-xs sm:text-sm text-white line-clamp-1 leading-snug tracking-tight">
                {currentAviso.titulo}
              </h4>
              <p className="text-[11px] text-blue-100/90 leading-relaxed line-clamp-2 font-normal">
                {currentAviso.mensagem}
              </p>
            </div>

            {/* LINHA 3: Rodapé com Informações à Esquerda e Botão ÚNICO "Novo" com Todas as Opções */}
            <div className="flex items-center justify-between gap-2 text-[10px] text-blue-200/80 pt-2 border-t border-white/10 w-full">
              {/* Esquerda: Data e Autor */}
              <div className="flex items-center space-x-2 min-w-0">
                <div className="flex items-center space-x-1 font-mono shrink-0">
                  <Clock className="w-3 h-3 text-[#DFB76C]" />
                  <span>{formatDate(currentAviso.created_at)}</span>
                </div>

                <div className="hidden sm:flex items-center space-x-1 truncate max-w-[120px]" title={currentAviso.autor_nome}>
                  <User className="w-3 h-3 text-blue-300 shrink-0" />
                  <span className="truncate">{currentAviso.autor_nome}</span>
                </div>
              </div>

              {/* Direita: TODAS AS OPÇÕES REUNIDAS DENTRO DE UM ÚNICO BOTÃO "NOVO" */}
              {userIsAdmin && (
                <div className="relative shrink-0" ref={menuRef}>
                  <div className="inline-flex rounded-lg shadow-xs overflow-hidden bg-[#DFB76C] text-slate-950">
                    {/* Botão Principal: Abre o modal de Novo/Gerenciamento completo */}
                    <button
                      type="button"
                      onClick={handleOpenNewModal}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold hover:bg-[#cf9e3c] transition-colors cursor-pointer"
                      title="Publicar ou gerenciar comunicados"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Novo</span>
                    </button>

                    {/* Seta Dropdown: Abre menu suspenso com todas as opções */}
                    <button
                      type="button"
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="px-1.5 py-1 border-l border-slate-900/15 hover:bg-[#cf9e3c] transition-colors cursor-pointer flex items-center justify-center"
                      title="Ver todas as opções (Editar, Excluir, Novo)"
                      aria-label="Opções de comunicado"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Menu Popover com Todas as Opções Reunidas */}
                  {isMenuOpen && (
                    <div 
                      className="absolute right-0 bottom-full mb-1.5 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 text-slate-800 dark:text-slate-100 z-50 animate-in fade-in zoom-in-95 duration-150 text-xs font-medium"
                      role="menu"
                    >
                      {/* Opção 1: Novo Comunicado */}
                      <button
                        type="button"
                        onClick={handleOpenNewModal}
                        className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2 transition-colors cursor-pointer text-slate-900 dark:text-white font-bold"
                        role="menuitem"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#1B357B] dark:text-[#DFB76C] stroke-[2.5]" />
                        <span>+ Novo Comunicado</span>
                      </button>

                      {/* Opção 2: Editar Este Comunicado */}
                      <button
                        type="button"
                        onClick={handleOpenEditCurrent}
                        className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2 transition-colors cursor-pointer text-slate-700 dark:text-slate-300"
                        role="menuitem"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                        <span>Editar Comunicado Atual</span>
                      </button>

                      {/* Opção 3: Excluir com Senha */}
                      <button
                        type="button"
                        onClick={handleOpenDeleteCurrent}
                        className="w-full px-3 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center space-x-2 transition-colors cursor-pointer border-t border-slate-100 dark:border-slate-800"
                        role="menuitem"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>Excluir Publicação (com senha)</span>
                      </button>

                      {/* Opção 4: Ver Todas as Publicações */}
                      <button
                        type="button"
                        onClick={handleOpenManageList}
                        className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2 transition-colors cursor-pointer text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800"
                        role="menuitem"
                      >
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        <span>Ver Todas as Publicações ({avisos.length})</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Estado Vazio */
          <div className="flex flex-col items-center justify-center text-center p-3 my-auto space-y-2">
            <BellRing className="w-6 h-6 text-blue-200/50" />
            <p className="text-xs text-blue-100/70">Nenhum comunicado ativo no momento.</p>
            {userIsAdmin && (
              <button
                type="button"
                onClick={handleOpenNewModal}
                className="mt-1 px-3 py-1 bg-[#DFB76C] hover:bg-[#c9a049] text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Publicar Comunicado</span>
              </button>
            )}
          </div>
        )}

      </div>

      {/* Modal Unificado: Contém Todas as Opções (Criar, Editar e Excluir com Senha) */}
      {isNovoModalOpen && (
        <ModalNovoAviso
          isOpen={isNovoModalOpen}
          onClose={() => {
            setIsNovoModalOpen(false);
            setEditingAviso(null);
          }}
          currentUser={currentUser}
          editingAviso={editingAviso}
          avisos={avisos}
          initialTab={modalInitialTab}
          onAvisoCreated={(newAviso) => {
            setAvisos((prev) => [newAviso, ...prev]);
            setCurrentIndex(0);
          }}
          onAvisoUpdated={(updated) => {
            setAvisos((prev) => {
              const index = prev.findIndex((a) => a.id === updated.id);
              if (index >= 0) {
                const next = [...prev];
                next[index] = updated;
                return next;
              }
              return [updated, ...prev];
            });
          }}
          onAvisoDeleted={(id) => {
            setAvisos((prev) => prev.filter((a) => a.id !== id));
            setCurrentIndex(0);
          }}
        />
      )}

      {/* Modal de Senha para Exclusão Direta a partir do Menu do Card */}
      {isPasswordModalOpen && currentAviso && (
        <ModalConfirmarSenhaExclusao
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          onConfirm={handleExecuteDelete}
          aviso={currentAviso}
          currentUser={currentUser}
        />
      )}
    </>
  );
};
