const {
  isTouchMobile,
  clampZoom,
  cycleIndex,
  beginPinchGesture,
  updatePinchGesture,
  mapClientToCanvas,
} = require("../../Koz_Engine_Lib/input/mobileInput");

describe("Koz_Engine_Lib/input/mobileInput", () => {
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
    expect(next.camX).toBe(10);
    expect(next.camY).toBe(30);
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
