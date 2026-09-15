import React, { useState } from 'react';
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
  Phone
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
  onOpenUploadModal: () => void;
  onCreateFolder: (name: string, parentId: string | null, sector: Sector) => void;
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
  onDeleteFile,
  hasFolderPermission,
}) => {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<Sector | 'ALL'>('ALL');
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
    const isDirectChild = currentFolderId ? folder.parent_id === currentFolderId : folder.parent_id === null;
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

    if (searchQuery) {
      // Global search returns matching files the user has permission to see
      if (selectedSector !== 'ALL' && file.sector !== selectedSector) return false;
      return matchesSearch && hasFolderPermission(file.folder_id, 'viewer');
    }

    // In regular navigation, show files in current folder
    const isInCurrentFolder = currentFolderId ? file.folder_id === currentFolderId : false;
    if (!isInCurrentFolder) return false;
    if (selectedSector !== 'ALL' && file.sector !== selectedSector) return false;
    return matchesSearch && hasFolderPermission(file.folder_id, 'viewer');
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
  const effectiveUsedBytes = storageMetrics?.usedBytes && storageMetrics.usedBytes > totalOptimizedBytes 
    ? storageMetrics.usedBytes 
    : totalOptimizedBytes;
  const isQuotaExceeded = effectiveUsedBytes >= totalQuotaBytes || (storageMetrics ? storageMetrics.usedPercent >= 100 : false);
  const [showBlockedLimitModal, setShowBlockedLimitModal] = useState(false);

  // Permissions for current folder (Bloqueado se cota de armazenamento estourada)
  const canUpload = !isQuotaExceeded && (currentFolderId ? hasFolderPermission(currentFolderId, 'editor') : (currentUser.role === 'admin' || currentUser.role === 'editor'));
  const canCreateSubfolder = currentFolderId ? hasFolderPermission(currentFolderId, 'editor') : currentUser.role === 'admin';

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
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30 text-xs font-semibold uppercase tracking-wider">
                Drive Corporativo MVRJCONTÁBIL
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black mt-2 tracking-tight">Gestão Eletrônica de Documentos Contábeis</h2>
            <p className="text-xs text-blue-200/80 mt-1 max-w-xl">
              Ambiente seguro para armazenamento, consulta e organização de arquivos fiscais, contábeis e departamentais.
            </p>
          </div>

          {/* Savings Metric Widget */}
          <div className="grid grid-cols-3 gap-3 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 text-center">
            <div>
              <span className="text-[10px] text-blue-200 uppercase tracking-wider block">Arquivos</span>
              <strong className="text-base sm:text-lg font-extrabold text-white">{files.length}</strong>
            </div>
            <div>
              <span className="text-[10px] text-blue-200 uppercase tracking-wider block">Espaço Ocupado</span>
              <strong className="text-base sm:text-lg font-extrabold text-white">{formatBytes(totalOptimizedBytes)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-emerald-300 uppercase tracking-wider block">Economia Total</span>
              <strong className="text-base sm:text-lg font-extrabold text-emerald-300">-{overallSavingsPercent}%</strong>
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

      {/* Painel de Armazenamento & Capacidade R2: Oculto por padrão, só aparece quando o limite for atingido */}
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
                onClick={onOpenUploadModal}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs flex items-center space-x-1.5 transition-colors"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload de Documento</span>
              </button>
            ) : (
              <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-xl flex items-center space-x-1" title="Apenas usuários com papel Editor ou Admin nesta pasta podem fazer upload.">
                <Lock className="w-3.5 h-3.5" />
                <span>Upload Bloqueado (Leitor)</span>
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-2xs text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
                title="Visualização em Grade"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-2xs text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
                title="Visualização em Lista"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Sector Filter Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pt-1 pb-1">
          <span className="text-xs font-bold text-gray-400 mr-1 flex items-center space-x-1">
            <Filter className="w-3 h-3" />
            <span>Setor:</span>
          </span>
          {(['ALL', 'Fiscal', 'Departamento Pessoal', 'Contábil', 'Diretoria', 'Financeiro'] as const).map(sec => (
            <button
              key={sec}
              onClick={() => setSelectedSector(sec)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                selectedSector === sec
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
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
      <nav className="flex items-center space-x-2 text-xs font-medium text-gray-500 bg-white px-4 py-2.5 rounded-xl border border-gray-200 overflow-x-auto">
        <button
          onClick={() => setCurrentFolderId(null)}
          className={`flex items-center space-x-1 hover:text-blue-600 transition-colors ${!currentFolderId ? 'font-bold text-blue-700' : ''}`}
        >
          <Home className="w-4 h-4" />
          <span>Drive Raiz</span>
        </button>

        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.id}>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <button
              onClick={() => setCurrentFolderId(crumb.id)}
              className={`hover:text-blue-600 transition-colors whitespace-nowrap ${idx === breadcrumbs.length - 1 ? 'font-bold text-gray-900' : ''}`}
            >
              {crumb.name}
            </button>
          </React.Fragment>
        ))}

        {searchQuery && (
          <span className="ml-auto text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 shrink-0">
            Filtro de busca: "{searchQuery}"
          </span>
        )}
      </nav>

      {/* FOLDERS SECTION */}
      {!searchQuery && visibleFolders.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Pastas no Nível Atual</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {visibleFolders.map(folder => (
              <div
                key={folder.id}
                onClick={() => setCurrentFolderId(folder.id)}
                className="p-3.5 rounded-xl border border-gray-200 hover:border-blue-400 bg-white hover:bg-blue-50/40 cursor-pointer transition-all group shadow-2xs hover:shadow-sm"
              >
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 bg-blue-100 group-hover:bg-blue-600 text-blue-700 group-hover:text-white rounded-xl transition-colors shrink-0">
                    <FolderIcon className="w-5 h-5" />
                  </div>
                  <div className="truncate flex-1">
                    <h4 className="font-bold text-xs text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                      {folder.name}
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">{folder.sector}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600 shrink-0 mt-1" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FILES SECTION */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            {searchQuery ? `Documentos Encontrados (${sortedFiles.length})` : `Arquivos na Pasta (${sortedFiles.length})`}
          </h3>
          
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent border-0 font-semibold text-gray-700 text-xs focus:ring-0 cursor-pointer"
            >
              <option value="date">Ordenar por Data</option>
              <option value="name">Ordenar por Nome</option>
              <option value="size">Ordenar por Tamanho</option>
            </select>
          </div>
        </div>

        {sortedFiles.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-gray-700">Nenhum documento encontrado</h4>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
              {currentFolderId 
                ? 'Esta pasta ainda não possui arquivos armazenados no Cloudflare R2.' 
                : 'Nenhum arquivo na raiz. Selecione uma pasta acima ou faça o upload de um documento.'}
            </p>
            {isQuotaExceeded ? (
              <button
                onClick={() => setShowBlockedLimitModal(true)}
                className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition-colors"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>Upload Bloqueado (Limite de Quota Atingido)</span>
              </button>
            ) : canUpload ? (
              <button
                onClick={onOpenUploadModal}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition-colors"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload de Arquivo</span>
              </button>
            ) : null}
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedFiles.map(file => {
              const isPdf = file.mime_type.includes('pdf') || file.name.endsWith('.pdf');
              const isImage = file.mime_type.includes('image') || /\.(webp|png|jpe?g)$/i.test(file.name);

              return (
                <div
                  key={file.id}
                  className="bg-white rounded-2xl border border-gray-200 hover:border-blue-400 shadow-2xs hover:shadow-md transition-all p-4 flex flex-col justify-between group relative overflow-hidden"
                >
                  <div className="space-y-3">
                    {/* Header with Type icon & Savings Badge */}
                    <div className="flex items-start justify-between">
                      <div className={`p-2.5 rounded-xl text-white shadow-xs ${
                        isPdf ? 'bg-red-600' : isImage ? 'bg-blue-600' : 'bg-emerald-600'
                      }`}>
                        {isPdf ? <FileText className="w-5 h-5" /> : isImage ? <ImageIcon className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
                      </div>

                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        -{file.compression_ratio}% Otimizado
                      </span>
                    </div>

                    {/* File Title & Sector */}
                    <div>
                      <h4 
                        onClick={() => onOpenFileViewer(file)}
                        className="font-bold text-xs sm:text-sm text-gray-900 group-hover:text-blue-600 cursor-pointer transition-colors truncate" 
                        title={file.name}
                      >
                        {file.name}
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5 flex items-center space-x-1">
                        <span>{file.sector}</span>
                        {file.pages_count && file.pages_count > 1 && (
                          <span>• {file.pages_count} págs</span>
                        )}
                      </p>
                    </div>

                    {/* Size Comparison Widget */}
                    <div className="p-2 bg-gray-50 rounded-lg text-[11px] flex justify-between items-center text-gray-600">
                      <span className="text-gray-400">Tamanho:</span>
                      <div className="flex items-center space-x-1.5 font-mono">
                        <span className="line-through text-gray-400 text-[10px]">{formatBytes(file.original_size)}</span>
                        <span className="font-bold text-gray-900">{formatBytes(file.optimized_size)}</span>
                      </div>
                    </div>

                    {/* Tags */}
                    {file.tags && file.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {file.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-gray-400">
                      {new Date(file.created_at).toLocaleDateString('pt-BR')}
                    </span>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => onOpenFileViewer(file)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Visualizar no Leitor Seguro"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDirectDownload(file)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Download com Presigned GET URL"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {currentUser.role === 'admin' && (
                        <button
                          onClick={() => onDeleteFile(file.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
                {sortedFiles.map(file => (
                  <tr key={file.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-medium text-gray-900">
                      <div className="flex items-center space-x-2.5">
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <span 
                          onClick={() => onOpenFileViewer(file)}
                          className="font-bold hover:text-blue-600 cursor-pointer truncate max-w-xs"
                        >
                          {file.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-gray-600">{file.sector}</td>
                    <td className="p-3 font-mono text-gray-400 line-through">{formatBytes(file.original_size)}</td>
                    <td className="p-3 font-mono font-bold text-gray-800">{formatBytes(file.optimized_size)}</td>
                    <td className="p-3 font-bold text-emerald-600">-{file.compression_ratio}%</td>
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
                ))}
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
