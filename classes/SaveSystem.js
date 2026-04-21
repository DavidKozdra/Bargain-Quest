// SaveSystem.js — Single-slot localStorage save/load

function _bqSaveAdapter() {
  if (typeof window === 'undefined') return null;
  return window.BQAdapters?.bargainQuest?.save || null;
}

function _bqMinigameManagerCtor() {
  if (typeof window === 'undefined') return null;
  return window.KozEngine?.Minigames?.runtime?.MinigameManager
    || window.MinigameManager
    || window.KozEngine?.Minigames?.manager?.MinigameManager
    || null;
}

function _isRuntimeMinigameManager(manager) {
  return !!manager
    && typeof manager.launch === 'function'
    && Object.prototype.hasOwnProperty.call(manager, 'active');
}

function _createCompatibleMinigameManager() {
  const Ctor = _bqMinigameManagerCtor();
  if (!Ctor) return null;
  const manager = new Ctor();
  return _isRuntimeMinigameManager(manager) ? manager : null;
}

function _getCompatibleMinigameManager(existing) {
  if (_isRuntimeMinigameManager(existing)) return existing;
  return _createCompatibleMinigameManager();
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
        return _createCompatibleMinigameManager();
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

  static async save(opts = {}) {
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
        worldSessions: (typeof window !== 'undefined' && typeof window.BQExportWorldSessions === 'function')
          ? window.BQExportWorldSessions()
          : [],
        activeWorldSessionKey: (typeof window !== 'undefined' && typeof window._bqActiveWorldSessionKey === 'string')
          ? window._bqActiveWorldSessionKey
          : null,
        bearEmpireSystem: (typeof bearEmpireSystem !== 'undefined' ? bearEmpireSystem : null),
      });

      const saveKey = adapter.constants?.SAVE_KEY || 'bargainquest_save';
      const serialized = JSON.stringify(data);
      const byteSize = new Blob([serialized]).size;

      // Warn if approaching the ~5 MB localStorage limit
      const LS_WARN_THRESHOLD = 4 * 1024 * 1024; // 4 MB
      if (!silent && byteSize > LS_WARN_THRESHOLD && typeof notificationManager !== 'undefined') {
        notificationManager.log(`Save is large (${(byteSize / 1024 / 1024).toFixed(1)} MB) — consider a smaller map size.`, 'warning');
      }

      let savedToIdb = false;
      try {
        localStorage.setItem(saveKey, serialized);
      } catch (quotaErr) {
        // localStorage quota exceeded — try IndexedDB as a fallback
        if (quotaErr.name === 'QuotaExceededError' || quotaErr.code === 22) {
          console.warn('[BQ] localStorage quota exceeded, falling back to IndexedDB');
          savedToIdb = await SaveSystem._saveToIdb(saveKey, serialized);
          if (!savedToIdb) throw quotaErr;
        } else {
          throw quotaErr;
        }
      }

      if (!silent && typeof notificationManager !== 'undefined') {
        const loc = savedToIdb ? ' (IDB)' : '';
        notificationManager.log(`Game saved${loc}.`, 'success');
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

  /** Write serialized save string to IndexedDB. Returns true on success. */
  static _saveToIdb(key, serialized) {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('bargainquest_saves', 1);
        req.onupgradeneeded = (e) => {
          e.target.result.createObjectStore('saves');
        };
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction('saves', 'readwrite');
          tx.objectStore('saves').put(serialized, key);
          tx.oncomplete = () => { db.close(); resolve(true); };
          tx.onerror = () => { db.close(); resolve(false); };
        };
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  /** Read serialized save string from IndexedDB. Returns string or null. */
  static _loadFromIdb(key) {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('bargainquest_saves', 1);
        req.onupgradeneeded = (e) => {
          e.target.result.createObjectStore('saves');
        };
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction('saves', 'readonly');
          const getReq = tx.objectStore('saves').get(key);
          getReq.onsuccess = () => { db.close(); resolve(getReq.result || null); };
          getReq.onerror = () => { db.close(); resolve(null); };
        };
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  static async load() {
    try {
      const adapter = _bqSaveAdapter();
      if (!adapter || typeof adapter.readParsedSave !== 'function' || typeof adapter.applyRuntimeSnapshot !== 'function') {
        console.warn('Save adapter is unavailable.');
        return false;
      }

      // Try localStorage first; fall back to IDB for saves that exceeded the quota
      let data = adapter.readParsedSave();
      if (!data) {
        const saveKey = adapter.constants?.SAVE_KEY || 'bargainquest_save';
        const idbRaw = await SaveSystem._loadFromIdb(saveKey);
        if (idbRaw) {
          try { data = JSON.parse(idbRaw); } catch (_) { data = null; }
        }
      }
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
      minigameManager = _getCompatibleMinigameManager(result.systems.minigameManager);

      portCityLocations = result.flags.portCityLocations;
      window._saveHasCoastalData = result.flags.saveHasCoastalData;
      window._savedCityManagementData = result.flags.savedCityManagementData;
      window._savedIsCityManageMode = result.flags.savedIsCityManageMode;
      window._savedAdventureCityManage = result.flags.savedAdventureCityManage;
      window._savedPlayerPreCityPos = result.flags.savedPlayerPreCityPos;
      window._savedRngState = result.flags.savedRngState;
      window._savedWorldSessions = result.flags.savedWorldSessions;
      window._savedActiveWorldSessionKey = result.flags.savedActiveWorldSessionKey;
      window._savedBearEmpireData = result.flags.savedBearEmpireData;

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
