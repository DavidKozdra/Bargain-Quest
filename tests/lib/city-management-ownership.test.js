describe("CityManagement ownership rewards", () => {
  const prevWindow = global.window;
  const prevWindowCityManagement = prevWindow && prevWindow.CityManagement;
  const prevItemLibrary = global.ItemLibrary;

  beforeAll(() => {
    global.window = global.window || {};
    if (typeof global.window.addEventListener !== "function") global.window.addEventListener = () => {};
    if (typeof global.window.removeEventListener !== "function") global.window.removeEventListener = () => {};
    global.ItemLibrary = {
      Iron: { baseValue: 10 },
      Wheat: { baseValue: 5 },
      Fish: { baseValue: 20 },
    };
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

    if (prevItemLibrary === undefined) delete global.ItemLibrary;
    else global.ItemLibrary = prevItemLibrary;
  });

  function makeCity({ name, budget, payoutDue = 0, inventory = {} }) {
    return {
      name,
      inventory: new Map(
        Object.entries(inventory).map(([key, quantity]) => [key, { quantity }])
      ),
      management: {
        budget,
        taxRate: 0.05,
        buildingQueue: [],
        upgradeLevels: {},
        routes: [],
        units: [],
        ownerPayoutDue: payoutDue,
        ownerTaxShare: 0.35,
      },
    };
  }

  test("owned cities increase player wealth ranking instead of remaining rival entries", () => {
    const home = makeCity({ name: "Home", budget: 100, payoutDue: 15, inventory: { Iron: 3 } });
    const conquered = makeCity({ name: "Conquered", budget: 50, payoutDue: 20, inventory: { Wheat: 4 } });
    const rival = makeCity({ name: "Rival", budget: 180, inventory: { Fish: 2 } });
    const player = {
      gold: 25,
      getOwnedCities() {
        return [home, conquered];
      },
    };
    const world = { cities: [home, conquered, rival], player };

    const cm = new global.window.CityManagement(world, { player });
    cm.myCity = home;
    cm.isSettled = true;

    cm._updateWealthRanking();

    expect(cm.playerWealth).toBe(235);
    expect(cm.wealthRanking).toHaveLength(2);
    expect(cm.wealthRanking[0]).toMatchObject({
      name: "Home Dominion",
      wealth: 235,
      isPlayer: true,
    });
    expect(cm.wealthRanking[1]).toMatchObject({
      name: "Rival",
      wealth: 220,
      isPlayer: false,
    });
  });

  test("owner payout can be collected into player gold", () => {
    const city = makeCity({ name: "Harbor", budget: 90, payoutDue: 40 });
    const player = {
      gold: 12,
      earnGold(amount) {
        this.gold += amount;
      },
    };
    const world = { cities: [city], player };

    const cm = new global.window.CityManagement(world, { player });
    const partial = cm.collectOwnerPayout(city, 15);
    const rest = cm.collectOwnerPayout(city);

    expect(partial).toEqual({ ok: true, amount: 15, remaining: 25 });
    expect(rest).toEqual({ ok: true, amount: 25, remaining: 0 });
    expect(player.gold).toBe(52);
    expect(city.management.ownerPayoutDue).toBe(0);
  });
});
