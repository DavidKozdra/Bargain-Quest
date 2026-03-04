// TraderManager.js — Manages all NPC trader agents

class TraderManager {
  constructor() {
    this.traders = [];
    this.spawnTimer = 0;
    this.spawnInterval = 15; // Spawn new trader every 15 days if below min
    this.daysSinceSpawn = 0;

    this.traderNames = [
      "Elia", "Karim", "Maren", "Tobias", "Sigrid", "Renzo", "Liana",
      "Dorin", "Yvette", "Caspar", "Nessa", "Jareth", "Opal", "Fynn",
      "Isolde", "Bram", "Talia", "Henrik", "Vera", "Aldric",
      "Soren", "Petra", "Lucien", "Freya", "Emeric", "Gwynn", "Ronan",
      "Theda", "Cael", "Mira", "Bastien", "Ilona", "Kael", "Yara"
    ];
    this.usedNames = new Set();

    this._onDayChanged = (e) => {
      this.onDayChanged(e);
    };
    window.addEventListener("dayChanged", this._onDayChanged);
  }

  /** Remove event listener to prevent leaks on new game */
  destroy() {
    if (this._onDayChanged) {
      window.removeEventListener("dayChanged", this._onDayChanged);
      this._onDayChanged = null;
    }
  }

  /** Scale trader limits with map size & city count.
   *  Hard caps prevent excessive A* calls on large maps. */
  get minTraders() {
    const cityNum = typeof cities !== 'undefined' ? cities.length : 5;
    return Math.max(3, Math.min(20, Math.floor(cityNum * 0.6)));
  }
  get maxTraders() {
    const cityNum = typeof cities !== 'undefined' ? cities.length : 5;
    // Absolute cap: 60 traders regardless of city count — prevents A* explosion
    return Math.max(8, Math.min(60, Math.floor(cityNum * 1.2)));
  }

  init() {
    // Spawn roughly 1 trader per 2 cities to start
    const cityNum = typeof cities !== 'undefined' ? cities.length : 5;
    const numTraders = Math.min(Math.max(3, Math.floor(cityNum / 2)), this.maxTraders);
    for (let i = 0; i < numTraders; i++) {
      this.spawnTrader();
    }
    this.seedRelationships();
  }

  spawnTrader() {
    if (this.traders.length >= this.maxTraders) return;
    if (cities.length < 2) return;

    const name = this.getUniqueName();
    // Choose a spawn city weighted by attractiveness (reputation * (1 - taxRate))
    let cityIdx = 0;
    try {
      const weights = cities.map(c => {
        const rep = (typeof c.reputation === 'number') ? (c.reputation / 100) : 0.5;
        const tax = (c.management && typeof c.management.taxRate === 'number') ? c.management.taxRate : 0;
        return Math.max(0.01, rep * (1 - tax));
      });
      const total = weights.reduce((a,b) => a+b, 0);
      let r = Math.random() * total;
      for (let i=0;i<weights.length;i++){
        r -= weights[i];
        if (r <= 0) { cityIdx = i; break; }
      }
    } catch (e) {
      cityIdx = Math.floor(Math.random() * cities.length);
    }
    const personalities = ['greedy', 'cautious', 'balanced'];
    const personality = personalities[Math.floor(Math.random() * personalities.length)];

    const trader = new Trader({
      name,
      homeCityIndex: cityIdx,
      personality,
      gold: 200 + Math.floor(Math.random() * 400),
      cargoCapacity: 60 + Math.floor(Math.random() * 60),
    });

    // Give starter inventory
    const starterItems = Object.keys(ItemLibrary);
    const numItems = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numItems; i++) {
      const itemKey = starterItems[Math.floor(Math.random() * starterItems.length)];
      const qty = 2 + Math.floor(Math.random() * 5);
      trader.inventory.set(itemKey, { item: ItemLibrary[itemKey], quantity: qty });
    }

    this.traders.push(trader);
    if (typeof traderGrid !== 'undefined') traderGrid.insert(trader, trader.x, trader.y);
    this.seedRelationships(); // check new trader against existing traders
    return trader;
  }

  getUniqueName() {
    const available = this.traderNames.filter(n => !this.usedNames.has(n));
    if (available.length === 0) {
      this.usedNames.clear();
      return this.traderNames[Math.floor(Math.random() * this.traderNames.length)];
    }
    const name = available[Math.floor(Math.random() * available.length)];
    this.usedNames.add(name);
    return name;
  }

  onDayChanged(e) {
    this.daysSinceSpawn++;

    // Remove dead traders
    this.traders = this.traders.filter(t => t.state !== 'dead');

    // Base spawn rate, adjusted by regional city attractiveness (reputation & tax)
    const baseSpawnRate = window.TRADER_SPAWN_RATE || 1.0;
    let regionAttract = 0;
    if (typeof cities !== 'undefined' && cities.length > 0) {
      for (const c of cities) {
        const rep = (typeof c.reputation === 'number') ? (c.reputation / 100) : 0.5;
        const tax = (c.management && typeof c.management.taxRate === 'number') ? c.management.taxRate : 0;
        regionAttract += Math.max(0, rep * (1 - tax));
      }
      regionAttract = regionAttract / cities.length; // 0..1
    }
    const spawnRate = Math.max(0.2, baseSpawnRate * (1 + regionAttract * 0.6));

    // Spawn new if below minimum — can spawn multiple to catch up
    if (this.traders.length < this.minTraders && this.daysSinceSpawn >= this.spawnInterval) {
      const deficit = this.minTraders - this.traders.length;
      const toSpawn = Math.min(deficit, 2); // up to 2 at a time
      for (let i = 0; i < toSpawn; i++) {
        if (Math.random() < spawnRate) this.spawnTrader();
      }
      this.daysSinceSpawn = 0;
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log("New traders have appeared in the region!", "info");
      }
    }

    // Chance to spawn additional trader even above minimum (world feels busier)
    if (this.traders.length < this.maxTraders && Math.random() < 0.04 * spawnRate) {
      this.spawnTrader();
    }

    // Abstract arrival — teleport traders that have completed their simulated journey
    const daysNow = e && e.detail ? e.detail.daysElapsed : (typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0);
    for (const trader of this.traders) {
      if (trader.state === 'dead' || trader.abstractArrivalDay < 0) continue;
      if (daysNow < trader.abstractArrivalDay) continue;

      const target = (trader.targetCityIndex >= 0) ? cities[trader.targetCityIndex] : null;
      if (target) {
        // Teleport to city — register in spatial grid
        if (typeof traderGrid !== 'undefined') traderGrid.move(trader, target.location.x, target.location.y);
        trader.x = target.location.x;
        trader.y = target.location.y;
        trader.currentCityIndex = trader.targetCityIndex;
        target.dockedTraderCount = (target.dockedTraderCount || 0) + 1;
        trader.abstractArrivalDay = -1;
        trader.state = 'trading'; // doTrading() runs on next update tick
      } else {
        // No valid target — reset to idle so planRoute() picks a new one
        trader.abstractArrivalDay = -1;
        trader.state = 'idle';
        trader.waitDays = 2;
      }
    }
  }

  update(dt) {
    const hasPlayer  = typeof player !== 'undefined';
    const hasAbstract = typeof AI_ABSTRACT_RADIUS !== 'undefined';
    const hasActive  = typeof AI_ACTIVE_RADIUS   !== 'undefined';

    for (let i = 0; i < this.traders.length; i++) {
      const trader = this.traders[i];
      if (trader.state === 'dead') continue;

      if (hasPlayer) {
        const dist = Math.abs(trader.x - player.x) + Math.abs(trader.y - player.y);

        // --- Abstract simulation zone (far from player) ---
        if (hasAbstract && dist > AI_ABSTRACT_RADIUS && trader.state === 'traveling' && trader.targetCityIndex >= 0) {
          if (trader.abstractArrivalDay < 0) {
            // Enter abstract mode — estimate travel time in days
            const target     = cities[trader.targetCityIndex];
            const manhattan  = target ? Math.abs(trader.x - target.location.x) + Math.abs(trader.y - target.location.y) : 1;
            const tilesPerDay = 700; // ~150ms/tile × ~800 tiles/day; 700 adds a small terrain buffer
            const travelDays  = Math.max(1, Math.ceil(manhattan / tilesPerDay));
            trader.abstractArrivalDay = (typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0) + travelDays;
            trader.path = []; // discard in-progress A* path
          }
          continue; // nothing to simulate this frame — onDayChanged handles arrival
        }

        // --- Restore from abstract mode when player approaches ---
        if (trader.abstractArrivalDay >= 0 && dist <= AI_ABSTRACT_RADIUS) {
          trader.abstractArrivalDay = -1;
          if (trader.state === 'traveling') {
            // Reset to idle so planRoute() re-calculates a fresh A* path
            trader.path     = [];
            trader.state    = 'idle';
            trader.waitDays = 0;
          }
        }

        // --- Standard throttle for active-but-distant traders ---
        if (hasActive && dist > AI_ACTIVE_RADIUS && (frameCount % AI_SLEEP_SKIP) !== (i % AI_SLEEP_SKIP)) {
          continue;
        }
      }

      trader.update(dt);
    }
  }

  render(tileSize) {
    // queryViewport() returns only traders in cells overlapping the viewport
    if (typeof traderGrid !== 'undefined') {
      for (const trader of traderGrid.queryViewport()) {
        trader.render(tileSize);
      }
    } else {
      for (const trader of this.traders) trader.render(tileSize);
    }
  }

  // Check if player is on same tile as a trader
  checkPlayerEncounter(playerX, playerY) {
    for (const trader of this.traders) {
      if (trader.state === 'dead') continue;
      if (trader.x === playerX && trader.y === playerY && trader.state === 'traveling') {
        return trader;
      }
    }
    return null;
  }

  /**
   * Rebuild per-city trader cache. Call once per frame before rendering.
   * Stores trader counts and lists keyed by city index.
   */
  _refreshCityCache() {
    if (this._cityCacheFrame === frameCount) return; // already fresh this frame
    this._cityCacheFrame = frameCount;
    if (!this._cityTraderCount) this._cityTraderCount = new Map();
    if (!this._cityTraderList) this._cityTraderList = new Map();
    this._cityTraderCount.clear();
    this._cityTraderList.clear();
    for (const t of this.traders) {
      if (t.state === 'dead') continue;
      if (t.state === 'trading' || t.state === 'idle') {
        const ci = t.currentCityIndex;
        if (ci >= 0) {
          this._cityTraderCount.set(ci, (this._cityTraderCount.get(ci) || 0) + 1);
          let list = this._cityTraderList.get(ci);
          if (!list) { list = []; this._cityTraderList.set(ci, list); }
          list.push(t);
        }
      }
    }
  }

  /** Get count of traders at a city (uses per-frame cache) */
  getTraderCountAtCity(cityIndex) {
    this._refreshCityCache();
    return this._cityTraderCount.get(cityIndex) || 0;
  }

  /** Get all traders currently at a specific city (trading or idle) */
  getTradersAtCity(cityIndex) {
    this._refreshCityCache();
    return this._cityTraderList.get(cityIndex) || [];
  }

  /** Get traders traveling toward a city */
  getTradersHeadingToCity(cityIndex) {
    return this.traders.filter(t =>
      t.state === 'traveling' && t.targetCityIndex === cityIndex
    );
  }

  /** Seed initial rival/ally relationships between traders sharing a home city */
  seedRelationships() {
    const traders = this.traders;
    for (let i = 0; i < traders.length; i++) {
      for (let j = i + 1; j < traders.length; j++) {
        const a = traders[i], b = traders[j];
        if (!a.id || !b.id) continue;
        if (a.relations.has(b.id)) continue; // already seeded
        const sameHome = a.homeCityIndex === b.homeCityIndex;
        const samePersonality = a.personality === b.personality;
        if (sameHome && samePersonality) {
          // Competitors at same home city → rivals
          a.relations.set(b.id, { score: 25, rival: true,  lastDay: 0 });
          b.relations.set(a.id, { score: 25, rival: true,  lastDay: 0 });
          this._notifyRivalry(a, b);
        } else if (sameHome) {
          // Different style, same city → neutral-positive
          a.relations.set(b.id, { score: 60, rival: false, lastDay: 0 });
          b.relations.set(a.id, { score: 60, rival: false, lastDay: 0 });
        }
      }
    }
  }

  /** Notify player if rivalry forms near them */
  _notifyRivalry(a, b) {
    if (typeof player === 'undefined' || typeof notificationManager === 'undefined') return;
    const distA = Math.abs(a.x - player.x) + Math.abs(a.y - player.y);
    const distB = Math.abs(b.x - player.x) + Math.abs(b.y - player.y);
    if (Math.min(distA, distB) <= (typeof AI_ACTIVE_RADIUS !== 'undefined' ? AI_ACTIVE_RADIUS : 80)) {
      notificationManager.log(`⚔️ ${a.name} and ${b.name} are rivals!`, 'warning');
    }
  }

  /** Get all traders marked as rivals of the given trader */
  getRivals(trader) {
    return this.traders.filter(t => trader.relations.get(t.id)?.rival === true);
  }

  toJSON() {
    return this.traders.map(t => t.toJSON());
  }

  static fromJSON(dataArray) {
    const mgr = new TraderManager();
    mgr.traders = dataArray.map(d => Trader.fromJSON(d));
    return mgr;
  }
}
