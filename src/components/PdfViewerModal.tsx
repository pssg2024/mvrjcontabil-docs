import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  Image as ImageIcon,
  ExternalLink
} from 'lucide-react';
import { DocumentFile } from '../types';
import { getPresignedDownloadUrl, getPermanentViewUrl } from '../lib/storage-service';
import { formatBytes } from '../lib/optimization';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: DocumentFile | null;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  file,
}) => {
  const [presignedDownloadUrl, setPresignedDownloadUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (file && isOpen) {
      fetchPresignedUrl(file.storage_key, file.name);
    }
  }, [file, isOpen]);

  if (!isOpen || !file) return null;

  const isPdf = file.mime_type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
  const isImage = file.mime_type.includes('image') || /\.(webp|png|jpe?g|gif|svg|bmp|ico)$/i.test(file.name);

  const fetchPresignedUrl = async (key: string, name: string) => {
    const permanentProxyUrl = getPermanentViewUrl(key, name);
    try {
      setIsLoadingUrl(true);
      const res = await getPresignedDownloadUrl(key, name, true);
      setPresignedDownloadUrl(res.downloadUrl || permanentProxyUrl);
    } catch (err) {
      console.warn('Erro ao obter presigned download URL, fallback para endpoint permanente:', err);
      setPresignedDownloadUrl(file.preview_url || permanentProxyUrl);
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const handleDownload = () => {
    if (presignedDownloadUrl) {
      const a = document.createElement('a');
      a.href = presignedDownloadUrl;
      a.download = file.name;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleOpenDirectly = () => {
    const url = presignedDownloadUrl || getPermanentViewUrl(file.storage_key, file.name);
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col p-4 animate-in fade-in zoom-in-95 duration-150 max-h-[95vh]">
        
        {/* Top Control Bar */}
        <div className="flex items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm text-[#112354] truncate" title={file.name}>
              {file.name}
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5 truncate">
              {file.sector} • {new Date(file.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleDownload}
              disabled={isLoadingUrl}
              className="h-9 px-3 bg-[#C59B4B] hover:bg-[#B38A3A] disabled:bg-slate-300 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              title="Baixar arquivo"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Baixar</span>
            </button>
            <button
              onClick={handleOpenDirectly}
              disabled={isLoadingUrl}
              className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              title="Abrir em Nova Aba"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Nova Aba</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center cursor-pointer shrink-0"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Reader Center Body */}
        <div className="w-full">
          {isImage ? (
            <div className="w-full h-[65vh] sm:h-[75vh] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center p-4">
              <img
                src={presignedDownloadUrl || file.preview_url || getPermanentViewUrl(file.storage_key, file.name)}
                alt={file.name}
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full object-contain rounded-xl"
              />
            </div>
          ) : isPdf ? (
            isMobile ? (
              /* Executive Fallback Panel for Mobile Screens */
              <div className="w-full h-[65vh] flex items-center justify-center p-3 bg-slate-50/50 rounded-2xl border border-slate-200/60 overflow-y-auto">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/50 shadow-xs max-w-sm w-full text-center space-y-4 my-auto">
                  {/* Stylized PDF Icon in Crimson Red */}
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-lg shadow-2xs border border-red-100">
                    <FileText className="w-7 h-7" />
                  </div>
                  
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-50 text-red-700 border border-red-100 uppercase tracking-wide">
                      Documento PDF
                    </span>
                    <h4 className="font-extrabold text-slate-800 text-xs mt-2.5 leading-relaxed break-words px-1">
                      {file.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-1.5 flex items-center justify-center gap-1.5 flex-wrap">
                      <span>Setor: <strong className="text-slate-700 font-semibold">{file.sector}</strong></span>
                      <span className="text-slate-300">•</span>
                      <span>Tamanho: <strong className="text-slate-700 font-semibold">{formatBytes(file.optimized_size || file.original_size)}</strong></span>
                    </p>
                    <p className="text-[9px] text-slate-400 mt-1">
                      Enviado em {new Date(file.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  <div className="space-y-2 pt-1">
                    <button
                      onClick={handleOpenDirectly}
                      className="w-full h-10 bg-gradient-to-r from-[#0F1E42] to-[#1B357B] hover:from-[#112354] hover:to-[#224499] text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4 text-[#C59B4B]" />
                      <span>Abrir e Ler Documento</span>
                    </button>
                    
                    <button
                      onClick={handleDownload}
                      disabled={isLoadingUrl}
                      className="w-full h-10 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200/30"
                    >
                      <Download className="w-4 h-4 text-slate-500" />
                      <span>Baixar para o Dispositivo</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Desktop Preview iframe */
              <div className="relative w-full h-[75vh] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                {/* Spinner behind the iframe */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-0">
                  <div className="w-8 h-8 border-4 border-[#1B357B] border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-xs text-slate-500 font-medium">Carregando pré-visualização segura...</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-xs">
                    Se o visualizador demorar a carregar, você pode abrir diretamente pelo link alternativo.
                  </p>
                </div>

                {presignedDownloadUrl && (
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(presignedDownloadUrl)}&embedded=true`}
                    title={file.name}
                    className="absolute inset-0 w-full h-full border-0 z-10 bg-white"
                  />
                )}

                {/* Elegant floating direct view action escape hatch */}
                <div className="absolute bottom-3 right-3 z-20">
                  <button
                    type="button"
                    onClick={handleOpenDirectly}
                    className="px-3.5 py-2 bg-slate-900/90 hover:bg-slate-950 backdrop-blur-xs text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer border border-white/10"
                    title="Abrir PDF diretamente caso o carregador apresente falhas"
                  >
                    <FileText className="w-4 h-4 text-[#C59B4B]" />
                    <span>Visualizar PDF Diretamente</span>
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="w-full h-[65vh] sm:h-[75vh] flex flex-col items-center justify-center text-center p-8 border border-slate-200 rounded-2xl bg-slate-50 overflow-hidden">
              <FileText className="w-12 h-12 text-slate-300 mb-4" />
              <h4 className="font-semibold text-slate-700 text-sm">Pré-visualização direta não disponível</h4>
              <p className="text-xs text-slate-500 mt-1 mb-4 max-w-sm">
                Este formato de arquivo não possui suporte para renderização em tempo real.
              </p>
              <button
                onClick={handleDownload}
                className="px-5 py-2 bg-[#1B357B] hover:bg-[#112354] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Baixar Documento
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
