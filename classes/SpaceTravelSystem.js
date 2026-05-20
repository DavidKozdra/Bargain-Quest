// SpaceTravelSystem.js — Space travel orchestrator
// Mirrors Boat.js vessel patterns for ship stats, storage, and condition.
// Owns route rules, docking clearance, landing, and encounter resolution.

const SPACE_FUEL_ENABLED = false;

// ── Ship Library ────────────────────────────────────────
const SpaceShipLibrary = {
  shuttle: {
    type: 'shuttle',
    displayName: 'Shuttle',
    cost: 800,
    speed: 160,          // ms per tile (higher = slower)
    cargoBonus: 12,
    crewSize: 1,
    hp: 4,
    attack: 1,
    fuelCapacity: 50,
    description: 'A compact orbital shuttle. Cheap to maintain, limited cargo.',
    icon: '🛸',
    iconFrame: 'shuttle',
  },
  freighter: {
    type: 'freighter',
    displayName: 'Freighter',
    cost: 2000,
    speed: 120,
    cargoBonus: 40,
    crewSize: 3,
    hp: 6,
    attack: 1,
    fuelCapacity: 80,
    description: 'A bulky hauler built for cargo runs. Slow but carries everything.',
    icon: '🚀',
    iconFrame: 'freighter',
  },
  corvette: {
    type: 'corvette',
    displayName: 'Corvette',
    cost: 3500,
    speed: 80,
    cargoBonus: 25,
    crewSize: 4,
    hp: 10,
    attack: 4,
    fuelCapacity: 100,
    description: 'A fast armed ship. Good combat and decent hold.',
    icon: '⚔️',
    iconFrame: 'corvette',
  },
};

// ── Space Captain Tiers ─────────────────────────────────
const SpaceCaptainLibrary = {
  cadet: {
    tier: 'cadet',
    label: 'Cadet',
    icon: '🧑‍🚀',
    hireCost: 300,
    salary: 12,
    accuracy: 0.40,
    evasion: 0.10,
    fuelEfficiency: 1.0,
    desc: 'Fresh academy graduate. Cheap, eager, and a little rough in the void.',
  },
  commander: {
    tier: 'commander',
    label: 'Commander',
    icon: '🎖️',
    hireCost: 700,
    salary: 22,
    accuracy: 0.60,
    evasion: 0.22,
    fuelEfficiency: 0.85,
    desc: 'Experienced officer. Efficient and reliable.',
  },
  ace: {
    tier: 'ace',
    label: 'Ace',
    icon: '👑',
    hireCost: 1500,
    salary: 40,
    accuracy: 0.80,
    evasion: 0.36,
    fuelEfficiency: 0.70,
    desc: 'Legendary pilot. Deadly in combat and razor-sharp on maneuvers.',
  },
};

const SpaceCaptainNames = [
  'Zara', 'Korvax', 'Mira', 'Idris', 'Solene', 'Renn', 'Talis', 'Voss',
  'Nyra', 'Cael', 'Orion', 'Lyssa', 'Jax', 'Nova', 'Kiran', 'Thane',
];

function createSpaceCaptainProfile(tier = 'cadet', name = null) {
  const def = SpaceCaptainLibrary[tier] || SpaceCaptainLibrary.cadet;
  return {
    name: (name && String(name).trim()) || SpaceCaptainNames[Math.floor(Math.random() * SpaceCaptainNames.length)],
    tier: def.tier,
    label: def.label,
    icon: def.icon,
    hireCost: def.hireCost,
    salary: def.salary,
    accuracy: def.accuracy,
    evasion: def.evasion,
    fuelEfficiency: def.fuelEfficiency,
  };
}

// ── SpaceShip Class ─────────────────────────────────────
class SpaceShip {
  constructor(type, name) {
    const template = SpaceShipLibrary[type];
    if (!template) throw new Error(`Unknown ship type: ${type}`);

    this.type = type;
    this.name = name || SpaceShip.randomName();
    this.displayName = template.displayName;
    this.speed = template.speed;
    this.cargoBonus = template.cargoBonus;
    this.crewSize = template.crewSize;
    this.hp = template.hp;
    this.attack = template.attack;
    this.fuelCapacity = template.fuelCapacity;
    this.iconFrame = template.iconFrame || template.type;
    this.condition = 100;
    this.fuel = template.fuelCapacity; // start full
    this.storage = new Map();
    this.captain = null;
  }

  static randomName() {
    const prefixes = ['ISS', 'HSS', 'The', 'SS', 'RSV'];
    const names = [
      'Wanderer', 'Starchaser', 'Horizon', 'Eclipse', 'Nebula',
      'Comet Trail', 'Void Runner', 'Starbound', 'Dawnbreaker', 'Iron Orbit',
      'Silver Wing', 'Dark Frontier', 'Lumina', 'Pilgrim', 'Forge Star',
    ];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const name = names[Math.floor(Math.random() * names.length)];
    return `${prefix} ${name}`;
  }

  // ─── Effective stats (degrade with condition) ───

  getEffectiveSpeed() {
    const factor = 0.5 + 0.5 * (this.condition / 100);
    return Math.round(this.speed / factor);
  }

  getEffectiveCargo() {
    return Math.ceil(this.cargoBonus * (0.5 + 0.5 * this.condition / 100));
  }

  getEffectiveHP() {
    const baseHP = (SpaceShipLibrary[this.type]?.hp || 4) * 2;
    return Math.max(1, Math.round(baseHP * this.condition / 100));
  }

  getEffectiveFuelCapacity() {
    return Math.ceil(this.fuelCapacity * (0.7 + 0.3 * this.condition / 100));
  }

  // ─── Travel Cost Compatibility ───

  /** Kept for save compatibility while the fuel system is disabled. */
  getFuelCost(routeDistance) {
    if (!SPACE_FUEL_ENABLED) return 0;
    const base = Math.max(1, Math.ceil(routeDistance * 0.4));
    const captainMod = this.captain?.fuelEfficiency || 1.0;
    return Math.max(1, Math.ceil(base * captainMod));
  }

  consumeFuel(amount) {
    if (!SPACE_FUEL_ENABLED) return this.fuel;
    this.fuel = Math.max(0, Math.round(this.fuel - amount));
    return this.fuel;
  }

  refuel(amount) {
    if (!SPACE_FUEL_ENABLED) return this.fuel;
    this.fuel = Math.min(this.getEffectiveFuelCapacity(), Math.round(this.fuel + amount));
    return this.fuel;
  }

  // ─── Condition ───

  applyDamage(amount) {
    this.condition = Math.max(0, Math.round(this.condition - amount));
  }

  repair(points) {
    this.condition = Math.min(100, Math.round(this.condition + points));
  }

  getRepairCost() {
    const missing = 100 - this.condition;
    if (missing <= 0) return { gold: 0, goldOnly: 0, parts: 0 };
    const baseCost = SpaceShipLibrary[this.type]?.cost || 800;
    const baseGold = Math.max(1, Math.ceil(missing * baseCost * 0.004));
    const parts = Math.max(1, Math.ceil(missing / 15));
    return {
      gold: baseGold,
      goldOnly: Math.ceil(baseGold * 2.5),
      parts,
    };
  }

  // ─── Storage ───

  getStorageCapacity() { return this.getEffectiveCargo(); }

  getStorageWeight() {
    let total = 0;
    for (const [, entry] of this.storage) {
      total += (entry.item?.weight || 1) * entry.quantity;
    }
    return total;
  }

  getAvailableStorageSpace() {
    return Math.max(0, this.getStorageCapacity() - this.getStorageWeight());
  }

  addItemToStorage(itemKey, qty = 1, force = false) {
    const libItem = typeof ItemLibrary !== 'undefined' ? ItemLibrary[itemKey] : null;
    if (!libItem) return false;
    if (!force && (libItem.weight || 1) * qty > this.getAvailableStorageSpace()) return false;
    const existing = this.storage.get(itemKey);
    if (existing) {
      existing.quantity += qty;
    } else {
      this.storage.set(itemKey, { item: libItem, quantity: qty });
    }
    return true;
  }

  removeItemFromStorage(itemKey, qty = 1) {
    const entry = this.storage.get(itemKey);
    if (!entry || entry.quantity < qty) return false;
    entry.quantity -= qty;
    if (entry.quantity <= 0) this.storage.delete(itemKey);
    return true;
  }

  isCritical() { return this.condition <= 20; }
  hasCaptain() { return !!(this.captain && this.captain.name); }

  conditionLabel() {
    if (this.condition >= 90) return 'Pristine';
    if (this.condition >= 70) return 'Good';
    if (this.condition >= 45) return 'Worn';
    if (this.condition >= 21) return 'Damaged';
    return 'Critical';
  }

  conditionColor() {
    if (this.condition >= 60) return '#4caf50';
    if (this.condition > 20) return '#ff9800';
    return '#f44336';
  }

  getRefuelCost(amount) {
    if (!SPACE_FUEL_ENABLED) return 0;
    const fuelPricePerUnit = 3; // gold per fuel unit
    return Math.ceil(Math.min(amount, this.getEffectiveFuelCapacity() - this.fuel) * fuelPricePerUnit);
  }

  toJSON() {
    return {
      type: this.type,
      name: this.name,
      condition: this.condition,
      fuel: this.fuel,
      captain: this.captain ? { ...this.captain } : null,
      storage: Array.from(this.storage.entries()).map(([key, entry]) => ({
        key, quantity: entry.quantity,
      })),
    };
  }

  static fromJSON(data) {
    if (!data?.type || !SpaceShipLibrary[data.type]) return null;
    const ship = new SpaceShip(data.type, data.name || undefined);
    ship.condition = Math.max(0, Math.min(100, Math.floor(Number(data.condition) || 100)));
    ship.fuel = Math.max(0, Math.min(ship.fuelCapacity, Math.floor(Number(data.fuel) || 0)));
    if (data.captain && typeof data.captain === 'object' && data.captain.tier) {
      ship.captain = createSpaceCaptainProfile(data.captain.tier, data.captain.name);
    }
    if (Array.isArray(data.storage)) {
      for (const entry of data.storage) {
        if (entry?.key && typeof entry.key === 'string' && entry.quantity > 0) {
          ship.addItemToStorage(entry.key, Math.floor(Number(entry.quantity)), true);
        }
      }
    }
    return ship;
  }
}

// ── Travel Phases ───────────────────────────────────────
const SpaceTravelPhase = {
  GROUNDED: 'grounded',
  LAUNCH_PREP: 'launch_prep',
  ASCENDING: 'ascending',
  IN_ORBIT: 'in_orbit',
  LANDED: 'landed',
  REENTRY: 'reentry',
};

function _bqDeepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) {
    _bqDeepFreeze(value[key]);
  }
  return value;
}

function _bqCloneList(list) {
  return Array.isArray(list) ? list.slice() : [];
}

function _bqMergeTags(...lists) {
  return [...new Set(lists.flatMap((entry) => _bqCloneList(entry)).filter(Boolean))];
}

const BASE_SPACE_WORLD_GRAPH = _bqDeepFreeze({
  systems: {
    orbit: {
      key: 'orbit',
      x: 0.22,
      y: 0.56,
      label: 'Earth Orbit',
      catalogName: 'Earth Orbit',
      kindLabel: 'Home System',
      accent: '#63c7ff',
      description: 'Human home orbit with blue oceans below, shipyards above, and the safest re-entry corridor.',
      owner: 'Terran Assembly',
      faction: 'Human Commonwealth',
      marketTags: ['shipyards', 'consumer goods', 'fuel logistics'],
      contractTags: ['launch logistics', 'orbital freight', 'escort'],
      colonySupport: 'capital core',
      starName: 'Sol',
      primaryBodyKey: 'homeworld',
      catalogHidden: true,
      bodies: [
        {
          key: 'homeworld',
          name: 'Earth',
          kind: 'planet',
          orbitRadius: 430,
          angle: 1.8,
          radius: 92,
          accent: '#4fc3f7',
          surfacePalette: 'earth',
          owner: 'Terran Assembly',
          faction: 'Human Commonwealth',
          description: 'The origin world: blue oceans, dense cities, and the biggest consumer market in human space.',
          biome: 'temperate',
          marketTags: ['consumer goods', 'food exports', 'industrial supply'],
          contractTags: ['diplomatic', 'passenger', 'high-value cargo'],
          colonySupport: 'capital world',
          landingAllowed: true,
          dockingAllowed: true,
        },
        {
          key: 'sol-station',
          name: 'Orbital Shipyard',
          kind: 'station',
          orbitRadius: 650,
          angle: 5.0,
          radius: 40,
          accent: '#ffe6a6',
          owner: 'Shipwright Guild',
          faction: 'Human Commonwealth',
          description: 'A shipyard ring where hull upgrades, refits, and freight charters all change hands.',
          biome: 'orbital',
          marketTags: ['ship repairs', 'fuel', 'cargo brokerage'],
          contractTags: ['repair', 'freight', 'escort'],
          colonySupport: 'orbital industrial node',
          landingAllowed: true,
          dockingAllowed: true,
        },
        {
          key: 'luna-dock',
          name: 'Luna Dock',
          kind: 'planet',
          orbitRadius: 880,
          angle: 0.5,
          radius: 58,
          accent: '#d9e2f2',
          owner: 'Luna Compact',
          faction: 'Free Dock Accord',
          description: 'A gray moon port specializing in ore sorting, fuel depots, and short-haul cargo.',
          biome: 'moon',
          marketTags: ['ore logistics', 'fuel depots', 'warehouse customs'],
          contractTags: ['courier', 'ore freight', 'patrol'],
          colonySupport: 'lunar outpost',
          landingAllowed: true,
          dockingAllowed: true,
          goods: ['MoonOre', 'StellarGlass'],
          alienPresence: 'low',
          alienTone: 'curious',
        },
      ],
      asteroidBelts: [
        { key: 'sol-belt', radius: 1280, count: 22, accent: '#c9d4df' },
      ],
    },
    luna: {
      key: 'luna',
      x: 0.55,
      y: 0.22,
      label: 'Luna Reach',
      catalogName: 'Luna Station',
      kindLabel: 'Station System',
      accent: '#d6dfff',
      description: 'A fortified logistics system anchored by a neutral station cluster.',
      owner: 'Luna Compact',
      faction: 'Free Dock Accord',
      marketTags: ['ore exchange', 'ship chandlery', 'relay logistics'],
      contractTags: ['convoy escort', 'ore freight', 'customs patrol'],
      colonySupport: 'industrial outpost',
      starName: 'Reach Beacon',
      primaryBodyKey: 'luna-station',
      travelCost: 250,
      researchCost: 0,
      bodies: [
        {
          key: 'luna-station',
          name: 'Luna Station',
          kind: 'station',
          orbitRadius: 320,
          angle: 0.25,
          radius: 48,
          accent: '#dce6ff',
          owner: 'Luna Compact',
          faction: 'Free Dock Accord',
          description: 'A quiet moon hub with rare ore and dependable trade lanes.',
          biome: 'orbital',
          marketTags: ['ore exchange', 'dock services', 'supply brokerage'],
          contractTags: ['dockwork', 'freight', 'escort'],
          colonySupport: 'station city',
          landingAllowed: true,
          dockingAllowed: true,
          goods: ['MoonOre', 'StellarGlass'],
          alienPresence: 'low',
          alienTone: 'curious',
        },
        {
          key: 'grayhold',
          name: 'Grayhold',
          kind: 'planet',
          orbitRadius: 580,
          angle: 2.2,
          radius: 84,
          accent: '#aeb9d9',
          owner: 'Grayhold Syndics',
          faction: 'Free Dock Accord',
          description: 'A cratered mining world feeding Luna’s depots with refined metal and salvage.',
          biome: 'moon',
          marketTags: ['ore refining', 'heavy industry'],
          contractTags: ['mining', 'salvage', 'bulk freight'],
          colonySupport: 'mining colony',
          landingAllowed: true,
          dockingAllowed: true,
        },
        {
          key: 'ice-veil',
          name: 'Ice Veil',
          kind: 'planet',
          orbitRadius: 860,
          angle: 5.35,
          radius: 62,
          accent: '#bce9ff',
          owner: 'Reach Water Trust',
          faction: 'Free Dock Accord',
          description: 'A cold extraction moon with water harvesters and cryo-storage vaults.',
          biome: 'ice',
          marketTags: ['ice harvest', 'life support', 'bulk storage'],
          contractTags: ['supply', 'survey', 'escort'],
          colonySupport: 'resource outpost',
          landingAllowed: true,
          dockingAllowed: true,
        },
      ],
      asteroidBelts: [
        { key: 'haul-belt', radius: 1120, count: 30, accent: '#c0d1e8' },
      ],
    },
    aurelia: {
      key: 'aurelia',
      x: 0.77,
      y: 0.60,
      label: 'Aurelia Bloom',
      catalogName: 'Aurelia Bloom',
      kindLabel: 'Trade System',
      accent: '#7ff0b4',
      description: 'A bright green trade system full of habitable worlds and rich flora exports.',
      owner: 'Aurelian Trade Chorus',
      faction: 'Aurelian Chorus',
      marketTags: ['xeno-botanicals', 'luxury fibers', 'merchant guilds'],
      contractTags: ['merchant escort', 'botanical survey', 'trade charter'],
      colonySupport: 'garden colony network',
      starName: 'Bloom Star',
      primaryBodyKey: 'aurelia-prime',
      travelCost: 420,
      researchCost: 60,
      bodies: [
        {
          key: 'aurelia-prime',
          name: 'Aurelia Prime',
          kind: 'planet',
          orbitRadius: 420,
          angle: 1.4,
          radius: 96,
          accent: '#8affbd',
          owner: 'Aurelian Trade Chorus',
          faction: 'Aurelian Chorus',
          description: 'A living planet with alien fiber markets and botanical vaults.',
          biome: 'lush',
          marketTags: ['xeno-botanicals', 'fiber looms', 'luxury produce'],
          contractTags: ['trade', 'diplomatic', 'survey'],
          colonySupport: 'lush colony',
          landingAllowed: true,
          dockingAllowed: true,
          goods: ['XenoFiber', 'Spices'],
          alienPresence: 'medium',
          alienTone: 'friendly',
        },
        {
          key: 'verdant-ring',
          name: 'Verdant Ring',
          kind: 'station',
          orbitRadius: 650,
          angle: 4.7,
          radius: 42,
          accent: '#f0ffd4',
          owner: 'Verdant Exchange Authority',
          faction: 'Aurelian Chorus',
          description: 'A customs ring where alien brokers, visiting traders, and inspectors meet.',
          biome: 'orbital',
          marketTags: ['brokerage', 'customs', 'trade permits'],
          contractTags: ['brokerage', 'escort', 'inspection'],
          colonySupport: 'orbital trade nexus',
          landingAllowed: true,
          dockingAllowed: true,
        },
        {
          key: 'bloom-moon',
          name: 'Bloom Moon',
          kind: 'planet',
          orbitRadius: 930,
          angle: 5.8,
          radius: 58,
          accent: '#d1ffd3',
          owner: 'Garden Keepers',
          faction: 'Aurelian Chorus',
          description: 'A smaller moon used for gene vaults, rare seed banks, and research habitats.',
          biome: 'garden',
          marketTags: ['research', 'botanical samples', 'luxury seeds'],
          contractTags: ['research', 'courier', 'survey'],
          colonySupport: 'research enclave',
          landingAllowed: true,
          dockingAllowed: true,
        },
      ],
      asteroidBelts: [
        { key: 'pollen-belt', radius: 1220, count: 26, accent: '#7ff0b4' },
      ],
    },
    vanta: {
      key: 'vanta',
      x: 0.46,
      y: 0.84,
      label: 'Vanta Rift',
      catalogName: 'Vanta Rift',
      kindLabel: 'Hazard System',
      accent: '#ff9d7a',
      description: 'A dangerous dark system riddled with asteroid belts and outlaw traffic.',
      owner: 'Rift Consortium',
      faction: 'Rift Clans',
      marketTags: ['salvage', 'contraband', 'hazard freight'],
      contractTags: ['privateer', 'smuggling', 'relic recovery'],
      colonySupport: 'frontier outposts',
      starName: 'Rift Star',
      primaryBodyKey: 'vanta-major',
      travelCost: 760,
      researchCost: 140,
      bodies: [
        {
          key: 'rift-anchor',
          name: 'Rift Anchor',
          kind: 'station',
          orbitRadius: 360,
          angle: 2.7,
          radius: 44,
          accent: '#ffe1d2',
          owner: 'Rift Consortium',
          faction: 'Rift Clans',
          description: 'A hard-shell station that taxes smugglers by day and fences salvage by night.',
          biome: 'orbital',
          marketTags: ['salvage', 'black market', 'security'],
          contractTags: ['privateer', 'escort', 'collection'],
          colonySupport: 'fortified station',
          landingAllowed: true,
          dockingAllowed: true,
        },
        {
          key: 'vanta-major',
          name: 'Vanta Major',
          kind: 'planet',
          orbitRadius: 700,
          angle: 5.1,
          radius: 90,
          accent: '#ff9d7a',
          owner: 'Rift Clans',
          faction: 'Rift Clans',
          description: 'A hostile world full of relic caches, smugglers, and unstable ruins.',
          biome: 'hazard',
          marketTags: ['relic salvage', 'contraband', 'hazard pay'],
          contractTags: ['relic recovery', 'smuggling', 'combat escort'],
          colonySupport: 'frontier colony',
          landingAllowed: true,
          dockingAllowed: true,
          goods: ['AlienRelic', 'StellarGlass'],
          alienPresence: 'high',
          alienTone: 'hostile',
        },
        {
          key: 'ember-shard',
          name: 'Ember Shard',
          kind: 'planet',
          orbitRadius: 980,
          angle: 0.8,
          radius: 54,
          accent: '#ffc08c',
          owner: 'Ashen Prospectors',
          faction: 'Rift Clans',
          description: 'A molten fragment-world worked by prospectors, scavengers, and exile crews.',
          biome: 'volcanic',
          marketTags: ['ore salvage', 'refined glass', 'hazard gear'],
          contractTags: ['survey', 'salvage', 'prospecting'],
          colonySupport: 'prospector camp',
          landingAllowed: true,
          dockingAllowed: true,
        },
      ],
      asteroidBelts: [
        { key: 'rift-belt', radius: 1180, count: 42, accent: '#ff8c6f' },
        { key: 'outer-belt', radius: 1460, count: 24, accent: '#b36f62' },
      ],
    },
  },
  routes: [
    { from: 'orbit', to: 'luna', distance: 10, dangerRating: 0.05 },
    { from: 'orbit', to: 'aurelia', distance: 22, dangerRating: 0.15 },
    { from: 'orbit', to: 'vanta', distance: 38, dangerRating: 0.35 },
    { from: 'luna', to: 'aurelia', distance: 18, dangerRating: 0.10 },
    { from: 'luna', to: 'vanta', distance: 30, dangerRating: 0.25 },
    { from: 'aurelia', to: 'vanta', distance: 20, dangerRating: 0.30 },
  ],
});

const SPACE_FRONTIER_NAME_PREFIXES = Object.freeze([
  'Nyx', 'Helios', 'Cinder', 'Tethys', 'Astra', 'Drift', 'Eon', 'Kepler', 'Morrow', 'Orison',
  'Halo', 'Sable', 'Vesper', 'Lattice', 'Argent', 'Glass', 'Fallow', 'Hollow', 'Vector', 'Pioneer',
]);
const SPACE_FRONTIER_NAME_SUFFIXES = Object.freeze([
  'Reach', 'Spur', 'Basin', 'March', 'Crown', 'Belt', 'Fold', 'Haven', 'Rift', 'Bloom',
  'Veil', 'Anchor', 'Terminus', 'Expanse', 'Harbor', 'Wastes', 'Hollow', 'Circuit', 'Drift', 'Gate',
]);
const SPACE_FRONTIER_ARCHETYPES = Object.freeze([
  {
    biome: 'lush',
    kindLabel: 'Trade System',
    accent: '#7de3b3',
    owner: 'Frontier Exchange',
    faction: 'Free Traders',
    description: 'A fertile merchant system with easy ports, alien gardens, and soft markets.',
    marketTags: ['fiber trade', 'consumer goods', 'botanical exports'],
    contractTags: ['merchant escort', 'survey', 'courier'],
    colonySupport: 'trade colony',
    goods: ['XenoFiber', 'Spices'],
    danger: 0.12,
  },
  {
    biome: 'ice',
    kindLabel: 'Ice System',
    accent: '#bfe8ff',
    owner: 'Coldwater Guild',
    faction: 'Ice Prospectors',
    description: 'A cold extraction system built on cryo-mines, refineries, and sealed depots.',
    marketTags: ['ice harvest', 'fuel depots', 'bulk storage'],
    contractTags: ['supply', 'escort', 'survey'],
    colonySupport: 'resource outpost',
    goods: ['MoonOre', 'FrozenCore'],
    danger: 0.18,
  },
  {
    biome: 'volcanic',
    kindLabel: 'Volcanic System',
    accent: '#ffb177',
    owner: 'Ashline Prospectors',
    faction: 'Prospector Union',
    description: 'A furnace system of magma worlds, refineries, and convoy lanes under constant heat stress.',
    marketTags: ['ore refining', 'hazard gear', 'industrial supply'],
    contractTags: ['salvage', 'prospecting', 'escort'],
    colonySupport: 'prospector camps',
    goods: ['MoonOre', 'StellarGlass'],
    danger: 0.26,
  },
  {
    biome: 'hazard',
    kindLabel: 'Frontier Hazard System',
    accent: '#ff8f86',
    owner: 'Rift Survey',
    faction: 'Outland Clans',
    description: 'A violent frontier of relic fields, outlaw depots, and unstable orbital lanes.',
    marketTags: ['contraband', 'relic salvage', 'hazard freight'],
    contractTags: ['combat escort', 'recovery', 'smuggling'],
    colonySupport: 'hard frontier',
    goods: ['AlienRelic', 'StellarGlass'],
    danger: 0.34,
  },
  {
    biome: 'garden',
    kindLabel: 'Garden System',
    accent: '#d8ffab',
    owner: 'Seed Archive',
    faction: 'Verdant Keepers',
    description: 'A cultured garden system of seed vaults, research moons, and luminous trade corridors.',
    marketTags: ['luxury seeds', 'research', 'xeno-botanicals'],
    contractTags: ['research', 'courier', 'diplomatic'],
    colonySupport: 'research enclave',
    goods: ['BioLumen', 'XenoFiber'],
    danger: 0.16,
  },
  {
    biome: 'asteroid',
    kindLabel: 'Belt System',
    accent: '#d2c0ff',
    owner: 'Loose Claims Compact',
    faction: 'Belt Freeholds',
    description: 'A sprawling belt economy stitched together by tug traffic, salvage claims, and drifting stations.',
    marketTags: ['salvage', 'ore exchange', 'black market'],
    contractTags: ['tug escort', 'mining', 'private freight'],
    colonySupport: 'belt habitats',
    goods: ['VoidCrystal', 'MoonOre'],
    danger: 0.22,
  },
  {
    biome: 'jungle',
    kindLabel: 'Canopy System',
    accent: '#85f0c1',
    owner: 'Canopy Accord',
    faction: 'Verdani',
    description: 'A humid alien system rich in living materials, dense canopies, and guarded barter circles.',
    marketTags: ['organic tech', 'alien food', 'rare fibers'],
    contractTags: ['barter charter', 'survey', 'diplomatic'],
    colonySupport: 'living colonies',
    goods: ['BioLumen', 'StarSpice'],
    danger: 0.2,
  },
]);

let SPACE_WORLD_GRAPH = null;
let SPACE_BODY_INDEX = new Map();
let SPACE_SYSTEM_LAYOUT = Object.freeze({});
let _bqSpaceWorldSeed = null;

function _bqCloneSpaceGraphData(graph) {
  return JSON.parse(JSON.stringify(graph));
}

function _bqBuildBodyIndex(graph) {
  const index = new Map();
  for (const system of Object.values(graph.systems || {})) {
    for (const body of system.bodies || []) {
      index.set(body.key, {
        ...body,
        systemKey: system.key,
        systemLabel: system.label,
        systemOwner: system.owner || null,
        systemFaction: system.faction || null,
        systemKind: system.kindLabel || 'System',
      });
    }
  }
  return index;
}

function _bqBuildSystemLayout(graph) {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(graph.systems || {}).map(([key, system]) => [key, {
        x: system.x,
        y: system.y,
        label: system.label,
        accent: system.accent,
        description: system.description,
      }])
    )
  );
}

function _bqRandomFrom(list, rng) {
  return list[Math.floor(rng() * list.length)] || list[0] || null;
}

function _bqDistanceBetweenLayouts(a, b) {
  return _bqDistance(a || { x: 0, y: 0 }, b || { x: 0, y: 0 });
}

function _bqRouteDistanceForSystems(fromSystem, toSystem) {
  const span = _bqDistanceBetweenLayouts(fromSystem, toSystem);
  return Math.max(8, Math.round(span * 64));
}

function _bqUniqueFrontierLabel(usedLabels, rng) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const label = `${_bqRandomFrom(SPACE_FRONTIER_NAME_PREFIXES, rng)} ${_bqRandomFrom(SPACE_FRONTIER_NAME_SUFFIXES, rng)}`;
    if (!usedLabels.has(label)) {
      usedLabels.add(label);
      return label;
    }
  }
  const fallback = `Frontier ${usedLabels.size + 1}`;
  usedLabels.add(fallback);
  return fallback;
}

function _bqGenerateFrontierPosition(rng, taken) {
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const angle = (rng() * Math.PI * 2);
    const radius = 0.24 + (rng() * 0.23);
    const point = {
      x: _bqClamp(0.5 + (Math.cos(angle) * radius), 0.1, 0.9),
      y: _bqClamp(0.5 + (Math.sin(angle) * radius * 0.78), 0.12, 0.88),
    };
    const clear = taken.every((other) => _bqDistanceBetweenLayouts(point, other) >= 0.13);
    if (clear) {
      taken.push(point);
      return point;
    }
  }
  const fallback = {
    x: 0.14 + (rng() * 0.72),
    y: 0.16 + (rng() * 0.68),
  };
  taken.push(fallback);
  return fallback;
}

function _bqCreateFrontierBodies(systemKey, label, archetype, rng) {
  const baseName = label.split(' ')[0] || label;
  const primaryKey = `${systemKey}-prime`;
  const stationKey = `${systemKey}-anchor`;
  const moonKey = `${systemKey}-moon`;
  const bodies = [
    {
      key: primaryKey,
      name: `${label} Prime`,
      kind: 'planet',
      orbitRadius: 410 + Math.floor(rng() * 60),
      angle: rng() * Math.PI * 2,
      radius: 74 + Math.floor(rng() * 24),
      accent: archetype.accent,
      owner: archetype.owner,
      faction: archetype.faction,
      description: archetype.description,
      biome: archetype.biome,
      marketTags: archetype.marketTags.slice(),
      contractTags: archetype.contractTags.slice(),
      colonySupport: archetype.colonySupport,
      landingAllowed: true,
      dockingAllowed: true,
      goods: Array.isArray(archetype.goods) ? archetype.goods.slice() : [],
      alienPresence: archetype.danger > 0.26 ? 'high' : 'medium',
      alienTone: archetype.danger > 0.26 ? 'hostile' : 'curious',
    },
    {
      key: stationKey,
      name: `${baseName} Anchor`,
      kind: 'station',
      orbitRadius: 680 + Math.floor(rng() * 90),
      angle: rng() * Math.PI * 2,
      radius: 40 + Math.floor(rng() * 10),
      accent: '#f0f6ff',
      owner: archetype.owner,
      faction: archetype.faction,
      description: `${label}'s relay station for refits, customs, and freight.`,
      biome: 'orbital',
      marketTags: _bqMergeTags(archetype.marketTags, ['ship repairs', 'brokerage']),
      contractTags: _bqMergeTags(archetype.contractTags, ['freight', 'escort']),
      colonySupport: 'orbital waypoint',
      landingAllowed: true,
      dockingAllowed: true,
    },
  ];

  if (rng() > 0.35) {
    bodies.push({
      key: moonKey,
      name: `${baseName} Minor`,
      kind: 'planet',
      orbitRadius: 900 + Math.floor(rng() * 120),
      angle: rng() * Math.PI * 2,
      radius: 48 + Math.floor(rng() * 16),
      accent: archetype.accent,
      owner: archetype.owner,
      faction: archetype.faction,
      description: `A secondary colony world in the ${label} system.`,
      biome: archetype.biome === 'lush' ? 'garden' : (archetype.biome === 'asteroid' ? 'moon' : archetype.biome),
      marketTags: _bqMergeTags(archetype.marketTags, ['frontier supply']),
      contractTags: _bqMergeTags(archetype.contractTags, ['survey']),
      colonySupport: 'minor outpost',
      landingAllowed: true,
      dockingAllowed: true,
      goods: Array.isArray(archetype.goods) ? archetype.goods.slice(0, 2) : [],
      alienPresence: 'low',
      alienTone: 'neutral',
    });
  }

  return { primaryKey, bodies };
}

function _bqAppendRoute(graph, routeMap, from, to, dangerRating) {
  if (!from || !to || from === to) return;
  const key = [from, to].sort().join('|');
  if (routeMap.has(key)) return;
  const fromSystem = graph.systems[from];
  const toSystem = graph.systems[to];
  if (!fromSystem || !toSystem) return;
  routeMap.set(key, {
    from,
    to,
    distance: _bqRouteDistanceForSystems(fromSystem, toSystem),
    dangerRating: _bqClamp(Number(dangerRating) || 0.1, 0.02, 0.85),
  });
}

function _bqGenerateFrontierSystems(seedInput, graph) {
  const rng = _bqCreateSeededRandom(`space-frontier:${seedInput}`);
  const frontierCount = 4 + Math.floor(rng() * 4);
  const usedLabels = new Set(Object.values(graph.systems).map((system) => system.label));
  const takenPositions = Object.values(graph.systems).map((system) => ({ x: system.x, y: system.y }));
  const routeMap = new Map(graph.routes.map((route) => [[route.from, route.to].sort().join('|'), { ...route }]));
  const frontierKeys = [];

  for (let i = 0; i < frontierCount; i += 1) {
    const key = `frontier-${i + 1}`;
    const label = _bqUniqueFrontierLabel(usedLabels, rng);
    const archetype = _bqRandomFrom(SPACE_FRONTIER_ARCHETYPES, rng);
    const position = _bqGenerateFrontierPosition(rng, takenPositions);
    const { primaryKey, bodies } = _bqCreateFrontierBodies(key, label, archetype, rng);
    const asteroidBelts = archetype.biome === 'asteroid' || rng() > 0.55
      ? [{ key: `${key}-belt`, radius: 1120 + Math.floor(rng() * 180), count: 16 + Math.floor(rng() * 20), accent: archetype.accent }]
      : [];

    graph.systems[key] = {
      key,
      x: position.x,
      y: position.y,
      label,
      catalogName: label,
      kindLabel: archetype.kindLabel,
      accent: archetype.accent,
      description: archetype.description,
      owner: archetype.owner,
      faction: archetype.faction,
      marketTags: archetype.marketTags.slice(),
      contractTags: archetype.contractTags.slice(),
      colonySupport: archetype.colonySupport,
      starName: `${label} Star`,
      primaryBodyKey: primaryKey,
      travelCost: 320 + Math.floor(rng() * 520),
      researchCost: 25 + Math.floor(rng() * 150),
      bodies,
      asteroidBelts,
    };
    frontierKeys.push(key);
  }

  for (let i = 0; i < frontierKeys.length; i += 1) {
    const key = frontierKeys[i];
    const system = graph.systems[key];
    const allKeys = Object.keys(graph.systems).filter((candidate) => candidate !== key);
    const nearest = allKeys
      .map((candidate) => ({
        key: candidate,
        dist: _bqDistanceBetweenLayouts(system, graph.systems[candidate]),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3);

    const desiredLinks = i === 0 ? 2 : (rng() > 0.6 ? 2 : 1);
    for (let link = 0; link < Math.min(desiredLinks, nearest.length); link += 1) {
      _bqAppendRoute(graph, routeMap, key, nearest[link].key, graph.systems[key].bodies?.[0]?.alienPresence === 'high' ? 0.34 : 0.18 + (rng() * 0.18));
    }
  }

  graph.routes = Array.from(routeMap.values());
  return graph;
}

function _bqResolveSpaceWorldSeed(explicitSeed = null) {
  const direct = Number(explicitSeed);
  if (Number.isFinite(direct)) return Math.floor(direct);
  const root = (typeof window !== 'undefined') ? window : globalThis;
  const runtimeSeed = Number(root?._mapSeed);
  return Number.isFinite(runtimeSeed) ? Math.floor(runtimeSeed) : 0;
}

function _bqBuildSpaceWorldGraph(seedInput = null) {
  const seed = _bqResolveSpaceWorldSeed(seedInput);
  const graph = _bqCloneSpaceGraphData(BASE_SPACE_WORLD_GRAPH);
  return _bqGenerateFrontierSystems(seed, graph);
}

function _bqConfigureSpaceWorldGraph(seedInput = null) {
  const seed = _bqResolveSpaceWorldSeed(seedInput);
  SPACE_WORLD_GRAPH = _bqBuildSpaceWorldGraph(seed);
  SPACE_BODY_INDEX = _bqBuildBodyIndex(SPACE_WORLD_GRAPH);
  SPACE_SYSTEM_LAYOUT = _bqBuildSystemLayout(SPACE_WORLD_GRAPH);
  _bqSpaceWorldSeed = seed;
  return SPACE_WORLD_GRAPH;
}

function _bqEnsureSpaceWorldGraph(seedInput = null) {
  const seed = _bqResolveSpaceWorldSeed(seedInput);
  if (!SPACE_WORLD_GRAPH || _bqSpaceWorldSeed !== seed) {
    _bqConfigureSpaceWorldGraph(seed);
  }
  return SPACE_WORLD_GRAPH;
}

_bqEnsureSpaceWorldGraph(0);

function _bqGetSystemDef(nodeKey) {
  _bqEnsureSpaceWorldGraph();
  return SPACE_WORLD_GRAPH.systems[nodeKey] || null;
}

function _bqGetBodyDef(bodyKey) {
  _bqEnsureSpaceWorldGraph();
  return SPACE_BODY_INDEX.get(bodyKey) || null;
}

function _bqBuildDestinationCatalogEntry(systemKey) {
  const system = _bqGetSystemDef(systemKey);
  if (!system || system.catalogHidden) return null;
  const primaryBody = _bqGetBodyDef(system.primaryBodyKey);
  return {
    key: system.key,
    name: system.catalogName || primaryBody?.name || system.label,
    label: system.label,
    kind: system.kindLabel || 'System',
    biome: primaryBody?.biome || 'orbital',
    travelCost: Math.max(0, Number(system.travelCost) || 0),
    researchCost: Math.max(0, Number(system.researchCost) || 0),
    description: primaryBody?.description || system.description,
    goods: _bqCloneList(primaryBody?.goods),
    alienPresence: primaryBody?.alienPresence || 'low',
    alienTone: primaryBody?.alienTone || 'neutral',
    owner: primaryBody?.owner || system.owner || null,
    faction: primaryBody?.faction || system.faction || null,
    primaryBodyKey: primaryBody?.key || system.primaryBodyKey || null,
    primaryBodyName: primaryBody?.name || null,
    marketTags: _bqMergeTags(system.marketTags, primaryBody?.marketTags),
    contractTags: _bqMergeTags(system.contractTags, primaryBody?.contractTags),
    colonySupport: primaryBody?.colonySupport || system.colonySupport || null,
  };
}

function _bqGetDestinationCatalog() {
  _bqEnsureSpaceWorldGraph();
  return Object.keys(SPACE_WORLD_GRAPH.systems)
    .map((systemKey) => _bqBuildDestinationCatalogEntry(systemKey))
    .filter(Boolean);
}

function _bqGetSystemContext(nodeKey) {
  const system = _bqGetSystemDef(nodeKey);
  if (!system) return null;
  const primaryBody = _bqGetBodyDef(system.primaryBodyKey);
  return {
    key: system.key,
    label: system.label,
    kind: system.kindLabel || 'System',
    description: system.description,
    accent: system.accent,
    owner: system.owner || primaryBody?.owner || null,
    faction: system.faction || primaryBody?.faction || null,
    primaryBodyKey: primaryBody?.key || system.primaryBodyKey || null,
    primaryBodyName: primaryBody?.name || null,
    marketTags: _bqMergeTags(system.marketTags, primaryBody?.marketTags),
    contractTags: _bqMergeTags(system.contractTags, primaryBody?.contractTags),
    colonySupport: primaryBody?.colonySupport || system.colonySupport || null,
  };
}

function _bqGetBodyContext(bodyKey) {
  const body = _bqGetBodyDef(bodyKey);
  if (!body) return null;
  const system = _bqGetSystemDef(body.systemKey);
  return {
    key: body.key,
    bodyKey: body.key,
    name: body.name,
    kind: body.kind,
    description: body.description || system?.description || 'Space body',
    owner: body.owner || system?.owner || null,
    faction: body.faction || system?.faction || null,
    systemKey: body.systemKey,
    systemLabel: body.systemLabel,
    systemKind: body.systemKind,
    systemOwner: body.systemOwner,
    systemFaction: body.systemFaction,
    marketTags: _bqMergeTags(system?.marketTags, body.marketTags),
    contractTags: _bqMergeTags(system?.contractTags, body.contractTags),
    colonySupport: body.colonySupport || system?.colonySupport || null,
    goods: _bqCloneList(body.goods),
    alienPresence: body.alienPresence || 'low',
    alienTone: body.alienTone || 'neutral',
    dockingAllowed: body.dockingAllowed !== false,
    landingAllowed: body.landingAllowed !== false,
    accent: body.accent || system?.accent || '#9fb5ce',
  };
}

function _bqOrbitalRoutes() {
  _bqEnsureSpaceWorldGraph();
  return SPACE_WORLD_GRAPH.routes.map((route) => ({
    ...route,
    label: `${_bqGetNodeMeta(route.from).label} → ${_bqGetNodeMeta(route.to).label}`,
  }));
}

function _bqGetNodeMeta(nodeKey) {
  const system = _bqGetSystemDef(nodeKey);
  if (!system) return { key: nodeKey, label: nodeKey, accent: '#9fb5ce', description: 'Uncharted star system.', kind: 'Unknown System' };
  return {
    key: system.key,
    label: system.label,
    accent: system.accent,
    description: system.description,
    kind: system.kindLabel || 'System',
    owner: system.owner || null,
    faction: system.faction || null,
  };
}

function _bqGetRoutesFrom(nodeKey) {
  if (!nodeKey) return [];
  return _bqOrbitalRoutes()
    .filter((route) => route.from === nodeKey || route.to === nodeKey)
    .map((route) => ({
      ...route,
      destination: route.from === nodeKey ? route.to : route.from,
    }));
}

function _bqGetRoute(fromNode, toNode) {
  if (!fromNode || !toNode || fromNode === toNode) return null;
  return _bqOrbitalRoutes().find((route) => (
    (route.from === fromNode && route.to === toNode)
      || (route.to === fromNode && route.from === toNode)
  )) || null;
}

function _bqHashString(input) {
  let hash = 2166136261;
  const str = String(input || '');
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function _bqCreateSeededRandom(seedInput) {
  let state = (_bqHashString(seedInput) || 1) >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function _bqClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function _bqGetBearEmpireSystem() {
  const root = (typeof window !== 'undefined') ? window : globalThis;
  const getter = root?.BQGetBearEmpireSystem;
  if (typeof getter !== 'function') return null;
  const system = getter();
  return (system && typeof system.getSystemStatus === 'function') ? system : null;
}

function _bqGetRouteConflictPressure(fromNode, toNode) {
  const bearSystem = _bqGetBearEmpireSystem();
  if (!bearSystem || typeof bearSystem.getRoutePressure !== 'function') {
    return {
      active: false,
      origin: null,
      destination: null,
      dangerBonus: 0,
      fuelSurcharge: 0,
      routeThreat: 'clear',
      alignment: 'neutral',
      resistanceKnown: false,
    };
  }
  return bearSystem.getRoutePressure(fromNode, toNode);
}

function _bqDecorateRouteWithConflict(route, fromNode, ship = null) {
  if (!route) return null;
  const destination = route.from === fromNode ? route.to : route.from;
  const conflict = _bqGetRouteConflictPressure(fromNode, destination);
  const baseFuelCost = SPACE_FUEL_ENABLED ? (ship ? ship.getFuelCost(route.distance) : route.distance) : 0;
  const fuelSurcharge = SPACE_FUEL_ENABLED ? Math.max(0, Math.floor(Number(conflict?.fuelSurcharge) || 0)) : 0;
  const dangerRating = _bqClamp((Number(route.dangerRating) || 0) + (Number(conflict?.dangerBonus) || 0), 0, 1);
  const fuelCost = baseFuelCost + fuelSurcharge;
  return {
    ...route,
    destination,
    baseDangerRating: Number(route.dangerRating) || 0,
    dangerRating,
    baseFuelCost,
    fuelSurcharge,
    fuelCost,
    conflict,
    canAfford: true,
  };
}

function _bqResolveIonFieldJumpHazard(route, destinationNode, ship, playerMods = null, seedInput = '') {
  if (!route || !ship) return null;
  const system = _bqGetSystemDef(destinationNode);
  const danger = _bqClamp(Number(route.dangerRating) || 0, 0, 1);
  const biome = String(system?.biome || '').toLowerCase();
  const biomeBonus = (biome === 'hazard' || biome === 'volcanic') ? 0.16 : (biome === 'asteroid' ? 0.10 : 0);
  const ionProne = danger >= 0.12 || biomeBonus > 0;
  if (!ionProne) return null;

  const rng = _bqCreateSeededRandom(`${seedInput}:${destinationNode}:${ship.condition}`);
  const chance = _bqClamp(0.06 + (danger * 0.42) + biomeBonus, 0.06, 0.62);
  if (rng() >= chance) return null;

  const resistance = _bqClamp(Number(playerMods?.ionFieldResistance) || 0, 0, 0.9);
  const rawDamage = Math.max(4, Math.round(6 + (danger * 18) + (biomeBonus * 18) + (rng() * 4)));
  const damage = Math.max(0, Math.round(rawDamage * (1 - resistance)));
  const fuelLoss = 0;

  if (damage > 0) ship.applyDamage(damage);

  return {
    type: 'ion_field',
    damage,
    fuelLoss,
    mitigated: resistance > 0,
    prevented: damage === 0 && fuelLoss === 0,
    severity: rawDamage,
  };
}

function _bqResolveBearBlockadeHazard(route, fromNode, destinationNode, ship, playerRef = null, seedInput = '') {
  if (!route || !ship) return null;
  const conflict = route.conflict || _bqGetRouteConflictPressure(fromNode, destinationNode);
  if (!conflict?.active || conflict.routeThreat === 'clear') return null;

  const threatTier = String(conflict.routeThreat || 'clear');
  const playerMods = playerRef?.modifiers || null;
  const captain = ship?.captain || null;
  const captainEvade = _bqClamp(Number(captain?.evasion) || 0, 0, 0.6);
  const assistBonus = playerMods?.qteAssist ? 0.08 : 0;
  const resistanceCover = conflict.resistanceKnown ? 0.04 : 0;
  const alignment = String(conflict.alignment || 'neutral');
  const baseChance = (
    0.08
    + (Number(conflict.dangerBonus) || 0) * 1.65
    + (threatTier === 'fortified' ? 0.18 : threatTier === 'occupied' ? 0.12 : threatTier === 'threatened' ? 0.07 : 0.03)
    - (captainEvade * 0.30)
    - assistBonus
    - (alignment === 'bear_aligned' ? 0.12 : 0)
    + (alignment === 'resistance_aligned' ? 0.04 : 0)
    - resistanceCover
  );
  const chance = _bqClamp(baseChance, 0.05, 0.92);
  const rng = _bqCreateSeededRandom(`${seedInput}:${fromNode}:${destinationNode}:${ship.condition}:blockade`);
  if (rng() >= chance) return null;

  const damage = Math.max(3, Math.round(
    4
    + ((Number(conflict.dangerBonus) || 0) * 22)
    + (threatTier === 'fortified' ? 6 : threatTier === 'occupied' ? 4 : 2)
    + (rng() * 4)
  ));
  const fuelLoss = 0;
  const sequenceLength = threatTier === 'fortified' ? 5 : threatTier === 'occupied' ? 4 : 3;
  const timeLimitMs = threatTier === 'fortified' ? 3600 : threatTier === 'occupied' ? 4200 : 4700;

  return {
    type: 'bear_blockade',
    nodeKey: destinationNode,
    fromNode,
    title: threatTier === 'fortified' ? 'Capital Shield Breach' : 'Bear Blockade Break',
    subtitle: threatTier === 'fortified'
      ? 'Thread the ship through the heaviest bear picket line.'
      : 'Punch through the bear patrol cordon before they box you in.',
    routeThreat: threatTier,
    chance,
    damage,
    fuelLoss,
    qte: {
      kind: 'space_blockade_break',
      sequenceLength,
      timeLimitMs,
      seed: `${seedInput}:${destinationNode}:${threatTier}`,
      passScore: threatTier === 'fortified' ? 72 : 64,
    },
  };
}

function _bqDistance(a, b) {
  const dx = (a?.x || 0) - (b?.x || 0);
  const dy = (a?.y || 0) - (b?.y || 0);
  return Math.hypot(dx, dy);
}

function _bqNormalize(x, y) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function _bqResolveSystemScale(system) {
  const bodies = Array.isArray(system?.bodies) ? system.bodies : [];
  const belts = Array.isArray(system?.asteroidBelts) ? system.asteroidBelts : [];
  let rawOuterRadius = 0;

  for (const body of bodies) {
    rawOuterRadius = Math.max(
      rawOuterRadius,
      (Number(body?.orbitRadius) || 0) + (Number(body?.radius) || 0) + 180,
    );
  }

  for (const belt of belts) {
    rawOuterRadius = Math.max(rawOuterRadius, (Number(belt?.radius) || 0) + 180);
  }

  rawOuterRadius = Math.max(1200, rawOuterRadius);
  const activityWeight = Math.max(1, bodies.length + (belts.length * 0.8));
  const width = Math.max(
    Number(system?.width) || 0,
    Math.round((rawOuterRadius * 4.4) + (activityWeight * 140)),
  );
  const height = Math.max(
    Number(system?.height) || 0,
    Math.round((rawOuterRadius * 3.5) + (activityWeight * 120)),
  );
  const targetOuterRadius = Math.min(width, height) * 0.39;
  const orbitScale = Math.max(1.55, targetOuterRadius / rawOuterRadius);

  return {
    width,
    height,
    rawOuterRadius,
    orbitScale,
    outerRadius: rawOuterRadius * orbitScale,
  };
}

function _bqSystemTemplate(nodeKey) {
  const system = _bqGetSystemDef(nodeKey) || _bqGetSystemDef('orbit');
  const meta = _bqGetNodeMeta(system.key);
  const scale = _bqResolveSystemScale(system);
  const common = {
    nodeKey: system.key,
    width: scale.width,
    height: scale.height,
    starColor: system.starColor || meta.accent,
    starName: system.starName || `${meta.label} Star`,
    orbitScale: scale.orbitScale,
    outerRadius: scale.outerRadius,
  };
  return {
    ...common,
    bodies: (system.bodies || []).map((body) => ({ ...body })),
    asteroidBelts: (system.asteroidBelts || []).map((belt) => ({ ...belt })),
  };
}

function _bqCreateSystemState(nodeKey, shipCondition = 100, entryDirection = null) {
  const rng = _bqCreateSeededRandom(`${nodeKey}:${shipCondition}`);
  const template = _bqSystemTemplate(nodeKey);
  const centerX = template.width / 2;
  const centerY = template.height / 2;
  const orbitScale = Number(template.orbitScale) || 1;
  const bodies = template.bodies.map((body) => ({
    ...body,
    orbitRadius: (Number(body.orbitRadius) || 0) * orbitScale,
    x: centerX + Math.cos(body.angle) * ((Number(body.orbitRadius) || 0) * orbitScale),
    y: centerY + Math.sin(body.angle) * ((Number(body.orbitRadius) || 0) * orbitScale),
    interactionRadius: body.radius + (body.kind === 'station' ? 90 : 110),
  }));

  for (const belt of template.asteroidBelts) {
    const beltRadius = (Number(belt.radius) || 0) * orbitScale;
    for (let i = 0; i < belt.count; i += 1) {
      const angle = (i / belt.count) * Math.PI * 2 + ((rng() - 0.5) * 0.35);
      const distance = beltRadius + ((rng() - 0.5) * 160);
      bodies.push({
        key: `${belt.key}-${i}`,
        name: 'Asteroid',
        kind: 'asteroid',
        radius: 8 + Math.floor(rng() * 10),
        accent: belt.accent,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        interactionRadius: 24,
      });
    }
  }

  const initialDir = entryDirection && Number.isFinite(entryDirection.x) && Number.isFinite(entryDirection.y)
    ? _bqNormalize(entryDirection.x, entryDirection.y)
    : { x: 0, y: 1 };
  const spawnDistance = Math.max(760, Math.min(template.outerRadius * 0.48, Math.min(template.width, template.height) * 0.28));
  return {
    nodeKey,
    width: template.width,
    height: template.height,
    centerX,
    centerY,
    starName: template.starName,
    starColor: template.starColor,
    ship: {
      x: centerX - (initialDir.x * spawnDistance),
      y: centerY - (initialDir.y * spawnDistance),
      vx: initialDir.x * 0.07,
      vy: initialDir.y * 0.07,
      heading: Math.atan2(initialDir.y, initialDir.x),
    },
    bodies,
    nearestBodyKey: null,
  };
}

function _bqPlaceShipNearBody(systemState, bodyKey, distanceFromSurface = 150, headingOffset = 0) {
  if (!systemState?.ship || !Array.isArray(systemState.bodies) || !bodyKey) return false;
  const body = systemState.bodies.find((candidate) => candidate?.key === bodyKey);
  if (!body) return false;

  const dir = _bqNormalize(body.x - systemState.centerX, body.y - systemState.centerY);
  const spawnDistance = Math.max(body.radius + 40, body.radius + distanceFromSurface);
  systemState.ship.x = body.x + (dir.x * spawnDistance);
  systemState.ship.y = body.y + (dir.y * spawnDistance);
  systemState.ship.vx = dir.x * 0.035;
  systemState.ship.vy = dir.y * 0.035;
  systemState.ship.heading = Math.atan2(dir.y, dir.x) + headingOffset;
  systemState.nearestBodyKey = body.key;
  return true;
}

function _bqBuildSystemRouteMarkers(nodeKey, systemState, routes = []) {
  if (!systemState || !nodeKey || !Array.isArray(routes)) return [];
  const here = SPACE_SYSTEM_LAYOUT[nodeKey] || SPACE_SYSTEM_LAYOUT.orbit;
  const boundaryRadius = Math.min(systemState.width, systemState.height) * 0.42;

  return routes.map((route, index) => {
    const dest = SPACE_SYSTEM_LAYOUT[route.destination] || SPACE_SYSTEM_LAYOUT.orbit;
    const baseDir = _bqNormalize(dest.x - here.x, dest.y - here.y);
    const fan = ((index % 3) - 1) * 0.08;
    const angle = Math.atan2(baseDir.y, baseDir.x) + fan;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    return {
      ...route,
      label: _bqGetNodeMeta(route.destination)?.label || route.destination,
      dir,
      x: systemState.centerX + dir.x * boundaryRadius,
      y: systemState.centerY + dir.y * boundaryRadius,
    };
  });
}

function _bqRenderFlightMinimap(systemState, currentNode, targetNode, routeMarkers, viewWidth, viewHeight, camX, camY) {
  if (!systemState?.ship || typeof push !== 'function') return;

  const panelW = Math.max(190, Math.min(250, viewWidth * 0.22));
  const panelH = Math.max(154, Math.min(210, viewHeight * 0.24));
  const panelX = viewWidth - panelW - 18;
  const panelY = 18;
  const innerX = panelX + 12;
  const innerY = panelY + 30;
  const innerW = panelW - 24;
  const innerH = panelH - 42;
  const scale = Math.min(innerW / Math.max(1, systemState.width), innerH / Math.max(1, systemState.height));
  const toMini = (x, y) => ({
    x: innerX + (x * scale),
    y: innerY + (y * scale),
  });
  const viewportLeft = _bqClamp(camX - (viewWidth / 2), 0, systemState.width);
  const viewportTop = _bqClamp(camY - (viewHeight / 2), 0, systemState.height);
  const viewportRight = _bqClamp(camX + (viewWidth / 2), 0, systemState.width);
  const viewportBottom = _bqClamp(camY + (viewHeight / 2), 0, systemState.height);
  const miniTopLeft = toMini(viewportLeft, viewportTop);
  const miniBottomRight = toMini(viewportRight, viewportBottom);
  const currentLabel = _bqGetNodeMeta(currentNode)?.label || currentNode || 'System';
  const targetLabel = targetNode ? (_bqGetNodeMeta(targetNode)?.label || targetNode) : null;

  push();
  noStroke();
  fill(7, 11, 20, 220);
  rect(panelX, panelY, panelW, panelH, 16);
  fill(255, 255, 255, 16);
  rect(innerX, innerY, innerW, innerH, 12);

  fill(207, 225, 245);
  textAlign(LEFT, TOP);
  textSize(12);
  text(`${currentLabel} Minimap`, panelX + 14, panelY + 10);
  if (targetLabel) {
    textAlign(RIGHT, TOP);
    fill(255, 208, 105);
    text(`Jump ${targetLabel}`, panelX + panelW - 14, panelY + 10);
  }

  const star = toMini(systemState.centerX, systemState.centerY);
  noStroke();
  fill(systemState.starColor || '#7dc9ff');
  circle(star.x, star.y, 12);
  fill(255, 255, 255, 40);
  circle(star.x, star.y, 18);

  for (const body of systemState.bodies || []) {
    const point = toMini(body.x || 0, body.y || 0);
    if (body.kind !== 'asteroid') {
      noFill();
      stroke(255, 255, 255, 20);
      strokeWeight(1);
      circle(star.x, star.y, Math.max(10, (body.orbitRadius || 0) * scale * 2));
    }
    noStroke();
    fill(body.accent || '#9fb5ce');
    circle(point.x, point.y, Math.max(body.kind === 'asteroid' ? 2.6 : 4.5, (body.radius || 0) * scale * 2));
    if (body.key === systemState.nearestBodyKey) {
      noFill();
      stroke(255, 208, 105, 230);
      strokeWeight(1.5);
      circle(point.x, point.y, Math.max(8, (body.radius || 0) * scale * 2 + 6));
    }
  }

  for (const marker of routeMarkers || []) {
    const point = toMini(marker.x, marker.y);
    noFill();
    stroke(marker.destination === targetNode ? '#ffd069' : 'rgba(125,201,255,0.72)');
    strokeWeight(marker.destination === targetNode ? 2.2 : 1.2);
    line(star.x, star.y, point.x, point.y);
    noStroke();
    fill(marker.destination === targetNode ? '#ffd069' : '#9fd9ff');
    circle(point.x, point.y, marker.destination === targetNode ? 8 : 6);
  }

  const shipPoint = toMini(systemState.ship.x || 0, systemState.ship.y || 0);
  push();
  translate(shipPoint.x, shipPoint.y);
  rotate(systemState.ship.heading || 0);
  noStroke();
  fill(255);
  triangle(7, 0, -6, -4, -6, 4);
  pop();

  noFill();
  stroke(255, 208, 105, 220);
  strokeWeight(1.5);
  rect(
    miniTopLeft.x,
    miniTopLeft.y,
    Math.max(8, miniBottomRight.x - miniTopLeft.x),
    Math.max(8, miniBottomRight.y - miniTopLeft.y),
    8
  );
  pop();
}

function _bqGetSurfaceTheme(nodeKey, body, isStation) {
  if (body.key === 'homeworld') {
    return {
      skyTop: '#4aa8ff',
      skyBottom: '#9ee6ff',
      groundA: '#3da35d',
      groundB: '#7bc96f',
      accent: '#1b5e20',
      horizon: '#2e7d32',
    };
  }
  if (body.key === 'grayhold' || body.key === 'luna-dock') {
    return {
      skyTop: '#2e3248',
      skyBottom: '#aeb7cb',
      groundA: '#7f8798',
      groundB: '#b2b8c4',
      accent: '#e0e6ef',
      horizon: '#646d80',
    };
  }
  if (nodeKey === 'aurelia') {
    return {
      skyTop: '#41c993',
      skyBottom: '#d9ffd5',
      groundA: '#2f8f4e',
      groundB: '#9dda7b',
      accent: '#f2ffb8',
      horizon: '#67c45f',
    };
  }
  if (nodeKey === 'vanta') {
    return {
      skyTop: '#311624',
      skyBottom: '#ffb178',
      groundA: '#704338',
      groundB: '#b76b46',
      accent: '#ffd7a6',
      horizon: '#9b4d35',
    };
  }
  if (isStation) {
    return {
      skyTop: '#0f1622',
      skyBottom: '#1f3145',
      groundA: '#4b5c73',
      groundB: '#667a92',
      accent: '#dbe9ff',
      horizon: '#2c3e56',
    };
  }
  return {
    skyTop: '#163148',
    skyBottom: '#9fd4ff',
    groundA: '#586b7d',
    groundB: '#8da4b8',
    accent: '#f2f6ff',
    horizon: '#3d4f63',
  };
}

function _bqCreatePlanetGridSurface(nodeKey, body, rng, theme) {
  const isStation = body.kind === 'station';
  const tileSize = isStation ? 60 : 64;
  const cols = isStation ? 28 : 34;
  const rows = isStation ? 18 : 22;
  const width = cols * tileSize;
  const height = rows * tileSize;
  const playerStartCol = Math.floor(cols * 0.5);
  const playerStartRow = Math.floor(rows * 0.68);
  const tilePalette = (() => {
    if (isStation) {
      return [
        { key: 'deck', color: '#4d6176', line: '#70869d' },
        { key: 'bay', color: '#394a60', line: '#5c718a' },
        { key: 'stripe', color: '#c6d9ef', line: '#7d92a8' },
        { key: 'conduit', color: '#25374a', line: '#3e546d' },
      ];
    }
    if (body.key === 'grayhold' || body.key === 'luna-dock') {
      return [
        { key: 'dust', color: '#8b93a5', line: '#b0b8c5' },
        { key: 'rock', color: '#666d80', line: '#9098aa' },
        { key: 'ice', color: '#ced9e7', line: '#eef4ff' },
      ];
    }
    if (nodeKey === 'aurelia') {
      return [
        { key: 'moss', color: '#5fb56c', line: '#9fe6a3' },
        { key: 'soil', color: '#347947', line: '#5bb96e' },
        { key: 'water', color: '#3da7d3', line: '#8de8ff' },
        { key: 'bloom', color: '#dff68c', line: '#fffbc8' },
      ];
    }
    if (nodeKey === 'vanta') {
      return [
        { key: 'ash', color: '#6d4a43', line: '#a06b59' },
        { key: 'slag', color: '#4f3330', line: '#7c4b43' },
        { key: 'glass', color: '#bd865e', line: '#ffd1aa' },
        { key: 'ember', color: '#993f2b', line: '#ff9e6c' },
      ];
    }
    return [
      { key: 'plain', color: theme.groundA || '#586b7d', line: theme.horizon || '#3d4f63' },
      { key: 'ridge', color: theme.groundB || '#8da4b8', line: theme.accent || '#f2f6ff' },
    ];
  })();

  const tiles = [];
  for (let row = 0; row < rows; row += 1) {
    const rowTiles = [];
    for (let col = 0; col < cols; col += 1) {
      let tile = tilePalette[Math.floor(rng() * tilePalette.length)];
      if (isStation && (row === Math.floor(rows * 0.5) || col === Math.floor(cols * 0.5))) tile = tilePalette[2] || tile;
      if (!isStation && nodeKey === 'aurelia' && rng() < 0.08) tile = tilePalette.find((entry) => entry.key === 'water') || tile;
      if (!isStation && nodeKey === 'vanta' && rng() < 0.1) tile = tilePalette.find((entry) => entry.key === 'ember') || tile;
      rowTiles.push(tile);
    }
    tiles.push(rowTiles);
  }

  const settlements = [];
  const settlementCount = isStation ? 4 : 5;
  for (let i = 0; i < settlementCount; i += 1) {
    const col = 3 + Math.floor(rng() * Math.max(4, cols - 6));
    const row = 2 + Math.floor(rng() * Math.max(4, rows - 5));
    settlements.push({
      key: `${body.key}-settlement-${i}`,
      label: isStation ? 'Dock Hub' : 'Outpost',
      kind: isStation ? 'dock' : 'site',
      col,
      row,
      x: (col + 0.5) * tileSize,
      y: (row + 0.5) * tileSize,
      color: isStation ? '#dbe9ff' : theme.accent || '#f2f6ff',
    });
  }

  const entities = [];
  const entityCount = isStation ? 5 : 7;
  for (let i = 0; i < entityCount; i += 1) {
    const col = 2 + Math.floor(rng() * Math.max(4, cols - 4));
    const row = 2 + Math.floor(rng() * Math.max(4, rows - 4));
    entities.push({
      key: `${body.key}-entity-${i}`,
      kind: isStation ? 'drone' : 'rover',
      x: (col + 0.5) * tileSize,
      y: (row + 0.5) * tileSize,
      radius: isStation ? 8 : 10,
    });
  }

  return {
    mode: 'planet_grid',
    nodeKey,
    bodyKey: body.key,
    bodyName: body.name,
    kind: body.kind,
    width,
    height,
    cols,
    rows,
    tileSize,
    theme,
    tiles,
    settlements,
    entities,
    player: {
      x: (playerStartCol + 0.5) * tileSize,
      y: (playerStartRow + 0.5) * tileSize,
      vx: 0,
      vy: 0,
      heading: 0,
    },
  };
}

function _bqCreateSurfaceState(nodeKey, body) {
  if (!body) return null;

  if (body.key === 'homeworld') {
    const theme = _bqGetSurfaceTheme(nodeKey, body, body.kind === 'station');
    return {
      mode: 'earth_world',
      nodeKey,
      bodyKey: body.key,
      bodyName: body.name,
      kind: body.kind,
      width: 0,
      height: 0,
      theme,
      player: {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        heading: 0,
      },
    };
  }

  return null;
}

// ── SpaceTravelSystem ───────────────────────────────────
class SpaceTravelSystem {
  constructor() {
    _bqEnsureSpaceWorldGraph();
    this.phase = SpaceTravelPhase.GROUNDED;
    this.activeShip = null;
    this.launchCity = null;
    this.currentNode = null;
    this.targetNode = null;
    this.routeProgress = 0;
    this.routeDistance = 0;
    this.encounterSeed = null;
    this.launchProgress = 0;
    this.launchSupport = 0;
    this.launchDestination = null;
    this.reentrySupport = 0;
    this.currentBodyKey = null;
    this.systemState = null;
    this.surfaceState = null;
  }

  getAvailableRoutes(nodeKey = null) {
    _bqEnsureSpaceWorldGraph();
    const baseNode = nodeKey || this.currentNode || 'orbit';
    return _bqGetRoutesFrom(baseNode).map((route) => _bqDecorateRouteWithConflict(route, baseNode, this.activeShip));
  }

  getRouteTo(destinationNode, fromNode = null) {
    _bqEnsureSpaceWorldGraph();
    const baseNode = fromNode || this.currentNode || 'orbit';
    const route = _bqGetRoute(baseNode, destinationNode);
    if (!route) return null;
    return _bqDecorateRouteWithConflict(route, baseNode, this.activeShip);
  }

  getCurrentSystemState() {
    return this.systemState;
  }

  getBodyByKey(bodyKey) {
    return this.systemState?.bodies?.find((body) => body.key === bodyKey) || null;
  }

  getCurrentSurfaceState() {
    return this.surfaceState;
  }

  getNearestBody(maxDistance = 180) {
    if (!this.systemState?.ship || !Array.isArray(this.systemState.bodies)) return null;
    let nearest = null;
    for (const body of this.systemState.bodies) {
      if (body.kind === 'asteroid') continue;
      const distance = _bqDistance(this.systemState.ship, body);
      if (distance > Math.max(maxDistance, body.interactionRadius || 0)) continue;
      if (!nearest || distance < nearest.distance) {
        nearest = { ...body, distance };
      }
    }
    return nearest;
  }

  beginLaunch(city, ship, playerRef, destinationNode = 'orbit') {
    void playerRef;
    _bqEnsureSpaceWorldGraph();
    if (!city || !ship) return { ok: false, reason: 'missing_args' };
    if (this.phase !== SpaceTravelPhase.GROUNDED) return { ok: false, reason: 'not_grounded' };

    const prog = city.progression;
    if (!prog?.spaceAccess?.launchReady && !prog?.spaceportBuilt && !city.hasSpaceport) {
      return { ok: false, reason: 'no_spaceport' };
    }
    if (ship.condition <= 0) return { ok: false, reason: 'ship_destroyed' };

    const launchNode = SPACE_SYSTEM_LAYOUT[destinationNode] ? destinationNode : 'orbit';
    if (launchNode !== 'orbit' && !this.getRouteTo(launchNode, 'orbit')) {
      return { ok: false, reason: 'route_locked' };
    }
    this.activeShip = ship;
    this.launchCity = city;
    this.launchDestination = launchNode;
    const techEffects = city?.progression?.techEffects || {};
    const upgrades = city?.management?.upgradeLevels || {};
    const readinessBase = Math.max(0, Math.min(1, Number(techEffects.spaceReadiness) || 0));
    const supportBonus = readinessBase
      + ((city?.hasResearchLab ? 0.10 : 0) + (city?.hasUniversity ? 0.08 : 0))
      + (Math.max(0, Number(upgrades.wagonDepot) || 0) * 0.10)
      + (Math.max(0, Number(upgrades.motorPool) || 0) * 0.16);
    this.launchSupport = Math.max(0, Math.min(1, supportBonus));
    this.phase = SpaceTravelPhase.LAUNCH_PREP;
    this.currentNode = null;
    this.targetNode = null;
    this.currentBodyKey = null;
    this.routeProgress = 0;
    this.launchProgress = 0;
    this.surfaceState = null;
    return { ok: true, destination: launchNode };
  }

	  confirmLaunch() {
    if (this.phase !== SpaceTravelPhase.LAUNCH_PREP) return { ok: false, reason: 'wrong_phase' };
    if (!this.activeShip) return { ok: false, reason: 'no_ship' };
    const route = this.getRouteTo(this.launchDestination, 'orbit');
    const launchDistance = 6 + Math.max(0, route?.distance || 0);
    const launchFuel = this.activeShip.getFuelCost(launchDistance);
    this.routeDistance = launchDistance;
    this.phase = SpaceTravelPhase.ASCENDING;
    this.launchProgress = 0;
	    return { ok: true, fuelUsed: launchFuel };
	  }

  getLaunchManeuverConfig(destinationNode = null) {
    const targetNode = destinationNode || this.launchDestination || 'orbit';
    const route = this.getRouteTo(targetNode, 'orbit');
    const danger = Math.max(0, Math.min(1, Number(route?.dangerRating) || 0));
    const support = Math.max(0, Math.min(1, Number(this.launchSupport) || 0));
    return {
      kind: 'space_launch_burn',
      type: 'launch_burn',
      title: 'Launch Burn',
      eyebrow: 'LAUNCH QTE',
      subtitle: 'Hit the ascent corrections before the launch window drifts.',
      statusText: 'Stabilize the burn and protect the hull during ascent.',
      autopilotText: 'Launch Autopilot handled the ascent burn',
      routeThreat: danger >= 0.45 ? 'volatile' : 'clear',
      qte: {
        seed: `launch:${targetNode}:${this.launchCity?.name || 'city'}`,
        sequenceLength: Math.max(3, Math.min(6, 3 + Math.round(danger * 3))),
        timeLimitMs: Math.max(2800, Math.round(4800 - (support * 900))),
        passScore: Math.max(48, Math.round(66 - (support * 18))),
      },
    };
  }

  resolveLaunchManeuver(score = 0) {
    const resolvedScore = Math.max(0, Math.min(100, Math.floor(Number(score) || 0)));
    const supportBonus = Math.max(0, Math.min(0.28, resolvedScore / 360));
    this.launchSupport = Math.max(0, Math.min(1, (Number(this.launchSupport) || 0) + supportBonus));
    let damage = 0;
    let rating = 'clean';
    if (resolvedScore < 35) {
      damage = 10;
      rating = 'failed';
    } else if (resolvedScore < 55) {
      damage = 5;
      rating = 'rough';
    } else if (resolvedScore >= 90) {
      rating = 'perfect';
    }
    if (damage > 0 && this.activeShip) this.activeShip.applyDamage(damage);
    return { ok: true, score: resolvedScore, rating, damage, launchSupport: this.launchSupport };
  }

  completeAscent(success = true) {
    if (this.phase !== SpaceTravelPhase.ASCENDING) return { ok: false, reason: 'wrong_phase' };
    if (!success) {
      this.activeShip.applyDamage(15);
      this.phase = SpaceTravelPhase.GROUNDED;
      this.launchProgress = 0;
      this.launchSupport = 0;
      return { ok: false, reason: 'ascent_failed', damage: 15 };
    }
    this.phase = SpaceTravelPhase.IN_ORBIT;
    this.currentNode = this.launchDestination || 'orbit';
    this.targetNode = null;
    this.currentBodyKey = null;
    this.launchProgress = 1;
    this.systemState = _bqCreateSystemState(this.currentNode, this.activeShip?.condition || 100);
    if (this.currentNode === 'orbit') {
      _bqPlaceShipNearBody(this.systemState, 'homeworld', 150, 0);
    }
    this.surfaceState = null;
    return { ok: true, node: this.currentNode };
  }

  plotRoute(destinationNode) {
    if (this.phase !== SpaceTravelPhase.IN_ORBIT) return { ok: false, reason: 'wrong_phase' };
    if (!destinationNode || destinationNode === this.currentNode) return { ok: false, reason: 'same_system' };
    const route = this.getRouteTo(destinationNode);
    if (!route) return { ok: false, reason: 'no_route' };
    this.targetNode = destinationNode;
    this.routeDistance = route.distance;
    return { ok: true, route };
  }

  clearRoute() {
    this.targetNode = null;
    this.routeDistance = 0;
    return { ok: true };
  }

  getDockingManeuverConfig(body = null) {
    const target = body || this.getNearestBody();
    if (!target) return null;
    const bodyDanger = target.kind === 'station' ? 0.12
      : target.biome === 'hazard' || target.biome === 'volcanic' || target.biome === 'asteroid' ? 0.55
      : target.biome === 'ice' ? 0.35
      : 0.22;
    return {
      kind: 'space_docking_approach',
      type: 'docking_approach',
      title: `Docking Approach: ${target.name}`,
      eyebrow: target.kind === 'station' ? 'DOCKING QTE' : 'LANDING QTE',
      subtitle: target.kind === 'station'
        ? 'Match the clamp timing before the port rejects your approach.'
        : 'Correct the descent line before the surface corridor closes.',
      statusText: 'Align velocity, attitude, and approach vector.',
      autopilotText: 'Docking Autopilot handled the approach',
      routeThreat: bodyDanger >= 0.5 ? 'volatile' : 'clear',
      qte: {
        seed: `dock:${this.currentNode || 'orbit'}:${target.key}`,
        sequenceLength: Math.max(3, Math.min(6, 3 + Math.round(bodyDanger * 4))),
        timeLimitMs: Math.max(2600, Math.round(4700 - (bodyDanger * 800))),
        passScore: Math.max(52, Math.round(58 + (bodyDanger * 16))),
      },
    };
  }

	  dockNearestBody(opts = {}) {
	    if (this.phase !== SpaceTravelPhase.IN_ORBIT) return { ok: false, reason: 'wrong_phase' };
	    const nearest = this.getNearestBody();
	    if (!nearest) return { ok: false, reason: 'no_target' };
	    if (nearest.kind === 'asteroid') return { ok: false, reason: 'invalid_target' };
    const qteScore = opts && opts.qteScore != null ? Math.max(0, Math.min(100, Math.floor(Number(opts.qteScore) || 0))) : null;
    let approachDamage = 0;
    let approachRating = null;
    if (qteScore != null) {
      const passScore = this.getDockingManeuverConfig(nearest)?.qte?.passScore || 60;
      if (qteScore >= Math.max(90, passScore + 18)) {
        approachRating = 'perfect';
      } else if (qteScore >= passScore) {
        approachRating = 'clean';
      } else if (qteScore >= Math.max(35, passScore - 14)) {
        approachDamage = nearest.kind === 'station' ? 3 : 5;
        approachRating = 'rough';
      } else {
        approachDamage = nearest.kind === 'station' ? 6 : 10;
        approachRating = 'failed';
      }
      if (approachDamage > 0 && this.activeShip) this.activeShip.applyDamage(approachDamage);
    }
	    this.phase = SpaceTravelPhase.LANDED;
    this.currentBodyKey = nearest.key;
    if (this.systemState?.ship) {
      this.systemState.ship.vx = 0;
      this.systemState.ship.vy = 0;
    }
    this.surfaceState = _bqCreateSurfaceState(this.currentNode, nearest);
	    return { ok: true, body: nearest, surfaceState: this.surfaceState, qteScore, approachRating, damage: approachDamage };
	  }

  returnToAdventureSurface() {
    const body = this.getBodyByKey(this.currentBodyKey) || _bqGetBodyDef(this.currentBodyKey);
    this.phase = SpaceTravelPhase.GROUNDED;
    this.currentNode = null;
    this.targetNode = null;
    this.currentBodyKey = null;
    this.routeProgress = 0;
    this.routeDistance = 0;
	    this.launchProgress = 0;
	    this.launchSupport = 0;
    this.reentrySupport = 0;
	    this.launchDestination = null;
    this.systemState = null;
    this.surfaceState = null;
    return { ok: true, body: body || null };
  }

  liftOff() {
    if (this.phase !== SpaceTravelPhase.LANDED) return { ok: false, reason: 'not_landed' };
    const fuelCost = this.activeShip.getFuelCost(2);
    const body = this.getBodyByKey(this.currentBodyKey);
    if (body && this.systemState?.ship) {
      const dir = _bqNormalize(this.systemState.ship.x - body.x, this.systemState.ship.y - body.y);
      this.systemState.ship.x = body.x + dir.x * (body.radius + 150);
      this.systemState.ship.y = body.y + dir.y * (body.radius + 150);
      this.systemState.ship.vx = dir.x * 0.05;
      this.systemState.ship.vy = dir.y * 0.05;
    }
    this.phase = SpaceTravelPhase.IN_ORBIT;
    this.currentBodyKey = null;
    this.surfaceState = null;
    return { ok: true, fuelUsed: fuelCost };
  }

  getReentryManeuverConfig() {
    const support = Math.max(0, Math.min(1, Number(this.launchSupport) || 0));
    return {
      kind: 'space_reentry_corridor',
      type: 'reentry_corridor',
      title: 'Re-entry Corridor',
      eyebrow: 'RE-ENTRY QTE',
      subtitle: 'Hold the heat shield angle until the atmospheric corridor opens.',
      statusText: 'Correct the descent vector and bleed speed.',
      autopilotText: 'Re-entry Autopilot handled the corridor',
      routeThreat: 'volatile',
      qte: {
        seed: `reentry:${this.currentNode || 'orbit'}:${this.launchCity?.name || 'home'}`,
        sequenceLength: 5,
        timeLimitMs: Math.max(3000, Math.round(5000 - (support * 800))),
        passScore: Math.max(54, Math.round(68 - (support * 14))),
      },
    };
  }

	  beginReentry(opts = {}) {
	    if (this.phase !== SpaceTravelPhase.IN_ORBIT) return { ok: false, reason: 'wrong_phase' };
	    if (this.currentNode !== 'orbit') return { ok: false, reason: 'not_home_orbit' };
	    const reentryFuel = this.activeShip.getFuelCost(3);
    const qteScore = opts && opts.qteScore != null ? Math.max(0, Math.min(100, Math.floor(Number(opts.qteScore) || 0))) : null;
    if (qteScore != null) {
      const passScore = this.getReentryManeuverConfig().qte.passScore;
      this.reentrySupport = qteScore >= Math.max(90, passScore + 18) ? 0.35
        : qteScore >= passScore ? 0.22
        : qteScore >= Math.max(35, passScore - 12) ? 0.08
        : -0.12;
    } else {
      this.reentrySupport = 0;
    }
	    this.phase = SpaceTravelPhase.REENTRY;
	    this.launchProgress = 0;
	    return { ok: true, fuelUsed: reentryFuel, qteScore, reentrySupport: this.reentrySupport };
	  }

  completeReentry(success = true, damage = null) {
    if (this.phase !== SpaceTravelPhase.REENTRY) return { ok: false, reason: 'wrong_phase' };
    const hasExplicitDamage = damage !== null && damage !== undefined && Number.isFinite(Number(damage));
    const baseDamage = hasExplicitDamage ? Number(damage) : (success ? 0 : 20);
	    const support = Math.max(0, Math.min(0.45, Number(this.launchSupport) || 0)) + Math.max(-0.12, Math.min(0.35, Number(this.reentrySupport) || 0));
	    const mitigation = success ? 0 : Math.max(-0.12, Math.min(0.65, support));
	    const appliedDamage = Math.max(0, Math.round(baseDamage * (1 - mitigation)));
    if (appliedDamage > 0) this.activeShip.applyDamage(appliedDamage);
    this.phase = SpaceTravelPhase.GROUNDED;
    this.currentNode = null;
    this.targetNode = null;
    this.currentBodyKey = null;
    this.routeProgress = 0;
	    this.launchProgress = 0;
	    this.launchSupport = 0;
    this.reentrySupport = 0;
    this.systemState = null;
    this.surfaceState = null;
    return { ok: true, damage: appliedDamage };
  }

  emergencyReturn() {
    if (this.phase === SpaceTravelPhase.GROUNDED) return { ok: false, reason: 'already_grounded' };
    if (this.activeShip) this.activeShip.applyDamage(25);
    this.phase = SpaceTravelPhase.GROUNDED;
    this.currentNode = null;
    this.targetNode = null;
    this.currentBodyKey = null;
    this.routeProgress = 0;
    this.launchProgress = 0;
    this.launchSupport = 0;
    this.systemState = null;
    this.surfaceState = null;
    return { ok: true, damage: 25 };
  }

  _jumpToPlottedSystem() {
    if (!this.targetNode || !this.activeShip) return null;
    const route = this.getRouteTo(this.targetNode);
    if (!route) return { event: 'jump_failed', reason: 'no_route' };
    const fromNode = this.currentNode;
    const destinationNode = this.targetNode;
    const fromPos = SPACE_SYSTEM_LAYOUT[fromNode] || SPACE_SYSTEM_LAYOUT.orbit;
    const toPos = SPACE_SYSTEM_LAYOUT[destinationNode] || SPACE_SYSTEM_LAYOUT.orbit;
    const dir = _bqNormalize(toPos.x - fromPos.x, toPos.y - fromPos.y);
    this.currentNode = destinationNode;
    this.targetNode = null;
    this.routeDistance = route.distance;
    this.currentBodyKey = null;
    this.systemState = _bqCreateSystemState(this.currentNode, this.activeShip.condition, { x: dir.x, y: dir.y });
    this.surfaceState = null;
    const playerRef = (typeof player !== 'undefined' && player)
      ? player
      : ((typeof window !== 'undefined' && window?.player) ? window.player : null);
    const hazard = _bqResolveIonFieldJumpHazard(
      route,
      this.currentNode,
      this.activeShip,
      playerRef?.modifiers || null,
      `${fromNode}:${destinationNode}`
    );
    const conflictHazard = _bqResolveBearBlockadeHazard(
      route,
      fromNode,
      this.currentNode,
      this.activeShip,
      playerRef,
      `${fromNode}:${destinationNode}`
    );
    return {
      event: 'jumped',
      node: this.currentNode,
      from: fromNode,
      fuelUsed: route.fuelCost,
      hazard,
      conflictHazard,
    };
  }

  tickFrame(deltaMs, input = {}) {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return null;

    if (this.phase === SpaceTravelPhase.ASCENDING) {
      const ascentDuration = Math.max(1500, 2600 * (1 - (Math.max(0, Math.min(1, this.launchSupport || 0)) * 0.4)));
      this.launchProgress = Math.min(1, this.launchProgress + (deltaMs / ascentDuration));
      this.routeProgress = this.launchProgress;
      if (this.launchProgress >= 1) return { event: 'launch_complete', ...this.completeAscent(true) };
      return { event: 'launching', progress: this.launchProgress };
    }

    if (this.phase === SpaceTravelPhase.REENTRY) {
      this.launchProgress = Math.min(1, this.launchProgress + (deltaMs / 2200));
      this.routeProgress = this.launchProgress;
      if (this.launchProgress >= 1) return { event: 'reentry_complete', ...this.completeReentry(true, 0) };
      return { event: 'reentry', progress: this.launchProgress };
    }

    if (this.phase === SpaceTravelPhase.LANDED && this.surfaceState?.mode === 'earth_world') {
      return { event: 'earth_surface', bodyKey: this.currentBodyKey };
    }

    if (this.phase === SpaceTravelPhase.LANDED) {
      const handoff = (typeof window !== 'undefined') ? window.BQEnterPlanetSurfaceFromSpace : null;
      const body = this.getBodyByKey(this.currentBodyKey) || { key: this.currentBodyKey, name: this.currentBodyKey || 'Surface', kind: 'planet' };
      if (typeof handoff === 'function') {
        const result = handoff(this, body);
        if (result?.ok) return { event: 'planet_surface', bodyKey: this.currentBodyKey };
      }
      return { event: 'docked', bodyKey: this.currentBodyKey };
    }

    if (this.phase !== SpaceTravelPhase.IN_ORBIT || !this.systemState?.ship) return null;

    const ship = this.systemState.ship;
    const thrustX = Number(input.thrustX) || 0;
    const thrustY = Number(input.thrustY) || 0;
    const boost = !!input.boost;
    const thrust = _bqNormalize(thrustX, thrustY);
    const hasThrust = Math.abs(thrustX) > 0.01 || Math.abs(thrustY) > 0.01;
    const accel = hasThrust ? (boost ? 0.00032 : 0.00022) : 0;
    const damping = Math.pow(0.992, deltaMs / 16);
    const maxSpeed = boost ? 0.7 : 0.48;

    if (hasThrust) {
      ship.vx += thrust.x * accel * deltaMs;
      ship.vy += thrust.y * accel * deltaMs;
      ship.heading = Math.atan2(thrust.y, thrust.x);
    }

    ship.vx *= damping;
    ship.vy *= damping;

    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > maxSpeed) {
      ship.vx = (ship.vx / speed) * maxSpeed;
      ship.vy = (ship.vy / speed) * maxSpeed;
    }

    ship.x += ship.vx * deltaMs;
    ship.y += ship.vy * deltaMs;
    ship.x = _bqClamp(ship.x, 40, this.systemState.width - 40);
    ship.y = _bqClamp(ship.y, 40, this.systemState.height - 40);

    const nearest = this.getNearestBody(220);
    this.systemState.nearestBodyKey = nearest?.key || null;

    if (this.targetNode) {
      const here = SPACE_SYSTEM_LAYOUT[this.currentNode] || SPACE_SYSTEM_LAYOUT.orbit;
      const dest = SPACE_SYSTEM_LAYOUT[this.targetNode] || SPACE_SYSTEM_LAYOUT.orbit;
      const dir = _bqNormalize(dest.x - here.x, dest.y - here.y);
      const edgeThresholdX = this.systemState.width * 0.47;
      const edgeThresholdY = this.systemState.height * 0.47;
      const relX = ship.x - this.systemState.centerX;
      const relY = ship.y - this.systemState.centerY;
      const aligned = ((relX * dir.x) + (relY * dir.y)) > 620;
      const atEdge = Math.abs(relX) > edgeThresholdX || Math.abs(relY) > edgeThresholdY;
      if (aligned && atEdge) {
        return this._jumpToPlottedSystem();
      }
    }

    return { event: 'flying', nearestBody: nearest, plottedNode: this.targetNode };
  }

  renderScene(viewWidth, viewHeight) {
    _bqEnsureSpaceWorldGraph();
    if (typeof push !== 'function' || typeof background !== 'function') return;
    const w = Number(viewWidth) || (typeof width !== 'undefined' ? width : 1280);
    const h = Number(viewHeight) || (typeof height !== 'undefined' ? height : 720);

    if (this.phase === SpaceTravelPhase.ASCENDING || this.phase === SpaceTravelPhase.REENTRY) {
      const p = _bqClamp(this.launchProgress || 0, 0, 1);
      background(4, 7, 18);
      push();
      noStroke();
      const sky = drawingContext.createLinearGradient(0, h, 0, 0);
      sky.addColorStop(0, this.phase === SpaceTravelPhase.ASCENDING ? '#2f1b10' : '#090f17');
      sky.addColorStop(0.55, '#10213c');
      sky.addColorStop(1, '#02050b');
      drawingContext.fillStyle = sky;
      rect(0, 0, w, h);

      const exhaustX = w * 0.5;
      const exhaustY = h * (0.8 - p * 0.55);
      fill(255, 208, 105, 220);
      ellipse(exhaustX, exhaustY + 96, 18 + (p * 28), 120 + (p * 160));
      fill(125, 201, 255, 210);
      rect(exhaustX - 10, exhaustY - 20, 20, 46, 8);
      triangle(exhaustX - 18, exhaustY + 8, exhaustX + 18, exhaustY + 8, exhaustX, exhaustY - 36);
      fill(255, 255, 255, 150 + (p * 90));
      for (let i = 0; i < 24; i += 1) {
        const sx = ((i * 83) % w);
        const sy = ((i * 151) % h) - (p * h * 0.7);
        rect(sx, ((sy % h) + h) % h, 2, 14 + (p * 36));
      }
      fill(240);
      textAlign(CENTER, CENTER);
      textSize(22);
      text(this.phase === SpaceTravelPhase.ASCENDING ? 'Launch Burn' : 'Re-entry Corridor', w / 2, 64);
      textSize(14);
      text(`${Math.round(p * 100)}%`, w / 2, 94);
      pop();
      return;
    }

    if (this.phase === SpaceTravelPhase.LANDED && this.surfaceState?.mode === 'earth_world') {
      return;
    }

    if (this.phase === SpaceTravelPhase.LANDED) {
      const handoff = (typeof window !== 'undefined') ? window.BQEnterPlanetSurfaceFromSpace : null;
      const body = this.getBodyByKey(this.currentBodyKey) || { key: this.currentBodyKey, name: this.currentBodyKey || 'Surface', kind: 'planet' };
      if (typeof handoff === 'function') {
        const result = handoff(this, body);
        if (result?.ok) return;
      }
      background(4, 7, 18);
      return;
    }

    background(3, 6, 16);
    push();
    noStroke();
    for (let i = 0; i < 90; i += 1) {
      fill(255, 255, 255, 50 + ((i % 5) * 25));
      circle(((i * 173) % w), ((i * 97) % h), 1 + (i % 3));
    }
    pop();

    if (!this.systemState?.ship) return;

    const ship = this.systemState.ship;
    const camX = _bqClamp(ship.x, w / 2, Math.max(w / 2, this.systemState.width - (w / 2)));
    const camY = _bqClamp(ship.y, h / 2, Math.max(h / 2, this.systemState.height - (h / 2)));
    const availableRoutes = this.getAvailableRoutes(this.currentNode);
    const routeMarkers = _bqBuildSystemRouteMarkers(this.currentNode, this.systemState, availableRoutes);

    push();
    translate((w / 2) - camX, (h / 2) - camY);

    noStroke();
    fill(this.systemState.starColor || '#7dc9ff');
    circle(this.systemState.centerX, this.systemState.centerY, 150);
    fill(255, 255, 255, 50);
    circle(this.systemState.centerX, this.systemState.centerY, 230);

    for (const body of this.systemState.bodies) {
      if (body.kind === 'asteroid') {
        fill(body.accent || '#b8c9de');
        circle(body.x, body.y, body.radius * 2);
        continue;
      }
      fill(255, 255, 255, 14);
      circle(this.systemState.centerX, this.systemState.centerY, body.orbitRadius * 2);
      fill(body.accent || '#9fb5ce');
      circle(body.x, body.y, body.radius * 2);
      if (body.key === 'homeworld') {
        fill(64, 181, 246, 220);
        circle(body.x, body.y, body.radius * 1.86);
        fill(67, 160, 71, 210);
        ellipse(body.x - 20, body.y - 12, body.radius * 0.64, body.radius * 0.42);
        ellipse(body.x + 18, body.y + 10, body.radius * 0.52, body.radius * 0.34);
      }
      if (body.kind === 'station') {
        stroke(255, 255, 255, 120);
        noFill();
        circle(body.x, body.y, body.radius * 2.8);
        noStroke();
      }
    }

    for (const marker of routeMarkers) {
      const isTarget = marker.destination === this.targetNode;
      stroke(isTarget ? 'rgba(255,208,105,0.95)' : 'rgba(125,201,255,0.62)');
      strokeWeight(isTarget ? 3 : 2);
      line(marker.x - (marker.dir.x * 86), marker.y - (marker.dir.y * 86), marker.x, marker.y);
      noStroke();
      fill(isTarget ? '#ffd069' : '#9fd9ff');
      circle(marker.x, marker.y, isTarget ? 18 : 13);
      fill(isTarget ? '#fff2ce' : '#dcecff');
      textAlign(CENTER, BOTTOM);
      textSize(12);
      text(marker.label, marker.x + (marker.dir.x * 10), marker.y + (marker.dir.y * 10) - 12);
    }

    push();
    translate(ship.x, ship.y);
    rotate(ship.heading || 0);
    noStroke();
    fill(255, 255, 255, 220);
    triangle(18, 0, -16, -10, -16, 10);
    fill(125, 201, 255, 200);
    rect(-14, -6, 12, 12, 4);
    pop();

    pop();

    const nearest = this.getNearestBody();
    push();
    fill(230);
    noStroke();
    textAlign(LEFT, TOP);
    textSize(14);
    const meta = _bqGetNodeMeta(this.currentNode);
    text(`${meta.label}  |  WASD thrust  |  Shift boost  |  M toggle nav`, 18, 18);
    if (this.targetNode) {
      text(`Plotted jump: ${_bqGetNodeMeta(this.targetNode).label}  |  Reach the system edge in that direction to jump`, 18, 40);
    } else if (availableRoutes.length > 0) {
      text(`Connected corridors: ${availableRoutes.map((route) => _bqGetNodeMeta(route.destination)?.label || route.destination).join(' · ')}`, 18, 40);
    }
    if (nearest) {
      text(`Nearby: ${nearest.name} (${nearest.kind})  |  Press E to dock`, 18, 62);
    }
    if (this.phase === SpaceTravelPhase.LANDED) {
      const body = this.getBodyByKey(this.currentBodyKey);
      text(`Docked at ${body?.name || 'surface site'}  |  Press E to lift off`, 18, 84);
    }
    pop();

    _bqRenderFlightMinimap(this.systemState, this.currentNode, this.targetNode, routeMarkers, w, h, camX, camY);
  }

  getState() {
    _bqEnsureSpaceWorldGraph();
    return {
      phase: this.phase,
      currentNode: this.currentNode,
      targetNode: this.targetNode,
      routeProgress: this.routeProgress,
	      routeDistance: this.routeDistance,
	      currentBodyKey: this.currentBodyKey,
	      launchProgress: this.launchProgress,
	      launchSupport: this.launchSupport,
      reentrySupport: this.reentrySupport,
      ship: this.activeShip ? {
        name: this.activeShip.name,
        type: this.activeShip.type,
        displayName: this.activeShip.displayName,
        condition: this.activeShip.condition,
        fuel: this.activeShip.fuel,
        fuelCapacity: this.activeShip.getEffectiveFuelCapacity(),
        cargo: this.activeShip.getStorageWeight(),
        cargoMax: this.activeShip.getStorageCapacity(),
        hp: this.activeShip.getEffectiveHP(),
        hasCaptain: this.activeShip.hasCaptain(),
      } : null,
      launchCity: this.launchCity?.name || null,
      systemState: this.systemState ? {
        nodeKey: this.systemState.nodeKey,
        ship: { ...this.systemState.ship },
        nearestBodyKey: this.systemState.nearestBodyKey || null,
      } : null,
      surfaceState: this.surfaceState ? {
        mode: this.surfaceState.mode || null,
        bodyKey: this.surfaceState.bodyKey,
        bodyName: this.surfaceState.bodyName,
        kind: this.surfaceState.kind,
        player: this.surfaceState.player ? { ...this.surfaceState.player } : null,
      } : null,
      availableRoutes: this.getAvailableRoutes(),
    };
  }

  toJSON() {
    return {
      graphSeed: _bqSpaceWorldSeed,
      phase: this.phase,
      currentNode: this.currentNode,
      targetNode: this.targetNode,
      routeProgress: this.routeProgress,
      routeDistance: this.routeDistance,
      encounterSeed: this.encounterSeed,
      launchCityName: this.launchCity?.name || null,
      activeShip: this.activeShip ? this.activeShip.toJSON() : null,
	      launchProgress: this.launchProgress,
	      launchSupport: this.launchSupport,
      reentrySupport: this.reentrySupport,
	      launchDestination: this.launchDestination,
      currentBodyKey: this.currentBodyKey,
      systemState: this.systemState,
      surfaceState: this.surfaceState,
    };
  }

  static fromJSON(data, cityLookup = null) {
    _bqEnsureSpaceWorldGraph(data?.graphSeed);
    const sys = new SpaceTravelSystem();
    if (!data || typeof data !== 'object') return sys;
    sys.phase = Object.values(SpaceTravelPhase).includes(data.phase) ? data.phase : SpaceTravelPhase.GROUNDED;
    sys.currentNode = (typeof data.currentNode === 'string') ? data.currentNode : null;
    sys.targetNode = (typeof data.targetNode === 'string') ? data.targetNode : null;
    sys.routeProgress = Math.max(0, Math.min(1, Number(data.routeProgress) || 0));
    sys.routeDistance = Math.max(0, Number(data.routeDistance) || 0);
    sys.encounterSeed = Number.isFinite(Number(data.encounterSeed)) ? data.encounterSeed : null;
	    sys.launchProgress = Math.max(0, Math.min(1, Number(data.launchProgress) || 0));
	    sys.launchSupport = Math.max(0, Math.min(1, Number(data.launchSupport) || 0));
    sys.reentrySupport = Math.max(-0.12, Math.min(0.35, Number(data.reentrySupport) || 0));
    sys.launchDestination = (typeof data.launchDestination === 'string') ? data.launchDestination : null;
    sys.currentBodyKey = (typeof data.currentBodyKey === 'string') ? data.currentBodyKey : null;
    if (data.activeShip) sys.activeShip = SpaceShip.fromJSON(data.activeShip);
    if (data.launchCityName && cityLookup && typeof cityLookup === 'function') {
      sys.launchCity = cityLookup(data.launchCityName);
    }
    if (data.systemState && typeof data.systemState === 'object') {
      sys.systemState = data.systemState;
    } else if (sys.currentNode && sys.phase !== SpaceTravelPhase.GROUNDED) {
      sys.systemState = _bqCreateSystemState(sys.currentNode, sys.activeShip?.condition || 100);
    }
    if (data.surfaceState && typeof data.surfaceState === 'object') {
      sys.surfaceState = data.surfaceState;
    } else if (sys.phase === SpaceTravelPhase.LANDED && sys.currentBodyKey === 'homeworld') {
      sys.surfaceState = _bqCreateSurfaceState(sys.currentNode, sys.getBodyByKey(sys.currentBodyKey));
    }
    return sys;
  }
}

// ── Expose to window ────────────────────────────────────
if (typeof window !== 'undefined') {
  window.SpaceShipLibrary = SpaceShipLibrary;
  window.SpaceCaptainLibrary = SpaceCaptainLibrary;
  window.SpaceShip = SpaceShip;
  window.SpaceTravelPhase = SpaceTravelPhase;
  window.SpaceTravelSystem = SpaceTravelSystem;
  window.createSpaceCaptainProfile = createSpaceCaptainProfile;
  window.BQGetSpaceWorldGraph = () => _bqEnsureSpaceWorldGraph();
  window.BQConfigureSpaceWorldGraph = (seed) => _bqConfigureSpaceWorldGraph(seed);
  window.BQGetSpaceDestinationCatalog = () => _bqGetDestinationCatalog();
}
