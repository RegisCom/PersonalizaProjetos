import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, X, Mail, Loader2, AlertCircle, FileText } from "lucide-react";

interface EnviarEquipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  contratoNome: string;
  nomeCliente?: string;
  onSend: (params: {
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    customMessage: string;
  }) => Promise<void>;
  hasPdfAttachment?: boolean;
}

export default function EnviarEquipeModal({
  isOpen,
  onClose,
  contratoNome,
  nomeCliente = "Cliente",
  onSend,
  hasPdfAttachment = true,
}: EnviarEquipeModalProps) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch email defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setIsLoadingDefaults(true);

      // Default subject and message
      setSubject(`🎉 Novo Contrato Fechado: ${nomeCliente || "Cliente"} - ${contratoNome}`);
      setCustomMessage(`Segue em anexo e informado abaixo o resumo do contrato fechado para alinhamento e início das atividades da equipe.`);

      fetch("/api/email-defaults")
        .then((res) => {
          if (res.ok) return res.json();
          return { to: "", cc: "", bcc: "" };
        })
        .then((data) => {
          if (data.to) setTo(data.to);
          if (data.cc) setCc(data.cc);
          if (data.bcc) setBcc(data.bcc);
        })
        .catch((err) => {
          console.error("Erro ao carregar padrões de e-mail:", err);
        })
        .finally(() => {
          setIsLoadingDefaults(false);
        });
    }
  }, [isOpen, contratoNome, nomeCliente]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim()) {
      setErrorMsg("Informe ao menos um e-mail de destinatário (Para).");
      return;
    }

    setErrorMsg(null);
    setIsSending(true);

    try {
      await onSend({
        to: to.trim(),
        cc: cc.trim(),
        bcc: bcc.trim(),
        subject: subject.trim(),
        customMessage: customMessage.trim(),
      });
      onClose();
    } catch (err: any) {
      console.error("Erro ao enviar e-mail:", err);
      setErrorMsg(err.message || "Ocorreu um erro ao enviar o e-mail.");
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Modal Header */}
          <div className="px-6 py-4 bg-slate-800 text-white flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Enviar E-mail para Equipe
                </h3>
                <p className="text-[11px] text-slate-300 font-medium">
                  {contratoNome} {nomeCliente ? `• ${nomeCliente}` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content / Form */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
            {isLoadingDefaults && (
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Carregando destinatários padrão do sistema...</span>
              </div>
            )}

            {errorMsg && (
              <div className="flex items-start gap-2 bg-red-50 text-red-700 p-3 rounded-xl border border-red-200 font-semibold">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Para (Destinatários) */}
            <div className="space-y-1">
              <label className="block text-slate-700 font-extrabold uppercase text-[11px]">
                Para (Destinatários Principais) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="ex: equipe@empresa.com, engenharia@empresa.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-800 text-slate-800 font-semibold bg-slate-50 focus:bg-white"
              />
              <p className="text-[10px] text-slate-400">Separe múltiplos e-mails por vírgula.</p>
            </div>

            {/* Cópia Carbono (CC) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-slate-700 font-extrabold uppercase text-[11px]">
                  Cópia Carbono (CC)
                </label>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="ex: gestao@empresa.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-800 text-slate-800 font-semibold bg-slate-50 focus:bg-white"
                />
              </div>

              {/* Cópia Oculta (BCC) */}
              <div className="space-y-1">
                <label className="block text-slate-700 font-extrabold uppercase text-[11px]">
                  Cópia Oculta (BCC)
                </label>
                <input
                  type="text"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="ex: diretoria@empresa.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-800 text-slate-800 font-semibold bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            {/* Assunto */}
            <div className="space-y-1">
              <label className="block text-slate-700 font-extrabold uppercase text-[11px]">
                Assunto do E-mail <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Assunto do e-mail"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-800 text-slate-800 font-bold bg-slate-50 focus:bg-white"
              />
            </div>

            {/* Mensagem / Observações */}
            <div className="space-y-1">
              <label className="block text-slate-700 font-extrabold uppercase text-[11px]">
                Mensagem / Observações Adicionais
              </label>
              <textarea
                rows={3}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Digite aqui orientações ou observações para a equipe..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-800 text-slate-800 font-medium bg-slate-50 focus:bg-white resize-none"
              />
            </div>

            {/* Attachment info */}
            {hasPdfAttachment && (
              <div className="flex items-center gap-2 p-2.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-[11px] font-semibold">
                <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Os dados do contrato e a ficha cadastral (PDF) serão incluídos e anexados automaticamente no e-mail.</span>
              </div>
            )}

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isSending}
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer border border-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando E-mail...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar E-mail</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
