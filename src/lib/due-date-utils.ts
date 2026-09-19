export interface DueDateInfo {
  status: 'expired' | 'soon';
  label: string;
  formattedDate: string;
  diffDays: number;
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

    if (diffDays < 0) {
      return {
        status: 'expired',
        label: `🔴 Venceu em ${shortDate}`,
        formattedDate: `${dayStr}/${monthStr}/${dueDate.getFullYear()}`,
        diffDays,
      };
    }

    if (diffDays <= 5) {
      return {
        status: 'soon',
        label: `⚠️ Vence em ${diffDays} dias (${shortDate})`,
        formattedDate: `${dayStr}/${monthStr}/${dueDate.getFullYear()}`,
        diffDays,
      };
    }

    return null;
  } catch {
    return null;
  }
};
