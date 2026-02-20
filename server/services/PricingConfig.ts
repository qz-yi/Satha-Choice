/**
 * CRITICAL FIX #3: Admin-Configurable Pricing System
 * Centralized pricing configuration storage and management
 */

import { db } from '../db';
import { settings, vehiclePricingConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface VehiclePricingRow {
  vehicleType: string;
  baseFare: number;
  kmRate: number;
  minuteRate: number;
  minimumFare: number;
}

// CRITICAL FIX #3: Corrected pricing with 7KM rule (NOT 10KM!)
// Base Fare now covers first 7 KM ONLY
export const DEFAULT_PRICING: Record<string, VehiclePricingRow> = {
  "سطحة": {
    vehicleType: "سطحة",
    baseFare: 25000,      // Covers first 7km
    kmRate: 1250,         // Per km after 7km
    minuteRate: 500,
    minimumFare: 35000    // Minimum total
  },
  "سحب": {
    vehicleType: "سحب",
    baseFare: 20000,      // Covers first 7km
    kmRate: 1000,         // Per km after 7km
    minuteRate: 400,
    minimumFare: 30000    // Minimum total
  },
  "هيدروليك": {
    vehicleType: "هيدروليك",
    baseFare: 50000,      // Covers first 7km
    kmRate: 2500,         // Per km after 7km (increased to meet 70k minimum)
    minuteRate: 1000,     // Per minute (increased)
    minimumFare: 70000    // STRICT minimum (cannot go below)
  }
};

/**
 * STEP 3: Get surge multiplier with HARD-CODED FALLBACK
 * ALWAYS returns a valid number (never undefined/null)
 */
export async function getSurgeMultiplier(): Promise<number> {
  try {
    const result = await db.select().from(settings).limit(1);
    
    // STEP 3: Multiple fallback layers
    if (result[0]?.surgeMultiplier) {
      const parsed = parseFloat(result[0].surgeMultiplier);
      return isNaN(parsed) ? 1.0 : parsed;
    }
    
    console.warn('⚠️ [PRICING CONFIG] No surge multiplier in DB, using default 1.0');
    return 1.0;
    
  } catch (error: any) {
    // STEP 3: If ANY error, return safe default
    if (error.message && error.message.includes('surge_multiplier')) {
      console.warn('⚠️ [PRICING CONFIG] surge_multiplier column missing - using default 1.0');
    } else {
      console.warn('⚠️ [PRICING CONFIG] Error fetching surge:', error.message);
    }
    return 1.0; // HARD-CODED FALLBACK
  }
}

/**
 * EMERGENCY FIX: Update surge multiplier (for Peak Hour Mode toggle)
 * Handles missing column with clear error message
 */
export async function updateSurgeMultiplier(multiplier: number): Promise<void> {
  try {
    console.log(`📊 [PRICING CONFIG] Updating surge multiplier to ${multiplier}x`);
    
    const existing = await db.select().from(settings).limit(1);
    
    if (existing.length > 0) {
      await db.update(settings)
        .set({ surgeMultiplier: multiplier.toString() })
        .where(eq(settings.id, existing[0].id));
    } else {
      // Create settings row if it doesn't exist
      await db.insert(settings).values({
        commissionAmount: 1000,
        surgeMultiplier: multiplier.toString()
      });
    }
    
    console.log(`✅ [PRICING CONFIG] Surge multiplier updated to ${multiplier}x`);
  } catch (error: any) {
    // EMERGENCY FIX: If column doesn't exist, throw clear error
    if (error.message && error.message.includes('surge_multiplier')) {
      console.error('❌❌❌ [PRICING CONFIG] CRITICAL: surge_multiplier column MISSING!');
      console.error('❌ [PRICING CONFIG] Run this SQL to fix:');
      console.error('   ALTER TABLE settings ADD COLUMN surge_multiplier DECIMAL(3,2) DEFAULT 1.00;');
      console.error('❌ [PRICING CONFIG] OR: Execute EMERGENCY_FIX_DB.sql');
      throw new Error('Database schema missing surge_multiplier column. See EMERGENCY_FIX_DB.sql');
    }
    console.error('❌ [PRICING CONFIG] Error updating surge multiplier:', error);
    throw error;
  }
}

/**
 * EMERGENCY FIX: Get vehicle pricing from DATABASE (admin-configurable)
 * Falls back to DEFAULT_PRICING if table doesn't exist or error occurs
 */
export async function getVehiclePricing(vehicleType: string): Promise<VehiclePricingRow> {
  try {
    const result = await db.select()
      .from(vehiclePricingConfig)
      .where(eq(vehiclePricingConfig.vehicleType, vehicleType))
      .limit(1);
    
    if (result.length > 0) {
      console.log(`✅ [PRICING CONFIG] Loaded ${vehicleType} from database`);
      return {
        vehicleType: result[0].vehicleType,
        baseFare:    Number(result[0].baseFare),
        kmRate:      Number(result[0].kmRate),
        minuteRate:  Number(result[0].minuteRate),
        minimumFare: Number(result[0].minimumFare),
      };
    }

    // Not in DB yet — try to seed this specific vehicle type, then return defaults
    console.log(`⚠️ [PRICING CONFIG] ${vehicleType} not in DB, seeding defaults...`);
    try {
      const def = DEFAULT_PRICING[vehicleType] || DEFAULT_PRICING["سطحة"];
      await db.insert(vehiclePricingConfig).values({
        vehicleType: def.vehicleType,
        baseFare:    def.baseFare,
        kmRate:      def.kmRate,
        minuteRate:  def.minuteRate,
        minimumFare: def.minimumFare,
      }).onConflictDoNothing();
    } catch { /* table may not exist yet — fall through to defaults */ }

    return DEFAULT_PRICING[vehicleType] || DEFAULT_PRICING["سطحة"];
  } catch (error: any) {
    // EMERGENCY FIX: If table doesn't exist, use defaults
    if (error.message && error.message.includes('vehicle_pricing_config')) {
      console.warn(`⚠️ [PRICING CONFIG] vehicle_pricing_config table missing - using defaults`);
      console.warn(`⚠️ [PRICING CONFIG] Run 'npm run db:push' or execute EMERGENCY_FIX_DB.sql`);
    } else {
      console.warn(`⚠️ [PRICING CONFIG] Database error for ${vehicleType}:`, error.message);
    }
    return DEFAULT_PRICING[vehicleType] || DEFAULT_PRICING["سطحة"];
  }
}

/**
 * CRITICAL FIX #4: Get all vehicle pricing from DATABASE
 * Auto-seeds defaults on first run if table is empty.
 */
export async function getAllVehiclePricing(): Promise<VehiclePricingRow[]> {
  try {
    const result = await db.select().from(vehiclePricingConfig);

    if (result.length > 0) {
      console.log(`✅ [PRICING CONFIG] Loaded ${result.length} vehicle configs from database`);
      return result.map(r => ({
        vehicleType: r.vehicleType,
        baseFare:    Number(r.baseFare),
        kmRate:      Number(r.kmRate),
        minuteRate:  Number(r.minuteRate),
        minimumFare: Number(r.minimumFare),
      }));
    }

    // First run — table is empty, seed it with defaults
    console.log(`⚠️ [PRICING CONFIG] Table empty — seeding defaults into DB...`);
    try {
      for (const defaults of Object.values(DEFAULT_PRICING)) {
        await db.insert(vehiclePricingConfig).values({
          vehicleType: defaults.vehicleType,
          baseFare:    defaults.baseFare,
          kmRate:      defaults.kmRate,
          minuteRate:  defaults.minuteRate,
          minimumFare: defaults.minimumFare,
        }).onConflictDoNothing();
      }
      console.log(`✅ [PRICING CONFIG] Defaults seeded successfully`);
      // Return the freshly seeded data
      const fresh = await db.select().from(vehiclePricingConfig);
      if (fresh.length > 0) {
        return fresh.map(r => ({
          vehicleType: r.vehicleType,
          baseFare:    Number(r.baseFare),
          kmRate:      Number(r.kmRate),
          minuteRate:  Number(r.minuteRate),
          minimumFare: Number(r.minimumFare),
        }));
      }
    } catch (seedErr: any) {
      console.warn(`⚠️ [PRICING CONFIG] Could not seed defaults:`, seedErr.message);
    }

    return Object.values(DEFAULT_PRICING);
  } catch (error) {
    console.warn(`⚠️ [PRICING CONFIG] Database error, using defaults`);
    return Object.values(DEFAULT_PRICING);
  }
}

/**
 * CRITICAL FIX #4: Update vehicle pricing in DATABASE
 * Admin can modify pricing in real-time
 */
export async function updateVehiclePricing(vehicleType: string, config: Partial<VehiclePricingRow>): Promise<VehiclePricingRow> {
  try {
    console.log(`📊 [PRICING CONFIG] Updating ${vehicleType} in database:`, config);
    
    // Check if exists
    const existing = await db.select()
      .from(vehiclePricingConfig)
      .where(eq(vehiclePricingConfig.vehicleType, vehicleType))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing
      const updated = await db.update(vehiclePricingConfig)
        .set({
          baseFare: config.baseFare,
          kmRate: config.kmRate,
          minuteRate: config.minuteRate,
          minimumFare: config.minimumFare,
          updatedAt: new Date()
        })
        .where(eq(vehiclePricingConfig.vehicleType, vehicleType))
        .returning();
      
      console.log(`✅ [PRICING CONFIG] ${vehicleType} updated in database`);
      
      return {
        vehicleType: updated[0].vehicleType,
        baseFare: updated[0].baseFare,
        kmRate: updated[0].kmRate,
        minuteRate: updated[0].minuteRate,
        minimumFare: updated[0].minimumFare
      };
    } else {
      // Insert new
      const defaults = DEFAULT_PRICING[vehicleType] || DEFAULT_PRICING["سطحة"];
      const inserted = await db.insert(vehiclePricingConfig).values({
        vehicleType,
        baseFare: config.baseFare ?? defaults.baseFare,
        kmRate: config.kmRate ?? defaults.kmRate,
        minuteRate: config.minuteRate ?? defaults.minuteRate,
        minimumFare: config.minimumFare ?? defaults.minimumFare
      }).returning();
      
      console.log(`✅ [PRICING CONFIG] ${vehicleType} inserted into database`);
      
      return {
        vehicleType: inserted[0].vehicleType,
        baseFare: inserted[0].baseFare,
        kmRate: inserted[0].kmRate,
        minuteRate: inserted[0].minuteRate,
        minimumFare: inserted[0].minimumFare
      };
    }
  } catch (error) {
    console.error(`❌ [PRICING CONFIG] Error updating ${vehicleType}:`, error);
    throw error;
  }
}
