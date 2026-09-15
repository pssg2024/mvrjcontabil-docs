import React, { useState, useRef } from 'react';
import { 
  FolderLock, 
  ShieldCheck, 
  Building2, 
  Landmark, 
  FileText, 
  Lock, 
  Palette, 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  RotateCcw, 
  Save, 
  Check, 
  Type, 
  Layers, 
  Sliders, 
  ShieldAlert, 
  Trash2, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { UserProfile, AuthHeaderConfig } from '../types';
import { 
  saveAuthHeaderConfig, 
  uploadAuthHeaderImage, 
  uploadCompanyLogo, 
  resetAuthHeaderConfig, 
  DEFAULT_AUTH_HEADER_CONFIG 
} from '../lib/storage-service';

interface AuthHeaderCustomizerProps {
  currentUser: UserProfile;
  currentConfig: AuthHeaderConfig;
  onConfigChange: (newConfig: AuthHeaderConfig) => void;
  onAuditLog?: (details: Record<string, any>) => void;
}

// Gradient Presets
const GRADIENT_PRESETS: Array<{
  id: string;
  name: string;
  classNames: string;
  previewBg: string;
  description: string;
}> = [
  {
    id: 'slate-indigo-blue',
    name: 'Corporativo Padrão MVRJ',
    classNames: 'bg-gradient-to-tr from-slate-900 via-indigo-950 to-blue-900',
    previewBg: 'linear-gradient(to top right, #0f172a, #1e1b4b, #1e3a8a)',
    description: 'Combinação clássica de ardósia nobre com azul profundo.',
  },
  {
    id: 'midnight-navy',
    name: 'Azul Marinho Executivo',
    classNames: 'bg-gradient-to-tr from-blue-950 via-slate-900 to-indigo-950',
    previewBg: 'linear-gradient(to top right, #172554, #0f172a, #1e1b4b)',
    description: 'Tons noturnos sóbrios com máxima autoridade visual.',
  },
  {
    id: 'emerald-dark',
    name: 'Verde Esmeralda Financeiro',
    classNames: 'bg-gradient-to-tr from-emerald-950 via-slate-900 to-teal-950',
    previewBg: 'linear-gradient(to top right, #022c22, #0f172a, #042f2e)',
    description: 'Simboliza solidez contábil, crescimento e prosperidade.',
  },
  {
    id: 'royal-purple',
    name: 'Púrpura Imperial & Diamante',
    classNames: 'bg-gradient-to-tr from-purple-950 via-slate-900 to-indigo-950',
    previewBg: 'linear-gradient(to top right, #3b0764, #0f172a, #1e1b4b)',
    description: 'Aura nobre e inovadora com refinamento de auditoria.',
  },
  {
    id: 'graphite-dark',
    name: 'Grafite Nobre Monocromático',
    classNames: 'bg-gradient-to-tr from-zinc-950 via-neutral-900 to-stone-900',
    previewBg: 'linear-gradient(to top right, #09090b, #171717, #1c1917)',
    description: 'Estilo minimalista e austero de alta tecnologia.',
  },
  {
    id: 'blue-cyan',
    name: 'Azul Oceânico & Tecnologia',
    classNames: 'bg-gradient-to-tr from-blue-900 via-blue-950 to-cyan-950',
    previewBg: 'linear-gradient(to top right, #1e3a8a, #172554, #083344)',
    description: 'Modernidade ágil com destaques em ciano sutil.',
  },
  {
    id: 'amber-gold',
    name: 'Âmbar & Ouro Consultoria',
    classNames: 'bg-gradient-to-tr from-amber-950 via-stone-900 to-neutral-950',
    previewBg: 'linear-gradient(to top right, #451a03, #1c1917, #0a0a0a)',
    description: 'Tons quentes de consultoria executiva premium.',
  },
];

// Header background image presets
const HEADER_IMAGE_PRESETS = [
  {
    id: 'header-architecture',
    name: 'Fachada Corporativa Espelhada',
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'header-accounting',
    name: 'Mesa de Análise & Balanços',
    url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'header-office',
    name: 'Escritório Executivo Clean',
    url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'header-waves',
    name: 'Ondas Abstratas de Auditoria',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80',
  },
];

// Available Icons
const ICON_OPTIONS: Array<{
  id: AuthHeaderConfig['iconName'];
  name: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'FolderLock', name: 'Pasta com Cadeado (Padrão)', icon: FolderLock },
  { id: 'ShieldCheck', name: 'Escudo de Proteção', icon: ShieldCheck },
  { id: 'Building2', name: 'Edifício Corporativo', icon: Building2 },
  { id: 'Landmark', name: 'Instituição Contábil', icon: Landmark },
  { id: 'FileText', name: 'Documento Fiscal Seguro', icon: FileText },
  { id: 'Lock', name: 'Cadeado Criptográfico', icon: Lock },
];

export const AuthHeaderCustomizer: React.FC<AuthHeaderCustomizerProps> = ({
  currentUser,
  currentConfig,
  onConfigChange,
  onAuditLog,
}) => {
  const [activeTab, setActiveTab] = useState<'text-brand' | 'colors-gradient' | 'background-image'>('text-brand');
  const [config, setConfig] = useState<AuthHeaderConfig>(currentConfig || DEFAULT_AUTH_HEADER_CONFIG);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);
  const [uploadHeaderProgress, setUploadHeaderProgress] = useState(0);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [uploadLogoProgress, setUploadLogoProgress] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const headerFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // Helper to get active gradient class
  const getGradientClass = (presetId: string) => {
    const found = GRADIENT_PRESETS.find((p) => p.id === presetId);
    return found ? found.classNames : GRADIENT_PRESETS[0].classNames;
  };

  // Helper to render the active icon
  const renderIcon = (iconName: AuthHeaderConfig['iconName']) => {
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

  // Handle Save
  const handleSave = async () => {
    setIsSaving(true);
    setFeedbackMessage(null);
    try {
      const res = await saveAuthHeaderConfig({
        ...config,
        updatedBy: currentUser.full_name,
      });
      onConfigChange(res.config);
      setFeedbackMessage({
        type: 'success',
        text: 'Cabeçalho de login atualizado com sucesso no Cloudflare R2 e servidor!',
      });
      if (onAuditLog) {
        onAuditLog({
          title: config.title,
          bgType: config.bgType,
          gradientPreset: config.gradientPreset,
          logoType: config.logoType,
          updatedBy: currentUser.full_name,
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Falha ao salvar configurações do cabeçalho.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Reset
  const handleReset = async () => {
    if (!window.confirm('Deseja restaurar o cabeçalho de login para o design padrão corporativo da MVRJCONTÁBIL?')) {
      return;
    }
    setIsSaving(true);
    setFeedbackMessage(null);
    try {
      const res = await resetAuthHeaderConfig(currentUser.full_name);
      setConfig(res.config);
      onConfigChange(res.config);
      setFeedbackMessage({
        type: 'success',
        text: 'Cabeçalho restaurado para o padrão original da MVRJCONTÁBIL!',
      });
      if (onAuditLog) {
        onAuditLog({
          action: 'RESET_TO_DEFAULT',
          updatedBy: currentUser.full_name,
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Falha ao restaurar cabeçalho.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Header Image Upload
  const handleHeaderFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setFeedbackMessage({ type: 'error', text: 'Por favor, selecione um arquivo de imagem válido (JPG, PNG, WEBP, SVG).' });
      return;
    }
    setIsUploadingHeader(true);
    setUploadHeaderProgress(0);
    setFeedbackMessage(null);

    try {
      const res = await uploadAuthHeaderImage(file, currentUser.full_name, (percent) => {
        setUploadHeaderProgress(percent);
      });
      const updated: AuthHeaderConfig = {
        ...config,
        bgType: 'image',
        bgImageUrl: res.imageUrl,
        updatedBy: currentUser.full_name,
      };
      setConfig(updated);
      onConfigChange(updated);
      setFeedbackMessage({
        type: 'success',
        text: 'Imagem do cabeçalho enviada com sucesso para o Cloudflare R2!',
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Falha no upload da imagem do cabeçalho para o R2.',
      });
    } finally {
      setIsUploadingHeader(false);
    }
  };

  // Handle Logo Upload
  const handleLogoFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setFeedbackMessage({ type: 'error', text: 'Por favor, selecione um arquivo de imagem para o logotipo (PNG, SVG, WEBP, JPG).' });
      return;
    }
    setIsUploadingLogo(true);
    setUploadLogoProgress(0);
    setFeedbackMessage(null);

    try {
      const res = await uploadCompanyLogo(file, currentUser.full_name, (percent) => {
        setUploadLogoProgress(percent);
      });
      const updated: AuthHeaderConfig = {
        ...config,
        logoType: 'image',
        logoImageUrl: res.imageUrl,
        updatedBy: currentUser.full_name,
      };
      setConfig(updated);
      onConfigChange(updated);
      setFeedbackMessage({
        type: 'success',
        text: 'Logotipo atualizado e enviado para o Cloudflare R2 com sucesso!',
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Falha no upload do logotipo.',
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-5 shadow-lg border border-blue-800/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 text-[11px] font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-300" />
              <span>Personalização do Cabeçalho de Login</span>
            </div>
            <h3 className="text-lg font-black tracking-tight">
              Cartão de Autenticação & Boas-Vindas da MVRJCONTÁBIL
            </h3>
            <p className="text-xs text-blue-200/90 mt-1 max-w-2xl leading-relaxed">
              Altere o título, subtítulo institucional, logotipo corporativo, cores de gradiente, ou aplique uma imagem de fundo de alta resolução com sobreposição para o cartão de login visualizado por clientes e colaboradores.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleReset}
              disabled={isSaving}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Restaurar padrão corporativo"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restaurar Padrão</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Cabeçalho</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in duration-200 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Main Grid: Left Controls (Tabs) & Right Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: CONTROLS & TABS (7 COLS) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          {/* Tabs Selector */}
          <div className="flex border-b border-gray-200 bg-gray-50/70 p-1.5 gap-1 text-xs font-bold">
            <button
              onClick={() => setActiveTab('text-brand')}
              className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'text-brand'
                  ? 'bg-white text-blue-700 shadow-xs border border-gray-200/80 font-black'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Type className="w-4 h-4 text-blue-600" />
              <span>Textos & Marca</span>
            </button>
            <button
              onClick={() => setActiveTab('colors-gradient')}
              className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'colors-gradient'
                  ? 'bg-white text-blue-700 shadow-xs border border-gray-200/80 font-black'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Palette className="w-4 h-4 text-purple-600" />
              <span>Cores & Gradientes</span>
            </button>
            <button
              onClick={() => setActiveTab('background-image')}
              className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'background-image'
                  ? 'bg-white text-blue-700 shadow-xs border border-gray-200/80 font-black'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              <span>Imagem de Fundo</span>
            </button>
          </div>

          <div className="p-6 space-y-6">
            
            {/* TAB 1: TEXTS & BRANDING */}
            {activeTab === 'text-brand' && (
              <div className="space-y-5">
                {/* Title Input */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Título Principal da Marca
                  </label>
                  <input
                    type="text"
                    value={config.title}
                    onChange={(e) => {
                      const updated = { ...config, title: e.target.value };
                      setConfig(updated);
                      onConfigChange(updated);
                    }}
                    placeholder="Ex: MVRJ CONTÁBIL"
                    maxLength={60}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Nome da empresa exibido no topo do cartão de acesso.
                  </p>
                </div>

                {/* Subtitle Input */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Subtítulo Institucional
                  </label>
                  <input
                    type="text"
                    value={config.subtitle}
                    onChange={(e) => {
                      const updated = { ...config, subtitle: e.target.value };
                      setConfig(updated);
                      onConfigChange(updated);
                    }}
                    placeholder="Ex: Gestão Eletrônica de Documentos Segura"
                    maxLength={120}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Frase descritiva do serviço ou missão da contabilidade.
                  </p>
                </div>

                {/* Badge Text & Toggle */}
                <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-800 flex items-center space-x-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
                      <span>Etiqueta de Segurança / Infraestrutura</span>
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showBadge}
                        onChange={(e) => {
                          const updated = { ...config, showBadge: e.target.checked };
                          setConfig(updated);
                          onConfigChange(updated);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {config.showBadge && (
                    <div>
                      <input
                        type="text"
                        value={config.badgeText}
                        onChange={(e) => {
                          const updated = { ...config, badgeText: e.target.value };
                          setConfig(updated);
                          onConfigChange(updated);
                        }}
                        placeholder="Ex: Supabase RLS & Cloudflare R2"
                        maxLength={50}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">
                        Selo de garantia técnica visualizado por novos clientes e auditores.
                      </p>
                    </div>
                  )}
                </div>

                {/* Logo or Icon Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-800">
                      Símbolo Central da Marca
                    </label>
                    <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          const updated: AuthHeaderConfig = { ...config, logoType: 'icon' };
                          setConfig(updated);
                          onConfigChange(updated);
                        }}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          config.logoType === 'icon' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        Ícone Executivo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated: AuthHeaderConfig = { ...config, logoType: 'image' };
                          setConfig(updated);
                          onConfigChange(updated);
                        }}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          config.logoType === 'image' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        Upload de Logotipo
                      </button>
                    </div>
                  </div>

                  {config.logoType === 'icon' ? (
                    <div className="grid grid-cols-3 gap-2.5">
                      {ICON_OPTIONS.map((opt) => {
                        const IconComponent = opt.icon;
                        const isSelected = config.iconName === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              const updated: AuthHeaderConfig = { ...config, iconName: opt.id };
                              setConfig(updated);
                              onConfigChange(updated);
                            }}
                            className={`p-3 rounded-xl border text-left flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20 font-bold'
                                : 'bg-gray-50/70 border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>
                              <IconComponent className="w-5 h-5" />
                            </div>
                            <span className="text-[11px] text-center leading-tight">
                              {opt.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="border border-dashed border-gray-300 rounded-xl p-4 bg-gray-50 text-center space-y-3">
                      {config.logoImageUrl ? (
                        <div className="space-y-3">
                          <div className="w-20 h-20 mx-auto rounded-xl bg-white border border-gray-200 flex items-center justify-center p-2 shadow-xs">
                            <img
                              src={config.logoImageUrl}
                              alt="Logotipo da Empresa"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <p className="text-xs font-bold text-gray-800">
                            Logotipo ativo no Cloudflare R2
                          </p>
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              type="button"
                              onClick={() => logoFileInputRef.current?.click()}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              Substituir Logotipo
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated: AuthHeaderConfig = { ...config, logoImageUrl: '', logoType: 'icon' };
                                setConfig(updated);
                                onConfigChange(updated);
                              }}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center space-x-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remover</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 mx-auto flex items-center justify-center mb-2">
                            <Upload className="w-6 h-6" />
                          </div>
                          <h4 className="text-xs font-bold text-gray-800">
                            Enviar Logotipo da MVRJCONTÁBIL
                          </h4>
                          <p className="text-[11px] text-gray-500 mt-0.5 mb-3">
                            Formatos recomendados: PNG transparente ou SVG (até 10 MB).
                          </p>
                          <button
                            type="button"
                            onClick={() => logoFileInputRef.current?.click()}
                            disabled={isUploadingLogo}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                          >
                            {isUploadingLogo ? `Enviando (${uploadLogoProgress}%)...` : 'Selecionar Arquivo de Logo'}
                          </button>
                        </div>
                      )}
                      <input
                        ref={logoFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleLogoFileUpload(file);
                        }}
                      />
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB 2: COLORS & GRADIENTS */}
            {activeTab === 'colors-gradient' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">
                      Estilo do Fundo do Cartão
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Escolha entre gradientes ultra-nítidos ou textura fotográfica com imagem.
                    </p>
                  </div>
                  <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        const updated: AuthHeaderConfig = { ...config, bgType: 'gradient' };
                        setConfig(updated);
                        onConfigChange(updated);
                      }}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        config.bgType === 'gradient' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Gradiente
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated: AuthHeaderConfig = { ...config, bgType: 'image' };
                        setConfig(updated);
                        onConfigChange(updated);
                      }}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        config.bgType === 'image' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Imagem / Foto
                    </button>
                  </div>
                </div>

                {config.bgType === 'gradient' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {GRADIENT_PRESETS.map((preset) => {
                      const isSelected = config.gradientPreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            const updated: AuthHeaderConfig = {
                              ...config,
                              bgType: 'gradient',
                              gradientPreset: preset.id,
                            };
                            setConfig(updated);
                            onConfigChange(updated);
                          }}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                            isSelected
                              ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/40'
                              : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center space-x-3 mb-2">
                            <div
                              className="w-10 h-10 rounded-lg shadow-inner border border-white/20 shrink-0"
                              style={{ background: preset.previewBg }}
                            />
                            <div>
                              <div className="text-xs font-bold text-gray-900 leading-tight">
                                {preset.name}
                              </div>
                              <div className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">
                                {preset.description}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                              <Check className="w-3 h-3 stroke-3" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {config.bgType === 'image' && (
                  <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex items-start space-x-2">
                    <ImageIcon className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">Modo de Imagem Ativo:</strong> Você pode ajustar a imagem de fundo na aba <em>"Imagem de Fundo"</em> ao lado, incluindo opacidade, desfoque e overlays de contraste.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: BACKGROUND IMAGE & FINE-TUNING */}
            {activeTab === 'background-image' && (
              <div className="space-y-5">
                {/* Upload or Preset Choice */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-800">
                      Imagem de Fundo para o Cabeçalho
                    </label>
                    <button
                      type="button"
                      onClick={() => headerFileInputRef.current?.click()}
                      disabled={isUploadingHeader}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1 shadow-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingHeader ? `Enviando (${uploadHeaderProgress}%)...` : 'Upload Imagem (R2)'}</span>
                    </button>
                    <input
                      ref={headerFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleHeaderFileUpload(file);
                      }}
                    />
                  </div>

                  {/* Preset Quick Picks */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {HEADER_IMAGE_PRESETS.map((p) => {
                      const isSelected = config.bgImageUrl === p.url;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            const updated: AuthHeaderConfig = {
                              ...config,
                              bgType: 'image',
                              bgImageUrl: p.url,
                            };
                            setConfig(updated);
                            onConfigChange(updated);
                          }}
                          className={`group relative rounded-xl overflow-hidden border text-left aspect-4/3 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-blue-600 ring-2 ring-blue-500/30'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <img
                            src={p.thumb}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-1.5 flex flex-col justify-end">
                            <span className="text-[10px] font-bold text-white line-clamp-1">
                              {p.name}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 stroke-3" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* External Image URL Input */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Ou insira a URL direta da imagem:
                  </label>
                  <input
                    type="url"
                    value={config.bgImageUrl || ''}
                    onChange={(e) => {
                      const updated: AuthHeaderConfig = {
                        ...config,
                        bgType: 'image',
                        bgImageUrl: e.target.value,
                      };
                      setConfig(updated);
                      onConfigChange(updated);
                    }}
                    placeholder="https://exemplo.com/minha-imagem.jpg"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* QUICK ADJUSTMENT PRESETS - "AJUSTADINHA" */}
                <div className="bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-blue-950 flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span>Ajuste Rápido de Enquadramento ("Ajustadinha")</span>
                    </span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    Se sua imagem já contiver o logotipo e nome da empresa (como o brasão da MVRJ), clique abaixo para enquadrar a imagem inteira sem cortes e remover ícones ou textos repetidos que cobrem a arte:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const updated: AuthHeaderConfig = {
                          ...config,
                          bgType: 'image',
                          bgSize: 'contain',
                          bgPosition: 'center',
                          headerHeight: 'tall',
                          bgColor: '#091830',
                          showIcon: false,
                          showTitle: false,
                          showSubtitle: false,
                          showBadge: false,
                          bgOpacity: 100,
                          bgBlur: 0,
                          bgOverlayType: 'none',
                          bgOverlayOpacity: 0,
                        };
                        setConfig(updated);
                        onConfigChange(updated);
                        setFeedbackMessage({
                          type: 'success',
                          text: 'Enquadramento perfeito aplicado! A imagem agora está inteira, sem cortes e sem textos repetidos.',
                        });
                      }}
                      className="px-3 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                      <span>✨ Enquadrar Emblema Inteiro (Sem Cortes)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated: AuthHeaderConfig = {
                          ...config,
                          bgType: 'image',
                          bgSize: 'cover',
                          bgPosition: 'center',
                          headerHeight: 'normal',
                          showIcon: true,
                          showTitle: true,
                          showSubtitle: true,
                          showBadge: true,
                          bgOverlayType: 'dark',
                          bgOverlayOpacity: 40,
                        };
                        setConfig(updated);
                        onConfigChange(updated);
                        setFeedbackMessage({
                          type: 'success',
                          text: 'Modo padrão restaurado: com textos e ícone centralizado sobre a imagem.',
                        });
                      }}
                      className="px-3 py-2.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <span>🔄 Modo Padrão com Ícone e Textos</span>
                    </button>
                  </div>
                </div>

                {/* Sizing and Layout Options */}
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  {/* Image Sizing (bgSize) */}
                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1.5">
                      Modo de Enquadramento da Imagem
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const updated: AuthHeaderConfig = { ...config, bgSize: 'contain' };
                          setConfig(updated);
                          onConfigChange(updated);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          (config.bgSize || 'contain') === 'contain'
                            ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-gray-900">Ajustar Inteira (Contain)</span>
                          {(config.bgSize || 'contain') === 'contain' && (
                            <Check className="w-3.5 h-3.5 text-blue-600 stroke-3" />
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Exibe a imagem 100% visível, sem cortar o topo nem a base da arte.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const updated: AuthHeaderConfig = { ...config, bgSize: 'cover' };
                          setConfig(updated);
                          onConfigChange(updated);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          config.bgSize === 'cover'
                            ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-gray-900">Preencher Tudo (Cover)</span>
                          {config.bgSize === 'cover' && (
                            <Check className="w-3.5 h-3.5 text-blue-600 stroke-3" />
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Preenche o cartão de ponta a ponta (ideal para texturas e fotos).
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Header Height */}
                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1.5">
                      Altura do Cabeçalho
                    </label>
                    <div className="grid grid-cols-4 gap-1.5 text-xs">
                      {[
                        { id: 'compact', name: 'Compacto', desc: '140px' },
                        { id: 'normal', name: 'Médio', desc: '180px' },
                        { id: 'tall', name: 'Destaque', desc: '210px' },
                        { id: 'banner', name: 'Amplo', desc: '240px' },
                      ].map((h) => {
                        const isSelected = (config.headerHeight || 'normal') === h.id;
                        return (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => {
                              const updated: AuthHeaderConfig = { ...config, headerHeight: h.id as any };
                              setConfig(updated);
                              onConfigChange(updated);
                            }}
                            className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50 text-blue-900 font-black'
                                : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700 font-medium'
                            }`}
                          >
                            <div>{h.name}</div>
                            <div className="text-[10px] text-gray-400 font-normal">{h.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Overlay Elements Visibility Toggles */}
                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1.5">
                      Camadas e Elementos Sobrepostos no Cabeçalho
                    </label>
                    <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.showIcon ?? true}
                          onChange={(e) => {
                            const updated: AuthHeaderConfig = { ...config, showIcon: e.target.checked };
                            setConfig(updated);
                            onConfigChange(updated);
                          }}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                        />
                        <span className="font-semibold text-gray-800">
                          Exibir Caixa do Ícone / Logotipo central
                        </span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.showTitle ?? true}
                          onChange={(e) => {
                            const updated: AuthHeaderConfig = { ...config, showTitle: e.target.checked };
                            setConfig(updated);
                            onConfigChange(updated);
                          }}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                        />
                        <span className="font-semibold text-gray-800">
                          Exibir Título em texto sobreposto ({config.title || 'MVRJ CONTÁBIL'})
                        </span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.showSubtitle ?? true}
                          onChange={(e) => {
                            const updated: AuthHeaderConfig = { ...config, showSubtitle: e.target.checked };
                            setConfig(updated);
                            onConfigChange(updated);
                          }}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                        />
                        <span className="font-semibold text-gray-800">
                          Exibir Subtítulo institucional
                        </span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.showBadge ?? true}
                          onChange={(e) => {
                            const updated: AuthHeaderConfig = { ...config, showBadge: e.target.checked };
                            setConfig(updated);
                            onConfigChange(updated);
                          }}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                        />
                        <span className="font-semibold text-gray-800">
                          Exibir Selo de Segurança ({config.badgeText || 'Supabase & R2'})
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Background Fill Color (for contain mode) */}
                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1.5">
                      Cor de Fundo da Moldura (Mesclagem com a Imagem)
                    </label>
                    <div className="flex items-center space-x-2">
                      {[
                        { color: '#091830', name: 'Azul Corporativo MVRJ' },
                        { color: '#0a192f', name: 'Azul Marinho Noturno' },
                        { color: '#020617', name: 'Ardósia Escura' },
                        { color: '#09090b', name: 'Preto Grafite' },
                        { color: '#1e1b4b', name: 'Índigo Profundo' },
                        { color: '#042f2e', name: 'Verde Petróleo' },
                      ].map((c) => (
                        <button
                          key={c.color}
                          type="button"
                          onClick={() => {
                            const updated: AuthHeaderConfig = { ...config, bgColor: c.color };
                            setConfig(updated);
                            onConfigChange(updated);
                          }}
                          title={c.name}
                          className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer shrink-0 ${
                            (config.bgColor || '#091830') === c.color
                              ? 'scale-125 border-blue-500 ring-2 ring-blue-500/30'
                              : 'border-white hover:scale-110 shadow-xs'
                          }`}
                          style={{ backgroundColor: c.color }}
                        />
                      ))}
                      <input
                        type="text"
                        value={config.bgColor || '#091830'}
                        onChange={(e) => {
                          const updated: AuthHeaderConfig = { ...config, bgColor: e.target.value };
                          setConfig(updated);
                          onConfigChange(updated);
                        }}
                        className="w-24 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-mono"
                        placeholder="#091830"
                      />
                    </div>
                  </div>

                  {/* Opacity Slider */}
                  <div>
                    <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                      <span>Opacidade da Imagem</span>
                      <span className="text-blue-600">{config.bgOpacity}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={config.bgOpacity}
                      onChange={(e) => {
                        const updated: AuthHeaderConfig = { ...config, bgOpacity: Number(e.target.value) };
                        setConfig(updated);
                        onConfigChange(updated);
                      }}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  {/* Blur Slider */}
                  <div>
                    <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                      <span>Desfoque / Blur Artístico</span>
                      <span className="text-blue-600">{config.bgBlur}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="1"
                      value={config.bgBlur}
                      onChange={(e) => {
                        const updated: AuthHeaderConfig = { ...config, bgBlur: Number(e.target.value) };
                        setConfig(updated);
                        onConfigChange(updated);
                      }}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  {/* Contrast Overlay Type & Opacity */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Sobreposição (Overlay)
                      </label>
                      <select
                        value={config.bgOverlayType}
                        onChange={(e) => {
                          const updated: AuthHeaderConfig = {
                            ...config,
                            bgOverlayType: e.target.value as any,
                          };
                          setConfig(updated);
                          onConfigChange(updated);
                        }}
                        className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-900"
                      >
                        <option value="dark">Escura (Recomendado)</option>
                        <option value="light">Clara</option>
                        <option value="none">Nenhuma</option>
                      </select>
                    </div>

                    {config.bgOverlayType !== 'none' && (
                      <div>
                        <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                          <span>Opacidade Overlay</span>
                          <span className="text-blue-600">{config.bgOverlayOpacity}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="90"
                          step="5"
                          value={config.bgOverlayOpacity}
                          onChange={(e) => {
                            const updated: AuthHeaderConfig = {
                              ...config,
                              bgOverlayOpacity: Number(e.target.value),
                            };
                            setConfig(updated);
                            onConfigChange(updated);
                          }}
                          className="w-full accent-blue-600 cursor-pointer mt-1"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* RIGHT COLUMN: REALISTIC LIVE PREVIEW OF THE LOGIN CARD HEADER (5 COLS) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-100 rounded-2xl border border-gray-200 p-5 shadow-inner">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-gray-600 flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                <span>Prévia ao Vivo do Cartão</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                100% Fiel à Tela de Acesso
              </span>
            </div>

            {/* SIMULATED LOGIN MODAL CARD CONTAINER */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden mx-auto max-w-sm">
              
              {/* THE EXACT HEADER COMPONENT BEING CUSTOMIZED */}
              <div 
                className={`px-6 text-white text-center relative overflow-hidden transition-all duration-300 flex flex-col justify-center items-center ${
                  config.bgType === 'gradient' ? getGradientClass(config.gradientPreset) : ''
                } ${
                  config.headerHeight === 'compact'
                    ? 'min-h-[140px] py-4'
                    : config.headerHeight === 'tall'
                    ? 'min-h-[210px] py-6'
                    : config.headerHeight === 'banner'
                    ? 'min-h-[240px] py-6'
                    : (config.bgType === 'image' && !config.showIcon && !config.showTitle && !config.showSubtitle && !config.showBadge)
                    ? 'h-52 py-4'
                    : 'min-h-[180px] py-6'
                }`}
                style={
                  config.bgType === 'image'
                    ? { backgroundColor: config.bgColor || '#091830' }
                    : undefined
                }
              >
                {/* Background Image Layer if bgType === 'image' */}
                {config.bgType === 'image' && config.bgImageUrl && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 pointer-events-none transition-all duration-300"
                    style={{
                      backgroundImage: `url(${config.bgImageUrl})`,
                      backgroundSize: config.bgSize || 'contain',
                      backgroundPosition: config.bgPosition || 'center',
                      backgroundRepeat: 'no-repeat',
                      opacity: config.bgOpacity / 100,
                      filter: config.bgBlur > 0 ? `blur(${config.bgBlur}px)` : 'none',
                      transform: (config.bgBlur > 0 && config.bgSize !== 'contain') ? 'scale(1.08)' : 'none',
                    }}
                  />
                )}

                {/* Overlay Layer for legibility */}
                {config.bgType === 'image' && config.bgImageUrl && config.bgOverlayType !== 'none' && (
                  <div
                    aria-hidden="true"
                    className={`absolute inset-0 pointer-events-none ${
                      config.bgOverlayType === 'dark' ? 'bg-slate-950' : 'bg-white'
                    }`}
                    style={{
                      opacity: config.bgOverlayOpacity / 100,
                    }}
                  />
                )}

                {/* Foreground Content */}
                {((config.showIcon ?? true) || 
                  (config.showTitle ?? true) || 
                  (config.showSubtitle ?? true) || 
                  (config.showBadge ?? true)) && (
                  <div className="relative z-10 w-full flex flex-col items-center">
                    {/* Central Logo or Icon Container */}
                    {(config.showIcon ?? true) && (
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 mb-3 shadow-inner overflow-hidden">
                        {config.logoType === 'image' && config.logoImageUrl ? (
                          <img
                            src={config.logoImageUrl}
                            alt="Logo"
                            className="max-h-10 max-w-10 object-contain"
                          />
                        ) : (
                          renderIcon(config.iconName)
                        )}
                      </div>
                    )}

                    {/* Title */}
                    {(config.showTitle ?? true) && (
                      <h2 className="text-xl font-black tracking-tight text-white drop-shadow-xs">
                        {config.title || 'MVRJ CONTÁBIL'}
                      </h2>
                    )}

                    {/* Subtitle */}
                    {(config.showSubtitle ?? true) && (
                      <p className="text-xs text-blue-200/90 mt-0.5 drop-shadow-xs">
                        {config.subtitle || 'Gestão Eletrônica de Documentos Segura'}
                      </p>
                    )}

                    {/* Badge */}
                    {(config.showBadge ?? true) && (
                      <div className="inline-flex items-center space-x-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-[11px] font-medium text-blue-200 border border-blue-400/30 backdrop-blur-xs">
                        <ShieldAlert className="w-3 h-3 text-blue-300 shrink-0" />
                        <span>{config.badgeText || 'Supabase RLS & Cloudflare R2'}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* FAKE MODAL BODY FOR CONTEXT */}
              <div className="p-4 bg-gray-50/80 border-t border-gray-100 text-center">
                <div className="flex border-b border-gray-200 pb-2 mb-3 text-xs font-semibold text-gray-500">
                  <div className="flex-1 text-blue-600 font-bold border-b-2 border-blue-600 pb-1">
                    Acessar Sistema
                  </div>
                  <div className="flex-1 pb-1">Solicitar Acesso</div>
                </div>
                <div className="h-8 bg-gray-200/70 rounded-lg mb-2"></div>
                <div className="h-8 bg-gray-200/70 rounded-lg mb-3"></div>
                <div className="h-9 bg-blue-600/40 rounded-lg"></div>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 text-center mt-3">
              Todas as modificações são salvas diretamente no servidor e replicadas para todos os computadores da MVRJCONTÁBIL.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
