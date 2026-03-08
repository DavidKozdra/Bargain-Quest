const { DayNightCycle } = require("../../Koz_Engine_Lib/time/dayNightCycle");

describe("Koz_Engine_Lib/time/dayNightCycle", () => {
  test("computes year/season/time strings", () => {
    const dn = new DayNightCycle(60);
    dn.setDaysElapsed(150);
    expect(dn.getYear()).toBe(2);
    expect(typeof dn.getSeason()).toBe("string");
    expect(dn.getTimeString()).toMatch(/^\d\d:\d\d$/);
  });
});
