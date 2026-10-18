import React, { useEffect } from "react";
import { Camera, Mic, Plus, X } from "lucide-react";

interface AddReceiptSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Photo, import de fichier ou PDF (fenêtre de scan existante) */
  onScan: () => void;
  /** Enregistrer un reçu à la voix */
  onVoice: () => void;
  /** Saisir un reçu à la main */
  onManual: () => void;
}

/**
 * Feuille de choix affichée par le bouton central de la barre du bas :
 * scanner un reçu, le dicter, ou le saisir manuellement.
 */
export const AddReceiptSheet: React.FC<AddReceiptSheetProps> = ({
  isOpen,
  onClose,
  onScan,
  onVoice,
  onManual,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const choose = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ajouter un justificatif"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl mx-auto bg-brand-deep border-t border-brand-snow/20 px-4 pt-5 space-y-3"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center justify-between pb-1">
          <div className="k text-brand-muted">Ajouter un justificatif</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="min-h-11 min-w-11 flex items-center justify-center cursor-pointer text-brand-muted"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <button type="button" onClick={choose(onScan)} className="btn w-full">
          <Camera className="w-5 h-5" aria-hidden="true" />
          Scanner un reçu
        </button>
        <button type="button" onClick={choose(onVoice)} className="btn ghost w-full">
          <Mic className="w-5 h-5" aria-hidden="true" />
          Dictée vocale
        </button>
        <button type="button" onClick={choose(onManual)} className="btn ghost w-full">
          <Plus className="w-5 h-5" aria-hidden="true" />
          Saisie manuelle
        </button>
      </div>
    </div>
  );
};
