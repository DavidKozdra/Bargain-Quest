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
    this.priceHistory = {};

    // 2D building sprites - pick a random city variant
    this.buildingVariant = Math.floor(Math.random() * 4);

    // Production: cities can produce crafted goods from raw materials
    this.productionQueue = [];
    this.productionRecipes = {
      Bread:      { inputs: { Wheat: 3 }, output: "Bread", qty: 2, chance: 0.4 },
      Tools:      { inputs: { Iron: 2, Wood: 1 }, output: "Tools", qty: 1, chance: 0.3 },
      Pottery:    { inputs: { Clay: 2 }, output: "Pottery", qty: 1, chance: 0.35 },
      SaltedFish: { inputs: { Fish: 2, Salt: 1 }, output: "SaltedFish", qty: 2, chance: 0.3 },
      Wine:       { inputs: { Wheat: 4 }, output: "Wine", qty: 1, chance: 0.15 },
      Jewelry:    { inputs: { Iron: 3, Stone: 2 }, output: "Jewelry", qty: 1, chance: 0.1 },
    };

    this.generateHolidays();

    window.addEventListener("dayChanged", (e) => {
      const prev = this.population;
      this.growPopulation();
      this.restockInventory();
      this.runProduction();
      const delta = this.population - prev;
      const symbol = delta > 0 ? "+" : delta < 0 ? "-" : "=";
      this.spawnIndicator(symbol);
    });

    // Start with some goods
    this._addOrIncrement("Wheat", Math.floor(Math.random() * 35 + 5));
    this._addOrIncrement("Fish", Math.floor(Math.random() * 20));
  }

  // === HOLIDAYS ===
  isHolidayForItem(itemName, currentDay) {
    const seasonIndex = Math.floor(currentDay % 100 / 25);
    const currentSeason = ["Winter", "Spring", "Summer", "Fall"][seasonIndex];
    return this.holidays.some(holiday =>
      holiday.item === itemName &&
      holiday.day === currentDay &&
      holiday.season === currentSeason
    );
  }

  generateHolidays() {
    const itemKeys = Object.keys(ItemLibrary);
    const holidayCount = Math.floor(Math.random() * 11);
    for (let i = 0; i < holidayCount; i++) {
      const itemKey = itemKeys[Math.floor(Math.random() * itemKeys.length)];
      const day = Math.floor(Math.random() * 100);
      const seasonIndex = Math.floor(day / 25);
      const season = ["Winter", "Spring", "Summer", "Fall"][seasonIndex];
      this.holidays.push({
        name: `${ItemLibrary[itemKey].name} Festival`,
        item: itemKey,
        day: day,
        season: season
      });
    }
  }

  // === POPULATION ===
  growPopulation() {
    const currentPop = this.population;
    const foodItems = ["Wheat", "Fish", "Bread", "SaltedFish"];
    let foodQty = 0;
    for (let item of foodItems) {
      const entry = this.inventory.get(item);
      if (entry) foodQty += entry.quantity;
    }

    const foodFactor = Math.min(foodQty / currentPop, 1);
    const overpopPenalty = 1 / (1 + currentPop / 1000);
    const baseGrowth = 0.001;
    const maxBonus = 0.004;
    const growthRate = baseGrowth + maxBonus * foodFactor * overpopPenalty;

    const newPop = Math.floor(currentPop * (1 + growthRate));
    const popIncrease = newPop - currentPop;
    this.population = newPop;
    this._consumeFood(Math.floor(popIncrease / 2));
  }

  _consumeFood(amount) {
    const foodItems = ["Wheat", "Fish", "Bread", "SaltedFish"];
    let remaining = amount;
    for (let item of foodItems) {
      const entry = this.inventory.get(item);
      if (entry && remaining > 0) {
        const consumed = Math.min(remaining, entry.quantity);
        entry.quantity -= consumed;
        if (entry.quantity <= 0) this.inventory.delete(item);
        remaining -= consumed;
      }
    }
  }

  // === PRODUCTION ===
  runProduction() {
    for (let [key, recipe] of Object.entries(this.productionRecipes)) {
      if (Math.random() > recipe.chance) continue;

      // Check if we have all inputs
      let canProduce = true;
      for (let [inputItem, inputQty] of Object.entries(recipe.inputs)) {
        const entry = this.inventory.get(inputItem);
        if (!entry || entry.quantity < inputQty) {
          canProduce = false;
          break;
        }
      }

      if (canProduce) {
        // Consume inputs
        for (let [inputItem, inputQty] of Object.entries(recipe.inputs)) {
          const entry = this.inventory.get(inputItem);
          entry.quantity -= inputQty;
          if (entry.quantity <= 0) this.inventory.delete(inputItem);
        }
        // Add output
        this._addOrIncrement(recipe.output, recipe.qty);
      }
    }
  }

  // === TERRAIN RESTOCK ===
  restockInventory() {
    const { x, y } = this.location;
    const terrainCounts = { Water: 0, Grass: 0, Rock: 0, Sand: 0, Forest: 0, Snow: 0 };

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
      if (Math.random() < 0.3) this._addOrIncrement("Stone", terrainCounts.Rock);
    }
    if (terrainCounts.Grass > 0 && Math.random() < 0.8) {
      this._addOrIncrement("Wheat", terrainCounts.Grass);
      if (Math.random() < 0.2) this._addOrIncrement("Herbs", 1);
    }
    if (terrainCounts.Water > 0 && Math.random() < 0.8) {
      this._addOrIncrement("Fish", terrainCounts.Water);
      if (Math.random() < 0.25) this._addOrIncrement("Salt", 1);
    }
    if (terrainCounts.Sand > 0 && Math.random() < 0.5) {
      this._addOrIncrement("Clay", terrainCounts.Sand);
    }
    if (terrainCounts.Forest > 0 && Math.random() < 0.7) {
      this._addOrIncrement("Wood", terrainCounts.Forest);
      if (Math.random() < 0.3) this._addOrIncrement("Fur", 1);
    }
    if (terrainCounts.Snow > 0 && Math.random() < 0.4) {
      this._addOrIncrement("Fur", terrainCounts.Snow);
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

  // === INDICATORS ===
  spawnIndicator(symbol) {
    this.indicators.push({ symbol, age: 0, yOffset: 0 });
  }

  // === 2D RENDERING ===
  render(tileSize) {
    const { x, y } = this.location;
    const posX = x * tileSize;
    const posY = y * tileSize;

    // Draw city sprite
    if (typeof SpriteSheet !== 'undefined' && SpriteSheet.city && SpriteSheet.city[this.buildingVariant]) {
      image(SpriteSheet.city[this.buildingVariant], posX, posY, tileSize, tileSize);
    } else {
      // Fallback: simple rectangle
      fill(180, 140, 100);
      stroke(100, 80, 60);
      strokeWeight(1);
      rect(posX + 4, posY + 4, tileSize - 8, tileSize - 8, 3);
    }

    // City name label
    push();
    fill(255);
    stroke(0);
    strokeWeight(2);
    textAlign(CENTER, BOTTOM);
    textSize(10);
    text(this.name, posX + tileSize / 2, posY - 2);
    pop();

    // Population badge
    push();
    fill(255, 255, 255, 180);
    noStroke();
    const popText = this.population.toString();
    textSize(8);
    const tw = textWidth(popText) + 6;
    rect(posX + tileSize / 2 - tw / 2, posY + tileSize + 1, tw, 10, 2);
    fill(60);
    textAlign(CENTER, TOP);
    text(popText, posX + tileSize / 2, posY + tileSize + 2);
    pop();

    // Port dock overlay for coastal cities
    if (this.isCoastal && this.port) {
      if (typeof SpriteSheet !== 'undefined' && SpriteSheet.port) {
        image(SpriteSheet.port, posX + tileSize * 0.6, posY + tileSize * 0.6, tileSize * 0.5, tileSize * 0.5);
      } else {
        // Fallback: small anchor icon
        push();
        fill(0, 180, 220, 200);
        noStroke();
        ellipse(posX + tileSize * 0.85, posY + tileSize * 0.85, 8, 8);
        pop();
      }
    }

    // Trader count badge (top-left green dot with count)
    const cityIdx = typeof cities !== 'undefined' ? cities.indexOf(this) : -1;
    if (cityIdx >= 0 && typeof traderManager !== 'undefined') {
      const traderCount = traderManager.getTradersAtCity(cityIdx).length;
      if (traderCount > 0) {
        push();
        fill(60, 180, 80, 220);
        stroke(0, 0, 0, 150);
        strokeWeight(1);
        ellipse(posX + 4, posY + 4, 12, 12);
        fill(255);
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(7);
        text(traderCount, posX + 4, posY + 3);
        pop();
      }
    }

    // Threat indicator (top-right red dot if raiders nearby)
    if (cityIdx >= 0 && typeof raiderManager !== 'undefined') {
      const nearbyThreats = raiderManager.getRaidersNearCity(cityIdx, 8).length;
      if (nearbyThreats > 0) {
        push();
        fill(200, 50, 50, 200 + Math.sin(frameCount * 0.1) * 55);
        stroke(0, 0, 0, 150);
        strokeWeight(1);
        ellipse(posX + tileSize - 4, posY + 4, 10, 10);
        fill(255);
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(7);
        text("!", posX + tileSize - 4, posY + 3);
        pop();
      }
    }

    // Indicators (floating +/-/= signs)
    for (let indicator of this.indicators) {
      indicator.age++;
      indicator.yOffset += 0.3;
      const alpha = map(indicator.age, 0, 60, 255, 0);

      push();
      textAlign(CENTER);
      textSize(12);
      strokeWeight(1);
      if (indicator.symbol === "+") {
        fill(0, 255, 0, alpha);
        stroke(0, 150, 0, alpha);
      } else if (indicator.symbol === "-") {
        fill(255, 0, 0, alpha);
        stroke(150, 0, 0, alpha);
      } else {
        fill(255, 255, 255, alpha);
        stroke(150, 150, 150, alpha);
      }
      text(indicator.symbol, posX + tileSize / 2, posY - 10 - indicator.yOffset);
      pop();
    }
    this.indicators = this.indicators.filter(i => i.age < 60);
  }

  // === PRICING ===
  calculateItemPrice(itemName, allCities, isSelling = false) {
    const basePrice = this.getBasePrice(itemName);
    const inv = this.inventory.get(itemName);
    const localQty = inv ? inv.quantity : 0;
    const demand = this.population / (localQty + 1);

    // Regional supply pressure
    const nearbyCities = allCities.filter(c => {
      if (c === this) return false;
      const dx = c.location.x - this.location.x;
      const dy = c.location.y - this.location.y;
      return Math.sqrt(dx * dx + dy * dy) <= 25;
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
    const marketPressure = regionalDemand / (demand + 0.01);

    let finalPrice = basePrice + demand * 0.5 + marketPressure * 2;

    // Low local supply + regional abundance = lower price
    if (localQty < 3 && totalQty > totalPop / 5) {
      finalPrice *= 0.75;
    }

    // Holiday boost
    if (typeof dayNight !== 'undefined') {
      const today = dayNight.getDaysElapsed();
      if (this.isHolidayForItem(itemName, today)) {
        finalPrice *= 1.5;
      }
    }

    // Seasonality bonus
    if (typeof dayNight !== 'undefined') {
      const season = dayNight.getSeason();
      const item = ItemLibrary[itemName];
      if (item && item.seasonality.includes(season)) {
        finalPrice *= 1.2;
      }
    }

    finalPrice = Math.floor(finalPrice);

    // Track price history for UI trends
    if (!this.priceHistory[itemName]) this.priceHistory[itemName] = [];
    this.priceHistory[itemName].push(finalPrice);
    if (this.priceHistory[itemName].length > 10) this.priceHistory[itemName].shift();

    if (isSelling) {
      finalPrice = Math.floor(finalPrice * 0.8);
    }

    return Math.max(1, finalPrice);
  }

  getPriceTrend(itemName) {
    const history = this.priceHistory[itemName];
    if (!history || history.length < 2) return 0;
    const recent = history[history.length - 1];
    const older = history[0];
    if (recent > older * 1.1) return 1;  // rising
    if (recent < older * 0.9) return -1; // falling
    return 0; // stable
  }

  getBasePrice(itemName) {
    const lib = ItemLibrary[itemName];
    return lib?.baseValue ?? 10;
  }

  // === SERIALIZATION ===
  toJSON() {
    const inv = {};
    for (let [key, val] of this.inventory) {
      inv[key] = val.quantity;
    }
    return {
      name: this.name,
      location: this.location,
      population: this.population,
      inventory: inv,
      holidays: this.holidays,
      buildingVariant: this.buildingVariant,
      priceHistory: this.priceHistory
    };
  }

  static fromJSON(data) {
    const city = new City({
      name: data.name,
      location: data.location,
      population: data.population
    });
    city.buildingVariant = data.buildingVariant || 0;
    city.holidays = data.holidays || [];
    city.priceHistory = data.priceHistory || {};

    // Rebuild inventory from saved quantities
    city.inventory.clear();
    if (data.inventory) {
      for (let [key, qty] of Object.entries(data.inventory)) {
        if (ItemLibrary[key] && qty > 0) {
          city.inventory.set(key, { item: ItemLibrary[key], quantity: qty });
        }
      }
    }
    return city;
  }

  // === STATIC: City generation ===
  static generateCities(grid, count, namePool) {
    const validTiles = [];
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const type = grid[i][j].options[0];
        if (type !== 'Water') validTiles.push({ x: j, y: i });
      }
    }

    // Shuffle
    for (let i = validTiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [validTiles[i], validTiles[j]] = [validTiles[j], validTiles[i]];
    }

    // Ensure minimum distance between cities — scales with map size
    const cities = [];
    const usedNames = new Set();
    const mapDim = Math.max(rows, cols);
    const minDist = Math.max(6, Math.floor(mapDim / 15));

    for (let i = 0; i < validTiles.length && cities.length < count; i++) {
      const { x, y } = validTiles[i];

      // Check distance to existing cities
      let tooClose = false;
      for (let c of cities) {
        const dx = c.location.x - x;
        const dy = c.location.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < minDist) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      let name;
      do {
        name = namePool[Math.floor(Math.random() * namePool.length)];
      } while (usedNames.has(name));
      usedNames.add(name);

      const population = Math.floor(Math.random() * 900 + 300);
      const city = new City({ name, location: { x, y }, population });
      cities.push(city);
    }

    return cities;
  }

  addInventoryBasedOnTerrain(grid, radius = 1) {
    const { x, y } = this.location;
    const counts = { Water: 0, Grass: 0, Rock: 0, Sand: 0, Forest: 0, Snow: 0 };

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
          const tile = grid[ny][nx];
          if (!tile || !tile.options) continue;
          const type = tile.options[0];
          if (counts[type] !== undefined) counts[type]++;
        }
      }
    }

    if (counts.Rock > 0) {
      this._addOrIncrement("Iron", counts.Rock * 2);
      this._addOrIncrement("Stone", counts.Rock);
    }
    if (counts.Grass > 0) {
      this._addOrIncrement("Wheat", counts.Grass * 3);
      this._addOrIncrement("Herbs", Math.floor(counts.Grass / 2));
    }
    if (counts.Sand > 0) {
      this._addOrIncrement("Clay", counts.Sand * 3);
    }
    if (counts.Water > 0) {
      this._addOrIncrement("Fish", counts.Water * 4);
      this._addOrIncrement("Salt", counts.Water);
    }
    if (counts.Forest > 0) {
      this._addOrIncrement("Wood", counts.Forest * 3);
      this._addOrIncrement("Fur", counts.Forest);
    }
    if (counts.Snow > 0) {
      this._addOrIncrement("Fur", counts.Snow * 2);
    }
  }

  /**
   * Detect which cities are coastal (adjacent to water within 2 tiles).
   * Sets city.isCoastal = true and city.port = true for those cities.
   */
  static detectCoastalCities(cityList, grid, numRows, numCols) {
    for (const city of cityList) {
      city.isCoastal = false;
      city.port = false;
      const { x, y } = city.location;
      for (let dy = -2; dy <= 2 && !city.isCoastal; dy++) {
        for (let dx = -2; dx <= 2 && !city.isCoastal; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < numCols && ny >= 0 && ny < numRows) {
            if (grid[ny][nx]?.options[0] === 'Water') {
              city.isCoastal = true;
              city.port = true;
            }
          }
        }
      }
    }
  }
}


class NameGenerator {
  static generateNames(min = 50, max = 100) {
    const prefixes = [
      "Bald", "Bank", "Belle", "Box", "Bridge", "Camp", "Cannon", "Castle", "Clear", "Day", "East",
      "Edge", "Ever", "Fern", "Forest", "Fresh", "Great", "King", "Knob", "Knox", "Mount", "Morning",
      "New", "North", "Pacific", "Queens", "Red", "Ridge", "Ring", "River", "Rose", "Sand",
      "South", "Spring", "Strath", "Stock", "Stoke", "Stone", "Water", "Well", "West", "Wood", "Kiah",
      "Bear", "Bee", "Bird", "Crane", "Crow", "Eagle", "Fox", "Moose", "Owl", "Swan", "Wolf",
      "Baker", "Gillmen", "WaveMan", "Swoard",
      "Black", "Blue", "Brown", "Copper", "Gold", "Green", "Grey", "Hazel", "Orange",
      "Plum", "Silver", "White", "Yellow",
      "Alexandra", "Brad", "Carole", "Clare", "Cooper", "Craig", "Elizabeth", "Erin",
      "Evan", "Glen", "Kirk", "Lea", "Mary", "Scott",
      "Diamond", "Iron", "Lime", "Marble", "Pumice", "Sandstone", "Slate",
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
