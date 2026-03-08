const { EventSystem } = require("../../Koz_Engine_Lib/events/eventSystem");

describe("Koz_Engine_Lib/events/eventSystem", () => {
  test("exports EventSystem constructor", () => {
    expect(typeof EventSystem).toBe("function");
  });
});
