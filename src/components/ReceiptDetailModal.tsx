import React, { useState, useEffect } from "react";
import { ReceiptItem, ReceiptCategory, PaymentMethod, TaxDeductibility } from "../types";
import {
  formatEuro,
  formatDateFrench,
  generateStandardizedFilename,
  SUPPORTED_CURRENCIES,
  formatCurrency,
  formatReceiptAmountDisplay,
} from "../utils/formatters";
import {
  CATEGORY_DEFINITIONS,
  ALL_CATEGORIES,
  getCategoryMetadata,
  getTaxDeductibilityBadge,
  TAX_DEDUCTIBILITY_OPTIONS,
} from "../utils/expenseCategories";
import { getCategoryIcon } from "./ReceiptCard";
import { ImageViewerModal } from "./ImageViewerModal";
import { useReceiptPreview, PreviewUnavailable } from "./ReceiptFilePreview";
import {
  X,
  CheckCircle2,
  Clock,
  Trash2,
  Copy,
  Sparkles,
  FileText,
  Edit2,
  Save,
  Check,
  Maximize2,
  RotateCw,
  Download,
  AlertTriangle,
  ZoomIn,
  Globe,
  ArrowRightLeft,
  Tag,
  BookOpen,
  ShieldCheck,
  Mail,
  Camera,
  UploadCloud,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { connectGoogleDrive, isGoogleDriveConnected } from "../lib/firebase";

interface ReceiptDetailModalProps {
  receipt: ReceiptItem | null;
  onClose: () => void;
  onUpdateReceipt: (updated: ReceiptItem) => void;
  onDeleteReceipt: (id: string) => void;
  /**
   * Enregistre un justificatif ajouté après coup (même logique que l'upload initial :
   * Google Drive, dossier par date, nom standardisé). Retourne true si l'envoi a réussi.
   */
  onAttachFile?: (
    receipt: ReceiptItem,
    file: { dataUrl: string; fileName: string; fileSize: string; fileType: "image" | "pdf" }
  ) => Promise<boolean>;
}

export const ReceiptDetailModal: React.FC<ReceiptDetailModalProps> = ({
  receipt,
  onClose,
  onUpdateReceipt,
  onDeleteReceipt,
  onAttachFile,
}) => {
  if (!receipt) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [localRotation, setLocalRotation] = useState(0);

  // Edit fields
  const [supplier, setSupplier] = useState(receipt.supplier);
  const [date, setDate] = useState(receipt.date);
  const [currency, setCurrency] = useState<string>(receipt.currency || "EUR");
  const [originalTotal, setOriginalTotal] = useState<number>(receipt.originalTotal ?? receipt.totalTTC);
  const [exchangeRate, setExchangeRate] = useState<number>(
    receipt.exchangeRate ?? (SUPPORTED_CURRENCIES[receipt.currency || "EUR"]?.defaultRateToEUR ?? 1.0)
  );
  const [totalTTC, setTotalTTC] = useState(receipt.totalTTC);
  const [vatAmount, setVatAmount] = useState(receipt.vatAmount);
  const [vatRate, setVatRate] = useState(receipt.vatRate);
  const [category, setCategory] = useState<ReceiptCategory>(receipt.category);
  const [expenseType, setExpenseType] = useState<string>(receipt.expenseType || "");
  const [accountingCode, setAccountingCode] = useState<string>(receipt.accountingCode || "");
  const [taxDeductibility, setTaxDeductibility] = useState<TaxDeductibility>(
    receipt.taxDeductibility || "deductible"
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(receipt.paymentMethod);
  const [invoiceNumber, setInvoiceNumber] = useState(receipt.invoiceNumber || "");
  const [notes, setNotes] = useState(receipt.notes || "");
  const [status, setStatus] = useState<"validé" | "en_attente">(receipt.status);
  const [localFileDataUrl, setLocalFileDataUrl] = useState(receipt.fileDataUrl);
  // Justificatif choisi mais pas encore enregistré (en attente du clic sur « Enregistrer »)
  const [pendingFile, setPendingFile] = useState<{
    dataUrl: string;
    fileName: string;
    fileSize: string;
    fileType: "image" | "pdf";
  } | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [, refreshDriveState] = useState(0);
  const preview = useReceiptPreview(localFileDataUrl, receipt.driveFileId, receipt.driveViewLink, receipt.fileType);
  const [imgBroken, setImgBroken] = useState(false);
  useEffect(() => setImgBroken(false), [preview.src]);
  const canShowImage = preview.status === "ready" && !!preview.src && !imgBroken;
  const hasDocument = Boolean(localFileDataUrl || preview.driveLink);
  const [showNoImageWarning, setShowNoImageWarning] = useState(false);

  // Sync state whenever receipt prop updates or changes (prevents stale status/data bugs)
  useEffect(() => {
    if (receipt) {
      setSupplier(receipt.supplier);
      setDate(receipt.date);
      setCurrency(receipt.currency || "EUR");
      setOriginalTotal(receipt.originalTotal ?? receipt.totalTTC);
      setExchangeRate(
        receipt.exchangeRate ??
          (SUPPORTED_CURRENCIES[receipt.currency || "EUR"]?.defaultRateToEUR ?? 1.0)
      );
      setTotalTTC(receipt.totalTTC);
      setVatAmount(receipt.vatAmount);
      setVatRate(receipt.vatRate);
      setCategory(receipt.category);
      setExpenseType(receipt.expenseType || "");
      setAccountingCode(receipt.accountingCode || "");
      setTaxDeductibility(receipt.taxDeductibility || "deductible");
      setPaymentMethod(receipt.paymentMethod);
      setInvoiceNumber(receipt.invoiceNumber || "");
      setNotes(receipt.notes || "");
      setStatus(receipt.status);
      setLocalFileDataUrl(receipt.fileDataUrl);
      setIsEditing(false);
      setIsConfirmingDelete(false);
      setShowNoImageWarning(false);
    }
  }, [receipt.id, receipt.status, receipt.totalTTC, receipt.supplier, receipt.date, receipt.fileDataUrl]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de re-choisir le même fichier
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachError(null);
      setPendingFile({
        dataUrl: event.target?.result as string,
        fileName: file.name,
        fileSize: `${Math.max(1, Math.round(file.size / 1024))} Ko`,
        fileType: file.type === "application/pdf" || /\.pdf$/i.test(file.name) ? "pdf" : "image",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSavePendingFile = async () => {
    if (!pendingFile || !onAttachFile || isAttaching) return;
    setIsAttaching(true);
    setAttachError(null);
    try {
      const ok = await onAttachFile(receipt, pendingFile);
      if (ok) setPendingFile(null);
      else setAttachError("L'envoi a échoué. Vérifiez la connexion à Google Drive puis réessayez.");
    } finally {
      setIsAttaching(false);
    }
  };

  const handleConnectDriveHere = async () => {
    setAttachError(null);
    try {
      const ok = await connectGoogleDrive();
      if (!ok) setAttachError("Accès Drive refusé : cochez la case Drive dans la fenêtre Google.");
    } catch (err: any) {
      setAttachError(`Connexion Drive impossible : ${String(err?.message || err).slice(0, 120)}`);
    } finally {
      refreshDriveState((n) => n + 1);
    }
  };

  const handleToggleStatusWithWarning = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = status === "validé" ? "en_attente" : "validé";
    
    // If we are validating and there is no image, show a warning
    if (newStatus === "validé" && !localFileDataUrl) {
      setShowNoImageWarning(true);
      return;
    }

    setStatus(newStatus);
    onUpdateReceipt({ ...receipt, status: newStatus });
  };

  const confirmValidationWithoutImage = () => {
    // Save all current edits if we are in edit mode
    const updatedStandardized = generateStandardizedFilename(
      date,
      supplier,
      totalTTC,
      receipt.fileName
    );

    const updated: ReceiptItem = {
      ...receipt,
      supplier,
      date,
      currency,
      originalTotal: currency === "EUR" ? Number(totalTTC) : Number(originalTotal),
      exchangeRate: currency === "EUR" ? 1.0 : Number(exchangeRate),
      totalTTC: Number(totalTTC) || 0,
      vatAmount: Number(vatAmount) || 0,
      vatRate,
      category,
      expenseType: expenseType.trim() || undefined,
      accountingCode: accountingCode.trim() || undefined,
      taxDeductibility,
      paymentMethod,
      invoiceNumber: invoiceNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      status: "validé",
      fileDataUrl: localFileDataUrl,
      standardizedName: updatedStandardized,
    };

    onUpdateReceipt(updated);
    setStatus("validé");
    setIsEditing(false);
    setShowNoImageWarning(false);
  };

  const handleCopyStandardizedName = () => {
    navigator.clipboard.writeText(receipt.standardizedName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCategoryChange = (newCat: ReceiptCategory) => {
    setCategory(newCat);
    const meta = CATEGORY_DEFINITIONS[newCat] || CATEGORY_DEFINITIONS["Autre"];
    setAccountingCode(meta.defaultPcgCode);
    setTaxDeductibility(meta.defaultDeductibility);
    if (meta.suggestedTypes.length > 0) {
      setExpenseType(meta.suggestedTypes[0]);
    }
  };

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    if (newCurrency === "EUR") {
      setExchangeRate(1.0);
      setTotalTTC(originalTotal);
      const calculated = Number((originalTotal - originalTotal / (1 + vatRate / 100)).toFixed(2));
      setVatAmount(calculated);
    } else {
      const defaultRate = SUPPORTED_CURRENCIES[newCurrency]?.defaultRateToEUR ?? 1.0;
      setExchangeRate(defaultRate);
      const computedEuro = Number((originalTotal * defaultRate).toFixed(2));
      setTotalTTC(computedEuro);
      const calculated = Number((computedEuro - computedEuro / (1 + vatRate / 100)).toFixed(2));
      setVatAmount(calculated);
    }
  };

  const handleOriginalTotalChange = (amount: number) => {
    setOriginalTotal(amount);
    if (currency === "EUR") {
      setTotalTTC(amount);
      const calculated = Number((amount - amount / (1 + vatRate / 100)).toFixed(2));
      setVatAmount(calculated);
    } else {
      const computedEuro = Number((amount * exchangeRate).toFixed(2));
      setTotalTTC(computedEuro);
      const calculated = Number((computedEuro - computedEuro / (1 + vatRate / 100)).toFixed(2));
      setVatAmount(calculated);
    }
  };

  const handleExchangeRateChange = (rate: number) => {
    setExchangeRate(rate);
    const computedEuro = Number((originalTotal * rate).toFixed(2));
    setTotalTTC(computedEuro);
    const calculated = Number((computedEuro - computedEuro / (1 + vatRate / 100)).toFixed(2));
    setVatAmount(calculated);
  };

  const handleSaveEdit = () => {
    // If we are validating and there is no image, show a warning instead of saving immediately
    if (status === "validé" && !localFileDataUrl) {
      setShowNoImageWarning(true);
      return;
    }

    const updatedStandardized = generateStandardizedFilename(
      date,
      supplier,
      totalTTC,
      receipt.fileName
    );

    const updated: ReceiptItem = {
      ...receipt,
      supplier,
      date,
      currency,
      originalTotal: currency === "EUR" ? Number(totalTTC) : Number(originalTotal),
      exchangeRate: currency === "EUR" ? 1.0 : Number(exchangeRate),
      totalTTC: Number(totalTTC) || 0,
      vatAmount: Number(vatAmount) || 0,
      vatRate,
      category,
      expenseType: expenseType.trim() || undefined,
      accountingCode: accountingCode.trim() || undefined,
      taxDeductibility,
      paymentMethod,
      invoiceNumber: invoiceNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      status,
      fileDataUrl: localFileDataUrl,
      standardizedName: updatedStandardized,
    };

    onUpdateReceipt(updated);
    setIsEditing(false);
  };

  const handleVatRateChange = (rate: number) => {
    setVatRate(rate);
    const calculated = Number((totalTTC - totalTTC / (1 + rate / 100)).toFixed(2));
    setVatAmount(calculated);
  };

  const handleTotalTTCChange = (amount: number) => {
    setTotalTTC(amount);
    const calculated = Number((amount - amount / (1 + vatRate / 100)).toFixed(2));
    setVatAmount(calculated);
  };

  const handleRotateImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalRotation((prev) => (prev + 90) % 360);
  };

  const handleDownloadImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!preview.src) return;
    const a = document.createElement("a");
    a.href = preview.src;
    a.download = receipt.standardizedName || receipt.fileName || "justificatif.jpg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const hasImage = Boolean(receipt.fileDataUrl || pendingFile);
  const currentCategoryMeta = getCategoryMetadata(category);
  const viewCategoryMeta = getCategoryMetadata(receipt.category);
  const deductBadge = getTaxDeductibilityBadge(receipt.taxDeductibility);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
        <div
          className={`relative w-full ${
            hasImage ? "max-w-4xl" : "max-w-xl"
          } rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden my-auto transition-all animate-in fade-in zoom-in-95`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950/70">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0">
                {getCategoryIcon(receipt.category)}
              </div>
              <div>
                <h3 className="font-semibold text-neutral-100 text-sm sm:text-base leading-tight">
                  {receipt.supplier}
                </h3>
                <p className="text-[11px] text-neutral-400">
                  {formatDateFrench(receipt.date)} • {receipt.category} • {formatEuro(receipt.totalTTC)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  isEditing
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                }`}
                title={isEditing ? "Mode affichage" : "Modifier les informations"}
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Delete Confirmation Alert Banner (In-UI, no blocked window.confirm) */}
          {isConfirmingDelete && (
            <div className="bg-rose-500/10 border-b border-rose-500/30 p-4 animate-in fade-in duration-150">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-rose-300">
                    Supprimer ce justificatif ?
                  </h4>
                  <p className="text-xs text-rose-400/90 mt-0.5">
                    Êtes-vous sûr de vouloir supprimer définitivement la pièce pour{" "}
                    <span className="font-bold text-rose-200">{receipt.supplier}</span> (
                    {formatEuro(receipt.totalTTC)}) ? Cette action est irréversible.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteReceipt(receipt.id);
                        onClose();
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-rose-900/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Oui, supprimer définitivement</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Missing Image Warning Banner */}
          {showNoImageWarning && (
            <div className="bg-amber-500/10 border-b border-amber-500/30 p-4 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-amber-300">
                    Valider sans pièce jointe ?
                  </h4>
                  <p className="text-xs text-amber-400/90 mt-0.5">
                    Ce reçu n'a pas de photo ou de document attaché. Bien que possible, il est fortement recommandé d'ajouter un justificatif pour votre comptabilité.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={confirmValidationWithoutImage}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-900/40"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Valider quand même</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNoImageWarning(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors cursor-pointer"
                    >
                      Ajouter une photo d'abord
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Body Content */}
          <div className="p-5 max-h-[78vh] overflow-y-auto">
            <div className={hasImage ? "grid grid-cols-1 md:grid-cols-12 gap-5" : "space-y-4"}>
              {/* LEFT COLUMN: LARGE RECEIPT PREVIEW or UPLOAD PLACEHOLDER */}
              <div className="md:col-span-6 flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Justificatif original</span>
                  </span>

                  {/* Actions : Drive toujours disponible, rotation/zoom seulement si l'aperçu s'affiche */}
                  {hasDocument && (
                    <div className="flex items-center gap-1">
                      {preview.driveLink && (
                        <a
                          href={preview.driveLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-medium transition-colors cursor-pointer"
                          title="Ouvrir le justificatif sur Google Drive"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Ouvrir sur Drive</span>
                        </a>
                      )}
                      {canShowImage && (
                        <>
                          <button
                            type="button"
                            onClick={handleRotateImage}
                            className="p-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs transition-colors cursor-pointer"
                            title="Pivoter de 90°"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadImage}
                            className="p-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs transition-colors cursor-pointer"
                            title="Télécharger l'original"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsImageViewerOpen(true)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-medium transition-colors cursor-pointer"
                            title="Ouvrir en plein écran"
                          >
                            <Maximize2 className="w-3 h-3" />
                            <span>Plein écran</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Interactive Big Preview Stage or Upload Area */}
                {pendingFile ? (
                  <div className="flex-1 min-h-[340px] md:min-h-[460px] rounded-xl bg-neutral-950 border border-emerald-500/40 overflow-hidden flex flex-col">
                    <div className="flex-1 flex items-center justify-center p-3 min-h-[220px]">
                      {pendingFile.fileType === "image" ? (
                        <img
                          src={pendingFile.dataUrl}
                          alt="Justificatif à enregistrer"
                          className="max-h-[360px] w-auto max-w-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-center">
                          <FileText className="w-10 h-10 text-neutral-500" aria-hidden="true" />
                          <p className="text-sm text-neutral-200 break-all px-4">{pendingFile.fileName}</p>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-neutral-800 p-3 space-y-2">
                      <p className="text-[11px] text-neutral-400 break-all">
                        {pendingFile.fileName} • {pendingFile.fileSize} — pas encore enregistré
                      </p>
                      {attachError && <p className="text-[11px] text-red-400">{attachError}</p>}
                      {!isGoogleDriveConnected() && (
                        <button
                          type="button"
                          onClick={handleConnectDriveHere}
                          className="w-full px-3 py-2 rounded-xl border border-neutral-700 text-neutral-200 text-xs font-bold hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                          Connecter Google Drive
                        </button>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPendingFile(null);
                            setAttachError(null);
                          }}
                          disabled={isAttaching}
                          className="px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 text-xs font-bold hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={handleSavePendingFile}
                          disabled={isAttaching}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-neutral-950 text-xs font-black uppercase tracking-widest hover:bg-emerald-400 transition-colors disabled:opacity-60 cursor-pointer"
                        >
                          {isAttaching ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Save className="w-4 h-4" aria-hidden="true" />
                          )}
                          {isAttaching ? "Envoi en cours…" : "Enregistrer le justificatif"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : hasDocument && !canShowImage ? (
                  <PreviewUnavailable driveLink={preview.driveLink} loading={preview.status === "loading"} />
                ) : localFileDataUrl || preview.src ? (
                  <div
                    onClick={() => setIsImageViewerOpen(true)}
                    className="group relative flex-1 min-h-[340px] md:min-h-[460px] rounded-xl bg-neutral-950 border border-neutral-800 overflow-hidden flex items-center justify-center cursor-zoom-in hover:border-neutral-700 transition-colors"
                  >
                    <img
                      src={preview.src || localFileDataUrl}
                      alt={receipt.supplier}
                      onError={() => setImgBroken(true)}
                      style={{
                        transform: `rotate(${localRotation}deg)`,
                        transition: "transform 0.2s ease-out",
                      }}
                      className="max-h-[440px] w-auto max-w-full object-contain p-2"
                    />

                    {/* Hover Overlay Hint */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <div className="px-3 py-1.5 rounded-full bg-neutral-900/90 border border-neutral-700 text-neutral-100 text-xs font-medium flex items-center gap-1.5 shadow-xl">
                        <ZoomIn className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Cliquer pour zoomer en grand</span>
                      </div>
                    </div>

                    {/* File type badge */}
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-neutral-900/90 border border-neutral-800 text-[10px] font-mono text-neutral-400">
                      {receipt.fileSize || "Image"} • {receipt.fileName}
                    </div>
                  </div>
                ) : (
                  <label className="group relative flex-1 min-h-[340px] md:min-h-[460px] rounded-xl bg-neutral-950 border-2 border-dashed border-neutral-800 hover:border-emerald-500/40 transition-all flex flex-col items-center justify-center cursor-pointer p-8 text-center">
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,application/pdf"
                      onChange={handleFileUpload}
                    />
                    <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 group-hover:text-emerald-400 group-hover:scale-110 transition-all mb-4">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <h4 className="text-neutral-200 font-bold mb-2">Aucun justificatif</h4>
                    <p className="text-xs text-neutral-500 max-w-[240px] leading-relaxed">
                      Cliquez ici pour uploader une photo ou un PDF de votre facture pour ce reçu vocal.
                    </p>
                    <div className="mt-6 px-5 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase tracking-widest group-hover:bg-emerald-500 group-hover:text-neutral-950 transition-all">
                      Uploader le document
                    </div>
                  </label>
                )}
              </div>

              {/* RIGHT COLUMN: ACCOUNTING DETAILS & FORM */}
              <div className={hasImage ? "md:col-span-6 space-y-4" : "space-y-4"}>
                {/* Status & Standardized Name Box */}
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-neutral-400">
                      Statut comptable :
                    </span>
                    <button
                      onClick={handleToggleStatusWithWarning}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        receipt.status === "validé"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30"
                      }`}
                    >
                      {receipt.status === "validé" ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Validé pour l'expert</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>En attente de contrôle</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Standardized filename */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-500 uppercase font-semibold">
                      <span>Fichier normalisé export :</span>
                      <button
                        onClick={handleCopyStandardizedName}
                        className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Copié</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copier nom</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="font-mono text-xs text-neutral-300 select-all break-all mt-0.5 bg-neutral-900/80 p-2 rounded-lg border border-neutral-800">
                      {receipt.standardizedName}
                    </div>
                  </div>
                </div>

                {/* VIEW MODE vs EDIT MODE */}
                {!isEditing ? (
                  <div className="space-y-4">
                    {/* Foreign Currency Banner if non-EUR */}
                    {receipt.currency && receipt.currency !== "EUR" && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                            <Globe className="w-3.5 h-3.5" />
                            <span>Devise d'origine du justificatif</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {receipt.currency}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between text-xs pt-1">
                          <span className="text-neutral-400">Montant imprimé sur pièce :</span>
                          <span className="font-mono font-bold text-amber-200 text-sm">
                            {formatCurrency(receipt.originalTotal ?? receipt.totalTTC, receipt.currency)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-neutral-400">Taux de change appliqué :</span>
                          <span className="font-mono text-neutral-300 text-xs">
                            1 {receipt.currency} = {receipt.exchangeRate ?? 0.92} €
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between text-xs pt-1.5 border-t border-amber-500/20">
                          <span className="text-emerald-400 font-medium">Contre-valeur comptable (€) :</span>
                          <span className="font-mono font-bold text-emerald-400 text-sm">
                            {formatEuro(receipt.totalTTC)} TTC
                            <span className="ml-1 text-[10px] font-normal text-emerald-500/80">(à titre indicatif)</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Amounts Grid */}
                    <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                      <div>
                        <div className="text-[10px] text-neutral-500">Montant HT (€)</div>
                        <div className="font-mono text-sm font-semibold text-neutral-200">
                          {formatEuro(receipt.totalTTC - receipt.vatAmount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-neutral-500">
                          TVA ({receipt.vatRate}%)
                        </div>
                        <div className="font-mono text-sm font-semibold text-emerald-400">
                          {formatEuro(receipt.vatAmount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-neutral-500">
                          Total TTC (€) {receipt.currency && receipt.currency !== "EUR" && <span className="text-amber-400/80 text-[9px]">*indicatif</span>}
                        </div>
                        <div className="font-mono text-base font-bold text-neutral-100">
                          {formatEuro(receipt.totalTTC)}
                        </div>
                      </div>
                    </div>

                    {/* Accounting & Tax Classification Card */}
                    <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200">
                          <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Classification Comptable & Fiscale</span>
                        </div>
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700/60 text-neutral-300">
                          PCG : {receipt.accountingCode || viewCategoryMeta.defaultPcgCode}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800/80">
                          <div className="text-[10px] text-neutral-500 font-medium mb-0.5">Catégorie</div>
                          <div className="flex items-center gap-1.5 font-medium text-neutral-200">
                            <span className={`w-2 h-2 rounded-full ${viewCategoryMeta.color.dot}`} />
                            <span className="truncate">{receipt.category}</span>
                          </div>
                        </div>

                        <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800/80">
                          <div className="text-[10px] text-neutral-500 font-medium mb-0.5">Compte PCG</div>
                          <div className="font-mono font-semibold text-neutral-200">
                            {receipt.accountingCode || viewCategoryMeta.defaultPcgCode}
                          </div>
                        </div>
                      </div>

                      {/* Precise Expense Type */}
                      <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800/80">
                        <div className="text-[10px] text-neutral-500 font-medium mb-0.5 flex items-center gap-1">
                          <Tag className="w-3 h-3 text-neutral-400" />
                          <span>Type de dépense précis</span>
                        </div>
                        <div className="text-neutral-200 font-medium text-xs">
                          {receipt.expenseType || viewCategoryMeta.suggestedTypes[0] || receipt.category}
                        </div>
                      </div>

                      {/* Tax Deductibility Badge & Explanation */}
                      <div className="p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-neutral-400 font-medium flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-neutral-400" />
                            <span>Régime fiscal TVA :</span>
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${deductBadge.badgeClass}`}>
                            {deductBadge.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 leading-tight">
                          {deductBadge.description}
                        </p>
                      </div>
                    </div>

                    {/* Details table */}
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-neutral-800/60">
                        <span className="text-neutral-400">Paiement :</span>
                        <span className="text-neutral-200 font-medium">{receipt.paymentMethod}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-neutral-800/60">
                        <span className="text-neutral-400">Réf. Transaction :</span>
                        <span className="font-mono text-neutral-200">{receipt.invoiceNumber || "—"}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-neutral-800/60">
                        <span className="text-neutral-400">Origine :</span>
                        <span className="flex items-center gap-1.5 text-neutral-200">
                          {receipt.source === "email" ? (
                            <>
                              <Mail className="w-3.5 h-3.5 text-violet-400" />
                              <span>Email Entrant</span>
                            </>
                          ) : receipt.source === "scan" ? (
                            <>
                              <Camera className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Scan Camera</span>
                            </>
                          ) : (
                            <>
                              <UploadCloud className="w-3.5 h-3.5 text-sky-400" />
                              <span>Import Fichier</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-neutral-800/60">
                        <span className="text-neutral-400">Fichier original :</span>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-neutral-300 truncate max-w-[200px]">{receipt.fileName}</span>
                          {receipt.driveViewLink && (
                            <a
                              href={receipt.driveViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"
                            >
                              <Globe className="w-3 h-3" />
                              <span>Voir sur Google Drive</span>
                            </a>
                          )}
                        </div>
                      </div>
                      {receipt.aiExtracted && (
                        <div className="flex justify-between py-1.5 border-b border-neutral-800/60">
                          <span className="text-neutral-400">Extraction IA :</span>
                          <span className="flex items-center gap-1 text-emerald-400 font-medium">
                            <Sparkles className="w-3 h-3" />
                            Groq Vision ({receipt.confidence || 98}%)
                          </span>
                        </div>
                      )}
                      {receipt.extractedLines && receipt.extractedLines.length > 0 && (
                        <div className="pt-2">
                          <span className="text-neutral-400 block mb-1 font-medium">Lignes lues par l'OCR :</span>
                          <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800/80 space-y-1 font-mono text-[11px] text-neutral-300 max-h-36 overflow-y-auto">
                            {receipt.extractedLines.map((line, i) => (
                              <div key={i} className="truncate">• {line}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      {receipt.notes && (
                        <div className="pt-1">
                          <span className="text-neutral-400 block mb-1">Notes & Contexte :</span>
                          <div className="p-2 rounded-lg bg-neutral-950/70 border border-neutral-800 text-neutral-300 italic">
                            "{receipt.notes}"
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* EDIT FORM */
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-neutral-400 font-medium mb-1">Fournisseur</label>
                      <input
                        type="text"
                        value={supplier}
                        onChange={(e) => setSupplier(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-neutral-400 font-medium mb-1">Date</label>
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-400 font-medium mb-1">Catégorie comptable</label>
                        <select
                          value={category}
                          onChange={(e) => handleCategoryChange(e.target.value as ReceiptCategory)}
                          className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100"
                        >
                          {ALL_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {CATEGORY_DEFINITIONS[cat]?.label || cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Accounting Classification Sub-section */}
                    <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2.5">
                      <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Classification comptable & TVA (France)</span>
                      </div>

                      <div>
                        <label className="block text-neutral-400 font-medium mb-1">
                          Type de dépense précis
                        </label>
                        <input
                          type="text"
                          value={expenseType}
                          onChange={(e) => setExpenseType(e.target.value)}
                          placeholder="ex: Billet de train (SNCF), Repas d'affaires..."
                          className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-100 text-xs"
                        />
                        {/* Suggestions chips from current category */}
                        {currentCategoryMeta.suggestedTypes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {currentCategoryMeta.suggestedTypes.map((st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => setExpenseType(st)}
                                className={`px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                                  expenseType === st
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                    : "bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-neutral-400 font-medium mb-1">
                            Compte PCG (Plan Comptable)
                          </label>
                          <input
                            type="text"
                            value={accountingCode}
                            onChange={(e) => setAccountingCode(e.target.value)}
                            placeholder="6256, 6251..."
                            className="w-full px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-100 font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-neutral-400 font-medium mb-1">
                            Régime de déductibilité TVA
                          </label>
                          <select
                            value={taxDeductibility}
                            onChange={(e) => setTaxDeductibility(e.target.value as TaxDeductibility)}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-100 text-xs"
                          >
                            {TAX_DEDUCTIBILITY_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Currency & Amount Selection */}
                    <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-neutral-400 font-medium mb-1">Devise du justificatif</label>
                          <select
                            value={currency}
                            onChange={(e) => handleCurrencyChange(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-100 font-medium"
                          >
                            {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.flag} {c.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {currency !== "EUR" ? (
                          <div>
                            <label className="block text-neutral-400 font-medium mb-1">
                              Montant en {currency} ({SUPPORTED_CURRENCIES[currency]?.symbol || currency})
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={originalTotal}
                              onChange={(e) => handleOriginalTotalChange(parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-amber-300 font-mono font-bold"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-neutral-400 font-medium mb-1">Total TTC (€)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={totalTTC}
                              onChange={(e) => handleTotalTTCChange(parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-100 font-mono font-bold"
                            />
                          </div>
                        )}
                      </div>

                      {currency !== "EUR" && (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800/80">
                          <div>
                            <label className="block text-neutral-400 font-medium mb-1 text-[11px]">
                              Taux de change (1 {currency} = X €)
                            </label>
                            <input
                              type="number"
                              step="0.0001"
                              value={exchangeRate}
                              onChange={(e) => handleExchangeRateChange(parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-200 font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-emerald-400 font-medium mb-1 text-[11px]">
                              Contre-valeur TTC (€) indicatif
                            </label>
                            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-xs flex items-center justify-between">
                              <span>{formatEuro(totalTTC)}</span>
                              <span className="text-[10px] text-emerald-400/70 font-normal">indicatif</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-neutral-400 font-medium mb-1">
                          {currency !== "EUR" ? "Montant TTC en € (indicatif)" : "Montant TTC (€)"}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={totalTTC}
                          onChange={(e) => handleTotalTTCChange(parseFloat(e.target.value) || 0)}
                          className={`w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 font-mono font-bold ${
                            currency !== "EUR" ? "text-emerald-400" : "text-neutral-100"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-400 font-medium mb-1">TVA déductible (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={vatAmount}
                          onChange={(e) => setVatAmount(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-emerald-400 font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {[20, 10, 5.5, 0].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => handleVatRateChange(rate)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                            vatRate === rate
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                          }`}
                        >
                          {rate}%
                        </button>
                      ))}
                    </div>

                    <div>
                      <label className="block text-neutral-400 font-medium mb-1">Notes</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100"
                      />
                    </div>

                    {/* Statut comptable explicite en mode édition */}
                    <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1.5">
                      <label className="block text-neutral-400 font-medium text-xs">
                        Statut de validation comptable
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setStatus("en_attente")}
                          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                            status === "en_attente"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm"
                              : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-300"
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>En attente</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatus("validé")}
                          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                            status === "validé"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm"
                              : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-300"
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Validé</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-medium cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-neutral-950 text-xs font-bold cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Sauvegarder
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Delete action */}
            <div className="pt-4 mt-4 border-t border-neutral-800 flex items-center justify-between">
              {!isConfirmingDelete ? (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition-colors cursor-pointer px-2 py-1.5 rounded-lg hover:bg-rose-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer ce reçu</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-400 font-medium">Confirmer la suppression :</span>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteReceipt(receipt.id);
                      onClose();
                    }}
                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Supprimer
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-300 text-xs hover:bg-neutral-700 cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* High-Resolution Full-Screen Lightbox Image Viewer */}
      {canShowImage && preview.src && (
        <ImageViewerModal
          isOpen={isImageViewerOpen}
          onClose={() => setIsImageViewerOpen(false)}
          imageUrl={preview.src}
          title={receipt.supplier}
          subtitle={`${formatDateFrench(receipt.date)} • ${formatEuro(receipt.totalTTC)}`}
          fileName={receipt.standardizedName || receipt.fileName}
        />
      )}
    </>
  );
};
