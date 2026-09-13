const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const { createPathfindingScheduler } = require('../../Koz_Engine_Lib/AI/pathfindingScheduler.js');

function fixture(rows, cols, terrain = 'Grass') {
  const context = vm.createContext({ Math, Map, Set,
    grid: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ options: [terrain] }))),
    cityLocationMap: new Map() });
  const filename = path.resolve(__dirname, '../../classes/CityUnit.js');
  vm.runInContext(fs.readFileSync(filename, 'utf8') + '\nthis.Unit = CityUnit;', context, { filename });
  return context;
}

function referencePath(context, start, goal, movementType) {
  const queue = [[start.x, start.y]], previous = new Map([[`${start.x},${start.y}`, null]]);
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head];
    if (x === goal.x && y === goal.y) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, tile = context.grid[ny]?.[nx];
      const key = `${nx},${ny}`;
      if (!tile || previous.has(key)) continue;
      if (!context.cityLocationMap.has(key) && (movementType === 'naval' ? tile.options[0] !== 'Water' : tile.options[0] === 'Water')) continue;
      previous.set(key, [x, y]);
      queue.push([nx, ny]);
    }
  }
  if (!previous.has(`${goal.x},${goal.y}`)) return [];
  const result = [];
  for (let step = [goal.x, goal.y]; previous.get(step.join(',')); step = previous.get(step.join(','))) result.push({ x: step[0], y: step[1] });
  return result.reverse();
}

describe('CityUnit paths and elapsed movement', () => {
  test('matches shortest-step BFS and tie order across land, naval, barriers and city crossings', () => {
    for (const movementType of ['land', 'naval']) {
      const context = fixture(20, 25, movementType === 'naval' ? 'Water' : 'Grass');
      const barrier = movementType === 'naval' ? 'Grass' : 'Water';
      for (let y = 0; y < 19; y++) context.grid[y][8].options[0] = barrier;
      context.cityLocationMap.set('8,7', {});
      const unit = new context.Unit({ location: { x: 1, y: 1 }, movementType });
      for (const target of [{ x: 20, y: 17 }, { x: 4, y: 15 }, { x: 8, y: 7 }, { x: 8, y: 6 }]) {
        const actual = unit._buildPath(target.x, target.y);
        const expected = referencePath(context, unit, target, movementType);
        assert.equal(JSON.stringify(actual), JSON.stringify(expected));
      }
    }
  });

  test('reuses unchanged valid orders but replans for changed targets or blocked next tiles', () => {
    const context = fixture(8, 8), unit = new context.Unit({ location: { x: 0, y: 0 } });
    let searches = 0;
    const original = unit._buildPath;
    unit._buildPath = function (...args) { searches++; return original.apply(this, args); };
    unit.moveTo(7, 7);
    const initialPath = unit.path;
    for (let i = 0; i < 60; i++) unit.moveTo(7, 7);
    assert.equal(searches, 1);
    assert.equal(unit.path, initialPath);
    context.grid[unit.path[0].y][unit.path[0].x].options[0] = 'Water';
    unit.moveTo(7, 7);
    assert.equal(searches, 2);
    assert.equal(unit.path[0].y, 1);
    unit.moveTo(6, 7);
    assert.equal(searches, 3);
  });

  test('large updates preserve remainder and stop exactly at the target', () => {
    const context = fixture(2, 20);
    const a = new context.Unit({ location: { x: 0, y: 0 } });
    const b = new context.Unit({ location: { x: 0, y: 0 } });
    a.moveTo(10, 0); b.moveTo(10, 0);
    a.update(350);
    for (let i = 0; i < 35; i++) b.update(10);
    assert.deepEqual([a.x, a._stepTimer], [2, 110]);
    assert.deepEqual([a.x, a._stepTimer], [b.x, b._stepTimer]);
    a.update(10000);
    assert.equal(a.x, 10);
    assert.equal(a.state, 'idle');
    assert.equal(a.target, null);
    assert.equal(a._stepTimer, 0);
  });

  test('a changed tile is rechecked before movement even without a new order', () => {
    const context = fixture(4, 4), unit = new context.Unit({ location: { x: 0, y: 0 } });
    unit.moveTo(3, 0);
    context.grid[0][1].options[0] = 'Water';
    unit.update(120);
    assert.deepEqual([unit.x, unit.y], [0, 1]);
  });

  test('large routes retain shortest steps without shared workspace state', () => {
    const context = fixture(200, 200), unit = new context.Unit({ location: { x: 0, y: 0 } });
    assert.equal(unit._buildPath(199, 199).length, 398);
    assert.equal(unit._buildPath(199, 0).length, 199);
    assert.equal(unit._buildPath(0, 199).length, 199);
  });

  test('offscreen body culling leaves selected route rendering independent', () => {
    const context = fixture(4, 4), unit = new context.Unit({ location: { x: 0, y: 0 } });
    unit.moveTo(3, 3);
    unit.selected = true;
    let pushes = 0, renderedPath = null, footprint = null;
    context.push = () => { pushes++; };
    context.isRectOnScreen = (...bounds) => { footprint = bounds; return false; };
    unit.render(32);
    assert.equal(pushes, 0);
    assert.deepEqual(footprint, [-16, -32, 48, 64]);
    for (const name of ['pop', 'noFill', 'stroke', 'strokeWeight', 'beginShape', 'noStroke']) context[name] = () => {};
    context.drawVisibleWorldPath = (...args) => { renderedPath = args; };
    unit.renderPath(32);
    assert.equal(renderedPath[0], unit.path);
    assert.deepEqual(renderedPath.slice(1), [16, 16, 32]);
    assert.equal(pushes, 1);
  });
});

function scheduledFixture(rows = 20, cols = 25, terrain = 'Grass') {
  const context = fixture(rows, cols, terrain);
  const scheduler = createPathfindingScheduler({
    createSearch() { throw new Error('City routes must use their BFS factory'); },
    now: () => 0, budgetMs: 1, stepSize: 32, maxStepsPerTick: 64,
  });
  context.requestWorldPath = (options, complete) => scheduler.request({ ...options, grid: context.grid }, complete);
  return { context, scheduler };
}

function finishScheduler(scheduler) {
  let pumps = 0;
  while (scheduler.getStats().pending > 0) {
    scheduler.pump();
    assert(++pumps < 10000, 'Path search failed to finish');
  }
}

describe('Scheduled CityUnit BFS', () => {
  test('queued land and naval routes preserve exact BFS tie order and city crossings', () => {
    for (const movementType of ['land', 'naval']) {
      const { context, scheduler } = scheduledFixture(20, 25, movementType === 'naval' ? 'Water' : 'Grass');
      for (let y = 0; y < 19; y++) context.grid[y][8].options[0] = movementType === 'naval' ? 'Grass' : 'Water';
      context.cityLocationMap.set('8,7', {});
      const unit = new context.Unit({ location: { x: 1, y: 1 }, movementType });
      unit.moveTo(20, 17);
      assert.equal(unit.path.length, 0);
      assert.equal(unit.state, 'moving');
      for (let i = 0; i < 60; i++) unit.moveTo(20, 17);
      assert.equal(scheduler.getStats().requested, 1);
      finishScheduler(scheduler);
      assert.equal(JSON.stringify(unit.path), JSON.stringify(referencePath(context, unit, { x: 20, y: 17 }, movementType)));
    }
  });

  test('pending routes retain elapsed movement debt and never move on a paused update', () => {
    const { context, scheduler } = scheduledFixture();
    const unit = new context.Unit({ location: { x: 0, y: 0 } });
    unit.moveTo(10, 0);
    unit.update(350);
    assert.deepEqual([unit.x, unit.y, unit._stepTimer], [0, 0, 350]);
    finishScheduler(scheduler);
    unit.update(0);
    assert.deepEqual([unit.x, unit.y, unit._stepTimer], [0, 0, 350]);
    unit.update(10);
    assert.deepEqual([unit.x, unit.y, unit._stepTimer], [3, 0, 0]);
    unit.update(10000);
    assert.deepEqual([unit.x, unit.y, unit._stepTimer, unit.state], [10, 0, 0, 'idle']);
  });

  test('changed destinations cancel old work and discarded callbacks cannot overwrite the new order', () => {
    const context = fixture(8, 8), requests = [];
    context.requestWorldPath = (options, complete) => {
      const handle = { status: 'pending', cancel() { this.status = 'cancelled'; } };
      requests.push({ options, complete, handle });
      return handle;
    };
    const unit = new context.Unit({ location: { x: 0, y: 0 } });
    unit.moveTo(7, 7);
    unit.moveTo(2, 0);
    assert.equal(requests[0].handle.status, 'cancelled');
    requests[0].complete([{ x: 0, y: 1 }]);
    assert.equal(unit.path.length, 0);
    requests[1].complete([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
    unit.update(240);
    assert.deepEqual([unit.x, unit.y, unit.state], [2, 0, 'idle']);
  });

  test('large route debt releases at most eight steps per update without losing remaining time', () => {
    const { context, scheduler } = scheduledFixture(1, 150);
    const unit = new context.Unit({ location: { x: 0, y: 0 } });
    unit.moveTo(120, 0);
    unit.update(12000);
    finishScheduler(scheduler);
    unit.update(1);
    assert.deepEqual([unit.x, unit._stepTimer], [8, 11041]);
    unit.update(0);
    assert.deepEqual([unit.x, unit._stepTimer], [8, 11041]);
    for (let i = 0; i < 11; i++) unit.update(1);
    assert.deepEqual([unit.x, unit._stepTimer], [96, 492]);
    unit.update(1);
    assert.deepEqual([unit.x, unit._stepTimer], [100, 13]);
  });

  test('moving chase targets allow the pending search and its first step to complete', () => {
    const { context, scheduler } = scheduledFixture();
    const unit = new context.Unit({ location: { x: 0, y: 0 } });
    unit._chaseRaiderId = 123;
    unit.moveTo(15, 15);
    unit.moveTo(16, 15);
    assert.equal(scheduler.getStats().requested, 1);
    finishScheduler(scheduler);
    unit.moveTo(17, 15);
    assert.equal(scheduler.getStats().requested, 1);
    unit.update(120);
    unit.moveTo(17, 15);
    assert.equal(scheduler.getStats().requested, 2);
  });

  test('a blocked next tile schedules a replacement without consuming the due movement step', () => {
    const { context, scheduler } = scheduledFixture(4, 4);
    const unit = new context.Unit({ location: { x: 0, y: 0 } });
    unit.moveTo(3, 0);
    finishScheduler(scheduler);
    context.grid[0][1].options[0] = 'Water';
    unit.update(120);
    assert.deepEqual([unit.x, unit.y, unit._stepTimer], [0, 0, 120]);
    assert.equal(scheduler.getStats().pending, 1);
    finishScheduler(scheduler);
    unit.update(1);
    assert.deepEqual([unit.x, unit.y, unit._stepTimer], [0, 1, 1]);
  });

  test('cancelled world requests resume and saved pending orders restore with their elapsed debt', () => {
    const { context, scheduler } = scheduledFixture();
    const unit = new context.Unit({ location: { x: 0, y: 0 } });
    unit.moveTo(10, 0);
    unit.update(350);
    const snapshot = unit.toJSON();
    assert.equal(snapshot.stepTimer, 350);
    assert.equal(JSON.stringify(snapshot).includes('_pathRequest'), false);
    scheduler.cancelAll();
    unit.update(0);
    assert.equal(unit._pathRequest, null);
    unit.update(10);
    assert.equal(scheduler.getStats().pending, 1);
    assert.equal(unit._stepTimer, 360);
    scheduler.cancelAll();
    const restored = context.Unit.fromJSON(snapshot, null);
    assert.equal(scheduler.getStats().pending, 1);
    finishScheduler(scheduler);
    restored.update(0);
    assert.equal(restored.x, 0);
    restored.update(10);
    assert.deepEqual([restored.x, restored._stepTimer], [3, 0]);
  });

  test('combat cancellation, defeat, removal and manager clearing release pending searches', () => {
    const { context, scheduler } = scheduledFixture();
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../classes/CityUnitManager.js'), 'utf8') + '\nthis.Manager = CityUnitManager;', context);
    const manager = new context.Manager();
    const units = Array.from({ length: 4 }, () => new context.Unit({ location: { x: 0, y: 0 } }));
    units[0].selected = true;
    for (const unit of units) { manager.add(unit); unit.moveTo(20, 15); }
    assert.equal(scheduler.getStats().pendingPlayer, 1);
    assert.equal(scheduler.getStats().pendingBackground, 3);
    units[0].target = null; units[0].path = []; units[0].state = 'idle';
    units[0].update(0);
    assert.equal(scheduler.getStats().pending, 3);
    units[1].takeDamage(100);
    assert.equal(scheduler.getStats().pending, 2);
    manager.remove(units[2]);
    assert.equal(scheduler.getStats().pending, 1);
    manager.clear();
    assert.equal(scheduler.getStats().pending, 0);
  });

  test('BFS initialization, expansion and reconstruction are bounded on large worlds', () => {
    const context = fixture(1, 1);
    let terrainReads = 0;
    const tile = { get options() { terrainReads++; return ['Grass']; } };
    const world = Array(1500).fill(Array(1500).fill(tile));
    const search = context.Unit.createPathSearch(world, { x: 0, y: 0 }, { x: 1499, y: 1499 });
    assert.equal(search.allocatedCells, 1024);
    terrainReads = 0;
    search.step(64);
    assert.equal(search.expandedNodes, 64);
    assert(terrainReads <= 64 * 4);
    assert(search.allocatedCells < 10000);
    search.cancel();
    assert.equal(search.allocatedCells, 0);
    assert.equal(search.done, true);
    const corridor = context.Unit.createPathSearch([Array(2048).fill(tile)], { x: 0, y: 0 }, { x: 2047, y: 0 });
    corridor.step(2047);
    assert.equal(corridor.done, false);
    assert.equal(corridor.expandedNodes, 2047);
    corridor.step(10);
    assert.equal(corridor.done, false);
    while (!corridor.done) {
      const before = corridor.processedWork;
      corridor.step(31);
      assert(corridor.processedWork - before <= 31);
    }
    assert.equal(corridor.result.length, 2047);
    assert.equal(corridor.result[0].x, 1);
    assert.equal(corridor.result[2046].x, 2047);
  });
});
