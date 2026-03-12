// CityPolicies.js — Toggleable city policies with meaningful trade-offs
// Stored on city.management.policies = { [policyKey]: boolean }

class CityPolicies {
  static DEFS = {
    openBorders: {
      name: "Open Borders",
      emoji: "🌐",
      desc: "Free movement boosts trade but attracts raiders.",
      effects: { tradeIncome: 0.15, raiderThreat: 0.20, happiness: 3 },
      dailyCost: 0,
      conflicts: ["martialLaw"],
    },
    martialLaw: {
      name: "Martial Law",
      emoji: "⚔️",
      desc: "Military control. Strong defense, crushed morale.",
      effects: { defense: 0.30, happiness: -12, tradeIncome: -0.10 },
      dailyCost: 40,
      conflicts: ["openBorders", "culturalFunding"],
    },
    taxHoliday: {
      name: "Tax Holiday",
      emoji: "🎉",
      desc: "Suspend taxes. Population booms, treasury doesn't.",
      effects: { taxOverride: 0, happiness: 15, popGrowth: 0.02 },
      dailyCost: 0,
      conflicts: [],
    },
    subsidizedFood: {
      name: "Subsidized Food",
      emoji: "🍞",
      desc: "Government-funded meals. Happy people, costly program.",
      effects: { happiness: 8, popGrowth: 0.01, foodSaving: 0.30 },
      dailyCost: 60,
      conflicts: [],
    },
    conscription: {
      name: "Conscription",
      emoji: "🪖",
      desc: "Draft citizens into service. Cheap units, unhappy people.",
      effects: { unitCostMult: 0.60, happiness: -8, popGrowth: -0.01 },
      dailyCost: 20,
      conflicts: ["culturalFunding"],
    },
    freeMarket: {
      name: "Free Market",
      emoji: "💰",
      desc: "Deregulated trade. Maximum profit, volatile prices.",
      effects: { tradeIncome: 0.25, priceVolatility: 0.15, happiness: -3 },
      dailyCost: 0,
      conflicts: ["tradeEmbargo"],
    },
    culturalFunding: {
      name: "Cultural Funding",
      emoji: "🎭",
      desc: "Arts and festivals. Boosts morale and reputation.",
      effects: { happiness: 10, reputation: 0.3 },
      dailyCost: 50,
      conflicts: ["martialLaw", "conscription"],
    },
    fortifyWalls: {
      name: "Fortify Walls",
      emoji: "🏰",
      desc: "Extra garrison patrols. Deters raiders but costs upkeep.",
      effects: { defense: 0.20, raiderThreat: -0.15 },
      dailyCost: 35,
      conflicts: [],
    },
  };

  static getActive(city) {
    return city?.management?.policies || {};
  }

  static isActive(city, key) {
    return !!(city?.management?.policies?.[key]);
  }

  static toggle(city, key) {
    if (!city?.management || !CityPolicies.DEFS[key]) return false;
    if (!city.management.policies) city.management.policies = {};
    const turning_on = !city.management.policies[key];
    if (turning_on) {
      // Deactivate conflicts
      const conflicts = CityPolicies.DEFS[key].conflicts || [];
      for (const c of conflicts) city.management.policies[c] = false;
    }
    city.management.policies[key] = turning_on;
    return turning_on;
  }

  /** Total daily upkeep cost for all active policies */
  static getDailyCost(city) {
    const active = CityPolicies.getActive(city);
    let cost = 0;
    for (const [k, on] of Object.entries(active)) {
      if (on && CityPolicies.DEFS[k]) cost += CityPolicies.DEFS[k].dailyCost || 0;
    }
    return cost;
  }

  /** Sum a specific effect across all active policies */
  static getEffect(city, effectKey) {
    const active = CityPolicies.getActive(city);
    let total = 0;
    for (const [k, on] of Object.entries(active)) {
      if (on && CityPolicies.DEFS[k]?.effects?.[effectKey] != null) {
        total += CityPolicies.DEFS[k].effects[effectKey];
      }
    }
    return total;
  }

  /** Check if tax holiday is active (overrides tax rate to 0) */
  static hasTaxOverride(city) {
    return CityPolicies.isActive(city, "taxHoliday");
  }

  /** Process daily policy costs — deduct from budget */
  static processDailyCosts(city) {
    const cost = CityPolicies.getDailyCost(city);
    if (cost > 0 && city.management) {
      city.management.budget = Math.max(0, (city.management.budget || 0) - cost);
    }
    // Cultural funding reputation drip
    if (CityPolicies.isActive(city, "culturalFunding") && typeof city.adjustReputation === "function") {
      city.adjustReputation(0.3);
    }
    return cost;
  }

  /** Happiness contribution from all active policies */
  static getHappinessBonus(city) {
    return CityPolicies.getEffect(city, "happiness");
  }

  /** Food consumption multiplier (1.0 = normal, lower = saving) */
  static getFoodConsumptionMult(city) {
    const saving = CityPolicies.getEffect(city, "foodSaving");
    return Math.max(0.3, 1.0 - saving);
  }

  /** Unit cost multiplier from policies */
  static getUnitCostMult(city) {
    const mult = CityPolicies.getEffect(city, "unitCostMult");
    return mult > 0 ? mult : 1.0;
  }

  /** Trade income multiplier */
  static getTradeIncomeMult(city) {
    return 1.0 + CityPolicies.getEffect(city, "tradeIncome");
  }

  /** Defense bonus from policies */
  static getDefenseBonus(city) {
    return CityPolicies.getEffect(city, "defense");
  }

  /** Population growth modifier */
  static getPopGrowthBonus(city) {
    return CityPolicies.getEffect(city, "popGrowth");
  }

  static toJSON(city) {
    return city?.management?.policies || {};
  }

  static fromJSON(city, data) {
    if (!city?.management) return;
    city.management.policies = {};
    if (data && typeof data === "object") {
      for (const [k, v] of Object.entries(data)) {
        if (CityPolicies.DEFS[k]) city.management.policies[k] = !!v;
      }
    }
  }
}

window.CityPolicies = CityPolicies;
