import React from "react";

interface LogoProps {
  size?: number;
  /** Affiche aussi le nom « ComptaSnap » à côté du symbole */
  withName?: boolean;
  nameClassName?: string;
}

/** Symbole ComptaSnap : un reçu dentelé avec son objectif. */
export const Logo: React.FC<LogoProps> = ({ size = 40, withName = false, nameClassName = "text-xl" }) => (
  <span className="inline-flex items-center gap-3">
    <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="Logo ComptaSnap">
      <path d="M14 8H82V86L70.67 76L59.33 86L48 76L36.67 86L25.33 76L14 86Z" style={{ fill: "var(--paper)" }} />
      <circle cx="48" cy="44" r="20" fill="#0E0F0C" />
      <circle cx="48" cy="44" r="8" fill="#C6F432" />
    </svg>
    {withName && (
      <span className={`font-extrabold tracking-[-0.04em] text-brand-snow ${nameClassName}`}>
        Compta<span className="text-brand-vibrant">Snap</span>
      </span>
    )}
  </span>
);
