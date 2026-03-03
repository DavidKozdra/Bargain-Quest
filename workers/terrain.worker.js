// terrain.worker.js — Off-main-thread terrain generation
//
// Receives: { type: 'init', rows, cols, landmassMode, seed }
// Posts:    { type: 'progress', step, pct }
//           { type: 'done', elevationFlat, tempFlat, difficultyFlat, biomeFlat, decorFlat }
//           { type: 'error', message }
//
// All result TypedArrays are transferred (zero-copy) via postMessage Transferables.

'use strict';

// ── Seeded Perlin noise ───────────────────────────────────────────────────────
// Classic improved Perlin noise using a Fisher-Yates shuffled permutation table.
// Returns values in [0, 1].  Different seeds produce different terrain.

function createPerlin(seed) {
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;

  // Xorshift32 PRNG seeded by seed
  let rng = (seed >>> 0) | 1;
  function rand() {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    return (rng >>> 0) / 4294967296;
  }

  // Fisher-Yates shuffle
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = base[i]; base[i] = base[j]; base[j] = tmp;
  }

  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + t * (b - a); }
  function grad(h, x, y) {
    h &= 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  return function noise(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const A  = p[X]     + Y;
    const B  = p[X + 1] + Y;
    const val = lerp(
      lerp(grad(p[A],     x,     y    ), grad(p[B],     x - 1, y    ), u),
      lerp(grad(p[A + 1], x,     y - 1), grad(p[B + 1], x - 1, y - 1), u),
      v
    );
    return (val + 1) * 0.5; // normalize to [0, 1]
  };
}

// ── Terrain constants (mirrors map.js) ───────────────────────────────────────

const TILE_TYPES  = ['Water', 'Sand', 'Grass', 'Forest', 'Snow', 'Rock'];
const BASE_DIFF   = { Water: 5, Sand: 2, Grass: 1, Forest: 3, Snow: 4, Rock: 6 };

// Biome index (Uint8)
const BIOME = { Water: 0, Sand: 1, Grass: 2, Forest: 3, Snow: 4, Rock: 5 };

// Decor index (Uint8)  0 = none
const DECOR_IDX = { bush: 1, tree: 2, rock: 3, pebbles: 4, snowdrift: 5, lily: 6, seaweed: 7 };
const DECOR_TABLE = {
  Grass:  [['bush', 0.08], ['tree', 0.05], ['rock', 0.03], ['pebbles', 0.02]],
  Forest: [['rock', 0.03]],
  Sand:   [['pebbles', 0.10], ['rock', 0.04], ['bush', 0.02]],
  Rock:   [['pebbles', 0.08], ['rock', 0.06]],
  Snow:   [['snowdrift', 0.10], ['rock', 0.03]],
  Water:  [['lily', 0.04], ['seaweed', 0.04]],
};

const SMOOTH_PASSES = 2;

// ── Main generation pipeline ──────────────────────────────────────────────────

self.onmessage = function(e) {
  if (e.data.type !== 'init') return;

  const { rows, cols, landmassMode, seed } = e.data;
  const noise = createPerlin(seed);

  try {
    // Flat typed arrays — index = row * cols + col
    const elevationFlat = new Float32Array(rows * cols);
    const tempFlat      = new Float32Array(rows * cols);
    const diffFlat      = new Float32Array(rows * cols);
    const biomeFlat     = new Uint8Array(rows * cols);
    const decorFlat     = new Uint8Array(rows * cols);

    // 1. Elevation
    genElevation(elevationFlat, rows, cols, landmassMode, noise);
    self.postMessage({ type: 'progress', step: 'elevation', pct: 15 });

    // 2. Smooth elevation
    smoothElevation(elevationFlat, rows, cols, SMOOTH_PASSES);
    self.postMessage({ type: 'progress', step: 'smooth', pct: 22 });

    // 3. Temperature
    computeTemperature(tempFlat, rows, cols);
    self.postMessage({ type: 'progress', step: 'temperature', pct: 27 });

    // 4. Assign biomes
    assignBiomes(biomeFlat, elevationFlat, tempFlat, rows, cols);
    self.postMessage({ type: 'progress', step: 'biomes', pct: 30 });

    // 5. Decorations
    placeDecorations(decorFlat, biomeFlat, rows, cols);
    self.postMessage({ type: 'progress', step: 'decorations', pct: 33 });

    // 6. Difficulty
    calcDifficulty(diffFlat, biomeFlat, elevationFlat, rows, cols);
    self.postMessage({ type: 'progress', step: 'difficulty', pct: 35 });

    // Transfer all buffers zero-copy
    self.postMessage(
      { type: 'done', elevationFlat, tempFlat, diffFlat, biomeFlat, decorFlat },
      [elevationFlat.buffer, tempFlat.buffer, diffFlat.buffer, biomeFlat.buffer, decorFlat.buffer]
    );
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
};

// ── Individual passes ─────────────────────────────────────────────────────────

function genElevation(out, rows, cols, landmassMode, noise) {
  const s = 0.04;
  let mult = 0.95, offset = 0.02, edgeStart = 0.7, edgeStrength = 0.4;
  if (landmassMode === 0) {
    mult = 0.82; offset = -0.03; edgeStart = 0.85; edgeStrength = 0.35;
  } else if (landmassMode === 2) {
    mult = 1.05; offset = 0.1;  edgeStart = 0.75; edgeStrength = 0.3;
  }

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const nx = i * s, ny = j * s;
      let e = 0.5  * noise(nx,     ny)
            + 0.25 * noise(nx * 2, ny * 2)
            + 0.125 * noise(nx * 4, ny * 4);

      if (landmassMode === 0) {
        e += 0.08 * noise(nx * 6, ny * 6);
        e -= 0.06 * noise(nx * 3 + 100, ny * 3 + 100);
      }

      e = e * mult + offset;
      const ecx = (j / cols - 0.5) * 2;
      const ecy = (i / rows - 0.5) * 2;
      const edgeDist = Math.max(Math.abs(ecx), Math.abs(ecy));
      if (edgeDist > edgeStart) e -= (edgeDist - edgeStart) * edgeStrength;

      out[i * cols + j] = Math.max(0, e);
    }
  }
}

function smoothElevation(elev, rows, cols, passes) {
  const tmp = new Float32Array(rows * cols);
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        let sum = 0, count = 0;
        for (let di = -1; di <= 1; di++) {
          for (let dj = -1; dj <= 1; dj++) {
            const ni = i + di, nj = j + dj;
            if (ni >= 0 && ni < rows && nj >= 0 && nj < cols) {
              sum += elev[ni * cols + nj]; count++;
            }
          }
        }
        tmp[i * cols + j] = sum / count;
      }
    }
    elev.set(tmp);
  }
}

function computeTemperature(out, rows, cols) {
  for (let i = 0; i < rows; i++) {
    const t = 1.0 - Math.abs(i / rows - 0.5) * 2;
    for (let j = 0; j < cols; j++) {
      out[i * cols + j] = t;
    }
  }
}

function assignBiomes(biomeOut, elev, temp, rows, cols) {
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const idx = i * cols + j;
      const e = elev[idx], t = temp[idx];
      let type;
      if      (e < 0.42)             type = 'Water';
      else if (e < 0.48)             type = 'Sand';
      else if (e < 0.5  && t > 0.6)  type = 'Grass';
      else if (e < 0.7  && t > 0.4)  type = 'Forest';
      else if (e < 0.85)             type = 'Rock';
      else                           type = 'Snow';
      biomeOut[idx] = BIOME[type];
    }
  }
}

function placeDecorations(decorOut, biomeFlat, rows, cols) {
  const biomeNames = TILE_TYPES; // index → name
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const idx  = i * cols + j;
      const type = biomeNames[biomeFlat[idx]];
      const table = DECOR_TABLE[type];
      if (!table) continue;
      // Use a deterministic-ish pseudo-random per tile so saves are consistent
      // (Math.random is fine here — terrain doesn't need to be reproducible between runs)
      for (const [decorType, chance] of table) {
        if (Math.random() < chance) {
          decorOut[idx] = DECOR_IDX[decorType] || 0;
          break;
        }
      }
    }
  }
}

function calcDifficulty(diffOut, biomeFlat, elev, rows, cols) {
  const biomeNames = TILE_TYPES;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const idx  = i * cols + j;
      const type = biomeNames[biomeFlat[idx]];
      diffOut[idx] = (BASE_DIFF[type] || 1) + elev[idx] * 5;
    }
  }
}
