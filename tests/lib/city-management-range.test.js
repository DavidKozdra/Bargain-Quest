describe("CityManagement ranged unit combat", () => {
  const prevWindow = global.window;
  const prevWindowCityUnit = prevWindow && prevWindow.CityUnit;
  const prevWindowCityUnitManager = prevWindow && prevWindow.CityUnitManager;
  const prevWindowCityManagement = prevWindow && prevWindow.CityManagement;
  const prevCityUnit = global.CityUnit;
  const prevCityUnitManager = global.CityUnitManager;

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
      return;
    }

    global.window = prevWindow;
    if (prevWindowCityUnit === undefined) delete global.window.CityUnit;
    else global.window.CityUnit = prevWindowCityUnit;
    if (prevWindowCityUnitManager === undefined) delete global.window.CityUnitManager;
    else global.window.CityUnitManager = prevWindowCityUnitManager;
    if (prevWindowCityManagement === undefined) delete global.window.CityManagement;
    else global.window.CityManagement = prevWindowCityManagement;
    if (prevCityUnit === undefined) delete global.CityUnit;
    else global.CityUnit = prevCityUnit;
    if (prevCityUnitManager === undefined) delete global.CityUnitManager;
    else global.CityUnitManager = prevCityUnitManager;
  });

  test("rangers can attack raiders from several tiles away on the city map", () => {
    const originalRandom = Math.random;
    Math.random = () => 0;

    try {
      const grid = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ options: ["Grass"] })));
      const raider = { id: 7, x: 4, y: 1, state: "raiding", strength: 1, name: "Raider" };
      const raiderManager = {
        raiders: [raider],
        getRaidersInRect(x1, x2, y1, y2) {
          if (raider.x >= x1 && raider.x <= x2 && raider.y >= y1 && raider.y <= y2 && raider.state !== "defeated") {
            return [raider];
          }
          return [];
        },
      };

      const city = {
        name: "Harbor",
        location: { x: 1, y: 1 },
        management: { budget: 0, upgradeLevels: {}, units: [] },
        hasWeaponShop: false,
        hasWinery: false,
        hasBank: false,
        hasBlackMarket: false,
        hasBountyBoard: false,
        hasSchool: false,
        adjustReputation() {},
      };

      const cm = new global.window.CityManagement({
        grid,
        cityLocationMap: new Set(),
      }, {
        raiderManager,
        notificationManager: { log() {} },
      });

      const ranger = new global.window.CityUnit({
        id: 1,
        city,
        location: { x: 1, y: 1 },
        name: "Longshot",
        classKey: "ranger",
        hp: 11,
        maxHp: 11,
        attack: 4,
        defense: 1,
        accuracy: 0.95,
        critChance: 0.2,
        attackRangeMin: 1,
        attackRangeMax: 4,
        reactionRange: 4,
      });
      ranger.selected = true;

      cm.unitManager.clear();
      cm.unitManager.add(ranger);
      cm._unitCityRef = city;

      const outcome = cm.handleUnitMapClick(city, raider.x, raider.y);

      expect(outcome.handled).toBe(true);
      expect(outcome.action).toBe("attack_win");
      expect(raider.state).toBe("defeated");
    } finally {
      Math.random = originalRandom;
    }
  });
});
