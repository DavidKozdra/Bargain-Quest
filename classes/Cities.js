class City {
  constructor({ name, location, population }) {
    this.name = name;
    this.location = location;
    this.population = population;
    this.inventory = new Map();
    this.holidays = [];
    this.traders = {};
    this.reputation = {};
    this.indicators = [];

    window.addEventListener("dayChanged", (e) => {
      const prev = this.population;
      this.growPopulation();
      this.restockInventory();
      const delta = this.population - prev;
      const symbol = delta > 0 ? "+" : delta < 0 ? "-" : "=";
      this.spawnIndicator(symbol);
    });
  }

  growPopulation() {
    const currentPop = this.population;
    const foodItems = ["Wheat", "Fish"];
    let foodQty = 0;
    for (let item of foodItems) {
      const entry = this.inventory.get(item);
      if (entry) foodQty += entry.quantity;
    }

    const goldEstimate = this.inventory.get("Gold")?.quantity || 0;
    const foodFactor = Math.min(foodQty / currentPop, 1);
    const goldFactor = Math.min(goldEstimate / 1000, 1);
    const overpopPenalty = 1 / (1 + currentPop / 1000);

    const baseGrowth = 0.001;
    const maxBonus = 0.004;
    const growthRate = baseGrowth + maxBonus * foodFactor * goldFactor * overpopPenalty;

    this.population = Math.floor(currentPop * (1 + growthRate));
  }

  restockInventory() {
    const { x, y } = this.location;
    const terrainCounts = { Water: 0, Grass: 0, Rock: 0, Sand: 0 };

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
          const tile = grid[ny][nx];
          const type = tile.options[0];
          if (terrainCounts[type] !== undefined) {
            terrainCounts[type]++;
          }
        }
      }
    }

    if (terrainCounts.Rock > 0 && Math.random() < 0.7) {
      this._addOrIncrement("Iron", terrainCounts.Rock);
    }
    if (terrainCounts.Grass > 0 && Math.random() < 0.8) {
      this._addOrIncrement("Wheat", terrainCounts.Grass);
    }
    if (terrainCounts.Water > 0 && Math.random() < 0.8) {
      this._addOrIncrement("Fish", terrainCounts.Water);
    }
    if (terrainCounts.Sand > 0 && Math.random() < 0.5) {
      this._addOrIncrement("Clay", terrainCounts.Sand);
    }
  }

  _addOrIncrement(itemKey, amount = 1) {
    if (!ItemLibrary[itemKey]) return;
    if (this.inventory.has(itemKey)) {
      this.inventory.get(itemKey).quantity += amount;
    } else {
      this.inventory.set(itemKey, {
        item: ItemLibrary[itemKey],
        quantity: amount
      });
    }
  }

  spawnIndicator(symbol) {
    this.indicators.push({
      symbol,
      age: 0,
      yOffset: 0
    });
  }

  render(tileSize, maxHeight) {
    const { x, y } = this.location;
    const posX = x * tileSize;
    const posZ = y * tileSize;
    const elevation = elevationMap[y][x] * maxHeight;

    // City body
    push();
    translate(-cols * tileSize / 2, 0, -rows * tileSize / 2);
    translate(posX + tileSize / 2, elevation + 5, posZ + tileSize / 2);

    fill(250, 250, 0);
    noStroke();
    rotateX(-HALF_PI);
    ellipse(0, 0, tileSize * 0.8, tileSize * 0.8);
    pop();

    // Render indicators
    for (let indicator of this.indicators) {
      indicator.age++;
      indicator.yOffset += 0.2;

      push();
      translate(-cols * tileSize / 2, 0, -rows * tileSize / 2);
      translate(
        posX + tileSize / 2,
        elevation + 5 + indicator.yOffset,
        posZ + tileSize / 2
      );

      rotateX(-HALF_PI);
      noFill();
      strokeWeight(2);

      if (indicator.symbol === "+") {
        stroke(0, 255, 0);
        line(-4, 0, 4, 0); // horizontal
        line(0, -4, 0, 4); // vertical
      } else if (indicator.symbol === "-") {
        stroke(255, 0, 0);
        line(-4, 0, 4, 0); // horizontal only
      } else {
        stroke(255);
        line(-4, 0, 4, 0); // horizontal = symbol
        line(-4, 3, 4, 3);
      }

      pop();
    }

    // Remove expired indicators (after ~60 frames)
    this.indicators = this.indicators.filter(i => i.age < 60);
  }

  static generateCities(grid, count, namePool) {
    const validTiles = [];
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const type = grid[i][j].options[0];
        if (type !== 'Water') validTiles.push({ x: j, y: i });
      }
    }

    for (let i = validTiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [validTiles[i], validTiles[j]] = [validTiles[j], validTiles[i]];
    }

    const cities = [];
    const usedNames = new Set();

    for (let i = 0; i < count && i < validTiles.length; i++) {
      const { x, y } = validTiles[i];
      let name;
      do {
        name = namePool[Math.floor(Math.random() * namePool.length)];
      } while (usedNames.has(name));
      usedNames.add(name);

      const population = Math.floor(random(300, 1200));
      cities.push(new City({ name, location: { x, y }, population }));
    }

    return cities;
  }

  addInventoryBasedOnTerrain(grid, radius = 1) {
    const { x, y } = this.location;
    const counts = { Water: 0, Grass: 0, Rock: 0, Sand: 0 };

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
          const tile = grid[ny][nx];
          if (!tile || !tile.options) continue;
          const type = tile.options[0];
          if (counts[type] !== undefined) {
            counts[type]++;
          }
        }
      }
    }

    if (counts.Rock > 0) {
      this.inventory.set("Iron", {
        item: ItemLibrary.Iron,
        quantity: counts.Rock * 2
      });
    }

    if (counts.Grass > 0) {
      this.inventory.set("Wheat", {
        item: ItemLibrary.Wheat,
        quantity: counts.Grass * 3
      });
    }

    if (counts.Sand > 0) {
      this.inventory.set("Clay", {
        item: ItemLibrary.Clay,
        quantity: counts.Sand * 3
      });
    }

    if (counts.Water > 0) {
      this.inventory.set("Fish", {
        item: ItemLibrary.Fish,
        quantity: counts.Water * 4
      });
    }
  }

  calculateItemPrice(itemName, allCities) {
    const basePrice = this.getBasePrice(itemName);
    const inv = this.inventory.get(itemName);
    const localQty = inv ? inv.quantity : 0;
    const demand = this.population / (localQty + 1);

    const nearbyCities = allCities.filter(c => {
      if (c === this) return false;
      const dx = c.location.x - this.location.x;
      const dy = c.location.y - this.location.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist <= 25;
    });

    let totalQty = 0;
    let totalPop = 0;
    for (let city of nearbyCities) {
      const item = city.inventory.get(itemName);
      if (item) {
        totalQty += item.quantity;
        totalPop += city.population;
      }
    }

    const regionalDemand = totalPop / (totalQty + 1);
    const marketPressure = regionalDemand / demand;
    let finalPrice = basePrice + demand * 0.5 + marketPressure * 2;
    return Math.floor(finalPrice);
  }

  getBasePrice(itemName) {
    const lib = ItemLibrary[itemName];
    return lib?.basePrice ?? 10;
  }
}



class NameGenerator {
  static generateNames(min = 50, max = 100) {
    const prefixes = [
      // Geography/Nature
      "Bald", "Bank", "Belle", "Box", "Bridge", "Camp", "Cannon", "Castle", "Clear", "Day", "East",
      "Edge", "Ever", "Fern", "Forest", "Fresh", "Great", "King", "Knob", "Knox", "Mount", "Morning",
      "New", "North", "Pacific", "Queens", "Red", "Ridge", "Ring", "River", "Rose", "Sand",
      "South", "Spring", "Strath", "Stock", "Stoke", "Stone", "Water", "Well", "West", "Wood", "Kiah",

      // Animals
      "Bear", "Bee", "Bird", "Crane", "Crow", "Eagle", "Fox", "Moose", "Owl", "Swan", "Wolf",

      // Occupations
      "Baker", "Gillmen", "WaveMan", "Swoard",

      // Colours
      "Black", "Blue", "Brown", "Copper", "Gold", "Green", "Grey", "Hazel", "Orange",
      "Plum", "Red", "Silver", "White", "Yellow",

      // Names
      "Alexandra", "Brad", "Carole", "Clare", "Cooper", "Craig", "Elizabeth", "Erin",
      "Evan", "Glen", "Kirk", "Lea", "Mary", "Scott",

      // Minerals & Woods
      "Copper", "Diamond", "Gold", "Iron", "Lime", "Marble", "Pumice", "Sandstone", "Silver", "Slate",
      "Ash", "Cedar", "Cherry", "Elm", "Maple", "Oak", "Pine", "Willow",

    ];

    const suffixes = [
      "bank", "bark", "barrow", "bay", "beach", "bell", "borough", "bourne", "broad", "bridge",
      "brook", "brough", "burgh", "burn", "bury", "by", "canyon", "caster", "chester", "cliffe",
      "combe", "cot", "cott", "cote", "cove", "creek", "croft", "crook", "dale", "den", "din",
      "dine", "don", "downs", "falls", "field", "fin", "flats", "ford", "fork", "gate", "grove",
      "gum", "ham", "harbour", "heights", "hill", "holm", "hurst", "ing", "kirk", "land", "lake",
      "latch", "lea", "leigh", "ley", "marsh", "mere", "minster", "mond", "mont", "more", "ness",
      "park", "pilly", "pine", "point", "pond", "ridge", "river", "rock", "sett", "side", "son",
      "stead", "stoke", "stone", "stow", "terrace", "thorpe", "ton", "tor", "town", "vale", "valley",
      "view", "village", "ville", "water", "well", "wharf", "wick", "wood", "worth", "Romea",
    ];

    const names = new Set();
    const total = Math.floor(Math.random() * (max - min + 1)) + min;

    while (names.size < total) {
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      const name = prefix + suffix.charAt(0).toUpperCase() + suffix.slice(1);
      names.add(name);
    }

    return [...names];
  }
}
