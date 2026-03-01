// Game.js — 2D Top-down pixel art version

let cols = 50, rows = 50, tileSize = 32;
let grid = [], elevationMap = [], difficultyMap = [], temperatureMap = [];
let player, dayNight, cities;
const CYCLEVALUE = 120; // 120 seconds (2 minutes) per day cycle

// Camera (2D viewport)
let camX = 0, camY = 0;
let camZoom = 1;
let targetCamX = 0, targetCamY = 0;
const CAM_LERP = 0.1;

const GameStates = {
  MAIN_MENU: "mainMenu",
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
const cityCount = Math.floor(Math.random() * (15 - 5 + 1)) + 5;
var notificationManager;
var traderManager;
var raiderManager;
var combatSystem;
var eventSystem;

// Movement cooldown
let moveTimer = 0;
const moveDelay = 120; // ms between moves

// Minimap
let minimapGraphics;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  textFont('monospace');

  // Store map seed for save/load
  window._mapSeed = floor(random(100000));
  noiseSeed(window._mapSeed);

  initTerrain();
  cities = City.generateCities(grid, cityCount, namePool);
  for (const city of cities) city.addInventoryBasedOnTerrain(grid, 1);

  dayNight = new DayNightCycle(CYCLEVALUE);

  const safeNode = findSafeNode();
  if (!safeNode) { console.error('No safe spawn found!'); return; }
  let { x: startX, y: startY } = safeNode;
  player = new Player(grid, startX, startY);

  // Generate all sprites
  generateAllSprites();

  // Init notification manager ONCE
  notificationManager = new NotificationManager();

  // Init subsystems
  traderManager = new TraderManager();
  traderManager.init();

  raiderManager = new RaiderManager();
  raiderManager.init();

  combatSystem = new CombatSystem();
  eventSystem = new EventSystem();

  // Generate minimap
  generateMinimap();

  // Register game states
  gameStateManager.addState(GameStates.MAIN_MENU, {});
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

  // Auto-save on page close
  window.addEventListener('beforeunload', () => {
    if (gameStateManager.is(GameStates.PLAYING)) {
      SaveSystem.save();
    }
  });
}

function draw() {
  uiManager.updateAll();

  if (gameStateManager.is(GameStates.PLAYING)) {
    dayNight.update(deltaTime);

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
    if (traderManager) traderManager.update(deltaTime);
    if (raiderManager) raiderManager.update(deltaTime);

    // Raider collision check
    if (raiderManager && !combatSystem.active) {
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

  } else if (!gameStateManager.is(GameStates.PAUSED) && !gameStateManager.is(GameStates.SETTINGS) && !gameStateManager.is(GameStates.INVENTORY)) {
    background(20);
  }
}

function handleMovement() {
  if (!gameStateManager.is(GameStates.PLAYING)) return;

  moveTimer += deltaTime;
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
}

function mousePressed() {
  if (mouseButton === LEFT && gameStateManager.is(GameStates.PLAYING)) {
    const { gridX, gridY } = screenToGridTile(mouseX, mouseY);
    if (
      gridX >= 0 && gridX < cols &&
      gridY >= 0 && gridY < rows &&
      grid[gridY][gridX].options[0] !== 'Water'
    ) {
      player.setPathTo(gridX, gridY);
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
  const mmSize = 150;
  minimapGraphics = createGraphics(mmSize, mmSize);
  minimapGraphics.pixelDensity(1);
  minimapGraphics.noStroke();

  const scale = mmSize / Math.max(cols, rows);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const type = grid[i][j].options[0];
      const c = {
        Water: [0, 100, 180],
        Sand: [194, 178, 128],
        Grass: [85, 145, 50],
        Forest: [34, 75, 28],
        Snow: [235, 240, 250],
        Rock: [110, 110, 110],
      }[type] || [0, 0, 0];

      minimapGraphics.fill(...c);
      minimapGraphics.rect(j * scale, i * scale, scale + 1, scale + 1);
    }
  }

  // Draw cities on minimap
  for (const city of cities) {
    minimapGraphics.fill(255, 215, 0);
    minimapGraphics.rect(city.location.x * scale - 1, city.location.y * scale - 1, 3, 3);
  }
}

function renderMinimap() {
  if (!minimapGraphics) return;
  const mmSize = 150;
  const mmX = width - mmSize - 10;
  const mmY = 10;

  push();
  // Background
  fill(0, 0, 0, 180);
  noStroke();
  rect(mmX - 2, mmY - 2, mmSize + 4, mmSize + 4, 4);

  // Minimap image
  image(minimapGraphics, mmX, mmY);

  // Player dot
  const scale = mmSize / Math.max(cols, rows);
  fill(255, 50, 50);
  noStroke();
  ellipse(mmX + player.x * scale, mmY + player.y * scale, 4, 4);

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