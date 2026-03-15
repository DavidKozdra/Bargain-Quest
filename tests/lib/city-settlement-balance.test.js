describe("City settlement balance", () => {
  const prevWindow = global.window;
  const prevWindowCityManagement = prevWindow && prevWindow.CityManagement;
  const prevCity = global.City;

  beforeAll(() => {
    global.window = global.window || {};
    if (typeof global.window.addEventListener !== "function") global.window.addEventListener = () => {};
    if (typeof global.window.removeEventListener !== "function") global.window.removeEventListener = () => {};

    global.City = class MockCity {
      constructor({ name, location, population, stockProfile }) {
        this.name = name;
        this.location = location;
        this.population = population;
        this.stockProfile = stockProfile;
        this.inventory = new Map([
          ["Fish", { quantity: 99 }],
          ["Wood", { quantity: 12 }],
        ]);
        this.stockedBooks = ["Ledger"];
        this.bookHolidays = [{ name: "Book Fair" }];
        this.stockedWeapons = ["Sword"];
        this.hasGamblingDen = true;
        this.hasBank = true;
        this.hasBlackMarket = true;
        this.hasBountyBoard = true;
        this.hasWeaponShop = true;
        this.hasWinery = true;
        this.hasSchool = true;
        this.management = { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [], units: [], ownerPayoutDue: 0, ownerTaxShare: 0.35 };
      }

      applyFoundedSettlementProfile({ starterSupplies } = {}) {
        this.appliedFoundedProfile = true;
        this.inventory.clear();
        this.stockedBooks = [];
        this.bookHolidays = [];
        this.stockedWeapons = [];
        this.hasGamblingDen = false;
        this.hasBank = false;
        this.hasBlackMarket = false;
        this.hasBountyBoard = false;
        this.hasWeaponShop = false;
        this.hasWinery = false;
        this.hasSchool = false;
        for (const [itemKey, qty] of Object.entries(starterSupplies || {})) {
          this.inventory.set(itemKey, { quantity: qty });
        }
        return this;
      }

      refreshCoastalStatus() {
        this.refreshedCoastalStatus = true;
        this.isCoastal = false;
        this.port = false;
        return false;
      }
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

    if (prevCity === undefined) delete global.City;
    else global.City = prevCity;
  });

  test("settling creates a lean founded city instead of a stocked npc market", () => {
    const world = {
      grid: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ({ options: ["Grass"] }))),
      cityLocationMap: new Set(),
      cities: [],
      portCityLocations: [],
      player: {},
    };
    const cm = new global.window.CityManagement(world, {
      notificationManager: { log() {} },
    });

    const result = cm.settleAt(1, 1, "Newfield");

    expect(result.ok).toBe(true);
    expect(result.city.stockProfile).toBe("founded");
    expect(result.city.appliedFoundedProfile).toBe(true);
    expect(result.city.refreshedCoastalStatus).toBe(true);
    expect(result.city.inventory.has("Fish")).toBe(false);
    expect(result.city.inventory.has("Wood")).toBe(false);
    expect(result.city.inventory.get("Wheat")).toEqual({ quantity: 30 });
    expect(result.city.stockedBooks).toEqual([]);
    expect(result.city.stockedWeapons).toEqual([]);
    expect(result.city.hasWeaponShop).toBe(false);
    expect(result.city.management.budget).toBe(600);
  });
});
