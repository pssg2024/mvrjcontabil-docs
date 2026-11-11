import React, { useState, useRef, useMemo } from 'react';
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
  Calendar,
  KeyRound,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  File as FileGenericIcon,
  ChevronDown,
  ChevronUp,
  FolderUp,
  Folder
} from 'lucide-react';
import { Folder as FolderType, DocumentFile, Sector, UserProfile, StorageMetrics } from '../types';
import { optimizeFile, formatBytes, computeChecksum } from '../lib/optimization';
import { getPresignedUploadUrl, uploadToPresignedUrl, saveFileRecordToApi, createFolderInApi } from '../lib/storage-service';

/**
 * Recursively extracts all files and directory structure from a drag-and-drop event
 * using the HTML5 File System Directory Entry API.
 */
async function getFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<{ files: File[]; rootFolderName: string | null }> {
  const items = dataTransfer.items;
  let rootFolderName: string | null = null;
  const files: File[] = [];

  if (items && items.length > 0) {
    const queue: { entry: any; currentPath: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          if (entry.isDirectory && !rootFolderName) {
            rootFolderName = entry.name;
          }
          queue.push({ entry, currentPath: '' });
        }
      }
    }

    while (queue.length > 0) {
      const { entry, currentPath } = queue.shift()!;
      if (entry.isFile) {
        await new Promise<void>((resolve) => {
          entry.file((file: File) => {
            if (!file.name.startsWith('.')) {
              const relPath = currentPath ? `${currentPath}/${file.name}` : file.name;
              try {
                Object.defineProperty(file, 'webkitRelativePath', {
                  value: relPath,
                  writable: true,
                  configurable: true,
                });
              } catch {
                (file as any).webkitRelativePath = relPath;
              }
              files.push(file);
            }
            resolve();
          }, () => resolve());
        });
      } else if (entry.isDirectory) {
        const dirPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        const dirReader = entry.createReader();

        const readAllEntries = async (): Promise<any[]> => {
          const allEntries: any[] = [];
          const readBatch = async (): Promise<void> => {
            const batch: any[] = await new Promise((res) => dirReader.readEntries(res, () => res([])));
            if (batch && batch.length > 0) {
              allEntries.push(...batch);
              await readBatch();
            }
          };
          await readBatch();
          return allEntries;
        };

        const children = await readAllEntries();
        for (const child of children) {
          queue.push({ entry: child, currentPath: dirPath });
        }
      }
    }
  }

  if (files.length === 0 && dataTransfer.files.length > 0) {
    return { files: Array.from(dataTransfer.files), rootFolderName: null };
  }

  return { files, rootFolderName };
}

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFolder: FolderType | null;
  allFolders: FolderType[];
  currentUser: UserProfile;
  onUploadSuccess: (newFile: DocumentFile) => void;
  onFolderCreated?: (newFolder: FolderType) => void;
  storageMetrics?: StorageMetrics | null;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  currentFolder,
  allFolders,
  currentUser,
  onUploadSuccess,
  onFolderCreated,
  storageMetrics,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [folderUploadName, setFolderUploadName] = useState<string | null>(null);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(1);
  const [customFileName, setCustomFileName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    currentFolder ? currentFolder.id : (allFolders[0]?.id || '')
  );

  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['Contábil', '2026']);

  // Pipeline execution state
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimizationStage, setOptimizationStage] = useState<'idle' | 'optimizing' | 'requesting-url' | 'uploading-r2' | 'finished'>('idle');
  const [pipelineStatusText, setPipelineStatusText] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setSelectedFiles([]);
    setFolderUploadName(null);
    setCurrentUploadIndex(1);
    setCustomFileName('');
    setTags(['Contábil', '2026']);
    setTagInput('');
    setIsProcessing(false);
    setOptimizationStage('idle');
    setPipelineStatusText('');
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

  // Detected subfolders structure summary for visual user feedback
  const subfolderSummary = useMemo(() => {
    if (!folderUploadName || selectedFiles.length === 0) return [];
    const paths = new Set<string>();
    for (const file of selectedFiles) {
      const rel = ((file as any).webkitRelativePath || '').replace(/\\/g, '/');
      const parts = rel.split('/').filter(Boolean);
      if (parts.length > 2) {
        // e.g. PastaPai/SubpastaA/arquivo.pdf => subpath is SubpastaA
        const subPath = parts.slice(1, parts.length - 1).join(' / ');
        if (subPath) paths.add(subPath);
      }
    }
    return Array.from(paths);
  }, [folderUploadName, selectedFiles]);

  if (!isOpen) return null;

  const targetFolder = accessibleFolders.find(f => f.id === selectedFolderId) || (selectedFolderId === 'root' ? null : (currentFolder || accessibleFolders[0] || allFolders[0] || null));
  const effectiveSector: Sector = targetFolder?.sector || currentFolder?.sector || (currentUser?.sector as Sector) || 'Contábil';
  const defaultParentId: string | null = targetFolder?.id || currentFolder?.id || null;

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const { files, rootFolderName } = await getFilesFromDataTransfer(e.dataTransfer);
    if (!files || files.length === 0) return;

    if (files.length === 1 && !rootFolderName && !(files[0] as any).webkitRelativePath?.includes('/')) {
      handleFileSelected(files[0]);
    } else {
      setSelectedFiles(files);
      const fName = rootFolderName || 'Pasta Importada';
      setFolderUploadName(fName);
      setCustomFileName(fName);
      setOptimizationStage('idle');
      setErrorMessage(null);

      const newTagsSet = new Set(tags);
      if (effectiveSector && !newTagsSet.has(effectiveSector)) {
        newTagsSet.add(effectiveSector);
      }
      if (fName && !newTagsSet.has(fName)) {
        newTagsSet.add(fName);
      }
      setTags(Array.from(newTagsSet));
    }
  };

  const handleFileSelected = (file: File) => {
    setSelectedFiles([file]);
    setFolderUploadName(null);
    setCustomFileName(file.name);
    setOptimizationStage('idle');
    setErrorMessage(null);

    if (effectiveSector && !tags.includes(effectiveSector)) {
      setTags(prev => [...prev, effectiveSector]);
    }
  };

  const handleFolderSelected = (fileList: FileList) => {
    const filesArray = Array.from(fileList).filter((f: any) => {
      if (f.name.startsWith('.')) return false;
      if (f.size === 0 && (!f.type || f.webkitRelativePath?.endsWith('/'))) return false;
      return true;
    }) as File[];

    if (filesArray.length === 0) {
      setErrorMessage('A pasta selecionada está vazia ou não contém arquivos válidos.');
      return;
    }

    let fName = 'Pasta Importada';
    const firstPath = (filesArray[0] as any).webkitRelativePath;
    if (firstPath) {
      const parts = firstPath.replace(/\\/g, '/').split('/').filter(Boolean);
      if (parts.length > 1) {
        fName = parts[0];
      }
    }

    setSelectedFiles(filesArray);
    setFolderUploadName(fName);
    setCustomFileName(fName);
    setOptimizationStage('idle');
    setErrorMessage(null);

    const newTagsSet = new Set(tags);
    if (effectiveSector && !newTagsSet.has(effectiveSector)) {
      newTagsSet.add(effectiveSector);
    }
    if (fName && !newTagsSet.has(fName)) {
      newTagsSet.add(fName);
    }
    setTags(Array.from(newTagsSet));
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
    if (selectedFiles.length === 0) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);

      const totalFiles = selectedFiles.length;
      const knownFolders: FolderType[] = [...allFolders];
      const folderPathToIdMap = new Map<string, string>(); // maps "seg1/seg2/seg3" -> folderId

      // 1. Collect all unique folder paths and pre-create them hierarchically
      const allFolderPaths = new Set<string>();
      for (const file of selectedFiles) {
        const fullRelPath = ((file as any).webkitRelativePath || '').replace(/\\/g, '/');
        if (fullRelPath) {
          const parts = fullRelPath.split('/').filter(Boolean);
          if (parts.length > 1) {
            const folderSegments = parts.slice(0, parts.length - 1);
            if (folderUploadName && customFileName.trim() && folderSegments.length > 0) {
              folderSegments[0] = customFileName.trim();
            }
            let cumPath = '';
            for (const seg of folderSegments) {
              const segName = seg.trim();
              if (!segName) continue;
              cumPath = cumPath ? `${cumPath}/${segName}` : segName;
              allFolderPaths.add(cumPath);
            }
          }
        }
      }

      // Sort paths by segment depth so parent folders are created before child folders
      const sortedPaths = Array.from(allFolderPaths).sort((a, b) => a.split('/').length - b.split('/').length);

      for (const pathStr of sortedPaths) {
        const segments = pathStr.split('/');
        const segName = segments[segments.length - 1];
        const parentPath = segments.slice(0, segments.length - 1).join('/');
        const currentParentId = parentPath ? (folderPathToIdMap.get(parentPath) || defaultParentId) : defaultParentId;

        setPipelineStatusText(`Criando pasta "${segName}"...`);
        let existing = knownFolders.find(f => 
          f.name.trim().toLowerCase() === segName.toLowerCase() &&
          (f.parent_id === currentParentId || (!f.parent_id && !currentParentId)) &&
          f.sector === effectiveSector
        );

        const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `fold-${Date.now()}-${Math.random()}`;

        if (!existing) {
          try {
            const created = await createFolderInApi(
              segName,
              currentParentId,
              effectiveSector,
              currentUser?.id || 'admin',
              newId
            );
            existing = (created && created.id) ? created : {
              id: newId,
              parent_id: currentParentId,
              name: segName,
              sector: effectiveSector,
              created_by: currentUser?.id || 'admin',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          } catch (folderErr) {
            console.warn('Aviso ao criar pasta na API (usando fallback local):', folderErr);
            existing = {
              id: newId,
              parent_id: currentParentId,
              name: segName,
              sector: effectiveSector,
              created_by: currentUser?.id || 'admin',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          }
          knownFolders.push(existing);
          if (onFolderCreated) {
            onFolderCreated(existing);
          }
        }

        folderPathToIdMap.set(pathStr, existing.id);
      }

      // 2. Upload all files sequentially with per-file resilient error handling and progress updates
      for (let i = 0; i < totalFiles; i++) {
        const currentFile = selectedFiles[i];
        const fileIndex = i;
        setCurrentUploadIndex(fileIndex + 1);

        const fullRelPath = ((currentFile as any).webkitRelativePath || '').replace(/\\/g, '/');
        let destinationFolderId: string = defaultParentId || 'root';
        let cleanDocName = currentFile.name;

        if (fullRelPath) {
          const parts = fullRelPath.split('/').filter(Boolean);
          if (parts.length > 1) {
            cleanDocName = parts[parts.length - 1];
            const folderSegments = parts.slice(0, parts.length - 1);
            if (folderUploadName && customFileName.trim() && folderSegments.length > 0) {
              folderSegments[0] = customFileName.trim();
            }
            const pathStr = folderSegments.join('/');
            if (folderPathToIdMap.has(pathStr)) {
              destinationFolderId = folderPathToIdMap.get(pathStr)!;
            }
          }
        } else if (selectedFiles.length === 1 && customFileName.trim()) {
          cleanDocName = customFileName.trim();
        }

        let finalName = cleanDocName;
        const dotIndex = currentFile.name.lastIndexOf('.');
        if (dotIndex >= 0) {
          const ext = currentFile.name.substring(dotIndex);
          if (ext && !finalName.toLowerCase().endsWith(ext.toLowerCase())) {
            finalName += ext;
          }
        }

        try {
          // ETAPA 1: OTIMIZAÇÃO AUTOMÁTICA (PDF ou IMAGEM)
          setOptimizationStage('optimizing');
          setPipelineStatusText(`Otimizando "${finalName}" (${fileIndex + 1} de ${totalFiles})...`);
          const optResult = await optimizeFile(currentFile);
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
          setPipelineStatusText(`Preparando envio de "${finalName}"...`);
          const presignedData = await getPresignedUploadUrl(
            finalName,
            optResult.mimeType,
            effectiveSector,
            destinationFolderId,
            optResult.optimizedSize
          );

          // ETAPA 3: UPLOAD DIRETO PARA CLOUDFLARE R2
          setOptimizationStage('uploading-r2');
          setPipelineStatusText(`Enviando "${finalName}" (${fileIndex + 1}/${totalFiles})...`);
          await uploadToPresignedUrl(
            presignedData.uploadUrl,
            optResult.file,
            optResult.mimeType,
            (progress) => {
              const filePct = Math.round(((fileIndex + (progress / 100)) / totalFiles) * 100);
              setUploadProgress(filePct);
            },
            presignedData.storageKey,
            finalName
          );

          const overallPct = Math.round(((fileIndex + 1) / totalFiles) * 100);
          setUploadProgress(overallPct);

          // ETAPA 4: SUCESSO & REGISTRO NO GED & SUPABASE
          const tempDoc: DocumentFile = {
            id: `file-${Date.now()}-${fileIndex}`,
            folder_id: destinationFolderId,
            name: finalName,
            storage_key: presignedData.storageKey,
            mime_type: optResult.mimeType,
            original_size: stats.originalSize,
            optimized_size: stats.optimizedSize,
            compression_ratio: stats.reductionPercentage,
            pages_count: stats.pagesCount,
            tags,
            uploaded_by: currentUser?.id || 'admin',
            uploader_name: currentUser?.full_name || 'Administrador',
            sector: effectiveSector,
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
            console.warn('Aviso ao registrar documento na API (mantido localmente):', dbErr);
          }

          onUploadSuccess(finalDoc);
        } catch (fileErr: any) {
          console.error(`Erro ao processar/enviar arquivo ${finalName}:`, fileErr);
          // Continua enviando os demais arquivos da pasta sem travar o upload inteiro
        }
      }

      setOptimizationStage('finished');
      setPipelineStatusText(`Concluído! ${totalFiles} arquivo(s) gravado(s) no GED.`);

      // Notifica sucesso após concluir todos os arquivos da pasta ou arquivo único
      setTimeout(() => {
        onClose();
        resetForm();
      }, 1000);

    } catch (err: any) {
      console.error('Falha no pipeline de upload:', err);
      setErrorMessage(err.message || 'Erro durante o processamento do documento.');
      setIsProcessing(false);
      setOptimizationStage('idle');
      setPipelineStatusText('');
    }
  };

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
                Upload de Documentos ou Pasta Inteira
              </h3>
              <p className="text-slate-500 text-[10px] sm:text-xs truncate">
                Arquivos individuais ou pastas com múltiplos documentos
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
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start justify-between gap-2 shadow-2xs">
              <div className="flex items-start space-x-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="break-words font-medium">{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={handleExecutePipeline}
                className="shrink-0 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Seletor de Pasta de Destino Unificado com opção Raiz */}
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
                <option value="root">📁 Raiz do GED (Diretório Principal)</option>
                {accessibleFolders.map(folder => (
                  <option key={folder.id} value={folder.id}>
                    {folder.sector} » {folder.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dropzone ou Card do Arquivo/Pasta Selecionado */}
          {selectedFiles.length === 0 ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className="border-2 border-dashed border-slate-300 hover:border-[#1B357B] bg-slate-50 hover:bg-slate-100/80 rounded-xl p-5 sm:p-6 transition-all flex flex-col items-center justify-center text-center group shadow-2xs"
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
              <input
                ref={folderInputRef}
                type="file"
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFolderSelected(e.target.files);
                  }
                }}
              />

              <UploadCloud className="text-[#1B357B] group-hover:scale-110 transition-transform w-9 h-9 mb-2" />
              <p className="text-xs font-bold text-slate-950">Arraste seus documentos ou pasta inteira aqui</p>
              <p className="text-xs font-semibold text-slate-600 mt-1 mb-3">PDFs, Imagens, XMLs, Planilhas ou Pastas completas</p>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 bg-[#1B357B] hover:bg-[#112354] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Selecionar Arquivo(s)</span>
                </button>
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <FolderUp className="w-3.5 h-3.5" />
                  <span>Puxar Pasta Inteira</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Card de Pasta Inteira ou Arquivo Único */}
              {folderUploadName ? (
                <>
                  <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center space-x-3 min-w-0 overflow-hidden">
                      <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Folder className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 overflow-hidden">
                        <h4 className="text-xs font-bold text-slate-950 truncate" title={folderUploadName}>
                          Pasta: {folderUploadName}
                        </h4>
                        <p className="text-xs font-semibold text-emerald-800">
                          {selectedFiles.length} documento{selectedFiles.length > 1 ? 's' : ''} pronto{selectedFiles.length > 1 ? 's' : ''} para envio
                        </p>
                      </div>
                    </div>

                    {!isProcessing && (
                      <button
                        type="button"
                        onClick={() => setSelectedFiles([])}
                        className="text-xs font-black text-emerald-900 hover:text-emerald-950 underline transition-colors shrink-0 px-2 py-1 cursor-pointer"
                      >
                        Trocar Pasta
                      </button>
                    )}
                  </div>

                  {/* Detalhes de Subpastas Detectadas Automaticamente */}
                  {subfolderSummary.length > 0 && (
                    <div className="bg-blue-50/90 border border-blue-200/90 rounded-xl p-3 text-xs text-blue-900 shadow-2xs space-y-1.5 animate-in fade-in duration-150">
                      <div className="flex items-center gap-1.5 font-bold text-blue-950">
                        <FolderTree className="w-4 h-4 text-blue-700 shrink-0" />
                        <span>{subfolderSummary.length} subpasta{subfolderSummary.length > 1 ? 's' : ''} interna{subfolderSummary.length > 1 ? 's' : ''} identificada{subfolderSummary.length > 1 ? 's' : ''}:</span>
                      </div>
                      <p className="text-[11px] text-blue-800 leading-relaxed">
                        Todas as subpastas serão <strong>criadas automaticamente</strong> no GED e os documentos serão indexados organizadamente dentro de cada uma delas!
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5 max-h-24 overflow-y-auto">
                        {subfolderSummary.map((sp, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 bg-white border border-blue-200 px-2 py-0.5 rounded-md font-mono text-[10px] text-blue-950 shadow-2xs font-semibold">
                            📁 {sp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                (() => {
                  const selectedFile = selectedFiles[0];
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
                          onClick={() => setSelectedFiles([])}
                          className="text-xs font-black text-[#1B357B] hover:text-blue-800 underline transition-colors shrink-0 px-2 py-1 cursor-pointer"
                        >
                          Trocar Arquivo
                        </button>
                      )}
                    </div>
                  );
                })()
              )}

              {/* Nome do Documento para Renomear (apenas se for arquivo único) */}
              {!folderUploadName && selectedFiles.length === 1 && (
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
              )}

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
                    <span className="flex items-center space-x-1.5 min-w-0">
                      <Sparkles className="w-3.5 h-3.5 text-[#1B357B] animate-spin shrink-0" />
                      <span className="text-[11px] truncate font-medium text-slate-800">
                        {pipelineStatusText || (selectedFiles.length > 1 
                          ? `Enviando arquivo ${currentUploadIndex} de ${selectedFiles.length}...`
                          : 'Processando e gravando no Cloudflare R2...')}
                      </span>
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
                  <span>✓ {selectedFiles.length > 1 ? 'Pasta e documentos gravados com sucesso!' : 'Documento gravado e indexado com sucesso!'}</span>
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

          {selectedFiles.length === 0 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#1B357B] hover:bg-[#112354] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Selecionar Arquivo
              </button>
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <FolderUp className="w-3.5 h-3.5" />
                <span>Puxar Pasta</span>
              </button>
            </div>
          ) : !isProcessing && (
            <button
              id="start-pipeline-btn"
              type="button"
              onClick={handleExecutePipeline}
              className="bg-[#1B357B] hover:bg-[#112354] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>{folderUploadName ? `Enviar Pasta (${selectedFiles.length} arquivos)` : 'Concluir Upload'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#C59B4B]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


