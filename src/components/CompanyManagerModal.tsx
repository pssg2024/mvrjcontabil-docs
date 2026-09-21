import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  X, 
  Trash2, 
  Edit3, 
  Plus, 
  UploadCloud, 
  KeyRound, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff,
  Briefcase,
  Search,
  Loader2,
  FileKey
} from 'lucide-react';
import { Company, TaxRegime } from '../types';
import { formatCnpj, cleanCnpj, fetchCompanyByCnpj } from '../lib/cnpj-service';
import { motion, AnimatePresence } from 'motion/react';

interface CompanyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompanyChange?: () => void;
}

export const CompanyManagerModal: React.FC<CompanyManagerModalProps> = ({
  isOpen,
  onClose,
  onCompanyChange
}) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [regimeTributario, setRegimeTributario] = useState<TaxRegime>('Simples Nacional');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchCompanies();
      resetForm();
    }
  }, [isOpen]);

  const fetchCompanies = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/companies');
      const data = await response.json();
      if (response.ok && data.companies) {
        setCompanies(data.companies);
      } else {
        setErrorMessage(data.error || 'Falha ao buscar empresas clientes.');
      }
    } catch (err: any) {
      setErrorMessage('Erro de conexão com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setRazaoSocial('');
    setNomeFantasia('');
    setCnpj('');
    setInscricaoEstadual('');
    setRegimeTributario('Simples Nacional');
    setCertificateFile(null);
    setCertificatePassword('');
    setShowPassword(false);
    setIsFormOpen(false);
  };

  const handleOpenCreateForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleEdit = (company: Company) => {
    setEditingId(company.id);
    setRazaoSocial(company.razao_social);
    setNomeFantasia(company.nome_fantasia || '');
    setCnpj(formatCnpj(company.cnpj));
    setInscricaoEstadual(company.inscricao_estadual || '');
    setRegimeTributario(company.regime_tributario);
    setCertificatePassword(company.certificate_password || '');
    setCertificateFile(null); // File has to be re-uploaded if changing
    setIsFormOpen(true);
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = cleanCnpj(e.target.value);
    if (rawVal.length <= 14) {
      setCnpj(formatCnpj(rawVal));
    }
  };

  // Pre-fill company data using the CNPJ consult service
  const handleConsultCnpj = async () => {
    const cleaned = cleanCnpj(cnpj);
    if (cleaned.length !== 14) {
      setErrorMessage('Digite um CNPJ válido com 14 dígitos para consultar.');
      return;
    }

    setIsActionLoading(true);
    setErrorMessage(null);
    try {
      const apiData = await fetchCompanyByCnpj(cleaned);
      if (apiData) {
        setRazaoSocial(apiData.razao_social || '');
        setNomeFantasia(apiData.nome_fantasia || '');
        if (apiData.opcao_pelo_simples) {
          setRegimeTributario('Simples Nacional');
        }
        setSuccessMessage('Dados da empresa importados da Receita Federal com sucesso!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setErrorMessage('Empresa não encontrada ou limite de consultas atingido.');
      }
    } catch (err) {
      setErrorMessage('Não foi possível obter dados para este CNPJ.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a empresa "${name}"?`)) return;

    setIsActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccessMessage('Empresa excluída com sucesso!');
        fetchCompanies();
        if (onCompanyChange) onCompanyChange();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const d = await res.json();
        setErrorMessage(d.error || 'Falha ao excluir empresa.');
      }
    } catch {
      setErrorMessage('Erro ao se conectar ao servidor.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanCnpjStr = cleanCnpj(cnpj);
    if (!razaoSocial.trim()) {
      setErrorMessage('O campo Razão Social é obrigatório.');
      return;
    }
    if (cleanCnpjStr.length !== 14) {
      setErrorMessage('O CNPJ deve conter exatamente 14 dígitos.');
      return;
    }

    setIsActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('razao_social', razaoSocial.trim());
      formData.append('nome_fantasia', nomeFantasia.trim());
      formData.append('cnpj', cleanCnpjStr);
      formData.append('inscricao_estadual', inscricaoEstadual.trim());
      formData.append('regime_tributario', regimeTributario);
      formData.append('certificate_password', certificatePassword.trim());
      if (certificateFile) {
        formData.append('certificate', certificateFile);
      }

      const url = editingId ? `/api/companies/${editingId}` : '/api/companies';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(editingId ? 'Empresa atualizada com sucesso!' : 'Empresa cadastrada com sucesso!');
        fetchCompanies();
        resetForm();
        if (onCompanyChange) onCompanyChange();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setErrorMessage(data.error || 'Erro ao processar requisição.');
      }
    } catch {
      setErrorMessage('Falha na comunicação com o servidor.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const filteredCompanies = companies.filter(c => {
    const term = searchQuery.toLowerCase();
    return (
      c.razao_social.toLowerCase().includes(term) ||
      (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(term)) ||
      c.cnpj.includes(term)
    );
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div id="company-manager-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <motion.div 
          id="company-manager-content"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden text-neutral-800 border border-neutral-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4 bg-neutral-50/50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-neutral-950">Gestão de Empresas Clientes</h2>
                <p className="text-xs text-neutral-500">Cadastre e gerencie as empresas do escritório e seus certificados A1</p>
              </div>
            </div>
            <button 
              id="company-manager-close-btn"
              onClick={onClose} 
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Esquerda: Lista de Empresas */}
            <div className={`flex flex-col border-r border-neutral-100 bg-white transition-all duration-300 ${isFormOpen ? 'w-1/2' : 'w-full'}`}>
              {/* Barra de Ações & Busca */}
              <div className="flex flex-col gap-3 p-4 border-b border-neutral-100 bg-neutral-50/30">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-neutral-400" />
                    <input
                      id="company-search-input"
                      type="text"
                      placeholder="Buscar por nome, razão ou CNPJ..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-10 pr-4 text-sm outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <button
                    id="company-add-new-btn"
                    onClick={handleOpenCreateForm}
                    className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 active:bg-teal-800 transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Cadastrar</span>
                  </button>
                </div>
              </div>

              {/* Tabela / Lista */}
              <div className="flex-1 overflow-y-auto p-4">
                {isLoading ? (
                  <div className="flex h-40 flex-col items-center justify-center text-neutral-400">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-600 mb-2" />
                    <p className="text-sm">Carregando lista de empresas...</p>
                  </div>
                ) : filteredCompanies.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center text-neutral-400">
                    <Building2 className="h-10 w-10 text-neutral-300 mb-2" />
                    <p className="text-sm font-medium">Nenhuma empresa encontrada</p>
                    <p className="text-xs text-neutral-400">Cadastre uma nova empresa cliente.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredCompanies.map((company) => (
                      <div
                        id={`company-row-${company.id}`}
                        key={company.id}
                        className={`flex items-center justify-between rounded-xl border p-4 transition-all ${
                          editingId === company.id
                            ? 'border-teal-500 bg-teal-50/20'
                            : 'border-neutral-200 bg-white hover:bg-neutral-50/50'
                        }`}
                      >
                        <div className="flex flex-col gap-1 min-w-0 flex-1 pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-neutral-900 truncate max-w-[280px]">
                              {company.razao_social}
                            </h3>
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                              {company.regime_tributario}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500">
                            {company.nome_fantasia ? `${company.nome_fantasia} • ` : ''}CNPJ: {formatCnpj(company.cnpj)}
                          </p>
                          {company.certificate_filename ? (
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-md mt-1">
                              <FileKey className="h-3.5 w-3.5" />
                              <span className="truncate max-w-[180px]">Certificado: {company.certificate_filename}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 bg-amber-50 w-fit px-2 py-0.5 rounded-md mt-1">
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span>Sem Certificado Digital</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            id={`company-edit-btn-${company.id}`}
                            onClick={() => handleEdit(company)}
                            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition"
                            title="Editar"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            id={`company-delete-btn-${company.id}`}
                            onClick={() => handleDelete(company.id, company.razao_social)}
                            className="rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 transition"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Direita: Formulário de Cadastro/Edição */}
            <AnimatePresence>
              {isFormOpen && (
                <motion.div
                  id="company-form-container"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: '50%', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col bg-neutral-50/50 overflow-y-auto"
                >
                  <form id="company-form" onSubmit={handleSubmit} className="flex-1 p-6 space-y-5">
                    <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                      <h3 className="font-bold text-neutral-950 flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-teal-600" />
                        <span>{editingId ? 'Editar Empresa' : 'Cadastrar Empresa'}</span>
                      </h3>
                      <button
                        id="company-form-cancel-btn"
                        type="button"
                        onClick={resetForm}
                        className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 transition"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* CNPJ com consulta automatica */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-700">CNPJ *</label>
                      <div className="flex gap-2">
                        <input
                          id="company-cnpj-input"
                          type="text"
                          required
                          placeholder="00.000.000/0000-00"
                          value={cnpj}
                          onChange={handleCnpjChange}
                          className="flex-1 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                        />
                        <button
                          id="company-consult-cnpj-btn"
                          type="button"
                          disabled={cleanCnpj(cnpj).length !== 14 || isActionLoading}
                          onClick={handleConsultCnpj}
                          className="rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 transition flex items-center gap-1"
                        >
                          {isActionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                          <span>Consultar</span>
                        </button>
                      </div>
                    </div>

                    {/* Razão Social */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-700">Razão Social *</label>
                      <input
                        id="company-razao-social-input"
                        type="text"
                        required
                        placeholder="Ex: Nome Completo da Empresa Ltda"
                        value={razaoSocial}
                        onChange={(e) => setRazaoSocial(e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                      />
                    </div>

                    {/* Nome Fantasia */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-700">Nome Fantasia</label>
                      <input
                        id="company-nome-fantasia-input"
                        type="text"
                        placeholder="Ex: Nome Comercial"
                        value={nomeFantasia}
                        onChange={(e) => setNomeFantasia(e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                      />
                    </div>

                    {/* Inscrição Estadual & Regime Tributário */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-700">Inscrição Estadual</label>
                        <input
                          id="company-ie-input"
                          type="text"
                          placeholder="Ex: 12345678"
                          value={inscricaoEstadual}
                          onChange={(e) => setInscricaoEstadual(e.target.value)}
                          className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-teal-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-700">Regime Tributário *</label>
                        <select
                          id="company-regime-select"
                          value={regimeTributario}
                          onChange={(e) => setRegimeTributario(e.target.value as TaxRegime)}
                          className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-teal-500"
                        >
                          <option value="Simples Nacional">Simples Nacional</option>
                          <option value="Lucro Presumido">Lucro Presumido</option>
                          <option value="Lucro Real">Lucro Real</option>
                        </select>
                      </div>
                    </div>

                    {/* Upload Certificado Digital A1 */}
                    <div className="border-t border-neutral-200 pt-4 space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Certificado Digital A1 (.pfx)</h4>
                      
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-700">Arquivo de Certificado</label>
                        <div className="flex items-center justify-center w-full">
                          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-neutral-200 border-dashed rounded-xl cursor-pointer bg-white hover:bg-neutral-50 transition">
                            <div className="flex flex-col items-center justify-center pt-3 pb-3">
                              <UploadCloud className="w-8 h-8 mb-1 text-neutral-400" />
                              <p className="text-xs text-neutral-500">
                                <span className="font-semibold text-teal-600">Upload do Certificado</span> ou arraste o arquivo
                              </p>
                              <p className="text-[10px] text-neutral-400">PFX (A1) suportado</p>
                            </div>
                            <input
                              id="company-certificate-upload-input"
                              type="file"
                              accept=".pfx"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) setCertificateFile(f);
                              }}
                            />
                          </label>
                        </div>
                        {certificateFile && (
                          <p className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Selecionado: {certificateFile.name}</span>
                          </p>
                        )}
                      </div>

                      {/* Senha do Certificado */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-700">Senha do Certificado</label>
                        <div className="relative">
                          <input
                            id="company-certificate-password-input"
                            type={showPassword ? "text" : "password"}
                            placeholder="Digite a senha do certificado .pfx"
                            value={certificatePassword}
                            onChange={(e) => setCertificatePassword(e.target.value)}
                            className="w-full rounded-xl border border-neutral-200 bg-white pl-3.5 pr-10 py-2 text-sm outline-none focus:border-teal-500"
                          />
                          <button
                            id="company-certificate-password-toggle"
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="border-t border-neutral-200 pt-4 flex justify-end gap-3">
                      <button
                        id="company-form-reset-btn"
                        type="button"
                        onClick={resetForm}
                        className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 transition"
                      >
                        Cancelar
                      </button>
                      <button
                        id="company-form-submit-btn"
                        type="submit"
                        disabled={isActionLoading}
                        className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 transition"
                      >
                        {isActionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                        <span>{editingId ? 'Salvar Alterações' : 'Cadastrar Empresa'}</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Toast / Status messages */}
          <div className="absolute bottom-4 left-6 z-10 flex flex-col gap-2 pointer-events-none">
            {errorMessage && (
              <motion.div 
                id="company-error-toast"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 shadow-md pointer-events-auto"
              >
                <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                <span>{errorMessage}</span>
              </motion.div>
            )}
            {successMessage && (
              <motion.div 
                id="company-success-toast"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 shadow-md pointer-events-auto"
              >
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
                <span>{successMessage}</span>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
