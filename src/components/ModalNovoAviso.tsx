import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Send, 
  Megaphone, 
  AlertTriangle, 
  Info, 
  AlertCircle, 
  Loader2,
  Edit2,
  Trash2,
  Clock,
  User,
  Plus,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { AvisoItem, AvisoTipo, UserProfile } from '../types';
import { insertAviso, updateAviso, deleteAviso } from '../lib/avisos-service';
import { ModalConfirmarSenhaExclusao } from './ModalConfirmarSenhaExclusao';

interface ModalNovoAvisoProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  editingAviso?: AvisoItem | null;
  avisos?: AvisoItem[];
  initialTab?: 'novo' | 'gerenciar';
  onAvisoCreated?: (aviso: AvisoItem) => void;
  onAvisoUpdated?: (aviso: AvisoItem) => void;
  onAvisoDeleted?: (id: string) => void;
}

export const ModalNovoAviso: React.FC<ModalNovoAvisoProps> = ({
  isOpen,
  onClose,
  currentUser,
  editingAviso: initialEditingAviso,
  avisos = [],
  initialTab = 'novo',
  onAvisoCreated,
  onAvisoUpdated,
  onAvisoDeleted,
}) => {
  const [activeTab, setActiveTab] = useState<'novo' | 'gerenciar'>(initialTab);
  const [currentEditing, setCurrentEditing] = useState<AvisoItem | null>(initialEditingAviso || null);

  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [tipo, setTipo] = useState<AvisoTipo>('info');
  const [autorNome, setAutorNome] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Exclusão protegida por senha
  const [targetDeleteAviso, setTargetDeleteAviso] = useState<AvisoItem | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Inicializar campos ao abrir
  useEffect(() => {
    if (isOpen) {
      if (initialEditingAviso) {
        setCurrentEditing(initialEditingAviso);
        setActiveTab('novo');
        setTitulo(initialEditingAviso.titulo || '');
        setMensagem(initialEditingAviso.mensagem || '');
        setTipo(initialEditingAviso.tipo || 'info');
        setAutorNome(initialEditingAviso.autor_nome || currentUser.full_name || 'Administração');
      } else {
        setCurrentEditing(null);
        setActiveTab(initialTab);
        setTitulo('');
        setMensagem('');
        setTipo('info');
        setAutorNome(currentUser.full_name || 'Administração MVRJ');
      }
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialEditingAviso, initialTab, currentUser]);

  // Atualizar campos ao selecionar outro comunicado para editar
  const handleSelectToEdit = (aviso: AvisoItem) => {
    setCurrentEditing(aviso);
    setTitulo(aviso.titulo);
    setMensagem(aviso.mensagem);
    setTipo(aviso.tipo);
    setAutorNome(aviso.autor_nome);
    setActiveTab('novo');
    setErrorMsg(null);
  };

  const handleStartNew = () => {
    setCurrentEditing(null);
    setTitulo('');
    setMensagem('');
    setTipo('info');
    setAutorNome(currentUser.full_name || 'Administração MVRJ');
    setActiveTab('novo');
    setErrorMsg(null);
  };

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

  // Fechar com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting && !isPasswordModalOpen) onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isSubmitting, isPasswordModalOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      setErrorMsg('Por favor, informe o título do comunicado.');
      return;
    }
    if (!mensagem.trim()) {
      setErrorMsg('Por favor, digite o conteúdo da mensagem.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      if (currentEditing) {
        // Atualizar comunicado existente
        const updated = await updateAviso(currentEditing.id, {
          titulo: titulo.trim(),
          mensagem: mensagem.trim(),
          tipo,
          autor_nome: autorNome.trim() || currentUser.full_name || 'Administração',
        });

        if (updated && onAvisoUpdated) {
          onAvisoUpdated(updated);
        }
        setSuccessMsg('Comunicado atualizado com sucesso em tempo real!');
      } else {
        // Criar novo comunicado
        const created = await insertAviso({
          titulo: titulo.trim(),
          mensagem: mensagem.trim(),
          tipo,
          autor_nome: autorNome.trim() || currentUser.full_name || 'Administração',
          ativo: true,
        });

        if (created && onAvisoCreated) {
          onAvisoCreated(created);
        }
        setSuccessMsg('Comunicado publicado com sucesso em tempo real!');
      }

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Erro ao salvar comunicado:', err);
      setErrorMsg('Falha ao salvar comunicado. Verifique a conexão e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestDelete = (aviso: AvisoItem) => {
    setTargetDeleteAviso(aviso);
    setIsPasswordModalOpen(true);
  };

  const handleExecuteDelete = async () => {
    if (!targetDeleteAviso) return;

    const id = targetDeleteAviso.id;
    await deleteAviso(id);
    if (onAvisoDeleted) {
      onAvisoDeleted(id);
    }
    if (currentEditing?.id === id) {
      handleStartNew();
    }
    setTargetDeleteAviso(null);
    setIsPasswordModalOpen(false);
    setSuccessMsg('Publicação excluída com sucesso após autenticação!');
    setTimeout(() => setSuccessMsg(null), 3000);
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

  const getBadgeStyle = (t: string) => {
    switch (t) {
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
        aria-labelledby="modal-novo-aviso-title"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isSubmitting && !isPasswordModalOpen) onClose();
        }}
        onTouchMove={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
          }
        }}
      >
        <div 
          className="relative w-full max-w-xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 overscroll-contain animate-in zoom-in-95 duration-200 select-text"
          onClick={(e) => e.stopPropagation()}
        >
          
          {/* Cabeçalho Fixo */}
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-950/60 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-[#1B357B] text-white flex items-center justify-center shadow-xs shrink-0">
                {currentEditing ? (
                  <Edit2 className="w-4 h-4 text-[#DFB76C]" />
                ) : (
                  <Megaphone className="w-4 h-4 text-[#DFB76C]" />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 id="modal-novo-aviso-title" className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                    {currentEditing ? 'Editar Comunicado Interno' : 'Gerenciamento de Comunicados'}
                  </h3>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-[10px] font-bold border border-blue-200 dark:border-blue-800">
                    <ShieldCheck className="w-3 h-3 text-[#DFB76C]" />
                    <span>Admin</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Publique, edite ou exclua avisos em tempo real para toda a equipe
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Abas Unificadas: Todas as opções reunidas dentro de Novo */}
          <div className="px-5 pt-3 pb-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-2">
            <div className="flex items-center space-x-1 sm:space-x-2">
              <button
                type="button"
                onClick={handleStartNew}
                className={`px-3 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'novo' && !currentEditing
                    ? 'border-[#1B357B] text-[#1B357B] dark:border-[#DFB76C] dark:text-[#DFB76C] bg-slate-50 dark:bg-slate-800/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Novo Comunicado</span>
              </button>

              {currentEditing && (
                <button
                  type="button"
                  onClick={() => setActiveTab('novo')}
                  className="px-3 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 flex items-center space-x-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Editando Publicação</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('gerenciar')}
                className={`px-3 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'gerenciar'
                    ? 'border-[#1B357B] text-[#1B357B] dark:border-[#DFB76C] dark:text-[#DFB76C] bg-slate-50 dark:bg-slate-800/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Editar / Excluir ({avisos.length})</span>
              </button>
            </div>
          </div>

          {/* Feedback de Sucesso */}
          {successMsg && (
            <div className="mx-5 mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center space-x-2 animate-in fade-in shrink-0">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ABA 1: FORMULÁRIO DE NOVO / EDITAR */}
          {activeTab === 'novo' && (
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Nível de Importância / Tipo */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Nível de Importância
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipo('info')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer border ${
                      tipo === 'info'
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Informativo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipo('alerta')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer border ${
                      tipo === 'alerta'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Alerta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipo('urgente')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer border ${
                      tipo === 'urgente'
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Urgente</span>
                  </button>
                </div>
              </div>

              {/* Título */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Título do Comunicado <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex: Fechamento Fiscal Mensal ou Feriado Municipal..."
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#1B357B] transition-all"
                />
              </div>

              {/* Mensagem */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Mensagem <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Detalhes, prazos e orientações para a equipe ou clientes..."
                  className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#1B357B] transition-all resize-none leading-relaxed"
                />
              </div>

              {/* Autor */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Identificação do Autor / Departamento
                </label>
                <input
                  type="text"
                  value={autorNome}
                  onChange={(e) => setAutorNome(e.target.value)}
                  placeholder="Ex: Diretoria, Setor Fiscal ou seu nome..."
                  className="w-full h-9 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#1B357B] transition-all"
                />
              </div>

              {/* Rodapé com botões */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 shrink-0">
                {currentEditing ? (
                  <button
                    type="button"
                    onClick={handleStartNew}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
                  >
                    Cancelar edição e criar novo
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-[#1B357B] hover:bg-[#14285d] text-white text-xs font-bold shadow-xs flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : currentEditing ? (
                      <>
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Salvar Alterações</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Publicar em Tempo Real</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ABA 2: EDITAR / EXCLUIR PUBLICAÇÕES EXISTENTES */}
          {activeTab === 'gerenciar' && (
            <div className="p-5 space-y-3 overflow-y-auto overscroll-contain flex-1">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                <span>Clique em <strong>Editar</strong> para modificar ou em <strong>Excluir</strong> para apagar com senha.</span>
                <button
                  type="button"
                  onClick={handleStartNew}
                  className="text-blue-600 dark:text-[#DFB76C] font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Novo</span>
                </button>
              </div>

              {avisos.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <p className="text-xs text-slate-500">Nenhum comunicado publicado no momento.</p>
                  <button
                    type="button"
                    onClick={handleStartNew}
                    className="px-3 py-1.5 rounded-lg bg-[#1B357B] text-white text-xs font-bold hover:bg-[#14285d] cursor-pointer"
                  >
                    + Criar Primeiro Comunicado
                  </button>
                </div>
              ) : (
                avisos.map((aviso) => {
                  const b = getBadgeStyle(aviso.tipo);

                  return (
                    <div
                      key={aviso.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                        currentEditing?.id === aviso.id
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 hover:border-slate-300'
                      }`}
                    >
                      {/* Conteúdo */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold font-mono tracking-wider ${b.bg}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${b.dot}`}></span>
                            <span>{b.label}</span>
                          </span>

                          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#DFB76C]" />
                            <span>{formatDate(aviso.created_at)}</span>
                          </span>
                        </div>

                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug">
                          {aviso.titulo}
                        </h4>

                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {aviso.mensagem}
                        </p>

                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-0.5">
                          <User className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span>Autor: <strong className="font-semibold text-slate-700 dark:text-slate-300">{aviso.autor_nome}</strong></span>
                        </div>
                      </div>

                      {/* Botões Editar / Excluir */}
                      <div className="sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectToEdit(aviso)}
                          className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer shadow-2xs"
                          title="Editar este comunicado"
                        >
                          <Edit2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRequestDelete(aviso)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer"
                          title="Excluir comunicado (requer senha)"
                        >
                          <Trash2 className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>
      </div>

      {/* Modal de Senha para Autorização de Exclusão */}
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
