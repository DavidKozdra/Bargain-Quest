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

  test("supports enter/exit aliases when states are registered", () => {
    const gsm = new GameStateManager();
    const entered = jest.fn();
    const exited = jest.fn();

    gsm.addState("A", { exit: exited });
    gsm.addState("B", { enter: entered });
    gsm.setState("A");
    gsm.setState("B");

    expect(exited).toHaveBeenCalledTimes(1);
    expect(entered).toHaveBeenCalledTimes(1);
  });
});
