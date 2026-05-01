import { build } from "vite";
import { build as esbuild } from "esbuild";
import path from "path";
import fs from "fs";
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

// ── 2. Ensure PMTiles is present as a real file (not a symlink) ───────────────
// Vite copies public/ assets during build and resolves symlinks, but we
// explicitly re-copy here to guarantee the 114 MB file lands in dist/public
// as a raw byte stream. Capacitor's "cap sync" then pushes it to:
//   android/app/src/main/assets/public/maps/south_iraq.pmtiles
// where AAPT processes it with "noCompress 'pmtiles'" (see android/app/build.gradle).
// If the file were missing from dist/public, Android would show a blank map.
const pmtilesSrc = path.resolve(root, "client/src/assets/maps/south_iraq.pmtiles");
const pmtilesDst = path.resolve(root, "dist/public/maps/south_iraq.pmtiles");

if (fs.existsSync(pmtilesSrc)) {
  fs.mkdirSync(path.dirname(pmtilesDst), { recursive: true });
  // Always copy (overwrite) so we never end up with a symlink in dist/
  fs.copyFileSync(pmtilesSrc, pmtilesDst);
  const sizeMB = (fs.statSync(pmtilesDst).size / 1024 / 1024).toFixed(1);
  console.log(`✅ PMTiles copied → dist/public/maps/south_iraq.pmtiles (${sizeMB} MB)`);
} else {
  console.warn("⚠️  PMTiles source not found at", pmtilesSrc, "— skipping copy.");
}

// ── 3. Ensure RTL text plugin is present for offline APK ─────────────────────
// The plugin was already copied to client/public/ so Vite includes it in the
// Vite build output. This step is a safety-net for environments where
// client/public/ is not processed (e.g. manual cap sync without a fresh build).
const rtlSrc = path.resolve(root, "node_modules/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js");
const rtlDst = path.resolve(root, "dist/public/mapbox-gl-rtl-text.js");
if (fs.existsSync(rtlSrc) && !fs.existsSync(rtlDst)) {
  fs.copyFileSync(rtlSrc, rtlDst);
  console.log("✅ RTL text plugin copied → dist/public/mapbox-gl-rtl-text.js");
}

// ── 4. Build backend (esbuild) ───────────────────────────────────────────────
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
