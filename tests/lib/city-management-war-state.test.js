describe("CityManagement war state persistence", () => {
  const prevWindow = global.window;
  const prevWindowCityUnit = prevWindow && prevWindow.CityUnit;
  const prevWindowCityUnitManager = prevWindow && prevWindow.CityUnitManager;
  const prevWindowCityManagement = prevWindow && prevWindow.CityManagement;
  const prevGlobalCityUnit = global.CityUnit;
  const prevGlobalCityUnitManager = global.CityUnitManager;

  beforeAll(() => {
    global.window = global.window || {};
    if (typeof global.window.addEventListener !== "function") global.window.addEventListener = () => {};
    if (typeof global.window.removeEventListener !== "function") global.window.removeEventListener = () => {};
    require("../../classes/CityUnit.js");
    require("../../classes/CityUnitManager.js");
    global.CityUnit = global.window.CityUnit;
    global.CityUnitManager = global.window.CityUnitManager;
    require("../../classes/CityManagement.js");
  });

  afterAll(() => {
    if (prevWindow === undefined) {
      delete global.window;
    } else {
      global.window = prevWindow;
      if (prevWindowCityUnit === undefined) delete global.window.CityUnit;
      else global.window.CityUnit = prevWindowCityUnit;
      if (prevWindowCityUnitManager === undefined) delete global.window.CityUnitManager;
      else global.window.CityUnitManager = prevWindowCityUnitManager;
      if (prevWindowCityManagement === undefined) delete global.window.CityManagement;
      else global.window.CityManagement = prevWindowCityManagement;
    }

    if (prevGlobalCityUnit === undefined) delete global.CityUnit;
    else global.CityUnit = prevGlobalCityUnit;
    if (prevGlobalCityUnitManager === undefined) delete global.CityUnitManager;
    else global.CityUnitManager = prevGlobalCityUnitManager;
  });

  test("serializes and restores rich war battle payloads", () => {
    const city = {
      name: "Harbor",
      location: { x: 2, y: 3 },
      inventory: new Map(),
      management: { budget: 300, taxRate: 0.05, upgradeLevels: {}, units: [] },
      hasBank: false,
      hasGamblingDen: false,
      hasBountyBoard: false,
      hasWeaponShop: true,
      hasWinery: false,
      hasSchool: false,
      hasBlackMarket: false,
    };
    const world = {
      cities: [city],
      grid: [[{ options: ["Grass"] }]],
      cityLocationMap: new Set(["2,3"]),
    };

    const cm = new global.window.CityManagement(world, {});
    cm.myCity = city;
    cm.myCityIndex = 0;
    cm.isSettled = true;
    cm.selectCity(city);
    cm._warQteBuff = {
      grade: "A",
      score: 81,
      winBonus: 0.16,
      lootBonus: 0.34,
      tacticalMomentum: 0.12,
      casualtyMitigation: 0.08,
      cardsPlayed: 3,
      enemyCardsPlayed: 1,
      seed: 77,
      expiresAt: Date.now() + 60000,
    };
    cm._activeCampaigns = [{
      id: 5,
      status: "marching",
      sourceIndex: 0,
      targetIndex: 0,
      sourceName: "Harbor",
      targetName: "Harbor",
      startedDay: 2,
      arrivalDay: 4,
      qteBuff: {
        grade: "S",
        score: 93,
        winBonus: 0.22,
        lootBonus: 0.52,
        tacticalMomentum: 0.2,
        casualtyMitigation: 0.14,
        cardsPlayed: 4,
        enemyCardsPlayed: 1,
        playerBattleWon: true,
        seed: 99,
      },
    }];

    const json = cm.toJSON();
    const restored = global.window.CityManagement.fromJSON(json, world, {});

    expect(json._warQteBuff).toMatchObject({
      grade: "A",
      score: 81,
      tacticalMomentum: 0.12,
      cardsPlayed: 3,
      seed: 77,
    });
    expect(json.activeCampaigns[0].qteBuff).toMatchObject({
      grade: "S",
      score: 93,
      playerBattleWon: true,
      seed: 99,
    });
    expect(restored._warQteBuff).toMatchObject({
      grade: "A",
      score: 81,
      tacticalMomentum: 0.12,
      cardsPlayed: 3,
      seed: 77,
    });
    expect(restored._activeCampaigns[0].qteBuff).toMatchObject({
      grade: "S",
      score: 93,
      playerBattleWon: true,
      seed: 99,
    });
  });
});
