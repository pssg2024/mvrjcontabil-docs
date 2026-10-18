import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Radio, 
  FileText,
  ExternalLink
} from 'lucide-react';
import { FiscalNewsItem } from '../types';

interface FiscalNewsBannerProps {
  className?: string;
  embedded?: boolean;
  variant?: 'ticker' | 'chips-section' | 'responsive';
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
  embedded = false,
  variant = 'responsive'
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

  // Rotação suave a cada 7 segundos (apenas se não estiver pausado)
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
          <span className="w-2 h-2 rounded-full bg-[#DFB76C] animate-ping"></span>
          <span className="text-[11px] font-medium tracking-wide">Sincronizando plantão fiscal em tempo real...</span>
        </div>
      </div>
    );
  }

  if (news.length === 0) return null;

  const currentItem = news[currentIndex] || news[0];
  const formattedOrgan = formatOrganName(currentItem.orgao);

  // Lista única de órgãos para os chips horizontais
  const distinctOrgans = Array.from(
    new Set(news.map(n => formatOrganName(n.orgao)))
  ).slice(0, 6);

  // Renderização 1: Seção com Chips em Rolagem Horizontal (Item 4 para Mobile)
  const renderChipsSection = () => (
    <section className="space-y-2.5 w-full">
      {/* Título pequeno da seção */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <Radio className="w-3.5 h-3.5 text-[#DFB76C] animate-pulse" />
          <span>PLANTÃO FISCAL</span>
        </div>

        {news.length > 1 && (
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
            <span>{currentIndex + 1} de {news.length}</span>
            <div className="flex items-center gap-0.5 ml-1">
              <button
                type="button"
                onClick={handlePrev}
                className="w-8 h-8 rounded-lg text-slate-300 hover:text-white bg-slate-900 border border-slate-800 flex items-center justify-center cursor-pointer"
                title="Notícia anterior"
                aria-label="Anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="w-8 h-8 rounded-lg text-slate-300 hover:text-white bg-slate-900 border border-slate-800 flex items-center justify-center cursor-pointer"
                title="Próxima notícia"
                aria-label="Próxima"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Linha que rola na horizontal com chips (sem texto cortado, chip ativo dourado) */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 -mx-5 px-5 sm:mx-0 sm:px-0">
        {/* Chip do Órgão Ativo (Dourado se for o ativo) */}
        {distinctOrgans.map((organ) => {
          const isActive = formatOrganName(currentItem.orgao) === organ;
          return (
            <button
              key={organ}
              type="button"
              onClick={() => {
                const targetIdx = news.findIndex(n => formatOrganName(n.orgao) === organ);
                if (targetIdx >= 0) setCurrentIndex(targetIdx);
              }}
              className={`min-h-[44px] px-4 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center justify-center shrink-0 border ${
                isActive
                  ? 'bg-[#DFB76C] text-slate-950 border-[#DFB76C] shadow-sm font-extrabold'
                  : 'bg-[#091124] text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
              }`}
            >
              <span>{organ}</span>
            </button>
          );
        })}

        {/* Chip 'Fonte Oficial' com link direto */}
        {currentItem.linkOficial && (
          <a
            href={currentItem.linkOficial}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] px-4 rounded-xl text-xs font-bold whitespace-nowrap bg-[#091124] text-blue-300 hover:text-white border border-slate-800 hover:border-blue-700 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            title="Acessar página oficial da notícia"
          >
            <span>Fonte Oficial</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#DFB76C]" />
          </a>
        )}
      </div>

      {/* Card da Notícia Ativa (sem texto cortado, título legível) */}
      <div className="bg-[#091124] border border-slate-800 rounded-2xl p-4 text-slate-100 shadow-xs flex flex-col gap-1.5">
        <a
          href={currentItem.linkOficial}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs sm:text-sm font-semibold text-slate-200 hover:text-[#DFB76C] leading-snug transition-colors cursor-pointer"
          title={currentItem.titulo}
        >
          {currentItem.titulo}
        </a>
        {currentItem.resumo && (
          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
            {currentItem.resumo}
          </p>
        )}
      </div>
    </section>
  );

  // Renderização 2: Ticker Tradicional para Desktop
  const renderTicker = () => (
    <div 
      className={`w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-white select-none ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Plantão de Legislação e Notícias Fiscais"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold tracking-wider font-sans shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
            <span>PLANTÃO FISCAL</span>
          </div>

          <div className="px-2 py-0.5 rounded-md bg-white/10 text-blue-100 border border-white/15 text-[10px] font-semibold tracking-wide font-sans shrink-0 truncate max-w-[130px] sm:max-w-[180px]">
            {formattedOrgan}
          </div>
        </div>

        <a
          href={currentItem.linkOficial}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-slate-100 hover:text-amber-300 transition-colors line-clamp-2 sm:truncate min-w-0 flex-1 cursor-pointer font-sans leading-snug"
          title={currentItem.titulo}
        >
          <span>{currentItem.titulo}</span>
        </a>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
        {currentItem.linkOficial && (
          <a
            href={currentItem.linkOficial}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-blue-200 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-all cursor-pointer font-sans shrink-0"
            title="Acessar página oficial da notícia"
          >
            <span>Fonte Oficial</span>
            <FileText className="w-3 h-3 text-amber-300" />
          </a>
        )}

        {news.length > 1 && (
          <div className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 p-0.5 text-xs font-sans shrink-0">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Notícia anterior"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[11px] font-semibold text-slate-200 select-none whitespace-nowrap">
              {currentIndex + 1}/{news.length}
            </span>
            <button
              type="button"
              onClick={handleNext}
              className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Próxima notícia"
              aria-label="Próxima"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (variant === 'chips-section') {
    return renderChipsSection();
  }

  if (variant === 'ticker') {
    return renderTicker();
  }

  return (
    <>
      <div className="block lg:hidden w-full">{renderChipsSection()}</div>
      <div className="hidden lg:block w-full">{renderTicker()}</div>
    </>
  );
};
