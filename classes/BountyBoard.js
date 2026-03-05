// BountyBoard.js — Named raider bounties posted at cities

/** Pool of raider name prefixes and suffixes for unique named raiders */
const RAIDER_NAME_POOL = {
  prefixes: [
    'Blackjaw', 'Red Scar', 'Iron Fang', 'Crimson', 'Shadow', 'Grim',
    'Bloody', 'Mad', 'Dread', 'Vile', 'Cruel', 'One-Eye', 'Ghost',
    'Bone', 'Thunder', 'Frost', 'Sly', 'Rotten', 'Wild', 'Dark',
    'Ash', 'Storm', 'Venom', 'Copper', 'Silver', 'Scarlet', 'Hollow',
  ],
  suffixes: [
    'the Marauder', 'the Savage', 'the Cruel', 'the Feared', 'of Ironpeak',
    'the Butcher', 'Bloodhand', 'of the Wastes', 'the Hunter', 'Razorblade',
    'the Wretched', 'the Beast', 'Firebrand', 'Ironclaw', 'the Terrible',
    'the Dread', 'of the Shadows', 'Skullcrusher', 'the Merciless',
    'Stormborn', 'Nightwalker', 'the Relentless', 'Deathwhisper',
  ],
};

class BountyBoard {
  constructor() {
    this.bounties = [];       // all active bounties: { id, raiderRef, name, type, reward, deadline, citySource, claimed }
    this.claimable = [];      // defeated bounty targets ready to collect
    this.completed = [];      // history
    this.refreshIntervalDays = 7;
    this._lastRefreshDay = 0;
    this._usedNames = new Set();

    this._onDayChanged = () => this.onDayChanged();
    window.addEventListener('dayChanged', this._onDayChanged);
  }

  destroy() {
    window.removeEventListener('dayChanged', this._onDayChanged);
  }

  // ─── Name generation ─────────────────────────────────────

  _generateName() {
    const { prefixes, suffixes } = RAIDER_NAME_POOL;
    let name, attempts = 0;
    do {
      const pre = prefixes[Math.floor(Math.random() * prefixes.length)];
      const suf = suffixes[Math.floor(Math.random() * suffixes.length)];
      name = `${pre} ${suf}`;
      attempts++;
    } while (this._usedNames.has(name) && attempts < 50);
    this._usedNames.add(name);
    return name;
  }

  // ─── Bounty generation ──────────────────────────────────

  /** Generate bounties for a city. Called on refresh. */
  generateForCity(city) {
    if (!city || (city.population || 0) < 600) return [];

    const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;
    const count = 2 + Math.floor(Math.random() * 3); // 2-4
    const newBounties = [];

    for (let i = 0; i < count; i++) {
      const isBoss = Math.random() < 0.10;
      const type = isBoss ? 'boss' : ['bandit', 'marauder', 'raider', 'scout'][Math.floor(Math.random() * 4)];
      const strength = isBoss ? (6 + Math.floor(Math.random() * 4)) : (2 + Math.floor(Math.random() * 4));
      // Scale rewards with game progression — bounties become worth pursuing later
      const dayScale = 1 + Math.min(2.0, day / 30) * 0.6; // 1.0 at day 0, up to 2.2 at day 50+
      const baseReward = isBoss
        ? Math.floor((800 + Math.floor(Math.random() * 700)) * dayScale)
        : Math.floor((100 + strength * 55 + Math.floor(Math.random() * 75)) * dayScale);

      // Find a nearby raider to assign as target (or create a virtual one)
      let targetRaider = null;
      if (typeof raiderManager !== 'undefined') {
        const nearby = raiderManager.raiders.filter(r =>
          !r.bountyId && r.state !== 'defeated' &&
          Math.abs(r.x - city.location.x) + Math.abs(r.y - city.location.y) < 30
        );
        if (nearby.length > 0) {
          targetRaider = nearby[Math.floor(Math.random() * nearby.length)];
        }
      }

      const bounty = {
        id: `bounty_${day}_${Math.random().toString(36).slice(2, 6)}`,
        name: this._generateName(),
        type,
        strength,
        reward: baseReward,
        deadline: day + 10 + Math.floor(Math.random() * 11), // 10-20 days
        citySource: city.name,
        lastKnownTerrain: this._randomTerrain(),
        claimed: false,
        isBoss,
      };

      // Link to real raider if found
      if (targetRaider) {
        targetRaider.bountyId = bounty.id;
        bounty.raiderLinked = true;
        bounty.lastKnownX = targetRaider.x;
        bounty.lastKnownY = targetRaider.y;
      } else {
        bounty.raiderLinked = false;
        // Virtual bounty — will match any raider of that type killed
        bounty.lastKnownX = city.location.x + Math.floor(Math.random() * 20) - 10;
        bounty.lastKnownY = city.location.y + Math.floor(Math.random() * 20) - 10;
      }

      newBounties.push(bounty);
    }

    this.bounties.push(...newBounties);
    return newBounties;
  }

  _randomTerrain() {
    const terrains = ['Forest', 'Rock', 'Sand', 'Grass', 'Snow'];
    return terrains[Math.floor(Math.random() * terrains.length)];
  }

  // ─── Combat integration ─────────────────────────────────

  /** Called when a raider is defeated in combat. Checks for bounty match. */
  onRaiderDefeated(raider) {
    if (!raider) return;

    // Check direct link
    if (raider.bountyId) {
      const bounty = this.bounties.find(b => b.id === raider.bountyId && !b.claimed);
      if (bounty) {
        bounty.claimed = true;
        this.claimable.push(bounty);
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log(`🎯 Bounty target eliminated: ${bounty.name}! Collect ${bounty.reward}g at any bounty board.`, 'success');
        }
        return;
      }
    }

    // Check virtual bounty match (unlinked bounties of matching type)
    for (const bounty of this.bounties) {
      if (bounty.claimed || bounty.raiderLinked) continue;
      if (raider.type === bounty.type || (raider.type === 'boss' && bounty.isBoss)) {
        bounty.claimed = true;
        this.claimable.push(bounty);
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log(`🎯 Bounty target "${bounty.name}" eliminated! Collect ${bounty.reward}g at any bounty board.`, 'success');
        }
        return;
      }
    }
  }

  /** Collect a completed bounty reward at a city bounty board */
  collectBounty(bountyId) {
    const idx = this.claimable.findIndex(b => b.id === bountyId);
    if (idx < 0) return false;

    // Must be at a city that has a bounty board
    if (typeof player === 'undefined' || !player.currentCity || !player.currentCity.hasBountyBoard) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('Visit a city with a bounty board to collect!', 'warning');
      }
      return false;
    }

    const bounty = this.claimable[idx];
    player.earnGold(bounty.reward);
    this.claimable.splice(idx, 1);

    // XP reward for bounty completion
    const xpGain = bounty.isBoss ? 50 : 25;
    if (player.gainXP) {
      player.gainXP(xpGain);
    }

    // Remove from active bounties
    const activeIdx = this.bounties.findIndex(b => b.id === bountyId);
    if (activeIdx >= 0) this.bounties.splice(activeIdx, 1);

    this.completed.push(bounty);

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`💰 Bounty collected: ${bounty.reward}g for "${bounty.name}"!`, 'success');
    }

    // Reputation boost
    if (player.currentCity?.adjustReputation) {
      player.currentCity.adjustReputation(bounty.isBoss ? 8 : 4);
    }

    return true;
  }

  // ─── Daily tick ─────────────────────────────────────────

  onDayChanged() {
    const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;

    // Expire old bounties
    for (let i = this.bounties.length - 1; i >= 0; i--) {
      const b = this.bounties[i];
      if (!b.claimed && b.deadline < day) {
        // Unlink raider
        if (b.raiderLinked && typeof raiderManager !== 'undefined') {
          const raider = raiderManager.raiders.find(r => r.bountyId === b.id);
          if (raider) raider.bountyId = null;
        }
        this.bounties.splice(i, 1);
      }
    }

    // Refresh bounties periodically
    if (day - this._lastRefreshDay >= this.refreshIntervalDays) {
      this._lastRefreshDay = day;
      if (typeof cities !== 'undefined') {
        // Remove unclaimed old bounties, unlinking any tied raiders first
        for (const b of this.bounties) {
          if (!b.claimed && b.raiderLinked && typeof raiderManager !== 'undefined') {
            const raider = raiderManager.raiders.find(r => r.bountyId === b.id);
            if (raider) raider.bountyId = null;
          }
        }
        this.bounties = this.bounties.filter(b => b.claimed);
        for (const city of cities) {
          if ((city.population || 0) >= 600) {
            this.generateForCity(city);
          }
        }
      }
    }
  }

  // ─── Queries ────────────────────────────────────────────

  /** Get active (unclaimed) bounties visible at a city */
  getBountiesForCity(cityName) {
    return this.bounties.filter(b => !b.claimed && b.citySource === cityName);
  }

  /** Get all unclaimed bounties */
  getAllActiveBounties() {
    return this.bounties.filter(b => !b.claimed);
  }

  /** Get claimable (completed but not yet collected) bounties */
  getClaimableBounties() {
    return this.claimable;
  }

  // ─── Serialization ──────────────────────────────────────

  toJSON() {
    return {
      bounties: this.bounties,
      claimable: this.claimable,
      completed: this.completed.slice(-20),
      lastRefreshDay: this._lastRefreshDay,
      usedNames: [...this._usedNames],
    };
  }

  static fromJSON(data) {
    const bb = new BountyBoard();
    bb.bounties = data.bounties || [];
    bb.claimable = data.claimable || [];
    bb.completed = data.completed || [];
    bb._lastRefreshDay = data.lastRefreshDay || 0;
    bb._usedNames = new Set(data.usedNames || []);
    return bb;
  }
}
