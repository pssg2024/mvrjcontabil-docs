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
  Palette,
  Eye,
  EyeOff,
  Globe,
  Wrench
} from 'lucide-react';
import { UserProfile, UserRole, StorageMetrics, AuthHeaderConfig } from '../types';
import { formatBytes } from '../lib/optimization';
import { PortalsDrawer } from './PortalsDrawer';

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
  authHeaderConfig?: AuthHeaderConfig;
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
  authHeaderConfig,
}) => {
  const [showUserDropdown, setShowUserDropdown] = React.useState(false);
  const [showPortalsDrawer, setShowPortalsDrawer] = React.useState(false);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <span className="bg-[#C59B4B]/15 text-[#C59B4B] border border-[#C59B4B]/30 font-medium text-[11px] px-2 py-0.5 rounded-full">Admin</span>;
      case 'editor':
        return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200/70">Editor</span>;
      case 'viewer':
        return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200/70">Leitor</span>;
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
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center text-white shadow-sm ring-1 ring-black/5 group-hover:scale-105 transition-transform duration-200 overflow-hidden">
                {authHeaderConfig?.logoType === 'image' && authHeaderConfig?.logoImageUrl ? (
                  <img
                    src={authHeaderConfig.logoImageUrl}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FolderLock className="w-5 h-5 text-white" />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-extrabold text-lg tracking-tight text-[#112354]">MVRJ</span>
                  <span className="font-bold text-lg tracking-tight text-[#C59B4B]">CONTÁBIL</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium tracking-normal leading-none mt-0.5">Gestão Eletrônica de Documentos</p>
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
            
            {/* Portals Drawer Trigger */}
            <button
              onClick={() => setShowPortalsDrawer(true)}
              className="bg-slate-100 hover:bg-slate-200 text-[#1B357B] font-medium text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all"
            >
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">Portais Fiscais</span>
            </button>

            {/* Utilities Page Trigger */}
            <button
              onClick={() => onNavigate('tools')}
              className={`font-medium text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
                activeView === 'tools'
                  ? 'bg-[#1B357B] text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-[#1B357B]'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span className="hidden sm:inline">Ferramentas</span>
            </button>

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
                    className="absolute right-0 mt-2 min-w-[280px] bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/80 p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    <div className="bg-slate-50 border-b border-slate-100 p-3.5 rounded-t-xl flex items-center space-x-3 mb-1">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#112354] to-[#1B357B] text-white font-bold text-sm flex items-center justify-center shadow-xs shrink-0">
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
                        <p className="font-semibold text-sm text-[#112354] truncate">{currentUser.full_name}</p>
                        <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                        <div className="flex items-center space-x-1.5 mt-1.5">
                          <span className="bg-slate-200 text-slate-700 text-[11px] px-2 py-0.5 rounded-full">{currentUser.sector}</span>
                          {getRoleBadge(currentUser.role)}
                        </div>
                      </div>
                    </div>

                    {/* Actions List */}
                    <div className="space-y-0.5">
                      <button
                        id="open-edit-profile-btn"
                        type="button"
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenProfileModal('profile');
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100/80 transition-all flex items-center space-x-3 group cursor-pointer"
                      >
                        <User className="w-4 h-4 text-slate-500 group-hover:text-[#1B357B] transition-colors" />
                        <span>Meu Perfil</span>
                      </button>

                      <button
                        id="open-password-profile-btn"
                        type="button"
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenProfileModal('security');
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100/80 transition-all flex items-center space-x-3 group cursor-pointer"
                      >
                        <KeyRound className="w-4 h-4 text-slate-500 group-hover:text-[#1B357B] transition-colors" />
                        <span>Segurança & Senha</span>
                      </button>

                      {onOpenLgpdModal && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserDropdown(false);
                            onOpenLgpdModal();
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100/80 transition-all flex items-center space-x-3 group cursor-pointer"
                        >
                          <ScrollText className="w-4 h-4 text-slate-500 group-hover:text-[#1B357B] transition-colors" />
                          <span>Termos & Conformidade LGPD</span>
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
                          className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100/80 transition-all flex items-center space-x-3 group cursor-pointer"
                        >
                          <Palette className="w-4 h-4 text-slate-500 group-hover:text-[#1B357B] transition-colors" />
                          <span>Identidade Visual</span>
                        </button>
                      )}
                    </div>

                    {/* Logout Item */}
                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <button
                        id="logout-btn"
                        onClick={() => {
                          setShowUserDropdown(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl flex items-center gap-3 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 shrink-0" />
                        <span>Sair da Conta</span>
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
      <PortalsDrawer isOpen={showPortalsDrawer} onClose={() => setShowPortalsDrawer(false)} />
    </header>
  );
};
