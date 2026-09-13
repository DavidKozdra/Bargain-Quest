const assert = require('node:assert/strict');
const { createWorldConnectivity } = require('../../Koz_Engine_Lib/AI/worldConnectivity');
const { createPathSearch } = require('../../Koz_Engine_Lib/AI/astar');

function terrain(lines) {
  return lines.map(line => Array.from(line, type => type === '#' ? null : { options: [type === '~' ? 'Water' : 'Grass'] }));
}

function finish(index, allowance = 7) {
  let iterations = 0;
  while (!index.done) {
    const before = index.processedWork;
    index.step(allowance);
    assert(index.processedWork - before <= allowance);
    assert.equal(index.getStats().lastStepWork, index.processedWork - before);
    assert(++iterations < 100000, 'Connectivity build must terminate');
  }
  return index;
}

function routeExists(grid, start, goal, allowWater = false, ports = null, waterOnly = false) {
  const search = createPathSearch(grid, start, goal, allowWater, ports, waterOnly, {
    elevationMap: grid.map(row => row.map(() => 0)), baseDiff: { Grass: 1 },
  });
  search.step(Infinity);
  return search.result.length > 0;
}

describe('incremental world connectivity', () => {
  test('constructor and queries do not scan terrain, and each step obeys its work allowance', () => {
    let reads = 0;
    const grid = Array.from({ length: 15 }, (_, y) => Array.from({ length: 17 }, (_, x) => ({
      get options() { reads++; return [x === 8 ? 'Water' : 'Grass']; },
    })));
    const index = createWorldConnectivity(grid, [{ x: 8, y: 7 }]);
    assert.equal(reads, 0);
    assert.equal(index.done, false);
    assert.equal(index.canReach({ x: 0, y: 0 }, { x: 16, y: 14 }), true);
    for (const badBudget of [0, -1, NaN, -Infinity]) assert.equal(index.step(badBudget), false);
    assert.equal(index.processedWork, 0);
    let iterations = 0;
    while (!index.done) {
      const before = index.processedWork, beforeReads = reads;
      const allowance = iterations % 11 + 1;
      index.step(allowance);
      assert(index.processedWork - before <= allowance);
      assert(reads - beforeReads <= allowance);
      assert(++iterations < 10000);
    }
    assert.equal(reads, 15 * 17, 'Each terrain cell is classified exactly once');
    assert.equal(index.getStats().classifiedTiles, 15 * 17);
    const after = reads;
    assert.equal(index.canReach({ x: 0, y: 0 }, { x: 16, y: 14 }), false);
    assert.equal(reads, after, 'Queries only inspect labels');
    assert.equal(index.step(10), true);
    assert.equal(index.getStats().lastStepWork, 0);
  });

  test('separates land and water components without allowing diagonal or row-wrap edges', () => {
    const grid = terrain(['.~.', '~.~', '.~.']);
    const index = finish(createWorldConnectivity(grid));
    assert.equal(index.getStats().componentCount, 9);
    assert.equal(index.canReach({ x: 0, y: 0 }, { x: 1, y: 1 }), false);
    assert.equal(index.canReach({ x: 1, y: 0 }, { x: 0, y: 1 }, true, null, true), false);
    const wrap = finish(createWorldConnectivity(terrain(['~.', '.~'])));
    assert.equal(wrap.canReach({ x: 1, y: 0 }, { x: 0, y: 1 }), false);
    const connected = finish(createWorldConnectivity(terrain(['..~', '.~~', '..~'])));
    assert.equal(connected.canReach({ x: 0, y: 0 }, { x: 1, y: 2 }), true);
    assert.equal(connected.canReach({ x: 2, y: 0 }, { x: 1, y: 1 }, true, null, true), true);
  });

  test('port squares gate the land endpoint, including square corners and exact radius', () => {
    const grid = terrain(['...~...', '...~...', '...~...', '...~...', '...~...']);
    const start = { x: 2, y: 2 }, goal = { x: 3, y: 2 };
    const cornerPorts = [{ x: 0, y: 0 }];
    const corner = finish(createWorldConnectivity(grid, cornerPorts), 1);
    assert.equal(corner.canReach(start, goal, true, cornerPorts), true);
    assert.equal(routeExists(grid, start, goal, true, cornerPorts), true);
    // The right land component starts at x=4: it is three tiles from x=7.
    // Water may lie in another port square, but only the land endpoint gates.
    const distantPorts = [{ x: 7, y: 2 }];
    const distant = finish(createWorldConnectivity(grid, distantPorts));
    assert.equal(distant.canReach({ x: 4, y: 2 }, goal, true, distantPorts), false);
    assert.equal(routeExists(grid, { x: 4, y: 2 }, goal, true, distantPorts), false);
    const waterSidePorts = [{ x: 5, y: 2 }];
    const waterSide = finish(createWorldConnectivity(grid, waterSidePorts));
    assert.equal(waterSide.canReach(start, goal, true, waterSidePorts), false);
    assert.equal(routeExists(grid, start, goal, true, waterSidePorts), false);
  });

  test('boat component unions require an allowed entry and exit, and empty ports prohibit crossings', () => {
    const grid = terrain(['..~~~~~..']);
    const start = { x: 0, y: 0 }, goal = { x: 8, y: 0 };
    const onePort = [{ x: 0, y: 0 }];
    const one = finish(createWorldConnectivity(grid, onePort));
    assert.equal(one.canReach(start, goal, true, onePort), false);
    const twoPorts = [{ x: 0, y: 0 }, { x: 8, y: 0 }];
    const two = finish(createWorldConnectivity(grid, twoPorts));
    assert.equal(two.canReach(start, goal, true, twoPorts), true);
    assert.equal(routeExists(grid, start, goal, true, twoPorts), true);
    const emptyPorts = [];
    const empty = finish(createWorldConnectivity(grid, emptyPorts));
    assert.equal(empty.canReach(start, goal, true, emptyPorts), false);
    assert.equal(empty.canReach({ x: 2, y: 0 }, { x: 6, y: 0 }, true, emptyPorts), true);
    assert.equal(empty.canReach(start, goal, true, null), true, 'Unrestricted boats are not falsely rejected');
    assert.equal(empty.canReach(start, goal, true, []), true, 'An uncaptured port topology remains unknown');
    emptyPorts.push({ x: 4, y: 0 });
    assert.equal(empty.canReach(start, goal, true, emptyPorts), true, 'Changed port length invalidates boat rejections');
  });

  test('forbidden starts, invalid coordinates, holes, and malformed ports are conservative', () => {
    const grid = terrain(['.~~.']);
    const index = finish(createWorldConnectivity(grid));
    assert.equal(index.canReach({ x: 1, y: 0 }, { x: 0, y: 0 }), true);
    assert.equal(routeExists(grid, { x: 1, y: 0 }, { x: 0, y: 0 }), true);
    assert.equal(index.canReach({ x: 0, y: 0 }, { x: 2, y: 0 }, true, null, true), true);
    assert.equal(routeExists(grid, { x: 0, y: 0 }, { x: 2, y: 0 }, true, null, true), true);
    assert.equal(index.canReach({ x: 0, y: 0 }, { x: 1, y: 0 }), false);
    assert.equal(index.canReach({ x: 1, y: 0 }, { x: 0, y: 0 }, true, null, true), false);
    assert.equal(index.canReach({ x: 1, y: 0 }, { x: 2, y: 0 }, false, null, true), false);
    assert.equal(index.canReach({ x: 0, y: 0 }, { x: 0, y: 0 }), true);
    for (const invalid of [null, {}, { x: -1, y: 0 }, { x: 1.5, y: 0 }, { x: 0, y: 5 }]) {
      assert.equal(index.canReach(invalid, { x: 0, y: 0 }), true);
      assert.equal(index.canReach({ x: 0, y: 0 }, invalid), true);
    }
    const holes = finish(createWorldConnectivity(terrain(['.#.'])));
    assert.equal(holes.canReach({ x: 0, y: 0 }, { x: 2, y: 0 }), false);
    assert.equal(holes.canReach({ x: 1, y: 0 }, { x: 2, y: 0 }), true);
    const ragged = finish(createWorldConnectivity([terrain(['...'])[0], undefined, terrain(['.'])[0]]));
    assert.equal(ragged.canReach({ x: 0, y: 0 }, { x: 0, y: 2 }), false);
    const malformedPorts = [{ x: 0.5, y: 0 }];
    const malformed = finish(createWorldConnectivity(grid, malformedPorts));
    assert.equal(malformed.canReach({ x: 0, y: 0 }, { x: 3, y: 0 }, true, malformedPorts), true);
    assert.equal(malformed.getStats().portsReliable, false);
    assert.equal(finish(createWorldConnectivity([])).canReach({ x: 0, y: 0 }, { x: 1, y: 0 }), true);
  });

  test('port processing is incremental and union-find flattening retains transitive routes', () => {
    const grid = terrain(['.~.~.~.~.~.~.~.~.~.~.']);
    let portReads = 0;
    const ports = Array.from({ length: 20 }, (_, x) => ({
      get x() { portReads++; return x; }, get y() { portReads++; return 0; },
    }));
    const index = createWorldConnectivity(grid, ports);
    assert.equal(portReads, 0);
    let unionSteps = 0, flattenSteps = 0;
    while (!index.done) {
      const before = portReads;
      const phase = index.getStats().phase;
      index.step(1);
      assert.equal(index.getStats().lastStepWork, 1);
      assert(portReads - before <= 2, 'At most one port is initialized per unit');
      if (phase === 'findA' || phase === 'findB') unionSteps++;
      if (phase === 'flatten') flattenSteps++;
    }
    assert(unionSteps > 0);
    assert(flattenSteps >= index.getStats().componentCount);
    assert.equal(index.canReach({ x: 0, y: 0 }, { x: 20, y: 0 }, true, ports), true);
    assert.equal(index.getStats().portsProcessed, ports.length);
    assert.equal(index.getStats().queueBytes, 0);
    assert.equal(index.getStats().unionBytes, 4 * (index.getStats().componentCount + 1));
  });

  test('paged flood queue releases consumed storage and cancellation frees all typed buffers', () => {
    const grid = Array.from({ length: 70 }, () => Array.from({ length: 70 }, () => ({ options: ['Grass'] })));
    const index = createWorldConnectivity(grid);
    index.step(4000);
    assert.equal(index.done, false);
    assert(index.getStats().peakQueueLength > 0);
    assert(index.getStats().queueBytes > 0);
    index.cancel();
    assert.equal(index.done, true);
    assert.equal(index.getStats().cancelled, true);
    assert.equal(index.getStats().allocatedBytes, 0);
    const before = index.processedWork;
    assert.equal(index.step(100), true);
    assert.equal(index.processedWork, before);
    assert.equal(index.canReach({ x: 0, y: 0 }, { x: 69, y: 69 }), true);
    index.cancel();
    const completed = finish(createWorldConnectivity(grid), 100);
    assert.equal(completed.getStats().componentCount, 1);
    assert.equal(completed.getStats().queueBytes, 0);
    assert.equal(completed.getStats().allocatedBytes, 70 * 70 * 4);
    assert.equal(completed.canReach({ x: 0, y: 0 }, { x: 69, y: 69 }), true);
    completed.cancel();
    assert.equal(completed.getStats().allocatedBytes, 0);
  });

  test('seeded terrain and ports agree with actual A* reachability for ordinary starts', () => {
    let seed = 0x51ab29;
    function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; }
    for (let fixture = 0; fixture < 30; fixture++) {
      const grid = Array.from({ length: 8 }, () => Array.from({ length: 9 }, () => ({
        options: [random() < 0.45 ? 'Water' : 'Grass'],
      })));
      const ports = Array.from({ length: fixture % 4 }, () => ({ x: Math.floor(random() * 9), y: Math.floor(random() * 8) }));
      const index = finish(createWorldConnectivity(grid, ports));
      for (let sample = 0; sample < 20; sample++) {
        const start = { x: Math.floor(random() * 9), y: Math.floor(random() * 8) };
        const goal = { x: Math.floor(random() * 9), y: Math.floor(random() * 8) };
        if (start.x === goal.x && start.y === goal.y) continue;
        const startWater = grid[start.y][start.x].options[0] === 'Water';
        for (const [allowWater, waterOnly] of [[false, false], [true, true], [true, false]]) {
          const actual = routeExists(grid, start, goal, allowWater, ports, waterOnly);
          const predicted = index.canReach(start, goal, allowWater, ports, waterOnly);
          const unusualStart = (!allowWater && startWater) || (waterOnly && !startWater);
          if (unusualStart) assert.equal(predicted, true, 'Forbidden starts remain conservative');
          else assert.equal(predicted, actual, JSON.stringify({ fixture, start, goal, allowWater, waterOnly, ports }));
          if (!predicted) assert.equal(actual, false, 'Never reject an existing route');
        }
      }
    }
  });
});
