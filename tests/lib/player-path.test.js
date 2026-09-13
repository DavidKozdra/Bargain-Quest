const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const { createPathSearch } = require('../../Koz_Engine_Lib/AI/astar.js');
const { createPathfindingScheduler } = require('../../Koz_Engine_Lib/AI/pathfindingScheduler.js');

function fixture() {
  const pickedUp = [], events = [], notices = [], requests = [];
  const context = vm.createContext({
    Math, Map, Set, Date, deltaTime: 16, gameSpeed: 1,
    grid: Array.from({ length: 3 }, () => Array.from({ length: 64 }, () => ({ options: ['Grass'] }))),
    cities: [], cityLocationMap: new Map(),
    window: { addEventListener() {}, removeEventListener() {} },
    notificationManager: { log(message) { notices.push(message); } },
    gameStateManager: { currentState: 'PLAYING' },
  });
  const filename = path.resolve(__dirname, '../../classes/player.js');
  vm.runInContext(fs.readFileSync(filename, 'utf8') + '\nthis.Player = Player;', context, { filename });
  const player = Object.assign(Object.create(context.Player.prototype), {
    grid: context.grid, x: 0, y: 0, path: [], pathMoveTimer: 0, pathMoveInterval: 100,
    currentCity: null, currentTileCity: null, activeBoat: null, fleet: [], isSailing: false,
    landSpeed: 100, _sailNotified: true, animTimer: 0, animFrame: 0, modifiers: { seaLegs: true },
    _nextEndCheckTime: Infinity, addItem(item) { pickedUp.push(item.name); return true; },
    spendGold() {},
  });
  context.player = player;
  context.eventSystem = { onPlayerMoved() { events.push([player.x, player.y]); } };
  const route = (start, goal) => Array.from({ length: Math.max(0, goal.x - start.x) }, (_, i) => ({ x: start.x + i + 1, y: start.y }));
  context.aStar = (world, start, goal) => route(start, goal);
  function scheduled(immediate = false) {
    context.aStar = () => { throw new Error('Unbounded A* used with scheduler available'); };
    context.requestWorldPath = (options, complete) => {
      const handle = { status: 'pending', cancel() { this.status = 'cancelled'; } };
      const request = { options, handle, finish(result = route(options.start, options.goal)) { handle.status = 'completed'; complete(result); } };
      requests.push(request);
      if (immediate) request.finish();
      return handle;
    };
  }
  return { context, player, pickedUp, events, notices, requests, scheduled };
}

describe('Player scheduled path movement', () => {
  test('player routes complete through the real bounded scheduler and incremental A*', () => {
    const f = fixture();
    const scheduler = createPathfindingScheduler({ createSearch: createPathSearch,
      now: () => 0, stepSize: 8, maxStepsPerTick: 16, budgetMs: 1 });
    f.context.requestWorldPath = (options, complete) => scheduler.request({ ...options,
      grid: f.context.grid, elevationMap: Array.from({ length: 3 }, () => Array(64).fill(0)), baseDiff: { Grass: 1 } }, complete);
    f.context.aStar = () => { throw new Error('Synchronous fallback should not run'); };
    f.player.setPathTo(63, 0);
    assert.equal(scheduler.getStats().pendingPlayer, 1);
    f.player.update(250);
    let pumps = 0;
    while (scheduler.getStats().pending > 0) { scheduler.pump(); assert(++pumps < 1000); }
    assert(pumps > 1);
    assert.equal(f.player.path.length, 63);
    f.player.update(50);
    assert.equal(f.player.x, 3);
    assert.equal(f.player.pathMoveTimer, 0);
  });

  test('immediate and queued routes preserve elapsed time, player priority and pause', () => {
    const immediate = fixture(), delayed = fixture();
    immediate.scheduled(true); delayed.scheduled();
    immediate.player.setPathTo(20, 0); delayed.player.setPathTo(20, 0);
    immediate.player.update(200); delayed.player.update(200);
    assert.equal(delayed.player.x, 0);
    assert.equal(delayed.player.pathMoveTimer, 200);
    assert.equal(delayed.requests[0].options.priority, 'player');
    for (let i = 0; i < 30; i++) delayed.player.setPathTo(20, 0);
    assert.equal(delayed.requests.length, 1);
    delayed.requests[0].finish();
    delayed.player.update(0);
    assert.deepEqual([delayed.player.x, delayed.player.pathMoveTimer], [0, 200]);
    immediate.player.update(160); delayed.player.update(160);
    assert.deepEqual([delayed.player.x, delayed.player.pathMoveTimer], [immediate.player.x, immediate.player.pathMoveTimer]);
    assert.deepEqual([delayed.player.x, delayed.player.pathMoveTimer], [3, 60]);
  });

  test('departure leaves the city while planning and does not auto-enter it again', () => {
    const f = fixture(); f.scheduled();
    const city = { location: { x: 0, y: 0 } };
    f.context.cityLocationMap.set('0,0', city);
    f.player.currentCity = city; f.player.currentTileCity = city;
    f.player.setPathTo(10, 0);
    assert.equal(f.player.currentCity, null);
    f.player.update(150);
    assert.equal(f.player.currentTileCity, null);
    assert.equal(f.player.pathMoveTimer, 150);
  });

  test('synchronous fallback removes the start node without charging an interval', () => {
    const f = fixture();
    f.context.aStar = () => [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
    f.player.setPathTo(2, 0);
    f.player.update(100);
    assert.equal(f.player.x, 1);
    assert.deepEqual(f.events, [[1, 0]]);
    assert.equal(f.player.pathMoveTimer, 0);
  });

  test('catchup visits intermediate items and rolls sea events once per tile', () => {
    const f = fixture();
    f.player.activeBoat = { condition: 100, getEffectiveSpeed() { return 100; } };
    const sea = [];
    f.player._rollSeaEvent = () => sea.push(f.player.x);
    for (let x = 1; x <= 5; x++) {
      f.context.grid[0][x].options[0] = 'Water';
      f.context.grid[0][x].item = { name: 'Item' + x };
    }
    f.player.setPathTo(5, 0, true);
    f.player.update(350);
    assert.deepEqual(f.pickedUp, ['Item1', 'Item2', 'Item3']);
    assert.deepEqual(sea, [1, 2, 3]);
    assert.deepEqual(f.events, [[1, 0], [2, 0], [3, 0]]);
    assert.equal(f.player.pathMoveTimer, 50);
  });

  test('catchup stops for an event state change and retains its remaining time', () => {
    const f = fixture();
    f.context.eventSystem.onPlayerMoved = () => { f.events.push([f.player.x, 0]); if (f.player.x === 2) f.context.gameStateManager.currentState = 'EVENT'; };
    f.player.setPathTo(20, 0);
    f.player.update(1000);
    assert.equal(f.player.x, 2);
    assert.equal(f.player.pathMoveTimer, 800);
    assert.deepEqual(f.events, [[1, 0], [2, 0]]);
  });

  test('catchup stops at intermediate raider and trader encounter tiles', () => {
    for (const manager of ['raiderManager', 'traderManager']) {
      const f = fixture();
      f.context[manager] = { [manager === 'raiderManager' ? 'checkPlayerCollision' : 'checkPlayerEncounter']: x => x === 2 ? {} : null };
      f.player.setPathTo(20, 0);
      f.player.update(1000);
      assert.equal(f.player.x, 2);
      assert.equal(f.player.pathMoveTimer, 800);
    }
  });

  test('catchup is bounded and keeps unprocessed debt for later active frames', () => {
    const f = fixture();
    f.player.setPathTo(50, 0);
    f.player.update(10000);
    assert.deepEqual([f.player.x, f.player.pathMoveTimer], [8, 9200]);
    f.player.update(0);
    assert.deepEqual([f.player.x, f.player.pathMoveTimer], [8, 9200]);
    f.player.update(1);
    assert.deepEqual([f.player.x, f.player.pathMoveTimer], [16, 8401]);
  });

  test('a destination city stops the completed route and docks the boat', () => {
    const f = fixture();
    const city = { location: { x: 2, y: 0 } };
    f.context.cityLocationMap.set('2,0', city);
    f.player.setPathTo(2, 0);
    f.player.update(1000);
    assert.equal(f.player.x, 2);
    assert.equal(f.player.currentTileCity, city);
    assert.equal(f.player.pathMoveTimer, 0);
    assert.equal(f.player.path.length, 0);
  });

  test('accepted manual movement cancels pending work, but a blocked move does not', () => {
    const f = fixture(); f.scheduled();
    f.player.setPathTo(10, 0);
    f.player.update(250);
    f.player.move(-1, 0);
    assert.equal(f.requests[0].handle.status, 'pending');
    f.player.move(0, 1);
    assert.equal(f.requests[0].handle.status, 'cancelled');
    assert.equal(f.player.pathMoveTimer, 0);
    f.requests[0].finish();
    assert.equal(f.player.path.length, 0);
    assert.deepEqual([f.player.x, f.player.y], [0, 1]);
  });

  test('new destinations, currenttile stop, fasttravel, sinking and destruction cancel pending routes', () => {
    for (const action of ['replace', 'stop', 'fasttravel', 'sink', 'destroy']) {
      const f = fixture(); f.scheduled();
      f.player.setPathTo(10, 0);
      if (action === 'replace') f.player.setPathTo(20, 0);
      if (action === 'stop') f.player.setPathTo(0, 0);
      if (action === 'fasttravel') f.player.fastTravelToCity({ location: { x: 4, y: 1 }, name: 'Town' }, 20);
      if (action === 'sink') { const boat = { name: 'Ship', condition: 0 }; f.player.fleet = [boat]; f.player.activeBoat = boat; f.player._handleBoatSinking(boat); }
      if (action === 'destroy') f.player.destroy();
      assert.equal(f.requests[0].handle.status, 'cancelled', action);
      f.requests[0].finish();
      assert.equal(f.player.path.length, 0, action);
      if (action === 'replace') assert.equal(f.player._pathRequest.handle, f.requests[1].handle);
      else assert.equal(f.player._pathRequest, null);
    }
  });

  test('global cancellation retries the same world without dropping debt, but changed worlds reject callbacks', () => {
    const f = fixture(); f.scheduled();
    f.player.setPathTo(20, 0); f.player.update(250);
    f.requests[0].handle.cancel();
    f.player.update(50);
    assert.equal(f.requests.length, 2);
    assert.equal(f.player.pathMoveTimer, 300);
    f.requests[1].finish(); f.player.update(1);
    assert.equal(f.player.x, 3);
    f.player.setPathTo(30, 0);
    f.context.grid = [];
    f.requests[2].finish();
    assert.equal(f.player.path.length, 0);
    assert.equal(f.player._pathRequest, null);
  });
});

function installManualMovement(f) {
  const source = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf8');
  const start = source.indexOf('function handleMovement() {');
  const end = source.indexOf('\nfunction windowResized()', start);
  assert(start >= 0 && end > start);
  Object.assign(f.context, {
    GameStates: { SPACE: 'SPACE', CITY_MANAGE: 'CITY_MANAGE' },
    _isPlanetSurfaceControlActive: () => false,
    _isSurfaceGameplayState: () => f.context.gameStateManager.currentState === 'PLAYING',
    _isTextEntryFocused: () => false, _isCityViewOpen: () => false,
    isActionDown: key => key === 'moveRight',
    moveTimer: 200, moveDelay: 100, tileSize: 32, cityManagement: null,
  });
  f.context.gameStateManager.is = state => f.context.gameStateManager.currentState === state;
  vm.runInContext(source.slice(start, end), f.context, { filename: 'game.js:handleMovement' });
}

describe('Paused manual input integration', () => {
  test('zero speed leaves retained manual debt and a pending player route untouched', () => {
    const f = fixture(); f.scheduled(); installManualMovement(f);
    f.player.setPathTo(10, 0);
    f.player.update(250);
    f.context.gameSpeed = 0;
    f.context.handleMovement();
    assert.equal(f.player.x, 0);
    assert.equal(f.context.moveTimer, 200);
    assert.equal(f.player.pathMoveTimer, 250);
    assert.equal(f.requests[0].handle.status, 'pending');
    assert.equal(f.player._pathRequest.handle, f.requests[0].handle);
    // Resuming simulation still permits the accepted manual override.
    f.context.gameSpeed = 1;
    f.context.handleMovement();
    assert.equal(f.player.x, 1);
    assert.equal(f.requests[0].handle.status, 'cancelled');
  });

  test('city camera panning remains available at zero simulation speed', () => {
    for (const isSettled of [true, false]) {
      const f = fixture(); f.scheduled(); installManualMovement(f);
      f.player.setPathTo(10, 0);
      f.context.gameSpeed = 0;
      f.context.gameStateManager.currentState = 'CITY_MANAGE';
      f.context.cityManagement = { isSettled };
      f.context.handleMovement();
      const offset = isSettled ? f.context.window._cityMgmtCamOffX : f.context.window._cityMgmtCamDx;
      assert.equal(offset, 32 * 0.35 * 16);
      assert.equal(f.player.x, 0);
      assert.equal(f.requests[0].handle.status, 'pending');
      assert.equal(f.context.moveTimer, 200);
    }
  });
});
