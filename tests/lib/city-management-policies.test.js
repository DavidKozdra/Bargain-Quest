describe("CityManagement policy persistence", () => {
  const prevWindow = global.window;
  const prevWindowCityPolicies = prevWindow && prevWindow.CityPolicies;
  const prevWindowCitySpecialization = prevWindow && prevWindow.CitySpecialization;
  const prevWindowCityManagement = prevWindow && prevWindow.CityManagement;
  const prevGlobalCityPolicies = global.CityPolicies;
  const prevGlobalCitySpecialization = global.CitySpecialization;

  beforeAll(() => {
    global.window = global.window || {};
    if (typeof global.window.addEventListener !== "function") global.window.addEventListener = () => {};
    if (typeof global.window.removeEventListener !== "function") global.window.removeEventListener = () => {};
    require("../../classes/CityPolicies.js");
    require("../../classes/CitySpecialization.js");
    global.CityPolicies = global.window.CityPolicies;
    global.CitySpecialization = global.window.CitySpecialization;
    require("../../classes/CityManagement.js");
  });

  afterAll(() => {
    if (prevWindow === undefined) {
      delete global.window;
    } else {
      global.window = prevWindow;
      if (prevWindowCityPolicies === undefined) delete global.window.CityPolicies;
      else global.window.CityPolicies = prevWindowCityPolicies;
      if (prevWindowCitySpecialization === undefined) delete global.window.CitySpecialization;
      else global.window.CitySpecialization = prevWindowCitySpecialization;
      if (prevWindowCityManagement === undefined) delete global.window.CityManagement;
      else global.window.CityManagement = prevWindowCityManagement;
    }

    if (prevGlobalCityPolicies === undefined) delete global.CityPolicies;
    else global.CityPolicies = prevGlobalCityPolicies;
    if (prevGlobalCitySpecialization === undefined) delete global.CitySpecialization;
    else global.CitySpecialization = prevGlobalCitySpecialization;
  });

  function makeCity(overrides = {}) {
    return {
      name: overrides.name || "Harbor",
      location: overrides.location || { x: 1, y: 1 },
      population: overrides.population || 320,
      inventory: overrides.inventory || new Map(),
      reputation: overrides.reputation || 50,
      management: {
        budget: 700,
        taxRate: 0.05,
        buildingQueue: [],
        upgradeLevels: {},
        routes: [],
        units: [],
        ownerPayoutDue: 0,
        ownerTaxShare: 0.35,
        ...(overrides.management || {}),
      },
      adjustReputation(delta) {
        this.reputation += delta;
      },
    };
  }

  test("active policies survive city-management normalization reads", () => {
    const city = makeCity();
    const cm = new global.window.CityManagement({ cities: [city], player: {} }, {
      notificationManager: { log() {} },
    });

    expect(global.CityPolicies.toggle(city, "culturalFunding")).toBe(true);
    expect(global.CityPolicies.isActive(city, "culturalFunding")).toBe(true);

    cm.getHappiness(city);

    expect(global.CityPolicies.isActive(city, "culturalFunding")).toBe(true);
    expect(city.management.policies).toHaveProperty("culturalFunding", true);
  });

  test("specialization state is preserved and legacy paths are normalized", () => {
    const city = makeCity({
      management: {
        specialization: { path: "tradingHub", tier: 99 },
      },
    });
    const cm = new global.window.CityManagement({ cities: [city], player: {} }, {
      notificationManager: { log() {} },
    });

    cm._ensureManagement(city);

    expect(city.management.specialization).toEqual({ path: "tradeHub", tier: 2 });
  });
});
