import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  BellRing,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  Edit2,
  FileSearch,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserCheck,
  X,
  History,
  Building2,
  Check,
} from 'lucide-react';
import {
  Company,
  InadimplenciaAlertaAutomatico,
  InadimplenciaClassificacao,
  InadimplenciaFormaPagamento,
  InadimplenciaItem,
  InadimplenciaSummary,
  UserProfile,
} from '../types';
import {
  buildWhatsAppCobrancaUrl,
  computeAutoClassificationClient,
  createInadimplencia,
  deleteInadimplencia,
  detectOverdueCandidates,
  fetchInadimplenciaData,
  formatCurrencyBRL,
  OverdueCandidate,
  registerInadimplenciaPayment,
  subscribeInadimplenciaSync,
  updateInadimplencia,
} from '../lib/inadimplencia-service';

interface InadimplenciaPanelProps {
  currentUser: UserProfile;
  profiles?: UserProfile[];
  onAuditLog?: (action: 'INADIMPLENCIA_CREATED' | 'INADIMPLENCIA_PAYMENT' | 'INADIMPLENCIA_SETTLED' | 'INADIMPLENCIA_DELETED', targetId: string, details: Record<string, any>) => void;
  onCountChange?: (activeCount: number) => void;
}

const CLASSIFICATION_STYLES: Record<
  InadimplenciaClassificacao,
  { badge: string; dot: string; label: string; ruleDesc: string }
> = {
  Leve: {
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
    dot: 'bg-sky-400',
    label: 'Leve (Recente)',
    ruleDesc: 'Até 15 dias em atraso',
  },
  Moderada: {
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    dot: 'bg-amber-400',
    label: 'Moderada (Atenção)',
    ruleDesc: '16 a 30 dias em atraso',
  },
  Alta: {
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    dot: 'bg-orange-400',
    label: 'Alta (Crítica)',
    ruleDesc: '31 a 60 dias em atraso',
  },
  Severa: {
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/45',
    dot: 'bg-rose-500',
    label: 'Severa (Protesto)',
    ruleDesc: 'Acima de 60 dias (ou >= R$ 10 mil com +30d)',
  },
};

const FORMAS_PAGAMENTO: InadimplenciaFormaPagamento[] = [
  'PIX',
  'Boleto Bancário',
  'Transferência / TED',
  'Cartão',
  'Dinheiro',
  'Acordo Parcelado',
  'Outro',
];

export const InadimplenciaPanel: React.FC<InadimplenciaPanelProps> = ({
  currentUser,
  profiles = [],
  onAuditLog,
  onCountChange,
}) => {
  const [activeList, setActiveList] = useState<InadimplenciaItem[]>([]);
  const [settledList, setSettledList] = useState<InadimplenciaItem[]>([]);
  const [summary, setSummary] = useState<InadimplenciaSummary>({
    totalActiveCount: 0,
    totalSettledCount: 0,
    totalDebtAmount: 0,
    totalPaidActiveAmount: 0,
    totalSettledRecoveredAmount: 0,
    byClassification: { Leve: 0, Moderada: 0, Alta: 0, Severa: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'alert' | 'info';
    title: string;
    message: string;
    alerta?: InadimplenciaAlertaAutomatico;
    itemForWhatsapp?: InadimplenciaItem;
  } | null>(null);

  // Sub-tabs & filters
  const [subTab, setSubTab] = useState<'active' | 'settled'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<'ALL' | InadimplenciaClassificacao>('ALL');

  // Companies for autocomplete quick-pick
  const [companies, setCompanies] = useState<Company[]>([]);

  // Overdue candidates from GED
  const [overdueCandidates, setOverdueCandidates] = useState<OverdueCandidate[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showCandidatesPanel, setShowCandidatesPanel] = useState(false);

  // Add / Edit Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InadimplenciaItem | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [clienteNome, setClienteNome] = useState('');
  const [documentoCpfCnpj, setDocumentoCpfCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [valorPago, setValorPago] = useState('0');
  const [dataVencimento, setDataVencimento] = useState(() => new Date().toISOString().slice(0, 10));
  const [formaPagamento, setFormaPagamento] = useState<string>('PIX');
  const [dadosPagamento, setDadosPagamento] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [classificacaoManual, setClassificacaoManual] = useState(false);
  const [classificacaoSelecionada, setClassificacaoSelecionada] = useState<InadimplenciaClassificacao>('Leve');

  // Register Payment / Settle Modal state
  const [paymentModalItem, setPaymentModalItem] = useState<InadimplenciaItem | null>(null);
  const [paymentMode, setPaymentMode] = useState<'total' | 'parcial'>('total');
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentMethodInput, setPaymentMethodInput] = useState('PIX');
  const [paymentDataInput, setPaymentDataInput] = useState('');
  const [paymentComprovanteInput, setPaymentComprovanteInput] = useState('');
  const [paymentObsInput, setPaymentObsInput] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<InadimplenciaItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setErrorMsg(null);
      const data = await fetchInadimplenciaData();
      setActiveList(data.active || []);
      setSettledList(data.settled || []);
      if (data.summary) setSummary(data.summary);
      if (onCountChange) onCountChange((data.active || []).length);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao carregar dados de inadimplência.');
    } finally {
      setIsLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    loadData();
    fetch('/api/companies')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.companies && Array.isArray(data.companies)) {
          setCompanies(data.companies);
        }
      })
      .catch(() => {});

    const unsubscribe = subscribeInadimplenciaSync(() => {
      loadData();
    });
    return unsubscribe;
  }, [loadData]);

  // Live automatic classification preview while editing/creating
  const liveAutoClass = useMemo(() => {
    const vTotal = Number(String(valorTotal).replace(',', '.')) || 0;
    const vPago = Number(String(valorPago).replace(',', '.')) || 0;
    const restante = Math.max(0, vTotal - vPago);
    return computeAutoClassificationClient(dataVencimento, restante);
  }, [dataVencimento, valorTotal, valorPago]);

  const openCreateModal = (prefill?: Partial<OverdueCandidate>) => {
    setEditingItem(null);
    setClienteNome(prefill?.cliente_nome || '');
    setDocumentoCpfCnpj('');
    setTelefone(prefill?.telefone || '');
    setEmail('');
    setDescricao(prefill?.descricao || '');
    setValorTotal(prefill?.valor_total ? String(prefill.valor_total) : '');
    setValorPago('0');
    setDataVencimento(prefill?.data_vencimento || new Date().toISOString().slice(0, 10));
    setFormaPagamento('PIX');
    setDadosPagamento('');
    setObservacoes('');
    setClassificacaoManual(false);
    setClassificacaoSelecionada(prefill?.classificacao || 'Leve');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const openEditModal = (item: InadimplenciaItem) => {
    setEditingItem(item);
    setClienteNome(item.cliente_nome);
    setDocumentoCpfCnpj(item.documento_cpf_cnpj || '');
    setTelefone(item.telefone);
    setEmail(item.email || '');
    setDescricao(item.descricao);
    setValorTotal(String(item.valor_total));
    setValorPago(String(item.valor_pago));
    setDataVencimento(item.data_vencimento.slice(0, 10));
    setFormaPagamento(item.forma_pagamento || 'PIX');
    setDadosPagamento(item.dados_pagamento || '');
    setObservacoes(item.observacoes || '');
    setClassificacaoManual(Boolean(item.classificacao_manual));
    setClassificacaoSelecionada(item.classificacao);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleSelectRegisteredEntity = (value: string) => {
    if (!value) return;
    if (value.startsWith('company:')) {
      const id = value.replace('company:', '');
      const comp = companies.find((c) => c.id === id);
      if (comp) {
        setClienteNome(comp.razao_social || comp.nome_fantasia || '');
        setDocumentoCpfCnpj(comp.cnpj || '');
      }
    } else if (value.startsWith('profile:')) {
      const id = value.replace('profile:', '');
      const prof = profiles.find((p) => p.id === id);
      if (prof) {
        setClienteNome(prof.full_name || '');
        setEmail(prof.email || '');
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedTotal = Number(String(valorTotal).replace(',', '.'));
    const parsedPaid = Number(String(valorPago || '0').replace(',', '.')) || 0;

    if (!clienteNome.trim()) {
      setFormError('Informe o nome do cliente ou empresa.');
      return;
    }
    if (!telefone.trim()) {
      setFormError('Informe o telefone/WhatsApp do cliente para o sistema emitir os alertas.');
      return;
    }
    if (!Number.isFinite(parsedTotal) || parsedTotal <= 0) {
      setFormError('Informe um valor total em aberto maior que zero.');
      return;
    }

    try {
      setIsSubmittingForm(true);
      if (editingItem) {
        const res = await updateInadimplencia(editingItem.id, {
          cliente_nome: clienteNome.trim(),
          documento_cpf_cnpj: documentoCpfCnpj.trim() || undefined,
          telefone: telefone.trim(),
          email: email.trim() || undefined,
          descricao: descricao.trim() || 'Pendência Financeira',
          valor_total: parsedTotal,
          valor_pago: parsedPaid,
          data_vencimento: dataVencimento,
          forma_pagamento: formaPagamento,
          dados_pagamento: dadosPagamento.trim(),
          observacoes: observacoes.trim(),
          classificacao_manual: classificacaoManual,
          classificacao: classificacaoManual ? classificacaoSelecionada : liveAutoClass.classificacao,
        });
        setIsFormModalOpen(false);
        if (res.quitadoAutomaticamente) {
          onAuditLog?.('INADIMPLENCIA_SETTLED', res.item.id, {
            cliente: res.item.cliente_nome,
            telefone: res.item.telefone,
            valor: res.item.valor_total,
          });
          setFeedbackBanner({
            type: 'success',
            title: 'Débito Quitado Automaticamente!',
            message: `${res.item.cliente_nome} (${res.item.telefone}) atingiu 100% de pagamento e saiu automaticamente da lista de inadimplência.`,
          });
        } else {
          setFeedbackBanner({
            type: 'info',
            title: 'Registro Atualizado',
            message: `As informações e dados de pagamento de ${res.item.cliente_nome} (${res.item.telefone}) foram atualizados. Classificação: ${res.item.classificacao}.`,
          });
        }
      } else {
        const res = await createInadimplencia({
          cliente_nome: clienteNome.trim(),
          documento_cpf_cnpj: documentoCpfCnpj.trim() || undefined,
          telefone: telefone.trim(),
          email: email.trim() || undefined,
          descricao: descricao.trim() || 'Honorários / Pendência Financeira',
          valor_total: parsedTotal,
          valor_pago: parsedPaid,
          data_vencimento: dataVencimento,
          forma_pagamento: formaPagamento,
          dados_pagamento: dadosPagamento.trim(),
          observacoes: observacoes.trim(),
          classificacao_manual: classificacaoManual,
          classificacao: classificacaoManual ? classificacaoSelecionada : liveAutoClass.classificacao,
          criado_por: currentUser.full_name,
        });
        setIsFormModalOpen(false);
        onAuditLog?.('INADIMPLENCIA_CREATED', res.item.id, {
          cliente: res.item.cliente_nome,
          telefone: res.item.telefone,
          classificacao: res.item.classificacao,
          valor: res.item.valor_total,
        });

        if (res.quitadoAutomaticamente) {
          setFeedbackBanner({
            type: 'success',
            title: 'Registro Quitado Automaticamente',
            message: `${res.item.cliente_nome} já foi cadastrado com pagamento total e movido para o histórico de quitados.`,
          });
        } else {
          setFeedbackBanner({
            type: 'alert',
            title: 'Alerta Automático de Nova Inadimplência',
            message: `Cliente: ${res.alerta_automatico.cliente_nome} • Telefone: ${res.alerta_automatico.telefone} • Classificação Automática: ${res.alerta_automatico.classificacao} (${res.item.dias_em_atraso} dias em atraso).`,
            alerta: res.alerta_automatico,
            itemForWhatsapp: res.item,
          });
        }
      }
      await loadData();
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao salvar registro de inadimplência.');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const openPaymentModal = (item: InadimplenciaItem) => {
    setPaymentModalItem(item);
    setPaymentMode('total');
    setPaymentAmountInput(String(item.valor_restante));
    setPaymentMethodInput(item.forma_pagamento || 'PIX');
    setPaymentDataInput(item.dados_pagamento || '');
    setPaymentComprovanteInput('');
    setPaymentObsInput(item.observacoes || '');
    setPaymentError(null);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalItem) return;
    setPaymentError(null);

    const parsedVal =
      paymentMode === 'total'
        ? paymentModalItem.valor_restante
        : Number(String(paymentAmountInput).replace(',', '.'));

    if (paymentMode === 'parcial' && (!Number.isFinite(parsedVal) || parsedVal <= 0)) {
      setPaymentError('Informe um valor pago válido maior que zero.');
      return;
    }

    try {
      setIsSubmittingPayment(true);
      const res = await registerInadimplenciaPayment(paymentModalItem.id, {
        quitar_total: paymentMode === 'total',
        valor_pagamento: parsedVal,
        forma_pagamento: paymentMethodInput,
        dados_pagamento: paymentDataInput.trim(),
        comprovante_info: paymentComprovanteInput.trim() || undefined,
        observacoes: paymentObsInput.trim(),
        registrado_por: currentUser.full_name,
      });

      setPaymentModalItem(null);

      if (res.quitadoAutomaticamente) {
        onAuditLog?.('INADIMPLENCIA_SETTLED', res.item.id, {
          cliente: res.item.cliente_nome,
          telefone: res.item.telefone,
          valor_quitado: res.item.valor_total,
        });
        setFeedbackBanner({
          type: 'success',
          title: 'Cliente Quitado! Saída Automática da Lista',
          message: `"${res.item.cliente_nome}" (${res.item.telefone}) quitou 100% do débito (${formatCurrencyBRL(res.item.valor_total)}) e saiu automaticamente da lista de inadimplentes.`,
        });
      } else {
        onAuditLog?.('INADIMPLENCIA_PAYMENT', res.item.id, {
          cliente: res.item.cliente_nome,
          valor_pago: parsedVal,
          restante: res.item.valor_restante,
        });
        setFeedbackBanner({
          type: 'info',
          title: 'Pagamento Parcial Registrado',
          message: `Pagamento de ${formatCurrencyBRL(parsedVal)} registrado para ${res.item.cliente_nome}. Saldo restante: ${formatCurrencyBRL(res.item.valor_restante)}.`,
        });
      }

      await loadData();
    } catch (err: any) {
      setPaymentError(err?.message || 'Erro ao registrar pagamento.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await deleteInadimplencia(deleteTarget.id);
      onAuditLog?.('INADIMPLENCIA_DELETED', deleteTarget.id, {
        cliente: deleteTarget.cliente_nome,
      });
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao excluir registro.');
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDetectOverdue = async () => {
    setIsDetecting(true);
    try {
      const candidates = await detectOverdueCandidates();
      setOverdueCandidates(candidates);
      setShowCandidatesPanel(true);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleCopyPaymentData = (id: string, text: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const displayedList = useMemo(() => {
    const source = subTab === 'active' ? activeList : settledList;
    return source.filter((item) => {
      if (subTab === 'active' && classFilter !== 'ALL' && item.classificacao !== classFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          item.cliente_nome.toLowerCase().includes(q) ||
          (item.telefone || '').toLowerCase().includes(q) ||
          (item.documento_cpf_cnpj || '').toLowerCase().includes(q) ||
          (item.descricao || '').toLowerCase().includes(q) ||
          item.classificacao.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [subTab, activeList, settledList, classFilter, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Header Ações */}
      <div className="bg-gradient-to-r from-[#0B1736] via-[#132450] to-[#1B357B] rounded-2xl p-5 border border-blue-900/40 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/30 text-rose-300 shrink-0">
            <BadgeDollarSign className="w-6 h-6 text-[#DFB76C]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Controle de Inadimplência &amp; Cobrança
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-[#DFB76C]/20 border border-[#DFB76C]/40 text-[#DFB76C] text-[10px] font-bold uppercase tracking-wider">
                Classificação Automática
              </span>
            </div>
            <p className="text-xs sm:text-sm text-blue-100/75 mt-1">
              Adicione clientes inadimplentes e dados de pagamento. O sistema identifica automaticamente nome, telefone, classificação de risco e remove da lista assim que o débito for quitado.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleDetectOverdue}
            disabled={isDetecting}
            className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-bold text-slate-100 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
            title="Verificar guias vencidas cadastradas no GED"
          >
            {isDetecting ? <Loader2 className="w-4 h-4 animate-spin text-[#DFB76C]" /> : <FileSearch className="w-4 h-4 text-[#DFB76C]" />}
            <span>Detectar Vencidos no GED</span>
          </button>

          <button
            type="button"
            id="btn-add-inadimplente"
            onClick={() => openCreateModal()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-b from-[#ECD292] via-[#DFB76C] to-[#C99C42] hover:brightness-105 text-slate-950 text-xs font-extrabold flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.75]" />
            <span>Adicionar Inadimplente</span>
          </button>
        </div>
      </div>

      {/* Feedback / Automatic Alert Notification Banner */}
      {feedbackBanner && (
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200 ${
            feedbackBanner.type === 'alert'
              ? 'bg-rose-950/50 border-rose-500/40 text-rose-100'
              : feedbackBanner.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-100'
              : 'bg-blue-950/50 border-blue-500/40 text-blue-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-black/25 shrink-0 mt-0.5">
              {feedbackBanner.type === 'alert' ? (
                <BellRing className="w-5 h-5 text-rose-400 animate-pulse" />
              ) : feedbackBanner.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <Sparkles className="w-5 h-5 text-sky-400" />
              )}
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-extrabold">{feedbackBanner.title}</h4>
              <p className="text-xs opacity-90 mt-0.5 leading-relaxed">{feedbackBanner.message}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {feedbackBanner.itemForWhatsapp && (
              <a
                href={buildWhatsAppCobrancaUrl(feedbackBanner.itemForWhatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Notificar WhatsApp</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Fechar alerta"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Automatic Active Alert Roster (Sempre informa Nome, Telefone e Classificação quando há inadimplentes ativos) */}
      {activeList.length > 0 && (
        <div className="bg-rose-950/25 border border-rose-800/45 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-rose-200">
                Aviso Automático de Inadimplência Ativa ({activeList.length})
              </span>
            </div>
            <span className="text-[11px] text-rose-200/70">
              Nome, telefone e classificação exibidos automaticamente até a quitação
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeList.slice(0, 6).map((item) => {
              const cls = CLASSIFICATION_STYLES[item.classificacao] || CLASSIFICATION_STYLES.Leve;
              return (
                <div
                  key={`alert-chip-${item.id}`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#091124]/90 border border-slate-800 text-xs"
                >
                  <span className={`w-2 h-2 rounded-full ${cls.dot} shrink-0`} />
                  <span className="font-bold text-white truncate max-w-[160px]">{item.cliente_nome}</span>
                  <span className="text-slate-400">•</span>
                  <span className="font-mono text-[#DFB76C] flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {item.telefone}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${cls.badge}`}>
                    {item.classificacao}
                  </span>
                </div>
              );
            })}
            {activeList.length > 6 && (
              <span className="px-3 py-1.5 text-xs font-semibold text-rose-300">
                + {activeList.length - 6} outro(s) na lista abaixo
              </span>
            )}
          </div>
        </div>
      )}

      {/* Candidate Overdue Files Panel */}
      {showCandidatesPanel && (
        <div className="bg-[#091124] border border-amber-500/35 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-[#DFB76C]" />
              <h3 className="text-sm font-bold text-white">
                Guias / Documentos Vencidos Detectados no GED ({overdueCandidates.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowCandidatesPanel(false)}
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {overdueCandidates.length === 0 ? (
            <p className="text-xs text-slate-400">
              Nenhuma guia vencida fora da lista de inadimplência foi encontrada no GED no momento.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {overdueCandidates.map((cand) => (
                <div
                  key={cand.file_id}
                  className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{cand.cliente_nome}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {cand.telefone || 'Telefone não informado'} • {cand.dias_em_atraso}d atraso • Classificação: {cand.classificacao}
                    </p>
                    <p className="text-[11px] text-amber-300 font-semibold truncate">{cand.descricao}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCandidatesPanel(false);
                      openCreateModal(cand);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#DFB76C] text-slate-950 text-xs font-bold shrink-0 cursor-pointer hover:brightness-105"
                  >
                    + Incluir
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#091124] border border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-400 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block truncate">Inadimplentes Ativos</span>
            <strong className="text-lg sm:text-xl font-black text-white">{summary.totalActiveCount}</strong>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#091124] border border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-[#DFB76C] shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block truncate">Saldo em Aberto</span>
            <strong className="text-lg sm:text-xl font-black text-[#DFB76C] truncate block">
              {formatCurrencyBRL(summary.totalDebtAmount)}
            </strong>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#091124] border border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/15 text-orange-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block truncate">Alta / Severa</span>
            <strong className="text-lg sm:text-xl font-black text-orange-300">
              {(summary.byClassification?.Alta || 0) + (summary.byClassification?.Severa || 0)}
            </strong>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#091124] border border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block truncate">Quitados ({summary.totalSettledCount})</span>
            <strong className="text-lg sm:text-xl font-black text-emerald-400 truncate block">
              {formatCurrencyBRL(summary.totalSettledRecoveredAmount)}
            </strong>
          </div>
        </div>
      </div>

      {/* Sub-tabs + Search + Classification Filters */}
      <div className="bg-[#091124] border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800 self-start">
            <button
              type="button"
              onClick={() => setSubTab('active')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                subTab === 'active'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Inadimplentes Ativos ({activeList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('settled')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                subTab === 'settled'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Quitados / Baixados ({settledList.length})</span>
            </button>
          </div>

          <div className="relative flex-1 md:max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, telefone, CPF/CNPJ..."
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-[#DFB76C]"
            />
          </div>
        </div>

        {subTab === 'active' && (
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Classificação:
            </span>
            {(['ALL', 'Severa', 'Alta', 'Moderada', 'Leve'] as const).map((clsKey) => {
              const count =
                clsKey === 'ALL'
                  ? activeList.length
                  : summary.byClassification?.[clsKey] || 0;
              return (
                <button
                  key={clsKey}
                  type="button"
                  onClick={() => setClassFilter(clsKey)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    classFilter === clsKey
                      ? 'bg-[#DFB76C] text-slate-950 border-[#DFB76C]'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {clsKey === 'ALL' ? `Todas (${count})` : `${clsKey} (${count})`}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-700/50 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* List of Delinquent or Settled Clients */}
      {isLoading ? (
        <div className="p-10 rounded-2xl bg-[#091124] border border-slate-800 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin text-[#DFB76C]" />
          <span className="text-xs font-medium">Carregando controle de inadimplência...</span>
        </div>
      ) : displayedList.length === 0 ? (
        <div className="p-10 rounded-2xl bg-[#091124] border border-slate-800 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto opacity-80" />
          <h3 className="text-sm font-bold text-white">
            {subTab === 'active'
              ? 'Nenhum cliente na lista de inadimplência'
              : 'Nenhum registro quitado encontrado'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {subTab === 'active'
              ? 'Quando um cliente for adicionado, o sistema exibirá automaticamente nome, telefone, classificação de atraso e opções de pagamento. Ao quitar, ele sairá desta lista automaticamente.'
              : 'Clientes que quitam 100% do débito aparecem aqui automaticamente para histórico financeiro.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {displayedList.map((item) => {
            const clsStyle = CLASSIFICATION_STYLES[item.classificacao] || CLASSIFICATION_STYLES.Leve;
            const progressPct =
              item.valor_total > 0
                ? Math.min(100, Math.round((item.valor_pago / item.valor_total) * 100))
                : 0;

            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                  item.status === 'quitado'
                    ? 'bg-emerald-950/15 border-emerald-800/40'
                    : 'bg-[#091124] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                  {/* Left: Client Info, Phone, Classification & Payment Info */}
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.status === 'quitado' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[11px] font-extrabold uppercase">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Quitado • Saiu da Inadimplência</span>
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold uppercase ${clsStyle.badge}`}
                          title={clsStyle.ruleDesc}
                        >
                          <span className={`w-2 h-2 rounded-full ${clsStyle.dot}`} />
                          <span>Classificação: {item.classificacao}</span>
                          {item.dias_em_atraso > 0 && (
                            <span className="opacity-85">• {item.dias_em_atraso}d em atraso</span>
                          )}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
                        <Clock className="w-3 h-3 text-[#DFB76C]" />
                        <span>Venc.: {item.data_vencimento.split('-').reverse().join('/')}</span>
                      </span>

                      {item.documento_cpf_cnpj && (
                        <span className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
                          CPF/CNPJ: {item.documento_cpf_cnpj}
                        </span>
                      )}
                    </div>

                    {/* Nome e Telefone destacados */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight truncate">
                        {item.cliente_nome}
                      </h3>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#0B1736] border border-blue-900/50 text-xs font-mono text-[#DFB76C] self-start sm:self-auto">
                        <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{item.telefone}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{item.descricao}</p>

                    {/* Informações de Pagamento */}
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/90 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                          <CreditCard className="w-4 h-4 text-[#DFB76C]" />
                          <span>Informações de Pagamento ({item.forma_pagamento || 'PIX'})</span>
                        </div>
                        {item.dados_pagamento && (
                          <button
                            type="button"
                            onClick={() => handleCopyPaymentData(item.id, item.dados_pagamento || '')}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 cursor-pointer"
                          >
                            {copiedId === item.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-300">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copiar dados</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {item.dados_pagamento ? (
                        <p className="text-xs font-mono text-amber-200/90 bg-black/30 px-3 py-2 rounded-lg border border-slate-800 break-all">
                          {item.dados_pagamento}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 italic">
                          Nenhum dado de pagamento (chave PIX, boleto ou link) adicionado ainda — clique em Editar para informar.
                        </p>
                      )}

                      {item.observacoes && (
                        <p className="text-[11px] text-slate-400">
                          <strong>Obs.:</strong> {item.observacoes}
                        </p>
                      )}

                      {item.historico_pagamentos && item.historico_pagamentos.length > 0 && (
                        <div className="pt-1.5 border-t border-slate-800/70 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Últimos Pagamentos Registrados:
                          </span>
                          {item.historico_pagamentos.slice(0, 2).map((pg) => (
                            <div
                              key={pg.id}
                              className="text-[11px] text-emerald-300/90 flex items-center justify-between gap-2"
                            >
                              <span>
                                • {new Date(pg.data).toLocaleDateString('pt-BR')} — {formatCurrencyBRL(pg.valor)} ({pg.forma_pagamento})
                                {pg.comprovante_info ? ` • ${pg.comprovante_info}` : ''}
                              </span>
                              <span className="text-slate-500 text-[10px]">por {pg.registrado_por}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Financial Values & Actions */}
                  <div className="xl:w-72 shrink-0 flex flex-col justify-between gap-3 xl:border-l xl:border-slate-800 xl:pl-5">
                    <div className="space-y-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Valor Total:</span>
                        <span className="font-bold text-slate-200">{formatCurrencyBRL(item.valor_total)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Valor Pago:</span>
                        <span className="font-bold text-emerald-400">{formatCurrencyBRL(item.valor_pago)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-1.5 border-t border-slate-800">
                        <span className="font-bold text-slate-200">Saldo Restante:</span>
                        <span className={`font-black ${item.valor_restante <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatCurrencyBRL(item.valor_restante)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full transition-all ${item.status === 'quitado' ? 'bg-emerald-500' : 'bg-[#DFB76C]'}`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      {item.status === 'quitado' && item.data_quitacao && (
                        <p className="text-[10px] text-emerald-300 font-semibold pt-1">
                          Quitado em {new Date(item.data_quitacao).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {item.status === 'inadimplente' && (
                        <button
                          type="button"
                          onClick={() => openPaymentModal(item)}
                          className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Registrar Pagamento / Quitar</span>
                        </button>
                      )}

                      <div className="grid grid-cols-3 gap-2">
                        <a
                          href={buildWhatsAppCobrancaUrl(item)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/40 text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                          title="Enviar cobrança / aviso via WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Whats</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          title="Editar cliente e informações de pagamento"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="py-2 px-2 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          title="Excluir registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Adicionar / Editar Cliente Inadimplente & Info de Pagamento */}
      {isFormModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => !isSubmittingForm && setIsFormModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-[#091124] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
          >
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#1B357B] flex items-center justify-center">
                  <BadgeDollarSign className="w-5 h-5 text-[#DFB76C]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    {editingItem ? 'Editar Inadimplente & Pagamento' : 'Adicionar Cliente Inadimplente'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Classificação e alerta automático com nome e telefone gerados ao salvar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-700/50 text-xs text-rose-200">
                  {formError}
                </div>
              )}

              {/* Atalho: Puxar de empresa/cliente cadastrado */}
              {!editingItem && (companies.length > 0 || profiles.length > 0) && (
                <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-900/50 space-y-1.5">
                  <label className="text-[11px] font-bold text-blue-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#DFB76C]" />
                    <span>Importar dados de Empresa ou Usuário já cadastrado (opcional):</span>
                  </label>
                  <select
                    defaultValue=""
                    onChange={(e) => handleSelectRegisteredEntity(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    <option value="">-- Selecione para preencher automaticamente --</option>
                    {companies.map((c) => (
                      <option key={`c-${c.id}`} value={`company:${c.id}`}>
                        Empresa: {c.razao_social} ({c.cnpj})
                      </option>
                    ))}
                    {profiles.map((p) => (
                      <option key={`p-${p.id}`} value={`profile:${p.id}`}>
                        Usuário: {p.full_name} ({p.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dados do Cliente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-300">
                    Nome do Cliente / Empresa <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={clienteNome}
                    onChange={(e) => setClienteNome(e.target.value)}
                    placeholder="Ex: Empresa Exemplo Ltda ou João da Silva"
                    className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white focus:border-[#DFB76C] outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">
                    Telefone / WhatsApp <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(21) 99999-9999"
                    className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white focus:border-[#DFB76C] outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">CPF / CNPJ</label>
                  <input
                    type="text"
                    value={documentoCpfCnpj}
                    onChange={(e) => setDocumentoCpfCnpj(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white focus:border-[#DFB76C] outline-hidden"
                  />
                </div>
              </div>

              {/* Valores e Vencimento */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">
                    Valor em Aberto (R$) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={valorTotal}
                    onChange={(e) => setValorTotal(e.target.value)}
                    placeholder="1500.00"
                    className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white focus:border-[#DFB76C] outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Valor Já Pago (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={valorPago}
                    onChange={(e) => setValorPago(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white focus:border-[#DFB76C] outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">
                    Data de Vencimento <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white focus:border-[#DFB76C] outline-hidden"
                  />
                </div>
              </div>

              {/* Descrição */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Descrição / Competência da Cobrança</label>
                <input
                  type="text"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Honorários Contábeis 10/2026 + Impostos"
                  className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white focus:border-[#DFB76C] outline-hidden"
                />
              </div>

              {/* Prévia da Classificação Automática */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#DFB76C]" />
                    <span className="text-xs font-bold text-white">
                      Classificação Automática do Sistema:
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md border text-[11px] font-extrabold ${
                        CLASSIFICATION_STYLES[liveAutoClass.classificacao].badge
                      }`}
                    >
                      {liveAutoClass.classificacao} ({liveAutoClass.diasEmAtraso} dias em atraso)
                    </span>
                  </div>

                  <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={classificacaoManual}
                      onChange={(e) => setClassificacaoManual(e.target.checked)}
                      className="rounded border-slate-600"
                    />
                    <span>Definir manualmente</span>
                  </label>
                </div>

                {classificacaoManual && (
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {(['Leve', 'Moderada', 'Alta', 'Severa'] as InadimplenciaClassificacao[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setClassificacaoSelecionada(c)}
                        className={`py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                          classificacaoSelecionada === c
                            ? 'bg-[#DFB76C] text-slate-950 border-[#DFB76C]'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Seção Informações de Pagamento */}
              <div className="p-4 rounded-xl bg-[#0B1736]/60 border border-blue-900/40 space-y-3">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#DFB76C]">
                  <CreditCard className="w-4 h-4" />
                  <span>Informações de Pagamento</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">Forma de Pagamento</label>
                    <select
                      value={formaPagamento}
                      onChange={(e) => setFormaPagamento(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                    >
                      {FORMAS_PAGAMENTO.map((fp) => (
                        <option key={fp} value={fp}>
                          {fp}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">E-mail (opcional)</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="financeiro@cliente.com.br"
                      className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">
                    Chave PIX / Linha Digitável do Boleto / Link ou Conta para Pagamento
                  </label>
                  <input
                    type="text"
                    value={dadosPagamento}
                    onChange={(e) => setDadosPagamento(e.target.value)}
                    placeholder="Ex: Chave PIX CNPJ 00.000.000/0001-00 ou código de barras do boleto"
                    className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Observações / Acordo / Detalhes</label>
                  <textarea
                    rows={2}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Condições de parcelamento, combinados com o cliente ou instruções de baixa..."
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  disabled={isSubmittingForm}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingForm}
                  className="px-5 py-2.5 rounded-xl bg-[#DFB76C] hover:brightness-105 text-slate-950 text-xs font-extrabold flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingForm ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{editingItem ? 'Salvar Alterações' : 'Cadastrar Inadimplente'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Registrar Pagamento / Quitar (Baixa Automática) */}
      {paymentModalItem && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => !isSubmittingPayment && setPaymentModalItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#091124] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
          >
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-emerald-950/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Registrar Pagamento / Quitar Débito</h3>
                  <p className="text-[11px] text-emerald-300/80">
                    Ao quitar 100%, o cliente sai automaticamente da lista de inadimplência
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="p-5 space-y-4">
              {paymentError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-700/50 text-xs text-rose-200">
                  {paymentError}
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-white">{paymentModalItem.cliente_nome}</span>
                  <span className="text-xs font-mono text-[#DFB76C]">{paymentModalItem.telefone}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Saldo Restante para Quitação:</span>
                  <strong className="text-base text-rose-400 font-black">
                    {formatCurrencyBRL(paymentModalItem.valor_restante)}
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('total');
                    setPaymentAmountInput(String(paymentModalItem.valor_restante));
                  }}
                  className={`p-3 rounded-xl border text-xs font-extrabold text-center transition-all cursor-pointer ${
                    paymentMode === 'total'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/40'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Quitar Total (100%)
                  <span className="block text-[10px] font-normal mt-0.5">
                    Sai automaticamente da lista
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('parcial');
                    setPaymentAmountInput('');
                  }}
                  className={`p-3 rounded-xl border text-xs font-extrabold text-center transition-all cursor-pointer ${
                    paymentMode === 'parcial'
                      ? 'bg-[#DFB76C]/20 border-[#DFB76C] text-[#DFB76C] ring-1 ring-[#DFB76C]/40'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Pagamento Parcial
                  <span className="block text-[10px] font-normal mt-0.5">
                    Abate parte do saldo
                  </span>
                </button>
              </div>

              {paymentMode === 'parcial' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Valor Pago Agora (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={paymentModalItem.valor_restante}
                    required
                    value={paymentAmountInput}
                    onChange={(e) => setPaymentAmountInput(e.target.value)}
                    placeholder="Ex: 500.00"
                    className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Forma de Pagamento</label>
                  <select
                    value={paymentMethodInput}
                    onChange={(e) => setPaymentMethodInput(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    {FORMAS_PAGAMENTO.map((fp) => (
                      <option key={fp} value={fp}>
                        {fp}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Comprovante / Referência</label>
                  <input
                    type="text"
                    value={paymentComprovanteInput}
                    onChange={(e) => setPaymentComprovanteInput(e.target.value)}
                    placeholder="Ex: PIX ID E12345 ou Recibo #09"
                    className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Dados / Observações do Pagamento</label>
                <input
                  type="text"
                  value={paymentObsInput}
                  onChange={(e) => setPaymentObsInput(e.target.value)}
                  placeholder="Anotações sobre a quitação ou acordo..."
                  className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPaymentModalItem(null)}
                  disabled={isSubmittingPayment}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {paymentMode === 'total'
                          ? 'Confirmar Quitação Total'
                          : 'Registrar Pagamento'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Confirmação de Exclusão */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm"
          onClick={() => !isDeleting && setDeleteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#091124] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Excluir Registro de Inadimplência</h3>
                <p className="text-xs text-slate-400">Esta ação removerá o lançamento permanentemente.</p>
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Deseja excluir o registro de <strong>{deleteTarget.cliente_nome}</strong> ({deleteTarget.telefone}) no valor de{' '}
              <strong>{formatCurrencyBRL(deleteTarget.valor_total)}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
