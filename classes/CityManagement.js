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

    // City events
    this._activeCityEvent = null;
    this._nextEventDay = 5;         // first event on day 5

    // Global wealth ranking (recalculated daily)
    this.wealthRanking = [];        // [{name, wealth, isPlayer}]
    this.playerWealth = 0;
  }

  // ─── Settlement (player becomes a city) ────────────────
  /**
   * Settle at the player's current position — player disappears,
   * camera locks to the new city, management begins.
   */
  /**
   * Settle at a specific grid location — player disappears,
   * camera locks to the new city, management begins.
   * @param {number} gx - grid X coordinate
   * @param {number} gy - grid Y coordinate
   * @param {string} [name] - optional city name
   */
  settleAt(gx, gy, name) {
    const result = this.foundCityAt(gx, gy, name);
    if (!result.ok) return result;
    this.myCity = result.city;
    this.myCityIndex = this.world.cities.indexOf(result.city);
    this.isSettled = true;
    this.selectCity(this.myCity);
    // Give the city its starting budget and food stockpile
    const startingBudget = window._cityMgmtStartingBudget || 600;
    this.myCity.management.budget += startingBudget;
    window._cityMgmtStartingBudget = 0;
    // Ensure a comfortable starting food supply (30 days at 100 pop)
    this.myCity._addOrIncrement('Wheat', 80);
    this.myCity._addOrIncrement('Fish', 40);
    this.myCity._isManagedCity = true;
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`You have settled ${result.city.name}! You are now the city.`, 'success');
    }
    // Mark player as being in this city to suppress player-targeted combat
    try {
      if (this.world && this.world.player) this.world.player.currentCity = this.myCity;
    } catch (e) {}
    return { ok: true, city: result.city };
  }

  /** Legacy wrapper — settle at the player's current position */
  settleHere(name) {
    if (!this.world.player) return { ok: false, reason: 'no_player' };
    return this.settleAt(this.world.player.x, this.world.player.y, name);
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
  /**
   * Found a city at specific grid coordinates.
   * Does NOT require a player — cost comes from city budget or starting budget.
   * @param {number} gx - grid X coordinate
   * @param {number} gy - grid Y coordinate
   * @param {string} [name] - optional city name
   * @param {number} [budget=0] - budget to deduct from (0 = free for initial settle)
   */
  foundCityAt(gx, gy, name, budget) {
    if (!this.world.grid || !this.world.grid[gy] || !this.world.grid[gy][gx])
      return { ok: false, reason: 'out_of_bounds' };
    if (this.world.grid[gy][gx].options[0] === 'Water')
      return { ok: false, reason: 'water' };
    if (this.world.cityLocationMap && this.world.cityLocationMap.has(`${gx},${gy}`))
      return { ok: false, reason: 'occupied' };

    const cityName = name || `Settlement ${Math.floor(Math.random() * 1000)}`;
    const newCity = new City({ name: cityName, location: { x: gx, y: gy }, population: 100 });
    newCity.addInventoryBasedOnTerrain(this.world.grid, 1);
    newCity.management = { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [] };

    this.world.cities.push(newCity);
    if (typeof buildCityLocationMap === 'function') buildCityLocationMap();
    if (typeof rebuildSpatialGrids === 'function') rebuildSpatialGrids();
    if (typeof notificationManager !== 'undefined') notificationManager.log(`Founded ${cityName}!`, 'success');
    return { ok: true, city: newCity };
  }

  /** Legacy wrapper — found a city at the player's current position (500g from player gold) */
  foundCityAtPlayer(name) {
    if (!this.world.player) return { ok: false, reason: 'no_player' };
    const cost = 500;
    if (this.world.player.gold < cost) return { ok: false, reason: 'no_gold' };
    this.world.player.gold -= cost;
    const result = this.foundCityAt(this.world.player.x, this.world.player.y, name);
    if (!result.ok) {
      // Refund on failure
      this.world.player.gold += cost;
    }
    return result;
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
      goldPerTransfer: opts.goldPerTransfer || 0,
      goodsPerTransfer: opts.goodsPerTransfer || 5,
      itemsToSend: Array.isArray(opts.itemsToSend) ? opts.itemsToSend : [], // [] = all items (random)
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
      const dest = this.world.cities?.[r.destIndex];
      if (!dest) continue;

      // Daily processing: distribute route transfers across the route's frequencyDays
      const freq = r.frequencyDays || 7;
      const goodsPerTransfer = r.goodsPerTransfer || 3;
      const goldPerTransfer = r.goldPerTransfer || 50;

      const perDayGoods = Math.max(1, Math.floor(goodsPerTransfer / Math.max(1, freq)));
      const perDayGold = Math.max(0, Math.floor(goldPerTransfer / Math.max(1, freq)));

      // Prefer player-specified items; fall back to random if none configured or unavailable
      let candidateKeys;
      if (r.itemsToSend && r.itemsToSend.length > 0) {
        candidateKeys = r.itemsToSend.filter(k => {
          const e = city.inventory.get(k);
          return e && e.quantity > 0;
        });
      }
      if (!candidateKeys || candidateKeys.length === 0) {
        candidateKeys = [...city.inventory.keys()];
      }

      let moved = 0;
      const perItem = Math.ceil(perDayGoods / Math.max(1, candidateKeys.length));
      for (const k of candidateKeys) {
        const entry = city.inventory.get(k);
        if (!entry || entry.quantity <= 0) continue;
        const qty = Math.min(entry.quantity, Math.max(1, perItem));
        entry.quantity -= qty;
        if (entry.quantity <= 0) city.inventory.delete(k);
        dest._addOrIncrement(k, qty);
        moved += qty;
      }

      city.management.budget = (city.management.budget || 0) + perDayGold;
      // Note: keep lastTransferDay for compatibility but don't gate daily fractional transfers
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
    if (!city) return;
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
        myCityWealth += (entry.quantity || 0) * (ItemLibrary[key]?.baseValue || 5);
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
          w += (entry.quantity || 0) * (ItemLibrary[key]?.baseValue || 5);
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

  // ─── City Events (periodic random events for settled cities) ──────
  _initCityEvents() {
    return [
      {
        name: 'Drought',
        emoji: '☀️',
        description: 'A severe drought strikes! Your crops wither and food supplies dwindle.',
        weight: 1,
        resolve: (city, choice) => {
          if (choice === 0) {
            // Ration food: lose some food but preserve happiness
            const food = this._getFoodQty(city);
            const loss = Math.max(1, Math.floor(food * 0.3));
            this._removeFoodFromCity(city, loss);
            return { message: `Rationed food — lost ${loss} units, but people understand.`, type: 'warning' };
          } else {
            // Ignore: lose more food AND happiness drops
            const food = this._getFoodQty(city);
            const loss = Math.max(2, Math.floor(food * 0.5));
            this._removeFoodFromCity(city, loss);
            if (typeof city.adjustReputation === 'function') city.adjustReputation(-5);
            return { message: `Ignored the drought — lost ${loss} food and people are angry!`, type: 'error' };
          }
        },
        choices: ['Ration supplies (lose 30% food)', 'Ignore it (lose 50% food, -reputation)'],
        timeLimit: 15,
        worstChoice: 1,
      },
      {
        name: 'Plague',
        emoji: '🦠',
        description: 'A mysterious sickness spreads through the city! People are falling ill.',
        weight: 1,
        resolve: (city, choice) => {
          if (choice === 0) {
            // Quarantine: lose some population but contain it
            const loss = Math.max(5, Math.floor(city.population * 0.05));
            city.population = Math.max(10, city.population - loss);
            return { message: `Quarantine enforced — lost ${loss} citizens, but the plague is contained.`, type: 'warning' };
          } else {
            // Spend gold on medicine
            const cost = Math.floor(city.population * 0.5);
            if ((city.management?.budget || 0) >= cost) {
              city.management.budget -= cost;
              return { message: `Spent ${cost}g on medicine — plague cured quickly!`, type: 'success' };
            } else {
              const loss = Math.max(10, Math.floor(city.population * 0.1));
              city.population = Math.max(10, city.population - loss);
              return { message: `Not enough gold for medicine! Lost ${loss} citizens.`, type: 'error' };
            }
          }
        },
        choices: ['Enforce quarantine (lose ~5% pop)', 'Buy medicine (costs gold)'],
        timeLimit: 12,
        worstChoice: 0,
      },
      {
        name: 'Trade Caravan',
        emoji: '🐪',
        description: 'A wealthy trade caravan passes through and offers to trade!',
        weight: 2,
        resolve: (city, choice) => {
          if (choice === 0) {
            // Welcome them: gain gold and goods
            const goldGain = 50 + Math.floor(Math.random() * 100);
            city.management.budget = (city.management?.budget || 0) + goldGain;
            city._addOrIncrement('Spices', 2 + Math.floor(Math.random() * 3));
            city._addOrIncrement('Silk', 1 + Math.floor(Math.random() * 2));
            if (typeof city.adjustReputation === 'function') city.adjustReputation(3);
            return { message: `Welcomed the caravan! +${goldGain}g and exotic goods!`, type: 'success' };
          } else {
            // Tax them heavily
            const goldGain = 100 + Math.floor(Math.random() * 150);
            city.management.budget = (city.management?.budget || 0) + goldGain;
            if (typeof city.adjustReputation === 'function') city.adjustReputation(-5);
            return { message: `Taxed the caravan heavily! +${goldGain}g but traders won't return soon.`, type: 'warning' };
          }
        },
        choices: ['Welcome them warmly (+goods, +reputation)', 'Tax them heavily (+more gold, -reputation)'],
        timeLimit: 20,
        worstChoice: 1,
      },
      {
        name: 'Festival',
        emoji: '🎉',
        description: 'The citizens want to hold a festival! Should you fund it?',
        weight: 2,
        resolve: (city, choice) => {
          if (choice === 0) {
            const cost = 80 + Math.floor(city.population * 0.3);
            if ((city.management?.budget || 0) >= cost) {
              city.management.budget -= cost;
              if (typeof city.adjustReputation === 'function') city.adjustReputation(8);
              city.population += Math.floor(city.population * 0.03) + 5;
              return { message: `Festival was a success! -${cost}g, +reputation, +population!`, type: 'success' };
            } else {
              return { message: `Can't afford the festival (${cost}g needed). People are disappointed.`, type: 'warning' };
            }
          } else {
            if (typeof city.adjustReputation === 'function') city.adjustReputation(-3);
            return { message: `You declined the festival. People are a bit disappointed.`, type: 'warning' };
          }
        },
        choices: ['Fund the festival (costs gold)', 'Decline (slight reputation loss)'],
        timeLimit: 20,
        worstChoice: 1,
      },
      {
        name: 'Fire!',
        emoji: '🔥',
        description: 'A fire has broken out in the city! Buildings are at risk!',
        weight: 1,
        resolve: (city, choice) => {
          if (choice === 0) {
            // Organize bucket brigade: spend gold, save buildings
            const cost = 50 + Math.floor(Math.random() * 50);
            if ((city.management?.budget || 0) >= cost) {
              city.management.budget -= cost;
              return { message: `Fire contained! Spent ${cost}g organizing the response.`, type: 'success' };
            } else {
              // Can't afford — damage a building
              const bq = city.management?.buildingQueue || [];
              if (bq.length > 0) {
                bq[0].progress = Math.max(0, (bq[0].progress || 0) - 20);
                return { message: `Couldn't afford firefighting! A construction project was damaged.`, type: 'error' };
              }
              return { message: `No gold for firefighting — luckily damage was minor.`, type: 'warning' };
            }
          } else {
            // Evacuate: lose some population but no gold cost
            const loss = Math.max(3, Math.floor(city.population * 0.02));
            city.population = Math.max(10, city.population - loss);
            return { message: `Evacuated the area — ${loss} people left the city.`, type: 'warning' };
          }
        },
        choices: ['Fight the fire (costs gold)', 'Evacuate the area (lose some population)'],
        timeLimit: 10,
        worstChoice: 1,
      },
      {
        name: 'Refugee Arrival',
        emoji: '🚶',
        description: 'A group of refugees arrives seeking shelter in your city.',
        weight: 2,
        resolve: (city, choice) => {
          if (choice === 0) {
            const popGain = 10 + Math.floor(Math.random() * 15);
            city.population += popGain;
            if (typeof city.adjustReputation === 'function') city.adjustReputation(5);
            return { message: `Welcomed ${popGain} refugees! Population and reputation grew.`, type: 'success' };
          } else {
            if (typeof city.adjustReputation === 'function') city.adjustReputation(-3);
            return { message: `Turned the refugees away. People question your compassion.`, type: 'warning' };
          }
        },
        choices: ['Welcome them (+population, +reputation)', 'Turn them away (-reputation)'],
        timeLimit: 15,
        worstChoice: 1,
      },
      {
        name: 'Mine Discovery',
        emoji: '⛏️',
        description: 'Workers discovered a rich mineral vein near the city!',
        weight: 1,
        minDay: 5,
        resolve: (city, choice) => {
          if (choice === 0) {
            const cost = 150;
            if ((city.management?.budget || 0) >= cost) {
              city.management.budget -= cost;
              city._addOrIncrement('Iron', 8 + Math.floor(Math.random() * 6));
              city._addOrIncrement('Stone', 5 + Math.floor(Math.random() * 4));
              if (Math.random() < 0.3) city._addOrIncrement('Gems', 1 + Math.floor(Math.random() * 2));
              return { message: `Invested ${cost}g in the mine — rich resources extracted!`, type: 'success' };
            }
            return { message: `Can't afford to develop the mine (${cost}g needed).`, type: 'warning' };
          } else {
            city._addOrIncrement('Iron', 3);
            city._addOrIncrement('Stone', 2);
            return { message: `Collected some surface minerals without investment.`, type: 'info' };
          }
        },
        choices: ['Invest in mining (150g for lots of resources)', 'Collect surface minerals (free, less yield)'],
        timeLimit: 20,
        worstChoice: 1,
      },
      {
        name: 'Merchant Guild Offer',
        emoji: '💼',
        description: 'The Merchant Guild offers to set up a branch in your city — for a fee.',
        weight: 1,
        minDay: 8,
        resolve: (city, choice) => {
          if (choice === 0) {
            const cost = 200;
            if ((city.management?.budget || 0) >= cost) {
              city.management.budget -= cost;
              // Boost weekly tax income via reputation
              if (typeof city.adjustReputation === 'function') city.adjustReputation(10);
              return { message: `Merchant Guild established! -${cost}g, big reputation boost!`, type: 'success' };
            }
            return { message: `Can't afford the Merchant Guild fee (${cost}g).`, type: 'warning' };
          } else {
            return { message: `Declined the Merchant Guild's offer.`, type: 'info' };
          }
        },
        choices: ['Accept (200g, +big reputation)', 'Decline (no cost)'],
        timeLimit: 20,
        worstChoice: 1,
      },
    ];
  }

  /** Remove food items from a city's inventory */
  _removeFoodFromCity(city, amount) {
    const foodItems = ['Wheat', 'Fish', 'Bread', 'SaltedFish'];
    let remaining = amount;
    for (const item of foodItems) {
      if (remaining <= 0) break;
      const e = city.inventory.get(item);
      if (!e || e.quantity <= 0) continue;
      const take = Math.min(remaining, e.quantity);
      e.quantity -= take;
      if (e.quantity <= 0) city.inventory.delete(item);
      remaining -= take;
    }
  }

  /** Trigger a random city event for the player's city */
  _triggerCityEvent(day) {
    if (!this.myCity || !this.isSettled) return;
    if (this._activeCityEvent) return; // one at a time

    const events = this._initCityEvents();
    const eligible = events.filter(e => {
      if (e.minDay && day < e.minDay) return false;
      return true;
    });
    if (eligible.length === 0) return;

    // Weighted random selection
    const totalWeight = eligible.reduce((s, e) => s + (e.weight || 1), 0);
    let roll = Math.random() * totalWeight;
    let chosen = eligible[0];
    for (const e of eligible) {
      roll -= (e.weight || 1);
      if (roll <= 0) { chosen = e; break; }
    }

    this._activeCityEvent = {
      ...chosen,
      triggered: day,
      deadline: chosen.timeLimit ? Date.now() + chosen.timeLimit * 1000 : 0,
    };

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`${chosen.emoji} City Event: ${chosen.name}!`, 'quest');
    }
    // Transition to the global random event view so the player sees and
    // resolves the city event using the shared event UI.
    if (typeof gameStateManager !== 'undefined' && typeof GameStates !== 'undefined') {
      // Expose the active city event for the UI to consume
      window._cityEventActive = this._activeCityEvent;
      gameStateManager.setState(GameStates.RANDOM_EVENT);
    }
  }

  /** Resolve the active city event with the player's choice */
  resolveCityEvent(choiceIndex) {
    if (!this._activeCityEvent || !this.myCity) return null;
    const evt = this._activeCityEvent;
    const result = evt.resolve(this.myCity, choiceIndex);
    this._activeCityEvent = null;
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(result.message, result.type || 'info');
    }
    return result;
  }

  /** Auto-resolve event if timer expires */
  _checkCityEventTimeout() {
    if (!this._activeCityEvent) return;
    if (this._activeCityEvent.deadline && Date.now() > this._activeCityEvent.deadline) {
      const worst = this._activeCityEvent.worstChoice ?? this._activeCityEvent.choices.length - 1;
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`⏰ You hesitated too long!`, 'error');
      }
      this.resolveCityEvent(worst);
    }
  }

  // ─── Resource Gathering (terrain minigames) ─────────────
  /**
   * Get available resource gathering options based on terrain around myCity.
   * Returns array of { terrain, minigame, label, emoji, resources }
   */
  getGatherOptions() {
    if (!this.myCity || !this.isSettled) return [];
    const loc = this.myCity.location;
    const g = this.world.grid;
    if (!g) return [];

    const terrainCounts = { Water: 0, Grass: 0, Rock: 0, Forest: 0, Sand: 0, Snow: 0 };
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = loc.x + dx;
        const ny = loc.y + dy;
        if (ny >= 0 && ny < (this.world.rows || 100) && nx >= 0 && nx < (this.world.cols || 100)) {
          const tile = g[ny]?.[nx];
          if (tile && tile.options && terrainCounts[tile.options[0]] !== undefined) {
            terrainCounts[tile.options[0]]++;
          }
        }
      }
    }

    const options = [];
    if (terrainCounts.Water > 0) options.push({
      terrain: 'Water', minigame: 'fishing', label: 'Go Fishing', emoji: '🎣',
      resources: [{ item: 'Fish', base: terrainCounts.Water }, { item: 'Salt', base: Math.floor(terrainCounts.Water / 3) }],
    });
    if (terrainCounts.Rock > 0) options.push({
      terrain: 'Rock', minigame: 'mining', label: 'Mine Ore', emoji: '⛏️',
      resources: [{ item: 'Iron', base: terrainCounts.Rock }, { item: 'Stone', base: Math.floor(terrainCounts.Rock / 2) }],
    });
    if (terrainCounts.Grass > 0) options.push({
      terrain: 'Grass', minigame: 'harvesting', label: 'Harvest Crops', emoji: '🌾',
      resources: [{ item: 'Wheat', base: terrainCounts.Grass }, { item: 'Herbs', base: Math.floor(terrainCounts.Grass / 3) }],
    });
    if (terrainCounts.Forest > 0) options.push({
      terrain: 'Forest', minigame: 'woodcutting', label: 'Chop Wood', emoji: '🪓',
      resources: [{ item: 'Wood', base: terrainCounts.Forest }, { item: 'Fur', base: Math.floor(terrainCounts.Forest / 3) }],
    });
    if (terrainCounts.Sand > 0) options.push({
      terrain: 'Sand', minigame: 'sandDig', label: 'Dig for Treasure', emoji: '⏳',
      resources: [{ item: 'Clay', base: terrainCounts.Sand }, { item: 'Gems', base: Math.max(1, Math.floor(terrainCounts.Sand / 4)) }],
    });
    if (terrainCounts.Snow > 0) options.push({
      terrain: 'Snow', minigame: 'fishing', label: 'Ice Fishing', emoji: '🧊',
      resources: [{ item: 'Fur', base: terrainCounts.Snow }, { item: 'Fish', base: Math.floor(terrainCounts.Snow / 2) }],
    });
    return options;
  }

  /**
   * Launch a resource gathering minigame. On completion, awards resources to the city.
   * @param {object} gatherOpt - from getGatherOptions()
   */
  launchGathering(gatherOpt) {
    if (!this.myCity || !gatherOpt) return;
    if (typeof minigameManager === 'undefined' || !minigameManager) return;
    if (typeof gameStateManager === 'undefined') return;

    const city = this.myCity;
    minigameManager.launch(gatherOpt.minigame, {}, (result) => {
      if (!result || !result.success) {
        if (typeof notificationManager !== 'undefined')
          notificationManager.log('Gathering failed — no resources collected.', 'warning');
        gameStateManager.setState(GameStates.CITY_MANAGE);
        return;
      }

      // Calculate yield based on minigame performance
      let perfMultiplier = 1;
      if (result.caught !== undefined) perfMultiplier = result.caught / Math.max(1, result.total);
      else if (result.hits !== undefined) perfMultiplier = result.hits / Math.max(1, result.total);
      else if (result.collected !== undefined) perfMultiplier = result.collected / Math.max(1, result.collected + result.missed);
      else if (result.goodChops !== undefined) perfMultiplier = result.goodChops / Math.max(1, result.total);
      else if (result.found !== undefined) perfMultiplier = result.found / Math.max(1, result.total);
      perfMultiplier = Math.max(0.2, perfMultiplier); // minimum 20% yield

      const gained = [];
      for (const r of gatherOpt.resources) {
        const qty = Math.max(1, Math.round(r.base * perfMultiplier * (1 + Math.random() * 0.5)));
        city._addOrIncrement(r.item, qty);
        gained.push(`${r.item} ×${qty}`);
      }

      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Gathered: ${gained.join(', ')}!`, 'success');
      }
      gameStateManager.setState(GameStates.CITY_MANAGE);
    });

    gameStateManager.setState(GameStates.MINIGAME);
  }

  // ─── Main tick (called every frame from draw) ──────────
  tick(dt) {
    if (!this.world.cities) return;
    const day = (typeof dayNight !== 'undefined' && dayNight.getDaysElapsed) ? dayNight.getDaysElapsed() : 0;

    // Per-frame: tick all city build queues
    for (const c of this.world.cities) {
      if (typeof c.tickManagement === 'function') c.tickManagement(dt);
    }

    // Check city event timeout every frame
    this._checkCityEventTimeout();

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

      // Trigger random city events (every 5-10 days once settled)
      if (this.isSettled && day >= this._nextEventDay) {
        this._triggerCityEvent(day);
        this._nextEventDay = day + 5 + Math.floor(Math.random() * 6);
      }
      // Daily tax + route processing (previously weekly)
      for (const c of this.world.cities) {
        if (typeof c.applyWeeklyTax === 'function') c.applyWeeklyTax(1); // apply 1 day worth
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
      won: this.won,
      _nextQuestDay: this._nextQuestDay,
      _nextEventDay: this._nextEventDay,
      _lastProcessedDay: this._lastProcessedDay,
      _lastWeekDay: this._lastWeekDay,
    };
  }

  static fromJSON(obj, world) {
    const cm = new CityManagement(world);
    if (!obj) return cm;
    cm.demandQuests = obj.demandQuests || [];
    cm.richestStreak = obj.richestStreak || 0;
    cm.won = obj.won || false;
    cm._nextQuestDay = obj._nextQuestDay || 3;
    cm._nextEventDay = obj._nextEventDay || 5;
    cm._lastProcessedDay = obj._lastProcessedDay || -1;
    cm._lastWeekDay = obj._lastWeekDay || -1;
    // Restore settlement
    if (obj.isSettled && typeof obj.myCityIndex === 'number' && obj.myCityIndex >= 0 && world.cities?.[obj.myCityIndex]) {
      cm.myCity = world.cities[obj.myCityIndex];
      cm.myCityIndex = obj.myCityIndex;
      cm.isSettled = true;
      cm.myCity._isManagedCity = true;
      cm.selectCity(cm.myCity);
    } else if (typeof obj.selectedCityIndex === 'number' && obj.selectedCityIndex >= 0 && world.cities?.[obj.selectedCityIndex]) {
      cm.selectCity(world.cities[obj.selectedCityIndex]);
    }
    return cm;
  }
}

window.CityManagement = CityManagement;
