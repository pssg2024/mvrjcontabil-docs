import React, { useState } from 'react';
import { 
  Home,
  HardDrive,
  Briefcase,
  Building2,
  FileText,
  Calculator,
  FileDigit,
  Globe,
  ShieldCheck,
  Users,
  Bell,
  ScrollText,
  Palette,
  BookOpen,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderLock
} from 'lucide-react';
import { UserProfile, StorageMetrics, AuthHeaderConfig } from '../types';

export interface SidebarProps {
  currentUser: UserProfile;
  activeView: 'drive' | 'admin';
  onNavigate: (view: 'drive' | 'admin', adminTab?: 'users' | 'mural' | 'audit') => void;
  onNavigateHome: () => void;
  onOpenCompanyManager: () => void;
  onOpenCompanyModal: () => void;
  onOpenSalaryCalculator: () => void;
  onOpenInvoiceEmission: () => void;
  onOpenPortalsDrawer: () => void;
  onOpenManualModal: () => void;
  onOpenBackgroundModal: () => void;
  onOpenSqlModal?: () => void;
  onOpenProfileModal: (tab?: 'profile' | 'security') => void;
  onLogout: () => void;
  pendingUsersCount?: number;
  storageMetrics?: StorageMetrics | null;
  authHeaderConfig?: AuthHeaderConfig;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeView,
  onNavigate,
  onNavigateHome,
  onOpenCompanyManager,
  onOpenCompanyModal,
  onOpenSalaryCalculator,
  onOpenInvoiceEmission,
  onOpenPortalsDrawer,
  onOpenManualModal,
  onOpenBackgroundModal,
  onOpenSqlModal: _onOpenSqlModal,
  onOpenProfileModal,
  onLogout,
  pendingUsersCount = 0,
  storageMetrics: _storageMetrics,
  authHeaderConfig,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isFiscalOpen, setIsFiscalOpen] = useState(true);
  const [isAdminOpen, setIsAdminOpen] = useState(true);

  const isFullAdmin = 
    currentUser.role === 'admin' || 
    (currentUser.role as string) === 'ADMIN' || 
    (currentUser as any).role === 'Diretoria' ||
    currentUser.sector === 'Diretoria' || 
    (currentUser as any).setor === 'Diretoria';

  const handleLinkClick = (action: () => void) => {
    action();
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        id="app-sidebar"
        className={`fixed lg:static top-0 left-0 z-50 h-screen flex flex-col justify-between bg-[#091124] border-r border-slate-800/80 transition-all duration-300 ease-in-out text-slate-300 select-none ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        } ${
          isOpenMobile ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Header: Logo + Brand + Collapse Toggle */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80 shrink-0 bg-[#091124]">
          <div 
            onClick={() => handleLinkClick(onNavigateHome)}
            className="flex items-center gap-3 cursor-pointer group min-w-0"
            title="MVRJ Contábil • Início"
          >
            {/* Logo Icon */}
            <div className="w-8 h-8 rounded-lg bg-white/95 p-1 flex items-center justify-center shadow-xs border border-slate-700/50 overflow-hidden shrink-0 group-hover:border-slate-500 transition-colors">
              {authHeaderConfig?.logoImageUrl ? (
                <img
                  src={authHeaderConfig.logoImageUrl}
                  alt="Logo MVRJ"
                  className="w-full h-full object-contain"
                />
              ) : (
                <FolderLock className="w-4.5 h-4.5 text-slate-800" strokeWidth={1.75} />
              )}
            </div>

            {/* Brand Text (Hidden when collapsed) */}
            {!isCollapsed && (
              <div className="flex flex-col justify-center min-w-0">
                <span className="text-slate-100 font-bold text-xs tracking-wider uppercase leading-tight group-hover:text-white transition-colors truncate">
                  MVRJ CONTÁBIL
                </span>
                <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5 leading-none truncate">
                  GESTÃO ELETRÔNICA
                </span>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex w-7 h-7 rounded-lg items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" strokeWidth={1.75} />
            ) : (
              <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-white" strokeWidth={1.75} />
            )}
          </button>
        </div>

        {/* Navigation Items (Scrollable Body) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* Section: Navegação Principal */}
          <div className="space-y-1">
            {/* 1. Home / Dashboard */}
            <button
              type="button"
              id="sidebar-nav-home"
              onClick={() => handleLinkClick(onNavigateHome)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors cursor-pointer group"
              title="Home / Dashboard"
            >
              <Home 
                className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors shrink-0" 
                strokeWidth={1.75} 
              />
              {!isCollapsed && <span className="truncate">Home / Dashboard</span>}
            </button>

            {/* 2. Drive Corporativo (GED) */}
            <button
              type="button"
              id="sidebar-nav-drive"
              onClick={() => handleLinkClick(() => onNavigate('drive'))}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer group ${
                activeView === 'drive'
                  ? 'bg-blue-600/20 text-white font-medium border border-blue-500/25'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`}
              title="Drive Corporativo (GED)"
            >
              <HardDrive 
                className={`w-4 h-4 shrink-0 transition-colors ${
                  activeView === 'drive' 
                    ? 'text-blue-400' 
                    : 'text-slate-400 group-hover:text-white'
                }`} 
                strokeWidth={1.75} 
              />
              {!isCollapsed && <span className="truncate">Drive Corporativo (GED)</span>}
            </button>
          </div>

          {/* Section: FISCAL & EMPRESAS */}
          <div>
            {!isCollapsed ? (
              <div>
                <button
                  type="button"
                  onClick={() => setIsFiscalOpen(!isFiscalOpen)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <Briefcase 
                      className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors shrink-0" 
                      strokeWidth={1.75} 
                    />
                    <span>Fiscal & Empresas</span>
                  </div>
                  <ChevronDown 
                    className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isFiscalOpen ? 'rotate-180' : ''}`} 
                    strokeWidth={1.75} 
                  />
                </button>

                {isFiscalOpen && (
                  <div className="mt-1 border-l border-slate-800 ml-4 pl-3 space-y-1">
                    {/* Gestão de Empresas */}
                    <button
                      type="button"
                      id="sidebar-btn-company-manager"
                      onClick={() => handleLinkClick(onOpenCompanyManager)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors cursor-pointer group text-left"
                    >
                      <Building2 
                        className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" 
                        strokeWidth={1.75} 
                      />
                      <span className="truncate">Gestão de Empresas</span>
                    </button>

                    {/* Consultar CNPJ */}
                    <button
                      type="button"
                      id="sidebar-btn-company-lookup"
                      onClick={() => handleLinkClick(onOpenCompanyModal)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors cursor-pointer group text-left"
                    >
                      <FileText 
                        className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" 
                        strokeWidth={1.75} 
                      />
                      <span className="truncate">Consultar CNPJ</span>
                    </button>

                    {/* Simulador de Salário */}
                    <button
                      type="button"
                      id="sidebar-btn-salary-calc"
                      onClick={() => handleLinkClick(onOpenSalaryCalculator)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors cursor-pointer group text-left"
                    >
                      <Calculator 
                        className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" 
                        strokeWidth={1.75} 
                      />
                      <span className="truncate">Simulador de Salário</span>
                    </button>

                    {/* Emissão de Notas */}
                    <button
                      type="button"
                      id="sidebar-btn-invoice-emission"
                      onClick={() => handleLinkClick(onOpenInvoiceEmission)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors cursor-pointer group text-left"
                    >
                      <FileDigit 
                        className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" 
                        strokeWidth={1.75} 
                      />
                      <span className="truncate">Emissão de Notas Fiscais</span>
                    </button>

                    {/* Portais Fiscais Externos */}
                    <button
                      type="button"
                      id="sidebar-btn-portals"
                      onClick={() => handleLinkClick(onOpenPortalsDrawer)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors cursor-pointer group text-left"
                    >
                      <Globe 
                        className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" 
                        strokeWidth={1.75} 
                      />
                      <span className="truncate">Portais Fiscais (RFB/e-CAC)</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => handleLinkClick(onOpenCompanyManager)}
                  className="w-full flex items-center justify-center p-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  title="Gestão de Empresas Clientes"
                >
                  <Building2 className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => handleLinkClick(onOpenSalaryCalculator)}
                  className="w-full flex items-center justify-center p-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  title="Simulador de Salário"
                >
                  <Calculator className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => handleLinkClick(onOpenPortalsDrawer)}
                  className="w-full flex items-center justify-center p-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  title="Portais Fiscais"
                >
                  <Globe className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" strokeWidth={1.75} />
                </button>
              </div>
            )}
          </div>

          {/* Section: ADMINISTRAÇÃO (Only for Admins) */}
          {isFullAdmin && (
            <div>
              {!isCollapsed ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setIsAdminOpen(!isAdminOpen)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck 
                        className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors shrink-0" 
                        strokeWidth={1.75} 
                      />
                      <span>Administração</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {pendingUsersCount > 0 && (
                        <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] font-bold rounded-full">
                          {pendingUsersCount}
                        </span>
                      )}
                      <ChevronDown 
                        className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isAdminOpen ? 'rotate-180' : ''}`} 
                        strokeWidth={1.75} 
                      />
                    </div>
                  </button>

                  {isAdminOpen && (
                    <div className="mt-1 border-l border-slate-800 ml-4 pl-3 space-y-1">
                      {/* Usuários & Acessos */}
                      <button
                        type="button"
                        id="sidebar-btn-admin-users"
                        onClick={() => handleLinkClick(() => onNavigate('admin', 'users'))}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer group text-left ${
                          activeView === 'admin'
                            ? 'bg-blue-600/20 text-white font-medium border border-blue-500/25'
                            : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Users 
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              activeView === 'admin' 
                                ? 'text-blue-400' 
                                : 'text-slate-400 group-hover:text-blue-400'
                            }`} 
                            strokeWidth={1.75} 
                          />
                          <span className="truncate">Usuários & Acessos</span>
                        </div>
                        {pendingUsersCount > 0 && (
                          <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] font-bold rounded-full">
                            {pendingUsersCount}
                          </span>
                        )}
                      </button>

                      {/* Mural de Avisos */}
                      <button
                        type="button"
                        id="sidebar-btn-admin-mural"
                        onClick={() => handleLinkClick(() => onNavigate('admin', 'mural'))}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors cursor-pointer group text-left"
                      >
                        <Bell 
                          className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" 
                          strokeWidth={1.75} 
                        />
                        <span className="truncate">Mural de Avisos</span>
                      </button>

                      {/* Relatórios & Auditoria */}
                      <button
                        type="button"
                        id="sidebar-btn-admin-audit"
                        onClick={() => handleLinkClick(() => onNavigate('admin', 'audit'))}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors cursor-pointer group text-left"
                      >
                        <ScrollText 
                          className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" 
                          strokeWidth={1.75} 
                        />
                        <span className="truncate">Relatórios & Auditoria</span>
                      </button>

                      {/* Identidade Visual */}
                      <button
                        type="button"
                        id="sidebar-btn-admin-background"
                        onClick={() => handleLinkClick(onOpenBackgroundModal)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors cursor-pointer group text-left"
                      >
                        <Palette 
                          className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" 
                          strokeWidth={1.75} 
                        />
                        <span className="truncate">Identidade Visual & Temas</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => handleLinkClick(() => onNavigate('admin'))}
                    className={`w-full flex items-center justify-center p-2.5 rounded-lg transition-colors cursor-pointer relative group ${
                      activeView === 'admin'
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/25'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                    title="Administração & RBAC"
                  >
                    <ShieldCheck className="w-4 h-4" strokeWidth={1.75} />
                    {pendingUsersCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Section: DOCUMENTAÇÃO */}
          <div>
            <button
              type="button"
              id="sidebar-btn-manual"
              onClick={() => handleLinkClick(onOpenManualModal)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors cursor-pointer group text-left"
              title="Manual de Operações e Documentação"
            >
              <BookOpen 
                className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" 
                strokeWidth={1.75} 
              />
              {!isCollapsed && <span className="truncate">Manual / Documentação</span>}
            </button>
          </div>

        </div>

        {/* Bottom Footer: User Profile Card & Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-[#070e1e] shrink-0">
          {!isCollapsed ? (
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-xs">
              {/* User Avatar + Name + Role */}
              <div 
                onClick={() => handleLinkClick(() => onOpenProfileModal('profile'))}
                className="flex items-center gap-2.5 min-w-0 cursor-pointer group flex-1"
                title="Meu Perfil & Segurança"
              >
                <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 ring-1 ring-slate-700 shadow-xs bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
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
                  <span className="w-2 h-2 rounded-full bg-emerald-500 border-2 border-slate-950 absolute -bottom-0.5 -right-0.5"></span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors truncate leading-tight">
                    {currentUser.full_name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-800/90 border border-slate-700/60 px-1.5 py-0.2 rounded leading-none">
                      {currentUser.role === 'admin' ? 'ADMIN' : currentUser.sector || 'LEITOR'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action: Logout Button */}
              <button
                type="button"
                id="sidebar-logout-btn"
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0"
                title="Encerrar Sessão"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => handleLinkClick(() => onOpenProfileModal('profile'))}
                className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 ring-1 ring-slate-700 shadow-xs bg-slate-800 text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                title={currentUser.full_name}
              >
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
                <span className="w-2 h-2 rounded-full bg-emerald-500 border-2 border-slate-950 absolute -bottom-0.5 -right-0.5"></span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                title="Encerrar Sessão"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
