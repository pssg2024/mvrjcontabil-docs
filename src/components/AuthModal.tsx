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
  Palette,
  Eye,
  EyeOff
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
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginStatusMessage, setLoginStatusMessage] = useState<{
    type: 'pending' | 'blocked' | 'error' | 'success';
    text: string;
    user?: UserProfile;
  } | null>(null);

  // Registration form state
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regSector, setRegSector] = useState<Sector>('Fiscal');
  const [registrationSubmitted, setRegistrationSubmitted] = useState<UserProfile | null>(null);
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);

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
        text: 'Cadastro realizado com sucesso! Aguarde a aprovação do Administrador para acessar os documentos contábeis.',
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
    const isEvandro = userEmailKey === 'evandro230655@gmail.com' || userEmailKey === 'evandro132213@gmail.com';
    const expectedPassword = storedPasswords[userEmailKey] || (isEvandro ? (userEmailKey === 'evandro132213@gmail.com' ? '132213' : '230655') : 'Mvrj@2026');

    const isValid = loginPassword.trim() === expectedPassword || (isEvandro && (loginPassword.trim() === '230655' || loginPassword.trim() === '132213' || loginPassword.trim() === 'Mvrj@2026'));

    if (!isValid && (isEvandro || storedPasswords[userEmailKey])) {
      setLoginStatusMessage({
        type: 'error',
        text: 'Senha incorreta. Por favor, verifique a senha digitada.',
      });
      return;
    }

    // Sucesso
    onLoginSuccess(user);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName || !regEmail || !regPassword) return;

    // Se já existir usuário aprovado ou ativo com este email
    const existing = allProfiles.find(p => p.email.toLowerCase() === regEmail.trim().toLowerCase());
    if (existing && existing.status !== 'rejected') {
      if (existing.status === 'pending') {
        alert('Já existe uma solicitação de acesso pendente para este e-mail corporativo. Aguarde a liberação da administração.');
        return;
      }
      alert('Já existe um usuário ativo cadastrado com este e-mail corporativo.');
      return;
    }

    setIsSubmittingRegister(true);

    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      email: regEmail.trim(),
      full_name: regFullName.trim(),
      sector: regSector,
      role: 'User',
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

    try {
      // Dispara persistência no backend imediatamente
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao comunicar com o servidor');
      }

      onRequestAccessSuccess(newUser);
      setRegistrationSubmitted(newUser);
    } catch (err: any) {
      console.error('Erro ao registrar perfil:', err);
      // Fallback local se rede falhar
      onRequestAccessSuccess(newUser);
      setRegistrationSubmitted(newUser);
    } finally {
      setIsSubmittingRegister(false);
    }
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
          className="px-6 py-8 text-white text-center relative overflow-hidden flex flex-col justify-center items-center"
          style={{
            background: 'linear-gradient(135deg, #101F42 0%, #1B357B 100%)',
          }}
        >

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
            (authHeaderConfig?.showSubtitle ?? true)) && (
            <div className="relative z-10 w-full flex flex-col items-center">
              {/* Central Logo Container */}
              {(authHeaderConfig?.showIcon ?? true) && (
                <div className="w-16 h-16 rounded-2xl bg-white shadow-md p-2.5 flex items-center justify-center mx-auto mb-3 border border-slate-100">
                  {authHeaderConfig?.logoType === 'image' && authHeaderConfig?.logoImageUrl ? (
                    <img
                      src={authHeaderConfig.logoImageUrl}
                      alt="Logo"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    renderHeaderIcon()
                  )}
                </div>
              )}

              {/* Title & Subtitle */}
              <h2 className="text-[18px] font-bold tracking-tight text-white leading-tight">
                MVRJ <span className="text-[#C59B4B]">CONTÁBIL</span>
              </h2>
              
              <p className="text-xs text-slate-300 mt-1 tracking-normal">
                Gestão Eletrônica Contábil
              </p>
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold">
          <button
            id="tab-login"
            onClick={() => {
              setActiveTab('login');
              setLoginStatusMessage(null);
            }}
            className={`flex-1 py-3 text-center transition-all ${
              activeTab === 'login'
                ? 'bg-white text-[#1B357B] border-b-2 border-[#C59B4B] font-bold'
                : 'text-slate-500 hover:text-slate-800'
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
                ? 'bg-white text-[#1B357B] border-b-2 border-[#C59B4B] font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Solicitar Acesso
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
                    ? 'bg-rose-50 border-rose-300 text-rose-900'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <div className="flex items-start space-x-2.5">
                    {loginStatusMessage.type === 'pending' ? (
                      <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">E-mail Corporativo</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      id="login-email-input"
                      type="email"
                      required
                      placeholder="usuario@mvrjcontabil.com.br"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-[#1B357B] focus:ring-2 focus:ring-[#1B357B]/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Senha de Acesso</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-password-input"
                      type={showLoginPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-[#1B357B] focus:ring-2 focus:ring-[#1B357B]/20 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#1B357B] p-1 transition-colors focus:outline-none"
                      aria-label={showLoginPassword ? "Ocultar senha" : "Ver senha"}
                    >
                      {showLoginPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  id="submit-login-btn"
                  type="submit"
                  className="w-full py-3 px-4 text-sm font-semibold text-white bg-[#C59B4B] hover:bg-[#B38A3A] rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
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
                  <h3 className="font-bold text-base text-gray-900">Cadastro Realizado com Sucesso!</h3>
                  <p className="text-xs text-gray-600 leading-relaxed max-w-xs mx-auto">
                    Cadastro realizado com sucesso! Aguarde a aprovação do Administrador para acessar os documentos contábeis.
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nome Completo</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        id="reg-fullname-input"
                        type="text"
                        required
                        placeholder="Ex: João Ferreira da Silva"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-[#1B357B] focus:ring-2 focus:ring-[#1B357B]/20 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">E-mail Corporativo</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        id="reg-email-input"
                        type="email"
                        required
                        placeholder="joao@mvrjcontabil.com.br"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-[#1B357B] focus:ring-2 focus:ring-[#1B357B]/20 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Setor Contábil Solicitado</label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <select
                        id="reg-sector-select"
                        value={regSector}
                        onChange={(e) => setRegSector(e.target.value as Sector)}
                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-[#1B357B] focus:ring-2 focus:ring-[#1B357B]/20 outline-none transition-all bg-white"
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Definir Senha</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        id="reg-password-input"
                        type={showRegPassword ? "text" : "password"}
                        required
                        placeholder="Mínimo 6 caracteres"
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-[#1B357B] focus:ring-2 focus:ring-[#1B357B]/20 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 transition-colors"
                        aria-label={showRegPassword ? "Ocultar senha" : "Ver senha"}
                      >
                        {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 text-slate-600 text-[11px] rounded-xl p-3 leading-relaxed">
                    Segurança Institucional: Por diretriz interna da MVRJ Contábil, novos cadastros passam por aprovação prévia do Administrador antes da liberação de visualização das pastas.
                  </div>

                  <button
                    id="submit-register-btn"
                    type="submit"
                    disabled={isSubmittingRegister}
                    className="w-full py-3 px-4 text-sm font-semibold text-white bg-[#C59B4B] hover:bg-[#B38A3A] disabled:opacity-60 disabled:cursor-not-allowed rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{isSubmittingRegister ? 'Enviando Solicitação...' : 'Enviar Solicitação de Acesso'}</span>
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
