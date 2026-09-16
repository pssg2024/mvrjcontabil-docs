import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  FileText, 
  Image as ImageIcon
} from 'lucide-react';
import { DocumentFile } from '../types';
import { formatBytes } from '../lib/optimization';
import { getPresignedDownloadUrl } from '../lib/storage-service';

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
  const isImage = file.mime_type.includes('image') || /\.(webp|png|jpe?g)$/i.test(file.name);

  const fetchPresignedUrl = async (key: string, name: string) => {
    try {
      setIsLoadingUrl(true);
      const res = await getPresignedDownloadUrl(key, name, true);
      setPresignedDownloadUrl(res.downloadUrl);
    } catch (err) {
      console.warn('Erro ao obter presigned download URL, fallback para preview_url local', err);
      if (file.preview_url) {
        setPresignedDownloadUrl(file.preview_url);
      }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-slate-900 w-full max-w-6xl h-[92vh] rounded-2xl shadow-2xl flex flex-col border border-slate-800 overflow-hidden text-white animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Control Bar */}
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="p-2 bg-blue-600/20 border border-blue-500/30 rounded-lg text-blue-400 shrink-0">
              {isImage ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-white truncate max-w-md">{file.name}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                  -{file.compression_ratio}% Otimizado
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {file.sector} • {formatBytes(file.optimized_size)} (Original: {formatBytes(file.original_size)})
              </p>
            </div>
          </div>

          {/* Reader Action Controls */}
          <div className="flex items-center space-x-2">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center space-x-1 bg-slate-800/80 border border-slate-700 rounded-lg p-1 text-xs">
              <button
                onClick={() => setZoom(prev => Math.max(50, prev - 15))}
                className="p-1 rounded hover:bg-slate-700 text-slate-300"
                title="Reduzir Zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-1.5 font-mono text-[11px] text-slate-300 min-w-[40px] text-center">{zoom}%</span>
              <button
                onClick={() => setZoom(prev => Math.min(200, prev + 15))}
                className="p-1 rounded hover:bg-slate-700 text-slate-300"
                title="Aumentar Zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Rotate */}
            <button
              onClick={() => setRotation(prev => (prev + 90) % 360)}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
              title="Girar 90 Graus"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Download Button */}
            <button
              id="download-doc-btn"
              onClick={handleDownload}
              disabled={isLoadingUrl}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
              title="Baixar documento"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Baixar Documento</span>
            </button>

            {/* Close Modal */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Reader Center Body */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* Main Visualizer Area */}
          <div className="flex-1 bg-slate-950 flex items-center justify-center p-4 overflow-auto">
            {isImage ? (
              <div 
                className="transition-transform duration-200 flex items-center justify-center max-w-full max-h-full"
                style={{ 
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                }}
              >
                <img
                  src={presignedDownloadUrl || file.preview_url || '/placeholder-doc.png'}
                  alt={file.name}
                  className="max-h-[75vh] max-w-full rounded-lg shadow-2xl object-contain border border-slate-800"
                />
              </div>
            ) : (
              <div 
                className="w-full h-full flex flex-col items-center justify-center transition-transform duration-200"
                style={{ 
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                }}
              >
                {/* Embedded PDF iframe / object with fallback */}
                {presignedDownloadUrl ? (
                  <iframe
                    src={`${presignedDownloadUrl}#toolbar=1&navpanes=0`}
                    title={file.name}
                    className="w-full h-full rounded-lg border border-slate-800 bg-white"
                  />
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center max-w-md">
                    <FileText className="w-16 h-16 text-blue-400 mx-auto mb-3" />
                    <h4 className="font-bold text-base text-white">{file.name}</h4>
                    <p className="text-xs text-slate-400 mt-2">
                      Documento PDF ({formatBytes(file.optimized_size)}, {file.pages_count || 1} páginas).
                    </p>
                    <button
                      onClick={handleDownload}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold text-white inline-flex items-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Abrir Documento Completo</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
