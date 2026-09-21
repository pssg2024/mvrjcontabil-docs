import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  Image as ImageIcon,
  ExternalLink,
  Loader2
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

  const fileUrl = presignedDownloadUrl || getPermanentViewUrl(file.storage_key, file.name);

  const useCompactCard = (isPdf && isMobile) || (!isPdf && !isImage);

  if (useCompactCard) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
        <div className="w-[92%] max-w-md mx-auto bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-5 border border-slate-100 relative animate-in fade-in zoom-in-95 duration-150">
          
          {/* Top Right Close Button */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer absolute top-4 right-4"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon Container */}
          <div className="w-20 h-20 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shadow-sm mt-2">
            <FileText className="w-10 h-10" />
          </div>

          {/* File Info */}
          <div className="text-center w-full space-y-1">
            <h4 className="text-base sm:text-lg font-bold text-slate-800 text-center break-all px-2">
              {file.name}
            </h4>
            
            {/* Badges and date */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-[11px] font-semibold">
                {file.sector}
              </span>
              <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-[11px] font-semibold">
                {formatBytes(file.optimized_size || file.original_size)}
              </span>
            </div>
            
            <p className="text-[11px] text-slate-400 pt-2 text-center w-full">
              Enviado em {new Date(file.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="w-full space-y-2.5 pt-1">
            <button
              onClick={handleOpenDirectly}
              className="w-full h-11 rounded-xl bg-[#1B357B] hover:bg-[#152a62] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Abrir em Ecrã Inteiro</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={isLoadingUrl}
              className="w-full h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Descarregar Ficheiro</span>
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-[90vw] md:max-w-6xl xl:max-w-7xl rounded-2xl shadow-2xl flex flex-col p-5 animate-in fade-in zoom-in-95 duration-150 h-[85vh] max-h-[85vh]">
        
        {/* Top Control Bar */}
        <div className="flex items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3 shrink-0">
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
        <div className="w-full flex-1 min-h-0">
          {isImage ? (
            <div className="w-full h-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center p-4">
              <img
                src={fileUrl}
                alt={file.name}
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full object-contain rounded-xl"
              />
            </div>
          ) : (
            /* Desktop Preview iframe using the exact direct fileUrl with native browser viewer */
            <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
              {isLoadingUrl && (
                <div className="absolute inset-0 z-20 bg-slate-50/85 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-[#1B357B] animate-spin" />
                  <p className="text-xs text-slate-500 font-medium animate-pulse">A carregar documento seguro...</p>
                </div>
              )}
              {fileUrl && (
                <iframe
                  src={`${fileUrl}#toolbar=1&navpanes=0`}
                  title={file.name}
                  className="absolute inset-0 w-full h-full border-0 z-10 bg-white"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
