const assert = require('node:assert/strict');
const { createPathfindingScheduler } = require('../../Koz_Engine_Lib/AI/pathfindingScheduler');
const { createPathSearch } = require('../../Koz_Engine_Lib/AI/astar');

function harness(options = {}) {
  let clock = 0;
  let live = 0;
  let maxLive = 0;
  const created = [];
  const steps = [];
  const searches = [];
  const scheduler = createPathfindingScheduler({
    now: () => clock, budgetMs: 2, stepSize: 2, maxStepsPerTick: 6,
    createSearch(grid, start, goal, allowWater, portCities, waterOnly, costs) {
      created.push({ grid, start, goal, allowWater, portCities, waterOnly, costs });
      let remaining = grid.work;
      let released = false;
      live++;
      maxLive = Math.max(live, maxLive);
      function release() { if (!released) { released = true; live--; } }
      const search = {
        done: remaining === 0, result: [{ x: goal.x, y: goal.y }], cancelled: false,
        step(allowance) {
          steps.push({ id: grid.id, allowance });
          clock += grid.stepMs || 0;
          remaining -= allowance;
          if (remaining <= 0) { this.done = true; release(); }
          return this.done;
        },
        cancel() { this.cancelled = true; this.done = true; release(); },
      };
      if (search.done) release();
      searches.push(search);
      return search;
    },
    ...options,
  });
  return { scheduler, created, steps, searches, get live() { return live; }, get maxLive() { return maxLive; } };
}

function request(scheduler, id, work = 100, priority = 'background', callback = () => {}, extra = {}) {
  return scheduler.request({
    grid: { id, work, ...extra }, start: { x: 0, y: 0 }, goal: { x: 3, y: 0 }, priority,
  }, callback);
}

describe('pathfinding scheduler', () => {
  test('requests allocate no search until pumped and cancelled queue entries never dispatch', () => {
    const h = harness();
    let callbacks = 0;
    const handles = Array.from({ length: 1000 }, (_, i) => request(h.scheduler, i, 2, 'background', () => callbacks++));
    assert.equal(h.created.length, 0);
    for (const handle of handles) {
      assert.equal(handle.status, 'pending');
      assert.equal(handle.cancel(), true);
      assert.equal(handle.cancel(), false);
      assert.equal(handle.status, 'cancelled');
    }
    h.scheduler.pump();
    assert.equal(h.created.length, 0);
    assert.equal(callbacks, 0);
    assert.equal(h.scheduler.getStats().pending, 0);
    assert.equal(h.scheduler.getStats().queuedBackground, 0);
    request(h.scheduler, 'new', 2);
    h.scheduler.pump();
    assert.equal(h.created.length, 1);
  });

  test('background work remains FIFO and cancelled middle entries unlink cleanly', () => {
    const h = harness();
    const completed = [];
    request(h.scheduler, 'A', 4, 'background', () => completed.push('A'));
    const cancelled = request(h.scheduler, 'B', 2, 'background', () => completed.push('B'));
    request(h.scheduler, 'C', 2, 'background', () => completed.push('C'));
    cancelled.cancel();
    h.scheduler.pump();
    assert.deepEqual(completed, ['A', 'C']);
    assert.deepEqual(h.steps.map(step => step.id), ['A', 'A', 'C']);
    assert.equal(h.maxLive, 1);
  });

  test('player searches preempt remaining work while each pump gives background a batch', () => {
    const h = harness();
    request(h.scheduler, 'background');
    h.scheduler.pump();
    request(h.scheduler, 'player', 100, 'player');
    request(h.scheduler, 'next-player', 100, 'player');
    h.steps.length = 0;
    h.scheduler.pump();
    h.scheduler.pump();
    assert.deepEqual(h.steps.map(step => step.id), ['background', 'player', 'player', 'background', 'player', 'player']);
    assert.equal(h.maxLive, 2);
    assert.equal(h.created.length, 2);
    assert.equal(h.scheduler.getStats().queuedPlayer, 1);
    assert.equal(h.scheduler.getStats().activeBackground, 1);
    assert.equal(h.scheduler.getStats().activePlayer, 1);
  });

  test('elapsed deadline stops dispatch after a slow batch and work cap bounds a frozen clock', () => {
    const timed = harness();
    request(timed.scheduler, 'slow', 100, 'background', () => {}, { stepMs: 3 });
    timed.scheduler.pump();
    assert.equal(timed.steps.length, 1);
    assert.equal(timed.scheduler.getStats().lastPumpMs, 3);
    const capped = harness({ stepSize: 4, maxStepsPerTick: 10 });
    request(capped.scheduler, 'capped');
    capped.scheduler.pump();
    assert.deepEqual(capped.steps.map(step => step.allowance), [4, 4, 2]);
    assert.equal(capped.scheduler.getStats().lastPumpSteps, 10);
  });

  test('immediately completed searches cannot bypass the work cap', () => {
    const h = harness();
    for (let i = 0; i < 100; i++) request(h.scheduler, i, 0);
    h.scheduler.pump();
    assert.equal(h.created.length, 3);
    assert.equal(h.scheduler.getStats().completed, 3);
    assert.equal(h.scheduler.getStats().pending, 97);
  });

  test('cancelling active searches releases buffers and cancelAll includes queued work', () => {
    const h = harness();
    let callbacks = 0;
    const background = request(h.scheduler, 'background', 100, 'background', () => callbacks++);
    const player = request(h.scheduler, 'player', 100, 'player', () => callbacks++);
    const queued = request(h.scheduler, 'queued', 100, 'background', () => callbacks++);
    h.scheduler.pump();
    assert.equal(h.live, 2);
    assert.equal(background.cancel(), true);
    assert.equal(h.searches[0].cancelled, true);
    h.scheduler.cancelAll();
    assert.equal(player.status, 'cancelled');
    assert.equal(queued.status, 'cancelled');
    assert.equal(h.live, 0);
    assert.equal(h.scheduler.getStats().pending, 0);
    assert.equal(h.scheduler.getStats().queuedBackground, 0);
    assert.equal(h.scheduler.getStats().queuedPlayer, 0);
    h.scheduler.pump();
    assert.equal(callbacks, 0);
    assert.equal(h.created.length, 2);
  });

  test('completion callbacks receive paths once and thrown callbacks leave scheduler usable', () => {
    const h = harness();
    let callbacks = 0;
    const handle = request(h.scheduler, 'throws', 2, 'background', path => {
      callbacks++;
      assert.deepEqual(path, [{ x: 3, y: 0 }]);
      assert.equal(handle.status, 'completed');
      throw new Error('callback failed');
    });
    assert.throws(() => h.scheduler.pump(), /callback failed/);
    assert.equal(handle.status, 'completed');
    assert.equal(handle.cancel(), false);
    assert.equal(h.scheduler.getStats().pending, 0);
    h.scheduler.pump();
    assert.equal(callbacks, 1);
    request(h.scheduler, 'next', 2);
    h.scheduler.pump();
    assert.equal(h.scheduler.getStats().completed, 2);
  });

  test('callbacks can cancel world work and reentrant pumps cannot grant another budget', () => {
    const h = harness();
    let cancelledCallbacks = 0;
    request(h.scheduler, 'first', 2, 'background', () => {
      h.scheduler.pump();
      h.scheduler.cancelAll();
    });
    const rest = request(h.scheduler, 'rest', 2, 'player', () => cancelledCallbacks++);
    h.scheduler.pump();
    assert.equal(rest.status, 'cancelled');
    assert.equal(cancelledCallbacks, 0);
    assert.equal(h.created.length, 1);
    assert.equal(h.scheduler.getStats().pumpCount, 1);
  });

  test('dispatch snapshots coordinates and forwards the original world and traversal inputs', () => {
    const h = harness();
    const grid = { id: 'world', work: 2 };
    const elevationMap = [[0]];
    const baseDiff = { Grass: 7 };
    const portCities = [{ x: 1, y: 1 }];
    const start = { x: 2, y: 3 };
    const goal = { x: 4, y: 5 };
    h.scheduler.request({ grid, start, goal, elevationMap, baseDiff, portCities, allowWater: true, waterOnly: true }, () => {});
    start.x = 99;
    goal.y = 99;
    h.scheduler.pump();
    assert.equal(h.created[0].grid, grid);
    assert.equal(h.created[0].costs.elevationMap, elevationMap);
    assert.equal(h.created[0].costs.baseDiff, baseDiff);
    assert.equal(h.created[0].portCities, portCities);
    assert.deepEqual(h.created[0].start, { x: 2, y: 3 });
    assert.deepEqual(h.created[0].goal, { x: 4, y: 5 });
    assert.equal(h.created[0].allowWater, true);
    assert.equal(h.created[0].waterOnly, true);
  });

  test('integrates with incremental A* over multiple bounded pumps', () => {
    const grid = [Array.from({ length: 40 }, () => ({ options: ['Grass'] }))];
    const scheduler = createPathfindingScheduler({ createSearch: createPathSearch, now: () => 0, stepSize: 3, maxStepsPerTick: 9 });
    let result = null;
    const handle = scheduler.request({
      grid, start: { x: 0, y: 0 }, goal: { x: 39, y: 0 },
      elevationMap: [Array(40).fill(0)], baseDiff: { Grass: 1 }, priority: 'player',
    }, path => { result = path; });
    scheduler.pump();
    assert.equal(handle.status, 'pending');
    for (let i = 0; i < 100 && handle.status === 'pending'; i++) {
      assert(scheduler.pump().lastPumpSteps <= 9);
    }
    assert.equal(handle.status, 'completed');
    assert.equal(result.length, 39);
    assert.deepEqual(result[result.length - 1], { x: 39, y: 0 });
    assert.equal(scheduler.getStats().pending, 0);
  });

  test('request-specific search factories share the same lazy scheduling and cancellation', () => {
    const h = harness();
    let overrideCalls = 0;
    const customPath = [{ x: 2, y: 0 }];
    const opts = {
      grid: {}, start: { x: 0, y: 0 }, goal: { x: 2, y: 0 },
      createSearch(grid, start, goal) {
        overrideCalls++;
        assert.equal(grid, opts.grid);
        assert.deepEqual(start, { x: 0, y: 0 });
        assert.deepEqual(goal, { x: 2, y: 0 });
        return { done: true, result: customPath, step() {}, cancel() {} };
      },
    };
    let received;
    const cancelled = h.scheduler.request(opts, () => { throw new Error('Cancelled override callback'); });
    cancelled.cancel();
    const completed = h.scheduler.request(opts, result => { received = result; });
    assert.equal(overrideCalls, 0);
    h.scheduler.pump();
    assert.equal(completed.status, 'completed');
    assert.equal(overrideCalls, 1);
    assert.equal(h.created.length, 0);
    assert.equal(received, customPath);
  });
});
