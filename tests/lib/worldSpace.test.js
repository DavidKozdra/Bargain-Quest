const { createWorldSpace } = require("../../Koz_Engine_Lib/World/worldSpace");

describe("Koz_Engine_Lib/World/worldSpace", () => {
  test("stores cells and placed elements in one world coordinate space", () => {
    const world = createWorldSpace({ cols: 4, rows: 3, defaultCell: "Void" });
    world.setCell(1, 1, "Grass");
    const city = world.addElement({ kind: "city", x: 1, y: 1, name: "Port" });

    expect(world.getCell(1, 1)).toBe("Grass");
    expect(world.findElementAt(1, 1, "city")).toBe(city);
  });

  test("resizing preserves cells in bounds and removes out-of-bounds elements", () => {
    const world = createWorldSpace({ cols: 3, rows: 3, defaultCell: "Water" });
    world.setCell(2, 2, "Rock");
    world.addElement({ kind: "city", x: 2, y: 2, name: "Edge" });
    world.addElement({ kind: "city", x: 1, y: 1, name: "Keep" });

    const out = world.resize(2, 2, { defaultCell: "Water" });

    expect(world.cols).toBe(2);
    expect(world.rows).toBe(2);
    expect(world.getCell(1, 1)).toBe("Water");
    expect(out.removedElements).toHaveLength(1);
    expect(world.listElements("city")).toHaveLength(1);
  });
});
