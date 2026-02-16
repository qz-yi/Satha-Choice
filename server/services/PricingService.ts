/**
 * PROFESSIONAL PRICING SERVICE
 * Industry-standard dynamic pricing with traffic awareness
 */

export interface VehiclePricingConfig {
  vehicleType: string;
  baseFare: number;      // Base fare for first 10km
  kmRate: number;        // Rate per km over 10km
  minuteRate: number;    // Rate per minute of travel time
  minimumFare: number;   // Absolute minimum fare
}

export interface PricingResult {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  subtotal: number;
  surgeMultiplier: number;
  finalPrice: number;
  distanceKm: number;
  durationMinutes: number;
  isCapped: boolean;
}

// CRITICAL: Default vehicle configurations (can be overridden from database)
export const DEFAULT_VEHICLE_CONFIGS: Record<string, VehiclePricingConfig> = {
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

// Absolute price cap
const ABSOLUTE_MAX_PRICE = 100000;

/**
 * Calculate fare using traffic-aware data
 */
export function calculateDynamicFare(
  distanceKm: number,
  durationMinutes: number,
  vehicleType: string,
  surgeMultiplier: number = 1.0,
  customConfig?: VehiclePricingConfig
): PricingResult {
  console.log(`💰 [PRICING ENGINE] Calculating for ${vehicleType}`);
  console.log(`📏 [PRICING ENGINE] Distance: ${distanceKm}km, Duration: ${durationMinutes}min`);
  
  // Get vehicle configuration
  const config = customConfig || DEFAULT_VEHICLE_CONFIGS[vehicleType] || DEFAULT_VEHICLE_CONFIGS["سطحة"];
  
  console.log(`⚙️ [PRICING ENGINE] Config:`, config);
  
  // CRITICAL FIX #3: Calculate base fare
  const baseFare = config.baseFare;
  
  // CRITICAL FIX #3: Calculate distance fare (THE 7KM RULE - NOT 10KM!)
  const baseDistanceCoverage = 7; // CORRECTED: First 7km included in base fare
  const additionalKm = Math.max(0, distanceKm - baseDistanceCoverage);
  const distanceFare = additionalKm * config.kmRate;
  
  console.log(`📊 [PRICING ENGINE] Base covers first ${baseDistanceCoverage}km | Additional: ${additionalKm.toFixed(2)}km`);
  
  // Calculate time fare
  const timeFare = durationMinutes * config.minuteRate;
  
  // Calculate subtotal
  let subtotal = baseFare + distanceFare + timeFare;
  
  console.log(`💵 [PRICING ENGINE] Base: ${baseFare}, Distance: ${distanceFare}, Time: ${timeFare}`);
  console.log(`💵 [PRICING ENGINE] Subtotal before surge: ${subtotal}`);
  
  // Apply surge multiplier
  subtotal = subtotal * surgeMultiplier;
  
  console.log(`📊 [PRICING ENGINE] Surge multiplier: ${surgeMultiplier}x = ${subtotal}`);
  
  // Ensure minimum fare
  let finalPrice = Math.max(subtotal, config.minimumFare);
  
  console.log(`💰 [PRICING ENGINE] After minimum check (${config.minimumFare}): ${finalPrice}`);
  
  // Apply absolute cap
  let isCapped = false;
  if (finalPrice > ABSOLUTE_MAX_PRICE) {
    console.log(`⚠️ [PRICING ENGINE] Price ${finalPrice} exceeds absolute cap ${ABSOLUTE_MAX_PRICE}`);
    finalPrice = ABSOLUTE_MAX_PRICE;
    isCapped = true;
  }
  
  console.log(`✅ [PRICING ENGINE] Final price: ${finalPrice} IQD`);
  
  return {
    baseFare,
    distanceFare,
    timeFare,
    subtotal: baseFare + distanceFare + timeFare,
    surgeMultiplier,
    finalPrice: Math.round(finalPrice),
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationMinutes: Math.round(durationMinutes),
    isCapped
  };
}

/**
 * Simplified calculation using estimated distance (no traffic data)
 * Used as fallback when Google Maps API is not available
 */
export function calculateSimpleFare(
  distanceKm: number,
  vehicleType: string,
  surgeMultiplier: number = 1.0
): PricingResult {
  // Estimate duration: avg speed 40 km/h in city
  const estimatedDurationMinutes = (distanceKm / 40) * 60;
  
  return calculateDynamicFare(
    distanceKm,
    estimatedDurationMinutes,
    vehicleType,
    surgeMultiplier
  );
}

/**
 * CRITICAL FIX #4: Get current surge multiplier from DATABASE (admin-configurable)
 */
export async function getSurgeMultiplier(storage: any): Promise<number> {
  try {
    const PricingConfig = await import('./PricingConfig');
    const surge = await PricingConfig.getSurgeMultiplier();
    console.log(`✅ [PRICING ENGINE] Surge multiplier: ${surge}x`);
    return surge;
  } catch (error) {
    console.warn("⚠️ [PRICING ENGINE] Could not fetch surge multiplier, using 1.0");
    return 1.0;
  }
}

/**
 * CRITICAL FIX #4: Get vehicle configuration from DATABASE (admin-configurable)
 * This function is a bridge for the pricing engine
 */
export async function getVehicleConfig(
  storage: any,
  vehicleType: string
): Promise<VehiclePricingConfig> {
  try {
    // Import the database-backed config
    const PricingConfig = await import('./PricingConfig');
    const dbConfig = await PricingConfig.getVehiclePricing(vehicleType);
    
    console.log(`✅ [PRICING ENGINE] Loaded ${vehicleType} config from database`);
    
    return {
      vehicleType: dbConfig.vehicleType,
      baseFare: dbConfig.baseFare,
      kmRate: dbConfig.kmRate,
      minuteRate: dbConfig.minuteRate,
      minimumFare: dbConfig.minimumFare
    };
  } catch (error) {
    console.warn(`⚠️ [PRICING ENGINE] Could not fetch config for ${vehicleType} from DB, using default`);
    return DEFAULT_VEHICLE_CONFIGS[vehicleType] || DEFAULT_VEHICLE_CONFIGS["سطحة"];
  }
}
