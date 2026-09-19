export interface DueDateInfo {
  status: 'expired' | 'soon';
  label: string;
  formattedDate: string;
  diffDays: number;
}

export const getDueDateInfo = (dueDateStr: string): DueDateInfo | null => {
  try {
    const today = new Date();
    // Using UTC to avoid timezone issues with YYYY-MM-DD
    const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    
    // YYYY-MM-DD to UTC date
    const [year, month, day] = dueDateStr.split('-').map(Number);
    const dueDateUTC = Date.UTC(year, month - 1, day);

    const diffTime = dueDateUTC - todayUTC;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const shortDate = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`;

    console.log(`Debug: DueDate=${dueDateStr}, DiffDays=${diffDays}`);

    if (diffDays < 0) {
      return {
        status: 'expired',
        label: `🔴 Venceu em ${shortDate}`,
        formattedDate: `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`,
        diffDays,
      };
    }

    if (diffDays <= 5) {
      return {
        status: 'soon',
        label: `⚠️ Vence em ${diffDays} dias (${shortDate})`,
        formattedDate: `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`,
        diffDays,
      };
    }

    return null;
  } catch {
    return null;
  }
};
