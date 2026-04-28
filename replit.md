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
- Leaflet for map rendering
- OpenStreetMap tile layer
- Browser Geolocation API for current location

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

## Payment Status
The wallet **balance display, debit, and admin manual credit/debit** continue to work normally (managed via the admin dashboard).

Electronic top-up gateways (Zain Cash, Master Card / Visa, in-checkout wallet payment) are **not yet integrated**. To avoid showing a broken flow, the customer and driver wallet UIs surface a branded "coming soon" modal (`client/src/components/PaymentComingSoonDialog.tsx`) instead of attempting to call missing payment providers. Wired into:
- Customer checkout — selecting "wallet" as payment method (`client/src/pages/request-flow.tsx`)
- Customer wallet sheet — Zain Cash / Master Card buttons + "تأكيد عملية الشحن"
- Driver wallet tab — Zain Cash / Master Card buttons + "تأكيد عملية الشحن" (`client/src/pages/driver-dashboard.tsx`)
The admin's manual wallet adjustment flow in `admin-dashboard.tsx` is intentionally untouched and remains fully functional.