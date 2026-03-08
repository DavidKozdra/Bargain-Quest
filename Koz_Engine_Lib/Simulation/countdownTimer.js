(function initCountdownTimerLib(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createCountdownTimerApi() {
  class CountdownTimer {
    constructor(nowFn) {
      this._now = typeof nowFn === "function" ? nowFn : Date.now;
      this._timeoutId = null;
      this._deadline = 0;
    }

    start(seconds, onExpire) {
      this.clear();
      const s = Math.max(0, Number(seconds) || 0);
      this._deadline = this._now() + (s * 1000);
      this._timeoutId = setTimeout(() => {
        this._timeoutId = null;
        this._deadline = 0;
        if (typeof onExpire === "function") onExpire();
      }, s * 1000);
    }

    clear() {
      if (this._timeoutId) {
        clearTimeout(this._timeoutId);
        this._timeoutId = null;
      }
      this._deadline = 0;
    }

    remainingSeconds() {
      if (!this._deadline) return 0;
      return Math.max(0, Math.ceil((this._deadline - this._now()) / 1000));
    }
  }

  return { CountdownTimer };
});
