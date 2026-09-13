const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const { SpatialGrid } = require('../../Koz_Engine_Lib/Core/spatialGrid.js');

function load(context, file, name) {
  const filename = path.resolve(__dirname, '../../classes', file);
  vm.runInContext(fs.readFileSync(filename, 'utf8') + '\nthis.__loaded = ' + name + ';', context, { filename });
  return context.__loaded;
}

function fixture(playerY = 400) {
  const context = vm.createContext({
    console, Math, Map, Set, Date, frameCount: 0,
    TRADER_NOTICE_RADIUS: 80,
    player: { x: 0, y: playerY, currentCity: null },
    cities: [
      { location: { x: 0, y: 400 }, dockedTraderCount: 0, inventory: new Map() },
      { location: { x: 100, y: 400 }, dockedTraderCount: 0, inventory: new Map() },
    ],
    cityLocationMap: new Map(), ItemLibrary: {},
    traderGrid: { move() {} }, raiderGrid: { move() {} },
    dayNight: { getDaysElapsed() { return 10; } },
    window: { addEventListener() {}, removeEventListener() {},
      BQSeededRNG: { stream() { return { random: () => 0.5 }; } } },
  });
  for (let i = 0; i < context.cities.length; i++) {
    context.cities[i].cityIndex = i;
    context.cityLocationMap.set(`${context.cities[i].location.x},400`, context.cities[i]);
  }
  return context;
}

function movingEntity(context, kind) {
  const Entity = load(context, kind + '.js', kind);
  return Object.assign(Object.create(Entity.prototype), {
    x: 0, y: 400, state: kind === 'Trader' ? 'traveling' : 'patrolling',
    path: Array.from({ length: 100 }, (_, i) => ({ x: i + 1, y: 400 })),
    moveTimer: 0, moveInterval: 128, chaseInterval: 128,
    animTimer: 0, animFrame: 0, direction: 'right',
    abstractArrivalDay: -1, targetCityIndex: 1, currentCityIndex: 0,
    personality: 'brave', gold: 200, inventory: new Map(), _emoteTimer: 0,
    isNeutral: true, stunTimer: 0, pathFailCooldown: 0, patrolPoints: [],
  });
}

describe('NPC simulation elapsed time', () => {
  for (const kind of ['Trader', 'Raider']) {
    test(`${kind} follows the same route and time near and far from the player`, () => {
      const snapshots = [];
      for (const playerY of [400, 0]) {
        const context = fixture(playerY);
        const entity = movingEntity(context, kind);
        const Manager = load(context, kind + 'Manager.js', kind + 'Manager');
        const manager = new Manager();
        manager[kind === 'Trader' ? 'traders' : 'raiders'] = [entity];
        for (context.frameCount = 0; context.frameCount < 512; context.frameCount++) manager.update(16);
        snapshots.push([entity.x, entity.y, entity.moveTimer, entity.abstractArrivalDay]);
        manager.destroy();
      }
      assert.deepEqual(snapshots[0], [64, 400, 0, -1]);
      assert.deepEqual(snapshots[1], snapshots[0]);
    });

    test(`${kind} keeps fractional time and takes every due step after a long frame`, () => {
      const smallContext = fixture(0), largeContext = fixture(0);
      const small = movingEntity(smallContext, kind), large = movingEntity(largeContext, kind);
      for (let frame = 0; frame < 35; frame++) small.update(10, 0, 0);
      large.update(350, 0, 0);
      assert.deepEqual([large.x, large.moveTimer], [small.x, small.moveTimer]);
      assert.deepEqual([large.x, large.moveTimer], [2, 94]);
      large.update(34, 0, 0);
      assert.deepEqual([large.x, large.moveTimer], [3, 0]);
    });
  }

  test('a trader stops at a destination and docks exactly once after a long frame', () => {
    const context = fixture(0);
    const trader = movingEntity(context, 'Trader');
    context.cities[1].location.x = 2;
    context.cityLocationMap.delete('100,400');
    context.cityLocationMap.set('2,400', context.cities[1]);
    trader.path = [{ x: 1, y: 400 }, { x: 2, y: 400 }];
    trader.update(10000);
    assert.equal(trader.x, 2);
    assert.equal(trader.state, 'trading');
    assert.equal(context.cities[1].dockedTraderCount, 1);
    assert.equal(trader.moveTimer, 0);
  });

  test('a trader crossing the player during a long frame leaves an encounter observable', () => {
    const context = fixture(400);
    const trader = movingEntity(context, 'Trader');
    context.player.x = 2;
    trader.update(1000);
    assert.equal(trader.x, 2);
    assert.equal(trader.moveTimer, 744);
  });

  test('legacy abstract saves resume real routes without teleporting or decrementing docked counts twice', () => {
    const context = fixture(0);
    const Trader = load(context, 'Trader.js', 'Trader');
    const Manager = load(context, 'TraderManager.js', 'TraderManager');
    const manager = new Manager();
    let searches = 0;
    context.grid = [[]];
    context.aStar = (world, start, target) => {
      searches++;
      assert.equal(start.x, 20);
      assert.equal(target.x, 100);
      return Array.from({ length: 80 }, (_, i) => ({ x: i + 21, y: 400 }));
    };
    const trader = Trader.fromJSON({ name: 'Saved', personality: 'brave', homeCityIndex: 0,
      currentCityIndex: 0, targetCityIndex: 1, x: 20, y: 400, gold: 100,
      state: 'traveling', waitDays: 0, abstractArrivalDay: 1, inventory: [] });
    context.cities[0].dockedTraderCount = 4;
    manager.traders = [trader];
    manager.onDayChanged({ detail: { daysElapsed: 10 } });
    assert.equal(trader.x, 20);
    manager.update(0);
    assert.equal(searches, 1);
    assert.equal(trader.x, 20);
    assert.equal(trader.abstractArrivalDay, -1);
    assert.equal(trader.state, 'traveling');
    assert.equal(context.cities[0].dockedTraderCount, 4);
    manager.destroy();
  });

  test('raider stun uses only its remaining duration from a long frame', () => {
    const context = fixture(0), raider = movingEntity(context, 'Raider');
    raider.stunTimer = 100;
    raider.update(400, 0, 0);
    assert.equal(raider.stunTimer, 0);
    assert.deepEqual([raider.x, raider.moveTimer], [2, 44]);
  });

  test('chasing raiders stop adjacent to the player during a long frame', () => {
    const context = fixture(400), raider = movingEntity(context, 'Raider');
    raider.isNeutral = false;
    raider.state = 'chasing';
    raider.bribedCooldown = 0;
    raider.detectionRadius = 10;
    context.player.x = 4;
    raider.update(1000, 4, 400);
    assert.equal(raider.x, 3);
    assert.equal(raider.state, 'chasing');
  });
});

describe('local city threat queries', () => {
  test('queries one city locally, preserving Manhattan radius, exclusions, order and same-frame movement', () => {
    const context = fixture(0);
    context.frameCount = 1;
    context.cities = [{ location: { x: 31, y: 31 } }];
    for (let i = 1; i < 500; i++) context.cities.push({ get location() { throw new Error('Unqueried city scanned'); } });
    context.raiderGrid = new SpatialGrid(32);
    const Manager = load(context, 'RaiderManager.js', 'RaiderManager');
    const manager = new Manager();
    const first = { x: 33, y: 31, state: 'patrolling', update() {} };
    const second = { x: 30, y: 31, state: 'patrolling', update() {} };
    manager.raiders = [first, second,
      { x: 35, y: 35, state: 'patrolling', update() {} },
      { x: 31, y: 31, state: 'patrolling', isNeutral: true, update() {} },
      { x: 31, y: 31, state: 'defeated' }];
    for (const raider of manager.raiders) context.raiderGrid.insert(raider, raider.x, raider.y);
    const matches = manager.getRaidersNearCity(0, 5);
    assert.equal(matches.length, 2);
    assert.equal(matches[0], first);
    assert.equal(matches[1], second);
    assert.equal(manager.getRaiderCountNearCity(0, 1), 1);
    first.update = () => { first.x = 100; context.raiderGrid.move(first, first.x, first.y); };
    manager.update(16);
    assert.equal(manager.getRaiderCountNearCity(0, 5), 1);
    manager.destroy();
  });
});

function queuedPaths(context) {
  const requests = [];
  context.aStar = () => { throw new Error('Synchronous A* used despite available scheduler'); };
  context.requestWorldPath = (options, complete) => {
    const handle = { status: 'pending', cancel() { this.status = 'cancelled'; } };
    requests.push({ options, handle, finish(result) { handle.status = 'completed'; complete(result); } });
    return handle;
  };
  return requests;
}

describe('scheduled NPC routes', () => {
  test('NPC movement catchup is bounded while retaining debt for future frames', () => {
    for (const kind of ['Trader', 'Raider']) {
      const context = fixture(0), entity = movingEntity(context, kind);
      entity.update(10000, 0, 0);
      assert.equal(entity.x, 8);
      assert.equal(entity.moveTimer, 8976);
      entity.update(0, 0, 0);
      assert.equal(entity.x, 8);
      entity.update(16, 0, 0);
      assert.equal(entity.x, 16);
      assert.equal(entity.moveTimer, 7968);
    }
  });

  test('immediate and delayed trader route completions account for the same elapsed time', () => {
    const immediateContext = fixture(0), delayedContext = fixture(0);
    const immediate = movingEntity(immediateContext, 'Trader'), delayed = movingEntity(delayedContext, 'Trader');
    const route = () => Array.from({ length: 100 }, (_, i) => ({ x: i + 1, y: 400 }));
    immediateContext.requestWorldPath = (options, complete) => { complete(route()); return { status: 'completed', cancel() {} }; };
    const delayedRequests = queuedPaths(delayedContext);
    for (const entity of [immediate, delayed]) { entity.state = 'idle'; entity.waitDays = 0; entity.path = []; }
    immediate.update(200); delayed.update(200);
    delayedRequests[0].finish(route());
    immediate.update(56); delayed.update(56);
    assert.deepEqual([delayed.x, delayed.moveTimer], [immediate.x, immediate.moveTimer]);
    assert.equal(immediate.x, 2);
  });

  test('trader schedules once, preserves pending movement debt, and stays paused until positive dt', () => {
    const context = fixture(0), trader = movingEntity(context, 'Trader');
    const requests = queuedPaths(context);
    trader.state = 'idle'; trader.waitDays = 0; trader.path = [];
    for (let i = 0; i < 3; i++) trader.update(100);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].options.priority, 'background');
    assert.equal(trader.moveTimer, 300);
    trader.update(0);
    assert.equal(trader.moveTimer, 300);
    requests[0].finish(Array.from({ length: 100 }, (_, i) => ({ x: i + 1, y: 400 })));
    trader.update(0);
    assert.equal(trader.x, 0);
    trader.update(84);
    assert.equal(trader.x, 3);
    assert.equal(trader.moveTimer, 0);
  });

  test('changed trader destinations cancel stale requests and ignore late callbacks', () => {
    const context = fixture(0), trader = movingEntity(context, 'Trader');
    context.cities.push({ location: { x: 200, y: 400 } });
    const requests = queuedPaths(context);
    trader.state = 'idle'; trader.waitDays = 0; trader.path = [];
    trader.update(100);
    trader.targetCityIndex = 2;
    trader.update(100);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].handle.status, 'cancelled');
    requests[0].finish([{ x: 99, y: 400 }]);
    assert.equal(trader.path.length, 0);
    assert.equal(trader.targetCityIndex, 2);
    assert.equal(trader._pathRequest.handle, requests[1].handle);
  });

  test('a cancelled traveler restarts its saved-coordinate route when its world resumes', () => {
    const context = fixture(0), trader = movingEntity(context, 'Trader');
    const requests = queuedPaths(context);
    trader.path = []; trader._needsRouteRestore = true;
    trader.update(100);
    requests[0].handle.cancel();
    trader.update(100);
    assert.equal(requests.length, 2);
    assert.equal(trader.x, 0);
    assert.equal(trader.moveTimer, 200);
    trader._cancelPathRequest();
    trader.update(100);
    assert.equal(requests.length, 3);
    assert.equal(trader.moveTimer, 300);
  });

  test('raider patrol waits for one route while retaining all elapsed time', () => {
    const context = fixture(0), raider = movingEntity(context, 'Raider');
    const requests = queuedPaths(context);
    raider.path = [];
    raider.patrolPoints = [{ x: 100, y: 400 }]; raider.currentPatrolIndex = 0;
    raider.update(350, 0, 0);
    raider.update(50, 0, 0);
    assert.equal(requests.length, 1);
    assert.equal(raider.moveTimer, 400);
    requests[0].finish(Array.from({ length: 100 }, (_, i) => ({ x: i + 1, y: 400 })));
    raider.update(0, 0, 0);
    assert.equal(raider.x, 0);
    raider.update(112, 0, 0);
    assert.equal(raider.x, 4);
    assert.equal(raider.moveTimer, 0);
  });

  test('moving chase targets do not repeatedly cancel an unfinished search', () => {
    const context = fixture(400), raider = movingEntity(context, 'Raider');
    const requests = queuedPaths(context);
    raider.path = []; raider.isNeutral = false; raider.state = 'chasing';
    raider.detectionRadius = 100; raider.bribedCooldown = 0;
    context.player.x = 10;
    raider.update(128, 10, 400);
    for (let x = 11; x <= 15; x++) { context.player.x = x; raider.update(16, x, 400); }
    assert.equal(requests.length, 1);
    assert.equal(requests[0].handle.status, 'pending');
    requests[0].finish(Array.from({ length: 10 }, (_, i) => ({ x: i + 1, y: 400 })));
    raider.update(16, 15, 400);
    assert.equal(raider.x, 1);
    assert.equal(requests.length, 1);
  });

  test('dead entities cancel pending work and serialized snapshots contain only resumable data', () => {
    for (const kind of ['Trader', 'Raider']) {
      const context = fixture(0), entity = movingEntity(context, kind);
      const requests = queuedPaths(context);
      const Manager = load(context, kind + 'Manager.js', kind + 'Manager');
      const manager = new Manager();
      manager[kind === 'Trader' ? 'traders' : 'raiders'] = [entity];
      entity.path = [];
      entity.relations = new Map();
      if (kind === 'Trader') { entity.state = 'idle'; entity.waitDays = 0; }
      else { entity.patrolPoints = [{ x: 100, y: 400 }]; entity.currentPatrolIndex = 0; }
      manager.update(200);
      assert.equal(requests.length, 1);
      const snapshot = entity.toJSON();
      assert.equal(snapshot.moveTimer, 200);
      assert.equal(JSON.stringify(snapshot).includes('handle'), false);
      entity.state = kind === 'Trader' ? 'dead' : 'defeated';
      manager.update(16);
      assert.equal(requests[0].handle.status, 'cancelled');
      assert.equal(entity._pathRequest, null);
      manager.destroy();
    }
  });
});
