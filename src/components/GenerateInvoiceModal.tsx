import React, { useState, useRef, useEffect } from "react";
import { X, Sparkles, Mic, Send, FileText, Calendar, User, Euro, Save, Trash2, Plus, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { IssuedInvoice } from "../types";
import { getApiUrl } from "../utils/api";

interface GenerateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (invoice: IssuedInvoice) => void;
  nextInvoiceNumber: number;
}

export const GenerateInvoiceModal: React.FC<GenerateInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  nextInvoiceNumber,
}) => {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState<IssuedInvoice | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [copied, setCopied] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "fr-FR";

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setPrompt(prev => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    const targetUrl = getApiUrl("/api/generate-invoice");
    console.log(`Génération de facture sur: ${targetUrl}`);
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        mode: "cors",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ prompt, nextNumber: nextInvoiceNumber }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Invoice generation error response:", response.status, errorData);
        throw new Error(errorData.error || `Erreur serveur: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        const invoiceData = result.data;
        const now = new Date().toISOString();
        setGeneratedInvoice({
          ...invoiceData,
          id: `inv_${Date.now()}`,
          status: "en_attente",
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (error: any) {
      console.error("ERREUR FETCH (generate-invoice):", error);
      alert(`Erreur lors de la génération de la facture: ${error.message || "Impossible de contacter le serveur"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (generatedInvoice) {
      onSave(generatedInvoice);
      setGeneratedInvoice(null);
      setPrompt("");
      onClose();
    }
  };

  const copyToClipboard = () => {
    if (!generatedInvoice) return;
    const text = `FACTURE ${generatedInvoice.invoiceNumber}\nClient: ${generatedInvoice.clientName}\nDate: ${generatedInvoice.date}\nTotal TTC: ${generatedInvoice.totalTTC}€\n\nArticles:\n${generatedInvoice.items.map(i => `- ${i.description}: ${i.amount}€`).join("\n")}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-neutral-950/90 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-900/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-neutral-100 tracking-tight">Générateur de Facture IA</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">Dictez ou écrivez votre prestation pour créer une facture.</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-3 rounded-full hover:bg-neutral-800 text-neutral-400 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Input Section */}
              <div className="space-y-4">
                <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest ml-1">
                  Description de la prestation
                </label>
                <div className="relative group">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ex: Prestation de développement web pour le client 'TechCorp' à 1200€ HT, livraison fin de mois..."
                    className="w-full h-32 bg-neutral-950 border border-neutral-800 rounded-3xl p-5 text-neutral-100 placeholder:text-neutral-700 focus:outline-none focus:border-emerald-500/50 transition-all resize-none text-sm leading-relaxed"
                  />
                  <div className="absolute bottom-4 right-4 flex items-center gap-2">
                    <button
                      onClick={toggleListening}
                      className={`p-3 rounded-2xl transition-all active:scale-95 ${
                        isListening 
                          ? "bg-red-500 text-white animate-pulse" 
                          : "bg-neutral-800 text-neutral-400 hover:text-emerald-400"
                      }`}
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating || !prompt.trim()}
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 text-neutral-950 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                    >
                      {isGenerating ? "..." : <><Send className="w-4 h-4" /> Générer</>}
                    </button>
                  </div>
                </div>
              </div>

              {/* Result Section */}
              <AnimatePresence>
                {generatedInvoice && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-500" />
                        Aperçu de la Facture
                      </h3>
                      <button 
                        onClick={copyToClipboard}
                        className="text-[10px] font-bold text-neutral-500 hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? "Copié !" : "Copier le texte"}
                      </button>
                    </div>

                    <div className="bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden">
                      {/* Invoice Content */}
                      <div className="p-6 space-y-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">NUMÉRO</div>
                            <div className="text-xl font-black text-neutral-100">{generatedInvoice.invoiceNumber}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">STATUS</div>
                            <div className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-black border border-amber-500/20 uppercase">
                              EN ATTENTE
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <div>
                              <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                                <User className="w-3 h-3" /> CLIENT
                              </label>
                              <input
                                value={generatedInvoice.clientName}
                                onChange={(e) => setGeneratedInvoice({...generatedInvoice, clientName: e.target.value})}
                                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-emerald-500/30"
                              />
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                                <Calendar className="w-3 h-3" /> DATES
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="date"
                                  value={generatedInvoice.date}
                                  onChange={(e) => setGeneratedInvoice({...generatedInvoice, date: e.target.value})}
                                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-2 py-2 text-[10px] text-neutral-100 focus:outline-none"
                                />
                                <input
                                  type="date"
                                  value={generatedInvoice.dueDate}
                                  onChange={(e) => setGeneratedInvoice({...generatedInvoice, dueDate: e.target.value})}
                                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-2 py-2 text-[10px] text-neutral-100 focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Items Table */}
                        <div className="space-y-3">
                          <div className="grid grid-cols-12 gap-2 px-2 text-[9px] font-black text-neutral-600 uppercase tracking-widest">
                            <div className="col-span-6">DESCRIPTION</div>
                            <div className="col-span-2 text-center">QTÉ</div>
                            <div className="col-span-4 text-right">MONTANT</div>
                          </div>
                          <div className="space-y-2">
                            {generatedInvoice.items.map((item, idx) => (
                              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-neutral-900/30 rounded-xl p-2 border border-neutral-800/50">
                                <div className="col-span-6 text-xs text-neutral-200 font-medium truncate">{item.description}</div>
                                <div className="col-span-2 text-center text-xs text-neutral-400">{item.quantity}</div>
                                <div className="col-span-4 text-right text-xs font-bold text-neutral-100">{item.amount.toFixed(2)}€</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Totals */}
                        <div className="pt-4 border-t border-neutral-800 space-y-2">
                          <div className="flex justify-between items-center px-2">
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Total HT</span>
                            <span className="text-sm font-bold text-neutral-300">{generatedInvoice.totalHT.toFixed(2)}€</span>
                          </div>
                          <div className="flex justify-between items-center px-2">
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">TVA ({generatedInvoice.vatRate}%)</span>
                            <span className="text-sm font-bold text-neutral-300">{generatedInvoice.vatAmount.toFixed(2)}€</span>
                          </div>
                          <div className="flex justify-between items-center px-3 py-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                            <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">TOTAL TTC</span>
                            <span className="text-xl font-black text-neutral-100">{generatedInvoice.totalTTC.toFixed(2)}€</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={() => setGeneratedInvoice(null)}
                        className="flex-1 px-6 py-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
                      >
                        Recommencer
                      </button>
                      <button
                        onClick={handleSave}
                        className="flex-1 px-6 py-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        Enregistrer la Facture
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
