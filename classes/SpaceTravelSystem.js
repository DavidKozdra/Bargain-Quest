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
  GROUNDED: 'grounded',       // on ground at a city
  LAUNCH_PREP: 'launch_prep', // fuel check, cargo lock, countdown
  ASCENDING: 'ascending',     // launch QTE window
  IN_ORBIT: 'in_orbit',       // orbit achieved, can pick route
  EN_ROUTE: 'en_route',       // travelling between nodes
  DOCKING: 'docking',         // docking at station/planet (QTE window)
  LANDED: 'landed',           // on a planet surface
  REENTRY: 'reentry',         // returning to ground (QTE window)
};

// ── Orbital Route Definitions ───────────────────────────
// Routes connect the city (launch site) to orbital nodes and planets.
// distance drives fuel cost, dangerRating drives encounter chance.
function _bqOrbitalRoutes() {
  return [
    { from: 'orbit',  to: 'luna',    distance: 10, dangerRating: 0.05, label: 'Orbit → Luna Station' },
    { from: 'orbit',  to: 'aurelia', distance: 22, dangerRating: 0.15, label: 'Orbit → Aurelia Bloom' },
    { from: 'orbit',  to: 'vanta',   distance: 38, dangerRating: 0.35, label: 'Orbit → Vanta Rift' },
    { from: 'luna',   to: 'aurelia', distance: 18, dangerRating: 0.10, label: 'Luna → Aurelia' },
    { from: 'luna',   to: 'vanta',   distance: 30, dangerRating: 0.25, label: 'Luna → Vanta' },
    { from: 'aurelia',to: 'vanta',   distance: 20, dangerRating: 0.30, label: 'Aurelia → Vanta' },
  ];
}

function _bqIsPlanetNode(nodeKey) {
  if (!nodeKey || typeof City === 'undefined' || typeof City.getSpacePlanets !== 'function') return false;
  return City.getSpacePlanets().some((planet) => planet.key === nodeKey);
}

// ── SpaceTravelSystem ───────────────────────────────────
class SpaceTravelSystem {
  constructor() {
    this.phase = SpaceTravelPhase.GROUNDED;
    this.activeShip = null;        // SpaceShip instance
    this.launchCity = null;        // City reference
    this.currentNode = null;       // 'orbit', 'luna', 'aurelia', 'vanta', etc.
    this.targetNode = null;        // en_route destination
    this.routeProgress = 0;        // 0..1 travel progress
    this.routeDistance = 0;        // total distance of current route
    this.encounterSeed = null;     // seed for route encounters
    this._lastTickMs = 0;
  }

  // ── Phase Transitions ─────────────────────────────────

  /** Begin launch sequence from a city. Validates everything. */
  beginLaunch(city, ship, playerRef) {
    if (!city || !ship) return { ok: false, reason: 'missing_args' };
    if (this.phase !== SpaceTravelPhase.GROUNDED) return { ok: false, reason: 'not_grounded' };

    const prog = city.progression;
    if (!prog?.spaceAccess?.launchReady && !prog?.spaceportBuilt && !city.hasSpaceport) {
      return { ok: false, reason: 'no_spaceport' };
    }
    if (ship.fuel <= 0) return { ok: false, reason: 'no_fuel' };
    if (ship.condition <= 0) return { ok: false, reason: 'ship_destroyed' };

    this.activeShip = ship;
    this.launchCity = city;
    this.phase = SpaceTravelPhase.LAUNCH_PREP;
    this.currentNode = null;
    this.targetNode = null;
    this.routeProgress = 0;
    return { ok: true };
  }

  /** Complete launch prep (after QTE or confirmation). Transition to ascending. */
  confirmLaunch() {
    if (this.phase !== SpaceTravelPhase.LAUNCH_PREP) return { ok: false, reason: 'wrong_phase' };
    if (!this.activeShip) return { ok: false, reason: 'no_ship' };

    // Consume launch fuel
    const launchFuel = this.activeShip.getFuelCost(5); // base 5 distance for launch
    if (this.activeShip.fuel < launchFuel) return { ok: false, reason: 'insufficient_fuel' };
    this.activeShip.consumeFuel(launchFuel);

    this.phase = SpaceTravelPhase.ASCENDING;
    return { ok: true, fuelUsed: launchFuel };
  }

  /** Ascent complete (after QTE). Enter orbit. */
  completeAscent(success = true) {
    if (this.phase !== SpaceTravelPhase.ASCENDING) return { ok: false, reason: 'wrong_phase' };
    if (!success) {
      // Failed ascent — damage ship, return to ground
      this.activeShip.applyDamage(15);
      this.phase = SpaceTravelPhase.GROUNDED;
      return { ok: false, reason: 'ascent_failed', damage: 15 };
    }
    this.phase = SpaceTravelPhase.IN_ORBIT;
    this.currentNode = 'orbit';
    return { ok: true };
  }

  /** Get available routes from current node */
  getAvailableRoutes() {
    if (!this.currentNode) return [];
    const routes = _bqOrbitalRoutes();
    return routes.filter(r => r.from === this.currentNode || r.to === this.currentNode)
      .map(r => ({
        ...r,
        destination: r.from === this.currentNode ? r.to : r.from,
        fuelCost: this.activeShip ? this.activeShip.getFuelCost(r.distance) : r.distance,
        canAfford: this.activeShip ? this.activeShip.fuel >= this.activeShip.getFuelCost(r.distance) : false,
      }));
  }

  /** Start travelling along a route */
  beginRoute(destinationNode) {
    if (this.phase !== SpaceTravelPhase.IN_ORBIT) {
      return { ok: false, reason: 'wrong_phase' };
    }
    const fromNode = this.currentNode;
    const routes = _bqOrbitalRoutes();
    const route = routes.find(r =>
      (r.from === fromNode && r.to === destinationNode) ||
      (r.to === fromNode && r.from === destinationNode)
    );
    if (!route) return { ok: false, reason: 'no_route' };

    const fuelCost = this.activeShip.getFuelCost(route.distance);
    if (this.activeShip.fuel < fuelCost) return { ok: false, reason: 'insufficient_fuel' };

    this.activeShip.consumeFuel(fuelCost);
    this.targetNode = destinationNode;
    this.routeDistance = route.distance;
    this.routeProgress = 0;
    this.encounterSeed = Math.floor(Math.random() * 100000);
    this.phase = SpaceTravelPhase.EN_ROUTE;
    return { ok: true, fuelUsed: fuelCost, distance: route.distance, dangerRating: route.dangerRating };
  }

  /** Tick travel progress. Call each frame or game tick. Returns events. */
  tickTravel(deltaMs) {
    if (this.phase !== SpaceTravelPhase.EN_ROUTE || !this.activeShip) return null;
    const speed = this.activeShip.getEffectiveSpeed();
    const progressPerMs = 1 / (this.routeDistance * speed);
    this.routeProgress = Math.min(1.0, this.routeProgress + deltaMs * progressPerMs);

    if (this.routeProgress >= 1.0) {
      this.currentNode = this.targetNode;
      this.targetNode = null;
      this.phase = SpaceTravelPhase.DOCKING;
      return { event: 'arrived', node: this.currentNode };
    }
    return { event: 'travelling', progress: this.routeProgress };
  }

  /** Complete docking (after QTE). Transition to landed or in_orbit. */
  completeDocking(success = true, damage = null) {
    if (this.phase !== SpaceTravelPhase.DOCKING) return { ok: false, reason: 'wrong_phase' };
    if (!success) {
      const appliedDamage = Math.max(0, Number.isFinite(Number(damage)) ? Number(damage) : 10);
      this.activeShip.applyDamage(appliedDamage);
      // Bounce back to orbit
      this.phase = SpaceTravelPhase.IN_ORBIT;
      return { ok: false, reason: 'docking_failed', damage: appliedDamage, landed: false };
    }
    // Determine if this is a planet (-> landed) or station (-> in_orbit)
    const isPlanet = _bqIsPlanetNode(this.currentNode);
    this.phase = isPlanet ? SpaceTravelPhase.LANDED : SpaceTravelPhase.IN_ORBIT;
    return { ok: true, landed: isPlanet, node: this.currentNode };
  }

  /** Begin return to ground from orbit */
  beginReentry() {
    if (this.phase !== SpaceTravelPhase.IN_ORBIT) return { ok: false, reason: 'wrong_phase' };
    if (this.currentNode !== 'orbit') return { ok: false, reason: 'not_home_orbit' };
    const reentryFuel = this.activeShip.getFuelCost(3);
    if (this.activeShip.fuel < reentryFuel) return { ok: false, reason: 'insufficient_fuel' };
    this.activeShip.consumeFuel(reentryFuel);
    this.phase = SpaceTravelPhase.REENTRY;
    return { ok: true, fuelUsed: reentryFuel };
  }

  /** Complete re-entry (after QTE). Return to grounded. */
  completeReentry(success = true, damage = null) {
    if (this.phase !== SpaceTravelPhase.REENTRY) return { ok: false, reason: 'wrong_phase' };
    const appliedDamage = Math.max(0, Number.isFinite(Number(damage)) ? Number(damage) : (success ? 0 : 20));
    if (appliedDamage > 0) {
      this.activeShip.applyDamage(appliedDamage);
    }
    this.phase = SpaceTravelPhase.GROUNDED;
    this.currentNode = null;
    this.targetNode = null;
    this.routeProgress = 0;
    return { ok: true, damage: appliedDamage };
  }

  /** Leave a planet surface back to local orbit */
  liftOff() {
    if (this.phase !== SpaceTravelPhase.LANDED) return { ok: false, reason: 'not_landed' };
    const fuelCost = this.activeShip.getFuelCost(2);
    if (this.activeShip.fuel < fuelCost) return { ok: false, reason: 'insufficient_fuel' };
    this.activeShip.consumeFuel(fuelCost);
    this.phase = SpaceTravelPhase.IN_ORBIT;
    return { ok: true, fuelUsed: fuelCost };
  }

  /** Abort mission and return to ground (emergency). Takes damage. */
  emergencyReturn() {
    if (this.phase === SpaceTravelPhase.GROUNDED) return { ok: false, reason: 'already_grounded' };
    this.activeShip.applyDamage(25);
    this.phase = SpaceTravelPhase.GROUNDED;
    this.currentNode = null;
    this.targetNode = null;
    this.routeProgress = 0;
    return { ok: true, damage: 25 };
  }

  // ── State Query ───────────────────────────────────────

  getState() {
    return {
      phase: this.phase,
      currentNode: this.currentNode,
      targetNode: this.targetNode,
      routeProgress: this.routeProgress,
      routeDistance: this.routeDistance,
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
      availableRoutes: (this.phase === SpaceTravelPhase.IN_ORBIT)
        ? this.getAvailableRoutes() : [],
    };
  }

  // ── Persistence ───────────────────────────────────────

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
    if (data.activeShip) {
      sys.activeShip = SpaceShip.fromJSON(data.activeShip);
    }
    if (data.launchCityName && cityLookup && typeof cityLookup === 'function') {
      sys.launchCity = cityLookup(data.launchCityName);
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
