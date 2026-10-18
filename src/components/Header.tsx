import React from "react";
import { LogIn, LogOut, Sun, Moon } from "lucide-react";
import { PeriodSelector } from "./PeriodSelector";
import { Logo } from "./Logo";

import { PeriodSelection } from "../types";

interface HeaderProps {
  selectedPeriod: PeriodSelection;
  onSelectPeriod: (period: PeriodSelection) => void;
  availableMonths: { key: string; label: string; pureLabel: string; count: number }[];
  validatedCount: number;
  pendingCount: number;
  showOnlyPending: boolean;
  onTogglePendingFilter: () => void;
  totalCount: number;
  totalTTC: number;
  isFirebaseConnected?: boolean;
  currentUser?: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null;
  onSignInWithGoogle?: () => void;
  onSignOut?: () => void;
  onOpenClosing: () => void;
  onOpenProfile: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedPeriod,
  onSelectPeriod,
  availableMonths,
  pendingCount,
  showOnlyPending,
  onTogglePendingFilter,
  currentUser = null,
  onSignInWithGoogle,
  onSignOut,
  onOpenProfile,
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full bg-brand-deep border-b border-brand-snow/10 px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 shrink-0">
          <Logo size={32} withName nameClassName="hidden min-[400px]:inline text-lg" />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <PeriodSelector
            selectedPeriod={selectedPeriod}
            availableMonths={availableMonths}
            onSelect={onSelectPeriod}
          />

          <button
            onClick={onToggleTheme}
            className="p-2 sm:p-2.5 shrink-0 border border-brand-snow/15 text-brand-muted hover:text-brand-snow transition-colors cursor-pointer"
            title={theme === "dark" ? "Passer au mode clair" : "Passer au mode sombre"}
            aria-label={theme === "dark" ? "Passer au mode clair" : "Passer au mode sombre"}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {currentUser ? (
            <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-brand-snow/10 shrink-0">
              <button
                className="w-9 h-9 border border-brand-vibrant/60 overflow-hidden flex items-center justify-center font-mono text-xs font-bold text-brand-vibrant shrink-0 cursor-pointer"
                onClick={onOpenProfile}
                title={currentUser.email || currentUser.displayName || "Utilisateur connecté"}
                aria-label="Ouvrir mon profil"
              >
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span>{(currentUser.displayName || currentUser.email || "U")[0].toUpperCase()}</span>
                )}
              </button>
              <button
                onClick={onSignOut}
                className="p-2 sm:p-2.5 border border-brand-snow/15 text-brand-muted hover:text-brand-late hover:border-brand-late transition-colors cursor-pointer"
                title="Se déconnecter"
                aria-label="Se déconnecter"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={onSignInWithGoogle} className="btn h-10! text-sm!">
              <LogIn className="w-4 h-4" />
              <span>Connexion</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
