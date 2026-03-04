// assets/atlas/status_atlas.js
// Atlas descriptor for assets/images/status_atlas.png
//
// Sprite size: 24 × 24 px, single row of 3 columns.
//
// Layout reference:
//   col 0 (x=  0): heart  — love / buff / health icon
//   col 1 (x= 24): fire   — burning / cursed status
//   col 2 (x= 48): skull  — death / poison icon

const STATUS_ATLAS_DATA = {
  meta: {
    image:       'assets/images/status_atlas.png',
    frameWidth:  24,
    frameHeight: 24,
  },
  frames: {
    heart: { x:  0, y: 0 },  // Purple heart — love / health
    fire:  { x: 24, y: 0 },  // Orange flame — burning / cursed
    skull: { x: 48, y: 0 },  // Grey skull   — death / poison
  },
};
