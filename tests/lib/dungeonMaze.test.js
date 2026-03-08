const { generateDungeonMaze } = require("../../Koz_Engine_Lib/World/dungeonMaze");

describe("Koz_Engine_Lib/World/dungeonMaze", () => {
  test("generates a dungeon grid with start, exit, and rooms", () => {
    let seed = 12345;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };

    const out = generateDungeonMaze({
      cols: 21,
      rows: 21,
      rng,
      roomAttempts: 6,
      roomMinSize: 3,
      roomMaxSize: 5,
      wallTile: "#",
      floorTile: ".",
    });

    expect(out.grid).toHaveLength(21);
    expect(out.grid[0]).toHaveLength(21);
    expect(out.start).not.toBe(null);
    expect(out.exit).not.toBe(null);
    expect(out.rooms.length).toBeGreaterThan(0);
    expect(out.grid[out.start.y][out.start.x]).toBe(".");
  });
});
