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
  Building2,
  Bell,
  Menu,
  X
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
  onOpenCompanyModal?: () => void;
  onOpenDueNoticeModal?: () => void;
  dueAlertCount?: number;
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
  onOpenCompanyModal,
  onOpenDueNoticeModal,
  dueAlertCount,
  onSwitchUser,
  onLogout,
  allProfiles,
  r2Status,
  storageMetrics,
  authHeaderConfig,
}) => {
  const [showUserDropdown, setShowUserDropdown] = React.useState(false);
  const [showPortalsDrawer, setShowPortalsDrawer] = React.useState(false);
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="bg-[#C59B4B]/15 text-[#9A7528] border border-[#C59B4B]/30 font-bold px-1.5 py-0.2 rounded-md text-[9px] uppercase tracking-wider">
            Admin
          </span>
        );
      case 'editor':
        return (
          <span className="bg-blue-50 text-blue-700 border border-blue-200 font-bold px-1.5 py-0.2 rounded-md text-[9px] uppercase tracking-wider">
            Editor
          </span>
        );
      case 'viewer':
        return (
          <span className="bg-slate-100 text-slate-600 border border-slate-200 font-bold px-1.5 py-0.2 rounded-md text-[9px] uppercase tracking-wider">
            Leitor
          </span>
        );
    }
  };

  const pendingUsersCount = allProfiles.filter(p => p.status === 'pending').length;

  return (
    <header className="sticky top-0 z-30 w-full px-3 sm:px-6 lg:px-8 py-2.5 transition-all">
      {/* 1. CONTAINER PRINCIPAL DA NAVEGAÇÃO */}
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-sm">
        {/* Logo & Brand (Sempre visível em dispositivos móveis e desktop) */}
        <div 
          className="flex items-center gap-2.5 flex-shrink-0 cursor-pointer group select-none pl-1 sm:pl-2 h-11" 
          onClick={() => onNavigate('drive')}
        >
          {/* Ícone da Logo */}
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white border border-slate-200/80 p-1.5 shadow-sm flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200 overflow-hidden">
            {authHeaderConfig?.logoImageUrl ? (
              <img
                src={authHeaderConfig.logoImageUrl}
                alt="Logo MVRJ"
                className="w-full h-full object-contain"
              />
            ) : (
              <FolderLock className="w-5 h-5 text-[#0B1736]" />
            )}
          </div>

          {/* Textos da Empresa (Sempre visíveis) */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-1 leading-none">
              <span className="font-black text-sm sm:text-base text-[#0B1736] tracking-tight">MVRJ</span>
              <span className="font-black text-sm sm:text-base text-[#C59B4B] tracking-tight">CONTÁBIL</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium tracking-normal mt-0.5 leading-none">
              Gestão Eletrônica
            </span>
          </div>
        </div>

        {/* 2. BOTÕES DE NAVEGAÇÃO (DESKTOP: APENAS EM TELAS LG OU SUPERIORES) */}
        {currentUser && (currentUser.status === 'active' || currentUser.status === 'approved') && (
          <nav className="hidden lg:flex items-center gap-1.5">
            {/* Drive Corporativo */}
            <button
              id="nav-drive-btn"
              onClick={() => onNavigate('drive')}
              className={
                activeView === 'drive'
                  ? 'h-11 bg-gradient-to-r from-[#0F1E42] to-[#1B357B] text-white font-bold shadow-sm px-4 py-2 rounded-xl text-xs flex items-center gap-2.5 border border-white/10 transition-all duration-200 group cursor-pointer'
                  : 'h-11 flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#1B357B] hover:bg-slate-100/80 transition-all duration-200 group cursor-pointer'
              }
            >
              <HardDrive className={`w-4 h-4 flex-shrink-0 ${activeView === 'drive' ? 'text-[#E2C37A]' : 'text-slate-400 group-hover:text-[#1B357B]'}`} />
              <span>Drive Corporativo</span>
            </button>

            {/* Painel Admin & RBAC */}
            {currentUser.role === 'admin' && (
              <button
                id="nav-admin-btn"
                onClick={() => onNavigate('admin')}
                className={
                  activeView === 'admin'
                    ? 'h-11 bg-gradient-to-r from-[#0F1E42] to-[#1B357B] text-white font-bold shadow-sm px-4 py-2 rounded-xl text-xs flex items-center gap-2.5 border border-white/10 transition-all duration-200 group cursor-pointer relative'
                    : 'h-11 flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#1B357B] hover:bg-slate-100/80 transition-all duration-200 group cursor-pointer relative'
                }
              >
                <ShieldCheck className={`w-4 h-4 flex-shrink-0 ${activeView === 'admin' ? 'text-[#E2C37A]' : 'text-slate-400 group-hover:text-[#1B357B]'}`} />
                <span>Painel Admin & RBAC</span>
                {pendingUsersCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white shadow-2xs animate-pulse">
                    {pendingUsersCount}
                  </span>
                )}
              </button>
            )}

            {/* Portais Fiscais */}
            <button
              id="navbar-portals-btn"
              onClick={() => setShowPortalsDrawer(true)}
              className="h-11 flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#1B357B] hover:bg-slate-100/80 transition-all duration-200 group cursor-pointer"
            >
              <Globe className="w-4 h-4 flex-shrink-0 text-slate-400 group-hover:text-[#1B357B]" />
              <span className="hidden xl:inline">Portais Fiscais</span>
            </button>

            {/* Consulta Rápida de CNPJ / Empresa */}
            {onOpenCompanyModal && (
              <button
                id="navbar-company-lookup-btn"
                onClick={onOpenCompanyModal}
                className="h-11 flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#1B357B] hover:bg-slate-100/80 transition-all duration-200 group cursor-pointer"
                title="Consulta Rápida de Situação Cadastral de Empresa na Receita Federal"
              >
                <Building2 className="w-4 h-4 flex-shrink-0 text-slate-400 group-hover:text-[#1B357B]" />
                <span className="hidden xl:inline">Consultar Empresa / CNPJ</span>
                <span className="xl:hidden hidden lg:inline">CNPJ</span>
              </button>
            )}

            {/* Central de Avisos de Vencimento */}
            {onOpenDueNoticeModal && (
              <button
                id="navbar-due-notices-btn"
                onClick={onOpenDueNoticeModal}
                className="h-11 flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#1B357B] hover:bg-slate-100/80 transition-all duration-200 group cursor-pointer relative"
                title="Central de Disparos de Vencimentos de Guias via WhatsApp"
              >
                <Bell className="w-4 h-4 flex-shrink-0 text-slate-400 group-hover:text-[#1B357B]" />
                <span className="hidden xl:inline">Avisos de Vencimento</span>
                <span className="xl:hidden hidden lg:inline">Avisos</span>
                {(dueAlertCount || 0) > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 bg-amber-500 text-slate-900 text-[10px] font-bold rounded-full ring-2 ring-white shadow-2xs">
                    {dueAlertCount}
                  </span>
                )}
              </button>
            )}
          </nav>
        )}

        {/* 3. CARD DE PERFIL DO UTILIZADOR (EXTREMO DIREITO) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Storage Quota Indicator: Oculto por padrão, aparece apenas se o limite for atingido */}
          {storageMetrics && (storageMetrics.usedBytes >= (storageMetrics.totalCapacityBytes || 10 * 1024 * 1024 * 1024) || storageMetrics.usedPercent >= 100) && (
            <div 
              id="navbar-storage-indicator"
              className="h-11 flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-800 border border-rose-300 font-bold text-xs animate-pulse"
              title="Capacidade máxima de armazenamento atingida. Suporte TI: (21) 97396-0077"
            >
              <AlertOctagon className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span className="hidden sm:inline">Limite R2 (100%)</span>
            </div>
          )}

          {currentUser ? (
            <div className="relative">
              <button
                id="user-profile-menu-btn"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="h-11 flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:border-[#C59B4B]/60 hover:shadow-sm transition-all cursor-pointer group"
              >
                {/* Avatar */}
                <div className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-slate-100 flex-shrink-0">
                  {currentUser.avatar_url ? (
                    <img 
                      src={currentUser.avatar_url} 
                      alt={currentUser.full_name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#0F1E42] to-[#1B357B] text-white font-bold text-xs flex items-center justify-center">
                      <span>{currentUser.full_name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white absolute bottom-0 right-0"></span>
                </div>

                {/* Textos */}
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[140px] group-hover:text-[#1B357B] transition-colors">
                    {currentUser.full_name}
                  </p>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <span className="truncate max-w-[80px]">{currentUser.sector}</span>
                    <span>•</span>
                    {getRoleBadge(currentUser.role)}
                  </div>
                </div>

                {/* Ícone Chevron */}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 ml-1 transition-transform group-hover:translate-y-0.5 ${showUserDropdown ? 'rotate-180 !text-[#1B357B]' : ''}`} />
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

            {/* 4. BOTÃO HAMBÚRGUER MOBILE (Visível apenas em ecrãs menores que lg / 1024px) */}
            {currentUser && (currentUser.status === 'active' || currentUser.status === 'approved') && (
              <button
                id="navbar-mobile-hamburger-btn"
                type="button"
                onClick={() => setShowMobileMenu(true)}
                className="lg:hidden flex items-center justify-center w-11 h-11 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 shadow-2xs transition-all cursor-pointer relative shrink-0"
                title="Abrir Menu de Navegação"
                aria-label="Abrir Menu Móvel"
              >
                <Menu className="w-5 h-5 text-slate-700" />
                {(pendingUsersCount > 0 || (dueAlertCount || 0) > 0) && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white"></span>
                )}
              </button>
            )}
          </div>
        </div>

      {/* 5. GAVETA LATERAL SUAVE MOBILE (DRAWER / OFFCANVAS) */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 lg:hidden animate-in fade-in duration-200">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setShowMobileMenu(false)}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-xs sm:max-w-sm bg-white shadow-2xl z-50 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-250 p-5">
            <div className="space-y-4">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0F1E42] to-[#1B357B] flex items-center justify-center text-white shadow-xs">
                    <FolderLock className="w-4 h-4 text-[#E2C37A]" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1">
                      <span className="font-extrabold text-sm tracking-tight text-[#0F1E42]">MVRJ</span>
                      <span className="font-bold text-sm tracking-tight text-[#C59B4B]">CONTÁBIL</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">Menu Principal</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMobileMenu(false)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="Fechar menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Card Summary in Mobile Drawer */}
              {currentUser && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-slate-200 shrink-0">
                    {currentUser.avatar_url ? (
                      <img 
                        src={currentUser.avatar_url} 
                        alt={currentUser.full_name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#0F1E42] to-[#1B357B] text-white font-bold text-sm flex items-center justify-center">
                        <span>{currentUser.full_name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white absolute bottom-0 right-0"></span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">{currentUser.full_name}</p>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span className="truncate">{currentUser.sector}</span>
                      <span>•</span>
                      {getRoleBadge(currentUser.role)}
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Items with comfortable large touch targets (h-12) */}
              <div className="flex flex-col gap-2 pt-1">
                {/* Drive Corporativo */}
                <button
                  onClick={() => {
                    onNavigate('drive');
                    setShowMobileMenu(false);
                  }}
                  className={`w-full h-12 rounded-xl flex items-center gap-3 px-4 font-bold text-sm transition-all cursor-pointer ${
                    activeView === 'drive'
                      ? 'bg-gradient-to-r from-[#0F1E42] to-[#1B357B] text-white shadow-sm border border-white/10'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70'
                  }`}
                >
                  <HardDrive className={`w-5 h-5 shrink-0 ${activeView === 'drive' ? 'text-[#E2C37A]' : 'text-[#1B357B]'}`} />
                  <span>Drive Corporativo</span>
                </button>

                {/* Painel Admin */}
                {currentUser?.role === 'admin' && (
                  <button
                    onClick={() => {
                      onNavigate('admin');
                      setShowMobileMenu(false);
                    }}
                    className={`w-full h-12 rounded-xl flex items-center justify-between px-4 font-bold text-sm transition-all cursor-pointer ${
                      activeView === 'admin'
                        ? 'bg-gradient-to-r from-[#0F1E42] to-[#1B357B] text-white shadow-sm border border-white/10'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ShieldCheck className={`w-5 h-5 shrink-0 ${activeView === 'admin' ? 'text-[#E2C37A]' : 'text-[#1B357B]'}`} />
                      <span>Painel Admin & RBAC</span>
                    </div>
                    {pendingUsersCount > 0 && (
                      <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">
                        {pendingUsersCount}
                      </span>
                    )}
                  </button>
                )}

                {/* Portais Fiscais */}
                <button
                  onClick={() => {
                    setShowPortalsDrawer(true);
                    setShowMobileMenu(false);
                  }}
                  className="w-full h-12 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70 flex items-center gap-3 px-4 font-semibold text-sm transition-all cursor-pointer"
                >
                  <Globe className="w-5 h-5 text-[#1B357B] shrink-0" />
                  <span>Portais Fiscais (RFB, SEFAZ...)</span>
                </button>

                {/* Consultar Empresa / CNPJ */}
                {onOpenCompanyModal && (
                  <button
                    onClick={() => {
                      onOpenCompanyModal();
                      setShowMobileMenu(false);
                    }}
                    className="w-full h-12 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70 flex items-center gap-3 px-4 font-semibold text-sm transition-all cursor-pointer"
                  >
                    <Building2 className="w-5 h-5 text-[#C59B4B] shrink-0" />
                    <span>Consultar Empresa / CNPJ</span>
                  </button>
                )}

                {/* Avisos de Vencimento */}
                {onOpenDueNoticeModal && (
                  <button
                    onClick={() => {
                      onOpenDueNoticeModal();
                      setShowMobileMenu(false);
                    }}
                    className="w-full h-12 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70 flex items-center justify-between px-4 font-semibold text-sm transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-[#C59B4B] shrink-0" />
                      <span>Avisos de Vencimento</span>
                    </div>
                    {(dueAlertCount || 0) > 0 && (
                      <span className="px-2 py-0.5 bg-amber-500 text-slate-900 text-xs font-bold rounded-full">
                        {dueAlertCount}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Drawer Footer with profile actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
              <button
                onClick={() => {
                  onOpenProfileModal('profile');
                  setShowMobileMenu(false);
                }}
                className="w-full h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <User className="w-4 h-4 text-slate-500" />
                <span>Meu Perfil & Avatar</span>
              </button>
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onLogout();
                }}
                className="w-full h-11 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span>Sair da Conta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <PortalsDrawer isOpen={showPortalsDrawer} onClose={() => setShowPortalsDrawer(false)} />
    </header>
  );
};
