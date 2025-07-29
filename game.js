let cols = 40, rows = 40, tileSize = 20, maxHeight = 80;
let grid = [], elevationMap = [], difficultyMap = [];
let temperatureMap = [];
// Day/Night system
let dayNight;
const CYCLEVALUE = 60
// Camera vars
let camPanX = 0, camPanZ = 0, camRotX, camRotY, camZoom, isOrtho = false;
const panSpeed = 20, orbitSens = 0.005;

const GameStates = {
    MAIN_MENU: "mainMenu",
    PLAYING: "playing",
    INVENTORY: "inventory",
    VIEW_EDIT: "viewEdit",
    PAUSED: "paused",
    SETTINGS: "settings"
};

let gameStateManager = new GameStateManager();

let uiManager = new UIManager();

function setup() {
    createCanvas(800, 600);


    gameStateManager.addState(GameStates.MAIN_MENU, {

    });

    gameStateManager.addState(GameStates.SETTINGS, {

    });
    gameStateManager.addState(GameStates.PLAYING, {

    });

    gameStateManager.addState(GameStates.INVENTORY, {

    });


    gameStateManager.addState(GameStates.PAUSED, {

    });

    gameStateManager.addState(GameStates.VIEW_EDIT, {

    });

    gameStateManager.onChange((from, to) => {
        uiManager.onGameStateChange(to);
    });

    gameStateManager.setState(GameStates.MAIN_MENU);

    createCanvas(windowWidth, windowHeight, WEBGL);
    noStroke();
    initTerrain();
    camRotX = radians(45);
    camRotY = radians(-45);
    camZoom = 600;

    dayNight = new DayNightCycle(CYCLEVALUE);

    setTopDown();
}

function draw() {
    if (gameStateManager.is(GameStates.MAIN_MENU)) {

    }

    if (gameStateManager.is(GameStates.PLAYING)) {
        dayNight.update(deltaTime);
        // Camera movement
        if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) camPanX -= panSpeed;
        if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) camPanX += panSpeed;
        if (keyIsDown(87) || keyIsDown(UP_ARROW)) camPanZ -= panSpeed;
        if (keyIsDown(83) || keyIsDown(DOWN_ARROW)) camPanZ += panSpeed;

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


    }else if(!gameStateManager.is(GameStates.PAUSED) && !gameStateManager.is(GameStates.SETTINGS)) {
        console.log(gameStateManager.currentState)
        background(20); 
    }
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
function setPerspective() { isOrtho = false; }
function setTopDown() {
    setOrthographic();
    camRotX = HALF_PI + 0.001;
    camRotY = 0;
    camZoom = cols * tileSize;
    camPanX = camPanZ = 0;
}
function calcDifficulty() {
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        let t = grid[i][j].options[0];
        let e = elevationMap[i][j];
        difficultyMap[i][j] = baseDiff[t] + e * 5;
    }
}

function keyPressed() {
    if (key === 'i') {
        if (gameStateManager.is(GameStates.INVENTORY)) {
            gameStateManager.setState(GameStates.PLAYING);
        } else {
            gameStateManager.setState(GameStates.INVENTORY);
        }
    }

    if (key === 'v') {
        gameStateManager.setState(GameStates.VIEW_EDIT);
    }

    if (key === 'Escape') {
        gameStateManager.setState(
            gameStateManager.is(GameStates.PAUSED)
                ? GameStates.PLAYING
                : GameStates.PAUSED
        );
    }
}



