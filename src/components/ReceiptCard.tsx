import React from "react";
import { ReceiptItem, ReceiptCategory } from "../types";
import { formatEuro } from "../utils/formatters";
import { getTaxDeductibilityBadge } from "../utils/expenseCategories";
import {
  CheckCircle2,
  Laptop,
  Train,
  Utensils,
  Code2,
  Phone,
  FileBox,
  HelpCircle,
  Trash2,
  Hotel,
  Briefcase,
  Megaphone,
  CreditCard,
  GraduationCap,
} from "lucide-react";

interface ReceiptCardProps {
  receipt: ReceiptItem;
  onClick: () => void;
  onToggleStatus: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  /** Dernière ligne de la liste : pas de séparateur en pointillés */
  isLast?: boolean;
}

export const getCategoryIcon = (category: ReceiptCategory) => {
  switch (category) {
    case "Restaurant":
      return <Utensils className="w-4 h-4 text-brand-vibrant" />;
    case "Transport":
      return <Train className="w-4 h-4 text-brand-teal" />;
    case "Hébergement":
      return <Hotel className="w-4 h-4 text-brand-teal" />;
    case "Logiciel":
      return <Code2 className="w-4 h-4 text-brand-vibrant" />;
    case "Matériel":
      return <Laptop className="w-4 h-4 text-brand-teal" />;
    case "Télécom":
      return <Phone className="w-4 h-4 text-brand-teal" />;
    case "Fournitures":
      return <FileBox className="w-4 h-4 text-brand-vibrant" />;
    case "Honoraires":
      return <Briefcase className="w-4 h-4 text-brand-teal" />;
    case "Marketing":
      return <Megaphone className="w-4 h-4 text-brand-vibrant" />;
    case "Frais bancaires":
      return <CreditCard className="w-4 h-4 text-brand-teal" />;
    case "Formation":
      return <GraduationCap className="w-4 h-4 text-brand-vibrant" />;
    case "Autre":
    default:
      return <HelpCircle className="w-4 h-4 text-brand-muted" />;
  }
};

const shortDate = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return iso;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};

/**
 * Ligne de reçu au même format « ticket de caisse » que la liste des factures
 * (libellé mono, tampon de statut, ligne à points de conduite, gros montant).
 * À placer dans un conteneur <div className="ticket">.
 */
export const ReceiptCard: React.FC<ReceiptCardProps> = ({
  receipt,
  onClick,
  onToggleStatus,
  onDelete,
  isLast = false,
}) => {
  const isValidated = receipt.status === "validé";
  const hasJustificatif = !!(receipt.fileDataUrl || receipt.driveFileId);
  const deductBadge = receipt.taxDeductibility ? getTaxDeductibilityBadge(receipt.taxDeductibility) : null;
  const label = receipt.expenseType || receipt.category;

  return (
    <div
      onClick={onClick}
      className={`py-3.5 cursor-pointer ${!isLast ? "border-b-2 border-dashed border-[var(--ink)]/35" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="k font-bold text-left cursor-pointer truncate min-w-0"
          style={{ color: "var(--ink)" }}
        >
          {label}
        </button>
        {isValidated ? <span className="stamp ok">Validé</span> : <span className="k">à valider</span>}
      </div>

      <div className="leader">
        <span className="truncate">{receipt.supplier}</span>
        <i />
        <span>{shortDate(receipt.date)}</span>
      </div>

      <div className="k flex flex-wrap items-center gap-x-3">
        <span>TVA {receipt.vatRate}%</span>
        {deductBadge && <span>{deductBadge.label}</span>}
        {!hasJustificatif && <span style={{ color: "#C73A10" }}>justificatif manquant</span>}
      </div>

      <div className="flex items-end justify-between mt-1">
        <div className="text-[34px] font-extrabold tracking-[-0.03em] leading-none">
          {formatEuro(receipt.totalTTC)}
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onToggleStatus}
            className="p-2.5 cursor-pointer text-[var(--paper-muted)] hover:text-[#1E7A4F]"
            title={isValidated ? "Marquer en attente" : "Valider le reçu"}
            aria-label={isValidated ? "Marquer le reçu en attente" : "Valider le reçu"}
          >
            <CheckCircle2 className="w-5 h-5" />
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Supprimer le reçu ${receipt.supplier} ?`)) onDelete(e);
              }}
              className="p-2.5 cursor-pointer text-[var(--paper-muted)] hover:text-[#C73A10]"
              title="Supprimer"
              aria-label={`Supprimer le reçu ${receipt.supplier}`}
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
