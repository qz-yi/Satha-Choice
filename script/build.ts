import { build } from "vite";
import { build as esbuild } from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ── 1. Build frontend (Vite) ─────────────────────────────────────────────────
console.log("📦 Building frontend...");
await build({
  configFile: path.resolve(root, "vite.config.ts"),
  root: path.resolve(root, "client"),
  build: {
    outDir: path.resolve(root, "dist/public"),
    emptyOutDir: true,
  },
});
console.log("✅ Frontend built successfully.");

// ── 2. Build backend (esbuild) ───────────────────────────────────────────────
console.log("📦 Building backend...");
await esbuild({
  entryPoints: [path.resolve(root, "server/index.ts")],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outfile: path.resolve(root, "dist/index.cjs"),
  external: ["./vite", "../vite.config"],
  packages: "external",
});
console.log("✅ Backend built successfully.");
