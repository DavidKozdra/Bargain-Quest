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
  let s = 0.04;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let nx = i * s, ny = j * s;
      let e = 0.5 * noise(nx, ny)
            + 0.25 * noise(nx * 2, ny * 2)
            + 0.125 * noise(nx * 4, ny * 4);
      // Pull elevations down so more tiles fall below the water threshold
      e = e * 0.85;
      // Add ocean basins at map edges (distance from center falloff)
      let cx = (j / cols - 0.5) * 2;  // -1 to 1
      let cy = (i / rows - 0.5) * 2;
      let edgeDist = Math.max(Math.abs(cx), Math.abs(cy));
      if (edgeDist > 0.6) {
        e -= (edgeDist - 0.6) * 0.5;
      }
      elevationMap[i][j] = Math.max(0, e);
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

      if (e < 0.42) type = 'Water';
      else if (e < 0.48) type = 'Sand';
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

// 2D tilemap rendering with viewport culling
function RenderMap() {
  if (!SpriteSheet.tiles) return;

  // Calculate visible tile range
  const halfW = width / 2;
  const halfH = height / 2;
  const startCol = Math.max(0, Math.floor((camX - halfW) / tileSize) - 1);
  const endCol = Math.min(cols - 1, Math.floor((camX + halfW) / tileSize) + 1);
  const startRow = Math.max(0, Math.floor((camY - halfH) / tileSize) - 1);
  const endRow = Math.min(rows - 1, Math.floor((camY + halfH) / tileSize) + 1);

  for (let i = startRow; i <= endRow; i++) {
    for (let j = startCol; j <= endCol; j++) {
      const type = grid[i][j].options[0];
      const sprite = SpriteSheet.tiles[type];
      if (sprite) {
        image(sprite, j * tileSize, i * tileSize, tileSize, tileSize);
      } else {
        // Fallback to colored rect
        fill(typeColors[type] || '#000');
        noStroke();
        rect(j * tileSize, i * tileSize, tileSize, tileSize);
      }

      // Subtle elevation shading — darker for higher elevation gives depth
      const elev = elevationMap[i][j];
      if (elev > 0.5 && type !== 'Water') {
        fill(0, 0, 0, (elev - 0.5) * 40);
        noStroke();
        rect(j * tileSize, i * tileSize, tileSize, tileSize);
      }
    }
  }

  // Draw grid overlay (very subtle)
  stroke(0, 0, 0, 15);
  strokeWeight(0.5);
  for (let i = startRow; i <= endRow; i++) {
    line(startCol * tileSize, i * tileSize, (endCol + 1) * tileSize, i * tileSize);
  }
  for (let j = startCol; j <= endCol; j++) {
    line(j * tileSize, startRow * tileSize, j * tileSize, (endRow + 1) * tileSize);
  }
  noStroke();

  // Draw path preview if player has path
  if (player && player.path && player.path.length > 0) {
    noFill();
    stroke(255, 255, 100, 120);
    strokeWeight(2);
    beginShape();
    vertex(player.x * tileSize + tileSize / 2, player.y * tileSize + tileSize / 2);
    for (const node of player.path) {
      vertex(node.x * tileSize + tileSize / 2, node.y * tileSize + tileSize / 2);
    }
    endShape();
    noStroke();
  }
}

