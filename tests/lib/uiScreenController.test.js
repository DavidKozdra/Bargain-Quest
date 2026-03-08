const { UIScreenController } = require("../../Koz_Engine_Lib/core/uiScreenController");

describe("Koz_Engine_Lib/core/uiScreenController", () => {
  function makeContainer() {
    return {
      shown: false,
      show() { this.shown = true; },
      hide() { this.shown = false; },
    };
  }

  test("registers screens and toggles by state", () => {
    const ui = new UIScreenController(console);
    const c = makeContainer();
    ui.registerScreen("menu", {
      create: () => c,
      validStates: ["MENU"],
    });
    ui.onStateChange("MENU");
    expect(c.shown).toBe(true);
    expect(ui.activeScreens.has("menu")).toBe(true);
    ui.onStateChange("PLAYING");
    expect(c.shown).toBe(false);
    expect(ui.activeScreens.has("menu")).toBe(false);
  });
});

