let carImage;

// ── Atlas images ───────────────────────────────────────────────────────────────
// Atlases ship from these paths:
//   assets/atlas/atlas.png       — shared item/UI icon sheet
//   assets/atlas/boats.png       — boat icon sheet
// Status icons currently fall back to inline emoji when no dedicated status
// sheet is shipped with the build.
let itemsAtlasImg;
let boatsAtlasImg;

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
}
