import React, { useState, useEffect, useRef } from 'react';
import { 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight
} from 'lucide-react';
import { FiscalNewsItem } from '../types';

interface FiscalNewsBannerProps {
  className?: string;
  embedded?: boolean;
}

/**
 * Sanitiza rigorosamente qualquer entidade HTML (&nbsp;, &amp;, etc.) e tags residuais
 */
export const cleanFiscalText = (text?: string): string => {
  if (!text) return '';
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&#xA0;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const FiscalNewsBanner: React.FC<FiscalNewsBannerProps> = ({ 
  className = '',
  embedded = false 
}) => {
  const [news, setNews] = useState<FiscalNewsItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNews = async () => {
    try {
      const res = await fetch('/api/noticias-fiscais');
      if (res.ok) {
        const data = await res.json();
        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          const sanitized = data.items.map((item: FiscalNewsItem) => ({
            ...item,
            titulo: cleanFiscalText(item.titulo),
            resumo: cleanFiscalText(item.resumo),
            orgao: cleanFiscalText(item.orgao),
            categoria: cleanFiscalText(item.categoria),
          }));
          setNews(sanitized);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar notícias fiscais:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  // Rotação suave a cada 6 segundos
  useEffect(() => {
    if (news.length <= 1 || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % news.length);
    }, 6000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [news.length, isPaused]);

  const handleNext = () => {
    if (news.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % news.length);
  };

  const handlePrev = () => {
    if (news.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + news.length) % news.length);
  };

  const getOrganBadgeStyle = (orgao: string) => {
    const o = (orgao || '').toLowerCase();
    if (o.includes('receita')) {
      return 'bg-blue-400/15 text-blue-200 border-blue-400/30';
    }
    if (o.includes('esocial')) {
      return 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30';
    }
    if (o.includes('fazenda')) {
      return 'bg-amber-400/15 text-amber-200 border-amber-400/30';
    }
    if (o.includes('simples')) {
      return 'bg-teal-400/15 text-teal-200 border-teal-400/30';
    }
    return 'bg-white/10 text-blue-100 border-white/20';
  };

  if (isLoading && news.length === 0) {
    return (
      <div className={`w-full flex items-center justify-between text-xs text-blue-200/70 py-1 ${className}`}>
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
          <span className="text-[11px] font-medium">Sincronizando notícias fiscais e legislação em tempo real...</span>
        </div>
      </div>
    );
  }

  if (news.length === 0) return null;

  const currentItem = news[currentIndex] || news[0];

  return (
    <div 
      className={`w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 select-none ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Plantão de Legislação e Notícias Fiscais"
    >
      {/* Lado Esquerdo + Centro: Badge Plantão + Órgão + Título Ticker */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
        
        {/* Badge "Plantão Fiscal" elegante com ponto pulsante */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider shrink-0 shadow-2xs">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400"></span>
          </span>
          <span>Plantão Fiscal</span>
        </div>

        {/* Badge do Órgão */}
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider border shrink-0 ${getOrganBadgeStyle(currentItem.orgao)}`}>
          {currentItem.orgao || 'Oficial'}
        </span>

        {/* Título da Notícia em destaque com hover suave */}
        <div className="min-w-0 flex-1 flex items-center gap-2 overflow-hidden">
          <a
            href={currentItem.linkOficial}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-xs text-white hover:text-amber-300 transition-colors truncate"
            title={currentItem.titulo}
          >
            {currentItem.titulo}
          </a>

          {currentItem.resumo && 
           !currentItem.titulo.toLowerCase().includes(currentItem.resumo.toLowerCase().slice(0, 20)) &&
           !currentItem.resumo.toLowerCase().includes(currentItem.titulo.toLowerCase().slice(0, 20)) && (
            <span className="hidden 2xl:inline text-blue-200/60 text-[11px] font-normal truncate">
              &mdash; {currentItem.resumo}
            </span>
          )}
        </div>

      </div>

      {/* Lado Direito: Controles Essenciais (Setas < > e Link Fonte Oficial) */}
      <div className="flex items-center justify-end gap-2 shrink-0">
        
        {/* Setas discretas e minimalistas */}
        <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/10">
          <button
            type="button"
            onClick={handlePrev}
            className="p-1 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Notícia anterior"
            title="Anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="p-1 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Próxima notícia"
            title="Próxima"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Link direto Fonte Oficial */}
        <a
          href={currentItem.linkOficial}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-all shrink-0 border border-white/15 hover:border-white/30"
          title="Ver publicação oficial na íntegra"
        >
          <span>Fonte Oficial</span>
          <ExternalLink className="w-3 h-3 text-amber-300 shrink-0" />
        </a>

      </div>
    </div>
  );
};
