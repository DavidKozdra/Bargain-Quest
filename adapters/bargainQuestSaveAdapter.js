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

  // Future migration surface:
  // - serializeRuntime(ctx): produce normalized payload from game runtime
  // - deserializeRuntime(ctx, payload): apply payload into runtime
  // - migratePayload(payload): version migrations
  return {
    constants: { SAVE_KEY, SHARE_PREFIX, SAVE_VERSION },
    validateParsedSave,
    normalizeCityManagement,
    normalizeCityOwnership,
    serializeRuntimeSnapshot,
    has,
    remove,
    exportToken,
    importToken,
  };
});
