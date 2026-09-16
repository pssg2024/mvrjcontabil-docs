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
        return <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded bg-purple-50 text-purple-700 border border-purple-200/70">Admin</span>;
      case 'editor':
        return <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200/70">Editor</span>;
      case 'viewer':
        return <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded bg-slate-100 text-slate-600 border border-slate-200/70">Leitor</span>;
    }
  };

  const pendingUsersCount = allProfiles.filter(p => p.status === 'pending').length;

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-5">
            <div 
              className="flex items-center space-x-3 cursor-pointer group select-none" 
              onClick={() => onNavigate('drive')}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center text-white shadow-sm ring-1 ring-black/5 group-hover:scale-105 transition-transform duration-200">
                <FolderLock className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-extrabold text-lg tracking-tight text-slate-900">MVRJ</span>
                  <span className="font-bold text-lg tracking-tight text-indigo-600">CONTÁBIL</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-md">GED</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium tracking-normal leading-none mt-0.5">Gestão Eletrônica de Documentos</p>
              </div>
            </div>

            {/* Navigation Tabs - Modern Segmented Control */}
            {currentUser && (currentUser.status === 'active' || currentUser.status === 'approved') && (
              <nav className="hidden md:flex items-center p-1 bg-slate-100/90 border border-slate-200/70 rounded-xl shadow-inner-xs ml-3">
                <button
                  id="nav-drive-btn"
                  onClick={() => onNavigate('drive')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-2 ${
                    activeView === 'drive'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <HardDrive className={`w-3.5 h-3.5 ${activeView === 'drive' ? 'text-indigo-600' : 'text-slate-500'}`} />
                  <span>Drive Corporativo</span>
                </button>

                {currentUser.role === 'admin' && (
                  <button
                    id="nav-admin-btn"
                    onClick={() => onNavigate('admin')}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-2 relative ${
                      activeView === 'admin'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <ShieldCheck className={`w-3.5 h-3.5 ${activeView === 'admin' ? 'text-indigo-600' : 'text-slate-500'}`} />
                    <span>Painel Admin & RBAC</span>
                    {pendingUsersCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white shadow-2xs animate-pulse">
                        {pendingUsersCount}
                      </span>
                    )}
                  </button>
                )}
              </nav>
            )}
          </div>

          {/* Right Action Tools & User Profile */}
          <div className="flex items-center space-x-3">
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
            {currentUser ? (
              <div className="relative">
                <button
                  id="user-profile-menu-btn"
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center space-x-3 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50/90 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center ring-1 ring-slate-200/80 shadow-2xs">
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
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                  </div>

                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[150px] group-hover:text-indigo-600 transition-colors">
                      {currentUser.full_name}
                    </p>
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      <span className="text-[10px] text-slate-500 font-medium">{currentUser.sector}</span>
                      <span className="text-slate-300 text-[10px]">•</span>
                      {getRoleBadge(currentUser.role)}
                    </div>
                  </div>

                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform duration-150 ${showUserDropdown ? 'rotate-180 text-indigo-600' : ''}`} />
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

                    <div className="px-2 pt-1 border-t border-gray-100">
                      <button
                        id="logout-btn"
                        onClick={() => {
                          setShowUserDropdown(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg flex items-center space-x-2 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sair da Conta (Logout)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                id="navbar-login-btn"
                onClick={onLogout}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <span>Acessar o Drive</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
