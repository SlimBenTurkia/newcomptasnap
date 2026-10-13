import React, { useState } from "react";
import {
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  RotateCw,
  X,
  Globe,
  CheckCircle2,
} from "lucide-react";
import firebaseConfigJson from "../../firebase-applet-config.json";

interface AuthDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  isRetrying?: boolean;
}

export const AuthDomainModal: React.FC<AuthDomainModalProps> = ({
  isOpen,
  onClose,
  onRetry,
  isRetrying = false,
}) => {
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedWildcard, setCopiedWildcard] = useState(false);

  if (!isOpen) return null;

  const currentHost =
    typeof window !== "undefined" ? window.location.hostname : "mon-app.vercel.app";
  const projectId = firebaseConfigJson.projectId || "gen-lang-client-0942048771";
  const firebaseSettingsUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;

  const handleCopy = (text: string, isWildcard = false) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (isWildcard) {
        setCopiedWildcard(true);
        setTimeout(() => setCopiedWildcard(false), 2000);
      } else {
        setCopiedDomain(true);
        setTimeout(() => setCopiedDomain(false), 2000);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-5 text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Title */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-neutral-100">
              Autoriser votre domaine Vercel sur Firebase
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Erreur <code className="text-amber-400 font-mono text-[11px]">auth/unauthorized-domain</code>
            </p>
          </div>
        </div>

        {/* Explanation */}
        <p className="text-xs text-neutral-300 leading-relaxed">
          Google bloque la fenêtre de connexion car votre adresse Vercel n&apos;est pas encore enregistrée dans la liste blanche de sécurité de votre projet Firebase.
        </p>

        {/* Domain to copy Box */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
            Domaine à autoriser
          </label>
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-xs text-emerald-400">
            <div className="flex items-center gap-2 truncate">
              <Globe className="w-4 h-4 text-neutral-500 shrink-0" />
              <span className="truncate">{currentHost}</span>
            </div>
            <button
              onClick={() => handleCopy(currentHost, false)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-sans transition-colors cursor-pointer shrink-0"
            >
              {copiedDomain ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3 Steps Guide */}
        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-4 space-y-3 text-xs">
          <div className="font-semibold text-neutral-200 flex items-center gap-1.5">
            <span>Procédure rapide (30 secondes) :</span>
          </div>

          <ol className="space-y-2.5 text-neutral-300">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                1
              </span>
              <div>
                <span>Ouvrez la console Firebase : </span>
                <a
                  href={firebaseSettingsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline font-medium"
                >
                  Firebase Authentication &gt; Paramètres
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </li>

            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                2
              </span>
              <div>
                Descendez à la section <strong className="text-neutral-100">« Domaines autorisés »</strong> et cliquez sur <strong className="text-neutral-100">« Ajouter un domaine »</strong>.
              </div>
            </li>

            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                3
              </span>
              <div>
                Collez <code className="text-emerald-400 bg-neutral-900 px-1 py-0.5 rounded font-mono">{currentHost}</code> (ou simplement <code className="text-neutral-300 font-mono">vercel.app</code> pour couvrir tous vos aperçus) puis cliquez sur <strong className="text-neutral-100">Enregistrer</strong>.
              </div>
            </li>
          </ol>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2 pt-2">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Continuer en mode local
          </button>

          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`} />
            <span>Réessayer la connexion</span>
          </button>
        </div>
      </div>
    </div>
  );
};
