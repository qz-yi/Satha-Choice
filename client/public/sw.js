/* Satha Service Worker — Persistent tile caching for offline-first map */
/* eslint-disable no-restricted-globals */

const TILE_CACHE = "satha-tiles-v1";
const TILE_HOSTS = ["basemaps.cartocdn.com"];
const MAX_CACHED_TILES = 4000;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("satha-tiles-") && k !== TILE_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

async function trimCache(cache) {
  const requests = await cache.keys();
  if (requests.length <= MAX_CACHED_TILES) return;
  const overflow = requests.length - MAX_CACHED_TILES;
  for (let i = 0; i < overflow; i++) {
    await cache.delete(requests[i]);
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  if (!TILE_HOSTS.some((h) => url.hostname.endsWith(h))) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(TILE_CACHE);
      const cached = await cache.match(req);
      if (cached) {
        return cached;
      }
      try {
        const response = await fetch(req);
        if (response && response.ok) {
          cache.put(req, response.clone()).then(() => trimCache(cache));
        }
        return response;
      } catch (err) {
        return cached || new Response("", { status: 504 });
      }
    })(),
  );
});
