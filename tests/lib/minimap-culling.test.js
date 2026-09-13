const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { SpatialGrid } = require('../../Koz_Engine_Lib/Core/spatialGrid');

const source = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf8');

function drawingContext() {
  const draws = [];
  let fillColor = [];
  const noop = () => {};
  const context = {
    draws, window: {}, player: { x: 500, y: 500, ownedCities: [0] },
    width: 1280, height: 720, tileSize: 32, rows: 1500, cols: 1500,
    _minimapRegionalRadius: 60, _regionBuf: {}, _regionBufCenterX: 500, _regionBufCenterY: 500,
    minimapGraphics: {}, CENTER: 'center', BOTTOM: 'bottom', frameCount: 1,
    image: noop, noStroke: noop, noFill() { fillColor = []; }, stroke: noop, strokeWeight: noop,
    textAlign: noop, textSize: noop, push: noop, pop: noop, translate: noop,
    drawingContext: { setLineDash: noop },
    fill(...args) { fillColor = args; },
  };
  for (const shape of ['ellipse', 'rect', 'text', 'triangle', 'line']) {
    context[shape] = (...args) => draws.push({ shape, args, color: fillColor.slice() });
  }
  vm.createContext(context);
  return context;
}

function minimapContext() {
  const c = drawingContext();
  c.cities = [
    { cityIndex: 0, name: 'Border', location: { x: 439, y: 500 } },
    { cityIndex: 1, name: 'Local', location: { x: 500, y: 500 } },
    { cityIndex: 2, name: 'Outside', location: { x: 562, y: 500 } },
    { cityIndex: 3, name: 'Distant origin', location: { x: 100, y: 100 }, management: { units: [
      { x: 500, y: 505, hp: 10 },
      { x: 760, y: 500, hp: 10 },
      { x: 761, y: 500, hp: 10 },
      { x: 500, y: 506, hp: 0 },
    ] } },
  ];
  c.window.cities = c.cities;
  c.player.ownsCity = city => c.player.ownedCities.includes(c.cities.indexOf(city));
  c.traderManager = { traders: [
    { x: 440, y: 500 }, { x: 559, y: 500 }, { x: 560, y: 500 },
    { x: 700, y: 500 }, { x: 701, y: 500 }, { x: 650, y: 650 },
    { x: 500, y: 501, state: 'dead' },
  ] };
  c.raiderManager = { raiders: [
    { x: 500, y: 440 }, { x: 500, y: 559 }, { x: 500, y: 560 },
    { x: 500, y: 700 }, { x: 500, y: 701 }, { x: 350, y: 350 },
    { x: 500, y: 502, state: 'defeated' },
  ] };
  vm.runInContext(source.slice(source.indexOf('function _iterMinimapUnits(')), c);
  return c;
}

function indexEntities(context) {
  const queries = {};
  for (const [name, list] of [
    ['cityGrid', context.cities],
    ['traderGrid', context.traderManager.traders],
    ['raiderGrid', context.raiderManager.raiders],
  ]) {
    const grid = new SpatialGrid(32);
    for (const entity of list) grid.insert(entity, entity.location?.x ?? entity.x, entity.location?.y ?? entity.y);
    const query = grid.queryViewport.bind(grid);
    grid.queryViewport = bounds => { queries[name] = { ...bounds }; return query(bounds); };
    context[name] = grid;
  }
  return queries;
}

function sortedDraws(draws) {
  return draws.map(draw => JSON.stringify(draw)).sort();
}

describe('minimap spatial rendering', () => {
  test('regional queries match full-array rendering and retain wandering units from distant cities', () => {
    const fallback = minimapContext();
    fallback._renderMinimapRegional(0, 0, 200);
    const indexed = minimapContext();
    const queries = indexEntities(indexed);
    Object.defineProperty(indexed.traderManager, 'traders', { get() { throw new Error('Full trader scan'); } });
    Object.defineProperty(indexed.raiderManager, 'raiders', { get() { throw new Error('Full raider scan'); } });
    indexed._renderMinimapRegional(0, 0, 200);
    assert.deepEqual(sortedDraws(indexed.draws), sortedDraws(fallback.draws));
    assert.deepEqual(queries.cityGrid, { minX: 439, minY: 439, maxX: 561, maxY: 561, tileSize: 1 });
    assert.deepEqual(queries.traderGrid, { minX: 440, minY: 440, maxX: 560, maxY: 560, tileSize: 1 });
    assert.deepEqual(queries.raiderGrid, queries.traderGrid);
    assert(indexed.draws.some(draw => draw.shape === 'text' && draw.args[0] === 'Border'));
    assert(!indexed.draws.some(draw => draw.shape === 'text' && draw.args[0] === 'Outside'));
    assert.equal(indexed.draws.filter(draw => draw.shape === 'ellipse' && draw.color[0] === 255 && draw.color[1] === 145).length, 1);
  });

  test('world queries preserve inclusive Manhattan radius 200 and unit radius 260', () => {
    const fallback = minimapContext();
    fallback._renderMinimapWorld(0, 0, 200);
    const indexed = minimapContext();
    const queries = indexEntities(indexed);
    indexed._renderMinimapWorld(0, 0, 200);
    assert.deepEqual(sortedDraws(indexed.draws), sortedDraws(fallback.draws));
    assert.deepEqual(queries.traderGrid, { minX: 300, minY: 300, maxX: 700, maxY: 700, tileSize: 1 });
    assert.deepEqual(queries.raiderGrid, queries.traderGrid);
    const traderDots = indexed.draws.filter(draw => draw.shape === 'ellipse' && draw.color[0] === 100);
    assert.equal(traderDots.length, 4);
    assert.equal(indexed.draws.filter(draw => draw.shape === 'ellipse' && draw.color[0] === 255 && draw.color[1] === 145).length, 2);
  });

  test('ownership validates indexed references, falls back for stale indexes and excludes other worlds', () => {
    const c = minimapContext();
    let fallbackCalls = 0;
    c.player.ownsCity = city => { fallbackCalls++; return c.cities.indexOf(city) === 0; };
    assert.equal(c._minimapUnitStyle(c.cities[0], new Set([0])).isOwned, true);
    assert.equal(fallbackCalls, 0);
    c.cities[0].cityIndex = 1;
    assert.equal(c._minimapUnitStyle(c.cities[0], new Set([0])).isOwned, true);
    assert.equal(fallbackCalls, 1);
    c.window.BQGetWorldSession = () => ({ key: 'planet:mars' });
    assert.equal(c._minimapUnitStyle(c.cities[0], new Set([0])).isOwned, false);
    assert.equal(fallbackCalls, 1);
  });
});

describe('city management overlay culling', () => {
  test('offscreen origins retain crossing trade and invasion routes while unrelated markers are culled', () => {
    const c = drawingContext();
    c.isOnScreen = (x, y) => x >= 320 && x <= 640 && y >= 256 && y <= 384;
    c.isWorldSegmentOnScreen = (ax, ay, bx, by) => Math.max(ax, bx) >= 320
      && Math.min(ax, bx) <= 640 && Math.max(ay, by) >= 256 && Math.min(ay, by) <= 384;
    c.cities = [
      { location: { x: 0, y: 10 }, management: { routes: [{ destIndex: 1 }] } },
      { location: { x: 30, y: 10 } },
      { location: { x: 0, y: 40 }, management: { routes: [{ destIndex: 3 }] } },
      { location: { x: 30, y: 40 } },
    ];
    c.cityManagement = {
      myCity: c.cities[1],
      getActiveCampaigns: () => [
        { sourceIndex: 0, targetIndex: 1, startedDay: 1, travelDays: 2 },
        { sourceIndex: 2, targetIndex: 3, startedDay: 1, travelDays: 2 },
      ],
      getIncomingInvasions: () => [
        { attackerIndex: 0, targetIndex: 1, announcedDay: 1, arrivalDay: 3 },
        { attackerIndex: 2, targetIndex: 3, announcedDay: 1, arrivalDay: 3 },
      ],
    };
    c.dayNight = { getDaysElapsed: () => 2, timeOfDay: 0 };
    vm.runInContext(source.slice(source.indexOf('function renderCityManagementOverlays()'), source.indexOf('function handleMovement()')), c);
    c.renderCityManagementOverlays();
    const lines = c.draws.filter(draw => draw.shape === 'line');
    assert.equal(lines.length, 3);
    for (const route of lines) assert.deepEqual(route.args, [16, 336, 976, 336]);
    const markers = c.draws.filter(draw => draw.shape === 'ellipse');
    assert.equal(markers.length, 3);
    for (const marker of markers) assert.deepEqual(marker.args.slice(0, 2), [496, 336]);
    assert.equal(c.draws.filter(draw => draw.shape === 'triangle').length, 0);
  });
});
