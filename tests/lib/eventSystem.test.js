const { EventSystem } = require("../../Koz_Engine_Lib/Events/eventSystem");

describe("Koz_Engine_Lib/Events/eventSystem", () => {
  test("exports EventSystem constructor", () => {
    expect(typeof EventSystem).toBe("function");
  });
});
