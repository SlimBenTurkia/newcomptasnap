import { processReceipt } from "../_app.ts";
import { v4 as uuidv4 } from "uuid";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  // Hypothetical email payload structure
  const { from, subject, attachments, text, to } = req.body;

  if (!attachments || attachments.length === 0) {
    return res.status(200).json({ success: true, message: "No attachments found, skipping" });
  }

  // Identification simple de l'utilisateur via l'adresse 'to' ou 'from'
  const recipientEmail = (to || "").toLowerCase();
  const match = recipientEmail.match(/^([a-zA-Z0-9_-]+)@/);
  const targetUserId = match ? match[1] : "email_user";

  // Process first attachment
  const att = attachments[0];
  const fileContent = typeof att.content === 'string' ? att.content : "";
  const mediaBuffer = Buffer.from(fileContent, "base64");
  const mimeType = att.type || "image/jpeg";

  try {
    const processed = await processReceipt({
      userId: targetUserId,
      source: "email",
      mediaBuffer,
      mimeType,
      receiptId: `eml_${uuidv4().substring(0, 8)}`,
      notes: `Reçu par email de ${from}. Sujet: ${subject}`,
      saveToDb: true
    });

    return res.status(200).json({ success: true, receiptId: processed.id });
  } catch (err: any) {
    console.error("Email Webhook Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
