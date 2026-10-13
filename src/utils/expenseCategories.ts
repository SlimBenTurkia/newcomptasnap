import { ReceiptCategory, TaxDeductibility } from "../types";

export interface CategoryMetadata {
  id: ReceiptCategory;
  label: string;
  shortLabel: string;
  defaultPcgCode: string;
  defaultDeductibility: TaxDeductibility;
  color: {
    bg: string;
    text: string;
    border: string;
    dot: string;
  };
  suggestedTypes: string[];
}

export const CATEGORY_DEFINITIONS: Record<ReceiptCategory, CategoryMetadata> = {
  Restaurant: {
    id: "Restaurant",
    label: "Restauration & Repas d'affaires",
    shortLabel: "Restaurant",
    defaultPcgCode: "6256",
    defaultDeductibility: "deductible",
    color: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/30",
      dot: "bg-amber-400",
    },
    suggestedTypes: [
      "Repas d'affaires (invitation client)",
      "Repas individuel en mission",
      "Déjeuner d'équipe",
      "Pause café & collation",
      "Traiteur & cocktail événementiel",
    ],
  },
  Transport: {
    id: "Transport",
    label: "Déplacements & Transports",
    shortLabel: "Transport",
    defaultPcgCode: "6251",
    defaultDeductibility: "non_deductible",
    color: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
      dot: "bg-emerald-400",
    },
    suggestedTypes: [
      "Billet de train (SNCF / TGV)",
      "Billet d'avion professionnel",
      "Course Taxi / VTC (Uber, Bolt)",
      "Transports en commun (RATP, métro)",
      "Carburant & Station-service",
      "Péage autoroutier",
      "Stationnement & Parking",
    ],
  },
  Hébergement: {
    id: "Hébergement",
    label: "Hébergement & Hôtellerie",
    shortLabel: "Hôtel",
    defaultPcgCode: "6251",
    defaultDeductibility: "non_deductible",
    color: {
      bg: "bg-teal-500/10",
      text: "text-teal-400",
      border: "border-teal-500/30",
      dot: "bg-teal-400",
    },
    suggestedTypes: [
      "Hôtel & Nuitée en déplacement",
      "Location courte durée (Airbnb pro)",
      "Séjour séminaire / conférence",
      "Taxe de séjour",
    ],
  },
  Logiciel: {
    id: "Logiciel",
    label: "Logiciels, Cloud & SaaS",
    shortLabel: "Logiciel",
    defaultPcgCode: "6181",
    defaultDeductibility: "deductible",
    color: {
      bg: "bg-violet-500/10",
      text: "text-violet-400",
      border: "border-violet-500/30",
      dot: "bg-violet-400",
    },
    suggestedTypes: [
      "Abonnement Cloud / SaaS",
      "Licence bureautique & création",
      "Hébergement web & serveurs",
      "API & Services d'IA",
      "Nom de domaine & SSL",
      "Outils de gestion & comptabilité",
    ],
  },
  Matériel: {
    id: "Matériel",
    label: "Matériel & Équipement",
    shortLabel: "Matériel",
    defaultPcgCode: "6063",
    defaultDeductibility: "deductible",
    color: {
      bg: "bg-sky-500/10",
      text: "text-sky-400",
      border: "border-sky-500/30",
      dot: "bg-sky-400",
    },
    suggestedTypes: [
      "Ordinateur portable / PC fixe",
      "Écran & moniteur externe",
      "Smartphone professionnel",
      "Périphériques (souris, clavier, hub)",
      "Câblage & adaptateurs",
      "Petit outillage technique (< 500€ HT)",
    ],
  },
  Télécom: {
    id: "Télécom",
    label: "Télécoms & Internet",
    shortLabel: "Télécom",
    defaultPcgCode: "6260",
    defaultDeductibility: "deductible",
    color: {
      bg: "bg-indigo-500/10",
      text: "text-indigo-400",
      border: "border-indigo-500/30",
      dot: "bg-indigo-400",
    },
    suggestedTypes: [
      "Forfait mobile professionnel",
      "Abonnement Box Internet / Fibre",
      "Téléphonie fixe & standard virtuel",
      "Pass données / roaming étranger",
    ],
  },
  Fournitures: {
    id: "Fournitures",
    label: "Fournitures de bureau & Courrier",
    shortLabel: "Fournitures",
    defaultPcgCode: "6064",
    defaultDeductibility: "deductible",
    color: {
      bg: "bg-orange-500/10",
      text: "text-orange-400",
      border: "border-orange-500/30",
      dot: "bg-orange-400",
    },
    suggestedTypes: [
      "Papeterie, carnets & stylos",
      "Cartouches d'encre & toners",
      "Affranchissement & timbres (La Poste)",
      "Emballages & colis d'expédition",
      "Mobilier d'appoint & rangement",
    ],
  },
  Honoraires: {
    id: "Honoraires",
    label: "Honoraires & Sous-traitance",
    shortLabel: "Honoraires",
    defaultPcgCode: "6226",
    defaultDeductibility: "deductible",
    color: {
      bg: "bg-rose-500/10",
      text: "text-rose-400",
      border: "border-rose-500/30",
      dot: "bg-rose-400",
    },
    suggestedTypes: [
      "Honoraires Expert-Comptable",
      "Conseil juridique & Avocat",
      "Prestation freelance / Graphiste",
      "Développement & Maintenance externe",
      "Frais de formalités légales (greffe)",
    ],
  },
  Marketing: {
    id: "Marketing",
    label: "Marketing, Publicité & Salons",
    shortLabel: "Marketing",
    defaultPcgCode: "6230",
    defaultDeductibility: "deductible",
    color: {
      bg: "bg-pink-500/10",
      text: "text-pink-400",
      border: "border-pink-500/30",
      dot: "bg-pink-400",
    },
    suggestedTypes: [
      "Campagne Google Ads / Meta Ads",
      "Sponsoring & partenariats",
      "Impression flyers & cartes de visite",
      "Participation salon professionnel",
      "Objets publicitaires (goodies)",
    ],
  },
  "Frais bancaires": {
    id: "Frais bancaires",
    label: "Frais bancaires & Assurances",
    shortLabel: "Banque & Assur.",
    defaultPcgCode: "6270",
    defaultDeductibility: "sans_tva",
    color: {
      bg: "bg-yellow-500/10",
      text: "text-yellow-400",
      border: "border-yellow-500/30",
      dot: "bg-yellow-400",
    },
    suggestedTypes: [
      "Cotisation carte bancaire pro",
      "Commissions de tenue de compte",
      "Frais de change & virements",
      "Assurance Responsabilité Civile Pro (RC Pro)",
      "Mutuelle / Prévoyance entreprise",
    ],
  },
  Formation: {
    id: "Formation",
    label: "Formation & Documentation",
    shortLabel: "Formation",
    defaultPcgCode: "6184",
    defaultDeductibility: "sans_tva",
    color: {
      bg: "bg-cyan-500/10",
      text: "text-cyan-400",
      border: "border-cyan-500/30",
      dot: "bg-cyan-400",
    },
    suggestedTypes: [
      "Cours en ligne & MOOC professionnel",
      "Certification professionnelle",
      "Livres techniques & documentation",
      "Abonnement presse professionnelle",
    ],
  },
  Autre: {
    id: "Autre",
    label: "Autre charge d'exploitation",
    shortLabel: "Autre",
    defaultPcgCode: "6580",
    defaultDeductibility: "deductible",
    color: {
      bg: "bg-neutral-500/10",
      text: "text-neutral-400",
      border: "border-neutral-500/30",
      dot: "bg-neutral-400",
    },
    suggestedTypes: [
      "Charge courante diverse",
      "Cotisation professionnelle",
      "Nettoyage & entretien",
      "Frais non spécifiés",
    ],
  },
};

export const ALL_CATEGORIES: ReceiptCategory[] = [
  "Restaurant",
  "Transport",
  "Hébergement",
  "Logiciel",
  "Matériel",
  "Télécom",
  "Fournitures",
  "Honoraires",
  "Marketing",
  "Frais bancaires",
  "Formation",
  "Autre",
];

export function getCategoryMetadata(category: ReceiptCategory): CategoryMetadata {
  return CATEGORY_DEFINITIONS[category] || CATEGORY_DEFINITIONS["Autre"];
}

export const TAX_DEDUCTIBILITY_OPTIONS: { value: TaxDeductibility; label: string }[] = [
  { value: "deductible", label: "TVA Déductible (100%)" },
  { value: "partielle", label: "Déductible partielle (ex: Carburant)" },
  { value: "non_deductible", label: "Non déductible (art. 206 annexe II CGI)" },
  { value: "sans_tva", label: "Exonéré / Hors champ de TVA" },
];

export function getTaxDeductibilityBadge(status?: TaxDeductibility): {
  label: string;
  badgeClass: string;
  description: string;
} {
  switch (status) {
    case "deductible":
      return {
        label: "TVA 100% Déductible",
        badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        description: "TVA intégralement récupérable sur votre déclaration CA3",
      };
    case "partielle":
      return {
        label: "TVA Déductible partielle",
        badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        description: "Quote-part selon réglementation (ex: carburant essence / diesel)",
      };
    case "non_deductible":
      return {
        label: "TVA Non déductible",
        badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
        description: "Exclusion légale (art. 206 annexe II CGI : transports, nuitées hôtel)",
      };
    case "sans_tva":
    default:
      return {
        label: "Exonéré / Sans TVA",
        badgeClass: "bg-neutral-800 text-neutral-400 border-neutral-700/60",
        description: "Pas de TVA applicable (franchise, assurance, autoliquidation)",
      };
  }
}

/**
 * Fallback classification logic if OCR API or offline parsing is needed
 */
export function inferExpenseTypeFallback(
  supplier: string,
  category: ReceiptCategory
): { expenseType: string; accountingCode: string; taxDeductibility: TaxDeductibility } {
  const clean = (supplier || "").toLowerCase();

  // Restaurant
  if (category === "Restaurant" || clean.includes("restaurant") || clean.includes("brasserie") || clean.includes("boulangerie") || clean.includes("bistrot") || clean.includes("mcdonald") || clean.includes("starbucks")) {
    return {
      expenseType: "Repas d'affaires (invitation client)",
      accountingCode: "6256",
      taxDeductibility: "deductible",
    };
  }

  // Transport
  if (category === "Transport" || clean.includes("sncf") || clean.includes("tgv") || clean.includes("ouigo") || clean.includes("air france") || clean.includes("easyjet")) {
    const isTrainOrFlight = clean.includes("sncf") || clean.includes("tgv") || clean.includes("air france") || clean.includes("easyjet");
    return {
      expenseType: isTrainOrFlight ? "Billet de train grande ligne" : "Course VTC / Taxi pro",
      accountingCode: "6251",
      taxDeductibility: isTrainOrFlight ? "non_deductible" : "deductible",
    };
  }

  // Hébergement
  if (category === "Hébergement" || clean.includes("hotel") || clean.includes("hôtel") || clean.includes("accor") || clean.includes("ibis") || clean.includes("airbnb")) {
    return {
      expenseType: "Hôtel & Nuitée en déplacement",
      accountingCode: "6251",
      taxDeductibility: "non_deductible",
    };
  }

  // Logiciel
  if (category === "Logiciel" || clean.includes("figma") || clean.includes("adobe") || clean.includes("github") || clean.includes("openai") || clean.includes("notion") || clean.includes("aws") || clean.includes("google cloud") || clean.includes("microsoft")) {
    return {
      expenseType: "Abonnement logiciel SaaS / Cloud",
      accountingCode: "6181",
      taxDeductibility: "deductible",
    };
  }

  // Matériel
  if (category === "Matériel" || clean.includes("apple") || clean.includes("fnac") || clean.includes("ldlc") || clean.includes("darty") || clean.includes("dell")) {
    return {
      expenseType: "Achat matériel informatique & accessoires",
      accountingCode: "6063",
      taxDeductibility: "deductible",
    };
  }

  // Télécom
  if (category === "Télécom" || clean.includes("orange") || clean.includes("sfr") || clean.includes("bouygues") || clean.includes("free mobile")) {
    return {
      expenseType: "Forfait mobile / Box internet pro",
      accountingCode: "6260",
      taxDeductibility: "deductible",
    };
  }

  // Fournitures
  if (category === "Fournitures" || clean.includes("bureau") || clean.includes("officedepot") || clean.includes("top office") || clean.includes("la poste")) {
    return {
      expenseType: "Fournitures et papeterie de bureau",
      accountingCode: "6064",
      taxDeductibility: "deductible",
    };
  }

  // Default to category definition
  const meta = getCategoryMetadata(category);
  return {
    expenseType: meta.suggestedTypes[0] || meta.label,
    accountingCode: meta.defaultPcgCode,
    taxDeductibility: meta.defaultDeductibility,
  };
}
