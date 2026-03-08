(function initNotificationCenterLib(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.BQLib = root.BQLib || {};
    root.BQLib.ui = root.BQLib.ui || {};
    root.BQLib.ui.notificationCenter = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createNotificationCenterApi() {
  const DEFAULT_COLORS = {
    error: "#b71c1c",
    success: "#388e3c",
    warning: "#f57c00",
    holiday: "#caa350",
    info: "#333",
  };

  function getNotificationColor(type, palette) {
    var p = palette || DEFAULT_COLORS;
    return p[type] || p.info || "#333";
  }

  class NotificationCenter {
    constructor(options) {
      const opts = options || {};
      this.maxNotifications = Math.max(1, Number(opts.maxNotifications) || 5);
      this._now = typeof opts.now === "function" ? opts.now : function defaultNow() { return Date.now(); };
      this._setTimer = typeof opts.setTimer === "function"
        ? opts.setTimer
        : function defaultSetTimer(fn, ms) { return globalThis.setTimeout(fn, ms); };
      this._clearTimer = typeof opts.clearTimer === "function"
        ? opts.clearTimer
        : function defaultClearTimer(id) { return globalThis.clearTimeout(id); };
      this._seq = 0;
      this._entries = [];
      this._timers = new Map();
    }

    enqueue(payload, onExpire) {
      const data = payload || {};
      const duration = Math.max(0, Number(data.duration) || 5000);
      const entry = {
        id: "note-" + this._now() + "-" + (++this._seq),
        message: String(data.message || ""),
        type: String(data.type || "info"),
        duration: duration,
        action: data.action || null,
        createdAt: this._now(),
      };

      this._entries.push(entry);

      var dropped = null;
      if (this._entries.length > this.maxNotifications) {
        dropped = this._entries.shift();
        this.dismiss(dropped.id, "overflow");
      }

      const timerId = this._setTimer(() => {
        this.dismiss(entry.id, "timeout");
        if (typeof onExpire === "function") onExpire(entry);
      }, duration);
      this._timers.set(entry.id, timerId);

      return { entry: entry, dropped: dropped };
    }

    dismiss(id) {
      const timerId = this._timers.get(id);
      if (timerId) {
        this._clearTimer(timerId);
        this._timers.delete(id);
      }
      this._entries = this._entries.filter(function keepEntry(entry) {
        return entry.id !== id;
      });
    }

    has(id) {
      return this._entries.some(function isMatch(entry) {
        return entry.id === id;
      });
    }

    list() {
      return this._entries.slice();
    }
  }

  return {
    DEFAULT_COLORS: DEFAULT_COLORS,
    getNotificationColor: getNotificationColor,
    NotificationCenter: NotificationCenter,
  };
});
