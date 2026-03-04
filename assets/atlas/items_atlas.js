// assets/atlas/items_atlas.js
// Atlas descriptor for assets/images/items_atlas.png
//
// Sprite size: 24 × 24 px, packed in rows of 11 columns.
// Adjust the (x, y) values below if your sheet's layout differs.
//
// Layout reference (each cell = one 24×24 sprite):
//
//   Row 0 (y=  0): Merchant | Player  | Jewelry | Fur     | Bread   | Spices  | Herbs   | Wine    | Wood    | Clay    | Silk
//   Row 1 (y= 24): Raider   | Tools   | Axe     | Iron    | Stone   | Fish    | Stolen  | Cash    | Pottery | Barrel  | SmuggledGems
//   Row 2 (y= 48): AxeWpn   | Bow     | Dagger  | Sword   | Crossbow| Staff   | Wheat   | Salt    | SaltedFish| ExoticSpices| ForbiddenTexts
//   Row 3 (y= 72): (spare / future use)

const ITEMS_ATLAS_DATA = {
  meta: {
    image:       'assets/images/items_atlas.png',
    frameWidth:  24,
    frameHeight: 24,
  },
  frames: {
    // ── Characters (row 0) ──────────────────────────────────────────────
    trader:          { x:   0, y:  0 },  // Merchant NPC icon
    player:          { x:  24, y:  0 },  // Player / hooded merchant

    // ── Trade Goods (row 0) ─────────────────────────────────────────────
    Jewelry:         { x:  48, y:  0 },  // Blue diamond / gem
    Fur:             { x:  72, y:  0 },  // Brown bear pelt
    Bread:           { x:  96, y:  0 },  // Loaf of bread
    Spices:          { x: 120, y:  0 },  // Spice jar / sprinkle
    Herbs:           { x: 144, y:  0 },  // Green potion / herb bundle
    Wine:            { x: 168, y:  0 },  // Wine cask / barrel
    Wood:            { x: 192, y:  0 },  // Wooden log
    Clay:            { x: 216, y:  0 },  // Clay lump
    Silk:            { x: 240, y:  0 },  // Silk fabric roll

    // ── Raw Resources (row 1) ───────────────────────────────────────────
    raider:          { x:   0, y: 24 },  // Raider NPC icon
    Tools:           { x:  24, y: 24 },  // Crossed pickaxe + hammer
    Axe:             { x:  48, y: 24 },  // Battle axe (trade good / weapon)
    Iron:            { x:  72, y: 24 },  // Iron ore chunk
    Stone:           { x:  96, y: 24 },  // Dark stone / coal lump
    Fish:            { x: 120, y: 24 },  // Whole fish
    StolenGoods:     { x: 144, y: 24 },  // Brown sack
    Cash:            { x: 168, y: 24 },  // Coin bag
    Pottery:         { x: 192, y: 24 },  // Clay pot / basket
    barrel:          { x: 216, y: 24 },  // Generic barrel prop
    SmuggledGems:    { x: 240, y: 24 },  // Purple crystal shard

    // ── Weapons & Processed Goods (row 2) ───────────────────────────────
    AxeWeapon:       { x:   0, y: 48 },  // Axe (weapon variant)
    Bow:             { x:  24, y: 48 },  // Short bow
    Dagger:          { x:  48, y: 48 },  // Small dagger
    Sword:           { x:  72, y: 48 },  // Longsword
    Crossbow:        { x:  96, y: 48 },  // Crossbow
    Staff:           { x: 120, y: 48 },  // Wooden staff
    Wheat:           { x: 144, y: 48 },  // Grain sack
    Salt:            { x: 168, y: 48 },  // White salt crystals / mound
    SaltedFish:      { x: 192, y: 48 },  // Salted / smoked fish
    ExoticSpices:    { x: 216, y: 48 },  // Exotic spice packet (contraband)
    ForbiddenTexts:  { x: 240, y: 48 },  // Rolled scroll / forbidden book

    // ── Row 3: spare slots for future items ─────────────────────────────
    // Add entries here as { x: 0+col*24, y: 72 } when new sprites are added.
  },
};
