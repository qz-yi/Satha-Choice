# 🚨 DATABASE FIX GUIDE - surge_multiplier Column Missing

## ❌ The Error You're Seeing:
```
"column 'surge_multiplier' does not exist"
```

---

## ✅ SOLUTION (Choose ONE method):

### **Method 1: Automatic Fix (Recommended)**

```bash
# Run this command in your project root:
npm run db:push
```

**What it does:**
- Reads `shared/schema.ts`
- Compares with your actual database
- Adds the missing `surge_multiplier` column automatically
- Also creates `vehicle_pricing_config` table if missing

---

### **Method 2: Manual SQL (If Method 1 Fails)**

**Step 1:** Connect to your PostgreSQL database:
```bash
# Using psql:
psql -U postgres -d your_database_name

# OR using pgAdmin (GUI)
```

**Step 2:** Run this SQL:
```sql
-- Add the missing column
ALTER TABLE settings 
ADD COLUMN surge_multiplier DECIMAL(3,2) DEFAULT 1.00;

-- Create vehicle pricing table (if missing)
CREATE TABLE IF NOT EXISTS vehicle_pricing_config (
  id SERIAL PRIMARY KEY,
  vehicle_type TEXT NOT NULL UNIQUE,
  base_fare INTEGER NOT NULL DEFAULT 25000,
  km_rate INTEGER NOT NULL DEFAULT 1250,
  minute_rate INTEGER NOT NULL DEFAULT 500,
  minimum_fare INTEGER NOT NULL DEFAULT 35000,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed initial pricing data
INSERT INTO vehicle_pricing_config (vehicle_type, base_fare, km_rate, minute_rate, minimum_fare)
VALUES 
  ('سطحة', 25000, 1250, 500, 35000),
  ('سحب', 20000, 1000, 400, 30000),
  ('هيدروليك', 50000, 2500, 1000, 70000)
ON CONFLICT (vehicle_type) DO NOTHING;
```

**Step 3:** Verify:
```sql
-- Check settings table structure
\d settings

-- Check vehicle_pricing_config table
SELECT * FROM vehicle_pricing_config;
```

---

### **Method 3: Use the Ready SQL File**

```bash
# The SQL file is ready at:
# EMERGENCY_FIX_DB.sql

# Run it directly:
psql -U postgres -d your_database_name -f EMERGENCY_FIX_DB.sql
```

---

## 🔍 Why This Happened

**This project uses Drizzle ORM (NOT Sequelize).**

The schema was updated in code (`shared/schema.ts`) but the database wasn't migrated:

```typescript
// Added in schema.ts:
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  commissionAmount: integer("commission_amount").notNull().default(1000),
  surgeMultiplier: decimal("surge_multiplier", { precision: 3, scale: 2 }).default("1.00"), // ← THIS IS NEW
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

**The database needs to catch up with the code.**

---

## ✅ After Applying the Fix

1. **Restart your server:**
   ```bash
   npm run dev
   ```

2. **Test the Driver App:**
   - Driver should be able to accept orders without errors
   - Check console logs - should see:
     ```
     ✅ [PRICING CONFIG] Surge multiplier: 1.0x
     ```

3. **Test Admin Panel:**
   - Go to "إعدادات التسعير"
   - Toggle "Peak Hour Mode"
   - Should work without errors

---

## 🛡️ Error Handling (Already Implemented)

**Good news:** I've added automatic fallback logic:

```typescript
// If surge_multiplier column is missing:
// ✅ System uses default 1.0x (no surge)
// ✅ Driver app continues to work
// ⚠️ Console shows warning to fix database
```

**But you should still fix the database** to enable admin pricing control.

---

## 🔧 Troubleshooting

### **"npm run db:push" fails with connection error**

**Solution:** Make sure PostgreSQL is running:
```bash
# Windows (if using local Postgres):
pg_ctl start -D "C:\Program Files\PostgreSQL\15\data"

# OR check if it's a service:
services.msc
# → Find "postgresql-x64-15" → Start

# OR if using Docker:
docker-compose up -d
docker ps  # verify it's running
```

### **"permission denied" error**

**Solution:** Run SQL as superuser:
```sql
-- Connect as postgres user:
psql -U postgres

-- Then run the ALTER TABLE command
```

### **Still not working?**

**Check your `.env` file:**
```bash
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

Make sure:
- Database exists
- Username/password are correct
- Port is correct (usually 5432)

---

## 📝 Files Involved

| File | Purpose |
|------|---------|
| `shared/schema.ts` | Schema definition (has surge_multiplier) |
| `server/services/PricingConfig.ts` | Reads/writes surge multiplier |
| `EMERGENCY_FIX_DB.sql` | Ready SQL to fix database |
| `server/migrations/add_vehicle_pricing_config.sql` | Migration file |

---

## 🎯 Quick Summary

**Problem:** Database missing `surge_multiplier` column  
**Cause:** Schema updated in code, but database not migrated  
**Fix:** Run `npm run db:push` OR execute `EMERGENCY_FIX_DB.sql`  
**Result:** Driver app works + Admin can control pricing  

---

**Need help?** Check the server console logs - they now show detailed error messages with fix instructions.
