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
 * EMERGENCY FIX: Get surge multiplier from database settings
 * Handles missing column gracefully
 */
export async function getSurgeMultiplier(): Promise<number> {
  try {
    const result = await db.select().from(settings).limit(1);
    return result[0]?.surgeMultiplier ? parseFloat(result[0].surgeMultiplier) : 1.0;
  } catch (error: any) {
    // EMERGENCY FIX: If column doesn't exist, log warning and use default
    if (error.message && error.message.includes('surge_multiplier')) {
      console.warn('⚠️⚠️⚠️ [PRICING CONFIG] surge_multiplier column MISSING!');
      console.warn('⚠️ [PRICING CONFIG] Using default 1.0x (no surge)');
      console.warn('⚠️ [PRICING CONFIG] FIX: Run SQL from EMERGENCY_FIX_DB.sql');
      return 1.0;
    }
    console.warn('⚠️ [PRICING CONFIG] Could not fetch surge multiplier:', error.message);
    return 1.0;
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
        baseFare: result[0].baseFare,
        kmRate: result[0].kmRate,
        minuteRate: result[0].minuteRate,
        minimumFare: result[0].minimumFare
      };
    }
    
    console.log(`⚠️ [PRICING CONFIG] ${vehicleType} not in DB, using default`);
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
 */
export async function getAllVehiclePricing(): Promise<VehiclePricingRow[]> {
  try {
    const result = await db.select().from(vehiclePricingConfig);
    
    if (result.length > 0) {
      console.log(`✅ [PRICING CONFIG] Loaded ${result.length} vehicle configs from database`);
      return result.map(r => ({
        vehicleType: r.vehicleType,
        baseFare: r.baseFare,
        kmRate: r.kmRate,
        minuteRate: r.minuteRate,
        minimumFare: r.minimumFare
      }));
    }
    
    console.log(`⚠️ [PRICING CONFIG] No pricing in DB, using defaults`);
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
