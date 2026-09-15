import React, { useState, useId } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  Eye, 
  EyeOff, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Building2, 
  User, 
  Calendar,
  LogOut,
  Sparkles,
  ScrollText,
  Check
} from 'lucide-react';
import { UserProfile } from '../types';

interface FirstAccessModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  onCompleteFirstAccess: (updatedUser: UserProfile, newPassword?: string) => void;
  onLogout: () => void;
}

export const FirstAccessModal: React.FC<FirstAccessModalProps> = ({
  isOpen,
  currentUser,
  onCompleteFirstAccess,
  onLogout,
}) => {
  const [step, setStep] = useState<'password' | 'lgpd'>('password');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // LGPD Terms fields
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [lgpdAgreed, setLgpdAgreed] = useState(false);
  const [lgpdError, setLgpdError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lgpdScrollContainerRef = React.useRef<HTMLDivElement>(null);
  const protocolId = React.useMemo(() => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomHex = Math.random().toString(16).substring(2, 8).toUpperCase();
    return `MVRJ-LGPD-${timestamp}-${randomHex}`;
  }, []);

  if (!isOpen) return null;

  // Password strength checks
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const strengthScore = [
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar
  ].filter(Boolean).length;

  const getStrengthLabel = () => {
    if (newPassword.length === 0) return { label: 'Não digitada', color: 'bg-gray-200 text-gray-500' };
    if (strengthScore <= 2) return { label: 'Fraca', color: 'bg-rose-500 text-white' };
    if (strengthScore === 3 || strengthScore === 4) return { label: 'Média / Boa', color: 'bg-amber-500 text-white' };
    return { label: 'Excelente / Forte', color: 'bg-emerald-600 text-white' };
  };

  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar && passwordsMatch;

  const handlePasswordStepSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!isPasswordValid) {
      if (!passwordsMatch) {
        setPasswordError('A confirmação de senha não coincide com a nova senha digitada.');
      } else {
        setPasswordError('A nova senha deve atender a todos os critérios de segurança (mínimo 8 dígitos, maiúsculas, minúsculas, números e caracteres especiais).');
      }
      return;
    }

    setStep('lgpd');
  };

  const handleScrollTerms = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 40) {
      setHasScrolledToEnd(true);
    }
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLgpdError(null);

    if (!lgpdAgreed) {
      setLgpdError('Você deve ler e marcar o termo de aceite da LGPD para poder liberar o acesso ao sistema.');
      return;
    }

    setIsSubmitting(true);

    const now = new Date().toISOString();
    const updatedUser: UserProfile = {
      ...currentUser,
      first_access_completed: true,
      lgpd_accepted_at: now,
      password_changed_at: now,
      lgpd_terms_version: 'v1.0-2026-LGPD-13709',
      updated_at: now,
    };

    setTimeout(() => {
      onCompleteFirstAccess(updatedUser, newPassword);
      setIsSubmitting(false);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">Primeiro Acesso Obrigatório</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Segurança & LGPD
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Olá, <strong>{currentUser.full_name}</strong> ({currentUser.sector}). Conclua as etapas abaixo para liberar o GED.
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Sair do sistema"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-200 transition-colors flex items-center space-x-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>

        {/* Step Indicator Tabs */}
        <div className="grid grid-cols-2 bg-slate-100 border-b border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => setStep('password')}
            className={`py-3 px-4 flex items-center justify-center space-x-2 border-b-2 transition-all ${
              step === 'password'
                ? 'border-blue-600 bg-white text-blue-700 shadow-2xs'
                : isPasswordValid
                  ? 'border-transparent text-emerald-700 hover:bg-slate-50'
                  : 'border-transparent text-slate-500 hover:bg-slate-50'
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              isPasswordValid ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
            }`}>
              {isPasswordValid ? <Check className="w-3 h-3" /> : '1'}
            </div>
            <span>1. Nova Senha de Acesso</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (isPasswordValid) setStep('lgpd');
            }}
            disabled={!isPasswordValid}
            className={`py-3 px-4 flex items-center justify-center space-x-2 border-b-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              step === 'lgpd'
                ? 'border-blue-600 bg-white text-blue-700 shadow-2xs'
                : 'border-transparent text-slate-500 hover:bg-slate-50'
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              lgpdAgreed ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
            }`}>
              {lgpdAgreed ? <Check className="w-3 h-3" /> : '2'}
            </div>
            <span>2. Termo de Proteção LGPD</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* STEP 1: PASSWORD CHANGE */}
          {step === 'password' && (
            <form onSubmit={handlePasswordStepSubmit} className="space-y-5">
              <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start space-x-3">
                <KeyRound className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-950">
                  <p className="font-bold">Definição de Senha Pessoal e Intransferível</p>
                  <p className="mt-0.5 text-blue-800">
                    Por razões de conformidade e auditoria, sua senha provisória deve ser substituída por uma nova senha forte que atenda aos requisitos da política de segurança da informação.
                  </p>
                </div>
              </div>

              {passwordError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}

              {/* Password Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Senha Provisória / Atual
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Digite sua senha temporária de cadastro"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nova Senha Forte
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        className="w-full pl-9 pr-10 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Confirmar Nova Senha
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a nova senha"
                        className={`w-full pl-9 pr-10 py-2 text-sm border rounded-xl focus:ring-2 outline-hidden ${
                          confirmPassword && !passwordsMatch 
                            ? 'border-rose-300 focus:ring-rose-400' 
                            : confirmPassword && passwordsMatch 
                              ? 'border-emerald-400 focus:ring-emerald-400' 
                              : 'border-slate-300 focus:ring-blue-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Strength Meter */}
                {newPassword && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600">Força da Senha:</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStrengthLabel().color}`}>
                        {getStrengthLabel().label}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex gap-1">
                      {[1, 2, 3, 4, 5].map((idx) => (
                        <div
                          key={idx}
                          className={`h-full flex-1 transition-all duration-300 ${
                            idx <= strengthScore
                              ? strengthScore <= 2
                                ? 'bg-rose-500'
                                : strengthScore <= 4
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              : 'bg-transparent'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Requirements Checklist */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Critérios de Segurança Obrigatórios:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                    <div className={`flex items-center space-x-1.5 ${hasMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                      <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${hasMinLength ? 'text-emerald-600' : 'text-slate-300'}`} />
                      <span>Pelo menos 8 caracteres</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${hasUppercase ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                      <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${hasUppercase ? 'text-emerald-600' : 'text-slate-300'}`} />
                      <span>Uma letra maiúscula (A-Z)</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${hasLowercase ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                      <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${hasLowercase ? 'text-emerald-600' : 'text-slate-300'}`} />
                      <span>Uma letra minúscula (a-z)</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${hasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                      <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${hasNumber ? 'text-emerald-600' : 'text-slate-300'}`} />
                      <span>Pelo menos um número (0-9)</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${hasSpecialChar ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                      <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${hasSpecialChar ? 'text-emerald-600' : 'text-slate-300'}`} />
                      <span>Caractere especial (!@#$%&*)</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${passwordsMatch ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                      <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${passwordsMatch ? 'text-emerald-600' : 'text-slate-300'}`} />
                      <span>Senhas coincidem exatamente</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={!isPasswordValid}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center space-x-2"
                >
                  <span>Avançar para o Termo LGPD</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: LGPD TERMS & LEGAL CONDITIONS */}
          {step === 'lgpd' && (
            <form onSubmit={handleFinalSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                    <ScrollText className="w-4 h-4 text-blue-600" />
                    <span>Termo de Acesso & Proteção Geral de Dados Pessoais</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Conformidade com a Lei Federal nº 13.709/2018 (LGPD) e Normas do Conselho Federal de Contabilidade
                  </p>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
                  {protocolId}
                </span>
              </div>

              {lgpdError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{lgpdError}</span>
                </div>
              )}

              {/* Scrollable Legal Contract Box */}
              <div 
                ref={lgpdScrollContainerRef}
                onScroll={handleScrollTerms}
                className="h-64 overflow-y-auto p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-700 leading-relaxed font-sans space-y-3.5 select-text"
              >
                <div className="text-center pb-2 border-b border-slate-200">
                  <p className="font-extrabold text-xs text-slate-900 uppercase">
                    MVRJCONTÁBIL ASSESSORIA & GESTÃO CONTÁBIL
                  </p>
                  <p className="text-[10px] text-slate-500">
                    TERMO DE RESPONSABILIDADE, SIGILO PROFISSIONAL E CONFORMIDADE COM A LGPD
                  </p>
                  <p className="text-[10px] text-blue-700 font-semibold mt-0.5">
                    Documento de Validade Jurídica e Trilha de Auditoria Digital
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 mb-1">CLÁUSULA 1ª - DO OBJETO E FINALIDADE DO TRATAMENTO</h4>
                  <p>
                    O presente Termo estabelece as condições de acesso ao Sistema Eletrônico de Gerenciamento de Documentos (GED) da <strong>MVRJCONTÁBIL</strong>. O tratamento de dados cadastrais, fiscais, trabalhistas, contábeis e societários é realizado exclusivamente para a execução de serviços contábeis, apuração de tributos e cumprimento de obrigações legais e regulatórias perante a Receita Federal do Brasil, Secretarias de Fazenda e órgãos correlatos, fundamentado nos artigos 7º, incisos II e V, da Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 mb-1">CLÁUSULA 2ª - DO SIGILO PROFISSIONAL E CONFIDENCIALIDADE</h4>
                  <p>
                    O USUÁRIO expressamente se compromete a manter sigilo absoluto e irrestrito sobre quaisquer informações, documentos, notas fiscais, demonstrativos contábeis, folhas de pagamento, senhas, chaves de acesso e dados pessoais ou sensíveis a que tiver acesso em razão de suas atividades profissionais na MVRJCONTÁBIL, tanto durante o vínculo quanto após o seu término, sob pena das sanções civis, criminais e disciplinares cabíveis (Código Penal, art. 154; Código de Ética Profissional do Contador - NBC PG 01).
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 mb-1">CLÁUSULA 3ª - DA PESSOALIDADE E SEGURANÇA DAS CREDENCIAIS</h4>
                  <p>
                    A senha definida pelo USUÁRIO no presente ato é estritamente pessoal, intransferível e de seu exclusivo conhecimento. É terminantemente proibido o compartilhamento, empréstimo, anotação visível ou cessão de credenciais a terceiros, sejam colaboradores, clientes ou prestadores de serviços. O USUÁRIO assume total e integral responsabilidade por quaisquer operações (upload, download, visualização, edição ou exclusão de documentos) realizadas sob seu perfil.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 mb-1">CLÁUSULA 4ª - DA AUDITORIA, REGISTRO DE LOGS E RASTREABILIDADE</h4>
                  <p>
                    O GED Seguro da MVRJCONTÁBIL implementa trilhas imutáveis de auditoria digital. Toda e qualquer ação realizada dentro da plataforma é registrada de forma detalhada em banco de dados seguro, com carimbo de tempo inviolável (timestamp UTC), endereço de Protocolo de Internet (IP), identificação criptográfica e hash SHA-256 do arquivo manuseado, assegurando plena rastreabilidade e governança.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 mb-1">CLÁUSULA 5ª - DO DESCARTE, BACKUP E CRIPTOGRAFIA DE DADOS</h4>
                  <p>
                    Todos os arquivos sob custódia da MVRJCONTÁBIL são armazenados com criptografia em trânsito e em repouso por meio de infraestrutura em nuvem de alta disponibilidade (Cloudflare R2 Storage e Supabase PostgreSQL), com políticas rigorosas de retenção fiscal e descarte seguro conforme a legislação tributária brasileira.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 mb-1">CLÁUSULA 6ª - DOS INCIDENTES E SANÇÕES LEGAIS</h4>
                  <p>
                    Qualquer suspeita de incidente de segurança, perda, vazamento acidental ou uso indevido de dados pessoais deve ser imediatamente comunicada ao Encarregado de Proteção de Dados (DPO) da MVRJCONTÁBIL. A violação das regras aqui dispostas acarretará apuração de falta grave com possibilidade de rescisão contratual por justa causa (art. 482 da CLT), sem prejuízo da responsabilidade por perdas e danos e aplicação das penalidades previstas na Lei nº 13.709/2018 (art. 52).
                  </p>
                </div>
              </div>

              {/* Checkbox agreement */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-2xl space-y-2">
                <label className="flex items-start space-x-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={lgpdAgreed}
                    onChange={(e) => setLgpdAgreed(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-800 leading-snug">
                    Declaro que li atentamente, compreendi e concordo integralmente com os Termos de Acesso, Sigilo e Proteção Geral de Dados Pessoais (LGPD - Lei nº 13.709/2018) da MVRJCONTÁBIL.
                  </span>
                </label>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-blue-100">
                  <span>Assinatura Digital: <strong>{currentUser.email}</strong></span>
                  <span>Data: <strong>{new Date().toLocaleDateString('pt-BR')}</strong></span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep('password')}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Voltar para Senha
                </button>

                <button
                  type="submit"
                  disabled={!lgpdAgreed || isSubmitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Registrando Termo...' : 'Aceitar Termo e Liberar Acesso ao GED'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
