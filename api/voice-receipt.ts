import { processReceipt } from "./_app.ts";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { transcript, userId } = req.body || {};
    if (!transcript) {
      return res.status(400).json({ success: false, error: "Transcription manquante" });
    }

    const processed = await processReceipt({
      userId: userId || "web_user",
      source: "voice",
      textContent: transcript,
      saveToDb: false // Web client handles saving
    });

    return res.status(200).json({
      success: true,
      data: processed
    });
  } catch (error: any) {
    console.error("Voice Receipt Error:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Erreur interne lors de l'analyse vocale" 
    });
  }
}
