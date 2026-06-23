function _reportRuntimeError(context, errLike) {
  const err = errLike instanceof Error ? errLike : new Error(String(errLike || 'Unknown error'));
  const msg = err.message || String(errLike || 'Unknown error');
  const stack = err.stack || '';
  const payload = {
    when: new Date().toISOString(),
    context: context || 'runtime',
    message: msg,
    stack,
  };
  window._lastRuntimeError = payload;
  console.error(`[${payload.context}] ${payload.message}`, err);
  const text = `\u26A0\uFE0F ${payload.context}: ${payload.message}`;
  if (typeof notificationManager !== 'undefined' && notificationManager && typeof notificationManager.log === 'function') {
    notificationManager.log(text, 'error');
  } else {
    alert(text);
  }
}
window._reportRuntimeError = _reportRuntimeError;

/**
 * Non-blocking trader raid prompt. Builds a DOM overlay and resolves via callback.
 * Replaces the blocking confirm() dialog so the draw loop is not frozen.
 */
function _showTraderRaidPrompt(traderName, targetCity, callback) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:monospace';

  const box = document.createElement('div');
  box.style.cssText = 'background:#1a1a2e;border:2px solid #e8c840;border-radius:8px;padding:24px 28px;max-width:360px;width:90%;color:#f0e6c8;text-align:center';

  const title = document.createElement('p');
  title.style.cssText = 'margin:0 0 10px;font-size:16px;font-weight:bold;color:#e8c840';
  title.textContent = 'Trader Encounter';

  const msg = document.createElement('p');
  msg.style.cssText = 'margin:0 0 20px;font-size:14px;line-height:1.5';
  msg.textContent = `${traderName} is sailing toward ${targetCity}.\n\nRaid this trader boat?`;

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center';

  const raidBtn = document.createElement('button');
  raidBtn.textContent = 'Raid';
  raidBtn.style.cssText = 'padding:8px 22px;background:#c0392b;color:#fff;border:none;border-radius:4px;cursor:pointer;font-family:monospace;font-size:14px';

  const ignoreBtn = document.createElement('button');
  ignoreBtn.textContent = 'Ignore';
  ignoreBtn.style.cssText = 'padding:8px 22px;background:#2c3e50;color:#f0e6c8;border:1px solid #4a5568;border-radius:4px;cursor:pointer;font-family:monospace;font-size:14px';

  const resolve = (doRaid) => {
    document.body.removeChild(overlay);
    callback(doRaid);
  };

  raidBtn.addEventListener('click', () => resolve(true));
  ignoreBtn.addEventListener('click', () => resolve(false));

  btnRow.appendChild(raidBtn);
  btnRow.appendChild(ignoreBtn);
  box.appendChild(title);
  box.appendChild(msg);
  box.appendChild(btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  ignoreBtn.focus();
}

// Global error handlers to notify player of critical errors (sync + async)
window.addEventListener('error', function(event) {
  const file = event.filename ? ` @ ${event.filename}${event.lineno ? ':' + event.lineno : ''}` : '';
  _reportRuntimeError(`window.error${file}`, event.error || event.message || 'Unknown error');
});
window.addEventListener('unhandledrejection', function(event) {
  _reportRuntimeError('window.unhandledrejection', event.reason || 'Unhandled promise rejection');
});
// Game.js — 2D Top-down pixel art version

let cols = 50, rows = 50, tileSize = 32;
let grid = [], elevationMap = [], difficultyMap = [], temperatureMap = [];
let player, dayNight, cities;
const CYCLEVALUE = 120; // 120 seconds (2 minutes) per day cycle

// New game settings (used by config UI)
window._newGameMapCols = 150;
window._newGameMapRows = 150;
window._newGameEventChance = 0.10;
window._newGameRaiderInterval = 60;
window._newGameLandmass = 1;
window._newGameWorldGen = {
  warp: 1.0,
  ruggedness: 1.0,
  temperatureVariance: 1.0,
  moistureVariance: 1.0,
  coastalDropoff: 1.0,
};
window._newGameCustomMap = null;
window._isCustomMap = false;
window._newGameSeed = null;
window._newGameGoldTarget = 5000;
window._newGameDayLimit = 0;
window._newGameDifficulty = 'normal';

// Active difficulty config — set when starting/loading a game
window.DIFFICULTY_CONFIG = null;

/**
 * Returns a multiplier/settings object for the given difficulty key.
 * All game systems read from window.DIFFICULTY_CONFIG instead of hardcoded numbers.
 */
function getDifficultyConfig(key) {
  const configs = {
    easy: {
      label: 'Easy',
      icon: '\uD83C\uDF40',
      atlasFrame: 'Easy',
      combatLossGoldPercent: [0.02, 0.08],   // lose 2-8% gold on combat loss
      combatLossItemCount: [0, 1],            // lose 0-1 items
      raiderHpMultiplier: 0.7,                // enemies have 70% HP
      dayScalingSpeed: 0.5,                   // enemy scaling ramps half as fast
      fleeChanceBonus: 0.15,                  // +15% flee success
      taxRate: 0.03,                          // 3% weekly tax
      starvationPenaltyMult: 0.5,             // half starvation gold penalty
      hpRegenMultiplier: 1.5,                 // 50% faster HP regen
      bribeCostMultiplier: 0.7,               // bribes cost 30% less
      hullDamageMultiplier: 0.6,              // naval hull damage reduced
      tradeSellMultiplier: 1.10,              // sell goods for 10% more
      tradeBuyMultiplier: 0.95,               // buy goods for 5% less
      memoryMatchMaxFlips: 22,                // more chances in memory minigame
      permadeath: false,
    },
    normal: {
      label: 'Normal',
      icon: '\uD83E\uDDED',
      atlasFrame: 'Medium',
      combatLossGoldPercent: [0.10, 0.30],    // lose 10-30% gold
      combatLossItemCount: [1, 2],            // lose 1-2 items
      raiderHpMultiplier: 1.0,
      dayScalingSpeed: 1.0,
      fleeChanceBonus: 0,
      taxRate: 0.05,
      starvationPenaltyMult: 1.0,
      hpRegenMultiplier: 1.0,
      bribeCostMultiplier: 1.0,
      hullDamageMultiplier: 1.0,
      tradeSellMultiplier: 1.0,               // baseline trade margins
      tradeBuyMultiplier: 1.0,
      memoryMatchMaxFlips: 18,                // baseline memory chances
      permadeath: false,
    },
    hard: {
      label: 'Hard',
      icon: '\u2694\uFE0F',
      atlasFrame: 'Hard',
      combatLossGoldPercent: [0.25, 0.50],    // lose 25-50% gold
      combatLossItemCount: [2, 4],            // lose 2-4 items
      raiderHpMultiplier: 1.4,                // enemies have 140% HP
      dayScalingSpeed: 1.5,                   // enemy scaling ramps 50% faster
      fleeChanceBonus: -0.10,                 // -10% flee success
      taxRate: 0.08,                          // 8% weekly tax
      starvationPenaltyMult: 1.5,             // 50% more starvation penalty
      hpRegenMultiplier: 0.7,                 // 30% slower HP regen
      bribeCostMultiplier: 1.3,               // bribes cost 30% more
      hullDamageMultiplier: 1.4,              // more hull damage
      tradeSellMultiplier: 0.88,              // sell goods for 12% less (squeezed margins)
      tradeBuyMultiplier: 1.12,               // buy goods for 12% more
      memoryMatchMaxFlips: 14,                // fewer chances in memory minigame
      permadeath: false,
    },
    hardcore: {
      label: 'Hardcore',
      icon: '\u2620\uFE0F',
      atlasFrame: 'Hardcore',
      combatLossGoldPercent: [0.35, 0.60],    // lose 35-60% gold
      combatLossItemCount: [3, 5],            // lose 3-5 items
      raiderHpMultiplier: 1.6,                // enemies have 160% HP
      dayScalingSpeed: 2.0,                   // enemy scaling ramps 2x faster
      fleeChanceBonus: -0.15,                 // -15% flee success
      taxRate: 0.10,                          // 10% weekly tax
      starvationPenaltyMult: 2.0,             // double starvation penalty
      hpRegenMultiplier: 0.5,                 // half HP regen
      bribeCostMultiplier: 1.5,               // bribes cost 50% more
      hullDamageMultiplier: 1.6,              // brutal hull damage
      tradeSellMultiplier: 0.75,              // sell goods for 25% less (brutal margins)
      tradeBuyMultiplier: 1.25,               // buy goods for 25% more
      memoryMatchMaxFlips: 12,                // very few chances in memory minigame
      permadeath: true,                       // death deletes save
    },
  };
  return configs[key] || configs.normal;
}

// Camera (2D viewport)
let camX = 0, camY = 0;
let camZoom = 1;
let targetCamX = 0, targetCamY = 0;
const CAM_LERP = 0.1;

// Camera shake state (pixel offsets applied additively)
let camShakeX = 0, camShakeY = 0;
let camShakeTime = 0; // ms remaining
let camShakeMag = 0;  // current magnitude

function startCameraShake(magnitude = 6, durationMs = 300) {
  camShakeMag = Math.max(camShakeMag, magnitude);
  camShakeTime = Math.max(camShakeTime, durationMs);
}

// ===================== VIEWPORT CULLING HELPERS =====================

/** Margin (in pixels) beyond screen edges to still count as "visible" */
const _VP_MARGIN = 64;

/**
 * Cached viewport bounds in world-pixel space — updated once per frame by
 * _updateViewportBounds() before any entity iteration. Avoids repeating
 * the same divisions N times per frame (once per entity).
 */
let _vpMinX = 0, _vpMaxX = 0, _vpMinY = 0, _vpMaxY = 0;

/** Recompute viewport bounds. Call once per frame after camX/camY are updated. */
function _updateViewportBounds() {
  const halfW = (width / 2 + _VP_MARGIN) / camZoom;
  const halfH = (height / 2 + _VP_MARGIN) / camZoom;
  _vpMinX = camX - halfW;
  _vpMaxX = camX + halfW;
  _vpMinY = camY - halfH;
  _vpMaxY = camY + halfH;
}

/**
 * Returns true if a world-pixel position is within (or near) the visible viewport.
 * Call *inside* the translated push/pop block where 0,0 = world origin.
 * @param {number} wx  world-pixel X
 * @param {number} wy  world-pixel Y
 */
function isOnScreen(wx, wy) {
  return wx >= _vpMinX && wx <= _vpMaxX && wy >= _vpMinY && wy <= _vpMaxY;
}

/**
 * Returns true if an axis-aligned rectangle overlaps the viewport.
 * Useful for chunk/region culling.
 */
function isRectOnScreen(minX, minY, maxX, maxY) {
  return maxX >= _vpMinX && minX <= _vpMaxX && maxY >= _vpMinY && minY <= _vpMaxY;
}

/**
 * Render only cities that are currently visible in the viewport.
 * Falls back to manual world-space culling if cityGrid is unavailable.
 */
function renderVisibleCities() {
  if (typeof cityGrid !== 'undefined' && cityGrid) {
    for (const city of cityGrid.queryViewport()) city.render(tileSize);
    return;
  }
  for (const city of cities) {
    if (!city || !city.location) continue;
    const wx = city.location.x * tileSize + tileSize / 2;
    const wy = city.location.y * tileSize + tileSize / 2;
    if (isOnScreen(wx, wy)) city.render(tileSize);
  }
}

/**
 * Resolve raid outcomes for player-owned cities using local raider queries.
 * This avoids repeated full-list scans when many cities are owned.
 */
function _tickOwnedCityRaiderDefense(ownedCities) {
  if (!ownedCities || ownedCities.length === 0 || !raiderManager || !_isSpawnGraceExpired()) return;

  for (const ownedCity of ownedCities) {
    if (!ownedCity || !ownedCity.location) continue;
    const wallLevel = ownedCity.management?.upgradeLevels?.walls || 0;
    const hasWeaponShop = !!ownedCity.hasWeaponShop;
    const defenseDist = 3 + wallLevel;
    const defenseChance = Math.min(0.95, wallLevel * 0.25 + (hasWeaponShop ? 0.15 : 0));
    const myLoc = ownedCity.location;
    const nearbyRaiders = (typeof raiderManager.getRaidersInRect === 'function')
      ? raiderManager.getRaidersInRect(
          myLoc.x - defenseDist,
          myLoc.x + defenseDist,
          myLoc.y - defenseDist,
          myLoc.y + defenseDist
        )
      : (raiderManager.raiders || []);
    if (!nearbyRaiders || nearbyRaiders.length === 0) continue;

    for (const raider of nearbyRaiders) {
      if (!raider || raider.state === 'defeated') continue;
      const dx = Math.abs(raider.x - myLoc.x);
      const dy = Math.abs(raider.y - myLoc.y);
      if (dx > defenseDist || dy > defenseDist) continue;

      if (defenseChance > 0 && Math.random() < defenseChance) {
        raider.state = 'defeated';
        if (typeof notificationManager !== 'undefined') {
          const reason = wallLevel > 0 ? 'City walls' : 'City militia';
          notificationManager.log(`${reason} of ${ownedCity.name} repelled a raider!`, 'success');
        }
      } else {
        raider.state = 'defeated';
        const popLoss = Math.max(1, Math.floor((raider.strength || 1) * 2));
        const goldLoss = Math.max(10, Math.floor((raider.strength || 1) * 15));
        ownedCity.population = Math.max(1, (ownedCity.population || 10) - popLoss);
        if (ownedCity.management) {
          ownedCity.management.budget = Math.max(0, (ownedCity.management.budget || 0) - goldLoss);
        }
        ownedCity.reputation = Math.max(0, (ownedCity.reputation || 50) - 3);
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log(
            `\u2694\uFE0F Raiders attacked ${ownedCity.name}! Lost ${popLoss} citizens and ${goldLoss} gold.` +
            (wallLevel === 0 ? ' Build walls to improve defense!' : ''),
            'warning'
          );
        }
      }
    }
  }
}

/**
 * Distance (in tiles) between an entity and the player.
 */
function tileDistToPlayer(ex, ey) {
  return Math.abs(ex - player.x) + Math.abs(ey - player.y);
}

/** Tile-distance threshold — entities beyond this get throttled updates */
let AI_ACTIVE_RADIUS = 80;
/** Entities beyond this radius only update every Nth frame */
let AI_SLEEP_SKIP = 8;
/**
 * Tile-distance threshold — traveling traders beyond this radius switch to
 * abstract simulation: no A* pathfinding, teleported to their destination on
 * the day tick that their estimated travel time expires.  Economy still runs.
 */
const AI_ABSTRACT_RADIUS = 150;

// ===================== LOADING OVERLAY =====================

function showLoadingOverlay(message = 'Loading...') {
  try {
    if (window.BQStartupShell && typeof window.BQStartupShell.hide === 'function') {
      window.BQStartupShell.hide();
    }
  } catch (_err) {}
  let overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.innerHTML = `
      <div class="loading-content">
        <img
          class="loading-logo"
          src="./assets/images/bargain quest logo.gif"
          alt="Bargain Quest logo"
        >
        <div class="loading-spinner"></div>
        <div class="loading-title" id="loadingTitle">Generating World</div>
        <div class="loading-message" id="loadingMessage">${message}</div>
        <div class="loading-bar-track">
          <div class="loading-bar-fill" id="loadingBarFill"></div>
        </div>
        <div class="loading-percent" id="loadingPercent">0%</div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
  document.getElementById('loadingMessage').textContent = message;
  document.getElementById('loadingBarFill').style.width = '0%';
  document.getElementById('loadingPercent').textContent = '0%';
}

function updateLoadingOverlay(message, progress) {
  const msg = document.getElementById('loadingMessage');
  const bar = document.getElementById('loadingBarFill');
  const pct = document.getElementById('loadingPercent');
  if (msg) msg.textContent = message;
  if (typeof progress === 'number') {
    const clamped = Math.min(100, Math.round(progress));
    if (bar) bar.style.width = clamped + '%';
    if (pct) pct.textContent = clamped + '%';
  }
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

/**
 * Yield to the browser so it can repaint the loading overlay.
 * Uses double-rAF to guarantee the style changes are flushed and painted.
 */
function yieldFrame() {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

const GameStates = {
  MAIN_MENU: "mainMenu",
  INFO: "infoMenu",
  NEW_GAME_CONFIG: "newGameConfig",
  CREDITS: "credits",
  PLAYING: "playing",
  INVENTORY: "inventory",
  PAUSED: "paused",
  SETTINGS: "settings",
  GAMELOSE: "lose",
  GAMEWON: "won",
  COMBAT: "combat",
  RANDOM_EVENT: "randomEvent",
  WEEKLY_SUMMARY: "weeklySummary",
  LEVEL_EDITOR: "levelEditor",
  // --- New system states ---
  MINIGAME: "minigame",
  GAMBLING: "gambling",
  CONTRACT_BOARD: "contractBoard",
  BANK: "bank",
  BOUNTY_BOARD: "bountyBoard",
  BLACK_MARKET: "blackMarket",
  TREASURE_MAP: "treasureMap",
  CITY_MANAGE: "cityManage",
  PLANET_SURFACE: "planetSurface",
  SPACE: "space",
};

window._cityViewOpen = false;

const ENGINE_MODULES = Object.freeze({
  ASTAR: "Koz_Engine_Lib/AI/astar.js",
  ATLAS_HELPER: "Koz_Engine_Lib/Assets/atlasHelper.js",
  SEEDED_RNG: "Koz_Engine_Lib/World/seededRng.js",
  WORLD_SPACE: "Koz_Engine_Lib/World/worldSpace.js",
  WORLD_EDITOR: "Koz_Engine_Lib/World/worldEditor.js",
  WORLD_GENERATORS: "Koz_Engine_Lib/World/worldGenerators.js",
  GAME_STATE_MANAGER: "Koz_Engine_Lib/Core/gameStateManager.js",
  SPATIAL_GRID: "Koz_Engine_Lib/Core/spatialGrid.js",
  SAVE_DRIVERS: "Koz_Engine_Lib/SaveLoad/storageDrivers.js",
  SAVE_API: "Koz_Engine_Lib/SaveLoad/saveApi.js",
  DAY_NIGHT_CYCLE: "Koz_Engine_Lib/Time/dayNightCycle.js",
  EVENT_SYSTEM: "Koz_Engine_Lib/Events/eventSystem.js",
  NOTIFICATION_MANAGER: "Koz_Engine_Lib/Events/notificationManager.js",
  UI_TABS: "Koz_Engine_Lib/UI/tabs.js",
  UI_MANAGER: "Koz_Engine_Lib/UI/uiManager.js",
  STAGED_ACQUISITION: "Koz_Engine_Lib/Economy/stagedAcquisition.js",
  ITEM_FACTORY: "Koz_Engine_Lib/Items/itemFactory.js",
  MINIGAMES_RUNTIME: "Koz_Engine_Lib/Minigames/minigamesRuntime.js",
  PARTICLE_SYSTEM: "Koz_Engine_Lib/VisualFX/particleSystem.js",
});

function _ensureEngineModules(modulePaths) {
  if (typeof window !== 'undefined' && typeof window.BQEnsureEngineModules === 'function') {
    return window.BQEnsureEngineModules(modulePaths);
  }
  return [];
}

function _ensureGameplayEngineModules() {
  return _ensureEngineModules([
    ENGINE_MODULES.ASTAR,
    ENGINE_MODULES.SEEDED_RNG,
    ENGINE_MODULES.DAY_NIGHT_CYCLE,
    ENGINE_MODULES.EVENT_SYSTEM,
    ENGINE_MODULES.NOTIFICATION_MANAGER,
    ENGINE_MODULES.STAGED_ACQUISITION,
    ENGINE_MODULES.ITEM_FACTORY,
    ENGINE_MODULES.MINIGAMES_RUNTIME,
    ENGINE_MODULES.PARTICLE_SYSTEM,
  ]);
}

function _ensureEditorEngineModules() {
  return _ensureEngineModules([
    ENGINE_MODULES.WORLD_SPACE,
    ENGINE_MODULES.WORLD_EDITOR,
    ENGINE_MODULES.WORLD_GENERATORS,
  ]);
}

function _setStartupShellStage(message) {
  try {
    if (window.BQStartupShell && typeof window.BQStartupShell.setStage === 'function') {
      window.BQStartupShell.setStage(message);
    }
  } catch (_err) {}
}

function _hideStartupShellSoon() {
  if (window._startupShellHideQueued) return;
  window._startupShellHideQueued = true;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          if (window.BQStartupShell && typeof window.BQStartupShell.hide === 'function') {
            window.BQStartupShell.hide();
          }
        } catch (_err) {}
      });
    });
  });
}

async function _prepareAudioRuntime() {
  if (typeof sound === "undefined" || !sound) return [];

  const plan = Array.isArray(window.BQ_AUDIO_TRACK_PLAN) ? window.BQ_AUDIO_TRACK_PLAN : [];
  if (plan.length && typeof sound.planTracks === "function") {
    _setStartupShellStage("Planning audio tracks...");
    sound.planTracks(plan);
  }

  if (typeof sound.bindUnlockHandlers === "function") {
    sound.bindUnlockHandlers();
  }

  const preloadPromise = window.BQAudioPreload && typeof window.BQAudioPreload.getPromise === "function"
    ? window.BQAudioPreload.getPromise()
    : (typeof sound.preloadRegisteredTracks === "function" ? sound.preloadRegisteredTracks(plan) : Promise.resolve([]));

  if (!preloadPromise || typeof preloadPromise.then !== "function") return [];

  _setStartupShellStage("Preloading music...");
  const results = await preloadPromise;
  if (Array.isArray(results)) {
    results
      .filter((entry) => entry && entry.status === "rejected")
      .forEach((entry) => {
        const detail = entry.reason instanceof Error ? entry.reason.message : String(entry.reason || "Unknown audio preload error");
        console.warn(`[audio] Failed to preload ${entry.id || entry.path || "track"}: ${detail}`);
      });
  }
  return Array.isArray(results) ? results : [];
}

const OPTIONAL_UI_SCREEN_SCRIPTS = Object.freeze({
  newGameConfig: 'ui/newGameConfig.js',
  settingsMenu: 'ui/settings.js',
  infoMenu: 'ui/infoMenu.js',
  levelEditorToolbar: 'ui/levelEditorToolbar.js',
});

const _optionalUiScriptPromises = new Map();

function _loadOptionalScriptOnce(src) {
  if (!src || typeof document === 'undefined') return Promise.resolve();
  if (_optionalUiScriptPromises.has(src)) return _optionalUiScriptPromises.get(src);
  if (document.querySelector(`script[data-bq-optional-script="${src}"]`)) {
    return Promise.resolve();
  }

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.bqOptionalScript = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load optional script: ${src}`));
    (document.body || document.head || document.documentElement).appendChild(script);
  }).finally(() => {
    _optionalUiScriptPromises.delete(src);
  });

  _optionalUiScriptPromises.set(src, promise);
  return promise;
}

function _ensureOptionalUIScreen(screenName) {
  const src = OPTIONAL_UI_SCREEN_SCRIPTS[screenName];
  if (!src) return Promise.resolve();
  if (uiManager?.screens?.[screenName]?.initialized || uiManager?.screens?.[screenName]?.create) {
    return Promise.resolve();
  }
  return _loadOptionalScriptOnce(src);
}

function _resolveConstructor(candidates, label) {
  for (const candidate of candidates) {
    if (typeof candidate === 'function') return candidate;
  }
  throw new Error(`Missing constructor for ${label}`);
}

function _createGameStateManager() {
  _ensureEngineModules([ENGINE_MODULES.GAME_STATE_MANAGER]);
  const Ctor = _resolveConstructor([
    window.KozEngine?.Core?.gameStateManager?.GameStateManager,
    window.GameStateManager,
  ], 'GameStateManager');
  return new Ctor();
}

function _createUIManager() {
  _ensureEngineModules([ENGINE_MODULES.UI_MANAGER]);
  const Ctor = _resolveConstructor([
    window.KozEngine?.UI?.uiManager?.UIManager,
    window.UIManager,
  ], 'UIManager');
  return new Ctor();
}

function _createDayNightCycle(cycleValue) {
  _ensureEngineModules([ENGINE_MODULES.DAY_NIGHT_CYCLE]);
  const Ctor = _resolveConstructor([
    window.KozEngine?.Time?.dayNightCycle?.DayNightCycle,
    window.DayNightCycle,
  ], 'DayNightCycle');
  return new Ctor(cycleValue);
}

function _createNotificationManager() {
  _ensureEngineModules([ENGINE_MODULES.NOTIFICATION_MANAGER]);
  const Ctor = _resolveConstructor([
    window.KozEngine?.Events?.notificationManager?.NotificationManager,
    window.NotificationManager,
  ], 'NotificationManager');
  return new Ctor();
}

function _createMinigameManager() {
  _ensureEngineModules([ENGINE_MODULES.MINIGAMES_RUNTIME]);
  const Ctor = _resolveConstructor([
    window.KozEngine?.Minigames?.runtime?.MinigameManager,
    window.MinigameManager,
    window.KozEngine?.Minigames?.manager?.MinigameManager,
  ], 'MinigameManager');
  return new Ctor();
}

function _hasRuntimeMinigameApi(manager) {
  return !!manager
    && typeof manager.launch === 'function'
    && Object.prototype.hasOwnProperty.call(manager, 'active');
}

function _ensureRuntimeMinigameManager(manager) {
  if (_hasRuntimeMinigameApi(manager)) return manager;
  return _createMinigameManager();
}

function _createTutorialSystem() {
  const Ctor = _resolveConstructor([
    window.BQAdapters?.tutorialSystem?.TutorialSystem,
    window.TutorialSystem,
  ], 'TutorialSystem');
  return new Ctor();
}

function _createEventSystem() {
  _ensureEngineModules([ENGINE_MODULES.EVENT_SYSTEM]);
  const Ctor = _resolveConstructor([
    window.KozEngine?.Events?.eventSystem?.EventSystem,
    window.EventSystem,
  ], 'EventSystem');
  return new Ctor();
}

function _createSpatialGrid(cellSize) {
  _ensureEngineModules([ENGINE_MODULES.SPATIAL_GRID]);
  const Ctor = _resolveConstructor([
    window.KozEngine?.Core?.spatialGrid?.SpatialGrid,
    window.SpatialGrid,
  ], 'SpatialGrid');
  return new Ctor(cellSize);
}

function _ensureSpatialGridsReady() {
  if (!cityGrid) cityGrid = _createSpatialGrid(32);
  if (!traderGrid) traderGrid = _createSpatialGrid(32);
  if (!raiderGrid) raiderGrid = _createSpatialGrid(32);
}

let gameStateManager = null;
// Tracks where Pause should return (more reliable than gameStateManager.prev through Settings hops)
window._pauseReturnState = GameStates.PLAYING;
function _createDeferredUIManager() {
  return {
    screens: {},
    activeScreens: new Set(),
    currentState: null,
    _queuedRegistrations: [],
    registerScreen(name, spec) {
      this._queuedRegistrations.push({ name, spec });
      this.screens[name] = this.screens[name] || {
        show() {},
        hide() {},
        update() {},
      };
    },
    _cancelFade() {},
    scheduleFadeHide() {},
    onGameStateChange(newState) {
      this.currentState = newState;
    },
    hideAll() {},
    hideScreen() {},
    showScreen() {},
    updateAll() {},
  };
}

let uiManager = _createDeferredUIManager();
let _engineRuntimeReady = false;
let _gameBootstrapComplete = false;
let _engineBootstrapError = null;

function _getEngineBridgeReady() {
  const ready = window.BQKozEngineReady;
  return ready && typeof ready.then === 'function' ? ready : Promise.resolve();
}

function _initializeEngineRuntime() {
  if (_engineRuntimeReady) return;
  const deferredUIManager = uiManager;
  gameStateManager = _createGameStateManager();
  uiManager = _createUIManager();
  if (deferredUIManager && Array.isArray(deferredUIManager._queuedRegistrations)) {
    for (const entry of deferredUIManager._queuedRegistrations) {
      if (!entry || !entry.name || !entry.spec) continue;
      uiManager.registerScreen(entry.name, entry.spec);
    }
  }
  _engineRuntimeReady = true;
}

const namePool = NameGenerator.generateNames();
var notificationManager;
var traderManager;
var raiderManager;
var combatSystem;
var eventSystem;
var worldInitialized = false;
var _spawnGraceUntil = 0; // in-game ms timestamp — immune to raiders until this time

function _getCurrentGameTimeMs() {
  if (!dayNight) return 0;
  const cycleSeconds = (typeof dayNight.dayCycleLength === 'number' && dayNight.dayCycleLength > 0)
    ? dayNight.dayCycleLength
    : (typeof CYCLEVALUE === 'number' && CYCLEVALUE > 0 ? CYCLEVALUE : 120);
  const dayMs = cycleSeconds * 1000;
  const daysElapsed = (typeof dayNight.daysElapsed === 'number') ? dayNight.daysElapsed : 0;
  const timeOfDay = (typeof dayNight.timeOfDay === 'number') ? dayNight.timeOfDay : 0;
  const dayFraction = Math.max(0, Math.min(1, timeOfDay / (Math.PI * 2)));
  return (daysElapsed * dayMs) + (dayFraction * dayMs);
}

function _resetSpawnGracePeriod() {
  const configured = Number(window._newGameGracePeriod);
  const graceSeconds = (!Number.isNaN(configured) && configured >= 0) ? configured : 30;
  _spawnGraceUntil = _getCurrentGameTimeMs() + graceSeconds * 1000;
}

function _isSpawnGraceExpired() {
  return _getCurrentGameTimeMs() >= _spawnGraceUntil;
}

// ---- New economy / meta systems ----
var minigameManager;
var contractSystem;
var gamblingSystem;
var treasureSystem;
var bankingSystem;
var smugglingSystem;
var bountyBoard;
var tutorialSystem;
var cityManagement;
var questSystem;
var achievementSystem;
var bearEmpireSystem;

function _createCityManagementController() {
  if (typeof CityManagement === 'undefined') return null;
  return new CityManagement(window, {
    notificationManager,
    gameStateManager,
    GameStates,
    dayNight,
    minigameManager,
    raiderManager,
  });
}

function _syncBearEmpireGlobals() {
  if (typeof window === 'undefined') return;
  window.bearEmpireSystem = bearEmpireSystem || null;
  window.BQGetBearEmpireSystem = () => bearEmpireSystem || null;
  window.BQGetBearEmpireState = () => (
    bearEmpireSystem && typeof bearEmpireSystem.getState === 'function'
      ? bearEmpireSystem.getState()
      : null
  );
}

function _createBearEmpireSystem(savedData = null) {
  if (typeof BearEmpireSystem === 'undefined') {
    bearEmpireSystem = null;
    _syncBearEmpireGlobals();
    return null;
  }

  if (bearEmpireSystem && typeof bearEmpireSystem.destroy === 'function') {
    bearEmpireSystem.destroy();
  }

  const options = {
    seed: (typeof window !== 'undefined' && Number.isFinite(Number(window._mapSeed)))
      ? Number(window._mapSeed)
      : 0,
    playerGetter: () => player,
    citiesGetter: () => (Array.isArray(cities) ? cities : []),
    notificationGetter: () => notificationManager,
  };
  bearEmpireSystem = (
    savedData && typeof BearEmpireSystem.fromJSON === 'function'
      ? BearEmpireSystem.fromJSON(savedData, options)
      : new BearEmpireSystem(options)
  );
  if (bearEmpireSystem && typeof bearEmpireSystem.evaluateActivation === 'function') {
    bearEmpireSystem.evaluateActivation();
  }
  _syncBearEmpireGlobals();
  return bearEmpireSystem;
}

function _enterRestoredGameplayState(targetState, options = {}) {
  if (typeof gameStateManager === 'undefined' || !targetState) {
    return { ok: false, reason: 'state_manager_unavailable', targetState };
  }

  const currentState = gameStateManager.getState ? gameStateManager.getState() : gameStateManager.currentState;
  if (currentState === targetState) return { ok: true, alreadyInState: true, state: targetState };

  const bridgeState = options.bridgeState || GameStates.PLAYING;
  const needsBridge = currentState == null
    || currentState === GameStates.MAIN_MENU
    || currentState === GameStates.NEW_GAME_CONFIG
    || currentState === GameStates.INFO
    || currentState === GameStates.CREDITS;

  if (needsBridge && targetState !== bridgeState && currentState !== bridgeState) {
    gameStateManager.setState(bridgeState);
    if (!(gameStateManager.is?.(bridgeState) || gameStateManager.currentState === bridgeState)) {
      return { ok: false, reason: 'bridge_failed', from: currentState, bridgeState, current: gameStateManager.currentState };
    }
  }

  gameStateManager.setState(targetState);
  if (!(gameStateManager.is?.(targetState) || gameStateManager.currentState === targetState)) {
    return { ok: false, reason: 'state_transition_failed', from: currentState, targetState, current: gameStateManager.currentState };
  }

  return { ok: true, state: targetState };
}

function _enterSpaceState() {
  if (typeof gameStateManager === 'undefined' || !GameStates?.SPACE) {
    return { ok: false, reason: 'state_manager_unavailable' };
  }

  const currentState = gameStateManager.getState ? gameStateManager.getState() : gameStateManager.currentState;
  if (currentState === GameStates.SPACE) return { ok: true, alreadyInSpace: true };

  const hasPlayableRun = !!(worldInitialized && typeof player !== 'undefined' && player);
  if (!hasPlayableRun) {
    return { ok: false, reason: 'world_not_ready' };
  }

  if (!_isSurfaceGameplayState(currentState) && currentState !== GameStates.CITY_MANAGE) {
    const staged = _enterRestoredGameplayState(GameStates.PLAYING, { bridgeState: GameStates.PLAYING });
    if (!staged.ok) {
      return { ok: false, reason: 'staging_failed', from: currentState, current: gameStateManager.currentState, detail: staged };
    }
  }

  const entered = _enterRestoredGameplayState(GameStates.SPACE, { bridgeState: GameStates.PLAYING });
  if (!entered.ok) {
    return { ok: false, reason: 'space_transition_failed', from: currentState, current: gameStateManager.currentState, detail: entered };
  }
  return { ok: true };
}

function _findSpaceCityByName(cityName) {
  if (!cityName || !Array.isArray(cities)) return null;
  return cities.find((city) => city?.name === cityName) || null;
}

function _ensurePlayerSpaceTravelSystem() {
  if (typeof player === 'undefined' || !player || typeof SpaceTravelSystem === 'undefined') return null;

  if (!player._spaceTravelSystem) {
    const savedTravelState = player.spaceTravel?.travelSystemState;
    if (savedTravelState && typeof SpaceTravelSystem.fromJSON === 'function') {
      player._spaceTravelSystem = SpaceTravelSystem.fromJSON(savedTravelState, _findSpaceCityByName);
    }
  }
  if (!player._spaceTravelSystem) {
    player._spaceTravelSystem = new SpaceTravelSystem();
  }

  if (typeof player.getActiveSpaceShip === 'function') {
    const activeShip = player.getActiveSpaceShip();
    if (activeShip) player._spaceTravelSystem.activeShip = activeShip;
  }

  if (!player._spaceTravelSystem.launchCity) {
    player._spaceTravelSystem.launchCity = window._spaceLaunchCity || _findSpaceCityByName(player.spaceTravel?.lastLaunchCity || null);
  }

  window._spaceTravelSystem = player._spaceTravelSystem;
  if (player._spaceTravelSystem.launchCity) {
    window._spaceLaunchCity = player._spaceTravelSystem.launchCity;
  }
  return player._spaceTravelSystem;
}

function _restoreGroundedLaunchState(sys) {
  if (!sys) return;
  sys.phase = SpaceTravelPhase.GROUNDED;
  sys.currentNode = null;
  sys.targetNode = null;
  sys.currentBodyKey = null;
  sys.routeProgress = 0;
  sys.launchProgress = 0;
  sys.surfaceState = null;
  sys.systemState = null;
}

function _repairPlanetSurfaceLiftOffState(session, sys = null) {
  if (!_isPlanetSurfaceSession(session) || typeof SpaceTravelSystem === 'undefined') return sys;
  const context = session?.spaceContext || {};
  const nodeKey = (typeof context.nodeKey === 'string' && context.nodeKey) ? context.nodeKey : 'orbit';
  const bodyKey = (typeof context.bodyKey === 'string' && context.bodyKey) ? context.bodyKey : null;
  if (!bodyKey) return sys;

  const data = (sys && typeof sys.toJSON === 'function') ? sys.toJSON() : {};
  if (!data.graphSeed && Number.isFinite(Number(context.graphSeed))) {
    data.graphSeed = Number(context.graphSeed);
  }
  const activeShip = sys?.activeShip || (typeof player?.getActiveSpaceShip === 'function' ? player.getActiveSpaceShip() : null);
  if (!data.activeShip && activeShip && typeof activeShip.toJSON === 'function') {
    data.activeShip = activeShip.toJSON();
  }
  data.phase = SpaceTravelPhase.LANDED;
  data.currentNode = nodeKey;
  data.targetNode = null;
  data.currentBodyKey = bodyKey;
  data.routeProgress = 0;
  data.routeDistance = 0;
  data.launchProgress = 1;
  data.launchDestination = nodeKey;
  data.systemState = null;
  data.surfaceState = null;
  if (!data.launchCityName && typeof context.landingCityName === 'string') {
    data.launchCityName = context.landingCityName;
  }

  const repaired = SpaceTravelSystem.fromJSON(data, _findSpaceCityByName);
  if (player) player._spaceTravelSystem = repaired;
  if (typeof window !== 'undefined') window._spaceTravelSystem = repaired;
  return repaired;
}

function _launchToSpaceFromCity(city, opts = {}) {
  if (typeof gameStateManager === 'undefined' || !GameStates?.SPACE) {
    return { ok: false, reason: 'state_manager_unavailable' };
  }
  if (!worldInitialized || typeof player === 'undefined' || !player) {
    return { ok: false, reason: 'world_not_ready' };
  }
  if (!city) return { ok: false, reason: 'missing_city' };
  if (typeof player.ownsCity === 'function' && !player.ownsCity(city)) {
    return { ok: false, reason: 'not_owned' };
  }

  const destination = (typeof opts.destination === 'string' && opts.destination) ? opts.destination : 'orbit';
  const returnState = opts.returnState || _getPlayableReturnState();
  const sys = _ensurePlayerSpaceTravelSystem();
  if (!sys) return { ok: false, reason: 'space_unavailable' };

  window._spaceLaunchCity = city;
  window._spaceLaunchPlanet = null;
  window._spaceReturnState = returnState;
  window._forceSpaceMapOpenOnce = false;
  window._spaceMapOpen = false;
  window._spaceHudCollapsed = false;
  sys.launchCity = city;

  if (sys.phase === SpaceTravelPhase.GROUNDED) {
    const ship = sys.activeShip || (typeof player.getActiveSpaceShip === 'function' ? player.getActiveSpaceShip() : null);
    if (!ship) return { ok: false, reason: 'no_ship' };
    if (ship.condition <= 0) return { ok: false, reason: 'ship_destroyed' };
    if (typeof player.hasSpaceAccess === 'function' && !player.hasSpaceAccess(city)) {
      return { ok: false, reason: 'space_locked' };
    }
    if (typeof window !== 'undefined') window._spaceSelectedNode = destination;
  }

  const enter = _enterSpaceState();
  if (!enter.ok) return enter;
  if (player) {
    player.currentCity = null;
    player.currentTileCity = null;
  }
  if (typeof window !== 'undefined') {
    window._cityViewOpen = false;
  }
  return { ok: true, state: gameStateManager.currentState, phase: sys.phase, destination: sys.launchDestination || destination };
}

if (typeof window !== 'undefined') {
  window.BQEnterSpaceState = _enterSpaceState;
  window.BQLaunchToSpaceFromCity = _launchToSpaceFromCity;
}

function _resolveSpaceConflictHazard(hazard) {
  if (!hazard || hazard.type !== 'bear_blockade') return;

  const root = (typeof window !== 'undefined') ? window : globalThis;
  const sys = root?._spaceTravelSystem || player?._spaceTravelSystem || null;
  const ship = sys?.activeShip || (typeof player?.getActiveSpaceShip === 'function' ? player.getActiveSpaceShip() : null);
  if (!ship) return;

  const applyPenalty = (score = 0) => {
    const resolvedScore = Math.max(0, Math.min(100, Math.floor(Number(score) || 0)));
    const passScore = Math.max(0, Math.floor(Number(hazard?.qte?.passScore) || 64));
    let damage = Number(hazard.damage) || 0;
    let rating = 'failed';

    if (resolvedScore >= Math.max(90, passScore + 18)) {
      damage = 0;
      rating = 'perfect';
    } else if (resolvedScore >= passScore + 8) {
      damage = Math.max(0, Math.round(damage * 0.25));
      rating = 'clean';
    } else if (resolvedScore >= passScore) {
      damage = Math.max(0, Math.round(damage * 0.5));
      rating = 'pass';
    } else if (resolvedScore >= Math.max(35, passScore - 12)) {
      damage = Math.max(0, Math.round(damage * 0.8));
      rating = 'rough';
    }

    if (damage > 0) ship.applyDamage(damage);

    if (bearEmpireSystem && typeof bearEmpireSystem.recordBlockadeRun === 'function') {
      bearEmpireSystem.recordBlockadeRun(hazard.nodeKey, resolvedScore);
    }

    if (typeof notificationManager !== 'undefined') {
      if (rating === 'perfect') {
        notificationManager.log(`You broke the blockade around ${hazard.nodeKey} cleanly. No losses taken.`, 'success');
      } else if (rating === 'clean' || rating === 'pass') {
        const parts = [];
        if (damage > 0) parts.push(`-${damage}% hull`);
        notificationManager.log(
          `Blockade breached near ${hazard.nodeKey}${parts.length ? ` with minor losses: ${parts.join(' · ')}` : '.'}`,
          'success'
        );
      } else {
        const parts = [];
        if (damage > 0) parts.push(`-${damage}% hull`);
        notificationManager.log(
          `Bear blockade hit your ship near ${hazard.nodeKey}${parts.length ? `: ${parts.join(' · ')}` : '.'}`,
          resolvedScore >= 35 ? 'warning' : 'error'
        );
      }
    }

    if (typeof window._refreshSpaceUI === 'function') {
      window._refreshSpaceUI();
    }
  };

  if (typeof root?.BQRunSpaceRouteQTE === 'function') {
    root.BQRunSpaceRouteQTE(hazard, (qteResult) => {
      applyPenalty(qteResult?.score);
    });
  } else {
    applyPenalty(0);
  }
}

function _applyEncounterEffect(effect, encounterCtx) {
  if (!effect) return;
  const root = (typeof window !== 'undefined') ? window : globalThis;
  const sys = root?._spaceTravelSystem || player?._spaceTravelSystem || null;
  const ship = sys?.activeShip || null;
  const factionId = encounterCtx?.factionId || null;

  if (typeof effect.goldGain === 'number' && effect.goldGain > 0) {
    if (typeof player?.earnGold === 'function') player.earnGold(effect.goldGain);
    else if (typeof player !== 'undefined') player.gold = (player.gold || 0) + effect.goldGain;
  }
  if (typeof effect.goldCost === 'number' && effect.goldCost > 0) {
    if (typeof player?.spendGold === 'function') player.spendGold(effect.goldCost);
    else if (typeof player !== 'undefined') player.gold = Math.max(0, (player.gold || 0) - effect.goldCost);
  }
  if (effect.loot && effect.lootQty) {
    const trapRoll = typeof effect.trapChance === 'number' ? Math.random() : -1;
    const trapped = trapRoll >= 0 && trapRoll < effect.trapChance;
    if (!trapped) {
      for (let i = 0; i < Math.max(1, Number(effect.lootQty) || 1); i++) {
        if (typeof player?.addItem === 'function') player.addItem({ name: effect.loot });
      }
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Received ${effect.lootQty}x ${effect.loot}.`, 'success');
      }
    } else if (typeof notificationManager !== 'undefined') {
      notificationManager.log('It was a trap! The cargo bay was booby-trapped.', 'error');
    }
  }
  if (ship && typeof effect.hpRisk === 'number' && effect.hpRisk > 0) {
    if (Math.random() < 0.5) ship.applyDamage(effect.hpRisk);
  }
  if (ship && typeof effect.healHP === 'number' && effect.healHP > 0) {
    ship.condition = Math.min(100, (ship.condition || 0) + effect.healHP);
  }
  if (typeof effect.factionRep === 'number' && factionId && sys && typeof sys.modifyFactionRep === 'function') {
    sys.modifyFactionRep(factionId, effect.factionRep);
  }
  if (typeof window._refreshSpaceUI === 'function') window._refreshSpaceUI();
}

function _showSpaceEncounterChoice(encounterCtx) {
  if (!encounterCtx?.encounter) return;
  const enc = encounterCtx.encounter;
  if (window._spaceRouteQTEActive) return;
  window._spaceRouteQTEActive = true;

  const overlay = document.createElement('div');
  overlay.id = 'space-encounter-overlay';
  overlay.style.cssText = [
    'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9500',
    'background:rgba(0,0,10,0.82);display:flex;align-items:center;justify-content:center',
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'background:#0d1320;border:1px solid #3a5a8a;border-radius:10px',
    'padding:28px 32px;max-width:440px;width:90%;color:#cce0ff;font-family:monospace',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = enc.name;
  title.style.cssText = 'font-size:1.18em;font-weight:bold;color:#7ecfff;margin-bottom:10px;letter-spacing:0.04em';
  card.appendChild(title);

  const desc = document.createElement('div');
  desc.textContent = enc.description;
  desc.style.cssText = 'font-size:0.93em;line-height:1.5;margin-bottom:20px;color:#a8c8e8';
  card.appendChild(desc);

  const choices = Array.isArray(enc.choices) ? enc.choices : [];
  choices.forEach((choice) => {
    const btn = document.createElement('button');
    btn.textContent = choice.text;
    btn.style.cssText = [
      'display:block;width:100%;padding:10px 14px;margin-bottom:10px',
      'background:#162040;border:1px solid #3a5a8a;border-radius:6px',
      'color:#cce0ff;font-family:monospace;font-size:0.88em;cursor:pointer;text-align:left',
    ].join(';');
    btn.addEventListener('mouseenter', () => { btn.style.background = '#1e3060'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#162040'; });
    btn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      window._spaceRouteQTEActive = false;
      _applyEncounterEffect(choice.effect, encounterCtx);
    });
    card.appendChild(btn);
  });

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function _runSpaceOperationalQTE(config, onDone) {
  if (typeof onDone !== 'function') return;
  const root = (typeof window !== 'undefined') ? window : globalThis;
  if (config && typeof root?.BQRunSpaceRouteQTE === 'function') {
    root.BQRunSpaceRouteQTE(config, onDone);
    return;
  }
  onDone({ score: 70, skipped: true });
}

// ===================== KEY BINDINGS =====================
const KEY_DEFAULTS = {
  moveUp:     { label: "Move Up",      keys: [87, 38],  display: "W / Up" },       // W, Up Arrow
  moveDown:   { label: "Move Down",    keys: [83, 40],  display: "S / Down" },      // S, Down Arrow
  moveLeft:   { label: "Move Left",    keys: [65, 37],  display: "A / Left" },      // A, Left Arrow
  moveRight:  { label: "Move Right",   keys: [68, 39],  display: "D / Right" },     // D, Right Arrow
  speedUp:    { label: "Speed Up",     keys: [69],      display: "E" },             // E
  speedDown:  { label: "Speed Down",   keys: [81],      display: "Q" },             // Q
  zoomIn:     { label: "Zoom In",      keys: [88, 187], display: "X / +" },         // X, +/=
  zoomOut:    { label: "Zoom Out",     keys: [90, 189], display: "Z / -" },         // Z, -
  zoomReset:  { label: "Zoom Reset",   keys: [82],      display: "R" },             // R
  inventory:  { label: "Inventory",    keys: [73],      display: "I" },             // I
  pause:      { label: "Pause / Menu", keys: [27],      display: "Esc" },           // Escape
  editorUndo: { label: "Editor Undo",  keys: [90],      display: "Ctrl+Z" },     // Z (use with Ctrl)
  editorFlood:{ label: "Flood Fill",   keys: [70],      display: "F" },           // F
  cityManageToggle: { label: "City Manage Toggle", keys: [77], display: "M" },
};

// Runtime keybinding map — deep copy from defaults, can be overwritten
var keyBindings = {};
const _heldKeyCodes = new Set();

function _normalizeKeyBinding(action, binding) {
  const fallback = { ...KEY_DEFAULTS[action], keys: [...KEY_DEFAULTS[action].keys] };
  if (!binding || typeof binding !== 'object') return fallback;

  const sourceKeys = Array.isArray(binding.keys) ? binding.keys : [];
  const keys = sourceKeys
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  return {
    ...fallback,
    ...binding,
    keys: keys.length > 0 ? keys : fallback.keys,
  };
}

function _normalizeKeyBindingsMap(bindings) {
  const normalized = {};
  for (const action in KEY_DEFAULTS) {
    normalized[action] = _normalizeKeyBinding(action, bindings?.[action]);
  }
  return normalized;
}

function _initKeyBindings() {
  // Load from localStorage or use defaults
  const saved = localStorage.getItem("keyBindings");
  if (saved) {
    try {
      keyBindings = _normalizeKeyBindingsMap(JSON.parse(saved));
    } catch (e) {
      keyBindings = _cloneDefaults();
    }
  } else {
    keyBindings = _cloneDefaults();
  }
}

function _cloneDefaults() {
  return _normalizeKeyBindingsMap(null);
}

function saveKeyBindings() {
  keyBindings = _normalizeKeyBindingsMap(keyBindings);
  localStorage.setItem("keyBindings", JSON.stringify(keyBindings));
}

function resetKeyBindings() {
  keyBindings = _cloneDefaults();
  saveKeyBindings();
}

/** Check if a keyCode is bound to an action */
function isActionKey(action, kCode) {
  const b = keyBindings[action];
  if (!b || !Array.isArray(b.keys)) return false;
  const wanted = Number(kCode);
  return b.keys.some((keyCodeValue) => Number(keyCodeValue) === wanted);
}

/** Check if an action key is currently held (for movement) */
function isActionDown(action) {
  const b = keyBindings[action];
  if (!b || !Array.isArray(b.keys)) return false;
  for (const k of b.keys) {
    const keyCodeValue = Number(k);
    if (Number.isFinite(keyCodeValue) && _heldKeyCodes.has(keyCodeValue)) return true;
  }
  return false;
}

function _isTextEntryFocused() {
  const ae = document && document.activeElement;
  if (!ae) return false;
  const tag = (ae.tagName || '').toUpperCase();
  const style = (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function')
    ? window.getComputedStyle(ae)
    : null;
  if (ae.disabled) return false;
  if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  if (typeof ae.getClientRects === 'function' && ae.getClientRects().length === 0) return false;
  if (ae.isContentEditable) return true;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const t = String(ae.type || 'text').toLowerCase();
    // Treat textual/searchable inputs as typing contexts.
    return !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file'].includes(t);
  }
  return false;
}

function _trackHeldKeyDown(event) {
  const code = Number(event?.keyCode || event?.which);
  if (Number.isFinite(code)) _heldKeyCodes.add(code);
}

function _trackHeldKeyUp(event) {
  const code = Number(event?.keyCode || event?.which);
  if (Number.isFinite(code)) _heldKeyCodes.delete(code);
}

function _clearHeldKeys() {
  _heldKeyCodes.clear();
}

function _isKeyHeld(code) {
  const keyCodeValue = Number(code);
  return Number.isFinite(keyCodeValue) && _heldKeyCodes.has(keyCodeValue);
}

/** Get display string for an action's current keys */
function getActionDisplay(action) {
  const b = keyBindings[action];
  if (!b || b.keys.length === 0) return "Unbound";
  return b.keys.map(k => _keyCodeToName(k)).join(" / ");
}

function _keyCodeToName(code) {
  const map = {
    8:'Backspace', 9:'Tab', 13:'Enter', 16:'Shift', 17:'Ctrl', 18:'Alt',
    19:'Pause', 20:'CapsLock', 27:'Esc', 32:'Space', 33:'PgUp', 34:'PgDn',
    35:'End', 36:'Home', 37:'Left', 38:'Up', 39:'Right', 40:'Down',
    45:'Insert', 46:'Delete', 91:'Meta',
    112:'F1', 113:'F2', 114:'F3', 115:'F4', 116:'F5', 117:'F6',
    118:'F7', 119:'F8', 120:'F9', 121:'F10', 122:'F11', 123:'F12',
    186:';', 187:'=', 188:',', 189:'-', 190:'.', 191:'/', 192:'`',
    219:'[', 220:'\\', 221:']', 222:"'",
  };
  if (map[code]) return map[code];
  if (code >= 65 && code <= 90) return String.fromCharCode(code);
  if (code >= 48 && code <= 57) return String.fromCharCode(code);
  if (code >= 96 && code <= 105) return 'Num' + (code - 96);
  return `Key${code}`;
}

// Initialize bindings immediately
_initKeyBindings();
window.addEventListener('keydown', _trackHeldKeyDown);
window.addEventListener('keyup', _trackHeldKeyUp);
window.addEventListener('blur', _clearHeldKeys);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) _clearHeldKeys();
});

// Hotkey: toggle City Management panel with 'M' when in CITY_MANAGE
window.addEventListener('keydown', (e) => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey) return;
  const code = e.keyCode || e.which;
  if (isActionKey('cityManageToggle', code)) {
    if (gameStateManager && gameStateManager.currentState === GameStates.CITY_MANAGE) {
      const panelEl = document.getElementById('cityMgmtPanel');
      const isHidden = !panelEl || panelEl.style.display === 'none';
      if (isHidden) {
        if (uiManager && typeof uiManager.showScreen === 'function') uiManager.showScreen('cityMgmtPanel');
        else {
          const s = uiManager.screens['cityMgmtPanel'];
          if (s && !s.initialized) { s.container = s.create(); s.initialized = true; }
          if (s) { s.container.show(); s.show(); }
        }
      } else {
        if (uiManager && typeof uiManager.hideScreen === 'function') uiManager.hideScreen('cityMgmtPanel');
      }
    }
  }
});

// Game speed multiplier (1 = normal)
var gameSpeed = 1;
const SPEED_STEPS = [0, 0.25, 0.5, 1, 2, 4, 8];
let gameSpeedIndex = 3; // index into SPEED_STEPS (default = 1x)

/** Single source of truth for updating the HUD speed label */
function syncSpeedDisplay() {
  const lbl = document.getElementById("speedLabel");
  if (lbl) {
    if (gameSpeed === 0) {
      lbl.textContent = "⏸";
      lbl.style.color = '#FF5722';
    } else if (gameSpeed === 1) {
      lbl.textContent = '1\u00d7';
      lbl.style.color = '#aaa';
    } else {
      lbl.textContent = `${gameSpeed}\u00d7`;
      lbl.style.color = gameSpeed > 1 ? '#4CAF50' : '#FF9800';
    }
  }
}

// Movement cooldown
let moveTimer = 0;
const moveDelay = 120; // ms between moves

// Mobile touch-drag state — used to distinguish a tap (move) from a drag (pan)
// Use displacement from touch start (not cumulative jitter) so taps remain reliable.
const _touchPanThresholdPx = 28;
let _touchStartX = 0, _touchStartY = 0;
let _touchIsDragging = false;
let _pendingMoveX = -1, _pendingMoveY = -1, _pendingMoveSail = false;

// Minimap
let minimapGraphics;

// Global list of port city locations for A* land↔water gating
var portCityLocations = [];

// Spatial lookup: "x,y" -> city object for O(1) city-at-tile checks
var cityLocationMap = new Map();

const BQ_WORLD_SESSION_KEYS = Object.freeze({
  HOMEWORLD: 'homeworld',
});
if (typeof window !== 'undefined') window.BQ_WORLD_SESSION_KEYS = BQ_WORLD_SESSION_KEYS;

var _worldSessions = new Map();
var _activeWorldSessionKey = null;

// ===================== SPATIAL GRIDS =====================
// Three separate SpatialGrid instances — one per entity type.
// Cell size = 32 tiles so a typical 1080p viewport spans ~2-3 cells,
// making queryViewport() return only the small visible subset.
var cityGrid   = null;
var traderGrid = null;
var raiderGrid = null;

/**
 * Calibrate AI throttle constants based on actual map size and entity count.
 * Call after traders + raiders are initialised so we have accurate counts.
 * AI_ACTIVE_RADIUS and AI_SLEEP_SKIP are declared `let` in game.js so this
 * overwrites the defaults when scaling up to large maps.
 */
function _tuneAIForMapSize() {
  const mapMin = Math.min(cols, rows);
  // Active radius: ~7% of the shorter map dimension, clamped [80, 200]
  AI_ACTIVE_RADIUS = Math.max(80, Math.min(200, Math.floor(mapMin * 0.07)));

  // Sleep-skip: grow with √(trader count / 10) so frame load stays flat
  const traderCount = traderManager ? traderManager.traders.length : 0;
  const raiderCount = raiderManager ? raiderManager.raiders.length  : 0;
  const entityCount = traderCount + raiderCount;
  AI_SLEEP_SKIP = Math.max(8, Math.min(32, Math.floor(Math.sqrt(entityCount / 10))));
  _applyAIPrefs(); // apply any player overrides on top of auto-tuned values
}

/** Apply player-configured AI preference overrides from localStorage */
function _applyAIPrefs() {
  const r  = parseInt(localStorage.getItem('pref_ai_radius'));
  const s  = parseInt(localStorage.getItem('pref_ai_skip'));
  const sp = parseFloat(localStorage.getItem('pref_spawn_rate'));
  if (r >= 40  && r <= 200) AI_ACTIVE_RADIUS = r;
  if (s >= 4   && s <= 32 ) AI_SLEEP_SKIP    = s;
  window.TRADER_SPAWN_RATE = (sp >= 0.5 && sp <= 2.0) ? sp : 1.0;
}

function _isCityTile(x, y) {
  const key = `${x},${y}`;
  if (cityLocationMap && typeof cityLocationMap.has === 'function') {
    return cityLocationMap.has(key);
  }
  if (Array.isArray(cities)) {
    return cities.some((city) => city?.location?.x === x && city?.location?.y === y);
  }
  return false;
}

function _shouldNotifyTraderTravel() {
  try {
    return localStorage.getItem('pref_notify_trader_travel') === 'true';
  } catch (_err) {
    return false;
  }
}
if (typeof window !== 'undefined') window.BQShouldNotifyTraderTravel = _shouldNotifyTraderTravel;

function _normalizeWorldSessionKey(sessionKey) {
  return (typeof sessionKey === 'string' && sessionKey.trim())
    ? sessionKey.trim()
    : BQ_WORLD_SESSION_KEYS.HOMEWORLD;
}

function _cloneWorldPoint(pointLike) {
  const x = Math.floor(Number(pointLike?.x));
  const y = Math.floor(Number(pointLike?.y));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function _serializeWorldSystems() {
  return {
    traderManager: (typeof traderManager !== 'undefined' && traderManager && typeof traderManager.toJSON === 'function')
      ? traderManager.toJSON()
      : null,
    raiderManager: (typeof raiderManager !== 'undefined' && raiderManager && typeof raiderManager.toJSON === 'function')
      ? raiderManager.toJSON()
      : null,
    eventSystem: (typeof eventSystem !== 'undefined' && eventSystem && typeof eventSystem.toJSON === 'function')
      ? eventSystem.toJSON()
      : null,
    contractSystem: (typeof contractSystem !== 'undefined' && contractSystem && typeof contractSystem.toJSON === 'function')
      ? contractSystem.toJSON()
      : null,
    treasureSystem: (typeof treasureSystem !== 'undefined' && treasureSystem && typeof treasureSystem.toJSON === 'function')
      ? treasureSystem.toJSON()
      : null,
  };
}

function _destroyWorldSystemInstance(instance) {
  if (instance && typeof instance.destroy === 'function') {
    try { instance.destroy(); } catch (err) { console.warn('[world-session] destroy failed:', err); }
  }
}

function _destroyLiveWorldSystems() {
  if (typeof traderManager !== 'undefined') _destroyWorldSystemInstance(traderManager);
  if (typeof raiderManager !== 'undefined') _destroyWorldSystemInstance(raiderManager);
  if (typeof eventSystem !== 'undefined') _destroyWorldSystemInstance(eventSystem);
  if (typeof contractSystem !== 'undefined') _destroyWorldSystemInstance(contractSystem);

  traderManager = null;
  raiderManager = null;
  eventSystem = null;
  contractSystem = null;
  treasureSystem = null;
}

function _restoreWorldSystemsFromSnapshot(systemSnapshots = null) {
  const snapshots = (systemSnapshots && typeof systemSnapshots === 'object') ? systemSnapshots : {};

  traderManager = (snapshots.traderManager && typeof TraderManager !== 'undefined' && typeof TraderManager.fromJSON === 'function')
    ? TraderManager.fromJSON(snapshots.traderManager)
    : null;
  raiderManager = (snapshots.raiderManager && typeof RaiderManager !== 'undefined' && typeof RaiderManager.fromJSON === 'function')
    ? RaiderManager.fromJSON(snapshots.raiderManager)
    : null;

  if (snapshots.eventSystem) {
    const root = (typeof window !== 'undefined') ? window : globalThis;
    const EventCtor = root?.KozEngine?.Events?.eventSystem?.EventSystem || root?.EventSystem || null;
    eventSystem = (EventCtor && typeof EventCtor.fromJSON === 'function')
      ? EventCtor.fromJSON(snapshots.eventSystem)
      : _createEventSystem();
  } else {
    eventSystem = null;
  }

  contractSystem = (snapshots.contractSystem && typeof ContractSystem !== 'undefined' && typeof ContractSystem.fromJSON === 'function')
    ? ContractSystem.fromJSON(snapshots.contractSystem)
    : null;
  treasureSystem = (snapshots.treasureSystem && typeof TreasureSystem !== 'undefined' && typeof TreasureSystem.fromJSON === 'function')
    ? TreasureSystem.fromJSON(snapshots.treasureSystem)
    : null;
}

function _snapshotCurrentWorldSession(sessionKey = BQ_WORLD_SESSION_KEYS.HOMEWORLD, meta = {}) {
  const key = _normalizeWorldSessionKey(sessionKey);
  const rawWorldGen = (meta.worldGenConfig && typeof meta.worldGenConfig === 'object')
    ? meta.worldGenConfig
    : ((typeof window !== 'undefined' && window._newGameWorldGen && typeof window._newGameWorldGen === 'object')
      ? window._newGameWorldGen
      : null);
  return {
    key,
    label: (typeof meta.label === 'string' && meta.label.trim())
      ? meta.label.trim()
      : (key === BQ_WORLD_SESSION_KEYS.HOMEWORLD ? 'Earth' : key),
    cols,
    rows,
    grid,
    elevationMap,
    difficultyMap,
    temperatureMap,
    cities: Array.isArray(cities) ? cities : [],
    portCityLocations: Array.isArray(portCityLocations) ? portCityLocations : [],
    sessionType: (typeof meta.sessionType === 'string' && meta.sessionType.trim())
      ? meta.sessionType.trim()
      : 'adventure_world',
    spaceContext: (meta.spaceContext && typeof meta.spaceContext === 'object')
      ? { ...meta.spaceContext }
      : null,
    systemSnapshots: _serializeWorldSystems(),
    mapSeed: (typeof window !== 'undefined' && Number.isFinite(Number(window._mapSeed)))
      ? Number(window._mapSeed)
      : 0,
    isCustomMap: !!(typeof window !== 'undefined' && window._isCustomMap),
    landmass: (typeof meta.landmass === 'number')
      ? meta.landmass
      : ((typeof window !== 'undefined' && typeof window._newGameLandmass === 'number') ? window._newGameLandmass : 1),
    worldGenConfig: rawWorldGen
      ? {
          warp: Number(rawWorldGen.warp),
          ruggedness: Number(rawWorldGen.ruggedness),
          temperatureVariance: Number(rawWorldGen.temperatureVariance),
          moistureVariance: Number(rawWorldGen.moistureVariance),
          coastalDropoff: Number(rawWorldGen.coastalDropoff),
        }
      : null,
    playerPosition: _cloneWorldPoint(player),
  };
}

function _refreshStoredWorldSessionRuntime(session) {
  if (!session || typeof session !== 'object') return;
  session.playerPosition = _cloneWorldPoint(player);
  const snapshots = _serializeWorldSystems();
  const hasLiveRuntime = Object.values(snapshots).some((value) => value != null);
  if (hasLiveRuntime || !session.systemSnapshots) {
    session.systemSnapshots = snapshots;
  }
}

function _rememberActiveWorldSessionPosition() {
  if (!_activeWorldSessionKey || !player) return;
  const activeSession = _worldSessions.get(_activeWorldSessionKey);
  if (activeSession) _refreshStoredWorldSessionRuntime(activeSession);
}

function resetWorldSessions() {
  _destroyLiveWorldSystems();
  _worldSessions.clear();
  _activeWorldSessionKey = null;
  if (typeof window !== 'undefined') window._bqActiveWorldSessionKey = null;
}
if (typeof window !== 'undefined') window.BQResetWorldSessions = resetWorldSessions;

function registerCurrentWorldSession(sessionKey = BQ_WORLD_SESSION_KEYS.HOMEWORLD, meta = {}) {
  const snapshot = _snapshotCurrentWorldSession(sessionKey, meta);
  _worldSessions.set(snapshot.key, snapshot);
  _activeWorldSessionKey = snapshot.key;
  if (typeof window !== 'undefined') window._bqActiveWorldSessionKey = snapshot.key;
  return snapshot;
}
if (typeof window !== 'undefined') window.BQRegisterCurrentWorldSession = registerCurrentWorldSession;

function getWorldSession(sessionKey = null) {
  if (sessionKey == null) {
    return _activeWorldSessionKey ? (_worldSessions.get(_activeWorldSessionKey) || null) : null;
  }
  return _worldSessions.get(_normalizeWorldSessionKey(sessionKey)) || null;
}
if (typeof window !== 'undefined') window.BQGetWorldSession = getWorldSession;

function exportWorldSessions() {
  _rememberActiveWorldSessionPosition();
  if (_worldSessions.size === 0 && Array.isArray(grid) && grid.length > 0) {
    const fallbackKey = _activeWorldSessionKey || BQ_WORLD_SESSION_KEYS.HOMEWORLD;
    return [_snapshotCurrentWorldSession(fallbackKey, { label: fallbackKey === BQ_WORLD_SESSION_KEYS.HOMEWORLD ? 'Earth' : fallbackKey })];
  }
  return Array.from(_worldSessions.values());
}
if (typeof window !== 'undefined') window.BQExportWorldSessions = exportWorldSessions;

function restoreWorldSessionsFromSave(savedSessions = [], activeSessionKey = null) {
  const restored = Array.isArray(savedSessions) ? savedSessions.filter((session) => session && typeof session === 'object') : [];
  const requestedKey = (typeof activeSessionKey === 'string' && activeSessionKey.trim())
    ? _normalizeWorldSessionKey(activeSessionKey)
    : BQ_WORLD_SESSION_KEYS.HOMEWORLD;
  const activeSavedSession = restored.find((session) => _normalizeWorldSessionKey(session.key) === requestedKey) || null;

  _worldSessions.clear();

  const liveSession = _snapshotCurrentWorldSession(requestedKey, {
    label: activeSavedSession?.label || (requestedKey === BQ_WORLD_SESSION_KEYS.HOMEWORLD ? 'Earth' : requestedKey),
    sessionType: activeSavedSession?.sessionType || 'adventure_world',
    spaceContext: activeSavedSession?.spaceContext || null,
    landmass: activeSavedSession?.landmass,
    worldGenConfig: activeSavedSession?.worldGenConfig || null,
  });

  if (activeSavedSession) {
    liveSession.mapSeed = Number.isFinite(Number(activeSavedSession.mapSeed)) ? Number(activeSavedSession.mapSeed) : liveSession.mapSeed;
    liveSession.isCustomMap = !!activeSavedSession.isCustomMap;
    liveSession.playerPosition = _cloneWorldPoint(player) || activeSavedSession.playerPosition || null;
  }

  _worldSessions.set(liveSession.key, liveSession);
  for (const session of restored) {
    const key = _normalizeWorldSessionKey(session.key);
    if (key === liveSession.key) continue;
    _worldSessions.set(key, { ...session, key });
  }

  _activeWorldSessionKey = liveSession.key;
  if (typeof window !== 'undefined') window._bqActiveWorldSessionKey = _activeWorldSessionKey;
  return liveSession;
}
if (typeof window !== 'undefined') window.BQRestoreWorldSessionsFromSave = restoreWorldSessionsFromSave;

function suspendActiveWorldSessionRuntime() {
  _rememberActiveWorldSessionPosition();
  _destroyLiveWorldSystems();
}
if (typeof window !== 'undefined') window.BQSuspendActiveWorldSessionRuntime = suspendActiveWorldSessionRuntime;

function activateWorldSession(sessionOrKey, options = {}) {
  const session = (typeof sessionOrKey === 'string')
    ? getWorldSession(sessionOrKey)
    : sessionOrKey;
  if (!session || !Array.isArray(session.grid) || !Array.isArray(session.cities)) {
    return { ok: false, reason: 'session_unavailable' };
  }

  _rememberActiveWorldSessionPosition();
  _destroyLiveWorldSystems();

  if (session.key) _worldSessions.set(session.key, session);

  cols = Number.isFinite(Number(session.cols))
    ? Number(session.cols)
    : (Array.isArray(session.grid?.[0]) ? session.grid[0].length : cols);
  rows = Number.isFinite(Number(session.rows))
    ? Number(session.rows)
    : (Array.isArray(session.grid) ? session.grid.length : rows);
  grid = session.grid;
  elevationMap = Array.isArray(session.elevationMap) ? session.elevationMap : [];
  difficultyMap = Array.isArray(session.difficultyMap) ? session.difficultyMap : [];
  temperatureMap = Array.isArray(session.temperatureMap) ? session.temperatureMap : [];
  cities = session.cities;
  portCityLocations = Array.isArray(session.portCityLocations) ? session.portCityLocations : [];

  if (typeof window !== 'undefined' && Number.isFinite(Number(session.mapSeed))) {
    window._mapSeed = Number(session.mapSeed);
  }
  if (typeof window !== 'undefined') window._isCustomMap = !!session.isCustomMap;

  if (player) {
    player.grid = grid;
    const requestedPos = _cloneWorldPoint(options.playerPosition);
    const sessionPos = _cloneWorldPoint(session.playerPosition);
    const nextPos = requestedPos
      || (!options.preservePlayerPosition ? sessionPos : null);
    if (nextPos) {
      player.x = Math.max(0, Math.min(cols - 1, nextPos.x));
      player.y = Math.max(0, Math.min(rows - 1, nextPos.y));
      player.path = [];
      player.pathMoveTimer = 0;
    }
    session.playerPosition = _cloneWorldPoint(player);
  }

  buildCityLocationMap();
  if (_isPlanetSurfaceSession(session) && session?.spaceContext?.landingCityName) {
    const landingCity = _getLandingCityForSession(session);
    if (landingCity) {
      const landingWorld = {
        grid,
        elevationMap,
        difficultyMap,
        temperatureMap,
        cols,
        rows,
      };
      _ensurePlanetWalkableDistrict(landingWorld, null, landingCity.location, 1);
      let safeSpawn = _findSpawnNearLocalCity(grid, cities, landingCity, cols, rows);
      if (!safeSpawn) {
        _ensurePlanetWalkableDistrict(landingWorld, null, landingCity.location, 2);
        safeSpawn = _findSpawnNearLocalCity(grid, cities, landingCity, cols, rows);
      }
      if (player) {
        const onWater = grid?.[player.y]?.[player.x]?.options?.[0] === 'Water';
        const movementBlocked = !_hasSurfaceMovementExit(player.x, player.y);
        if (safeSpawn && (onWater || movementBlocked)) {
          player.x = safeSpawn.x;
          player.y = safeSpawn.y;
          player.path = [];
          player.pathMoveTimer = 0;
        }
        player.currentCity = null;
      }
      session.playerPosition = _cloneWorldPoint(player) || safeSpawn || session.playerPosition;
    }
  }
  _restoreWorldSystemsFromSnapshot(session.systemSnapshots || null);
  if (typeof invalidateMapBuffer === 'function') invalidateMapBuffer();
  if (typeof generateMinimap === 'function') generateMinimap();
  rebuildSpatialGrids();

  if (player) {
    player.currentTileCity = _getCityAtTile(player.x, player.y);
    targetCamX = player.x * tileSize + tileSize / 2;
    targetCamY = player.y * tileSize + tileSize / 2;
    camX = targetCamX;
    camY = targetCamY;
    _updateViewportBounds();
  }

  _activeWorldSessionKey = session.key || _normalizeWorldSessionKey(sessionOrKey);
  if (typeof window !== 'undefined') {
    window._bqActiveWorldSessionKey = _activeWorldSessionKey;
    window.player = player;
    window.cities = cities;
    window.cityLocationMap = cityLocationMap;
  }

  return { ok: true, session };
}
if (typeof window !== 'undefined') window.BQActivateWorldSession = activateWorldSession;

const _PLANET_SESSION_BASE_DIFF = Object.freeze({
  Water: 5,
  Sand: 2,
  Grass: 1,
  Forest: 3,
  Snow: 4,
  Rock: 6,
  Sulfur: 7,
});

const _PLANET_SESSION_DECOR_TABLE = Object.freeze({
  Grass: [['bush', 0.07], ['tree', 0.12]],
  Forest: [['rock', 0.09]],
  Sand: [['pebbles', 0.08]],
  Rock: [['rock', 0.08], ['pebbles', 0.13]],
  Sulfur: [['pebbles', 0.16], ['rock', 0.12]],
  Snow: [['snowdrift', 0.1]],
  Water: [['lily', 0.04], ['seaweed', 0.08]],
});

function _planetWorldSessionKey(nodeKey, bodyKey) {
  return _normalizeWorldSessionKey(`planet:${nodeKey || 'unknown'}:${bodyKey || 'surface'}`);
}

function _hashWorldSessionSeed(text) {
  let hash = 2166136261 >>> 0;
  const source = String(text || '');
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function _isPlanetSurfaceSession(session = getWorldSession()) {
  return !!session && session.sessionType === 'planet_surface';
}
if (typeof window !== 'undefined') window.BQIsPlanetSurfaceSession = _isPlanetSurfaceSession;

function _getSurfaceGameplayState(session = getWorldSession()) {
  return _isPlanetSurfaceSession(session) ? GameStates.PLANET_SURFACE : GameStates.PLAYING;
}
if (typeof window !== 'undefined') window.BQGetSurfaceGameplayState = _getSurfaceGameplayState;

function _isSurfaceGameplayState(state = (gameStateManager?.currentState || null)) {
  return state === GameStates.PLAYING || state === GameStates.PLANET_SURFACE;
}
if (typeof window !== 'undefined') window.BQIsSurfaceGameplayState = _isSurfaceGameplayState;

function _getPlayableReturnState(session = getWorldSession()) {
  return window._isCityManageMode ? GameStates.CITY_MANAGE : _getSurfaceGameplayState(session);
}
if (typeof window !== 'undefined') window.BQGetPlayableReturnState = _getPlayableReturnState;

function _sameWorldPoint(a, b) {
  const ax = Math.floor(Number(a?.x));
  const ay = Math.floor(Number(a?.y));
  const bx = Math.floor(Number(b?.x));
  const by = Math.floor(Number(b?.y));
  return Number.isFinite(ax) && Number.isFinite(ay) && ax === bx && ay === by;
}

function _getLandingCityForSession(session = getWorldSession()) {
  if (!_isPlanetSurfaceSession(session) || !Array.isArray(cities)) return null;
  const targetLocation = session?.spaceContext?.landingCityLocation || null;
  if (targetLocation) {
    const byLocation = cities.find((city) => _sameWorldPoint(city?.location, targetLocation)) || null;
    if (byLocation) return byLocation;
  }
  const targetName = session?.spaceContext?.landingCityName;
  if (typeof targetName === 'string' && targetName) {
    return cities.find((city) => city?.name === targetName) || null;
  }
  return null;
}
if (typeof window !== 'undefined') window.BQGetLandingCityForSession = _getLandingCityForSession;

function _isLandingCityForSession(city, session = getWorldSession()) {
  if (!city || !_isPlanetSurfaceSession(session)) return false;
  const landingCity = _getLandingCityForSession(session);
  if (landingCity) {
    if (landingCity === city) return true;
    if (_sameWorldPoint(landingCity.location, city.location)) return true;
  }
  return _sameWorldPoint(city.location, session?.spaceContext?.landingCityLocation)
    || (typeof session?.spaceContext?.landingCityName === 'string' && city.name === session.spaceContext.landingCityName);
}
if (typeof window !== 'undefined') window.BQIsLandingCityForSession = _isLandingCityForSession;

function _hasSurfaceMovementExit(x, y) {
  const startX = Math.floor(Number(x));
  const startY = Math.floor(Number(y));
  if (!Number.isFinite(startX) || !Number.isFinite(startY) || !Array.isArray(grid)) return false;
  const steps = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];
  for (const step of steps) {
    const nx = startX + step.x;
    const ny = startY + step.y;
    if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
    const tileType = grid?.[ny]?.[nx]?.options?.[0];
    if (tileType && tileType !== 'Water') return true;
  }
  return false;
}
if (typeof window !== 'undefined') window.BQHasSurfaceMovementExit = _hasSurfaceMovementExit;

function _getCityAtTile(x, y) {
  const gridX = Math.floor(Number(x));
  const gridY = Math.floor(Number(y));
  if (!Number.isFinite(gridX) || !Number.isFinite(gridY)) return null;
  if (typeof cityLocationMap !== 'undefined' && cityLocationMap?.size > 0) {
    return cityLocationMap.get(`${gridX},${gridY}`) || null;
  }
  return Array.isArray(cities)
    ? cities.find((city) => city?.location?.x === gridX && city?.location?.y === gridY) || null
    : null;
}
if (typeof window !== 'undefined') window.BQGetCityAtTile = _getCityAtTile;

function _getPlayerTileCity() {
  if (!player) return null;
  if (player.currentTileCity && player.currentTileCity.location?.x === player.x && player.currentTileCity.location?.y === player.y) {
    return player.currentTileCity;
  }
  return _getCityAtTile(player.x, player.y);
}
if (typeof window !== 'undefined') window.BQGetPlayerTileCity = _getPlayerTileCity;

function _isCityViewOpen() {
  return !!window._cityViewOpen;
}
if (typeof window !== 'undefined') window.BQIsCityViewOpen = _isCityViewOpen;

function _openCityView(city = _getPlayerTileCity()) {
  if (!player || !city) return { ok: false, reason: 'no_city' };
  player.currentTileCity = city;
  player.currentCity = city;
  window._cityViewOpen = true;
  if (uiManager && typeof uiManager.showScreen === 'function') {
    uiManager.showScreen('cityView');
  } else if (uiManager?.screens?.cityView && typeof uiManager.screens.cityView.show === 'function') {
    uiManager.screens.cityView.show();
  }
  return { ok: true, city };
}
if (typeof window !== 'undefined') window.BQOpenCityView = _openCityView;

function _closeCityView(options = {}) {
  const { leaveTile = false } = options || {};
  if (leaveTile && player && typeof findNearestSafeTile === 'function') {
    const safe = findNearestSafeTile(player.x, player.y, cities || []);
    if (safe) {
      player.x = safe.x;
      player.y = safe.y;
      player.path = [];
      player.pathMoveTimer = 0;
    }
  }
  if (player) {
    player.currentTileCity = _getCityAtTile(player.x, player.y);
    player.currentCity = null;
  }
  window._cityViewOpen = false;
  select("#travelMapWindow")?.style("display", "none");
  if (uiManager && typeof uiManager.hideScreen === 'function') {
    uiManager.hideScreen('cityView');
  } else if (uiManager?.screens?.cityView && typeof uiManager.screens.cityView.hide === 'function') {
    uiManager.screens.cityView.hide();
  }
  return { ok: true };
}
if (typeof window !== 'undefined') window.BQCloseCityView = _closeCityView;

function _getActiveSpaceSystem() {
  return player?._spaceTravelSystem || window._spaceTravelSystem || null;
}

function _isPlanetSurfaceControlActive() {
  const sys = _getActiveSpaceSystem();
  return !!(sys && sys.phase === 'landed' && _isPlanetSurfaceSession(getWorldSession()));
}

function _withSessionDimensions(tempCols, tempRows, fn) {
  const prevCols = cols;
  const prevRows = rows;
  cols = tempCols;
  rows = tempRows;
  try {
    return fn();
  } finally {
    cols = prevCols;
    rows = prevRows;
  }
}

function _mergePlanetWorldProfile(profile, override) {
  if (!override || typeof override !== 'object') return profile;
  const next = {
    ...profile,
    ...override,
    worldGenConfig: {
      ...(profile.worldGenConfig || {}),
      ...(override.worldGenConfig || {}),
    },
    biomeOverrides: {
      ...(profile.biomeOverrides || {}),
      ...(override.biomeOverrides || {}),
    },
    decorTable: {
      ...(profile.decorTable || {}),
      ...(override.decorTable || {}),
    },
  };
  return next;
}

function _planetHomeworldReferenceSize() {
  const homeSession = getWorldSession(BQ_WORLD_SESSION_KEYS.HOMEWORLD);
  const activeSession = getWorldSession();
  const candidates = [homeSession, activeSession, { cols, rows }];

  for (const candidate of candidates) {
    if (!candidate || candidate.sessionType === 'planet_surface') continue;
    const candidateCols = Math.round(Number(candidate.cols));
    const candidateRows = Math.round(Number(candidate.rows));
    if (candidateCols > 0 && candidateRows > 0) {
      return { cols: candidateCols, rows: candidateRows };
    }
  }

  return { cols: 150, rows: 150 };
}

function _planetWorldSizeFactor(body) {
  if (body?.kind === 'station') return 0.78;
  switch (body?.biome) {
    case 'moon': return 1.14;
    case 'ice': return 1.2;
    case 'hazard': return 1.28;
    case 'volcanic': return 1.34;
    case 'lush': return 1.46;
    case 'garden': return 1.4;
    case 'asteroid': return 1.12;
    case 'jungle': return 1.56;
    default: return 1.26;
  }
}

function _scalePlanetWorldProfileFromHomeworld(profile, nodeKey, body) {
  const root = (typeof window !== 'undefined') ? window : globalThis;
  const externalScaler = root?.BQScaleSpacePlanetWorldProfile;
  if (typeof externalScaler === 'function') {
    const scaledExternal = externalScaler(profile, nodeKey, body);
    if (scaledExternal && typeof scaledExternal === 'object') return scaledExternal;
  }

  if (!profile || typeof profile !== 'object') return profile;

  const authoredCols = Math.max(1, Math.round(Number(profile.cols) || 84));
  const authoredRows = Math.max(1, Math.round(Number(profile.rows) || 84));
  const authoredCityCount = Math.max(1, Math.round(Number(profile.cityCount) || 5));
  const reference = _planetHomeworldReferenceSize();
  const baseFactor = _planetWorldSizeFactor(body);
  const minimumFactor = body?.kind === 'station' ? 0.78 : 1.18;
  const factor = Math.max(minimumFactor, baseFactor);
  const scaledCols = Math.max(
    authoredCols,
    Math.min(3000, Math.round(reference.cols * factor))
  );
  const scaledRows = Math.max(
    authoredRows,
    Math.min(3000, Math.round(reference.rows * factor))
  );
  const geometricScale = Math.sqrt((scaledCols * scaledRows) / Math.max(1, authoredCols * authoredRows));
  const scaledCityCount = Math.max(
    authoredCityCount,
    Math.min(320, Math.round(authoredCityCount * geometricScale * 1.1))
  );

  return {
    ...profile,
    cols: scaledCols,
    rows: scaledRows,
    cityCount: scaledCityCount,
  };
}

function _resolveExternalPlanetWorldProfile(nodeKey, body) {
  const root = (typeof window !== 'undefined') ? window : globalThis;
  const resolver = root?.BQGetSpacePlanetWorldProfile;
  if (typeof resolver !== 'function') return null;
  const resolved = resolver(nodeKey, body);
  return (resolved && typeof resolved === 'object') ? resolved : null;
}

function _planetWorldProfile(nodeKey, body) {
  let profile = {
    cols: 84,
    rows: 84,
    cityCount: 5,
    landmassMode: 1,
    worldGenConfig: {
      warp: 1.0,
      ruggedness: 1.0,
      temperatureVariance: 1.0,
      moistureVariance: 1.0,
      coastalDropoff: 1.0,
    },
    airless: false,
    volatile: false,
    carbonLevel: 35,
    sulfurLevel: 0,
    landingSuffix: 'Port',
    biomeOverrides: {},
    decorTable: _PLANET_SESSION_DECOR_TABLE,
  };

  const externalProfile = _resolveExternalPlanetWorldProfile(nodeKey, body);
  if (externalProfile) {
    profile = _mergePlanetWorldProfile(profile, externalProfile);
  } else if (body?.kind === 'station') {
    profile = _mergePlanetWorldProfile(profile, {
      cols: 64,
      rows: 64,
      cityCount: 4,
      landmassMode: 2,
      airless: true,
      carbonLevel: 12,
      sulfurLevel: 0,
      worldGenConfig: {
        warp: 0.4,
        ruggedness: 1.2,
        temperatureVariance: 0.3,
        moistureVariance: 0.1,
        coastalDropoff: 1.0,
      },
      biomeOverrides: {
        Water: 'Sand',
        Forest: 'Rock',
        Grass: { split: 0.4, low: 'Sand', high: 'Rock' },
        Snow: 'Rock',
      },
    });
  } else if (body?.key === 'grayhold' || body?.key === 'luna-dock' || nodeKey === 'luna') {
    profile = _mergePlanetWorldProfile(profile, {
      cols: 72,
      rows: 72,
      cityCount: 4,
      landmassMode: 2,
      airless: true,
      carbonLevel: 18,
      sulfurLevel: 12,
      worldGenConfig: {
        warp: 0.55,
        ruggedness: 1.55,
        temperatureVariance: 0.2,
        moistureVariance: 0.1,
        coastalDropoff: 1.0,
      },
      biomeOverrides: {
        Water: 'Sand',
        Forest: { split: 0.55, low: 'Rock', high: 'Snow' },
        Grass: { split: 0.55, low: 'Rock', high: 'Snow' },
      },
    });
  } else if (nodeKey === 'aurelia') {
    profile = _mergePlanetWorldProfile(profile, {
      cols: 90,
      rows: 90,
      cityCount: 6,
      landmassMode: 2,
      worldGenConfig: {
        warp: 1.1,
        ruggedness: 0.9,
        temperatureVariance: 1.15,
        moistureVariance: 1.55,
        coastalDropoff: 0.9,
      },
      carbonLevel: 72,
      sulfurLevel: 4,
      landingSuffix: 'Gate',
    });
  } else if (nodeKey === 'vanta') {
    profile = _mergePlanetWorldProfile(profile, {
      cols: 88,
      rows: 88,
      cityCount: 5,
      landmassMode: 1,
      airless: true,
      volatile: true,
      carbonLevel: 46,
      sulfurLevel: 28,
      worldGenConfig: {
        warp: 1.35,
        ruggedness: 1.7,
        temperatureVariance: 1.6,
        moistureVariance: 0.3,
        coastalDropoff: 1.0,
      },
      landingSuffix: 'Prospect',
      biomeOverrides: {
        Water: 'Sand',
        Snow: 'Rock',
        Forest: 'Rock',
        Grass: { split: 0.5, low: 'Sand', high: 'Rock' },
      },
    });
  }

  profile = _scalePlanetWorldProfileFromHomeworld(profile, nodeKey, body);

  if (!profile.landingCityName) {
    profile.landingCityName = `${body?.name || 'Surface'} ${profile.landingSuffix || 'Port'}`;
  }

  return profile;
}

function _planetBiomeOverride(profile, biomeName, roll = 0.5) {
  const biome = biomeName || 'Grass';
  const override = profile?.biomeOverrides?.[biome];
  let resolved = biome;
  if (typeof override === 'string' && override.trim()) resolved = override.trim();
  if (override && typeof override === 'object') {
    const split = Number.isFinite(Number(override.split)) ? Number(override.split) : 0.5;
    const low = (typeof override.low === 'string' && override.low.trim()) ? override.low.trim() : biome;
    const high = (typeof override.high === 'string' && override.high.trim()) ? override.high.trim() : biome;
    resolved = roll < split ? low : high;
  }
  const sulfurLevel = Math.max(0, Math.min(100, Number(profile?.sulfurLevel) || 0));
  if (sulfurLevel > 0 && resolved !== 'Water' && resolved !== 'Snow') {
    const sulfurRoll = (roll * 1.61803398875) % 1;
    let sulfurChance = 0;
    if (resolved === 'Rock') sulfurChance = Math.min(0.42, (sulfurLevel / 100) * 0.42);
    else if (resolved === 'Sand') sulfurChance = Math.min(0.32, (sulfurLevel / 100) * 0.32);
    else if (resolved === 'Grass') sulfurChance = Math.min(0.10, (sulfurLevel / 100) * 0.10);
    else if (resolved === 'Forest') sulfurChance = Math.min(0.06, (sulfurLevel / 100) * 0.06);
    if (sulfurRoll < sulfurChance) return 'Sulfur';
  }
  return resolved;
}

function _planetDecorForBiome(profile, biomeName, roll = 0.5) {
  const table = profile?.decorTable?.[biomeName] || _PLANET_SESSION_DECOR_TABLE[biomeName] || null;
  if (!Array.isArray(table)) return null;
  for (const [decorName, chance] of table) {
    if (roll < Number(chance)) return decorName;
  }
  return null;
}

function _planetSulfurStats(gridRef) {
  let sulfurTiles = 0;
  let landTiles = 0;
  if (!Array.isArray(gridRef)) {
    return { sulfurTiles: 0, landTiles: 0, coverage: 0, cityBonus: 0, populationScale: 1 };
  }
  for (const row of gridRef) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      const biome = cell?.options?.[0] || 'Water';
      if (biome === 'Water') continue;
      landTiles++;
      if (biome === 'Sulfur') sulfurTiles++;
    }
  }
  const coverage = landTiles > 0 ? (sulfurTiles / landTiles) : 0;
  return {
    sulfurTiles,
    landTiles,
    coverage,
    cityBonus: Math.max(0, Math.min(5, Math.floor(coverage * 14))),
    populationScale: Math.max(0.5, 1 - Math.min(0.45, coverage * 1.1)),
  };
}

function _applyPlanetSettlementEcology(cityList, sulfurStats) {
  if (!Array.isArray(cityList) || !sulfurStats || sulfurStats.coverage <= 0) return;
  for (let i = 0; i < cityList.length; i++) {
    const city = cityList[i];
    if (!city) continue;
    const jitter = 0.94 + (((i * 17) % 7) * 0.015);
    city.population = Math.max(120, Math.round((Number(city.population) || 300) * sulfurStats.populationScale * jitter));
  }
}

function _buildPlanetWorldFromTerrainFallback(terrainApi, terrain, profile, nodeKey, body, seed) {
  const nextGrid = [];
  const nextElevationMap = [];
  const nextTemperatureMap = [];
  const nextDifficultyMap = [];

  for (let y = 0; y < profile.rows; y++) {
    const gridRow = [];
    const elevRow = [];
    const tempRow = [];
    const diffRow = [];
    for (let x = 0; x < profile.cols; x++) {
      const idx = y * profile.cols + x;
      const baseBiome = terrainApi.BIOME_NAMES?.[terrain.biomeFlat[idx]] || 'Grass';
      const biome = _planetBiomeOverride(profile, baseBiome, ((seed + idx * 17) % 100) / 100);
      const elevation = Number(terrain.elevationFlat[idx] || 0);
      const temperature = Number(terrain.tempFlat[idx] || 0);
      const decor = _planetDecorForBiome(profile, biome, ((seed + idx * 29) % 100) / 100);
      const cell = decor
        ? { options: [biome], collapsed: true, decor }
        : { options: [biome], collapsed: true };
      gridRow.push(cell);
      elevRow.push(elevation);
      tempRow.push(temperature);
      diffRow.push((_PLANET_SESSION_BASE_DIFF[biome] || 0) + elevation * 5);
    }
    nextGrid.push(gridRow);
    nextElevationMap.push(elevRow);
    nextTemperatureMap.push(tempRow);
    nextDifficultyMap.push(diffRow);
  }

  return {
    grid: nextGrid,
    elevationMap: nextElevationMap,
    temperatureMap: nextTemperatureMap,
    difficultyMap: nextDifficultyMap,
  };
}

function _buildEmergencyPlanetWorld(profile, seed) {
  const colsRef = Math.max(1, Number(profile?.cols) || 1);
  const rowsRef = Math.max(1, Number(profile?.rows) || 1);
  const airless = !!(profile?.airless || profile?.volatile);
  const primaryBiome = airless ? 'Rock' : 'Grass';
  const secondaryBiome = airless ? 'Sand' : 'Forest';
  const tertiaryBiome = airless ? 'Snow' : 'Sand';
  const nextGrid = [];
  const nextElevationMap = [];
  const nextTemperatureMap = [];
  const nextDifficultyMap = [];

  for (let y = 0; y < rowsRef; y++) {
    const gridRow = [];
    const elevRow = [];
    const tempRow = [];
    const diffRow = [];
    for (let x = 0; x < colsRef; x++) {
      const roll = (_hashWorldSessionSeed(`${seed}:${x}:${y}`) % 1000) / 1000;
      const edgeDist = Math.min(x, y, colsRef - 1 - x, rowsRef - 1 - y);
      let biome = primaryBiome;
      if (!airless && edgeDist <= 1 && roll < 0.55) biome = 'Water';
      else if (roll < 0.18) biome = tertiaryBiome;
      else if (roll < 0.42) biome = secondaryBiome;
      const elevation = biome === 'Water' ? 0.34 : 0.55 + roll * 0.25;
      const temperature = airless ? 0.18 + roll * 0.22 : 0.36 + roll * 0.38;
      const decor = _planetDecorForBiome(profile, biome, roll);
      const cell = decor
        ? { options: [biome], collapsed: true, decor }
        : { options: [biome], collapsed: true };
      gridRow.push(cell);
      elevRow.push(elevation);
      tempRow.push(temperature);
      diffRow.push((_PLANET_SESSION_BASE_DIFF[biome] || 0) + elevation * 5);
    }
    nextGrid.push(gridRow);
    nextElevationMap.push(elevRow);
    nextTemperatureMap.push(tempRow);
    nextDifficultyMap.push(diffRow);
  }

  return {
    grid: nextGrid,
    elevationMap: nextElevationMap,
    temperatureMap: nextTemperatureMap,
    difficultyMap: nextDifficultyMap,
  };
}

function _planetTileBiome(gridRef, x, y) {
  return gridRef?.[y]?.[x]?.options?.[0] || null;
}

function _isPlanetBuildableTile(gridRef, x, y) {
  const biome = _planetTileBiome(gridRef, x, y);
  return !!biome && biome !== 'Water';
}

function _setPlanetTileBiome(gridRef, difficultyMapRef, elevationMapRef, temperatureMapRef, x, y, biome, profile) {
  const row = gridRef?.[y];
  const cell = row?.[x];
  if (!cell) return;
  cell.options = [biome];
  cell.collapsed = true;
  delete cell.decor;
  const decor = _planetDecorForBiome(profile, biome, 0.37);
  if (decor) cell.decor = decor;
  if (Array.isArray(elevationMapRef?.[y])) {
    elevationMapRef[y][x] = biome === 'Water' ? 0.34 : Math.max(0.54, Number(elevationMapRef[y][x]) || 0.58);
  }
  if (Array.isArray(temperatureMapRef?.[y])) {
    temperatureMapRef[y][x] = Math.max(0, Math.min(1,
      biome === 'Water'
        ? 0.42
        : (profile?.airless ? 0.24 : 0.52)
    ));
  }
  if (Array.isArray(difficultyMapRef?.[y])) {
    const elevation = Array.isArray(elevationMapRef?.[y]) ? Number(elevationMapRef[y][x]) || 0 : 0;
    difficultyMapRef[y][x] = (_PLANET_SESSION_BASE_DIFF[biome] || 0) + elevation * 5;
  }
}

function _findPlanetLandingAnchor(gridRef, sessionCols, sessionRows) {
  if (!Array.isArray(gridRef) || !sessionCols || !sessionRows) return null;
  const centerX = (sessionCols - 1) / 2;
  const centerY = (sessionRows - 1) / 2;
  let best = null;
  for (let y = 0; y < sessionRows; y++) {
    for (let x = 0; x < sessionCols; x++) {
      if (!_isPlanetBuildableTile(gridRef, x, y)) continue;
      const centerDist = Math.abs(x - centerX) + Math.abs(y - centerY);
      const edgeMargin = Math.min(x, y, sessionCols - 1 - x, sessionRows - 1 - y);
      const score = centerDist - edgeMargin * 0.2;
      if (!best || score < best.score) best = { x, y, score };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

function _ensurePlanetLandingZone(worldData, profile) {
  const gridRef = worldData?.grid;
  const sessionCols = Number(worldData?.cols) || Number(profile?.cols) || 0;
  const sessionRows = Number(worldData?.rows) || Number(profile?.rows) || 0;
  if (!Array.isArray(gridRef) || sessionCols <= 0 || sessionRows <= 0) return null;

  const existing = _findPlanetLandingAnchor(gridRef, sessionCols, sessionRows);
  if (existing) return existing;

  const cx = Math.max(0, Math.min(sessionCols - 1, Math.floor(sessionCols / 2)));
  const cy = Math.max(0, Math.min(sessionRows - 1, Math.floor(sessionRows / 2)));
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= sessionCols || ny < 0 || ny >= sessionRows) continue;
      const biome = profile?.airless
        ? 'Rock'
        : (Math.abs(dx) + Math.abs(dy) <= 1 ? 'Grass' : 'Sand');
      _setPlanetTileBiome(
        gridRef,
        worldData?.difficultyMap,
        worldData?.elevationMap,
        worldData?.temperatureMap,
        nx,
        ny,
        biome,
        profile
      );
    }
  }
  return { x: cx, y: cy };
}

function _ensurePlanetWalkableDistrict(worldData, profile, center, radius = 1) {
  const gridRef = worldData?.grid;
  const sessionCols = Number(worldData?.cols) || Number(profile?.cols) || 0;
  const sessionRows = Number(worldData?.rows) || Number(profile?.rows) || 0;
  const centerX = Math.floor(Number(center?.x));
  const centerY = Math.floor(Number(center?.y));
  if (!Array.isArray(gridRef) || sessionCols <= 0 || sessionRows <= 0) return false;
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return false;

  const centerBiome = _planetTileBiome(gridRef, centerX, centerY);
  const primaryBiome = (!centerBiome || centerBiome === 'Water')
    ? (profile?.airless ? 'Rock' : 'Grass')
    : centerBiome;
  const edgeBiome = (primaryBiome === 'Sand' || primaryBiome === 'Rock' || primaryBiome === 'Sulfur')
    ? primaryBiome
    : (profile?.airless ? 'Rock' : 'Sand');

  let changed = false;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = centerX + dx;
      const ny = centerY + dy;
      if (nx < 0 || nx >= sessionCols || ny < 0 || ny >= sessionRows) continue;
      const biome = _planetTileBiome(gridRef, nx, ny);
      if (biome && biome !== 'Water') continue;
      const nextBiome = Math.abs(dx) + Math.abs(dy) <= 1 ? primaryBiome : edgeBiome;
      _setPlanetTileBiome(
        gridRef,
        worldData?.difficultyMap,
        worldData?.elevationMap,
        worldData?.temperatureMap,
        nx,
        ny,
        nextBiome,
        profile
      );
      changed = true;
    }
  }
  return changed;
}

function _nextPlanetCityName(namePool, usedNames, fallbackBase) {
  if (Array.isArray(namePool)) {
    for (const candidate of namePool) {
      const next = (typeof candidate === 'string') ? candidate.trim() : '';
      if (!next || usedNames.has(next)) continue;
      usedNames.add(next);
      return next;
    }
  }
  let index = usedNames.size + 1;
  let name = `${fallbackBase || 'Settlement'} ${index}`;
  while (usedNames.has(name)) {
    index++;
    name = `${fallbackBase || 'Settlement'} ${index}`;
  }
  usedNames.add(name);
  return name;
}

function _fallbackPlanetCities(gridRef, sessionCols, sessionRows, targetCount, namePool, existingCities, seed, landingAnchor) {
  if (typeof City === 'undefined' || !Array.isArray(gridRef) || sessionCols <= 0 || sessionRows <= 0) return [];
  const citiesRef = Array.isArray(existingCities) ? existingCities : [];
  const usedNames = new Set(citiesRef.map((city) => city?.name).filter(Boolean));
  const occupied = new Set(citiesRef.map((city) => `${city?.location?.x},${city?.location?.y}`));
  const mapDim = Math.max(sessionCols, sessionRows);
  const minDist = Math.max(6, Math.floor(mapDim / 15));
  const minDistSq = minDist * minDist;
  const picked = [];
  const candidates = [];
  const centerX = (sessionCols - 1) / 2;
  const centerY = (sessionRows - 1) / 2;

  for (let y = 0; y < sessionRows; y++) {
    for (let x = 0; x < sessionCols; x++) {
      if (!_isPlanetBuildableTile(gridRef, x, y)) continue;
      const key = `${x},${y}`;
      if (occupied.has(key)) continue;
      const centerDist = Math.abs(x - centerX) + Math.abs(y - centerY);
      const edgeMargin = Math.min(x, y, sessionCols - 1 - x, sessionRows - 1 - y);
      const hash = _hashWorldSessionSeed(`${seed}:${x}:${y}`);
      const anchorDist = landingAnchor ? (Math.abs(x - landingAnchor.x) + Math.abs(y - landingAnchor.y)) : centerDist;
      candidates.push({
        x,
        y,
        score: anchorDist * 64 + centerDist * 8 - edgeMargin * 4 + (hash % 31),
      });
    }
  }

  candidates.sort((a, b) => a.score - b.score);

  function tooClose(x, y) {
    for (const city of citiesRef) {
      const dx = (city?.location?.x || 0) - x;
      const dy = (city?.location?.y || 0) - y;
      if (dx * dx + dy * dy < minDistSq) return true;
    }
    for (const city of picked) {
      const dx = city.location.x - x;
      const dy = city.location.y - y;
      if (dx * dx + dy * dy < minDistSq) return true;
    }
    return false;
  }

  if (landingAnchor && !occupied.has(`${landingAnchor.x},${landingAnchor.y}`) && _isPlanetBuildableTile(gridRef, landingAnchor.x, landingAnchor.y)) {
    const population = 420 + (_hashWorldSessionSeed(`${seed}:landing:${landingAnchor.x}:${landingAnchor.y}`) % 720);
    picked.push(new City({
      name: _nextPlanetCityName(namePool, usedNames, 'Port'),
      location: { x: landingAnchor.x, y: landingAnchor.y },
      population,
    }));
  }

  for (const spot of candidates) {
    if (citiesRef.length + picked.length >= targetCount) break;
    if (tooClose(spot.x, spot.y)) continue;
    const population = 300 + (_hashWorldSessionSeed(`${seed}:city:${spot.x}:${spot.y}`) % 900);
    picked.push(new City({
      name: _nextPlanetCityName(namePool, usedNames, 'Settlement'),
      location: { x: spot.x, y: spot.y },
      population,
    }));
  }

  return picked;
}

function _findSpawnNearLocalCity(gridRef, cityList, targetCity, sessionCols, sessionRows) {
  if (!Array.isArray(gridRef) || !targetCity?.location) return null;
  const occupied = new Set((cityList || []).map((city) => `${city?.location?.x},${city?.location?.y}`));
  const startX = Number(targetCity.location.x);
  const startY = Number(targetCity.location.y);
  if (!Number.isFinite(startX) || !Number.isFinite(startY)) return null;

  const isSpawnable = (x, y) => {
    if (x < 0 || x >= sessionCols || y < 0 || y >= sessionRows) return false;
    const tileType = gridRef[y]?.[x]?.options?.[0];
    if (!tileType || tileType === 'Water') return false;
    if (occupied.has(`${x},${y}`)) return false;
    return true;
  };

  const maxRadius = Math.max(sessionCols, sessionRows);
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const nx = startX + dx;
        const ny = startY + dy;
        if (isSpawnable(nx, ny)) return { x: nx, y: ny };
      }
    }
  }
  return null;
}

function _findPlanetDigSite(gridRef, cityList, sessionCols, sessionRows, salt = 0) {
  const occupied = new Set((cityList || []).map((city) => `${city?.location?.x},${city?.location?.y}`));
  const samples = 220;
  let best = null;
  for (let i = 0; i < samples; i++) {
    const x = Math.floor(Math.random() * sessionCols);
    const y = Math.floor(Math.random() * sessionRows);
    const tileType = gridRef?.[y]?.[x]?.options?.[0];
    if (!tileType || tileType === 'Water') continue;
    if (occupied.has(`${x},${y}`)) continue;
    let minCityDist = Infinity;
    for (const city of cityList || []) {
      const dist = Math.abs((city?.location?.x || 0) - x) + Math.abs((city?.location?.y || 0) - y);
      if (dist < minCityDist) minCityDist = dist;
    }
    const score = minCityDist + ((i + salt) % 7);
    if (!best || score > best.score) best = { x, y, score };
  }
  return best ? { x: best.x, y: best.y } : null;
}

function _buildPlanetWorldSession(nodeKey, body) {
  const root = (typeof window !== 'undefined') ? window : globalThis;
  const terrainApi = root?.BQWorldGenerators || root?.KozEngine?.World?.worldGenerators || null;
  const profile = _planetWorldProfile(nodeKey, body);
  const seed = _hashWorldSessionSeed(`${nodeKey}:${body?.key || body?.name || 'surface'}`);
  let builtWorld = null;

  if (terrainApi && typeof terrainApi.generateTerrainFields === 'function') {
    const terrain = terrainApi.generateTerrainFields({
      cols: profile.cols,
      rows: profile.rows,
      seed,
      landmassMode: profile.landmassMode,
      worldGenConfig: profile.worldGenConfig,
    });
    const decorRng = (() => {
      let rngSeed = (seed ^ 0x85EBCA6B) >>> 0;
      return function nextDecorRand() {
        rngSeed ^= rngSeed << 13;
        rngSeed ^= rngSeed >>> 17;
        rngSeed ^= rngSeed << 5;
        return (rngSeed >>> 0) / 4294967296;
      };
    })();
    builtWorld = (typeof terrainApi.buildWorldGridFromTerrain === 'function')
      ? terrainApi.buildWorldGridFromTerrain({
          terrain,
          rows: profile.rows,
          cols: profile.cols,
          baseDifficulty: _PLANET_SESSION_BASE_DIFF,
          decorRng,
          resolveBiome: ({ idx, baseBiome }) => (
            _planetBiomeOverride(profile, baseBiome, ((seed + idx * 17) % 100) / 100)
          ),
          resolveDecor: ({ idx, biome, defaultDecor }) => (
            defaultDecor ?? _planetDecorForBiome(profile, biome, ((seed + idx * 29) % 100) / 100)
          ),
        })
      : _buildPlanetWorldFromTerrainFallback(terrainApi, terrain, profile, nodeKey, body, seed);
  }

  if (!builtWorld || !Array.isArray(builtWorld.grid)) {
    builtWorld = _buildEmergencyPlanetWorld(profile, seed);
  }

  builtWorld.cols = Number(profile.cols) || builtWorld.cols || 0;
  builtWorld.rows = Number(profile.rows) || builtWorld.rows || 0;
  const sulfurStats = _planetSulfurStats(builtWorld.grid);
  const resolvedCityCount = Math.max(3, (Number(profile.cityCount) || 5) + sulfurStats.cityBonus);
  const landingAnchor = _ensurePlanetLandingZone(builtWorld, profile);
  const nextGrid = builtWorld.grid;
  const nextElevationMap = builtWorld.elevationMap;
  const nextTemperatureMap = builtWorld.temperatureMap;
  const nextDifficultyMap = builtWorld.difficultyMap;

  const cityList = _withSessionDimensions(profile.cols, profile.rows, () => {
    const poolCount = Math.max(40, resolvedCityCount + 16);
    const namePool = (typeof NameGenerator !== 'undefined' && typeof NameGenerator.generateNames === 'function')
      ? NameGenerator.generateNames(poolCount, poolCount)
      : Array.from({ length: poolCount }, (_, i) => `Settlement ${i + 1}`);
    const generated = (typeof City !== 'undefined' && typeof City.generateCities === 'function')
      ? City.generateCities(nextGrid, resolvedCityCount, namePool)
      : [];
    const fallbackCities = _fallbackPlanetCities(
      nextGrid,
      profile.cols,
      profile.rows,
      resolvedCityCount,
      namePool,
      generated,
      seed,
      landingAnchor
    );
    const resolvedCities = generated.concat(fallbackCities);
    for (const city of resolvedCities) {
      if (city && typeof city.addInventoryBasedOnTerrain === 'function') {
        city.addInventoryBasedOnTerrain(nextGrid, 1);
      }
    }
    if (typeof City !== 'undefined' && typeof City.detectCoastalCities === 'function') {
      City.detectCoastalCities(resolvedCities, nextGrid, profile.rows, profile.cols);
    }
    return resolvedCities;
  });

  if (!Array.isArray(cityList) || cityList.length === 0) return null;
  _applyPlanetSettlementEcology(cityList, sulfurStats);

  let landingCity = cityList[0];
  if (landingAnchor) {
    let bestCity = null;
    let bestDistance = Infinity;
    for (const city of cityList) {
      const cx = Number(city?.location?.x);
      const cy = Number(city?.location?.y);
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
      const distance = Math.abs(cx - landingAnchor.x) + Math.abs(cy - landingAnchor.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCity = city;
      }
    }
    if (bestCity) landingCity = bestCity;
  }
  landingCity.name = profile.landingCityName;
  landingCity.hasSpaceport = true;
  landingCity.progression = landingCity.progression || {};
  landingCity.progression.spaceProgram = true;
  landingCity.progression.spaceportBuilt = true;
  landingCity.progression.spaceAccess = landingCity.progression.spaceAccess || {};
  landingCity.progression.spaceAccess.launchReady = true;
  landingCity.progression.spaceAccess.dockingRights = true;
  landingCity.progression.spaceAccess.landingRights = true;
  landingCity.progression.spaceAccess.orbitClearance = true;

  const landingWorld = {
    grid: nextGrid,
    elevationMap: nextElevationMap,
    difficultyMap: nextDifficultyMap,
    temperatureMap: nextTemperatureMap,
    cols: profile.cols,
    rows: profile.rows,
  };
  _ensurePlanetWalkableDistrict(landingWorld, profile, landingCity.location, 1);
  let landingSpawn = _findSpawnNearLocalCity(nextGrid, cityList, landingCity, profile.cols, profile.rows);
  if (!landingSpawn) {
    _ensurePlanetWalkableDistrict(landingWorld, profile, landingCity.location, 2);
    landingSpawn = _findSpawnNearLocalCity(nextGrid, cityList, landingCity, profile.cols, profile.rows);
  }
  if (typeof City !== 'undefined' && typeof City.detectCoastalCities === 'function') {
    City.detectCoastalCities(cityList, nextGrid, profile.rows, profile.cols);
  }

  const sessionKey = _planetWorldSessionKey(nodeKey, body?.key || body?.name || 'surface');
  return {
    key: sessionKey,
    label: `${body?.name || 'Surface'} Surface`,
    sessionType: 'planet_surface',
    spaceContext: {
      nodeKey,
      bodyKey: body?.key || null,
      bodyName: body?.name || 'Surface',
      bodyKind: body?.kind || null,
      biome: body?.biome || null,
      faction: body?.faction || null,
      goods: Array.isArray(body?.goods) ? body.goods.slice() : [],
      marketTags: Array.isArray(body?.marketTags) ? body.marketTags.slice() : [],
      contractTags: Array.isArray(body?.contractTags) ? body.contractTags.slice() : [],
      landingCityName: landingCity.name,
      landingCityLocation: { x: landingCity.location.x, y: landingCity.location.y },
      landingSpawn: landingSpawn ? { x: landingSpawn.x, y: landingSpawn.y } : null,
      carbonLevel: Math.max(0, Math.min(100, Number(profile.carbonLevel) || 0)),
      sulfurLevel: Math.max(0, Math.min(100, Number(profile.sulfurLevel) || 0)),
      sulfurCoverage: Math.round((sulfurStats.coverage || 0) * 1000) / 10,
    },
    cols: profile.cols,
    rows: profile.rows,
    grid: nextGrid,
    elevationMap: nextElevationMap,
    difficultyMap: nextDifficultyMap,
    temperatureMap: nextTemperatureMap,
    cities: cityList,
    portCityLocations: cityList.filter((city) => city?.isCoastal).map((city) => ({
      x: city.location.x,
      y: city.location.y,
    })),
    mapSeed: seed,
    isCustomMap: true,
    landmass: profile.landmassMode,
    worldGenConfig: { ...profile.worldGenConfig },
    playerPosition: landingSpawn || { x: landingCity.location.x, y: landingCity.location.y },
    systemSnapshots: null,
  };
}

function _initializePlanetWorldSessionRuntime(session) {
  eventSystem = _createEventSystem();
  if (eventSystem && typeof eventSystem === 'object') {
    eventSystem.eventChance = Math.max(0.04, Number(eventSystem.eventChance) || 0.1);
  }

  contractSystem = new ContractSystem();
  for (const city of cities || []) {
    if (!city?.name) continue;
    contractSystem.generateForCity(city);
  }

  treasureSystem = new TreasureSystem();
  const digSiteCount = Math.max(1, Math.min(3, Math.floor((cities?.length || 0) / 2)));
  for (let i = 0; i < digSiteCount; i++) {
    const site = _findPlanetDigSite(grid, cities, cols, rows, i * 17);
    if (!site) continue;
    const mapId = `${session.key}:dig:${i}`;
    treasureSystem.assembledMaps.push({ id: mapId, region: session.spaceContext?.bodyKey || 'surface', digX: site.x, digY: site.y });
    treasureSystem.digSites.push({ x: site.x, y: site.y, mapId });
  }

  traderManager = new TraderManager();
  traderManager.init();
  raiderManager = new RaiderManager();
  raiderManager.init();

  session.systemSnapshots = _serializeWorldSystems();
}

function enterPlanetSurfaceFromSpace(spaceSystem, body) {
  if (!spaceSystem || !body) return { ok: false, reason: 'missing_surface' };
  const nodeKey = spaceSystem.currentNode || 'orbit';
  const sessionKey = _planetWorldSessionKey(nodeKey, body.key || body.name || 'surface');
  let session = getWorldSession(sessionKey);
  const needsRebuild = !session || !Array.isArray(session.grid) || !Array.isArray(session.cities) || session.cities.length === 0;
  if (needsRebuild) {
    session = _buildPlanetWorldSession(nodeKey, body);
    if (!session) return { ok: false, reason: 'generation_failed' };
    _worldSessions.set(session.key, session);
  }
  if (session?.spaceContext && Number.isFinite(Number(spaceSystem.graphSeed))) {
    session.spaceContext.graphSeed = Number(spaceSystem.graphSeed);
  }

  let activation = activateWorldSession(session, {
    playerPosition: session.playerPosition || null,
  });
  if (!activation.ok && activation.reason === 'session_unavailable') {
    session = _buildPlanetWorldSession(nodeKey, body);
    if (!session) return { ok: false, reason: 'generation_failed' };
    _worldSessions.set(session.key, session);
    activation = activateWorldSession(session, {
      playerPosition: session.playerPosition || null,
    });
  }
  if (!activation.ok) return activation;

  if (!session.systemSnapshots) {
    _initializePlanetWorldSessionRuntime(session);
    if (typeof invalidateMapBuffer === 'function') invalidateMapBuffer();
    if (typeof generateMinimap === 'function') generateMinimap();
    rebuildSpatialGrids();
  }

  if (player) {
    const landingCity = _getLandingCityForSession(session);
    if (landingCity && player.x === landingCity.location.x && player.y === landingCity.location.y) {
      const safeSpawn = _findSpawnNearLocalCity(grid, cities, landingCity, cols, rows);
      if (safeSpawn) {
        player.x = safeSpawn.x;
        player.y = safeSpawn.y;
        session.playerPosition = { x: safeSpawn.x, y: safeSpawn.y };
      }
    }
    player.grid = grid;
    player.currentTileCity = _getCityAtTile(player.x, player.y);
    player.currentCity = null;
    player.path = [];
    player.pathMoveTimer = 0;
    if (typeof player.visitPlanet === 'function' && body.key) player.visitPlanet(body.key);
    player.spaceTravel = player.spaceTravel || {};
    player.spaceTravel.inOrbit = false;
    player.spaceTravel.currentPlanet = body.key || nodeKey;
  }

  session.playerPosition = _cloneWorldPoint(player);
  session.systemSnapshots = _serializeWorldSystems();
  if (typeof window !== 'undefined') {
    window._spaceMapOpen = false;
    window._cityViewOpen = false;
    window._bqActiveWorldSessionKey = session.key;
  }
  if (typeof gameStateManager !== 'undefined' && gameStateManager) {
    gameStateManager.setState(_getSurfaceGameplayState(session));
  }

  return { ok: true, session };
}
if (typeof window !== 'undefined') window.BQEnterPlanetSurfaceFromSpace = enterPlanetSurfaceFromSpace;

function liftOffFromPlanetSurfaceSession() {
  const session = getWorldSession();
  let sys = player?._spaceTravelSystem || window._spaceTravelSystem || null;
  if (!_isPlanetSurfaceSession(session)) return { ok: false, reason: 'not_planet_surface' };
  if ((!sys || sys.phase !== 'landed') && session) {
    sys = _repairPlanetSurfaceLiftOffState(session, sys) || sys;
  }
  if (!sys || typeof sys.liftOff !== 'function') return { ok: false, reason: 'space_unavailable' };

  const restorePos = _cloneWorldPoint(player);
  suspendActiveWorldSessionRuntime();
  const result = sys.liftOff();
  if (!result.ok) {
    activateWorldSession(session, { playerPosition: restorePos, preservePlayerPosition: false });
    return result;
  }

  if (player) {
    player.currentTileCity = null;
    player.currentCity = null;
    player.path = [];
    player.pathMoveTimer = 0;
    player.spaceTravel = player.spaceTravel || {};
    player.spaceTravel.inOrbit = true;
    if (session?.spaceContext?.bodyKey) player.spaceTravel.currentPlanet = session.spaceContext.bodyKey;
  }

  if (typeof window !== 'undefined') {
    window._spaceMapOpen = false;
    window._forceSpaceMapOpenOnce = false;
    window._spaceHudCollapsed = false;
    window._cityViewOpen = false;
  }
  return result;
}
if (typeof window !== 'undefined') window.BQLiftOffPlanetSurface = liftOffFromPlanetSurfaceSession;

/** Rebuild the cityLocationMap from the cities array. Call after generating or loading cities. */
function buildCityLocationMap() {
  cityLocationMap.clear();
  if (!cities) return;
  for (let i = 0; i < cities.length; i++) {
    const city = cities[i];
    city.cityIndex = i; // cache index so city.render() avoids O(N) indexOf calls
    cityLocationMap.set(`${city.location.x},${city.location.y}`, city);
  }
  if (typeof window !== 'undefined') window.cityLocationMap = cityLocationMap;
}

/**
 * (Re)populate all three spatial grids from current world state.
 * Call after world gen or save load, once traders + raiders exist.
 * Individual insert/remove/move calls in entity update loops keep
 * the grids current after this initial bulk-load.
 */
function rebuildSpatialGrids() {
  _ensureSpatialGridsReady();
  cityGrid.clear();
  traderGrid.clear();
  raiderGrid.clear();

  if (cities) {
    for (const city of cities) {
      city.dockedTraderCount = 0; // reset before counting from trader states
      cityGrid.insert(city, city.location.x, city.location.y);
    }
  }
  if (traderManager) {
    for (const t of traderManager.traders) {
      if (t.state === 'dead') continue;
      traderGrid.insert(t, t.x, t.y);
      // Rehydrate dockedTraderCount from saved trader states
      if ((t.state === 'trading' || t.state === 'idle') && t.currentCityIndex >= 0) {
        const c = cities && cities[t.currentCityIndex];
        if (c) c.dockedTraderCount++;
      }
    }
  }
  if (raiderManager) {
    for (const r of raiderManager.raiders) {
      if (r.state !== 'defeated') raiderGrid.insert(r, r.x, r.y);
    }
  }
}

/**
 * Trigger game-over. On hardcore difficulty, deletes the save first (permadeath).
 * Call this instead of gameStateManager.setState(GameStates.GAMELOSE) directly.
 */
function triggerGameLose() {
  if (window.DIFFICULTY_CONFIG?.permadeath) {
    window._permadeathTriggered = true;
    SaveSystem.deleteSave();
  }
  gameStateManager.setState(GameStates.GAMELOSE);
}

let _viewportResizeRaf = 0;
let _viewportResizeListenersBound = false;

function _readAppViewportSize() {
  const fromApi = (typeof window !== 'undefined' && window.BQViewport && typeof window.BQViewport.read === 'function')
    ? window.BQViewport.read()
    : null;
  const rawWidth = Number(fromApi?.width)
    || (typeof window !== 'undefined' && Number.isFinite(window.innerWidth) ? window.innerWidth : 0)
    || (typeof windowWidth === 'number' ? windowWidth : 0)
    || 1280;
  const rawHeight = Number(fromApi?.height)
    || (typeof window !== 'undefined' && Number.isFinite(window.innerHeight) ? window.innerHeight : 0)
    || (typeof windowHeight === 'number' ? windowHeight : 0)
    || 720;
  return {
    width: Math.max(1, Math.round(rawWidth)),
    height: Math.max(1, Math.round(rawHeight)),
  };
}

function _syncCanvasCssSize(canvasEl, widthPx, heightPx) {
  if (!canvasEl) return;
  canvasEl.style.width = `${widthPx}px`;
  canvasEl.style.height = `${heightPx}px`;
}

function _cleanupTransientUiState() {
  if (typeof document === 'undefined') return;

  document.body.classList.remove('city-view-open');

  const transientIds = [
    'travelMapWindow',
    'bookPopupOverlay',
    'boatHoldOverlay',
    'bountyBoardOverlay',
    'bankOverlay',
    'gamblingOverlay',
    'blackMarketOverlay',
    'worldViewerOverlay',
    'themeEditorOverlay',
    'citymgmtLeaderboardModal',
    'invasionQTEOverlay',
    'unitRaidQTEOverlay',
  ];

  for (const id of transientIds) {
    document.getElementById(id)?.remove();
  }

  const cityMgmtFloatingBtns = document.getElementById('cityMgmtFloatingBtns');
  if (cityMgmtFloatingBtns) cityMgmtFloatingBtns.style.display = 'none';

  const travelMapWindow = document.getElementById('travelMapWindow');
  if (travelMapWindow) travelMapWindow.style.display = 'none';

  window._cityViewOpen = false;
  window._pauseReturnState = null;
}

function _applyViewportResize() {
  try {
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    pixelDensity(DPR);
  } catch (e) {
    _reportRuntimeError('_applyViewportResize.pixelDensity', e);
  }

  if (typeof window !== 'undefined' && window.BQViewport && typeof window.BQViewport.sync === 'function') {
    window.BQViewport.sync();
  }

  const { width, height } = _readAppViewportSize();
  resizeCanvas(width, height);
  const c = document.querySelector('canvas');
  _syncCanvasCssSize(c, width, height);

  if (typeof mobileSupport !== 'undefined' && typeof mobileSupport.refresh === 'function') {
    mobileSupport.refresh(c || document.querySelector('canvas'));
  }
}

function _queueViewportResize() {
  if (_viewportResizeRaf) return;
  _viewportResizeRaf = window.requestAnimationFrame(() => {
    _viewportResizeRaf = 0;
    _applyViewportResize();
  });
}

function _bindViewportResizeListeners() {
  if (_viewportResizeListenersBound || typeof window === 'undefined') return;
  _viewportResizeListenersBound = true;
  window.addEventListener('orientationchange', _queueViewportResize, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', _queueViewportResize, { passive: true });
  }
}

function setup() {
  _setStartupShellStage('Preparing main menu...');
  const initialViewport = _readAppViewportSize();
  const mainCanvas = createCanvas(initialViewport.width, initialViewport.height);
  // Prevent browser context/aux-click behavior on the game canvas so
  // right-click does not interrupt gameplay input handling.
  if (mainCanvas && mainCanvas.elt) {
    mainCanvas.elt.addEventListener('contextmenu', (e) => e.preventDefault());
    mainCanvas.elt.addEventListener('auxclick', (e) => {
      if (e.button === 1 || e.button === 2) e.preventDefault();
    });
  }
  // Cap pixel density to avoid extremely heavy backing buffers on high-DPR devices
  try {
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    pixelDensity(DPR);
    // Ensure the canvas CSS size matches the logical window size (p5 may set backing buffer larger)
    const c = document.querySelector('canvas');
    _syncCanvasCssSize(c, initialViewport.width, initialViewport.height);
  } catch (e) { /* ignore if running outside p5 context */ }
  _bindViewportResizeListeners();
  noStroke();
  textFont('monospace');
  _setStartupShellStage('Loading engine modules...');
  _getEngineBridgeReady()
    .then(async () => {
      _initializeEngineRuntime();
      await _completeSetup(mainCanvas);
      _gameBootstrapComplete = true;
    })
    .catch((err) => {
      _engineBootstrapError = err;
      console.error('[BQ] Engine bootstrap failed:', err);
      _setStartupShellStage('Engine load failed');
    });
}

async function _completeSetup(mainCanvas) {
  // Register game states (all, including new config)
  gameStateManager.addState(GameStates.MAIN_MENU, {});
  gameStateManager.addState(GameStates.INFO, {});
  gameStateManager.addState(GameStates.NEW_GAME_CONFIG, {});
  gameStateManager.addState(GameStates.SETTINGS, {});
  gameStateManager.addState(GameStates.PLAYING, {});
  gameStateManager.addState(GameStates.INVENTORY, {});
  gameStateManager.addState(GameStates.PAUSED, {});
  gameStateManager.addState(GameStates.GAMELOSE, {});
  gameStateManager.addState(GameStates.GAMEWON, {});
  gameStateManager.addState(GameStates.COMBAT, {});
  gameStateManager.addState(GameStates.RANDOM_EVENT, {});
  gameStateManager.addState(GameStates.WEEKLY_SUMMARY, {});
  gameStateManager.addState(GameStates.LEVEL_EDITOR, {});
  gameStateManager.addState(GameStates.CREDITS, {});
  // New system states
  gameStateManager.addState(GameStates.MINIGAME, {});
  gameStateManager.addState(GameStates.GAMBLING, {});
  gameStateManager.addState(GameStates.CONTRACT_BOARD, {});
  gameStateManager.addState(GameStates.BANK, {});
  gameStateManager.addState(GameStates.BOUNTY_BOARD, {});
  gameStateManager.addState(GameStates.BLACK_MARKET, {});
  gameStateManager.addState(GameStates.TREASURE_MAP, {});
  // City-management mode (separate mode)
  gameStateManager.addState(GameStates.CITY_MANAGE, {});
  gameStateManager.addState(GameStates.PLANET_SURFACE, {});
  gameStateManager.addState(GameStates.SPACE, {
    enter() {
      const prevState = gameStateManager?.prev || null;
      if ((prevState === GameStates.PLAYING || prevState === GameStates.PLANET_SURFACE || prevState === GameStates.CITY_MANAGE)
        && typeof suspendActiveWorldSessionRuntime === 'function') {
        suspendActiveWorldSessionRuntime();
      }
      // Initialize or retrieve the space travel system
      if (typeof SpaceTravelSystem !== 'undefined' && player) {
        const system = _ensurePlayerSpaceTravelSystem();
        if (!system) return;
        window._spaceReturnState = (gameStateManager.prev === GameStates.CITY_MANAGE || window._isCityManageMode)
          ? GameStates.CITY_MANAGE
          : _getSurfaceGameplayState();
        if (typeof window._syncPlayerSpaceTravelFromSystem === 'function') {
          window._syncPlayerSpaceTravelFromSystem();
        }
        window._spaceMapOpen = false;
        window._forceSpaceMapOpenOnce = false;
        if (typeof window._spaceHudCollapsed !== 'boolean') window._spaceHudCollapsed = false;
        window._spaceLastTickMs = performance.now();
      }
    },
    exit() {
      if (player && player._spaceTravelSystem && typeof player._spaceTravelSystem.toJSON === 'function') {
        player.spaceTravel = player.spaceTravel || {};
        player.spaceTravel.travelSystemState = player._spaceTravelSystem.toJSON();
      }
      window._spaceLastTickMs = 0;
    },
  });

  // Define valid state transitions – prevents impossible jumps
  gameStateManager.setTransitionRules({
    "*":            [GameStates.MAIN_MENU],                              // can always go to main menu
    [GameStates.MAIN_MENU]:      [GameStates.INFO, GameStates.NEW_GAME_CONFIG, GameStates.PLAYING, GameStates.SETTINGS, GameStates.LEVEL_EDITOR, GameStates.CREDITS, GameStates.CITY_MANAGE],
    [GameStates.INFO]:           [GameStates.MAIN_MENU],
    [GameStates.LEVEL_EDITOR]:   [GameStates.MAIN_MENU, GameStates.PLAYING, GameStates.PAUSED],
    [GameStates.NEW_GAME_CONFIG]: [GameStates.MAIN_MENU, GameStates.PLAYING],
    [GameStates.SETTINGS]:       [GameStates.MAIN_MENU, GameStates.PLAYING, GameStates.PLANET_SURFACE, GameStates.PAUSED, GameStates.COMBAT, GameStates.CITY_MANAGE, GameStates.LEVEL_EDITOR],
    [GameStates.PLAYING]:        [GameStates.PAUSED, GameStates.SETTINGS, GameStates.INVENTORY, GameStates.COMBAT, GameStates.RANDOM_EVENT, GameStates.WEEKLY_SUMMARY, GameStates.GAMELOSE, GameStates.GAMEWON, GameStates.MAIN_MENU, GameStates.MINIGAME, GameStates.GAMBLING, GameStates.CONTRACT_BOARD, GameStates.BANK, GameStates.BOUNTY_BOARD, GameStates.BLACK_MARKET, GameStates.TREASURE_MAP, GameStates.CITY_MANAGE, GameStates.PLANET_SURFACE, GameStates.SPACE],
    [GameStates.PLANET_SURFACE]: [GameStates.PAUSED, GameStates.SETTINGS, GameStates.INVENTORY, GameStates.COMBAT, GameStates.RANDOM_EVENT, GameStates.WEEKLY_SUMMARY, GameStates.GAMELOSE, GameStates.GAMEWON, GameStates.MAIN_MENU, GameStates.MINIGAME, GameStates.GAMBLING, GameStates.CONTRACT_BOARD, GameStates.BANK, GameStates.BOUNTY_BOARD, GameStates.BLACK_MARKET, GameStates.TREASURE_MAP, GameStates.CITY_MANAGE, GameStates.PLAYING, GameStates.SPACE],
    [GameStates.CITY_MANAGE]:    [GameStates.MAIN_MENU, GameStates.PAUSED, GameStates.SETTINGS, GameStates.COMBAT, GameStates.RANDOM_EVENT, GameStates.INVENTORY, GameStates.GAMELOSE, GameStates.GAMEWON, GameStates.MINIGAME, GameStates.GAMBLING, GameStates.CONTRACT_BOARD, GameStates.BANK, GameStates.BOUNTY_BOARD, GameStates.BLACK_MARKET, GameStates.TREASURE_MAP, GameStates.WEEKLY_SUMMARY, GameStates.PLAYING, GameStates.PLANET_SURFACE, GameStates.SPACE],
    [GameStates.PAUSED]:         [GameStates.PLAYING, GameStates.PLANET_SURFACE, GameStates.SETTINGS, GameStates.MAIN_MENU, GameStates.COMBAT, GameStates.CITY_MANAGE, GameStates.LEVEL_EDITOR],
    [GameStates.INVENTORY]:      [GameStates.PLAYING, GameStates.PLANET_SURFACE, GameStates.CITY_MANAGE],
    [GameStates.COMBAT]:         [GameStates.PLAYING, GameStates.PLANET_SURFACE, GameStates.SPACE, GameStates.GAMELOSE, GameStates.PAUSED, GameStates.SETTINGS, GameStates.CITY_MANAGE],
    [GameStates.RANDOM_EVENT]:   [GameStates.PLAYING, GameStates.PLANET_SURFACE, GameStates.GAMELOSE, GameStates.COMBAT, GameStates.MINIGAME, GameStates.CITY_MANAGE],
    [GameStates.WEEKLY_SUMMARY]: [GameStates.PLAYING, GameStates.PLANET_SURFACE, GameStates.CITY_MANAGE],
    [GameStates.GAMELOSE]:       [GameStates.MAIN_MENU],
    [GameStates.GAMEWON]:        [GameStates.PLAYING, GameStates.PLANET_SURFACE, GameStates.CITY_MANAGE, GameStates.MAIN_MENU],
    // New system state transitions — all can return to active surface gameplay
    [GameStates.MINIGAME]:       [GameStates.PLAYING, GameStates.PLANET_SURFACE, GameStates.RANDOM_EVENT, GameStates.GAMBLING, GameStates.CITY_MANAGE],
    [GameStates.GAMBLING]:       [GameStates.PLAYING, GameStates.PLANET_SURFACE, GameStates.CITY_MANAGE, GameStates.MINIGAME],
    [GameStates.CONTRACT_BOARD]: [GameStates.PLAYING, GameStates.PLANET_SURFACE, GameStates.CITY_MANAGE],
    [GameStates.BANK]:           [GameStates.PLAYING, GameStates.PLANET_SURFACE, GameStates.CITY_MANAGE],
    [GameStates.BOUNTY_BOARD]:   [GameStates.PLAYING, GameStates.PLANET_SURFACE, GameStates.CITY_MANAGE],
    [GameStates.BLACK_MARKET]:   [GameStates.PLAYING, GameStates.PLANET_SURFACE, GameStates.CITY_MANAGE, GameStates.MINIGAME],
    [GameStates.TREASURE_MAP]:   [GameStates.PLAYING, GameStates.PLANET_SURFACE, GameStates.CITY_MANAGE],
    [GameStates.SPACE]:          [GameStates.PLAYING, GameStates.PLANET_SURFACE, GameStates.CITY_MANAGE],
  });

  // Menu-only states that should NOT trigger an auto-save when returning to main menu
  const _menuStates = new Set([
    GameStates.MAIN_MENU, GameStates.NEW_GAME_CONFIG, GameStates.SETTINGS,
    GameStates.CREDITS, GameStates.INFO, GameStates.LEVEL_EDITOR,
  ]);

  gameStateManager.onChange((from, to) => {
    if (to === GameStates.GAMEWON || to === GameStates.GAMELOSE || to === GameStates.MAIN_MENU) {
      _cleanupTransientUiState();
    }

    // Auto-save when quitting to main menu from an active game (not from other menu screens)
    if (to === GameStates.MAIN_MENU && worldInitialized && !window._permadeathTriggered
        && !_menuStates.has(from)) {
      try { SaveSystem.save({ silent: true }); } catch (e) { console.warn('Auto-save on quit failed:', e); }
    }
    // Check win/lose whenever returning to PLAYING — catches gold changes from banks,
    // contracts, markets, weekly costs etc. that happen in non-PLAYING states
    if ((to === GameStates.PLAYING || to === GameStates.PLANET_SURFACE) && typeof player !== 'undefined' && player && worldInitialized) {
      try { player.checkEndConditions(true); } catch (e) { _reportRuntimeError('stateChange.checkEndConditions', e); }
    }
    // If we just left City Management, ensure city-mode flags are cleaned up so other systems
    // (combat/event resolution) don't accidentally return the player to city mode.
    if (from === GameStates.CITY_MANAGE && to !== GameStates.CITY_MANAGE && to !== GameStates.SPACE && to !== GameStates.PAUSED && to !== GameStates.COMBAT && to !== GameStates.RANDOM_EVENT && to !== GameStates.MINIGAME && to !== GameStates.SETTINGS && to !== GameStates.INVENTORY) {
      // Leaving city management for good (main menu, or return to adventure) — clean up all flags
      try { window._isCityManageMode = false; } catch (e) { _reportRuntimeError('stateChange.clear._isCityManageMode', e); }
      try { window._adventureCityManage = false; } catch (e) { _reportRuntimeError('stateChange.clear._adventureCityManage', e); }
      try { window._savedCityManagementData = null; } catch (e) { _reportRuntimeError('stateChange.clear._savedCityManagementData', e); }
      try { window._savedIsCityManageMode = false; } catch (e) { _reportRuntimeError('stateChange.clear._savedIsCityManageMode', e); }
      try { if (typeof player !== 'undefined' && player) player.currentCity = null; } catch (e) { _reportRuntimeError('stateChange.clear.player.currentCity', e); }
      try { window._cityViewOpen = false; } catch (e) { _reportRuntimeError('stateChange.clear._cityViewOpen', e); }
      try { if (typeof cityManagement !== 'undefined' && cityManagement && typeof cityManagement.onExit === 'function') cityManagement.onExit(); } catch (e) { _reportRuntimeError('stateChange.cityManagement.onExit', e); }
    }
    uiManager.onGameStateChange(to);
    if (typeof sound !== "undefined" && sound && typeof sound.syncGameState === "function") {
      sound.syncGameState(from, to);
    }
    // Tutorial: contextual combat tip on first fight
    if (typeof tutorialSystem !== 'undefined' && tutorialSystem) {
      if (to === GameStates.COMBAT) tutorialSystem.tryShow('combat');
    }
  });
  gameStateManager.setState(GameStates.MAIN_MENU);
  const audioReadyPromise = _prepareAudioRuntime();

  initMenuMap({ deferWarmup: true });
  registerAtlases();
  window._atlasesRegistered = true;
  installMenuPresentationRecoveryHooks();

  // Auto-save on page close (skip if game over or permadeath triggered)
  window.addEventListener('beforeunload', () => {
    if (worldInitialized && (_isSurfaceGameplayState() || gameStateManager.is(GameStates.CITY_MANAGE) || gameStateManager.is(GameStates.SPACE)) && !window._permadeathTriggered) {
      SaveSystem.save({ silent: true });
    }
  });

  // Real-time autosave every 5 minutes.
  if (window._realTimeAutosaveIntervalId != null) {
    clearInterval(window._realTimeAutosaveIntervalId);
    window._realTimeAutosaveIntervalId = null;
  }
  window._realTimeAutosaveIntervalId = setInterval(() => {
    try {
      if (!worldInitialized || window._permadeathTriggered || typeof SaveSystem === 'undefined') return;
      const inActivePlay = _isSurfaceGameplayState()
        || gameStateManager.is(GameStates.CITY_MANAGE)
        || gameStateManager.is(GameStates.SPACE);
      if (!inActivePlay) return;
      SaveSystem.save({ silent: true });
    } catch (e) {
      console.warn('Real-time autosave failed:', e);
    }
  }, 5 * 60 * 1000);

  // Mobile: attach pinch-zoom and virtual HUD
  if (typeof mobileSupport !== 'undefined') {
    mobileSupport.init(mainCanvas?.elt || document.querySelector('canvas'));
  }

  await audioReadyPromise;
  _setStartupShellStage('Menu ready');
  _hideStartupShellSoon();
}

/**
 * Apply new-game configuration (player name, starting gold, items, boat) to the
 * freshly-created Player instance. Called right after `new Player(...)`.
 */
function applyNewGameConfig(p) {
  // Player name
  const captainNames = [
    'Captain Drake', 'Sera Blacktide', 'Olric the Bold', 'Nyx Stormwind',
    'Harlan Driftwood', 'Mira Seafoam', 'Captain Vex', 'Kael Thornwick',
  ];
  const rng = (window.BQSeededRNG && window.BQSeededRNG.stream) ? window.BQSeededRNG.stream('player:init') : null;
  const name = window._newGamePlayerName || captainNames[Math.floor((rng ? rng.random() : Math.random()) * captainNames.length)];
  p.name = name;

  // Starting gold
  const startGold = (typeof window._newGameStartGold === 'number') ? window._newGameStartGold : 100;
  p.gold = startGold;
  p._startingGold = startGold;

  // Starting items — clear defaults and apply config
  if (window._newGameStartItems && typeof window._newGameStartItems === 'object') {
    p.inventory.clear();
    for (const [itemName, qty] of Object.entries(window._newGameStartItems)) {
      if (qty > 0 && typeof ItemLibrary !== 'undefined' && ItemLibrary[itemName]) {
        p.addItem({ name: itemName, quantity: qty });
      }
    }
  }

  // Starting boat
  if (window._newGameStartBoat && typeof Boat !== 'undefined' && typeof BoatLibrary !== 'undefined') {
    const boatType = window._newGameStartBoat;
    if (BoatLibrary[boatType]) {
      const boat = new Boat(boatType);
      p.fleet.push(boat);
      p.activeBoat = boat;
    }
  }

  // Starting bag
  if (window._newGameStartBag && typeof BAGS !== 'undefined' && BAGS[window._newGameStartBag]) {
    const bagKey = window._newGameStartBag;
    p.addItem(ItemLibrary[bagKey], true);
    p.equipBag(bagKey);
  }
}

function _canRaidTraders() {
  return !!(player && player.inventory && player.inventory.has('Pirating101'));
}

function _isWaterTile(x, y) {
  return grid?.[y]?.[x]?.options?.[0] === 'Water';
}

function _isTraderRaidEligible(trader) {
  if (!trader || !player) return false;
  if (!player.activeBoat || !player.isSailing) return false;
  if (!trader.hasBoat) return false;
  // Treat as a boat encounter only when both are currently on water.
  if (!_isWaterTile(player.x, player.y)) return false;
  if (!_isWaterTile(trader.x, trader.y)) return false;
  return true;
}

function _buildTraderRaidEnemy(trader) {
  const cargoEntries = [...(trader.inventory || new Map()).entries()]
    .filter(([itemKey, entry]) => ItemLibrary[itemKey] && entry && entry.quantity > 0);

  const lootItems = [];
  for (let i = cargoEntries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = cargoEntries[i];
    cargoEntries[i] = cargoEntries[j];
    cargoEntries[j] = t;
  }
  for (const [itemKey, entry] of cargoEntries.slice(0, 3)) {
    const qty = Math.max(1, Math.min(entry.quantity, 1 + Math.floor(Math.random() * 3)));
    lootItems.push({ name: itemKey, quantity: qty });
  }

  const traderGold = Math.max(0, Math.floor(trader.gold || 0));
  const lootGold = Math.max(20, Math.floor(traderGold * (0.45 + Math.random() * 0.25)));
  const strength = Math.min(8, Math.max(2, 2 + Math.floor(cargoEntries.length / 2) + Math.floor(traderGold / 250)));

  return {
    name: `Trader ${trader.name}`,
    type: 'pirate',
    isPirate: true,
    strength,
    x: trader.x,
    y: trader.y,
    boat: trader.hasBoat ? 'sloop' : 'rowboat',
    loot: { gold: lootGold, items: lootItems },
    state: 'patrolling',
    path: [],
    _traderRef: trader,
  };
}

function _startTraderRaidEncounter(trader) {
  if (!trader || combatSystem?.active || !_isTraderRaidEligible(trader)) return;
  const enemy = _buildTraderRaidEnemy(trader);
  trader._raidCooldownUntil = Date.now() + 8000;
  combatSystem.startCombat(enemy);
}

function _applyPiracyReputationPenalty(x, y, major = false) {
  if (!Array.isArray(cities) || cities.length === 0) return;
  let affected = 0;
  for (const c of cities) {
    if (!c || typeof c.adjustReputation !== 'function') continue;
    const d = Math.abs((c.location?.x || 0) - x) + Math.abs((c.location?.y || 0) - y);
    if (major) {
      if (d <= 20) { c.adjustReputation(-6); affected++; }
      else if (d <= 40) { c.adjustReputation(-2); affected++; }
    } else {
      if (d <= 20) { c.adjustReputation(-2); affected++; }
    }
  }
  if (typeof notificationManager !== 'undefined' && affected > 0) {
    const msg = major
      ? `Word spreads: piracy hurts your standing with ${affected} nearby cities.`
      : `Your attempted piracy hurts your standing with ${affected} nearby cities.`;
    notificationManager.log(msg, 'warning');
  }
}

function _resolveTraderRaidOutcome(result) {
  const proxy = combatSystem?.raider;
  const trader = proxy?._traderRef;
  if (!trader) return;

  if (result === 'win') {
    _applyPiracyReputationPenalty(proxy.x, proxy.y, true);
    trader.state = 'dead';
    trader.path = [];
    if (typeof traderGrid !== 'undefined' && traderGrid && typeof traderGrid.remove === 'function') {
      traderGrid.remove(trader);
    }
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`You sank trader ${trader.name}'s vessel and seized their cargo.`, 'warning');
    }
    return;
  }

  _applyPiracyReputationPenalty(proxy.x, proxy.y, false);
  trader._raidCooldownUntil = Date.now() + 12000;
  if (trader.path && trader.path.length > 0) {
    const next = trader.path[0];
    trader.x = next.x;
    trader.y = next.y;
    trader.path.shift();
    if (typeof traderGrid !== 'undefined' && traderGrid && typeof traderGrid.move === 'function') {
      traderGrid.move(trader, trader.x, trader.y);
    }
  }
}

function _bindCombatEventHandlers() {
  if (!combatSystem || typeof combatSystem.on !== 'function') return;
  if (combatSystem._gameHandlersBound) return;
  combatSystem._gameHandlersBound = true;
  combatSystem.on('combatEnd', ({ result, loot } = {}) => {
    if (result === 'win') {
      sound?.playEffect?.('combatWin');
      try {
        const px = player.x * tileSize + tileSize / 2;
        const py = player.y * tileSize + tileSize / 2;
        // Spawn screen-space coin burst at HUD so loot is always visible (HUD may cover player)
        try {
          const el = document.getElementById('playerGold');
          const canvasEl = document.querySelector('canvas');
          if (el && particleSystem && canvasEl) {
            const r = el.getBoundingClientRect();
            const cvsRect = canvasEl.getBoundingClientRect();
            const sxCss = (r.left - cvsRect.left) + r.width/2;
            const syCss = (r.top - cvsRect.top) + r.height/2;
            const scale = (canvasEl && canvasEl.width && cvsRect.width) ? (canvasEl.width / cvsRect.width) : 1;
            particleSystem.spawnBurst(sxCss * scale, syCss * scale, { count: 36, color: '#ffd54f', size: 6, speed: 160, frame: 'Cash', screen: true });
          }
        } catch (e) { /* ignore UI mapping errors */ }
        startCameraShake(8, 350);
        // small HUD micro-shake (if present)
        const hud = document.getElementById('playerView');
        if (hud) {
          hud.classList.remove('hud-shake');
          // force reflow to restart animation
          void hud.offsetWidth;
          hud.classList.add('hud-shake');
        }
      } catch (e) { /* ignore if player not present */ }
    } else if (result === 'lose') {
      sound?.playEffect?.('combatLoss');
    }
    _resolveTraderRaidOutcome(result);
  });
}

function _cleanupRuntimeSystems() {
  if (cityManagement && typeof cityManagement.onExit === 'function') cityManagement.onExit();
  if (cities && Array.isArray(cities)) {
    for (const city of cities) {
      if (typeof city.destroy === 'function') city.destroy();
    }
  }
  if (player && typeof player.destroy === 'function') player.destroy();
  if (traderManager && typeof traderManager.destroy === 'function') traderManager.destroy();
  if (raiderManager && typeof raiderManager.destroy === 'function') raiderManager.destroy();
  if (eventSystem && typeof eventSystem.destroy === 'function') eventSystem.destroy();
  if (contractSystem && typeof contractSystem.destroy === 'function') contractSystem.destroy();
  if (bankingSystem && typeof bankingSystem.destroy === 'function') bankingSystem.destroy();
  if (bountyBoard && typeof bountyBoard.destroy === 'function') bountyBoard.destroy();
  if (minigameManager && typeof minigameManager.cancel === 'function') minigameManager.cancel();
  if (questSystem && typeof questSystem.destroy === 'function') questSystem.destroy();
  if (achievementSystem && typeof achievementSystem.destroy === 'function') achievementSystem.destroy();
  if (bearEmpireSystem && typeof bearEmpireSystem.destroy === 'function') bearEmpireSystem.destroy();

  traderManager = null;
  raiderManager = null;
  combatSystem = null;
  eventSystem = null;
  minigameManager = null;
  contractSystem = null;
  gamblingSystem = null;
  treasureSystem = null;
  bankingSystem = null;
  smugglingSystem = null;
  bountyBoard = null;
  tutorialSystem = null;
  cityManagement = null;
  questSystem = null;
  achievementSystem = null;
  bearEmpireSystem = null;
  levelEditor = null;
  _syncBearEmpireGlobals();
}

function ensureSpriteAssetsReady() {
  const hasCoreSprites = !!(SpriteSheet?.tiles && SpriteSheet?.city && SpriteSheet?.player && SpriteSheet?.trader
    && SpriteSheet?.raider && SpriteSheet?.icons && SpriteSheet?.boats && SpriteSheet?.decor);
  if (!hasCoreSprites) generateAllSprites();
  // Atlases are static for the session; register once unless explicitly reset.
  if (!window._atlasesRegistered) {
    registerAtlases();
    window._atlasesRegistered = true;
  }
}

let _menuPresentationHiddenAt = 0;

function isMenuPresentationState() {
  if (!gameStateManager) return false;
  if (gameStateManager.is(GameStates.SETTINGS)) {
    return gameStateManager.prev === GameStates.MAIN_MENU;
  }
  return gameStateManager.is(GameStates.MAIN_MENU)
    || gameStateManager.is(GameStates.NEW_GAME_CONFIG)
    || gameStateManager.is(GameStates.CREDITS)
    || gameStateManager.is(GameStates.INFO);
}

function renderMenuPresentationFrame() {
  background(10);
  if (typeof queueMenuPresentationWarmup === 'function') {
    queueMenuPresentationWarmup('render');
  }
  updateMenuMap();
  renderMenuMap();
  menuTicker.update();
  menuTicker.render();
}

function recoverMenuPresentationAssets(reason = "resume") {
  try {
    const menuLikeState = isMenuPresentationState();
    if (!menuLikeState) return;

    if (typeof registerAtlases === 'function') {
      registerAtlases();
      window._atlasesRegistered = true;
    }
    if (typeof warmMenuPresentationAssets === 'function') {
      warmMenuPresentationAssets();
    } else if (typeof initMenuMap === 'function') {
      initMenuMap();
    }
    if (typeof window.BQRefreshMenuLogoImages === 'function') {
      window.BQRefreshMenuLogoImages(true);
    }
  } catch (e) {
    _reportRuntimeError(`recoverMenuPresentationAssets.${reason}`, e);
  }
}

function installMenuPresentationRecoveryHooks() {
  if (window._menuPresentationRecoveryInstalled) return;
  window._menuPresentationRecoveryInstalled = true;

  const maybeRecover = (reason) => {
    const hiddenFor = _menuPresentationHiddenAt > 0 ? (Date.now() - _menuPresentationHiddenAt) : 0;
    _menuPresentationHiddenAt = 0;
    if (hiddenFor >= 15000) recoverMenuPresentationAssets(reason);
  };

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        _menuPresentationHiddenAt = Date.now();
      } else {
        maybeRecover('visibilitychange');
      }
    });
  }
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pageshow', () => maybeRecover('pageshow'));
    window.addEventListener('focus', () => maybeRecover('focus'));
  }
}

/**
 * Run an immediate win/lose validation after world bootstrap.
 * This covers paths that do not pass through PLAYING on first state (e.g. restoring CITY_MANAGE).
 */
function runInitialEndConditionCheck(context = 'startup') {
  try {
    if (!worldInitialized || typeof player === 'undefined' || !player || typeof player.checkEndConditions !== 'function') return;
    player.checkEndConditions(true);
  } catch (e) {
    _reportRuntimeError(`runInitialEndConditionCheck.${context}`, e);
  }
}

/**
 * Start a brand new game with the given map dimensions.
 * Async so the loading overlay can update between heavy steps.
 * @param {number} mapCols - grid columns
 * @param {number} mapRows - grid rows
 */
async function startNewGame(mapCols, mapRows) {
  // ── If a custom editor map is selected, use that instead ──
  if (window._newGameCustomMap) {
    _ensureEditorEngineModules();
    const tempEditor = new LevelEditor();
    if (!tempEditor.loadFromStorage(window._newGameCustomMap)) {
      alert(`Could not load custom map "${window._newGameCustomMap}"`);
      return;
    }
    levelEditor = tempEditor;
    await startGameFromEditor();
    return;
  }

  showLoadingOverlay('Preparing world...');
  await yieldFrame();
  updateLoadingOverlay('Loading gameplay systems...', 4);
  await yieldFrame();
  _ensureGameplayEngineModules();

  // Clean up stale UI elements from previous session
  select("#travelMapWindow")?.remove();
  window._invLastFingerprint = null;

  // === Cleanup previous game objects to prevent event listener leaks ===
  _cleanupRuntimeSystems();
  resetWorldSessions();

  worldInitialized = false;

  // Set global map dimensions
  cols = mapCols;
  rows = mapRows;

  // Reset global arrays
  grid = [];
  elevationMap = [];
  difficultyMap = [];
  temperatureMap = [];

  // Scale city count with map area, or use custom count from UI
  const mapArea = cols * rows;
  // Safety cap for huge maps: keeps CPU/memory stable on generation and runtime updates.
  const MAX_SAFE_CITIES = 600;
  const autoCities = Math.min(MAX_SAFE_CITIES, Math.max(20, Math.floor(mapArea / 900)));
  const cityCount = (typeof window._newGameCityCount === 'number' && window._newGameCityCount > 0)
    ? Math.min(window._newGameCityCount, Math.floor(mapArea / 10), MAX_SAFE_CITIES) // map-fit + safety cap
    : autoCities;

  // Generate map seed
  if (typeof window._newGameSeed === 'number' && Number.isFinite(window._newGameSeed)) {
    window._mapSeed = Math.floor(Math.abs(window._newGameSeed));
  } else {
    window._mapSeed = floor(random(100000));
  }
  window._savedRngState = null;
  window._isCustomMap = false;
  if (window.BQSeededRNG && typeof window.BQSeededRNG.startRun === 'function') {
    window.BQSeededRNG.startRun(window._mapSeed, { installGlobalMathRandom: true, globalStreamName: 'global' });
  }
  if (typeof window.BQConfigureSpaceWorldGraph === 'function') {
    window.BQConfigureSpaceWorldGraph(window._mapSeed);
  }
  noiseSeed(window._mapSeed);

  // Generate names — pool scales with city count
  const nameCount = Math.max(80, cityCount + 20);
  const namePoolForGame = NameGenerator.generateNames(nameCount, nameCount);

  updateLoadingOverlay(`Generating terrain (${cols}×${rows})...`, 10);
  await yieldFrame();
  await initTerrainWorker(); // runs in Web Worker — main thread free to repaint loading bar

  updateLoadingOverlay(`Placing ${cityCount} cities...`, 35);
  await yieldFrame();
  cities = City.generateCities(grid, cityCount, namePoolForGame);
  for (const city of cities) city.addInventoryBasedOnTerrain(grid, 1);

  // Detect coastal cities and set port flags
  City.detectCoastalCities(cities, grid, rows, cols);
  portCityLocations = cities.filter(c => c.isCoastal).map(c => c.location);
  buildCityLocationMap();

  updateLoadingOverlay('Spawning player...', 55);
  await yieldFrame();
  dayNight = _createDayNightCycle(CYCLEVALUE);

  const safeNode = findSafeNode();
  if (!safeNode) { console.error('No safe spawn found!'); hideLoadingOverlay(); return; }
  let { x: startX, y: startY } = safeNode;
  player = new Player(grid, startX, startY);

  // ── Apply difficulty config ──
  window.DIFFICULTY_CONFIG = getDifficultyConfig(window._newGameDifficulty || 'normal');

  // ── Apply new-game config to player ──
  applyNewGameConfig(player);

  updateLoadingOverlay('Preparing visual assets...', 65);
  await yieldFrame();
  ensureSpriteAssetsReady();

  // Init notification manager
  notificationManager = _createNotificationManager();

  updateLoadingOverlay('Initializing traders & raiders...', 75);
  await yieldFrame();
  traderManager = new TraderManager();
  traderManager.init();

  raiderManager = new RaiderManager();
  raiderManager.init();

  // Apply custom settings if set
  if (typeof window._newGameRaiderInterval === 'number') {
    raiderManager.spawnIntervalDays = window._newGameRaiderInterval;
  }

  combatSystem = new CombatSystem();
  _bindCombatEventHandlers();
  eventSystem = _createEventSystem();
  if (typeof window._newGameEventChance === 'number') {
    eventSystem.eventChance = window._newGameEventChance;
  }

  // Initialize new economy / meta systems
  minigameManager = _ensureRuntimeMinigameManager(minigameManager);
  contractSystem = new ContractSystem();
  gamblingSystem = new GamblingSystem();
  treasureSystem = new TreasureSystem();
  bankingSystem = new BankingSystem();
  smugglingSystem = new SmugglingSystem();
  bountyBoard = new BountyBoard();
  tutorialSystem = _createTutorialSystem();
  questSystem = (typeof QuestSystem !== 'undefined') ? new QuestSystem() : null;
  achievementSystem = (typeof AchievementSystem !== 'undefined') ? new AchievementSystem() : null;
  if (achievementSystem) achievementSystem.resetRunStats();
  _createBearEmpireSystem();

  updateLoadingOverlay('Rendering minimap...', 85);
  await yieldFrame();
  generateMinimap();

  // Invalidate offscreen map buffer so it rebuilds with new terrain
  if (typeof invalidateMapBuffer === 'function') invalidateMapBuffer();

  updateLoadingOverlay('Ready!', 100);
  await yieldFrame();

  _tuneAIForMapSize();
  rebuildSpatialGrids();
  worldInitialized = true;
  _resetSpawnGracePeriod();
  hideLoadingOverlay();
  // Expose let-scoped globals so player.ownsCity / addOwnedCity work in adventure mode
  window.player = player;
  window.cities = cities;
  registerCurrentWorldSession(BQ_WORLD_SESSION_KEYS.HOMEWORLD, { label: 'Earth' });
  window.questSystem = questSystem;
  window.achievementSystem = achievementSystem;
  gameStateManager.setState(GameStates.PLAYING);

  // If City Management Mode was toggled, switch to CITY_MANAGE
  if (window._newGameCityManageMode) {
    _enterCityManageMode();
  } else if (tutorialSystem) {
    // Show startup guide for new game (slight delay so the world renders first)
    setTimeout(() => {
      try { tutorialSystem.showStartupGuide(); } catch (_) { /* ignore if tutorial fails */ }
    }, 600);
  }
  runInitialEndConditionCheck('startNewGame');
}

/**
 * Shared helper — transitions the current game into City Management mode.
 * Called after startNewGame / startGameFromEditor when the toggle is on.
 * The player entity is hidden; the user pans the camera freely and clicks to settle.
 */
function _enterCityManageMode() {
  if (gameStateManager && (gameStateManager.is(GameStates.GAMEWON) || gameStateManager.is(GameStates.GAMELOSE))) return;
  window._isCityManageMode = true;

  // Expose let-scoped globals on window so CityManagement can access them
  window.player = player;
  window.cities = cities;
  window.grid = grid;
  if (typeof cityLocationMap !== 'undefined') window.cityLocationMap = cityLocationMap;

  // Initialise the CityManagement controller with the live world
  cityManagement = _createCityManagementController();

  // Give every city a starting budget so the AI cities are active
  if (cities && Array.isArray(cities)) {
    for (const c of cities) {
      c.management = c.management || { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [], units: [], ownerPayoutDue: 0, ownerTaxShare: 0.35 };
      const cmRng = (window.BQSeededRNG && window.BQSeededRNG.stream)
        ? window.BQSeededRNG.stream('citymanage:init')
        : null;
      c.management.budget = Math.floor(c.population * 2 + (cmRng ? cmRng.random() : Math.random()) * 200);
      if (!Array.isArray(c.management.routes)) c.management.routes = [];
      if (!Array.isArray(c.management.units)) c.management.units = [];
    }
  }

  // Reset camera pan offset for management mode — start centered on the map
  window._cityMgmtCamOffX = 0;
  window._cityMgmtCamOffY = 0;

  // Place camera at center of map for browsing
  camX = (cols / 2) * tileSize;
  camY = (rows / 2) * tileSize;
  targetCamX = camX;
  targetCamY = camY;

  // Starting budget for the player's future city (not tied to player gold)
  window._cityMgmtStartingBudget = 600;
  window._cityViewOpen = false;

  gameStateManager.setState(GameStates.CITY_MANAGE);

  if (notificationManager) {
    notificationManager.log(
      `City Management mode! Pan the map (${getActionDisplay('moveUp')} / ${getActionDisplay('moveDown')} / ${getActionDisplay('moveLeft')} / ${getActionDisplay('moveRight')}) and click a tile to settle your city.`,
      'success'
    );
  }
  // Mark player as being in city-mode (until settled) to avoid player-targeted combat
  try {
    if (typeof player !== 'undefined' && player) {
      player.currentCity = (cityManagement && cityManagement.isSettled && cityManagement.myCity) ? cityManagement.myCity : true;
    }
  } catch (e) {
    _reportRuntimeError('_startCityManageMode.playerSync', e);
  }
}

/**
 * Restore City Management mode from a saved game.
 * Called by loadExistingGame() when the save has _isCityManageMode = true.
 */
function _restoreCityManageMode() {
  window._isCityManageMode = true;
  const restoringAdventureCityManage = !!window._savedAdventureCityManage;

  // Expose let-scoped globals on window so CityManagement can access them
  window.player = player;
  window.cities = cities;
  window.grid = grid;
  if (typeof cityLocationMap !== 'undefined') window.cityLocationMap = cityLocationMap;

  // Restore CityManagement controller from saved data
  if (typeof CityManagement !== 'undefined') {
    const savedData = window._savedCityManagementData || null;
    if (savedData) {
      cityManagement = CityManagement.fromJSON(savedData, window, {
        notificationManager,
        gameStateManager,
        GameStates,
        dayNight,
        minigameManager,
        raiderManager,
      });
    } else {
      cityManagement = _createCityManagementController();
    }
  }
  window._savedCityManagementData = null; // clean up

  // Ensure city management objects are set up
  if (cities && Array.isArray(cities)) {
    for (const c of cities) {
      c.management = c.management || { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [], units: [], ownerPayoutDue: 0, ownerTaxShare: 0.35 };
      if (!Array.isArray(c.management.routes)) c.management.routes = [];
      if (!Array.isArray(c.management.units)) c.management.units = [];
    }
  }

  // Reconcile city reference for adventure-owned-city management restores.
  if (restoringAdventureCityManage && cityManagement && cityManagement.isSettled && cityManagement.myCity && player) {
    const resolvedMyCity = _resolveOwnedCityRef(cityManagement.myCity) || cityManagement.myCity;
    const idx = Array.isArray(cities) ? cities.indexOf(resolvedMyCity) : -1;
    if (idx >= 0) {
      cityManagement.myCity = resolvedMyCity;
      cityManagement.myCityIndex = idx;
      if (typeof cityManagement.selectCity === 'function') cityManagement.selectCity(resolvedMyCity);
      if (Array.isArray(player.ownedCities) && !player.ownedCities.includes(idx)) {
        player.ownedCities.push(idx);
      }
    }
  }

  // Reset camera offsets
  window._cityMgmtCamOffX = 0;
  window._cityMgmtCamOffY = 0;

  // If settled, lock camera to city
  if (cityManagement && cityManagement.isSettled && cityManagement.myCity) {
    const loc = cityManagement.myCity.location;
    camX = loc.x * tileSize + tileSize / 2;
    camY = loc.y * tileSize + tileSize / 2;
    targetCamX = camX;
    targetCamY = camY;
  }

  gameStateManager.setState(GameStates.CITY_MANAGE);
  window._cityViewOpen = false;

  // Clear the temporary saved-mode flag after restore to prevent stale flags
  window._savedIsCityManageMode = false;

  if (notificationManager) {
    if (cityManagement && cityManagement.isSettled) {
      notificationManager.log(`City Management restored — managing ${cityManagement.myCity?.name || 'your city'}.`, 'success');
    } else {
      notificationManager.log('City Management restored — pan the map and click to settle.', 'success');
    }
  }
  // Restore adventure-city-manage round-trip flag if applicable
  if (window._savedAdventureCityManage) {
    window._adventureCityManage = true;
    window._playerPreCityPos = window._savedPlayerPreCityPos || null;
    window._savedAdventureCityManage = false;
    window._savedPlayerPreCityPos = null;
  }
  // Ensure player.currentCity is set when restoring into city manage
  // Use `true` sentinel pre-settle so raiders won't chase the dormant player entity
  try {
    if (typeof player !== 'undefined' && player) {
      player.currentCity = (cityManagement && cityManagement.isSettled && cityManagement.myCity) ? cityManagement.myCity : true;
      // Sync player position to city location so raider detection uses city coords
      if (cityManagement && cityManagement.isSettled && cityManagement.myCity) {
        const loc = cityManagement.myCity.location;
        player.x = loc.x;
        player.y = loc.y;
      }
    }
  } catch (e) {
    _reportRuntimeError('_restoreCityManageMode.playerSync', e);
  }
}

/**
 * Centralized exit logic for City Management mode.
 * Clears global flags and transient references so other systems don't return to city mode unexpectedly.
 */
function _exitCityManageMode() {
  // Clear global city-mode marker
  window._isCityManageMode = false;
  // Remove any saved payload that would trigger a restore
  window._savedCityManagementData = null;
  // Clear the saved-mode flag so combat/events don't incorrectly return to city mode
  window._savedIsCityManageMode = false;

  // Clear player-city linkage used to suppress player-targeted combat
  try {
    if (typeof player !== 'undefined' && player && player.currentCity) {
      player.currentCity = null;
    }
  } catch (e) {
    _reportRuntimeError('_exitCityManageMode.clearPlayerCity', e);
  }
  window._cityViewOpen = false;

  // Let the controller know (if it exposes an exit hook)
  try {
    if (typeof cityManagement !== 'undefined' && cityManagement && typeof cityManagement.onExit === 'function') {
      cityManagement.onExit();
    }
  } catch (e) {
    _reportRuntimeError('_exitCityManageMode.onExit', e);
  }

  // City Management is a standalone mode — return to the main menu, not PLAYING.
  // Going to PLAYING would activate the dormant player entity that was spawned
  // during world generation, causing it to appear on the map unexpectedly.
  if (typeof gameStateManager !== 'undefined') {
    gameStateManager.setState(GameStates.MAIN_MENU);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  ADVENTURE-MODE CITY OWNERSHIP — round-trip PLAYING ↔ CITY_MANAGE
// ═══════════════════════════════════════════════════════════════════

function _resolveOwnedCityRef(city) {
  if (!player || !Array.isArray(cities) || !city) return null;
  if (typeof player.ownsCity === 'function' && player.ownsCity(city)) return city;
  const cx = Number(city?.location?.x);
  const cy = Number(city?.location?.y);
  const cn = city?.name;
  const owned = (typeof player.getOwnedCities === 'function')
    ? player.getOwnedCities()
    : (Array.isArray(player.ownedCities) ? player.ownedCities.map((i) => cities[i]).filter(Boolean) : []);
  if (Number.isFinite(cx) && Number.isFinite(cy)) {
    const byLoc = owned.find((c) => c?.location?.x === cx && c?.location?.y === cy);
    if (byLoc) return byLoc;
  }
  if (cn) {
    const byName = owned.find((c) => c?.name === cn);
    if (byName) return byName;
  }
  return null;
}

/**
 * Enter city management view for a city the player owns while in adventure mode.
 * The player's state is preserved; they can return to PLAYING via _returnToAdventure().
 */
function _enterOwnedCityManagement(city) {
  try {
    if (!city || !player || !Array.isArray(cities) || typeof player.ownsCity !== 'function') return;
    const resolvedCity = _resolveOwnedCityRef(city);
    if (!resolvedCity || !player.ownsCity(resolvedCity)) return;
    if (!resolvedCity.location || typeof resolvedCity.location.x !== 'number' || typeof resolvedCity.location.y !== 'number') return;
    if (gameStateManager && gameStateManager.is(GameStates.GAMELOSE)) return;

    // Save player position so we can restore it on return
    window._playerPreCityPos = { x: player.x, y: player.y };
    window._adventureCityManage = true;
    window._isCityManageMode = true;

    // Expose let-scoped globals on window so CityManagement can access them
    window.player = player;
    window.cities = cities;
    window.grid = grid;
    if (typeof cityLocationMap !== 'undefined') window.cityLocationMap = cityLocationMap;

    // Initialise or reuse the CityManagement controller
    if (!cityManagement && typeof _createCityManagementController === 'function') {
      cityManagement = _createCityManagementController();
    }
    if (!cityManagement || typeof cityManagement.selectCity !== 'function') {
      throw new Error('City management controller is unavailable');
    }

    // Ensure all cities have management objects
    for (const c of cities) {
      if (!c) continue;
      c.management = c.management || { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [], units: [], ownerPayoutDue: 0, ownerTaxShare: 0.35 };
      if (!Array.isArray(c.management.routes)) c.management.routes = [];
      if (!Array.isArray(c.management.units)) c.management.units = [];
    }

    // Point the controller at the selected owned city
    const idx = cities.indexOf(resolvedCity);
    cityManagement.myCity = resolvedCity;
    cityManagement.myCityIndex = idx;
    cityManagement.isSettled = true;
    cityManagement.selectCity(resolvedCity);

    // Camera setup — anchor to the city
    window._cityMgmtCamOffX = 0;
    window._cityMgmtCamOffY = 0;
    const loc = resolvedCity.location;
    camX = loc.x * tileSize + tileSize / 2;
    camY = loc.y * tileSize + tileSize / 2;
    targetCamX = camX;
    targetCamY = camY;

    // Suppress player combat/food while in management view.
    window._cityViewOpen = false;
    player.currentCity = resolvedCity;

    gameStateManager.setState(GameStates.CITY_MANAGE);

    if (notificationManager) {
      notificationManager.log(`Managing ${resolvedCity.name}. Use the panel to build & manage. Click "Return to Adventure" to leave.`, 'success');
    }
  } catch (e) {
    _reportRuntimeError('_enterOwnedCityManagement', e);
  }
}

/**
 * Return from city management view back to adventure mode (surface gameplay state).
 * Player reappears at the city tile they were managing.
 */
function _returnToAdventure() {
  const snapshot = {
    x: player?.x,
    y: player?.y,
    currentCity: player?.currentCity,
    isCityManageMode: !!window._isCityManageMode,
    adventureCityManage: !!window._adventureCityManage,
    camOffX: window._cityMgmtCamOffX || 0,
    camOffY: window._cityMgmtCamOffY || 0,
    foundingMode: !!window._cityMgmtFoundingMode,
  };
  let transitionSucceeded = false;
  try {
    if (!player) throw new Error('Player missing while leaving city management');

    // Restore player position at the city they were managing
    if (cityManagement && cityManagement.myCity && cityManagement.myCity.location) {
      const loc = cityManagement.myCity.location;
      player.x = loc.x;
      player.y = loc.y;
    } else if (window._playerPreCityPos) {
      player.x = window._playerPreCityPos.x;
      player.y = window._playerPreCityPos.y;
    }

    // Validate transition first so mode flags are only cleared on success.
    const returnState = _getSurfaceGameplayState();
    gameStateManager.setState(returnState);
    if (!gameStateManager.is(returnState)) {
      throw new Error(`Transition to ${returnState} failed (current: ${gameStateManager.currentState})`);
    }
    transitionSucceeded = true;

    // Clear city mode flags
    window._isCityManageMode = false;
    window._adventureCityManage = false;
    window._cityMgmtCamOffX = 0;
    window._cityMgmtCamOffY = 0;
    window._cityMgmtFoundingMode = false;

    // Re-enable player systems
    player.currentCity = null;
    window._cityViewOpen = false;

    // Snap camera to player
    camX = player.x * tileSize + tileSize / 2;
    camY = player.y * tileSize + tileSize / 2;
    targetCamX = camX;
    targetCamY = camY;

    if (notificationManager) {
      notificationManager.log('Returned to adventure. Your cities continue operating in the background.', 'info');
    }
  } catch (e) {
    // Only roll back when the transition did not complete.
    if (!transitionSucceeded) {
      try {
        if (player) {
          if (typeof snapshot.x === 'number') player.x = snapshot.x;
          if (typeof snapshot.y === 'number') player.y = snapshot.y;
          player.currentCity = snapshot.currentCity;
        }
        window._isCityManageMode = snapshot.isCityManageMode;
        window._adventureCityManage = snapshot.adventureCityManage;
        window._cityMgmtCamOffX = snapshot.camOffX;
        window._cityMgmtCamOffY = snapshot.camOffY;
        window._cityMgmtFoundingMode = snapshot.foundingMode;
        if (gameStateManager && !gameStateManager.is(GameStates.CITY_MANAGE)) {
          gameStateManager.setState(GameStates.CITY_MANAGE);
        }
      } catch (rollbackErr) {
        _reportRuntimeError('_returnToAdventure.rollback', rollbackErr);
      }
    }
    _reportRuntimeError('_returnToAdventure', e);
  }
}

/**
 * Found a new player-owned city at the player's current position (adventure mode).
 * Costs 5000 gold from the player's personal gold.
 * @param {string} [name] - optional city name
 * @returns {{ok:boolean, city?:City, reason?:string}}
 */
function foundPlayerCityAdventure(name) {
  const FOUND_COST = 5000;
  if (!player || player.gold < FOUND_COST) {
    return { ok: false, reason: 'no_gold' };
  }
  const gx = player.x;
  const gy = player.y;
  if (!grid || !grid[gy] || !grid[gy][gx]) return { ok: false, reason: 'out_of_bounds' };
  if (grid[gy][gx].options[0] === 'Water') return { ok: false, reason: 'water' };
  if (cityLocationMap && cityLocationMap.has(`${gx},${gy}`)) return { ok: false, reason: 'occupied' };

  const cityName = name || `Settlement ${Math.floor(Math.random() * 1000)}`;
  const newCity = new City({
    name: cityName,
    location: { x: gx, y: gy },
    population: 100,
    stockProfile: 'founded',
  });
  if (typeof newCity.applyFoundedSettlementProfile === 'function') {
    newCity.applyFoundedSettlementProfile({ starterSupplies: { Wheat: 30 } });
  }
  if (typeof newCity.refreshCoastalStatus === 'function') {
    newCity.refreshCoastalStatus(grid);
    if (newCity.isCoastal && Array.isArray(portCityLocations)
        && !portCityLocations.some((loc) => Number(loc?.x) === gx && Number(loc?.y) === gy)) {
      portCityLocations.push({ x: gx, y: gy });
    }
  }
  newCity.management = { budget: 500, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [], units: [], ownerPayoutDue: 0, ownerTaxShare: 0.35 };
  newCity._isManagedCity = true;

  cities.push(newCity);
  if (typeof buildCityLocationMap === 'function') buildCityLocationMap();
  if (typeof rebuildSpatialGrids === 'function') rebuildSpatialGrids();

  // Spend gold AFTER city is created so nothing is lost on failure
  player.spendGold(FOUND_COST);
  player.addOwnedCity(newCity);

  if (notificationManager) {
    notificationManager.log(`Founded ${cityName}! (-${FOUND_COST}g) Walk away and it will grow on its own. Return to manage it.`, 'success');
  }
  return { ok: true, city: newCity };
}

function _tryCrownPlayerAsKing() {
  if (!player || player.isKing || !Array.isArray(cities) || cities.length === 0) return false;
  if ((player.ownedCities || []).length < cities.length) return false;
  player.isKing = true;
  if (notificationManager) {
    notificationManager.log(`\uD83D\uDC51 The realm crowns you King! You now control every city.`, 'success');
  }
  return true;
}

/**
 * Buy an existing NPC city in adventure mode.
 * Player must be standing on the city. Acquisition is staged:
 * convince owner -> buy bank -> buy buildings -> buy main shop.
 * @param {City} city - the city to buy
 * @returns {{ok:boolean, reason?:string, step?:string, crownedKing?:boolean}}
 */
function buyExistingCity(city) {
  if (!city) return { ok: false, reason: 'no_city' };
  if (player.ownsCity(city)) return { ok: false, reason: 'already_owned' };
  if (!city.getOwnershipAcquisitionState || !city.tryOwnershipOffer || !city.completeOwnershipStage) {
    return { ok: false, reason: 'invalid_city' };
  }

  const state = city.getOwnershipAcquisitionState(player);
  if (state.stepKey === 'offer') {
    const offer = city.tryOwnershipOffer(player);
    if (!offer.ok) {
      return { ok: false, reason: offer.reason || 'offer_rejected', requirement: offer.requirement, score: offer.score };
    }
    const nextState = city.getOwnershipAcquisitionState(player);
    if (notificationManager) {
      notificationManager.log(
        `${city.ownership?.ownerName || 'The owner'} accepts your offer. Next: ${nextState.stepLabel} for ${nextState.cost}g.`,
        'success'
      );
    }
    return { ok: true, step: 'offer' };
  }

  const stepCost = Math.max(0, Math.floor(state.cost || 0));
  if (!player || player.gold < stepCost) return { ok: false, reason: 'no_gold', needed: stepCost };
  city.completeOwnershipStage(state.stepKey);
  if (stepCost > 0) player.spendGold(stepCost);

  if (notificationManager) {
    notificationManager.log(`Purchased ${state.stepLabel} in ${city.name} for ${stepCost}g.`, 'success');
  }

  let crownedKing = false;
  const now = city.getOwnershipAcquisitionState(player);
  if (now.stepKey === 'complete') {
    const added = player.addOwnedCity(city);
    if (!added) return { ok: false, reason: 'already_owned' };
    crownedKing = _tryCrownPlayerAsKing();
    if (notificationManager) {
      notificationManager.log(`Purchased ${city.name}. You now own the city.`, 'success');
    }
  }
  return { ok: true, step: state.stepKey, crownedKing };
}

/**
 * Start a game from the level editor's custom map.
 */
async function startGameFromEditor() {
  if (!levelEditor) return;
  const result = levelEditor.exportToGame();
  if (result.error) {
    alert(result.error);
    return;
  }
  window._isCustomMap = true;
  const editorSeed = (typeof window._mapSeed === 'number' && Number.isFinite(window._mapSeed))
    ? window._mapSeed
    : Math.floor(Date.now() % 1000000000);
  window._mapSeed = editorSeed;
  if (window.BQSeededRNG && typeof window.BQSeededRNG.startRun === 'function') {
    window.BQSeededRNG.startRun(editorSeed, { installGlobalMathRandom: true, globalStreamName: 'global' });
  }
  if (typeof window.BQConfigureSpaceWorldGraph === 'function') {
    window.BQConfigureSpaceWorldGraph(editorSeed);
  }

  showLoadingOverlay('Building custom world...');
  await yieldFrame();
  updateLoadingOverlay('Loading gameplay systems...', 12);
  await yieldFrame();
  _ensureGameplayEngineModules();

  // Clean up
  select("#travelMapWindow")?.remove();
  window._invLastFingerprint = null;
  _cleanupRuntimeSystems();
  resetWorldSessions();
  worldInitialized = false;

  // Grid was already populated by exportToGame()
  cities = result.cities;
  for (const city of cities) city.addInventoryBasedOnTerrain(grid, 1);
  portCityLocations = cities.filter(c => c.isCoastal).map(c => c.location);
  buildCityLocationMap();

  updateLoadingOverlay('Spawning player...', 50);
  await yieldFrame();
  dayNight = _createDayNightCycle(CYCLEVALUE);
  player = new Player(grid, result.startX, result.startY);

  // ── Apply difficulty config ──
  window.DIFFICULTY_CONFIG = getDifficultyConfig(window._newGameDifficulty || 'normal');

  // ── Apply new-game config to player ──
  applyNewGameConfig(player);

  updateLoadingOverlay('Preparing visual assets...', 65);
  await yieldFrame();
  ensureSpriteAssetsReady();
  notificationManager = _createNotificationManager();

  updateLoadingOverlay('Initializing traders & raiders...', 75);
  await yieldFrame();
  traderManager = new TraderManager();
  traderManager.init();
  raiderManager = new RaiderManager();
  raiderManager.init();
  // Add editor-placed raider/monster spawns
  if (result.raiderSpawns && result.raiderSpawns.length > 0) {
    for (const spawn of result.raiderSpawns) {
      const patrolPoints = [
        { x: spawn.x, y: spawn.y },
        { x: Math.min(spawn.x + 5, cols - 1), y: spawn.y },
        { x: spawn.x, y: Math.min(spawn.y + 5, rows - 1) },
      ];
      const raider = new Raider({
        x: spawn.x,
        y: spawn.y,
        strength: spawn.strength,
        patrolPoints: patrolPoints,
        type: spawn.type,
        isPirate: spawn.isPirate,
        name: spawn.name,
      });
      raiderManager.raiders.push(raider);
    }
  }
  if (typeof window._newGameRaiderInterval === 'number') {
    raiderManager.spawnIntervalDays = window._newGameRaiderInterval;
  }
  combatSystem = new CombatSystem();
  _bindCombatEventHandlers();
  eventSystem = _createEventSystem();
  if (typeof window._newGameEventChance === 'number') {
    eventSystem.eventChance = window._newGameEventChance;
  }

  // Initialize new economy / meta systems
  minigameManager = _ensureRuntimeMinigameManager(minigameManager);
  contractSystem = new ContractSystem();
  gamblingSystem = new GamblingSystem();
  treasureSystem = new TreasureSystem();
  bankingSystem = new BankingSystem();
  smugglingSystem = new SmugglingSystem();
  bountyBoard = new BountyBoard();
  tutorialSystem = _createTutorialSystem();
  _createBearEmpireSystem();

  updateLoadingOverlay('Rendering minimap...', 85);
  await yieldFrame();
  generateMinimap();
  if (typeof invalidateMapBuffer === 'function') invalidateMapBuffer();

  updateLoadingOverlay('Ready!', 100);
  await yieldFrame();
  _tuneAIForMapSize();
  rebuildSpatialGrids();
  worldInitialized = true;
  _resetSpawnGracePeriod();
  hideLoadingOverlay();
  // Expose let-scoped globals so player.ownsCity / addOwnedCity work in adventure mode
  window.player = player;
  window.cities = cities;
  registerCurrentWorldSession(BQ_WORLD_SESSION_KEYS.HOMEWORLD, { label: 'Earth' });
  gameStateManager.setState(GameStates.PLAYING);

  // If City Management Mode was toggled, switch to CITY_MANAGE
  if (window._newGameCityManageMode) {
    _enterCityManageMode();
  } else if (tutorialSystem) {
    // Show startup guide for custom map game
    setTimeout(() => tutorialSystem.showStartupGuide(), 600);
  }
  runInitialEndConditionCheck('startGameFromEditor');
}

/**
 * Load an existing save and start playing.
 */
async function loadExistingGame() {
  if (typeof SaveSystem !== 'undefined' && SaveSystem.hasSave()) {
    showLoadingOverlay('Loading save...');
    await yieldFrame();
    updateLoadingOverlay('Loading gameplay systems...', 4);
    await yieldFrame();
    _ensureGameplayEngineModules();

    // Clean up stale UI elements from previous session
    select("#travelMapWindow")?.remove();
    window._invLastFingerprint = null;

    // === Cleanup previous game objects to prevent event listener leaks ===
    _cleanupRuntimeSystems();
    resetWorldSessions();

    worldInitialized = false;

    // Reset global arrays before load
    grid = [];
    elevationMap = [];
    difficultyMap = [];
    temperatureMap = [];

    // Pre-initialize globals so SaveSystem.load() can write into them
    cities = [];
    dayNight = _createDayNightCycle(CYCLEVALUE);
    player = new Player([], 0, 0);  // temporary; load() will overwrite position
    notificationManager = _createNotificationManager();

    updateLoadingOverlay('Regenerating terrain...', 10);
    await yieldFrame();

    // SaveSystem.load() restores cols, rows, terrain (via initTerrainWorker), cities, player, etc.
    const loadSuccess = await SaveSystem.load();
    if (!loadSuccess) {
      console.error('Failed to load save game');
      hideLoadingOverlay();
      return;
    }
    player.grid = grid;
    if (window.BQSeededRNG && typeof window.BQSeededRNG.setState === 'function' && window._savedRngState) {
      window.BQSeededRNG.setState(window._savedRngState);
    } else if (window.BQSeededRNG && typeof window.BQSeededRNG.startRun === 'function') {
      window.BQSeededRNG.startRun((typeof window._mapSeed === 'number' && Number.isFinite(window._mapSeed)) ? window._mapSeed : 0, { installGlobalMathRandom: true, globalStreamName: 'global' });
    }
    if (typeof window.BQConfigureSpaceWorldGraph === 'function') {
      window.BQConfigureSpaceWorldGraph((typeof window._mapSeed === 'number' && Number.isFinite(window._mapSeed)) ? window._mapSeed : 0);
    }
    window._savedRngState = null;

    updateLoadingOverlay('Initializing systems...', 45);
    await yieldFrame();

    // Init subsystems that may not have been created by load
    if (!traderManager) traderManager = new TraderManager();
    if (!raiderManager) raiderManager = new RaiderManager();
    if (!combatSystem) {
      combatSystem = new CombatSystem();
      _bindCombatEventHandlers();
    }
    if (!eventSystem) eventSystem = _createEventSystem();

    // Initialize new systems (load will overwrite with saved data if present)
    minigameManager = _ensureRuntimeMinigameManager(minigameManager);
    if (!contractSystem) contractSystem = new ContractSystem();
    if (!gamblingSystem) gamblingSystem = new GamblingSystem();
    if (!treasureSystem) treasureSystem = new TreasureSystem();
    if (!bankingSystem) bankingSystem = new BankingSystem();
    if (!smugglingSystem) smugglingSystem = new SmugglingSystem();
    if (!bountyBoard) bountyBoard = new BountyBoard();
    if (!tutorialSystem) tutorialSystem = _createTutorialSystem();
    _createBearEmpireSystem(window._savedBearEmpireData || null);

    updateLoadingOverlay('Preparing visual assets...', 60);
    await yieldFrame();
    ensureSpriteAssetsReady();

    // Use saved coastal data when available; fallback to recomputing for older saves.
    if (!window._saveHasCoastalData) {
      City.detectCoastalCities(cities, grid, rows, cols);
      portCityLocations = cities.filter(c => c.isCoastal).map(c => c.location);
    } else if (!Array.isArray(portCityLocations)) {
      portCityLocations = [];
    }
    window._saveHasCoastalData = false;
    buildCityLocationMap();

    updateLoadingOverlay('Rendering minimap...', 80);
    await yieldFrame();

    // Verify grid is properly initialized before generating minimap
    if (!grid || grid.length === 0 || typeof cols !== 'number' || typeof rows !== 'number') {
      console.error('Failed to load game data properly:', { grid: !!grid, gridLen: grid?.length, cols, rows });
      hideLoadingOverlay();
      return;
    }

    // Regenerate minimap for loaded world
    generateMinimap();

    // Invalidate offscreen map buffer so it rebuilds with loaded terrain
    if (typeof invalidateMapBuffer === 'function') invalidateMapBuffer();

    updateLoadingOverlay('Ready!', 100);
    await yieldFrame();

    _tuneAIForMapSize();
    rebuildSpatialGrids();
    worldInitialized = true;
    _resetSpawnGracePeriod();
    hideLoadingOverlay();
    // Expose let-scoped globals so player.ownsCity / addOwnedCity work in adventure mode
    window.player = player;
    window.cities = cities;
    if (typeof window.BQRestoreWorldSessionsFromSave === 'function') {
      window.BQRestoreWorldSessionsFromSave(
        Array.isArray(window._savedWorldSessions) ? window._savedWorldSessions : [],
        (typeof window._savedActiveWorldSessionKey === 'string' && window._savedActiveWorldSessionKey.trim())
          ? window._savedActiveWorldSessionKey
          : BQ_WORLD_SESSION_KEYS.HOMEWORLD
      );
    } else {
      registerCurrentWorldSession(BQ_WORLD_SESSION_KEYS.HOMEWORLD, { label: 'Earth' });
    }
    window._savedWorldSessions = null;
    window._savedActiveWorldSessionKey = null;
    window._savedBearEmpireData = null;

    // Restore City Management mode if the save indicated it was active.
    // We rely on the temporary `window._savedIsCityManageMode` flag set by SaveSystem.load().
    if (window._savedIsCityManageMode) {
      _restoreCityManageMode();
    } else if (player?.spaceTravel?.inOrbit) {
      const entered = _enterSpaceState();
      if (!entered?.ok) {
        console.warn('[BQ] Failed to restore orbit state:', entered);
      }
    } else {
      const restoredState = _enterRestoredGameplayState(_getSurfaceGameplayState(), { bridgeState: GameStates.PLAYING });
      if (!restoredState?.ok) {
        console.warn('[BQ] Failed to restore surface state:', restoredState);
      }
    }
    runInitialEndConditionCheck('loadExistingGame');
  }
}

function draw() {
  if (!_gameBootstrapComplete) {
    if (_engineBootstrapError) {
      background(20);
      fill(255, 120, 120);
      textAlign(CENTER, CENTER);
      textSize(18);
      text('Engine failed to load. Check console.', width / 2, height / 2);
    }
    return;
  }

  // Update mobile HUD visibility each frame
  if (typeof mobileSupport !== 'undefined') {
    mobileSupport.update(gameStateManager.currentState);
  }

  uiManager.updateAll();
  _tickMinimapBuild();

  // Level editor has its own render loop — check BEFORE the worldInitialized gate
  if (gameStateManager.is(GameStates.LEVEL_EDITOR)) {
    if (levelEditor) {
      levelEditor.updateCamera();   // continuous WASD panning
      levelEditor.render();
    }
    return;
  }

  // If pause/settings was opened from level editor, keep editor map as background
  if ((gameStateManager.is(GameStates.PAUSED) || gameStateManager.is(GameStates.SETTINGS))
      && window._pauseReturnState === GameStates.LEVEL_EDITOR) {
    if (levelEditor) {
      levelEditor.render();
      // Subtle dim to separate world from modal UI overlays
      push();
      fill(0, 0, 0, 90);
      noStroke();
      rect(0, 0, width, height);
      pop();
    } else {
      background(20);
    }
    return;
  }

  if (!worldInitialized || isMenuPresentationState()) {
    // Menu-family screens share the animated background map.
    renderMenuPresentationFrame();
    return;
  }

  const planetSurfaceFallback = _isPlanetSurfaceControlActive();
  if (_isSurfaceGameplayState() || planetSurfaceFallback) {
    if (planetSurfaceFallback) {
      window._spaceMapOpen = false;
      if (gameStateManager.is(GameStates.SPACE)) gameStateManager.setState(_getSurfaceGameplayState());
    }
    // Safety: ensure city management flags are always cleared in PLAYING state.
    // Prevents stale flags from routing inventory/combat back to CITY_MANAGE.
    if (window._isCityManageMode) window._isCityManageMode = false;
    if (window._adventureCityManage) window._adventureCityManage = false;

    const scaledDt = deltaTime * gameSpeed;
    dayNight.update(scaledDt);

    // Smooth camera follow player
    targetCamX = player.x * tileSize + tileSize / 2;
    targetCamY = player.y * tileSize + tileSize / 2;
    camX = lerp(camX, targetCamX, CAM_LERP);
    camY = lerp(camY, targetCamY, CAM_LERP);
    _updateViewportBounds(); // cache VP bounds once — isOnScreen() reads these

    // Render world
    push();
    translate(width / 2, height / 2);
    scale(camZoom);
    // Apply camera shake offset (decays over time)
    if (camShakeTime > 0) {
      const t = Math.min(camShakeTime / 1000, 1);
      // jitter using random and decaying magnitude
      const shakeMagnitude = camShakeMag * t;
      camShakeX = (Math.random() * 2 - 1) * shakeMagnitude;
      camShakeY = (Math.random() * 2 - 1) * shakeMagnitude;
      camShakeTime = Math.max(0, camShakeTime - deltaTime);
      if (camShakeTime === 0) { camShakeMag = 0; camShakeX = 0; camShakeY = 0; }
    }
    translate(-camX + camShakeX, -camY + camShakeY);

    RenderMap();

    // Render visible cities only.
    renderVisibleCities();

    // Render traders
    if (traderManager) traderManager.render(tileSize);

    // Render raiders
    if (raiderManager) raiderManager.render(tileSize);

    // Render dig sites (treasure system)
    if (treasureSystem) treasureSystem.renderDigSites(tileSize);

    // Render survey contract markers on the world map
    if (typeof contractSystem !== 'undefined' && contractSystem) {
      for (const c of contractSystem.active) {
        if (c.type === 'survey' && c.surveyPoints) {
          for (let j = 0; j < c.surveyPoints.length; j++) {
            const sp = c.surveyPoints[j];
            const sx = sp.x * tileSize + tileSize / 2;
            const sy = sp.y * tileSize + tileSize / 2;
            if (!isOnScreen(sx, sy)) continue;
            const visited = c.surveyVisited[j];
            const pulse = Math.sin(frameCount * 0.06 + j * 2) * 0.25 + 0.75;

            if (visited) {
              // Visited — faded green check
              noStroke();
              fill(80, 200, 80, 100);
              ellipse(sx, sy, tileSize * 1.2, tileSize * 1.2);
              fill(80, 200, 80, 180);
              textAlign(CENTER, CENTER);
              textSize(tileSize * 0.6);
              text('\u2713', sx, sy);
            } else {
              // Unvisited — pulsing beacon
              noStroke();
              fill(255, 160, 0, 50 * pulse);
              ellipse(sx, sy, tileSize * 2.5 * pulse, tileSize * 2.5 * pulse);
              fill(255, 160, 0, 120 * pulse);
              ellipse(sx, sy, tileSize * 1.4, tileSize * 1.4);
              fill(255, 220, 80);
              stroke(0, 0, 0, 120);
              strokeWeight(1);
              ellipse(sx, sy, tileSize * 0.7, tileSize * 0.7);
              noStroke();
              fill(255, 255, 255, 220);
              textAlign(CENTER, CENTER);
              textSize(tileSize * 0.35);
              text(`${j + 1}`, sx, sy);
            }
          }
        }
      }
    }

    // Render player
    player.render(tileSize);

    // Update and render particles in world-space (they inherit current world transform)
    if (typeof particleSystem !== 'undefined' && particleSystem) {
      particleSystem.update(scaledDt);
      try { particleSystem.render(); } catch (e) { console.error('particle render error:', e); }
    }

    pop();

    // Day/night overlay
    // First, draw screen-space particles (HUD / UI effects)
    if (typeof particleSystem !== 'undefined' && particleSystem) {
      try { particleSystem.renderToScreen(); } catch (e) { console.error('particle renderToScreen error:', e); }
    }

    // Debug overlay for particle system (enable by setting `window.DEBUG_PARTICLES = true`)
    if (window.DEBUG_PARTICLES && typeof particleSystem !== 'undefined') {
      try {
        push();
        resetMatrix();
        fill(255);
        noStroke();
        textSize(12);
        textAlign(LEFT, TOP);
        const cnt = (typeof particleSystem.getActiveCount === 'function') ? particleSystem.getActiveCount() : particleSystem.particles.filter(p => p.alive).length;
        text('Particles: ' + cnt, 12, 8);
        pop();
      } catch (e) { console.error('particle debug overlay error:', e); }
    }

    dayNight.renderOverlay();

    // Render minimap
    renderMinimap();

    // Zoom HUD (only when not at 1×) — centered beneath minimap buttons
    if (camZoom !== 1 && _isMinimapVisible()) {
      push();
      const zPct = Math.round(camZoom * 100);
      const label = `${zPct}%`;
      const metrics = _getMinimapMetrics();
      const mmSize = metrics.size;
      const mmX = metrics.x;
      fill(255, 255, 255, 160);
      noStroke();
      textAlign(CENTER, TOP);
      textSize(11);
      text(label, mmX + mmSize / 2, 10 + mmSize + 30);
      pop();
    }

    // Update subsystems
    player.update();
    if (traderManager) traderManager.update(scaledDt);
    if (raiderManager) raiderManager.update(scaledDt);

    // Auto-open city view when player arrives on a city tile (path finished, not already open)
    if (player.currentTileCity && !player.currentCity && !_isCityViewOpen()) {
      _openCityView(player.currentTileCity);
    }

    // Contract completion checks
    if (contractSystem) contractSystem.checkCompletion();

    // Dig site interaction — press E when on a dig site
    if (treasureSystem) {
      const dig = treasureSystem.getDigSiteAtPlayer();
      if (dig && !dig._hintShown) {
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log('\uD83D\uDC8E A dig site is here! Press E to dig.', 'info');
        }
        dig._hintShown = true;
      }
    }

    // Raider collision check — skip if in city, combat cooldown, or end state (win/lose mid-frame)
    const playerOnCityTile = _isCityTile(player.x, player.y);
    if (raiderManager && combatSystem && !combatSystem.active && !player.currentCity && !playerOnCityTile && !window._combatCooldown && _isSpawnGraceExpired() &&
        !gameStateManager.is(GameStates.GAMEWON) && !gameStateManager.is(GameStates.GAMELOSE)) {
      const raider = raiderManager.checkPlayerCollision(player.x, player.y);
      if (raider) {
        combatSystem.startCombat(raider);
      }
    }

    // Trader encounter check
    if (traderManager) {
      const trader = traderManager.checkPlayerEncounter(player.x, player.y);
      if (trader) {
        const canRaid = _canRaidTraders() && _isTraderRaidEligible(trader) && !(combatSystem && combatSystem.active);
        const now = Date.now();
        const encounterKey = `${trader.id || trader.name}:${player.x},${player.y}`;

        if (canRaid && window._lastTraderRaidPromptKey !== encounterKey &&
            now >= (trader._raidCooldownUntil || 0) && !trader._raidPromptOpen) {
          window._lastTraderRaidPromptKey = encounterKey;
          trader._raidPromptOpen = true;
          const targetCity = cities[trader.targetCityIndex]?.name || 'their destination';
          _showTraderRaidPrompt(trader.name, targetCity, (doRaid) => {
            trader._raidPromptOpen = false;
            if (doRaid) {
              _startTraderRaidEncounter(trader);
            } else {
              trader._raidCooldownUntil = Date.now() + 5000;
            }
          });
        } else if (!trader._notified && !_canRaidTraders() && _shouldNotifyTraderTravel()) {
          notificationManager.log(`Trader ${trader.name} is heading to ${cities[trader.targetCityIndex]?.name || 'somewhere'}`, "info");
          trader._notified = true;
          setTimeout(() => { trader._notified = false; }, 5000);
        }
      } else {
        window._lastTraderRaidPromptKey = null;
      }
    }

    // Handle WASD movement
    handleMovement();

    // ── Owned-city background ticking (adventure mode empire) ──
    // Tick build queues, daily taxes, trade routes, and raider defense for player-owned cities
    if (player.ownedCities && player.ownedCities.length > 0) {
      const day = typeof dayNight !== 'undefined' && dayNight.getDaysElapsed ? dayNight.getDaysElapsed() : 0;
      // Rebuild cached city refs only when ownership count changes (avoids per-frame array allocation)
      if (!player._ownedCityRefsCache || player._ownedCityRefsCacheLen !== player.ownedCities.length) {
        player._ownedCityRefsCache = player.ownedCities.map(idx => cities[idx]).filter(Boolean);
        player._ownedCityRefsCacheLen = player.ownedCities.length;
      }
      for (const ownedCity of player._ownedCityRefsCache) {
        // Tick build queues (per-frame)
        if (typeof ownedCity.tickManagement === 'function') ownedCity.tickManagement(scaledDt);

        // Daily tax (once per day — tracked per city)
        if (day > 0 && ownedCity._lastAdventureTaxDay !== day) {
          ownedCity._lastAdventureTaxDay = day;
          if (typeof ownedCity.applyWeeklyTax === 'function') ownedCity.applyWeeklyTax(1);
        }
      }
      _tickOwnedCityRaiderDefense(player._ownedCityRefsCache);
    }

  } else if (gameStateManager.is(GameStates.SPACE)) {
    dayNight.update(deltaTime * gameSpeed);
    const sys = player?._spaceTravelSystem || window._spaceTravelSystem || null;
    const activeSession = getWorldSession();
    if (sys && sys.phase === 'landed' && sys.currentBodyKey && sys.currentBodyKey !== 'homeworld') {
      const body = (typeof sys.getBodyByKey === 'function') ? sys.getBodyByKey(sys.currentBodyKey) : null;
      const needsPlanetSession = !_isPlanetSurfaceSession(activeSession);
      if (needsPlanetSession && body && typeof window.BQEnterPlanetSurfaceFromSpace === 'function') {
        const landed = window.BQEnterPlanetSurfaceFromSpace(sys, body);
        if (!landed?.ok) {
          if (typeof notificationManager !== 'undefined') {
            notificationManager.log(`Surface handoff failed: ${landed?.reason || 'unknown'}`, 'warning');
          }
        } else {
          window._spaceMapOpen = false;
          gameStateManager.setState(_getSurfaceGameplayState());
          return;
        }
      }
    }
    if (sys && sys.phase === 'landed' && _isPlanetSurfaceSession(activeSession)) {
      window._spaceMapOpen = false;
      gameStateManager.setState(_getSurfaceGameplayState(activeSession));
      return;
    }
    const spaceSurface = (sys && typeof sys.getCurrentSurfaceState === 'function') ? sys.getCurrentSurfaceState() : null;
    const isEarthSurface = !!(sys && sys.phase === 'landed' && spaceSurface?.mode === 'earth_world');
    if (sys && typeof sys.tickFrame === 'function') {
      const controlsLocked = !!window._spaceRouteQTEActive;
      const thrustLeft = _isKeyHeld(65) || _isKeyHeld(LEFT_ARROW);
      const thrustRight = _isKeyHeld(68) || _isKeyHeld(RIGHT_ARROW);
      const thrustUp = _isKeyHeld(87) || _isKeyHeld(UP_ARROW);
      const thrustDown = _isKeyHeld(83) || _isKeyHeld(DOWN_ARROW);
      const result = sys.tickFrame(deltaTime * gameSpeed, {
        thrustX: controlsLocked ? 0 : ((thrustRight ? 1 : 0) - (thrustLeft ? 1 : 0)),
        thrustY: controlsLocked ? 0 : ((thrustDown ? 1 : 0) - (thrustUp ? 1 : 0)),
        boost: !controlsLocked && (_isKeyHeld(16) || _isKeyHeld(32)),
      });
      if (result?.event === 'launch_complete') {
        if (typeof player?.launchToSpace === 'function' && sys.launchCity) player.launchToSpace(sys.launchCity, sys.currentNode);
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log(`Launch complete. Entered ${sys.currentNode}.`, 'success');
        }
        window._spaceMapOpen = false;
      } else if (result?.event === 'jumped') {
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log(`Jumped to ${result.node}.`, 'info');
          if (result?.hazard?.type === 'ion_field') {
            if (result.hazard.prevented) {
              notificationManager.log('Ion field crossed safely. The survival guide absorbed the surge.', 'success');
            } else {
              const hazardParts = [];
              if (result.hazard.damage > 0) hazardParts.push(`-${result.hazard.damage}% hull`);
              notificationManager.log(
                `Ion field surge during jump${hazardParts.length ? `: ${hazardParts.join(' · ')}` : '.'}`,
                result.hazard.mitigated ? 'warning' : 'error'
              );
            }
          }
          if (result?.conflictHazard?.type === 'bear_blockade') {
            notificationManager.log(
              `${result.conflictHazard.title}: bear patrols are contesting your arrival corridor.`,
              'warning'
            );
          }
        }
        if (result?.conflictHazard?.type === 'bear_blockade') _resolveSpaceConflictHazard(result.conflictHazard);
        if (result?.encounter?.type === 'space_encounter') {
          if (typeof notificationManager !== 'undefined') {
            notificationManager.log(`Encounter: ${result.encounter.encounter.name}`, 'info');
          }
          _showSpaceEncounterChoice(result.encounter);
        }
      } else if (result?.event === 'reentry_complete') {
        if (typeof player?.returnFromSpace === 'function') player.returnFromSpace();
        if (typeof gameStateManager !== 'undefined') {
          gameStateManager.setState(window._spaceReturnState || _getPlayableReturnState());
        }
      }
      if (typeof window._syncPlayerSpaceTravelFromSystem === 'function') {
        window._syncPlayerSpaceTravelFromSystem();
      }
    }

    if (isEarthSurface) {
      const scaledDt = deltaTime * gameSpeed;
      targetCamX = player.x * tileSize + tileSize / 2;
      targetCamY = player.y * tileSize + tileSize / 2;
      camX = lerp(camX, targetCamX, CAM_LERP);
      camY = lerp(camY, targetCamY, CAM_LERP);
      _updateViewportBounds();

      player.update();
      if (traderManager) traderManager.update(scaledDt);
      if (raiderManager) raiderManager.update(scaledDt);
      if (contractSystem) contractSystem.checkCompletion();

      push();
      translate(width / 2, height / 2);
      scale(camZoom);
      translate(-camX, -camY);
      RenderMap();
      renderVisibleCities();
      if (traderManager) traderManager.render(tileSize);
      if (raiderManager) raiderManager.render(tileSize);
      if (treasureSystem) treasureSystem.renderDigSites(tileSize);
      player.render(tileSize);
      pop();

      dayNight.renderOverlay();
      renderMinimap();
    } else {
      background(3, 6, 16);
      if (sys && typeof sys.renderScene === 'function') {
        sys.renderScene(width, height);
      }
    }

  } else if (gameStateManager.is(GameStates.INVENTORY)) {
    // Inventory: keep world fully visible, just pause time
    dayNight.update(0);
    _updateViewportBounds();
    push();
    translate(width / 2, height / 2);
    scale(camZoom);
    translate(-camX, -camY);
    RenderMap();
    renderVisibleCities();
    player.render(tileSize);
    pop();
    dayNight.renderOverlay();
    renderMinimap();

  } else if (gameStateManager.is(GameStates.COMBAT) || gameStateManager.is(GameStates.RANDOM_EVENT) || gameStateManager.is(GameStates.WEEKLY_SUMMARY) || gameStateManager.is(GameStates.MINIGAME) || gameStateManager.is(GameStates.GAMBLING) || gameStateManager.is(GameStates.CONTRACT_BOARD) || gameStateManager.is(GameStates.BANK) || gameStateManager.is(GameStates.BOUNTY_BOARD) || gameStateManager.is(GameStates.BLACK_MARKET) || gameStateManager.is(GameStates.TREASURE_MAP)) {
    // Keep world visible behind combat/event UI
    dayNight.update(0); // Don't advance time
    _updateViewportBounds();
    push();
    translate(width / 2, height / 2);
    scale(camZoom);
    translate(-camX, -camY);
    RenderMap();
    renderVisibleCities();
    if (player && typeof player.render === 'function') player.render(tileSize);
    pop();
    dayNight.renderOverlay();

    // Darken overlay
    push();
    fill(0, 0, 0, 120);
    noStroke();
    rect(0, 0, width, height);
    pop();

    // Render active minigame on top
    if (minigameManager && minigameManager.active) {
      minigameManager.update(deltaTime);
      minigameManager.render();
    }

  } else if (gameStateManager.is(GameStates.GAMELOSE) || gameStateManager.is(GameStates.GAMEWON)) {
    // Dim world behind end-game screen
    dayNight.update(0);
    _updateViewportBounds();
    push();
    translate(width / 2, height / 2);
    scale(camZoom);
    translate(-camX, -camY);
    RenderMap();
    renderVisibleCities();
    player.render(tileSize);
    pop();
    dayNight.renderOverlay();
    push();
    fill(0, 0, 0, 160);
    noStroke();
    rect(0, 0, width, height);
    pop();
  } else if (gameStateManager.is(GameStates.CITY_MANAGE)) {
    // City Management mode — two phases:
    //   Phase 1 (not settled): user pans camera freely, clicks map to settle
    //   Phase 2 (settled): camera anchored to city with pan offset
    const scaledDt = deltaTime * gameSpeed;
    const invasionPaused = !!window._invasionQTEActive || !!window._unitRaidQTEActive;
    dayNight.update(invasionPaused ? 0 : scaledDt);

    const settled = cityManagement && cityManagement.isSettled;

    if (settled && cityManagement.myCity) {
      // ── Phase 2: Camera anchored to YOUR city + pan offset ──
      const loc = cityManagement.myCity.location;
      targetCamX = loc.x * tileSize + tileSize / 2 + (window._cityMgmtCamOffX || 0);
      targetCamY = loc.y * tileSize + tileSize / 2 + (window._cityMgmtCamOffY || 0);
    } else {
      // ── Phase 1: Free camera panning (WASD moves camera directly) ──
      targetCamX = camX + (window._cityMgmtCamDx || 0);
      targetCamY = camY + (window._cityMgmtCamDy || 0);
      window._cityMgmtCamDx = 0;
      window._cityMgmtCamDy = 0;
    }
    camX = lerp(camX, targetCamX, CAM_LERP);
    camY = lerp(camY, targetCamY, CAM_LERP);
    _updateViewportBounds();

    push();
    translate(width / 2, height / 2);
    scale(camZoom);
    translate(-camX, -camY);

    RenderMap();
    renderVisibleCities();
    if (traderManager) traderManager.render(tileSize);
    if (raiderManager) raiderManager.render(tileSize);
    if (cityManagement && typeof cityManagement.renderUnits === 'function') cityManagement.renderUnits(tileSize);

    // Render crosshair at hovered tile during placement phase
    if (!settled) {
      const hover = screenToGridTile(mouseX, mouseY);
      if (hover.gridX >= 0 && hover.gridX < cols && hover.gridY >= 0 && hover.gridY < rows) {
        const hx = hover.gridX * tileSize;
        const hy = hover.gridY * tileSize;
        const tile = grid[hover.gridY]?.[hover.gridX];
        const isWater = tile && tile.options[0] === 'Water';
        noFill();
        stroke(isWater ? color(255, 60, 60, 160) : color(0, 255, 100, 180));
        strokeWeight(2);
        rect(hx, hy, tileSize, tileSize, 2);
      }
    }

    // City management overlays — reputation halos & build queue markers
    if (typeof renderCityManagementOverlays === 'function') renderCityManagementOverlays();

    pop();

    dayNight.renderOverlay();
    renderMinimap();

    // WASD camera panning (disabled while invasion QTE is open)
    if (!invasionPaused) handleMovement();

    // Update subsystems (no player update — player doesn't exist in this mode)
    if (!invasionPaused) {
      if (traderManager) traderManager.update(scaledDt);
      if (raiderManager) raiderManager.update(scaledDt);
      if (cityManagement) cityManagement.tick(scaledDt);
    }

    // Raider attacks on your city (Phase 2): check if raiders are near your city
    // City management resolves raids automatically — no player combat.
    // Walls and weapon shops provide defense; if defense fails, the city takes damage.
    if (!invasionPaused && settled && raiderManager && cityManagement.myCity && _isSpawnGraceExpired()) {
      const myLoc = cityManagement.myCity.location;
      const myCity = cityManagement.myCity;
      const wallLevel = myCity.management?.upgradeLevels?.walls || 0;
      const hasWeaponShop = !!myCity.hasWeaponShop;
      const defenseDist = 3 + wallLevel;
      // Defense chance: walls give 25% per level, weapon shop adds 15%
      const defenseChance = Math.min(0.95, wallLevel * 0.25 + (hasWeaponShop ? 0.15 : 0));
      const nearbyRaiders = (typeof raiderManager.getRaidersInRect === 'function')
        ? raiderManager.getRaidersInRect(
            myLoc.x - defenseDist,
            myLoc.x + defenseDist,
            myLoc.y - defenseDist,
            myLoc.y + defenseDist
          )
        : raiderManager.raiders;
      for (const raider of nearbyRaiders) {
        if (!raider || raider.state === 'defeated') continue;
        const dx = Math.abs(raider.x - myLoc.x);
        const dy = Math.abs(raider.y - myLoc.y);
        if (dx <= defenseDist && dy <= defenseDist) {
          // Give trained city units first chance to intercept incoming raiders.
          if (cityManagement && typeof cityManagement.tryUnitIntercept === 'function') {
            const intercept = cityManagement.tryUnitIntercept(myCity, raider);
            if (intercept && intercept.intercepted) continue;
          }
          if (defenseChance > 0 && Math.random() < defenseChance) {
            // City defenses repelled the raider
            raider.state = 'defeated';
            if (typeof notificationManager !== 'undefined') {
              const reason = wallLevel > 0 ? 'City walls' : 'City militia';
              notificationManager.log(`${reason} repelled a raider!`, 'success');
            }
          } else {
            // Raider breaks through — city takes damage (population + budget loss)
            raider.state = 'defeated';
            const popLoss = Math.max(1, Math.floor((raider.strength || 1) * 2));
            const goldLoss = Math.max(10, Math.floor((raider.strength || 1) * 15));
            myCity.population = Math.max(1, (myCity.population || 10) - popLoss);
            if (myCity.management) {
              myCity.management.budget = Math.max(0, (myCity.management.budget || 0) - goldLoss);
            }
            myCity.reputation = Math.max(0, (myCity.reputation || 50) - 3);
            if (typeof notificationManager !== 'undefined') {
              notificationManager.log(
                `\u2694\uFE0F Raiders attacked ${myCity.name}! Lost ${popLoss} citizens and ${goldLoss} gold.` +
                (wallLevel === 0 ? ' Build walls to improve defense!' : ''),
                'warning'
              );
            }
          }
        }
      }
    }

  } else if (!gameStateManager.is(GameStates.PAUSED) && !gameStateManager.is(GameStates.SETTINGS) && !gameStateManager.is(GameStates.NEW_GAME_CONFIG)) {
    background(20);
  }
}

/** Renders city-management overlays: reputation heatmap and building footprints. */
function renderCityManagementOverlays() {
  if (!cities || !Array.isArray(cities)) return;
  const mode = window._cityOverlayMode || 'heatmap';
  push();

  // Draw trade route lines between cities
  const pulse = (Math.sin(frameCount * 0.04) + 1) / 2; // 0→1 oscillation
  for (const src of cities) {
    const routes = src.management?.routes;
    if (!routes || routes.length === 0) continue;
    const sx = src.location.x * tileSize + tileSize / 2;
    const sy = src.location.y * tileSize + tileSize / 2;
    for (const r of routes) {
      let dest = null;
      if (typeof r.destIndex === 'number' && r.destIndex >= 0 && r.destIndex < cities.length) {
        dest = cities[r.destIndex];
      }
      if (!dest && r.destName) {
        dest = cities.find((c) => c && c.name === r.destName);
      }
      if (!dest) continue;
      const dx = dest.location.x * tileSize + tileSize / 2;
      const dy = dest.location.y * tileSize + tileSize / 2;
      const alpha = 120 + pulse * 80;
      stroke(200, 170, 60, alpha);
      strokeWeight(2);
      drawingContext.setLineDash([tileSize * 0.4, tileSize * 0.3]);
      line(sx, sy, dx, dy);
      drawingContext.setLineDash([]);
      // Arrow head at destination
      const angle = Math.atan2(dy - sy, dx - sx);
      const arrLen = tileSize * 0.5;
      fill(200, 170, 60, alpha);
      noStroke();
      const mx = dx - Math.cos(angle) * tileSize;
      const my = dy - Math.sin(angle) * tileSize;
      triangle(
        mx + Math.cos(angle) * arrLen, my + Math.sin(angle) * arrLen,
        mx + Math.cos(angle + 2.4) * arrLen * 0.5, my + Math.sin(angle + 2.4) * arrLen * 0.5,
        mx + Math.cos(angle - 2.4) * arrLen * 0.5, my + Math.sin(angle - 2.4) * arrLen * 0.5
      );
    }
  }

  // Draw active invasion campaign routes (marching armies)
  if (typeof cityManagement !== 'undefined' && cityManagement && typeof cityManagement.getActiveCampaigns === 'function') {
    const campaigns = cityManagement.getActiveCampaigns();
    const dayNow = (typeof dayNight !== 'undefined' && dayNight.getDaysElapsed) ? dayNight.getDaysElapsed() : 0;
    for (const c of campaigns) {
      const src = cities[c.sourceIndex];
      const dst = cities[c.targetIndex];
      if (!src || !dst) continue;
      const sx = src.location.x * tileSize + tileSize / 2;
      const sy = src.location.y * tileSize + tileSize / 2;
      const dx = dst.location.x * tileSize + tileSize / 2;
      const dy = dst.location.y * tileSize + tileSize / 2;

      const alpha = 140 + pulse * 90;
      stroke(220, 90, 90, alpha);
      strokeWeight(2.5);
      drawingContext.setLineDash([tileSize * 0.22, tileSize * 0.28]);
      line(sx, sy, dx, dy);
      drawingContext.setLineDash([]);

      const travelDays = Math.max(1, Number(c.travelDays) || 1);
      const elapsed = Math.max(0, dayNow - (Number(c.startedDay) || dayNow));
      const t = Math.max(0, Math.min(1, elapsed / travelDays));
      const mx = sx + (dx - sx) * t;
      const my = sy + (dy - sy) * t;
      noStroke();
      fill(255, 170, 100, 220);
      ellipse(mx, my, tileSize * 0.34, tileSize * 0.34);
    }
  }

  // Draw incoming invasion warning route(s) for the player's managed city.
  if (typeof cityManagement !== 'undefined'
      && cityManagement
      && cityManagement.myCity
      && typeof cityManagement.getIncomingInvasions === 'function') {
    const incoming = cityManagement.getIncomingInvasions(cityManagement.myCity);
    if (Array.isArray(incoming) && incoming.length > 0) {
      const dayNowRaw = (typeof dayNight !== 'undefined' && dayNight && typeof dayNight.getDaysElapsed === 'function')
        ? Number(dayNight.getDaysElapsed())
        : 0;
      const dayNow = Number.isFinite(dayNowRaw) ? dayNowRaw : 0;
      const tod = (typeof dayNight !== 'undefined' && dayNight)
        ? Number(dayNight.timeOfDay)
        : 0;
      const dayFrac = Math.max(0, Math.min(1, Number.isFinite(tod) ? (tod / (Math.PI * 2)) : 0));
      const worldDayNow = dayNow + dayFrac;

      for (const inv of incoming) {
        const attacker = cities?.[inv.attackerIndex];
        const target = cities?.[inv.targetIndex];
        if (!attacker || !target) continue;

        const sx = attacker.location.x * tileSize + tileSize / 2;
        const sy = attacker.location.y * tileSize + tileSize / 2;
        const dx = target.location.x * tileSize + tileSize / 2;
        const dy = target.location.y * tileSize + tileSize / 2;

        const alpha = 170 + pulse * 80;
        stroke(235, 64, 52, alpha);
        strokeWeight(3);
        drawingContext.setLineDash([tileSize * 0.3, tileSize * 0.22]);
        line(sx, sy, dx, dy);
        drawingContext.setLineDash([]);

        // Pulse danger ring over target city.
        noFill();
        stroke(255, 96, 88, 150 + pulse * 70);
        strokeWeight(2);
        const trgPulse = tileSize * (1.35 + pulse * 0.55);
        ellipse(dx, dy, trgPulse, trgPulse);
        ellipse(dx, dy, trgPulse * 0.72, trgPulse * 0.72);

        // Marching marker moves from attacker toward target during the warning day.
        const announced = Number(inv.announcedDay) || dayNow;
        const arrival = Number(inv.arrivalDay) || (announced + 1);
        const span = Math.max(0.25, arrival - announced);
        const t = Math.max(0, Math.min(1, (worldDayNow - announced) / span));
        const mx = sx + (dx - sx) * t;
        const my = sy + (dy - sy) * t;
        noStroke();
        fill(255, 130, 110, 235);
        ellipse(mx, my, tileSize * 0.36, tileSize * 0.36);
        fill(255, 214, 210, 220);
        ellipse(mx, my, tileSize * 0.18, tileSize * 0.18);
      }
    }
  }

  for (const c of cities) {
    const px = c.location.x * tileSize + tileSize / 2;
    const py = c.location.y * tileSize + tileSize / 2;
    if (!isOnScreen(px, py)) continue;

    if (mode === 'heatmap' || mode === 'all') {
      const rep = Math.max(0, Math.min(100, c.reputation || 50));
      const t = rep / 100;
      const r = Math.floor(255 * (1 - t));
      const g = Math.floor(200 * t + 55 * t);
      const b = 60;
      noStroke();
      fill(r, g, b, 80);
      const size = tileSize * (1 + (rep / 100) * 3);
      ellipse(px, py, size, size);
    }

    if ((mode === 'footprints' || mode === 'all') && c.management) {
      const keys = [
        ...Object.keys(c.management.upgradeLevels || {}),
        ...Object.keys(c.management.districts || {}).map((key) => `district:${key}`),
        ...(c.hasBank ? ['bank'] : []),
        ...(c.hasSchool ? ['school'] : []),
        ...(c.hasWeaponShop ? ['weaponShop'] : []),
        ...(c.hasBountyBoard ? ['bountyBoard'] : []),
      ];
      let idx = 0;
      for (const k of keys) {
        const isDistrict = typeof k === 'string' && k.startsWith('district:');
        const rawKey = isDistrict ? k.slice('district:'.length) : k;
        const lvl = isDistrict ? (c.management.districts?.[rawKey] || 0) : (c.management.upgradeLevels?.[rawKey] || 1);
        for (let n = 0; n < lvl; n++) {
          const offX = ((idx % 3) - 1) * (tileSize * 0.6);
          const offY = (Math.floor(idx / 3) - 1) * (tileSize * 0.6);
          push();
          translate(px + offX, py + offY);
          if (isDistrict) fill(210, 168, 76, 220);
          else if (rawKey === 'farm') fill(100, 180, 80, 220);
          else if (rawKey === 'walls') fill(185, 190, 205, 220);
          else if (rawKey === 'housing') fill(205, 160, 105, 220);
          else fill(30, 120, 200, 200);
          rect(-tileSize * 0.25, -tileSize * 0.25, tileSize * 0.5, tileSize * 0.5, 4);
          pop();
          idx++;
        }
      }
    }

    if ((mode === 'queue' || mode === 'all') && c.management && c.management.buildingQueue && c.management.buildingQueue.length > 0) {
      const pulse = Math.abs(Math.sin(frameCount * 0.08)) * 0.6 + 0.4;
      noStroke();
      fill(255, 215, 0, 200 * pulse);
      ellipse(px, py - tileSize * 0.7, tileSize * 0.6 * pulse, tileSize * 0.6 * pulse);
    }
  }
  pop();
}


function handleMovement() {
  const spaceSystem = gameStateManager.is(GameStates.SPACE)
    ? _getActiveSpaceSystem()
    : null;
  const isPlanetSurfaceFallback = _isPlanetSurfaceControlActive();
  const isEarthSurface = !!(
    spaceSystem
    && spaceSystem.phase === 'landed'
    && typeof spaceSystem.getCurrentSurfaceState === 'function'
    && spaceSystem.getCurrentSurfaceState()?.mode === 'earth_world'
  );
  if (!_isSurfaceGameplayState() && !gameStateManager.is(GameStates.CITY_MANAGE) && !isEarthSurface && !isPlanetSurfaceFallback) return;
  if (window._combatPatternActive) return;
  if (_isTextEntryFocused()) return;
  if (player?.currentCity && _isCityViewOpen()) return;

  // City management: continuous camera panning (every frame, no moveDelay)
  if (gameStateManager.is(GameStates.CITY_MANAGE)) {
    let dx = 0, dy = 0;
    if (isActionDown('moveUp'))    dy = -1;
    if (isActionDown('moveDown'))  dy = 1;
    if (isActionDown('moveLeft'))  dx = -1;
    if (isActionDown('moveRight')) dx = 1;
    if (dx !== 0 || dy !== 0) {
      const panSpeed = tileSize * 0.35 * (deltaTime || 16);  // ~6 tiles/sec, frame-rate independent
      if (cityManagement && cityManagement.isSettled) {
        window._cityMgmtCamOffX = (window._cityMgmtCamOffX || 0) + dx * panSpeed;
        window._cityMgmtCamOffY = (window._cityMgmtCamOffY || 0) + dy * panSpeed;
      } else {
        window._cityMgmtCamDx = (window._cityMgmtCamDx || 0) + dx * panSpeed;
        window._cityMgmtCamDy = (window._cityMgmtCamDy || 0) + dy * panSpeed;
      }
    }
    return;
  }

  moveTimer += deltaTime * gameSpeed;
  if (moveTimer < moveDelay) return;

  let dx = 0;
  let dy = 0;

  if (isActionDown('moveUp'))    dy = -1;
  if (isActionDown('moveDown'))  dy = 1;
  if (isActionDown('moveLeft'))  dx = -1;
  if (isActionDown('moveRight')) dx = 1;

  if (dx !== 0 || dy !== 0) {
    moveTimer = 0;
    // Manual movement input should override click-to-move routing.
    if (player.path && player.path.length > 0) {
      player.path = [];
      player.pathMoveTimer = 0;
    }

    const oldX = player.x;
    const oldY = player.y;
    player.move(dx, dy);

    // If player actually moved, trigger event check
    if (player.x !== oldX || player.y !== oldY) {
      if (eventSystem && typeof eventSystem.onPlayerMoved === 'function') eventSystem.onPlayerMoved();
    }
  }
}

function windowResized() {
  _queueViewportResize();
}

function keyPressed() {
  // While typing in an input/search field, ignore gameplay hotkeys.
  // Allow Esc to close overlays/menu as expected.
  if (_isTextEntryFocused() && keyCode !== 27) return;
  if (!gameStateManager) return;

  // Level editor key handling
  if (gameStateManager.is(GameStates.LEVEL_EDITOR)) {
    if (isActionKey('pause', keyCode)) { // Esc = pause menu (not quit editor)
      window._pauseReturnState = GameStates.LEVEL_EDITOR;
      gameStateManager.setState(GameStates.PAUSED);
      return;
    }
    if (levelEditor) levelEditor.handleKey(keyCode);
    return;
  }

  // Combat pattern mini-game intercept — arrow keys go to the mini-game
  if (window._combatPatternActive) {
    if (typeof window._handlePatternKey === 'function') {
      window._handlePatternKey(keyCode);
    }
    return false; // prevent default & skip all other key handling
  }

  // Minigame key intercept — let minigame consume keys
  if (minigameManager && minigameManager.active) {
    if (typeof minigameManager.handleKey === 'function') {
      minigameManager.handleKey(keyCode);
    }
    return false;
  }

  // Debug quick-spawn (only when DEBUG_PARTICLES is enabled): 'P'
  if (window.DEBUG_PARTICLES && keyCode === 80) { // 'P'
    try {
      const cvs = document.querySelector('canvas');
      if (cvs && typeof particleSystem !== 'undefined') {
        const cvsRect = cvs.getBoundingClientRect();
        const sxCss = (cvsRect.width) / 2;
        const syCss = (cvsRect.height) / 2;
        const scale = (cvs && cvs.width && cvsRect.width) ? (cvs.width / cvsRect.width) : 1;
        particleSystem.spawnBurst(sxCss * scale, syCss * scale, { count: 80, color: '#ffd54f', size: 10, speed: 220, frame: 'Cash', screen: true });
        console.debug('Debug particle burst spawned at canvas center');
        return false;
      }
    } catch (e) {
      _reportRuntimeError('debugParticleSpawn', e);
    }
  }

  // Dig site interaction: E key while on a dig site
  if (isActionKey('speedUp', keyCode) && (_isSurfaceGameplayState() || _isPlanetSurfaceControlActive())) {
    const activeSession = getWorldSession();
    if (_isPlanetSurfaceSession(activeSession)
      && player?.currentCity
      && player.currentCity.hasSpaceport
      && _isLandingCityForSession(player.currentCity, activeSession)) {
      const launchCityName = player.currentCity.name;
      const result = (typeof window.BQLiftOffPlanetSurface === 'function')
        ? window.BQLiftOffPlanetSurface()
        : { ok: false, reason: 'launch_unavailable' };
      if (!result.ok) {
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log(`Lift-off failed: ${result.reason}`, 'warning');
        }
        return false;
      }
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Lift-off complete from ${launchCityName || activeSession.spaceContext?.bodyName || 'surface'}. Back in local space.`, 'info');
      }
      _enterSpaceState();
      return false;
    }
    const cityHere = _getPlayerTileCity();
    if (cityHere && !player?.currentCity) {
      _openCityView(cityHere);
      return false;
    }
    if (treasureSystem) {
      const dig = treasureSystem.getDigSiteAtPlayer();
      if (dig) {
        treasureSystem.startDig(dig);
        return; // consume key — don't also speed up
      }
    }
  }

  // Inventory toggle
  if (isActionKey('inventory', keyCode)) {
    if (gameStateManager.is(GameStates.INVENTORY)) {
      gameStateManager.setState(_getPlayableReturnState());
    } else if (_isSurfaceGameplayState() || gameStateManager.is(GameStates.CITY_MANAGE)) {
      gameStateManager.setState(GameStates.INVENTORY);
    }
  }

  // Pause / Escape
  if (isActionKey('pause', keyCode)) {
    // States that block Escape
    if (gameStateManager.is(GameStates.RANDOM_EVENT)) return;
    if (gameStateManager.is(GameStates.GAMEWON)) return;
    if (gameStateManager.is(GameStates.GAMELOSE)) return;
    if (gameStateManager.is(GameStates.MAIN_MENU)) return;
    if (gameStateManager.is(GameStates.NEW_GAME_CONFIG)) return;

    if (gameStateManager.is(GameStates.INVENTORY)) {
      gameStateManager.setState(window._isCityManageMode ? GameStates.CITY_MANAGE : _getSurfaceGameplayState());
      return;
    }
    if (gameStateManager.is(GameStates.SETTINGS)) {
      gameStateManager.setState(gameStateManager.prev);
      return;
    }
    if (gameStateManager.is(GameStates.SPACE)) {
      const sys = player?._spaceTravelSystem || (typeof window._spaceTravelSystem !== 'undefined' ? window._spaceTravelSystem : null);
      if (sys && typeof sys.phase === 'string' && sys.phase !== 'grounded') {
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log('Return to ground before leaving orbit.', 'info');
        }
        return;
      }
      if (player && typeof player.returnFromSpace === 'function') player.returnFromSpace();
      gameStateManager.setState(window._spaceReturnState || (window._isCityManageMode ? GameStates.CITY_MANAGE : _getSurfaceGameplayState()));
      return;
    }
    // Toggle pause — works from PLAYING, COMBAT, or CITY_MANAGE
    if (gameStateManager.is(GameStates.PAUSED)) {
      gameStateManager.setState(window._pauseReturnState || gameStateManager.prev || _getSurfaceGameplayState());
    } else if (_isSurfaceGameplayState() || gameStateManager.is(GameStates.COMBAT) || gameStateManager.is(GameStates.CITY_MANAGE) || gameStateManager.is(GameStates.LEVEL_EDITOR)) {
      window._pauseReturnState = gameStateManager.getState();
      gameStateManager.setState(GameStates.PAUSED);
    }
  }

  // Game speed: faster / slower
  if (isActionKey('speedUp', keyCode) && (_isSurfaceGameplayState() || gameStateManager.is(GameStates.CITY_MANAGE) || gameStateManager.is(GameStates.SPACE))) {
    if (gameSpeedIndex < SPEED_STEPS.length - 1) {
      gameSpeedIndex++;
      gameSpeed = SPEED_STEPS[gameSpeedIndex];
      syncSpeedDisplay();
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Game speed: ${gameSpeed}×`, "info");
      }
    }
  }
  if (isActionKey('speedDown', keyCode) && (_isSurfaceGameplayState() || gameStateManager.is(GameStates.CITY_MANAGE) || gameStateManager.is(GameStates.SPACE))) {
    if (gameSpeedIndex > 0) {
      gameSpeedIndex--;
      gameSpeed = SPEED_STEPS[gameSpeedIndex];
      syncSpeedDisplay();
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Game speed: ${gameSpeed}×`, "info");
      }
    }
  }

  // Camera zoom
  if (_isSurfaceGameplayState() || gameStateManager.is(GameStates.CITY_MANAGE)) {
    if (isActionKey('zoomOut', keyCode)) {
      camZoom = constrain(camZoom - 0.1, 0.15, 2);
      if (Math.abs(camZoom - 1) < 0.06) camZoom = 1;
    }
    if (isActionKey('zoomIn', keyCode)) {
      camZoom = constrain(camZoom + 0.1, 0.15, 2);
      if (Math.abs(camZoom - 1) < 0.06) camZoom = 1;
    }
    if (isActionKey('zoomReset', keyCode)) {
      camZoom = 1;
    }
  }

  if (gameStateManager.is(GameStates.SPACE) && keyCode === 77) {
    window._spaceHudCollapsed = !window._spaceHudCollapsed;
    if (typeof window._refreshSpaceUI === 'function') window._refreshSpaceUI();
    return false;
  }

	  if (gameStateManager.is(GameStates.SPACE) && keyCode === 69) {
    if (window._spaceRouteQTEActive) return false;
	    const sys = player?._spaceTravelSystem || window._spaceTravelSystem || null;
	    if (!sys) return false;
    if (sys.phase === 'landed') {
      const result = sys.liftOff();
      if (result.ok && typeof notificationManager !== 'undefined') {
        notificationManager.log('Lift-off complete. Back in local space.', 'info');
      } else if (!result.ok && typeof notificationManager !== 'undefined') {
        notificationManager.log(`Lift-off failed: ${result.reason || 'unknown'}`, 'warning');
      }
	    } else if (sys.phase === 'in_orbit' && typeof sys.dockNearestBody === 'function') {
      const nearest = typeof sys.getNearestBody === 'function' ? sys.getNearestBody() : null;
      if (!nearest) {
        if (typeof notificationManager !== 'undefined') notificationManager.log('No dockable body nearby.', 'warning');
        return false;
      }
      _runSpaceOperationalQTE(
        typeof sys.getDockingManeuverConfig === 'function' ? sys.getDockingManeuverConfig(nearest) : null,
        (qteResult = {}) => {
		      const result = sys.dockNearestBody({ qteScore: qteResult.score });
          if (!result.ok) {
            if (typeof notificationManager !== 'undefined') {
              notificationManager.log(`Docking failed: ${result.reason || 'unknown'}`, 'warning');
            }
            if (typeof window._syncPlayerSpaceTravelFromSystem === 'function') window._syncPlayerSpaceTravelFromSystem();
            if (typeof window._refreshSpaceUI === 'function') window._refreshSpaceUI();
            return;
          }
		      if (result.ok && result.body?.key === 'homeworld' && typeof sys.returnToAdventureSurface === 'function') {
	        sys.returnToAdventureSurface();
        if (typeof window.BQActivateWorldSession === 'function') {
          window.BQActivateWorldSession(window.BQ_WORLD_SESSION_KEYS?.HOMEWORLD || 'homeworld');
        }
        if (player && typeof player.returnFromSpace === 'function') player.returnFromSpace();
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log('Landed on Earth. Back on the world map.', 'success');
        }
	        gameStateManager.setState(window._spaceReturnState || _getPlayableReturnState());
	        return;
	      }
	      if (result.ok && result.body && typeof window.BQEnterPlanetSurfaceFromSpace === 'function') {
	        const landed = window.BQEnterPlanetSurfaceFromSpace(sys, result.body);
        if (!landed?.ok) {
	          if (typeof notificationManager !== 'undefined') {
	            notificationManager.log(`Surface handoff failed: ${landed?.reason || 'unknown'}`, 'warning');
	          }
	          return;
	        }
	        if (typeof notificationManager !== 'undefined') {
            if (result.damage > 0) notificationManager.log(`Rough approach: -${result.damage}% hull.`, 'warning');
	          notificationManager.log(`Landed on ${result.body.name}. Enter the landing city and use Return To Orbit when you're ready to leave.`, 'success');
	        }
	        gameStateManager.setState(_getSurfaceGameplayState(landed.session));
	        return;
	      }
	      if (result.ok && typeof notificationManager !== 'undefined') {
          if (result.damage > 0) notificationManager.log(`Rough approach: -${result.damage}% hull.`, 'warning');
	        notificationManager.log(`Docked at ${result.body.name}.`, 'success');
	      }
        if (typeof window._syncPlayerSpaceTravelFromSystem === 'function') window._syncPlayerSpaceTravelFromSystem();
        if (typeof window._refreshSpaceUI === 'function') window._refreshSpaceUI();
        }
      );
	    }
    if (typeof window._syncPlayerSpaceTravelFromSystem === 'function') window._syncPlayerSpaceTravelFromSystem();
    if (typeof window._refreshSpaceUI === 'function') window._refreshSpaceUI();
    return false;
  }
}

function mousePressed() {
  // Reset touch-drag state on every new press
  _touchStartX = mouseX;
  _touchStartY = mouseY;
  _touchIsDragging = false;
  _pendingMoveX = -1;
  if (!gameStateManager) return;
  const pointerTarget = document.elementFromPoint(mouseX, mouseY);

  if (gameStateManager.is(GameStates.LEVEL_EDITOR)) {
    // Don't capture clicks on the toolbar DOM
    const target = pointerTarget;
    if (target && target.tagName !== 'CANVAS') return;
    if (levelEditor) levelEditor.onMousePressed(mouseX, mouseY, mouseButton);
    return;
  }
  if (mouseButton === LEFT && (_isSurfaceGameplayState() || gameStateManager.is(GameStates.CITY_MANAGE))) {
    // Don't move if clicking on a UI element (DOM overlay)
    const target = pointerTarget;
    if (target && target.tagName !== 'CANVAS') return;

    // Check minimap click — toggle mode (only if not clicking buttons)
    const metrics = _getMinimapMetrics();
    const mmSize = metrics.size;
    const mmX = metrics.x;
    const mmY = metrics.y;
    if (_isMinimapVisible() && mouseX >= mmX && mouseX <= mmX + mmSize && mouseY >= mmY && mouseY <= mmY + mmSize) {
      const cur = _getMinimapMode();
      _minimapMode = (cur === 'regional') ? 'world' : 'regional';
      return; // consume click
    }

    // Don't move if city view or any overlay is open
    if (!gameStateManager.is(GameStates.CITY_MANAGE) && _isCityViewOpen()) return;

    // City Management mode: click-to-settle in placement phase, founding mode when settled
    if (gameStateManager.is(GameStates.CITY_MANAGE)) {
      if (cityManagement && cityManagement.isSettled) {
        // Check founding mode — clicking a tile to found a new city
        if (window._cityMgmtFoundingMode) {
          const { gridX, gridY } = screenToGridTile(mouseX, mouseY);
          if (gridX >= 0 && gridX < cols && gridY >= 0 && gridY < rows) {
            const tile = grid[gridY]?.[gridX];
            if (!tile || tile.options[0] === 'Water') {
              if (typeof notificationManager !== 'undefined')
                notificationManager.log("Can't found a city on water!", 'error');
              return;
            }
            const cost = 500;
            if (!cityManagement.myCity.management || cityManagement._availableFunds(cityManagement.myCity) < cost) {
              if (typeof notificationManager !== 'undefined')
                notificationManager.log("Need 500g in city treasury!", 'error');
              window._cityMgmtFoundingMode = false;
              return;
            }
            const name = prompt("Name the new city:", `Outpost ${Math.floor(Math.random() * 1000)}`);
            if (name === null) return; // cancelled
            const res = cityManagement.foundCityAt(gridX, gridY, name || undefined);
            if (res.ok) {
              cityManagement._spendPooled(cityManagement.myCity, cost);
              window._cityMgmtFoundingMode = false;
              if (typeof notificationManager !== 'undefined')
                notificationManager.log(`Founded ${res.city.name}! (-${cost}g)`, 'success');
              uiManager.onGameStateChange(GameStates.CITY_MANAGE);
            } else {
              const msgs = { water: "Can't settle on water!", occupied: "A city already exists here!", out_of_bounds: "Invalid location!" };
              if (typeof notificationManager !== 'undefined')
                notificationManager.log(msgs[res.reason] || "Failed to found city.", 'error');
            }
          }
          return;
        }
        const { gridX, gridY } = screenToGridTile(mouseX, mouseY);
        if (gridX >= 0 && gridX < cols && gridY >= 0 && gridY < rows
            && cityManagement.myCity
            && typeof cityManagement.handleUnitMapClick === 'function') {
          const result = cityManagement.handleUnitMapClick(cityManagement.myCity, gridX, gridY, { requireQTE: true });
          if (result && result.handled) {
            if (result.action === 'attack_qte' && typeof window._runUnitRaidQTE === 'function') {
              window._runUnitRaidQTE(result.unit, result.raider, (qte) => {
                try {
                  const finalRes = cityManagement.resolveUnitRaidWithQTE(
                    cityManagement.myCity,
                    result.unit,
                    result.raider,
                    qte?.score
                  );
                  if (!finalRes || !finalRes.ok) {
                    if (typeof notificationManager !== 'undefined') notificationManager.log("Skirmish fizzled out before engagement.", 'warning');
                    return;
                  }
                  if (typeof notificationManager !== 'undefined') {
                    if (finalRes.won) notificationManager.log(`${result.unit.name} defeated the raider!`, 'success');
                    else if (finalRes.unitDied) notificationManager.log(`${result.unit.name} fell in battle.`, 'error');
                    else notificationManager.log(`${result.unit.name} was repelled and took ${finalRes.damage} damage.`, 'warning');
                  }
                } catch (e) {
                  _reportRuntimeError('unitRaidQTEResolve', e);
                }
              });
            } else if (typeof notificationManager !== 'undefined') {
              if (result.action === 'move') notificationManager.log(`${result.unit.name} moving to (${gridX},${gridY}).`, 'info');
              if (result.action === 'chase') notificationManager.log(`${result.unit.name} is chasing a raider.`, 'info');
              if (result.action === 'select') notificationManager.log(`Selected ${result.unit.name}.`, 'info');
              if (result.action === 'attack_win') notificationManager.log(`${result.unit.name} defeated the raider!`, 'success');
              if (result.action === 'attack_loss') notificationManager.log(`${result.unit.name} engaged but took damage.`, 'warning');
              if (result.action === 'cooldown') notificationManager.log(`${result.unit.name} is recovering and can't attack yet.`, 'warning');
              if (result.action === 'blocked') notificationManager.log("Units can't move onto water.", 'warning');
            }
          }
        }
        return;
      }
      // Placement phase: click a tile to settle
      const { gridX, gridY } = screenToGridTile(mouseX, mouseY);
      if (gridX >= 0 && gridX < cols && gridY >= 0 && gridY < rows) {
        const tile = grid[gridY]?.[gridX];
        if (!tile || tile.options[0] === 'Water') {
          if (typeof notificationManager !== 'undefined')
            notificationManager.log("Can't settle on water!", 'error');
          return;
        }
        if (window.cityLocationMap && window.cityLocationMap.has(`${gridX},${gridY}`)) {
          if (typeof notificationManager !== 'undefined')
            notificationManager.log("A city already exists here!", 'error');
          return;
        }
        // Prompt for city name and settle
        const name = prompt("Name your city:", `Settlement ${Math.floor(Math.random() * 1000)}`);
        if (name === null) return; // cancelled
        if (cityManagement) {
          const res = cityManagement.settleAt(gridX, gridY, name || undefined);
          if (res.ok) {
            uiManager.onGameStateChange(GameStates.CITY_MANAGE);
          } else {
            const msgs = { water: "Can't settle on water!", occupied: "A city already exists here!", out_of_bounds: "Invalid location!" };
            if (typeof notificationManager !== 'undefined')
              notificationManager.log(msgs[res.reason] || "Failed to settle.", 'error');
          }
        }
      }
      return;
    }

    const { gridX, gridY } = resolveMoveTapTarget(mouseX, mouseY, player.activeBoat !== null);
    const _clickedTile = (gridX >= 0 && gridX < cols && gridY >= 0 && gridY < rows)
      ? grid[gridY]?.[gridX] : null;
    if (_clickedTile) {
      const clickedPlayerTile = gridX === player.x && gridY === player.y;
      const cityHere = clickedPlayerTile ? _getPlayerTileCity() : null;
      if (cityHere) {
        _openCityView(cityHere);
        return;
      }
      const tileType = _clickedTile.options[0];
      const canSail = player.activeBoat !== null;

      // Allow clicking water only if player has a boat
      if (tileType === 'Water' && !canSail) return;

      // On mobile, defer pathfinding to mouseReleased so drag-panning doesn't trigger movement
      if (typeof isMobile === 'function' && isMobile()) {
        _pendingMoveX = gridX;
        _pendingMoveY = gridY;
        _pendingMoveSail = canSail;
      } else {
        player.setPathTo(gridX, gridY, canSail);
      }
    }
  }
}

function mouseDragged() {
  if (!gameStateManager) return;

  // Mobile: single-finger drag pans the camera once drag threshold is exceeded
  if (typeof isMobile === 'function' && isMobile()
      && (_isSurfaceGameplayState() || gameStateManager.is(GameStates.CITY_MANAGE))
      && !(minigameManager && minigameManager.active)) {
    const dx = mouseX - pmouseX;
    const dy = mouseY - pmouseY;
    const fromStartX = mouseX - _touchStartX;
    const fromStartY = mouseY - _touchStartY;
    const distFromStart = Math.sqrt(fromStartX * fromStartX + fromStartY * fromStartY);
    if (_touchIsDragging || distFromStart > _touchPanThresholdPx) {
      _touchIsDragging = true;
      const el = document.elementFromPoint(mouseX, mouseY);
      if (!el || el.tagName === 'CANVAS') {
        camX -= dx / camZoom;
        camY -= dy / camZoom;
      }
      return;
    }
  }

  if (gameStateManager.is(GameStates.LEVEL_EDITOR) && levelEditor) {
    const target = document.elementFromPoint(mouseX, mouseY);
    if (target && target.tagName !== 'CANVAS') return;
    levelEditor.onMouseDragged(mouseX, mouseY);
  }
}

function mouseReleased() {
  if (!gameStateManager) {
    _pendingMoveX = -1;
    _touchStartX = 0;
    _touchStartY = 0;
    _touchIsDragging = false;
    return;
  }

  if (gameStateManager.is(GameStates.LEVEL_EDITOR) && levelEditor) {
    levelEditor.onMouseReleased();
  }

  // Mobile: fire deferred pathfinding if the touch was a tap (not a drag)
  if (typeof isMobile === 'function' && isMobile()
      && _pendingMoveX >= 0 && !_touchIsDragging
      && (_isSurfaceGameplayState() || gameStateManager.is(GameStates.CITY_MANAGE))
      && player) {
    player.setPathTo(_pendingMoveX, _pendingMoveY, _pendingMoveSail);
  }
  _pendingMoveX = -1;
  _touchStartX = 0;
  _touchStartY = 0;
  _touchIsDragging = false;
}

function mouseWheel(e) {
  if (!gameStateManager) return;

  // Don't zoom when scrolling over UI elements (shop, inventory, popups, etc.)
  if (e.target && e.target.tagName !== 'CANVAS') return;

  // Level editor zoom
  if (gameStateManager.is(GameStates.LEVEL_EDITOR) && levelEditor) {
    levelEditor.onMouseWheel(e.delta);
    return false;
  }

  // Don't zoom when hovering over minimap
  const metrics = _getMinimapMetrics();
  const mmSize = metrics.size;
  const mmX = metrics.x;
  const mmY = metrics.y;
  if (_isMinimapVisible() && mouseX >= mmX && mouseX <= mmX + mmSize && mouseY >= mmY && mouseY <= mmY + mmSize) return;

  if (!_isSurfaceGameplayState() && !gameStateManager.is(GameStates.CITY_MANAGE)) return;

  const oldZoom = camZoom;
  camZoom = constrain(camZoom - e.delta * 0.001, 0.15, 2);
  // Snap to 1.0 when close
  if (Math.abs(camZoom - 1) < 0.03) camZoom = 1;
  if (camZoom !== oldZoom) return false; // prevent page scroll
}

// Simple 2D screen-to-grid conversion (zoom-aware)
function screenToGridTile(mx, my) {
  const worldX = (mx - width / 2) / camZoom + camX;
  const worldY = (my - height / 2) / camZoom + camY;
  return {
    gridX: Math.floor(worldX / tileSize),
    gridY: Math.floor(worldY / tileSize),
  };
}

function resolveMoveTapTarget(mx, my, allowWater = false) {
  const worldX = (mx - width / 2) / camZoom + camX;
  const worldY = (my - height / 2) / camZoom + camY;
  let gridX = Math.floor(worldX / tileSize);
  let gridY = Math.floor(worldY / tileSize);

  if (!(typeof isMobile === 'function' && isMobile()) || !player) {
    return { gridX, gridY };
  }

  if (gridX !== player.x || gridY !== player.y) {
    return { gridX, gridY };
  }

  const playerCenterX = (player.x + 0.5) * tileSize;
  const playerCenterY = (player.y + 0.5) * tileSize;
  const dxTiles = (worldX - playerCenterX) / tileSize;
  const dyTiles = (worldY - playerCenterY) / tileSize;
  const deadzoneTiles = 0.3;

  if (Math.max(Math.abs(dxTiles), Math.abs(dyTiles)) < deadzoneTiles) {
    return { gridX, gridY };
  }

  let assistDx = Math.max(-2, Math.min(2, Math.round(dxTiles)));
  let assistDy = Math.max(-2, Math.min(2, Math.round(dyTiles)));

  if (assistDx === 0 && assistDy === 0) {
    if (Math.abs(dxTiles) >= Math.abs(dyTiles)) assistDx = dxTiles >= 0 ? 1 : -1;
    else assistDy = dyTiles >= 0 ? 1 : -1;
  }

  const targetX = Math.max(0, Math.min(cols - 1, player.x + assistDx));
  const targetY = Math.max(0, Math.min(rows - 1, player.y + assistDy));
  const targetTile = grid[targetY]?.[targetX];

  if (!targetTile) return { gridX, gridY };
  if (targetTile.options?.[0] === 'Water' && !allowWater) {
    return { gridX, gridY };
  }

  return { gridX: targetX, gridY: targetY };
}

// ===================== MINIMAP =====================

let _minimapBuildJob = null;
let _minimapBuildProgress = 0;
let _minimapReady = false;
let _minimapCache = new Map(); // key -> { graphics, usedAt }
const _MINIMAP_CACHE_MAX = 4;

function _computeTerrainFingerprint(sampleCount = 512) {
  if (!grid || !rows || !cols) return 'empty';
  let h = 2166136261 >>> 0;
  const steps = Math.max(1, Math.floor(Math.sqrt(sampleCount)));
  const stepX = Math.max(1, Math.floor(cols / steps));
  const stepY = Math.max(1, Math.floor(rows / steps));

  for (let y = 0; y < rows; y += stepY) {
    const row = grid[y];
    if (!row) continue;
    for (let x = 0; x < cols; x += stepX) {
      const type = row[x]?.options?.[0] || 'Water';
      for (let ci = 0; ci < type.length; ci++) {
        h ^= ((type.charCodeAt(ci) + x * 17 + y * 31) >>> 0);
        h = Math.imul(h, 16777619) >>> 0;
      }
    }
  }
  return `${h.toString(16)}:${rows}x${cols}`;
}

function _minimapOwnedSignature() {
  if (!player || !Array.isArray(player.ownedCities) || player.ownedCities.length === 0) return 'none';
  return player.ownedCities.slice().sort((a, b) => a - b).join(',');
}

function _buildMinimapCacheKey() {
  const seedPart = typeof window._mapSeed === 'number' ? window._mapSeed : -1;
  const customPart = window._isCustomMap ? 1 : 0;
  const cityPart = Array.isArray(cities) ? cities.length : 0;
  const paletteVersion = 2; // bump when minimap marker palette changes
  return `${rows}x${cols}|seed:${seedPart}|custom:${customPart}|fp:${_computeTerrainFingerprint()}|city:${cityPart}|own:${_minimapOwnedSignature()}|pal:${paletteVersion}`;
}

function _cacheMinimap(key, graphics) {
  _minimapCache.set(key, { graphics, usedAt: frameCount || 0 });
  if (_minimapCache.size <= _MINIMAP_CACHE_MAX) return;
  let lruKey = null;
  let lruFrame = Infinity;
  for (const [k, v] of _minimapCache.entries()) {
    if (v.usedAt < lruFrame) {
      lruFrame = v.usedAt;
      lruKey = k;
    }
  }
  if (lruKey && lruKey !== key) _minimapCache.delete(lruKey);
}

function invalidateMinimap(forceClearCache = false) {
  _minimapBuildJob = null;
  _minimapBuildProgress = 0;
  _minimapReady = false;
  minimapGraphics = null;
  _regionBuf = null;
  _regionBufCenterX = -1;
  _regionBufCenterY = -1;
  _minimapMode = 'auto';
  if (forceClearCache) _minimapCache.clear();
}
window.invalidateMinimap = invalidateMinimap;

function generateMinimap() {
  if (!grid || !grid.length || grid.length === 0) {
    console.error('Grid not initialized when generateMinimap called');
    return;
  }

  // Invalidate regional cache
  _regionBuf = null;
  _regionBufCenterX = -1;
  _regionBufCenterY = -1;
  _minimapMode = 'auto';

  const key = _buildMinimapCacheKey();
  const cached = _minimapCache.get(key);
  if (cached && cached.graphics) {
    minimapGraphics = cached.graphics;
    cached.usedAt = frameCount || 0;
    _minimapBuildJob = null;
    _minimapBuildProgress = 1;
    _minimapReady = true;
    return;
  }

  const mmSize = 200;
  minimapGraphics = createGraphics(mmSize, mmSize);
  minimapGraphics.pixelDensity(1);
  minimapGraphics.noStroke();
  minimapGraphics.background(12, 14, 20);

  const maxDim = Math.max(cols, rows);
  const scale = mmSize / maxDim;
  const d = minimapGraphics._pixelDensity || 1;
  const pw = mmSize * d;
  const ph = mmSize * d;

  const getTerrainColor = (typeof window !== 'undefined' && typeof window.BQGetTerrainColor === 'function')
    ? window.BQGetTerrainColor
    : null;
  _minimapBuildJob = {
    key,
    size: mmSize,
    scale,
    maxDim,
    row: 0,
    rowsTotal: ph,
    pixelWidth: pw,
    colorMap: {
      Water: getTerrainColor ? getTerrainColor('Water', true) : [0, 100, 180],
      Sand: getTerrainColor ? getTerrainColor('Sand', true) : [194, 178, 128],
      Grass: getTerrainColor ? getTerrainColor('Grass', true) : [85, 145, 50],
      Forest: getTerrainColor ? getTerrainColor('Forest', true) : [34, 75, 28],
      Snow: getTerrainColor ? getTerrainColor('Snow', true) : [235, 240, 250],
      Rock: getTerrainColor ? getTerrainColor('Rock', true) : [110, 110, 110],
      Sulfur: getTerrainColor ? getTerrainColor('Sulfur', true) : [217, 207, 74],
    },
  };
  minimapGraphics.loadPixels();
  _minimapBuildProgress = 0;
  _minimapReady = false;
}

function _finalizeMinimapBuild(job) {
  if (!minimapGraphics) return;
  minimapGraphics.updatePixels();

  const markerSize = Math.max(2, Math.min(4, Math.ceil(job.scale * 3)));
  for (const city of cities) {
    const isOwned = player && player.ownsCity && player.ownsCity(city);
    if (isOwned) {
      minimapGraphics.fill(156, 109, 255);
      minimapGraphics.rect(city.location.x * job.scale - 1, city.location.y * job.scale - 1, markerSize + 1, markerSize + 1);
    } else if (city.isCoastal) {
      minimapGraphics.fill(0, 200, 255);
      minimapGraphics.rect(city.location.x * job.scale - 1, city.location.y * job.scale - 1, markerSize + 1, markerSize + 1);
    } else {
      minimapGraphics.fill(255, 215, 0);
      minimapGraphics.rect(city.location.x * job.scale - 1, city.location.y * job.scale - 1, markerSize, markerSize);
    }
  }

  _cacheMinimap(job.key, minimapGraphics);
  _minimapBuildProgress = 1;
  _minimapReady = true;
}

function _tickMinimapBuild() {
  const job = _minimapBuildJob;
  if (!job || !minimapGraphics) return;

  // Row-budgeted incremental work to avoid load hitches.
  const rowsPerFrame = 24;
  const endRow = Math.min(job.rowsTotal, job.row + rowsPerFrame);
  const pix = minimapGraphics.pixels;

  for (let py = job.row; py < endRow; py++) {
    const gridRow = Math.min(rows - 1, Math.max(0, Math.floor((py / (minimapGraphics._pixelDensity || 1)) / job.scale)));
    const row = grid[gridRow];
    if (!row) continue;

    for (let px = 0; px < job.pixelWidth; px++) {
      const gridCol = Math.min(cols - 1, Math.max(0, Math.floor((px / (minimapGraphics._pixelDensity || 1)) / job.scale)));
      const type = row[gridCol]?.options?.[0] || 'Water';
      const c = job.colorMap[type] || [0, 0, 0];
      const idx = 4 * (py * job.pixelWidth + px);
      pix[idx]     = c[0];
      pix[idx + 1] = c[1];
      pix[idx + 2] = c[2];
      pix[idx + 3] = 255;
    }
  }

  job.row = endRow;
  _minimapBuildProgress = Math.min(1, job.row / job.rowsTotal);
  if (job.row < job.rowsTotal) return;

  _finalizeMinimapBuild(job);
  _minimapBuildJob = null;
}

// ===================== MINIMAP RENDERING =====================
// Two modes: regional (zoomed, centered on player) and world (full overview).
// Click minimap to toggle. Regional is the default for large maps.

let _minimapMode = 'auto'; // 'auto' picks regional for big maps, world for small
let _minimapVisible = null; // mobile defaults to hidden until explicitly opened
let _minimapRegionalRadius = 60; // how many tiles around the player to show
let _regionBuf = null;           // cached p5.Graphics for regional terrain
let _regionBufCenterX = -1;      // tile coord the buffer was built around
let _regionBufCenterY = -1;

function _isMobileMinimapViewport() {
  try {
    return typeof window !== 'undefined'
      && typeof window.isMobile === 'function'
      && window.isMobile();
  } catch (_e) {
    return false;
  }
}

function _getMinimapMetrics() {
  const viewportWidth = (typeof width !== 'undefined' && Number.isFinite(width))
    ? width
    : ((typeof window !== 'undefined' && Number.isFinite(window.innerWidth)) ? window.innerWidth : 1280);
  const mobile = _isMobileMinimapViewport();
  const size = mobile
    ? Math.max(144, Math.min(176, Math.round(viewportWidth * 0.38)))
    : 200;
  return {
    size,
    x: viewportWidth - size - 10,
    y: 10,
  };
}

function _isMinimapVisible() {
  if (!_isMobileMinimapViewport()) return true;
  if (_minimapVisible === null) return false;
  return !!_minimapVisible;
}

window.isMinimapVisible = function isMinimapVisible() {
  return _isMinimapVisible();
};

window.toggleMinimapVisibility = function toggleMinimapVisibility(forceVisible) {
  if (!_isMobileMinimapViewport()) return true;
  _minimapVisible = (typeof forceVisible === 'boolean') ? forceVisible : !_isMinimapVisible();
  return _isMinimapVisible();
};

function _getMinimapMode() {
  if (_minimapMode === 'auto') {
    return Math.max(cols, rows) > 200 ? 'regional' : 'world';
  }
  return _minimapMode;
}

function renderMinimap() {
  if (!minimapGraphics) return;
  if (!_isMinimapVisible()) return;
  
  const metrics = _getMinimapMetrics();
  const mmSize = metrics.size;
  const mmX = metrics.x;
  const mmY = metrics.y;
  const mode = _getMinimapMode();

  push();

  // Background
  fill(0, 0, 0, 200);
  noStroke();
  rect(mmX - 2, mmY - 2, mmSize + 4, mmSize + 4, 6);

  if (!_minimapReady && _minimapBuildJob) {
    // Placeholder minimap while the background build job runs.
    fill(8, 12, 18, 245);
    noStroke();
    rect(mmX, mmY, mmSize, mmSize, 6);
    fill(145, 175, 195);
    textAlign(CENTER, CENTER);
    textSize(11);
    text(`Building minimap ${Math.round(_minimapBuildProgress * 100)}%`, mmX + mmSize / 2, mmY + mmSize / 2);
  } else if (mode === 'regional') {
    _renderMinimapRegional(mmX, mmY, mmSize);
  } else {
    _renderMinimapWorld(mmX, mmY, mmSize);
  }
  
  // Border
  noFill();
  stroke(100, 100, 100);
  strokeWeight(1);
  rect(mmX - 1, mmY - 1, mmSize + 2, mmSize + 2, 6);

  pop();
}

function _iterMinimapUnits(visit) {
  if (!Array.isArray(cities) || typeof visit !== 'function') return;
  for (const city of cities) {
    const units = city?.management?.units;
    if (!Array.isArray(units) || units.length === 0) continue;
    for (const u of units) {
      if (!u) continue;
      if ((u.state === 'defeated') || (Number(u.hp) <= 0)) continue;
      const ux = Number(u.x);
      const uy = Number(u.y);
      if (!Number.isFinite(ux) || !Number.isFinite(uy)) continue;
      visit(u, city, ux, uy);
    }
  }
}

function _minimapUnitStyle(city) {
  const isOwned = !!(player && typeof player.ownsCity === 'function' && player.ownsCity(city));
  return isOwned
    ? { fill: [170, 120, 255, 230], stroke: [25, 12, 45, 190] }
    : { fill: [255, 145, 85, 210], stroke: [45, 18, 8, 175] };
}

/** Regional minimap — zoomed view around the player */
function _renderMinimapRegional(mmX, mmY, mmSize) {
  const rad = _minimapRegionalRadius;
  const diameter = rad * 2;
  const pxPerTile = mmSize / diameter;

  // Tile bounds to render
  const cx = player.x;
  const cy = player.y;
  const tileStartX = cx - rad;
  const tileStartY = cy - rad;

  // Rebuild regional terrain cache only when player moves to a new tile
  if (!_regionBuf || _regionBufCenterX !== cx || _regionBufCenterY !== cy) {
    if (!_regionBuf) {
      _regionBuf = createGraphics(mmSize, mmSize);
      _regionBuf.pixelDensity(1);
    }
    _regionBufCenterX = cx;
    _regionBufCenterY = cy;

    const getTerrainColor = (typeof window !== 'undefined' && typeof window.BQGetTerrainColor === 'function')
      ? window.BQGetTerrainColor
      : null;
    const colorMap = {
      Water: getTerrainColor ? getTerrainColor('Water', true) : [0, 100, 180],
      Sand: getTerrainColor ? getTerrainColor('Sand', true) : [194, 178, 128],
      Grass: getTerrainColor ? getTerrainColor('Grass', true) : [85, 145, 50],
      Forest: getTerrainColor ? getTerrainColor('Forest', true) : [34, 75, 28],
      Snow: getTerrainColor ? getTerrainColor('Snow', true) : [235, 240, 250],
      Rock: getTerrainColor ? getTerrainColor('Rock', true) : [110, 110, 110],
      Sulfur: getTerrainColor ? getTerrainColor('Sulfur', true) : [217, 207, 74],
    };

    // Use pixel manipulation for speed
    _regionBuf.loadPixels();
    const d = _regionBuf._pixelDensity || 1;
    const pw = mmSize * d;
    const pix = _regionBuf.pixels;

    for (let py = 0; py < mmSize; py++) {
      const gy = tileStartY + Math.floor(py / pxPerTile);
      if (gy < 0 || gy >= rows) {
        // Out-of-bounds fog color
        for (let px = 0; px < mmSize; px++) {
          const idx = 4 * (py * pw + px);
          pix[idx] = 10; pix[idx+1] = 10; pix[idx+2] = 15; pix[idx+3] = 230;
        }
        continue;
      }
      const row = grid[gy];
      if (!row) continue;
      for (let px = 0; px < mmSize; px++) {
        const gx = tileStartX + Math.floor(px / pxPerTile);
        const idx = 4 * (py * pw + px);
        if (gx < 0 || gx >= cols) {
          pix[idx] = 10; pix[idx+1] = 10; pix[idx+2] = 15; pix[idx+3] = 230;
        } else {
          const type = row[gx]?.options?.[0] || 'Water';
          const c = colorMap[type] || [0, 0, 0];
          pix[idx] = c[0]; pix[idx+1] = c[1]; pix[idx+2] = c[2]; pix[idx+3] = 255;
        }
      }
    }
    _regionBuf.updatePixels();
  }

  // Blit cached terrain
  image(_regionBuf, mmX, mmY);

  // Cities within range
  for (const city of cities) {
    const rx = city.location.x - tileStartX;
    const ry = city.location.y - tileStartY;
    if (rx < -1 || rx > diameter + 1 || ry < -1 || ry > diameter + 1) continue;
    const sx = mmX + rx * pxPerTile;
    const sy = mmY + ry * pxPerTile;
    const dotSz = Math.max(5, pxPerTile * 0.9);
    const isOwned = player && player.ownsCity && player.ownsCity(city);

    // Glow
    noStroke();
    if (isOwned) {
      fill(156, 109, 255, 80);
    } else {
      fill(city.isCoastal ? 0 : 212, city.isCoastal ? 200 : 175, city.isCoastal ? 255 : 55, 80);
    }
    ellipse(sx + pxPerTile / 2, sy + pxPerTile / 2, dotSz + 4, dotSz + 4);

    // Dot
    if (isOwned) {
      fill(176, 132, 255);
    } else if (city.isCoastal) {
      fill(0, 200, 255);
    } else {
      fill(255, 215, 0);
    }
    stroke(0, 0, 0, 150);
    strokeWeight(0.5);
    ellipse(sx + pxPerTile / 2, sy + pxPerTile / 2, dotSz, dotSz);

    // Name label
    noStroke();
    fill(255, 255, 255, 220);
    textAlign(CENTER, BOTTOM);
    textSize(Math.max(7, Math.min(10, pxPerTile * 0.7)));
    text(city.name, sx + pxPerTile / 2, sy - 1);
  }

  // Nearby traders
  if (traderManager) {
    for (const t of traderManager.traders) {
      if (t.state === 'dead') continue;
      const rx = t.x - tileStartX;
      const ry = t.y - tileStartY;
      if (rx < 0 || rx >= diameter || ry < 0 || ry >= diameter) continue;
      fill(100, 200, 255);
      noStroke();
      ellipse(mmX + rx * pxPerTile + pxPerTile / 2, mmY + ry * pxPerTile + pxPerTile / 2, 4, 4);
    }
  }

  // Nearby raiders
  if (raiderManager) {
    for (const r of raiderManager.raiders) {
      if (r.state === 'defeated') continue;
      const rx = r.x - tileStartX;
      const ry = r.y - tileStartY;
      if (rx < 0 || rx >= diameter || ry < 0 || ry >= diameter) continue;
      fill(255, 80, 80);
      noStroke();
      rect(mmX + rx * pxPerTile, mmY + ry * pxPerTile,
           Math.max(3, pxPerTile * 0.6), Math.max(3, pxPerTile * 0.6));
    }
  }

  // City units
  _iterMinimapUnits((unit, city, ux, uy) => {
    const rx = ux - tileStartX;
    const ry = uy - tileStartY;
    if (rx < 0 || rx >= diameter || ry < 0 || ry >= diameter) return;
    const sx = mmX + rx * pxPerTile + pxPerTile / 2;
    const sy = mmY + ry * pxPerTile + pxPerTile / 2;
    const style = _minimapUnitStyle(city);
    fill(style.fill[0], style.fill[1], style.fill[2], style.fill[3]);
    stroke(style.stroke[0], style.stroke[1], style.stroke[2], style.stroke[3]);
    strokeWeight(0.6);
    ellipse(sx, sy, Math.max(3, pxPerTile * 0.45), Math.max(3, pxPerTile * 0.45));
  });

  // Survey contract markers (regional minimap)
  if (typeof contractSystem !== 'undefined' && contractSystem) {
    for (const c of contractSystem.active) {
      if (c.type !== 'survey' || !c.surveyPoints) continue;
      for (let j = 0; j < c.surveyPoints.length; j++) {
        const sp = c.surveyPoints[j];
        const rx = sp.x - tileStartX;
        const ry = sp.y - tileStartY;
        if (rx < -1 || rx > diameter + 1 || ry < -1 || ry > diameter + 1) continue;
        const sx = mmX + rx * pxPerTile + pxPerTile / 2;
        const sy = mmY + ry * pxPerTile + pxPerTile / 2;
        const dotSz = Math.max(5, pxPerTile * 0.8);
        if (c.surveyVisited[j]) {
          fill(80, 200, 80, 160);
          noStroke();
          ellipse(sx, sy, dotSz, dotSz);
        } else {
          fill(255, 160, 0, 60);
          noStroke();
          ellipse(sx, sy, dotSz + 4, dotSz + 4);
          fill(255, 180, 30);
          stroke(0, 0, 0, 120);
          strokeWeight(0.5);
          ellipse(sx, sy, dotSz, dotSz);
        }
      }
    }
  }

  // Player crosshair (always center)
  const pcx = mmX + mmSize / 2;
  const pcy = mmY + mmSize / 2;
  if (player.isSailing) {
    fill(0, 220, 255);
    noStroke();
    triangle(pcx, pcy - 4, pcx - 3, pcy + 3, pcx + 3, pcy + 3);
  } else {
    // White ring + red dot
    stroke(255, 255, 255, 200);
    strokeWeight(1.5);
    noFill();
    ellipse(pcx, pcy, 10, 10);
    fill(255, 50, 50);
    noStroke();
    ellipse(pcx, pcy, 5, 5);
  }
}

/** World overview minimap — full map with viewport rectangle */
function _renderMinimapWorld(mmX, mmY, mmSize) {
  // Blit cached terrain
  image(minimapGraphics, mmX, mmY, mmSize, mmSize);

  const maxDim = Math.max(cols, rows);
  const scale = mmSize / maxDim;

  // Viewport rectangle showing what's on screen
  const vpTilesW = width / tileSize;
  const vpTilesH = height / tileSize;
  const vpX = mmX + (player.x - vpTilesW / 2) * scale;
  const vpY = mmY + (player.y - vpTilesH / 2) * scale;
  const vpW = vpTilesW * scale;
  const vpH = vpTilesH * scale;

  noFill();
  stroke(255, 255, 255, 180);
  strokeWeight(1);
  rect(vpX, vpY, vpW, vpH);

  // Player dot
  if (player.isSailing) {
    fill(0, 220, 255);
    noStroke();
    triangle(
      mmX + player.x * scale, mmY + player.y * scale - 3,
      mmX + player.x * scale - 2, mmY + player.y * scale + 2,
      mmX + player.x * scale + 2, mmY + player.y * scale + 2
    );
  } else {
    fill(255, 50, 50);
    noStroke();
    ellipse(mmX + player.x * scale, mmY + player.y * scale, 5, 5);
  }

  // Nearby trader dots only (within 200 tiles of player for perf)
  if (traderManager) {
    fill(100, 200, 255, 200);
    noStroke();
    for (const t of traderManager.traders) {
      if (t.state === 'dead') continue;
      if (Math.abs(t.x - player.x) + Math.abs(t.y - player.y) > 200) continue;
      ellipse(mmX + t.x * scale, mmY + t.y * scale, 3, 3);
    }
  }

  // Nearby raider dots only
  if (raiderManager) {
    fill(255, 80, 80, 200);
    noStroke();
    for (const r of raiderManager.raiders) {
      if (r.state === 'defeated') continue;
      if (Math.abs(r.x - player.x) + Math.abs(r.y - player.y) > 200) continue;
      rect(mmX + r.x * scale - 1, mmY + r.y * scale - 1, 3, 3);
    }
  }

  // Nearby city units only
  _iterMinimapUnits((unit, city, ux, uy) => {
    if (Math.abs(ux - player.x) + Math.abs(uy - player.y) > 260) return;
    const style = _minimapUnitStyle(city);
    fill(style.fill[0], style.fill[1], style.fill[2], style.fill[3]);
    stroke(style.stroke[0], style.stroke[1], style.stroke[2], style.stroke[3]);
    strokeWeight(0.5);
    ellipse(mmX + ux * scale, mmY + uy * scale, 2.8, 2.8);
  });

  // Survey contract markers (world minimap)
  if (typeof contractSystem !== 'undefined' && contractSystem) {
    for (const c of contractSystem.active) {
      if (c.type !== 'survey' || !c.surveyPoints) continue;
      for (let j = 0; j < c.surveyPoints.length; j++) {
        const sp = c.surveyPoints[j];
        const sx = mmX + sp.x * scale;
        const sy = mmY + sp.y * scale;
        if (c.surveyVisited[j]) {
          fill(80, 200, 80, 180);
          noStroke();
          ellipse(sx, sy, 4, 4);
        } else {
          fill(255, 180, 30, 80);
          noStroke();
          ellipse(sx, sy, 7, 7);
          fill(255, 180, 30);
          stroke(0, 0, 0, 120);
          strokeWeight(0.5);
          ellipse(sx, sy, 4, 4);
        }
      }
    }
  }
}
