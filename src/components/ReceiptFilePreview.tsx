import React, { useEffect, useState } from "react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { fetchDriveImageObjectUrl, isGoogleDriveConnected } from "../lib/firebase";

const isDriveUrl = (url?: string | null) =>
  !!url && /^https?:\/\/(drive|docs)\.google\.com\//.test(url);

const driveIdFromUrl = (url?: string | null) => url?.match(/\/d\/([^/?#]+)/)?.[1];

export interface ReceiptPreviewState {
  /** URL affichable dans <img> (data:, blob: ou lien Firebase Storage) */
  src: string | null;
  status: "loading" | "ready" | "unavailable";
  /** Lien direct vers le justificatif dans Google Drive */
  driveLink?: string;
}

/**
 * Détermine comment afficher le justificatif :
 *  - data:/Firebase Storage  -> affiché tel quel
 *  - lien Google Drive       -> téléchargé via l'API Drive (si connecté) pour l'aperçu
 *  - sinon / PDF / échec     -> "unavailable" (on propose d'ouvrir Drive, pas d'encadré noir vide)
 */
export function useReceiptPreview(
  fileUrl: string | undefined | null,
  driveFileId: string | undefined | null,
  driveViewLink: string | undefined | null,
  fileType?: string
): ReceiptPreviewState {
  const driveLink = driveViewLink || (isDriveUrl(fileUrl) ? (fileUrl as string) : undefined);
  const isPdf = fileType === "pdf";
  const [state, setState] = useState<ReceiptPreviewState>({ src: null, status: "loading", driveLink });

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    if (isPdf) {
      setState({ src: null, status: "unavailable", driveLink });
      return;
    }

    if (fileUrl && !isDriveUrl(fileUrl)) {
      setState({ src: fileUrl, status: "ready", driveLink });
      return;
    }

    const id = driveFileId || driveIdFromUrl(driveLink);
    if (id && isGoogleDriveConnected()) {
      setState({ src: null, status: "loading", driveLink });
      fetchDriveImageObjectUrl(id).then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setState(url ? { src: url, status: "ready", driveLink } : { src: null, status: "unavailable", driveLink });
      });
    } else {
      setState({ src: null, status: "unavailable", driveLink });
    }

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileUrl, driveFileId, driveLink, isPdf]);

  return state;
}

interface PlaceholderProps {
  driveLink?: string;
  loading?: boolean;
}

/** Remplace l'encadré noir quand l'aperçu est impossible : un bouton clair vers le justificatif. */
export const PreviewUnavailable: React.FC<PlaceholderProps> = ({ driveLink, loading }) => (
  <div className="flex-1 min-h-[220px] rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col items-center justify-center gap-3 p-8 text-center">
    {loading ? (
      <Loader2 className="w-7 h-7 text-neutral-500 animate-spin" aria-hidden="true" />
    ) : (
      <FileText className="w-8 h-8 text-neutral-500" aria-hidden="true" />
    )}
    <p className="text-sm text-neutral-300">
      {loading ? "Chargement de l'aperçu…" : "Aperçu indisponible pour ce document"}
    </p>
    {!loading && driveLink && (
      <>
        <a
          href={driveLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-neutral-950 text-xs font-black uppercase tracking-widest hover:bg-emerald-400 transition-colors"
        >
          <ExternalLink className="w-4 h-4" aria-hidden="true" />
          Ouvrir sur Google Drive
        </a>
        {!isGoogleDriveConnected() && (
          <p className="text-[11px] text-neutral-500 max-w-[260px]">
            Connectez Google Drive (onglet Reçus) pour afficher l'aperçu directement ici.
          </p>
        )}
      </>
    )}
  </div>
);
