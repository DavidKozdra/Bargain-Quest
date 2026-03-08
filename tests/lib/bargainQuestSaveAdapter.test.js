const { SaveAPI } = require("../../Koz_Engine_Lib/api/saveApi");
const { createMemoryDriver } = require("../../Koz_Engine_Lib/io/storageDrivers");

global.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};

global.BQLib = {
  api: { saveApi: { SaveAPI } },
  io: {
    storageDrivers: {
      createLocalStorageDriver: () => createMemoryDriver(),
    },
  },
};

const adapter = require("../../adapters/bargainQuestSaveAdapter");

describe("adapters/bargainQuestSaveAdapter", () => {
  test("validates payload shape/version", () => {
    expect(adapter.validateParsedSave({ version: 6, player: {}, cities: [] }).ok).toBe(true);
    expect(adapter.validateParsedSave({ version: 2, player: {}, cities: [] }).ok).toBe(false);
    expect(adapter.validateParsedSave({ version: 6, player: {} }).ok).toBe(false);
  });

  test("normalizes ownership and management", () => {
    const own = adapter.normalizeCityOwnership({}, "Harbor");
    expect(own.ownerName).toBe("Harbor Council");
    const mg = adapter.normalizeCityManagement({ taxRate: 2, budget: -5 });
    expect(mg.taxRate).toBe(0.5);
    expect(mg.budget).toBe(0);
  });

  test("serializes a runtime snapshot", () => {
    const payload = adapter.serializeRuntimeSnapshot({
      player: {
        x: 1, y: 2, gold: 10, name: "Cap",
        inventory: new Map([["Fish", { quantity: 2 }]]),
        party: [], direction: "down", hasWon: false,
        cargoCapacity: 50, combatStrength: 3,
        equippedWeapon: null, equippedBag: null,
        fleet: [], activeBoat: null, modifiers: {},
        level: 1, xp: 0, statPoints: 0,
        bonusMaxHP: 0, bonusAttack: 0, bonusDefense: 0, bonusMagic: 0, bonusCharm: 0, bonusSpeed: 0,
        currentHP: 10, _lastRegenHour: 0, weeklyIncome: 0, weeklySpending: 0, _startingGold: 100,
        _pendingInvestment: null, ownedCities: [], isKing: false,
      },
      cities: [],
      dayNight: { timeOfDay: 0, daysElapsed: 0 },
      cols: 10, rows: 10, mapSeed: 1, isCustomMap: false,
      landmass: 1, worldGenConfig: {}, difficulty: "normal",
      gameSpeedIndex: 2, goldTarget: 5000, dayLimit: 0,
      portCityLocations: [],
    });
    expect(payload.version).toBe(6);
    expect(payload.player.name).toBe("Cap");
  });

  test("reads and validates saved payload from storage", () => {
    localStorage.setItem(adapter.constants.SAVE_KEY, JSON.stringify({ version: 6, player: {}, cities: [] }));
    expect(adapter.readParsedSave()).toEqual({ version: 6, player: {}, cities: [] });

    localStorage.setItem(adapter.constants.SAVE_KEY, JSON.stringify({ version: 2, player: {}, cities: [] }));
    expect(adapter.readParsedSave()).toBeNull();
  });

  test("applies runtime snapshot for custom-map saves", async () => {
    const player = {
      inventory: new Map(),
      recalcModifiers: jest.fn(),
      getMaxHP: () => 12,
    };
    const dayNight = { timeOfDay: 0, daysElapsed: 0 };

    class City {
      constructor({ name, location, population }) {
        this.name = name;
        this.location = location;
        this.population = population;
        this.inventory = new Map();
        this.stockedWeapons = [];
      }
    }
    class Boat {
      static fromJSON(data) { return { restoredBoat: data.type }; }
    }
    class TraderManager {
      static fromJSON(data) { return { traders: data }; }
    }
    class RaiderManager {
      static fromJSON(data) { return { raiders: data }; }
    }
    class EventSystem {
      static fromJSON(data) { return { events: data }; }
    }
    class ContractSystem {
      static fromJSON(data) { return { contracts: data }; }
    }
    class TreasureSystem {
      static fromJSON(data) { return { treasure: data }; }
    }
    class BankingSystem {
      static fromJSON(data) { return { banking: data }; }
    }
    class SmugglingSystem {
      static fromJSON(data) { return { smuggling: data }; }
    }
    class BountyBoard {
      static fromJSON(data) { return { bounty: data }; }
    }
    class GamblingSystem {
      static fromJSON(data) { return { gambling: data }; }
    }

    const result = await adapter.applyRuntimeSnapshot({
      data: {
        version: 6,
        mapSeed: 7,
        cols: 2,
        rows: 1,
        isCustomMap: true,
        customTerrain: {
          biomes: [2, 0],
          decor: [0, 2],
          elevation: [0.2, 0.1],
          temperature: [0.4, 0.3],
          difficulty: [1.2, 1.8],
        },
        landmass: 1,
        worldGenConfig: {},
        difficulty: "normal",
        goldTarget: 5000,
        dayLimit: 0,
        gameSpeed: 2,
        player: {
          x: 4, y: 5, gold: 77, name: "Cap",
          inventory: [["Fish", 3]],
          party: ["mate"],
          direction: "left",
          hasWon: false,
          cargoCapacity: 50,
          combatStrength: 3,
          equippedWeapon: null,
          equippedBag: null,
          level: 2,
          xp: 9,
          statPoints: 1,
          bonusMaxHP: 2,
          bonusAttack: 1,
          bonusDefense: 0,
          bonusMagic: 0,
          bonusCharm: 0,
          bonusSpeed: 1,
          currentHP: 11,
          _lastRegenHour: 4,
          weeklyIncome: 8,
          weeklySpending: 2,
          _startingGold: 100,
          _pendingInvestment: null,
          ownedCities: [0],
          isKing: false,
          modifiers: { negotiationDiscount: 0.1 },
          fleet: [{ type: "sloop" }],
          activeBoatIndex: 0,
        },
        dayNight: { timeOfDay: 1.5, daysElapsed: 8 },
        cities: [{
          name: "Harbor",
          location: { x: 1, y: 2 },
          population: 300,
          isCoastal: true,
          inventory: [["Fish", 2]],
          holidays: [],
          bookHolidays: [],
          stockedBooks: [],
          priceHistory: {},
          reputation: 70,
          management: { budget: 10, taxRate: 0.2 },
          ownership: {},
          stockedWeapons: [],
        }],
        traders: [{ id: 1 }],
        raiders: [{ id: 2 }],
        events: { tilesMoved: 9 },
        contractSystem: { a: 1 },
        treasureSystem: { b: 2 },
        bankingSystem: { c: 3 },
        smugglingSystem: { d: 4 },
        bountyBoard: { e: 5 },
        gamblingSystem: { f: 6 },
        coastalVersion: 1,
        portCityLocations: [{ x: 1, y: 2 }],
        cityManagement: { settled: true },
        isCityManageMode: true,
        adventureCityManage: false,
        playerPreCityPos: { x: 9, y: 9 },
        rngState: { seed: 1 },
      },
      runtime: {
        player,
        dayNight,
        systems: { minigameManager: null },
        deps: {
          City,
          Boat,
          TraderManager,
          RaiderManager,
          EventSystem,
          ContractSystem,
          TreasureSystem,
          BankingSystem,
          SmugglingSystem,
          BountyBoard,
          GamblingSystem,
          ItemLibrary: { Fish: { name: "Fish" } },
          getDifficultyConfig: jest.fn(() => ({ hp: 1 })),
          SPEED_STEPS: [0.5, 1, 2],
          createMinigameManager: jest.fn(() => ({ mini: true })),
        },
      },
    });

    expect(result.dimensions).toEqual({ cols: 2, rows: 1 });
    expect(result.terrain.grid[0][0].options[0]).toBe("Grass");
    expect(result.cities[0].ownership.ownerName).toBe("Harbor Council");
    expect(player.inventory.get("Fish").quantity).toBe(3);
    expect(player.activeBoat).toEqual({ restoredBoat: "sloop" });
    expect(result.systems.minigameManager).toEqual({ mini: true });
    expect(result.flags.savedIsCityManageMode).toBe(true);
    expect(dayNight.daysElapsed).toBe(8);
    expect(player.recalcModifiers).toHaveBeenCalled();
  });

  test("publishes restored cities before trader restore runs", async () => {
    const runtimeCities = [];
    const player = {
      inventory: new Map(),
      recalcModifiers: jest.fn(),
      getMaxHP: () => 10,
    };
    const dayNight = { timeOfDay: 0, daysElapsed: 0 };

    class City {
      constructor({ name, location, population }) {
        this.name = name;
        this.location = location;
        this.population = population;
        this.inventory = new Map();
        this.stockedWeapons = [];
      }
    }

    class TraderManager {
      static fromJSON() {
        return {
          firstCityLocation: runtimeCities[0]?.location || null,
        };
      }
    }

    class RaiderManager {
      static fromJSON(data) { return { raiders: data }; }
    }
    class EventSystem {
      static fromJSON(data) { return { events: data }; }
    }
    class ContractSystem {
      static fromJSON(data) { return { contracts: data }; }
    }
    class TreasureSystem {
      static fromJSON(data) { return { treasure: data }; }
    }
    class BankingSystem {
      static fromJSON(data) { return { banking: data }; }
    }
    class SmugglingSystem {
      static fromJSON(data) { return { smuggling: data }; }
    }
    class BountyBoard {
      static fromJSON(data) { return { bounty: data }; }
    }
    class GamblingSystem {
      static fromJSON(data) { return { gambling: data }; }
    }
    class Boat {
      static fromJSON(data) { return data; }
    }

    const result = await adapter.applyRuntimeSnapshot({
      data: {
        version: 6,
        mapSeed: 1,
        cols: 1,
        rows: 1,
        isCustomMap: true,
        customTerrain: {
          biomes: [2],
          decor: [0],
          elevation: [0],
          temperature: [0],
          difficulty: [1],
        },
        worldGenConfig: {},
        difficulty: "normal",
        player: {
          x: 0, y: 0, gold: 1, name: "Cap",
          inventory: [],
          party: [],
          fleet: [],
          ownedCities: [],
        },
        dayNight: { timeOfDay: 0, daysElapsed: 0 },
        cities: [{
          name: "Harbor",
          location: { x: 2, y: 3 },
          population: 200,
          inventory: [],
          holidays: [],
          management: {},
        }],
        traders: [{ homeCityIndex: 0 }],
      },
      runtime: {
        player,
        dayNight,
        cities: runtimeCities,
        systems: {},
        deps: {
          City,
          Boat,
          TraderManager,
          RaiderManager,
          EventSystem,
          ContractSystem,
          TreasureSystem,
          BankingSystem,
          SmugglingSystem,
          BountyBoard,
          GamblingSystem,
          ItemLibrary: {},
          getDifficultyConfig: jest.fn(() => ({})),
          createMinigameManager: jest.fn(() => null),
        },
      },
    });

    expect(runtimeCities[0].location).toEqual({ x: 2, y: 3 });
    expect(result.systems.traderManager.firstCityLocation).toEqual({ x: 2, y: 3 });
  });
});
