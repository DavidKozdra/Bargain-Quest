(function initMobileInputLib(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.BQLib = root.BQLib || {};
    root.BQLib.systems = root.BQLib.systems || {};
    root.BQLib.systems.mobileInput = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createMobileInputApi() {
  function isTouchMobile(input = {}) {
    const hasTouch = !!input.hasTouch;
    const maxTouchPoints = Number(input.maxTouchPoints) || 0;
    const width = Number(input.width) || 0;
    const maxWidth = Number(input.maxWidth) || 1024;
    return (hasTouch || maxTouchPoints > 0) && width < maxWidth;
  }

  function clampZoom(value, opts = {}) {
    const min = Number(opts.min);
    const max = Number(opts.max);
    const snap = Number(opts.snap);
    const snapEpsilon = Number(opts.snapEpsilon);
    const lo = Number.isFinite(min) ? min : 0.15;
    const hi = Number.isFinite(max) ? max : 2;
    const s = Number.isFinite(snap) ? snap : 1;
    const eps = Number.isFinite(snapEpsilon) ? snapEpsilon : 0.03;
    let out = Math.min(hi, Math.max(lo, Number(value) || lo));
    if (Math.abs(out - s) < eps) out = s;
    return out;
  }

  function cycleIndex(index, length) {
    const i = Number(index) || 0;
    const len = Math.max(1, Number(length) || 1);
    return (i + 1) % len;
  }

  return {
    isTouchMobile,
    clampZoom,
    cycleIndex,
  };
});

