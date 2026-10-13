export type ReceiptCategory =
  | "Restaurant"
  | "Transport"
  | "Hébergement"
  | "Logiciel"
  | "Matériel"
  | "Télécom"
  | "Fournitures"
  | "Honoraires"
  | "Marketing"
  | "Frais bancaires"
  | "Formation"
  | "Autre";

export type TaxDeductibility = "deductible" | "partielle" | "non_deductible" | "sans_tva";

export type ReceiptStatus = "validé" | "en_attente";

export type TransactionType = "income" | "expense";

export type PaymentMethod =
  | "Carte Bancaire"
  | "Virement"
  | "Prélèvement"
  | "Apple Pay"
  | "Espèces";

export type SupportedCurrency = "EUR" | "USD" | "GBP" | "CHF" | "CAD" | "JPY";

export interface ReceiptItem {
  id: string;
  transactionType?: TransactionType; // "income" or "expense"
  supplier: string;
  date: string; // YYYY-MM-DD
  totalTTC: number; // Montant en Euros (€) pour la compta française
  vatAmount: number; // TVA en Euros (€)
  vatRate: number; // e.g. 20, 10, 5.5, 0
  category: ReceiptCategory;
  expenseType?: string; // Sous-type de dépense qualifié par l'IA (ex: "Repas d'affaires", "Billet SNCF", "Abonnement SaaS", "Course VTC")
  accountingCode?: string; // Compte Plan Comptable Général (ex: "6256", "6251", "6181", "6063", etc.)
  taxDeductibility?: TaxDeductibility; // Déductibilité fiscale TVA
  status: ReceiptStatus;
  paymentMethod: PaymentMethod;
  currency?: SupportedCurrency | string; // Devise du justificatif (défaut EUR)
  originalTotal?: number; // Montant dans la devise d'origine si différent d'EUR
  exchangeRate?: number; // Taux de change appliqué (1 [Devise] = X EUR)
  invoiceNumber?: string;
  notes?: string;
  fileDataUrl?: string; // base64 or placeholder preview
  fileName: string;
  fileType: "image" | "pdf" | "voice";
  fileSize?: string;
  standardizedName: string; // e.g. "2026-09-18_SNCF_78-50EUR.pdf"
  aiExtracted?: boolean;
  confidence?: number;
  extractedLines?: string[];
  rawOcrText?: string;
  extractionSource?: "groq-ai" | "fallback" | "preset" | "email";
  source: "scan" | "upload" | "email" | "voice";
  createdAt: string;
  driveFileId?: string;
  driveViewLink?: string;
  tempId?: string;
}

export type PeriodType = "all" | "current_month" | "last_month" | "this_year" | "custom" | "month";

export interface PeriodSelection {
  type: PeriodType;
  monthKey?: string; // YYYY-MM if type is "month"
  startDate?: string; // YYYY-MM-DD for custom
  endDate?: string;   // YYYY-MM-DD for custom
}

export interface MonthSummary {
  monthKey: string; // e.g. "2026-09"
  label: string; // e.g. "Septembre 2026"
  totalTTC: number;
  totalHT: number;
  totalVAT: number;
  count: number;
  validatedCount: number;
  pendingCount: number;
}

export type InvoiceStatus = "payé" | "en_attente" | "annulé";

export interface IssuedInvoice {
  id: string;
  invoiceNumber: string; // Sequential, e.g., "FAC-2026-001"
  clientName: string;
  date: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  totalHT: number;
  totalTTC: number;
  vatAmount: number;
  vatRate: number;
  status: InvoiceStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  tempId?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  estimatedTaxRate: number; // e.g. 22
  nextInvoiceNumber: number; // For sequential numbering
  telegramId?: string; // Telegram Chat ID
  telegramToken?: string; // Token for linking account
  createdAt: string;
  updatedAt: string;
}

export interface TreasuryStats {
  totalRevenue: number;
  totalExpenses: number;
  estimatedCharges: number;
  netRevenue: number;
  taxRate: number;
}
