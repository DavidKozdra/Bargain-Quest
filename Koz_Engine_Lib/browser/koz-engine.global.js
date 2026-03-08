(function initKozEngineGlobalBridge(root) {
  if (!root) return;

  const engineNamespace = root.KozEngine = root.KozEngine || {};
  const compatNamespace = root.BQLib = root.BQLib || {};
  const moduleCache = new Map();

  function ensurePath(target, path) {
    let cursor = target;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      cursor[key] = cursor[key] || {};
      cursor = cursor[key];
    }
    return { parent: cursor, key: path[path.length - 1] };
  }

  function registerNamespace(path, api) {
    const engineTarget = ensurePath(engineNamespace, path);
    engineTarget.parent[engineTarget.key] = api;

    const compatTarget = ensurePath(compatNamespace, path);
    compatTarget.parent[compatTarget.key] = api;
  }

  function publishGlobal(name, value) {
    if (typeof name !== "string" || !name) return;
    if (root[name] === undefined) {
      root[name] = value;
    }
  }

  function loadCommonJsModule(path) {
    if (moduleCache.has(path)) return moduleCache.get(path);

    const request = new XMLHttpRequest();
    request.open("GET", path, false);
    request.send(null);

    if (!((request.status >= 200 && request.status < 300) || request.status === 0)) {
      throw new Error(`Failed to load engine module: ${path} (${request.status})`);
    }

    const module = { exports: {} };
    const exports = module.exports;
    const evaluate = new Function(
      "module",
      "exports",
      "require",
      `${request.responseText}\n//# sourceURL=${path}`
    );

    evaluate(module, exports, function unsupportedRequire(id) {
      throw new Error(`CommonJS require is not supported in browser bridge: ${id}`);
    });

    moduleCache.set(path, module.exports);
    return module.exports;
  }

  const moduleDefs = [
    {
      path: "Koz_Engine_Lib/ai/astar.js",
      register: ["ai", "astar"],
      globals: {
        aStar: (api) => api.aStar,
        MinHeap: (api) => api.MinHeap,
      },
    },
    {
      path: "Koz_Engine_Lib/assets/atlasHelper.js",
      register: ["assets", "atlasHelper"],
      globals: {
        AtlasManager: (api) => api.AtlasManager,
      },
    },
    {
      path: "Koz_Engine_Lib/utils/seededRng.js",
      register: ["utils", "seededRng"],
      globals: {
        BQSeededRNG: (api) => api.SeededRNG,
        BQRandom: (api) => function BQRandom(streamName) {
          return api.namedRandom(api.SeededRNG, streamName || "default");
        },
      },
    },
    {
      path: "Koz_Engine_Lib/core/countdownTimer.js",
      register: ["core", "countdownTimer"],
    },
    {
      path: "Koz_Engine_Lib/core/gameStateManager.js",
      register: ["core", "gameStateManager"],
      globals: {
        GameStateManager: (api) => api.GameStateManager,
      },
    },
    {
      path: "Koz_Engine_Lib/core/spatialGrid.js",
      register: ["core", "spatialGrid"],
      globals: {
        SpatialGrid: (api) => api.SpatialGrid,
      },
    },
    {
      path: "Koz_Engine_Lib/core/uiScreenController.js",
      register: ["core", "uiScreenController"],
    },
    {
      path: "Koz_Engine_Lib/io/schemaRegistry.js",
      register: ["io", "schemaRegistry"],
    },
    {
      path: "Koz_Engine_Lib/io/storageDrivers.js",
      register: ["io", "storageDrivers"],
    },
    {
      path: "Koz_Engine_Lib/api/saveApi.js",
      register: ["api", "saveApi"],
    },
    {
      path: "Koz_Engine_Lib/time/dayNightCore.js",
      register: ["time", "dayNightCore"],
    },
    {
      path: "Koz_Engine_Lib/time/dayNightCycle.js",
      register: ["time", "dayNightCycle"],
      globals: {
        DayNightCycle: (api) => api.DayNightCycle,
      },
    },
    {
      path: "Koz_Engine_Lib/events/eventEngine.js",
      register: ["events", "eventEngine"],
    },
    {
      path: "Koz_Engine_Lib/events/eventSystem.js",
      register: ["events", "eventSystem"],
      globals: {
        EventSystem: (api) => api.EventSystem,
      },
    },
    {
      path: "Koz_Engine_Lib/progression/tipTracker.js",
      register: ["progression", "tipTracker"],
    },
    {
      path: "Koz_Engine_Lib/input/mobileInput.js",
      register: ["input", "mobileInput"],
    },
    {
      path: "Koz_Engine_Lib/progression/stagedAcquisition.js",
      register: ["progression", "stagedAcquisition"],
    },
    {
      path: "Koz_Engine_Lib/items/itemFactory.js",
      register: ["items", "itemFactory"],
    },
    {
      path: "Koz_Engine_Lib/minigames/manager.js",
      register: ["minigames", "manager"],
    },
    {
      path: "Koz_Engine_Lib/minigames/minigamesRuntime.js",
      register: ["minigames", "runtime"],
      globals: {
        MinigameManager: (api) => api.MinigameManager,
        MinigameBase: (api) => api.MinigameBase,
        HagglingMinigame: (api) => api.HagglingMinigame,
        LockPickingMinigame: (api) => api.LockPickingMinigame,
        DicePokerMinigame: (api) => api.DicePokerMinigame,
        MemoryMatchMinigame: (api) => api.MemoryMatchMinigame,
        WheelOfFortuneMinigame: (api) => api.WheelOfFortuneMinigame,
        BluffMeterMinigame: (api) => api.BluffMeterMinigame,
        NavigationDodgeMinigame: (api) => api.NavigationDodgeMinigame,
        ShipRaceMinigame: (api) => api.ShipRaceMinigame,
        FishingMinigame: (api) => api.FishingMinigame,
        MiningMinigame: (api) => api.MiningMinigame,
        HarvestMinigame: (api) => api.HarvestMinigame,
        WoodcuttingMinigame: (api) => api.WoodcuttingMinigame,
        SandDigMinigame: (api) => api.SandDigMinigame,
      },
      afterLoad: function afterMinigames(api) {
        if (root.minigameManager === undefined) {
          root.minigameManager = null;
        }
        if (!compatNamespace.minigames?.manager?.MinigameManager) {
          compatNamespace.minigames = compatNamespace.minigames || {};
          compatNamespace.minigames.manager = {
            MinigameManager: api.MinigameManager,
          };
        }
      },
    },
    {
      path: "Koz_Engine_Lib/fx/particleSystemCore.js",
      register: ["fx", "particleSystemCore"],
    },
    {
      path: "Koz_Engine_Lib/fx/particleSystem.js",
      register: ["fx", "particleSystem"],
      globals: {
        ParticleSystem: (api) => api.ParticleSystem,
      },
      afterLoad: function afterParticleSystem(api) {
        if (root.particleSystem === undefined) {
          root.particleSystem = api.createParticleSystem();
        }
        registerNamespace(["fx", "particleSystem"], {
          ParticleSystem: api.ParticleSystem,
          particleSystem: root.particleSystem,
        });
      },
    },
    {
      path: "Koz_Engine_Lib/ui/modalPrimitives.js",
      register: ["ui", "modalPrimitives"],
    },
    {
      path: "Koz_Engine_Lib/ui/notificationCenter.js",
      register: ["ui", "notificationCenter"],
    },
    {
      path: "Koz_Engine_Lib/ui/notificationManager.js",
      register: ["ui", "notificationManager"],
      globals: {
        NotificationManager: (api) => api.NotificationManager,
      },
    },
    {
      path: "Koz_Engine_Lib/ui/uiManager.js",
      register: ["ui", "uiManager"],
      globals: {
        UIManager: (api) => api.UIManager,
      },
    },
    {
      path: "Koz_Engine_Lib/audio/musicSystem.js",
      register: ["audio", "musicSystem"],
      globals: {
        MusicSystem: (api) => api.MusicSystem,
      },
    },
    {
      path: "Koz_Engine_Lib/audio/soundRegistry.js",
      register: ["audio", "soundRegistry"],
    },
  ];

  for (const def of moduleDefs) {
    const api = loadCommonJsModule(def.path);
    registerNamespace(def.register, api);

    if (def.globals) {
      for (const [name, factory] of Object.entries(def.globals)) {
        publishGlobal(name, factory(api));
      }
    }

    if (typeof def.afterLoad === "function") {
      def.afterLoad(api);
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
