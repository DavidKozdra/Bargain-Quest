'use strict';
/**
 * save-load.test.js
 *
 * Tests for SaveSystem.save() — verifies that the JSON written to
 * localStorage contains the correct structure and values.
 *
 * Also tests hasSave() / deleteSave() and a round-trip: save → parse JSON
 * → City.fromJSON → confirm locations are identical.
 *
 * Source tested: classes/SaveSystem.js
 */

const { createGameContext, loadIntoContext, exposeGlobals, createLocalStorageMock } = require('./helpers/vm-loader');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_CITIES = [
  {
    name: 'Portville',
    location: { x: 10, y: 20 },
    population: 500,
    inventory: new Map(),
    holidays: [],
    bookHolidays: [],
    stockedBooks: [],
    priceHistory: {},
    buildingVariant: 1,
    reputation: 55,
    hasGamblingDen: false,
    hasBank: true,
    hasBlackMarket: false,
    hasBountyBoard: false,
    hasWeaponShop: false,
    stockedWeapons: [],
  },
  {
    name: 'Goldshire',
    location: { x: 77, y: 33 },
    population: 800,
    inventory: new Map(),
    holidays: [],
    bookHolidays: [],
    stockedBooks: [],
    priceHistory: {},
    buildingVariant: 2,
    reputation: 60,
    hasGamblingDen: true,
    hasBank: false,
    hasBlackMarket: true,
    hasBountyBoard: false,
    hasWeaponShop: false,
    stockedWeapons: [],
  },
  {
    name: 'Stonehaven',
    location: { x: 144, y: 7 },
    population: 350,
    inventory: new Map(),
    holidays: [],
    bookHolidays: [],
    stockedBooks: [],
    priceHistory: {},
    buildingVariant: 0,
    reputation: 45,
    hasGamblingDen: false,
    hasBank: false,
    hasBlackMarket: false,
    hasBountyBoard: true,
    hasWeaponShop: true,
    stockedWeapons: [],
  },
];

const MOCK_PLAYER = {
  x: 25,
  y: 30,
  gold: 1500,
  name: 'TestCaptain',
  inventory: new Map([
    ['Wood',  { quantity: 5 }],
    ['Bread', { quantity: 3 }],
  ]),
  party: [],
  direction: 'down',
  hasWon: false,
  cargoCapacity: 50,
  combatStrength: 3,
  equippedWeapon: null,
  fleet: [],
  activeBoat: null,
  modifiers: {
    negotiationDiscount: 0,
    bribeCostReduction: 0,
    bribeCooldownBonus: 0,
    treasureValueBonus: 0,
    seaLegs: false,
  },
  level: 1,
  xp: 0,
  statPoints: 0,
  bonusMaxHP: 0,
  bonusAttack: 0,
  bonusDefense: 0,
  bonusMagic: 0,
  bonusCharm: 0,
  currentHP: 10,
  _lastRegenHour: 0,
  weeklyIncome: 0,
  weeklySpending: 0,
  _startingGold: 100,
  _pendingInvestment: null,
};

// ── Context factory ───────────────────────────────────────────────────────────

function buildSaveContext(playerOverrides = {}, cityOverrides = [], extraCtx = {}) {
  const storage = createLocalStorageMock();
  const ctx = createGameContext({
    localStorage: storage,
    player: { ...MOCK_PLAYER, ...playerOverrides },
    cities: cityOverrides.length > 0 ? cityOverrides : MOCK_CITIES,
    dayNight: { timeOfDay: 0.3, daysElapsed: 5 },
    cols: 50,
    rows: 50,
    gameSpeedIndex: 2,
    _mapSeed: 99999,
    _isCustomMap: false,
    _newGameLandmass: 1,
    _newGameDifficulty: 'normal',
    grid: [],
    ...extraCtx,
  });
  loadIntoContext(ctx, 'classes/SaveSystem.js');
  exposeGlobals(ctx, ['SaveSystem']);
  return ctx;
}

/** Parse the save JSON from a context's localStorage. */
function getSaveData(ctx) {
  const raw = ctx.localStorage.getItem('bargainquest_save');
  expect(raw).not.toBeNull();
  return JSON.parse(raw);
}

// ── hasSave / deleteSave ──────────────────────────────────────────────────────

describe('SaveSystem.hasSave() and deleteSave()', () => {
  test('hasSave() returns false before any save', () => {
    const ctx = buildSaveContext();
    expect(ctx.SaveSystem.hasSave()).toBe(false);
  });

  test('hasSave() returns true after save()', () => {
    const ctx = buildSaveContext();
    ctx.SaveSystem.save();
    expect(ctx.SaveSystem.hasSave()).toBe(true);
  });

  test('deleteSave() removes the save so hasSave() returns false', () => {
    const ctx = buildSaveContext();
    ctx.SaveSystem.save();
    ctx.SaveSystem.deleteSave();
    expect(ctx.SaveSystem.hasSave()).toBe(false);
  });
});

// ── save() output structure ───────────────────────────────────────────────────

describe('SaveSystem.save() — JSON structure', () => {
  let ctx, data;
  beforeAll(() => {
    ctx = buildSaveContext();
    ctx.SaveSystem.save();
    data = getSaveData(ctx);
  });

  test('writes valid JSON to localStorage', () => {
    const raw = ctx.localStorage.getItem('bargainquest_save');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  test('save version is 5', () => {
    expect(data.version).toBe(5);
  });

  test('includes a timestamp', () => {
    expect(typeof data.timestamp).toBe('number');
    expect(data.timestamp).toBeGreaterThan(0);
  });

  test('saves map dimensions (cols, rows)', () => {
    expect(data.cols).toBe(50);
    expect(data.rows).toBe(50);
  });

  test('saves map seed', () => {
    expect(data.mapSeed).toBe(99999);
  });

  test('saves difficulty string', () => {
    expect(data.difficulty).toBe('normal');
  });

  test('saves gameSpeed index', () => {
    expect(typeof data.gameSpeed).toBe('number');
  });
});

// ── save() player data ────────────────────────────────────────────────────────

describe('SaveSystem.save() — player data', () => {
  let data;
  beforeAll(() => {
    const ctx = buildSaveContext();
    ctx.SaveSystem.save();
    data = getSaveData(ctx).player;
  });

  test('saves player x and y position', () => {
    expect(data.x).toBe(25);
    expect(data.y).toBe(30);
  });

  test('saves player gold', () => {
    expect(data.gold).toBe(1500);
  });

  test('saves player name', () => {
    expect(data.name).toBe('TestCaptain');
  });

  test('saves _startingGold', () => {
    expect(data._startingGold).toBe(100);
  });

  test('inventory serialised as array of [key, quantity] pairs', () => {
    expect(Array.isArray(data.inventory)).toBe(true);
    const map = Object.fromEntries(data.inventory);
    expect(map['Wood']).toBe(5);
    expect(map['Bread']).toBe(3);
  });

  test('saves hasWon flag', () => {
    expect(data.hasWon).toBe(false);
  });

  test('saves equippedWeapon (null when none)', () => {
    expect(data.equippedWeapon).toBeNull();
  });

  test('saves level and xp', () => {
    expect(data.level).toBe(1);
    expect(data.xp).toBe(0);
  });
});

// ── save() city data ──────────────────────────────────────────────────────────

describe('SaveSystem.save() — city locations', () => {
  let data;
  beforeAll(() => {
    const ctx = buildSaveContext();
    ctx.SaveSystem.save();
    data = getSaveData(ctx);
  });

  test('saves all 3 cities', () => {
    expect(data.cities).toHaveLength(3);
  });

  test('city 0 location is {x:10, y:20}', () => {
    expect(data.cities[0].location).toEqual({ x: 10, y: 20 });
  });

  test('city 1 location is {x:77, y:33}', () => {
    expect(data.cities[1].location).toEqual({ x: 77, y: 33 });
  });

  test('city 2 location is {x:144, y:7}', () => {
    expect(data.cities[2].location).toEqual({ x: 144, y: 7 });
  });

  test('city names are preserved', () => {
    expect(data.cities[0].name).toBe('Portville');
    expect(data.cities[1].name).toBe('Goldshire');
    expect(data.cities[2].name).toBe('Stonehaven');
  });

  test('city populations are preserved', () => {
    expect(data.cities[0].population).toBe(500);
    expect(data.cities[1].population).toBe(800);
    expect(data.cities[2].population).toBe(350);
  });
});

describe('SaveSystem.save() — city feature flags', () => {
  let data;
  beforeAll(() => {
    const ctx = buildSaveContext();
    ctx.SaveSystem.save();
    data = getSaveData(ctx);
  });

  test('Portville hasBank = true', () => {
    expect(data.cities[0].hasBank).toBe(true);
  });

  test('Goldshire hasGamblingDen = true', () => {
    expect(data.cities[1].hasGamblingDen).toBe(true);
  });

  test('Goldshire hasBlackMarket = true', () => {
    expect(data.cities[1].hasBlackMarket).toBe(true);
  });

  test('Stonehaven hasBountyBoard = true', () => {
    expect(data.cities[2].hasBountyBoard).toBe(true);
  });

  test('false features are saved as false (not omitted)', () => {
    expect(data.cities[0].hasGamblingDen).toBe(false);
    expect(data.cities[2].hasBank).toBe(false);
  });
});

// ── Round-trip: save → JSON → City.fromJSON → locations match ────────────────

describe('Round-trip: save → City.fromJSON → locations preserved', () => {
  let ctx, saveData;

  beforeAll(() => {
    ctx = createGameContext({
      localStorage: createLocalStorageMock(),
      player: { ...MOCK_PLAYER },
      cities: MOCK_CITIES,
      dayNight: { timeOfDay: 0.3, daysElapsed: 5 },
      cols: 50, rows: 50, gameSpeedIndex: 2,
      _mapSeed: 99999, _isCustomMap: false,
    });
    // Load both class files in the same context so ItemLibrary is shared
    loadIntoContext(ctx, 'classes/item.js');
    exposeGlobals(ctx, ['ItemLibrary', 'Item']);
    loadIntoContext(ctx, 'classes/Cities.js');
    exposeGlobals(ctx, ['City']);
    loadIntoContext(ctx, 'classes/SaveSystem.js');
    exposeGlobals(ctx, ['SaveSystem']);

    ctx.SaveSystem.save();
    saveData = getSaveData(ctx);
  });

  test('number of cities in save matches original', () => {
    expect(saveData.cities).toHaveLength(MOCK_CITIES.length);
  });

  test.each(MOCK_CITIES.map((c, i) => [c.name, c.location, i]))(
    '%s location survives save → fromJSON round-trip',
    (name, location, i) => {
      const restored = ctx.City.fromJSON(saveData.cities[i]);
      expect(restored.location).toEqual(location);
    }
  );

  test('all city names survive round-trip', () => {
    for (let i = 0; i < MOCK_CITIES.length; i++) {
      const restored = ctx.City.fromJSON(saveData.cities[i]);
      expect(restored.name).toBe(MOCK_CITIES[i].name);
    }
  });

  test('city features survive round-trip', () => {
    const portville = ctx.City.fromJSON(saveData.cities[0]);
    expect(portville.hasBank).toBe(true);
    expect(portville.hasGamblingDen).toBe(false);

    const goldshire = ctx.City.fromJSON(saveData.cities[1]);
    expect(goldshire.hasGamblingDen).toBe(true);
    expect(goldshire.hasBlackMarket).toBe(true);
  });
});

// ── Player position round-trip ────────────────────────────────────────────────

describe('Round-trip: player position', () => {
  test('player x/y are restored exactly from saved JSON', () => {
    const ctx = buildSaveContext({ x: 42, y: 88 });
    ctx.SaveSystem.save();
    const data = getSaveData(ctx);
    expect(data.player.x).toBe(42);
    expect(data.player.y).toBe(88);
  });

  test('player gold is restored exactly from saved JSON', () => {
    const ctx = buildSaveContext({ gold: 3750 });
    ctx.SaveSystem.save();
    const data = getSaveData(ctx);
    expect(data.player.gold).toBe(3750);
  });
});
