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
  Sparkles,
  ShieldCheck
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

  // Menu suspenso de ações agrupadas no botão "Novo"
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

  // Paleta de badges refinada com alto contraste
  const getBadgeStyle = (tipo: string) => {
    switch (tipo) {
      case 'urgente':
        return {
          bg: 'bg-rose-500/15 border-rose-400/35 text-rose-200',
          dot: 'bg-rose-400 shadow-xs shadow-rose-400',
          label: 'URGENTE',
        };
      case 'alerta':
        return {
          bg: 'bg-amber-500/15 border-amber-400/35 text-amber-200',
          dot: 'bg-amber-400 shadow-xs shadow-amber-400',
          label: 'ALERTA',
        };
      case 'info':
      default:
        return {
          bg: 'bg-sky-500/15 border-sky-400/35 text-sky-200',
          dot: 'bg-sky-400 shadow-xs shadow-sky-400',
          label: 'COMUNICADO',
        };
    }
  };

  return (
    <>
      <div 
        id="widget-mural-avisos"
        className="bg-gradient-to-br from-white/[0.13] via-white/[0.08] to-white/[0.04] backdrop-blur-xl border border-white/20 hover:border-white/30 rounded-2xl p-4 sm:p-4.5 w-full shadow-xl shadow-[#0B1736]/40 flex flex-col justify-between gap-3 text-white transition-all select-none min-h-[165px] relative overflow-visible group"
        role="region"
        aria-label="Mural de Avisos Internos em Tempo Real"
      >
        {/* Camada decorativa interior delimitada */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/5 rounded-full blur-2xl group-hover:bg-amber-400/10 transition-colors" />
        </div>

        {currentAviso ? (
          <>
            {/* LINHA 1: Topo Descongestionado - Badge Luminosa + Navegação Minimalista */}
            <div className="flex items-center justify-between gap-2 w-full relative z-10">
              {/* Badge de tipo com radar pulsante */}
              {(() => {
                const b = getBadgeStyle(currentAviso.tipo);
                return (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold font-mono tracking-wider shadow-xs backdrop-blur-md shrink-0 ${b.bg}`}>
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${b.dot} opacity-75`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${b.dot}`}></span>
                    </span>
                    <span>{b.label}</span>
                  </span>
                );
              })()}

              {/* Controles de Navegação e Contador de Avisos */}
              <div className="flex items-center gap-1.5 shrink-0">
                {avisos.length > 1 && (
                  <div className="inline-flex items-center bg-black/40 hover:bg-black/50 backdrop-blur-md rounded-lg p-0.5 border border-white/15 text-[11px] font-mono shadow-xs transition-colors">
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
                      title="Aviso anterior"
                      aria-label="Anterior"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 text-white/95 font-bold tracking-tight select-none">
                      {currentIndex + 1}/{avisos.length}
                    </span>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
                      title="Próximo aviso"
                      aria-label="Próximo"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* LINHA 2: Conteúdo Central - Título em Destaque e Mensagem com Alto Contraste */}
            <div className="space-y-1.5 my-auto relative z-10">
              <h4 className="font-extrabold text-sm sm:text-[15px] text-white tracking-tight leading-snug line-clamp-1 drop-shadow-xs">
                {currentAviso.titulo}
              </h4>
              <p className="text-xs text-blue-100/90 leading-relaxed line-clamp-2 font-normal">
                {currentAviso.mensagem}
              </p>
            </div>

            {/* LINHA 3: Rodapé Refinado com Data/Autor e Botão Executivo "Novo" */}
            <div className="flex items-center justify-between gap-2 text-[11px] text-blue-200/85 pt-2.5 border-t border-white/15 w-full relative z-10">
              {/* Esquerda: Data e Autor */}
              <div className="flex items-center space-x-2 min-w-0">
                <div className="flex items-center space-x-1 font-mono text-[11px] shrink-0 text-amber-200/90">
                  <Clock className="w-3.5 h-3.5 text-[#DFB76C]" />
                  <span>{formatDate(currentAviso.created_at)}</span>
                </div>

                <div className="hidden sm:flex items-center space-x-1 truncate max-w-[120px] text-blue-200/80" title={currentAviso.autor_nome}>
                  <span className="text-white/40">·</span>
                  <User className="w-3 h-3 text-blue-300 shrink-0" />
                  <span className="truncate">{currentAviso.autor_nome}</span>
                </div>
              </div>

              {/* Direita: BOTÃO EXECUTIVO "NOVO" COM TODAS AS OPÇÕES */}
              {userIsAdmin && (
                <div className="relative shrink-0" ref={menuRef}>
                  <div className="inline-flex items-stretch rounded-lg shadow-sm hover:shadow-md transition-all overflow-hidden border border-[#E5C378]/40 bg-gradient-to-b from-[#ECD292] via-[#DFB76C] to-[#C99C42] text-slate-950 group">
                    {/* Botão Principal: Abre o modal de Novo/Gerenciamento completo */}
                    <button
                      type="button"
                      onClick={handleOpenNewModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold hover:bg-white/20 active:bg-black/5 transition-colors cursor-pointer tracking-tight"
                      title="Publicar ou gerenciar comunicados"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Novo</span>
                    </button>

                    <div className="w-[1px] bg-slate-950/20" />

                    {/* Seta Dropdown: Abre menu suspenso de ações */}
                    <button
                      type="button"
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="px-2 py-1.5 hover:bg-white/20 active:bg-black/5 transition-colors cursor-pointer flex items-center justify-center text-slate-950"
                      title="Opções do comunicado (Editar, Excluir, Novo)"
                      aria-label="Opções de comunicado"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Menu Popover com Todas as Opções Reunidas (Com contraste impecável e sem corte) */}
                  {isMenuOpen && (
                    <div 
                      className="absolute right-0 bottom-full mb-2 w-64 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl py-1.5 text-white z-50 animate-in fade-in zoom-in-95 duration-150 text-xs font-medium backdrop-blur-xl ring-1 ring-black/40"
                      role="menu"
                    >
                      {/* Opção 1: Novo Comunicado */}
                      <button
                        type="button"
                        onClick={handleOpenNewModal}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800/80 flex items-center space-x-2.5 transition-colors cursor-pointer text-white font-bold"
                        role="menuitem"
                      >
                        <Plus className="w-4 h-4 text-[#DFB76C] stroke-[2.5]" />
                        <span>+ Publicar Novo Comunicado</span>
                      </button>

                      {/* Opção 2: Editar Este Comunicado */}
                      <button
                        type="button"
                        onClick={handleOpenEditCurrent}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800/80 flex items-center space-x-2.5 transition-colors cursor-pointer text-slate-200"
                        role="menuitem"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Editar Comunicado Atual</span>
                      </button>

                      {/* Opção 3: Excluir com Senha */}
                      <button
                        type="button"
                        onClick={handleOpenDeleteCurrent}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-rose-950/40 text-rose-300 flex items-center space-x-2.5 transition-colors cursor-pointer border-t border-slate-800/80"
                        role="menuitem"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Excluir Publicação (com senha)</span>
                      </button>

                      {/* Opção 4: Ver Todas as Publicações */}
                      <button
                        type="button"
                        onClick={handleOpenManageList}
                        className="w-full px-3.5 py-2 text-left hover:bg-slate-800/80 flex items-center space-x-2.5 transition-colors cursor-pointer text-slate-400 border-t border-slate-800/80 text-[11px]"
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
          <div className="flex flex-col items-center justify-center text-center p-3 my-auto space-y-2 relative z-10">
            <BellRing className="w-6 h-6 text-blue-200/50" />
            <p className="text-xs text-blue-100/70">Nenhum comunicado ativo no momento.</p>
            {userIsAdmin && (
              <button
                type="button"
                onClick={handleOpenNewModal}
                className="mt-1 px-3.5 py-1.5 bg-gradient-to-r from-[#DFB76C] to-[#CE9E3C] hover:brightness-105 text-slate-950 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
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
