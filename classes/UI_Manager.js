class UIManager {
    constructor() {
        this.screens = {};
        this.activeScreens = new Set();
        this.currentState = null;
        this._fadeTimers = {};  // screen name → setTimeout id, cancelled on show
    }

    registerScreen(name, { create, show = () => {}, hide = () => {}, update = () => {}, validStates = [] }) {
        this.screens[name] = {
            initialized: false,
            container: null,
            create,
            show,
            hide,
            update,
            validStates
        };
    }

    /** Cancel any pending fade-out timer for a screen */
    _cancelFade(name) {
        if (this._fadeTimers[name]) {
            clearTimeout(this._fadeTimers[name]);
            delete this._fadeTimers[name];
        }
    }

    /** Schedule a delayed hide for a screen's container (for fade animations) */
    scheduleFadeHide(name, delay = 200) {
        this._cancelFade(name);
        const screen = this.screens[name];
        if (!screen || !screen.container) return;
        this._fadeTimers[name] = setTimeout(() => {
            screen.container.hide();
            delete this._fadeTimers[name];
        }, delay);
    }

    onGameStateChange(newState) {
        this.currentState = newState;

        for (const name in this.screens) {
            const screen = this.screens[name];
            const shouldBeVisible = screen.validStates.includes(newState);

            if (shouldBeVisible) {
                // Cancel any pending fade-out from a rapid hide→show cycle
                this._cancelFade(name);

                if (!screen.initialized) {
                    screen.container = screen.create();
                    screen.initialized = true;
                }

                screen.container.show();
                try {
                    screen.show();
                } catch (err) {
                    console.error(`[UIManager] show() failed for "${name}":`, err);
                    screen.container.hide();
                    continue;
                }
                this.activeScreens.add(name);
            } else if (screen.initialized) {
                screen.hide();
                // Don't immediately hide container — let hide() set opacity for fade,
                // then scheduleFadeHide will do the actual hide after delay
                // If the hide() doesn't use fade, container is hidden immediately
                if (!this._fadeTimers[name]) {
                    screen.container.hide();
                }
                this.activeScreens.delete(name);
            }
        }
    }

    hideAll() {
        for (const name of this.activeScreens) {
            this.hideScreen(name);
        }
        this.activeScreens.clear();
    }

    hideScreen(name) {
        const screen = this.screens[name];
        if (screen && screen.container) {
            this._cancelFade(name);
            screen.hide();
            screen.container.hide();
            this.activeScreens.delete(name);
        }
    }

    /** Show a registered screen by name (creates if needed) */
    showScreen(name) {
        const screen = this.screens[name];
        if (!screen) return;
        this._cancelFade(name);
        if (!screen.initialized) {
            screen.container = screen.create();
            screen.initialized = true;
        }
        screen.container.show();
        try {
            screen.show();
        } catch (err) {
            console.error(`[UIManager] show() failed for "${name}":`, err);
            screen.container.hide();
            return;
        }
        this.activeScreens.add(name);
    }

    // 🔄 Add this: called from draw() or game loop
    updateAll() {
        for (const name of this.activeScreens) {
            const screen = this.screens[name];
            if (screen.update) {
                screen.update();
            }
        }
    }
}
