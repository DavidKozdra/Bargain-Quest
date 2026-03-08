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
});
