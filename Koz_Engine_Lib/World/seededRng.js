(function initSeededRngLib(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createSeededRngApi() {
  const DEFAULT_NONZERO_SEED = 0x9e3779b9;

  function fnv1a(str) {
    const text = String(str || "");
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  class SeededStream {
    constructor(seed, state) {
      this._seed = (seed >>> 0) || DEFAULT_NONZERO_SEED;
      this._state = (state !== undefined ? Number(state) : this._seed) >>> 0;
      if (this._state === 0) this._state = DEFAULT_NONZERO_SEED;
    }

    random() {
      let state = this._state >>> 0;
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      this._state = (state >>> 0) || DEFAULT_NONZERO_SEED;
      return this._state / 4294967296;
    }

    int(min, max) {
      const lo = Math.floor(Math.min(min, max));
      const hi = Math.floor(Math.max(min, max));
      return lo + Math.floor(this.random() * (hi - lo + 1));
    }

    chance(probability) {
      return this.random() < probability;
    }

    pick(list) {
      if (!Array.isArray(list) || list.length === 0) return undefined;
      return list[Math.floor(this.random() * list.length)];
    }

    shuffle(list) {
      const out = Array.isArray(list) ? list.slice() : [];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    }

    getState() {
      return this._state >>> 0;
    }

    setState(state) {
      this._state = Number(state) >>> 0;
      if (this._state === 0) this._state = DEFAULT_NONZERO_SEED;
    }
  }

  const SeededRNG = {
    _baseSeed: 0,
    _streams: new Map(),
    _origMathRandom: null,
    _globalStreamName: "global",

    startRun(seed, opts = {}) {
      this._baseSeed = Number(seed) >>> 0;
      this._streams.clear();
      const installGlobal = opts.installGlobalMathRandom !== false;
      if (installGlobal) this.installGlobalMathRandom(opts.globalStreamName || "global");
      else this.uninstallGlobalMathRandom();
    },

    stream(name) {
      const key = String(name || "default");
      let stream = this._streams.get(key);
      if (!stream) {
        const mixedSeed = (this._baseSeed ^ fnv1a(key) ^ 0x85ebca6b) >>> 0;
        stream = new SeededStream(mixedSeed);
        this._streams.set(key, stream);
      }
      return stream;
    },

    installGlobalMathRandom(streamName = "global") {
      if (!this._origMathRandom) this._origMathRandom = Math.random;
      this._globalStreamName = String(streamName || "global");
      const self = this;
      Math.random = function seededMathRandom() {
        return self.stream(self._globalStreamName).random();
      };
    },

    uninstallGlobalMathRandom() {
      if (this._origMathRandom) {
        Math.random = this._origMathRandom;
      }
    },

    isGlobalMathRandomInstalled() {
      return !!this._origMathRandom && Math.random !== this._origMathRandom;
    },

    getState() {
      const streams = {};
      for (const [name, stream] of this._streams.entries()) {
        streams[name] = stream.getState();
      }
      return {
        baseSeed: this._baseSeed >>> 0,
        streams,
        globalMathRandom: {
          enabled: this.isGlobalMathRandomInstalled(),
          streamName: this._globalStreamName || "global",
        },
      };
    },

    setState(state) {
      const payload = (state && typeof state === "object") ? state : {};
      this._baseSeed = Number(payload.baseSeed) >>> 0;
      this._streams.clear();
      const rawStreams = (payload.streams && typeof payload.streams === "object") ? payload.streams : {};
      for (const [name, streamState] of Object.entries(rawStreams)) {
        const key = String(name || "default");
        const mixedSeed = (this._baseSeed ^ fnv1a(key) ^ 0x85ebca6b) >>> 0;
        this._streams.set(key, new SeededStream(mixedSeed, streamState));
      }
      const globalMathRandom = (payload.globalMathRandom && typeof payload.globalMathRandom === "object")
        ? payload.globalMathRandom
        : {};
      if (globalMathRandom.enabled) this.installGlobalMathRandom(globalMathRandom.streamName || "global");
      else this.uninstallGlobalMathRandom();
    },
  };

  function namedRandom(seedRuntime, streamName) {
    if (!seedRuntime || typeof seedRuntime.stream !== "function") return Math.random();
    return seedRuntime.stream(streamName || "default").random();
  }

  return {
    DEFAULT_NONZERO_SEED,
    fnv1a,
    SeededStream,
    SeededRNG,
    namedRandom,
  };
});
