// Trader.js — NPC trader agents that travel and trade between cities

class Trader {
  constructor({ name, homeCityIndex, personality, gold, cargoCapacity }) {
    this.name = name;
    this.personality = personality; // 'greedy', 'cautious', 'balanced'
    this.gold = gold || 200 + Math.floor(Math.random() * 300);
    this.inventory = new Map(); // itemName -> { item, quantity }
    this.cargoCapacity = cargoCapacity || 80 + Math.floor(Math.random() * 40);
    this.reputation = 50; // 0-100

    this.homeCityIndex = homeCityIndex;
    this.targetCityIndex = -1;
    this.currentCityIndex = homeCityIndex;

    // Position
    const city = cities[homeCityIndex];
    this.x = city.location.x;
    this.y = city.location.y;
    this.path = [];
    this.direction = 'down';
    this.animFrame = 0;
    this.animTimer = 0;

    // State machine
    this.state = 'trading'; // 'trading', 'traveling', 'idle', 'dead'
    this.waitDays = 0;
    this.tradeLog = []; // Last 10 trades for price memory
    this.totalProfit = 0;

    // Movement timing
    this.moveTimer = 0;
    this.moveInterval = 150; // ms between moves (slower than player)

    // Personality-based margins
    this.margins = {
      greedy: 1.2,
      cautious: 1.5,
      balanced: 1.3,
    };

    // Boat ownership — 30% chance of owning a boat
    this.hasBoat = Math.random() < 0.3;
    this.isSailing = false;
  }

  getCargoWeight() {
    let total = 0;
    for (const [key, entry] of this.inventory) {
      total += (entry.item.weight || 1) * entry.quantity;
    }
    return total;
  }

  update(dt) {
    if (this.state === 'dead') return;

    if (this.state === 'trading') {
      this.doTrading();
    } else if (this.state === 'traveling') {
      this.doTraveling(dt);
    } else if (this.state === 'idle') {
      // Waiting at city
      this.waitDays--;
      if (this.waitDays <= 0) {
        this.planRoute();
      }
    }

    // Bankruptcy check
    if (this.gold <= 5 && this.inventory.size === 0) {
      this.state = 'dead';
    }
  }

  doTrading() {
    const city = cities[this.currentCityIndex];
    if (!city) { this.state = 'idle'; return; }

    // Sell what we have
    for (const [itemKey, entry] of [...this.inventory]) {
      const sellPrice = city.calculateItemPrice(itemKey, cities, true);
      if (sellPrice > 0 && entry.quantity > 0) {
        const qty = entry.quantity;
        this.gold += sellPrice * qty;
        this.totalProfit += sellPrice * qty;
        city._addOrIncrement(itemKey, qty);
        this.inventory.delete(itemKey);

        this.tradeLog.push({ type: 'sell', item: itemKey, qty, price: sellPrice, city: city.name });
        if (this.tradeLog.length > 20) this.tradeLog.shift();
      }
    }

    // Buy profitable items
    const margin = this.margins[this.personality] || 1.3;

    for (const [itemKey, entry] of city.inventory) {
      if (entry.quantity <= 2) continue; // Don't buy out last items
      const buyPrice = city.calculateItemPrice(itemKey, cities);
      if (buyPrice > this.gold) continue;

      // Estimate sell price at other cities
      let bestSellPrice = 0;
      let bestCityIdx = -1;
      for (let i = 0; i < cities.length; i++) {
        if (i === this.currentCityIndex) continue;
        const est = cities[i].calculateItemPrice(itemKey, cities, true);
        if (est > bestSellPrice) {
          bestSellPrice = est;
          bestCityIdx = i;
        }
      }

      if (bestSellPrice > buyPrice * margin && this.getCargoWeight() < this.cargoCapacity) {
        const canAfford = Math.floor(this.gold / buyPrice);
        const available = entry.quantity - 2; // Leave 2 for city
        const weightRoom = Math.floor((this.cargoCapacity - this.getCargoWeight()) / (ItemLibrary[itemKey]?.weight || 1));
        const qty = Math.min(canAfford, available, weightRoom, 10);

        if (qty > 0) {
          this.gold -= buyPrice * qty;
          entry.quantity -= qty;
          if (entry.quantity <= 0) city.inventory.delete(itemKey);

          const existing = this.inventory.get(itemKey);
          if (existing) {
            existing.quantity += qty;
          } else {
            this.inventory.set(itemKey, { item: ItemLibrary[itemKey], quantity: qty });
          }

          this.tradeLog.push({ type: 'buy', item: itemKey, qty, price: buyPrice, city: city.name });
          if (this.tradeLog.length > 20) this.tradeLog.shift();

          if (bestCityIdx >= 0) this.targetCityIndex = bestCityIdx;
        }
      }
    }

    // Done trading, plan route or wait
    this.waitDays = 2 + Math.floor(Math.random() * 4); // Stay 2-5 days at city
    this.state = 'idle';
  }

  planRoute() {
    if (this.targetCityIndex < 0 || this.targetCityIndex === this.currentCityIndex) {
      // Pick best city to visit
      let bestScore = -Infinity;
      let bestIdx = -1;

      for (let i = 0; i < cities.length; i++) {
        if (i === this.currentCityIndex) continue;
        const c = cities[i];
        const dx = c.location.x - this.x;
        const dy = c.location.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Score: inverse distance + random exploration factor
        let score = 100 / (dist + 1);

        // Greedy prefers high-demand cities, cautious prefers close ones
        if (this.personality === 'greedy') score *= 1.5;
        if (this.personality === 'cautious') score += 50 / (dist + 1);

        score += Math.random() * 20;

        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      this.targetCityIndex = bestIdx;
    }

    if (this.targetCityIndex >= 0) {
      const target = cities[this.targetCityIndex];
      const ports = this.hasBoat && typeof portCityLocations !== 'undefined' ? portCityLocations : null;
      const pathResult = aStar(grid, { x: this.x, y: this.y }, target.location, this.hasBoat, ports);
      if (pathResult && pathResult.length > 0) {
        this.path = pathResult;
        this.state = 'traveling';
      } else {
        // Can't path, pick another city
        this.targetCityIndex = -1;
        this.state = 'idle';
        this.waitDays = 3;
      }
    }
  }

  doTraveling(dt) {
    this.moveTimer += dt;
    if (this.moveTimer < this.moveInterval) return;
    this.moveTimer = 0;

    if (this.path.length === 0) {
      // Arrived at destination
      this.arriveAtCity();
      return;
    }

    const next = this.path[0];

    // Update direction for sprite
    const dx = next.x - this.x;
    const dy = next.y - this.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.direction = dx > 0 ? 'right' : 'left';
    } else {
      this.direction = dy > 0 ? 'down' : 'up';
    }

    this.x = next.x;
    this.y = next.y;
    this.path.shift();

    // Animate
    this.animTimer++;
    if (this.animTimer >= 8) {
      this.animFrame = (this.animFrame + 1) % 3;
      this.animTimer = 0;
    }

    // Check if arrived at target city
    if (this.targetCityIndex >= 0) {
      const target = cities[this.targetCityIndex];
      if (this.x === target.location.x && this.y === target.location.y) {
        this.arriveAtCity();
      }
    }

    // Check if at any city — O(1) lookup via cityLocationMap
    const cityAtTile = (typeof cityLocationMap !== 'undefined' && cityLocationMap.size > 0)
      ? cityLocationMap.get(`${this.x},${this.y}`) : null;
    if (cityAtTile) {
      const i = cities.indexOf(cityAtTile);
      if (i >= 0) {
        this.currentCityIndex = i;
        if (this.path.length <= 2) {
          this.arriveAtCity();
          return;
        }
      }
    }
  }

  arriveAtCity() {
    this.path = [];
    this.state = 'trading';
    // Find which city we're at — O(1) lookup
    const cityAtTile = (typeof cityLocationMap !== 'undefined' && cityLocationMap.size > 0)
      ? cityLocationMap.get(`${this.x},${this.y}`) : null;
    if (cityAtTile) {
      const idx = cities.indexOf(cityAtTile);
      if (idx >= 0) { this.currentCityIndex = idx; return; }
    }
    // Fallback linear scan
    for (let i = 0; i < cities.length; i++) {
      const c = cities[i];
      if (this.x === c.location.x && this.y === c.location.y) {
        this.currentCityIndex = i;
        break;
      }
    }
  }

  render(tileSize) {
    if (this.state === 'dead') return;

    const px = this.x * tileSize;
    const py = this.y * tileSize;

    // Check if on water — render as boat
    const tile = grid[this.y]?.[this.x];
    const onWater = tile && tile.options[0] === 'Water' && this.hasBoat;
    this.isSailing = onWater;

    if (onWater) {
      // Render as sloop (traders use sloops)
      const boatSprites = SpriteSheet.boats?.sloop;
      if (boatSprites && boatSprites[this.direction]) {
        const frame = boatSprites[this.direction][this.animFrame] || boatSprites[this.direction][0];
        image(frame, px, py, tileSize, tileSize);
      } else {
        push();
        fill(100, 70, 40);
        noStroke();
        rect(px + 2, py + 4, tileSize - 4, tileSize - 8, 4);
        pop();
      }
    } else {
      const sprites = SpriteSheet.trader?.[this.personality];
      if (sprites && sprites[this.direction]) {
        const frame = sprites[this.direction][this.animFrame] || sprites[this.direction][0];
        image(frame, px, py, tileSize, tileSize);
      } else {
        // Fallback colored square
        push();
        fill(100, 180, 100);
        noStroke();
        rect(px + 4, py + 4, tileSize - 8, tileSize - 8, 3);
        pop();
      }
    }

    // Name label
    push();
    fill(255, 255, 255, 180);
    noStroke();
    textAlign(CENTER, BOTTOM);
    textSize(9);
    text(this.name, px + tileSize / 2, py - 2);

    // Show state badge when docked at city
    if (this.state === 'trading' || this.state === 'idle') {
      fill(80, 200, 120, 200);
      noStroke();
      ellipse(px + tileSize - 3, py + 3, 6, 6);
    }
    pop();
  }

  // Serialize for save
  toJSON() {
    return {
      name: this.name,
      personality: this.personality,
      gold: this.gold,
      inventory: [...this.inventory].map(([k, v]) => [k, v.quantity]),
      cargoCapacity: this.cargoCapacity,
      reputation: this.reputation,
      homeCityIndex: this.homeCityIndex,
      targetCityIndex: this.targetCityIndex,
      currentCityIndex: this.currentCityIndex,
      x: this.x,
      y: this.y,
      state: this.state,
      waitDays: this.waitDays,
      totalProfit: this.totalProfit,
      hasBoat: this.hasBoat,
    };
  }

  static fromJSON(data) {
    const t = new Trader({
      name: data.name,
      homeCityIndex: data.homeCityIndex,
      personality: data.personality,
      gold: data.gold,
      cargoCapacity: data.cargoCapacity,
    });
    t.reputation = data.reputation;
    t.targetCityIndex = data.targetCityIndex;
    t.currentCityIndex = data.currentCityIndex;
    t.x = data.x;
    t.y = data.y;
    t.state = data.state;
    t.waitDays = data.waitDays;
    t.totalProfit = data.totalProfit;
    t.hasBoat = data.hasBoat || false;
    t.isSailing = false;
    for (const [key, qty] of data.inventory) {
      if (ItemLibrary[key]) {
        t.inventory.set(key, { item: ItemLibrary[key], quantity: qty });
      }
    }
    return t;
  }
}
