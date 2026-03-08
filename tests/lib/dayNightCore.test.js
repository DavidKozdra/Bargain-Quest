const dayNightCore = require("../../Koz_Engine_Lib/systems/dayNightCore");

describe("Koz_Engine_Lib/systems/dayNightCore", () => {
  test("advanceTime rolls day when wrapping around", () => {
    const prev = Math.PI * 1.95;
    const out = dayNightCore.advanceTime(prev, 20000, 60);
    expect(out.current).toBeGreaterThanOrEqual(0);
    expect(out.current).toBeLessThan(Math.PI * 2);
    expect(out.rolledDay).toBe(true);
  });

  test("getSeason and getYear are deterministic", () => {
    expect(dayNightCore.getSeason(0, 100, ["Winter", "Spring", "Summer", "Fall"]))
      .toBe("Winter");
    expect(dayNightCore.getYear(150, 100)).toBe(2);
  });
});
