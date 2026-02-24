import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function serveStatic(app: Express) {
  // __dirname is reliable in CommonJS (dist/index.cjs).
  // But as a safety net we also try paths relative to process.cwd().
  const candidates = [
    path.resolve(__dirname, "public"),                      // dist/public (CJS bundle)
    path.resolve(process.cwd(), "dist", "public"),         // fallback: cwd/dist/public
    path.resolve(process.cwd(), "public"),                 // fallback: cwd/public
  ];

  const distPath = candidates.find((p) => fs.existsSync(p));

  if (!distPath) {
    console.error(
      "[static] Could not find build directory. Tried:\n" +
        candidates.map((p) => `  • ${p}`).join("\n") +
        "\nMake sure to run `npm run build` first."
    );
    // In production, return a helpful JSON error instead of crashing
    app.use("*", (_req, res) => {
      res.status(503).json({
        error: "Frontend not built",
        hint: "Run `npm run build` to generate the client bundle",
      });
    });
    return;
  }

  console.log(`[static] Serving static files from: ${distPath}`);

  // Serve assets with long cache; HTML with no-cache so updates deploy immediately
  app.use(
    express.static(distPath, {
      maxAge: "1y",
      index: false, // we handle index.html manually below
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      },
    })
  );

  // SPA fallback — send index.html for every non-API route
  app.use("*", (req, res) => {
    // Never send HTML for /api/* routes (prevents the <!doctype> JSON error)
    if (req.originalUrl.startsWith("/api/")) {
      return res.status(404).json({ message: "API route not found" });
    }
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
