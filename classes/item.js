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
            baseValue: 25,
            category: "Ore",
            weight: 5,
            rarity: 1.0,
            tags: new Set(["sand"])
        }),
    };
