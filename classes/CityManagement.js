// CityManagement.js — controller for city-management mode
// Works with existing City objects; adds happiness, food tracking, demand quests,
// victory condition, and per-frame ticking of all cities.

class CityManagement {
  constructor(world) {
    this.world = world || window;
    this.selectedCity = null;       // City object currently being managed (panel open)
    this.selectedCityIndex = -1;

    // Player-becomes-city: two-phase system
    this.myCity = null;             // The player IS this city after settling
    this.myCityIndex = -1;
    this.isSettled = false;         // false = placement phase, true = management phase

    // Demand quests: { cityIndex, itemName, qtyNeeded, qtyDelivered, reward, deadline }
    this.demandQuests = [];
    this._nextQuestDay = 3;         // first quest spawns on day 3
    this._questInterval = 5;        // new quest every ~5 days

    // Victory: richest for N consecutive days
    this.richestStreak = 0;
    this.victoryDays = 10;
    this.won = false;

    // Tracking
    this._lastProcessedDay = -1;
    this._lastWeekDay = -1;

    // Global wealth ranking (recalculated daily)
    this.wealthRanking = [];        // [{name, wealth, isPlayer}]
    this.playerWealth = 0;
  }

  // ─── Settlement (player becomes a city) ────────────────
  /**
   * Settle at the player's current position — player disappears,
   * camera locks to the new city, management begins.
   */
  settleHere(name) {
    const result = this.foundCityAtPlayer(name);
    if (!result.ok) return result;
    this.myCity = result.city;
    this.myCityIndex = this.world.cities.indexOf(result.city);
    this.isSettled = true;
    this.selectCity(this.myCity);
    // Transfer remaining player gold to city budget
    if (this.world.player) {
      this.myCity.management.budget += this.world.player.gold;
      this.world.player.gold = 0;
    }
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`You have settled ${result.city.name}! You are now the city.`, 'success');
    }
    return { ok: true, city: result.city };
  }

  // ─── City selection (walk-up interaction) ───────────────
  /** Select a city for management (opens the side panel) */
  selectCity(city) {
    if (!city) return;
    this.selectedCity = city;
    this.selectedCityIndex = this.world.cities ? this.world.cities.indexOf(city) : -1;
    // ensure management payload
    if (!city.management) {
      city.management = { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [] };
    }
    if (!Array.isArray(city.management.routes)) city.management.routes = [];
  }

  deselectCity() {
    this.selectedCity = null;
    this.selectedCityIndex = -1;
  }

  // ─── Happiness ──────────────────────────────────────────
  /** Compute composite happiness for a city (0-100) */
  getHappiness(city) {
    if (!city) return 50;
    let h = 50;

    // Food supply: +0 to +20
    const foodQty = this._getFoodQty(city);
    const foodRatio = Math.min(foodQty / Math.max(city.population * 0.1, 1), 1);
    h += foodRatio * 20;

    // Tax rate: low = happy, high = unhappy  (-15 to +10)
    const tax = city.management?.taxRate ?? 0.05;
    h += (0.1 - tax) * 100; // 0% tax = +10, 10% = 0, 25% = -15

    // Buildings boost happiness
    if (city.hasBank)        h += 3;
    if (city.hasGamblingDen) h += 2;
    if (city.hasBountyBoard) h += 3;
    if (city.hasWeaponShop)  h += 2;
    if (city.hasBlackMarket) h -= 5; // people dislike black markets

    // Reputation contributes
    h += (city.reputation - 50) * 0.2; // -10 to +10

    // Custom buildings (upgradeLevels) add small boosts
    const upgrades = city.management?.upgradeLevels || {};
    for (const key of Object.keys(upgrades)) {
      h += (upgrades[key] || 0) * 1.5;
    }

    return Math.max(0, Math.min(100, Math.round(h)));
  }

  /** Get happiness tier label */
  getHappinessTier(happiness) {
    if (happiness >= 80) return { label: 'Thriving',  emoji: '😄', color: '#4caf50' };
    if (happiness >= 60) return { label: 'Content',   emoji: '🙂', color: '#8bc34a' };
    if (happiness >= 40) return { label: 'Neutral',   emoji: '😐', color: '#ffc107' };
    if (happiness >= 20) return { label: 'Unhappy',   emoji: '😟', color: '#ff9800' };
    return                       { label: 'Miserable', emoji: '😡', color: '#f44336' };
  }

  // ─── Food ───────────────────────────────────────────────
  _getFoodQty(city) {
    const foodItems = ['Wheat', 'Fish', 'Bread', 'SaltedFish'];
    let total = 0;
    for (const item of foodItems) {
      const e = city.inventory.get(item);
      if (e) total += e.quantity;
    }
    return total;
  }

  getFoodStatus(city) {
    if (!city) return { qty: 0, need: 0, ratio: 0, label: 'N/A' };
    const qty = this._getFoodQty(city);
    const dailyNeed = Math.max(1, Math.ceil(city.population * 0.05));
    const daysLeft = dailyNeed > 0 ? Math.floor(qty / dailyNeed) : 999;
    let label, color;
    if (daysLeft >= 10) { label = 'Abundant'; color = '#4caf50'; }
    else if (daysLeft >= 5) { label = 'Sufficient'; color = '#8bc34a'; }
    else if (daysLeft >= 2) { label = 'Low'; color = '#ff9800'; }
    else { label = 'Starving!'; color = '#f44336'; }
    return { qty, need: dailyNeed, daysLeft, ratio: Math.min(qty / Math.max(dailyNeed, 1), 1), label, color };
  }

  // ─── Tax ────────────────────────────────────────────────
  setTaxRate(city, rate) {
    if (!city) return false;
    city.management = city.management || { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {} };
    const old = city.management.taxRate || 0.05;
    const r = Math.max(0, Math.min(0.5, rate));
    city.management.taxRate = r;
    // reputation impact
    const diff = r - old;
    if (Math.abs(diff) > 0.001) {
      const repDelta = Math.round(-diff * 50);
      if (typeof city.adjustReputation === 'function') city.adjustReputation(repDelta);
    }
    return true;
  }

  // ─── Building ───────────────────────────────────────────
  getBuildOptions(city) {
    if (!city) return [];
    const opts = [];
    if (!city.hasBank)        opts.push({ type: 'bank',        label: 'Bank',         cost: 300, time: 90,  emoji: '🏦', desc: 'Enables banking services' });
    if (!city.hasGamblingDen) opts.push({ type: 'gamblingDen', label: 'Gambling Den',  cost: 200, time: 60,  emoji: '🎲', desc: 'Attracts visitors, some risk' });
    if (!city.hasBountyBoard) opts.push({ type: 'bountyBoard', label: 'Bounty Board',  cost: 150, time: 45,  emoji: '📜', desc: 'Post bounties on raiders' });
    if (!city.hasWeaponShop)  opts.push({ type: 'weaponShop',  label: 'Weapon Shop',   cost: 250, time: 75,  emoji: '⚔️', desc: 'Sell weapons, boost defense' });
    // Removable
    if (city.hasBlackMarket)  opts.push({ type: 'removeBlackMarket', label: 'Remove Black Market', cost: 400, time: 30, emoji: '🚫', desc: 'Makes people happier' });
    // Generic upgrades (repeatable)
    opts.push({ type: 'temple',    label: 'Temple',    cost: 200, time: 60, emoji: '⛪', desc: '+Happiness, +Reputation' });
    opts.push({ type: 'farm',      label: 'Farm',      cost: 150, time: 45, emoji: '🌾', desc: '+Food production' });
    opts.push({ type: 'warehouse', label: 'Warehouse', cost: 180, time: 50, emoji: '📦', desc: '+Storage capacity' });
    opts.push({ type: 'walls',     label: 'Walls',     cost: 350, time: 90, emoji: '🏰', desc: '+Raider defense' });
    return opts;
  }

  enqueueBuild(city, buildingType, cost, buildTime) {
    if (!city || !city.management) return { ok: false, reason: 'no_city' };
    if ((city.management.budget || 0) < cost) return { ok: false, reason: 'no_money' };
    city.management.budget -= cost;

    // Special: removing black market
    if (buildingType === 'removeBlackMarket') {
      city.hasBlackMarket = false;
      if (typeof city.adjustReputation === 'function') city.adjustReputation(5);
      if (typeof notificationManager !== 'undefined') notificationManager.log(`Black market removed from ${city.name}!`, 'success');
      return { ok: true };
    }

    city.management.buildingQueue.push({ type: buildingType, cost, buildTime: buildTime || 60, progress: 0 });
    if (typeof notificationManager !== 'undefined') notificationManager.log(`${city.name}: started building ${buildingType}`, 'info');
    return { ok: true };
  }

  // ─── Expand ─────────────────────────────────────────────
  expandCity(city, cost = 200) {
    if (!city) return { ok: false, reason: 'no_city' };
    city.management = city.management || { budget: 0, buildingQueue: [], upgradeLevels: {}, taxRate: 0.05 };
    if ((city.management.budget || 0) < cost) return { ok: false, reason: 'no_money' };
    city.management.budget -= cost;
    const popGain = Math.floor(city.population * 0.05) + 20;
    city.population += popGain;
    city._addOrIncrement('Wheat', 10);
    city._addOrIncrement('Fish', 6);
    if (typeof notificationManager !== 'undefined') notificationManager.log(`${city.name} expanded (+${popGain} pop).`, 'info');
    return { ok: true, popGain };
  }

  // ─── Found new city ─────────────────────────────────────
  foundCityAtPlayer(name) {
    if (!this.world.player) return { ok: false, reason: 'no_player' };
    const px = this.world.player.x;
    const py = this.world.player.y;
    if (!this.world.grid || !this.world.grid[py] || this.world.grid[py][px].options[0] === 'Water')
      return { ok: false, reason: 'water' };
    if (this.world.cityLocationMap && this.world.cityLocationMap.has(`${px},${py}`))
      return { ok: false, reason: 'occupied' };

    const cost = 500;
    if (this.world.player.gold < cost) return { ok: false, reason: 'no_gold' };
    this.world.player.gold -= cost;

    const cityName = name || `Settlement ${Math.floor(Math.random() * 1000)}`;
    const newCity = new City({ name: cityName, location: { x: px, y: py }, population: 100 });
    newCity.addInventoryBasedOnTerrain(this.world.grid, 1);
    newCity.management = { budget: 100, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [] };

    this.world.cities.push(newCity);
    if (typeof buildCityLocationMap === 'function') buildCityLocationMap();
    if (typeof rebuildSpatialGrids === 'function') rebuildSpatialGrids();
    if (typeof notificationManager !== 'undefined') notificationManager.log(`Founded ${cityName}! (-${cost}g)`, 'success');
    return { ok: true, city: newCity };
  }

  // ─── Trade routes ───────────────────────────────────────
  createTradeRoute(srcCity, destCity, opts = {}) {
    if (!srcCity || !destCity) return { ok: false, reason: 'bad_cities' };
    srcCity.management = srcCity.management || { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [] };
    if (!Array.isArray(srcCity.management.routes)) srcCity.management.routes = [];

    // Check for duplicate
    const destIdx = this.world.cities.indexOf(destCity);
    if (srcCity.management.routes.some(r => r.destIndex === destIdx)) return { ok: false, reason: 'duplicate' };

    const route = {
      destIndex: destIdx,
      frequencyDays: opts.frequencyDays || 7,
      lastTransferDay: -999,
      goldPerTransfer: opts.goldPerTransfer || 50,
      goodsPerTransfer: opts.goodsPerTransfer || 3,
    };
    srcCity.management.routes.push(route);
    if (typeof notificationManager !== 'undefined') notificationManager.log(`Trade route: ${srcCity.name} → ${destCity.name}`, 'success');
    return { ok: true, route };
  }

  removeTradeRoute(city, routeIndex) {
    if (!city?.management?.routes) return;
    city.management.routes.splice(routeIndex, 1);
  }

  _processRoutes(city, day) {
    if (!city.management?.routes) return;
    for (const r of city.management.routes) {
      if (day - (r.lastTransferDay || -999) < r.frequencyDays) continue;
      const dest = this.world.cities?.[r.destIndex];
      if (!dest) continue;
      const keys = [...city.inventory.keys()];
      let moved = 0;
      for (let i = 0; i < (r.goodsPerTransfer || 3) && keys.length > 0; i++) {
        const k = keys.splice(Math.floor(Math.random() * keys.length), 1)[0];
        const entry = city.inventory.get(k);
        if (!entry || entry.quantity <= 0) continue;
        const qty = Math.max(1, Math.floor(entry.quantity * 0.2));
        entry.quantity -= qty;
        if (entry.quantity <= 0) city.inventory.delete(k);
        dest._addOrIncrement(k, qty);
        moved += qty;
      }
      city.management.budget = (city.management.budget || 0) + (r.goldPerTransfer || 0);
      r.lastTransferDay = day;
    }
  }

  // ─── Demand quests ──────────────────────────────────────
  _generateDemandQuest(day) {
    if (!this.world.cities || this.world.cities.length === 0) return;
    const tradeables = ['Fish', 'Wheat', 'Iron', 'Wood', 'Clay', 'Stone', 'Salt', 'Herbs',
                        'Fur', 'Bread', 'Tools', 'Pottery', 'SaltedFish', 'Spices', 'Wine', 'Silk', 'Jewelry'];
    const cityIdx = Math.floor(Math.random() * this.world.cities.length);
    const city = this.world.cities[cityIdx];
    const itemName = tradeables[Math.floor(Math.random() * tradeables.length)];
    const qtyNeeded = 3 + Math.floor(Math.random() * 8);
    const reward = qtyNeeded * (10 + Math.floor(Math.random() * 15));
    const deadline = day + 10 + Math.floor(Math.random() * 10);
    this.demandQuests.push({ cityIndex: cityIdx, cityName: city.name, itemName, qtyNeeded, qtyDelivered: 0, reward, deadline });
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`${city.name} demands ${qtyNeeded}x ${itemName}! Reward: ${reward}g`, 'quest');
    }
  }

  /** Try to fulfill demand quests at a city using city's own inventory */
  fulfillDemandQuests(city) {
    if (!city) return [];
    const cityIdx = this.world.cities.indexOf(city);
    const fulfilled = [];
    for (let i = this.demandQuests.length - 1; i >= 0; i--) {
      const q = this.demandQuests[i];
      if (q.cityIndex !== cityIdx) continue;
      const needed = q.qtyNeeded - q.qtyDelivered;
      if (needed <= 0) continue;
      // In city-management: use the city's own inventory (Map-based)
      const entry = city.inventory.get(q.itemName);
      if (!entry || entry.quantity <= 0) continue;
      const deliver = Math.min(needed, entry.quantity);
      entry.quantity -= deliver;
      if (entry.quantity <= 0) city.inventory.delete(q.itemName);
      q.qtyDelivered += deliver;
      if (q.qtyDelivered >= q.qtyNeeded) {
        // Quest complete! Reward goes into city budget
        if (city.management) city.management.budget = (city.management.budget || 0) + q.reward;
        if (typeof city.adjustReputation === 'function') city.adjustReputation(5);
        if (typeof notificationManager !== 'undefined') notificationManager.log(`Quest complete! +${q.reward}g — ${city.name} supplied ${q.itemName}`, 'success');
        fulfilled.push(q);
        this.demandQuests.splice(i, 1);
      }
    }
    return fulfilled;
  }

  // ─── Victory tracking ──────────────────────────────────
  _updateWealthRanking() {
    const ranking = [];

    // "Player" wealth is now myCity's wealth (budget + inventory value)
    let myCityWealth = 0;
    if (this.myCity) {
      myCityWealth += this.myCity.management?.budget || 0;
      for (const [key, entry] of this.myCity.inventory) {
        myCityWealth += (entry.quantity || 0) * (ItemLibrary[key]?.basePrice || 5);
      }
    } else {
      // Fallback before settling: use player gold
      myCityWealth = this.world.player?.gold || 0;
    }
    this.playerWealth = myCityWealth;
    const myName = this.myCity?.name || this.world.player?.captainName || 'You';
    ranking.push({ name: myName, wealth: myCityWealth, isPlayer: true });

    // Each OTHER city's wealth: budget + inventory value
    if (this.world.cities) {
      for (const c of this.world.cities) {
        if (c === this.myCity) continue; // already counted above
        let w = c.management?.budget || 0;
        for (const [key, entry] of c.inventory) {
          w += (entry.quantity || 0) * (ItemLibrary[key]?.basePrice || 5);
        }
        ranking.push({ name: c.name, wealth: w, isPlayer: false });
      }
    }

    ranking.sort((a, b) => b.wealth - a.wealth);
    this.wealthRanking = ranking;

    // Check if player is #1
    if (ranking.length > 0 && ranking[0].isPlayer) {
      this.richestStreak++;
      if (this.richestStreak >= this.victoryDays && !this.won) {
        this.won = true;
        if (typeof notificationManager !== 'undefined') notificationManager.log(`VICTORY! You've been the richest for ${this.victoryDays} days!`, 'success');
        if (typeof gameStateManager !== 'undefined') gameStateManager.setState(GameStates.GAMEWON);
      }
    } else {
      this.richestStreak = 0;
    }
  }

  // ─── Main tick (called every frame from draw) ──────────
  tick(dt) {
    if (!this.world.cities) return;
    const day = (typeof dayNight !== 'undefined' && dayNight.getDaysElapsed) ? dayNight.getDaysElapsed() : 0;

    // Per-frame: tick all city build queues
    for (const c of this.world.cities) {
      if (typeof c.tickManagement === 'function') c.tickManagement(dt);
    }

    // Daily processing (once per day)
    if (day !== this._lastProcessedDay && day > 0) {
      this._lastProcessedDay = day;

      // Update wealth ranking & victory check
      this._updateWealthRanking();

      // Spawn demand quests periodically
      if (day >= this._nextQuestDay) {
        this._generateDemandQuest(day);
        this._nextQuestDay = day + this._questInterval + Math.floor(Math.random() * 3);
      }

      // Expire old quests
      for (let i = this.demandQuests.length - 1; i >= 0; i--) {
        if (this.demandQuests[i].deadline <= day) {
          const q = this.demandQuests[i];
          if (typeof notificationManager !== 'undefined') notificationManager.log(`Quest expired: ${q.cityName} no longer needs ${q.itemName}`, 'error');
          this.demandQuests.splice(i, 1);
        }
      }
    }

    // Weekly processing
    const weekDay = Math.floor(day / 7);
    if (weekDay !== this._lastWeekDay && day > 0) {
      this._lastWeekDay = weekDay;
      for (const c of this.world.cities) {
        if (typeof c.applyWeeklyTax === 'function') c.applyWeeklyTax();
        this._processRoutes(c, day);
      }
    }
  }

  // ─── Serialization ──────────────────────────────────────
  toJSON() {
    return {
      selectedCityIndex: this.selectedCityIndex,
      myCityIndex: this.myCityIndex,
      isSettled: this.isSettled,
      demandQuests: this.demandQuests,
      richestStreak: this.richestStreak,
      _nextQuestDay: this._nextQuestDay,
      _lastProcessedDay: this._lastProcessedDay,
      _lastWeekDay: this._lastWeekDay,
    };
  }

  static fromJSON(obj, world) {
    const cm = new CityManagement(world);
    if (!obj) return cm;
    cm.demandQuests = obj.demandQuests || [];
    cm.richestStreak = obj.richestStreak || 0;
    cm._nextQuestDay = obj._nextQuestDay || 3;
    cm._lastProcessedDay = obj._lastProcessedDay || -1;
    cm._lastWeekDay = obj._lastWeekDay || -1;
    // Restore settlement
    if (obj.isSettled && typeof obj.myCityIndex === 'number' && obj.myCityIndex >= 0 && world.cities?.[obj.myCityIndex]) {
      cm.myCity = world.cities[obj.myCityIndex];
      cm.myCityIndex = obj.myCityIndex;
      cm.isSettled = true;
      cm.selectCity(cm.myCity);
    } else if (typeof obj.selectedCityIndex === 'number' && obj.selectedCityIndex >= 0 && world.cities?.[obj.selectedCityIndex]) {
      cm.selectCity(world.cities[obj.selectedCityIndex]);
    }
    return cm;
  }
}

window.CityManagement = CityManagement;
