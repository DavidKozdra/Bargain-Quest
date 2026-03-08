const {
  createField,
  smoothField,
  normalizeField,
  classifyField,
  buildWorldCells,
} = require("../../Koz_Engine_Lib/World/worldGenerators");

describe("Koz_Engine_Lib/World/worldGenerators", () => {
  test("builds and classifies scalar fields", () => {
    const field = createField(3, 2, (x, y) => x + y);
    const normalized = normalizeField(field);
    const cells = classifyField(normalized, (value) => value >= 0.5 ? "Land" : "Water");

    expect(field[1][2]).toBe(3);
    expect(normalized[0][0]).toBe(0);
    expect(cells[1][2]).toBe("Land");
  });

  test("supports smoothing and one-pass terrain classification", () => {
    const smoothed = smoothField([[0, 1, 0], [1, 1, 1], [0, 1, 0]], 1);
    const cells = buildWorldCells(2, 2, {
      sample: (x, y) => x + y,
      smoothingPasses: 0,
      classify: (value) => value > 0.5 ? "High" : "Low",
    });

    expect(smoothed[1][1]).toBeGreaterThan(smoothed[0][0]);
    expect(cells).toEqual([
      ["Low", "High"],
      ["High", "High"],
    ]);
  });
});
