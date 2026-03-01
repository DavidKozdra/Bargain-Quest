// MenuBackgroundMap - Decorative animated map for the main menu

const menuItemSprites = {};
let menuItemImagesLoaded = false;

function generateMenuItemSprites() {
  const items = [
    { name: 'Iron', file: 'iron.png' },
    { name: 'Wheat', file: 'wheat.png' },
    { name: 'Fish', file: 'fish.png' },
    { name: 'Clay', file: 'clay.png' },
  ];
  
  menuItemImagesLoaded = false;
  let loadedCount = 0;
  
  for (const item of items) {
    const img = loadImage(`assets/images/${item.file}`, 
      () => { loadedCount++; if (loadedCount === items.length) menuItemImagesLoaded = true; },
      () => { console.warn(`Failed to load ${item.file}`); }
    );
    menuItemSprites[item.name] = img;
  }
}

const menuTicker = {
  topItems: [],
  bottomItems: [],
  offset: 1000,
  speed: 35,
  itemWidth: 100,
  
  init() {
    const itemNames = Object.keys(menuItemSprites);
    this.topItems = [];
    this.bottomItems = [];
    
    for (let i = 0; i < 25; i++) {
      const name = random(itemNames);
      const basePrice = ItemLibrary[name]?.baseValue || 10;
      const variance = floor(random(-8, 9));
      const price = Math.max(1, basePrice + variance);
      const prevPrice = price + floor(random(-3, 4));
      this.topItems.push({ name, price, prevPrice });
    }
    
    for (let i = 0; i < 25; i++) {
      const name = random(itemNames);
      const basePrice = ItemLibrary[name]?.baseValue || 10;
      const variance = floor(random(-8, 9));
      const price = Math.max(1, basePrice + variance);
      const prevPrice = price + floor(random(-3, 4));
      this.bottomItems.push({ name, price, prevPrice });
    }
  },
  
  update() {
    if (!menuItemImagesLoaded) return;
    
    this.offset += this.speed * (deltaTime / 1000);
    if (this.offset >= this.itemWidth) {
      this.offset -= this.itemWidth;
      
      const itemNames = Object.keys(menuItemSprites);
      
      // Top ticker - new item
      let name = random(itemNames);
      let basePrice = ItemLibrary[name]?.baseValue || 10;
      let variance = floor(random(-8, 9));
      let price = Math.max(1, basePrice + variance);
      let prevPrice = price + floor(random(-3, 4));
      this.topItems.push({ name, price, prevPrice });
      this.topItems.shift();
      
      // Bottom ticker - new item (different direction)
      name = random(itemNames);
      basePrice = ItemLibrary[name]?.baseValue || 10;
      variance = floor(random(-8, 9));
      price = Math.max(1, basePrice + variance);
      prevPrice = price + floor(random(-3, 4));
      this.bottomItems.push({ name, price, prevPrice });
      this.bottomItems.shift();
    }
  },
  
  renderTicker(y, items, reverse) {
    const startX = reverse ? width + this.offset : -this.offset;
    
    for (let i = 0; i < items.length; i++) {
      const x = reverse 
        ? startX - i * this.itemWidth + 20 
        : startX + i * this.itemWidth + 20;
      
      if (x > -this.itemWidth && x < width + this.itemWidth) {
        const item = items[i];
        const sprite = menuItemSprites[item.name];
        
        // Price change color
        const isUp = item.price >= item.prevPrice;
        const priceColor = isUp ? '#00C853' : '#FF5252';
        
        if (sprite && sprite.width > 0) {
          image(sprite, x, y, 28, 28);
        }
        
        noStroke();
        textSize(11);
        textAlign(CENTER);
        
        fill(255);
        text(item.name, x + 14, y + 42);
        
        fill(priceColor);
        const arrow = isUp ? '▲' : '▼';
        text(`${arrow} $${item.price}`, x + 14, y + 56);
      }
    }
  },
  
  render() {
    if (!menuItemImagesLoaded) return;
    
    // Top ticker
    push();
    fill(10, 12, 18, 220);
    noStroke();
    rect(0, 0, width, 68);
    
    // Gradient line
    for (let i = 0; i < width; i += 4) {
      fill(0, 200, 130, 30 + sin(i * 0.02) * 20);
      rect(i, 68, 4, 2);
    }
    this.renderTicker(8, this.topItems, false);
    pop();
    
    // Bottom ticker
    push();
    fill(10, 12, 18, 220);
    noStroke();
    rect(0, height - 68, width, 68);
    
    // Gradient line
    for (let i = 0; i < width; i += 4) {
      fill(0, 200, 130, 30 + sin(i * 0.02) * 20);
      rect(i, height - 70, 4, 2);
    }
    this.renderTicker(height - 60, this.bottomItems, true);
    pop();
  }
};

let menuMapData = {
  grid: [],
  elevationMap: [],
  cols: 60,
  rows: 40,
  tileSize: 24,
  camX: 0,
  camY: 0,
  targetCamX: 0,
  targetCamY: 0,
  regenerateTimer: 0,
  regenerateInterval: 8000
};

function initMenuMap() {
  menuMapData.cols = 100;
  menuMapData.rows = 80;
  menuMapData.tileSize = 32;
  menuMapData.camX = menuMapData.cols * menuMapData.tileSize / 2;
  menuMapData.camY = menuMapData.rows * menuMapData.tileSize / 2;
  menuMapData.targetCamX = menuMapData.camX;
  menuMapData.targetCamY = menuMapData.camY;

  // Generate tile sprites early so the menu can use them
  if (!SpriteSheet.tiles) {
    SpriteSheet.tiles = {
      Water: generateTileSprite('Water'),
      Sand: generateTileSprite('Sand'),
      Grass: generateTileSprite('Grass'),
      Forest: generateTileSprite('Forest'),
      Snow: generateTileSprite('Snow'),
      Rock: generateTileSprite('Rock'),
    };
  }

  // Generate item sprites for ticker
  generateMenuItemSprites();
  menuTicker.init();
  
  generateMenuMap();
}

function generateMenuMap() {
  menuMapData.grid = [];
  menuMapData.elevationMap = [];
  
  for (let i = 0; i < menuMapData.rows; i++) {
    menuMapData.grid[i] = [];
    menuMapData.elevationMap[i] = [];
  }
  
  let s = 0.045;
  noiseSeed(floor(random(100000)));
  
  for (let i = 0; i < menuMapData.rows; i++) {
    for (let j = 0; j < menuMapData.cols; j++) {
      let nx = i * s, ny = j * s;
      let e = 0.5 * noise(nx, ny)
            + 0.25 * noise(nx * 2, ny * 2)
            + 0.125 * noise(nx * 4, ny * 4);
      e = e * 0.9 + 0.05;
      
      let cx = (j / menuMapData.cols - 0.5) * 2;
      let cy = (i / menuMapData.rows - 0.5) * 2;
      let edgeDist = Math.max(Math.abs(cx), Math.abs(cy));
      if (edgeDist > 0.75) {
        e -= (edgeDist - 0.75) * 0.35;
      }
      menuMapData.elevationMap[i][j] = Math.max(0, e);
    }
  }
  
  for (let i = 0; i < menuMapData.rows; i++) {
    for (let j = 0; j < menuMapData.cols; j++) {
      let e = menuMapData.elevationMap[i][j];
      let type;
      if (e < 0.35) type = 'Water';
      else if (e < 0.42) type = 'Sand';
      else if (e < 0.65) type = 'Grass';
      else if (e < 0.8) type = 'Forest';
      else type = 'Rock';
      menuMapData.grid[i][j] = { options: [type] };
    }
  }
}

function updateMenuMap() {
  let t = millis() * 0.0001;
  menuMapData.targetCamX = menuMapData.cols * menuMapData.tileSize / 2 + sin(t) * 200;
  menuMapData.targetCamY = menuMapData.rows * menuMapData.tileSize / 2 + cos(t * 0.7) * 120;
  
  menuMapData.camX = lerp(menuMapData.camX, menuMapData.targetCamX, 0.015);
  menuMapData.camY = lerp(menuMapData.camY, menuMapData.targetCamY, 0.015);
  
  menuMapData.regenerateTimer += deltaTime;
  if (menuMapData.regenerateTimer > menuMapData.regenerateInterval) {
    menuMapData.regenerateTimer = 0;
    generateMenuMap();
  }
}

function renderMenuMap() {
  push();
  translate(width / 2 - menuMapData.camX, height / 2 - menuMapData.camY);
  
  let ts = menuMapData.tileSize;
  let halfW = width / 2;
  let halfH = height / 2;
  let startCol = Math.max(0, Math.floor((menuMapData.camX - halfW) / ts) - 2);
  let endCol = Math.min(menuMapData.cols - 1, Math.floor((menuMapData.camX + halfW) / ts) + 2);
  let startRow = Math.max(0, Math.floor((menuMapData.camY - halfH) / ts) - 2);
  let endRow = Math.min(menuMapData.rows - 1, Math.floor((menuMapData.camY + halfH) / ts) + 2);
  
  for (let i = startRow; i <= endRow; i++) {
    for (let j = startCol; j <= endCol; j++) {
      let type = menuMapData.grid[i][j].options[0];
      let sprite = SpriteSheet.tiles ? SpriteSheet.tiles[type] : null;
      if (sprite) {
        image(sprite, j * ts, i * ts, ts, ts);
      } else {
        fill(typeColors[type] || '#000');
        noStroke();
        rect(j * ts, i * ts, ts + 1, ts + 1);
      }

      // Subtle elevation shading
      let elev = menuMapData.elevationMap[i][j];
      if (elev > 0.5 && type !== 'Water') {
        fill(0, 0, 0, (elev - 0.5) * 40);
        noStroke();
        rect(j * ts, i * ts, ts, ts);
      }
    }
  }
  
  pop();
}
