import { API_BASE } from '@/lib/http';
/**
 * PROFESSIONAL MAP SERVICE
 * Centralized Google Maps integration for distance/duration calculations
 */

export interface DistanceMatrixResult {
  distanceKm: number;
  durationMinutes: number;
  distanceText: string;
  durationText: string;
  status: 'OK' | 'ERROR';
  error?: string;
}

/**
 * Calculate distance using Haversine formula (fallback)
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
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
  
  return Math.round(distance * 10) / 10;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get distance and duration using Google Maps Distance Matrix API
 * Falls back to Haversine + estimated duration if API fails
 */
export async function getDistanceAndDuration(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<DistanceMatrixResult> {
  console.log('🗺️ [MAP SERVICE] Calculating distance and duration');
  console.log(`📍 Origin: ${originLat}, ${originLng}`);
  console.log(`📍 Destination: ${destLat}, ${destLng}`);
  
  try {
    // Try Google Maps Distance Matrix API first (traffic-aware)
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
    
    if (!apiKey || apiKey === '') {
      console.log('⚠️ [MAP SERVICE] No Google Maps API key - using Haversine fallback');
      return useFallbackCalculation(originLat, originLng, destLat, destLng);
    }
    
    const origin = `${originLat},${originLng}`;
    const destination = `${destLat},${destLng}`;
    
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&mode=driving&departure_time=now&traffic_model=best_guess&key=${apiKey}`;
    
    console.log('🌐 [MAP SERVICE] Calling Google Distance Matrix API...');
    
    // CRITICAL: Call via backend proxy to avoid CORS issues
    const response = await fetch(`${API_BASE}/api/distance-matrix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination })
    });
    
    if (!response.ok) {
      console.warn('⚠️ [MAP SERVICE] API call failed, using fallback');
      return useFallbackCalculation(originLat, originLng, destLat, destLng);
    }
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
      const element = data.rows[0].elements[0];
      const distanceKm = element.distance.value / 1000; // Convert meters to km
      const durationMinutes = element.duration_in_traffic 
        ? element.duration_in_traffic.value / 60 
        : element.duration.value / 60; // Convert seconds to minutes
      
      console.log(`✅ [MAP SERVICE] Google API result: ${distanceKm}km, ${durationMinutes}min`);
      
      return {
        distanceKm: Math.round(distanceKm * 10) / 10,
        durationMinutes: Math.round(durationMinutes),
        distanceText: element.distance.text,
        durationText: element.duration_in_traffic?.text || element.duration.text,
        status: 'OK'
      };
    } else {
      console.warn('⚠️ [MAP SERVICE] API returned non-OK status');
      return useFallbackCalculation(originLat, originLng, destLat, destLng);
    }
  } catch (error) {
    console.error('❌ [MAP SERVICE] Error:', error);
    return useFallbackCalculation(originLat, originLng, destLat, destLng);
  }
}

/**
 * Fallback calculation when Google API is unavailable
 */
function useFallbackCalculation(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): DistanceMatrixResult {
  console.log('🔄 [MAP SERVICE] Using Haversine fallback calculation');
  
  const distanceKm = calculateHaversineDistance(lat1, lng1, lat2, lng2);
  
  // Estimate duration: average speed 40 km/h in city traffic
  const avgSpeedKmh = 40;
  const durationMinutes = (distanceKm / avgSpeedKmh) * 60;
  
  console.log(`✅ [MAP SERVICE FALLBACK] Distance: ${distanceKm}km, Est. Duration: ${durationMinutes}min`);
  
  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationMinutes: Math.round(durationMinutes),
    distanceText: `${distanceKm.toFixed(1)} كم`,
    durationText: `${Math.round(durationMinutes)} دقيقة`,
    status: 'OK'
  };
}

/**
 * Calculate route for navigation polyline
 * Returns array of lat/lng points along the route
 */
export async function getRoutePoints(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<[number, number][]> {
  try {
    console.log('🗺️ [MAP SERVICE] Getting route points for navigation');
    
    // Try to get route from backend (using OSRM or Google Directions)
    const response = await fetch(`${API_BASE}/api/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: { lat: originLat, lng: originLng },
        destination: { lat: destLat, lng: destLng }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ [MAP SERVICE] Received ${data.points?.length || 0} route points`);
      return data.points || [[originLat, originLng], [destLat, destLng]];
    }
    
    // Fallback: straight line
    console.log('⚠️ [MAP SERVICE] Route API failed, using straight line');
    return [[originLat, originLng], [destLat, destLng]];
  } catch (error) {
    console.error('❌ [MAP SERVICE] Error getting route:', error);
    return [[originLat, originLng], [destLat, destLng]];
  }
}
