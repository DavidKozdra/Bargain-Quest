// SaveSystem.js — Single-slot localStorage save/load

function _bqSaveAdapter() {
  if (typeof window === 'undefined') return null;
  return window.BQAdapters?.bargainQuest?.save || null;
}

function _bqMinigameManagerCtor() {
  if (typeof window === 'undefined') return null;
  return window.KozEngine?.minigames?.manager?.MinigameManager
    || window.KozEngine?.minigames?.runtime?.MinigameManager
    || window.MinigameManager
    || null;
}

function _buildRuntimeSnapshotContext() {
  return {
    player,
    dayNight,
    cities: Array.isArray(cities) ? cities : [],
    readTerrainState: () => ({
      grid,
      elevationMap,
      difficultyMap,
      temperatureMap,
    }),
    systems: {
      traderManager: (typeof traderManager !== 'undefined' ? traderManager : null),
      raiderManager: (typeof raiderManager !== 'undefined' ? raiderManager : null),
      eventSystem: (typeof eventSystem !== 'undefined' ? eventSystem : null),
      contractSystem: (typeof contractSystem !== 'undefined' ? contractSystem : null),
      treasureSystem: (typeof treasureSystem !== 'undefined' ? treasureSystem : null),
      bankingSystem: (typeof bankingSystem !== 'undefined' ? bankingSystem : null),
      smugglingSystem: (typeof smugglingSystem !== 'undefined' ? smugglingSystem : null),
      bountyBoard: (typeof bountyBoard !== 'undefined' ? bountyBoard : null),
      gamblingSystem: (typeof gamblingSystem !== 'undefined' ? gamblingSystem : null),
      minigameManager: (typeof minigameManager !== 'undefined' ? minigameManager : null),
    },
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
      ItemLibrary,
      initTerrainWorker,
      noiseSeed,
      getDifficultyConfig: (typeof getDifficultyConfig === 'function') ? getDifficultyConfig : null,
      SPEED_STEPS: (typeof SPEED_STEPS !== 'undefined') ? SPEED_STEPS : null,
      createMinigameManager: () => {
        const Ctor = _bqMinigameManagerCtor();
        return Ctor ? new Ctor() : null;
      },
    },
  };
}

class SaveSystem {
  static hasSave() {
    const adapter = _bqSaveAdapter();
    return !!(adapter && typeof adapter.has === 'function' && adapter.has());
  }

  static deleteSave() {
    const adapter = _bqSaveAdapter();
    if (!adapter || typeof adapter.remove !== 'function') return;
    adapter.remove();
  }

  static exportSaveData() {
    const adapter = _bqSaveAdapter();
    if (!adapter || typeof adapter.exportToken !== 'function') {
      return { ok: false, reason: 'adapter_unavailable' };
    }
    return adapter.exportToken();
  }

  static importSaveData(text) {
    const adapter = _bqSaveAdapter();
    if (!adapter || typeof adapter.importToken !== 'function') {
      return { ok: false, reason: 'adapter_unavailable' };
    }
    return adapter.importToken(text);
  }

  static save(opts = {}) {
    const silent = !!(opts && opts.silent);
    try {
      const adapter = _bqSaveAdapter();
      if (!adapter || typeof adapter.serializeRuntimeSnapshot !== 'function') {
        throw new Error('Save adapter is unavailable');
      }

      const data = adapter.serializeRuntimeSnapshot({
        player,
        cities,
        dayNight,
        cols,
        rows,
        mapSeed: window._mapSeed,
        seededRng: window.BQSeededRNG,
        isCustomMap: !!window._isCustomMap,
        landmass: window._newGameLandmass,
        worldGenConfig: window._newGameWorldGen,
        difficulty: window._newGameDifficulty,
        gameSpeedIndex: (typeof gameSpeedIndex !== 'undefined' ? gameSpeedIndex : 2),
        goldTarget: window._newGameGoldTarget,
        dayLimit: window._newGameDayLimit,
        portCityLocations,
        traderManager: (typeof traderManager !== 'undefined' ? traderManager : null),
        raiderManager: (typeof raiderManager !== 'undefined' ? raiderManager : null),
        eventSystem: (typeof eventSystem !== 'undefined' ? eventSystem : null),
        contractSystem: (typeof contractSystem !== 'undefined' ? contractSystem : null),
        treasureSystem: (typeof treasureSystem !== 'undefined' ? treasureSystem : null),
        bankingSystem: (typeof bankingSystem !== 'undefined' ? bankingSystem : null),
        smugglingSystem: (typeof smugglingSystem !== 'undefined' ? smugglingSystem : null),
        bountyBoard: (typeof bountyBoard !== 'undefined' ? bountyBoard : null),
        gamblingSystem: (typeof gamblingSystem !== 'undefined' ? gamblingSystem : null),
        isCityManageMode: !!window._isCityManageMode,
        adventureCityManage: !!window._adventureCityManage,
        playerPreCityPos: window._playerPreCityPos || null,
        cityManagement: (typeof cityManagement !== 'undefined' ? cityManagement : null),
        grid,
        elevationMap,
        temperatureMap,
        difficultyMap,
      });

      localStorage.setItem(adapter.constants?.SAVE_KEY || 'bargainquest_save', JSON.stringify(data));

      if (!silent && typeof notificationManager !== 'undefined') {
        notificationManager.log('Game saved.', 'success');
      }
      return true;
    } catch (e) {
      console.error('Save failed:', e);
      if (!silent && typeof notificationManager !== 'undefined') {
        notificationManager.log('Save failed!', 'error');
      }
      return false;
    }
  }

  static async load() {
    try {
      const adapter = _bqSaveAdapter();
      if (!adapter || typeof adapter.readParsedSave !== 'function' || typeof adapter.applyRuntimeSnapshot !== 'function') {
        console.warn('Save adapter is unavailable.');
        return false;
      }

      const data = adapter.readParsedSave();
      if (!data) return false;

      cols = data.cols || 100;
      rows = data.rows || 100;
      window._mapSeed = data.mapSeed;
      window._newGameLandmass = typeof data.landmass === 'number' ? data.landmass : 1;
      const worldGenConfig = (data.worldGenConfig && typeof data.worldGenConfig === 'object') ? data.worldGenConfig : {};
      const clamp = (value, fallback, min, max) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
      };
      window._newGameWorldGen = {
        warp: clamp(worldGenConfig.warp, 1.0, 0, 2),
        ruggedness: clamp(worldGenConfig.ruggedness, 1.0, 0.5, 2),
        temperatureVariance: clamp(worldGenConfig.temperatureVariance, 1.0, 0, 2),
        moistureVariance: clamp(worldGenConfig.moistureVariance, 1.0, 0, 2),
        coastalDropoff: clamp(worldGenConfig.coastalDropoff, 1.0, 0.4, 2.2),
      };
      window._newGameDifficulty = data.difficulty || 'normal';
      window.DIFFICULTY_CONFIG = (typeof getDifficultyConfig === 'function')
        ? getDifficultyConfig(window._newGameDifficulty)
        : null;
      window._newGameGoldTarget = (typeof data.goldTarget === 'number' && data.goldTarget > 0) ? data.goldTarget : 5000;
      window._newGameDayLimit = (typeof data.dayLimit === 'number' && data.dayLimit >= 0) ? data.dayLimit : 0;
      window._isCustomMap = !!data.isCustomMap;

      if (typeof data.gameSpeed === 'number' && typeof SPEED_STEPS !== 'undefined') {
        gameSpeedIndex = data.gameSpeed;
        gameSpeed = SPEED_STEPS[gameSpeedIndex] || 1;
      }

      const result = await adapter.applyRuntimeSnapshot({
        data,
        runtime: _buildRuntimeSnapshotContext(),
      });

      grid = result.terrain.grid;
      elevationMap = result.terrain.elevationMap;
      difficultyMap = result.terrain.difficultyMap;
      temperatureMap = result.terrain.temperatureMap;

      cities.length = 0;
      for (const city of result.cities) cities.push(city);

      dayNight.timeOfDay = result.dayNight.timeOfDay;
      dayNight.daysElapsed = result.dayNight.daysElapsed;

      traderManager = result.systems.traderManager;
      raiderManager = result.systems.raiderManager;
      eventSystem = result.systems.eventSystem;
      contractSystem = result.systems.contractSystem;
      treasureSystem = result.systems.treasureSystem;
      bankingSystem = result.systems.bankingSystem;
      smugglingSystem = result.systems.smugglingSystem;
      bountyBoard = result.systems.bountyBoard;
      gamblingSystem = result.systems.gamblingSystem;
      if (result.systems.minigameManager) minigameManager = result.systems.minigameManager;

      portCityLocations = result.flags.portCityLocations;
      window._saveHasCoastalData = result.flags.saveHasCoastalData;
      window._savedCityManagementData = result.flags.savedCityManagementData;
      window._savedIsCityManageMode = result.flags.savedIsCityManageMode;
      window._savedAdventureCityManage = result.flags.savedAdventureCityManage;
      window._savedPlayerPreCityPos = result.flags.savedPlayerPreCityPos;
      window._savedRngState = result.flags.savedRngState;

      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('Game loaded.', 'success');
      }
      return true;
    } catch (e) {
      console.error('Load failed:', e);
      return false;
    }
  }
}
