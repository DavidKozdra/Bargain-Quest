class City {
  constructor({ name, location, population }) {
    this.name = name;
    this.location = location;
    this.population = population;
    this.inventory = new Map();
    this.holidays = [];
    this.traders = {};
    this.reputation = 50; // 0–100 scale, 50 = Neutral
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
    this.stockBooks();

    this._onDayChanged = () => {
      const prev = this.population;
      this.growPopulation();
      this.restockInventory();
      this.runProduction();
      const delta = this.population - prev;
      const symbol = delta > 0 ? "+" : delta < 0 ? "-" : "=";
      this.spawnIndicator(symbol);
    };
    window.addEventListener("dayChanged", this._onDayChanged);

    // Start with some goods
    this._addOrIncrement("Wheat", Math.floor(Math.random() * 35 + 5));
    this._addOrIncrement("Fish", Math.floor(Math.random() * 20));
  }

  /** Remove this city's event listener to prevent leaks on new game */
  destroy() {
    if (this._onDayChanged) {
      window.removeEventListener("dayChanged", this._onDayChanged);
      this._onDayChanged = null;
    }
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
    const itemKeys = Object.keys(ItemLibrary).filter(k => !ItemLibrary[k].tags?.has('book'));
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

  /** Stock 2-4 random books (one copy each, does NOT restock) */
  stockBooks() {
    const allBooks = Object.keys(ItemLibrary).filter(k => ItemLibrary[k].tags?.has('book'));
    if (allBooks.length === 0) return;
    const count = 2 + Math.floor(Math.random() * 3); // 2, 3, or 4
    const shuffled = allBooks.sort(() => Math.random() - 0.5);
    this.stockedBooks = [];
    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      this._addOrIncrement(shuffled[i], 1);
      this.stockedBooks.push(shuffled[i]);
    }
    this.generateBookHolidays();
  }

  /** Generate 0-2 book-themed holidays per city (discount books on those days) */
  generateBookHolidays() {
    this.bookHolidays = [];
    const bookKeys = Object.keys(ItemLibrary).filter(k => ItemLibrary[k].tags?.has('book') && ItemLibrary[k].holidayNames);
    if (bookKeys.length === 0) return;
    const count = Math.floor(Math.random() * 3); // 0, 1, or 2
    const shuffled = bookKeys.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      const book = ItemLibrary[shuffled[i]];
      const names = book.holidayNames;
      const name = names[Math.floor(Math.random() * names.length)];
      const day = Math.floor(Math.random() * 100);
      const seasonIndex = Math.floor(day / 25);
      const season = ["Winter", "Spring", "Summer", "Fall"][seasonIndex];
      this.bookHolidays.push({
        name,
        bookKey: shuffled[i],
        day,
        season,
        discount: 0.30 // 30% off
      });
    }
  }

  /** Check if a book has an active holiday discount in this city today */
  getBookHolidayDiscount(bookKey, currentDay) {
    if (!this.bookHolidays) return 0;
    const seasonIndex = Math.floor(currentDay % 100 / 25);
    const currentSeason = ["Winter", "Spring", "Summer", "Fall"][seasonIndex];
    for (const bh of this.bookHolidays) {
      if (bh.bookKey === bookKey && bh.day === currentDay && bh.season === currentSeason) {
        return bh.discount;
      }
    }
    return 0;
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

    // Reputation decay: slowly drifts toward neutral (35) if above it
    if (this.reputation > 35) {
      this.reputation = Math.max(35, this.reputation - 0.15);
    }
  }

  // === REPUTATION ===
  adjustReputation(delta) {
    this.reputation = Math.max(0, Math.min(100, this.reputation + delta));
  }

  getReputationTier() {
    const r = this.reputation;
    if (r >= 90) return { name: 'Beloved',    color: '#d4af37', emoji: '👑' };
    if (r >= 75) return { name: 'Trusted',    color: '#4fc3f7', emoji: '🤝' };
    if (r >= 55) return { name: 'Friendly',   color: '#66bb6a', emoji: '😊' };
    if (r >= 35) return { name: 'Neutral',    color: '#aaa',    emoji: '😐' };
    if (r >= 20) return { name: 'Unfriendly', color: '#ff9800', emoji: '😒' };
    return               { name: 'Hostile',    color: '#f44336', emoji: '😡' };
  }

  /** Returns a price modifier based on reputation.
   *  For buying: lower is better (discount). For selling: higher is better (bonus).
   *  @param {boolean} isSelling
   *  @returns {number} multiplier to apply to final price */
  getReputationPriceModifier(isSelling = false) {
    const r = this.reputation;
    // Linear interpolation: 0 rep = +10% markup / -10% sell penalty
    //                      50 rep = no change
    //                     100 rep = -8% discount / +8% sell bonus
    const t = (r - 50) / 50; // -1 to +1
    if (isSelling) {
      // Positive t = bonus for seller (higher price)
      return 1 + t * 0.08; // 0.92 to 1.08
    } else {
      // Positive t = discount for buyer (lower price)
      return 1 - t * 0.08; // 1.08 to 0.92
    }
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

    // Viewport culling — skip offscreen cities
    if (typeof isOnScreen === 'function' && !isOnScreen(posX, posY)) {
      // Still age indicators so they don't pile up
      this.indicators = this.indicators.filter(i => { i.age++; return i.age < 60; });
      return;
    }

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
      const traderCount = traderManager.getTraderCountAtCity(cityIdx);
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
      const nearbyThreats = raiderManager.getRaiderCountNearCity(cityIdx, 8);
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
    // Books use fixed goal%-based pricing, not supply/demand
    const libItem = ItemLibrary[itemName];
    if (libItem && libItem.goalPercent) {
      let bookPrice = Math.floor(libItem.goalPercent * (window._newGameGoldTarget || 5000));

      // Book holiday discount — themed festivals reduce book prices
      if (typeof dayNight !== 'undefined') {
        const today = dayNight.getDaysElapsed();
        const discount = this.getBookHolidayDiscount(itemName, today);
        if (discount > 0) {
          bookPrice = Math.floor(bookPrice * (1 - discount));
        }
      }

      if (isSelling) bookPrice = Math.floor(bookPrice * 0.4); // books sell for much less
      return Math.max(1, bookPrice);
    }

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

    // Reputation modifier
    finalPrice *= this.getReputationPriceModifier(isSelling);

    finalPrice = Math.floor(finalPrice);

    // Track price history for UI trends
    if (!this.priceHistory[itemName]) this.priceHistory[itemName] = [];
    this.priceHistory[itemName].push(finalPrice);
    if (this.priceHistory[itemName].length > 30) this.priceHistory[itemName].shift();

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
      bookHolidays: this.bookHolidays || [],
      stockedBooks: this.stockedBooks || [],
      buildingVariant: this.buildingVariant,
      priceHistory: this.priceHistory,
      reputation: this.reputation
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
    city.bookHolidays = data.bookHolidays || [];
    city.stockedBooks = data.stockedBooks || [];
    city.priceHistory = data.priceHistory || {};
    city.reputation = typeof data.reputation === 'number' ? data.reputation : 50;

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
    const mapDim = Math.max(rows, cols);
    const minDist = Math.max(6, Math.floor(mapDim / 15));
    const minDistSq = minDist * minDist;

    // Spatial hash for fast proximity checks (cell size = minDist)
    const cellSize = minDist;
    const hashCols = Math.ceil(cols / cellSize);
    const spatialHash = new Map(); // "cx,cy" → [{x,y}, ...]

    function hashKey(x, y) {
      return ((x / cellSize) | 0) + ',' + ((y / cellSize) | 0);
    }

    function tooCloseToExisting(x, y) {
      const cx = (x / cellSize) | 0;
      const cy = (y / cellSize) | 0;
      // Check 3×3 neighbourhood in spatial hash
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const key = (cx + dx) + ',' + (cy + dy);
          const bucket = spatialHash.get(key);
          if (!bucket) continue;
          for (const pt of bucket) {
            const ddx = pt.x - x;
            const ddy = pt.y - y;
            if (ddx * ddx + ddy * ddy < minDistSq) return true;
          }
        }
      }
      return false;
    }

    function addToHash(x, y) {
      const key = hashKey(x, y);
      let bucket = spatialHash.get(key);
      if (!bucket) { bucket = []; spatialHash.set(key, bucket); }
      bucket.push({ x, y });
    }

    const cities = [];
    const usedNames = new Set();

    // Random sampling: pick random tiles until we find enough valid spots.
    // For very large maps, random hits on non-water tiles are common enough.
    // Limit total attempts to prevent infinite loops on water-heavy maps.
    const maxAttempts = Math.max(count * 200, 100000);
    let attempts = 0;

    while (cities.length < count && attempts < maxAttempts) {
      attempts++;
      const x = Math.floor(Math.random() * cols);
      const y = Math.floor(Math.random() * rows);

      if (grid[y][x].options[0] === 'Water') continue;
      if (tooCloseToExisting(x, y)) continue;

      let name;
      if (usedNames.size >= namePool.length) {
        name = `City${cities.length + 1}`;
      } else {
        do {
          name = namePool[Math.floor(Math.random() * namePool.length)];
        } while (usedNames.has(name));
      }
      usedNames.add(name);

      const population = Math.floor(Math.random() * 900 + 300);
      const city = new City({ name, location: { x, y }, population });
      cities.push(city);
      addToHash(x, y);
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
  static generateNames(min = 80, max = 5000) {
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
