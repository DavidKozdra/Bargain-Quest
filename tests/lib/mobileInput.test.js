const { isTouchMobile, clampZoom, cycleIndex } = require("../../Koz_Engine_Lib/systems/mobileInput");

describe("Koz_Engine_Lib/systems/mobileInput", () => {
  test("detects touch-mobile under max width", () => {
    expect(isTouchMobile({ hasTouch: true, maxTouchPoints: 0, width: 800, maxWidth: 1024 })).toBe(true);
    expect(isTouchMobile({ hasTouch: false, maxTouchPoints: 0, width: 800, maxWidth: 1024 })).toBe(false);
  });

  test("clamps and snaps zoom", () => {
    expect(clampZoom(0.01, { min: 0.15, max: 2 })).toBe(0.15);
    expect(clampZoom(2.5, { min: 0.15, max: 2 })).toBe(2);
    expect(clampZoom(0.99, { min: 0.15, max: 2, snap: 1, snapEpsilon: 0.03 })).toBe(1);
  });

  test("cycles index safely", () => {
    expect(cycleIndex(0, 3)).toBe(1);
    expect(cycleIndex(2, 3)).toBe(0);
  });
});

