/*
 * Bargain Quest — Service Worker
 *
 * Strategy:
 *  - Precache the app shell (HTML, all local scripts/styles, icons, p5 CDN) on install
 *    so the game boots offline after the first successful visit.
 *  - Navigation requests: network-first, falling back to the cached index.html
 *    (single-page entry) when offline.
 *  - Same-origin GETs (images, audio, atlas data loaded on demand):
 *    stale-while-revalidate — serve from cache instantly, refresh in the background.
 *  - Cross-origin GETs (the p5 CDN): cache-first with a network fallback.
 *
 * Bump CACHE_VERSION whenever the shipped assets change so clients pick up
 * the new files (the old cache is deleted in `activate`).
 */

const CACHE_VERSION = "v1";
const PRECACHE = `bargain-quest-precache-${CACHE_VERSION}`;
const RUNTIME = `bargain-quest-runtime-${CACHE_VERSION}`;

// App shell. Paths are relative to the service worker scope (repo root).
const PRECACHE_URLS = [
  "./",
  "index.html",
  "manifest.webmanifest",

  // Styles
  "style.css",
  "themes.css",

  // Icons / branding
  "logo.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-192.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "assets/images/bargain quest logo.gif",

  // Third-party runtime (kept in sync with the CDN tag in index.html)
  "https://cdn.jsdelivr.net/npm/p5@1.4.2/lib/p5.js",

  // Utilities & engine
  "utils/miscMap.js",
  "Koz_Engine_Lib/Core/koz-engine.global.js",
  "audioRuntime.js",
  "preload.js",

  // Content & adapters
  "content/itemCatalog.js",
  "content/spacePlanets.js",
  "adapters/cityOwnershipAdapter.js",
  "adapters/bargainQuestSaveAdapter.js",
  "adapters/tutorialSystemAdapter.js",

  // Core classes
  "classes/Boat.js",
  "classes/SpaceTravelSystem.js",
  "classes/BearEmpireSystem.js",
  "classes/player.js",
  "classes/Cities.js",
  "classes/map.js",
  "classes/menuBackground.js",

  // Atlas data
  "assets/atlas/items_atlas.js",
  "assets/atlas/status_atlas.js",
  "assets/atlas/boats_atlas.js",

  // Systems
  "classes/sprites.js",
  "classes/Trader.js",
  "classes/TraderManager.js",
  "classes/Raider.js",
  "classes/RaiderManager.js",
  "classes/Combat.js",
  "classes/ContractSystem.js",
  "classes/GamblingSystem.js",
  "classes/TreasureSystem.js",
  "classes/BankingSystem.js",
  "classes/SmugglingSystem.js",
  "classes/BountyBoard.js",
  "classes/SaveSystem.js",
  "classes/MobileSupport.js",
  "classes/LevelEditor.js",
  "classes/CityUnit.js",
  "classes/CityUnitManager.js",
  "classes/CityWarBattle.js",
  "classes/CityPolicies.js",
  "classes/DiplomacySystem.js",
  "classes/CitySpecialization.js",
  "classes/EspionageSystem.js",
  "classes/CityAdvisors.js",
  "classes/CityManagement.js",

  // Main game & UI
  "game.js",
  "ui.js",
  "ui/mainMenu.js",
  "ui/infoMenu.js",
  "ui/newGameConfig.js",
  "ui/levelEditorToolbar.js",
  "ui/settings.js?v=master-vol",
  "ui/themeEditor.js",
  "ui/cityManagement.js",
  "ui/spaceTravel.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // Add individually so one missing/opaque asset can't fail the whole install.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const request = new Request(url, {
              // p5 CDN needs no-cors so it can be stored as an opaque response.
              mode: url.startsWith("http") ? "no-cors" : "same-origin",
            });
            const response = await fetch(request);
            if (response && (response.ok || response.type === "opaque")) {
              await cache.put(request, response);
            }
          } catch (err) {
            // Non-fatal: asset will be fetched (and runtime-cached) on demand.
            console.warn("[SW] precache skipped:", url, err);
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PRECACHE, RUNTIME]);
      const names = await caches.keys();
      await Promise.all(
        names.map((name) => (keep.has(name) ? null : caches.delete(name)))
      );
      await self.clients.claim();
    })()
  );
});

// Allow the page to trigger an immediate SW takeover after an update.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isHtmlNavigation(request) {
  return (
    request.mode === "navigate" ||
    (request.method === "GET" &&
      request.headers.get("accept") &&
      request.headers.get("accept").includes("text/html"))
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET; let the browser deal with the rest (e.g. POST).
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // 1) Navigations → network-first, fall back to cached shell offline.
  if (isHtmlNavigation(request)) {
    event.respondWith(
      (async () => {
        try {
          const network = await fetch(request);
          const cache = await caches.open(PRECACHE);
          cache.put("index.html", network.clone());
          return network;
        } catch (err) {
          const cache = await caches.open(PRECACHE);
          return (
            (await cache.match("index.html")) ||
            (await cache.match("./")) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  // 2) Cross-origin (p5 CDN) → cache-first.
  if (!sameOrigin) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const network = await fetch(request);
          if (network && (network.ok || network.type === "opaque")) {
            const cache = await caches.open(RUNTIME);
            cache.put(request, network.clone());
          }
          return network;
        } catch (err) {
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // 3) Same-origin assets → stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            caches.open(RUNTIME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => null);
      return cached || (await network) || Response.error();
    })()
  );
});
