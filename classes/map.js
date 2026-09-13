// --- CONFIG ---
let smoothingPasses = 2;
let tileTypes = ['Water','Sand','Grass','Forest','Snow','Rock','Sulfur'];
let typeColors = {
  Water:'#0077BE', Sand:'#C2B280', Grass:'#5F9F35',
  Forest:'#22551C', Snow:'#F0F8FF', Rock:'#787878', Sulfur:'#d9cf4a'
};
let baseDiff = { Water:5, Sand:2, Grass:1, Forest:3, Snow:4, Rock:6, Sulfur:7 };

function _bqActivePlanetSurfaceContext() {
  if (typeof window === 'undefined' || typeof window.BQGetWorldSession !== 'function') return null;
  const session = window.BQGetWorldSession();
  return session?.sessionType === 'planet_surface' ? (session.spaceContext || {}) : null;
}

function _bqHexToRgb(hex) {
  const s = String(hex || '').replace('#', '').trim();
  if (s.length !== 6) return [0, 0, 0];
  return [
    parseInt(s.slice(0, 2), 16) || 0,
    parseInt(s.slice(2, 4), 16) || 0,
    parseInt(s.slice(4, 6), 16) || 0,
  ];
}

function _bqPlanetTerrainPalette(context = _bqActivePlanetSurfaceContext()) {
  if (!context) return null;
  const biome = String(context.biome || context.bodyBiome || '').toLowerCase();
  const bodyKey = String(context.bodyKey || '').toLowerCase();
  const nodeKey = String(context.nodeKey || '').toLowerCase();
  const base = {
    Water: '#1b6f91',
    Sand: '#9f855b',
    Grass: '#5f9f35',
    Forest: '#22551c',
    Snow: '#dbe9f7',
    Rock: '#787878',
    Sulfur: '#d9cf4a',
  };

  if (biome === 'volcanic' || bodyKey.includes('solara')) {
    return { ...base, Water: '#26121a', Sand: '#8d3a22', Grass: '#a64a25', Forest: '#4b1b1e', Snow: '#7d7771', Rock: '#30313a', Sulfur: '#ffc247' };
  }
  if (biome === 'hazard' || nodeKey === 'vanta') {
    return { ...base, Water: '#20183a', Sand: '#65466e', Grass: '#6a3f52', Forest: '#24152d', Snow: '#a9b1c8', Rock: '#2d2a3f', Sulfur: '#e1d34a' };
  }
  if (biome === 'ice' || bodyKey.includes('cryo') || bodyKey.includes('ice')) {
    return { ...base, Water: '#244a6b', Sand: '#b9c9d9', Grass: '#9fb6c8', Forest: '#476074', Snow: '#ecf8ff', Rock: '#465466', Sulfur: '#d8e26a' };
  }
  if (biome === 'lush' || biome === 'garden' || biome === 'jungle' || nodeKey === 'aurelia') {
    return { ...base, Water: '#147f8f', Sand: '#7f6d97', Grass: '#20a57a', Forest: '#125f54', Snow: '#bde9df', Rock: '#4b5a69', Sulfur: '#c6ef5a' };
  }
  if (biome === 'asteroid' || bodyKey.includes('obsidium')) {
    return { ...base, Water: '#11131f', Sand: '#63545f', Grass: '#51475a', Forest: '#302936', Snow: '#a7a9b4', Rock: '#34323a', Sulfur: '#b99d3f' };
  }
  if (biome === 'moon' || biome === 'station' || nodeKey === 'luna') {
    return { ...base, Water: '#1d2630', Sand: '#8f877d', Grass: '#7f858a', Forest: '#555e66', Snow: '#c6ccd4', Rock: '#5e6269', Sulfur: '#c9b94d' };
  }
  return base;
}

function _bqTerrainColor(type, asRgb = false) {
  const palette = _bqPlanetTerrainPalette();
  const color = (palette && palette[type]) || typeColors[type] || '#000000';
  return asRgb ? _bqHexToRgb(color) : color;
}
if (typeof window !== 'undefined') {
  window.BQGetTerrainColor = _bqTerrainColor;
  window.BQGetPlanetTerrainPalette = _bqPlanetTerrainPalette;
}

function _bqPlanetTextureStyle(context = _bqActivePlanetSurfaceContext()) {
  if (!context) return null;
  const biome = String(context.biome || '').toLowerCase();
  if (biome === 'volcanic') return 'veins';
  if (biome === 'hazard') return 'scarred';
  if (biome === 'ice') return 'crystal';
  if (biome === 'lush' || biome === 'garden' || biome === 'jungle') return 'bio';
  if (biome === 'asteroid' || biome === 'moon' || biome === 'station') return 'dust';
  return 'alien';
}

// The terrain cache uses native density-1 canvases. Keep the same planet motifs
// without creating p5 wrappers or resetting its renderer for every tile.
function _drawChunkPlanetTexture(ctx, type, px, py, i, j, style) {
  if (!style || type === 'Water') return;
  const roll = ((i * 928371 + j * 689287 + String(type).length * 37) % 1000) / 1000;
  ctx.save();
  ctx.beginPath();
  if (style === 'veins' && (type === 'Sulfur' || type === 'Rock' || type === 'Sand') && roll < 0.34) {
    ctx.strokeStyle = 'rgba(255,103,46,' + 70 / 255 + ')';
    ctx.lineWidth = Math.max(1, tileSize * 0.045);
    ctx.moveTo(px + tileSize * 0.12, py + tileSize * (0.25 + roll * 0.5));
    ctx.lineTo(px + tileSize * 0.88, py + tileSize * (0.18 + ((roll * 1.7) % 0.64)));
    ctx.stroke();
  } else if (style === 'crystal' && (type === 'Snow' || type === 'Rock') && roll < 0.26) {
    ctx.strokeStyle = 'rgba(180,235,255,' + 95 / 255 + ')';
    ctx.lineWidth = 1;
    ctx.moveTo(px + tileSize * 0.5, py + tileSize * 0.14);
    ctx.lineTo(px + tileSize * 0.24, py + tileSize * 0.72);
    ctx.lineTo(px + tileSize * 0.76, py + tileSize * 0.72);
    ctx.closePath();
    ctx.stroke();
  } else if (style === 'bio' && (type === 'Grass' || type === 'Forest') && roll < 0.38) {
    ctx.fillStyle = 'rgba(116,255,206,' + 65 / 255 + ')';
    ctx.arc(px + tileSize * (0.25 + roll * 0.5), py + tileSize * (0.25 + ((roll * 2.1) % 0.5)), tileSize * 0.09, 0, Math.PI * 2);
    ctx.fill();
  } else if ((style === 'dust' || style === 'scarred' || style === 'alien') && roll < 0.22) {
    ctx.fillStyle = 'rgba(255,255,255,' + (style === 'dust' ? 28 : 38) / 255 + ')';
    ctx.arc(px + tileSize * (0.2 + roll * 0.6), py + tileSize * (0.18 + ((roll * 1.9) % 0.6)), tileSize * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

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
    Sulfur: [['pebbles', 0.14], ['rock', 0.10]],
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
// World data stays at tile resolution. Only the raster cache changes detail.
// Native canvases avoid inherited DPR allocations and p5 work per terrain tile.
const _CHUNK_TILES = 64;
const _MAX_CHUNK_CACHE_BYTES = 128 * 1024 * 1024;
const _CHUNK_BUILD_BUDGET_MS = 3;
let _chunks = new Map();
let _chunkCacheBytes = 0;
let _chunkBuildJob = null;
let _chunkQueue = [];
let _chunkQueueHead = 0;
let _newChunksThisFrame = 0;
let _chunkVisibleKeys = new Set();
let _chunkRasterScale = 1;
let _mapRenderStats = { visibleChunks: 0, drawnChunks: 0, pendingChunks: 0, builtChunks: 0, buildMs: 0 };

function _terrainNow() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function _chunkKey(cx, cy, rasterScale) {
  return cx + ',' + cy + '@' + rasterScale;
}

function _releaseChunk(entry) {
  // Explicitly release pixel storage; these canvases are never attached to DOM.
  entry.graphics.canvas.width = 0;
  entry.graphics.canvas.height = 0;
}

/** Clear both completed raster caches and partially rendered work on world edits. */
function invalidateMapBuffer() {
  for (const entry of _chunks.values()) _releaseChunk(entry);
  _chunks.clear();
  _chunkCacheBytes = 0;
  if (_chunkBuildJob) _releaseChunk(_chunkBuildJob);
  _chunkBuildJob = null;
  _chunkQueue = [];
  _chunkQueueHead = 0;
  _chunkVisibleKeys.clear();
  if (typeof window !== 'undefined' && typeof worldInitialized !== 'undefined' && worldInitialized && typeof window.invalidateMinimap === 'function') {
    window.invalidateMinimap();
  }
}

/** Raster resolution follows projected size, then fits the whole visible set. */
function _getChunkRasterScale(zoom, visibleCount) {
  const density = typeof pixelDensity === 'function' ? pixelDensity() : 1;
  let scale = 1;
  const projectedScale = Math.min(1, zoom * Math.max(1, density));
  while (scale / 2 >= projectedScale) scale /= 2;
  const fullChunkBytes = Math.pow(_CHUNK_TILES * tileSize, 2) * 4;
  // Leave room for edge crossings and replacements. Never solve pressure by
  // evicting a visible chunk and regenerating it on the next stationary frame.
  while (visibleCount * fullChunkBytes * scale * scale > _MAX_CHUNK_CACHE_BYTES * 0.75) scale /= 2;
  return scale;
}

function _reserveChunkBytes(bytes) {
  while (_chunkCacheBytes + bytes > _MAX_CHUNK_CACHE_BYTES) {
    let victim = null, oldest = Infinity;
    for (const [key, entry] of _chunks) {
      if (_chunkVisibleKeys.has(key)) continue;
      if (entry.lastUsed < oldest) { victim = key; oldest = entry.lastUsed; }
    }
    if (victim === null) return false;
    const entry = _chunks.get(victim);
    _chunkCacheBytes -= entry.bytes;
    _releaseChunk(entry);
    _chunks.delete(victim);
  }
  return true;
}

/** Start one incremental chunk job. Allocation itself does not rasterize tiles. */
function _buildChunk(cx, cy, rasterScale = _chunkRasterScale) {
  const key = _chunkKey(cx, cy, rasterScale);
  if (_chunks.has(key) || _chunkBuildJob) return;
  const startCol = cx * _CHUNK_TILES;
  const startRow = cy * _CHUNK_TILES;
  const endCol = Math.min(startCol + _CHUNK_TILES, cols);
  const endRow = Math.min(startRow + _CHUNK_TILES, rows);
  const worldW = (endCol - startCol) * tileSize;
  const worldH = (endRow - startRow) * tileSize;
  const rasterW = Math.max(1, Math.ceil(worldW * rasterScale));
  const rasterH = Math.max(1, Math.ceil(worldH * rasterScale));
  const bytes = rasterW * rasterH * 4;
  if (!_reserveChunkBytes(bytes)) return;
  const canvas = document.createElement('canvas');
  canvas.width = rasterW;
  canvas.height = rasterH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.scale(rasterScale, rasterScale);
  const planetContext = _bqActivePlanetSurfaceContext();
  const palette = _bqPlanetTerrainPalette(planetContext) || typeColors;
  _chunkBuildJob = {
    key, cx, cy, rasterScale, graphics: { canvas, width: rasterW, height: rasterH },
    bytes, worldW, worldH, startCol, startRow, endCol, endRow,
    col: startCol, row: startRow, ctx, palette,
    planetContext, planetStyle: _bqPlanetTextureStyle(planetContext),
  };
}

function _advanceChunkBuild(deadline) {
  const job = _chunkBuildJob;
  if (!job) return;
  const ctx = job.ctx;
  let batch = 0;
  while (job.row < job.endRow) {
    const i = job.row, j = job.col;
    const type = grid[i][j].options[0];
    const px = (j - job.startCol) * tileSize;
    const py = (i - job.startRow) * tileSize;
    const sprite = job.planetContext ? null : SpriteSheet.tiles[type];
    const source = sprite && (sprite.canvas || sprite.elt || sprite);
    if (source) {
      ctx.drawImage(source, px, py, tileSize, tileSize);
    } else {
      ctx.fillStyle = job.palette[type] || '#000000';
      ctx.fillRect(px, py, tileSize, tileSize);
    }
    const elev = elevationMap[i][j];
    if (elev > 0.5 && type !== 'Water') {
      ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, (elev - 0.5) * 40 / 255) + ')';
      ctx.fillRect(px, py, tileSize, tileSize);
    }
    if (job.planetContext) _drawChunkPlanetTexture(ctx, type, px, py, i, j, job.planetStyle);
    const decor = grid[i][j].decor;
    const variants = decor && SpriteSheet.decor && SpriteSheet.decor[decor];
    if (variants && variants.length) {
      const detail = variants[(i * 97 + j * 31) % variants.length];
      ctx.drawImage(detail.canvas || detail.elt || detail, px, py, tileSize, tileSize);
    }
    if (++job.col >= job.endCol) { job.col = job.startCol; job.row++; }
    // Check in small batches so even expensive planet textures yield promptly.
    if (++batch % 32 === 0 && _terrainNow() >= deadline) return;
  }
  ctx.strokeStyle = 'rgba(0,0,0,' + 15 / 255 + ')';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let i = 0; i <= job.endRow - job.startRow; i++) {
    ctx.moveTo(0, i * tileSize); ctx.lineTo(job.worldW, i * tileSize);
  }
  for (let j = 0; j <= job.endCol - job.startCol; j++) {
    ctx.moveTo(j * tileSize, 0); ctx.lineTo(j * tileSize, job.worldH);
  }
  ctx.stroke();
  job.lastUsed = frameCount;
  _chunks.set(job.key, job);
  _chunkCacheBytes += job.bytes;
  _chunkBuildJob = null;
  _newChunksThisFrame++;
}

function _getCachedChunk(cx, cy, scale) {
  const exact = _chunks.get(_chunkKey(cx, cy, scale));
  if (exact) return exact;
  // Keep the previous detail level visible while its replacement is building.
  for (let candidate = 1; candidate >= Math.min(scale, 1 / 32); candidate /= 2) {
    const cached = _chunks.get(_chunkKey(cx, cy, candidate));
    if (cached) return cached;
  }
  return null;
}

/** Culls raster work to the actual viewport, including the camera shake offset. */
function RenderMap(shakeX = 0, shakeY = 0) {
  if (!SpriteSheet.tiles || !grid.length) return;
  _newChunksThisFrame = 0;
  const chunkPx = _CHUNK_TILES * tileSize;
  const zoom = Math.max(0.001, typeof camZoom !== 'undefined' ? camZoom : 1);
  const centerX = camX - shakeX;
  const centerY = camY - shakeY;
  const halfW = width / (2 * zoom), halfH = height / (2 * zoom);
  const startCX = Math.max(0, Math.floor((centerX - halfW) / chunkPx));
  const startCY = Math.max(0, Math.floor((centerY - halfH) / chunkPx));
  const endCX = Math.min(Math.ceil(cols / _CHUNK_TILES) - 1, Math.ceil((centerX + halfW) / chunkPx) - 1);
  const endCY = Math.min(Math.ceil(rows / _CHUNK_TILES) - 1, Math.ceil((centerY + halfH) / chunkPx) - 1);
  const visibleCount = Math.max(0, endCX - startCX + 1) * Math.max(0, endCY - startCY + 1);
  _chunkRasterScale = _getChunkRasterScale(zoom, visibleCount);
  _chunkVisibleKeys.clear();
  _chunkQueue.length = 0;
  _chunkQueueHead = 0;
  for (let cy = startCY; cy <= endCY; cy++) {
    for (let cx = startCX; cx <= endCX; cx++) {
      const key = _chunkKey(cx, cy, _chunkRasterScale);
      _chunkVisibleKeys.add(key);
      if (!_chunks.has(key)) _chunkQueue.push([cx, cy]);
    }
  }
  // A camera jump or LOD change cancels obsolete partial work immediately.
  if (_chunkBuildJob && !_chunkVisibleKeys.has(_chunkBuildJob.key)) {
    _releaseChunk(_chunkBuildJob);
    _chunkBuildJob = null;
  }
  if (_chunkQueue.length) {
    _chunkQueue.sort((a, b) =>
      Math.abs((a[0] + 0.5) * chunkPx - centerX) + Math.abs((a[1] + 0.5) * chunkPx - centerY)
      - Math.abs((b[0] + 0.5) * chunkPx - centerX) - Math.abs((b[1] + 0.5) * chunkPx - centerY));
  }
  const started = _terrainNow(), deadline = started + _CHUNK_BUILD_BUDGET_MS;
  while (_terrainNow() < deadline && (_chunkBuildJob || _chunkQueueHead < _chunkQueue.length)) {
    if (!_chunkBuildJob) {
      const [cx, cy] = _chunkQueue[_chunkQueueHead++];
      _buildChunk(cx, cy);
      if (!_chunkBuildJob) continue;
    }
    _advanceChunkBuild(deadline);
  }
  const buildMs = _terrainNow() - started;
  let drawnChunks = 0, pendingChunks = 0;
  const ctx = drawingContext;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // Cover areas outside the world as well; panning must not leave stale pixels.
  ctx.fillStyle = '#08111a';
  ctx.fillRect(centerX - halfW, centerY - halfH, halfW * 2, halfH * 2);
  for (let cy = startCY; cy <= endCY; cy++) {
    for (let cx = startCX; cx <= endCX; cx++) {
      const cached = _getCachedChunk(cx, cy, _chunkRasterScale);
      if (!_chunks.has(_chunkKey(cx, cy, _chunkRasterScale))) pendingChunks++;
      if (cached) {
        cached.lastUsed = frameCount;
        // Let the canvas clip boundary chunks. Explicit source cropping took a
        // slower raster path in Chromium at fractional zoom in the stress test.
        ctx.drawImage(cached.graphics.canvas, cx * chunkPx, cy * chunkPx, cached.worldW, cached.worldH);
        drawnChunks++;
      } else {
        const midRow = Math.min(cy * _CHUNK_TILES + _CHUNK_TILES / 2, rows - 1);
        const midCol = Math.min(cx * _CHUNK_TILES + _CHUNK_TILES / 2, cols - 1);
        const type = grid[Math.floor(midRow)]?.[Math.floor(midCol)]?.options[0] || 'Water';
        ctx.fillStyle = _bqTerrainColor(type);
        ctx.fillRect(cx * chunkPx, cy * chunkPx,
          (Math.min((cx + 1) * _CHUNK_TILES, cols) - cx * _CHUNK_TILES) * tileSize,
          (Math.min((cy + 1) * _CHUNK_TILES, rows) - cy * _CHUNK_TILES) * tileSize);
      }
    }
  }
  ctx.restore();
  _mapRenderStats = { visibleChunks: visibleCount, drawnChunks, pendingChunks, builtChunks: _newChunksThisFrame, buildMs };

  if (player && player.path && player.path.length > 0) {
    noFill();
    stroke(255, 255, 100, 120);
    strokeWeight(2);
    drawVisibleWorldPath(player.path, (player.x + 0.5) * tileSize, (player.y + 0.5) * tileSize);
    noStroke();
  }
}

if (typeof window !== 'undefined') {
  window.BQGetTerrainRenderStats = function () {
    return { ..._mapRenderStats, rasterScale: _chunkRasterScale, cachedChunks: _chunks.size,
      cacheBytes: _chunkCacheBytes + (_chunkBuildJob?.bytes || 0), cacheLimitBytes: _MAX_CHUNK_CACHE_BYTES };
  };
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
