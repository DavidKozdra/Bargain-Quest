const {
  computeStageCosts,
  resolveCurrentStage,
} = require("../../Koz_Engine_Lib/systems/stagedAcquisition");

describe("Koz_Engine_Lib/systems/stagedAcquisition (generic)", () => {
  test("computes bounded stage costs from config", () => {
    const out = computeStageCosts({
      baseValue: 99999999,
      baseFloor: 300,
      stages: [
        { key: "a", ratio: 0.2, min: 200, max: 20000 },
        { key: "b", ratio: 0.35, min: 350 },
      ],
    });

    expect(out.a).toBe(20000);
    expect(out.b).toBeGreaterThanOrEqual(350);
  });

  test("resolves first incomplete stage", () => {
    const stage = resolveCurrentStage({
      stages: ["offer", "bank", "shop"],
      completedKeys: ["offer"],
      forceComplete: false,
    });
    expect(stage.key).toBe("bank");
    expect(stage.completedCount).toBe(1);
    expect(stage.total).toBe(3);
  });
});

