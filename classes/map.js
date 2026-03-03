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

// ── Chunk-based terrain rendering ────────────────────────────────────────────
//
// Instead of one giant offscreen canvas (which hits browser limits ~500 tiles
// at tileSize 32), we divide the map into CHUNK_TILES×CHUNK_TILES tile blocks.
// Each chunk gets its own p5.Graphics rendered once and cached in an LRU map.
// Only the ~4-9 chunks visible per frame are blitted — everything else stays
// cached until evicted. This scales cleanly to 1500×1500+ maps.
//
const _CHUNK_TILES     = 64;   // tiles per chunk edge (64 × 32px = 2048px canvas)
const _MAX_CACHED_CHUNKS = 50; // LRU limit — covers zoom-out down to ~0.15×
let _chunks = new Map();       // "cx,cy" -> { graphics: p5.Graphics, lastUsed: number }

/**
 * Invalidate all cached chunks — called on new game / load / map change.
 * Frees GPU memory for each chunk before clearing the cache.
 */
function invalidateMapBuffer() {
  for (const entry of _chunks.values()) {
    if (entry.graphics) entry.graphics.remove();
  }
  _chunks.clear();
}

/**
 * Return the rendered p5.Graphics for chunk (cx, cy), creating it if needed.
 * Evicts the least-recently-used chunk when the cache is full.
 */
function _getOrRenderChunk(cx, cy) {
  const key = `${cx},${cy}`;
  const cached = _chunks.get(key);
  if (cached) {
    cached.lastUsed = frameCount;
    return cached.graphics;
  }

  // Evict LRU when at capacity
  if (_chunks.size >= _MAX_CACHED_CHUNKS) {
    let lruKey = null, lruFrame = Infinity;
    for (const [k, v] of _chunks) {
      if (v.lastUsed < lruFrame) { lruFrame = v.lastUsed; lruKey = k; }
    }
    if (lruKey) {
      _chunks.get(lruKey).graphics.remove();
      _chunks.delete(lruKey);
    }
  }

  // Determine which tiles this chunk covers
  const startCol = cx * _CHUNK_TILES;
  const startRow = cy * _CHUNK_TILES;
  const endCol   = Math.min(startCol + _CHUNK_TILES, cols);
  const endRow   = Math.min(startRow + _CHUNK_TILES, rows);
  const chunkW   = (endCol - startCol) * tileSize;
  const chunkH   = (endRow - startRow) * tileSize;

  // Render chunk into an offscreen canvas at natural (1:1) scale
  const g = createGraphics(chunkW, chunkH);
  g.clear();

  for (let i = startRow; i < endRow; i++) {
    for (let j = startCol; j < endCol; j++) {
      const type   = grid[i][j].options[0];
      const px     = (j - startCol) * tileSize;
      const py     = (i - startRow) * tileSize;
      const sprite = SpriteSheet.tiles[type];

      if (sprite) {
        g.image(sprite, px, py, tileSize, tileSize);
      } else {
        g.fill(typeColors[type] || '#000');
        g.noStroke();
        g.rect(px, py, tileSize, tileSize);
      }

      // Elevation shading
      const elev = elevationMap[i][j];
      if (elev > 0.5 && type !== 'Water') {
        g.fill(0, 0, 0, (elev - 0.5) * 40);
        g.noStroke();
        g.rect(px, py, tileSize, tileSize);
      }

      // Decoration overlay
      const decor = grid[i][j].decor;
      if (decor && SpriteSheet.decor && SpriteSheet.decor[decor]) {
        const variants = SpriteSheet.decor[decor];
        const variant  = variants[(i * 97 + j * 31) % variants.length];
        g.image(variant, px, py, tileSize, tileSize);
      }
    }
  }

  // Grid lines (only within the valid tile area)
  g.stroke(0, 0, 0, 15);
  g.strokeWeight(0.5);
  for (let i = 0; i <= endRow - startRow; i++) g.line(0, i * tileSize, chunkW, i * tileSize);
  for (let j = 0; j <= endCol - startCol; j++) g.line(j * tileSize, 0, j * tileSize, chunkH);
  g.noStroke();

  _chunks.set(key, { graphics: g, lastUsed: frameCount });
  return g;
}

// 2D tilemap rendering — chunk-based, scales to arbitrarily large maps
function RenderMap() {
  if (!SpriteSheet.tiles) return;

  const chunkPx = _CHUNK_TILES * tileSize; // pixels per chunk edge
  const z = (typeof camZoom !== 'undefined') ? camZoom : 1;
  const halfW = width  / 2 / z;
  const halfH = height / 2 / z;

  // Compute which chunk columns/rows are visible (with 1-chunk margin)
  const maxChunkCol = Math.ceil(cols / _CHUNK_TILES) - 1;
  const maxChunkRow = Math.ceil(rows / _CHUNK_TILES) - 1;
  const startCX = Math.max(0, Math.floor((camX - halfW) / chunkPx) - 1);
  const startCY = Math.max(0, Math.floor((camY - halfH) / chunkPx) - 1);
  const endCX   = Math.min(maxChunkCol, Math.ceil((camX + halfW) / chunkPx));
  const endCY   = Math.min(maxChunkRow, Math.ceil((camY + halfH) / chunkPx));

  for (let cy = startCY; cy <= endCY; cy++) {
    for (let cx = startCX; cx <= endCX; cx++) {
      const g = _getOrRenderChunk(cx, cy);
      // Blit at the chunk's world-pixel position; the current push/translate
      // transform handles camera pan + zoom automatically
      image(g, cx * chunkPx, cy * chunkPx);
    }
  }

  // Path preview
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

