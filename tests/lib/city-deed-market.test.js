describe("City deed market (appraisal, flipping, invasions)", () => {
  const prevWindow = global.window;
  const prevCity = global.City;
  const prevItemLibrary = global.ItemLibrary;
  const prevCityManagement = global.CityManagement;

  beforeAll(() => {
    global.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      DIFFICULTY_CONFIG: {},
    };
    delete require.cache[require.resolve("../../classes/Cities.js")];
    require("../../classes/Cities.js");
    global.City = global.window.City;
    delete require.cache[require.resolve("../../classes/CityManagement.js")];
    require("../../classes/CityManagement.js");
    global.CityManagement = global.window.CityManagement;
    global.ItemLibrary = {
      Iron: { baseValue: 20, category: "Material" },
      Wheat: { baseValue: 5, category: "Food" },
    };
  });

  afterAll(() => {
    if (prevWindow === undefined) delete global.window;
    else global.window = prevWindow;
    if (prevCity === undefined) delete global.City;
    else global.City = prevCity;
    if (prevItemLibrary === undefined) delete global.ItemLibrary;
    else global.ItemLibrary = prevItemLibrary;
    if (prevCityManagement === undefined) delete global.CityManagement;
    else global.CityManagement = prevCityManagement;
  });

  function makeFakeCity({ name = "Testville", population = 800, reputation = 50, inventory = {}, upgrades = {}, features = {} } = {}) {
    const city = {
      name,
      population,
      reputation,
      location: { x: 5, y: 5 },
      inventory: new Map(Object.entries(inventory).map(([k, q]) => [k, { quantity: q }])),
      management: {
        budget: 0,
        taxRate: 0.05,
        buildingQueue: [],
        upgradeLevels: upgrades,
        routes: [],
        units: [],
        ownerPayoutDue: 0,
        ownerTaxShare: 0.35,
        districts: {},
        districtEffects: {},
      },
      hasBank: !!features.hasBank,
      hasSchool: !!features.hasSchool,
      hasWinery: !!features.hasWinery,
      adjustReputation(delta) { this.reputation += delta; },
    };
    for (const method of [
      "computeTaxRevenue", "getDevelopmentScore", "estimateDailyOwnerPayout",
      "getConditionReport", "getAppraisal", "getOwnershipStageCosts",
      "getOwnershipAcquisitionState", "_ensureOwnershipDeal", "_createOwnershipDeal",
      "_getManagementEffect",
    ]) {
      city[method] = global.City.prototype[method].bind(city);
    }
    return city;
  }

  test("appraisal scales with income, development, and population", () => {
    const small = makeFakeCity({ population: 200, inventory: { Wheat: 100 } });
    const big = makeFakeCity({
      population: 2000,
      inventory: { Wheat: 800 },
      upgrades: { wagonDepot: 2 },
      features: { hasBank: true, hasSchool: true },
    });
    expect(big.getAppraisal().value).toBeGreaterThan(small.getAppraisal().value);
  });

  test("non-food shop stock no longer moves the city price (old exploit dead)", () => {
    const stocked = makeFakeCity({ inventory: { Wheat: 500, Iron: 400 } });
    const before = stocked.getAppraisal().value;
    stocked.inventory.delete("Iron");
    expect(stocked.getAppraisal().value).toBe(before);
  });

  test("starving cities appraise as distressed fixer-uppers", () => {
    const fed = makeFakeCity({ population: 1000, inventory: { Wheat: 600 } });
    const starving = makeFakeCity({ population: 1000, reputation: 20, inventory: {} });
    const fedAppraisal = fed.getAppraisal();
    const starvingAppraisal = starving.getAppraisal();
    expect(starvingAppraisal.condition.multiplier).toBeLessThan(fedAppraisal.condition.multiplier);
    expect(starvingAppraisal.value).toBeLessThan(fedAppraisal.value);
  });

  test("ownership stage costs derive from the appraisal", () => {
    const city = makeFakeCity({ population: 1200, inventory: { Wheat: 500 } });
    const appraised = city.getAppraisal().value;
    const costs = city.getOwnershipStageCosts();
    const base = Math.max(300, appraised);
    expect(costs.buildings).toBe(Math.max(350, Math.floor(base * 0.35)));
  });

  function makeManagementHarness(cityOpts = {}) {
    const city = makeFakeCity(cityOpts);
    const removed = [];
    const player = {
      gold: 100,
      ownedRefs: [city],
      ownsCity(c) { return this.ownedRefs.includes(c); },
      getOwnedCities() { return this.ownedRefs.slice(); },
      earnGold(amount) { this.gold += amount; },
      removeOwnedCity(c) {
        removed.push(c);
        this.ownedRefs = this.ownedRefs.filter((entry) => entry !== c);
        return true;
      },
    };
    const world = { cities: [city], player };
    const cm = new global.CityManagement(world, { player });
    return { city, player, cm, removed };
  }

  test("listed cities attract deed offers", () => {
    const { city, cm } = makeManagementHarness();
    const deal = city._ensureOwnershipDeal();
    deal.listedForSale = true;
    deal.nextOfferDay = 0;
    const origRandom = Math.random;
    Math.random = () => 0.0; // guarantee offer roll and lowest multiplier
    try {
      cm._processDeedOffers(10);
    } finally {
      Math.random = origRandom;
    }
    expect(deal.saleOffer).toBeTruthy();
    expect(deal.saleOffer.expiresDay).toBe(13);
    expect(deal.saleOffer.amount).toBeGreaterThan(0);
  });

  test("accepting a deed offer pays out gold plus pending payouts and releases the city", () => {
    const { city, player, cm, removed } = makeManagementHarness();
    city.management.ownerPayoutDue = 40;
    const deal = city._ensureOwnershipDeal();
    deal.purchasePrice = 500;
    deal.saleOffer = { buyerName: "Duke Thorne", amount: 900, createdDay: 9, expiresDay: 12 };

    const res = cm.acceptDeedOffer(city);
    expect(res.ok).toBe(true);
    expect(res.profit).toBe(400);
    expect(player.gold).toBe(100 + 900 + 40);
    expect(removed).toContain(city);
    expect(city.management.ownerPayoutDue).toBe(0);
    expect(deal.saleOffer).toBeNull();
    expect(deal.ownerName).toBe("Duke Thorne");
    expect(deal.purchased).toEqual({ bank: false, buildings: false, shop: false });
  });

  test("quick sale pays 80% of appraisal", () => {
    const { city, player, cm } = makeManagementHarness();
    const expected = Math.max(50, Math.floor(city.getAppraisal().value * 0.8));
    const res = cm.sellCityQuick(city);
    expect(res.ok).toBe(true);
    expect(res.amount).toBe(expected);
    expect(player.gold).toBe(100 + expected);
  });

  test("the settled capital cannot be sold", () => {
    const { city, cm } = makeManagementHarness();
    cm.myCity = city;
    cm.isSettled = true;
    const res = cm.sellCityQuick(city);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("capital");
  });

  test("AI attacks on purchased cities schedule a warning instead of instant conquest", () => {
    const { city, cm } = makeManagementHarness();
    const attacker = makeFakeCity({ name: "Rivalburg", population: 900 });
    attacker.location = { x: 20, y: 20 };
    attacker.management.units = [
      { hp: 10, maxHp: 10, attack: 3, defense: 1, state: "idle" },
      { hp: 10, maxHp: 10, attack: 3, defense: 1, state: "idle" },
    ];
    attacker.management.budget = 5000;
    cm.world.cities.push(attacker);
    cm._nextAIDecisionDay = 0;
    cm._getAIInvasionPreview = () => ({ attackPower: 50, defensePower: 1, winChance: 0.9, warCost: 100, distance: 10 });

    const origRandom = Math.random;
    Math.random = () => 0.0; // always pass the 0.32 attack roll
    try {
      cm._runAICityWarfare(5);
    } finally {
      Math.random = origRandom;
    }

    const incoming = cm.getIncomingInvasions(city);
    expect(incoming).toHaveLength(1);
    expect(incoming[0].arrivalDay).toBe(6);
    // City is still the player's until the invasion actually resolves.
    expect(cm._isPlayerOwnedCity(city)).toBe(true);
  });

  test("resolving a lost invasion on a purchased city transfers ownership with a reset deal", () => {
    const { city, cm, removed } = makeManagementHarness();
    const attacker = makeFakeCity({ name: "Rivalburg" });
    cm.world.cities.push(attacker);
    const inv = {
      attackerIndex: 1,
      targetIndex: 0,
      arrivalDay: 6,
      warCost: 100,
      preview: { attackPower: 60, defensePower: 1, winChance: 1, warCost: 100, distance: 10 },
    };
    const origRandom = Math.random;
    Math.random = () => 0.0; // defended = (0 >= winChance 1) => false → city falls
    try {
      cm._resolvePlayerCityInvasion(inv, 6);
    } finally {
      Math.random = origRandom;
    }
    expect(removed).toContain(city);
    expect(city.ownership.ownerName).toBe("Rivalburg Dominion");
    expect(city.ownership.purchased).toEqual({ bank: false, buildings: false, shop: false });
    expect(city.ownership.saleOffer).toBeNull();
  });
});
