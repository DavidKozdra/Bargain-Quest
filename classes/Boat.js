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
    this.condition = 100; // 0-100, for future durability feature
  }

  toJSON() {
    return {
      type: this.type,
      name: this.name,
      condition: this.condition,
    };
  }

  static fromJSON(data) {
    const boat = new Boat(data.type, data.name);
    boat.condition = data.condition ?? 100;
    return boat;
  }

  static randomName() {
    return BoatNames[Math.floor(Math.random() * BoatNames.length)];
  }
}
