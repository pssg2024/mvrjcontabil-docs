export type DueStatusType = 'expired' | 'today' | 'soon' | 'future';

export interface DueDateInfo {
  status: DueStatusType;
  label: string;
  badgeText: string;
  formattedDate: string;
  diffDays: number;
  badgeClass: string;
  cardClass: string;
}

export const getDueDateInfo = (dueDateStr?: string | null): DueDateInfo | null => {
  if (!dueDateStr) return null;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parts = dueDateStr.split('-').map(Number);
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;

    const [year, month, day] = parts;
    const targetDate = new Date(year, month - 1, day);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    const dayPad = String(day).padStart(2, '0');
    const monthPad = String(month).padStart(2, '0');
    const formattedDate = `${dayPad}/${monthPad}/${year}`;
    const shortDate = `${dayPad}/${monthPad}`;

    if (diffDays < 0) {
      const daysAgo = Math.abs(diffDays);
      return {
        status: 'expired',
        diffDays,
        label: daysAgo === 1 ? `Venceu ontem (${shortDate})` : `Vencido há ${daysAgo} dias (${shortDate})`,
        badgeText: `Vencido (${shortDate})`,
        formattedDate,
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
        cardClass: 'border-rose-300 bg-rose-50/70',
      };
    }

    if (diffDays === 0) {
      return {
        status: 'today',
        diffDays: 0,
        label: `Vence HOJE (${shortDate})`,
        badgeText: `Vence HOJE`,
        formattedDate,
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-400 font-bold animate-pulse',
        cardClass: 'border-amber-300 bg-amber-50/80',
      };
    }

    if (diffDays <= 7) {
      return {
        status: 'soon',
        diffDays,
        label: diffDays === 1 ? `Vence amanhã (${shortDate})` : `Vence em ${diffDays} dias (${shortDate})`,
        badgeText: diffDays === 1 ? `Amanhã (${shortDate})` : `${diffDays} dias (${shortDate})`,
        formattedDate,
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold',
        cardClass: 'border-amber-200 bg-amber-50/50',
      };
    }

    return {
      status: 'future',
      diffDays,
      label: `Vencimento em ${formattedDate}`,
      badgeText: formattedDate,
      formattedDate,
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 font-medium',
      cardClass: 'border-slate-200 bg-slate-50/50',
    };
  } catch {
    return null;
  }
};

/**
 * Checks if a document due date is in the alert window (expired OR due within the next 5 days)
 */
export const isDueAlert = (dueDateStr?: string | null): boolean => {
  const info = getDueDateInfo(dueDateStr);
  if (!info) return false;
  // Expired (< 0) or due within 5 days (<= 5)
  return info.diffDays <= 5;
};

/**
 * Executive Due Badge according to specific visual requirement:
 * - Vermelho para vencida (diffDays < 0)
 * - Amarelo para < 3 dias (0 <= diffDays < 3)
 * - Verde no prazo (diffDays >= 3)
 */
export const getExecutiveDueBadge = (dueDateStr?: string | null): {
  badgeClass: string;
  label: string;
  status: 'expired' | 'urgent' | 'on_time';
  diffDays: number;
  formattedDate: string;
} => {
  const info = getDueDateInfo(dueDateStr);
  if (!info) {
    return {
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      label: 'Sem data',
      status: 'on_time',
      diffDays: 999,
      formattedDate: '—',
    };
  }

  if (info.diffDays < 0) {
    const daysAgo = Math.abs(info.diffDays);
    return {
      badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold',
      label: daysAgo === 1 ? 'Vencida ontem' : `Vencida há ${daysAgo} dias`,
      status: 'expired',
      diffDays: info.diffDays,
      formattedDate: info.formattedDate,
    };
  }

  if (info.diffDays < 3) {
    return {
      badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200 font-semibold',
      label: info.diffDays === 0 ? 'Vence HOJE' : info.diffDays === 1 ? 'Vence amanhã' : `Vence em ${info.diffDays} dias`,
      status: 'urgent',
      diffDays: info.diffDays,
      formattedDate: info.formattedDate,
    };
  }

  return {
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold',
    label: `No prazo (${info.formattedDate})`,
    status: 'on_time',
    diffDays: info.diffDays,
    formattedDate: info.formattedDate,
  };
};

/**
 * Formats a monetary number into BRL currency (e.g. R$ 1.450,80)
 */
export const formatCurrency = (val?: number | null): string => {
  if (val === undefined || val === null || isNaN(val)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

/**
 * Formats phone number into a clean digits string for WhatsApp wa.me
 */
export const cleanPhoneNumber = (phone?: string | null): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  // Se não tiver DDI (55), adiciona se tiver 10 ou 11 dígitos
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
};

/**
 * Generates formatted WhatsApp text message for client due notice
 */
export const buildWhatsAppDueNoticeMessage = (params: {
  companyName?: string;
  documentName: string;
  documentType?: string;
  dueDate?: string;
  amount?: number;
  portalUrl?: string;
}): string => {
  const badgeInfo = getExecutiveDueBadge(params.dueDate);
  const portalLink = params.portalUrl || window.location.origin;
  const company = params.companyName?.trim() || 'Prezado(a) Cliente';
  const docType = params.documentType?.trim() || 'Guia Fiscal / Contábil';

  let msg = `*MVRJ CONTÁBIL - AVISO DE VENCIMENTO* 🔔\n\n`;
  msg += `Olá, *${company}*!\n\n`;
  msg += `Informamos que há documento/guia cadastrado com vencimento para acompanhamento:\n\n`;
  msg += `📄 *Documento:* ${params.documentName}\n`;
  msg += `📌 *Tipo de Guia:* ${docType}\n`;
  msg += `📅 *Vencimento:* ${badgeInfo.formattedDate} (${badgeInfo.label})\n`;
  
  if (params.amount && params.amount > 0) {
    msg += `💰 *Valor:* ${formatCurrency(params.amount)}\n`;
  }

  msg += `\n🌐 *Acesse seus documentos com segurança no Portal MVRJ Contábil:*\n${portalLink}\n\n`;
  msg += `_Caso já tenha efetuado o pagamento, por favor desconsidere este aviso._\n`;
  msg += `_MVRJ Contábil • Gestão Eletrônica de Documentos_`;

  return msg;
};

