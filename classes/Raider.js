// Raider.js — Raider bands that patrol the map and ambush the player

class Raider {
  constructor({ x, y, strength, patrolPoints }) {
    this.x = x;
    this.y = y;
    this.strength = strength || 2 + Math.floor(Math.random() * 4); // 2-5
    this.speed = 1;
    this.detectionRadius = 4 + Math.floor(Math.random() * 2); // 4-5 tiles
    this.state = 'patrolling'; // 'patrolling', 'chasing', 'defeated'

    this.patrolPoints = patrolPoints || [];
    this.currentPatrolIndex = 0;
    this.path = [];
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
  }

  update(dt, playerX, playerY) {
    if (this.state === 'defeated') return;

    const distToPlayer = Math.abs(this.x - playerX) + Math.abs(this.y - playerY);

    // Detection
    if (distToPlayer <= this.detectionRadius && this.state !== 'chasing') {
      this.state = 'chasing';
      this.path = [];
      // One-time warning
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log("⚔ Raiders spotted nearby!", "warning");
      }
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

    if (this.path.length === 0 && this.patrolPoints.length > 0) {
      // Path to next patrol point
      const target = this.patrolPoints[this.currentPatrolIndex];
      this.path = aStar(grid, { x: this.x, y: this.y }, target) || [];
      this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
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
      this.path = aStar(grid, { x: this.x, y: this.y }, { x: playerX, y: playerY }) || [];
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

    // Raider sprite
    const sprites = SpriteSheet.raider;
    if (sprites && sprites[this.direction]) {
      const frame = sprites[this.direction][this.animFrame] || sprites[this.direction][0];
      image(frame, px, py, tileSize, tileSize);
    } else {
      // Fallback colored square
      push();
      fill(200, 60, 60);
      noStroke();
      rect(px + 4, py + 4, tileSize - 8, tileSize - 8, 3);
      pop();
    }

    // Skull icon above
    if (SpriteSheet.icons?.skull) {
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
    };
  }

  static fromJSON(data) {
    const r = new Raider({ x: data.x, y: data.y, strength: data.strength, patrolPoints: data.patrolPoints });
    r.detectionRadius = data.detectionRadius;
    r.currentPatrolIndex = data.currentPatrolIndex;
    r.state = data.state;
    r.loot = data.loot;
    r.direction = data.direction;
    return r;
  }
}
