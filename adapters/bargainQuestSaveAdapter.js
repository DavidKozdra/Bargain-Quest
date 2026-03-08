(function initBQSaveAdapter(root, factory) {
  const api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.BQLib = root.BQLib || {};
    root.BQLib.adapters = root.BQLib.adapters || {};
    root.BQLib.adapters.bargainQuest = root.BQLib.adapters.bargainQuest || {};
    root.BQLib.adapters.bargainQuest.save = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createBQSaveAdapter(root) {
  const SAVE_KEY = "bargainquest_save";
  const SHARE_PREFIX = "BQ_SAVE_V1:";
  const SAVE_VERSION = 6;
  const COMPAT_VERSIONS = new Set([3, 4, 5, 6]);

  function _buildApi() {
    const saveApiFactory = root?.BQLib?.api?.saveApi;
    const drivers = root?.BQLib?.io?.storageDrivers;
    if (!saveApiFactory?.SaveAPI || !drivers?.createLocalStorageDriver) return null;
    const driver = drivers.createLocalStorageDriver(localStorage);
    return new saveApiFactory.SaveAPI({
      driver,
      key: SAVE_KEY,
      sharePrefix: SHARE_PREFIX,
      serializer: JSON,
    });
  }

  function validateParsedSave(parsed) {
    const okVersion = parsed && COMPAT_VERSIONS.has(Number(parsed.version));
    if (!okVersion) return { ok: false, reason: "bad_version" };
    if (!parsed.player || !Array.isArray(parsed.cities)) return { ok: false, reason: "invalid_payload" };
    return { ok: true };
  }

  function normalizeCityManagement(raw) {
    const m = (raw && typeof raw === "object") ? raw : {};
    return {
      budget: Math.max(0, Math.floor(Number(m.budget) || 0)),
      taxRate: Math.max(0, Math.min(0.5, Number.isFinite(Number(m.taxRate)) ? Number(m.taxRate) : 0.05)),
      buildingQueue: Array.isArray(m.buildingQueue) ? m.buildingQueue : [],
      upgradeLevels: (m.upgradeLevels && typeof m.upgradeLevels === "object") ? m.upgradeLevels : {},
      routes: Array.isArray(m.routes) ? m.routes : [],
    };
  }

  function normalizeCityOwnership(raw, cityName = "City") {
    const fallbackOwner = `${cityName} Council`;
    const o = (raw && typeof raw === "object") ? raw : {};
    const purchased = (o.purchased && typeof o.purchased === "object") ? o.purchased : {};
    return {
      ownerName: (typeof o.ownerName === "string" && o.ownerName.trim()) ? o.ownerName.trim() : fallbackOwner,
      offerAccepted: !!o.offerAccepted,
      purchased: {
        bank: !!purchased.bank,
        buildings: !!purchased.buildings,
        shop: !!purchased.shop,
      },
    };
  }

  function serializeRuntimeSnapshot(ctx) {
    const c = ctx || {};
    const player = c.player;
    const cities = c.cities || [];
    const dayNight = c.dayNight;
    const data = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      mapSeed: c.mapSeed || 0,
      rngState: (c.seededRng && typeof c.seededRng.getState === "function") ? c.seededRng.getState() : null,
      cols: c.cols,
      rows: c.rows,
      isCustomMap: !!c.isCustomMap,
      landmass: typeof c.landmass === "number" ? c.landmass : 1,
      worldGenConfig: (c.worldGenConfig && typeof c.worldGenConfig === "object")
        ? {
            warp: Number(c.worldGenConfig.warp),
            ruggedness: Number(c.worldGenConfig.ruggedness),
            temperatureVariance: Number(c.worldGenConfig.temperatureVariance),
            moistureVariance: Number(c.worldGenConfig.moistureVariance),
            coastalDropoff: Number(c.worldGenConfig.coastalDropoff),
          }
        : null,
      difficulty: c.difficulty || "normal",
      gameSpeed: typeof c.gameSpeedIndex !== "undefined" ? c.gameSpeedIndex : 2,
      goldTarget: typeof c.goldTarget === "number" ? c.goldTarget : 5000,
      dayLimit: typeof c.dayLimit === "number" ? c.dayLimit : 0,
      coastalVersion: 1,
      portCityLocations: Array.isArray(c.portCityLocations) ? c.portCityLocations : [],
      player: {
        x: player.x,
        y: player.y,
        gold: player.gold,
        name: player.name || "Captain",
        inventory: [...player.inventory].map(([k, v]) => [k, v.quantity]),
        party: player.party,
        direction: player.direction || "down",
        hasWon: player.hasWon,
        cargoCapacity: player.cargoCapacity || 50,
        combatStrength: player.combatStrength || 3,
        equippedWeapon: player.equippedWeapon || null,
        equippedBag: player.equippedBag || null,
        fleet: player.fleet.map((b) => b.toJSON()),
        activeBoatIndex: player.activeBoat ? player.fleet.indexOf(player.activeBoat) : -1,
        modifiers: player.modifiers || {},
        level: player.level || 1,
        xp: player.xp || 0,
        statPoints: player.statPoints || 0,
        bonusMaxHP: player.bonusMaxHP || 0,
        bonusAttack: player.bonusAttack || 0,
        bonusDefense: player.bonusDefense || 0,
        bonusMagic: player.bonusMagic || 0,
        bonusCharm: player.bonusCharm || 0,
        bonusSpeed: player.bonusSpeed || 0,
        currentHP: player.currentHP != null ? player.currentHP : (10 + (player.bonusMaxHP || 0)),
        _lastRegenHour: player._lastRegenHour || 0,
        weeklyIncome: player.weeklyIncome || 0,
        weeklySpending: player.weeklySpending || 0,
        _startingGold: player._startingGold || 100,
        _pendingInvestment: player._pendingInvestment || null,
        ownedCities: player.ownedCities || [],
        isKing: !!player.isKing,
      },
      dayNight: {
        timeOfDay: dayNight.timeOfDay,
        daysElapsed: dayNight.daysElapsed,
      },
      cities: cities.map((city) => ({
        name: city.name,
        location: city.location,
        population: city.population,
        isCoastal: !!city.isCoastal,
        inventory: [...city.inventory].map(([k, v]) => [k, v.quantity]),
        holidays: city.holidays,
        bookHolidays: city.bookHolidays || [],
        stockedBooks: city.stockedBooks || [],
        priceHistory: city.priceHistory || {},
        buildingVariant: city.buildingVariant || 0,
        reputation: typeof city.reputation === "number" ? city.reputation : 50,
        hasGamblingDen: city.hasGamblingDen || false,
        hasBank: city.hasBank || false,
        hasBlackMarket: city.hasBlackMarket || false,
        hasBountyBoard: city.hasBountyBoard || false,
        hasWeaponShop: city.hasWeaponShop || false,
        hasWinery: city.hasWinery || false,
        hasSchool: city.hasSchool || false,
        stockedWeapons: city.stockedWeapons || [],
        management: normalizeCityManagement(
          (city.management && typeof city.management.toJSON === "function") ? city.management.toJSON() : (city.management || null)
        ),
        ownership: normalizeCityOwnership(city.ownership, city.name),
      })),
      traders: c.traderManager ? c.traderManager.toJSON() : [],
      raiders: c.raiderManager ? c.raiderManager.toJSON() : [],
      events: c.eventSystem ? c.eventSystem.toJSON() : {},
      contractSystem: c.contractSystem && typeof c.contractSystem.toJSON === "function" ? c.contractSystem.toJSON() : null,
      treasureSystem: c.treasureSystem && typeof c.treasureSystem.toJSON === "function" ? c.treasureSystem.toJSON() : null,
      bankingSystem: c.bankingSystem && typeof c.bankingSystem.toJSON === "function" ? c.bankingSystem.toJSON() : null,
      smugglingSystem: c.smugglingSystem && typeof c.smugglingSystem.toJSON === "function" ? c.smugglingSystem.toJSON() : null,
      bountyBoard: c.bountyBoard && typeof c.bountyBoard.toJSON === "function" ? c.bountyBoard.toJSON() : null,
      gamblingSystem: c.gamblingSystem && typeof c.gamblingSystem.toJSON === "function" ? c.gamblingSystem.toJSON() : null,
      isCityManageMode: !!c.isCityManageMode,
      adventureCityManage: !!c.adventureCityManage,
      playerPreCityPos: c.playerPreCityPos || null,
      cityManagement: (c.cityManagement && typeof c.cityManagement.toJSON === "function") ? c.cityManagement.toJSON() : null,
    };

    if (data.isCustomMap && Array.isArray(c.grid) && c.grid.length > 0) {
      const biomeIndex = { Water: 0, Sand: 1, Grass: 2, Forest: 3, Snow: 4, Rock: 5 };
      const decorIndex = { bush: 1, tree: 2, rock: 3, pebbles: 4, snowdrift: 5, lily: 6, seaweed: 7 };
      const totalCells = data.rows * data.cols;
      const biomeArr = new Array(totalCells);
      const decorArr = new Array(totalCells);
      const elevArr = new Array(totalCells);
      const tempArr = new Array(totalCells);
      const diffArr = new Array(totalCells);
      for (let i = 0; i < data.rows; i++) {
        for (let j = 0; j < data.cols; j++) {
          const idx = i * data.cols + j;
          const cell = c.grid[i] && c.grid[i][j];
          const biome = cell && cell.options ? cell.options[0] : "Grass";
          biomeArr[idx] = biomeIndex[biome] !== undefined ? biomeIndex[biome] : 2;
          decorArr[idx] = cell && cell.decor && decorIndex[cell.decor] ? decorIndex[cell.decor] : 0;
          elevArr[idx] = c.elevationMap[i] ? +(c.elevationMap[i][j] || 0).toFixed(3) : 0;
          tempArr[idx] = c.temperatureMap[i] ? +(c.temperatureMap[i][j] || 0).toFixed(3) : 0;
          diffArr[idx] = c.difficultyMap[i] ? +(c.difficultyMap[i][j] || 0).toFixed(2) : 1;
        }
      }
      data.customTerrain = { biomes: biomeArr, decor: decorArr, elevation: elevArr, temperature: tempArr, difficulty: diffArr };
    }

    return data;
  }

  function has() {
    const api = _buildApi();
    if (!api) return localStorage.getItem(SAVE_KEY) !== null;
    return api.has();
  }

  function remove() {
    const api = _buildApi();
    if (!api) {
      localStorage.removeItem(SAVE_KEY);
      return;
    }
    api.delete();
  }

  function exportToken() {
    const api = _buildApi();
    const raw = api ? api.readRaw() : localStorage.getItem(SAVE_KEY);
    if (!raw) return { ok: false, reason: "no_save" };
    try {
      const token = api ? api.exportShareToken(raw) : `${SHARE_PREFIX}${btoa(unescape(encodeURIComponent(raw)))}`;
      return { ok: true, data: token };
    } catch (_e) {
      return { ok: false, reason: "export_failed" };
    }
  }

  function importToken(text) {
    try {
      const api = _buildApi();
      const input = String(text || "").trim();
      if (!input) return { ok: false, reason: "empty" };
      const raw = api ? api.importShareToken(input) : (() => {
        if (!input.startsWith(SHARE_PREFIX)) return input;
        const encoded = input.slice(SHARE_PREFIX.length).trim();
        return decodeURIComponent(escape(atob(encoded)));
      })();
      const parsed = JSON.parse(raw);
      const valid = validateParsedSave(parsed);
      if (!valid.ok) return valid;
      if (!api) localStorage.setItem(SAVE_KEY, raw);
      return { ok: true };
    } catch (_e) {
      return { ok: false, reason: "parse_error" };
    }
  }

  function readParsedSave() {
    const api = _buildApi();
    const raw = api ? api.readRaw() : localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const valid = validateParsedSave(parsed);
    if (!valid.ok) return null;
    return parsed;
  }

  function _clampNumber(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function _restoreTerrain(data, terrain, deps) {
    const nextGrid = [];
    const nextElevationMap = [];
    const nextDifficultyMap = [];
    const nextTemperatureMap = [];

    if (data.isCustomMap && data.customTerrain) {
      const biomeNames = ["Water", "Sand", "Grass", "Forest", "Snow", "Rock"];
      const decorNames = [null, "bush", "tree", "rock", "pebbles", "snowdrift", "lily", "seaweed"];
      const customTerrain = data.customTerrain;

      for (let i = 0; i < terrain.rows; i++) {
        nextGrid[i] = new Array(terrain.cols);
        nextElevationMap[i] = new Array(terrain.cols);
        nextTemperatureMap[i] = new Array(terrain.cols);
        nextDifficultyMap[i] = new Array(terrain.cols);
        for (let j = 0; j < terrain.cols; j++) {
          const idx = i * terrain.cols + j;
          const biome = biomeNames[customTerrain.biomes[idx]] || "Grass";
          nextGrid[i][j] = { options: [biome], collapsed: true };
          const decor = decorNames[customTerrain.decor[idx]];
          if (decor) nextGrid[i][j].decor = decor;
          nextElevationMap[i][j] = customTerrain.elevation[idx] || 0;
          nextTemperatureMap[i][j] = customTerrain.temperature[idx] || 0;
          nextDifficultyMap[i][j] = customTerrain.difficulty[idx] || 1;
        }
      }
    }

    return {
      grid: nextGrid,
      elevationMap: nextElevationMap,
      difficultyMap: nextDifficultyMap,
      temperatureMap: nextTemperatureMap,
      generated: !(data.isCustomMap && data.customTerrain),
    };
  }

  function _restoreCities(data, deps) {
    const CityCtor = deps.City;
    const itemLibrary = deps.ItemLibrary || {};
    const restoredCities = [];
    const hasSavedCoastal = Array.isArray(data.cities)
      && data.cities.every((cityData) => Object.prototype.hasOwnProperty.call(cityData, "isCoastal"));

    for (const cityData of data.cities) {
      const city = new CityCtor({
        name: cityData.name,
        location: cityData.location,
        population: cityData.population,
      });
      if (hasSavedCoastal) city.isCoastal = !!cityData.isCoastal;
      if (cityData.hasGamblingDen !== undefined) city.hasGamblingDen = cityData.hasGamblingDen;
      if (cityData.hasBank !== undefined) city.hasBank = cityData.hasBank;
      if (cityData.hasBlackMarket !== undefined) city.hasBlackMarket = cityData.hasBlackMarket;
      if (cityData.hasBountyBoard !== undefined) city.hasBountyBoard = cityData.hasBountyBoard;
      if (cityData.hasWeaponShop !== undefined) city.hasWeaponShop = cityData.hasWeaponShop;
      if (cityData.hasWinery !== undefined) city.hasWinery = cityData.hasWinery;
      if (cityData.hasSchool !== undefined) city.hasSchool = cityData.hasSchool;
      city.stockedWeapons = Array.isArray(cityData.stockedWeapons) ? cityData.stockedWeapons : (city.stockedWeapons || []);

      city.inventory.clear();
      if (Array.isArray(cityData.inventory)) {
        for (const [key, qty] of cityData.inventory) {
          if (itemLibrary[key]) {
            city.inventory.set(key, { item: itemLibrary[key], quantity: Math.max(0, Math.floor(Number(qty) || 0)) });
          }
        }
      } else if (cityData.inventory && typeof cityData.inventory === "object") {
        for (const [key, qty] of Object.entries(cityData.inventory)) {
          if (itemLibrary[key]) {
            city.inventory.set(key, { item: itemLibrary[key], quantity: Math.max(0, Math.floor(Number(qty) || 0)) });
          }
        }
      }

      city.holidays = cityData.holidays || [];
      city.bookHolidays = cityData.bookHolidays || [];
      city.stockedBooks = cityData.stockedBooks || [];
      city.priceHistory = cityData.priceHistory || {};
      city.buildingVariant = cityData.buildingVariant || 0;
      city.reputation = typeof cityData.reputation === "number" ? cityData.reputation : 50;
      city.ownership = normalizeCityOwnership(cityData.ownership, cityData.name || city.name);
      city.management = normalizeCityManagement(cityData.management || null);
      restoredCities.push(city);
    }

    return {
      cities: restoredCities,
      hasSavedCoastal,
    };
  }

  function _restorePlayer(data, runtime, deps, restoredCities) {
    const player = runtime.player;
    const itemLibrary = deps.ItemLibrary || {};
    const BoatCtor = deps.Boat;
    const playerData = data.player || {};

    player.x = playerData.x;
    player.y = playerData.y;
    player.gold = playerData.gold;
    player.name = playerData.name || "Captain";
    player.inventory.clear();
    for (const [key, qty] of (playerData.inventory || [])) {
      if (itemLibrary[key]) {
        player.inventory.set(key, { item: itemLibrary[key], quantity: qty });
      }
    }
    player.party = playerData.party || [];
    player.direction = playerData.direction || "down";
    player.hasWon = !!playerData.hasWon;
    player.cargoCapacity = playerData.cargoCapacity || 50;
    player.combatStrength = playerData.combatStrength || 3;
    player.equippedWeapon = playerData.equippedWeapon || null;
    player.equippedBag = playerData.equippedBag || null;
    player.level = playerData.level || 1;
    player.xp = playerData.xp || 0;
    player.statPoints = playerData.statPoints || 0;
    player.bonusMaxHP = playerData.bonusMaxHP || 0;
    player.bonusAttack = playerData.bonusAttack || 0;
    player.bonusDefense = playerData.bonusDefense || 0;
    player.bonusMagic = playerData.bonusMagic || 0;
    player.bonusCharm = playerData.bonusCharm || 0;
    player.bonusSpeed = playerData.bonusSpeed || 0;
    player.speed = 2 + (playerData.bonusSpeed || 0);
    const maxHP = player.getMaxHP ? player.getMaxHP() : (10 + (player.bonusMaxHP || 0));
    player.currentHP = playerData.currentHP != null ? Math.min(playerData.currentHP, maxHP) : maxHP;
    player._lastRegenHour = playerData._lastRegenHour || 0;
    player.weeklyIncome = playerData.weeklyIncome || 0;
    player.weeklySpending = playerData.weeklySpending || 0;
    player._startingGold = playerData._startingGold || 100;
    player._pendingInvestment = playerData._pendingInvestment || null;
    player.isKing = !!playerData.isKing;
    player.ownedCities = playerData.ownedCities || [];

    for (const idx of player.ownedCities) {
      if (restoredCities[idx]) {
        restoredCities[idx]._isManagedCity = true;
        restoredCities[idx].ownership = normalizeCityOwnership(restoredCities[idx].ownership, restoredCities[idx].name);
        restoredCities[idx].ownership.offerAccepted = true;
        restoredCities[idx].ownership.purchased = { bank: true, buildings: true, shop: true };
      }
    }

    player.modifiers = Object.assign({
      negotiationDiscount: 0,
      bribeCostReduction: 0,
      bribeCooldownBonus: 0,
      treasureValueBonus: 0,
      seaLegs: false,
    }, playerData.modifiers || {});
    if (typeof player.recalcModifiers === "function") player.recalcModifiers();

    player.fleet = (playerData.fleet || []).map((boatData) => BoatCtor.fromJSON(boatData));
    const activeBoatIndex = playerData.activeBoatIndex;
    player.activeBoat = (activeBoatIndex >= 0 && activeBoatIndex < player.fleet.length) ? player.fleet[activeBoatIndex] : null;
    player.isSailing = false;

    return player;
  }

  function _restoreSystems(data, runtime, deps) {
    const systems = {};
    systems.traderManager = (data.traders && data.traders.length > 0)
      ? deps.TraderManager.fromJSON(data.traders)
      : runtime.systems.traderManager;

    if (data.raiders) {
      const hasRaiders =
        Array.isArray(data.raiders) ? data.raiders.length > 0
        : Array.isArray(data.raiders.raiders) ? data.raiders.raiders.length > 0
        : false;
      systems.raiderManager = hasRaiders ? deps.RaiderManager.fromJSON(data.raiders) : runtime.systems.raiderManager;
    } else {
      systems.raiderManager = runtime.systems.raiderManager;
    }

    systems.eventSystem = data.events ? deps.EventSystem.fromJSON(data.events) : runtime.systems.eventSystem;
    systems.contractSystem = data.contractSystem ? deps.ContractSystem.fromJSON(data.contractSystem) : new deps.ContractSystem();
    systems.treasureSystem = data.treasureSystem ? deps.TreasureSystem.fromJSON(data.treasureSystem) : new deps.TreasureSystem();
    systems.bankingSystem = data.bankingSystem ? deps.BankingSystem.fromJSON(data.bankingSystem) : new deps.BankingSystem();
    systems.smugglingSystem = data.smugglingSystem ? deps.SmugglingSystem.fromJSON(data.smugglingSystem) : new deps.SmugglingSystem();
    systems.bountyBoard = data.bountyBoard ? deps.BountyBoard.fromJSON(data.bountyBoard) : new deps.BountyBoard();
    systems.gamblingSystem = data.gamblingSystem ? deps.GamblingSystem.fromJSON(data.gamblingSystem) : new deps.GamblingSystem();
    systems.minigameManager = runtime.systems.minigameManager || deps.createMinigameManager();

    return systems;
  }

  async function applyRuntimeSnapshot(ctx) {
    const payload = ctx || {};
    const data = payload.data || {};
    const runtime = payload.runtime || {};
    const deps = runtime.deps || {};
    const dimensions = {
      cols: data.cols || 100,
      rows: data.rows || 100,
    };

    const worldGenConfig = (data.worldGenConfig && typeof data.worldGenConfig === "object") ? data.worldGenConfig : {};
    const difficulty = data.difficulty || "normal";
    const difficultyConfig = (typeof deps.getDifficultyConfig === "function")
      ? deps.getDifficultyConfig(difficulty)
      : null;
    const gameSpeedIndex = (typeof data.gameSpeed === "number" && Array.isArray(deps.SPEED_STEPS))
      ? data.gameSpeed
      : null;

    const terrain = _restoreTerrain(data, dimensions, deps);
    if (terrain.generated) {
      if (typeof deps.noiseSeed === "function") deps.noiseSeed(data.mapSeed);
      await deps.initTerrainWorker();
      const currentTerrain = (typeof runtime.readTerrainState === "function") ? runtime.readTerrainState() : {};
      terrain.grid = currentTerrain.grid || [];
      terrain.elevationMap = currentTerrain.elevationMap || [];
      terrain.difficultyMap = currentTerrain.difficultyMap || [];
      terrain.temperatureMap = currentTerrain.temperatureMap || [];
    }

    const restoredCities = _restoreCities(data, deps);
    _restorePlayer(data, runtime, deps, restoredCities.cities);

    // Trader/Raider restore paths still read the live runtime city array during
    // construction, so publish restored cities before rehydrating those systems.
    if (Array.isArray(runtime.cities)) {
      runtime.cities.length = 0;
      restoredCities.cities.forEach((city) => runtime.cities.push(city));
    }

    runtime.dayNight.timeOfDay = data.dayNight.timeOfDay;
    runtime.dayNight.daysElapsed = data.dayNight.daysElapsed;

    const systems = _restoreSystems(data, runtime, deps);
    const portCityLocations = restoredCities.hasSavedCoastal
      ? ((Array.isArray(data.portCityLocations) && data.portCityLocations.length > 0)
          ? data.portCityLocations
          : restoredCities.cities.filter((city) => city.isCoastal).map((city) => city.location))
      : [];

    return {
      dimensions,
      config: {
        mapSeed: data.mapSeed,
        landmass: typeof data.landmass === "number" ? data.landmass : 1,
        worldGenConfig: {
          warp: _clampNumber(worldGenConfig.warp, 1.0, 0, 2),
          ruggedness: _clampNumber(worldGenConfig.ruggedness, 1.0, 0.5, 2),
          temperatureVariance: _clampNumber(worldGenConfig.temperatureVariance, 1.0, 0, 2),
          moistureVariance: _clampNumber(worldGenConfig.moistureVariance, 1.0, 0, 2),
          coastalDropoff: _clampNumber(worldGenConfig.coastalDropoff, 1.0, 0.4, 2.2),
        },
        difficulty,
        difficultyConfig,
        gameSpeedIndex,
        goldTarget: (typeof data.goldTarget === "number" && data.goldTarget > 0) ? data.goldTarget : 5000,
        dayLimit: (typeof data.dayLimit === "number" && data.dayLimit >= 0) ? data.dayLimit : 0,
        isCustomMap: !!data.isCustomMap,
      },
      terrain,
      cities: restoredCities.cities,
      dayNight: {
        timeOfDay: runtime.dayNight.timeOfDay,
        daysElapsed: runtime.dayNight.daysElapsed,
      },
      systems,
      flags: {
        portCityLocations,
        saveHasCoastalData: !!restoredCities.hasSavedCoastal && data.coastalVersion === 1,
        savedCityManagementData: data.cityManagement || null,
        savedIsCityManageMode: !!data.isCityManageMode,
        savedAdventureCityManage: !!data.adventureCityManage,
        savedPlayerPreCityPos: data.playerPreCityPos || null,
        savedRngState: data.rngState || null,
      },
    };
  }

  // Future migration surface:
  return {
    constants: { SAVE_KEY, SHARE_PREFIX, SAVE_VERSION },
    validateParsedSave,
    normalizeCityManagement,
    normalizeCityOwnership,
    serializeRuntimeSnapshot,
    readParsedSave,
    applyRuntimeSnapshot,
    has,
    remove,
    exportToken,
    importToken,
  };
});
