// Game.js — 2D Top-down pixel art version

let cols = 50, rows = 50, tileSize = 32;
let grid = [], elevationMap = [], difficultyMap = [], temperatureMap = [];
let player, dayNight, cities;
const CYCLEVALUE = 120; // 120 seconds (2 minutes) per day cycle

// New game settings (used by config UI)
window._newGameMapCols = 150;
window._newGameMapRows = 150;
window._newGameEventChance = 0.16;
window._newGameRaiderInterval = 60;
window._newGameLandmass = 1;

// Camera (2D viewport)
let camX = 0, camY = 0;
let camZoom = 1;
let targetCamX = 0, targetCamY = 0;
const CAM_LERP = 0.1;

// ===================== VIEWPORT CULLING HELPERS =====================

/** Margin (in pixels) beyond screen edges to still count as "visible" */
const _VP_MARGIN = 64;

/**
 * Returns true if a world-pixel position is within (or near) the visible viewport.
 * Call *inside* the translated push/pop block where 0,0 = world origin.
 * @param {number} wx  world-pixel X
 * @param {number} wy  world-pixel Y
 */
function isOnScreen(wx, wy) {
  const halfW = (width / 2 + _VP_MARGIN) / camZoom;
  const halfH = (height / 2 + _VP_MARGIN) / camZoom;
  return wx >= camX - halfW && wx <= camX + halfW &&
         wy >= camY - halfH && wy <= camY + halfH;
}

/**
 * Distance (in tiles) between an entity and the player.
 */
function tileDistToPlayer(ex, ey) {
  return Math.abs(ex - player.x) + Math.abs(ey - player.y);
}

/** Tile-distance threshold — entities beyond this get throttled updates */
const AI_ACTIVE_RADIUS = 80;
/** Entities beyond this radius only update every Nth frame */
const AI_SLEEP_SKIP = 8;

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
        <div class="loading-bar-track"><div class="loading-bar-fill" id="loadingBarFill"></div></div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
  document.getElementById('loadingMessage').textContent = message;
  document.getElementById('loadingBarFill').style.width = '0%';
}

function updateLoadingOverlay(message, progress) {
  const msg = document.getElementById('loadingMessage');
  const bar = document.getElementById('loadingBarFill');
  const title = document.getElementById('loadingTitle');
  if (msg) msg.textContent = message;
  if (bar && typeof progress === 'number') bar.style.width = Math.min(100, progress) + '%';
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

/** Yield to the browser so it can repaint the loading overlay */
function yieldFrame() {
  return new Promise(resolve => setTimeout(resolve, 20));
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

// Game speed multiplier (1 = normal)
var gameSpeed = 1;
const SPEED_STEPS = [0.25, 0.5, 1, 2, 4];
let gameSpeedIndex = 2; // index into SPEED_STEPS (default = 1x)

// Movement cooldown
let moveTimer = 0;
const moveDelay = 120; // ms between moves

// Minimap
let minimapGraphics;

// Global list of port city locations for A* land↔water gating
var portCityLocations = [];

// Spatial lookup: "x,y" -> city object for O(1) city-at-tile checks
var cityLocationMap = new Map();

/** Rebuild the cityLocationMap from the cities array. Call after generating or loading cities. */
function buildCityLocationMap() {
  cityLocationMap.clear();
  if (!cities) return;
  for (const city of cities) {
    cityLocationMap.set(`${city.location.x},${city.location.y}`, city);
  }
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

  gameStateManager.onChange((from, to) => uiManager.onGameStateChange(to));
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
 * Start a brand new game with the given map dimensions.
 * Async so the loading overlay can update between heavy steps.
 * @param {number} mapCols - grid columns
 * @param {number} mapRows - grid rows
 */
async function startNewGame(mapCols, mapRows) {
  showLoadingOverlay('Preparing world...');
  await yieldFrame();

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

  // Scale city count with map area (no hard cap — huge worlds get many cities)
  const mapArea = cols * rows;
  const cityCount = Math.max(5, Math.floor(mapArea / 300));

  // Generate names — pool scales with city count
  const nameCount = Math.max(80, cityCount + 20);
  const namePoolForGame = NameGenerator.generateNames(nameCount, nameCount);

  // Generate map seed
  window._mapSeed = floor(random(100000));
  noiseSeed(window._mapSeed);

  updateLoadingOverlay(`Generating terrain (${cols}×${rows})...`, 10);
  await yieldFrame();
  initTerrain();

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

  updateLoadingOverlay('Rendering minimap...', 85);
  await yieldFrame();
  generateMinimap();

  // Invalidate offscreen map buffer so it rebuilds with new terrain
  if (typeof invalidateMapBuffer === 'function') invalidateMapBuffer();

  updateLoadingOverlay('Ready!', 100);
  await yieldFrame();

  worldInitialized = true;
  hideLoadingOverlay();
  gameStateManager.setState(GameStates.PLAYING);
}

/**
 * Load an existing save and start playing.
 */
async function loadExistingGame() {
  if (typeof SaveSystem !== 'undefined' && SaveSystem.hasSave()) {
    showLoadingOverlay('Loading save...');
    await yieldFrame();

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

    worldInitialized = true;
    hideLoadingOverlay();
    gameStateManager.setState(GameStates.PLAYING);
  }
}

function draw() {
  uiManager.updateAll();

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

    // Render world
    push();
    translate(width / 2, height / 2);
    scale(camZoom);
    translate(-camX, -camY);

    RenderMap();

    // Render cities
    for (const city of cities) city.render(tileSize);

    // Render traders
    if (traderManager) traderManager.render(tileSize);

    // Render raiders
    if (raiderManager) raiderManager.render(tileSize);

    // Render player
    player.render(tileSize);

    pop();

    // Day/night overlay
    dayNight.renderOverlay();

    // Render minimap
    renderMinimap();

    // Zoom HUD (only when not at 1×)
    if (camZoom !== 1) {
      push();
      const zPct = Math.round(camZoom * 100);
      const label = `${zPct}%`;
      fill(255, 255, 255, 160);
      noStroke();
      textAlign(RIGHT, TOP);
      textSize(11);
      text(label, width - 216, 208);
      pop();
    }

    // Update subsystems
    player.update();
    if (traderManager) traderManager.update(scaledDt);
    if (raiderManager) raiderManager.update(scaledDt);

    // Raider collision check — skip if in city or combat cooldown
    if (raiderManager && !combatSystem.active && !player.currentCity && !window._combatCooldown) {
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

  } else if (gameStateManager.is(GameStates.COMBAT) || gameStateManager.is(GameStates.RANDOM_EVENT) || gameStateManager.is(GameStates.INVENTORY)) {
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
  } else if (!gameStateManager.is(GameStates.PAUSED) && !gameStateManager.is(GameStates.SETTINGS) && !gameStateManager.is(GameStates.INVENTORY) && !gameStateManager.is(GameStates.NEW_GAME_CONFIG)) {
    background(20);
  }
}

function handleMovement() {
  if (!gameStateManager.is(GameStates.PLAYING)) return;

  moveTimer += deltaTime * gameSpeed;
  if (moveTimer < moveDelay) return;

  let dx = 0;
  let dy = 0;

  if (keyIsDown(87) || keyIsDown(UP_ARROW)) dy = -1;    // W
  if (keyIsDown(83) || keyIsDown(DOWN_ARROW)) dy = 1;   // S
  if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) dx = -1;  // A
  if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) dx = 1;  // D

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
  if (key === 'i' || key === 'I') {
    gameStateManager.setState(
      gameStateManager.is(GameStates.INVENTORY) ? GameStates.PLAYING : GameStates.INVENTORY
    );
  }

  if (key === 'Escape') {
    if (gameStateManager.is(GameStates.COMBAT)) return; // Can't escape combat
    if (gameStateManager.is(GameStates.RANDOM_EVENT)) return;
    gameStateManager.setState(
      gameStateManager.is(GameStates.PAUSED) ? GameStates.PLAYING : GameStates.PAUSED
    );
  }

  // Game speed: E = faster, Q = slower
  if ((key === 'e' || key === 'E') && gameStateManager.is(GameStates.PLAYING)) {
    if (gameSpeedIndex < SPEED_STEPS.length - 1) {
      gameSpeedIndex++;
      gameSpeed = SPEED_STEPS[gameSpeedIndex];
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Game speed: ${gameSpeed}×`, "info");
      }
    }
  }
  if ((key === 'q' || key === 'Q') && gameStateManager.is(GameStates.PLAYING)) {
    if (gameSpeedIndex > 0) {
      gameSpeedIndex--;
      gameSpeed = SPEED_STEPS[gameSpeedIndex];
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Game speed: ${gameSpeed}×`, "info");
      }
    }
  }

  // Camera zoom: - / Z to zoom out, + / = / X to zoom in, R to reset
  if (gameStateManager.is(GameStates.PLAYING)) {
    if (key === '-' || key === 'z' || key === 'Z') {
      camZoom = constrain(camZoom - 0.1, 0.15, 2);
      if (Math.abs(camZoom - 1) < 0.06) camZoom = 1;
    }
    if (key === '+' || key === '=' || key === 'x' || key === 'X') {
      camZoom = constrain(camZoom + 0.1, 0.15, 2);
      if (Math.abs(camZoom - 1) < 0.06) camZoom = 1;
    }
    if (key === 'r' || key === 'R') {
      camZoom = 1;
    }
  }
}

function mousePressed() {
  if (mouseButton === LEFT && gameStateManager.is(GameStates.PLAYING)) {
    // Don't move if clicking on a UI element (DOM overlay)
    const target = document.elementFromPoint(mouseX, mouseY);
    if (target && target.tagName !== 'CANVAS') return;

    // Check minimap click — toggle mode
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

function mouseWheel(e) {
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

  // Mode label (bottom-right of minimap) - draw background first for readability
  fill(0, 0, 0, 150);
  noStroke();
  rect(mmX + mmSize - 52, mmY + mmSize - 18, 50, 16, 3);
  
  fill(255, 255, 255, 200);
  noStroke();
  textAlign(RIGHT, BOTTOM);
  textSize(9);
  text(mode === 'regional' ? '🔍 Region' : '🌍 World', mmX + mmSize - 3, mmY + mmSize - 3);
  
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
}