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
  Info,
  MoreVertical,
  MoreHorizontal,
  Plus
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
  onRenameFolder?: (folderId: string, newName: string) => Promise<any> | void;
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
  onRenameFolder,
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

  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');
  const [isSubmittingFolderRename, setIsSubmittingFolderRename] = useState(false);
  const [folderRenameError, setFolderRenameError] = useState<string | null>(null);

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
  const [isFabOpen, setIsFabOpen] = useState(false);

  // Estados dos menus suspensos de opções descritas (substituindo botões soltos)
  const [openFolderMenuId, setOpenFolderMenuId] = useState<string | null>(null);
  const [openFileMenuId, setOpenFileMenuId] = useState<string | null>(null);
  const [isBreadcrumbMenuOpen, setIsBreadcrumbMenuOpen] = useState(false);

  // Fecha menus ao clicar fora ou apertar Escape
  useEffect(() => {
    const handleGlobalClick = () => {
      setOpenFolderMenuId(null);
      setOpenFileMenuId(null);
      setIsBreadcrumbMenuOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenFolderMenuId(null);
        setOpenFileMenuId(null);
        setIsBreadcrumbMenuOpen(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

  const handleConfirmRenameFolder = async () => {
    if (!renamingFolder) return;
    const trimmed = newFolderNameInput.trim();
    if (!trimmed) {
      setFolderRenameError('O nome da pasta não pode ficar vazio.');
      return;
    }
    if (trimmed === renamingFolder.name) {
      setRenamingFolder(null);
      setFolderRenameError(null);
      return;
    }
    if (onRenameFolder) {
      try {
        setIsSubmittingFolderRename(true);
        setFolderRenameError(null);
        await onRenameFolder(renamingFolder.id, trimmed);
        setRenamingFolder(null);
        setFolderRenameError(null);
      } catch (err: any) {
        setFolderRenameError(err.message || 'Erro ao renomear a pasta.');
      } finally {
        setIsSubmittingFolderRename(false);
      }
    } else {
      setRenamingFolder(null);
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
      
      {/* ========================================================= */}
      {/* LAYOUT MOBILE (Itens 2, 3 e 4 da especificação do usuário) */}
      {/* ========================================================= */}
      <div className="lg:hidden flex flex-col gap-3.5 w-full">
        {/* Item 2: BUSCA - Linha com 'Buscar documento ou empresa' ocupando o espaço todo e botão de filtro CNPJ ao lado (não empilhados) */}
        <div className="flex items-center gap-2 w-full min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="search-docs-input-mobile"
              type="text"
              placeholder="Buscar documento ou empresa"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 min-h-[44px] rounded-2xl border border-slate-800 bg-[#091124] pl-10 pr-9 text-xs sm:text-sm font-medium focus:bg-[#0B1736] focus:border-[#DFB76C] focus:ring-1 focus:ring-[#DFB76C]/40 outline-none transition-all shadow-xs placeholder:text-slate-400 text-slate-100"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  if (onClearExternalSearch) onClearExternalSearch();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1.5 rounded-md cursor-pointer transition-colors"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Botão de filtro CNPJ ao lado (não empilhado, >= 44px) */}
          {onOpenCompanyModal && (
            <button
              id="lookup-company-btn-mobile"
              type="button"
              onClick={() => onOpenCompanyModal(searchQuery)}
              className="h-11 min-h-[44px] px-3.5 rounded-2xl border border-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 bg-[#091124] hover:bg-slate-800 text-slate-200 transition-all shadow-xs shrink-0 cursor-pointer active:scale-98"
              title="Consultar Situação Cadastral de Empresa na Receita Federal"
            >
              <Building2 className="w-4 h-4 text-[#DFB76C] shrink-0" />
              <span className="whitespace-nowrap">Filtro CNPJ</span>
            </button>
          )}
        </div>

        {/* Item 3: COMUNICADOS - Faixa fina de uma linha, com ponto azul, rótulo COMUNICADO, título cortado com reticências e link 'Ver mais' em dourado */}
        <WidgetAvisos currentUser={currentUser} isAdmin={isFullAdmin} variant="slim-bar" />

        {/* Item 4: PLANTÃO FISCAL - Seção própria com título pequeno e chips em rolagem horizontal (sem texto cortado, chip ativo dourado) */}
        <FiscalNewsBanner variant="chips-section" />
      </div>

      {/* ========================================================= */}
      {/* LAYOUT DESKTOP (Exibido somente em telas grandes: hidden lg:flex) */}
      {/* ========================================================= */}
      <div className="hidden lg:flex flex-col gap-5 w-full">
        {/* Banner Superior Desktop (Tema Azul Marinho Corporativo) */}
        <div className="bg-gradient-to-r from-[#0B1736] via-[#142654] to-[#1B357B] rounded-2xl p-6 lg:p-7 shadow-lg relative flex flex-col gap-5 text-white w-full border border-blue-900/40">
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl" />
          </div>

          <div className="relative z-10 flex items-center justify-between gap-6 w-full">
            <div className="space-y-2 flex-1 min-w-0 pr-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs border border-white/15 text-blue-100 text-xs font-semibold tracking-wide">
                <ShieldCheck className="w-3.5 h-3.5 text-[#DFB76C]" />
                <span>Drive Corporativo • MVRJ Contábil</span>
              </div>
              <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-snug">
                Gestão Eletrônica de Documentos
              </h2>
              <p className="text-blue-100/80 text-xs sm:text-sm font-normal leading-relaxed">
                Drive Corporativo seguro para armazenamento, consulta e organização de arquivos fiscais, contábeis e departamentais com controle de permissões.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs font-semibold text-[#DFB76C] bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">
                  Seja bem-vindo(a), {currentUser.full_name}!
                </span>
              </div>
            </div>

            <div className="w-[380px] xl:w-[420px] shrink-0">
              <WidgetAvisos currentUser={currentUser} isAdmin={isFullAdmin} variant="card" />
            </div>
          </div>

          <div className="relative z-10 pt-3.5 border-t border-white/10 w-full">
            <FiscalNewsBanner embedded={true} variant="ticker" />
          </div>
        </div>

        {/* Toolbar Desktop com Ações */}
        <div className="w-full p-4 rounded-2xl bg-[#091124] border border-slate-800 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="search-docs-input-desktop"
                type="text"
                placeholder="Buscar documento ou empresa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-800 bg-[#0B1736] pl-10 pr-9 text-xs sm:text-sm font-medium focus:border-[#DFB76C] focus:ring-1 focus:ring-[#DFB76C]/40 outline-none transition-all shadow-xs placeholder:text-slate-400 text-slate-100"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    if (onClearExternalSearch) onClearExternalSearch();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1.5 rounded-md cursor-pointer transition-colors"
                  title="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {onOpenCompanyModal && (
              <button
                id="lookup-company-btn-desktop"
                type="button"
                onClick={() => onOpenCompanyModal(searchQuery)}
                className="h-11 px-4 rounded-xl border border-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 bg-[#0B1736] hover:bg-slate-800 text-slate-200 transition-all shadow-xs shrink-0 cursor-pointer active:scale-98"
                title="Consultar Situação Cadastral de Empresa na Receita Federal"
              >
                <Building2 className="w-4 h-4 text-[#DFB76C] shrink-0" />
                <span>Filtro CNPJ</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canCreateSubfolder && (
              <button
                id="create-folder-btn-desktop"
                onClick={() => setIsCreatingFolder(true)}
                className="h-11 px-4 rounded-xl border border-slate-800 bg-[#0B1736] font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs text-slate-200 hover:bg-slate-800 transition-all cursor-pointer active:scale-98"
              >
                <FolderPlus className="w-4 h-4 text-[#DFB76C] shrink-0" />
                <span>Nova Pasta</span>
              </button>
            )}

            {canUpload ? (
              <button
                id="upload-doc-btn-desktop"
                onClick={() => onOpenUploadModal(currentFolderId)}
                className="h-11 px-5 rounded-xl bg-gradient-to-r from-[#DFB76C] to-[#C59B4B] text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md hover:brightness-105 transition-all cursor-pointer active:scale-98"
              >
                <UploadCloud className="w-4 h-4 shrink-0" />
                <span>Upload de Documento</span>
              </button>
            ) : (
              <div className="h-11 px-4 text-xs font-bold text-slate-500 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center gap-1.5" title="Apenas usuários com permissão podem fazer upload.">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>Upload Bloqueado</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Search Badge */}
      {searchQuery && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-bold text-slate-100">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#091124] text-slate-200 border border-slate-800 text-xs font-bold shrink-0">
            <Building2 className="w-3.5 h-3.5 text-[#DFB76C] flex-shrink-0" />
            <span className="truncate max-w-[160px] sm:max-w-xs">Filtro: {searchQuery}</span>
            <button
              onClick={() => {
                setSearchQuery('');
                if (onClearExternalSearch) onClearExternalSearch();
              }}
              className="p-0.5 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white cursor-pointer"
              title="Remover filtro"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

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
          <div className="ml-auto relative flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              id="btn-folder-options-menu"
              onClick={(e) => {
                e.stopPropagation();
                setIsBreadcrumbMenuOpen(!isBreadcrumbMenuOpen);
                setOpenFolderMenuId(null);
                setOpenFileMenuId(null);
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 transition-colors shrink-0 cursor-pointer shadow-2xs"
              title="Opções da Pasta Atual"
            >
              <MoreHorizontal className="w-4 h-4 text-[#1B357B] dark:text-[#DFB76C]" />
              <span>Opções da Pasta</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isBreadcrumbMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isBreadcrumbMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-100 text-left"
              >
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 mb-1">
                  Gerenciar Pasta Atual
                </div>
                {onRenameFolder && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsBreadcrumbMenuOpen(false);
                      setRenamingFolder(currentFolder);
                      setNewFolderNameInput(currentFolder.name);
                      setFolderRenameError(null);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-2.5 transition-colors cursor-pointer group"
                  >
                    <div className="p-1 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 group-hover:scale-105 transition-transform">
                      <Edit2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold">Renomear Pasta</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Alterar o nome desta pasta</div>
                    </div>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsBreadcrumbMenuOpen(false);
                    handleOpenPermsModal(currentFolder);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-2.5 transition-colors cursor-pointer group mt-0.5"
                >
                  <div className="p-1 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 group-hover:scale-105 transition-transform">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-bold">Permissões de Acesso</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Definir quem pode acessar</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* FOLDERS SECTION (Item 5: Título 'Pastas' à esquerda, alternador grade/lista sempre visível à direita, 2 colunas no mobile, ícone dourado, nome e quantidade de arquivos) */}
      {!searchQuery && visibleFolders.length > 0 && (
        <section className="space-y-3 w-full">
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <FolderIcon className="w-5 h-5 text-[#DFB76C]" />
              <h3 className="text-base font-extrabold text-white tracking-tight">
                Pastas
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono font-bold">
                {visibleFolders.length}
              </span>
            </div>

            {/* Alternador grade/lista SEMPRE VISÍVEL (Item 5) */}
            <div className="flex items-center bg-[#091124] p-0.5 rounded-xl h-10 gap-0.5 shrink-0 border border-slate-800 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`min-h-[36px] min-w-[36px] px-2.5 flex items-center justify-center rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-[#DFB76C] text-slate-950 font-bold shadow-xs' : 'text-slate-400 hover:text-white'}`}
                title="Visualização em Grade"
                aria-label="Grade"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`min-h-[36px] min-w-[36px] px-2.5 flex items-center justify-center rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-[#DFB76C] text-slate-950 font-bold shadow-xs' : 'text-slate-400 hover:text-white'}`}
                title="Visualização em Lista"
                aria-label="Lista"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {viewMode === 'grid' ? (
            /* Cards em 2 colunas no mobile (Item 5) */
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 w-full">
              {visibleFolders.map(folder => {
                const folderFilesCount = files.filter(f => f.folder_id === folder.id).length;
                return (
                  <div
                    key={folder.id}
                    onClick={() => setCurrentFolderId(folder.id)}
                    className="bg-[#091124] border border-slate-800 hover:border-[#DFB76C]/60 text-slate-100 rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer min-w-0 gap-2.5 relative min-h-[110px]"
                  >
                    <div className="flex items-start justify-between gap-1.5 w-full">
                      {/* Ícone de pasta dourado (Item 5) */}
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#DFB76C]/15 text-[#DFB76C] border border-[#DFB76C]/25 group-hover:bg-[#DFB76C] group-hover:text-slate-950 transition-all flex items-center justify-center font-bold shrink-0 shadow-2xs">
                        <FolderIcon className="w-5 h-5 text-[#DFB76C] group-hover:text-slate-950 transition-colors" />
                      </div>

                      {/* Menu de Opções da Pasta */}
                      <div className="flex items-center space-x-1 shrink-0 relative">
                        {(isFullAdmin || currentUser?.role === 'admin') && (
                          <div className="relative">
                            <button
                              type="button"
                              id={`btn-folder-menu-${folder.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenFolderMenuId(openFolderMenuId === folder.id ? null : folder.id);
                                setOpenFileMenuId(null);
                                setIsBreadcrumbMenuOpen(false);
                              }}
                              className="text-slate-400 hover:text-white hover:bg-slate-800 transition-colors p-1.5 rounded-lg cursor-pointer flex items-center justify-center min-h-[36px] min-w-[36px]"
                              title="Opções da Pasta"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openFolderMenuId === folder.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1.5 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-100 text-left"
                              >
                                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1 truncate">
                                  {folder.name}
                                </div>

                                {onRenameFolder && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenFolderMenuId(null);
                                      setRenamingFolder(folder);
                                      setNewFolderNameInput(folder.name);
                                      setFolderRenameError(null);
                                    }}
                                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-amber-950/40 hover:text-amber-300 flex items-center gap-2.5 transition-colors cursor-pointer group"
                                  >
                                    <div className="p-1 rounded-lg bg-amber-900/50 text-amber-300 group-hover:scale-105 transition-transform">
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                      <div className="font-bold">Renomear Pasta</div>
                                      <div className="text-[10px] text-slate-400 font-normal">Alterar o nome da pasta</div>
                                    </div>
                                  </button>
                                )}

                                {isFullAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenFolderMenuId(null);
                                      handleOpenPermsModal(folder);
                                    }}
                                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-blue-950/40 hover:text-blue-300 flex items-center gap-2.5 transition-colors cursor-pointer group mt-0.5"
                                  >
                                    <div className="p-1 rounded-lg bg-blue-900/50 text-blue-300 group-hover:scale-105 transition-transform">
                                      <ShieldCheck className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                      <div className="font-bold">Permissões de Acesso</div>
                                      <div className="text-[10px] text-slate-400 font-normal">Definir quem pode acessar</div>
                                    </div>
                                  </button>
                                )}

                                {currentUser.role === 'admin' && onDeleteFolder && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenFolderMenuId(null);
                                      onDeleteFolder(folder.id);
                                    }}
                                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/40 flex items-center gap-2.5 transition-colors cursor-pointer group mt-1 pt-1.5 border-t border-slate-800"
                                  >
                                    <div className="p-1 rounded-lg bg-rose-900/50 text-rose-400 group-hover:scale-105 transition-transform">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                      <div className="font-bold">Excluir Pasta</div>
                                      <div className="text-[10px] text-rose-400/80 font-normal">Remover esta pasta</div>
                                    </div>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#DFB76C] group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>

                    {/* Nome da pasta e Quantidade de arquivos (Item 5) */}
                    <div className="min-w-0 w-full mt-auto">
                      <h4 
                        className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-[#DFB76C] transition-colors break-words line-clamp-2 leading-snug"
                        title={folder.name}
                      >
                        {folder.name}
                      </h4>
                      <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                        {folderFilesCount === 1 ? '1 arquivo' : `${folderFilesCount} arquivos`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Modo Lista */
            <div className="flex flex-col gap-2 w-full">
              {visibleFolders.map(folder => {
                const folderFilesCount = files.filter(f => f.folder_id === folder.id).length;
                return (
                  <div
                    key={folder.id}
                    onClick={() => setCurrentFolderId(folder.id)}
                    className="bg-[#091124] border border-slate-800 hover:border-[#DFB76C]/60 text-slate-100 rounded-2xl p-3 sm:p-4 shadow-xs hover:shadow-md transition-all flex items-center justify-between group cursor-pointer min-w-0 gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#DFB76C]/15 text-[#DFB76C] border border-[#DFB76C]/25 group-hover:bg-[#DFB76C] group-hover:text-slate-950 transition-all flex items-center justify-center font-bold shrink-0 shadow-2xs">
                        <FolderIcon className="w-5 h-5 text-[#DFB76C] group-hover:text-slate-950 transition-colors" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-[#DFB76C] transition-colors truncate">
                          {folder.name}
                        </h4>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {folderFilesCount === 1 ? '1 arquivo' : `${folderFilesCount} arquivos`} • {folder.sector}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#DFB76C] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                  className="bg-white dark:bg-[#0c1527] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-4 sm:p-4.5 flex flex-col justify-between group relative min-w-0"
                >
                  <div>
                    {/* Top Bar: File Icon & Status Badge */}
                    <div className="flex items-start justify-between">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-transform duration-200 group-hover:scale-105 ${
                        isPdf ? 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
                        isImage ? 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
                        (isSpreadsheet || isXml) ? 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                        isPfx ? 'bg-purple-500/10 dark:bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/20' :
                        isZip ? 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                        'bg-slate-500/10 dark:bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/20'
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
                        <span className="bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60 text-[10px] font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <KeyRound className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          <span>Certificado</span>
                        </span>
                      ) : file.compression_ratio > 0 ? (
                        <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 text-[10px] font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1 font-mono">
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>-{file.compression_ratio}%</span>
                        </span>
                      ) : (
                        <span className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 text-[10px] font-medium px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>Íntegro</span>
                        </span>
                      )}
                    </div>

                    {/* File Title & Sector/Folder */}
                    <div className="min-w-0">
                      <h4 
                        onClick={() => onOpenFileViewer(file)}
                        className="text-[13px] font-bold text-slate-900 dark:text-slate-100 break-words group-hover:text-blue-600 dark:group-hover:text-[#E2C37A] transition-colors mt-3 cursor-pointer leading-snug line-clamp-2" 
                        title={file.name}
                      >
                        {file.name}
                      </h4>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 min-w-0 truncate mt-1.5">
                        <FolderIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">{file.sector}</span>
                        {file.pages_count && file.pages_count > 1 && (
                          <span className="text-slate-400 dark:text-slate-500 shrink-0">· {file.pages_count} págs</span>
                        )}
                        {file.tags && file.tags.find(t => t.startsWith('Ref: ')) && (
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] px-1.5 py-0.2 rounded font-mono font-medium border border-slate-200 dark:border-slate-700 ml-1 shrink-0">
                            {file.tags.find(t => t.startsWith('Ref: '))}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      {new Date(file.created_at).toLocaleDateString('pt-BR')}
                    </span>

                    <div className="flex items-center space-x-1.5 relative">
                      <button
                        type="button"
                        onClick={() => onOpenFileViewer(file)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-[#E2C37A] bg-slate-100/70 dark:bg-slate-800/70 hover:bg-slate-200/70 dark:hover:bg-slate-750 border border-slate-200/80 dark:border-slate-700/80 transition-all cursor-pointer shadow-2xs"
                        title="Visualizar documento"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Visualizar</span>
                      </button>

                      <div className="relative">
                        <button
                          type="button"
                          id={`btn-file-menu-${file.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenFileMenuId(openFileMenuId === file.id ? null : file.id);
                            setOpenFolderMenuId(null);
                            setIsBreadcrumbMenuOpen(false);
                          }}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 bg-slate-100/70 dark:bg-slate-800/70 hover:bg-slate-200/70 dark:hover:bg-slate-750 border border-slate-200/80 dark:border-slate-700/80 transition-all cursor-pointer flex items-center justify-center shadow-2xs"
                          title="Opções do documento"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openFileMenuId === file.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 bottom-full mb-1.5 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-100 text-left"
                          >
                            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 mb-1 truncate">
                              {file.name}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenFileMenuId(null);
                                onOpenFileViewer(file);
                              }}
                              className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-2.5 transition-colors cursor-pointer group"
                            >
                              <div className="p-1 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 group-hover:scale-105 transition-transform">
                                <Eye className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <div className="font-bold">Visualizar Documento</div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Abrir pré-visualização</div>
                              </div>
                            </button>

                            {canShare && (
                              <button
                                type="button"
                                disabled={!!sharingFileId}
                                onClick={() => {
                                  setOpenFileMenuId(null);
                                  handleShareDirectDocument(file);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-2.5 transition-colors cursor-pointer group mt-0.5 disabled:opacity-50"
                              >
                                <div className="p-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 group-hover:scale-105 transition-transform">
                                  {sharingFileId === file.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />}
                                </div>
                                <div>
                                  <div className="font-bold">Enviar via WhatsApp</div>
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Partilha e envio direto</div>
                                </div>
                              </button>
                            )}

                            {canDownload && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenFileMenuId(null);
                                  handleDirectDownload(file);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer group mt-0.5"
                              >
                                <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 group-hover:scale-105 transition-transform">
                                  <Download className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <div className="font-bold">Baixar Arquivo</div>
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Download seguro do R2</div>
                                </div>
                              </button>
                            )}

                            {(currentUser.role === 'admin' || currentUser.role === 'editor') && onRenameFile && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenFileMenuId(null);
                                  setRenamingFile(file);
                                  setNewNameInput(file.name);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-2.5 transition-colors cursor-pointer group mt-0.5"
                              >
                                <div className="p-1 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 group-hover:scale-105 transition-transform">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <div className="font-bold">Renomear Arquivo</div>
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Alterar nome do arquivo</div>
                                </div>
                              </button>
                            )}

                            {currentUser.role === 'admin' && onDeleteFile && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenFileMenuId(null);
                                  onDeleteFile(file.id);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 transition-colors cursor-pointer group mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-800"
                              >
                                <div className="p-1 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <div className="font-bold">Excluir Arquivo</div>
                                  <div className="text-[10px] text-rose-400/80 dark:text-rose-500/80 font-normal">Remover documento</div>
                                </div>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
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
                        <div className="flex items-center justify-end space-x-1 relative">
                          <button
                            type="button"
                            onClick={() => onOpenFileViewer(file)}
                            className="p-1.5 text-slate-500 hover:text-[#1B357B] dark:hover:text-[#E2C37A] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="Visualizar documento"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <div className="relative">
                            <button
                              type="button"
                              id={`btn-table-file-menu-${file.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenFileMenuId(openFileMenuId === file.id ? null : file.id);
                                setOpenFolderMenuId(null);
                                setIsBreadcrumbMenuOpen(false);
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Opções do arquivo"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openFileMenuId === file.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 bottom-full mb-1.5 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-left"
                              >
                                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 mb-1 truncate">
                                  {file.name}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenFileMenuId(null);
                                    onOpenFileViewer(file);
                                  }}
                                  className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-2.5 transition-colors cursor-pointer group"
                                >
                                  <div className="p-1 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 group-hover:scale-105 transition-transform">
                                    <Eye className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <div className="font-bold">Visualizar Documento</div>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Abrir pré-visualização</div>
                                  </div>
                                </button>

                                {canShare && (
                                  <button
                                    type="button"
                                    disabled={!!sharingFileId}
                                    onClick={() => {
                                      setOpenFileMenuId(null);
                                      handleShareDirectDocument(file);
                                    }}
                                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-2.5 transition-colors cursor-pointer group mt-0.5 disabled:opacity-50"
                                  >
                                    <div className="p-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 group-hover:scale-105 transition-transform">
                                      {sharingFileId === file.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />}
                                    </div>
                                    <div>
                                      <div className="font-bold">Enviar via WhatsApp</div>
                                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Partilha e envio direto</div>
                                    </div>
                                  </button>
                                )}

                                {canDownload && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenFileMenuId(null);
                                      handleDirectDownload(file);
                                    }}
                                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer group mt-0.5"
                                  >
                                    <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 group-hover:scale-105 transition-transform">
                                      <Download className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                      <div className="font-bold">Baixar Arquivo</div>
                                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Download seguro do R2</div>
                                    </div>
                                  </button>
                                )}

                                {(currentUser.role === 'admin' || currentUser.role === 'editor') && onRenameFile && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenFileMenuId(null);
                                      setRenamingFile(file);
                                      setNewNameInput(file.name);
                                    }}
                                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-2.5 transition-colors cursor-pointer group mt-0.5"
                                  >
                                    <div className="p-1 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 group-hover:scale-105 transition-transform">
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                      <div className="font-bold">Renomear Arquivo</div>
                                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Alterar nome do arquivo</div>
                                    </div>
                                  </button>
                                )}

                                {currentUser.role === 'admin' && onDeleteFile && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenFileMenuId(null);
                                      onDeleteFile(file.id);
                                    }}
                                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 transition-colors cursor-pointer group mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-800"
                                  >
                                    <div className="p-1 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                      <div className="font-bold">Excluir Arquivo</div>
                                      <div className="text-[10px] text-rose-400/80 dark:text-rose-500/80 font-normal">Remover permanentemente</div>
                                    </div>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
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

      {/* Rename Folder Modal (Administrador) */}
      {renamingFolder && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingFolderRename) {
              setRenamingFolder(null);
              setFolderRenameError(null);
            }
          }}
        >
          <div 
            className="bg-white dark:bg-slate-900 w-[94%] max-w-md mx-auto rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-200/80 dark:border-amber-800/80 shadow-2xs">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-slate-900 dark:text-slate-100 font-bold text-sm sm:text-base leading-tight">
                    Editar Nome da Pasta
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Setor: <span className="font-semibold text-slate-700 dark:text-slate-300">{renamingFolder.sector}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSubmittingFolderRename) {
                    setRenamingFolder(null);
                    setFolderRenameError(null);
                  }
                }}
                disabled={isSubmittingFolderRename}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {folderRenameError && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-medium">{folderRenameError}</span>
              </div>
            )}

            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome Atual
                </label>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-400 font-medium truncate flex items-center space-x-2">
                  <FolderIcon className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{renamingFolder.name}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Novo Nome da Pasta
                </label>
                <input
                  type="text"
                  value={newFolderNameInput}
                  onChange={(e) => {
                    setNewFolderNameInput(e.target.value);
                    if (folderRenameError) setFolderRenameError(null);
                  }}
                  placeholder="Digite o novo nome da pasta..."
                  disabled={isSubmittingFolderRename}
                  className="w-full h-10 px-3 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:border-[#1B357B] dark:focus:border-amber-400 focus:ring-2 focus:ring-[#1B357B]/20 outline-none transition-all font-semibold placeholder:text-slate-400"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmRenameFolder();
                    } else if (e.key === 'Escape') {
                      if (!isSubmittingFolderRename) {
                        setRenamingFolder(null);
                        setFolderRenameError(null);
                      }
                    }
                  }}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isSubmittingFolderRename}
                onClick={() => {
                  setRenamingFolder(null);
                  setFolderRenameError(null);
                }}
                className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-rename-folder"
                disabled={isSubmittingFolderRename || !newFolderNameInput.trim() || newFolderNameInput.trim() === renamingFolder.name}
                onClick={handleConfirmRenameFolder}
                className="px-4 py-2 bg-[#1B357B] hover:bg-[#14285D] dark:bg-amber-600 dark:hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs flex items-center space-x-1.5"
              >
                {isSubmittingFolderRename ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvar Alteração</span>
                  </>
                )}
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
      {/* 6. BOTÃO DE AÇÃO FLUTUANTE DOURADO MOBILE (Item 6) */}
      <div className="lg:hidden">
        {/* Backdrop suave para fechar ao tocar fora */}
        {isFabOpen && (
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-2xs z-35 animate-in fade-in duration-150"
            onClick={() => setIsFabOpen(false)}
          />
        )}

        <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2.5">
          {/* Pílulas empilhadas acima do botão */}
          {isFabOpen && (
            <div className="flex flex-col items-end gap-2.5 animate-in slide-in-from-bottom-3 duration-200">
              {/* Opção Upload */}
              {canUpload && (
                <button
                  type="button"
                  onClick={() => {
                    setIsFabOpen(false);
                    onOpenUploadModal(currentFolderId);
                  }}
                  className="min-h-[44px] px-4 py-2.5 rounded-full bg-[#091124] border border-[#DFB76C]/60 text-white font-bold text-xs shadow-2xl flex items-center gap-2.5 hover:bg-[#1B357B] active:scale-95 transition-all cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-full bg-[#DFB76C] text-slate-950 flex items-center justify-center font-bold">
                    <UploadCloud className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span className="whitespace-nowrap">Upload de Documento</span>
                </button>
              )}

              {/* Opção Nova Pasta */}
              {canCreateSubfolder && (
                <button
                  type="button"
                  onClick={() => {
                    setIsFabOpen(false);
                    setIsCreatingFolder(true);
                  }}
                  className="min-h-[44px] px-4 py-2.5 rounded-full bg-[#091124] border border-[#DFB76C]/60 text-white font-bold text-xs shadow-2xl flex items-center gap-2.5 hover:bg-[#1B357B] active:scale-95 transition-all cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-full bg-[#DFB76C] text-slate-950 flex items-center justify-center font-bold">
                    <FolderPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span className="whitespace-nowrap">Nova Pasta</span>
                </button>
              )}
            </div>
          )}

          {/* Botão Dourado Principal + que vira × */}
          <button
            type="button"
            id="mobile-fab-action-btn"
            onClick={() => setIsFabOpen(!isFabOpen)}
            className="w-13 h-13 min-w-[52px] min-h-[52px] rounded-full bg-gradient-to-r from-[#DFB76C] to-[#C59B4B] text-slate-950 shadow-2xl flex items-center justify-center font-black cursor-pointer active:scale-95 transition-all border-2 border-amber-300"
            title="Ações (Nova Pasta, Upload)"
            aria-label="Ações rápidas"
          >
            {isFabOpen ? (
              <X className="w-6 h-6 stroke-[2.5]" />
            ) : (
              <Plus className="w-6 h-6 stroke-[3]" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
