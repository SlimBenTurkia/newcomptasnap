import React, { useState, useMemo } from "react";
import { ReceiptItem, ReceiptCategory } from "../types";
import { ReceiptCard } from "./ReceiptCard";
import { formatEuro } from "../utils/formatters";
import { Search, Filter, Plus, FileX, ArrowUpDown, FileSpreadsheet, Mic, Camera, UploadCloud } from "lucide-react";

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

      {/* Main List Section */}
      <div className="space-y-6">
        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-dim group-focus-within:text-brand-vibrant transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une dépense..."
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-brand-glass border border-brand-snow/10 text-brand-snow placeholder-brand-snow/20 focus:outline-none focus:border-brand-vibrant/50 focus:ring-4 focus:ring-brand-vibrant/5 transition-all text-sm font-medium"
            />
          </div>

          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-brand-glass border border-brand-snow/10 w-full md:w-auto">
            {(["all", "validé", "en_attente"] as const).map((status) => (
              <button
                key={status}
                onClick={() => onStatusFilterChange(status)}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === status
                    ? status === "en_attente" 
                      ? "bg-amber-500 text-brand-deep shadow-lg shadow-amber-500/20"
                      : "bg-brand-vibrant text-brand-deep shadow-lg shadow-brand-vibrant/20"
                    : "text-brand-muted hover:text-brand-snow hover:bg-brand-snow/5"
                }`}
              >
                {status === "all" ? "Tous" : status === "validé" ? "Validés" : "À Valider"}
              </button>
            ))}
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap cursor-pointer ${
              selectedCategory === "all"
                ? "bg-brand-teal/20 text-brand-teal border-brand-teal/40"
                : "bg-brand-snow/5 text-brand-muted border-brand-snow/10 hover:border-brand-teal/30 hover:text-brand-teal"
            }`}
          >
            Tous les types
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? "bg-brand-teal/20 text-brand-teal border-brand-teal/40"
                  : "bg-brand-snow/5 text-brand-snow/40 border-brand-snow/10 hover:border-brand-teal/30 hover:text-brand-teal"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Receipts Content */}
        {filteredReceipts.length === 0 ? (
          <div className="bg-brand-snow/[0.02] border border-dashed border-brand-snow/10 rounded-[3rem] p-16 text-center">
            <div className="w-24 h-24 rounded-full bg-brand-snow/5 flex items-center justify-center mx-auto mb-8 text-brand-snow/10">
              <FileSpreadsheet className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-black text-brand-snow mb-3 tracking-tight">Aucune dépense trouvée</h4>
            <p className="text-sm text-brand-muted max-w-xs mx-auto mb-10 leading-relaxed font-medium">
              Ajustez vos filtres ou commencez à capturer vos nouveaux justificatifs dès maintenant.
            </p>
            <button
              onClick={onOpenScan}
              className="px-10 py-4 rounded-2xl bg-brand-vibrant text-brand-deep font-black text-[11px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-brand-vibrant/20 cursor-pointer"
            >
              Scanner un premier reçu
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredReceipts.map((receipt) => (
              <ReceiptCard
                key={receipt.id}
                receipt={receipt}
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
