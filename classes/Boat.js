// Boat.js — Boat fleet system with multiple vessel types

const BoatNames = [
  'The Salty Crab', 'Ocean Pearl', 'The Wandering Star', 'HMS Victory',
  'The Iron Will', 'Sea Dragon', 'The Crimson Tide', 'The Golden Gull',
  'The Storm Runner', 'The Lucky Mermaid', 'The Black Pearl', 'The Northern Light',
  'The Phoenix Rising', 'The Sea Witch', 'The Neptune\'s Grace', 'The White Wave',
  'The Rusty Anchor', 'The Storm Crow', 'The Azure Dream', 'The Last Voyage'
];

const BoatLibrary = {
  rowboat: {
    type: 'rowboat',
    displayName: 'Rowboat',
    cost: 200,
    speed: 180,        // ms per tile (higher = slower)
    cargoBonus: 10,
    crewSize: 1,
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
    description: 'A mighty multi-deck warship. Fastest with massive hold.',
    icon: '🚢',
  },
};

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
