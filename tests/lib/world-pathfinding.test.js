const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createPathfindingScheduler } = require('../../Koz_Engine_Lib/AI/pathfindingScheduler');
const { createPathSearch } = require('../../Koz_Engine_Lib/AI/astar');
const { createWorldConnectivity } = require('../../Koz_Engine_Lib/AI/worldConnectivity');

const root = path.resolve(__dirname, '../..');
const gameSource = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

function extractFunction(source, name, indent = '') {
  const match = source.match(new RegExp(`^${indent}function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?^${indent}\\}`, 'm'));
  assert(match, `Missing function ${name}`);
  return match[0];
}

function makeWorld(rows = 8, cols = 12) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ options: ['Grass'] })));
}

function harness(options = {}) {
  let schedulerCreations = 0;
  const dispatched = [];
  const searches = [];
  const indexes = [];
  const context = vm.createContext({
    window: {}, grid: makeWorld(), elevationMap: Array.from({ length: 8 }, () => Array(12).fill(0)),
    baseDiff: { Grass: 1 }, cityLocationMap: new Map(), cities: [], portCityLocations: [],
    createWorldConnectivity(...args) {
      const index = options.createConnectivity ? options.createConnectivity(...args) : {
        done: true, processedWork: 0, cancelled: false,
        canReach: () => true,
        step() { throw new Error('Completed index should not step'); },
        cancel() { this.cancelled = true; },
        getStats() { return { done: this.done, processedWork: this.processedWork }; },
      };
      indexes.push(index);
      return index;
    },
    createPathSearch(...args) {
      dispatched.push(args);
      const search = createPathSearch(...args);
      searches.push(search);
      return search;
    },
    createPathfindingScheduler(schedulerOptions) {
      schedulerCreations++;
      return createPathfindingScheduler({ ...schedulerOptions, now: () => 0,
        stepSize: options.stepSize || 4, maxStepsPerTick: options.maxWork || 4 });
    },
  });
  const start = gameSource.indexOf('let _worldPathScheduler = null;');
  const end = gameSource.indexOf('const CYCLEVALUE', start);
  assert(start >= 0 && end > start, 'Missing world pathfinding integration block');
  vm.runInContext(gameSource.slice(start, end), context);
  return { context, dispatched, searches, indexes, get schedulerCreations() { return schedulerCreations; } };
}

function request(context, complete = () => {}, extra = {}) {
  return context.requestWorldPath({ start: { x: 0, y: 0 }, goal: { x: 11, y: 7 }, ...extra }, complete);
}

function finish(context) {
  let frames = 0;
  while (context.window.BQGetPathfindingStats().pending) {
    context.pumpWorldPaths();
    assert(++frames < 10000, 'World route failed to finish');
  }
}

describe('world pathfinding integration', () => {
  test('scheduler and search buffers remain lazy until requests and pumps respectively', () => {
    const h = harness();
    assert.equal(h.context.window.BQGetPathfindingStats().pending, 0);
    h.context.pumpWorldPaths();
    h.context.cancelWorldPaths();
    assert.equal(h.schedulerCreations, 0);
    const handle = request(h.context);
    assert.equal(h.schedulerCreations, 1);
    assert.equal(h.dispatched.length, 0);
    assert.equal(h.indexes.length, 0);
    assert.equal(handle.status, 'pending');
    h.context.pumpWorldPaths();
    assert.equal(h.dispatched.length, 1);
    assert.equal(h.indexes.length, 1);
    assert.equal(h.searches[0].processedWork, 4);
    assert.equal(handle.status, 'pending');
    finish(h.context);
    assert.equal(handle.status, 'completed');
    assert.equal(h.searches[0].allocatedCells, 0);
    assert.equal(h.indexes[0].cancelled, false);
  });

  test('queued routes capture world cost references, coordinates and traversal permissions', () => {
    const h = harness(), c = h.context;
    const originalGrid = c.grid, originalElevation = c.elevationMap, originalCosts = c.baseDiff;
    const start = { x: 0, y: 0 }, goal = { x: 11, y: 7 }, ports = [{ x: 1, y: 1 }];
    let route;
    request(c, result => { route = result; }, { start, goal, allowWater: true, portCities: ports, waterOnly: false });
    start.x = 8; goal.y = 2;
    c.elevationMap = [[100]];
    c.baseDiff = { Grass: 20 };
    c.pumpWorldPaths();
    const args = h.dispatched[0];
    assert.equal(args[0], originalGrid);
    assert.deepEqual({ ...args[1] }, { x: 0, y: 0 });
    assert.deepEqual({ ...args[2] }, { x: 11, y: 7 });
    assert.equal(args[3], true);
    assert.equal(args[4], ports);
    assert.equal(args[5], false);
    assert.equal(args[6].elevationMap, originalElevation);
    assert.equal(args[6].baseDiff, originalCosts);
    finish(c);
    assert.deepEqual(route[route.length - 1], { x: 11, y: 7 });
  });

  test('requesting a new world cancels both active and queued old-world searches', () => {
    const h = harness(), c = h.context;
    let obsoleteCallbacks = 0, newCallbacks = 0;
    const active = request(c, () => obsoleteCallbacks++);
    const queued = request(c, () => obsoleteCallbacks++);
    c.pumpWorldPaths();
    assert(h.searches[0].allocatedCells > 0);
    c.grid = makeWorld();
    const current = request(c, () => newCallbacks++);
    assert.equal(active.status, 'cancelled');
    assert.equal(queued.status, 'cancelled');
    assert.equal(h.searches[0].cancelled, true);
    assert.equal(h.indexes[0].cancelled, true);
    assert.equal(h.searches[0].allocatedCells, 0);
    assert.equal(h.dispatched.length, 1);
    finish(c);
    assert.equal(current.status, 'completed');
    assert.equal(obsoleteCallbacks, 0);
    assert.equal(newCallbacks, 1);
    assert.equal(h.dispatched[1][0], c.grid);
  });

  test('the next pump cancels changed-world work even without another request', () => {
    const h = harness(), c = h.context;
    let callbacks = 0;
    const handle = request(c, () => callbacks++);
    c.pumpWorldPaths();
    c.grid = makeWorld();
    c.pumpWorldPaths();
    assert.equal(handle.status, 'cancelled');
    assert.equal(h.searches[0].allocatedCells, 0);
    assert.equal(c.window.BQGetPathfindingStats().pending, 0);
    assert.equal(callbacks, 0);
  });

  test('city topology rebuild cancels routes before publishing relocation and market indexes', () => {
    const h = harness(), c = h.context;
    const handle = request(c);
    c.pumpWorldPaths();
    c.cities = [{ location: { x: 2, y: 3 } }];
    let indexedCities = null;
    c.City = { rebuildRegionalMarketIndex(cities) {
      assert.equal(handle.status, 'cancelled');
      indexedCities = cities;
    } };
    vm.runInContext(extractFunction(gameSource, 'buildCityLocationMap'), c);
    c.buildCityLocationMap();
    assert.equal(handle.status, 'cancelled');
    assert.equal(h.searches[0].allocatedCells, 0);
    assert.equal(indexedCities, c.cities);
    assert.equal(c.cities[0].cityIndex, 0);
    assert.equal(c.cityLocationMap.get('2,3'), c.cities[0]);
    const next = request(c);
    c.cities[0].location = { x: 3, y: 4 };
    c.buildCityLocationMap();
    assert.equal(next.status, 'cancelled');
    assert.equal(c.cityLocationMap.has('2,3'), false);
    assert.equal(c.cityLocationMap.get('3,4'), c.cities[0]);
  });

  test('world teardown and runtime cleanup cancel work before destroying entity systems', () => {
    for (const cleanup of ['_destroyLiveWorldSystems', '_cleanupRuntimeSystems']) {
      const h = harness(), c = h.context;
      const handle = request(c);
      c.pumpWorldPaths();
      for (const key of ['cityManagement', 'player', 'traderManager', 'raiderManager', 'eventSystem',
        'contractSystem', 'bankingSystem', 'bountyBoard', 'minigameManager', 'questSystem',
        'achievementSystem', 'bearEmpireSystem']) c[key] = null;
      let destroyed = false;
      c.traderManager = { destroy() { assert.equal(handle.status, 'cancelled'); destroyed = true; } };
      c._syncBearEmpireGlobals = () => {};
      vm.runInContext(extractFunction(gameSource, '_destroyWorldSystemInstance') + '\n' + extractFunction(gameSource, cleanup), c);
      c[cleanup]();
      assert.equal(destroyed, true);
      assert.equal(handle.status, 'cancelled');
      assert.equal(h.searches[0].allocatedCells, 0);
    }
  });

  test('custom unit search factories pass through the world wrapper without invoking weighted A*', () => {
    const h = harness(), c = h.context;
    const expected = [{ x: 1, y: 0 }];
    let factoryCalls = 0, received;
    request(c, path => { received = path; }, {
      priority: 'player',
      createSearch(world, start, goal, water, ports, waterOnly, costs) {
        factoryCalls++;
        assert.equal(world, c.grid);
        assert.equal(costs.elevationMap, c.elevationMap);
        return { done: true, result: expected, step() { throw new Error('Completed factory should not step'); } };
      },
    });
    assert.equal(factoryCalls, 0);
    c.pumpWorldPaths();
    assert.equal(factoryCalls, 1);
    assert.equal(h.dispatched.length, 0);
    assert.equal(h.indexes.length, 0);
    assert.equal(received, expected);
  });

  test('connectivity and A* share a step allowance without double spending it', () => {
    const h = harness({ createConnectivity() {
      return {
        done: false, processedWork: 0,
        step(allowance) {
          this.processedWork += Math.min(allowance, 7 - this.processedWork);
          this.done = this.processedWork === 7;
          return this.done;
        },
        canReach: () => true,
        cancel() {},
        getStats() { return { done: this.done, processedWork: this.processedWork }; },
      };
    } });
    request(h.context);
    assert.equal(h.indexes.length, 0);
    h.context.pumpWorldPaths();
    assert.equal(h.indexes[0].processedWork, 4);
    assert.equal(h.dispatched.length, 0);
    h.context.pumpWorldPaths();
    assert.equal(h.indexes[0].processedWork, 7);
    assert.equal(h.dispatched.length, 1);
    assert.equal(h.searches[0].processedWork, 1);
    finish(h.context);
  });

  test('invalid, same-tile and forbidden-terrain goals bypass the shared index', () => {
    const h = harness({ createConnectivity() { throw new Error('Trivial route built a world index'); } });
    h.context.grid[7][11].options = ['Water'];
    const cases = [
      { start: { x: -1, y: 0 } },
      { goal: { x: 99, y: 0 } },
      { goal: { x: 0, y: 0 } },
      {},
      { goal: { x: 1, y: 0 }, allowWater: true, waterOnly: true },
    ];
    for (const options of cases) {
      let result;
      const handle = request(h.context, path => { result = path; }, options);
      finish(h.context);
      assert.equal(handle.status, 'completed');
      assert.equal(result.length, 0);
    }
    assert.equal(h.indexes.length, 0);
    assert(h.searches.every(search => search.allocatedCells === 0 && search.processedWork === 0));
  });

  test('one shared index rejects an unreachable head route and releases reachable followers', () => {
    const h = harness({ createConnectivity: createWorldConnectivity, maxWork: 64, stepSize: 16 });
    const c = h.context;
    c.grid = makeWorld(20, 30);
    c.elevationMap = Array.from({ length: 20 }, () => Array(30).fill(0));
    for (const row of c.grid) row[15].options = ['Water'];
    const originalElevation = c.elevationMap, originalCosts = c.baseDiff;
    const completed = [];
    const impossible = request(c, path => { completed.push(['impossible', path]); }, {
      goal: { x: 29, y: 19 }, priority: 'background',
    });
    const follower = request(c, path => { completed.push(['follower', path]); }, {
      goal: { x: 1, y: 0 }, priority: 'background',
    });
    const playerRoute = request(c, path => { completed.push(['player', path]); }, {
      goal: { x: 2, y: 0 }, priority: 'player',
    });
    c.elevationMap = [[100]];
    c.baseDiff = { Grass: 20 };
    assert.equal(h.indexes.length, 0);
    c.pumpWorldPaths();
    assert.equal(h.indexes.length, 1);
    assert.equal(h.dispatched.length, 1, 'Short player route can start during index construction');
    let frames = 0;
    while (!h.indexes[0].done) {
      const before = h.indexes[0].processedWork;
      const searchBefore = h.searches.reduce((sum, search) => sum + search.processedWork, 0);
      c.pumpWorldPaths();
      const searchAfter = h.searches.reduce((sum, search) => sum + search.processedWork, 0);
      assert(h.indexes[0].processedWork - before + searchAfter - searchBefore <= 64);
      assert(++frames < 1000, 'Shared connectivity failed to converge');
      if (!h.indexes[0].done) assert.equal(h.dispatched.length, 1);
    }
    finish(c);
    assert.equal(impossible.status, 'completed');
    assert.equal(follower.status, 'completed');
    assert.equal(playerRoute.status, 'completed');
    assert.equal(completed.find(([name]) => name === 'impossible')[1].length, 0);
    assert.equal(completed.find(([name]) => name === 'follower')[1].length, 1);
    assert.equal(completed.find(([name]) => name === 'player')[1].length, 2);
    assert.equal(h.dispatched.length, 2, 'Impossible route must never instantiate A*');
    for (const args of h.dispatched) {
      assert.equal(args[6].elevationMap, originalElevation);
      assert.equal(args[6].baseDiff, originalCosts);
    }
    c.elevationMap = originalElevation;
    request(c, () => {}, { start: { x: 20, y: 0 }, goal: { x: 21, y: 0 } });
    finish(c);
    assert.equal(h.indexes.length, 1, 'Completed index must be reused by later routes');
    assert.equal(c.window.BQGetPathfindingStats().connectivity.processedWork, h.indexes[0].processedWork);
  });

  test('cold local player routes finish before connectivity and match standard A* exactly', () => {
    const h = harness({ createConnectivity: createWorldConnectivity, maxWork: 64, stepSize: 16 });
    const c = h.context;
    c.grid = makeWorld(60, 60);
    c.elevationMap = Array.from({ length: 60 }, () => Array(60).fill(0));
    for (const row of c.grid) row[30].options = ['Water'];
    const background = request(c, () => {}, { goal: { x: 59, y: 59 } });
    const goal = { x: 5, y: 4 };
    const expected = createPathSearch(c.grid, { x: 0, y: 0 }, goal, false, null, false,
      { elevationMap: c.elevationMap, baseDiff: c.baseDiff });
    expected.step(Infinity);
    let received;
    const local = request(c, path => { received = path; }, { priority: 'player', goal });
    let frames = 0;
    while (local.status === 'pending') {
      c.pumpWorldPaths();
      assert(++frames < 20, 'Local player route waited for the world index');
    }
    assert.deepEqual(received, expected.result);
    assert.equal(h.indexes[0].done, false);
    assert.equal(background.status, 'pending');
    assert.equal(h.dispatched.length, 1);
    c.cancelWorldPaths();

    const isolated = harness({ createConnectivity: createWorldConnectivity });
    request(isolated.context, () => {}, { priority: 'player', goal: { x: 1, y: 0 } });
    finish(isolated.context);
    assert.equal(isolated.indexes.length, 0, 'A lone short player route needs no index allocation');
  });

  test('long impossible player routes cap the optimistic prefix and free it after rejection', () => {
    const h = harness({ createConnectivity: createWorldConnectivity, maxWork: 96, stepSize: 96 });
    const c = h.context;
    c.grid = makeWorld(80, 80);
    c.elevationMap = Array.from({ length: 80 }, () => Array(80).fill(0));
    for (const row of c.grid) row[40].options = ['Water'];
    let received;
    const handle = request(c, path => { received = path; }, { priority: 'player', goal: { x: 79, y: 79 } });
    for (let frame = 0; frame < 21; frame++) c.pumpWorldPaths();
    assert.equal(h.searches[0].processedWork, 2016);
    assert.equal(h.indexes.length, 0);
    c.pumpWorldPaths();
    assert.equal(h.searches[0].processedWork, 2048);
    assert.equal(h.indexes[0].processedWork, 64, '32 prefix steps leave exactly64 index steps');
    let frames = 0;
    while (handle.status === 'pending') {
      const before = h.searches[0].processedWork + h.indexes[0].processedWork;
      c.pumpWorldPaths();
      assert(h.searches[0].processedWork + h.indexes[0].processedWork - before <= 96);
      assert.equal(h.searches[0].processedWork, 2048, 'Blocked prefix must not resume before reachability');
      assert(++frames < 1000);
    }
    assert.equal(received.length, 0);
    assert.equal(h.dispatched.length, 1);
    assert.equal(h.searches[0].cancelled, true);
    assert.equal(h.searches[0].allocatedCells, 0);
    assert.equal(h.indexes[0].done, true);
  });

  test('a long reachable player route resumes its original prefix and preserves the exact path', () => {
    const h = harness({ createConnectivity: createWorldConnectivity, maxWork: 96, stepSize: 96 });
    const c = h.context;
    c.grid = makeWorld(80, 80);
    c.elevationMap = Array.from({ length: 80 }, () => Array(80).fill(0));
    for (let y = 0; y < 79; y++) c.grid[y][40].options = ['Water'];
    const goal = { x: 60, y: 0 };
    const expected = createPathSearch(c.grid, { x: 0, y: 0 }, goal, false, null, false,
      { elevationMap: c.elevationMap, baseDiff: c.baseDiff });
    expected.step(Infinity);
    assert(expected.processedWork > 2048);
    let received;
    const handle = request(c, path => { received = path; }, { priority: 'player', goal });
    let frames = 0, observedWaiting = false;
    while (handle.status === 'pending') {
      const before = (h.searches[0]?.processedWork || 0) + (h.indexes[0]?.processedWork || 0);
      c.pumpWorldPaths();
      const after = h.searches[0].processedWork + (h.indexes[0]?.processedWork || 0);
      assert(after - before <= 96);
      if (h.indexes[0] && !h.indexes[0].done) {
        observedWaiting = true;
        assert.equal(h.searches[0].processedWork, 2048);
      }
      assert(++frames < 1000);
    }
    assert.equal(observedWaiting, true);
    assert.equal(h.dispatched.length, 1, 'Reachable prefix must resume, not restart');
    assert.deepEqual(received, expected.result);
    assert.equal(h.searches[0].processedWork, expected.processedWork);
  });

  test('warm impossible player routes reject without allocating an optimistic A* search', () => {
    const h = harness({ createConnectivity: createWorldConnectivity, maxWork: 64 });
    const c = h.context;
    for (const row of c.grid) row[6].options = ['Water'];
    request(c);
    finish(c);
    assert.equal(h.indexes[0].done, true);
    assert.equal(h.dispatched.length, 0);
    let received;
    request(c, path => { received = path; }, { priority: 'player' });
    finish(c);
    assert.equal(received.length, 0);
    assert.equal(h.dispatched.length, 0);
    assert.equal(h.indexes.length, 1);
  });

  test('player cancellation and world changes release unfinished optimistic prefixes', () => {
    for (const cancellation of ['request', 'world']) {
      const h = harness({ createConnectivity: createWorldConnectivity });
      const c = h.context;
      let callbacks = 0;
      const handle = request(c, () => callbacks++, { priority: 'player' });
      c.pumpWorldPaths();
      assert(h.searches[0].allocatedCells > 0);
      assert.equal(h.indexes.length, 0);
      if (cancellation === 'request') handle.cancel();
      else { c.grid = makeWorld(); c.pumpWorldPaths(); }
      assert.equal(handle.status, 'cancelled');
      assert.equal(h.searches[0].cancelled, true);
      assert.equal(h.searches[0].allocatedCells, 0);
      assert.equal(callbacks, 0);
    }
  });

  test('cancelling one request preserves shared progress but world and port changes release it', () => {
    const h = harness({ createConnectivity: createWorldConnectivity });
    const c = h.context;
    const first = request(c);
    c.pumpWorldPaths();
    const firstIndex = h.indexes[0];
    first.cancel();
    request(c);
    c.pumpWorldPaths();
    assert.equal(h.indexes.length, 1);
    assert.equal(firstIndex.getStats().cancelled, false);
    assert.equal(firstIndex.processedWork, 8);
    c.portCityLocations = [{ x: 1, y: 0 }];
    const next = request(c);
    assert.equal(firstIndex.getStats().cancelled, true);
    assert.equal(c.window.BQGetPathfindingStats().connectivity, null);
    c.pumpWorldPaths();
    assert.equal(h.indexes.length, 2);
    c.portCityLocations.push({ x: 4, y: 0 });
    c.pumpWorldPaths();
    assert.equal(next.status, 'cancelled');
    assert.equal(h.indexes[1].getStats().cancelled, true);
    request(c);
    c.pumpWorldPaths();
    c.grid = makeWorld();
    c.pumpWorldPaths();
    assert.equal(h.indexes[2].getStats().cancelled, true);
    assert.equal(c.window.BQGetPathfindingStats().connectivity, null);
  });

  test('game bootstrap, global bridge and offline shell all include pathfinding APIs', () => {
    const astarPath = 'Koz_Engine_Lib/AI/astar.js';
    const connectivityPath = 'Koz_Engine_Lib/AI/worldConnectivity.js';
    const schedulerPath = 'Koz_Engine_Lib/AI/pathfindingScheduler.js';
    const bootstrap = vm.createContext({ _ensureEngineModules: paths => Array.from(paths) });
    const moduleStart = gameSource.indexOf('const ENGINE_MODULES = Object.freeze({');
    const moduleEnd = gameSource.indexOf('\n});', moduleStart) + 4;
    assert(moduleStart >= 0 && moduleEnd > moduleStart);
    vm.runInContext(gameSource.slice(moduleStart, moduleEnd) + '\n' + extractFunction(gameSource, '_ensureGameplayEngineModules'), bootstrap);
    const required = bootstrap._ensureGameplayEngineModules();
    assert(required.includes(astarPath));
    assert(required.includes(connectivityPath));
    assert(required.includes(schedulerPath));

    const loaded = [];
    const bridge = vm.createContext({
      window: { document: {}, setTimeout() {} },
      XMLHttpRequest: class LocalModuleRequest {
        open(method, requestPath) { this.path = requestPath; }
        send() {
          loaded.push(this.path);
          this.responseText = fs.readFileSync(path.join(root, this.path), 'utf8');
          this.status = 200;
        }
      },
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'Koz_Engine_Lib/Core/koz-engine.global.js'), 'utf8'), bridge);
    const apis = bridge.window.BQEnsureEngineModules([astarPath, connectivityPath, schedulerPath]);
    assert.deepEqual(loaded, [astarPath, connectivityPath, schedulerPath]);
    assert.equal(bridge.window.createPathSearch, apis[0].createPathSearch);
    assert.equal(bridge.window.createWorldConnectivity, apis[1].createWorldConnectivity);
    assert.equal(bridge.window.KozEngine.AI.worldConnectivity, apis[1]);
    assert.equal(bridge.window.createPathfindingScheduler, apis[2].createPathfindingScheduler);
    assert.equal(bridge.window.KozEngine.AI.pathfindingScheduler, apis[2]);
    const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
    const critical = workerSource.match(/^const CRITICAL_URLS = (\[[\s\S]*?^\]);/m);
    assert(critical, 'Missing critical offline cache list');
    const urls = vm.runInNewContext(critical[1]);
    assert(urls.includes(astarPath));
    assert(urls.includes(connectivityPath));
    assert(urls.includes(schedulerPath));
  });

  test('actual NPC manager save serialization and restoration preserve debt without request handles', () => {
    const c = vm.createContext({
      console, window: { addEventListener() {}, removeEventListener() {} },
      cities: [{ location: { x: 0, y: 0 }, dockedTraderCount: 0 }], ItemLibrary: {},
      dayNight: { timeOfDay: 0, daysElapsed: 1, getDaysElapsed: () => 1 },
    });
    for (const name of ['Trader', 'TraderManager', 'Raider', 'RaiderManager']) {
      vm.runInContext(fs.readFileSync(path.join(root, `classes/${name}.js`), 'utf8') + `\nthis.${name}Class = ${name};`, c);
    }
    const trader = new c.TraderClass({ name: 'Saved trader', homeCityIndex: 0 });
    const raider = new c.RaiderClass({ name: 'Saved raider', x: 1, y: 1, strength: 2, patrolPoints: [{ x: 2, y: 2 }] });
    trader.moveTimer = 2048.5; raider.moveTimer = 4096.25;
    const handle = { status: 'pending' }; handle.self = handle;
    trader._pathRequest = { handle, grid: makeWorld() };
    raider._pathRequest = { handle, grid: makeWorld() };
    const traders = new c.TraderManagerClass(), raiders = new c.RaiderManagerClass();
    traders.traders = [trader]; raiders.raiders = [raider];
    const adapterSource = fs.readFileSync(path.join(root, 'adapters/bargainQuestSaveAdapter.js'), 'utf8');
    vm.runInContext(adapterSource, c);
    const adapter = c.BQAdapters.bargainQuest.save;
    const saved = JSON.parse(JSON.stringify(adapter.serializeRuntimeSnapshot({
      player: { x: 0, y: 0, gold: 10, inventory: new Map(), fleet: [] },
      dayNight: c.dayNight, cities: [], traderManager: traders, raiderManager: raiders,
    })));
    assert.equal(saved.traders[0].moveTimer, 2048.5);
    assert.equal(saved.raiders.raiders[0].moveTimer, 4096.25);
    assert.equal(JSON.stringify(saved).includes('"_pathRequest"'), false);
    assert.equal(JSON.stringify(saved).includes('"handle"'), false);
    // Exercise the actual adapter restore stage with actual entity managers.
    // Other systems are irrelevant to this stage's routing payloads.
    vm.runInContext(extractFunction(adapterSource, '_restoreSystems', '  '), c);
    class OtherSystem { static fromJSON() { return new OtherSystem(); } }
    const deps = { TraderManager: c.TraderManagerClass, RaiderManager: c.RaiderManagerClass,
      createMinigameManager: () => ({}) };
    for (const name of ['EventSystem', 'ContractSystem', 'TreasureSystem', 'BankingSystem',
      'SmugglingSystem', 'BountyBoard', 'GamblingSystem']) deps[name] = OtherSystem;
    const restored = c._restoreSystems(saved, { systems: {} }, deps);
    assert.equal(restored.traderManager.traders[0].moveTimer, 2048.5);
    assert.equal(restored.raiderManager.raiders[0].moveTimer, 4096.25);
    assert.equal(restored.traderManager.traders[0]._pathRequest, undefined);
    assert.equal(restored.raiderManager.raiders[0]._pathRequest, undefined);
  });
});
