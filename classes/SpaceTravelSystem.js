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

const SPACE_SYSTEM_LAYOUT = Object.freeze({
  orbit:   { x: 0.22, y: 0.56, label: 'Sol Gate', accent: '#7dc9ff', description: 'Human core system with launch lanes, shipyards, and re-entry authority.' },
  luna:    { x: 0.55, y: 0.22, label: 'Luna Reach', accent: '#d6dfff', description: 'A fortified logistics system anchored by a neutral station cluster.' },
  aurelia: { x: 0.77, y: 0.60, label: 'Aurelia Bloom', accent: '#7ff0b4', description: 'A bright green trade system full of habitable worlds and rich flora exports.' },
  vanta:   { x: 0.46, y: 0.84, label: 'Vanta Rift', accent: '#ff9d7a', description: 'A dangerous dark system riddled with asteroid belts and outlaw traffic.' },
});

function _bqOrbitalRoutes() {
  return [
    { from: 'orbit', to: 'luna', distance: 10, dangerRating: 0.05, label: 'Sol Gate → Luna Reach' },
    { from: 'orbit', to: 'aurelia', distance: 22, dangerRating: 0.15, label: 'Sol Gate → Aurelia Bloom' },
    { from: 'orbit', to: 'vanta', distance: 38, dangerRating: 0.35, label: 'Sol Gate → Vanta Rift' },
    { from: 'luna', to: 'aurelia', distance: 18, dangerRating: 0.10, label: 'Luna Reach → Aurelia Bloom' },
    { from: 'luna', to: 'vanta', distance: 30, dangerRating: 0.25, label: 'Luna Reach → Vanta Rift' },
    { from: 'aurelia', to: 'vanta', distance: 20, dangerRating: 0.30, label: 'Aurelia Bloom → Vanta Rift' },
  ];
}

function _bqGetNodeMeta(nodeKey) {
  const fallback = SPACE_SYSTEM_LAYOUT[nodeKey];
  if (!fallback) return { key: nodeKey, label: nodeKey, accent: '#9fb5ce', description: 'Uncharted star system.' };
  return { key: nodeKey, ...fallback };
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
  const meta = _bqGetNodeMeta(nodeKey);
  const common = {
    nodeKey,
    width: 3200,
    height: 2200,
    starColor: meta.accent,
    starName: `${meta.label} Star`,
  };
  switch (nodeKey) {
    case 'luna':
      return {
        ...common,
        bodies: [
          { key: 'luna-station', name: 'Luna Station', kind: 'station', orbitRadius: 320, angle: 0.25, radius: 48, accent: '#dce6ff' },
          { key: 'grayhold', name: 'Grayhold', kind: 'planet', orbitRadius: 580, angle: 2.2, radius: 84, accent: '#aeb9d9' },
          { key: 'ice-veil', name: 'Ice Veil', kind: 'planet', orbitRadius: 860, angle: 5.35, radius: 62, accent: '#bce9ff' },
        ],
        asteroidBelts: [
          { key: 'haul-belt', radius: 1120, count: 30, accent: '#c0d1e8' },
        ],
      };
    case 'aurelia':
      return {
        ...common,
        bodies: [
          { key: 'aurelia-prime', name: 'Aurelia Prime', kind: 'planet', orbitRadius: 420, angle: 1.4, radius: 96, accent: '#8affbd' },
          { key: 'verdant-ring', name: 'Verdant Ring', kind: 'station', orbitRadius: 650, angle: 4.7, radius: 42, accent: '#f0ffd4' },
          { key: 'bloom-moon', name: 'Bloom Moon', kind: 'planet', orbitRadius: 930, angle: 5.8, radius: 58, accent: '#d1ffd3' },
        ],
        asteroidBelts: [
          { key: 'pollen-belt', radius: 1220, count: 26, accent: '#7ff0b4' },
        ],
      };
    case 'vanta':
      return {
        ...common,
        bodies: [
          { key: 'rift-anchor', name: 'Rift Anchor', kind: 'station', orbitRadius: 360, angle: 2.7, radius: 44, accent: '#ffe1d2' },
          { key: 'vanta-major', name: 'Vanta Major', kind: 'planet', orbitRadius: 700, angle: 5.1, radius: 90, accent: '#ff9d7a' },
          { key: 'ember-shard', name: 'Ember Shard', kind: 'planet', orbitRadius: 980, angle: 0.8, radius: 54, accent: '#ffc08c' },
        ],
        asteroidBelts: [
          { key: 'rift-belt', radius: 1180, count: 42, accent: '#ff8c6f' },
          { key: 'outer-belt', radius: 1460, count: 24, accent: '#b36f62' },
        ],
      };
    case 'orbit':
    default:
      return {
        ...common,
        bodies: [
          { key: 'homeworld', name: 'Earthrise', kind: 'planet', orbitRadius: 430, angle: 1.8, radius: 92, accent: '#7dc9ff' },
          { key: 'sol-station', name: 'Orbital Shipyard', kind: 'station', orbitRadius: 650, angle: 5.0, radius: 40, accent: '#ffe6a6' },
          { key: 'luna-dock', name: 'Luna Dock', kind: 'planet', orbitRadius: 880, angle: 0.5, radius: 58, accent: '#d9e2f2' },
        ],
        asteroidBelts: [
          { key: 'sol-belt', radius: 1280, count: 22, accent: '#c9d4df' },
        ],
      };
  }
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
    return { ok: true, body: nearest };
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
