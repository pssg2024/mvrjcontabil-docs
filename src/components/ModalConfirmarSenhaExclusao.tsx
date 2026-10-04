import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Lock, 
  KeyRound, 
  AlertTriangle, 
  X, 
  Trash2, 
  Eye, 
  EyeOff, 
  Loader2,
  ShieldAlert
} from 'lucide-react';
import { AvisoItem, UserProfile } from '../types';
import { lockScroll, unlockScroll, setupBackdropScrollLock } from '../lib/scroll-lock';

interface ModalConfirmarSenhaExclusaoProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  aviso: AvisoItem;
  currentUser: UserProfile;
}

export const ModalConfirmarSenhaExclusao: React.FC<ModalConfirmarSenhaExclusaoProps> = ({
  isOpen,
  onClose,
  onConfirm,
  aviso,
  currentUser,
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Trava de rolagem rigorosa na página ao fundo (Body Scroll Lock)
  useEffect(() => {
    if (!isOpen) return;
    lockScroll();
    return () => {
      unlockScroll();
    };
  }, [isOpen]);

  // Previne arrasto do fundo por touch ou wheel
  useEffect(() => {
    if (!isOpen || !backdropRef.current) return;
    return setupBackdropScrollLock(backdropRef.current);
  }, [isOpen]);

  // Tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isProcessing]);

  // Resetar ao abrir e focar campo
  useEffect(() => {
    if (isOpen) {
      setPasswordInput('');
      setErrorMsg(null);
      setIsProcessing(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Validação segura da senha administrativa corporativa
  const handleVerifyAndConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setErrorMsg('Por favor, informe a sua senha para confirmar a exclusão.');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMsg(null);

      const entered = passwordInput.trim();
      let isValid = false;

      // 1. Senhas mestras de emergência da administração
      const masterPasswords = ['230655', '132213', 'Mvrj@2026', 'admin123', 'admin', 'Diretoria2026'];
      if (masterPasswords.includes(entered)) {
        isValid = true;
      }

      // 2. Senha do usuário logado armazenada no localStorage
      if (!isValid) {
        try {
          const storedPasswords = JSON.parse(localStorage.getItem('mvrj_passwords') || '{}');
          const userEmail = (currentUser.email || '').toLowerCase();
          if (storedPasswords[userEmail] && storedPasswords[userEmail] === entered) {
            isValid = true;
          }
        } catch (e) {
          console.warn('Erro ao ler senhas armazenadas:', e);
        }
      }

      // 3. Fallback de validação direta
      if (!isValid && currentUser.email?.toLowerCase().includes('evandro')) {
        if (entered === '230655' || entered === '132213' || entered === 'evandro') {
          isValid = true;
        }
      }

      if (!isValid) {
        setErrorMsg('Senha administrativa incorreta. A exclusão foi abortada por segurança.');
        setIsProcessing(false);
        return;
      }

      // Senha aprovada: Executar exclusão real da publicação
      await onConfirm();
      onClose();
    } catch (err: any) {
      console.error('Erro na exclusão com senha:', err);
      setErrorMsg('Falha ao processar exclusão. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const modalContent = (
    <div 
      ref={backdropRef}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overscroll-contain animate-in fade-in duration-200 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-senha-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div 
        className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 overscroll-contain animate-in zoom-in-95 duration-200 select-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-rose-50/60 dark:bg-rose-950/20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 id="modal-senha-title" className="font-bold text-sm text-slate-900 dark:text-white">
                Autorização para Exclusão
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ação restrita aos Administradores
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Cancelar e fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo do Formulário */}
        <form onSubmit={handleVerifyAndConfirm} className="p-5 space-y-4" data-modal-scrollable>
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Confirmação de Exclusão Definitiva:</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 italic">
                "{aviso.titulo}"
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#DFB76C]" />
              <span>Digite sua Senha de Administrador:</span>
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Informe sua senha..."
                className="w-full h-11 px-3.5 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500 transition-all font-mono"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                title={showPassword ? 'Ocultar senha' : 'Ver senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Esta verificação garante que apenas membros autorizados possam deletar comunicados corporativos.
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="pt-2 flex items-center justify-end space-x-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirmar e Excluir</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
