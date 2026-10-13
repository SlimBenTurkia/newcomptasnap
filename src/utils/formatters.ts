import { ReceiptItem } from "../types";
import JSZip from "jszip";

/**
 * Standardize filename to accounting norms:
 * Format: YYYY-MM-DD_FOURNISSEUR_MONTANT-EUR.ext
 */
export function generateStandardizedFilename(
  date: string,
  supplier: string,
  totalTTC: number,
  originalFilename: string
): string {
  const cleanDate = date || new Date().toISOString().split("T")[0];
  const cleanSupplier = (supplier || "JUSTIFICATIF")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^A-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);

  const cleanAmount = (totalTTC || 0).toFixed(2).replace(".", "-");
  
  // Extract extension
  const extMatch = originalFilename.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : "pdf";

  return `${cleanDate}_${cleanSupplier}_${cleanAmount}EUR.${ext}`;
}

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export interface CurrencyInfo {
  code: string;
  symbol: string;
  label: string;
  defaultRateToEUR: number; // 1 [Devise] = X EUR
  flag: string;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyInfo> = {
  EUR: {
    code: "EUR",
    symbol: "€",
    label: "Euro (€)",
    defaultRateToEUR: 1.0,
    flag: "🇪🇺",
  },
  USD: {
    code: "USD",
    symbol: "$",
    label: "Dollar US ($)",
    defaultRateToEUR: 0.92,
    flag: "🇺🇸",
  },
  GBP: {
    code: "GBP",
    symbol: "£",
    label: "Livre Sterling (£)",
    defaultRateToEUR: 1.18,
    flag: "🇬🇧",
  },
  CHF: {
    code: "CHF",
    symbol: "CHF",
    label: "Franc Suisse (CHF)",
    defaultRateToEUR: 1.05,
    flag: "🇨🇭",
  },
  CAD: {
    code: "CAD",
    symbol: "CA$",
    label: "Dollar Canadien (CA$)",
    defaultRateToEUR: 0.68,
    flag: "🇨🇦",
  },
  JPY: {
    code: "JPY",
    symbol: "¥",
    label: "Yen Japonais (¥)",
    defaultRateToEUR: 0.0062,
    flag: "🇯🇵",
  },
};

/**
 * Format any currency amount cleanly
 */
export function formatCurrency(amount: number, currencyCode = "EUR"): string {
  const code = (currencyCode || "EUR").toUpperCase();
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const symbol = SUPPORTED_CURRENCIES[code]?.symbol || code;
    return `${(amount || 0).toFixed(2)} ${symbol}`;
  }
}

/**
 * Get structured display for a receipt amount with original foreign currency
 * and indicative conversion to EUR simultaneously.
 */
export function formatReceiptAmountDisplay(receipt: {
  totalTTC: number;
  originalTotal?: number;
  currency?: string;
  exchangeRate?: number;
}): {
  isForeign: boolean;
  currencyCode: string;
  currencySymbol: string;
  primaryFormatted: string; // Original currency amount if foreign, otherwise EUR
  indicativeEuroFormatted?: string; // "≈ 45,10 € (indicatif)" if foreign
  indicativeEuroShort?: string; // "≈ 45,10 €"
  euroTotalFormatted: string; // Standard Euro format
} {
  const code = (receipt.currency || "EUR").toUpperCase();
  const isForeign = code !== "EUR";
  const symbol = SUPPORTED_CURRENCIES[code]?.symbol || code;
  const originalVal = receipt.originalTotal ?? receipt.totalTTC;

  if (isForeign) {
    return {
      isForeign: true,
      currencyCode: code,
      currencySymbol: symbol,
      primaryFormatted: formatCurrency(originalVal, code),
      indicativeEuroFormatted: `≈ ${formatEuro(receipt.totalTTC)} (indicatif)`,
      indicativeEuroShort: `≈ ${formatEuro(receipt.totalTTC)}`,
      euroTotalFormatted: formatEuro(receipt.totalTTC),
    };
  }

  return {
    isForeign: false,
    currencyCode: "EUR",
    currencySymbol: "€",
    primaryFormatted: formatEuro(receipt.totalTTC),
    indicativeEuroFormatted: undefined,
    indicativeEuroShort: undefined,
    euroTotalFormatted: formatEuro(receipt.totalTTC),
  };
}

export function formatDateFrench(dateString: string): string {
  if (!dateString) return "";
  try {
    const [year, month, day] = dateString.split("-");
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatMonthYearLabel(yearMonth: string): string {
  if (!yearMonth || yearMonth === "all") return "Tous les justificatifs";
  try {
    const [year, month] = yearMonth.split("-");
    const d = new Date(Number(year), Number(month) - 1, 1);
    const label = new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
    }).format(d);
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return yearMonth;
  }
}

import { PeriodSelection } from "../types";

/**
 * Filter receipts by the selected period criteria
 */
export function filterReceiptsByPeriod(receipts: ReceiptItem[], period: PeriodSelection): ReceiptItem[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  switch (period.type) {
    case "all":
      return receipts;
    case "current_month": {
      const ym = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      return receipts.filter(r => r.date && r.date.startsWith(ym));
    }
    case "last_month": {
      const prev = new Date(currentYear, currentMonth - 1, 1);
      const ym = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
      return receipts.filter(r => r.date && r.date.startsWith(ym));
    }
    case "this_year": {
      return receipts.filter(r => r.date && r.date.startsWith(String(currentYear)));
    }
    case "month": {
      return receipts.filter(r => r.date && r.date.startsWith(period.monthKey!));
    }
    case "custom": {
      const start = period.startDate || '0000-00-00';
      const end = period.endDate || '9999-12-31';
      return receipts.filter(r => r.date && r.date >= start && r.date <= end);
    }
    default:
      return receipts;
  }
}

/**
 * Get a user-friendly label for a PeriodSelection
 */
export function getPeriodLabel(period: PeriodSelection): string {
  switch (period.type) {
    case "all":
      return "Toute la période";
    case "current_month":
      return "Mois en cours";
    case "last_month":
      return "Mois dernier";
    case "this_year":
      return "Cette année";
    case "month":
      return formatMonthYearLabel(period.monthKey!);
    case "custom":
      if (period.startDate && period.endDate) {
        return `${period.startDate} au ${period.endDate}`;
      }
      return "Personnalisé";
    default:
      return "Période";
  }
}

/**
 * Generates an accounting CSV (Journal des Achats) formatted for French CPAs
 */
export function generateAccountingCSV(receipts: ReceiptItem[], monthLabel: string): string {
  // UTF-8 BOM so Excel opens it with proper accents
  const BOM = "\uFEFF";
  const headers = [
    "Date",
    "Numéro Pièce",
    "Fournisseur",
    "Catégorie",
    "Type de Dépense",
    "Compte PCG",
    "Régime TVA",
    "Devise d'origine",
    "Montant Devise d'origine",
    "Taux de Change (vers €)",
    "Montant HT (€)",
    "Montant TVA (€)",
    "Taux TVA (%)",
    "Montant TTC (€)",
    "Moyen de Paiement",
    "Statut",
    "Nom Fichier Archivé",
    "Notes",
  ];

  const rows = receipts.map((r) => {
    const totalHT = Number((r.totalTTC - r.vatAmount).toFixed(2));
    const currency = r.currency || "EUR";
    const originalAmt = r.originalTotal ?? r.totalTTC;
    const rate = r.exchangeRate ?? (currency === "EUR" ? 1 : SUPPORTED_CURRENCIES[currency]?.defaultRateToEUR ?? 1);

    const regimeTva =
      r.taxDeductibility === "deductible"
        ? "Déductible"
        : r.taxDeductibility === "non_deductible"
        ? "Non déductible"
        : r.taxDeductibility === "partielle"
        ? "Partielle"
        : "Sans TVA / Exonéré";

    return [
      r.date,
      r.invoiceNumber || `REC-${r.id.slice(0, 6)}`,
      `"${r.supplier.replace(/"/g, '""')}"`,
      r.category,
      `"${(r.expenseType || r.category).replace(/"/g, '""')}"`,
      r.accountingCode || "",
      regimeTva,
      currency,
      originalAmt.toFixed(2).replace(".", ","),
      rate.toFixed(4).replace(".", ","),
      totalHT.toFixed(2).replace(".", ","),
      r.vatAmount.toFixed(2).replace(".", ","),
      r.vatRate.toString(),
      r.totalTTC.toFixed(2).replace(".", ","),
      r.paymentMethod,
      r.status === "validé" ? "Validé" : "En attente",
      r.standardizedName,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ].join(";");
  });

  return BOM + [headers.join(";"), ...rows].join("\r\n");
}

/**
 * Downloads a text/blob file in browser
 */
export function triggerDownload(content: Blob | string, filename: string, mimeType = "text/csv;charset=utf-8;") {
  const blob = typeof content === "string" ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Creates and downloads a complete ZIP archive for the CPA
 */
export async function generateAccountingZip(
  receipts: ReceiptItem[],
  monthLabel: string
): Promise<void> {
  const zip = new JSZip();
  const folderName = `ComptaSnap_${monthLabel.replace(/\s+/g, "_")}`;
  const root = zip.folder(folderName) || zip;

  // 1. Add CSV Journal
  const csvContent = generateAccountingCSV(receipts, monthLabel);
  root.file(`00_Journal_des_Achats_${monthLabel.replace(/\s+/g, "_")}.csv`, csvContent);

  // 2. Add Summary Report (Bordereau de transmission)
  const totalTTC = receipts.reduce((acc, r) => acc + r.totalTTC, 0);
  const totalVAT = receipts.reduce((acc, r) => acc + r.vatAmount, 0);
  const totalHT = totalTTC - totalVAT;
  const validatedCount = receipts.filter((r) => r.status === "validé").length;

  const bordereauText = `=====================================================
COMPTASNAP — BORDEREAU DE TRANSMISSION COMPTABLE
Période : ${monthLabel}
Date de génération : ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}
=====================================================

SYNTHÈSE DU MOIS :
- Nombre total de justificatifs : ${receipts.length}
- Pièces validées : ${validatedCount} / ${receipts.length}
- Total Dépenses TTC : ${formatEuro(totalTTC)}
- Total Montant HT : ${formatEuro(totalHT)}
- Total TVA Déductible : ${formatEuro(totalVAT)}

VENTILATION PAR CATÉGORIE :
${getCategoryBreakdownText(receipts)}

LISTE DES PIÈCES COMPTABLES RENOMMÉES :
${receipts
  .map(
    (r, i) => {
      const isForeign = r.currency && r.currency !== "EUR";
      const devStr = isForeign
        ? `[${formatCurrency(r.originalTotal ?? r.totalTTC, r.currency)} -> ${formatEuro(r.totalTTC)} indicatif]`
        : `[${formatEuro(r.totalTTC)}]`;
      return `${String(i + 1).padStart(2, "0")}. [${r.date}] ${r.supplier.padEnd(20)} | Montant: ${devStr.padEnd(28)} | TVA: ${formatEuro(r.vatAmount).padStart(8)} | Fichier: ${r.standardizedName}`;
    }
  )
  .join("\n")}

Dossier généré avec ComptaSnap — Application certifiée pour indépendants & micro-entreprises.
`;
  root.file(`00_Bordereau_de_Remise_${monthLabel.replace(/\s+/g, "_")}.txt`, bordereauText);

  // 3. Add receipt files
  const piecesFolder = root.folder("Justificatifs_Numerises") || root;
  
  for (const r of receipts) {
    if (r.fileDataUrl && r.fileDataUrl.startsWith("data:")) {
      // Decode base64 file
      const base64Data = r.fileDataUrl.split(",")[1];
      piecesFolder.file(r.standardizedName, base64Data, { base64: true });
    } else {
      // Generate a clean text/pdf placeholder proof containing the receipt summary
      const dummyProof = `JUSTIFICATIF DE PAIEMENT NUMÉRISÉ
Fournisseur : ${r.supplier}
Date : ${r.date}
Montant TTC : ${formatEuro(r.totalTTC)}
TVA Détectée (${r.vatRate}%) : ${formatEuro(r.vatAmount)}
Catégorie : ${r.category}
Réf. Transaction : ${r.invoiceNumber || "NON-SPECIFIE"}
Moyen de Paiement : ${r.paymentMethod}
Nom Original : ${r.fileName}
Horodatage Numérisation : ${r.createdAt}
Statut : ${r.status.toUpperCase()}

Ce document tient lieu de fiche justificative électronique indexée ComptaSnap.
`;
      piecesFolder.file(r.standardizedName.replace(/\.(png|jpg|jpeg|webp)$/i, ".txt"), dummyProof);
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  triggerDownload(zipBlob, `${folderName}.zip`, "application/zip");
}

function getCategoryBreakdownText(receipts: ReceiptItem[]): string {
  const map: Record<string, { count: number; total: number }> = {};
  for (const r of receipts) {
    if (!map[r.category]) {
      map[r.category] = { count: 0, total: 0 };
    }
    map[r.category].count++;
    map[r.category].total += r.totalTTC;
  }
  return Object.entries(map)
    .map(([cat, data]) => `- ${cat.padEnd(16)} : ${data.count} pièces | ${formatEuro(data.total)}`)
    .join("\n");
}
