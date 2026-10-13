import React, { useState, useEffect, useRef } from "react";
import { X, Mic, MicOff, Loader2, Sparkles, AlertCircle, Save } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getApiUrl } from "../utils/api";

interface VoiceReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

export const VoiceReceiptModal: React.FC<VoiceReceiptModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = "fr-FR";

        recognitionRef.current.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          if (event.error === "not-allowed") {
            setError("L'accès au micro a été refusé. Veuillez vérifier vos permissions.");
          } else {
            setError("Une erreur est survenue lors de la capture vocale.");
          }
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setError(null);
      setTranscript("");
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start recognition:", err);
        setError("Impossible de démarrer la capture vocale.");
      }
    }
  };

  const handleProcess = async () => {
    if (!transcript.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      const targetUrl = getApiUrl("/api/voice-receipt");
      console.log(`Appel analyse vocale sur: ${targetUrl}`);
      const response = await fetch(targetUrl, {
        method: "POST",
        mode: "cors",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ transcript }),
      });

      const textResponse = await response.text();
      
      if (!textResponse) {
        throw new Error("Le serveur a renvoyé une réponse vide.");
      }

      if (!response.ok) {
        console.error("Voice API error response:", response.status, textResponse);
        try {
          const errorData = JSON.parse(textResponse);
          throw new Error(errorData.error || `Erreur serveur: ${response.status}`);
        } catch (e) {
          throw new Error(`Erreur serveur (${response.status})`);
        }
      }

      const result = JSON.parse(textResponse);

      if (result.success) {
        await onSave(result.data);
        onClose();
      } else {
        throw new Error(result.error || "Échec du traitement vocal");
      }
    } catch (err: any) {
      console.error("ERREUR FETCH (voice):", err);
      setError(err.message || "Une erreur est survenue lors de l'analyse IA.");
    } finally {
      setIsProcessing(false);
    }
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
            className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Mic className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-neutral-100 tracking-tight">Saisie Vocale</h2>
                    <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">IA Transcription</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Dictation Area */}
              <div className="relative min-h-[160px] bg-neutral-950 border border-neutral-800 rounded-3xl p-6 flex flex-col justify-center items-center text-center group">
                {isListening && (
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-tighter">En direct</span>
                  </div>
                )}

                {!transcript && !isListening && (
                  <p className="text-neutral-500 text-sm italic">
                    "Hier j'ai mangé chez Paul pour 15€50 par carte bancaire..."
                  </p>
                )}

                <div className="text-lg font-medium text-neutral-100 leading-relaxed max-w-md">
                  {transcript || (isListening ? "Je vous écoute..." : "Appuyez sur le micro pour commencer à dicter votre dépense")}
                </div>

                {isListening && (
                  <div className="mt-8 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ height: [8, 24, 8] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.6,
                          delay: i * 0.1,
                        }}
                        className="w-1 bg-emerald-500 rounded-full"
                      />
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={toggleListening}
                  disabled={isProcessing}
                  className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all active:scale-[0.98] ${
                    isListening
                      ? "bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20"
                      : "bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-lg shadow-emerald-500/20"
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-5 h-5" />
                      <span>Arrêter l'écoute</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5" />
                      <span>Commencer à parler</span>
                    </>
                  )}
                </button>

                {transcript && !isListening && (
                  <button
                    onClick={handleProcess}
                    disabled={isProcessing}
                    className="flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-neutral-100 hover:bg-white text-neutral-950 font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Analyse IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 text-emerald-600" />
                        <span>Générer le justificatif</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
