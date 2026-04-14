// SpaceTravelSystem.js — Space travel orchestrator
// Mirrors Boat.js vessel patterns for ship stats, storage, and condition.
// Owns route rules, fuel, docking clearance, landing, and encounter resolution.

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
    description: 'A compact orbital shuttle. Cheap to fuel, limited cargo.',
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
    desc: 'Fresh academy graduate. Cheap but burns extra fuel.',
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
    desc: 'Legendary pilot. Deadly combat and fuel-sipping runs.',
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

  // ─── Fuel ───

  /** Fuel cost to travel a route, modified by captain efficiency */
  getFuelCost(routeDistance) {
    const base = Math.max(1, Math.ceil(routeDistance * 0.4));
    const captainMod = this.captain?.fuelEfficiency || 1.0;
    return Math.max(1, Math.ceil(base * captainMod));
  }

  consumeFuel(amount) {
    this.fuel = Math.max(0, Math.round(this.fuel - amount));
  }

  refuel(amount) {
    this.fuel = Math.min(this.getEffectiveFuelCapacity(), Math.round(this.fuel + amount));
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

const SPACE_WORLD_GRAPH = _bqDeepFreeze({
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

const SPACE_BODY_INDEX = (() => {
  const index = new Map();
  for (const system of Object.values(SPACE_WORLD_GRAPH.systems)) {
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
})();

const SPACE_SYSTEM_LAYOUT = Object.freeze(
  Object.fromEntries(
    Object.entries(SPACE_WORLD_GRAPH.systems).map(([key, system]) => [key, {
      x: system.x,
      y: system.y,
      label: system.label,
      accent: system.accent,
      description: system.description,
    }])
  )
);

function _bqGetSystemDef(nodeKey) {
  return SPACE_WORLD_GRAPH.systems[nodeKey] || null;
}

function _bqGetBodyDef(bodyKey) {
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

function _bqDistance(a, b) {
  const dx = (a?.x || 0) - (b?.x || 0);
  const dy = (a?.y || 0) - (b?.y || 0);
  return Math.hypot(dx, dy);
}

function _bqNormalize(x, y) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function _bqSystemTemplate(nodeKey) {
  const system = _bqGetSystemDef(nodeKey) || _bqGetSystemDef('orbit');
  const meta = _bqGetNodeMeta(system.key);
  const common = {
    nodeKey: system.key,
    width: Number(system.width) || 3200,
    height: Number(system.height) || 2200,
    starColor: system.starColor || meta.accent,
    starName: system.starName || `${meta.label} Star`,
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
  const bodies = template.bodies.map((body) => ({
    ...body,
    x: centerX + Math.cos(body.angle) * body.orbitRadius,
    y: centerY + Math.sin(body.angle) * body.orbitRadius,
    interactionRadius: body.radius + (body.kind === 'station' ? 90 : 110),
  }));

  for (const belt of template.asteroidBelts) {
    for (let i = 0; i < belt.count; i += 1) {
      const angle = (i / belt.count) * Math.PI * 2 + ((rng() - 0.5) * 0.35);
      const distance = belt.radius + ((rng() - 0.5) * 120);
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
  return {
    nodeKey,
    width: template.width,
    height: template.height,
    centerX,
    centerY,
    starName: template.starName,
    starColor: template.starColor,
    ship: {
      x: centerX - (initialDir.x * 640),
      y: centerY - (initialDir.y * 420),
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
  const seed = `${nodeKey}:${body.key}:surface`;
  const rng = _bqCreateSeededRandom(seed);
  const theme = _bqGetSurfaceTheme(nodeKey, body, body.kind === 'station');

  if (body.key === 'homeworld') {
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

  return _bqCreatePlanetGridSurface(nodeKey, body, rng, theme);
}

// ── SpaceTravelSystem ───────────────────────────────────
class SpaceTravelSystem {
  constructor() {
    this.phase = SpaceTravelPhase.GROUNDED;
    this.activeShip = null;
    this.launchCity = null;
    this.currentNode = null;
    this.targetNode = null;
    this.routeProgress = 0;
    this.routeDistance = 0;
    this.encounterSeed = null;
    this.launchProgress = 0;
    this.launchDestination = null;
    this.currentBodyKey = null;
    this.systemState = null;
    this.surfaceState = null;
  }

  getAvailableRoutes(nodeKey = null) {
    const baseNode = nodeKey || this.currentNode || 'orbit';
    return _bqGetRoutesFrom(baseNode).map((route) => ({
      ...route,
      fuelCost: this.activeShip ? this.activeShip.getFuelCost(route.distance) : route.distance,
      canAfford: this.activeShip ? this.activeShip.fuel >= this.activeShip.getFuelCost(route.distance) : false,
    }));
  }

  getRouteTo(destinationNode, fromNode = null) {
    const baseNode = fromNode || this.currentNode || 'orbit';
    const route = _bqGetRoute(baseNode, destinationNode);
    if (!route) return null;
    return {
      ...route,
      destination: route.from === baseNode ? route.to : route.from,
      fuelCost: this.activeShip ? this.activeShip.getFuelCost(route.distance) : route.distance,
      canAfford: this.activeShip ? this.activeShip.fuel >= this.activeShip.getFuelCost(route.distance) : false,
    };
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
    if (!city || !ship) return { ok: false, reason: 'missing_args' };
    if (this.phase !== SpaceTravelPhase.GROUNDED) return { ok: false, reason: 'not_grounded' };

    const prog = city.progression;
    if (!prog?.spaceAccess?.launchReady && !prog?.spaceportBuilt && !city.hasSpaceport) {
      return { ok: false, reason: 'no_spaceport' };
    }
    if (ship.fuel <= 0) return { ok: false, reason: 'no_fuel' };
    if (ship.condition <= 0) return { ok: false, reason: 'ship_destroyed' };

    const launchNode = SPACE_SYSTEM_LAYOUT[destinationNode] ? destinationNode : 'orbit';
    this.activeShip = ship;
    this.launchCity = city;
    this.launchDestination = launchNode;
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
    if (this.activeShip.fuel < launchFuel) return { ok: false, reason: 'insufficient_fuel' };
    this.activeShip.consumeFuel(launchFuel);
    this.routeDistance = launchDistance;
    this.phase = SpaceTravelPhase.ASCENDING;
    this.launchProgress = 0;
    return { ok: true, fuelUsed: launchFuel };
  }

  completeAscent(success = true) {
    if (this.phase !== SpaceTravelPhase.ASCENDING) return { ok: false, reason: 'wrong_phase' };
    if (!success) {
      this.activeShip.applyDamage(15);
      this.phase = SpaceTravelPhase.GROUNDED;
      this.launchProgress = 0;
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
    if (!route.canAfford) return { ok: false, reason: 'insufficient_fuel' };
    this.targetNode = destinationNode;
    this.routeDistance = route.distance;
    return { ok: true, route };
  }

  clearRoute() {
    this.targetNode = null;
    this.routeDistance = 0;
    return { ok: true };
  }

  dockNearestBody() {
    if (this.phase !== SpaceTravelPhase.IN_ORBIT) return { ok: false, reason: 'wrong_phase' };
    const nearest = this.getNearestBody();
    if (!nearest) return { ok: false, reason: 'no_target' };
    if (nearest.kind === 'asteroid') return { ok: false, reason: 'invalid_target' };
    this.phase = SpaceTravelPhase.LANDED;
    this.currentBodyKey = nearest.key;
    if (this.systemState?.ship) {
      this.systemState.ship.vx = 0;
      this.systemState.ship.vy = 0;
    }
    this.surfaceState = _bqCreateSurfaceState(this.currentNode, nearest);
    return { ok: true, body: nearest, surfaceState: this.surfaceState };
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
    this.launchDestination = null;
    this.systemState = null;
    this.surfaceState = null;
    return { ok: true, body: body || null };
  }

  liftOff() {
    if (this.phase !== SpaceTravelPhase.LANDED) return { ok: false, reason: 'not_landed' };
    const fuelCost = this.activeShip.getFuelCost(2);
    if (this.activeShip.fuel < fuelCost) return { ok: false, reason: 'insufficient_fuel' };
    this.activeShip.consumeFuel(fuelCost);
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

  beginReentry() {
    if (this.phase !== SpaceTravelPhase.IN_ORBIT) return { ok: false, reason: 'wrong_phase' };
    if (this.currentNode !== 'orbit') return { ok: false, reason: 'not_home_orbit' };
    const reentryFuel = this.activeShip.getFuelCost(3);
    if (this.activeShip.fuel < reentryFuel) return { ok: false, reason: 'insufficient_fuel' };
    this.activeShip.consumeFuel(reentryFuel);
    this.phase = SpaceTravelPhase.REENTRY;
    this.launchProgress = 0;
    return { ok: true, fuelUsed: reentryFuel };
  }

  completeReentry(success = true, damage = null) {
    if (this.phase !== SpaceTravelPhase.REENTRY) return { ok: false, reason: 'wrong_phase' };
    const appliedDamage = Math.max(0, Number.isFinite(Number(damage)) ? Number(damage) : (success ? 0 : 20));
    if (appliedDamage > 0) this.activeShip.applyDamage(appliedDamage);
    this.phase = SpaceTravelPhase.GROUNDED;
    this.currentNode = null;
    this.targetNode = null;
    this.currentBodyKey = null;
    this.routeProgress = 0;
    this.launchProgress = 0;
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
    this.systemState = null;
    this.surfaceState = null;
    return { ok: true, damage: 25 };
  }

  _jumpToPlottedSystem() {
    if (!this.targetNode || !this.activeShip) return null;
    const route = this.getRouteTo(this.targetNode);
    if (!route) return { event: 'jump_failed', reason: 'no_route' };
    if (this.activeShip.fuel < route.fuelCost) return { event: 'jump_failed', reason: 'insufficient_fuel' };
    const fromNode = this.currentNode;
    const fromPos = SPACE_SYSTEM_LAYOUT[fromNode] || SPACE_SYSTEM_LAYOUT.orbit;
    const toPos = SPACE_SYSTEM_LAYOUT[this.targetNode] || SPACE_SYSTEM_LAYOUT.orbit;
    const dir = _bqNormalize(toPos.x - fromPos.x, toPos.y - fromPos.y);
    this.activeShip.consumeFuel(route.fuelCost);
    this.currentNode = this.targetNode;
    this.targetNode = null;
    this.routeDistance = route.distance;
    this.currentBodyKey = null;
    this.systemState = _bqCreateSystemState(this.currentNode, this.activeShip.condition, { x: dir.x, y: dir.y });
    this.surfaceState = null;
    return { event: 'jumped', node: this.currentNode, from: fromNode, fuelUsed: route.fuelCost };
  }

  tickFrame(deltaMs, input = {}) {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return null;

    if (this.phase === SpaceTravelPhase.ASCENDING) {
      this.launchProgress = Math.min(1, this.launchProgress + (deltaMs / 2600));
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

    if (this.phase === SpaceTravelPhase.LANDED && this.surfaceState?.player) {
      const walker = this.surfaceState.player;
      const walkX = Number(input.thrustX) || 0;
      const walkY = Number(input.thrustY) || 0;
      const sprint = !!input.boost;
      const dir = _bqNormalize(walkX, walkY);
      const moving = Math.abs(walkX) > 0.01 || Math.abs(walkY) > 0.01;
      const accel = moving ? (sprint ? 0.00115 : 0.00082) : 0;
      const damping = Math.pow(0.9, deltaMs / 16);
      const maxSpeed = sprint ? 0.42 : 0.28;

      if (moving) {
        walker.vx += dir.x * accel * deltaMs;
        walker.vy += dir.y * accel * deltaMs;
        walker.heading = Math.atan2(dir.y, dir.x);
      }

      walker.vx *= damping;
      walker.vy *= damping;

      const speed = Math.hypot(walker.vx, walker.vy);
      if (speed > maxSpeed) {
        walker.vx = (walker.vx / speed) * maxSpeed;
        walker.vy = (walker.vy / speed) * maxSpeed;
      }

      walker.x = _bqClamp(walker.x + (walker.vx * deltaMs), 60, this.surfaceState.width - 60);
      walker.y = _bqClamp(walker.y + (walker.vy * deltaMs), 80, this.surfaceState.height - 50);
      return { event: moving ? 'surface_moving' : 'surface_idle', bodyKey: this.currentBodyKey };
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

    if (this.phase === SpaceTravelPhase.LANDED && this.surfaceState?.player) {
      const surface = this.surfaceState;
      const theme = surface.theme || {};
      background(theme.skyTop || '#17304a');
      push();
      noStroke();
      const sky = drawingContext.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, theme.skyTop || '#17304a');
      sky.addColorStop(0.62, theme.skyBottom || '#9fd4ff');
      sky.addColorStop(1, theme.horizon || '#43627b');
      drawingContext.fillStyle = sky;
      rect(0, 0, w, h);

      const cameraX = _bqClamp(surface.player.x, w / 2, Math.max(w / 2, surface.width - (w / 2)));
      const cameraY = _bqClamp(surface.player.y, h / 2, Math.max(h / 2, surface.height - (h / 2)));
      translate((w / 2) - cameraX, (h / 2) - cameraY);

      const tileSize = Number(surface.tileSize) || 64;
      for (let i = 0; i < 40; i += 1) {
        fill(255, 255, 255, 30 + ((i % 4) * 25));
        circle((i * 137) % surface.width, ((i * 89) % Math.max(1, Math.floor(surface.height * 0.22))) + 10, 1 + (i % 2));
      }

      if (Array.isArray(surface.tiles)) {
        for (let row = 0; row < (surface.rows || 0); row += 1) {
          for (let col = 0; col < (surface.cols || 0); col += 1) {
            const tile = surface.tiles[row]?.[col];
            if (!tile) continue;
            const tx = col * tileSize;
            const ty = row * tileSize;
            fill(tile.color || theme.groundA || '#4f8d59');
            rect(tx, ty, tileSize, tileSize);
            stroke(tile.line || theme.horizon || '#43627b');
            strokeWeight(1);
            line(tx, ty, tx + tileSize, ty);
            line(tx, ty, tx, ty + tileSize);
            noStroke();
          }
        }
      }

      for (const site of surface.settlements || []) {
        fill(site.color || theme.accent || '#e8f4ff');
        rect(site.x - 22, site.y - 22, 44, 44, 8);
        stroke(255, 255, 255, 70);
        noFill();
        rect(site.x - 30, site.y - 30, 60, 60, 12);
        noStroke();
        fill(18, 25, 35, 180);
        rect(site.x - 28, site.y + 20, 56, 18, 6);
        fill(255);
        textAlign(CENTER, CENTER);
        textSize(10);
        text(site.label || 'Site', site.x, site.y + 29);
      }

      for (const entity of surface.entities || []) {
        fill(40, 55, 78, 220);
        rect(entity.x - 8, entity.y - 10, 16, 20, 4);
        fill(theme.skyBottom || '#9fd4ff');
        rect(entity.x - 3, entity.y - 18, 6, 10, 3);
        fill(theme.accent || '#f2f6ff');
        circle(entity.x, entity.y - 20, entity.radius);
      }

      push();
      translate(surface.player.x, surface.player.y);
      rotate(surface.player.heading || 0);
      stroke(255, 255, 255, 80);
      noFill();
      ellipse(0, 12, 56, 18);
      noStroke();
      fill(235, 242, 255, 230);
      triangle(22, 0, -18, -14, -18, 14);
      fill(99, 199, 255, 210);
      rect(-14, -8, 12, 16, 4);
      fill(45, 56, 78, 230);
      rect(-18, -4, 8, 8, 3);
      rect(-8, -16, 10, 8, 3);
      rect(-8, 8, 10, 8, 3);
      fill(255, 208, 105, 180);
      triangle(-20, 0, -34, -8, -34, 8);
      pop();
      pop();

      push();
      fill(240);
      noStroke();
      textAlign(LEFT, TOP);
      textSize(14);
      const body = this.getBodyByKey(this.currentBodyKey);
      text(`${body?.name || 'Surface'}  |  Lander Grid  |  WASD thrust  |  Shift boost  |  E lift off  |  M star map`, 18, 18);
      text(`Surface landing zone active with ${surface.settlements?.length || 0} sci-fi sites and ${surface.entities?.length || 0} contacts.`, 18, 40);
      pop();
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

    if (this.targetNode) {
      const here = SPACE_SYSTEM_LAYOUT[this.currentNode] || SPACE_SYSTEM_LAYOUT.orbit;
      const dest = SPACE_SYSTEM_LAYOUT[this.targetNode] || SPACE_SYSTEM_LAYOUT.orbit;
      const dir = _bqNormalize(dest.x - here.x, dest.y - here.y);
      const markerX = this.systemState.centerX + dir.x * (Math.min(this.systemState.width, this.systemState.height) * 0.42);
      const markerY = this.systemState.centerY + dir.y * (Math.min(this.systemState.width, this.systemState.height) * 0.42);
      stroke(255, 208, 105, 180);
      strokeWeight(3);
      line(markerX - (dir.x * 80), markerY - (dir.y * 80), markerX, markerY);
      noStroke();
      fill(255, 208, 105, 220);
      circle(markerX, markerY, 18);
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
    text(`${meta.label}  |  WASD thrust  |  Shift boost  |  M star map`, 18, 18);
    if (this.targetNode) {
      text(`Plotted jump: ${_bqGetNodeMeta(this.targetNode).label}  |  Reach the system edge in that direction to jump`, 18, 40);
    }
    if (nearest) {
      text(`Nearby: ${nearest.name} (${nearest.kind})  |  Press E to dock`, 18, 62);
    }
    if (this.phase === SpaceTravelPhase.LANDED) {
      const body = this.getBodyByKey(this.currentBodyKey);
      text(`Docked at ${body?.name || 'surface site'}  |  Press E to lift off`, 18, 84);
    }
    pop();
  }

  getState() {
    return {
      phase: this.phase,
      currentNode: this.currentNode,
      targetNode: this.targetNode,
      routeProgress: this.routeProgress,
      routeDistance: this.routeDistance,
      currentBodyKey: this.currentBodyKey,
      launchProgress: this.launchProgress,
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
        player: { ...this.surfaceState.player },
      } : null,
      availableRoutes: this.getAvailableRoutes(),
    };
  }

  toJSON() {
    return {
      phase: this.phase,
      currentNode: this.currentNode,
      targetNode: this.targetNode,
      routeProgress: this.routeProgress,
      routeDistance: this.routeDistance,
      encounterSeed: this.encounterSeed,
      launchCityName: this.launchCity?.name || null,
      activeShip: this.activeShip ? this.activeShip.toJSON() : null,
      launchProgress: this.launchProgress,
      launchDestination: this.launchDestination,
      currentBodyKey: this.currentBodyKey,
      systemState: this.systemState,
      surfaceState: this.surfaceState,
    };
  }

  static fromJSON(data, cityLookup = null) {
    const sys = new SpaceTravelSystem();
    if (!data || typeof data !== 'object') return sys;
    sys.phase = Object.values(SpaceTravelPhase).includes(data.phase) ? data.phase : SpaceTravelPhase.GROUNDED;
    sys.currentNode = (typeof data.currentNode === 'string') ? data.currentNode : null;
    sys.targetNode = (typeof data.targetNode === 'string') ? data.targetNode : null;
    sys.routeProgress = Math.max(0, Math.min(1, Number(data.routeProgress) || 0));
    sys.routeDistance = Math.max(0, Number(data.routeDistance) || 0);
    sys.encounterSeed = Number.isFinite(Number(data.encounterSeed)) ? data.encounterSeed : null;
    sys.launchProgress = Math.max(0, Math.min(1, Number(data.launchProgress) || 0));
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
    } else if (sys.phase === SpaceTravelPhase.LANDED && sys.currentBodyKey) {
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
}
