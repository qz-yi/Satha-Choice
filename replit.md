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
- **Maps**: React Leaflet for interactive location picking
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
- **Unified map component**: All 5 in-app maps render through `client/src/components/SathaMap.tsx`. This wrapper centralises tile source, bounds, performance flags, and post-mount `invalidateSize()` calls so swapping the engine later (e.g. to `@capacitor/google-maps`) only touches one file.
- **Tile source**: CartoDB Positron (`https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`) — clean Baly-style look. **No CSS filter** is applied.
- **Performance flags**: `preferCanvas: true` (GPU rendering on mobile), `keepBuffer: 10` (preloads 10 extra tile rings for smooth panning), `detectRetina: true`, `tileSize: 256`.
- **Iraq bounds lock**: `IRAQ_BOUNDS = [[29.0, 38.8], [37.4, 48.6]]` exported from `SathaMap.tsx` and applied as `maxBounds` with `maxBoundsViscosity: 1.0` on every map — physically prevents panning outside Iraq, eliminates gray voids, reduces tile load.
- **Persistent tile caching**: Service Worker at `client/public/sw.js` (registered in `client/src/main.tsx` only when `import.meta.env.PROD`) caches every Carto tile request in a dedicated `satha-tiles-v1` Cache Storage with a cache-first strategy and a 4000-tile cap. Provides true offline-first behavior inside the Capacitor WebView and the browser PWA.
- Browser Geolocation API for current location.
- **Geocoding/Search**: Nominatim with POI-aware ranking. `searchLocation` in `client/src/pages/request-flow.tsx` uses `countrycodes=iq`, an Iraq `viewbox`, `bounded=1`, `namedetails=1`, and `limit=25`, then re-ranks results to prioritize POI classes (amenity, shop, tourism, leisure, office, building, highway, historic, railway, man_made, natural, place) over generic addresses, returning the top 15.

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