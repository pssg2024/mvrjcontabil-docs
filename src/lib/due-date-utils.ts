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

