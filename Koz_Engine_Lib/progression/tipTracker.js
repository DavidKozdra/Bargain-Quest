(function initTipTrackerLib(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createTipTrackerApi() {
  class TipTracker {
    constructor(options = {}) {
      this._storage = options.storage || null;
      this._storageKey = String(options.storageKey || "tip_tracker");
      this._shown = new Set();
      this._enabled = options.enabled !== false;
      this._load();
    }

    _load() {
      if (!this._storage || typeof this._storage.getItem !== "function") return;
      try {
        const raw = this._storage.getItem(this._storageKey);
        const arr = JSON.parse(raw || "[]");
        if (Array.isArray(arr)) this._shown = new Set(arr);
      } catch (_e) {
        this._shown = new Set();
      }
    }

    _save() {
      if (!this._storage || typeof this._storage.setItem !== "function") return;
      try {
        this._storage.setItem(this._storageKey, JSON.stringify([...this._shown]));
      } catch (_e) {
        // ignore storage failures
      }
    }

    shouldShow(id, opts = {}) {
      if (!this._enabled) return false;
      if (opts.force) return true;
      return !this._shown.has(id);
    }

    markShown(id) {
      this._shown.add(id);
      this._save();
    }

    markMany(ids) {
      if (!Array.isArray(ids)) return;
      for (const id of ids) this._shown.add(id);
      this._save();
    }

    hasShown(id) {
      return this._shown.has(id);
    }

    reset() {
      this._shown.clear();
      this._enabled = true;
      if (this._storage && typeof this._storage.removeItem === "function") {
        this._storage.removeItem(this._storageKey);
      }
    }

    getProgress(total) {
      return { shown: this._shown.size, total: Number(total) || 0 };
    }

    get enabled() { return this._enabled; }
    set enabled(v) { this._enabled = !!v; }
  }

  return { TipTracker };
});
