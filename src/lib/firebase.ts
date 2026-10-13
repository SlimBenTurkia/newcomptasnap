import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  Auth,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  Firestore,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
  FirebaseStorage,
} from "firebase/storage";
import { ReceiptItem, UserProfile, IssuedInvoice } from "../types";
import firebaseConfigJson from "../../firebase-applet-config.json";
import { getApiUrl } from "../utils/api";

// Firebase App Configuration from applet config
export const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

export const FIRESTORE_DATABASE_ID =
  firebaseConfigJson.firestoreDatabaseId || "(default)";

// Initialize Firebase instances safely
export const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);

// Use custom firestore database ID from applet config as mandated
export const db: Firestore =
  FIRESTORE_DATABASE_ID && FIRESTORE_DATABASE_ID !== "(default)"
    ? getFirestore(app, FIRESTORE_DATABASE_ID)
    : getFirestore(app);

export const storage: FirebaseStorage = getStorage(
  app,
  `gs://${firebaseConfigJson.storageBucket}`
);

// Standardized Firestore Error Reporting as mandated by Skill guidelines
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Initializes Authentication listener.
 * In AI Studio, Google Login is the standard configured provider.
 */
export function initAuth(onUserReady: (user: User | null) => void): () => void {
  const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
    onUserReady(currentUser);
  });

  return unsubscribe;
}

/**
 * Sign in using Google popup and request Drive scopes
 */
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  // Request Drive scopes as requested by user
  provider.addScope("https://www.googleapis.com/auth/drive.file");
  provider.addScope("https://www.googleapis.com/auth/drive.metadata");
  provider.setCustomParameters({ prompt: "select_account" });
  
  const result = await signInWithPopup(auth, provider);
  
  // Store access token for Google Drive operations
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    sessionStorage.setItem("google_drive_access_token", credential.accessToken);
  }
  
  return result.user;
}

/**
 * Connexion par e-mail et mot de passe
 * (nécessite d'activer le fournisseur « E-mail/Mot de passe » dans Firebase Authentication).
 */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  return result.user;
}

/**
 * Création de compte par e-mail et mot de passe
 */
export async function signUpWithEmail(email: string, password: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
  return result.user;
}

/**
 * Envoie un e-mail de réinitialisation du mot de passe
 */
export async function sendResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Traduit un code d'erreur Firebase Auth en message clair pour l'utilisateur
 */
export function authErrorMessage(err: any): string {
  const code: string = err?.code || "";
  switch (code) {
    case "auth/invalid-email":
      return "Cette adresse e-mail n'est pas valide.";
    case "auth/missing-password":
      return "Saisissez votre mot de passe.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "E-mail ou mot de passe incorrect.";
    case "auth/email-already-in-use":
      return "Un compte existe déjà avec cet e-mail. Connectez-vous.";
    case "auth/weak-password":
      return "Mot de passe trop court : 6 caractères minimum.";
    case "auth/too-many-requests":
      return "Trop de tentatives. Réessayez dans quelques minutes.";
    case "auth/network-request-failed":
      return "Connexion réseau impossible. Vérifiez votre connexion.";
    case "auth/operation-not-allowed":
      return "La connexion par e-mail n'est pas activée. Activez-la dans Firebase Authentication.";
    default:
      return err?.message || "Une erreur est survenue. Réessayez.";
  }
}

/**
 * Get stored Google Drive access token
 */
export function getGoogleDriveToken(): string | null {
  return sessionStorage.getItem("google_drive_access_token");
}

/**
 * Sign out current user
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Uploads receipt file to Google Drive (User's personal drive)
 */
export async function uploadReceiptToGoogleDrive(
  fileOrDataUrl: File | Blob | string,
  fileName: string,
  mimeType: string
): Promise<{ fileId: string; viewLink: string }> {
  const token = getGoogleDriveToken();
  if (!token) {
    throw new Error("Authentification Google Drive manquante. Veuillez vous reconnecter.");
  }

  let fileBase64 = "";
  if (typeof fileOrDataUrl === "string") {
    fileBase64 = fileOrDataUrl;
  } else {
    fileBase64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(fileOrDataUrl);
    });
  }

  // 1. Ensure folder exists (Dedicated "ComptaSnap Justificatifs")
  let folderId = sessionStorage.getItem("google_drive_folder_id");
  if (!folderId) {
    const targetInitUrl = getApiUrl("/api/drive-init");
    console.log(`Initialisation Google Drive sur: ${targetInitUrl}`);
    const initRes = await fetch(targetInitUrl, {
      method: "POST",
      mode: "cors",
      headers: { 
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });
    
    if (!initRes.ok) {
      console.error("Drive Init error response:", initRes.status);
      throw new Error(`Erreur initialisation Drive (${initRes.status})`);
    }

    const initData = await initRes.json();
    if (initData.success) {
      folderId = initData.folderId;
      sessionStorage.setItem("google_drive_folder_id", folderId!);
    }
  }

  // 2. Upload to Drive
  const targetUploadUrl = getApiUrl("/api/drive-upload");
  console.log(`Upload vers Google Drive sur: ${targetUploadUrl}`);
  const uploadRes = await fetch(targetUploadUrl, {
    method: "POST",
    mode: "cors",
    headers: { 
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      fileName,
      fileBase64,
      mimeType,
      folderId
    })
  });

  if (!uploadRes.ok) {
    console.error("Drive Upload error response:", uploadRes.status);
    throw new Error(`Erreur upload Drive (${uploadRes.status})`);
  }

  const uploadData = await uploadRes.json();
  if (!uploadData.success) {
    throw new Error(uploadData.error || "Échec de l'upload vers Google Drive");
  }

  return { 
    fileId: uploadData.fileId, 
    viewLink: uploadData.viewLink 
  };
}

/**
 * Uploads receipt file (Blob / File or DataURL) to Google Drive (preferred)
 * or falls back to Firebase Storage if token is missing.
 */
export async function uploadReceiptToStorage(
  fileOrDataUrl: File | Blob | string,
  fileName: string,
  userId: string,
  receiptId: string
): Promise<{ url: string; storagePath: string; driveFileId?: string; driveViewLink?: string }> {
  const token = getGoogleDriveToken();
  
  if (token) {
    try {
      const mimeType = typeof fileOrDataUrl !== "string" ? fileOrDataUrl.type : "image/jpeg";
      const driveData = await uploadReceiptToGoogleDrive(fileOrDataUrl, fileName, mimeType);
      return { 
        url: driveData.viewLink, 
        storagePath: `drive:${driveData.fileId}`,
        driveFileId: driveData.fileId,
        driveViewLink: driveData.viewLink
      };
    } catch (err) {
      console.warn("Échec upload Google Drive, tentative Firebase Storage:", err);
    }
  }

  const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `receipts/${userId}/${receiptId}_${cleanFileName}`;
  const storageRef = ref(storage, storagePath);

  try {
    if (typeof fileOrDataUrl === "string") {
      if (fileOrDataUrl.startsWith("data:")) {
        await uploadString(storageRef, fileOrDataUrl, "data_url");
      } else {
        return { url: fileOrDataUrl, storagePath: "" };
      }
    } else {
      await uploadBytes(storageRef, fileOrDataUrl);
    }

    const downloadUrl = await getDownloadURL(storageRef);
    return { url: downloadUrl, storagePath };
  } catch (err) {
    console.warn("Échec upload Firebase Storage, conservation de l'image locale:", err);
    const fallbackUrl = typeof fileOrDataUrl === "string" ? fileOrDataUrl : "";
    return { url: fallbackUrl, storagePath: "" };
  }
}

/**
 * Saves or updates a user profile
 */
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const path = `users/${profile.uid}`;
  const userDocRef = doc(db, "users", profile.uid);
  try {
    await setDoc(userDocRef, {
      ...profile,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Subscribes to user profile changes
 */
export function subscribeToUserProfile(
  uid: string,
  onProfileChange: (profile: UserProfile | null) => void
): () => void {
  const path = `users/${uid}`;
  const userDocRef = doc(db, "users", uid);

  return onSnapshot(
    userDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onProfileChange(docSnap.data() as UserProfile);
      } else {
        onProfileChange(null);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

/**
 * Saves or updates a receipt in Firestore.
 * Always ensures a unique document to prevent overwriting.
 */
export async function saveReceiptToFirestore(
  userId: string,
  receipt: ReceiptItem
): Promise<string> {
  if (!userId || !receipt) {
    console.error("Missing required fields for Firestore save:", { userId });
    throw new Error("Missing required fields for Firestore save");
  }

  // Deeply sanitize and ensure no undefined values are sent to Firestore
  // which can cause "Cannot read properties of undefined (reading 'indexOf')" in some SDK versions
  const cleanData: Record<string, any> = {
    userId: userId || "unknown",
    transactionType: receipt.transactionType || "expense",
    supplier: (receipt.supplier || "Fournisseur non précisé").trim(),
    date: receipt.date || new Date().toISOString().split("T")[0],
    category: receipt.category || "Autre",
    expenseType: receipt.expenseType || "",
    accountingCode: receipt.accountingCode || "",
    taxDeductibility: receipt.taxDeductibility || "deductible",
    totalTTC: Number(receipt.totalTTC || 0),
    vatAmount: Number(receipt.vatAmount || 0),
    vatRate: Number(receipt.vatRate || 0),
    paymentMethod: receipt.paymentMethod || "Carte Bancaire",
    status: receipt.status || "en_attente",
    source: receipt.source || "upload",
    fileName: receipt.fileName || "recu.pdf",
    standardizedName: receipt.standardizedName || receipt.fileName || "recu.pdf",
    fileType: receipt.fileType || "image",
    fileDataUrl: (receipt.fileDataUrl && receipt.fileDataUrl.startsWith("data:") && receipt.fileDataUrl.length > 50000) 
      ? "" // Too large for Firestore document (1MB limit), should be in Storage
      : (receipt.fileDataUrl || ""),
    currency: (receipt.currency || "EUR").toUpperCase(),
    originalTotal: Number(receipt.originalTotal ?? receipt.totalTTC ?? 0),
    exchangeRate: Number(receipt.exchangeRate ?? 1),
    invoiceNumber: (receipt.invoiceNumber || "").trim(),
    notes: (receipt.notes || "").trim(),
    aiExtracted: Boolean(receipt.aiExtracted),
    confidence: Number(receipt.confidence || 0),
    extractedLines: Array.isArray(receipt.extractedLines) ? receipt.extractedLines : [],
    rawOcrText: (receipt.rawOcrText || "").trim(),
    extractionSource: receipt.extractionSource || "fallback",
    createdAt: receipt.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    driveFileId: receipt.driveFileId || null,
    driveViewLink: receipt.driveViewLink || null,
  };

  try {
    let finalDocRef;
    
    // If it's a temporary or missing ID, we use addDoc pattern (auto-ID)
    const isTempId = !receipt.id || 
                     receipt.id.startsWith("manual_") || 
                     receipt.id.startsWith("rec-") || 
                     receipt.id.startsWith("voice_") || 
                     receipt.id.startsWith("tg_");

    if (isTempId) {
      const receiptsCollection = collection(db, "users", userId, "receipts");
      finalDocRef = doc(receiptsCollection);
    } else {
      finalDocRef = doc(db, "users", userId, "receipts", receipt.id);
    }

    const finalId = finalDocRef.id;
    await setDoc(finalDocRef, { 
      ...cleanData, 
      id: finalId,
      tempId: isTempId ? receipt.id : (receipt.tempId || null)
    }, { merge: true });
    
    return finalId;
  } catch (err) {
    const path = `users/${userId}/receipts/${receipt.id || "new"}`;
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

/**
 * Deletes a receipt from Firestore
 */
export async function deleteReceiptFromFirestore(
  userId: string,
  receiptId: string
): Promise<void> {
  const path = `users/${userId}/receipts/${receiptId}`;
  const receiptDocRef = doc(db, "users", userId, "receipts", receiptId);
  try {
    await deleteDoc(receiptDocRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Subscribes to real-time changes of the user's receipts
 */
export function subscribeToReceipts(
  userId: string,
  onReceiptsChange: (receipts: ReceiptItem[]) => void,
  onError?: (error: Error) => void
): () => void {
  const path = `users/${userId}/receipts`;
  const receiptsCollection = collection(db, "users", userId, "receipts");

  return onSnapshot(
    receiptsCollection,
    (snapshot) => {
      const items: ReceiptItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as ReceiptItem);
      });

      items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      onReceiptsChange(items);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

/**
 * Saves or updates an issued invoice in Firestore.
 * Always ensures a unique document to prevent overwriting.
 */
export async function saveInvoiceToFirestore(
  userId: string,
  invoice: IssuedInvoice
): Promise<string> {
  if (!userId || !invoice) {
    throw new Error("Missing required fields for invoice save");
  }

  // Ensure all fields are correctly typed for Firestore
  const cleanData = {
    ...invoice,
    totalHT: Number(invoice.totalHT || 0),
    totalTTC: Number(invoice.totalTTC || 0),
    vatAmount: Number(invoice.vatAmount || 0),
    vatRate: Number(invoice.vatRate || 0),
    items: invoice.items.map(item => ({
      ...item,
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      amount: Number(item.amount || 0)
    })),
    updatedAt: new Date().toISOString()
  };

  try {
    let invoiceDocRef;
    
    // If it's a new invoice (ID starts with 'inv_') or has no ID, create a new one with auto-ID
    if (!invoice.id || invoice.id.startsWith("inv_")) {
      const invoicesCollection = collection(db, "users", userId, "invoices");
      invoiceDocRef = doc(invoicesCollection);
    } else {
      invoiceDocRef = doc(db, "users", userId, "invoices", invoice.id);
    }

    const finalId = invoiceDocRef.id;
    const isTempId = !invoice.id || invoice.id.startsWith("inv_");
    await setDoc(invoiceDocRef, {
      ...cleanData,
      id: finalId,
      tempId: isTempId ? invoice.id : (invoice.tempId || null)
    }, { merge: true });
    
    return finalId;
  } catch (err) {
    const path = `users/${userId}/invoices/${invoice.id || "new"}`;
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

/**
 * Deletes an issued invoice from Firestore
 */
export async function deleteInvoiceFromFirestore(
  userId: string,
  invoiceId: string
): Promise<void> {
  const path = `users/${userId}/invoices/${invoiceId}`;
  const invoiceDocRef = doc(db, "users", userId, "invoices", invoiceId);
  try {
    await deleteDoc(invoiceDocRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Subscribes to real-time changes of the user's issued invoices
 */
export function subscribeToInvoices(
  userId: string,
  onInvoicesChange: (invoices: IssuedInvoice[]) => void
): () => void {
  const path = `users/${userId}/invoices`;
  const invoicesCollection = collection(db, "users", userId, "invoices");

  return onSnapshot(
    invoicesCollection,
    (snapshot) => {
      const items: IssuedInvoice[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as IssuedInvoice);
      });

      items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      onInvoicesChange(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

/**
 * Seeds initial mock receipts if the user's database is empty
 */
export async function seedInitialReceiptsIfEmpty(
  _userId: string,
  _defaultReceipts: ReceiptItem[]
): Promise<boolean> {
  // Disabled to prevent deleted receipts from reappearing as per user feedback
  return false;
}
