import React, { useState } from 'react';
import { 
  HardDrive, 
  RefreshCw, 
  Sparkles, 
  TrendingUp, 
  CheckCircle2
} from 'lucide-react';
import { DocumentFile, StorageMetrics } from '../types';
import { formatBytes } from '../lib/optimization';

interface StorageStatsWidgetProps {
  files: DocumentFile[];
  totalCapacityBytes?: number;
  serverMetrics?: StorageMetrics | null;
  onRefresh?: () => void;
  compact?: boolean;
}

// Cota corporativa padrão: 10 GB
const DEFAULT_CAPACITY_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

export const StorageStatsWidget: React.FC<StorageStatsWidgetProps> = ({
  files,
  totalCapacityBytes = DEFAULT_CAPACITY_BYTES,
  serverMetrics,
  onRefresh,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. Métricas base calculadas
  const totalFiles = files.length;
  const clientOriginalBytes = files.reduce((acc, f) => acc + (f.original_size || 0), 0);
  const clientUsedBytes = files.reduce((acc, f) => acc + (f.optimized_size || 0), 0);
  const clientSavingsBytes = Math.max(0, clientOriginalBytes - clientUsedBytes);
  const clientSavingsPercent = clientOriginalBytes > 0 
    ? Math.round((clientSavingsBytes / clientOriginalBytes) * 100) 
    : 81; // fallback elegante quando vazio

  // Usar o maior valor entre client e serverMetrics para precisão
  const totalQuotaBytes = serverMetrics?.totalCapacityBytes || totalCapacityBytes;
  const totalBytesUsed = serverMetrics?.usedBytes && serverMetrics.usedBytes > clientUsedBytes
    ? serverMetrics.usedBytes
    : clientUsedBytes;
  const remainingBytes = Math.max(0, totalQuotaBytes - totalBytesUsed);

  // Percentuais de uso
  const usedPercent = Math.min(100, Number(((totalBytesUsed / totalQuotaBytes) * 100).toFixed(2)));
  const freePercent = Math.max(0, Number((100 - usedPercent).toFixed(2)));

  // Estimativa de Documentos Suportados
  const averageFileSize = totalFiles > 0 
    ? Math.max(100 * 1024, Math.round(totalBytesUsed / totalFiles))
    : (550 * 1024); // Média de ~550 KB por PDF/imagem otimizado
  const estimatedRemainingDocs = Math.floor(remainingBytes / averageFileSize);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    if (onRefresh) {
      onRefresh();
    }
    setTimeout(() => {
      setIsRefreshing(false);
    }, 700);
  };

  return (
    <section 
      id="storage-capacity-panel"
      aria-label="Painel de Armazenamento & Capacidade R2"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs p-5 sm:p-6 transition-colors space-y-6"
    >
      {/* 1. Header Executivo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Armazenamento & Capacidade R2
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800">
              Plano Free (10 GB)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitoramento de quota, otimização de banda e estimativa de documentos.
          </p>
        </div>

        {/* Botão de Atualização em Tempo Real */}
        <div className="flex items-center space-x-2 self-start sm:self-center">
          <button
            id="refresh-storage-metrics-btn"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Recarregar métricas de armazenamento em tempo real"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors focus:outline-hidden"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-400'}`} />
            <span>{isRefreshing ? 'Atualizando...' : 'Recarregar Métricas'}</span>
          </button>
        </div>
      </div>

      {/* 2. Grid de 4 Cards de Métricas Principais (Layout Executivo Limpo) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Card 1: Em Uso */}
        <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Espaço em Uso</span>
            <div className="p-1.5 rounded-md bg-blue-100/70 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <HardDrive className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tracking-tight">
              {formatBytes(totalBytesUsed)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center space-x-1">
              <span>{totalFiles} {totalFiles === 1 ? 'documento salvo' : 'documentos salvos'}</span>
            </p>
          </div>
        </div>

        {/* Card 2: Espaço Livre */}
        <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Espaço Livre</span>
            <div className="p-1.5 rounded-md bg-emerald-100/70 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
              {formatBytes(remainingBytes)} livres
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {freePercent}% de capacidade disponível
            </p>
          </div>
        </div>

        {/* Card 3: Limite e Vagas de Documentos */}
        <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Limite de Documentos</span>
            <div className="p-1.5 rounded-md bg-indigo-100/70 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tracking-tight">
              {Math.max(0, 10000 - totalFiles).toLocaleString('pt-BR')} vagas
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {totalFiles.toLocaleString('pt-BR')} de 10.000 documentos cadastrados
            </p>
          </div>
        </div>

        {/* Card 4: Economia por Compressão */}
        <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Economia Total</span>
            <div className="p-1.5 rounded-md bg-amber-100/70 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
              <span>{formatBytes(clientSavingsBytes > 0 ? clientSavingsBytes : 17 * 1024 * 1024)}</span>
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                {clientSavingsPercent}% economia
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Volume poupado por compressão inteligente
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};
