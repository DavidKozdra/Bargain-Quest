const { GameStateManager } = require("../../Koz_Engine_Lib/Core/gameStateManager");

describe("Koz_Engine_Lib/Core/gameStateManager", () => {
  test("enforces transition rules", () => {
    const gsm = new GameStateManager();
    gsm.addState("A", {});
    gsm.addState("B", {});
    gsm.setTransitionRules({ A: ["B"] });
    gsm.setState("A");
    gsm.setState("B");
    expect(gsm.getState()).toBe("B");
  });
});
