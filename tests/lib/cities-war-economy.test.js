describe("City war economy pressure", () => {
  const prevWindow = global.window;
  const prevCity = global.City;
  const prevItemLibrary = global.ItemLibrary;

  beforeAll(() => {
    global.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      BQGetWorldSession: () => ({ sessionType: "planet_surface", spaceContext: { nodeKey: "frontier-1" } }),
      BQGetBearEmpireSystem: () => null,
      DIFFICULTY_CONFIG: {},
    };
    delete require.cache[require.resolve("../../classes/Cities.js")];
    require("../../classes/Cities.js");
    global.City = global.window.City;
    global.ItemLibrary = {
      Iron: { baseValue: 20, category: "Material" },
      Tools: { baseValue: 30, category: "Trade" },
    };
  });

  afterAll(() => {
    if (prevWindow === undefined) delete global.window;
    else global.window = prevWindow;

    if (prevCity === undefined) delete global.City;
    else global.City = prevCity;

    if (prevItemLibrary === undefined) delete global.ItemLibrary;
    else global.ItemLibrary = prevItemLibrary;
  });

  test("occupied systems raise buy prices and suppress sell prices", () => {
    const fakeCity = {
      inventory: new Map([["Iron", { quantity: 1 }]]),
      population: 120,
      location: { x: 0, y: 0 },
      management: { taxRate: 0 },
      priceHistory: {},
      _priceHistorySampleDay: {},
      getBasePrice: () => 20,
      getBookHolidayDiscount: () => 0,
      isHolidayForItem: () => false,
      getReputationPriceModifier: () => 1,
    };
    const nearbyCity = {
      inventory: new Map([["Iron", { quantity: 18 }]]),
      population: 100,
      location: { x: 10, y: 0 },
    };

    const baseBuy = global.City.prototype.calculateItemPrice.call(
      fakeCity,
      "Iron",
      [fakeCity, nearbyCity],
      false,
      { trackHistory: false, applyDifficultyMultipliers: false }
    );
    const baseSell = global.City.prototype.calculateItemPrice.call(
      fakeCity,
      "Iron",
      [fakeCity, nearbyCity],
      true,
      { trackHistory: false, applyDifficultyMultipliers: false }
    );

    global.window.BQGetBearEmpireSystem = () => ({
      getSystemStatus: () => ({
        occupied: true,
        threatened: false,
        resistanceCell: false,
        tradePenalty: 0.18,
      }),
    });

    const occupiedBuy = global.City.prototype.calculateItemPrice.call(
      fakeCity,
      "Iron",
      [fakeCity, nearbyCity],
      false,
      { trackHistory: false, applyDifficultyMultipliers: false }
    );
    const occupiedSell = global.City.prototype.calculateItemPrice.call(
      fakeCity,
      "Iron",
      [fakeCity, nearbyCity],
      true,
      { trackHistory: false, applyDifficultyMultipliers: false }
    );

    expect(occupiedBuy).toBeGreaterThan(baseBuy);
    expect(occupiedSell).toBeLessThan(baseSell);
  });
});
