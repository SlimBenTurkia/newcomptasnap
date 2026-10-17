import React, { useState, useMemo } from "react";
import { ReceiptItem, ReceiptCategory } from "../types";
import { ReceiptCard } from "./ReceiptCard";
import { formatEuro } from "../utils/formatters";
import { Plus, FileSpreadsheet, Mic, Camera, UploadCloud } from "lucide-react";

interface ReceiptListProps {
  receipts: ReceiptItem[];
  onSelectReceipt: (receipt: ReceiptItem) => void;
  onToggleStatus: (id: string, e: React.MouseEvent) => void;
  onDeleteReceipt?: (id: string) => void;
  statusFilter: "all" | "validé" | "en_attente";
  onStatusFilterChange: (status: "all" | "validé" | "en_attente") => void;
  onOpenScan: () => void;
  onOpenManual?: () => void;
  onOpenVoice?: () => void;
  onImportFile?: (file: File) => void;
  totalAllMonthsCount?: number;
  onShowAllMonths?: () => void;
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
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
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
    <div className="w-full space-y-8 sm:space-y-12">
      {/* Optimized Capture Section */}
      <section aria-label="Ajouter un justificatif" className="grid grid-cols-4 gap-2">
        <button onClick={onOpenScan} className="flex flex-col items-center justify-center gap-2 h-20 bg-brand-vibrant text-brand-deep cursor-pointer font-mono text-xs font-bold uppercase tracking-wider">
          <Camera className="w-5 h-5" aria-hidden="true" />
          Photo
        </button>
        <button onClick={onOpenVoice} className="flex flex-col items-center justify-center gap-2 h-20 border-2 border-brand-snow/80 text-brand-snow cursor-pointer font-mono text-xs font-bold uppercase tracking-wider">
          <Mic className="w-5 h-5" aria-hidden="true" />
          Dictée
        </button>
        <button onClick={onOpenManual} className="flex flex-col items-center justify-center gap-2 h-20 border-2 border-brand-snow/80 text-brand-snow cursor-pointer font-mono text-xs font-bold uppercase tracking-wider">
          <Plus className="w-5 h-5" aria-hidden="true" />
          Saisie
        </button>
        <label className="flex flex-col items-center justify-center gap-2 h-20 border-2 border-brand-snow/80 text-brand-snow cursor-pointer font-mono text-xs font-bold uppercase tracking-wider focus-within:outline focus-within:outline-2 focus-within:outline-brand-vibrant">
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
          <UploadCloud className="w-5 h-5" aria-hidden="true" />
          Import
        </label>
      </section>

      {/* Liste — même design « ticket » que les factures */}
      <div>
        {/* Recherche */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un reçu..."
          aria-label="Rechercher un reçu"
          className="w-full h-12 mb-4 bg-transparent border-0 border-b-2 border-brand-snow/40 rounded-none text-brand-snow placeholder:text-brand-muted font-mono text-base focus:outline-none focus:border-brand-vibrant"
        />

        {/* Statut : onglets identiques à ceux des factures */}
        <div className="k flex gap-5 pb-4" role="tablist" aria-label="Filtrer les reçus">
          {([
            { id: "all", label: "Tous" },
            { id: "en_attente", label: "À valider" },
            { id: "validé", label: "Validés" },
          ] as const).map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={statusFilter === t.id}
              onClick={() => onStatusFilterChange(t.id)}
              className={`pb-1 border-b-2 min-h-8 cursor-pointer ${
                statusFilter === t.id ? "text-brand-vibrant border-brand-vibrant" : "text-brand-muted border-transparent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Catégories : mêmes onglets, défilables */}
        <div className="k flex gap-5 pb-4 overflow-x-auto no-scrollbar" role="tablist" aria-label="Filtrer par catégorie">
          {["all", ...categories].map((cat) => (
            <button
              key={cat}
              role="tab"
              aria-selected={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
              className={`pb-1 border-b-2 min-h-8 whitespace-nowrap cursor-pointer ${
                selectedCategory === cat ? "text-brand-vibrant border-brand-vibrant" : "text-brand-muted border-transparent"
              }`}
            >
              {cat === "all" ? "Tous les types" : cat}
            </button>
          ))}
        </div>

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
          <div className="ticket !pb-2">
            {filteredReceipts.map((receipt, i) => (
              <ReceiptCard
                key={receipt.id}
                receipt={receipt}
                isLast={i === filteredReceipts.length - 1}
                onClick={() => onSelectReceipt(receipt)}
                onToggleStatus={(e) => {
                  e.stopPropagation();
                  onToggleStatus(receipt.id, e);
                }}
                onDelete={onDeleteReceipt ? () => onDeleteReceipt(receipt.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
