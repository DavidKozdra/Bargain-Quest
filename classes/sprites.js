// sprites.js — Procedural pixel art sprite generator
// All sprites are generated via p5.js createGraphics() at load time

const SpriteSheet = {};
const SPRITE_SIZE = 32;

function generateAllSprites() {
  SpriteSheet.tiles = {
    Water: generateTileSprite('Water'),
    Sand: generateTileSprite('Sand'),
    Grass: generateTileSprite('Grass'),
    Forest: generateTileSprite('Forest'),
    Snow: generateTileSprite('Snow'),
    Rock: generateTileSprite('Rock'),
  };

  SpriteSheet.city = generateCitySprites();
  SpriteSheet.player = generatePlayerSprites();
  SpriteSheet.trader = generateTraderSprites();
  SpriteSheet.raider = generateRaiderSprites();
  SpriteSheet.icons = generateIconSprites();
  SpriteSheet.fog = generateFogOverlay();
}

// ===================== TERRAIN TILES =====================

function generateTileSprite(type) {
  const g = createGraphics(SPRITE_SIZE, SPRITE_SIZE);
  g.noStroke();
  g.pixelDensity(1);

  switch (type) {
    case 'Water':
      g.background(0, 100, 180);
      // Animated-looking wave highlights
      for (let i = 0; i < 6; i++) {
        g.fill(40, 140, 220, 120);
        g.rect(
          Math.floor(Math.random() * 28),
          Math.floor(Math.random() * 28),
          Math.floor(Math.random() * 6) + 2, 2
        );
      }
      // Deep spots
      for (let i = 0; i < 4; i++) {
        g.fill(0, 60, 140, 80);
        g.rect(
          Math.floor(Math.random() * 28),
          Math.floor(Math.random() * 28), 3, 3
        );
      }
      break;

    case 'Sand':
      g.background(194, 178, 128);
      // Sand grain texture
      for (let i = 0; i < 20; i++) {
        const shade = 170 + Math.floor(Math.random() * 40);
        g.fill(shade, shade - 20, shade - 50, 100);
        g.rect(
          Math.floor(Math.random() * 30),
          Math.floor(Math.random() * 30), 2, 2
        );
      }
      // Occasional small stones
      if (Math.random() > 0.5) {
        g.fill(160, 150, 120);
        g.ellipse(20, 22, 3, 2);
      }
      break;

    case 'Grass':
      g.background(85, 145, 50);
      // Grass blade variation
      for (let i = 0; i < 12; i++) {
        const shade = 60 + Math.floor(Math.random() * 50);
        g.fill(shade, 120 + Math.floor(Math.random() * 40), 30, 150);
        g.rect(
          Math.floor(Math.random() * 30),
          Math.floor(Math.random() * 30), 2, 3
        );
      }
      // Flowers occasionally
      if (Math.random() > 0.7) {
        const fx = 5 + Math.floor(Math.random() * 22);
        const fy = 5 + Math.floor(Math.random() * 22);
        g.fill(255, 220, 50);
        g.rect(fx, fy, 2, 2);
        g.fill(255, 100, 100);
        g.rect(fx + 2, fy - 1, 2, 2);
      }
      break;

    case 'Forest':
      g.background(34, 75, 28);
      // Tree canopy pattern - darker circles
      for (let i = 0; i < 5; i++) {
        const tx = 4 + Math.floor(Math.random() * 24);
        const ty = 4 + Math.floor(Math.random() * 24);
        g.fill(20, 60, 15);
        g.ellipse(tx, ty, 8, 8);
        g.fill(45, 100, 35);
        g.ellipse(tx - 1, ty - 1, 5, 5);
        // Trunk peek
        g.fill(90, 60, 30);
        g.rect(tx - 1, ty + 3, 2, 3);
      }
      break;

    case 'Snow':
      g.background(235, 240, 250);
      // Snow sparkles
      for (let i = 0; i < 8; i++) {
        g.fill(255, 255, 255, 200);
        g.rect(
          Math.floor(Math.random() * 30),
          Math.floor(Math.random() * 30), 2, 2
        );
      }
      // Shadow dips
      for (let i = 0; i < 3; i++) {
        g.fill(200, 210, 230, 80);
        g.rect(
          Math.floor(Math.random() * 28),
          Math.floor(Math.random() * 28), 4, 2
        );
      }
      break;

    case 'Rock':
      g.background(110, 110, 110);
      // Rocky texture
      for (let i = 0; i < 8; i++) {
        const shade = 80 + Math.floor(Math.random() * 50);
        g.fill(shade, shade, shade, 120);
        const rw = 3 + Math.floor(Math.random() * 6);
        const rh = 3 + Math.floor(Math.random() * 4);
        g.rect(
          Math.floor(Math.random() * (30 - rw)),
          Math.floor(Math.random() * (30 - rh)), rw, rh
        );
      }
      // Cracks
      g.stroke(70, 70, 70, 100);
      g.strokeWeight(1);
      g.line(8, 5, 15, 20);
      g.line(20, 2, 25, 16);
      g.noStroke();
      break;
  }

  return g;
}

// ===================== CITY SPRITES =====================

function generateCitySprites() {
  const sprites = [];
  // Generate 4 city style variants
  for (let v = 0; v < 4; v++) {
    const g = createGraphics(SPRITE_SIZE, SPRITE_SIZE);
    g.pixelDensity(1);
    g.noStroke();

    // Base platform
    g.fill(140, 120, 100);
    g.rect(2, 18, 28, 14);

    // Buildings
    const colors = [
      [180, 140, 100], [160, 130, 110], [190, 170, 130], [170, 150, 120]
    ];

    // Main building
    const bc = colors[v];
    g.fill(...bc);
    g.rect(8, 6, 10, 12);
    // Roof
    g.fill(bc[0] - 40, bc[1] - 30, bc[2] - 30);
    g.triangle(7, 6, 13, 0, 19, 6);

    // Side building
    g.fill(bc[0] - 20, bc[1] - 10, bc[2]);
    g.rect(20, 10, 7, 8);
    g.fill(bc[0] - 50, bc[1] - 40, bc[2] - 20);
    g.rect(20, 8, 7, 2);

    // Small building
    g.fill(bc[0] + 10, bc[1], bc[2] - 10);
    g.rect(2, 12, 5, 6);
    g.fill(bc[0] - 30, bc[1] - 20, bc[2] - 20);
    g.rect(2, 10, 5, 2);

    // Windows (yellow dots)
    g.fill(255, 220, 80, 200);
    g.rect(10, 9, 2, 2);
    g.rect(14, 9, 2, 2);
    g.rect(10, 13, 2, 2);
    g.rect(14, 13, 2, 2);
    g.rect(22, 12, 2, 2);
    g.rect(25, 12, 2, 2);

    // Door
    g.fill(80, 50, 30);
    g.rect(12, 14, 3, 4);

    // Flag/banner on top
    g.fill(200 + v * 15, 50, 50);
    g.rect(13, 0, 1, 3);
    g.fill(200 + v * 15, 50, 50, 200);
    g.rect(14, 0, 3, 2);

    sprites.push(g);
  }
  return sprites;
}

// ===================== PLAYER SPRITES =====================

function generatePlayerSprites() {
  const dirs = ['down', 'up', 'left', 'right'];
  const sprites = {};

  for (const dir of dirs) {
    sprites[dir] = [];
    for (let frame = 0; frame < 3; frame++) {
      const g = createGraphics(SPRITE_SIZE, SPRITE_SIZE);
      g.pixelDensity(1);
      g.noStroke();
      drawCharacter(g, dir, frame, {
        skin: [220, 180, 140],
        shirt: [60, 90, 160],
        pants: [80, 60, 40],
        hair: [100, 60, 30],
        hat: [180, 140, 50],
        cape: [40, 60, 130],
      });
      sprites[dir].push(g);
    }
  }
  return sprites;
}

// ===================== TRADER SPRITES =====================

function generateTraderSprites() {
  const personalities = ['greedy', 'cautious', 'balanced'];
  const configs = {
    greedy: { skin: [210, 170, 130], shirt: [160, 50, 50], pants: [60, 40, 30], hair: [40, 30, 20], hat: [200, 170, 40], cape: [140, 40, 40] },
    cautious: { skin: [230, 190, 150], shirt: [50, 120, 80], pants: [70, 70, 50], hair: [180, 160, 100], hat: [100, 140, 80], cape: [40, 100, 60] },
    balanced: { skin: [200, 160, 120], shirt: [120, 80, 160], pants: [60, 50, 60], hair: [60, 40, 30], hat: [140, 100, 160], cape: [100, 60, 140] },
  };

  const result = {};
  for (const p of personalities) {
    result[p] = {};
    for (const dir of ['down', 'up', 'left', 'right']) {
      result[p][dir] = [];
      for (let frame = 0; frame < 3; frame++) {
        const g = createGraphics(SPRITE_SIZE, SPRITE_SIZE);
        g.pixelDensity(1);
        g.noStroke();
        drawCharacter(g, dir, frame, configs[p], true);
        result[p][dir].push(g);
      }
    }
  }
  return result;
}

// ===================== RAIDER SPRITES =====================

function generateRaiderSprites() {
  const dirs = ['down', 'up', 'left', 'right'];
  const sprites = {};

  for (const dir of dirs) {
    sprites[dir] = [];
    for (let frame = 0; frame < 3; frame++) {
      const g = createGraphics(SPRITE_SIZE, SPRITE_SIZE);
      g.pixelDensity(1);
      g.noStroke();
      drawCharacter(g, dir, frame, {
        skin: [180, 140, 110],
        shirt: [50, 50, 50],
        pants: [40, 30, 30],
        hair: [30, 20, 20],
        hat: [80, 20, 20],
        cape: [60, 20, 20],
      }, false, true);
      sprites[dir].push(g);
    }
  }
  return sprites;
}

// ===================== CHARACTER DRAWING HELPER =====================

function drawCharacter(g, dir, frame, palette, hasBackpack = false, isRaider = false) {
  const cx = 16, cy = 16;

  // Walk animation offsets
  const legOffset = frame === 0 ? 0 : (frame === 1 ? -1 : 1);
  const bobY = frame === 0 ? 0 : -1;

  // Shadow
  g.fill(0, 0, 0, 40);
  g.ellipse(cx, 28, 12, 4);

  // Cape / cloak (back layer for up direction)
  if (dir === 'up') {
    g.fill(...palette.cape);
    g.rect(cx - 5, 10 + bobY, 10, 10);
  }

  // Body / shirt
  g.fill(...palette.shirt);
  if (dir === 'down' || dir === 'up') {
    g.rect(cx - 4, 12 + bobY, 8, 8);
  } else {
    g.rect(cx - 3, 12 + bobY, 6, 8);
  }

  // Arms
  g.fill(...palette.skin);
  if (dir === 'down') {
    g.rect(cx - 6, 13 + bobY, 2, 6);
    g.rect(cx + 4, 13 + bobY, 2, 6);
  } else if (dir === 'up') {
    g.rect(cx - 6, 13 + bobY, 2, 6);
    g.rect(cx + 4, 13 + bobY, 2, 6);
  } else if (dir === 'left') {
    g.rect(cx - 4, 13 + bobY + legOffset, 2, 6);
  } else {
    g.rect(cx + 2, 13 + bobY + legOffset, 2, 6);
  }

  // Legs / pants
  g.fill(...palette.pants);
  if (dir === 'down' || dir === 'up') {
    g.rect(cx - 3, 20 + bobY, 3, 5 + legOffset);
    g.rect(cx, 20 + bobY, 3, 5 - legOffset);
  } else {
    g.rect(cx - 2, 20 + bobY, 3, 5 + legOffset);
    g.rect(cx + 1, 20 + bobY, 3, 5 - legOffset);
  }

  // Boots
  g.fill(50, 30, 20);
  g.rect(cx - 3, 25 + bobY + Math.max(0, legOffset), 3, 2);
  g.rect(cx, 25 + bobY + Math.max(0, -legOffset), 3, 2);

  // Head
  g.fill(...palette.skin);
  g.rect(cx - 4, 4 + bobY, 8, 8);

  // Hair
  g.fill(...palette.hair);
  if (dir === 'down') {
    g.rect(cx - 4, 4 + bobY, 8, 3);
  } else if (dir === 'up') {
    g.rect(cx - 4, 4 + bobY, 8, 6);
  } else if (dir === 'left') {
    g.rect(cx - 4, 4 + bobY, 4, 3);
    g.rect(cx - 4, 4 + bobY, 2, 7);
  } else {
    g.rect(cx, 4 + bobY, 4, 3);
    g.rect(cx + 2, 4 + bobY, 2, 7);
  }

  // Hat
  g.fill(...palette.hat);
  g.rect(cx - 5, 2 + bobY, 10, 3);
  g.rect(cx - 3, 0 + bobY, 6, 3);

  // Eyes
  if (dir === 'down') {
    g.fill(30, 30, 30);
    g.rect(cx - 2, 8 + bobY, 2, 2);
    g.rect(cx + 1, 8 + bobY, 2, 2);
    // Eye shine
    g.fill(255, 255, 255, 180);
    g.rect(cx - 2, 8 + bobY, 1, 1);
    g.rect(cx + 1, 8 + bobY, 1, 1);
  } else if (dir === 'left') {
    g.fill(30, 30, 30);
    g.rect(cx - 3, 8 + bobY, 2, 2);
  } else if (dir === 'right') {
    g.fill(30, 30, 30);
    g.rect(cx + 1, 8 + bobY, 2, 2);
  }

  // Backpack for traders
  if (hasBackpack) {
    g.fill(120, 80, 40);
    if (dir === 'down') {
      // Visible on sides
      g.rect(cx + 4, 11 + bobY, 4, 7);
    } else if (dir === 'up') {
      g.rect(cx - 2, 11 + bobY, 8, 7);
      g.fill(100, 65, 30);
      g.rect(cx - 1, 11 + bobY, 6, 1);
      g.rect(cx - 1, 14 + bobY, 6, 1);
    } else if (dir === 'left') {
      g.rect(cx + 1, 11 + bobY, 5, 7);
    } else {
      g.rect(cx - 6, 11 + bobY, 5, 7);
    }
  }

  // Raider weapon (sword / axe)
  if (isRaider) {
    g.fill(180, 180, 190);
    if (dir === 'down' || dir === 'right') {
      g.rect(cx + 5, 10 + bobY, 2, 10);
      g.fill(120, 80, 40);
      g.rect(cx + 4, 18 + bobY, 4, 2);
    } else if (dir === 'left') {
      g.rect(cx - 7, 10 + bobY, 2, 10);
      g.fill(120, 80, 40);
      g.rect(cx - 8, 18 + bobY, 4, 2);
    } else {
      g.rect(cx + 5, 10 + bobY, 2, 10);
      g.fill(120, 80, 40);
      g.rect(cx + 4, 18 + bobY, 4, 2);
    }

    // Skull bandana mark
    g.fill(200, 200, 200);
    g.rect(cx - 1, 3 + bobY, 2, 1);
  }
}

// ===================== ICON SPRITES =====================

function generateIconSprites() {
  const icons = {};

  // Skull icon for raiders on minimap
  const skull = createGraphics(16, 16);
  skull.pixelDensity(1);
  skull.noStroke();
  skull.fill(200, 50, 50);
  skull.ellipse(8, 7, 10, 10);
  skull.fill(0);
  skull.rect(5, 5, 2, 2);
  skull.rect(9, 5, 2, 2);
  skull.rect(6, 9, 4, 1);
  skull.fill(200, 50, 50);
  skull.rect(7, 9, 1, 1);
  skull.rect(9, 9, 1, 1);
  icons.skull = skull;

  // Coin icon
  const coin = createGraphics(16, 16);
  coin.pixelDensity(1);
  coin.noStroke();
  coin.fill(220, 180, 40);
  coin.ellipse(8, 8, 12, 12);
  coin.fill(255, 215, 60);
  coin.ellipse(7, 7, 8, 8);
  coin.fill(180, 140, 30);
  coin.textSize(8);
  coin.textAlign(CENTER, CENTER);
  coin.text('$', 8, 7);
  icons.coin = coin;

  // Exclamation mark for events
  const excl = createGraphics(16, 16);
  excl.pixelDensity(1);
  excl.noStroke();
  excl.fill(255, 200, 50);
  excl.ellipse(8, 8, 14, 14);
  excl.fill(40);
  excl.rect(7, 3, 2, 7);
  excl.rect(7, 11, 2, 2);
  icons.exclamation = excl;

  // Wagon icon for traders
  const wagon = createGraphics(16, 16);
  wagon.pixelDensity(1);
  wagon.noStroke();
  wagon.fill(140, 90, 50);
  wagon.rect(2, 5, 12, 6);
  wagon.fill(100, 60, 30);
  wagon.rect(3, 3, 10, 3);
  wagon.fill(60, 40, 20);
  wagon.ellipse(4, 12, 4, 4);
  wagon.ellipse(12, 12, 4, 4);
  icons.wagon = wagon;

  return icons;
}

// ===================== FOG / NIGHT OVERLAY =====================

function generateFogOverlay() {
  const g = createGraphics(SPRITE_SIZE * 2, SPRITE_SIZE * 2);
  g.pixelDensity(1);
  g.noStroke();
  for (let i = 0; i < 30; i++) {
    g.fill(200, 200, 220, 15);
    g.ellipse(
      Math.random() * SPRITE_SIZE * 2,
      Math.random() * SPRITE_SIZE * 2,
      10 + Math.random() * 20,
      10 + Math.random() * 20
    );
  }
  return g;
}
