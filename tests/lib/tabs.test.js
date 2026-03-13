const { applyTabState } = require("../../Koz_Engine_Lib/UI/tabs");

describe("Koz_Engine_Lib/UI/tabs", () => {
  function makeClassList() {
    const names = new Set();
    return {
      add(name) { names.add(name); },
      remove(name) { names.delete(name); },
      contains(name) { return names.has(name); },
    };
  }

  function makeButton(tabValue) {
    return {
      style: {},
      classList: makeClassList(),
      getAttribute(name) {
        if (name === "data-tab") return tabValue;
        return null;
      },
    };
  }

  test("activates the selected button and hides non-active panels", () => {
    const buttons = [makeButton("overview"), makeButton("build")];
    const panels = {
      screen_overview: { style: {} },
      screen_build: { style: {} },
    };
    const fakeDocument = {
      querySelectorAll(selector) {
        return selector === ".tab-btn" ? buttons : [];
      },
      getElementById(id) {
        return panels[id] || null;
      },
    };

    applyTabState({
      tab: "build",
      defs: [{ key: "overview" }, { key: "build" }],
      btnSelector: ".tab-btn",
      panelPrefix: "screen_",
      document: fakeDocument,
    });

    expect(buttons[0].classList.contains("tab-active")).toBe(false);
    expect(buttons[1].classList.contains("tab-active")).toBe(true);
    expect(panels.screen_overview.style.display).toBe("none");
    expect(panels.screen_build.style.display).toBe("block");
  });

  test("infers tab keys from button data attributes when defs are omitted", () => {
    const buttons = [makeButton("shop"), makeButton("port")];
    const panels = {
      city_shop: { style: {} },
      city_port: { style: {} },
    };
    const fakeDocument = {
      querySelectorAll(selector) {
        return selector === ".city-tab-btn" ? buttons : [];
      },
      getElementById(id) {
        return panels[id] || null;
      },
    };

    const result = applyTabState({
      tab: "shop",
      btnSelector: ".city-tab-btn",
      panelPrefix: "city_",
      document: fakeDocument,
    });

    expect(result.tabKeys).toEqual(["shop", "port"]);
    expect(panels.city_shop.style.display).toBe("block");
    expect(panels.city_port.style.display).toBe("none");
  });
});
