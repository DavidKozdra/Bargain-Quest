const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadBrowserScript(relPath, context) {
  const filename = path.resolve(__dirname, "..", "..", relPath);
  const source = fs.readFileSync(filename, "utf8");
  vm.runInNewContext(source, context, { filename });
}

function createContext({ homeSession = null, activeSession = null } = {}) {
  const window = {
    BQ_WORLD_SESSION_KEYS: { HOMEWORLD: "homeworld" },
    BQGetWorldSession: (key) => {
      if (key === "homeworld") return homeSession;
      if (key == null) return activeSession;
      return null;
    },
  };
  const context = {
    console,
    Math,
    Date,
    Map,
    Set,
    window,
  };
  context.global = context;
  context.globalThis = context;
  return context;
}

describe("content/spacePlanets", () => {
  test("scales generated planet profiles from the homeworld session instead of the active off-world session", () => {
    const context = createContext({
      homeSession: { cols: 300, rows: 240, sessionType: "adventure_world" },
      activeSession: { cols: 72, rows: 72, sessionType: "planet_surface" },
    });

    loadBrowserScript("content/spacePlanets.js", context);

    const profile = context.window.BQGetSpacePlanetWorldProfile("orbit", {
      key: "frontier-home",
      name: "Frontier Home",
      kind: "planet",
      biome: "temperate",
    });

    expect(profile.cols).toBe(300);
    expect(profile.rows).toBe(240);
    expect(profile.cityCount).toBeGreaterThan(5);
  });

  test("tracks very large homeworld maps so major planets can stay huge", () => {
    const context = createContext({
      homeSession: { cols: 1500, rows: 1500, sessionType: "adventure_world" },
      activeSession: { cols: 1500, rows: 1500, sessionType: "adventure_world" },
    });

    loadBrowserScript("content/spacePlanets.js", context);

    const station = context.window.BQGetSpacePlanetWorldProfile("orbit", {
      key: "trade-ring",
      name: "Trade Ring",
      kind: "station",
      biome: "station",
    });
    const lush = context.window.BQGetSpacePlanetWorldProfile("aurelia", {
      key: "aurelia-prime",
      name: "Aurelia Prime",
      kind: "planet",
      biome: "lush",
    });
    const jungle = context.window.BQGetSpacePlanetWorldProfile("verdana", {
      key: "verdana",
      name: "Verdana Canopy",
      kind: "planet",
      biome: "jungle",
    });
    const volcanic = context.window.BQGetSpacePlanetWorldProfile("solara", {
      key: "solara",
      name: "Solara Prime",
      kind: "planet",
      biome: "volcanic",
    });

    expect(station.cols).toBeGreaterThanOrEqual(900);
    expect(station.cols).toBeLessThan(1500);
    expect(lush.cols).toBe(1620);
    expect(jungle.cols).toBe(1710);
    expect(lush.cols).toBeGreaterThan(station.cols);
    expect(jungle.cols).toBeGreaterThan(lush.cols);
    expect(lush.cityCount).toBeGreaterThanOrEqual(100);
    expect(jungle.cityCount).toBeGreaterThan(lush.cityCount);
    expect(volcanic.sulfurLevel).toBe(42);
  });
});
