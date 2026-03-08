const { EventSystem } = require("../../Koz_Engine_Lib/systems/eventSystem");

describe("Koz_Engine_Lib/systems/eventSystem", () => {
  test("exports EventSystem constructor", () => {
    expect(typeof EventSystem).toBe("function");
  });
});
