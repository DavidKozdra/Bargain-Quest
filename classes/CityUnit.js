// CityUnit.js — Represents a controllable unit spawned by a city

class CityUnit {
  /**
   * @param {Object} opts - Options for the unit
   * @param {Object} opts.city - The city that spawned this unit
   * @param {Object} opts.location - { x, y } spawn location
   * @param {string} [opts.name] - Optional unit name
   * @param {number} [opts.id] - Stable unit id for save/load
   */
  constructor(opts = {}) {
    this.id = Number.isFinite(Number(opts.id)) ? Number(opts.id) : null;
    this.city = opts.city || null;
    this.x = Math.floor(opts.location?.x || 0);
    this.y = Math.floor(opts.location?.y || 0);
    this.name = opts.name || `Unit #${Math.floor(Math.random() * 10000)}`;
    this.classKey = (typeof opts.classKey === 'string' && opts.classKey.trim()) ? opts.classKey : 'militia';
    this.movementType = (opts.movementType === 'naval') ? 'naval' : 'land';
    this.hp = Math.max(1, Math.floor(Number(opts.hp) || 10));
    this.maxHp = Math.max(this.hp, Math.floor(Number(opts.maxHp) || 10));
    this.attack = Math.max(1, Math.floor(Number(opts.attack) || 2));
    this.defense = Math.max(0, Math.floor(Number(opts.defense) || 1));
    this.level = Math.max(1, Math.floor(Number(opts.level) || 1));
    this.xp = Math.max(0, Math.floor(Number(opts.xp) || 0));
    this.kills = Math.max(0, Math.floor(Number(opts.kills) || 0));
    this.state = opts.state || 'idle'; // idle, moving, fighting
    this.target = opts.target ? { x: Math.floor(opts.target.x), y: Math.floor(opts.target.y) } : null;
    this.selected = !!opts.selected;
    this.direction = opts.direction || 'down';

    // Step once every ~120ms so movement speed is stable across FPS.
    this._stepTimer = 0;
    this._stepMs = 120;
    this._combatCooldown = 0;
  }

  /** Move to a target location */
  moveTo(x, y) {
    this.target = { x: Math.floor(x), y: Math.floor(y) };
    this.state = 'moving';
  }

  /** Called every frame/tick */
  update(dt = 16) {
    if (this._combatCooldown > 0) this._combatCooldown = Math.max(0, this._combatCooldown - dt);
    if (this.state !== 'moving' || !this.target) return;

    this._stepTimer += dt;
    if (this._stepTimer < this._stepMs) return;
    this._stepTimer = 0;

    if (this.x !== this.target.x) {
      this.direction = this.target.x > this.x ? 'right' : 'left';
      this.x += Math.sign(this.target.x - this.x);
    } else if (this.y !== this.target.y) {
      this.direction = this.target.y > this.y ? 'down' : 'up';
      this.y += Math.sign(this.target.y - this.y);
    }

    if (this.x === this.target.x && this.y === this.target.y) {
      this.state = 'idle';
      this.target = null;
    }
  }

  takeDamage(amount) {
    const dmg = Math.max(0, Math.floor(Number(amount) || 0));
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp <= 0) this.state = 'defeated';
    return dmg;
  }

  gainXp(amount) {
    const add = Math.max(0, Math.floor(Number(amount) || 0));
    if (add <= 0) return { leveled: false, level: this.level };
    this.xp += add;
    let leveled = false;
    const xpToNext = () => 20 + ((this.level - 1) * 16);
    while (this.xp >= xpToNext()) {
      this.xp -= xpToNext();
      this.level += 1;
      this.maxHp += 2;
      this.attack += 1;
      if (this.level % 2 === 0) this.defense += 1;
      this.hp = Math.min(this.maxHp, this.hp + 2);
      leveled = true;
    }
    return { leveled, level: this.level };
  }

  canTraverseTile(tileType, isCityTile = false) {
    if (isCityTile) return true;
    if (this.movementType === 'naval') return tileType === 'Water';
    return tileType !== 'Water';
  }

  render(tileSize = 32) {
    if (typeof push !== 'function') return;
    if (this.state === 'defeated' || this.hp <= 0) return;
    const px = this.x * tileSize + tileSize / 2;
    const py = this.y * tileSize + tileSize / 2;
    const pulse = 0.94 + Math.sin((typeof frameCount === 'number' ? frameCount : 0) * 0.16) * 0.05;
    const s = (tileSize / 32) * pulse;

    push();
    translate(px, py);
    scale(s);

    const palettes = {
      militia: { armor: [58, 94, 156], accent: [204, 216, 236], shield: [138, 98, 58] },
      guard: { armor: [84, 104, 128], accent: [224, 230, 238], shield: [104, 112, 122] },
      ranger: { armor: [66, 120, 88], accent: [206, 232, 214], shield: [112, 86, 54] },
    };
    const pal = palettes[this.classKey] || palettes.militia;

    // Legs
    noStroke();
    fill(52, 64, 88);
    rect(-6, 7, 4, 7, 1);
    rect(2, 7, 4, 7, 1);

    // Torso armor
    fill(pal.armor[0], pal.armor[1], pal.armor[2]);
    rect(-7, -2, 14, 12, 2);
    fill(pal.accent[0], pal.accent[1], pal.accent[2], 235);
    rect(-1, -2, 2, 12, 1); // chest trim

    // Head + helmet
    fill(232, 199, 162);
    ellipse(0, -7, 10, 10);
    fill(88, 98, 118);
    arc(0, -9, 11, 8, Math.PI, Math.PI * 2, CHORD);
    rect(-6, -8, 12, 2, 1);

    // Equipment (shield + spear) based on facing
    stroke(110, 84, 52);
    strokeWeight(1.6);
    if (this.direction === 'left') {
      line(2, -1, 10, -4);   // spear
      noStroke();
      fill(pal.shield[0], pal.shield[1], pal.shield[2]);
      rect(-12, -1, 5, 8, 1); // shield
    } else if (this.direction === 'right') {
      line(-2, -1, -10, -4);
      noStroke();
      fill(pal.shield[0], pal.shield[1], pal.shield[2]);
      rect(7, -1, 5, 8, 1);
    } else {
      line(5, -1, 11, 6);
      noStroke();
      fill(pal.shield[0], pal.shield[1], pal.shield[2]);
      rect(-12, 0, 5, 8, 1);
    }

    // Health pip
    const hpRatio = Math.max(0, Math.min(1, this.hp / Math.max(1, this.maxHp)));
    noStroke();
    fill(30, 35, 45, 210);
    rect(-10, -17, 20, 3, 1);
    fill(hpRatio > 0.6 ? color(77, 202, 95) : hpRatio > 0.3 ? color(238, 183, 64) : color(226, 85, 75));
    rect(-10, -17, 20 * hpRatio, 3, 1);

    if (this.selected) {
      noFill();
      stroke(255, 221, 102, 240);
      strokeWeight(2);
      ellipse(0, 0, 22, 22);
    }
    pop();
  }

  toJSON() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      name: this.name,
      hp: this.hp,
      maxHp: this.maxHp,
      attack: this.attack,
      defense: this.defense,
      state: this.state,
      direction: this.direction,
      classKey: this.classKey,
      movementType: this.movementType,
      level: this.level,
      xp: this.xp,
      kills: this.kills,
      target: this.target ? { x: this.target.x, y: this.target.y } : null,
    };
  }

  static fromJSON(data, city) {
    return new CityUnit({
      id: data?.id,
      city,
      location: { x: data?.x, y: data?.y },
      name: data?.name,
      hp: data?.hp,
      maxHp: data?.maxHp,
      attack: data?.attack,
      defense: data?.defense,
      state: data?.state,
      direction: data?.direction,
      classKey: data?.classKey,
      movementType: data?.movementType,
      level: data?.level,
      xp: data?.xp,
      kills: data?.kills,
      target: data?.target,
    });
  }
}

if (typeof window !== 'undefined') window.CityUnit = CityUnit;
if (typeof module !== 'undefined') module.exports = CityUnit;
