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
  AlertCircle,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  ArrowRight,
  Mail
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

// Gradient Presets Corporativos Oficiais
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
    description: 'Ardósia nobre com azul marinho profundo e prestígio contábil.',
  },
  {
    id: 'midnight-navy',
    name: 'Azul Marinho Executivo',
    classNames: 'bg-gradient-to-tr from-blue-950 via-slate-900 to-indigo-950',
    previewBg: 'linear-gradient(to top right, #172554, #0f172a, #1e1b4b)',
    description: 'Tons noturnos sóbrios com máxima autoridade institucional.',
  },
  {
    id: 'emerald-dark',
    name: 'Verde Esmeralda Financeiro',
    classNames: 'bg-gradient-to-tr from-emerald-950 via-slate-900 to-teal-950',
    previewBg: 'linear-gradient(to top right, #022c22, #0f172a, #042f2e)',
    description: 'Simboliza solidez fiscal, estabilidade patrimonial e crescimento.',
  },
  {
    id: 'royal-purple',
    name: 'Púrpura Imperial & Diamante',
    classNames: 'bg-gradient-to-tr from-purple-950 via-slate-900 to-indigo-950',
    previewBg: 'linear-gradient(to top right, #3b0764, #0f172a, #1e1b4b)',
    description: 'Refinamento contemporâneo de governança e auditoria corporativa.',
  },
  {
    id: 'graphite-dark',
    name: 'Grafite Nobre Monocromático',
    classNames: 'bg-gradient-to-tr from-zinc-950 via-neutral-900 to-stone-900',
    previewBg: 'linear-gradient(to top right, #09090b, #171717, #1c1917)',
    description: 'Design minimalista, austero e focado em alta tecnologia.',
  },
  {
    id: 'blue-cyan',
    name: 'Azul Oceânico & Tecnologia',
    classNames: 'bg-gradient-to-tr from-blue-900 via-blue-950 to-cyan-950',
    previewBg: 'linear-gradient(to top right, #1e3a8a, #172554, #083344)',
    description: 'Modernidade ágil com destaques em ciano sutil e tecnológico.',
  },
  {
    id: 'amber-gold',
    name: 'Âmbar & Ouro Consultoria',
    classNames: 'bg-gradient-to-tr from-amber-950 via-stone-900 to-neutral-950',
    previewBg: 'linear-gradient(to top right, #451a03, #1c1917, #0a0a0a)',
    description: 'Tons quentes de consultoria executiva premium e alta precisão.',
  },
];

// Header background image presets
const HEADER_IMAGE_PRESETS = [
  {
    id: 'header-accounting-office-gif',
    name: 'Escritório Contábil Animado',
    url: '/images/accounting_office.gif',
    thumb: '/images/accounting_office.gif',
  },
  {
    id: 'header-accounting-office-static',
    name: 'Escritório Contábil Estático',
    url: '/images/accounting_office.jpg',
    thumb: '/images/accounting_office.jpg',
  },
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
  const [activeTab, setActiveTab] = useState<'text-brand' | 'colors-gradient' | 'background-image' | 'layers-display'>('text-brand');
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
        return <ShieldCheck className="w-7 h-7 text-[#1B357B]" />;
      case 'Building2':
        return <Building2 className="w-7 h-7 text-[#1B357B]" />;
      case 'Landmark':
        return <Landmark className="w-7 h-7 text-[#1B357B]" />;
      case 'FileText':
        return <FileText className="w-7 h-7 text-[#1B357B]" />;
      case 'Lock':
        return <Lock className="w-7 h-7 text-[#1B357B]" />;
      case 'FolderLock':
      default:
        return <FolderLock className="w-7 h-7 text-[#1B357B]" />;
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
        text: 'Configurações de identidade visual salvas e sincronizadas com sucesso!',
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
      const updated: AuthHeaderConfig = res.config || {
        ...config,
        bgType: 'image',
        bgImageUrl: res.imageUrl,
        updatedBy: currentUser.full_name,
      };
      setConfig(updated);
      onConfigChange(updated);
      setFeedbackMessage({
        type: 'success',
        text: 'Imagem do cabeçalho enviada ao Cloudflare R2 com sucesso!',
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
      const updated: AuthHeaderConfig = res.config || {
        ...config,
        logoType: 'image',
        logoImageUrl: res.imageUrl,
        updatedBy: currentUser.full_name,
      };
      setConfig(updated);
      onConfigChange(updated);
      setFeedbackMessage({
        type: 'success',
        text: 'Logotipo atualizado e salvo permanentemente com sucesso!',
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
      {/* Top Corporate Action Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-[#101F42] to-[#1B357B] text-white rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-white/10 text-[#DFB76C] border border-white/15 flex items-center justify-center shrink-0 shadow-inner">
            <Sparkles className="w-6 h-6 text-[#DFB76C]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-tight truncate">
                Identidade Visual & Login
              </h3>
              <span className="bg-[#C59B4B]/25 text-[#E5C378] border border-[#C59B4B]/40 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0">
                Oficial MVRJ
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium truncate mt-0.5">
              Personalize títulos, logotipo oficial, cores, gradientes e imagem de fundo da tela de acesso.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 w-full md:w-auto justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/10">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-slate-200 hover:text-white border border-white/15 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Restaurar padrão corporativo"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Padrão</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 bg-gradient-to-r from-[#DFB76C] to-[#C59B4B] hover:brightness-110 active:scale-98 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                <span>Publicando...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 stroke-3" />
                <span>Publicar Alterações</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center space-x-2.5 shadow-xs animate-in fade-in duration-200 border ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Main Grid: Left Controls (Tabs) & Right Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: ORGANIZED CONTROLS (7 COLS) */}
        <div className="lg:col-span-7 space-y-4">

          {/* Segmented Tab Bar */}
          <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 flex flex-wrap gap-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('text-brand')}
              className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'text-brand'
                  ? 'bg-white text-[#1B357B] shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Type className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Textos & Marca</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('colors-gradient')}
              className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'colors-gradient'
                  ? 'bg-white text-[#1B357B] shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Palette className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span>Cores & Gradientes</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('background-image')}
              className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'background-image'
                  ? 'bg-white text-[#1B357B] shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Imagem de Fundo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('layers-display')}
              className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'layers-display'
                  ? 'bg-white text-[#1B357B] shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Camadas & Exibição</span>
            </button>
          </div>

          {/* TAB 1: TEXTS & BRANDING */}
          {activeTab === 'text-brand' && (
            <div className="space-y-4">
              {/* Card 1: Informações Institucionais */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Textos Institucionais do Cabeçalho</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Identificação oficial exibida no topo do cartão de acesso dos usuários.
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>Título Principal da Marca</span>
                      <span className="text-[10px] text-slate-400 font-normal">Máx 60 caracteres</span>
                    </label>
                    <div className="relative">
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
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white focus:border-[#1B357B] focus:ring-3 focus:ring-blue-100 text-xs font-bold text-slate-900 shadow-2xs transition-all outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>Subtítulo Institucional</span>
                      <span className="text-[10px] text-slate-400 font-normal">Máx 120 caracteres</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={config.subtitle}
                        onChange={(e) => {
                          const updated = { ...config, subtitle: e.target.value };
                          setConfig(updated);
                          onConfigChange(updated);
                        }}
                        placeholder="Ex: Gestão Eletrônica Contábil"
                        maxLength={120}
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white focus:border-[#1B357B] focus:ring-3 focus:ring-blue-100 text-xs font-medium text-slate-800 shadow-2xs transition-all outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Selo Técnico & Conformidade */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 leading-tight">
                        Selo de Segurança & Infraestrutura
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Exibe uma etiqueta elegante comprovando proteção de dados e auditoria.
                      </p>
                    </div>
                  </div>

                  {/* Switch Moderno */}
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
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
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B357B]"></div>
                  </label>
                </div>

                {config.showBadge && (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                        Texto da Etiqueta
                      </label>
                      <input
                        type="text"
                        value={config.badgeText}
                        onChange={(e) => {
                          const updated = { ...config, badgeText: e.target.value };
                          setConfig(updated);
                          onConfigChange(updated);
                        }}
                        placeholder="Ex: Ambiente Seguro & Homologado"
                        maxLength={50}
                        className="w-full h-10 px-3.5 rounded-xl border border-slate-300 bg-white focus:border-[#1B357B] focus:ring-3 focus:ring-blue-100 text-xs font-semibold text-slate-900 shadow-2xs transition-all outline-hidden"
                      />
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block mb-1.5">
                        Sugestões rápidas de conformidade:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          'Ambiente Seguro & Homologado',
                          'Criptografia SSL de Ponta a Ponta',
                          'Conformidade LGPD 13.709',
                          'GED Seguro • MVRJCONTÁBIL',
                          'Auditoria Fiscal em Tempo Real'
                        ].map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => {
                              const updated = { ...config, badgeText: suggestion };
                              setConfig(updated);
                              onConfigChange(updated);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                              config.badgeText === suggestion
                                ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold'
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                            }`}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 3: Símbolo Central da Marca */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-blue-600" />
                      <span>Símbolo Central da Marca</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Ícone vetorial corporativo ou logotipo com imagem própria.
                    </p>
                  </div>

                  <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const updated: AuthHeaderConfig = { ...config, logoType: 'icon' };
                        setConfig(updated);
                        onConfigChange(updated);
                      }}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        config.logoType === 'icon' 
                          ? 'bg-white text-[#1B357B] shadow-xs font-black' 
                          : 'text-slate-600 hover:text-slate-900'
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
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        config.logoType === 'image' 
                          ? 'bg-white text-[#1B357B] shadow-xs font-black' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Upload de Logotipo
                    </button>
                  </div>
                </div>

                {config.logoType === 'icon' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
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
                          className={`p-3.5 rounded-2xl border text-left flex flex-col items-center justify-center gap-2.5 transition-all cursor-pointer relative ${
                            isSelected
                              ? 'bg-blue-50/80 border-[#1B357B] ring-2 ring-blue-500/20 text-[#1B357B] shadow-xs font-bold'
                              : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isSelected ? 'bg-[#1B357B] text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200'}`}>
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <span className="text-[11px] text-center leading-tight">
                            {opt.name}
                          </span>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#C59B4B] text-slate-950 flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 stroke-3" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-300 rounded-2xl p-5 bg-slate-50/70 text-center space-y-4">
                    {config.logoImageUrl ? (
                      <div className="space-y-3">
                        <div className="w-24 h-24 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-3 shadow-sm overflow-hidden">
                          <img
                            src={config.logoImageUrl}
                            alt="Logotipo da Empresa"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            Logotipo Ativo no Cloudflare R2
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Visível no cabeçalho de login oficial.
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => logoFileInputRef.current?.click()}
                            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                          >
                            <Upload className="w-3.5 h-3.5 text-blue-600" />
                            <span>Substituir</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updated: AuthHeaderConfig = { ...config, logoImageUrl: '', logoType: 'icon' };
                              setConfig(updated);
                              onConfigChange(updated);
                            }}
                            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remover</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-2">
                        <div className="w-14 h-14 rounded-2xl bg-blue-100/70 text-[#1B357B] mx-auto flex items-center justify-center mb-3 shadow-inner">
                          <Upload className="w-7 h-7" />
                        </div>
                        <h5 className="text-xs font-bold text-slate-900">
                          Enviar Logotipo Oficial da MVRJCONTÁBIL
                        </h5>
                        <p className="text-[11px] text-slate-500 mt-1 mb-4 max-w-sm mx-auto">
                          Formatos aceitos: PNG transparente, SVG, WEBP ou JPG (até 10 MB).
                        </p>
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          disabled={isUploadingLogo}
                          className="px-5 py-2.5 bg-[#1B357B] hover:bg-[#142654] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md inline-flex items-center gap-2"
                        >
                          <Upload className="w-4 h-4 text-[#DFB76C]" />
                          <span>{isUploadingLogo ? `Enviando (${uploadLogoProgress}%)...` : 'Selecionar Arquivo de Logo'}</span>
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
              {/* Card 1: Tipo de Fundo */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-purple-600" />
                      <span>Estilo do Fundo do Cartão</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Escolha entre gradientes ultra-nítidos ou textura fotográfica com imagem.
                    </p>
                  </div>

                  <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const updated: AuthHeaderConfig = { ...config, bgType: 'gradient' };
                        setConfig(updated);
                        onConfigChange(updated);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                        config.bgType === 'gradient' 
                          ? 'bg-white text-[#1B357B] shadow-xs font-black' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Gradiente Corporativo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated: AuthHeaderConfig = { ...config, bgType: 'image' };
                        setConfig(updated);
                        onConfigChange(updated);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                        config.bgType === 'image' 
                          ? 'bg-white text-[#1B357B] shadow-xs font-black' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Imagem / Foto
                    </button>
                  </div>
                </div>

                {config.bgType === 'gradient' ? (
                  <div className="space-y-3">
                    <span className="text-[11px] font-bold text-slate-500 block">
                      Paletas de Cores Corporativas Oficiais:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                              isSelected
                                ? 'border-[#1B357B] ring-2 ring-blue-500/20 bg-blue-50/40 shadow-xs'
                                : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center space-x-3 mb-2">
                              <div
                                className="w-11 h-11 rounded-xl shadow-inner border border-white/20 shrink-0"
                                style={{ background: preset.previewBg }}
                              />
                              <div className="min-w-0 pr-5">
                                <div className="text-xs font-bold text-slate-900 leading-tight truncate">
                                  {preset.name}
                                </div>
                                <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                                  {preset.description}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#1B357B] text-white flex items-center justify-center shadow-xs">
                                <Check className="w-3 h-3 stroke-3" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50/80 border border-blue-200/90 rounded-2xl p-4 text-xs text-blue-950 flex items-start space-x-3">
                    <ImageIcon className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">Modo de Imagem Ativo:</strong>
                      <p className="mt-0.5 text-blue-900/90 leading-relaxed">
                        Você pode escolher uma foto corporativa, enviar imagens próprias para o Cloudflare R2 e ajustar opacidade, desfoque e enquadramento na aba <strong>"Imagem de Fundo"</strong>.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('background-image')}
                        className="mt-2.5 px-3 py-1.5 bg-[#1B357B] text-white rounded-lg text-[11px] font-bold shadow-xs hover:bg-[#142654] transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>Ir para Ajustes de Imagem</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: BACKGROUND IMAGE & FINE-TUNING */}
          {activeTab === 'background-image' && (
            <div className="space-y-4">
              {/* Card 1: Seleção de Imagem */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Imagem de Fundo do Cabeçalho</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Selecione imagens corporativas oficiais ou faça upload direto.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => headerFileInputRef.current?.click()}
                    disabled={isUploadingHeader}
                    className="px-3.5 py-2 bg-[#1B357B] hover:bg-[#142654] text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#DFB76C]" />
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
                <div>
                  <span className="text-[11px] font-bold text-slate-500 block mb-2">
                    Fotografias e Texturas Pré-configuradas:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
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
                          className={`group relative rounded-2xl overflow-hidden border text-left aspect-4/3 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#1B357B] ring-2 ring-blue-500/30 shadow-md'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <img
                            src={p.thumb}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent p-2 flex flex-col justify-end">
                            <span className="text-[10px] font-bold text-white line-clamp-1">
                              {p.name}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#1B357B] text-white flex items-center justify-center shadow-xs">
                              <Check className="w-3 h-3 stroke-3" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* External Image URL Input */}
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                    Ou informe a URL direta de uma imagem externa:
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
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 bg-white focus:border-[#1B357B] focus:ring-3 focus:ring-blue-100 text-xs text-slate-800 shadow-2xs transition-all outline-hidden"
                  />
                </div>
              </div>

              {/* Card 2: Enquadramento & Dimensões */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                  <span>Enquadramento & Proporções</span>
                </h4>

                {/* Modo de Enquadramento */}
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-2 block">
                    Modo de Ajuste da Imagem
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        const updated: AuthHeaderConfig = { ...config, bgSize: 'contain' };
                        setConfig(updated);
                        onConfigChange(updated);
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        (config.bgSize || 'contain') === 'contain'
                          ? 'border-[#1B357B] bg-blue-50/50 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900">Ajustar Inteira (Contain)</span>
                        {(config.bgSize || 'contain') === 'contain' && (
                          <Check className="w-4 h-4 text-[#1B357B] stroke-3" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">
                        Exibe 100% da arte sem nenhum corte no topo ou rodapé.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const updated: AuthHeaderConfig = { ...config, bgSize: 'cover' };
                        setConfig(updated);
                        onConfigChange(updated);
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        config.bgSize === 'cover'
                          ? 'border-[#1B357B] bg-blue-50/50 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900">Preencher Tudo (Cover)</span>
                        {config.bgSize === 'cover' && (
                          <Check className="w-4 h-4 text-[#1B357B] stroke-3" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">
                        Preenche a moldura inteira de borda a borda.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Altura do Cabeçalho */}
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-2 block">
                    Altura do Cabeçalho
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
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
                          className={`py-2.5 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#1B357B] bg-blue-50 text-[#1B357B] font-black ring-2 ring-blue-500/20'
                              : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 font-semibold'
                          }`}
                        >
                          <div>{h.name}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{h.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cor de Fundo da Moldura */}
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-2 block">
                    Cor da Moldura de Mesclagem
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
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
                        className={`w-8 h-8 rounded-full border-2 transition-transform cursor-pointer shrink-0 ${
                          (config.bgColor || '#091830') === c.color
                            ? 'scale-120 border-blue-500 ring-2 ring-blue-500/30'
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
                      className="w-24 h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                      placeholder="#091830"
                    />
                  </div>
                </div>
              </div>

              {/* Card 3: Efeitos & Tratamento de Imagem */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3">
                  <Sliders className="w-3.5 h-3.5 text-purple-600" />
                  <span>Tratamento Visual da Imagem</span>
                </h4>

                <div className="space-y-4">
                  {/* Opacidade Slider */}
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                      <span>Opacidade da Imagem</span>
                      <span className="text-[#1B357B] bg-blue-50 px-2 py-0.5 rounded-md font-mono">{config.bgOpacity}%</span>
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
                      className="w-full accent-[#1B357B] cursor-pointer"
                    />
                  </div>

                  {/* Blur Slider */}
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                      <span>Desfoque / Blur Artístico</span>
                      <span className="text-[#1B357B] bg-blue-50 px-2 py-0.5 rounded-md font-mono">{config.bgBlur}px</span>
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
                      className="w-full accent-[#1B357B] cursor-pointer"
                    />
                  </div>

                  {/* Contrast Overlay Type & Opacity */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                        Filtro de Sobreposição
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
                        className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                      >
                        <option value="dark">Escura (Recomendada)</option>
                        <option value="light">Clara</option>
                        <option value="none">Nenhuma</option>
                      </select>
                    </div>

                    {config.bgOverlayType !== 'none' && (
                      <div>
                        <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                          <span>Opacidade do Filtro</span>
                          <span className="text-[#1B357B] bg-blue-50 px-2 py-0.5 rounded-md font-mono">{config.bgOverlayOpacity}%</span>
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
                          className="w-full accent-[#1B357B] cursor-pointer mt-2"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LAYERS & VISIBILITY */}
          {activeTab === 'layers-display' && (
            <div className="space-y-4">
              {/* Presets Rápidos de 1 Clique */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/90 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Configurações Rápidas de Camadas</span>
                  </span>
                  <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                    1 Clique
                  </span>
                </div>
                <p className="text-[11px] text-blue-900/90 leading-relaxed">
                  Se a imagem selecionada já tiver o emblema e o nome da MVRJ gravados, clique no modo limpo para ocultar textos repetidos:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const updated: AuthHeaderConfig = {
                        ...config,
                        showIcon: false,
                        showTitle: false,
                        showSubtitle: false,
                        showBadge: false,
                      };
                      setConfig(updated);
                      onConfigChange(updated);
                      setFeedbackMessage({
                        type: 'success',
                        text: 'Modo Emblema Limpo ativado! Todos os textos sobrepostos foram ocultados.',
                      });
                    }}
                    className="px-4 py-2.5 bg-[#1B357B] hover:bg-[#142654] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#DFB76C]" />
                    <span>✨ Modo Emblema Limpo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updated: AuthHeaderConfig = {
                        ...config,
                        showIcon: true,
                        showTitle: true,
                        showSubtitle: true,
                        showBadge: true,
                      };
                      setConfig(updated);
                      onConfigChange(updated);
                      setFeedbackMessage({
                        type: 'success',
                        text: 'Modo Completo restaurado: ícone, títulos e selo visíveis.',
                      });
                    }}
                    className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>🔄 Modo Completo Padrão</span>
                  </button>
                </div>
              </div>

              {/* Gerenciamento Individual de Cada Camada */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3.5">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3">
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                  <span>Interruptores de Visibilidade</span>
                </h4>

                {[
                  {
                    key: 'showIcon' as const,
                    label: 'Caixa do Ícone / Logotipo Central',
                    desc: 'Exibe o brasão, ícone contábil ou logotipo centralizado.',
                    val: config.showIcon ?? true,
                  },
                  {
                    key: 'showTitle' as const,
                    label: `Título da Marca (${config.title || 'MVRJ CONTÁBIL'})`,
                    desc: 'Exibe o nome principal da empresa em tipografia destacada.',
                    val: config.showTitle ?? true,
                  },
                  {
                    key: 'showSubtitle' as const,
                    label: 'Subtítulo Institucional',
                    desc: 'Exibe a descrição da gestão eletrônica de documentos.',
                    val: config.showSubtitle ?? true,
                  },
                  {
                    key: 'showBadge' as const,
                    label: `Selo de Segurança (${config.badgeText || 'Supabase & R2'})`,
                    desc: 'Exibe a etiqueta técnica de proteção e auditoria de dados.',
                    val: config.showBadge ?? true,
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="text-xs font-bold text-slate-900 leading-tight">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {item.desc}
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={item.val}
                        onChange={(e) => {
                          const updated = { ...config, [item.key]: e.target.checked };
                          setConfig(updated);
                          onConfigChange(updated);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B357B]"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: REALISTIC LIVE PREVIEW (5 COLS) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-100/90 rounded-3xl border border-slate-200 p-5 shadow-sm sticky top-4">
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-blue-600" />
                <span>Prévia em Tempo Real</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                100% Fiel à Tela de Login
              </span>
            </div>

            {/* SIMULATED LOGIN MODAL CARD CONTAINER */}
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden mx-auto max-w-sm">
              
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
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-white shadow-md p-2.5 flex items-center justify-center border border-white/20 mb-3 overflow-hidden">
                        {config.logoType === 'image' && config.logoImageUrl ? (
                          <img
                            src={config.logoImageUrl}
                            alt="Logo"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          renderIcon(config.iconName)
                        )}
                      </div>
                    )}

                    {/* Title */}
                    {(config.showTitle ?? true) && (
                      <h2 className="text-lg font-black tracking-tight text-white drop-shadow-xs">
                        {config.title || 'MVRJ CONTÁBIL'}
                      </h2>
                    )}

                    {/* Subtitle */}
                    {(config.showSubtitle ?? true) && (
                      <p className="text-xs text-blue-200/90 mt-0.5 drop-shadow-xs">
                        {config.subtitle || 'Gestão Eletrônica Contábil'}
                      </p>
                    )}

                    {/* Badge */}
                    {(config.showBadge ?? true) && (
                      <div className="inline-flex items-center space-x-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-[11px] font-semibold text-blue-200 border border-blue-400/30 backdrop-blur-xs">
                        <ShieldAlert className="w-3 h-3 text-blue-300 shrink-0" />
                        <span>{config.badgeText || 'Ambiente Seguro Corporativo'}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* FAKE LOGIN MODAL BODY FOR FAITHFUL CONTEXT */}
              <div className="p-5 bg-white border-t border-slate-100 space-y-3.5">
                <div className="flex border-b border-slate-100 pb-2.5 text-xs font-bold text-slate-500">
                  <div className="flex-1 text-[#1B357B] border-b-2 border-[#C59B4B] pb-1.5 text-center font-black">
                    Acessar Sistema
                  </div>
                  <div className="flex-1 pb-1.5 text-center text-slate-400">
                    Solicitar Acesso
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 flex items-center gap-2 text-xs text-slate-400">
                    <Mail className="w-3.5 h-3.5" />
                    <span>usuario@mvrjcontabil.com.br</span>
                  </div>
                  <div className="h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5" />
                      <span>••••••••</span>
                    </div>
                  </div>
                  <div className="h-10 bg-gradient-to-r from-[#ECD292] via-[#DFB76C] to-[#C99C42] rounded-xl text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm">
                    <span>Entrar no Drive</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 text-center mt-3.5">
              Todas as modificações são sincronizadas no banco e refletem imediatamente para todos os usuários da MVRJCONTÁBIL.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
