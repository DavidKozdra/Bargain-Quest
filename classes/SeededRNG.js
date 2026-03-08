// SeededRNG.js — deterministic random streams for reproducible generation + runtime.

(function initBQSeededRNG(globalScope) {
  const DEFAULT_NONZERO_SEED = 0x9e3779b9;

  function fnv1a(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  class SeededStream {
    constructor(seed, state) {
      this._seed = (seed >>> 0) || DEFAULT_NONZERO_SEED;
      this._state = (state !== undefined ? Number(state) : this._seed) >>> 0;
      if (this._state === 0) this._state = DEFAULT_NONZERO_SEED;
    }
    random() {
      let s = this._state >>> 0;
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      this._state = (s >>> 0) || DEFAULT_NONZERO_SEED;
      return this._state / 4294967296;
    }
    int(min, max) {
      const lo = Math.floor(Math.min(min, max));
      const hi = Math.floor(Math.max(min, max));
      return lo + Math.floor(this.random() * (hi - lo + 1));
    }
    chance(p) { return this.random() < p; }
    pick(arr) {
      if (!Array.isArray(arr) || arr.length === 0) return undefined;
      return arr[Math.floor(this.random() * arr.length)];
    }
    shuffle(list) {
      const a = Array.isArray(list) ? list.slice() : [];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        const t = a[i];
        a[i] = a[j];
        a[j] = t;
      }
      return a;
    }
    getState() { return this._state >>> 0; }
    setState(state) {
      this._state = Number(state) >>> 0;
      if (this._state === 0) this._state = DEFAULT_NONZERO_SEED;
    }
  }

  const BQSeededRNG = {
    _baseSeed: 0,
    _streams: new Map(),
    _origMathRandom: null,
    _globalStreamName: 'global',

    startRun(seed, opts = {}) {
      this._baseSeed = (Number(seed) >>> 0);
      this._streams.clear();
      const installGlobal = opts.installGlobalMathRandom !== false;
      if (installGlobal) this.installGlobalMathRandom(opts.globalStreamName || 'global');
      else this.uninstallGlobalMathRandom();
    },

    stream(name) {
      const key = String(name || 'default');
      let s = this._streams.get(key);
      if (!s) {
        const mixed = (this._baseSeed ^ fnv1a(key) ^ 0x85ebca6b) >>> 0;
        s = new SeededStream(mixed);
        this._streams.set(key, s);
      }
      return s;
    },

    installGlobalMathRandom(streamName = 'global') {
      if (!this._origMathRandom) this._origMathRandom = Math.random;
      this._globalStreamName = String(streamName || 'global');
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
          streamName: this._globalStreamName || 'global',
        },
      };
    },

    setState(state) {
      const payload = (state && typeof state === 'object') ? state : {};
      this._baseSeed = Number(payload.baseSeed) >>> 0;
      this._streams.clear();
      const rawStreams = (payload.streams && typeof payload.streams === 'object') ? payload.streams : {};
      for (const [name, streamState] of Object.entries(rawStreams)) {
        const key = String(name || 'default');
        const mixed = (this._baseSeed ^ fnv1a(key) ^ 0x85ebca6b) >>> 0;
        const s = new SeededStream(mixed, streamState);
        this._streams.set(key, s);
      }
      const gm = (payload.globalMathRandom && typeof payload.globalMathRandom === 'object')
        ? payload.globalMathRandom
        : {};
      if (gm.enabled) this.installGlobalMathRandom(gm.streamName || 'global');
      else this.uninstallGlobalMathRandom();
    },
  };

  globalScope.BQSeededRNG = BQSeededRNG;
  globalScope.BQRandom = function BQRandom(streamName) {
    if (!globalScope.BQSeededRNG) return Math.random();
    return globalScope.BQSeededRNG.stream(streamName || 'default').random();
  };
})(typeof window !== 'undefined' ? window : globalThis);
