import React, { useState, useRef } from "react";
import {
  ReceiptItem,
  ReceiptCategory,
  PaymentMethod,
  TaxDeductibility,
} from "../types";
import {
  generateStandardizedFilename,
  formatEuro,
  formatCurrency,
  SUPPORTED_CURRENCIES,
  formatReceiptAmountDisplay,
} from "../utils/formatters";
import {
  CATEGORY_DEFINITIONS,
  ALL_CATEGORIES,
  getCategoryMetadata,
  getTaxDeductibilityBadge,
  TAX_DEDUCTIBILITY_OPTIONS,
  inferExpenseTypeFallback,
} from "../utils/expenseCategories";
import { TEST_SCAN_PRESETS } from "../data/mockReceipts";
import {
  X,
  UploadCloud,
  Camera,
  Sparkles,
  CheckCircle2,
  FileText,
  AlertCircle,
  RefreshCw,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Maximize2,
  ZoomIn,
  Globe,
  ArrowRightLeft,
  BookOpen,
  Tag,
  ShieldCheck,
} from "lucide-react";
import { ImageViewerModal } from "./ImageViewerModal";

import {
  processImageForOCR,
  ProcessedImage
} from "../utils/imageProcessing";

import { getApiUrl } from "../utils/api";

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveReceipt: (receipt: ReceiptItem) => void;
  defaultDate?: string;
  initialFile?: {file: File, source: "scan" | "upload"} | null;
}

export const ScanModal: React.FC<ScanModalProps> = ({
  isOpen,
  onClose,
  onSaveReceipt,
  defaultDate,
  initialFile,
}) => {
  const [step, setStep] = useState<"upload" | "processing" | "review">("upload");
  const [source, setSource] = useState<"scan" | "upload" | "email">("upload");
  const [processingStatus, setProcessingStatus] = useState("Numérisation du document...");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = useState("justificatif.pdf");
  const [fileType, setFileType] = useState<"image" | "pdf">("image");
  const [fileSize, setFileSize] = useState("320 Ko");

  // Editable Form State
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split("T")[0]);
  const [currency, setCurrency] = useState<string>("EUR");
  const [originalTotal, setOriginalTotal] = useState<number>(0);
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  const [totalTTC, setTotalTTC] = useState<number>(0);
  const [vatRate, setVatRate] = useState<number>(20);
  const [vatAmount, setVatAmount] = useState<number>(0);
  const [category, setCategory] = useState<ReceiptCategory>("Matériel");
  const [expenseType, setExpenseType] = useState<string>("");
  const [accountingCode, setAccountingCode] = useState<string>("6063");
  const [taxDeductibility, setTaxDeductibility] = useState<TaxDeductibility>("deductible");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Carte Bancaire");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [confidence, setConfidence] = useState(98);
  const [extractedByAI, setExtractedByAI] = useState(true);
  const [extractedLines, setExtractedLines] = useState<string[]>([]);
  const [rawOcrText, setRawOcrText] = useState<string>("");
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [showOcrDetails, setShowOcrDetails] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleCategoryChange = (newCat: ReceiptCategory) => {
    setCategory(newCat);
    const meta = CATEGORY_DEFINITIONS[newCat] || CATEGORY_DEFINITIONS["Autre"];
    setAccountingCode(meta.defaultPcgCode);
    setTaxDeductibility(meta.defaultDeductibility);
    if (meta.suggestedTypes.length > 0) {
      setExpenseType(meta.suggestedTypes[0]);
    }
  };

  // Handle VAT rate change & auto calculate VAT
  const handleVatRateChange = (rate: number) => {
    setVatRate(rate);
    const calculated = Number((totalTTC - totalTTC / (1 + rate / 100)).toFixed(2));
    setVatAmount(calculated);
  };

  const handleTotalTTCChange = (amount: number) => {
    setTotalTTC(amount);
    if (currency === "EUR") {
      setOriginalTotal(amount);
    }
    const calculated = Number((amount - amount / (1 + vatRate / 100)).toFixed(2));
    setVatAmount(calculated);
  };

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    if (newCurrency === "EUR") {
      setExchangeRate(1.0);
      const val = originalTotal || totalTTC;
      setTotalTTC(val);
      setOriginalTotal(val);
      const calculated = Number((val - val / (1 + vatRate / 100)).toFixed(2));
      setVatAmount(calculated);
    } else {
      const defaultRate = SUPPORTED_CURRENCIES[newCurrency]?.defaultRateToEUR ?? 1.0;
      setExchangeRate(defaultRate);
      const baseAmount = originalTotal > 0 ? originalTotal : totalTTC;
      setOriginalTotal(baseAmount);
      const computedEuro = Number((baseAmount * defaultRate).toFixed(2));
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

  // Process File Upload via Real Server / Gemini OCR or intelligent engine
  const processUploadedFile = async (file: File) => {
    if (!file) return;
    
    setOriginalFileName(file.name);
    setFileSize(`${Math.round(file.size / 1024)} Ko`);
    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
    setFileType(isPdf ? "pdf" : "image");
    setExtractionError(null);
    setStep("processing");

    // Read preview
    const reader = new FileReader();
    
    reader.onerror = () => {
      setExtractionError("Erreur lors de la lecture du fichier. Veuillez réessayer.");
      setStep("upload");
    };

    reader.onload = async () => {
      let base64Data = reader.result as string;
      setFilePreview(base64Data);

      setProcessingStatus("Moteur IA : Optimisation de l'image & correction de perspective...");

      // Optimize image if it's not a PDF
      if (!isPdf) {
        try {
          const optimized = await processImageForOCR(file, 1024, 1024, 0.65);
          base64Data = optimized.dataUrl;
          setFilePreview(base64Data);
          setFileSize(`${Math.round(optimized.optimizedSize / 1024)} Ko`);
          setProcessingStatus("Image optimisée pour l'IA (Scan-enhanced)...");
        } catch (err) {
          console.warn("Image optimization failed, using original:", err);
        }
      }

      // If it's a PDF, check size before sending as we don't optimize PDFs yet
      if (isPdf && file.size > 5 * 1024 * 1024) {
        setExtractionError("Le fichier PDF est trop volumineux (max 5 Mo pour les PDF). Veuillez utiliser une image ou un PDF plus léger.");
        setStep("review");
        return;
      }
      
      const t1 = setTimeout(() => setProcessingStatus("Lecture optique OCR haute précision..."), 1200);
      const t2 = setTimeout(() => setProcessingStatus("Extraction structurée des données comptables..."), 2400);

      try {
        const targetUrl = getApiUrl("/api/scan-receipt");
        console.log(`Appel OCR sur: ${targetUrl}`);
        
        // Timeout de 60 secondes pour éviter les blocages infinis
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(targetUrl, {
          method: "POST",
          mode: "cors",
          signal: controller.signal,
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            imageBase64: base64Data,
            mimeType: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
            fileName: file.name,
            options: { perspectiveCorrection: true }
          }),
        });

        clearTimeout(timeoutId);
        clearTimeout(t1);
        clearTimeout(t2);

        if (!response.ok) {
          let errorMessage = `Erreur (${response.status})`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            if (response.status === 504) errorMessage = "Le serveur a mis trop de temps à répondre (Timeout).";
            else if (response.status === 413) errorMessage = "L'image est trop volumineuse.";
          }
          throw new Error(errorMessage);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          console.error("Non-JSON response body:", text.substring(0, 1000));
          
          if (text.includes("<!DOCTYPE html>") || text.includes("<html")) {
            throw new Error(`Le serveur a renvoyé une page HTML au lieu de données JSON (Code: ${response.status}). Cela indique généralement une erreur de configuration du serveur ou un fichier trop volumineux.`);
          }
          
          throw new Error(`Réponse invalide du serveur (Code: ${response.status}). Format attendu: JSON, reçu: ${contentType || "inconnu"}`);
        }

        const result = await response.json();
        if (result.success && result.data) {
          const data = result.data;
          setSupplier(data.supplier || "Fournisseur non renseigné");
          setDate(data.date || new Date().toISOString().split("T")[0]);
          const cur = data.currency || "EUR";
          setCurrency(cur);
          const parsedTTC = Number(data.totalTTC) || 0;
          setTotalTTC(parsedTTC);
          const parsedOrig = Number(data.originalTotal) || parsedTTC;
          setOriginalTotal(parsedOrig);
          const parsedRate = Number(data.exchangeRate) || (SUPPORTED_CURRENCIES[cur]?.defaultRateToEUR ?? 1.0);
          setExchangeRate(parsedRate);

          const parsedVatRate = Number(data.vatRate) ?? 20;
          setVatRate(parsedVatRate);
          setVatAmount(Number(data.vatAmount) || (parsedTTC > 0 ? Number((parsedTTC - parsedTTC / (1 + parsedVatRate / 100)).toFixed(2)) : 0));
          const classifiedCategory = (data.category as ReceiptCategory) || "Matériel";
          setCategory(classifiedCategory);
          const fallbackClass = inferExpenseTypeFallback(data.supplier || "", classifiedCategory);
          setExpenseType(data.expenseType || fallbackClass.expenseType);
          setAccountingCode(data.accountingCode || fallbackClass.accountingCode);
          setTaxDeductibility((data.taxDeductibility as TaxDeductibility) || fallbackClass.taxDeductibility);
          setInvoiceNumber(data.invoiceNumber || "");
          setPaymentMethod((data.paymentMethod as PaymentMethod) || "Carte Bancaire");
          setConfidence(data.confidence || 96);
          setExtractedByAI(true);
          setExtractedLines(data.extractedLines || []);
          setRawOcrText(data.rawOcrText || "");
          setExtractionError(null);
        } else {
          // If server failed OCR explicitly
          setExtractionError(result.error || "Impossible d'extraire automatiquement ce document.");
          setSupplier("");
          setCurrency("EUR");
          setOriginalTotal(0);
          setExchangeRate(1.0);
          setTotalTTC(0);
          setVatAmount(0);
          setExpenseType("");
          setAccountingCode("6063");
          setTaxDeductibility("deductible");
          setExtractedByAI(false);
          setExtractedLines([]);
          setRawOcrText("");
        }
      } catch (err: any) {
        console.error("OCR API error:", err);
        setExtractionError(err.message || "Erreur réseau lors de la communication avec le moteur OCR.");
        setSupplier("");
        setCurrency("EUR");
        setOriginalTotal(0);
        setExchangeRate(1.0);
        setTotalTTC(0);
        setVatAmount(0);
        setExpenseType("");
        setAccountingCode("6063");
        setTaxDeductibility("deductible");
        setExtractedByAI(false);
      }

      setStep("review");
    };

    reader.readAsDataURL(file);
  };

  React.useEffect(() => {
    if (isOpen && initialFile) {
      setSource(initialFile.source);
      processUploadedFile(initialFile.file);
    }
  }, [isOpen, initialFile]);

  // Instant Test Preset Trigger (1 click test without needing to upload)
  const handleTestPreset = (preset: typeof TEST_SCAN_PRESETS[0]) => {
    setOriginalFileName(preset.fileName);
    setFileType(preset.fileName.endsWith(".pdf") ? "pdf" : "image");
    setFileSize("180 Ko");
    setFilePreview(null);
    setExtractionError(null);
    setSource("upload");
    setStep("processing");

    setProcessingStatus("Chargement du justificatif de démonstration...");
    setTimeout(() => {
      setProcessingStatus("Lecture des lignes comptables réelles...");
    }, 400);

    setTimeout(() => {
      setSupplier(preset.supplier);
      setDate(new Date().toISOString().split("T")[0]);
      const cur = (preset as any).currency || "EUR";
      setCurrency(cur);
      const orig = (preset as any).originalTotal ?? preset.totalTTC;
      setOriginalTotal(orig);
      const exRate = (preset as any).exchangeRate ?? 1.0;
      setExchangeRate(exRate);
      setTotalTTC(preset.totalTTC);
      setVatRate(preset.vatRate);
      const vat = Number((preset.totalTTC - preset.totalTTC / (1 + preset.vatRate / 100)).toFixed(2));
      setVatAmount(vat);
      setCategory(preset.category);
      const fallbackPreset = inferExpenseTypeFallback(preset.supplier, preset.category);
      setExpenseType((preset as any).expenseType || fallbackPreset.expenseType);
      setAccountingCode((preset as any).accountingCode || fallbackPreset.accountingCode);
      setTaxDeductibility(((preset as any).taxDeductibility as TaxDeductibility) || fallbackPreset.taxDeductibility);
      setInvoiceNumber(preset.invoiceNumber);
      setNotes(preset.description);
      setConfidence(99);
      setExtractedByAI(true);
      setExtractedLines([
        `Document: ${preset.label}`,
        `Fournisseur: ${preset.supplier}`,
        cur !== "EUR"
          ? `Montant original: ${orig} ${cur} ➔ Converti en ${preset.totalTTC} € TTC (TVA ${preset.vatRate}%)`
          : `Total payé: ${preset.totalTTC} € TTC (TVA ${preset.vatRate}%)`,
      ]);
      setRawOcrText(`${preset.supplier} - ${preset.description}`);
      setStep("review");
    }, 800);
  };

  // Save as Validated or Pending
  const handleSave = (status: "validé" | "en_attente") => {
    if (!supplier.trim()) {
      setValidationError("Veuillez renseigner le nom du fournisseur / commerçant");
      return;
    }

    setValidationError(null);

    const standardized = generateStandardizedFilename(
      date,
      supplier,
      totalTTC,
      originalFileName
    );

    const newReceipt: ReceiptItem = {
      id: "rec-" + Date.now().toString(36),
      supplier: supplier.trim(),
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
      status,
      paymentMethod,
      invoiceNumber: invoiceNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      fileDataUrl: filePreview || undefined,
      fileName: originalFileName,
      fileType,
      fileSize,
      standardizedName: standardized,
      aiExtracted: extractedByAI,
      confidence,
      extractedLines: extractedLines.length > 0 ? extractedLines : undefined,
      rawOcrText: rawOcrText || undefined,
      extractionSource: extractedByAI ? "groq-ai" : "fallback",
      source,
      createdAt: new Date().toISOString(),
    };

    onSaveReceipt(newReceipt);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setStep("upload");
    setFilePreview(null);
    setSupplier("");
    setCurrency("EUR");
    setOriginalTotal(0);
    setExchangeRate(1.0);
    setTotalTTC(0);
    setVatAmount(0);
    setExpenseType("");
    setAccountingCode("6063");
    setTaxDeductibility("deductible");
    setNotes("");
    setExtractedLines([]);
    setRawOcrText("");
    setExtractionError(null);
    setValidationError(null);
    setIsImageViewerOpen(false);
  };

  const currentStandardizedName = generateStandardizedFilename(
    date,
    supplier || "FOURNISSEUR",
    totalTTC,
    originalFileName
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden my-auto transition-all animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-100 text-sm sm:text-base">
                {step === "upload" && "Scanner un justificatif"}
                {step === "processing" && "Analyse IA en cours..."}
                {step === "review" && "Vérification & Validation comptable"}
              </h3>
            </div>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 max-h-[80vh] overflow-y-auto">
          {/* STEP 1: UPLOAD / CAMERA / PRESETS */}
          {step === "upload" && (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    setSource("upload");
                    processUploadedFile(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-neutral-700 hover:border-emerald-500/60 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer bg-neutral-950/40 hover:bg-neutral-950/80 transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 group-hover:text-emerald-400 group-hover:border-emerald-500/40 transition-all mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <h4 className="font-semibold text-neutral-200 text-sm mb-1">
                  Déposez votre facture ou ticket de caisse
                </h4>
                <p className="text-xs text-neutral-500 max-w-xs mb-3">
                  Glissez un fichier ici, ou cliquez pour parcourir (PNG, JPG, PDF jusqu'à 20 Mo)
                </p>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-medium border border-neutral-700">
                  <FileText className="w-3.5 h-3.5 text-neutral-400" />
                  Choisir un fichier
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processUploadedFile(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {/* Mobile Camera Direct Button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-medium text-xs transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>Prendre une photo (Appareil photo mobile)</span>
                </button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processUploadedFile(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {/* 1-Click Test Presets */}
              <div className="pt-2 border-t border-neutral-800">
                <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                  <span className="font-medium">Ou tester en 1 clic avec un justificatif type :</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Prêt à tester</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {TEST_SCAN_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleTestPreset(preset)}
                      className="flex flex-col text-left p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800 hover:border-emerald-500/40 hover:bg-neutral-950 transition-all cursor-pointer group"
                    >
                      <span className="font-semibold text-xs text-neutral-200 group-hover:text-emerald-300 transition-colors truncate">
                        {preset.label}
                      </span>
                      <span className="text-[11px] text-neutral-500 truncate">
                        {preset.supplier} • {formatEuro(preset.totalTTC)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SCANNING LASER ANIMATION */}
          {step === "processing" && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-5">
              {/* Receipt mockup with animated scanning laser beam */}
              <div className="relative w-44 h-56 rounded-xl bg-neutral-950 border border-neutral-700 p-3 shadow-2xl overflow-hidden flex flex-col justify-between">
                {/* Laser scan bar */}
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] animate-pulse top-1/2 -translate-y-1/2" />
                <div className="w-full h-full border border-dashed border-emerald-500/40 rounded-lg p-2.5 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="h-3 w-16 bg-neutral-800 rounded animate-pulse" />
                    <div className="h-2 w-28 bg-neutral-800/80 rounded animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 w-full bg-neutral-800/60 rounded" />
                    <div className="h-2 w-3/4 bg-neutral-800/60 rounded" />
                    <div className="h-2 w-1/2 bg-neutral-800/60 rounded" />
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-neutral-800">
                    <div className="h-3 w-10 bg-neutral-800 rounded" />
                    <div className="h-3 w-14 bg-emerald-500/30 rounded" />
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-semibold">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Traitement Groq Vision</span>
                </div>
                <p className="text-xs text-neutral-400 animate-pulse">
                  {processingStatus}
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & EDIT FORM */}
          {step === "review" && (
            <div className="space-y-4">
              {/* Error or Success notification */}
              {extractionError ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-200">Lecture automatique partielle ou impossible</p>
                    <p className="text-[11px] text-amber-300/80 mt-0.5">{extractionError}</p>
                    <p className="text-[11px] text-neutral-400 mt-1">Vous pouvez compléter ou corriger les champs ci-dessous manuellement.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-medium text-emerald-300">
                      Données extraites du document avec succès ({confidence}% confiance)
                    </span>
                  </div>
                  <button
                    onClick={() => setStep("upload")}
                    className="text-neutral-400 hover:text-neutral-200 underline text-[11px]"
                  >
                    Changer
                  </button>
                </div>
              )}

              {/* Uploaded Receipt Document Preview with Zoom */}
              {filePreview && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-950 border border-neutral-800">
                  <div
                    onClick={() => setIsImageViewerOpen(true)}
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
                  >
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-neutral-800 shrink-0 bg-neutral-900 flex items-center justify-center">
                      <img
                        src={filePreview}
                        alt="Aperçu"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ZoomIn className="w-4 h-4 text-emerald-400" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-200 truncate group-hover:text-emerald-400 transition-colors">
                        {originalFileName}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        {fileSize} • Cliquez pour inspecter le document en grand
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsImageViewerOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs border border-neutral-800 transition-colors cursor-pointer shrink-0"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden xs:inline">Agrandir</span>
                  </button>
                </div>
              )}

              {/* OCR Proof & Extracted lines inspection */}
              {(extractedLines.length > 0 || rawOcrText) && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowOcrDetails(!showOcrDetails)}
                    className="w-full px-3 py-2 flex items-center justify-between text-left text-neutral-300 hover:bg-neutral-800/40 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-medium text-[11px] text-neutral-200">
                        Lignes réelles lues sur votre justificatif ({extractedLines.length} éléments)
                      </span>
                    </div>
                    {showOcrDetails ? (
                      <ChevronUp className="w-3.5 h-3.5 text-neutral-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                    )}
                  </button>

                  {showOcrDetails && (
                    <div className="p-3 border-t border-neutral-800/80 bg-neutral-950 space-y-2 text-[11px]">
                      {extractedLines.length > 0 && (
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider mb-1">
                            Lignes détectées :
                          </div>
                          <div className="space-y-1">
                            {extractedLines.map((line, idx) => (
                              <div
                                key={idx}
                                className="px-2 py-1 rounded bg-neutral-900 border border-neutral-800/60 font-mono text-neutral-300 text-[10px]"
                              >
                                {line}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {rawOcrText && (
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider mb-1">
                            Texte brut repéré :
                          </div>
                          <div className="p-2 rounded bg-neutral-900/80 text-neutral-400 font-mono text-[10px] leading-relaxed break-words">
                            {rawOcrText}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Standardized filename preview pill */}
              <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800">
                <div className="text-[10px] uppercase font-semibold tracking-wider text-neutral-500 mb-1">
                  Renommage aux normes comptables :
                </div>
                <div className="font-mono text-xs text-emerald-400 break-all select-all font-medium">
                  {currentStandardizedName}
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Fournisseur */}
                <div className="sm:col-span-2">
                  <label htmlFor="scan-supplier" className="block text-neutral-400 font-medium mb-1">
                    Fournisseur / Commerçant *
                  </label>
                  <input
                    id="scan-supplier"
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="ex: SNCF Voyageurs, Apple Store, Figma"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-sm font-medium focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30"
                  />
                </div>

                {/* Date */}
                <div>
                  <label htmlFor="scan-date" className="block text-neutral-400 font-medium mb-1">
                    Date de la dépense *
                  </label>
                  <input
                    id="scan-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs font-medium focus:outline-none focus:border-emerald-500/60"
                  />
                </div>

                {/* Catégorie */}
                <div>
                  <label htmlFor="scan-category" className="block text-neutral-400 font-medium mb-1">
                    Catégorie comptable *
                  </label>
                  <select
                    id="scan-category"
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value as ReceiptCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs font-medium focus:outline-none focus:border-emerald-500/60 cursor-pointer"
                  >
                    {ALL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_DEFINITIONS[cat]?.label || cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Accounting & Tax Classification Card */}
                {(() => {
                  const meta = getCategoryMetadata(category);
                  const deductBadge = getTaxDeductibilityBadge(taxDeductibility);
                  return (
                    <div className="sm:col-span-2 p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200">
                          <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Classification Comptable & Fiscale (PCG & TVA)</span>
                        </div>
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700/60 text-emerald-300">
                          Compte PCG {accountingCode || meta.defaultPcgCode}
                        </span>
                      </div>

                      {/* Precise Expense Type */}
                      <div>
                        <label htmlFor="scan-expense-type" className="block text-neutral-400 font-medium mb-1 text-[11px] flex items-center gap-1">
                          <Tag className="w-3 h-3 text-neutral-400" />
                          <span>Type de dépense précis</span>
                        </label>
                        <input
                          id="scan-expense-type"
                          type="text"
                          value={expenseType}
                          onChange={(e) => setExpenseType(e.target.value)}
                          placeholder="ex: Billet de train (SNCF), Repas d'affaires, Hébergement web..."
                          className="w-full px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-emerald-500/60"
                        />
                        {/* Suggestions chips from current category */}
                        {meta.suggestedTypes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {meta.suggestedTypes.map((st) => (
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

                      {/* PCG Code & Tax Deductibility Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="scan-pcg-code" className="block text-neutral-400 font-medium mb-1 text-[11px]">
                            Code PCG (Plan Comptable Général)
                          </label>
                          <input
                            id="scan-pcg-code"
                            type="text"
                            value={accountingCode}
                            onChange={(e) => setAccountingCode(e.target.value)}
                            placeholder="6256, 6251..."
                            className="w-full px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-100 font-mono text-xs focus:outline-none focus:border-emerald-500/60"
                          />
                        </div>

                        <div>
                          <label htmlFor="scan-tax-deductibility" className="block text-neutral-400 font-medium mb-1 text-[11px] flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-neutral-400" />
                            <span>Déductibilité TVA</span>
                          </label>
                          <select
                            id="scan-tax-deductibility"
                            value={taxDeductibility}
                            onChange={(e) => setTaxDeductibility(e.target.value as TaxDeductibility)}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-emerald-500/60 cursor-pointer"
                          >
                            {TAX_DEDUCTIBILITY_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Explanatory note */}
                      <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800/60 text-[10px] text-neutral-400 flex items-start gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border shrink-0 ${deductBadge.badgeClass}`}>
                          {deductBadge.label}
                        </span>
                        <span className="leading-tight">{deductBadge.description}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Foreign Currency Alert Banner if non-EUR */}
                {currency !== "EUR" && (
                  <div className="sm:col-span-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
                    <Globe className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <div className="font-semibold text-amber-200">
                        Devise détectée : {currency} ({SUPPORTED_CURRENCIES[currency]?.label || currency})
                      </div>
                      <div className="text-neutral-300 text-[11px] leading-relaxed">
                        Montant sur justificatif : <strong className="text-amber-300 font-mono">{formatCurrency(originalTotal, currency)}</strong>
                        {" ➔ "}
                        Contre-valeur estimée : <strong className="text-emerald-400 font-mono">{formatEuro(totalTTC)}</strong> TTC (à titre indicatif en comptabilité française).
                      </div>
                    </div>
                  </div>
                )}

                {/* Devise */}
                <div>
                  <label htmlFor="scan-currency" className="block text-neutral-400 font-medium mb-1">
                    Devise du justificatif
                  </label>
                  <select
                    id="scan-currency"
                    value={currency}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs font-medium focus:outline-none focus:border-emerald-500/60 cursor-pointer"
                  >
                    {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.label} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Montant Original ou Montant TTC EUR */}
                {currency !== "EUR" ? (
                  <div>
                    <label htmlFor="scan-original-total" className="block text-neutral-400 font-medium mb-1">
                      Montant en {currency} ({SUPPORTED_CURRENCIES[currency]?.symbol || currency})
                    </label>
                    <div className="relative">
                      <input
                        id="scan-original-total"
                        type="number"
                        step="0.01"
                        value={originalTotal || ""}
                        onChange={(e) => handleOriginalTotalChange(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-amber-300 font-mono text-sm font-bold focus:outline-none focus:border-emerald-500/60"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-amber-400/80 font-mono">
                        {currency}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="scan-total-ttc" className="block text-neutral-400 font-medium mb-1">
                      Montant TTC (€) *
                    </label>
                    <div className="relative">
                      <input
                        id="scan-total-ttc"
                        type="number"
                        step="0.01"
                        value={totalTTC || ""}
                        onChange={(e) => handleTotalTTCChange(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 font-mono text-sm font-bold focus:outline-none focus:border-emerald-500/60"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500 font-mono">
                        EUR
                      </span>
                    </div>
                  </div>
                )}

                {/* Si devise étrangère : Taux de change et Contre-valeur TTC en € */}
                {currency !== "EUR" && (
                  <div className="sm:col-span-2 grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800/80">
                    <div>
                      <label htmlFor="scan-exchange-rate" className="block text-neutral-400 font-medium mb-1 text-[11px]">
                        Taux de change (1 {currency} = X €)
                      </label>
                      <input
                        id="scan-exchange-rate"
                        type="number"
                        step="0.0001"
                        value={exchangeRate || ""}
                        onChange={(e) => handleExchangeRateChange(parseFloat(e.target.value) || 0)}
                        placeholder="0.92"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-200 font-mono text-xs focus:outline-none focus:border-emerald-500/60"
                      />
                    </div>
                    <div>
                      <span className="block text-emerald-400 font-medium mb-1 text-[11px]">
                        Contre-valeur TTC (€) indicatif
                      </span>
                      <div className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-xs flex items-center justify-between">
                        <span>{formatEuro(totalTTC)}</span>
                        <span className="text-[10px] font-normal text-emerald-400/70">indicatif</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Montant TTC (€) if non-EUR, allows manual edit if wanted */}
                {currency !== "EUR" && (
                  <div>
                    <label htmlFor="scan-total-ttc" className="block text-neutral-400 font-medium mb-1">
                      Total TTC en € (retenu)
                    </label>
                    <div className="relative">
                      <input
                        id="scan-total-ttc"
                        type="number"
                        step="0.01"
                        value={totalTTC || ""}
                        onChange={(e) => handleTotalTTCChange(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-emerald-400 font-mono text-sm font-bold focus:outline-none focus:border-emerald-500/60"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500 font-mono">
                        EUR
                      </span>
                    </div>
                  </div>
                )}

                {/* TVA Taux & Montant */}
                <div>
                  <label htmlFor="scan-vat-amount" className="block text-neutral-400 font-medium mb-1">
                    TVA estimée (€)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="scan-vat-amount"
                      type="number"
                      step="0.01"
                      value={vatAmount || ""}
                      onChange={(e) => setVatAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-emerald-400 font-mono text-xs font-bold focus:outline-none focus:border-emerald-500/60"
                    />
                  </div>
                  {/* Quick VAT rate selector chips */}
                  <div className="flex items-center gap-1 mt-1.5">
                    {[20, 10, 5.5, 0].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => handleVatRateChange(rate)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                          vatRate === rate
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                            : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode de paiement */}
                <div>
                  <label htmlFor="scan-payment-method" className="block text-neutral-400 font-medium mb-1">
                    Moyen de paiement
                  </label>
                  <select
                    id="scan-payment-method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs font-medium focus:outline-none focus:border-emerald-500/60 cursor-pointer"
                  >
                    <option value="Carte Bancaire">Carte Bancaire Pro</option>
                    <option value="Virement">Virement bancaire</option>
                    <option value="Prélèvement">Prélèvement automatique</option>
                    <option value="Apple Pay">Apple Pay / Google Pay</option>
                    <option value="Espèces">Espèces</option>
                  </select>
                </div>

                {/* Numéro de pièce */}
                <div>
                  <label htmlFor="scan-invoice-number" className="block text-neutral-400 font-medium mb-1">
                    Réf. Facture / Ticket
                  </label>
                  <input
                    id="scan-invoice-number"
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="FAC-2026-09..."
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs font-mono focus:outline-none focus:border-emerald-500/60"
                  />
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label htmlFor="scan-notes" className="block text-neutral-400 font-medium mb-1">
                    Justification / Contexte (utile en cas de contrôle fiscal)
                  </label>
                  <input
                    id="scan-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ex: Déplacement client chez Acme Corp, repas d'affaires"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              </div>

              {/* Validation error if supplier missing */}
              {validationError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-neutral-800 flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSave("en_attente")}
                  className="w-full flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  <span>Enregistrer le justificatif</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full screen image inspector modal */}
      {filePreview && (
        <ImageViewerModal
          isOpen={isImageViewerOpen}
          onClose={() => setIsImageViewerOpen(false)}
          imageUrl={filePreview}
          title={originalFileName}
        />
      )}
    </div>
  );
};
