const { MinigameManager } = require("../../Koz_Engine_Lib/Minigames/manager");

describe("Koz_Engine_Lib/Minigames/manager", () => {
  test("register and start minigame", () => {
    const mgr = new MinigameManager();
    let started = false;
    mgr.register("demo", () => ({
      onStart: () => { started = true; },
      update: () => "ok",
    }));

    mgr.start("demo", {});
    expect(started).toBe(true);
    expect(mgr.activeId()).toBe("demo");
    expect(mgr.update(16)).toBe("ok");
  });
});
