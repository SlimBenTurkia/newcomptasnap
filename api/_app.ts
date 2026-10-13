import express from "express";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage, getDownloadURL } from "firebase-admin/storage";
import Groq from "groq-sdk";
import axios from "axios";
import { Readable } from "stream";

import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// --- CRASH PREVENTION (GLOBAL) ---
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception thrown:', error);
});

// Initialize Firebase Admin for server-side operations
if (getApps().length === 0) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const databaseId = "ai-studio-comptasnap-4dd576d2-b96d-4d70-9f1b-678a9fbf5b0b";

  console.log(`Initialisation Firebase Admin: Project=${projectId || "default"}, DB=${databaseId}`);

  if (serviceAccount) {
    try {
      const parsedServiceAccount = JSON.parse(serviceAccount);
      initializeApp({
        credential: cert(parsedServiceAccount),
        projectId: projectId || parsedServiceAccount.project_id,
        storageBucket: `${projectId || parsedServiceAccount.project_id}.firebasestorage.app`
      });
      console.log("Firebase Admin initialisé avec SERVICE_ACCOUNT et bucket storage.");
    } catch (err: any) {
      console.error("ERREUR SERVICE_ACCOUNT:", err.message);
      initializeApp();
    }
  } else {
    initializeApp();
  }
}

// Explicitly target the correct database instance
const dbAdmin = getFirestore("ai-studio-comptasnap-4dd576d2-b96d-4d70-9f1b-678a9fbf5b0b");

// Helper function for sending Telegram messages
async function sendTelegramMessage(chatId: string | number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN manquant !");
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML"
      })
    });

    const data: any = await response.json();
    if (!data.ok) console.error("Erreur API Telegram:", data);
  } catch (err) {
    console.error("Erreur réseau Telegram:", err);
  }
}

const app = express();

// Increase payload limit for large base64 images and audio transcripts
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Explicit CORS configuration for robustness
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
  credentials: true
}));

// --- PUBLIC ROUTES ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/diag/firestore", async (req, res) => {
  try {
    await dbAdmin.collection("_health").limit(1).get();
    res.json({ success: true, message: "Firestore is reachable" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/telegram-webhook", async (req, res) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const groqKey = process.env.GROQ_API_KEY;

    if (!botToken || !groqKey) {
      return res.status(500).json({ error: "Missing bot credentials" });
    }

    const update = req.body;
    console.log("UPDATE REÇU :", JSON.stringify(update));
    
    let message = update?.message || update?.edited_message || update?.callback_query?.message;
    
    if (typeof update === 'string') {
      try {
        const parsed = JSON.parse(update);
        message = parsed?.message || parsed?.edited_message || parsed?.callback_query?.message;
      } catch (e) {}
    }
    
    if (!message || !message.chat) {
      console.log("[TELEGRAM_WEBHOOK] No valid message found in update:", JSON.stringify(update));
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const fromId = message.from?.id;
    const text = message.text || message.caption; // Capture text from captions (often used with photos)

    // --- PHOTO DETECTION DEBUG ---
    if (message.photo && message.photo.length > 0) {
      const photoFileId = message.photo[message.photo.length - 1].file_id;
      console.log("PHOTO TROUVÉE ! file_id:", photoFileId);
    } else {
      console.log("AUCUNE PHOTO DÉTECTÉE DANS CE MESSAGE. Objet message :", JSON.stringify(message));
    }
    // ----------------------------

    // --- DEBUG MESSAGE ---
    const debugMsg = `DEBUG -> texte: ${!!text}, photo: ${!!message.photo}, nb_photos: ${message.photo ? message.photo.length : 0}`;
    await sendTelegramMessage(chatId, debugMsg);
    // ---------------------

    // Use fromId if available, fallback to chatId
    const effectiveTelegramId = String(fromId || chatId);

    if (!effectiveTelegramId) {
      console.log("[TELEGRAM_WEBHOOK] No effective ID found, skipping.");
      return res.status(200).json({ ok: true });
    }

    const groq = new Groq({ apiKey: groqKey });
    
    // Search user with detailed logging
    console.log(`[TELEGRAM_WEBHOOK] Searching for user with telegramId: "${effectiveTelegramId}"`);
    const usersSnap = await dbAdmin.collection("users")
      .where("telegramId", "==", effectiveTelegramId)
      .limit(1)
      .get();
    
    let userDoc = usersSnap.empty ? null : usersSnap.docs[0];

    if (!userDoc) {
      console.log(`[TELEGRAM_WEBHOOK] No user found for telegramId: "${effectiveTelegramId}"`);
      
      let token = null;
      if (text && text.startsWith("/start ")) {
        token = text.split(" ")[1];
      } else if (text && text.length >= 6 && text.length <= 12) {
        // Assume it might be a token if it's a short text message
        token = text.trim().toUpperCase();
      }

      if (token) {
        console.log(`[TELEGRAM_WEBHOOK] Attempting to link with token: "${token}"`);
        const linkSnap = await dbAdmin.collection("users")
          .where("telegramToken", "==", token)
          .limit(1)
          .get();
        
        if (!linkSnap.empty) {
          const foundUser = linkSnap.docs[0];
          const targetUid = foundUser.id;
          console.log(`[TELEGRAM_WEBHOOK] Token matched! Linking to user: ${targetUid}`);
          
          await dbAdmin.collection("users").doc(targetUid).set({ 
            telegramId: effectiveTelegramId, 
            telegramToken: null, // Clear token after use
            isLinked: true,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          
          console.log(`[TELEGRAM_WEBHOOK] Successfully linked ${effectiveTelegramId} to ${targetUid}`);
          await sendTelegramMessage(chatId, "✅ <b>Compte lié avec succès !</b>\n\nVous pouvez maintenant m'envoyer vos justificatifs par :\n📸 <b>Photo</b> (reçu, facture)\n🎙 <b>Vocal</b> (ex: \"J'ai payé 15€ chez Paul ce midi\")\n✍️ <b>Texte</b> (ex: \"Amazon 45.90€\")");
          return res.status(200).json({ ok: true });
        } else if (text && text.startsWith("/start ")) {
          console.log(`[TELEGRAM_WEBHOOK] Invalid /start token provided: "${token}"`);
          await sendTelegramMessage(chatId, "❌ Code de liaison invalide ou expiré.");
          return res.status(200).json({ ok: true });
        }
        // If it wasn't a /start command but just text, and no token found, we fall through to welcome message
      }

      console.log("[TELEGRAM_WEBHOOK] User not linked. Sending welcome/help message.");
      await sendTelegramMessage(chatId, "👋 <b>Bienvenue sur ComptaSnap !</b>\n\nPour lier votre compte, veuillez envoyer ici le <b>code de liaison</b> affiché dans votre profil sur l'application web.\n\n👉 <i>Exemple : ABCD1234</i>");
      
      return res.status(200).json({ ok: true });
    }

    console.log(`[TELEGRAM_WEBHOOK] User identified: ${userDoc.id}`);
    const userId = userDoc.id;
    const receiptId = `tg_${Date.now()}`;
    let persistedImageUrl: string | null = null;
    
    // --- SHARED EXPERT PROMPT (Synchronized with web upload) ---
    const extractionPrompt = `Tu es un expert comptable certifié et un moteur d'OCR de haute précision pour les entreprises et indépendants en France.
Tu dois impérativement extraire les données et répondre au format JSON.
Lis attentivement et SANS INVENTER toutes les informations réelles imprimées sur cette pièce justificative (facture, reçu de caisse, billet, ticket CB ou note de frais).

RÈGLES CRITIQUES D'EXTRACTION STRICTE ET DE CLASSIFICATION :
1. "supplier": Lis le nom EXACT du commerçant ou fournisseur inscrit sur le document (ex: "SNCF Voyageurs", "Boulangerie Paul", "Amazon EU Sarl", "TotalEnergies", "Leroy Merlin", "Restaurant Le Zinc", "Uber", "Figma", "Apple Store", etc.). N'invente rien ! Si illisible, écris "Fournisseur non identifié".
2. "date": Cherche la date exacte imprimée sur le ticket/facture au format AAAA-MM-JJ (YYYY-MM-DD). Ex: "14/09/2026" ou "14/09/26" devient "2026-09-14".
3. "currency": Devise d'origine du document ('EUR', 'USD', 'GBP', 'CHF', 'CAD', 'JPY', etc.). Si symbole $, mets 'USD'. Si £, mets 'GBP'. Si €, mets 'EUR'. Défaut 'EUR'.
4. "originalTotal": Montant total réel imprimé dans sa devise d'origine (ex: 49.00 pour $49.00). Nombre décimal positif.
5. "exchangeRateToEUR": Taux de change estimé vers l'Euro (ex: 1 USD ≈ 0.92 EUR, 1 GBP ≈ 1.18 EUR, 1 CHF ≈ 1.05 EUR, 1 CAD ≈ 0.68 EUR). Si la devise est 'EUR', mets 1.0.
6. "totalTTC": Montant équivalent en EUROS TTC pour la comptabilité française. Si la devise est 'EUR', égal à originalTotal. Si devise étrangère, calcul indicatif : originalTotal * exchangeRateToEUR.
7. "vatAmount": Montant de la TVA (en euros). Si TVA non applicable (auto-entrepreneur, facture étrangère sans TVA FR art 293 B du CGI ou 0%), mets 0.
8. "vatRate": Taux de TVA en pourcentage (20, 10, 5.5, 2.1 ou 0).
9. "category": Catégorise STRICTEMENT selon les normes comptables françaises parmi :
   - 'Restaurant' : Repas d'affaires, déjeuner client, invitation restaurant, café, traiteur, boulangerie lors d'une mission.
   - 'Transport' : Billets de train (SNCF), métro/RATP, bus, avion, taxi, VTC (Uber, Bolt), carburant/essence, péage, stationnement.
   - 'Hébergement' : Hôtel, nuitée de déplacement, Airbnb professionnel, taxe de séjour.
   - 'Logiciel' : Abonnements SaaS, hébergement web (AWS, OVH), GitHub, OpenAI, Figma, Adobe, licences cloud, noms de domaine.
   - 'Matériel' : Équipements informatiques (PC portable, écran, smartphone), outillage, périphériques (< 500€ HT en charge immédiate).
   - 'Télécom' : Forfaits mobile pro, box internet / fibre, téléphonie fixe.
   - 'Fournitures' : Papeterie, consommables de bureau, toners, timbres, La Poste, envois de colis.
   - 'Honoraires' : Prestations d'avocat, expert-comptable, consultants, sous-traitance freelance, formalités légales.
   - 'Marketing' : Publicité (Google Ads, Meta Ads), création de site, salons pro, flyers, cartes de visite, goodies.
   - 'Frais bancaires' : Cotisations carte bancaire pro, frais de compte, assurances pros (RC Pro).
   - 'Formation' : Livres et documentation professionnelle, cours, certifications.
   - 'Autre' : Autres charges d'exploitation déductibles.
10. "expenseType": Qualifie PRÉCISÉMENT le type de dépense sous forme de libellé analytique clair et professionnel en français (ex: "Repas d'affaires (invitation client)", "Repas individuel de déplacement", "Billet de train (SNCF / TGV)", "Course Taxi / VTC", "Carburant & Station-service", "Péage autoroutier", "Hôtel & Nuitée professionnelle", "Abonnement logiciel SaaS / Cloud", "Achat matériel informatique", "Forfait mobile / Internet", "Fournitures de bureau & Papeterie", "Honoraires d'expertise comptable", "Campagne publicitaire Ads", "Cotisation bancaire pro").
11. "accountingCode": Numéro de compte Plan Comptable Général (PCG) français le plus adapté : '6256', '6251', '6181', '6063', '6064', '6260', '6226', '6230', '6270', '6160', '6184', '6580'.
12. "taxDeductibility": 'deductible', 'partielle', 'non_deductible', 'sans_tva'.
13. "invoiceNumber": Numéro de facture ou ticket de caisse réel trouvé sur le document.
14. "paymentMethod": Moyen de paiement réel mentionné (ex: "Carte Bancaire", "Espèces", etc.).
15. "extractedLines": Liste contenant les lignes de texte les plus pertinentes.
16. "rawOcrText": Un court extrait (max 300 caractères) du texte brut le plus lisible.`;

    let extractedData: any = null;
    let mediaBuffer: Buffer | null = null;
    const hasPhoto = message.photo && message.photo.length > 0;
    const hasAudio = message.voice || message.audio;

    try {
      if (hasPhoto) {
        await sendTelegramMessage(chatId, "⏳ <b>Analyse de l'image en cours...</b>");
        const photo = message.photo[message.photo.length - 1];
        const fileId = photo.file_id;
        console.log(`[TELEGRAM_WEBHOOK] PHOTO CAPTURÉE, file_id: ${fileId}`);
        
        try {
          console.log(`[TELEGRAM_WEBHOOK] Calling getFile for fileId: ${fileId}`);
          const fileInfoRes = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
          console.log("[TELEGRAM_WEBHOOK] getFile response:", JSON.stringify(fileInfoRes.data));
          
          if (fileInfoRes.data?.ok) {
            const filePath = fileInfoRes.data.result.file_path;
            const directUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
            persistedImageUrl = directUrl;
            console.log("URL DE LA PHOTO TELEGRAM :", persistedImageUrl);

            // We still need the buffer for Gemini vision analysis
            const imgRes = await axios.get(directUrl, { responseType: "arraybuffer" });
            mediaBuffer = Buffer.from(imgRes.data);
          }
        } catch (fileErr: any) {
          console.error("ERREUR TELEGRAM GETFILE/DOWNLOAD :", fileErr.message);
        }

        let response;
        try {
          console.log("[TELEGRAM_WEBHOOK] Using Groq Vision (Unified with web)...");
          response = await groq.chat.completions.create({
            model: "llama-3.2-11b-vision-preview",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: extractionPrompt },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${mediaBuffer?.toString("base64") || ""}`
                    }
                  }
                ]
              }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
            max_tokens: 800
          });
        } catch (visionErr: any) {
          console.error("ERREUR IA VISION (GROQ) :", visionErr);
          // Fallback to Gemini if Groq fails
          try {
            const geminiResponse = await ai.models.generateContent({
              model: "gemini-3.8-flash",
              contents: {
                parts: [
                  { text: extractionPrompt },
                  {
                    inlineData: {
                      data: mediaBuffer ? mediaBuffer.toString("base64") : "",
                      mimeType: "image/jpeg",
                    },
                  },
                ]
              },
            });
            const text = geminiResponse.text || "{}";
            extractedData = JSON.parse(text.replace(/```json|```/g, "").trim());
          } catch (geminiErr) {
            console.error("FALLBACK GEMINI FAILED:", geminiErr);
            await sendTelegramMessage(chatId, "❌ Erreur lors de l'analyse visuelle. Assurez-vous que l'image est bien lisible.");
            return res.status(200).json({ ok: true });
          }
        }

        if (!extractedData && response) {
          const responseText = response.choices[0]?.message?.content || "{}";
          try {
            extractedData = JSON.parse(responseText);
          } catch (parseErr) {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) extractedData = JSON.parse(jsonMatch[0]);
          }
        }
      } 
      else if (hasAudio) {
        await sendTelegramMessage(chatId, "⏳ <b>Transcription vocale et analyse...</b>");
        try {
          const media = message.voice || message.audio;
          console.log(`[TELEGRAM_WEBHOOK] AUDIO CAPTURÉ, file_id: ${media.file_id}`);
          
          const fileInfoRes = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${media.file_id}`);
          if (!fileInfoRes.data?.ok) {
            throw new Error("Impossible de récupérer les infos du fichier audio auprès de Telegram.");
          }

          const filePath = fileInfoRes.data.result.file_path;
          const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
          const audioRes = await axios.get(downloadUrl, { responseType: "arraybuffer" });
          mediaBuffer = Buffer.from(audioRes.data);

          // Transcription via Gemini (robust & fast)
          console.log("[TELEGRAM_WEBHOOK] Using Gemini for Audio transcription...");
          const transcriptionResponse = await ai.models.generateContent({
            model: "gemini-3.5-transcribe",
            contents: {
              parts: [
                {
                  inlineData: {
                    data: mediaBuffer.toString("base64"),
                    mimeType: "audio/ogg", // Telegram voice is usually OGG/Opus
                  },
                },
                { text: "Transcribe this audio precisely in French." }
              ]
            },
          });

          const transcriptText = transcriptionResponse.text?.trim();
          if (!transcriptText) {
            throw new Error("La transcription a renvoyé un texte vide.");
          }

          console.log(`[TELEGRAM_WEBHOOK] Transcription réussie : "${transcriptText}"`);

          // Re-use the same analysis logic (Groq)
          console.log("[TELEGRAM_WEBHOOK] Analyzing transcript with Groq...");
          const analysisResponse = await groq.chat.completions.create({
            model: "llama-3.1-70b-versatile",
            messages: [
              { role: "system", content: extractionPrompt },
              { role: "user", content: `Transcription vocale à analyser : ${transcriptText}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1
          });

          const responseText = analysisResponse.choices[0]?.message?.content || "{}";
          try {
            extractedData = JSON.parse(responseText);
          } catch (parseErr) {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) extractedData = JSON.parse(jsonMatch[0]);
          }

          if (extractedData) {
            extractedData.notes = `Vocal : "${transcriptText}"`;
          }
        } catch (audioErr: any) {
          console.error("ERREUR TRANSCRIPTION/ANALYSE VOCALE :", audioErr);
          await sendTelegramMessage(chatId, "🎙 <b>Désolé, je n'ai pas pu transcrire ton message vocal.</b> Peux-tu ré-essayer ou écrire le texte ?");
          return res.status(200).json({ ok: true });
        }
      } 
      else if (text) {
        // Skip linking tokens
        if (!(text.length >= 6 && text.length <= 12 && /^[A-Z0-9]+$/.test(text))) {
          console.log("[TELEGRAM_WEBHOOK] Using Groq for Text extraction (Unified)...");
          const response = await groq.chat.completions.create({
            model: "llama-3.1-70b-versatile",
            messages: [
              { role: "system", content: extractionPrompt },
              { role: "user", content: `Texte à analyser : ${text}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1
          });
          
          const responseText = response.choices[0]?.message?.content || "{}";
          try {
            extractedData = JSON.parse(responseText);
          } catch (parseErr) {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) extractedData = JSON.parse(jsonMatch[0]);
          }
        }
      }
    } catch (aiErr) {
      console.error("[TELEGRAM_WEBHOOK] AI Extraction Error:", aiErr);
      await sendTelegramMessage(chatId, "❌ Désolé, je n'ai pas réussi à analyser votre message. Pourriez-vous reformuler ou envoyer une photo plus claire ?");
      return res.status(200).json({ ok: true });
    }

    // Validation & Mapping: Ensure unified structure with web upload
    if (extractedData && (Number(extractedData.totalTTC) > 0 || extractedData.supplier)) {
      const now = new Date().toISOString();
      const receiptImageData = hasPhoto && mediaBuffer ? `data:image/jpeg;base64,${mediaBuffer.toString("base64")}` : null;
      const finalImageUrl = persistedImageUrl || receiptImageData;

      console.log("URL DE L'IMAGE INJECTÉE DANS FIRESTORE :", finalImageUrl);

      // Map to standard ReceiptItem fields (same as ScanModal.tsx / App.tsx)
      const cur = (extractedData.currency || "EUR").toUpperCase();
      const finalTotalTTC = Number(extractedData.totalTTC) || 0;
      const finalOrigTotal = Number(extractedData.originalTotal) || finalTotalTTC;
      const finalVatRate = Number(extractedData.vatRate) || 20;
      let finalVatAmount = Number(extractedData.vatAmount);
      if (isNaN(finalVatAmount) || finalVatAmount < 0) {
        finalVatAmount = finalTotalTTC > 0 ? Number((finalTotalTTC - finalTotalTTC / (1 + finalVatRate / 100)).toFixed(2)) : 0;
      }

      const newReceipt = {
        id: receiptId,
        userId,
        transactionType: extractedData.type === "income" ? "income" : "expense",
        supplier: (extractedData.supplier || "Fournisseur non identifié").trim(),
        date: extractedData.date || now.split("T")[0],
        currency: cur,
        originalTotal: finalOrigTotal,
        exchangeRate: Number(extractedData.exchangeRateToEUR) || 1.0,
        totalTTC: finalTotalTTC,
        vatAmount: finalVatAmount,
        vatRate: finalVatRate,
        category: extractedData.category || "Autre",
        expenseType: extractedData.expenseType || "",
        accountingCode: extractedData.accountingCode || "",
        taxDeductibility: extractedData.taxDeductibility || "deductible",
        status: "en_attente",
        paymentMethod: extractedData.paymentMethod || "Carte Bancaire",
        invoiceNumber: (extractedData.invoiceNumber || "").trim(),
        notes: extractedData.notes || (text ? `Message : "${text}"` : ""),
        aiExtracted: true,
        confidence: Number(extractedData.confidence) || 96,
        extractedLines: extractedData.extractedLines || [],
        rawOcrText: extractedData.rawOcrText || "",
        extractionSource: "groq-ai",
        source: message.voice ? "voice" : "upload",
        createdAt: now,
        updatedAt: now,
        fileName: hasPhoto ? `tg_photo_${Date.now()}.jpg` : "tg_message.txt",
        fileType: message.voice ? "voice" : "image",
        fileDataUrl: finalImageUrl,
        standardizedName: `${extractedData.date || now.split("T")[0]}_${(extractedData.supplier || "TG").replace(/[^a-z0-9]/gi, "_")}_${finalTotalTTC}EUR.jpg`,
        imageUrl: finalImageUrl, // Keep for backward compatibility if any
        justificatif: finalImageUrl, // Keep for backward compatibility if any
        normalizedExport: JSON.stringify(extractedData) 
      };

      console.log(`[TELEGRAM_WEBHOOK] Saving receipt to Firestore. ID: ${receiptId}`);
      console.log("[TELEGRAM_WEBHOOK] FINAL UNIFIED OBJECT:", JSON.stringify({ ...newReceipt, fileDataUrl: newReceipt.fileDataUrl ? "[IMAGE_DATA]" : null }));

      await dbAdmin.collection("users").doc(userId).collection("receipts").doc(receiptId).set(newReceipt);
      
      const typeLabel = newReceipt.transactionType === "income" ? "Recette" : "Dépense";
      let feedback = `✅ <b>${typeLabel} enregistrée !</b>\n\n` +
                       `🏪 <b>Fournisseur :</b> ${newReceipt.supplier}\n` +
                       `💰 <b>Montant :</b> ${newReceipt.totalTTC} ${newReceipt.currency}\n` +
                       `📅 <b>Date :</b> ${newReceipt.date}\n` +
                       `📁 <b>Catégorie :</b> ${newReceipt.category}`;
      
      if (newReceipt.invoiceNumber) {
        feedback += `\n🧾 <b>N° Facture :</b> ${newReceipt.invoiceNumber}`;
      }

      if (newReceipt.extractedLines && newReceipt.extractedLines.length > 0) {
        feedback += `\n\n📦 <b>Détails OCR :</b>\n`;
        newReceipt.extractedLines.slice(0, 5).forEach((line: string) => {
          feedback += `- ${line}\n`;
        });
        if (newReceipt.extractedLines.length > 5) feedback += `... (+${newReceipt.extractedLines.length - 5} lignes)`;
      }

      if (newReceipt.imageUrl) {
        feedback += `\n🖼 <b>Photo :</b> Enregistrée ✅`;
      }

      await sendTelegramMessage(chatId, feedback);
    } else if (text && !(text.length >= 6 && text.length <= 12 && /^[A-Z0-9]+$/.test(text))) {
      await sendTelegramMessage(chatId, "🤔 Je n'ai pas détecté de montant ou de fournisseur dans votre message. Pourriez-vous être plus précis ? (ex: '15€ restaurant')");
    }

    return res.status(200).json({ ok: true });
  } catch (globalErr: any) {
    console.error("CRITICAL WEBHOOK ERROR:", globalErr);
    return res.status(200).json({ ok: true, error: "Handled" });
  }
});

app.post("/api/telegram-link", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: "userId requis" });

    const token = Math.random().toString(36).substring(2, 10).toUpperCase();
    await dbAdmin.collection("users").doc(userId).set({
      uid: userId,
      telegramToken: token,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    return res.json({ success: true, token });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/telegram/setup", async (req, res) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const VERCEL_URL = process.env.VERCEL_URL || process.env.VITE_VERCEL_URL;
    const webhookUrl = VERCEL_URL ? `https://${VERCEL_URL}/api/telegram-webhook` : null;

    if (!botToken || !webhookUrl) {
      return res.status(500).json({ success: false, error: "Missing config for setup" });
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${webhookUrl}`);
    const data: any = await tgRes.json();
    return res.json({ success: data.ok, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.use((err: any, req: any, res: any, next: any) => {
  console.error("EXPRESS ERROR:", err);
  res.status(500).json({ success: false, error: "Internal Server Error", message: err.message });
});

export default app;
