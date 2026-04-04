const {
  createBargainQuestAudio,
  resolvePlaybackModeForState,
} = require("../../audioRuntime");

function createMemoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
  };
}

function createRegistry() {
  const entries = new Map();
  return {
    register(id, config = {}) {
      const entry = { id, ...config };
      entries.set(id, entry);
      return entry;
    },
    get(id) {
      return entries.get(id) || null;
    },
    list() {
      return Array.from(entries.values());
    },
    clear() {
      entries.clear();
    },
  };
}

function createFakeTrack(trackDef) {
  let playing = false;
  let volume = 0;
  let loop = false;
  return {
    id: trackDef.id,
    load: jest.fn(async () => trackDef.path),
    setVolume(nextVolume) {
      volume = nextVolume;
    },
    getVolume() {
      return volume;
    },
    setLoop(nextLoop) {
      loop = !!nextLoop;
    },
    getLoop() {
      return loop;
    },
    play: jest.fn(async () => {
      playing = true;
      return trackDef.id;
    }),
    stop: jest.fn(() => {
      playing = false;
    }),
    isPlaying() {
      return playing;
    },
  };
}

class FakeMusicSystem {
  constructor(mainTrack, otherTracks = [], options = {}) {
    this.mainTrack = mainTrack || null;
    this.otherTracks = Array.isArray(otherTracks) ? otherTracks : [];
    this.current = null;
    this.storage = options.storage;
    this.storageKey = options.storageKey || "music_vol";
    const stored = Number(this.storage?.getItem?.(this.storageKey));
    this.volume = Number.isFinite(stored) ? stored : (options.defaultVolume ?? 0.5);
    this._applyVolume();
  }

  _applyVolume() {
    [this.mainTrack, ...this.otherTracks].forEach((track) => {
      track?.setVolume?.(this.volume);
    });
  }

  getVolume() {
    return this.volume;
  }

  setVolume(nextVolume) {
    this.volume = Number(nextVolume);
    this.storage?.setItem?.(this.storageKey, String(this.volume));
    this._applyVolume();
    return this.volume;
  }

  async playMainTheme() {
    this.current?.stop?.();
    this.current = this.mainTrack;
    this.current?.setLoop?.(true);
    await this.current?.play?.();
    return this.current;
  }

  async playRandom() {
    const next = this.otherTracks[0] || this.mainTrack;
    this.current?.stop?.();
    this.current = next;
    this.current?.setLoop?.(false);
    await this.current?.play?.();
    return this.current;
  }

  stop() {
    this.current?.stop?.();
    this.current = null;
  }
}

describe("audioRuntime", () => {
  test("plans, preloads, and switches tracks by state", async () => {
    const storage = createMemoryStorage();
    storage.setItem("music_vol", "0.6");
    storage.setItem("game_vol", "0.4");

    const controller = createBargainQuestAudio({
      storage,
      MusicSystem: FakeMusicSystem,
      soundRegistryFactory: createRegistry,
      trackFactory: createFakeTrack,
    });

    controller.planTracks([
      { id: "sellHighBuyBuyCity", path: "assets/audio/SELL_HIGH_BUY_BUY_CITY.m4a", role: "menu" },
      { id: "sellHighBuyBuyDay", path: "assets/audio/SELL_HIGH_BUY_BUY_Day.m4a", role: "adventure" },
      { id: "sellHighBuyBuyNight", path: "assets/audio/SELL_HIGH_BUY_BUY_Night.m4a", role: "adventure" },
    ]);
    controller.planSoundEffects([
      { id: "combatWin", path: "assets/audio/battleattempt1.ogg" },
      { id: "combatLoss", path: "assets/audio/sounds/misfortune1.ogg" },
      { id: "qteGood", path: "assets/audio/sounds/fortune3.ogg" },
      { id: "qteBad", path: "assets/audio/sounds/misfortune1.ogg" },
      { id: "combatHit", path: "assets/audio/battleattempt1.ogg" },
      { id: "combatMiss", path: "assets/audio/themeattempt1.ogg" },
    ]);

    expect(controller.getTrackPlan()).toHaveLength(3);
    expect(controller.getRegistryEntry("sellHighBuyBuyCity").path).toBe("assets/audio/SELL_HIGH_BUY_BUY_CITY.m4a");
    expect(controller.getRegistryEntry("sellHighBuyBuyDay").path).toBe("assets/audio/SELL_HIGH_BUY_BUY_Day.m4a");
    expect(controller.getRegistryEntry("sellHighBuyBuyNight").path).toBe("assets/audio/SELL_HIGH_BUY_BUY_Night.m4a");
    expect(controller.getEffectPlan()).toHaveLength(6);
    expect(controller.getEffectRegistryEntry("combatWin").path).toBe("assets/audio/battleattempt1.ogg");
    expect(controller.getEffectRegistryEntry("combatLoss").path).toBe("assets/audio/sounds/misfortune1.ogg");
    expect(controller.getEffectRegistryEntry("qteGood").path).toBe("assets/audio/sounds/fortune3.ogg");
    expect(controller.getEffectRegistryEntry("qteBad").path).toBe("assets/audio/sounds/misfortune1.ogg");
    expect(controller.getEffectRegistryEntry("combatHit").path).toBe("assets/audio/battleattempt1.ogg");
    expect(controller.getEffectRegistryEntry("combatMiss").path).toBe("assets/audio/themeattempt1.ogg");

    const preloadResults = await controller.preloadRegisteredTracks();
    expect(preloadResults).toHaveLength(3);
    expect(preloadResults.every((entry) => entry.status === "fulfilled")).toBe(true);
    const effectPreloadResults = await controller.preloadRegisteredEffects();
    expect(effectPreloadResults).toHaveLength(6);
    expect(effectPreloadResults.every((entry) => entry.status === "fulfilled")).toBe(true);

    await controller.syncGameState(null, "mainMenu");
    const menuTrack = controller.getTrack("sellHighBuyBuyCity");
    const voyageTrack = controller.getTrack("sellHighBuyBuyDay");
    expect(menuTrack.isPlaying()).toBe(true);
    expect(menuTrack.getLoop()).toBe(true);

    await controller.syncGameState("mainMenu", "playing");
    expect(menuTrack.isPlaying()).toBe(false);
    expect(voyageTrack.isPlaying()).toBe(true);
    expect(voyageTrack.getLoop()).toBe(false);
    await controller.playEffect("qteGood");
    expect(controller.getEffect("qteGood").isPlaying()).toBe(true);
    await controller.playEffect("combatHit");
    expect(controller.getEffect("combatHit").isPlaying()).toBe(true);

    await controller.syncGameState("playing", "settings");
    expect(voyageTrack.isPlaying()).toBe(true);

    expect(controller.setMusicVolume(0.8)).toBe(0.8);
    expect(menuTrack.getVolume()).toBe(0.8);
    expect(voyageTrack.getVolume()).toBe(0.8);

    expect(controller.setGameVolume(0.25)).toBe(0.25);
    expect(storage.getItem("game_vol")).toBe("0.25");
  });

  test("resolves menu and adventure modes across shared states", () => {
    expect(resolvePlaybackModeForState(null, "mainMenu", "menu")).toBe("menu");
    expect(resolvePlaybackModeForState("playing", "settings", "adventure")).toBe("adventure");
    expect(resolvePlaybackModeForState("mainMenu", "settings", "menu")).toBe("menu");
    expect(resolvePlaybackModeForState("paused", "playing", "menu")).toBe("adventure");
  });
});
