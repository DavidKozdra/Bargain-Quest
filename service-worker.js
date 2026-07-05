/*
 * Bargain Quest — Service Worker
 *
 * Strategy:
 *  - Precache the FULL app shell (HTML, every local script/style the page loads,
 *    all engine modules, atlas images, small SFX, icons) on install so the game
 *    boots and is playable offline after the first successful visit.
 *    p5.js is vendored locally (vendor/p5.min.js) so there is no external CDN
 *    dependency at boot time.
 *  - The precache is split into CRITICAL and OPTIONAL sets:
 *      • CRITICAL must all cache successfully or the install REJECTS. This
 *        prevents a broken/partial install silently activating.
 *      • OPTIONAL (heavy music, extra assets) is best-effort — failures there
 *        don't block install; they're fetched and runtime-cached on demand.
 *  - Navigations → network-first (only cache OK responses), falling back to the
 *    cached index.html when offline.
 *  - Same-origin GETs → stale-while-revalidate, with the background cache write
 *    tied to event.waitUntil so the browser doesn't kill it early.
 *  - Cross-origin GETs → cache-first with a network fallback.
 *
 * Bump CACHE_VERSION whenever the shipped assets change so clients pick up the
 * new files (old caches are deleted in `activate`).
 */

const CACHE_VERSION = "v2";
const PRECACHE = `bargain-quest-precache-${CACHE_VERSION}`;
const RUNTIME = `bargain-quest-runtime-${CACHE_VERSION}`;

// ── Critical app shell ────────────────────────────────────────────────────────
// Everything the page loads at boot. If ANY of these fail to cache, the install
// rejects so we never activate a half-cached (and therefore broken-offline) SW.
// Paths are relative to the service worker scope (repo root).
const CRITICAL_URLS = [
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

  // p5.js — vendored locally (kept in sync with the <script> tag in index.html)
  "vendor/p5.min.js",

  // Utilities & engine bridge
  "preload.js",
  "utils/miscMap.js",
  "audioRuntime.js",

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

  // Atlas data (frame layouts)
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
  // NOTE: cached with the exact query string the page requests, so the cache
  // key matches the outgoing request.
  "ui/settings.js?v=master-vol",
  "ui/themeEditor.js",
  "ui/cityManagement.js",
  "ui/spaceTravel.js",

  // Off-main-thread terrain generation (spawned at runtime via new Worker()).
  // Has a synchronous fallback, but precaching keeps map gen fast offline.
  "workers/terrain.worker.js",

  // ── Koz Engine modules (loaded on demand via the engine's XHR/script loader) ──
  "Koz_Engine_Lib/Core/koz-engine.global.js",
  "Koz_Engine_Lib/AI/astar.js",
  "Koz_Engine_Lib/Assets/atlasHelper.js",
  "Koz_Engine_Lib/Audio/musicSystem.js",
  "Koz_Engine_Lib/Audio/soundRegistry.js",
  "Koz_Engine_Lib/Core/gameStateManager.js",
  "Koz_Engine_Lib/Core/spatialGrid.js",
  "Koz_Engine_Lib/Core/uiScreenController.js",
  "Koz_Engine_Lib/Economy/stagedAcquisition.js",
  "Koz_Engine_Lib/Events/eventEngine.js",
  "Koz_Engine_Lib/Events/eventSystem.js",
  "Koz_Engine_Lib/Events/notificationCenter.js",
  "Koz_Engine_Lib/Events/notificationManager.js",
  "Koz_Engine_Lib/Events/tipTracker.js",
  "Koz_Engine_Lib/Items/itemFactory.js",
  "Koz_Engine_Lib/Minigames/manager.js",
  "Koz_Engine_Lib/Minigames/minigamesRuntime.js",
  "Koz_Engine_Lib/SaveLoad/saveApi.js",
  "Koz_Engine_Lib/SaveLoad/schemaRegistry.js",
  "Koz_Engine_Lib/SaveLoad/storageDrivers.js",
  "Koz_Engine_Lib/Time/countdownTimer.js",
  "Koz_Engine_Lib/Time/dayNightCore.js",
  "Koz_Engine_Lib/Time/dayNightCycle.js",
  "Koz_Engine_Lib/UI/mobileInput.js",
  "Koz_Engine_Lib/UI/modalPrimitives.js",
  "Koz_Engine_Lib/UI/tabs.js",
  "Koz_Engine_Lib/UI/uiManager.js",
  "Koz_Engine_Lib/VisualFX/particleSystemCore.js",
  "Koz_Engine_Lib/VisualFX/particleSystem.js",
  "Koz_Engine_Lib/World/dungeonMaze.js",
  "Koz_Engine_Lib/World/seededRng.js",
  "Koz_Engine_Lib/World/worldEditor.js",
  "Koz_Engine_Lib/World/worldGenerators.js",
  "Koz_Engine_Lib/World/worldSpace.js",

  // Atlas bitmaps (needed to render items/boats)
  "assets/atlas/atlas.png",
  "assets/atlas/boats.png",

  // Small sound effects (~0.6 MB total) — cheap to precache, used everywhere
  "assets/audio/sounds/_buy.wav",
  "assets/audio/sounds/clicksound.wav",
  "assets/audio/sounds/rolldice1.wav",
  "assets/audio/sounds/rolldice2.wav",
  "assets/audio/sounds/sell.wav",
  "assets/audio/sounds/fortune3.ogg",
  "assets/audio/sounds/misfortune1.ogg",
];

// ── Optional assets ───────────────────────────────────────────────────────────
// Heavy music (~5.5 MB). Best-effort precache: failures here do NOT block
// install. When played, they're served/cached via stale-while-revalidate, so
// they become available offline after the first listen.
const OPTIONAL_URLS = [
  "assets/audio/SELL_HIGH_BUY_BUY_CITY.m4a",
  "assets/audio/SELL_HIGH_BUY_BUY_Day.m4a",
  "assets/audio/SELL_HIGH_BUY_BUY_Night.m4a",
  "assets/audio/battleattempt1.ogg",
  "assets/audio/themeattempt1.ogg",
];

// Fetch a single same-origin asset and store it. Rejects on any failure so the
// caller (critical install) can decide whether that's fatal.
async function precacheOne(cache, url) {
  const request = new Request(url, { cache: "reload" });
  const response = await fetch(request);
  if (!response || !response.ok) {
    throw new Error(`precache fetch failed for ${url}: ${response && response.status}`);
  }
  await cache.put(request, response);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);

      // CRITICAL: all must succeed or the install rejects (so a broken cache
      // never activates). Promise.all rejects on the first failure.
      await Promise.all(CRITICAL_URLS.map((url) => precacheOne(cache, url)));

      // OPTIONAL: best-effort; swallow individual failures.
      await Promise.all(
        OPTIONAL_URLS.map((url) =>
          precacheOne(cache, url).catch((err) =>
            console.warn("[SW] optional precache skipped:", url, err)
          )
        )
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
          // Only cache successful navigation responses (never a 404/500 page,
          // which would otherwise poison the offline fallback).
          if (network && network.ok) {
            const cache = await caches.open(PRECACHE);
            await cache.put("index.html", network.clone());
          }
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

  // 2) Cross-origin → cache-first (no external deps at boot anymore, but keep
  //    this as a safety net for any incidental cross-origin GET).
  if (!sameOrigin) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const network = await fetch(request);
          if (network && (network.ok || network.type === "opaque")) {
            const cache = await caches.open(RUNTIME);
            await cache.put(request, network.clone());
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

      const networkPromise = fetch(request)
        .then(async (response) => {
          if (response && response.ok) {
            const cache = await caches.open(RUNTIME);
            await cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        // Serve cache immediately, but keep the background refresh alive past
        // the response so the browser doesn't terminate the cache write.
        event.waitUntil(networkPromise);
        return cached;
      }

      return (await networkPromise) || Response.error();
    })()
  );
});
