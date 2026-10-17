import { google } from "googleapis";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "OAuth token required" });
  }

  const token = authHeader.split(" ")[1];
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: token });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    // Search for folder
    const searchResponse = await drive.files.list({
      q: "name = 'ComptaSnap Justificatifs' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: "files(id, name)",
      spaces: "drive",
    });

    let folderId = "";
    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      folderId = searchResponse.data.files[0].id!;
    } else {
      // Create folder
      const createResponse = await drive.files.create({
        requestBody: {
          name: "ComptaSnap Justificatifs",
          mimeType: "application/vnd.google-apps.folder",
          description: "Dossier dédié pour les justificatifs stockés via l'application ComptaSnap.",
        },
        fields: "id",
      });
      folderId = createResponse.data.id!;
    }

    res.status(200).json({ success: true, folderId });
  } catch (err: any) {
    console.error("Vercel Drive Folder Init Error:", err);
    const code = Number(err?.code || err?.response?.status);
    const status = code === 401 || code === 403 ? code : 500;
    res.status(status).json({ success: false, error: err.message, code: status === 500 ? undefined : "drive_auth" });
  }
}
