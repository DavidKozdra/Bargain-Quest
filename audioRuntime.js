(function initBargainQuestAudioRuntime(root, factory) {
  const api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.BQAudioRuntime = api;

    if (root.document && root.sound === undefined) {
      root.sound = api.createBargainQuestAudio();
      if (Array.isArray(root.BQ_AUDIO_TRACK_PLAN) && typeof root.sound.planTracks === "function") {
        root.sound.planTracks(root.BQ_AUDIO_TRACK_PLAN);
      }
      if (typeof root.sound.bindUnlockHandlers === "function") {
        root.sound.bindUnlockHandlers();
      }
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createBargainQuestAudioRuntimeApi(root) {
  function clamp01(value, fallback) {
    const next = Number(value);
    if (!Number.isFinite(next)) return Number.isFinite(fallback) ? clamp01(fallback, 0.5) : 0.5;
    return Math.max(0, Math.min(1, next));
  }

  function readStoredLevel(storage, key, fallback) {
    try {
      const raw = storage && typeof storage.getItem === "function" ? storage.getItem(key) : null;
      if (raw == null) return clamp01(fallback, 0.5);
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) return clamp01(fallback, 0.5);
      return numeric > 1 ? clamp01(numeric / 100, fallback) : clamp01(numeric, fallback);
    } catch (_err) {
      return clamp01(fallback, 0.5);
    }
  }

  function writeStoredLevel(storage, key, value) {
    const next = clamp01(value, 0.5);
    try {
      if (storage && typeof storage.setItem === "function") {
        storage.setItem(key, String(next));
      }
    } catch (_err) {}
    return next;
  }

  function tryGetStorage(explicitStorage) {
    if (explicitStorage) return explicitStorage;
    try {
      return root && root.localStorage ? root.localStorage : null;
    } catch (_err) {
      return null;
    }
  }

  function resolveMusicSystemCtor(explicitCtor) {
    if (typeof explicitCtor === "function") return explicitCtor;
    if (root && typeof root.MusicSystem === "function") return root.MusicSystem;
    return root?.KozEngine?.Audio?.musicSystem?.MusicSystem || null;
  }

  function createFallbackRegistry() {
    const entries = new Map();
    return {
      register(id, config = {}) {
        const key = String(id || "");
        const entry = { id: key, ...config };
        entries.set(key, entry);
        return entry;
      },
      get(id) {
        return entries.get(String(id || "")) || null;
      },
      list() {
        return Array.from(entries.values());
      },
      clear() {
        entries.clear();
      },
    };
  }

  function resolveRegistryFactory(explicitFactory) {
    if (typeof explicitFactory === "function") return explicitFactory;
    const engineFactory = root?.KozEngine?.Audio?.soundRegistry?.createSoundRegistry;
    if (typeof engineFactory === "function") return engineFactory;
    return createFallbackRegistry;
  }

  function normalizeTrackDefinition(trackDef, index) {
    const source = trackDef || {};
    const id = String(source.id || `track-${index + 1}`);
    const path = String(source.path || source.src || "");
    const role = String(source.role || (index === 0 ? "menu" : "adventure")).toLowerCase();
    return Object.freeze({
      id,
      path,
      role,
      label: String(source.label || id),
      volume: clamp01(source.volume == null ? 1 : source.volume, 1),
    });
  }

  function normalizeEffectDefinition(effectDef, index) {
    const source = effectDef || {};
    const id = String(source.id || `effect-${index + 1}`);
    const path = String(source.path || source.src || "");
    return Object.freeze({
      id,
      path,
      label: String(source.label || id),
      volume: clamp01(source.volume == null ? 1 : source.volume, 1),
    });
  }

  function createHtmlAudioTrack(trackDef = {}, options = {}) {
    const AudioCtor = options.AudioCtor || (root && root.Audio) || null;
    const setTimer = typeof options.setTimeout === "function"
      ? options.setTimeout
      : root && typeof root.setTimeout === "function"
        ? root.setTimeout.bind(root)
        : null;
    const clearTimer = typeof options.clearTimeout === "function"
      ? options.clearTimeout
      : root && typeof root.clearTimeout === "function"
        ? root.clearTimeout.bind(root)
        : null;
    const timeoutMs = Math.max(250, Number(options.timeoutMs) || 4500);
    const audio = typeof AudioCtor === "function" ? new AudioCtor() : null;
    let loadPromise = null;
    let lastError = null;
    let volume = clamp01(trackDef.volume == null ? 1 : trackDef.volume, 1);

    if (audio) {
      try { audio.preload = "auto"; } catch (_err) {}
      try { audio.src = String(trackDef.path || ""); } catch (_err) {}
      try { audio.volume = volume; } catch (_err) {}
    }

    function resolveWhenReady() {
      if (!audio) return Promise.resolve(null);
      if (loadPromise) return loadPromise;
      if (audio.readyState && audio.readyState >= 1) {
        loadPromise = Promise.resolve(audio);
        return loadPromise;
      }
      if (typeof audio.addEventListener !== "function") {
        if (typeof audio.load === "function") {
          try { audio.load(); } catch (_err) {}
        }
        loadPromise = Promise.resolve(audio);
        return loadPromise;
      }

      loadPromise = new Promise((resolve, reject) => {
        let finished = false;
        let timerId = null;

        const cleanup = () => {
          if (typeof audio.removeEventListener === "function") {
            audio.removeEventListener("loadedmetadata", onReady);
            audio.removeEventListener("loadeddata", onReady);
            audio.removeEventListener("canplaythrough", onReady);
            audio.removeEventListener("error", onError);
          }
          if (timerId != null && typeof clearTimer === "function") {
            clearTimer(timerId);
          }
        };

        const finish = (err) => {
          if (finished) return;
          finished = true;
          cleanup();
          if (err) {
            lastError = err;
            reject(err);
            return;
          }
          resolve(audio);
        };

        const onReady = () => finish(null);
        const onError = () => finish(new Error(`[audio] Failed to load ${trackDef.path || trackDef.id || "track"}`));

        audio.addEventListener("loadedmetadata", onReady, { once: true });
        audio.addEventListener("loadeddata", onReady, { once: true });
        audio.addEventListener("canplaythrough", onReady, { once: true });
        audio.addEventListener("error", onError, { once: true });

        if (setTimer) {
          timerId = setTimer(() => finish(null), timeoutMs);
        }

        try {
          if (typeof audio.load === "function") audio.load();
        } catch (err) {
          finish(err instanceof Error ? err : new Error(String(err || "Audio load failed")));
        }
      });

      return loadPromise;
    }

    return {
      id: String(trackDef.id || ""),
      path: String(trackDef.path || ""),
      load: resolveWhenReady,
      setVolume(nextVolume) {
        volume = clamp01(nextVolume, volume);
        if (audio) {
          try { audio.volume = volume; } catch (_err) {}
        }
      },
      getVolume() {
        return volume;
      },
      setLoop(nextLoop) {
        if (!audio) return;
        try { audio.loop = !!nextLoop; } catch (_err) {}
      },
      play() {
        if (!audio || typeof audio.play !== "function") return Promise.resolve(null);
        const result = audio.play();
        if (result && typeof result.then === "function") {
          return result.catch((err) => {
            lastError = err instanceof Error ? err : new Error(String(err || "Audio play failed"));
            throw lastError;
          });
        }
        return Promise.resolve(result || audio);
      },
      stop() {
        if (!audio) return;
        if (typeof audio.pause === "function") {
          try { audio.pause(); } catch (_err) {}
        }
        try { audio.currentTime = 0; } catch (_err) {}
      },
      isPlaying() {
        if (!audio) return false;
        return audio.paused === false && audio.ended !== true;
      },
      getLastError() {
        return lastError;
      },
      getAudioElement() {
        return audio;
      },
    };
  }

  class BasicMusicSystem {
    constructor(mainTrack, otherTracks = [], options = {}) {
      this.mainTrack = mainTrack || null;
      this.otherTracks = Array.isArray(otherTracks) ? otherTracks : [];
      this.current = null;
      this.storage = options.storage || null;
      this.storageKey = options.storageKey || "music_vol";
      this.random = typeof options.random === "function" ? options.random : Math.random;
      this.volume = readStoredLevel(this.storage, this.storageKey, options.defaultVolume ?? 0.5);
      this._applyVolume();
    }

    getVolume() {
      return this.volume;
    }

    setVolume(nextVolume) {
      this.volume = writeStoredLevel(this.storage, this.storageKey, nextVolume);
      this._applyVolume();
      return this.volume;
    }

    async playMainTheme() {
      if (this.current === this.mainTrack && this.current?.isPlaying?.()) return this.current;
      this.stop();
      this.current = this.mainTrack;
      if (!this.current) return null;
      this.current.setLoop?.(true);
      this.current.setVolume?.(this.volume);
      await Promise.resolve(this.current.play?.());
      return this.current;
    }

    async playRandom() {
      const pool = this.otherTracks.length ? this.otherTracks : [this.mainTrack].filter(Boolean);
      if (!pool.length) {
        this.stop();
        return null;
      }
      const idx = Math.max(0, Math.min(pool.length - 1, Math.floor(this.random() * pool.length)));
      const next = pool[idx];
      if (this.current === next && next?.isPlaying?.()) return next;
      this.stop();
      this.current = next;
      this.current?.setLoop?.(false);
      this.current?.setVolume?.(this.volume);
      await Promise.resolve(this.current?.play?.());
      return this.current || null;
    }

    stop() {
      if (this.current && typeof this.current.stop === "function") {
        this.current.stop();
      }
      this.current = null;
    }

    _applyVolume() {
      [this.mainTrack, ...this.otherTracks].forEach((track) => {
        track?.setVolume?.(this.volume);
      });
    }
  }

  function isAutoplayBlockedError(err) {
    const name = String(err?.name || "");
    const message = String(err?.message || err || "");
    return name === "NotAllowedError"
      || /notallowederror/i.test(message)
      || /user gesture/i.test(message)
      || /play\(\) failed/i.test(message);
  }

  const MENU_STATES = new Set(["mainMenu", "newGameConfig", "credits", "infoMenu", "levelEditor"]);
  const ADVENTURE_STATES = new Set([
    "playing",
    "cityManage",
    "combat",
    "randomEvent",
    "weeklySummary",
    "inventory",
    "minigame",
    "gambling",
    "contractBoard",
    "bank",
    "bountyBoard",
    "blackMarket",
    "treasureMap",
    "gameWon",
    "gameLose",
  ]);
  const PRESERVE_STATES = new Set(["paused", "settings"]);

  function resolvePlaybackModeForState(previousState, nextState, currentMode = "menu") {
    const from = String(previousState || "");
    const to = String(nextState || "");
    if (ADVENTURE_STATES.has(to)) return "adventure";
    if (MENU_STATES.has(to)) return "menu";
    if (PRESERVE_STATES.has(to)) {
      if (ADVENTURE_STATES.has(from)) return "adventure";
      if (MENU_STATES.has(from)) return "menu";
      return currentMode || "menu";
    }
    return currentMode || "menu";
  }

  function createBargainQuestAudio(options = {}) {
    const storage = tryGetStorage(options.storage);
    const MusicSystemCtor = resolveMusicSystemCtor(options.MusicSystem) || BasicMusicSystem;
    const registryFactory = resolveRegistryFactory(options.soundRegistryFactory);
    const registry = registryFactory();
    const musicStorageKey = options.musicStorageKey || "music_vol";
    const gameStorageKey = options.gameStorageKey || "game_vol";
    const masterStorageKey = options.masterStorageKey || "master_vol";
    const trackFactory = typeof options.trackFactory === "function"
      ? options.trackFactory
      : (trackDef) => createHtmlAudioTrack(trackDef, {
          AudioCtor: options.AudioCtor,
          setTimeout: options.setTimeout,
          clearTimeout: options.clearTimeout,
          timeoutMs: options.preloadTimeoutMs,
        });

    const state = {
      registry,
      tracks: new Map(),
      defs: [],
      effectRegistry: null,
      effectTracks: new Map(),
      effectDefs: [],
      musicSystem: null,
      currentMode: "menu",
      pendingMode: null,
      preloadPromise: null,
      preloadResults: [],
      effectPreloadPromise: null,
      effectPreloadResults: [],
      planSignature: "",
      effectPlanSignature: "",
      gameVolume: readStoredLevel(storage, gameStorageKey, options.defaultGameVolume ?? 0.5),
      musicVolume: readStoredLevel(storage, musicStorageKey, options.defaultMusicVolume ?? 0.5),
      masterVolume: readStoredLevel(storage, masterStorageKey, options.defaultMasterVolume ?? 1),
      unlockTarget: null,
      unlockHandler: null,
      otherTrackCount: 0,
      effectBaseVolumes: new Map(),
    };

    function getDefaultPlan() {
      return Array.isArray(root?.BQ_AUDIO_TRACK_PLAN) ? root.BQ_AUDIO_TRACK_PLAN : [];
    }

    function getDefaultEffectPlan() {
      return Array.isArray(root?.BQ_AUDIO_EFFECT_PLAN) ? root.BQ_AUDIO_EFFECT_PLAN : [];
    }

    function ensurePlanned(trackDefs) {
      if (!state.planSignature) {
        planTracks(trackDefs || getDefaultPlan());
      }
    }

    function ensureEffectsPlanned(effectDefs) {
      if (!state.effectPlanSignature) {
        planSoundEffects(effectDefs || getDefaultEffectPlan());
      }
    }

    function planTracks(trackDefs = []) {
      const defs = Array.isArray(trackDefs)
        ? trackDefs.map(normalizeTrackDefinition).filter((entry) => !!entry.path)
        : [];
      const signature = JSON.stringify(defs.map((entry) => [entry.id, entry.path, entry.role, entry.volume]));
      if (signature && signature === state.planSignature) return state.defs.slice();

      state.musicSystem?.stop?.();
      state.registry?.clear?.();
      state.tracks.clear();
      state.defs = defs;
      state.planSignature = signature;
      state.preloadPromise = null;
      state.preloadResults = [];

      defs.forEach((entry) => {
        state.registry?.register?.(entry.id, {
          path: entry.path,
          volume: entry.volume,
          variants: 1,
        });
        state.tracks.set(entry.id, trackFactory(entry));
      });

      let mainTrack = null;
      const otherTracks = [];

      defs.forEach((entry, index) => {
        const track = state.tracks.get(entry.id) || null;
        if (!mainTrack && (entry.role === "menu" || index === 0)) {
          mainTrack = track;
          return;
        }
        otherTracks.push(track);
      });

      state.otherTrackCount = otherTracks.filter(Boolean).length;

      // The runtime is the single source of truth for the raw per-channel
      // music volume and its persistence. The music system is given no storage
      // so it cannot clobber `music_vol` with a master-scaled output value
      // (which would double-apply master on the next load).
      const musicOptions = {
        storage: null,
        storageKey: musicStorageKey,
        defaultVolume: state.musicVolume,
      };
      if (typeof options.random === "function") {
        musicOptions.random = options.random;
      }

      state.musicSystem = new MusicSystemCtor(mainTrack, otherTracks, musicOptions);
      // Apply master scaling on top of the runtime-owned per-channel volume.
      _applyMusicOutputVolume();
      return defs.slice();
    }

    function planSoundEffects(effectDefs = []) {
      const defs = Array.isArray(effectDefs)
        ? effectDefs.map(normalizeEffectDefinition).filter((entry) => !!entry.path)
        : [];
      const signature = JSON.stringify(defs.map((entry) => [entry.id, entry.path, entry.volume]));
      if (signature && signature === state.effectPlanSignature) return defs.slice();

      state.effectRegistry?.clear?.();
      state.effectTracks.clear();
      state.effectDefs = defs;
      state.effectPlanSignature = signature;
      state.effectPreloadPromise = null;
      state.effectPreloadResults = [];
      state.effectBaseVolumes.clear();
      state.effectRegistry = registryFactory();

      defs.forEach((entry) => {
        state.effectRegistry?.register?.(entry.id, {
          path: entry.path,
          volume: entry.volume,
          variants: 1,
        });
        state.effectTracks.set(entry.id, trackFactory(entry));
        state.effectBaseVolumes.set(entry.id, entry.volume);
      });

      state.effectTracks.forEach((track, id) => {
        const base = state.effectBaseVolumes.get(id) ?? 1;
        track?.setVolume?.(clamp01(base * state.gameVolume * state.masterVolume, 0));
      });

      return defs.slice();
    }

    function preloadRegisteredTracks(trackDefs) {
      ensurePlanned(trackDefs);
      if (state.preloadPromise) return state.preloadPromise;

      const work = state.defs.map((entry) => {
        const track = state.tracks.get(entry.id);
        return Promise.resolve()
          .then(() => track?.load?.())
          .then(() => ({ id: entry.id, path: entry.path, status: "fulfilled" }))
          .catch((err) => ({
            id: entry.id,
            path: entry.path,
            status: "rejected",
            reason: err instanceof Error ? err : new Error(String(err || "Audio preload failed")),
          }));
      });

      state.preloadPromise = Promise.all(work).then((results) => {
        state.preloadResults = results;
        return results;
      });

      return state.preloadPromise;
    }

    function preloadRegisteredEffects(effectDefs) {
      ensureEffectsPlanned(effectDefs);
      if (state.effectPreloadPromise) return state.effectPreloadPromise;

      const work = state.effectDefs.map((entry) => {
        const track = state.effectTracks.get(entry.id);
        return Promise.resolve()
          .then(() => track?.load?.())
          .then(() => ({ id: entry.id, path: entry.path, status: "fulfilled" }))
          .catch((err) => ({
            id: entry.id,
            path: entry.path,
            status: "rejected",
            reason: err instanceof Error ? err : new Error(String(err || "Audio preload failed")),
          }));
      });

      state.effectPreloadPromise = Promise.all(work).then((results) => {
        state.effectPreloadResults = results;
        return results;
      });

      return state.effectPreloadPromise;
    }

    function _applyMusicOutputVolume() {
      const output = clamp01(state.musicVolume * state.masterVolume, 0);
      if (state.musicSystem && typeof state.musicSystem.setVolume === "function") {
        state.musicSystem.setVolume(output);
      } else {
        state.tracks.forEach((track) => track?.setVolume?.(output));
      }
    }

    function _applyEffectOutputVolumes() {
      const scale = state.gameVolume * state.masterVolume;
      state.effectTracks.forEach((track, id) => {
        const base = state.effectBaseVolumes.get(id) ?? 1;
        track?.setVolume?.(clamp01(base * scale, 0));
      });
    }

    function setMusicVolume(nextVolume) {
      ensurePlanned();
      state.musicVolume = writeStoredLevel(storage, musicStorageKey, nextVolume);
      _applyMusicOutputVolume();
      return state.musicVolume;
    }

    function setGameVolume(nextVolume) {
      state.gameVolume = writeStoredLevel(storage, gameStorageKey, nextVolume);
      _applyEffectOutputVolumes();
      return state.gameVolume;
    }

    function setMasterVolume(nextVolume) {
      state.masterVolume = writeStoredLevel(storage, masterStorageKey, nextVolume);
      ensurePlanned();
      _applyMusicOutputVolume();
      _applyEffectOutputVolumes();
      return state.masterVolume;
    }

    async function playEffect(effectId) {
      ensureEffectsPlanned();
      const track = state.effectTracks.get(String(effectId || "")) || null;
      if (!track) return null;

      try {
        await Promise.resolve(track.load?.());
        track.setVolume?.(clamp01((state.effectBaseVolumes.get(String(effectId || "")) ?? 1) * state.gameVolume * state.masterVolume, 0));
        track.stop?.();
        await Promise.resolve(track.play?.());
        return track;
      } catch (err) {
        if (root?.console?.warn) {
          root.console.warn(`[audio] Failed to play effect ${String(effectId || "unknown")}.`, err);
        }
        return null;
      }
    }

    function playUiClick() {
      return playEffect("uiClick");
    }

    function playTradeBuy() {
      return playEffect("tradeBuy");
    }

    function playTradeSell() {
      return playEffect("tradeSell");
    }

    function playDiceRoll() {
      return playEffect("diceRoll");
    }

    async function applyMode(nextMode) {
      ensurePlanned();
      state.currentMode = nextMode || state.currentMode || "menu";
      if (!state.musicSystem) return null;

      try {
        let result = null;
        if (state.currentMode === "menu") {
          result = await state.musicSystem.playMainTheme();
        } else if (state.currentMode === "adventure") {
          result = state.otherTrackCount > 0
            ? await state.musicSystem.playRandom(0)
            : await state.musicSystem.playMainTheme();
        } else {
          state.musicSystem.stop?.();
        }
        // Re-apply master scaling: the music system resets track volume to its
        // per-channel level when (re)starting playback.
        _applyMusicOutputVolume();
        state.pendingMode = null;
        unbindUnlockHandlers();
        return result;
      } catch (err) {
        if (isAutoplayBlockedError(err)) {
          state.pendingMode = state.currentMode;
          bindUnlockHandlers();
          return null;
        }
        if (root?.console?.warn) {
          root.console.warn(`[audio] Failed to switch to ${state.currentMode} music.`, err);
        }
        return null;
      }
    }

    function bindUnlockHandlers(target) {
      const eventTarget = target || state.unlockTarget || root?.window || root?.document || null;
      if (!eventTarget || typeof eventTarget.addEventListener !== "function" || state.unlockHandler) return;

      state.unlockTarget = eventTarget;
      state.unlockHandler = () => {
        if (!state.pendingMode) return;
        applyMode(state.pendingMode);
      };

      ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
        eventTarget.addEventListener(eventName, state.unlockHandler, { passive: true });
      });
    }

    function unbindUnlockHandlers() {
      if (!state.unlockTarget || !state.unlockHandler || typeof state.unlockTarget.removeEventListener !== "function") return;
      ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
        state.unlockTarget.removeEventListener(eventName, state.unlockHandler, { passive: true });
      });
      state.unlockHandler = null;
    }

    return {
      planTracks,
      planSoundEffects,
      preloadRegisteredTracks,
      preloadRegisteredEffects,
      bindUnlockHandlers,
      unbindUnlockHandlers,
      resumePendingPlayback() {
        if (!state.pendingMode) return Promise.resolve(null);
        return applyMode(state.pendingMode);
      },
      playMenuMusic() {
        return applyMode("menu");
      },
      playAdventureMusic() {
        return applyMode("adventure");
      },
      syncGameState(previousState, nextState) {
        const mode = resolvePlaybackModeForState(previousState, nextState, state.currentMode);
        return applyMode(mode);
      },
      stopMusic() {
        state.pendingMode = null;
        state.musicSystem?.stop?.();
      },
      playEffect,
      playUiClick,
      playTradeBuy,
      playTradeSell,
      playDiceRoll,
      setMusicVolume,
      setGameVolume,
      setMasterVolume,
      getMusicVolume() {
        return state.musicVolume;
      },
      getGameVolume() {
        return state.gameVolume;
      },
      getMasterVolume() {
        return state.masterVolume;
      },
      getTrackPlan() {
        return state.defs.slice();
      },
      getEffectPlan() {
        return state.effectDefs.slice();
      },
      getPreloadResults() {
        return state.preloadResults.slice();
      },
      getEffectPreloadResults() {
        return state.effectPreloadResults.slice();
      },
      getTrack(id) {
        return state.tracks.get(String(id || "")) || null;
      },
      getEffect(id) {
        return state.effectTracks.get(String(id || "")) || null;
      },
      getRegistryEntry(id) {
        return state.registry?.get?.(id) || null;
      },
      getEffectRegistryEntry(id) {
        return state.effectRegistry?.get?.(id) || null;
      },
    };
  }

  return {
    BasicMusicSystem,
    createHtmlAudioTrack,
    createBargainQuestAudio,
    resolvePlaybackModeForState,
    readStoredLevel,
    writeStoredLevel,
  };
});
