/**
 * FEATURE 2: Dynamic Distance-Based Pricing Calculator
 * Calculates tow truck pricing based on distance and vehicle type
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 - Pickup latitude
 * @param lon1 - Pickup longitude
 * @param lat2 - Dropoff latitude
 * @param lon2 - Dropoff longitude
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate price based on distance and vehicle type
 * 
 * Pricing Rules:
 * - Small Tow Truck: 25,000 IQD base (10km) + 500 IQD/km over 10km
 * - Large/Hydraulic Tow Truck: 30,000 IQD base (10km) + 1,000 IQD/km over 10km
 * - Maximum price cap: 50,000 IQD
 * 
 * @param distance - Distance in kilometers
 * @param vehicleType - Type of vehicle ("سطحة صغيرة" or "سطحة كبيرة"/"سطحة هيدروليك")
 * @returns Calculated price in IQD
 */
export function calculatePrice(distance: number, vehicleType: string): number {
  console.log(`💰 [PRICING] Calculating price for ${distance}km, vehicle: ${vehicleType}`);
  
  let basePrice: number;
  let pricePerKmOver10: number;
  const baseCoverageKm = 10;
  const maxPrice = 50000;
  
  // Determine pricing based on vehicle type
  if (vehicleType === "سطحة صغيرة" || vehicleType.toLowerCase().includes("small")) {
    basePrice = 25000;
    pricePerKmOver10 = 500;
  } else {
    // Large or Hydraulic
    basePrice = 30000; // Updated from 40,000 to 30,000
    pricePerKmOver10 = 1000;
  }
  
  let finalPrice: number;
  
  if (distance <= baseCoverageKm) {
    // Within base coverage
    finalPrice = basePrice;
    console.log(`💰 [PRICING] Distance ${distance}km <= ${baseCoverageKm}km - Using base price: ${basePrice} IQD`);
  } else {
    // Calculate additional km
    const additionalKm = distance - baseCoverageKm;
    const additionalCost = additionalKm * pricePerKmOver10;
    finalPrice = basePrice + additionalCost;
    console.log(`💰 [PRICING] Base: ${basePrice} + (${additionalKm}km × ${pricePerKmOver10}) = ${finalPrice} IQD`);
  }
  
  // Apply maximum cap
  if (finalPrice > maxPrice) {
    console.log(`⚠️ [PRICING] Price ${finalPrice} exceeds max cap ${maxPrice} - Applying cap`);
    finalPrice = maxPrice;
  }
  
  console.log(`✅ [PRICING] Final price: ${finalPrice} IQD`);
  
  return Math.round(finalPrice);
}

/**
 * Get pricing breakdown for display to user
 */
export interface PricingBreakdown {
  distance: number;
  basePrice: number;
  additionalKm: number;
  additionalCost: number;
  subtotal: number;
  finalPrice: number;
  isCapped: boolean;
}

export function getPricingBreakdown(
  distance: number,
  vehicleType: string
): PricingBreakdown {
  const baseCoverageKm = 10;
  const maxPrice = 50000;
  
  let basePrice: number;
  let pricePerKmOver10: number;
  
  if (vehicleType === "سطحة صغيرة" || vehicleType.toLowerCase().includes("small")) {
    basePrice = 25000;
    pricePerKmOver10 = 500;
  } else {
    basePrice = 30000;
    pricePerKmOver10 = 1000;
  }
  
  const additionalKm = Math.max(0, distance - baseCoverageKm);
  const additionalCost = additionalKm * pricePerKmOver10;
  const subtotal = basePrice + additionalCost;
  const finalPrice = Math.min(subtotal, maxPrice);
  const isCapped = subtotal > maxPrice;
  
  return {
    distance: Math.round(distance * 10) / 10,
    basePrice,
    additionalKm: Math.round(additionalKm * 10) / 10,
    additionalCost,
    subtotal,
    finalPrice,
    isCapped
  };
}
