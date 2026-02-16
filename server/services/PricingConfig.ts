/**
 * CRITICAL FIX #3: Admin-Configurable Pricing System
 * Centralized pricing configuration storage and management
 */

import { db } from '../db';
import { settings } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface VehiclePricingRow {
  vehicleType: string;
  baseFare: number;
  kmRate: number;
  minuteRate: number;
  minimumFare: number;
}

// CRITICAL: Default pricing if database is empty
export const DEFAULT_PRICING: Record<string, VehiclePricingRow> = {
  "سطحة": {
    vehicleType: "سطحة",
    baseFare: 25000,
    kmRate: 1250,
    minuteRate: 500,
    minimumFare: 35000
  },
  "سحب": {
    vehicleType: "سحب",
    baseFare: 20000,
    kmRate: 1000,
    minuteRate: 400,
    minimumFare: 30000
  },
  "هيدروليك": {
    vehicleType: "هيدروليك",
    baseFare: 50000,
    kmRate: 2000,
    minuteRate: 800,
    minimumFare: 70000
  }
};

/**
 * Get surge multiplier from database settings
 */
export async function getSurgeMultiplier(): Promise<number> {
  try {
    const result = await db.select().from(settings).limit(1);
    return result[0]?.surgeMultiplier ? parseFloat(result[0].surgeMultiplier) : 1.0;
  } catch (error) {
    console.warn('⚠️ [PRICING CONFIG] Could not fetch surge multiplier, using 1.0');
    return 1.0;
  }
}

/**
 * Update surge multiplier (for Peak Hour Mode toggle)
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
  } catch (error) {
    console.error('❌ [PRICING CONFIG] Error updating surge multiplier:', error);
    throw error;
  }
}

/**
 * Get vehicle pricing configuration
 * Returns from DEFAULT_PRICING for now (future: database storage)
 */
export function getVehiclePricing(vehicleType: string): VehiclePricingRow {
  return DEFAULT_PRICING[vehicleType] || DEFAULT_PRICING["سطحة"];
}

/**
 * Get all vehicle pricing configurations
 */
export function getAllVehiclePricing(): VehiclePricingRow[] {
  return Object.values(DEFAULT_PRICING);
}

/**
 * Update vehicle pricing (future: save to database)
 * For now, this updates the in-memory configuration
 */
export function updateVehiclePricing(vehicleType: string, config: Partial<VehiclePricingRow>): VehiclePricingRow {
  console.log(`📊 [PRICING CONFIG] Updating ${vehicleType}:`, config);
  
  if (!DEFAULT_PRICING[vehicleType]) {
    throw new Error(`Vehicle type ${vehicleType} not found`);
  }
  
  DEFAULT_PRICING[vehicleType] = {
    ...DEFAULT_PRICING[vehicleType],
    ...config
  };
  
  console.log(`✅ [PRICING CONFIG] ${vehicleType} updated:`, DEFAULT_PRICING[vehicleType]);
  
  return DEFAULT_PRICING[vehicleType];
}
