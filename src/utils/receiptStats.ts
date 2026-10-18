import { ReceiptItem } from "../types";

/** Dépense (par opposition à une recette) */
export const isExpense = (r: ReceiptItem): boolean => r.transactionType !== "income";

/** Le reçu a un justificatif (image / PDF sur Drive, Storage ou en mémoire) */
export const hasJustificatif = (r: ReceiptItem): boolean => !!(r.fileDataUrl || r.driveFileId);

/**
 * TVA réellement récupérable : uniquement les reçus à TVA 100 % déductible.
 * (Les reçus « partielle », « non déductible » ou « sans TVA » ne sont pas comptés.)
 */
export const vatRecoverable = (list: ReceiptItem[]): number =>
  list
    .filter(isExpense)
    .reduce(
      (acc, r) => acc + ((r.taxDeductibility ?? "deductible") === "deductible" ? Number(r.vatAmount) || 0 : 0),
      0
    );

/** Groupes de reçus qui se ressemblent (même fournisseur, même date, même montant) : doublons possibles */
export function findDuplicateGroups(list: ReceiptItem[]): ReceiptItem[][] {
  const map = new Map<string, ReceiptItem[]>();
  list.filter(isExpense).forEach((r) => {
    const key = `${(r.supplier || "").trim().toLowerCase()}|${r.date}|${(Number(r.totalTTC) || 0).toFixed(2)}`;
    map.set(key, [...(map.get(key) || []), r]);
  });
  return [...map.values()].filter((g) => g.length > 1);
}

/** Décale une clé « AAAA-MM » de `delta` mois */
export function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
