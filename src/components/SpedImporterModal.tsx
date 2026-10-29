import React, { useState, useRef, useMemo } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Calendar, 
  ShieldCheck, 
  Database, 
  Cloud, 
  ArrowRight, 
  Loader2, 
  FolderTree, 
  FileCode2, 
  Check, 
  Sparkles,
  Eye,
  Download,
  FolderOpen
} from 'lucide-react';
import { Folder as FolderType, DocumentFile, UserProfile, Sector } from '../types';

export interface SpedImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  allFolders: FolderType[];
  currentUser: UserProfile;
  onUploadSuccess: (newFile: DocumentFile) => void;
  onOpenFileViewer?: (file: DocumentFile) => void;
  onNavigateToFolder?: (folderId: string) => void;
}

export interface SpedHeaderParsed {
  isSped: boolean;
  companyName?: string;
  cnpj?: string;
  formattedCnpj?: string;
  periodStart?: string;
  periodEnd?: string;
  uf?: string;
  ie?: string;
  layoutVersion?: string;
  finality?: string;
  totalLines?: number;
  blocksFound?: string[];
  rawHeaderLine?: string;
}

export const SpedImporterModal: React.FC<SpedImporterModalProps> = ({
  isOpen,
  onClose,
  allFolders,
  currentUser,
  onUploadSuccess,
  onOpenFileViewer,
  onNavigateToFolder,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedSped, setParsedSped] = useState<SpedHeaderParsed | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileResult, setUploadedFileResult] = useState<any | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Formata CNPJ
  const formatCnpj = (cnpjRaw?: string) => {
    if (!cnpjRaw) return '';
    const clean = cnpjRaw.replace(/\D/g, '');
    if (clean.length === 14) {
      return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return cnpjRaw;
  };

  // Formata data SPED DDMMAAAA -> DD/MM/AAAA
  const formatSpedDate = (dateStr?: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr || '';
    return `${dateStr.slice(0, 2)}/${dateStr.slice(2, 4)}/${dateStr.slice(4, 8)}`;
  };

  // Pastas do setor Fiscal
  const fiscalFolders = useMemo(() => {
    return allFolders.filter(f => f.sector === 'Fiscal');
  }, [allFolders]);

  // Analisa o arquivo SPED localmente no navegador em milissegundos
  const analyzeSpedFile = (file: File) => {
    setIsReadingFile(true);
    setUploadError(null);
    setUploadedFileResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = (e.target?.result as string) || '';
        const lines = text.split(/\r?\n/);
        let headerLine = '';
        let foundSped = false;
        let companyName: string | undefined;
        let cnpj: string | undefined;
        let dtIni: string | undefined;
        let dtFin: string | undefined;
        let uf: string | undefined;
        let ie: string | undefined;
        let codVer: string | undefined;
        let codFin: string | undefined;
        const blocksSet = new Set<string>();

        for (let i = 0; i < Math.min(lines.length, 100); i++) {
          const line = lines[i].trim();
          if (line.startsWith('|0000|')) {
            foundSped = true;
            headerLine = line;
            const parts = line.split('|');
            codVer = parts[2]?.trim();
            codFin = parts[3]?.trim();
            dtIni = parts[4]?.trim();
            dtFin = parts[5]?.trim();
            companyName = parts[6]?.trim();
            cnpj = parts[7]?.trim();
            uf = parts[8]?.trim();
            ie = parts[9]?.trim();
            break;
          }
        }

        // Identifica blocos principais presentes no arquivo
        for (const line of lines) {
          if (line.length >= 3 && line.startsWith('|')) {
            const char = line.charAt(1);
            if (['0', 'B', 'C', 'D', 'E', 'G', 'H', 'K', '1', '9'].includes(char)) {
              blocksSet.add(`Bloco ${char}`);
            }
          }
        }

        const parsedData: SpedHeaderParsed = {
          isSped: foundSped,
          companyName: companyName || undefined,
          cnpj: cnpj || undefined,
          formattedCnpj: formatCnpj(cnpj),
          periodStart: formatSpedDate(dtIni),
          periodEnd: formatSpedDate(dtFin),
          uf: uf || undefined,
          ie: ie || undefined,
          layoutVersion: codVer ? `Versão ${codVer}` : undefined,
          finality: codFin === '0' ? 'Remessa do Arquivo Original' : (codFin === '1' ? 'Remessa do Arquivo Substituto' : undefined),
          totalLines: lines.length,
          blocksFound: Array.from(blocksSet),
          rawHeaderLine: headerLine || undefined,
        };

        setParsedSped(parsedData);

        // Auto-seleciona a melhor pasta fiscal com base no nome da empresa ou SPED
        if (companyName) {
          const matchedFolder = fiscalFolders.find(f => 
            f.name.toLowerCase().includes(companyName!.toLowerCase()) ||
            companyName!.toLowerCase().includes(f.name.toLowerCase())
          );
          if (matchedFolder) {
            setSelectedFolderId(matchedFolder.id);
          } else {
            const spedFolder = fiscalFolders.find(f => f.name.toLowerCase().includes('sped'));
            setSelectedFolderId(spedFolder?.id || fiscalFolders[0]?.id || allFolders[0]?.id || '');
          }
        } else {
          const spedFolder = fiscalFolders.find(f => f.name.toLowerCase().includes('sped'));
          setSelectedFolderId(spedFolder?.id || fiscalFolders[0]?.id || allFolders[0]?.id || '');
        }
      } catch (err: any) {
        setUploadError(`Erro ao analisar conteúdo do arquivo: ${err.message}`);
      } finally {
        setIsReadingFile(false);
      }
    };

    reader.onerror = () => {
      setUploadError('Falha ao ler o arquivo selecionado.');
      setIsReadingFile(false);
    };

    // Lê os primeiros 2MB do arquivo para leitura instantânea sem travamentos
    const slice = file.slice(0, 2 * 1024 * 1024);
    reader.readAsText(slice, 'ISO-8859-1');
  };

  const handleFileSelect = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'txt' && ext !== 'sped') {
      setUploadError(`Formato inválido (.${ext}). Por favor, selecione o arquivo gerado pelo Domínio (.txt ou .sped).`);
      setSelectedFile(null);
      setParsedSped(null);
      return;
    }

    if (file.size === 0) {
      setUploadError('O arquivo selecionado está vazio (0 bytes).');
      setSelectedFile(null);
      setParsedSped(null);
      return;
    }

    setSelectedFile(file);
    analyzeSpedFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Envio do arquivo em 1 clique diretamente para o Cloudflare R2 e Supabase
  const handleUploadSped = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(15);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile, selectedFile.name);
      
      if (selectedFolderId) {
        formData.append('folder_id', selectedFolderId);
      }
      if (parsedSped?.companyName) {
        formData.append('company_name', parsedSped.companyName);
      }
      if (parsedSped?.cnpj) {
        formData.append('cnpj', parsedSped.cnpj);
      }
      formData.append('sector', 'Fiscal');
      formData.append('uploaded_by', currentUser.id);

      setUploadProgress(45);

      const response = await fetch('/api/sped/upload', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(85);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro HTTP ${response.status} ao processar SPED`);
      }

      const result = await response.json();
      setUploadProgress(100);

      if (result.status === 'success' && result.file) {
        const newDoc: DocumentFile = {
          id: result.file.id,
          name: result.file.name,
          folder_id: result.file.folder_id,
          storage_key: result.file.storage_key,
          mime_type: 'text/plain',
          original_size: result.file.size,
          optimized_size: result.file.size,
          compression_ratio: 0,
          pages_count: 1,
          tags: ['SPED', 'Fiscal', parsedSped?.companyName ? `Empresa: ${parsedSped.companyName}` : ''].filter(Boolean),
          uploaded_by: currentUser.id,
          uploader_name: currentUser.full_name,
          sector: 'Fiscal',
          company_name: parsedSped?.companyName,
          document_type: 'SPED Fiscal (EFD)',
          created_at: result.file.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          preview_url: result.file.preview_url,
        };

        setUploadedFileResult({
          ...result.file,
          doc: newDoc,
        });

        // Notifica o app para atualizar as listas em tempo real
        onUploadSuccess(newDoc);
      } else {
        throw new Error(result.error || 'Resposta inesperada do servidor.');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Falha ao enviar arquivo SPED');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParsedSped(null);
    setUploadError(null);
    setUploadedFileResult(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#091124] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100"
      >
        {/* Header do Assistente */}
        <div className="px-6 py-4.5 border-b border-slate-800 bg-[#070D1C] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#DFB76C]/15 border border-[#DFB76C]/30 flex items-center justify-center text-[#DFB76C] shrink-0 shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white tracking-tight">
                  Importador SPED Fiscal
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  100% Web • Domínio
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Leitura automática do cabeçalho (|0000|), validação e salvamento em 1 clique
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-6 overflow-y-auto space-y-5 scrollbar-thin scrollbar-thumb-slate-700">
          {/* Mensagem de Erro */}
          {uploadError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 text-xs animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">Aviso na Importação</span>
                <span>{uploadError}</span>
              </div>
            </div>
          )}

          {/* Tela de Sucesso Completo */}
          {uploadedFileResult ? (
            <div className="py-6 px-4 text-center space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/40 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>

              <div>
                <h4 className="text-lg font-black text-white">SPED Fiscal Arquivado com Sucesso!</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  O arquivo foi validado e salvo permanentemente no armazenamento seguro em nuvem (Cloudflare R2) e registrado no Supabase.
                </p>
              </div>

              {/* Card de Resumo do Arquivo Salvo */}
              <div className="bg-[#0D1830] border border-slate-800 rounded-2xl p-4 text-left space-y-3 max-w-lg mx-auto shadow-inner">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-[11px] font-bold uppercase text-slate-400">Arquivo</span>
                  <span className="text-xs font-mono font-bold text-[#DFB76C] truncate max-w-[240px]">
                    {uploadedFileResult.name}
                  </span>
                </div>

                {parsedSped?.companyName && (
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <span className="text-[11px] font-bold uppercase text-slate-400">Empresa</span>
                    <span className="text-xs font-bold text-white truncate max-w-[260px]">
                      {parsedSped.companyName}
                    </span>
                  </div>
                )}

                {parsedSped?.formattedCnpj && (
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <span className="text-[11px] font-bold uppercase text-slate-400">CNPJ</span>
                    <span className="text-xs font-mono font-semibold text-slate-300">
                      {parsedSped.formattedCnpj}
                    </span>
                  </div>
                )}

                {parsedSped?.periodStart && parsedSped?.periodEnd && (
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <span className="text-[11px] font-bold uppercase text-slate-400">Período de Apuração</span>
                    <span className="text-xs font-semibold text-emerald-400">
                      {parsedSped.periodStart} até {parsedSped.periodEnd}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <Cloud className="w-3.5 h-3.5" /> Cloudflare R2 Ativo
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-400 font-medium">
                    <Database className="w-3.5 h-3.5" /> Supabase Registrado
                  </span>
                </div>
              </div>

              {/* Botões de Ação do Sucesso */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {onOpenFileViewer && uploadedFileResult.doc && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenFileViewer(uploadedFileResult.doc);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Visualizar Documento</span>
                  </button>
                )}

                {onNavigateToFolder && uploadedFileResult.folder_id && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToFolder(uploadedFileResult.folder_id);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer border border-slate-700"
                  >
                    <FolderOpen className="w-4 h-4 text-[#DFB76C]" />
                    <span>Abrir Pasta no GED</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold text-xs transition-colors cursor-pointer border border-slate-800"
                >
                  Importar Outro SPED
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#DFB76C] to-[#C59B4B] text-slate-950 font-black text-xs transition-transform active:scale-98 cursor-pointer shadow-md"
                >
                  Concluir
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Dropzone de Arrastar e Soltar */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3.5 group select-none ${
                  dragActive 
                    ? 'border-[#DFB76C] bg-[#DFB76C]/10 scale-[1.01]' 
                    : selectedFile
                      ? 'border-emerald-500/50 bg-emerald-500/5 hover:border-emerald-400'
                      : 'border-slate-800 hover:border-[#DFB76C]/60 bg-[#070D1C]/60 hover:bg-[#070D1C]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.sped,text/plain"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-md ${
                  selectedFile
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-[#DFB76C]/15 text-[#DFB76C] border border-[#DFB76C]/25 group-hover:scale-105'
                }`}>
                  {isReadingFile ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : selectedFile ? (
                    <FileCode2 className="w-7 h-7" />
                  ) : (
                    <UploadCloud className="w-7 h-7" />
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-[#DFB76C] transition-colors">
                    {selectedFile ? selectedFile.name : 'Arraste o sped_fiscal.txt aqui'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedFile ? (
                      <span className="font-mono text-emerald-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB pronto para validação
                      </span>
                    ) : (
                      'ou clique para selecionar o arquivo exportado pelo Domínio Sistemas'
                    )}
                  </p>
                </div>

                {!selectedFile && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
                    <span className="px-2 py-0.5 rounded bg-slate-800/80 font-mono font-semibold">.txt</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800/80 font-mono font-semibold">.sped</span>
                    <span>• Sem limite rígido de tamanho</span>
                  </div>
                )}
              </div>

              {/* Informações Extraídas Automaticamente do SPED */}
              {parsedSped && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#DFB76C]" />
                      Dados Identificados no Cabeçalho (|0000|)
                    </span>
                    {parsedSped.isSped ? (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> SPED Válido
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        Texto Fiscal Geral
                      </span>
                    )}
                  </div>

                  {/* Grid de Metadados Extraídos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Empresa */}
                    <div className="bg-[#070D1C] border border-slate-800 rounded-2xl p-3.5 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#DFB76C]" /> Razão Social
                      </div>
                      <div className="text-xs font-bold text-white truncate" title={parsedSped.companyName || 'Não especificado no cabeçalho'}>
                        {parsedSped.companyName || 'Empresa não informada'}
                      </div>
                    </div>

                    {/* CNPJ */}
                    <div className="bg-[#070D1C] border border-slate-800 rounded-2xl p-3.5 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#DFB76C]" /> CNPJ
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-200">
                        {parsedSped.formattedCnpj || parsedSped.cnpj || 'Não identificado'}
                      </div>
                    </div>

                    {/* Período de Apuração */}
                    <div className="bg-[#070D1C] border border-slate-800 rounded-2xl p-3.5 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#DFB76C]" /> Período de Apuração
                      </div>
                      <div className="text-xs font-bold text-emerald-400">
                        {parsedSped.periodStart && parsedSped.periodEnd ? (
                          `${parsedSped.periodStart} a ${parsedSped.periodEnd}`
                        ) : (
                          'Período aberto'
                        )}
                      </div>
                    </div>

                    {/* Layout e Finalidade */}
                    <div className="bg-[#070D1C] border border-slate-800 rounded-2xl p-3.5 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <FileCode2 className="w-3.5 h-3.5 text-[#DFB76C]" /> Detalhes Fiscais
                      </div>
                      <div className="text-xs font-medium text-slate-300 truncate">
                        {parsedSped.uf ? `UF: ${parsedSped.uf} ` : ''}
                        {parsedSped.finality ? `• ${parsedSped.finality}` : (parsedSped.layoutVersion || 'EFD Fiscal')}
                      </div>
                    </div>
                  </div>

                  {/* Seleção de Pasta de Destino no GED */}
                  <div className="bg-[#070D1C] border border-slate-800 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="sped-folder-select" className="text-xs font-bold text-slate-300 flex items-center gap-1.5 cursor-pointer">
                        <FolderTree className="w-3.5 h-3.5 text-[#DFB76C]" />
                        Pasta de Destino no GED (Setor Fiscal)
                      </label>
                      <span className="text-[11px] text-slate-500">Auto-sugerida</span>
                    </div>

                    <select
                      id="sped-folder-select"
                      value={selectedFolderId}
                      onChange={(e) => setSelectedFolderId(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 outline-none focus:border-[#DFB76C] transition-colors cursor-pointer"
                    >
                      {fiscalFolders.map(folder => (
                        <option key={folder.id} value={folder.id}>
                          📁 {folder.name} ({folder.sector})
                        </option>
                      ))}
                      {fiscalFolders.length === 0 && (
                        <option value="">📁 Pasta Fiscal Padrão (Criar/Utilizar)</option>
                      )}
                    </select>
                  </div>
                </div>
              )}

              {/* Barra de Progresso durante Upload */}
              {isUploading && (
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-white flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#DFB76C]" />
                      Salvando no Cloudflare R2 e Supabase...
                    </span>
                    <span className="text-[#DFB76C] font-mono">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#DFB76C] to-emerald-400 transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer com Botão de Ação Única */}
        {!uploadedFileResult && (
          <div className="px-6 py-4 border-t border-slate-800 bg-[#070D1C] flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>

            <div className="flex items-center gap-3">
              {selectedFile && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isUploading}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer disabled:opacity-50"
                >
                  Trocar Arquivo
                </button>
              )}

              <button
                type="button"
                id="btn-process-save-sped"
                onClick={handleUploadSped}
                disabled={!selectedFile || isReadingFile || isUploading}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#DFB76C] via-[#E8C785] to-[#D4A755] text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg hover:brightness-105 active:scale-98 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processando e Salvando...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4" />
                    <span>Processar e Salvar no GED</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
