// TreasureSystem.js — Treasure map fragments, dig sites, and rewards

class TreasureSystem {
  constructor() {
    this.fragments = [];     // collected fragments: { region, terrain, id }
    this.assembledMaps = []; // completed maps ready to dig: { region, digX, digY, id }
    this.completedDigs = []; // history
    this.digSites = [];      // active dig site markers on the world map
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
      notificationManager.log(`🗺️ Found a treasure map fragment (${fragment.region})!`, 'success');
    }

    // Try to assemble
    this._tryAssemble();
    return true;
  }

  /** Generate a random fragment based on player position */
  generateFragment() {
    const terrain = typeof grid !== 'undefined' && grid[player.y]?.[player.x]
      ? grid[player.y][player.x].options[0] : 'Grass';

    // Region based on quadrant of map
    const midX = (typeof cols !== 'undefined' ? cols : 100) / 2;
    const midY = (typeof rows !== 'undefined' ? rows : 100) / 2;
    let region;
    if (player.x < midX && player.y < midY) region = 'Northwest';
    else if (player.x >= midX && player.y < midY) region = 'Northeast';
    else if (player.x < midX && player.y >= midY) region = 'Southwest';
    else region = 'Southeast';

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
      notificationManager.log(`🗺️ Treasure map assembled! A dig site has been marked in the ${region}!`, 'success');
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

    if (typeof minigameManager !== 'undefined') {
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
        notificationManager.log(`💎 Treasure found! ${finalGold}g + ${found.join(', ')}!`, 'success');
      }
    } else {
      // Failed — chest vanishes
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`🔒 Failed to pick the lock! The chest crumbles to dust.`, 'error');
      }
    }

    if (typeof gameStateManager !== 'undefined' && gameStateManager.is(GameStates.MINIGAME)) {
      gameStateManager.setState(GameStates.PLAYING);
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
      text('✕', px + tileSize / 2, py + tileSize / 2);

      // Pulsing ring
      const pulse = Math.sin(millis() / 400) * 3;
      noFill();
      stroke(255, 215, 0, 150);
      strokeWeight(2);
      ellipse(px + tileSize / 2, py + tileSize / 2, tileSize + pulse, tileSize + pulse);
      pop();
    }
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
    };
  }

  static fromJSON(data) {
    const ts = new TreasureSystem();
    ts.fragments = data.fragments || [];
    ts.assembledMaps = data.assembledMaps || [];
    ts.digSites = data.digSites || [];
    ts.completedDigs = data.completedDigs || [];
    return ts;
  }
}
