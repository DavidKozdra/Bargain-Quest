(function initGameStateManagerLib(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.BQLib = root.BQLib || {};
    root.BQLib.core = root.BQLib.core || {};
    root.BQLib.core.gameStateManager = api;
    if (typeof root.GameStateManager !== "function") {
      root.GameStateManager = api.GameStateManager;
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createGameStateManagerApi() {
  class GameStateManager {
    constructor() {
      this.states = {};
      this.currentState = null;
      this.changeListeners = [];
      this.prev = null;
      this.allowedTransitions = null;
    }

    setTransitionRules(map) {
      this.allowedTransitions = {};
      for (const [from, toList] of Object.entries(map)) {
        this.allowedTransitions[from] = new Set(toList);
      }
    }

    addState(name, { onEnter = () => {}, onExit = () => {} } = {}) {
      this.states[name] = { onEnter, onExit };
    }

    setState(newState) {
      if (!this.states[newState]) {
        console.warn(`State "${newState}" not defined`);
        return;
      }

      const oldState = this.currentState;
      if (oldState === newState) return;

      if (this.allowedTransitions) {
        const wildcard = this.allowedTransitions["*"];
        const fromSet = oldState ? this.allowedTransitions[oldState] : null;
        const allowed = (wildcard && wildcard.has(newState)) || (fromSet && fromSet.has(newState));
        if (!allowed) {
          console.warn(`Blocked transition: "${oldState}" → "${newState}" (not allowed)`);
          return;
        }
      }

      this.prev = oldState;
      if (oldState && this.states[oldState].onExit) {
        try {
          this.states[oldState].onExit();
        } catch (err) {
          console.error(`[GameState] onExit failed for "${oldState}":`, err);
        }
      }

      this.currentState = newState;

      if (this.states[newState].onEnter) {
        try {
          this.states[newState].onEnter();
        } catch (err) {
          console.error(`[GameState] onEnter failed for "${newState}":`, err);
        }
      }

      const listeners = [...this.changeListeners];
      listeners.forEach((cb) => {
        try {
          cb(oldState, newState);
        } catch (err) {
          console.error(`[GameState] onChange listener failed for "${oldState}" -> "${newState}":`, err);
        }
      });
    }

    getState() {
      return this.currentState;
    }

    is(state) {
      return this.currentState === state;
    }

    onChange(callback) {
      if (typeof callback === "function") {
        this.changeListeners.push(callback);
      }
    }

    clearChangeListeners() {
      this.changeListeners = [];
    }
  }

  return { GameStateManager };
});
