import type { StyleSpecification } from "maplibre-gl";

/**
 * Minimal Light style for SATHA — مظهر هادئ يشبه Apple Maps:
 *  • خلفية رمادية فاتحة جداً
 *  • شوارع بيضاء بحدود رمادية رفيعة (اللون يتغير حسب نوع الطريق)
 *  • مياه زرقاء فاتحة
 *  • مباني رمادية شفافة
 *  • أسماء عربية أولاً ثم الإنجليزية احتياطاً (RTL)
 *
 * المصدر: ملف PMTiles محلي لجنوب العراق (Protomaps Basemaps schema).
 *
 * ⚠️ تتطلب MapLibre تسجيل بروتوكول pmtiles مسبقاً عبر:
 *    maplibregl.addProtocol("pmtiles", new pmtiles.Protocol().tile);
 */
export function buildMinimalLightStyle(pmtilesUrl: string): StyleSpecification {
  // Coalesce: name:ar → name (الاسم الافتراضي) — يضمن ظهور الأسماء العربية حيث وُجدت
  const ARABIC_TEXT_FIELD = [
    "coalesce",
    ["get", "name:ar"],
    ["get", "name"],
  ] as any;

  return {
    version: 8,
    name: "SATHA Minimal Light",
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sprite: "https://protomaps.github.io/basemaps-assets/sprites/v4/light",
    sources: {
      protomaps: {
        type: "vector",
        url: `pmtiles://${pmtilesUrl}`,
        attribution:
          '© <a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    },
    layers: [
      // ── الخلفية ────────────────────────────────────────────────────────
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#f5f5f4" },
      },
      // ── الأرض / Earth ─────────────────────────────────────────────────
      {
        id: "earth",
        type: "fill",
        source: "protomaps",
        "source-layer": "earth",
        paint: { "fill-color": "#fafaf9" },
      },
      // ── استخدامات الأرض (حدائق، مساحات خضراء، إلخ) ───────────────────
      {
        id: "landuse-park",
        type: "fill",
        source: "protomaps",
        "source-layer": "landuse",
        filter: ["any", ["==", ["get", "kind"], "park"], ["==", ["get", "kind"], "forest"], ["==", ["get", "kind"], "grass"]],
        paint: { "fill-color": "#e8efe5" },
      },
      {
        id: "landuse-residential",
        type: "fill",
        source: "protomaps",
        "source-layer": "landuse",
        filter: ["==", ["get", "kind"], "residential"],
        paint: { "fill-color": "#f2f1ee" },
      },
      // ── المياه ────────────────────────────────────────────────────────
      {
        id: "water",
        type: "fill",
        source: "protomaps",
        "source-layer": "water",
        paint: { "fill-color": "#cfe4ee" },
      },
      {
        id: "physical-line-river",
        type: "line",
        source: "protomaps",
        "source-layer": "physical_line",
        filter: ["==", ["get", "kind"], "river"],
        paint: { "line-color": "#cfe4ee", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 14, 2.5] },
      },
      // ── المباني ───────────────────────────────────────────────────────
      {
        id: "buildings",
        type: "fill",
        source: "protomaps",
        "source-layer": "buildings",
        minzoom: 14,
        paint: {
          "fill-color": "#e8e6e0",
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 16, 0.85],
        },
      },
      // ── خط حدود الطرق (يُرسم أولاً ليبدو الطريق محاطاً) ──────────────
      {
        id: "roads-casing",
        type: "line",
        source: "protomaps",
        "source-layer": "roads",
        filter: ["any", ["==", ["get", "kind"], "highway"], ["==", ["get", "kind"], "major_road"], ["==", ["get", "kind"], "medium_road"]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#dcdcdc",
          "line-width": [
            "interpolate", ["exponential", 1.6], ["zoom"],
            8, 0.6,
            12, 2.0,
            14, 4.0,
            18, 16,
          ],
        },
      },
      // ── جسم الطرق (أبيض) ─────────────────────────────────────────────
      {
        id: "roads-minor",
        type: "line",
        source: "protomaps",
        "source-layer": "roads",
        filter: ["==", ["get", "kind"], "minor_road"],
        minzoom: 13,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 13, 0.5, 18, 6],
        },
      },
      {
        id: "roads-medium",
        type: "line",
        source: "protomaps",
        "source-layer": "roads",
        filter: ["==", ["get", "kind"], "medium_road"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 8, 0.4, 14, 2.4, 18, 10],
        },
      },
      {
        id: "roads-major",
        type: "line",
        source: "protomaps",
        "source-layer": "roads",
        filter: ["==", ["get", "kind"], "major_road"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 8, 0.6, 14, 3.0, 18, 12],
        },
      },
      {
        id: "roads-highway",
        type: "line",
        source: "protomaps",
        "source-layer": "roads",
        filter: ["==", ["get", "kind"], "highway"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 6, 0.5, 14, 4.0, 18, 14],
        },
      },
      // ── الحدود الإدارية (رفيعة وخفيفة) ───────────────────────────────
      {
        id: "boundaries",
        type: "line",
        source: "protomaps",
        "source-layer": "boundaries",
        filter: ["<=", ["get", "kind_detail"], 4],
        paint: {
          "line-color": "#bdbdbd",
          "line-dasharray": [3, 2],
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.4, 12, 1.2],
        },
      },
      // ── أسماء الشوارع ────────────────────────────────────────────────
      {
        id: "roads-labels",
        type: "symbol",
        source: "protomaps",
        "source-layer": "roads",
        minzoom: 13,
        filter: ["any", ["==", ["get", "kind"], "highway"], ["==", ["get", "kind"], "major_road"], ["==", ["get", "kind"], "medium_road"]],
        layout: {
          "text-field": ARABIC_TEXT_FIELD,
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "symbol-placement": "line",
          "text-letter-spacing": 0.05,
          "text-rotation-alignment": "map",
        },
        paint: {
          "text-color": "#5c5c5c",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      },
      // ── أسماء الأماكن (مدن/قرى) ──────────────────────────────────────
      {
        id: "places-locality",
        type: "symbol",
        source: "protomaps",
        "source-layer": "places",
        filter: ["any", ["==", ["get", "kind"], "locality"], ["==", ["get", "kind"], "city"], ["==", ["get", "kind"], "town"], ["==", ["get", "kind"], "village"]],
        layout: {
          "text-field": ARABIC_TEXT_FIELD,
          "text-font": ["Noto Sans Bold"],
          "text-size": [
            "interpolate", ["linear"], ["zoom"],
            5, 11,
            10, 14,
            14, 18,
          ],
          "text-anchor": "center",
          "text-allow-overlap": false,
          "text-padding": 4,
        },
        paint: {
          "text-color": "#2a2a2a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      },
      // ── أسماء الأحياء/مناطق المدينة ──────────────────────────────────
      {
        id: "places-neighbourhood",
        type: "symbol",
        source: "protomaps",
        "source-layer": "places",
        minzoom: 12,
        filter: ["any", ["==", ["get", "kind"], "neighbourhood"], ["==", ["get", "kind"], "suburb"]],
        layout: {
          "text-field": ARABIC_TEXT_FIELD,
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "text-letter-spacing": 0.04,
        },
        paint: {
          "text-color": "#7a7a7a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      },
    ],
  };
}
