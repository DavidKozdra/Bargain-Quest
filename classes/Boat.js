// Boat.js — Boat fleet system with multiple vessel types

const BoatNames = [
  'The Krusty Crab', 'Mother o Pearl', 'The Wandering Star', 'DJK Victory',
  'The Iron Lung', 'Sea Dragon', 'The Black Pearl', 
];

const BoatLibrary = {
  rowboat: {
    type: 'rowboat',
    displayName: 'Rowboat',
    cost: 200,
    speed: 180,        // ms per tile (higher = slower)
    cargoBonus: 10,
    crewSize: 1,
    hp: 3,             // naval combat hull points
    attack: 1,         // naval combat attack power
    gridSize: 1,       // cells occupied on 3×3 naval grid
    description: 'A humble wooden rowboat. Slow but affordable.',
    icon: '🚣',
  },
  sloop: {
    type: 'sloop',
    displayName: 'Sloop',
    cost: 600,
    speed: 120,
    cargoBonus: 25,
    crewSize: 2,
    hp: 5,
    attack: 2,
    gridSize: 2,
    description: 'A nimble single-mast sailing vessel. Good speed and cargo.',
    icon: '⛵',
  },
  galleon: {
    type: 'galleon',
    displayName: 'Galleon',
    cost: 1500,
    speed: 90,
    cargoBonus: 50,
    crewSize: 4,
    hp: 8,
    attack: 3,
    gridSize: 3,
    description: 'A mighty multi-deck warship. Fastest with massive hold.',
    icon: '🚢',
  },
};

/** Maps pirate raider strength ranges to boat types */
const PIRATE_BOATS = {
  rowboat: { minStr: 0, maxStr: 3 },
  sloop:   { minStr: 4, maxStr: 5 },
  galleon: { minStr: 6, maxStr: 99 },
};

function getPirateBoatType(strength) {
  if (strength >= 6) return 'galleon';
  if (strength >= 4) return 'sloop';
  return 'rowboat';
}

class Boat {
  constructor(type, name) {
    const template = BoatLibrary[type];
    if (!template) throw new Error(`Unknown boat type: ${type}`);

    this.type = type;
    this.name = name || Boat.randomName();
    this.displayName = template.displayName;
    this.speed = template.speed;
    this.cargoBonus = template.cargoBonus;
    this.crewSize = template.crewSize;
    this.condition = 100; // 0-100 durability
    // Per-boat item hold — Map<itemKey, {item, quantity}>
    this.storage = new Map();
  }

  // ─── Effective stats (degrade with condition) ───

  /** Speed degrades: at 0% condition → 1.5× slower (50% penalty). Never zero. */
  getEffectiveSpeed() {
    const factor = 0.5 + 0.5 * (this.condition / 100);
    return Math.round(this.speed / factor); // higher ms = slower, so divide
  }

  /** Cargo bonus degrades: at 0% condition → 50% of bonus */
  getEffectiveCargo() {
    return Math.ceil(this.cargoBonus * (0.5 + 0.5 * this.condition / 100));
  }

  /** Naval combat HP scales by condition. Min 1. */
  getEffectiveHP() {
    const baseHP = (BoatLibrary[this.type]?.hp || 3) * 2;
    return Math.max(1, Math.round(baseHP * this.condition / 100));
  }

  // ─── Condition manipulation ───

  applyDamage(amount) {
    this.condition = Math.max(0, Math.round(this.condition - amount));
  }

  repair(points) {
    this.condition = Math.min(100, Math.round(this.condition + points));
  }

  /** Cost to fully repair. Returns gold-only (premium) and gold+wood (discounted) options. */
  getRepairCost() {
    const missing = 100 - this.condition;
    if (missing <= 0) return { gold: 0, goldOnly: 0, wood: 0 };
    const baseCost = BoatLibrary[this.type]?.cost || 200;
    const baseGold = Math.max(1, Math.ceil(missing * baseCost * 0.003));
    const wood = Math.max(1, Math.ceil(missing / 20));
    return {
      gold: baseGold,              // gold cost when paying with wood
      goldOnly: Math.ceil(baseGold * 2.5), // gold cost without wood (2.5× premium)
      wood,                        // wood needed for discount
    };
  }

  // ─── Hold / Storage ───

  /** Hold capacity in weight units — equals cargoBonus by default */
  getStorageCapacity() { return this.cargoBonus; }

  /** Current weight stored in the hold */
  getStorageWeight() {
    let total = 0;
    for (const [, entry] of this.storage) {
      total += (entry.item?.weight || 1) * entry.quantity;
    }
    return total;
  }

  /** Remaining hold space in weight units */
  getAvailableStorageSpace() {
    return Math.max(0, this.getStorageCapacity() - this.getStorageWeight());
  }

  /**
   * Add qty units of itemKey to hold.
   * @param {string} itemKey — ItemLibrary key
   * @param {number} qty
   * @param {boolean} force — bypass capacity check
   * @returns {boolean} success
   */
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

  /**
   * Remove qty units of itemKey from hold.
   * @returns {boolean} success
   */
  removeItemFromStorage(itemKey, qty = 1) {
    const entry = this.storage.get(itemKey);
    if (!entry || entry.quantity < qty) return false;
    entry.quantity -= qty;
    if (entry.quantity <= 0) this.storage.delete(itemKey);
    return true;
  }

  isCritical() { return this.condition <= 20; }

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

  toJSON() {
    return {
      type: this.type,
      name: this.name,
      condition: this.condition,
      storage: [...this.storage].map(([k, v]) => [k, v.quantity]),
    };
  }

  static fromJSON(data) {
    const boat = new Boat(data.type, data.name);
    boat.condition = data.condition ?? 100;
    // Rehydrate hold — legacy saves without storage default to empty
    boat.storage = new Map(
      (data.storage || []).map(([k, qty]) => {
        const item = typeof ItemLibrary !== 'undefined' ? ItemLibrary[k] : null;
        return [k, { item, quantity: qty }];
      })
    );
    return boat;
  }

  static randomName() {
    return BoatNames[Math.floor(Math.random() * BoatNames.length)];
  }
}
