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
window._newGameCustomMap = null;
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
      icon: '🟢',
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
      permadeath: false,
    },
    normal: {
      label: 'Normal',
      icon: '🟡',
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
      permadeath: false,
    },
    hard: {
      label: 'Hard',
      icon: '🔴',
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
      permadeath: false,
    },
    hardcore: {
      label: 'Hardcore',
      icon: '💀',
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
 * Distance (in tiles) between an entity and the player.
 */
function tileDistToPlayer(ex, ey) {
  return Math.abs(ex - player.x) + Math.abs(ey - player.y);
}

/** Tile-distance threshold — entities beyond this get throttled updates */
let AI_ACTIVE_RADIUS = 80;
/** Entities beyond this radius only update every Nth frame */
let AI_SLEEP_SKIP = 8;

// ===================== LOADING OVERLAY =====================

function showLoadingOverlay(message = 'Loading...') {
  let overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.innerHTML = `
      <div class="loading-content">
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
  NEW_GAME_CONFIG: "newGameConfig",
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
};

let gameStateManager = new GameStateManager();
let uiManager = new UIManager();

const namePool = NameGenerator.generateNames();
var notificationManager;
var traderManager;
var raiderManager;
var combatSystem;
var eventSystem;
var worldInitialized = false;
var _spawnGraceUntil = 0; // millis timestamp — immune to raiders until this time

// ---- New economy / meta systems ----
var minigameManager;
var contractSystem;
var gamblingSystem;
var treasureSystem;
var bankingSystem;
var smugglingSystem;
var bountyBoard;
var tutorialSystem;

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
};

// Runtime keybinding map — deep copy from defaults, can be overwritten
var keyBindings = {};

function _initKeyBindings() {
  // Load from localStorage or use defaults
  const saved = localStorage.getItem("keyBindings");
  if (saved) {
    try {
      keyBindings = JSON.parse(saved);
      // Ensure all actions exist (in case new ones were added)
      for (const action in KEY_DEFAULTS) {
        if (!keyBindings[action]) {
          keyBindings[action] = { ...KEY_DEFAULTS[action], keys: [...KEY_DEFAULTS[action].keys] };
        }
      }
    } catch (e) {
      keyBindings = _cloneDefaults();
    }
  } else {
    keyBindings = _cloneDefaults();
  }
}

function _cloneDefaults() {
  const out = {};
  for (const action in KEY_DEFAULTS) {
    out[action] = { ...KEY_DEFAULTS[action], keys: [...KEY_DEFAULTS[action].keys] };
  }
  return out;
}

function saveKeyBindings() {
  localStorage.setItem("keyBindings", JSON.stringify(keyBindings));
}

function resetKeyBindings() {
  keyBindings = _cloneDefaults();
  saveKeyBindings();
}

/** Check if a keyCode is bound to an action */
function isActionKey(action, kCode) {
  const b = keyBindings[action];
  return b && b.keys.includes(kCode);
}

/** Check if an action key is currently held (for movement) */
function isActionDown(action) {
  const b = keyBindings[action];
  if (!b) return false;
  for (const k of b.keys) {
    if (keyIsDown(k)) return true;
  }
  return false;
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

// Game speed multiplier (1 = normal)
var gameSpeed = 1;
const SPEED_STEPS = [0.25, 0.5, 1, 2, 4];
let gameSpeedIndex = 2; // index into SPEED_STEPS (default = 1x)

/** Single source of truth for updating the HUD speed label */
function syncSpeedDisplay() {
  const lbl = document.getElementById("speedLabel");
  if (lbl) {
    lbl.textContent = gameSpeed === 1 ? '1\u00d7' : `${gameSpeed}\u00d7`;
    lbl.style.color = gameSpeed > 1 ? '#4CAF50' : gameSpeed < 1 ? '#FF9800' : '#aaa';
  }
}

// Movement cooldown
let moveTimer = 0;
const moveDelay = 120; // ms between moves

// Minimap
let minimapGraphics;

// Global list of port city locations for A* land↔water gating
var portCityLocations = [];

// Spatial lookup: "x,y" -> city object for O(1) city-at-tile checks
var cityLocationMap = new Map();

// ===================== SPATIAL GRIDS =====================
// Three separate SpatialGrid instances — one per entity type.
// Cell size = 32 tiles so a typical 1080p viewport spans ~2-3 cells,
// making queryViewport() return only the small visible subset.
var cityGrid   = new SpatialGrid(32);
var traderGrid = new SpatialGrid(32);
var raiderGrid = new SpatialGrid(32);

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
}

/** Rebuild the cityLocationMap from the cities array. Call after generating or loading cities. */
function buildCityLocationMap() {
  cityLocationMap.clear();
  if (!cities) return;
  for (let i = 0; i < cities.length; i++) {
    const city = cities[i];
    city.cityIndex = i; // cache index so city.render() avoids O(N) indexOf calls
    cityLocationMap.set(`${city.location.x},${city.location.y}`, city);
  }
}

/**
 * (Re)populate all three spatial grids from current world state.
 * Call after world gen or save load, once traders + raiders exist.
 * Individual insert/remove/move calls in entity update loops keep
 * the grids current after this initial bulk-load.
 */
function rebuildSpatialGrids() {
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
    SaveSystem.deleteSave();
  }
  gameStateManager.setState(GameStates.GAMELOSE);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  textFont('monospace');

  // Register game states (all, including new config)
  gameStateManager.addState(GameStates.MAIN_MENU, {});
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
  // New system states
  gameStateManager.addState(GameStates.MINIGAME, {});
  gameStateManager.addState(GameStates.GAMBLING, {});
  gameStateManager.addState(GameStates.CONTRACT_BOARD, {});
  gameStateManager.addState(GameStates.BANK, {});
  gameStateManager.addState(GameStates.BOUNTY_BOARD, {});
  gameStateManager.addState(GameStates.BLACK_MARKET, {});
  gameStateManager.addState(GameStates.TREASURE_MAP, {});

  // Define valid state transitions – prevents impossible jumps
  gameStateManager.setTransitionRules({
    "*":            [GameStates.MAIN_MENU],                              // can always go to main menu
    [GameStates.MAIN_MENU]:      [GameStates.NEW_GAME_CONFIG, GameStates.PLAYING, GameStates.SETTINGS, GameStates.LEVEL_EDITOR],
    [GameStates.LEVEL_EDITOR]:   [GameStates.MAIN_MENU, GameStates.PLAYING],
    [GameStates.NEW_GAME_CONFIG]: [GameStates.MAIN_MENU, GameStates.PLAYING],
    [GameStates.SETTINGS]:       [GameStates.MAIN_MENU, GameStates.PLAYING, GameStates.PAUSED],
    [GameStates.PLAYING]:        [GameStates.PAUSED, GameStates.SETTINGS, GameStates.INVENTORY, GameStates.COMBAT, GameStates.RANDOM_EVENT, GameStates.WEEKLY_SUMMARY, GameStates.GAMELOSE, GameStates.GAMEWON, GameStates.MAIN_MENU, GameStates.MINIGAME, GameStates.GAMBLING, GameStates.CONTRACT_BOARD, GameStates.BANK, GameStates.BOUNTY_BOARD, GameStates.BLACK_MARKET, GameStates.TREASURE_MAP],
    [GameStates.PAUSED]:         [GameStates.PLAYING, GameStates.SETTINGS, GameStates.MAIN_MENU],
    [GameStates.INVENTORY]:      [GameStates.PLAYING],
    [GameStates.COMBAT]:         [GameStates.PLAYING, GameStates.GAMELOSE],
    [GameStates.RANDOM_EVENT]:   [GameStates.PLAYING, GameStates.GAMELOSE, GameStates.COMBAT, GameStates.MINIGAME],
    [GameStates.WEEKLY_SUMMARY]:  [GameStates.PLAYING],
    [GameStates.GAMELOSE]:       [GameStates.MAIN_MENU],
    [GameStates.GAMEWON]:        [GameStates.PLAYING, GameStates.MAIN_MENU],
    // New system state transitions — all can return to playing
    [GameStates.MINIGAME]:       [GameStates.PLAYING, GameStates.RANDOM_EVENT, GameStates.GAMBLING],
    [GameStates.GAMBLING]:       [GameStates.PLAYING, GameStates.MINIGAME],
    [GameStates.CONTRACT_BOARD]: [GameStates.PLAYING],
    [GameStates.BANK]:           [GameStates.PLAYING],
    [GameStates.BOUNTY_BOARD]:   [GameStates.PLAYING],
    [GameStates.BLACK_MARKET]:   [GameStates.PLAYING, GameStates.MINIGAME],
    [GameStates.TREASURE_MAP]:   [GameStates.PLAYING],
  });

  gameStateManager.onChange((from, to) => {
    uiManager.onGameStateChange(to);
    // Tutorial: contextual combat tip on first fight
    if (typeof tutorialSystem !== 'undefined' && tutorialSystem) {
      if (to === GameStates.COMBAT) tutorialSystem.tryShow('combat');
    }
  });
  gameStateManager.setState(GameStates.MAIN_MENU);

  initMenuMap();

  // Auto-save on page close
  window.addEventListener('beforeunload', () => {
    if (worldInitialized && gameStateManager.is(GameStates.PLAYING)) {
      SaveSystem.save();
    }
  });
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
  const name = window._newGamePlayerName || captainNames[Math.floor(Math.random() * captainNames.length)];
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

  // Clean up stale UI elements from previous session
  select("#travelMapWindow")?.remove();
  window._invLastFingerprint = null;

  // === Cleanup previous game objects to prevent event listener leaks ===
  if (cities && Array.isArray(cities)) {
    for (const city of cities) {
      if (typeof city.destroy === 'function') city.destroy();
    }
  }
  if (player && typeof player.destroy === 'function') player.destroy();
  if (traderManager && typeof traderManager.destroy === 'function') traderManager.destroy();
  if (raiderManager && typeof raiderManager.destroy === 'function') raiderManager.destroy();

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
  const autoCities = Math.max(20, Math.floor(mapArea / 900));
  const cityCount = (typeof window._newGameCityCount === 'number' && window._newGameCityCount > 0)
    ? Math.min(window._newGameCityCount, Math.floor(mapArea / 10)) // cap to what map can fit
    : autoCities;

  // Generate names — pool scales with city count
  const nameCount = Math.max(80, cityCount + 20);
  const namePoolForGame = NameGenerator.generateNames(nameCount, nameCount);

  // Generate map seed
  window._mapSeed = floor(random(100000));
  noiseSeed(window._mapSeed);

  updateLoadingOverlay(`Generating terrain (${cols}×${rows})...`, 10);
  await yieldFrame();
  await initTerrain(); // async — yields every 150 rows to keep browser responsive

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
  dayNight = new DayNightCycle(CYCLEVALUE);

  const safeNode = findSafeNode();
  if (!safeNode) { console.error('No safe spawn found!'); hideLoadingOverlay(); return; }
  let { x: startX, y: startY } = safeNode;
  player = new Player(grid, startX, startY);

  // ── Apply difficulty config ──
  window.DIFFICULTY_CONFIG = getDifficultyConfig(window._newGameDifficulty || 'normal');

  // ── Apply new-game config to player ──
  applyNewGameConfig(player);

  updateLoadingOverlay('Generating sprites...', 65);
  await yieldFrame();
  generateAllSprites();

  // Init notification manager
  notificationManager = new NotificationManager();

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
  eventSystem = new EventSystem();
  if (typeof window._newGameEventChance === 'number') {
    eventSystem.eventChance = window._newGameEventChance;
  }

  // Initialize new economy / meta systems
  minigameManager = new MinigameManager();
  contractSystem = new ContractSystem();
  gamblingSystem = new GamblingSystem();
  treasureSystem = new TreasureSystem();
  bankingSystem = new BankingSystem();
  smugglingSystem = new SmugglingSystem();
  bountyBoard = new BountyBoard();
  tutorialSystem = new TutorialSystem();

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
  _spawnGraceUntil = millis() + (window._newGameGracePeriod || 5) * 1000;
  hideLoadingOverlay();
  gameStateManager.setState(GameStates.PLAYING);

  // Show startup guide for new game (slight delay so the world renders first)
  if (tutorialSystem) {
    setTimeout(() => {
      tutorialSystem.showStartupGuide();
    }, 600);
  }
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

  showLoadingOverlay('Building custom world...');
  await yieldFrame();

  // Clean up
  select("#travelMapWindow")?.remove();
  window._invLastFingerprint = null;
  if (cities && Array.isArray(cities)) {
    for (const city of cities) {
      if (typeof city.destroy === 'function') city.destroy();
    }
  }
  if (player && typeof player.destroy === 'function') player.destroy();
  if (traderManager && typeof traderManager.destroy === 'function') traderManager.destroy();
  if (raiderManager && typeof raiderManager.destroy === 'function') raiderManager.destroy();
  worldInitialized = false;

  // Grid was already populated by exportToGame()
  cities = result.cities;
  for (const city of cities) city.addInventoryBasedOnTerrain(grid, 1);
  portCityLocations = cities.filter(c => c.isCoastal).map(c => c.location);
  buildCityLocationMap();

  updateLoadingOverlay('Spawning player...', 50);
  await yieldFrame();
  dayNight = new DayNightCycle(CYCLEVALUE);
  player = new Player(grid, result.startX, result.startY);

  // ── Apply difficulty config ──
  window.DIFFICULTY_CONFIG = getDifficultyConfig(window._newGameDifficulty || 'normal');

  // ── Apply new-game config to player ──
  applyNewGameConfig(player);

  updateLoadingOverlay('Generating sprites...', 65);
  await yieldFrame();
  generateAllSprites();
  notificationManager = new NotificationManager();

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
      });
      raiderManager.raiders.push(raider);
    }
  }
  if (typeof window._newGameRaiderInterval === 'number') {
    raiderManager.spawnIntervalDays = window._newGameRaiderInterval;
  }
  combatSystem = new CombatSystem();
  eventSystem = new EventSystem();
  if (typeof window._newGameEventChance === 'number') {
    eventSystem.eventChance = window._newGameEventChance;
  }

  // Initialize new economy / meta systems
  minigameManager = new MinigameManager();
  contractSystem = new ContractSystem();
  gamblingSystem = new GamblingSystem();
  treasureSystem = new TreasureSystem();
  bankingSystem = new BankingSystem();
  smugglingSystem = new SmugglingSystem();
  bountyBoard = new BountyBoard();
  tutorialSystem = new TutorialSystem();

  updateLoadingOverlay('Rendering minimap...', 85);
  await yieldFrame();
  generateMinimap();
  if (typeof invalidateMapBuffer === 'function') invalidateMapBuffer();

  updateLoadingOverlay('Ready!', 100);
  await yieldFrame();
  _tuneAIForMapSize();
  rebuildSpatialGrids();
  worldInitialized = true;
  _spawnGraceUntil = millis() + (window._newGameGracePeriod || 5) * 1000;
  hideLoadingOverlay();
  gameStateManager.setState(GameStates.PLAYING);

  // Show startup guide for custom map game
  if (tutorialSystem) {
    setTimeout(() => tutorialSystem.showStartupGuide(), 600);
  }
}

/**
 * Load an existing save and start playing.
 */
async function loadExistingGame() {
  if (typeof SaveSystem !== 'undefined' && SaveSystem.hasSave()) {
    showLoadingOverlay('Loading save...');
    await yieldFrame();

    // Clean up stale UI elements from previous session
    select("#travelMapWindow")?.remove();
    window._invLastFingerprint = null;

    // === Cleanup previous game objects to prevent event listener leaks ===
    if (cities && Array.isArray(cities)) {
      for (const city of cities) {
        if (typeof city.destroy === 'function') city.destroy();
      }
    }
    if (player && typeof player.destroy === 'function') player.destroy();
    if (traderManager && typeof traderManager.destroy === 'function') traderManager.destroy();
    if (raiderManager && typeof raiderManager.destroy === 'function') raiderManager.destroy();

    worldInitialized = false;

    // Reset global arrays before load
    grid = [];
    elevationMap = [];
    difficultyMap = [];
    temperatureMap = [];

    // Pre-initialize globals so SaveSystem.load() can write into them
    cities = [];
    dayNight = new DayNightCycle(CYCLEVALUE);
    player = new Player([], 0, 0);  // temporary; load() will overwrite position
    notificationManager = new NotificationManager();

    updateLoadingOverlay('Restoring world data...', 20);
    await yieldFrame();

    // SaveSystem.load() restores cols, rows, terrain, cities, player, etc.
    const loadSuccess = SaveSystem.load();
    if (!loadSuccess) {
      console.error('Failed to load save game');
      hideLoadingOverlay();
      return;
    }
    player.grid = grid;

    updateLoadingOverlay('Initializing systems...', 45);
    await yieldFrame();

    // Init subsystems that may not have been created by load
    if (!traderManager) traderManager = new TraderManager();
    if (!raiderManager) raiderManager = new RaiderManager();
    if (!combatSystem) combatSystem = new CombatSystem();
    if (!eventSystem) eventSystem = new EventSystem();

    // Initialize new systems (load will overwrite with saved data if present)
    if (!minigameManager) minigameManager = new MinigameManager();
    if (!contractSystem) contractSystem = new ContractSystem();
    if (!gamblingSystem) gamblingSystem = new GamblingSystem();
    if (!treasureSystem) treasureSystem = new TreasureSystem();
    if (!bankingSystem) bankingSystem = new BankingSystem();
    if (!smugglingSystem) smugglingSystem = new SmugglingSystem();
    if (!bountyBoard) bountyBoard = new BountyBoard();
    if (!tutorialSystem) tutorialSystem = new TutorialSystem();

    updateLoadingOverlay('Generating sprites...', 60);
    await yieldFrame();
    generateAllSprites();

    // Detect coastal cities
    City.detectCoastalCities(cities, grid, rows, cols);
    portCityLocations = cities.filter(c => c.isCoastal).map(c => c.location);
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
    _spawnGraceUntil = millis() + (window._newGameGracePeriod || 5) * 1000;
    hideLoadingOverlay();
    gameStateManager.setState(GameStates.PLAYING);
  }
}

function draw() {
  uiManager.updateAll();

  // Level editor has its own render loop — check BEFORE the worldInitialized gate
  if (gameStateManager.is(GameStates.LEVEL_EDITOR)) {
    if (levelEditor) {
      levelEditor.updateCamera();   // continuous WASD panning
      levelEditor.render();
    }
    return;
  }

  if (!worldInitialized || gameStateManager.is(GameStates.MAIN_MENU) || gameStateManager.is(GameStates.NEW_GAME_CONFIG)) {
    // Main menu or new game config — animated background map
    background(10);
    updateMenuMap();
    renderMenuMap();
    menuTicker.update();
    menuTicker.render();
    return;
  }

  if (gameStateManager.is(GameStates.PLAYING)) {
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
    translate(-camX, -camY);

    RenderMap();

    // Render cities — queryViewport() returns only cities in visible grid cells
    for (const city of cityGrid.queryViewport()) city.render(tileSize);

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
              text('✓', sx, sy);
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

    pop();

    // Day/night overlay
    dayNight.renderOverlay();

    // Render minimap
    renderMinimap();

    // Zoom HUD (only when not at 1×) — centered beneath minimap buttons
    if (camZoom !== 1) {
      push();
      const zPct = Math.round(camZoom * 100);
      const label = `${zPct}%`;
      const mmSize = 200;
      const mmX = width - mmSize - 10;
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

    // Contract completion checks
    if (contractSystem) contractSystem.checkCompletion();

    // Dig site interaction — press E when on a dig site
    if (treasureSystem) {
      const dig = treasureSystem.getDigSiteAtPlayer();
      if (dig && !dig._hintShown) {
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log('💎 A dig site is here! Press E to dig.', 'info');
        }
        dig._hintShown = true;
      }
    }

    // Raider collision check — skip if in city or combat cooldown
    if (raiderManager && !combatSystem.active && !player.currentCity && !window._combatCooldown && millis() > _spawnGraceUntil) {
      const raider = raiderManager.checkPlayerCollision(player.x, player.y);
      if (raider) {
        combatSystem.startCombat(raider);
      }
    }

    // Trader encounter check
    if (traderManager) {
      const trader = traderManager.checkPlayerEncounter(player.x, player.y);
      if (trader) {
        // Just show a notification (could open trade UI later)
        if (!trader._notified) {
          notificationManager.log(`Trader ${trader.name} is heading to ${cities[trader.targetCityIndex]?.name || 'somewhere'}`, "info");
          trader._notified = true;
          setTimeout(() => { trader._notified = false; }, 5000);
        }
      }
    }

    // Handle WASD movement
    handleMovement();

  } else if (gameStateManager.is(GameStates.INVENTORY)) {
    // Inventory: keep world fully visible, just pause time
    dayNight.update(0);
    push();
    translate(width / 2, height / 2);
    scale(camZoom);
    translate(-camX, -camY);
    RenderMap();
    for (const city of cities) city.render(tileSize);
    player.render(tileSize);
    pop();
    dayNight.renderOverlay();

  } else if (gameStateManager.is(GameStates.COMBAT) || gameStateManager.is(GameStates.RANDOM_EVENT) || gameStateManager.is(GameStates.WEEKLY_SUMMARY) || gameStateManager.is(GameStates.MINIGAME) || gameStateManager.is(GameStates.GAMBLING) || gameStateManager.is(GameStates.CONTRACT_BOARD) || gameStateManager.is(GameStates.BANK) || gameStateManager.is(GameStates.BOUNTY_BOARD) || gameStateManager.is(GameStates.BLACK_MARKET) || gameStateManager.is(GameStates.TREASURE_MAP)) {
    // Keep world visible behind combat/event UI
    dayNight.update(0); // Don't advance time
    push();
    translate(width / 2, height / 2);
    scale(camZoom);
    translate(-camX, -camY);
    RenderMap();
    for (const city of cities) city.render(tileSize);
    player.render(tileSize);
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
    push();
    translate(width / 2, height / 2);
    scale(camZoom);
    translate(-camX, -camY);
    RenderMap();
    for (const city of cities) city.render(tileSize);
    player.render(tileSize);
    pop();
    dayNight.renderOverlay();
    push();
    fill(0, 0, 0, 160);
    noStroke();
    rect(0, 0, width, height);
    pop();
  } else if (!gameStateManager.is(GameStates.PAUSED) && !gameStateManager.is(GameStates.SETTINGS) && !gameStateManager.is(GameStates.NEW_GAME_CONFIG)) {
    background(20);
  }
}

function handleMovement() {
  if (!gameStateManager.is(GameStates.PLAYING)) return;

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
    const oldX = player.x;
    const oldY = player.y;
    player.move(dx, dy);

    // If player actually moved, trigger event check
    if (player.x !== oldX || player.y !== oldY) {
      if (eventSystem) eventSystem.onPlayerMoved();
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function keyPressed() {
  // Level editor key handling
  if (gameStateManager.is(GameStates.LEVEL_EDITOR)) {
    if (keyCode === 27) { // Esc = back to menu
      gameStateManager.setState(GameStates.MAIN_MENU);
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

  // Dig site interaction: E key while on a dig site
  if (isActionKey('speedUp', keyCode) && gameStateManager.is(GameStates.PLAYING)) {
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
      gameStateManager.setState(GameStates.PLAYING);
    } else if (gameStateManager.is(GameStates.PLAYING)) {
      gameStateManager.setState(GameStates.INVENTORY);
    }
  }

  // Pause / Escape
  if (isActionKey('pause', keyCode)) {
    // States that block Escape
    if (gameStateManager.is(GameStates.COMBAT)) return;
    if (gameStateManager.is(GameStates.RANDOM_EVENT)) return;
    if (gameStateManager.is(GameStates.GAMEWON)) return;
    if (gameStateManager.is(GameStates.GAMELOSE)) return;
    if (gameStateManager.is(GameStates.MAIN_MENU)) return;
    if (gameStateManager.is(GameStates.NEW_GAME_CONFIG)) return;

    if (gameStateManager.is(GameStates.INVENTORY)) {
      gameStateManager.setState(GameStates.PLAYING);
      return;
    }
    if (gameStateManager.is(GameStates.SETTINGS)) {
      gameStateManager.setState(gameStateManager.prev);
      return;
    }
    gameStateManager.setState(
      gameStateManager.is(GameStates.PAUSED) ? GameStates.PLAYING : GameStates.PAUSED
    );
  }

  // Game speed: faster / slower
  if (isActionKey('speedUp', keyCode) && gameStateManager.is(GameStates.PLAYING)) {
    if (gameSpeedIndex < SPEED_STEPS.length - 1) {
      gameSpeedIndex++;
      gameSpeed = SPEED_STEPS[gameSpeedIndex];
      syncSpeedDisplay();
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Game speed: ${gameSpeed}×`, "info");
      }
    }
  }
  if (isActionKey('speedDown', keyCode) && gameStateManager.is(GameStates.PLAYING)) {
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
  if (gameStateManager.is(GameStates.PLAYING)) {
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
}

function mousePressed() {
  if (gameStateManager.is(GameStates.LEVEL_EDITOR)) {
    // Don't capture clicks on the toolbar DOM
    const target = document.elementFromPoint(mouseX, mouseY);
    if (target && target.tagName !== 'CANVAS') return;
    if (levelEditor) levelEditor.onMousePressed(mouseX, mouseY, mouseButton);
    return;
  }
  if (mouseButton === LEFT && gameStateManager.is(GameStates.PLAYING)) {
    // Don't move if clicking on a UI element (DOM overlay)
    const target = document.elementFromPoint(mouseX, mouseY);
    if (target && target.tagName !== 'CANVAS') return;

    // Check minimap click — toggle mode (only if not clicking buttons)
    const mmSize = 200;
    const mmX = width - mmSize - 10;
    const mmY = 10;
    if (mouseX >= mmX && mouseX <= mmX + mmSize && mouseY >= mmY && mouseY <= mmY + mmSize) {
      const cur = _getMinimapMode();
      _minimapMode = (cur === 'regional') ? 'world' : 'regional';
      return; // consume click
    }

    // Don't move if city view or any overlay is open
    if (player.currentCity) return;

    const { gridX, gridY } = screenToGridTile(mouseX, mouseY);
    if (
      gridX >= 0 && gridX < cols &&
      gridY >= 0 && gridY < rows
    ) {
      const tileType = grid[gridY][gridX].options[0];
      const canSail = player.activeBoat !== null;

      // Allow clicking water only if player has a boat
      if (tileType === 'Water' && !canSail) return;

      player.setPathTo(gridX, gridY, canSail);
    }
  }
}

function mouseDragged() {
  if (gameStateManager.is(GameStates.LEVEL_EDITOR) && levelEditor) {
    const target = document.elementFromPoint(mouseX, mouseY);
    if (target && target.tagName !== 'CANVAS') return;
    levelEditor.onMouseDragged(mouseX, mouseY);
  }
}

function mouseReleased() {
  if (gameStateManager.is(GameStates.LEVEL_EDITOR) && levelEditor) {
    levelEditor.onMouseReleased();
  }
}

function mouseWheel(e) {
  // Don't zoom when scrolling over UI elements (shop, inventory, popups, etc.)
  if (e.target && e.target.tagName !== 'CANVAS') return;

  // Level editor zoom
  if (gameStateManager.is(GameStates.LEVEL_EDITOR) && levelEditor) {
    levelEditor.onMouseWheel(e.delta);
    return false;
  }

  // Don't zoom when hovering over minimap
  const mmSize = 200;
  const mmX = width - mmSize - 10;
  const mmY = 10;
  if (mouseX >= mmX && mouseX <= mmX + mmSize && mouseY >= mmY && mouseY <= mmY + mmSize) return;

  if (!gameStateManager.is(GameStates.PLAYING)) return;

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

// ===================== MINIMAP =====================

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
  
  const mmSize = 200;
  minimapGraphics = createGraphics(mmSize, mmSize);
  minimapGraphics.pixelDensity(1);
  minimapGraphics.noStroke();

  const maxDim = Math.max(cols, rows);
  const scale = mmSize / maxDim;

  const colorMap = {
    Water: [0, 100, 180],
    Sand: [194, 178, 128],
    Grass: [85, 145, 50],
    Forest: [34, 75, 28],
    Snow: [235, 240, 250],
    Rock: [110, 110, 110],
  };

  // For large maps (>500), use direct pixel manipulation for speed
  if (maxDim > 500) {
    minimapGraphics.loadPixels();
    const d = minimapGraphics._pixelDensity || 1;
    const pw = mmSize * d;
    const pix = minimapGraphics.pixels;

    for (let py = 0; py < mmSize; py++) {
      const gridRow = Math.min(rows - 1, Math.floor(py / scale));
      if (!grid[gridRow]) continue;
      for (let px = 0; px < mmSize; px++) {
        const gridCol = Math.min(cols - 1, Math.floor(px / scale));
        const type = grid[gridRow][gridCol].options[0];
        const c = colorMap[type] || [0, 0, 0];
        const idx = 4 * (py * pw + px);
        pix[idx]     = c[0];
        pix[idx + 1] = c[1];
        pix[idx + 2] = c[2];
        pix[idx + 3] = 255;
      }
    }
    minimapGraphics.updatePixels();
  } else {
    for (let i = 0; i < rows; i++) {
      if (!grid[i]) continue;
      for (let j = 0; j < cols; j++) {
        const type = grid[i][j].options[0];
        const c = colorMap[type] || [0, 0, 0];
        minimapGraphics.fill(...c);
        minimapGraphics.rect(j * scale, i * scale, Math.max(scale, 1), Math.max(scale, 1));
      }
    }
  }

  // Draw cities on minimap
  const markerSize = Math.max(2, Math.min(4, Math.ceil(scale * 3)));
  for (const city of cities) {
    if (city.isCoastal) {
      minimapGraphics.fill(0, 200, 255);
      minimapGraphics.rect(city.location.x * scale - 1, city.location.y * scale - 1, markerSize + 1, markerSize + 1);
    } else {
      minimapGraphics.fill(255, 215, 0);
      minimapGraphics.rect(city.location.x * scale - 1, city.location.y * scale - 1, markerSize, markerSize);
    }
  }
}

// ===================== MINIMAP RENDERING =====================
// Two modes: regional (zoomed, centered on player) and world (full overview).
// Click minimap to toggle. Regional is the default for large maps.

let _minimapMode = 'auto'; // 'auto' picks regional for big maps, world for small
let _minimapRegionalRadius = 60; // how many tiles around the player to show
let _regionBuf = null;           // cached p5.Graphics for regional terrain
let _regionBufCenterX = -1;      // tile coord the buffer was built around
let _regionBufCenterY = -1;

function _getMinimapMode() {
  if (_minimapMode === 'auto') {
    return Math.max(cols, rows) > 200 ? 'regional' : 'world';
  }
  return _minimapMode;
}

function renderMinimap() {
  if (!minimapGraphics) return;
  
  const mmSize = 200;
  const mmX = width - mmSize - 10;
  const mmY = 10;
  const mode = _getMinimapMode();

  push();

  // Background
  fill(0, 0, 0, 200);
  noStroke();
  rect(mmX - 2, mmY - 2, mmSize + 4, mmSize + 4, 6);

  if (mode === 'regional') {
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

    const colorMap = {
      Water: [0, 100, 180],
      Sand: [194, 178, 128],
      Grass: [85, 145, 50],
      Forest: [34, 75, 28],
      Snow: [235, 240, 250],
      Rock: [110, 110, 110],
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
          const type = row[gx].options[0];
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

    // Glow
    noStroke();
    fill(city.isCoastal ? 0 : 212, city.isCoastal ? 200 : 175, city.isCoastal ? 255 : 55, 80);
    ellipse(sx + pxPerTile / 2, sy + pxPerTile / 2, dotSz + 4, dotSz + 4);

    // Dot
    if (city.isCoastal) {
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