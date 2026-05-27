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
        trainingQueue: [],
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
      hasLibrary: !!overrides.hasLibrary,
      hasUniversity: !!overrides.hasUniversity,
      hasBlackMarket: !!overrides.hasBlackMarket,
      hasTechNode(key) {
        const researched = overrides.researchedTech || [];
        return researched.includes(key);
      },
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

  test("build queue capacity limits concurrent construction and scales with city strength", () => {
    const city = makeCity({ budget: 2000, population: 100 });
    const cm = new global.window.CityManagement({ cities: [city], player: {} });

    expect(cm.getBuildQueueCapacity(city)).toBe(1);

    const first = cm.enqueueBuild(city, "farm", 180, 48);
    expect(first.ok).toBe(true);

    const blocked = cm.enqueueBuild(city, "housing", 140, 44);
    expect(blocked).toMatchObject({
      ok: false,
      reason: "queue_full",
      current: 1,
      capacity: 1,
    });
    expect(city.management.budget).toBe(1820);
    expect(city.management.buildingQueue).toHaveLength(1);

    const strongerCity = makeCity({
      budget: 4000,
      population: 620,
      researchedTech: ["inf_district_plan"],
      management: {
        upgradeLevels: { wagonDepot: 1 },
        districtEffects: { buildSpeed: 0.4 },
      },
    });
    const strongerCapacity = cm.getBuildQueueCapacity(strongerCity);
    expect(strongerCapacity).toBeGreaterThan(1);
    expect(cm.getBuildQueueStatus(strongerCity)).toMatchObject({
      current: 0,
      capacity: strongerCapacity,
      full: false,
    });
  });

  test("education buildings progress from school to library to university", () => {
    const cm = new global.window.CityManagement({ cities: [], player: {} });

    const earlyCity = makeCity();
    const earlyTypes = new Set(cm.getBuildOptions(earlyCity).map((opt) => opt.type));
    expect(earlyTypes.has("school")).toBe(true);
    expect(earlyTypes.has("library")).toBe(false);
    expect(earlyTypes.has("university")).toBe(false);

    const schoolCity = makeCity({ hasSchool: true });
    const schoolTypes = new Set(cm.getBuildOptions(schoolCity).map((opt) => opt.type));
    expect(schoolTypes.has("school")).toBe(false);
    expect(schoolTypes.has("library")).toBe(true);
    expect(schoolTypes.has("university")).toBe(false);

    const libraryCity = makeCity({ hasSchool: true, hasLibrary: true });
    const libraryTypes = new Set(cm.getBuildOptions(libraryCity).map((opt) => opt.type));
    expect(libraryTypes.has("library")).toBe(false);
    expect(libraryTypes.has("university")).toBe(true);
  });

  test("research lab appears after university once lab output is researched", () => {
    const cm = new global.window.CityManagement({ cities: [], player: {} });
    const city = makeCity({
      hasSchool: true,
      hasLibrary: true,
      hasUniversity: true,
    });
    city.hasTechNode = (key) => key === "sci_lab_output";

    const types = new Set(cm.getBuildOptions(city).map((opt) => opt.type));
    expect(types.has("researchLab")).toBe(true);
  });

  test("transport buildings unlock from wagon and motor research", () => {
    const cm = new global.window.CityManagement({ cities: [], player: {} });

    const wagonCity = makeCity({
      researchedTech: ["trn_wagon_routes"],
    });
    const wagonTypes = new Set(cm.getBuildOptions(wagonCity).map((opt) => opt.type));
    expect(wagonTypes.has("wagonDepot")).toBe(true);
    expect(wagonTypes.has("motorPool")).toBe(false);

    const motorCity = makeCity({
      researchedTech: ["trn_wagon_routes", "trn_motor_pool"],
      management: {
        upgradeLevels: { wagonDepot: 1 },
      },
    });
    const motorTypes = new Set(cm.getBuildOptions(motorCity).map((opt) => opt.type));
    expect(motorTypes.has("wagonDepot")).toBe(false);
    expect(motorTypes.has("motorPool")).toBe(true);
  });
});
