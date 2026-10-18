import React, { useMemo } from "react";
import { formatEuro } from "../utils/formatters";
import { ReceiptItem } from "../types";
import { CheckCircle2 } from "lucide-react";

interface MonthStatsProps {
  receipts: ReceiptItem[];
  monthLabel: string;
  onValidateAllPending?: () => void;
  /** Ouvre la liste des reçus à valider */
  onOpenPending?: () => void;
  /** Ouvre la liste des reçus validés (affiché quand tout est à jour) */
  onOpenValidated?: () => void;
  /** Tous les reçus (toutes périodes) : sert au graphique des 8 dernières semaines */
  allReceipts?: ReceiptItem[];
}

/** Lundi (00:00) de la semaine contenant la date donnée */
const weekStart = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x.getTime();
};

export const MonthStats: React.FC<MonthStatsProps> = ({
  receipts,
  monthLabel,
  onValidateAllPending,
  onOpenPending,
  onOpenValidated,
  allReceipts,
}) => {
  const expenses = receipts.filter((r) => r.transactionType !== "income");
  const totalTTC = expenses.reduce((acc, r) => acc + r.totalTTC, 0);
  const totalVAT = expenses.reduce((acc, r) => acc + r.vatAmount, 0);
  const count = receipts.length;
  const pendingCount = receipts.filter((r) => r.status === "en_attente").length;
  const validatedCount = count - pendingCount;

  // Trois premières catégories de la période
  const topCategories = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((r) => map.set(r.category, (map.get(r.category) || 0) + r.totalTTC));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [receipts]);

  // Dépenses des 8 dernières semaines (la dernière barre = semaine en cours)
  const weeks = useMemo(() => {
    const source = allReceipts ?? receipts;
    const thisWeek = weekStart(new Date());
    const WEEK = 7 * 24 * 3600 * 1000;
    const buckets = Array.from({ length: 8 }, () => 0);
    source.forEach((r) => {
      if (r.transactionType === "income" || !r.date) return;
      const t = weekStart(new Date(r.date + "T12:00:00"));
      const idx = 7 - Math.round((thisWeek - t) / WEEK);
      if (idx >= 0 && idx < 8) buckets[idx] += r.totalTTC;
    });
    const max = Math.max(...buckets, 1);
    return buckets.map((v) => Math.max(v > 0 ? 6 : 0, Math.round((v / max) * 100)));
  }, [allReceipts, receipts]);

  const [intPart, decPart] = formatEuro(totalTTC).replace(/\u00a0€|\s€/, "").split(",");

  return (
    <section aria-label={`Synthèse ${monthLabel}`}>
      <div className="flex items-center justify-between k text-brand-muted px-1 mb-4">
        <span>{monthLabel}</span>
        <span className={pendingCount === 0 && count > 0 ? "text-brand-vibrant" : ""}>
          {pendingCount === 0 && count > 0 ? "● à jour" : `${validatedCount}/${count} validés`}
        </span>
      </div>

      <div className="ticket">
        <div className="k">Total dépenses</div>
        <div className="text-[56px] sm:text-[68px] font-extrabold leading-none tracking-[-0.04em] my-1.5">
          {intPart}
          <span className="text-[26px]">,{decPart ?? "00"} €</span>
        </div>
        <div className="k">TVA récupérable {formatEuro(totalVAT)}</div>

        <div className="flex items-end gap-[5px] h-11 mt-4 mb-2" role="img" aria-label="Dépenses des 8 dernières semaines">
          {weeks.map((h, i) => (
            <b
              key={i}
              className="flex-1 block"
              style={{
                height: `${Math.max(h, 4)}%`,
                background: i === 7 ? "#C6F432" : "var(--ink)",
                outline: i === 7 ? "2px solid var(--ink)" : "none",
                outlineOffset: -2,
                opacity: h === 0 ? 0.15 : 1,
              }}
            />
          ))}
        </div>

        {topCategories.length === 0 ? (
          <div className="leader"><span>Aucune dépense sur la période</span><i /><span>0 €</span></div>
        ) : (
          topCategories.map(([name, value]) => (
            <div key={name} className="leader"><span>{name}</span><i /><span>{formatEuro(value)}</span></div>
          ))
        )}

        {pendingCount > 0 ? (
          <button
            type="button"
            onClick={onOpenPending}
            className="stamp todo absolute right-3.5 top-3.5"
            aria-label={`${pendingCount} justificatif${pendingCount > 1 ? "s" : ""} à traiter : voir la liste`}
          >
            À traiter ×{pendingCount}
          </button>
        ) : count > 0 ? (
          <button
            type="button"
            onClick={onOpenValidated}
            className="stamp ok absolute right-3.5 top-3.5"
            aria-label="Tout est bon : voir les reçus validés"
          >
            Tout est bon ✓
          </button>
        ) : null}
      </div>

      {pendingCount > 0 && onValidateAllPending && (
        <button
          onClick={onValidateAllPending}
          className="k mt-6 flex items-center gap-2 text-brand-vibrant cursor-pointer min-h-11"
        >
          <CheckCircle2 className="w-4 h-4" />
          Tout valider ({pendingCount})
        </button>
      )}
    </section>
  );
};
