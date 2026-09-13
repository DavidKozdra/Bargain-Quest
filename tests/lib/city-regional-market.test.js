const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('City regional market geography', () => {
  let City;
  let neighbors;

  beforeEach(() => {
    const context = vm.createContext({
      window: { DIFFICULTY_CONFIG: {} },
      ItemLibrary: { Iron: { baseValue: 20 }, Wheat: { baseValue: 5 } },
    });
    const source = fs.readFileSync(path.join(__dirname, '../../classes/Cities.js'), 'utf8');
    vm.runInContext(source + '\nthis.marketNeighbors = _bqCityMarketNeighbors;', context);
    City = context.window.City;
    neighbors = context.marketNeighbors;
  });

  function city(x, y, population = 1000, quantity = 100) {
    return {
      location: { x, y },
      population,
      inventory: new Map([['Iron', { quantity }], ['Wheat', { quantity: quantity / 3 }]]),
      management: { taxRate: 0.05 },
      getBasePrice(item) { return item === 'Iron' ? 20 : 5; },
      getReputationPriceModifier(selling) { return selling ? 1.1 : 0.9; },
    };
  }

  function price(local, cities, item = 'Iron', selling = false) {
    return City.prototype.calculateItemPrice.call(local, item, cities, selling, {
      trackHistory: false,
      applyDifficultyMultipliers: false,
    });
  }

  function scan(local, cities) {
    return cities.filter(other => other !== local && Math.hypot(
      other.location.x - local.location.x,
      other.location.y - local.location.y,
    ) <= 25);
  }

  test('includes radius boundaries across negative grid cells and preserves array order', () => {
    const local = city(-25, -25);
    const north = city(-25, 0);
    const diagonal = city(-10, -5); // exactly 25 tiles
    const outside = city(-10, -4.999);
    const west = city(-50, -25);
    const colocated = city(-25, -25);
    const cities = [north, local, diagonal, outside, west, colocated, north, local];
    City.rebuildRegionalMarketIndex(cities);
    expect(Array.from(neighbors(local, cities))).toEqual([north, diagonal, west, colocated, north]);
  });

  test('indexed prices match live scans for every city, item and trade direction', () => {
    const cities = Array.from({ length: 600 }, (_, i) =>
      city((i % 30) * 10 - 70, Math.floor(i / 30) * 15 - 100, 300 + i, 2 + i % 120));
    const unindexed = cities.slice();
    City.rebuildRegionalMarketIndex(cities);
    for (const local of cities) {
      expect(Array.from(neighbors(local, cities))).toEqual(scan(local, unindexed));
      for (const item of ['Iron', 'Wheat']) {
        for (const selling of [false, true]) {
          expect(price(local, cities, item, selling)).toBe(price(local, unindexed, item, selling));
        }
      }
    }
  });

  test('cached neighbors read live quantities, population, item addition and removal', () => {
    const local = city(0, 0);
    const other = city(10, 0, 1000, 500);
    const cities = [local, other];
    const unindexed = cities.slice();
    City.rebuildRegionalMarketIndex(cities);
    const initial = price(local, cities);
    other.inventory.get('Iron').quantity = 1;
    const afterTrade = price(local, cities);
    expect(afterTrade).toBeLessThan(initial);
    expect(afterTrade).toBe(price(local, unindexed));
    other.population = 1;
    expect(price(local, cities)).toBeGreaterThan(afterTrade);
    expect(price(local, cities)).toBe(price(local, unindexed));
    other.inventory.delete('Iron');
    expect(price(local, cities)).toBe(price(local, unindexed));
    other.population = 1000;
    other.inventory.set('Iron', { quantity: 0 });
    expect(price(local, cities)).toBe(price(local, unindexed));
    expect(price(local, cities)).toBeLessThan(initial);
    other.inventory = new Map([['Iron', { quantity: 50 }]]);
    expect(price(local, cities)).toBe(price(local, unindexed));
  });

  test('city addition and removal invalidate cached neighbors on length changes', () => {
    const local = city(0, 0);
    const cities = [local, city(100, 100)];
    City.rebuildRegionalMarketIndex(cities);
    expect(neighbors(local, cities)).toHaveLength(0);
    const added = city(10, 0);
    cities.push(added);
    expect(Array.from(neighbors(local, cities))).toEqual([added]);
    cities.pop();
    expect(neighbors(local, cities)).toHaveLength(0);
  });

  test('topology rebuild handles relocation and same-length load replacements', () => {
    const local = city(0, 0);
    const other = city(100, 100);
    const cities = [local, other];
    City.rebuildRegionalMarketIndex(cities);
    expect(neighbors(local, cities)).toHaveLength(0);
    other.location.x = 10;
    other.location.y = 0;
    City.rebuildRegionalMarketIndex(cities);
    expect(Array.from(neighbors(local, cities))).toEqual([other]);
    other.location = { x: 150, y: 150 };
    City.rebuildRegionalMarketIndex(cities);
    expect(neighbors(local, cities)).toHaveLength(0);
    cities[1] = city(-10, 0);
    City.rebuildRegionalMarketIndex(cities);
    expect(Array.from(neighbors(local, cities))).toEqual([cities[1]]);
  });

  test('world arrays have independent geography even when they share a queried city', () => {
    const local = city(0, 0);
    const first = [local, city(10, 0, 1000, 500)];
    const second = [local, city(-10, 0, 1000, 1)];
    City.rebuildRegionalMarketIndex(first);
    City.rebuildRegionalMarketIndex(second);
    expect(price(local, first)).toBeGreaterThan(price(local, second));
    expect(Array.from(neighbors(local, first))).toEqual([first[1]]);
    expect(Array.from(neighbors(local, second))).toEqual([second[1]]);
    expect(price(local, first)).toBe(price(local, first.slice()));
  });

  test('unregistered arrays remain live through arbitrary in-place topology edits', () => {
    const local = city(0, 0);
    const cities = [local, city(100, 100)];
    expect(neighbors(local, cities)).toHaveLength(0);
    cities[1].location = { x: 0, y: 10 };
    expect(Array.from(neighbors(local, cities))).toEqual([cities[1]]);
    cities[1] = city(100, 100);
    expect(neighbors(local, cities)).toHaveLength(0);
  });

  test('repeated pricing avoids scanning 600 city locations for every quote', () => {
    let coordinateReads = 0;
    const cities = Array.from({ length: 600 }, (_, i) => {
      const local = city((i % 25) * 40, Math.floor(i / 25) * 40);
      const { x, y } = local.location;
      local.location = {
        get x() { coordinateReads++; return x; },
        get y() { coordinateReads++; return y; },
      };
      return local;
    });
    City.rebuildRegionalMarketIndex(cities);
    for (const local of cities) price(local, cities);
    coordinateReads = 0;
    for (let item = 0; item < 20; item++) {
      for (const local of cities) price(local, cities);
    }
    // Read the quoted city's position for cache validation, independent of
    // the number of cities elsewhere in the world (formerly 7.2M candidates).
    expect(coordinateReads).toBe(20 * 600 * 2);
  });

  test('idle management does no effect work or queue allocation', () => {
    const queue = [];
    const local = {
      management: { buildingQueue: queue },
      _getManagementEffect() { throw new Error('Idle city evaluated construction effects'); },
      getBuildQueueCapacity() { throw new Error('Idle city evaluated construction capacity'); },
    };
    City.prototype.tickManagement.call(local, 16);
    expect(local.management.buildingQueue).toBe(queue);
  });

  test('active construction still advances and completes within queue capacity', () => {
    const active = { progress: 1, buildTime: 2 };
    const waiting = { progress: 0, buildTime: 2 };
    const completed = [];
    const local = {
      management: { buildingQueue: [active, waiting] },
      _getManagementEffect() { return 0; },
      getBuildQueueCapacity() { return 1; },
      _completeBuild(build) { completed.push(build); },
    };
    City.prototype.tickManagement.call(local, 1000);
    expect(completed).toEqual([active]);
    expect(Array.from(local.management.buildingQueue)).toEqual([waiting]);
    expect(waiting.progress).toBe(0);
  });
});
