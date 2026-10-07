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
  Phone, 
  Loader2,
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
  X,
  Users,
  UserCheck,
  UserX,
  Info
} from 'lucide-react';
import { Folder, DocumentFile, Sector, UserProfile, PermissionLevel, StorageMetrics } from '../types';
import { formatBytes } from '../lib/optimization';
import { getPresignedDownloadUrl, getPermanentViewUrl } from '../lib/storage-service';
import { FiscalNewsBanner } from './FiscalNewsBanner';
import { WidgetAvisos } from './WidgetAvisos';

interface FileManagerProps {
  currentUser: UserProfile;
  folders: Folder[];
  files: DocumentFile[];
  allProfiles?: UserProfile[];
  storageMetrics?: StorageMetrics | null;
  onRefreshStorage?: () => void;
  onOpenFileViewer: (file: DocumentFile) => void;
  onOpenUploadModal: (targetFolderId?: string | null) => void;
  onCreateFolder: (name: string, parentId: string | null, sector: Sector, allowedUserIds?: string[]) => Promise<any> | void;
  onDeleteFolder?: (folderId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onRenameFile?: (fileId: string, newName: string) => void;
  onUpdateFolderAllowedUsers?: (folderId: string, allowedUserIds: string[]) => Promise<void> | void;
  hasFolderPermission: (folderId: string, minLevel: PermissionLevel) => boolean;
  onOpenCompanyModal?: (initialQuery?: string) => void;
  externalSearchQuery?: string;
  onClearExternalSearch?: () => void;
}

export const FileManager: React.FC<FileManagerProps> = ({
  currentUser,
  folders,
  files,
  allProfiles,
  storageMetrics,
  onRefreshStorage,
  onOpenFileViewer,
  onOpenUploadModal,
  onCreateFolder,
  onDeleteFolder,
  onDeleteFile,
  onRenameFile,
  onUpdateFolderAllowedUsers,
  hasFolderPermission,
  onOpenCompanyModal,
  externalSearchQuery,
  onClearExternalSearch,
}) => {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<Sector | 'ALL'>('ALL');
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
  const [sharingFileId, setSharingFileId] = useState<string | null>(null);

  // Granular Folder Permissions Management Modal State (Admin / Diretoria)
  const [managingPermsFolder, setManagingPermsFolder] = useState<Folder | null>(null);
  const [selectedAllowedUserIds, setSelectedAllowedUserIds] = useState<string[]>([]);
  const [isSavingPerms, setIsSavingPerms] = useState(false);
  const [permsUserSearch, setPermsUserSearch] = useState('');
  const [permsSectorFilter, setPermsSectorFilter] = useState<Sector | 'ALL'>('ALL');
  const [permsSuccessMessage, setPermsSuccessMessage] = useState('');

  // 1. REGRAS DE NEGÓCIO E PERMISSÕES:
  // Administradores e Diretoria têm acesso TOTAL irrestrito a todas as pastas e documentos
  const isFullAdmin = 
    currentUser?.role === 'admin' || 
    (currentUser?.role as string) === 'ADMIN' || 
    (currentUser as any)?.role === 'Diretoria' ||
    currentUser?.sector === 'Diretoria' || 
    (currentUser as any)?.setor === 'Diretoria';

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

  // Proteção em tempo real: se o usuário comum estiver dentro de uma pasta para a qual não tem autorização, redireciona para a raiz
  useEffect(() => {
    if (currentFolderId && !isFullAdmin) {
      const folder = folders.find(f => f.id === currentFolderId);
      if (folder && !folder.allowed_user_ids?.includes(currentUser.id)) {
        setCurrentFolderId(null);
      }
    }
  }, [currentFolderId, folders, currentUser.id, isFullAdmin]);

  // Trava de rolagem rigorosa na página ao fundo (Body Scroll Lock) ao gerenciar permissões
  useEffect(() => {
    if (!managingPermsFolder) return;

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
  }, [managingPermsFolder]);

  // Filter folders: direct children or search results across drive
  // Administradores veem tudo; Usuários comuns veem apenas pastas expressamente autorizadas
  const visibleFolders = folders.filter(folder => {
    if (!isFullAdmin) {
      const isAllowed = Boolean(folder.allowed_user_ids?.includes(currentUser?.id));
      if (!isAllowed) {
        return false;
      }
    }

    if (searchQuery.trim()) {
      const matchesSearch = folder.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      if (!matchesSearch) return false;
      if (selectedSector !== 'ALL' && folder.sector !== selectedSector) return false;
      return true;
    }
    const isDirectChild = currentFolderId 
      ? folder.parent_id === currentFolderId 
      : (!folder.parent_id || folder.parent_id === null || folder.parent_id === '');
    if (!isDirectChild) return false;
    if (selectedSector !== 'ALL' && folder.sector !== selectedSector) return false;
    return true;
  });

  // Filter files: direct children or search results across drive
  // Usuários comuns só visualizam documentos contidos em pastas para as quais receberam autorização
  const visibleFiles = files.filter(file => {
    if (!isFullAdmin && file.folder_id) {
      const parentFolder = folders.find(f => f.id === file.folder_id);
      if (parentFolder) {
        const isAllowed = Boolean(parentFolder.allowed_user_ids?.includes(currentUser?.id));
        if (!isAllowed) return false;
      }
    }

    const matchesSearch = searchQuery
      ? file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (file.uploader_name && file.uploader_name.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;

    // When inside a specific folder, files of that folder are shown directly; on root/global search, respect selected sector filter
    const matchesSector = currentFolderId 
      ? true 
      : (selectedSector === 'ALL' || file.sector === selectedSector);
    if (!matchesSector) return false;

    if (searchQuery) {
      // Global search returns matching files the user has permission to see
      return matchesSearch && (selectedSector === 'ALL' || file.sector === selectedSector);
    }

    // In regular navigation, show files in current folder strictly
    const isInCurrentFolder = currentFolderId 
      ? (file.folder_id === currentFolderId || String(file.folder_id).toLowerCase() === String(currentFolderId).toLowerCase())
      : (!file.folder_id || file.folder_id === null || file.folder_id === '' || file.folder_id === 'root' || file.folder_id === 'fold-fisc-root');
    if (!isInCurrentFolder) return false;
    return matchesSearch;
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

  const [isRefreshingLocal, setIsRefreshingLocal] = useState(false);

  const handleRefreshClick = () => {
    if (isRefreshingLocal) return;
    setIsRefreshingLocal(true);
    if (onRefreshStorage) onRefreshStorage();
    setTimeout(() => setIsRefreshingLocal(false), 800);
  };

  // 1. REGRAS DE PERMISSÃO E ACESSO POR PERFIL:
  // Administradores e Editores têm controle operacional pleno (criar pastas, baixar, compartilhar).
  // Usuários com perfil autorizado para Leitura (viewer/usuário autorizado):
  // - NÃO podem criar novas pastas
  // - NÃO podem baixar arquivos nem compartilhar
  // - SÓ podem visualizar documentos
  // - PODEM colocar/fazer upload de documentos dentro da pasta autorizada
  const isApprovedOrActive = currentUser.status === 'active' || currentUser.status === 'approved';
  const isEditorOrAdmin = isFullAdmin || currentUser.role === 'editor';

  const canCreateSubfolder = isApprovedOrActive && isEditorOrAdmin;
  const canDownload = isApprovedOrActive && isEditorOrAdmin;
  const canShare = isApprovedOrActive && isEditorOrAdmin;

  // Upload permitido para admin, editor, e usuários comuns dentro de suas pastas autorizadas
  const isUserAuthorizedInCurrentFolder = currentFolderId 
    ? (isFullAdmin || isEditorOrAdmin || Boolean(folders.find(f => f.id === currentFolderId)?.allowed_user_ids?.includes(currentUser.id)) || hasFolderPermission(currentFolderId, 'viewer'))
    : (isFullAdmin || isEditorOrAdmin || folders.some(f => f.allowed_user_ids?.includes(currentUser.id)));

  const canUpload = isApprovedOrActive && isUserAuthorizedInCurrentFolder;

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateSubfolder) {
      alert('Seu perfil de usuário possui permissão apenas de Leitura e não pode criar novas pastas.');
      return;
    }
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

  // Granular Folder Permissions Handlers (Admin / Diretoria)
  const handleOpenPermsModal = (folder: Folder) => {
    setManagingPermsFolder(folder);
    setSelectedAllowedUserIds(Array.isArray(folder.allowed_user_ids) ? [...folder.allowed_user_ids] : []);
    setPermsUserSearch('');
    setPermsSectorFilter('ALL');
    setPermsSuccessMessage('');
  };

  const toggleUserAccess = (userId: string) => {
    setSelectedAllowedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const commonUsers = useMemo(() => {
    if (!allProfiles || !Array.isArray(allProfiles)) return [];
    return allProfiles.filter(p => {
      // Administradores e Diretoria possuem acesso irrestrito por padrão
      const isProfileAdmin = 
        p.role === 'admin' || 
        (p.role as string) === 'ADMIN' || 
        (p as any).role === 'Diretoria' ||
        p.sector === 'Diretoria' || 
        (p as any).setor === 'Diretoria';
      if (isProfileAdmin) return false;
      if (p.status === 'rejected') return false;
      return true;
    });
  }, [allProfiles]);

  const filteredCommonUsers = useMemo(() => {
    return commonUsers.filter(p => {
      if (permsSectorFilter !== 'ALL' && p.sector !== permsSectorFilter) return false;
      if (permsUserSearch.trim()) {
        const q = permsUserSearch.toLowerCase();
        return (
          p.full_name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.sector.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [commonUsers, permsSectorFilter, permsUserSearch]);

  const handleSelectAllFiltered = () => {
    const idsToAdd = filteredCommonUsers.map(u => u.id);
    setSelectedAllowedUserIds(prev => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const handleDeselectAll = () => {
    setSelectedAllowedUserIds([]);
  };

  const handleSavePermsSubmit = async () => {
    if (!managingPermsFolder || !onUpdateFolderAllowedUsers) return;
    setIsSavingPerms(true);
    try {
      await onUpdateFolderAllowedUsers(managingPermsFolder.id, selectedAllowedUserIds);
      setPermsSuccessMessage('Permissões de visualização atualizadas com sucesso!');
      setTimeout(() => {
        setManagingPermsFolder(null);
        setPermsSuccessMessage('');
      }, 700);
    } catch (err: any) {
      alert('Erro ao salvar permissões: ' + (err.message || 'Falha de sincronização.'));
    } finally {
      setIsSavingPerms(false);
    }
  };

  const handleDirectDownload = async (file: DocumentFile) => {
    if (!canDownload) {
      alert('Seu perfil de usuário possui permissão apenas de visualização. O download de arquivos não é permitido.');
      return;
    }
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

  const handleShareDirectDocument = async (file: DocumentFile) => {
    if (!canShare) {
      alert('Seu perfil de usuário possui permissão apenas de visualização. O compartilhamento de arquivos não é permitido.');
      return;
    }
    if (sharingFileId) return;
    try {
      setSharingFileId(file.id);
      const res = await getPresignedDownloadUrl(file.storage_key, file.name, true);
      const fileUrl = res.downloadUrl;

      // 1. Obter o ficheiro como Blob
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const jsFile = new File([blob], file.name, { type: blob.type || 'application/pdf' });

      const shareData = {
        files: [jsFile],
        title: file.name,
        text: "Olá! Aqui é da *MVRJ Contábil*"
      };

      // 2. Verificar se o navegador suporta partilha nativa com o objeto unificado (ficheiro + texto)
      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback se o navegador não permitir anexo e texto juntos:
        // Descarrega o ficheiro e abre a conversa do WhatsApp
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent("Olá! Aqui é da *MVRJ Contábil*")}`, '_blank');
      }
    } catch (error) {
      console.error('Erro na partilha:', error);
      // Fallback em caso de erro de rede ou CORS na rota de fetch do blob: abrir URL segura diretamente
      try {
        const res = await getPresignedDownloadUrl(file.storage_key, file.name);
        window.open(res.downloadUrl, '_blank');
      } catch (err) {
        window.open(getPermanentViewUrl(file.storage_key, file.name), '_blank');
      }
    } finally {
      setSharingFileId(null);
    }
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6 overflow-x-hidden">
      
      {/* Top Storage, Documents & Real-Time Fiscal News Unified Banner (Corporate Deep Blue Theme) */}
      <div className="bg-gradient-to-r from-[#0B1736] via-[#142654] to-[#1B357B] rounded-2xl p-5 sm:p-6 lg:p-7 shadow-lg relative flex flex-col gap-5 text-white w-full border border-blue-900/40">
        {/* Subtle decorative ambient glow contained */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl" />
        </div>

        {/* Linha Principal: Títulos à esquerda / Mural de Avisos à direita */}
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 sm:gap-6 w-full">
          {/* Lado Esquerdo (Títulos e Descrição) */}
          <div className="space-y-2 flex-1 min-w-0 pr-0 lg:pr-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs border border-white/15 text-blue-100 text-xs font-semibold tracking-wide">
              <ShieldCheck className="w-3.5 h-3.5 text-[#DFB76C]" />
              <span>Drive Corporativo • MVRJ Contábil</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-snug">
              Gestão Eletrônica de Documentos Contábeis
            </h2>
            <p className="text-blue-100/80 text-xs sm:text-sm font-normal leading-relaxed max-w-xl">
              Ambiente seguro para armazenamento, consulta e organização de arquivos fiscais, contábeis e departamentais com controle de permissões.
            </p>
          </div>

          {/* Lado Direito (Mural de Avisos e Comunicados Internos em Tempo Real) */}
          <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0">
            <WidgetAvisos currentUser={currentUser} isAdmin={isFullAdmin} />
          </div>
        </div>

        {/* Linha Inferior Interna: Ticker/Barra de Plantão Fiscal Integrada Diretamente no Banner */}
        <div className="relative z-10 pt-3.5 border-t border-white/10 w-full">
          <FiscalNewsBanner embedded={true} />
        </div>

      </div>

      {/* Control Toolbar (Search, Quick Actions, View Toggle) */}
      <div className="w-full max-w-full overflow-hidden p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Row 1: Instant Search Bar & Compact CNPJ Company Lookup */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="search-docs-input"
                type="text"
                placeholder="Buscar por documento, CNPJ ou empresa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 sm:h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 pl-10 pr-9 text-xs sm:text-sm font-medium focus:bg-white dark:focus:bg-slate-900 focus:border-[#1B357B] dark:focus:border-[#DFB76C] focus:ring-2 focus:ring-[#1B357B]/15 outline-hidden transition-all shadow-xs placeholder:text-slate-400 text-slate-900 dark:text-slate-100"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    if (onClearExternalSearch) onClearExternalSearch();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-md cursor-pointer transition-colors"
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
                className="h-10 sm:h-11 px-3 sm:px-4 rounded-xl border border-slate-200 dark:border-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 transition-all shadow-xs shrink-0 cursor-pointer active:scale-98"
                title="Consultar Situação Cadastral de Empresa na Receita Federal (BrasilAPI)"
              >
                <Building2 className="w-4 h-4 text-[#1B357B] dark:text-[#DFB76C] shrink-0" />
                <span className="hidden sm:inline">Consultar CNPJ</span>
                <span className="sm:hidden">CNPJ</span>
              </button>
            )}
          </div>

          {/* Row 2: Action Buttons: New Folder, Upload & View Mode Toggle */}
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full lg:w-auto shrink-0">
            <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial">
              {canCreateSubfolder && (
                <button
                  id="create-folder-btn"
                  onClick={() => setIsCreatingFolder(true)}
                  className="flex-1 sm:flex-initial h-10 sm:h-11 px-3 sm:px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-all cursor-pointer active:scale-98"
                >
                  <FolderPlus className="w-4 h-4 text-[#1B357B] dark:text-[#DFB76C] shrink-0" />
                  <span className="whitespace-nowrap">Nova Pasta</span>
                </button>
              )}

              {canUpload ? (
                <button
                  id="upload-doc-btn"
                  onClick={() => onOpenUploadModal(currentFolderId)}
                  className="flex-1 sm:flex-initial h-10 sm:h-11 px-3.5 sm:px-5 rounded-xl bg-gradient-to-r from-[#1B357B] to-[#122452] hover:brightness-110 dark:from-[#DFB76C] dark:via-[#E8C785] dark:to-[#D4A755] dark:text-slate-950 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-950/20 dark:shadow-amber-950/20 transition-all cursor-pointer active:scale-98"
                >
                  <UploadCloud className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap sm:hidden">Upload</span>
                  <span className="whitespace-nowrap hidden sm:inline">Upload de Documento</span>
                </button>
              ) : (
                <div className="flex-1 sm:flex-initial h-10 sm:h-11 px-3 sm:px-4 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center gap-1.5" title="Apenas usuários com papel Editor ou Admin nesta pasta podem fazer upload.">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap sm:hidden">Bloqueado</span>
                  <span className="whitespace-nowrap hidden sm:inline">Upload Bloqueado</span>
                </div>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-0.5 rounded-xl h-10 sm:h-11 gap-0.5 shrink-0 border border-slate-200 dark:border-slate-800 shadow-2xs ml-auto sm:ml-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white dark:bg-slate-800 text-[#1B357B] dark:text-[#DFB76C] font-bold shadow-xs border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
                title="Visualização em Grade"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white dark:bg-slate-800 text-[#1B357B] dark:text-[#DFB76C] font-bold shadow-xs border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
                title="Visualização em Lista"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Active Search Badge */}
        {searchQuery && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 text-xs font-bold text-slate-900">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-100 text-blue-950 border border-blue-300 text-xs font-bold shrink-0">
              <Building2 className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
              <span className="truncate max-w-[160px] sm:max-w-xs">Filtro: {searchQuery}</span>
              <button
                onClick={() => {
                  setSearchQuery('');
                  if (onClearExternalSearch) onClearExternalSearch();
                }}
                className="p-0.5 hover:bg-blue-200 rounded-md text-blue-800 cursor-pointer"
                title="Remover filtro"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inline Create Folder Input */}
      {isCreatingFolder && (
        <div className="bg-white border border-blue-200 rounded-2xl p-4 shadow-md animate-in fade-in slide-in-from-top-2 duration-150">
          <form onSubmit={handleCreateFolderSubmit} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center space-x-2 flex-1 w-full">
              <FolderPlus className="w-5 h-5 text-blue-600 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Nome da nova pasta (ex: Guias DARF 2026)..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-hidden placeholder:text-slate-400 font-medium"
              />
            </div>
            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <button
                type="submit"
                disabled={isSubmittingFolder}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
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
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center space-x-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md px-3.5 sm:px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-2xs w-full">
        <button
          onClick={() => setCurrentFolderId(null)}
          className={`flex items-center space-x-1.5 hover:text-[#1B357B] dark:hover:text-[#DFB76C] transition-colors cursor-pointer shrink-0 ${!currentFolderId ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
        >
          <Home className="w-4 h-4 text-[#1B357B] dark:text-[#DFB76C]" />
          <span>Drive Raiz</span>
        </button>

        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.id}>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
            <button
              onClick={() => setCurrentFolderId(crumb.id)}
              className={`hover:text-[#1B357B] dark:hover:text-[#DFB76C] transition-colors whitespace-nowrap cursor-pointer ${idx === breadcrumbs.length - 1 ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 font-medium'}`}
            >
              {crumb.name}
            </button>
          </React.Fragment>
        ))}

        {searchQuery && (
          <span className="ml-auto text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800 shrink-0">
            Filtro: "{searchQuery}"
          </span>
        )}

        {currentFolder && isFullAdmin && !searchQuery && (
          <button
            type="button"
            onClick={() => handleOpenPermsModal(currentFolder)}
            className="ml-auto inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 transition-colors shrink-0 cursor-pointer shadow-2xs"
            title="Gerenciar quais usuários comuns podem ver esta pasta"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Permissões de Acesso</span>
          </button>
        )}
      </nav>

      {/* FOLDERS SECTION */}
      {!searchQuery && visibleFolders.length > 0 && (
        <section className="space-y-3 w-full">
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <FolderIcon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Pastas no Nível Atual
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-mono font-bold">
                {visibleFolders.length}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3.5 sm:gap-4 w-full">
            {visibleFolders.map(folder => (
              <div
                key={folder.id}
                onClick={() => setCurrentFolderId(folder.id)}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 text-slate-900 dark:text-slate-100 hover:border-[#1B357B]/40 dark:hover:border-[#DFB76C]/40 rounded-2xl p-3.5 sm:p-4 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all flex items-start justify-between group cursor-pointer min-w-0"
              >
                <div className="flex items-start space-x-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-slate-800 text-[#1B357B] dark:text-[#E2C37A] border border-blue-100 dark:border-slate-700 group-hover:bg-[#1B357B] group-hover:text-white dark:group-hover:bg-[#C59B4B] dark:group-hover:text-slate-950 transition-all flex items-center justify-center font-bold shrink-0 shadow-2xs mt-0.5">
                    <FolderIcon className="w-5 h-5 transition-transform group-hover:scale-105" />
                  </div>
                  
                  <div className="min-w-0 flex-1 pr-1">
                    <h4 
                      className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#1B357B] dark:group-hover:text-amber-400 transition-colors break-words whitespace-normal leading-snug"
                      title={folder.name}
                    >
                      {folder.name}
                    </h4>
                    
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {folder.sector}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600 text-[10px]">•</span>
                      {isFullAdmin && (
                        Array.isArray(folder.allowed_user_ids) && folder.allowed_user_ids.length > 0 ? (
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap shrink-0" 
                            title={`${folder.allowed_user_ids.length} colaborador(es) com acesso autorizado`}
                          >
                            <Users className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>{folder.allowed_user_ids.length} acessos</span>
                          </span>
                        ) : (
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap shrink-0" 
                            title="Acesso exclusivo para Administradores e Diretoria"
                          >
                            <Lock className="w-3 h-3 text-slate-500 dark:text-slate-400 shrink-0" />
                            <span>Diretoria</span>
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0 ml-1.5 self-start mt-0.5">
                  {isFullAdmin && (
                    <button
                      type="button"
                      id={`btn-manage-perms-${folder.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenPermsModal(folder);
                      }}
                      className="text-slate-400 hover:text-[#1B357B] dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors p-1.5 rounded-lg cursor-pointer"
                      title="Gerenciar Permissões da Pasta"
                    >
                      <ShieldCheck className="w-4 h-4" />
                    </button>
                  )}
                  {currentUser.role === 'admin' && onDeleteFolder && (
                    <button
                      type="button"
                      id={`btn-delete-folder-${folder.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFolder(folder.id);
                      }}
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors p-1.5 rounded-lg cursor-pointer"
                      title="Excluir Pasta (Admin)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-[#1B357B] dark:group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FILES SECTION - Only show when inside a folder or when a search query is active */}
      {(currentFolderId !== null || searchQuery.trim() !== '') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {searchQuery ? `Documentos Encontrados` : `Arquivos na Pasta`}
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-mono font-bold">
                {sortedFiles.length}
              </span>
            </div>
            
            <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 font-semibold text-slate-800 dark:text-slate-200 text-xs shadow-2xs focus:ring-2 focus:ring-[#1B357B]/20 dark:focus:ring-amber-500/20 cursor-pointer outline-none transition-colors"
              >
                <option value="date">Ordenar por Data</option>
                <option value="name">Ordenar por Nome</option>
                <option value="size">Ordenar por Tamanho</option>
              </select>
            </div>
          </div>

          <div className="max-h-[680px] overflow-y-auto pr-1 space-y-3 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
            {sortedFiles.length === 0 ? (
              <div className="bg-white dark:bg-slate-900/90 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center flex flex-col items-center justify-center gap-3">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-slate-800/80 border border-blue-100 dark:border-slate-700 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-[#1B357B] dark:text-[#E2C37A]" />
                  </div>
                </div>
                <div className="max-w-sm">
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-200">Nenhum documento encontrado</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed font-normal">
                    {currentFolderId 
                      ? 'Esta pasta ainda não possui arquivos armazenados.' 
                      : 'Nenhum arquivo na raiz. Selecione uma pasta acima ou faça o upload de um documento.'}
                  </p>
                </div>
                {canUpload ? (
                  <button
                    onClick={() => onOpenUploadModal(currentFolderId)}
                    className="mt-2 bg-gradient-to-r from-[#1B357B] to-[#122452] dark:from-[#DFB76C] dark:via-[#E8C785] dark:to-[#D4A755] dark:text-slate-950 text-white font-bold shadow-xs rounded-xl px-5 py-2.5 inline-flex items-center gap-2 text-xs transition-all cursor-pointer active:scale-98"
                  >
                    <UploadCloud className="w-4 h-4 shrink-0" />
                    <span>Upload de Documento</span>
                  </button>
                ) : null}
              </div>
            ) : viewMode === 'grid' ? (
              /* GRID VIEW */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 w-full">
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
                  className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 shadow-2xs hover:border-[#1B357B]/40 dark:hover:border-[#DFB76C]/40 hover:shadow-md hover:-translate-y-0.5 transition-all p-4 sm:p-4.5 flex flex-col justify-between group relative min-w-0 overflow-hidden"
                >
                  <div>
                    {/* Top Bar: File Icon & Status Badge */}
                    <div className="flex items-start justify-between">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                        isPdf ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50' :
                        isImage ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50' :
                        (isSpreadsheet || isXml) ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50' :
                        isPfx ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50' :
                        isZip ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50' :
                        'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
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
                        <span className="bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/80 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <KeyRound className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          <span>Certificado</span>
                        </span>
                      ) : file.compression_ratio > 0 ? (
                        <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>-{file.compression_ratio}%</span>
                        </span>
                      ) : (
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          <span>Íntegro</span>
                        </span>
                      )}
                    </div>

                    {/* File Title & Sector/Folder */}
                    <div className="min-w-0">
                      <h4 
                        onClick={() => onOpenFileViewer(file)}
                        className="text-sm font-bold text-slate-900 dark:text-slate-100 break-words group-hover:text-[#1B357B] dark:group-hover:text-[#E2C37A] transition-colors mt-3 cursor-pointer leading-snug line-clamp-2" 
                        title={file.name}
                      >
                        {file.name}
                      </h4>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-3 flex items-center gap-1.5 min-w-0 truncate mt-1">
                        <FolderIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">{file.sector}</span>
                        {file.pages_count && file.pages_count > 1 && (
                          <span className="text-slate-400 shrink-0">· {file.pages_count} págs</span>
                        )}
                        {file.tags && file.tags.find(t => t.startsWith('Ref: ')) && (
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] px-1.5 py-0.2 rounded font-mono font-medium border border-slate-200 dark:border-slate-700 ml-1 shrink-0">
                            {file.tags.find(t => t.startsWith('Ref: '))}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Size Pill */}
                    <div className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded-lg w-fit mb-3">
                      {formatBytes(file.optimized_size || file.original_size)}
                    </div>

                    {/* Minimalist Tags */}
                    {file.tags && file.tags.filter(t => !t.startsWith('Ref: ')).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {file.tags.filter(t => !t.startsWith('Ref: ')).slice(0, 3).map(tag => (
                          <span key={tag} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-medium px-1.5 py-0.5 rounded-md">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      {new Date(file.created_at).toLocaleDateString('pt-BR')}
                    </span>

                    <div className="flex items-center space-x-0.5">
                      <button
                        type="button"
                        onClick={() => onOpenFileViewer(file)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-[#1B357B] dark:hover:text-[#E2C37A] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Visualizar documento"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {canShare && (
                        <button
                          type="button"
                          disabled={!!sharingFileId}
                          onClick={() => handleShareDirectDocument(file)}
                          className={`p-2 rounded-lg transition-colors cursor-pointer ${
                            sharingFileId === file.id 
                              ? 'text-blue-700 bg-slate-100 dark:bg-slate-800' 
                              : 'text-slate-600 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          } disabled:opacity-50`}
                          title="Enviar via WhatsApp ou Partilha Direta"
                        >
                          {sharingFileId === file.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Phone className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      {canDownload && (
                        <button
                          type="button"
                          onClick={() => handleDirectDownload(file)}
                          className="p-2 rounded-lg text-slate-600 hover:text-slate-950 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Download seguro"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}

                      {(currentUser.role === 'admin' || currentUser.role === 'editor') && onRenameFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingFile(file);
                            setNewNameInput(file.name);
                          }}
                          className="p-2 rounded-lg text-slate-600 hover:text-slate-950 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Renomear documento"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}

                      {currentUser.role === 'admin' && onDeleteFile && (
                        <button
                          type="button"
                          onClick={() => onDeleteFile(file.id)}
                          className="p-2 rounded-lg text-slate-600 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
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
          <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-2xs overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
            <table className="w-full text-left text-xs border-collapse min-w-[520px] sm:min-w-full">
              <thead>
                <tr className="bg-slate-50/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="p-3 sm:p-3.5">Nome do Documento</th>
                  <th className="p-3 sm:p-3.5 hidden sm:table-cell">Setor</th>
                  <th className="p-3 sm:p-3.5 hidden lg:table-cell">Tamanho Original</th>
                  <th className="p-3 sm:p-3.5">Tamanho Otimizado</th>
                  <th className="p-3 sm:p-3.5 hidden md:table-cell">Economia R2</th>
                  <th className="p-3 sm:p-3.5 hidden sm:table-cell">Data de Envio</th>
                  <th className="p-3 sm:p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {sortedFiles.map(file => {
                  const lowerName = file.name.toLowerCase();
                  const isPfx = file.mime_type.includes('pkcs12') || /\.(pfx|p12|cer|crt|key)$/i.test(lowerName);
                  const isPdf = file.mime_type.includes('pdf') || /\.pdf$/i.test(lowerName);
                  const isImage = file.mime_type.includes('image') || /\.(webp|png|jpe?g|gif|svg|bmp)$/i.test(lowerName);
                  const isSpreadsheet = /\.(xlsx|xls|csv|ods)$/i.test(lowerName) || file.mime_type.includes('spreadsheet') || file.mime_type.includes('excel') || file.mime_type.includes('csv');
                  const isXml = /\.(xml|nfe|cte|sped|ofx|rem|ret)$/i.test(lowerName) || file.mime_type.includes('xml');
                  const isZip = /\.(zip|rar|7z|tar|gz)$/i.test(lowerName) || file.mime_type.includes('zip') || file.mime_type.includes('compressed');

                  return (
                    <tr key={file.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 sm:p-3.5 font-bold text-slate-900 dark:text-slate-100 min-w-0">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className={`p-1.5 rounded-lg text-white shrink-0 shadow-2xs ${
                            isPfx ? 'bg-purple-600' :
                            isPdf ? 'bg-rose-600' :
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
                            className="font-bold hover:text-[#1B357B] dark:hover:text-[#E2C37A] cursor-pointer break-words text-slate-900 dark:text-slate-100 truncate max-w-[150px] sm:max-w-xs"
                            title={file.name}
                          >
                            {file.name}
                          </span>
                          {isPfx && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                              PFX
                            </span>
                          )}
                          {isXml && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                              XML
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 sm:p-3.5 text-slate-600 dark:text-slate-300 font-medium hidden sm:table-cell">{file.sector}</td>

                      <td className="p-3 sm:p-3.5 font-mono text-slate-400 line-through hidden lg:table-cell">{formatBytes(file.original_size)}</td>
                      <td className="p-3 sm:p-3.5 font-mono font-semibold text-slate-900 dark:text-slate-100">{formatBytes(file.optimized_size)}</td>
                      <td className="p-3 sm:p-3.5 font-bold text-emerald-600 dark:text-emerald-400 hidden md:table-cell">
                        {file.compression_ratio > 0 ? `-${file.compression_ratio}%` : '100% Íntegro'}
                      </td>
                      <td className="p-3 sm:p-3.5 text-slate-500 dark:text-slate-400 font-normal hidden sm:table-cell">{new Date(file.created_at).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3 sm:p-3.5 text-right shrink-0">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => onOpenFileViewer(file)}
                            className="p-1.5 text-slate-400 hover:text-[#1B357B] dark:hover:text-[#E2C37A] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="Visualizar"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canDownload && (
                            <button
                              onClick={() => handleDirectDownload(file)}
                              className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Download Seguro"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          {(currentUser.role === 'admin' || currentUser.role === 'editor') && onRenameFile && (
                            <button
                              onClick={() => {
                                setRenamingFile(file);
                                setNewNameInput(file.name);
                              }}
                              className="p-1.5 text-slate-400 hover:text-[#1B357B] dark:hover:text-[#E2C37A] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Renomear"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {currentUser.role === 'admin' && (
                            <button
                              onClick={() => onDeleteFile(file.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer transition-colors"
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
      </div>
    </section>
  )}

      {/* Rename File Modal */}
      {renamingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-[90%] max-w-md mx-auto rounded-2xl shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-150 text-slate-900">
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
                  className="w-full h-10 px-3 text-xs text-slate-900 bg-white border border-slate-200 rounded-xl focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all font-medium"
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
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Granular Folder Permissions Management Modal (Admin / Diretoria) */}
      {managingPermsFolder && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm overscroll-contain animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSavingPerms) setManagingPermsFolder(null);
          }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            className="bg-white dark:bg-slate-900 w-full max-w-lg mx-auto rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden overscroll-contain animate-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/40 shrink-0">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#1B357B]/10 dark:bg-[#DFB76C]/10 text-[#1B357B] dark:text-[#DFB76C] border border-[#1B357B]/20 dark:border-[#DFB76C]/30 flex items-center justify-center shrink-0 shadow-2xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-slate-900 dark:text-white font-bold text-sm sm:text-base truncate">
                    Permissões de Acesso à Pasta
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px] sm:max-w-xs">{managingPermsFolder.name}</span>
                    <span>·</span>
                    <span className="text-[11px] font-medium">{managingPermsFolder.sector}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManagingPermsFolder(null)}
                disabled={isSavingPerms}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informational Guidance (Clean & Modern SaaS) */}
            <div className="px-5 py-3 bg-blue-50/60 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/40 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5 shrink-0">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-[11px] sm:text-xs leading-relaxed space-y-0.5">
                <p>
                  <strong>Diretoria e Administradores</strong> possuem acesso total irrestrito automático a esta pasta.
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  Marque abaixo os colaboradores que terão permissão para visualizar e abrir seus arquivos.
                </p>
              </div>
            </div>

            {/* Filters & Actions Bar */}
            <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 space-y-2.5 bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Filtrar por colaborador, email ou setor..."
                    value={permsUserSearch}
                    onChange={(e) => setPermsUserSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-[#1B357B] dark:focus:border-[#DFB76C] outline-none transition-all font-medium"
                  />
                  {permsUserSearch && (
                    <button
                      type="button"
                      onClick={() => setPermsUserSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="px-2.5 py-2 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-xl transition-colors cursor-pointer whitespace-nowrap active:scale-98 shadow-2xs"
                  >
                    Marcar Todos
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-2.5 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap active:scale-98 shadow-2xs"
                  >
                    Desmarcar
                  </button>
                </div>
              </div>

              {/* Sector Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full text-xs">
                {(['ALL', 'Fiscal', 'Departamento Pessoal', 'Contábil', 'Financeiro', 'Geral'] as const).map(sec => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setPermsSectorFilter(sec)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                      permsSectorFilter === sec
                        ? 'bg-[#1B357B] dark:bg-[#DFB76C] text-white dark:text-slate-950 shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80'
                    }`}
                  >
                    {sec === 'ALL' ? 'Todos os Setores' : sec}
                  </button>
                ))}
              </div>
            </div>

            {/* Users List with isolated overscroll */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 divide-y divide-slate-100 dark:divide-slate-800/60 min-h-0 bg-white dark:bg-slate-900">
              {filteredCommonUsers.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                  <UserX className="w-8 h-8 mx-auto text-slate-400" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Nenhum colaborador encontrado.</p>
                  <p className="text-[11px]">Tente ajustar a busca ou o setor selecionado.</p>
                </div>
              ) : (
                filteredCommonUsers.map(user => {
                  const isAllowed = selectedAllowedUserIds.includes(user.id);
                  return (
                    <div
                      key={user.id}
                      onClick={() => toggleUserAccess(user.id)}
                      className={`py-2.5 px-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all ${
                        isAllowed
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isAllowed}
                          onChange={() => {}} // Controlled by parent click
                          className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                        />
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                          ) : (
                            user.full_name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.full_name}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">{user.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                          {user.sector}
                        </span>
                        {isAllowed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800 whitespace-nowrap shadow-2xs">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Autorizado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Oculto</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>
                  <strong className="text-slate-900 dark:text-white font-bold">{selectedAllowedUserIds.length}</strong> de {commonUsers.length} autorizados
                </span>
                {permsSuccessMessage && (
                  <span className="text-xs font-bold text-emerald-600 animate-in fade-in">· {permsSuccessMessage}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setManagingPermsFolder(null)}
                  disabled={isSavingPerms}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSavePermsSubmit}
                  disabled={isSavingPerms}
                  className="px-4.5 py-2 bg-[#1B357B] hover:bg-[#152a60] dark:bg-[#DFB76C] dark:hover:bg-[#ce9e3c] text-white dark:text-slate-950 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  {isSavingPerms ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Salvar Permissões</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
