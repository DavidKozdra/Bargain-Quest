const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadBrowserScript(relPath, context, exportName) {
  const filename = path.resolve(__dirname, "..", "..", relPath);
  const source = fs.readFileSync(filename, "utf8");
  vm.runInNewContext(`${source}\nthis.__exported = ${exportName};`, context, { filename });
  return context.__exported;
}

function createTraderContext() {
  const prefStore = new Map();
  const context = {
    console,
    Math,
    Map,
    Set,
    Date,
    cityLocationMap: new Map(),
    ItemLibrary: {
      Fish: { name: "Fish", weight: 1, baseValue: 12, rarity: 1.2, category: "Food", tradable: true, seasonality: [] },
    },
    cities: [
      {
        name: "Harbor",
        location: { x: 1, y: 2 },
        inventory: new Map(),
        management: { taxRate: 0 },
        calculateItemPrice: () => 10,
        _addOrIncrement: () => {},
        dockedTraderCount: 0,
      },
      {
        name: "Market",
        location: { x: 3, y: 4 },
        inventory: new Map(),
        management: { taxRate: 0 },
        calculateItemPrice: () => 15,
        _addOrIncrement: () => {},
        dockedTraderCount: 0,
      },
    ],
    traderGrid: {
      insert: () => {},
      move: () => {},
      remove: () => {},
    },
    notificationManager: { log: () => {} },
    dayNight: { getDaysElapsed: () => 0, getSeason: () => "Summer" },
    player: { x: 0, y: 0 },
    localStorage: {
      getItem: (key) => (prefStore.has(key) ? prefStore.get(key) : null),
      setItem: (key, value) => prefStore.set(key, String(value)),
      removeItem: (key) => prefStore.delete(key),
      clear: () => prefStore.clear(),
    },
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  };
  context.global = context;
  context.globalThis = context;
  return context;
}

function buildTestCity({ name, x, y, inventory = {}, buy = {}, sell = {}, taxRate = 0, reputation = 50, isCoastal = false, port = false }) {
  return {
    name,
    location: { x, y },
    inventory: new Map(Object.entries(inventory).map(([itemKey, quantity]) => [itemKey, { item: null, quantity }])),
    management: { taxRate },
    reputation,
    isCoastal,
    port,
    calculateItemPrice: (itemKey, allCities, isSelling) => {
      const table = isSelling ? sell : buy;
      return table[itemKey] ?? 0;
    },
    _addOrIncrement(itemKey, qty) {
      const current = this.inventory.get(itemKey);
      if (current) current.quantity += qty;
      else this.inventory.set(itemKey, { item: null, quantity: qty });
    },
    dockedTraderCount: 0,
  };
}

describe("classes/Trader save restore", () => {
  test("migrates legacy trader personalities during construction", () => {
    const context = createTraderContext();
    const Trader = loadBrowserScript("classes/Trader.js", context, "Trader");

    const trader = new Trader({
      name: "Elia",
      homeCityIndex: 0,
      personality: "greedy",
      gold: 250,
      cargoCapacity: 70,
    });

    expect(trader.personality).toBe("brave");
    expect(trader.moveInterval).toBe(120);
  });

  test("restores saved traders through TraderManager.fromJSON", () => {
    const context = createTraderContext();
    loadBrowserScript("classes/Trader.js", context, "Trader");
    const TraderManager = loadBrowserScript("classes/TraderManager.js", context, "TraderManager");

    const mgr = TraderManager.fromJSON([
      {
        name: "Maren",
        personality: "balanced",
        gold: 120,
        inventory: [["Fish", 2]],
        cargoCapacity: 60,
        reputation: 50,
        homeCityIndex: 0,
        targetCityIndex: 1,
        currentCityIndex: 0,
        x: 1,
        y: 2,
        state: "idle",
        waitDays: 2,
        totalProfit: 40,
        hasBoat: false,
        abstractArrivalDay: -1,
        id: "t9",
        relations: [],
      },
    ]);

    expect(mgr.traders).toHaveLength(1);
    expect(mgr.traders[0].personality).toBe("competitive");
    expect(mgr.traders[0].inventory.get("Fish").quantity).toBe(2);
    expect(mgr.traders[0].inventory.get("Fish").item.name).toBe("Fish");
    expect(mgr.traders[0].inventory.get("Fish").item.weight).toBe(1);
    expect(context.cities[0].dockedTraderCount).toBe(1);
  });

  test("preserves zero-valued trader fields during restore", () => {
    const context = createTraderContext();
    const Trader = loadBrowserScript("classes/Trader.js", context, "Trader");

    const trader = Trader.fromJSON({
      name: "Broke",
      personality: "balanced",
      gold: 0,
      inventory: [],
      cargoCapacity: 0,
      reputation: 50,
      homeCityIndex: 0,
      targetCityIndex: -1,
      currentCityIndex: 0,
      x: 1,
      y: 2,
      state: "idle",
      waitDays: 0,
      totalProfit: 0,
      hasBoat: false,
      abstractArrivalDay: -1,
      id: "t10",
      relations: [],
    });

    expect(trader.gold).toBe(0);
    expect(trader.cargoCapacity).toBe(0);
  });

  test("personalities prioritize different markets from the same city", () => {
    const context = createTraderContext();
    context.ItemLibrary = {
      Iron: { name: "Iron", weight: 5, baseValue: 25, rarity: 1.0, category: "Ore", tradable: true, seasonality: [] },
      Wine: { name: "Wine", weight: 3, baseValue: 45, rarity: 2.0, category: "Luxury", tradable: true, seasonality: ["Fall"] },
      Silk: { name: "Silk", weight: 1, baseValue: 65, rarity: 2.8, category: "Luxury", tradable: true, seasonality: [] },
    };
    context.cities = [
      buildTestCity({
        name: "Origin",
        x: 0,
        y: 0,
        inventory: { Iron: 12, Wine: 12, Silk: 8 },
        buy: { Iron: 10, Wine: 20, Silk: 28 },
        sell: { Iron: 10, Wine: 20, Silk: 28 },
        taxRate: 0.05,
        reputation: 50,
      }),
      buildTestCity({
        name: "Quickmarket",
        x: 2,
        y: 0,
        sell: { Iron: 26, Wine: 30, Silk: 40 },
        taxRate: 0.02,
        reputation: 60,
      }),
      buildTestCity({
        name: "Far Port",
        x: 18,
        y: 0,
        sell: { Iron: 24, Wine: 52, Silk: 44 },
        taxRate: 0.01,
        reputation: 70,
        isCoastal: true,
        port: true,
      }),
    ];

    const Trader = loadBrowserScript("classes/Trader.js", context, "Trader");
    const brave = new Trader({ name: "Bram", homeCityIndex: 0, personality: "brave", gold: 500, cargoCapacity: 40 });
    const slow = new Trader({ name: "Theda", homeCityIndex: 0, personality: "slow", gold: 500, cargoCapacity: 40 });
    const competitive = new Trader({ name: "Petra", homeCityIndex: 0, personality: "competitive", gold: 500, cargoCapacity: 40 });

    const braveBest = brave._evaluateMarketOpportunities()[0];
    const slowBest = slow._evaluateMarketOpportunities()[0];
    const competitiveBest = competitive._evaluateMarketOpportunities()[0];

    expect(braveBest.itemKey).toBe("Wine");
    expect(braveBest.bestCityIdx).toBe(2);

    expect(slowBest.itemKey).toBe("Silk");
    expect(slowBest.bestCityIdx).toBe(1);

    expect(competitiveBest.itemKey).toBe("Iron");
    expect(competitiveBest.bestCityIdx).toBe(1);
  });

  test("managed city sale proceeds go into its treasury", () => {
    const context = createTraderContext();
    const managed = buildTestCity({ name: "Player Town", x: 0, y: 0, inventory: { Fish: 10 }, buy: { Fish: 4 }, sell: { Fish: 4 } });
    managed._isManagedCity = true;
    managed.management = { taxRate: 0, budget: 0, marketLedger: {}, demandOrders: {} };
    managed.getManagedSaleQuote = () => ({ defaultPrice: 10, price: 4, custom: true });
    const destination = buildTestCity({ name: "Fish Market", x: 3, y: 0, sell: { Fish: 24 } });
    context.cities = [managed, destination];
    const Trader = loadBrowserScript("classes/Trader.js", context, "Trader");
    const trader = new Trader({ name: "Buyer", homeCityIndex: 0, personality: "brave", gold: 100, cargoCapacity: 30 });

    const goldBefore = trader.gold;
    trader.doTrading();

    const paid = goldBefore - trader.gold;
    expect(paid).toBeGreaterThan(0);
    expect(managed.management.budget).toBe(paid);
    expect(managed.management.marketLedger.salesGold).toBe(paid);
  });

  test("managed sale discounts attract an inbound trader before arrival", () => {
    const context = createTraderContext();
    let playerPrice = 2;
    const origin = buildTestCity({ name: "Origin", x: 0, y: 0 });
    const playerTown = buildTestCity({
      name: "Player Town", x: 4, y: 0, inventory: { Fish: 10 }, buy: { Fish: 20 }, sell: { Fish: 20 },
    });
    playerTown._isManagedCity = true;
    playerTown.management = { taxRate: 0, budget: 0, marketLedger: {}, demandOrders: {} };
    playerTown.getManagedSaleQuote = () => ({ defaultPrice: 20, price: playerPrice, custom: true });
    playerTown.getManagedDemandQuote = () => ({ active: false, remaining: 0, price: 0 });
    const ordinaryTown = buildTestCity({
      name: "Ordinary Town", x: 5, y: 0, inventory: { Fish: 10 }, buy: { Fish: 12 }, sell: { Fish: 12 },
    });
    const resaleTown = buildTestCity({ name: "Resale Town", x: 12, y: 0, sell: { Fish: 80 } });
    context.cities = [origin, playerTown, ordinaryTown, resaleTown];
    context.requestWorldPath = () => ({ status: "pending", cancel: () => {} });
    const Trader = loadBrowserScript("classes/Trader.js", context, "Trader");
    const trader = new Trader({ name: "Deal Seeker", homeCityIndex: 0, personality: "competitive", gold: 200, cargoCapacity: 30 });

    trader.planRoute();
    expect(trader.targetCityIndex).toBe(1);

    trader._cancelPathRequest();
    trader.targetCityIndex = -1;
    playerPrice = 79;
    trader.planRoute();
    expect(trader.targetCityIndex).toBe(2);
  });

  test("managed demand attracts cargo and never spends beyond treasury or target", () => {
    const context = createTraderContext();
    const managed = buildTestCity({ name: "Player Town", x: 0, y: 0 });
    managed._isManagedCity = true;
    managed.management = { taxRate: 0, budget: 20, marketLedger: {}, demandOrders: { Fish: { targetQuantity: 2, price: 10 } } };
    managed.getManagedDemandQuote = () => ({ active: true, remaining: 2, price: 10 });
    managed.getManagedSaleQuote = () => ({ defaultPrice: 50, price: 50, custom: false });
    const destination = buildTestCity({ name: "Other", x: 4, y: 0, sell: { Fish: 12 } });
    context.cities = [managed, destination];
    const Trader = loadBrowserScript("classes/Trader.js", context, "Trader");
    const trader = new Trader({ name: "Supplier", homeCityIndex: 0, personality: "brave", gold: 10, cargoCapacity: 30 });
    trader.inventory.set("Fish", { item: context.ItemLibrary.Fish, quantity: 5 });

    expect(trader._estimateAdjustedSellPrice(0, "Fish")).toBe(10);
    trader.doTrading();

    expect(managed.inventory.get("Fish").quantity).toBe(2);
    expect(managed.management.budget).toBe(0);
    expect(managed.management.marketLedger.purchaseGold).toBe(20);
    expect(trader.inventory.get("Fish").quantity).toBe(3);
  });

  test("managed-city arrival alerts stay disabled by default", () => {
    const context = createTraderContext();
    const logs = [];
    context.notificationManager.log = (message, type) => logs.push({ message, type });
    context.cities[1]._isManagedCity = true;
    context.cityLocationMap.set("3,4", context.cities[1]);

    const Trader = loadBrowserScript("classes/Trader.js", context, "Trader");
    const trader = new Trader({ name: "Elia", homeCityIndex: 0, personality: "brave", gold: 200, cargoCapacity: 60 });
    trader.x = 3;
    trader.y = 4;

    trader.arriveAtCity();

    expect(logs).toHaveLength(0);
  });

  test("managed-city arrival alerts can be enabled", () => {
    const context = createTraderContext();
    const logs = [];
    context.notificationManager.log = (message, type) => logs.push({ message, type });
    context.localStorage.setItem("pref_notify_trader_travel", "true");
    context.cities[1]._isManagedCity = true;
    context.cityLocationMap.set("3,4", context.cities[1]);

    const Trader = loadBrowserScript("classes/Trader.js", context, "Trader");
    const trader = new Trader({ name: "Elia", homeCityIndex: 0, personality: "brave", gold: 200, cargoCapacity: 60 });
    trader.x = 3;
    trader.y = 4;

    trader.arriveAtCity();

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      message: "Trader Elia has arrived at Market!",
      type: "info",
    });
  });
});
