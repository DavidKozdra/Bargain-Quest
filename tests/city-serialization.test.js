'use strict';
/**
 * city-serialization.test.js
 *
 * Tests for City.toJSON() and City.fromJSON() — the serialisation round-trip
 * that backs the save/load system.  Failures here mean city locations,
 * features, or inventory can silently corrupt on save.
 *
 * Sources tested:
 *   classes/Cities.js  City.toJSON()   (lines ~598-621)
 *   classes/Cities.js  City.fromJSON() (lines ~623-661)
 */

const { createGameContext, loadIntoContext, exposeGlobals } = require('./helpers/vm-loader');

// ── Shared context (load once, reuse across all tests in this file) ──────────
let ctx;

beforeAll(() => {
  ctx = createGameContext();
  // item.js must load first — City.fromJSON references ItemLibrary
  loadIntoContext(ctx, 'classes/item.js');
  exposeGlobals(ctx, ['Item', 'ItemLibrary']);
  loadIntoContext(ctx, 'classes/Cities.js');
  exposeGlobals(ctx, ['City']);
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCity(name = 'Testville', x = 10, y = 20, population = 500) {
  return new ctx.City({ name, location: { x, y }, population });
}

function roundTrip(city) {
  return ctx.City.fromJSON(city.toJSON());
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('City.toJSON() output shape', () => {
  test('includes required fields', () => {
    const json = makeCity().toJSON();
    expect(json).toHaveProperty('name');
    expect(json).toHaveProperty('location');
    expect(json).toHaveProperty('population');
    expect(json).toHaveProperty('inventory');
    expect(json).toHaveProperty('reputation');
    expect(json).toHaveProperty('buildingVariant');
    expect(json).toHaveProperty('holidays');
  });

  test('location is a plain {x, y} object', () => {
    const json = makeCity('A', 42, 99).toJSON();
    expect(json.location).toEqual({ x: 42, y: 99 });
  });

  test('inventory serialises as plain object {key: qty}', () => {
    const city = makeCity();
    city.inventory.set('Wood', { item: ctx.ItemLibrary['Wood'], quantity: 7 });
    const json = city.toJSON();
    expect(typeof json.inventory).toBe('object');
    expect(Array.isArray(json.inventory)).toBe(false);
    expect(json.inventory['Wood']).toBe(7);
  });
});

describe('City toJSON → fromJSON round-trip: basic fields', () => {
  test('preserves name', () => {
    expect(roundTrip(makeCity('Portville')).name).toBe('Portville');
  });

  test('preserves location.x and location.y exactly', () => {
    const restored = roundTrip(makeCity('A', 123, 456));
    expect(restored.location).toEqual({ x: 123, y: 456 });
  });

  test('preserves population', () => {
    const city = makeCity('A', 0, 0, 875);
    expect(roundTrip(city).population).toBe(875);
  });

  test('preserves reputation', () => {
    const city = makeCity();
    city.reputation = 72;
    expect(roundTrip(city).reputation).toBe(72);
  });

  test('reputation defaults to 50 when missing from JSON', () => {
    const json = makeCity().toJSON();
    delete json.reputation;
    const restored = ctx.City.fromJSON(json);
    expect(restored.reputation).toBe(50);
  });

  test('preserves buildingVariant', () => {
    const city = makeCity();
    city.buildingVariant = 3;
    expect(roundTrip(city).buildingVariant).toBe(3);
  });

  test('buildingVariant defaults to 0 when missing', () => {
    const json = makeCity().toJSON();
    delete json.buildingVariant;
    expect(ctx.City.fromJSON(json).buildingVariant).toBe(0);
  });
});

describe('City toJSON → fromJSON: feature flags', () => {
  const flags = ['hasBank', 'hasGamblingDen', 'hasBlackMarket', 'hasBountyBoard', 'hasWeaponShop'];

  test.each(flags)('%s preserved as true', (flag) => {
    const city = makeCity();
    city[flag] = true;
    expect(roundTrip(city)[flag]).toBe(true);
  });

  test('all feature flags default to false in fromJSON when omitted from JSON', () => {
    // fromJSON with a minimal JSON object (no feature keys present)
    const minimal = { name: 'A', location: { x: 0, y: 0 }, population: 500, inventory: {}, holidays: [] };
    const restored = ctx.City.fromJSON(minimal);
    for (const flag of flags) {
      expect(restored[flag]).toBe(false);
    }
  });
});

describe('City toJSON → fromJSON: inventory', () => {
  test('fromJSON with empty inventory produces empty inventory (no weapon shop)', () => {
    // Use fromJSON directly so we control hasWeaponShop/stockedWeapons exactly.
    // The constructor seeds Wheat/Fish and may randomise a weapon shop, both of
    // which fromJSON clears and then restores from the supplied JSON.
    const json = {
      name: 'A', location: { x: 0, y: 0 }, population: 500,
      inventory: {},
      hasWeaponShop: false, stockedWeapons: [],
    };
    expect(ctx.City.fromJSON(json).inventory.size).toBe(0);
  });

  test('known items restored with correct quantity', () => {
    const city = makeCity();
    city.inventory.set('Wood', { item: ctx.ItemLibrary['Wood'], quantity: 15 });
    city.inventory.set('Bread', { item: ctx.ItemLibrary['Bread'], quantity: 7 });
    const restored = roundTrip(city);
    expect(restored.inventory.get('Wood').quantity).toBe(15);
    expect(restored.inventory.get('Bread').quantity).toBe(7);
  });

  test('restored item objects reference ItemLibrary', () => {
    const city = makeCity();
    city.inventory.set('Wood', { item: ctx.ItemLibrary['Wood'], quantity: 1 });
    const restored = roundTrip(city);
    // The .item property should be the actual ItemLibrary entry
    expect(restored.inventory.get('Wood').item).toBe(ctx.ItemLibrary['Wood']);
  });

  test('items with key not in ItemLibrary are silently dropped', () => {
    const city = makeCity();
    const json = city.toJSON();
    json.inventory['TOTALLY_FAKE_ITEM_XYZ'] = 5;
    const restored = ctx.City.fromJSON(json);
    expect(restored.inventory.has('TOTALLY_FAKE_ITEM_XYZ')).toBe(false);
  });

  test('items with quantity 0 are not restored', () => {
    const city = makeCity();
    const json = city.toJSON();
    json.inventory['Wood'] = 0;
    const restored = ctx.City.fromJSON(json);
    expect(restored.inventory.has('Wood')).toBe(false);
  });

  test('multiple items restored correctly', () => {
    const city = makeCity();
    const itemKeys = ['Wood', 'Bread', 'Fish'].filter(k => ctx.ItemLibrary[k]);
    for (const key of itemKeys) {
      city.inventory.set(key, { item: ctx.ItemLibrary[key], quantity: 10 });
    }
    const restored = roundTrip(city);
    for (const key of itemKeys) {
      expect(restored.inventory.get(key)?.quantity).toBe(10);
    }
  });
});

describe('Multiple cities: location isolation', () => {
  test('each city preserves its own distinct location', () => {
    const cities = [
      makeCity('Alpha',   10,  20),
      makeCity('Beta',    77,  33),
      makeCity('Gamma',    1,  99),
      makeCity('Delta',  200,   5),
    ];
    const restored = cities.map(c => roundTrip(c));
    expect(restored[0].location).toEqual({ x:  10, y:  20 });
    expect(restored[1].location).toEqual({ x:  77, y:  33 });
    expect(restored[2].location).toEqual({ x:   1, y:  99 });
    expect(restored[3].location).toEqual({ x: 200, y:   5 });
  });

  test('restoring one city does not affect another city instance', () => {
    const a = makeCity('A', 10, 20);
    const b = makeCity('B', 77, 33);
    const ra = roundTrip(a);
    const rb = roundTrip(b);
    expect(ra.location).not.toEqual(rb.location);
  });

  test('location is isolated after JSON.stringify/parse (as done in actual save)', () => {
    // toJSON() returns this.location by reference; only after JSON.stringify
    // (which SaveSystem uses) does the data become independent.
    const city = makeCity('A', 10, 20);
    const serialised = JSON.parse(JSON.stringify(city.toJSON()));
    serialised.location.x = 999;
    expect(city.location.x).toBe(10); // original city unaffected
  });
});
