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
  SpriteSheet.boats = generateBoatSprites();
  SpriteSheet.port = generatePortSprite();
  SpriteSheet.monsters = generateMonsterSprites();
  SpriteSheet.decor = generateDecorSprites();
}

// ===================== MAP DECORATIONS =====================

function generateDecorSprites() {
  const S = SPRITE_SIZE;
  const decor = {};

  // --- Bush (for Grass / Sand) ---
  decor.bush = _makeDecorVariants(3, (g) => {
    const x = 8 + Math.floor(Math.random() * 10);
    const y = 14 + Math.floor(Math.random() * 8);
    // Shadow
    g.fill(0, 0, 0, 30);
    g.ellipse(x + 1, y + 5, 14, 5);
    // Main bush body
    g.fill(50 + Math.floor(Math.random() * 30), 120 + Math.floor(Math.random() * 30), 35);
    g.ellipse(x, y, 12, 10);
    g.fill(70 + Math.floor(Math.random() * 20), 145 + Math.floor(Math.random() * 25), 45);
    g.ellipse(x - 2, y - 1, 8, 7);
    g.ellipse(x + 3, y - 1, 7, 6);
    // Berries sometimes
    if (Math.random() > 0.5) {
      g.fill(200, 50, 50);
      g.ellipse(x + 1, y - 1, 2, 2);
      g.ellipse(x - 2, y + 1, 2, 2);
    }
  });

  // --- Small tree (for Grass edges) ---
  decor.tree = _makeDecorVariants(3, (g) => {
    const x = 10 + Math.floor(Math.random() * 10);
    const y = 8 + Math.floor(Math.random() * 4);
    // Shadow
    g.fill(0, 0, 0, 25);
    g.ellipse(x + 1, y + 19, 12, 4);
    // Trunk
    g.fill(90 + Math.floor(Math.random() * 20), 60 + Math.floor(Math.random() * 15), 30);
    g.rect(x - 1, y + 6, 3, 12);
    // Canopy
    g.fill(35 + Math.floor(Math.random() * 25), 100 + Math.floor(Math.random() * 30), 30);
    g.ellipse(x, y, 14, 12);
    g.fill(50 + Math.floor(Math.random() * 20), 120 + Math.floor(Math.random() * 25), 40);
    g.ellipse(x - 2, y + 1, 10, 9);
    g.ellipse(x + 3, y - 1, 9, 8);
  });

  // --- Small rock (for Grass / Rock / Sand) ---
  decor.rock = _makeDecorVariants(3, (g) => {
    const x = 10 + Math.floor(Math.random() * 12);
    const y = 18 + Math.floor(Math.random() * 6);
    const shade = 120 + Math.floor(Math.random() * 40);
    // Shadow
    g.fill(0, 0, 0, 25);
    g.ellipse(x + 1, y + 3, 10, 4);
    // Rock body
    g.fill(shade, shade - 5, shade - 10);
    g.ellipse(x, y, 8 + Math.floor(Math.random() * 4), 6 + Math.floor(Math.random() * 3));
    // Highlight
    g.fill(shade + 30, shade + 25, shade + 20, 120);
    g.ellipse(x - 1, y - 1, 4, 3);
  });

  // --- Pebbles (for Sand / Rock) ---
  decor.pebbles = _makeDecorVariants(3, (g) => {
    for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
      const px = 6 + Math.floor(Math.random() * 20);
      const py = 10 + Math.floor(Math.random() * 14);
      const sh = 130 + Math.floor(Math.random() * 50);
      g.fill(sh, sh - 5, sh - 15);
      g.ellipse(px, py, 3 + Math.floor(Math.random() * 2), 2 + Math.floor(Math.random() * 2));
    }
  });

  // --- Water lily (for Water) ---
  decor.lily = _makeDecorVariants(3, (g) => {
    const x = 10 + Math.floor(Math.random() * 12);
    const y = 12 + Math.floor(Math.random() * 10);
    // Lily pad
    g.fill(40, 130, 50, 180);
    g.ellipse(x, y, 10, 8);
    g.fill(30, 110, 40, 160);
    g.ellipse(x + 1, y + 1, 7, 5);
    // Flower
    if (Math.random() > 0.3) {
      g.fill(240, 200, 220);
      g.ellipse(x - 1, y - 1, 4, 4);
      g.fill(255, 230, 100);
      g.ellipse(x - 1, y - 1, 2, 2);
    }
  });

  // --- Seaweed / ripple (for Water) ---
  decor.seaweed = _makeDecorVariants(3, (g) => {
    const x = 8 + Math.floor(Math.random() * 16);
    const y = 10 + Math.floor(Math.random() * 12);
    // Wavy strands
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
      const sx = x + Math.floor(Math.random() * 8) - 4;
      g.stroke(30, 100 + Math.floor(Math.random() * 40), 60, 120);
      g.strokeWeight(1.5);
      g.noFill();
      g.beginShape();
      g.vertex(sx, y + 8);
      g.vertex(sx + 2, y + 4);
      g.vertex(sx - 1, y);
      g.vertex(sx + 1, y - 3);
      g.endShape();
    }
    g.noStroke();
  });

  // --- Snowdrift (for Snow) ---
  decor.snowdrift = _makeDecorVariants(3, (g) => {
    const x = 8 + Math.floor(Math.random() * 14);
    const y = 16 + Math.floor(Math.random() * 8);
    g.fill(220, 230, 245, 160);
    g.ellipse(x, y, 12 + Math.floor(Math.random() * 6), 5 + Math.floor(Math.random() * 3));
    g.fill(240, 245, 255, 120);
    g.ellipse(x - 2, y - 1, 8, 4);
    // Sparkle
    g.fill(255, 255, 255, 200);
    g.ellipse(x + 3, y - 2, 2, 2);
  });

  return decor;
}

/** Helper: create N random variants of a decoration sprite */
function _makeDecorVariants(count, drawFn) {
  const variants = [];
  for (let v = 0; v < count; v++) {
    const g = createGraphics(SPRITE_SIZE, SPRITE_SIZE);
    g.pixelDensity(1);
    g.clear();
    g.noStroke();
    drawFn(g);
    variants.push(g);
  }
  return variants;
}

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

// ===================== BOAT SPRITES =====================

function generateBoatSprites() {
  const boatTypes = {
    rowboat: { hull: [140, 90, 50], sail: null, size: 0.7 },
    sloop:   { hull: [100, 70, 40], sail: [230, 230, 220], size: 0.85 },
    galleon: { hull: [80, 50, 30],  sail: [240, 240, 230], size: 1.0 },
  };

  const boats = {};

  for (const [type, cfg] of Object.entries(boatTypes)) {
    boats[type] = {};
    for (const dir of ['down', 'up', 'left', 'right']) {
      boats[type][dir] = [];
      for (let frame = 0; frame < 3; frame++) {
        const g = createGraphics(SPRITE_SIZE, SPRITE_SIZE);
        g.pixelDensity(1);
        g.noStroke();
        drawBoat(g, dir, frame, cfg);
        boats[type][dir].push(g);
      }
    }
  }

  return boats;
}

function drawBoat(g, dir, frame, cfg) {
  const cx = 16, cy = 16;
  const s = cfg.size;
  const bob = frame === 0 ? 0 : (frame === 1 ? -1 : 1);

  // Water ripple beneath
  g.fill(40, 140, 220, 80);
  g.ellipse(cx, cy + 6 + bob, 22 * s, 6 * s);

  if (dir === 'down' || dir === 'up') {
    // Hull - elongated vertically
    g.fill(...cfg.hull);
    g.beginShape();
    g.vertex(cx - 5 * s, cy - 8 * s + bob);
    g.vertex(cx + 5 * s, cy - 8 * s + bob);
    g.vertex(cx + 6 * s, cy + 4 * s + bob);
    g.vertex(cx + 3 * s, cy + 8 * s + bob);
    g.vertex(cx - 3 * s, cy + 8 * s + bob);
    g.vertex(cx - 6 * s, cy + 4 * s + bob);
    g.endShape(g.CLOSE);

    // Hull highlight
    g.fill(cfg.hull[0] + 30, cfg.hull[1] + 20, cfg.hull[2] + 10, 100);
    g.rect(cx - 3 * s, cy - 6 * s + bob, 6 * s, 10 * s);

    // Mast
    g.fill(90, 60, 30);
    g.rect(cx - 1, cy - 10 * s + bob, 2, 14 * s);

    // Sail
    if (cfg.sail) {
      g.fill(...cfg.sail);
      if (dir === 'down') {
        g.triangle(cx + 1, cy - 9 * s + bob, cx + 1, cy - 2 * s + bob, cx + 7 * s, cy - 5 * s + bob);
      } else {
        g.triangle(cx - 1, cy - 9 * s + bob, cx - 1, cy - 2 * s + bob, cx - 7 * s, cy - 5 * s + bob);
      }
      // Galleon extra sail
      if (cfg.size >= 1.0) {
        g.fill(cfg.sail[0] - 10, cfg.sail[1] - 10, cfg.sail[2] - 10);
        if (dir === 'down') {
          g.triangle(cx + 1, cy + bob, cx + 1, cy + 5 * s + bob, cx + 6 * s, cy + 2 * s + bob);
        } else {
          g.triangle(cx - 1, cy + bob, cx - 1, cy + 5 * s + bob, cx - 6 * s, cy + 2 * s + bob);
        }
      }
    }
  } else {
    // Hull - elongated horizontally
    g.fill(...cfg.hull);
    g.beginShape();
    if (dir === 'right') {
      g.vertex(cx - 8 * s, cy - 3 * s + bob);
      g.vertex(cx + 6 * s, cy - 3 * s + bob);
      g.vertex(cx + 10 * s, cy + bob);
      g.vertex(cx + 6 * s, cy + 3 * s + bob);
      g.vertex(cx - 8 * s, cy + 3 * s + bob);
    } else {
      g.vertex(cx + 8 * s, cy - 3 * s + bob);
      g.vertex(cx - 6 * s, cy - 3 * s + bob);
      g.vertex(cx - 10 * s, cy + bob);
      g.vertex(cx - 6 * s, cy + 3 * s + bob);
      g.vertex(cx + 8 * s, cy + 3 * s + bob);
    }
    g.endShape(g.CLOSE);

    // Hull highlight
    g.fill(cfg.hull[0] + 30, cfg.hull[1] + 20, cfg.hull[2] + 10, 100);
    g.rect(cx - 5 * s, cy - 2 * s + bob, 10 * s, 3 * s);

    // Mast
    g.fill(90, 60, 30);
    g.rect(cx - 1, cy - 10 * s + bob, 2, 10 * s);

    // Sail
    if (cfg.sail) {
      g.fill(...cfg.sail);
      g.triangle(cx, cy - 9 * s + bob, cx, cy - 2 * s + bob, cx + (dir === 'right' ? 6 : -6) * s, cy - 5 * s + bob);
      if (cfg.size >= 1.0) {
        g.fill(cfg.sail[0] - 10, cfg.sail[1] - 10, cfg.sail[2] - 10);
        g.triangle(cx, cy - 2 * s + bob, cx, cy + 3 * s + bob, cx + (dir === 'right' ? 5 : -5) * s, cy + bob);
      }
    }
  }

  // Tiny person on deck
  g.fill(220, 180, 140);
  g.rect(cx - 1, cy - 4 * s + bob, 2, 3);
  g.fill(60, 90, 160);
  g.rect(cx - 1, cy - 1 * s + bob, 2, 2);
}

// ===================== PORT DOCK SPRITE =====================

function generatePortSprite() {
  const g = createGraphics(SPRITE_SIZE, SPRITE_SIZE);
  g.pixelDensity(1);
  g.noStroke();

  // Wooden pier planks
  g.fill(120, 80, 40);
  g.rect(4, 10, 24, 16);

  // Plank lines
  g.stroke(90, 55, 25, 120);
  g.strokeWeight(1);
  for (let y = 12; y < 26; y += 3) {
    g.line(5, y, 27, y);
  }
  g.noStroke();

  // Posts
  g.fill(90, 55, 25);
  g.rect(4, 8, 3, 20);
  g.rect(25, 8, 3, 20);

  // Rope
  g.stroke(180, 160, 100);
  g.strokeWeight(1);
  g.line(5, 10, 27, 10);
  g.noStroke();

  // Anchor symbol
  g.fill(180, 180, 190);
  g.rect(14, 2, 4, 1);
  g.rect(15, 2, 2, 5);
  g.rect(12, 6, 8, 1);
  g.rect(12, 6, 2, 3);
  g.rect(18, 6, 2, 3);

  return g;
}

// ===================== MONSTER SPRITES =====================

function generateMonsterSprites() {
  const dirs = ['down', 'up', 'left', 'right'];
  const monsters = {};

  const types = {
    dragon: { body: [60, 140, 40], wing: [40, 100, 30], eye: [255, 200, 0], belly: [120, 180, 60] },
    blackKnight: { armor: [25, 25, 35], visor: [180, 20, 20], trim: [80, 80, 100], plume: [120, 0, 0] },
    wraith: { cloak: [40, 10, 60], glow: [160, 80, 255], eye: [200, 120, 255], wisp: [100, 50, 160] },
  };

  for (const [monsterType, pal] of Object.entries(types)) {
    monsters[monsterType] = {};
    for (const dir of dirs) {
      monsters[monsterType][dir] = [];
      for (let frame = 0; frame < 3; frame++) {
        const g = createGraphics(SPRITE_SIZE, SPRITE_SIZE);
        g.pixelDensity(1);
        g.noStroke();

        if (monsterType === 'dragon') {
          drawDragon(g, dir, frame, pal);
        } else if (monsterType === 'blackKnight') {
          drawBlackKnight(g, dir, frame, pal);
        } else if (monsterType === 'wraith') {
          drawWraith(g, dir, frame, pal);
        }

        monsters[monsterType][dir].push(g);
      }
    }
  }
  return monsters;
}

function drawDragon(g, dir, frame, pal) {
  const S = SPRITE_SIZE;
  const bob = Math.sin(frame * 2.1) * 1.5;

  // Body
  g.fill(...pal.body);
  g.ellipse(S/2, S/2 + 2 + bob, S * 0.6, S * 0.5);

  // Belly
  g.fill(...pal.belly);
  g.ellipse(S/2, S/2 + 4 + bob, S * 0.35, S * 0.3);

  // Wings
  g.fill(...pal.wing);
  const wingSpread = 4 + frame * 2;
  if (dir === 'left' || dir === 'down') {
    g.triangle(S/2, S/2 - 2 + bob, S/2 - 12, S/2 - wingSpread - 4 + bob, S/2 - 4, S/2 + 2 + bob);
  }
  if (dir === 'right' || dir === 'down') {
    g.triangle(S/2, S/2 - 2 + bob, S/2 + 12, S/2 - wingSpread - 4 + bob, S/2 + 4, S/2 + 2 + bob);
  }
  if (dir === 'up') {
    g.triangle(S/2 - 3, S/2 + bob, S/2 - 14, S/2 - wingSpread + bob, S/2 - 2, S/2 + 4 + bob);
    g.triangle(S/2 + 3, S/2 + bob, S/2 + 14, S/2 - wingSpread + bob, S/2 + 2, S/2 + 4 + bob);
  }

  // Head
  g.fill(...pal.body);
  const hx = dir === 'left' ? S/2 - 6 : dir === 'right' ? S/2 + 6 : S/2;
  const hy = dir === 'up' ? S/2 - 8 + bob : S/2 - 6 + bob;
  g.ellipse(hx, hy, 10, 8);

  // Eyes
  g.fill(...pal.eye);
  if (dir !== 'up') {
    g.ellipse(hx - 2, hy - 1, 3, 3);
    g.ellipse(hx + 2, hy - 1, 3, 3);
  }

  // Tail
  g.fill(...pal.body);
  const tx = dir === 'left' ? S/2 + 8 : dir === 'right' ? S/2 - 8 : S/2 + (frame - 1) * 3;
  g.ellipse(tx, S/2 + 8 + bob, 6, 4);

  // Fire breath (frame 2)
  if (frame === 2) {
    g.fill(255, 120, 0, 180);
    const fx = dir === 'left' ? hx - 8 : dir === 'right' ? hx + 8 : hx;
    const fy = dir === 'up' ? hy - 6 : hy + 6;
    g.ellipse(fx, fy, 6, 5);
    g.fill(255, 200, 0, 150);
    g.ellipse(fx, fy, 3, 3);
  }
}

function drawBlackKnight(g, dir, frame, pal) {
  const S = SPRITE_SIZE;
  const step = (frame === 1) ? -1 : (frame === 2) ? 1 : 0;

  // Legs
  g.fill(...pal.armor);
  g.rect(S/2 - 5, S/2 + 5 + step, 4, 8);
  g.rect(S/2 + 1, S/2 + 5 - step, 4, 8);

  // Body (heavy armor)
  g.fill(...pal.armor);
  g.rect(S/2 - 7, S/2 - 6, 14, 12, 2);

  // Trim lines
  g.fill(...pal.trim);
  g.rect(S/2 - 7, S/2 - 6, 14, 2);
  g.rect(S/2 - 1, S/2 - 6, 2, 12);

  // Helmet
  g.fill(...pal.armor);
  g.ellipse(S/2, S/2 - 9, 12, 10);

  // Visor slit
  g.fill(...pal.visor);
  if (dir !== 'up') {
    g.rect(S/2 - 4, S/2 - 10, 8, 2);
  }

  // Plume
  g.fill(...pal.plume);
  g.rect(S/2 - 1, S/2 - 15, 2, 6);
  g.ellipse(S/2, S/2 - 15, 4, 3);

  // Sword (right side for right/down, left for left)
  g.fill(180, 180, 190);
  if (dir === 'left') {
    g.rect(S/2 - 12, S/2 - 4 + step, 2, 14);
    g.fill(120, 100, 60);
    g.rect(S/2 - 14, S/2 - 4 + step, 6, 2);
  } else {
    g.rect(S/2 + 10, S/2 - 4 + step, 2, 14);
    g.fill(120, 100, 60);
    g.rect(S/2 + 8, S/2 - 4 + step, 6, 2);
  }

  // Shield (on opposite side)
  g.fill(40, 40, 50);
  if (dir === 'right') {
    g.rect(S/2 - 11, S/2 - 3, 5, 8, 1);
    g.fill(...pal.trim);
    g.rect(S/2 - 10, S/2 - 1, 3, 1);
  } else if (dir !== 'up') {
    g.rect(S/2 + 6, S/2 - 3, 5, 8, 1);
    g.fill(...pal.trim);
    g.rect(S/2 + 7, S/2 - 1, 3, 1);
  }
}

function drawWraith(g, dir, frame, pal) {
  const S = SPRITE_SIZE;
  const hover = Math.sin(frame * 2.5) * 2;

  // Wispy trail below
  g.fill(pal.wisp[0], pal.wisp[1], pal.wisp[2], 80);
  for (let i = 0; i < 3; i++) {
    const wx = S/2 + (i - 1) * 5 + Math.sin(frame + i) * 2;
    const wy = S/2 + 10 + i * 2 - hover;
    g.ellipse(wx, wy, 4 + i, 6 + i);
  }

  // Cloak body (tattered robe shape)
  g.fill(...pal.cloak);
  g.beginShape();
  g.vertex(S/2 - 8, S/2 - 6 + hover);
  g.vertex(S/2 - 10, S/2 + 10 + hover);
  g.vertex(S/2 - 4, S/2 + 12 + hover);
  g.vertex(S/2, S/2 + 8 + hover);
  g.vertex(S/2 + 4, S/2 + 12 + hover);
  g.vertex(S/2 + 10, S/2 + 10 + hover);
  g.vertex(S/2 + 8, S/2 - 6 + hover);
  g.endShape(CLOSE);

  // Hood
  g.fill(pal.cloak[0] - 10, pal.cloak[1] - 5, pal.cloak[2] - 10);
  g.ellipse(S/2, S/2 - 8 + hover, 14, 12);

  // Glowing eyes
  if (dir !== 'up') {
    const eyeGlow = 150 + frame * 30;
    g.fill(pal.glow[0], pal.glow[1], pal.glow[2], eyeGlow);
    g.ellipse(S/2 - 3, S/2 - 9 + hover, 3, 3);
    g.ellipse(S/2 + 3, S/2 - 9 + hover, 3, 3);

    // Inner glow
    g.fill(255, 255, 255, 100 + frame * 20);
    g.ellipse(S/2 - 3, S/2 - 9 + hover, 1.5, 1.5);
    g.ellipse(S/2 + 3, S/2 - 9 + hover, 1.5, 1.5);
  }

  // Ethereal glow around body
  g.fill(pal.glow[0], pal.glow[1], pal.glow[2], 30 + frame * 10);
  g.ellipse(S/2, S/2 + hover, S * 0.7, S * 0.8);
}
