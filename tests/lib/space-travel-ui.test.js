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

  test("spaceTravelHUD show and hide toggle the screen element visibility", () => {
    const screenEl = {};
    screenEl.show = jest.fn(() => screenEl);
    screenEl.hide = jest.fn(() => screenEl);
    screenEl.addClass = jest.fn(() => screenEl);
    screenEl.removeClass = jest.fn(() => screenEl);
    screenEl.html = jest.fn(() => screenEl);
    screenEl.style = jest.fn(() => screenEl);
    const context = {
      console,
      Math,
      Date,
      Map,
      Set,
      performance: { now: () => 0 },
      window: {
        _spaceTravelSystem: {
          phase: "landed",
          getCurrentSurfaceState: () => ({ mode: "earth_world" }),
        },
      },
      GameStates: {
        SPACE: "SPACE",
        PLAYING: "PLAYING",
        CITY_MANAGE: "CITY_MANAGE",
      },
      uiManager: {
        registerScreen: jest.fn(),
      },
      select: jest.fn((selector) => (selector === "#spaceTravelUI" ? screenEl : null)),
    };
    context.global = context;
    context.globalThis = context;

    loadBrowserScript("ui/spaceTravel.js", context);
    const spec = context.uiManager.registerScreen.mock.calls[0][1];

    spec.show();
    expect(screenEl.show).toHaveBeenCalledTimes(1);
    expect(screenEl.addClass.mock.calls).toEqual([["screen-visible"]]);

    spec.hide();
    expect(screenEl.removeClass.mock.calls).toEqual([["screen-visible"]]);
    expect(screenEl.hide).toHaveBeenCalledTimes(1);
  });
});
