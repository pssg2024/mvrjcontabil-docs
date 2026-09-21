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
  Percent
} from 'lucide-react';
import { Company, Folder, InvoiceItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { formatCnpj, cleanCnpj } from '../lib/cnpj-service';

interface InvoiceEmissionViewProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  onInvoiceCreated?: () => void;
}

export const InvoiceEmissionView: React.FC<InvoiceEmissionViewProps> = ({
  isOpen,
  onClose,
  folders,
  onInvoiceCreated,
}) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<{ invoice: any; file: any } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [companyId, setCompanyId] = useState('');
  const [type, setType] = useState<'0' | '1'>('1'); // '0' = Entrada, '1' = Saída
  const [naturezaOperacao, setNaturezaOperacao] = useState('Venda de mercadoria');
  const [cfop, setCfop] = useState('5.102');
  const [serie, setSerie] = useState('1');
  const [numero, setNumero] = useState('');
  const [folderId, setFolderId] = useState('');

  // Destinatário
  const [destRazaoSocial, setDestRazaoSocial] = useState('');
  const [destCnpjCpf, setDestCnpjCpf] = useState('');
  const [destInscricaoEstadual, setDestInscricaoEstadual] = useState('');
  const [destEndereco, setDestEndereco] = useState('');

  // Items
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

  useEffect(() => {
    if (isOpen) {
      fetchCompanies();
      setSuccessData(null);
      setErrorMessage(null);
      
      // Auto-fill some fields
      setNumero(Math.floor(1000 + Math.random() * 9000).toString());
      if (folders.length > 0) {
        // Find a fiscal or financeiro folder
        const matched = folders.find(f => f.sector.toLowerCase() === 'fiscal' || f.name.toLowerCase().includes('nota') || f.name.toLowerCase().includes('financeiro'));
        setFolderId(matched?.id || folders[0].id);
      }
    }
  }, [isOpen, folders]);

  const fetchCompanies = async () => {
    setIsLoadingCompanies(true);
    try {
      const response = await fetch('/api/companies');
      const data = await response.json();
      if (response.ok && data.companies && data.companies.length > 0) {
        setCompanies(data.companies);
        setCompanyId(data.companies[0].id);
      }
    } catch (err) {
      console.error('Erro ao buscar empresas:', err);
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      { description: '', ncm: '0000.00.00', quantity: 1, unit_value: 0, hasIcms: false, icms_rate: 18 }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, key: string, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [key]: value };
    setItems(updated);
  };

  // Live calculation of totals
  const currentCompany = companies.find(c => c.id === companyId);

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
      total_nota: Number(total_produtos.toFixed(2)), // For simpler calculation here
    };
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!companyId) {
      setErrorMessage('Por favor, selecione uma empresa emitente.');
      return;
    }
    if (!folderId) {
      setErrorMessage('Por favor, selecione uma pasta no GED para salvar o PDF.');
      return;
    }
    if (!destRazaoSocial.trim() || !destCnpjCpf.trim()) {
      setErrorMessage('Por favor, preencha a Razão Social e CNPJ do destinatário.');
      return;
    }
    if (items.some(i => !i.description.trim() || i.quantity <= 0 || i.unit_value <= 0)) {
      setErrorMessage('Por favor, verifique se todos os itens têm descrição, quantidade e valor maiores que zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        company_id: companyId,
        type,
        natureza_operacao: naturezaOperacao,
        cfop,
        serie,
        numero,
        dest_razao_social: destRazaoSocial,
        dest_cnpj_cpf: destCnpjCpf,
        dest_inscricao_estadual: destInscricaoEstadual,
        dest_endereco: destEndereco,
        folder_id: folderId,
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
        setSuccessData({ invoice: data.invoice, file: data.file });
        if (onInvoiceCreated) onInvoiceCreated();
      } else {
        setErrorMessage(data.error || 'Falha ao emitir nota fiscal.');
      }
    } catch {
      setErrorMessage('Erro de conexão com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSuccessData(null);
    setErrorMessage(null);
    setDestRazaoSocial('');
    setDestCnpjCpf('');
    setDestInscricaoEstadual('');
    setDestEndereco('');
    setItems([{ description: 'PRODUTO EXEMPLO ALIMENTÍCIO', ncm: '1905.90.90', quantity: 10, unit_value: 15.50, hasIcms: true, icms_rate: 18 }]);
    setNumero(Math.floor(1000 + Math.random() * 9000).toString());
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div id="invoice-emission-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <motion.div 
          id="invoice-emission-content"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative flex h-[92vh] w-full max-w-7xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden text-neutral-800 border border-neutral-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4 bg-neutral-50/50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                <FileDigit className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-neutral-950">Emissão e Geração de Nota Fiscal (NF-e)</h2>
                <p className="text-xs text-neutral-500">Gere espelho fiscal DANFE em PDF integrado ao repositório de documentos</p>
              </div>
            </div>
            <button 
              id="invoice-emission-close-btn"
              onClick={onClose} 
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {!successData ? (
            <div className="flex flex-1 overflow-hidden">
              {/* Esquerda: Formulário de Emissão */}
              <div id="invoice-form-side" className="w-7/12 flex flex-col border-r border-neutral-100 overflow-y-auto bg-neutral-50/30 p-6 space-y-6">
                <form id="invoice-emission-form" onSubmit={handleSubmit} className="space-y-6">
                  {/* Bloco 1: Emitter & GED Target Folder */}
                  <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-4 shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-teal-600 flex items-center gap-1.5 border-b border-neutral-100 pb-2">
                      <Building className="h-4 w-4" />
                      <span>Dados do Emitente e Arquivamento</span>
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-700">Empresa Emitente *</label>
                        {isLoadingCompanies ? (
                          <div className="flex h-9 items-center px-3 border border-neutral-200 rounded-lg bg-neutral-50 text-xs text-neutral-400 gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Carregando emitentes...</span>
                          </div>
                        ) : (
                          <select
                            id="invoice-emitter-select"
                            value={companyId}
                            onChange={(e) => setCompanyId(e.target.value)}
                            className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-teal-500 font-medium"
                          >
                            {companies.map(c => (
                              <option key={c.id} value={c.id}>{c.razao_social} ({formatCnpj(c.cnpj)})</option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-700">Pasta Destino no GED *</label>
                        <select
                          id="invoice-folder-select"
                          value={folderId}
                          onChange={(e) => setFolderId(e.target.value)}
                          className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-teal-500 font-medium"
                        >
                          {folders.map(f => (
                            <option key={f.id} value={f.id}>{f.sector} - {f.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 2: Dados da Operação */}
                  <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-4 shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-teal-600 flex items-center gap-1.5 border-b border-neutral-100 pb-2">
                      <ArrowLeftRight className="h-4 w-4" />
                      <span>Dados da Operação Fiscal</span>
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1.5 col-span-2 md:col-span-1">
                        <label className="text-xs font-semibold text-neutral-700">Tipo *</label>
                        <select
                          id="invoice-type-select"
                          value={type}
                          onChange={(e) => setType(e.target.value as '0' | '1')}
                          className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs outline-none focus:border-teal-500"
                        >
                          <option value="1">1 - Saída (Vendas/Remessas)</option>
                          <option value="0">0 - Entrada (Compras/Devoluções)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5 col-span-2 md:col-span-1">
                        <label className="text-xs font-semibold text-neutral-700">Série *</label>
                        <input
                          id="invoice-serie-input"
                          type="text"
                          required
                          value={serie}
                          onChange={(e) => setSerie(e.target.value)}
                          className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-teal-500"
                        />
                      </div>

                      <div className="space-y-1.5 col-span-2 md:col-span-1">
                        <label className="text-xs font-semibold text-neutral-700">Número *</label>
                        <input
                          id="invoice-numero-input"
                          type="text"
                          required
                          value={numero}
                          onChange={(e) => setNumero(e.target.value)}
                          className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-teal-500"
                        />
                      </div>

                      <div className="space-y-1.5 col-span-2 md:col-span-1">
                        <label className="text-xs font-semibold text-neutral-700">CFOP *</label>
                        <input
                          id="invoice-cfop-input"
                          type="text"
                          required
                          placeholder="5.102"
                          value={cfop}
                          onChange={(e) => setCfop(e.target.value)}
                          className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-700">Natureza da Operação *</label>
                      <input
                        id="invoice-natureza-input"
                        type="text"
                        required
                        placeholder="Ex: Venda de mercadorias"
                        value={naturezaOperacao}
                        onChange={(e) => setNaturezaOperacao(e.target.value)}
                        className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  {/* Bloco 3: Destinatário */}
                  <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-4 shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-teal-600 flex items-center gap-1.5 border-b border-neutral-100 pb-2">
                      <Building className="h-4 w-4" />
                      <span>Destinatário / Fornecedor</span>
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-700">Nome / Razão Social *</label>
                        <input
                          id="invoice-dest-name-input"
                          type="text"
                          required
                          placeholder="Razão Social ou Nome do cliente"
                          value={destRazaoSocial}
                          onChange={(e) => setDestRazaoSocial(e.target.value)}
                          className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-teal-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-700">CNPJ / CPF *</label>
                        <input
                          id="invoice-dest-cnpj-input"
                          type="text"
                          required
                          placeholder="CNPJ ou CPF do destinatário"
                          value={destCnpjCpf}
                          onChange={(e) => setDestCnpjCpf(e.target.value)}
                          className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1.5 col-span-1">
                        <label className="text-xs font-semibold text-neutral-700">Inscrição Estadual</label>
                        <input
                          id="invoice-dest-ie-input"
                          type="text"
                          placeholder="Inscrição Estadual"
                          value={destInscricaoEstadual}
                          onChange={(e) => setDestInscricaoEstadual(e.target.value)}
                          className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-teal-500"
                        />
                      </div>

                      <div className="space-y-1.5 col-span-2">
                        <label className="text-xs font-semibold text-neutral-700">Endereço Completo</label>
                        <input
                          id="invoice-dest-address-input"
                          type="text"
                          placeholder="Rua, Número, Bairro, Cidade - UF, CEP"
                          value={destEndereco}
                          onChange={(e) => setDestEndereco(e.target.value)}
                          className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bloco 4: Itens da Nota */}
                  <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-teal-600 flex items-center gap-1.5">
                        <Package className="h-4 w-4" />
                        <span>Produtos / Serviços da Nota</span>
                      </h3>
                      <button
                        id="invoice-add-item-btn"
                        type="button"
                        onClick={handleAddItem}
                        className="flex items-center gap-1 text-[11px] font-bold text-teal-600 hover:bg-teal-50 px-2.5 py-1 rounded-lg transition"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Adicionar Item</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      {items.map((item, idx) => (
                        <div key={idx} className="p-3 border border-neutral-100 rounded-xl bg-neutral-50/50 space-y-3 relative group">
                          {items.length > 1 && (
                            <button
                              id={`invoice-remove-item-btn-${idx}`}
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="absolute top-2 right-2 p-1 text-neutral-400 hover:text-red-500 rounded-md transition"
                              title="Remover Item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          <div className="grid grid-cols-6 gap-3">
                            <div className="col-span-3 space-y-1">
                              <label className="text-[10px] font-semibold text-neutral-500">Descrição do Produto/Serviço *</label>
                              <input
                                id={`item-desc-input-${idx}`}
                                type="text"
                                required
                                value={item.description}
                                onChange={(e) => handleUpdateItem(idx, 'description', e.target.value)}
                                placeholder="Nome do produto"
                                className="w-full h-8 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs outline-none"
                              />
                            </div>

                            <div className="col-span-1 space-y-1">
                              <label className="text-[10px] font-semibold text-neutral-500">NCM *</label>
                              <input
                                id={`item-ncm-input-${idx}`}
                                type="text"
                                required
                                value={item.ncm}
                                onChange={(e) => handleUpdateItem(idx, 'ncm', e.target.value)}
                                className="w-full h-8 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs text-center outline-none"
                              />
                            </div>

                            <div className="col-span-1 space-y-1">
                              <label className="text-[10px] font-semibold text-neutral-500">Qtd *</label>
                              <input
                                id={`item-qty-input-${idx}`}
                                type="number"
                                min="1"
                                required
                                value={item.quantity}
                                onChange={(e) => handleUpdateItem(idx, 'quantity', Number(e.target.value))}
                                className="w-full h-8 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs text-center outline-none"
                              />
                            </div>

                            <div className="col-span-1 space-y-1">
                              <label className="text-[10px] font-semibold text-neutral-500">V. Unit *</label>
                              <input
                                id={`item-price-input-${idx}`}
                                type="number"
                                min="0.01"
                                step="0.01"
                                required
                                value={item.unit_value}
                                onChange={(e) => handleUpdateItem(idx, 'unit_value', Number(e.target.value))}
                                className="w-full h-8 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs outline-none text-right"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-neutral-100 pt-2 text-xs">
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-neutral-600 select-none">
                                <input
                                  id={`item-icms-toggle-${idx}`}
                                  type="checkbox"
                                  checked={item.hasIcms}
                                  onChange={(e) => handleUpdateItem(idx, 'hasIcms', e.target.checked)}
                                  className="rounded border-neutral-300 text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                                />
                                <span>Tributação ICMS</span>
                              </label>

                              {item.hasIcms && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-neutral-400 font-medium">Alíquota (%):</span>
                                  <input
                                    id={`item-icms-rate-${idx}`}
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={item.icms_rate}
                                    onChange={(e) => handleUpdateItem(idx, 'icms_rate', Number(e.target.value))}
                                    className="w-12 h-6 rounded border border-neutral-200 px-1 text-center text-[10px]"
                                  />
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-[11px]">
                              <span className="text-neutral-500">
                                ICMS: <strong className="text-neutral-800">
                                  R$ {item.hasIcms ? ((item.quantity * item.unit_value * item.icms_rate) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                                </strong>
                              </span>
                              <span className="font-semibold text-neutral-500">
                                Subtotal: <strong className="text-neutral-900 text-xs">
                                  R$ {(item.quantity * item.unit_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </strong>
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs font-medium text-red-700 shadow-sm">
                      <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="flex justify-end pt-2">
                    <button
                      id="invoice-transmit-btn"
                      type="submit"
                      disabled={isSubmitting}
                      className="flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-sm px-6 py-3 w-full shadow-md disabled:opacity-50 transition"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Transmitindo e Gerando PDF DANFE...</span>
                        </>
                      ) : (
                        <>
                          <FileCheck className="h-4 w-4" />
                          <span>Emitir NF-e Eletrônica</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Direita: Espelho Fiscal Real-Time Preview (A4 DANFE Simulator) */}
              <div id="danfe-preview-side" className="w-5/12 flex flex-col overflow-y-auto bg-neutral-100 p-6 border-l border-neutral-200">
                <div className="flex items-center justify-between mb-3 text-neutral-500">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-neutral-600">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                    <span>Visualização em Tempo Real (Espelho DANFE)</span>
                  </span>
                  <span className="text-[10px] bg-neutral-200 px-2 py-0.5 rounded-full font-medium">Layout Oficial A4</span>
                </div>

                {/* DANFE A4 Simulated Container */}
                <div className="bg-white border border-neutral-300 shadow-xl rounded-md p-4 space-y-3 text-[7px] text-neutral-800 leading-tight select-none font-mono">
                  {/* Canhoto Recibo */}
                  <div className="grid grid-cols-12 border border-neutral-400 divide-x divide-neutral-400">
                    <div className="col-span-9 p-1 flex flex-col justify-between h-9">
                      <p className="text-[5px]">RECEBEMOS DE {currentCompany?.razao_social || 'NENHUM EMITENTE SELECIONADO'} OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO</p>
                      <div className="grid grid-cols-2 text-[5px]">
                        <span>DATA DE RECEBIMENTO: ___/___/______</span>
                        <span>ASSINATURA DO RECEBEDOR: __________________________________</span>
                      </div>
                    </div>
                    <div className="col-span-3 p-1 flex flex-col items-center justify-center h-9">
                      <strong className="text-[9px]">NF-e</strong>
                      <span className="text-[7px]">Nº {numero || '000.000'}</span>
                      <span className="text-[5px]">SÉRIE {serie || '1'}</span>
                    </div>
                  </div>

                  {/* Cabeçalho */}
                  <div className="grid grid-cols-12 border border-neutral-400 divide-x divide-neutral-400 mt-2">
                    {/* Emitente */}
                    <div className="col-span-5 p-1.5 min-h-[50px] flex flex-col justify-between">
                      <div>
                        <strong className="text-[8px] block truncate">{currentCompany?.razao_social || 'SELECIONE EMITENTE'}</strong>
                        <span className="text-[5px] text-neutral-500 block">{currentCompany?.nome_fantasia || 'NOME FANTASIA'}</span>
                      </div>
                      <div className="text-[5px] mt-1">
                        <span>CNPJ: {currentCompany ? formatCnpj(currentCompany.cnpj) : '00.000.000/0000-00'}</span>
                        <br />
                        <span>IE: {currentCompany?.inscricao_estadual || 'ISENTO'}</span>
                        <br />
                        <span>Regime: {currentCompany?.regime_tributario || 'Simples Nacional'}</span>
                      </div>
                    </div>

                    {/* DANFE center box */}
                    <div className="col-span-3 p-1.5 flex flex-col items-center justify-between text-center min-h-[50px]">
                      <strong className="text-[9px]">DANFE</strong>
                      <span className="text-[4px] leading-3 text-neutral-500 font-sans block">Auxiliar da Nota Fiscal Eletrônica</span>
                      
                      <div className="border border-neutral-400 w-5 h-5 flex items-center justify-center font-bold text-[9px] rounded mt-0.5">
                        {type}
                      </div>
                      <span className="text-[5px]">0-ENTRADA / 1-SAÍDA</span>
                    </div>

                    {/* Chave de Acesso */}
                    <div className="col-span-4 p-1.5 flex flex-col justify-between min-h-[50px]">
                      <div>
                        <span className="text-[4px] uppercase font-bold text-neutral-400">CHAVE DE ACESSO (SIMULADA)</span>
                        <p className="text-[5.5px] tracking-tighter text-neutral-600 font-sans mt-0.5 break-all">
                          3526{currentCompany?.cnpj.replace(/\D/g, '').padEnd(14, '0')}55001{numero.padStart(9, '0')}1000000001
                        </p>
                      </div>

                      {/* Simulated barcode graphic */}
                      <div className="flex items-center gap-[1px] h-3.5 bg-neutral-200 p-0.5 mt-1 overflow-hidden">
                        {Array.from({ length: 30 }).map((_, i) => (
                          <div key={i} className="bg-neutral-900 h-full" style={{ width: i % 3 === 0 ? '3px' : '1px' }} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Destinatário */}
                  <div className="border border-neutral-400 mt-2">
                    <div className="bg-neutral-100 border-b border-neutral-400 px-1 py-0.5">
                      <strong className="text-[5.5px]">DESTINATÁRIO / REMETENTE</strong>
                    </div>
                    <div className="p-1.5 grid grid-cols-12 gap-1 text-[5px]">
                      <div className="col-span-6">
                        <span className="text-neutral-400 block">NOME / RAZÃO SOCIAL</span>
                        <strong className="text-[6.5px] text-neutral-900 uppercase truncate block">{destRazaoSocial || 'RAZÃO SOCIAL DO DESTINATÁRIO'}</strong>
                      </div>
                      <div className="col-span-3">
                        <span className="text-neutral-400 block">CNPJ / CPF</span>
                        <span className="text-neutral-800 block">{destCnpjCpf || '00.000.000/0000-00'}</span>
                      </div>
                      <div className="col-span-3">
                        <span className="text-neutral-400 block">INSCRIÇÃO ESTADUAL</span>
                        <span className="text-neutral-800 block">{destInscricaoEstadual || 'ISENTO'}</span>
                      </div>

                      <div className="col-span-9 mt-1">
                        <span className="text-neutral-400 block">ENDEREÇO COMPLETO</span>
                        <span className="text-neutral-800 truncate block">{destEndereco || 'AVENIDA DO DESTINATÁRIO, Nº 123'}</span>
                      </div>
                      <div className="col-span-3 mt-1">
                        <span className="text-neutral-400 block">DATA DA EMISSÃO</span>
                        <span className="text-neutral-800 block">{new Date().toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Imposto */}
                  <div className="border border-neutral-400 mt-2">
                    <div className="bg-neutral-100 border-b border-neutral-400 px-1 py-0.5">
                      <strong className="text-[5.5px]">CÁLCULO DO IMPOSTO</strong>
                    </div>
                    <div className="grid grid-cols-5 divide-x divide-neutral-400 p-1">
                      <div className="p-0.5">
                        <span className="text-neutral-400 text-[4px] block uppercase">BASE CÁLCULO ICMS</span>
                        <strong className="text-[6.5px] block">R$ {calculatedTotals.icms_base.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div className="p-0.5">
                        <span className="text-neutral-400 text-[4px] block uppercase">VALOR DO ICMS</span>
                        <strong className="text-[6.5px] block">R$ {calculatedTotals.icms_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div className="p-0.5">
                        <span className="text-neutral-400 text-[4px] block uppercase">VALOR DO FRETE</span>
                        <strong className="text-[6.5px] block">R$ 0,00</strong>
                      </div>
                      <div className="p-0.5">
                        <span className="text-neutral-400 text-[4px] block uppercase">V. TOTAL PRODUTOS</span>
                        <strong className="text-[6.5px] block">R$ {calculatedTotals.total_produtos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div className="p-0.5">
                        <span className="text-neutral-400 text-[4px] block uppercase">V. TOTAL DA NOTA</span>
                        <strong className="text-[7.5px] block text-teal-700">R$ {calculatedTotals.total_nota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Tabela de Itens */}
                  <div className="border border-neutral-400 mt-2 flex-1 flex flex-col justify-between min-h-[140px]">
                    <div>
                      <div className="bg-neutral-100 border-b border-neutral-400 px-1 py-0.5">
                        <strong className="text-[5.5px]">DADOS DOS PRODUTOS / SERVIÇOS</strong>
                      </div>
                      {/* Table Header */}
                      <div className="grid grid-cols-12 border-b border-neutral-400 px-1.5 py-0.5 font-bold text-[5px] bg-neutral-50">
                        <span className="col-span-5">DESCRIÇÃO</span>
                        <span className="col-span-1 text-center">NCM</span>
                        <span className="col-span-1 text-center">CFOP</span>
                        <span className="col-span-1 text-center">QTD</span>
                        <span className="col-span-1 text-right">UNIT</span>
                        <span className="col-span-1.5 text-right">TOTAL</span>
                        <span className="col-span-1 text-right">ICMS %</span>
                        <span className="col-span-0.5 text-right">V.ICMS</span>
                      </div>
                      {/* Table Items list */}
                      <div className="divide-y divide-neutral-200">
                        {items.map((item, idx) => (
                          <div key={idx} className="grid grid-cols-12 px-1.5 py-1 text-[5px]">
                            <span className="col-span-5 truncate font-semibold">{item.description.toUpperCase() || 'ITEM SEM DESCRIÇÃO'}</span>
                            <span className="col-span-1 text-center">{item.ncm}</span>
                            <span className="col-span-1 text-center">{cfop}</span>
                            <span className="col-span-1 text-center">{item.quantity}</span>
                            <span className="col-span-1 text-right">R$ {Number(item.unit_value).toFixed(2)}</span>
                            <span className="col-span-1.5 text-right font-bold">R$ {Number(item.quantity * item.unit_value).toFixed(2)}</span>
                            <span className="col-span-1 text-right">{item.hasIcms ? `${item.icms_rate}%` : '0%'}</span>
                            <span className="col-span-0.5 text-right">R$ {item.hasIcms ? Number((item.quantity * item.unit_value * item.icms_rate) / 100).toFixed(2) : '0.00'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Addicional Info block */}
                    <div className="border-t border-neutral-400 p-1.5 text-[4.5px] text-neutral-500 bg-neutral-50/50">
                      <strong>INFORMAÇÕES COMPLEMENTARES:</strong>
                      <p>Emitido eletronicamente via modulo integrado MVRJ Contábil GED. Regime Emitente: {currentCompany?.regime_tributario || 'Simples Nacional'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Tela de Sucesso Completa de Nota Emitida */
            <motion.div 
              id="invoice-success-screen"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center p-8 bg-emerald-50/30 overflow-y-auto"
            >
              <div className="max-w-2xl w-full bg-white rounded-2xl border border-neutral-200 shadow-2xl p-8 space-y-6 text-center">
                <div className="flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 border-4 border-emerald-50">
                    <CheckCircle2 className="h-10 w-10 animate-bounce" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-neutral-900">Nota Fiscal Eletrônica Emitida com Sucesso!</h3>
                  <p className="text-sm text-neutral-500">O espelho fiscal DANFE foi gerado em PDF, transmitido e salvo com sucesso no GED</p>
                </div>

                {/* Resumo da Nota */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-left grid grid-cols-2 gap-4 text-xs font-medium">
                  <div>
                    <span className="text-neutral-400 block text-[10px] uppercase">Emitente</span>
                    <span className="text-neutral-800">{currentCompany?.razao_social}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-[10px] uppercase">Destinatário</span>
                    <span className="text-neutral-800">{successData.invoice.dest_razao_social}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-[10px] uppercase">Número da Nota (NF-e)</span>
                    <span className="text-neutral-800 font-bold">Nº {successData.invoice.numero} (Série {successData.invoice.serie})</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-[10px] uppercase">Valor Total da Nota</span>
                    <span className="text-emerald-700 font-bold">R$ {Number(successData.invoice.total_nota).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-[10px] uppercase">Armazenamento no GED</span>
                    <span className="text-teal-600 flex items-center gap-1">
                      <FolderOpen className="h-3.5 w-3.5" />
                      <span>{folders.find(f => f.id === folderId)?.name || 'Pasta Destino'}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-[10px] uppercase">Data de Emissão</span>
                    <span className="text-neutral-800">{new Date(successData.invoice.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                </div>

                {/* Ações pós emissão */}
                <div className="grid grid-cols-3 gap-3">
                  <a
                    id="invoice-view-pdf-link"
                    href={successData.file.preview_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white py-3 px-4 text-sm font-bold text-neutral-700 hover:bg-neutral-50 transition shadow-sm"
                  >
                    <Printer className="h-4 w-4 text-neutral-500" />
                    <span>Visualizar / Imprimir</span>
                  </a>

                  <a
                    id="invoice-download-pdf-link"
                    href={successData.file.download_url || successData.file.preview_url}
                    download={`DANFE_NF_${successData.invoice.numero}.pdf`}
                    className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white py-3 px-4 text-sm font-bold text-neutral-700 hover:bg-neutral-50 transition shadow-sm"
                  >
                    <Download className="h-4 w-4 text-neutral-500" />
                    <span>Baixar DANFE PDF</span>
                  </a>

                  <button
                    id="invoice-emit-new-btn"
                    onClick={resetForm}
                    className="flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 px-4 text-sm font-bold text-white hover:bg-teal-700 transition shadow-md"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Emitir Nova Nota</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
