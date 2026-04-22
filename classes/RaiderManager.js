// RaiderManager.js — Manages all raider bands on the map

function _bqRaiderStream() {
  if (typeof window !== 'undefined' && window.BQSeededRNG && typeof window.BQSeededRNG.stream === 'function') {
    return window.BQSeededRNG.stream('raider:worldgen');
  }
  return null;
}
function _bqRaiderRand() {
  const s = _bqRaiderStream();
  return s ? s.random() : Math.random();
}
function _bqRaiderShuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(_bqRaiderRand() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

function _bqRaiderManagerIsCityTile(x, y) {
  const key = `${x},${y}`;
  if (typeof cityLocationMap !== 'undefined' && cityLocationMap && typeof cityLocationMap.has === 'function') {
    return cityLocationMap.has(key);
  }
  if (typeof cities !== 'undefined' && Array.isArray(cities)) {
    return cities.some((city) => city?.location?.x === x && city?.location?.y === y);
  }
  return false;
}

function _bqActivePlanetCarbonLevel() {
  const root = (typeof window !== 'undefined') ? window : globalThis;
  const getSession = root?.BQGetWorldSession;
  if (typeof getSession !== 'function') return null;
  const session = getSession();
  if (!session || session.sessionType !== 'planet_surface') return null;
  const carbon = Number(session.spaceContext?.carbonLevel);
  return Number.isFinite(carbon) ? carbon : null;
}

class RaiderManager {
  constructor() {
    this.raiders = [];
    this.spawnTimer = 0;
    this.spawnIntervalDays = 2; // New band every 2 days
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

  /** Scale raider limits with map size.
   *  Hard cap prevents excessive A* pathfinding on large maps. */
  get maxRaiders() {
    const cityNum = typeof cities !== 'undefined' ? cities.length : 5;
    return Math.max(8, Math.min(80, Math.floor(cityNum * 1.0)));
  }

  /** Max pirate count scales with coastal cities (hard-capped). */
  get maxPirates() {
    if (typeof cities === 'undefined') return 6;
    const coastal = cities.filter(c => c.isCoastal).length;
    return Math.max(6, Math.min(20, Math.floor(coastal * 1.2)));
  }

  get maxNeutrals() {
    const cityNum = typeof cities !== 'undefined' ? cities.length : 5;
    return Math.max(4, Math.min(18, Math.floor(cityNum * 0.6)));
  }

  /** Current pirate count */
  get pirateCount() {
    return this.raiders.filter(r => r.isPirate && r.state !== 'defeated').length;
  }

  get landHostileCount() {
    return this.raiders.filter(r => !r.isPirate && !r.isNeutral && r.state !== 'defeated').length;
  }

  get neutralCount() {
    return this.raiders.filter(r => r.isNeutral && r.state !== 'defeated').length;
  }

  init() {
    // Build a fast city-occupancy lookup once for spawn-time position checks.
    this._cityPosSet = new Set();
    if (typeof cities !== 'undefined' && Array.isArray(cities)) {
      for (const c of cities) {
        if (c && c.location) this._cityPosSet.add(`${c.location.x},${c.location.y}`);
      }
    }

    const cityNum = typeof cities !== 'undefined' ? cities.length : 5;
    const numRaiders = Math.min(Math.max(4, Math.floor(cityNum * 0.6)), this.maxRaiders);
    for (let i = 0; i < numRaiders; i++) {
      this.spawnRaider();
    }
    const numNeutrals = Math.min(Math.max(2, Math.floor(cityNum * 0.35)), this.maxNeutrals);
    for (let i = 0; i < numNeutrals; i++) {
      this.spawnNeutral();
    }
    // Spawn pirates on water routes between coastal cities
    const coastalCount = typeof cities !== 'undefined' ? cities.filter(c => c.isCoastal).length : 0;
    const numPirates = Math.min(Math.max(4, Math.floor(coastalCount * 1.2)), this.maxPirates);
    for (let i = 0; i < numPirates; i++) {
      this.spawnPirate();
    }
  }

  spawnRaider() {
    if (this.landHostileCount >= this.maxRaiders) return;

    // Find patrol points between cities (high-traffic areas)
    const patrolPoints = [];

    // Scale patrol distance with map size
    const mapDim = Math.max(cols || 100, rows || 100);
    const maxPatrolDist = Math.max(25, Math.floor(mapDim / 4));

    // 30% chance to prowl near a single city (more threatening)
    if (_bqRaiderRand() < 0.3 && cities.length > 0) {
      const city = cities[Math.floor(_bqRaiderRand() * cities.length)];
      const cx = city.location.x;
      const cy = city.location.y;
      const offsets = [
        { x: cx - 4 - Math.floor(_bqRaiderRand() * 4), y: cy - 4 - Math.floor(_bqRaiderRand() * 4) },
        { x: cx + 4 + Math.floor(_bqRaiderRand() * 4), y: cy - 3 },
        { x: cx + 3, y: cy + 4 + Math.floor(_bqRaiderRand() * 4) },
        { x: cx - 3, y: cy + 3 },
      ];
      for (const off of offsets) {
        const p = this.findValidPosition(off.x, off.y);
        if (p) patrolPoints.push(p);
      }
    }

    // Otherwise patrol between city pairs — use random sampling instead of O(C²) enumeration
    if (patrolPoints.length < 2) {
      // Sample up to 30 random city pairs rather than checking all N² combinations
      const SAMPLE_LIMIT = Math.min(cities.length, 30);
      const cityPairs = [];
      const shuffled = _bqRaiderShuffle([...cities.keys()]).slice(0, SAMPLE_LIMIT);
      for (let si = 0; si < shuffled.length; si++) {
        for (let sj = si + 1; sj < shuffled.length; sj++) {
          const i = shuffled[si], j = shuffled[sj];
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
      const pair = cityPairs[Math.floor(_bqRaiderRand() * cityPairs.length)];
      const c1 = cities[pair[0]].location;
      const c2 = cities[pair[1]].location;

      // Midpoint with some offset
      const midX = Math.floor((c1.x + c2.x) / 2) + Math.floor(_bqRaiderRand() * 6) - 3;
      const midY = Math.floor((c1.y + c2.y) / 2) + Math.floor(_bqRaiderRand() * 6) - 3;

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
            Math.floor(_bqRaiderRand() * cols),
            Math.floor(_bqRaiderRand() * rows)
          );
          if (p) patrolPoints.push(p);
        }
      }
    }

    if (patrolPoints.length < 2) return;

    // Planet-exclusive monsters only spawn on planet surfaces with sufficient carbon
    let type = 'bandit';
    const carbonLevel = _bqActivePlanetCarbonLevel();
    const onPlanet = carbonLevel != null;
    const monstersAllowed = onPlanet && carbonLevel >= 50;
    if (monstersAllowed) {
      const monsterRoll = _bqRaiderRand();
      if (monsterRoll < 0.014) {
        type = 'dragon';
      } else if (monsterRoll < 0.028) {
        type = 'blackKnight';
      } else if (monsterRoll < 0.042) {
        type = 'wraith';
      } else if (monsterRoll < 0.056) {
        type = 'sandWorm';
      } else if (monsterRoll < 0.070) {
        type = 'iceGolem';
      } else if (monsterRoll < 0.084) {
        type = 'voidHound';
      } else if (monsterRoll < 0.098) {
        type = 'thornBeast';
      } else if (monsterRoll < 0.110) {
        type = 'magmaSerpent';
      }
    }

    const raider = new Raider({
      x: patrolPoints[0].x,
      y: patrolPoints[0].y,
      strength: 2 + Math.floor(_bqRaiderRand() * 4),
      patrolPoints: patrolPoints,
      type: type,
    });

    this.raiders.push(raider);
    if (typeof raiderGrid !== 'undefined' && raiderGrid && typeof raiderGrid.insert === 'function') {
      raiderGrid.insert(raider, raider.x, raider.y);
    }
    return raider;
  }

  spawnNeutral() {
    if (this.neutralCount >= this.maxNeutrals) return;
    // Grazers are planet-surface fauna — don't spawn on the main world
    if (_bqActivePlanetCarbonLevel() == null) return;

    const anchor = this.findValidPosition(
      Math.floor(_bqRaiderRand() * cols),
      Math.floor(_bqRaiderRand() * rows)
    );
    if (!anchor) return;

    const patrolPoints = [anchor];
    for (let i = 0; i < 3; i++) {
      const p = this.findValidPosition(
        anchor.x + Math.floor(_bqRaiderRand() * 14) - 7,
        anchor.y + Math.floor(_bqRaiderRand() * 14) - 7
      );
      if (p) patrolPoints.push(p);
    }
    if (patrolPoints.length < 2) return;

    const neutral = new Raider({
      x: patrolPoints[0].x,
      y: patrolPoints[0].y,
      strength: 1 + Math.floor(_bqRaiderRand() * 2),
      patrolPoints,
      type: 'grazer',
    });

    this.raiders.push(neutral);
    if (typeof raiderGrid !== 'undefined' && raiderGrid && typeof raiderGrid.insert === 'function') {
      raiderGrid.insert(neutral, neutral.x, neutral.y);
    }
    return neutral;
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
      const shuffled = _bqRaiderShuffle(coastalCities);
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

    const strength = 2 + Math.floor(_bqRaiderRand() * 5); // 2-6
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
    if (typeof raiderGrid !== 'undefined' && raiderGrid && typeof raiderGrid.insert === 'function') {
      raiderGrid.insert(pirate, pirate.x, pirate.y);
    }
    return pirate;
  }

  /** BFS to find nearest water tile from (x, y) */
  findValidWaterPosition(x, y) {
    x = Math.max(0, Math.min(cols - 1, x));
    y = Math.max(0, Math.min(rows - 1, y));

    const queue = [{ x, y }];
    let qi = 0;
    const visited = new Set();
    visited.add(`${x},${y}`);

    while (qi < queue.length) {
      const pos = queue[qi++];
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
    let qi = 0;
    const visited = new Set();
    visited.add(`${x},${y}`);

    while (qi < queue.length) {
      const pos = queue[qi++];
      if (pos.x >= 0 && pos.x < cols && pos.y >= 0 && pos.y < rows) {
        const tile = grid[pos.y]?.[pos.x];
        if (tile && tile.options[0] !== 'Water') {
          const isCity = this._cityPosSet
            ? this._cityPosSet.has(`${pos.x},${pos.y}`)
            : cities.some(c => c.location.x === pos.x && c.location.y === pos.y);
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

    // Remove defeated raiders — clean up spatial grid before splicing array
    if (typeof raiderGrid !== 'undefined' && raiderGrid && typeof raiderGrid.remove === 'function') {
      for (const r of this.raiders) {
        if (r.state === 'defeated') raiderGrid.remove(r);
      }
    }
    this.raiders = this.raiders.filter(r => r.state !== 'defeated');

    // Spawn new bands over time — one every spawnIntervalDays days when below minimum
    const minRaiders = Math.max(3, Math.floor(this.maxRaiders * 0.6));
    if (this.landHostileCount < minRaiders && this.daysSinceSpawn >= this.spawnIntervalDays) {
      this.spawnRaider();
      this.daysSinceSpawn = 0;
    }

    // Chance of extra spawn even above minimum (scales up when population is low)
    const deficit = this.maxRaiders - this.landHostileCount;
    const extraChance = 0.04 + (deficit / this.maxRaiders) * 0.06; // 4-10% based on deficit
    if (this.landHostileCount < this.maxRaiders && _bqRaiderRand() < extraChance) {
      this.spawnRaider();
    }

    if (this.neutralCount < this.maxNeutrals && _bqRaiderRand() < 0.12) {
      this.spawnNeutral();
    }

    // Pirate spawning pressure ramps by day + difficulty.
    const day = (typeof dayNight !== 'undefined' && dayNight.getDaysElapsed) ? dayNight.getDaysElapsed() : 0;
    const diff = window._newGameDifficulty || 'normal';
    const rampStart = { easy: 12, normal: 10, hard: 8, hardcore: 6 }[diff] ?? 10;
    const baseChance = { easy: 0.06, normal: 0.10, hard: 0.14, hardcore: 0.18 }[diff] ?? 0.10;
    const progress = day < rampStart ? 0 : Math.min(1, (day - rampStart) / 25);
    const pirateSpawnChance = Math.min(0.55, baseChance + progress * 0.25);
    if (this.pirateCount < this.maxPirates && _bqRaiderRand() < pirateSpawnChance) {
      this.spawnPirate();
    }

    // Raiders intercept NPC traders (simulated)
    if (typeof traderManager !== 'undefined') {
      for (const raider of this.raiders) {
        if (raider.state === 'defeated' || raider.isNeutral) continue;
        for (const trader of traderManager.traders) {
          if (trader.state !== 'traveling') continue;
          const dist = Math.abs(raider.x - trader.x) + Math.abs(raider.y - trader.y);
          if (dist <= raider.detectionRadius && _bqRaiderRand() < 0.3) {
            // Trader loses some goods
            const items = [...trader.inventory.keys()];
            if (items.length > 0) {
              const stolen = items[Math.floor(_bqRaiderRand() * items.length)];
              const entry = trader.inventory.get(stolen);
              const lostQty = Math.min(entry.quantity, 1 + Math.floor(_bqRaiderRand() * 3));
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
    const abstractSkipDist = typeof AI_ABSTRACT_RADIUS !== 'undefined' ? AI_ABSTRACT_RADIUS * 2 : 300;
    let idx = 0;
    for (const raider of this.raiders) {
      idx++;
      if (raider.state === 'defeated') continue;
      const dist = Math.abs(raider.x - player.x) + Math.abs(raider.y - player.y);

      // Very distant patrolling raiders — freeze entirely (player can't see or interact)
      if (raider.state === 'patrolling' && dist > abstractSkipDist) continue;

      // Moderately distant patrolling raiders — throttle to every AI_SLEEP_SKIP frames
      if (raider.state !== 'chasing' && typeof AI_ACTIVE_RADIUS !== 'undefined' && dist > AI_ACTIVE_RADIUS) {
        if ((frameCount % AI_SLEEP_SKIP) !== (idx % AI_SLEEP_SKIP)) continue;
      }

      raider.update(dt, player.x, player.y);
    }
  }

  render(tileSize) {
    // queryViewport() returns only raiders in cells overlapping the viewport
    if (typeof raiderGrid !== 'undefined' && raiderGrid && typeof raiderGrid.queryViewport === 'function') {
      for (const raider of raiderGrid.queryViewport()) {
        raider.render(tileSize);
      }
    } else {
      for (const raider of this.raiders) raider.render(tileSize);
    }
  }

  // Check if player stepped on a raider
  checkPlayerCollision(playerX, playerY) {
    if (_bqRaiderManagerIsCityTile(playerX, playerY)) return null;
    for (const raider of this.raiders) {
      if (raider.state === 'defeated') continue;
      if (raider.bribedCooldown > 0) continue;
      if (raider.x === playerX && raider.y === playerY) {
        return raider;
      }
      // Also check if raider is adjacent and chasing
      if (!raider.isNeutral && raider.state === 'chasing') {
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
      if (r.state === 'defeated' || r.isNeutral) continue;
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

  /**
   * Return active raiders in an axis-aligned tile rectangle.
   * Uses spatial grid cells when available for near-O(local area) lookups.
   */
  getRaidersInRect(minX, maxX, minY, maxY, opts = {}) {
    const includeNeutral = !!opts.includeNeutral;
    const result = [];

    if (typeof raiderGrid !== 'undefined' && raiderGrid && raiderGrid._cells) {
      const cs = raiderGrid._cs || 32;
      const minCX = Math.floor(minX / cs);
      const maxCX = Math.floor(maxX / cs);
      const minCY = Math.floor(minY / cs);
      const maxCY = Math.floor(maxY / cs);

      for (let cy = minCY; cy <= maxCY; cy++) {
        for (let cx = minCX; cx <= maxCX; cx++) {
          const cell = raiderGrid._cells.get(`${cx},${cy}`);
          if (!cell) continue;
          for (const raider of cell) {
            if (!raider || raider.state === 'defeated') continue;
            if (!includeNeutral && raider.isNeutral) continue;
            if (raider.x < minX || raider.x > maxX || raider.y < minY || raider.y > maxY) continue;
            result.push(raider);
          }
        }
      }
      return result;
    }

    for (const raider of this.raiders) {
      if (!raider || raider.state === 'defeated') continue;
      if (!includeNeutral && raider.isNeutral) continue;
      if (raider.x < minX || raider.x > maxX || raider.y < minY || raider.y > maxY) continue;
      result.push(raider);
    }
    return result;
  }

  toJSON() {
    return { raiders: this.raiders.map(r => r.toJSON()), daysSinceSpawn: this.daysSinceSpawn };
  }

  static fromJSON(data) {
    const mgr = new RaiderManager();
    // Support old saves (plain array) and new saves (object with metadata)
    const dataArray = Array.isArray(data) ? data : (data.raiders || []);
    mgr.raiders = dataArray.map(d => Raider.fromJSON(d));
    mgr.daysSinceSpawn = Array.isArray(data) ? 0 : (data.daysSinceSpawn || 0);
    return mgr;
  }
}
