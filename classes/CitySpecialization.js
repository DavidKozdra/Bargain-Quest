// CitySpecialization.js — Choose 1 of 4 city paths with tier progression
// Stored on city.management.specialization = { path: key, tier: 0-2 }

class CitySpecialization {
  static PATHS = {
    tradingHub: {
      name: "Trading Hub",
      emoji: "🏪",
      desc: "Master of commerce. Better prices, caravan bonuses, market intel.",
      tiers: [
        { name: "Market Town",    pop: 250, bonus: { tradeIncome: 0.10, happiness: 2 }, desc: "+10% trade route income" },
        { name: "Trade Center",   pop: 500, bonus: { tradeIncome: 0.20, happiness: 3, priceIntel: true }, desc: "+20% trade income, see price spreads" },
        { name: "Grand Exchange", pop: 800, bonus: { tradeIncome: 0.35, happiness: 5, caravanBonus: true }, desc: "+35% trade income, free caravans" },
      ],
    },
    militaryFortress: {
      name: "Military Fortress",
      emoji: "🏰",
      desc: "Impregnable defense. Cheaper units, raider bounties, walls bonus.",
      tiers: [
        { name: "Garrison Town",  pop: 250, bonus: { defense: 0.15, unitCostMult: 0.85, happiness: 1 }, desc: "+15% defense, -15% unit costs" },
        { name: "Stronghold",     pop: 500, bonus: { defense: 0.30, unitCostMult: 0.70, unitCap: 4, happiness: 2 }, desc: "+30% defense, +4 unit cap" },
        { name: "Citadel",        pop: 800, bonus: { defense: 0.50, unitCostMult: 0.55, unitCap: 8, raiderBounty: true, happiness: 3 }, desc: "+50% defense, raider bounties" },
      ],
    },
    culturalCenter: {
      name: "Cultural Center",
      emoji: "🎭",
      desc: "Arts and festivals. Maximum happiness, tourism income, reputation.",
      tiers: [
        { name: "Arts District",   pop: 250, bonus: { happiness: 8, reputation: 0.2 }, desc: "+8 happiness, +rep/day" },
        { name: "Cultural Haven",  pop: 500, bonus: { happiness: 14, reputation: 0.4, tourism: 30 }, desc: "+14 happiness, 30g/day tourism" },
        { name: "Wonder City",     pop: 800, bonus: { happiness: 22, reputation: 0.6, tourism: 80, popGrowth: 0.02 }, desc: "+22 happiness, 80g/day tourism" },
      ],
    },
    productionPowerhouse: {
      name: "Production Powerhouse",
      emoji: "⚒️",
      desc: "Industrial might. Faster crafting, new recipes, bulk output.",
      tiers: [
        { name: "Workshop Town",    pop: 250, bonus: { prodChance: 0.10, happiness: 1 }, desc: "+10% production chance" },
        { name: "Industrial City",  pop: 500, bonus: { prodChance: 0.20, prodDouble: 0.15, happiness: 2 }, desc: "+20% prod chance, 15% double output" },
        { name: "Manufacturing Hub", pop: 800, bonus: { prodChance: 0.35, prodDouble: 0.30, newRecipes: true, happiness: 3 }, desc: "+35% prod, 30% double, new recipes" },
      ],
    },
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
    if (data && typeof data === "object" && data.path && CitySpecialization.PATHS[data.path]) {
      city.management.specialization = { path: data.path, tier: Math.max(0, Number(data.tier) || 0) };
    } else {
      city.management.specialization = null;
    }
  }
}

window.CitySpecialization = CitySpecialization;
