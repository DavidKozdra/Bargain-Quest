(function initUIScreenControllerLib(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createUIScreenControllerApi() {
/**
 * Manages UI screen lifecycle: registration, showing, hiding, and state-based visibility.
 * Handles lazy initialization, fade timers, and error-safe callbacks.
 */
class UIScreenController {
  /**
   * Creates a new UIScreenController.
   * @param {Object} [logger=console] - Logger for error reporting
   */
  constructor(logger = console) {
      this.screens = {};
      this.activeScreens = new Set();
      this.currentState = null;
      this._fadeTimers = {};
      this._logger = logger;
    }

    _hasUsableContainer(container) {
      return !!container
        && typeof container.show === "function"
        && typeof container.hide === "function";
    }

    /**
     * Registers a screen with lifecycle callbacks.
     * @param {string} name - Unique screen identifier
     * @param {Object} spec - Screen specification
     * @param {Function} [spec.create] - Returns container element
     * @param {Function} [spec.show] - Called when screen becomes visible
     * @param {Function} [spec.hide] - Called when screen is hidden
     * @param {Function} [spec.update] - Called each frame for active screens
     * @param {Array} [spec.validStates=[]] - Game states where screen is visible
     */
    registerScreen(name, spec) {
      const s = spec || {};
      this.screens[name] = {
        initialized: false,
        container: null,
        create: s.create,
        show: s.show || function () {},
        hide: s.hide || function () {},
        update: s.update || function () {},
        validStates: Array.isArray(s.validStates) ? s.validStates : [],
        excludeWhen: (typeof s.excludeWhen === "function") ? s.excludeWhen : null,
      };
    }

    /**
     * Returns true when a screen is excluded by its exclusion rule.
     * @param {string} name - Screen name
     * @param {Object} screen - Screen descriptor
     * @param {string} state - Current game state
     * @returns {boolean}
     * @private
     */
    _isExcluded(name, screen, state) {
      if (!screen || typeof screen.excludeWhen !== "function") return false;
      const result = this._safeCall("excludeWhen", name, () => screen.excludeWhen({
        state,
        currentState: this.currentState,
        screenName: name,
      }));
      return !!result;
    }

    /**
     * Cancels any pending fade timer for a screen.
     * @param {string} name - Screen name
     * @private
     */
    _cancelFade(name) {
      if (this._fadeTimers[name]) {
        clearTimeout(this._fadeTimers[name]);
        delete this._fadeTimers[name];
      }
    }

    /**
     * Schedules a screen to fade hide after a delay.
     * @param {string} name - Screen name
     * @param {number} delay - Delay in milliseconds
     */
    scheduleFadeHide(name, delay) {
      this._cancelFade(name);
      const ms = Number(delay) || 200;
      const screen = this.screens[name];
      if (!screen || !screen.container) return;
      this._fadeTimers[name] = setTimeout(() => {
        screen.container.hide();
        delete this._fadeTimers[name];
      }, ms);
    }

    /**
     * Safely executes a callback with error handling.
     * @param {string} phase - Phase name (show, hide, update)
     * @param {string} name - Screen name
     * @param {Function} fn - Function to execute
     * @returns {*} Result of function, or null on error
     * @private
     */
    _safeCall(phase, name, fn) {
      try {
        return fn();
      } catch (err) {
        if (this._logger && typeof this._logger.error === "function") {
          this._logger.error(`[UIScreenController] ${phase}() failed for "${name}":`, err);
        }
        return null;
      }
    }

    /**
     * Ensures a screen is initialized (lazy initialization).
     * @param {string} name - Screen name
     * @returns {Object} Screen object
     * @private
     */
    _ensureInitialized(name) {
      const screen = this.screens[name];
      if (!screen || screen.initialized) return screen;
      const container = this._safeCall("create", name, () => screen.create());
      if (!this._hasUsableContainer(container)) {
        if (this._logger && typeof this._logger.error === "function") {
          this._logger.error(`[UIScreenController] create() for "${name}" must return a container with show()/hide().`);
        }
        screen.container = null;
        screen.initialized = false;
        return null;
      }
      screen.container = container;
      screen.initialized = true;
      return screen;
    }

    /**
     * Called when game state changes. Updates screen visibility based on validStates.
     * @param {string} newState - The new game state
     */
    onStateChange(newState) {
      this.currentState = newState;
      for (const name in this.screens) {
        const screen = this.screens[name];
        const shouldBeVisible = screen.validStates.includes(newState) && !this._isExcluded(name, screen, newState);
        if (shouldBeVisible) {
          this._cancelFade(name);
          const initialized = this._ensureInitialized(name);
          if (!initialized || !initialized.container) continue;
          screen.container.show();
          const ok = this._safeCall("show", name, () => screen.show());
          if (ok === null) {
            screen.container.hide();
            continue;
          }
          this.activeScreens.add(name);
        } else if (screen.initialized) {
          this._safeCall("hide", name, () => screen.hide());
          if (!this._fadeTimers[name]) screen.container.hide();
          this.activeScreens.delete(name);
        }
      }
    }

    /**
     * Hides a specific screen.
     * @param {string} name - Screen name to hide
     */
    hideScreen(name) {
      const screen = this.screens[name];
      if (!screen || !screen.container) return;
      this._cancelFade(name);
      this._safeCall("hide", name, () => screen.hide());
      screen.container.hide();
      this.activeScreens.delete(name);
    }

    /**
     * Shows a specific screen.
     * @param {string} name - Screen name to show
     */
    showScreen(name) {
      const screen = this.screens[name];
      if (!screen) return;
      const state = this.currentState;
      if (state != null && !screen.validStates.includes(state)) return;
      if (state != null && this._isExcluded(name, screen, state)) return;
      this._cancelFade(name);
      const initialized = this._ensureInitialized(name);
      if (!initialized || !initialized.container) return;
      screen.container.show();
      const ok = this._safeCall("show", name, () => screen.show());
      if (ok === null) {
        screen.container.hide();
        return;
      }
      this.activeScreens.add(name);
    }

    /**
     * Hides all active screens.
     */
    hideAll() {
      for (const name of [...this.activeScreens]) this.hideScreen(name);
      this.activeScreens.clear();
    }

    /**
     * Updates all active screens.
     */
    updateAll() {
      const active = [...this.activeScreens];
      for (const name of active) {
        const screen = this.screens[name];
        if (!screen || !screen.update) continue;
        if (!screen.validStates.includes(this.currentState) || this._isExcluded(name, screen, this.currentState)) {
          this.hideScreen(name);
          continue;
        }
        this._safeCall("update", name, () => screen.update());
      }
    }
  }

  return { UIScreenController };
});
