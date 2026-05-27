const { SaveAPI } = require("../../Koz_Engine_Lib/SaveLoad/saveApi");
const { createMemoryDriver } = require("../../Koz_Engine_Lib/SaveLoad/storageDrivers");

global.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};

global.KozEngine = {
  SaveLoad: {
    saveApi: { SaveAPI },
    storageDrivers: {
      createLocalStorageDriver: () => createMemoryDriver(),
    },
  },
};

const adapter = require("../../adapters/bargainQuestSaveAdapter");

describe("adapters/bargainQuestSaveAdapter", () => {
  test("validates payload shape/version", () => {
    expect(adapter.validateParsedSave({ version: adapter.constants.SAVE_VERSION, player: {}, cities: [] }).ok).toBe(true);
    expect(adapter.validateParsedSave({ version: 6, player: {}, cities: [] }).ok).toBe(true);
    expect(adapter.validateParsedSave({ version: 2, player: {}, cities: [] }).ok).toBe(false);
    expect(adapter.validateParsedSave({ version: adapter.constants.SAVE_VERSION, player: {} }).ok).toBe(false);
  });

  test("normalizes ownership and management", () => {
    const own = adapter.normalizeCityOwnership({}, "Harbor");
    expect(own.ownerName).toBe("Harbor Council");
    const prog = adapter.normalizeCityProgression({
      researchPoints: "18",
      completedProjects: ["orbital_program", null, ""],
      unlockedProjects: ["market_network"],
      activeProject: "orbital_program",
      spaceProgram: 1,
      spaceportBuilt: 0,
      alienContact: true,
      planetVisits: ["luna", 3],
      researchFocus: "space",
      lastResearchTickDay: "12",
      lastSpaceStockDay: "14",
    });
    expect(prog).toMatchObject({
      researchPoints: 18,
      completedProjects: ["orbital_program"],
      unlockedProjects: ["market_network"],
      activeProject: "orbital_program",
      spaceProgram: true,
      spaceportBuilt: false,
      alienContact: true,
      planetVisits: ["luna"],
      researchFocus: "space",
      lastResearchTickDay: 12,
      lastSpaceStockDay: 14,
    });
    const mg = adapter.normalizeCityManagement({
      taxRate: 2,
      budget: -5,
      focusKey: "civic",
      focusEffects: { happiness: 8, popGrowth: 0.01 },
      districts: { market: "2", granary: 1, harbor: -4 },
      districtEffects: { routeIncome: "0.18", happiness: "2", nonsense: "bad" },
      activeOperations: [{
        key: "harvest_drive",
        label: "Harvest Drive",
        startedDay: 3,
        completeDay: 6,
        durationDays: 3,
        summary: "Food push",
        costs: { gold: 90, items: { Wine: 1 } },
      }],
      operationBuffs: [{
        key: "festival_spirit",
        label: "Festival Spirit",
        grantedDay: 6,
        expiresDay: 11,
        effects: { happiness: 10 },
      }],
      operationCooldowns: { harvest_drive: 11 },
      directives: [{
        key: "stock_granaries",
        label: "Stock The Granaries",
        detail: "Raise food reserves.",
        createdDay: 4,
        deadlineDay: 8,
        status: "active",
        reward: { gold: 120, reputation: 2 },
        target: { type: "food_days", value: 8 },
        recommendedOperationKey: "harvest_drive",
      }],
      directiveHistory: [{
        key: "open_market",
        label: "Open The Market",
        detail: "Restore trade.",
        createdDay: 1,
        deadlineDay: 5,
        status: "completed",
        reward: { gold: 125, reputation: 2 },
        target: { type: "routes", value: 1 },
        summary: "Completed cleanly.",
      }],
      directiveCooldowns: { stock_granaries: 12 },
      activityFeed: [{
        day: 7,
        ts: 12345,
        type: "success",
        category: "trade",
        message: "Convoy reached Harbor Ally.",
      }],
      dailySnapshot: {
        day: 7,
        budget: 640,
        payoutDue: 50,
        population: 220,
        reputation: 61.5,
        foodDays: 8,
        happiness: 74,
        routeCompleted: 3,
        routeLost: 1,
        queueCount: 2,
        developmentScore: 4,
        unitCount: 1,
        unitHpTotal: 12,
        directiveCount: 1,
      },
      dailyBrief: {
        day: 7,
        headline: "Treasury climbed by 140g over the last day.",
        tone: "good",
        budgetDelta: 140,
        payoutDelta: 12,
        populationDelta: 5,
        reputationDelta: 1.5,
        foodDays: 8,
        foodDelta: -1,
        routeCompletedDelta: 1,
        routeLostDelta: 0,
        developmentDelta: 1,
        unitHpDelta: -2,
        alerts: [{ label: "Food Falling", detail: "Reserves dropped.", tone: "#ffcc80", tabKey: "build" }],
      },
      units: [{
        id: 9,
        x: "4",
        y: 2.8,
        state: "moving",
        classKey: "guard",
        movementType: "naval",
        level: 2,
        xp: 6,
        kills: 3,
        accuracy: 0.81,
        critChance: 0.14,
        attackRangeMin: 2,
        attackRangeMax: 5,
        reactionRange: 6,
      }],
    });
    expect(mg.taxRate).toBe(0.5);
    expect(mg.budget).toBe(0);
    expect(mg.focusKey).toBe("civic");
    expect(mg.focusEffects).toMatchObject({ happiness: 8, popGrowth: 0.01 });
    expect(mg.districts).toEqual({ market: 2, granary: 1 });
    expect(mg.districtEffects).toEqual({ routeIncome: 0.18, happiness: 2 });
    expect(mg.activeOperations).toHaveLength(1);
    expect(mg.activeOperations[0]).toMatchObject({
      key: "harvest_drive",
      completeDay: 6,
      costs: { gold: 90, items: { Wine: 1 } },
    });
    expect(mg.operationBuffs).toHaveLength(1);
    expect(mg.operationCooldowns.harvest_drive).toBe(11);
    expect(mg.directives).toHaveLength(1);
    expect(mg.directives[0]).toMatchObject({
      key: "stock_granaries",
      deadlineDay: 8,
      reward: { gold: 120, reputation: 2 },
      target: { type: "food_days", value: 8 },
    });
    expect(mg.directiveHistory).toHaveLength(1);
    expect(mg.directiveCooldowns.stock_granaries).toBe(12);
    expect(mg.activityFeed).toHaveLength(1);
    expect(mg.activityFeed[0]).toMatchObject({
      day: 7,
      type: "success",
      category: "trade",
      message: "Convoy reached Harbor Ally.",
    });
    expect(mg.dailySnapshot).toMatchObject({
      day: 7,
      budget: 640,
      foodDays: 8,
      routeCompleted: 3,
    });
    expect(mg.dailyBrief).toMatchObject({
      day: 7,
      tone: "good",
      budgetDelta: 140,
      developmentDelta: 1,
    });
    expect(mg.dailyBrief.alerts).toHaveLength(1);
    expect(mg.units).toHaveLength(1);
    expect(mg.units[0]).toMatchObject({
      id: 9,
      x: 4,
      y: 2,
      state: "moving",
      classKey: "guard",
      movementType: "naval",
      level: 2,
      xp: 6,
      kills: 3,
      accuracy: 0.81,
      critChance: 0.14,
      attackRangeMin: 2,
      attackRangeMax: 5,
      reactionRange: 6,
    });
  });

  test("serializes a runtime snapshot", () => {
    const payload = adapter.serializeRuntimeSnapshot({
      player: {
        x: 1, y: 2, gold: 10, name: "Cap",
        inventory: new Map([["Fish", { quantity: 2 }]]),
        party: [], direction: "down", hasWon: false,
        cargoCapacity: 50, combatStrength: 3,
        equippedWeapon: null, equippedBag: null,
        fleet: [], activeBoat: null, modifiers: {},
        level: 1, xp: 0, statPoints: 0,
        bonusMaxHP: 0, bonusAttack: 0, bonusDefense: 0, bonusMagic: 0, bonusCharm: 0, bonusSpeed: 0,
        currentHP: 10, _lastRegenHour: 0, weeklyIncome: 0, weeklySpending: 0, _startingGold: 100,
        _pendingInvestment: null, ownedCities: [], isKing: false,
        spaceTravel: { currentCity: null, currentPlanet: null, visitedPlanets: [], lastLaunchCity: null, inOrbit: false },
      },
      cities: [{
        name: "Harbor",
        location: { x: 2, y: 3 },
        population: 420,
        isCoastal: true,
        inventory: new Map([["Fish", { quantity: 3 }]]),
        holidays: [],
        bookHolidays: [],
        stockedBooks: [],
        priceHistory: {},
        buildingVariant: 1,
        reputation: 54,
        hasGamblingDen: false,
        hasBank: true,
        hasBlackMarket: false,
        hasBountyBoard: false,
        hasWeaponShop: false,
        hasWinery: false,
        hasSchool: true,
        hasResearchLab: true,
        hasSpaceport: false,
        hasAlienExchange: false,
        stockedWeapons: [],
        progression: {
          researchPoints: 23,
          completedProjects: ["market_network"],
          unlockedProjects: ["research_lab"],
          activeProject: "research_lab",
          spaceProgram: false,
          spaceportBuilt: false,
          alienContact: false,
          planetVisits: [],
          researchFocus: "trade",
          lastResearchTickDay: 5,
          lastSpaceStockDay: 5,
        },
        management: {
          budget: 120,
          taxRate: 0.05,
          buildingQueue: [],
          upgradeLevels: {},
          routes: [],
          units: [],
          ownerPayoutDue: 0,
          ownerTaxShare: 0.35,
          districts: {},
          districtEffects: {},
        },
        ownership: { ownerName: "Council", offerAccepted: false, purchased: { bank: false, buildings: false, shop: false } },
      }],
      dayNight: { timeOfDay: 0, daysElapsed: 0 },
      cols: 10, rows: 10, mapSeed: 1, isCustomMap: false,
      landmass: 1, worldGenConfig: {}, difficulty: "normal",
      gameSpeedIndex: 2, goldTarget: 5000, dayLimit: 0,
      portCityLocations: [],
      cityManagement: null,
      worldSessions: [{
        key: "planet:orbit:luna-dock",
        label: "Luna Port Surface",
        sessionType: "planet_surface",
        spaceContext: { nodeKey: "orbit", bodyKey: "luna-dock", bodyName: "Luna Dock" },
        cols: 2,
        rows: 1,
        grid: [[
          { options: ["Rock"], collapsed: true },
          { options: ["Snow"], collapsed: true, decor: "snowdrift" },
        ]],
        elevationMap: [[0.1, 0.2]],
        temperatureMap: [[0.2, 0.1]],
        difficultyMap: [[1.5, 2.5]],
        cities: [],
        portCityLocations: [],
        systemSnapshots: { traderManager: null, raiderManager: null, eventSystem: null, contractSystem: null, treasureSystem: null },
        mapSeed: 17,
        isCustomMap: true,
        playerPosition: { x: 1, y: 0 },
      }],
      activeWorldSessionKey: "homeworld",
      bearEmpireSystem: {
        toJSON: () => ({
          active: true,
          capitalSystemKey: "vanta",
          systemsControlled: ["vanta"],
          bearStanding: 3,
        }),
      },
    });
    expect(payload.version).toBe(adapter.constants.SAVE_VERSION);
    expect(payload.player.name).toBe("Cap");
    expect(payload.cities[0].progression).toMatchObject({
      researchPoints: 23,
      completedProjects: ["market_network"],
      activeProject: "research_lab",
    });
    expect(payload.player.spaceTravel).toMatchObject({
      currentCity: null,
      currentPlanet: null,
      visitedPlanets: [],
      lastLaunchCity: null,
      inOrbit: false,
    });
    expect(payload.activeWorldSessionKey).toBe("homeworld");
    expect(payload.worldSessions).toHaveLength(1);
    expect(payload.worldSessions[0]).toMatchObject({
      key: "planet:orbit:luna-dock",
      sessionType: "planet_surface",
      mapSeed: 17,
      isCustomMap: true,
      playerPosition: { x: 1, y: 0 },
    });
    expect(payload.worldSessions[0].customTerrain.biomes).toEqual([5, 4]);
    expect(payload.bearEmpireSystem).toMatchObject({
      active: true,
      capitalSystemKey: "vanta",
      systemsControlled: ["vanta"],
      bearStanding: 3,
    });
  });

  test("reads and validates saved payload from storage", () => {
    localStorage.setItem(adapter.constants.SAVE_KEY, JSON.stringify({ version: adapter.constants.SAVE_VERSION, player: {}, cities: [] }));
    expect(adapter.readParsedSave()).toEqual({ version: adapter.constants.SAVE_VERSION, player: {}, cities: [] });

    localStorage.setItem(adapter.constants.SAVE_KEY, JSON.stringify({ version: 2, player: {}, cities: [] }));
    expect(adapter.readParsedSave()).toBeNull();
  });

  test("applies runtime snapshot for custom-map saves", async () => {
    const player = {
      inventory: new Map(),
      recalcModifiers: jest.fn(),
      getMaxHP: () => 12,
      getActiveSpaceShip: () => ({ id: "ship-1" }),
    };
    const dayNight = { timeOfDay: 0, daysElapsed: 0 };

    class City {
      constructor({ name, location, population }) {
        this.name = name;
        this.location = location;
        this.population = population;
        this.inventory = new Map();
        this.stockedWeapons = [];
      }
    }
    class Boat {
      static fromJSON(data) { return { restoredBoat: data.type }; }
    }
    class TraderManager {
      static fromJSON(data) { return { traders: data }; }
    }
    class RaiderManager {
      static fromJSON(data) { return { raiders: data }; }
    }
    class EventSystem {
      static fromJSON(data) { return { events: data }; }
    }
    class ContractSystem {
      static fromJSON(data) { return { contracts: data }; }
    }
    class TreasureSystem {
      static fromJSON(data) { return { treasure: data }; }
    }
    class BankingSystem {
      static fromJSON(data) { return { banking: data }; }
    }
    class SmugglingSystem {
      static fromJSON(data) { return { smuggling: data }; }
    }
    class BountyBoard {
      static fromJSON(data) { return { bounty: data }; }
    }
    class GamblingSystem {
      static fromJSON(data) { return { gambling: data }; }
    }
    class SpaceTravelSystem {
      static fromJSON(data, cityLookup) {
        return {
          phase: data.phase,
          currentNode: data.currentNode,
          launchCity: cityLookup(data.launchCityName),
          activeShip: { id: "saved-copy" },
        };
      }
    }

    const result = await adapter.applyRuntimeSnapshot({
      data: {
        version: 6,
        mapSeed: 7,
        cols: 2,
        rows: 1,
        isCustomMap: true,
        customTerrain: {
          biomes: [2, 0],
          decor: [0, 2],
          elevation: [0.2, 0.1],
          temperature: [0.4, 0.3],
          difficulty: [1.2, 1.8],
        },
        landmass: 1,
        worldGenConfig: {},
        difficulty: "normal",
        goldTarget: 5000,
        dayLimit: 0,
        gameSpeed: 2,
        player: {
          x: 4, y: 5, gold: 77, name: "Cap",
          inventory: [["Fish", 3], ["Wheat", -2]],
          party: ["mate"],
          direction: "left",
          hasWon: false,
          cargoCapacity: 50,
          combatStrength: 3,
          equippedWeapon: null,
          equippedBag: null,
          level: 2,
          xp: 9,
          statPoints: 1,
          bonusMaxHP: 2,
          bonusAttack: 1,
          bonusDefense: 0,
          bonusMagic: 0,
          bonusCharm: 0,
          bonusSpeed: 1,
          currentHP: 11,
          _lastRegenHour: 4,
          weeklyIncome: 8,
          weeklySpending: 2,
          _startingGold: 100,
          _pendingInvestment: null,
          ownedCities: [0],
          isKing: false,
          modifiers: { negotiationDiscount: 0.1 },
          spaceTravel: {
            currentCity: "Harbor",
            currentPlanet: "orbit",
            visitedPlanets: ["aurelia"],
            lastLaunchCity: "Harbor",
            inOrbit: true,
            spaceFleet: [],
            activeShipIndex: -1,
            travelSystemState: {
              phase: "in_orbit",
              currentNode: "orbit",
              launchCityName: "Harbor",
            },
          },
          fleet: [{ type: "sloop" }],
          activeBoatIndex: 0,
        },
        dayNight: { timeOfDay: 1.5, daysElapsed: 8 },
        cities: [{
          name: "Harbor",
          location: { x: 1, y: 2 },
          population: 300,
          isCoastal: true,
          inventory: [["Fish", 2]],
          holidays: [],
          bookHolidays: [],
          stockedBooks: [],
          priceHistory: {},
          reputation: 70,
          management: { budget: 10, taxRate: 0.2 },
          ownership: {},
          stockedWeapons: [],
        }],
        traders: [{ id: 1 }],
        raiders: [{ id: 2 }],
        events: { tilesMoved: 9 },
        contractSystem: { a: 1 },
        treasureSystem: { b: 2 },
        bankingSystem: { c: 3 },
        smugglingSystem: { d: 4 },
        bountyBoard: { e: 5 },
        gamblingSystem: { f: 6 },
        coastalVersion: 1,
        portCityLocations: [{ x: 1, y: 2 }],
        cityManagement: { settled: true },
        isCityManageMode: true,
        adventureCityManage: false,
        playerPreCityPos: { x: 9, y: 9 },
        rngState: { seed: 1 },
      },
      runtime: {
        player,
        dayNight,
        systems: { minigameManager: null },
        deps: {
          City,
          Boat,
          TraderManager,
          RaiderManager,
          EventSystem,
          ContractSystem,
          TreasureSystem,
          BankingSystem,
          SmugglingSystem,
          BountyBoard,
          GamblingSystem,
          SpaceTravelSystem,
          ItemLibrary: { Fish: { name: "Fish" }, Wheat: { name: "Wheat" } },
          getDifficultyConfig: jest.fn(() => ({ hp: 1 })),
          SPEED_STEPS: [0.5, 1, 2],
          createMinigameManager: jest.fn(() => ({ mini: true })),
        },
      },
    });

    expect(result.dimensions).toEqual({ cols: 2, rows: 1 });
    expect(result.terrain.grid[0][0].options[0]).toBe("Grass");
    expect(result.cities[0].ownership.ownerName).toBe("Harbor Council");
    expect(player.inventory.get("Fish").quantity).toBe(3);
    expect(player.inventory.has("Wheat")).toBe(false);
    expect(player.activeBoat).toEqual({ restoredBoat: "sloop" });
    expect(result.systems.minigameManager).toEqual({ mini: true });
    expect(result.flags.savedIsCityManageMode).toBe(true);
    expect(result.flags.savedWorldSessions).toEqual([]);
    expect(result.flags.savedActiveWorldSessionKey).toBeNull();
    expect(dayNight.daysElapsed).toBe(8);
    expect(player._spaceTravelSystem.phase).toBe("in_orbit");
    expect(player._spaceTravelSystem.launchCity.name).toBe("Harbor");
    expect(player._spaceTravelSystem.activeShip).toEqual({ id: "ship-1" });
    expect(player.recalcModifiers).toHaveBeenCalled();
  });

  test("restores stored world sessions alongside the live snapshot", async () => {
    const player = {
      inventory: new Map(),
      recalcModifiers: jest.fn(),
      getMaxHP: () => 10,
    };
    const dayNight = { timeOfDay: 0, daysElapsed: 0 };

    class City {
      constructor({ name, location, population }) {
        this.name = name;
        this.location = location;
        this.population = population;
        this.inventory = new Map();
        this.stockedWeapons = [];
      }
    }
    class Boat { static fromJSON(data) { return data; } }
    class TraderManager { static fromJSON(data) { return { traders: data }; } }
    class RaiderManager { static fromJSON(data) { return { raiders: data }; } }
    class EventSystem { static fromJSON(data) { return { events: data }; } }
    class ContractSystem { static fromJSON(data) { return { contracts: data }; } }
    class TreasureSystem { static fromJSON(data) { return { treasure: data }; } }
    class BankingSystem { static fromJSON(data) { return { banking: data }; } }
    class SmugglingSystem { static fromJSON(data) { return { smuggling: data }; } }
    class BountyBoard { static fromJSON(data) { return { bounty: data }; } }
    class GamblingSystem { static fromJSON(data) { return { gambling: data }; } }

    const result = await adapter.applyRuntimeSnapshot({
      data: {
        version: adapter.constants.SAVE_VERSION,
        mapSeed: 3,
        cols: 1,
        rows: 1,
        isCustomMap: true,
        customTerrain: {
          biomes: [2],
          decor: [0],
          elevation: [0.2],
          temperature: [0.5],
          difficulty: [1],
        },
        worldGenConfig: {},
        difficulty: "normal",
        player: {
          x: 0, y: 0, gold: 10, name: "Cap",
          inventory: [],
          party: [],
          fleet: [],
          ownedCities: [],
        },
        dayNight: { timeOfDay: 0, daysElapsed: 0 },
        cities: [],
        worldSessions: [{
          key: "planet:luna:grayhold",
          label: "Grayhold Surface",
          sessionType: "planet_surface",
          spaceContext: { nodeKey: "luna", bodyKey: "grayhold", bodyName: "Grayhold" },
          cols: 2,
          rows: 1,
          mapSeed: 99,
          isCustomMap: true,
          playerPosition: { x: 1, y: 0 },
          portCityLocations: [{ x: 0, y: 0 }],
          customTerrain: {
            biomes: [5, 4],
            decor: [3, 5],
            elevation: [0.2, 0.3],
            temperature: [0.1, 0.05],
            difficulty: [2, 3],
          },
          cities: [{
            name: "Grayhold Port",
            location: { x: 0, y: 0 },
            population: 220,
            isCoastal: false,
            inventory: [],
            holidays: [],
            bookHolidays: [],
            stockedBooks: [],
            priceHistory: {},
            reputation: 55,
            management: { budget: 0, taxRate: 0.2 },
            ownership: {},
            stockedWeapons: [],
          }],
          systemSnapshots: {
            traderManager: { traders: [{ id: 1 }] },
            raiderManager: { raiders: [] },
            eventSystem: { moved: 4 },
            contractSystem: { active: [] },
            treasureSystem: { digSites: [] },
          },
        }],
        activeWorldSessionKey: "planet:luna:grayhold",
        bearEmpireSystem: {
          active: true,
          capitalSystemKey: "vanta",
          systemsControlled: ["vanta"],
          resistanceCells: ["luna"],
        },
      },
      runtime: {
        player,
        dayNight,
        cities: [],
        systems: { minigameManager: null },
        deps: {
          City,
          Boat,
          TraderManager,
          RaiderManager,
          EventSystem,
          ContractSystem,
          TreasureSystem,
          BankingSystem,
          SmugglingSystem,
          BountyBoard,
          GamblingSystem,
          ItemLibrary: {},
          getDifficultyConfig: jest.fn(() => ({ hp: 1 })),
          SPEED_STEPS: [0.5, 1, 2],
          createMinigameManager: jest.fn(() => null),
        },
      },
    });

    expect(result.flags.savedActiveWorldSessionKey).toBe("planet:luna:grayhold");
    expect(result.flags.savedWorldSessions).toHaveLength(1);
    expect(result.flags.savedWorldSessions[0]).toMatchObject({
      key: "planet:luna:grayhold",
      label: "Grayhold Surface",
      sessionType: "planet_surface",
      mapSeed: 99,
      playerPosition: { x: 1, y: 0 },
    });
    expect(result.flags.savedWorldSessions[0].grid[0][0].options[0]).toBe("Rock");
    expect(result.flags.savedWorldSessions[0].cities[0].name).toBe("Grayhold Port");
    expect(result.flags.savedWorldSessions[0].systemSnapshots.contractSystem).toEqual({ active: [] });
    expect(result.flags.savedBearEmpireData).toMatchObject({
      active: true,
      capitalSystemKey: "vanta",
      systemsControlled: ["vanta"],
      resistanceCells: ["luna"],
    });
  });

  test("publishes restored cities before trader restore runs", async () => {
    const runtimeCities = [];
    const player = {
      inventory: new Map(),
      recalcModifiers: jest.fn(),
      getMaxHP: () => 10,
    };
    const dayNight = { timeOfDay: 0, daysElapsed: 0 };

    class City {
      constructor({ name, location, population }) {
        this.name = name;
        this.location = location;
        this.population = population;
        this.inventory = new Map();
        this.stockedWeapons = [];
      }
    }

    class TraderManager {
      static fromJSON() {
        return {
          firstCityLocation: runtimeCities[0]?.location || null,
        };
      }
    }

    class RaiderManager {
      static fromJSON(data) { return { raiders: data }; }
    }
    class EventSystem {
      static fromJSON(data) { return { events: data }; }
    }
    class ContractSystem {
      static fromJSON(data) { return { contracts: data }; }
    }
    class TreasureSystem {
      static fromJSON(data) { return { treasure: data }; }
    }
    class BankingSystem {
      static fromJSON(data) { return { banking: data }; }
    }
    class SmugglingSystem {
      static fromJSON(data) { return { smuggling: data }; }
    }
    class BountyBoard {
      static fromJSON(data) { return { bounty: data }; }
    }
    class GamblingSystem {
      static fromJSON(data) { return { gambling: data }; }
    }
    class Boat {
      static fromJSON(data) { return data; }
    }

    const result = await adapter.applyRuntimeSnapshot({
      data: {
        version: 6,
        mapSeed: 1,
        cols: 1,
        rows: 1,
        isCustomMap: true,
        customTerrain: {
          biomes: [2],
          decor: [0],
          elevation: [0],
          temperature: [0],
          difficulty: [1],
        },
        worldGenConfig: {},
        difficulty: "normal",
        player: {
          x: 0, y: 0, gold: 1, name: "Cap",
          inventory: [],
          party: [],
          fleet: [],
          ownedCities: [],
        },
        dayNight: { timeOfDay: 0, daysElapsed: 0 },
        cities: [{
          name: "Harbor",
          location: { x: 2, y: 3 },
          population: 200,
          inventory: [],
          holidays: [],
          management: {},
        }],
        traders: [{ homeCityIndex: 0 }],
      },
      runtime: {
        player,
        dayNight,
        cities: runtimeCities,
        systems: {},
        deps: {
          City,
          Boat,
          TraderManager,
          RaiderManager,
          EventSystem,
          ContractSystem,
          TreasureSystem,
          BankingSystem,
          SmugglingSystem,
          BountyBoard,
          GamblingSystem,
          ItemLibrary: {},
          getDifficultyConfig: jest.fn(() => ({})),
          createMinigameManager: jest.fn(() => null),
        },
      },
    });

    expect(runtimeCities[0].location).toEqual({ x: 0, y: 0 });
    expect(result.systems.traderManager.firstCityLocation).toEqual({ x: 0, y: 0 });
  });

  test("relocates restored cities off water and refreshes port locations", async () => {
    const player = {
      inventory: new Map(),
      recalcModifiers: jest.fn(),
      getMaxHP: () => 10,
    };
    const dayNight = { timeOfDay: 0, daysElapsed: 0 };

    class City {
      constructor({ name, location, population }) {
        this.name = name;
        this.location = location;
        this.population = population;
        this.inventory = new Map();
        this.stockedWeapons = [];
      }
    }
    class Boat { static fromJSON(data) { return data; } }
    class TraderManager { static fromJSON(data) { return { traders: data }; } }
    class RaiderManager { static fromJSON(data) { return { raiders: data }; } }
    class EventSystem { static fromJSON(data) { return { events: data }; } }
    class ContractSystem { static fromJSON(data) { return { contracts: data }; } }
    class TreasureSystem { static fromJSON(data) { return { treasure: data }; } }
    class BankingSystem { static fromJSON(data) { return { banking: data }; } }
    class SmugglingSystem { static fromJSON(data) { return { smuggling: data }; } }
    class BountyBoard { static fromJSON(data) { return { bounty: data }; } }
    class GamblingSystem { static fromJSON(data) { return { gambling: data }; } }

    const result = await adapter.applyRuntimeSnapshot({
      data: {
        version: 6,
        mapSeed: 1,
        cols: 3,
        rows: 3,
        isCustomMap: true,
        customTerrain: {
          biomes: [
            0, 0, 0,
            0, 2, 0,
            0, 0, 0,
          ],
          decor: new Array(9).fill(0),
          elevation: new Array(9).fill(0.2),
          temperature: new Array(9).fill(0.5),
          difficulty: new Array(9).fill(1),
        },
        worldGenConfig: {},
        difficulty: "normal",
        player: {
          x: 1, y: 1, gold: 10, name: "Cap",
          inventory: [],
          party: [],
          direction: "down",
          hasWon: false,
          cargoCapacity: 50,
          combatStrength: 3,
          equippedWeapon: null,
          equippedBag: null,
          fleet: [],
          activeBoatIndex: -1,
          modifiers: {},
          level: 1,
          xp: 0,
          statPoints: 0,
          bonusMaxHP: 0,
          bonusAttack: 0,
          bonusDefense: 0,
          bonusMagic: 0,
          bonusCharm: 0,
          bonusSpeed: 0,
          currentHP: 10,
          _lastRegenHour: 0,
          weeklyIncome: 0,
          weeklySpending: 0,
          _startingGold: 100,
          _pendingInvestment: null,
          ownedCities: [],
          isKing: false,
        },
        dayNight: { timeOfDay: 0, daysElapsed: 0 },
        cities: [{
          name: "Harbor",
          location: { x: 0, y: 0 },
          population: 300,
          isCoastal: true,
          inventory: [],
          holidays: [],
          bookHolidays: [],
          stockedBooks: [],
          priceHistory: {},
          reputation: 50,
          management: { budget: 0, taxRate: 0.2 },
          ownership: {},
          stockedWeapons: [],
        }],
        traders: [],
        raiders: [],
        events: {},
        contractSystem: null,
        treasureSystem: null,
        bankingSystem: null,
        smugglingSystem: null,
        bountyBoard: null,
        gamblingSystem: null,
        coastalVersion: 1,
        portCityLocations: [{ x: 0, y: 0 }],
      },
      runtime: {
        player,
        dayNight,
        cities: [],
        systems: { minigameManager: null },
        deps: {
          City,
          Boat,
          TraderManager,
          RaiderManager,
          EventSystem,
          ContractSystem,
          TreasureSystem,
          BankingSystem,
          SmugglingSystem,
          BountyBoard,
          GamblingSystem,
          ItemLibrary: {},
          getDifficultyConfig: jest.fn(() => ({ hp: 1 })),
          SPEED_STEPS: [0.5, 1, 2],
          createMinigameManager: jest.fn(() => ({ mini: true })),
        },
      },
    });

    expect(result.cities[0].location.x).toBe(1);
    expect(result.cities[0].location.y).toBe(1);
    expect(result.cities[0].isCoastal).toBe(true);
    expect(result.flags.portCityLocations).toHaveLength(1);
    expect(result.flags.portCityLocations[0].x).toBe(1);
    expect(result.flags.portCityLocations[0].y).toBe(1);
  });
});
