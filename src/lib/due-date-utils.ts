export interface DueDateInfo {
  status: 'expired' | 'soon' | 'ok';
  label: string;
  formattedDate: string;
  diffDays: number;
  badgeClass: string;
}

export const getDueDateInfo = (dueDateStr: string): DueDateInfo | null => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const dayStr = dueDate.getDate().toString().padStart(2, '0');
    const monthStr = (dueDate.getMonth() + 1).toString().padStart(2, '0');
    const shortDate = `${dayStr}/${monthStr}`;
    const formattedDate = `${dayStr}/${monthStr}/${dueDate.getFullYear()}`;

    if (diffDays < 0) {
      return {
        status: 'expired',
        label: `🔴 Venceu em ${shortDate}`,
        formattedDate,
        diffDays,
        badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold px-2.5 py-0.5 rounded-lg flex items-center gap-1',
      };
    }

    if (diffDays <= 5) {
      return {
        status: 'soon',
        label: `⚠️ Vence em ${diffDays} dias (${shortDate})`,
        formattedDate,
        diffDays,
        badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg flex items-center gap-1',
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
};
