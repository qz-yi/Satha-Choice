-- ============================================================
-- EMERGENCY FIX: Add Missing surge_multiplier Column
-- Run this SQL directly in your database if db:push fails
-- ============================================================

-- Method 1: Add column to settings table
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS surge_multiplier DECIMAL(3,2) DEFAULT 1.00;

-- Method 2: Create vehicle_pricing_config table (if missing)
CREATE TABLE IF NOT EXISTS vehicle_pricing_config (
  id SERIAL PRIMARY KEY,
  vehicle_type TEXT NOT NULL UNIQUE,
  base_fare INTEGER NOT NULL DEFAULT 25000,
  km_rate INTEGER NOT NULL DEFAULT 1250,
  minute_rate INTEGER NOT NULL DEFAULT 500,
  minimum_fare INTEGER NOT NULL DEFAULT 35000,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Method 3: Seed initial pricing data
INSERT INTO vehicle_pricing_config (vehicle_type, base_fare, km_rate, minute_rate, minimum_fare)
VALUES 
  ('سطحة', 25000, 1250, 500, 35000),
  ('سحب', 20000, 1000, 400, 30000),
  ('هيدروليك', 50000, 2500, 1000, 70000)
ON CONFLICT (vehicle_type) DO NOTHING;

-- Verify the fix
SELECT * FROM settings;
SELECT * FROM vehicle_pricing_config;

-- ============================================================
-- Instructions:
-- 1. Connect to your PostgreSQL database
-- 2. Copy and paste this entire SQL
-- 3. Execute it
-- 4. Restart your Node.js server
-- ============================================================
