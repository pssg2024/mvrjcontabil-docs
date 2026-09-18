import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Camera, 
  Upload, 
  Trash2, 
  Check, 
  User, 
  Mail, 
  Building2, 
  AlertCircle,
  Loader2,
  CheckCircle2,
  Cloud,
  Database,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ScrollText,
  Sparkles
} from 'lucide-react';
import { UserProfile } from '../types';
import { optimizeAvatarImage, formatBytes } from '../lib/optimization';
import { uploadAvatarToR2, deleteAvatarFromR2, updateSupabaseProfile } from '../lib/storage-service';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSaveProfile: (updatedData: { full_name: string; avatar_url?: string }) => void;
  onPasswordChange?: (newPassword: string) => void;
  onOpenLgpdModal?: () => void;
  initialTab?: 'profile' | 'security';
}

const DEFAULT_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSaveProfile,
  onPasswordChange,
  onOpenLgpdModal,
  initialTab = 'profile',
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>(initialTab);
  const [fullName, setFullName] = useState(currentUser.full_name);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(currentUser.avatar_url);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [optimizationStats, setOptimizationStats] = useState<{
    originalSize: number;
    optimizedSize: number;
    width: number;
    height: number;
  } | null>(null);
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para Troca Opcional de Senha
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Sync state when currentUser changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setFullName(currentUser.full_name);
      setAvatarUrl(currentUser.avatar_url);
      setErrorMsg(null);
      setSuccessMsg(null);
      setPasswordSuccessMsg(null);
      setPasswordErrorMsg(null);
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setOptimizationStats(null);
      setImgError(false);
    }
  }, [isOpen, currentUser, initialTab]);

  if (!isOpen) return null;

  // Critérios de força da nova senha (flexível: min 4 caracteres, com qualquer combinação de letras, números e símbolos)
  const hasMinLength = newPasswordInput.length >= 4;
  const passwordsMatch = newPasswordInput.length > 0 && newPasswordInput === confirmPasswordInput;

  const strengthScore = newPasswordInput.length >= 8 ? 3 : newPasswordInput.length >= 4 ? 2 : 1;

  const getStrengthLabel = () => {
    if (newPasswordInput.length === 0) return { label: 'Não digitada', color: 'bg-gray-200 text-gray-500' };
    if (newPasswordInput.length < 4) return { label: 'Muito curta', color: 'bg-rose-500 text-white' };
    if (newPasswordInput.length < 8) return { label: 'Boa', color: 'bg-amber-500 text-white' };
    return { label: 'Forte', color: 'bg-emerald-600 text-white' };
  };

  const isPasswordValid = hasMinLength && passwordsMatch;

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrorMsg(null);
    setPasswordSuccessMsg(null);

    // Validação da senha atual se houver uma cadastrada
    const storedPasswords = JSON.parse(localStorage.getItem('mvrj_passwords') || '{}');
    const userEmailKey = currentUser.email.toLowerCase();
    const expectedPassword = storedPasswords[userEmailKey] || (userEmailKey === 'evandro230655@gmail.com' ? '230655' : 'Mvrj@2026');

    if (currentPasswordInput && currentPasswordInput.trim() !== expectedPassword) {
      setPasswordErrorMsg('A senha atual digitada está incorreta.');
      return;
    }

    if (!isPasswordValid) {
      if (!passwordsMatch) {
        setPasswordErrorMsg('A confirmação de senha não coincide com a nova senha digitada.');
      } else {
        setPasswordErrorMsg('A nova senha deve ter no mínimo 8 caracteres, com maiúsculas, minúsculas, números e caracteres especiais.');
      }
      return;
    }

    setIsChangingPassword(true);

    try {
      if (onPasswordChange) {
        onPasswordChange(newPasswordInput.trim());
      } else {
        storedPasswords[userEmailKey] = newPasswordInput.trim();
        localStorage.setItem('mvrj_passwords', JSON.stringify(storedPasswords));
      }

      setPasswordSuccessMsg('Sua senha de acesso foi atualizada com sucesso!');
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
    } catch (err: any) {
      setPasswordErrorMsg('Erro ao salvar nova senha.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleProcessAndUpload = async (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setOptimizationStats(null);

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor, selecione um arquivo de imagem válido (JPG, PNG ou WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('A imagem deve ter no máximo 10MB para otimização.');
      return;
    }

    setIsProcessing(true);
    setUploadProgress(10);
    setStatusText('Otimizando imagem (400x400 px, formato WebP)...');

    try {
      // 1. Otimizar / Redimensionar para max 400x400 e converter para .webp
      const optResult = await optimizeAvatarImage(file);
      setOptimizationStats({
        originalSize: optResult.originalSize,
        optimizedSize: optResult.optimizedSize,
        width: optResult.width,
        height: optResult.height,
      });

      setUploadProgress(40);
      setStatusText(`Enviando para Cloudflare R2 (avatars/${currentUser.id}.webp)...`);

      // 2. Fazer upload para o Cloudflare R2 no caminho avatars/{user_id}.webp
      const uploadRes = await uploadAvatarToR2(
        currentUser.id,
        optResult.blob,
        currentUser.email,
        (progress) => {
          setUploadProgress(40 + Math.round(progress * 0.5));
        }
      );

      // 3. Atualizar no Supabase e estado local
      setAvatarUrl(uploadRes.avatarUrl);
      setImgError(false);
      setUploadProgress(100);

      onSaveProfile({
        full_name: fullName.trim(),
        avatar_url: uploadRes.avatarUrl,
      });

      const reductionPercent = Math.round(
        ((optResult.originalSize - optResult.optimizedSize) / optResult.originalSize) * 100
      );

      setSuccessMsg(
        `Avatar otimizado e enviado com sucesso ao Cloudflare R2! Redução de ${Math.max(0, reductionPercent)}% (${formatBytes(optResult.originalSize)} ➔ ${formatBytes(optResult.optimizedSize)}).`
      );
    } catch (err: any) {
      console.error('Erro no fluxo de avatar:', err);
      setErrorMsg(err.message || 'Falha ao processar e enviar foto de perfil para o Cloudflare R2.');
    } finally {
      setIsProcessing(false);
      setStatusText('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessAndUpload(e.dataTransfer.files[0]);
    }
  };

  const handleRemovePhoto = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsProcessing(true);
    setStatusText('Removendo avatar do Cloudflare R2 e Supabase...');

    try {
      // 1. Excluir do Cloudflare R2 e definir avatar_url = NULL no Supabase
      await deleteAvatarFromR2(currentUser.id, currentUser.email);

      setAvatarUrl(undefined);
      setImgError(false);
      setOptimizationStats(null);

      onSaveProfile({
        full_name: fullName.trim(),
        avatar_url: undefined,
      });

      setSuccessMsg('Foto de perfil removida com sucesso do Cloudflare R2 e do perfil Supabase.');
    } catch (err: any) {
      console.error('Erro ao remover avatar:', err);
      setErrorMsg(err.message || 'Falha ao remover foto do Cloudflare R2.');
    } finally {
      setIsProcessing(false);
      setStatusText('');
    }
  };

  const handleSelectPresetAvatar = async (presetUrl: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsProcessing(true);
    setStatusText('Otimizando avatar corporativo selecionado...');

    try {
      const response = await fetch(presetUrl);
      const blob = await response.blob();
      const file = new File([blob], 'avatar-preset.jpg', { type: blob.type });

      await handleProcessAndUpload(file);
    } catch (err: any) {
      setErrorMsg('Não foi possível carregar a imagem predefinida.');
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('O nome completo não pode ficar em branco.');
      return;
    }

    setIsProcessing(true);
    setStatusText('Sincronizando perfil com Supabase...');

    try {
      // Salvar alterações de nome e avatar no Supabase
      await updateSupabaseProfile(currentUser.id, {
        full_name: fullName.trim(),
        avatar_url: avatarUrl || null,
        email: currentUser.email,
      });

      onSaveProfile({
        full_name: fullName.trim(),
        avatar_url: avatarUrl,
      });

      onClose();
    } catch (err: any) {
      // Mesmo com erro de rede no Supabase, salva no estado local da aplicação
      onSaveProfile({
        full_name: fullName.trim(),
        avatar_url: avatarUrl,
      });
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  // Extrai inicial para o fallback de visualização
  const userInitial = (fullName.trim() || 'U').charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shadow-2xs">
              {activeTab === 'profile' ? <User className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5 text-blue-700" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Meu Perfil de Acesso</h2>
              <p className="text-xs text-gray-500">MVRJCONTÁBIL • Gestão Eletrônica de Documentos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-gray-200 bg-slate-50/80 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 px-4 text-xs font-bold flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === 'profile'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Dados do Perfil & Foto</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`pb-2.5 px-4 text-xs font-bold flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === 'security'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-500" />
            <span>Segurança & Senha</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 font-semibold ml-1">
              Opcional
            </span>
          </button>
        </div>

        {/* Tab 1: Profile & Avatar */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
            {/* Alertas de Notificação */}
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center space-x-2 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center space-x-2 animate-in fade-in duration-150">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Seção do Avatar com Upload Cloudflare R2 */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 pb-6 border-b border-gray-100">
              {/* Visualizador de Avatar & Fallback de Iniciais */}
              <div className="relative group shrink-0">
                <div 
                  onDragOver={(e) => { e.preventDefault(); if (!isProcessing) setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => !isProcessing && fileInputRef.current?.click()}
                  className={`w-28 h-28 rounded-full overflow-hidden border-2 cursor-pointer shadow-md transition-all flex items-center justify-center relative bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 text-white select-none ${
                    isDragging 
                      ? 'border-blue-500 ring-4 ring-blue-100 scale-105' 
                      : 'border-white ring-2 ring-gray-200 hover:ring-blue-400'
                  } ${isProcessing ? 'cursor-wait opacity-80' : ''}`}
                  title="Clique ou arraste para alterar foto de perfil"
                >
                  {/* Fallback de Visualização */}
                  {avatarUrl && !imgError ? (
                    <img 
                      src={avatarUrl} 
                      alt={fullName}
                      referrerPolicy="no-referrer"
                      onError={() => setImgError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl font-extrabold tracking-tight text-white drop-shadow-xs">
                      {userInitial}
                    </span>
                  )}

                  {/* Overlay de Hover e Estado de Carregamento */}
                  {isProcessing ? (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white text-[11px] font-medium p-2 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mb-1 text-blue-300" />
                      <span className="text-[10px] leading-tight">Processando...</span>
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-semibold">
                      <Camera className="w-5 h-5 mb-1" />
                      <span>Trocar foto</span>
                    </div>
                  )}
                </div>

                {/* Botão de Remoção (Lixeira) */}
                {avatarUrl && !isProcessing && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemovePhoto();
                    }}
                    title="Remover foto do Cloudflare R2 e Supabase"
                    className="absolute -top-1 -right-1 p-1.5 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-md transition-transform active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Ações e Informações de Otimização */}
              <div className="flex-1 space-y-3 text-center sm:text-left">
                <div>
                  <div className="flex items-center justify-center sm:justify-start space-x-2">
                    <h4 className="text-sm font-bold text-gray-900">Foto de Perfil Corporativa</h4>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                      <Cloud className="w-3 h-3 mr-1" /> R2: avatars/{currentUser.id}.webp
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    A imagem é automaticamente redimensionada para <strong>400x400 px</strong> e convertida para <strong>.webp</strong>.
                  </p>
                </div>

                {/* Barra de progresso durante envio */}
                {isProcessing && (
                  <div className="space-y-1.5 p-2.5 bg-blue-50/80 rounded-xl border border-blue-100 text-left">
                    <div className="flex items-center justify-between text-[11px] text-blue-900 font-medium">
                      <span className="flex items-center">
                        <Loader2 className="w-3 h-3 animate-spin mr-1.5 text-blue-600" />
                        {statusText || 'Processando envio para R2...'}
                      </span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-blue-200/60 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-out" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    accept="image/*"
                    disabled={isProcessing}
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleProcessAndUpload(e.target.files[0]);
                      }
                    }}
                  />
                  
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-2xs disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5 text-gray-500" />
                    <span>Selecionar Foto</span>
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleRemovePhoto}
                      className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-medium transition-colors flex items-center space-x-1 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      <span>Remover Foto</span>
                    </button>
                  )}
                </div>

                {/* Sugestões de Avatares Predefinidos */}
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 block mb-1.5">
                    Ou selecione um avatar rápido (otimizado para R2):
                  </span>
                  <div className="flex items-center space-x-2 justify-center sm:justify-start">
                    {DEFAULT_AVATARS.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleSelectPresetAvatar(url)}
                        title="Aplicar avatar predefinido"
                        className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-all disabled:opacity-50 ${
                          avatarUrl === url 
                            ? 'border-blue-600 ring-2 ring-blue-200 scale-110' 
                            : 'border-transparent hover:border-gray-300 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <img 
                          src={url} 
                          alt="Avatar suggestion" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover" 
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Dados Cadastrais */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nome de Exibição
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    disabled={isProcessing}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden disabled:bg-gray-50"
                    placeholder="Seu nome completo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    E-mail Corporativo
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      disabled
                      value={currentUser.email}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 text-gray-500 rounded-lg cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Setor & Papel (RBAC)
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <div className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 text-gray-700 rounded-lg font-medium flex items-center justify-between">
                      <span>{currentUser.sector}</span>
                      <span className="text-xs uppercase font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                        {currentUser.role}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informações de persistência */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-[11px] text-slate-600">
                <span className="flex items-center">
                  <Database className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                  Tabela Supabase: <strong className="ml-1 text-slate-800">public.profiles</strong>
                </span>
                <span className="flex items-center text-slate-500">
                  <Cloud className="w-3.5 h-3.5 mr-1 text-sky-600" />
                  Bucket R2: <strong className="ml-1 text-slate-800">mvrjcontabil-docs</strong>
                </span>
              </div>
            </div>

            {/* Rodapé com botões de ação */}
            <div className="pt-4 border-t border-gray-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isProcessing}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-colors flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Security & Optional Password Change */}
        {activeTab === 'security' && (
          <div className="p-6 space-y-6 overflow-y-auto">
            {/* Aviso explicativo */}
            <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start space-x-3">
              <KeyRound className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-950">
                <p className="font-bold">Alteração de Senha Opcional</p>
                <p className="mt-0.5 text-blue-800">
                  Você pode atualizar sua senha de acesso a qualquer momento caso queira reforçar a segurança do seu usuário no GED Seguro da MVRJCONTÁBIL.
                </p>
              </div>
            </div>

            {/* Mensagens de Sucesso / Erro de Senha */}
            {passwordSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2 animate-in fade-in duration-150">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="font-semibold">{passwordSuccessMsg}</span>
              </div>
            )}

            {passwordErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{passwordErrorMsg}</span>
              </div>
            )}

            {/* Formulário de Alteração de Senha */}
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Senha Atual (Opcional se for a senha padrão)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="Digite sua senha atual"
                    className="w-full pl-9 pr-10 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
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
                      type={showNewPass ? 'text' : 'password'}
                      required
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full pl-9 pr-10 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                      type={showConfirmPass ? 'text' : 'password'}
                      required
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      placeholder="Repita a nova senha"
                      className={`w-full pl-9 pr-10 py-2 text-sm border rounded-xl focus:ring-2 outline-hidden ${
                        confirmPasswordInput && !passwordsMatch
                          ? 'border-rose-300 focus:ring-rose-400'
                          : confirmPasswordInput && passwordsMatch
                            ? 'border-emerald-400 focus:ring-emerald-400'
                            : 'border-slate-300 focus:ring-blue-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Medidor de Força */}
              {newPasswordInput && (
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

              {/* Critérios da nova senha */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Requisitos da Senha:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  <div className={`flex items-center space-x-1.5 ${hasMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${hasMinLength ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <span>Mínimo de 4 caracteres</span>
                  </div>
                  <div className={`flex items-center space-x-1.5 ${passwordsMatch ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${passwordsMatch ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <span>Senhas coincidem exatamente</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  💡 Você pode criar sua senha livremente combinando letras, números e símbolos como preferir.
                </p>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={!isPasswordValid || isChangingPassword}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all flex items-center space-x-2"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{isChangingPassword ? 'Salvando...' : 'Salvar Nova Senha'}</span>
                </button>
              </div>
            </form>

            {/* Conformidade e Termo LGPD */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/80 p-3.5 rounded-2xl border">
              <div>
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-900">Termo de Conformidade LGPD</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                    Lei 13.709/2018
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Status de conformidade e termo legal de sigilo profissional para MVRJCONTÁBIL.
                </p>
              </div>

              {onOpenLgpdModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLgpdModal();
                  }}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-2xs transition-colors shrink-0"
                >
                  <ScrollText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ver Termo LGPD</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
