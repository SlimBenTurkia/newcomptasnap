import { google } from "googleapis";
import { Readable } from "stream";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "OAuth token required" });
  }

  const token = authHeader.split(" ")[1];
  const { fileName, fileBase64, mimeType, folderId } = req.body;

  if (!fileBase64 || !fileName) {
    return res.status(400).json({ success: false, error: "File data missing" });
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: token });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    const buffer = Buffer.from(fileBase64.split(",")[1] || fileBase64, "base64");
    
    const fileMetadata = {
      name: fileName,
      parents: folderId ? [folderId] : [],
    };

    const media = {
      mimeType: mimeType || "image/jpeg",
      body: Readable.from(buffer),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, webViewLink, webContentLink",
    });

    res.status(200).json({
      success: true,
      fileId: response.data.id,
      viewLink: response.data.webViewLink,
      downloadLink: response.data.webContentLink,
    });
  } catch (err: any) {
    console.error("Vercel Drive Upload Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
