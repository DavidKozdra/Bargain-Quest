// --- CONFIG ---
let smoothingPasses = 2;
let tileTypes = ['Water','Sand','Grass','Forest','Snow','Rock'];
let typeColors = {
  Water:'#0077BE', Sand:'#C2B280', Grass:'#5F9F35',
  Forest:'#22551C', Snow:'#F0F8FF', Rock:'#787878'
};
let baseDiff = { Water:5, Sand:2, Grass:1, Forest:3, Snow:4, Rock:6 };


function initTerrain() {
  for (let i = 0; i < rows; i++) {
    grid[i] = [];
    elevationMap[i] = [];
    difficultyMap[i] = [];
    temperatureMap[i] = [];
  }
  genElevation();
  smoothElevation(smoothingPasses);
  computeTemperature();
  assignBiomes();
  calcDifficulty();
}

function genElevation() {
  noiseSeed(floor(random(10000)));
  let s = 0.04;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let nx = i * s, ny = j * s;
      let e = 0.5 * noise(nx, ny)
            + 0.25 * noise(nx * 2, ny * 2)
            + 0.125 * noise(nx * 4, ny * 4);
      elevationMap[i][j] = e;
    }
  }
}

function smoothElevation(passes) {
  for (let p = 0; p < passes; p++) {
    let temp = [];
    for (let i = 0; i < rows; i++) {
      temp[i] = [];
      for (let j = 0; j < cols; j++) {
        let sum = 0, count = 0;
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          let ni = i + di, nj = j + dj;
          if (ni >= 0 && ni < rows && nj >= 0 && nj < cols) {
            sum += elevationMap[ni][nj];
            count++;
          }
        }
        temp[i][j] = sum / count;
      }
    }
    elevationMap = temp;
  }
}

function computeTemperature() {
  for (let i = 0; i < rows; i++) {
    let lat = i / rows;
    for (let j = 0; j < cols; j++) {
      temperatureMap[i][j] = 1.0 - Math.abs(lat - 0.5) * 2;
    }
  }
}

function assignBiomes() {
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let e = elevationMap[i][j];
      let t = temperatureMap[i][j];
      let type;

      if (e < 0.3) type = 'Water';
      else if (e < 0.4) type = 'Sand';
      else if (e < 0.5 && t > 0.6) type = 'Grass';
      else if (e < 0.7 && t > 0.4) type = 'Forest';
      else if (e < 0.85) type = 'Rock';
      else type = 'Snow';

      grid[i][j] = { options: [type], collapsed: true };
    }
  }
}

function calcDifficulty() {
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let t = grid[i][j].options[0];
      let e = elevationMap[i][j];
      difficultyMap[i][j] = baseDiff[t] + e * 5;
    }
  }
}

function RenderMap() {
  push();
  translate(-cols * tileSize / 2, 0, -rows * tileSize / 2);
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      let x = j * tileSize;
      let z = i * tileSize;
      let h00 = elevationMap[i][j] * maxHeight;
      let h10 = elevationMap[i][j + 1] * maxHeight;
      let h11 = elevationMap[i + 1][j + 1] * maxHeight;
      let h01 = elevationMap[i + 1][j] * maxHeight;

      fill(typeColors[grid[i][j].options[0]]);
      beginShape();
      vertex(x, h00, z);
      vertex(x + tileSize, h10, z);
      vertex(x + tileSize, h11, z + tileSize);
      vertex(x, h01, z + tileSize);
      endShape(CLOSE);

      fill(148, 94, 73);
      beginShape(); vertex(x, 0, z); vertex(x + tileSize, 0, z); vertex(x + tileSize, h10, z); vertex(x, h00, z); endShape(CLOSE);
      beginShape(); vertex(x + tileSize, 0, z); vertex(x + tileSize, 0, z + tileSize); vertex(x + tileSize, h11, z + tileSize); vertex(x + tileSize, h10, z); endShape(CLOSE);

      if (i === rows - 2) {
        beginShape(); vertex(x + tileSize, 0, z + tileSize); vertex(x, 0, z + tileSize); vertex(x, h01, z + tileSize); vertex(x + tileSize, h11, z + tileSize); endShape(CLOSE);
      }
      if (j === 0) {
        beginShape(); vertex(x, 0, z + tileSize); vertex(x, 0, z); vertex(x, h00, z); vertex(x, h01, z + tileSize); endShape(CLOSE);
      }
    }
  }
  pop();
}


function findSafeNode() {
  const shuffled = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      shuffled.push({ x, y });
    }
  }

  // Shuffle to randomize search
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  for (const { x, y } of shuffled) {
    const tileType = grid[y][x]?.options?.[0];
    const isWater = tileType === "Water";
    const isCity = cities?.some(city => city.location.x === x && city.location.y === y);

    if (!isWater && !isCity) {
      return { x, y };
    }
  }

  console.warn("No safe node found.");
  return null;
}
