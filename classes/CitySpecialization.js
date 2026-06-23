// CitySpecialization.js — Choose 1 of 5 city paths with tier progression
// Stored on city.management.specialization = { path: key, tier: 0-2 }

class CitySpecialization {
  static PATHS = {
    tradeHub: {
      name: "Trade Hub",
      emoji: "\uD83C\uDFEA",
      atlasFrame: "trader",
      desc: "Master of commerce. Better prices, caravan bonuses, market intel.",
      tiers: [
        { name: "Market Town",    pop: 250, bonus: { tradeIncome: 0.10, happiness: 2 }, desc: "+10% trade route income" },
        { name: "Trade Center",   pop: 500, bonus: { tradeIncome: 0.20, happiness: 3, priceIntel: true }, desc: "+20% trade income, see price spreads" },
        { name: "Grand Exchange", pop: 800, bonus: { tradeIncome: 0.35, happiness: 5, caravanBonus: true }, desc: "+35% trade income, free caravans" },
      ],
    },
    navalPort: {
      name: "Naval Port",
      emoji: "\u2693",
      atlasFrame: "sloop",
      desc: "Harbor supremacy. Cheaper travel, route income, port defense.",
      tiers: [
        { name: "Fishing Harbor",  pop: 250, bonus: { travelCostMult: -0.10, happiness: 2 }, desc: "-10% travel cost" },
        { name: "Trade Port",      pop: 500, bonus: { travelCostMult: -0.20, routeIncome: 0.15, happiness: 3, dockSpeed: true }, desc: "-20% travel, +15% route income" },
        { name: "Grand Admiralty",  pop: 800, bonus: { travelCostMult: -0.30, routeIncome: 0.25, happiness: 5, fleetCap: 2, portDefense: true }, desc: "-30% travel, +fleet cap, port cannons" },
      ],
    },
    scienceCity: {
      name: "Science City",
      emoji: "\uD83D\uDD2C",
      atlasFrame: "Chart",
      desc: "Knowledge hub. Faster research, lab bonuses, space program edge.",
      tiers: [
        { name: "Academy Town",   pop: 250, bonus: { researchGain: 3, happiness: 2 }, desc: "+3 research/day" },
        { name: "Research Campus", pop: 500, bonus: { researchGain: 6, happiness: 3, labOutput: true, researchDiscount: 0.10 }, desc: "+6 research/day, -10% research gold cost" },
        { name: "Innovation Hub",  pop: 800, bonus: { researchGain: 10, happiness: 5, labOutput: true, researchDiscount: 0.20, spaceResearchBonus: true }, desc: "+10 research/day, -20% cost, space bonus" },
      ],
    },
    militaryFortress: {
      name: "Military Fortress",
      emoji: "\uD83C\uDFF0",
      atlasFrame: "Shield",
      desc: "Impregnable defense. Cheaper units, raider bounties, walls bonus.",
      tiers: [
        { name: "Garrison Town",  pop: 250, bonus: { defense: 0.15, unitCostMult: 0.85, happiness: 1 }, desc: "+15% defense, -15% unit costs" },
        { name: "Stronghold",     pop: 500, bonus: { defense: 0.30, unitCostMult: 0.70, unitCap: 4, happiness: 2 }, desc: "+30% defense, +4 unit cap" },
        { name: "Citadel",        pop: 800, bonus: { defense: 0.50, unitCostMult: 0.55, unitCap: 8, raiderBounty: true, happiness: 3 }, desc: "+50% defense, raider bounties" },
      ],
    },
    blackMarketCity: {
      name: "Black Market City",
      emoji: "\uD83D\uDDE1\uFE0F",
      atlasFrame: "Dagger",
      desc: "Underworld capital. Smuggling, espionage, and covert income.",
      tiers: [
        { name: "Thieves' Quarter",  pop: 250, bonus: { smuggleProtect: 0.20, happiness: 1, covertIncome: 10 }, desc: "+20% smuggling protection, 10g/day covert" },
        { name: "Shadow Market",     pop: 500, bonus: { smuggleProtect: 0.35, happiness: 2, covertIncome: 25, spyDefense: 0.15 }, desc: "+35% smuggle protect, 25g/day, spy defense" },
        { name: "Crime Syndicate",   pop: 800, bonus: { smuggleProtect: 0.50, happiness: 3, covertIncome: 50, spyDefense: 0.30, blackMarketTier: 3 }, desc: "+50% smuggle, 50g/day, tier-3 black market" },
      ],
    },
  };

  // Legacy path key mapping (old saves → new keys)
  static LEGACY_PATH_MAP = {
    tradingHub: 'tradeHub',
    culturalCenter: 'scienceCity',
    productionPowerhouse: 'navalPort',
    // militaryFortress stays the same
  };

  static canChoose(city) {
    return city && city.population >= 250 && !city.management?.specialization?.path;
  }

  static choose(city, pathKey) {
    if (!city?.management) return false;
    if (!CitySpecialization.PATHS[pathKey]) return false;
    if (city.management.specialization?.path) return false; // already chosen
    if (city.population < 250) return false;
    city.management.specialization = { path: pathKey, tier: 0 };
    return true;
  }

  static getPath(city) {
    const spec = city?.management?.specialization;
    if (!spec?.path) return null;
    return CitySpecialization.PATHS[spec.path] || null;
  }

  static getTier(city) {
    return city?.management?.specialization?.tier ?? -1;
  }

  static getCurrentTierDef(city) {
    const path = CitySpecialization.getPath(city);
    const tier = CitySpecialization.getTier(city);
    if (!path || tier < 0) return null;
    return path.tiers[tier] || null;
  }

  static getNextTierDef(city) {
    const path = CitySpecialization.getPath(city);
    const tier = CitySpecialization.getTier(city);
    if (!path) return null;
    return path.tiers[tier + 1] || null;
  }

  /** Check and auto-advance tier based on population */
  static checkAdvancement(city) {
    const spec = city?.management?.specialization;
    if (!spec?.path) return false;
    const path = CitySpecialization.PATHS[spec.path];
    if (!path) return false;
    const nextTier = spec.tier + 1;
    if (nextTier >= path.tiers.length) return false;
    if (city.population >= path.tiers[nextTier].pop) {
      spec.tier = nextTier;
      return true;
    }
    return false;
  }

  /** Get a specific bonus value, summing current tier's bonuses */
  static getBonus(city, bonusKey) {
    const tierDef = CitySpecialization.getCurrentTierDef(city);
    if (!tierDef) return 0;
    return tierDef.bonus[bonusKey] || 0;
  }

  /** Has a specific boolean bonus (like priceIntel, caravanBonus, etc.) */
  static hasBonus(city, bonusKey) {
    const tierDef = CitySpecialization.getCurrentTierDef(city);
    return !!(tierDef?.bonus[bonusKey]);
  }

  /** Happiness bonus from specialization */
  static getHappinessBonus(city) {
    return CitySpecialization.getBonus(city, "happiness");
  }

  /** Daily tourism income */
  static getTourismIncome(city) {
    return CitySpecialization.getBonus(city, "tourism");
  }

  /** Unit cap bonus */
  static getUnitCapBonus(city) {
    return CitySpecialization.getBonus(city, "unitCap");
  }

  /** Production chance bonus */
  static getProdChanceBonus(city) {
    return CitySpecialization.getBonus(city, "prodChance");
  }

  /** Chance to double production output */
  static getProdDoubleChance(city) {
    return CitySpecialization.getBonus(city, "prodDouble");
  }

  static toJSON(city) {
    return city?.management?.specialization || null;
  }

  static fromJSON(city, data) {
    if (!city?.management) return;
    if (data && typeof data === "object" && data.path) {
      // Handle legacy path keys from old saves
      let pathKey = data.path;
      if (!CitySpecialization.PATHS[pathKey] && CitySpecialization.LEGACY_PATH_MAP[pathKey]) {
        pathKey = CitySpecialization.LEGACY_PATH_MAP[pathKey];
      }
      if (CitySpecialization.PATHS[pathKey]) {
        city.management.specialization = { path: pathKey, tier: Math.max(0, Number(data.tier) || 0) };
      } else {
        city.management.specialization = null;
      }
    } else {
      city.management.specialization = null;
    }
  }
}

window.CitySpecialization = CitySpecialization;
