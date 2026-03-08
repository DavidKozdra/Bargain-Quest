const { TipTracker } = require("../../Koz_Engine_Lib/systems/tipTracker");

describe("Koz_Engine_Lib/systems/tipTracker", () => {
  function makeMemoryStorage() {
    const store = new Map();
    return {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
  }

  test("tracks shown tips and persistence", () => {
    const storage = makeMemoryStorage();
    const t1 = new TipTracker({ storage, storageKey: "tips" });
    expect(t1.shouldShow("a")).toBe(true);
    t1.markShown("a");
    expect(t1.shouldShow("a")).toBe(false);

    const t2 = new TipTracker({ storage, storageKey: "tips" });
    expect(t2.hasShown("a")).toBe(true);
  });

  test("force show bypasses shown-state", () => {
    const storage = makeMemoryStorage();
    const tracker = new TipTracker({ storage, storageKey: "tips2" });
    tracker.markShown("x");
    expect(tracker.shouldShow("x")).toBe(false);
    expect(tracker.shouldShow("x", { force: true })).toBe(true);
  });
});

