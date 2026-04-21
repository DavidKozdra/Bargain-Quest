describe("ContractSystem crisis contracts", () => {
  const prevWindow = global.window;
  const prevBearEmpireSystem = global.BearEmpireSystem;
  const prevSpaceTravelSystem = global.SpaceTravelSystem;
  const prevContractSystem = global.ContractSystem;
  const prevItemLibrary = global.ItemLibrary;
  const prevPlayer = global.player;
  const prevCities = global.cities;
  const prevDayNight = global.dayNight;
  const prevNotificationManager = global.notificationManager;
  const realMathRandom = Math.random;

  beforeAll(() => {
    global.window = global.window || {};
    global.window.addEventListener = () => {};
    global.window.removeEventListener = () => {};
    global.window.dispatchEvent = () => true;
    global.window._newGameGoldTarget = 5000;

    delete require.cache[require.resolve("../../classes/SpaceTravelSystem.js")];
    delete require.cache[require.resolve("../../classes/BearEmpireSystem.js")];
    delete require.cache[require.resolve("../../classes/ContractSystem.js")];
    require("../../classes/SpaceTravelSystem.js");
    require("../../classes/BearEmpireSystem.js");
    require("../../classes/ContractSystem.js");

    global.SpaceTravelSystem = global.window.SpaceTravelSystem;
    global.BearEmpireSystem = global.window.BearEmpireSystem;
    global.ContractSystem = global.window.ContractSystem;
  });

  afterAll(() => {
    Math.random = realMathRandom;

    if (prevWindow === undefined) delete global.window;
    else global.window = prevWindow;

    if (prevBearEmpireSystem === undefined) delete global.BearEmpireSystem;
    else global.BearEmpireSystem = prevBearEmpireSystem;

    if (prevSpaceTravelSystem === undefined) delete global.SpaceTravelSystem;
    else global.SpaceTravelSystem = prevSpaceTravelSystem;

    if (prevContractSystem === undefined) delete global.ContractSystem;
    else global.ContractSystem = prevContractSystem;

    if (prevItemLibrary === undefined) delete global.ItemLibrary;
    else global.ItemLibrary = prevItemLibrary;

    if (prevPlayer === undefined) delete global.player;
    else global.player = prevPlayer;

    if (prevCities === undefined) delete global.cities;
    else global.cities = prevCities;

    if (prevDayNight === undefined) delete global.dayNight;
    else global.dayNight = prevDayNight;

    if (prevNotificationManager === undefined) delete global.notificationManager;
    else global.notificationManager = prevNotificationManager;
  });

  test("successful resistance crisis contracts strengthen the local resistance", () => {
    global.ItemLibrary = {
      Tools: { baseValue: 30 },
      Iron: { baseValue: 20 },
      Wheat: { baseValue: 10 },
      Fish: { baseValue: 12 },
      Herbs: { baseValue: 18 },
      Wood: { baseValue: 14 },
      Bread: { baseValue: 16 },
      Salt: { baseValue: 8 },
      Wine: { baseValue: 40 },
      Silk: { baseValue: 55 },
      Spices: { baseValue: 50 },
      Jewelry: { baseValue: 65 },
    };
    global.dayNight = { getDaysElapsed: () => 18 };
    global.notificationManager = { log: () => {} };

    const makeInventory = () => new Map();
    global.cities = [
      { name: "Grayhold", inventory: makeInventory(), adjustReputation: () => {} },
      { name: "Relay Point", inventory: makeInventory(), adjustReputation: () => {} },
      { name: "Dust Market", inventory: makeInventory(), adjustReputation: () => {} },
    ];

    global.player = {
      gold: 900,
      currentCity: { name: "Relay Point" },
      inventory: new Map(),
      earnGold(amount) { this.gold += amount; },
      addItem(item) {
        const entry = this.inventory.get(item.name);
        if (entry) entry.quantity += item.quantity || 1;
        else this.inventory.set(item.name, { quantity: item.quantity || 1 });
      },
      removeItem(item) {
        const entry = this.inventory.get(item.name);
        if (!entry) return false;
        entry.quantity -= 1;
        if (entry.quantity <= 0) this.inventory.delete(item.name);
        return true;
      },
    };

    global.window.BQConfigureSpaceWorldGraph(606);
    const bearEmpire = new global.BearEmpireSystem({
      seed: 606,
      citiesGetter: () => [{ hasSpaceport: true, progression: { spaceProgram: true, spaceportBuilt: true, spaceAccess: { launchReady: true, dockingRights: true } } }],
      playerGetter: () => ({ spaceTravel: { visitedPlanets: ["luna"] } }),
      notificationGetter: () => null,
    });
    const nodeKey = bearEmpire.getThreatenedSystems()[0];
    global.window.BQGetBearEmpireSystem = () => bearEmpire;
    global.window.BQGetWorldSession = () => ({ sessionType: "planet_surface", spaceContext: { nodeKey } });

    const system = new global.ContractSystem();
    Math.random = () => 0.9;
    const contract = system._maybeCreateCrisisContract(global.cities[0]);
    expect(contract).toBeTruthy();
    expect(contract.crisisContract).toBe(true);
    expect(contract.crisisSide).toBe("resistance");

    global.player.inventory.set(contract.item, { quantity: contract.qty });
    const beforeStanding = bearEmpire.resistanceStanding;
    system.active = [contract];
    system._completeContract(contract, 0);

    expect(bearEmpire.resistanceStanding).toBeGreaterThan(beforeStanding);
    expect(bearEmpire.getSystemStatus(nodeKey).resistanceKnown).toBe(true);

    system.destroy();
    bearEmpire.destroy();
  });
});
