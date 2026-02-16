-- ============================================================
-- CRITICAL FIX #4: Vehicle Pricing Configuration Table
-- This enables Admin to edit pricing in real-time
-- ============================================================

-- Create table for vehicle pricing
CREATE TABLE IF NOT EXISTS vehicle_pricing_config (
  id SERIAL PRIMARY KEY,
  vehicle_type TEXT NOT NULL UNIQUE,
  base_fare INTEGER NOT NULL DEFAULT 25000,
  km_rate INTEGER NOT NULL DEFAULT 1250,
  minute_rate INTEGER NOT NULL DEFAULT 500,
  minimum_fare INTEGER NOT NULL DEFAULT 35000,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add surge multiplier to settings if not exists
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS surge_multiplier DECIMAL(3,2) DEFAULT 1.00;

-- Seed initial pricing data (7KM Rule)
INSERT INTO vehicle_pricing_config (vehicle_type, base_fare, km_rate, minute_rate, minimum_fare)
VALUES 
  ('سطحة', 25000, 1250, 500, 35000),
  ('سحب', 20000, 1000, 400, 30000),
  ('هيدروليك', 50000, 2500, 1000, 70000)
ON CONFLICT (vehicle_type) DO NOTHING;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vehicle_pricing_type 
ON vehicle_pricing_config(vehicle_type);

-- Comment for documentation
COMMENT ON TABLE vehicle_pricing_config IS 'Admin-configurable pricing for different vehicle types (7KM base coverage rule)';
COMMENT ON COLUMN vehicle_pricing_config.base_fare IS 'Covers first 7 kilometers';
COMMENT ON COLUMN vehicle_pricing_config.km_rate IS 'Cost per kilometer after first 7km';
COMMENT ON COLUMN vehicle_pricing_config.minimum_fare IS 'Absolute minimum fare (cannot go below)';
