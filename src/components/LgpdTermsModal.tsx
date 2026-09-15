import React from 'react';
import { X, ShieldCheck, ScrollText, CheckCircle2, Building2, User, Calendar, Printer } from 'lucide-react';
import { UserProfile } from '../types';

interface LgpdTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
}

export const LgpdTermsModal: React.FC<LgpdTermsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = currentUser.lgpd_accepted_at 
    ? new Date(currentUser.lgpd_accepted_at).toLocaleString('pt-BR')
    : 'Aceite registrado no sistema';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 leading-tight">
                Termo de Conformidade LGPD & Sigilo Profissional
              </h3>
              <p className="text-xs text-slate-500">
                Lei Federal nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais)
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              title="Imprimir termo de adesão"
              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Badge */}
        <div className="px-6 py-3 bg-emerald-50/80 border-b border-emerald-100 flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Termo Homologado para: <strong>{currentUser.full_name}</strong> ({currentUser.email})
            </span>
          </div>
          <span className="font-mono text-[11px] bg-emerald-200/60 px-2 py-0.5 rounded text-emerald-800 font-bold">
            {formattedDate}
          </span>
        </div>

        {/* Legal Text */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed font-sans select-text">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-center">
            <h4 className="font-black text-sm text-slate-900 uppercase">
              MVRJCONTÁBIL ASSESSORIA & GESTÃO CONTÁBIL
            </h4>
            <p className="text-[11px] text-slate-500 font-medium">
              TERMO DE CIÊNCIA, CONFIDENCIALIDADE E RESPONSABILIDADE NO TRATAMENTO DE DADOS (LGPD)
            </p>
            <p className="text-[10px] text-blue-700 font-mono">
              Versão do Termo: {currentUser.lgpd_terms_version || 'v1.0-2026-LGPD-13709'}
            </p>
          </div>

          <div>
            <h5 className="font-bold text-slate-900 mb-1">1. OBJETO E FINALIDADE DO TRATAMENTO (Art. 7º e 11)</h5>
            <p>
              O acesso aos sistemas e repositórios digitais do GED MVRJCONTÁBIL destina-se unicamente ao tratamento de dados pessoais, societários, fiscais, trabalhistas e bancários para execução de serviços contábeis e cumprimento de obrigações tributárias e regulatórias (Art. 7º, II e V da Lei 13.709/2018). É vedada qualquer utilização para finalidades alheias ao escopo profissional.
            </p>
          </div>

          <div>
            <h5 className="font-bold text-slate-900 mb-1">2. DEVER DE SIGILO PROFISSIONAL E CONFIDENCIALIDADE</h5>
            <p>
              O USUÁRIO obriga-se a manter rigoroso sigilo quanto a quaisquer informações contábeis, declarações fiscais (IRPF, ECF, DEFIS, DCTF), folhas de pagamento, contratos sociais e senhas de clientes e parceiros da MVRJCONTÁBIL, respondendo pessoalmente por qualquer vazamento culposo ou doloso.
            </p>
          </div>

          <div>
            <h5 className="font-bold text-slate-900 mb-1">3. RESPONSABILIDADE INDIVIDUAL PELAS CREDENCIAIS</h5>
            <p>
              As credenciais de acesso (usuário e senha) são de uso privativo e intransferível. A cessão a terceiros configura infração disciplinar grave. Todas as ações são auditadas de forma imutável via logs seguros no Cloudflare R2 e Supabase.
            </p>
          </div>

          <div>
            <h5 className="font-bold text-slate-900 mb-1">4. SEGURANÇA DA INFORMAÇÃO E RETENÇÃO</h5>
            <p>
              Os documentos são criptografados em trânsito (HTTPS/TLS) e em repouso (AES-256 no Cloudflare R2). A retenção observa os prazos prescricionais do Código Tributário Nacional (CTN) e leis previdenciárias.
            </p>
          </div>

          <div>
            <h5 className="font-bold text-slate-900 mb-1">5. ENCARREGADO PELO TRATAMENTO DE DADOS (DPO)</h5>
            <p>
              Para dúvidas, comunicações de incidentes ou exercício dos direitos previstos no Art. 18 da LGPD, o canal oficial é a Diretoria de Compliance da MVRJCONTÁBIL.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Documento eletrônico assinado digitalmente em conformidade com a MP 2.200-2/2001 e Lei 13.709/2018.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
