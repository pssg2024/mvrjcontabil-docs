import React, { useState, useMemo, useEffect } from 'react';
import { 
  Folder as FolderIcon, 
  FolderPlus, 
  UploadCloud, 
  FileText, 
  Image as ImageIcon, 
  Search, 
  Filter, 
  ChevronRight, 
  Home, 
  Eye, 
  Download, 
  Trash2, 
  Edit2,
  Tag, 
  Calendar, 
  User, 
  Sparkles, 
  HardDrive, 
  Grid, 
  List, 
  ShieldCheck, 
  Lock, 
  ArrowUpDown, 
  FileSpreadsheet, 
  AlertOctagon, 
  Phone, 
  KeyRound, 
  FileCode, 
  FileArchive, 
  File as FileGenericIcon, 
  AlertTriangle, 
  FileUp, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  Bell, 
  Clock, 
  XCircle, 
  CheckCircle2, 
  Check, 
  RefreshCw, 
  Files,
  Building2,
  X
} from 'lucide-react';
import { Folder, DocumentFile, Sector, UserProfile, PermissionLevel, StorageMetrics } from '../types';
import { formatBytes } from '../lib/optimization';
import { getPresignedDownloadUrl } from '../lib/storage-service';
import { StorageStatsWidget } from './StorageStatsCard';
import { StorageLimitModal } from './StorageLimitModal';

interface FileManagerProps {
  currentUser: UserProfile;
  folders: Folder[];
  files: DocumentFile[];
  storageMetrics?: StorageMetrics | null;
  onRefreshStorage?: () => void;
  onOpenFileViewer: (file: DocumentFile) => void;
  onOpenUploadModal: (targetFolderId?: string | null) => void;
  onCreateFolder: (name: string, parentId: string | null, sector: Sector) => Promise<any> | void;
  onDeleteFolder?: (folderId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onRenameFile?: (fileId: string, newName: string) => void;
  hasFolderPermission: (folderId: string, minLevel: PermissionLevel) => boolean;
  onOpenCompanyModal?: (initialQuery?: string) => void;
  externalSearchQuery?: string;
  onClearExternalSearch?: () => void;
}

export const FileManager: React.FC<FileManagerProps> = ({
  currentUser,
  folders,
  files,
  storageMetrics,
  onRefreshStorage,
  onOpenFileViewer,
  onOpenUploadModal,
  onCreateFolder,
  onDeleteFolder,
  onDeleteFile,
  onRenameFile,
  hasFolderPermission,
  onOpenCompanyModal,
  externalSearchQuery,
  onClearExternalSearch,
}) => {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<Sector | 'ALL'>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState(externalSearchQuery || '');
  
  const [renamingFile, setRenamingFile] = useState<DocumentFile | null>(null);
  const [newNameInput, setNewNameInput] = useState('');

  useEffect(() => {
    if (externalSearchQuery !== undefined) {
      setSearchQuery(externalSearchQuery);
    }
  }, [externalSearchQuery]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Breadcrumbs calculation
  const getBreadcrumbs = (): Folder[] => {
    if (!currentFolderId) return [];
    const trail: Folder[] = [];
    let curr = folders.find(f => f.id === currentFolderId);
    while (curr) {
      trail.unshift(curr);
      curr = curr.parent_id ? folders.find(f => f.id === curr!.parent_id) : undefined;
    }
    return trail;
  };

  const breadcrumbs = getBreadcrumbs();
  const currentFolder = currentFolderId ? folders.find(f => f.id === currentFolderId) || null : null;

  // Filter folders: direct children or search results across drive
  const visibleFolders = folders.filter(folder => {
    if (searchQuery.trim()) {
      const matchesSearch = folder.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      if (!matchesSearch) return false;
      if (selectedSector !== 'ALL' && folder.sector !== selectedSector) return false;
      return hasFolderPermission(folder.id, 'viewer');
    }
    const isDirectChild = currentFolderId 
      ? folder.parent_id === currentFolderId 
      : (!folder.parent_id || folder.parent_id === null || folder.parent_id === '');
    if (!isDirectChild) return false;
    if (selectedSector !== 'ALL' && folder.sector !== selectedSector) return false;
    // RLS Permission check: User must have at least 'viewer' permission on the folder
    return hasFolderPermission(folder.id, 'viewer');
  });

  // Filter files: direct children or search results across drive
  const visibleFiles = files.filter(file => {
    const matchesSearch = searchQuery
      ? file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (file.uploader_name && file.uploader_name.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;

    // Filter by competence if provided (assuming tags contain competence, e.g., 'Ref: 08/2026')
    const matchesCompetence = (selectedMonth === 'ALL' || file.tags.some(t => t.includes(selectedMonth))) &&
                              (selectedYear === 'ALL' || file.tags.some(t => t.includes(selectedYear)));

    // When inside a specific folder, files of that folder are shown directly; on root/global search, respect selected sector filter
    const matchesSector = currentFolderId 
      ? true 
      : (selectedSector === 'ALL' || file.sector === selectedSector);
    if (!matchesSector) return false;

    const hasPerm = file.folder_id ? hasFolderPermission(file.folder_id, 'viewer') : true;
    if (!hasPerm) return false;

    if (searchQuery) {
      // Global search returns matching files the user has permission to see
      return matchesSearch && matchesCompetence && (selectedSector === 'ALL' || file.sector === selectedSector);
    }

    // In regular navigation, show files in current folder strictly
    const isInCurrentFolder = currentFolderId 
      ? (file.folder_id === currentFolderId || String(file.folder_id).toLowerCase() === String(currentFolderId).toLowerCase())
      : (!file.folder_id || file.folder_id === null || file.folder_id === '' || file.folder_id === 'root' || file.folder_id === 'fold-fisc-root');
    if (!isInCurrentFolder) return false;
    return matchesSearch && matchesCompetence;
  });

  // Sorting
  const sortedFiles = [...visibleFiles].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'size') return b.optimized_size - a.optimized_size;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Storage & Document capacity metrics in real time
  const maxFilesCapacity = storageMetrics?.maxFilesCapacity || 10000;
  const currentFilesCount = files.length;
  const remainingFilesCount = Math.max(0, maxFilesCapacity - currentFilesCount);
  const documentsPercent = Number(((currentFilesCount / maxFilesCapacity) * 100).toFixed(1));

  const totalOriginalBytes = files.reduce((acc, f) => acc + (f.original_size || 0), 0);
  const totalOptimizedBytes = files.reduce((acc, f) => acc + (f.optimized_size || 0), 0);
  const totalSavedBytes = Math.max(0, totalOriginalBytes - totalOptimizedBytes);
  const overallSavingsPercent = totalOriginalBytes > 0 
    ? Math.round((totalSavedBytes / totalOriginalBytes) * 100) 
    : (storageMetrics?.savingsPercent || 81);

  // Quota calculation & strict lock (10 GB default)
  const totalQuotaBytes = storageMetrics?.totalCapacityBytes || (10 * 1024 * 1024 * 1024);
  const effectiveUsedBytes = storageMetrics?.usedBytes && storageMetrics.usedBytes > totalOptimizedBytes
    ? storageMetrics.usedBytes
    : totalOptimizedBytes;
  
  const remainingBytes = Math.max(0, totalQuotaBytes - effectiveUsedBytes);
  const usedPercentValue = totalQuotaBytes > 0 
    ? Number(((effectiveUsedBytes / totalQuotaBytes) * 100).toFixed(1)) 
    : 0;

  const isQuotaExceeded = effectiveUsedBytes >= totalQuotaBytes || (storageMetrics ? storageMetrics.usedPercent >= 100 : false) || currentFilesCount >= maxFilesCapacity;
  const [showBlockedLimitModal, setShowBlockedLimitModal] = useState(false);
  const [isRefreshingLocal, setIsRefreshingLocal] = useState(false);

  const handleRefreshClick = () => {
    if (isRefreshingLocal) return;
    setIsRefreshingLocal(true);
    if (onRefreshStorage) onRefreshStorage();
    setTimeout(() => setIsRefreshingLocal(false), 800);
  };

  // Permissions for current folder (Bloqueado se cota de armazenamento estourada)
  const isApprovedOrActive = currentUser.status === 'active' || currentUser.status === 'approved';
  const canUpload = isApprovedOrActive && !isQuotaExceeded && (currentFolderId ? hasFolderPermission(currentFolderId, 'editor') : (currentUser.role === 'admin' || currentUser.role === 'editor'));
  const canCreateSubfolder = isApprovedOrActive;

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || isSubmittingFolder) return;
    const sectorForFolder: Sector = currentFolder ? currentFolder.sector : (selectedSector !== 'ALL' ? selectedSector : (currentUser.sector || 'Fiscal'));
    
    setIsSubmittingFolder(true);
    try {
      await onCreateFolder(newFolderName.trim(), currentFolderId, sectorForFolder);
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch (err: any) {
      console.error('[ERRO CRIAR PASTA]', err);
      alert('Erro ao salvar pasta: ' + (err.message || 'Falha ao salvar pasta no banco de dados.'));
    } finally {
      setIsSubmittingFolder(false);
    }
  };

  const handleDirectDownload = async (file: DocumentFile) => {
    try {
      const res = await getPresignedDownloadUrl(file.storage_key, file.name);
      const a = document.createElement('a');
      a.href = res.downloadUrl;
      a.download = file.name;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      alert('Falha ao gerar URL de download seguro');
    }
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6 overflow-x-hidden">
      
      {/* Top Storage & Bandwidth Optimization Banner (Refinamento Executivo Enterprise) */}
      <div className="bg-gradient-to-br from-[#0B1528] via-[#102244] to-[#18356E] rounded-2xl sm:rounded-3xl p-5 sm:p-8 lg:p-10 shadow-2xl border border-white/10 relative overflow-hidden flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 lg:gap-8 text-white w-full max-w-full">
        {/* Efeito de profundidade: círculo de brilho radial dourado no fundo */}
        <div className="absolute -right-16 -top-16 w-72 h-72 bg-[#C59B4B]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Lado Esquerdo (Títulos e Descrição) */}
        <div className="relative z-10 space-y-0 w-full lg:max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[#C59B4B] text-xs font-semibold uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-[#C59B4B]" />
            <span>Drive Corporativo MVRJ Contábil</span>
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black text-white tracking-tight leading-tight mb-2">
            Gestão Eletrônica de Documentos Contábeis
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm lg:text-base max-w-xl font-normal leading-relaxed">
            Ambiente seguro para armazenamento, consulta e organização de arquivos fiscais, contábeis e departamentais.
          </p>
        </div>

        {/* Lado Direito (Card de Métricas / Armazenamento - Glassmorphism Refinado) */}
        <div className="relative z-10 w-full lg:w-72 shrink-0">
          <div className="bg-white/[0.08] backdrop-blur-xl border border-white/15 rounded-2xl p-4 sm:p-5 w-full shadow-xl flex flex-col gap-3.5 sm:gap-4">
            {/* Topo do Card */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-white/90 font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Documentos Ativos</span>
              </div>
              <span className="bg-[#C59B4B]/20 text-[#DFC17B] px-2 py-0.5 rounded-md font-bold text-[11px] border border-[#C59B4B]/30">
                {documentsPercent}%
              </span>
            </div>

            {/* Números Principais */}
            <div className="flex items-baseline">
              <strong className="text-3xl font-black text-white tracking-tight">
                {currentFilesCount.toLocaleString('pt-BR')}
              </strong>
              <span className="text-sm font-medium text-slate-400 ml-1">
                / {maxFilesCapacity.toLocaleString('pt-BR')}
              </span>
            </div>

            {/* Barra de Progresso */}
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden relative">
              <div 
                className="h-full bg-gradient-to-r from-[#C59B4B] to-[#F1D58A] rounded-full transition-all duration-500"
                style={{ width: `${Math.max(currentFilesCount > 0 ? 3 : 0, Math.min(100, documentsPercent))}%` }}
              />
            </div>

            {/* Rodapé do Card */}
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 uppercase tracking-wider pt-1">
              <span>Disponíveis: <strong className="text-white font-semibold normal-case text-xs">{remainingFilesCount.toLocaleString('pt-BR')}</strong></span>
              <span>Capacidade: <strong className="text-white font-semibold normal-case text-xs">{maxFilesCapacity >= 1000 ? `${(maxFilesCapacity / 1000).toFixed(0)}k` : maxFilesCapacity}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* CRITICAL WARNING BANNER: Limite de Armazenamento Atingido (Só aparece quando o limite for atingido) */}
      {isQuotaExceeded && (
        <div 
          id="storage-limit-alert-banner"
          className="bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-500/80 rounded-2xl p-4 sm:p-5 shadow-sm text-rose-950 dark:text-rose-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2 flex-wrap">
                <h3 className="font-extrabold text-sm sm:text-base text-rose-900 dark:text-rose-100">
                  Limite de Armazenamento Cloudflare R2 Atingido (100%)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white">
                  Gravação Bloqueada
                </span>
              </div>
              <p className="text-xs text-rose-800 dark:text-rose-200">
                A capacidade máxima ({formatBytes(totalQuotaBytes)}) foi atingida. Novos uploads foram suspensos. Para liberar espaço ou fazer upgrade da cota, entre em contato com o <strong>Administrador / Suporte de TI</strong>.
              </p>
            </div>
          </div>

          {/* Direct Support Actions */}
          <div className="flex items-center space-x-2.5 self-stretch md:self-auto shrink-0">
            <a
              href="https://wa.me/5521973960077?text=Ol%C3%A1%2C%20o%20limite%20de%20armazenamento%20do%20GED%20MVRJCONT%C3%81BIL%20foi%20atingido.%20Preciso%20de%20suporte."
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 md:flex-initial inline-flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Suporte TI: (21) 97396-0077</span>
            </a>
            <button
              onClick={() => setShowBlockedLimitModal(true)}
              className="px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
            >
              Detalhes
            </button>
          </div>
        </div>
      )}

      {isQuotaExceeded && (
        <StorageStatsWidget 
          files={files} 
          serverMetrics={storageMetrics} 
          onRefresh={onRefreshStorage}
        />
      )}

      {/* Control Toolbar (Search, Sector Pills, View toggle, Actions - Refinamento Executivo Enterprise) */}
      <div className="w-full max-w-full overflow-hidden p-3 sm:p-4 rounded-2xl bg-white/95 border border-slate-200/80 shadow-sm flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Instant Search Bar & CNPJ Company Lookup */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-2xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="search-docs-input"
                type="text"
                placeholder="Buscar por documento, CNPJ ou empresa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-9 text-sm focus:bg-white focus:border-[#C59B4B]/70 focus:ring-2 focus:ring-[#C59B4B]/20 outline-hidden transition-all shadow-2xs placeholder:text-slate-400 text-slate-800"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    if (onClearExternalSearch) onClearExternalSearch();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1.5 rounded-md cursor-pointer transition-colors"
                  title="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick CNPJ consultation button */}
            {onOpenCompanyModal && (
              <button
                id="lookup-company-btn"
                type="button"
                onClick={() => onOpenCompanyModal(searchQuery)}
                className="w-full sm:w-auto h-11 px-4 rounded-xl border border-slate-200 font-semibold text-xs flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 transition-all shadow-sm shrink-0 cursor-pointer group"
                title="Consultar Situação Cadastral de Empresa na Receita Federal (BrasilAPI)"
              >
                <Building2 className="w-4 h-4 text-[#C59B4B] group-hover:scale-110 transition-transform flex-shrink-0" />
                <span>Consultar CNPJ</span>
              </button>
            )}
          </div>

          {/* Action Buttons: New Folder, Upload & View Mode Toggle */}
          <div className="flex flex-row items-center gap-2 w-full lg:w-auto justify-between lg:justify-end shrink-0">
            {canCreateSubfolder && (
              <button
                id="create-folder-btn"
                onClick={() => setIsCreatingFolder(true)}
                className="flex-1 lg:flex-initial h-11 px-3 sm:px-4 rounded-xl border border-slate-200 bg-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm text-slate-700 hover:bg-slate-50 transition-all cursor-pointer group"
              >
                <FolderPlus className="w-4 h-4 text-[#1B357B] group-hover:scale-110 transition-transform flex-shrink-0" />
                <span className="whitespace-nowrap">Nova Pasta</span>
              </button>
            )}

            {isQuotaExceeded ? (
              <button
                id="upload-blocked-btn"
                onClick={() => setShowBlockedLimitModal(true)}
                className="flex-1 lg:flex-initial h-11 px-3 sm:px-4 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 border border-rose-300 dark:border-rose-800 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
                title="Limite de armazenamento 100% atingido. Clique para ver detalhes e suporte."
              >
                <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                <span className="whitespace-nowrap">Bloqueado</span>
              </button>
            ) : canUpload ? (
              <button
                id="upload-doc-btn"
                onClick={() => onOpenUploadModal(currentFolderId)}
                className="flex-1 lg:flex-initial h-11 px-3 sm:px-5 rounded-xl bg-gradient-to-r from-[#C59B4B] to-[#B38739] hover:brightness-105 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 text-white flex-shrink-0" />
                <span className="whitespace-nowrap sm:hidden">Upload</span>
                <span className="whitespace-nowrap hidden sm:inline">Upload de Documento</span>
              </button>
            ) : (
              <div className="flex-1 lg:flex-initial h-11 px-3 sm:px-4 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center gap-1.5" title="Apenas usuários com papel Editor ou Admin nesta pasta podem fazer upload.">
                <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="whitespace-nowrap sm:hidden">Bloqueado</span>
                <span className="whitespace-nowrap hidden sm:inline">Upload Bloqueado</span>
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl h-11 gap-1 flex-shrink-0 border border-slate-200/80 shadow-2xs">
              <button
                onClick={() => setViewMode('grid')}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-[#1B357B] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                title="Visualização em Grade"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-[#1B357B] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                title="Visualização em Lista"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Competence Selectors & Clear Filter */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
          {searchQuery && (
            <>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B357B]/10 text-[#1B357B] border border-[#1B357B]/25 text-xs font-semibold shrink-0">
                <Building2 className="w-3.5 h-3.5 text-[#C59B4B] flex-shrink-0" />
                <span className="truncate max-w-[160px] sm:max-w-xs">Filtro: {searchQuery}</span>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    if (onClearExternalSearch) onClearExternalSearch();
                  }}
                  className="p-0.5 hover:bg-[#1B357B]/20 rounded-md text-[#1B357B] cursor-pointer"
                  title="Remover filtro"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />
            </>
          )}

          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center space-x-1 shrink-0">
            <Filter className="w-3 h-3 flex-shrink-0" />
            <span>Filtro de Período:</span>
          </span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 focus:border-[#1B357B] focus:bg-white outline-hidden cursor-pointer"
          >
            <option value="ALL">Todos os Meses</option>
            {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 focus:border-[#1B357B] focus:bg-white outline-hidden cursor-pointer"
          >
            <option value="ALL">Todos os Anos</option>
            {['2024', '2025', '2026', '2027'].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          
          {/* Clear Filters Button */}
          {(selectedMonth !== 'ALL' || selectedYear !== 'ALL') && (
            <>
              <div className="h-4 w-px bg-slate-200 mx-1.5 hidden sm:block" />
              <button
                onClick={() => {
                  setSelectedMonth('ALL');
                  setSelectedYear('ALL');
                }}
                className="h-9 px-3 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-all cursor-pointer flex items-center"
              >
                Limpar Filtro
              </button>
            </>
          )}
        </div>
      </div>

      {/* Inline Create Folder Input */}
      {isCreatingFolder && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-150">
          <form onSubmit={handleCreateFolderSubmit} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center space-x-2 flex-1 w-full">
              <FolderPlus className="w-5 h-5 text-blue-600 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Nome da nova pasta (ex: Guias DARF 2026)..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>
            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <button
                type="submit"
                disabled={isSubmittingFolder}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex items-center space-x-1.5"
              >
                {isSubmittingFolder ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar Pasta</span>
                )}
              </button>
              <button
                type="button"
                disabled={isSubmittingFolder}
                onClick={() => setIsCreatingFolder(false)}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center space-x-2 text-xs font-medium text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/70 overflow-x-auto">
        <button
          onClick={() => setCurrentFolderId(null)}
          className={`flex items-center space-x-1.5 hover:text-[#1B357B] transition-colors cursor-pointer ${!currentFolderId ? 'font-bold text-[#112354]' : ''}`}
        >
          <Home className="w-4 h-4 text-[#1B357B]" />
          <span>Drive Raiz</span>
        </button>

        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.id}>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <button
              onClick={() => setCurrentFolderId(crumb.id)}
              className={`hover:text-[#1B357B] transition-colors whitespace-nowrap cursor-pointer ${idx === breadcrumbs.length - 1 ? 'font-bold text-slate-900' : ''}`}
            >
              {crumb.name}
            </button>
          </React.Fragment>
        ))}

        {searchQuery && (
          <span className="ml-auto text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 shrink-0">
            Filtro de busca: "{searchQuery}"
          </span>
        )}
      </nav>

      {/* FOLDERS SECTION */}
      {!searchQuery && visibleFolders.length > 0 && (
        <section className="space-y-3 w-full">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Pastas no Nível Atual</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
            {visibleFolders.map(folder => (
              <div
                key={folder.id}
                onClick={() => setCurrentFolderId(folder.id)}
                className="bg-white/95 backdrop-blur-sm rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md hover:border-[#C59B4B]/50 transition-all flex items-center justify-between group cursor-pointer min-w-0 overflow-hidden"
              >
                <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#1B357B] group-hover:bg-[#1B357B] group-hover:text-white transition-all flex items-center justify-center font-bold shrink-0">
                    <FolderIcon className="w-5 h-5" />
                  </div>
                  <div className="truncate flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-800 group-hover:text-[#1B357B] transition-colors truncate">
                      {folder.name}
                    </h4>
                    <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">{folder.sector}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0 ml-2">
                  {currentUser.role === 'admin' && onDeleteFolder && (
                    <button
                      type="button"
                      id={`btn-delete-folder-${folder.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFolder(folder.id);
                      }}
                      className="text-slate-300 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
                      title="Excluir Pasta (Admin)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#1B357B] transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FILES SECTION */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {searchQuery ? `Documentos Encontrados (${sortedFiles.length})` : `Arquivos na Pasta (${sortedFiles.length})`}
          </h3>
          
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent border-0 font-semibold text-slate-700 text-xs focus:ring-0 cursor-pointer"
            >
              <option value="date">Ordenar por Data</option>
              <option value="name">Ordenar por Nome</option>
              <option value="size">Ordenar por Tamanho</option>
            </select>
          </div>
        </div>

        {sortedFiles.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl border-2 border-dashed border-slate-200/90 p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#1B357B]/10 to-[#C59B4B]/15 flex items-center justify-center ring-8 ring-[#C59B4B]/5">
                <FileText className="w-8 h-8 text-[#1B357B]" />
              </div>
            </div>
            <div className="max-w-sm">
              <h4 className="text-base font-bold text-slate-800">Nenhum documento encontrado</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {currentFolderId 
                  ? 'Esta pasta ainda não possui arquivos armazenados.' 
                  : 'Nenhum arquivo na raiz. Selecione uma pasta acima ou faça o upload de um documento.'}
              </p>
            </div>
            {isQuotaExceeded ? (
              <button
                onClick={() => setShowBlockedLimitModal(true)}
                className="mt-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition-colors cursor-pointer shadow-sm"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>Upload Bloqueado (Limite de Quota Atingido)</span>
              </button>
            ) : canUpload ? (
              <button
                onClick={() => onOpenUploadModal(currentFolderId)}
                className="mt-2 bg-gradient-to-r from-[#C59B4B] to-[#B38739] hover:brightness-105 text-white font-bold shadow-md hover:shadow-lg rounded-xl px-5 py-2.5 inline-flex items-center gap-2 text-sm transition-all cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 text-white" />
                <span>Upload de Documento</span>
              </button>
            ) : null}
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
            {sortedFiles.map(file => {
              const lowerName = file.name.toLowerCase();
              const isPfx = file.mime_type.includes('pkcs12') || /\.(pfx|p12|cer|crt|key)$/i.test(lowerName);
              const isPdf = file.mime_type.includes('pdf') || /\.pdf$/i.test(lowerName);
              const isImage = file.mime_type.includes('image') || /\.(webp|png|jpe?g|gif|svg|bmp)$/i.test(lowerName);
              const isSpreadsheet = /\.(xlsx|xls|csv|ods)$/i.test(lowerName) || file.mime_type.includes('spreadsheet') || file.mime_type.includes('excel') || file.mime_type.includes('csv');
              const isXml = /\.(xml|nfe|cte|sped|ofx|rem|ret)$/i.test(lowerName) || file.mime_type.includes('xml');
              const isZip = /\.(zip|rar|7z|tar|gz)$/i.test(lowerName) || file.mime_type.includes('zip') || file.mime_type.includes('compressed');

              return (
                <div
                  key={file.id}
                  className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-[#C59B4B]/50 transition-all p-4 sm:p-5 flex flex-col justify-between group relative min-w-0 overflow-hidden"
                >
                  <div>
                    {/* Top Bar: File Icon & Status Badge */}
                    <div className="flex items-start justify-between">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        isPdf ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                        isImage ? 'bg-blue-50 text-[#1B357B] border border-blue-100' :
                        (isSpreadsheet || isXml) ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                        isPfx ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                        isZip ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-slate-50 text-slate-600 border border-slate-200/70'
                      }`}>
                        {isPdf ? <FileText className="w-5 h-5" /> :
                         isImage ? <ImageIcon className="w-5 h-5" /> :
                         isSpreadsheet ? <FileSpreadsheet className="w-5 h-5" /> :
                         isXml ? <FileCode className="w-5 h-5" /> :
                         isPfx ? <KeyRound className="w-5 h-5" /> :
                         isZip ? <FileArchive className="w-5 h-5" /> :
                         <FileGenericIcon className="w-5 h-5" />}
                      </div>

                      {isPfx ? (
                        <span className="bg-purple-50 text-purple-700 border border-purple-200/60 text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <KeyRound className="w-3 h-3 text-purple-600" />
                          <span>Certificado</span>
                        </span>
                      ) : file.compression_ratio > 0 ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>-{file.compression_ratio}% Otimizado</span>
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Íntegro</span>
                        </span>
                      )}
                    </div>

                    {/* File Title & Sector/Folder */}
                    <div className="min-w-0">
                      <h4 
                        onClick={() => onOpenFileViewer(file)}
                        className="text-sm font-bold text-slate-800 break-words line-clamp-2 group-hover:text-[#1B357B] transition-colors mt-3 cursor-pointer" 
                        title={file.name}
                      >
                        {file.name}
                      </h4>
                      <p className="text-xs text-slate-400 font-medium mb-3 flex items-center gap-1 min-w-0 truncate">
                        <FolderIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{file.sector}</span>
                        {file.pages_count && file.pages_count > 1 && (
                          <span className="text-slate-400 shrink-0">• {file.pages_count} págs</span>
                        )}
                        {file.tags && file.tags.find(t => t.startsWith('Ref: ')) && (
                          <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-medium ml-1 shrink-0">
                            {file.tags.find(t => t.startsWith('Ref: '))}
                          </span>
                        )}
                      </p>
                    </div>



                    {/* Size Pill */}
                    <div className="text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg w-fit mb-3">
                      {formatBytes(file.optimized_size || file.original_size)}
                    </div>

                    {/* Minimalist Tags */}
                    {file.tags && file.tags.filter(t => !t.startsWith('Ref: ')).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {file.tags.filter(t => !t.startsWith('Ref: ')).slice(0, 3).map(tag => (
                          <span key={tag} className="bg-slate-100 text-slate-600 border border-slate-200/70 text-[11px] font-medium px-2 py-0.5 rounded-md">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400">
                      {new Date(file.created_at).toLocaleDateString('pt-BR')}
                    </span>

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => onOpenFileViewer(file)}
                        className="p-2 rounded-lg text-slate-500 hover:text-[#1B357B] hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Visualizar documento"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const url = `https://wa.me/?text=${encodeURIComponent(`Olá! Segue o documento contábil solicitado referente aos serviços da MVRJ Contábil: ${file.name} - ${window.location.origin}/preview/${file.id}`)}`;
                          window.open(url, '_blank');
                        }}
                        className="p-2 rounded-lg text-slate-500 hover:text-[#1B357B] hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Enviar via WhatsApp"
                      >
                        <Phone className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDirectDownload(file)}
                        className="p-2 rounded-lg text-slate-500 hover:text-[#1B357B] hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Download seguro"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {(currentUser.role === 'admin' || currentUser.role === 'editor') && onRenameFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingFile(file);
                            setNewNameInput(file.name);
                          }}
                          className="p-2 rounded-lg text-slate-500 hover:text-[#1B357B] hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Renomear documento"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}

                      {currentUser.role === 'admin' && onDeleteFile && (
                        <button
                          type="button"
                          onClick={() => onDeleteFile(file.id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Excluir Arquivo (Admin)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                  <th className="p-3">Nome do Documento</th>
                  <th className="p-3">Setor</th>
                  <th className="p-3">Tamanho Original</th>
                  <th className="p-3">Tamanho Otimizado</th>
                  <th className="p-3">Economia R2</th>
                  <th className="p-3">Data de Envio</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedFiles.map(file => {
                  const lowerName = file.name.toLowerCase();
                  const isPfx = file.mime_type.includes('pkcs12') || /\.(pfx|p12|cer|crt|key)$/i.test(lowerName);
                  const isPdf = file.mime_type.includes('pdf') || /\.pdf$/i.test(lowerName);
                  const isImage = file.mime_type.includes('image') || /\.(webp|png|jpe?g|gif|svg|bmp)$/i.test(lowerName);
                  const isSpreadsheet = /\.(xlsx|xls|csv|ods)$/i.test(lowerName) || file.mime_type.includes('spreadsheet') || file.mime_type.includes('excel') || file.mime_type.includes('csv');
                  const isXml = /\.(xml|nfe|cte|sped|ofx|rem|ret)$/i.test(lowerName) || file.mime_type.includes('xml');
                  const isZip = /\.(zip|rar|7z|tar|gz)$/i.test(lowerName) || file.mime_type.includes('zip') || file.mime_type.includes('compressed');

                  return (
                    <tr key={file.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3 font-medium text-gray-900">
                        <div className="flex items-center space-x-2.5">
                          <div className={`p-1.5 rounded-lg text-white ${
                            isPfx ? 'bg-purple-600' :
                            isPdf ? 'bg-red-600' :
                            isImage ? 'bg-blue-600' :
                            isSpreadsheet ? 'bg-emerald-600' :
                            isXml ? 'bg-amber-600' :
                            isZip ? 'bg-teal-600' : 'bg-[#1B357B]'
                          }`}>
                            {isPfx ? <KeyRound className="w-3.5 h-3.5" /> :
                             isPdf ? <FileText className="w-3.5 h-3.5" /> :
                             isImage ? <ImageIcon className="w-3.5 h-3.5" /> :
                             isSpreadsheet ? <FileSpreadsheet className="w-3.5 h-3.5" /> :
                             isXml ? <FileCode className="w-3.5 h-3.5" /> :
                             isZip ? <FileArchive className="w-3.5 h-3.5" /> :
                             <FileGenericIcon className="w-3.5 h-3.5" />}
                          </div>
                          <span 
                            onClick={() => onOpenFileViewer(file)}
                            className="font-bold hover:text-blue-600 cursor-pointer truncate max-w-xs"
                          >
                            {file.name}
                          </span>
                          {isPfx && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                              PFX
                            </span>
                          )}
                          {isXml && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              XML
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-gray-600">{file.sector}</td>

                      <td className="p-3 font-mono text-gray-400 line-through">{formatBytes(file.original_size)}</td>
                      <td className="p-3 font-mono font-bold text-gray-800">{formatBytes(file.optimized_size)}</td>
                      <td className="p-3 font-bold text-emerald-600">
                        {file.compression_ratio > 0 ? `-${file.compression_ratio}%` : '100% Íntegro'}
                      </td>
                      <td className="p-3 text-gray-500">{new Date(file.created_at).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => onOpenFileViewer(file)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Visualizar"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDirectDownload(file)}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="Download Seguro"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {(currentUser.role === 'admin' || currentUser.role === 'editor') && onRenameFile && (
                            <button
                              onClick={() => {
                                setRenamingFile(file);
                                setNewNameInput(file.name);
                              }}
                              className="p-1.5 text-slate-500 hover:text-[#1B357B] hover:bg-slate-100 rounded-lg"
                              title="Renomear"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {currentUser.role === 'admin' && (
                            <button
                              onClick={() => onDeleteFile(file.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Storage Limit Exceeded Modal */}
      <StorageLimitModal
        isOpen={showBlockedLimitModal}
        onClose={() => setShowBlockedLimitModal(false)}
        usedBytes={effectiveUsedBytes}
        totalCapacityBytes={totalQuotaBytes}
      />

      {/* Rename File Modal */}
      {renamingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white w-[90%] max-w-md mx-auto rounded-2xl shadow-2xl border border-slate-200 p-5 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-slate-900 font-bold text-base mb-1">Renomear Documento</h3>
            <p className="text-slate-500 text-xs mb-4">Insira o novo nome para o documento abaixo.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nome Atual</label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-medium truncate">
                  {renamingFile.name}
                </div>
              </div>
              
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Novo Nome</label>
                <input
                  type="text"
                  value={newNameInput}
                  onChange={(e) => setNewNameInput(e.target.value)}
                  placeholder="Digite o novo nome..."
                  className="w-full h-10 px-3 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1B357B] focus:ring-1 focus:ring-[#1B357B]/20 outline-none transition-all font-medium"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const trimmed = newNameInput.trim();
                      if (trimmed && trimmed !== renamingFile.name && onRenameFile) {
                        onRenameFile(renamingFile.id, trimmed);
                      }
                      setRenamingFile(null);
                    }
                  }}
                />
              </div>
            </div>
            
            <div className="mt-5 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setRenamingFile(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const trimmed = newNameInput.trim();
                  if (trimmed && trimmed !== renamingFile.name && onRenameFile) {
                    onRenameFile(renamingFile.id, trimmed);
                  }
                  setRenamingFile(null);
                }}
                disabled={!newNameInput.trim() || newNameInput.trim() === renamingFile.name}
                className="px-4 py-2 bg-[#1B357B] hover:bg-[#C59B4B] disabled:opacity-50 disabled:hover:bg-[#1B357B] text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
