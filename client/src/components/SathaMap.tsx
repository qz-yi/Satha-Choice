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
// Capacitor Android WebView blocks Blob: URLs. We import the worker as a real
// asset path via Vite's ?url suffix — it gets a content-hashed URL in dist/.
// MUST be called before any Map is instantiated.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker?url";
maplibregl.setWorkerUrl(maplibreWorkerUrl);

/** Local PMTiles file — served offline from bundled assets. */
export const PMTILES_URL = "/maps/south_iraq.pmtiles";

/**
 * RTL text plugin — loaded from a local file bundled in the APK.
 * The old version pointed to unpkg.com, which fails offline.
 */
const RTL_PLUGIN_URL = "/mapbox-gl-rtl-text.js";

// Register the pmtiles:// protocol + RTL plugin exactly once per page load.
let pmtilesRegistered = false;
function ensurePmtilesProtocol() {
  if (pmtilesRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  if (typeof maplibregl.getRTLTextPluginStatus === "function") {
    const status = maplibregl.getRTLTextPluginStatus();
    if (status === "unavailable") {
      maplibregl.setRTLTextPlugin(RTL_PLUGIN_URL, false);
    }
  }
  pmtilesRegistered = true;
}

/** Iraq bounding box for maplibre — [lng, lat] GeoJSON order. */
export const IRAQ_BOUNDS: LngLatBoundsLike = [
  [38.8, 29.0], // SW
  [48.6, 37.4], // NE
];

/** Default centre: Hilla city, Babylon Governorate ([lng, lat]) */
export const HILLA_CENTER: [number, number] = [44.42, 32.48];

// ── Map context ───────────────────────────────────────────────────────────────
const MapContext = createContext<MlMap | null>(null);

/**
 * Shim that mirrors the Leaflet API ([lat, lng]) over MapLibre ([lng, lat]).
 * Keeps every call-site in the pages working without a large refactor.
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
  if (!map) throw new Error("useMap() must be used inside <SathaMap>");
  return useMemo(() => buildMapShim(map), [map]);
}

// ── useMapEvents ──────────────────────────────────────────────────────────────
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
    const entries = Object.entries(handlers).filter(
      ([, fn]) => typeof fn === "function",
    ) as [string, (...a: any[]) => void][];
    entries.forEach(([ev, fn]) => map.on(ev as any, fn));
    return () => {
      entries.forEach(([ev, fn]) => map.off(ev as any, fn));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return useMemo(() => buildMapShim(map), [map]);
}

// ── divIcon helper ────────────────────────────────────────────────────────────
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

export const L = { divIcon };

// ── Popup ─────────────────────────────────────────────────────────────────────
interface PopupProps {
  children?: ReactNode;
  minWidth?: number;
  maxWidth?: number;
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
      try { __mlMarker.setPopup(undefined as any); } catch {}
      popup.remove();
    };
  }, [__mlMarker, __map, minWidth, maxWidth]);

  if (!containerRef.current) return null;
  return createPortal(<div dir="rtl">{children}</div>, containerRef.current);
}

// ── Marker ────────────────────────────────────────────────────────────────────
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
    forceRerender((n) => n + 1);

    return () => {
      marker.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, icon, draggable]);

  useEffect(() => {
    if (markerRef.current) markerRef.current.setLngLat([position[1], position[0]]);
  }, [position[0], position[1]]);

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

// ── Polyline ──────────────────────────────────────────────────────────────────
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

// ── SathaMap container ────────────────────────────────────────────────────────
interface SathaMapProps {
  center?: [number, number]; // [lat, lng] — Leaflet convention
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
 * Unified map component — MapLibre GL JS + local PMTiles (fully offline).
 *
 * Android WebView hardening applied:
 *  1. ResizeObserver deferred init — map is only created once the container
 *     has actual pixel dimensions (> 0 × 0). This is the primary fix for the
 *     blank white canvas on Android, where React's useEffect fires before the
 *     browser completes flex/percentage layout.
 *  2. antialias: false — halves GPU memory usage. Antialias is the #1 cause
 *     of WebGL context creation failure on budget Android hardware.
 *  3. powerPreference: "default" — "high-performance" causes context loss on
 *     many Qualcomm/MediaTek GPUs when thermal throttling kicks in.
 *  4. failIfMajorPerformanceCaveat: false — allows MapLibre to fall back to
 *     software rendering instead of returning a null context.
 *  5. webglcontextlost/restored — detect and recover from GPU context loss
 *     (Android kills WebGL contexts under memory pressure).
 *  6. Local glyphs + sprite — no CDN calls; works fully offline in the APK.
 *  7. Multiple resize() calls with increasing delays to handle dynamic
 *     viewport changes caused by the Android soft keyboard.
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
  const mapRef = useRef<MlMap | null>(null);
  const [mapInstance, setMapInstance] = useState<MlMap | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const destroyedRef = useRef(false);

  useEffect(() => {
    destroyedRef.current = false;
    const container = containerRef.current;
    if (!container) return;

    ensurePmtilesProtocol();

    const startCenter: [number, number] = center
      ? [center[1], center[0]]
      : HILLA_CENTER;

    // ── createMap: called once we know the container has real pixel size ──
    function createMap() {
      if (destroyedRef.current) return;
      if (!container) return;

      const { width, height } = container.getBoundingClientRect();
      if (width === 0 || height === 0) {
        // Should not reach here normally (observer guards below), but be safe.
        console.warn("[SathaMap] Container still 0×0 at createMap — retrying in 100ms");
        setTimeout(createMap, 100);
        return;
      }

      let map: MlMap;
      try {
        map = new maplibregl.Map({
          container,
          style: buildMinimalLightStyle(PMTILES_URL),
          center: startCenter,
          zoom,
          minZoom,
          maxZoom,
          maxBounds: IRAQ_BOUNDS,
          trackResize: true,
          // ── WebGL context attributes hardened for Android WebView ─────
          canvasContextAttributes: {
            // antialias OFF: biggest single GPU-memory saving on mobile.
            // With antialias ON many budget Qualcomm/MediaTek GPUs silently
            // fail to create the WebGL context → blank white canvas.
            antialias: false,
            // Allow software-rendering fallback instead of null context.
            failIfMajorPerformanceCaveat: false,
            // "default" avoids triggering thermal throttle-kill on mid-range
            // Android devices (which drops the GPU context entirely).
            powerPreference: "default",
          },
          attributionControl: false,
          cooperativeGestures: false,
          fadeDuration: 150,
        });
      } catch (err: any) {
        if (destroyedRef.current) return;
        console.error("[SathaMap] Map init failed:", err);
        setInitError(
          err?.message?.includes("WebGL")
            ? "المتصفح لا يدعم تسريع الرسومات (WebGL). يرجى التحديث."
            : "تعذّر تحميل الخريطة. يرجى المحاولة لاحقاً.",
        );
        return;
      }

      mapRef.current = map;

      // ── WebGL context-loss recovery ───────────────────────────────────
      // Android kills WebGL contexts under memory pressure. Without this
      // handler the canvas turns permanently white after any memory spike.
      const canvas = map.getCanvas();

      const onContextLost = (e: Event) => {
        e.preventDefault();
        console.warn("[SathaMap] WebGL context lost — will attempt restore");
      };
      const onContextRestored = () => {
        console.info("[SathaMap] WebGL context restored — triggering map resize");
        map.resize();
      };
      canvas.addEventListener("webglcontextlost", onContextLost);
      canvas.addEventListener("webglcontextrestored", onContextRestored);

      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-left",
      );

      if (zoomControl) {
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
          "top-left",
        );
      }

      map.on("dragstart", () => onDragstart?.());

      map.on("load", () => {
        if (destroyedRef.current) {
          map.remove();
          return;
        }

        onMapReady?.(map);

        // Hardware-acceleration hint on the canvas element
        canvas.style.willChange = "transform";
        canvas.style.transform = "translate3d(0,0,0)";

        // Staggered resize() calls handle dynamic viewport changes on Android
        // (e.g. soft keyboard appearing, status-bar animation, Capacitor safe-area).
        map.resize();
        setTimeout(() => { if (!destroyedRef.current) map.resize(); }, 150);
        setTimeout(() => { if (!destroyedRef.current) map.resize(); }, 500);
        setTimeout(() => { if (!destroyedRef.current) map.resize(); }, 1200);

        if (!destroyedRef.current) setMapInstance(map);
      });
    }

    // ── ResizeObserver: only init the map once the container has pixels ───
    // On Android WebView, React's useEffect fires BEFORE the browser has
    // calculated percentage-based heights. The container may be 0×0 at this
    // point. We observe it and create the map as soon as it has real size.
    const { width, height } = container.getBoundingClientRect();

    if (width > 0 && height > 0) {
      // Container already has size — create map immediately.
      createMap();
    } else {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w > 0 && h > 0) {
            ro.disconnect();
            createMap();
            break;
          }
        }
      });
      ro.observe(container);

      // Absolute fallback: if ResizeObserver never fires within 2s, try anyway.
      const fallbackTimer = setTimeout(() => {
        ro.disconnect();
        createMap();
      }, 2000);

      return () => {
        destroyedRef.current = true;
        ro.disconnect();
        clearTimeout(fallbackTimer);
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
        setMapInstance(null);
      };
    }

    // Cleanup for the "already has size" path
    return () => {
      destroyedRef.current = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        // Explicit inset-fill for Android WebView — do not use height:100% alone,
        // it may resolve to 0 if the flex parent hasn't completed layout yet.
        // "100%" on width is safe; height is forced via flex-grow in the wrapper.
        width: "100%",
        height: "100%",
        overflow: "hidden",
        ...style,
      }}
    >
      {initError && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f3f4f6",
            color: "#374151",
            textAlign: "center",
            padding: 24,
            zIndex: 10,
          }}
        >
          <div>
            <p style={{ fontWeight: "bold", fontSize: 18, marginBottom: 8 }}>
              ⚠️ تعذّر تحميل الخريطة
            </p>
            <p style={{ fontSize: 14 }}>{initError}</p>
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
