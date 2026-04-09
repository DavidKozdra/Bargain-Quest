describe("CityManagement build option balance", () => {
  const prevWindow = global.window;
  const prevWindowCityManagement = prevWindow && prevWindow.CityManagement;

  beforeAll(() => {
    global.window = global.window || {};
    if (typeof global.window.addEventListener !== "function") global.window.addEventListener = () => {};
    if (typeof global.window.removeEventListener !== "function") global.window.removeEventListener = () => {};
    require("../../classes/CityManagement.js");
  });

  afterAll(() => {
    if (prevWindow === undefined) {
      delete global.window;
    } else {
      global.window = prevWindow;
      if (prevWindowCityManagement === undefined) delete global.window.CityManagement;
      else global.window.CityManagement = prevWindowCityManagement;
    }
  });

  function makeCity(overrides = {}) {
    return {
      name: overrides.name || "Harbor",
      location: overrides.location || { x: 1, y: 1 },
      population: overrides.population || 100,
      inventory: overrides.inventory || new Map(),
      management: {
        budget: overrides.budget !== undefined ? overrides.budget : 600,
        taxRate: 0.05,
        buildingQueue: [],
        upgradeLevels: {},
        routes: [],
        units: [],
        ownerPayoutDue: 0,
        ownerTaxShare: 0.35,
        ...(overrides.management || {}),
      },
      hasBank: !!overrides.hasBank,
      hasGamblingDen: !!overrides.hasGamblingDen,
      hasBountyBoard: !!overrides.hasBountyBoard,
      hasWeaponShop: !!overrides.hasWeaponShop,
      hasWinery: !!overrides.hasWinery,
      hasSchool: !!overrides.hasSchool,
      hasBlackMarket: !!overrides.hasBlackMarket,
    };
  }

  test("starter treasury can afford core unlocks plus early growth upgrades", () => {
    const city = makeCity();
    const cm = new global.window.CityManagement({ cities: [city], player: {} });
    const options = cm.getBuildOptions(city);
    const byType = Object.fromEntries(options.map((opt) => [opt.type, opt]));

    expect(byType.bank.cost).toBeLessThanOrEqual(600);
    expect(byType.weaponShop.cost).toBeLessThanOrEqual(600);
    expect(byType.school.cost).toBeLessThanOrEqual(600);
    expect(byType.housing.cost).toBeLessThan(byType.bank.cost);
    expect(byType.farm.cost).toBeLessThan(byType.weaponShop.cost);
    expect(byType.walls.cost).toBeLessThanOrEqual(600);
  });

  test("build options expose grouping metadata for the project board", () => {
    const city = makeCity({ hasBlackMarket: true });
    const cm = new global.window.CityManagement({ cities: [city], player: {} });
    const options = cm.getBuildOptions(city);
    const byType = Object.fromEntries(options.map((opt) => [opt.type, opt]));

    expect(byType.bank).toMatchObject({ group: "economy", repeatable: false });
    expect(byType.housing).toMatchObject({ group: "growth", repeatable: true });
    expect(byType.walls).toMatchObject({ group: "defense", repeatable: true });
    expect(byType.school).toMatchObject({ group: "civic", repeatable: false });
    expect(byType.removeBlackMarket).toMatchObject({ group: "cleanup", repeatable: false });
    expect(byType.bank.highlights.length).toBeGreaterThan(0);
  });
});
