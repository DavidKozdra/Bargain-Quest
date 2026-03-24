// ContractSystem.js — Delivery, bounty, escort, and survey mission system

class ContractSystem {
  constructor() {
    /** @type {Contract[]} */
    this.available = new Map(); // cityName -> Contract[]
    this.active = [];           // player's accepted contracts (max 3)
    this.completed = [];        // history
    this.maxActive = 3;
    this.refreshIntervalDays = 3;
    this._lastRefreshDay = 0;

    this._onDayChanged = () => this.onDayChanged();
    window.addEventListener('dayChanged', this._onDayChanged);
  }

  destroy() {
    window.removeEventListener('dayChanged', this._onDayChanged);
  }

  // ─── Contract generation ───────────────────────────────────

  /** Generate 2-4 contracts for a city */
  generateForCity(city) {
    const contracts = [];
    const count = 2 + Math.floor(Math.random() * 3); // 2-4

    const types = ['delivery', 'bulkOrder', 'escort', 'rareFind', 'survey'];
    const usedTypes = new Set();

    for (let i = 0; i < count; i++) {
      // Pick a type not yet used (variety)
      let type;
      do {
        type = types[Math.floor(Math.random() * types.length)];
      } while (usedTypes.has(type) && usedTypes.size < types.length);

      const contract = this._createContract(type, city);
      if (contract) {
        usedTypes.add(type);
        contracts.push(contract);
      }
    }

    this.available.set(city.name, contracts);
    return contracts;
  }

  _createContract(type, sourceCity) {
    const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;
    const goldTarget = window._newGameGoldTarget || 5000;
    const playerGold = typeof player !== 'undefined' ? player.gold : 100;
    // Scale by both gold progress and days elapsed — whichever is higher, capped at 4×
    const goldProgress = playerGold / (goldTarget * 0.35);  // reaches 1.0 at 35% of goal
    const dayProgress = day / 40;                           // reaches 1.0 at day 40
    const goldScale = Math.min(4.0, Math.max(1, 1 + Math.max(goldProgress, dayProgress) * 1.5));

    switch (type) {
      case 'delivery': return this._makeDelivery(sourceCity, day, goldScale);
      case 'bulkOrder': return this._makeBulkOrder(sourceCity, day, goldScale);
      case 'escort': return this._makeEscort(sourceCity, day, goldScale);
      case 'rareFind': return this._makeRareFind(sourceCity, day, goldScale);
      case 'survey': return this._makeSurvey(sourceCity, day, goldScale);
      default: return null;
    }
  }

  _makeDelivery(city, day, scale) {
    if (typeof cities === 'undefined' || cities.length < 2) return null;
    const otherCities = cities.filter(c => c.name !== city.name);
    const target = otherCities[Math.floor(Math.random() * otherCities.length)];
    const tradeItems = ['Iron', 'Wheat', 'Fish', 'Clay', 'Wood', 'Salt', 'Herbs', 'Fur', 'Spices', 'Wine', 'Silk'];
    const item = tradeItems[Math.floor(Math.random() * tradeItems.length)];
    const qty = 2 + Math.floor(Math.random() * 4);
    const baseReward = (ItemLibrary[item]?.baseValue || 20) * qty * (1.5 + Math.random());
    const reward = Math.floor(baseReward * Math.min(3, scale));
    const deadline = day + 5 + Math.floor(Math.random() * 11); // 5-15 days

    return {
      id: `del_${day}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'delivery',
      title: `Deliver ${qty} ${item} to ${target.name}`,
      description: `The merchants of ${city.name} need ${qty} ${item} delivered to ${target.name}. Time-sensitive!`,
      source: city.name,
      target: target.name,
      item, qty, reward, deadline,
      repReward: 3 + Math.floor(Math.random() * 3),
      accepted: false,
      completed: false,
    };
  }

  _makeBulkOrder(city, day, scale) {
    const tradeItems = ['Iron', 'Wheat', 'Fish', 'Wood', 'Bread', 'Tools', 'Pottery'];
    const item = tradeItems[Math.floor(Math.random() * tradeItems.length)];
    const qty = 5 + Math.floor(Math.random() * 6);
    const baseReward = (ItemLibrary[item]?.baseValue || 20) * qty * 2;
    const reward = Math.floor(baseReward * Math.min(3, scale));
    const deadline = day + 7 + Math.floor(Math.random() * 14);

    return {
      id: `bulk_${day}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'bulkOrder',
      title: `Sell ${qty} ${item} here`,
      description: `${city.name} has a bulk order for ${qty} ${item}. Sell them here before the deadline for a premium price!`,
      source: city.name,
      target: city.name,
      item, qty, reward, deadline,
      repReward: 4 + Math.floor(Math.random() * 4),
      accepted: false,
      completed: false,
    };
  }

  _makeEscort(city, day, scale) {
    if (typeof cities === 'undefined' || cities.length < 2) return null;
    const otherCities = cities.filter(c => c.name !== city.name);
    const target = otherCities[Math.floor(Math.random() * otherCities.length)];
    const reward = Math.floor((50 + Math.random() * 150) * Math.min(3, scale));
    const deadline = day + 10;

    return {
      id: `esc_${day}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'escort',
      title: `Escort trader to ${target.name}`,
      description: `A nervous merchant needs protection traveling to ${target.name}. Ambush chance en route!`,
      source: city.name,
      target: target.name,
      reward, deadline,
      repReward: 5 + Math.floor(Math.random() * 4),
      accepted: false,
      completed: false,
    };
  }

  _makeRareFind(city, day, scale) {
    const luxItems = ['Jewelry', 'Spices', 'Silk', 'Wine'];
    const item = luxItems[Math.floor(Math.random() * luxItems.length)];
    const baseReward = (ItemLibrary[item]?.baseValue || 50) * (2 + Math.random() * 2);
    const reward = Math.floor(baseReward * Math.min(3, scale));

    return {
      id: `rare_${day}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'rareFind',
      title: `Acquire 1 ${item}`,
      description: `A wealthy patron in ${city.name} seeks ${item}. Bring one here for a generous reward. No deadline!`,
      source: city.name,
      target: city.name,
      item, qty: 1, reward, deadline: null, // no time limit
      repReward: 6 + Math.floor(Math.random() * 3),
      accepted: false,
      completed: false,
    };
  }

  _makeSurvey(city, day, scale) {
    const terrains = ['Forest', 'Rock', 'Sand', 'Snow', 'Grass'];
    const targets = [];
    for (let i = 0; i < 3; i++) {
      let tx, ty, attempts = 0;
      do {
        tx = Math.floor(Math.random() * (typeof cols !== 'undefined' ? cols : 100));
        ty = Math.floor(Math.random() * (typeof rows !== 'undefined' ? rows : 100));
        attempts++;
      } while (attempts < 50 && (typeof grid === 'undefined' || !grid[ty]?.[tx] || grid[ty][tx].options[0] === 'Water'));
      targets.push({ x: tx, y: ty });
    }
    const reward = Math.floor((40 + Math.random() * 60) * Math.min(3, scale));
    const deadline = day + 8;

    return {
      id: `surv_${day}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'survey',
      title: `Survey 3 locations`,
      description: `Cartographers need tiles mapped. Visit all 3 marked locations.`,
      source: city.name,
      target: null,
      surveyPoints: targets,
      surveyVisited: [false, false, false],
      reward, deadline,
      repReward: 3 + Math.floor(Math.random() * 3),
      accepted: false,
      completed: false,
    };
  }

  // ─── Player actions ─────────────────────────────────────

  acceptContract(contract) {
    if (this.active.length >= this.maxActive) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('You can only hold 3 active contracts!', 'warning');
      }
      return false;
    }
    contract.accepted = true;
    this.active.push(contract);

    if (contract.type === 'delivery') {
      this._provisionDeliveryItems(contract);
    }

    // Remove from available
    for (const [cityName, contracts] of this.available) {
      const idx = contracts.indexOf(contract);
      if (idx >= 0) { contracts.splice(idx, 1); break; }
    }

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Contract accepted: ${contract.title}`, 'success');
    }
    return true;
  }

  /** Check all active contracts for completion. Called on sell, visit city, move, etc. */
  checkCompletion() {
    const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;

    for (let i = this.active.length - 1; i >= 0; i--) {
      const c = this.active[i];

      // Check expiry first
      if (c.deadline && day > c.deadline) {
        this._failContract(c, i);
        continue;
      }

      let complete = false;

      switch (c.type) {
        case 'delivery':
          // Player at target city with enough items
          if (player.currentCity?.name === c.target && this._playerHasItem(c.item, c.qty)) {
            complete = true;
          }
          break;

        case 'bulkOrder':
          // Player at source city with enough items
          if (player.currentCity?.name === c.target && this._playerHasItem(c.item, c.qty)) {
            complete = true;
          }
          break;

        case 'escort':
          // Player reached target city
          if (player.currentCity?.name === c.target) {
            complete = true;
          }
          break;

        case 'rareFind':
          // Player at source city with the item
          if (player.currentCity?.name === c.target && this._playerHasItem(c.item, c.qty)) {
            complete = true;
          }
          break;

        case 'survey':
          // Check if player is on any survey point
          if (c.surveyPoints) {
            for (let j = 0; j < c.surveyPoints.length; j++) {
              if (!c.surveyVisited[j]) {
                const sp = c.surveyPoints[j];
                if (Math.abs(player.x - sp.x) <= 1 && Math.abs(player.y - sp.y) <= 1) {
                  c.surveyVisited[j] = true;
                  if (typeof notificationManager !== 'undefined') {
                    notificationManager.log(`Survey point ${j + 1}/3 discovered!`, 'success');
                  }
                }
              }
            }
            if (c.surveyVisited.every(v => v)) complete = true;
          }
          break;
      }

      if (complete) {
        this._completeContract(c, i);
      }
    }
  }

  _playerHasItem(itemName, qty) {
    const entry = player.inventory.get(itemName);
    return entry && entry.quantity >= qty;
  }

  _completeContract(contract, index) {
    // Remove items from player and add to destination city if delivery/bulk/rareFind
    if (contract.item && contract.qty && contract.type !== 'escort' && contract.type !== 'survey') {
      for (let i = 0; i < contract.qty; i++) {
        player.removeItem({ name: contract.item });
      }
      // Give items to the destination city so city inventories stay balanced
      if (typeof cities !== 'undefined') {
        const destName = contract.target || contract.source;
        const destCity = cities.find(c => c.name === destName);
        if (destCity && ItemLibrary[contract.item]) {
          const ce = destCity.inventory.get(contract.item);
          if (ce) {
            ce.quantity += contract.qty;
          } else {
            destCity.inventory.set(contract.item, { item: ItemLibrary[contract.item], quantity: contract.qty });
          }
        }
      }
    }

    player.earnGold(contract.reward);
    contract.completed = true;

    // Reputation boost at source city
    if (typeof cities !== 'undefined') {
      const city = cities.find(c => c.name === contract.source);
      if (city && city.adjustReputation) {
        city.adjustReputation(contract.repReward || 5);
      }
    }

    this.active.splice(index, 1);
    this.completed.push(contract);

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Contract complete: "${contract.title}" — Earned ${contract.reward}g!`, 'success');
    }
  }

  _provisionDeliveryItems(contract) {
    if (!contract || !contract.item || !contract.qty || typeof player === 'undefined') return;
    const existingQty = player.inventory.get(contract.item)?.quantity || 0;
    const needed = Math.max(0, contract.qty - existingQty);
    if (needed <= 0) return;

    let sourced = 0;
    if (typeof cities !== 'undefined' && Array.isArray(cities)) {
      const sourceCity = cities.find((c) => c.name === contract.source);
      if (sourceCity && sourceCity.inventory) {
        const cityEntry = sourceCity.inventory.get(contract.item);
        if (cityEntry && cityEntry.quantity > 0) {
          const take = Math.min(cityEntry.quantity, needed);
          cityEntry.quantity -= take;
          if (cityEntry.quantity <= 0) sourceCity.inventory.delete(contract.item);
          sourced += take;
        }
      }
    }

    const remainder = needed - sourced;
    const totalToAdd = sourced + remainder;
    if (totalToAdd <= 0) return;

    player.addItem({ name: contract.item, quantity: totalToAdd }, true);
    if (typeof notificationManager !== 'undefined') {
      const fromSource = sourced > 0 ? ` from ${contract.source}` : '';
      notificationManager.log(`Loaded ${totalToAdd} ${contract.item}${fromSource} for ${contract.title}.`, 'info');
    }
  }

  _failContract(contract, index) {
    this.active.splice(index, 1);

    // Reputation loss at source city
    if (typeof cities !== 'undefined') {
      const city = cities.find(c => c.name === contract.source);
      if (city && city.adjustReputation) {
        city.adjustReputation(-5);
      }
    }

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Contract expired: "${contract.title}" — Reputation lost!`, 'error');
    }
  }

  /** Voluntarily abandon an active contract. Costs a small reputation penalty. */
  abandonContract(contract) {
    const idx = this.active.indexOf(contract);
    if (idx < 0) return false;

    this.active.splice(idx, 1);

    // Smaller rep hit than expiry (-3 vs -5)
    if (typeof cities !== 'undefined') {
      const city = cities.find(c => c.name === contract.source);
      if (city && city.adjustReputation) {
        city.adjustReputation(-3);
      }
    }

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Contract abandoned: "${contract.title}" — Minor reputation lost.`, 'warning');
    }
    return true;
  }

  // ─── Daily tick ─────────────────────────────────────────

  onDayChanged() {
    const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;

    // Refresh city contracts periodically
    if (day - this._lastRefreshDay >= this.refreshIntervalDays) {
      this._lastRefreshDay = day;
      if (typeof cities !== 'undefined') {
        for (const city of cities) {
          this.generateForCity(city);
        }
      }
    }

    // Check expirations
    this.checkCompletion();

    // Escort ambush chance (10% per day if escort active)
    for (const c of this.active) {
      if (c.type === 'escort' && Math.random() < 0.10) {
        if (typeof combatSystem !== 'undefined' && typeof Raider !== 'undefined') {
          const bandit = new Raider({
            x: player.x, y: player.y,
            strength: 2 + Math.floor(Math.random() * 3),
            patrolPoints: [],
          });
          bandit.loot.gold = 20 + Math.floor(Math.random() * 30);
          combatSystem.startCombat(bandit);
          if (typeof notificationManager !== 'undefined') {
            notificationManager.log('Escort ambush! Bandits attack!', 'warning');
          }
          break; // only one ambush per day
        }
      }
    }
  }

  // ─── Serialization ──────────────────────────────────────

  toJSON() {
    const avail = {};
    for (const [k, v] of this.available) {
      avail[k] = v;
    }
    return {
      available: avail,
      active: this.active,
      completed: this.completed.slice(-20), // keep last 20
      lastRefreshDay: this._lastRefreshDay,
    };
  }

  static fromJSON(data) {
    const cs = new ContractSystem();
    if (data.available) {
      for (const [k, v] of Object.entries(data.available)) {
        cs.available.set(k, v);
      }
    }
    cs.active = data.active || [];
    cs.completed = data.completed || [];
    cs._lastRefreshDay = data.lastRefreshDay || 0;
    return cs;
  }

  /** Get contracts available at a specific city */
  getContractsForCity(cityName) {
    return this.available.get(cityName) || [];
  }
}
