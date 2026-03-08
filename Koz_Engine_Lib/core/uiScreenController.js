(function initUIScreenControllerLib(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createUIScreenControllerApi() {
  class UIScreenController {
    constructor(logger = console) {
      this.screens = {};
      this.activeScreens = new Set();
      this.currentState = null;
      this._fadeTimers = {};
      this._logger = logger;
    }

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
      };
    }

    _cancelFade(name) {
      if (this._fadeTimers[name]) {
        clearTimeout(this._fadeTimers[name]);
        delete this._fadeTimers[name];
      }
    }

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

    _ensureInitialized(name) {
      const screen = this.screens[name];
      if (!screen || screen.initialized) return screen;
      screen.container = screen.create();
      screen.initialized = true;
      return screen;
    }

    onStateChange(newState) {
      this.currentState = newState;
      for (const name in this.screens) {
        const screen = this.screens[name];
        const shouldBeVisible = screen.validStates.includes(newState);
        if (shouldBeVisible) {
          this._cancelFade(name);
          this._ensureInitialized(name);
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

    hideScreen(name) {
      const screen = this.screens[name];
      if (!screen || !screen.container) return;
      this._cancelFade(name);
      this._safeCall("hide", name, () => screen.hide());
      screen.container.hide();
      this.activeScreens.delete(name);
    }

    showScreen(name) {
      const screen = this.screens[name];
      if (!screen) return;
      this._cancelFade(name);
      this._ensureInitialized(name);
      screen.container.show();
      const ok = this._safeCall("show", name, () => screen.show());
      if (ok === null) {
        screen.container.hide();
        return;
      }
      this.activeScreens.add(name);
    }

    hideAll() {
      for (const name of [...this.activeScreens]) this.hideScreen(name);
      this.activeScreens.clear();
    }

    updateAll() {
      const active = [...this.activeScreens];
      for (const name of active) {
        const screen = this.screens[name];
        if (!screen || !screen.update) continue;
        this._safeCall("update", name, () => screen.update());
      }
    }
  }

  return { UIScreenController };
});
