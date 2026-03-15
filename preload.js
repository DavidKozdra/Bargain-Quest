let carImage;

// ── Atlas images ───────────────────────────────────────────────────────────────
// Atlases ship from these paths:
//   assets/atlas/atlas.png       — shared item/UI icon sheet
//   assets/atlas/boats.png       — boat icon sheet
//   assets/images/difficulty.png — status icon sheet
let itemsAtlasImg;
let boatsAtlasImg;
let statusAtlasImg;

function preload() {
  // Pass an error callback as 3rd arg so p5 doesn't throw when a file is missing.
  itemsAtlasImg = loadImage(
    'assets/atlas/atlas.png',
    img => { itemsAtlasImg = img; },
    () => { itemsAtlasImg = null; console.warn('[preload] assets/atlas/atlas.png not found — shared atlas icons disabled.'); }
  );

  boatsAtlasImg = loadImage(
    'assets/atlas/boats.png',
    img => { boatsAtlasImg = img; },
    () => { boatsAtlasImg = null; console.warn('[preload] assets/atlas/boats.png not found — boat atlas icons disabled.'); }
  );

  // All other sprites are generated procedurally in setup() via generateAllSprites()

  statusAtlasImg = loadImage(
    'assets/images/difficulty.png',
    img => { statusAtlasImg = img; },
    () => { statusAtlasImg = null; console.warn('[preload] assets/images/difficulty.png not found — status atlas icons disabled.'); }
  );

}

/**
 * registerAtlases()
 * Called from game.js alongside generateAllSprites().
 * Only registers atlases whose images actually loaded.
 */
function registerAtlases() {
  if (itemsAtlasImg && typeof ITEMS_ATLAS_DATA !== 'undefined') {
    AtlasManager.register('items', itemsAtlasImg, ITEMS_ATLAS_DATA);
  }
  if (boatsAtlasImg && typeof BOATS_ATLAS_DATA !== 'undefined') {
    AtlasManager.register('boats', boatsAtlasImg, BOATS_ATLAS_DATA);
  }
  if (statusAtlasImg && typeof STATUS_ATLAS_DATA !== 'undefined') {
    AtlasManager.register('status', statusAtlasImg, STATUS_ATLAS_DATA);
  }
}
