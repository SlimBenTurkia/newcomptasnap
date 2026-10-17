import Groq from "groq-sdk";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { prompt, nextNumber } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ success: false, error: "Prompt manquant" });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("GROQ_API_KEY is missing");
      return res.status(500).json({ success: false, error: "API Key not configured" });
    }

    const groq = new Groq({ apiKey });

    const systemPrompt = `Tu es un assistant de facturation. Extrais les données d'une facture à partir du texte utilisateur au format JSON.
    Champs requis: clientName, date (AAAA-MM-JJ), items (description, quantity, amount), vatRate, totalHT, vatAmount, totalTTC.
    Utilise le numéro de facture suivant: FAC-${new Date().getFullYear()}-${String(nextNumber || 1).padStart(3, '0')}`;

    const response = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("L'IA n'a pas renvoyé de données pour la facture.");
    }

    const data = JSON.parse(content);
    // Add missing fields if necessary
    if (!data.invoiceNumber) {
      data.invoiceNumber = `FAC-${new Date().getFullYear()}-${String(nextNumber || 1).padStart(3, '0')}`;
    }
    if (!data.dueDate) {
      const date = new Date(data.date || Date.now());
      date.setDate(date.getDate() + 30);
      data.dueDate = date.toISOString().split("T")[0];
    }

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("Generate Invoice Error:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Erreur lors de la génération de la facture" 
    });
  }
}
