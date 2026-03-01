// TraderManager.js — Manages all NPC trader agents

class TraderManager {
  constructor() {
    this.traders = [];
    this.minTraders = 3;
    this.maxTraders = 8;
    this.spawnTimer = 0;
    this.spawnInterval = 40; // Spawn new trader every 40 days if below min
    this.daysSinceSpawn = 0;

    this.traderNames = [
      "Elia", "Karim", "Maren", "Tobias", "Sigrid", "Renzo", "Liana",
      "Dorin", "Yvette", "Caspar", "Nessa", "Jareth", "Opal", "Fynn",
      "Isolde", "Bram", "Talia", "Henrik", "Vera", "Aldric"
    ];
    this.usedNames = new Set();

    window.addEventListener("dayChanged", () => {
      this.onDayChanged();
    });
  }

  init() {
    const numTraders = Math.min(3 + Math.floor(Math.random() * 3), cities.length - 1);
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

    // Spawn new if below minimum
    if (this.traders.length < this.minTraders && this.daysSinceSpawn >= this.spawnInterval) {
      this.spawnTrader();
      this.daysSinceSpawn = 0;
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log("A new trader has appeared in the region!", "info");
      }
    }
  }

  update(dt) {
    for (const trader of this.traders) {
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

  toJSON() {
    return this.traders.map(t => t.toJSON());
  }

  static fromJSON(dataArray) {
    const mgr = new TraderManager();
    mgr.traders = dataArray.map(d => Trader.fromJSON(d));
    return mgr;
  }
}
