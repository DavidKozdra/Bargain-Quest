// SmugglingSystem.js — Contraband, black market, inspections, bluff checks

class SmugglingSystem {
  constructor() {
    this.discoveredMarkets = new Set(); // city names with known black markets
    this.smugglingCargo = [];           // { itemName, quantity }
    this.timesInspected = 0;
    this.timesCaught = 0;
    this.totalSmugglingProfit = 0;
    this.marketStocks = {};             // cityName -> { day, items: { itemKey: quantity } }
  }

  /** Check if a city has a black market */
  static cityHasBlackMarket(city) {
    return city && city.hasBlackMarket === true;
  }

  // ─── Discovery ──────────────────────────────────────────

  /** Discover a black market at a city (via event or low reputation) */
  discoverMarket(cityName) {
    if (this.discoveredMarkets.has(cityName)) return false;
    this.discoveredMarkets.add(cityName);
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`\uD83D\uDD75\uFE0F You've found the black market in ${cityName}!`, 'success');
    }
    return true;
  }

  /** Check if player has discovered the black market at a city */
  isMarketDiscovered(cityName) {
    return this.discoveredMarkets.has(cityName);
  }

  /** Auto-discover at low-reputation cities */
  checkAutoDiscovery(city) {
    if (!city || !SmugglingSystem.cityHasBlackMarket(city)) return false;
    if (this.discoveredMarkets.has(city.name)) return false;

    // Low reputation = underground contacts
    if (typeof city.reputation === 'number' && city.reputation < 30) {
      this.discoverMarket(city.name);
      return true;
    }
    return false;
  }

  // ─── Contraband inventory ───────────────────────────────

  /** Contraband items available at black markets */
  static getContrabandCatalog() {
    return {
      ExoticSpices: { name: 'Exotic Spices', buyPrice: 40, sellPrice: 58, risk: 'low', emoji: '\uD83C\uDF3A' },
      ForbiddenTexts: { name: 'Forbidden Texts', buyPrice: 60, sellPrice: 88, risk: 'high', emoji: '\uD83D\uDCD5' },
      SmuggledGems: { name: 'Smuggled Gems', buyPrice: 100, sellPrice: 145, risk: 'very high', emoji: '\uD83D\uDC8E' },
    };
  }

  _currentCityName(cityName = null) {
    return cityName || (typeof player !== 'undefined' ? player.currentCity?.name : null) || null;
  }

  _currentDay() {
    return typeof dayNight !== 'undefined' && typeof dayNight.getDaysElapsed === 'function'
      ? Math.floor(dayNight.getDaysElapsed())
      : 0;
  }

  _marketRoll(cityName, itemKey, day, salt = 0) {
    const input = `${cityName}|${itemKey}|${day}|${salt}`;
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
  }

  _getMarketStock(cityName) {
    if (!cityName) return null;
    const day = this._currentDay();
    let stock = this.marketStocks[cityName];
    if (!stock || stock.day !== day) {
      const items = {};
      for (const itemKey of Object.keys(SmugglingSystem.getContrabandCatalog())) {
        items[itemKey] = 2 + Math.floor(this._marketRoll(cityName, itemKey, day, 1) * 4);
      }
      stock = { day, items };
      this.marketStocks[cityName] = stock;
    }
    return stock;
  }

  getMarketQuote(itemKey, cityName = null) {
    const item = SmugglingSystem.getContrabandCatalog()[itemKey];
    const market = this._currentCityName(cityName);
    if (!item || !market) return null;
    const day = this._currentDay();
    const variation = 0.85 + this._marketRoll(market, itemKey, day, 2) * 0.30;
    const buyPrice = Math.max(1, Math.round(item.buyPrice * variation));
    return {
      buyPrice,
      sellPrice: Math.max(1, Math.floor(buyPrice * 0.82)),
      stock: this._getMarketStock(market).items[itemKey] || 0,
      cityName: market,
    };
  }

  _contrabandWeight() {
    return this.smugglingCargo.reduce((total, cargo) => {
      const weight = typeof ItemLibrary !== 'undefined' ? (ItemLibrary[cargo.itemKey]?.weight || 1) : 1;
      return total + weight * cargo.quantity;
    }, 0);
  }

  /** Buy contraband from black market */
  buyContraband(itemKey, quantity = 1, cityName = null) {
    const catalog = SmugglingSystem.getContrabandCatalog();
    const item = catalog[itemKey];
    const market = this._currentCityName(cityName);
    const quote = this.getMarketQuote(itemKey, market);
    quantity = Math.floor(Number(quantity));
    if (!item || !market || !quote || quantity <= 0) return false;

    if (quote.stock < quantity) {
      if (typeof notificationManager !== 'undefined') notificationManager.log(`Only ${quote.stock} available in ${market}.`, 'warning');
      return false;
    }

    const unitWeight = typeof ItemLibrary !== 'undefined' ? (ItemLibrary[itemKey]?.weight || 1) : 1;
    const used = (typeof player.getCargoWeight === 'function' ? player.getCargoWeight() : 0) + this._contrabandWeight();
    const capacity = typeof player.getEffectiveCargoCapacity === 'function' ? player.getEffectiveCargoCapacity() : (player.cargoCapacity || 50);
    if (used + unitWeight * quantity > capacity) {
      if (typeof notificationManager !== 'undefined') notificationManager.log('Not enough cargo space for that contraband!', 'warning');
      return false;
    }

    const cost = quote.buyPrice * quantity;
    if (player.gold < cost) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('Not enough gold!', 'warning');
      }
      return false;
    }

    player.spendGold(cost);

    // Add to smuggling cargo (separate from normal inventory)
    const existing = this.smugglingCargo.find(c => c.itemKey === itemKey && c.originCity === market && c.unitCost === quote.buyPrice);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.smugglingCargo.push({ itemKey, quantity, originCity: market, unitCost: quote.buyPrice });
    }
    this._getMarketStock(market).items[itemKey] -= quantity;

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Bought ${quantity}× ${item.name} for ${cost}g (contraband!)`, 'warning');
    }
    return true;
  }

  /** Sell contraband at black market */
  sellContraband(itemKey, quantity = 1, cityName = null) {
    const catalog = SmugglingSystem.getContrabandCatalog();
    const item = catalog[itemKey];
    const market = this._currentCityName(cityName);
    const quote = this.getMarketQuote(itemKey, market);
    quantity = Math.floor(Number(quantity));
    if (!item || !market || !quote || quantity <= 0) return false;

    const eligible = this.smugglingCargo.filter(c => c.itemKey === itemKey && (!c.originCity || c.originCity !== market));
    const available = eligible.reduce((sum, cargo) => sum + cargo.quantity, 0);
    if (available < quantity) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(available > 0 ? 'Not enough imported contraband!' : 'This market will not buy back its own contraband.', 'warning');
      }
      return false;
    }

    const gold = quote.sellPrice * quantity;
    let remaining = quantity;
    let cost = 0;
    for (const cargo of eligible) {
      const sold = Math.min(remaining, cargo.quantity);
      cargo.quantity -= sold;
      remaining -= sold;
      cost += sold * (cargo.unitCost || item.buyPrice);
      if (remaining <= 0) break;
    }
    player.earnGold(gold);
    this.smugglingCargo = this.smugglingCargo.filter(c => c.quantity > 0);
    this._getMarketStock(market).items[itemKey] += quantity;

    this.totalSmugglingProfit += (gold - cost);
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Sold ${quantity}× ${item.name} for ${gold}g!`, 'success');
    }
    return true;
  }

  /** Total contraband items currently carried */
  getContrabandCount() {
    return this.smugglingCargo.reduce((s, c) => s + c.quantity, 0);
  }

  // ─── Inspections ────────────────────────────────────────

  /** Calculate inspection chance when entering a city.
   *  Low rep = suspicious stranger = guards watch you closely.
   *  High rep = trusted merchant = guards wave you through.
   */
  getInspectionChance(city) {
    if (this.getContrabandCount() === 0) return 0;
    if (!city) return 0;

    let chance = 0.30; // base 30% for unknown merchant (rep 50)

    // Reputation-based: trusted traders face fewer random inspections
    // Each 10 rep above/below 50 shifts chance by ±4%
    const rep = typeof city.reputation === 'number' ? city.reputation : 50;
    chance -= (rep - 50) * 0.004; // rep 100 → -0.20; rep 0 → +0.20

    // Conflict Resolution book reduces chance
    if (typeof player !== 'undefined' && player.modifiers?.bribeCostReduction > 0) {
      chance -= 0.10;
    }

    // More contraband = harder to hide
    const count = this.getContrabandCount();
    chance += count * 0.04;

    return Math.max(0.05, Math.min(0.80, chance));
  }

  /** Roll for inspection when entering a city. Returns true if inspection triggered. */
  rollInspection(city) {
    const chance = this.getInspectionChance(city);
    if (chance <= 0) return false;
    return Math.random() < chance;
  }

  /** Handle inspection — launches bluff minigame or auto-resolves */
  startInspection(city, onComplete) {
    this.timesInspected++;

    if (typeof minigameManager !== 'undefined' && minigameManager) {
      minigameManager.launch('bluffMeter', { timeLimit: 10 }, (result) => {
        this._resolveInspection(city, result);
        if (onComplete) onComplete(result);
      });
      if (typeof gameStateManager !== 'undefined') {
        gameStateManager.setState(GameStates.MINIGAME);
      }
    } else {
      // Fallback: 50/50
      const result = { success: Math.random() > 0.5 };
      this._resolveInspection(city, result);
      if (onComplete) onComplete(result);
    }
  }

  _resolveInspection(city, result) {
    if (result && result.success) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('\uD83D\uDD75\uFE0F Guard inspection passed! You act natural and walk through.', 'success');
      }
    } else {
      // CAUGHT!
      this.timesCaught++;

      // Confiscate all contraband
      const catalog = SmugglingSystem.getContrabandCatalog();
      let totalValue = 0;
      for (const c of this.smugglingCargo) {
        const item = catalog[c.itemKey];
        if (item) totalValue += item.sellPrice * c.quantity;
      }

      // Fine = 80% of contraband value
      const fine = Math.floor(totalValue * 0.80);
      const actualFine = Math.min(fine, player.gold);
      player.spendGold(actualFine);

      // Clear contraband
      this.smugglingCargo = [];

      // Reputation hit
      if (city && city.adjustReputation) {
        city.adjustReputation(-15);
      }

      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`\uD83D\uDEA8 CAUGHT! Contraband confiscated, fined ${actualFine}g, reputation -15!`, 'error');
      }
    }

    if (typeof gameStateManager !== 'undefined' && gameStateManager.is(GameStates.MINIGAME)) {
      const returnState = (typeof window !== 'undefined' && typeof window.BQGetSurfaceGameplayState === 'function')
        ? window.BQGetSurfaceGameplayState()
        : GameStates.PLAYING;
      gameStateManager.setState(returnState);
    }
  }

  // ─── Serialization ──────────────────────────────────────

  toJSON() {
    return {
      discoveredMarkets: [...this.discoveredMarkets],
      smugglingCargo: this.smugglingCargo,
      timesInspected: this.timesInspected,
      timesCaught: this.timesCaught,
      totalSmugglingProfit: this.totalSmugglingProfit,
      marketStocks: this.marketStocks,
    };
  }

  static fromJSON(data) {
    const ss = new SmugglingSystem();
    ss.discoveredMarkets = new Set(data.discoveredMarkets || []);
    ss.smugglingCargo = data.smugglingCargo || [];
    ss.timesInspected = data.timesInspected || 0;
    ss.timesCaught = data.timesCaught || 0;
    ss.totalSmugglingProfit = data.totalSmugglingProfit || 0;
    ss.marketStocks = data.marketStocks && typeof data.marketStocks === 'object' ? data.marketStocks : {};
    return ss;
  }
}
