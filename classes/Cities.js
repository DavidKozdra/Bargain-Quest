function _bqCityStream() {
  if (typeof window !== 'undefined' && window.BQSeededRNG && typeof window.BQSeededRNG.stream === 'function') {
    return window.BQSeededRNG.stream('city:worldgen');
  }
  return null;
}
function _bqCityRand() {
  const s = _bqCityStream();
  return s ? s.random() : Math.random();
}
function _bqCityShuffle(arr) {
  const s = _bqCityStream();
  if (s && typeof s.shuffle === 'function') return s.shuffle(arr);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(_bqCityRand() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

function _bqOwnershipLib() {
  if (typeof window === 'undefined') return null;
  return window.BQAdapters?.bargainQuest?.cityOwnership || null;
}

function _bqCityRoot() {
  if (typeof window !== 'undefined') return window;
  if (typeof globalThis !== 'undefined') return globalThis;
  return null;
}

function _bqCityActiveWarStatus() {
  const root = _bqCityRoot();
  const session = typeof root?.BQGetWorldSession === 'function' ? root.BQGetWorldSession() : null;
  const nodeKey = session?.spaceContext?.nodeKey;
  const bearEmpire = typeof root?.BQGetBearEmpireSystem === 'function' ? root.BQGetBearEmpireSystem() : null;
  if (!nodeKey || !bearEmpire || typeof bearEmpire.getSystemStatus !== 'function') return null;
  return bearEmpire.getSystemStatus(nodeKey) || null;
}

function _bqCityWarAlignment() {
  const root = _bqCityRoot();
  const bearEmpire = typeof root?.BQGetBearEmpireSystem === 'function' ? root.BQGetBearEmpireSystem() : null;
  return (bearEmpire && typeof bearEmpire.alignment === 'string') ? bearEmpire.alignment : 'neutral';
}

function _bqCityActiveSpaceContext() {
  const root = _bqCityRoot();
  const session = typeof root?.BQGetWorldSession === 'function' ? root.BQGetWorldSession() : null;
  return session?.sessionType === 'planet_surface' ? (session.spaceContext || null) : null;
}

function _bqCitySpaceMarketMultiplier(itemKey, isSelling) {
  const root = _bqCityRoot();
  if (typeof root?.BQGetSpaceMarketPriceMultiplier !== 'function') return 1;
  const multiplier = Number(root.BQGetSpaceMarketPriceMultiplier(itemKey, isSelling, _bqCityActiveSpaceContext()));
  return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
}

const _BQ_RESISTANCE_SUPPLY_ITEMS = new Set(['Tools', 'Iron', 'Wheat', 'Fish', 'Herbs', 'Wood', 'Bread', 'Salt']);

function _bqSpaceCatalog() {
  return [
    {
      key: 'luna',
      name: 'Luna Station',
      biome: 'orbital',
      travelCost: 250,
      researchCost: 0,
      description: 'A quiet moon hub with rare ore and dependable trade lanes.',
      goods: ['MoonOre', 'StellarGlass'],
      alienPresence: 'low',
      alienTone: 'curious',
      alienText: 'Moon traders buy refined goods and pay well for tools and food.',
    },
    {
      key: 'aurelia',
      name: 'Aurelia Bloom',
      biome: 'lush',
      travelCost: 420,
      researchCost: 60,
      description: 'A living planet with alien fiber markets and botanical vaults.',
      goods: ['XenoFiber', 'Spices'],
      alienPresence: 'medium',
      alienTone: 'friendly',
      alienText: 'The Aurelians trade through barter and reward patient negotiations.',
    },
    {
      key: 'vanta',
      name: 'Vanta Rift',
      biome: 'hazard',
      travelCost: 760,
      researchCost: 140,
      description: 'A hostile world full of relic caches, smugglers, and unstable ruins.',
      goods: ['AlienRelic', 'StellarGlass'],
      alienPresence: 'high',
      alienTone: 'hostile',
      alienText: 'Vanta raiders attack the unprepared, but their ruins hold the best loot.',
    },
  ];
}

// ── Branch-based Tech Tree Catalog ──────────────────────
// Each node: { key, label, description, branch, researchCost, goldCost, requires[], unlocks[], effect }
// "requires" lists node keys from this branch or cross-branch prerequisites.
// "effect" is a descriptor applied on completion (keyed bonuses, flag unlocks, etc.).
const _BQ_TECH_TREE = {
  // ── Commerce ──
  commerce: [
    { key: 'com_stock_depth',       label: 'Stock Depth',         description: 'Markets carry more goods per restock cycle.',       branch: 'commerce', researchCost: 12, goldCost: 100, requires: [],                      unlocks: ['+20% restock quantity'],    effect: { restockMult: 0.20 } },
    { key: 'com_demand_forecast',   label: 'Demand Forecasting',  description: 'Predict what traders will want before they arrive.', branch: 'commerce', researchCost: 25, goldCost: 200, requires: ['com_stock_depth'],      unlocks: ['Price trend visibility'],   effect: { priceIntel: true } },
    { key: 'com_tariff_efficiency', label: 'Tariff Efficiency',   description: 'Collect more from trade taxes with fewer complaints.', branch: 'commerce', researchCost: 40, goldCost: 350, requires: ['com_demand_forecast'],  unlocks: ['+15% trade tax income'],    effect: { tradeTaxBonus: 0.15 } },
    { key: 'com_barter_leverage',   label: 'Barter Leverage',     description: 'Better buy and sell prices at home and abroad.',     branch: 'commerce', researchCost: 60, goldCost: 500, requires: ['com_tariff_efficiency'], unlocks: ['+10% buy/sell margin'],     effect: { barterMargin: 0.10 } },
  ],
  // ── Infrastructure ──
  infrastructure: [
    { key: 'inf_treasury_flow',     label: 'Treasury Throughput', description: 'Increase daily treasury collection efficiency.',      branch: 'infrastructure', researchCost: 12, goldCost: 120, requires: [],                       unlocks: ['+15% treasury income'],      effect: { treasuryMult: 0.15 } },
    { key: 'inf_district_plan',     label: 'District Planning',   description: 'Unlock efficient district layouts and effects.',      branch: 'infrastructure', researchCost: 25, goldCost: 220, requires: ['inf_treasury_flow'],    unlocks: ['+1 district slot'],          effect: { districtSlots: 1 } },
    { key: 'inf_construction_spd',  label: 'Construction Speed',  description: 'Buildings complete faster with organized labor.',     branch: 'infrastructure', researchCost: 40, goldCost: 380, requires: ['inf_district_plan'],    unlocks: ['-25% build time'],           effect: { buildTimeMult: -0.25 } },
    { key: 'inf_civil_engineering', label: 'Civil Engineering',   description: 'Unlock advanced structures and public works.',        branch: 'infrastructure', researchCost: 65, goldCost: 600, requires: ['inf_construction_spd'], unlocks: ['Advanced buildings', '+15% training speed'], effect: { advancedBuildings: true, unitTrainSpeed: 0.15 } },
  ],
  // ── Transport ──
  transport: [
    { key: 'trn_wagon_routes',   label: 'Wagon Routes',      description: 'Organize overland wagon lanes and freight teams between cities.', branch: 'transport', researchCost: 18, goldCost: 160, requires: ['inf_district_plan'], unlocks: ['Wagon Depot', '+25% convoy size'], effect: { convoyCapacityBonus: 0.25 } },
    { key: 'trn_freight_yards',  label: 'Freight Yards',     description: 'Stage cargo at depots so builders and merchants waste less time waiting.', branch: 'transport', researchCost: 36, goldCost: 320, requires: ['trn_wagon_routes'], unlocks: ['+20% convoy size', '+8% build speed'], effect: { convoyCapacityBonus: 0.20, buildSpeed: 0.08 } },
    { key: 'trn_motor_pool',     label: 'Motor Pool',        description: 'Introduce engines, service bays, and mechanized haulers for military and trade.', branch: 'transport', researchCost: 62, goldCost: 560, requires: ['trn_freight_yards', 'inf_civil_engineering'], unlocks: ['Motor Pool', '-20% travel time', '+20% training speed'], effect: { convoyCapacityBonus: 0.30, travelCostMult: -0.20, unitTrainSpeed: 0.20 } },
    { key: 'trn_rocket_logistics', label: 'Rocket Logistics', description: 'Coordinate fuel, parts, and launch supply chains from your transport hubs.', branch: 'transport', researchCost: 92, goldCost: 860, requires: ['trn_motor_pool', 'orb_launch_prep'], unlocks: ['+35% convoy size', '-15% travel time', 'Launch supply handling'], effect: { convoyCapacityBonus: 0.35, travelCostMult: -0.15, routeIncome: 0.08, spaceReadiness: 0.35 } },
  ],
  // ── Science ──
  science: [
    { key: 'sci_research_gen',    label: 'Research Generation',  description: 'Increase base research point output per day.',        branch: 'science', researchCost: 10,  goldCost: 100, requires: [],                      unlocks: ['+3 RP/day'],                 effect: { researchGain: 3 } },
    { key: 'sci_lab_output',      label: 'Lab Output',           description: 'Research labs produce more points and unlock school.', branch: 'science', researchCost: 25,  goldCost: 250, requires: ['sci_research_gen'],    unlocks: ['Research Lab', '+4 RP/day'], effect: { labBonus: 4, school: true } },
    { key: 'sci_unlock_discount', label: 'Unlock Discount',      description: 'Reduce gold cost of future research by 15%.',         branch: 'science', researchCost: 45,  goldCost: 400, requires: ['sci_lab_output'],      unlocks: ['-15% research gold cost'],   effect: { researchCostMult: -0.15 } },
    { key: 'sci_alien_analysis',  label: 'Alien Analysis',       description: 'Study alien artifacts to unlock xeno-trade.',         branch: 'science', researchCost: 80,  goldCost: 800, requires: ['sci_unlock_discount'], unlocks: ['Alien trade routes'],        effect: { alienAnalysis: true } },
  ],
  // ── Naval ──
  naval: [
    { key: 'nav_harbor_eff',     label: 'Harbor Efficiency',   description: 'Ships load and unload faster at your docks.',           branch: 'naval', researchCost: 12, goldCost: 100, requires: [],                    unlocks: ['-20% dock time'],           effect: { dockTimeMult: -0.20 } },
    { key: 'nav_travel_discount', label: 'Travel Discount',     description: 'Reduce sea and space travel costs.',                   branch: 'naval', researchCost: 25, goldCost: 200, requires: ['nav_harbor_eff'],   unlocks: ['-15% travel cost'],         effect: { travelCostMult: -0.15 } },
    { key: 'nav_fleet_upkeep',   label: 'Fleet Upkeep',        description: 'Lower daily maintenance cost for all ships.',           branch: 'naval', researchCost: 40, goldCost: 400, requires: ['nav_travel_discount'], unlocks: ['-20% fleet upkeep'],     effect: { fleetUpkeepMult: -0.20 } },
    { key: 'nav_port_defenses',  label: 'Port Defenses',       description: 'Arm your harbors against raiders and pirates.',         branch: 'naval', researchCost: 60, goldCost: 550, requires: ['nav_fleet_upkeep'], unlocks: ['Port cannons', '+defense'], effect: { portDefense: true, defense: 0.10 } },
  ],
  // ── Defense ──
  defense: [
    { key: 'def_walls',          label: 'City Walls',          description: 'Stone walls reduce raid damage significantly.',          branch: 'defense', researchCost: 15, goldCost: 150, requires: [],                    unlocks: ['+20% defense'],            effect: { defense: 0.20 } },
    { key: 'def_militia',        label: 'City Militia',        description: 'Train citizens to defend against small raids.',          branch: 'defense', researchCost: 30, goldCost: 300, requires: ['def_walls'],        unlocks: ['Militia units', '+20% training speed'], effect: { militia: true, unitCap: 2, unitTrainSpeed: 0.20 } },
    { key: 'def_garrison_regen', label: 'Garrison Regen',      description: 'Garrison heals faster between raids.',                  branch: 'defense', researchCost: 50, goldCost: 500, requires: ['def_militia'],      unlocks: ['+50% garrison regen', '+25% training speed'], effect: { garrisonRegenMult: 0.50, unitTrainSpeed: 0.25 } },
    { key: 'def_invasion_resist',label: 'Invasion Resistance', description: 'Major raids deal significantly less damage.',           branch: 'defense', researchCost: 75, goldCost: 750, requires: ['def_garrison_regen'], unlocks: ['-30% raid damage taken'], effect: { raidDamageMult: -0.30 } },
  ],
  // ── Covert ──
  covert: [
    { key: 'cov_smuggle_protect',  label: 'Smuggling Protection', description: 'Reduce losses from smuggling busts.',                branch: 'covert', researchCost: 15, goldCost: 120, requires: [],                       unlocks: ['-30% smuggling loss'],      effect: { smuggleLossMult: -0.30 } },
    { key: 'cov_espionage_defense',label: 'Espionage Defense',    description: 'Detect and block enemy spies more reliably.',         branch: 'covert', researchCost: 30, goldCost: 280, requires: ['cov_smuggle_protect'],  unlocks: ['+25% spy detection'],       effect: { spyDetection: 0.25 } },
    { key: 'cov_black_market',     label: 'Black Market Reach',   description: 'Extend black market access and better contraband.',   branch: 'covert', researchCost: 50, goldCost: 450, requires: ['cov_espionage_defense'], unlocks: ['Black market tier 2'],      effect: { blackMarketTier: 2 } },
    { key: 'cov_shadow_network',   label: 'Shadow Network',       description: 'Run a covert income stream from underworld contacts.',branch: 'covert', researchCost: 70, goldCost: 650, requires: ['cov_black_market'],      unlocks: ['Covert income/day'],        effect: { covertIncome: 25 } },
  ],
  // ── Orbital ──
  orbital: [
    { key: 'orb_launch_prep',    label: 'Launch Prep',         description: 'Design rockets, docking clamps, and launch crews.',     branch: 'orbital', researchCost: 30,  goldCost: 300,  requires: ['sci_lab_output'],      unlocks: ['Spaceport construction'],   effect: { spaceportReady: true } },
    { key: 'orb_fuel_efficiency', label: 'Orbital Handling',    description: 'Improve launch discipline and orbital maneuvering.',    branch: 'orbital', researchCost: 50,  goldCost: 500,  requires: ['orb_launch_prep'],     unlocks: ['Smoother space travel'],    effect: { fuelCostMult: -0.20 } },
    { key: 'orb_docking_rights',  label: 'Docking Rights',      description: 'Negotiate orbital docking clearance with stations.',    branch: 'orbital', researchCost: 80,  goldCost: 800,  requires: ['orb_fuel_efficiency'], unlocks: ['Station docking'],          effect: { dockingRights: true } },
    { key: 'orb_reentry_safety',  label: 'Re-entry Safety',     description: 'Safer atmospheric re-entry and landing protocols.',     branch: 'orbital', researchCost: 120, goldCost: 1200, requires: ['orb_docking_rights'],  unlocks: ['Planet landing clearance'], effect: { landingRights: true } },
  ],
};

// Legacy project key → new tech node mapping (for save migration)
const _BQ_LEGACY_PROJECT_MAP = {
  market_network:  'com_stock_depth',
  research_lab:    'sci_lab_output',
  orbital_program: 'orb_launch_prep',
  first_contact:   'sci_alien_analysis',
  xeno_exchange:   'orb_docking_rights',
};

class City {
  constructor({ name, location, population, stockProfile = "worldgen" }) {
    this.name = name;
    this.location = location;
    this.population = population;
    this.inventory = new Map();
    this.holidays = [];
    this.traders = {};
    this.reputation = 50; // 0–100 scale, 50 = Neutral
    this.indicators = [];
    this.priceHistory = {};
    this._priceHistorySampleDay = {};

    // 2D building sprites - pick a random city variant
    this.buildingVariant = Math.floor(_bqCityRand() * 4);
    this.stockedBooks = [];
    this.bookHolidays = [];
    this.stockedWeapons = [];
    this.hasGamblingDen = false;
    this.hasBank = false;
    this.hasBlackMarket = false;
    this.hasBountyBoard = false;
    this.hasWeaponShop = false;
    this.hasWinery = false;
    this.hasSchool = false;
    this.hasLibrary = false;
    this.hasUniversity = false;
    this.hasResearchLab = false;
    this.hasSpaceport = false;
    this.hasAlienExchange = false;

    // Production: cities can produce crafted goods from raw materials
    this.productionQueue = [];
    this.productionRecipes = {
      Bread:      { inputs: { Wheat: 3 }, output: "Bread", qty: 2, chance: 0.4 },
      Tools:      { inputs: { Iron: 2, Wood: 1 }, output: "Tools", qty: 1, chance: 0.3 },
      Pottery:    { inputs: { Clay: 2 }, output: "Pottery", qty: 1, chance: 0.35 },
      SaltedFish: { inputs: { Fish: 2, Salt: 1 }, output: "SaltedFish", qty: 2, chance: 0.3 },
      Wine:       { inputs: { Wheat: 4 }, output: "Wine", qty: 1, chance: 0.15 },
      Jewelry:    { inputs: { Iron: 3, Stone: 2 }, output: "Jewelry", qty: 1, chance: 0.1 },
    };

    // Counters maintained by Trader/Raider code — read by render() for O(1) badge display
    this.cityIndex = -1;          // set by buildCityLocationMap()
    this.dockedTraderCount = 0;   // incremented on arrive, decremented on depart

    this.generateHolidays();
    if (stockProfile === "worldgen") {
      this.stockBooks();
      this.generateCityFeatures();
    }
    // City-management defaults
    this.management = {
      budget: 0,
      taxRate: (window.DIFFICULTY_CONFIG && window.DIFFICULTY_CONFIG.taxRate) ? window.DIFFICULTY_CONFIG.taxRate : 0.05,
      buildingQueue: [],
      upgradeLevels: {},
      routes: [],
      units: [],
      ownerPayoutDue: 0,
      ownerTaxShare: 0.35,
      districts: {},
      districtEffects: {},
    };
    this.ownership = this._createOwnershipDeal();
    this.progression = this._createProgressionState();

    this._onDayChanged = () => {
      const prev = this.population;
      this.growPopulation();
      this._applyManagedBuildingProduction();
      this.restockInventory();
      this.runProduction();
      this._tickResearchProgression();
      // Restock weapons every 10 days if city has a weapon shop
      if (this.hasWeaponShop && typeof dayNight !== 'undefined' && dayNight.getDaysElapsed() % 10 === 0) {
        this.stockWeapons();
      }
      const delta = this.population - prev;
      const symbol = delta > 0 ? "+" : delta < 0 ? "-" : "=";
      this.spawnIndicator(symbol);
    };
    window.addEventListener("dayChanged", this._onDayChanged);

    if (stockProfile === "worldgen") {
      // Worldgen cities start stocked; founded settlements start lean.
      this._addOrIncrement("Wheat", Math.floor(_bqCityRand() * 35 + 5));
      this._addOrIncrement("Fish", Math.floor(_bqCityRand() * 20));
    }
  }

  /** Get the market value of the city (sum of all inventory item values) */
  getMarketValue() {
    let value = 0;
    for (const [key, entry] of this.inventory) {
      // Valuation should be read-only and difficulty-neutral (no trend mutation).
      value += this.calculateItemPrice(key, window.cities, false, {
        trackHistory: false,
        applyDifficultyMultipliers: false,
      }) * entry.quantity;
    }
    return value;
  }

  _getManagementEffect(effectKey) {
    if (!effectKey || !this.management || typeof this.management !== 'object') return 0;
    let total = Number(this.management.focusEffects?.[effectKey]) || 0;
    total += Number(this.management.districtEffects?.[effectKey]) || 0;
    total += Number(this.progression?.techEffects?.[effectKey]) || 0;
    const buffs = Array.isArray(this.management.operationBuffs) ? this.management.operationBuffs : [];
    let currentDay = null;
    if (typeof dayNight !== 'undefined' && dayNight && typeof dayNight.getDaysElapsed === 'function') {
      currentDay = Number(dayNight.getDaysElapsed());
    }
    for (const buff of buffs) {
      const expires = Number(buff?.expiresDay);
      if (currentDay != null && Number.isFinite(expires) && expires > 0 && currentDay > expires) continue;
      total += Number(buff?.effects?.[effectKey]) || 0;
    }
    return total;
  }

  static get NOBLE_NAMES() {
    return [
      "Lady Marrow", "Duke Thorne", "Magistrate Voss", "Baroness Keel",
      "Governor Flint", "Steward Hale", "Countess Vale", "Lord Ashford",
    ];
  }

  _createOwnershipDeal() {
    const ownerNames = City.NOBLE_NAMES;
    return {
      ownerName: ownerNames[Math.floor(_bqCityRand() * ownerNames.length)],
      offerAccepted: false,
      purchased: {
        bank: false,
        buildings: false,
        shop: false,
      },
      purchasePrice: 0,
      purchaseDay: -1,
      saleOffer: null,
      listedForSale: false,
      nextOfferDay: 0,
      lastSaleDay: -1,
    };
  }

  _ensureOwnershipDeal() {
    if (!this.ownership || typeof this.ownership !== 'object') {
      this.ownership = this._createOwnershipDeal();
    }
    if (!this.ownership.ownerName) this.ownership.ownerName = "City Council";
    if (typeof this.ownership.offerAccepted !== 'boolean') this.ownership.offerAccepted = false;
    if (!this.ownership.purchased || typeof this.ownership.purchased !== 'object') {
      this.ownership.purchased = { bank: false, buildings: false, shop: false };
    }
    this.ownership.purchased.bank = !!this.ownership.purchased.bank;
    this.ownership.purchased.buildings = !!this.ownership.purchased.buildings;
    this.ownership.purchased.shop = !!this.ownership.purchased.shop;
    // Deed-market fields (added with the flipping economy).
    this.ownership.purchasePrice = Math.max(0, Math.floor(Number(this.ownership.purchasePrice) || 0));
    this.ownership.purchaseDay = Number.isFinite(Number(this.ownership.purchaseDay)) ? Math.floor(Number(this.ownership.purchaseDay)) : -1;
    this.ownership.listedForSale = !!this.ownership.listedForSale;
    this.ownership.nextOfferDay = Math.max(0, Math.floor(Number(this.ownership.nextOfferDay) || 0));
    this.ownership.lastSaleDay = Number.isFinite(Number(this.ownership.lastSaleDay)) ? Math.floor(Number(this.ownership.lastSaleDay)) : -1;
    const offer = this.ownership.saleOffer;
    this.ownership.saleOffer = (offer && typeof offer === 'object'
      && typeof offer.buyerName === 'string' && offer.buyerName.trim()
      && Number.isFinite(Number(offer.amount)) && Number(offer.amount) > 0)
      ? {
          buyerName: offer.buyerName.trim(),
          amount: Math.max(1, Math.floor(Number(offer.amount))),
          createdDay: Math.max(0, Math.floor(Number(offer.createdDay) || 0)),
          expiresDay: Math.max(0, Math.floor(Number(offer.expiresDay) || 0)),
        }
      : null;
    return this.ownership;
  }

  /** Development score: landmark features + upgrade levels + district tiers.
   * Every improvement the owner makes feeds the city's appraised value. */
  getDevelopmentScore() {
    const features = [
      this.hasBank, this.hasGamblingDen, this.hasBountyBoard, this.hasWeaponShop,
      this.hasWinery, this.hasSchool, this.hasLibrary, this.hasUniversity,
      this.hasResearchLab, this.hasSpaceport,
    ].filter(Boolean).length;
    const upgrades = Object.values(this.management?.upgradeLevels || {})
      .reduce((sum, v) => sum + Math.max(0, Math.floor(Number(v) || 0)), 0);
    const districts = Object.values(this.management?.districts || {})
      .reduce((sum, v) => sum + Math.max(0, Math.floor(Number(v) || 0)), 0);
    return features + upgrades + districts;
  }

  /** Owner's expected daily payout at the current tax share (read-only). */
  estimateDailyOwnerPayout() {
    const share = Math.max(0.10, Math.min(0.80, Number(this.management?.ownerTaxShare) || 0.35));
    const { finalRevenue } = this.computeTaxRevenue(1);
    return Math.max(0, Math.floor(finalRevenue * share));
  }

  /** Condition report: how well-run the city is right now.
   * Multiplies the appraisal — distressed cities are cheap to buy ("fixer-uppers")
   * and well-run cities sell at a premium. */
  getConditionReport() {
    const { foodDays } = this.computeTaxRevenue(1);
    let happiness = null;
    const cm = (typeof window !== 'undefined') ? window.cityManagement : null;
    if (cm && typeof cm.getHappiness === 'function') {
      const h = Number(cm.getHappiness(this));
      if (Number.isFinite(h)) happiness = h;
    }
    if (happiness == null) {
      // Fallback estimate when the management controller isn't available.
      happiness = 50 + (foodDays >= 6 ? 8 : foodDays < 3 ? -14 : 0) + (this.hasWinery ? 4 : 0);
    }

    let mult = 1.0;
    mult += Math.max(-0.30, Math.min(0.15, (happiness - 55) * 0.006));
    mult += Math.max(-0.15, Math.min(0.12, ((Number(this.reputation) || 50) - 50) * 0.004));
    if (foodDays < 3) mult -= 0.15;
    else if (foodDays < 6) mult -= 0.07;
    else if (foodDays > 10) mult += 0.05;
    mult = Math.max(0.55, Math.min(1.30, mult));

    const label = mult <= 0.75 ? 'Distressed'
      : mult < 0.92 ? 'Run-down'
      : mult <= 1.08 ? 'Stable'
      : 'Prime';
    const tone = mult <= 0.75 ? '#ef5350'
      : mult < 0.92 ? '#ffb74d'
      : mult <= 1.08 ? '#d7e3f2'
      : '#81c784';
    return { multiplier: mult, label, tone, happiness: Math.round(happiness), foodDays, distressed: mult <= 0.75 };
  }

  /** Appraised deed value: what the city is worth to buy or sell.
   * income multiple + development + population, scaled by condition.
   * Replaces inventory-based getMarketValue() for ownership pricing so
   * improving a city raises its value (and draining the shop doesn't lower it). */
  getAppraisal() {
    const estDailyPayout = this.estimateDailyOwnerPayout();
    const condition = this.getConditionReport();
    const incomePart = estDailyPayout * 45;
    const developmentPart = this.getDevelopmentScore() * 150;
    const populationPart = Math.floor((Number(this.population) || 0) * 0.8);
    const value = Math.max(300, Math.floor((incomePart + developmentPart + populationPart) * condition.multiplier));
    return {
      value,
      estDailyPayout,
      condition,
      distressed: condition.distressed,
      parts: [
        { key: 'income', label: 'Income value', value: incomePart, note: `${estDailyPayout}g/day owner payout × 45` },
        { key: 'development', label: 'Development', value: developmentPart, note: `${this.getDevelopmentScore()} buildings, upgrades & districts × 150` },
        { key: 'population', label: 'Population', value: populationPart, note: `${this.population} citizens × 0.8` },
      ],
    };
  }

  getOwnershipStageCosts() {
    // Pricing is driven by the appraisal (income + development + population ×
    // condition), so fixer-uppers are genuinely cheap and improvements raise value.
    const appraisedValue = this.getAppraisal().value;
    const lib = _bqOwnershipLib();
    if (lib && typeof lib.getOwnershipStageCosts === 'function') {
      return lib.getOwnershipStageCosts({ marketValue: appraisedValue });
    }

    const base = Math.max(300, Math.floor(appraisedValue));
    return {
      bank: Math.min(20000, Math.max(200, Math.floor(base * 0.20))),
      buildings: Math.max(350, Math.floor(base * 0.35)),
      shop: Math.min(15000, Math.max(500, Math.floor(base * 0.45))),
    };
  }

  getOwnershipAcquisitionState(playerRef = null) {
    const deal = this._ensureOwnershipDeal();
    const isOwned = !!(playerRef && typeof playerRef.ownsCity === 'function' && playerRef.ownsCity(this));
    const charm = playerRef ? Math.round(Number(playerRef.bonusCharm) || 0) : 0;
    const hasNegotiationBonus = !!(playerRef?.modifiers?.negotiationDiscount > 0);
    const lib = _bqOwnershipLib();
    if (lib && typeof lib.getOwnershipAcquisitionState === 'function') {
      return lib.getOwnershipAcquisitionState({
        deal,
        isOwned,
        marketValue: this.getAppraisal().value,
        reputation: this.reputation,
        charm,
        hasNegotiationBonus,
      });
    }

    const costs = this.getOwnershipStageCosts();
    let stepKey = 'offer';
    if (deal.offerAccepted) stepKey = 'bank';
    if (deal.purchased.bank) stepKey = 'buildings';
    if (deal.purchased.buildings) stepKey = 'shop';
    if (deal.purchased.shop || isOwned) stepKey = 'complete';
    const cityRep = Math.round(Number(this.reputation) || 50);
    const discountBonus = hasNegotiationBonus ? 5 : 0;
    const offerRequirement = Math.max(35, 55 - Math.floor((cityRep - 50) / 2));
    const offerScore = cityRep + (charm * 5) + discountBonus;
    const progressCount = (deal.offerAccepted ? 1 : 0)
      + (deal.purchased.bank ? 1 : 0)
      + (deal.purchased.buildings ? 1 : 0)
      + (deal.purchased.shop ? 1 : 0);
    const labels = {
      offer: 'Convince Owner',
      bank: 'Buy City Bank',
      buildings: 'Buy Buildings',
      shop: 'Buy Main Shop',
    };
    return {
      isOwned,
      ownerName: deal.ownerName,
      stepKey,
      stepLabel: labels[stepKey] || 'Complete',
      cost: (stepKey === 'bank' || stepKey === 'buildings' || stepKey === 'shop') ? costs[stepKey] : 0,
      progressCount,
      progressTotal: 4,
      offerRequirement,
      offerScore,
      canOfferNow: offerScore >= offerRequirement,
    };
  }

  tryOwnershipOffer(playerRef) {
    const deal = this._ensureOwnershipDeal();
    const s = this.getOwnershipAcquisitionState(playerRef);
    if (s.stepKey !== 'offer') return { ok: false, reason: 'offer_not_needed' };
    if (!s.canOfferNow) return { ok: false, reason: 'offer_rejected', requirement: s.offerRequirement, score: s.offerScore };
    deal.offerAccepted = true;
    return { ok: true };
  }

  completeOwnershipStage(stageKey) {
    const deal = this._ensureOwnershipDeal();
    if (stageKey === 'bank' || stageKey === 'buildings' || stageKey === 'shop') {
      deal.purchased[stageKey] = true;
      return true;
    }
    return false;
  }

  _createProgressionState() {
    return {
      researchPoints: 0,
      completedProjects: [],
      unlockedProjects: [],
      activeProject: null,
      spaceProgram: false,
      spaceportBuilt: false,
      alienContact: false,
      planetVisits: [],
      researchFocus: 'trade',
      lastResearchTickDay: -1,
      lastSpaceStockDay: -1,

      // ── Branch-based tech tree ──
      techTree: {
        commerce:       { researched: [], queued: null },
        infrastructure: { researched: [], queued: null },
        science:        { researched: [], queued: null },
        naval:          { researched: [], queued: null },
      defense:        { researched: [], queued: null },
      covert:         { researched: [], queued: null },
      orbital:        { researched: [], queued: null },
      },
      techEffects: {},
      // ── Treasury permanent upgrades ──
      treasuryUpgrades: {},
      // ── Space access flags (promoted from ad-hoc bools) ──
      spaceAccess: {
        launchReady: false,
        dockingRights: false,
        landingRights: false,
        orbitClearance: false,
      },
      // ── Faction standing (alien + trade alliances) ──
      factionStanding: {},
    };
  }

  _ensureProgressionState() {
    if (!this.progression || typeof this.progression !== 'object') {
      this.progression = this._createProgressionState();
    }
    const prog = this.progression;
    if (!Array.isArray(prog.completedProjects)) prog.completedProjects = [];
    if (!Array.isArray(prog.unlockedProjects)) prog.unlockedProjects = [];
    if (!Array.isArray(prog.planetVisits)) prog.planetVisits = [];
    if (typeof prog.researchPoints !== 'number' || !Number.isFinite(prog.researchPoints)) prog.researchPoints = 0;
    if (typeof prog.activeProject !== 'string') prog.activeProject = null;
    if (typeof prog.researchFocus !== 'string') prog.researchFocus = 'trade';
    if (typeof prog.spaceProgram !== 'boolean') prog.spaceProgram = false;
    if (typeof prog.spaceportReady !== 'boolean') prog.spaceportReady = false;
    if (typeof prog.spaceportBuilt !== 'boolean') prog.spaceportBuilt = false;
    if (typeof prog.alienContact !== 'boolean') prog.alienContact = false;
    if (!Number.isFinite(Number(prog.lastResearchTickDay))) prog.lastResearchTickDay = -1;
    if (!Number.isFinite(Number(prog.lastSpaceStockDay))) prog.lastSpaceStockDay = -1;

    // Tech tree branches
    if (!prog.techTree || typeof prog.techTree !== 'object') {
      prog.techTree = this._createProgressionState().techTree;
    }
    for (const branch of City.TECH_BRANCHES) {
      if (!prog.techTree[branch] || typeof prog.techTree[branch] !== 'object') {
        prog.techTree[branch] = { researched: [], queued: null };
      }
      if (!Array.isArray(prog.techTree[branch].researched)) prog.techTree[branch].researched = [];
    }
    if (!prog.techEffects || typeof prog.techEffects !== 'object') prog.techEffects = {};

    // Treasury upgrades
    if (!prog.treasuryUpgrades || typeof prog.treasuryUpgrades !== 'object') prog.treasuryUpgrades = {};

    // Space access
    if (!prog.spaceAccess || typeof prog.spaceAccess !== 'object') {
      prog.spaceAccess = { launchReady: false, dockingRights: false, landingRights: false, orbitClearance: false };
    }

    // Faction standing
    if (!prog.factionStanding || typeof prog.factionStanding !== 'object') prog.factionStanding = {};

    this.hasSchool = !!this.hasSchool;
    this.hasLibrary = !!this.hasLibrary;
    this.hasUniversity = !!this.hasUniversity;
    this.hasResearchLab = !!this.hasResearchLab;
    this.hasSpaceport = !!this.hasSpaceport;
    this.hasAlienExchange = !!this.hasAlienExchange;
    return prog;
  }

  getResearchBreakdown() {
    const p = (typeof player !== 'undefined') ? player : null;
    const owned = !!(p && typeof p.ownsCity === 'function' && p.ownsCity(this));
    if (!owned) return {
      total: 0,
      parts: [{ key: 'ownership', label: 'Ownership required', value: 0, note: 'Only player-owned cities generate research.' }],
    };

    const parts = [];
    const addPart = (key, label, value, note = '') => {
      const resolved = Number(value) || 0;
      if (!resolved) return;
      parts.push({ key, label, value: resolved, note });
    };

    addPart('population', 'Population base', Math.max(1, Math.floor((this.population || 0) / 220)), 'Larger cities support more scholars.');
    addPart('school', 'School', this.hasSchool ? 2 : 0, 'Basic literacy and civic instruction.');
    addPart('library', 'Library', this.hasLibrary ? 3 : 0, 'Archives and book collections accelerate research.');
    addPart('university', 'University', this.hasUniversity ? 6 : 0, 'Scholars and advanced instruction raise output sharply.');
    addPart('lab', 'Research Lab', this.hasResearchLab ? 4 : 0, 'Dedicated experiments and applied science.');
    addPart('bank', 'Administrative support', this.hasBank ? 1 : 0, 'Treasury support helps keep scholars supplied.');
    addPart('districts', 'District bonuses', Math.max(0, Number(this.management?.districtEffects?.researchGain) || 0), 'City layout compounds research output.');
    addPart('science_city', 'Science city', (typeof CitySpecialization !== 'undefined' && typeof CitySpecialization.getBonus === 'function')
      ? Math.max(0, Number(CitySpecialization.getBonus(this, 'researchGain')) || 0)
      : 0, 'Specialization bonus from a knowledge-focused city.');
    addPart('sci_research_gen', 'Research Generation', this.hasTechNode('sci_research_gen') ? 3 : 0, 'Tech tree bonus to base research.');
    addPart('sci_lab_output', 'Lab Output', this.hasTechNode('sci_lab_output') ? 4 : 0, 'Tech tree bonus to scientific output.');

    return {
      total: Math.max(1, parts.reduce((sum, entry) => sum + entry.value, 0)),
      parts,
    };
  }

  getResearchIncome() {
    return this.getResearchBreakdown().total;
  }

  _tickResearchProgression() {
    const prog = this._ensureProgressionState();
    const today = (typeof dayNight !== 'undefined' && dayNight && typeof dayNight.getDaysElapsed === 'function')
      ? Number(dayNight.getDaysElapsed())
      : 0;
    if (prog.lastResearchTickDay === today) return;
    prog.lastResearchTickDay = today;
    const gain = this.getResearchIncome();
    if (gain > 0) {
      prog.researchPoints += gain;
      if (this._isManagedCity && typeof notificationManager !== 'undefined' && prog.spaceProgram) {
        notificationManager.log(`${this.name} generated ${gain} research points.`, 'info');
      }
    }
    this._applyResearchMarketStock();
  }

  _applyResearchMarketStock() {
    const prog = this._ensureProgressionState();
    const today = (typeof dayNight !== 'undefined' && dayNight && typeof dayNight.getDaysElapsed === 'function')
      ? Number(dayNight.getDaysElapsed())
      : 0;
    if (prog.lastSpaceStockDay === today) return;
    prog.lastSpaceStockDay = today;

    const addItems = (items, amount = 1) => {
      for (const itemKey of items) {
        if (ItemLibrary[itemKey]) this._addOrIncrement(itemKey, amount);
      }
    };

    // Check both legacy completedProjects and new tech tree nodes
    const hasNode = (key) => {
      if (prog.completedProjects.includes(key)) return true;
      for (const branch of City.TECH_BRANCHES) {
        if (prog.techTree[branch]?.researched?.includes(key)) return true;
      }
      return false;
    };

    if (hasNode('market_network') || hasNode('com_stock_depth')) {
      addItems(['Tools', 'Wine'], 1);
    }
    // Space-tagged items (MoonOre, StellarGlass, XenoFiber, AlienRelic) are NOT
    // stocked on Earth cities — they're only available on space planet markets.
    // Progression flags still track unlock state for space-side access.
    if (prog.alienContact || hasNode('sci_alien_analysis')) {
      this.hasAlienExchange = true;
    }
  }

  getProgressionProjects() {
    const prog = this._ensureProgressionState();
    const completed = new Set(prog.completedProjects);
    // Legacy linear projects (kept for backward compatibility with existing saves)
    const projects = [
      {
        key: 'market_network',
        label: 'Market Network',
        description: 'Set up a permanent research office and trading ledger.',
        researchCost: 15,
        goldCost: 150,
        requires: [],
        unlocks: ['Better city stock', '+1 research/day'],
        branch: 'legacy',
        onComplete: () => {
          this.hasSchool = true;
        },
      },
      {
        key: 'research_lab',
        label: 'Research Lab',
        description: 'Build a proper lab and keep your scholars working.',
        researchCost: 40,
        goldCost: 400,
        requires: ['market_network'],
        unlocks: ['+4 research/day', 'Space Program research'],
        branch: 'legacy',
        onComplete: () => {
          this.hasResearchLab = true;
        },
      },
      {
        key: 'orbital_program',
        label: 'Orbital Program',
        description: 'Design rockets, docking clamps, and launch crews.',
        researchCost: 120,
        goldCost: 1200,
        requires: ['research_lab'],
        unlocks: ['Spaceport', 'Planet travel'],
        branch: 'legacy',
        onComplete: () => {
          this.hasSpaceport = true;
          prog.spaceProgram = true;
          prog.spaceportBuilt = true;
          prog.spaceAccess.launchReady = true;
        },
      },
      {
        key: 'first_contact',
        label: 'First Contact',
        description: 'Learn how to speak with alien traders and delegates.',
        researchCost: 180,
        goldCost: 1800,
        requires: ['orbital_program'],
        unlocks: ['Alien trade', 'Planetary visitors'],
        branch: 'legacy',
        onComplete: () => {
          prog.alienContact = true;
          this.hasAlienExchange = true;
        },
      },
      {
        key: 'xeno_exchange',
        label: 'Xeno Exchange',
        description: 'Open a full space market with rare alien goods.',
        researchCost: 240,
        goldCost: 2600,
        requires: ['first_contact'],
        unlocks: ['Alien relics', 'Moon ore', 'Stellar glass'],
        branch: 'legacy',
        onComplete: () => {
          this.hasAlienExchange = true;
          prog.alienContact = true;
        },
      },
    ];

    return projects.map((project) => ({
      ...project,
      completed: completed.has(project.key),
      unlocked: project.requires.every((req) => completed.has(req)),
      canBuy: project.requires.every((req) => completed.has(req)) && !completed.has(project.key),
    }));
  }

  // ── Tech Tree API ─────────────────────────────────────

  /** Get all tech tree node definitions across all branches */
  static getTechTree() {
    return _BQ_TECH_TREE;
  }

  /** Get all nodes for a specific branch with their current status for this city */
  getTechBranch(branchKey) {
    const prog = this._ensureProgressionState();
    const defs = _BQ_TECH_TREE[branchKey];
    if (!defs) return [];
    const branchState = prog.techTree[branchKey] || { researched: [], queued: null };
    const researchedSet = new Set(branchState.researched);

    // Collect all researched nodes across ALL branches (for cross-branch prereqs)
    const allResearched = new Set();
    for (const b of City.TECH_BRANCHES) {
      for (const key of (prog.techTree[b]?.researched || [])) allResearched.add(key);
    }
    // Also count legacy completedProjects via mapping
    for (const legacyKey of prog.completedProjects) {
      const mapped = _BQ_LEGACY_PROJECT_MAP[legacyKey];
      if (mapped) allResearched.add(mapped);
    }

    return defs.map(node => ({
      ...node,
      researched: researchedSet.has(node.key),
      unlocked: node.requires.every(r => allResearched.has(r)),
      canResearch: node.requires.every(r => allResearched.has(r)) && !researchedSet.has(node.key),
      queued: branchState.queued === node.key,
    }));
  }

  /** Get a flat list of all tech nodes across all branches with status */
  getAllTechNodes() {
    const nodes = [];
    for (const branch of City.TECH_BRANCHES) {
      nodes.push(...this.getTechBranch(branch));
    }
    return nodes;
  }

  /** Check if a specific tech node has been researched in this city */
  hasTechNode(nodeKey) {
    const prog = this._ensureProgressionState();
    for (const branch of City.TECH_BRANCHES) {
      if (prog.techTree[branch]?.researched?.includes(nodeKey)) return true;
    }
    // Also check legacy mapping
    for (const [legacyKey, mappedKey] of Object.entries(_BQ_LEGACY_PROJECT_MAP)) {
      if (mappedKey === nodeKey && prog.completedProjects.includes(legacyKey)) return true;
    }
    return false;
  }

  /** Research (buy) a tech tree node. Returns { ok, node } or { ok: false, reason } */
  researchTechNode(nodeKey, playerRef = null) {
    const prog = this._ensureProgressionState();
    // Find the node definition
    let nodeDef = null;
    let branchKey = null;
    for (const b of City.TECH_BRANCHES) {
      const found = (_BQ_TECH_TREE[b] || []).find(n => n.key === nodeKey);
      if (found) { nodeDef = found; branchKey = b; break; }
    }
    if (!nodeDef) return { ok: false, reason: 'missing_node' };
    if (this.hasTechNode(nodeKey)) return { ok: false, reason: 'already_researched' };

    // Check prerequisites (cross-branch)
    const status = this.getTechBranch(branchKey).find(n => n.key === nodeKey);
    if (!status?.canResearch) return { ok: false, reason: 'locked' };

    const p = playerRef || (typeof player !== 'undefined' ? player : null);
    if (!(p && typeof p.ownsCity === 'function' && p.ownsCity(this))) return { ok: false, reason: 'not_owned' };

    // Apply discount from sci_unlock_discount if researched
    let goldCost = nodeDef.goldCost;
    if (this.hasTechNode('sci_unlock_discount')) {
      goldCost = Math.floor(goldCost * 0.85);
    }

    const hasGold = !!(p && typeof p.gold === 'number' && p.gold >= goldCost);
    if (!hasGold) return { ok: false, reason: 'insufficient_gold' };
    if ((prog.researchPoints || 0) < nodeDef.researchCost) return { ok: false, reason: 'insufficient_research' };

    if (typeof p.spendGold === 'function') p.spendGold(goldCost);
    else p.gold -= goldCost;
    prog.researchPoints -= nodeDef.researchCost;

    if (!prog.techTree[branchKey]) prog.techTree[branchKey] = { researched: [], queued: null };
    prog.techTree[branchKey].researched.push(nodeKey);
    prog.techTree[branchKey].queued = null;

    // Apply side-effects based on node key
    this._applyTechNodeEffects(nodeKey, nodeDef, prog);

    this._applyResearchMarketStock();
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`${this.name} researched ${nodeDef.label} [${branchKey}].`, 'success');
    }
    return { ok: true, node: nodeDef };
  }

  /** Apply gameplay side-effects when a tech node is completed */
  _applyTechNodeEffects(nodeKey, nodeDef, prog) {
    const eff = nodeDef.effect || {};
    const scalarKeys = [
      'buildSpeed',
      'unitCap',
      'unitCostDiscount',
      'defense',
      'taxIncome',
      'routeIncome',
      'tradeTaxBonus',
      'barterMargin',
      'restockMult',
      'convoyCapacityBonus',
      'travelCostMult',
      'dockTimeMult',
      'fleetUpkeepMult',
      'productionChance',
      'productionDouble',
      'unitTrainSpeed',
      'spaceReadiness',
      'researchGain',
      'foodSaving',
      'popGrowth',
    ];
    if (!prog.techEffects || typeof prog.techEffects !== 'object') prog.techEffects = {};
    for (const key of scalarKeys) {
      const value = Number(eff[key]) || 0;
      if (!value) continue;
      prog.techEffects[key] = Number(prog.techEffects[key] || 0) + value;
    }
    if (Number(eff.buildTimeMult) < 0) {
      prog.techEffects.buildSpeed = Number(prog.techEffects.buildSpeed || 0) + Math.abs(Number(eff.buildTimeMult) || 0);
    }
    if (Number(eff.treasuryMult) > 0) {
      prog.techEffects.taxIncome = Number(prog.techEffects.taxIncome || 0) + Number(eff.treasuryMult || 0);
    }
    // Science branch
    if (eff.school) this.hasSchool = true;
    if (eff.labBonus) this.hasResearchLab = true;
    if (eff.alienAnalysis) {
      prog.alienContact = true;
      this.hasAlienExchange = true;
    }
    // Orbital branch
    if (eff.spaceportReady) {
      prog.spaceProgram = true;
      prog.spaceportReady = true;
    }
    if (eff.dockingRights) {
      prog.spaceAccess.dockingRights = true;
    }
    if (eff.landingRights) {
      prog.spaceAccess.landingRights = true;
      prog.spaceAccess.orbitClearance = true;
    }
    // Defense branch
    if (eff.militia) {
      // militia flag for unit system integration
    }
    // Covert branch
    if (eff.blackMarketTier && eff.blackMarketTier >= 2) {
      this.hasBlackMarket = true;
    }
  }

  getProgressionState() {
    const prog = this._ensureProgressionState();
    const projects = this.getProgressionProjects();
    return {
      researchPoints: Math.max(0, Math.floor(prog.researchPoints || 0)),
      completedProjects: prog.completedProjects.slice(),
      activeProject: prog.activeProject,
      spaceProgram: !!prog.spaceProgram,
      spaceportReady: !!prog.spaceportReady,
      spaceportBuilt: !!prog.spaceportBuilt,
      alienContact: !!prog.alienContact,
      planetVisits: prog.planetVisits.slice(),
      researchFocus: prog.researchFocus,
      availableProjects: projects.filter((project) => project.canBuy),
      finishedProjects: projects.filter((project) => project.completed),
      spaceCatalog: City.getSpacePlanets(),
      // New tech tree state
      techTree: prog.techTree,
      techEffects: prog.techEffects,
      treasuryUpgrades: prog.treasuryUpgrades,
      spaceAccess: prog.spaceAccess,
      factionStanding: prog.factionStanding,
    };
  }

  buyResearchProject(projectKey, playerRef = null) {
    const prog = this._ensureProgressionState();
    const project = this.getProgressionProjects().find((entry) => entry.key === projectKey);
    if (!project) return { ok: false, reason: 'missing_project' };
    if (prog.completedProjects.includes(projectKey)) return { ok: false, reason: 'already_bought' };
    if (!project.requires.every((req) => prog.completedProjects.includes(req))) return { ok: false, reason: 'locked' };

    const p = playerRef || (typeof player !== 'undefined' ? player : null);
    if (!(p && typeof p.ownsCity === 'function' && p.ownsCity(this))) return { ok: false, reason: 'not_owned' };
    const hasGold = !!(p && typeof p.gold === 'number' && p.gold >= project.goldCost);
    if (!hasGold) return { ok: false, reason: 'insufficient_gold' };
    if ((prog.researchPoints || 0) < project.researchCost) return { ok: false, reason: 'insufficient_research' };

    if (typeof p.spendGold === 'function') p.spendGold(project.goldCost);
    else p.gold -= project.goldCost;
    prog.researchPoints -= project.researchCost;
    prog.completedProjects.push(project.key);
    prog.activeProject = project.key;
    if (typeof project.onComplete === 'function') project.onComplete();

    this._applyResearchMarketStock();
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`${this.name} completed ${project.label}.`, 'success');
    }
    return { ok: true, project };
  }

  unlockPlanet(planetKey, playerRef = null) {
    const prog = this._ensureProgressionState();
    const planet = City.getSpacePlanets().find((entry) => entry.key === planetKey);
    if (!planet) return { ok: false, reason: 'missing_planet' };
    if (!prog.spaceProgram || !prog.spaceportBuilt) return { ok: false, reason: 'space_unlocked' };
    const p = playerRef || (typeof player !== 'undefined' ? player : null);
    if (!(p && typeof p.ownsCity === 'function' && p.ownsCity(this))) return { ok: false, reason: 'not_owned' };
    if (prog.planetVisits.includes(planetKey)) return { ok: true, planet, alreadyVisited: true };
    const travelCost = Math.max(0, Math.floor(Number(planet.travelCost) || 0));
    const researchCost = Math.max(0, Math.floor(Number(planet.researchCost) || 0));
    if (p.gold < travelCost) return { ok: false, reason: 'insufficient_gold', needed: travelCost };
    if ((prog.researchPoints || 0) < researchCost) return { ok: false, reason: 'insufficient_research', needed: researchCost };
    if (travelCost > 0) {
      if (typeof p.spendGold === 'function') p.spendGold(travelCost);
      else p.gold -= travelCost;
    }
    prog.researchPoints -= researchCost;
    prog.planetVisits.push(planetKey);
    const upgrades = this.management?.upgradeLevels || {};
    const readiness = Math.max(0, Number(prog.techEffects?.spaceReadiness) || 0)
      + (this.hasResearchLab ? 0.1 : 0)
      + (this.hasUniversity ? 0.08 : 0)
      + (Math.max(0, Number(upgrades.wagonDepot) || 0) * 0.1)
      + (Math.max(0, Number(upgrades.motorPool) || 0) * 0.15);
    const rewardBonus = 1 + Math.max(0, Math.min(0.8, readiness));
    if (planet.goods && planet.goods.length > 0) {
      for (const itemKey of planet.goods) {
        if (ItemLibrary[itemKey]) {
          const baseQty = 1 + Math.floor(_bqCityRand() * 2);
          this._addOrIncrement(itemKey, Math.max(1, Math.floor(baseQty * rewardBonus)));
        }
      }
    }
    if (planet.alienTone === 'hostile' && p && typeof p.takeDamage === 'function') {
      p.takeDamage(1);
    }
    prog.alienContact = true;
    this.hasAlienExchange = true;
    this._applyResearchMarketStock();
    return { ok: true, planet };
  }

  static getSpacePlanets() {
    if (typeof window !== 'undefined' && typeof window.BQGetSpaceDestinationCatalog === 'function') {
      const dynamicCatalog = window.BQGetSpaceDestinationCatalog();
      if (Array.isArray(dynamicCatalog) && dynamicCatalog.length > 0) return dynamicCatalog;
    }
    return _bqSpaceCatalog();
  }

  static get TECH_BRANCHES() {
    return ['commerce', 'infrastructure', 'transport', 'science', 'naval', 'defense', 'covert', 'orbital'];
  }

  static get LEGACY_PROJECT_MAP() {
    return _BQ_LEGACY_PROJECT_MAP;
  }

  // === CITY MANAGEMENT HELPERS ===
  /** Read-only tax revenue estimate over a period. No state is mutated —
   * applyWeeklyTax() consumes this, and appraisal/ROI displays reuse it. */
  computeTaxRevenue(days = 7) {
    const taxRate = Math.max(0, Math.min(0.5, this.management?.taxRate ?? 0.05));
    const dayScale = Math.max(0, days / 7); // weekly baseline

    // Food security influences taxable activity and keeps starving cities from printing gold.
    const foodItems = ["Wheat", "Fish", "Bread", "SaltedFish"];
    let foodQty = 0;
    for (const item of foodItems) {
      const e = this.inventory.get(item);
      if (e) foodQty += e.quantity || 0;
    }
    const dailyNeed = Math.max(1, Math.ceil(this.population * 0.05));
    const foodDays = foodQty / dailyNeed;
    const foodMod = Math.max(0.65, Math.min(1.10, 0.75 + Math.min(foodDays, 8) * 0.05)); // 0.65..1.10

    // Reputation and infrastructure influence effective collection efficiency.
    const repMod = Math.max(0.80, Math.min(1.20, 1 + ((this.reputation - 50) / 250)));
    const upgrades = this.management?.upgradeLevels || {};
    const infraLevel = Object.values(upgrades).reduce((s, v) => s + (v || 0), 0);
    const infraMod = Math.min(
      1.28,
      1
      + infraLevel * 0.015
      + (this.hasBank ? 0.06 : 0)
      + (this.hasSchool ? 0.04 : 0)
      + (this.hasWinery ? 0.03 : 0)
    );

    // Diminishing scale so huge cities don't snowball too hard.
    const popScale = this.population * (0.78 + 0.22 / (1 + this.population / 2500));
    const grossWeekly = Math.max(0, Math.floor(popScale * 8 * taxRate * repMod * foodMod * infraMod));

    // Baseline administration/upkeep costs.
    const routeCount = Array.isArray(this.management?.routes) ? this.management.routes.length : 0;
    const queueCount = Array.isArray(this.management?.buildingQueue) ? this.management.buildingQueue.length : 0;
    const upkeepWeekly = Math.max(0, Math.floor(this.population * 0.035 + routeCount * 3 + queueCount * 2));

    const netWeekly = Math.max(0, grossWeekly - upkeepWeekly);
    const rawRevenue = Math.max(0, Math.floor(netWeekly * dayScale));

    // Safety cap: prevents runaway payouts for low-pop cities when multiple modifiers stack.
    const popSafe = Math.max(10, Number(this.population) || 10);
    const capPerDayBase = popSafe * (0.18 + (taxRate * 0.75));
    const capPerDayMod = 1
      + (this.hasBank ? 0.12 : 0)
      + (this.hasSchool ? 0.08 : 0)
      + Math.min(0.2, infraLevel * 0.01);
    const capDays = Math.max(0, Number(days) || 0);
    const revenueCap = Math.max(4, Math.floor(capPerDayBase * capPerDayMod * capDays));
    const revenue = Math.max(0, Math.min(rawRevenue, revenueCap));
    const taxBonus = this._getManagementEffect('taxIncome');
    const finalRevenue = Math.max(0, Math.floor(revenue * (1 + taxBonus)));
    return { finalRevenue, foodDays, foodQty, dailyNeed };
  }

  /** Apply tax over a period.
   * days: number of days to apply (default 7 for weekly). Returns revenue added.
   */
  applyWeeklyTax(days = 7) {
    const { finalRevenue, foodDays, foodQty, dailyNeed } = this.computeTaxRevenue(days);
    this.management = this.management || { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [], units: [], ownerPayoutDue: 0, ownerTaxShare: 0.35, districts: {}, districtEffects: {} };
    const p = (typeof player !== 'undefined') ? player : null;
    const isPlayerOwned = !!(p && typeof p.ownsCity === 'function' && p.ownsCity(this));
    const configuredShare = Number(this.management.ownerTaxShare);
    const ownerTaxShare = isPlayerOwned
      ? Math.max(0.10, Math.min(0.80, Number.isFinite(configuredShare) ? configuredShare : 0.35))
      : 0;
    const ownerCut = Math.floor(finalRevenue * ownerTaxShare);
    const treasuryCut = Math.max(0, finalRevenue - ownerCut);
    this.management.budget = (this.management.budget || 0) + treasuryCut;
    this.management.ownerPayoutDue = Math.max(0, Math.floor(Number(this.management.ownerPayoutDue) || 0) + ownerCut);

    // Auto-reinvest a small slice of budget into staple food when reserves are low.
    // This helps city populations keep growing without manual babysitting.
    if (foodDays < 4 && this.management.budget > 20) {
      const targetUnits = dailyNeed * 5;
      const deficit = Math.max(0, targetUnits - foodQty);
      if (deficit > 0) {
        const affordable = Math.floor(this.management.budget / 4); // 4g per Wheat
        const buyQty = Math.max(0, Math.min(deficit, affordable));
        if (buyQty > 0) {
          this.management.budget -= buyQty * 4;
          this._addOrIncrement("Wheat", buyQty);
        }
      }
    }

    return finalRevenue;
  }

  /** Enqueue a building project. buildTime in seconds, cost in gold */
  enqueueBuild(buildingType, cost = 100, buildTime = 60) {
    this.management = this.management || { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [], districts: {}, districtEffects: {} };
    this.management.buildingQueue.push({ type: buildingType, cost: cost, buildTime: buildTime, progress: 0 });
  }

  getBuildQueueCapacity() {
    const pop = Math.max(0, Math.floor(Number(this.population) || 0));
    let capacity = 1 + Math.min(4, Math.floor(pop / 250));

    const upgrades = this.management?.upgradeLevels || {};
    if (Math.max(0, Number(upgrades.wagonDepot) || 0) > 0) capacity += 1;
    if (Math.max(0, Number(upgrades.motorPool) || 0) > 0) capacity += 1;

    if (typeof this.hasTechNode === 'function' && this.hasTechNode('inf_district_plan')) capacity += 1;
    if (typeof this.hasTechNode === 'function' && this.hasTechNode('inf_civil_engineering')) capacity += 1;

    const buildSpeedBonus = Math.max(0, typeof this._getManagementEffect === 'function' ? this._getManagementEffect('buildSpeed') : 0);
    capacity += Math.min(2, Math.floor(buildSpeedBonus / 0.35));

    return Math.max(1, Math.min(8, Math.floor(capacity)));
  }

  /** Internal: mark a build as completed and apply effects */
  _completeBuild(build) {
    if (!build || !build.type) return;
    const _buildLabels = {
      bank: '\uD83C\uDFE6 Bank', gamblingDen: '\uD83C\uDFB2 Gambling Den', bountyBoard: '\uD83D\uDCDC Bounty Board',
      weaponShop: '\u2694\uFE0F Weapon Shop', winery: '\uD83C\uDF77 Winery', wineryExpansion: '\uD83C\uDF77 Winery Expansion', school: '\uD83C\uDFEB School',
      library: '\uD83D\uDCDA Library', university: '\uD83C\uDF93 University', researchLab: '\uD83D\uDD2C Research Lab', wagonDepot: '\uD83D\uDEDE Wagon Depot', motorPool: '\uD83D\uDE9A Motor Pool',
      spaceport: '\uD83D\uDE80 Spaceport', missionControl: '\uD83D\uDCE1 Mission Control', orbitalWarehouse: '\uD83D\uDCE6 Orbital Warehouse', xenoExchange: '\uD83D\uDCBD Xeno Exchange', resistanceRelay: '\uD83D\uDCE1 Resistance Relay',
      temple: '\u26EA Temple', farm: '\uD83C\uDF3E Farm',
      warehouse: '\uD83D\uDCE6 Warehouse', walls: '\uD83C\uDFF0 Walls', removeBlackMarket: '\uD83D\uDEAB Black Market removed',
    };
    if (typeof build.type === 'string' && build.type.startsWith('district:')) {
      const districtKey = build.type.slice('district:'.length);
      this.management.districts = this.management.districts || {};
      this.management.districts[districtKey] = Math.max(1, Number(this.management.districts[districtKey] || 0) + 1);
      if (typeof window !== 'undefined' && window.CityManagement && typeof window.CityManagement.computeDistrictEffects === 'function') {
        this.management.districtEffects = window.CityManagement.computeDistrictEffects(this.management.districts);
      }
      const districtDef = window.CityManagement?.DISTRICT_DEFS?.[districtKey];
      if (districtKey === 'granary') this._addOrIncrement('Wheat', 8 + Math.floor(_bqCityRand() * 6));
      if (districtKey === 'market') this._addOrIncrement('Tools', 2 + Math.floor(_bqCityRand() * 2));
      if (districtKey === 'harbor' && this.isCoastal) this._addOrIncrement('Fish', 6 + Math.floor(_bqCityRand() * 4));
      if (districtKey === 'civic' && typeof this.adjustReputation === 'function') this.adjustReputation(2);
      _buildLabels[build.type] = `${districtDef?.emoji || '\uD83C\uDFD9\uFE0F'} ${districtDef?.label || districtKey}`;
    } else switch (build.type) {
      case 'bank':
        this.hasBank = true; break;
      case 'gamblingDen':
        this.hasGamblingDen = true; break;
      case 'blackMarket':
        this.hasBlackMarket = true; break;
      case 'bountyBoard':
        this.hasBountyBoard = true; break;
      case 'weaponShop':
        this.hasWeaponShop = true; this.stockWeapons(); break;
      case 'winery':
        this.hasWinery = true;
        this.management.upgradeLevels = this.management.upgradeLevels || {};
        this.management.upgradeLevels.winery = Math.max(1, Number(this.management.upgradeLevels.winery) || 1);
        this._addOrIncrement('Wine', 4 + Math.floor(_bqCityRand() * 4));
        break;
      case 'wineryExpansion':
        this.hasWinery = true;
        this.management.upgradeLevels = this.management.upgradeLevels || {};
        this.management.upgradeLevels.winery = (this.management.upgradeLevels.winery || 1) + 1;
        this._addOrIncrement('Wine', 4 + Math.floor(_bqCityRand() * 4));
        break;
      case 'school':
        this.hasSchool = true;
        break;
      case 'library':
        this.hasLibrary = true;
        break;
      case 'university':
        this.hasUniversity = true;
        break;
      case 'researchLab':
        this.hasResearchLab = true;
        break;
      case 'spaceport':
        this.hasSpaceport = true;
        this.progression = this.progression || {};
        this.progression.spaceProgram = true;
        this.progression.spaceportBuilt = true;
        this.progression.spaceAccess = this.progression.spaceAccess || {};
        this.progression.spaceAccess.launchReady = true;
        this.progression.spaceAccess.orbitClearance = true;
        break;
      case 'missionControl':
        this.management.upgradeLevels = this.management.upgradeLevels || {};
        this.management.upgradeLevels.missionControl = Math.max(1, Number(this.management.upgradeLevels.missionControl) || 0);
        this.progression = this.progression || {};
        this.progression.spaceAccess = this.progression.spaceAccess || {};
        this.progression.spaceAccess.dockingRights = true;
        break;
      case 'orbitalWarehouse':
        this.management.upgradeLevels = this.management.upgradeLevels || {};
        this.management.upgradeLevels.orbitalWarehouse = Math.max(1, Number(this.management.upgradeLevels.orbitalWarehouse) || 0);
        break;
      case 'xenoExchange':
        this.hasAlienExchange = true;
        this.progression = this.progression || {};
        this.progression.alienContact = true;
        break;
      case 'resistanceRelay':
        this.management.upgradeLevels = this.management.upgradeLevels || {};
        this.management.upgradeLevels.resistanceRelay = Math.max(1, Number(this.management.upgradeLevels.resistanceRelay) || 0);
        break;
      case 'removeBlackMarket':
        this.hasBlackMarket = false; break;
      default:
        // custom building types can be added to upgradeLevels
        this.management.upgradeLevels = this.management.upgradeLevels || {};
        this.management.upgradeLevels[build.type] = (this.management.upgradeLevels[build.type] || 0) + 1;
        break;
    }
    // Small reputation boost for successful completion
    this.adjustReputation(2);
    // Fanfare notification for the player's managed city
    if (this._isManagedCity && typeof notificationManager !== 'undefined') {
      const label = _buildLabels[build.type] || build.type;
      notificationManager.log(`Construction complete: ${label} is ready!`, 'success');
      window._cityMgmtBuildFanfare = { label, ts: Date.now() };
    }
  }

  /** Tick management: advance build queue by dt (ms) and complete finished builds */
  tickManagement(dt) {
    if (!this.management || !Array.isArray(this.management.buildingQueue)) return;
    const buildSpeedMult = Math.max(0.25, 1 + this._getManagementEffect('buildSpeed'));
    const activeLimit = typeof this.getBuildQueueCapacity === 'function'
      ? this.getBuildQueueCapacity()
      : this.management.buildingQueue.length;
    for (const b of this.management.buildingQueue.slice(0, activeLimit)) {
      b.progress = (b.progress || 0) + ((dt / 1000) * buildSpeedMult);
    }
    const finished = this.management.buildingQueue.filter(b => b.progress >= b.buildTime);
    for (const f of finished) {
      this._completeBuild(f);
    }
    // remove finished builds
    this.management.buildingQueue = this.management.buildingQueue.filter(b => b.progress < b.buildTime);
  }

  /** Daily production effects from managed city buildings (farm/winery/etc). */
  _applyManagedBuildingProduction() {
    const upgrades = this.management?.upgradeLevels || {};
    const farmLevel = Math.max(0, Number(upgrades.farm) || 0);
    if (farmLevel > 0) {
      const wheatYield = farmLevel * 2;
      const fishYield = Math.floor(farmLevel / 2);
      if (wheatYield > 0) this._addOrIncrement("Wheat", wheatYield);
      if (fishYield > 0 && this.isCoastal) this._addOrIncrement("Fish", fishYield);
    }

    // Winery converts wheat into wine daily once unlocked; expansions improve throughput.
    if (this.hasWinery) {
      const wineryLevel = Math.max(1, Number(upgrades.winery) || 1);
      const wheatEntry = this.inventory.get("Wheat");
      const wheatQty = wheatEntry?.quantity || 0;
      const maxBatches = Math.min(Math.floor(wheatQty / 3), wineryLevel);
      if (maxBatches > 0) {
        wheatEntry.quantity -= maxBatches * 3;
        if (wheatEntry.quantity <= 0) this.inventory.delete("Wheat");
        this._addOrIncrement("Wine", maxBatches);
      }
    }
  }

  /** Remove this city's event listener to prevent leaks on new game */
  destroy() {
    if (this._onDayChanged) {
      window.removeEventListener("dayChanged", this._onDayChanged);
      this._onDayChanged = null;
    }
  }

  applyFoundedSettlementProfile(opts = {}) {
    const starterSupplies = (opts && typeof opts.starterSupplies === "object" && opts.starterSupplies)
      ? opts.starterSupplies
      : { Wheat: 30 };

    this.inventory.clear();
    this.stockedBooks = [];
    this.bookHolidays = [];
    this.stockedWeapons = [];
    this.hasGamblingDen = false;
    this.hasBank = false;
    this.hasBlackMarket = false;
    this.hasBountyBoard = false;
    this.hasWeaponShop = false;
    this.hasWinery = false;
    this.hasSchool = false;
    this.hasLibrary = false;
    this.hasUniversity = false;
    this.hasResearchLab = false;
    this.hasSpaceport = false;
    this.hasAlienExchange = false;
    this.progression = this._createProgressionState();

    for (const [itemKey, rawQty] of Object.entries(starterSupplies)) {
      const qty = Math.max(0, Math.floor(Number(rawQty) || 0));
      if (qty > 0) this._addOrIncrement(itemKey, qty);
    }

    return this;
  }

  refreshCoastalStatus(grid) {
    if (!Array.isArray(grid) || grid.length === 0 || !Array.isArray(grid[0])) {
      this.isCoastal = false;
      this.port = false;
      return false;
    }
    City.detectCoastalCities([this], grid, grid.length, grid[0].length);
    return !!this.isCoastal;
  }

  // === HOLIDAYS ===
  isHolidayForItem(itemName, currentDay) {
    const dayInYear = ((currentDay % 100) + 100) % 100;
    const seasonIndex = Math.floor(dayInYear / 25);
    const currentSeason = ["Winter", "Spring", "Summer", "Fall"][seasonIndex];
    return this.holidays.some(holiday =>
      holiday.item === itemName &&
      holiday.day === dayInYear &&
      holiday.season === currentSeason
    );
  }

  generateHolidays() {
    const itemKeys = Object.keys(ItemLibrary).filter(k => !ItemLibrary[k].tags?.has('book'));
    const holidayCount = Math.floor(_bqCityRand() * 11);
    for (let i = 0; i < holidayCount; i++) {
      const itemKey = itemKeys[Math.floor(_bqCityRand() * itemKeys.length)];
      const day = Math.floor(_bqCityRand() * 100);
      const seasonIndex = Math.floor(day / 25);
      const season = ["Winter", "Spring", "Summer", "Fall"][seasonIndex];
      this.holidays.push({
        name: `${ItemLibrary[itemKey].name} Festival`,
        item: itemKey,
        day: day,
        season: season
      });
    }
  }

  /** Stock 2-4 random books (one copy each, does NOT restock) */
  stockBooks() {
    const allBooks = Object.keys(ItemLibrary).filter(k => ItemLibrary[k].tags?.has('book'));
    if (allBooks.length === 0) return;
    const count = 2 + Math.floor(_bqCityRand() * 3); // 2, 3, or 4
    const shuffled = _bqCityShuffle(allBooks);
    this.stockedBooks = [];
    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      this._addOrIncrement(shuffled[i], 1);
      this.stockedBooks.push(shuffled[i]);
    }
    this.generateBookHolidays();
  }

  /** Stock 2-4 random weapons (one copy each). Called when hasWeaponShop is true. */
  stockWeapons() {
    const allWeapons = Object.keys(ItemLibrary).filter(k => ItemLibrary[k].category === 'Weapon');
    if (allWeapons.length === 0) return;
    const count = 2 + Math.floor(_bqCityRand() * 3); // 2, 3, or 4
    const shuffled = _bqCityShuffle(allWeapons);
    this.stockedWeapons = [];
    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      this._addOrIncrement(shuffled[i], 1);
      this.stockedWeapons.push(shuffled[i]);
    }
  }

  /** Generate 0-2 book-themed holidays per city (discount books on those days) */
  generateBookHolidays() {
    this.bookHolidays = [];
    const bookKeys = Object.keys(ItemLibrary).filter(k => ItemLibrary[k].tags?.has('book') && ItemLibrary[k].holidayNames);
    if (bookKeys.length === 0) return;
    const count = Math.floor(_bqCityRand() * 3); // 0, 1, or 2
    const shuffled = _bqCityShuffle(bookKeys);
    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      const book = ItemLibrary[shuffled[i]];
      const names = book.holidayNames;
      const name = names[Math.floor(_bqCityRand() * names.length)];
      const day = Math.floor(_bqCityRand() * 100);
      const seasonIndex = Math.floor(day / 25);
      const season = ["Winter", "Spring", "Summer", "Fall"][seasonIndex];
      this.bookHolidays.push({
        name,
        bookKey: shuffled[i],
        day,
        season,
        discount: 0.30 // 30% off
      });
    }
  }

  /** Check if a book has an active holiday discount in this city today */
  getBookHolidayDiscount(bookKey, currentDay) {
    if (!this.bookHolidays) return 0;
    const dayInYear = ((currentDay % 100) + 100) % 100;
    const seasonIndex = Math.floor(dayInYear / 25);
    const currentSeason = ["Winter", "Spring", "Summer", "Fall"][seasonIndex];
    for (const bh of this.bookHolidays) {
      if (bh.bookKey === bookKey && bh.day === dayInYear && bh.season === currentSeason) {
        return bh.discount;
      }
    }
    return 0;
  }

  // === CITY FEATURES (new economy buildings) ===
  generateCityFeatures() {
    this.hasGamblingDen = _bqCityRand() < 0.30;
    this.hasBank        = _bqCityRand() < 0.40;
    this.hasBlackMarket = _bqCityRand() < 0.20;
    this.hasBountyBoard = this.population > 600;
    this.hasWeaponShop  = _bqCityRand() < 0.35;
    this.hasWinery      = false;
    this.hasSchool      = false;
    this.hasLibrary     = false;
    this.hasUniversity  = false;
    this.hasResearchLab = false;
    this.hasSpaceport = false;
    this.hasAlienExchange = false;
    if (this.hasWeaponShop) this.stockWeapons();
  }

  /** Returns an array of feature descriptor objects for UI */
  getCityFeatures() {
    const features = [];
    if (this.hasBountyBoard)  features.push({ id: 'bountyBoard',  emoji: '\uD83D\uDCDC', label: 'Bounty Board' });
    if (this.hasBank)         features.push({ id: 'bank',         emoji: '\uD83C\uDFE6', label: 'Bank' });
    if (this.hasGamblingDen)  features.push({ id: 'gamblingDen',  emoji: '\uD83C\uDFB2', label: 'Gambling Den' });
    if (this.hasBlackMarket)  features.push({ id: 'blackMarket',  emoji: '\uD83D\uDD76\uFE0F', label: 'Black Market' });
    if (this.hasSchool)       features.push({ id: 'school',       emoji: '\uD83C\uDFEB', label: 'School' });
    if (this.hasLibrary)      features.push({ id: 'library',      emoji: '\uD83D\uDCDA', label: 'Library' });
    if (this.hasUniversity)   features.push({ id: 'university',   emoji: '\uD83C\uDF93', label: 'University' });
    if (this.hasResearchLab)  features.push({ id: 'researchLab',  emoji: '\uD83D\uDD2C', label: 'Research Lab' });
    if (this.hasSpaceport)    features.push({ id: 'spaceport',    emoji: '\uD83D\uDE80', label: 'Spaceport' });
    if (this.hasAlienExchange) features.push({ id: 'alienExchange', emoji: '\uD83D\uDC7D', label: 'Alien Exchange' });
    return features;
  }

  // === POPULATION ===
  getPopulationCap() {
    const housingLevel = Math.max(0, Number(this.management?.upgradeLevels?.housing) || 0);
    const baseCap = 180;
    const housingBonus = 120;
    return baseCap + (housingLevel * housingBonus);
  }

  growPopulation() {
    const currentPop = this.population;
    const foodItems = ["Wheat", "Fish", "Bread", "SaltedFish"];
    let foodQty = 0;
    for (let item of foodItems) {
      const entry = this.inventory.get(item);
      if (entry) foodQty += entry.quantity;
    }

    // Daily food maintenance: each person needs 0.05 food/day
    const foodSaving = Math.max(0, Math.min(0.6, this._getManagementEffect('foodSaving')));
    const dailyNeed = Math.ceil(currentPop * 0.05 * (1 - foodSaving));
    this._consumeFood(dailyNeed);

    // Recalculate food after consumption for growth factor
    foodQty = 0;
    for (let item of foodItems) {
      const entry = this.inventory.get(item);
      if (entry) foodQty += entry.quantity;
    }

    // Starvation: if no food, population slowly shrinks
    if (foodQty <= 0 && currentPop > 10) {
      const starvationLoss = Math.max(1, Math.floor(currentPop * 0.02));
      this.population = Math.max(10, currentPop - starvationLoss);
      if (typeof notificationManager !== 'undefined' && this._isManagedCity) {
        notificationManager.log(`\u26A0\uFE0F ${this.name} is starving! Population dropped by ${starvationLoss}.`, 'error');
      }
      return;
    }

    const foodFactor = Math.min(foodQty / Math.max(currentPop * 0.1, 1), 1);
    const overpopPenalty = 1 / (1 + currentPop / 1000);
    const baseGrowth = 0.003;
    const maxBonus = 0.007;
    const policyGrowthBonus = (typeof CityPolicies !== 'undefined') ? CityPolicies.getPopGrowthBonus(this) : 0;
    const growthRate = baseGrowth + maxBonus * foodFactor * overpopPenalty + policyGrowthBonus + this._getManagementEffect('popGrowth');
    const popCap = (typeof this.getPopulationCap === 'function') ? this.getPopulationCap() : Infinity;
    if (currentPop >= popCap) {
      this.population = Math.min(currentPop, popCap);
      return;
    }

    // Use additive growth with a guaranteed minimum of +1 so small cities always grow
    const growthAmount = Math.max(1, Math.round(currentPop * growthRate));
    this.population = Math.min(popCap, currentPop + growthAmount);

    // Population milestone celebrations
    if (this._isManagedCity && typeof notificationManager !== 'undefined') {
      const milestones = [100, 250, 500, 1000, 2500, 5000];
      for (const m of milestones) {
        if (currentPop < m && this.population >= m) {
          notificationManager.log(`Population milestone: ${this.name} reached ${m} citizens!`, 'success');
          window._cityMgmtPopMilestone = { pop: m, ts: Date.now() };
          break;
        }
      }
    }

    // Reputation decay: slowly drifts toward neutral (35) if above it
    if (this.reputation > 35) {
      this.reputation = Math.max(35, this.reputation - 0.15);
    }
  }

  // === REPUTATION ===
  adjustReputation(delta) {
    this.reputation = Math.max(0, Math.min(100, this.reputation + delta));
  }

  getReputationTier() {
    const r = this.reputation;
    if (r >= 90) return { name: 'Beloved',    color: '#d4af37', emoji: '\uD83D\uDC51', atlasFrame: 'Love' };
    if (r >= 75) return { name: 'Trusted',    color: '#4fc3f7', emoji: '\uD83E\uDD1D', atlasFrame: 'Friendly' };
    if (r >= 55) return { name: 'Friendly',   color: '#66bb6a', emoji: '\uD83D\uDE0A', atlasFrame: 'Friendly' };
    if (r >= 35) return { name: 'Neutral',    color: '#aaa',    emoji: '\uD83D\uDE10', atlasFrame: 'Neutral' };
    if (r >= 20) return { name: 'Unfriendly', color: '#ff9800', emoji: '\uD83D\uDE12', atlasFrame: 'Hostile' };
    return               { name: 'Hostile',    color: '#f44336', emoji: '\uD83D\uDE21', atlasFrame: 'Hate' };
  }

  /** Returns a price modifier based on reputation.
   *  For buying: lower is better (discount). For selling: higher is better (bonus).
   *  @param {boolean} isSelling
   *  @returns {number} multiplier to apply to final price */
  getReputationPriceModifier(isSelling = false) {
    const r = this.reputation;
    // Linear interpolation: 0 rep = +10% markup / -10% sell penalty
    //                      50 rep = no change
    //                     100 rep = -8% discount / +8% sell bonus
    const t = (r - 50) / 50; // -1 to +1
    if (isSelling) {
      // Positive t = bonus for seller (higher price)
      return 1 + t * 0.08; // 0.92 to 1.08
    } else {
      // Positive t = discount for buyer (lower price)
      return 1 - t * 0.08; // 1.08 to 0.92
    }
  }

  _consumeFood(amount) {
    const foodItems = ["Wheat", "Fish", "Bread", "SaltedFish"];
    let remaining = amount;
    for (let item of foodItems) {
      const entry = this.inventory.get(item);
      if (entry && remaining > 0) {
        const consumed = Math.min(remaining, entry.quantity);
        entry.quantity -= consumed;
        if (entry.quantity <= 0) this.inventory.delete(item);
        remaining -= consumed;
      }
    }
  }

  // === PRODUCTION ===
  runProduction() {
    // Specialization production bonuses
    const specChanceBonus = (typeof CitySpecialization !== "undefined")
      ? CitySpecialization.getProdChanceBonus(this) : 0;
    const specDoubleChance = (typeof CitySpecialization !== "undefined")
      ? CitySpecialization.getProdDoubleChance(this) : 0;
    const mgmtChanceBonus = this._getManagementEffect('productionChance');
    const mgmtDoubleBonus = this._getManagementEffect('productionDouble');

    // Seasonal production modifier
    let seasonMod = 1.0;
    if (typeof dayNight !== "undefined" && dayNight && typeof dayNight.getSeason === "function") {
      const season = dayNight.getSeason();
      // Farms produce more in summer, fisheries in spring
      if (season === "summer") seasonMod = 1.15;
      else if (season === "winter") seasonMod = 0.80;
    }

    for (let [key, recipe] of Object.entries(this.productionRecipes)) {
      const effectiveChance = Math.min(0.95, (recipe.chance + specChanceBonus + mgmtChanceBonus) * seasonMod);
      if (_bqCityRand() > effectiveChance) continue;

      // Check if we have all inputs
      let canProduce = true;
      for (let [inputItem, inputQty] of Object.entries(recipe.inputs)) {
        const entry = this.inventory.get(inputItem);
        if (!entry || entry.quantity < inputQty) {
          canProduce = false;
          break;
        }
      }

      if (canProduce) {
        // Consume inputs
        for (let [inputItem, inputQty] of Object.entries(recipe.inputs)) {
          const entry = this.inventory.get(inputItem);
          entry.quantity -= inputQty;
          if (entry.quantity <= 0) this.inventory.delete(inputItem);
        }
        // Add output (with possible double from specialization)
        let outputQty = recipe.qty;
        if ((specDoubleChance + mgmtDoubleBonus) > 0 && _bqCityRand() < (specDoubleChance + mgmtDoubleBonus)) outputQty *= 2;
        this._addOrIncrement(recipe.output, outputQty);
      }
    }
  }

  // === TERRAIN RESTOCK ===
  restockInventory() {
    const { x, y } = this.location;
    const terrainCounts = { Water: 0, Grass: 0, Rock: 0, Sand: 0, Forest: 0, Snow: 0 };
    const warStatus = _bqCityActiveWarStatus();
    const stockScale = warStatus?.occupied ? 0.6 : warStatus?.threatened ? 0.82 : 1;
    const addScaled = (itemKey, amount = 1) => {
      if (amount <= 0) return;
      if (stockScale >= 0.999) {
        this._addOrIncrement(itemKey, amount);
        return;
      }
      let scaled = 0;
      if (amount <= 1) {
        scaled = _bqCityRand() < stockScale ? amount : 0;
      } else {
        scaled = Math.max(1, Math.floor(amount * stockScale));
      }
      if (scaled > 0) this._addOrIncrement(itemKey, scaled);
    };

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
          const tile = grid[ny][nx];
          const type = tile.options[0];
          if (terrainCounts[type] !== undefined) {
            terrainCounts[type]++;
          }
        }
      }
    }

    if (terrainCounts.Rock > 0 && _bqCityRand() < 0.7) {
      addScaled("Iron", terrainCounts.Rock);
      if (_bqCityRand() < 0.3) addScaled("Stone", terrainCounts.Rock);
    }
    if (terrainCounts.Grass > 0 && _bqCityRand() < 0.8) {
      addScaled("Wheat", terrainCounts.Grass);
      if (_bqCityRand() < 0.2) addScaled("Herbs", 1);
    }
    if (terrainCounts.Water > 0 && _bqCityRand() < 0.8) {
      addScaled("Fish", terrainCounts.Water);
      if (_bqCityRand() < 0.25) addScaled("Salt", 1);
    }
    if (terrainCounts.Sand > 0 && _bqCityRand() < 0.5) {
      addScaled("Clay", terrainCounts.Sand);
    }
    if (terrainCounts.Forest > 0 && _bqCityRand() < 0.7) {
      addScaled("Wood", terrainCounts.Forest);
      if (_bqCityRand() < 0.3) addScaled("Fur", 1);
    }
    if (terrainCounts.Snow > 0 && _bqCityRand() < 0.4) {
      addScaled("Fur", terrainCounts.Snow);
    }
    // Occasional bag stock from traveling merchants
    if (_bqCityRand() < 0.15) addScaled("Pouch", 1);
    if (_bqCityRand() < 0.05) addScaled("TravelerBag", 1);

    const root = _bqCityRoot();
    const spaceContext = _bqCityActiveSpaceContext();
    if (spaceContext && typeof root?.BQApplySpaceMarketStock === 'function') {
      root.BQApplySpaceMarketStock(this, spaceContext);
    }
  }

  _addOrIncrement(itemKey, amount = 1) {
    if (!ItemLibrary[itemKey]) return;
    if (this.inventory.has(itemKey)) {
      this.inventory.get(itemKey).quantity += amount;
    } else {
      this.inventory.set(itemKey, {
        item: ItemLibrary[itemKey],
        quantity: amount
      });
    }
  }

  // === INDICATORS ===
  spawnIndicator(symbol) {
    this.indicators.push({ symbol, age: 0, yOffset: 0 });
  }

  // === 2D RENDERING ===
  render(tileSize) {
    const { x, y } = this.location;
    const posX = x * tileSize;
    const posY = y * tileSize;

    // Viewport culling — skip offscreen cities
    if (typeof isOnScreen === 'function' && !isOnScreen(posX, posY)) {
      // Still age indicators so they don't pile up
      this.indicators = this.indicators.filter(i => { i.age++; return i.age < 60; });
      return;
    }

    // Draw city sprite
    if (typeof SpriteSheet !== 'undefined' && SpriteSheet.city && SpriteSheet.city[this.buildingVariant]) {
      image(SpriteSheet.city[this.buildingVariant], posX, posY, tileSize, tileSize);
    } else {
      // Fallback: simple rectangle
      fill(180, 140, 100);
      stroke(100, 80, 60);
      strokeWeight(1);
      rect(posX + 4, posY + 4, tileSize - 8, tileSize - 8, 3);
    }

    // City-management footprint: keep detailed growth marks focused on player-managed cities.
    const showDetailedFootprint = !!this._isManagedCity || !!this.ownership?.owned;
    const footprint = [];
    const addFootprint = (key, color, count = 1) => {
      const n = Math.max(0, Math.min(4, Math.floor(Number(count) || 0)));
      for (let i = 0; i < n; i++) footprint.push({ key, color });
    };

    if (showDetailedFootprint) {
      if (this.hasBank) addFootprint('bank', [235, 202, 86], 1);
      if (this.hasSchool || this.hasLibrary || this.hasUniversity || this.hasResearchLab) addFootprint('school', [125, 201, 255], 1 + (this.hasLibrary ? 1 : 0) + (this.hasUniversity ? 1 : 0));
      if (this.hasWeaponShop || this.hasBountyBoard) addFootprint('watch', [239, 120, 116], 1 + (this.hasWeaponShop && this.hasBountyBoard ? 1 : 0));
      if (this.hasWinery) addFootprint('wine', [198, 126, 218], Math.max(1, Number(this.management?.upgradeLevels?.winery) || 1));
      const upgrades = this.management?.upgradeLevels || {};
      addFootprint('farm', [148, 210, 106], upgrades.farm);
      addFootprint('housing', [220, 185, 132], upgrades.housing);
      addFootprint('warehouse', [157, 175, 196], upgrades.warehouse);
      addFootprint('walls', [185, 196, 210], upgrades.walls);
      const districts = this.management?.districts || {};
      const districtColors = {
        market: [255, 205, 96],
        granary: [175, 218, 104],
        crafts: [116, 188, 225],
        garrison: [235, 110, 104],
        civic: [178, 151, 232],
        harbor: [80, 190, 210],
      };
      for (const [key, tier] of Object.entries(districts)) {
        addFootprint(key, districtColors[key] || [200, 210, 220], tier);
      }
    }

    if (footprint.length > 0) {
      push();
      const maxMarks = Math.min(12, footprint.length);
      const radius = tileSize * (0.72 + Math.min(0.35, maxMarks * 0.015));
      for (let i = 0; i < maxMarks; i++) {
        const mark = footprint[i];
        const angle = (-Math.PI / 2) + (i / maxMarks) * Math.PI * 2;
        const mx = posX + tileSize / 2 + Math.cos(angle) * radius;
        const my = posY + tileSize / 2 + Math.sin(angle) * radius;
        fill(mark.color[0], mark.color[1], mark.color[2], 215);
        stroke(25, 22, 28, 210);
        strokeWeight(1);
        if (mark.key === 'walls' || mark.key === 'garrison' || mark.key === 'watch') {
          rect(mx - tileSize * 0.14, my - tileSize * 0.14, tileSize * 0.28, tileSize * 0.28, 2);
        } else if (mark.key === 'farm' || mark.key === 'granary') {
          triangle(mx, my - tileSize * 0.17, mx - tileSize * 0.16, my + tileSize * 0.13, mx + tileSize * 0.16, my + tileSize * 0.13);
        } else {
          ellipse(mx, my, tileSize * 0.28, tileSize * 0.28);
        }
      }
      pop();
    }

    // City name label
    push();
    fill(255);
    stroke(0);
    strokeWeight(2);
    textAlign(CENTER, BOTTOM);
    textSize(10);
    text(this.name, posX + tileSize / 2, posY - 2);
    pop();

    // Population badge
    push();
    fill(255, 255, 255, 180);
    noStroke();
    const popText = this.population.toString();
    textSize(8);
    const tw = textWidth(popText) + 6;
    rect(posX + tileSize / 2 - tw / 2, posY + tileSize + 1, tw, 10, 2);
    fill(60);
    textAlign(CENTER, TOP);
    text(popText, posX + tileSize / 2, posY + tileSize + 2);
    pop();

    // Port dock overlay for coastal cities
    if (this.isCoastal && this.port) {
      if (typeof SpriteSheet !== 'undefined' && SpriteSheet.port) {
        image(SpriteSheet.port, posX + tileSize * 0.6, posY + tileSize * 0.6, tileSize * 0.5, tileSize * 0.5);
      } else {
        // Fallback: small anchor icon
        push();
        fill(0, 180, 220, 200);
        noStroke();
        ellipse(posX + tileSize * 0.85, posY + tileSize * 0.85, 8, 8);
        pop();
      }
    }

    // Trader count badge (top-left green dot) — reads O(1) docked counter
    if (this.dockedTraderCount > 0) {
      push();
      fill(60, 180, 80, 220);
      stroke(0, 0, 0, 150);
      strokeWeight(1);
      ellipse(posX + 4, posY + 4, 12, 12);
      fill(255);
      noStroke();
      textAlign(CENTER, CENTER);
      textSize(7);
      text(this.dockedTraderCount, posX + 4, posY + 3);
      pop();
    }

    // Threat indicator (top-right red dot) — spatial grid query, O(visible cells)
    if (typeof raiderGrid !== 'undefined' && raiderGrid && raiderGrid._cells) {
      const THREAT_RADIUS = 8; // tiles
      let nearbyThreats = 0;
      // Expand VP bounds to a city-centred bounding box for the query
      const cxMin = x - THREAT_RADIUS, cxMax = x + THREAT_RADIUS;
      const cyMin = y - THREAT_RADIUS, cyMax = y + THREAT_RADIUS;
      const cs = raiderGrid._cs;
      const minCX = Math.floor(cxMin / cs), maxCX = Math.floor(cxMax / cs);
      const minCY = Math.floor(cyMin / cs), maxCY = Math.floor(cyMax / cs);
      for (let cy = minCY; cy <= maxCY; cy++) {
        for (let cx = minCX; cx <= maxCX; cx++) {
          const cell = raiderGrid._cells.get(`${cx},${cy}`);
          if (cell) {
            for (const r of cell) {
              if (r.state !== 'defeated' &&
                  Math.abs(r.x - x) + Math.abs(r.y - y) <= THREAT_RADIUS) {
                nearbyThreats++;
              }
            }
          }
        }
      }
      if (nearbyThreats > 0) {
        push();
        fill(200, 50, 50, 200 + Math.sin(frameCount * 0.1) * 55);
        stroke(0, 0, 0, 150);
        strokeWeight(1);
        ellipse(posX + tileSize - 4, posY + 4, 10, 10);
        fill(255);
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(7);
        text("!", posX + tileSize - 4, posY + 3);
        pop();
      }
    } else if (typeof raiderManager !== 'undefined') {
      // Fallback when spatial grid not yet available
      const nearbyThreats = raiderManager.getRaiderCountNearCity(this.cityIndex, 8);
      if (nearbyThreats > 0) {
        push();
        fill(200, 50, 50, 200 + Math.sin(frameCount * 0.1) * 55);
        stroke(0, 0, 0, 150);
        strokeWeight(1);
        ellipse(posX + tileSize - 4, posY + 4, 10, 10);
        fill(255);
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(7);
        text("!", posX + tileSize - 4, posY + 3);
        pop();
      }
    }

    // Indicators (floating +/-/= signs)
    for (let indicator of this.indicators) {
      indicator.age++;
      indicator.yOffset += 0.3;
      const alpha = map(indicator.age, 0, 60, 255, 0);

      push();
      textAlign(CENTER);
      textSize(12);
      strokeWeight(1);
      if (indicator.symbol === "+") {
        fill(0, 255, 0, alpha);
        stroke(0, 150, 0, alpha);
      } else if (indicator.symbol === "-") {
        fill(255, 0, 0, alpha);
        stroke(150, 0, 0, alpha);
      } else {
        fill(255, 255, 255, alpha);
        stroke(150, 150, 150, alpha);
      }
      text(indicator.symbol, posX + tileSize / 2, posY - 10 - indicator.yOffset);
      pop();
    }
    this.indicators = this.indicators.filter(i => i.age < 60);
  }

  // === PRICING ===
  calculateItemPrice(itemName, allCities, isSelling = false, opts = {}) {
    const trackHistory = opts.trackHistory !== false;
    const applyDifficultyMultipliers = opts.applyDifficultyMultipliers !== false;

    // Books use fixed goal%-based pricing, not supply/demand
    const libItem = ItemLibrary[itemName];
    if (libItem && libItem.goalPercent) {
      let bookPrice = Math.floor(libItem.goalPercent * (window._newGameGoldTarget || 5000));

      // Book holiday discount — themed festivals reduce book prices
      if (typeof dayNight !== 'undefined') {
        const today = dayNight.getDaysElapsed();
        const discount = this.getBookHolidayDiscount(itemName, today);
        if (discount > 0) {
          bookPrice = Math.floor(bookPrice * (1 - discount));
        }
      }

      if (isSelling) bookPrice = Math.floor(bookPrice * 0.4); // books sell for much less
      return Math.max(1, bookPrice);
    }

    const basePrice = this.getBasePrice(itemName);
    const inv = this.inventory.get(itemName);
    const localQty = inv ? inv.quantity : 0;
    const demand = this.population / (localQty + 1);

    // Regional supply pressure
    const nearbyCities = allCities.filter(c => {
      if (c === this) return false;
      const dx = c.location.x - this.location.x;
      const dy = c.location.y - this.location.y;
      return Math.sqrt(dx * dx + dy * dy) <= 25;
    });

    let totalQty = 0;
    let totalPop = 0;
    for (let city of nearbyCities) {
      const item = city.inventory.get(itemName);
      if (item) {
        totalQty += item.quantity;
        totalPop += city.population;
      }
    }

    const regionalDemand = totalPop / (totalQty + 1);
    // Compare local demand against regional demand.
    // >1 means locally scarcer than nearby markets (higher price),
    // <1 means locally oversupplied (lower price).
    const marketPressureRaw = demand / (regionalDemand + 0.01);
    const marketPressure = Math.max(0.35, Math.min(2.5, marketPressureRaw));

    let finalPrice = basePrice + demand * 0.5 + marketPressure * 2;

    // Strong local surplus discount so very large stockpiles meaningfully cheapen goods.
    const expectedLocalStock = Math.max(1, Math.ceil(this.population * 0.08));
    if (localQty > expectedLocalStock * 6) {
      finalPrice *= 0.65;
    } else if (localQty > expectedLocalStock * 3) {
      finalPrice *= 0.80;
    }

    // Low local supply + regional abundance = lower price
    if (localQty < 3 && totalQty > totalPop / 5) {
      finalPrice *= 0.75;
    }

    // Holiday boost
    if (typeof dayNight !== 'undefined') {
      const today = dayNight.getDaysElapsed();
      if (this.isHolidayForItem(itemName, today)) {
        finalPrice *= 1.5;
      }
    }

    // Seasonality bonus — enhanced seasonal economy
    if (typeof dayNight !== 'undefined') {
      const season = dayNight.getSeason();
      const item = ItemLibrary[itemName];
      if (item && item.seasonality && item.seasonality.includes(season)) {
        finalPrice *= 1.30; // in-season: strong demand
      } else if (item && item.seasonality && item.seasonality.length > 0) {
        finalPrice *= 0.90; // off-season: slight discount
      }
      // Winter drives up food/fuel prices
      if (season === 'winter' && item && (item.category === 'Food' || itemName === 'Wood')) {
        finalPrice *= 1.15;
      }
    }

    const warStatus = _bqCityActiveWarStatus();
    if (warStatus?.tradePenalty > 0) {
      finalPrice *= isSelling
        ? Math.max(0.55, 1 - (warStatus.tradePenalty * 0.95))
        : (1 + (warStatus.tradePenalty * 1.6));
    }
    if (warStatus?.resistanceCell && _BQ_RESISTANCE_SUPPLY_ITEMS.has(itemName)) {
      // Resistance-aligned captains get a fatter cut moving supplies to free cells.
      const alignedBoost = _bqCityWarAlignment() === 'resistance_aligned';
      finalPrice *= isSelling
        ? (alignedBoost ? 1.24 : 1.14)
        : (alignedBoost ? 1.02 : 1.04);
    }

    // Permanent liberated-galaxy trade perk (earned by defeating Raymond).
    const warTradeBonus = (typeof player !== 'undefined' && player)
      ? Math.max(0, Number(player.modifiers?.warTradeBonus) || 0)
      : 0;
    if (warTradeBonus > 0) {
      finalPrice *= isSelling ? (1 + warTradeBonus) : (1 - warTradeBonus);
    }

    const spaceMarketMultiplier = _bqCitySpaceMarketMultiplier(itemName, isSelling);
    if (spaceMarketMultiplier !== 1) {
      finalPrice *= spaceMarketMultiplier;
    }

    // Reputation modifier
    finalPrice *= this.getReputationPriceModifier(isSelling);

    // Apply municipal tax rate: higher tax slightly increases local prices
    const taxRate = (this.management && typeof this.management.taxRate === 'number') ? this.management.taxRate : 0;
    if (taxRate > 0) {
      finalPrice *= (1 + Math.min(0.5, taxRate * 0.5)); // cap tax impact to +25% at extreme
    }

    finalPrice = Math.floor(finalPrice);

    // Track price history once per in-game day per item to avoid UI-frequency drift.
    if (trackHistory) {
      let shouldSample = true;
      if (typeof dayNight !== 'undefined' && dayNight && typeof dayNight.getDaysElapsed === 'function') {
        const today = dayNight.getDaysElapsed();
        if (this._priceHistorySampleDay[itemName] === today) {
          shouldSample = false;
        } else {
          this._priceHistorySampleDay[itemName] = today;
        }
      }
      if (shouldSample) {
        if (!this.priceHistory[itemName]) this.priceHistory[itemName] = [];
        this.priceHistory[itemName].push(finalPrice);
        if (this.priceHistory[itemName].length > 30) this.priceHistory[itemName].shift();
      }
    }

    if (isSelling) {
      const sellMul = applyDifficultyMultipliers
        ? (window.DIFFICULTY_CONFIG?.tradeSellMultiplier ?? 1.0)
        : 1.0;
      finalPrice = Math.floor(finalPrice * 0.8 * sellMul);
    } else if (applyDifficultyMultipliers) {
      const buyMul = window.DIFFICULTY_CONFIG?.tradeBuyMultiplier ?? 1.0;
      finalPrice = Math.floor(finalPrice * buyMul);
    }

    return Math.max(1, finalPrice);
  }

  getPriceTrend(itemName) {
    const history = this.priceHistory[itemName];
    if (!history || history.length < 2) return 0;
    const recent = history[history.length - 1];
    const older = history[0];
    if (recent > older * 1.1) return 1;  // rising
    if (recent < older * 0.9) return -1; // falling
    return 0; // stable
  }

  getBasePrice(itemName) {
    const lib = ItemLibrary[itemName];
    return lib?.baseValue ?? 10;
  }

  // === SERIALIZATION ===
  toJSON() {
    const inv = {};
    for (let [key, val] of this.inventory) {
      inv[key] = val.quantity;
    }
    return {
      name: this.name,
      location: this.location,
      population: this.population,
      inventory: inv,
      holidays: this.holidays,
      bookHolidays: this.bookHolidays || [],
      stockedBooks: this.stockedBooks || [],
      buildingVariant: this.buildingVariant,
      priceHistory: this.priceHistory,
      reputation: this.reputation,
      hasGamblingDen: this.hasGamblingDen || false,
      hasBank: this.hasBank || false,
      hasBlackMarket: this.hasBlackMarket || false,
      hasBountyBoard: this.hasBountyBoard || false,
      hasWeaponShop: this.hasWeaponShop || false,
      hasWinery: this.hasWinery || false,
      hasSchool: this.hasSchool || false,
      hasLibrary: this.hasLibrary || false,
      hasUniversity: this.hasUniversity || false,
      hasResearchLab: this.hasResearchLab || false,
      hasSpaceport: this.hasSpaceport || false,
      hasAlienExchange: this.hasAlienExchange || false,
      stockedWeapons: this.stockedWeapons || [],
      progression: this.progression || this._createProgressionState(),
    };
  }

  static fromJSON(data) {
    const city = new City({
      name: data.name,
      location: data.location,
      population: data.population,
      stockProfile: "loaded"
    });
    city.buildingVariant = data.buildingVariant || 0;
    city.holidays = data.holidays || [];
    city.bookHolidays = data.bookHolidays || [];
    city.stockedBooks = data.stockedBooks || [];
    city.priceHistory = data.priceHistory || {};
    city.reputation = typeof data.reputation === 'number' ? data.reputation : 50;
    city.hasGamblingDen = data.hasGamblingDen || false;
    city.hasBank = data.hasBank || false;
    city.hasBlackMarket = data.hasBlackMarket || false;
    city.hasBountyBoard = data.hasBountyBoard || false;
    city.hasWeaponShop = data.hasWeaponShop || false;
    city.hasWinery = data.hasWinery || false;
    city.hasSchool = data.hasSchool || false;
    city.hasLibrary = data.hasLibrary || false;
    city.hasUniversity = data.hasUniversity || false;
    city.hasResearchLab = data.hasResearchLab || false;
    city.hasSpaceport = data.hasSpaceport || false;
    city.hasAlienExchange = data.hasAlienExchange || false;
    city.stockedWeapons = data.stockedWeapons || [];
    city.progression = data.progression && typeof data.progression === 'object'
      ? data.progression
      : city._createProgressionState();
    city._ensureProgressionState();

    // Rebuild inventory from saved quantities
    city.inventory.clear();
    if (data.inventory) {
      for (let [key, qty] of Object.entries(data.inventory)) {
        if (ItemLibrary[key] && qty > 0) {
          city.inventory.set(key, { item: ItemLibrary[key], quantity: qty });
        }
      }
    }

    // Re-stock weapon inventory AFTER inventory rebuild (only missing ones)
    if (city.hasWeaponShop && city.stockedWeapons.length > 0) {
      for (const wk of city.stockedWeapons) {
        if (ItemLibrary[wk] && !city.inventory.has(wk)) {
          city._addOrIncrement(wk, 1);
        }
      }
    }
    return city;
  }

  // === STATIC: City generation ===
  static generateCities(grid, count, namePool) {
    const gridRows = Array.isArray(grid) ? grid.length : 0;
    const gridCols = Array.isArray(grid?.[0]) ? grid[0].length : 0;
    const resolvedRows = (typeof rows !== 'undefined' && Number.isFinite(Number(rows)) && Number(rows) > 0)
      ? Number(rows)
      : gridRows;
    const resolvedCols = (typeof cols !== 'undefined' && Number.isFinite(Number(cols)) && Number(cols) > 0)
      ? Number(cols)
      : gridCols;
    const mapDim = Math.max(resolvedRows, resolvedCols);
    const minDist = Math.max(6, Math.floor(mapDim / 15));
    const minDistSq = minDist * minDist;

    // Spatial hash for fast proximity checks (cell size = minDist)
    const cellSize = minDist;
    const spatialHash = new Map(); // "cx,cy" → [{x,y}, ...]

    function hashKey(x, y) {
      return ((x / cellSize) | 0) + ',' + ((y / cellSize) | 0);
    }

    function tooCloseToExisting(x, y) {
      const cx = (x / cellSize) | 0;
      const cy = (y / cellSize) | 0;
      // Check 3×3 neighbourhood in spatial hash
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const key = (cx + dx) + ',' + (cy + dy);
          const bucket = spatialHash.get(key);
          if (!bucket) continue;
          for (const pt of bucket) {
            const ddx = pt.x - x;
            const ddy = pt.y - y;
            if (ddx * ddx + ddy * ddy < minDistSq) return true;
          }
        }
      }
      return false;
    }

    function addToHash(x, y) {
      const key = hashKey(x, y);
      let bucket = spatialHash.get(key);
      if (!bucket) { bucket = []; spatialHash.set(key, bucket); }
      bucket.push({ x, y });
    }

    const cities = [];
    const usedNames = new Set();

    // Random sampling: pick random tiles until we find enough valid spots.
    // For very large maps, random hits on non-water tiles are common enough.
    // Limit total attempts to prevent infinite loops on water-heavy maps.
    const maxAttempts = Math.max(count * 200, 100000);
    let attempts = 0;

    while (cities.length < count && attempts < maxAttempts) {
      attempts++;
      const x = Math.floor(_bqCityRand() * resolvedCols);
      const y = Math.floor(_bqCityRand() * resolvedRows);

      if (!grid?.[y]?.[x]?.options?.[0] || grid[y][x].options[0] === 'Water') continue;
      if (tooCloseToExisting(x, y)) continue;

      let name;
      if (usedNames.size >= namePool.length) {
        name = `City${cities.length + 1}`;
      } else {
        do {
          name = namePool[Math.floor(_bqCityRand() * namePool.length)];
        } while (usedNames.has(name));
      }
      usedNames.add(name);

      const population = Math.floor(_bqCityRand() * 900 + 300);
      const city = new City({ name, location: { x, y }, population });
      cities.push(city);
      addToHash(x, y);
    }

    return cities;
  }

  addInventoryBasedOnTerrain(grid, radius = 1) {
    const { x, y } = this.location;
    const counts = { Water: 0, Grass: 0, Rock: 0, Sand: 0, Forest: 0, Snow: 0, Sulfur: 0 };

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
          const tile = grid[ny][nx];
          if (!tile || !tile.options) continue;
          const type = tile.options[0];
          if (counts[type] !== undefined) counts[type]++;
        }
      }
    }

    if (counts.Rock > 0) {
      this._addOrIncrement("Iron", counts.Rock * 2);
      this._addOrIncrement("Stone", counts.Rock);
    }
    if (counts.Grass > 0) {
      this._addOrIncrement("Wheat", counts.Grass * 3);
      this._addOrIncrement("Herbs", Math.floor(counts.Grass / 2));
    }
    if (counts.Sand > 0) {
      this._addOrIncrement("Clay", counts.Sand * 3);
    }
    if (counts.Sulfur > 0) {
      this._addOrIncrement("MoonOre", counts.Sulfur * 2);
      this._addOrIncrement("Salt", Math.max(1, Math.floor(counts.Sulfur / 2)));
    }
    if (counts.Water > 0) {
      this._addOrIncrement("Fish", counts.Water * 4);
      this._addOrIncrement("Salt", counts.Water);
    }
    if (counts.Forest > 0) {
      this._addOrIncrement("Wood", counts.Forest * 3);
      this._addOrIncrement("Fur", counts.Forest);
    }
    if (counts.Snow > 0) {
      this._addOrIncrement("Fur", counts.Snow * 2);
    }
  }

  /**
   * Detect which cities are coastal (adjacent to water within 2 tiles).
   * Sets city.isCoastal = true and city.port = true for those cities.
   */
  static detectCoastalCities(cityList, grid, numRows, numCols) {
    for (const city of cityList) {
      city.isCoastal = false;
      city.port = false;
      const { x, y } = city.location;
      for (let dy = -2; dy <= 2 && !city.isCoastal; dy++) {
        for (let dx = -2; dx <= 2 && !city.isCoastal; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < numCols && ny >= 0 && ny < numRows) {
            if (grid[ny][nx]?.options[0] === 'Water') {
              city.isCoastal = true;
              city.port = true;
            }
          }
        }
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.City = City;
}


class NameGenerator {
  static generateNames(min = 80, max = 5000) {
    const prefixes = [
      "Bald", "Bank", "Belle", "Box", "Bridge", "Camp", "Cannon", "Castle", "Clear", "Day", "East",
      "Edge", "Ever", "Fern", "Forest", "Fresh", "Great", "King", "Knob", "Knox", "Mount", "Morning",
      "New", "North", "Pacific", "Queens", "Red", "Ridge", "Ring", "River", "Rose", "Sand",
      "South", "Spring", "Strath", "Stock", "Stoke", "Stone", "Water", "Well", "West", "Wood", "Kiah",
      "Bear", "Bee", "Bird", "Crane", "Crow", "Eagle", "Fox", "Moose", "Owl", "Swan", "Wolf",
      "Baker", "Gillmen", "WaveMan", "Swoard",
      "Black", "Blue", "Brown", "Copper", "Gold", "Green", "Grey", "Hazel", "Orange",
      "Plum", "Silver", "White", "Yellow",
      "Alexandra", "Brad", "Carole", "Clare", "Cooper", "Craig", "Elizabeth", "Erin",
      "Evan", "Glen", "Kirk", "Lea", "Mary", "Scott",
      "Diamond", "Iron", "Lime", "Marble", "Pumice", "Sandstone", "Slate",
      "Ash", "Cedar", "Cherry", "Elm", "Maple", "Oak", "Pine", "Willow",
    ];

    const suffixes = [
      "bank", "bark", "barrow", "bay", "beach", "bell", "borough", "bourne", "broad", "bridge",
      "brook", "brough", "burgh", "burn", "bury", "by", "canyon", "caster", "chester", "cliffe",
      "combe", "cot", "cott", "cote", "cove", "creek", "croft", "crook", "dale", "den", "din",
      "dine", "don", "downs", "falls", "field", "fin", "flats", "ford", "fork", "gate", "grove",
      "gum", "ham", "harbour", "heights", "hill", "holm", "hurst", "ing", "kirk", "land", "lake",
      "latch", "lea", "leigh", "ley", "marsh", "mere", "minster", "mond", "mont", "more", "ness",
      "park", "pilly", "pine", "point", "pond", "ridge", "river", "rock", "sett", "side", "son",
      "stead", "stoke", "stone", "stow", "terrace", "thorpe", "ton", "tor", "town", "vale", "valley",
      "view", "village", "ville", "water", "well", "wharf", "wick", "wood", "worth", "Romea", "Gentry", "Kozdra" ,"Strayer", "Tetaban"
    ];

    const names = new Set();
    const total = Math.floor(_bqCityRand() * (max - min + 1)) + min;

    while (names.size < total) {
      const prefix = prefixes[Math.floor(_bqCityRand() * prefixes.length)];
      const suffix = suffixes[Math.floor(_bqCityRand() * suffixes.length)];
      const name = prefix + suffix.charAt(0).toUpperCase() + suffix.slice(1);
      names.add(name);
    }

    return [...names];
  }
}
