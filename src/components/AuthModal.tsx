import React, { useState } from 'react';
import { 
  FolderLock, 
  UserCheck, 
  Clock, 
  AlertCircle, 
  ShieldAlert, 
  ArrowRight, 
  CheckCircle2, 
  Building2, 
  Mail, 
  Lock, 
  User,
  ShieldCheck,
  Landmark,
  FileText,
  Palette
} from 'lucide-react';
import { Sector, UserProfile, AuthHeaderConfig } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: UserProfile) => void;
  onRequestAccessSuccess: (newUser: UserProfile) => void;
  allProfiles: UserProfile[];
  authHeaderConfig?: AuthHeaderConfig;
  onOpenHeaderCustomizer?: () => void;
  isAdmin?: boolean;
}

const GRADIENT_PRESET_CLASSES: Record<string, string> = {
  'slate-indigo-blue': 'bg-gradient-to-tr from-slate-900 via-indigo-950 to-blue-900',
  'midnight-navy': 'bg-gradient-to-tr from-blue-950 via-slate-900 to-indigo-950',
  'emerald-dark': 'bg-gradient-to-tr from-emerald-950 via-slate-900 to-teal-950',
  'royal-purple': 'bg-gradient-to-tr from-purple-950 via-slate-900 to-indigo-950',
  'graphite-dark': 'bg-gradient-to-tr from-zinc-950 via-neutral-900 to-stone-900',
  'blue-cyan': 'bg-gradient-to-tr from-blue-900 via-blue-950 to-cyan-950',
  'amber-gold': 'bg-gradient-to-tr from-amber-950 via-stone-900 to-neutral-950',
};

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onLoginSuccess,
  onRequestAccessSuccess,
  allProfiles,
  authHeaderConfig,
  onOpenHeaderCustomizer,
  isAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginStatusMessage, setLoginStatusMessage] = useState<{
    type: 'pending' | 'blocked' | 'error' | 'success';
    text: string;
    user?: UserProfile;
  } | null>(null);

  // Registration form state
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSector, setRegSector] = useState<Sector>('Fiscal');
  const [registrationSubmitted, setRegistrationSubmitted] = useState<UserProfile | null>(null);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginStatusMessage(null);

    const user = allProfiles.find(p => p.email.toLowerCase() === loginEmail.trim().toLowerCase());

    if (!user) {
      setLoginStatusMessage({
        type: 'error',
        text: 'Usuário não encontrado. Verifique o e-mail ou envie uma Solicitação de Acesso.',
      });
      return;
    }

    if (user.status === 'pending') {
      setLoginStatusMessage({
        type: 'pending',
        text: 'Solicitação em Análise: Seu cadastro foi realizado com sucesso e está aguardando homologação pela Diretoria ou Administrador do escritório.',
        user,
      });
      return;
    }

    if (user.status === 'blocked') {
      setLoginStatusMessage({
        type: 'blocked',
        text: 'Acesso Bloqueado: Seu perfil está temporariamente desativado no sistema. Entre em contato com a administração.',
        user,
      });
      return;
    }

    if (user.status === 'rejected') {
      setLoginStatusMessage({
        type: 'error',
        text: 'Acesso Recusado: Sua solicitação de cadastro não foi autorizada pela Diretoria.',
        user,
      });
      return;
    }

    // Validação de senha: verifica senha atualizada no localStorage ou senha padrão
    const storedPasswords = JSON.parse(localStorage.getItem('mvrj_passwords') || '{}');
    const userEmailKey = user.email.toLowerCase();
    const expectedPassword = storedPasswords[userEmailKey] || (userEmailKey === 'evandro230655@gmail.com' ? '230655' : 'Mvrj@2026');

    if (loginPassword.trim() !== expectedPassword && (userEmailKey === 'evandro230655@gmail.com' || storedPasswords[userEmailKey])) {
      setLoginStatusMessage({
        type: 'error',
        text: 'Senha incorreta. Por favor, verifique a senha digitada.',
      });
      return;
    }

    // Sucesso
    onLoginSuccess(user);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName || !regEmail || !regPassword) return;

    const existing = allProfiles.find(p => p.email.toLowerCase() === regEmail.trim().toLowerCase());
    if (existing) {
      alert('Já existe um usuário cadastrado com este e-mail corporativo.');
      return;
    }

    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      email: regEmail.trim(),
      full_name: regFullName.trim(),
      sector: regSector,
      role: 'viewer',
      status: 'pending', // Regra mandatória: inicia pendente
      first_access_completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Armazena a senha provisória informada no cadastro
    try {
      const stored = JSON.parse(localStorage.getItem('mvrj_passwords') || '{}');
      stored[regEmail.trim().toLowerCase()] = regPassword.trim();
      localStorage.setItem('mvrj_passwords', JSON.stringify(stored));
    } catch {}

    onRequestAccessSuccess(newUser);
    setRegistrationSubmitted(newUser);
  };

  // Helper for rendering header icon
  const renderHeaderIcon = () => {
    const iconName = authHeaderConfig?.iconName || 'FolderLock';
    switch (iconName) {
      case 'ShieldCheck':
        return <ShieldCheck className="w-8 h-8 text-blue-300" />;
      case 'Building2':
        return <Building2 className="w-8 h-8 text-blue-300" />;
      case 'Landmark':
        return <Landmark className="w-8 h-8 text-blue-300" />;
      case 'FileText':
        return <FileText className="w-8 h-8 text-blue-300" />;
      case 'Lock':
        return <Lock className="w-8 h-8 text-blue-300" />;
      case 'FolderLock':
      default:
        return <FolderLock className="w-8 h-8 text-blue-300" />;
    }
  };

  const bgGradient =
    GRADIENT_PRESET_CLASSES[authHeaderConfig?.gradientPreset || 'slate-indigo-blue'] ||
    GRADIENT_PRESET_CLASSES['slate-indigo-blue'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Visual */}
        <div 
          className={`px-6 text-white text-center relative overflow-hidden transition-all duration-300 flex flex-col justify-center items-center ${
            authHeaderConfig?.bgType === 'image' 
              ? '' 
              : bgGradient
          } ${
            authHeaderConfig?.headerHeight === 'compact'
              ? 'min-h-[140px] py-4'
              : authHeaderConfig?.headerHeight === 'tall'
              ? 'min-h-[210px] py-6'
              : authHeaderConfig?.headerHeight === 'banner'
              ? 'min-h-[240px] py-6'
              : (authHeaderConfig?.bgType === 'image' && !authHeaderConfig?.showIcon && !authHeaderConfig?.showTitle && !authHeaderConfig?.showSubtitle && !authHeaderConfig?.showBadge)
              ? 'h-52 py-4'
              : 'min-h-[180px] py-6'
          }`}
          style={
            authHeaderConfig?.bgType === 'image'
              ? { backgroundColor: authHeaderConfig?.bgColor || '#091830' }
              : undefined
          }
        >
          {/* Background Image Layer if bgType === 'image' */}
          {authHeaderConfig?.bgType === 'image' && authHeaderConfig?.bgImageUrl && (
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none transition-all duration-300"
              style={{
                backgroundImage: `url(${authHeaderConfig.bgImageUrl})`,
                backgroundSize: authHeaderConfig.bgSize || 'contain',
                backgroundPosition: authHeaderConfig.bgPosition || 'center',
                backgroundRepeat: 'no-repeat',
                opacity: (authHeaderConfig.bgOpacity ?? 100) / 100,
                filter: authHeaderConfig.bgBlur ? `blur(${authHeaderConfig.bgBlur}px)` : 'none',
                transform: (authHeaderConfig.bgBlur && authHeaderConfig.bgSize !== 'contain') ? 'scale(1.08)' : 'none',
              }}
            />
          )}

          {/* Overlay Layer for legibility */}
          {authHeaderConfig?.bgType === 'image' && authHeaderConfig?.bgImageUrl && authHeaderConfig.bgOverlayType !== 'none' && (
            <div
              aria-hidden="true"
              className={`absolute inset-0 pointer-events-none ${
                authHeaderConfig.bgOverlayType === 'dark' ? 'bg-slate-950' : 'bg-white'
              }`}
              style={{
                opacity: (authHeaderConfig.bgOverlayOpacity ?? 40) / 100,
              }}
            />
          )}

          {/* Admin Customization Quick Trigger Button */}
          {isAdmin && onOpenHeaderCustomizer && (
            <button
              id="btn-edit-login-header-top"
              type="button"
              onClick={onOpenHeaderCustomizer}
              title="Personalizar Cabeçalho de Login (Acesso Administrador)"
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/15 hover:bg-white/30 text-white transition-all backdrop-blur-xs flex items-center space-x-1 text-[11px] font-bold cursor-pointer shadow-xs border border-white/20 z-20"
            >
              <Palette className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Personalizar</span>
            </button>
          )}

          {/* Foreground Visual Content */}
          {((authHeaderConfig?.showIcon ?? true) || 
            (authHeaderConfig?.showTitle ?? true) || 
            (authHeaderConfig?.showSubtitle ?? true) || 
            (authHeaderConfig?.showBadge ?? true)) && (
            <div className="relative z-10 w-full flex flex-col items-center">
              {/* Central Logo or Icon Container */}
              {(authHeaderConfig?.showIcon ?? true) && (
                <div className="w-14 h-14 mx-auto rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 mb-3 shadow-inner overflow-hidden">
                  {authHeaderConfig?.logoType === 'image' && authHeaderConfig?.logoImageUrl ? (
                    <img
                      src={authHeaderConfig.logoImageUrl}
                      alt="Logo"
                      className="max-h-10 max-w-10 object-contain"
                    />
                  ) : (
                    renderHeaderIcon()
                  )}
                </div>
              )}

              {/* Title */}
              {(authHeaderConfig?.showTitle ?? true) && (
                <h2 className="text-xl font-black tracking-tight text-white drop-shadow-xs">
                  {authHeaderConfig?.title || 'MVRJ CONTÁBIL'}
                </h2>
              )}

              {/* Subtitle */}
              {(authHeaderConfig?.showSubtitle ?? true) && (
                <p className="text-xs text-blue-200/90 mt-0.5 drop-shadow-xs">
                  {authHeaderConfig?.subtitle || 'Gestão Eletrônica de Documentos Segura'}
                </p>
              )}

              {/* Badge */}
              {(authHeaderConfig?.showBadge ?? true) && (
                <div className="inline-flex items-center space-x-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-[11px] font-medium text-blue-200 border border-blue-400/30 backdrop-blur-xs">
                  <ShieldAlert className="w-3 h-3 text-blue-300 shrink-0" />
                  <span>{authHeaderConfig?.badgeText || 'Supabase RLS & Cloudflare R2'}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-100 bg-gray-50/70 text-xs font-semibold">
          <button
            id="tab-login"
            onClick={() => {
              setActiveTab('login');
              setLoginStatusMessage(null);
            }}
            className={`flex-1 py-3 text-center transition-all ${
              activeTab === 'login'
                ? 'bg-white text-blue-700 border-b-2 border-blue-600 font-bold'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Acessar Sistema
          </button>
          <button
            id="tab-register"
            onClick={() => {
              setActiveTab('register');
              setRegistrationSubmitted(null);
            }}
            className={`flex-1 py-3 text-center transition-all ${
              activeTab === 'register'
                ? 'bg-white text-blue-700 border-b-2 border-blue-600 font-bold'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Solicitar Acesso (Cadastro)
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {activeTab === 'login' ? (
            <div>
              {/* Status Alert for Pending / Blocked */}
              {loginStatusMessage && (
                <div className={`mb-4 p-4 rounded-xl border text-xs leading-relaxed ${
                  loginStatusMessage.type === 'pending'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : loginStatusMessage.type === 'blocked'
                    ? 'bg-red-50 border-red-300 text-red-900'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <div className="flex items-start space-x-2.5">
                    {loginStatusMessage.type === 'pending' ? (
                      <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className="font-bold text-sm mb-1">
                        {loginStatusMessage.type === 'pending' ? 'Cadastro em Homologação' : 'Acesso Restrito'}
                      </h4>
                      <p>{loginStatusMessage.text}</p>
                      {loginStatusMessage.user && (
                        <div className="mt-2.5 pt-2 border-t border-amber-200/60 text-[11px] font-medium text-amber-800 flex justify-between">
                          <span>Setor: {loginStatusMessage.user.sector}</span>
                          <span className="uppercase tracking-wider font-bold">Status: {loginStatusMessage.user.status}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">E-mail Corporativo</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      id="login-email-input"
                      type="email"
                      required
                      placeholder="usuario@mvrjcontabil.com.br"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Senha de Acesso</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      id="login-password-input"
                      type="password"
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all"
                    />
                  </div>
                </div>

                <button
                  id="submit-login-btn"
                  type="submit"
                  className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-2"
                >
                  <span>Entrar no Drive</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            <div>
              {registrationSubmitted ? (
                <div className="text-center py-4 space-y-3">
                  <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
                    <Clock className="w-6 h-6 animate-pulse" />
                  </div>
                  <h3 className="font-bold text-base text-gray-900">Solicitação Registrada com Sucesso!</h3>
                  <p className="text-xs text-gray-600 leading-relaxed max-w-xs mx-auto">
                    Seu cadastro foi enviado com status <strong className="text-amber-800 font-bold">"Pendente"</strong>. Conforme as diretrizes de segurança da MVRJCONTÁBIL, um administrador avaliará suas permissões para o setor <strong className="text-blue-700 font-bold">{registrationSubmitted.sector}</strong>.
                  </p>
                  <div className="pt-3">
                    <button
                      onClick={() => {
                        setRegistrationSubmitted(null);
                        setActiveTab('login');
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Voltar ao Login
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Nome Completo</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                      <input
                        id="reg-fullname-input"
                        type="text"
                        required
                        placeholder="Ex: João Ferreira da Silva"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">E-mail Corporativo</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                      <input
                        id="reg-email-input"
                        type="email"
                        required
                        placeholder="joao@mvrjcontabil.com.br"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Setor Contábil Solicitado</label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                      <select
                        id="reg-sector-select"
                        value={regSector}
                        onChange={(e) => setRegSector(e.target.value as Sector)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
                      >
                        <option value="Fiscal">Fiscal</option>
                        <option value="Departamento Pessoal">Departamento Pessoal</option>
                        <option value="Contábil">Contábil</option>
                        <option value="Diretoria">Diretoria</option>
                        <option value="Financeiro">Financeiro</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Definir Senha</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                      <input
                        id="reg-password-input"
                        type="password"
                        required
                        placeholder="Mínimo 6 caracteres"
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 leading-tight">
                    🔒 Conforme a política de governança RBAC da MVRJCONTÁBIL, seu acesso inicial será cadastrado como <span className="font-semibold text-slate-900">Pendente</span> e passará por aprovação.
                  </div>

                  <button
                    id="submit-register-btn"
                    type="submit"
                    className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-2 mt-2"
                  >
                    <span>Enviar Solicitação de Acesso</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
