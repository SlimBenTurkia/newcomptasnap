import React, { useState } from "react";
import { ReceiptItem } from "../types";
import {
  formatEuro,
  generateAccountingCSV,
  generateAccountingZip,
  triggerDownload,
} from "../utils/formatters";
import confetti from "canvas-confetti";
import {
  X,
  Sparkles,
  Download,
  Mail,
  FileSpreadsheet,
  CheckCircle2,
  FileArchive,
  Copy,
  Check,
  Send,
  ExternalLink,
  ShieldCheck,
  Printer,
} from "lucide-react";

interface MonthClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipts: ReceiptItem[];
  monthLabel: string;
  onMarkAllValidated?: () => void;
}

export const MonthClosingModal: React.FC<MonthClosingModalProps> = ({
  isOpen,
  onClose,
  receipts,
  monthLabel,
  onMarkAllValidated,
}) => {
  const [accountantEmail, setAccountantEmail] = useState("expert.comptable@cabinet-conseil.fr");
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [copiedEmailText, setCopiedEmailText] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "files" | "email">("summary");
  const [closingCelebrated, setClosingCelebrated] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalTTC = receipts.reduce((acc, r) => acc + r.totalTTC, 0);
  const totalVAT = receipts.reduce((acc, r) => acc + r.vatAmount, 0);
  const totalHT = totalTTC - totalVAT;
  const validatedCount = receipts.filter((r) => r.status === "validé").length;
  const pendingCount = receipts.length - validatedCount;

  // Category breakdown
  const categorySummary: Record<string, { count: number; total: number }> = {};
  for (const r of receipts) {
    if (!categorySummary[r.category]) {
      categorySummary[r.category] = { count: 0, total: 0 };
    }
    categorySummary[r.category].count += 1;
    categorySummary[r.category].total += r.totalTTC;
  }

  // Handle Export ZIP
  const handleDownloadZip = async () => {
    setIsExportingZip(true);
    setExportError(null);
    try {
      await generateAccountingZip(receipts, monthLabel);
      triggerCelebration();
    } catch (e) {
      console.error("ZIP generation error:", e);
      setExportError("Erreur lors de la création du fichier ZIP d'export");
    } finally {
      setIsExportingZip(false);
    }
  };

  // Handle Export CSV
  const handleDownloadCSV = () => {
    const csvData = generateAccountingCSV(receipts, monthLabel);
    triggerDownload(
      csvData,
      `Journal_Achats_${monthLabel.replace(/\s+/g, "_")}.csv`,
      "text/csv;charset=utf-8;"
    );
  };

  // Celebration Moment
  const triggerCelebration = () => {
    setClosingCelebrated(true);
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#10b981", "#34d399", "#059669", "#6ee7b7", "#ffffff"],
    });
  };

  // Email template for CPA
  const emailSubject = `[ComptaSnap] Justificatifs & Journal des Achats — ${monthLabel}`;
  const emailBody = `Bonjour,

Veuillez trouver ci-joint les pièces justificatives et le journal des achats pour la clôture du mois de ${monthLabel}.

SYNTHÈSE DE LA PÉRIODE (${monthLabel}) :
- Nombre de justificatifs : ${receipts.length}
- Total Dépenses TTC : ${formatEuro(totalTTC)}
- Total Montant HT : ${formatEuro(totalHT)}
- Total TVA Déductible : ${formatEuro(totalVAT)}

Tous les fichiers ont été renommés selon la nomenclature standard :
YYYY-MM-DD_FOURNISSEUR_MONTANT-EUR

Le journal comptable CSV et l'archive complète ZIP des pièces sont disponibles.

Bien cordialement,
Transmis via ComptaSnap`;

  const mailtoLink = `mailto:${accountantEmail}?subject=${encodeURIComponent(
    emailSubject
  )}&body=${encodeURIComponent(emailBody)}`;

  const handleCopyEmailText = () => {
    navigator.clipboard.writeText(emailBody);
    setCopiedEmailText(true);
    setTimeout(() => setCopiedEmailText(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden my-auto transition-all animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-neutral-100 text-base sm:text-lg">
                  Clôture & Dossier Comptable
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                  {monthLabel}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Formatage officiel prêt pour transmission à votre cabinet comptable
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning if unvalidated items remain */}
        {pendingCount > 0 && (
          <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-300">
            <span>
              Il reste <strong>{pendingCount} reçu(s) en attente</strong> de validation.
            </span>
            {onMarkAllValidated && (
              <button
                onClick={onMarkAllValidated}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Tout valider maintenant
              </button>
            )}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/40 px-5 text-xs font-medium">
          <button
            onClick={() => setActiveTab("summary")}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === "summary"
                ? "border-emerald-400 text-emerald-400 font-semibold"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Synthèse & Chiffres
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === "files"
                ? "border-emerald-400 text-emerald-400 font-semibold"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Nomenclature des Fichiers ({receipts.length})
          </button>
          <button
            onClick={() => setActiveTab("email")}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === "email"
                ? "border-emerald-400 text-emerald-400 font-semibold"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Transmission Expert-Comptable
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4 text-xs">
          {/* TAB 1: SUMMARY */}
          {activeTab === "summary" && (
            <div className="space-y-4">
              {/* Success summary alert banner */}
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="font-semibold text-emerald-300 text-sm">
                    Dossier de {monthLabel} prêt pour votre comptable !
                  </div>
                  <p className="text-neutral-300 text-[11px] leading-relaxed">
                    Toutes les pièces justificatives ({receipts.length} reçus, {formatEuro(totalTTC)} TTC) ont été renommées et compilées pour transmission immédiate au format CSV & archive ZIP.
                  </p>
                </div>
              </div>

              {/* Grand Totals Box */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-neutral-950 border border-neutral-800">
                <div>
                  <div className="text-neutral-500 text-[11px] mb-0.5">Total Dépenses TTC</div>
                  <div className="font-mono text-lg sm:text-xl font-bold text-neutral-100">
                    {formatEuro(totalTTC)}
                  </div>
                  <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                    {receipts.length} pièces justificatives
                  </div>
                </div>
                <div>
                  <div className="text-neutral-500 text-[11px] mb-0.5">Montant Net HT</div>
                  <div className="font-mono text-lg sm:text-xl font-bold text-neutral-300">
                    {formatEuro(totalHT)}
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">Charges déductibles</div>
                </div>
                <div>
                  <div className="text-neutral-500 text-[11px] mb-0.5">TVA Récupérable</div>
                  <div className="font-mono text-lg sm:text-xl font-bold text-emerald-400">
                    {formatEuro(totalVAT)}
                  </div>
                  <div className="text-[10px] text-emerald-500/80 mt-0.5">Crédit TVA déclaration</div>
                </div>
              </div>

              {/* Compliance Checklist */}
              <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-2">
                <div className="font-semibold text-neutral-200 flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Conformité fiscale & comptable</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-neutral-400 text-[11px]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Nomenclature YYYY-MM-DD standardisée</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Export CSV compatible FEC & Cegid/Sage</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Ventilation des taux TVA (20%, 10%, 5.5%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Bordereau de transmission récapitulatif</span>
                  </div>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="space-y-2">
                <div className="text-neutral-300 font-semibold text-xs">
                  Répartition par catégorie comptable :
                </div>
                <div className="space-y-1.5">
                  {Object.entries(categorySummary).map(([category, data]) => {
                    const percent = totalTTC > 0 ? Math.round((data.total / totalTTC) * 100) : 0;
                    return (
                      <div
                        key={category}
                        className="p-2.5 rounded-lg bg-neutral-950/50 border border-neutral-800/80 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium text-neutral-200">{category}</span>
                            <span className="font-mono text-neutral-400">
                              {formatEuro(data.total)} ({percent}%)
                            </span>
                          </div>
                          <div className="w-full bg-neutral-800 h-1 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-[10px] text-neutral-500 shrink-0 font-mono">
                          {data.count} {data.count > 1 ? "pièces" : "pièce"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FILES & NOMENCLATURE */}
          {activeTab === "files" && (
            <div className="space-y-3">
              <p className="text-neutral-400 text-xs">
                Chaque reçu est automatiquement reformaté avec la date, le fournisseur et le montant TTC pour éliminer tout rejet de pièce :
              </p>
              <div className="space-y-1.5 font-mono text-[11px]">
                {receipts.map((r, index) => (
                  <div
                    key={r.id}
                    className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-neutral-500 shrink-0">
                        {String(index + 1).padStart(2, "0")}.
                      </span>
                      <span className="text-emerald-400 truncate select-all">
                        {r.standardizedName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-neutral-300 font-bold">
                        {formatEuro(r.totalTTC)}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded ${
                          r.status === "validé"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        {r.status === "validé" ? "OK" : "ATTENTE"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: EMAIL CPA */}
          {activeTab === "email" && (
            <div className="space-y-3">
              <div>
                <label className="block text-neutral-400 font-medium mb-1">
                  Adresse de votre cabinet ou expert-comptable :
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={accountantEmail}
                    onChange={(e) => setAccountantEmail(e.target.value)}
                    placeholder="comptabilite@moncabinet.fr"
                    className="flex-1 px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 font-mono text-xs focus:outline-none focus:border-emerald-500/60"
                  />
                  <a
                    href={mailtoLink}
                    onClick={triggerCelebration}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Envoyer via Mail</span>
                  </a>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-neutral-400 font-medium">
                    Message pré-rédigé aux normes :
                  </span>
                  <button
                    onClick={handleCopyEmailText}
                    className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    {copiedEmailText ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Copié dans le presse-papier</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copier le texte</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {emailBody}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Error notice if export failed */}
        {exportError && (
          <div className="mx-5 mb-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
            <span>{exportError}</span>
            <button
              onClick={() => setExportError(null)}
              className="text-rose-400 hover:text-white text-xs font-semibold underline"
            >
              Fermer
            </button>
          </div>
        )}

        {/* Footer Actions — Download ZIP & CSV buttons */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Download CSV button */}
            <button
              onClick={handleDownloadCSV}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-medium text-xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export CSV Journal</span>
            </button>

            {/* Print/Bordereau preview */}
            <button
              onClick={() => window.print()}
              className="hidden xs:flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition-colors cursor-pointer"
              title="Imprimer le bordereau de remise"
            >
              <Printer className="w-4 h-4 text-neutral-400" />
            </button>
          </div>

          {/* Download ZIP Package Button (The magic moment action) */}
          <button
            onClick={handleDownloadZip}
            disabled={isExportingZip}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            <FileArchive className="w-4 h-4" />
            <span>
              {isExportingZip ? "Génération de l'archive..." : "Télécharger le Pack ZIP Clôture"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
