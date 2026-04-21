const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadBrowserScript(relPath, context) {
  const filename = path.resolve(__dirname, "..", "..", relPath);
  const source = fs.readFileSync(filename, "utf8");
  vm.runInNewContext(source, context, { filename });
}

describe("ui/spaceTravel", () => {
  test("registers without a global player in the execution context", () => {
    const context = {
      console,
      Math,
      Date,
      Map,
      Set,
      performance: { now: () => 0 },
      window: {},
      GameStates: {
        SPACE: "SPACE",
        PLAYING: "PLAYING",
        CITY_MANAGE: "CITY_MANAGE",
      },
      uiManager: {
        registerScreen: jest.fn(),
      },
    };
    context.global = context;
    context.globalThis = context;

    expect(() => loadBrowserScript("ui/spaceTravel.js", context)).not.toThrow();
    expect(context.uiManager.registerScreen).toHaveBeenCalledTimes(1);
    expect(context.uiManager.registerScreen.mock.calls[0][0]).toBe("spaceTravelHUD");
    expect(typeof context.window.BQRunSpaceRouteQTE).toBe("function");
  });
});
