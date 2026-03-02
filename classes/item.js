class Item {
  constructor({
    name,
    sprite,
    baseValue,
    category,
    weight,
    perishable = false,
    rarity = 1.0,
    seasonality = [],
    tradable = true,
    tags = new Set()
  }) {
    this.name = name;                 // Name of the item (e.g. "Iron", "Wheat", "Holy Book")
    this.sprite = sprite;            // URL or key for item sprite in the asset manager
    this.baseValue = baseValue;      // Base value before modifiers (demand, distance, etc.)
    this.category = category;        // e.g. "Food", "Weapon", "Tool", "Luxury"
    this.weight = weight;            // Affects transport cost
    this.perishable = perishable;    // Does it rot or expire?
    this.rarity = rarity;            // A multiplier for how rare (0.0 - 10.0)
    this.seasonality = seasonality;  // Seasons where demand/value increases: ["Winter", "Spring"]
    this.tradable = tradable;        // Can this item be bought/sold?
    this.tags = tags;                // Custom tags: Set of strings like "holiday", "sacred", "war"
  }

  getValue(modifiers = {}) {
    const {
      season = null,
      demandFactor = 1.0,
      supplyFactor = 1.0,
      distanceFactor = 1.0,
      holidayDemandBoost = 1.0
    } = modifiers;

    let value = this.baseValue;

    if (season && this.seasonality.includes(season)) {
      value *= 1.25; // seasonal bonus
    }

    value *= this.rarity;
    value *= demandFactor;
    value /= supplyFactor;
    value *= distanceFactor;
    value *= holidayDemandBoost;

    return Math.max(1, Math.round(value)); // minimum value = 1
  }

  toJSON() {
    return {
      name: this.name,
      sprite: this.sprite,
      baseValue: this.baseValue,
      category: this.category,
      weight: this.weight,
      perishable: this.perishable,
      rarity: this.rarity,
      seasonality: this.seasonality,
      tradable: this.tradable,
      tags: [...this.tags]
    };
  }
}



    const ItemLibrary = {
        // === RAW RESOURCES ===
        Iron: new Item({
            name: "Iron",
            sprite: "iron.png",
            baseValue: 25,
            category: "Ore",
            weight: 5,
            rarity: 1.0,
            tags: new Set(["rock"])
        }),
        Wheat: new Item({
            name: "Wheat",
            sprite: "wheat.png",
            baseValue: 10,
            category: "Food",
            weight: 1,
            perishable: true,
            rarity: 1.0,
            seasonality: ["Spring", "Summer"],
            tags: new Set(["grass"])
        }),
        Fish: new Item({
            name: "Fish",
            sprite: "fish.png",
            baseValue: 12,
            category: "Food",
            weight: 2,
            perishable: true,
            rarity: 1.2,
            seasonality: ["Spring", "Fall"],
            tags: new Set(["water"])
        }),
        Clay: new Item({
            name: "Clay",
            sprite: "Clay.png",
            baseValue: 15,
            category: "Ore",
            weight: 4,
            rarity: 1.0,
            tags: new Set(["sand"])
        }),
        Wood: new Item({
            name: "Wood",
            sprite: "wood.png",
            baseValue: 8,
            category: "Material",
            weight: 3,
            rarity: 0.8,
            tags: new Set(["forest"])
        }),
        Stone: new Item({
            name: "Stone",
            sprite: "stone.png",
            baseValue: 6,
            category: "Ore",
            weight: 6,
            rarity: 0.7,
            tags: new Set(["rock"])
        }),
        Salt: new Item({
            name: "Salt",
            sprite: "salt.png",
            baseValue: 18,
            category: "Spice",
            weight: 1,
            rarity: 1.5,
            tags: new Set(["rock", "water"])
        }),
        Herbs: new Item({
            name: "Herbs",
            sprite: "herbs.png",
            baseValue: 14,
            category: "Medicine",
            weight: 1,
            perishable: true,
            rarity: 1.3,
            seasonality: ["Spring", "Summer"],
            tags: new Set(["grass", "forest"])
        }),
        Fur: new Item({
            name: "Fur",
            sprite: "fur.png",
            baseValue: 22,
            category: "Material",
            weight: 2,
            rarity: 1.4,
            seasonality: ["Winter", "Fall"],
            tags: new Set(["forest", "snow"])
        }),

        // === CRAFTED / PROCESSED GOODS ===
        Bread: new Item({
            name: "Bread",
            sprite: "bread.png",
            baseValue: 16,
            category: "Food",
            weight: 1,
            perishable: true,
            rarity: 1.1,
            tags: new Set(["crafted"])
        }),
        Tools: new Item({
            name: "Tools",
            sprite: "tools.png",
            baseValue: 40,
            category: "Equipment",
            weight: 4,
            rarity: 1.5,
            tags: new Set(["crafted", "rock"])
        }),
        Pottery: new Item({
            name: "Pottery",
            sprite: "pottery.png",
            baseValue: 30,
            category: "Goods",
            weight: 3,
            rarity: 1.3,
            tags: new Set(["crafted", "sand"])
        }),
        SaltedFish: new Item({
            name: "Salted Fish",
            sprite: "saltedfish.png",
            baseValue: 28,
            category: "Food",
            weight: 2,
            perishable: false,
            rarity: 1.4,
            tags: new Set(["crafted", "water"])
        }),

        // === LUXURY / HIGH-VALUE ===
        Jewelry: new Item({
            name: "Jewelry",
            sprite: "jewelry.png",
            baseValue: 80,
            category: "Luxury",
            weight: 1,
            rarity: 3.0,
            tags: new Set(["crafted", "rock"])
        }),
        Spices: new Item({
            name: "Spices",
            sprite: "spices.png",
            baseValue: 50,
            category: "Luxury",
            weight: 1,
            rarity: 2.5,
            seasonality: ["Summer", "Fall"],
            tags: new Set(["grass"])
        }),
        Wine: new Item({
            name: "Wine",
            sprite: "wine.png",
            baseValue: 45,
            category: "Luxury",
            weight: 3,
            perishable: false,
            rarity: 2.0,
            seasonality: ["Fall"],
            tags: new Set(["grass", "crafted"])
        }),
        Silk: new Item({
            name: "Silk",
            sprite: "silk.png",
            baseValue: 65,
            category: "Luxury",
            weight: 1,
            rarity: 2.8,
            tags: new Set(["crafted"])
        }),
    };

// ===================== ITEM ICON REGISTRY =====================
// Maps item names to either a PNG path or an emoji fallback.
// Only items with actual image assets use type:'img'.

const ITEM_ICONS = {
  Iron:       { type: 'img',   src: 'assets/images/iron.png' },
  Wheat:      { type: 'img',   src: 'assets/images/wheat.png' },
  Fish:       { type: 'img',   src: 'assets/images/fish.png' },
  Clay:       { type: 'img',   src: 'assets/images/clay.png' },
  Wood:       { type: 'emoji', char: '🪵' },
  Stone:      { type: 'emoji', char: '🪨' },
  Salt:       { type: 'emoji', char: '🧂' },
  Herbs:      { type: 'emoji', char: '🌿' },
  Fur:        { type: 'emoji', char: '🦊' },
  Bread:      { type: 'emoji', char: '🍞' },
  Tools:      { type: 'emoji', char: '🔧' },
  Pottery:    { type: 'emoji', char: '🏺' },
  SaltedFish: { type: 'emoji', char: '🐟' },
  Jewelry:    { type: 'emoji', char: '💎' },
  Spices:     { type: 'emoji', char: '🌶️' },
  Wine:       { type: 'emoji', char: '🍷' },
  Silk:       { type: 'emoji', char: '🧵' },
};

/**
 * Create a DOM element for an item icon (img or emoji span).
 * @param {string} itemName — key in ItemLibrary / ITEM_ICONS
 * @param {number} size — pixel size (width & height)
 * @returns {HTMLElement}
 */
function createItemIconEl(itemName, size) {
  const icon = ITEM_ICONS[itemName];
  if (icon && icon.type === 'img') {
    const img = document.createElement('img');
    img.src = icon.src;
    img.alt = itemName;
    img.width = size;
    img.height = size;
    img.style.objectFit = 'contain';
    img.style.verticalAlign = 'middle';
    img.className = 'item-icon item-icon-img';
    return img;
  }
  const span = document.createElement('span');
  span.textContent = (icon && icon.char) || '📦';
  span.style.fontSize = size + 'px';
  span.style.lineHeight = '1';
  span.style.verticalAlign = 'middle';
  span.className = 'item-icon item-icon-emoji';
  return span;
}
