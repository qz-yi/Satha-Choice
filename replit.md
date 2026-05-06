# Satha - Tow Truck Request Application

A tow truck service app for Arabic-speaking users (RTL) connecting customers needing towing with available drivers.

## Run & Operate

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server (Express + Vite middleware) on port 5000 |
| `npm run build` | Build frontend (Vite → dist/public) + backend (esbuild → dist/index.cjs) |
| `npm start` | Run production build |
| `npm run db:push` | Push Drizzle schema changes to the database |

**Required env vars (managed by Replit Secrets):** `DATABASE_URL`, `SESSION_SECRET`

**Optional env vars:** `MAPTILER_API_KEY` (server-side directions), `GOOGLE_MAPS_API_KEY` (fallback routing)

## Stack

- **Runtime:** Node.js 20, TypeScript (ESM)
- **Frontend:** React 19, Vite 7, Wouter (routing), TanStack Query, Framer Motion, Tailwind CSS, shadcn/ui
- **Backend:** Express 4, Socket.IO 4
- **ORM:** Drizzle ORM with PostgreSQL (`pg`)
- **Maps:** MapLibre GL JS v5 — MapTiler Streets online tiles
- **Mobile:** Capacitor (Android wrapper around the Vite web build)
- **Build:** `tsx` (dev), esbuild (server bundle), Vite (client bundle)

## Where things live

```
client/        React frontend (src/pages, src/components)
server/        Express backend (routes.ts, db.ts, notificationService.ts)
shared/        Schema + types shared by client and server
script/        Build script (esbuild + Vite)
dist/          Build output (dist/index.cjs + dist/public/)
android/       Capacitor native Android project
```

- **DB schema:** `shared/schema.ts`
- **API routes:** `server/routes.ts`
- **Map component:** `client/src/components/SathaMap.tsx`
- **Theme/styles:** `tailwind.config.cjs`, `client/src/index.css`

## Architecture decisions

- Dev server runs Express on port 5000 with Vite in middleware mode — one process serves both API and frontend
- Auth is custom phone+password (no external provider); identity stored client-side in `localStorage`
- Admin login is client-side only with a hardcoded password (no server-side session protection)
- Firebase push notifications silently skip if no `server/config/*.json` service-account file is present
- ZainCash payment gateway uses test credentials hardcoded in `server/routes.ts`; electronic top-up shows a "coming soon" modal to users
- MapTiler API key (`ZgzumFORbF7swvFCViRi`) is embedded in the frontend for map tiles

## Product

- **Customers:** request tow trucks (small/large/hydraulic), pick locations on map, track status, pay via wallet
- **Drivers:** accept/complete requests, manage availability, wallet balance
- **Admin dashboard:** manage drivers, requests, commission percentage, wallet adjustments, force-complete orders
- **Real-time:** Socket.IO for live request/driver status updates

## User preferences

- Simple, everyday language (Arabic-first UI, Arabic comments in code)

## Gotchas

- `tsx` must be invoked as `npx tsx` (not bare `tsx`) — it's a local dev dependency, not globally installed
- Vite config requires `allowedHosts: true` for Replit's proxied preview to work
- CORS allows `*.replit.dev` and `*.replit.app` origins automatically
- The `script/build.ts` build script copies the PMTiles map file — this is no longer needed (tiles are served online via MapTiler)
- `capacitor.config.ts` uses `androidScheme: 'http'` — required for Android WebView range requests
- Use `import.meta.env.VITE_*` (not `process.env.VITE_*`) in all client code — Vite replaces these at build time
- Commission math: `fee = Math.round((price × commissionPercent) / 100)` — `commissionAmount` in DB is a percentage (0–100), not a fixed IQD amount
- `adminCommission` + `status=completed` are written atomically in one SQL UPDATE to prevent race conditions
- Firebase FCM requires `server/config/*.json` service-account file — silently no-ops if missing

## Pointers

- Drizzle config: `drizzle.config.ts`
- Capacitor config: `capacitor.config.ts`
- Hetzner deployment guide: `HETZNER_DEPLOY.md`
- Deployment guide (legacy): `DEPLOYMENT_GUIDE.md`
