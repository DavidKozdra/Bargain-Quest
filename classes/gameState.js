class GameStateManager {
    constructor() {
        this.states = {};
        this.currentState = null;
        this.changeListeners = []; 
        this.prev = null;
        // Allowed transitions: key = fromState, value = Set of valid toStates
        // null key = transitions allowed from any state (e.g. initial setup)
        this.allowedTransitions = null; // null = permissive (no rules)
    }

    /**
     * Define which state transitions are legal.
     * @param {Object<string, string[]>} map  e.g. { "mainMenu": ["newGameConfig","playing"], ... }
     *        Use the special key "*" to mean "from any state".
     */
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

        // Validate transition if rules are defined
        if (this.allowedTransitions) {
            const wildcard = this.allowedTransitions["*"];
            const fromSet  = oldState ? this.allowedTransitions[oldState] : null;
            const allowed  = (wildcard && wildcard.has(newState)) ||
                             (fromSet  && fromSet.has(newState));
            if (!allowed) {
                console.warn(`Blocked transition: "${oldState}" → "${newState}" (not allowed)`);
                return;
            }
        }

        this.prev = oldState;
        if (oldState && this.states[oldState].onExit) {
            this.states[oldState].onExit();
        }

        this.currentState = newState;

        if (this.states[newState].onEnter) {
            this.states[newState].onEnter();
        }

        // Trigger global listeners
        this.changeListeners.forEach((cb) => {
            cb(oldState, newState);
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
