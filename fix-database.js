/**
 * EMERGENCY DATABASE FIX SCRIPT
 * Run this with: node fix-database.js
 * 
 * This will add the missing surge_multiplier column
 * and create vehicle_pricing_config table
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function fixDatabase() {
  console.log('\n========================================');
  console.log('   SATHA - Emergency Database Fix');
  console.log('========================================\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL not found in .env file');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected!\n');

    // Step 1: Add surge_multiplier column
    console.log('[1/4] Adding surge_multiplier column to settings table...');
    try {
      await client.query(`
        ALTER TABLE settings 
        ADD COLUMN IF NOT EXISTS surge_multiplier DECIMAL(3,2) DEFAULT 1.00;
      `);
      console.log('✅ Column added successfully!\n');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️  Column already exists, skipping...\n');
      } else {
        throw error;
      }
    }

    // Step 2: Create vehicle_pricing_config table
    console.log('[2/4] Creating vehicle_pricing_config table...');
    try {
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
      console.log('✅ Table created successfully!\n');
    } catch (error) {
      console.log('⚠️  Table might already exist, continuing...\n');
    }

    // Step 3: Seed pricing data
    console.log('[3/4] Seeding vehicle pricing data...');
    await client.query(`
      INSERT INTO vehicle_pricing_config (vehicle_type, base_fare, km_rate, minute_rate, minimum_fare)
      VALUES 
        ('سطحة', 25000, 1250, 500, 35000),
        ('سحب', 20000, 1000, 400, 30000),
        ('هيدروليك', 50000, 2500, 1000, 70000)
      ON CONFLICT (vehicle_type) DO NOTHING;
    `);
    console.log('✅ Pricing data seeded!\n');

    // Step 4: Verify
    console.log('[4/4] Verifying database structure...');
    
    const settingsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'settings' AND column_name = 'surge_multiplier';
    `);
    
    if (settingsResult.rows.length > 0) {
      console.log('✅ surge_multiplier column exists in settings');
    } else {
      console.log('❌ ERROR: surge_multiplier column NOT found!');
    }

    const pricingResult = await client.query(`
      SELECT COUNT(*) as count FROM vehicle_pricing_config;
    `);
    
    console.log(`✅ vehicle_pricing_config has ${pricingResult.rows[0].count} rows\n`);

    client.release();
    
    console.log('========================================');
    console.log('   DATABASE FIX COMPLETE! ✅');
    console.log('========================================\n');
    console.log('Next steps:');
    console.log('  1. Restart your server: npm run dev');
    console.log('  2. Test Driver App (accept order)');
    console.log('  3. Test Admin Panel (pricing settings)\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Make sure PostgreSQL is running');
    console.error('  2. Check DATABASE_URL in .env file');
    console.error('  3. Verify database exists and is accessible');
    console.error('\nAlternative: Run EMERGENCY_FIX_DB.sql manually in pgAdmin\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixDatabase();
