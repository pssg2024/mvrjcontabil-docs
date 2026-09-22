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
  RefreshCw
} from 'lucide-react';
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
import { BackgroundCustomizer } from './BackgroundCustomizer';
import { AuthHeaderCustomizer } from './AuthHeaderCustomizer';
import { DEFAULT_AUTH_HEADER_CONFIG } from '../lib/storage-service';

interface AdminPanelProps {
  currentUser: UserProfile;
  profiles: UserProfile[];
  folders: Folder[];
  folderPermissions: FolderPermission[];
  auditLogs: AuditLog[];
  siteBackgroundConfig?: SiteBackgroundConfig;
  authHeaderConfig?: AuthHeaderConfig;
  initialTab?: 'pending' | 'matrix' | 'users' | 'audit' | 'appearance';
  onApproveUser: (userId: string, role: UserRole, sector?: Sector) => void;
  onRejectUser: (userId: string) => void;
  onDeleteUser: (userId: string, userName?: string) => void;
  onUpdateUserStatus: (userId: string, status: UserStatus) => void;
  onUpdateUserRole: (userId: string, role: UserRole) => void;
  onUpdateFolderPermission: (folderId: string, profileId: string, level: PermissionLevel | 'none') => void;
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
  onApproveUser,
  onRejectUser,
  onDeleteUser,
  onUpdateUserStatus,
  onUpdateUserRole,
  onUpdateFolderPermission,
  onUpdateSiteBackgroundConfig,
  onUpdateAuthHeaderConfig,
  onAuditLog,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'matrix' | 'users' | 'audit' | 'appearance'>(initialTab);
  const [appearanceSubTab, setAppearanceSubTab] = useState<'site-bg' | 'auth-header'>('site-bg');
  const [selectedRoleForApproval, setSelectedRoleForApproval] = useState<Record<string, UserRole>>({});
  const [selectedSectorForApproval, setSelectedSectorForApproval] = useState<Record<string, Sector>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [auditFilter, setAuditFilter] = useState<string>('ALL');

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
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-purple-100 rounded-lg text-purple-700">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Painel de Governança & RBAC</h1>
              <p className="text-sm text-gray-500">Controle de acessos, aprovações de novos funcionários e matriz de segurança por setor</p>
            </div>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg flex items-center space-x-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span><strong>{pendingProfiles.length}</strong> pendentes de homologação</span>
          </div>
          <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-blue-600" />
            <span><strong>{profiles.filter(p => p.status === 'active').length}</strong> ativos</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation - Executive Segmented Control */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80 mb-6 max-w-full">
        <button
          id="tab-admin-pending"
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-xs font-medium flex items-center space-x-2 whitespace-nowrap transition-all rounded-xl ${
            activeTab === 'pending'
              ? 'bg-[#1B357B] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Clock className={`w-4 h-4 ${activeTab === 'pending' ? 'text-[#DFB76C]' : 'text-slate-500'}`} />
          <span>Solicitações</span>
          {pendingProfiles.length > 0 && (
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${activeTab === 'pending' ? 'bg-[#C59B4B] text-white' : 'bg-amber-500 text-white'}`}>
              {pendingProfiles.length}
            </span>
          )}
        </button>

        <button
          id="tab-admin-matrix"
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2 text-xs font-medium flex items-center space-x-2 whitespace-nowrap transition-all rounded-xl ${
            activeTab === 'matrix'
              ? 'bg-[#1B357B] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <FolderLock className={`w-4 h-4 ${activeTab === 'matrix' ? 'text-[#DFB76C]' : 'text-slate-500'}`} />
          <span>Permissões</span>
        </button>

        <button
          id="tab-admin-users"
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-xs font-medium flex items-center space-x-2 whitespace-nowrap transition-all rounded-xl ${
            activeTab === 'users'
              ? 'bg-[#1B357B] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <UserCog className={`w-4 h-4 ${activeTab === 'users' ? 'text-[#DFB76C]' : 'text-slate-500'}`} />
          <span>Usuários</span>
        </button>

        <button
          id="tab-admin-audit"
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 text-xs font-medium flex items-center space-x-2 whitespace-nowrap transition-all rounded-xl ${
            activeTab === 'audit'
              ? 'bg-[#1B357B] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <History className={`w-4 h-4 ${activeTab === 'audit' ? 'text-[#DFB76C]' : 'text-slate-500'}`} />
          <span>Auditoria</span>
        </button>

        <button
          id="tab-admin-appearance"
          onClick={() => setActiveTab('appearance')}
          className={`px-4 py-2 text-xs font-medium flex items-center space-x-2 whitespace-nowrap transition-all rounded-xl ${
            activeTab === 'appearance'
              ? 'bg-[#1B357B] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Palette className={`w-4 h-4 ${activeTab === 'appearance' ? 'text-[#DFB76C]' : 'text-slate-500'}`} />
          <span>Personalização</span>
          {siteBackgroundConfig?.enabled && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-xs" title="Fundo personalizado ativo" />
          )}
        </button>
      </div>

      {/* TAB 1: PENDING ACCESS REQUESTS */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-4 flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-[#1B357B] shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 leading-relaxed font-medium">
              Controle de Adesão: Novos cadastros de colaboradores permanecem retidos nesta fila até a aprovação formal e definição de setor pelo Administrador.
            </div>
          </div>

          {pendingProfiles.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm p-10 text-center">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-[#112354]">Nenhuma solicitação pendente</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Não há novos colaboradores aguardando liberação de acesso no momento.
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center space-x-2 text-xs font-medium text-[#1B357B] bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
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
                className="inline-flex items-center space-x-2 text-xs font-medium text-[#1B357B] bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
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
                  <div key={profile.id} className="bg-white rounded-xl border border-amber-300 shadow-sm p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-bl-lg">
                      Aguardando Homologação
                    </div>

                    <div className="flex items-start space-x-3.5 mb-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-tr from-amber-500 to-orange-500 text-white font-black text-lg flex items-center justify-center shadow-xs shrink-0 border border-amber-200">
                        {profile.avatar_url ? (
                          <img 
                            src={profile.avatar_url} 
                            alt={profile.full_name} 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          profile.full_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="pr-12">
                        <h4 className="font-bold text-gray-900 text-sm leading-snug">{profile.full_name}</h4>
                        <p className="text-xs text-gray-500">{profile.email}</p>
                        <div className="flex items-center space-x-2 mt-1.5">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                            Setor: {profile.sector}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            Cadastrado em {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100">
                      {/* Definir Setor / Departamento */}
                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Definir Setor / Departamento de Atuação:
                        </label>
                        <select
                          id={`select-sector-${profile.id}`}
                          value={selectedSectorForApproval[profile.id] || profile.sector}
                          onChange={(e) => setSelectedSectorForApproval(prev => ({ ...prev, [profile.id]: e.target.value as Sector }))}
                          className="w-full text-xs py-1.5 px-2.5 border border-gray-300 rounded-lg bg-white font-medium text-gray-800 outline-hidden focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="Fiscal">Fiscal</option>
                          <option value="Departamento Pessoal">Departamento Pessoal (DP)</option>
                          <option value="Contábil">Contábil</option>
                          <option value="Financeiro">Financeiro</option>
                          <option value="Diretoria">Diretoria</option>
                          <option value="Geral">Geral</option>
                        </select>
                      </div>

                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Definir Papel na Aprovação:
                      </label>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => setSelectedRoleForApproval(prev => ({ ...prev, [profile.id]: 'viewer' }))}
                          className={`p-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                            chosenRole === 'viewer' || chosenRole === 'User'
                              ? 'bg-gray-800 text-white border-gray-900'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          Leitor (User)
                          <span className="block text-[10px] opacity-75 font-normal">Visualizar + Upload</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedRoleForApproval(prev => ({ ...prev, [profile.id]: 'editor' }))}
                          className={`p-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                            chosenRole === 'editor'
                              ? 'bg-blue-600 text-white border-blue-700'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          Editor
                          <span className="block text-[10px] opacity-75 font-normal">Criar, Baixar e Compartilhar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedRoleForApproval(prev => ({ ...prev, [profile.id]: 'admin' }))}
                          className={`p-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                            chosenRole === 'admin'
                              ? 'bg-purple-600 text-white border-purple-700'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          Admin
                          <span className="block text-[10px] opacity-75 font-normal">Controle Total</span>
                        </button>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          id={`approve-user-${profile.id}`}
                          onClick={() => {
                            const finalSector = selectedSectorForApproval[profile.id] || profile.sector;
                            onApproveUser(profile.id, chosenRole, finalSector);
                          }}
                          className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors shadow-2xs"
                        >
                          <Check className="w-4 h-4" />
                          <span>Aprovar Acesso</span>
                        </button>

                        <button
                          id={`reject-user-${profile.id}`}
                          onClick={() => onRejectUser(profile.id)}
                          className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 transition-colors"
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm text-gray-900">Matriz de Acessos por Pasta e Setor</h3>
              <p className="text-xs text-gray-500">Defina o nível individual de permissão de cada colaborador em cada pasta do GED.</p>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <span className="inline-flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span> <span>Nenhum</span></span>
              <span className="inline-flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span> <span>Leitor</span></span>
              <span className="inline-flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> <span>Editor</span></span>
              <span className="inline-flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span> <span>Admin</span></span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-700">
                  <th className="p-3 font-bold sticky left-0 bg-gray-100 min-w-[220px] z-10">Pasta / Setor</th>
                  {activeProfiles.map(p => (
                    <th key={p.id} className="p-3 font-semibold text-center min-w-[150px]">
                      <div className="font-bold text-gray-900 truncate max-w-[140px] mx-auto">{p.full_name}</div>
                      <div className="text-[10px] text-gray-500 font-normal">{p.sector} • {p.role}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {folders.map(folder => (
                  <tr key={folder.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-3 font-medium text-gray-900 sticky left-0 bg-white shadow-xs z-10">
                      <div className="flex items-center space-x-2">
                        <FolderTree className="w-4 h-4 text-blue-600 shrink-0" />
                        <div>
                          <span className="font-bold block text-xs">{folder.name}</span>
                          <span className="text-[10px] text-gray-500">{folder.sector}</span>
                        </div>
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
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200" title="Acesso total herdado do papel de Administrador Global / Diretoria">
                              Admin Total
                            </span>
                          ) : (
                            <select
                              value={currentPerm}
                              onChange={(e) => onUpdateFolderPermission(folder.id, profile.id, e.target.value as any)}
                              className={`text-xs rounded-md px-2 py-1 border font-medium outline-hidden transition-all ${
                                currentPerm === 'admin'
                                  ? 'bg-purple-50 text-purple-800 border-purple-300 font-bold'
                                  : currentPerm === 'editor'
                                  ? 'bg-blue-50 text-blue-800 border-blue-300 font-bold'
                                  : currentPerm === 'viewer'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold'
                                  : 'bg-white text-gray-400 border-gray-200'
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="font-bold text-sm text-gray-900">Colaboradores Cadastrados</h3>
            <span className="text-xs text-gray-500">Total: {profiles.length} usuários</span>
          </div>

          <div className="divide-y divide-gray-100">
            {profiles.map(profile => (
              <div key={profile.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-sm shrink-0 border border-slate-300">
                    {profile.avatar_url ? (
                      <img 
                        src={profile.avatar_url} 
                        alt={profile.full_name} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      profile.full_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-sm text-gray-900">{profile.full_name}</h4>
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        profile.status === 'active' || profile.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : profile.status === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {profile.status}
                      </span>
                      {profile.lgpd_accepted_at ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200" title={`Aceite LGPD registrado em ${new Date(profile.lgpd_accepted_at).toLocaleString('pt-BR')}`}>
                          LGPD: Aceito
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          LGPD: Pendente
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{profile.email} • Setor: <strong className="text-gray-700">{profile.sector}</strong></p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <select
                    value={profile.role}
                    onChange={(e) => onUpdateUserRole(profile.id, e.target.value as UserRole)}
                    className="text-xs rounded-lg px-2.5 py-1.5 border border-gray-300 bg-white font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 outline-hidden"
                  >
                    <option value="viewer">Papel: Leitor</option>
                    <option value="editor">Papel: Editor</option>
                    <option value="admin">Papel: Admin</option>
                  </select>

                  <select
                    value={profile.status}
                    onChange={(e) => onUpdateUserStatus(profile.id, e.target.value as UserStatus)}
                    className="text-xs rounded-lg px-2.5 py-1.5 border border-gray-300 bg-white font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 outline-hidden"
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
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100 hover:border-rose-300"
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
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar logs por usuário ou ação..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl w-64 bg-white font-bold text-slate-950 placeholder:text-slate-500 focus:border-blue-600 outline-none shadow-2xs"
                />
              </div>

              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white font-bold text-slate-900 focus:border-blue-600 outline-none shadow-2xs cursor-pointer"
              >
                <option value="ALL">Todas as Ações</option>
                <option value="LOGIN">LOGIN</option>
                <option value="ACCESS_REQUEST">ACCESS_REQUEST</option>
                <option value="FILE_UPLOAD">FILE_UPLOAD</option>
                <option value="PERMISSION_CHANGE">PERMISSION_CHANGE</option>
                <option value="USER_APPROVED">USER_APPROVED</option>
              </select>
            </div>

            <span className="text-xs text-slate-700 font-bold">Exibindo {filteredLogs.length} eventos de auditoria</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-900 font-black">
                  <th className="p-3">Data / Hora</th>
                  <th className="p-3">Ação</th>
                  <th className="p-3">Usuário</th>
                  <th className="p-3">Setor</th>
                  <th className="p-3">Alvo</th>
                  <th className="p-3">Detalhes Técnicos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-slate-700 font-semibold whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-black border ${
                        log.action.includes('UPLOAD')
                          ? 'bg-blue-100 text-blue-950 border-blue-300'
                          : log.action.includes('PERMISSION') || log.action.includes('APPROVED')
                          ? 'bg-purple-100 text-purple-950 border-purple-300'
                          : log.action.includes('REQUEST')
                          ? 'bg-amber-100 text-amber-950 border-amber-300'
                          : 'bg-slate-100 text-slate-900 border-slate-300'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 font-sans font-bold text-slate-950">{log.user_name}</td>
                    <td className="p-3 font-sans font-semibold text-slate-800">{log.sector}</td>
                    <td className="p-3 font-sans font-semibold text-slate-700">{log.target_type}</td>
                    <td className="p-3 font-mono text-slate-800 font-medium max-w-xs truncate" title={JSON.stringify(log.details)}>
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SITE BACKGROUND & VISUAL APPEARANCE */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          {/* Sub-tabs for Appearance */}
          <div className="flex items-center space-x-2 bg-gray-100 p-1.5 rounded-2xl w-fit border border-gray-200">
            <button
              id="subtab-site-bg"
              type="button"
              onClick={() => setAppearanceSubTab('site-bg')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                appearanceSubTab === 'site-bg'
                  ? 'bg-white text-purple-700 shadow-xs border border-gray-200 font-black'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Palette className="w-4 h-4 text-purple-600" />
              <span>Fundo Geral do Site</span>
            </button>
            <button
              id="subtab-auth-header"
              type="button"
              onClick={() => setAppearanceSubTab('auth-header')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                appearanceSubTab === 'auth-header'
                  ? 'bg-white text-blue-700 shadow-xs border border-gray-200 font-black'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Lock className="w-4 h-4 text-blue-600" />
              <span>Cabeçalho de Login & Boas-Vindas</span>
            </button>
          </div>

          {appearanceSubTab === 'site-bg' ? (
            <BackgroundCustomizer
              currentUser={currentUser}
              currentConfig={siteBackgroundConfig || {
                enabled: false,
                imageUrl: '',
                presetId: 'none',
                opacity: 25,
                blur: 0,
                overlayType: 'light',
                overlayOpacity: 40,
                position: 'cover',
              }}
              onConfigChange={(newConf) => {
                if (onUpdateSiteBackgroundConfig) {
                  onUpdateSiteBackgroundConfig(newConf);
                }
              }}
              onAuditLog={onAuditLog}
            />
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
};
