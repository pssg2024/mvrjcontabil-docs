import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Filter, 
  ExternalLink, 
  MapPin, 
  Briefcase, 
  Calendar, 
  Phone, 
  Mail, 
  FileText, 
  ShieldCheck, 
  RotateCcw,
  Loader2
} from 'lucide-react';
import { CompanyCnpjData, DocumentFile, Folder } from '../types';
import { 
  cleanCnpj, 
  formatCnpj, 
  formatBrDate, 
  formatCnaeCode, 
  fetchCompanyByCnpj 
} from '../lib/cnpj-service';

interface CompanyConsultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilterGed: (searchTerm: string, companyName?: string) => void;
  existingFiles?: DocumentFile[];
  existingFolders?: Folder[];
  initialSearchQuery?: string;
}

export const CompanyConsultModal: React.FC<CompanyConsultModalProps> = ({
  isOpen,
  onClose,
  onFilterGed,
  existingFiles = [],
  existingFolders = [],
  initialSearchQuery = '',
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [companyData, setCompanyData] = useState<CompanyCnpjData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCnpj, setCopiedCnpj] = useState(false);
  const [recentSearches, setRecentSearches] = useState<Array<{ cnpj: string; name: string }>>(() => {
    try {
      const saved = localStorage.getItem('mvrj_recent_cnpjs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (isOpen) {
      if (initialSearchQuery) {
        const cleaned = cleanCnpj(initialSearchQuery);
        if (cleaned.length === 14) {
          setInputQuery(formatCnpj(cleaned));
          handleSearch(cleaned);
          return;
        } else {
          setInputQuery(initialSearchQuery);
        }
      }
      setErrorMessage(null);
    }
  }, [isOpen, initialSearchQuery]);

  // Contagem de documentos e pastas no GED que batem com este CNPJ ou Razão Social
  const matchingGedCount = React.useMemo(() => {
    if (!companyData) return { files: 0, folders: 0 };
    const terms = [
      cleanCnpj(companyData.cnpj),
      formatCnpj(companyData.cnpj),
      companyData.razao_social.toLowerCase(),
      companyData.nome_fantasia ? companyData.nome_fantasia.toLowerCase() : ''
    ].filter(Boolean);

    const mFiles = existingFiles.filter(f => {
      const name = f.name.toLowerCase();
      const tags = f.tags.map(t => t.toLowerCase()).join(' ');
      return terms.some(t => name.includes(t) || tags.includes(t));
    }).length;

    const mFolders = existingFolders.filter(f => {
      const name = f.name.toLowerCase();
      return terms.some(t => name.includes(t));
    }).length;

    return { files: mFiles, folders: mFolders };
  }, [companyData, existingFiles, existingFolders]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Se estiver digitando números, aplica formatação progressiva de CNPJ
    const onlyNums = cleanCnpj(val);
    if (onlyNums.length > 0 && /^[0-9./-]+$/.test(val)) {
      setInputQuery(formatCnpj(onlyNums));
    } else {
      setInputQuery(val);
    }
    if (errorMessage) setErrorMessage(null);
  };

  const handleSearch = async (queryToSearch?: string) => {
    const raw = queryToSearch || inputQuery;
    const digits = cleanCnpj(raw);

    // Se o usuário digitou nome da empresa em vez de CNPJ com 14 dígitos
    if (digits.length !== 14) {
      if (raw.trim().length >= 3 && !/^\d+$/.test(raw.trim())) {
        // Tentar verificar se existe no GED e filtrar direto
        onFilterGed(raw.trim());
        onClose();
        return;
      }
      setErrorMessage('Por favor, informe um CNPJ válido com 14 dígitos (com ou sem pontuação).');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setCompanyData(null);

    try {
      const result = await fetchCompanyByCnpj(digits);
      setCompanyData(result);

      // Salvar nos recentes
      try {
        const newEntry = { cnpj: digits, name: result.razao_social || result.nome_fantasia || digits };
        const updated = [newEntry, ...recentSearches.filter(r => r.cnpj !== digits)].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem('mvrj_recent_cnpjs', JSON.stringify(updated));
      } catch {}
    } catch (err: any) {
      const msg = err.message || 'Empresa não encontrada na base da Receita Federal.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCnpj = (cnpj: string) => {
    navigator.clipboard.writeText(cnpj);
    setCopiedCnpj(true);
    setTimeout(() => setCopiedCnpj(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    const upper = (status || '').toUpperCase();
    if (upper === 'ATIVA') {
      return (
        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          ATIVA
        </span>
      );
    }
    if (upper.includes('BAIXADA') || upper.includes('INAPTA') || upper.includes('NULA')) {
      return (
        <span className="bg-rose-50 text-rose-700 border border-rose-200/70 font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          {upper}
        </span>
      );
    }
    return (
      <span className="bg-amber-50 text-amber-700 border border-amber-200/70 font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
        {upper || 'INDISPONÍVEL'}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div 
        className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal com Gradiente Executivo e Efeito de Luz */}
        <div className="bg-gradient-to-r from-[#0B1736] via-[#122452] to-[#1B357B] p-6 text-white relative overflow-hidden flex items-center justify-between">
          <div className="absolute -top-12 -right-12 w-44 h-44 bg-[#C59B4B]/15 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center space-x-3.5 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-[#E2C37A] shadow-inner shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  Consulta Rápida de Empresa
                </h3>
                <span className="bg-[#C59B4B]/20 text-[#DFC17B] border border-[#C59B4B]/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase">
                  RECEITA FEDERAL
                </span>
              </div>
              <p className="text-xs text-slate-300 font-normal mt-0.5">
                Situação cadastral em tempo real via BrasilAPI e integração com GED
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors relative z-10 cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Formulário de Busca por CNPJ */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="space-y-2"
          >
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Informe o CNPJ da Empresa
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  value={inputQuery}
                  onChange={handleInputChange}
                  placeholder="00.000.000/0000-00 ou nome..."
                  className="w-full pl-10 pr-10 py-2.5 text-sm font-medium rounded-xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:border-[#1B357B] focus-within:ring-2 focus-within:ring-[#1B357B]/10 outline-hidden transition-all placeholder:text-slate-400 shadow-2xs"
                />
                {inputQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputQuery('');
                      setErrorMessage(null);
                    }}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-0.5 rounded-md cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="bg-gradient-to-r from-[#1B357B] to-[#23459E] hover:from-[#162B60] hover:to-[#1B357B] text-white font-semibold px-6 py-2.5 rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 shrink-0 text-xs sm:text-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#E2C37A]" />
                    <span>Consultando...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Consultar</span>
                  </>
                )}
              </button>
            </div>

            {/* Recentes ou Atalhos rápidos */}
            {recentSearches.length > 0 && !companyData && (
              <div className="flex items-center gap-1.5 pt-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-400">Consultas recentes:</span>
                {recentSearches.slice(0, 3).map((item) => (
                  <button
                    key={item.cnpj}
                    type="button"
                    onClick={() => {
                      setInputQuery(formatCnpj(item.cnpj));
                      handleSearch(item.cnpj);
                    }}
                    className="text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors truncate max-w-[200px] cursor-pointer"
                    title={`${item.name} (${formatCnpj(item.cnpj)})`}
                  >
                    {item.name || formatCnpj(item.cnpj)}
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* Estado de Erro ou Não Encontrado */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 animate-fade-in shadow-2xs">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-rose-900 leading-tight">
                  {errorMessage}
                </p>
                <p className="text-xs text-rose-700 leading-relaxed">
                  Verifique se o CNPJ digitado está correto com os 14 dígitos ou tente novamente em instantes.
                </p>
              </div>
            </div>
          )}

          {/* Cartão de Dados da Empresa */}
          {companyData && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 flex flex-col gap-5 animate-fade-in">
              {/* Cabeçalho do Resultado */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h4 className="text-lg font-black text-slate-800 tracking-tight leading-snug">
                      {companyData.razao_social}
                    </h4>
                    {getStatusBadge(companyData.descricao_situacao_cadastral)}
                  </div>
                  {companyData.nome_fantasia && (
                    <p className="text-xs text-slate-600">
                      Nome Fantasia: <span className="font-semibold text-slate-800">{companyData.nome_fantasia}</span>
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                    <span>CNPJ: <strong className="text-slate-700">{formatCnpj(companyData.cnpj)}</strong></span>
                    <button
                      onClick={() => handleCopyCnpj(formatCnpj(companyData.cnpj))}
                      className="p-1 rounded-md hover:bg-slate-100 active:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                      title="Copiar CNPJ formatado"
                    >
                      {copiedCnpj ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    {companyData.porte && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="font-sans bg-slate-100 text-slate-600 text-[11px] px-2 py-0.5 rounded-md font-medium">
                          {companyData.porte}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid de Informações Secundárias */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                
                {/* Situação Cadastral */}
                <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-100 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <Calendar className="w-3.5 h-3.5 text-[#1B357B]" />
                    <span>SITUAÇÃO CADASTRAL</span>
                  </div>
                  <p className="text-slate-800 font-semibold">
                    Data: <span className="font-normal text-slate-700">{formatBrDate(companyData.data_situacao_cadastral)}</span>
                  </p>
                  {companyData.descricao_motivo_situacao_cadastral && 
                   companyData.descricao_motivo_situacao_cadastral.trim().toUpperCase() !== 'SEM MOTIVO' && 
                   companyData.descricao_motivo_situacao_cadastral.trim().toUpperCase() !== 'SEM_MOTIVO' && (
                    <p className="text-slate-600 text-[11px] truncate">
                      Motivo: {companyData.descricao_motivo_situacao_cadastral}
                    </p>
                  )}
                </div>

                {/* Localização */}
                <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-100 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <MapPin className="w-3.5 h-3.5 text-[#1B357B]" />
                    <span>LOCALIZAÇÃO</span>
                  </div>
                  <p className="text-slate-800 font-semibold">
                    {companyData.municipio || 'Município não informado'} - {companyData.uf || 'UF'}
                  </p>
                  <p className="text-slate-500 text-[11px] truncate">
                    {[companyData.logradouro, companyData.numero, companyData.bairro].filter(Boolean).join(', ')}
                  </p>
                </div>

                {/* CNAE Principal */}
                <div className="sm:col-span-2 bg-slate-50/60 rounded-xl p-4 border border-slate-100 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <Briefcase className="w-3.5 h-3.5 text-[#1B357B]" />
                    <span>CNAE PRINCIPAL</span>
                  </div>
                  <p className="text-slate-800 font-bold">
                    {formatCnaeCode(companyData.cnae_fiscal)}
                    <span className="font-normal text-slate-700 ml-1.5">
                      {companyData.cnae_fiscal_descricao || 'Atividade principal não especificada'}
                    </span>
                  </p>
                </div>

                {/* Natureza Jurídica e Simples Nacional */}
                {(companyData.opcao_pelo_simples !== undefined || companyData.natureza_juridica) && (
                  <div className="sm:col-span-2 bg-slate-50/60 rounded-xl p-4 border border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    {companyData.natureza_juridica && (
                      <span className="text-slate-600">
                        <strong className="text-slate-800">Natureza:</strong> {companyData.natureza_juridica}
                      </span>
                    )}
                    {companyData.opcao_pelo_simples !== undefined && (
                      companyData.opcao_pelo_simples ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                          Simples Nacional: Optante
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 text-xs font-medium">
                          Simples Nacional: Não Optante
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Informações sobre documentos no GED MVRJ */}
              <div className="bg-blue-50/70 border border-blue-100/80 rounded-xl p-3.5 text-xs text-[#1B357B] font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1B357B] shrink-0" />
                <span>
                  Documentos indexados no GED MVRJ: <strong>{matchingGedCount.files} arquivo(s)</strong> e <strong>{matchingGedCount.folders} pasta(s)</strong> encontrados.
                </span>
              </div>

              {/* Botão Filtrar Documentos desta Empresa no GED */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const term = companyData.razao_social || formatCnpj(companyData.cnpj);
                    onFilterGed(term, companyData.razao_social);
                    onClose();
                  }}
                  className="w-full py-3.5 px-5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#0F1E42] to-[#1B357B] hover:opacity-95 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Filter className="w-4 h-4 text-[#E2C37A]" />
                  <span>Filtrar Documentos desta Empresa no GED</span>
                </button>
              </div>
            </div>
          )}

          {/* Dica Informativa Corporativa */}
          {!companyData && !isLoading && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-xs text-slate-500 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <ShieldCheck className="w-4 h-4 text-[#C59B4B]" />
                <span>Base Oficial Conectada</span>
              </div>
              <p className="leading-relaxed">
                A consulta obtém os dados diretamente dos registros da Receita Federal do Brasil via BrasilAPI. Você pode utilizar o resultado para localizar imediatamente todos os balanços, guias fiscais e contratos associados a esta empresa no GED.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
