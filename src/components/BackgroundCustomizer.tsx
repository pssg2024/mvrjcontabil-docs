import React, { useState, useEffect, useRef } from 'react';
import { 
  Palette, 
  UploadCloud, 
  Link2, 
  Sliders, 
  RotateCcw, 
  Check, 
  Eye, 
  AlertCircle, 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  Image as ImageIcon,
  FolderLock,
  FileText,
  ShieldCheck,
  Maximize2
} from 'lucide-react';
import { UserProfile, SiteBackgroundConfig } from '../types';
import { 
  BACKGROUND_PRESETS, 
  BackgroundPreset, 
  uploadSiteBackgroundImage, 
  updateSiteBackgroundConfig, 
  resetSiteBackground 
} from '../lib/storage-service';
import { formatBytes } from '../lib/optimization';

interface BackgroundCustomizerProps {
  currentUser: UserProfile;
  currentConfig: SiteBackgroundConfig;
  onConfigChange: (newConfig: SiteBackgroundConfig) => void;
  onAuditLog?: (details: Record<string, any>) => void;
}

export const BackgroundCustomizer: React.FC<BackgroundCustomizerProps> = ({
  currentUser,
  currentConfig,
  onConfigChange,
  onAuditLog,
}) => {
  const [activeSourceTab, setActiveSourceTab] = useState<'presets' | 'upload' | 'url'>('presets');
  const [formData, setFormData] = useState<SiteBackgroundConfig>({ ...currentConfig });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [customUrlInput, setCustomUrlInput] = useState(
    currentConfig.imageUrl && !currentConfig.imageUrl.startsWith('/api/r2') ? currentConfig.imageUrl : ''
  );
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with currentConfig prop
  useEffect(() => {
    setFormData({ ...currentConfig });
    if (currentConfig.imageUrl && !currentConfig.imageUrl.startsWith('/api/r2')) {
      setCustomUrlInput(currentConfig.imageUrl);
    }
  }, [currentConfig]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (filePreview && filePreview.startsWith('blob:')) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);

  // Select Preset
  const handleSelectPreset = (preset: BackgroundPreset) => {
    const updated: SiteBackgroundConfig = {
      ...formData,
      enabled: true,
      imageUrl: preset.imageUrl,
      presetId: preset.id,
      opacity: preset.defaultOpacity,
      blur: preset.defaultBlur,
      overlayType: preset.overlayType,
      overlayOpacity: preset.overlayOpacity,
      position: preset.position,
    };
    setFormData(updated);
    setSelectedFile(null);
    setFilePreview(null);
    setStatusMessage(null);
  };

  // File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatusMessage({ type: 'error', text: 'Por favor, selecione um arquivo de imagem válido (JPG, PNG, WEBP ou SVG).' });
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setStatusMessage({ type: 'error', text: 'O arquivo selecionado excede o limite máximo de 20 MB.' });
      return;
    }

    setSelectedFile(file);
    const previewUrl = URL.createObjectURL(file);
    setFilePreview(previewUrl);
    setFormData(prev => ({
      ...prev,
      enabled: true,
      imageUrl: previewUrl,
      presetId: 'custom_upload',
    }));
    setStatusMessage(null);
  };

  // Drag and Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setStatusMessage({ type: 'error', text: 'Apenas arquivos de imagem são suportados.' });
        return;
      }
      setSelectedFile(file);
      const previewUrl = URL.createObjectURL(file);
      setFilePreview(previewUrl);
      setFormData(prev => ({
        ...prev,
        enabled: true,
        imageUrl: previewUrl,
        presetId: 'custom_upload',
      }));
      setStatusMessage(null);
    }
  };

  // URL Input Change
  const handleUrlApply = () => {
    if (!customUrlInput.trim()) {
      setStatusMessage({ type: 'error', text: 'Informe uma URL válida para a imagem de fundo.' });
      return;
    }
    setFormData(prev => ({
      ...prev,
      enabled: true,
      imageUrl: customUrlInput.trim(),
      presetId: 'custom_url',
    }));
    setSelectedFile(null);
    setFilePreview(null);
    setStatusMessage({ type: 'success', text: 'URL da imagem aplicada à prévia!' });
  };

  // Save changes to backend
  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      let finalImageUrl = formData.imageUrl;

      // Se há um arquivo novo selecionado para upload
      if (selectedFile) {
        setUploadProgress(10);
        const uploadResult = await uploadSiteBackgroundImage(
          selectedFile,
          `${currentUser.full_name} (${currentUser.email})`,
          (progress) => setUploadProgress(progress)
        );
        finalImageUrl = uploadResult.imageUrl;
      }

      const updatedConfig: SiteBackgroundConfig = {
        ...formData,
        imageUrl: finalImageUrl,
        updatedAt: new Date().toISOString(),
        updatedBy: `${currentUser.full_name} (${currentUser.email})`,
      };

      const res = await updateSiteBackgroundConfig(
        updatedConfig,
        `${currentUser.full_name} (${currentUser.email})`
      );

      const saved = res.config || updatedConfig;
      onConfigChange(saved);
      setFormData(saved);
      setSelectedFile(null);
      setFilePreview(null);
      setUploadProgress(null);
      setStatusMessage({ type: 'success', text: 'Imagem de fundo e estilos corporativos salvos com sucesso para todo o site!' });

      if (onAuditLog) {
        onAuditLog({
          action: 'BACKGROUND_IMAGE_CHANGED',
          enabled: saved.enabled,
          presetId: saved.presetId,
          imageUrl: saved.imageUrl,
          opacity: saved.opacity,
          blur: saved.blur,
          overlayType: saved.overlayType,
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Falha ao salvar imagem de fundo.' });
    } finally {
      setIsSaving(false);
      setUploadProgress(null);
    }
  };

  // Reset to default
  const handleReset = async () => {
    if (!confirm('Deseja restaurar o fundo do site para o padrão neutro original da MVRJCONTÁBIL?')) {
      return;
    }

    setIsSaving(true);
    try {
      const res = await resetSiteBackground(`${currentUser.full_name} (${currentUser.email})`);
      const defaultConf = res.config;
      onConfigChange(defaultConf);
      setFormData(defaultConf);
      setSelectedFile(null);
      setFilePreview(null);
      setCustomUrlInput('');
      setStatusMessage({ type: 'success', text: 'Fundo do site restaurado para o padrão limpo com sucesso.' });

      if (onAuditLog) {
        onAuditLog({
          action: 'BACKGROUND_IMAGE_CHANGED',
          details: 'Fundo do site redefinido para padrão corporativo limpo',
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Falha ao redefinir fundo do site.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info Card */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30 text-xs font-semibold uppercase tracking-wider flex items-center space-x-1.5">
                <Palette className="w-3.5 h-3.5" />
                <span>Personalização Visual Corporativa</span>
              </span>
              {formData.enabled && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 text-[11px] font-bold">
                  Fundo Personalizado Ativo
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black mt-2 tracking-tight">Imagem de Fundo do GED MVRJCONTÁBIL</h2>
            <p className="text-xs text-blue-200/80 mt-1 max-w-xl leading-relaxed">
              Como Administrador, você pode alterar a imagem e o estilo de fundo de todo o sistema. As alterações são sincronizadas e refletidas imediatamente para todos os funcionários e clientes.
            </p>
          </div>

          {/* Quick Toggle Switch */}
          <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/15">
            <div className="text-right">
              <span className="text-xs font-bold block text-white">Status do Fundo</span>
              <span className="text-[11px] text-blue-200 block">
                {formData.enabled ? 'Personalizado' : 'Padrão Neutro'}
              </span>
            </div>
            <button
              id="toggle-background-enabled"
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                formData.enabled ? 'bg-emerald-500' : 'bg-gray-600'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  formData.enabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Alert / Notification Feedback */}
      {statusMessage && (
        <div
          id="background-status-alert"
          className={`p-4 rounded-xl text-xs font-medium flex items-center space-x-2.5 transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border border-rose-200 text-rose-900'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Grid: Left Controls, Right Real-Time Mockup Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: SOURCE SELECTION & FINE TUNING (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Source Selection Tabs */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5">
            <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-2 mb-3">
              <ImageIcon className="w-4 h-4 text-blue-600" />
              <span>1. Escolha a Origem da Imagem</span>
            </h3>

            <div className="flex border-b border-gray-200 space-x-4 mb-4">
              <button
                id="source-tab-presets"
                type="button"
                onClick={() => setActiveSourceTab('presets')}
                className={`pb-2.5 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-colors ${
                  activeSourceTab === 'presets'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Presets Corporativos</span>
              </button>

              <button
                id="source-tab-upload"
                type="button"
                onClick={() => setActiveSourceTab('upload')}
                className={`pb-2.5 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-colors ${
                  activeSourceTab === 'upload'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload do Computador</span>
              </button>

              <button
                id="source-tab-url"
                type="button"
                onClick={() => setActiveSourceTab('url')}
                className={`pb-2.5 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-colors ${
                  activeSourceTab === 'url'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Link / URL Externa</span>
              </button>
            </div>

            {/* TAB CONTENT: PRESETS */}
            {activeSourceTab === 'presets' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  Selecione uma composição corporativa refinada, pré-calibrada para máxima legibilidade de tabelas fiscais e documentos:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {BACKGROUND_PRESETS.map((preset) => {
                    const isSelected = formData.presetId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        id={`preset-card-${preset.id}`}
                        onClick={() => handleSelectPreset(preset)}
                        className={`group relative rounded-xl border p-2 cursor-pointer transition-all overflow-hidden ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-xs bg-gray-50/50'
                        }`}
                      >
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-200 mb-2">
                          <img
                            src={preset.thumbnail}
                            alt={preset.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-xs">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          )}
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-900/80 text-white backdrop-blur-xs">
                            {preset.category}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-gray-900 truncate">{preset.name}</h4>
                          <p className="text-[10px] text-gray-500 line-clamp-1">{preset.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB CONTENT: UPLOAD */}
            {activeSourceTab === 'upload' && (
              <div className="space-y-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  className="hidden"
                  id="admin-bg-file-input"
                />

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer transition-colors bg-gray-50/60 hover:bg-blue-50/30 group"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-bold text-gray-900">Clique para selecionar ou arraste uma imagem aqui</h4>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Formatos aceitos: JPG, PNG, WEBP ou SVG (Tamanho máx. recomendado: até 20 MB)
                  </p>
                  <p className="text-[10px] text-indigo-600 font-semibold mt-2">
                    A imagem será enviada diretamente para o bucket Cloudflare R2 da MVRJCONTÁBIL
                  </p>
                </div>

                {selectedFile && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {filePreview && (
                        <img
                          src={filePreview}
                          alt="Prévia selecionada"
                          className="w-12 h-12 rounded-lg object-cover border border-blue-200"
                        />
                      )}
                      <div>
                        <span className="text-xs font-bold text-blue-950 block truncate max-w-xs">
                          {selectedFile.name}
                        </span>
                        <span className="text-[11px] text-blue-700">
                          {formatBytes(selectedFile.size)} • {selectedFile.type || 'Imagem'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setFilePreview(null);
                      }}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1"
                    >
                      Remover
                    </button>
                  </div>
                )}

                {uploadProgress !== null && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-600 font-medium">
                      <span>Progresso do Upload Cloudflare R2</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: URL */}
            {activeSourceTab === 'url' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">
                  Insira o link público direto para a imagem hospedada na CDN da empresa ou banco de imagens:
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="input-custom-bg-url"
                      type="url"
                      placeholder="https://exemplo.com/imagem-corporativa.jpg"
                      value={customUrlInput}
                      onChange={(e) => setCustomUrlInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleUrlApply}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    Testar URL
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Fine Tuning Sliders Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-5">
            <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <span>2. Ajustes Finos & Legibilidade WCAG</span>
            </h3>

            {/* Opacity Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="bg-opacity-slider" className="font-bold text-gray-700">
                  Opacidade da Imagem
                </label>
                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {formData.opacity}%
                </span>
              </div>
              <input
                id="bg-opacity-slider"
                type="range"
                min="5"
                max="100"
                step="5"
                value={formData.opacity}
                onChange={(e) => setFormData(prev => ({ ...prev, opacity: Number(e.target.value) }))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <p className="text-[11px] text-gray-500">
                Recomendado: 15% a 35% para que tabelas de cálculo, notas fiscais e relatórios permaneçam 100% legíveis.
              </p>
            </div>

            {/* Blur Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="bg-blur-slider" className="font-bold text-gray-700">
                  Desfoque Artístico (Blur)
                </label>
                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {formData.blur} px
                </span>
              </div>
              <input
                id="bg-blur-slider"
                type="range"
                min="0"
                max="15"
                step="1"
                value={formData.blur}
                onChange={(e) => setFormData(prev => ({ ...prev, blur: Number(e.target.value) }))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <p className="text-[11px] text-gray-500">
                Suaviza detalhes de fotos para criar texturas elegantes sem poluir a interface.
              </p>
            </div>

            {/* Overlay Type & Opacity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Camada de Sobreposição</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['light', 'dark', 'none'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, overlayType: type }))}
                      className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all text-center ${
                        formData.overlayType === type
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {type === 'light' ? 'Claro' : type === 'dark' ? 'Escuro' : 'Nenhum'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label htmlFor="bg-overlay-slider" className="font-bold text-gray-700">
                    Filtro de Contraste
                  </label>
                  <span className="font-mono font-bold text-gray-700">{formData.overlayOpacity}%</span>
                </div>
                <input
                  id="bg-overlay-slider"
                  type="range"
                  min="0"
                  max="90"
                  step="5"
                  disabled={formData.overlayType === 'none'}
                  value={formData.overlayOpacity}
                  onChange={(e) => setFormData(prev => ({ ...prev, overlayOpacity: Number(e.target.value) }))}
                  className="w-full accent-blue-600 cursor-pointer disabled:opacity-40"
                />
              </div>
            </div>

            {/* Position / Sizing */}
            <div className="space-y-1.5 pt-2 border-t border-gray-100">
              <label className="text-xs font-bold text-gray-700 block">Enquadramento do Fundo</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cover', label: 'Cobrir Tela (Cover)' },
                  { id: 'contain', label: 'Ajustar (Contain)' },
                  { id: 'repeat', label: 'Repetir Padrão (Tile)' },
                ].map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, position: pos.id as any }))}
                    className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all text-center ${
                      formData.position === pos.id
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: INTERACTIVE LIVE PREVIEW & SAVE ACTIONS (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Mockup Preview Box */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <span>Pré-visualização em Tempo Real</span>
              </h3>
              <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                Simulador do GED
              </span>
            </div>

            {/* Miniature Browser Mockup Window */}
            <div className="border border-gray-300 rounded-xl overflow-hidden shadow-sm relative bg-slate-100">
              {/* Fake Window Bar */}
              <div className="bg-slate-200 px-3 py-1.5 border-b border-gray-300 flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="bg-white rounded text-[9px] text-gray-600 font-mono px-2 py-0.5 flex-1 truncate text-center">
                  mvrjcontabil.com.br/ged/drive
                </div>
              </div>

              {/* Fake Site Canvas with Applied Background */}
              <div className="relative p-3 min-h-[300px] overflow-hidden bg-slate-50 flex flex-col justify-between">
                {/* Real-time background layer */}
                {formData.enabled && formData.imageUrl && (
                  <div
                    className="absolute inset-0 pointer-events-none transition-all duration-300"
                    style={{
                      backgroundImage: `url(${formData.imageUrl})`,
                      backgroundSize: formData.position === 'repeat' ? 'auto' : formData.position === 'contain' ? 'contain' : 'cover',
                      backgroundRepeat: formData.position === 'repeat' ? 'repeat' : 'no-repeat',
                      backgroundPosition: 'center center',
                      opacity: formData.opacity / 100,
                      filter: formData.blur > 0 ? `blur(${formData.blur}px)` : 'none',
                      transform: formData.blur > 0 ? 'scale(1.05)' : 'none',
                    }}
                  />
                )}

                {/* Real-time overlay layer */}
                {formData.enabled && formData.imageUrl && formData.overlayType !== 'none' && (
                  <div
                    className={`absolute inset-0 pointer-events-none transition-all duration-300 ${
                      formData.overlayType === 'dark' ? 'bg-slate-950' : 'bg-slate-50'
                    }`}
                    style={{
                      opacity: (formData.overlayOpacity ?? 40) / 100,
                    }}
                  />
                )}

                {/* Miniature Content Layers (Cards on top) */}
                <div className="relative z-10 space-y-2">
                  {/* Miniature Top Nav */}
                  <div className="bg-white/95 backdrop-blur-xs border border-gray-200 rounded-lg p-2 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white">
                        <FolderLock className="w-3 h-3" />
                      </div>
                      <span className="text-[10px] font-black text-gray-900">MVRJCONTÁBIL</span>
                    </div>
                    <span className="text-[8px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded">
                      Admin
                    </span>
                  </div>

                  {/* Miniature Hero Banner */}
                  <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-lg p-2.5 shadow-2xs">
                    <span className="text-[8px] uppercase tracking-wider text-blue-200 font-semibold block">
                      Drive Corporativo
                    </span>
                    <span className="text-[11px] font-bold block mt-0.5">Gestão Eletrônica de Documentos</span>
                  </div>

                  {/* Miniature Content Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/90 backdrop-blur-xs border border-gray-200 rounded-lg p-2 shadow-2xs">
                      <span className="text-[9px] font-bold text-gray-800 block">📁 Departamento Fiscal</span>
                      <span className="text-[8px] text-gray-500">14 documentos</span>
                    </div>
                    <div className="bg-white/90 backdrop-blur-xs border border-gray-200 rounded-lg p-2 shadow-2xs">
                      <span className="text-[9px] font-bold text-gray-800 block">📁 Contábil & Balanços</span>
                      <span className="text-[8px] text-gray-500">28 documentos</span>
                    </div>
                  </div>

                  {/* Miniature File Item */}
                  <div className="bg-white/90 backdrop-blur-xs border border-gray-200 rounded-lg p-2 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center space-x-1.5 truncate">
                      <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="text-[9px] font-medium text-gray-700 truncate">
                        balancete_fiscal_mvrj_2026.pdf
                      </span>
                    </div>
                    <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded">
                      -65%
                    </span>
                  </div>
                </div>

                {/* Footer badge */}
                <div className="relative z-10 text-center pt-2">
                  <span className="text-[8px] text-gray-500 bg-white/80 px-2 py-0.5 rounded backdrop-blur-xs">
                    Visualização renderizada com {formData.enabled ? `${formData.opacity}% opacidade` : 'fundo neutro'}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-gray-500 leading-relaxed bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex items-start space-x-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                <strong>Garantia de Leitura:</strong> A sobreposição calibrada garante conformidade visual e nitidez em monitores LCD, LED e OLED.
              </span>
            </div>
          </div>

          {/* Action Buttons Box */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-3">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Publicar Alterações no GED
            </h4>

            <button
              id="btn-save-background"
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-colors cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Salvando no Servidor & R2...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Salvar e Aplicar em Todo o Site</span>
                </>
              )}
            </button>

            <button
              id="btn-reset-background"
              type="button"
              onClick={handleReset}
              disabled={isSaving}
              className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50 text-gray-700 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-gray-500" />
              <span>Restaurar Fundo Padrão Neutro</span>
            </button>

            {currentConfig.updatedAt && (
              <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-500 text-center">
                Última alteração: {new Date(currentConfig.updatedAt).toLocaleString('pt-BR')} por {currentConfig.updatedBy || 'Administrador'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
