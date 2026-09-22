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
  FolderTree,
  AlertOctagon,
  Phone,
  Calendar,
  KeyRound,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  File as FileGenericIcon,
  ChevronDown,
  ChevronUp
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
  const [customFileName, setCustomFileName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    currentFolder ? currentFolder.id : (allFolders[0]?.id || '')
  );

  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['Contábil', '2026']);

  // Pipeline execution state
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimizationStage, setOptimizationStage] = useState<'idle' | 'optimizing' | 'requesting-url' | 'uploading-r2' | 'finished'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setSelectedFile(null);
    setCustomFileName('');
    setTags(['Contábil', '2026']);
    setTagInput('');
    setIsProcessing(false);
    setOptimizationStage('idle');
    setUploadProgress(0);
    setErrorMessage(null);
  };

  const isFullAdmin = 
    currentUser?.role === 'admin' || 
    (currentUser?.role as string) === 'ADMIN' || 
    (currentUser as any)?.role === 'Diretoria' ||
    currentUser?.sector === 'Diretoria' || 
    (currentUser as any)?.setor === 'Diretoria';

  const isEditor = currentUser?.role === 'editor';

  const accessibleFolders = React.useMemo(() => {
    return allFolders.filter(folder => {
      if (isFullAdmin || isEditor) return true;
      return Boolean(folder.allowed_user_ids?.includes(currentUser?.id));
    });
  }, [allFolders, currentUser?.id, isFullAdmin, isEditor]);

  const currentFolderId = currentFolder?.id;

  React.useEffect(() => {
    if (isOpen) {
      if (currentFolderId) {
        setSelectedFolderId(currentFolderId);
      } else if (accessibleFolders.length > 0 && (!selectedFolderId || !accessibleFolders.some(f => f.id === selectedFolderId))) {
        setSelectedFolderId(accessibleFolders[0].id);
      }
    } else {
      resetForm();
    }
  }, [isOpen, currentFolderId]);

  if (!isOpen) return null;

  const targetFolder = accessibleFolders.find(f => f.id === selectedFolderId) || currentFolder || accessibleFolders[0] || allFolders[0];

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
    setCustomFileName(file.name);
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

      let finalName = customFileName.trim();
      if (!finalName) {
        finalName = selectedFile.name;
      }
      // Se originalFile possui extensão e finalName não possui a mesma, anexa de forma inteligente
      const dotIndex = selectedFile.name.lastIndexOf('.');
      if (dotIndex >= 0) {
        const ext = selectedFile.name.substring(dotIndex);
        if (ext && !finalName.toLowerCase().endsWith(ext.toLowerCase())) {
          finalName += ext;
        }
      }

      // ETAPA 2: SOLICITAÇÃO DA PRESIGNED URL AO BACKEND
      setOptimizationStage('requesting-url');
      const presignedData = await getPresignedUploadUrl(
        finalName,
        optResult.mimeType,
        targetFolder.sector,
        targetFolder.id,
        optResult.optimizedSize
      );

      // ETAPA 3: UPLOAD DIRETO PARA CLOUDFLARE R2 COM FALLBACK RESILIENTE
      setOptimizationStage('uploading-r2');
      const finalDocName = finalName;
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
        name: finalName,
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
      } catch (dbErr: any) {
        console.error('Falha ao registrar documento:', dbErr);
        alert('Erro ao salvar documento: ' + (dbErr.message || 'Erro desconhecido'));
      }

      // Notifica sucesso imediatamente e fecha o modal após 1 segundo
      onUploadSuccess(finalDoc);
      setTimeout(() => {
        onClose();
        resetForm();
      }, 1000);

    } catch (err: any) {
      console.error('Falha no pipeline de upload:', err);
      setErrorMessage(err.message || 'Erro durante o processamento do documento.');
      setIsProcessing(false);
      setOptimizationStage('idle');
    }
  };

  const hasAccordionData = false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs">
      <div className="bg-white w-[94%] max-w-lg mx-auto rounded-2xl shadow-2xl border border-slate-200/80 max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Compacto */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="bg-[#1B357B]/10 text-[#1B357B] p-2 rounded-xl shrink-0">
              <UploadCloud className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-slate-900 font-bold text-sm sm:text-base leading-tight truncate">
                Upload de Documentos
              </h3>
              <p className="text-slate-500 text-[10px] sm:text-xs truncate">
                PDFs, Imagens, XMLs, Certificados (PFX) e Planilhas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing && optimizationStage !== 'finished'}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Scroll Vertical Suave */}
        <div className="p-3.5 sm:p-5 space-y-3 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Seletor de Pasta de Destino Unificado */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5">
              Pasta de Destino no GED
            </label>
            <div className="relative">
              <FolderTree className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                disabled={isProcessing}
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="w-full h-9 sm:h-10 px-3 pl-9 text-xs text-slate-950 bg-white border border-slate-300 rounded-xl focus:border-[#1B357B] focus:ring-1 focus:ring-[#1B357B] outline-none transition-all font-bold truncate cursor-pointer shadow-2xs"
              >
                {accessibleFolders.map(folder => (
                  <option key={folder.id} value={folder.id}>
                    {folder.sector} » {folder.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Aviso Crítico de Bloqueio se Espaço Total For Excedido */}
          {isQuotaExceeded && (
            <div className="p-3 bg-rose-50 border-2 border-rose-400 rounded-xl space-y-2 text-xs text-rose-950">
              <div className="flex items-center space-x-2">
                <AlertOctagon className="w-4 h-4 text-rose-700 shrink-0" />
                <strong className="text-xs font-black text-rose-950">Capacidade Máxima Atingida</strong>
              </div>
              <p className="text-xs font-semibold text-rose-900">
                Novos uploads bloqueados. Entre em contato com o suporte de TI:
              </p>
              <div className="p-2 bg-white rounded-lg border border-rose-300 flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-black text-slate-950">(21) 97396-0077</span>
                <a
                  href="https://wa.me/5521973960077?text=Ol%C3%A1%2C%20o%20limite%20de%20armazenamento%20do%20GED%20MVRJCONT%C3%81BIL%20foi%20atingido.%20Preciso%20de%20suporte."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs"
                >
                  WhatsApp TI
                </a>
              </div>
            </div>
          )}

          {/* Dropzone ou Card do Arquivo Selecionado */}
          {!selectedFile ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-[#1B357B] bg-slate-50 hover:bg-slate-100/80 rounded-xl p-5 sm:p-6 transition-all cursor-pointer flex flex-col items-center justify-center text-center group shadow-2xs"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelected(e.target.files[0]);
                  }
                }}
              />
              <UploadCloud className="text-[#1B357B] group-hover:scale-110 transition-transform w-9 h-9 mb-2" />
              <p className="text-xs font-bold text-slate-950">Clique para selecionar ou arraste o arquivo</p>
              <p className="text-xs font-semibold text-slate-600 mt-1">PDFs, Imagens, XMLs, Planilhas e Certificados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Card Compacto de Arquivo Selecionado em Linha Única */}
              {(() => {
                const lowerName = selectedFile.name.toLowerCase();
                const isPfx = /\.(pfx|p12|cer|crt|key)$/i.test(lowerName);
                const isPdf = selectedFile.type.includes('pdf') || /\.pdf$/i.test(lowerName);
                const isImg = selectedFile.type.includes('image') || /\.(webp|png|jpe?g|bmp|gif|svg)$/i.test(lowerName);
                const isSpreadsheet = /\.(xlsx|xls|csv|ods)$/i.test(lowerName);
                const isXml = /\.(xml|nfe|cte|sped|ofx|rem|ret)$/i.test(lowerName);
                const isZip = /\.(zip|rar|7z|tar|gz)$/i.test(lowerName);

                return (
                  <div className="bg-slate-100 border border-slate-300 rounded-xl p-3 flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center space-x-3 min-w-0 overflow-hidden">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs ${
                        isPfx ? 'bg-purple-700' :
                        isPdf ? 'bg-rose-700' :
                        isImg ? 'bg-blue-700' :
                        isSpreadsheet ? 'bg-emerald-700' :
                        isXml ? 'bg-amber-700' :
                        isZip ? 'bg-teal-700' : 'bg-[#1B357B]'
                      }`}>
                        {isPfx ? <KeyRound className="w-5 h-5" /> :
                         isPdf ? <FileText className="w-5 h-5" /> :
                         isImg ? <ImageIcon className="w-5 h-5" /> :
                         isSpreadsheet ? <FileSpreadsheet className="w-5 h-5" /> :
                         isXml ? <FileCode className="w-5 h-5" /> :
                         isZip ? <FileArchive className="w-5 h-5" /> :
                         <FileGenericIcon className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0 overflow-hidden">
                        <h4 className="text-xs font-bold text-slate-950 truncate" title={selectedFile.name}>
                          {selectedFile.name}
                        </h4>
                        <p className="text-xs font-semibold text-slate-600">
                          {formatBytes(selectedFile.size)}
                        </p>
                      </div>
                    </div>

                    {!isProcessing && (
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-xs font-black text-[#1B357B] hover:text-blue-800 underline transition-colors shrink-0 px-2 py-1 cursor-pointer"
                      >
                        Trocar Arquivo
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Nome do Documento para Renomear */}
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1.5">
                  Nome do Documento (personalizável se desejar renomear)
                </label>
                <input
                  type="text"
                  disabled={isProcessing}
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  placeholder="Nome do arquivo..."
                  className="w-full h-9 sm:h-10 px-3 text-xs text-slate-950 bg-white border border-slate-300 rounded-xl focus:border-[#1B357B] focus:ring-1 focus:ring-[#1B357B] outline-none transition-all font-bold placeholder:text-slate-500 shadow-2xs"
                />
              </div>

              {/* Tags Compactas */}
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1.5">Tags do Documento</label>
                <div className="flex flex-wrap gap-1.5 p-2 border border-slate-300 rounded-xl bg-slate-50 min-h-[38px] items-center">
                  {tags.map(tag => (
                    <span key={tag} className="bg-white text-slate-950 border border-slate-300 text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 font-bold shadow-2xs">
                      #{tag}
                      {!isProcessing && (
                        <button 
                          type="button"
                          onClick={() => handleRemoveTag(tag)} 
                          className="text-slate-500 hover:text-slate-950 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                  {!isProcessing && (
                    <input
                      type="text"
                      placeholder="Adicionar tag e pressione Enter..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      className="text-xs outline-none flex-1 min-w-[130px] bg-transparent text-slate-950 font-bold placeholder:text-slate-500 px-1"
                    />
                  )}
                </div>
              </div>

              {/* Status do Processamento */}
              {isProcessing && optimizationStage !== 'finished' && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#1B357B] animate-spin" />
                      <span className="text-[11px]">Processando e gravando no R2...</span>
                    </span>
                    <span className="text-[11px] font-mono">{uploadProgress > 0 ? `${uploadProgress}%` : '...'}</span>
                  </div>

                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-300 bg-[#1B357B]"
                      style={{ 
                        width: optimizationStage === 'optimizing' ? '30%' :
                                optimizationStage === 'requesting-url' ? '60%':
                                `${Math.max(10, uploadProgress)}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Sucesso */}
              {optimizationStage === 'finished' && (
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs py-2 px-3 rounded-xl flex items-center gap-2 font-medium animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>✓ Documento gravado e indexado com sucesso!</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé Fixo com Ações */}
        <div className="p-3 sm:p-4 border-t border-slate-100 flex items-center justify-end space-x-2 shrink-0 bg-slate-50/50">
          <button
            type="button"
            disabled={isProcessing && optimizationStage !== 'finished'}
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 text-xs font-medium px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {isQuotaExceeded ? (
            <div 
              className="px-3 py-2 bg-rose-100 text-rose-800 rounded-xl text-xs font-bold flex items-center space-x-1.5"
              title="Armazenamento 100% atingido. Contate o suporte de TI (21) 97396-0077."
            >
              <AlertOctagon className="w-4 h-4 text-rose-600" />
              <span>Upload Bloqueado</span>
            </div>
          ) : !selectedFile ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#1B357B] hover:bg-[#112354] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              Selecionar Arquivo
            </button>
          ) : !isProcessing && (
            <button
              id="start-pipeline-btn"
              type="button"
              onClick={handleExecutePipeline}
              className="bg-[#1B357B] hover:bg-[#112354] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Concluir Upload</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#C59B4B]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

