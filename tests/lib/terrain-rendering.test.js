const fs = require('fs');
const path = require('path');
const vm = require('vm');

function terrainFixture({ size = 1500, width = 1920, height = 1080, zoom = 0.15, density = 1, tileCost = 0.001 } = {}) {
  let clock = 0;
  const canvases = [];
  const draws = [];
  const noop = () => {};
  const main = {
    save: noop, restore: noop, fillRect: noop,
    drawImage(canvas, x, y, w, h) { draws.push({ canvas, x, y, w, h }); },
  };
  const context = {
    window: {}, console, Math, Map, Set,
    cols: size, rows: size, tileSize: 32, width, height, camZoom: zoom,
    camX: size * 16, camY: size * 16, frameCount: 0, worldInitialized: false,
    grid: Array(size).fill(Array(size).fill({ options: ['Grass'] })),
    elevationMap: Array(size).fill(Array(size).fill(0)),
    player: null, SpriteSheet: { tiles: { Grass: { canvas: {} } } },
    performance: { now: () => clock }, pixelDensity: () => density,
    drawingContext: main,
    document: { createElement() {
      const canvas = { width: 0, height: 0 };
      const ctx = { scale: noop, save: noop, restore: noop, beginPath: noop, closePath: noop,
        moveTo: noop, lineTo: noop, stroke: noop, arc: noop, fill: noop, fillRect: noop,
        drawImage() { clock += tileCost; } };
      canvas.getContext = () => ctx;
      canvases.push(canvas);
      return canvas;
    } },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../classes/map.js'), 'utf8'), context);
  function frame(shakeX = 0, shakeY = 0) {
    context.frameCount++;
    draws.length = 0;
    context.RenderMap(shakeX, shakeY);
    return context.window.BQGetTerrainRenderStats();
  }
  function settle() {
    let stats;
    for (let i = 0; i < 2000; i++) {
      stats = frame();
      if (stats.pendingChunks === 0) return stats;
    }
    throw new Error('Visible terrain never settles: ' + JSON.stringify(stats));
  }
  return { context, frame, settle, canvases, draws };
}

describe('terrain cache rendering', () => {
  test('minimum zoom settles at 1080p and 4K without evicting visible chunks', () => {
    for (const [width, height, density] of [[1920, 1080, 1], [3840, 2160, 2]]) {
      const f = terrainFixture({ width, height, density });
      const ready = f.settle();
      expect(ready.cacheBytes).toBeLessThanOrEqual(ready.cacheLimitBytes);
      expect(ready.drawnChunks).toBe(ready.visibleChunks);
      expect(ready.rasterScale).toBeLessThan(1);
      const allocated = f.canvases.length;
      for (let i = 0; i < 60; i++) {
        const stats = f.frame();
        expect(stats.builtChunks).toBe(0);
        expect(stats.pendingChunks).toBe(0);
      }
      expect(f.canvases.length).toBe(allocated);
    }
  });

  test('raster work yields and cancels a partial job after a camera jump', () => {
    const f = terrainFixture({ zoom: 1, tileCost: 0.1 });
    const first = f.frame();
    expect(first.builtChunks).toBe(0);
    expect(first.buildMs).toBeLessThan(6.3); // 3ms deadline + at most 32 tile batch
    const partial = f.canvases[0];
    f.context.camX = 40000;
    f.context.camY = 40000;
    f.frame();
    expect(partial.width).toBe(0);
    expect(partial.height).toBe(0);
  });

  test('all cache and partial pixel storage is released on invalidation', () => {
    const f = terrainFixture();
    f.settle();
    f.context.camX += 10000;
    f.frame();
    f.context.invalidateMapBuffer();
    const stats = f.context.window.BQGetTerrainRenderStats();
    expect(stats.cachedChunks).toBe(0);
    expect(stats.cacheBytes).toBe(0);
    expect(f.canvases.every(canvas => canvas.width === 0 && canvas.height === 0)).toBe(true);
  });

  test('normal zoom excludes padded chunks and supports partial world edges', () => {
    const f = terrainFixture({ size: 70, width: 640, height: 480, zoom: 1, density: 2 });
    f.context.camX = 64 * 32;
    f.context.camY = 64 * 32;
    const ready = f.settle();
    expect(ready.visibleChunks).toBe(4);
    expect(f.draws.some(draw => draw.w === 6 * 32 && draw.h === 6 * 32)).toBe(true);
    expect(f.canvases.every(canvas => canvas.width <= 2048 && canvas.height <= 2048)).toBe(true);
  });

  test('camera shake includes newly exposed boundary chunks', () => {
    const f = terrainFixture({ width: 640, height: 480, zoom: 1 });
    f.context.camX = 2048 - 320;
    f.context.camY = 1024;
    expect(f.frame().visibleChunks).toBe(1);
    expect(f.frame(-8, 0).visibleChunks).toBe(2);
  });

});
