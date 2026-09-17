import React, { useState } from 'react';
import { Search, CheckCircle2, AlertCircle, Calculator, Copy, Check, Wrench } from 'lucide-react';

// Helper for BrazilAPI
const fetchCNPJ = async (cnpj: string) => {
  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj.replace(/\D/g, '')}`);
  if (!response.ok) throw new Error('CNPJ não encontrado');
  return response.json();
};

const validarCPF = (cpf: string) => {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let soma = 0, resto;
  for (let i = 1; i <= 9; i++) soma = soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
  resto = (soma * 10) % 11;
  if ((resto === 10) || (resto === 11)) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;
  soma = 0;
  for (let i = 1; i <= 10; i++) soma = soma + parseInt(cpf.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if ((resto === 10) || (resto === 11)) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;
  return true;
};

const validarCNPJ = (cnpj: string) => {
  cnpj = cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  let tamanho = cnpj.length - 2, numeros = cnpj.substring(0, tamanho), digitos = cnpj.substring(tamanho), soma = 0, pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
  let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado !== parseInt(digitos.charAt(0))) return false;
  tamanho = tamanho + 1; numeros = cnpj.substring(0, tamanho); soma = 0; pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
  resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado !== parseInt(digitos.charAt(1))) return false;
  return true;
};

export const UtilitiesPage = ({ onBack }: { onBack: () => void }) => {
  const [activeTab, setActiveTab] = useState<'cnpj' | 'validador' | 'simulador'>('cnpj');
  
  // CNPJ States
  const [cnpj, setCnpj] = useState('');
  const [cnpjResult, setCnpjResult] = useState<any>(null);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Validator States
  const [doc, setDoc] = useState('');
  const [docResult, setDocResult] = useState<{ valid: boolean, type: string } | null>(null);

  // Simulator States
  const [salario, setSalario] = useState(0);
  const [meses, setMeses] = useState(1);
  const [dias, setDias] = useState(0);
  const [tipo, setTipo] = useState<'semJustaCausa' | 'pedidoDemissao'>('semJustaCausa');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const calcRescisao = () => {
    const saldoSalario = (salario / 30) * dias;
    const decimoTerceiro = (salario / 12) * meses;
    const ferias = ((salario / 12) * meses) * 1.3333;
    return saldoSalario + decimoTerceiro + ferias;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-[#1B357B] text-white rounded-2xl p-8 mb-8 shadow-lg border border-[#C59B4B]/20">
        <h1 className="text-2xl font-bold mb-2">Hub de Utilitários & Rotinas Fiscais</h1>
        <p className="text-blue-100 text-sm">Ferramentas práticas para conferência cadastral, validações e simulações do escritório.</p>
        <button onClick={onBack} className="mt-4 bg-white/10 hover:bg-white/20 text-white text-xs px-4 py-2 rounded-xl transition-all">← Voltar ao Drive de Documentos</button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex space-x-2 mb-6 border-b border-slate-200">
          {['cnpj', 'validador', 'simulador'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-3 text-sm font-semibold rounded-t-xl transition-all ${activeTab === tab ? 'bg-[#1B357B] text-white' : 'text-slate-600 hover:text-[#1B357B]'}`}>
              {tab === 'cnpj' ? 'Consulta CNPJ' : tab === 'validador' ? 'Validador' : 'Simulador de Rescisão'}
            </button>
          ))}
        </div>

        <div className="min-h-[400px]">
          {activeTab === 'cnpj' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="Digite o CNPJ" className="flex-1 p-3 rounded-xl border border-slate-300 text-sm focus:border-[#1B357B] focus:ring-2 focus:ring-[#1B357B]/20 outline-none" />
                <button onClick={async () => { setLoadingCnpj(true); try { setCnpjResult(await fetchCNPJ(cnpj)); } catch (e) { alert(e); } setLoadingCnpj(false); }} className="px-6 bg-[#C59B4B] hover:bg-[#B38A3A] text-white rounded-xl text-sm font-semibold shadow-sm">
                  {loadingCnpj ? 'Consultando...' : 'Consultar'}
                </button>
              </div>
              {cnpjResult && (
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-sm relative">
                  <button onClick={() => copyToClipboard(JSON.stringify(cnpjResult, null, 2))} className="absolute top-4 right-4 p-2 bg-white rounded-lg border hover:bg-slate-100">
                    {copied ? <Check className="w-4 h-4 text-emerald-600"/> : <Copy className="w-4 h-4 text-slate-500"/>}
                  </button>
                  <p><strong>Razão Social:</strong> {cnpjResult.razao_social}</p>
                  <p><strong>Situação:</strong> <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cnpjResult.descricao_situacao_cadastral === 'ATIVA' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{cnpjResult.descricao_situacao_cadastral}</span></p>
                  <p><strong>CNAE Principal:</strong> {cnpjResult.cnae_fiscal} - {cnpjResult.cnae_fiscal_descricao}</p>
                  <p><strong>Endereço:</strong> {cnpjResult.logradouro}, {cnpjResult.numero} - {cnpjResult.municipio}/{cnpjResult.uf} (CEP: {cnpjResult.cep})</p>
                </div>
              )}
            </div>
          )}
          {activeTab === 'validador' && (
            <div className="space-y-4">
              <input value={doc} onChange={(e) => { setDoc(e.target.value); const cleaned = e.target.value.replace(/\D/g, ''); setDocResult({ valid: cleaned.length === 11 ? validarCPF(cleaned) : cleaned.length === 14 ? validarCNPJ(cleaned) : false, type: cleaned.length <= 11 ? 'CPF' : 'CNPJ' }); }} placeholder="Cole CPF ou CNPJ" className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:border-[#1B357B] focus:ring-2 focus:ring-[#1B357B]/20 outline-none" />
              {docResult && (
                <div className={`p-4 rounded-xl text-sm font-medium flex flex-col gap-3 ${docResult.valid ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                  <div className="flex items-center gap-2">{docResult.valid ? <CheckCircle2 className="w-5 h-5"/> : <AlertCircle className="w-5 h-5"/>} {docResult.type} {docResult.valid ? 'Válido' : 'Inválido'}</div>
                  {docResult.valid && (
                    <div className="flex gap-2">
                      <button onClick={() => copyToClipboard(doc.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4").replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5"))} className="text-xs underline">Copiar com pontuação</button>
                      <button onClick={() => copyToClipboard(doc.replace(/\D/g, ''))} className="text-xs underline">Copiar apenas números</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {activeTab === 'simulador' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-700">Salário Bruto</label>
                <input type="number" value={salario} onChange={(e) => setSalario(Number(e.target.value))} className="w-full p-3 rounded-xl border border-slate-300 text-sm" />
                <label className="block text-sm font-medium text-slate-700">Meses / Dias trabalhados</label>
                <div className="flex gap-2">
                  <input type="number" value={meses} onChange={(e) => setMeses(Number(e.target.value))} className="w-1/2 p-3 rounded-xl border border-slate-300 text-sm" placeholder="Meses" />
                  <input type="number" value={dias} onChange={(e) => setDias(Number(e.target.value))} className="w-1/2 p-3 rounded-xl border border-slate-300 text-sm" placeholder="Dias" />
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col justify-center items-center">
                <h3 className="text-slate-500 text-sm mb-2">Total Estimado</h3>
                <p className="text-4xl font-bold text-[#1B357B]">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calcRescisao())}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
