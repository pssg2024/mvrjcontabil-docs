import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight,
  Radio,
  FileText
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

/**
 * Formata nomes técnicos de órgãos ou URLs brutas em legendas corporativas elegantes e limpas
 */
export const formatOrganName = (raw?: string): string => {
  if (!raw) return 'DOU';
  const clean = raw.toLowerCase().trim();
  
  if (clean.includes('antt')) return 'ANTT';
  if (clean.includes('in.gov.br') || clean.includes('imprensa') || clean.includes('dou')) return 'DOU';
  if (clean.includes('receita') || clean.includes('rfb')) return 'Receita Federal';
  if (clean.includes('fazenda') || clean.includes('sefaz')) return 'Min. Fazenda';
  if (clean.includes('trabalho') || clean.includes('mte') || clean.includes('srt')) return 'Min. Trabalho';
  if (clean.includes('esocial')) return 'eSocial';
  if (clean.includes('simples')) return 'Simples Nac.';
  if (clean.includes('caixa') || clean.includes('fgts')) return 'Caixa · FGTS';
  if (clean.includes('planalto')) return 'Presidência';
  if (clean.includes('stf')) return 'STF';
  if (clean.includes('stj')) return 'STJ';
  if (clean.includes('tst')) return 'TST';
  if (clean.includes('rio grande do sul') || clean.includes('cagergs') || clean.includes('sefaz-rs') || clean.includes('sefaz.rs')) return 'SEFAZ-RS';
  if (clean.includes('são paulo') || clean.includes('sao paulo') || clean.includes('sefaz-sp') || clean.includes('sefaz.sp')) return 'SEFAZ-SP';
  if (clean.includes('rio de janeiro') || clean.includes('sefaz-rj') || clean.includes('sefaz.rj')) return 'SEFAZ-RJ';
  if (clean.includes('minas gerais') || clean.includes('sefaz-mg') || clean.includes('sefaz.mg')) return 'SEFAZ-MG';
  if (clean.includes('paraná') || clean.includes('parana') || clean.includes('sefa.pr')) return 'SEFAZ-PR';
  if (clean.includes('santa catarina') || clean.includes('sef.sc')) return 'SEFAZ-SC';
  if (clean.includes('bahia') || clean.includes('sefaz.ba')) return 'SEFAZ-BA';
  if (clean.includes('goiás') || clean.includes('goias') || clean.includes('sefaz.go')) return 'SEFAZ-GO';

  // Tratar hostnames genéricos ou títulos longos
  let stripped = raw
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\.gov\.br/i, '')
    .replace(/\.com\.br/i, '')
    .replace(/\.br/i, '')
    .replace(/portal do estado d[eo]\s*/i, '')
    .replace(/governo do estado d[eo]\s*/i, '')
    .split('.')[0]
    .trim();

  if (stripped.length > 15) {
    stripped = stripped.slice(0, 15);
  }

  return stripped.toUpperCase() || 'DOU';
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

  // Rotação suave a cada 7 segundos
  useEffect(() => {
    if (news.length <= 1 || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % news.length);
    }, 7000);

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

  if (isLoading && news.length === 0) {
    return (
      <div className={`w-full flex items-center justify-between text-xs text-blue-200/70 py-1.5 ${className}`}>
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
          <span className="text-[11px] font-medium tracking-wide">Sincronizando plantão de legislação e notícias fiscais em tempo real...</span>
        </div>
      </div>
    );
  }

  if (news.length === 0) return null;

  const currentItem = news[currentIndex] || news[0];
  const formattedOrgan = formatOrganName(currentItem.orgao);

  return (
    <div 
      className={`w-full flex flex-col gap-2.5 sm:gap-2 select-none ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Plantão de Legislação e Notícias Fiscais"
    >
      {/* LINHA SUPERIOR: Badges Informativas (Esquerda) + Barra de Controles (Direita) - Linha única sem quebra */}
      <div className="w-full flex items-center justify-between gap-2 min-w-0">
        
        {/* Badges: Plantão Fiscal + Órgão (com truncate seguro) */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-hidden">
          {/* Badge "Plantão Fiscal" com radar pulsante */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/35 text-amber-200 text-[10px] font-bold font-mono tracking-wider shadow-xs backdrop-blur-md shrink-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 shadow-xs shadow-amber-300"></span>
            </span>
            <span className="shrink-0 whitespace-nowrap">PLANTÃO FISCAL</span>
          </div>

          {/* Badge do Órgão Formatado (Truncate elegante para nunca quebrar ou desalinhar a linha no celular) */}
          <span 
            className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-blue-100 text-[10px] font-semibold font-mono tracking-wide border border-white/15 truncate max-w-[100px] xs:max-w-[130px] sm:max-w-[220px] shrink min-w-0 transition-colors"
            title={formattedOrgan}
          >
            {formattedOrgan}
          </span>
        </div>

        {/* Lado Direito: Navegação entre Notícias (< 1/15 >) - Sempre ancorado à direita, NUNCA quebra linha */}
        <div className="flex items-center shrink-0 ml-auto">
          {news.length > 1 && (
            <div className="inline-flex items-center bg-black/40 hover:bg-black/50 backdrop-blur-md rounded-lg p-0.5 border border-white/15 text-[11px] font-mono shadow-xs transition-colors shrink-0">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
                aria-label="Notícia anterior"
                title="Aviso/Notícia anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="px-1.5 sm:px-2 text-[11px] font-mono text-white/95 font-bold tracking-tight select-none whitespace-nowrap">
                {currentIndex + 1}/{news.length}
              </span>

              <button
                type="button"
                onClick={handleNext}
                className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
                aria-label="Próxima notícia"
                title="Próxima notícia"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

      </div>

      {/* LINHA INFERIOR: Título Completo da Notícia com Altura Mínima Estável (Elimina solavancos ao trocar notícia) */}
      <div className="w-full min-h-[38px] sm:min-h-[42px] flex items-center">
        <a
          href={currentItem.linkOficial}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs sm:text-[13px] font-medium text-white/95 hover:text-amber-300 transition-colors leading-snug sm:leading-relaxed tracking-tight group block max-w-full line-clamp-2"
          title={currentItem.titulo}
        >
          <span className="group-hover:underline underline-offset-2">
            {currentItem.titulo}
          </span>
          {currentItem.resumo && 
           !currentItem.titulo.toLowerCase().includes(currentItem.resumo.toLowerCase().slice(0, 20)) &&
           !currentItem.resumo.toLowerCase().includes(currentItem.titulo.toLowerCase().slice(0, 20)) && (
            <span className="hidden lg:inline text-blue-200/70 text-[11px] font-normal ml-2">
              &mdash; {currentItem.resumo}
            </span>
          )}
        </a>
      </div>
    </div>
  );
};
