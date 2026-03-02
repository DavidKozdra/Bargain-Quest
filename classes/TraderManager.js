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

    this._onDayChanged = () => {
      this.onDayChanged();
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

  /** Scale trader limits with map size & city count */
  get minTraders() {
    const cityNum = typeof cities !== 'undefined' ? cities.length : 5;
    return Math.max(3, Math.floor(cityNum * 0.6));
  }
  get maxTraders() {
    const cityNum = typeof cities !== 'undefined' ? cities.length : 5;
    return Math.max(8, Math.floor(cityNum * 1.2));
  }

  init() {
    // Spawn roughly 1 trader per 2 cities to start
    const cityNum = typeof cities !== 'undefined' ? cities.length : 5;
    const numTraders = Math.min(Math.max(3, Math.floor(cityNum / 2)), this.maxTraders);
    for (let i = 0; i < numTraders; i++) {
      this.spawnTrader();
    }
  }

  spawnTrader() {
    if (this.traders.length >= this.maxTraders) return;
    if (cities.length < 2) return;

    const name = this.getUniqueName();
    const cityIdx = Math.floor(Math.random() * cities.length);
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

  onDayChanged() {
    this.daysSinceSpawn++;

    // Remove dead traders
    this.traders = this.traders.filter(t => t.state !== 'dead');

    // Spawn new if below minimum — can spawn multiple to catch up
    if (this.traders.length < this.minTraders && this.daysSinceSpawn >= this.spawnInterval) {
      const deficit = this.minTraders - this.traders.length;
      const toSpawn = Math.min(deficit, 2); // up to 2 at a time
      for (let i = 0; i < toSpawn; i++) {
        this.spawnTrader();
      }
      this.daysSinceSpawn = 0;
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log("New traders have appeared in the region!", "info");
      }
    }

    // Chance to spawn additional trader even above minimum (world feels busier)
    if (this.traders.length < this.maxTraders && Math.random() < 0.04) {
      this.spawnTrader();
    }
  }

  update(dt) {
    for (const trader of this.traders) {
      if (trader.state === 'dead') continue;
      // Throttle distant traders — only update every AI_SLEEP_SKIP frames
      if (typeof AI_ACTIVE_RADIUS !== 'undefined' && typeof player !== 'undefined') {
        const dist = Math.abs(trader.x - player.x) + Math.abs(trader.y - player.y);
        if (dist > AI_ACTIVE_RADIUS && (frameCount % AI_SLEEP_SKIP) !== (trader.homeCityIndex % AI_SLEEP_SKIP)) {
          continue; // skip this frame for distant trader
        }
      }
      trader.update(dt);
    }
  }

  render(tileSize) {
    for (const trader of this.traders) {
      trader.render(tileSize);
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

  toJSON() {
    return this.traders.map(t => t.toJSON());
  }

  static fromJSON(dataArray) {
    const mgr = new TraderManager();
    mgr.traders = dataArray.map(d => Trader.fromJSON(d));
    return mgr;
  }
}
