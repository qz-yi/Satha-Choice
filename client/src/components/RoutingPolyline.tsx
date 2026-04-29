import { useEffect, useState } from 'react';
import { Polyline } from '@/components/SathaMap';

interface RoutingPolylineProps {
  start: [number, number]; // [lat, lng]
  end: [number, number];   // [lat, lng]
  color?: string;
  weight?: number;
  opacity?: number;
}

export function RoutingPolyline({
  start,
  end,
  color = "#f97316",
  weight = 4,
  opacity = 0.7,
}: RoutingPolylineProps) {
  const [routeCoordinates, setRouteCoordinates] = useState<Array<[number, number]>>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!start || !end || !start[0] || !start[1] || !end[0] || !end[1]) return;

    const fetchRoute = async () => {
      setIsLoading(true);
      try {
        // OSRM API المجاني — يعيد geometry بصيغة GeoJSON [lng, lat]
        const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          // نحوّل من [lng, lat] إلى [lat, lng] لتتوافق مع واجهة Polyline (Leaflet-style)
          const coordinates: Array<[number, number]> = data.routes[0].geometry.coordinates.map(
            (coord: [number, number]) => [coord[1], coord[0]],
          );
          setRouteCoordinates(coordinates);
        } else {
          setRouteCoordinates([start, end]);
        }
      } catch (error) {
        console.error('Error fetching route:', error);
        setRouteCoordinates([start, end]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoute();
  }, [start[0], start[1], end[0], end[1]]);

  if (routeCoordinates.length === 0) return null;

  return (
    <Polyline
      positions={routeCoordinates}
      color={color}
      weight={weight}
      opacity={opacity}
      dashArray={isLoading ? "10, 10" : undefined}
    />
  );
}
