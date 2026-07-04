"use strict";

const { aStar } = require("../../Koz_Engine_Lib/AI/astar.js");

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
});
