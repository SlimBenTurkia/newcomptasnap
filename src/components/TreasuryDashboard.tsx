import React from "react";
import { TreasuryStats } from "../types";
import { formatEuro } from "../utils/formatters";

interface TreasuryDashboardProps {
  stats: TreasuryStats;
}

/** Trésorerie de la période : chiffre d'affaires, provision de charges, revenu net estimé. */
export const TreasuryDashboard: React.FC<TreasuryDashboardProps> = ({ stats }) => {
  const { totalRevenue, totalExpenses, estimatedCharges, netRevenue, taxRate } = stats;
  const chargePercentage = totalRevenue > 0 ? Math.min((estimatedCharges / totalRevenue) * 100, 100) : 0;

  return (
    <section aria-label="Trésorerie de la période">
      <div className="ticket">
        <div className="k">Chiffre d'affaires encaissé</div>
        <div className="text-[44px] sm:text-[52px] font-extrabold leading-none tracking-[-0.04em] my-1.5">
          {formatEuro(totalRevenue)}
        </div>

        <div className="h-2 mt-4 mb-3 bg-[var(--ink)]/15" role="img" aria-label={`Provision de charges : ${chargePercentage.toFixed(0)} % du chiffre d'affaires`}>
          <div className="h-full bg-[var(--ink)]" style={{ width: `${chargePercentage}%` }} />
        </div>

        <div className="leader"><span>Provision de charges ({taxRate} %)</span><i /><span>{formatEuro(estimatedCharges)}</span></div>
        <div className="leader"><span>Frais déduits</span><i /><span>−{formatEuro(totalExpenses)}</span></div>
        <div className="leader font-bold text-[17px] border-t-2 border-[var(--ink)] mt-1.5 pt-3">
          <span>Revenu net estimé</span><i /><span>{formatEuro(netRevenue)}</span>
        </div>
      </div>
    </section>
  );
};
