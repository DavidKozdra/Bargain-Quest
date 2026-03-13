describe("Wine bonuses", () => {
  const prevWindow = global.window;
  const prevWindowCityManagement = prevWindow && prevWindow.CityManagement;
  const prevWindowDiplomacySystem = prevWindow && prevWindow.DiplomacySystem;

  beforeAll(() => {
    global.window = global.window || {};
    if (typeof global.window.addEventListener !== "function") global.window.addEventListener = () => {};
    if (typeof global.window.removeEventListener !== "function") global.window.removeEventListener = () => {};
    require("../../classes/DiplomacySystem.js");
    require("../../classes/CityManagement.js");
  });

  afterAll(() => {
    if (prevWindow === undefined) {
      delete global.window;
      return;
    }

    global.window = prevWindow;
    if (prevWindowCityManagement === undefined) delete global.window.CityManagement;
    else global.window.CityManagement = prevWindowCityManagement;
    if (prevWindowDiplomacySystem === undefined) delete global.window.DiplomacySystem;
    else global.window.DiplomacySystem = prevWindowDiplomacySystem;
  });

  test("wine reserves give a large happiness boost", () => {
    const cityManagement = new global.window.CityManagement({}, {});
    const cityWithoutWine = {
      population: 120,
      reputation: 50,
      inventory: new Map(),
      management: { taxRate: 0.05, upgradeLevels: {} },
      hasBank: false,
      hasGamblingDen: false,
      hasBountyBoard: false,
      hasWeaponShop: false,
      hasWinery: false,
      hasSchool: false,
      hasBlackMarket: false,
    };
    cityWithoutWine.inventory.set("Bread", { quantity: 20 });

    const cityWithWine = {
      ...cityWithoutWine,
      inventory: new Map(cityWithoutWine.inventory),
    };
    cityWithWine.inventory.set("Wine", { quantity: 6 });

    const baseHappiness = cityManagement.getHappiness(cityWithoutWine);
    const wineHappiness = cityManagement.getHappiness(cityWithWine);

    expect(wineHappiness).toBeGreaterThan(baseHappiness + 6);
  });

  test("wine gifts improve relations much more than gold gifts", () => {
    const diplomacy = new global.window.DiplomacySystem();
    const goldGift = diplomacy.sendGift("Harborview", 100, 10);

    const diplomacyWithWine = new global.window.DiplomacySystem();
    const wineGift = diplomacyWithWine.sendWineGift("Harborview", 3, 10);

    expect(goldGift.ok).toBe(true);
    expect(wineGift.ok).toBe(true);
    expect(diplomacyWithWine.getScore("Harborview")).toBeGreaterThan(diplomacy.getScore("Harborview") + 8);
  });
});
