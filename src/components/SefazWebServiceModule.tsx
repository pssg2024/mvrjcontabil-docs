import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  X, 
  CloudDownload, 
  ShieldCheck, 
  FileKey, 
  FileDigit, 
  FileText, 
  Truck, 
  Receipt, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Download, 
  Printer, 
  Copy, 
  ExternalLink, 
  Search, 
  Filter, 
  RefreshCw, 
  Lock, 
  Eye, 
  EyeOff, 
  UploadCloud, 
  Activity, 
  Calendar, 
  Check, 
  Archive, 
  FolderOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  HelpCircle,
  FileArchive
} from 'lucide-react';
import { Company, Folder, SefazDFeItem, SefazSyncResult, SefazWsStatusItem, CertificateMetadata } from '../types';
import { formatCnpj, cleanCnpj } from '../lib/cnpj-service';

interface SefazWebServiceModuleProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  onDocumentImported?: () => void;
}

type SefazTab = 'sync' | 'certs' | 'docs' | 'mde' | 'monitor';

export const SefazWebServiceModule: React.FC<SefazWebServiceModuleProps> = ({
  isOpen,
  onClose,
  folders,
  onDocumentImported,
}) => {
  const [activeTab, setActiveTab] = useState<SefazTab>('sync');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);

  // Tab 1: Sync DF-e parameters
  const [selectedDocType, setSelectedDocType] = useState<'all' | 'nfe' | 'cte' | 'nfse'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('last_30_days');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [autoManifest, setAutoManifest] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState(0);
  const [syncResult, setSyncResult] = useState<SefazSyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Tab 2: Certificate Management
  const [certInfo, setCertInfo] = useState<CertificateMetadata | null>(null);
  const [isLoadingCertInfo, setIsLoadingCertInfo] = useState(false);
  const [uploadCertFile, setUploadCertFile] = useState<File | null>(null);
  const [uploadCertPassword, setUploadCertPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUploadingCert, setIsUploadingCert] = useState(false);
  const [certUploadSuccess, setCertUploadSuccess] = useState<string | null>(null);
  const [certUploadError, setCertUploadError] = useState<string | null>(null);

  // Tab 3: Documents in GED
  const [downloadedDocs, setDownloadedDocs] = useState<SefazDFeItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [docFilterType, setDocFilterType] = useState<'all' | 'NFE' | 'CTE' | 'NFSE'>('all');
  const [docSearch, setDocSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Tab 4: Manifestação (MDe)
  const [mdeChave, setMdeChave] = useState('');
  const [mdeTipo, setMdeTipo] = useState<'210200' | '210210' | '210220' | '210240'>('210210');
  const [mdeJustificativa, setMdeJustificativa] = useState('');
  const [isManifesting, setIsManifesting] = useState(false);
  const [manifestResult, setManifestResult] = useState<{ message: string; protocolo: string } | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);

  // Tab 5: Servers Monitor
  const [serversStatus, setServersStatus] = useState<SefazWsStatusItem[]>([]);
  const [isLoadingServers, setIsLoadingServers] = useState(false);

  // Batch ZIP Download
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCompanies();
      fetchServersStatus();
      if (folders.length > 0) {
        const fiscal = folders.find(f => f.sector === 'Fiscal' || f.name.toLowerCase().includes('fiscal'));
        setSelectedFolderId(fiscal?.id || folders[0].id);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCompanyCertificateInfo(selectedCompanyId);
      fetchCompanyDocuments(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  const fetchCompanies = async () => {
    setIsLoadingCompanies(true);
    try {
      const res = await fetch('/api/companies');
      const data = await res.json();
      if (res.ok && data.companies && data.companies.length > 0) {
        setCompanies(data.companies);
        // Prioritize Renatinho or first
        const renatinho = data.companies.find((c: any) => c.id === 'comp-renatinho' || c.cnpj?.includes('59143345'));
        const defaultComp = renatinho || data.companies[0];
        setSelectedCompanyId(defaultComp.id);
      }
    } catch (e) {
      console.error('Erro ao buscar empresas:', e);
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  const fetchCompanyCertificateInfo = async (compId: string) => {
    setIsLoadingCertInfo(true);
    try {
      const res = await fetch(`/api/sefaz/companies/${compId}/certificate-info`);
      const data = await res.json();
      if (res.ok && data.certificate) {
        setCertInfo(data.certificate);
      } else {
        setCertInfo(null);
      }
    } catch {
      setCertInfo(null);
    } finally {
      setIsLoadingCertInfo(false);
    }
  };

  const fetchCompanyDocuments = async (compId: string) => {
    setIsLoadingDocs(true);
    try {
      const res = await fetch('/api/invoices');
      const data = await res.json();
      if (res.ok && data.invoices) {
        const filtered = data.invoices.filter((inv: any) => inv.company_id === compId);
        setDownloadedDocs(filtered);
      }
    } catch {
      setDownloadedDocs([]);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const fetchServersStatus = async () => {
    setIsLoadingServers(true);
    try {
      const res = await fetch('/api/sefaz/status-servicos');
      const data = await res.json();
      if (res.ok && data.servidores) {
        setServersStatus(data.servidores);
      }
    } catch (e) {
      console.error('Erro ao buscar status dos servidores SEFAZ:', e);
    } finally {
      setIsLoadingServers(false);
    }
  };

  const selectedCompany = useMemo(() => {
    return companies.find(c => c.id === selectedCompanyId) || null;
  }, [companies, selectedCompanyId]);

  // Handler: Run DF-e Distribution Sync
  const handleStartSync = async () => {
    if (!selectedCompanyId) {
      setSyncError('Por favor, selecione uma empresa cliente cadastrada.');
      return;
    }
    setSyncError(null);
    setSyncResult(null);
    setIsSyncing(true);
    setSyncStep(1);

    const stepTimer1 = setTimeout(() => setSyncStep(2), 700);
    const stepTimer2 = setTimeout(() => setSyncStep(3), 1400);
    const stepTimer3 = setTimeout(() => setSyncStep(4), 2100);

    try {
      const res = await fetch('/api/sefaz/distribuicao-dfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: selectedCompanyId,
          doc_types: selectedDocType,
          period: selectedPeriod,
          folder_id: selectedFolderId,
          auto_manifest: autoManifest,
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSyncResult(data);
        fetchCompanyDocuments(selectedCompanyId);
        if (onDocumentImported) onDocumentImported();
      } else {
        setSyncError(data.error || data.details || 'Falha ao consultar documentos fiscais na SEFAZ.');
      }
    } catch (err: any) {
      setSyncError(`Erro de comunicação com o servidor: ${err.message}`);
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      setIsSyncing(false);
      setSyncStep(0);
    }
  };

  // Handler: Upload Certificate
  const handleUploadCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadCertFile) {
      setCertUploadError('Selecione um arquivo de certificado digital (.pfx ou .p12).');
      return;
    }
    if (!uploadCertPassword.trim()) {
      setCertUploadError('Informe a senha do certificado digital A1 para validação.');
      return;
    }

    setIsUploadingCert(true);
    setCertUploadError(null);
    setCertUploadSuccess(null);

    const formData = new FormData();
    formData.append('certificate', uploadCertFile);
    formData.append('password', uploadCertPassword.trim());

    try {
      const res = await fetch(`/api/sefaz/companies/${selectedCompanyId}/upload-certificate`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setCertUploadSuccess('Certificado Digital A1 validado, salvo com segurança no R2 e ativado para a empresa!');
        setCertInfo(data.certificate);
        setUploadCertFile(null);
        setUploadCertPassword('');
        fetchCompanies();
        if (onDocumentImported) onDocumentImported();
      } else {
        setCertUploadError(data.details || data.error || 'Falha ao validar ou salvar o certificado digital.');
      }
    } catch (err: any) {
      setCertUploadError(`Erro ao comunicar com o servidor: ${err.message}`);
    } finally {
      setIsUploadingCert(false);
    }
  };

  // Handler: Manifestação do Destinatário
  const handleManifestar = async (e?: React.FormEvent, chaveOverride?: string, tipoOverride?: any) => {
    if (e) e.preventDefault();
    const chave = chaveOverride || mdeChave;
    const tipo = tipoOverride || mdeTipo;

    const clean = chave.replace(/\D/g, '').trim();
    if (clean.length !== 44) {
      setManifestError('A Chave de Acesso para manifestação deve conter exatamente 44 dígitos.');
      return;
    }

    setIsManifesting(true);
    setManifestError(null);
    setManifestResult(null);

    try {
      const res = await fetch('/api/sefaz/manifestar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chave_acesso: clean,
          tipo_evento: tipo,
          company_id: selectedCompanyId,
          justificativa: mdeJustificativa.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setManifestResult({ message: data.message, protocolo: data.protocolo });
        fetchCompanyDocuments(selectedCompanyId);
      } else {
        setManifestError(data.error || 'Falha ao registrar manifestação na SEFAZ.');
      }
    } catch (err: any) {
      setManifestError(`Erro de comunicação: ${err.message}`);
    } finally {
      setIsManifesting(false);
    }
  };

  // Handler: Batch ZIP Download
  const handleDownloadBatchZip = async () => {
    setIsDownloadingZip(true);
    try {
      const res = await fetch('/api/sefaz/download-batch-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_ids: downloadedDocs.map(d => d.id),
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SEFAZ_Documentos_Fiscais_${selectedCompany?.razao_social || 'MVRJ'}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (e) {
      console.error('Erro ao baixar ZIP:', e);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const filteredDocs = useMemo(() => {
    return downloadedDocs.filter(d => {
      const matchesType = docFilterType === 'all' || d.doc_type === docFilterType;
      const q = docSearch.toLowerCase().trim();
      const matchesSearch = !q || 
        d.chave_acesso?.toLowerCase().includes(q) ||
        d.numero?.includes(q) ||
        d.emit_razao_social?.toLowerCase().includes(q) ||
        d.emit_cnpj_cpf?.includes(q) ||
        d.dest_razao_social?.toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [downloadedDocs, docFilterType, docSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl h-[92vh] max-h-[900px] flex flex-col rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70 gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#DFB76C]/20 to-teal-500/20 text-[#DFB76C] border border-[#DFB76C]/30 shrink-0">
              <CloudDownload className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                  Módulo Web Services SEFAZ (DF-e)
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Ambiente Nacional Online
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  NF-e • CT-e • NFS-e
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Consulta automática por NSU, autenticação mTLS A1 (.pfx), geração de DANFE/DACTE e arquivamento no GED
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            {/* Empresa ativa no header */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
              <Building2 className="w-3.5 h-3.5 text-[#DFB76C]" />
              <span className="font-bold text-slate-200 max-w-[200px] truncate" title={selectedCompany?.razao_social}>
                {selectedCompany?.nome_fantasia || selectedCompany?.razao_social || 'Carregando...'}
              </span>
            </div>

            <button 
              id="sefaz-module-close-btn"
              onClick={onClose} 
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              title="Fechar Módulo"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex items-center gap-1 px-6 py-2 border-b border-slate-800 bg-slate-950/40 overflow-x-auto shrink-0">
          <button
            type="button"
            id="tab-sefaz-sync"
            onClick={() => setActiveTab('sync')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'sync'
                ? 'bg-gradient-to-r from-[#DFB76C] to-[#B38F46] text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <CloudDownload className="h-4 w-4" />
            <span>1. Consulta & Varredura DF-e</span>
          </button>

          <button
            type="button"
            id="tab-sefaz-certs"
            onClick={() => setActiveTab('certs')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'certs'
                ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileKey className="h-4 w-4 text-teal-400" />
            <span>2. Gestão de Certificados (.pfx)</span>
            {certInfo && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" title="Certificado Ativo" />
            )}
          </button>

          <button
            type="button"
            id="tab-sefaz-docs"
            onClick={() => setActiveTab('docs')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'docs'
                ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FolderOpen className="h-4 w-4" />
            <span>3. Documentos no GED</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 font-bold text-slate-300">
              {downloadedDocs.length}
            </span>
          </button>

          <button
            type="button"
            id="tab-sefaz-mde"
            onClick={() => setActiveTab('mde')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'mde'
                ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>4. Manifestação (MDe)</span>
          </button>

          <button
            type="button"
            id="tab-sefaz-monitor"
            onClick={() => setActiveTab('monitor')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'monitor'
                ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>5. Servidores SEFAZ</span>
          </button>
        </div>

        {/* TAB 1: CONSULTA & VARREDURA DF-E */}
        {activeTab === 'sync' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Banner Informativo */}
            <div className="rounded-2xl border border-[#DFB76C]/30 bg-gradient-to-r from-[#DFB76C]/10 via-slate-900 to-slate-900 p-5 flex items-start gap-4 shadow-sm">
              <CloudDownload className="h-6 w-6 text-[#DFB76C] shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 space-y-1.5 flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-bold text-[#DFB76C] text-sm tracking-wide">
                    Varredura Automática nos Web Services da SEFAZ por NSU
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                    Web Service: NfeDistribuicaoDFe & CteDistribuicaoDFe (v4.00)
                  </span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Utiliza o Certificado Digital A1 (.pfx) do cliente para autenticar com mTLS diretamente nos servidores da Receita Federal e SEFAZ. 
                  Puxa em lote todas as <strong>Notas Fiscais (NF-e)</strong>, <strong>Conhecimentos de Transporte (CT-e)</strong> e <strong>Notas de Serviço (NFS-e)</strong>, 
                  gerando espelhos oficiais DANFE/DACTE em PDF e arquivando os XMLs diretamente nas pastas do GED no Cloudflare R2 e Supabase.
                </p>
              </div>
            </div>

            {/* Configuração da Consulta */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Coluna Esquerda: Parâmetros */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/60 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#DFB76C]" />
                    Empresa Cliente & Certificado
                  </h4>

                  {/* Seletor de Empresa */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Selecione o Cliente / CNPJ para Consulta:
                    </label>
                    <select
                      id="sefaz-select-company"
                      value={selectedCompanyId}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-xs text-white focus:border-[#DFB76C] focus:outline-none focus:ring-1 focus:ring-[#DFB76C] cursor-pointer"
                    >
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.razao_social} ({formatCnpj(c.cnpj)}) {c.certificate_filename ? '✓ Certificado A1 Ativo' : '⚠ Sem Certificado'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status do Certificado A1 do Cliente */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        certInfo ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        <FileKey className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-200 block truncate max-w-[280px]">
                          {certInfo?.filename || selectedCompany?.certificate_filename || 'Nenhum certificado instalado'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {certInfo?.issuer || 'ICP-Brasil e-CNPJ'} • {certInfo?.days_remaining !== undefined ? `${certInfo.days_remaining} dias de validade` : 'Certificado A1'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('certs')}
                      className="text-xs font-bold text-teal-400 hover:text-teal-300 underline cursor-pointer"
                    >
                      Gerenciar Certificado
                    </button>
                  </div>

                  {/* Tipo de Documento */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Tipos de Documentos Fiscais Eletrônicos (DF-e):
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDocType('all')}
                        className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer border ${
                          selectedDocType === 'all'
                            ? 'bg-gradient-to-br from-[#DFB76C]/25 to-teal-500/25 border-[#DFB76C] text-[#DFB76C]'
                            : 'bg-slate-900 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <Archive className="w-4 h-4" />
                        <span>Todos DF-e</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedDocType('nfe')}
                        className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer border ${
                          selectedDocType === 'nfe'
                            ? 'bg-gradient-to-br from-teal-500/25 to-emerald-500/25 border-teal-500 text-teal-300'
                            : 'bg-slate-900 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <FileDigit className="w-4 h-4" />
                        <span>NF-e (Mod. 55)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedDocType('cte')}
                        className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer border ${
                          selectedDocType === 'cte'
                            ? 'bg-gradient-to-br from-blue-500/25 to-indigo-500/25 border-blue-500 text-blue-300'
                            : 'bg-slate-900 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <Truck className="w-4 h-4" />
                        <span>CT-e (Mod. 57)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedDocType('nfse')}
                        className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer border ${
                          selectedDocType === 'nfse'
                            ? 'bg-gradient-to-br from-amber-500/25 to-orange-500/25 border-amber-500 text-amber-300'
                            : 'bg-slate-900 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <Receipt className="w-4 h-4" />
                        <span>NFS-e (Serviços)</span>
                      </button>
                    </div>
                  </div>

                  {/* Período e Pasta de Destino */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Período de Apuração:
                      </label>
                      <select
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-xs text-white focus:border-[#DFB76C] focus:outline-none cursor-pointer"
                      >
                        <option value="last_7_days">Últimos 7 dias</option>
                        <option value="last_15_days">Últimos 15 dias</option>
                        <option value="last_30_days">Últimos 30 dias (Mês Atual)</option>
                        <option value="last_90_days">Últimos 90 dias (Trimestre)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Pasta de Destino no GED:
                      </label>
                      <select
                        value={selectedFolderId}
                        onChange={(e) => setSelectedFolderId(e.target.value)}
                        className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-xs text-white focus:border-[#DFB76C] focus:outline-none cursor-pointer"
                      >
                        {folders.map(f => (
                          <option key={f.id} value={f.id}>
                            📁 {f.name} ({f.sector})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Opção Auto-Manifest */}
                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={autoManifest}
                      onChange={(e) => setAutoManifest(e.target.checked)}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <span>
                      Registrar <strong>Ciência da Emissão (MDe)</strong> automaticamente para liberar o download do XML completo na SEFAZ.
                    </span>
                  </label>

                  {/* Botão de Disparo */}
                  <button
                    type="button"
                    id="btn-start-sefaz-sync"
                    disabled={isSyncing}
                    onClick={handleStartSync}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#DFB76C] via-[#E8C785] to-[#D4A755] text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg hover:brightness-105 active:scale-98 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>
                          {syncStep === 1 && 'Autenticando Certificado Digital A1 mTLS...'}
                          {syncStep === 2 && 'Conectando ao Web Service NfeDistribuicaoDFe...'}
                          {syncStep === 3 && 'Baixando e Descompactando Lotes SEFAZ...'}
                          {syncStep === 4 && 'Gerando DANFEs/DACTEs em PDF e Salvando no GED...'}
                          {syncStep === 0 && 'Consultando SEFAZ...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <CloudDownload className="w-4 h-4" />
                        <span>Iniciar Consulta Automática na SEFAZ</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Coluna Direita: Status da Conexão & Estatísticas */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/60 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-teal-400" />
                    Status da Conexão com SEFAZ
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400">Ambiente de Operação:</span>
                      <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Produção Nacional
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400">Protocolo de Comunicação:</span>
                      <span className="font-mono font-bold text-slate-200">SOAP 1.2 / TLS 1.2</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400">Armazenamento Cloud:</span>
                      <span className="font-bold text-teal-300">Cloudflare R2 + Supabase</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400">Total no GED Atual:</span>
                      <span className="font-black text-white">{downloadedDocs.length} documentos</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                    <p className="font-bold text-slate-300 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                      Auditoria Imutável e Segurança Fiscal:
                    </p>
                    <p className="leading-relaxed">
                      Cada documento consultado gera um hash SHA-256 e um registro de auditoria no Supabase com protocolo, data/hora e certificado digital utilizado.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Alertas de Erro */}
            {syncError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-4 flex items-start gap-3 text-rose-300 text-xs">
                <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block text-sm">Falha na Sincronização SEFAZ:</span>
                  <span>{syncError}</span>
                </div>
              </div>
            )}

            {/* RESULTADOS DA CONSULTA REALIZADA */}
            {syncResult && (
              <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 to-slate-900/90 p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-white">
                        Sincronização DF-e Concluída com Sucesso!
                      </h4>
                      <p className="text-xs text-emerald-300">
                        {syncResult.message}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadBatchZip}
                    disabled={isDownloadingZip}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isDownloadingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}
                    <span>Baixar Pacote ZIP (PDFs + XMLs)</span>
                  </button>
                </div>

                {/* Cards de Métricas */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total DF-e</span>
                    <span className="text-lg font-black text-white">{syncResult.total_documents}</span>
                  </div>

                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Notas NF-e</span>
                    <span className="text-lg font-black text-teal-400">{syncResult.nfe_count}</span>
                  </div>

                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Fretes CT-e</span>
                    <span className="text-lg font-black text-blue-400">{syncResult.cte_count}</span>
                  </div>

                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Serviços NFS-e</span>
                    <span className="text-lg font-black text-amber-400">{syncResult.nfse_count}</span>
                  </div>

                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Entradas</span>
                    <span className="text-sm font-black text-emerald-400">
                      R$ {syncResult.total_entradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Pasta Destino</span>
                    <span className="text-xs font-bold text-slate-200 truncate block">
                      📁 {syncResult.destination_folder_name || 'Fiscal'}
                    </span>
                  </div>
                </div>

                {/* Tabela dos Documentos Puxados */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 block">
                    Documentos Fiscais Salvos no GED:
                  </span>
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {syncResult.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs gap-3 hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                            doc.doc_type === 'NFE' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' :
                            doc.doc_type === 'CTE' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                            'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {doc.doc_type || 'NFE'}
                          </span>
                          <div className="truncate">
                            <span className="font-bold text-white block">
                              Nº {doc.numero} • {doc.emit_razao_social}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 block truncate">
                              Chave: {doc.chave_acesso}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-black text-emerald-400">
                            R$ {Number(doc.total_nota || doc.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>

                          {doc.pdf_storage_key && (
                            <a
                              href={`/api/r2/view?key=${encodeURIComponent(doc.pdf_storage_key)}&name=${encodeURIComponent(`${doc.doc_type}_${doc.numero}.pdf`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                              title="Visualizar PDF Oficial"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </a>
                          )}

                          <a
                            href={`/api/invoices/${doc.id}/xml`}
                            download
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                            title="Baixar XML SEFAZ"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: GESTÃO DE CERTIFICADOS DIGITAIS A1 (.PFX / .P12) */}
        {activeTab === 'certs' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-r from-teal-950/20 to-slate-900 p-5 flex items-start gap-4">
              <FileKey className="h-6 w-6 text-teal-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 space-y-1.5 flex-1">
                <h3 className="font-bold text-teal-300 text-sm">
                  Gestão Segura de Certificados Digitais A1 (.pfx / .p12)
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Os certificados digitais dos clientes são armazenados de forma criptografada no <strong>Cloudflare R2</strong> e associados aos CNPJs dos clientes. 
                  O sistema valida a senha com o motor OpenSSL e extrai automaticamente a autoridade certificadora (ICP-Brasil), datas de validade e número de série.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Formulário de Upload do Certificado */}
              <div className="lg:col-span-6 space-y-4">
                <form onSubmit={handleUploadCertificate} className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/60 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <UploadCloud className="w-4 h-4 text-teal-400" />
                    Enviar Novo Certificado Digital A1 (.pfx)
                  </h4>

                  {/* Seleção do Cliente */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Empresa do Cliente:
                    </label>
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-xs text-white focus:border-teal-500 focus:outline-none cursor-pointer"
                    >
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.razao_social} ({formatCnpj(c.cnpj)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Input Arquivo .pfx */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Arquivo do Certificado (.pfx ou .p12):
                    </label>
                    <input
                      type="file"
                      accept=".pfx,.p12,.pfxma"
                      onChange={(e) => setUploadCertFile(e.target.files ? e.target.files[0] : null)}
                      className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-600 file:text-white hover:file:bg-teal-500 cursor-pointer bg-slate-950 p-2 rounded-xl border border-slate-700"
                    />
                    {uploadCertFile && (
                      <span className="text-[11px] font-mono text-emerald-400 mt-1 block">
                        ✓ Selecionado: {uploadCertFile.name} ({(uploadCertFile.size / 1024).toFixed(1)} KB)
                      </span>
                    )}
                  </div>

                  {/* Senha do Certificado com Teste */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Senha do Certificado Digital:
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={uploadCertPassword}
                        onChange={(e) => setUploadCertPassword(e.target.value)}
                        placeholder="Digite a senha do arquivo .pfx"
                        className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-xs text-white pr-10 focus:border-teal-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {certUploadError && (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
                      {certUploadError}
                    </div>
                  )}

                  {certUploadSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs">
                      {certUploadSuccess}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isUploadingCert || !uploadCertFile || !uploadCertPassword}
                    className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isUploadingCert ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Validando Criptografia OpenSSL & Salvando no R2...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Validar Senha e Instalar Certificado A1</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Detalhes do Certificado Instalado */}
              <div className="lg:col-span-6 space-y-4">
                <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Certificado Ativo da Empresa
                    </h4>
                    {certInfo ? (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Autenticado ICP-Brasil
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        Pendente
                      </span>
                    )}
                  </div>

                  {isLoadingCertInfo ? (
                    <div className="flex items-center justify-center py-10 text-slate-500 text-xs">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Carregando metadados do certificado...
                    </div>
                  ) : certInfo ? (
                    <div className="space-y-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Razão Social / Titular</span>
                        <span className="font-bold text-white text-sm block">{certInfo.razao_social || selectedCompany?.razao_social}</span>
                        <span className="font-mono text-xs text-[#DFB76C]">{formatCnpj(certInfo.cnpj || selectedCompany?.cnpj || '')}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Autoridade Emissora</span>
                          <span className="font-bold text-slate-200 truncate block">{certInfo.issuer || 'ICP-Brasil'}</span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Validade Restante</span>
                          <span className="font-black text-emerald-400 block">
                            {certInfo.days_remaining !== undefined ? `${certInfo.days_remaining} dias` : 'Válido'}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Arquivo no Cloudflare R2</span>
                        <span className="font-mono text-[11px] text-slate-300 block truncate">{certInfo.filename}</span>
                      </div>

                      {/* Download do .pfx original */}
                      {certInfo.storage_key && (
                        <a
                          href={`/api/r2/view?key=${encodeURIComponent(certInfo.storage_key)}&name=${encodeURIComponent(certInfo.filename)}`}
                          download={certInfo.filename}
                          className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
                        >
                          <Download className="w-4 h-4 text-teal-400" />
                          <span>Baixar Arquivo Original do Certificado (.pfx)</span>
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-xs text-slate-500">
                      Nenhum certificado digital cadastrado para esta empresa. Envie o arquivo ao lado para ativar a integração com a SEFAZ.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DOCUMENTOS NO GED (NF-E, CT-E, NFS-E) */}
        {activeTab === 'docs' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-black text-white">
                  Documentos Fiscais no GED ({filteredDocs.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Documentos baixados dos Web Services da SEFAZ e arquivados no Cloudflare R2
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadBatchZip}
                  disabled={isDownloadingZip || filteredDocs.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {isDownloadingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>Exportar Lote ZIP</span>
                </button>
              </div>
            </div>

            {/* Filtros e Busca */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder="Buscar por Chave de Acesso, Número da NF, Fornecedor ou CNPJ..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setDocFilterType('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    docFilterType === 'all' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todos ({downloadedDocs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDocFilterType('NFE')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    docFilterType === 'NFE' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  NF-e
                </button>
                <button
                  type="button"
                  onClick={() => setDocFilterType('CTE')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    docFilterType === 'CTE' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  CT-e
                </button>
                <button
                  type="button"
                  onClick={() => setDocFilterType('NFSE')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    docFilterType === 'NFSE' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  NFS-e
                </button>
              </div>
            </div>

            {/* Lista dos Documentos */}
            <div className="space-y-2">
              {filteredDocs.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs">
                  Nenhum documento fiscal encontrado. Realize uma varredura na aba "Consulta & Varredura DF-e".
                </div>
              ) : (
                filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs hover:border-teal-500/40 transition"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase shrink-0 mt-0.5 ${
                        doc.doc_type === 'NFE' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' :
                        doc.doc_type === 'CTE' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                        'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {doc.doc_type || 'NFE'}
                      </span>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-white text-sm">
                            Nº {doc.numero} (Série {doc.serie || '1'})
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-200 font-bold truncate max-w-[280px]">
                            {doc.emit_razao_social}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 flex-wrap">
                          <span>Chave: {doc.chave_acesso}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(doc.chave_acesso)}
                            className="p-1 hover:text-white cursor-pointer"
                            title="Copiar chave de acesso"
                          >
                            {copiedKey === doc.chave_acesso ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        <div className="text-[11px] text-slate-400">
                          Emissão: {new Date(doc.created_at || new Date()).toLocaleDateString('pt-BR')} • {doc.natureza_operacao}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Valor Total</span>
                        <span className="text-sm font-black text-emerald-400">
                          R$ {Number(doc.total_nota || doc.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {doc.pdf_storage_key && (
                        <a
                          href={`/api/r2/view?key=${encodeURIComponent(doc.pdf_storage_key)}&name=${encodeURIComponent(`${doc.doc_type}_${doc.numero}.pdf`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 font-bold text-xs flex items-center gap-1.5 border border-teal-500/30 transition cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </a>
                      )}

                      <a
                        href={`/api/invoices/${doc.id}/xml`}
                        download
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>XML</span>
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: MANIFESTAÇÃO DO DESTINATÁRIO (MDE) */}
        {activeTab === 'mde' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/20 to-slate-900 p-5 flex items-start gap-4">
              <ShieldCheck className="h-6 w-6 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 space-y-1.5 flex-1">
                <h3 className="font-bold text-blue-300 text-sm">
                  Manifestação do Destinatário (MDe) - Ajuste SINIEF 07/05
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Permite ao destinatário registrar perante a Receita Federal o seu posicionamento legal em relação a notas fiscais emitidas contra seu CNPJ. 
                  A <strong>Ciência da Emissão</strong> permite ter acesso ao XML completo da nota fiscal antes da entrega da mercadoria.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Formulário de Manifestação */}
              <div className="lg:col-span-7 space-y-4">
                <form onSubmit={handleManifestar} className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/60 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    Registrar Evento de Manifestação
                  </h4>

                  {/* Chave de Acesso */}
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1.5">
                      Chave de Acesso da NF-e (44 Dígitos):
                    </label>
                    <input
                      type="text"
                      maxLength={44}
                      value={mdeChave}
                      onChange={(e) => setMdeChave(e.target.value)}
                      placeholder="Ex: 35241059143345000147550010000010871235736824"
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-xs font-mono text-[#DFB76C] focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Tipo de Evento */}
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1.5">
                      Tipo de Manifestação Legal:
                    </label>
                    <div className="space-y-2 text-xs">
                      <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="mde_tipo"
                          value="210210"
                          checked={mdeTipo === '210210'}
                          onChange={() => setMdeTipo('210210')}
                          className="text-blue-600"
                        />
                        <div>
                          <span className="font-bold text-white block">210210 - Ciência da Emissão</span>
                          <span className="text-slate-400 text-[11px]">Declara ciência sobre o documento fiscal e libera o download do XML completo.</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="mde_tipo"
                          value="210200"
                          checked={mdeTipo === '210200'}
                          onChange={() => setMdeTipo('210200')}
                          className="text-blue-600"
                        />
                        <div>
                          <span className="font-bold text-white block">210200 - Confirmação da Operação</span>
                          <span className="text-slate-400 text-[11px]">Atesta o recebimento físico das mercadorias constantes na nota fiscal.</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="mde_tipo"
                          value="210220"
                          checked={mdeTipo === '210220'}
                          onChange={() => setMdeTipo('210220')}
                          className="text-blue-600"
                        />
                        <div>
                          <span className="font-bold text-white block">210220 - Desconhecimento da Operação</span>
                          <span className="text-slate-400 text-[11px]">Informa que a operação fiscal não foi solicitada pela sua empresa (proteção contra fraudes).</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="mde_tipo"
                          value="210240"
                          checked={mdeTipo === '210240'}
                          onChange={() => setMdeTipo('210240')}
                          className="text-blue-600"
                        />
                        <div>
                          <span className="font-bold text-white block">210240 - Operação não Realizada</span>
                          <span className="text-slate-400 text-[11px]">Declara que a mercadoria não foi entregue ou houve recusa/devolução total.</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {manifestError && (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
                      {manifestError}
                    </div>
                  )}

                  {manifestResult && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs space-y-1">
                      <span className="font-bold block text-sm">{manifestResult.message}</span>
                      <span className="font-mono text-[11px] block text-emerald-400">
                        Protocolo SEFAZ: {manifestResult.protocolo}
                      </span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isManifesting || mdeChave.length !== 44}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isManifesting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Homologando Evento na SEFAZ com Certificado A1...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Transmitir Manifestação para a SEFAZ</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Informações Regulatórias */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/60 space-y-4 text-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Prazos Oficiais para Manifestação
                  </h4>

                  <div className="space-y-2.5 text-slate-300">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="font-bold text-teal-300 block mb-1">Ciência da Emissão:</span>
                      <p className="text-[11px] text-slate-400">Até 10 dias após a autorização da NF-e para manifestação preliminar.</p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="font-bold text-teal-300 block mb-1">Confirmação da Operação:</span>
                      <p className="text-[11px] text-slate-400">Até 180 dias contados a partir da data de autorização da NF-e.</p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="font-bold text-teal-300 block mb-1">Segurança Jurídica:</span>
                      <p className="text-[11px] text-slate-400">Após a Confirmação da Operação pelo destinatário, o emitente fica impedido de cancelar a NF-e.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: MONITOR DE WEBSERVICES SEFAZ */}
        {activeTab === 'monitor' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-black text-white">
                  Monitor de Disponibilidade dos Servidores SEFAZ (DF-e)
                </h3>
                <p className="text-xs text-slate-400">
                  Status em tempo real dos Web Services estaduais e do Ambiente Nacional
                </p>
              </div>

              <button
                type="button"
                onClick={fetchServersStatus}
                disabled={isLoadingServers}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingServers ? 'animate-spin' : ''}`} />
                <span>Atualizar Status</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {serversStatus.map((srv) => (
                <div
                  key={srv.uf}
                  className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs bg-slate-950 px-2 py-0.5 rounded text-white border border-slate-800">
                      {srv.uf}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      {srv.motivo}
                    </span>
                  </div>

                  <div>
                    <span className="font-bold text-white text-xs block">{srv.nome}</span>
                    <span className="text-[11px] text-slate-400 block">{srv.servico} (v{srv.versao})</span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800 text-slate-400">
                    <span>Tempo de resposta:</span>
                    <span className="font-mono font-bold text-emerald-300">{srv.tempo_resposta_ms} ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
