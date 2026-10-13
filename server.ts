console.log("[SERVER] Initializing...");
import app from './api/_app.ts';

const PORT = 3000;

async function startServer() {
  console.log("[SERVER] Starting local development server...");
  if (process.env.NODE_ENV !== "production") {
    try {
      console.log("[SERVER] Integrating Vite middleware...");
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("[SERVER] Vite middleware integrated.");
    } catch (e) {
      console.error("[SERVER] Vite integration failed:", e);
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] ComptaSnap running on http://0.0.0.0:${PORT}`);
  });
}

// Start the server
// In AI Studio Dev, we always want the server to start unless explicitly in a serverless production environment
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  startServer().catch(err => {
    console.error("[SERVER] FAILED TO START:", err);
  });
}

export default app;
