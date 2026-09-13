"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function makeHarness(overrides = {}) {
  const notices = [];
  const inventory = new Map();
  const itemLibrary = {
    Wheat: { name: "Wheat", baseValue: 10, weight: 1, category: "Food", tradable: true },
    Wood: { name: "Wood", baseValue: 8, weight: 3, category: "Material", tradable: true },
    Jewelry: { name: "Jewelry", baseValue: 80, weight: 1, category: "Luxury", tradable: true },
  };
  const grid = Array.from({ length: 15 }, () =>
    Array.from({ length: 15 }, () => ({ options: ["Grass"] })));
  const player = {
    x: 7,
    y: 7,
    cargoCapacity: 50,
    inventory,
    getCargoWeight() {
      let total = 0;
      for (const [name, entry] of inventory) total += itemLibrary[name].weight * entry.quantity;
      return total;
    },
    getEffectiveCargoCapacity() { return this.cargoCapacity; },
    addItem(entry) {
      const weight = itemLibrary[entry.name].weight * entry.quantity;
      if (this.getCargoWeight() + weight > this.cargoCapacity) return false;
      const current = inventory.get(entry.name);
      if (current) current.quantity += entry.quantity;
      else inventory.set(entry.name, { item: itemLibrary[entry.name], quantity: entry.quantity });
      return true;
    },
  };
  const context = vm.createContext({
    console,
    Date,
    Math: Object.create(Math),
    window: {
      _newGameDifficulty: "normal",
      DIFFICULTY_CONFIG: {
        timedCacheLifetimeSeconds: 100,
        timedCacheMinDistance: 3,
        timedCacheMaxDistance: 5,
        timedCacheRewardMultiplier: 1,
      },
    },
    grid,
    rows: grid.length,
    cols: grid[0].length,
    cities: [],
    contractSystem: { active: [] },
    player,
    ItemLibrary: itemLibrary,
    notificationManager: { log: (message, type) => notices.push({ message, type }) },
    ...overrides,
  });
  const source = fs.readFileSync(path.resolve(__dirname, "../../classes/TreasureSystem.js"), "utf8");
  vm.runInContext(`${source}\nthis.TreasureSystem = TreasureSystem;`, context);
  return { context, TreasureSystem: context.TreasureSystem, player, inventory, notices };
}

describe("TreasureSystem timed rumor caches", () => {
  test("spawns one cache on reachable land at actual route distance", () => {
    const h = makeHarness();
    h.context.Math.random = () => 0.5;
    const system = new h.TreasureSystem();
    system.nextCacheInMs = 1;
    system.update(16, 2);

    expect(system.timedCache).toBeTruthy();
    expect(system.timedCache.routeDistance).toBeGreaterThanOrEqual(3);
    expect(system.timedCache.routeDistance).toBeLessThanOrEqual(5);
    expect(h.context.grid[system.timedCache.y][system.timedCache.x].options[0]).toBe("Grass");

    const firstId = system.timedCache.id;
    system.update(16, 999999);
    expect(system.timedCache.id).toBe(firstId);
  });

  test("uses playable real time for lifetime and scaled time for spawn cadence", () => {
    const h = makeHarness();
    const system = new h.TreasureSystem();
    system.nextCacheInMs = 1000;
    system.update(100, 600);
    expect(system.nextCacheInMs).toBe(400);

    system.timedCache = { x: 5, y: 5, loot: [], remainingMs: 1000, lifetimeMs: 1000 };
    system.update(250, 900);
    expect(system.timedCache.remainingMs).toBe(750);
  });

  test("partially collects capacity-safe loot and leaves the remainder", () => {
    const h = makeHarness();
    h.player.cargoCapacity = 2;
    h.context.Math.random = () => 0.5;
    const system = new h.TreasureSystem();
    system.timedCache = {
      id: "cache_test", x: h.player.x, y: h.player.y, tier: "common",
      routeDistance: 3, remainingMs: 50000, lifetimeMs: 100000,
      loot: [{ name: "Wheat", quantity: 3 }],
    };

    const result = system.collectTimedCache();
    expect(result.ok).toBe(true);
    expect(result.complete).toBe(false);
    expect(h.inventory.get("Wheat").quantity).toBe(2);
    expect(system.timedCache.loot[0].quantity).toBe(1);

    h.player.cargoCapacity = 3;
    const finalResult = system.collectTimedCache();
    expect(finalResult.complete).toBe(true);
    expect(system.timedCache).toBe(null);
  });

  test("persists pre-rolled loot and remaining playable time", () => {
    const h = makeHarness();
    const system = new h.TreasureSystem();
    system.timedCache = {
      id: "cache_saved", x: 4, y: 8, tier: "merchant", routeDistance: 6,
      remainingMs: 43210, lifetimeMs: 100000, loot: [{ name: "Wood", quantity: 2 }],
    };
    system.nextCacheInMs = 98765;

    const restored = h.TreasureSystem.fromJSON(JSON.parse(JSON.stringify(system.toJSON())));
    expect(restored.timedCache.id).toBe("cache_saved");
    expect(restored.timedCache.remainingMs).toBe(43210);
    expect(restored.timedCache.loot).toEqual([{ name: "Wood", quantity: 2 }]);
    expect(restored.nextCacheInMs).toBe(98765);
  });
});
