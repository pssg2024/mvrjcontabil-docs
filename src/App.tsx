import React, { useState, useEffect, useCallback } from 'react';
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
  deleteFolderInApi,
  deleteFileInApi,
  saveAuditLogInApi,
  saveFolderPermissionToApi,
  fetchSystemStatusFromApi,
  fetchProfilesFromApi
} from './lib/storage-service';

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
    
    // Assegura que evandro230655@gmail.com sempre existe como Administrador ativo
    const evandroExists = loaded.find(p => p.email.toLowerCase() === 'evandro230655@gmail.com');
    if (!evandroExists) {
      loaded = [INITIAL_PROFILES[0], ...loaded];
    } else {
      loaded = loaded.map(p => 
        p.email.toLowerCase() === 'evandro230655@gmail.com'
          ? { ...p, role: 'admin', status: 'active' }
          : p
      );
    }
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
  const [folders, setFolders] = useState<Folder[]>(() => {
    const saved = localStorage.getItem('mvrj_folders');
    return saved ? JSON.parse(saved) : INITIAL_FOLDERS;
  });

  const [files, setFiles] = useState<DocumentFile[]>(() => {
    const saved = localStorage.getItem('mvrj_files');
    return saved ? JSON.parse(saved) : INITIAL_FILES;
  });

  const [folderPermissions, setFolderPermissions] = useState<FolderPermission[]>(() => {
    const saved = localStorage.getItem('mvrj_folder_perms');
    return saved ? JSON.parse(saved) : INITIAL_FOLDER_PERMISSIONS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('mvrj_audit_logs');
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });

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
    fetch('/api/storage/metrics')
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

  // Fetch backend R2 status and real-time storage metrics on load
  useEffect(() => {
    fetch('/api/r2/status')
      .then(res => res.json())
      .then(data => {
        if (data) setR2Status(data);
      })
      .catch(err => console.log('Backend status check:', err));

    // Fetch site background customization from server
    getSiteBackgroundConfig()
      .then(bgConfig => {
        if (bgConfig) {
          setSiteBackgroundConfig(bgConfig);
        }
      })
      .catch(err => console.log('Erro ao carregar fundo do site:', err));

    // Fetch auth modal header customization from server
    getAuthHeaderConfig()
      .then(authConfig => {
        if (authConfig) {
          setAuthHeaderConfig(authConfig);
        }
      })
      .catch(err => console.log('Erro ao carregar cabeçalho de login:', err));

    // Polling interval to keep folders, files and configs in sync across all devices and sessions in real time
    const syncInterval = setInterval(() => {
      fetchFoldersFromApi().then(apiFolders => {
        if (apiFolders) setFolders(apiFolders);
      }).catch(() => {});
      fetchFilesFromApi().then(apiFiles => {
        if (apiFiles) setFiles(apiFiles);
      }).catch(() => {});
      getAuthHeaderConfig().then(authConfig => {
        if (authConfig) setAuthHeaderConfig(authConfig);
      }).catch(() => {});
      getSiteBackgroundConfig().then(bgConfig => {
        if (bgConfig) setSiteBackgroundConfig(bgConfig);
      }).catch(() => {});
    }, 4000);

    // Sincronizar dados mestres persistidos no Supabase no carregamento inicial
    fetchFoldersFromApi().then(apiFolders => {
      if (apiFolders) {
        setFolders(apiFolders);
      }
    }).catch(() => {});

    fetchFilesFromApi().then(apiFiles => {
      if (apiFiles) {
        setFiles(apiFiles);
      }
    }).catch(() => {});

    fetchAuditLogsFromApi().then(apiLogs => {
      if (apiLogs && apiLogs.length > 0) {
        setAuditLogs(apiLogs);
      }
    }).catch(() => {});

    fetchFolderPermissionsFromApi().then(apiPerms => {
      if (apiPerms && apiPerms.length > 0) {
        setFolderPermissions(apiPerms);
      }
    }).catch(() => {});

    fetchStorageMetrics();
    // Poll storage metrics periodically every 15 seconds for real-time tracking
    const interval = setInterval(fetchStorageMetrics, 15000);

    // Initial sync of profiles from API / Supabase
    const syncProfiles = () => {
      fetch('/api/profiles')
        .then(res => res.json())
        .then(data => {
          if (data && data.profiles && Array.isArray(data.profiles)) {
            setProfiles(data.profiles);

            setCurrentUser(prevUser => {
              if (!prevUser) return prevUser;
              const match = data.profiles.find((p: UserProfile) => 
                p.email.toLowerCase() === prevUser.email.toLowerCase() || p.id === prevUser.id
              );
              if (match) {
                const resolvedAvatar = match.avatar_url || prevUser.avatar_url;
                const updated: UserProfile = {
                  ...prevUser,
                  id: match.id || prevUser.id,
                  full_name: match.full_name || prevUser.full_name,
                  role: match.role || prevUser.role,
                  status: match.status || prevUser.status,
                  sector: match.sector || prevUser.sector,
                  avatar_url: resolvedAvatar,
                };
                if (resolvedAvatar !== prevUser.avatar_url || match.full_name !== prevUser.full_name) {
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
        })
        .catch(err => console.error('Erro ao sincronizar perfis com Supabase:', err));
    };

    syncProfiles();
    const profilesInterval = setInterval(syncProfiles, 4000);

    return () => {
      clearInterval(syncInterval);
      clearInterval(interval);
      clearInterval(profilesInterval);
    };
  }, []);

  // Permission Checker (Mirrors PostgreSQL RLS function public.has_folder_permission)
  const checkFolderPermission = (folderId: string, minLevel: PermissionLevel): boolean => {
    if (!currentUser) return false;
    // Usuários com status 'active' ou 'approved' possuem acesso normal liberado
    if (currentUser.status !== 'active' && currentUser.status !== 'approved') return false;
    if (currentUser.role === 'admin') return true;

    // 1. Explicit folder assignment in folder_permissions
    const explicit = folderPermissions.find(p => p.folder_id === folderId && p.profile_id === currentUser.id);
    if (explicit) {
      if (minLevel === 'viewer') return true;
      if (minLevel === 'editor' && (explicit.permission_level === 'editor' || explicit.permission_level === 'admin')) return true;
      if (minLevel === 'admin' && explicit.permission_level === 'admin') return true;
    }

    // 2. Default Sector matching
    const folder = folders.find(f => f.id === folderId);
    if (folder && (folder.sector === currentUser.sector || folder.sector === 'Geral')) {
      if (minLevel === 'viewer') return true;
      if (minLevel === 'editor' && currentUser.role === 'editor') return true;
    }

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
    logAudit('FILE_UPLOAD', 'FILE', newDoc.id, {
      name: newDoc.name,
      original_size: newDoc.original_size,
      optimized_size: newDoc.optimized_size,
      compression_ratio: `${newDoc.compression_ratio}%`,
      storage_key: newDoc.storage_key,
    });
  };

  const handleCreateFolder = async (name: string, parentId: string | null, sector: Sector) => {
    try {
      const created = await createFolderInApi(name, parentId, sector, currentUser?.id);
      setFolders(prev => [...prev, created]);
      logAudit('FOLDER_CREATE', 'FOLDER', created.id, { name, sector, parentId });
    } catch (err) {
      console.warn('Erro ao criar pasta no Supabase, mantendo localmente:', err);
      const newFolder: Folder = {
        id: `fold-${Date.now()}`,
        parent_id: parentId,
        name,
        sector,
        created_by: currentUser?.id || 'usr-admin-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setFolders(prev => [...prev, newFolder]);
      logAudit('FOLDER_CREATE', 'FOLDER', newFolder.id, { name, sector, parentId });
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    setPendingDeleteAction({
      type: 'file',
      id: fileId,
      name: file?.name || fileId,
      action: async () => {
        setFiles(prev => prev.filter(f => f.id !== fileId));
        if (file) {
          logAudit('FILE_DELETE', 'FILE', fileId, { name: file.name, storage_key: file.storage_key });
        }
        try {
          await deleteFileInApi(fileId);
          fetchStorageMetrics();
        } catch (err) {
          console.warn('Erro ao excluir no Supabase/R2:', err);
        }
      }
    });
  };

  // 3. Exclusão de Pastas pelo Admin com deleção no Supabase (DELETE /api/folders/:id)
  const handleDeleteFolder = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    setPendingDeleteAction({
      type: 'folder',
      id: folderId,
      name: folder?.name || folderId,
      action: async () => {
        try {
          await deleteFolderInApi(folderId);
          // Remove pasta excluída e eventuais subpastas vinculadas
          setFolders(prev => prev.filter(f => f.id !== folderId && f.parent_id !== folderId));
          // Remove arquivos pertencentes a esta pasta da listagem local
          setFiles(prev => prev.filter(file => file.folder_id !== folderId));
          fetchStorageMetrics();
          if (folder) {
            logAudit('FOLDER_DELETE', 'FOLDER', folderId, { name: folder.name });
          }
        } catch (err: any) {
          alert(`Erro ao excluir pasta no Supabase: ${err.message || 'Falha na requisição'}`);
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
    <div className="min-h-screen bg-slate-50 text-gray-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white relative">
      {/* Dynamic Background Image Layer */}
      {siteBackgroundConfig.enabled && siteBackgroundConfig.imageUrl && (
        <div
          id="global-site-background"
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-0 transition-all duration-500"
          style={{
            backgroundImage: `url(${siteBackgroundConfig.imageUrl})`,
            backgroundSize: siteBackgroundConfig.position === 'repeat' ? 'auto' : siteBackgroundConfig.position === 'contain' ? 'contain' : 'cover',
            backgroundRepeat: siteBackgroundConfig.position === 'repeat' ? 'repeat' : 'no-repeat',
            backgroundPosition: 'center center',
            opacity: siteBackgroundConfig.opacity / 100,
            filter: siteBackgroundConfig.blur > 0 ? `blur(${siteBackgroundConfig.blur}px)` : 'none',
            transform: siteBackgroundConfig.blur > 0 ? 'scale(1.04)' : 'none',
          }}
        />
      )}

      {/* Dynamic Contrast Overlay Layer */}
      {siteBackgroundConfig.enabled && siteBackgroundConfig.imageUrl && siteBackgroundConfig.overlayType !== 'none' && (
        <div
          id="global-site-background-overlay"
          aria-hidden="true"
          className={`fixed inset-0 pointer-events-none z-0 transition-opacity duration-300 ${
            siteBackgroundConfig.overlayType === 'dark' ? 'bg-slate-950' : 'bg-slate-50'
          }`}
          style={{
            opacity: (siteBackgroundConfig.overlayOpacity ?? 40) / 100,
          }}
        />
      )}

      {/* Foreground Content Wrapper */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Navigation */}
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
          onSwitchUser={handleSwitchUser}
          onLogout={handleLogout}
          allProfiles={profiles}
          r2Status={r2Status}
          storageMetrics={storageMetrics}
          authHeaderConfig={authHeaderConfig}
        />

        {/* Main View Area */}
        <main className="flex-1">
          {currentUser && (currentUser.status === 'active' || currentUser.status === 'approved') ? (
            activeView === 'drive' ? (
              <FileManager
                currentUser={currentUser}
                folders={folders}
                files={files}
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
                hasFolderPermission={checkFolderPermission}
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
          ) : (
            <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-2xl border border-gray-200 shadow-xl text-center">
              <h2 className="text-xl font-bold text-gray-900">Autenticação Obrigatória</h2>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                {currentUser?.status === 'pending'
                  ? 'Cadastro realizado com sucesso! Aguarde a aprovação do Administrador para acessar os documentos contábeis.'
                  : 'Por favor, realize seu login com e-mail e senha para acessar os documentos da MVRJ CONTÁBIL.'}
              </p>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                {currentUser?.status === 'pending' ? 'Ver Status da Conta' : 'Acessar com Login'}
              </button>
            </div>
          )}
        </main>

        {/* Footer */}
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
    </div>
  );
}
