import {
  ReactNode,
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
  useMemo,
  CSSProperties,
  Children,
  isValidElement,
  cloneElement,
} from "react";
import { createPortal } from "react-dom";
import maplibregl, {
  Map as MlMap,
  Marker as MlMarker,
  Popup as MlPopup,
  LngLatBoundsLike,
  LngLatLike,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { buildMinimalLightStyle } from "./sathaMapStyle";
// ── CSP-safe MapLibre worker ──────────────────────────────────────────────────
// Capacitor's Android WebView blocks workers created via Blob: URLs — which is
// MapLibre's default mechanism (new Worker(URL.createObjectURL(blob))).
// Instead, we import the worker JS as a real asset URL via Vite's ?url suffix.
// Vite copies the file to dist/assets/ and returns its content-hashed path.
// We then call maplibregl.setWorkerUrl() to tell MapLibre to use this real URL
// (e.g. /assets/maplibre-gl-csp-worker-xxxxxx.js) instead of a blob.
//
// ⚠️  setWorkerUrl() MUST be called before any Map is instantiated.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker?url";
maplibregl.setWorkerUrl(maplibreWorkerUrl);

/**
 * 🗺️ ملف PMTiles محلي يغطي جنوب العراق — يعمل أوفلاين بالكامل.
 *  • يُخدَّم من /maps/south_iraq.pmtiles
 *  • Vite يدعم HTTP Range Requests على الملفات الثابتة وهو ما يحتاجه PMTiles.
 *  • Android: يجب أن يكون الملف غير مضغوط في APK (noCompress 'pmtiles' في build.gradle).
 */
export const PMTILES_URL = "/maps/south_iraq.pmtiles";

/**
 * مسار البرنامج المساعد لنصوص RTL (العربية/العبرية).
 *
 * ❌ النسخة القديمة كانت تحمّله من unpkg.com — يفشل داخل APK بدون اتصال.
 * ✅ النسخة الجديدة تحمّله من ملف محلي ضمن الـ APK نفسه (client/public/mapbox-gl-rtl-text.js).
 */
const RTL_PLUGIN_URL = "/mapbox-gl-rtl-text.js";

/**
 * تسجيل بروتوكول pmtiles مع MapLibre — مرة واحدة على مستوى التطبيق.
 * يُضاف كذلك دعم RTL من ملف محلي (أوفلاين-صديق للـ APK).
 */
let pmtilesRegistered = false;
function ensurePmtilesProtocol() {
  if (pmtilesRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  // Arabic/RTL text shaping — load from local file (works offline in APK)
  if (typeof maplibregl.getRTLTextPluginStatus === "function") {
    const status = maplibregl.getRTLTextPluginStatus();
    if (status === "unavailable") {
      maplibregl.setRTLTextPlugin(RTL_PLUGIN_URL, false);
    }
  }
  pmtilesRegistered = true;
}

/**
 * 🇮🇶 حدود العراق — تُمرَّر إلى maxBounds لقفل الخريطة داخل العراق فقط.
 *
 * ⚠️ MapLibre يستخدم تنسيق [lng, lat] (GeoJSON):
 *   [[west, south], [east, north]] = [[38.8, 29.0], [48.6, 37.4]]
 */
export const IRAQ_BOUNDS: LngLatBoundsLike = [
  [38.8, 29.0], // SW (lng, lat)
  [48.6, 37.4], // NE (lng, lat)
];

/** الإحداثيات الافتراضية: مدينة الحلة، محافظة بابل ([lng, lat]) */
export const HILLA_CENTER: [number, number] = [44.42, 32.48];

// ── Map context & useMap hook ──────────────────────────────────────────────
const MapContext = createContext<MlMap | null>(null);

/**
 * Shim يُحاكي واجهة Leaflet (`flyTo`, `setView`, `getCenter`, …) فوق MapLibre
 * ليبقى كود الصفحات الحالي يعمل بدون تعديل واسع.
 *
 * ⚠️ المدخلات بصيغة [lat, lng] (مثل Leaflet) — تُحوَّل داخلياً إلى [lng, lat].
 */
function buildMapShim(map: MlMap) {
  return {
    _native: map,
    getCenter: () => {
      const c = map.getCenter();
      return { lat: c.lat, lng: c.lng };
    },
    getZoom: () => map.getZoom(),
    setView: (
      latlng: [number, number],
      zoom?: number,
      opts?: { animate?: boolean; duration?: number },
    ) => {
      const animate = opts?.animate !== false;
      const dur = (opts?.duration ?? 1) * 1000;
      const target = { center: [latlng[1], latlng[0]] as LngLatLike, zoom: zoom ?? map.getZoom() };
      if (animate) map.easeTo({ ...target, duration: dur });
      else map.jumpTo(target);
    },
    flyTo: (
      latlng: [number, number],
      zoom?: number,
      opts?: { duration?: number },
    ) => {
      map.flyTo({
        center: [latlng[1], latlng[0]],
        zoom: zoom ?? map.getZoom(),
        duration: (opts?.duration ?? 1.5) * 1000,
        essential: true,
      });
    },
    panTo: (latlng: [number, number]) => {
      map.panTo([latlng[1], latlng[0]]);
    },
    invalidateSize: () => map.resize(),
  };
}

export type SathaMapInstance = ReturnType<typeof buildMapShim>;

export function useMap(): SathaMapInstance {
  const map = useContext(MapContext);
  if (!map) {
    throw new Error("useMap() must be used inside <SathaMap>");
  }
  return useMemo(() => buildMapShim(map), [map]);
}

// ── useMapEvents — subscribe to map events, returns shim ────────────────────
type MapEventHandlers = {
  moveend?: () => void;
  movestart?: () => void;
  dragend?: () => void;
  dragstart?: () => void;
  zoomend?: () => void;
  click?: (e: any) => void;
};

export function useMapEvents(handlers: MapEventHandlers): SathaMapInstance {
  const map = useContext(MapContext);
  if (!map) throw new Error("useMapEvents() must be used inside <SathaMap>");

  useEffect(() => {
    const entries = Object.entries(handlers).filter(([, fn]) => typeof fn === "function") as [
      string,
      (...a: any[]) => void,
    ][];
    entries.forEach(([ev, fn]) => map.on(ev as any, fn));
    return () => {
      entries.forEach(([ev, fn]) => map.off(ev as any, fn));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return useMemo(() => buildMapShim(map), [map]);
}

// ── divIcon helper (Leaflet-compatible signature) ──────────────────────────
export interface DivIcon {
  __sathaIcon: true;
  html: string;
  className?: string;
  iconSize: [number, number];
  iconAnchor?: [number, number];
}

export function divIcon(opts: {
  html: string;
  className?: string;
  iconSize: [number, number];
  iconAnchor?: [number, number];
}): DivIcon {
  return { __sathaIcon: true, ...opts };
}

// Leaflet-compatible facade: `import L from "@/components/SathaMap"` works
export const L = { divIcon };

// ── Popup component (must be a child of Marker) ─────────────────────────────
interface PopupProps {
  children?: ReactNode;
  minWidth?: number;
  maxWidth?: number;
  // Internally injected by Marker:
  __mlMarker?: MlMarker;
  __map?: MlMap;
}

export function Popup({ children, minWidth, maxWidth, __mlMarker, __map }: PopupProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  if (!containerRef.current && typeof document !== "undefined") {
    containerRef.current = document.createElement("div");
  }

  useEffect(() => {
    if (!__mlMarker || !__map || !containerRef.current) return;
    const popup = new maplibregl.Popup({
      offset: 24,
      closeButton: true,
      closeOnClick: true,
      maxWidth: maxWidth ? `${maxWidth}px` : "300px",
    }).setDOMContent(containerRef.current);

    if (minWidth) {
      const el = popup.getElement();
      if (el) (el as HTMLElement).style.minWidth = `${minWidth}px`;
    }

    __mlMarker.setPopup(popup);

    return () => {
      // Detach popup so it doesn't linger after Marker unmount
      try {
        __mlMarker.setPopup(undefined as any);
      } catch {}
      popup.remove();
    };
  }, [__mlMarker, __map, minWidth, maxWidth]);

  if (!containerRef.current) return null;
  return createPortal(<div dir="rtl">{children}</div>, containerRef.current);
}

// ── Marker component ────────────────────────────────────────────────────────
interface MarkerProps {
  position: [number, number]; // [lat, lng] — Leaflet convention
  icon?: DivIcon;
  draggable?: boolean;
  eventHandlers?: {
    dragend?: (e: { target: { getLatLng: () => { lat: number; lng: number } } }) => void;
    dragstart?: (e: any) => void;
    click?: (e: any) => void;
  };
  children?: ReactNode;
}

export function Marker({ position, icon, draggable, eventHandlers, children }: MarkerProps) {
  const map = useContext(MapContext);
  const markerRef = useRef<MlMarker | null>(null);
  const [, forceRerender] = useState(0);

  // Build the marker once (or whenever icon identity changes)
  useEffect(() => {
    if (!map) return;

    let element: HTMLElement | undefined;
    let offset: [number, number] | undefined;

    if (icon && icon.__sathaIcon) {
      element = document.createElement("div");
      if (icon.className) element.className = icon.className;
      element.style.width = `${icon.iconSize[0]}px`;
      element.style.height = `${icon.iconSize[1]}px`;
      element.style.cursor = draggable ? "grab" : "pointer";
      element.innerHTML = icon.html;

      // Convert Leaflet iconAnchor (offset from top-left) to MapLibre offset
      // (offset from element center where the geographical anchor sits).
      const [w, h] = icon.iconSize;
      const [ax, ay] = icon.iconAnchor ?? [w / 2, h / 2];
      offset = [w / 2 - ax, h / 2 - ay];
    }

    const marker = new maplibregl.Marker({
      element,
      draggable: !!draggable,
      anchor: element ? "center" : "bottom",
      offset,
    })
      .setLngLat([position[1], position[0]])
      .addTo(map);

    if (draggable && eventHandlers?.dragstart) {
      marker.on("dragstart", () => eventHandlers.dragstart?.({ target: marker }));
    }
    if (draggable && eventHandlers?.dragend) {
      marker.on("dragend", () => {
        const ll = marker.getLngLat();
        eventHandlers.dragend?.({
          target: { getLatLng: () => ({ lat: ll.lat, lng: ll.lng }) },
        });
      });
    }
    if (eventHandlers?.click && element) {
      element.addEventListener("click", (e) => eventHandlers.click?.(e));
    }

    markerRef.current = marker;
    forceRerender((n) => n + 1); // so Popup child can pick up the marker

    return () => {
      marker.remove();
      markerRef.current = null;
    };
    // We deliberately re-create the marker if icon or draggable change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, icon, draggable]);

  // Update position without rebuilding the marker
  useEffect(() => {
    if (markerRef.current) markerRef.current.setLngLat([position[1], position[0]]);
  }, [position[0], position[1]]);

  // Inject marker/map into <Popup> child(ren)
  if (!map || !markerRef.current) return null;
  return (
    <>
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        if (child.type === Popup) {
          return cloneElement(child as any, {
            __mlMarker: markerRef.current,
            __map: map,
          });
        }
        return child;
      })}
    </>
  );
}

// ── Polyline ────────────────────────────────────────────────────────────────
interface PolylineProps {
  positions: Array<[number, number]>; // [lat, lng]
  color?: string;
  weight?: number;
  opacity?: number;
  dashArray?: string;
}

let polylineCounter = 0;

export function Polyline({
  positions,
  color = "#f97316",
  weight = 4,
  opacity = 0.7,
  dashArray,
}: PolylineProps) {
  const map = useContext(MapContext);
  const idRef = useRef<string>(`satha-line-${++polylineCounter}`);

  useEffect(() => {
    if (!map) return;
    const id = idRef.current;
    const sourceId = `${id}-src`;

    const geojson = {
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: positions.map(([lat, lng]) => [lng, lat]),
      },
      properties: {},
    };

    const ensureLayer = () => {
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: "geojson", data: geojson });
      } else {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojson as any);
      }
      if (!map.getLayer(id)) {
        const paint: any = {
          "line-color": color,
          "line-width": weight,
          "line-opacity": opacity,
        };
        if (dashArray) {
          // crude conversion: "10, 10" → [2, 2]
          const parts = dashArray.split(/[\s,]+/).map((n) => parseFloat(n) / 5).filter((n) => !isNaN(n));
          if (parts.length) paint["line-dasharray"] = parts;
        }
        map.addLayer({
          id,
          type: "line",
          source: sourceId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint,
        });
      } else {
        map.setPaintProperty(id, "line-color", color);
        map.setPaintProperty(id, "line-width", weight);
        map.setPaintProperty(id, "line-opacity", opacity);
      }
    };

    if (map.isStyleLoaded()) {
      ensureLayer();
    } else {
      map.once("styledata", ensureLayer);
    }

    return () => {
      try {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {}
    };
  }, [map, JSON.stringify(positions), color, weight, opacity, dashArray]);

  return null;
}

// ── SathaMap container ──────────────────────────────────────────────────────
interface SathaMapProps {
  /** [lat, lng] على نمط Leaflet — اختياري، الافتراضي مدينة الحلة. */
  center?: [number, number];
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  zoomControl?: boolean;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
  onMapReady?: (map: MlMap) => void;
  onDragstart?: () => void;
}

/**
 * مكوّن الخريطة الموحّد — مبني على MapLibre GL JS + PMTiles المحلية (أوفلاين).
 *
 * المزايا المُفعَّلة:
 *  - Vector tiles من ملف south_iraq.pmtiles (لا اتصال بالإنترنت مطلوب للبلاطات)
 *  - ستايل Minimal Light (شوارع بيضاء، خلفية رمادية فاتحة، أسماء عربية RTL)
 *  - maxBounds مقيّدة بحدود العراق
 *  - trackResize: true لضبط الحجم تلقائياً
 *  - antialias مفعّل عبر canvasContextAttributes (maplibre-gl v5)
 *  - Hardware acceleration عبر translate3d على عنصر الـ canvas (انظر index.css)
 *  - shim يحاكي API الـ react-leaflet ليبقى كود الصفحات الحالي صالحاً
 */
export function SathaMap({
  center,
  zoom = 12,
  minZoom = 5,
  maxZoom = 19,
  zoomControl = false,
  style,
  className,
  children,
  onMapReady,
  onDragstart,
}: SathaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<MlMap | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // سجّل بروتوكول pmtiles + RTL plugin قبل إنشاء الخريطة
    ensurePmtilesProtocol();

    // Convert [lat, lng] from props → [lng, lat] for MapLibre, fallback to Hilla
    const startCenter: [number, number] = center
      ? [center[1], center[0]]
      : HILLA_CENTER;

    let map: MlMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: buildMinimalLightStyle(PMTILES_URL),
        center: startCenter,
        zoom,
        minZoom,
        maxZoom,
        maxBounds: IRAQ_BOUNDS,
        trackResize: true,
        canvasContextAttributes: {
          antialias: true,
          powerPreference: "high-performance",
        },
        attributionControl: false,
        cooperativeGestures: false,
        // مهم لتحسين الأداء على الموبايل
        fadeDuration: 150,
      });
    } catch (err: any) {
      // غالباً WebGL غير متوفر (محاكي/متصفح بدون GPU)
      console.error("[SathaMap] WebGL/Map init failed:", err);
      setInitError(
        err?.message?.includes("WebGL")
          ? "المتصفح لا يدعم تسريع الرسومات (WebGL). يرجى التحديث."
          : "تعذّر تحميل الخريطة. يرجى المحاولة لاحقاً.",
      );
      return;
    }

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    if (zoomControl) {
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
        "top-left",
      );
    }

    map.on("dragstart", () => onDragstart?.());

    map.on("load", () => {
      onMapReady?.(map);
      // Hardware-acceleration hint على الـ canvas نفسه
      const canvas = map.getCanvas();
      canvas.style.willChange = "transform";
      canvas.style.transform = "translate3d(0,0,0)";

      map.resize();
      setTimeout(() => map.resize(), 100);
      setTimeout(() => map.resize(), 400);
      setMapInstance(map);
    });

    return () => {
      map.remove();
      setMapInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", height: "100%", width: "100%", ...style }}
    >
      {initError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-700 text-center p-6">
          <div>
            <p className="font-bold text-lg mb-2">⚠️ تعذّر تحميل الخريطة</p>
            <p className="text-sm">{initError}</p>
          </div>
        </div>
      )}
      {mapInstance && (
        <MapContext.Provider value={mapInstance}>{children}</MapContext.Provider>
      )}
    </div>
  );
}

export default SathaMap;
