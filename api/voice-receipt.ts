import Groq from "groq-sdk";

const CATEGORIES = [
  "Restaurant", "Transport", "Hébergement", "Logiciel", "Matériel", "Télécom",
  "Fournitures", "Honoraires", "Marketing", "Frais bancaires", "Formation", "Autre",
];

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("L'IA a mis trop de temps à répondre. Réessayez.")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });

const num = (v: unknown, fallback = 0): number => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};
const str = (v: unknown): string => String(v ?? "").trim();

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method Not Allowed" });

  try {
    const { transcript } = req.body || {};
    if (!transcript || !String(transcript).trim()) {
      return res.status(400).json({ success: false, error: "Transcription manquante" });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: "GROQ_API_KEY non configurée sur le serveur" });
    }

    const today = new Date().toISOString().split("T")[0];
    const groq = new Groq({ apiKey, timeout: 25000, maxRetries: 0 });

    const systemPrompt = `Tu es un assistant comptable français. L'utilisateur dicte à voix haute une dépense ou une recette.
Extrais les informations SANS RIEN INVENTER et réponds uniquement avec un objet JSON contenant :
- "supplier": nom du commerçant/fournisseur/client (texte). Si absent, "Fournisseur non précisé".
- "date": au format AAAA-MM-JJ. Aujourd'hui est le ${today} ("hier", "lundi dernier"... se calculent à partir de cette date). Par défaut ${today}.
- "currency": code devise (EUR par défaut).
- "originalTotal": montant total dans la devise d'origine (nombre).
- "exchangeRateToEUR": taux vers l'euro (1 si EUR).
- "totalTTC": montant TTC en euros (nombre).
- "vatRate": taux de TVA en % (20, 10, 5.5, 2.1 ou 0), 20 par défaut.
- "vatAmount": montant de la TVA en euros (nombre).
- "category": une valeur parmi ${CATEGORIES.join(", ")}.
- "expenseType": libellé court en français (ex: "Repas d'affaires").
- "accountingCode": numéro de compte PCG sous forme de texte (ex: "6256").
- "taxDeductibility": "deductible", "partielle", "non_deductible" ou "sans_tva".
- "paymentMethod": moyen de paiement (défaut "Carte Bancaire").
- "type": "expense" ou "income".
- "confidence": entier entre 0 et 100.`;

    const completion = await withTimeout(
      groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Dictée à analyser : ${String(transcript).slice(0, 2000)}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
      28000
    );

    const raw = completion.choices[0]?.message?.content || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const totalTTC = num(parsed.totalTTC) || num(parsed.originalTotal);
    if (!(totalTTC > 0)) {
      return res.status(422).json({
        success: false,
        error: "Je n'ai pas compris le montant. Répétez par exemple : « Restaurant Le Zinc, 45 euros, hier ».",
      });
    }

    const vatRate = num(parsed.vatRate, 20);
    const vatAmount = parsed.vatAmount !== undefined && parsed.vatAmount !== null && Number.isFinite(num(parsed.vatAmount, NaN))
      ? num(parsed.vatAmount)
      : Number((totalTTC - totalTTC / (1 + vatRate / 100)).toFixed(2));
    const category = CATEGORIES.includes(str(parsed.category)) ? str(parsed.category) : "Autre";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(str(parsed.date)) ? str(parsed.date) : today;

    const data = {
      transactionType: parsed.type === "income" ? "income" : "expense",
      supplier: str(parsed.supplier) || "Fournisseur non précisé",
      date,
      currency: (str(parsed.currency) || "EUR").toUpperCase(),
      originalTotal: num(parsed.originalTotal) || totalTTC,
      exchangeRate: num(parsed.exchangeRateToEUR, 1) || 1,
      totalTTC,
      vatAmount,
      vatRate,
      category,
      expenseType: str(parsed.expenseType),
      accountingCode: str(parsed.accountingCode),
      taxDeductibility: ["deductible", "partielle", "non_deductible", "sans_tva"].includes(str(parsed.taxDeductibility))
        ? str(parsed.taxDeductibility)
        : "deductible",
      paymentMethod: str(parsed.paymentMethod) || "Carte Bancaire",
      invoiceNumber: "",
      notes: `Dictée : "${String(transcript).trim().slice(0, 300)}"`,
      confidence: Math.min(100, Math.max(0, Math.round(num(parsed.confidence, 90)))),
      extractionSource: "groq-ai",
      standardizedName: `${date}_VOCAL_${totalTTC.toFixed(2).replace(".", "-")}EUR.txt`,
    };

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("Voice Receipt Error:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Erreur interne lors de l'analyse vocale",
    });
  }
}
