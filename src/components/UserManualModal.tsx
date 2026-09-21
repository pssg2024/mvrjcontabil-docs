import React from 'react';
import { 
  X, 
  Printer, 
  BookOpen, 
  HardDrive, 
  ShieldCheck, 
  Globe, 
  Building2, 
  User, 
  Search, 
  FolderPlus, 
  UploadCloud, 
  FileText,
  HelpCircle,
  FolderOpen
} from 'lucide-react';

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManualModal: React.FC<UserManualModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200 print:bg-white print:absolute print:inset-0 print:z-0">
      <div 
        className="bg-white w-full max-w-4xl h-full sm:h-[90vh] sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col print:border-0 print:shadow-none print:h-auto print:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header - Screen Only */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0 print:hidden">
          <div className="flex items-center space-x-3 flex-1 min-w-0 mr-4">
            <div className="p-2 bg-[#1B357B]/10 text-[#1B357B] rounded-xl shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-slate-900 leading-tight truncate">
                Manual do Usuário & Guia Operacional
              </h3>
              <p className="text-xs text-slate-500 truncate">
                Aprenda a operar o sistema de Gestão Eletrônica de Documentos (GED)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PRINT ONLY HEADER */}
        <div className="hidden print:block w-full border-b-2 border-slate-900 pb-5 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 border-2 border-slate-950 p-1.5 rounded-xl flex items-center justify-center font-black text-lg bg-white text-[#0B1736]">
                MVRJ
              </div>
              <div>
                <h1 className="text-2xl font-black text-[#0B1736] tracking-tight uppercase">
                  MVRJ <span className="text-[#C59B4B]">CONTÁBIL</span>
                </h1>
                <p className="text-[11px] text-slate-600 font-semibold tracking-wide uppercase leading-none">
                  Gestão Eletrônica de Documentos (GED)
                </p>
              </div>
            </div>
            <div className="text-right text-xs text-slate-600 font-medium">
              <p className="font-bold">Suporte e Atendimento MVRJ</p>
              <p>Email: suporte@mvrjcontabil.com.br</p>
              <p>Telefone: (21) 97396-0077</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200 text-center">
            <h2 className="text-xl font-bold text-slate-900">MANUAL PRÁTICO DO USUÁRIO & GUIA OPERACIONAL</h2>
            <p className="text-xs text-slate-500 mt-1">Versão Oficial de Operação Contábil / Administrativa • Emitido em 2026</p>
          </div>
        </div>

        {/* Scrollable Container Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 scrollbar-thin print:overflow-visible print:h-auto print:p-0">
          
          {/* Welcome Card - Screen Only */}
          <div className="bg-gradient-to-br from-[#0F1E42] to-[#1B357B] text-white p-6 rounded-2xl shadow-sm border border-white/10 space-y-2 print:bg-none print:text-slate-900 print:border print:border-slate-300 print:shadow-none print:p-5">
            <h4 className="text-base font-bold text-[#E2C37A] print:text-slate-950">Boas-vindas ao Drive MVRJ Contábil!</h4>
            <p className="text-xs text-slate-200 leading-relaxed print:text-slate-700">
              Este guia operacional foi projetado para auxiliar no gerenciamento, envio e consulta de arquivos da sua empresa com facilidade e máxima conformidade. O GED funciona de forma integrada entre clientes e o time operacional da MVRJ, com proteção LGPD e criptografia de ponta a ponta.
            </p>
          </div>

          {/* Module 1 */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-2xs print:border-slate-300 print:shadow-none print:p-4">
            <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3 print:border-slate-300">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1B357B] flex items-center justify-center font-bold text-sm shrink-0 print:border print:border-slate-400">
                1
              </div>
              <h3 className="font-extrabold text-sm text-[#0B1736]">Mapeamento da Barra de Navegação</h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              O menu de navegação superior centraliza os principais recursos do sistema. Veja a função detalhada de cada módulo:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1.5 print:grid-cols-1 print:gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5 print:border-slate-300 print:bg-white">
                <HardDrive className="w-5 h-5 text-[#1B357B] shrink-0 mt-0.5 print:text-slate-800" />
                <div>
                  <h4 className="font-bold text-xs text-slate-900">Drive Corporativo</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Exibe a estrutura de pastas e arquivos das empresas. Permite realizar downloads, visualizar documentos, renomear, criar subpastas e efetuar buscas avançadas.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5 print:border-slate-300 print:bg-white">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 print:text-slate-800" />
                <div>
                  <h4 className="font-bold text-xs text-slate-900">Painel Admin & RBAC</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Recurso restrito para Administradores. Permite o controle de acessos, alteração de permissões dos usuários (Leitor, Editor, Admin), aprovação de cadastros pendentes e exclusões permanentes.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5 print:border-slate-300 print:bg-white">
                <Globe className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 print:text-slate-800" />
                <div>
                  <h4 className="font-bold text-xs text-slate-900">Portais Fiscais</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Facilita o acesso direto de forma rápida e segura para os principais órgãos governamentais e de fiscalização como Receita Federal (e-CAC), SEFAZ, Prefeitura (NFS-e) e FGTS/CEF.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5 print:border-slate-300 print:bg-white">
                <Building2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5 print:text-slate-800" />
                <div>
                  <h4 className="font-bold text-xs text-slate-900">Consultar Empresa / CNPJ</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Painel inteligente para verificação direta da situação cadastral do CNPJ junto ao servidor da Receita Federal do Brasil, com informações em tempo real de atividade, endereço, CNAE e situação.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-slate-600 flex items-start space-x-2.5 print:border-slate-300 print:bg-white">
              <span className="font-bold text-blue-800 uppercase text-[10px] bg-blue-100/80 px-1.5 py-0.5 rounded mt-0.5 print:border shrink-0">Nota Mobile</span>
              <p className="text-[11px] leading-relaxed">
                Ao acessar o sistema por meio de um dispositivo móvel (telemóvel ou tablet), os botões da barra de navegação são dinamicamente agrupados no menu de 3 linhas (Hambúrguer) no canto superior direito para melhor usabilidade e controle de toque.
              </p>
            </div>
          </div>

          {/* Module 2 */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-2xs print:border-slate-300 print:shadow-none print:p-4">
            <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3 print:border-slate-300">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1B357B] flex items-center justify-center font-bold text-sm shrink-0 print:border print:border-slate-400">
                2
              </div>
              <h3 className="font-extrabold text-sm text-[#0B1736]">Localização Ágil de Empresas e Documentos</h3>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p className="leading-relaxed">
                O GED está desenhado de forma corporativa para suportar milhares de arquivos sem perder agilidade na localização. Utilize as ferramentas de pesquisa rápida:
              </p>

              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5 pl-1">
                  <Search className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <strong className="text-slate-800">Filtro de Busca de Documentos:</strong> No topo do gerenciador de arquivos há uma barra de buscas inteligente que filtra de forma em tempo real o arquivo desejado ao digitar qualquer caractere correspondente ao nome do arquivo, tags ou metadados de datas.
                  </div>
                </div>

                <div className="flex items-start gap-2.5 pl-1">
                  <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <strong className="text-slate-800">Consultar CNPJ:</strong> No menu superior, você pode validar se uma empresa parceira ou cliente está ativa. Basta informar os 14 dígitos do CNPJ para receber um demonstrativo detalhado oficial gerado direto dos computadores federais.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Module 3 */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-2xs print:border-slate-300 print:shadow-none print:p-4">
            <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3 print:border-slate-300">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1B357B] flex items-center justify-center font-bold text-sm shrink-0 print:border print:border-slate-400">
                3
              </div>
              <h3 className="font-extrabold text-sm text-[#0B1736]">Navegação Estruturada em Pastas</h3>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600">
              <p className="leading-relaxed">
                A organização respeita a estrutura fiscal padrão do escritório da MVRJ Contábil. Cada cliente possui setores delimitados para evitar misturas de informações:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 print:grid-cols-1">
                <div className="p-3 bg-[#1B357B]/5 rounded-xl border border-[#1B357B]/10 print:border-slate-300 print:bg-white">
                  <span className="font-bold text-[10px] text-white bg-[#1B357B] px-1.5 py-0.5 rounded">Entrar nas Pastas</span>
                  <p className="text-[11px] text-slate-600 mt-2 leading-normal">
                    Dê um clique duplo (ou toque único) em qualquer pasta para abrir seu conteúdo. No cabeçalho, você verá o caminho completo (Ex: <span className="font-bold">Clientes &gt; Sua Empresa &gt; Contábil</span>).
                  </p>
                </div>

                <div className="p-3 bg-[#C59B4B]/5 rounded-xl border border-[#C59B4B]/10 print:border-slate-300 print:bg-white">
                  <span className="font-bold text-[10px] text-[#9A7528] bg-[#C59B4B]/20 px-1.5 py-0.5 rounded">Nova Pasta</span>
                  <p className="text-[11px] text-slate-600 mt-2 leading-normal">
                    Se você possuir papel de <strong>Editor</strong> ou <strong>Admin</strong>, verá o botão <strong>"+ Nova Pasta"</strong>. Clique, defina o nome adequado e organize seus documentos por períodos mensais ou filiais.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 print:border-slate-300 print:bg-white">
                  <span className="font-bold text-[10px] text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded">Drive Raiz</span>
                  <p className="text-[11px] text-slate-600 mt-2 leading-normal">
                    Use o botão de voltar ou clique no texto de navegação superior (Breadcrumbs) para retornar instantaneamente à raiz e trocar de setor de atendimento ou de cliente.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Module 4 */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-2xs print:border-slate-300 print:shadow-none print:p-4">
            <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3 print:border-slate-300">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1B357B] flex items-center justify-center font-bold text-sm shrink-0 print:border print:border-slate-400">
                4
              </div>
              <h3 className="font-extrabold text-sm text-[#0B1736]">Envio de Documentos (Upload)</h3>
            </div>

            <div className="space-y-4 text-xs text-slate-600">
              <p className="leading-relaxed">
                O envio de novos documentos é rápido, inteligente e conta com processo de compressão automatizado para preservar sua franquia de armazenamento:
              </p>

              <div className="relative border-l-2 border-slate-200 pl-4 space-y-4 ml-2">
                <div>
                  <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-[#1B357B]"></div>
                  <h4 className="font-bold text-slate-800 text-xs">Passo 1: Seleção do Arquivo</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Abra a pasta de destino correspondente, clique no botão <strong>"Fazer Upload"</strong>. Você pode arrastar o arquivo diretamente para o modal ou clicar para abrir o navegador de arquivos locais.
                  </p>
                </div>

                <div>
                  <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-[#1B357B]"></div>
                  <h4 className="font-bold text-slate-800 text-xs">Passo 2: Definição do Nome e Organização</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    O sistema permite renomear o arquivo diretamente no campo "Nome do Documento". Caso não altere, o nome original será mantido. Você pode anexar tags fiscais (Ex: Contábil, Fiscal, DP, Impostos) e selecionar o mês e ano de referência contábil.
                  </p>
                </div>

                <div>
                  <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-[#1B357B]"></div>
                  <h4 className="font-bold text-slate-800 text-xs">Passo 3: Conclusão do Envio</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Ao confirmar, o sistema otimiza o tamanho do arquivo via engine de compressão e realiza o upload seguro diretamente para o Cloudflare R2 com criptografia de ponta a ponta.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Module 5 */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-2xs print:border-slate-300 print:shadow-none print:p-4">
            <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3 print:border-slate-300">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1B357B] flex items-center justify-center font-bold text-sm shrink-0 print:border print:border-slate-400">
                5
              </div>
              <h3 className="font-extrabold text-sm text-[#0B1736]">Formatos de Arquivo Suportados & Visualização</h3>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p className="leading-relaxed">
                O GED MVRJ aceita múltiplos formatos de arquivo estruturados. Conheça as extensões homologadas e como o sistema lida com elas:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center print:grid-cols-2">
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 print:border-slate-300 print:bg-white">
                  <FileText className="w-6 h-6 text-red-600 mx-auto" />
                  <h4 className="font-bold text-xs text-slate-900 mt-2">Documentos PDF</h4>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Visualização instantânea pelo visualizador interno em modal seguro de alta definição.
                  </p>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 print:border-slate-300 print:bg-white">
                  <FileText className="w-6 h-6 text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-xs text-slate-900 mt-2">Planilhas Excel</h4>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Formatos <span className="font-semibold">.xlsx / .xls</span>. Download seguro imediato com integridade.
                  </p>
                </div>

                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 print:border-slate-300 print:bg-white">
                  <FileText className="w-6 h-6 text-blue-600 mx-auto" />
                  <h4 className="font-bold text-xs text-slate-900 mt-2">Arquivos Word</h4>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Formatos <span className="font-semibold">.docx / .doc</span>. Suporte completo para download.
                  </p>
                </div>

                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 print:border-slate-300 print:bg-white">
                  <FileText className="w-6 h-6 text-indigo-600 mx-auto" />
                  <h4 className="font-bold text-xs text-slate-900 mt-2">Imagens</h4>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Arquivos <span className="font-semibold">.png / .jpg / .jpeg</span>. Visualização direta no ecrã.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Module 6 - Security and Compliance */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3.5 print:bg-white print:border-slate-300 print:p-4">
            <h4 className="text-xs font-extrabold text-[#0B1736] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Segurança da Informação, LGPD & Rastreabilidade</span>
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Em total conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018)</strong>, todas as ações efetuadas dentro desta plataforma são registradas em logs de auditoria imutáveis. O sistema registra logs automáticos para ações como: upload de documentos, exclusões, renomeações de arquivos, downloads efetuados, acessos ao sistema e alterações de permissões de pastas.
            </p>
            <p className="text-[11px] text-slate-500">
              Para auxílio e esclarecimento de dúvidas técnicas, consulte o suporte da equipe de compliance da <strong>MVRJ Contábil</strong>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-center shrink-0 print:hidden text-center pb-7 sm:pb-5">
          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>MVRJ Contábil • Central de Ajuda e Suporte ao Cliente</span>
          </div>
        </div>
      </div>
    </div>
  );
};
