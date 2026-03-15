(function initCityWarBattle(root, factory) {
  const api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.CityWarBattle = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createCityWarBattleApi() {
  const DEFAULT_NONZERO_SEED = 0x9e3779b9;
  const GRID_SIZE = 8;
  const PIECE_ORDER = ["rook", "ranger", "knight", "bishop", "ranger", "knight", "rook"];
  const CLEAR_ON_OPPOSING_TURN = { player: "enemy", enemy: "player" };

  const PIECE_RULES = {
    rook: {
      type: "rook",
      iconKey: "rook",
      label: "Vanguard",
      value: 5,
      hp: 3,
      armor: 1,
      damage: 2,
      accuracy: 0.74,
      crit: 0.08,
      moveStyle: "rook",
      attackStyle: "rook",
    },
    bishop: {
      type: "bishop",
      iconKey: "bishop",
      label: "Pikeline",
      value: 3,
      hp: 2,
      armor: 0,
      damage: 2,
      accuracy: 0.72,
      crit: 0.12,
      moveStyle: "bishop",
      attackStyle: "bishop",
    },
    knight: {
      type: "knight",
      iconKey: "knight",
      label: "Cavalry",
      value: 3,
      hp: 2,
      armor: 0,
      damage: 2,
      accuracy: 0.7,
      crit: 0.18,
      moveStyle: "knight",
      attackStyle: "knight",
    },
    ranger: {
      type: "ranger",
      iconKey: "ranger",
      label: "Ranger",
      value: 4,
      hp: 2,
      armor: 0,
      damage: 2,
      accuracy: 0.68,
      crit: 0.2,
      moveStyle: "step",
      attackStyle: "ranged",
      minRange: 2,
      maxRange: 4,
    },
  };

  const CARD_DEFS = {
    volley: {
      id: "volley",
      title: "Volley",
      desc: "Next two ranged attacks gain reach, hit chance, and damage.",
    },
    brace: {
      id: "brace",
      title: "Brace",
      desc: "All allies gain +1 armor until your next turn.",
    },
    rally: {
      id: "rally",
      title: "Rally",
      desc: "Heal the most wounded ally and refresh one acted unit.",
    },
    fog_bank: {
      id: "fog_bank",
      title: "Fog Bank",
      desc: "Enemy ranged attacks lose accuracy and range for one turn.",
    },
    sabotage: {
      id: "sabotage",
      title: "Sabotage",
      desc: "Expose the strongest enemy piece and cut its armor.",
    },
    battle_drums: {
      id: "battle_drums",
      title: "Battle Drums",
      desc: "Inspire one ally with bonus accuracy, damage, and a free refresh.",
    },
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function fnv1a(text) {
    const str = String(text || "");
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i += 1) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  class SeededStream {
    constructor(seed, state) {
      this._seed = (Number(seed) >>> 0) || DEFAULT_NONZERO_SEED;
      this._state = (state !== undefined ? Number(state) : this._seed) >>> 0;
      if (this._state === 0) this._state = DEFAULT_NONZERO_SEED;
    }

    random() {
      let state = this._state >>> 0;
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      this._state = (state >>> 0) || DEFAULT_NONZERO_SEED;
      return this._state / 4294967296;
    }

    int(min, max) {
      const lo = Math.floor(Math.min(min, max));
      const hi = Math.floor(Math.max(min, max));
      return lo + Math.floor(this.random() * (hi - lo + 1));
    }

    chance(probability) {
      return this.random() < clamp(Number(probability) || 0, 0, 1);
    }

    pick(list) {
      if (!Array.isArray(list) || list.length === 0) return undefined;
      return list[Math.floor(this.random() * list.length)];
    }

    shuffle(list) {
      const out = Array.isArray(list) ? list.slice() : [];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this.random() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    }
  }

  function buildBattleSeed(opts = {}) {
    const preview = opts.preview || {};
    const sourceCity = opts.sourceCity || {};
    const targetCity = opts.targetCity || {};
    const parts = [
      sourceCity.name || "Source",
      targetCity.name || "Target",
      sourceCity.location ? `${sourceCity.location.x},${sourceCity.location.y}` : "0,0",
      targetCity.location ? `${targetCity.location.x},${targetCity.location.y}` : "0,0",
      Math.round(Number(preview.attackPower) || 0),
      Math.round(Number(preview.defensePower) || 0),
      Math.round(Number(preview.distance) || 0),
      Math.round(Number(opts.day) || 0),
    ];
    return fnv1a(parts.join("|")) || DEFAULT_NONZERO_SEED;
  }

  function createCardInstance(cardId, instanceId) {
    const def = CARD_DEFS[cardId];
    if (!def) return null;
    return {
      instanceId,
      id: def.id,
      title: def.title,
      desc: def.desc,
    };
  }

  function getWallLevel(city) {
    return Math.max(0, Number(city?.management?.upgradeLevels?.walls) || 0);
  }

  function buildDeckList(side, opts = {}) {
    const city = side === "player" ? (opts.sourceCity || {}) : (opts.targetCity || {});
    const isAttacker = side === "player";
    const deck = isAttacker
      ? ["volley", "battle_drums", "rally", "sabotage", "volley", "fog_bank", "battle_drums", "rally"]
      : ["brace", "fog_bank", "rally", "brace", "sabotage", "battle_drums", "volley", "brace"];

    if (city.hasWeaponShop) deck.push("volley");
    if (city.hasWinery) deck.push("rally");
    if (city.hasSchool) deck.push("battle_drums");
    if (city.hasBlackMarket) deck.push("sabotage");
    if (city.hasBank) deck.push(isAttacker ? "battle_drums" : "brace");
    if (city.hasBountyBoard) deck.push("sabotage");
    if (city.isCoastal || city.port) deck.push("fog_bank");

    const wallLevel = getWallLevel(city);
    for (let i = 0; i < wallLevel; i += 1) deck.push("brace");

    return deck;
  }

  function summarizeDeck(deckIds) {
    const counts = new Map();
    for (const id of Array.isArray(deckIds) ? deckIds : []) {
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([id, count]) => ({
        id,
        count,
        title: CARD_DEFS[id]?.title || id,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.title.localeCompare(b.title);
      });
  }

  function buildDoctrineTags(city = {}, side = "player") {
    const tags = [];
    if (city.hasWeaponShop) tags.push("Arsenal");
    if (city.hasWinery) tags.push("Morale");
    if (city.hasSchool) tags.push("Command");
    if (city.hasBlackMarket) tags.push("Sabotage");
    if (city.hasBountyBoard) tags.push("Scouts");
    if (city.hasBank) tags.push(side === "player" ? "Supply" : "Treasury");
    if (city.isCoastal || city.port) tags.push("Coastal");
    const walls = getWallLevel(city);
    if (walls > 0) tags.push(`Walls ${walls}`);
    return tags;
  }

  function describeBattlePlan(opts = {}) {
    const playerDeck = buildDeckList("player", opts);
    const enemyDeck = buildDeckList("enemy", opts);
    return {
      seed: buildBattleSeed(opts),
      playerDeckSize: playerDeck.length,
      enemyDeckSize: enemyDeck.length,
      attackerCards: summarizeDeck(playerDeck),
      defenderCards: summarizeDeck(enemyDeck),
      attackerDoctrines: buildDoctrineTags(opts.sourceCity || {}, "player"),
      defenderDoctrines: buildDoctrineTags(opts.targetCity || {}, "enemy"),
    };
  }

  class CityWarBattleState {
    constructor(opts = {}) {
      this.preview = opts.preview || {};
      this.sourceCity = opts.sourceCity || {};
      this.targetCity = opts.targetCity || {};
      this.seed = Number.isFinite(Number(opts.seed)) ? (Number(opts.seed) >>> 0) : buildBattleSeed(opts);
      this.rng = new SeededStream(this.seed);
      this.planSummary = describeBattlePlan({
        preview: this.preview,
        sourceCity: this.sourceCity,
        targetCity: this.targetCity,
        day: opts.day,
      });
      this.gridSize = GRID_SIZE;
      this.turn = "player";
      this.turnNumber = 1;
      this.selectedId = null;
      this.finished = false;
      this.result = null;
      this.log = [];
      this._nextPieceId = 1;
      this._nextCardInstanceId = 1;

      const defenseEdge = Math.max(0, (Number(this.preview.defensePower) || 0) - (Number(this.preview.attackPower) || 0));
      this.maxTurns = Math.max(9, Math.min(16, 11 + Math.floor(defenseEdge / 7)));
      this.playerSlots = Math.max(3, Math.min(7, Math.round((Number(this.preview.attackPower) || 10) / 5)));
      this.enemySlots = Math.max(3, Math.min(7, Math.round((Number(this.preview.defensePower) || 10) / 5)));

      this.sides = {
        player: this._buildSideState("player"),
        enemy: this._buildSideState("enemy"),
      };
      this.pieces = [];
      this._spawnInitialPieces();
      this._drawUpTo("player", 3);
      this._drawUpTo("enemy", 2);
      this._log(`Battle plan drawn for ${this.sourceCity?.name || "your city"}.`);
    }

    _buildSideState(side) {
      const drawIds = buildDeckList(side, { sourceCity: this.sourceCity, targetCity: this.targetCity });
      return {
        side,
        drawPile: this.rng.shuffle(drawIds),
        discardPile: [],
        hand: [],
        playedCardThisTurn: false,
        cardsPlayed: 0,
        effects: [],
      };
    }

    _spawnInitialPieces() {
      const occupied = new Set();
      const key = (x, y) => `${x},${y}`;

      const spawnPiece = (side, idx) => {
        for (let tries = 0; tries < 80; tries += 1) {
          const x = side === "player" ? this.rng.int(0, 1) : this.rng.int(this.gridSize - 2, this.gridSize - 1);
          const y = this.rng.int(0, this.gridSize - 1);
          const slot = key(x, y);
          if (occupied.has(slot)) continue;
          occupied.add(slot);
          const pieceType = PIECE_ORDER[idx % PIECE_ORDER.length];
          const rule = this.getRule(pieceType);
          this.pieces.push({
            id: this._nextPieceId++,
            side,
            name: `${side === "player" ? "Unit" : "Guard"} ${idx + 1}`,
            x,
            y,
            hp: rule.hp,
            maxHp: rule.hp,
            pieceType,
            acted: false,
            statuses: [],
          });
          return;
        }
      };

      for (let i = 0; i < this.playerSlots; i += 1) spawnPiece("player", i);
      for (let i = 0; i < this.enemySlots; i += 1) spawnPiece("enemy", i);
    }

    _log(message) {
      if (!message) return;
      this.log.unshift(String(message));
      if (this.log.length > 12) this.log.length = 12;
    }

    getLog(limit = 6) {
      return this.log.slice(0, Math.max(1, Math.floor(Number(limit) || 6)));
    }

    getPlanSummary() {
      return this.planSummary;
    }

    getRule(pieceOrType) {
      const type = typeof pieceOrType === "string" ? pieceOrType : pieceOrType?.pieceType;
      return PIECE_RULES[type] || PIECE_RULES.knight;
    }

    _getSideState(side) {
      return this.sides[side === "enemy" ? "enemy" : "player"];
    }

    _drawCard(side) {
      const state = this._getSideState(side);
      if (!state) return null;
      if (state.drawPile.length === 0 && state.discardPile.length > 0) {
        state.drawPile = this.rng.shuffle(state.discardPile);
        state.discardPile = [];
      }
      const nextId = state.drawPile.shift();
      if (!nextId) return null;
      const card = createCardInstance(nextId, this._nextCardInstanceId++);
      if (!card) return null;
      state.hand.push(card);
      return card;
    }

    _drawUpTo(side, count) {
      const state = this._getSideState(side);
      if (!state) return;
      while (state.hand.length < count) {
        const card = this._drawCard(side);
        if (!card) break;
      }
    }

    living(side) {
      return this.pieces.filter((piece) => piece.hp > 0 && piece.side === side);
    }

    pieceAt(x, y) {
      return this.pieces.find((piece) => piece.hp > 0 && piece.x === x && piece.y === y) || null;
    }

    getSelected() {
      return this.pieces.find((piece) => piece.hp > 0 && piece.id === this.selectedId) || null;
    }

    getHand(side) {
      return this._getSideState(side)?.hand?.slice() || [];
    }

    getActiveEffects(side) {
      const sideEffects = (this._getSideState(side)?.effects || []).map((effect) => ({
        id: effect.id,
        title: effect.title,
      }));
      const unitEffects = [];
      for (const piece of this.living(side)) {
        for (const status of piece.statuses || []) {
          unitEffects.push({
            id: `${status.id}:${piece.id}`,
            title: `${this.getRule(piece).label}: ${status.title}`,
          });
        }
      }
      return sideEffects.concat(unitEffects);
    }

    getLiveSummary() {
      const playerAlive = this.living("player");
      const enemyAlive = this.living("enemy");
      const playerMaterial = playerAlive.reduce((sum, unit) => sum + this.getRule(unit).value + (unit.hp / Math.max(1, unit.maxHp)), 0);
      const enemyMaterial = enemyAlive.reduce((sum, unit) => sum + this.getRule(unit).value + (unit.hp / Math.max(1, unit.maxHp)), 0);
      const momentum = clamp(50 + Math.round((playerMaterial - enemyMaterial) * 4), 0, 100);
      return {
        playerUnits: playerAlive.length,
        enemyUnits: enemyAlive.length,
        playerMaterial,
        enemyMaterial,
        momentum,
      };
    }

    _cleanupExpiredEffects(turnSide) {
      const pruneTimedEntries = (entries) => entries.filter((entry) => {
        if (!entry || entry.clearOnTurn !== turnSide) return !!entry;
        const remaining = Math.max(0, (Number(entry.remainingTriggers) || 1) - 1);
        entry.remainingTriggers = remaining;
        return remaining > 0;
      });

      for (const sideKey of ["player", "enemy"]) {
        const state = this._getSideState(sideKey);
        state.effects = pruneTimedEntries(state.effects || []);
      }

      for (const piece of this.pieces) {
        piece.statuses = pruneTimedEntries(piece.statuses || []);
      }
    }

    _beginTurn(side, advanceRound = false) {
      this._cleanupExpiredEffects(side);
      if (side === "player" && advanceRound) {
        this.turnNumber += 1;
        if (this.turnNumber > this.maxTurns) {
          this.finishBattle();
          return { finished: true, message: "Battle timed out. Command resolves the result." };
        }
      }
      this.turn = side;
      this.selectedId = null;
      const state = this._getSideState(side);
      state.playedCardThisTurn = false;
      this._drawUpTo(side, side === "player" ? 3 : 2);
      for (const piece of this.living(side)) piece.acted = false;
      const msg = `${side === "player" ? "Your" : "Enemy"} turn begins.`;
      this._log(msg);
      return { ok: true, message: msg };
    }

    _endCurrentTurn() {
      if (this.finished) return { ok: false, message: "Battle already resolved." };
      if (this.turn === "player") return this._beginTurn("enemy", false);
      return this._beginTurn("player", true);
    }

    endPlayerTurn() {
      if (this.finished) return { ok: false, message: "Battle already resolved." };
      if (this.turn !== "player") return { ok: false, message: "Wait for the enemy turn." };
      const res = this._endCurrentTurn();
      return res.finished ? res : { ok: true, message: "Enemy turn..." };
    }

    _addSideEffect(side, effect) {
      const state = this._getSideState(side);
      if (!state || !effect) return;
      state.effects.push({ ...effect });
    }

    _addPieceStatus(piece, status) {
      if (!piece || !status) return;
      piece.statuses = Array.isArray(piece.statuses) ? piece.statuses : [];
      piece.statuses.push({ ...status });
    }

    _sumSideEffect(side, field, unit) {
      const effects = this._getSideState(side)?.effects || [];
      let total = 0;
      for (const effect of effects) {
        if (!effect) continue;
        if (effect.onlyRanged && this.getRule(unit).attackStyle !== "ranged") continue;
        total += Number(effect[field]) || 0;
      }
      return total;
    }

    _sumPieceStatus(piece, field) {
      const statuses = piece?.statuses || [];
      let total = 0;
      for (const status of statuses) total += Number(status?.[field]) || 0;
      return total;
    }

    _bestUnitForSide(side, predicate) {
      const units = this.living(side).filter((unit) => !predicate || predicate(unit));
      units.sort((a, b) => {
        const av = this.getRule(a).value + (a.hp / Math.max(1, a.maxHp));
        const bv = this.getRule(b).value + (b.hp / Math.max(1, b.maxHp));
        return bv - av;
      });
      return units[0] || null;
    }

    playCard(side, instanceId) {
      if (this.finished) return { ok: false, message: "Battle already resolved." };
      if (side !== this.turn) return { ok: false, message: "It is not that side's turn." };
      const state = this._getSideState(side);
      if (!state) return { ok: false, message: "No battle state for that side." };
      if (state.playedCardThisTurn) return { ok: false, message: "Only one card can be played per turn." };

      const idx = state.hand.findIndex((card) => card.instanceId === instanceId);
      if (idx < 0) return { ok: false, message: "Card not in hand." };
      const card = state.hand[idx];
      const opponent = side === "player" ? "enemy" : "player";
      let message = "";

      switch (card.id) {
        case "volley": {
          this._addSideEffect(side, {
            id: "volley",
            title: "Volley",
            clearOnTurn: CLEAR_ON_OPPOSING_TURN[side],
            remainingTriggers: 1,
            onlyRanged: true,
            accuracyBonus: 0.18,
            damageBonus: 1,
            rangeBonus: 1,
            charges: 2,
          });
          message = `${side === "player" ? "Your" : "Enemy"} archers ready a volley.`;
          break;
        }
        case "brace": {
          this._addSideEffect(side, {
            id: "brace",
            title: "Brace",
            clearOnTurn: side,
            remainingTriggers: 1,
            armorBonus: 1,
          });
          message = `${side === "player" ? "Your line braces." : "The defenders brace."}`;
          break;
        }
        case "rally": {
          const wounded = this.living(side).slice().sort((a, b) => (a.hp / Math.max(1, a.maxHp)) - (b.hp / Math.max(1, b.maxHp)))[0];
          if (wounded && wounded.hp < wounded.maxHp) wounded.hp = Math.min(wounded.maxHp, wounded.hp + 1);
          const acted = this.living(side).find((unit) => unit.acted);
          if (acted) acted.acted = false;
          message = `${side === "player" ? "Your ranks rally." : "The defenders rally."}`;
          break;
        }
        case "fog_bank": {
          this._addSideEffect(opponent, {
            id: "fog_bank",
            title: "Fog Bank",
            clearOnTurn: side,
            remainingTriggers: 1,
            onlyRanged: true,
            accuracyPenalty: 0.18,
            rangePenalty: 1,
          });
          message = `${side === "player" ? "Fog covers the approach." : "Enemy fog rolls over the field."}`;
          break;
        }
        case "sabotage": {
          const target = this._bestUnitForSide(opponent);
          if (target) {
            this._addPieceStatus(target, {
              id: "exposed",
              title: "Exposed",
              clearOnTurn: side,
              remainingTriggers: 1,
              armorPenalty: 1,
              hitTakenBonus: 0.1,
              critTakenBonus: 0.08,
              accuracyPenalty: 0.08,
            });
            message = `${target.name} is exposed by sabotage.`;
          } else {
            message = "Sabotage found no target.";
          }
          break;
        }
        case "battle_drums": {
          const selected = this.getSelected();
          const target = (selected && selected.side === side)
            ? selected
            : this._bestUnitForSide(side);
          if (target) {
            target.acted = false;
            this._addPieceStatus(target, {
              id: "inspired",
              title: "Inspired",
              clearOnTurn: CLEAR_ON_OPPOSING_TURN[side],
              remainingTriggers: 1,
              accuracyBonus: 0.1,
              damageBonus: 1,
            });
            message = `${target.name} surges forward to the drums.`;
          } else {
            message = "No ally answers the drums.";
          }
          break;
        }
        default:
          return { ok: false, message: "Unknown card." };
      }

      state.hand.splice(idx, 1);
      state.discardPile.push(card.id);
      state.playedCardThisTurn = true;
      state.cardsPlayed += 1;
      this._log(message);
      return { ok: true, message, card };
    }

    selectPiece(id) {
      const piece = this.pieces.find((entry) => entry.id === id && entry.hp > 0) || null;
      if (!piece || piece.side !== this.turn || piece.acted) return null;
      this.selectedId = piece.id;
      return piece;
    }

    _coordKey(x, y) {
      return `${x},${y}`;
    }

    _inBounds(x, y) {
      return x >= 0 && y >= 0 && x < this.gridSize && y < this.gridSize;
    }

    _collectSlidingTargets(unit, dirs, mode) {
      const out = [];
      for (const [dx, dy] of dirs) {
        let nx = unit.x + dx;
        let ny = unit.y + dy;
        while (this._inBounds(nx, ny)) {
          const occ = this.pieceAt(nx, ny);
          if (!occ) {
            if (mode === "move") out.push({ x: nx, y: ny });
          } else {
            if (mode === "attack" && occ.side !== unit.side) out.push({ x: nx, y: ny, id: occ.id });
            break;
          }
          nx += dx;
          ny += dy;
        }
      }
      return out;
    }

    _collectKnightTargets(unit, mode) {
      const out = [];
      const jumps = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
      for (const [dx, dy] of jumps) {
        const nx = unit.x + dx;
        const ny = unit.y + dy;
        if (!this._inBounds(nx, ny)) continue;
        const occ = this.pieceAt(nx, ny);
        if (!occ && mode === "move") out.push({ x: nx, y: ny });
        if (occ && occ.side !== unit.side && mode === "attack") out.push({ x: nx, y: ny, id: occ.id });
      }
      return out;
    }

    _getRangedRange(unit) {
      const rule = this.getRule(unit);
      const side = unit.side;
      const baseMin = Math.max(1, Number(rule.minRange) || 1);
      const baseMax = Math.max(baseMin, Number(rule.maxRange) || baseMin);
      const maxBonus = this._sumSideEffect(side, "rangeBonus", unit) - this._sumSideEffect(side, "rangePenalty", unit);
      return {
        min: baseMin,
        max: Math.max(baseMin, baseMax + maxBonus),
      };
    }

    _collectRangerShots(unit) {
      const out = [];
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      const range = this._getRangedRange(unit);
      for (const [dx, dy] of dirs) {
        let nx = unit.x + dx;
        let ny = unit.y + dy;
        let step = 1;
        while (this._inBounds(nx, ny) && step <= range.max) {
          const occ = this.pieceAt(nx, ny);
          if (occ) {
            if (occ.side !== unit.side && step >= range.min) out.push({ x: nx, y: ny, id: occ.id, ranged: true });
            break;
          }
          nx += dx;
          ny += dy;
          step += 1;
        }
      }
      return out;
    }

    moveTargetsFor(unitOrId) {
      const unit = typeof unitOrId === "object" ? unitOrId : this.pieces.find((piece) => piece.id === unitOrId);
      if (!unit || unit.hp <= 0 || unit.acted) return [];
      const rule = this.getRule(unit);
      if (rule.moveStyle === "rook") return this._collectSlidingTargets(unit, [[1, 0], [-1, 0], [0, 1], [0, -1]], "move");
      if (rule.moveStyle === "bishop") return this._collectSlidingTargets(unit, [[1, 1], [1, -1], [-1, 1], [-1, -1]], "move");
      if (rule.moveStyle === "knight") return this._collectKnightTargets(unit, "move");

      const out = [];
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of dirs) {
        const nx = unit.x + dx;
        const ny = unit.y + dy;
        if (!this._inBounds(nx, ny) || this.pieceAt(nx, ny)) continue;
        out.push({ x: nx, y: ny });
      }
      return out;
    }

    attackTargetsFor(unitOrId) {
      const unit = typeof unitOrId === "object" ? unitOrId : this.pieces.find((piece) => piece.id === unitOrId);
      if (!unit || unit.hp <= 0 || unit.acted) return [];
      const rule = this.getRule(unit);
      if (rule.attackStyle === "rook") return this._collectSlidingTargets(unit, [[1, 0], [-1, 0], [0, 1], [0, -1]], "attack");
      if (rule.attackStyle === "bishop") return this._collectSlidingTargets(unit, [[1, 1], [1, -1], [-1, 1], [-1, -1]], "attack");
      if (rule.attackStyle === "knight") return this._collectKnightTargets(unit, "attack");
      return this._collectRangerShots(unit);
    }

    _consumeSideEffectCharge(side, effectId) {
      const state = this._getSideState(side);
      if (!state) return;
      for (let i = 0; i < state.effects.length; i += 1) {
        const effect = state.effects[i];
        if (!effect || effect.id !== effectId) continue;
        if (!Number.isFinite(effect.charges)) return;
        effect.charges = Math.max(0, effect.charges - 1);
        if (effect.charges <= 0) state.effects.splice(i, 1);
        return;
      }
    }

    _resolveAttack(attacker, target) {
      if (!attacker || !target) return { ok: false, message: "Attack could not resolve." };
      const rule = this.getRule(attacker);
      const targetRule = this.getRule(target);
      const distance = Math.max(Math.abs(attacker.x - target.x), Math.abs(attacker.y - target.y));

      let hitChance = rule.accuracy;
      let critChance = rule.crit;
      let damage = rule.damage;
      let armor = targetRule.armor;

      if (rule.attackStyle === "ranged") {
        hitChance -= Math.max(0, distance - 2) * 0.04;
      }

      hitChance += this._sumSideEffect(attacker.side, "accuracyBonus", attacker);
      hitChance -= this._sumSideEffect(attacker.side, "accuracyPenalty", attacker);
      hitChance += this._sumPieceStatus(attacker, "accuracyBonus");
      hitChance -= this._sumPieceStatus(attacker, "accuracyPenalty");
      hitChance += this._sumPieceStatus(target, "hitTakenBonus");
      critChance += this._sumPieceStatus(target, "critTakenBonus");

      damage += this._sumSideEffect(attacker.side, "damageBonus", attacker);
      damage += this._sumPieceStatus(attacker, "damageBonus");
      armor += this._sumSideEffect(target.side, "armorBonus", target);
      armor += this._sumPieceStatus(target, "armorBonus");
      armor -= this._sumPieceStatus(target, "armorPenalty");

      hitChance = clamp(hitChance, 0.35, 0.92);
      critChance = clamp(critChance, 0.05, 0.4);

      const hit = this.rng.random() < hitChance;
      if (!hit) {
        attacker.acted = true;
        if (rule.attackStyle === "ranged") this._consumeSideEffectCharge(attacker.side, "volley");
        const missMsg = `${attacker.name} missed ${target.name} (${Math.round(hitChance * 100)}%).`;
        this._log(missMsg);
        return { ok: true, hit: false, message: missMsg };
      }

      const crit = this.rng.random() < critChance;
      const rawDamage = damage + (crit ? 1 : 0);
      const actualDamage = Math.max(1, rawDamage - Math.max(0, armor));
      target.hp = Math.max(0, target.hp - actualDamage);
      attacker.acted = true;
      if (rule.attackStyle === "ranged") this._consumeSideEffectCharge(attacker.side, "volley");

      let message = `${attacker.name} hit ${target.name} for ${actualDamage}.`;
      if (crit) message = `${attacker.name} landed a critical hit on ${target.name} for ${actualDamage}.`;
      if (target.hp <= 0) {
        target.hp = 0;
        if (rule.attackStyle !== "ranged") {
          attacker.x = target.x;
          attacker.y = target.y;
        }
        message = `${attacker.name} eliminated ${target.name}.`;
      }
      this._log(message);
      if (this.living("player").length === 0 || this.living("enemy").length === 0) {
        this.finishBattle();
      }
      return { ok: true, hit: true, crit, damage: actualDamage, killed: target.hp <= 0, message };
    }

    resolvePlayerClick(x, y) {
      if (this.finished) return { ok: false, message: "Battle already resolved." };
      if (this.turn !== "player") return { ok: false, message: "Wait for the enemy turn." };

      const clicked = this.pieceAt(x, y);
      if (clicked && clicked.side === "player" && !clicked.acted) {
        this.selectedId = clicked.id;
        const selectMsg = `${clicked.name} (${this.getRule(clicked).label}) selected.`;
        return { ok: true, type: "select", message: selectMsg };
      }

      const selected = this.getSelected();
      if (!selected) return { ok: false, message: "Select a unit first." };

      const moveTargets = this.moveTargetsFor(selected);
      const attackTargets = this.attackTargetsFor(selected);
      const coordKey = this._coordKey(x, y);
      const moveSet = new Set(moveTargets.map((entry) => this._coordKey(entry.x, entry.y)));
      const attack = attackTargets.find((entry) => this._coordKey(entry.x, entry.y) === coordKey);

      if (moveSet.has(coordKey)) {
        selected.x = x;
        selected.y = y;
        selected.acted = true;
        this.selectedId = null;
        const moveMsg = `${selected.name} repositioned.`;
        this._log(moveMsg);
        return { ok: true, type: "move", message: moveMsg };
      }

      if (attack && clicked && clicked.side === "enemy") {
        this.selectedId = null;
        const result = this._resolveAttack(selected, clicked);
        return { ...result, type: "attack" };
      }

      return { ok: false, message: "That tile is not a legal move or attack." };
    }

    _allUnitsActed(side) {
      const units = this.living(side);
      return units.length > 0 && units.every((piece) => piece.acted);
    }

    _pickAiCard() {
      const state = this._getSideState("enemy");
      if (!state || state.playedCardThisTurn || state.hand.length === 0) return null;
      const attackableByRanged = this.living("enemy").some((unit) => this.getRule(unit).attackStyle === "ranged");
      const wounded = this.living("enemy").some((unit) => unit.hp < unit.maxHp);
      const enemyHand = state.hand.slice();
      const priority = ["brace", "sabotage", "fog_bank", "rally", "battle_drums", "volley"];
      for (const cardId of priority) {
        const card = enemyHand.find((entry) => entry.id === cardId);
        if (!card) continue;
        if (card.id === "volley" && !attackableByRanged) continue;
        if (card.id === "rally" && !wounded && !this.living("enemy").some((unit) => unit.acted)) continue;
        return card;
      }
      return enemyHand[0] || null;
    }

    _chooseEnemyAction(unit) {
      const attackTargets = this.attackTargetsFor(unit);
      if (attackTargets.length > 0) {
        let bestTarget = null;
        for (const option of attackTargets) {
          const target = this.pieces.find((piece) => piece.id === option.id && piece.hp > 0);
          if (!target) continue;
          const score = (this.getRule(target).value * 10) - (target.hp * 2);
          if (!bestTarget || score > bestTarget.score) bestTarget = { option, target, score };
        }
        if (bestTarget) return { type: "attack", target: bestTarget.target };
      }

      const moves = this.moveTargetsFor(unit);
      if (moves.length === 0) return null;
      const targets = this.living("player");
      if (targets.length === 0) return null;
      let bestMove = null;
      for (const move of moves) {
        const closest = targets.reduce((best, target) => {
          const dist = Math.abs(move.x - target.x) + Math.abs(move.y - target.y);
          return Math.min(best, dist);
        }, Infinity);
        const centerBias = Math.abs(move.x - (this.gridSize - 1) / 2) + Math.abs(move.y - (this.gridSize - 1) / 2);
        const score = (closest * 10) + centerBias;
        if (!bestMove || score < bestMove.score) bestMove = { move, score };
      }
      return bestMove ? { type: "move", move: bestMove.move } : null;
    }

    takeEnemyStep() {
      if (this.finished) return { ok: false, done: true, message: "Battle resolved." };
      if (this.turn !== "enemy") return { ok: false, done: true, message: "It is not the enemy turn." };

      const state = this._getSideState("enemy");
      if (state && !state.playedCardThisTurn) {
        const card = this._pickAiCard();
        if (card) {
          const result = this.playCard("enemy", card.instanceId);
          return { ok: true, done: false, message: result.message, type: "card" };
        }
      }

      const unit = this.living("enemy").find((piece) => !piece.acted);
      if (!unit) {
        const res = this._endCurrentTurn();
        if (this.finished) return { ok: true, done: true, message: res.message, finished: true };
        return { ok: true, done: true, message: "Player turn.", type: "turn" };
      }

      const action = this._chooseEnemyAction(unit);
      if (!action) {
        unit.acted = true;
        return { ok: true, done: false, message: `${unit.name} held position.`, type: "wait" };
      }

      if (action.type === "attack") {
        const result = this._resolveAttack(unit, action.target);
        return { ok: true, done: false, message: result.message, type: "attack", finished: this.finished };
      }

      unit.x = action.move.x;
      unit.y = action.move.y;
      unit.acted = true;
      const moveMsg = `${unit.name} repositioned.`;
      this._log(moveMsg);
      return { ok: true, done: false, message: moveMsg, type: "move" };
    }

    finishBattle() {
      if (this.finished && this.result) return this.result;
      const playerAlive = this.living("player");
      const enemyAlive = this.living("enemy");
      const playerMaterial = playerAlive.reduce((sum, unit) => sum + this.getRule(unit).value + (unit.hp / Math.max(1, unit.maxHp)), 0);
      const enemyMaterial = enemyAlive.reduce((sum, unit) => sum + this.getRule(unit).value + (unit.hp / Math.max(1, unit.maxHp)), 0);
      const playerHpTotal = playerAlive.reduce((sum, unit) => sum + unit.hp, 0);
      const enemyHpTotal = enemyAlive.reduce((sum, unit) => sum + unit.hp, 0);
      const playerBattleWon = enemyAlive.length === 0 || (playerAlive.length > 0 && (playerMaterial + (playerHpTotal * 0.6)) >= (enemyMaterial + (enemyHpTotal * 0.6)));
      const cardsEdge = (this.sides.player.cardsPlayed || 0) - (this.sides.enemy.cardsPlayed || 0);
      let score = 50;
      score += (playerMaterial - enemyMaterial) * 4.2;
      score += (playerHpTotal - enemyHpTotal) * 3.2;
      score += cardsEdge * 4;
      if (enemyAlive.length === 0) score += 18;
      if (playerAlive.length === 0) score -= 18;
      score += Math.max(0, this.maxTurns - this.turnNumber) * (playerBattleWon ? 1.4 : 0.4);
      score = clamp(Math.round(score), 0, 100);

      let grade = "C";
      if (score >= 88) grade = "S";
      else if (score >= 72) grade = "A";
      else if (score >= 56) grade = "B";
      else if (score < 40) grade = "D";

      const tables = {
        S: { winBonus: 0.22, lootBonus: 0.52, tacticalMomentum: 0.2, casualtyMitigation: 0.16 },
        A: { winBonus: 0.16, lootBonus: 0.36, tacticalMomentum: 0.12, casualtyMitigation: 0.1 },
        B: { winBonus: 0.09, lootBonus: 0.22, tacticalMomentum: 0.06, casualtyMitigation: 0.04 },
        C: { winBonus: 0.03, lootBonus: 0.08, tacticalMomentum: 0.01, casualtyMitigation: 0 },
        D: { winBonus: -0.05, lootBonus: 0, tacticalMomentum: -0.08, casualtyMitigation: -0.08 },
      };
      const bonus = tables[grade] || tables.C;
      const tacticalMomentum = clamp(
        bonus.tacticalMomentum + (playerBattleWon ? 0.04 : -0.06) + ((score - 50) / 300),
        -0.24,
        0.24
      );

      this.finished = true;
      this.result = {
        grade,
        score,
        winBonus: clamp(bonus.winBonus, -0.1, 0.3),
        lootBonus: clamp(bonus.lootBonus, 0, 1),
        tacticalMomentum,
        casualtyMitigation: clamp(bonus.casualtyMitigation + ((score - 50) / 500), -0.15, 0.18),
        timedOut: this.turnNumber > this.maxTurns,
        playerBattleWon,
        playerUnitsRemaining: playerAlive.length,
        enemyUnitsRemaining: enemyAlive.length,
        playerMaterial,
        enemyMaterial,
        cardsPlayed: this.sides.player.cardsPlayed || 0,
        enemyCardsPlayed: this.sides.enemy.cardsPlayed || 0,
        seed: this.seed >>> 0,
      };
      return this.result;
    }

    getResult() {
      return this.result || null;
    }
  }

  function createBattle(opts = {}) {
    return new CityWarBattleState(opts);
  }

  return {
    CARD_DEFS,
    PIECE_RULES,
    fnv1a,
    describeBattlePlan,
    createBattle,
    createSeededStream(seed, state) {
      return new SeededStream(seed, state);
    },
  };
});
