// Raider.js — Raider bands that patrol the map and ambush the player

function _bqRaiderEntityStream() {
  if (typeof window !== 'undefined' && window.BQSeededRNG && typeof window.BQSeededRNG.stream === 'function') {
    return window.BQSeededRNG.stream('raider:entity');
  }
  return null;
}
function _bqRaiderEntityRand() {
  const s = _bqRaiderEntityStream();
  return s ? s.random() : Math.random();
}

function _bqRaiderIsCityTile(x, y) {
  const key = `${x},${y}`;
  if (typeof cityLocationMap !== 'undefined' && cityLocationMap && typeof cityLocationMap.has === 'function') {
    return cityLocationMap.has(key);
  }
  if (typeof cities !== 'undefined' && Array.isArray(cities)) {
    return cities.some((city) => city?.location?.x === x && city?.location?.y === y);
  }
  return false;
}
let _bqNextRaiderId = 1;

const RAIDER_TYPE_LABELS = {
  bandit: 'Bandit',
  marauder: 'Marauder',
  raider: 'Raider',
  boss: 'Raider Captain',
  scout: 'Scout',
  pirate: 'Pirate',
  dragon: 'Dragon',
  blackKnight: 'Black Knight',
  wraith: 'Wraith',
  seaMonster: 'Sea Monster',
  sandWorm: 'Sand Worm',
  iceGolem: 'Ice Golem',
  voidHound: 'Void Hound',
  thornBeast: 'Thorn Beast',
  magmaSerpent: 'Magma Serpent',
  grazer: 'Grazer',
  pennyCollector: 'Penny Collector',
  clawMarine: 'Claw Marine',
  siegeBear: 'Siege Bear',
  raymond: 'Raymond the Bear',
};

const MONSTER_RAIDER_TYPES = new Set([
  'dragon',
  'blackKnight',
  'wraith',
  'seaMonster',
  'sandWorm',
  'iceGolem',
  'voidHound',
  'thornBeast',
  'magmaSerpent',
  'siegeBear',
  'raymond',
]);

const NEUTRAL_RAIDER_TYPES = new Set(['grazer']);

const RAIDER_SHARED_NOUNS = [
  'Ash Wolf', 'Black Banner', 'Coin Knife', 'Dust Crown', 'Ember Fang',
  'Grim Lantern', 'Hollow Helm', 'Iron Wake', 'Moon Hook', 'Red Tide',
  'Ridge Hound', 'Salt Crown', 'Storm Eye', 'Torchbearer', 'White Maw',
];

const RAIDER_SHARED_VERBS = [
  'counts scars', 'hunts gold', 'keeps trophies', 'breaks gates', 'marks maps',
  'follows smoke', 'never kneels', 'waits at dusk', 'reads tracks', 'calls storms',
];

const RAIDER_NAME_POOLS = {
  bandit: {
    first: ['Rook', 'Kylo', 'Paul Kuntz', 'Smudge', 'Robin', 'Klubberlang'],
    nouns: ['Knife Hand', 'Crow Hood', 'Road Jackal', 'Coin Finger', 'Dust Fox'],
    verbs: ['cuts purses', 'bites wrists', 'shakes wagons', 'picks locks', 'robs softly'],
  },
  marauder: {
    first: ['Grond', 'Oscar', 'Talla', 'Hask', 'Rul', 'Korga', 'Brine', 'Drekk'],
    nouns: ['War Cry', 'Gate Breaker', 'The Gruchy', 'Red Fang', 'Siege Horn'],
    verbs: ['breaks shields', 'burns wagons', 'splits helmets', 'laughs at arrows'],
  },
  raider: {
    first: ['Renn', 'Vale', 'Ossa', 'Brigg', 'Kest', 'Mora', 'Jarr', 'Syre'],
    nouns: ['Torch Hand', 'Road Wolf', 'Night Pike', 'Toll Hound', 'Ruin Flag'],
    verbs: ['hunts caravans', 'tracks smoke', 'takes tribute', 'circles farms'],
  },
  boss: {
    first: ['Maeve', 'Varo', 'Morrow', 'Sable Jack', 'Thane', 'Corvin', 'Rhea', 'Hal'],
    nouns: ['Iron Crown', 'Toll King', 'War Ledger', 'Banner Lord', 'Bridge Tyrant'],
    verbs: ['keeps tribute', 'owns roads', 'breaks captains', 'counts the fallen'],
  },
  scout: {
    first: ['Lark', 'Whisp', 'Tern', 'Flick', 'Mire', 'Needle', 'Kite', 'Swift'],
    nouns: ['Far Eye', 'Fox Step', 'Wind Mark', 'Quick Shadow', 'Thin Blade'],
    verbs: ['sees first', 'runs rooftops', 'reads tracks', 'never rests'],
  },
  pirate: {
    first: ['Barnacle Ben', 'Penny Snatching Dave Gentry', 'Calab', 'Riptide Rick', 'Ms Black Etta', 'Hook Bram', 'One Eyed Brontes'],
    nouns: ['Black Wake', 'Salt Fang', 'Harbor Ghost', 'Rope King', 'Storm Hook'],
    verbs: ['counts wrecks', 'chases storms', 'steals pennies !', 'hunts horizons'],
  },
  dragon: {
    first: ['Azrith', 'Balthromaw', 'Cindervale', 'Shenron', 'Pyreclaw', 'Kiah', 'Albion', 'Thalara', 'Vulkrin'],
    nouns: ['Ash Throne', 'Sky Furnace', 'Gold Hunger', 'Cinder Crown', 'Ember Maw'],
    verbs: ['hoards crowns', 'melts towers', 'drinks thunder', 'wakes volcanoes'],
  },
  blackKnight: {
    first: ['Sir Veyn', 'Dame Mordra', 'Ghal', 'Tyrone', 'Cleese', 'Thorn Vale', 'Malkor', 'Ysra'],
    nouns: ['Grave Helm', 'Iron Oath', 'Night Lance', 'Ruin Banner', 'Black Vow'],
    verbs: ['keeps vigil', 'breaks oaths', 'marches at dusk', 'never forgives'],
  },
  wraith: {
    first: ['Nhal', 'Velis', 'Mourn', 'Syth', 'Iria', 'Vaunt', 'Leth', 'Nyxen'],
    nouns: ['Pale Whisper', 'Hollow Choir', 'Moon Echo', 'Grief Lantern', 'Mist Hand'],
    verbs: ['drinks light', 'waits in fog', 'calls the lost', 'crosses walls'],
  },
  seaMonster: {
    first: ['Brinejaw', 'Kelpthorn', 'Abyssa', 'Mirefin', 'Razorwake', 'Undertow', 'Trenchmaw', 'Crestcoil'],
    nouns: ['Tide Maw', 'Deep Coil', 'Storm Eye', 'Sunken Crown', 'Hull Breaker'],
    verbs: ['The man eater', 'the barnacle lover', 'biki bottomer', 'stirs trenches'],
  },
  sandWorm: {
    first: ['Dustmaw', 'Khepra', 'Siroc', 'Dunebore', 'Rattle Maw', 'Scarp'],
    nouns: ['Dune Hunger', 'Glass Maw', 'Buried Crown', 'Salt Coil', 'Dust Throne'],
    verbs: ['erupts beneath caravans', 'swallows tracks', 'shakes the dunes', 'waits below campfires'],
  },
  iceGolem: {
    first: ['Rimeguard', 'Thalos', 'Brumal', 'Frostwake', 'Old Icestone', 'Shardhelm'],
    nouns: ['White Bastion', 'Glacier Fist', 'Winter Wall', 'Silent Cairn', 'Blue Core'],
    verbs: ['cracks shields', 'walks in blizzards', 'freezes steel', 'never thaws'],
  },
  voidHound: {
    first: ['Nyxfang', 'Null', 'Vesper Maw', 'Shadepaw', 'Hush', 'Graven'],
    nouns: ['Night Bite', 'Starless Fang', 'Shadow Lung', 'Black Echo', 'Void Step'],
    verbs: ['hunts starlight', 'blinks through fog', 'sniffs fear', 'circles lanterns'],
  },
  thornBeast: {
    first: ['Briarhide', 'Rootlash', 'Spine Buck', 'Needleback', 'Thorn Maw', 'Gorse'],
    nouns: ['Bramble Crown', 'Rose Fang', 'Vine Hide', 'Green Ruin', 'Hooked Antler'],
    verbs: ['charges hedgerows', 'breaks spears', 'drags hunters', 'bleeds sap'],
  },
  magmaSerpent: {
    first: ['Cindercoil', 'Basalt Tongue', 'Pyra', 'Lavabite', 'Ashscale', 'Riftcoil'],
    nouns: ['Melt Spine', 'Fire Vein', 'Crater Coil', 'Smolder Fang', 'Furnace Eye'],
    verbs: ['splits bedrock', 'spits embers', 'sleeps in lava', 'glows at dusk'],
  },
  grazer: {
    first: ['Mossback', 'Dapplehorn', 'Softhoof', 'Lichenhide', 'Willowtail', 'Meadowback'],
    nouns: ['Quiet Grazer', 'Fern Antler', 'Soft Step', 'Hill Eater', 'Moss Crown'],
    verbs: ['chews clover', 'wanders slowly', 'sniffs the wind', 'grazes at dawn'],
  },
  pennyCollector: {
    first: ['Copperpaw', 'Tallysnout', 'Minter', 'Ledgerclaw', 'Pennybite', 'Brassnose'],
    nouns: ['Tribute Clerk', 'Coin Snatcher', 'Tax Paw', 'Copper Hood', 'Toll Cub'],
    verbs: ['counts every penny', 'tags cargo holds', 'shakes down captains', 'marks unpaid routes'],
  },
  clawMarine: {
    first: ['Grask', 'Ursik', 'Vorn', 'Maulek', 'Brund', 'Karrax'],
    nouns: ['Claw Marine', 'Boarding Paw', 'Hull Ripper', 'Deck Breaker', 'Flagship Guard'],
    verbs: ['breaches airlocks', 'guards tribute vaults', 'storms command decks', 'hunts resistance cells'],
  },
  siegeBear: {
    first: ['Ironhide', 'Maulhold', 'Bastion', 'Gravemaw', 'Tonnar', 'Bulwark'],
    nouns: ['Siege Bear', 'Armor Crown', 'Wall Breaker', 'Heavy Paw', 'Dread Guard'],
    verbs: ['breaks station gates', 'carries shield plates', 'crushes convoy hulls', 'holds the line'],
  },
  raymond: {
    first: ['Raymond'],
    nouns: ['Bear Emperor', 'Penny Warlord', 'Capital Tyrant', 'Tribute King'],
    verbs: ['claims every world', 'hoards every penny', 'rules the capital shield', 'breaks galaxies'],
  },
};

function _isMonsterRaiderType(type) {
  return MONSTER_RAIDER_TYPES.has(type);
}

function _isNeutralRaiderType(type) {
  return NEUTRAL_RAIDER_TYPES.has(type);
}

function _getRaiderLootGold(raider) {
  const _days = (typeof dayNight !== 'undefined') ? dayNight.getDaysElapsed() : 0;
  const _dayLootBonus = Math.floor(_days / 10) * 4;
  if (raider?.isMonster) {
    return raider.strength * (18 + Math.floor(_bqRaiderEntityRand() * 30)) + _dayLootBonus * 2;
  }
  if (raider?.isNeutral) {
    return Math.max(1, Math.floor(raider.strength * (3 + Math.floor(_bqRaiderEntityRand() * 4)) + Math.floor(_dayLootBonus * 0.25)));
  }
  return raider.strength * (12 + Math.floor(_bqRaiderEntityRand() * 22)) + _dayLootBonus;
}

function _getRaiderNameArchetype(type, isPirate) {
  if (isPirate) return 'pirate';
  return RAIDER_NAME_POOLS[type] ? type : 'bandit';
}

function _pickRaiderNamePart(parts) {
  if (!Array.isArray(parts) || parts.length === 0) return '';
  return parts[Math.floor(_bqRaiderEntityRand() * parts.length)];
}

function _generateRaiderName(type, isPirate, explicitName) {
  if (typeof explicitName === 'string' && explicitName.trim()) return explicitName.trim();

  const archetype = _getRaiderNameArchetype(type, isPirate);
  const pool = RAIDER_NAME_POOLS[archetype] || RAIDER_NAME_POOLS.bandit;
  const first = _pickRaiderNamePart(pool.first);
  const noun = _pickRaiderNamePart([...(pool.nouns || []), ...RAIDER_SHARED_NOUNS]);
  const verb = _pickRaiderNamePart([...(pool.verbs || []), ...RAIDER_SHARED_VERBS]);
  const patternRoll = _bqRaiderEntityRand();

  if (patternRoll < 0.34 && first && noun && verb) return `${first} the ${noun} who ${verb}`;
  if (patternRoll < 0.67 && first && noun) return `${first} the ${noun}`;
  if (first && verb) return `${first} who ${verb}`;
  return first || noun || verb || 'Nameless Raider';
}

function _getRaiderTypeLabel(type, isPirate) {
  const key = isPirate ? 'pirate' : type;
  return RAIDER_TYPE_LABELS[key] || 'Raider';
}

class Raider {
  constructor({ x, y, strength, patrolPoints, type, isPirate, boat, id, name, onDefeated }) {
    if (Number.isFinite(Number(id))) {
      this.id = Number(id);
      _bqNextRaiderId = Math.max(_bqNextRaiderId, this.id + 1);
    } else {
      this.id = _bqNextRaiderId++;
    }
    this.x = x;
    this.y = y;
    // Base strength + day scaling: +1 per 20 days, capped at +5
    const dayBonus = (typeof dayNight !== 'undefined') ? Math.min(5, Math.floor(dayNight.getDaysElapsed() / 20)) : 0;
    this.strength = (strength || 2 + Math.floor(_bqRaiderEntityRand() * 3)) + dayBonus; // 2-4 + dayBonus
    // Combat speed varies by type — set after type is determined
    this.speed = 1 + Math.floor(_bqRaiderEntityRand() * 2); // 1-2 base, adjusted below
    this.detectionRadius = 4 + Math.floor(_bqRaiderEntityRand() * 2); // 4-5 tiles
    this.state = 'patrolling'; // 'patrolling', 'chasing', 'defeated'
    this.bribedCooldown = 0;  // Days until raider can attack again after being bribed

    // Type — most are normal raiders, rare monsters
    this.type = type || 'bandit';
    this.isMonster = _isMonsterRaiderType(this.type);
    this.isNeutral = _isNeutralRaiderType(this.type);

    // Pirate — water-only raiders with boats
    this.isPirate = isPirate || false;
    this.boat = boat || null; // boat type string: 'rowboat', 'sloop', 'galleon'
    if (this.isPirate && !this.boat) {
      this.boat = (typeof getPirateBoatType === 'function')
        ? getPirateBoatType(this.strength) : 'rowboat';
    }
    if (this.isPirate) {
      this.detectionRadius += 1; // pirates have slightly better sea vision
    }

    // Monsters are stronger and have wider detection
    if (this.isMonster) {
      this.strength = Math.max(this.strength, 5 + Math.floor(_bqRaiderEntityRand() * 4)); // 5-8
      this.detectionRadius += 2;
    } else if (this.isNeutral) {
      this.strength = Math.max(1, Math.min(this.strength, 2));
      this.detectionRadius = 1;
    }

    this.name = _generateRaiderName(this.type, this.isPirate, name);
    this.onDefeated = typeof onDefeated === 'function' ? onDefeated : null;

    this.patrolPoints = patrolPoints || [];
    this.currentPatrolIndex = 0;
    this.path = [];
    this.pathFailCooldown = 0; // frames to skip before retrying a failed A* call
    this.direction = 'down';
    this.animFrame = 0;
    this.animTimer = 0;

    this.loot = {
      gold: _getRaiderLootGold(this),
      items: [],
    };

    // Generate random loot
    const itemKeys = Object.keys(ItemLibrary);
    const numLoot = this.isNeutral ? 0 : Math.floor(_bqRaiderEntityRand() * 3);
    for (let i = 0; i < numLoot; i++) {
      const key = itemKeys[Math.floor(_bqRaiderEntityRand() * itemKeys.length)];
      this.loot.items.push({ name: key, quantity: 1 + Math.floor(_bqRaiderEntityRand() * 3) });
    }

    if (this.isNeutral) {
      const forageLoot = ['Fur', 'Herbs', 'Fish', 'Wheat'].filter((key) => (
        typeof ItemLibrary !== 'undefined' && !!ItemLibrary[key]
      ));
      if (forageLoot.length > 0) {
        const key = forageLoot[Math.floor(_bqRaiderEntityRand() * forageLoot.length)];
        this.loot.items.push({ name: key, quantity: 1 + Math.floor(_bqRaiderEntityRand() * 2) });
      }
    }

    // Tiered bag drops (independent roll)
    if (!this.isNeutral) {
      const bagRoll = _bqRaiderEntityRand();
      let bagDrop = null;
      if      (bagRoll < 0.002) bagDrop = 'Chest';
      else if (bagRoll < 0.012) bagDrop = 'BargainSack';
      else if (bagRoll < 0.040) bagDrop = 'TravelerBag';
      else if (bagRoll < 0.120) bagDrop = 'Pouch';
      if (bagDrop) this.loot.items.push({ name: bagDrop, quantity: 1 });
    }

    // Movement timing
    this.moveTimer = 0;
    this.moveInterval = this.isNeutral ? 380 : 300; // slower than player
    this.chaseInterval = this.isNeutral ? 380 : 180; // faster when chasing
    this.stunTimer = 0;      // real-time ms freeze (flee/bribe)
  }

  getTypeLabel() {
    return _getRaiderTypeLabel(this.type, this.isPirate);
  }

  getDisplayName(includeType = false) {
    if (!includeType) return this.name || this.getTypeLabel();
    return this.name ? `${this.name} (${this.getTypeLabel()})` : this.getTypeLabel();
  }

  update(dt, playerX, playerY) {
    if (this.state === 'defeated') return;

    // Stun countdown — raider does nothing while stunned
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      return;
    }

    if (this.isNeutral) {
      this.doPatrol(dt);
      return;
    }

    const distToPlayer = Math.abs(this.x - playerX) + Math.abs(this.y - playerY);

    // Don't detect player if they're in a city
    const playerInCity = (typeof player !== 'undefined' && player.currentCity != null) || _bqRaiderIsCityTile(playerX, playerY);

    // Detection - skip if bribed recently
    if (!playerInCity && this.bribedCooldown === 0 && distToPlayer <= this.detectionRadius && this.state !== 'chasing') {
      this.state = 'chasing';
      this.path = [];
      // One-time warning
      if (typeof notificationManager !== 'undefined') {
        const label = this.isPirate
          ? `\u2620\ufe0f ${this.getDisplayName(true)} spotted on the water!`
          : this.isMonster
          ? `\uD83D\uDC09 ${this.getDisplayName(true)} spotted nearby!`
          : `\u2694 ${this.getDisplayName(true)} spotted nearby!`;
        notificationManager.log(label, "warning");
      }
    }

    // Stop chasing if on cooldown (bribed / just defeated player)
    if (this.bribedCooldown > 0 && this.state === 'chasing') {
      this.state = 'patrolling';
      this.path = [];
    }

    // If player entered a city, stop chasing
    if (playerInCity && this.state === 'chasing') {
      this.state = 'patrolling';
      this.path = [];
    }

    if (this.state === 'chasing') {
      this.doChase(dt, playerX, playerY);
    } else {
      this.doPatrol(dt);
    }

    // If player moved far away, go back to patrolling
    if (this.state === 'chasing' && distToPlayer > this.detectionRadius * 2) {
      this.state = 'patrolling';
      this.path = [];
    }
  }

  doPatrol(dt) {
    this.moveTimer += dt;
    if (this.moveTimer < this.moveInterval) return;
    this.moveTimer = 0;

    if (this.pathFailCooldown > 0) {
      this.pathFailCooldown--;
    } else if (this.path.length === 0 && this.patrolPoints.length > 0) {
      // Try A* to next patrol point
      const target = this.patrolPoints[this.currentPatrolIndex];
      if (this.isPirate) {
        this.path = aStar(grid, { x: this.x, y: this.y }, target, true, null, true) || [];
      } else {
        this.path = aStar(grid, { x: this.x, y: this.y }, target) || [];
      }
      if (this.path.length === 0) {
        // Failed — short cooldown (20 × 300ms ≈ 6 sec), then try next point
        this.pathFailCooldown = 20;
        this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
      } else {
        this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
      }
    }

    if (this.path.length > 0) {
      this.moveToNext();
    } else {
      // No path available — random walk so raiders always visibly wander
      this._takeRandomStep();
    }
  }

  /**
   * Take one random step to an adjacent walkable tile.
   * Used as a fallback when A* has no path (fail cooldown, unreachable points,
   * or no patrol points assigned).  Always produces visible movement.
   * Pirates stay on water; land raiders avoid water.
   */
  _takeRandomStep() {
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    // Fisher-Yates shuffle
    for (let i = 3; i > 0; i--) {
      const j = Math.floor(_bqRaiderEntityRand() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }

    // Optional bias: slightly prefer walking toward next patrol point
    if (this.patrolPoints.length > 0) {
      const pt = this.patrolPoints[this.currentPatrolIndex];
      const bx = Math.sign(pt.x - this.x);
      const by = Math.sign(pt.y - this.y);
      if (bx !== 0) dirs.unshift([bx, 0]);
      if (by !== 0) dirs.unshift([0, by]);
    }

    for (const [dx, dy] of dirs) {
      const nx = this.x + dx;
      const ny = this.y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const tileType = grid[ny]?.[nx]?.options[0];
      if (!tileType) continue;
      const walkable = this.isPirate ? tileType === 'Water' : tileType !== 'Water';
      if (!walkable) continue;

      this.direction = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      this.x = nx;
      this.y = ny;
      if (typeof raiderGrid !== 'undefined' && raiderGrid && typeof raiderGrid.move === 'function') {
        raiderGrid.move(this, this.x, this.y);
      }
      this.animTimer++;
      if (this.animTimer >= 6) { this.animFrame = (this.animFrame + 1) % 3; this.animTimer = 0; }
      break;
    }
  }

  doChase(dt, playerX, playerY) {
    this.moveTimer += dt;
    if (this.moveTimer < this.chaseInterval) return;
    this.moveTimer = 0;

    // Repath toward player periodically
    if (this.path.length === 0 || _bqRaiderEntityRand() < 0.3) {
      if (this.isPirate) {
        this.path = aStar(grid, { x: this.x, y: this.y }, { x: playerX, y: playerY }, true, null, true) || [];
      } else {
        this.path = aStar(grid, { x: this.x, y: this.y }, { x: playerX, y: playerY }) || [];
      }
    }

    if (this.path.length > 0) {
      this.moveToNext();
    }
  }

  moveToNext() {
    const next = this.path[0];
    if (!next) return;

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
    if (typeof raiderGrid !== 'undefined' && raiderGrid && typeof raiderGrid.move === 'function') {
      raiderGrid.move(this, this.x, this.y);
    }

    this.animTimer++;
    if (this.animTimer >= 6) {
      this.animFrame = (this.animFrame + 1) % 3;
      this.animTimer = 0;
    }
  }

  render(tileSize) {
    if (this.state === 'defeated') return;

    const px = this.x * tileSize;
    const py = this.y * tileSize;

    // Viewport culling — skip offscreen raiders
    if (typeof isOnScreen === 'function' && !isOnScreen(px, py)) return;

    // Draw detection radius indicator (subtle red glow when player is near)
    const playerDist = Math.abs(this.x - player.x) + Math.abs(this.y - player.y);
    if (!this.isNeutral && playerDist <= this.detectionRadius * 2) {
      push();
      noFill();
      stroke(200, 40, 40, 40);
      strokeWeight(1);
      ellipse(px + tileSize / 2, py + tileSize / 2, this.detectionRadius * tileSize * 2, this.detectionRadius * tileSize * 2);
      pop();
    }

    // Mark raiders that a city unit is currently locked onto.
    const trackedByUnit = !!(typeof cityManagement !== 'undefined'
      && cityManagement
      && typeof cityManagement.isRaiderTrackedByUnit === 'function'
      && cityManagement.isRaiderTrackedByUnit(this));
    if (trackedByUnit) {
      push();
      noFill();
      stroke(235, 70, 70, 230);
      strokeWeight(2);
      ellipse(px + tileSize / 2, py + tileSize / 2, tileSize * 0.9, tileSize * 0.9);
      pop();
    }

    // Raider sprite — use monster sprite, boat sprite for pirates, or normal raider
    let spriteSet = null;
    const customSpriteSet = (!this.isPirate && SpriteSheet.monsters?.[this.type]) ? SpriteSheet.monsters[this.type] : null;
    if (this.isPirate && this.boat && SpriteSheet.boats?.[this.boat]) {
      spriteSet = SpriteSheet.boats[this.boat];
    } else if (customSpriteSet) {
      spriteSet = customSpriteSet;
    } else {
      spriteSet = SpriteSheet.raider;
    }

    const useLargeSprite = this.isMonster || this.isPirate || this.isNeutral;
    if (spriteSet && spriteSet[this.direction]) {
      const frame = spriteSet[this.direction][this.animFrame] || spriteSet[this.direction][0];
      const drawSize = useLargeSprite ? tileSize * 1.3 : tileSize;
      const offset = useLargeSprite ? (drawSize - tileSize) / 2 : 0;
      image(frame, px - offset, py - offset, drawSize, drawSize);
    } else {
      // Fallback colored square
      push();
      fill(this.isPirate ? [40, 80, 160] : this.isMonster ? [120, 0, 180] : this.isNeutral ? [118, 168, 92] : [200, 60, 60]);
      noStroke();
      rect(px + 4, py + 4, tileSize - 8, tileSize - 8, 3);
      pop();
    }

    // Icon above: pirate flag, skull, or bribed cooldown
    if (this.bribedCooldown > 0) {
      push();
      fill(100, 200, 100);
      noStroke();
      textAlign(CENTER, BOTTOM);
      textSize(8);
      text(`${this.bribedCooldown}d`, px + tileSize / 2, py - 14);
      pop();
    } else if (this.isPirate) {
      push();
      noStroke();
      textAlign(CENTER, BOTTOM);
      textSize(12);
      text('\u2620\ufe0f', px + tileSize / 2, py - 6);
      pop();
    } else if (this.isNeutral) {
      push();
      noStroke();
      textAlign(CENTER, BOTTOM);
      textSize(11);
      text('\uD83C\uDF3F', px + tileSize / 2, py - 6);
      pop();
    } else if (SpriteSheet.icons?.skull) {
      image(SpriteSheet.icons.skull, px + tileSize / 2 - 8, py - 14, 16, 16);
    }

    // Strength indicator
    push();
    fill(this.isNeutral ? 180 : 255, this.isNeutral ? 220 : 80, this.isNeutral ? 160 : 80);
    noStroke();
    textAlign(CENTER, BOTTOM);
    textSize(8);
    text(`Str:${this.strength}`, px + tileSize / 2, py - 14);
    pop();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      x: this.x, y: this.y,
      strength: this.strength,
      detectionRadius: this.detectionRadius,
      patrolPoints: this.patrolPoints,
      currentPatrolIndex: this.currentPatrolIndex,
      state: this.state,
      loot: this.loot,
      direction: this.direction,
      bribedCooldown: this.bribedCooldown,
      type: this.type,
      isPirate: this.isPirate,
      boat: this.boat,
    };
  }

  static fromJSON(data) {
    const r = new Raider({
      id: data?.id,
      name: data?.name,
      x: data.x, y: data.y,
      strength: data.strength,
      patrolPoints: data.patrolPoints,
      type: data.type || 'bandit',
      isPirate: data.isPirate || false,
      boat: data.boat || null,
    });
    if (Number.isFinite(Number(data.strength))) {
      r.strength = Number(data.strength);
    }
    r.detectionRadius = data.detectionRadius;
    r.currentPatrolIndex = data.currentPatrolIndex;
    r.state = data.state;
    r.loot = data.loot && typeof data.loot === 'object' ? data.loot : r.loot;
    // Refresh gold so saved raiders don't keep stale day-0 loot values
    r.loot.gold = _getRaiderLootGold(r);
    r.direction = data.direction;
    r.bribedCooldown = data.bribedCooldown || 0;
    return r;
  }
}
