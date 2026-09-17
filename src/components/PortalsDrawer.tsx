import React from 'react';
import { X, Globe, ExternalLink } from 'lucide-react';

interface PortalLink {
  name: string;
  url: string;
  desc: string;
}

interface PortalCategory {
  title: string;
  links: PortalLink[];
}

const PORTAL_CATEGORIES: PortalCategory[] = [
  {
    title: 'FISCAL & TRIBUTÁRIO',
    links: [
      { name: 'Portal e-CAC', url: 'https://cav.receita.fazenda.gov.br/', desc: 'Receita Federal' },
      { name: 'Simples Nacional / PGDAS', url: 'https://www8.receita.fazenda.gov.br/SimplesNacional/', desc: 'Gestão de impostos' },
      { name: 'Portal Nacional NFS-e', url: 'https://www.nfse.gov.br/', desc: 'Notas Fiscais de Serviço' },
      { name: 'SEFAZ-RJ', url: 'https://www.fazenda.rj.gov.br/', desc: 'Receita Estadual' },
    ],
  },
  {
    title: 'DP & TRABALHISTA',
    links: [
      { name: 'eSocial Web Geral', url: 'https://login.esocial.gov.br/', desc: 'Portal oficial' },
      { name: 'FGTS Digital', url: 'https://fgtsdigital.sistema.gov.br/', desc: 'Gestão de FGTS' },
      { name: 'Conectividade Social ICP', url: 'https://conectividade.caixa.gov.br/', desc: 'Serviços Caixa' },
    ],
  },
  {
    title: 'SOCIETÁRIO & LEGALIZAÇÃO',
    links: [
      { name: 'JUCERJA', url: 'https://www.jucerja.rj.gov.br/', desc: 'Empresa Fácil' },
      { name: 'Consulta CNPJ', url: 'https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp', desc: 'Receita Federal' },
    ],
  },
];

interface PortalsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PortalsDrawer: React.FC<PortalsDrawerProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      {/* Drawer */}
      <div className="fixed top-0 right-0 h-screen w-80 sm:w-96 bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 transition-transform duration-300 ease-in-out">
        {/* Fixed Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-[#112354] font-bold text-sm">Portais Contábeis Úteis</h2>
            <p className="text-slate-500 text-xs">Acesso rápido aos sistemas fiscais</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          {PORTAL_CATEGORIES.map((cat) => (
            <div key={cat.title}>
              <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">{cat.title}</h3>
              <div className="space-y-2">
                {cat.links.map((link) => (
                  <a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-[#1B357B]/5 hover:border-[#1B357B]/30 flex items-center justify-between transition-all group"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800 group-hover:text-[#1B357B]">{link.name}</p>
                      <p className="text-[10px] text-slate-500">{link.desc}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#C59B4B]" />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
