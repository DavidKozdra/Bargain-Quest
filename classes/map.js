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
  placeDecorations();
  calcDifficulty();
}

function genElevation() {
  let s = 0.04;
  // Get landmass setting: 0=islands, 1=normal, 2=continents
  const landmassMode = typeof window._newGameLandmass === 'number' ? window._newGameLandmass : 1;
  let mult = 0.95, offset = 0.02;
  // Edge falloff: start distance and strength
  let edgeStart = 0.7, edgeStrength = 0.4;
  if (landmassMode === 0) {
    // Islands — lighter global reduction, weaker edge falloff, extra high-freq noise to fragment land
    mult = 0.82; offset = -0.03;
    edgeStart = 0.85; edgeStrength = 0.35;
  } else if (landmassMode === 2) {
    mult = 1.05; offset = 0.1;
    edgeStart = 0.75; edgeStrength = 0.3;
  }
  
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let nx = i * s, ny = j * s;
      let e = 0.5 * noise(nx, ny)
            + 0.25 * noise(nx * 2, ny * 2)
            + 0.125 * noise(nx * 4, ny * 4);

      // Islands: add higher-frequency noise to break land into scattered islands
      if (landmassMode === 0) {
        e += 0.08 * noise(nx * 6, ny * 6);
        e -= 0.06 * noise(nx * 3 + 100, ny * 3 + 100);
      }

      // Adjust elevation based on landmass setting
      e = e * mult + offset;
      // Add ocean basins at map edges (distance from center falloff)
      let cx = (j / cols - 0.5) * 2;  // -1 to 1
      let cy = (i / rows - 0.5) * 2;
      let edgeDist = Math.max(Math.abs(cx), Math.abs(cy));
      if (edgeDist > edgeStart) {
        e -= (edgeDist - edgeStart) * edgeStrength;
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

/** Scatter decorative props across the map based on biome */
function placeDecorations() {
  // Decoration chances per biome: [decorType, probability]
  const DECOR_TABLE = {
    Grass:  [['bush', 0.08], ['tree', 0.05], ['rock', 0.03], ['pebbles', 0.02]],
    Forest: [['rock', 0.03]],   // forest tile already looks dense; just sparse rocks
    Sand:   [['pebbles', 0.10], ['rock', 0.04], ['bush', 0.02]],
    Rock:   [['pebbles', 0.08], ['rock', 0.06]],
    Snow:   [['snowdrift', 0.10], ['rock', 0.03]],
    Water:  [['lily', 0.04], ['seaweed', 0.04]],
  };

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const type = grid[i][j].options[0];
      const table = DECOR_TABLE[type];
      if (!table) continue;
      for (const [decorType, chance] of table) {
        if (Math.random() < chance) {
          grid[i][j].decor = decorType;
          break; // at most one decoration per tile
        }
      }
    }
  }
}

// Offscreen map buffer for static terrain — avoids redrawing thousands of tiles each frame
// NOTE: browsers cap canvas size at ~16384px per dimension (or ~268M total pixels).
// For maps larger than that threshold we skip the buffer and render tiles directly.
const _MAP_BUFFER_MAX_DIM = 16000; // px — stay safely under browser limits
let _mapBuffer = null;
let _mapBufferW = 0;
let _mapBufferH = 0;
let _mapBufferDirty = true; // set true when terrain changes (new game, load, etc.)
let _mapBufferDisabled = false; // true when map is too large for an offscreen canvas

/** Mark the map buffer as needing a full re-render */
function invalidateMapBuffer() {
  _mapBufferDirty = true;
}

/** Build or rebuild the full offscreen terrain buffer */
function _rebuildMapBuffer() {
  const w = cols * tileSize;
  const h = rows * tileSize;

  // If the map is too large for an offscreen canvas, disable buffering
  if (w > _MAP_BUFFER_MAX_DIM || h > _MAP_BUFFER_MAX_DIM) {
    if (_mapBuffer) { _mapBuffer.remove(); _mapBuffer = null; }
    _mapBufferDisabled = true;
    _mapBufferDirty = false;
    return;
  }

  _mapBufferDisabled = false;

  if (!_mapBuffer || _mapBufferW !== w || _mapBufferH !== h) {
    if (_mapBuffer) _mapBuffer.remove();
    _mapBuffer = createGraphics(w, h);
    _mapBufferW = w;
    _mapBufferH = h;
  }

  const g = _mapBuffer;
  g.clear();

  // Draw tiles
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const type = grid[i][j].options[0];
      const sprite = SpriteSheet.tiles[type];
      if (sprite) {
        g.image(sprite, j * tileSize, i * tileSize, tileSize, tileSize);
      } else {
        g.fill(typeColors[type] || '#000');
        g.noStroke();
        g.rect(j * tileSize, i * tileSize, tileSize, tileSize);
      }

      // Elevation shading
      const elev = elevationMap[i][j];
      if (elev > 0.5 && type !== 'Water') {
        g.fill(0, 0, 0, (elev - 0.5) * 40);
        g.noStroke();
        g.rect(j * tileSize, i * tileSize, tileSize, tileSize);
      }

      // Decoration overlay
      const decor = grid[i][j].decor;
      if (decor && SpriteSheet.decor && SpriteSheet.decor[decor]) {
        const variants = SpriteSheet.decor[decor];
        const variant = variants[(i * 97 + j * 31) % variants.length];
        g.image(variant, j * tileSize, i * tileSize, tileSize, tileSize);
      }
    }
  }

  // Grid overlay
  g.stroke(0, 0, 0, 15);
  g.strokeWeight(0.5);
  for (let i = 0; i <= rows; i++) {
    g.line(0, i * tileSize, w, i * tileSize);
  }
  for (let j = 0; j <= cols; j++) {
    g.line(j * tileSize, 0, j * tileSize, h);
  }
  g.noStroke();

  _mapBufferDirty = false;
}

/** Direct per-tile rendering for maps too large for an offscreen buffer */
function _renderMapDirect() {
  const z = (typeof camZoom !== 'undefined') ? camZoom : 1;
  const halfW = width / 2 / z;
  const halfH = height / 2 / z;
  const startCol = Math.max(0, Math.floor((camX - halfW) / tileSize) - 1);
  const startRow = Math.max(0, Math.floor((camY - halfH) / tileSize) - 1);
  const endCol = Math.min(cols - 1, Math.ceil((camX + halfW) / tileSize) + 1);
  const endRow = Math.min(rows - 1, Math.ceil((camY + halfH) / tileSize) + 1);

  noStroke();
  for (let i = startRow; i <= endRow; i++) {
    for (let j = startCol; j <= endCol; j++) {
      const type = grid[i][j].options[0];
      const px = j * tileSize;
      const py = i * tileSize;
      const sprite = SpriteSheet.tiles[type];
      if (sprite) {
        image(sprite, px, py, tileSize, tileSize);
      } else {
        fill(typeColors[type] || '#000');
        rect(px, py, tileSize, tileSize);
      }
      const elev = elevationMap[i][j];
      if (elev > 0.5 && type !== 'Water') {
        fill(0, 0, 0, (elev - 0.5) * 40);
        rect(px, py, tileSize, tileSize);
      }

      // Decoration overlay
      const decor = grid[i][j].decor;
      if (decor && SpriteSheet.decor && SpriteSheet.decor[decor]) {
        const variants = SpriteSheet.decor[decor];
        const variant = variants[(i * 97 + j * 31) % variants.length];
        image(variant, px, py, tileSize, tileSize);
      }
    }
  }
}

// 2D tilemap rendering with viewport culling — uses offscreen buffer
function RenderMap() {
  if (!SpriteSheet.tiles) return;

  // Rebuild buffer if needed (new game / load)
  if (_mapBufferDirty || (!_mapBuffer && !_mapBufferDisabled)) {
    _rebuildMapBuffer();
  }

  // Large maps: fall back to direct per-tile rendering
  if (_mapBufferDisabled) {
    _renderMapDirect();
  } else {
    // Calculate visible region and blit only that portion
    const z = (typeof camZoom !== 'undefined') ? camZoom : 1;
    const halfW = width / 2 / z;
    const halfH = height / 2 / z;
    const sx = Math.max(0, Math.floor(camX - halfW) - tileSize);
    const sy = Math.max(0, Math.floor(camY - halfH) - tileSize);
    const sw = Math.min(_mapBufferW - sx, Math.ceil(halfW * 2) + tileSize * 2);
    const sh = Math.min(_mapBufferH - sy, Math.ceil(halfH * 2) + tileSize * 2);

    if (sw > 0 && sh > 0) {
      // Use the 9-argument image() to blit only the visible slice
      image(_mapBuffer, sx, sy, sw, sh, sx, sy, sw, sh);
    }
  }

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

