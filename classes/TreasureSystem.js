// TreasureSystem.js — Treasure map fragments, dig sites, and rewards

class TreasureSystem {
  constructor() {
    this.fragments = [];     // collected fragments: { region, terrain, id }
    this.assembledMaps = []; // completed maps ready to dig: { region, digX, digY, id }
    this.completedDigs = []; // history
    this.digSites = [];      // active dig site markers on the world map
    this.timedCache = null;  // one short-lived rumor cache per world session
    this.nextCacheInMs = this._rollNextCacheDelay();
  }

  static get CACHE_DIFFICULTY() {
    return {
      easy:     { lifetimeMs: 120000, minDistance: 15, maxDistance: 45, rewardMultiplier: 0.90 },
      normal:   { lifetimeMs: 100000, minDistance: 25, maxDistance: 65, rewardMultiplier: 1.00 },
      hard:     { lifetimeMs: 80000,  minDistance: 35, maxDistance: 80, rewardMultiplier: 1.10 },
      hardcore: { lifetimeMs: 60000,  minDistance: 45, maxDistance: 95, rewardMultiplier: 1.20 },
    };
  }

  _rollNextCacheDelay() {
    // A game day is 120 seconds at normal speed. The caller advances this
    // cooldown with scaled game time while the cache lifetime uses real time.
    return (2 + Math.random()) * 120000;
  }

  _cacheConfig() {
    const key = (typeof window !== 'undefined' && window._newGameDifficulty) || 'normal';
    const fallback = TreasureSystem.CACHE_DIFFICULTY[key] || TreasureSystem.CACHE_DIFFICULTY.normal;
    const active = (typeof window !== 'undefined' && window.DIFFICULTY_CONFIG) || {};
    return {
      lifetimeMs: Math.max(1000, Number(active.timedCacheLifetimeSeconds) * 1000 || fallback.lifetimeMs),
      minDistance: Math.max(1, Math.floor(Number(active.timedCacheMinDistance) || fallback.minDistance)),
      maxDistance: Math.max(2, Math.floor(Number(active.timedCacheMaxDistance) || fallback.maxDistance)),
      rewardMultiplier: Math.max(0.1, Number(active.timedCacheRewardMultiplier) || fallback.rewardMultiplier),
    };
  }

  /** Advance rumor caches. Call only during active, unpaused surface exploration.
   * @param {number} playableMs unscaled real time (controls the visible deadline)
   * @param {number} gameMs scaled game time (controls the 2-3 game-day spawn cadence)
   */
  update(playableMs, gameMs = playableMs) {
    const realDelta = Math.max(0, Number(playableMs) || 0);
    const gameDelta = Math.max(0, Number(gameMs) || 0);
    if (this.timedCache) {
      this.timedCache.remainingMs = Math.max(0, this.timedCache.remainingMs - realDelta);
      if (this.timedCache.remainingMs <= 0) this._expireTimedCache();
      return;
    }
    this.nextCacheInMs = Math.max(0, this.nextCacheInMs - gameDelta);
    if (this.nextCacheInMs <= 0 && !this._spawnTimedCache()) {
      // Try again soon if the player is at sea or no suitable tile is available.
      this.nextCacheInMs = 10000;
    }
  }

  _spawnTimedCache() {
    if (this.timedCache || typeof player === 'undefined' || typeof grid === 'undefined') return false;
    const config = this._cacheConfig();
    const spot = this._findReachableCacheTile(config.minDistance, config.maxDistance);
    if (!spot) return false;
    const tierRoll = Math.random();
    const tier = tierRoll < 0.75 ? 'common' : (tierRoll < 0.97 ? 'merchant' : 'relic');
    const baseBudgets = { common: 50, merchant: 125, relic: 250 };
    const budget = Math.max(10, Math.round(baseBudgets[tier] * config.rewardMultiplier));
    this.timedCache = {
      id: `cache_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      x: spot.x,
      y: spot.y,
      routeDistance: spot.distance,
      tier,
      loot: this._rollCacheLoot(budget),
      remainingMs: config.lifetimeMs,
      lifetimeMs: config.lifetimeMs,
    };
    this.nextCacheInMs = this._rollNextCacheDelay();
    if (typeof notificationManager !== 'undefined') {
      const direction = this._directionTo(this.timedCache.x, this.timedCache.y);
      notificationManager.log(
        `\uD83D\uDCE6 ${tier[0].toUpperCase() + tier.slice(1)} cache rumored ${direction} — ${spot.distance} tiles away!`,
        'success'
      );
    }
    return true;
  }

  _findReachableCacheTile(minDistance, maxDistance) {
    const sx = Math.floor(Number(player.x));
    const sy = Math.floor(Number(player.y));
    if (!grid[sy]?.[sx] || grid[sy][sx].options?.[0] === 'Water') return null;
    const occupied = new Set();
    if (typeof cities !== 'undefined' && Array.isArray(cities)) {
      for (const city of cities) occupied.add(`${city?.location?.x},${city?.location?.y}`);
    }
    for (const site of this.digSites) occupied.add(`${site.x},${site.y}`);
    if (typeof contractSystem !== 'undefined' && contractSystem) {
      for (const contract of contractSystem.active || []) {
        for (const point of contract.surveyPoints || []) occupied.add(`${point.x},${point.y}`);
      }
    }

    const width = Number(typeof cols !== 'undefined' ? cols : grid[0]?.length) || 0;
    const height = Number(typeof rows !== 'undefined' ? rows : grid.length) || 0;
    const queue = [{ x: sx, y: sy, distance: 0 }];
    const seen = new Set([`${sx},${sy}`]);
    const preferred = [];
    const fallback = [];
    for (let head = 0; head < queue.length; head++) {
      const node = queue[head];
      if (node.distance >= 5 && !occupied.has(`${node.x},${node.y}`)) {
        fallback.push(node);
        if (node.distance >= minDistance) preferred.push(node);
      }
      if (node.distance >= maxDistance) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = node.x + dx;
        const y = node.y + dy;
        const key = `${x},${y}`;
        if (x < 0 || y < 0 || x >= width || y >= height || seen.has(key)) continue;
        seen.add(key);
        if (!grid[y]?.[x] || grid[y][x].options?.[0] === 'Water') continue;
        queue.push({ x, y, distance: node.distance + 1 });
      }
    }
    const pool = preferred.length ? preferred : fallback;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }

  _rollCacheLoot(budget) {
    const allowlist = ['Wheat', 'Fish', 'Clay', 'Wood', 'Stone', 'Salt', 'Herbs', 'Fur',
      'Bread', 'Tools', 'Pottery', 'SaltedFish', 'Jewelry', 'Spices', 'Wine', 'Silk'];
    const candidates = allowlist.filter(name => {
      const item = typeof ItemLibrary !== 'undefined' ? ItemLibrary[name] : null;
      if (!item || item.tradable === false) return false;
      if (['Space', 'Book', 'Weapon', 'Contraband'].includes(item.category)) return false;
      return (Number(item.baseValue) || 0) > 0 && (Number(item.baseValue) || 0) <= budget;
    });
    const loot = new Map();
    let remaining = budget;
    let guard = 0;
    while (candidates.length && guard++ < 12) {
      const affordable = candidates.filter(name => Number(ItemLibrary[name].baseValue) <= remaining);
      if (!affordable.length) break;
      const name = affordable[Math.floor(Math.random() * affordable.length)];
      loot.set(name, (loot.get(name) || 0) + 1);
      remaining -= Number(ItemLibrary[name].baseValue);
    }
    if (!loot.size && candidates.length) loot.set(candidates[0], 1);
    return [...loot.entries()].map(([name, quantity]) => ({ name, quantity }));
  }

  _expireTimedCache() {
    if (!this.timedCache) return;
    this.timedCache = null;
    this.nextCacheInMs = this._rollNextCacheDelay();
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log('\u231B The rumored cache vanished before you reached it.', 'warning');
    }
  }

  _directionTo(x, y) {
    if (typeof player === 'undefined') return 'nearby';
    const dx = x - player.x;
    const dy = y - player.y;
    const vertical = dy < -2 ? 'north' : (dy > 2 ? 'south' : '');
    const horizontal = dx < -2 ? 'west' : (dx > 2 ? 'east' : '');
    return vertical && horizontal ? `${vertical}-${horizontal}` : (vertical || horizontal || 'nearby');
  }

  getTimedCacheStatus() {
    if (!this.timedCache) return null;
    return {
      ...this.timedCache,
      direction: this._directionTo(this.timedCache.x, this.timedCache.y),
      secondsRemaining: Math.max(0, Math.ceil(this.timedCache.remainingMs / 1000)),
    };
  }

  getTimedCacheAtPlayer() {
    if (!this.timedCache || typeof player === 'undefined') return null;
    return Math.abs(player.x - this.timedCache.x) <= 1 && Math.abs(player.y - this.timedCache.y) <= 1
      ? this.timedCache : null;
  }

  /** Collect as much as current capacity permits. Remaining loot stays until expiry. */
  collectTimedCache() {
    const cache = this.getTimedCacheAtPlayer();
    if (!cache || typeof player === 'undefined') return { ok: false, reason: 'not_nearby' };
    const collected = [];
    for (const entry of cache.loot) {
      const item = typeof ItemLibrary !== 'undefined' ? ItemLibrary[entry.name] : null;
      const weight = Math.max(1, Number(item?.weight) || 1);
      const free = Math.max(0, (player.getEffectiveCargoCapacity?.() || player.cargoCapacity || 0) - player.getCargoWeight());
      const quantity = Math.min(entry.quantity, Math.floor(free / weight));
      if (quantity > 0 && player.addItem({ name: entry.name, quantity })) {
        entry.quantity -= quantity;
        collected.push({ name: entry.name, quantity });
      }
    }
    cache.loot = cache.loot.filter(entry => entry.quantity > 0);
    const complete = cache.loot.length === 0;
    if (complete) {
      if (Math.random() < 0.10) this.addFragment(this.generateFragment());
      this.timedCache = null;
      this.nextCacheInMs = this._rollNextCacheDelay();
    }
    if (typeof notificationManager !== 'undefined') {
      if (collected.length) {
        notificationManager.log(`\uD83C\uDF81 Cache opened: ${collected.map(e => `${e.quantity}\u00D7 ${e.name}`).join(', ')}${complete ? '!' : '. Make room for the rest!'}`, complete ? 'success' : 'info');
      } else {
        notificationManager.log('Cargo full — make room before the cache expires!', 'warning');
      }
    }
    return { ok: collected.length > 0, complete, collected, remaining: cache.loot || [] };
  }

  // ─── Fragment management ────────────────────────────────

  /** Add a treasure map fragment. Auto-attempts assembly.
   *  Accepts either a region string (e.g. 'northern') or a full fragment object. */
  addFragment(fragment) {
    if (!fragment) return false;

    // Normalise string shorthand: addFragment('northern') → { region: 'northern', ... }
    if (typeof fragment === 'string') {
      fragment = { region: fragment, terrain: 'unknown' };
    }

    if (!fragment.region) return false;

    this.fragments.push({
      id: fragment.id || `frag_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      region: fragment.region,
      terrain: fragment.terrain || 'unknown',
    });

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`\uD83D\uDDFA\uFE0F Found a treasure map fragment (${fragment.region})!`, 'success');
    }

    // Try to assemble
    this._tryAssemble();
    return true;
  }

  /** Generate a random fragment based on player position */
  generateFragment() {
    const terrain = typeof grid !== 'undefined' && grid[player.y]?.[player.x]
      ? grid[player.y][player.x].options[0] : 'Grass';

    // Region based on player position — uses the same compass names as events/combat
    // so fragments from all sources can combine in _tryAssemble.
    const midX = (typeof cols !== 'undefined' ? cols : 100) / 2;
    const midY = (typeof rows !== 'undefined' ? rows : 100) / 2;
    const inCenterX = player.x >= midX * 0.4 && player.x <= midX * 1.6;
    const inCenterY = player.y >= midY * 0.4 && player.y <= midY * 1.6;
    let region;
    if (inCenterX && inCenterY) region = 'central';
    else if (player.y < midY && player.x >= midX) region = 'eastern';
    else if (player.y >= midY && player.x < midX) region = 'western';
    else if (player.y < midY) region = 'northern';
    else region = 'southern';

    return {
      region,
      terrain,
      id: `frag_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    };
  }

  /** Check if 3 same-region fragments can form a map */
  _tryAssemble() {
    const regionCounts = {};
    for (const f of this.fragments) {
      regionCounts[f.region] = (regionCounts[f.region] || 0) + 1;
    }

    for (const [region, count] of Object.entries(regionCounts)) {
      if (count >= 3) {
        this._assembleMap(region);
        return;
      }
    }
  }

  _assembleMap(region) {
    // Remove 3 fragments of this region
    let removed = 0;
    for (let i = this.fragments.length - 1; i >= 0 && removed < 3; i--) {
      if (this.fragments[i].region === region) {
        this.fragments.splice(i, 1);
        removed++;
      }
    }

    // Generate dig site location in the correct quadrant
    const maxX = typeof cols !== 'undefined' ? cols : 100;
    const maxY = typeof rows !== 'undefined' ? rows : 100;
    const midX = maxX / 2;
    const midY = maxY / 2;
    let minDX, maxDX, minDY, maxDY;

    switch (region) {
      case 'Northwest': minDX = 2; maxDX = midX - 2; minDY = 2; maxDY = midY - 2; break;
      case 'Northeast': minDX = midX + 2; maxDX = maxX - 2; minDY = 2; maxDY = midY - 2; break;
      case 'Southwest': minDX = 2; maxDX = midX - 2; minDY = midY + 2; maxDY = maxY - 2; break;
      case 'Southeast': minDX = midX + 2; maxDX = maxX - 2; minDY = midY + 2; maxDY = maxY - 2; break;
      // Event/combat callers use lowercase compass names — map them to quadrant ranges
      case 'northern':  minDX = 2; maxDX = maxX - 2; minDY = 2; maxDY = midY - 2; break;
      case 'southern':  minDX = 2; maxDX = maxX - 2; minDY = midY + 2; maxDY = maxY - 2; break;
      case 'eastern':   minDX = midX + 2; maxDX = maxX - 2; minDY = 2; maxDY = maxY - 2; break;
      case 'western':   minDX = 2; maxDX = midX - 2; minDY = 2; maxDY = maxY - 2; break;
      case 'central':   minDX = Math.floor(midX * 0.4); maxDX = Math.floor(midX * 1.6); minDY = Math.floor(midY * 0.4); maxDY = Math.floor(midY * 1.6); break;
      default: minDX = 10; maxDX = maxX - 10; minDY = 10; maxDY = maxY - 10;
    }

    // Find a valid land tile
    let digX, digY, attempts = 0;
    do {
      digX = Math.floor(minDX + Math.random() * (maxDX - minDX));
      digY = Math.floor(minDY + Math.random() * (maxDY - minDY));
      attempts++;
    } while (
      attempts < 200 &&
      typeof grid !== 'undefined' &&
      grid[digY]?.[digX]?.options[0] === 'Water'
    );

    const mapEntry = {
      id: `map_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      region,
      digX,
      digY,
    };

    this.assembledMaps.push(mapEntry);
    this.digSites.push({ x: digX, y: digY, mapId: mapEntry.id });

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`\uD83D\uDDFA\uFE0F Treasure map assembled! A dig site has been marked in the ${region}!`, 'success');
    }
  }

  // ─── Dig site interaction ───────────────────────────────

  /** Check if player is standing on a dig site. Returns the site or null. */
  getDigSiteAtPlayer() {
    if (typeof player === 'undefined') return null;
    for (const site of this.digSites) {
      if (Math.abs(player.x - site.x) <= 1 && Math.abs(player.y - site.y) <= 1) {
        return site;
      }
    }
    return null;
  }

  /** Attempt to dig at a site. Launches lock-picking minigame. */
  startDig(site, onComplete) {
    if (!site) return;

    if (typeof minigameManager !== 'undefined' && minigameManager) {
      minigameManager.launch('lockpicking', { tumblers: 4, timeLimit: 20 }, (result) => {
        this._resolveDig(site, result);
        if (onComplete) onComplete(result);
      });
      if (typeof gameStateManager !== 'undefined') {
        gameStateManager.setState(GameStates.MINIGAME);
      }
    }
  }

  _resolveDig(site, result) {
    // Remove dig site regardless of success
    const idx = this.digSites.findIndex(s => s.mapId === site.mapId);
    if (idx >= 0) this.digSites.splice(idx, 1);
    const mapIdx = this.assembledMaps.findIndex(m => m.id === site.mapId);
    if (mapIdx >= 0) this.assembledMaps.splice(mapIdx, 1);

    if (result && result.success) {
      // Calculate reward based on distance from nearest city
      let minDist = Infinity;
      if (typeof cities !== 'undefined') {
        for (const c of cities) {
          const d = Math.abs(site.x - c.location.x) + Math.abs(site.y - c.location.y);
          if (d < minDist) minDist = d;
        }
      }
      const distBonus = Math.min(3, minDist / 20); // up to 3× for remote locations

      const baseGold = 100 + Math.floor(Math.random() * 200);
      const gold = Math.floor(baseGold * (1 + distBonus));

      // Check for Treasure Hunter's Guide bonus (set in player.modifiers by recalcModifiers)
      const bookBonus = (typeof player !== 'undefined' && player.modifiers?.treasureValueBonus) ? player.modifiers.treasureValueBonus : 0;
      const finalGold = Math.floor(gold * (1 + bookBonus));

      player.earnGold(finalGold);

      // Random items
      const treasureItems = ['Jewelry', 'Spices', 'Silk', 'Wine', 'Salt'];
      const numItems = 1 + Math.floor(Math.random() * 3);
      const found = [];
      for (let i = 0; i < numItems; i++) {
        const item = treasureItems[Math.floor(Math.random() * treasureItems.length)];
        player.addItem({ name: item, quantity: 1 });
        found.push(item);
      }

      this.completedDigs.push({ site, gold: finalGold, items: found });

      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`\uD83D\uDC8E Treasure found! ${finalGold}g + ${found.join(', ')}!`, 'success');
      }
    } else {
      // Failed — chest vanishes
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`\uD83D\uDD12 Failed to pick the lock! The chest crumbles to dust.`, 'error');
      }
    }

    if (typeof gameStateManager !== 'undefined' && gameStateManager.is(GameStates.MINIGAME)) {
      const returnState = (typeof window !== 'undefined' && typeof window.BQGetSurfaceGameplayState === 'function')
        ? window.BQGetSurfaceGameplayState()
        : GameStates.PLAYING;
      gameStateManager.setState(returnState);
    }
  }

  // ─── Rendering dig sites on map ─────────────────────────

  /** Draw X markers on dig sites (called in draw() during PLAYING) */
  renderDigSites(tileSize) {
    for (const site of this.digSites) {
      const px = site.x * tileSize;
      const py = site.y * tileSize;
      if (!isOnScreen(px + tileSize / 2, py + tileSize / 2)) continue;

      push();
      fill(255, 50, 50, 180);
      noStroke();
      textAlign(CENTER, CENTER);
      textSize(tileSize * 0.8);
      text('\u2715', px + tileSize / 2, py + tileSize / 2);

      // Pulsing ring
      const pulse = Math.sin(millis() / 400) * 3;
      noFill();
      stroke(255, 215, 0, 150);
      strokeWeight(2);
      ellipse(px + tileSize / 2, py + tileSize / 2, tileSize + pulse, tileSize + pulse);
      pop();
    }
  }

  renderTimedCache(tileSize) {
    const cache = this.timedCache;
    if (!cache) return;
    const cx = cache.x * tileSize + tileSize / 2;
    const cy = cache.y * tileSize + tileSize / 2;
    if (typeof isOnScreen === 'function' && !isOnScreen(cx, cy)) return;
    push();
    const pulse = 1 + Math.sin((typeof millis === 'function' ? millis() : Date.now()) / 180) * 0.12;
    noStroke();
    fill(255, 196, 45, 55);
    ellipse(cx, cy, tileSize * 2.2 * pulse, tileSize * 2.2 * pulse);
    fill(255, 220, 90);
    textAlign(CENTER, CENTER);
    textSize(tileSize * 0.8);
    text('\uD83D\uDCE6', cx, cy);
    fill(255, 245, 190);
    textSize(Math.max(8, tileSize * 0.25));
    text(`${Math.ceil(cache.remainingMs / 1000)}s`, cx, cy - tileSize * 0.65);
    pop();
  }

  // ─── Fragment drop chance (decreases as player gets richer) ──

  getFragmentDropChance() {
    const baseChance = 0.15;
    const goldPenalty = Math.min(0.10, (player.gold / (window._newGameGoldTarget || 5000)) * 0.10);
    return Math.max(0.03, baseChance - goldPenalty);
  }

  // ─── Serialization ──────────────────────────────────────

  toJSON() {
    return {
      fragments: this.fragments,
      assembledMaps: this.assembledMaps,
      digSites: this.digSites,
      completedDigs: this.completedDigs.slice(-10),
      timedCache: this.timedCache,
      nextCacheInMs: this.nextCacheInMs,
    };
  }

  static fromJSON(data) {
    const ts = new TreasureSystem();
    ts.fragments = data.fragments || [];
    ts.assembledMaps = data.assembledMaps || [];
    ts.digSites = data.digSites || [];
    ts.completedDigs = data.completedDigs || [];
    ts.timedCache = data.timedCache || null;
    ts.nextCacheInMs = Number.isFinite(Number(data.nextCacheInMs))
      ? Math.max(0, Number(data.nextCacheInMs))
      : ts._rollNextCacheDelay();
    return ts;
  }
}
