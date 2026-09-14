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
      Iron: { name: 'Iron', baseValue: 18, tradable: true },
      Dagger: { name: 'Dagger', baseValue: 25, category: 'Weapon', tradable: true },
      Sword: { name: 'Sword', baseValue: 60, category: 'Weapon', tradable: true },
      Axe: { name: 'Axe', baseValue: 80, category: 'Weapon', tradable: true },
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

  test('research is a prerequisite tree with four useful branches and a shared space goal', () => {
    const city = makeCity();
    const tree = city.getSimpleResearchTree();
    expect(tree.map((branch) => branch.key)).toEqual(['knowledge', 'growth', 'commerce', 'craft', 'future']);
    expect(tree.filter((branch) => branch.key !== 'future').map((branch) => branch.nodes[0].unlocked)).toEqual([true, true, true, false]);
    expect(city.getSimpleResearchLine().find((node) => node.key === 'simple_schools').researchCost).toBe(2);
    expect(city.getSimpleResearchLine().find((node) => node.key === 'simple_universities').researchCost).toBe(10);
    expect(city.getSimpleResearchLine().find((node) => node.key === 'simple_learned_culture').researchCost).toBe(20);
    const lockedUniversity = city.researchSimpleNode('simple_universities');
    expect(lockedUniversity.ok).toBe(false);
    expect(lockedUniversity.reason).toBe('locked');

    city.progression.researchPoints = 200;
    const expected = city.getSimpleResearchLine().map((node) => node.key);
    for (const key of expected) expect(city.researchSimpleNode(key).ok).toBe(true);

    expect(city.getSimpleResearchLine().every((node) => node.completed)).toBe(true);
    expect(city.hasSpaceport).toBe(true);
    expect(city.progression.spaceAccess.launchReady).toBe(true);
  });

  test('ironworking follows schools and unlocks forge construction', () => {
    const city = makeCity();
    city.progression.researchPoints = 20;
    expect(city.researchSimpleNode('simple_forging').reason).toBe('locked');
    expect(city.researchSimpleNode('simple_schools').ok).toBe(true);
    expect(city.researchSimpleNode('simple_forging').ok).toBe(true);
    city._completeBuild({ type: 'forge' });
    expect(city.management.upgradeLevels.forge).toBe(1);
  });

  test('managed market stores custom sale prices and purchase demand', () => {
    const city = makeCity();
    city.inventory.set('Iron', { item: global.ItemLibrary.Iron, quantity: 12 });
    const defaultSale = city.getManagedSaleQuote('Iron', [city]);
    expect(defaultSale.custom).toBe(false);

    expect(city.setManagedSalePrice('Iron', 7).ok).toBe(true);
    expect(city.getManagedSaleQuote('Iron', [city]).price).toBe(7);

    expect(city.setManagedDemandOrder('Iron', 20, 15).ok).toBe(true);
    const demand = city.getManagedDemandQuote('Iron', [city]);
    expect(demand.active).toBe(true);
    expect(demand.remaining).toBe(8);
    expect(demand.price).toBe(15);
  });

  test('multitasking is the only managed-city second build slot', () => {
    const city = makeCity();
    expect(city.getBuildQueueCapacity()).toBe(1);
    city.progression.researchPoints = 100;
    for (const key of ['simple_winery', 'simple_crop_rotation', 'simple_town_planning', 'simple_multitasking']) {
      city.researchSimpleNode(key);
    }
    expect(city.getBuildQueueCapacity()).toBe(2);
  });

  test('managed-city construction advances at three times the default speed', () => {
    const city = makeCity();
    city.management.buildingQueue = [{ type: 'farm', progress: 0, buildTime: 30 }];

    city.tickManagement(1000);

    expect(city.management.buildingQueue[0].progress).toBe(3);
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

    city.progression.researchPoints = 10;
    city.researchSimpleNode('simple_marketplaces');
    expect(city.computeTaxRevenue(1).marketIncome).toBe(36);
  });

  test('universities are unlocked for 10 RP and add six research per day once built', () => {
    const city = makeCity();
    city.progression.researchPoints = 20;
    expect(city.researchSimpleNode('simple_schools').ok).toBe(true);
    expect(city.researchSimpleNode('simple_universities').ok).toBe(true);
    const before = city.getResearchIncome();

    city._completeBuild({ type: 'university' });

    expect(city.hasUniversity).toBe(true);
    expect(city.getResearchIncome()).toBe(before + 6);
  });

  test('growth research improves farm yield and housing capacity', () => {
    const city = makeCity();
    city.population = 100;
    city.management.upgradeLevels = { farm: 1, housing: 1 };
    const baseCap = city.getPopulationCap();
    city.progression.researchPoints = 100;
    city.researchSimpleNode('simple_winery');
    city.researchSimpleNode('simple_crop_rotation');
    city.researchSimpleNode('simple_town_planning');
    city.inventory.delete('Wheat');

    city._applyManagedBuildingProduction();

    expect(city.inventory.get('Wheat').quantity).toBe(8);
    expect(city.getPopulationCap()).toBe(baseCap + 60);
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
