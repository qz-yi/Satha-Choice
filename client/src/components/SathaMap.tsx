import { ReactNode, useEffect, CSSProperties } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Map as LeafletMap, LatLngBoundsLiteral } from "leaflet";

/**
 * 🇮🇶 حدود العراق التقريبية — تُستخدم كـ maxBounds على كل خرائط التطبيق.
 *  - تمنع المستخدم من السحب خارج هذه الحدود → لا تظهر مساحات رمادية فارغة
 *  - تقلّل عدد البلاطات (tiles) المحملة → استهلاك ذاكرة أقل وأداء أسرع
 *
 * Format: [[south, west], [north, east]] = [[lat, lng], [lat, lng]]
 */
export const IRAQ_BOUNDS: LatLngBoundsLiteral = [
  [29.0, 38.8], // SW
  [37.4, 48.6], // NE
];

const POSITRON_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

interface SathaMapProps {
  center: [number, number];
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  zoomControl?: boolean;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
  /** يُستدعى مرة واحدة عند جاهزية الخريطة — مفيد للحصول على instance لـ Leaflet Map */
  onMapReady?: (map: LeafletMap) => void;
  /** يُستدعى عند أول سحب للخريطة — مثلاً لإيقاف وضع التتبع التلقائي للسائق */
  onDragstart?: () => void;
}

/**
 * جسر داخلي ينقل أحداث Leaflet إلى دوال props خارجية، ويضمن
 * استدعاء invalidateSize() بعد التركيب لتعبئة الحاوية كاملةً.
 */
function SathaMapEventBridge({
  onDragstart,
  onMapReady,
}: {
  onDragstart?: () => void;
  onMapReady?: (map: LeafletMap) => void;
}) {
  const map = useMap();
  useEffect(() => {
    onMapReady?.(map);
    // ضمان أن الخريطة تملأ الشاشة بالكامل من اللحظة الأولى،
    // حتى لو كانت الحاوية الأم تتغير حجمها بأنيميشن.
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map, onMapReady]);
  useMapEvents({
    dragstart: () => onDragstart?.(),
  });
  return null;
}

/**
 * مكوّن الخريطة الموحّد للتطبيق (SathaMap).
 *
 * تَجمع كل الإعدادات الحرجة في مكان واحد لتسهيل:
 *  • تغيير ثيم الخرائط لاحقاً (Vector / Mapbox / Native SDK)
 *  • الترقية إلى Capacitor Google Maps Plugin دون تعديل صفحات العرض
 *
 * الإعدادات المُفعّلة:
 *  - preferCanvas: true       → يستخدم Canvas بدل DOM لرسم العناصر (أسرع على الموبايل)
 *  - keepBuffer: 10           → يحمّل 10 صفوف بلاطات إضافية في كل اتجاه (سحب سلس)
 *  - maxBounds: IRAQ_BOUNDS   → يقفل العرض داخل العراق
 *  - maxBoundsViscosity: 1.0  → يمنع السحب خارج الحدود تماماً
 *  - detectRetina: true       → بلاطات بدقة عالية للشاشات Retina
 *  - tileSize: 256            → الحجم الافتراضي لبلاطات Carto
 *  - invalidateSize() مزدوج   → يضمن ملء الحاوية حتى مع الأنيميشن
 */
export function SathaMap({
  center,
  zoom = 15,
  minZoom = 5,
  maxZoom = 19,
  zoomControl = false,
  style,
  className,
  children,
  onMapReady,
  onDragstart,
}: SathaMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      minZoom={minZoom}
      maxZoom={maxZoom}
      zoomControl={zoomControl}
      style={style ?? { height: "100%", width: "100%" }}
      className={className}
      preferCanvas={true}
      maxBounds={IRAQ_BOUNDS}
      maxBoundsViscosity={1.0}
      worldCopyJump={false}
    >
      <TileLayer
        url={POSITRON_TILE_URL}
        attribution={TILE_ATTRIBUTION}
        subdomains={["a", "b", "c", "d"]}
        detectRetina={true}
        keepBuffer={10}
        tileSize={256}
        maxZoom={19}
      />
      <SathaMapEventBridge onDragstart={onDragstart} onMapReady={onMapReady} />
      {children}
    </MapContainer>
  );
}

export default SathaMap;
