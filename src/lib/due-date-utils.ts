export interface DueDateInfo {
  status: 'expired' | 'soon' | 'ok';
  label: string;
  formattedDate: string;
  diffDays: number;
  badgeClass: string;
}

/**
 * Computes status, badge classes and relative day calculations for document due dates.
 */
export function getDueDateInfo(dueDateStr?: string | null): DueDateInfo | null {
  if (!dueDateStr) return null;

  try {
    const cleanStr = dueDateStr.split('T')[0];
    const parts = cleanStr.split('-');
    if (parts.length !== 3) return null;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

    const dueDate = new Date(year, month, day);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month + 1).padStart(2, '0');
    const formattedDate = `${dayStr}/${monthStr}/${year}`;
    const shortDate = `${dayStr}/${monthStr}`;

    if (diffDays < 0) {
      return {
        status: 'expired',
        label: `🔴 Venceu em ${shortDate}`,
        formattedDate,
        diffDays,
        badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold px-2.5 py-0.5 rounded-lg flex items-center gap-1 shadow-2xs',
      };
    }

    if (diffDays <= 5) {
      let label = `⚠️ Vence em ${diffDays} dias (${shortDate})`;
      if (diffDays === 0) label = `⚠️ Vence hoje (${shortDate})`;
      else if (diffDays === 1) label = `⚠️ Vence amanhã (${shortDate})`;

      return {
        status: 'soon',
        label,
        formattedDate,
        diffDays,
        badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg flex items-center gap-1 shadow-2xs',
      };
    }

    return {
      status: 'ok',
      label: `Vence em ${shortDate}`,
      formattedDate,
      diffDays,
      badgeClass: 'bg-slate-100 text-slate-600 text-[11px] px-2.5 py-0.5 rounded-lg',
    };
  } catch {
    return null;
  }
}
