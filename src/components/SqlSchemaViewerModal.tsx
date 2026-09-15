import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Database, 
  Cloud, 
  FileCode2, 
  ShieldCheck, 
  ExternalLink,
  Server,
  Layers
} from 'lucide-react';
import { SUPABASE_SQL_SCHEMA } from '../lib/supabase-schema.sql';

interface SqlSchemaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SqlSchemaViewerModal: React.FC<SqlSchemaViewerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'sql' | 'r2' | 'architecture'>('sql');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-slate-900 w-full max-w-5xl h-[88vh] rounded-2xl shadow-2xl flex flex-col border border-slate-800 text-white overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Infraestrutura em Nuvem: Supabase & Cloudflare R2</h3>
              <p className="text-xs text-slate-400">Scripts SQL, Políticas RLS, Triggers e Configuração do Bucket S3</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {activeTab === 'sql' && (
              <button
                id="copy-sql-button"
                onClick={handleCopySql}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'SQL Copiado com Sucesso!' : 'Copiar SQL Completo'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 text-xs font-semibold px-6">
          <button
            onClick={() => setActiveTab('sql')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'sql'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode2 className="w-4 h-4" />
            <span>1. Schema SQL Supabase (PostgreSQL + RLS + Triggers)</span>
          </button>

          <button
            onClick={() => setActiveTab('r2')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'r2'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>2. Cloudflare R2 & Presigned URLs (S3 SDK)</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'architecture'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>3. Pipeline de Otimização & Fluxo de Segurança</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950 font-sans">
          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Tabelas Criadas</span>
                  <strong className="text-white text-sm">profiles, folders, files, perms, audit</strong>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Triggers de Automação</span>
                  <strong className="text-emerald-400 text-sm">on_auth_user_created (Pending)</strong>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Políticas RLS Ativas</span>
                  <strong className="text-purple-400 text-sm">has_folder_permission() & is_admin()</strong>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Segurança</span>
                  <strong className="text-blue-400 text-sm">Matriz RBAC Granular</strong>
                </div>
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-blue-300/90 leading-relaxed overflow-x-auto selection:bg-blue-600 selection:text-white">
                  <code>{SUPABASE_SQL_SCHEMA}</code>
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'r2' && (
            <div className="space-y-5 text-xs text-slate-300">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <h4 className="font-bold text-sm text-white flex items-center space-x-2">
                  <Cloud className="w-4 h-4 text-amber-400" />
                  <span>Configuração do Bucket Cloudflare R2 (S3 Compatible API)</span>
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  O Cloudflare R2 é 100% compatível com a API do AWS S3, permitindo utilizar o SDK oficial <code className="text-amber-300 font-mono">@aws-sdk/client-s3</code> e <code className="text-amber-300 font-mono">@aws-sdk/s3-request-presigner</code> com taxa zero de saída de dados (Zero Egress Fees).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                  <h5 className="font-bold text-white text-xs uppercase tracking-wider text-amber-400">1. Política de CORS do Bucket R2</h5>
                  <p className="text-slate-400">Insira a seguinte regra de CORS no painel do Cloudflare R2 para permitir upload direto via browser:</p>
                  <pre className="p-3 bg-slate-950 rounded-lg text-[11px] font-mono text-emerald-400 overflow-x-auto">
{`[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]`}
                  </pre>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                  <h5 className="font-bold text-white text-xs uppercase tracking-wider text-blue-400">2. Variáveis de Ambiente (.env)</h5>
                  <p className="text-slate-400">Configure no arquivo <code className="text-blue-300 font-mono">.env</code> do servidor:</p>
                  <pre className="p-3 bg-slate-950 rounded-lg text-[11px] font-mono text-blue-300 overflow-x-auto">
{`R2_ACCOUNT_ID="c56a88..."
R2_ACCESS_KEY_ID="6f4a7b..."
R2_SECRET_ACCESS_KEY="8e9c1d..."
R2_BUCKET_NAME="mvrjcontabil-ged"
R2_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"`}
                  </pre>
                </div>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                <h5 className="font-bold text-white text-xs uppercase tracking-wider text-purple-400">3. Código de Geração de Presigned PUT / GET URL</h5>
                <pre className="p-3 bg-slate-950 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto">
{`import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Upload Presigned URL (15 min de validade)
const putCommand = new PutObjectCommand({
  Bucket: 'mvrjcontabil-ged',
  Key: 'sectors/fiscal/177356-doc.pdf',
  ContentType: 'application/pdf',
});
const putUrl = await getSignedUrl(s3, putCommand, { expiresIn: 900 });

// Download Presigned URL (30 min de validade)
const getCommand = new GetObjectCommand({
  Bucket: 'mvrjcontabil-ged',
  Key: 'sectors/fiscal/177356-doc.pdf',
});
const getUrl = await getSignedUrl(s3, getCommand, { expiresIn: 1800 });`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'architecture' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                <h4 className="font-bold text-sm text-white">Fluxo de Upload e Otimização Sem Expôr o Bucket</h4>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">1</span>
                    <div>
                      <strong className="text-white block">Otimização no Client/Edge:</strong>
                      <span>Imagens são compactadas em Canvas de alta precisão para WebP a 85% de qualidade. PDFs passam pelo motor <code className="text-blue-400 font-mono">pdf-lib</code> com limpeza de metadados e fluxo de objetos comprimidos (<code className="text-blue-400 font-mono">useObjectStreams</code>).</span>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                    <div>
                      <strong className="text-white block">Solicitação de Autorização & Presigned URL:</strong>
                      <span>O frontend requisita uma URL pré-assinada ao backend. O backend valida se o usuário possui permissão de <code className="text-emerald-400 font-mono">Editor</code> ou <code className="text-purple-400 font-mono">Admin</code> na pasta de destino antes de assinar.</span>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">3</span>
                    <div>
                      <strong className="text-white block">Upload Direto para o Cloudflare R2:</strong>
                      <span>O arquivo binário otimizado é enviado via HTTP PUT diretamente ao R2 sem sobrecarregar o servidor intermediário de aplicação, poupando CPU e memória.</span>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">4</span>
                    <div>
                      <strong className="text-white block">Visualização Segura com RLS e Presigned GET:</strong>
                      <span>Ao abrir o visualizador de PDF ou baixar, uma URL temporária assinada é emitida com validade estrita de 15 a 30 minutos. Nenhuma chave mestra ou URL pública é jamais exposta.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
