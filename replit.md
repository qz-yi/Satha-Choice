# Satha - Tow Truck Request Application

## Overview

Satha is a tow truck service application built for Arabic-speaking users (RTL layout). The app connects customers who need vehicle towing services with available drivers. Customers can request tow trucks of different sizes (small, large, hydraulic), specify pickup and destination locations via interactive maps, and track their requests. Drivers have a dashboard to manage their availability, accept requests, and handle payments through a wallet system.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Forms**: React Hook Form with Zod validation via @hookform/resolvers
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Animations**: Framer Motion for smooth transitions
- **Maps**: MapLibre GL JS rendering offline vector tiles from a local PMTiles archive (`client/src/assets/maps/south_iraq.pmtiles`), served via symlink at `/maps/south_iraq.pmtiles`. The shared `<SathaMap>` component (`client/src/components/SathaMap.tsx`) registers the `pmtiles://` protocol, applies a custom Minimal Light style with Arabic (RTL) labels (`sathaMapStyle.ts`), locks the viewport to Iraq bounds, defaults to Hilla `[44.42, 32.48]` at zoom 12, and exposes a thin Leaflet-compatible shim (`Marker`/`Popup`/`Polyline`/`useMap`/`useMapEvents`/`L.divIcon`) so existing pages keep their original API. Hardware acceleration is enabled (antialias + `translate3d` on the canvas). Pickup/dropoff selection uses a fixed center crosshair (CSS overlay) plus a real geographic marker placed on confirm, so markers stick to the ground while the targeting pin stays centered.
- **Build Tool**: Vite with custom path aliases (@/, @shared/, @assets/)

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful endpoints under /api prefix
- **Validation**: Zod schemas shared between client and server
- **Database ORM**: Drizzle ORM with PostgreSQL dialect

### Data Layer
- **Database**: PostgreSQL
- **Schema Location**: shared/schema.ts (shared between frontend/backend)
- **Migrations**: Drizzle Kit (drizzle.config.ts)
- **Tables**:
  - `requests`: Tow truck requests with vehicle type, locations, status, pricing
  - `drivers`: Driver profiles with wallet balance and online status
  - `users`: Customer profiles with wallet balance

### Shared Code Pattern
The `shared/` directory contains code used by both client and server:
- `schema.ts`: Database table definitions and Zod insert schemas
- `routes.ts`: API contract definitions with type-safe input/output schemas

### Build Process
- Development: `tsx` runs TypeScript directly
- Production: Custom build script using esbuild (server) and Vite (client)
- Output: `dist/` directory with `index.cjs` (server) and `public/` (client assets)

## External Dependencies

### Database
- PostgreSQL via `DATABASE_URL` environment variable
- Connection pooling with `pg` package
- Session storage with `connect-pg-simple`

### Maps & Geolocation
- **Engine**: MapLibre GL JS v5 (NOT Leaflet — that dependency has been removed). **Online** — requires internet.
- **Unified map component**: `client/src/components/SathaMap.tsx` — all 4 in-app maps (request-flow ×2, driver-dashboard ×1, driver-tracking ×1) render through this single component. It exports a Leaflet-compatible shim (`Marker`, `Popup`, `Polyline`, `useMap`, `useMapEvents`, `L.divIcon`) so pages keep their original API.
- **Tile source / Style**: MapTiler Streets v4 — `https://api.maptiler.com/maps/streets-v4/style.json?key=ZgzumFORbF7swvFCViRi`. High-quality online vector tiles with Arabic labels. No local PMTiles archive (previously 110 MB — removed to reduce APK size).
- **No offline assets**: `client/public/fonts/`, `client/public/sprites/`, `client/public/mapbox-gl-rtl-text.js`, and `client/public/maps/` were all deleted. `sathaMapStyle.ts` was deleted. The Express font proxy route was removed from `server/routes.ts`.
- **Android WebView hardening** (all in `SathaMap.tsx`):
  1. `ResizeObserver` deferred init — map created only once container > 0×0 px (primary fix for blank white canvas — flex layout finishes after useEffect fires).
  2. `antialias: false` — halves GPU memory; prevents WebGL context failure on budget Qualcomm/MediaTek.
  3. `powerPreference: "default"` — avoids thermal-throttle context kill on mid-range devices.
  4. `failIfMajorPerformanceCaveat: false` — allows software-rendering fallback.
  5. `webglcontextlost` / `webglcontextrestored` handlers — recovers from Android memory-pressure context loss.
  6. Staggered `resize()` calls at 0, 150, 500, 1200 ms after load — handles soft-keyboard viewport changes.
  7. `translate3d(0,0,0)` + `willChange: transform` on canvas after load — GPU compositing hint.
- **Iraq bounds lock**: `IRAQ_BOUNDS = [[38.8, 29.0], [48.6, 37.4]]` (GeoJSON [lng,lat] order) applied as `maxBounds`.
- **Default centre**: Hilla / Babil `HILLA_CENTER = [44.36, 32.48]` (MapLibre [lng,lat] order) at zoom 13.
- **Geocoding/Search** (`client/src/pages/request-flow.tsx` → `searchLocation`): MapTiler Geocoding API — `https://api.maptiler.com/geocoding/{query}.json?key=...&proximity=44.36,32.48&country=iq&language=ar&limit=15`. Babil-first proximity bias via `proximity=44.36,32.48`. Returns MapTiler GeoJSON features; `handleSelectResult` uses `feature.geometry.coordinates[0/1]` for lng/lat.
- **Reverse geocoding** (`reverseGeocode`): MapTiler Geocoding reverse — `https://api.maptiler.com/geocoding/{lng},{lat}.json?key=...&language=ar`. Returns Arabic place names.
- **Two-step booking flow**: Pickup (step="pickup") → Dropoff (step="dropoff"). Crosshair overlay changes colour (orange/black). During dropoff step, a fixed orange `getPickupPinIcon()` marker is rendered at the confirmed pickup coords so both points are visible simultaneously. Dropoff pin is `getDropoffPinIcon()` (black).
- **capacitor.config.ts**: `androidScheme: 'http'` — kept as-is.

### UI Component Libraries
- Full shadcn/ui component set (Radix UI primitives)
- Lucide React icons
- Cairo font from Google Fonts for Arabic typography

### Development Tools
- Replit-specific Vite plugins for development experience
- Runtime error overlay for debugging

## Mobile App (Android)
- **Wrapper**: Capacitor (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli`, `@capacitor/geolocation`)
- **Build path**: `npm run build` → `npx cap sync android` → open `android/` in Android Studio
- The native Android project lives in `android/`. Capacitor wraps the Vite-built web bundle (`dist/public`) into a WebView app.
- We do **not** use Expo, EAS, or React Native. Those packages and their config files (`eas.json`, `App.js`, `app.json`, `babel.config.cjs`) were removed during migration.

## Commission System (Percentage-based)
The platform commission is **a percentage of the trip price** (not a fixed amount).
- The `settings.commission_amount` column now stores a percentage value `0–100` (default `10` = 10%). The legacy fixed amount (1000) was migrated to `10` on 2026-04-29.
- Admin UI: `client/src/pages/admin-dashboard.tsx` → Finance tab. Shows "نسبة العمولة الحالية" with a `%` suffix and a live example. Input is clamped 0–100.
- Server-side fee calculation (`fee = round(tripPrice × percent / 100)`) is applied in three places in `server/routes.ts`:
  - `POST /api/drivers/:id/accept/:requestId` — pre-check that driver wallet ≥ expected fee
  - `POST /api/drivers/:id/complete/:requestId` — deduct fee on driver complete
  - `POST /api/admin/requests/:requestId/force-complete` — deduct fee on admin force-complete
  Same logic mirrored in `storage.acceptRequest`. The `/delete-without-commission` admin endpoint remains unchanged (deletes without fee).

## Payment Status
The wallet **balance display, debit, and admin manual credit/debit** continue to work normally (managed via the admin dashboard).

Electronic top-up gateways (Zain Cash, Master Card / Visa, in-checkout wallet payment) are **not yet integrated**. To avoid showing a broken flow, the customer and driver wallet UIs surface a branded "coming soon" modal (`client/src/components/PaymentComingSoonDialog.tsx`) instead of attempting to call missing payment providers. Wired into:
- Customer checkout — selecting "wallet" as payment method (`client/src/pages/request-flow.tsx`)
- Customer wallet sheet — Zain Cash / Master Card buttons + "تأكيد عملية الشحن"
- Driver wallet tab — Zain Cash / Master Card buttons + "تأكيد عملية الشحن" (`client/src/pages/driver-dashboard.tsx`)
The admin's manual wallet adjustment flow in `admin-dashboard.tsx` is intentionally untouched and remains fully functional.