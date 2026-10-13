import React, { useState } from "react";
import { ReceiptItem, ReceiptCategory } from "../types";
import {
  formatEuro,
  formatDateFrench,
  formatReceiptAmountDisplay,
} from "../utils/formatters";
import { getCategoryMetadata, getTaxDeductibilityBadge } from "../utils/expenseCategories";
import {
  CheckCircle2,
  Clock,
  Laptop,
  Train,
  Utensils,
  Code2,
  Phone,
  FileBox,
  HelpCircle,
  Sparkles,
  Trash2,
  Check,
  X,
  Globe,
  Hotel,
  Briefcase,
  Megaphone,
  CreditCard,
  GraduationCap,
  Mail,
  FileX,
  AlertCircle,
} from "lucide-react";

interface ReceiptCardProps {
  receipt: ReceiptItem;
  onClick: () => void;
  onToggleStatus: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
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

export const ReceiptCard: React.FC<ReceiptCardProps> = ({
  receipt,
  onClick,
  onToggleStatus,
  onDelete,
}) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const isValidated = receipt.status === "validé";
  const isEmailSource = receipt.source === "email";
  const hasJustificatif = !!(receipt.fileDataUrl || receipt.driveFileId);
  const catMeta = getCategoryMetadata(receipt.category);
  const deductBadge = receipt.taxDeductibility ? getTaxDeductibilityBadge(receipt.taxDeductibility) : null;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfirmingDelete(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(e);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfirmingDelete(false);
  };

  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center justify-between gap-3 p-4 sm:p-5 transition-colors cursor-pointer bg-brand-glass border border-brand-snow/10 border-l-4 hover:border-brand-snow/30 ${
        isValidated ? "border-l-brand-vibrant" : "border-l-amber-400"
      }`}
    >
      {/* Left: Thumbnail & Supplier Info */}
      <div className="flex items-center gap-4 min-w-0">
        {/* Document Thumbnail / Icon */}
        <div className={`relative w-14 h-14 rounded-2xl bg-brand-deep/60 border flex items-center justify-center shrink-0 transition-all duration-300 overflow-hidden shadow-inner ${
          isValidated ? "border-brand-vibrant/20 group-hover:border-brand-vibrant/50" : "border-amber-500/20 group-hover:border-amber-500/50"
        }`}>
          {receipt.fileDataUrl ? (
            <img
              src={receipt.fileDataUrl}
              alt={receipt.supplier}
              className="w-full h-full object-cover rounded-2xl group-hover:scale-110 transition-transform duration-500 opacity-80 group-hover:opacity-100"
            />
          ) : (
            <div className="opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300">
              {getCategoryIcon(receipt.category)}
            </div>
          )}
          {receipt.aiExtracted && (
            <div
              title="Classifié et extrait par IA"
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-vibrant border border-brand-deep text-brand-deep flex items-center justify-center shadow-lg"
            >
              <Sparkles className="w-3 h-3" />
            </div>
          )}
        </div>

        {/* Text Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-black text-brand-snow text-base sm:text-lg truncate group-hover:text-brand-vibrant transition-colors tracking-tight">
              {receipt.supplier}
            </h4>

            {!hasJustificatif && (
              <span 
                title="Justificatif manquant"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20"
              >
                <FileX className="w-3 h-3" />
                <span>Manquant</span>
              </span>
            )}

            {isEmailSource && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-brand-teal/10 text-brand-teal border border-brand-teal/20">
                <Mail className="w-3 h-3" />
                <span>Email</span>
              </span>
            )}
          </div>

          {/* Subline: Granular Expense Type + Date + Deductibility */}
          <div className="flex items-center gap-2 text-[11px] text-brand-muted font-bold uppercase tracking-wider flex-wrap">
            <span className="text-brand-teal/80">
              {receipt.expenseType || receipt.category}
            </span>

            <span className="opacity-30">•</span>
            <span>{formatDateFrench(receipt.date)}</span>

            {deductBadge && (
              <>
                <span className="hidden md:inline opacity-30">•</span>
                <span
                  title={deductBadge.description}
                  className="hidden md:inline-block text-brand-vibrant/60"
                >
                  {deductBadge.label}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Amount, Status Badge & Quick Actions */}
      <div className="flex items-center gap-3 sm:gap-5 shrink-0">
        <div className="text-right">
          <div className="font-black text-brand-snow text-lg sm:text-xl tracking-tighter">
            {formatEuro(receipt.totalTTC)}
          </div>
          <div className="font-bold text-[10px] text-brand-muted uppercase tracking-widest">
            TVA {receipt.vatRate}%
          </div>
        </div>

        {/* Status Badge (clickable to toggle) */}
        <button
          onClick={onToggleStatus}
          title={isValidated ? "Marquer en attente" : "Valider le reçu"}
          className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-all cursor-pointer border ${
            isValidated
              ? "bg-brand-vibrant/10 text-brand-vibrant border-brand-vibrant/30 hover:bg-brand-vibrant/20 shadow-[0_0_15px_rgba(2,223,130,0.1)]"
              : "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
          }`}
        >
          {isValidated ? (
            <CheckCircle2 className="w-6 h-6" />
          ) : (
            <Clock className="w-6 h-6 animate-pulse" />
          )}
        </button>

        {/* Inline Quick Delete Button or Confirmation */}
        {onDelete && (
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            {!isConfirmingDelete ? (
              <button
                type="button"
                onClick={handleDeleteClick}
                className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-glass text-brand-dim hover:text-rose-400 hover:bg-rose-500/10 border border-brand-snow/10 hover:border-rose-500/20 transition-all cursor-pointer opacity-60 group-hover:opacity-100"
                title="Supprimer ce reçu"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="w-10 h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/20 active:scale-90 transition-all cursor-pointer"
                  title="Confirmer la suppression"
                >
                  <Check className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  className="w-10 h-10 rounded-xl bg-brand-snow/10 text-brand-snow flex items-center justify-center hover:bg-brand-snow/20 transition-all cursor-pointer"
                  title="Annuler"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

