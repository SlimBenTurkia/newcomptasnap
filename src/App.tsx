import React, { useState, useEffect, useMemo, useRef } from "react";
import { ReceiptItem, UserProfile, TreasuryStats, IssuedInvoice, PeriodSelection, PeriodType } from "./types";
import { INITIAL_RECEIPTS } from "./data/mockReceipts";
import { Header } from "./components/Header";
import { MonthStats } from "./components/MonthStats";
import { TreasuryDashboard } from "./components/TreasuryDashboard";
import { ReceiptList } from "./components/ReceiptList";
import { InvoiceList } from "./components/InvoiceList";
import { GenerateInvoiceModal } from "./components/GenerateInvoiceModal";
import { ScanModal } from "./components/ScanModal";
import { ReceiptDetailModal } from "./components/ReceiptDetailModal";
import { ManualReceiptModal } from "./components/ManualReceiptModal";
import { VoiceReceiptModal } from "./components/VoiceReceiptModal";
import { ProfileModal } from "./components/ProfileModal";
import { MonthClosingModal } from "./components/MonthClosingModal";
import { AuthDomainModal } from "./components/AuthDomainModal";
import { LandingPage } from "./components/LandingPage";
import { ToastContainer, ToastMessage } from "./components/Toast";
import { formatMonthYearLabel, filterReceiptsByPeriod, getPeriodLabel, formatEuro } from "./utils/formatters";
import {
  initAuth,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  sendResetEmail,
  signOutUser,
  saveReceiptToFirestore,
  deleteReceiptFromFirestore,
  subscribeToReceipts,
  subscribeToInvoices,
  saveInvoiceToFirestore,
  deleteInvoiceFromFirestore,
  subscribeToUserProfile,
  saveUserProfile,
  uploadReceiptToStorage,
  isGoogleDriveConnected,
  connectGoogleDrive,
  seedInitialReceiptsIfEmpty,
} from "./lib/firebase";
import { User } from "firebase/auth";
import { Plus } from "lucide-react";

const STORAGE_KEY = "comptasnap_receipts_v1";

export default function App() {
  // Firebase User & Connection State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Load receipts from localStorage or start empty
  const [receipts, setReceipts] = useState<ReceiptItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn("Could not read receipts from localStorage", e);
    }
    return []; // Start empty, will be populated from Firestore on login
  });

  // Active period selection
  const [currentPeriod, setCurrentPeriod] = useState<PeriodSelection>({
    type: "current_month",
  });
  const [statusFilter, setStatusFilter] = useState<"all" | "validé" | "en_attente">("all");
  const [activeTab, setActiveTab] = useState<"home" | "receipts" | "invoices">("home");

  // Invoices state
  const [invoices, setInvoices] = useState<IssuedInvoice[]>([]);
  const [, refreshDriveStatus] = useState(0);
  const [isInvoiceGenOpen, setIsInvoiceGenOpen] = useState(false);

  // Modals state & pending file for direct drag-and-drop or camera capture
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<{file: File, source: "scan" | "upload"} | null>(null);
  const [isClosingOpen, setIsClosingOpen] = useState(false);
  const [isAuthDomainModalOpen, setIsAuthDomainModalOpen] = useState(false);
  const [isRetryingAuth, setIsRetryingAuth] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Theme state
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("theme") as "dark" | "light") || "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  const addToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 1. Initialize Firebase Auth
  useEffect(() => {
    const unsubscribeAuth = initAuth((user) => {
      setCurrentUser(user);
      if (user) {
        setIsFirebaseConnected(true);
      } else {
        setIsFirebaseConnected(false);
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // 2. Real-time Firebase Firestore Subscription
  useEffect(() => {
    if (!currentUser) return;

    // Real-time listener from Firestore
    const unsubscribeSnapshot = subscribeToReceipts(
      currentUser.uid,
      (remoteReceipts) => {
        setReceipts((prev) => {
          // Identify receipts that are local-only (temporary IDs) and not yet synced
          const localOnly = prev.filter(r => {
            const isTemp = (r.id.startsWith("rec-") || r.id.startsWith("manual_") || r.id.startsWith("voice_") || r.id.startsWith("tg_"));
            if (!isTemp) return false;
            
            // Check if any remote receipt has this ID or has this ID as its tempId
            const isAlreadySynced = remoteReceipts.some(rr => rr.id === r.id || rr.tempId === r.id);
            return !isAlreadySynced;
          });
          
          // Merge them with remote receipts, ensuring remote is the source of truth for synced items
          const merged = [...localOnly, ...remoteReceipts];
          // Sort merged list by date descending
          return merged.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        });
        setIsFirebaseConnected(true);
      },
      (err) => {
        console.warn("Firestore subscription warning:", err);
      }
    );

    return () => {
      unsubscribeSnapshot();
    };
  }, [currentUser]);

  // 2.5 Real-time User Profile Subscription
  useEffect(() => {
    if (!currentUser) {
      setUserProfile(null);
      return;
    }

    const unsubscribeProfile = subscribeToUserProfile(
      currentUser.uid,
      (profile) => {
        if (profile) {
          setUserProfile(profile);
        } else {
          // Initialize profile if it doesn't exist
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || "",
            estimatedTaxRate: 22, // Default 22%
            nextInvoiceNumber: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          saveUserProfile(newProfile);
          setUserProfile(newProfile);
        }
      }
    );

    return () => {
      unsubscribeProfile();
    };
  }, [currentUser]);

  // 2.6 Real-time Invoices Subscription
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribeInvoices = subscribeToInvoices(
      currentUser.uid,
      (remoteInvoices) => {
        setInvoices((prev) => {
          // Keep local-only invoices (temp IDs) that are not in remoteInvoices
          const localOnly = prev.filter(inv => {
            const isTemp = inv.id.startsWith("inv_");
            if (!isTemp) return false;
            
            const isAlreadySynced = remoteInvoices.some(ri => ri.id === inv.id || ri.tempId === inv.id);
            return !isAlreadySynced;
          });
          const merged = [...localOnly, ...remoteInvoices];
          return merged.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        });
      }
    );

    return () => {
      unsubscribeInvoices();
    };
  }, [currentUser]);

  const handleGoogleSignIn = async () => {
    setIsRetryingAuth(true);
    try {
      const user = await signInWithGoogle();
      setCurrentUser(user);
      setIsFirebaseConnected(true);
      setIsAuthDomainModalOpen(false);
      addToast(
        `Connecté avec succès : ${user.displayName || user.email || "Utilisateur"}`,
        "success"
      );
    } catch (err: any) {
      console.error("Erreur connexion Google:", err);
      const errorCode = err?.code || "";
      const errorMessage = err?.message || "";

      if (
        (errorCode && (errorCode === "auth/unauthorized-domain" || errorCode.includes("unauthorized-domain"))) ||
        (errorMessage && errorMessage.includes("unauthorized-domain"))
      ) {
        setIsAuthDomainModalOpen(true);
        addToast("Domaine Vercel à autoriser dans Firebase (voir instructions)", "error");
      } else if (errorCode === "auth/popup-blocked") {
        addToast("Le navigateur a bloqué le pop-up. Veuillez autoriser les fenêtres pop-up.", "error");
      } else if (errorCode === "auth/popup-closed-by-user" || errorCode === "auth/cancelled-popup-request") {
        // Closed intentionally by user
      } else {
        addToast(errorMessage || "Impossible de se connecter avec Google", "error");
      }
    } finally {
      setIsRetryingAuth(false);
    }
  };

  // Connexion / création de compte par e-mail (les erreurs sont affichées par l'écran de connexion)
  const handleEmailSignIn = async (email: string, password: string) => {
    const user = await signInWithEmail(email, password);
    setCurrentUser(user);
    setIsFirebaseConnected(true);
    addToast(`Connecté : ${user.email || "Utilisateur"}`, "success");
  };

  const handleEmailSignUp = async (email: string, password: string) => {
    const user = await signUpWithEmail(email, password);
    setCurrentUser(user);
    setIsFirebaseConnected(true);
    addToast("Compte créé. Bienvenue sur ComptaSnap !", "success");
  };

  const handleResetPassword = async (email: string) => {
    await sendResetEmail(email);
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setCurrentUser(null);
      setReceipts([]); // Clear receipts on logout
      setInvoices([]); // Clear invoices on logout
      setIsFirebaseConnected(false);
      addToast("Déconnexion réussie", "info");
    } catch (err) {
      console.error("Erreur déconnexion:", err);
    }
  };

  // Sync to localStorage as local cache fallback
  useEffect(() => {
    try {
      const light = receipts.map((r) =>
        r.fileDataUrl && r.fileDataUrl.startsWith("data:") ? { ...r, fileDataUrl: "" } : r
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(light));
    } catch (e) {
      console.warn("Could not save to localStorage", e);
    }
  }, [receipts]);

  // Dynamically compute all available months from the receipts + current calendar month
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();

    receipts.forEach((r) => {
      if (r.date && r.date.length >= 7) {
        const ym = r.date.slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(ym)) {
          monthsSet.add(ym);
        }
      }
    });

    // Also include current month
    const currentCalMonth = new Date().toISOString().slice(0, 7);
    monthsSet.add(currentCalMonth);

    // Sort descending (most recent first)
    const sorted = Array.from(monthsSet).sort().reverse();

    const monthOptions = sorted.map((key) => {
      const count = receipts.filter((r) => r.date && r.date.startsWith(key)).length;
      return {
        key,
        label: `${formatMonthYearLabel(key)} (${count})`,
        pureLabel: formatMonthYearLabel(key),
        count,
      };
    });

    return [
      {
        key: "all",
        label: `Tous les justificatifs (${receipts.length})`,
        pureLabel: "Tous les justificatifs",
        count: receipts.length,
      },
      ...monthOptions,
    ];
  }, [receipts]);

  // Treasury stats calculation
  const treasuryStats = useMemo<TreasuryStats>(() => {
    // Filter receipts for the selected month/period
    const periodReceipts = filterReceiptsByPeriod(receipts, currentPeriod);

    const totalRevenue = periodReceipts
      .filter(r => r.transactionType === "income")
      .reduce((sum, r) => sum + r.totalTTC, 0);

    const totalExpenses = periodReceipts
      .filter(r => r.transactionType === "expense" || !r.transactionType)
      .reduce((sum, r) => sum + r.totalTTC, 0);

    const taxRate = userProfile?.estimatedTaxRate || 22;
    const estimatedCharges = totalRevenue * (taxRate / 100);
    const netRevenue = totalRevenue - totalExpenses - estimatedCharges;

    return {
      totalRevenue,
      totalExpenses,
      estimatedCharges,
      netRevenue,
      taxRate
    };
  }, [receipts, currentPeriod, userProfile]);

  // Current month receipts or all
  const periodReceipts = useMemo(() => {
    return filterReceiptsByPeriod(receipts, currentPeriod);
  }, [receipts, currentPeriod]);

  const displayedReceipts = periodReceipts;

  const displayedTotalTTC = useMemo(() => {
    return periodReceipts.reduce((acc, r) => acc + (r.totalTTC || 0), 0);
  }, [periodReceipts]);

  const currentMonthLabel = getPeriodLabel(currentPeriod);

  const validatedCount = periodReceipts.filter((r) => r.status === "validé").length;
  const pendingCount = periodReceipts.filter((r) => r.status === "en_attente").length;

  // Handlers
  const handleDirectFile = (file: File, source: "scan" | "upload" = "upload") => {
    if (!file) return;
    addToast("Document capturé, analyse IA en cours...", "info");
    setPendingFile({ file, source });
    setIsScanOpen(true);
  };

  const handleSaveNewReceipt = async (newReceipt: ReceiptItem) => {
    // 1. Optimistic UI update
    setReceipts((prev) => [newReceipt, ...prev]);

    // Check month of new receipt
    const receiptMonth = newReceipt.date ? newReceipt.date.slice(0, 7) : "";
    const isVisibleInCurrentPeriod = filterReceiptsByPeriod([newReceipt], currentPeriod).length > 0;

    if (receiptMonth && !isVisibleInCurrentPeriod && currentPeriod.type !== "all") {
      setCurrentPeriod({ type: "month", monthKey: receiptMonth });
      addToast(
        `Reçu ${newReceipt.supplier} (${newReceipt.totalTTC.toFixed(2)} €) enregistré dans ${formatMonthYearLabel(receiptMonth)}`,
        "success"
      );
    } else {
      addToast(
        `Reçu ${newReceipt.supplier} (${newReceipt.totalTTC.toFixed(2)} €) enregistré (${newReceipt.status === "validé" ? "Validé" : "En attente"})`,
        "success"
      );
    }

    // 2. Persistance : d'abord les DONNÉES dans Firestore (rapide, fiable),
    //    puis le justificatif (Drive / Storage) en arrière-plan, sans jamais bloquer l'enregistrement.
    if (!currentUser) return;

    let permanentId = newReceipt.id;
    try {
      permanentId = await saveReceiptToFirestore(currentUser.uid, { ...newReceipt, fileDataUrl: "" });

      // If the ID changed (temporary 'rec-' ID -> Firestore auto-ID), update local state without duplicates
      if (permanentId !== newReceipt.id) {
        setReceipts((prev) => {
          if (prev.some((r) => r.id === permanentId)) {
            return prev.filter((r) => r.id !== newReceipt.id);
          }
          return prev.map((r) => (r.id === newReceipt.id ? { ...newReceipt, id: permanentId } : r));
        });
      }
    } catch (err) {
      console.error("Erreur lors de la synchronisation Firebase:", err);
      let detail = "";
      try {
        const m = (err as Error)?.message || "";
        detail = (JSON.parse(m).error as string) || m;
      } catch {
        detail = (err as Error)?.message || "";
      }
      addToast(`Erreur de sauvegarde Cloud : ${detail.slice(0, 160)}`, "error");
      return;
    }

    // 3. Upload du justificatif (avec délais maximum), puis mise à jour du document
    if (newReceipt.fileDataUrl && newReceipt.fileDataUrl.startsWith("data:")) {
      try {
        const { url, driveFileId, driveViewLink } = await uploadReceiptToStorage(
          newReceipt.fileDataUrl,
          newReceipt.standardizedName || newReceipt.fileName,
          currentUser.uid,
          permanentId
        );

        if (url && !url.startsWith("data:")) {
          const withFile = {
            ...newReceipt,
            id: permanentId,
            fileDataUrl: url,
            driveFileId: driveFileId || newReceipt.driveFileId,
            driveViewLink: driveViewLink || newReceipt.driveViewLink,
          };
          await saveReceiptToFirestore(currentUser.uid, withFile);
          setReceipts((prev) =>
            prev.map((r) => (r.id === permanentId ? { ...r, ...withFile } : r))
          );
          if (driveFileId) {
            addToast("Justificatif sauvegardé sur votre Google Drive personnel", "success");
          }
        } else {
          addToast(
            isGoogleDriveConnected()
              ? "Reçu enregistré, mais le justificatif n'a pas pu être envoyé sur Google Drive."
              : "Reçu enregistré, mais Google Drive n'est pas connecté : justificatif non archivé. Cliquez sur « Connecter Drive » dans l'onglet Reçus.",
            "error"
          );
        }
      } catch (err) {
        console.error("Erreur upload justificatif:", err);
        addToast("Reçu enregistré, mais l'envoi du justificatif a échoué.", "error");
      }
    }
  };

  const handleUpdateReceipt = async (updated: ReceiptItem) => {
    setReceipts((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    if (selectedReceipt?.id === updated.id) {
      setSelectedReceipt(updated);
    }
    addToast(`Justificatif ${updated.supplier} mis à jour`, "info");

    if (currentUser) {
      try {
        await saveReceiptToFirestore(currentUser.uid, updated);
      } catch (err) {
        console.error("Erreur mise à jour Firestore:", err);
      }
    }
  };

  const handleDeleteReceipt = async (id: string) => {
    setReceipts((prev) => prev.filter((r) => r.id !== id));
    addToast("Justificatif supprimé du dossier", "info");

    if (currentUser) {
      try {
        await deleteReceiptFromFirestore(currentUser.uid, id);
      } catch (err) {
        console.error("Erreur suppression Firestore:", err);
      }
    }
  };

  const handleToggleStatus = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const existing = receipts.find((r) => r.id === id);
    if (!existing) return;

    const nextStatus = existing.status === "validé" ? "en_attente" : "validé";
    const updatedItem: ReceiptItem = { ...existing, status: nextStatus };

    setReceipts((prev) => prev.map((r) => (r.id === id ? updatedItem : r)));

    if (selectedReceipt?.id === id) {
      setSelectedReceipt(updatedItem);
    }

    addToast(
      nextStatus === "validé"
        ? `Reçu ${existing.supplier} validé ✓`
        : `Reçu ${existing.supplier} remis en attente`,
      "info"
    );

    if (currentUser) {
      try {
        await saveReceiptToFirestore(currentUser.uid, updatedItem);
      } catch (err) {
        console.error("Erreur mise à jour statut Firestore:", err);
      }
    }
  };

  const handleValidateAllPending = async () => {
    const updatedItems: ReceiptItem[] = [];

    setReceipts((prev) =>
      prev.map((r) => {
        const isVisible = filterReceiptsByPeriod([r], currentPeriod).length > 0;
        if (isVisible && r.status === "en_attente") {
          const validated = { ...r, status: "validé" as const };
          updatedItems.push(validated);
          return validated;
        }
        return r;
      })
    );
    addToast("Tous les reçus en attente ont été validés avec succès !", "success");

    if (currentUser && updatedItems.length > 0) {
      for (const item of updatedItems) {
        saveReceiptToFirestore(currentUser.uid, item).catch((err) =>
          console.error("Erreur validation en lot Firestore:", err)
        );
      }
    }
  };

  const handleSaveProfile = async (profile: UserProfile) => {
    await saveUserProfile(profile);
    addToast("Paramètres mis à jour", "success");
  };

  const handleSaveInvoice = async (invoice: IssuedInvoice) => {
    if (!currentUser) return;
    
    // Optimistic UI update
    setInvoices((prev) => [invoice, ...prev]);
    addToast(`Facture ${invoice.invoiceNumber} générée`, "success");

    try {
      const permanentId = await saveInvoiceToFirestore(currentUser.uid, invoice);
      
      // Update ID if changed (e.g. from temp 'inv_' to Firestore ID).
      // Prevent duplicates if real-time listener already added it.
      if (permanentId !== invoice.id) {
        setInvoices((prev) => {
          const alreadyHasPermanent = prev.some(inv => inv.id === permanentId);
          if (alreadyHasPermanent) {
            return prev.filter(inv => inv.id !== invoice.id);
          }
          return prev.map((inv) => (inv.id === invoice.id ? { ...invoice, id: permanentId } : inv));
        });
      }

      // Increment invoice number in profile
      if (userProfile) {
        await saveUserProfile({
          ...userProfile,
          nextInvoiceNumber: (userProfile.nextInvoiceNumber || 1) + 1
        });
      }
    } catch (err) {
      console.error("Error saving invoice:", err);
      addToast("Erreur lors de la sauvegarde Cloud de la facture.", "error");
      // Revert optimistic update
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoice.id));
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!currentUser) return;
    try {
      await deleteInvoiceFromFirestore(currentUser.uid, id);
      addToast("Facture supprimée", "info");
    } catch (err) {
      console.error("Error deleting invoice:", err);
    }
  };

  const handleToggleInvoiceStatus = async (id: string, currentStatus: string) => {
    if (!currentUser) return;
    const nextStatus = currentStatus === "payé" ? "en_attente" : "payé";
    const invoice = invoices.find(i => i.id === id);
    if (invoice) {
      await saveInvoiceToFirestore(currentUser.uid, { ...invoice, status: nextStatus as any });
      addToast(`Facture ${invoice.invoiceNumber} marquée comme ${nextStatus}`, "info");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-brand-deep flex items-center justify-center" role="status" aria-label="Chargement">
        <div className="w-8 h-8 border-4 border-brand-vibrant/20 border-t-brand-vibrant rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LandingPage
          onSignIn={handleGoogleSignIn}
          isRetryingAuth={isRetryingAuth}
          onEmailSignIn={handleEmailSignIn}
          onEmailSignUp={handleEmailSignUp}
          onResetPassword={handleResetPassword}
        />
        <AuthDomainModal
          isOpen={isAuthDomainModalOpen}
          onClose={() => setIsAuthDomainModalOpen(false)}
          onRetry={handleGoogleSignIn}
          isRetrying={isRetryingAuth}
        />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  const pendingInvoicesTotal = invoices
    .filter((i) => i.status === "en_attente")
    .reduce((acc, i) => acc + i.totalTTC, 0);
  const recentReceipts = [...displayedReceipts]
    .sort((x, y) => (y.date || "").localeCompare(x.date || ""))
    .slice(0, 3);

  return (
    <div className="min-h-full bg-brand-deep text-brand-snow flex flex-col font-sans pb-32">
      {/* Top Header */}
      <Header
        selectedPeriod={currentPeriod}
        onSelectPeriod={(p) => {
          setCurrentPeriod(p);
          setStatusFilter("all");
        }}
        availableMonths={availableMonths}
        validatedCount={validatedCount}
        pendingCount={pendingCount}
        showOnlyPending={statusFilter === "en_attente"}
        onTogglePendingFilter={() => {
          setActiveTab("receipts");
          setStatusFilter(statusFilter === "en_attente" ? "all" : "en_attente");
        }}
        totalCount={periodReceipts.length}
        totalTTC={displayedTotalTTC}
        isFirebaseConnected={isFirebaseConnected}
        currentUser={currentUser}
        onSignInWithGoogle={handleGoogleSignIn}
        onSignOut={handleSignOut}
        onOpenClosing={() => setIsClosingOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-6 space-y-8">
        {activeTab === "home" && (
          <>
            <MonthStats
              receipts={displayedReceipts}
              allReceipts={receipts}
              monthLabel={currentMonthLabel}
              onValidateAllPending={handleValidateAllPending}
            />

            {pendingInvoicesTotal > 0 && (
              <button
                onClick={() => setActiveTab("invoices")}
                className="w-full text-left border border-brand-snow/15 px-4 py-3 cursor-pointer hover:border-brand-vibrant transition-colors"
              >
                <div className="leader text-brand-snow">
                  <span>Factures en attente</span><i /><span className="text-brand-vibrant">{formatEuro(pendingInvoicesTotal)}</span>
                </div>
              </button>
            )}

            <section aria-label="Dernières lignes">
              <div className="k text-brand-muted mb-1.5">Dernières lignes</div>
              {recentReceipts.length === 0 ? (
                <p className="text-sm text-brand-muted py-3">
                  Aucune dépense sur cette période. Appuyez sur le bouton + pour scanner votre premier reçu.
                </p>
              ) : (
                recentReceipts.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedReceipt(r)}
                    className="leader w-full text-left cursor-pointer hover:text-brand-vibrant"
                  >
                    <span className="truncate">{r.supplier}</span>
                    <i />
                    <span>{r.transactionType === "income" ? "+" : "−"}{formatEuro(r.totalTTC).replace(/\s€$/, "")}</span>
                  </button>
                ))
              )}
            </section>
          </>
        )}

        {activeTab === "receipts" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-[44px] font-extrabold tracking-[-0.03em] leading-none">Reçus</h1>
              <div className="k text-brand-vibrant mt-1">
                {validatedCount}/{displayedReceipts.length} validés · {currentMonthLabel}
              </div>
            </div>
            <div className="k flex flex-wrap items-center gap-x-3 gap-y-1 text-brand-muted">
              {isGoogleDriveConnected() ? (
                <span>Google Drive connecté · dossier « ComptaSnap Justificatifs »</span>
              ) : (
                <>
                  <span style={{ color: "#C73A10" }}>Google Drive non connecté</span>
                  <button
                    type="button"
                    className="underline cursor-pointer text-brand-vibrant"
                    onClick={async () => {
                      try {
                        const ok = await connectGoogleDrive();
                        addToast(
                          ok ? "Google Drive connecté" : "Accès Drive refusé : cochez la case Drive dans la fenêtre Google.",
                          ok ? "success" : "error"
                        );
                      } catch (err: any) {
                        addToast(`Connexion Drive impossible : ${String(err?.message || err).slice(0, 120)}`, "error");
                      } finally {
                        refreshDriveStatus((n) => n + 1);
                      }
                    }}
                  >
                    Connecter Drive
                  </button>
                </>
              )}
            </div>
            <ReceiptList
              receipts={displayedReceipts}
              onSelectReceipt={(receipt) => setSelectedReceipt(receipt)}
              onToggleStatus={handleToggleStatus}
              onDeleteReceipt={handleDeleteReceipt}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              onOpenScan={() => {
                setPendingFile(null);
                setIsScanOpen(true);
              }}
              onOpenManual={() => setIsManualOpen(true)}
              onOpenVoice={() => setIsVoiceOpen(true)}
              onImportFile={(file) => {
                setPendingFile({ file, source: "upload" });
                setIsScanOpen(true);
              }}
              totalAllMonthsCount={receipts.length}
              onShowAllMonths={() => setCurrentPeriod({ type: "all" })}
            />
          </div>
        )}

        {activeTab === "invoices" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-[44px] font-extrabold tracking-[-0.03em] leading-none">Factures</h1>
              <div className="k text-brand-vibrant mt-1">{formatEuro(pendingInvoicesTotal)} en attente</div>
            </div>

            <TreasuryDashboard stats={treasuryStats} />

            <button onClick={() => setIsInvoiceGenOpen(true)} className="btn w-full">
              <Plus className="w-5 h-5" aria-hidden="true" />
              Nouvelle facture
            </button>

            <InvoiceList
              invoices={invoices}
              onToggleStatus={handleToggleInvoiceStatus}
              onDeleteInvoice={handleDeleteInvoice}
              onViewInvoice={() => setIsInvoiceGenOpen(true)}
            />
          </div>
        )}
      </main>

      {/* Navigation basse : Accueil · Factures · Scanner · Reçus · Bilan */}
      <nav className="bottom-nav" aria-label="Navigation principale">
        <div className="inner">
          <button className={activeTab === "home" ? "on" : ""} aria-current={activeTab === "home" ? "page" : undefined} onClick={() => setActiveTab("home")}>
            Accueil
          </button>
          <button className={activeTab === "invoices" ? "on" : ""} aria-current={activeTab === "invoices" ? "page" : undefined} onClick={() => setActiveTab("invoices")}>
            Factures
          </button>
          <button
            className="add"
            aria-label="Scanner un reçu"
            onClick={() => {
              setPendingFile(null);
              setIsScanOpen(true);
            }}
          >
            <b />
          </button>
          <button className={activeTab === "receipts" ? "on" : ""} aria-current={activeTab === "receipts" ? "page" : undefined} onClick={() => setActiveTab("receipts")}>
            Reçus
          </button>
          <button onClick={() => setIsClosingOpen(true)}>Bilan</button>
        </div>
      </nav>

      {/* Modals */}
      <ScanModal
        isOpen={isScanOpen}
        initialFile={pendingFile}
        onClose={() => {
          setIsScanOpen(false);
          setPendingFile(null);
        }}
        onSaveReceipt={handleSaveNewReceipt}
        defaultDate={currentPeriod.type === "month" ? `${currentPeriod.monthKey}-15` : new Date().toISOString().split("T")[0]}
      />

      <ManualReceiptModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        onSave={handleSaveNewReceipt}
        defaultDate={currentPeriod.type === "month" ? `${currentPeriod.monthKey}-01` : undefined}
      />

      <VoiceReceiptModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onSave={async (data) => {
          await handleSaveNewReceipt({
            ...data,
            id: `voice_${Date.now()}`,
            date: data.date || new Date().toISOString().split("T")[0],
            status: "en_attente",
            source: "voice",
            aiExtracted: true,
            fileName: "Dictée Vocale",
            fileType: "voice"
          });
        }}
      />

      <GenerateInvoiceModal
        isOpen={isInvoiceGenOpen}
        onClose={() => setIsInvoiceGenOpen(false)}
        onSave={handleSaveInvoice}
        nextInvoiceNumber={userProfile?.nextInvoiceNumber || 1}
      />

      {currentUser && (
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          userId={currentUser.uid}
          userEmail={currentUser.email}
          profile={userProfile}
          onSaveProfile={handleSaveProfile}
        />
      )}

      {selectedReceipt && (
        <ReceiptDetailModal
          key={selectedReceipt.id}
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          onUpdateReceipt={handleUpdateReceipt}
          onDeleteReceipt={handleDeleteReceipt}
        />
      )}

      <MonthClosingModal
        isOpen={isClosingOpen}
        onClose={() => setIsClosingOpen(false)}
        receipts={displayedReceipts}
        monthLabel={currentMonthLabel}
        onMarkAllValidated={handleValidateAllPending}
      />

      <AuthDomainModal
        isOpen={isAuthDomainModalOpen}
        onClose={() => setIsAuthDomainModalOpen(false)}
        onRetry={handleGoogleSignIn}
        isRetrying={isRetryingAuth}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
