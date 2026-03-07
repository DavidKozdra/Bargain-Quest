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
    this._priceHistorySampleDay = {};

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

    // Counters maintained by Trader/Raider code — read by render() for O(1) badge display
    this.cityIndex = -1;          // set by buildCityLocationMap()
    this.dockedTraderCount = 0;   // incremented on arrive, decremented on depart

    this.generateHolidays();
    this.stockBooks();
    this.stockedWeapons = [];
    this.generateCityFeatures();
    // City-management defaults
    this.management = {
      budget: 0,
      taxRate: (window.DIFFICULTY_CONFIG && window.DIFFICULTY_CONFIG.taxRate) ? window.DIFFICULTY_CONFIG.taxRate : 0.05,
      buildingQueue: [],
      upgradeLevels: {},
    };

    this._onDayChanged = () => {
      const prev = this.population;
      this.growPopulation();
      this.restockInventory();
      this.runProduction();
      // Restock weapons every 10 days if city has a weapon shop
      if (this.hasWeaponShop && typeof dayNight !== 'undefined' && dayNight.getDaysElapsed() % 10 === 0) {
        this.stockWeapons();
      }
      const delta = this.population - prev;
      const symbol = delta > 0 ? "+" : delta < 0 ? "-" : "=";
      this.spawnIndicator(symbol);
    };
    window.addEventListener("dayChanged", this._onDayChanged);

    // Start with some goods
    this._addOrIncrement("Wheat", Math.floor(Math.random() * 35 + 5));
    this._addOrIncrement("Fish", Math.floor(Math.random() * 20));
  }

  /** Get the market value of the city (sum of all inventory item values) */
  getMarketValue() {
    let value = 0;
    for (const [key, entry] of this.inventory) {
      // Valuation should be read-only and difficulty-neutral (no trend mutation).
      value += this.calculateItemPrice(key, window.cities, false, {
        trackHistory: false,
        applyDifficultyMultipliers: false,
      }) * entry.quantity;
    }
    return value;
  }

  // === CITY MANAGEMENT HELPERS ===
  /** Apply tax over a period.
   * days: number of days to apply (default 7 for weekly). Returns revenue added.
   */
  applyWeeklyTax(days = 7) {
    const basePerCapita = 8; // base gold per population unit (per week equivalent)
    const taxRate = this.management?.taxRate ?? 0.05;
    const repMod = 1 + ((this.reputation - 50) / 200); // approx 0.75 - 1.25
    // Scale revenue proportionally to days (weekly baseline = 7 days)
    const weeklyRevenue = Math.max(0, Math.floor(this.population * basePerCapita * taxRate * repMod));
    const revenue = Math.max(0, Math.floor(weeklyRevenue * (days / 7)));
    this.management = this.management || { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {} };
    this.management.budget = (this.management.budget || 0) + revenue;
    return revenue;
  }

  /** Enqueue a building project. buildTime in seconds, cost in gold */
  enqueueBuild(buildingType, cost = 100, buildTime = 60) {
    this.management = this.management || { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {} };
    this.management.buildingQueue.push({ type: buildingType, cost: cost, buildTime: buildTime, progress: 0 });
  }

  /** Internal: mark a build as completed and apply effects */
  _completeBuild(build) {
    if (!build || !build.type) return;
    const _buildLabels = {
      bank: '🏦 Bank', gamblingDen: '🎲 Gambling Den', bountyBoard: '📜 Bounty Board',
      weaponShop: '⚔️ Weapon Shop', temple: '⛪ Temple', farm: '🌾 Farm',
      warehouse: '📦 Warehouse', walls: '🏰 Walls', removeBlackMarket: '🚫 Black Market removed',
    };
    switch (build.type) {
      case 'bank':
        this.hasBank = true; break;
      case 'gamblingDen':
        this.hasGamblingDen = true; break;
      case 'blackMarket':
        this.hasBlackMarket = true; break;
      case 'bountyBoard':
        this.hasBountyBoard = true; break;
      case 'weaponShop':
        this.hasWeaponShop = true; this.stockWeapons(); break;
      case 'removeBlackMarket':
        this.hasBlackMarket = false; break;
      default:
        // custom building types can be added to upgradeLevels
        this.management.upgradeLevels = this.management.upgradeLevels || {};
        this.management.upgradeLevels[build.type] = (this.management.upgradeLevels[build.type] || 0) + 1;
        break;
    }
    // Small reputation boost for successful completion
    this.adjustReputation(2);
    // Fanfare notification for the player's managed city
    if (this._isManagedCity && typeof notificationManager !== 'undefined') {
      const label = _buildLabels[build.type] || build.type;
      notificationManager.log(`Construction complete: ${label} is ready!`, 'success');
      window._cityMgmtBuildFanfare = { label, ts: Date.now() };
    }
  }

  /** Tick management: advance build queue by dt (ms) and complete finished builds */
  tickManagement(dt) {
    if (!this.management || !Array.isArray(this.management.buildingQueue)) return;
    for (const b of this.management.buildingQueue) {
      b.progress = (b.progress || 0) + (dt / 1000);
    }
    const finished = this.management.buildingQueue.filter(b => b.progress >= b.buildTime);
    for (const f of finished) {
      this._completeBuild(f);
    }
    // remove finished builds
    this.management.buildingQueue = this.management.buildingQueue.filter(b => b.progress < b.buildTime);
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
    const dayInYear = ((currentDay % 100) + 100) % 100;
    const seasonIndex = Math.floor(dayInYear / 25);
    const currentSeason = ["Winter", "Spring", "Summer", "Fall"][seasonIndex];
    return this.holidays.some(holiday =>
      holiday.item === itemName &&
      holiday.day === dayInYear &&
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

  /** Stock 2-4 random weapons (one copy each). Called when hasWeaponShop is true. */
  stockWeapons() {
    const allWeapons = Object.keys(ItemLibrary).filter(k => ItemLibrary[k].category === 'Weapon');
    if (allWeapons.length === 0) return;
    const count = 2 + Math.floor(Math.random() * 3); // 2, 3, or 4
    const shuffled = allWeapons.sort(() => Math.random() - 0.5);
    this.stockedWeapons = [];
    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      this._addOrIncrement(shuffled[i], 1);
      this.stockedWeapons.push(shuffled[i]);
    }
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
    const dayInYear = ((currentDay % 100) + 100) % 100;
    const seasonIndex = Math.floor(dayInYear / 25);
    const currentSeason = ["Winter", "Spring", "Summer", "Fall"][seasonIndex];
    for (const bh of this.bookHolidays) {
      if (bh.bookKey === bookKey && bh.day === dayInYear && bh.season === currentSeason) {
        return bh.discount;
      }
    }
    return 0;
  }

  // === CITY FEATURES (new economy buildings) ===
  generateCityFeatures() {
    this.hasGamblingDen = Math.random() < 0.30;
    this.hasBank        = Math.random() < 0.40;
    this.hasBlackMarket = Math.random() < 0.20;
    this.hasBountyBoard = this.population > 600;
    this.hasWeaponShop  = Math.random() < 0.35;
    if (this.hasWeaponShop) this.stockWeapons();
  }

  /** Returns an array of feature descriptor objects for UI */
  getCityFeatures() {
    const features = [];
    if (this.hasBountyBoard)  features.push({ id: 'bountyBoard',  emoji: '📜', label: 'Bounty Board' });
    if (this.hasBank)         features.push({ id: 'bank',         emoji: '🏦', label: 'Bank' });
    if (this.hasGamblingDen)  features.push({ id: 'gamblingDen',  emoji: '🎲', label: 'Gambling Den' });
    if (this.hasBlackMarket)  features.push({ id: 'blackMarket',  emoji: '🕶️', label: 'Black Market' });
    return features;
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

    // Daily food maintenance: each person needs 0.05 food/day
    const dailyNeed = Math.ceil(currentPop * 0.05);
    this._consumeFood(dailyNeed);

    // Recalculate food after consumption for growth factor
    foodQty = 0;
    for (let item of foodItems) {
      const entry = this.inventory.get(item);
      if (entry) foodQty += entry.quantity;
    }

    // Starvation: if no food, population slowly shrinks
    if (foodQty <= 0 && currentPop > 10) {
      const starvationLoss = Math.max(1, Math.floor(currentPop * 0.02));
      this.population = Math.max(10, currentPop - starvationLoss);
      if (typeof notificationManager !== 'undefined' && this._isManagedCity) {
        notificationManager.log(`⚠️ ${this.name} is starving! Population dropped by ${starvationLoss}.`, 'error');
      }
      return;
    }

    const foodFactor = Math.min(foodQty / Math.max(currentPop * 0.1, 1), 1);
    const overpopPenalty = 1 / (1 + currentPop / 1000);
    const baseGrowth = 0.003;
    const maxBonus = 0.007;
    const growthRate = baseGrowth + maxBonus * foodFactor * overpopPenalty;

    // Use additive growth with a guaranteed minimum of +1 so small cities always grow
    const growthAmount = Math.max(1, Math.round(currentPop * growthRate));
    this.population = currentPop + growthAmount;

    // Population milestone celebrations
    if (this._isManagedCity && typeof notificationManager !== 'undefined') {
      const milestones = [100, 250, 500, 1000, 2500, 5000];
      for (const m of milestones) {
        if (currentPop < m && this.population >= m) {
          notificationManager.log(`Population milestone: ${this.name} reached ${m} citizens!`, 'success');
          window._cityMgmtPopMilestone = { pop: m, ts: Date.now() };
          break;
        }
      }
    }

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
    // Occasional bag stock from traveling merchants
    if (Math.random() < 0.15) this._addOrIncrement("Pouch", 1);
    if (Math.random() < 0.05) this._addOrIncrement("TravelerBag", 1);
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

    // Trader count badge (top-left green dot) — reads O(1) docked counter
    if (this.dockedTraderCount > 0) {
      push();
      fill(60, 180, 80, 220);
      stroke(0, 0, 0, 150);
      strokeWeight(1);
      ellipse(posX + 4, posY + 4, 12, 12);
      fill(255);
      noStroke();
      textAlign(CENTER, CENTER);
      textSize(7);
      text(this.dockedTraderCount, posX + 4, posY + 3);
      pop();
    }

    // Threat indicator (top-right red dot) — spatial grid query, O(visible cells)
    if (typeof raiderGrid !== 'undefined') {
      const THREAT_RADIUS = 8; // tiles
      let nearbyThreats = 0;
      // Expand VP bounds to a city-centred bounding box for the query
      const cxMin = x - THREAT_RADIUS, cxMax = x + THREAT_RADIUS;
      const cyMin = y - THREAT_RADIUS, cyMax = y + THREAT_RADIUS;
      const cs = raiderGrid._cs;
      const minCX = Math.floor(cxMin / cs), maxCX = Math.floor(cxMax / cs);
      const minCY = Math.floor(cyMin / cs), maxCY = Math.floor(cyMax / cs);
      for (let cy = minCY; cy <= maxCY; cy++) {
        for (let cx = minCX; cx <= maxCX; cx++) {
          const cell = raiderGrid._cells.get(`${cx},${cy}`);
          if (cell) {
            for (const r of cell) {
              if (r.state !== 'defeated' &&
                  Math.abs(r.x - x) + Math.abs(r.y - y) <= THREAT_RADIUS) {
                nearbyThreats++;
              }
            }
          }
        }
      }
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
    } else if (typeof raiderManager !== 'undefined') {
      // Fallback when spatial grid not yet available
      const nearbyThreats = raiderManager.getRaiderCountNearCity(this.cityIndex, 8);
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
  calculateItemPrice(itemName, allCities, isSelling = false, opts = {}) {
    const trackHistory = opts.trackHistory !== false;
    const applyDifficultyMultipliers = opts.applyDifficultyMultipliers !== false;

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

    // Apply municipal tax rate: higher tax slightly increases local prices
    const taxRate = (this.management && typeof this.management.taxRate === 'number') ? this.management.taxRate : 0;
    if (taxRate > 0) {
      finalPrice *= (1 + Math.min(0.5, taxRate * 0.5)); // cap tax impact to +25% at extreme
    }

    finalPrice = Math.floor(finalPrice);

    // Track price history once per in-game day per item to avoid UI-frequency drift.
    if (trackHistory) {
      let shouldSample = true;
      if (typeof dayNight !== 'undefined' && dayNight && typeof dayNight.getDaysElapsed === 'function') {
        const today = dayNight.getDaysElapsed();
        if (this._priceHistorySampleDay[itemName] === today) {
          shouldSample = false;
        } else {
          this._priceHistorySampleDay[itemName] = today;
        }
      }
      if (shouldSample) {
        if (!this.priceHistory[itemName]) this.priceHistory[itemName] = [];
        this.priceHistory[itemName].push(finalPrice);
        if (this.priceHistory[itemName].length > 30) this.priceHistory[itemName].shift();
      }
    }

    if (isSelling) {
      const sellMul = applyDifficultyMultipliers
        ? (window.DIFFICULTY_CONFIG?.tradeSellMultiplier ?? 1.0)
        : 1.0;
      finalPrice = Math.floor(finalPrice * 0.8 * sellMul);
    } else if (applyDifficultyMultipliers) {
      const buyMul = window.DIFFICULTY_CONFIG?.tradeBuyMultiplier ?? 1.0;
      finalPrice = Math.floor(finalPrice * buyMul);
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
      reputation: this.reputation,
      hasGamblingDen: this.hasGamblingDen || false,
      hasBank: this.hasBank || false,
      hasBlackMarket: this.hasBlackMarket || false,
      hasBountyBoard: this.hasBountyBoard || false,
      hasWeaponShop: this.hasWeaponShop || false,
      stockedWeapons: this.stockedWeapons || [],
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
    city.hasGamblingDen = data.hasGamblingDen || false;
    city.hasBank = data.hasBank || false;
    city.hasBlackMarket = data.hasBlackMarket || false;
    city.hasBountyBoard = data.hasBountyBoard || false;
    city.hasWeaponShop = data.hasWeaponShop || false;
    city.stockedWeapons = data.stockedWeapons || [];

    // Rebuild inventory from saved quantities
    city.inventory.clear();
    if (data.inventory) {
      for (let [key, qty] of Object.entries(data.inventory)) {
        if (ItemLibrary[key] && qty > 0) {
          city.inventory.set(key, { item: ItemLibrary[key], quantity: qty });
        }
      }
    }

    // Re-stock weapon inventory AFTER inventory rebuild (only missing ones)
    if (city.hasWeaponShop && city.stockedWeapons.length > 0) {
      for (const wk of city.stockedWeapons) {
        if (ItemLibrary[wk] && !city.inventory.has(wk)) {
          city._addOrIncrement(wk, 1);
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
