import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Paperclip, Bot, User, AlertCircle, FileText, CheckCircle2, Loader2, Sparkles, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const CONSULTANT_TIPS = [
  {
    title: 'Consultoria MVRJ',
    text: 'Olá! Sou sua consultora virtual da MVRJ Contábil. Como posso te ajudar hoje?',
    query: 'Olá! Quais orientações fiscais e contábeis você pode me fornecer?',
  },
  {
    title: 'Guia Simples Nacional (DAS)',
    text: 'Precisa emitir ou consultar a guia DAS do mês? Posso te orientar!',
    query: 'Como consulto e emito o DAS do Simples Nacional?',
  },
  {
    title: 'Envio de Documentos',
    text: 'Você pode me enviar notas fiscais e relatórios em PDF para conferência!',
    query: 'Como funciona o envio e análise de documentos contábeis?',
  },
  {
    title: 'Certificados & Prazos',
    text: 'Dúvidas sobre Certificado Digital A1 ou prazos tributários de 2026/2027?',
    query: 'Quais os principais prazos fiscais e como renovar o certificado A1?',
  },
];

export function AssistantAvatar({
  className = "w-full h-full",
  showStatus = false,
}: {
  className?: string;
  showStatus?: boolean;
}) {
  return (
    <div className={`relative rounded-full overflow-hidden flex items-center justify-center ${className}`}>
      <img
        src="/images/accounting_consultant.jpg"
        alt="Consultoria Contábil MVRJ"
        className="w-full h-full object-cover object-top select-none pointer-events-none"
        referrerPolicy="no-referrer"
      />
      {showStatus && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full shadow" />
      )}
    </div>
  );
}

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

  // Estados de Interatividade da Consultora
  const [isHovered, setIsHovered] = useState(false);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [showBubble, setShowBubble] = useState(false);
  const [dismissedBubble, setDismissedBubble] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ciclo periódico de interação amigável
  useEffect(() => {
    if (isOpen || dismissedBubble) return;

    // Primeiro cumprimento aos 3.5s
    const firstTimer = setTimeout(() => {
      setShowBubble(true);
    }, 3500);

    // Ciclo a cada 26 segundos com nova dica interativa
    const interval = setInterval(() => {
      if (!isOpen && !dismissedBubble) {
        setCurrentTipIndex(prev => (prev + 1) % CONSULTANT_TIPS.length);
        setShowBubble(true);
        setTimeout(() => setShowBubble(false), 7000);
      }
    }, 26000);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(interval);
    };
  }, [isOpen, dismissedBubble]);

  const handleQuickQuestion = (query: string) => {
    setShowBubble(false);
    setIsOpen(true);
    setTimeout(() => {
      handleSendMessage(undefined, query);
    }, 250);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalTop = document.body.style.top;
      const originalWidth = document.body.style.width;
      const originalTouchAction = document.body.style.touchAction;
      const originalHtmlOverflow = document.documentElement.style.overflow;

      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.touchAction = 'none';

      return () => {
        document.documentElement.style.overflow = originalHtmlOverflow;
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = originalWidth;
        document.body.style.touchAction = originalTouchAction;
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

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
      {/* Balão de Fala Interativo da Consultora */}
      <AnimatePresence>
        {!isOpen && showBubble && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-28 right-6 z-50 max-w-[290px] sm:max-w-xs bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-3.5 shadow-2xl border border-blue-200/80 dark:border-blue-900/60 text-slate-800 dark:text-slate-100 font-sans"
          >
            {/* Ponta do balão apontando para o botão */}
            <div className="absolute -bottom-2 right-9 w-4 h-4 bg-white dark:bg-slate-900 border-r border-b border-blue-200/80 dark:border-blue-900/60 rotate-45" />

            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                {CONSULTANT_TIPS[currentTipIndex].title}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBubble(false);
                  setDismissedBubble(true);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer transition-colors"
                title="Fechar dica"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug mb-2.5">
              {CONSULTANT_TIPS[currentTipIndex].text}
            </p>

            <button
              type="button"
              onClick={() => handleQuickQuestion(CONSULTANT_TIPS[currentTipIndex].query)}
              className="w-full py-1.5 px-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center justify-between transition-all group cursor-pointer active:scale-98"
            >
              <span>Falar com Consultoria</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button - Consultoria Contábil (Referência Exata) */}
      <div className="fixed bottom-6 right-6 z-50">
        <motion.button
          onClick={() => {
            setIsOpen(!isOpen);
            setShowBubble(false);
          }}
          onMouseEnter={() => {
            setIsHovered(true);
            if (!dismissedBubble) {
              setShowBubble(true);
            }
          }}
          onMouseLeave={() => {
            setIsHovered(false);
          }}
          className="relative group flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-600 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-400/50 cursor-pointer"
          aria-label="Falar com MVRJ Contábil"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.95 }}
        >
          {/* Foto Circular da Consultora Contábil */}
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/95 shadow-inner bg-slate-100 flex items-center justify-center">
            <img
              src="/images/accounting_consultant.jpg"
              alt="Consultoria MVRJ Contábil"
              className="w-full h-full object-cover object-top select-none pointer-events-none"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Indicador de Status Online no Topo Direito (igual à imagem de referência) */}
          <span className="absolute top-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-md animate-pulse z-10" />

          {/* Tooltip on hover */}
          <span className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 bg-slate-900/95 text-white text-xs font-medium rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">
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
            className="fixed bottom-24 right-4 sm:right-6 z-50 w-[92vw] sm:w-[420px] max-w-[500px] h-[600px] max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden font-sans overscroll-contain"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white px-4 py-3.5 flex items-center justify-between shadow-md border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-[#DFB76C]/80 bg-slate-900 flex items-center justify-center shadow flex-shrink-0">
                  <img
                    src="/images/accounting_consultant.jpg"
                    alt="Consultora MVRJ Contábil"
                    className="w-full h-full object-cover object-top"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border border-white rounded-full" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base tracking-tight flex items-center gap-1.5">
                    MVRJ Contábil
                  </h3>
                  <p className="text-xs text-blue-200/90 font-normal">
                    {isLoading ? 'Consultoria digitando resposta...' : 'Consultoria Contábil & Geral • Online'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/70 overscroll-contain">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'model' && (
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-blue-400/40 shadow-xs shrink-0 self-end mb-1">
                      <img
                        src="/images/accounting_consultant.jpg"
                        alt="Consultora MVRJ"
                        className="w-full h-full object-cover object-top"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-blue-700 to-[#1B357B] text-white rounded-br-none shadow-sm'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none shadow-xs'
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
