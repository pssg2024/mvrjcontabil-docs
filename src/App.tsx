import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { AdminPanel } from './components/AdminPanel';
import { FileManager } from './components/FileManager';
import { FileUploadModal } from './components/FileUploadModal';
import { PdfViewerModal } from './components/PdfViewerModal';
import { SqlSchemaViewerModal } from './components/SqlSchemaViewerModal';
import { ProfileModal } from './components/ProfileModal';
import { FirstAccessModal } from './components/FirstAccessModal';
import { LgpdTermsModal } from './components/LgpdTermsModal';
import { BackgroundModal } from './components/BackgroundModal';
import { PasswordConfirmModal } from './components/PasswordConfirmModal';
import { CompanyConsultModal } from './components/CompanyConsultModal';
import { CompanyManagerModal } from './components/CompanyManagerModal';
import { InvoiceEmissionView } from './components/InvoiceEmissionView';
import { UserManualModal } from './components/UserManualModal';
import { ShieldCheck } from 'lucide-react';
import { 
  UserProfile, 
  UserRole, 
  UserStatus, 
  Folder, 
  DocumentFile, 
  FolderPermission, 
  PermissionLevel, 
  AuditLog, 
  Sector,
  StorageMetrics,
  SiteBackgroundConfig,
  AuthHeaderConfig
} from './types';
import { 
  INITIAL_PROFILES, 
  INITIAL_FOLDERS, 
  INITIAL_FILES, 
  INITIAL_FOLDER_PERMISSIONS, 
  INITIAL_AUDIT_LOGS 
} from './lib/mock-data';
import { 
  getSiteBackgroundConfig, 
  getAuthHeaderConfig, 
  DEFAULT_AUTH_HEADER_CONFIG,
  fetchFoldersFromApi,
  fetchFilesFromApi,
  fetchAuditLogsFromApi,
  fetchFolderPermissionsFromApi,
  createFolderInApi,
  updateFolderInApi,
  deleteFolderInApi,
  deleteFileInApi,
  updateFileInApi,
  saveAuditLogInApi,
  saveFolderPermissionToApi,
  fetchSystemStatusFromApi,
  fetchProfilesFromApi
} from './lib/storage-service';
import { getSupabase } from './lib/supabase';

export default function App() {
  // Profiles & Auth State (Prioritizing Evandro as Master Administrator)
  const [profiles, setProfiles] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem('mvrj_profiles');
    let loaded: UserProfile[] = saved ? JSON.parse(saved) : [];
    
    // Merge with INITIAL_PROFILES if missing
    INITIAL_PROFILES.forEach(ip => {
      if (!loaded.find(p => p.id === ip.id || p.email.toLowerCase() === ip.email.toLowerCase())) {
        loaded.push(ip);
      }
    });
    
    // Assegura que evandro230655@gmail.com e evandro132213@gmail.com sempre existem como Administradores ativos
    const evandroExists1 = loaded.find(p => p.email.toLowerCase() === 'evandro230655@gmail.com');
    if (!evandroExists1) {
      loaded.push({
        id: '57e1d483-669b-4791-b09e-7496570e63ea',
        email: 'evandro230655@gmail.com',
        full_name: 'Evandro (Administrador Geral)',
        sector: 'Diretoria',
        role: 'admin',
        status: 'active',
        avatar_url: '/api/r2/avatar/57e1d483-669b-4791-b09e-7496570e63ea.webp',
        first_access_completed: false,
        created_at: '2026-01-01T08:00:00Z',
        updated_at: '2026-01-01T08:00:00Z',
      });
    }
    const evandroExists2 = loaded.find(p => p.email.toLowerCase() === 'evandro132213@gmail.com');
    if (!evandroExists2) {
      loaded.push({
        id: 'usr-evandro132213',
        email: 'evandro132213@gmail.com',
        full_name: 'Evandro (Administrador Geral)',
        sector: 'Diretoria',
        role: 'admin',
        status: 'active',
        avatar_url: '/api/r2/avatar/usr-evandro132213.webp',
        first_access_completed: false,
        created_at: '2026-01-01T08:00:00Z',
        updated_at: '2026-01-01T08:00:00Z',
      });
    }
    
    loaded = loaded.map(p => {
      const email = p.email.toLowerCase();
      if (email === 'evandro230655@gmail.com' || email === 'evandro132213@gmail.com') {
        return { ...p, role: 'admin', status: 'active' };
      }
      return p;
    });
    
    return loaded;
  });

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const sessionToken = sessionStorage.getItem('mvrj_session_token') || localStorage.getItem('mvrj_session_token');
      const savedUserStr = sessionStorage.getItem('mvrj_session_user') || localStorage.getItem('mvrj_session_user');
      if (sessionToken && savedUserStr) {
        const parsed = JSON.parse(savedUserStr) as UserProfile;
        // Check if user is active (not pending or blocked or rejected)
        if (parsed && (parsed.status === 'active' || parsed.status === 'approved')) {
          if (!parsed.avatar_url) {
            try {
              const savedProfiles = localStorage.getItem('mvrj_profiles');
              if (savedProfiles) {
                const plist = JSON.parse(savedProfiles) as UserProfile[];
                const match = plist.find(p => p.id === parsed.id || p.email.toLowerCase() === parsed.email.toLowerCase());
                if (match && match.avatar_url) {
                  parsed.avatar_url = match.avatar_url;
                }
              }
            } catch {}
          }
          return parsed;
        }
      }
    } catch {}
    // Mandatory: No automatic login or default mock user
    return null;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(() => {
    const sessionToken = sessionStorage.getItem('mvrj_session_token') || localStorage.getItem('mvrj_session_token');
    return !sessionToken;
  });

  const [uploadTargetFolderId, setUploadTargetFolderId] = useState<string | null>(null);

  // Data State
  const [folders, setFolders] = useState<Folder[]>([]);

  const [files, setFiles] = useState<DocumentFile[]>([]);

  const [folderPermissions, setFolderPermissions] = useState<FolderPermission[]>([]);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Track timestamp of recent folder operations to prevent sync race conditions
  const lastFolderActionRef = useRef<number>(0);

  // Navigation & Modals
  const [activeView, setActiveView] = useState<'drive' | 'admin'>('drive');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'security'>('profile');
  const [isFirstAccessModalOpen, setIsFirstAccessModalOpen] = useState(false);
  const [isLgpdModalOpen, setIsLgpdModalOpen] = useState(false);
  const [isBackgroundModalOpen, setIsBackgroundModalOpen] = useState(false);
  const [backgroundModalTab, setBackgroundModalTab] = useState<'site-background' | 'auth-header'>('site-background');
  const [viewingFile, setViewingFile] = useState<DocumentFile | null>(null);

  // Standard Theme Setup
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    try {
      localStorage.removeItem('ged-theme-mode');
    } catch {}
  }, []);

  // CNPJ & Company Consultation Modal State
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isCompanyManagerOpen, setIsCompanyManagerOpen] = useState(false);
  const [isInvoiceEmissionOpen, setIsInvoiceEmissionOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [driveFilterSearch, setDriveFilterSearch] = useState('');



  const handleUpdateFile = async (fileId: string, updates: Partial<DocumentFile>) => {
    // 1. Atualização otimista no estado local
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, ...updates, updated_at: new Date().toISOString() } : f));

    // 2. Persistência no backend e Supabase
    try {
      await updateFileInApi(fileId, updates);
    } catch (err: any) {
      console.warn('Erro ao atualizar metadados do arquivo:', err);
    }
  };

  const handleOpenCompanyModal = (initialQuery?: string) => {
    setCompanySearchQuery(initialQuery || '');
    setIsCompanyModalOpen(true);
  };

  const handleFilterGedByCompany = (searchTerm: string) => {
    setDriveFilterSearch(searchTerm);
    setActiveView('drive');
  };

  // Site Background Configuration State (Admin-customizable)
  const [siteBackgroundConfig, setSiteBackgroundConfig] = useState<SiteBackgroundConfig>(() => {
    const saved = localStorage.getItem('mvrj_background_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      enabled: false,
      imageUrl: '',
      presetId: 'none',
      opacity: 25,
      blur: 0,
      overlayType: 'light',
      overlayOpacity: 40,
      position: 'cover',
    };
  });

  // Login Card Header Configuration State (Admin-customizable)
  const [authHeaderConfig, setAuthHeaderConfig] = useState<AuthHeaderConfig>(() => {
    const saved = localStorage.getItem('mvrj_auth_header_config');
    if (saved) {
      try {
        return { ...DEFAULT_AUTH_HEADER_CONFIG, ...JSON.parse(saved) };
      } catch {}
    }
    return DEFAULT_AUTH_HEADER_CONFIG;
  });

  const handleOpenProfileModal = (tab: 'profile' | 'security' = 'profile') => {
    setProfileModalTab(tab);
    setIsProfileModalOpen(true);
  };

  // Cloudflare R2 Status from Backend
  const [r2Status, setR2Status] = useState<{ isConfigured: boolean; bucketName: string; mode: string }>({
    isConfigured: false,
    bucketName: 'mvrjcontabil-ged',
    mode: 'SECURE_SANDBOX_SIMULATION',
  });

  // Real-time Storage Usage Metrics (Used vs. Free)
  const [storageMetrics, setStorageMetrics] = useState<StorageMetrics | null>(null);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<{
    type: 'file' | 'folder' | 'user';
    id: string;
    name?: string;
    action: () => void;
  } | null>(null);

  const fetchStorageMetrics = useCallback(() => {
    fetch(`/api/storage/metrics?t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setStorageMetrics(data);
        }
      })
      .catch(err => console.log('Storage metrics fetch err:', err));
  }, []);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('mvrj_profiles', JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem('mvrj_folders', JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    localStorage.setItem('mvrj_files', JSON.stringify(files));
  }, [files]);

  useEffect(() => {
    localStorage.setItem('mvrj_folder_perms', JSON.stringify(folderPermissions));
  }, [folderPermissions]);

  useEffect(() => {
    localStorage.setItem('mvrj_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('mvrj_background_config', JSON.stringify(siteBackgroundConfig));
  }, [siteBackgroundConfig]);

  useEffect(() => {
    localStorage.setItem('mvrj_auth_header_config', JSON.stringify(authHeaderConfig));
  }, [authHeaderConfig]);

  // Fetch backend R2 status and real-time storage metrics on load
  useEffect(() => {
    fetch('/api/r2/status')
      .then(res => res.json())
      .then(data => {
        if (data) setR2Status(data);
      })
      .catch(err => console.log('Backend status check:', err));

    // Fetch site background customization from server (only update if actually changed)
    getSiteBackgroundConfig()
      .then(bgConfig => {
        if (bgConfig) {
          setSiteBackgroundConfig(prev => {
            if (
              prev.enabled === bgConfig.enabled &&
              prev.imageUrl === bgConfig.imageUrl &&
              prev.opacity === bgConfig.opacity &&
              prev.blur === bgConfig.blur &&
              prev.overlayType === bgConfig.overlayType &&
              prev.overlayOpacity === bgConfig.overlayOpacity &&
              prev.position === bgConfig.position
            ) {
              return prev;
            }
            return bgConfig;
          });
        }
      })
      .catch(err => console.log('Erro ao carregar fundo do site:', err));

    // Fetch auth modal header customization from server (only update if actually changed)
    getAuthHeaderConfig()
      .then(authConfig => {
        if (authConfig) {
          setAuthHeaderConfig(prev => {
            if (
              prev.gradientPreset === authConfig.gradientPreset &&
              prev.logoType === authConfig.logoType &&
              prev.logoImageUrl === authConfig.logoImageUrl &&
              prev.iconName === authConfig.iconName &&
              prev.showIcon === authConfig.showIcon &&
              prev.showTitle === authConfig.showTitle &&
              prev.showSubtitle === authConfig.showSubtitle
            ) {
              return prev;
            }
            return authConfig;
          });
        }
      })
      .catch(err => console.log('Erro ao carregar cabeçalho de login:', err));

    // Background sync to keep folders, files and profiles in sync in real time across all devices and tabs
    let isSyncing = false;
    const syncData = async () => {
      if (isSyncing) return;
      isSyncing = true;
      try {
        const [apiFolders, apiFiles] = await Promise.all([
          fetchFoldersFromApi().catch(() => null),
          fetchFilesFromApi().catch(() => null),
        ]);

        if (apiFolders && Array.isArray(apiFolders)) {
          setFolders(prev => {
            const prevIds = new Set(prev.map(p => p.id));
            const apiIds = new Set(apiFolders.map(p => p.id));
            const hasDifferences = prev.length !== apiFolders.length || 
              apiFolders.some(f => !prevIds.has(f.id)) || 
              prev.some(f => !apiIds.has(f.id)) ||
              prev.some((f, idx) => f.name !== apiFolders[idx]?.name || f.parent_id !== apiFolders[idx]?.parent_id);
            if (hasDifferences) {
              return apiFolders;
            }
            return prev;
          });
          try {
            localStorage.setItem('mvrj_folders', JSON.stringify(apiFolders));
          } catch {}
        }

        if (apiFiles && Array.isArray(apiFiles)) {
          setFiles(prev => {
            const prevIds = new Set(prev.map(p => p.id));
            const apiIds = new Set(apiFiles.map(p => p.id));
            const hasDifferences = prev.length !== apiFiles.length || 
              apiFiles.some(f => !prevIds.has(f.id)) || 
              prev.some(f => !apiIds.has(f.id)) ||
              prev.some((f, idx) => f.updated_at !== apiFiles[idx]?.updated_at || f.name !== apiFiles[idx]?.name || f.folder_id !== apiFiles[idx]?.folder_id);
            if (hasDifferences) {
              return apiFiles;
            }
            return prev;
          });
          try {
            localStorage.setItem('mvrj_files', JSON.stringify(apiFiles));
          } catch {}
        }
      } finally {
        isSyncing = false;
      }
    };

    // BroadcastChannel for instant cross-tab sync in the browser
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('mvrj_realtime_sync');
        bc.onmessage = (event) => {
          if (event.data?.type === 'SYNC_ALL' || event.data?.type === 'SYNC_FILES') {
            syncData();
            fetchStorageMetrics();
          }
        };
      }
    } catch {}

    // Profiles sync from API with proper JSON and status validation
    const syncProfiles = async () => {
      try {
        const res = await fetch('/api/profiles');
        if (!res.ok) return;
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return;

        const data = await res.json();
        if (data && Array.isArray(data.profiles)) {
          setProfiles(data.profiles);

          setCurrentUser(prevUser => {
            if (!prevUser) return prevUser;
            const match = data.profiles.find((p: UserProfile) => 
              p.email.toLowerCase() === prevUser.email.toLowerCase() || p.id === prevUser.id
            );
            if (match) {
              // Se o status do usuário não for 'active' ou 'approved', bloquear acesso imediatamente
              if (match.status !== 'active' && match.status !== 'approved') {
                try {
                  sessionStorage.removeItem('mvrj_session_user');
                  sessionStorage.removeItem('mvrj_session_token');
                  localStorage.removeItem('mvrj_session_user');
                  localStorage.removeItem('mvrj_session_token');
                } catch {}
                setIsAuthModalOpen(true);
                return null;
              }

              const resolvedAvatar = match.avatar_url || prevUser.avatar_url;

              // Se nenhum atributo relevante mudou, manter a mesma referência para evitar re-renderizações desnecessárias
              if (
                match.id === prevUser.id &&
                match.full_name === prevUser.full_name &&
                match.role === prevUser.role &&
                match.status === prevUser.status &&
                match.sector === prevUser.sector &&
                resolvedAvatar === prevUser.avatar_url
              ) {
                return prevUser;
              }

              const updated: UserProfile = {
                ...prevUser,
                id: match.id || prevUser.id,
                full_name: match.full_name || prevUser.full_name,
                role: match.role || prevUser.role,
                status: match.status || prevUser.status,
                sector: match.sector || prevUser.sector,
                avatar_url: resolvedAvatar,
              };
              if (resolvedAvatar !== prevUser.avatar_url || match.full_name !== prevUser.full_name || match.role !== prevUser.role) {
                try {
                  sessionStorage.setItem('mvrj_session_user', JSON.stringify(updated));
                  localStorage.setItem('mvrj_session_user', JSON.stringify(updated));
                } catch {}
              }
              return updated;
            }
            return prevUser;
          });
        }
      } catch (err) {
        // Silencioso para não poluir o console com erros de rede transitórios
      }
    };

    // Initial load
    fetchFoldersFromApi().then(apiFolders => {
      if (apiFolders && Array.isArray(apiFolders)) {
        setFolders(apiFolders);
      }
    }).catch(() => {});

    fetchFilesFromApi().then(apiFiles => {
      if (apiFiles && Array.isArray(apiFiles)) {
        setFiles(apiFiles);
      }
    }).catch(() => {});

    fetchAuditLogsFromApi().then(apiLogs => {
      if (apiLogs && apiLogs.length > 0) setAuditLogs(apiLogs);
    }).catch(() => {});

    fetchFolderPermissionsFromApi().then(apiPerms => {
      if (apiPerms && apiPerms.length > 0) setFolderPermissions(apiPerms);
    }).catch(() => {});

    fetchStorageMetrics();
    syncProfiles();

    // Intervals otimizados para tempo real (polling de 2.5s garante atualização rápida entre dispositivos)
    const syncInterval = setInterval(syncData, 2500);
    const profilesInterval = setInterval(syncProfiles, 6000);
    const metricsInterval = setInterval(fetchStorageMetrics, 5000);

    // Canal global de sincronização do GED
    const supabaseClient = getSupabase();
    const gedSyncChannel = supabaseClient
      ?.channel('ged-database-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'folders' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setFolders((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setFolders((prev) => prev.map((f) => f.id === payload.new.id ? payload.new : f));
          } else if (payload.eventType === 'DELETE') {
            // Some imediatamente da tela de todos os usuários
            setFolders((prev) => prev.filter((f) => f.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setFiles((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setFiles((prev) => prev.map((d) => d.id === payload.new.id ? payload.new : d));
          } else if (payload.eventType === 'DELETE') {
            // Some imediatamente da tela de todos os usuários
            setFiles((prev) => prev.filter((d) => d.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(syncInterval);
      clearInterval(profilesInterval);
      clearInterval(metricsInterval);
      if (bc) {
        try { bc.close(); } catch {}
      }
      if (gedSyncChannel) {
        supabaseClient?.removeChannel(gedSyncChannel);
      }
    };
  }, []);

  // Permission Checker (Mirrors PostgreSQL RLS function public.has_folder_permission)
  const checkFolderPermission = (folderId: string, minLevel: PermissionLevel): boolean => {
    if (!currentUser) return false;
    // Usuários com status 'active' ou 'approved' possuem acesso liberado
    if (currentUser.status !== 'active' && currentUser.status !== 'approved') return false;
    
    // Perfil Administrador / Diretoria: Acesso TOTAL irrestrito a todas as pastas e documentos
    const isFullAdmin = 
      currentUser.role === 'admin' || 
      (currentUser.role as string) === 'ADMIN' || 
      (currentUser as any).role === 'Diretoria' ||
      currentUser.sector === 'Diretoria' || 
      (currentUser as any).setor === 'Diretoria';

    if (isFullAdmin) return true;

    const folder = folders.find(f => f.id === folderId);
    if (!folder) return false;

    // Usuários Comuns (Fiscal, DP, Operacional, etc.):
    // Só podem visualizar e acessar as pastas para as quais receberam autorização expressa do Administrador.
    // Pastas não autorizadas ficam completamente ocultas da listagem e da busca para esses usuários.
    const isAllowed = Boolean(folder.allowed_user_ids?.includes(currentUser.id));
    if (!isAllowed) {
      return false;
    }

    // Se estiver em allowed_user_ids, tem permissão de visualização (viewer) garantida
    if (minLevel === 'viewer') return true;

    // Permissão explícita na matriz de permissões para níveis superiores (editor/admin)
    const explicit = folderPermissions.find(p => p.folder_id === folderId && p.profile_id === currentUser.id);
    if (explicit) {
      if (explicit.permission_level === 'none') return false;
      if (minLevel === 'editor' && (explicit.permission_level === 'editor' || explicit.permission_level === 'admin')) return true;
      if (minLevel === 'admin' && explicit.permission_level === 'admin') return true;
    }

    if (minLevel === 'editor' && currentUser.role === 'editor') return true;

    return false;
  };

  // Helper to log audit actions
  const logAudit = (
    action: AuditLog['action'],
    target_type: AuditLog['target_type'],
    target_id: string,
    details: Record<string, any>
  ) => {
    const newLog: AuditLog = {
      id: `audit-${Date.now()}`,
      action,
      target_type,
      target_id,
      details,
      profile_id: currentUser ? currentUser.id : 'anonymous',
      user_name: currentUser ? currentUser.full_name : 'Sistema',
      sector: currentUser ? currentUser.sector : 'Geral',
      ip_address: '187.55.210.4',
      created_at: new Date().toISOString(),
    };
    setAuditLogs(prev => [newLog, ...prev]);
    saveAuditLogInApi(newLog);
  };

  // Handlers for User Management
  // 1. Aprovar: atualiza status para 'approved' na tabela profiles
  const handleApproveUser = (userId: string, role: UserRole, sector?: Sector) => {
    const target = profiles.find(p => p.id === userId);
    const finalSector = sector || target?.sector || 'Fiscal';
    const updatedProfiles = profiles.map(p => p.id === userId ? { ...p, status: 'approved' as const, role, sector: finalSector } : p);
    setProfiles(updatedProfiles);
    localStorage.setItem('mvrj_profiles', JSON.stringify(updatedProfiles));

    logAudit('USER_APPROVED', 'USER', userId, {
      approved_name: target?.full_name,
      approved_email: target?.email,
      email: target?.email,
      assigned_role: role,
      assigned_sector: finalSector,
    });
    fetch(`/api/profiles/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: 'approved', 
        role, 
        sector: finalSector, 
        email: target?.email,
        full_name: target?.full_name 
      }),
    }).catch(err => console.warn('Aviso ao sincronizar aprovação com Supabase:', err));
  };

  // 1. Recusar: deleta da tabela profiles
  const handleRejectUser = async (userId: string) => {
    const target = profiles.find(p => p.id === userId);
    setProfiles(prev => prev.filter(p => p.id !== userId));
    logAudit('USER_REJECTED', 'USER', userId, { rejected_name: target?.full_name, rejected_email: target?.email });
    try {
      await fetch(`/api/profiles/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('Aviso ao excluir perfil recusado do Supabase:', err);
    }
  };

  // 2. Exclusão de Usuários da tabela profiles
  const handleDeleteUser = async (userId: string, userName?: string) => {
    const targetUser = profiles.find(p => p.id === userId);
    const targetEmail = targetUser?.email;
    const displayName = userName || targetUser?.full_name || targetEmail || userId;

    setPendingDeleteAction({
      type: 'user',
      id: userId,
      name: displayName,
      action: async () => {
        setProfiles(prev => prev.filter(p => p.id !== userId && (!targetEmail || p.email.toLowerCase() !== targetEmail.toLowerCase())));
        logAudit('USER_DELETED', 'USER', userId, { deleted_name: displayName, deleted_email: targetEmail });
        try {
          const deleteUrl = `/api/profiles/${encodeURIComponent(userId)}${targetEmail ? `?email=${encodeURIComponent(targetEmail)}` : ''}`;
          const res = await fetch(deleteUrl, {
            method: 'DELETE',
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok && data.error) {
            alert(`Erro ao excluir: ${data.error}`);
          }
          // Atualiza lista unificada de perfis do servidor
          const refreshRes = await fetch('/api/profiles');
          const refreshData = await refreshRes.json().catch(() => ({}));
          if (refreshData && Array.isArray(refreshData.profiles)) {
            setProfiles(refreshData.profiles);
          }
        } catch (err: any) {
          console.warn('Erro ao excluir usuário no Supabase:', err);
        }
      }
    });
  };

  const handleUpdateUserStatus = (userId: string, status: UserStatus) => {
    const target = profiles.find(p => p.id === userId);
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, status } : p));
    logAudit('USER_BLOCKED', 'USER', userId, { user_name: target?.full_name, new_status: status });
    fetch(`/api/profiles/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, email: target?.email }),
    }).catch(err => console.warn('Aviso ao sincronizar status com Supabase:', err));
  };

  const handleUpdateUserRole = (userId: string, role: UserRole) => {
    const target = profiles.find(p => p.id === userId);
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role } : p));
    logAudit('PERMISSION_CHANGE', 'USER', userId, { user_name: target?.full_name, new_role: role });
    fetch(`/api/profiles/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, email: target?.email }),
    }).catch(err => console.warn('Aviso ao sincronizar papel com Supabase:', err));
  };

  const handleUpdateFolderPermission = async (folderId: string, profileId: string, level: PermissionLevel | 'none') => {
    const targetUser = profiles.find(p => p.id === profileId);
    const targetFolder = folders.find(f => f.id === folderId);

    setFolderPermissions(prev => {
      const filtered = prev.filter(p => !(p.folder_id === folderId && p.profile_id === profileId));
      if (level === 'none') return filtered;
      return [
        ...filtered,
        {
          id: `perm-${Date.now()}-${Math.random()}`,
          folder_id: folderId,
          profile_id: profileId,
          permission_level: level,
          granted_by: currentUser?.id,
          created_at: new Date().toISOString(),
        },
      ];
    });

    // Sincronizar allowed_user_ids da pasta: se level for viewer, editor ou admin, usuário é autorizado. Se 'none', é removido.
    let updatedAllowedUserIds: string[] | undefined = undefined;
    if (targetFolder) {
      const currentAllowed = Array.isArray(targetFolder.allowed_user_ids) ? [...targetFolder.allowed_user_ids] : [];
      if (level === 'none') {
        updatedAllowedUserIds = currentAllowed.filter(id => id !== profileId);
      } else {
        if (!currentAllowed.includes(profileId)) {
          updatedAllowedUserIds = [...currentAllowed, profileId];
        } else {
          updatedAllowedUserIds = currentAllowed;
        }
      }

      setFolders(prev => prev.map(f => {
        if (f.id === folderId) {
          return { ...f, allowed_user_ids: updatedAllowedUserIds };
        }
        return f;
      }));

      // Atualiza também na API
      updateFolderInApi(folderId, { allowed_user_ids: updatedAllowedUserIds }).catch(err => {
        console.warn('Aviso ao sincronizar allowed_user_ids com a API:', err);
      });
    }

    if (level !== 'none') {
      try {
        await saveFolderPermissionToApi(folderId, profileId, level);
      } catch (e) {
        console.warn('Erro ao salvar permissão no Supabase:', e);
      }
    }

    logAudit('PERMISSION_CHANGE', 'PERMISSION', folderId, {
      folder: targetFolder?.name,
      user: targetUser?.full_name,
      level,
    });
    notifyBroadcastSync();
  };

  // Gerenciamento direto de usuários autorizados por pasta (allowed_user_ids)
  const handleUpdateFolderAllowedUsers = async (folderId: string, allowedUserIds: string[]) => {
    setFolders(prev => prev.map(f => {
      if (f.id === folderId) {
        return { ...f, allowed_user_ids: allowedUserIds };
      }
      return f;
    }));

    try {
      await updateFolderInApi(folderId, { allowed_user_ids: allowedUserIds });
    } catch (err) {
      console.warn('Erro ao atualizar allowed_user_ids na API:', err);
    }

    // Sincronizar permissões correspondentes em folderPermissions
    setFolderPermissions(prev => {
      const remaining = prev.filter(p => !(p.folder_id === folderId && !allowedUserIds.includes(p.profile_id)));
      const existingUserIds = new Set(remaining.filter(p => p.folder_id === folderId).map(p => p.profile_id));
      const newPerms: FolderPermission[] = allowedUserIds
        .filter(uid => !existingUserIds.has(uid))
        .map(uid => ({
          id: `perm-${Date.now()}-${Math.random()}`,
          folder_id: folderId,
          profile_id: uid,
          permission_level: 'viewer',
          granted_by: currentUser?.id,
          created_at: new Date().toISOString(),
        }));
      return [...remaining, ...newPerms];
    });

    const targetFolder = folders.find(f => f.id === folderId);
    logAudit('PERMISSION_CHANGE', 'FOLDER', folderId, {
      folder: targetFolder?.name,
      allowed_user_ids: allowedUserIds,
      authorized_count: allowedUserIds.length,
    });
    notifyBroadcastSync();
  };

  // Helper to notify other tabs immediately
  const notifyBroadcastSync = () => {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('mvrj_realtime_sync');
        bc.postMessage({ type: 'SYNC_ALL' });
        bc.close();
      }
    } catch {}
  };

  // Handlers for File & Folder Operations
  const handleUploadSuccess = (newDoc: DocumentFile) => {
    setFiles(prev => {
      const filtered = prev.filter(f => f.id !== newDoc.id && f.storage_key !== newDoc.storage_key);
      return [newDoc, ...filtered];
    });
    fetchStorageMetrics();
    fetchFilesFromApi().then(apiFiles => {
      if (apiFiles && apiFiles.length > 0) {
        setFiles(apiFiles);
      }
    });
    notifyBroadcastSync();
    logAudit('FILE_UPLOAD', 'FILE', newDoc.id, {
      name: newDoc.name,
      original_size: newDoc.original_size,
      optimized_size: newDoc.optimized_size,
      compression_ratio: `${newDoc.compression_ratio}%`,
      storage_key: newDoc.storage_key,
    });
  };

  const handleCreateFolder = async (name: string, parentId: string | null, sector: Sector, allowedUserIds?: string[]) => {
    lastFolderActionRef.current = Date.now();
    const folderId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `fold-${Date.now()}`;

    try {
      const created = await createFolderInApi(name, parentId, sector, currentUser?.id, folderId, allowedUserIds);
      lastFolderActionRef.current = Date.now();
      
      const newFolderItem: Folder = created && created.id ? created : {
        id: folderId,
        parent_id: parentId,
        name: name.trim(),
        sector,
        created_by: currentUser?.id || '57e1d483-669b-4791-b09e-7496570e63ea',
        allowed_user_ids: allowedUserIds,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setFolders(prev => {
        const updated = [...prev.filter(f => f.id !== newFolderItem.id && f.id !== folderId), newFolderItem];
        try {
          localStorage.setItem('mvrj_folders', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      notifyBroadcastSync();
      logAudit('FOLDER_CREATE', 'FOLDER', newFolderItem.id, { name, sector, parentId, allowed_user_ids: allowedUserIds });
      return newFolderItem;
    } catch (err: any) {
      console.error('[ERRO CRIAR PASTA]', err);
      throw err;
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    setPendingDeleteAction({
      type: 'file',
      id: fileId,
      name: file?.name || fileId,
      action: async () => {
        if (file) {
          logAudit('FILE_DELETE', 'FILE', fileId, { name: file.name, storage_key: file.storage_key });
        }
        
        // Optimistic update
        setFiles(prev => prev.filter(f => f.id !== fileId));
        
        try {
          await deleteFileInApi(fileId);
          fetchStorageMetrics();
          notifyBroadcastSync();
        } catch (err) {
          console.warn('Erro ao excluir no Supabase/R2:', err);
          // Refresh to sync state if failed
          const updatedFiles = await fetchFilesFromApi();
          setFiles(updatedFiles);
        }
      }
    });
  };

  const handleRenameFile = async (fileId: string, newName: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    let finalName = newName.trim();
    if (!finalName) return;

    // Se o arquivo original tinha extensão e o novo nome não tem, mantém de forma inteligente
    const dotIndex = file.name.lastIndexOf('.');
    if (dotIndex >= 0) {
      const ext = file.name.substring(dotIndex);
      if (ext && !finalName.toLowerCase().endsWith(ext.toLowerCase())) {
        finalName += ext;
      }
    }

    logAudit('FILE_RENAME', 'FILE', fileId, { old_name: file.name, new_name: finalName });

    // Atualização otimista
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, name: finalName, updated_at: new Date().toISOString() } : f));

    try {
      await updateFileInApi(fileId, { name: finalName });
      fetchStorageMetrics();
      notifyBroadcastSync();
    } catch (err: any) {
      console.error('Erro ao renomear arquivo:', err);
      alert('Erro ao renomear arquivo: ' + (err.message || 'Erro desconhecido'));
      const updatedFiles = await fetchFilesFromApi();
      setFiles(updatedFiles);
    }
  };

  // 3. Exclusão de Pastas pelo Admin com deleção no Supabase (DELETE /api/folders/:id)
  const handleDeleteFolder = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    setPendingDeleteAction({
      type: 'folder',
      id: folderId,
      name: folder?.name || folderId,
      action: async () => {
        lastFolderActionRef.current = Date.now();
        
        if (folder) {
          logAudit('FOLDER_DELETE', 'FOLDER', folderId, { name: folder.name });
        }

        // Optimistic update: remove folder and all associated files immediately
        setFolders(prev => prev.filter(f => f.id !== folderId && f.parent_id !== folderId));
        setFiles(prev => prev.filter(f => f.folder_id !== folderId));

        try {
          // 1. Excluir documentos da pasta no Supabase (se direto)
          const supabaseClient = getSupabase();
          if (supabaseClient) {
            try {
              await supabaseClient
                .from('files')
                .delete()
                .eq('folder_id', folderId);
            } catch {}
          }

          // 2. Excluir a pasta na API (que remove arquivos do R2, disco e Supabase em cascata)
          await deleteFolderInApi(folderId);
          
          fetchStorageMetrics();
          notifyBroadcastSync();

          const [updatedFolders, updatedFiles] = await Promise.all([
            fetchFoldersFromApi().catch(() => []),
            fetchFilesFromApi().catch(() => [])
          ]);
          setFolders(updatedFolders);
          setFiles(updatedFiles);
        } catch (err: any) {
          console.error('[ERRO EXCLUIR PASTA]', err);
          alert('Erro ao excluir pasta e seus documentos: ' + (err.message || 'Erro desconhecido'));
          
          // Refresh to sync state if failed
          const updatedFolders = await fetchFoldersFromApi().catch(() => []);
          setFolders(updatedFolders);
          const updatedFiles = await fetchFilesFromApi().catch(() => []);
          setFiles(updatedFiles);
        }
      }
    });
  };

  const handleSwitchUser = (user: UserProfile) => {
    setCurrentUser(user);
    if (user.status !== 'active') {
      setIsAuthModalOpen(true);
    } else {
      setIsAuthModalOpen(false);
    }
  };

  const handleLogout = () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem('mvrj_session_token');
      localStorage.removeItem('mvrj_session_user');
      localStorage.removeItem('mvrj_current_user');
    } catch {}
    setCurrentUser(null);
    setActiveView('drive');
    setViewingFile(null);
    setIsUploadModalOpen(false);
    setUploadTargetFolderId(null);
    setIsProfileModalOpen(false);
    setIsFirstAccessModalOpen(false);
    setIsLgpdModalOpen(false);
    setIsBackgroundModalOpen(false);
    setIsAuthModalOpen(true);
  };

  const handleSaveProfile = (updatedData: { full_name: string; avatar_url?: string }) => {
    if (!currentUser) return;
    
    const updatedUser: UserProfile = {
      ...currentUser,
      full_name: updatedData.full_name,
      avatar_url: updatedData.avatar_url !== undefined ? updatedData.avatar_url : currentUser.avatar_url,
      updated_at: new Date().toISOString(),
    };

    setCurrentUser(updatedUser);
    try {
      sessionStorage.setItem('mvrj_session_user', JSON.stringify(updatedUser));
      localStorage.setItem('mvrj_session_user', JSON.stringify(updatedUser));
      localStorage.setItem('mvrj_current_user', JSON.stringify(updatedUser));
    } catch (e) {
      console.warn('Erro ao persistir sessão do usuário:', e);
    }

    setProfiles(prev => {
      const next = prev.map(p => (p.id === currentUser.id || p.email.toLowerCase() === currentUser.email.toLowerCase()) ? updatedUser : p);
      try {
        localStorage.setItem('mvrj_profiles', JSON.stringify(next));
      } catch {}
      return next;
    });
    
    logAudit('PROFILE_UPDATED', 'USER', currentUser.id, {
      full_name: updatedData.full_name,
      has_photo: !!updatedData.avatar_url,
    });
  };

  const handlePasswordChange = (newPassword: string) => {
    if (!currentUser || !currentUser.email) return;

    try {
      const stored = JSON.parse(localStorage.getItem('mvrj_passwords') || '{}');
      stored[currentUser.email.toLowerCase()] = newPassword;
      localStorage.setItem('mvrj_passwords', JSON.stringify(stored));
    } catch (err) {
      console.error('Erro ao registrar nova senha no perfil:', err);
    }

    const updatedUser: UserProfile = {
      ...currentUser,
      password_changed_at: new Date().toISOString(),
      first_access_completed: true,
    };

    setCurrentUser(updatedUser);
    setProfiles(prev => prev.map(p => (p.id === updatedUser.id || p.email.toLowerCase() === updatedUser.email.toLowerCase()) ? updatedUser : p));

    logAudit('PASSWORD_CHANGED', 'SECURITY', updatedUser.id, {
      source: 'PROFILE_OPTIONAL_TAB',
      changed_at: updatedUser.password_changed_at,
      user_email: updatedUser.email,
    });
  };

  const handleCompleteFirstAccess = async (updatedUser: UserProfile, newPassword?: string) => {
    // 1. Persistir nova senha segura no repositório de credenciais
    if (newPassword && updatedUser.email) {
      try {
        const stored = JSON.parse(localStorage.getItem('mvrj_passwords') || '{}');
        stored[updatedUser.email.toLowerCase()] = newPassword;
        localStorage.setItem('mvrj_passwords', JSON.stringify(stored));
      } catch (err) {
        console.error('Erro ao registrar nova senha:', err);
      }
    }

    // 2. Atualizar perfil em memória e localStorage
    setCurrentUser(updatedUser);
    try {
      sessionStorage.setItem('mvrj_session_user', JSON.stringify(updatedUser));
      localStorage.setItem('mvrj_session_user', JSON.stringify(updatedUser));
      localStorage.setItem('mvrj_current_user', JSON.stringify(updatedUser));
    } catch {}
    setProfiles(prev => prev.map(p => (p.id === updatedUser.id || p.email.toLowerCase() === updatedUser.email.toLowerCase()) ? updatedUser : p));
    setIsFirstAccessModalOpen(false);

    // 3. Registrar trilha imutável na auditoria do GED
    logAudit('PASSWORD_CHANGED', 'SECURITY', updatedUser.id, {
      reason: 'PRIMEIRO_ACESSO_MANDATORIO',
      changed_at: updatedUser.password_changed_at,
    });
    logAudit('LGPD_TERMS_ACCEPTED', 'SECURITY', updatedUser.id, {
      version: updatedUser.lgpd_terms_version,
      accepted_at: updatedUser.lgpd_accepted_at,
      user_email: updatedUser.email,
    });

    // 4. Sincronizar com a tabela profiles no Supabase/Backend
    try {
      await fetch(`/api/profiles/${updatedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser),
      });
    } catch (err) {
      console.log('Aviso ao sincronizar perfil homologado com backend:', err);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 text-slate-900 flex flex-col font-sans relative">
      {/* Dynamic Background Image Layer */}
      {siteBackgroundConfig.enabled && siteBackgroundConfig.imageUrl && (
        <div
          id="global-site-background"
          aria-hidden="true"
          className="fixed top-0 left-0 w-screen h-screen pointer-events-none z-0"
          style={{
            backgroundImage: `url(${siteBackgroundConfig.imageUrl})`,
            backgroundSize: siteBackgroundConfig.position === 'repeat' ? 'auto' : siteBackgroundConfig.position === 'contain' ? 'contain' : 'cover',
            backgroundRepeat: siteBackgroundConfig.position === 'repeat' ? 'repeat' : 'no-repeat',
            backgroundPosition: 'center center',
            opacity: siteBackgroundConfig.opacity / 100,
            filter: siteBackgroundConfig.blur > 0 ? `blur(${siteBackgroundConfig.blur}px)` : undefined,
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
          }}
        />
      )}

      {/* Dynamic Contrast Overlay Layer */}
      {siteBackgroundConfig.enabled && siteBackgroundConfig.imageUrl && siteBackgroundConfig.overlayType !== 'none' && (
        <div
          id="global-site-background-overlay"
          aria-hidden="true"
          className={`fixed top-0 left-0 w-screen h-screen pointer-events-none z-0 ${
            siteBackgroundConfig.overlayType === 'dark' ? 'bg-slate-900/60' : 'bg-white/80'
          }`}
          style={{
            opacity: (siteBackgroundConfig.overlayOpacity ?? 40) / 100,
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
          }}
        />
      )}

      {/* Foreground Content Wrapper */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Navigation - Only render when logged in and active */}
        {currentUser && (currentUser.status === 'active' || currentUser.status === 'approved') && (
          <Navbar
            currentUser={currentUser}
            activeView={activeView}
            onNavigate={setActiveView}
            onOpenSqlModal={() => setIsSqlModalOpen(true)}
            onOpenProfileModal={handleOpenProfileModal}
            onOpenLgpdModal={() => setIsLgpdModalOpen(true)}
            onOpenFirstAccessModal={() => setIsFirstAccessModalOpen(true)}
            onOpenBackgroundModal={() => {
              setBackgroundModalTab('site-background');
              setIsBackgroundModalOpen(true);
            }}
            onOpenCompanyModal={() => handleOpenCompanyModal()}
            onOpenCompanyManager={() => setIsCompanyManagerOpen(true)}
            onOpenInvoiceEmission={() => setIsInvoiceEmissionOpen(true)}
            onOpenManualModal={() => setIsManualModalOpen(true)}
            onSwitchUser={handleSwitchUser}
            onLogout={handleLogout}
            allProfiles={profiles}
            r2Status={r2Status}
            storageMetrics={storageMetrics}
            authHeaderConfig={authHeaderConfig}
          />
        )}



        {/* Main View Area */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
          {currentUser && (currentUser.status === 'active' || currentUser.status === 'approved') ? (
            activeView === 'drive' ? (
              <FileManager
                currentUser={currentUser}
                folders={folders}
                files={files}
                allProfiles={profiles}
                storageMetrics={storageMetrics}
                onRefreshStorage={fetchStorageMetrics}
                onOpenFileViewer={(file) => setViewingFile(file)}
                onOpenUploadModal={(folderId) => {
                  setUploadTargetFolderId(folderId || null);
                  setIsUploadModalOpen(true);
                }}
                onCreateFolder={handleCreateFolder}
                onDeleteFolder={handleDeleteFolder}
                onDeleteFile={handleDeleteFile}
                onRenameFile={handleRenameFile}
                onUpdateFolderAllowedUsers={handleUpdateFolderAllowedUsers}
                hasFolderPermission={checkFolderPermission}
                onOpenCompanyModal={handleOpenCompanyModal}
                externalSearchQuery={driveFilterSearch}
                onClearExternalSearch={() => setDriveFilterSearch('')}
              />
            ) : (
              <AdminPanel
                currentUser={currentUser}
                profiles={profiles}
                folders={folders}
                folderPermissions={folderPermissions}
                auditLogs={auditLogs}
                siteBackgroundConfig={siteBackgroundConfig}
                authHeaderConfig={authHeaderConfig}
                onUpdateSiteBackgroundConfig={(newConf) => {
                  setSiteBackgroundConfig(newConf);
                }}
                onUpdateAuthHeaderConfig={(newConf) => {
                  setAuthHeaderConfig(newConf);
                }}
                onAuditLog={(details) => {
                  logAudit('BACKGROUND_IMAGE_CHANGED', 'SETTINGS', 'site-background', details);
                }}
                onApproveUser={handleApproveUser}
                onRejectUser={handleRejectUser}
                onDeleteUser={handleDeleteUser}
                onUpdateUserStatus={handleUpdateUserStatus}
                onUpdateUserRole={handleUpdateUserRole}
                onUpdateFolderPermission={handleUpdateFolderPermission}
              />
            )
          ) : null}
        </main>

        {/* Footer - Only render when logged in */}
        {currentUser && (currentUser.status === 'active' || currentUser.status === 'approved') && (
          <footer className="bg-white/85 backdrop-blur-xs border-t border-gray-200 py-4 px-6 text-center text-xs text-gray-500">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>&copy; 2026 MVRJCONTÁBIL Gestão Eletrônica de Documentos. Todos os direitos reservados.</span>
              <div className="flex items-center space-x-3 text-[11px] text-gray-500">
                <button
                  onClick={() => setIsLgpdModalOpen(true)}
                  className="hover:text-blue-600 underline font-medium transition-colors cursor-pointer"
                >
                  Termos de Acesso & Privacidade (LGPD)
                </button>
                <span>•</span>
                <span>Ambiente Seguro e Monitorado</span>
              </div>
            </div>
          </footer>
        )}
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen || (!currentUser || (currentUser.status !== 'active' && currentUser.status !== 'approved'))}
        authHeaderConfig={authHeaderConfig}
        isAdmin={currentUser?.role === 'admin'}
        onOpenHeaderCustomizer={() => {
          setBackgroundModalTab('auth-header');
          setIsBackgroundModalOpen(true);
        }}
        onLoginSuccess={(user) => {
          const token = `mvrj_session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          try {
            sessionStorage.setItem('mvrj_session_token', token);
            sessionStorage.setItem('mvrj_session_user', JSON.stringify(user));
            localStorage.setItem('mvrj_session_token', token);
            localStorage.setItem('mvrj_session_user', JSON.stringify(user));
          } catch {}
          setCurrentUser(user);
          setIsAuthModalOpen(false);
          logAudit('LOGIN', 'USER', user.id, { email: user.email, name: user.full_name });
        }}
        onRequestAccessSuccess={(newUser) => {
          setProfiles(prev => [newUser, ...prev]);
          logAudit('ACCESS_REQUEST', 'USER', newUser.id, {
            email: newUser.email,
            name: newUser.full_name,
            sector: newUser.sector,
          });
          fetch('/api/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUser),
          }).catch(err => console.warn('Aviso ao sincronizar novo perfil no backend:', err));
        }}
        allProfiles={profiles}
      />

      <FileUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setUploadTargetFolderId(null);
        }}
        currentFolder={uploadTargetFolderId ? (folders.find(f => f.id === uploadTargetFolderId) || null) : null}
        allFolders={folders}
        currentUser={currentUser || profiles[0]}
        onUploadSuccess={handleUploadSuccess}
        storageMetrics={storageMetrics}
      />

      <PdfViewerModal
        isOpen={Boolean(viewingFile)}
        onClose={() => setViewingFile(null)}
        file={viewingFile}
        canDownload={Boolean(
          currentUser && (
            currentUser.role === 'admin' ||
            (currentUser.role as string) === 'ADMIN' ||
            (currentUser as any).role === 'Diretoria' ||
            currentUser.sector === 'Diretoria' ||
            (currentUser as any).setor === 'Diretoria' ||
            currentUser.role === 'editor'
          )
        )}
      />

      <SqlSchemaViewerModal
        isOpen={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
      />

      {currentUser && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentUser={currentUser}
          onSaveProfile={handleSaveProfile}
          onPasswordChange={handlePasswordChange}
          onOpenLgpdModal={() => setIsLgpdModalOpen(true)}
          initialTab={profileModalTab}
        />
      )}

      {currentUser && (
        <FirstAccessModal
          isOpen={isFirstAccessModalOpen}
          currentUser={currentUser}
          onCompleteFirstAccess={handleCompleteFirstAccess}
          onLogout={handleLogout}
        />
      )}

      {currentUser && (
        <LgpdTermsModal
          isOpen={isLgpdModalOpen}
          onClose={() => setIsLgpdModalOpen(false)}
          currentUser={currentUser}
        />
      )}

      {currentUser && currentUser.role === 'admin' && (
        <BackgroundModal
          isOpen={isBackgroundModalOpen}
          onClose={() => setIsBackgroundModalOpen(false)}
          currentUser={currentUser}
          currentConfig={siteBackgroundConfig}
          onConfigChange={(newConf) => {
            setSiteBackgroundConfig(newConf);
          }}
          authHeaderConfig={authHeaderConfig}
          onAuthHeaderConfigChange={(newConf) => {
            setAuthHeaderConfig(newConf);
          }}
          initialTab={backgroundModalTab}
          onAuditLog={(details) => {
            logAudit('BACKGROUND_IMAGE_CHANGED', 'SETTINGS', 'site-background', details);
          }}
        />
      )}

      <PasswordConfirmModal
        isOpen={pendingDeleteAction !== null}
        onClose={() => setPendingDeleteAction(null)}
        onConfirm={() => {
          if (pendingDeleteAction) {
            pendingDeleteAction.action();
            setPendingDeleteAction(null);
          }
        }}
        currentUser={currentUser}
        actionTitle={
          pendingDeleteAction?.type === 'file'
            ? 'Confirmar Exclusão de Arquivo'
            : pendingDeleteAction?.type === 'folder'
            ? 'Confirmar Exclusão de Pasta'
            : 'Confirmar Exclusão de Usuário'
        }
        itemDescription={
          pendingDeleteAction?.type === 'file'
            ? `Deseja realmente excluir permanentemente o arquivo "${pendingDeleteAction?.name || ''}"?`
            : pendingDeleteAction?.type === 'folder'
            ? `Deseja realmente excluir permanentemente a pasta "${pendingDeleteAction?.name || ''}" e todo o seu conteúdo?`
            : `Deseja realmente excluir permanentemente o usuário "${pendingDeleteAction?.name || ''}"?`
        }
      />

      {/* Consulta Rápida de Empresa / CNPJ Modal */}
      <CompanyConsultModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        onFilterGed={handleFilterGedByCompany}
        existingFiles={files}
        existingFolders={folders}
        initialSearchQuery={companySearchQuery}
      />

      {/* Gestão de Empresas Clientes Modal */}
      <CompanyManagerModal
        isOpen={isCompanyManagerOpen}
        onClose={() => setIsCompanyManagerOpen(false)}
      />

      {/* Emissão de Notas Fiscais View/Modal */}
      <InvoiceEmissionView
        isOpen={isInvoiceEmissionOpen}
        onClose={() => setIsInvoiceEmissionOpen(false)}
        folders={folders}
        onInvoiceCreated={() => {
          fetchFilesFromApi().then(apiFiles => {
            if (apiFiles && Array.isArray(apiFiles)) {
              setFiles(apiFiles);
            }
          }).catch(() => {});
        }}
      />

      {/* Manual do Usuário e Guia Operacional Modal */}
      <UserManualModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
      />


    </div>
  );
}
