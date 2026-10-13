import React, { useState, useEffect } from "react";
import { X, Mail, Copy, Check, Info, ShieldCheck, Percent, Save, Send, MessageCircle, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile } from "../types";

import { getApiUrl } from "../utils/api";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail?: string | null;
  profile: UserProfile | null;
  onSaveProfile: (profile: UserProfile) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  userId,
  userEmail,
  profile,
  onSaveProfile,
}) => {
  const [copied, setCopied] = useState(false);
  const [taxRate, setTaxRate] = useState(22);
  const [isSaving, setIsSaving] = useState(false);
  const [telegramToken, setTelegramToken] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [isSettingUpWebhook, setIsSettingUpWebhook] = useState(false);
  const [setupStatus, setSetupStatus] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setTaxRate(profile.estimatedTaxRate);
    }
  }, [profile]);

  const handleSetupWebhook = async () => {
    setIsSettingUpWebhook(true);
    setSetupStatus(null);
    const targetUrl = getApiUrl("/api/telegram/setup");
    console.log(`Tentative d'activation du bot admin sur: ${targetUrl}`);
    try {
      const res = await fetch(targetUrl, {
        method: "POST",
        mode: "cors",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Setup webhook error response:", res.status, errorData);
        throw new Error(errorData.error || `Erreur serveur: ${res.status}`);
      }
      
      const data = await res.json();
      if (data.success) {
        console.log("Bot activé avec succès:", data);
        setSetupStatus({ success: true, message: "Bot activé avec succès !" });
      } else {
        console.error("Échec activation bot:", data);
        setSetupStatus({ success: false, message: data.error || "Erreur d'activation" });
      }
    } catch (err: any) {
      console.error("ERREUR FETCH (setup bot):", {
        message: err.message,
        url: targetUrl,
        error: err
      });
      setSetupStatus({ success: false, message: err.message || "Erreur réseau" });
    } finally {
      setIsSettingUpWebhook(false);
      setTimeout(() => setSetupStatus(null), 5000);
    }
  };

  // Format the unique identification code
  const shortId = userId.substring(0, 8).toUpperCase();
  const comptaCode = `COMPTA-${shortId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(comptaCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveTaxRate = async () => {
    setIsSaving(true);
    try {
      await onSaveProfile({
        uid: userId,
        email: userEmail || "",
        estimatedTaxRate: taxRate,
        nextInvoiceNumber: profile?.nextInvoiceNumber || 1,
        telegramId: profile?.telegramId,
        telegramToken: profile?.telegramToken,
        createdAt: profile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLinkTelegram = async () => {
    setIsGeneratingToken(true);
    const targetUrl = getApiUrl("/api/telegram-link");
    console.log(`Génération du code de liaison Telegram sur: ${targetUrl}`);
    try {
      const res = await fetch(targetUrl, {
        method: "POST",
        mode: "cors",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ userId })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Link Telegram error response:", res.status, errorData);
        throw new Error(errorData.error || `Erreur: ${res.status}`);
      }
      
      const data = await res.json();
      if (data.success) {
        console.log("Code de liaison généré:", data.token);
        setTelegramToken(data.token);
      } else {
        console.error("Échec génération code:", data);
        alert(`Erreur lors de la génération du code: ${data.error || "Inconnue"}`);
      }
    } catch (err: any) {
      console.error("ERREUR FETCH (link telegram):", {
        message: err.message,
        url: targetUrl,
        error: err
      });
      alert(`Erreur réseau: ${err.message || "Impossible de contacter le serveur"}`);
    } finally {
      setIsGeneratingToken(false);
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
            className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Gradient Header */}
            <div className="h-24 bg-gradient-to-br from-emerald-500/20 via-neutral-900 to-neutral-900 border-b border-neutral-800 relative shrink-0">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-neutral-950/50 hover:bg-neutral-800 text-neutral-400 transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="absolute -bottom-10 left-8">
                <div className="w-20 h-20 rounded-2xl bg-neutral-900 border-4 border-neutral-950 flex items-center justify-center shadow-xl">
                  <div className="w-full h-full rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="w-10 h-10" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pt-14 pb-8 px-8 space-y-8">
              <div>
                <h2 className="text-2xl font-black text-neutral-100 tracking-tight">Configuration Profile</h2>
                <p className="text-sm text-neutral-400 mt-1">Personnalisez votre expérience ComptaSnap.</p>
              </div>

              {/* Tax Rate Settings Section */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-200">Fiscalité & Trésorerie</h3>
                    <p className="text-[10px] text-neutral-500 mt-0.5 uppercase tracking-wide font-bold">Taux de charges estimées</p>
                  </div>
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
                    />
                  </div>
                  <button
                    onClick={handleSaveTaxRate}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 rounded-xl transition-all font-black text-xs uppercase tracking-widest"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? "..." : "Enregistrer"}</span>
                  </button>
                </div>
                <p className="text-[10px] text-neutral-500 italic">Utilisé pour calculer votre revenu net réel et votre épargne de sécurité.</p>
              </div>

              {/* Telegram Bot Section */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                      <Send className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-neutral-200">Bot Telegram Intelligent</h3>
                      <p className="text-[10px] text-neutral-500 mt-0.5 uppercase tracking-wide font-bold">Envoi direct de justificatifs</p>
                    </div>
                  </div>
                  {profile?.telegramId ? (
                    <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 uppercase tracking-tighter">
                      Connecté
                    </div>
                  ) : (
                    <div className="px-3 py-1 rounded-full bg-neutral-800 text-neutral-400 text-[10px] font-bold border border-neutral-700 uppercase tracking-tighter">
                      Déconnecté
                    </div>
                  )}
                </div>

                {!profile?.telegramId ? (
                  <div className="space-y-4">
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Envoyez vos reçus (photo, texte ou vocal) directement à notre bot Telegram pour un enregistrement instantané.
                    </p>
                    {!telegramToken ? (
                      <button
                        onClick={handleLinkTelegram}
                        disabled={isGeneratingToken}
                        className="w-full py-3 bg-neutral-900 border border-neutral-800 hover:border-blue-500/50 text-blue-400 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                      >
                        <MessageCircle className="w-4 h-4" />
                        {isGeneratingToken ? "Génération..." : "Lier mon compte Telegram"}
                      </button>
                    ) : (
                      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-3">
                        <p className="text-[11px] text-blue-200 font-medium text-center">
                          Cliquez sur le bouton ci-dessous puis envoyez "Démarrer" ou le code suivant au bot :
                        </p>
                        <div className="bg-neutral-900 rounded-lg py-2 px-4 text-center font-mono text-blue-400 font-bold tracking-widest border border-blue-500/10">
                          {telegramToken}
                        </div>
                        <a
                          href={`https://t.me/ComptaSnapBot?start=${telegramToken}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-3 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                        >
                          Ouvrir Telegram <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                    <p className="text-xs text-neutral-400">
                      Votre compte est lié ! Vous pouvez envoyer vos justificatifs au bot <span className="text-emerald-400 font-bold">@ComptaSnapBot</span>.
                    </p>
                  </div>
                )}

                <div className="pt-2 border-t border-neutral-800/50">
                  <button
                    onClick={handleSetupWebhook}
                    disabled={isSettingUpWebhook}
                    className="w-full py-2 bg-neutral-900 border border-neutral-800 hover:border-emerald-500/30 text-emerald-500/80 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {isSettingUpWebhook ? "Configuration..." : "Activer le Bot Telegram (Admin)"}
                  </button>
                  {setupStatus && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`text-[10px] text-center mt-2 font-bold ${
                        setupStatus.success ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {setupStatus.message}
                    </motion.p>
                  )}
                </div>
              </div>

              {/* Email Import Section */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-neutral-200">Import par E-mail</h3>
                      <p className="text-[10px] text-neutral-500 mt-0.5 uppercase tracking-wide font-bold">Transfert automatique</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 font-mono text-lg font-black text-emerald-400 tracking-wider">
                      {comptaCode}
                    </div>
                    <button
                      onClick={handleCopy}
                      className={`p-3.5 rounded-xl transition-all active:scale-95 ${
                        copied 
                          ? "bg-emerald-500 text-neutral-950" 
                          : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                      }`}
                    >
                      {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                    <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-200/70 leading-relaxed italic">
                      Transférez vos factures vers <span className="font-bold">inbound@comptasnap.app</span> avec votre code <span className="font-bold text-amber-400">{comptaCode}</span> dans l'objet.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <p className="text-center text-[10px] text-neutral-600 font-medium">
                ComptaSnap version 2.4.0 • Propulsé par Groq IA
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
