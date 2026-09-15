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
  fetchSystemStatusFromApi
} from './lib/storage-service';

export default function App() {
  // Profiles & Auth State (Prioritizing Evandro as Master Administrator)
  const [profiles, setProfiles] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem('mvrj_profiles');
    let loaded: UserProfile[] = saved ? JSON.parse(saved) : INITIAL_PROFILES;
    
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
    return profiles.find(p => p.email.toLowerCase() === 'evandro230655@gmail.com') ||
      profiles.find(p => p.role === 'admin' && p.status === 'active') || 
      profiles[0];
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

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

    // Sincronizar dados mestres persistidos no Supabase
    fetchFoldersFromApi().then(apiFolders => {
      if (apiFolders && apiFolders.length > 0) {
        setFolders(apiFolders);
      }
    });

    fetchFilesFromApi().then(apiFiles => {
      if (apiFiles && apiFiles.length > 0) {
        setFiles(apiFiles);
      }
    });

    fetchAuditLogsFromApi().then(apiLogs => {
      if (apiLogs && apiLogs.length > 0) {
        setAuditLogs(apiLogs);
      }
    });

    fetchFolderPermissionsFromApi().then(apiPerms => {
      if (apiPerms && apiPerms.length > 0) {
        setFolderPermissions(apiPerms);
      }
    });

    fetchStorageMetrics();
    // Poll storage metrics periodically every 15 seconds for real-time tracking
    const interval = setInterval(fetchStorageMetrics, 15000);

    // Fetch and sync profiles from Supabase
    fetch('/api/profiles')
      .then(res => res.json())
      .then(data => {
        if (data && data.profiles && Array.isArray(data.profiles) && data.profiles.length > 0) {
          setProfiles(prev => {
            const merged = [...prev];
            for (const sp of data.profiles) {
              const idx = merged.findIndex(p => p.email.toLowerCase() === sp.email.toLowerCase() || p.id === sp.id);
              if (idx !== -1) {
                merged[idx] = {
                  ...merged[idx],
                  id: sp.id || merged[idx].id,
                  full_name: sp.full_name || merged[idx].full_name,
                  avatar_url: sp.avatar_url !== undefined ? (sp.avatar_url || undefined) : merged[idx].avatar_url,
                };
              } else {
                merged.push(sp);
              }
            }
            return merged;
          });

          setCurrentUser(prevUser => {
            if (!prevUser) return prevUser;
            const match = data.profiles.find((p: UserProfile) => 
              p.email.toLowerCase() === prevUser.email.toLowerCase() || p.id === prevUser.id
            );
            if (match) {
              return {
                ...prevUser,
                id: match.id || prevUser.id,
                full_name: match.full_name || prevUser.full_name,
                avatar_url: match.avatar_url !== undefined ? (match.avatar_url || undefined) : prevUser.avatar_url,
              };
            }
            return prevUser;
          });
        }
      })
      .catch(err => console.log('Erro ao sincronizar perfis com Supabase:', err));

    return () => clearInterval(interval);
  }, []);

  // Permission Checker (Mirrors PostgreSQL RLS function public.has_folder_permission)
  const checkFolderPermission = (folderId: string, minLevel: PermissionLevel): boolean => {
    if (!currentUser || currentUser.status !== 'active') return false;
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
  const handleApproveUser = (userId: string, role: UserRole) => {
    const target = profiles.find(p => p.id === userId);
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, status: 'active', role } : p));
    logAudit('USER_APPROVED', 'USER', userId, {
      approved_name: target?.full_name,
      approved_email: target?.email,
      assigned_role: role,
    });
  };

  const handleRejectUser = (userId: string) => {
    const target = profiles.find(p => p.id === userId);
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, status: 'rejected' } : p));
    logAudit('USER_REJECTED', 'USER', userId, { rejected_name: target?.full_name });
  };

  const handleUpdateUserStatus = (userId: string, status: UserStatus) => {
    const target = profiles.find(p => p.id === userId);
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, status } : p));
    logAudit('USER_BLOCKED', 'USER', userId, { user_name: target?.full_name, new_status: status });
  };

  const handleUpdateUserRole = (userId: string, role: UserRole) => {
    const target = profiles.find(p => p.id === userId);
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role } : p));
    logAudit('PERMISSION_CHANGE', 'USER', userId, { user_name: target?.full_name, new_role: role });
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
    if (confirm(`Tem certeza que deseja excluir o arquivo "${file?.name}"?`)) {
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
    setCurrentUser(null);
    setIsAuthModalOpen(true);
  };

  const handleSaveProfile = (updatedData: { full_name: string; avatar_url?: string }) => {
    if (!currentUser) return;
    
    const updatedUser: UserProfile = {
      ...currentUser,
      full_name: updatedData.full_name,
      avatar_url: updatedData.avatar_url,
      updated_at: new Date().toISOString(),
    };

    setCurrentUser(updatedUser);
    setProfiles(prev => prev.map(p => (p.id === currentUser.id || p.email.toLowerCase() === currentUser.email.toLowerCase()) ? updatedUser : p));
    
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
        />

        {/* Main View Area */}
        <main className="flex-1">
          {currentUser && currentUser.status === 'active' ? (
            activeView === 'drive' ? (
              <FileManager
                currentUser={currentUser}
                folders={folders}
                files={files}
                storageMetrics={storageMetrics}
                onRefreshStorage={fetchStorageMetrics}
                onOpenFileViewer={(file) => setViewingFile(file)}
                onOpenUploadModal={() => setIsUploadModalOpen(true)}
                onCreateFolder={handleCreateFolder}
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
                onUpdateUserStatus={handleUpdateUserStatus}
                onUpdateUserRole={handleUpdateUserRole}
                onUpdateFolderPermission={handleUpdateFolderPermission}
              />
            )
          ) : (
            <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-2xl border border-gray-200 shadow-xl text-center">
              <h2 className="text-xl font-bold text-gray-900">Autenticação Necessária</h2>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                Por favor, selecione ou acesse uma conta para visualizar os documentos da MVRJCONTÁBIL.
              </p>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Fazer Login / Solicitar Acesso
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
        isOpen={isAuthModalOpen || (!currentUser || currentUser.status !== 'active')}
        authHeaderConfig={authHeaderConfig}
        isAdmin={currentUser?.role === 'admin'}
        onOpenHeaderCustomizer={() => {
          setBackgroundModalTab('auth-header');
          setIsBackgroundModalOpen(true);
        }}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthModalOpen(false);
        }}
        onRequestAccessSuccess={(newUser) => {
          setProfiles(prev => [newUser, ...prev]);
          logAudit('ACCESS_REQUEST', 'USER', newUser.id, {
            email: newUser.email,
            name: newUser.full_name,
            sector: newUser.sector,
          });
        }}
        allProfiles={profiles}
      />

      <FileUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        currentFolder={null}
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
    </div>
  );
}
