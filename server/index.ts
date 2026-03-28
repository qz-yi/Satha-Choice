import path from "path";
import fs from "fs"; // تم إضافة هذا السطر هنا لمنع الكراش
import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import cors from 'cors';

const app = express();

// ── CORS ────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://satha-iq.com",
  "http://satha-iq.com",
  "https://www.satha-iq.com",
  "http://www.satha-iq.com",
  "capacitor://localhost",
  "https://localhost",
  "http://localhost",
  "http://localhost:5000",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      // تحديث: السماح لروابط Replit تلقائياً لضمان عمل التطبيق أثناء التطوير
      if (ALLOWED_ORIGINS.includes(origin) || origin.includes("replit.dev")) {
        return callback(null, true);
      }
      if (/^https?:\/\/([a-z0-9-]+\.)?satha-iq\.com$/.test(origin)) {
        return callback(null, true);
      }
      console.warn(`[CORS] Blocked origin: ${origin}`);
      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
    allowedHeaders: ["Content-Type","Authorization","Accept","X-Requested-With"],
    exposedHeaders: ["Set-Cookie"],
    optionsSuccessStatus: 200,
  })
);

const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  // تم الإصلاح: تغيير المتغير إلى reqPath لمنع تضارب الأسماء مع مكتبة path
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });
  next();
});

(async () => {
  try {
    const { ensureDatabaseSchema } = await import('./database-init');
    await ensureDatabaseSchema();
  } catch (error) {
    console.error('⚠️ [SERVER] Database migration failed');
  }

  // تسجيل الروابط (الـ API أولاً)
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  // ── تحسين تشغيل الملفات الثابتة (حل مشكلة الشاشة البيضاء) ──────────────────
  if (process.env.NODE_ENV === "production" || process.env.REPL_ID) {
    // تحديد المسار بدقة، والبحث في dist أو dist/public
    const distPath = path.resolve(process.cwd(), "dist");
    const publicPath = path.resolve(distPath, "public");

    // تم الإصلاح الجذري: إزالة الأقواس وعلامات التنصيص لتصبح مكتبة فعلية بدل نص
    const finalPath = fs.existsSync(publicPath) ? publicPath : distPath;

    app.use(express.static(finalPath, {
      // تم الإصلاح: تغيير المتغير إلى filePath لمنع التضارب
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        }
      }
    }));

    app.get("*", (req, res, next) => {
      // إذا كان الطلب ليس لـ API وليس لملف (لا يحتوي على نقطة)، أرسل index.html
      if (!req.path.startsWith("/api") && !req.path.includes(".")) {
        return res.sendFile(path.resolve(finalPath, "index.html"), (err) => {
          if (err) next();
        });
      }
      next();
    });
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port} [Mode: ${process.env.NODE_ENV || 'development'}]`);
    },
  );
})();