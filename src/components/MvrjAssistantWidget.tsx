import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Paperclip, Bot, User, AlertCircle, FileText, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ivanAvatar from '../assets/images/ivan_1790048076804.jpg';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  file?: {
    name: string;
    mimeType: string;
    data: string;
  };
}

export function MvrjAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'model',
      text: 'Olá! Sou MVRJ Contábil. Como posso te ajudar hoje? Fique à vontade para me perguntar qualquer coisa ou enviar documentos.',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ name: string; mimeType: string; data: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, messages, isLoading]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('O ficheiro é muito grande. O limite máximo é 15MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extract base64 part
      const base64Data = result.includes(',') ? result.split(',')[1] : result;
      setAttachedFile({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        data: base64Data,
      });
    };
    reader.onerror = () => {
      alert('Erro ao ler o ficheiro.');
    };
    reader.readAsDataURL(file);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (customText !== undefined ? customText : inputMessage).trim();
    if ((!textToSend && !attachedFile) || isLoading || rateLimitError) return;

    const userText = textToSend;
    const currentFile = attachedFile;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      text: userText || `[Ficheiro anexado: ${currentFile?.name}]`,
      file: currentFile || undefined,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setAttachedFile(null);
    setIsLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const payloadMessages = [...messages, userMsg].map(m => ({
        role: m.role,
        text: m.text,
        file: m.file,
      }));

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payloadMessages }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();

      if (res.status === 429 || !res.ok) {
        // Fallback inteligente automático
        throw new Error(data.error || 'Rate limit / Error');
      }

      const modelMsg: ChatMessage = {
        id: 'msg-model-' + Date.now(),
        role: 'model',
        text: data.reply || 'Recebido com sucesso.',
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[Assistant Widget Error]', err);

      // Fallback inteligente no cliente caso o servidor no Render esteja iniciando ou sem internet
      const q = (userText || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      let fallbackText = '';

      if (/^(oi|ola|bom dia|boa tarde|boa noite|opa|ola tudo bem|oi tudo bem|e ai|e aí|hello|hey|como vai)\s*[!?.]*$/i.test(q)) {
        fallbackText = 'Olá! Sou MVRJ Contábil. Como posso te ajudar hoje? Fique à vontade para me perguntar qualquer coisa ou me enviar documentos!';
      } else if (q.includes('das') || q.includes('guia') || q.includes('simples')) {
        fallbackText = 'O DAS (Documento de Arrecadação do Simples Nacional) vence no dia 20 de cada mês e unifica os tributos da empresa. Suas guias estão disponíveis na pasta Fiscal do GED MVRJ.';
      } else if (q.includes('defis')) {
        fallbackText = 'A DEFIS deve ser transmitida anualmente até o último dia útil de março pelas empresas enquadradas no Simples Nacional.';
      } else if (q.includes('nota') || q.includes('nfe') || q.includes('nfse') || q.includes('emitir')) {
        fallbackText = 'Para emissão de notas de serviço (NFS-e), acesse o portal municipal ou o emissor nacional. Para mercadorias (NF-e), utilize sistema emissor integrado com certificado digital A1.';
      } else if (q.includes('certificado') || q.includes('pfx') || q.includes('a1')) {
        fallbackText = 'O certificado digital A1 (.pfx) é indispensável para assinar documentos fiscais e acessar o e-CAC da Receita Federal.';
      } else {
        fallbackText = 'Olá! Sou MVRJ Contábil. Para ativar todas as respostas completas no Render, certifique-se de implantar como "Web Service" e adicionar a variável GEMINI_API_KEY no menu "Environment" do Render. Fique à vontade para conversar comigo!';
      }

      setMessages(prev => [
        ...prev,
        {
          id: 'fb-' + Date.now(),
          role: 'model',
          text: fallbackText,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="relative group flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-600 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-400/50"
          aria-label="Falar com MVRJ Contábil"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {/* Executive Avatar Image */}
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/90 shadow-inner bg-slate-900 flex items-center justify-center">
            <img
              src={ivanAvatar}
              onError={(e) => {
                // Fallback to executive illustration or icon if image fails
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
              alt="MVRJ Contábil"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Online status indicator badge */}
          <span className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-md animate-pulse" />

          {/* Tooltip on hover */}
          <span className="absolute right-full mr-3 px-3 py-1.5 bg-slate-900/90 text-white text-xs font-medium rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Falar com MVRJ Contábil 💬
          </span>
        </motion.button>
      </div>

      {/* Chat Window Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-24 right-4 sm:right-6 z-50 w-[92vw] sm:w-[420px] max-w-[500px] h-[600px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden font-sans overscroll-contain"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white px-4 py-3.5 flex items-center justify-between shadow-md">
              <div className="flex items-center space-x-3">
                <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-white/80 bg-blue-800 flex items-center justify-center shadow">
                  <img
                    src={ivanAvatar}
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                    alt="MVRJ Contábil"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border border-white rounded-full" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base tracking-tight flex items-center gap-1.5">
                    MVRJ Contábil
                  </h3>
                  <p className="text-xs text-blue-200/90 font-normal">Consultoria Contábil & Geral • Online</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Fechar chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Rate Limit Alert Card (if active) */}
            {rateLimitError && (
              <div className="bg-amber-50 border-b border-amber-200 p-3 flex items-start gap-2.5 text-amber-900 text-xs sm:text-sm animate-fadeIn">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block mb-0.5">Aviso de Quota Temporária</span>
                  {rateLimitError}
                </div>
                <button
                  onClick={() => setRateLimitError(null)}
                  className="text-amber-700 hover:text-amber-900 font-bold px-1"
                  title="Fechar aviso"
                >
                  ×
                </button>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/60 overscroll-contain">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none'
                    }`}
                  >
                    {msg.file && (
                      <div className="mb-2 p-2 bg-black/10 rounded-lg flex items-center gap-2 text-xs font-medium">
                        <FileText className="w-4 h-4 shrink-0" />
                        <span className="truncate">{msg.file.name}</span>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                  </div>
                </div>
              ))}



              {isLoading && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium">
                    <span>Digitando...</span>
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Attached File Preview Bar */}
            {attachedFile && (
              <div className="px-3 py-2 bg-blue-50 border-t border-blue-100 flex items-center justify-between text-xs text-blue-900">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-medium truncate">{attachedFile.name}</span>
                  <span className="text-blue-500 text-[10px]">Pronto para envio multimodal</span>
                </div>
                <button
                  onClick={() => setAttachedFile(null)}
                  className="p-1 rounded hover:bg-blue-200/50 text-blue-700 transition-colors"
                  title="Remover anexo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png,image/jpeg,image/jpg,application/pdf"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || !!rateLimitError}
                className="p-2.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                title="Anexar nota fiscal, guia ou documento (PDF, PNG, JPG)"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={rateLimitError ? 'Consultas temporariamente limitadas...' : 'Converse com MVRJ Contábil ou envie um documento...'}
                disabled={isLoading || !!rateLimitError}
                className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={(!inputMessage.trim() && !attachedFile) || isLoading || !!rateLimitError}
                className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-md disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Enviar mensagem"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
