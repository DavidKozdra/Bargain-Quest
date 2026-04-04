(function initWorldGeneratorsLib(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    const kozEngine = root.KozEngine = root.KozEngine || {};
    kozEngine.World = kozEngine.World || {};
    kozEngine.World.worldGenerators = api;
    if (!root.BQWorldGenerators) root.BQWorldGenerators = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createWorldGeneratorsApi() {
  const DEFAULT_WORLD_GEN_CONFIG = Object.freeze({
    warp: 1.0,
    ruggedness: 1.0,
    temperatureVariance: 1.0,
    moistureVariance: 1.0,
    coastalDropoff: 1.0,
  });

  const BIOME_NAMES = Object.freeze(["Water", "Sand", "Grass", "Forest", "Snow", "Rock"]);
  const BIOME = Object.freeze({
    Water: 0,
    Sand: 1,
    Grass: 2,
    Forest: 3,
    Snow: 4,
    Rock: 5,
  });

  function normalizeSize(value, fallback) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function clampNumber(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function normalizeLandmassMode(value, fallback) {
    const landmass = Math.floor(Number(value));
    if (landmass === 0 || landmass === 1 || landmass === 2) return landmass;
    return fallback === 0 || fallback === 1 || fallback === 2 ? fallback : 1;
  }

  function normalizeWorldGenConfig(rawCfg) {
    const raw = (rawCfg && typeof rawCfg === "object") ? rawCfg : {};
    return {
      warp: clampNumber(raw.warp, DEFAULT_WORLD_GEN_CONFIG.warp, 0, 2),
      ruggedness: clampNumber(raw.ruggedness, DEFAULT_WORLD_GEN_CONFIG.ruggedness, 0.5, 2),
      temperatureVariance: clampNumber(raw.temperatureVariance, DEFAULT_WORLD_GEN_CONFIG.temperatureVariance, 0, 2),
      moistureVariance: clampNumber(raw.moistureVariance, DEFAULT_WORLD_GEN_CONFIG.moistureVariance, 0, 2),
      coastalDropoff: clampNumber(raw.coastalDropoff, DEFAULT_WORLD_GEN_CONFIG.coastalDropoff, 0.4, 2.2),
    };
  }

  function createField(cols, rows, sample) {
    const width = normalizeSize(cols, 1);
    const height = normalizeSize(rows, 1);
    const sampler = typeof sample === "function" ? sample : function fallbackSample() { return 0; };
    const field = [];
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        row.push(Number(sampler(x, y, width, height)) || 0);
      }
      field.push(row);
    }
    return field;
  }

  function smoothField(field, passes) {
    const count = Math.max(0, Math.floor(Number(passes)) || 0);
    let current = Array.isArray(field) ? field.map(function cloneRow(row) { return row.slice(); }) : [];

    for (let pass = 0; pass < count; pass++) {
      const next = [];
      for (let y = 0; y < current.length; y++) {
        const row = [];
        for (let x = 0; x < (current[y] || []).length; x++) {
          let sum = 0;
          let seen = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ny = y + dy;
              const nx = x + dx;
              if (ny < 0 || ny >= current.length || nx < 0 || nx >= current[ny].length) continue;
              sum += Number(current[ny][nx]) || 0;
              seen++;
            }
          }
          row.push(seen > 0 ? sum / seen : 0);
        }
        next.push(row);
      }
      current = next;
    }

    return current;
  }

  function normalizeField(field) {
    let min = Infinity;
    let max = -Infinity;
    for (const row of field || []) {
      for (const value of row || []) {
        const n = Number(value) || 0;
        if (n < min) min = n;
        if (n > max) max = n;
      }
    }

    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
      return (field || []).map(function zeroRow(row) {
        return (row || []).map(function zeroCell() { return 0; });
      });
    }

    const range = max - min;
    return (field || []).map(function normalizeRow(row) {
      return (row || []).map(function normalizeCell(value) {
        return ((Number(value) || 0) - min) / range;
      });
    });
  }

  function classifyField(field, classifier) {
    const resolve = typeof classifier === "function"
      ? classifier
      : function fallbackClassifier(value) { return value; };

    return (field || []).map(function classifyRow(row, y) {
      return (row || []).map(function classifyCell(value, x) {
        return resolve(value, x, y);
      });
    });
  }

  function buildWorldCells(cols, rows, config) {
    const opts = config || {};
    const baseField = createField(cols, rows, opts.sample);
    const smoothed = smoothField(baseField, opts.smoothingPasses || 0);
    const normalized = normalizeField(smoothed);
    return classifyField(normalized, opts.classify);
  }

  function createPerlin(seed) {
    const base = new Uint8Array(256);
    for (let i = 0; i < 256; i++) base[i] = i;

    let rng = (seed >>> 0) | 1;
    function rand() {
      rng ^= rng << 13;
      rng ^= rng >>> 17;
      rng ^= rng << 5;
      return (rng >>> 0) / 4294967296;
    }

    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = base[i];
      base[i] = base[j];
      base[j] = tmp;
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
      const u = fade(x);
      const v = fade(y);
      const A = p[X] + Y;
      const B = p[X + 1] + Y;
      const val = lerp(
        lerp(grad(p[A], x, y), grad(p[B], x - 1, y), u),
        lerp(grad(p[A + 1], x, y - 1), grad(p[B + 1], x - 1, y - 1), u),
        v
      );
      return (val + 1) * 0.5;
    };
  }

  function genElevation(out, rows, cols, landmassMode, noise, cfg) {
    const s = 0.04;
    const warpScale = 0.018;
    let mult = 0.95;
    let offset = 0.02;
    let edgeStart = 0.7;
    let edgeStrength = 0.4;
    let macroWeight = 0.56;
    let midWeight = 0.28;
    let detailWeight = 0.1;
    let ridgeWeight = 0.06;

    if (landmassMode === 0) {
      mult = 0.86;
      offset = -0.06;
      edgeStart = 0.88;
      edgeStrength = 0.32;
      macroWeight = 0.45;
      midWeight = 0.32;
      detailWeight = 0.15;
      ridgeWeight = 0.08;
    } else if (landmassMode === 2) {
      mult = 1.03;
      offset = 0.09;
      edgeStart = 0.74;
      edgeStrength = 0.3;
      macroWeight = 0.62;
      midWeight = 0.24;
      detailWeight = 0.09;
      ridgeWeight = 0.05;
    }

    const warpAmp = 1.9 * cfg.warp;
    const rugged = cfg.ruggedness;
    detailWeight *= rugged;
    ridgeWeight *= rugged;
    edgeStrength *= cfg.coastalDropoff;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const baseX = y * s;
        const baseY = x * s;
        const wx = (noise(y * warpScale + 17.3, x * warpScale + 29.1) - 0.5) * warpAmp;
        const wy = (noise(y * warpScale + 71.2, x * warpScale + 11.7) - 0.5) * warpAmp;
        const nx = baseX + wx;
        const ny = baseY + wy;
        const macro = noise(nx * 0.45, ny * 0.45);
        const mid = noise(nx * 1.35, ny * 1.35);
        const detail = noise(nx * 2.7, ny * 2.7);
        const ridge = 1 - Math.abs(noise(nx * 1.9 + 200, ny * 1.9 + 200) * 2 - 1);
        let elevation = macroWeight * macro + midWeight * mid + detailWeight * detail + ridgeWeight * ridge;

        elevation = elevation * mult + offset;
        const edgeX = (x / cols - 0.5) * 2;
        const edgeY = (y / rows - 0.5) * 2;
        const edgeDist = Math.max(Math.abs(edgeX), Math.abs(edgeY));
        if (edgeDist > edgeStart) {
          const t = (edgeDist - edgeStart) / (1 - edgeStart);
          elevation -= t * t * edgeStrength;
        }

        out[y * cols + x] = Math.max(0, elevation);
      }
    }
  }

  function smoothFlatField(field, rows, cols, passes) {
    const totalPasses = Math.max(0, Math.floor(Number(passes)) || 0);
    let current = field instanceof Float32Array ? field.slice() : new Float32Array(field || []);

    for (let pass = 0; pass < totalPasses; pass++) {
      const next = new Float32Array(rows * cols);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let sum = 0;
          let count = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ny = y + dy;
              const nx = x + dx;
              if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) continue;
              sum += current[ny * cols + nx];
              count++;
            }
          }
          next[y * cols + x] = count > 0 ? sum / count : 0;
        }
      }
      current = next;
    }

    return current;
  }

  function computeTemperature(out, elevationFlat, rows, cols, climateNoise, cfg) {
    for (let y = 0; y < rows; y++) {
      const latBase = 1.0 - Math.abs(y / rows - 0.5) * 2;
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x;
        const continental = (climateNoise(y * 0.012 + 500, x * 0.012 + 500) - 0.5) * cfg.temperatureVariance;
        const altitudeCold = Math.max(0, elevationFlat[idx] - 0.58) * 1.2;
        out[idx] = Math.max(0, Math.min(1, latBase * 0.82 + (continental + 0.5) * 0.18 - altitudeCold));
      }
    }
  }

  function assignBiomes(out, elevationFlat, temperatureFlat, rows, cols, climateNoise, cfg) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x;
        const elevation = elevationFlat[idx];
        const temperature = temperatureFlat[idx];
        const baseMoisture =
          0.66 * climateNoise(y * 0.036 + 900, x * 0.036 + 900) +
          0.34 * climateNoise(y * 0.082 + 1300, x * 0.082 + 1300);
        const moisture = Math.max(0, Math.min(1, 0.5 + (baseMoisture - 0.5) * cfg.moistureVariance));

        if (elevation < 0.41) out[idx] = BIOME.Water;
        else if (elevation < 0.47 || (elevation < 0.53 && moisture < 0.32 && temperature > 0.55)) out[idx] = BIOME.Sand;
        else if (elevation > 0.87) out[idx] = temperature < 0.48 ? BIOME.Snow : BIOME.Rock;
        else if (temperature < 0.28) out[idx] = BIOME.Snow;
        else if (elevation > 0.74) out[idx] = BIOME.Rock;
        else if (moisture > 0.6 && temperature > 0.36) out[idx] = BIOME.Forest;
        else out[idx] = BIOME.Grass;
      }
    }
  }

  function buildBiomeGridFromFlat(biomeFlat, rows, cols) {
    const grid = new Array(rows);
    for (let y = 0; y < rows; y++) {
      const row = new Array(cols);
      for (let x = 0; x < cols; x++) {
        row[x] = BIOME_NAMES[biomeFlat[y * cols + x]] || BIOME_NAMES[0];
      }
      grid[y] = row;
    }
    return grid;
  }

  function generateTerrainFields(options) {
    const opts = options || {};
    const rows = normalizeSize(opts.rows, 1);
    const cols = normalizeSize(opts.cols, 1);
    const seed = (Number(opts.seed) >>> 0) || 0;
    const landmassMode = normalizeLandmassMode(opts.landmassMode, 1);
    const worldGenConfig = normalizeWorldGenConfig(opts.worldGenConfig);
    const elevationFlat = new Float32Array(rows * cols);
    const temperatureFlat = new Float32Array(rows * cols);
    const biomeFlat = new Uint8Array(rows * cols);
    const noise = createPerlin(seed);
    const climateNoise = createPerlin((seed ^ 0x9E3779B9) >>> 0);

    genElevation(elevationFlat, rows, cols, landmassMode, noise, worldGenConfig);
    const smoothedElevation = smoothFlatField(elevationFlat, rows, cols, 2);
    computeTemperature(temperatureFlat, smoothedElevation, rows, cols, climateNoise, worldGenConfig);
    assignBiomes(biomeFlat, smoothedElevation, temperatureFlat, rows, cols, climateNoise, worldGenConfig);

    return {
      rows: rows,
      cols: cols,
      seed: seed,
      landmassMode: landmassMode,
      worldGenConfig: worldGenConfig,
      elevationFlat: smoothedElevation,
      tempFlat: temperatureFlat,
      biomeFlat: biomeFlat,
    };
  }

  function generateBiomeGrid(options) {
    const terrain = generateTerrainFields(options);
    return buildBiomeGridFromFlat(terrain.biomeFlat, terrain.rows, terrain.cols);
  }

  return {
    BIOME: BIOME,
    BIOME_NAMES: BIOME_NAMES,
    DEFAULT_WORLD_GEN_CONFIG: DEFAULT_WORLD_GEN_CONFIG,
    createField: createField,
    smoothField: smoothField,
    normalizeField: normalizeField,
    classifyField: classifyField,
    buildWorldCells: buildWorldCells,
    normalizeSize: normalizeSize,
    normalizeLandmassMode: normalizeLandmassMode,
    normalizeWorldGenConfig: normalizeWorldGenConfig,
    createPerlin: createPerlin,
    smoothFlatField: smoothFlatField,
    generateTerrainFields: generateTerrainFields,
    buildBiomeGridFromFlat: buildBiomeGridFromFlat,
    generateBiomeGrid: generateBiomeGrid,
  };
});
