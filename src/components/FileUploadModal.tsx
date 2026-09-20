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
  HardDrive,
  AlertOctagon,
  Phone,
  Calendar,
  KeyRound,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  File as FileGenericIcon
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

  const resetForm = () => {
    setSelectedFile(null);
    setDueDate('');
    setCompanyName('');
    setClientPhone('');
    setDocumentType('');
    setAmount('');
    setTags(['Contábil', '2026']);
    setTagInput('');
    setIsProcessing(false);
    setOptimizationStage('idle');
    setUploadProgress(0);
    setErrorMessage(null);
  };

  React.useEffect(() => {
    if (isOpen) {
      if (currentFolder?.id) {
        setSelectedFolderId(currentFolder.id);
      } else if (allFolders.length > 0 && !allFolders.some(f => f.id === selectedFolderId)) {
        setSelectedFolderId(allFolders[0].id);
      }
    } else {
      resetForm();
    }
  }, [isOpen, currentFolder, allFolders]);

  const [dueDate, setDueDate] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [documentType, setDocumentType] = useState('DAS - Simples Nacional');
  const [amount, setAmount] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['Contábil', '2026']);

  // Pipeline execution state
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimizationStage, setOptimizationStage] = useState<'idle' | 'optimizing' | 'requesting-url' | 'uploading-r2' | 'finished'>('idle');
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
        due_date: dueDate || undefined,
        company_name: companyName.trim() || undefined,
        client_phone: clientPhone.trim() || undefined,
        document_type: documentType.trim() || undefined,
        amount: amount ? parseFloat(amount) : undefined,
        notification_sent: false,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-5 sm:p-6">
        
        {/* Header */}
        <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-[#1B357B]/10 text-[#1B357B] p-2.5 rounded-xl shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-slate-900 font-bold text-base leading-tight">Upload de Documentos & Certificados</h3>
              <p className="text-slate-500 text-xs mt-0.5">Aceita qualquer formato: Certificados (PFX, P12), PDFs, Imagens, XMLs e Planilhas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing && optimizationStage !== 'finished'}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="pt-4 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Folder Target Selector & Competence */}
          <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pasta de Destino no GED</label>
              <div className="relative">
                <FolderTree className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <select
                  disabled={isProcessing}
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="w-full py-2.5 px-3.5 pl-9 text-xs text-slate-700 bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1B357B] focus:ring-2 focus:ring-[#1B357B]/15 outline-none transition-all font-medium"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Data de Vencimento</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="date"
                  disabled={isProcessing}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full py-2.5 px-3.5 pl-9 text-xs text-slate-700 bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1B357B] focus:ring-2 focus:ring-[#1B357B]/15 outline-none transition-all font-medium"
                />
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
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-700 font-medium">
                <span className="flex items-center space-x-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="font-semibold text-slate-800">Capacidade do Sistema:</span>
                </span>
                <span className="text-[11px] text-[#C59B4B] font-bold">
                  {(storageMetrics.remainingFilesCapacity ?? (10000 - storageMetrics.filesCount)).toLocaleString('pt-BR')} vagas para documentos
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Documentos: <strong className="text-slate-700 font-semibold">{storageMetrics.filesCount.toLocaleString('pt-BR')}</strong> / {(storageMetrics.maxFilesCapacity || 10000).toLocaleString('pt-BR')}</span>
                <span>Espaço Livre: <strong className="text-slate-700 font-semibold">{formatBytes(storageMetrics.freeBytes || (storageMetrics.totalCapacityBytes - storageMetrics.usedBytes))}</strong></span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-[#C59B4B] to-[#E2B963]"
                  style={{ 
                    width: `${Math.max(2, storageMetrics.usedPercent)}%`
                  }}
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
              className="border-2 border-dashed border-slate-200 hover:border-[#C59B4B] bg-slate-50/50 hover:bg-[#C59B4B]/5 rounded-2xl p-6 transition-all cursor-pointer flex flex-col items-center justify-center text-center group"
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
              <UploadCloud className="text-[#C59B4B] group-hover:scale-110 transition-transform w-10 h-10 mb-2" />
              <p className="text-xs font-semibold text-slate-800">Clique para selecionar ou arraste o arquivo aqui</p>
              <p className="text-[11px] text-slate-400 mt-1">Formatos suportados: PDFs, Imagens, XMLs, Planilhas e Certificados Digitais</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected File Card */}
              {(() => {
                const lowerName = selectedFile.name.toLowerCase();
                const isPfx = /\.(pfx|p12|cer|crt|key)$/i.test(lowerName);
                const isPdf = selectedFile.type.includes('pdf') || /\.pdf$/i.test(lowerName);
                const isImg = selectedFile.type.includes('image') || /\.(webp|png|jpe?g|bmp|gif|svg)$/i.test(lowerName);
                const isSpreadsheet = /\.(xlsx|xls|csv|ods)$/i.test(lowerName);
                const isXml = /\.(xml|nfe|cte|sped|ofx|rem|ret)$/i.test(lowerName);
                const isZip = /\.(zip|rar|7z|tar|gz)$/i.test(lowerName);

                return (
                  <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className={`p-2.5 rounded-xl shadow-xs text-white shrink-0 ${
                        isPfx ? 'bg-purple-600' :
                        isPdf ? 'bg-rose-600' :
                        isImg ? 'bg-blue-600' :
                        isSpreadsheet ? 'bg-emerald-600' :
                        isXml ? 'bg-amber-600' :
                        isZip ? 'bg-teal-600' : 'bg-[#1B357B]'
                      }`}>
                        {isPfx ? <KeyRound className="w-5 h-5" /> :
                         isPdf ? <FileText className="w-5 h-5" /> :
                         isImg ? <ImageIcon className="w-5 h-5" /> :
                         isSpreadsheet ? <FileSpreadsheet className="w-5 h-5" /> :
                         isXml ? <FileCode className="w-5 h-5" /> :
                         isZip ? <FileArchive className="w-5 h-5" /> :
                         <FileGenericIcon className="w-5 h-5" />}
                      </div>
                      <div className="overflow-hidden">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-semibold text-slate-800 truncate max-w-[180px] sm:max-w-xs">{selectedFile.name}</h4>
                          {isPfx && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                              Certificado
                            </span>
                          )}
                          {isXml && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                              XML
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">Tamanho: <strong className="text-slate-600">{formatBytes(selectedFile.size)}</strong></p>
                      </div>
                    </div>

                    {!isProcessing && (
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="text-xs font-medium text-[#1B357B] hover:text-[#C59B4B] hover:underline transition-colors shrink-0 ml-2"
                      >
                        Trocar Arquivo
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Metadados Contábeis & Vencimento (Central de Disparos MVRJ) */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#1B357B] uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#C59B4B]" />
                    <span>Dados de Vencimento & Notificação (Opcional)</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Integração WhatsApp</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Empresa / Cliente</label>
                    <input
                      type="text"
                      placeholder="Ex: Alfa Comércio Ltda"
                      value={companyName}
                      disabled={isProcessing}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#1B357B]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">WhatsApp Cliente (com DDD)</label>
                    <input
                      type="text"
                      placeholder="Ex: (21) 97396-0077"
                      value={clientPhone}
                      disabled={isProcessing}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#1B357B]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tipo de Guia / Documento</label>
                    <select
                      value={documentType}
                      disabled={isProcessing}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-hidden focus:border-[#1B357B]"
                    >
                      <option value="DAS - Simples Nacional">DAS - Simples Nacional</option>
                      <option value="DARF Previdenciário">DARF Previdenciário</option>
                      <option value="DARF IRPJ / CSLL">DARF IRPJ / CSLL</option>
                      <option value="FGTS Digital">FGTS Digital</option>
                      <option value="GPS - Previdência">GPS - Previdência Social</option>
                      <option value="Honorários Contábeis">Honorários Contábeis</option>
                      <option value="Boleto Bancário">Boleto Bancário</option>
                      <option value="Declaração Anual">Declaração Anual</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Vencimento</label>
                      <input
                        type="date"
                        value={dueDate}
                        disabled={isProcessing}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full text-xs px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-hidden focus:border-[#1B357B]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Valor (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={amount}
                        disabled={isProcessing}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full text-xs px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#1B357B]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tags do Documento</label>
                <div className="flex flex-wrap gap-1.5 p-2 border border-slate-200 rounded-xl bg-slate-50/50 min-h-[38px] items-center">
                  {tags.map(tag => (
                    <span key={tag} className="bg-slate-100 text-slate-700 border border-slate-200 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium">
                      #{tag}
                      {!isProcessing && (
                        <button onClick={() => handleRemoveTag(tag)} className="ml-1 text-slate-400 hover:text-slate-700">
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
                      className="text-xs outline-hidden flex-1 min-w-[120px] bg-transparent text-slate-700 placeholder:text-slate-400"
                    />
                  )}
                </div>
              </div>

              {/* Processing Progress Status */}
              {isProcessing && optimizationStage !== 'finished' && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-[#1B357B] animate-spin" />
                      <span>A processar e armazenar documento no Cloudflare R2...</span>
                    </span>
                    <span>{uploadProgress > 0 ? `${uploadProgress}%` : 'A processar...'}</span>
                  </div>

                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-300"
                      style={{ 
                        backgroundColor: '#1B357B',
                        width: optimizationStage === 'optimizing' ? '30%' :
                                optimizationStage === 'requesting-url' ? '60%':
                                `${Math.max(10, uploadProgress)}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Success Badge after completion */}
              {optimizationStage === 'finished' && (
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs py-2 px-3 rounded-xl flex items-center gap-2 font-medium animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>✓ Documento guardado e indexado com sucesso!</span>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              disabled={isProcessing && optimizationStage !== 'finished'}
              onClick={onClose}
              className="text-slate-500 hover:text-slate-800 text-xs font-medium px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>

            {isQuotaExceeded ? (
              <div 
                className="px-4 py-2.5 bg-rose-100 text-rose-800 rounded-xl text-xs font-bold flex items-center space-x-1.5"
                title="Armazenamento 100% atingido. Contate o suporte de TI (21) 97396-0077."
              >
                <AlertOctagon className="w-4 h-4 text-rose-600" />
                <span>Upload Bloqueado (Limite Atingido)</span>
              </div>
            ) : !selectedFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#1B357B] hover:bg-[#112354] text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all"
              >
                Selecionar Arquivo
              </button>
            ) : !isProcessing && (
              <button
                id="start-pipeline-btn"
                type="button"
                onClick={handleExecutePipeline}
                className="bg-[#1B357B] hover:bg-[#112354] text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all"
              >
                <span>Otimizar e Salvar Documento</span>
                <ArrowRight className="w-4 h-4 text-[#C59B4B]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
