// RaiderManager.js — Manages all raider bands on the map

class RaiderManager {
  constructor() {
    this.raiders = [];
    this.maxRaiders = 6;
    this.spawnTimer = 0;
    this.spawnIntervalDays = 60; // New band every 60 days
    this.daysSinceSpawn = 0;

    window.addEventListener("dayChanged", () => {
      this.onDayChanged();
    });
  }

  init() {
    const numRaiders = 2 + Math.floor(Math.random() * 2); // 2-3 bands
    for (let i = 0; i < numRaiders; i++) {
      this.spawnRaider();
    }
  }

  spawnRaider() {
    if (this.raiders.length >= this.maxRaiders) return;

    // Find patrol points between cities (high-traffic areas)
    const patrolPoints = [];
    const cityPairs = [];

    // Scale patrol distance with map size
    const mapDim = Math.max(cols || 100, rows || 100);
    const maxPatrolDist = Math.max(25, Math.floor(mapDim / 4));

    for (let i = 0; i < cities.length; i++) {
      for (let j = i + 1; j < cities.length; j++) {
        const dx = cities[i].location.x - cities[j].location.x;
        const dy = cities[i].location.y - cities[j].location.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxPatrolDist) {
          cityPairs.push([i, j, dist]);
        }
      }
    }

    if (cityPairs.length === 0) return;

    // Pick a random pair of nearby cities to patrol between
    const pair = cityPairs[Math.floor(Math.random() * cityPairs.length)];
    const c1 = cities[pair[0]].location;
    const c2 = cities[pair[1]].location;

    // Midpoint with some offset
    const midX = Math.floor((c1.x + c2.x) / 2) + Math.floor(Math.random() * 6) - 3;
    const midY = Math.floor((c1.y + c2.y) / 2) + Math.floor(Math.random() * 6) - 3;

    // Clamp and find valid positions
    const p1 = this.findValidPosition(midX - 5, midY - 5);
    const p2 = this.findValidPosition(midX + 5, midY + 5);
    const p3 = this.findValidPosition(midX, midY);

    if (p1 && p2 && p3) {
      patrolPoints.push(p1, p2, p3);
    } else {
      // Fallback: random valid positions
      for (let i = 0; i < 3; i++) {
        const p = this.findValidPosition(
          Math.floor(Math.random() * cols),
          Math.floor(Math.random() * rows)
        );
        if (p) patrolPoints.push(p);
      }
    }

    if (patrolPoints.length < 2) return;

    const raider = new Raider({
      x: patrolPoints[0].x,
      y: patrolPoints[0].y,
      strength: 2 + Math.floor(Math.random() * 4),
      patrolPoints: patrolPoints,
    });

    this.raiders.push(raider);
    return raider;
  }

  findValidPosition(x, y) {
    // BFS to find nearest non-water, non-city tile
    x = Math.max(0, Math.min(cols - 1, x));
    y = Math.max(0, Math.min(rows - 1, y));

    const queue = [{ x, y }];
    const visited = new Set();
    visited.add(`${x},${y}`);

    while (queue.length > 0) {
      const pos = queue.shift();
      if (pos.x >= 0 && pos.x < cols && pos.y >= 0 && pos.y < rows) {
        const tile = grid[pos.y]?.[pos.x];
        if (tile && tile.options[0] !== 'Water') {
          const isCity = cities.some(c => c.location.x === pos.x && c.location.y === pos.y);
          if (!isCity) return pos;
        }
      }

      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = pos.x + dx;
        const ny = pos.y + dy;
        const key = `${nx},${ny}`;
        if (!visited.has(key) && nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
          visited.add(key);
          queue.push({ x: nx, y: ny });
        }
      }
    }
    return null;
  }

  onDayChanged() {
    this.daysSinceSpawn++;

    // Remove defeated raiders
    this.raiders = this.raiders.filter(r => r.state !== 'defeated');

    // Spawn new bands over time
    if (this.raiders.length < 2 && this.daysSinceSpawn >= this.spawnIntervalDays) {
      this.spawnRaider();
      this.daysSinceSpawn = 0;
    }

    // Raiders intercept NPC traders (simulated)
    if (typeof traderManager !== 'undefined') {
      for (const raider of this.raiders) {
        if (raider.state === 'defeated') continue;
        for (const trader of traderManager.traders) {
          if (trader.state !== 'traveling') continue;
          const dist = Math.abs(raider.x - trader.x) + Math.abs(raider.y - trader.y);
          if (dist <= raider.detectionRadius && Math.random() < 0.3) {
            // Trader loses some goods
            const items = [...trader.inventory.keys()];
            if (items.length > 0) {
              const stolen = items[Math.floor(Math.random() * items.length)];
              const entry = trader.inventory.get(stolen);
              const lostQty = Math.min(entry.quantity, 1 + Math.floor(Math.random() * 3));
              entry.quantity -= lostQty;
              if (entry.quantity <= 0) trader.inventory.delete(stolen);

              // Add to raider loot
              raider.loot.items.push({ name: stolen, quantity: lostQty });
            }
          }
        }
      }
    }
  }

  update(dt) {
    for (const raider of this.raiders) {
      raider.update(dt, player.x, player.y);
    }
  }

  render(tileSize) {
    for (const raider of this.raiders) {
      raider.render(tileSize);
    }
  }

  // Check if player stepped on a raider
  checkPlayerCollision(playerX, playerY) {
    for (const raider of this.raiders) {
      if (raider.state === 'defeated') continue;
      if (raider.x === playerX && raider.y === playerY) {
        return raider;
      }
      // Also check if raider is adjacent and chasing
      if (raider.state === 'chasing') {
        const dist = Math.abs(raider.x - playerX) + Math.abs(raider.y - playerY);
        if (dist <= 1) return raider;
      }
    }
    return null;
  }

  toJSON() {
    return this.raiders.map(r => r.toJSON());
  }

  static fromJSON(dataArray) {
    const mgr = new RaiderManager();
    mgr.raiders = dataArray.map(d => Raider.fromJSON(d));
    return mgr;
  }
}
