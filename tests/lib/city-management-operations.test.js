describe("CityManagement focus and operations", () => {
  const prevWindow = global.window;
  const prevWindowCityManagement = prevWindow && prevWindow.CityManagement;
  const prevWindowDiplomacySystem = prevWindow && prevWindow.DiplomacySystem;
  const prevGlobalDiplomacySystem = global.DiplomacySystem;
  const prevDayNight = global.dayNight;
  const prevItemLibrary = global.ItemLibrary;
  const prevCityUnit = global.CityUnit;

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
    global.CityUnit = global.CityUnit || class CityUnitStub {
      constructor(props = {}) {
        Object.assign(this, props);
        this.selected = !!props.selected;
        this._combatCooldown = props._combatCooldown || 0;
        this.state = props.state || "idle";
      }
    };
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

    if (prevCityUnit === undefined) delete global.CityUnit;
    else global.CityUnit = prevCityUnit;
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
        trainingQueue: [],
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
      port: overrides.port !== undefined ? overrides.port : true,
      _addOrIncrement(key, qty) {
        const existing = this.inventory.get(key);
        if (existing) existing.quantity += qty;
        else this.inventory.set(key, { quantity: qty });
      },
      adjustReputation(delta) {
        this.reputation += delta;
      },
      hasTechNode(key) {
        const researched = overrides.researchedTech || [];
        return researched.includes(key);
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

    const previousRandom = Math.random;
    let gain = 0;
    try {
      // This test covers the operation's income multiplier, not random convoy loss.
      Math.random = () => 0;
      currentDay = 4;
      cm._processDaily(currentDay);

      const before = city.management.budget;
      cm._processRoutes(city, currentDay + 1);
      gain = city.management.budget - before;
    } finally {
      Math.random = previousRandom;
    }

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

  test("removing a route returns cargo from an active convoy", () => {
    const city = makeCity("Harbor", {
      inventory: new Map([["Wheat", { quantity: 6 }]]),
      management: {
        routes: [{
          destName: "Rival",
          activeShipment: {
            manifest: [{ itemKey: "Wheat", qty: 4 }],
            departedDay: 2,
            arrivalDay: 4,
          },
          shipmentHistory: [{ success: true, goldNet: 20 }],
        }],
      },
    });
    const cm = new global.window.CityManagement({ cities: [city], player: {} }, {
      notificationManager: { log() {} },
    });

    const result = cm.removeTradeRoute(city, 0);

    expect(result.ok).toBe(true);
    expect(result.returnedManifest).toMatchObject([{ itemKey: "Wheat", qty: 4 }]);
    expect(city.inventory.get("Wheat").quantity).toBe(10);
    expect(city.management.routes).toHaveLength(0);
    expect(result.message).toBe("Trade route to Rival removed. In-transit cargo was returned to city storage.");
  });

  test("researched infrastructure and defense nodes feed live city build and military scaling", () => {
    const city = makeCity("Harbor");
    city.progression = {
      techEffects: {
        buildSpeed: 0.25,
        unitCap: 2,
        unitCostDiscount: 0.15,
        unitTrainSpeed: 0.2,
      },
    };

    const world = { cities: [city], player: {} };
    const cm = new global.window.CityManagement(world, {
      notificationManager: { log() {} },
    });

    expect(cm.getCityScalarEffect(city, "buildSpeed")).toBeGreaterThan(0);
    expect(cm.getBuildProgressRate(city)).toBeGreaterThan(1);
    expect(cm.getUnitTrainingRate(city)).toBeGreaterThan(1);
    expect(cm.getUnitCap(city)).toBeGreaterThan(cm._unitBaseCap);
    expect(cm.getUnitTrainCost(city, "militia")).toBeLessThan(140);
  });

  test("unit templates unlock through defense and naval research", () => {
    const cm = new global.window.CityManagement({ cities: [], player: {} }, {
      notificationManager: { log() {} },
    });

    const starterCity = makeCity("Harbor", { researchedTech: [] });
    const starter = Object.fromEntries(cm.getUnitTemplates(starterCity).map((tpl) => [tpl.key, tpl]));
    expect(starter.militia.unlocked).toBe(true);
    expect(starter.guard.unlocked).toBe(false);
    expect(starter.ranger.unlocked).toBe(false);
    expect(starter.wagonEscort.unlocked).toBe(false);
    expect(starter.motorCorps.unlocked).toBe(false);
    expect(starter.corsair.unlocked).toBe(false);

    const advancedCity = makeCity("Harbor", {
      researchedTech: ["def_militia", "def_garrison_regen", "trn_wagon_routes", "trn_motor_pool", "nav_port_defenses"],
      isCoastal: true,
      port: true,
    });
    const advanced = Object.fromEntries(cm.getUnitTemplates(advancedCity).map((tpl) => [tpl.key, tpl]));
    expect(advanced.guard.unlocked).toBe(true);
    expect(advanced.ranger.unlocked).toBe(true);
    expect(advanced.wagonEscort.unlocked).toBe(true);
    expect(advanced.motorCorps.unlocked).toBe(true);
    expect(advanced.corsair.unlocked).toBe(true);
  });

  test("trade tech progression boosts convoy throughput and shortens route travel", () => {
    let currentDay = 1;
    global.dayNight = {
      getDaysElapsed() {
        return currentDay;
      },
    };

    const advancedCity = makeCity("Harbor", {
      inventory: new Map([["Wheat", { quantity: 40 }]]),
      management: { budget: 300 },
      researchedTech: ["com_demand_forecast", "sci_alien_analysis"],
    });
    advancedCity.progression = {
      techEffects: {
        restockMult: 0.2,
        dockTimeMult: -0.2,
        travelCostMult: -0.15,
        fleetUpkeepMult: -0.2,
        tradeTaxBonus: 0.15,
        barterMargin: 0.1,
      },
    };
    const rival = makeCity("Rival", {
      location: { x: 21, y: 1 },
      inventory: new Map(),
      management: { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [], units: [], ownerPayoutDue: 0, ownerTaxShare: 0.35 },
      isCoastal: false,
      hasBank: false,
      hasWinery: false,
      hasWeaponShop: false,
    });
    const world = { cities: [advancedCity, rival], player: {} };
    const cm = new global.window.CityManagement(world, {
      dayNight: global.dayNight,
      notificationManager: { log() {} },
    });
    cm._rollRouteIncident = () => ({ key: "clear", label: "Clear Run", detail: "" });

    const progression = cm.getTradeProgression(advancedCity);
    expect(progression.convoyCapacityMult).toBeGreaterThan(1);
    expect(progression.priceIntel).toBe(true);
    expect(progression.alienTrade).toBe(true);

    const routeRes = cm.createTradeRoute(advancedCity, rival, {
      frequencyDays: 1,
      goldPerTransfer: 100,
      goodsPerTransfer: 5,
      itemsToSend: ["Wheat"],
    });
    expect(routeRes.ok).toBe(true);

    cm._processRoutes(advancedCity, currentDay);
    const activeShipment = advancedCity.management.routes[0].activeShipment;
    expect(activeShipment).toBeTruthy();
    expect(activeShipment.goodsToMove).toBeGreaterThan(5);
    expect(activeShipment.arrivalDay - activeShipment.departedDay).toBeLessThan(3);
  });

  test("transport tech and buildings raise logistics tier and convoy scale", () => {
    const city = makeCity("Harbor", {
      management: {
        upgradeLevels: { wagonDepot: 1, motorPool: 1 },
      },
    });
    city.progression = {
      techEffects: {
        convoyCapacityBonus: 0.55,
        travelCostMult: -0.2,
        unitTrainSpeed: 0.20,
      },
    };
    const world = { cities: [city], player: {} };
    const cm = new global.window.CityManagement(world, {
      notificationManager: { log() {} },
    });

    const trade = cm.getTradeProgression(city);
    expect(trade.logisticsTier).toBe(2);
    expect(trade.convoyCapacityMult).toBeGreaterThan(1.8);
    expect(trade.travelCostMult).toBeLessThan(-0.2);
    expect(cm.getUnitTrainingRate(city)).toBeGreaterThan(1.1);
  });

  test("rocket logistics improves launch readiness for space cities", () => {
    const city = makeCity("Harbor", {
      hasUniversity: true,
      management: {
        upgradeLevels: { wagonDepot: 1, motorPool: 1 },
      },
    });
    city.hasSpaceport = true;
    city.hasResearchLab = true;
    city.progression = {
      techEffects: {
        spaceReadiness: 0.35,
      },
    };
    city.hasTechNode = (key) => ["orb_fuel_efficiency", "orb_docking_rights", "trn_rocket_logistics"].includes(key);
    const world = { cities: [city], player: {} };
    const cm = new global.window.CityManagement(world, {
      notificationManager: { log() {} },
    });

    const readiness = cm.getSpaceReadiness(city);
    expect(readiness.score).toBeGreaterThan(0.9);
    expect(readiness.label).toBe("Launch Ready");
  });

  test("campaign support from transport reduces march time and improves invasion odds", () => {
    const city = makeCity("Harbor", {
      location: { x: 1, y: 1 },
      management: {
        budget: 1600,
        upgradeLevels: { wagonDepot: 1, motorPool: 1 },
        units: [],
        trainingQueue: [],
      },
    });
    city.progression = {
      techEffects: {
        travelCostMult: -0.2,
        spaceReadiness: 0.2,
      },
    };
    city.hasSpaceport = true;
    const target = makeCity("Rival", {
      location: { x: 37, y: 1 },
      management: { budget: 300, units: [], trainingQueue: [] },
      population: 200,
    });
    const world = { cities: [city, target], player: { ownsCity: (entry) => entry === city } };
    const cm = new global.window.CityManagement(world, {
      notificationManager: { log() {} },
    });
    cm.myCity = city;
    cm.unitManager = {
      units: [{
        hp: 12, maxHp: 12, attack: 4, defense: 2, accuracy: 0.8, critChance: 0.1, state: "idle", level: 1,
      }],
      deselectAll() {},
      add() {},
      update() {},
      toJSON() { return this.units.slice(); },
    };
    cm._unitCityRef = city;

    const preview = cm.getInvasionPreview(city, target);
    expect(preview.campaignSupport.marchSpeedBonus).toBeGreaterThan(0);
    expect(preview.campaignSupport.winBonus).toBeGreaterThan(0);

    const launch = cm.launchInvasion(city, target);
    expect(launch.ok).toBe(true);
    expect(launch.travelDays).toBeLessThan(Math.ceil((preview.distance || 1) / 12));
  });

  test("trade tech progression raises convoy payout after upkeep", () => {
    let currentDay = 1;
    global.dayNight = {
      getDaysElapsed() {
        return currentDay;
      },
    };

    const baseCity = makeCity("Harbor", {
      inventory: new Map([["Wheat", { quantity: 20 }]]),
      management: { budget: 200 },
    });
    const advancedCity = makeCity("Scholars Port", {
      inventory: new Map([["Wheat", { quantity: 20 }]]),
      management: { budget: 200 },
    });
    advancedCity.progression = {
      techEffects: {
        tradeTaxBonus: 0.15,
        barterMargin: 0.1,
        fleetUpkeepMult: -0.2,
      },
    };
    const rivalA = makeCity("Rival A", {
      location: { x: 13, y: 1 },
      inventory: new Map(),
      management: { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [], units: [], ownerPayoutDue: 0, ownerTaxShare: 0.35 },
      isCoastal: false,
      hasBank: false,
      hasWinery: false,
      hasWeaponShop: false,
    });
    const rivalB = makeCity("Rival B", {
      location: { x: 13, y: 1 },
      inventory: new Map(),
      management: { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [], units: [], ownerPayoutDue: 0, ownerTaxShare: 0.35 },
      isCoastal: false,
      hasBank: false,
      hasWinery: false,
      hasWeaponShop: false,
    });

    const baseWorld = { cities: [baseCity, rivalA], player: {} };
    const advancedWorld = { cities: [advancedCity, rivalB], player: {} };
    const baseCm = new global.window.CityManagement(baseWorld, {
      dayNight: global.dayNight,
      notificationManager: { log() {} },
    });
    const advancedCm = new global.window.CityManagement(advancedWorld, {
      dayNight: global.dayNight,
      notificationManager: { log() {} },
    });
    baseCm._rollRouteIncident = () => ({ key: "clear", label: "Clear Run", detail: "" });
    advancedCm._rollRouteIncident = () => ({ key: "clear", label: "Clear Run", detail: "" });

    expect(baseCm.createTradeRoute(baseCity, rivalA, {
      frequencyDays: 1,
      goldPerTransfer: 100,
      goodsPerTransfer: 5,
      itemsToSend: ["Wheat"],
    }).ok).toBe(true);
    expect(advancedCm.createTradeRoute(advancedCity, rivalB, {
      frequencyDays: 1,
      goldPerTransfer: 100,
      goodsPerTransfer: 5,
      itemsToSend: ["Wheat"],
    }).ok).toBe(true);

    baseCm._processRoutes(baseCity, currentDay);
    advancedCm._processRoutes(advancedCity, currentDay);

    currentDay = 3;
    baseCm._processRoutes(baseCity, currentDay);
    advancedCm._processRoutes(advancedCity, currentDay);

    expect(advancedCity.management.routes[0].lastShipment.goldNet).toBeGreaterThan(baseCity.management.routes[0].lastShipment.goldNet);
  });

  test("queued unit training finishes over time and counts against cap", () => {
    const city = makeCity("Harbor", {
      management: { budget: 1200, units: [], trainingQueue: [] },
    });
    city.progression = {
      techEffects: {
        unitTrainSpeed: 0.4,
      },
    };
    const world = { cities: [city], player: {} };
    const cm = new global.window.CityManagement(world, {
      notificationManager: { log() {} },
    });
    cm.myCity = city;
    cm._loadUnitsForCity(city);
    cm.unitManager = {
      units: [],
      deselectAll() {},
      add(unit) { this.units.push(unit); },
      update() {},
      toJSON() { return this.units.slice(); },
    };
    cm._unitCityRef = city;

    const queueRes = cm.queueUnitTraining(city, "Stonewall", "militia");
    expect(queueRes.ok).toBe(true);
    expect(city.management.trainingQueue).toHaveLength(1);
    expect(city.management.budget).toBeLessThan(1200);

    cm.tick(5000);
    expect(city.management.trainingQueue).toHaveLength(1);

    cm.tick(5000);
    expect(city.management.trainingQueue).toHaveLength(0);
    expect(cm.getUnitsForCity(city).some((unit) => unit.name === "Stonewall")).toBe(true);
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

    const underfunded = makeCity("Poor Harbor", {
      management: { budget: 10, routes: [], buildingQueue: [] },
      isCoastal: true,
    });
    const underfundedRes = cm.queueDistrictProject(underfunded, "market");
    expect(underfundedRes).toMatchObject({
      ok: false,
      reason: "no_money",
      available: 10,
      shortfall: 370,
    });
    expect(underfundedRes.message).toBe("City treasury needs 370g more (10g available, 380g required).");

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

  test("daily brief tracks city deltas and feed captures treasury actions", () => {
    let currentDay = 1;
    global.dayNight = {
      getDaysElapsed() {
        return currentDay;
      },
    };

    const city = makeCity("Capital", {
      population: 200,
      management: {
        budget: 500,
        routes: [{ destName: "Ghost Port", shipmentsCompleted: 0, shipmentsLost: 0 }],
        units: [{ id: 1, hp: 12, maxHp: 12, state: "idle" }],
      },
    });
    const world = {
      cities: [city],
      player: { gold: 300, spendGold(amount) { this.gold -= amount; } },
    };
    const cm = new global.window.CityManagement(world, {
      dayNight: global.dayNight,
      notificationManager: { log() {} },
    });
    cm.myCity = city;
    cm.isSettled = true;
    cm._nextQuestDay = 999;
    cm._nextEventDay = 999;
    cm._nextAIDecisionDay = 999;

    cm._processDaily(currentDay);
    cm.transferToCity(city, 50);

    city.management.budget = 700;
    city.population = 208;
    city.management.routes[0].shipmentsCompleted = 2;
    city.management.routes[0].shipmentsLost = 1;
    city.management.units[0].hp = 9;
    city.management.districts = { market: 1 };
    city.management.districtEffects = global.window.CityManagement.computeDistrictEffects(city.management.districts);

    currentDay = 2;
    cm._processDaily(currentDay);

    const brief = cm.getCityDailyBrief(city, currentDay);
    expect(brief).toMatchObject({
      day: 2,
      budgetDelta: 200,
      populationDelta: 8,
      routeCompletedDelta: 2,
      routeLostDelta: 1,
      developmentDelta: 1,
      unitHpDelta: -3,
    });
    expect(brief.alerts.some((alert) => alert.tabKey === "trade")).toBe(true);

    const feed = cm.getCityFeed(city, 4);
    expect(feed.some((entry) => entry.message.includes("Deposited 50g"))).toBe(true);
  });
});
