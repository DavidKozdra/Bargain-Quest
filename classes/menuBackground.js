// MenuBackgroundMap - Decorative animated map for the main menu
// Item sprites are sourced from AtlasManager (items_atlas.png). No individual loadImage calls needed.

const menuTicker = {
  topItems: [],
  bottomItems: [],
  offset: 1000,
  speed: 35,
  itemWidth: 110,

  _tradeItemNames() {
    return Object.keys(ItemLibrary).filter(k =>
      !ItemLibrary[k].tags?.has('book') &&
      !ItemLibrary[k].tags?.has('weapon') &&
      !ItemLibrary[k].tags?.has('contraband')
    );
  },

  _randomCity() {
    const pool = (typeof namePool !== 'undefined' && namePool.length) ? namePool : ['Aldenmoor','Brynhaven','Calspire','Dunmore','Elstreth','Faywood','Gorthall','Holmwick'];
    return pool[Math.floor(Math.random() * pool.length)];
  },

  _pickUnique(usedNames, allNames) {
    const available = allNames.filter(n => !usedNames.has(n));
    const pool = available.length ? available : allNames;
    return pool[Math.floor(Math.random() * pool.length)];
  },

  _makeEntry(name) {
    const basePrice = ItemLibrary[name]?.baseValue || 10;
    const variance = Math.floor(Math.random() * 17) - 8;
    const price = Math.max(1, basePrice + variance);
    const prevPrice = price + Math.floor(Math.random() * 7) - 3;
    return { name, price, prevPrice, city: this._randomCity() };
  },

  init() {
    const allNames = this._tradeItemNames();
    this.topItems = [];
    this.bottomItems = [];

    const usedTop = new Set();
    for (let i = 0; i < 25; i++) {
      const name = this._pickUnique(usedTop, allNames);
      usedTop.add(name);
      this.topItems.push(this._makeEntry(name));
    }

    const usedBot = new Set();
    for (let i = 0; i < 25; i++) {
      const name = this._pickUnique(usedBot, allNames);
      usedBot.add(name);
      this.bottomItems.push(this._makeEntry(name));
    }
  },
  
  update() {
    this.offset += this.speed * (deltaTime / 1000);
    if (this.offset >= this.itemWidth) {
      this.offset -= this.itemWidth;
      const allNames = this._tradeItemNames();

      const usedTop = new Set(this.topItems.map(e => e.name));
      this.topItems.push(this._makeEntry(this._pickUnique(usedTop, allNames)));
      this.topItems.shift();

      const usedBot = new Set(this.bottomItems.map(e => e.name));
      this.bottomItems.push(this._makeEntry(this._pickUnique(usedBot, allNames)));
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

        // Price change color
        const isUp = item.price >= item.prevPrice;
        const priceColor = isUp ? '#00C853' : '#FF5252';

        // Draw from atlas if registered, otherwise skip (name label still appears)
        const frame = (typeof AtlasManager !== 'undefined') ? AtlasManager.getFrame(item.name) : null;
        if (frame) {
          image(frame.image, x, y +15, 28, 28, frame.x, frame.y, frame.w, frame.h);
        }

        noStroke();
        textAlign(CENTER);

        textSize(10);
        fill(160, 200, 255);
        text(item.city, x + 14, y + 10);

        textSize(11);
        fill(255);
        text(item.name, x + 14, y + 55);

        fill(priceColor);
        const arrow = isUp ? '▲' : '▼';
        text(`${arrow} $${item.price}`, x + 14, y + 68);
      }
    }
  },
  
  render() {
    // Top ticker
    push();
    fill(10, 12, 18, 220);
    noStroke();
    rect(0, 0, width, 82);

    // Gradient line
    for (let i = 0; i < width; i += 4) {
      fill(0, 200, 130, 30 + sin(i * 0.02) * 20);
      rect(i, 82, 4, 2);
    }
    this.renderTicker(6, this.topItems, false);
    pop();

    // Bottom ticker
    push();
    fill(10, 12, 18, 220);
    noStroke();
    rect(0, height - 82, width, 82);

    // Gradient line
    for (let i = 0; i < width; i += 4) {
      fill(0, 200, 130, 30 + sin(i * 0.02) * 20);
      rect(i, height - 84, 4, 2);
    }
    this.renderTicker(height - 76, this.bottomItems, true);
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
