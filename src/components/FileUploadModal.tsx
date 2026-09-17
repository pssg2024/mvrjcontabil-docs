import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  X, 
  FileText, 
  Image as ImageIcon, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  AlertCircle,
  Hash,
  Layers,
  Cpu,
  ShieldCheck,
  FolderTree,
  HardDrive,
  AlertOctagon,
  Phone,
  Calendar
} from 'lucide-react';
import { Folder, DocumentFile, Sector, UserProfile, StorageMetrics } from '../types';
import { optimizeFile, formatBytes, computeChecksum } from '../lib/optimization';
import { getPresignedUploadUrl, uploadToPresignedUrl, saveFileRecordToApi } from '../lib/storage-service';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFolder: Folder | null;
  allFolders: Folder[];
  currentUser: UserProfile;
  onUploadSuccess: (newFile: DocumentFile) => void;
  storageMetrics?: StorageMetrics | null;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  currentFolder,
  allFolders,
  currentUser,
  onUploadSuccess,
  storageMetrics,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    currentFolder ? currentFolder.id : (allFolders[0]?.id || '')
  );

  React.useEffect(() => {
    if (currentFolder?.id) {
      setSelectedFolderId(currentFolder.id);
    } else if (allFolders.length > 0 && !allFolders.some(f => f.id === selectedFolderId)) {
      setSelectedFolderId(allFolders[0].id);
    }
  }, [isOpen, currentFolder, allFolders]);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['Contábil', '2026']);

  // Pipeline execution state
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimizationStage, setOptimizationStage] = useState<'idle' | 'optimizing' | 'requesting-url' | 'uploading-r2' | 'finished'>('idle');
  const [optimizationStats, setOptimizationStats] = useState<{
    originalSize: number;
    optimizedSize: number;
    reductionPercentage: number;
    mimeType: string;
    checksum: string;
    pagesCount: number;
  } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const targetFolder = allFolders.find(f => f.id === selectedFolderId) || currentFolder || allFolders[0];

  // Storage Limit Blocking verification
  const totalQuotaBytes = storageMetrics?.totalCapacityBytes || (10 * 1024 * 1024 * 1024);
  const isQuotaExceeded = storageMetrics 
    ? (storageMetrics.usedBytes >= totalQuotaBytes || storageMetrics.usedPercent >= 100)
    : false;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isQuotaExceeded) {
      setErrorMessage('Limite de armazenamento Cloudflare R2 atingido. Upload bloqueado. Entre em contato com o suporte de TI (21) 97396-0077.');
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    if (isQuotaExceeded) {
      setErrorMessage('Limite de armazenamento Cloudflare R2 atingido. Upload bloqueado. Entre em contato com o suporte de TI (21) 97396-0077.');
      return;
    }
    setSelectedFile(file);
    setOptimizationStats(null);
    setOptimizationStage('idle');
    setErrorMessage(null);

    // Auto generate tag from sector
    if (targetFolder && !tags.includes(targetFolder.sector)) {
      setTags(prev => [...prev, targetFolder.sector]);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/^#/, '');
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleExecutePipeline = async () => {
    if (isQuotaExceeded) {
      setErrorMessage('Limite de armazenamento Cloudflare R2 atingido. Gravação bloqueada. Contate o suporte de TI pelo número (21) 97396-0077.');
      return;
    }
    if (!selectedFile || !targetFolder) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);

      // ETAPA 1: OTIMIZAÇÃO AUTOMÁTICA (PDF ou IMAGEM)
      setOptimizationStage('optimizing');
      const optResult = await optimizeFile(selectedFile);
      const arrayBuf = await optResult.file.arrayBuffer();
      const checksum = await computeChecksum(arrayBuf);

      const stats = {
        originalSize: optResult.originalSize,
        optimizedSize: optResult.optimizedSize,
        reductionPercentage: optResult.reductionPercentage,
        mimeType: optResult.mimeType,
        checksum,
        pagesCount: optResult.pagesCount || 1,
      };
      setOptimizationStats(stats);

      // ETAPA 2: SOLICITAÇÃO DA PRESIGNED URL AO BACKEND
      setOptimizationStage('requesting-url');
      const presignedData = await getPresignedUploadUrl(
        optResult.file instanceof File ? optResult.file.name : selectedFile.name,
        optResult.mimeType,
        targetFolder.sector,
        targetFolder.id,
        optResult.optimizedSize
      );

      // ETAPA 3: UPLOAD DIRETO PARA CLOUDFLARE R2 COM FALLBACK RESILIENTE
      setOptimizationStage('uploading-r2');
      const finalDocName = optResult.file instanceof File ? optResult.file.name : selectedFile.name;
      await uploadToPresignedUrl(
        presignedData.uploadUrl,
        optResult.file,
        optResult.mimeType,
        (progress) => setUploadProgress(progress),
        presignedData.storageKey,
        finalDocName
      );

      // ETAPA 4: SUCESSO & REGISTRO NO GED & SUPABASE
      setOptimizationStage('finished');

      const tempDoc: DocumentFile = {
        id: `file-${Date.now()}`,
        folder_id: targetFolder.id,
        name: optResult.file instanceof File ? optResult.file.name : selectedFile.name,
        storage_key: presignedData.storageKey,
        mime_type: optResult.mimeType,
        original_size: stats.originalSize,
        optimized_size: stats.optimizedSize,
        compression_ratio: stats.reductionPercentage,
        pages_count: stats.pagesCount,
        tags,
        uploaded_by: currentUser.id,
        uploader_name: currentUser.full_name,
        sector: targetFolder.sector,
        checksum_sha256: checksum,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        preview_url: optResult.dataUrl,
      };

      let finalDoc = tempDoc;
      try {
        const saved = await saveFileRecordToApi(tempDoc);
        if (saved && saved.id) {
          finalDoc = { ...saved, preview_url: optResult.dataUrl || saved.preview_url };
        }
      } catch (dbErr) {
        console.warn('Falha ao registrar documento no Supabase, mantendo cópia em memória:', dbErr);
      }

      setTimeout(() => {
        onUploadSuccess(finalDoc);
        onClose();
      }, 1000);

    } catch (err: any) {
      console.error('Falha no pipeline de upload:', err);
      setErrorMessage(err.message || 'Erro durante o processamento do documento.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 leading-tight">Upload & Otimização de Documento</h3>
              <p className="text-xs text-gray-500">Pipeline automático: Compressão de PDF/WebP + Cloudflare R2</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Folder Target Selector & Competence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Pasta de Destino no GED</label>
              <div className="relative">
                <FolderTree className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <select
                  disabled={isProcessing}
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 outline-hidden"
                >
                  {allFolders.map(folder => (
                    <option key={folder.id} value={folder.id}>
                      {folder.sector} » {folder.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Competência (Mês/Ano)</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <select
                  disabled={isProcessing}
                  onChange={(e) => {
                    const comp = e.target.value;
                    if (comp !== 'NONE') {
                      if (!tags.includes(comp)) setTags([...tags, comp]);
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 outline-hidden"
                >
                  <option value="NONE">Selecione...</option>
                  {['01/2026', '02/2026', '03/2026', '04/2026', '05/2026', '06/2026', '07/2026', '08/2026'].map(c => (
                    <option key={c} value={`Ref: ${c}`}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Storage Quota Warning or Tracker */}
          {isQuotaExceeded ? (
            <div className="p-4 bg-rose-50 border-2 border-rose-400/80 rounded-xl space-y-3 text-xs text-rose-950">
              <div className="flex items-center space-x-2">
                <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
                <strong className="text-sm font-bold text-rose-900">Capacidade Máxima de Armazenamento Atingida</strong>
              </div>
              <p className="text-rose-800">
                O limite de armazenamento foi atingido e novos arquivos não podem ser salvos no momento. Para solicitar liberação ou aumento de capacidade, contate imediatamente o suporte de TI:
              </p>
              <div className="p-3 bg-white rounded-lg border border-rose-200 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-semibold block">Suporte Técnico TI</span>
                    <strong className="text-sm font-mono text-gray-900">(21) 97396-0077</strong>
                  </div>
                </div>
                <a
                  href="https://wa.me/5521973960077?text=Ol%C3%A1%2C%20o%20limite%20de%20armazenamento%20do%20GED%20MVRJCONT%C3%81BIL%20foi%20atingido.%20Preciso%20de%20suporte."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                >
                  WhatsApp TI
                </a>
              </div>
            </div>
          ) : storageMetrics ? (
            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-blue-900 font-semibold">
                <span className="flex items-center space-x-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                  <span>Armazenamento</span>
                </span>
                <span className="font-mono text-[11px] text-blue-800">
                  {formatBytes(storageMetrics.usedBytes)} usados • <strong className="text-emerald-700">{formatBytes(storageMetrics.freeBytes)} livres</strong>
                </span>
              </div>
              <div className="w-full h-1.5 bg-blue-200/60 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(1, storageMetrics.usedPercent)}%` }}
                />
              </div>
            </div>
          ) : null}

          {/* Dropzone */}
          {isQuotaExceeded ? (
            <div className="border-2 border-dashed border-rose-300 bg-rose-50/40 rounded-2xl p-8 text-center">
              <AlertOctagon className="w-10 h-10 text-rose-500 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-rose-900">Envio de documentos temporariamente bloqueado</h4>
              <p className="text-[11px] text-rose-700 mt-1 max-w-sm mx-auto">
                Para desbloquear o upload, entre em contato com o suporte de TI (21) 97396-0077 para expandir o plano de armazenamento.
              </p>
            </div>
          ) : !selectedFile ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-gray-50/50 hover:bg-blue-50/30"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelected(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-gray-800">Clique para selecionar ou arraste o arquivo aqui</p>
              <p className="text-[11px] text-gray-500 mt-1">PDFs, Imagens digitalizadas (PNG, JPG) ou Planilhas</p>
              <div className="mt-3 flex items-center justify-center space-x-2 text-[10px] text-gray-400">
                <span className="px-2 py-0.5 bg-gray-200/70 rounded">PDF</span>
                <span className="px-2 py-0.5 bg-gray-200/70 rounded">PNG</span>
                <span className="px-2 py-0.5 bg-gray-200/70 rounded">JPG</span>
                <span className="px-2 py-0.5 bg-gray-200/70 rounded">WebP</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected File Card */}
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                    {selectedFile.type.includes('image') ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-gray-900 truncate max-w-[280px]">{selectedFile.name}</h4>
                    <p className="text-[11px] text-gray-500">Tamanho Original: <strong>{formatBytes(selectedFile.size)}</strong></p>
                    {selectedFile.type.includes('image') && (
                      <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        <Sparkles className="w-3 h-3 mr-1" /> Otimização Máxima Ativa (WebP + Downscale OCR)
                      </span>
                    )}
                  </div>
                </div>

                {!isProcessing && (
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1"
                  >
                    Trocar Arquivo
                  </button>
                )}
              </div>

              {/* Tags input */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Tags do Documento</label>
                <div className="flex flex-wrap gap-1.5 p-2 border border-gray-300 rounded-lg bg-white min-h-[38px] items-center">
                  {tags.map(tag => (
                    <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      #{tag}
                      {!isProcessing && (
                        <button onClick={() => handleRemoveTag(tag)} className="ml-1 text-blue-400 hover:text-blue-700">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                  {!isProcessing && (
                    <input
                      type="text"
                      placeholder="Adicionar tag (Enter)..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      className="text-xs outline-hidden flex-1 min-w-[120px]"
                    />
                  )}
                </div>
              </div>

              {/* Optimization Preview Banner if ready */}
              {optimizationStats && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>Otimização Concluída ({optimizationStats.reductionPercentage}% menor)</span>
                    </span>
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                      Economia de {formatBytes(optimizationStats.originalSize - optimizationStats.optimizedSize)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                    <div className="bg-white p-2 rounded-lg border border-emerald-100">
                      <span className="text-[10px] text-gray-400 block">Original</span>
                      <span className="font-bold text-gray-700">{formatBytes(optimizationStats.originalSize)}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-100">
                      <span className="text-[10px] text-gray-400 block">Otimizado</span>
                      <span className="font-bold text-emerald-700">{formatBytes(optimizationStats.optimizedSize)}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-100">
                      <span className="text-[10px] text-gray-400 block">Formato Final</span>
                      <span className="font-bold text-blue-700">{optimizationStats.mimeType.split('/')[1]?.toUpperCase()}</span>
                    </div>
                  </div>

                  <div className="text-[10px] font-mono text-emerald-800 truncate pt-1 flex items-center space-x-1">
                    <Hash className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="truncate">SHA-256: {optimizationStats.checksum}</span>
                  </div>
                </div>
              )}

              {/* Processing Progress Status */}
              {isProcessing && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                    <span className="flex items-center space-x-2">
                      <Cpu className="w-4 h-4 text-blue-600 animate-spin" />
                      <span>
                        {optimizationStage === 'optimizing' && 'Comprimindo e preparando documento...'}
                        {optimizationStage === 'requesting-url' && 'Conectando ao armazenamento seguro...'}
                        {optimizationStage === 'uploading-r2' && `Salvando arquivo (${uploadProgress}%)...`}
                        {optimizationStage === 'finished' && 'Documento salvo com sucesso!'}
                      </span>
                    </span>
                    {optimizationStage === 'uploading-r2' && <span>{uploadProgress}%</span>}
                  </div>

                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-300"
                      style={{ 
                        width: optimizationStage === 'optimizing' ? '30%' :
                               optimizationStage === 'requesting-url' ? '60%' :
                               optimizationStage === 'uploading-r2' ? `${60 + (uploadProgress * 0.4)}%` : '100%' 
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              disabled={isProcessing}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-lg"
            >
              Cancelar
            </button>

            {isQuotaExceeded ? (
              <div 
                className="px-4 py-2 bg-rose-100 text-rose-800 rounded-lg text-xs font-bold flex items-center space-x-1.5"
                title="Armazenamento 100% atingido. Contate o suporte de TI (21) 97396-0077."
              >
                <AlertOctagon className="w-4 h-4 text-rose-600" />
                <span>Upload Bloqueado (Limite Atingido)</span>
              </div>
            ) : selectedFile && !isProcessing && (
              <button
                id="start-pipeline-btn"
                type="button"
                onClick={handleExecutePipeline}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center space-x-2 transition-colors"
              >
                <span>Otimizar e Salvar Documento</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
