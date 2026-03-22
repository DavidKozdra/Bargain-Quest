(function initKozEngineGlobalBridge(root) {
  /**
   * Browser/global bridge for loading Koz Engine modules.
   * Provides CommonJS-like require semantics in the browser and publishes
   * selected APIs to the global namespace.
   * @param {Object} root - The global object (window or globalThis)
   */
  if (!root) return;
  if (!root.document) return;

  const engineNamespace = root.KozEngine = root.KozEngine || {};
  const moduleCache = new Map();
  const loadedDefs = new Set();
  const moduleLoadPromises = new Map();
  const defLoadPromises = new Map();
  const preloadModulePaths = new Set();

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
  }

  function publishGlobal(name, value) {
    if (typeof name !== "string" || !name) return;
    if (root[name] === undefined) {
      root[name] = value;
    }
  }

  function loadCommonJsModuleLegacy(path) {
    const normalizedPath = normalizePath(withJsExtension(path));
    if (moduleCache.has(normalizedPath)) return moduleCache.get(normalizedPath);

    if (typeof XMLHttpRequest !== "function") {
      throw new Error(`Engine module is unavailable and XHR fallback is unsupported: ${normalizedPath}`);
    }

    const request = new XMLHttpRequest();
    request.open("GET", normalizedPath, false);
    try {
      request.send(null);
    } catch (err) {
      const detail = err && err.message ? err.message : "network error";
      throw new Error(`Failed to load engine module: ${normalizedPath} (${detail})`);
    }

    if (!((request.status >= 200 && request.status < 300) || request.status === 0)) {
      throw new Error(`Failed to load engine module: ${normalizedPath} (${request.status})`);
    }

    const module = { exports: {} };
    const exports = module.exports;
    const evaluate = new Function(
      "module",
      "exports",
      "require",
      `${request.responseText}\n//# sourceURL=${normalizedPath}`
    );

    evaluate(module, exports, function legacyBridgeRequire(id) {
      return resolveRequiredModule(normalizedPath, id);
    });

    moduleCache.set(normalizedPath, module.exports);
    return module.exports;
  }

  function resolveRequiredModule(fromPath, id) {
    if (typeof id !== "string" || !id) {
      throw new Error("CommonJS require id must be a non-empty string");
    }

    if (id.startsWith("./") || id.startsWith("../")) {
      const resolvedPath = normalizePath(withJsExtension(resolveRelativePath(fromPath, id)));
      if (moduleCache.has(resolvedPath)) return moduleCache.get(resolvedPath);
      throw new Error(`Required engine dependency is not loaded yet: ${resolvedPath}`);
    }

    if (id.startsWith("Koz_Engine_Lib/")) {
      const normalizedPath = normalizePath(withJsExtension(id));
      if (moduleCache.has(normalizedPath)) return moduleCache.get(normalizedPath);
      throw new Error(`Required engine dependency is not loaded yet: ${normalizedPath}`);
    }

    throw new Error(`CommonJS require is not supported in browser bridge: ${id}`);
  }

  function bridgeRequire(id) {
    return resolveRequiredModule(root.__KozEngineCurrentModulePath || "", id);
  }

  function restoreCommonJsGlobals(snapshot) {
    if (snapshot.hasModule) root.module = snapshot.module;
    else delete root.module;

    if (snapshot.hasExports) root.exports = snapshot.exports;
    else delete root.exports;

    if (snapshot.hasRequire) root.require = snapshot.require;
    else delete root.require;

    if (snapshot.hasActivePath) root.__KozEngineCurrentModulePath = snapshot.activePath;
    else delete root.__KozEngineCurrentModulePath;
  }

  function loadCommonJsModuleViaScript(path) {
    const normalizedPath = normalizePath(withJsExtension(path));
    if (moduleCache.has(normalizedPath)) return Promise.resolve(moduleCache.get(normalizedPath));
    if (moduleLoadPromises.has(normalizedPath)) return moduleLoadPromises.get(normalizedPath);

    const promise = new Promise((resolve, reject) => {
      const doc = root.document;
      const target = doc.head || doc.body || doc.documentElement;
      if (!target) {
        reject(new Error(`Failed to load engine module: ${normalizedPath} (document root unavailable)`));
        return;
      }

      const script = doc.createElement("script");
      const module = { exports: {} };
      const snapshot = {
        hasModule: Object.prototype.hasOwnProperty.call(root, "module"),
        module: root.module,
        hasExports: Object.prototype.hasOwnProperty.call(root, "exports"),
        exports: root.exports,
        hasRequire: Object.prototype.hasOwnProperty.call(root, "require"),
        require: root.require,
        hasActivePath: Object.prototype.hasOwnProperty.call(root, "__KozEngineCurrentModulePath"),
        activePath: root.__KozEngineCurrentModulePath,
      };

      function cleanup() {
        script.onload = null;
        script.onerror = null;
        if (script.parentNode) script.parentNode.removeChild(script);
        restoreCommonJsGlobals(snapshot);
      }

      root.module = module;
      root.exports = module.exports;
      root.require = bridgeRequire;
      root.__KozEngineCurrentModulePath = normalizedPath;

      script.async = false;
      script.src = normalizedPath;
      script.onload = function onLoad() {
        cleanup();
        moduleCache.set(normalizedPath, module.exports);
        resolve(module.exports);
      };
      script.onerror = function onError() {
        cleanup();
        reject(new Error(`Failed to load engine module: ${normalizedPath}`));
      };

      target.appendChild(script);
    }).finally(() => {
      moduleLoadPromises.delete(normalizedPath);
    });

    moduleLoadPromises.set(normalizedPath, promise);
    return promise;
  }

  function loadCommonJsModule(path) {
    const normalizedPath = normalizePath(withJsExtension(path));
    if (moduleCache.has(normalizedPath)) return moduleCache.get(normalizedPath);

    if (
      preloadModulePaths.has(normalizedPath) ||
      defLoadPromises.has(normalizedPath) ||
      moduleLoadPromises.has(normalizedPath)
    ) {
      throw new Error(
        `Engine module is still loading: ${normalizedPath}. Await window.BQKozEngineReady before using engine globals.`
      );
    }

    return loadCommonJsModuleLegacy(normalizedPath);
  }

  function withJsExtension(path) {
    return path.endsWith(".js") ? path : `${path}.js`;
  }

  function normalizePath(path) {
    const parts = [];
    const segments = String(path || "").split("/");
    for (const segment of segments) {
      if (!segment || segment === ".") continue;
      if (segment === "..") {
        parts.pop();
        continue;
      }
      parts.push(segment);
    }
    return parts.join("/");
  }

  function dirname(path) {
    const normalized = normalizePath(path);
    const idx = normalized.lastIndexOf("/");
    return idx === -1 ? "" : normalized.slice(0, idx);
  }

  function resolveRelativePath(fromPath, requestPath) {
    const baseDir = dirname(fromPath);
    return normalizePath(`${baseDir}/${requestPath}`);
  }

  function reportStartupStage(message) {
    try {
      if (root.BQStartupShell && typeof root.BQStartupShell.setStage === "function") {
        root.BQStartupShell.setStage(message);
      }
    } catch (_err) {}
  }

  const moduleDefs = [
    {
      path: "Koz_Engine_Lib/AI/astar.js",
      register: ["AI", "astar"],
      globals: {
        aStar: (api) => api.aStar,
        MinHeap: (api) => api.MinHeap,
      },
    },
    {
      path: "Koz_Engine_Lib/Assets/atlasHelper.js",
      register: ["Assets", "atlasHelper"],
      globals: {
        AtlasManager: (api) => api.AtlasManager,
      },
    },
    {
      path: "Koz_Engine_Lib/World/seededRng.js",
      register: ["World", "seededRng"],
      globals: {
        BQSeededRNG: (api) => api.SeededRNG,
        BQRandom: (api) => function BQRandom(streamName) {
          return api.namedRandom(api.SeededRNG, streamName || "default");
        },
      },
    },
    {
      path: "Koz_Engine_Lib/World/worldSpace.js",
      register: ["World", "worldSpace"],
    },
    {
      path: "Koz_Engine_Lib/World/worldEditor.js",
      register: ["World", "worldEditor"],
    },
    {
      path: "Koz_Engine_Lib/World/worldGenerators.js",
      register: ["World", "worldGenerators"],
    },
    {
      path: "Koz_Engine_Lib/World/dungeonMaze.js",
      register: ["World", "dungeonMaze"],
    },
    {
      path: "Koz_Engine_Lib/Time/countdownTimer.js",
      register: ["Time", "countdownTimer"],
    },
    {
      path: "Koz_Engine_Lib/Core/gameStateManager.js",
      register: ["Core", "gameStateManager"],
      globals: {
        GameStateManager: (api) => api.GameStateManager,
      },
    },
    {
      path: "Koz_Engine_Lib/Core/spatialGrid.js",
      register: ["Core", "spatialGrid"],
      globals: {
        SpatialGrid: (api) => api.SpatialGrid,
      },
    },
    {
      path: "Koz_Engine_Lib/Core/uiScreenController.js",
      register: ["Core", "uiScreenController"],
    },
    {
      path: "Koz_Engine_Lib/SaveLoad/schemaRegistry.js",
      register: ["SaveLoad", "schemaRegistry"],
    },
    {
      path: "Koz_Engine_Lib/SaveLoad/storageDrivers.js",
      register: ["SaveLoad", "storageDrivers"],
    },
    {
      path: "Koz_Engine_Lib/SaveLoad/saveApi.js",
      register: ["SaveLoad", "saveApi"],
    },
    {
      path: "Koz_Engine_Lib/Time/dayNightCore.js",
      register: ["Time", "dayNightCore"],
    },
    {
      path: "Koz_Engine_Lib/Time/dayNightCycle.js",
      register: ["Time", "dayNightCycle"],
      globals: {
        DayNightCycle: (api) => api.DayNightCycle,
      },
    },
    {
      path: "Koz_Engine_Lib/Events/eventEngine.js",
      register: ["Events", "eventEngine"],
    },
    {
      path: "Koz_Engine_Lib/Events/eventSystem.js",
      register: ["Events", "eventSystem"],
      globals: {
        EventSystem: (api) => api.EventSystem,
      },
    },
    {
      path: "Koz_Engine_Lib/Events/tipTracker.js",
      register: ["Events", "tipTracker"],
    },
    {
      path: "Koz_Engine_Lib/UI/mobileInput.js",
      register: ["UI", "mobileInput"],
    },
    {
      path: "Koz_Engine_Lib/UI/tabs.js",
      register: ["UI", "tabs"],
      globals: {
        BQTabs: (api) => api,
      },
    },
    {
      path: "Koz_Engine_Lib/Economy/stagedAcquisition.js",
      register: ["Economy", "stagedAcquisition"],
    },
    {
      path: "Koz_Engine_Lib/Items/itemFactory.js",
      register: ["Items", "itemFactory"],
    },
    {
      path: "Koz_Engine_Lib/Minigames/manager.js",
      register: ["Minigames", "manager"],
    },
    {
      path: "Koz_Engine_Lib/Minigames/minigamesRuntime.js",
      register: ["Minigames", "runtime"],
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
      },
    },
    {
      path: "Koz_Engine_Lib/VisualFX/particleSystemCore.js",
      register: ["VisualFX", "particleSystemCore"],
    },
    {
      path: "Koz_Engine_Lib/VisualFX/particleSystem.js",
      register: ["VisualFX", "particleSystem"],
      globals: {
        ParticleSystem: (api) => api.ParticleSystem,
      },
      afterLoad: function afterParticleSystem(api) {
        if (root.particleSystem === undefined) {
          root.particleSystem = api.createParticleSystem();
        }
        registerNamespace(["VisualFX", "particleSystem"], {
          ParticleSystem: api.ParticleSystem,
          particleSystem: root.particleSystem,
        });
      },
    },
    {
      path: "Koz_Engine_Lib/UI/modalPrimitives.js",
      register: ["UI", "modalPrimitives"],
    },
    {
      path: "Koz_Engine_Lib/Events/notificationCenter.js",
      register: ["Events", "notificationCenter"],
    },
    {
      path: "Koz_Engine_Lib/Events/notificationManager.js",
      register: ["Events", "notificationManager"],
      globals: {
        NotificationManager: (api) => api.NotificationManager,
      },
    },
    {
      path: "Koz_Engine_Lib/UI/uiManager.js",
      register: ["UI", "uiManager"],
      globals: {
        UIManager: (api) => api.UIManager,
      },
    },
    {
      path: "Koz_Engine_Lib/Audio/musicSystem.js",
      register: ["Audio", "musicSystem"],
      globals: {
        MusicSystem: (api) => api.MusicSystem,
      },
    },
    {
      path: "Koz_Engine_Lib/Audio/soundRegistry.js",
      register: ["Audio", "soundRegistry"],
    },
  ];

  const moduleDefsByPath = new Map(
    moduleDefs.map((def) => [normalizePath(withJsExtension(def.path)), def])
  );

  function finalizeModuleDef(def, api) {
    const normalizedPath = normalizePath(withJsExtension(def.path));
    if (loadedDefs.has(normalizedPath)) {
      return moduleCache.get(normalizedPath) || api;
    }

    if (def.register) {
      registerNamespace(def.register, api);
    }

    if (def.globals) {
      for (const [name, factory] of Object.entries(def.globals)) {
        publishGlobal(name, factory(api));
      }
    }

    if (typeof def.afterLoad === "function") {
      def.afterLoad(api);
    }

    loadedDefs.add(normalizedPath);
    return api;
  }

  function loadModuleDef(def) {
    const normalizedPath = normalizePath(withJsExtension(def.path));
    if (loadedDefs.has(normalizedPath)) {
      return moduleCache.get(normalizedPath);
    }

    const api = loadCommonJsModule(def.path);
    return finalizeModuleDef(def, api);
  }

  function loadModuleDefAsync(def) {
    const normalizedPath = normalizePath(withJsExtension(def.path));
    if (loadedDefs.has(normalizedPath)) {
      return Promise.resolve(moduleCache.get(normalizedPath));
    }
    if (defLoadPromises.has(normalizedPath)) {
      return defLoadPromises.get(normalizedPath);
    }

    const promise = loadCommonJsModuleViaScript(def.path)
      .then((api) => finalizeModuleDef(def, api))
      .finally(() => {
        defLoadPromises.delete(normalizedPath);
      });

    defLoadPromises.set(normalizedPath, promise);
    return promise;
  }

  function ensureModules(requests) {
    const list = Array.isArray(requests) ? requests : [requests];
    const loaded = [];

    for (const request of list) {
      if (!request) continue;
      const normalizedPath = normalizePath(withJsExtension(String(request)));
      const def = moduleDefsByPath.get(normalizedPath);
      loaded.push(def ? loadModuleDef(def) : loadCommonJsModule(normalizedPath));
    }

    return loaded;
  }

  async function ensureModulesAsync(requests) {
    const list = Array.isArray(requests) ? requests : [requests];
    const loaded = [];

    for (const request of list) {
      if (!request) continue;
      const normalizedPath = normalizePath(withJsExtension(String(request)));
      const def = moduleDefsByPath.get(normalizedPath);
      loaded.push(def ? await loadModuleDefAsync(def) : await loadCommonJsModuleViaScript(normalizedPath));
    }

    return loaded;
  }

  const appPreloadOrder = [
    // Keep startup preload limited to menu/runtime essentials so the main menu
    // appears quickly. Gameplay, world generation, editor, minigame, and
    // notification modules are loaded on demand by the game bootstrap paths.
    "Koz_Engine_Lib/Assets/atlasHelper.js",
    "Koz_Engine_Lib/Core/gameStateManager.js",
    "Koz_Engine_Lib/UI/tabs.js",
    "Koz_Engine_Lib/UI/uiManager.js",
  ].map((path) => normalizePath(withJsExtension(path)));

  for (const path of appPreloadOrder) {
    preloadModulePaths.add(path);
  }

  const preloadDefs = moduleDefs.filter((def) => preloadModulePaths.has(normalizePath(withJsExtension(def.path))));

  async function preloadAppModules() {
    reportStartupStage("Loading startup systems...");
    for (const def of preloadDefs) {
      await loadModuleDefAsync(def);
    }
  }

  root.BQEnsureEngineModules = ensureModules;
  root.BQEnsureEngineModulesAsync = ensureModulesAsync;
  root.BQKozEngineReady = new Promise((resolve, reject) => {
    root.setTimeout(() => {
      preloadAppModules()
        .then(resolve)
        .catch((err) => {
          console.error("[KozEngine] preload failed:", err);
          reportStartupStage("Engine load failed");
          reject(err);
        });
    }, 0);
  });
})(typeof window !== "undefined" ? window : globalThis);
