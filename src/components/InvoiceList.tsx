import React, { useState } from "react";
import { IssuedInvoice } from "../types";
import { formatEuro } from "../utils/formatters";
import { CheckCircle2, FileText, Trash2 } from "lucide-react";

interface InvoiceListProps {
  invoices: IssuedInvoice[];
  onToggleStatus: (id: string, currentStatus: string) => void;
  onDeleteInvoice: (id: string) => void;
  onViewInvoice: (invoice: IssuedInvoice) => void;
}

type Filter = "all" | "due" | "paid";

const todayISO = () => new Date().toISOString().split("T")[0];

const shortDate = (iso: string) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—";

export const InvoiceList: React.FC<InvoiceListProps> = ({
  invoices,
  onToggleStatus,
  onDeleteInvoice,
  onViewInvoice,
}) => {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = invoices.filter((inv) => {
    if (filter === "paid") return inv.status === "payé";
    if (filter === "due") return inv.status === "en_attente";
    return true;
  });

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: "Toutes" },
    { id: "due", label: "À payer" },
    { id: "paid", label: "Payées" },
  ];

  return (
    <div>
      <div className="k flex gap-5 pb-4" role="tablist" aria-label="Filtrer les factures">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={filter === t.id}
            onClick={() => setFilter(t.id)}
            className={`pb-1 border-b-2 min-h-8 cursor-pointer ${
              filter === t.id ? "text-brand-vibrant border-brand-vibrant" : "text-brand-muted border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="border border-dashed border-brand-snow/20 px-6 py-14 text-center">
          <FileText className="w-8 h-8 mx-auto mb-4 text-brand-muted" aria-hidden="true" />
          <h3 className="text-lg font-extrabold">
            {invoices.length === 0 ? "Aucune facture émise" : "Aucune facture dans ce filtre"}
          </h3>
          <p className="text-sm text-brand-muted mt-2 max-w-xs mx-auto">
            {invoices.length === 0
              ? "Créez votre première facture client : elle apparaîtra ici avec son statut."
              : "Changez de filtre pour voir les autres factures."}
          </p>
        </div>
      ) : (
        <div className="ticket !pb-2">
          {visible.map((invoice, i) => {
            const late = invoice.status === "en_attente" && invoice.dueDate && invoice.dueDate < todayISO();
            return (
              <div
                key={invoice.id}
                className={`py-3.5 ${i < visible.length - 1 ? "border-b-2 border-dashed border-[var(--ink)]/35" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => onViewInvoice(invoice)}
                    className="k font-bold text-left cursor-pointer"
                    style={{ color: "var(--ink)" }}
                  >
                    {invoice.invoiceNumber}
                  </button>
                  {invoice.status === "payé" ? (
                    <span className="stamp ok">Payée</span>
                  ) : invoice.status === "annulé" ? (
                    <span className="stamp wait">Annulée</span>
                  ) : late ? (
                    <span className="stamp late">En retard</span>
                  ) : (
                    <span className="k">à payer</span>
                  )}
                </div>
                <div className="leader">
                  <span className="truncate">{invoice.clientName}</span>
                  <i />
                  <span>{late ? shortDate(invoice.dueDate) : shortDate(invoice.status === "payé" ? invoice.date : invoice.dueDate)}</span>
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-[34px] font-extrabold tracking-[-0.03em] leading-none">{formatEuro(invoice.totalTTC)}</div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleStatus(invoice.id, invoice.status)}
                      className="p-2.5 cursor-pointer text-[var(--paper-muted)] hover:text-[#1E7A4F]"
                      title={invoice.status === "payé" ? "Marquer comme à payer" : "Marquer comme payée"}
                      aria-label={invoice.status === "payé" ? "Marquer comme à payer" : "Marquer comme payée"}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Supprimer la facture ${invoice.invoiceNumber} ?`)) onDeleteInvoice(invoice.id);
                      }}
                      className="p-2.5 cursor-pointer text-[var(--paper-muted)] hover:text-[#C73A10]"
                      title="Supprimer"
                      aria-label={`Supprimer la facture ${invoice.invoiceNumber}`}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
