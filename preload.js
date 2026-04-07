let carImage;

// ── Atlas images ───────────────────────────────────────────────────────────────
// Atlases ship from these paths:
//   assets/images/atlas.png      — shared item/UI icon sheet
//   assets/atlas/boats.png       — boat icon sheet
let itemsAtlasImg;
let boatsAtlasImg;
const BQ_AUDIO_TRACK_PLAN = Object.freeze([
  Object.freeze({
    id: "sellHighBuyBuyCity",
    label: "Sell High Buy Buy City",
    path: "assets/audio/SELL_HIGH_BUY_BUY_CITY.m4a",
    role: "menu",
    volume: 1,
  }),
  Object.freeze({
    id: "sellHighBuyBuyDay",
    label: "Sell High Buy Buy Day",
    path: "assets/audio/SELL_HIGH_BUY_BUY_Day.m4a",
    role: "adventure",
    volume: 1,
  }),
  Object.freeze({
    id: "sellHighBuyBuyNight",
    label: "Sell High Buy Buy Night",
    path: "assets/audio/SELL_HIGH_BUY_BUY_Night.m4a",
    role: "adventure",
    volume: 1,
  }),
]);
const BQ_AUDIO_EFFECT_PLAN = Object.freeze([
  Object.freeze({
    id: "combatWin",
    label: "Combat Win",
    path: "assets/audio/sounds/fortune3.ogg",
    volume: 1,
  }),
  Object.freeze({
    id: "combatLoss",
    label: "Combat Loss",
    path: "assets/audio/sounds/misfortune1.ogg",
    volume: 1,
  }),
  Object.freeze({
    id: "qteGood",
    label: "QTE Good",
    path: "assets/audio/sounds/fortune3.ogg",
    volume: 1,
  }),
  Object.freeze({
    id: "qteBad",
    label: "QTE Bad",
    path: "assets/audio/sounds/misfortune1.ogg",
    volume: 1,
  }),
  Object.freeze({
    id: "uiClick",
    label: "UI Click",
    path: "assets/audio/sounds/clicksound.wav",
    volume: 0.75,
  }),
  Object.freeze({
    id: "tradeBuy",
    label: "Trade Buy",
    path: "assets/audio/sounds/_buy.wav",
    volume: 0.9,
  }),
  Object.freeze({
    id: "tradeSell",
    label: "Trade Sell",
    path: "assets/audio/sounds/sell.wav",
    volume: 0.9,
  }),
  Object.freeze({
    id: "diceRoll",
    label: "Dice Roll",
    path: "assets/audio/sounds/rolldice1.wav",
    volume: 0.85,
  }),
  Object.freeze({
    id: "combatHit",
    label: "Combat Hit",
    path: "assets/audio/battleattempt1.ogg",
    volume: 1,
  }),
  Object.freeze({
    id: "combatMiss",
    label: "Combat Miss",
    path: "assets/audio/themeattempt1.ogg",
    volume: 1,
  }),
]);
let bqAudioPreloadPromise = null;
let bqAudioEffectPreloadPromise = null;

if (typeof window !== "undefined") {
  window.BQ_AUDIO_TRACK_PLAN = BQ_AUDIO_TRACK_PLAN;
  window.BQ_AUDIO_EFFECT_PLAN = BQ_AUDIO_EFFECT_PLAN;
}

function planAudioQueues() {
  if (typeof sound === "undefined" || !sound) return;
  if (typeof sound.planTracks === "function") {
    sound.planTracks(BQ_AUDIO_TRACK_PLAN);
  }
  if (typeof sound.planSoundEffects === "function") {
    sound.planSoundEffects(BQ_AUDIO_EFFECT_PLAN);
  }
}

function preload() {
  // Pass an error callback as 3rd arg so p5 doesn't throw when a file is missing.
  const itemsAtlasPath = (typeof ITEMS_ATLAS_DATA !== 'undefined' && ITEMS_ATLAS_DATA?.meta?.image)
    ? ITEMS_ATLAS_DATA.meta.image
    : 'assets/images/atlas.png';
  itemsAtlasImg = loadImage(
    itemsAtlasPath,
    img => { itemsAtlasImg = img; },
    () => { itemsAtlasImg = null; console.warn(`[preload] ${itemsAtlasPath} not found — shared atlas icons disabled.`); }
  );

  boatsAtlasImg = loadImage(
    'assets/atlas/boats.png',
    img => { boatsAtlasImg = img; },
    () => { boatsAtlasImg = null; console.warn('[preload] assets/atlas/boats.png not found — boat atlas icons disabled.'); }
  );

  if (typeof sound !== "undefined" && sound) {
    planAudioQueues();
    bqAudioPreloadPromise = typeof sound.preloadRegisteredTracks === "function"
      ? sound.preloadRegisteredTracks(BQ_AUDIO_TRACK_PLAN)
      : Promise.resolve([]);
    bqAudioEffectPreloadPromise = typeof sound.preloadRegisteredEffects === "function"
      ? sound.preloadRegisteredEffects(BQ_AUDIO_EFFECT_PLAN)
      : Promise.resolve([]);
  }

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

if (typeof window !== "undefined") {
  window.BQAudioPreload = {
    getPlan() {
      return BQ_AUDIO_TRACK_PLAN.slice();
    },
    getEffectPlan() {
      return BQ_AUDIO_EFFECT_PLAN.slice();
    },
    getPromise() {
      if ((!bqAudioPreloadPromise || !bqAudioEffectPreloadPromise) && typeof sound !== "undefined" && sound) {
        planAudioQueues();
        if (!bqAudioPreloadPromise) {
          bqAudioPreloadPromise = typeof sound.preloadRegisteredTracks === "function"
            ? sound.preloadRegisteredTracks(BQ_AUDIO_TRACK_PLAN)
            : Promise.resolve([]);
        }
        if (!bqAudioEffectPreloadPromise) {
          bqAudioEffectPreloadPromise = typeof sound.preloadRegisteredEffects === "function"
            ? sound.preloadRegisteredEffects(BQ_AUDIO_EFFECT_PLAN)
            : Promise.resolve([]);
        }
      }
      if (!bqAudioPreloadPromise && !bqAudioEffectPreloadPromise) return Promise.resolve([]);
      return Promise.all([
        bqAudioPreloadPromise || Promise.resolve([]),
        bqAudioEffectPreloadPromise || Promise.resolve([]),
      ]).then(([musicResults, effectResults]) => [
        ...(Array.isArray(musicResults) ? musicResults : []),
        ...(Array.isArray(effectResults) ? effectResults : []),
      ]);
    },
  };
}
