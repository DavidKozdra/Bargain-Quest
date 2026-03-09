// --- CONFIG ---
let smoothingPasses = 2;
let tileTypes = ['Water','Sand','Grass','Forest','Snow','Rock'];
let typeColors = {
  Water:'#0077BE', Sand:'#C2B280', Grass:'#5F9F35',
  Forest:'#22551C', Snow:'#F0F8FF', Rock:'#787878'
};
let baseDiff = { Water:5, Sand:2, Grass:1, Forest:3, Snow:4, Rock:6 };


// Yield every N rows during heavy terrain loops to keep the browser responsive.
// At 1500 rows with YIELD_ROW_INTERVAL=150 this adds 10 yield points per pass.
const _YIELD_ROW_INTERVAL = 150;
function _bqTerrainRand() {
  if (typeof window !== 'undefined' && window.BQSeededRNG && typeof window.BQSeededRNG.stream === 'function') {
    return window.BQSeededRNG.stream('terrain:decor').random();
  }
  return Math.random();
}

/** Simple row-level yield inside terrain gen loops. Must be awaited. */
function _yieldRow() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

function _getWorldGenConfig() {
  const raw = (typeof window !== 'undefined' && window._newGameWorldGen && typeof window._newGameWorldGen === 'object')
    ? window._newGameWorldGen
    : {};
  const num = (v, d, min, max) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return d;
    return Math.max(min, Math.min(max, n));
  };
  return {
    warp: num(raw.warp, 1.0, 0, 2),
    ruggedness: num(raw.ruggedness, 1.0, 0.5, 2),
    temperatureVariance: num(raw.temperatureVariance, 1.0, 0, 2),
    moistureVariance: num(raw.moistureVariance, 1.0, 0, 2),
    coastalDropoff: num(raw.coastalDropoff, 1.0, 0.4, 2.2),
  };
}

async function initTerrain() {
  for (let i = 0; i < rows; i++) {
    grid[i] = [];
    elevationMap[i] = [];
    difficultyMap[i] = [];
    temperatureMap[i] = [];
  }
  await genElevation();
  await smoothElevation(smoothingPasses);
  await computeTemperature();
  await assignBiomes();
  await placeDecorations();
  await calcDifficulty();
}

async function genElevation() {
  const cfg = _getWorldGenConfig();
  let s = 0.04;
  const warpScale = 0.018;
  const landmassMode = typeof window._newGameLandmass === 'number' ? window._newGameLandmass : 1;
  let mult = 0.95, offset = 0.02;
  let edgeStart = 0.7, edgeStrength = 0.4;
  let macroWeight = 0.56, midWeight = 0.28, detailWeight = 0.1, ridgeWeight = 0.06;
  if (landmassMode === 0) {
    mult = 0.86; offset = -0.06;
    edgeStart = 0.88; edgeStrength = 0.32;
    macroWeight = 0.45; midWeight = 0.32; detailWeight = 0.15; ridgeWeight = 0.08;
  } else if (landmassMode === 2) {
    mult = 1.03; offset = 0.09;
    edgeStart = 0.75; edgeStrength = 0.3;
    macroWeight = 0.62; midWeight = 0.24; detailWeight = 0.09; ridgeWeight = 0.05;
  }
  const warpAmp = 1.9 * cfg.warp;
  const rugged = cfg.ruggedness;
  detailWeight *= rugged;
  ridgeWeight *= rugged;
  edgeStrength *= cfg.coastalDropoff;

  for (let i = 0; i < rows; i++) {
    if (i % _YIELD_ROW_INTERVAL === 0 && i > 0) await _yieldRow();
    for (let j = 0; j < cols; j++) {
      const baseX = i * s, baseY = j * s;
      const wx = (noise(i * warpScale + 17.3, j * warpScale + 29.1) - 0.5) * warpAmp;
      const wy = (noise(i * warpScale + 71.2, j * warpScale + 11.7) - 0.5) * warpAmp;
      const nx = baseX + wx, ny = baseY + wy;
      const macro = noise(nx * 0.45, ny * 0.45);
      const mid = noise(nx * 1.35, ny * 1.35);
      const detail = noise(nx * 2.7, ny * 2.7);
      const ridge = 1 - Math.abs(noise(nx * 1.9 + 200, ny * 1.9 + 200) * 2 - 1);
      let e = macroWeight * macro + midWeight * mid + detailWeight * detail + ridgeWeight * ridge;

      e = e * mult + offset;
      let ecx = (j / cols - 0.5) * 2;
      let ecy = (i / rows - 0.5) * 2;
      let edgeDist = Math.max(Math.abs(ecx), Math.abs(ecy));
      if (edgeDist > edgeStart) {
        const t = (edgeDist - edgeStart) / (1 - edgeStart);
        e -= t * t * edgeStrength;
      }
      elevationMap[i][j] = Math.max(0, e);
    }
  }
}

async function smoothElevation(passes) {
  for (let p = 0; p < passes; p++) {
    let temp = [];
    for (let i = 0; i < rows; i++) {
      if (i % _YIELD_ROW_INTERVAL === 0 && i > 0) await _yieldRow();
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

async function computeTemperature() {
  const cfg = _getWorldGenConfig();
  const climateScale = 0.012;
  const tempVar = cfg.temperatureVariance;
  for (let i = 0; i < rows; i++) {
    if (i % _YIELD_ROW_INTERVAL === 0 && i > 0) await _yieldRow();
    const latBase = 1.0 - Math.abs(i / rows - 0.5) * 2;
    for (let j = 0; j < cols; j++) {
      const continental = (noise(i * climateScale + 500, j * climateScale + 500) - 0.5) * tempVar;
      const altitudeCold = Math.max(0, elevationMap[i][j] - 0.58) * 1.2;
      temperatureMap[i][j] = Math.max(0, Math.min(1, latBase * 0.82 + (continental + 0.5) * 0.18 - altitudeCold));
    }
  }
}

async function assignBiomes() {
  const cfg = _getWorldGenConfig();
  const moistA = 0.036;
  const moistB = 0.082;
  const moistVar = cfg.moistureVariance;
  for (let i = 0; i < rows; i++) {
    if (i % _YIELD_ROW_INTERVAL === 0 && i > 0) await _yieldRow();
    for (let j = 0; j < cols; j++) {
      let e = elevationMap[i][j];
      let t = temperatureMap[i][j];
      const baseMoisture = 0.66 * noise(i * moistA + 900, j * moistA + 900)
        + 0.34 * noise(i * moistB + 1300, j * moistB + 1300);
      const moisture = Math.max(0, Math.min(1, 0.5 + (baseMoisture - 0.5) * moistVar));
      let type;

      if (e < 0.41) type = 'Water';
      else if (e < 0.47 || (e < 0.53 && moisture < 0.32 && t > 0.55)) type = 'Sand';
      else if (e > 0.87) type = (t < 0.48) ? 'Snow' : 'Rock';
      else if (t < 0.28) type = 'Snow';
      else if (e > 0.74) type = 'Rock';
      else if (moisture > 0.6 && t > 0.36) type = 'Forest';
      else type = 'Grass';

      grid[i][j] = { options: [type], collapsed: true };
    }
  }
}

async function calcDifficulty() {
  for (let i = 0; i < rows; i++) {
    if (i % _YIELD_ROW_INTERVAL === 0 && i > 0) await _yieldRow();
    for (let j = 0; j < cols; j++) {
      let t = grid[i][j].options[0];
      let e = elevationMap[i][j];
      difficultyMap[i][j] = baseDiff[t] + e * 5;
    }
  }
}

/** Scatter decorative props across the map based on biome */
async function placeDecorations() {
  const DECOR_TABLE = {
    Grass:  [['bush', 0.08], ['tree', 0.05], ['rock', 0.03], ['pebbles', 0.02]],
    Forest: [['rock', 0.03]],
    Sand:   [['pebbles', 0.10], ['rock', 0.04], ['bush', 0.02]],
    Rock:   [['pebbles', 0.08], ['rock', 0.06]],
    Snow:   [['snowdrift', 0.10], ['rock', 0.03]],
    Water:  [['lily', 0.04], ['seaweed', 0.04]],
  };

  for (let i = 0; i < rows; i++) {
    if (i % _YIELD_ROW_INTERVAL === 0 && i > 0) await _yieldRow();
    for (let j = 0; j < cols; j++) {
      const type = grid[i][j].options[0];
      const table = DECOR_TABLE[type];
      if (!table) continue;
      for (const [decorType, chance] of table) {
        if (_bqTerrainRand() < chance) {
          grid[i][j].decor = decorType;
          break;
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
// Staggered generation: at most _MAX_NEW_CHUNKS_PER_FRAME new chunks are
// created per frame. Chunks not yet generated show a solid-colour placeholder
// so the game never stalls waiting for terrain to render.
//
const _CHUNK_TILES            = 64;  // tiles per chunk edge (64 × 32px = 2048px)
const _MAX_CACHED_CHUNKS      = 50;  // LRU eviction limit
const _MAX_NEW_CHUNKS_PER_FRAME = 1; // max new chunks created per draw() call
let _chunks     = new Map();         // "cx,cy" -> { graphics: p5.Graphics, lastUsed: number }
let _chunkQueue = [];                // pending [cx, cy] pairs waiting to be rendered
let _chunkQueueHead = 0;             // dequeue cursor for O(1) pops (avoids Array.shift())
let _chunkQueuedSet = new Set();     // dedupe keys currently in _chunkQueue
let _newChunksThisFrame = 0;        // reset by RenderMap() each frame

/**
 * Invalidate all cached chunks — called on new game / load / map change.
 * Frees GPU memory for each chunk before clearing the cache.
 */
function invalidateMapBuffer() {
  for (const entry of _chunks.values()) {
    if (entry.graphics) entry.graphics.remove();
  }
  _chunks.clear();
  _chunkQueue = [];
  _chunkQueueHead = 0;
  _chunkQueuedSet.clear();
  // During startup/load pipelines, worldInitialized is false and minimap may
  // already be queued/generated; avoid wiping it in that phase.
  if (typeof window !== 'undefined' && typeof worldInitialized !== 'undefined' && worldInitialized && typeof window.invalidateMinimap === 'function') {
    window.invalidateMinimap();
  }
}

/**
 * Synchronously render one chunk into a p5.Graphics and cache it.
 * This is the expensive operation — only call it when the frame budget allows.
 */
function _buildChunk(cx, cy) {
  const key = `${cx},${cy}`;
  if (_chunks.has(key)) return; // already cached (may have been built while queued)

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

  const startCol = cx * _CHUNK_TILES;
  const startRow = cy * _CHUNK_TILES;
  const endCol   = Math.min(startCol + _CHUNK_TILES, cols);
  const endRow   = Math.min(startRow + _CHUNK_TILES, rows);
  const chunkW   = (endCol - startCol) * tileSize;
  const chunkH   = (endRow - startRow) * tileSize;

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

      const elev = elevationMap[i][j];
      if (elev > 0.5 && type !== 'Water') {
        g.fill(0, 0, 0, (elev - 0.5) * 40);
        g.noStroke();
        g.rect(px, py, tileSize, tileSize);
      }

      const decor = grid[i][j].decor;
      if (decor && SpriteSheet.decor && SpriteSheet.decor[decor]) {
        const variants = SpriteSheet.decor[decor];
        g.image(variants[(i * 97 + j * 31) % variants.length], px, py, tileSize, tileSize);
      }
    }
  }

  g.stroke(0, 0, 0, 15);
  g.strokeWeight(0.5);
  for (let i = 0; i <= endRow - startRow; i++) g.line(0, i * tileSize, chunkW, i * tileSize);
  for (let j = 0; j <= endCol - startCol; j++) g.line(j * tileSize, 0, j * tileSize, chunkH);
  g.noStroke();

  _chunks.set(key, { graphics: g, lastUsed: frameCount });
}

// 2D tilemap rendering — chunk-based, staggered generation, scales to huge maps
function RenderMap() {
  if (!SpriteSheet.tiles) return;

  _newChunksThisFrame = 0; // reset per-frame budget

  const chunkPx     = _CHUNK_TILES * tileSize;
  const z           = (typeof camZoom !== 'undefined') ? camZoom : 1;
  const halfW       = width  / 2 / z;
  const halfH       = height / 2 / z;
  const maxChunkCol = Math.ceil(cols / _CHUNK_TILES) - 1;
  const maxChunkRow = Math.ceil(rows / _CHUNK_TILES) - 1;
  const startCX     = Math.max(0, Math.floor((camX - halfW) / chunkPx) - 1);
  const startCY     = Math.max(0, Math.floor((camY - halfH) / chunkPx) - 1);
  const endCX       = Math.min(maxChunkCol, Math.ceil((camX + halfW) / chunkPx));
  const endCY       = Math.min(maxChunkRow, Math.ceil((camY + halfH) / chunkPx));

  for (let cy = startCY; cy <= endCY; cy++) {
    for (let cx = startCX; cx <= endCX; cx++) {
      const key    = `${cx},${cy}`;
      const cached = _chunks.get(key);

      if (cached) {
        // Fast path: chunk is ready — update LRU and blit
        cached.lastUsed = frameCount;
        image(cached.graphics, cx * chunkPx, cy * chunkPx);
      } else if (_newChunksThisFrame < _MAX_NEW_CHUNKS_PER_FRAME) {
        // Budget available: build this chunk now
        _buildChunk(cx, cy);
        _newChunksThisFrame++;
        const built = _chunks.get(key);
        if (built) image(built.graphics, cx * chunkPx, cy * chunkPx);
      } else {
        // Budget exhausted: draw placeholder colour for this frame.
        // Sample the centre tile of the chunk for a rough colour.
        const midRow = Math.min(cy * _CHUNK_TILES + _CHUNK_TILES / 2, rows - 1);
        const midCol = Math.min(cx * _CHUNK_TILES + _CHUNK_TILES / 2, cols - 1);
        const type   = grid[Math.floor(midRow)][Math.floor(midCol)].options[0];
        fill(typeColors[type] || '#444');
        noStroke();
        const chunkW = (Math.min((cx + 1) * _CHUNK_TILES, cols) - cx * _CHUNK_TILES) * tileSize;
        const chunkH = (Math.min((cy + 1) * _CHUNK_TILES, rows) - cy * _CHUNK_TILES) * tileSize;
        rect(cx * chunkPx, cy * chunkPx, chunkW, chunkH);
        // Queue this chunk for next frames
        if (!_chunkQueuedSet.has(key)) {
          _chunkQueue.push([cx, cy]);
          _chunkQueuedSet.add(key);
        }
      }
    }
  }

  // Drain the queue — build 1 extra chunk per frame from backlog
  // (these are chunks just outside the viewport that will soon be needed)
  while (_chunkQueueHead < _chunkQueue.length && _newChunksThisFrame < _MAX_NEW_CHUNKS_PER_FRAME + 1) {
    const [qcx, qcy] = _chunkQueue[_chunkQueueHead++];
    const qKey = `${qcx},${qcy}`;
    _chunkQueuedSet.delete(qKey);
    if (!_chunks.has(qKey)) {
      _buildChunk(qcx, qcy);
      _newChunksThisFrame++;
    }
  }

  // Periodically compact queue storage after head advances.
  if (_chunkQueueHead > 256 && _chunkQueueHead * 2 >= _chunkQueue.length) {
    _chunkQueue = _chunkQueue.slice(_chunkQueueHead);
    _chunkQueueHead = 0;
  } else if (_chunkQueueHead >= _chunkQueue.length) {
    _chunkQueue.length = 0;
    _chunkQueueHead = 0;
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


// ── Web Worker terrain generation ─────────────────────────────────────────────
//
// Runs the full terrain pipeline in a dedicated worker thread so the main thread
// stays free to repaint the loading overlay.  Falls back to the synchronous
// initTerrain() if Workers are unavailable.
//
// Biome index: 0=Water 1=Sand 2=Grass 3=Forest 4=Snow 5=Rock
// Decor index: 0=none 1=bush 2=tree 3=rock 4=pebbles 5=snowdrift 6=lily 7=seaweed

const _BIOME_NAMES = ['Water', 'Sand', 'Grass', 'Forest', 'Snow', 'Rock'];
const _DECOR_NAMES = [null, 'bush', 'tree', 'rock', 'pebbles', 'snowdrift', 'lily', 'seaweed'];

/**
 * Spawn a terrain worker, run the full gen pipeline, reconstruct global
 * grid / elevationMap / temperatureMap / difficultyMap from the results,
 * and return a Promise that resolves when everything is ready.
 */
function initTerrainWorker() {
  if (typeof Worker === 'undefined') {
    console.warn('[terrain] Web Workers not available — falling back to synchronous gen');
    return initTerrain();
  }

  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker('workers/terrain.worker.js');
    } catch (err) {
      console.warn('[terrain] Worker creation failed — falling back to synchronous gen:', err);
      resolve(initTerrain());
      return;
    }

    worker.onmessage = function(e) {
      const msg = e.data;

      if (msg.type === 'progress') {
        if (typeof updateLoadingOverlay === 'function') {
          const labels = {
            elevation:   'Shaping elevation…',
            smooth:      'Smoothing terrain…',
            temperature: 'Setting climate…',
            biomes:      'Assigning biomes…',
            decorations: 'Placing details…',
            difficulty:  'Calculating difficulty…',
          };
          updateLoadingOverlay(labels[msg.step] || 'Generating terrain…', msg.pct);
        }
        return;
      }

      if (msg.type === 'error') {
        worker.terminate();
        console.error('[terrain worker] error:', msg.message);
        initTerrain().then(resolve).catch(reject);
        return;
      }

      if (msg.type === 'done') {
        worker.terminate();

        const { elevationFlat, tempFlat, diffFlat, biomeFlat, decorFlat } = msg;

        // Reconstruct global arrays from flat TypedArrays
        for (let i = 0; i < rows; i++) {
          const gRow = grid[i] || (grid[i] = new Array(cols));
          const eRow = elevationMap[i] || (elevationMap[i] = new Array(cols));
          const tRow = temperatureMap[i] || (temperatureMap[i] = new Array(cols));
          const dRow = difficultyMap[i] || (difficultyMap[i] = new Array(cols));
          const rowBase = i * cols;

          for (let j = 0; j < cols; j++) {
            const idx   = rowBase + j;
            const biome = _BIOME_NAMES[biomeFlat[idx]] || 'Grass';
            const decor = _DECOR_NAMES[decorFlat[idx]];

            eRow[j] = elevationFlat[idx];
            tRow[j] = tempFlat[idx];
            dRow[j] = diffFlat[idx];
            gRow[j] = decor
              ? { options: [biome], collapsed: true, decor }
              : { options: [biome], collapsed: true };
          }
        }

        resolve();
      }
    };

    worker.onerror = function(err) {
      worker.terminate();
      console.error('[terrain worker] uncaught error:', err);
      initTerrain().then(resolve).catch(reject);
    };

    // Kick off the worker
    worker.postMessage({
      type:         'init',
      rows,
      cols,
      landmassMode: (typeof window._newGameLandmass === 'number') ? window._newGameLandmass : 1,
      worldGenConfig: _getWorldGenConfig(),
      seed:         (typeof window._mapSeed === 'number') ? window._mapSeed : Math.floor(Math.random() * 1e9),
    });
  });
}
