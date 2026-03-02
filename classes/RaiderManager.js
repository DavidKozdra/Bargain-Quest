// RaiderManager.js — Manages all raider bands on the map

class RaiderManager {
  constructor() {
    this.raiders = [];
    this.spawnTimer = 0;
    this.spawnIntervalDays = 40; // New band every 40 days
    this.daysSinceSpawn = 0;

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

  /** Scale raider limits with map size */
  get maxRaiders() {
    const cityNum = typeof cities !== 'undefined' ? cities.length : 5;
    return Math.max(8, Math.floor(cityNum * 0.7));
  }

  /** Max pirate count scales with coastal cities */
  get maxPirates() {
    if (typeof cities === 'undefined') return 6;
    const coastal = cities.filter(c => c.isCoastal).length;
    return Math.max(6, Math.floor(coastal * 1.2));
  }

  /** Current pirate count */
  get pirateCount() {
    return this.raiders.filter(r => r.isPirate && r.state !== 'defeated').length;
  }

  init() {
    const cityNum = typeof cities !== 'undefined' ? cities.length : 5;
    const numRaiders = Math.min(2 + Math.floor(cityNum / 5), this.maxRaiders);
    for (let i = 0; i < numRaiders; i++) {
      this.spawnRaider();
    }
    // Spawn pirates on water routes between coastal cities
    const coastalCount = typeof cities !== 'undefined' ? cities.filter(c => c.isCoastal).length : 0;
    const numPirates = Math.min(Math.max(4, Math.floor(coastalCount * 1.2)), this.maxPirates);
    for (let i = 0; i < numPirates; i++) {
      this.spawnPirate();
    }
  }

  spawnRaider() {
    if (this.raiders.length >= this.maxRaiders) return;

    // Find patrol points between cities (high-traffic areas)
    const patrolPoints = [];

    // Scale patrol distance with map size
    const mapDim = Math.max(cols || 100, rows || 100);
    const maxPatrolDist = Math.max(25, Math.floor(mapDim / 4));

    // 30% chance to prowl near a single city (more threatening)
    if (Math.random() < 0.3 && cities.length > 0) {
      const city = cities[Math.floor(Math.random() * cities.length)];
      const cx = city.location.x;
      const cy = city.location.y;
      const offsets = [
        { x: cx - 4 - Math.floor(Math.random() * 4), y: cy - 4 - Math.floor(Math.random() * 4) },
        { x: cx + 4 + Math.floor(Math.random() * 4), y: cy - 3 },
        { x: cx + 3, y: cy + 4 + Math.floor(Math.random() * 4) },
        { x: cx - 3, y: cy + 3 },
      ];
      for (const off of offsets) {
        const p = this.findValidPosition(off.x, off.y);
        if (p) patrolPoints.push(p);
      }
    }

    // Otherwise patrol between city pairs
    if (patrolPoints.length < 2) {
      const cityPairs = [];
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
    }

    if (patrolPoints.length < 2) return;

    // 5% chance to spawn a rare monster instead of a normal raider
    let type = 'bandit';
    const monsterRoll = Math.random();
    if (monsterRoll < 0.02) {
      type = 'dragon';
    } else if (monsterRoll < 0.035) {
      type = 'blackKnight';
    } else if (monsterRoll < 0.05) {
      type = 'wraith';
    }

    const raider = new Raider({
      x: patrolPoints[0].x,
      y: patrolPoints[0].y,
      strength: 2 + Math.floor(Math.random() * 4),
      patrolPoints: patrolPoints,
      type: type,
    });

    this.raiders.push(raider);
    return raider;
  }

  /** Spawn a pirate on water, patrolling sea routes between coastal cities */
  spawnPirate() {
    if (this.pirateCount >= this.maxPirates) return;
    if (typeof cities === 'undefined' || !cities.length) return;

    const coastalCities = cities.filter(c => c.isCoastal);
    if (coastalCities.length < 1) return;

    // Pick two different coastal cities for patrol route
    const patrolPoints = [];
    if (coastalCities.length >= 2) {
      const shuffled = coastalCities.slice().sort(() => Math.random() - 0.5);
      const c1 = shuffled[0].location;
      const c2 = shuffled[1].location;

      // Find water positions near each coastal city
      const midX = Math.floor((c1.x + c2.x) / 2);
      const midY = Math.floor((c1.y + c2.y) / 2);

      const p1 = this.findValidWaterPosition(c1.x, c1.y);
      const p2 = this.findValidWaterPosition(c2.x, c2.y);
      const p3 = this.findValidWaterPosition(midX, midY);

      if (p1) patrolPoints.push(p1);
      if (p3) patrolPoints.push(p3);
      if (p2) patrolPoints.push(p2);
    } else {
      // Only 1 coastal city — patrol around it
      const c = coastalCities[0].location;
      for (const [dx, dy] of [[5, 0], [0, 5], [-5, 0], [0, -5]]) {
        const p = this.findValidWaterPosition(c.x + dx, c.y + dy);
        if (p) patrolPoints.push(p);
      }
    }

    if (patrolPoints.length < 2) return;

    const strength = 2 + Math.floor(Math.random() * 5); // 2-6
    const boatType = (typeof getPirateBoatType === 'function')
      ? getPirateBoatType(strength) : 'rowboat';

    const pirate = new Raider({
      x: patrolPoints[0].x,
      y: patrolPoints[0].y,
      strength: strength,
      patrolPoints: patrolPoints,
      type: 'bandit',
      isPirate: true,
      boat: boatType,
    });

    this.raiders.push(pirate);
    return pirate;
  }

  /** BFS to find nearest water tile from (x, y) */
  findValidWaterPosition(x, y) {
    x = Math.max(0, Math.min(cols - 1, x));
    y = Math.max(0, Math.min(rows - 1, y));

    const queue = [{ x, y }];
    const visited = new Set();
    visited.add(`${x},${y}`);

    while (queue.length > 0) {
      const pos = queue.shift();
      if (pos.x >= 0 && pos.x < cols && pos.y >= 0 && pos.y < rows) {
        const tile = grid[pos.y]?.[pos.x];
        if (tile && tile.options[0] === 'Water') {
          return pos;
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

    // Decrement bribed cooldown for all raiders
    for (const raider of this.raiders) {
      if (raider.bribedCooldown > 0) {
        raider.bribedCooldown--;
      }
    }

    // Remove defeated raiders
    this.raiders = this.raiders.filter(r => r.state !== 'defeated');

    // Spawn new bands over time — scale target with cities
    const minRaiders = Math.max(2, Math.floor(this.maxRaiders * 0.4));
    if (this.raiders.length < minRaiders && this.daysSinceSpawn >= this.spawnIntervalDays) {
      this.spawnRaider();
      this.daysSinceSpawn = 0;
    }

    // Small chance of extra spawn even above minimum
    if (this.raiders.length < this.maxRaiders && Math.random() < 0.03) {
      this.spawnRaider();
    }

    // Pirate spawning — 10% daily chance if below cap
    if (this.pirateCount < this.maxPirates && Math.random() < 0.10) {
      this.spawnPirate();
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
    let idx = 0;
    for (const raider of this.raiders) {
      idx++;
      if (raider.state === 'defeated') continue;
      const dist = Math.abs(raider.x - player.x) + Math.abs(raider.y - player.y);
      // Always update nearby raiders and those chasing
      if (raider.state !== 'chasing' && typeof AI_ACTIVE_RADIUS !== 'undefined' && dist > AI_ACTIVE_RADIUS) {
        // Distant patrolling raiders — only update every AI_SLEEP_SKIP frames
        if ((frameCount % AI_SLEEP_SKIP) !== (idx % AI_SLEEP_SKIP)) {
          continue;
        }
      }
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
      if (raider.bribedCooldown > 0) continue;
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

  /**
   * Rebuild per-city raider proximity cache. Call once per frame before rendering.
   * Caches raider counts within the given radius for each city.
   */
  _refreshCityCache(radius) {
    radius = radius || 10;
    if (this._cityCacheFrame === frameCount && this._cityCacheRadius === radius) return;
    this._cityCacheFrame = frameCount;
    this._cityCacheRadius = radius;
    if (!this._cityRaiderCount) this._cityRaiderCount = new Map();
    if (!this._cityRaiderList) this._cityRaiderList = new Map();
    this._cityRaiderCount.clear();
    this._cityRaiderList.clear();
    if (!cities) return;
    for (const r of this.raiders) {
      if (r.state === 'defeated') continue;
      for (let ci = 0; ci < cities.length; ci++) {
        const loc = cities[ci].location;
        const dist = Math.abs(r.x - loc.x) + Math.abs(r.y - loc.y);
        if (dist <= radius) {
          this._cityRaiderCount.set(ci, (this._cityRaiderCount.get(ci) || 0) + 1);
          let list = this._cityRaiderList.get(ci);
          if (!list) { list = []; this._cityRaiderList.set(ci, list); }
          list.push(r);
        }
      }
    }
  }

  /** Get count of raiders near a city (uses per-frame cache) */
  getRaiderCountNearCity(cityIndex, radius) {
    this._refreshCityCache(radius);
    return this._cityRaiderCount.get(cityIndex) || 0;
  }

  /** Get raiders within a radius of a city */
  getRaidersNearCity(cityIndex, radius) {
    this._refreshCityCache(radius);
    return this._cityRaiderList.get(cityIndex) || [];
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
