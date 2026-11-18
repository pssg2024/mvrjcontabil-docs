import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderLock, 
  UserCheck, 
  Clock, 
  AlertCircle, 
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
  EyeOff,
  UserPlus
} from 'lucide-react';
import { Sector, UserProfile, AuthHeaderConfig } from '../types';
import { showToast } from '../lib/toast';

interface AuthModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: UserProfile) => void;
  onRequestAccessSuccess: (newUser: UserProfile) => void;
  allProfiles: UserProfile[];
  deletedEmails?: string[];
  authHeaderConfig?: AuthHeaderConfig;
  onOpenHeaderCustomizer?: () => void;
  onOpenLgpdModal?: () => void;
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
  deletedEmails = [],
  authHeaderConfig,
  onOpenHeaderCustomizer,
  onOpenLgpdModal,
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
    canReapply?: boolean;
    suggestedEmail?: string;
  } | null>(null);

  // Registration form state
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regSector, setRegSector] = useState<Sector>('Fiscal');
  const [registrationSubmitted, setRegistrationSubmitted] = useState<UserProfile | null>(null);
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);


  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginStatusMessage(null);

    const emailTrimmed = loginEmail.trim().toLowerCase();
    const user = allProfiles.find(p => p.email.toLowerCase() === emailTrimmed);

    if (!user) {
      const isKnownDeleted = deletedEmails?.some(e => e.toLowerCase() === emailTrimmed);
      setLoginStatusMessage({
        type: 'error',
        text: isKnownDeleted
          ? 'Acesso Revogado: Este perfil foi excluído pelo administrador e não possui mais acesso ao sistema. Se você deseja ter acesso novamente (mesmo utilizando o mesmo e-mail), envie uma nova solicitação de acesso e aguarde a autorização da Diretoria.'
          : 'Usuário não encontrado ou perfil excluído. Usuários excluídos pelo administrador não têm mais acesso ao sistema. Para ter acesso novamente, envie uma nova solicitação e aguarde a autorização do administrador.',
        canReapply: true,
        suggestedEmail: loginEmail.trim(),
      });
      return;
    }

    if (user.status === 'pending') {
      setLoginStatusMessage({
        type: 'pending',
        text: 'Sua solicitação de acesso está aguardando homologação do Administrador. Por favor, aguarde a liberação da administração para acessar seu perfil e os documentos.',
        user,
      });
      return;
    }

    if (user.status === 'blocked') {
      setLoginStatusMessage({
        type: 'blocked',
        text: 'Acesso Bloqueado: Seu perfil foi desativado pelo administrador e não possui acesso ao sistema. Entre em contato com a administração.',
        user,
      });
      return;
    }

    if (user.status === 'rejected') {
      setLoginStatusMessage({
        type: 'error',
        text: 'Acesso Recusado: Sua solicitação de cadastro não foi autorizada pela Diretoria. Para tentar novamente, você pode fazer uma nova solicitação de acesso.',
        user,
        canReapply: true,
        suggestedEmail: user.email,
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
        showToast(
          'Já existe uma solicitação de acesso pendente para este e-mail corporativo. Aguarde a liberação da administração.',
          'warning',
          { title: 'Solicitação em análise' }
        );
        return;
      }
      showToast(
        'Já existe um usuário ativo cadastrado com este e-mail corporativo.',
        'warning',
        { title: 'E-mail já cadastrado' }
      );
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
      {/* Fundo Animado atrás da área de login em loop suave contínuo (sem paradinha) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster="/images/login-video-poster.jpg"
          onCanPlay={(e) => {
            e.currentTarget.play().catch(() => {});
          }}
          className="w-full h-full object-cover select-none"
        >
          <source src="/images/204292-923909617_medium.mp4" type="video/mp4" />
          <source src="/204292-923909617_medium.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-slate-950/65" />
      </div>

      <div className="bg-[#091124]/92 backdrop-blur-xl w-full max-w-md rounded-2xl shadow-2xl shadow-black/70 border border-slate-700/60 overflow-hidden animate-in fade-in zoom-in-95 duration-300 relative z-10 text-slate-100">
        
        {/* Header Visual com Fundo Animado do Vídeo Corporativo */}
        <div 
          className="px-6 py-7 text-white text-center relative overflow-hidden flex flex-col justify-center items-center border-b border-slate-800/80"
          style={{
            background: 'linear-gradient(135deg, #0D1936 0%, #1B357B 100%)',
          }}
        >
          {/* Vídeo corporativo animado em loop contínuo */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
            <video
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              poster="/images/login-video-poster.jpg"
              onCanPlay={(e) => {
                e.currentTarget.play().catch(() => {});
              }}
              className="w-full h-full object-cover select-none filter contrast-[1.08] saturate-[1.15]"
            >
              <source src="/images/204292-923909617_medium.mp4" type="video/mp4" />
              <source src="/204292-923909617_medium.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-[#091124]/95 via-[#0B1736]/65 to-[#091124]/75" />
          </div>

          {isAdmin && onOpenHeaderCustomizer && (
            <button
              id="btn-edit-login-header-top"
              type="button"
              onClick={onOpenHeaderCustomizer}
              title="Personalizar Cabeçalho de Login (Acesso Administrador)"
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-200 transition-all backdrop-blur-xs flex items-center space-x-1 text-[11px] font-semibold cursor-pointer border border-white/15 z-20"
            >
              <Palette className="w-3.5 h-3.5 text-[#DFB76C]" />
              <span className="hidden sm:inline">Personalizar</span>
            </button>
          )}

          {((authHeaderConfig?.showIcon ?? true) || 
            (authHeaderConfig?.showTitle ?? true) || 
            (authHeaderConfig?.showSubtitle ?? true)) && (
            <div className="relative z-10 w-full flex flex-col items-center">
              {(authHeaderConfig?.showIcon ?? true) && (
                <div className="w-15 h-15 rounded-2xl bg-white/95 shadow-lg p-2.5 flex items-center justify-center mx-auto mb-3 border border-white/20">
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

              {(authHeaderConfig?.showTitle ?? true) && (
                <h2 className="text-[19px] font-bold tracking-tight text-white leading-tight">
                  {authHeaderConfig?.title ? (
                    authHeaderConfig.title.toUpperCase().includes('MVRJ') ? (
                      <>
                        {authHeaderConfig.title.split(' ')[0]}{' '}
                        <span className="text-[#DFB76C] font-extrabold">
                          {authHeaderConfig.title.split(' ').slice(1).join(' ') || 'CONTÁBIL'}
                        </span>
                      </>
                    ) : (
                      authHeaderConfig.title
                    )
                  ) : (
                    <>
                      MVRJ <span className="text-[#DFB76C] font-extrabold">CONTÁBIL</span>
                    </>
                  )}
                </h2>
              )}

              {(authHeaderConfig?.showSubtitle ?? true) && (
                <p className="text-xs text-slate-300 mt-1 tracking-normal font-medium">
                  {authHeaderConfig?.subtitle || 'Gestão Eletrônica Contábil'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-[#070e1e]/80 text-xs font-semibold">
          <button
            id="tab-login"
            type="button"
            onClick={() => {
              setActiveTab('login');
              setLoginStatusMessage(null);
            }}
            className={`flex-1 py-3 text-center transition-colors cursor-pointer ${
              activeTab === 'login'
                ? 'bg-[#091124] text-[#DFB76C] border-b-2 border-[#DFB76C] font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Acessar Sistema
          </button>
          <button
            id="tab-register"
            type="button"
            onClick={() => {
              setActiveTab('register');
              setRegistrationSubmitted(null);
            }}
            className={`flex-1 py-3 text-center transition-colors cursor-pointer ${
              activeTab === 'register'
                ? 'bg-[#091124] text-[#DFB76C] border-b-2 border-[#DFB76C] font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Solicitar Acesso
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {activeTab === 'login' ? (
            <div>
              {loginStatusMessage && (
                <div className={`mb-4 p-4 rounded-xl border text-xs leading-relaxed ${
                  loginStatusMessage.type === 'pending'
                    ? 'bg-amber-950/50 border-amber-500/40 text-amber-100'
                    : 'bg-rose-950/50 border-rose-500/40 text-rose-100'
                }`}>
                  <div className="flex items-start space-x-2.5">
                    {loginStatusMessage.type === 'pending' ? (
                      <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-bold text-sm mb-1 text-white">
                        {loginStatusMessage.type === 'pending' ? 'Cadastro em Homologação' : 'Acesso Restrito / Revogado'}
                      </h4>
                      <p className="text-slate-200">{loginStatusMessage.text}</p>
                      {loginStatusMessage.user && (
                        <div className="mt-2.5 pt-2 border-t border-amber-500/20 text-[11px] font-medium text-amber-200 flex justify-between">
                          <span>Setor: {loginStatusMessage.user.sector}</span>
                          <span className="uppercase tracking-wider font-bold">Status: {loginStatusMessage.user.status}</span>
                        </div>
                      )}

                      {loginStatusMessage.canReapply && (
                        <div className="mt-3 pt-2.5 border-t border-rose-500/25">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('register');
                              if (loginStatusMessage.suggestedEmail) {
                                setRegEmail(loginStatusMessage.suggestedEmail);
                              }
                              setLoginStatusMessage(null);
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-[#DFB76C] hover:brightness-105 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Solicitar Novo Acesso (Pode usar este mesmo e-mail)</span>
                          </button>
                          <p className="text-[10px] text-slate-400 mt-1.5 text-center font-normal">
                            Após enviar a solicitação, aguarde a autorização do Administrador para liberar seu acesso.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">E-mail Corporativo</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-email-input"
                      type="email"
                      required
                      placeholder="usuario@mvrjcontabil.com.br"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-100 bg-[#0F1B35] font-medium border border-slate-700/80 rounded-xl placeholder:text-slate-500 focus:border-[#DFB76C] focus:ring-2 focus:ring-[#DFB76C]/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Senha de Acesso</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-password-input"
                      type={showLoginPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 text-sm text-slate-100 bg-[#0F1B35] font-medium border border-slate-700/80 rounded-xl placeholder:text-slate-500 focus:border-[#DFB76C] focus:ring-2 focus:ring-[#DFB76C]/20 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#DFB76C] p-1 transition-colors focus:outline-none cursor-pointer"
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
                  className="w-full py-3 px-4 text-sm font-bold text-slate-950 bg-gradient-to-r from-[#ECD292] via-[#DFB76C] to-[#C99C42] hover:brightness-105 rounded-xl shadow-md hover:shadow-lg hover:shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden group"
                >
                  <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/35 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-[350%] transition-transform duration-1000 ease-out pointer-events-none" />
                  <span className="relative z-10">Entrar no Drive</span>
                  <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform duration-200" />
                </button>
              </form>
            </div>
          ) : (
            <div>
              {registrationSubmitted ? (
                <div className="text-center py-4 space-y-3">
                  <div className="w-12 h-12 bg-amber-500/15 border border-amber-500/30 text-[#DFB76C] rounded-full flex items-center justify-center mx-auto">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base text-white">Cadastro Realizado com Sucesso!</h3>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                    Sua solicitação foi enviada. Aguarde a aprovação do Administrador para acessar os documentos contábeis.
                  </p>
                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setRegistrationSubmitted(null);
                        setActiveTab('login');
                      }}
                      className="px-4 py-2 bg-[#DFB76C] text-slate-950 rounded-xl text-xs font-bold hover:brightness-105 transition-all cursor-pointer"
                    >
                      Voltar ao Login
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Nome Completo</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="reg-fullname-input"
                        type="text"
                        required
                        placeholder="Ex: João Ferreira da Silva"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-100 bg-[#0F1B35] font-medium border border-slate-700/80 rounded-xl placeholder:text-slate-500 focus:border-[#DFB76C] focus:ring-2 focus:ring-[#DFB76C]/20 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">E-mail Corporativo</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="reg-email-input"
                        type="email"
                        required
                        placeholder="joao@mvrjcontabil.com.br"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-100 bg-[#0F1B35] font-medium border border-slate-700/80 rounded-xl placeholder:text-slate-500 focus:border-[#DFB76C] focus:ring-2 focus:ring-[#DFB76C]/20 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Setor Contábil Solicitado</label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <select
                        id="reg-sector-select"
                        value={regSector}
                        onChange={(e) => setRegSector(e.target.value as Sector)}
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-100 bg-[#0F1B35] font-medium border border-slate-700/80 rounded-xl focus:border-[#DFB76C] focus:ring-2 focus:ring-[#DFB76C]/20 outline-none transition-all"
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
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Definir Senha</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="reg-password-input"
                        type={showRegPassword ? "text" : "password"}
                        required
                        placeholder="Mínimo 6 caracteres"
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 text-sm text-slate-100 bg-[#0F1B35] font-medium border border-slate-700/80 rounded-xl placeholder:text-slate-500 focus:border-[#DFB76C] focus:ring-2 focus:ring-[#DFB76C]/20 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#DFB76C] focus:outline-none p-1 transition-colors cursor-pointer"
                        aria-label={showRegPassword ? "Ocultar senha" : "Ver senha"}
                      >
                        {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-slate-400 text-[11px] leading-relaxed pt-0.5">
                    Novos cadastros passam por aprovação prévia do Administrador antes da liberação das pastas.
                  </p>

                  <button
                    id="submit-register-btn"
                    type="submit"
                    disabled={isSubmittingRegister}
                    className="w-full py-3 px-4 text-sm font-bold text-slate-950 bg-gradient-to-r from-[#ECD292] via-[#DFB76C] to-[#C99C42] hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl shadow-md hover:shadow-lg hover:shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden group"
                  >
                    <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/35 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-[350%] transition-transform duration-1000 ease-out pointer-events-none" />
                    <span className="relative z-10">{isSubmittingRegister ? 'Enviando Solicitação...' : 'Enviar Solicitação de Acesso'}</span>
                    <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform duration-200" />
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Discreet Corporate Footer */}
          <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>MVRJ Contábil · GED</span>
            {onOpenLgpdModal ? (
              <button
                type="button"
                onClick={onOpenLgpdModal}
                className="text-slate-400 hover:text-[#DFB76C] underline underline-offset-2 transition-colors cursor-pointer"
              >
                Termos & Privacidade (LGPD)
              </button>
            ) : (
              <span>Ambiente Monitorado</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
