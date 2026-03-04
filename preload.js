let carImage;

// ── Atlas images ───────────────────────────────────────────────────────────────
// Export your sprite sheets to these exact paths before running:
//   assets/images/items_atlas.png   — all item icons (24×24 per frame)
//   assets/images/status_atlas.png  — heart, fire, skull (24×24, 3 frames wide)
let itemsAtlasImg;
let statusAtlasImg;

function preload() {
  // Pass an error callback as 3rd arg so p5 doesn't throw when a file is missing.
  itemsAtlasImg = loadImage(
    'assets/images/bargain bag.png',
    img => { itemsAtlasImg = img; },
    () => { itemsAtlasImg = null; console.warn('[preload] items_atlas.png not found — save it to assets/images/ to enable atlas icons.'); }
  );

  // All other sprites are generated procedurally in setup() via generateAllSprites()
}

/**
 * registerAtlases()
 * Called from game.js alongside generateAllSprites().
 * Only registers atlases whose images actually loaded.
 */
function registerAtlases() {
  if (itemsAtlasImg)  AtlasManager.register('items',  itemsAtlasImg,  ITEMS_ATLAS_DATA);
}
