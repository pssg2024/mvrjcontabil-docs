import React, { useState, useMemo } from 'react';
import { DocumentFile, UserProfile } from '../types';
import { 
  getExecutiveDueBadge, 
  isDueAlert, 
  formatCurrency, 
  cleanPhoneNumber, 
  buildWhatsAppDueNoticeMessage 
} from '../lib/due-date-utils';
import { 
  X, 
  Search, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar, 
  Phone, 
  Building2, 
  FileText, 
  ExternalLink, 
  Copy, 
  Check, 
  Filter, 
  DollarSign, 
  Edit3,
  RefreshCw,
  MessageSquare
} from 'lucide-react';

interface DueNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: DocumentFile[];
  profiles?: UserProfile[];
  onUpdateFile: (fileId: string, updates: Partial<DocumentFile>) => Promise<void>;
  onOpenFilePreview?: (file: DocumentFile) => void;
}

export const DueNoticeModal: React.FC<DueNoticeModalProps> = ({
  isOpen,
  onClose,
  files,
  profiles = [],
  onUpdateFile,
  onOpenFilePreview,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'sent'>('pending');
  const [dueFilter, setDueFilter] = useState<'alert_only' | 'all' | 'expired' | 'urgent'>('alert_only');
  
  // Inline editing state for quick edits
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editCompany, setEditCompany] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDocType, setEditDocType] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Copied message state for visual feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Batch trigger state
  const [batchActionNotice, setBatchActionNotice] = useState<string | null>(null);

  // Extract unique company names from all files and profiles
  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    files.forEach(f => {
      if (f.company_name?.trim()) set.add(f.company_name.trim());
    });
    profiles.forEach(p => {
      if (p.full_name?.trim() && p.role === 'client') set.add(p.full_name.trim());
    });
    return Array.from(set).sort();
  }, [files, profiles]);

  // Filter files that have due_date or are relevant for tax guide dispatch
  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      if (file.is_archived) return false;

      // Filter by due date type
      if (dueFilter === 'alert_only') {
        if (!isDueAlert(file.due_date)) return false;
      } else if (dueFilter === 'expired') {
        const badge = getExecutiveDueBadge(file.due_date);
        if (badge.status !== 'expired') return false;
      } else if (dueFilter === 'urgent') {
        const badge = getExecutiveDueBadge(file.due_date);
        if (badge.status !== 'urgent') return false;
      }

      // Filter by company
      if (selectedCompanyFilter !== 'all') {
        if ((file.company_name || '').toLowerCase() !== selectedCompanyFilter.toLowerCase()) {
          return false;
        }
      }

      // Filter by dispatch notification status
      if (statusFilter === 'pending' && file.notification_sent) return false;
      if (statusFilter === 'sent' && !file.notification_sent) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = file.name.toLowerCase().includes(q);
        const companyMatch = (file.company_name || '').toLowerCase().includes(q);
        const docTypeMatch = (file.document_type || '').toLowerCase().includes(q);
        const phoneMatch = (file.client_phone || '').includes(q);
        const tagsMatch = file.tags.some(t => t.toLowerCase().includes(q));
        if (!nameMatch && !companyMatch && !docTypeMatch && !phoneMatch && !tagsMatch) {
          return false;
        }
      }

      return true;
    });
  }, [files, dueFilter, selectedCompanyFilter, statusFilter, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const active = files.filter(f => !f.is_archived && f.due_date);
    const expiredCount = active.filter(f => {
      const b = getExecutiveDueBadge(f.due_date);
      return b.status === 'expired';
    }).length;
    const urgentCount = active.filter(f => {
      const b = getExecutiveDueBadge(f.due_date);
      return b.status === 'urgent';
    }).length;
    const pendingDispatch = active.filter(f => isDueAlert(f.due_date) && !f.notification_sent).length;
    const sentDispatch = active.filter(f => f.notification_sent).length;

    return {
      totalDue: active.length,
      expiredCount,
      urgentCount,
      pendingDispatch,
      sentDispatch,
    };
  }, [files]);

  if (!isOpen) return null;

  const handleStartEdit = (file: DocumentFile) => {
    setEditingFileId(file.id);
    setEditCompany(file.company_name || '');
    setEditPhone(file.client_phone || '');
    setEditDueDate(file.due_date || '');
    setEditDocType(file.document_type || 'DAS - Simples Nacional');
    setEditAmount(file.amount ? String(file.amount) : '');
  };

  const handleSaveEdit = async () => {
    if (!editingFileId) return;
    setIsSaving(true);
    try {
      await onUpdateFile(editingFileId, {
        company_name: editCompany.trim() || undefined,
        client_phone: editPhone.trim() || undefined,
        due_date: editDueDate || undefined,
        document_type: editDocType.trim() || undefined,
        amount: editAmount ? parseFloat(editAmount) : undefined,
      });
      setEditingFileId(null);
    } catch (err: any) {
      alert('Erro ao salvar alterações: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleNotification = async (file: DocumentFile) => {
    const nextVal = !file.notification_sent;
    try {
      await onUpdateFile(file.id, { notification_sent: nextVal });
    } catch (err: any) {
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  const handleDispatchWhatsApp = async (file: DocumentFile) => {
    const phone = cleanPhoneNumber(file.client_phone);
    if (!phone) {
      alert('Por favor, informe o telefone do cliente com DDD antes de disparar pelo WhatsApp.');
      handleStartEdit(file);
      return;
    }

    const message = buildWhatsAppDueNoticeMessage({
      companyName: file.company_name,
      documentName: file.name,
      documentType: file.document_type,
      dueDate: file.due_date,
      amount: file.amount,
      portalUrl: window.location.origin,
    });

    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    
    // Automatically mark as sent
    try {
      await onUpdateFile(file.id, { notification_sent: true });
    } catch (err) {
      console.warn('Erro ao marcar notificação enviada:', err);
    }

    // Open WhatsApp Web or App
    window.open(waUrl, '_blank');
  };

  const handleCopyMessage = (file: DocumentFile) => {
    const message = buildWhatsAppDueNoticeMessage({
      companyName: file.company_name,
      documentName: file.name,
      documentType: file.document_type,
      dueDate: file.due_date,
      amount: file.amount,
      portalUrl: window.location.origin,
    });

    navigator.clipboard.writeText(message).then(() => {
      setCopiedId(file.id);
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const handleBatchMarkSent = async () => {
    const pendingList = filteredFiles.filter(f => !f.notification_sent);
    if (pendingList.length === 0) {
      setBatchActionNotice('Nenhuma guia pendente para marcar.');
      setTimeout(() => setBatchActionNotice(null), 3000);
      return;
    }

    setIsSaving(true);
    try {
      for (const item of pendingList) {
        await onUpdateFile(item.id, { notification_sent: true });
      }
      setBatchActionNotice(`${pendingList.length} guias marcadas como notificadas com sucesso!`);
      setTimeout(() => setBatchActionNotice(null), 4000);
    } catch (err: any) {
      alert('Erro ao atualizar em lote: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      id="due-notice-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-hidden"
    >
      <div 
        id="due-notice-modal-content"
        className="w-full max-w-lg mx-auto bg-[#0B1528] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] overflow-x-hidden border border-white/10 transition-all animate-in fade-in zoom-in-95 duration-200"
      >
        {/* 1. CABEÇALHO DO MODAL COM BOTÃO FECHAR (X) */}
        <div 
          id="due-notice-modal-header"
          className="relative p-5 pb-2 flex items-start justify-between gap-3 shrink-0"
        >
          {/* Sutil halo dourado no fundo */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#C59B4B]/15 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start gap-3 min-w-0 flex-1 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-[#E2C37A] shadow-inner shrink-0 backdrop-blur-md mt-0.5">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-white leading-snug">
                  Central de Disparos de Vencimentos
                </h2>
                <span className="bg-[#C59B4B]/25 text-[#DFC17B] border border-[#C59B4B]/40 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-xs whitespace-nowrap self-start">
                  MVRJ NOTIFICAÇÕES
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Disparo executivo de avisos de vencimento de guias (DAS, DARF, FGTS) por WhatsApp.
              </p>
            </div>
          </div>

          {/* Botão de Fechar (X) */}
          <button
            id="btn-close-due-notice-modal"
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center flex-shrink-0 transition-colors shadow-md focus:outline-none cursor-pointer relative z-20"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. GRID DE 4 CARDS DE MÉTRICAS (RESPONSIVA 2 COLUNAS) */}
        <div className="grid grid-cols-2 gap-2.5 p-4 shrink-0 relative z-10">
          <div className="bg-white/[0.07] border border-white/10 rounded-2xl p-3 flex flex-col justify-between gap-1.5 hover:bg-white/[0.1] transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/30">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider leading-tight">
                Pendentes
              </span>
            </div>
            <div className="text-2xl font-black text-white leading-none mt-1">
              {metrics.pendingDispatch}
            </div>
          </div>

          <div className="bg-white/[0.07] border border-white/10 rounded-2xl p-3 flex flex-col justify-between gap-1.5 hover:bg-white/[0.1] transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0 border border-rose-500/30">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider leading-tight">
                Vencidas
              </span>
            </div>
            <div className="text-2xl font-black text-white leading-none mt-1">
              {metrics.expiredCount}
            </div>
          </div>

          <div className="bg-white/[0.07] border border-white/10 rounded-2xl p-3 flex flex-col justify-between gap-1.5 hover:bg-white/[0.1] transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-yellow-400/20 text-yellow-300 flex items-center justify-center shrink-0 border border-yellow-400/30">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider leading-tight">
                Vencendo (&lt; 3d)
              </span>
            </div>
            <div className="text-2xl font-black text-white leading-none mt-1">
              {metrics.urgentCount}
            </div>
          </div>

          <div className="bg-white/[0.07] border border-white/10 rounded-2xl p-3 flex flex-col justify-between gap-1.5 hover:bg-white/[0.1] transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-400/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider leading-tight">
                Notificados
              </span>
            </div>
            <div className="text-2xl font-black text-white leading-none mt-1">
              {metrics.sentDispatch}
            </div>
          </div>
        </div>

        {/* 3. PARTE BRANCA INFERIOR (FILTROS E CONTEÚDO) */}
        <div className="bg-white p-4 sm:p-5 flex flex-col gap-3 rounded-t-3xl flex-1 overflow-y-auto overflow-x-hidden">
          {/* BARRA DE FILTROS & AÇÕES */}
          <div className="flex flex-col gap-2.5 pb-3 border-b border-slate-200 shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Campo de Busca Livre */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="input-search-due-guides"
                  type="text"
                  placeholder="Buscar guia, empresa..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:border-[#1B357B] text-xs font-semibold text-slate-700 shadow-sm focus:outline-hidden transition-all"
                />
              </div>

              {/* Filtro por Perfil / Empresa / Cliente */}
              <div>
                <select
                  id="select-company-filter"
                  value={selectedCompanyFilter}
                  onChange={e => setSelectedCompanyFilter(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:border-[#1B357B] text-xs font-semibold text-slate-700 shadow-sm focus:outline-hidden transition-all cursor-pointer truncate"
                >
                  <option value="all">🏢 Todas as Empresas / Clientes</option>
                  {companyOptions.map(comp => (
                    <option key={comp} value={comp}>
                      {comp}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro de Vencimento */}
              <div>
                <select
                  id="select-due-filter"
                  value={dueFilter}
                  onChange={e => setDueFilter(e.target.value as any)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:border-[#1B357B] text-xs font-semibold text-slate-700 shadow-sm focus:outline-hidden transition-all cursor-pointer"
                >
                  <option value="alert_only">⚡ Próximos 5 Dias ou Vencidas</option>
                  <option value="all">📅 Todos os Vencimentos</option>
                  <option value="urgent">⚠️ Urgentes (&lt; 3 dias)</option>
                  <option value="expired">🚨 Apenas Vencidas</option>
                </select>
              </div>

              {/* Filtro de Status de Notificação */}
              <div>
                <select
                  id="select-status-filter"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:border-[#1B357B] text-xs font-semibold text-slate-700 shadow-sm focus:outline-hidden transition-all cursor-pointer"
                >
                  <option value="pending">⏳ Apenas Pendentes de Aviso</option>
                  <option value="sent">✅ Apenas Avisos Enviados</option>
                  <option value="all">📋 Todos os Status</option>
                </select>
              </div>
            </div>

            {/* Linha de Ação em Lote */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="text-xs text-slate-600 flex items-center space-x-1.5">
                <span>Exibindo <strong>{filteredFiles.length}</strong> {filteredFiles.length === 1 ? 'guia' : 'guias'}</span>
                {selectedCompanyFilter !== 'all' && (
                  <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-semibold text-slate-700 truncate max-w-[140px]">
                    {selectedCompanyFilter}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {batchActionNotice && (
                  <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-medium">
                    {batchActionNotice}
                  </span>
                )}

                <button
                  id="btn-batch-mark-sent"
                  type="button"
                  onClick={handleBatchMarkSent}
                  disabled={isSaving}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50 ml-auto"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Marcar Notificados</span>
                </button>
              </div>
            </div>
          </div>

          {/* LISTAGEM DE GUIAS FILTRADAS */}
          <div className="space-y-3 pt-1">
          {filteredFiles.length === 0 ? (
            <div className="py-16 px-6 text-center flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Nenhuma guia com pendência no momento</h3>
              <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                Não foram localizadas guias com o filtro aplicado. Altere os filtros acima para listar outros vencimentos ou empresas.
              </p>
            </div>
          ) : (
            filteredFiles.map(file => {
              const badge = getExecutiveDueBadge(file.due_date);
              const isEditing = editingFileId === file.id;

              return (
                <div 
                  key={file.id}
                  id={`due-guide-card-${file.id}`}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col gap-3"
                >
                  {/* Top Bar: Empresa, Tipo de Guia e Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-[#1B357B] flex items-center justify-center font-bold text-xs shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold text-slate-900 leading-tight">
                            {file.company_name || 'Empresa não atribuída'}
                          </h4>
                          {file.document_type && (
                            <span className="bg-blue-50 text-[#1B357B] border border-blue-200 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase">
                              {file.document_type}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
                          <span className="truncate max-w-xs">{file.name}</span>
                          <span>•</span>
                          <span>Setor: {file.sector}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Badge de Vencimento com cores da diretriz: Vermelho vencida, Amarelo < 3 dias, Verde no prazo */}
                      <span className={`px-2.5 py-1 rounded-full text-xs flex items-center space-x-1 ${badge.badgeClass}`}>
                        <Calendar className="w-3.5 h-3.5 mr-1 inline" />
                        <span>{badge.label}</span>
                      </span>

                      {/* Badge de Status de Disparo */}
                      <button
                        type="button"
                        onClick={() => handleToggleNotification(file)}
                        title="Clique para alternar o status do aviso"
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
                          file.notification_sent 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                            : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        {file.notification_sent ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Aviso Enviado</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Pendente</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Informações Centrais e Inline Editor */}
                  {isEditing ? (
                    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Empresa / Cliente</label>
                        <input
                          type="text"
                          value={editCompany}
                          onChange={e => setEditCompany(e.target.value)}
                          placeholder="Nome da empresa"
                          className="w-full mt-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">WhatsApp (com DDD)</label>
                        <input
                          type="text"
                          value={editPhone}
                          onChange={e => setEditPhone(e.target.value)}
                          placeholder="(21) 99999-0000"
                          className="w-full mt-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Vencimento</label>
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={e => setEditDueDate(e.target.value)}
                          className="w-full mt-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Valor Guia (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                          placeholder="0,00"
                          className="w-full mt-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>

                      <div className="sm:col-span-5 flex justify-end space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingFileId(null)}
                          className="px-3 py-1 text-xs rounded-lg border border-slate-300 bg-white text-slate-700"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={isSaving}
                          className="px-3 py-1 text-xs rounded-lg bg-[#1B357B] text-white font-bold"
                        >
                          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-semibold block">Vencimento</span>
                        <span className="font-semibold text-slate-800">{badge.formattedDate}</span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-semibold block">Valor da Guia</span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(file.amount)}
                        </span>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="text-slate-400 text-[10px] uppercase font-semibold block">Telefone WhatsApp</span>
                        <div className="flex items-center space-x-1.5 font-medium text-slate-700">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{file.client_phone || 'Não cadastrado'}</span>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(file)}
                            title="Editar dados desta guia"
                            className="text-slate-400 hover:text-[#1B357B] ml-1 p-0.5 rounded cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Barra de Ações: WhatsApp & Pré-visualização */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center space-x-2">
                      {onOpenFilePreview && (
                        <button
                          type="button"
                          onClick={() => onOpenFilePreview(file)}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center space-x-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3 text-slate-500" />
                          <span>Ver Documento</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCopyMessage(file)}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center space-x-1 cursor-pointer"
                      >
                        {copiedId === file.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700 font-semibold">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-500" />
                            <span>Copiar Texto</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Botão de Disparo WhatsApp com Acabamento Dourado & Verde Oficial */}
                    <button
                      id={`btn-dispatch-whatsapp-${file.id}`}
                      type="button"
                      onClick={() => handleDispatchWhatsApp(file)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs hover:shadow transition-all flex items-center space-x-2 cursor-pointer active:scale-98"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Disparar WhatsApp</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
          </div>
        </div>

        {/* 4. RODAPÉ DO MODAL */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>MVRJ Contábil — Módulo de Avisos Ativo</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Fechar Central
          </button>
        </div>
      </div>
    </div>
  );
};
