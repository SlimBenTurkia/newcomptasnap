import React, { useState, useMemo } from "react";
import { ReceiptItem, ReceiptCategory } from "../types";
import { ReceiptCard } from "./ReceiptCard";
import { formatEuro } from "../utils/formatters";
import { hasJustificatif } from "../utils/receiptStats";
import { Plus, FileSpreadsheet, Mic, Camera, UploadCloud } from "lucide-react";

interface ReceiptListProps {
  receipts: ReceiptItem[];
  onSelectReceipt: (receipt: ReceiptItem) => void;
  onToggleStatus: (id: string, e: React.MouseEvent) => void;
  onDeleteReceipt?: (id: string) => void;
  statusFilter: "all" | "validé" | "en_attente" | "sans_justif";
  onStatusFilterChange: (status: "all" | "validé" | "en_attente" | "sans_justif") => void;
  onOpenScan: () => void;
  onOpenManual?: () => void;
  onOpenVoice?: () => void;
  onImportFile?: (file: File) => void;
  totalAllMonthsCount?: number;
  onShowAllMonths?: () => void;
  /** Encart affiché sous les boutons d'ajout (ex. Google Drive non connecté) */
  topNotice?: React.ReactNode;
  /** Ligne affichée sous la liste */
  footer?: React.ReactNode;
}

export const ReceiptList: React.FC<ReceiptListProps> = ({
  receipts,
  onSelectReceipt,
  onToggleStatus,
  onDeleteReceipt,
  statusFilter,
  onStatusFilterChange,
  onOpenScan,
  onOpenManual,
  onOpenVoice,
  onImportFile,
  totalAllMonthsCount = 0,
  onShowAllMonths,
  topNotice,
  footer,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">(
    "date_desc"
  );

  const categories: ReceiptCategory[] = [
    "Matériel",
    "Transport",
    "Restaurant",
    "Logiciel",
    "Télécom",
    "Fournitures",
    "Autre",
  ];

  // Filtering & Sorting
  const filteredReceipts = useMemo(() => {
    return receipts
      .filter((r) => {
        // Status filter
        if (statusFilter === "sans_justif") {
          if (hasJustificatif(r)) return false;
        } else if (statusFilter !== "all" && r.status !== statusFilter) return false;
        // Category filter
        if (selectedCategory !== "all" && r.category !== selectedCategory) return false;
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchSupplier = r.supplier.toLowerCase().includes(q);
          const matchNotes = (r.notes || "").toLowerCase().includes(q);
          const matchInvoice = (r.invoiceNumber || "").toLowerCase().includes(q);
          const matchFilename = r.standardizedName.toLowerCase().includes(q);
          if (!matchSupplier && !matchNotes && !matchInvoice && !matchFilename) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "date_desc") return b.date.localeCompare(a.date);
        if (sortBy === "date_asc") return a.date.localeCompare(b.date);
        if (sortBy === "amount_desc") return b.totalTTC - a.totalTTC;
        if (sortBy === "amount_asc") return a.totalTTC - b.totalTTC;
        return 0;
      });
  }, [receipts, statusFilter, selectedCategory, searchQuery, sortBy]);

  const filteredTotal = filteredReceipts.reduce((sum, r) => sum + r.totalTTC, 0);

  return (
    <div className="w-full space-y-6">
      {/* Ajout d'un reçu : même bouton principal que « Nouvelle facture » + méthodes alternatives */}
      <section aria-label="Ajouter un justificatif" className="space-y-2">
        <button onClick={onOpenScan} className="btn w-full">
          <Camera className="w-5 h-5" aria-hidden="true" />
          Scanner un reçu
        </button>
        <div className="grid grid-cols-3 gap-2 [&>*]:min-w-0">
          <button onClick={onOpenVoice} className="btn ghost !h-12 !px-2 !text-[14px]">
            <Mic className="w-4 h-4" aria-hidden="true" />
            Dictée
          </button>
          <button onClick={onOpenManual} className="btn ghost !h-12 !px-2 !text-[14px]">
            <Plus className="w-4 h-4" aria-hidden="true" />
            Saisie
          </button>
          <label className="btn ghost !h-12 !px-2 !text-[14px] focus-within:outline focus-within:outline-2 focus-within:outline-brand-vibrant">
            <input
              type="file"
              className="sr-only"
              accept="image/*,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && (file.type.startsWith("image/") || file.type === "application/pdf")) {
                  onImportFile?.(file);
                }
                e.target.value = "";
              }}
            />
            <UploadCloud className="w-4 h-4" aria-hidden="true" />
            Import
          </label>
        </div>
      </section>

      {topNotice}

      {/* Liste — même design « ticket » que les factures */}
      <div>
        {/* Statut : onglets identiques à ceux des factures */}
        <div className="k flex gap-5 pb-4 overflow-x-auto no-scrollbar" role="tablist" aria-label="Filtrer les reçus">
          {([
            { id: "all", label: "Tous" },
            { id: "en_attente", label: "À valider" },
            { id: "validé", label: "Validés" },
            { id: "sans_justif", label: "Sans justif." },
          ] as const).map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={statusFilter === t.id}
              onClick={() => onStatusFilterChange(t.id)}
              className={`pb-1 border-b-2 min-h-8 cursor-pointer ${
                statusFilter === t.id
                  ? t.id === "en_attente"
                    ? "text-[#FF1F3D] border-[#FF1F3D]"
                    : t.id === "sans_justif"
                      ? "text-[#C73A10] border-[#C73A10]"
                      : "text-brand-vibrant border-brand-vibrant"
                  : t.id === "en_attente"
                    ? "text-[#FF1F3D]/70 border-transparent"
                    : "text-brand-muted border-transparent"
              } whitespace-nowrap`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Recherche */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un reçu..."
          aria-label="Rechercher un reçu"
          className="w-full h-12 mb-5 bg-transparent border-0 border-b-2 border-brand-snow/40 rounded-none text-brand-snow placeholder:text-brand-muted font-mono text-base focus:outline-none focus:border-brand-vibrant"
        />

        {filteredReceipts.length > 0 && (
          <div className="k text-brand-muted pb-3">
            {filteredReceipts.length} reçu{filteredReceipts.length > 1 ? "s" : ""} · {formatEuro(filteredTotal)}
          </div>
        )}

        {filteredReceipts.length === 0 ? (
          <div className="border border-dashed border-brand-snow/20 px-6 py-14 text-center">
            <FileSpreadsheet className="w-8 h-8 mx-auto mb-4 text-brand-muted" aria-hidden="true" />
            <h3 className="text-lg font-extrabold">
              {totalAllMonthsCount === 0 ? "Aucun reçu enregistré" : "Aucun reçu dans ce filtre"}
            </h3>
            <p className="text-sm text-brand-muted mt-2 max-w-xs mx-auto">
              {totalAllMonthsCount === 0
                ? "Scannez votre premier justificatif : il apparaîtra ici avec son statut."
                : "Changez de filtre ou de période pour voir les autres reçus."}
            </p>
            {totalAllMonthsCount > 0 && onShowAllMonths ? (
              <button onClick={onShowAllMonths} className="k mt-6 underline cursor-pointer text-brand-vibrant">
                Voir tous les mois
              </button>
            ) : (
              <button onClick={onOpenScan} className="k mt-6 underline cursor-pointer text-brand-vibrant">
                Scanner un reçu
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredReceipts.map((receipt) => (
              <div key={receipt.id} className="ticket !pb-2">
                <ReceiptCard
                  receipt={receipt}
                  isLast
                  onClick={() => onSelectReceipt(receipt)}
                  onToggleStatus={(e) => {
                    e.stopPropagation();
                    onToggleStatus(receipt.id, e);
                  }}
                  onDelete={onDeleteReceipt ? () => onDeleteReceipt(receipt.id) : undefined}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {footer}
    </div>
  );
};
