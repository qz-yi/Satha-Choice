# Satha — Hetzner Production Deployment Guide

## What Changed & Why

This document covers all changes made to sync the Replit codebase with your
Hetzner production server. Two separate areas were updated:

---

## Part 1 — Server Files (deploy to Hetzner immediately)

These are the only backend files that changed. Copy them directly to your
Hetzner server and restart the Node process.

### `server/routes.ts`

**Change 1 — Request validation guard (prevents stuck-user bug)**

Before the order is even written to the database, the server now rejects any
request that arrives without valid coordinates or a price greater than zero.

```
POST /api/requests
→ 400 if pickupLat/pickupLng or destLat/destLng are missing
→ 400 if price is 0 or missing
```

**Change 2 — Atomic commission + status update (race-condition fix)**

Previously the driver-complete and admin-force-complete endpoints wrote
`adminCommission` and `status = "completed"` as two separate SQL statements.
A crash between them left the row with commission saved but status still
`in_progress`. Now both are written in one `UPDATE … SET … WHERE` call.

```sql
-- Before (two statements, race-condition window between them)
UPDATE requests SET admin_commission = fee WHERE id = ?;
UPDATE requests SET status = 'completed' WHERE id = ?;

-- After (single atomic statement)
UPDATE requests
SET admin_commission = fee, is_withdrawn = false, status = 'completed'
WHERE id = ?;
```

**Change 3 — FCM notification payload for new trips**

```js
// Before
sendPushToMany(tokens, 'طلب جديد متوفر', 'يوجد طلب سطحة جديد بالقرب منك')

// After
sendPushToMany(tokens, 'طلب سطحة جديد! 🚛', 'هناك طلب قريب منك، اضغط للتفاصيل.')
```

---

### `server/notificationService.ts`

Added Android priority, sound, and channelId to the FCM message payload so
the notification appears with sound even when the driver's phone is in
silent/vibrate mode (high-priority FCM bypasses Do Not Disturb on Android).

```js
// Before
await messaging.send({ notification: { title, body }, token });

// After
await messaging.send({
  notification: { title, body },
  android: {
    priority: "high",
    notification: { sound: "default", channelId: "default", priority: "high" },
  },
  apns: { payload: { aps: { sound: "default", contentAvailable: true } } },
  token,
});
```

---

## Part 2 — Commission Math Audit (already correct — no change needed)

The percentage-based formula was already in the codebase before this session.
Confirmed live in logs: trip 35,000 د.ع × 20% = 7,000 د.ع deducted correctly.

```js
// This is the formula in server/routes.ts (driver complete + force complete + pre-check)
const commissionPercent = Math.max(0, Math.min(100, Number(systemSettings.commissionAmount ?? 10)));
const tripPrice         = parseFloat(request.price || "0");
const fee               = Math.round((tripPrice * commissionPercent) / 100);

// Wallet deduction
const currentBalance = parseFloat(driver.walletBalance || "0");
const newBalance     = (currentBalance - fee).toFixed(2);   // IQD value, not raw %
```

All financial math uses `parseFloat()` and `Number()` throughout — no string
arithmetic that could cause APK/mobile math errors.

---

## Admin Earnings Logic (already correct — no change needed)

```sql
-- GET /api/admin/earnings
SELECT SUM(admin_commission) FROM requests
WHERE status = 'completed' AND is_withdrawn = false;

-- POST /api/admin/reset-earnings  (تصفير button)
UPDATE requests SET is_withdrawn = true
WHERE status = 'completed' AND is_withdrawn = false;
```

---

## Hetzner Deployment Commands

Run these on your Hetzner server over SSH:

```bash
# 1. Navigate to your project directory
cd /path/to/satha   # adjust to your actual path

# 2. Pull latest changes from git
git pull origin main

# 3. Install any new dependencies (safe to run even if nothing changed)
npm install --production

# 4. Restart the Node process
#    If you use PM2:
pm2 restart satha --update-env

#    If you use systemd:
sudo systemctl restart satha

#    If running directly:
# kill the old process, then:
NODE_ENV=production node dist/index.cjs
```

If you **do not** use git on Hetzner and deploy files manually, copy only
these two files:

```
server/routes.ts          → upload and replace
server/notificationService.ts → upload and replace
```

Then recompile (if your Hetzner server runs the TypeScript build):

```bash
npm run build
pm2 restart satha
```

### Required environment variables on Hetzner

Make sure these are set in your Hetzner server's environment (`.env` or
systemd `EnvironmentFile`):

```env
NODE_ENV=production
DATABASE_URL=postgresql://...    # your production PostgreSQL
SESSION_SECRET=...               # strong random secret
PORT=5000                        # or whatever port nginx proxies to

# Optional — enables server-side routing via MapTiler
MAPTILER_API_KEY=...

# Optional — Google Directions fallback
GOOGLE_MAPS_API_KEY=...
```

**Firebase (FCM):** Place your Firebase service-account JSON file in:
```
server/config/<any-name>.json
```
The notification service auto-discovers the first `.json` file in that
directory. Without it, push notifications are silently skipped — no crash.

---

## Part 3 — APK Rebuild Required (client-side changes)

The following client files were also updated in this session. These changes
only affect the **APK** — the web version on satha-iq.com is unaffected.

### `client/src/lib/http.ts` and `client/src/lib/api.ts` — Critical APK fix

`process.env.VITE_API_URL` does not work in Vite at runtime — it always
returns `undefined`. Changed to `import.meta.env.VITE_API_URL` which is the
correct Vite syntax. Without this fix, the APK silently falls back to
`https://satha-iq.com` (the hardcoded default), but the variable can never
be overridden.

### `client/src/pages/request-flow.tsx` — Debounce + button protection

- Price calculation now waits 1.5 seconds after the map pin stops moving
  before firing the API call. This prevents 5–10 redundant calculations per
  pin placement.
- The "متابعة" button is disabled while `isPriceCalculating` is true.
  Text changes to "جاري احتساب السعر..." — prevents submitting with price = 0.

### `client/src/App.tsx` — Foreground notification alert

When the app is open and a push notification arrives, a native `alert()`
dialog now shows the title and body to the driver immediately.

### To rebuild the APK

```bash
# 1. Build the web bundle with production env
npm run build

# 2. Sync to Android project
npx cap sync android

# 3. Open in Android Studio and build signed APK/AAB
npx cap open android
# In Android Studio: Build → Generate Signed Bundle / APK
```

The production env is already set in `client/.env.production`:
```
VITE_API_URL=https://satha-iq.com
VITE_SOCKET_URL=https://satha-iq.com
```

`npm run build` picks this file up automatically — no manual changes needed.

---

## Summary Table

| File | Type | Deploy Where | Action |
|---|---|---|---|
| `server/routes.ts` | Backend | Hetzner | Copy + restart |
| `server/notificationService.ts` | Backend | Hetzner | Copy + restart |
| `client/src/lib/http.ts` | Frontend | APK rebuild | Rebuild APK |
| `client/src/lib/api.ts` | Frontend | APK rebuild | Rebuild APK |
| `client/src/App.tsx` | Frontend | APK rebuild | Rebuild APK |
| `client/src/pages/request-flow.tsx` | Frontend | APK rebuild | Rebuild APK |

No database schema changes were made — no migrations needed on Hetzner.
