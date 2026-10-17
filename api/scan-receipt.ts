import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
  maxDuration: 60,
};

const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}: délai dépassé (${ms / 1000}s)`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });

export default async function handler(req: any, res: any) {
  // CORS Headers for Vercel deployment
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Méthode non autorisée. Utilisez POST.",
    });
  }

  try {
    const { imageBase64, mimeType = "image/jpeg", fileName = "receipt.jpg" } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: "Aucun fichier ou image fourni pour l'analyse OCR.",
      });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!groqApiKey && !geminiApiKey) {
      return res.status(503).json({
        success: false,
        error: "Aucune clé API (Groq ou Gemini) n'est configurée.",
      });
    }

    // Clean base64 prefix
    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "");

    const prompt = `Tu es un expert comptable certifié et un moteur d'OCR de haute précision pour les entreprises et indépendants en France.
Tu dois impérativement extraire les données et répondre au format JSON.
Lis attentivement et SANS INVENTER toutes les informations réelles imprimées sur cette pièce justificative (facture, reçu de caisse, billet, ticket CB ou note de frais).

RÈGLES CRITIQUES D'EXTRACTION STRICTE ET DE CLASSIFICATION :
1. "supplier": Nom EXACT du commerçant (ex: "SNCF Voyageurs", "Boulangerie Paul", "Amazon EU Sarl", "TotalEnergies", "Uber").
2. "date": Date au format AAAA-MM-JJ (YYYY-MM-DD).
3. "currency": Devise ('EUR', 'USD', 'GBP', 'CHF', etc.). Défaut 'EUR'.
4. "originalTotal": Montant total dans sa devise d'origine.
5. "exchangeRateToEUR": Taux de change estimé vers l'Euro. Si 'EUR', mets 1.0.
6. "totalTTC": Montant en EUROS TTC.
7. "vatAmount": Montant de la TVA (en euros).
8. "vatRate": Taux de TVA en pourcentage (20, 10, 5.5, 2.1 ou 0).
9. "category": Choisis parmi : 'Restaurant', 'Transport', 'Hébergement', 'Logiciel', 'Matériel', 'Télécom', 'Fournitures', 'Honoraires', 'Marketing', 'Frais bancaires', 'Formation', 'Autre'.
10. "expenseType": Libellé clair (ex: "Repas d'affaires", "Billet de train (SNCF)").
11. "accountingCode": Numéro PCG adapté (6256, 6251, 6181, 6063, 6064, 6260, 6226, 6230, 6270, 6160, 6184, 6580).
12. "taxDeductibility": 'deductible', 'partielle', 'non_deductible', 'sans_tva'.
13. "invoiceNumber": Numéro de facture ou ticket.
14. "paymentMethod": Moyen de paiement.
15. "extractedLines": Tableau de strings des lignes les plus pertinentes.
16. "rawOcrText": Extrait court (max 300 car) du texte brut.
17. "confidence": Score de confiance entre 0 et 100.`;

    const startedAt = Date.now();
    const geminiErrors: string[] = [];
    let extractedData: any = null;
    let usedModel = "";

    // Strategy 1: Groq Vision (Ultra fast)
    if (groqApiKey) {
      const groq = new Groq({ apiKey: groqApiKey, timeout: 20000, maxRetries: 0 });
      const visionModels = ["meta-llama/llama-4-scout-17b-16e-instruct"];
      
      for (const modelName of visionModels) {
        try {
          console.log(`[OCR] Tentative avec Groq Vision: ${modelName}`);
          const response = await withTimeout(groq.chat.completions.create({
            model: modelName,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${mimeType};base64,${cleanBase64}`
                    }
                  }
                ]
              }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
            max_tokens: 1000
          }), 22000, "Groq");

          const textOutput = response.choices[0]?.message?.content || "{}";
          extractedData = JSON.parse(textOutput);
          usedModel = `Groq:${modelName}`;
          break;
        } catch (err: any) {
          console.warn(`[OCR] Échec Groq ${modelName}:`, err?.message);
          geminiErrors.push(`Groq ${modelName}: ${String(err?.message || err).slice(0, 150)}`);
        }
      }
    }

    // Strategy 2: Gemini Fallback
    if (!extractedData && geminiApiKey) {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey, httpOptions: { timeout: 20000 } });
      const geminiModels = ["gemini-flash-latest", "gemini-3.5-flash"];
      for (const modelName of geminiModels) {
        if (Date.now() - startedAt > 30000) break; // reste sous maxDuration (60s)
        try {
          console.log(`[OCR] Tentative avec Gemini: ${modelName}`);
          const result = await withTimeout(ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                { text: prompt },
                { inlineData: { data: cleanBase64, mimeType: mimeType } }
              ]
            }
          }), 22000, "Gemini");
          const responseText = result.text || "{}";
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            extractedData = JSON.parse(jsonMatch[0]);
            usedModel = `Gemini:${modelName}`;
            break;
          }
        } catch (err: any) {
          console.error(`[OCR] Échec Gemini ${modelName}:`, err?.message);
          geminiErrors.push(`${modelName}: ${String(err?.message || err).slice(0, 150)}`);
        }
      }
    }

    if (!extractedData) {
      return res.status(500).json({
        success: false,
        error: "Échec de l'analyse OCR avec tous les moteurs disponibles. L'image est peut-être trop lourde ou illisible.",
        details: geminiErrors,
      });
    }

    // Standardize results
    const cur = extractedData.currency || "EUR";
    const finalTotalTTC = Number(extractedData.totalTTC) || 0;
    const finalOrigTotal = Number(extractedData.originalTotal) || finalTotalTTC;
    const finalVatRate = Number(extractedData.vatRate) ?? 20;
    let finalVatAmount = Number(extractedData.vatAmount);
    if (isNaN(finalVatAmount) || finalVatAmount < 0) {
      finalVatAmount = finalTotalTTC > 0 ? Number((finalTotalTTC - finalTotalTTC / (1 + finalVatRate / 100)).toFixed(2)) : 0;
    }

    return res.status(200).json({
      success: true,
      modelUsed: usedModel,
      data: {
        supplier: extractedData.supplier || "Fournisseur non précisé",
        date: extractedData.date || new Date().toISOString().split("T")[0],
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
        invoiceNumber: extractedData.invoiceNumber || "",
        paymentMethod: extractedData.paymentMethod || "Carte Bancaire",
        confidence: Number(extractedData.confidence) || 90,
        extractedLines: extractedData.extractedLines || [],
        rawOcrText: extractedData.rawOcrText || "",
      },
    });
  } catch (error: any) {
    console.error("[Vercel Serverless OCR Error]:", error);
    return res.status(500).json({
      success: false,
      error: "Délai dépassé ou erreur d'analyse interne. Veuillez réessayer avec une image plus légère.",
    });
  }
}

