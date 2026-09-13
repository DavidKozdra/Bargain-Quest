// CityUnit.js — Represents a controllable unit spawned by a city

class CityUnit {
  /** Exact shortest-step BFS, with bounded work and independent paged buffers. */
  static createPathSearch(world, start, goal, { movementType = 'land', cityMap = null } = {}) {
    const rows = world?.length || 0, cols = world?.[0]?.length || 0;
    const sx = start?.x, sy = start?.y, tx = goal?.x, ty = goal?.y;
    const pageCols = Math.ceil(cols / 32);
    const pages = new Map(), queuePages = new Map();
    let head = 0, tail = 0, phase = 'search', cursor = -1, left = 0, right = -1;
    const path = [];
    const search = {
      done: false, cancelled: false, result: null, processedWork: 0, expandedNodes: 0,
      get allocatedCells() { return pages.size * 1024; },
      step(maxWork = 256) {
        let remaining = Number.isFinite(maxWork) ? Math.max(0, Math.floor(maxWork)) : (maxWork === Infinity ? Infinity : 0);
        while (!search.done && remaining > 0) {
          remaining--;
          search.processedWork++;
          if (phase === 'reconstruct') {
            if (cursor === startIndex) { phase = 'reverse'; right = path.length - 1; continue; }
            const x = cursor % cols, y = Math.floor(cursor / cols);
            path.push({ x, y });
            cursor = pageAt(x, y).parent[offsetAt(x, y)];
            continue;
          }
          if (phase === 'reverse') {
            if (left >= right) { finish(path); continue; }
            const previous = path[left]; path[left++] = path[right]; path[right--] = previous;
            continue;
          }
          if (head === tail) { finish([]); continue; }
          const queuePageKey = Math.floor(head / 4096);
          const current = queuePages.get(queuePageKey)[head % 4096];
          head++;
          if (head % 4096 === 0) queuePages.delete(queuePageKey);
          const cx = current % cols, cy = Math.floor(current / cols);
          search.expandedNodes++;
          // Keep the original tie order: east, west, south, north.
          for (let direction = 0; direction < 4; direction++) {
            const nx = cx + (direction === 0 ? 1 : direction === 1 ? -1 : 0);
            const ny = cy + (direction === 2 ? 1 : direction === 3 ? -1 : 0);
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            let page = pageAt(nx, ny);
            const offset = offsetAt(nx, ny);
            if (page?.visited[offset] || !traversable(nx, ny)) continue;
            if (!page) page = pageAt(nx, ny, true);
            page.visited[offset] = 1;
            page.parent[offset] = current;
            enqueue(ny * cols + nx);
            if (nx === tx && ny === ty) { cursor = ny * cols + nx; phase = 'reconstruct'; }
          }
        }
        return search.done;
      },
      cancel() {
        if (!search.done) { search.cancelled = true; finish([]); }
      },
    };
    function finish(result) {
      search.done = true; search.result = result;
      if (result !== path) path.length = 0;
      pages.clear(); queuePages.clear();
    }
    function pageAt(x, y, create = false) {
      const key = (y >> 5) * pageCols + (x >> 5);
      let page = pages.get(key);
      if (!page && create) {
        page = { visited: new Uint8Array(1024), parent: new Int32Array(1024) };
        pages.set(key, page);
      }
      return page;
    }
    function offsetAt(x, y) { return ((y & 31) << 5) | (x & 31); }
    function enqueue(index) {
      const key = Math.floor(tail / 4096);
      let page = queuePages.get(key);
      if (!page) { page = new Int32Array(4096); queuePages.set(key, page); }
      page[tail++ % 4096] = index;
    }
    function traversable(x, y) {
      const tile = world[y]?.[x];
      if (!tile) return false;
      const water = tile.options?.[0] === 'Water';
      if (movementType === 'naval' ? water : !water) return true;
      return !!cityMap?.has(`${x},${y}`);
    }
    function valid(x, y) { return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < cols && y < rows; }
    const startIndex = sy * cols + sx;
    if (!valid(sx, sy) || !valid(tx, ty) || (sx === tx && sy === ty) || !traversable(tx, ty)) {
      finish([]);
    } else {
      pageAt(sx, sy, true).visited[offsetAt(sx, sy)] = 1;
      enqueue(startIndex);
    }
    return search;
  }

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
    this.accuracy = Math.max(0.4, Math.min(0.95, Number.isFinite(Number(opts.accuracy)) ? Number(opts.accuracy) : 0.72));
    this.critChance = Math.max(0, Math.min(0.5, Number.isFinite(Number(opts.critChance)) ? Number(opts.critChance) : 0.08));
    this.attackRangeMin = Math.max(1, Math.floor(Number(opts.attackRangeMin) || 1));
    this.attackRangeMax = Math.max(this.attackRangeMin, Math.floor(Number(opts.attackRangeMax) || this.attackRangeMin));
    this.reactionRange = Math.max(this.attackRangeMax, Math.floor(Number(opts.reactionRange) || this.attackRangeMax));
    this.level = Math.max(1, Math.floor(Number(opts.level) || 1));
    this.xp = Math.max(0, Math.floor(Number(opts.xp) || 0));
    this.kills = Math.max(0, Math.floor(Number(opts.kills) || 0));
    this.state = opts.state || 'idle'; // idle, moving, fighting
    this.target = opts.target ? { x: Math.floor(opts.target.x), y: Math.floor(opts.target.y) } : null;
    this.selected = !!opts.selected;
    this.direction = opts.direction || 'down';
    this.path = [];

    // Step once every ~120ms so movement speed is stable across FPS.
    this._stepTimer = Number.isFinite(Number(opts.stepTimer)) ? Math.max(0, Number(opts.stepTimer)) : 0;
    this._stepMs = 120;
    this._combatCooldown = 0;
    this._pathRequest = null;
    this._pathStepsSinceReady = 0;
    if (this.target && this.state !== 'defeated') this._requestPath(this.target.x, this.target.y);
  }

  /** Move to a target location */
  moveTo(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (this.state === 'defeated' || this.hp <= 0) return;
    const chasing = this._chaseRaiderId != null || !!this._chaseRaiderRef;
    if (this._pathRequest) {
      if (this._isPathRequestCurrent(this._pathRequest)
        && ((this.target?.x === tx && this.target?.y === ty) || chasing)) return;
      this._cancelPathRequest();
    }
    const next = this.path[0], end = this.path[this.path.length - 1];
    if (this.state === 'moving' && ((this.target?.x === tx && this.target?.y === ty)
        || (chasing && this._pathStepsSinceReady === 0))
      && typeof grid !== 'undefined' && this._pathWorld === grid && this._pathMovementType === this.movementType
      && next && end?.x === this.target?.x && end?.y === this.target?.y
      && Math.abs(next.x - this.x) + Math.abs(next.y - this.y) === 1
      && this._isTraversable(next.x, next.y)) return;
    if (this.state !== 'moving') this._stepTimer = 0;
    this.target = { x: tx, y: ty };
    this.state = 'moving';
    this._requestPath(tx, ty);
  }

  /** Called every frame/tick */
  update(dt = 16) {
    dt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    if (this._pathRequest && !this._isPathRequestCurrent(this._pathRequest)) this._cancelPathRequest();
    if (!(dt > 0)) return;
    if (this._combatCooldown > 0) this._combatCooldown = Math.max(0, this._combatCooldown - dt);
    if (this.state !== 'moving' || !this.target) return;

    this._stepTimer += dt;
    if (this._pathRequest) return;
    if (this.path.length === 0 || this._pathWorld !== grid || this._pathMovementType !== this.movementType) {
      this._requestPath(this.target.x, this.target.y);
      if (this._pathRequest || this.state !== 'moving') return;
    }
    const interval = Math.max(1, this._stepMs);
    // A route can finish after a long wait. Release its movement debt over
    // bounded updates while preserving every remaining millisecond.
    let steps = 0;
    while (this.state === 'moving' && this.target && this._stepTimer >= interval && steps < 8) {
      if (!this._moveStep()) break;
      steps++;
      this._stepTimer = Math.max(0, this._stepTimer - interval);
      if (this._pathRequest) break;
    }
  }

  _moveStep() {
    let nextNode = this.path[0];
    if (nextNode && (!this._isTraversable(nextNode.x, nextNode.y)
      || Math.abs(nextNode.x - this.x) + Math.abs(nextNode.y - this.y) !== 1)) {
      this._requestPath(this.target.x, this.target.y);
      if (this._pathRequest) return false;
      nextNode = this.path[0];
    }
    if (!nextNode) {
      this.state = 'idle';
      this.target = null;
      this.path = [];
      this._stepTimer = 0;
      return false;
    }

    if (nextNode.x > this.x) this.direction = 'right';
    else if (nextNode.x < this.x) this.direction = 'left';
    else if (nextNode.y > this.y) this.direction = 'down';
    else if (nextNode.y < this.y) this.direction = 'up';

    this.x = nextNode.x;
    this.y = nextNode.y;
    this.path.shift();
    this._pathStepsSinceReady++;

    if (this.path.length === 0) {
      this.state = 'idle';
      this.target = null;
      this._stepTimer = 0;
    } else if (this.target) {
      const expected = this.path[this.path.length - 1];
      if (!expected || expected.x !== this.target.x || expected.y !== this.target.y) {
        this._requestPath(this.target.x, this.target.y);
      }
    }
    return true;
  }

  takeDamage(amount) {
    const dmg = Math.max(0, Math.floor(Number(amount) || 0));
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp <= 0) {
      this._cancelPathRequest();
      this.state = 'defeated';
      this.path = [];
    }
    return dmg;
  }

  getAttackRange() {
    return {
      min: Math.max(1, Math.floor(Number(this.attackRangeMin) || 1)),
      max: Math.max(
        Math.max(1, Math.floor(Number(this.attackRangeMin) || 1)),
        Math.floor(Number(this.attackRangeMax) || this.attackRangeMin || 1)
      ),
    };
  }

  getReactionRange() {
    const range = this.getAttackRange();
    return Math.max(range.max, Math.floor(Number(this.reactionRange) || range.max));
  }

  isTargetInRange(targetOrDistance) {
    const range = this.getAttackRange();
    const dist = (typeof targetOrDistance === 'number')
      ? Math.max(0, Math.floor(Number(targetOrDistance) || 0))
      : Math.abs((targetOrDistance?.x || 0) - this.x) + Math.abs((targetOrDistance?.y || 0) - this.y);
    return dist >= range.min && dist <= range.max;
  }

  _cancelPathRequest() {
    const request = this._pathRequest;
    this._pathRequest = null;
    if (request?.handle && typeof request.handle.cancel === 'function') request.handle.cancel();
  }

  _isPathRequestCurrent(request) {
    return request.handle?.status !== 'cancelled' && !request.handle?.cancelled
      && this.state === request.state && this.hp > 0
      && typeof grid !== 'undefined' && grid === request.world
      && this.movementType === request.movementType
      && this.x === request.start.x && this.y === request.start.y
      && this.target?.x === request.goal.x && this.target?.y === request.goal.y;
  }

  _requestPath(targetX, targetY) {
    this._cancelPathRequest();
    const tx = Math.floor(Number(targetX)), ty = Math.floor(Number(targetY));
    const world = typeof grid !== 'undefined' ? grid : null;
    const cityMap = typeof cityLocationMap !== 'undefined' ? cityLocationMap : null;
    const movementType = this.movementType;
    this._pathWorld = world;
    this._pathMovementType = movementType;
    this._pathStepsSinceReady = 0;
    this.path = [];
    const accept = result => {
      this.path = result || [];
      if (this.path.length === 0 && this.state === 'moving') {
        this.state = 'idle';
        this._stepTimer = 0;
        if (this.target && this.x === this.target.x && this.y === this.target.y) this.target = null;
      }
    };
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || !world?.[ty]?.[tx]
      || (this.x === tx && this.y === ty) || !this._isTraversable(tx, ty)) {
      accept([]);
      return;
    }
    if (typeof requestWorldPath === 'function') {
      const request = { world, movementType, state: this.state,
        start: { x: this.x, y: this.y }, goal: { x: tx, y: ty }, handle: null };
      this._pathRequest = request;
      request.handle = requestWorldPath({ start: request.start, goal: request.goal, priority: this.selected ? 'player' : 'background',
        createSearch: (searchGrid, start, goal) => CityUnit.createPathSearch(searchGrid, start, goal, { movementType, cityMap }),
      }, result => {
        if (this._pathRequest !== request) return;
        const current = this._isPathRequestCurrent(request);
        this._pathRequest = null;
        if (current) accept(result);
      });
    } else {
      accept(this._buildPath(tx, ty));
    }
  }

  // Compatibility for standalone callers without the world path scheduler.
  _buildPath(targetX, targetY) {
    const world = typeof grid !== 'undefined' ? grid : null;
    this._pathWorld = world;
    this._pathMovementType = this.movementType;
    const search = CityUnit.createPathSearch(world, { x: this.x, y: this.y },
      { x: Math.floor(Number(targetX)), y: Math.floor(Number(targetY)) }, {
        movementType: this.movementType,
        cityMap: typeof cityLocationMap !== 'undefined' ? cityLocationMap : null,
      });
    search.step(Infinity);
    return search.result;
  }

  _isTraversable(x, y) {
    const tile = grid?.[y]?.[x];
    if (!tile) return false;
    const tileType = tile.options?.[0];
    if (this.canTraverseTile(tileType, false)) return true;
    const cityMap = (typeof cityLocationMap !== 'undefined' && cityLocationMap && typeof cityLocationMap.has === 'function')
      ? cityLocationMap
      : null;
    const isCityTile = !!(cityMap && cityMap.has(`${x},${y}`));
    return this.canTraverseTile(tileType, isCityTile);
  }

  renderPath(tileSize = 32) {
    if (typeof beginShape !== 'function') return;
    if (!this.selected || !Array.isArray(this.path) || this.path.length === 0) return;

    push();
    noFill();
    stroke(255, 255, 100, 130);
    strokeWeight(2);
    if (typeof drawVisibleWorldPath === 'function') {
      drawVisibleWorldPath(this.path, this.x * tileSize + tileSize / 2, this.y * tileSize + tileSize / 2, tileSize);
    } else {
      beginShape();
      vertex(this.x * tileSize + tileSize / 2, this.y * tileSize + tileSize / 2);
      for (const node of this.path) {
        vertex(node.x * tileSize + tileSize / 2, node.y * tileSize + tileSize / 2);
      }
      endShape();
    }
    noStroke();
    pop();
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
    if (typeof isRectOnScreen === 'function'
      && !isRectOnScreen((this.x - 0.5) * tileSize, (this.y - 1) * tileSize,
        (this.x + 1.5) * tileSize, (this.y + 2) * tileSize)) return;
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

    // Equipment silhouette changes for ranged units so archers read clearly on the map.
    stroke(110, 84, 52);
    strokeWeight(1.6);
    if (this.classKey === 'ranger') {
      noFill();
      if (this.direction === 'left') {
        arc(-8, 1, 8, 12, Math.PI * 1.55, Math.PI * 0.45);
        line(-5, -5, -5, 7);
      } else if (this.direction === 'right') {
        arc(8, 1, 8, 12, Math.PI * 0.55, Math.PI * 1.45);
        line(5, -5, 5, 7);
      } else {
        arc(8, 1, 8, 12, Math.PI * 0.55, Math.PI * 1.45);
        line(5, -5, 5, 7);
      }
    } else if (this.direction === 'left') {
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
      accuracy: this.accuracy,
      critChance: this.critChance,
      state: this.state,
      direction: this.direction,
      classKey: this.classKey,
      movementType: this.movementType,
      attackRangeMin: this.attackRangeMin,
      attackRangeMax: this.attackRangeMax,
      reactionRange: this.reactionRange,
      level: this.level,
      xp: this.xp,
      kills: this.kills,
      target: this.target ? { x: this.target.x, y: this.target.y } : null,
      stepTimer: this._stepTimer,
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
      accuracy: data?.accuracy,
      critChance: data?.critChance,
      state: data?.state,
      direction: data?.direction,
      classKey: data?.classKey,
      movementType: data?.movementType,
      attackRangeMin: data?.attackRangeMin,
      attackRangeMax: data?.attackRangeMax,
      reactionRange: data?.reactionRange,
      level: data?.level,
      xp: data?.xp,
      kills: data?.kills,
      target: data?.target,
      stepTimer: data?.stepTimer,
    });
  }
}

if (typeof window !== 'undefined') window.CityUnit = CityUnit;
if (typeof module !== 'undefined') module.exports = CityUnit;
