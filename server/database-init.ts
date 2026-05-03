/**
 * RADICAL FIX: Database Auto-Migration
 * This runs EVERY TIME the server starts
 * Ensures surge_multiplier column ALWAYS exists
 */

import { pool } from './db';

export async function ensureDatabaseSchema() {
  console.log('\n🔧 [DATABASE INIT] Starting auto-migration...');
  
  const client = await pool.connect();
  
  try {
    // STEP 2: Add surge_multiplier column if missing
    console.log('[DATABASE INIT] Checking surge_multiplier column...');
    await client.query(`
      ALTER TABLE settings 
      ADD COLUMN IF NOT EXISTS surge_multiplier DECIMAL(3,2) DEFAULT 1.00;
    `);
    console.log('✅ [DATABASE INIT] surge_multiplier column ready');

    // Create vehicle_pricing_config table if missing
    console.log('[DATABASE INIT] Checking vehicle_pricing_config table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicle_pricing_config (
        id SERIAL PRIMARY KEY,
        vehicle_type TEXT NOT NULL UNIQUE,
        base_fare INTEGER NOT NULL DEFAULT 25000,
        km_rate INTEGER NOT NULL DEFAULT 1250,
        minute_rate INTEGER NOT NULL DEFAULT 500,
        minimum_fare INTEGER NOT NULL DEFAULT 35000,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ [DATABASE INIT] vehicle_pricing_config table ready');

    // Seed default pricing data
    console.log('[DATABASE INIT] Seeding default pricing data...');
    await client.query(`
      INSERT INTO vehicle_pricing_config (vehicle_type, base_fare, km_rate, minute_rate, minimum_fare)
      VALUES 
        ('سطحة', 25000, 1250, 500, 35000),
        ('سحب', 20000, 1000, 400, 30000),
        ('هيدروليك', 50000, 2500, 1000, 70000)
      ON CONFLICT (vehicle_type) DO NOTHING;
    `);
    console.log('✅ [DATABASE INIT] Pricing data seeded');

    // Ensure settings row exists with surge_multiplier
    console.log('[DATABASE INIT] Ensuring settings row exists...');
    await client.query(`
      INSERT INTO settings (commission_amount, surge_multiplier)
      SELECT 1000, 1.00
      WHERE NOT EXISTS (SELECT 1 FROM settings LIMIT 1);
    `);
    console.log('✅ [DATABASE INIT] Settings initialized');

    // Add image column to users table if missing
    console.log('[DATABASE INIT] Checking users.image column...');
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT;
    `);
    console.log('✅ [DATABASE INIT] users.image column ready');

    // Add fcm_token column to users table if missing (push notifications)
    console.log('[DATABASE INIT] Checking users.fcm_token column...');
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;
    `);
    console.log('✅ [DATABASE INIT] users.fcm_token column ready');

    // Add fcm_token column to drivers table if missing (push notifications)
    console.log('[DATABASE INIT] Checking drivers.fcm_token column...');
    await client.query(`
      ALTER TABLE drivers ADD COLUMN IF NOT EXISTS fcm_token TEXT;
    `);
    console.log('✅ [DATABASE INIT] drivers.fcm_token column ready');

    console.log('✅ [DATABASE INIT] Auto-migration complete!\n');
    
  } catch (error: any) {
    console.error('❌ [DATABASE INIT] Migration failed:', error.message);
    console.error('⚠️  [DATABASE INIT] Server will continue with fallback values');
    // Don't crash the server - continue with fallback
  } finally {
    client.release();
  }
}
