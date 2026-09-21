import React, { useState, useEffect, useRef } from 'react';
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
  X,
  BookOpen,
  Briefcase,
  FileDigit,
  Sun,
  Moon
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
  onOpenCompanyManager?: () => void;
  onOpenInvoiceEmission?: () => void;
  onOpenManualModal?: () => void;
  onSwitchUser: (profile: UserProfile) => void;
  onLogout: () => void;
  allProfiles: UserProfile[];
  r2Status?: { isConfigured: boolean; bucketName: string; mode: string };
  storageMetrics?: StorageMetrics | null;
  authHeaderConfig?: AuthHeaderConfig;
  themeMode?: 'light' | 'dark';
  onToggleTheme?: () => void;
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
  onOpenCompanyManager,
  onOpenInvoiceEmission,
  onOpenManualModal,
  onSwitchUser,
  onLogout,
  allProfiles,
  r2Status,
  storageMetrics,
  authHeaderConfig,
  themeMode = 'light',
  onToggleTheme,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showPortalsDrawer, setShowPortalsDrawer] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // States for dropdown navigation
  const [showFiscalDropdown, setShowFiscalDropdown] = useState(false);
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);

  // Timers to handle smooth hover state
  const fiscalTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const adminTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleFiscalEnter = () => {
    if (fiscalTimeoutRef.current) clearTimeout(fiscalTimeoutRef.current);
    setShowFiscalDropdown(true);
  };

  const handleFiscalLeave = () => {
    fiscalTimeoutRef.current = setTimeout(() => {
      setShowFiscalDropdown(false);
    }, 150);
  };

  const handleAdminEnter = () => {
    if (adminTimeoutRef.current) clearTimeout(adminTimeoutRef.current);
    setShowAdminDropdown(true);
  };

  const handleAdminLeave = () => {
    adminTimeoutRef.current = setTimeout(() => {
      setShowAdminDropdown(false);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (fiscalTimeoutRef.current) clearTimeout(fiscalTimeoutRef.current);
      if (adminTimeoutRef.current) clearTimeout(adminTimeoutRef.current);
    };
  }, []);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="bg-[#C59B4B]/15 text-[#9A7528] border border-[#C59B4B]/30 font-bold px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider">
            Admin
          </span>
        );
      case 'editor':
        return (
          <span className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider">
            Editor
          </span>
        );
      case 'viewer':
        return (
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider">
            Leitor
          </span>
        );
    }
  };

  const pendingUsersCount = allProfiles.filter(p => p.status === 'pending').length;

  // Verify Admin/Diretoria level
  const isFullAdmin = 
    currentUser?.role === 'admin' || 
    (currentUser?.role as string) === 'ADMIN' || 
    (currentUser as any)?.role === 'Diretoria' ||
    currentUser?.sector === 'Diretoria' || 
    (currentUser as any)?.setor === 'Diretoria';

  return (
    <header className="sticky top-0 z-30 w-full px-3 sm:px-6 lg:px-8 py-2.5 transition-all">
      {/* 1. CONTAINER PRINCIPAL DA NAVEGAÇÃO - DESIGN SYSTEM VIDRO SUAVE */}
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-white/80 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm h-16">
        
        {/* Logo & Brand (Sempre visível em dispositivos móveis e desktop) */}
        <div 
          className="flex items-center gap-2.5 flex-shrink-0 cursor-pointer group select-none pl-1.5 h-11" 
          onClick={() => onNavigate('drive')}
        >
          {/* Ícone da Logo */}
          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-1.5 shadow-xs flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200 overflow-hidden">
            {authHeaderConfig?.logoImageUrl ? (
              <img
                src={authHeaderConfig.logoImageUrl}
                alt="Logo MVRJ"
                className="w-full h-full object-contain"
              />
            ) : (
              <FolderLock className="w-5.5 h-5.5 text-[#0B1736] dark:text-[#E2C37A]" />
            )}
          </div>

          {/* Textos da Empresa */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-1 leading-none">
              <span className="font-black text-sm sm:text-base text-[#0B1736] dark:text-slate-100 tracking-tight">MVRJ</span>
              <span className="font-black text-sm sm:text-base text-[#C59B4B] dark:text-[#E2C37A] tracking-tight">CONTÁBIL</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold tracking-normal mt-0.5 leading-none">
              Gestão Eletrônica
            </span>
          </div>
        </div>

        {/* 2. BOTÕES DE NAVEGAÇÃO ORGANIZADA (DESKTOP: EXIBIDO EM LG E ACIMA) */}
        {currentUser && (currentUser.status === 'active' || currentUser.status === 'approved') && (
          <nav className="hidden lg:flex items-center gap-1">
            
            {/* Drive Corporativo - Pílula sólida em destaque */}
            <button
              id="nav-drive-btn"
              onClick={() => onNavigate('drive')}
              className={
                activeView === 'drive'
                  ? 'h-11 bg-gradient-to-r from-[#0F1E42] to-[#1B357B] text-white font-bold shadow-sm px-4 rounded-xl text-xs flex items-center gap-2 border border-white/10 transition-all duration-200 group cursor-pointer'
                  : 'h-11 flex items-center gap-2 px-3.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#1B357B] dark:hover:text-[#E2C37A] hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all duration-200 group cursor-pointer'
              }
            >
              <HardDrive className={`w-4 h-4 flex-shrink-0 ${activeView === 'drive' ? 'text-[#E2C37A]' : 'text-slate-400 dark:text-slate-400 group-hover:text-[#1B357B] dark:group-hover:text-[#E2C37A]'}`} />
              <span>Drive Corporativo</span>
            </button>

            {/* Dropdown 1: Fiscal & Empresas */}
            <div 
              className="relative"
              onMouseEnter={handleFiscalEnter}
              onMouseLeave={handleFiscalLeave}
            >
              <button
                id="navbar-fiscal-menu-trigger"
                onClick={() => setShowFiscalDropdown(!showFiscalDropdown)}
                className={`h-11 flex items-center gap-1.5 px-3.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#1B357B] dark:hover:text-[#E2C37A] hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all duration-200 cursor-pointer ${
                  showFiscalDropdown ? 'bg-slate-100 dark:bg-slate-800 text-[#1B357B] dark:text-[#E2C37A]' : ''
                }`}
              >
                <Briefcase className="w-4 h-4 text-slate-400 dark:text-slate-400" />
                <span>Fiscal & Empresas</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${showFiscalDropdown ? 'rotate-180 text-[#1B357B]' : ''}`} />
              </button>

              {/* Menu Suspenso Fiscal */}
              {showFiscalDropdown && (
                <div 
                  className="absolute left-0 mt-1.5 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  onMouseEnter={handleFiscalEnter}
                  onMouseLeave={handleFiscalLeave}
                >
                  {/* Emissão de Notas */}
                  {onOpenInvoiceEmission && (
                    <button
                      id="navbar-invoice-emission-btn"
                      onClick={() => {
                        setShowFiscalDropdown(false);
                        onOpenInvoiceEmission();
                      }}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all flex items-start gap-3 cursor-pointer group"
                    >
                      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                        <FileDigit className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-[#1B357B] dark:group-hover:text-[#E2C37A] transition-colors">Emissão de Nota Fiscal</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Entradas e Saídas com espelho DANFE</p>
                      </div>
                    </button>
                  )}

                  {/* Gestão de Clientes */}
                  {onOpenCompanyManager && (
                    <button
                      id="navbar-company-manager-btn"
                      onClick={() => {
                        setShowFiscalDropdown(false);
                        onOpenCompanyManager();
                      }}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all flex items-start gap-3 cursor-pointer group"
                    >
                      <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-[#E2C37A] shrink-0 mt-0.5">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-[#1B357B] dark:group-hover:text-[#E2C37A] transition-colors">Gestão de Empresas Clientes</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Certificados Digitais A1 e cadastros</p>
                      </div>
                    </button>
                  )}

                  {/* Consulta de CNPJ */}
                  {onOpenCompanyModal && (
                    <button
                      id="navbar-company-lookup-btn"
                      onClick={() => {
                        setShowFiscalDropdown(false);
                        onOpenCompanyModal();
                      }}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all flex items-start gap-3 cursor-pointer group"
                    >
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-[#1B357B] dark:group-hover:text-[#E2C37A] transition-colors">Consultar CNPJ</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Situação cadastral na Receita Federal</p>
                      </div>
                    </button>
                  )}

                  {/* Portais Fiscais */}
                  <button
                    id="navbar-portals-btn"
                    onClick={() => {
                      setShowFiscalDropdown(false);
                      setShowPortalsDrawer(true);
                    }}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all flex items-start gap-3 cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-[#1B357B] dark:group-hover:text-[#E2C37A] transition-colors">Portais Fiscais Externos</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Acesso rápido RFB, SEFAZ, e-CAC</p>
                    </div>
                  </button>

                </div>
              )}
            </div>

            {/* Dropdown 2: Administração (Exibido apenas para Admins/Diretoria) */}
            {isFullAdmin && (
              <div 
                className="relative"
                onMouseEnter={handleAdminEnter}
                onMouseLeave={handleAdminLeave}
              >
                <button
                  id="navbar-admin-menu-trigger"
                  onClick={() => setShowAdminDropdown(!showAdminDropdown)}
                  className={`h-11 flex items-center gap-1.5 px-3.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#1B357B] dark:hover:text-[#E2C37A] hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all duration-200 cursor-pointer relative ${
                    showAdminDropdown ? 'bg-slate-100 dark:bg-slate-800 text-[#1B357B] dark:text-[#E2C37A]' : ''
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-slate-400 dark:text-slate-400" />
                  <span>Administração</span>
                  {pendingUsersCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white animate-pulse"></span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${showAdminDropdown ? 'rotate-180 text-[#1B357B]' : ''}`} />
                </button>

                {/* Menu Suspenso Administração */}
                {showAdminDropdown && (
                  <div 
                    className="absolute left-0 mt-1.5 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    onMouseEnter={handleAdminEnter}
                    onMouseLeave={handleAdminLeave}
                  >
                    {/* Painel Geral */}
                    <button
                      id="nav-admin-btn"
                      onClick={() => {
                        setShowAdminDropdown(false);
                        onNavigate('admin');
                      }}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all flex items-start gap-3 cursor-pointer group"
                    >
                      <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 shrink-0 mt-0.5">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-[#1B357B] dark:group-hover:text-[#E2C37A] transition-colors">Painel Admin & RBAC</p>
                          {pendingUsersCount > 0 && (
                            <span className="px-1.5 py-0.2 bg-amber-500 text-white text-[9px] font-bold rounded-full">{pendingUsersCount} pendentes</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Aprovação de usuários e matriz de acessos</p>
                      </div>
                    </button>

                    {/* Histórico & Auditoria */}
                    <button
                      onClick={() => {
                        setShowAdminDropdown(false);
                        onNavigate('admin');
                        // No AdminPanel a aba Auditoria possui ID "tab-admin-audit"
                        setTimeout(() => {
                          const tabAudit = document.getElementById('tab-admin-audit');
                          if (tabAudit) tabAudit.click();
                        }, 100);
                      }}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all flex items-start gap-3 cursor-pointer group"
                    >
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5">
                        <ScrollText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-[#1B357B] dark:group-hover:text-[#E2C37A] transition-colors">Relatórios & Auditoria</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Logs de acessos e trilhas imutáveis</p>
                      </div>
                    </button>

                    {/* Identidade Visual */}
                    {onOpenBackgroundModal && (
                      <button
                        onClick={() => {
                          setShowAdminDropdown(false);
                          onOpenBackgroundModal();
                        }}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all flex items-start gap-3 cursor-pointer group"
                      >
                        <div className="p-2 rounded-lg bg-[#C59B4B]/10 dark:bg-[#C59B4B]/5 text-[#9A7528] shrink-0 mt-0.5">
                          <Palette className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-[#1B357B] dark:group-hover:text-[#E2C37A] transition-colors">Identidade Visual</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Logo, papéis de parede e temas</p>
                        </div>
                      </button>
                    )}

                  </div>
                )}
              </div>
            )}

            {/* Link Discreto: Manual */}
            {onOpenManualModal && (
              <button
                id="navbar-manual-btn"
                onClick={onOpenManualModal}
                className="h-11 flex items-center gap-1.5 px-3.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#1B357B] dark:hover:text-[#E2C37A] hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all duration-200 cursor-pointer"
                title="Manual de Operações do GED"
              >
                <BookOpen className="w-4.5 h-4.5 text-slate-400 dark:text-slate-400" />
                <span>Manual</span>
              </button>
            )}

          </nav>
        )}

        {/* 3. EXTREMIDADE DIREITA (UTILITÁRIOS & COMPACT PERFIL) */}
        <div className="flex items-center gap-2 shrink-0 pr-1">
          
          {/* Alternador de Tema [Sol / Lua] com visual refinado */}
          {onToggleTheme && (
            <button
              id="theme-mode-toggle-btn"
              onClick={onToggleTheme}
              className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-[#C59B4B]/60 dark:hover:border-[#E2C37A]/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-[#1B357B] dark:hover:text-[#E2C37A] transition-all cursor-pointer shadow-2xs"
              title={themeMode === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            >
              {themeMode === 'dark' ? (
                <Sun className="w-4 h-4 flex-shrink-0 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 flex-shrink-0 text-indigo-600" />
              )}
            </button>
          )}

          {/* Alerta de Capacidade do Armazenamento R2 */}
          {storageMetrics && (storageMetrics.usedBytes >= (storageMetrics.totalCapacityBytes || 10 * 1024 * 1024 * 1024) || storageMetrics.usedPercent >= 100) && (
            <div 
              id="navbar-storage-indicator"
              className="h-10 flex items-center gap-1.5 px-2.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900 font-bold text-[10px] animate-pulse"
              title="Capacidade limite atingida no Cloudflare R2"
            >
              <AlertOctagon className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
              <span className="hidden sm:inline">Limite R2</span>
            </div>
          )}

          {/* Card de Usuário Compacto e Refinado */}
          {currentUser ? (
            <div className="relative">
              <button
                id="user-profile-menu-btn"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="h-10 flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-[#C59B4B]/60 dark:hover:border-[#E2C37A]/60 transition-all cursor-pointer group shadow-2xs"
              >
                {/* Avatar com status online */}
                <div className="relative w-7.5 h-7.5 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-slate-100 dark:ring-slate-700">
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
                  {/* Status Ring verde */}
                  <span className="w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-slate-800 absolute bottom-0 right-0"></span>
                </div>

                {/* Nome e Badge minimalista */}
                <div className="text-left hidden sm:block">
                  <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight truncate max-w-[110px] group-hover:text-[#1B357B] dark:group-hover:text-[#E2C37A] transition-colors">
                    {currentUser.full_name.split(' ')[0]}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {currentUser.role === 'admin' ? 'ADMIN' : currentUser.sector || 'LEITOR'}
                    </span>
                  </div>
                </div>

                {/* Chevron */}
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 group-hover:translate-y-0.2 ${showUserDropdown ? 'rotate-180 text-[#1B357B] dark:text-[#E2C37A]' : ''}`} />
              </button>

              {/* Menu Dropdown de Perfil Executivo */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 min-w-[260px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  
                  {/* Cabeçalho do usuário */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 p-3 rounded-t-xl flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-[#112354] to-[#1B357B] text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
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
                      <p className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">{currentUser.full_name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{currentUser.email}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[9px] font-bold px-1.5 py-0.2 rounded-full">{currentUser.sector}</span>
                        {getRoleBadge(currentUser.role)}
                      </div>
                    </div>
                  </div>

                  {/* Lista de Ações */}
                  <div className="space-y-0.5">
                    <button
                      id="open-edit-profile-btn"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onOpenProfileModal('profile');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-[#1B357B] dark:hover:text-[#E2C37A] hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all flex items-center gap-2.5 cursor-pointer group"
                    >
                      <User className="w-4 h-4 text-slate-400 group-hover:text-[#1B357B] transition-colors" />
                      <span>Configurações do Perfil</span>
                    </button>

                    <button
                      id="open-password-profile-btn"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onOpenProfileModal('security');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-[#1B357B] dark:hover:text-[#E2C37A] hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all flex items-center gap-2.5 cursor-pointer group"
                    >
                      <KeyRound className="w-4 h-4 text-slate-400 group-hover:text-[#1B357B] transition-colors" />
                      <span>Segurança & Senha</span>
                    </button>

                    {onOpenLgpdModal && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenLgpdModal();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-[#1B357B] dark:hover:text-[#E2C37A] hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all flex items-center gap-2.5 cursor-pointer group"
                      >
                        <ScrollText className="w-4 h-4 text-slate-400 group-hover:text-[#1B357B] transition-colors" />
                        <span>LGPD & Privacidade</span>
                      </button>
                    )}

                    {onOpenManualModal && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenManualModal();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-[#1B357B] dark:hover:text-[#E2C37A] hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all flex items-center gap-2.5 cursor-pointer group"
                      >
                        <BookOpen className="w-4 h-4 text-slate-400 group-hover:text-[#1B357B] transition-colors" />
                        <span>Manual do Usuário</span>
                      </button>
                    )}

                    {currentUser.role === 'admin' && onOpenBackgroundModal && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenBackgroundModal();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-[#1B357B] dark:hover:text-[#E2C37A] hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all flex items-center gap-2.5 cursor-pointer group"
                      >
                        <Palette className="w-4 h-4 text-slate-400 group-hover:text-[#1B357B] transition-colors" />
                        <span>Identidade Visual</span>
                      </button>
                    )}
                  </div>

                  {/* Sair da Conta */}
                  <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                    <button
                      id="logout-btn"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
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
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>Acessar Drive</span>
            </button>
          )}

          {/* 4. BOTÃO HAMBÚRGUER MOBILE */}
          {currentUser && (currentUser.status === 'active' || currentUser.status === 'approved') && (
            <button
              id="navbar-mobile-hamburger-btn"
              type="button"
              onClick={() => setShowMobileMenu(true)}
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 shadow-2xs transition-all cursor-pointer relative shrink-0"
              title="Abrir Menu de Navegação"
              aria-label="Abrir Menu Móvel"
            >
              <Menu className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              {pendingUsersCount > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900"></span>
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
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-xs sm:max-w-sm bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-250 p-5">
            <div className="space-y-4">
              
              {/* Header do Drawer */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0F1E42] to-[#1B357B] flex items-center justify-center text-white shadow-xs">
                    <FolderLock className="w-4.5 h-4.5 text-[#E2C37A]" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1">
                      <span className="font-extrabold text-sm tracking-tight text-[#0F1E42] dark:text-slate-100">MVRJ</span>
                      <span className="font-bold text-sm tracking-tight text-[#C59B4B]">CONTÁBIL</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">Menu Principal</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMobileMenu(false)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Fechar menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Informações do Usuário no Drawer */}
              {currentUser && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/70 dark:border-slate-800 flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
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
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800 absolute bottom-0 right-0"></span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{currentUser.full_name}</p>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span className="truncate">{currentUser.sector}</span>
                      <span>•</span>
                      {getRoleBadge(currentUser.role)}
                    </div>
                  </div>
                </div>
              )}

              {/* Itens de Navegação Mobile estruturados por contexto */}
              <div className="flex flex-col gap-4 pt-1">
                
                {/* Contexto Principal */}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 pl-1">Corporativo</p>
                  <button
                    onClick={() => {
                      onNavigate('drive');
                      setShowMobileMenu(false);
                    }}
                    className={`w-full h-11 rounded-xl flex items-center gap-3 px-3.5 font-bold text-xs transition-all cursor-pointer ${
                      activeView === 'drive'
                        ? 'bg-gradient-to-r from-[#0F1E42] to-[#1B357B] text-white shadow-sm border border-white/10'
                        : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700'
                    }`}
                  >
                    <HardDrive className={`w-4.5 h-4.5 shrink-0 ${activeView === 'drive' ? 'text-[#E2C37A]' : 'text-[#1B357B]'}`} />
                    <span>Drive Corporativo</span>
                  </button>
                </div>

                {/* Contexto Fiscal & Clientes */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 pl-1">Fiscal & Clientes</p>
                  
                  {/* Emissão de Nota */}
                  {onOpenInvoiceEmission && (
                    <button
                      onClick={() => {
                        onOpenInvoiceEmission();
                        setShowMobileMenu(false);
                      }}
                      className="w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700 flex items-center gap-3 px-3.5 font-semibold text-xs transition-all cursor-pointer"
                    >
                      <FileDigit className="w-4.5 h-4.5 text-[#1B357B] shrink-0" />
                      <span>Emissão de Nota Fiscal</span>
                    </button>
                  )}

                  {/* Gestão de Clientes */}
                  {onOpenCompanyManager && (
                    <button
                      onClick={() => {
                        onOpenCompanyManager();
                        setShowMobileMenu(false);
                      }}
                      className="w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700 flex items-center gap-3 px-3.5 font-semibold text-xs transition-all cursor-pointer"
                    >
                      <Building2 className="w-4.5 h-4.5 text-[#1B357B] shrink-0" />
                      <span>Gestão de Empresas Clientes</span>
                    </button>
                  )}

                  {/* Consultar CNPJ */}
                  {onOpenCompanyModal && (
                    <button
                      onClick={() => {
                        onOpenCompanyModal();
                        setShowMobileMenu(false);
                      }}
                      className="w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700 flex items-center gap-3 px-3.5 font-semibold text-xs transition-all cursor-pointer"
                    >
                      <FileText className="w-4.5 h-4.5 text-[#C59B4B] shrink-0" />
                      <span>Consultar Empresa / CNPJ</span>
                    </button>
                  )}

                  {/* Portais Fiscais */}
                  <button
                    onClick={() => {
                      setShowPortalsDrawer(true);
                      setShowMobileMenu(false);
                    }}
                    className="w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700 flex items-center gap-3 px-3.5 font-semibold text-xs transition-all cursor-pointer"
                  >
                    <Globe className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>Portais Fiscais Externos</span>
                  </button>
                </div>

                {/* Contexto Administração (Apenas para Admins) */}
                {isFullAdmin && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 pl-1">Administração</p>
                    
                    <button
                      onClick={() => {
                        onNavigate('admin');
                        setShowMobileMenu(false);
                      }}
                      className={`w-full h-11 rounded-xl flex items-center justify-between px-3.5 font-bold text-xs transition-all cursor-pointer ${
                        activeView === 'admin'
                          ? 'bg-gradient-to-r from-[#0F1E42] to-[#1B357B] text-white shadow-sm border border-white/10'
                          : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Users className={`w-4.5 h-4.5 shrink-0 ${activeView === 'admin' ? 'text-[#E2C37A]' : 'text-[#1B357B]'}`} />
                        <span>Painel Admin & RBAC</span>
                      </div>
                      {pendingUsersCount > 0 && (
                        <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                          {pendingUsersCount}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        onNavigate('admin');
                        setShowMobileMenu(false);
                        setTimeout(() => {
                          const tabAudit = document.getElementById('tab-admin-audit');
                          if (tabAudit) tabAudit.click();
                        }, 250);
                      }}
                      className="w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700 flex items-center gap-3 px-3.5 font-semibold text-xs transition-all cursor-pointer"
                    >
                      <ScrollText className="w-4.5 h-4.5 text-[#1B357B] shrink-0" />
                      <span>Relatórios & Auditoria</span>
                    </button>
                  </div>
                )}

                {/* Ajuda & Outros */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 pl-1">Ajuda & Configurações</p>
                  
                  {/* Manual */}
                  {onOpenManualModal && (
                    <button
                      onClick={() => {
                        onOpenManualModal();
                        setShowMobileMenu(false);
                      }}
                      className="w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700 flex items-center gap-3 px-3.5 font-semibold text-xs transition-all cursor-pointer"
                    >
                      <BookOpen className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>Manual do Usuário</span>
                    </button>
                  )}

                  {/* Alternar Tema Mobile */}
                  {onToggleTheme && (
                    <button
                      onClick={() => {
                        onToggleTheme();
                      }}
                      className="w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700 flex items-center justify-between px-3.5 font-semibold text-xs transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        {themeMode === 'dark' ? (
                          <Sun className="w-4.5 h-4.5 text-amber-500 shrink-0" />
                        ) : (
                          <Moon className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                        )}
                        <span>Tema de Cores</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold capitalize">{themeMode === 'dark' ? 'Escuro' : 'Claro'}</span>
                    </button>
                  )}
                </div>

              </div>
            </div>

            {/* Rodapé da Gaveta com Ações de Conta */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <button
                onClick={() => {
                  onOpenProfileModal('profile');
                  setShowMobileMenu(false);
                }}
                className="w-full h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>Minha Conta</span>
              </button>
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onLogout();
                }}
                className="w-full h-11 rounded-xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
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
