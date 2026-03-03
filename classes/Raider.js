// Raider.js — Raider bands that patrol the map and ambush the player

class Raider {
  constructor({ x, y, strength, patrolPoints, type, isPirate, boat }) {
    this.x = x;
    this.y = y;
    // Base strength + day scaling: +1 per 15 days, capped at +8
    const dayBonus = (typeof dayNight !== 'undefined') ? Math.min(8, Math.floor(dayNight.getDaysElapsed() / 15)) : 0;
    this.strength = (strength || 2 + Math.floor(Math.random() * 4)) + dayBonus; // 2-5 + dayBonus
    // Combat speed varies by type — set after type is determined
    this.speed = 1 + Math.floor(Math.random() * 2); // 1-2 base, adjusted below
    this.detectionRadius = 4 + Math.floor(Math.random() * 2); // 4-5 tiles
    this.state = 'patrolling'; // 'patrolling', 'chasing', 'defeated'
    this.bribedCooldown = 0;  // Days until raider can attack again after being bribed

    // Type — most are normal raiders, rare monsters
    this.type = type || 'bandit';
    this.isMonster = ['dragon', 'blackKnight', 'wraith'].includes(this.type);

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
      this.strength = Math.max(this.strength, 5 + Math.floor(Math.random() * 4)); // 5-8
      this.detectionRadius += 2;
    }

    this.patrolPoints = patrolPoints || [];
    this.currentPatrolIndex = 0;
    this.path = [];
    this.pathFailCooldown = 0; // frames to skip before retrying a failed A* call
    this.direction = 'down';
    this.animFrame = 0;
    this.animTimer = 0;

    this.loot = {
      gold: this.strength * (10 + Math.floor(Math.random() * 20)),
      items: [],
    };

    // Generate random loot
    const itemKeys = Object.keys(ItemLibrary);
    const numLoot = Math.floor(Math.random() * 3);
    for (let i = 0; i < numLoot; i++) {
      const key = itemKeys[Math.floor(Math.random() * itemKeys.length)];
      this.loot.items.push({ name: key, quantity: 1 + Math.floor(Math.random() * 3) });
    }

    // Movement timing
    this.moveTimer = 0;
    this.moveInterval = 300; // slower than player
    this.chaseInterval = 180; // faster when chasing
    this.stunTimer = 0;      // real-time ms freeze (flee/bribe)
  }

  update(dt, playerX, playerY) {
    if (this.state === 'defeated') return;

    // Stun countdown — raider does nothing while stunned
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      return;
    }

    const distToPlayer = Math.abs(this.x - playerX) + Math.abs(this.y - playerY);

    // Don't detect player if they're in a city
    const playerInCity = typeof player !== 'undefined' && player.currentCity != null;

    // Detection - skip if bribed recently
    if (!playerInCity && this.bribedCooldown === 0 && distToPlayer <= this.detectionRadius && this.state !== 'chasing') {
      this.state = 'chasing';
      this.path = [];
      // One-time warning
      if (typeof notificationManager !== 'undefined') {
        const label = this.isPirate
          ? `\u2620\ufe0f Pirates spotted on the water!`
          : this.isMonster
          ? `🐉 A ${this.type === 'dragon' ? 'Dragon' : this.type === 'blackKnight' ? 'Black Knight' : 'Wraith'} spotted nearby!`
          : "⚔ Raiders spotted nearby!";
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
      // Path to next patrol point
      const target = this.patrolPoints[this.currentPatrolIndex];
      if (this.isPirate) {
        this.path = aStar(grid, { x: this.x, y: this.y }, target, true, null, true) || [];
      } else {
        this.path = aStar(grid, { x: this.x, y: this.y }, target) || [];
      }
      if (this.path.length === 0) {
        // Failed — cooldown prevents immediate retry (300 moveIntervals ≈ several in-game days)
        this.pathFailCooldown = 300;
        this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length; // skip to next
      } else {
        this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
      }
    }

    if (this.path.length > 0) {
      this.moveToNext();
    }
  }

  doChase(dt, playerX, playerY) {
    this.moveTimer += dt;
    if (this.moveTimer < this.chaseInterval) return;
    this.moveTimer = 0;

    // Repath toward player periodically
    if (this.path.length === 0 || Math.random() < 0.3) {
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
    if (typeof raiderGrid !== 'undefined') raiderGrid.move(this, this.x, this.y);

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
    if (playerDist <= this.detectionRadius * 2) {
      push();
      noFill();
      stroke(200, 40, 40, 40);
      strokeWeight(1);
      ellipse(px + tileSize / 2, py + tileSize / 2, this.detectionRadius * tileSize * 2, this.detectionRadius * tileSize * 2);
      pop();
    }

    // Raider sprite — use monster sprite, boat sprite for pirates, or normal raider
    let spriteSet = null;
    if (this.isPirate && this.boat && SpriteSheet.boats?.[this.boat]) {
      spriteSet = SpriteSheet.boats[this.boat];
    } else if (this.isMonster && SpriteSheet.monsters?.[this.type]) {
      spriteSet = SpriteSheet.monsters[this.type];
    } else {
      spriteSet = SpriteSheet.raider;
    }

    const useLargeSprite = this.isMonster || this.isPirate;
    if (spriteSet && spriteSet[this.direction]) {
      const frame = spriteSet[this.direction][this.animFrame] || spriteSet[this.direction][0];
      const drawSize = useLargeSprite ? tileSize * 1.3 : tileSize;
      const offset = useLargeSprite ? (drawSize - tileSize) / 2 : 0;
      image(frame, px - offset, py - offset, drawSize, drawSize);
    } else {
      // Fallback colored square
      push();
      fill(this.isPirate ? [40, 80, 160] : this.isMonster ? [120, 0, 180] : [200, 60, 60]);
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
    } else if (SpriteSheet.icons?.skull) {
      image(SpriteSheet.icons.skull, px + tileSize / 2 - 8, py - 14, 16, 16);
    }

    // Strength indicator
    push();
    fill(255, 80, 80);
    noStroke();
    textAlign(CENTER, BOTTOM);
    textSize(8);
    text(`Str:${this.strength}`, px + tileSize / 2, py - 14);
    pop();
  }

  toJSON() {
    return {
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
      x: data.x, y: data.y,
      strength: data.strength,
      patrolPoints: data.patrolPoints,
      type: data.type || 'bandit',
      isPirate: data.isPirate || false,
      boat: data.boat || null,
    });
    r.detectionRadius = data.detectionRadius;
    r.currentPatrolIndex = data.currentPatrolIndex;
    r.state = data.state;
    r.loot = data.loot;
    r.direction = data.direction;
    r.bribedCooldown = data.bribedCooldown || 0;
    return r;
  }
}
