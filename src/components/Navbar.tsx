import React from 'react';
import { 
  FileText, 
  ShieldCheck, 
  Users, 
  LogOut, 
  ChevronDown, 
  FolderLock,
  HardDrive,
  User,
  Camera,
  ScrollText,
  KeyRound,
  AlertOctagon,
  Palette
} from 'lucide-react';
import { UserProfile, UserRole, StorageMetrics } from '../types';
import { formatBytes } from '../lib/optimization';

interface NavbarProps {
  currentUser: UserProfile | null;
  activeView: 'drive' | 'admin';
  onNavigate: (view: 'drive' | 'admin') => void;
  onOpenSqlModal: () => void;
  onOpenProfileModal: (tab?: 'profile' | 'security') => void;
  onOpenLgpdModal?: () => void;
  onOpenFirstAccessModal?: () => void;
  onOpenBackgroundModal?: () => void;
  onSwitchUser: (profile: UserProfile) => void;
  onLogout: () => void;
  allProfiles: UserProfile[];
  r2Status?: { isConfigured: boolean; bucketName: string; mode: string };
  storageMetrics?: StorageMetrics | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeView,
  onNavigate,
  onOpenSqlModal,
  onOpenProfileModal,
  onOpenLgpdModal,
  onOpenFirstAccessModal,
  onOpenBackgroundModal,
  onSwitchUser,
  onLogout,
  allProfiles,
  r2Status,
  storageMetrics,
}) => {
  const [showUserDropdown, setShowUserDropdown] = React.useState(false);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-purple-100 text-purple-800 border border-purple-200">Admin</span>;
      case 'editor':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-blue-100 text-blue-800 border border-blue-200">Editor</span>;
      case 'viewer':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-gray-100 text-gray-700 border border-gray-200">Leitor</span>;
    }
  };

  const pendingUsersCount = allProfiles.filter(p => p.status === 'pending').length;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onNavigate('drive')}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                <FolderLock className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-extrabold text-xl tracking-tight text-gray-900">MVRJ</span>
                  <span className="text-xl font-medium tracking-tight text-indigo-600">CONTÁBIL</span>
                  <span className="ml-1 text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded-sm">GED</span>
                </div>
                <p className="text-[11px] text-gray-500 font-medium leading-none">Gestão Eletrônica de Documentos</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            {currentUser && currentUser.status === 'active' && (
              <nav className="hidden md:flex items-center space-x-1 ml-6 pl-6 border-l border-gray-200">
                <button
                  id="nav-drive-btn"
                  onClick={() => onNavigate('drive')}
                  className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-2 ${
                    activeView === 'drive'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <HardDrive className="w-4 h-4" />
                  <span>Drive Corporativo</span>
                </button>

                {currentUser.role === 'admin' && (
                  <button
                    id="nav-admin-btn"
                    onClick={() => onNavigate('admin')}
                    className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-2 relative ${
                      activeView === 'admin'
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Painel Admin & RBAC</span>
                    {pendingUsersCount > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.2 bg-amber-500 text-white text-[11px] font-bold rounded-full animate-pulse">
                        {pendingUsersCount}
                      </span>
                    )}
                  </button>
                )}

                {currentUser.role === 'admin' && onOpenBackgroundModal && (
                  <button
                    id="nav-background-btn"
                    type="button"
                    onClick={onOpenBackgroundModal}
                    className="px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-1.5 text-purple-700 hover:bg-purple-50 hover:text-purple-800 cursor-pointer"
                    title="Mudar Fundo do Site & Cabeçalho de Login (Exclusivo Administrador)"
                  >
                    <Palette className="w-4 h-4 text-purple-600" />
                    <span className="hidden lg:inline">Aparência & Marca</span>
                  </button>
                )}
              </nav>
            )}
          </div>

          {/* Right Action Tools & User Profile */}
          <div className="flex items-center space-x-3">
            {/* Supabase & R2 Status Badge */}
            <div 
              id="navbar-cloud-status"
              className="hidden lg:flex items-center space-x-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full shadow-2xs"
              title="Banco de dados Supabase e Armazenamento Cloudflare R2 ativos e sincronizados"
            >
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-semibold text-slate-700">Supabase</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="font-semibold text-slate-700">Cloudflare R2</span>
              </div>
            </div>

            {/* Storage Quota Indicator: Oculto por padrão, aparece apenas se o limite for atingido */}
            {storageMetrics && (storageMetrics.usedBytes >= (storageMetrics.totalCapacityBytes || 10 * 1024 * 1024 * 1024) || storageMetrics.usedPercent >= 100) && (
              <div 
                id="navbar-storage-indicator"
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-300 font-bold text-xs animate-pulse"
                title="Capacidade máxima de armazenamento atingida. Suporte TI: (21) 97396-0077"
              >
                <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                <span>Limite R2 Atingido (100%)</span>
              </div>
            )}

            {/* Current User Profile & Quick Switch Dropdown */}
            {currentUser && (
              <div className="relative">
                <button
                  id="user-profile-menu-btn"
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center space-x-2.5 p-1.5 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-xs border border-white">
                    {currentUser.avatar_url ? (
                      <img 
                        src={currentUser.avatar_url} 
                        alt={currentUser.full_name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{currentUser.full_name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-bold text-gray-800 leading-tight truncate max-w-[140px]">{currentUser.full_name}</p>
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      <span className="text-[10px] text-gray-500 font-medium">{currentUser.sector}</span>
                      {getRoleBadge(currentUser.role)}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {/* Dropdown Menu */}
                {showUserDropdown && (
                  <div 
                    className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    <div className="px-4 py-2.5 border-b border-gray-100 flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-sm flex items-center justify-center shadow-xs shrink-0">
                        {currentUser.avatar_url ? (
                          <img 
                            src={currentUser.avatar_url} 
                            alt={currentUser.full_name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{currentUser.full_name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="truncate flex-1">
                        <p className="text-xs font-bold text-gray-900 truncate">{currentUser.full_name}</p>
                        <p className="text-[11px] text-gray-500 truncate">{currentUser.email}</p>
                        <div className="flex items-center space-x-1.5 mt-1">
                          <span className="text-[10px] text-gray-600 font-medium">{currentUser.sector}</span>
                          {getRoleBadge(currentUser.role)}
                        </div>
                      </div>
                    </div>

                    {/* Edit Profile & Photo Action */}
                    <div className="p-1.5 border-b border-gray-100 space-y-1">
                      <button
                        id="open-edit-profile-btn"
                        type="button"
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenProfileModal('profile');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50/80 hover:bg-blue-100 transition-colors flex items-center justify-between group"
                      >
                        <span className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                          <span>Meu Perfil & Foto</span>
                        </span>
                        <span className="text-[10px] bg-blue-200/70 text-blue-800 px-1.5 py-0.5 rounded font-bold">
                          Perfil
                        </span>
                      </button>

                      <button
                        id="open-password-profile-btn"
                        type="button"
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenProfileModal('security');
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between group"
                      >
                        <span className="flex items-center space-x-2">
                          <KeyRound className="w-4 h-4 text-amber-600" />
                          <span>Trocar Senha (No Perfil)</span>
                        </span>
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                          Opcional
                        </span>
                      </button>

                      {onOpenLgpdModal && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserDropdown(false);
                            onOpenLgpdModal();
                          }}
                          className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between group"
                        >
                          <span className="flex items-center space-x-2">
                            <ScrollText className="w-4 h-4 text-emerald-600" />
                            <span>Termo de Acesso & LGPD</span>
                          </span>
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                            Ativo
                          </span>
                        </button>
                      )}

                      {currentUser.role === 'admin' && onOpenBackgroundModal && (
                        <button
                          id="dropdown-open-background-btn"
                          type="button"
                          onClick={() => {
                            setShowUserDropdown(false);
                            onOpenBackgroundModal();
                          }}
                          className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-700 hover:bg-purple-50 transition-colors flex items-center justify-between group cursor-pointer"
                        >
                          <span className="flex items-center space-x-2">
                            <Palette className="w-4 h-4 text-purple-600 group-hover:rotate-12 transition-transform" />
                            <span>Aparência & Identidade Visual</span>
                          </span>
                          <span className="text-[10px] text-purple-800 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded font-bold">
                            Admin
                          </span>
                        </button>
                      )}
                    </div>

                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1">
                        Alternar Usuário de Teste (RBAC)
                      </p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {allProfiles.map((profile) => (
                          <button
                            key={profile.id}
                            onClick={() => {
                              onSwitchUser(profile);
                              setShowUserDropdown(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center justify-between transition-colors ${
                              profile.id === currentUser.id
                                ? 'bg-blue-50 text-blue-700 font-bold'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-center space-x-2 truncate pr-2">
                              <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
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
                              <div className="truncate">
                                <span className="block truncate">{profile.full_name}</span>
                                <span className="text-[10px] text-gray-400 block">{profile.sector} • {profile.status}</span>
                              </div>
                            </div>
                            {getRoleBadge(profile.role)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="px-2 pt-1">
                      <button
                        id="logout-btn"
                        onClick={() => {
                          setShowUserDropdown(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg flex items-center space-x-2 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sair da Conta</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
