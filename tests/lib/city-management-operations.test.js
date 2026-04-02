describe("CityManagement focus and operations", () => {
  const prevWindow = global.window;
  const prevWindowCityManagement = prevWindow && prevWindow.CityManagement;
  const prevWindowDiplomacySystem = prevWindow && prevWindow.DiplomacySystem;
  const prevGlobalDiplomacySystem = global.DiplomacySystem;
  const prevDayNight = global.dayNight;
  const prevItemLibrary = global.ItemLibrary;

  beforeAll(() => {
    global.window = global.window || {};
    if (typeof global.window.addEventListener !== "function") global.window.addEventListener = () => {};
    if (typeof global.window.removeEventListener !== "function") global.window.removeEventListener = () => {};
    global.ItemLibrary = {
      Wine: { baseValue: 12 },
      Wheat: { baseValue: 4 },
      Fish: { baseValue: 5 },
      Tools: { baseValue: 20 },
    };
    require("../../classes/DiplomacySystem.js");
    global.DiplomacySystem = global.window.DiplomacySystem;
    require("../../classes/CityManagement.js");
  });

  afterAll(() => {
    if (prevWindow === undefined) {
      delete global.window;
    } else {
      global.window = prevWindow;
      if (prevWindowCityManagement === undefined) delete global.window.CityManagement;
      else global.window.CityManagement = prevWindowCityManagement;
      if (prevWindowDiplomacySystem === undefined) delete global.window.DiplomacySystem;
      else global.window.DiplomacySystem = prevWindowDiplomacySystem;
    }

    if (prevGlobalDiplomacySystem === undefined) delete global.DiplomacySystem;
    else global.DiplomacySystem = prevGlobalDiplomacySystem;

    if (prevDayNight === undefined) delete global.dayNight;
    else global.dayNight = prevDayNight;

    if (prevItemLibrary === undefined) delete global.ItemLibrary;
    else global.ItemLibrary = prevItemLibrary;
  });

  function makeCity(name, overrides = {}) {
    const city = {
      name,
      location: overrides.location || { x: 1, y: 1 },
      population: overrides.population || 200,
      inventory: overrides.inventory || new Map([
        ["Wine", { quantity: 3 }],
        ["Wheat", { quantity: 20 }],
      ]),
      management: {
        budget: 900,
        taxRate: 0.05,
        buildingQueue: [],
        upgradeLevels: { farm: 1 },
        routes: [],
        units: [],
        ownerPayoutDue: 0,
        ownerTaxShare: 0.35,
        ...(overrides.management || {}),
      },
      reputation: overrides.reputation || 55,
      isCoastal: overrides.isCoastal !== undefined ? overrides.isCoastal : true,
      hasBank: overrides.hasBank !== undefined ? overrides.hasBank : true,
      hasSchool: !!overrides.hasSchool,
      hasWinery: overrides.hasWinery !== undefined ? overrides.hasWinery : true,
      hasWeaponShop: overrides.hasWeaponShop !== undefined ? overrides.hasWeaponShop : true,
      hasBlackMarket: !!overrides.hasBlackMarket,
      hasBountyBoard: !!overrides.hasBountyBoard,
      _addOrIncrement(key, qty) {
        const existing = this.inventory.get(key);
        if (existing) existing.quantity += qty;
        else this.inventory.set(key, { quantity: qty });
      },
      adjustReputation(delta) {
        this.reputation += delta;
      },
    };
    return city;
  }

  test("focus and founders festival make the city happier and create timed bonuses", () => {
    let currentDay = 1;
    global.dayNight = {
      getDaysElapsed() {
        return currentDay;
      },
    };

    const city = makeCity("Harbor");
    const world = { cities: [city], player: {} };
    const cm = new global.window.CityManagement(world, {
      dayNight: global.dayNight,
      notificationManager: { log() {} },
    });
    cm.myCity = city;
    cm.isSettled = true;
    cm._nextQuestDay = 999;
    cm._nextEventDay = 999;
    cm._nextAIDecisionDay = 999;

    const baseHappiness = cm.getHappiness(city);
    const focusRes = cm.setCityFocus(city, "civic");
    expect(focusRes.ok).toBe(true);
    expect(cm.getHappiness(city)).toBeGreaterThan(baseHappiness);

    const start = cm.startCityOperation(city, "founders_festival");
    expect(start.ok).toBe(true);
    expect(city.management.activeOperations).toHaveLength(1);

    currentDay = 5;
    cm._processDaily(currentDay);

    expect(city.management.activeOperations).toHaveLength(0);
    expect(city.management.operationBuffs.length).toBeGreaterThan(0);
    expect(city.population).toBeGreaterThan(200);
    expect(city.management.operationCooldowns.founders_festival).toBeGreaterThan(currentDay);
    expect(cm.getActiveCityBonuses(city)[0].label).toBe("Festival Spirit");
  });

  test("caravan surge completion amplifies trade-route income", () => {
    let currentDay = 1;
    global.dayNight = {
      getDaysElapsed() {
        return currentDay;
      },
    };

    const city = makeCity("Harbor", {
      management: {
        routes: [{
          destName: "Rival",
          frequencyDays: 3,
          lastTransferDay: 0,
          goldPerTransfer: 120,
          goodsPerTransfer: 0,
          itemsToSend: [],
          _goodsCarry: 0,
          _goldCarry: 0,
        }],
      },
    });
    const rival = makeCity("Rival", {
      location: { x: 4, y: 1 },
      inventory: new Map(),
      management: { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [], units: [], ownerPayoutDue: 0, ownerTaxShare: 0.35 },
      isCoastal: false,
      hasBank: false,
      hasWinery: false,
      hasWeaponShop: false,
    });
    const world = { cities: [city, rival], player: {} };
    const cm = new global.window.CityManagement(world, {
      dayNight: global.dayNight,
      notificationManager: { log() {} },
    });
    cm.myCity = city;
    cm.isSettled = true;
    cm._nextQuestDay = 999;
    cm._nextEventDay = 999;
    cm._nextAIDecisionDay = 999;

    const start = cm.startCityOperation(city, "caravan_surge");
    expect(start.ok).toBe(true);

    currentDay = 4;
    cm._processDaily(currentDay);

    const before = city.management.budget;
    cm._processRoutes(city, currentDay + 1);
    const gain = city.management.budget - before;

    expect(gain).toBeGreaterThan(40);
    expect(cm.getCityScalarEffect(city, "routeIncome")).toBeGreaterThan(0);
  });

  test("trade routes create live convoy snapshots and resolve on arrival", () => {
    let currentDay = 1;
    global.dayNight = {
      getDaysElapsed() {
        return currentDay;
      },
    };

    const city = makeCity("Harbor", {
      inventory: new Map([["Wheat", { quantity: 40 }]]),
      management: { budget: 300 },
    });
    const rival = makeCity("Rival", {
      location: { x: 9, y: 1 },
      inventory: new Map(),
      management: { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [], units: [], ownerPayoutDue: 0, ownerTaxShare: 0.35 },
      isCoastal: false,
      hasBank: false,
      hasWinery: false,
      hasWeaponShop: false,
    });
    const world = { cities: [city, rival], player: {} };
    const cm = new global.window.CityManagement(world, {
      dayNight: global.dayNight,
      notificationManager: { log() {} },
    });
    cm.myCity = city;
    cm.isSettled = true;
    cm._nextQuestDay = 999;
    cm._nextEventDay = 999;
    cm._nextAIDecisionDay = 999;

    const routeRes = cm.createTradeRoute(city, rival, {
      frequencyDays: 2,
      goldPerTransfer: 100,
      goodsPerTransfer: 5,
      itemsToSend: ["Wheat"],
    });
    expect(routeRes.ok).toBe(true);

    currentDay = 2;
    cm._processRoutes(city, currentDay);
    let snaps = cm.getRouteSnapshots(city, currentDay);
    expect(snaps[0].activeShipment).toBeTruthy();
    expect(snaps[0].activeShipment.manifestLabel).toContain("Wheat");

    currentDay = snaps[0].activeShipment.arrivalDay;
    cm._processRoutes(city, currentDay);
    snaps = cm.getRouteSnapshots(city, currentDay);

    expect(snaps[0].lastShipment).toBeTruthy();
    expect(snaps[0].shipmentHistory.length).toBeGreaterThan(0);
    expect(snaps[0].route.shipmentsCompleted + snaps[0].route.shipmentsLost).toBeGreaterThan(0);
  });

  test("directives spawn from pressure and complete when the city fixes the issue", () => {
    let currentDay = 1;
    global.dayNight = {
      getDaysElapsed() {
        return currentDay;
      },
    };

    const city = makeCity("Granary", {
      inventory: new Map([["Wheat", { quantity: 4 }]]),
      management: {
        budget: 500,
        routes: [],
      },
      population: 180,
    });
    const world = { cities: [city], player: {} };
    const cm = new global.window.CityManagement(world, {
      dayNight: global.dayNight,
      notificationManager: { log() {} },
    });
    cm.myCity = city;
    cm.isSettled = true;
    cm._nextQuestDay = 999;
    cm._nextEventDay = 999;
    cm._nextAIDecisionDay = 999;

    currentDay = 2;
    cm._processDaily(currentDay);

    const directives = cm.getCityDirectives(city);
    expect(directives.length).toBeGreaterThan(0);
    expect(directives[0].key).toBe("stock_granaries");

    city._addOrIncrement("Wheat", 120);
    currentDay = 3;
    cm._processDaily(currentDay);

    const nextDirectives = cm.getCityDirectives(city);
    expect(nextDirectives.some((entry) => entry.key === "stock_granaries")).toBe(false);
    const history = cm.getCityDirectiveHistory(city);
    expect(history[0]).toMatchObject({
      key: "stock_granaries",
      status: "completed",
    });
    expect(city.management.budget).toBeGreaterThan(500);
  });

  test("district projects create permanent city identity and bonuses", () => {
    let currentDay = 1;
    global.dayNight = {
      getDaysElapsed() {
        return currentDay;
      },
    };

    const city = makeCity("Harbor", {
      management: {
        budget: 2200,
        routes: [],
        buildingQueue: [],
      },
      isCoastal: true,
    });
    const world = { cities: [city], player: {} };
    const cm = new global.window.CityManagement(world, {
      dayNight: global.dayNight,
      notificationManager: { log() {} },
    });
    cm.myCity = city;
    cm.isSettled = true;
    cm._nextQuestDay = 999;
    cm._nextEventDay = 999;
    cm._nextAIDecisionDay = 999;

    const marketRes = cm.queueDistrictProject(city, "market");
    expect(marketRes.ok).toBe(true);
    expect(city.management.buildingQueue[0]).toMatchObject({
      type: "district:market",
    });

    city.management.buildingQueue = [];
    city.management.districts = { market: 1, granary: 1 };
    city.management.districtEffects = global.window.CityManagement.computeDistrictEffects(city.management.districts);

    const districts = cm.getCityDistricts(city);
    expect(districts.find((entry) => entry.key === "market")).toMatchObject({
      currentTier: 1,
      canUpgrade: true,
    });
    expect(cm.getCityScalarEffect(city, "routeIncome")).toBeGreaterThanOrEqual(0.1);
    expect(cm.getCityScalarEffect(city, "foodSaving")).toBeGreaterThanOrEqual(0.12);
    expect(cm.getCityScalarEffect(city, "happiness")).toBeGreaterThanOrEqual(1);

    const inland = makeCity("Hillfort", {
      management: { budget: 1500, routes: [], buildingQueue: [] },
      isCoastal: false,
    });
    const harborDistrict = cm.getCityDistricts(inland).find((entry) => entry.key === "harbor");
    expect(harborDistrict.canUpgrade).toBe(false);
    expect(harborDistrict.lockedReason).toBe("Requires a coastal city.");
  });

  test("district synergies become readable city traits", () => {
    let currentDay = 8;
    global.dayNight = {
      getDaysElapsed() {
        return currentDay;
      },
    };

    const city = makeCity("Port Prosper", {
      management: {
        budget: 1400,
        routes: [{
          destName: "Rival",
          frequencyDays: 3,
          goldPerTransfer: 100,
          goodsPerTransfer: 5,
          itemsToSend: ["Wheat"],
        }],
        districts: { market: 2, harbor: 1, crafts: 1 },
      },
      isCoastal: true,
    });
    city.management.districtEffects = global.window.CityManagement.computeDistrictEffects(city.management.districts);

    const world = { cities: [city], player: {} };
    const cm = new global.window.CityManagement(world, {
      dayNight: global.dayNight,
      notificationManager: { log() {} },
    });

    const synergies = cm.getCityDistrictSynergies(city);
    const keys = synergies.map((entry) => entry.key);
    expect(keys.includes("portside_exchange")).toBe(true);
    expect(keys.includes("guild_showcase")).toBe(true);
    const portside = synergies.find((entry) => entry.key === "portside_exchange");
    expect(portside.districtStates.map((entry) => entry.key)).toEqual(["market", "harbor"]);
    expect(portside.tierTotal).toBe(3);
  });

  test("district synergy events grant lasting city buffs", () => {
    let currentDay = 9;
    global.dayNight = {
      getDaysElapsed() {
        return currentDay;
      },
    };

    const city = makeCity("Port Prosper", {
      management: {
        budget: 1800,
        routes: [{
          destName: "Rival",
          frequencyDays: 3,
          goldPerTransfer: 120,
          goodsPerTransfer: 5,
          itemsToSend: ["Wheat"],
        }],
        districts: { market: 2, harbor: 2 },
      },
      isCoastal: true,
    });
    city.management.districtEffects = global.window.CityManagement.computeDistrictEffects(city.management.districts);

    const world = { cities: [city], player: {} };
    const cm = new global.window.CityManagement(world, {
      dayNight: global.dayNight,
      notificationManager: { log() {} },
    });
    cm.myCity = city;
    cm.isSettled = true;

    const event = cm._initCityEvents().find((entry) => entry.name === "Portside Exchange");
    expect(event).toBeTruthy();
    expect(cm._isCityEventEligible(event, city, currentDay)).toBe(true);

    const result = event.resolve(city, 0, cm);
    expect(result.type).toBe("success");
    const buff = cm.getActiveCityBonuses(city, currentDay).find((entry) => entry.key === "exchange_season");
    expect(buff).toBeTruthy();
    expect(buff.effects.routeIncome).toBeGreaterThan(0.2);
    expect(city.inventory.get("Spices")?.quantity || 0).toBeGreaterThan(0);
  });

  test("district synergies create focused directives under pressure", () => {
    let currentDay = 4;
    global.dayNight = {
      getDaysElapsed() {
        return currentDay;
      },
    };

    const city = makeCity("Port Prosper", {
      location: { x: 1, y: 1 },
      management: {
        budget: 1200,
        routes: [
          { destName: "Rival A", frequencyDays: 3, goldPerTransfer: 100, goodsPerTransfer: 5, itemsToSend: ["Wheat"] },
          { destName: "Rival B", frequencyDays: 4, goldPerTransfer: 90, goodsPerTransfer: 4, itemsToSend: ["Wine"] },
        ],
        districts: { market: 2, harbor: 1 },
        units: [],
      },
      isCoastal: true,
    });
    city.management.districtEffects = global.window.CityManagement.computeDistrictEffects(city.management.districts);

    const rivalA = makeCity("Rival A", {
      location: { x: 5, y: 2 },
      management: { budget: 500, routes: [], units: [{ hp: 10 }, { hp: 10 }] },
      isCoastal: true,
    });
    const rivalB = makeCity("Rival B", {
      location: { x: 6, y: 1 },
      management: { budget: 500, routes: [], units: [{ hp: 10 }] },
      isCoastal: true,
    });

    const world = { cities: [city, rivalA, rivalB], player: {} };
    const cm = new global.window.CityManagement(world, {
      dayNight: global.dayNight,
      notificationManager: { log() {} },
    });
    cm.myCity = city;
    cm.isSettled = true;
    cm._nextQuestDay = 999;
    cm._nextEventDay = 999;
    cm._nextAIDecisionDay = 999;

    const pressures = cm.getCityPressures(city);
    expect(pressures.some((entry) => entry.directiveKey === "secure_convoys")).toBe(true);

    cm._updateCityDirectives(city, currentDay);
    const directives = cm.getCityDirectives(city);
    expect(directives.some((entry) => entry.key === "secure_convoys")).toBe(true);
  });

  test("trade hubs can attract privateer incidents on routes", () => {
    let currentDay = 6;
    global.dayNight = {
      getDaysElapsed() {
        return currentDay;
      },
    };

    const city = makeCity("Port Prosper", {
      management: {
        budget: 900,
        districts: { market: 2, harbor: 2 },
      },
      isCoastal: true,
    });
    city.management.districtEffects = global.window.CityManagement.computeDistrictEffects(city.management.districts);

    const rival = makeCity("Rival", {
      location: { x: 10, y: 2 },
      management: { budget: 300, routes: [], units: [] },
      isCoastal: true,
    });

    const world = { cities: [city, rival], player: {} };
    const cm = new global.window.CityManagement(world, {
      dayNight: global.dayNight,
      notificationManager: { log() {} },
    });

    const originalRandom = Math.random;
    const rolls = [0.95, 0.2];
    Math.random = () => (rolls.length > 0 ? rolls.shift() : 0.2);
    try {
      const incident = cm._rollRouteIncident(12, 0.4, city, rival);
      expect(incident.key).toBe("privateers");
      expect(incident.label).toBe("Privateer Hit");
    } finally {
      Math.random = originalRandom;
    }
  });

  test("city threat report surfaces hot lanes and top rivals", () => {
    let currentDay = 7;
    global.dayNight = {
      getDaysElapsed() {
        return currentDay;
      },
    };

    const city = makeCity("Port Prosper", {
      location: { x: 1, y: 1 },
      management: {
        budget: 1000,
        routes: [{
          destName: "Rival Port",
          frequencyDays: 3,
          goldPerTransfer: 120,
          goodsPerTransfer: 5,
          itemsToSend: ["Wheat"],
          shipmentsCompleted: 1,
          shipmentsLost: 2,
        }],
        districts: { market: 2, harbor: 2 },
      },
      isCoastal: true,
    });
    city.management.districtEffects = global.window.CityManagement.computeDistrictEffects(city.management.districts);

    const rivalPort = makeCity("Rival Port", {
      location: { x: 8, y: 2 },
      management: { budget: 500, routes: [], units: [{ hp: 10 }, { hp: 10 }, { hp: 10 }] },
      isCoastal: true,
    });
    const inlandRival = makeCity("Hillfort", {
      location: { x: 6, y: 1 },
      management: { budget: 400, routes: [], units: [{ hp: 10 }] },
      isCoastal: false,
    });

    const world = { cities: [city, rivalPort, inlandRival], player: {} };
    const cm = new global.window.CityManagement(world, {
      dayNight: global.dayNight,
      notificationManager: { log() {} },
    });
    cm.myCity = city;
    cm.isSettled = true;

    const report = cm.getCityThreatReport(city, currentDay);
    expect(report.hottestRoute).toBeTruthy();
    expect(report.hottestRoute.route.destName).toBe("Rival Port");
    expect(report.hottestRoute.threatScore).toBeGreaterThan(2);
    expect(report.topRival).toBeTruthy();
    expect(["Rival Port", "Hillfort"]).toContain(report.topRival.city.name);
  });

  test("strategic diplomacy can form trade pacts on calm lanes", () => {
    let currentDay = 10;
    global.dayNight = {
      getDaysElapsed() {
        return currentDay;
      },
    };

    const city = makeCity("Capital", {
      location: { x: 1, y: 1 },
      management: {
        budget: 1200,
        routes: [{
          destName: "Harbor Ally",
          frequencyDays: 3,
          goldPerTransfer: 90,
          goodsPerTransfer: 4,
          itemsToSend: ["Wine"],
          shipmentsCompleted: 3,
          shipmentsLost: 0,
        }],
        districts: {},
      },
      isCoastal: true,
    });
    city.management.districtEffects = global.window.CityManagement.computeDistrictEffects(city.management.districts);

    const ally = makeCity("Harbor Ally", {
      location: { x: 4, y: 1 },
      management: { budget: 600, routes: [], units: [] },
      isCoastal: true,
    });

    const world = { cities: [city, ally], player: {} };
    const cm = new global.window.CityManagement(world, {
      dayNight: global.dayNight,
      notificationManager: { log() {} },
    });
    cm.myCity = city;
    cm.isSettled = true;

    cm.diplomacy.adjustScore("Harbor Ally", 18);

    const actions = cm._runStrategicDiplomacy(city, currentDay);
    expect(actions.length).toBeGreaterThan(0);
    expect(cm.diplomacy.hasPact("Harbor Ally", "trade_pact")).toBe(true);
    expect(cm.diplomacy.getStrategicNote("Harbor Ally")).toContain("Trade lane");
  });

  test("strategic diplomacy can harden against threatening rivals", () => {
    let currentDay = 10;
    global.dayNight = {
      getDaysElapsed() {
        return currentDay;
      },
    };

    const city = makeCity("Capital", {
      location: { x: 1, y: 1 },
      management: {
        budget: 1200,
        routes: [],
        districts: {},
      },
      isCoastal: true,
    });
    city.management.districtEffects = global.window.CityManagement.computeDistrictEffects(city.management.districts);

    const rival = makeCity("Border Host", {
      location: { x: 6, y: 1 },
      management: { budget: 700, routes: [], units: [{ hp: 10 }, { hp: 10 }, { hp: 10 }] },
      isCoastal: false,
    });

    const world = { cities: [city, rival], player: {} };
    const cm = new global.window.CityManagement(world, {
      dayNight: global.dayNight,
      notificationManager: { log() {} },
    });
    cm.myCity = city;
    cm.isSettled = true;
    cm.diplomacy.adjustScore("Border Host", -28);

    const actions = cm._runStrategicDiplomacy(city, currentDay);
    expect(actions.length).toBeGreaterThan(0);
    expect(
      cm.diplomacy.hasPact("Border Host", "embargo")
      || cm.diplomacy.hasPact("Border Host", "rivalry")
    ).toBe(true);
    expect(cm.diplomacy.getStrategicNote("Border Host")).toContain("rival");
  });

  test("live unit roster is exposed and emits a change event when persisted", () => {
    let currentDay = 11;
    global.dayNight = {
      getDaysElapsed() {
        return currentDay;
      },
    };

    const city = makeCity("Capital", {
      management: {
        budget: 1200,
        routes: [],
        units: [{ id: 7, name: "Guard #7", hp: 12, maxHp: 16, level: 1, state: "idle" }],
      },
    });
    const world = { cities: [city], player: {} };
    const cm = new global.window.CityManagement(world, {
      dayNight: global.dayNight,
      notificationManager: { log() {} },
    });

    const dispatches = [];
    const prevDispatchEvent = global.window.dispatchEvent;
    global.window.dispatchEvent = (evt) => {
      dispatches.push(evt);
      return true;
    };

    try {
      cm.unitManager = {
        units: [{
          id: 7,
          name: "Guard #7",
          hp: 5,
          maxHp: 16,
          level: 2,
          state: "fighting",
          selected: true,
        }],
        toJSON() {
          return this.units.map((unit) => ({ ...unit }));
        },
      };
      cm._unitCityRef = city;

      expect(cm.getUnitsForCity(city)[0]).toMatchObject({
        hp: 5,
        maxHp: 16,
        state: "fighting",
      });

      cm._persistUnitsForCity(city);

      expect(city.management.units[0]).toMatchObject({
        hp: 5,
        maxHp: 16,
        state: "fighting",
      });
      expect(dispatches.length).toBeGreaterThan(0);
      const evt = dispatches[dispatches.length - 1];
      expect(evt.type).toBe("citymgmt:units-changed");
      expect(evt.detail).toMatchObject({
        cityName: "Capital",
        reason: "persisted",
      });
      expect(evt.detail.units[0]).toMatchObject({
        hp: 5,
        maxHp: 16,
        state: "fighting",
        selected: true,
      });
    } finally {
      global.window.dispatchEvent = prevDispatchEvent;
    }
  });
});
