const {
  isTouchMobile,
  clampZoom,
  cycleIndex,
  beginPinchGesture,
  updatePinchGesture,
  mapClientToCanvas,
} = require("../../Koz_Engine_Lib/UI/mobileInput");

describe("Koz_Engine_Lib/UI/mobileInput", () => {
  test("detects touch-mobile under max width", () => {
    expect(isTouchMobile({ hasTouch: true, maxTouchPoints: 0, width: 800, maxWidth: 1024 })).toBe(true);
    expect(isTouchMobile({ hasTouch: false, maxTouchPoints: 0, width: 800, maxWidth: 1024 })).toBe(false);
  });

  test("detects phones from user agent when touch APIs are unreliable", () => {
    expect(isTouchMobile({
      hasTouch: false,
      maxTouchPoints: 0,
      width: 390,
      visualViewportWidth: 390,
      screenWidth: 390,
      screenHeight: 844,
      maxWidth: 1024,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
    })).toBe(true);
  });

  test("detects iPadOS desktop user agents using platform plus touch points", () => {
    expect(isTouchMobile({
      hasTouch: false,
      maxTouchPoints: 5,
      width: 1180,
      visualViewportWidth: 1180,
      screenWidth: 1180,
      screenHeight: 820,
      maxWidth: 1024,
      coarsePointer: true,
      anyCoarsePointer: true,
      hoverNone: true,
      anyHoverNone: true,
      platform: "MacIntel",
    })).toBe(true);
  });

  test("does not classify large touch laptops as mobile", () => {
    expect(isTouchMobile({
      hasTouch: true,
      maxTouchPoints: 10,
      width: 1440,
      visualViewportWidth: 1440,
      screenWidth: 1440,
      screenHeight: 900,
      maxWidth: 1024,
      coarsePointer: false,
      anyCoarsePointer: false,
      hoverNone: false,
      anyHoverNone: false,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
      platform: "Win32",
    })).toBe(false);
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

  test("updates pinch gesture zoom and pan state", () => {
    const state = beginPinchGesture({
      touches: [
        { clientX: 0, clientY: 0 },
        { clientX: 100, clientY: 0 },
      ],
      currentZoom: 1,
    });

    const next = updatePinchGesture(state, {
      touches: [
        { clientX: 10, clientY: 10 },
        { clientX: 130, clientY: 10 },
      ],
      currentZoom: 1,
      camX: 20,
      camY: 40,
      zoomOptions: { min: 0.15, max: 2, snap: 1, snapEpsilon: 0.03 },
    });

    expect(next.active).toBe(true);
    expect(next.zoom).toBeCloseTo(1.2);
    expect(next.camX).toBeCloseTo(20 - (20 / 1.2));
    expect(next.camY).toBeCloseTo(40 - (10 / 1.2));
  });

  test("maps client coordinates into canvas coordinates", () => {
    const mapped = mapClientToCanvas({
      clientX: 60,
      clientY: 45,
      rect: { left: 10, top: 5, width: 100, height: 50 },
      bufferWidth: 200,
      bufferHeight: 100,
    });

    expect(mapped).toEqual({ x: 100, y: 80 });
  });
});
