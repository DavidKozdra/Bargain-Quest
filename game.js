let cols = 100, rows = 100, tileSize = 20, maxHeight = 80;
let grid = [], elevationMap = [], difficultyMap = [];
let  temperatureMap = [];

// Day/Night system
let dayNight;
const CYCLEVALUE = 60
// Camera vars
let camPanX=0, camPanZ=0, camRotX, camRotY, camZoom, isOrtho=false;
const panSpeed = 20, orbitSens = 0.005;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();
  initTerrain();
  camRotX = radians(45);
  camRotY = radians(-45);
  camZoom = 600;
  initViews();

  dayNight = new DayNightCycle(CYCLEVALUE);

  setTopDown();
}

function draw() {
  dayNight.update(deltaTime);


  // Camera movement
  if (keyIsDown(65)||keyIsDown(LEFT_ARROW))  camPanX -= panSpeed;
  if (keyIsDown(68)||keyIsDown(RIGHT_ARROW)) camPanX += panSpeed;
  if (keyIsDown(87)||keyIsDown(UP_ARROW))    camPanZ -= panSpeed;
  if (keyIsDown(83)||keyIsDown(DOWN_ARROW))  camPanZ += panSpeed;

  // Projection
  if (isOrtho) {
    let r = max(cols, rows) * tileSize;
    ortho(-r, r, r, -r, -2000, 2000);
  } else {
    perspective();
  }

  // Camera orbit
  let cx = camPanX + camZoom * cos(camRotX) * sin(camRotY);
  let cy = camZoom * sin(camRotX);
  let cz = camPanZ + camZoom * cos(camRotX) * cos(camRotY);
  camera(cx, cy, cz, camPanX, 0, camPanZ, 0, 1, 0);

  // Draw terrain
    RenderMap()

  // Show UI info (day counter, weekday)
  push();
    resetMatrix();
    camera();
    ortho();
    noLights();
    fill(255);
    textSize(18);
    textAlign(LEFT, TOP);
  pop();
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
function mouseDragged() {
  if (mouseButton === LEFT) {
    camRotY -= movedX * orbitSens;
    camRotX += movedY * orbitSens;
    camRotX = constrain(camRotX, -HALF_PI + 0.01, HALF_PI - 0.01);
  }
}
function mouseWheel(e) { camZoom = max(50, camZoom + e.delta); }
function setOrthographic() { isOrtho = true; }
function setPerspective()  { isOrtho = false; }
function setTopDown() {
  setOrthographic();
  camRotX = HALF_PI + 0.001;
  camRotY = 0;
  camZoom = cols * tileSize;
  camPanX = camPanZ = 0;
}
function calcDifficulty() {
  for (let i=0; i<rows; i++) for (let j=0; j<cols; j++) {
    let t = grid[i][j].options[0];
    let e = elevationMap[i][j];
    difficultyMap[i][j] = baseDiff[t] + e * 5;
  }
}