const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mobileInput = require('../../Koz_Engine_Lib/UI/mobileInput');

const root = path.resolve(__dirname, '../..');
const gameSource = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const mobileSource = fs.readFileSync(path.join(root, 'classes/MobileSupport.js'), 'utf8');
const minigameSource = fs.readFileSync(path.join(root, 'Koz_Engine_Lib/Minigames/minigamesRuntime.js'), 'utf8');
const PIXEL_BUDGET = 3840 * 2160;

function extractFunction(name) {
  const match = gameSource.match(new RegExp(`^function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?^\\}`, 'm'));
  assert(match, `Missing function ${name}`);
  return match[0];
}

function canvasHarness(w = 1280, h = 720, dpr = 2) {
  let viewport = { width: w, height: h };
  let density = Math.min(2, dpr, Math.sqrt(PIXEL_BUDGET / (w * h)));
  let bufferWidth = Math.floor(w * density), bufferHeight = Math.floor(h * density);
  let peakPixels = bufferWidth * bufferHeight;
  const calls = [], frames = [], listeners = new Map();
  const canvas = {
    style: {},
    addEventListener() {},
    getBoundingClientRect: () => ({ left: 15, top: 25, width: viewport.width, height: viewport.height }),
    get width() { return bufferWidth; },
    set width(value) { bufferWidth = Math.floor(value); peakPixels = Math.max(peakPixels, bufferWidth * bufferHeight); },
    get height() { return bufferHeight; },
    set height(value) { bufferHeight = Math.floor(value); peakPixels = Math.max(peakPixels, bufferWidth * bufferHeight); },
  };
  const context = vm.createContext({
    width: w, height: h, camX: 1000, camY: 2000, camZoom: 0.5, tileSize: 50,
    document: { querySelector: () => canvas },
    window: {
      devicePixelRatio: dpr,
      BQViewport: { read: () => viewport, sync: () => calls.push(['sync']) },
      addEventListener: (name, fn) => listeners.set(name, fn),
      visualViewport: { addEventListener: (name, fn) => listeners.set(`visual:${name}`, fn) },
      requestAnimationFrame(fn) { frames.push(fn); return frames.length; },
    },
    mobileSupport: { refresh: el => calls.push(['refresh', el]) },
    // Model vendored p5: pixelDensity(value) always resizes, and resize writes
    // the backing width before its height. Record intermediate allocations.
    pixelDensity(value) {
      if (value === undefined) return density;
      calls.push(['density', value]);
      density = value;
      context.resizeCanvas(context.width, context.height, true);
    },
    resizeCanvas(newWidth, newHeight, noRedraw) {
      calls.push(['resize', newWidth, newHeight, noRedraw]);
      canvas.width = newWidth * density;
      canvas.height = newHeight * density;
      context.width = newWidth;
      context.height = newHeight;
      canvas.style.width = `${newWidth}px`;
      canvas.style.height = `${newHeight}px`;
    },
    createCanvas(newWidth, newHeight) {
      calls.push(['create', newWidth, newHeight, density]);
      context.resizeCanvas(newWidth, newHeight, true);
      return { elt: canvas };
    },
    _setStartupShellStage() {}, noStroke() {}, textFont() {},
    _getEngineBridgeReady: () => ({ then: () => ({ catch() {} }) }),
    _reportRuntimeError(_label, error) { throw error; },
  });
  const helpers = ['_readAppViewportSize', '_syncCanvasCssSize', '_mainCanvasDensity', '_applyViewportResize',
    '_queueViewportResize', '_bindViewportResizeListeners', 'screenToGridTile', 'setup'];
  vm.runInContext('let _viewportResizeRaf = 0; let _viewportResizeListenersBound = false;\n'
    + helpers.map(extractFunction).join('\n'), context);
  return {
    context, canvas, calls, frames, listeners,
    setViewport(newWidth, newHeight, nextDpr = dpr) {
      viewport = { width: newWidth, height: newHeight };
      context.window.devicePixelRatio = nextDpr;
    },
    get peakPixels() { return peakPixels; },
    get density() { return density; },
  };
}

function installMobileMapper(context, withLibrary = true) {
  context._bqMobileInputLib = () => withLibrary ? mobileInput : null;
  context.window.mobileSupport = context.mobileSupport || {};
  const match = mobileSource.match(/^window\.mobileSupport\.mapClientToCanvas = function\(clientX, clientY\) \{[\s\S]*?^\};/m);
  assert(match, 'Missing mobile coordinate mapper');
  vm.runInContext(match[0], context);
  context.mobileSupport = context.window.mobileSupport;
  return context.mobileSupport;
}

function launchMinigame(h, useMobileHelper) {
  const c = h.context;
  if (useMobileHelper) installMobileMapper(c);
  else delete c.mobileSupport;
  let now = 0;
  c.performance = { now: () => now };
  c.setTimeout = () => 1;
  c.clearTimeout = () => {};
  c.window.removeEventListener = () => {};
  const match = minigameSource.match(/^class MinigameManager \{[\s\S]*?^\}/m);
  assert(match, 'Missing minigame manager');
  vm.runInContext('let GenericMinigameManagerCtor = null;\n' + match[0] + '\nthis.Manager = MinigameManager;', c);
  const manager = new c.Manager();
  manager._getBuiltins = () => ({ test: class {
    constructor() { this.clicked = 0; this.forfeited = 0; }
    start() {}
    handleClickInput() { this.clicked++; }
    _doForfeit() { this.forfeited++; }
  } });
  manager.launch('test');
  now = 250;
  return manager;
}

describe('main canvas density and resizing', () => {
  test('keeps high-DPI detail on small displays while bounding 4K and larger buffers', () => {
    const h = canvasHarness();
    for (const [w, height, dpr, expected] of [
      [1280, 720, 2, 2], [1920, 1080, 3, 2], [1280, 720, 1, 1],
      [3840, 2160, 2, 1], [7680, 4320, 2, 0.5],
      [5120, 2160, 2, Math.sqrt(0.75)],
    ]) {
      h.context.window.devicePixelRatio = dpr;
      const density = h.context._mainCanvasDensity({ width: w, height });
      assert.equal(density, expected);
      assert(w * height * density * density <= PIXEL_BUDGET + 1e-8);
    }
  });

  test('setup chooses density before first canvas allocation and retains native CSS dimensions', () => {
    const h = canvasHarness(3840, 2160, 2);
    h.context.setup();
    assert(h.calls.findIndex(call => call[0] === 'density') < h.calls.findIndex(call => call[0] === 'create'));
    assert.deepEqual(h.calls.find(call => call[0] === 'create'), ['create', 3840, 2160, 1]);
    assert.deepEqual(h.canvas.style, { width: '3840px', height: '2160px' });
    assert.equal(h.canvas.width * h.canvas.height, PIXEL_BUDGET);
  });

  test('density increases, decreases, orientation changes and fractional density never exceed the pixel budget', () => {
    const h = canvasHarness(3840, 2160, 2);
    for (const [w, height] of [[1280, 720], [3840, 2160], [2160, 3840], [3840, 2160], [5120, 2160], [2160, 5120], [7680, 4320], [720, 1280]]) {
      h.setViewport(w, height);
      h.context._applyViewportResize();
      assert.equal(h.context.width, w);
      assert.equal(h.context.height, height);
      assert.deepEqual(h.canvas.style, { width: `${w}px`, height: `${height}px` });
      assert(h.peakPixels <= PIXEL_BUDGET, `Intermediate allocation exceeded budget: ${h.peakPixels}`);
      assert.deepEqual({ ...h.context.screenToGridTile(w / 2, height / 2) }, { gridX: 20, gridY: 40 });
      assert.deepEqual({ ...h.context.screenToGridTile(w / 2 + 25, height / 2 + 25) }, { gridX: 21, gridY: 41 });
      assert.equal(h.calls[h.calls.length - 1][0], 'refresh');
    }
    assert(h.calls.filter(call => call[0] === 'resize').every(call => call[3] === true), 'Resize must not trigger a synchronous redraw');
  });

  test('same-size resize avoids density setters and backing reallocations while refreshing CSS and input', () => {
    const h = canvasHarness(3840, 2160, 2);
    h.context._applyViewportResize();
    h.context._applyViewportResize();
    assert.equal(h.calls.filter(call => call[0] === 'density' || call[0] === 'resize').length, 0);
    assert.equal(h.calls.filter(call => call[0] === 'sync').length, 2);
    assert.equal(h.calls.filter(call => call[0] === 'refresh').length, 2);
    assert.deepEqual(h.canvas.style, { width: '3840px', height: '2160px' });
  });

  test('orientation and visual viewport events coalesce to one resize using the latest dimensions', () => {
    const h = canvasHarness(2160, 3840, 2);
    h.context._bindViewportResizeListeners();
    h.context._bindViewportResizeListeners();
    assert.equal(h.listeners.size, 2);
    h.setViewport(3840, 2160);
    h.listeners.get('orientationchange')();
    h.listeners.get('visual:resize')();
    h.context._queueViewportResize();
    assert.equal(h.frames.length, 1);
    h.frames[0]();
    assert.equal(h.context.width, 3840);
    assert.equal(h.context.height, 2160);
    assert(h.peakPixels <= PIXEL_BUDGET);
    h.context._queueViewportResize();
    assert.equal(h.frames.length, 2);
    const resizeCalls = h.calls.filter(call => call[0] === 'resize').length;
    h.frames[1]();
    assert.equal(h.calls.filter(call => call[0] === 'resize').length, resizeCalls);
  });
});

describe('logical canvas input coordinates', () => {
  test('mobile mapper uses logical p5 dimensions at high, native and fractional densities with either implementation', () => {
    for (const withLibrary of [false, true]) {
      for (const [w, height] of [[1280, 720], [3840, 2160], [7680, 4320]]) {
        const h = canvasHarness(w, height, 2);
        const helper = installMobileMapper(h.context, withLibrary);
        assert.deepEqual({ ...helper.mapClientToCanvas(15 + w / 2, 25 + height / 2) }, { x: w / 2, y: height / 2 });
        // CSS may be scaled independently by the surrounding layout.
        h.canvas.getBoundingClientRect = () => ({ left: 15, top: 25, width: w / 2, height: height / 2 });
        assert.deepEqual({ ...helper.mapClientToCanvas(15 + w / 4, 25 + height / 4) }, { x: w / 2, y: height / 2 });
      }
    }
  });

  test('mobile mapper preserves backing-coordinate fallback without p5 dimensions and for non-main canvases', () => {
    for (const withLibrary of [false, true]) {
      const h = canvasHarness(1280, 720, 2);
      const helper = installMobileMapper(h.context, withLibrary);
      delete h.context.width;
      delete h.context.height;
      assert.deepEqual({ ...helper.mapClientToCanvas(655, 385) }, { x: 1280, y: 720 });
      h.context.width = 1280;
      h.context.height = 720;
      helper._canvasEl = { width: 400, height: 200,
        getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 50 }) };
      assert.deepEqual({ ...helper.mapClientToCanvas(60, 45) }, { x: 200, y: 100 });
      helper._canvasEl = null;
      h.context.document.querySelector = () => null;
      assert.deepEqual({ ...helper.mapClientToCanvas(60, 45) }, { x: 60, y: 45 });
    }
  });

  test('actual minigame quit hit-testing and global mouse input use logical coordinates at every density', () => {
    for (const useMobileHelper of [false, true]) {
      for (const [w, height] of [[1280, 720], [3840, 2160], [7680, 4320]]) {
        const h = canvasHarness(w, height, 2);
        const manager = launchMinigame(h, useMobileHelper);
        manager.active._quitBtn = { x: w / 2 - 10, y: height / 2 - 10, w: 20, h: 20 };
        manager._clickHandler({ clientX: 15 + w / 2, clientY: 25 + height / 2 });
        assert.equal(manager.active.forfeited, 1);
        assert.equal(manager.active.clicked, 0);
        manager._clickHandler({ clientX: 15 + w / 4, clientY: 25 + height / 4 });
        assert.equal(manager.active.clicked, 1);
        assert.equal(h.context.window.mouseX, w / 4);
        assert.equal(h.context.window.mouseY, height / 4);
      }
    }
  });

  test('minigame fallback keeps buffer coordinates when logical p5 dimensions are unavailable', () => {
    const h = canvasHarness(1280, 720, 2);
    delete h.context.width;
    delete h.context.height;
    const manager = launchMinigame(h, false);
    manager._clickHandler({ clientX: 655, clientY: 385 });
    assert.equal(manager.active.clicked, 1);
    assert.equal(h.context.window.mouseX, 1280);
    assert.equal(h.context.window.mouseY, 720);
  });
});

describe('screen-space particle coordinates', () => {
  const emitters = [];
  for (const [file, expectedCount] of [['game.js', 2], ['classes/player.js', 2], ['classes/Combat.js', 7]]) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const matches = [...source.matchAll(/const cvsRect = [^\n]+;[\s\S]*?particleSystem\.spawnBurst\([^\n]+;/g)];
    assert.equal(matches.length, expectedCount, `Screen emitter coverage changed in ${file}`);
    for (const match of matches) emitters.push({ file, source: match[0] });
  }

  function runEmitter(emitter, w, h, density, cssScaleX = 1, cssScaleY = 1, logicalSize = true) {
    const rect = { left: 15, top: 25, width: w * cssScaleX, height: h * cssScaleY };
    const canvas = { width: Math.floor(w * density), height: Math.floor(h * density), getBoundingClientRect: () => rect };
    const bursts = [];
    const context = vm.createContext({
      canvasEl: canvas, cvs: canvas,
      r: { left: rect.left + rect.width / 4 - 30, top: rect.top + rect.height * 3 / 4 - 10, width: 60, height: 20 },
      scale: 1, playerCritHit: false, window: { innerWidth: w, innerHeight: h },
      particleSystem: { spawnBurst: (x, y, options) => bursts.push({ x, y, options: { ...options } }) },
    });
    if (logicalSize) { context.width = w; context.height = h; }
    vm.runInContext(emitter.source, context, { filename: emitter.file });
    assert.equal(bursts.length, 1);
    const centered = emitter.source.includes('const sxCss = (cvsRect.width) / 2;');
    const expectedWidth = logicalSize ? w : rect.width;
    const expectedHeight = logicalSize ? h : rect.height;
    assert(Math.abs(bursts[0].x - expectedWidth * (centered ? 0.5 : 0.25)) < 1e-8, emitter.file);
    assert(Math.abs(bursts[0].y - expectedHeight * (centered ? 0.5 : 0.75)) < 1e-8, emitter.file);
    assert.equal(bursts[0].options.screen, true);
    return bursts[0];
  }

  test('all eleven actual screen emitters preserve HUD positions and effect settings at DPR2 and fractional density', () => {
    for (const emitter of emitters) {
      const baseline = runEmitter(emitter, 1280, 720, 1);
      for (const [w, h, density, cssScaleX, cssScaleY] of [
        [1280, 720, 2, 1, 1], [3840, 2160, 1, 1, 1], [7680, 4320, 0.5, 1, 1],
        [5120, 2160, Math.sqrt(0.75), 0.5, 0.75],
      ]) {
        const result = runEmitter(emitter, w, h, density, cssScaleX, cssScaleY);
        assert.deepEqual(result.options, baseline.options, `Effect appearance changed in ${emitter.file}`);
      }
    }
  });

  test('screen emitters use CSS coordinates when running without logical p5 dimensions', () => {
    for (const emitter of emitters) runEmitter(emitter, 1280, 720, 2, 0.5, 0.75, false);
  });
});
