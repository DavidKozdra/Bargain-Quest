const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadBrowserScript(relPath, context, exportName) {
  const filename = path.resolve(__dirname, "..", "..", relPath);
  const source = fs.readFileSync(filename, "utf8");
  vm.runInNewContext(`${source}\nthis.__exported = ${exportName};`, context, { filename });
  return context.__exported;
}

function createRaiderContext() {
  const rng = { random: () => 0 };
  const context = {
    console,
    Math,
    Map,
    Set,
    Date,
    cols: 20,
    rows: 20,
    grid: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => ({ options: ["Grass"] }))),
    ItemLibrary: {
      Fish: { name: "Fish" },
    },
    dayNight: {
      getDaysElapsed: () => 0,
    },
    cities: [
      { location: { x: 3, y: 3 }, isCoastal: false },
      { location: { x: 14, y: 14 }, isCoastal: false },
    ],
    cityLocationMap: new Set(),
    window: {
      BQSeededRNG: {
        stream: () => rng,
      },
      BQGetWorldSession: () => null,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  };
  context.global = context;
  context.globalThis = context;
  return context;
}

describe("classes/Raider naming", () => {
  test("generates themed names for land raiders, pirates, and monsters", () => {
    const context = createRaiderContext();
    const Raider = loadBrowserScript("classes/Raider.js", context, "Raider");

    const bandit = new Raider({ x: 1, y: 1, strength: 3, patrolPoints: [], type: "bandit" });
    const pirate = new Raider({ x: 2, y: 2, strength: 4, patrolPoints: [], type: "bandit", isPirate: true });
    const dragon = new Raider({ x: 3, y: 3, strength: 6, patrolPoints: [], type: "dragon" });

    expect(bandit.name).toBe("Rook the Knife Hand who cuts purses");
    expect(pirate.name).toBe("Barnacle Ben the Black Wake who counts wrecks");
    expect(dragon.name).toBe("Azrith the Ash Throne who hoards crowns");
    expect(dragon.getDisplayName(true)).toBe("Azrith the Ash Throne who hoards crowns (Dragon)");
  });

  test("preserves explicit names through save restore", () => {
    const context = createRaiderContext();
    const Raider = loadBrowserScript("classes/Raider.js", context, "Raider");

    const named = new Raider({
      x: 4,
      y: 5,
      strength: 5,
      patrolPoints: [{ x: 4, y: 5 }],
      type: "blackKnight",
      name: "Sir Veyn the Grave Helm",
    });

    const restored = Raider.fromJSON(named.toJSON());

    expect(restored.name).toBe("Sir Veyn the Grave Helm");
    expect(restored.getDisplayName(true)).toBe("Sir Veyn the Grave Helm (Black Knight)");
  });
});

describe("classes/Raider safe zones", () => {
  test("city tiles suppress raider collision checks", () => {
    const context = createRaiderContext();
    const RaiderManager = loadBrowserScript("classes/RaiderManager.js", context, "RaiderManager");
    const mgr = new RaiderManager();

    mgr.raiders = [
      { state: "chasing", bribedCooldown: 0, x: 5, y: 4 },
    ];

    context.cityLocationMap.add("5,5");
    expect(mgr.checkPlayerCollision(5, 5)).toBe(null);

    context.cityLocationMap.clear();
    expect(mgr.checkPlayerCollision(5, 5)).toBe(mgr.raiders[0]);
  });
});

describe("classes/Raider ecology rules", () => {
  test("grazer entities stay passive even when the player is nearby", () => {
    const context = createRaiderContext();
    const Raider = loadBrowserScript("classes/Raider.js", context, "Raider");

    const grazer = new Raider({
      x: 8,
      y: 8,
      strength: 2,
      patrolPoints: [{ x: 8, y: 8 }, { x: 9, y: 8 }],
      type: "grazer",
    });

    grazer.update(1, 9, 8);

    expect(grazer.isNeutral).toBe(true);
    expect(grazer.state).toBe("patrolling");
  });

  test("planet monsters only spawn when carbon level is at least 50%", () => {
    const lowCarbonContext = createRaiderContext();
    const RaiderLow = loadBrowserScript("classes/Raider.js", lowCarbonContext, "Raider");
    lowCarbonContext.Raider = RaiderLow;
    lowCarbonContext.window.BQGetWorldSession = () => ({
      sessionType: "planet_surface",
      spaceContext: { carbonLevel: 40 },
    });
    const RaiderManagerLow = loadBrowserScript("classes/RaiderManager.js", lowCarbonContext, "RaiderManager");
    const lowMgr = new RaiderManagerLow();
    const lowSpawn = lowMgr.spawnRaider();

    expect(lowSpawn).toBeTruthy();
    expect(lowSpawn.type).toBe("bandit");

    const highCarbonContext = createRaiderContext();
    const RaiderHigh = loadBrowserScript("classes/Raider.js", highCarbonContext, "Raider");
    highCarbonContext.Raider = RaiderHigh;
    highCarbonContext.window.BQGetWorldSession = () => ({
      sessionType: "planet_surface",
      spaceContext: { carbonLevel: 70 },
    });
    const RaiderManagerHigh = loadBrowserScript("classes/RaiderManager.js", highCarbonContext, "RaiderManager");
    const highMgr = new RaiderManagerHigh();
    const highSpawn = highMgr.spawnRaider();

    expect(highSpawn).toBeTruthy();
    expect(highSpawn.isMonster).toBe(true);
    expect(highSpawn.type).toBe("dragon");
  });
});
