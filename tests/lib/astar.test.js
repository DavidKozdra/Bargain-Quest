"use strict";

const { aStar, createPathSearch } = require("../../Koz_Engine_Lib/AI/astar.js");

function makeGrid(rows, cols, type = "Water") {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ options: [type] }))
  );
}

describe("A* pathfinding", () => {
  beforeEach(() => {
    global.baseDiff = { Grass: 1 };
  });

  afterEach(() => {
    delete global.baseDiff;
    delete global.elevationMap;
  });

  test("finds a connected land path whose curved route is much longer than the direct distance", () => {
    const rows = 3;
    const cols = 100;
    const grid = makeGrid(rows, cols);
    global.elevationMap = Array.from({ length: rows }, () => Array(cols).fill(0));

    // A long U-shaped corridor. Start and goal are only two tiles apart, but
    // reaching the goal requires walking to the far edge and back.
    for (let x = 0; x < cols; x++) {
      grid[0][x].options[0] = "Grass";
      grid[2][x].options[0] = "Grass";
    }
    grid[1][cols - 1].options[0] = "Grass";

    const path = aStar(grid, { x: 0, y: 0 }, { x: 2, y: 2 });

    expect(path).toHaveLength((cols - 1) + 2 + (cols - 1 - 2));
    expect(path[path.length - 1]).toEqual({ x: 2, y: 2 });
  });

  test("weighted terrain and elevation still favor the same detour", () => {
    const grid = makeGrid(3, 5, 'Grass');
    global.elevationMap = Array.from({ length: 3 }, () => Array(5).fill(0));
    for (let x = 1; x < 4; x++) global.elevationMap[1][x] = 100;
    expect(aStar(grid, { x: 0, y: 1 }, { x: 4, y: 1 })).toEqual([
      { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 },
      { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 1 },
    ]);
  });

  test("port gates and water-only traversal retain their permissions", () => {
    const grid = makeGrid(1, 8);
    grid[0][0].options[0] = 'Grass';
    grid[0][7].options[0] = 'Grass';
    global.elevationMap = [Array(8).fill(0)];
    const start = { x: 0, y: 0 }, goal = { x: 7, y: 0 };
    expect(aStar(grid, start, goal)).toEqual([]);
    expect(aStar(grid, start, goal, true, [])).toEqual([]);
    expect(aStar(grid, start, goal, true, [{ x: 0, y: 0 }])).toEqual([]);
    const ports = [{ x: 0, y: 0 }, { x: 7, y: 0 }];
    expect(aStar(grid, start, goal, true, ports)).toHaveLength(7);
    expect(aStar(grid, start, goal, true, ports, true)).toEqual([]);
    expect(aStar(grid, { x: 1, y: 0 }, { x: 6, y: 0 }, true, null, true)).toHaveLength(5);
  });

  test("steps bound actual terrain visits on an unreachable map", () => {
    let terrainReads = 0;
    const grass = { get options() { terrainReads++; return ['Grass']; } };
    const water = { get options() { terrainReads++; return ['Water']; } };
    const grid = Array.from({ length: 20 }, () => Array(20).fill(grass));
    for (const row of grid) row[10] = water;
    global.elevationMap = Array.from({ length: 20 }, () => Array(20).fill(0));
    const search = createPathSearch(grid, { x: 1, y: 1 }, { x: 18, y: 1 });
    let steps = 0;
    while (!search.done) {
      terrainReads = 0;
      const previousWork = search.processedWork;
      search.step(7);
      expect(search.processedWork - previousWork).toBeLessThanOrEqual(7);
      expect(terrainReads).toBeLessThanOrEqual(7 * 5);
      steps++;
    }
    expect(steps).toBeGreaterThan(20);
    expect(search.expandedNodes).toBe(200);
    expect(search.result).toEqual([]);
    expect(search.allocatedCells).toBe(0);
  });

  test("port setup and long path reconstruction also yield within the work budget", () => {
    const grid = makeGrid(1, 2048, 'Grass');
    global.elevationMap = [Array(2048).fill(0)];
    const search = createPathSearch(grid, { x: 0, y: 0 }, { x: 2047, y: 0 }, false, [{ x: 0, y: 0 }]);
    search.step(24);
    expect(search.expandedNodes).toBe(0);
    expect(search.done).toBe(false);
    search.step(1);
    expect(search.expandedNodes).toBe(0);
    search.step(2048);
    expect(search.expandedNodes).toBe(2047);
    expect(search.done).toBe(false);
    expect(search.result).toBe(null);
    search.step(10);
    expect(search.done).toBe(false);
    while (!search.done) {
      const previousWork = search.processedWork;
      search.step(127);
      expect(search.processedWork - previousWork).toBeLessThanOrEqual(127);
    }
    expect(search.result).toHaveLength(2047);
    expect(search.result[0]).toEqual({ x: 1, y: 0 });
    expect(search.result[2046]).toEqual({ x: 2047, y: 0 });
  });

  test("interleaved searches own their state and capture their original world costs", () => {
    const grid = makeGrid(3, 5, 'Grass');
    const elevations = Array.from({ length: 3 }, () => Array(5).fill(0));
    elevations[1][1] = elevations[1][2] = elevations[1][3] = 100;
    global.elevationMap = elevations;
    const start = { x: 0, y: 1 }, goal = { x: 4, y: 1 };
    const expected = aStar(grid, start, goal);
    const first = createPathSearch(grid, start, goal);
    // A new world activates while this job is suspended. Its elevations and
    // mutated request coordinates must not change the first job's route.
    global.elevationMap = [[0, 0, 0, 0]];
    start.x = 4;
    goal.y = 2;
    const second = createPathSearch(makeGrid(1, 4, 'Grass'), { x: 3, y: 0 }, { x: 0, y: 0 });
    while (!first.done || !second.done) {
      first.step(1);
      second.step(2);
    }
    expect(first.result).toEqual(expected);
    expect(second.result).toEqual([{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }]);
  });

  test("large worlds allocate local search pages and cancellation releases them", () => {
    const row = Array(1500).fill({ options: ['Grass'] });
    const grid = Array(1500).fill(row);
    const search = createPathSearch(grid, { x: 10, y: 10 }, { x: 1490, y: 1490 }, false, null, false, {
      elevationMap: Array(1500).fill(new Uint8Array(1500)),
      baseDiff: { Grass: 1 },
    });
    expect(search.allocatedCells).toBe(1024);
    search.step(1);
    expect(search.allocatedCells).toBeLessThan(10000);
    search.cancel();
    expect(search.done).toBe(true);
    expect(search.cancelled).toBe(true);
    expect(search.result).toEqual([]);
    expect(search.allocatedCells).toBe(0);
    const previousWork = search.processedWork;
    search.step(100);
    expect(search.processedWork).toBe(previousWork);
  });

  test("impossible destination terrain is rejected without searching a continent", () => {
    const grid = makeGrid(2, 2, 'Grass');
    grid[1][1].options[0] = 'Water';
    const search = createPathSearch(grid, { x: 0, y: 0 }, { x: 1, y: 1 });
    expect(search.done).toBe(true);
    expect(search.result).toEqual([]);
    expect(search.expandedNodes).toBe(0);
    expect(search.allocatedCells).toBe(0);
  });
});
