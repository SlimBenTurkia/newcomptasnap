import React from "react";
import { ReceiptItem } from "../types";
import { formatEuro } from "../utils/formatters";

interface ReceiptsSummaryProps {
  receipts: ReceiptItem[];
}

/**
 * Récapitulatif de la période, même présentation que la trésorerie de la page Factures :
 * gros montant, barre de progression, lignes à points de conduite, total souligné.
 */
export const ReceiptsSummary: React.FC<ReceiptsSummaryProps> = ({ receipts }) => {
  const expenses = receipts.filter((r) => r.transactionType !== "income");
  const totalTTC = expenses.reduce((acc, r) => acc + (Number(r.totalTTC) || 0), 0);
  const totalVAT = expenses.reduce((acc, r) => acc + (Number(r.vatAmount) || 0), 0);
  const totalHT = totalTTC - totalVAT;

  const count = expenses.length;
  const validated = expenses.filter((r) => r.status === "validé").length;
  const missingFile = expenses.filter((r) => !r.fileDataUrl && !r.driveFileId).length;
  const progress = count > 0 ? Math.round((validated / count) * 100) : 0;

  return (
    <section aria-label="Dépenses de la période">
      <div className="ticket">
        <div className="k">Dépenses de la période</div>
        <div className="text-[44px] sm:text-[52px] font-extrabold leading-none tracking-[-0.04em] my-1.5">
          {formatEuro(totalTTC)}
        </div>

        <div
          className="h-2 mt-4 mb-3 bg-[var(--ink)]/15"
          role="img"
          aria-label={`${validated} reçu${validated > 1 ? "s" : ""} validé${validated > 1 ? "s" : ""} sur ${count}`}
        >
          <div className="h-full bg-[var(--ink)]" style={{ width: `${progress}%` }} />
        </div>

        <div className="leader">
          <span>Reçus validés</span>
          <i />
          <span>
            {validated} / {count}
          </span>
        </div>
        <div className="leader">
          <span>TVA récupérable</span>
          <i />
          <span>{formatEuro(totalVAT)}</span>
        </div>
        <div className="leader">
          <span>Sans justificatif</span>
          <i />
          <span style={missingFile > 0 ? { color: "#C73A10", fontWeight: 700 } : undefined}>{missingFile}</span>
        </div>
        <div className="leader font-bold text-[17px] border-t-2 border-[var(--ink)] mt-1.5 pt-3">
          <span>Total HT</span>
          <i />
          <span>{formatEuro(totalHT)}</span>
        </div>
      </div>
    </section>
  );
};
