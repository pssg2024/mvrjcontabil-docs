import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  Search, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Folder, 
  FileText, 
  FileSpreadsheet, 
  Image as ImageIcon, 
  File, 
  ShieldAlert, 
  ShieldCheck, 
  Eye, 
  Filter, 
  RefreshCw,
  HardDrive,
  Info,
  Calendar,
  User,
  ArrowUpDown
} from 'lucide-react';
import { TrashItem, UserProfile, Sector } from '../types';
import { 
  fetchTrashItemsFromApi, 
  restoreTrashItemInApi, 
  restoreAllTrashInApi, 
  permanentDeleteTrashItemInApi, 
  emptyTrashInApi 
} from '../lib/storage-service';
import { motion, AnimatePresence } from 'motion/react';

interface RecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onItemRestored?: () => void;
  onPreviewFile?: (file: any) => void;
}

export const RecycleBinModal: React.FC<RecycleBinModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onItemRestored,
  onPreviewFile,
}) => {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'file' | 'folder'>('all');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Confirmation modals
  const [itemToPermanentDelete, setItemToPermanentDelete] = useState<TrashItem | null>(null);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [showRestoreAllConfirm, setShowRestoreAllConfirm] = useState(false);

  const isAdmin = Boolean(
    currentUser && (
      currentUser.role === 'admin' || 
      (currentUser.role as string) === 'ADMIN' || 
      (currentUser as any).role === 'Diretoria' ||
      currentUser.sector === 'Diretoria'
    )
  );

  const loadTrash = async () => {
    setIsLoading(true);
    setFeedbackMessage(null);
    try {
      const data = await fetchTrashItemsFromApi(currentUser?.role);
      setItems(data);
    } catch (err: any) {
      console.error('Erro ao carregar lixeira:', err);
      setFeedbackMessage({ type: 'error', text: 'Não foi possível carregar os itens da lixeira.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTrash();
    }
  }, [isOpen]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.original_folder_name && item.original_folder_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.deleted_by && item.deleted_by.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.tags && item.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())));

      const matchesType = selectedType === 'all' || item.type === selectedType;
      const matchesSector = selectedSector === 'all' || item.sector === selectedSector;

      return matchesSearch && matchesType && matchesSector;
    });
  }, [items, searchTerm, selectedType, selectedSector]);

  // Calculate totals
  const totalSize = useMemo(() => {
    return items.reduce((acc, curr) => acc + (curr.original_size || 0), 0);
  }, [items]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '--';
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return isoString;
    }
  };

  // Restore single item
  const handleRestoreItem = async (item: TrashItem) => {
    if (!isAdmin) {
      setFeedbackMessage({ 
        type: 'error', 
        text: 'Acesso restrito: Somente administradores têm autorização para restaurar itens da lixeira.' 
      });
      return;
    }

    setActionInProgressId(item.id);
    try {
      const res = await restoreTrashItemInApi(item.id, currentUser?.role, currentUser?.full_name);
      setFeedbackMessage({ type: 'success', text: `"${item.name}" foi restaurado com sucesso para o GED!` });
      await loadTrash();
      if (onItemRestored) onItemRestored();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao restaurar item.' });
    } finally {
      setActionInProgressId(null);
    }
  };

  // Restore all items
  const handleRestoreAll = async () => {
    if (!isAdmin) return;
    setIsBulkActionLoading(true);
    setShowRestoreAllConfirm(false);
    try {
      const res = await restoreAllTrashInApi(currentUser?.role, currentUser?.full_name);
      setFeedbackMessage({ type: 'success', text: `Todos os ${res.restored_count} itens foram restaurados com sucesso!` });
      await loadTrash();
      if (onItemRestored) onItemRestored();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao restaurar todos os itens.' });
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  // Permanent Delete Single Item
  const handleConfirmPermanentDelete = async () => {
    if (!itemToPermanentDelete || !isAdmin) return;
    setActionInProgressId(itemToPermanentDelete.id);
    const itemName = itemToPermanentDelete.name;
    setItemToPermanentDelete(null);

    try {
      await permanentDeleteTrashItemInApi(itemToPermanentDelete.id, currentUser?.role, currentUser?.full_name);
      setFeedbackMessage({ type: 'success', text: `"${itemName}" foi excluído permanentemente.` });
      await loadTrash();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao excluir permanentemente.' });
    } finally {
      setActionInProgressId(null);
    }
  };

  // Empty Entire Trash
  const handleConfirmEmptyTrash = async () => {
    if (!isAdmin) return;
    setIsBulkActionLoading(true);
    setShowEmptyConfirm(false);

    try {
      const res = await emptyTrashInApi(currentUser?.role, currentUser?.full_name);
      setFeedbackMessage({ type: 'success', text: `Lixeira esvaziada. ${res.deleted_count} itens foram excluídos permanentemente.` });
      await loadTrash();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao esvaziar lixeira.' });
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const getFileIcon = (item: TrashItem) => {
    if (item.type === 'folder') {
      return <Folder className="w-5 h-5 text-amber-400 shrink-0" />;
    }
    const mime = (item.mime_type || '').toLowerCase();
    const name = item.name.toLowerCase();

    if (mime.includes('pdf') || name.endsWith('.pdf')) {
      return <FileText className="w-5 h-5 text-rose-400 shrink-0" />;
    }
    if (mime.includes('sheet') || mime.includes('excel') || name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />;
    }
    if (mime.includes('image') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')) {
      return <ImageIcon className="w-5 h-5 text-sky-400 shrink-0" />;
    }
    return <File className="w-5 h-5 text-slate-400 shrink-0" />;
  };

  const getSectorBadgeColor = (sector: string) => {
    switch (sector) {
      case 'Fiscal':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      case 'Contábil':
        return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
      case 'Departamento Pessoal':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/20';
      case 'Financeiro':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      case 'Diretoria':
        return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-5xl bg-[#091124] border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Lixeira do GED • Backup de Segurança
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {items.length} {items.length === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Área de recuperação de documentos e pastas excluídos acidentalmente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadTrash}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
              title="Recarregar lixeira"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Security & Role Banner */}
        <div className={`px-4 sm:px-6 py-2.5 border-b text-xs flex items-center justify-between ${
          isAdmin 
            ? 'bg-blue-950/30 border-blue-900/40 text-blue-300' 
            : 'bg-amber-950/30 border-amber-900/40 text-amber-300'
        }`}>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>
              {isAdmin ? (
                <strong>Perfil Administrador:</strong>
              ) : (
                <strong>Acesso Restrito:</strong>
              )}{' '}
              {isAdmin 
                ? 'Você possui autorização para restaurar documentos ou excluí-los definitivamente.'
                : 'Apenas Administradores têm permissão para restaurar ou excluir permanentemente itens da lixeira.'
              }
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <HardDrive className="w-3.5 h-3.5" />
              <span>Espaço: {formatFileSize(totalSize)}</span>
            </div>
          </div>
        </div>

        {/* Feedback message banner */}
        {feedbackMessage && (
          <div className={`mx-4 sm:mx-6 mt-3 p-3 rounded-xl border flex items-center justify-between text-xs sm:text-sm animate-fadeIn ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-slate-400 hover:text-white ml-2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Filter and Action Bar */}
        <div className="p-4 sm:p-6 pb-3 space-y-3 shrink-0 bg-slate-900/30">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Pesquisar por nome do arquivo, pasta, setor ou usuário que excluiu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Bulk Admin Actions */}
            {isAdmin && items.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowRestoreAllConfirm(true)}
                  disabled={isBulkActionLoading}
                  className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  title="Restaurar todos os itens de volta ao GED"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar Todos</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowEmptyConfirm(true)}
                  disabled={isBulkActionLoading}
                  className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  title="Esvaziar lixeira permanentemente"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Esvaziar Lixeira</span>
                </button>
              </div>
            )}
          </div>

          {/* Type & Sector Filter Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">
              Filtros:
            </span>

            {/* Type Chips */}
            <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
              <button
                type="button"
                onClick={() => setSelectedType('all')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  selectedType === 'all' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('file')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  selectedType === 'file' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Arquivos ({items.filter(i => i.type === 'file').length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('folder')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  selectedType === 'folder' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pastas ({items.filter(i => i.type === 'folder').length})
              </button>
            </div>

            {/* Sector Selector */}
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-300 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="all">Todos os Setores</option>
              <option value="Fiscal">Fiscal</option>
              <option value="Contábil">Contábil</option>
              <option value="Departamento Pessoal">Departamento Pessoal</option>
              <option value="Financeiro">Financeiro</option>
              <option value="Diretoria">Diretoria</option>
              <option value="Geral">Geral</option>
            </select>
          </div>
        </div>

        {/* Content Table / List */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm">Carregando backup da lixeira...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-500 shadow-inner">
                <Trash2 className="w-8 h-8" strokeWidth={1.5} />
              </div>
              <div className="max-w-md">
                <h3 className="text-base font-semibold text-slate-200">
                  {items.length === 0 ? 'A lixeira está vazia' : 'Nenhum resultado com os filtros selecionados'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {items.length === 0 
                    ? 'Nenhum arquivo ou pasta foi excluído. Qualquer documento que for deletado no GED será protegido aqui para recuperação.'
                    : 'Tente alterar os termos de pesquisa ou selecionar outros setores.'
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {filteredItems.map((item) => {
                const isItemActionRunning = actionInProgressId === item.id;

                return (
                  <div
                    key={item.id}
                    className="p-3.5 bg-slate-900/60 hover:bg-slate-850/80 border border-slate-800/90 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors group"
                  >
                    {/* Item Information */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 shrink-0">
                        {getFileIcon(item)}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm text-slate-100 truncate group-hover:text-blue-300 transition-colors">
                            {item.name}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getSectorBadgeColor(item.sector)}`}>
                            {item.sector}
                          </span>
                          {item.type === 'folder' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              Pasta
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-400">
                          {item.original_folder_name && (
                            <span className="flex items-center gap-1 truncate max-w-xs" title={`Pasta de origem: ${item.original_folder_name}`}>
                              <Folder className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="truncate">Origem: {item.original_folder_name}</span>
                            </span>
                          )}

                          <span className="flex items-center gap-1" title="Data da exclusão">
                            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>{formatDate(item.deleted_at)}</span>
                          </span>

                          {item.deleted_by && (
                            <span className="flex items-center gap-1" title="Excluído por">
                              <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="truncate">{item.deleted_by}</span>
                            </span>
                          )}

                          {item.type === 'file' && item.original_size !== undefined && (
                            <span className="text-slate-500 font-mono text-[11px]">
                              {formatFileSize(item.original_size)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800 w-full sm:w-auto justify-end">
                      {/* Preview Button for files */}
                      {item.type === 'file' && onPreviewFile && (
                        <button
                          type="button"
                          onClick={() => onPreviewFile({
                            id: item.original_id,
                            name: item.name,
                            storage_key: item.storage_key,
                            mime_type: item.mime_type,
                            preview_url: item.preview_url,
                          })}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="Visualizar documento"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}

                      {/* Restore Button (Admin Only) */}
                      <button
                        type="button"
                        onClick={() => handleRestoreItem(item)}
                        disabled={!isAdmin || isItemActionRunning}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isAdmin 
                            ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 active:scale-95' 
                            : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                        }`}
                        title={isAdmin ? 'Restaurar para a pasta original no GED' : 'Apenas administradores podem restaurar'}
                      >
                        {isItemActionRunning ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        <span>Restaurar</span>
                      </button>

                      {/* Permanent Delete Button (Admin Only) */}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setItemToPermanentDelete(item)}
                          disabled={isItemActionRunning}
                          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Excluir permanentemente do servidor e R2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              Itens restaurados voltam imediatamente para a pasta de origem no GED sem qualquer perda de dados.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Fechar Lixeira
          </button>
        </div>
      </div>

      {/* Confirmation Modal: Delete Permanent Single Item */}
      {itemToPermanentDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-[#0b1329] border border-rose-500/40 rounded-2xl p-6 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Exclusão Definitiva</h3>
                <p className="text-xs text-slate-400">Esta ação é irreversível e permanente.</p>
              </div>
            </div>

            <p className="text-sm text-slate-300">
              Tem certeza que deseja apagar definitivamente <strong className="text-white">"{itemToPermanentDelete.name}"</strong>?
              O arquivo físico será excluído permanentemente do servidor e do Cloudflare R2 e não poderá mais ser recuperado.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setItemToPermanentDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPermanentDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-rose-950/40"
              >
                Excluir Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Empty Trash */}
      {showEmptyConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-[#0b1329] border border-rose-500/40 rounded-2xl p-6 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Esvaziar Toda a Lixeira?</h3>
                <p className="text-xs text-rose-400 font-medium">Atenção: Destruição permanente</p>
              </div>
            </div>

            <p className="text-sm text-slate-300">
              Todos os <strong className="text-white">{items.length} itens</strong> serão apagados em definitivo do Cloudflare R2 e do banco de dados. Nenhum desses documentos poderá ser recuperado após esta operação.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowEmptyConfirm(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmEmptyTrash}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-rose-950/40"
              >
                Esvaziar Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Restore All */}
      {showRestoreAllConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-[#0b1329] border border-emerald-500/40 rounded-2xl p-6 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Restaurar Todos os Documentos?</h3>
                <p className="text-xs text-emerald-400 font-medium">Restauração em lote para o GED</p>
              </div>
            </div>

            <p className="text-sm text-slate-300">
              Deseja restaurar todos os <strong className="text-white">{items.length} itens</strong> de volta para suas respectivas pastas no GED?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowRestoreAllConfirm(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRestoreAll}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-emerald-950/40"
              >
                Restaurar Todos os Itens
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
