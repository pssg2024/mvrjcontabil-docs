import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  FileText, 
  Image as ImageIcon,
  Calendar
} from 'lucide-react';
import { DocumentFile } from '../types';
import { formatBytes } from '../lib/optimization';
import { getPresignedDownloadUrl, getPermanentViewUrl } from '../lib/storage-service';
import { getDueDateInfo } from '../lib/due-date-utils';

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
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [presignedDownloadUrl, setPresignedDownloadUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  useEffect(() => {
    if (file && isOpen) {
      setZoom(100);
      setRotation(0);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col p-4 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Control Bar */}
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <h3 className="font-bold text-sm text-[#112354]">{file.name}</h3>
              {(() => {
                const dueInfo = getDueDateInfo(file.due_date || (file as any).dataVencimento);
                if (!dueInfo) return null;
                return (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${dueInfo.badgeClass}`}>
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{dueInfo.badgeText}</span>
                  </span>
                );
              })()}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {file.sector} • {new Date(file.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              disabled={isLoadingUrl}
              className="px-4 py-2 bg-[#C59B4B] hover:bg-[#B38A3A] text-white rounded-xl text-xs font-medium transition-colors shadow-sm"
            >
              Baixar Arquivo
            </button>
            <a
              href={presignedDownloadUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
            >
              Abrir em Nova Aba
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Reader Center Body */}
        <div className="w-full">
          {isImage ? (
            <div className="flex items-center justify-center">
              <img
                src={presignedDownloadUrl || file.preview_url || getPermanentViewUrl(file.storage_key, file.name)}
                alt={file.name}
                className="max-h-[75vh] max-w-full rounded-xl border border-slate-200"
              />
            </div>
          ) : isPdf ? (
            <iframe
              src={`${presignedDownloadUrl}#toolbar=1&navpanes=0`}
              title={file.name}
              className="w-full h-[75vh] rounded-xl border border-slate-200"
            />
          ) : (
            <div className="h-[75vh] flex flex-col items-center justify-center text-center p-8 border border-slate-200 rounded-xl bg-slate-50">
              <FileText className="w-12 h-12 text-slate-300 mb-4" />
              <h4 className="font-semibold text-slate-700">Pré-visualização direta não disponível</h4>
              <p className="text-xs text-slate-500 mt-1 mb-4">Este formato de arquivo não pode ser aberto diretamente.</p>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-[#1B357B] hover:bg-[#112354] text-white rounded-xl text-xs font-medium"
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
