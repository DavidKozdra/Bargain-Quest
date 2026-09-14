describe('minimal managed-city progression', () => {
  const previousWindow = global.window;
  const previousItemLibrary = global.ItemLibrary;
  const previousNotificationManager = global.notificationManager;
  let City;

  beforeAll(() => {
    global.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      DIFFICULTY_CONFIG: {},
    };
    global.ItemLibrary = {
      Wheat: { name: 'Wheat', baseValue: 5 },
      Fish: { name: 'Fish', baseValue: 5 },
      Wine: { name: 'Wine', baseValue: 12 },
    };
    global.notificationManager = { log: jest.fn() };
    delete require.cache[require.resolve('../../classes/Cities.js')];
    require('../../classes/Cities.js');
    City = global.window.City;
  });

  afterAll(() => {
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
    if (previousItemLibrary === undefined) delete global.ItemLibrary;
    else global.ItemLibrary = previousItemLibrary;
    if (previousNotificationManager === undefined) delete global.notificationManager;
    else global.notificationManager = previousNotificationManager;
  });

  function makeCity() {
    const city = new City({ name: 'Smalltown', location: { x: 1, y: 1 }, population: 100, stockProfile: 'founded' });
    city._isManagedCity = true;
    return city;
  }

  test('research is one ordered five-step line', () => {
    const city = makeCity();
    const expected = ['simple_winery', 'simple_schools', 'simple_multitasking', 'simple_trade', 'simple_space'];
    expect(city.getSimpleResearchLine().map((node) => node.key)).toEqual(expected);
    expect(city.getSimpleResearchLine().map((node) => node.unlocked)).toEqual([true, false, false, false, false]);

    city.progression.researchPoints = 100;
    for (const key of expected) expect(city.researchSimpleNode(key).ok).toBe(true);

    expect(city.getSimpleResearchLine().every((node) => node.completed)).toBe(true);
    expect(city.hasSpaceport).toBe(true);
    expect(city.progression.spaceAccess.launchReady).toBe(true);
  });

  test('multitasking is the only managed-city second build slot', () => {
    const city = makeCity();
    expect(city.getBuildQueueCapacity()).toBe(1);
    city.progression.researchPoints = 100;
    for (const key of ['simple_winery', 'simple_schools', 'simple_multitasking']) {
      city.researchSimpleNode(key);
    }
    expect(city.getBuildQueueCapacity()).toBe(2);
  });

  test('farms and wineries both add food while wineries also add wine', () => {
    const city = makeCity();
    city.management.upgradeLevels = { farm: 1, winery: 1 };
    city.hasWinery = true;

    city._applyManagedBuildingProduction();

    expect(city.inventory.get('Wheat').quantity).toBeGreaterThanOrEqual(7);
    expect(city.inventory.get('Wine').quantity).toBe(1);
  });

  test('managed-city taxes go directly into the city treasury', () => {
    const city = makeCity();
    city.population = 100;
    city.reputation = 50;
    city.inventory = new Map([['Wheat', { quantity: 100 }]]);
    city.management.budget = 10;
    city.management.ownerPayoutDue = 12;
    city.management.ownerTaxShare = 0.8;
    city.management.taxRate = 0.25;

    const revenue = city.applyWeeklyTax(1);

    expect(revenue).toBeGreaterThan(0);
    expect(city.management.budget).toBe(10 + 12 + revenue);
    expect(city.management.ownerPayoutDue).toBe(0);
  });

  test('each market level adds 12 gold of direct daily income', () => {
    const city = makeCity();
    city.inventory = new Map([['Wheat', { quantity: 100 }]]);
    city.management.budget = 0;
    city.management.taxRate = 0;
    city.management.upgradeLevels.market = 2;

    const preview = city.computeTaxRevenue(1);
    const income = city.applyWeeklyTax(1);

    expect(preview.marketIncome).toBe(24);
    expect(income).toBe(preview.totalIncome);
    expect(city.management.budget).toBe(preview.totalIncome);
  });

  test('a lower tax rate produces faster happy-city population growth', () => {
    const city = makeCity();
    city.population = 1000;
    city.basePopulationCap = 2000;
    city.getPopulationCap = () => 2000;
    city.inventory = new Map([['Wheat', { quantity: 10000 }]]);
    city.management.taxRate = 0;
    city.growPopulation();
    const lowTaxPopulation = city.population;

    city.population = 1000;
    city.inventory = new Map([['Wheat', { quantity: 10000 }]]);
    city.management.taxRate = 0.25;
    city.growPopulation();

    expect(lowTaxPopulation).toBeGreaterThan(city.population);
  });
});
