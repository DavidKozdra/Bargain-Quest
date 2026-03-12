// EspionageSystem.js — Hire spies, gather intel, sabotage enemy cities
// Stored on cityManagement.espionage (instance)

class EspionageSystem {
  static SPY_COST = 300;
  static MAX_SPIES = 5;
  static MISSION_TYPES = {
    intel: {
      name: "Gather Intel",
      emoji: "🔍",
      desc: "Scout city stats, prices, military strength.",
      days: 3,
      risk: 0.10,
    },
    sabotageFood: {
      name: "Poison Wells",
      emoji: "☠️",
      desc: "Destroy target city's food supply.",
      days: 5,
      risk: 0.25,
    },
    sabotageGold: {
      name: "Rob Treasury",
      emoji: "💸",
      desc: "Steal gold from the target city's budget.",
      days: 5,
      risk: 0.30,
    },
    inciteRiots: {
      name: "Incite Riots",
      emoji: "🔥",
      desc: "Cause unrest, reducing happiness and population.",
      days: 4,
      risk: 0.20,
    },
    counterEspionage: {
      name: "Counter-Intel",
      emoji: "🛡️",
      desc: "Protect your city from enemy spy operations.",
      days: 0, // passive
      risk: 0,
    },
  };

  constructor() {
    this.spies = [];        // { id, state, targetCity, mission, departDay, returnDay, caught }
    this.counterActive = false;
    this.intel = {};        // { cityName: { day, population, budget, military, topItems } }
    this._nextSpyId = 1;
  }

  hireSpy(budget) {
    if (this.spies.length >= EspionageSystem.MAX_SPIES) return { ok: false, msg: `Max ${EspionageSystem.MAX_SPIES} spies.` };
    if (budget < EspionageSystem.SPY_COST) return { ok: false, msg: `Need ${EspionageSystem.SPY_COST}g to hire a spy.` };
    this.spies.push({
      id: this._nextSpyId++,
      state: "idle",  // idle, deployed, returning, caught
      targetCity: null,
      mission: null,
      departDay: 0,
      returnDay: 0,
      caught: false,
    });
    return { ok: true, cost: EspionageSystem.SPY_COST, msg: "Spy recruited and ready for orders." };
  }

  getIdleSpies() {
    return this.spies.filter(s => s.state === "idle");
  }

  getDeployedSpies() {
    return this.spies.filter(s => s.state === "deployed");
  }

  /** Send a spy on a mission */
  deploySpy(spyId, targetCityName, missionKey, day) {
    const spy = this.spies.find(s => s.id === spyId);
    if (!spy || spy.state !== "idle") return { ok: false, msg: "Spy not available." };
    const mission = EspionageSystem.MISSION_TYPES[missionKey];
    if (!mission) return { ok: false, msg: "Unknown mission type." };

    if (missionKey === "counterEspionage") {
      this.counterActive = true;
      spy.state = "deployed";
      spy.mission = missionKey;
      spy.targetCity = null;
      spy.departDay = day;
      spy.returnDay = 0; // indefinite
      return { ok: true, msg: "Counter-espionage activated. Spy is guarding your city." };
    }

    if (!targetCityName) return { ok: false, msg: "Choose a target city." };

    spy.state = "deployed";
    spy.targetCity = targetCityName;
    spy.mission = missionKey;
    spy.departDay = day;
    spy.returnDay = day + mission.days;
    spy.caught = false;
    return { ok: true, msg: `Spy deployed to ${targetCityName} on ${mission.name} mission. Returns in ${mission.days} days.` };
  }

  /** Recall a counter-espionage spy */
  recallSpy(spyId) {
    const spy = this.spies.find(s => s.id === spyId);
    if (!spy) return false;
    if (spy.mission === "counterEspionage") this.counterActive = false;
    spy.state = "idle";
    spy.mission = null;
    spy.targetCity = null;
    return true;
  }

  /** Dismiss a spy permanently */
  dismissSpy(spyId) {
    const idx = this.spies.findIndex(s => s.id === spyId);
    if (idx < 0) return false;
    if (this.spies[idx].mission === "counterEspionage") this.counterActive = false;
    this.spies.splice(idx, 1);
    return true;
  }

  /** Process daily: check returning spies, resolve missions */
  processDaily(day, allCities, myCity) {
    const results = [];
    for (const spy of this.spies) {
      if (spy.state !== "deployed" || spy.mission === "counterEspionage") continue;
      if (day < spy.returnDay) continue;

      const mission = EspionageSystem.MISSION_TYPES[spy.mission];
      if (!mission) { spy.state = "idle"; continue; }

      // Check if caught
      const targetCity = allCities.find(c => c.name === spy.targetCity);
      const caught = Math.random() < mission.risk;
      if (caught) {
        spy.caught = true;
        spy.state = "idle";
        spy.mission = null;
        results.push({ type: "caught", city: spy.targetCity, msg: `Spy caught in ${spy.targetCity}! Relations damaged.` });
        continue;
      }

      // Mission success
      spy.state = "idle";
      const missionKey = spy.mission;
      spy.mission = null;

      if (missionKey === "intel" && targetCity) {
        const military = targetCity.management?.units?.length || 0;
        const topItems = [];
        if (targetCity.inventory) {
          for (const [k, v] of targetCity.inventory) {
            if (v.quantity > 0) topItems.push({ name: k, qty: v.quantity });
          }
          topItems.sort((a, b) => b.qty - a.qty);
          topItems.length = Math.min(topItems.length, 5);
        }
        this.intel[spy.targetCity] = {
          day,
          population: targetCity.population,
          budget: targetCity.management?.budget || 0,
          military,
          topItems,
          reputation: targetCity.reputation,
        };
        results.push({ type: "intel", city: spy.targetCity, msg: `Intel gathered on ${spy.targetCity}.` });
      }

      if (missionKey === "sabotageFood" && targetCity) {
        const foodItems = ["Wheat", "Fish", "Bread", "SaltedFish"];
        let destroyed = 0;
        for (const item of foodItems) {
          const e = targetCity.inventory.get(item);
          if (e && e.quantity > 0) {
            const loss = Math.ceil(e.quantity * 0.4);
            e.quantity = Math.max(0, e.quantity - loss);
            destroyed += loss;
          }
        }
        results.push({ type: "sabotage", city: spy.targetCity, msg: `Poisoned wells in ${spy.targetCity}. ${destroyed} food destroyed.` });
      }

      if (missionKey === "sabotageGold" && targetCity?.management) {
        const stolen = Math.min(targetCity.management.budget, Math.floor(100 + Math.random() * 200));
        targetCity.management.budget -= stolen;
        if (myCity?.management) myCity.management.budget += stolen;
        results.push({ type: "sabotage", city: spy.targetCity, msg: `Robbed ${stolen}g from ${spy.targetCity}'s treasury.` });
      }

      if (missionKey === "inciteRiots" && targetCity) {
        const popLoss = Math.ceil(targetCity.population * 0.03);
        targetCity.population = Math.max(50, targetCity.population - popLoss);
        if (typeof targetCity.adjustReputation === "function") targetCity.adjustReputation(-5);
        results.push({ type: "sabotage", city: spy.targetCity, msg: `Riots in ${spy.targetCity}! -${popLoss} pop, -5 rep.` });
      }
    }
    return results;
  }

  /** Check if our city blocks an incoming spy attempt (counter-espionage) */
  blockIncomingAttempt() {
    if (!this.counterActive) return false;
    return Math.random() < 0.60; // 60% block chance
  }

  getIntel(cityName) {
    return this.intel[cityName] || null;
  }

  toJSON() {
    return {
      spies: this.spies.map(s => ({ ...s })),
      counterActive: this.counterActive,
      intel: { ...this.intel },
      _nextSpyId: this._nextSpyId,
    };
  }

  static fromJSON(data) {
    const e = new EspionageSystem();
    if (!data) return e;
    e.spies = Array.isArray(data.spies) ? data.spies.map(s => ({ ...s })) : [];
    e.counterActive = !!data.counterActive;
    e.intel = (data.intel && typeof data.intel === "object") ? { ...data.intel } : {};
    e._nextSpyId = Math.max(1, Number(data._nextSpyId) || 1);
    return e;
  }
}

window.EspionageSystem = EspionageSystem;
