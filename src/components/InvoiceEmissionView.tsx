import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  X, 
  Plus, 
  Trash2, 
  FileCheck, 
  ArrowLeftRight, 
  Building, 
  FileDigit,
  Calculator,
  FolderOpen,
  Printer,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Package,
  Sparkles,
  Percent,
  CloudDownload,
  ShieldCheck,
  KeyRound,
  FileCode,
  Search,
  ExternalLink,
  Copy,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  RefreshCw,
  UploadCloud,
  FileSpreadsheet
} from 'lucide-react';
import { Company, Folder, Invoice, InvoiceItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { formatCnpj, cleanCnpj } from '../lib/cnpj-service';

interface InvoiceEmissionViewProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  onInvoiceCreated?: () => void;
  onOpenCompanyManager?: () => void;
  onOpenSefazModule?: () => void;
}

type TabType = 'chave' | 'sync' | 'list' | 'create';

export const InvoiceEmissionView: React.FC<InvoiceEmissionViewProps> = ({
  isOpen,
  onClose,
  folders,
  onInvoiceCreated,
  onOpenCompanyManager,
  onOpenSefazModule,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('chave');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  
  // Puxar por Chave de Acesso (44 Dígitos) states
  const [pullKey, setPullKey] = useState('');
  const [isPullingByKey, setIsPullingByKey] = useState(false);
  const [pullKeyError, setPullKeyError] = useState<string | null>(null);
  const [pullKeySuccess, setPullKeySuccess] = useState<any | null>(null);
  const [pullKeyFolderId, setPullKeyFolderId] = useState('');
  
  // Selected Company for actions
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  
  // SEFAZ Sync state
  const [syncType, setSyncType] = useState<'all' | '0' | '1'>('all');
  const [syncPeriod, setSyncPeriod] = useState('last_30_days');
  const [syncFolderId, setSyncFolderId] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgressStep, setSyncProgressStep] = useState(0);
  const [syncResult, setSyncResult] = useState<{
    status: string;
    message: string;
    synced_count: number;
    entradas_count: number;
    saidas_count: number;
    total_entradas: number;
    total_saidas: number;
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // XML Import state
  const [isImportingXml, setIsImportingXml] = useState(false);
  const [xmlImportSuccess, setXmlImportSuccess] = useState<string | null>(null);
  const [xmlImportError, setXmlImportError] = useState<string | null>(null);

  // Invoices List Filter states
  const [listSearch, setListSearch] = useState('');
  const [listTypeFilter, setListTypeFilter] = useState<'all' | '0' | '1'>('all');
  const [listCompanyFilter, setListCompanyFilter] = useState('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // DANFE Viewer Modal
  const [viewingDanfeInvoice, setViewingDanfeInvoice] = useState<Invoice | null>(null);

  // Form states (Tab 'create')
  const [createCompanyId, setCreateCompanyId] = useState('');
  const [createType, setCreateType] = useState<'0' | '1'>('1'); // '0' = Entrada, '1' = Saída
  const [naturezaOperacao, setNaturezaOperacao] = useState('Venda de mercadoria');
  const [cfop, setCfop] = useState('5.102');
  const [serie, setSerie] = useState('1');
  const [numero, setNumero] = useState('');
  const [createFolderId, setCreateFolderId] = useState('');
  const [destRazaoSocial, setDestRazaoSocial] = useState('');
  const [destCnpjCpf, setDestCnpjCpf] = useState('');
  const [destInscricaoEstadual, setDestInscricaoEstadual] = useState('');
  const [destEndereco, setDestEndereco] = useState('');
  const [items, setItems] = useState<Array<{
    description: string;
    ncm: string;
    quantity: number;
    unit_value: number;
    hasIcms: boolean;
    icms_rate: number;
  }>>([
    { description: 'PRODUTO EXEMPLO ALIMENTÍCIO', ncm: '1905.90.90', quantity: 10, unit_value: 15.50, hasIcms: true, icms_rate: 18 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createSuccessData, setCreateSuccessData] = useState<{ invoice: any; file: any } | null>(null);
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCompanies();
      fetchInvoices();
      setSyncResult(null);
      setSyncError(null);
      setXmlImportSuccess(null);
      setXmlImportError(null);
      setCreateSuccessData(null);
      setCreateErrorMessage(null);

      // Default folder
      if (folders.length > 0) {
        const matched = folders.find(f => 
          f.name.toLowerCase().includes('renatinho') ||
          f.sector.toLowerCase() === 'fiscal' || 
          f.name.toLowerCase().includes('nota') || 
          f.name.toLowerCase().includes('fiscal')
        );
        const resolvedId = matched?.id || folders[0].id;
        setSyncFolderId(resolvedId);
        setCreateFolderId(resolvedId);
        setPullKeyFolderId(resolvedId);
      }
      setNumero(Math.floor(1000 + Math.random() * 9000).toString());
    }
  }, [isOpen]);

  const fetchCompanies = async () => {
    setIsLoadingCompanies(true);
    try {
      const response = await fetch('/api/companies');
      const data = await response.json();
      if (response.ok && data.companies && data.companies.length > 0) {
        setCompanies(data.companies);
        if (!selectedCompanyId) {
          const renatinho = data.companies.find((c: any) => 
            c.id === 'comp-renatinho' || 
            c.cnpj?.includes('59143345') || 
            c.razao_social?.toLowerCase().includes('renatinho')
          );
          const defaultComp = renatinho || data.companies[0];
          setSelectedCompanyId(defaultComp.id);
          setCreateCompanyId(defaultComp.id);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar empresas:', err);
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  const fetchInvoices = async () => {
    setIsLoadingInvoices(true);
    try {
      const response = await fetch('/api/invoices');
      const data = await response.json();
      if (response.ok && data.invoices) {
        setInvoices(data.invoices);
      }
    } catch (err) {
      console.error('Erro ao buscar notas fiscais:', err);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);
  const hasCertificate = Boolean(
    selectedCompany && (selectedCompany.certificate_filename || selectedCompany.certificate_storage_key)
  );
  const hasPassword = Boolean(selectedCompany && selectedCompany.certificate_password);

  // Trigger SEFAZ DF-e Sync
  const handleSyncSefaz = async () => {
    if (!selectedCompanyId) {
      setSyncError('Selecione uma empresa para sincronizar.');
      return;
    }
    if (!hasCertificate) {
      setSyncError('A empresa selecionada não possui Certificado Digital A1 (.pfx) cadastrado.');
      return;
    }
    if (!hasPassword) {
      setSyncError('A senha do Certificado Digital A1 não está cadastrada para esta empresa.');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    setSyncProgressStep(1);

    const stepInterval = setInterval(() => {
      setSyncProgressStep(prev => (prev < 4 ? prev + 1 : prev));
    }, 600);

    try {
      const res = await fetch(`/api/companies/${selectedCompanyId}/sync-invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: syncType,
          period: syncPeriod,
          folder_id: syncFolderId,
        }),
      });

      clearInterval(stepInterval);
      setSyncProgressStep(4);

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSyncResult(data);
        await fetchInvoices();
        if (onInvoiceCreated) onInvoiceCreated();
      } else {
        setSyncError(data.error || data.details || 'Falha ao sincronizar com a SEFAZ.');
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      setSyncError('Erro de conexão com o servidor ao consultar a SEFAZ.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Batch XML Import
  const handleXmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImportingXml(true);
    setXmlImportError(null);
    setXmlImportSuccess(null);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('xml_files', files[i]);
    }
    formData.append('company_id', selectedCompanyId);
    formData.append('folder_id', syncFolderId);

    try {
      const res = await fetch('/api/invoices/import-xml', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setXmlImportSuccess(`${files.length} arquivo(s) XML importado(s) e convertidos em DANFE com sucesso!`);
        await fetchInvoices();
        if (onInvoiceCreated) onInvoiceCreated();
      } else {
        setXmlImportError(data.error || 'Falha ao importar arquivos XML.');
      }
    } catch {
      setXmlImportError('Erro ao comunicar com o servidor para upload dos XMLs.');
    } finally {
      setIsImportingXml(false);
      e.target.value = '';
    }
  };

  // Copy access key to clipboard
  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Real-time key decoder and validator
  const decodedKey = React.useMemo(() => {
    const clean = pullKey.replace(/\D/g, '');
    if (clean.length < 2) return null;
    const cUf = clean.slice(0, 2);
    const anoMes = clean.slice(2, 6);
    const cnpjEmit = clean.slice(6, 20);
    const modelo = clean.slice(20, 22);
    const serie = clean.slice(22, 25);
    const numero = clean.slice(25, 34);

    const ufNames: Record<string, string> = {
      '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
      '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
      '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR',
      '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF'
    };

    return {
      clean,
      validLength: clean.length === 44,
      digitsCount: clean.length,
      uf: ufNames[cUf] || `UF ${cUf}`,
      anoMes: anoMes.length === 4 ? `${anoMes.slice(2, 4)}/20${anoMes.slice(0, 2)}` : '',
      cnpjEmitente: cnpjEmit.length === 14 ? cleanCnpj(cnpjEmit) : cnpjEmit,
      modelo: modelo === '55' ? 'NF-e (Mod. 55)' : (modelo === '65' ? 'NFC-e (Mod. 65)' : modelo),
      serie: serie ? String(parseInt(serie, 10)) : '',
      numero: numero ? String(parseInt(numero, 10)) : '',
    };
  }, [pullKey]);

  // Handler to pull real invoice by 44-digit key
  const handlePullByKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPullKeyError(null);
    setPullKeySuccess(null);

    const clean = pullKey.replace(/\D/g, '').trim();
    if (clean.length !== 44) {
      setPullKeyError(`A Chave de Acesso deve conter exatamente 44 dígitos numéricos (atualmente possui ${clean.length} dígitos).`);
      return;
    }

    setIsPullingByKey(true);
    try {
      const res = await fetch('/api/invoices/pull-by-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chave_acesso: clean,
          company_id: selectedCompanyId,
          folder_id: pullKeyFolderId || syncFolderId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setPullKeySuccess(data);
        await fetchInvoices();
        if (onInvoiceCreated) onInvoiceCreated();
      } else {
        setPullKeyError(data.error || data.details || 'Falha ao puxar a nota fiscal pela chave de acesso.');
      }
    } catch (err: any) {
      setPullKeyError(`Erro de comunicação com o servidor: ${err.message}`);
    } finally {
      setIsPullingByKey(false);
    }
  };

  // Calculated totals for manual form
  const calculatedTotals = React.useMemo(() => {
    let total_produtos = 0;
    let icms_base = 0;
    let icms_total = 0;

    items.forEach(item => {
      const subtotal = item.quantity * item.unit_value;
      total_produtos += subtotal;

      if (item.hasIcms) {
        icms_base += subtotal;
        icms_total += (subtotal * item.icms_rate) / 100;
      }
    });

    return {
      total_produtos: Number(total_produtos.toFixed(2)),
      icms_base: Number(icms_base.toFixed(2)),
      icms_total: Number(icms_total.toFixed(2)),
      total_nota: Number(total_produtos.toFixed(2)),
    };
  }, [items]);

  // Submit manual emission form
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErrorMessage(null);

    if (!createCompanyId) {
      setCreateErrorMessage('Por favor, selecione uma empresa emitente.');
      return;
    }
    if (!createFolderId) {
      setCreateErrorMessage('Por favor, selecione uma pasta no GED para salvar o PDF.');
      return;
    }
    if (!destRazaoSocial.trim() || !destCnpjCpf.trim()) {
      setCreateErrorMessage('Por favor, preencha a Razão Social e CNPJ do destinatário.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        company_id: createCompanyId,
        type: createType,
        natureza_operacao: naturezaOperacao,
        cfop,
        serie,
        numero,
        dest_razao_social: destRazaoSocial,
        dest_cnpj_cpf: destCnpjCpf,
        dest_inscricao_estadual: destInscricaoEstadual,
        dest_endereco: destEndereco,
        folder_id: createFolderId,
        items: items.map(item => ({
          description: item.description,
          ncm: item.ncm,
          quantity: item.quantity,
          unit_value: item.unit_value,
          icms_rate: item.hasIcms ? item.icms_rate : 0,
        })),
      };

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setCreateSuccessData({ invoice: data.invoice, file: data.file });
        await fetchInvoices();
        if (onInvoiceCreated) onInvoiceCreated();
      } else {
        setCreateErrorMessage(data.error || 'Falha ao emitir nota fiscal.');
      }
    } catch {
      setCreateErrorMessage('Erro de conexão com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered invoices for Tab 'list'
  const filteredInvoices = invoices.filter(inv => {
    if (listTypeFilter !== 'all' && String(inv.type) !== listTypeFilter) {
      return false;
    }
    if (listCompanyFilter !== 'all' && inv.company_id !== listCompanyFilter) {
      return false;
    }
    if (listSearch.trim()) {
      const q = listSearch.toLowerCase();
      const matchNum = inv.numero?.toLowerCase().includes(q);
      const matchDest = inv.dest_razao_social?.toLowerCase().includes(q);
      const matchEmit = inv.emit_razao_social?.toLowerCase().includes(q);
      const matchCnpj = inv.dest_cnpj_cpf?.includes(q) || inv.emit_cnpj_cpf?.includes(q);
      const matchKey = inv.chave_acesso?.toLowerCase().includes(q);
      if (!matchNum && !matchDest && !matchEmit && !matchCnpj && !matchKey) {
        return false;
      }
    }
    return true;
  });

  // Stats calculation
  const totalEntradasVal = invoices
    .filter(i => String(i.type) === '0')
    .reduce((acc, i) => acc + (Number(i.total_nota) || 0), 0);
  const totalSaidasVal = invoices
    .filter(i => String(i.type) === '1')
    .reduce((acc, i) => acc + (Number(i.total_nota) || 0), 0);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div id="invoice-emission-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 md:p-6 backdrop-blur-md">
        <motion.div 
          id="invoice-emission-content"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative flex h-[94vh] w-full max-w-7xl flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/70 gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/25">
                <FileDigit className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-wide">Central de Notas Fiscais (DF-e & SEFAZ)</h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-500/15 text-teal-300 border border-teal-500/30">
                    Certificado Digital A1
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Puxe notas fiscais de entrada e saída diretamente da SEFAZ, visualize DANFEs em PDF e baixe XMLs
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-800/80 rounded-xl border border-slate-700/60">
              <button
                type="button"
                id="tab-btn-chave"
                onClick={() => setActiveTab('chave')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'chave'
                    ? 'bg-gradient-to-r from-[#DFB76C] to-[#B38F46] text-slate-950 font-bold shadow-md'
                    : 'text-amber-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <KeyRound className="h-4 w-4" />
                <span>Puxar por Chave (44 Dígitos)</span>
              </button>

              <button
                type="button"
                id="tab-btn-sefaz-sync"
                onClick={() => setActiveTab('sync')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'sync'
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <CloudDownload className="h-4 w-4" />
                <span>Puxar da SEFAZ</span>
              </button>

              <button
                type="button"
                id="tab-btn-entradas-saidas"
                onClick={() => setActiveTab('list')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'list'
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <ArrowLeftRight className="h-4 w-4" />
                <span>Entradas & Saídas</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900/60 font-bold">
                  {invoices.length}
                </span>
              </button>

              <button
                type="button"
                id="tab-btn-emitir-manual"
                onClick={() => setActiveTab('create')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'create'
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Plus className="h-4 w-4" />
                <span>Emitir Nota Manual</span>
              </button>

              {onOpenSefazModule && (
                <button
                  type="button"
                  id="tab-btn-open-sefaz-module"
                  onClick={() => {
                    onClose();
                    onOpenSefazModule();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-300 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 transition cursor-pointer"
                  title="Abrir Central Web Services SEFAZ Completa (NF-e, CT-e, NFS-e e Gestão de PFX)"
                >
                  <CloudDownload className="h-4 w-4 text-emerald-400" />
                  <span>Web Services SEFAZ (DF-e)</span>
                </button>
              )}
            </div>

            <button 
              id="invoice-emission-close-btn"
              onClick={onClose} 
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* TAB 0: PUXAR NOTA FISCAL VERDADEIRA POR CHAVE DE ACESSO (44 DÍGITOS) */}
          {activeTab === 'chave' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Instructions banner */}
              <div className="rounded-xl border border-[#DFB76C]/30 bg-[#DFB76C]/10 p-4 flex items-start gap-3">
                <KeyRound className="h-5 w-5 text-[#DFB76C] shrink-0 mt-0.5" />
                <div className="text-xs text-slate-200 space-y-1">
                  <p className="font-bold text-[#DFB76C] text-sm">
                    Puxar Nota Fiscal Verdadeira através da Chave de Acesso (44 Dígitos)
                  </p>
                  <p className="text-slate-300 leading-relaxed">
                    Insira ou cole a Chave de Acesso da NF-e para puxar diretamente as notas fiscais autênticas do cliente sem precisar ir em outro portal. 
                    O sistema decodifica instantaneamente os 44 dígitos (UF, período de apuração, CNPJ emitente, modelo, série e número), 
                    gera o espelho oficial <strong>DANFE em PDF</strong> com código de barras, cria o arquivo <strong>XML</strong> e salva automaticamente no <strong>Cloudflare R2</strong> e <strong>Supabase</strong>.
                  </p>
                </div>
              </div>

              {/* Erro ao puxar chave */}
              {pullKeyError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-4 flex items-start gap-3 text-rose-300 text-xs">
                  <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold block">Aviso na Consulta da Chave:</span>
                    <span>{pullKeyError}</span>
                  </div>
                </div>
              )}

              {/* Card de Sucesso ao Puxar */}
              {pullKeySuccess && (
                <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 to-slate-900/90 p-6 space-y-4 shadow-xl animate-in zoom-in-95 duration-200">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold text-white">
                          Nota Fiscal Puxada e Arquivada com Sucesso!
                        </h4>
                        <p className="text-xs text-emerald-300">
                          {pullKeySuccess.message || 'DANFE gerado, salvo no Cloudflare R2 e registrado no Supabase.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {pullKeySuccess.chave_info?.tipo || (pullKeySuccess.invoice?.type === '0' ? 'Entrada' : 'Saída')}
                      </span>
                    </div>
                  </div>

                  {/* Resumo da Nota Puxada */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Número da NF-e</span>
                      <span className="text-sm font-black text-white">
                        Nº {pullKeySuccess.invoice?.numero} (Série {pullKeySuccess.invoice?.serie})
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Valor Total da Nota</span>
                      <span className="text-sm font-black text-emerald-400">
                        R$ {Number(pullKeySuccess.invoice?.total_nota || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="md:col-span-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Emitente</span>
                      <span className="text-xs font-bold text-slate-200 truncate block" title={pullKeySuccess.invoice?.emit_razao_social}>
                        {pullKeySuccess.invoice?.emit_razao_social} ({pullKeySuccess.invoice?.emit_cnpj_cpf})
                      </span>
                    </div>

                    <div className="md:col-span-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Destinatário</span>
                      <span className="text-xs font-bold text-slate-200 truncate block" title={pullKeySuccess.invoice?.dest_razao_social}>
                        {pullKeySuccess.invoice?.dest_razao_social} ({pullKeySuccess.invoice?.dest_cnpj_cpf})
                      </span>
                    </div>

                    <div className="md:col-span-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Chave de Acesso</span>
                      <span className="text-xs font-mono font-semibold text-[#DFB76C] truncate block select-all">
                        {pullKeySuccess.invoice?.chave_acesso}
                      </span>
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      id="btn-view-danfe-pulled"
                      onClick={() => setViewingDanfeInvoice(pullKeySuccess.invoice)}
                      className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Visualizar DANFE Oficial</span>
                    </button>

                    <a
                      href={pullKeySuccess.xml_url || `/api/invoices/${pullKeySuccess.invoice?.id}/xml`}
                      download
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 transition cursor-pointer border border-slate-700"
                    >
                      <Download className="w-4 h-4" />
                      <span>Baixar XML SEFAZ</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setPullKey('');
                        setPullKeySuccess(null);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white font-medium text-xs transition cursor-pointer border border-slate-800"
                    >
                      Puxar Outra Chave
                    </button>
                  </div>
                </div>
              )}

              {/* Formulário de Consulta por Chave */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Coluna Esquerda: Input e Configuração */}
                <div className="lg:col-span-7 space-y-5">
                  <form onSubmit={handlePullByKey} className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/60 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-[#DFB76C]" />
                      Chave de Acesso da NF-e (44 Dígitos)
                    </h3>

                    {/* Empresa do Cliente */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Empresa do Cliente:
                      </label>
                      <select
                        id="select-company-pull-key"
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                        className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-xs text-white focus:border-[#DFB76C] focus:outline-none focus:ring-1 focus:ring-[#DFB76C] cursor-pointer"
                      >
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.razao_social} ({formatCnpj(c.cnpj)}) {c.certificate_filename ? '✓ Certificado A1' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Pasta no GED */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Pasta de Destino no GED:
                      </label>
                      <select
                        id="select-folder-pull-key"
                        value={pullKeyFolderId}
                        onChange={(e) => setPullKeyFolderId(e.target.value)}
                        className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-xs text-white focus:border-[#DFB76C] focus:outline-none focus:ring-1 focus:ring-[#DFB76C] cursor-pointer"
                      >
                        {folders.map(f => (
                          <option key={f.id} value={f.id}>
                            📁 {f.name} ({f.sector})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Campo da Chave de Acesso com contador de dígitos */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="input-chave-acesso" className="text-xs font-bold text-slate-200">
                          Digite ou Cole a Chave de Acesso:
                        </label>
                        <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                          decodedKey?.validLength
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {decodedKey?.digitsCount || 0} / 44 dígitos
                        </span>
                      </div>

                      <div className="relative">
                        <input
                          id="input-chave-acesso"
                          type="text"
                          maxLength={55}
                          value={pullKey}
                          onChange={(e) => setPullKey(e.target.value)}
                          placeholder="Ex: 3524 1059 1433 4500 0147 5500 1000 0010 8712 3573 6824"
                          className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-xs sm:text-sm font-mono tracking-wider text-[#DFB76C] placeholder:text-slate-600 focus:border-[#DFB76C] focus:outline-none focus:ring-2 focus:ring-[#DFB76C]/20 transition"
                        />
                        {pullKey && (
                          <button
                            type="button"
                            onClick={() => setPullKey('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Chaves de Teste Rápido para Renatinho */}
                    <div className="pt-1 space-y-2">
                      <span className="text-[11px] font-semibold text-slate-400 block">
                        Exemplos para Teste Imediato com Renatinho LTDA (59.143.345/0001-47):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setPullKey('35241059143345000147550010000010871235736824')}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-slate-300 border border-slate-700 hover:border-[#DFB76C] transition cursor-pointer"
                        >
                          🍺 Nota Saída Renatinho (Venda)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPullKey('35241019345892000144550010000045211839201948')}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-slate-300 border border-slate-700 hover:border-[#DFB76C] transition cursor-pointer"
                        >
                          📦 Compra Bebidas (Entrada)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPullKey('33241028109432000118550010000078901928374652')}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-slate-300 border border-slate-700 hover:border-[#DFB76C] transition cursor-pointer"
                        >
                          🏢 Fornecedor Alimentos (Entrada)
                        </button>
                      </div>
                    </div>

                    {/* Botão de Envio */}
                    <button
                      type="submit"
                      id="btn-pull-real-nfe"
                      disabled={isPullingByKey || !decodedKey?.validLength}
                      className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-[#DFB76C] via-[#E8C785] to-[#D4A755] text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg hover:brightness-105 active:scale-98 transition disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                    >
                      {isPullingByKey ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Puxando Nota Fiscal da SEFAZ & Gerando DANFE...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" />
                          <span>Puxar Nota Fiscal Verdadeira (DANFE + XML)</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Coluna Direita: Live Inspector dos 44 Dígitos */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/60 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#DFB76C]" />
                        Decodificação Automática MOC / SEFAZ
                      </h4>
                      {decodedKey?.validLength ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          44 Dígitos Válidos
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded">
                          Aguardando Chave
                        </span>
                      )}
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-400">UF de Emissão:</span>
                        <span className="font-bold text-white">{decodedKey?.uf || '—'}</span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-400">Ano e Mês:</span>
                        <span className="font-bold text-white">{decodedKey?.anoMes || '—'}</span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-400">CNPJ do Emitente:</span>
                        <span className="font-mono font-bold text-[#DFB76C]">{decodedKey?.cnpjEmitente || '—'}</span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-400">Modelo do DF-e:</span>
                        <span className="font-bold text-white">{decodedKey?.modelo || '—'}</span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-400">Série e Número da NF:</span>
                        <span className="font-bold text-white">
                          {decodedKey?.numero ? `Nº ${decodedKey.numero} (Série ${decodedKey.serie})` : '—'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-slate-300">
                        <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                        Garantia de Autenticidade & Sem Redirecionamentos:
                      </div>
                      <p className="leading-relaxed">
                        Ao consultar por aqui, o sistema gera o espelho idêntico ao da Receita Federal e arquiva o PDF e XML diretamente no Cloudflare R2 e Supabase, permitindo auditoria fiscal em qualquer dispositivo.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: PUXAR DA SEFAZ VIA CERTIFICADO DIGITAL A1 */}
          {activeTab === 'sync' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Instructions banner */}
              <div className="rounded-xl border border-teal-500/25 bg-teal-950/20 p-4 flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 space-y-1">
                  <p className="font-semibold text-teal-300">
                    Sincronização Direta com o Ambiente Nacional DF-e da SEFAZ
                  </p>
                  <p className="text-slate-400 leading-relaxed">
                    Com o Certificado Digital A1 (.pfx) do cliente e a senha cadastrados em <strong>Gestão de Empresas</strong>, 
                    o sistema autentica perante a Receita Federal / SEFAZ e puxa automaticamente todas as <strong>Notas Fiscais de Entrada</strong> (emitidas pelos fornecedores contra o CNPJ) 
                    e <strong>Notas Fiscais de Saída</strong> (emitidas pelo CNPJ), gerando os espelhos oficiais DANFE em PDF e salvando no Cloudflare R2 e GED.
                  </p>
                </div>
              </div>

              {/* Grid 2 Columns: Config & Status */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Column Left: Selector & Parameters */}
                <div className="lg:col-span-7 space-y-5">
                  <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/60 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Building className="h-4 w-4 text-teal-400" />
                      1. Selecione a Empresa Cliente
                    </h3>
                    
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Empresa Cadastrada:
                      </label>
                      <select
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-xs text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                      >
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.razao_social} ({formatCnpj(c.cnpj)}) {c.certificate_filename ? '✓ Certificado A1' : '⚠ Sem Certificado'}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Filter Type */}
                    <div className="pt-2">
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Tipo de Documentos Fiscais para Puxar:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setSyncType('all')}
                          className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                            syncType === 'all'
                              ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                              : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                          <span>Todas (Entradas & Saídas)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSyncType('0')}
                          className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                            syncType === '0'
                              ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                              : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          <ArrowDownLeft className="h-3.5 w-3.5" />
                          <span>Entradas (Compras/Fornecedores)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSyncType('1')}
                          className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                            syncType === '1'
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                              : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          <span>Saídas (Vendas/Clientes)</span>
                        </button>
                      </div>
                    </div>

                    {/* Period & Destination Folder */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Período de Emissão:
                        </label>
                        <select
                          value={syncPeriod}
                          onChange={(e) => setSyncPeriod(e.target.value)}
                          className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none cursor-pointer"
                        >
                          <option value="last_30_days">Últimos 30 dias</option>
                          <option value="current_month">Mês Atual (Outubro/2026)</option>
                          <option value="last_month">Mês Anterior (Setembro/2026)</option>
                          <option value="last_90_days">Últimos 90 dias</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Salvar DANFEs na Pasta (GED):
                        </label>
                        <select
                          value={syncFolderId}
                          onChange={(e) => setSyncFolderId(e.target.value)}
                          className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none cursor-pointer"
                        >
                          {folders.map(f => (
                            <option key={f.id} value={f.id}>
                              [{f.sector}] {f.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-3">
                      <button
                        type="button"
                        id="btn-trigger-sefaz-sync"
                        onClick={handleSyncSefaz}
                        disabled={isSyncing || !hasCertificate || !hasPassword}
                        className={`w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl text-sm font-bold text-white shadow-lg transition cursor-pointer ${
                          isSyncing || !hasCertificate || !hasPassword
                            ? 'bg-slate-700/60 text-slate-400 cursor-not-allowed border border-slate-700'
                            : 'bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-500 hover:to-emerald-500 shadow-teal-900/30 active:scale-[0.99]'
                        }`}
                      >
                        {isSyncing ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Consultando e Puxando Notas da SEFAZ...</span>
                          </>
                        ) : (
                          <>
                            <CloudDownload className="h-5 w-5" />
                            <span>Puxar Notas Fiscais da SEFAZ (Certificado A1)</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Error message */}
                    {syncError && (
                      <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                        <div>
                          <p className="font-semibold text-rose-200">Não foi possível puxar as notas:</p>
                          <p>{syncError}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Column Right: Certificate Status Card & Sync Progress */}
                <div className="lg:col-span-5 space-y-5">
                  {/* Certificate Status Card */}
                  <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/60 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-teal-400" />
                      Status do Certificado Digital A1
                    </h3>

                    {selectedCompany ? (
                      hasCertificate ? (
                        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-300">Certificado Digital:</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Ativo & Vinculado
                            </span>
                          </div>

                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between text-slate-300">
                              <span className="text-slate-400">Arquivo .pfx:</span>
                              <span className="font-mono text-emerald-300 font-medium truncate max-w-[200px]" title={selectedCompany.certificate_filename || 'certificado.pfx'}>
                                {selectedCompany.certificate_filename || 'certificado.pfx'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-slate-300">
                              <span className="text-slate-400">Senha:</span>
                              <span className="text-emerald-400 font-mono">
                                {hasPassword ? '•••••••• (Configurada)' : '⚠ Não informada'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-slate-300">
                              <span className="text-slate-400">CNPJ Titular:</span>
                              <span className="font-medium text-white">{formatCnpj(selectedCompany.cnpj)}</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-300">
                              <span className="text-slate-400">Webservice SEFAZ:</span>
                              <span className="text-teal-300 font-medium">DF-e Nacional (Online)</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-emerald-500/20">
                            <button
                              type="button"
                              onClick={() => {
                                if (onOpenCompanyManager) onOpenCompanyManager();
                              }}
                              className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>Gerenciar ou trocar certificado na Gestão de Empresas</span>
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                          <div className="flex items-start gap-2.5">
                            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-bold text-amber-300">
                                Certificado Digital A1 Não Cadastrado
                              </p>
                              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                Esta empresa ainda não possui um Certificado Digital A1 (.pfx) com senha vinculado. 
                                A SEFAZ exige a assinatura digital para liberar a consulta de DF-e de entrada e saída.
                              </p>
                            </div>
                          </div>

                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (onOpenCompanyManager) onOpenCompanyManager();
                              }}
                              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition cursor-pointer"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                              <span>Cadastrar Certificado A1 (.pfx)</span>
                            </button>
                          </div>
                        </div>
                      )
                    ) : (
                      <p className="text-xs text-slate-400">Nenhuma empresa cadastrada no sistema.</p>
                    )}
                  </div>

                  {/* Syncing Progress Steps */}
                  {isSyncing && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-800/60 rounded-xl p-5 border border-teal-500/30 space-y-3"
                    >
                      <h4 className="text-xs font-bold text-teal-300 flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Progresso da Comunicação SEFAZ:
                      </h4>

                      <div className="space-y-2 text-xs">
                        <div className={`flex items-center gap-2 ${syncProgressStep >= 1 ? 'text-teal-300 font-medium' : 'text-slate-500'}`}>
                          <div className={`h-2 w-2 rounded-full ${syncProgressStep >= 1 ? 'bg-teal-400' : 'bg-slate-700'}`} />
                          <span>1. Autenticando Certificado A1 no Ambiente Nacional DF-e...</span>
                        </div>
                        <div className={`flex items-center gap-2 ${syncProgressStep >= 2 ? 'text-teal-300 font-medium' : 'text-slate-500'}`}>
                          <div className={`h-2 w-2 rounded-full ${syncProgressStep >= 2 ? 'bg-teal-400' : 'bg-slate-700'}`} />
                          <span>2. Consultando distribuição de DF-e para o CNPJ...</span>
                        </div>
                        <div className={`flex items-center gap-2 ${syncProgressStep >= 3 ? 'text-teal-300 font-medium' : 'text-slate-500'}`}>
                          <div className={`h-2 w-2 rounded-full ${syncProgressStep >= 3 ? 'bg-teal-400' : 'bg-slate-700'}`} />
                          <span>3. Descompactando notas fiscais de entrada e saída...</span>
                        </div>
                        <div className={`flex items-center gap-2 ${syncProgressStep >= 4 ? 'text-teal-300 font-medium' : 'text-slate-500'}`}>
                          <div className={`h-2 w-2 rounded-full ${syncProgressStep >= 4 ? 'bg-teal-400' : 'bg-slate-700'}`} />
                          <span>4. Gerando espelhos DANFE em PDF e salvando no Cloudflare R2...</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Sync Result Banner */}
                  {syncResult && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-5 space-y-3"
                    >
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                        <CheckCircle2 className="h-5 w-5" />
                        <span>Sincronização Concluída com Sucesso!</span>
                      </div>
                      <p className="text-xs text-slate-300">
                        {syncResult.message}
                      </p>

                      <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                        <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/25">
                          <span className="text-[10px] text-blue-300 uppercase font-bold block">Entradas (Compras)</span>
                          <span className="text-sm font-extrabold text-white">{syncResult.entradas_count} notas</span>
                          <span className="block text-[11px] text-blue-300 font-mono">
                            R$ {syncResult.total_entradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                          <span className="text-[10px] text-emerald-300 uppercase font-bold block">Saídas (Vendas)</span>
                          <span className="text-sm font-extrabold text-white">{syncResult.saidas_count} notas</span>
                          <span className="block text-[11px] text-emerald-300 font-mono">
                            R$ {syncResult.total_saidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('list')}
                          className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                          <span>Ver Notas Fiscais Sincronizadas</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Alternative Section: Batch XML Upload */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-teal-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Ou Importar Lote de Arquivos XML (.xml) Direto do Computador
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Útil para clientes que já forneceram pastas com XMLs baixados
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <label className="flex-1 w-full flex items-center justify-center gap-3 px-4 py-3 border border-dashed border-slate-700 hover:border-teal-500 rounded-xl bg-slate-900/60 hover:bg-slate-900 text-slate-300 hover:text-white transition cursor-pointer text-xs font-semibold">
                    <UploadCloud className="h-4 w-4 text-teal-400" />
                    <span>Clique aqui ou arraste arquivos .xml de NF-e</span>
                    <input
                      type="file"
                      multiple
                      accept=".xml"
                      onChange={handleXmlUpload}
                      disabled={isImportingXml}
                      className="hidden"
                    />
                  </label>

                  {isImportingXml && (
                    <div className="flex items-center gap-2 text-xs text-teal-300">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processando e gerando DANFEs...</span>
                    </div>
                  )}
                </div>

                {xmlImportSuccess && (
                  <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {xmlImportSuccess}
                  </p>
                )}
                {xmlImportError && (
                  <p className="text-xs text-rose-400 font-medium flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {xmlImportError}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CONSULTAR NOTAS FISCAIS (ENTRADAS & SAÍDAS) */}
          {activeTab === 'list' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Stats Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[11px] text-slate-400 uppercase font-bold block">Total de Notas</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-extrabold text-white">{invoices.length}</span>
                    <span className="text-xs text-slate-400">documentos</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-blue-300 uppercase font-bold">Total Entradas (Compras)</span>
                    <ArrowDownLeft className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-extrabold text-white">
                      R$ {totalEntradasVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-emerald-300 uppercase font-bold">Total Saídas (Vendas)</span>
                    <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-extrabold text-white">
                      R$ {totalSaidasVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[11px] text-slate-400 uppercase font-bold block">Balanço do Período</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-xl font-extrabold ${totalSaidasVal >= totalEntradasVal ? 'text-emerald-400' : 'text-amber-400'}`}>
                      R$ {(totalSaidasVal - totalEntradasVal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Search and Filters Bar */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-800/40 p-3 rounded-xl border border-slate-700/60">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por número, fornecedor, cliente, CNPJ ou chave de acesso..."
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  {/* Type Filter */}
                  <select
                    value={listTypeFilter}
                    onChange={(e) => setListTypeFilter(e.target.value as any)}
                    className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none cursor-pointer"
                  >
                    <option value="all">Todas as Operações</option>
                    <option value="0">↓ Apenas Entradas (Compras)</option>
                    <option value="1">↑ Apenas Saídas (Vendas)</option>
                  </select>

                  {/* Company Filter */}
                  <select
                    value={listCompanyFilter}
                    onChange={(e) => setListCompanyFilter(e.target.value)}
                    className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none cursor-pointer max-w-[180px] truncate"
                  >
                    <option value="all">Todas as Empresas</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.razao_social}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={fetchInvoices}
                    disabled={isLoadingInvoices}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                    title="Atualizar lista"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingInvoices ? 'animate-spin text-teal-400' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Table of Invoices */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold uppercase text-slate-400">
                        <th className="py-3 px-4">Tipo</th>
                        <th className="py-3 px-4">Número / Série</th>
                        <th className="py-3 px-4">Emissão</th>
                        <th className="py-3 px-4">Emitente / Fornecedor</th>
                        <th className="py-3 px-4">Destinatário / Cliente</th>
                        <th className="py-3 px-4">CFOP</th>
                        <th className="py-3 px-4 text-right">Valor Total</th>
                        <th className="py-3 px-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {filteredInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-500">
                            <FileText className="h-8 w-8 mx-auto text-slate-600 mb-2 opacity-50" />
                            <p className="font-semibold text-slate-400">Nenhuma nota fiscal encontrada com os filtros selecionados.</p>
                            <p className="text-xs text-slate-500 mt-1">
                              Clique na aba <strong>"Puxar da SEFAZ"</strong> para sincronizar notas de entrada e saída com o Certificado Digital A1.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredInvoices.map((inv) => {
                          const isEntrada = String(inv.type) === '0';
                          return (
                            <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                {isEntrada ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                    <ArrowDownLeft className="h-3 w-3" />
                                    Entrada
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                    <ArrowUpRight className="h-3 w-3" />
                                    Saída
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                                NF-e {inv.numero} <span className="text-slate-400 text-[10px] font-normal">Série {inv.serie || '1'}</span>
                              </td>

                              <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                                {new Date(inv.created_at).toLocaleDateString('pt-BR')}
                              </td>

                              <td className="py-3.5 px-4 max-w-[200px]">
                                <div className="truncate font-semibold text-white" title={inv.emit_razao_social || 'Empresa Emitente'}>
                                  {inv.emit_razao_social || 'Empresa Emitente'}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {inv.emit_cnpj_cpf ? formatCnpj(inv.emit_cnpj_cpf) : '-'}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 max-w-[200px]">
                                <div className="truncate font-semibold text-slate-200" title={inv.dest_razao_social}>
                                  {inv.dest_razao_social}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {inv.dest_cnpj_cpf ? formatCnpj(inv.dest_cnpj_cpf) : '-'}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                                  {inv.cfop || (isEntrada ? '1.102' : '5.102')}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap text-white">
                                R$ {Number(inv.total_nota || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>

                              <td className="py-3.5 px-4 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {/* View DANFE PDF Button */}
                                  <button
                                    type="button"
                                    onClick={() => setViewingDanfeInvoice(inv)}
                                    className="px-2.5 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 hover:text-white border border-teal-500/30 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                    title="Visualizar DANFE oficial em PDF"
                                  >
                                    <FileDigit className="h-3.5 w-3.5" />
                                    <span>DANFE</span>
                                  </button>

                                  {/* Download XML Button */}
                                  <a
                                    href={`/api/invoices/${inv.id}/xml`}
                                    download={`NFe_${inv.numero}.xml`}
                                    className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                                    title="Baixar arquivo XML da NF-e"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    <span>XML</span>
                                  </a>

                                  {/* Copy Access Key */}
                                  {inv.chave_acesso && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopyKey(inv.chave_acesso!)}
                                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer"
                                      title={copiedKey === inv.chave_acesso ? 'Chave copiada!' : `Copiar Chave: ${inv.chave_acesso}`}
                                    >
                                      {copiedKey === inv.chave_acesso ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                      ) : (
                                        <Copy className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EMITIR NOTA FISCAL MANUAL */}
          {activeTab === 'create' && (
            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleManualSubmit} className="space-y-6 max-w-5xl mx-auto">
                {/* Status Banners */}
                {createSuccessData && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <div>
                        <p className="font-bold text-emerald-200">Nota Fiscal emitida e DANFE gerado com sucesso!</p>
                        <p className="text-emerald-300">
                          Arquivo salvo no Cloudflare R2 e registrado no GED.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setViewingDanfeInvoice(createSuccessData.invoice);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Visualizar DANFE</span>
                      </button>
                    </div>
                  </div>
                )}

                {createErrorMessage && (
                  <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>{createErrorMessage}</span>
                  </div>
                )}

                {/* Section 1: Dados Gerais */}
                <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/60 space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Building className="h-4 w-4 text-teal-400" />
                    Identificação do Emitente e Operação
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Empresa Emitente *</label>
                      <select
                        value={createCompanyId}
                        onChange={(e) => setCreateCompanyId(e.target.value)}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none cursor-pointer"
                        required
                      >
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.razao_social} ({formatCnpj(c.cnpj)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Tipo de Operação *</label>
                      <select
                        value={createType}
                        onChange={(e) => {
                          const val = e.target.value as '0' | '1';
                          setCreateType(val);
                          if (val === '0') {
                            setNaturezaOperacao('Compra para comercialização');
                            setCfop('1.102');
                          } else {
                            setNaturezaOperacao('Venda de mercadoria');
                            setCfop('5.102');
                          }
                        }}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none cursor-pointer"
                      >
                        <option value="1">1 - Saída (Venda / Faturamento)</option>
                        <option value="0">0 - Entrada (Compra / Devolução)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Pasta no GED *</label>
                      <select
                        value={createFolderId}
                        onChange={(e) => setCreateFolderId(e.target.value)}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none cursor-pointer"
                        required
                      >
                        {folders.map(f => (
                          <option key={f.id} value={f.id}>[{f.sector}] {f.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Natureza da Operação *</label>
                      <input
                        type="text"
                        value={naturezaOperacao}
                        onChange={(e) => setNaturezaOperacao(e.target.value)}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">CFOP Principal *</label>
                      <input
                        type="text"
                        value={cfop}
                        onChange={(e) => setCfop(e.target.value)}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Número da NF-e *</label>
                      <input
                        type="text"
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Destinatário */}
                <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/60 space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="h-4 w-4 text-teal-400" />
                    Destinatário / Remetente
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Nome / Razão Social *</label>
                      <input
                        type="text"
                        value={destRazaoSocial}
                        onChange={(e) => setDestRazaoSocial(e.target.value)}
                        placeholder="Ex: Comercial Alvorada Ltda"
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">CNPJ / CPF *</label>
                      <input
                        type="text"
                        value={destCnpjCpf}
                        onChange={(e) => setDestCnpjCpf(e.target.value)}
                        placeholder="00.000.000/0000-00"
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Inscrição Estadual (Opcional)</label>
                      <input
                        type="text"
                        value={destInscricaoEstadual}
                        onChange={(e) => setDestInscricaoEstadual(e.target.value)}
                        placeholder="ISENTO ou número da IE"
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Endereço Completo</label>
                      <input
                        type="text"
                        value={destEndereco}
                        onChange={(e) => setDestEndereco(e.target.value)}
                        placeholder="Rua, Número, Bairro, Cidade - UF"
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Itens da Nota */}
                <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Package className="h-4 w-4 text-teal-400" />
                      Itens / Produtos da NF-e
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setItems([
                          ...items,
                          { description: '', ncm: '0000.00.00', quantity: 1, unit_value: 0, hasIcms: false, icms_rate: 18 }
                        ]);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Adicionar Item</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {items.map((item, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/70 grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-12 sm:col-span-4">
                          <label className="block text-[10px] text-slate-400 mb-1 font-semibold uppercase">Descrição do Item *</label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => {
                              const updated = [...items];
                              updated[idx].description = e.target.value;
                              setItems(updated);
                            }}
                            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-white focus:border-teal-500 focus:outline-none"
                            required
                          />
                        </div>

                        <div className="col-span-4 sm:col-span-2">
                          <label className="block text-[10px] text-slate-400 mb-1 font-semibold uppercase">NCM</label>
                          <input
                            type="text"
                            value={item.ncm}
                            onChange={(e) => {
                              const updated = [...items];
                              updated[idx].ncm = e.target.value;
                              setItems(updated);
                            }}
                            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-white focus:border-teal-500 focus:outline-none font-mono"
                          />
                        </div>

                        <div className="col-span-4 sm:col-span-2">
                          <label className="block text-[10px] text-slate-400 mb-1 font-semibold uppercase">Qtd *</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const updated = [...items];
                              updated[idx].quantity = Number(e.target.value) || 0;
                              setItems(updated);
                            }}
                            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-white focus:border-teal-500 focus:outline-none font-mono"
                            required
                          />
                        </div>

                        <div className="col-span-4 sm:col-span-2">
                          <label className="block text-[10px] text-slate-400 mb-1 font-semibold uppercase">Valor Unit (R$) *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={item.unit_value}
                            onChange={(e) => {
                              const updated = [...items];
                              updated[idx].unit_value = Number(e.target.value) || 0;
                              setItems(updated);
                            }}
                            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-white focus:border-teal-500 focus:outline-none font-mono"
                            required
                          />
                        </div>

                        <div className="col-span-12 sm:col-span-2 flex items-center justify-between gap-2">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase block">Subtotal</span>
                            <span className="text-xs font-mono font-bold text-teal-300">
                              R$ {(item.quantity * item.unit_value).toFixed(2)}
                            </span>
                          </div>

                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setItems(items.filter((_, i) => i !== idx))}
                              className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                              title="Remover Item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals Summary */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Base ICMS</span>
                        <span className="text-xs font-mono font-bold text-white">
                          R$ {calculatedTotals.icms_base.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Valor ICMS</span>
                        <span className="text-xs font-mono font-bold text-teal-400">
                          R$ {calculatedTotals.icms_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 uppercase font-bold block">Valor Total da Nota</span>
                      <span className="text-xl font-mono font-extrabold text-teal-300">
                        R$ {calculatedTotals.total_nota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Gerando DANFE em PDF...</span>
                      </>
                    ) : (
                      <>
                        <FileCheck className="h-4 w-4" />
                        <span>Gerar e Salvar DANFE</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* DANFE PDF VIEWER MODAL */}
          {viewingDanfeInvoice && (
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-800 px-6 py-3.5 bg-slate-950">
                  <div className="flex items-center gap-3">
                    <FileDigit className="h-5 w-5 text-teal-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        DANFE - NF-e Nº {viewingDanfeInvoice.numero} ({viewingDanfeInvoice.type === '0' ? 'Entrada' : 'Saída'})
                      </h3>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {viewingDanfeInvoice.chave_acesso || 'Chave SEFAZ Gerada'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Direct download */}
                    {viewingDanfeInvoice.document_id && (
                      <a
                        href={`/api/files/${viewingDanfeInvoice.document_id}/download`}
                        download={`DANFE_NF_${viewingDanfeInvoice.numero}.pdf`}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Baixar PDF</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => setViewingDanfeInvoice(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* PDF Frame */}
                <div className="flex-1 bg-slate-950 p-2 overflow-hidden flex items-center justify-center">
                  {viewingDanfeInvoice.document_id ? (
                    <iframe
                      src={`/api/files/${viewingDanfeInvoice.document_id}/view`}
                      className="w-full h-full rounded-xl border border-slate-800 bg-white"
                      title="DANFE Oficial"
                    />
                  ) : viewingDanfeInvoice.pdf_storage_key ? (
                    <iframe
                      src={`/api/r2/view?key=${encodeURIComponent(viewingDanfeInvoice.pdf_storage_key)}`}
                      className="w-full h-full rounded-xl border border-slate-800 bg-white"
                      title="DANFE Oficial"
                    />
                  ) : (
                    <div className="text-center text-slate-400 text-xs">
                      <p>O espelho DANFE desta nota foi gerado e registrado no GED.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
