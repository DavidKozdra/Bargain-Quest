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
    // Books use fixed pricing based on gold target
    if (this.goalPercent) {
      return Math.floor(this.goalPercent * (window._newGameGoldTarget || 5000));
    }

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
            sprite: "clay.png",
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
            sprite: "Salt.png",
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
            sprite: "saltedFish.png",
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
            sprite: "Jewlery.png",
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

        // === BOOKS ===
        MarketAnalysis: Object.assign(new Item({
            name: "Market Analysis",
            sprite: "book_market.png",
            baseValue: 750,
            category: "Book",
            weight: 1,
            rarity: 1.0,
            tradable: false,
            tags: new Set(["book"])
        }), {
            goalPercent: 0.15,
            bookId: "MarketAnalysis",
            bookDescription: "Detailed market data, price graphs, and trends for every trade good across all visited cities.",
            holidayNames: ["Scholar's Fair", "Merchant's Census", "Ledger Day"]
        }),

        HolidaysBook: Object.assign(new Item({
            name: "Holidays Almanac",
            sprite: "book_holidays.png",
            baseValue: 1000,
            category: "Book",
            weight: 1,
            rarity: 1.0,
            tradable: false,
            tags: new Set(["book"])
        }), {
            goalPercent: 0.20,
            bookId: "HolidaysBook",
            bookDescription: "A comprehensive guide to holidays across all cities. Shows upcoming festivals and the items they boost.",
            holidayNames: ["Festival of Joy", "Celebration Day", "Carnival of Cultures"]
        }),

        NegotiationForDummies: Object.assign(new Item({
            name: "Negotiation for Dummies",
            sprite: "book_negotiation.png",
            baseValue: 2500,
            category: "Book",
            weight: 1,
            rarity: 1.0,
            tradable: false,
            tags: new Set(["book"])
        }), {
            goalPercent: 0.50,
            bookId: "NegotiationForDummies",
            bookDescription: "Learn the art of the deal! While carried, buy prices are 5% lower and sell prices are 5% higher.",
            holidayNames: ["Trader's Summit", "Merchant Guild Day", "Bazaar Week"]
        }),

        ConflictResolution: Object.assign(new Item({
            name: "Conflict Resolution",
            sprite: "book_conflict.png",
            baseValue: 500,
            category: "Book",
            weight: 1,
            rarity: 1.0,
            tradable: false,
            tags: new Set(["book"])
        }), {
            goalPercent: 0.10,
            bookId: "ConflictResolution",
            bookDescription: "Diplomatic strategies for dealing with raiders. Lowers bribe costs by 15% and extends post-bribe cooldowns by 2 days.",
            holidayNames: ["Day of Peace", "Christian Love Day", "Harmony Festival", "Truce of the Saints"]
        }),

        // === TREASURE HUNTER BOOK ===
        TreasureHunter: Object.assign(new Item({
            name: "Treasure Hunter's Guide",
            sprite: "book_treasure.png",
            baseValue: 500,
            category: "Book",
            weight: 1,
            rarity: 1.0,
            tradable: false,
            tags: new Set(["book"])
        }), {
            goalPercent: 0.10,
            bookId: "TreasureHunter",
            bookDescription: "Ancient maps and cipher keys. +10% treasure value from dig sites.",
            holidayNames: ["Explorer's Day", "Discovery Festival"]
        }),

        SeaLegs: Object.assign(new Item({
            name: "Sea Legs",
            sprite: "book_sealegs.png",
            baseValue: 3000,
            category: "Book",
            weight: 1,
            rarity: 1.0,
            tradable: false,
            tags: new Set(["book"])
        }), {
            goalPercent: 0.60,
            bookId: "SeaLegs",
            bookDescription: "A sailor's guide to seamless shore landings. While carried, you can disembark onto any coastline — no port required.",
            holidayNames: ["Sailor's Rest", "Tide Festival", "Harbor Day"]
        }),

        ExoticSpices: new Item({
            name: "Exotic Spices",
            sprite: "exotic_spices.png",
            baseValue: 90,
            category: "Contraband",
            weight: 1,
            rarity: 2.5,
            tradable: false,
            tags: new Set(["contraband", "illegal"])
        }),
        ForbiddenTexts: new Item({
            name: "Forbidden Texts",
            sprite: "forbidden_texts.png",
            baseValue: 120,
            category: "Contraband",
            weight: 2,
            rarity: 3.0,
            tradable: false,
            tags: new Set(["contraband", "illegal"])
        }),
        SmuggledGems: new Item({
            name: "Smuggled Gems",
            sprite: "smuggled_gems.png",
            baseValue: 200,
            category: "Contraband",
            weight: 1,
            rarity: 4.0,
            tradable: false,
            tags: new Set(["contraband", "illegal"])
        }),
        /*
        // === TREASURE ITEMS ===
        AncientCoin: new Item({
            name: "Ancient Coin",
            sprite: "ancient_coin.png",
            baseValue: 100,
            category: "Treasure",
            weight: 1,
            rarity: 3.0,
            tags: new Set(["treasure"])
        }),
        GoldenIdol: new Item({
            name: "Golden Idol",
            sprite: "golden_idol.png",
            baseValue: 250,
            category: "Treasure",
            weight: 3,
            rarity: 5.0,
            tags: new Set(["treasure"])
        }),
        EnchantedRing: new Item({
            name: "Enchanted Ring",
            sprite: "enchanted_ring.png",
            baseValue: 180,
            category: "Treasure",
            weight: 1,
            rarity: 4.0,
            tags: new Set(["treasure"])
        }),

        // === TROPHY ITEMS (tournament / special rewards) ===
        ChampionsMedal: new Item({
            name: "Champion's Medal",
            sprite: "champions_medal.png",
            baseValue: 150,
            category: "Trophy",
            weight: 1,
            rarity: 5.0,
            tags: new Set(["trophy"])
        }),

        // === CURSED ITEMS (drain gold daily until sold) ===
        CursedAmulet: new Item({
            name: "Cursed Amulet",
            sprite: "cursed_amulet.png",
            baseValue: 5,
            category: "Cursed",
            weight: 1,
            rarity: 1.0,
            tags: new Set(["cursed"])
        }),
        */

        // === WEAPONS (keys MUST match Combat.js WEAPONS constant) ===
        Dagger: new Item({
            name: "Dagger",
            sprite: "dagger.png",
            baseValue: 25,
            category: "Weapon",
            weight: 1,
            rarity: 1.0,
            tags: new Set(["weapon", "crafted"])
        }),
        Sword: new Item({
            name: "Sword",
            sprite: "sword.png",
            baseValue: 60,
            category: "Weapon",
            weight: 3,
            rarity: 1.5,
            tags: new Set(["weapon", "crafted"])
        }),
        Axe: new Item({
            name: "Axe",
            sprite: "axe.png",
            baseValue: 80,
            category: "Weapon",
            weight: 5,
            rarity: 2.0,
            tags: new Set(["weapon", "crafted"])
        }),
        Bow: new Item({
            name: "Bow",
            sprite: "bow.png",
            baseValue: 55,
            category: "Weapon",
            weight: 2,
            rarity: 1.5,
            tags: new Set(["weapon", "crafted"])
        }),
        Crossbow: new Item({
            name: "Crossbow",
            sprite: "crossbow.png",
            baseValue: 120,
            category: "Weapon",
            weight: 4,
            rarity: 2.5,
            tags: new Set(["weapon", "crafted"])
        }),
        Staff: new Item({
            name: "Staff",
            sprite: "staff.png",
            baseValue: 70,
            category: "Weapon",
            weight: 3,
            rarity: 2.0,
            tags: new Set(["weapon", "crafted"])
        }),

        // ── Bags ──
        Pouch: new Item({
            name: "Pouch",
            baseValue: 40,
            category: "Bag",
            weight: 1,
            rarity: 1.0,
            tradable: true,
            tags: new Set(["bag", "equipment"])
        }),
        TravelerBag: new Item({
            name: "Traveler Bag",
            baseValue: 200,
            category: "Bag",
            weight: 2,
            rarity: 1.5,
            tradable: true,
            tags: new Set(["bag", "equipment"])
        }),
        BargainSack: new Item({
            name: "Bargain Sack",
            baseValue: 800,
            category: "Bag",
            weight: 3,
            rarity: 2.5,
            tradable: true,
            tags: new Set(["bag", "equipment"])
        }),
        Chest: new Item({
            name: "Chest",
            baseValue: 2500,
            category: "Bag",
            weight: 5,
            rarity: 4.0,
            tradable: true,
            tags: new Set(["bag", "equipment"])
        }),
    };

// ===================== BAG EQUIPMENT REGISTRY =====================
// Parallel to WEAPONS in Combat.js — equippable bags that expand cargo.
const BAGS = {
  'Pouch':       { cargoBonus: 5,  rarity: 'common'   },
  'TravelerBag': { cargoBonus: 10, rarity: 'uncommon' },
  'BargainSack': { cargoBonus: 20, rarity: 'rare'     },
  'Chest':       { cargoBonus: 30, rarity: 'epic'     },
};

// ===================== ITEM ICON REGISTRY =====================
// Maps item names to either a PNG path or an emoji fallback.
// Only items with actual image assets use type:'img'.

// All entries are emoji-only fallbacks. AtlasManager is always checked first in createItemIconEl().
// When items_atlas.png is present, atlas frames take priority over these.
const ITEM_ICONS = {
  Iron:       { type: 'emoji', emoji: '⛏️' },
  Wheat:      { type: 'emoji', emoji: '🌾' },
  Fish:       { type: 'emoji', emoji: '🐟' },
  Clay:       { type: 'emoji', emoji: '🪣' },
  Wood:       { type: 'emoji', emoji: '🪵' },
  Stone:      { type: 'emoji', emoji: '🪨' },
  Salt:       { type: 'emoji', emoji: '🧂' },
  Herbs:      { type: 'emoji', emoji: '🌿' },
  Fur:        { type: 'emoji', emoji: '🦊' },
  Bread:      { type: 'emoji', emoji: '🍞' },
  Tools:      { type: 'emoji', emoji: '🔧' },
  Pottery:    { type: 'emoji', emoji: '🏺' },
  SaltedFish: { type: 'emoji', emoji: '🐠' },
  Jewelry:    { type: 'emoji', emoji: '💎' },
  Spices:     { type: 'emoji', emoji: '🌶️' },
  Wine:       { type: 'emoji', emoji: '🍷' },
  Silk:       { type: 'emoji', emoji: '🧵' },
  // Books
  MarketAnalysis:        { type: 'emoji', emoji: '📊' },
  HolidaysBook:          { type: 'emoji', emoji: '🎉' },
  NegotiationForDummies: { type: 'emoji', emoji: '🤝' },
  ConflictResolution:    { type: 'emoji', emoji: '🕊️' },
  TreasureHunter:        { type: 'emoji', emoji: '🗺️' },
  // Contraband
  StolenGoods:           { type: 'emoji', emoji: '🎭' },
  ExoticSpices:          { type: 'emoji', emoji: '🌺' },
  ForbiddenTexts:        { type: 'emoji', emoji: '📕' },
  SmuggledGems:          { type: 'emoji', emoji: '💎' },
  // Treasure
  AncientCoin:           { type: 'emoji', emoji: '🪙' },
  GoldenIdol:            { type: 'emoji', emoji: '🗿' },
  EnchantedRing:         { type: 'emoji', emoji: '💍' },
  // Trophy / Cursed
  ChampionsMedal:        { type: 'emoji', emoji: '🏅' },
  CursedAmulet:          { type: 'emoji', emoji: '🧿' },
  // Weapons
  Dagger:                { type: 'emoji', emoji: '🗡️' },
  Sword:                 { type: 'emoji', emoji: '⚔️' },
  Axe:                   { type: 'emoji', emoji: '🪓' },
  Bow:                   { type: 'emoji', emoji: '🏹' },
  Crossbow:              { type: 'emoji', emoji: '🎯' },
  Staff:                 { type: 'emoji', emoji: '🪄' },
  // Bags
  Pouch:                 { type: 'emoji', emoji: '👝' },
  TravelerBag:           { type: 'emoji', emoji: '🎒' },
  BargainSack:           { type: 'emoji', emoji: '💼' },
  Chest:                 { type: 'emoji', emoji: '🧳' },
};

/**
 * Create a DOM element for an item icon (img or emoji span).
 * @param {string} itemName — key in ItemLibrary / ITEM_ICONS
 * @param {number} size — pixel size (width & height)
 * @returns {HTMLElement}
 */
function createItemIconEl(itemName, size) {
  // 1. Try the atlas first (works once atlases are registered)
  if (typeof AtlasManager !== 'undefined' && AtlasManager.has(itemName)) {
    const canvas = AtlasManager.createDOMCanvas(itemName, size);
    if (canvas) return canvas;
  }

  const icon = ITEM_ICONS[itemName] || null;
  const libItem = (typeof ItemLibrary !== 'undefined') ? ItemLibrary[itemName] : null;

  // Determine image source: prefer ITEM_ICONS registry, fall back to ItemLibrary.sprite
  // Emoji fallback — atlas lookup above is the primary path
  const span = document.createElement('span');
  span.textContent = (icon && icon.emoji) || '📦';
  span.style.fontSize = size + 'px';
  span.style.lineHeight = '1';
  span.style.verticalAlign = 'middle';
  span.className = 'item-icon item-icon-emoji';
  return span;
}
