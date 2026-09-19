import React, { useState, useMemo } from 'react';
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
  Check
} from 'lucide-react';
import { Folder, DocumentFile, Sector, UserProfile, PermissionLevel, StorageMetrics } from '../types';
import { formatBytes } from '../lib/optimization';
import { getPresignedDownloadUrl } from '../lib/storage-service';
import { getDueDateInfo } from '../lib/due-date-utils';
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
  onCreateFolder: (name: string, parentId: string | null, sector: Sector) => void;
  onDeleteFolder?: (folderId: string) => void;
  onDeleteFile: (fileId: string) => void;
  hasFolderPermission: (folderId: string, minLevel: PermissionLevel) => boolean;
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
  hasFolderPermission,
}) => {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<Sector | 'ALL'>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
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

  // Filter folders: only direct children of current folder & sector filter
  const visibleFolders = folders.filter(folder => {
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

    const matchesSector = selectedSector === 'ALL' || file.sector === selectedSector;
    if (!matchesSector) return false;

    const hasPerm = file.folder_id ? hasFolderPermission(file.folder_id, 'viewer') : true;
    if (!hasPerm) return false;

    if (searchQuery) {
      // Global search returns matching files the user has permission to see
      return matchesSearch && matchesCompetence;
    }

    // In regular navigation, show files in current folder strictly
    const isInCurrentFolder = currentFolderId 
      ? file.folder_id === currentFolderId 
      : (!file.folder_id || file.folder_id === null || file.folder_id === 'root');
    if (!isInCurrentFolder) return false;
    return matchesSearch && matchesCompetence;
  });

  // Sorting
  const sortedFiles = [...visibleFiles].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'size') return b.optimized_size - a.optimized_size;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Storage metrics
  const totalOriginalBytes = files.reduce((acc, f) => acc + f.original_size, 0);
  const totalOptimizedBytes = files.reduce((acc, f) => acc + f.optimized_size, 0);
  const totalSavedBytes = Math.max(0, totalOriginalBytes - totalOptimizedBytes);
  const overallSavingsPercent = totalOriginalBytes > 0 ? Math.round((totalSavedBytes / totalOriginalBytes) * 100) : 0;

  // Quota calculation & strict lock
  const totalQuotaBytes = storageMetrics?.totalCapacityBytes || (10 * 1024 * 1024 * 1024);
  
  // File capacity metrics in real time - Favoring local state for immediate feedback on deletions
  const currentFilesCount = files.length > 0 ? files.length : (storageMetrics?.filesCount || 0);
  const effectiveUsedBytes = totalOptimizedBytes > 0 ? totalOptimizedBytes : (storageMetrics?.usedBytes || 0);

  const isQuotaExceeded = effectiveUsedBytes >= totalQuotaBytes || (storageMetrics ? storageMetrics.usedPercent >= 100 : false);
  const [showBlockedLimitModal, setShowBlockedLimitModal] = useState(false);
  
  const usedPercentValue = totalQuotaBytes > 0 
    ? Number(((effectiveUsedBytes / totalQuotaBytes) * 100).toFixed(2)) 
    : 0;
  const remainingBytes = Math.max(0, totalQuotaBytes - effectiveUsedBytes);

  // Permissions for current folder (Bloqueado se cota de armazenamento estourada)
  const isApprovedOrActive = currentUser.status === 'active' || currentUser.status === 'approved';
  const canUpload = isApprovedOrActive && !isQuotaExceeded && (currentFolderId ? hasFolderPermission(currentFolderId, 'editor') : (currentUser.role === 'admin' || currentUser.role === 'editor'));
  const canCreateSubfolder = isApprovedOrActive && (currentFolderId ? hasFolderPermission(currentFolderId, 'editor') : currentUser.role === 'admin');

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const sectorForFolder: Sector = currentFolder ? currentFolder.sector : (selectedSector !== 'ALL' ? selectedSector : currentUser.sector);
    onCreateFolder(newFolderName.trim(), currentFolderId, sectorForFolder);
    setNewFolderName('');
    setIsCreatingFolder(false);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Top Storage & Bandwidth Optimization Banner */}
      <div className="bg-gradient-to-r from-[#112354] via-[#1B357B] to-[#112354] rounded-2xl p-6 sm:p-7 text-white shadow-md relative overflow-hidden border border-[#C59B4B]/30">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center space-x-2">
              <span className="px-3.5 py-1 rounded-full bg-[#1B357B]/60 text-[#E2B963] border border-[#C59B4B]/40 text-[11px] font-semibold tracking-wide shadow-xs">
                DRIVE CORPORATIVO MVRJCONTÁBIL
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              Gestão Eletrônica de Documentos Contábeis
            </h2>
            <p className="text-sm text-slate-200/90 leading-relaxed">
              Ambiente seguro para armazenamento, consulta e organização de arquivos fiscais, contábeis e departamentais.
            </p>
          </div>

          {/* Clean & Minimalist Metrics Cards */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 shrink-0">
            {/* Card 1 - Total de Arquivos / Capacidade */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-3 border border-[#C59B4B]/30 shadow-xs min-w-[200px] sm:min-w-[220px]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-medium text-slate-200 tracking-wide block">
                  Documentos
                </span>
                <span className="text-[10px] text-[#E2B963] font-semibold">
                  {Math.min(100, Number(((currentFilesCount / 10000) * 100).toFixed(2)))}% usado
                </span>
              </div>
              <strong className="text-2xl sm:text-3xl font-black text-white tracking-tight block mt-0.5">
                {currentFilesCount.toLocaleString('pt-BR')} / 10.000
              </strong>
              <div className="flex items-center justify-between text-[10px] text-slate-300 font-medium mt-1">
                <span className="text-[#E2B963]">{(10000 - currentFilesCount).toLocaleString('pt-BR')} disponíveis</span>
                <span>Limite: 10k</span>
              </div>
              {/* Barra de progresso com gradiente dourado da marca */}
              <div className="w-full bg-white/15 h-1.5 rounded-full overflow-hidden mt-2">
                <div 
                  className="bg-gradient-to-r from-[#C59B4B] to-[#E2B963] h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.max(currentFilesCount > 0 ? 2 : 0, Math.min(100, (currentFilesCount / 10000) * 100))}%` }}
                />
              </div>
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

      {/* Control Toolbar (Search, Sector Pills, View toggle, Actions) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Instant Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              id="search-docs-input"
              type="text"
              placeholder="Buscar por nome de documento, tags ou setor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all"
            />
          </div>

          {/* Action Buttons: New Folder & Upload */}
          <div className="flex items-center space-x-2 shrink-0">
            {canCreateSubfolder && (
              <button
                id="create-folder-btn"
                onClick={() => setIsCreatingFolder(true)}
                className="px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-xl flex items-center space-x-1.5 transition-colors"
              >
                <FolderPlus className="w-4 h-4 text-blue-600" />
                <span>Nova Pasta</span>
              </button>
            )}



            {isQuotaExceeded ? (
              <button
                id="upload-blocked-btn"
                onClick={() => setShowBlockedLimitModal(true)}
                className="px-3.5 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 border border-rose-300 dark:border-rose-800 rounded-xl flex items-center space-x-1.5 transition-colors shadow-2xs"
                title="Limite de armazenamento 100% atingido. Clique para ver detalhes e suporte."
              >
                <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Upload Bloqueado (Limite)</span>
              </button>
            ) : canUpload ? (
              <button
                id="upload-doc-btn"
                onClick={() => onOpenUploadModal(currentFolderId)}
                className="px-4 py-2 text-xs font-bold text-slate-950 bg-[#C59B4B] hover:bg-[#b0873b] active:bg-[#9e7732] rounded-xl shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 text-slate-950" />
                <span>Upload de Documento</span>
              </button>
            ) : (
              <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-xl flex items-center space-x-1" title="Apenas usuários com papel Editor ou Admin nesta pasta podem fazer upload.">
                <Lock className="w-3.5 h-3.5" />
                <span>Upload Bloqueado (Leitor)</span>
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#1B357B] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                title="Visualização em Grade"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[#1B357B] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                title="Visualização em Lista"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

          {/* Sector Filter Chips + Competence Selectors */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pt-1 pb-1">
            <span className="text-xs font-bold text-slate-400 mr-1 flex items-center space-x-1">
              <Filter className="w-3 h-3" />
              <span>Filtros:</span>
            </span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-xl border-slate-200 text-xs text-slate-700 bg-white focus:border-[#1B357B] py-1.5"
            >
              <option value="ALL">Todos os Meses</option>
              {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-xl border-slate-200 text-xs text-slate-700 bg-white focus:border-[#1B357B] py-1.5"
            >
              <option value="ALL">Todos os Anos</option>
              {['2024', '2025', '2026', '2027'].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div className="h-4 w-px bg-slate-200 mx-1.5" />
            
            {/* Clear Filters Button */}
            {(selectedSector !== 'ALL' || selectedMonth !== 'ALL' || selectedYear !== 'ALL') && (
              <button
                onClick={() => {
                  setSelectedSector('ALL');
                  setSelectedMonth('ALL');
                  setSelectedYear('ALL');
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Limpar Filtros
              </button>
            )}

            <div className="h-4 w-px bg-slate-200 mx-1.5" />
            {(['ALL', 'Fiscal', 'Departamento Pessoal', 'Contábil', 'Diretoria', 'Financeiro'] as const).map(sec => (
              <button
                key={sec}
                onClick={() => setSelectedSector(sec)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  selectedSector === sec
                    ? 'bg-[#1B357B] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {sec === 'ALL' ? 'Todos os Setores' : sec}
              </button>
            ))}
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Salvar Pasta
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingFolder(false)}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded-lg transition-colors"
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
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Pastas no Nível Atual</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {visibleFolders.map(folder => (
              <div
                key={folder.id}
                onClick={() => setCurrentFolderId(folder.id)}
                className="p-4 rounded-2xl border border-slate-200/80 hover:border-[#C59B4B]/50 bg-white hover:bg-slate-50/80 cursor-pointer transition-all group shadow-2xs hover:shadow-md flex items-center justify-between"
              >
                <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                  <div className="p-2.5 bg-[#1B357B]/10 group-hover:bg-[#1B357B] text-[#1B357B] group-hover:text-white rounded-xl transition-colors shrink-0">
                    <FolderIcon className="w-5 h-5" />
                  </div>
                  <div className="truncate flex-1 min-w-0">
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate group-hover:text-[#112354] transition-colors">
                      {folder.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{folder.sector}</p>
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
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
          <div className="bg-white/90 rounded-2xl border border-slate-200/80 py-12 px-6 text-center shadow-sm">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800">Nenhum documento encontrado</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
              {currentFolderId 
                ? 'Esta pasta ainda não possui arquivos armazenados.' 
                : 'Nenhum arquivo na raiz. Selecione uma pasta acima ou faça o upload de um documento.'}
            </p>
            {isQuotaExceeded ? (
              <button
                onClick={() => setShowBlockedLimitModal(true)}
                className="mt-4 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>Upload Bloqueado (Limite de Quota Atingido)</span>
              </button>
            ) : canUpload ? (
              <button
                onClick={() => onOpenUploadModal(currentFolderId)}
                className="mt-4 px-4 py-2.5 bg-[#C59B4B] hover:bg-[#b0873b] active:bg-[#9e7732] text-slate-950 font-bold rounded-xl shadow-xs inline-flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 text-slate-950" />
                <span>Upload de Arquivo</span>
              </button>
            ) : null}
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-[#C59B4B]/50 transition-all p-5 flex flex-col justify-between group relative"
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
                    <div>
                      <h4 
                        onClick={() => onOpenFileViewer(file)}
                        className="text-sm font-bold text-slate-800 truncate group-hover:text-[#1B357B] transition-colors mt-3 cursor-pointer" 
                        title={file.name}
                      >
                        {file.name}
                      </h4>
                      <p className="text-xs text-slate-400 font-medium mb-3 flex items-center gap-1">
                        <FolderIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{file.sector}</span>
                        {file.pages_count && file.pages_count > 1 && (
                          <span className="text-slate-400">• {file.pages_count} págs</span>
                        )}
                        {file.tags && file.tags.find(t => t.startsWith('Ref: ')) && (
                          <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-medium ml-1">
                            {file.tags.find(t => t.startsWith('Ref: '))}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Due Date Indicator Badge */}
                    {(() => {
                      const dueInfo = getDueDateInfo(file.due_date || (file as any).dataVencimento);
                      if (!dueInfo) return null;
                      return (
                        <div className={`px-2.5 py-1.5 rounded-xl border text-[11px] flex items-center justify-between gap-1.5 mb-2.5 ${dueInfo.cardClass}`}>
                          <span className="flex items-center gap-1.5 font-medium text-slate-700">
                            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>Vencimento:</span>
                          </span>
                          <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${dueInfo.badgeClass}`}>
                            {dueInfo.badgeText}
                          </span>
                        </div>
                      );
                    })()}

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
                  <th className="p-3">Vencimento</th>
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
                  const dueInfo = getDueDateInfo(file.due_date || (file as any).dataVencimento);

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
                      <td className="p-3 whitespace-nowrap">
                        {dueInfo ? (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-bold ${dueInfo.badgeClass}`}>
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>{dueInfo.badgeText}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">—</span>
                        )}
                      </td>
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
    </div>
  );
};
