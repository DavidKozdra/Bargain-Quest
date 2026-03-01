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
  const halfW = width / 2 + _VP_MARGIN;
  const halfH = height / 2 + _VP_MARGIN;
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
    translate(width / 2 - camX, height / 2 - camY);

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
    translate(width / 2 - camX, height / 2 - camY);
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
    translate(width / 2 - camX, height / 2 - camY);
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
}

function mousePressed() {
  if (mouseButton === LEFT && gameStateManager.is(GameStates.PLAYING)) {
    // Don't move if clicking on a UI element (DOM overlay)
    const target = document.elementFromPoint(mouseX, mouseY);
    if (target && target.tagName !== 'CANVAS') return;

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
  camZoom = constrain(camZoom - e.delta * 0.001, 0.5, 2);
}

// Simple 2D screen-to-grid conversion
function screenToGridTile(mx, my) {
  const worldX = mx - width / 2 + camX;
  const worldY = my - height / 2 + camY;
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
  
  const mmSize = 180;
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
    // Use pixel buffer for O(mmSize²) instead of O(rows*cols)
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
    // Small maps: original rect-based drawing
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

function renderMinimap() {
  if (!minimapGraphics) return;
  const mmSize = 180;
  const mmX = width - mmSize - 10;
  const mmY = 10;

  push();
  // Background
  fill(0, 0, 0, 180);
  noStroke();
  rect(mmX - 2, mmY - 2, mmSize + 4, mmSize + 4, 4);

  // Minimap image
  image(minimapGraphics, mmX, mmY);

  // Player dot (boat icon when sailing)
  const scale = mmSize / Math.max(cols, rows);
  if (player.isSailing) {
    fill(0, 220, 255);
    noStroke();
    // Small boat triangle
    triangle(
      mmX + player.x * scale, mmY + player.y * scale - 3,
      mmX + player.x * scale - 2, mmY + player.y * scale + 2,
      mmX + player.x * scale + 2, mmY + player.y * scale + 2
    );
  } else {
    fill(255, 50, 50);
    noStroke();
    ellipse(mmX + player.x * scale, mmY + player.y * scale, 4, 4);
  }

  // Trader dots
  if (traderManager) {
    fill(100, 200, 255);
    for (const t of traderManager.traders) {
      if (t.state !== 'dead') {
        ellipse(mmX + t.x * scale, mmY + t.y * scale, 3, 3);
      }
    }
  }

  // Raider dots
  if (raiderManager) {
    fill(255, 80, 80);
    for (const r of raiderManager.raiders) {
      if (r.state !== 'defeated') {
        rect(mmX + r.x * scale - 1, mmY + r.y * scale - 1, 3, 3);
      }
    }
  }

  // Border
  noFill();
  stroke(100, 100, 100);
  strokeWeight(1);
  rect(mmX - 1, mmY - 1, mmSize + 2, mmSize + 2, 4);

  pop();
}