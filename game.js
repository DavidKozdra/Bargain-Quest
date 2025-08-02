// Game.js (Player-following camera version)

let cols = 50, rows = 50, tileSize = 20, maxHeight = 180;
let grid = [], elevationMap = [], difficultyMap = [], temperatureMap = [];
let player, dayNight, cities;
const CYCLEVALUE = 1;

let camPanX = 0, camPanZ = 0, camRotX, camRotY, camZoom, isOrtho = false;
const panSpeed = 20, orbitSens = 0.005;

const GameStates = {
  MAIN_MENU: "mainMenu",
  PLAYING: "playing",
  INVENTORY: "inventory",
  VIEW_EDIT: "viewEdit",
  PAUSED: "paused",
  SETTINGS: "settings",
  GAMELOSE : "lose",
  GAMEWON:"won",
};

let gameStateManager = new GameStateManager();
let uiManager = new UIManager();

const namePool = NameGenerator.generateNames();
const cityCount = Math.floor(Math.random() * (15 - 5 + 1)) + 5;
var notificationManager;
function getMovementDeltaFromCamera(dx, dy) {
  const angle = -camRotY; // negate because we're reversing camera rotation
  const cosA = cos(angle);
  const sinA = sin(angle);
  const worldDx = dx * cosA - dy * sinA;
  const worldDy = dx * sinA + dy * cosA;

  // Round to nearest cardinal direction
  const rx = Math.round(worldDx);
  const ry = Math.round(worldDy);
  return { dx: rx, dy: ry };
}


function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();

  initTerrain();
  cities = City.generateCities(grid, cityCount, namePool);
  for (const city of cities) city.addInventoryBasedOnTerrain(grid, 1);

  camRotX = radians(45);
  camRotY = radians(-45);
  camZoom = 600;
  dayNight = new DayNightCycle(CYCLEVALUE);

  let {x:startX,y:startY}=findSafeNode()
  player = new Player(grid, startX, startY);

  gameStateManager.addState(GameStates.MAIN_MENU, {});
  gameStateManager.addState(GameStates.SETTINGS, {});
  gameStateManager.addState(GameStates.PLAYING, {});
  gameStateManager.addState(GameStates.INVENTORY, {});
  gameStateManager.addState(GameStates.PAUSED, {});
  gameStateManager.addState(GameStates.VIEW_EDIT, {});

  gameStateManager.addState(GameStates.GAMELOSE, {});

  gameStateManager.addState(GameStates.GAMEWON, {});

  gameStateManager.onChange((from, to) => uiManager.onGameStateChange(to));
  gameStateManager.setState(GameStates.MAIN_MENU);
  setTopDown();
}

function draw() {
  uiManager.updateAll();

  if (gameStateManager.is(GameStates.PLAYING)) {
    dayNight.update(deltaTime);
    if (isOrtho) {
      let r = max(cols, rows) * tileSize;
      ortho(-r, r, r, -r, -2000, 2000);
    } else {
      perspective();
    }

    // --- CAMERA FOLLOWS PLAYER ---
    const playerPos = getTileWorldPosition(player.y, player.x);
    camPanX = playerPos.x;
    camPanZ = playerPos.z;

    let cx = camPanX + camZoom * cos(camRotX) * sin(camRotY);
    let cy = camZoom * sin(camRotX);
    let cz = camPanZ + camZoom * cos(camRotX) * cos(camRotY);
    camera(cx, cy, cz, camPanX, 0, camPanZ, 0, 1, 0);

    RenderMap();
    for (const city of cities) city.render(tileSize, maxHeight);

    push();
    resetMatrix();
    camera();
    ortho();
    noLights();
    fill(255);
    pop();

    player.update();
    player.render(tileSize, cols, rows, maxHeight);
    if (gameStateManager.is(GameStates.PLAYING)) {
  let dx = 0;
  let dy = 0;

  if (keyIsDown(87) || keyIsDown(UP_ARROW))    dy = -1; // W
  if (keyIsDown(83) || keyIsDown(DOWN_ARROW))  dy = 1;  // S
  if (keyIsDown(65) || keyIsDown(LEFT_ARROW))  dx = -1; // A
  if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) dx = 1;  // D

  if (dx !== 0 || dy !== 0) {
    const { dx: worldDx, dy: worldDy } = getMovementDeltaFromCamera(dx, dy);
    player.move(worldDx, worldDy);
  }
}

  } else if (!gameStateManager.is(GameStates.PAUSED) && !gameStateManager.is(GameStates.SETTINGS)) {
    background(20);
  }

  notificationManager = new NotificationManager();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function mouseDragged() {
  if (mouseButton === LEFT) {
    camRotY -= movedX * orbitSens;
    camRotX += movedY * orbitSens;
    camRotX = constrain(camRotX, -HALF_PI + 0.01, HALF_PI - 0.01);
  }
}

function mouseWheel(e) {
  camZoom = max(50, camZoom + e.delta);
}

function setOrthographic() { isOrtho = true; }
function setPerspective() { isOrtho = false; }

function setTopDown() {
  setOrthographic();
  camRotX = HALF_PI + 0.001;
  camRotY = 0;
  camZoom = cols * tileSize;
  camPanX = camPanZ = 0;
}

function keyPressed() {


  if (key === 'i') {
    gameStateManager.setState(
      gameStateManager.is(GameStates.INVENTORY) ? GameStates.PLAYING : GameStates.INVENTORY
    );
  }

  if (key === 'v') {
    gameStateManager.setState(GameStates.VIEW_EDIT);
  }

  if (key === 'Escape') {
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
    }
  }
}

function drawDebugTile(x, y) {
  push();
  translate(-cols * tileSize / 2, 0, -rows * tileSize / 2);
  translate(x * tileSize + tileSize / 2, 1, y * tileSize + tileSize / 2);
  fill(255, 255, 0);
  box(tileSize * 0.5, 2, tileSize * 0.5);
  pop();
}

function screenToGridTile(mouseX, mouseY) {
  const x = (mouseX / width - 0.5) * 2;
  const y = (mouseY / height - 0.5) * -2;

  const camDir = createVector(
    cos(camRotX) * sin(camRotY),
    sin(camRotX),
    cos(camRotX) * cos(camRotY)
  );
  const camPos = createVector(
    camPanX + camZoom * camDir.x,
    camZoom * camDir.y,
    camPanZ + camZoom * camDir.z
  );

  const camRight = createVector(0, 1, 0).cross(camDir).normalize();
  const camUp = camDir.cross(camRight).normalize();

  const fov = PI / 3;
  const aspect = width / height;
  const dx = tan(fov / 2) * x * aspect;
  const dy = tan(fov / 2) * y;

  const rayDir = p5.Vector.mult(camRight, dx)
    .add(p5.Vector.mult(camUp, dy))
    .add(p5.Vector.mult(camDir, -1))
    .normalize();

  const maxSteps = 1000;
  const stepSize = 2;

  for (let s = 0; s < maxSteps; s++) {
    const p = p5.Vector.add(camPos, p5.Vector.mult(rayDir, s * stepSize));

    const localX = p.x + (cols * tileSize / 2);
    const localZ = p.z + (rows * tileSize / 2);
    const gridX = Math.floor(localX / tileSize);
    const gridY = Math.floor(localZ / tileSize);

    if (gridX >= 0 && gridX < cols - 1 && gridY >= 0 && gridY < rows - 1) {
      const tx = (localX % tileSize) / tileSize;
      const tz = (localZ % tileSize) / tileSize;

      const h00 = elevationMap[gridY][gridX];
      const h10 = elevationMap[gridY][gridX + 1];
      const h11 = elevationMap[gridY + 1][gridX + 1];
      const h01 = elevationMap[gridY + 1][gridX];

      const hTop = lerp(h00, h10, tx);
      const hBottom = lerp(h01, h11, tx);
      const h = lerp(hTop, hBottom, tz) * maxHeight;

      if (p.y <= h + 1) {
        return { gridX, gridY };
      }
    }
  }

  return { gridX: -1, gridY: -1 };
}

function getTileWorldPosition(i, j) {
  const x = j * tileSize - (cols * tileSize / 2) + tileSize / 2;
  const z = i * tileSize - (rows * tileSize / 2) + tileSize / 2;
  const y = elevationMap[i][j] * maxHeight;
  return { x, y, z };
}