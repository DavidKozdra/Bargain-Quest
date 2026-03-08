// terrain.worker.js — Off-main-thread terrain generation
//
// Receives: { type: 'init', rows, cols, landmassMode, worldGenConfig, seed }
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

const BASE_DIFF_BY_BIOME = new Float32Array([5, 2, 1, 3, 4, 6]);

// Biome index (Uint8)
const BIOME = { Water: 0, Sand: 1, Grass: 2, Forest: 3, Snow: 4, Rock: 5 };

// Decor index (Uint8)  0 = none
const DECOR_IDX = { bush: 1, tree: 2, rock: 3, pebbles: 4, snowdrift: 5, lily: 6, seaweed: 7 };
const SMOOTH_PASSES = 2;

function getWorldGenConfig(rawCfg) {
  const raw = (rawCfg && typeof rawCfg === 'object') ? rawCfg : {};
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

// ── Main generation pipeline ──────────────────────────────────────────────────

self.onmessage = function(e) {
  if (e.data.type !== 'init') return;

  const { rows, cols, landmassMode, worldGenConfig, seed } = e.data;
  const noise = createPerlin(seed);
  const climateNoise = createPerlin((seed ^ 0x9E3779B9) >>> 0);
  const cfg = getWorldGenConfig(worldGenConfig);

  try {
    // Flat typed arrays — index = row * cols + col
    const elevationFlat = new Float32Array(rows * cols);
    const tempFlat      = new Float32Array(rows * cols);
    const diffFlat      = new Float32Array(rows * cols);
    const biomeFlat     = new Uint8Array(rows * cols);
    const decorFlat     = new Uint8Array(rows * cols);

    // 1. Elevation
    genElevation(elevationFlat, rows, cols, landmassMode, noise, cfg);
    self.postMessage({ type: 'progress', step: 'elevation', pct: 15 });

    // 2. Smooth elevation
    smoothElevation(elevationFlat, rows, cols, SMOOTH_PASSES);
    self.postMessage({ type: 'progress', step: 'smooth', pct: 22 });

    // 3. Temperature
    computeTemperature(tempFlat, elevationFlat, rows, cols, climateNoise, cfg);
    self.postMessage({ type: 'progress', step: 'temperature', pct: 27 });

    // 4. Assign biomes
    assignBiomes(biomeFlat, elevationFlat, tempFlat, rows, cols, climateNoise, cfg);
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

function genElevation(out, rows, cols, landmassMode, noise, cfg) {
  const s = 0.04;
  const invCols = 2 / cols;
  const invRows = 2 / rows;
  const warpScale = 0.018;
  let mult = 0.95, offset = 0.02;
  let edgeStart = 0.7, edgeStrength = 0.4;
  let macroWeight = 0.56, midWeight = 0.28, detailWeight = 0.1, ridgeWeight = 0.06;
  if (landmassMode === 0) {
    mult = 0.86; offset = -0.06; edgeStart = 0.88; edgeStrength = 0.32;
    macroWeight = 0.45; midWeight = 0.32; detailWeight = 0.15; ridgeWeight = 0.08;
  } else if (landmassMode === 2) {
    mult = 1.03; offset = 0.09; edgeStart = 0.74; edgeStrength = 0.3;
    macroWeight = 0.62; midWeight = 0.24; detailWeight = 0.09; ridgeWeight = 0.05;
  }
  const warpAmp = 1.9 * cfg.warp;
  const rugged = cfg.ruggedness;
  detailWeight *= rugged;
  ridgeWeight *= rugged;
  edgeStrength *= cfg.coastalDropoff;

  for (let i = 0; i < rows; i++) {
    const baseX = i * s;
    const ecyAbs = Math.abs(i * invRows - 1);
    const rowBase = i * cols;
    for (let j = 0; j < cols; j++) {
      const baseY = j * s;
      const wx = (noise(i * warpScale + 17.3, j * warpScale + 29.1) - 0.5) * warpAmp;
      const wy = (noise(i * warpScale + 71.2, j * warpScale + 11.7) - 0.5) * warpAmp;
      const nx = baseX + wx;
      const ny = baseY + wy;

      const macro = noise(nx * 0.45, ny * 0.45);
      const mid = noise(nx * 1.35, ny * 1.35);
      const detail = noise(nx * 2.7, ny * 2.7);
      const ridge = 1 - Math.abs(noise(nx * 1.9 + 200, ny * 1.9 + 200) * 2 - 1);
      let e = macroWeight * macro + midWeight * mid + detailWeight * detail + ridgeWeight * ridge;

      e = e * mult + offset;
      const ecxAbs = Math.abs(j * invCols - 1);
      const edgeDist = ecxAbs > ecyAbs ? ecxAbs : ecyAbs;
      if (edgeDist > edgeStart) {
        const t = (edgeDist - edgeStart) / (1 - edgeStart);
        e -= t * t * edgeStrength;
      }

      out[rowBase + j] = e > 0 ? e : 0;
    }
  }
}

function smoothElevation(elev, rows, cols, passes) {
  const tmp = new Float32Array(rows * cols);
  const sat = new Float32Array((rows + 1) * (cols + 1));
  const satCols = cols + 1;

  for (let p = 0; p < passes; p++) {
    // Summed-area table: sat[(y+1,x+1)] = sum of rectangle [0..y, 0..x]
    sat.fill(0);
    for (let y = 0; y < rows; y++) {
      let rowAcc = 0;
      const elevBase = y * cols;
      const satBase = (y + 1) * satCols;
      const satPrevBase = y * satCols;
      for (let x = 0; x < cols; x++) {
        rowAcc += elev[elevBase + x];
        sat[satBase + x + 1] = sat[satPrevBase + x + 1] + rowAcc;
      }
    }

    for (let i = 0; i < rows; i++) {
      const y0 = i > 0 ? i - 1 : 0;
      const y1 = i + 1 < rows ? i + 1 : rows - 1;
      const sy0 = y0;
      const sy1 = y1 + 1;
      const outBase = i * cols;

      for (let j = 0; j < cols; j++) {
        const x0 = j > 0 ? j - 1 : 0;
        const x1 = j + 1 < cols ? j + 1 : cols - 1;
        const sx0 = x0;
        const sx1 = x1 + 1;

        const sum =
          sat[sy1 * satCols + sx1] -
          sat[sy0 * satCols + sx1] -
          sat[sy1 * satCols + sx0] +
          sat[sy0 * satCols + sx0];

        const count = (y1 - y0 + 1) * (x1 - x0 + 1);
        tmp[outBase + j] = sum / count;
      }
    }
    elev.set(tmp);
  }
}

function computeTemperature(out, elev, rows, cols, climateNoise, cfg) {
  const climateScale = 0.012;
  const tempVar = cfg.temperatureVariance;
  for (let i = 0; i < rows; i++) {
    const latBase = 1.0 - Math.abs(i / rows - 0.5) * 2;
    const rowBase = i * cols;
    for (let j = 0; j < cols; j++) {
      const idx = rowBase + j;
      const continental = (climateNoise(i * climateScale + 500, j * climateScale + 500) - 0.5) * tempVar;
      const altitudeCold = Math.max(0, elev[idx] - 0.58) * 1.2;
      let t = latBase * 0.82 + (continental + 0.5) * 0.18 - altitudeCold;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      out[idx] = t;
    }
  }
}

function assignBiomes(biomeOut, elev, temp, rows, cols, climateNoise, cfg) {
  const moistA = 0.036;
  const moistB = 0.082;
  const moistVar = cfg.moistureVariance;
  for (let i = 0; i < rows; i++) {
    const rowBase = i * cols;
    for (let j = 0; j < cols; j++) {
      const idx = rowBase + j;
      const e = elev[idx];
      const t = temp[idx];
      const baseMoisture =
        0.66 * climateNoise(i * moistA + 900, j * moistA + 900) +
        0.34 * climateNoise(i * moistB + 1300, j * moistB + 1300);
      const moisture = Math.max(0, Math.min(1, 0.5 + (baseMoisture - 0.5) * moistVar));

      if (e < 0.41) {
        biomeOut[idx] = BIOME.Water;
      } else if (e < 0.47 || (e < 0.53 && moisture < 0.32 && t > 0.55)) {
        biomeOut[idx] = BIOME.Sand;
      } else if (e > 0.87) {
        biomeOut[idx] = t < 0.48 ? BIOME.Snow : BIOME.Rock;
      } else if (t < 0.28) {
        biomeOut[idx] = BIOME.Snow;
      } else if (e > 0.74) {
        biomeOut[idx] = BIOME.Rock;
      } else if (moisture > 0.6 && t > 0.36) {
        biomeOut[idx] = BIOME.Forest;
      } else {
        biomeOut[idx] = BIOME.Grass;
      }
    }
  }
}

function placeDecorations(decorOut, biomeFlat, rows, cols) {
  const len = rows * cols;
  for (let idx = 0; idx < len; idx++) {
    const biome = biomeFlat[idx];

    // Keep the same per-entry random-call pattern as map.js for parity.
    if (biome === BIOME.Grass) {
      if (Math.random() < 0.08) decorOut[idx] = DECOR_IDX.bush;
      else if (Math.random() < 0.05) decorOut[idx] = DECOR_IDX.tree;
      else if (Math.random() < 0.03) decorOut[idx] = DECOR_IDX.rock;
      else if (Math.random() < 0.02) decorOut[idx] = DECOR_IDX.pebbles;
    } else if (biome === BIOME.Forest) {
      if (Math.random() < 0.03) decorOut[idx] = DECOR_IDX.rock;
    } else if (biome === BIOME.Sand) {
      if (Math.random() < 0.10) decorOut[idx] = DECOR_IDX.pebbles;
      else if (Math.random() < 0.04) decorOut[idx] = DECOR_IDX.rock;
      else if (Math.random() < 0.02) decorOut[idx] = DECOR_IDX.bush;
    } else if (biome === BIOME.Rock) {
      if (Math.random() < 0.08) decorOut[idx] = DECOR_IDX.pebbles;
      else if (Math.random() < 0.06) decorOut[idx] = DECOR_IDX.rock;
    } else if (biome === BIOME.Snow) {
      if (Math.random() < 0.10) decorOut[idx] = DECOR_IDX.snowdrift;
      else if (Math.random() < 0.03) decorOut[idx] = DECOR_IDX.rock;
    } else if (biome === BIOME.Water) {
      if (Math.random() < 0.04) decorOut[idx] = DECOR_IDX.lily;
      else if (Math.random() < 0.04) decorOut[idx] = DECOR_IDX.seaweed;
    }
  }
}

function calcDifficulty(diffOut, biomeFlat, elev, rows, cols) {
  const len = rows * cols;
  for (let idx = 0; idx < len; idx++) {
    diffOut[idx] = BASE_DIFF_BY_BIOME[biomeFlat[idx]] + elev[idx] * 5;
  }
}
