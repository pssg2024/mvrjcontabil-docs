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
  FileDigit
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
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showPortalsDrawer, setShowPortalsDrawer] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    if (showMobileMenu) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showMobileMenu]);

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
    <header className="sticky top-0 z-30 w-full transition-all pt-3 pb-1">
      {/* 1. CONTAINER PRINCIPAL DA NAVEGAÇÃO FLUIDA */}
      <div className="w-full px-3 sm:px-6 lg:px-8">
        <div className="w-full bg-[#0c1527]/95 dark:bg-[#080d1a]/95 backdrop-blur-xl border border-slate-700/60 shadow-xl shadow-slate-950/25 rounded-2xl px-3.5 sm:px-5 py-2 flex items-center justify-between h-16 text-slate-100 ring-1 ring-white/10">
        
        {/* Logo & Brand */}
        <div 
          className="flex items-center gap-3 flex-shrink-0 cursor-pointer group select-none pl-0.5 h-11" 
          onClick={() => onNavigate('drive')}
        >
          {/* Ícone / Logo com Acabamento Nobre e Unificado */}
          <div className="flex items-center justify-center shrink-0">
            {authHeaderConfig?.logoImageUrl ? (
              <div className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-md border border-slate-200/80 overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                <img
                  src={authHeaderConfig.logoImageUrl}
                  alt="Logo MVRJ"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-md border border-slate-200/80 overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                <FolderLock className="w-5.5 h-5.5 text-slate-800 drop-shadow-xs" />
              </div>
            )}
          </div>

          {/* Textos da Empresa */}
          <div className="flex flex-col justify-center">
            <span className="text-[#E5C378] font-black text-[15px] sm:text-base tracking-wide leading-tight group-hover:text-[#F3D798] transition-colors">
              MVRJ CONTÁBIL
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 leading-none">
              GESTÃO ELETRÔNICA
            </span>
          </div>
        </div>

        {/* 2. DOCK DE NAVEGAÇÃO ORGANIZADA E HARMONIOSA (DESKTOP) */}
        {currentUser && (currentUser.status === 'active' || currentUser.status === 'approved') && (
          <nav className="hidden md:flex items-center bg-slate-950/50 p-1 rounded-xl border border-white/5 shadow-inner gap-1">
            
            {/* Drive Corporativo */}
            <button
              id="nav-drive-btn"
              onClick={() => onNavigate('drive')}
              className={`h-9 px-3.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
                activeView === 'drive'
                  ? 'bg-slate-800 text-white shadow-xs border border-white/10'
                  : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <HardDrive className={`w-4 h-4 flex-shrink-0 ${activeView === 'drive' ? 'text-[#E5C378]' : 'text-slate-400 group-hover:text-white'}`} />
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
                className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  showFiscalDropdown ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Briefcase className="w-4 h-4 text-slate-400" />
                <span>Fiscal & Empresas</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${showFiscalDropdown ? 'rotate-180 text-amber-400' : ''}`} />
              </button>

              {/* Menu Suspenso Fiscal */}
              {showFiscalDropdown && (
                <div 
                  className="absolute left-0 mt-2 w-72 bg-[#0c1527]/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/60 ring-1 ring-white/10 p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
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
                      className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-800/80 transition-all flex items-start gap-3 cursor-pointer group"
                    >
                      <div className="p-2 rounded-lg bg-blue-950/60 text-blue-400 border border-blue-800/60 shrink-0 mt-0.5">
                        <FileDigit className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-100 group-hover:text-amber-400 transition-colors">Emissão de Nota Fiscal</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Entradas e Saídas com espelho DANFE</p>
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
                      className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-800/80 transition-all flex items-start gap-3 cursor-pointer group"
                    >
                      <div className="p-2 rounded-lg bg-amber-950/60 text-amber-400 border border-amber-800/60 shrink-0 mt-0.5">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-100 group-hover:text-amber-400 transition-colors">Gestão de Empresas Clientes</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Certificados Digitais A1 e cadastros</p>
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
                      className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-800/80 transition-all flex items-start gap-3 cursor-pointer group"
                    >
                      <div className="p-2 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 shrink-0 mt-0.5">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-100 group-hover:text-amber-400 transition-colors">Consultar CNPJ</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Situação cadastral na Receita Federal</p>
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
                    className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-800/80 transition-all flex items-start gap-3 cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-indigo-950/60 text-indigo-400 border border-indigo-800/60 shrink-0 mt-0.5">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-slate-100 group-hover:text-amber-400 transition-colors">Portais Fiscais Externos</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Acesso rápido RFB, SEFAZ, e-CAC</p>
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
                  className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer relative shrink-0 ${
                    showAdminDropdown ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                  <span>Administração</span>
                  {pendingUsersCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-900 animate-pulse"></span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${showAdminDropdown ? 'rotate-180 text-amber-400' : ''}`} />
                </button>

                {/* Menu Suspenso Administração */}
                {showAdminDropdown && (
                  <div 
                    className="absolute left-0 mt-2 w-72 bg-[#0c1527]/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/60 ring-1 ring-white/10 p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
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
                      className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-800/80 transition-all flex items-start gap-3 cursor-pointer group"
                    >
                      <div className="p-2 rounded-lg bg-rose-950/60 text-rose-400 border border-rose-800/60 shrink-0 mt-0.5">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-xs text-slate-100 group-hover:text-amber-400 transition-colors">Painel Admin & RBAC</p>
                          {pendingUsersCount > 0 && (
                            <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 text-[9px] font-bold rounded-full">{pendingUsersCount} pendentes</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Aprovação de usuários e matriz de acessos</p>
                      </div>
                    </button>

                    {/* Histórico & Auditoria */}
                    <button
                      onClick={() => {
                        setShowAdminDropdown(false);
                        onNavigate('admin');
                        setTimeout(() => {
                          const tabAudit = document.getElementById('tab-admin-audit');
                          if (tabAudit) tabAudit.click();
                        }, 100);
                      }}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-800/80 transition-all flex items-start gap-3 cursor-pointer group"
                    >
                      <div className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 shrink-0 mt-0.5">
                        <ScrollText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-100 group-hover:text-amber-400 transition-colors">Relatórios & Auditoria</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Logs de acessos e trilhas imutáveis</p>
                      </div>
                    </button>

                    {/* Identidade Visual */}
                    {onOpenBackgroundModal && (
                      <button
                        onClick={() => {
                          setShowAdminDropdown(false);
                          onOpenBackgroundModal();
                        }}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-800/80 transition-all flex items-start gap-3 cursor-pointer group"
                      >
                        <div className="p-2 rounded-lg bg-amber-950/60 text-amber-400 border border-amber-800/60 shrink-0 mt-0.5">
                          <Palette className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-100 group-hover:text-amber-400 transition-colors">Identidade Visual</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Logo, papéis de parede e temas</p>
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
                className="h-9 px-3 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
                title="Manual de Operações do GED"
              >
                <BookOpen className="w-4 h-4 text-slate-400" />
                <span>Manual</span>
              </button>
            )}

          </nav>
        )}

        {/* 3. EXTREMIDADE DIREITA (UTILITÁRIOS & PERFIL EXECUTIVO) */}
        <div className="flex items-center gap-2 shrink-0 pr-0.5">
          {/* Alerta de Capacidade do Armazenamento R2 */}
          {storageMetrics && (storageMetrics.usedBytes >= (storageMetrics.totalCapacityBytes || 10 * 1024 * 1024 * 1024) || storageMetrics.usedPercent >= 100) && (
            <div 
              id="navbar-storage-indicator"
              className="h-9 flex items-center gap-1.5 px-2.5 rounded-xl bg-rose-950/60 text-rose-300 border border-rose-800 font-bold text-[10px] animate-pulse"
              title="Capacidade limite atingida no Cloudflare R2"
            >
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
              <span className="hidden sm:inline">Limite R2</span>
            </div>
          )}

          {/* Card de Usuário Executivo e Refinado */}
          {currentUser ? (
            <div className="relative">
              <button
                id="user-profile-menu-btn"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="h-10 flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-xl bg-slate-950/50 hover:bg-slate-800/80 border border-white/5 hover:border-white/10 transition-all cursor-pointer group shadow-inner shrink-0 text-slate-100"
              >
                {/* Avatar com status online */}
                <div className="relative w-7.5 h-7.5 rounded-lg overflow-hidden shrink-0 ring-1.5 ring-emerald-500/80 shadow-xs">
                  {currentUser.avatar_url ? (
                    <img 
                      src={currentUser.avatar_url} 
                      alt={currentUser.full_name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#1B357B] text-white font-bold text-xs flex items-center justify-center">
                      <span>{currentUser.full_name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  {/* Status Ring verde */}
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950 absolute -bottom-0.5 -right-0.5"></span>
                </div>

                {/* Nome e Badge minimalista */}
                <div className="text-left hidden sm:flex flex-col justify-center">
                  <span className="text-xs font-bold text-slate-100 group-hover:text-amber-400 transition-colors leading-tight">
                    {currentUser.full_name.split(' ')[0]}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-[#E5C378] bg-[#E5C378]/15 border border-[#E5C378]/30 px-1.5 py-0.2 rounded">
                      {currentUser.role === 'admin' ? 'ADMIN' : currentUser.sector || 'LEITOR'}
                    </span>
                  </div>
                </div>

                {/* Chevron */}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 group-hover:text-slate-200 ${showUserDropdown ? 'rotate-180 text-amber-400' : ''}`} />
              </button>

              {/* Menu Dropdown de Perfil Executivo */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 min-w-[260px] bg-[#0c1527]/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/60 ring-1 ring-white/10 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-slate-100">
                  
                  {/* Cabeçalho do usuário */}
                  <div className="bg-slate-950/60 border border-white/5 p-3 rounded-xl flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-[#1B357B] text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0 ring-2 ring-emerald-500/80">
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
                      <p className="font-bold text-xs text-white truncate">{currentUser.full_name}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{currentUser.email}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="bg-slate-800 text-slate-300 text-[9px] font-bold px-1.5 py-0.2 rounded-full">{currentUser.sector}</span>
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
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all flex items-center gap-2.5 cursor-pointer group"
                    >
                      <User className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
                      <span>Configurações do Perfil</span>
                    </button>

                    <button
                      id="open-password-profile-btn"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onOpenProfileModal('security');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all flex items-center gap-2.5 cursor-pointer group"
                    >
                      <KeyRound className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
                      <span>Segurança & Senha</span>
                    </button>

                    {onOpenLgpdModal && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenLgpdModal();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all flex items-center gap-2.5 cursor-pointer group"
                      >
                        <ScrollText className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
                        <span>LGPD & Privacidade</span>
                      </button>
                    )}

                    {onOpenManualModal && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenManualModal();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all flex items-center gap-2.5 cursor-pointer group"
                      >
                        <BookOpen className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
                        <span>Manual do Usuário</span>
                      </button>
                    )}

                    {currentUser.role === 'admin' && onOpenBackgroundModal && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenBackgroundModal();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all flex items-center gap-2.5 cursor-pointer group"
                      >
                        <Palette className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
                        <span>Identidade Visual</span>
                      </button>
                    )}
                  </div>

                  {/* Sair da Conta */}
                  <div className="border-t border-slate-800/80 mt-1 pt-1">
                    <button
                      id="logout-btn"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-950/40 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
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
              className="px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-white/80 rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
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
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 shadow-sm transition-all cursor-pointer relative shrink-0"
              title="Abrir Menu de Navegação"
              aria-label="Abrir Menu Móvel"
            >
              <Menu className="w-5 h-5 text-slate-200" />
              {pendingUsersCount > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-slate-900"></span>
              )}
            </button>
          )}

        </div>
      </div>
      </div>

      {/* 5. GAVETA LATERAL SUAVE MOBILE (DRAWER / OFFCANVAS) */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-200">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
            onClick={() => setShowMobileMenu(false)}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-xs sm:max-w-sm bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-250 p-5 text-slate-100 overscroll-contain">
            <div className="space-y-4">
              
              {/* Header do Drawer */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center border border-slate-200 shrink-0 overflow-hidden shadow-sm">
                    {authHeaderConfig?.logoImageUrl ? (
                      <img
                        src={authHeaderConfig.logoImageUrl}
                        alt="Logo MVRJ"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <FolderLock className="w-5 h-5 text-slate-800" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-1">
                      <span className="font-bold text-sm tracking-wide text-amber-400">MVRJ CONTÁBIL</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">GESTÃO ELETRÔNICA</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMobileMenu(false)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Fechar menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Informações do Usuário no Drawer */}
              {currentUser && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 ring-1 ring-slate-200 dark:ring-slate-700">
                    {currentUser.avatar_url ? (
                      <img 
                        src={currentUser.avatar_url} 
                        alt={currentUser.full_name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#1B357B] text-white font-bold text-sm flex items-center justify-center">
                        <span>{currentUser.full_name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 absolute bottom-0 right-0"></span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.full_name}</p>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
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
                        ? 'bg-[#1B357B] dark:bg-[#C59B4B] text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <HardDrive className={`w-4.5 h-4.5 shrink-0 ${activeView === 'drive' ? 'text-white' : 'text-[#1B357B] dark:text-[#E2C37A]'}`} />
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
                      className="w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-3 px-3.5 font-semibold text-xs transition-all cursor-pointer"
                    >
                      <FileDigit className="w-4.5 h-4.5 text-[#1B357B] dark:text-blue-400 shrink-0" />
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
                      className="w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-3 px-3.5 font-semibold text-xs transition-all cursor-pointer"
                    >
                      <Building2 className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400 shrink-0" />
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
                      className="w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-3 px-3.5 font-semibold text-xs transition-all cursor-pointer"
                    >
                      <FileText className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Consultar Empresa / CNPJ</span>
                    </button>
                  )}

                  {/* Portais Fiscais */}
                  <button
                    onClick={() => {
                      setShowPortalsDrawer(true);
                      setShowMobileMenu(false);
                    }}
                    className="w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-3 px-3.5 font-semibold text-xs transition-all cursor-pointer"
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
                          ? 'bg-[#1B357B] dark:bg-[#C59B4B] text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Users className={`w-4.5 h-4.5 shrink-0 ${activeView === 'admin' ? 'text-white' : 'text-rose-600 dark:text-rose-400'}`} />
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
                      className="w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-3 px-3.5 font-semibold text-xs transition-all cursor-pointer"
                    >
                      <ScrollText className="w-4.5 h-4.5 text-slate-600 dark:text-slate-300 shrink-0" />
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
                      className="w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-3 px-3.5 font-semibold text-xs transition-all cursor-pointer"
                    >
                      <BookOpen className="w-4.5 h-4.5 text-[#1B357B] dark:text-[#E2C37A] shrink-0" />
                      <span>Manual do Usuário</span>
                    </button>
                  )}
                </div>

              </div>
            </div>

            {/* Rodapé da Gaveta com Ações de Conta */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
              <button
                onClick={() => {
                  onOpenProfileModal('profile');
                  setShowMobileMenu(false);
                }}
                className="w-full h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                <User className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span>Minha Conta</span>
              </button>
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onLogout();
                }}
                className="w-full h-11 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-rose-200 dark:border-rose-900/60"
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
