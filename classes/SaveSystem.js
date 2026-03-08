// SaveSystem.js — Single-slot localStorage save/load

const SAVE_KEY = 'bargainquest_save';
const SAVE_VERSION = 6;
const SAVE_SHARE_PREFIX = 'BQ_SAVE_V1:';

class SaveSystem {
  static _normalizeCityManagement(raw) {
    const m = (raw && typeof raw === 'object') ? raw : {};
    return {
      budget: Math.max(0, Math.floor(Number(m.budget) || 0)),
      taxRate: Math.max(0, Math.min(0.5, Number.isFinite(Number(m.taxRate)) ? Number(m.taxRate) : 0.05)),
      buildingQueue: Array.isArray(m.buildingQueue) ? m.buildingQueue : [],
      upgradeLevels: (m.upgradeLevels && typeof m.upgradeLevels === 'object') ? m.upgradeLevels : {},
      routes: Array.isArray(m.routes) ? m.routes : [],
    };
  }

  static hasSave() {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  static deleteSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  static exportSaveData() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ok: false, reason: 'no_save' };
    try {
      // UTF-8 safe base64 so users can copy/paste a single compact token.
      const encoded = btoa(unescape(encodeURIComponent(raw)));
      return { ok: true, data: `${SAVE_SHARE_PREFIX}${encoded}` };
    } catch (e) {
      console.error('Export failed:', e);
      return { ok: false, reason: 'export_failed' };
    }
  }

  static importSaveData(text) {
    try {
      const input = String(text || '').trim();
      if (!input) return { ok: false, reason: 'empty' };

      let raw = input;
      if (input.startsWith(SAVE_SHARE_PREFIX)) {
        const encoded = input.slice(SAVE_SHARE_PREFIX.length).trim();
        if (!encoded) return { ok: false, reason: 'empty' };
        raw = decodeURIComponent(escape(atob(encoded)));
      }

      const parsed = JSON.parse(raw);
      const okVersion = parsed && (parsed.version === SAVE_VERSION || parsed.version === 5 || parsed.version === 4 || parsed.version === 3);
      if (!okVersion) return { ok: false, reason: 'bad_version' };
      if (!parsed.player || !Array.isArray(parsed.cities)) return { ok: false, reason: 'invalid_payload' };

      localStorage.setItem(SAVE_KEY, raw);
      return { ok: true };
    } catch (e) {
      console.error('Import failed:', e);
      return { ok: false, reason: 'parse_error' };
    }
  }

  static save(opts = {}) {
    const silent = !!(opts && opts.silent);
    try {
      const data = {
        version: SAVE_VERSION,
        timestamp: Date.now(),
        mapSeed: window._mapSeed || 0,
        cols: cols,
        rows: rows,
        isCustomMap: !!window._isCustomMap,
        landmass: typeof window._newGameLandmass === 'number' ? window._newGameLandmass : 1,
        worldGenConfig: (window._newGameWorldGen && typeof window._newGameWorldGen === 'object')
          ? {
              warp: Number(window._newGameWorldGen.warp),
              ruggedness: Number(window._newGameWorldGen.ruggedness),
              temperatureVariance: Number(window._newGameWorldGen.temperatureVariance),
              moistureVariance: Number(window._newGameWorldGen.moistureVariance),
              coastalDropoff: Number(window._newGameWorldGen.coastalDropoff),
            }
          : null,
        difficulty: window._newGameDifficulty || 'normal',
        gameSpeed: typeof gameSpeedIndex !== 'undefined' ? gameSpeedIndex : 2,
        goldTarget: typeof window._newGameGoldTarget === 'number' ? window._newGameGoldTarget : 5000,
        dayLimit: typeof window._newGameDayLimit === 'number' ? window._newGameDayLimit : 0,
        coastalVersion: 1,
        portCityLocations: Array.isArray(portCityLocations) ? portCityLocations : [],

        player: {
          x: player.x,
          y: player.y,
          gold: player.gold,
          name: player.name || 'Captain',
          inventory: [...player.inventory].map(([k, v]) => [k, v.quantity]),
          party: player.party,
          direction: player.direction || 'down',
          hasWon: player.hasWon,
          cargoCapacity: player.cargoCapacity || 50,
          combatStrength: player.combatStrength || 3,
          equippedWeapon: player.equippedWeapon || null,
          equippedBag: player.equippedBag || null,
          fleet: player.fleet.map(b => b.toJSON()),
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
        },

        dayNight: {
          timeOfDay: dayNight.timeOfDay,
          daysElapsed: dayNight.daysElapsed,
        },

        cities: cities.map(c => ({
          name: c.name,
          location: c.location,
          population: c.population,
          isCoastal: !!c.isCoastal,
          inventory: [...c.inventory].map(([k, v]) => [k, v.quantity]),
          holidays: c.holidays,
          bookHolidays: c.bookHolidays || [],
          stockedBooks: c.stockedBooks || [],
          priceHistory: c.priceHistory || {},
          buildingVariant: c.buildingVariant || 0,
          reputation: typeof c.reputation === 'number' ? c.reputation : 50,
          // v5 city features
          hasGamblingDen: c.hasGamblingDen || false,
          hasBank: c.hasBank || false,
          hasBlackMarket: c.hasBlackMarket || false,
          hasBountyBoard: c.hasBountyBoard || false,
          hasWeaponShop: c.hasWeaponShop || false,
          hasWinery: c.hasWinery || false,
          hasSchool: c.hasSchool || false,
          stockedWeapons: c.stockedWeapons || [],
          // city-management state (v6)
          management: SaveSystem._normalizeCityManagement(
            (c.management && typeof c.management.toJSON === 'function') ? c.management.toJSON() : (c.management || null)
          ),
        })),

        traders: typeof traderManager !== 'undefined' ? traderManager.toJSON() : [],
        raiders: typeof raiderManager !== 'undefined' ? raiderManager.toJSON() : [],
        events: typeof eventSystem !== 'undefined' ? eventSystem.toJSON() : {},

        // v5 new systems
        contractSystem: typeof contractSystem !== 'undefined' && contractSystem ? contractSystem.toJSON() : null,
        treasureSystem: typeof treasureSystem !== 'undefined' && treasureSystem ? treasureSystem.toJSON() : null,
        bankingSystem: typeof bankingSystem !== 'undefined' && bankingSystem ? bankingSystem.toJSON() : null,
        smugglingSystem: typeof smugglingSystem !== 'undefined' && smugglingSystem ? smugglingSystem.toJSON() : null,
        bountyBoard: typeof bountyBoard !== 'undefined' && bountyBoard ? bountyBoard.toJSON() : null,
        gamblingSystem: typeof gamblingSystem !== 'undefined' && gamblingSystem ? gamblingSystem.toJSON() : null,

        // City Management mode state
        isCityManageMode: !!window._isCityManageMode,
        adventureCityManage: !!window._adventureCityManage,
        playerPreCityPos: window._playerPreCityPos || null,
        cityManagement: (typeof cityManagement !== 'undefined' && cityManagement && typeof cityManagement.toJSON === 'function') ? cityManagement.toJSON() : null,
      };

      // For custom maps, persist the full terrain grid since it can't be regenerated from seed
      if (data.isCustomMap && typeof grid !== 'undefined' && grid.length > 0) {
        const _biomeIndex = { Water: 0, Sand: 1, Grass: 2, Forest: 3, Snow: 4, Rock: 5 };
        const _decorIndex = { bush: 1, tree: 2, rock: 3, pebbles: 4, snowdrift: 5, lily: 6, seaweed: 7 };
        const totalCells = data.rows * data.cols;
        const biomeArr = new Array(totalCells);
        const decorArr = new Array(totalCells);
        const elevArr  = new Array(totalCells);
        const tempArr  = new Array(totalCells);
        const diffArr  = new Array(totalCells);
        for (let i = 0; i < data.rows; i++) {
          for (let j = 0; j < data.cols; j++) {
            const idx = i * data.cols + j;
            const cell = grid[i] && grid[i][j];
            const biome = cell && cell.options ? cell.options[0] : 'Grass';
            biomeArr[idx] = _biomeIndex[biome] !== undefined ? _biomeIndex[biome] : 2;
            decorArr[idx] = cell && cell.decor && _decorIndex[cell.decor] ? _decorIndex[cell.decor] : 0;
            elevArr[idx]  = elevationMap[i]   ? +(elevationMap[i][j] || 0).toFixed(3)   : 0;
            tempArr[idx]  = temperatureMap[i]  ? +(temperatureMap[i][j] || 0).toFixed(3) : 0;
            diffArr[idx]  = difficultyMap[i]   ? +(difficultyMap[i][j] || 0).toFixed(2)  : 1;
          }
        }
        data.customTerrain = { biomes: biomeArr, decor: decorArr, elevation: elevArr, temperature: tempArr, difficulty: diffArr };
      }

      const json = JSON.stringify(data);
      localStorage.setItem(SAVE_KEY, json);

      if (!silent && typeof notificationManager !== 'undefined') {
        notificationManager.log("Game saved.", "success");
      }
      return true;
    } catch (e) {
      console.error("Save failed:", e);
      if (!silent && typeof notificationManager !== 'undefined') {
        notificationManager.log("Save failed!", "error");
      }
      return false;
    }
  }

  static async load() {
    try {
      const json = localStorage.getItem(SAVE_KEY);
      if (!json) return false;

      const data = JSON.parse(json);
      if (!data || (data.version !== SAVE_VERSION && data.version !== 5 && data.version !== 4 && data.version !== 3)) {
        console.warn("Save version mismatch or corrupt save.");
        return false;
      }

      // Restore map dimensions and seed
      cols = data.cols || 100;
      rows = data.rows || 100;
      window._mapSeed = data.mapSeed;

      // Restore landmass mode BEFORE terrain gen (critical for correct terrain)
      window._newGameLandmass = typeof data.landmass === 'number' ? data.landmass : 1;
      const g = (data.worldGenConfig && typeof data.worldGenConfig === 'object') ? data.worldGenConfig : {};
      const clamp = (v, d, min, max) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return d;
        return Math.max(min, Math.min(max, n));
      };
      window._newGameWorldGen = {
        warp: clamp(g.warp, 1.0, 0, 2),
        ruggedness: clamp(g.ruggedness, 1.0, 0.5, 2),
        temperatureVariance: clamp(g.temperatureVariance, 1.0, 0, 2),
        moistureVariance: clamp(g.moistureVariance, 1.0, 0, 2),
        coastalDropoff: clamp(g.coastalDropoff, 1.0, 0.4, 2.2),
      };

      // Restore difficulty
      window._newGameDifficulty = data.difficulty || 'normal';
      window.DIFFICULTY_CONFIG = (typeof getDifficultyConfig === 'function')
        ? getDifficultyConfig(window._newGameDifficulty)
        : null;

      // Restore game speed
      if (typeof data.gameSpeed === 'number' && typeof SPEED_STEPS !== 'undefined') {
        gameSpeedIndex = data.gameSpeed;
        gameSpeed = SPEED_STEPS[gameSpeedIndex] || 1;
      }

      // Restore win-condition config (fallback keeps legacy saves compatible)
      window._newGameGoldTarget = (typeof data.goldTarget === 'number' && data.goldTarget > 0)
        ? data.goldTarget
        : (typeof window._newGameGoldTarget === 'number' ? window._newGameGoldTarget : 5000);
      window._newGameDayLimit = (typeof data.dayLimit === 'number' && data.dayLimit >= 0)
        ? data.dayLimit
        : (typeof window._newGameDayLimit === 'number' ? window._newGameDayLimit : 0);

      // Reset terrain arrays
      grid = [];
      elevationMap = [];
      difficultyMap = [];
      temperatureMap = [];

      window._isCustomMap = !!data.isCustomMap;

      if (data.isCustomMap && data.customTerrain) {
        // Restore custom map terrain directly — cannot regenerate from seed
        const _biomeNames = ['Water', 'Sand', 'Grass', 'Forest', 'Snow', 'Rock'];
        const _decorNames = [null, 'bush', 'tree', 'rock', 'pebbles', 'snowdrift', 'lily', 'seaweed'];
        const ct = data.customTerrain;
        for (let i = 0; i < rows; i++) {
          grid[i] = new Array(cols);
          elevationMap[i] = new Array(cols);
          temperatureMap[i] = new Array(cols);
          difficultyMap[i] = new Array(cols);
          for (let j = 0; j < cols; j++) {
            const idx = i * cols + j;
            const biome = _biomeNames[ct.biomes[idx]] || 'Grass';
            grid[i][j] = { options: [biome], collapsed: true };
            const decor = _decorNames[ct.decor[idx]];
            if (decor) grid[i][j].decor = decor;
            elevationMap[i][j]   = ct.elevation[idx]    || 0;
            temperatureMap[i][j] = ct.temperature[idx]   || 0;
            difficultyMap[i][j]  = ct.difficulty[idx]    || 1;
          }
        }
      } else {
        noiseSeed(data.mapSeed); // also seeds p5 noise for the fallback path in initTerrainWorker
        await initTerrainWorker();
      }

      // Restore cities
      cities.length = 0;
      const hasSavedCoastal = Array.isArray(data.cities)
        && data.cities.every(cd => Object.prototype.hasOwnProperty.call(cd, 'isCoastal'));
      for (const cd of data.cities) {
        const city = new City({
          name: cd.name,
          location: cd.location,
          population: cd.population,
        });
        if (hasSavedCoastal) city.isCoastal = !!cd.isCoastal;
        // Restore city features (v5)
        if (cd.hasGamblingDen !== undefined) city.hasGamblingDen = cd.hasGamblingDen;
        if (cd.hasBank !== undefined) city.hasBank = cd.hasBank;
        if (cd.hasBlackMarket !== undefined) city.hasBlackMarket = cd.hasBlackMarket;
        if (cd.hasBountyBoard !== undefined) city.hasBountyBoard = cd.hasBountyBoard;
        if (cd.hasWeaponShop !== undefined) city.hasWeaponShop = cd.hasWeaponShop;
        if (cd.hasWinery !== undefined) city.hasWinery = cd.hasWinery;
        if (cd.hasSchool !== undefined) city.hasSchool = cd.hasSchool;
        city.stockedWeapons = Array.isArray(cd.stockedWeapons) ? cd.stockedWeapons : (city.stockedWeapons || []);
        // Restore inventory
        city.inventory.clear();
        if (Array.isArray(cd.inventory)) {
          for (const [key, qty] of cd.inventory) {
            if (ItemLibrary[key]) {
              city.inventory.set(key, { item: ItemLibrary[key], quantity: Math.max(0, Math.floor(Number(qty) || 0)) });
            }
          }
        } else if (cd.inventory && typeof cd.inventory === 'object') {
          for (const [key, qty] of Object.entries(cd.inventory)) {
            if (ItemLibrary[key]) {
              city.inventory.set(key, { item: ItemLibrary[key], quantity: Math.max(0, Math.floor(Number(qty) || 0)) });
            }
          }
        }
        city.holidays = cd.holidays || [];
        city.bookHolidays = cd.bookHolidays || [];
        city.stockedBooks = cd.stockedBooks || [];
        city.priceHistory = cd.priceHistory || {};
        city.buildingVariant = cd.buildingVariant || 0;
        city.reputation = typeof cd.reputation === 'number' ? cd.reputation : 50;
        // Restore simple city-management payload (v6)
        if (cd.management) {
          city.management = SaveSystem._normalizeCityManagement(cd.management);
        } else {
          city.management = SaveSystem._normalizeCityManagement(null);
        }
        cities.push(city);
      }

      // Restore player
      player.x = data.player.x;
      player.y = data.player.y;
      player.gold = data.player.gold;
      player.name = data.player.name || 'Captain';
      player.inventory.clear();
      for (const [key, qty] of data.player.inventory) {
        if (ItemLibrary[key]) {
          player.inventory.set(key, { item: ItemLibrary[key], quantity: qty });
        }
      }
      player.party = data.player.party || [];
      player.direction = data.player.direction || 'down';
      player.hasWon = data.player.hasWon || false;
      player.cargoCapacity = data.player.cargoCapacity || 50;
      player.combatStrength = data.player.combatStrength || 3;
      player.equippedWeapon = data.player.equippedWeapon || null;
      player.equippedBag = data.player.equippedBag || null;

      // Restore leveling stats
      player.level = data.player.level || 1;
      player.xp = data.player.xp || 0;
      player.statPoints = data.player.statPoints || 0;
      player.bonusMaxHP = data.player.bonusMaxHP || 0;
      player.bonusAttack = data.player.bonusAttack || 0;
      player.bonusDefense = data.player.bonusDefense || 0;
      player.bonusMagic = data.player.bonusMagic || 0;
      player.bonusCharm = data.player.bonusCharm || 0;
      player.bonusSpeed = data.player.bonusSpeed || 0;
      player.speed = 2 + (data.player.bonusSpeed || 0);
      // Restore persistent HP (default to full if missing)
      const maxHP = player.getMaxHP ? player.getMaxHP() : (10 + (player.bonusMaxHP || 0));
      player.currentHP = data.player.currentHP != null ? Math.min(data.player.currentHP, maxHP) : maxHP;

      // Restore regen tracking & weekly stats
      player._lastRegenHour = data.player._lastRegenHour || 0;
      player.weeklyIncome = data.player.weeklyIncome || 0;
      player.weeklySpending = data.player.weeklySpending || 0;
      player._startingGold = data.player._startingGold || 100;
      player._pendingInvestment = data.player._pendingInvestment || null;

      // Restore owned cities
      player.ownedCities = data.player.ownedCities || [];
      // Re-mark owned cities as managed
      for (const idx of player.ownedCities) {
        if (cities[idx]) cities[idx]._isManagedCity = true;
      }

      // Restore modifiers (or recalculate from inventory)
      if (data.player.modifiers) {
        player.modifiers = Object.assign({
          negotiationDiscount: 0,
          bribeCostReduction: 0,
          bribeCooldownBonus: 0,
          treasureValueBonus: 0,
          seaLegs: false,
        }, data.player.modifiers);
      }
      player.recalcModifiers(); // always recalc to be safe

      // Restore boat fleet
      player.fleet = (data.player.fleet || []).map(bd => Boat.fromJSON(bd));
      const abi = data.player.activeBoatIndex;
      player.activeBoat = (abi >= 0 && abi < player.fleet.length) ? player.fleet[abi] : null;
      player.isSailing = false;

      // Restore day/night
      dayNight.timeOfDay = data.dayNight.timeOfDay;
      dayNight.daysElapsed = data.dayNight.daysElapsed;

      // Restore traders
      if (data.traders && data.traders.length > 0) {
        traderManager = TraderManager.fromJSON(data.traders);
      }

      // Restore raiders (supports legacy array and current object payload)
      if (data.raiders) {
        const hasRaiders =
          Array.isArray(data.raiders) ? data.raiders.length > 0
          : Array.isArray(data.raiders.raiders) ? data.raiders.raiders.length > 0
          : false;
        if (hasRaiders) {
          raiderManager = RaiderManager.fromJSON(data.raiders);
        }
      }

      // Restore events
      if (data.events) {
        eventSystem = EventSystem.fromJSON(data.events);
      }

      // Restore v5 new systems
      if (data.contractSystem && typeof ContractSystem !== 'undefined') {
        contractSystem = ContractSystem.fromJSON(data.contractSystem);
      } else if (typeof ContractSystem !== 'undefined') {
        contractSystem = new ContractSystem();
      }
      if (data.treasureSystem && typeof TreasureSystem !== 'undefined') {
        treasureSystem = TreasureSystem.fromJSON(data.treasureSystem);
      } else if (typeof TreasureSystem !== 'undefined') {
        treasureSystem = new TreasureSystem();
      }
      if (data.bankingSystem && typeof BankingSystem !== 'undefined') {
        bankingSystem = BankingSystem.fromJSON(data.bankingSystem);
      } else if (typeof BankingSystem !== 'undefined') {
        bankingSystem = new BankingSystem();
      }
      if (data.smugglingSystem && typeof SmugglingSystem !== 'undefined') {
        smugglingSystem = SmugglingSystem.fromJSON(data.smugglingSystem);
      } else if (typeof SmugglingSystem !== 'undefined') {
        smugglingSystem = new SmugglingSystem();
      }
      if (data.bountyBoard && typeof BountyBoard !== 'undefined') {
        bountyBoard = BountyBoard.fromJSON(data.bountyBoard);
      } else if (typeof BountyBoard !== 'undefined') {
        bountyBoard = new BountyBoard();
      }
      if (typeof MinigameManager !== 'undefined' && !minigameManager) {
        minigameManager = new MinigameManager();
      }
      if (data.gamblingSystem && typeof GamblingSystem !== 'undefined') {
        gamblingSystem = GamblingSystem.fromJSON(data.gamblingSystem);
      } else if (typeof GamblingSystem !== 'undefined') {
        gamblingSystem = new GamblingSystem();
      }

      // Persist saved city-management payload for later restore.
      // Do NOT flip the active global `window._isCityManageMode` here —
      // restoration should be performed by the centralized loader so
      // we avoid accidental mode toggles during load.
      window._saveHasCoastalData = !!hasSavedCoastal && data.coastalVersion === 1;
      if (window._saveHasCoastalData) {
        if (Array.isArray(data.portCityLocations) && data.portCityLocations.length > 0) {
          portCityLocations = data.portCityLocations;
        } else {
          portCityLocations = cities.filter(c => c.isCoastal).map(c => c.location);
        }
      } else {
        portCityLocations = [];
      }
      window._savedCityManagementData = data.cityManagement || null;
      window._savedIsCityManageMode = !!data.isCityManageMode;
      window._savedAdventureCityManage = !!data.adventureCityManage;
      window._savedPlayerPreCityPos = data.playerPreCityPos || null;

      if (typeof notificationManager !== 'undefined') {
        notificationManager.log("Game loaded.", "success");
      }
      return true;
    } catch (e) {
      console.error("Load failed:", e);
      return false;
    }
  }
}
