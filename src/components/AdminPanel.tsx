import React, { useState } from 'react';
import { 
  ShieldCheck, 
  UserCheck, 
  UserX, 
  Clock, 
  Lock, 
  FolderTree, 
  History, 
  Check, 
  X, 
  Filter, 
  Search, 
  AlertTriangle,
  FolderLock,
  UserCog,
  CheckCircle2,
  ChevronRight,
  Palette,
  Trash2,
  RefreshCw,
  Edit2,
  Loader2,
  BadgeDollarSign,
  Download
} from 'lucide-react';
import { InadimplenciaPanel } from './InadimplenciaPanel';
import { UserAvatar } from './UserAvatar';
import { 
  UserProfile, 
  UserRole, 
  UserStatus, 
  Folder, 
  FolderPermission, 
  PermissionLevel, 
  AuditLog, 
  Sector,
  SiteBackgroundConfig,
  AuthHeaderConfig
} from '../types';
import { AuthHeaderCustomizer } from './AuthHeaderCustomizer';
import { DEFAULT_AUTH_HEADER_CONFIG } from '../lib/storage-service';
import { downloadCsvFile } from '../lib/auth-session';

interface AdminPanelProps {
  currentUser: UserProfile;
  profiles: UserProfile[];
  folders: Folder[];
  folderPermissions: FolderPermission[];
  auditLogs: AuditLog[];
  siteBackgroundConfig?: SiteBackgroundConfig;
  authHeaderConfig?: AuthHeaderConfig;
  initialTab?: 'pending' | 'matrix' | 'users' | 'audit' | 'appearance' | 'inadimplencia';
  onTabChange?: (tab: 'pending' | 'matrix' | 'users' | 'audit' | 'appearance' | 'inadimplencia') => void;
  inadimplenciaCount?: number;
  onInadimplenciaCountChange?: (count: number) => void;
  onInadimplenciaAuditLog?: (action: 'INADIMPLENCIA_CREATED' | 'INADIMPLENCIA_PAYMENT' | 'INADIMPLENCIA_SETTLED' | 'INADIMPLENCIA_DELETED', targetId: string, details: Record<string, any>) => void;
  onApproveUser: (userId: string, role: UserRole, sector?: Sector) => void;
  onRejectUser: (userId: string) => void;
  onDeleteUser: (userId: string, userName?: string) => void;
  onUpdateUserStatus: (userId: string, status: UserStatus) => void;
  onUpdateUserRole: (userId: string, role: UserRole) => void;
  onUpdateFolderPermission: (folderId: string, profileId: string, level: PermissionLevel | 'none') => void;
  onRenameFolder?: (folderId: string, newName: string) => Promise<any> | void;
  onUpdateSiteBackgroundConfig?: (config: SiteBackgroundConfig) => void;
  onUpdateAuthHeaderConfig?: (config: AuthHeaderConfig) => void;
  onAuditLog?: (details: Record<string, any>) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  profiles,
  folders,
  folderPermissions,
  auditLogs,
  siteBackgroundConfig,
  authHeaderConfig,
  initialTab = 'pending',
  onTabChange,
  inadimplenciaCount = 0,
  onInadimplenciaCountChange,
  onInadimplenciaAuditLog,
  onApproveUser,
  onRejectUser,
  onDeleteUser,
  onUpdateUserStatus,
  onUpdateUserRole,
  onUpdateFolderPermission,
  onRenameFolder,
  onUpdateSiteBackgroundConfig,
  onUpdateAuthHeaderConfig,
  onAuditLog,
}) => {
  const [activeTab, setActiveTabState] = useState<'pending' | 'matrix' | 'users' | 'audit' | 'appearance' | 'inadimplencia'>(initialTab);
  const setActiveTab = (tab: 'pending' | 'matrix' | 'users' | 'audit' | 'appearance' | 'inadimplencia') => {
    setActiveTabState(tab);
    onTabChange?.(tab);
  };
  React.useEffect(() => {
    setActiveTabState(initialTab);
  }, [initialTab]);
  const [selectedRoleForApproval, setSelectedRoleForApproval] = useState<Record<string, UserRole>>({});
  const [selectedSectorForApproval, setSelectedSectorForApproval] = useState<Record<string, Sector>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [auditFilter, setAuditFilter] = useState<string>('ALL');

  // Folder Renaming Modal State (Admin)
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');
  const [isSubmittingFolderRename, setIsSubmittingFolderRename] = useState(false);
  const [folderRenameError, setFolderRenameError] = useState<string | null>(null);

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

  const pendingProfiles = profiles.filter(p => p.status === 'pending');
  const activeProfiles = profiles.filter(p => p.status !== 'pending');

  const getPermissionFor = (folderId: string, profileId: string): PermissionLevel | 'none' => {
    const perm = folderPermissions.find(p => p.folder_id === folderId && p.profile_id === profileId);
    if (perm) return perm.permission_level;
    
    // Se a pasta possui allowed_user_ids definidos
    const folder = folders.find(f => f.id === folderId);
    if (folder && Array.isArray(folder.allowed_user_ids) && folder.allowed_user_ids.length > 0) {
      if (folder.allowed_user_ids.includes(profileId)) {
        return 'viewer';
      }
      return 'none';
    }

    return 'none';
  };

  const filteredLogs = auditLogs.filter(log => {
    if (auditFilter !== 'ALL' && log.action !== auditFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        log.user_name.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.target_type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#DFB76C]/15 border border-[#DFB76C]/30 rounded-xl text-[#DFB76C] shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Painel de Governança & RBAC</h1>
            <p className="text-xs sm:text-sm text-slate-300">Controle de acessos, aprovações de colaboradores e auditoria por setor</p>
          </div>
        </div>
      </div>

      {/* Grid de Estatísticas: single-elevation cards com tabular-nums */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="p-3.5 bg-white dark:bg-[#091124] border border-slate-200 dark:border-slate-800 rounded-xl flex items-center space-x-3">
          <div className="p-2 bg-amber-500/15 rounded-lg text-amber-600 dark:text-amber-400 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] uppercase font-semibold text-slate-500 dark:text-slate-400 block tracking-wide truncate">Pendentes</span>
            <strong className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-amber-300">{pendingProfiles.length}</strong>
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-[#091124] border border-slate-200 dark:border-slate-800 rounded-xl flex items-center space-x-3">
          <div className="p-2 bg-blue-500/15 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] uppercase font-semibold text-slate-500 dark:text-slate-400 block tracking-wide truncate">Ativos</span>
            <strong className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">{profiles.filter(p => p.status === 'active' || p.status === 'approved').length}</strong>
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-[#091124] border border-slate-200 dark:border-slate-800 rounded-xl flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/15 rounded-lg text-emerald-600 dark:text-emerald-400 shrink-0">
            <FolderTree className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] uppercase font-semibold text-slate-500 dark:text-slate-400 block tracking-wide truncate">Pastas GED</span>
            <strong className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">{folders.length}</strong>
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-[#091124] border border-slate-200 dark:border-slate-800 rounded-xl flex items-center space-x-3">
          <div className="p-2 bg-[#DFB76C]/15 rounded-lg text-[#B58931] dark:text-[#DFB76C] shrink-0">
            <History className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] uppercase font-semibold text-slate-500 dark:text-slate-400 block tracking-wide truncate">Auditoria</span>
            <strong className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">{auditLogs.length}</strong>
          </div>
        </div>
      </div>

      {/* Tabs Navigation - Executive Segmented Control */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] bg-slate-100 dark:bg-[#091124] p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 mb-6 max-w-full">
        <button
          id="tab-admin-pending"
          onClick={() => setActiveTab('pending')}
          className={`px-3.5 py-2 text-xs font-semibold flex items-center space-x-2 whitespace-nowrap transition-all rounded-xl cursor-pointer ${
            activeTab === 'pending'
              ? 'bg-[#1B357B] dark:bg-[#DFB76C] text-white dark:text-slate-950 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
        >
          <Clock className={`w-4 h-4 ${activeTab === 'pending' ? 'text-[#DFB76C] dark:text-slate-950' : 'text-slate-400'}`} />
          <span>Solicitações</span>
          {pendingProfiles.length > 0 && (
            <span className={`font-mono tabular-nums text-[11px] font-bold ${activeTab === 'pending' ? 'text-white dark:text-slate-950' : 'text-amber-500'}`}>
              ({pendingProfiles.length})
            </span>
          )}
        </button>

        <button
          id="tab-admin-matrix"
          onClick={() => setActiveTab('matrix')}
          className={`px-3.5 py-2 text-xs font-semibold flex items-center space-x-2 whitespace-nowrap transition-all rounded-xl cursor-pointer ${
            activeTab === 'matrix'
              ? 'bg-[#1B357B] dark:bg-[#DFB76C] text-white dark:text-slate-950 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
        >
          <FolderLock className={`w-4 h-4 ${activeTab === 'matrix' ? 'text-[#DFB76C] dark:text-slate-950' : 'text-slate-400'}`} />
          <span>Permissões</span>
        </button>

        <button
          id="tab-admin-users"
          onClick={() => setActiveTab('users')}
          className={`px-3.5 py-2 text-xs font-semibold flex items-center space-x-2 whitespace-nowrap transition-all rounded-xl cursor-pointer ${
            activeTab === 'users'
              ? 'bg-[#1B357B] dark:bg-[#DFB76C] text-white dark:text-slate-950 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
        >
          <UserCog className={`w-4 h-4 ${activeTab === 'users' ? 'text-[#DFB76C] dark:text-slate-950' : 'text-slate-400'}`} />
          <span>Usuários</span>
        </button>

        <button
          id="tab-admin-audit"
          onClick={() => setActiveTab('audit')}
          className={`px-3.5 py-2 text-xs font-semibold flex items-center space-x-2 whitespace-nowrap transition-all rounded-xl cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-[#1B357B] dark:bg-[#DFB76C] text-white dark:text-slate-950 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
        >
          <History className={`w-4 h-4 ${activeTab === 'audit' ? 'text-[#DFB76C] dark:text-slate-950' : 'text-slate-400'}`} />
          <span>Auditoria</span>
        </button>

        <button
          id="tab-admin-inadimplencia"
          onClick={() => setActiveTab('inadimplencia')}
          className={`px-3.5 py-2 text-xs font-semibold flex items-center space-x-2 whitespace-nowrap transition-all rounded-xl cursor-pointer ${
            activeTab === 'inadimplencia'
              ? 'bg-[#1B357B] dark:bg-[#DFB76C] text-white dark:text-slate-950 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
        >
          <BadgeDollarSign className={`w-4 h-4 ${activeTab === 'inadimplencia' ? 'text-[#DFB76C] dark:text-slate-950' : 'text-rose-400'}`} />
          <span>Inadimplência</span>
          {inadimplenciaCount > 0 && (
            <span className={`font-mono tabular-nums text-[11px] font-bold ${activeTab === 'inadimplencia' ? 'text-white dark:text-slate-950' : 'text-rose-400'}`}>
              ({inadimplenciaCount})
            </span>
          )}
        </button>

        <button
          id="tab-admin-appearance"
          onClick={() => setActiveTab('appearance')}
          className={`px-3.5 py-2 text-xs font-semibold flex items-center space-x-2 whitespace-nowrap transition-all rounded-xl cursor-pointer ${
            activeTab === 'appearance'
              ? 'bg-[#1B357B] dark:bg-[#DFB76C] text-white dark:text-slate-950 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
        >
          <Palette className={`w-4 h-4 ${activeTab === 'appearance' ? 'text-[#DFB76C] dark:text-slate-950' : 'text-slate-400'}`} />
          <span>Identidade Visual & Login</span>
        </button>
      </div>

      {/* TAB 1: PENDING ACCESS REQUESTS */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 rounded-2xl p-4 flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-[#1B357B] dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              Controle de Adesão: Novos cadastros de colaboradores permanecem retidos nesta fila até a aprovação formal e definição de setor pelo Administrador.
            </div>
          </div>

          {pendingProfiles.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#091124] p-10 text-center">
              <div className="w-12 h-12 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Nenhuma solicitação pendente</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Não há novos colaboradores aguardando liberação de acesso no momento.
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center space-x-2 text-xs font-medium text-[#1B357B] dark:text-[#DFB76C] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Atualizar Fila</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center space-x-2 text-xs font-medium text-[#1B357B] dark:text-[#DFB76C] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atualizar Fila (Sincronizar Banco)</span>
              </button>
            </div>
          )}

          {pendingProfiles.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingProfiles.map(profile => {
                const chosenRole = selectedRoleForApproval[profile.id] || 'viewer';

                return (
                  <div key={profile.id} className="bg-white dark:bg-[#091124] rounded-2xl border border-amber-300/80 dark:border-amber-700/50 p-5 relative overflow-hidden">
                    <div className="flex items-start space-x-3.5 mb-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-tr from-amber-500 to-orange-500 text-white font-bold text-lg flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800">
                        <UserAvatar
                          src={profile.avatar_url}
                          name={profile.full_name}
                          fallbackClassName="w-full h-full bg-gradient-to-tr from-amber-500 to-orange-500 text-white font-bold text-lg flex items-center justify-center"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug truncate">{profile.full_name}</h4>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 shrink-0">
                            Aguardando aprovação
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{profile.email}</p>
                        <div className="flex items-center space-x-2 mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-blue-700 dark:text-blue-300">
                            {profile.sector}
                          </span>
                          <span>·</span>
                          <span className="font-mono tabular-nums">
                            {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                      {/* Definir Setor / Departamento */}
                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Definir Setor / Departamento de Atuação:
                        </label>
                        <select
                          id={`select-sector-${profile.id}`}
                          value={selectedSectorForApproval[profile.id] || profile.sector}
                          onChange={(e) => setSelectedSectorForApproval(prev => ({ ...prev, [profile.id]: e.target.value as Sector }))}
                          className="w-full text-xs py-1.5 px-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0B1736] font-medium text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-[#DFB76C]/40"
                        >
                          <option value="Fiscal">Fiscal</option>
                          <option value="Departamento Pessoal">Departamento Pessoal (DP)</option>
                          <option value="Contábil">Contábil</option>
                          <option value="Financeiro">Financeiro</option>
                          <option value="Diretoria">Diretoria</option>
                          <option value="Geral">Geral</option>
                        </select>
                      </div>

                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Definir Papel na Aprovação:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => setSelectedRoleForApproval(prev => ({ ...prev, [profile.id]: 'viewer' }))}
                          className={`p-2.5 sm:p-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                            chosenRole === 'viewer' || chosenRole === 'User'
                              ? 'bg-slate-800 text-white border-slate-900 dark:bg-slate-700 dark:border-slate-600'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                          }`}
                        >
                          Leitor (User)
                          <span className="block text-[10px] opacity-75 font-normal">Visualizar + Upload</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedRoleForApproval(prev => ({ ...prev, [profile.id]: 'editor' }))}
                          className={`p-2.5 sm:p-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                            chosenRole === 'editor'
                              ? 'bg-blue-600 text-white border-blue-700'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                          }`}
                        >
                          Editor
                          <span className="block text-[10px] opacity-75 font-normal">Criar, Baixar e Compartilhar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedRoleForApproval(prev => ({ ...prev, [profile.id]: 'admin' }))}
                          className={`p-2.5 sm:p-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                            chosenRole === 'admin'
                              ? 'bg-purple-600 text-white border-purple-700'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                          }`}
                        >
                          Admin
                          <span className="block text-[10px] opacity-75 font-normal">Controle Total</span>
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <button
                          id={`approve-user-${profile.id}`}
                          onClick={() => {
                            const finalSector = selectedSectorForApproval[profile.id] || profile.sector;
                            onApproveUser(profile.id, chosenRole, finalSector);
                          }}
                          className="flex-1 py-2.5 sm:py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors shadow-2xs cursor-pointer active:scale-98"
                        >
                          <Check className="w-4 h-4" />
                          <span>Aprovar Acesso</span>
                        </button>

                        <button
                          id={`reject-user-${profile.id}`}
                          onClick={() => onRejectUser(profile.id)}
                          className="py-2.5 sm:py-2 px-3 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 transition-colors cursor-pointer active:scale-98"
                          title="Recusar ou excluir solicitação de cadastro"
                        >
                          <X className="w-4 h-4" />
                          <span>Recusar/Excluir</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GRANULAR PERMISSIONS MATRIX (RBAC) */}
      {activeTab === 'matrix' && (
        <div className="bg-white dark:bg-[#091124] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#070e1e] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Matriz de Acessos por Pasta e Setor</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Defina o nível individual de permissão de cada colaborador em cada pasta do GED.</p>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <span className="inline-flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-slate-400"></span> <span className="text-slate-600 dark:text-slate-400">Nenhum</span></span>
              <span className="inline-flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> <span className="text-slate-600 dark:text-slate-400">Leitor</span></span>
              <span className="inline-flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> <span className="text-slate-600 dark:text-slate-400">Editor</span></span>
              <span className="inline-flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> <span className="text-slate-600 dark:text-slate-400">Admin</span></span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 dark:bg-[#070e1e] border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                  <th className="p-3 font-bold sticky left-0 bg-slate-100 dark:bg-[#070e1e] min-w-[220px] z-10">Pasta / Setor</th>
                  {activeProfiles.map(p => (
                    <th key={p.id} className="p-3 font-semibold text-center min-w-[150px]">
                      <div className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[140px] mx-auto">{p.full_name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">{p.sector} · {p.role}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {folders.map(folder => (
                  <tr key={folder.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-[#091124] z-10">
                      <div className="flex items-center justify-between space-x-2">
                        <div className="flex items-center space-x-2 min-w-0">
                          <FolderTree className="w-4 h-4 text-[#DFB76C] shrink-0" />
                          <div className="min-w-0">
                            <span className="font-bold block text-xs truncate" title={folder.name}>{folder.name}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">{folder.sector}</span>
                          </div>
                        </div>
                        {onRenameFolder && (
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingFolder(folder);
                              setNewFolderNameInput(folder.name);
                              setFolderRenameError(null);
                            }}
                            className="text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors shrink-0 cursor-pointer"
                            title="Editar Nome da Pasta"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {activeProfiles.map(profile => {
                      const currentPerm = getPermissionFor(folder.id, profile.id);
                      const isGlobalAdmin = 
                        profile.role === 'admin' || 
                        (profile.role as string) === 'ADMIN' || 
                        (profile as any).role === 'Diretoria' ||
                        profile.sector === 'Diretoria' || 
                        (profile as any).setor === 'Diretoria';

                      return (
                        <td key={profile.id} className="p-2.5 text-center">
                          {isGlobalAdmin ? (
                            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-300" title="Acesso total herdado do papel de Administrador Global / Diretoria">
                              Admin Total
                            </span>
                          ) : (
                            <select
                              value={currentPerm}
                              onChange={(e) => onUpdateFolderPermission(folder.id, profile.id, e.target.value as any)}
                              className={`text-xs rounded-lg px-2 py-1 border font-medium outline-hidden transition-all ${
                                currentPerm === 'admin'
                                   ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800 font-bold'
                                   : currentPerm === 'editor'
                                   ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800 font-bold'
                                   : currentPerm === 'viewer'
                                   ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-semibold'
                                   : 'bg-white dark:bg-[#0B1736] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <option value="none">Sem Acesso (Oculta)</option>
                              <option value="viewer">Autorizada (Leitor)</option>
                              <option value="editor">Autorizada (Editor)</option>
                              <option value="admin">Admin da Pasta</option>
                            </select>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-[#091124] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#070e1e] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Colaboradores Cadastrados</h3>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">Total: {profiles.length} usuários</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {profiles.map(profile => (
              <div key={profile.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex items-start sm:items-center space-x-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center text-sm shrink-0 border border-slate-300 dark:border-slate-700">
                    <UserAvatar
                      src={profile.avatar_url}
                      name={profile.full_name}
                      fallbackClassName="w-full h-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center text-sm"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate max-w-[180px] sm:max-w-none">{profile.full_name}</h4>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        profile.status === 'active' || profile.status === 'approved'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : profile.status === 'pending'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        · {profile.status}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${
                          profile.lgpd_accepted_at
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                        title={
                          profile.lgpd_accepted_at
                            ? `Aceite LGPD registrado em ${new Date(profile.lgpd_accepted_at).toLocaleString('pt-BR')}`
                            : 'Termo LGPD pendente de aceite'
                        }
                      >
                        · {profile.lgpd_accepted_at ? 'LGPD Aceito' : 'LGPD Pendente'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{profile.email} · <strong className="text-slate-700 dark:text-slate-300 font-semibold">{profile.sector}</strong></p>
                  </div>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
                  <select
                    value={profile.role}
                    onChange={(e) => onUpdateUserRole(profile.id, e.target.value as UserRole)}
                    className="flex-1 sm:flex-initial text-xs rounded-lg px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-hidden min-w-[110px]"
                  >
                    <option value="viewer">Papel: Leitor</option>
                    <option value="editor">Papel: Editor</option>
                    <option value="admin">Papel: Admin</option>
                  </select>

                  <select
                    value={profile.status}
                    onChange={(e) => onUpdateUserStatus(profile.id, e.target.value as UserStatus)}
                    className="flex-1 sm:flex-initial text-xs rounded-lg px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-hidden min-w-[110px]"
                  >
                    <option value="active">Status: Ativo</option>
                    <option value="approved">Status: Aprovado</option>
                    <option value="pending">Status: Pendente</option>
                    <option value="blocked">Status: Bloqueado</option>
                    <option value="rejected">Status: Recusado</option>
                  </select>

                  {/* Botão de Exclusão de Usuário */}
                  <button
                    type="button"
                    id={`delete-user-${profile.id}`}
                    onClick={() => onDeleteUser(profile.id, profile.full_name || profile.email)}
                    className="p-2 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors border border-rose-100 dark:border-rose-900/50 hover:border-rose-300 shrink-0"
                    title={`Excluir ${profile.full_name || profile.email} permanentemente`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar logs por usuário ou ação..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl w-full bg-white dark:bg-[#091124] font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#DFB76C] outline-none"
                />
              </div>

              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-[#091124] font-medium text-slate-800 dark:text-slate-200 focus:border-[#DFB76C] outline-none cursor-pointer w-full sm:w-auto"
              >
                <option value="ALL">Todas as Ações</option>
                <option value="LOGIN">LOGIN</option>
                <option value="ACCESS_REQUEST">ACCESS_REQUEST</option>
                <option value="FILE_UPLOAD">FILE_UPLOAD</option>
                <option value="FILE_VIEW">FILE_VIEW</option>
                <option value="FILE_DOWNLOAD">FILE_DOWNLOAD</option>
                <option value="FOLDER_CREATE">FOLDER_CREATE</option>
                <option value="FOLDER_RENAME">FOLDER_RENAME</option>
                <option value="PERMISSION_CHANGE">PERMISSION_CHANGE</option>
                <option value="USER_APPROVED">USER_APPROVED</option>
                <option value="USER_DELETED">USER_DELETED</option>
                <option value="INADIMPLENCIA_CREATED">INADIMPLENCIA_CREATED</option>
                <option value="INADIMPLENCIA_PAYMENT">INADIMPLENCIA_PAYMENT</option>
                <option value="INADIMPLENCIA_SETTLED">INADIMPLENCIA_SETTLED</option>
              </select>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3">
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 font-medium">{filteredLogs.length} eventos</span>
              <button
                type="button"
                onClick={() => {
                  downloadCsvFile(
                    `mvrj-auditoria-${new Date().toISOString().slice(0, 10)}.csv`,
                    ['Data/Hora', 'Ação', 'Usuário', 'Setor', 'Alvo', 'ID Alvo', 'Detalhes'],
                    filteredLogs.map((log) => [
                      new Date(log.created_at).toLocaleString('pt-BR'),
                      log.action,
                      log.user_name,
                      log.sector,
                      log.target_type,
                      log.target_id,
                      JSON.stringify(log.details || {}),
                    ])
                  );
                }}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                title="Exportar relatório de auditoria para Excel (CSV)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar CSV</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#091124] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
            <table className="w-full text-left text-xs border-collapse min-w-[500px] sm:min-w-full">
              <thead>
                <tr className="bg-slate-50/90 dark:bg-[#070e1e] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="p-3">Data / Hora</th>
                  <th className="p-3">Ação</th>
                  <th className="p-3">Usuário</th>
                  <th className="p-3 hidden sm:table-cell">Setor</th>
                  <th className="p-3 hidden md:table-cell">Alvo</th>
                  <th className="p-3 hidden lg:table-cell">Detalhes Técnicos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap tabular-nums">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3">
                      <span className={`font-mono text-[10px] font-bold ${
                        log.action.includes('UPLOAD') || log.action.includes('DOWNLOAD')
                          ? 'text-blue-600 dark:text-blue-400'
                          : log.action.includes('PERMISSION') || log.action.includes('APPROVED')
                          ? 'text-purple-600 dark:text-purple-400'
                          : log.action.includes('REQUEST') || log.action.includes('INADIMPLENCIA')
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 font-sans font-semibold text-slate-900 dark:text-slate-100">{log.user_name}</td>
                    <td className="p-3 font-sans font-medium text-slate-600 dark:text-slate-300 hidden sm:table-cell">{log.sector}</td>
                    <td className="p-3 font-sans font-medium text-slate-500 dark:text-slate-400 hidden md:table-cell">{log.target_type}</td>
                    <td className="p-3 font-mono text-slate-500 dark:text-slate-400 font-normal max-w-xs truncate hidden lg:table-cell" title={JSON.stringify(log.details)}>
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: VISUAL IDENTITY & LOGIN CUSTOMIZATION */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          <AuthHeaderCustomizer
            currentUser={currentUser}
            currentConfig={authHeaderConfig || DEFAULT_AUTH_HEADER_CONFIG}
            onConfigChange={(newConf) => {
              if (onUpdateAuthHeaderConfig) {
                onUpdateAuthHeaderConfig(newConf);
              }
            }}
            onAuditLog={onAuditLog}
          />
        </div>
      )}

      {/* TAB 6: CONTROLE DE INADIMPLÊNCIA & COBRANÇA */}
      {activeTab === 'inadimplencia' && (
        <InadimplenciaPanel
          currentUser={currentUser}
          profiles={profiles}
          onCountChange={onInadimplenciaCountChange}
          onAuditLog={onInadimplenciaAuditLog}
        />
      )}

      {/* Rename Folder Modal (Admin) */}
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
                  <FolderTree className="w-4 h-4 text-slate-400 shrink-0" />
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
    </div>
  );
};
