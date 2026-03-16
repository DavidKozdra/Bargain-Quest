// assets/atlas/items_atlas.js
// Atlas descriptor for assets/atlas/atlas.png
//
// Sprite size: 24 × 24 px, packed in a 12 × 5 grid.
// This sheet mixes item, actor, status, and utility icons.
// Only confidently-mapped frames are registered here so missing entries
// still fall back to the existing emoji/text paths rather than showing
// the wrong sprite.

const ITEMS_ATLAS_DATA = {
  meta: {
    image: 'assets/atlas/atlas.png',
    frameWidth: 24,
    frameHeight: 24,
  },
  frames: {
    // Row 0: actors and core trade goods
    trader: { x: 0, y: 0 },
    player: { x: 24, y: 0 },
    raider: { x: 72, y: 0 },
    Jewelry: { x: 96, y: 0 },
    Fur: { x: 120, y: 0 },
    Bread: { x: 144, y: 0 },
    Spices: { x: 240, y: 48 },
    Herbs: { x: 264, y: 48 },
    Wheat: { x: 192, y: 48 },
    Salt: { x: 216, y: 48 },
    Wine: { x: 240, y: 24 },
    Clay: { x: 120, y: 24},
    Wood: { x: 264, y: 0 },
    Silk: { x: 0, y: 48},


    // Row 1: books, bags, materials
    Book: { x: 24, y: 24 },
    Bag: { x: 24, y: 24 },
    Tools: { x: 24, y: 48 },
    Pottery: { x: 144, y: 24 },
    Iron: { x: 72, y: 24 },
    Stone: { x: 48, y: 24 },
    Fish: { x: 170, y: 24 },
    Barrel: { x: 216, y: 24 },
    SmuggledGems: { x: 240, y: 0 },

    // Row 2: utility icons reused for books/perks/treasures
    Chart: { x: 24, y: 72 },
    Globe: { x: 216, y: 48 },
    Shield: { x: 240, y: 48 },
    Wheel: { x: 264, y: 48 },

    // Row 3: combat/status utility
    Potion: { x: 120, y: 72 },
    Eye: { x: 144, y: 72 },
    Sack: { x: 168, y: 72 },
    Cash: { x: 216, y: 72 },
    Fire: { x: 240, y: 72 },
    Skull: { x: 264, y: 72 },

    // Row 4: larger storage prop
    Crate: { x: 0, y: 96 },

    // Direct item key aliases used by the game
    ForbiddenTexts: { x: 24, y: 24 },
    MarketAnalysis: { x: 24, y: 24 },
    HolidaysBook: { x: 24, y: 24 },
    NegotiationForDummies: { x: 24, y: 24 },
    ConflictResolution: { x: 24, y: 24 },
    TreasureHunter: { x: 24, y: 24 },
    SeaLegs: { x: 24, y: 24 },
    Pirating101: { x: 24, y: 24 },
    StolenGoods: { x: 168, y: 72 },
    ExoticSpices: { x: 168, y: 48 },
    AncientCoin: { x: 216, y: 72 },
    EnchantedRing: { x: 72, y: 0 },
    ChampionsMedal: { x: 240, y: 48 },
    CursedAmulet: { x: 240, y: 24 },
    SaltedFish:  { x: 216, y: 24 },

    //bags
    Pouch: { x: 72, y: 96 },
    TravelerBag: { x: 96, y: 96 },
    BargainSack: { x: 120, y: 96 },
    Chest: { x: 48, y: 120 },

    // seasons
    Winter : { x: 72, y: 120 },
    Spring : { x: 96, y: 120 },
    Fall : { x: 120, y: 120 },
    Autumn : { x: 120, y: 120 },
    Summer : { x: 144, y: 120 },

    //general town ones
    chart : { x: 24, y: 72 },
    Festival : { x: 48, y: 72 },
    festival : { x: 48, y: 72 },
    Bank : { x: 72, y: 72 },
    bank : { x: 72, y: 72 },
    Clock : { x: 48, y: 96 },
    clock : { x: 48, y: 96 },

    //reputation/status icons
    Love : { x: 192, y: 72 },
    Friendly: { x: 168, y: 72 },
    Neutral: { x: 144, y: 72 },
    Hostile: { x: 120, y: 72 },
    Hate : { x: 96, y: 72 },

    // Weapon/item frames used by inventory, shops, and combat UI.
    Dagger: { x: 120, y: 48 },
    Sword: { x: 96, y: 48 },
    Bow: { x: 48, y: 48 },
    Crossbow: { x: 48, y: 48 },
    CrossBow: { x: 48, y: 48 },
    Axe: { x: 72, y: 48 },

    //difficulty/status icons
    Easy: { x: 144, y:96  },
    Medium: { x: 168, y: 96 },
    Hard: { x: 192, y: 96 },
    Hardcore: { x: 216, y: 96 },
    

  },
};
