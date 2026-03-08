const { SpatialGrid } = require("../../Koz_Engine_Lib/Core/spatialGrid");

describe("Koz_Engine_Lib/Core/spatialGrid", () => {
  test("inserts and queries viewport", () => {
    const grid = new SpatialGrid(10);
    const ent = {};
    grid.insert(ent, 5, 5);
    const found = grid.queryViewport({ minX: 0, maxX: 100, minY: 0, maxY: 100, tileSize: 1 });
    expect(found.includes(ent)).toBe(true);
  });
});
