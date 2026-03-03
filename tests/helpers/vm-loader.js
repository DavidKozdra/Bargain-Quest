'use strict';
/**
 * vm-loader.js
 *
 * Loads Bargain Quest game class files (which are plain browser globals, no
 * module exports) into an isolated Node.js vm context for unit testing.
 *
 * Each test creates its own context so state does not leak between tests.
 *
 * Usage:
 *   const { createGameContext, loadIntoContext, exposeGlobals } = require('./helpers/vm-loader');
 *   const ctx = createGameContext();
 *   loadIntoContext(ctx, 'classes/item.js');
 *   exposeGlobals(ctx, ['ItemLibrary', 'Item']);
 *   loadIntoContext(ctx, 'classes/Cities.js');
 *   exposeGlobals(ctx, ['City']);
 *   // ctx.City, ctx.ItemLibrary are now usable in tests
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');

/** Build a fresh in-memory localStorage mock. */
function createLocalStorageMock() {
  const store = Object.create(null);
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    clear() { Object.keys(store).forEach(k => delete store[k]); },
    _store: store,
  };
}

/**
 * Create a sandboxed vm context that mimics the game's browser globals.
 * All properties on `overrides` are merged into the context, allowing
 * per-test customisation (mock player, mock cities, etc.).
 */
function createGameContext(overrides = {}) {
  const ctx = {
    // ── JavaScript built-ins ──────────────────────────────────────────────
    console,
    Math,
    Array,
    Object,
    Map,
    Set,
    JSON,
    Date,
    Number,
    String,
    Boolean,
    RegExp,
    Error,
    Promise,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    undefined,
    NaN,
    Infinity,

    // ── p5.js stubs (rendering calls inside methods we won't exercise) ────
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    sqrt: Math.sqrt,
    abs: Math.abs,
    min: (...a) => Math.min(...a),
    max: (...a) => Math.max(...a),
    constrain: (v, lo, hi) => Math.min(Math.max(v, lo), hi),
    lerp: (a, b, t) => a + (b - a) * t,
    map: (v, a1, b1, a2, b2) => a2 + (b2 - a2) * ((v - a1) / (b1 - a1)),
    random: (...a) => {
      if (a.length === 0) return Math.random();
      if (a.length === 1) return Math.random() * a[0];
      return a[0] + Math.random() * (a[1] - a[0]);
    },
    noise: () => 0.5,
    dist: (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
    // drawing stubs — all no-ops
    color: () => '#000',
    fill: () => {}, stroke: () => {}, noStroke: () => {}, noFill: () => {},
    strokeWeight: () => {}, opacity: () => {},
    rect: () => {}, ellipse: () => {}, circle: () => {},
    line: () => {}, point: () => {}, triangle: () => {},
    text: () => {}, textSize: () => {}, textAlign: () => {},
    textWidth: () => 0, textAscent: () => 0, textDescent: () => 0,
    push: () => {}, pop: () => {}, translate: () => {}, rotate: () => {},
    scale: () => {}, resetMatrix: () => {}, applyMatrix: () => {},
    image: () => {}, imageMode: () => {}, tint: () => {}, noTint: () => {},
    loadImage: () => null,
    get: () => null, set: () => {},
    background: () => {},
    CORNER: 'CORNER', CENTER: 'CENTER', LEFT: 'LEFT', RIGHT: 'RIGHT',
    TOP: 'TOP', BOTTOM: 'BOTTOM',
    drawingContext: { roundRect: () => {}, save: () => {}, restore: () => {} },
    frameCount: 0,
    width: 1024, height: 768,

    // ── Game config globals ───────────────────────────────────────────────
    rows: 50,
    cols: 50,
    tileSize: 32,
    gameSpeedIndex: 2,
    grid: [],

    // ── window.* config values ────────────────────────────────────────────
    _mapSeed: 12345,
    _isCustomMap: false,
    _newGameGoldTarget: 5000,
    _newGameDayLimit: 0,
    _newGameLandmass: 1,
    _newGameDifficulty: 'normal',

    // ── Stub game systems (undefined → SaveSystem guards skip them) ───────
    traderManager: undefined,
    raiderManager: undefined,
    eventSystem: undefined,
    contractSystem: undefined,
    treasureSystem: undefined,
    bankingSystem: undefined,
    smugglingSystem: undefined,
    bountyBoard: undefined,
    gamblingSystem: undefined,

    // ── gameStateManager stub ─────────────────────────────────────────────
    gameStateManager: { setState: () => {} },
    GameStates: { GAMEWON: 'GAMEWON', GAMELOSE: 'GAMELOSE', PLAYING: 'PLAYING' },
    triggerGameLose: null,

    // ── localStorage mock ─────────────────────────────────────────────────
    localStorage: createLocalStorageMock(),

    ...overrides,
  };

  // window self-reference so `window._mapSeed` etc. work inside vm code
  ctx.window = ctx;

  return vm.createContext(ctx);
}

/**
 * Read a game source file and execute it inside `ctx`.
 * After this call, any `var` declarations in the file become properties of
 * ctx.  `const`/`class` declarations live in the context's lexical scope and
 * are accessible by subsequent vm.runInContext calls on the *same* context,
 * but NOT yet as ctx properties.  Call exposeGlobals() after loading to
 * surface them.
 */
function loadIntoContext(ctx, relPath) {
  const absPath = path.join(ROOT, relPath);
  const code = fs.readFileSync(absPath, 'utf8');
  try {
    vm.runInContext(code, ctx, { filename: relPath });
  } catch (e) {
    throw new Error(`vm-loader: failed to load "${relPath}": ${e.message}`);
  }
}

/**
 * Expose `const`/`class` declarations that live in the context's lexical
 * scope as explicit properties of the context object, so test code can access
 * them via `ctx.ClassName`.
 *
 * @param {vm.Context} ctx
 * @param {string[]} names  names to expose, e.g. ['City', 'ItemLibrary']
 */
function exposeGlobals(ctx, names) {
  const code = names
    .map(n => `try { if (typeof ${n} !== 'undefined') this['${n}'] = ${n}; } catch (_) {}`)
    .join('\n');
  vm.runInContext(code, ctx);
}

module.exports = { createGameContext, loadIntoContext, exposeGlobals, createLocalStorageMock };
