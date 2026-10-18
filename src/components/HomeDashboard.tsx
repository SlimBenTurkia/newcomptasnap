import React, { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import { ReceiptItem } from "../types";
import { formatEuro } from "../utils/formatters";
import { hasJustificatif, isExpense, vatRecoverable, findDuplicateGroups } from "../utils/receiptStats";

interface HomeDashboardProps {
  /** Reçus de la période sélectionnée */
  receipts: ReceiptItem[];
  /** Tous les reçus (graphique des 4 semaines) */
  allReceipts: ReceiptItem[];
  monthLabel: string;
  /** Mois précédent, pour la comparaison */
  previous?: { receipts: ReceiptItem[]; label: string } | null;
  driveConnected: boolean;
  onConnectDrive: () => void;
  onOpenScan: () => void;
  onOpenPending: () => void;
  onOpenMissing: () => void;
  onOpenValidated: () => void;
  onOpenReceipt: (r: ReceiptItem) => void;
  onValidateAllPending?: () => void;
  onOpenClosing: () => void;
  /** Factures (fonction masquée pour le moment) */
  pendingInvoicesTotal?: number;
  onOpenInvoices?: () => void;
}

const weekStart = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x.getTime();
};

const sum = (list: ReceiptItem[]) => list.reduce((acc, r) => acc + (Number(r.totalTTC) || 0), 0);

/**
 * Accueil = tableau de bord : ce qu'on ne voit PAS dans la liste des reçus
 * (évolution, comparaison, répartition, points à régler, état de la clôture).
 */
export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  receipts,
  allReceipts,
  monthLabel,
  previous,
  driveConnected,
  onConnectDrive,
  onOpenScan,
  onOpenPending,
  onOpenMissing,
  onOpenValidated,
  onOpenReceipt,
  onValidateAllPending,
  onOpenClosing,
  pendingInvoicesTotal = 0,
  onOpenInvoices,
}) => {
  const expenses = useMemo(() => receipts.filter(isExpense), [receipts]);
  const total = sum(expenses);
  const pendingCount = receipts.filter((r) => r.status === "en_attente").length;
  const validatedCount = receipts.length - pendingCount;
  const missingCount = expenses.filter((r) => !hasJustificatif(r)).length;
  const withFileCount = expenses.length - missingCount;
  const average = expenses.length > 0 ? total / expenses.length : 0;
  const duplicate = useMemo(() => findDuplicateGroups(receipts)[0], [receipts]);

  // Évolution par rapport au mois précédent
  const variation = useMemo(() => {
    if (!previous) return null;
    const prevTotal = sum(previous.receipts.filter(isExpense));
    if (prevTotal <= 0) return `Aucune dépense en ${previous.label}`;
    const pct = Math.round(((total - prevTotal) / prevTotal) * 100);
    const arrow = pct > 0 ? `▲ +${pct} %` : pct < 0 ? `▼ −${Math.abs(pct)} %` : "= stable";
    return `${arrow} vs ${previous.label}`;
  }, [previous, total]);

  // Dépenses par semaine : 4 semaines, la dernière étant la semaine la plus récente qui contient des données
  const WEEKS_COUNT = 4;
  const weeks = useMemo(() => {
    const byWeek = new Map<number, number>();
    allReceipts.forEach((r) => {
      if (!isExpense(r) || !r.date) return;
      const key = weekStart(new Date(r.date + "T12:00:00"));
      if (Number.isNaN(key)) return;
      byWeek.set(key, (byWeek.get(key) || 0) + (Number(r.totalTTC) || 0));
    });
    const anchor = byWeek.size > 0 ? Math.max(...Array.from(byWeek.keys())) : weekStart(new Date());
    const list = Array.from({ length: WEEKS_COUNT }, (_, i) => {
      const d = new Date(anchor);
      d.setDate(d.getDate() - 7 * (WEEKS_COUNT - 1 - i));
      const start = weekStart(d);
      return { start, value: byWeek.get(start) || 0 };
    });
    const max = Math.max(...list.map((w) => w.value), 1);
    return list.map((w) => ({
      ...w,
      label: new Date(w.start).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      pct: w.value > 0 ? Math.max(10, Math.round((w.value / max) * 100)) : 0,
    }));
  }, [allReceipts]);

  // Répartition par catégorie (5 premières + « Autres »)
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((r) => map.set(r.category, (map.get(r.category) || 0) + (Number(r.totalTTC) || 0)));
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const head = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((acc, [, v]) => acc + v, 0);
    return rest > 0 ? [...head, ["Autres", rest] as [string, number]] : head;
  }, [expenses]);

  // Principaux fournisseurs
  const suppliers = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    expenses.forEach((r) => {
      const key = (r.supplier || "—").trim();
      const cur = map.get(key) || { sum: 0, count: 0 };
      map.set(key, { sum: cur.sum + (Number(r.totalTTC) || 0), count: cur.count + 1 });
    });
    return [...map.entries()].sort((a, b) => b[1].sum - a[1].sum).slice(0, 3);
  }, [expenses]);

  const [intPart, decPart] = formatEuro(total).replace(/\u00a0€|\s€/, "").split(",");
  const ready = receipts.length > 0 && pendingCount === 0 && missingCount === 0;

  const rowClass =
    "w-full text-left py-3 cursor-pointer flex items-baseline gap-2 min-h-11 border-b-2 border-dashed border-[var(--ink)]/35 last:border-b-0";

  // Points à régler (actions)
  const tasks: { key: string; label: string; value: React.ReactNode; onClick: () => void }[] = [];
  if (pendingCount > 0)
    tasks.push({
      key: "pending",
      label: "Reçus à valider",
      value: <span style={{ color: "#FF1F3D" }}>{pendingCount}</span>,
      onClick: onOpenPending,
    });
  if (missingCount > 0)
    tasks.push({
      key: "missing",
      label: "Justificatifs manquants",
      value: <span style={{ color: "#C73A10" }}>{missingCount}</span>,
      onClick: onOpenMissing,
    });
  if (duplicate)
    tasks.push({
      key: "dup",
      label: `Doublon possible · ${duplicate[0].supplier}`,
      value: <span>{formatEuro(duplicate[0].totalTTC)}</span>,
      onClick: () => onOpenReceipt(duplicate[0]),
    });
  if (!driveConnected)
    tasks.push({
      key: "drive",
      label: "Google Drive non connecté",
      value: <span className="underline">Connecter</span>,
      onClick: onConnectDrive,
    });
  if (pendingInvoicesTotal > 0 && onOpenInvoices)
    tasks.push({
      key: "invoices",
      label: "Factures en attente",
      value: <span>{formatEuro(pendingInvoicesTotal)}</span>,
      onClick: onOpenInvoices,
    });

  if (receipts.length === 0) {
    return (
      <section aria-label={`Synthèse ${monthLabel}`} className="space-y-4">
        <div className="k text-brand-muted px-1">{monthLabel}</div>
        <div className="border border-dashed border-brand-snow/20 px-6 py-14 text-center">
          <h3 className="text-lg font-extrabold">Aucune dépense sur cette période</h3>
          <p className="text-sm text-brand-muted mt-2 max-w-xs mx-auto">
            Scannez votre premier justificatif : l'accueil affichera l'évolution, la répartition et les points à régler.
          </p>
          <button onClick={onOpenScan} className="btn mt-6">
            Scanner un reçu
          </button>
        </div>
        {!driveConnected && (
          <button onClick={onConnectDrive} className="k underline cursor-pointer text-brand-vibrant min-h-8">
            Connecter Google Drive
          </button>
        )}
      </section>
    );
  }

  return (
    <section aria-label={`Synthèse ${monthLabel}`} className="flex flex-col gap-4">
      <div className="flex items-center justify-between k text-brand-muted px-1">
        <span>{monthLabel}</span>
        <span className={ready ? "text-brand-vibrant" : ""}>
          {ready ? "● à jour" : `${validatedCount}/${receipts.length} validés`}
        </span>
      </div>

      {/* 1. Dépenses + évolution */}
      <div className="ticket relative">
        <div className="k">Total dépenses</div>
        <div className="text-[56px] sm:text-[68px] font-extrabold leading-none tracking-[-0.04em] my-1.5">
          {intPart}
          <span className="text-[26px]">,{decPart ?? "00"} €</span>
        </div>
        {variation && <div className="k">{variation}</div>}

        <div className="mt-4 mb-2">
          <div className="k text-[10px] mb-1">Dépenses par semaine</div>
          <div
            className="grid grid-cols-4 gap-2"
            role="img"
            aria-label={`Dépenses des ${WEEKS_COUNT} dernières semaines avec des données`}
          >
            {weeks.map((w, i) => {
              const isLast = i === weeks.length - 1;
              return (
                <div key={w.start} className="flex flex-col min-w-0">
                  <div className="h-16 flex items-end border-b-2 border-[var(--ink)]">
                    <b
                      className="block w-full"
                      style={{
                        height: w.pct > 0 ? `${w.pct}%` : "3px",
                        background: isLast && w.pct > 0 ? "#C6F432" : "var(--ink)",
                        outline: isLast && w.pct > 0 ? "1.5px solid var(--ink)" : "none",
                        outlineOffset: -1.5,
                        opacity: w.pct === 0 ? 0.18 : 1,
                      }}
                    />
                  </div>
                  <div className="font-mono text-[11px] font-bold mt-1 text-center truncate">
                    {w.value > 0 ? formatEuro(w.value) : "—"}
                  </div>
                  <div className="k text-[10px] text-center">sem. {w.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="leader"><span>Nombre de reçus</span><i /><span>{expenses.length}</span></div>
        <div className="leader"><span>Moyenne par reçu</span><i /><span>{formatEuro(average)}</span></div>
        <div className="leader"><span>TVA récupérable</span><i /><span>{formatEuro(vatRecoverable(receipts))}</span></div>

        {pendingCount > 0 ? (
          <button
            type="button"
            onClick={onOpenPending}
            className="stamp todo absolute right-3.5 top-3.5"
            aria-label={`${pendingCount} justificatif${pendingCount > 1 ? "s" : ""} à traiter : voir la liste`}
          >
            À traiter ×{pendingCount}
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenValidated}
            className="stamp ok absolute right-3.5 top-3.5"
            aria-label="Tout est bon : voir les reçus validés"
          >
            Tout est bon ✓
          </button>
        )}
      </div>

      {/* 2. Points à régler */}
      <div className="ticket !pb-2">
        <div className="k mb-1">À faire</div>
        {tasks.length === 0 ? (
          <div className="py-3 flex items-center justify-between gap-2">
            <span className="text-[15px] font-mono">Rien à régler pour {monthLabel}</span>
            <span className="stamp ok">OK</span>
          </div>
        ) : (
          tasks.map((t) => (
            <button key={t.key} type="button" onClick={t.onClick} className={rowClass}>
              <span className="flex-1 min-w-0 truncate text-[15px] font-mono">{t.label}</span>
              <span className="shrink-0 font-mono font-bold">{t.value}</span>
              <span aria-hidden="true" className="shrink-0">›</span>
            </button>
          ))
        )}
        {pendingCount > 0 && onValidateAllPending && (
          <button
            type="button"
            onClick={onValidateAllPending}
            className="k mt-1 mb-2 flex items-center gap-2 cursor-pointer min-h-11 font-bold"
            style={{ color: "var(--ink)" }}
          >
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            Tout valider ({pendingCount})
          </button>
        )}
      </div>

      {/* 3. Répartition */}
      <div className="ticket !pb-3">
        <div className="k mb-1">Répartition par catégorie</div>
        {categories.map(([name, value]) => {
          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
          return (
            <div key={name} className="py-1.5">
              <div className="leader !py-0.5">
                <span className="truncate">{name}</span>
                <i />
                <span>{formatEuro(value)} · {pct} %</span>
              </div>
              <div className="h-1.5 bg-[var(--ink)]/15" aria-hidden="true">
                <div className="h-full bg-[var(--ink)]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}

        <div className="k mt-4 mb-1 pt-3 border-t-2 border-dashed border-[var(--ink)]/35">Principaux fournisseurs</div>
        {suppliers.map(([name, v]) => (
          <div key={name} className="leader">
            <span className="truncate">{name}{v.count > 1 ? ` ×${v.count}` : ""}</span>
            <i />
            <span>{formatEuro(v.sum)}</span>
          </div>
        ))}
      </div>

      {/* 4. Clôture */}
      <div className="border border-dashed border-brand-snow/20 p-4 space-y-3">
        <div className="k text-brand-muted">Clôture · {monthLabel}</div>
        <div className="leader"><span>Reçus validés</span><i /><span>{validatedCount} / {receipts.length}</span></div>
        <div className="leader"><span>Justificatifs joints</span><i /><span>{withFileCount} / {expenses.length}</span></div>
        <button onClick={onOpenClosing} className={ready ? "btn w-full" : "btn ghost w-full"}>
          {ready ? "Préparer le bilan" : "Préparer le bilan (points à régler)"}
        </button>
      </div>
    </section>
  );
};
