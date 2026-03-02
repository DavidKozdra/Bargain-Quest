// SmugglingSystem.js — Contraband, black market, inspections, bluff checks

class SmugglingSystem {
  constructor() {
    this.discoveredMarkets = new Set(); // city names with known black markets
    this.smugglingCargo = [];           // { itemName, quantity }
    this.timesInspected = 0;
    this.timesCaught = 0;
    this.totalSmugglingProfit = 0;
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
      notificationManager.log(`🕵️ You've found the black market in ${cityName}!`, 'success');
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
      StolenGoods: { name: 'Stolen Goods', buyPrice: 25, sellPrice: 38, risk: 'medium', emoji: '🎭' },
      ExoticSpices: { name: 'Exotic Spices', buyPrice: 40, sellPrice: 58, risk: 'low', emoji: '🌺' },
      ForbiddenTexts: { name: 'Forbidden Texts', buyPrice: 60, sellPrice: 88, risk: 'high', emoji: '📕' },
      SmuggledGems: { name: 'Smuggled Gems', buyPrice: 100, sellPrice: 145, risk: 'very high', emoji: '💎' },
    };
  }

  /** Buy contraband from black market */
  buyContraband(itemKey, quantity = 1) {
    const catalog = SmugglingSystem.getContrabandCatalog();
    const item = catalog[itemKey];
    if (!item) return false;

    const cost = item.buyPrice * quantity;
    if (player.gold < cost) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('Not enough gold!', 'warning');
      }
      return false;
    }

    player.spendGold(cost);

    // Add to smuggling cargo (separate from normal inventory)
    const existing = this.smugglingCargo.find(c => c.itemKey === itemKey);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.smugglingCargo.push({ itemKey, quantity });
    }

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Bought ${quantity}× ${item.name} for ${cost}g (contraband!)`, 'warning');
    }
    return true;
  }

  /** Sell contraband at black market */
  sellContraband(itemKey, quantity = 1) {
    const catalog = SmugglingSystem.getContrabandCatalog();
    const item = catalog[itemKey];
    if (!item) return false;

    const existing = this.smugglingCargo.find(c => c.itemKey === itemKey);
    if (!existing || existing.quantity < quantity) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('You don\'t have enough of that!', 'warning');
      }
      return false;
    }

    const gold = item.sellPrice * quantity;
    player.earnGold(gold);
    existing.quantity -= quantity;
    if (existing.quantity <= 0) {
      this.smugglingCargo = this.smugglingCargo.filter(c => c.quantity > 0);
    }

    this.totalSmugglingProfit += gold;
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

  /** Calculate inspection chance when entering a city. Higher rep = MORE scrutiny for contraband. */
  getInspectionChance(city) {
    if (this.getContrabandCount() === 0) return 0;
    if (!city) return 0;

    let chance = 0.15; // base 15%

    // Reputation-based: well-known = more watched
    const rep = typeof city.reputation === 'number' ? city.reputation : 50;
    const repTier = Math.floor(rep / 20); // 0-5
    chance += repTier * 0.05;

    // Conflict Resolution book reduces chance
    if (typeof player !== 'undefined' && player.modifiers?.bribeCostReduction > 0) {
      chance -= 0.10;
    }

    // More contraband = higher chance
    const count = this.getContrabandCount();
    chance += count * 0.03;

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

    if (typeof minigameManager !== 'undefined') {
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
        notificationManager.log('🕵️ Guard inspection passed! You act natural and walk through.', 'success');
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
        notificationManager.log(`🚨 CAUGHT! Contraband confiscated, fined ${actualFine}g, reputation -15!`, 'error');
      }
    }

    if (typeof gameStateManager !== 'undefined' && gameStateManager.is(GameStates.MINIGAME)) {
      gameStateManager.setState(GameStates.PLAYING);
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
    };
  }

  static fromJSON(data) {
    const ss = new SmugglingSystem();
    ss.discoveredMarkets = new Set(data.discoveredMarkets || []);
    ss.smugglingCargo = data.smugglingCargo || [];
    ss.timesInspected = data.timesInspected || 0;
    ss.timesCaught = data.timesCaught || 0;
    ss.totalSmugglingProfit = data.totalSmugglingProfit || 0;
    return ss;
  }
}
