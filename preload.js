let playerImg, treesImg, grassImg, waterImg, snowImg, goldImg, playerAvatarImg;
let soundEffect, backgroundMusic;

function preload() {
  // Images
  playerImg = loadImage('assets/player.png');
  treesImg = loadImage('assets/trees.png');
  grassImg = loadImage('assets/grass.png');
  waterImg = loadImage('assets/water.png');
  snowImg = loadImage('assets/snow.png');
  goldImg = loadImage('assets/gold.png');
  playerAvatarImg = loadImage('assets/player_avatar.png');

  // Sounds
  soundEffect = loadSound('assets/sound_effect.mp3');
  backgroundMusic = loadSound('assets/background_music.mp3');
}