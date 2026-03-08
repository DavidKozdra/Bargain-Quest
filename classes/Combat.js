// Combat.js — Turn-based tactical combat system
// Crit chance, weapon bonuses, terrain effects, and complex raider behaviors

const WEAPONS = {
  'Fists': { damage: 0, crit: 0.05, speed: 0 },
  'Dagger': { damage: 1, crit: 0.10, speed: 2 },
  'Sword': { damage: 2, crit: 0.15, speed: 0 },
  'Axe': { damage: 3, crit: 0.20, speed: -1 },
  'Bow': { damage: 2, crit: 0.15, speed: 1, range: true },
  'Crossbow': { damage: 3, crit: 0.25, speed: -1, range: true },
  'Staff': { damage: 2, crit: 0.10, speed: 0, magic: true },
};

const TERRAIN_BONUSES = {
  'Forest': { defense: 1, offense: 0, flee: 0.65, description: '+1 Defense, easier escape' },
  'Grass': { defense: 0, offense: 0, flee: 0.50, description: 'Standard terrain' },
  'Sand': { defense: -1, offense: 0, flee: 0.35, description: '-1 Defense, harder escape' },
  'Rock': { defense: 2, offense: 1, flee: 0.30, description: '+2 Defense, +1 Attack' },
  'Snow': { defense: -1, offense: -1, flee: 0.25, description: '-1 Defense/Attack, harder escape' },
  'Water': { defense: 0, offense: 2, flee: 0.40, description: '+2 Attack, swimmers only' },
  'Mountain': { defense: 3, offense: 2, flee: 0.20, description: '+3 Defense, +2 Attack' },
};

const RAIDER_TYPES = {
  'bandit': { name: 'Bandit', critChance: 0.10, special: 'ambush', speed: 3, desc: 'May strike first' },
  'marauder': { name: 'Marauder', critChance: 0.15, special: 'rage', speed: 1, desc: 'Gets stronger when hurt' },
  'raider': { name: 'Raider', critChance: 0.12, special: 'shield', speed: 2, desc: 'Has defensive bonus' },
  'boss': { name: 'Raider Captain', critChance: 0.20, special: 'command', speed: 2, desc: 'Heals and rallies allies' },
  'scout': { name: 'Scout', critChance: 0.25, special: 'strike', speed: 4, desc: 'High crit, lightning fast' },
  'dragon': { name: 'Dragon', critChance: 0.30, special: 'fire', speed: 2, desc: 'Breathes fire, may stun', monster: true },
  'blackKnight': { name: 'Black Knight', critChance: 0.20, special: 'armor', speed: 1, desc: 'Heavy armor absorbs hits', monster: true },
  'wraith': { name: 'Wraith', critChance: 0.35, special: 'phase', speed: 3, desc: 'Phases through attacks, poisons on hit', monster: true },
  'pirate': { name: 'Pirate', critChance: 0.15, special: 'broadside', speed: 2, desc: 'Fires broadsides from their ship' },
  'seaMonster': { name: 'Sea Monster', critChance: 0.20, special: 'rage', speed: 2, desc: 'Grows more frenzied as it takes damage', monster: true },
};

// Status effect definitions
const STATUS_EFFECTS = {
  poison: { name: 'Poison', icon: '🤢', dmgPerTurn: 2, duration: 3, stackable: true },
  bleed:  { name: 'Bleed', icon: '🩸', dmgPerTurn: 1, duration: 2, stackable: false },
  stun:   { name: 'Stun', icon: '💫', dmgPerTurn: 0, duration: 1, stackable: false },
  daze:   { name: 'Daze', icon: '😵', dmgPerTurn: 0, duration: 1, stackable: false },
};

// Naval combat constants
const NAVAL_GRID_SIZE = 5;
const NAVAL_TICK_MS = 2400;       // ms total per enemy cycle
const NAVAL_TELEGRAPH_MS = 800;  // ms warning before enemy fires

class CombatSystem {
  constructor(services = {}) {
    this.services = services || {};
    this.active = false;
    this.raider = null;
    this.playerHP = 0;
    this.raiderHP = 0;
    this.log = [];
    this.turnCount = 0;
    this.result = null;
    this.onComplete = null;
    this._returnState = null;
    this.currentTerrain = 'Grass';
    this.raiderType = null;
    this.raiderRage = 0;
    this.lastCombatEvents = [];
    this._cachedBribeCost = null;

    // Initiative & turn order
    this.enemyGoesFirst = false;
    this._mustBlockFirst = false;

    // Status effects: arrays of { type, remainingTurns, dmgPerTurn }
    this.playerStatusEffects = [];
    this.raiderStatusEffects = [];

    // Fumble state (persists for 1 turn)
    this.fumbleEffect = null; // null | 'selfDamage' | 'dropWeapon' | 'stumble'
    this._droppedWeapon = false;        // active this round (uses fists)
    this._pendingDroppedWeapon = false; // becomes active at start of next attack turn
    this._stumbleBonus = 0;     // extra attack bonus for enemy next turn

    // Naval combat state
    this.isNavalCombat = false;
    this.playerBoatType = null;
    this.enemyBoatType = null;
    this.playerGrid = null;   // NxN: null, 'miss', 'hit'
    this.enemyGrid = null;    // NxN: null, 'miss', 'hit'
    this.playerShipPos = null;      // {r,c} movable anchor
    this.playerShipHorizontal = true;
    this.enemyShipPos = null;       // {r,c} movable anchor
    this.enemyShipHorizontal = true;
    this.enemyTargetCell = null;    // {r,c} shown as warning before fire
    this.navalRound = 0;
    this._navalTickTimer = null;
    this.playerEscortFleet = [];    // AI-controlled allied ships with captains
    this.enemyFleetShips = 1;       // Number of pirate ships in this encounter
    this.playerUncrewedSupport = 0; // Owned ships not participating (no captain)
    this._initPlayerHP = 0;
    this._initRaiderHP = 0;
    this._permadeathTriggered = false;

    // Event emitter
    this._handlers = {};
    this.navalPhase = null;         // 'player_aim' | 'telegraph' | 'enemy_fire' | null
    this._navalTelegraphTimeout = null;
    this._navalFireTimeout = null;

    // Special abilities (Phase C)
    this._abilityCooldowns = { chainShot: 0, smokeScreen: 0, repair: 0 };
    this._activeEffects = { chainShot: false, smokeScreen: false };

    // AI behavior states (Phase D)
    this.enemyBehavior = 'aggressive'; // 'aggressive' | 'evasive' | 'flanker'
    this._behaviorRoundsLeft = 3 + Math.floor(Math.random() * 3);

    // Environmental effects (Phase E)
    this.environmentCells = [];
  }

  addLog(message) {
    this.log.push(message);
  }

  _getPlayerRef() {
    return this.services.player || (typeof player !== 'undefined' ? player : null);
  }

  _getCitiesRef() {
    return this.services.cities || (typeof cities !== 'undefined' ? cities : []);
  }

  // ─── Event emitter ───────────────────────────────────────────
  on(event, handler)  { (this._handlers[event] ??= []).push(handler); return this; }
  off(event, handler) { this._handlers[event] = (this._handlers[event] || []).filter(h => h !== handler); }
  _emit(event, data)  { (this._handlers[event] || []).forEach(h => h(data)); }

  playerAction(type, secondArg) {
    if (this.result) return { message: '', resolved: true, won: this.result === 'win', fled: this.result === 'fled' };
    if (type === 'fight') return this.doPlayerAttack(secondArg);  // secondArg = accuracy 0-1
    if (type === 'block') {
      // Backwards-compatible API: either numeric accuracy or { accuracy, timeout }
      if (typeof secondArg === 'object' && secondArg !== null) {
        return this.doEnemyAttack(secondArg.accuracy, { timeout: !!secondArg.timeout });
      }
      return this.doEnemyAttack(secondArg, { timeout: false });
    }
    if (type === 'blockTimeout') {
      const blockAccuracy = (typeof secondArg === 'number') ? secondArg : 0;
      return this.doEnemyAttack(blockAccuracy, { timeout: true });
    }
    if (type === 'attackTimeout') return this.doTimeoutPenalty();
    if (type === 'flee') this.doFlee();
    else if (type === 'bribe') this.doBribe(secondArg);  // secondArg = confirmed boolean

    return {
      message: this.log[this.log.length - 1] || '',
      won: this.result === 'win',
      fled: this.result === 'fled',
      resolved: this.result !== null,
      loot: this.result === 'win' ? this.raider?.loot : null,
    };
  }

  startCombat(raider) {
    const p = this._getPlayerRef();
    if (!p) return;
    // Remember where we came from so endCombat can reliably return there.
    try {
      if (typeof gameStateManager !== 'undefined' && gameStateManager?.is?.(GameStates.CITY_MANAGE)) {
        this._returnState = GameStates.CITY_MANAGE;
      } else {
        this._returnState = GameStates.PLAYING;
      }
    } catch (_e) {
      this._returnState = GameStates.PLAYING;
    }

    this.active = true;
    this.raider = raider;
    this.currentTerrain = grid[p.y]?.[p.x]?.options[0] || 'Grass';
    this.raiderType = raider.type || 'bandit';
    this.raiderRage = 0;
    this.lastCombatEvents = [];
    this._cachedBribeCost = null;
    this._resolvedWeaponName = null;
    this._resolvedWeapon = null;

    // Reset new combat state
    this.enemyGoesFirst = false;
    this.playerStatusEffects = [];
    this.raiderStatusEffects = [];
    this.fumbleEffect = null;
    this._droppedWeapon = false;
    this._pendingDroppedWeapon = false;
    this._stumbleBonus = 0;
    this._permadeathTriggered = false;
    this.playerEscortFleet = [];
    this.enemyFleetShips = 1;
    this.playerUncrewedSupport = 0;

    // --- Naval combat detection ---
    this.isNavalCombat = !!(raider.isPirate && p.isSailing && p.activeBoat);

    if (this.isNavalCombat) {
      this.raiderType = 'pirate';
      this.playerBoatType = p.activeBoat.type;
      this.enemyBoatType = raider.boat || 'rowboat';

      const pBoat = BoatLibrary[this.playerBoatType] || BoatLibrary.rowboat;
      const eBoat = BoatLibrary[this.enemyBoatType] || BoatLibrary.rowboat;
      this.playerEscortFleet = this._collectPlayerEscorts();
      this.enemyFleetShips = this._getEnemyFleetSize();

      // Scale enemy HP by raider strength; player HP scales by boat condition
      const strMul = 1 + (raider.strength || 1) * 0.1;
      const navalDiffMul = window.DIFFICULTY_CONFIG?.raiderHpMultiplier || 1;
      const navalDayScale = this.getDayScaling();
      this.playerHP = p.activeBoat.getEffectiveHP();
      const baseEnemyShipHP = Math.ceil((eBoat.hp * 2 * strMul + navalDayScale.hpBonus) * navalDiffMul);
      const supportShipHP = Math.ceil(baseEnemyShipHP * 0.65);
      this.raiderHP = baseEnemyShipHP + Math.max(0, this.enemyFleetShips - 1) * supportShipHP;
      this._initPlayerHP = this.playerHP;
      this._initRaiderHP = this.raiderHP;

      this._initNavalGrids(pBoat.gridSize, eBoat.gridSize);

      this.log = [];
      this.turnCount = 0;
      this.result = null;
      this.navalRound = 0;

      this.addLog(`⚓ Naval Battle! Your ${pBoat.displayName} vs Pirate ${eBoat.displayName}!`);
      if (this.playerEscortFleet.length > 0) {
        this.addLog(`🧭 Your hired captains join with ${this.playerEscortFleet.length} escort ship${this.playerEscortFleet.length > 1 ? 's' : ''}.`);
      }
      if (this.playerUncrewedSupport > 0) {
        this.addLog(`🛠️ ${this.playerUncrewedSupport} owned ship${this.playerUncrewedSupport > 1 ? 's are' : ' is'} in reserve (no captain assigned).`);
      }
      if (this.enemyFleetShips > 1) {
        this.addLog(`🏴‍☠️ Pirate fleet spotted: ${this.enemyFleetShips} ships.`);
      }
      this.addLog(`Find the enemy ship (${eBoat.gridSize} cell${eBoat.gridSize > 1 ? 's' : ''}) and sink the fleet!`);
      this.addLog(`WASD to dodge · Click enemy grid to fire!`);
      this.addLog(`Watch for 🎯 warnings — move before the cannon fires!`);

      gameStateManager.setState(GameStates.COMBAT);
      // Phase engine is started by _initNavalUI() after subscriptions are set up
      return;
    }

    // --- Standard land combat ---
    const playerStr = this.getPlayerStrength();
    const terrain = TERRAIN_BONUSES[this.currentTerrain];
    const dayScale = this.getDayScaling();

    // HP: use player's persistent currentHP directly (consistent with HUD)
    const maxHP = p.getMaxHP ? p.getMaxHP() : (10 + (p.bonusMaxHP || 0));
    if (p.currentHP == null) p.currentHP = maxHP;
    this.playerHP = p.currentHP;
    const diffMul = window.DIFFICULTY_CONFIG?.raiderHpMultiplier || 1;
    this.raiderHP = Math.ceil((this.raider.strength * 2 + 5 + dayScale.hpBonus) * diffMul);
    this._initPlayerHP = maxHP; // use true max for bar percentage
    this._initRaiderHP = this.raiderHP;

    this.log = [];
    this.turnCount = 0;
    this.result = null;

    const raiderInfo = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];
    this.addLog(`You encounter a ${raiderInfo.name} on ${this.currentTerrain}!`);
    if (terrain.description) this.addLog(`Terrain: ${terrain.description}`);
    if (raiderInfo.desc) this.addLog(`Enemy: ${raiderInfo.desc}`);
    if (raiderInfo.monster) this.addLog(`⚠ This creature cannot be bribed!`);

    // --- Initiative system ---
    const playerSpeed = (p.speed || 2) + (playerStr.weapon.speed || 0) + Math.floor(Math.random() * 6) + 1;
    const raiderSpeed = (raiderInfo.speed || 2) + (raider.speed || 1) + Math.floor(Math.random() * 6) + 1;

    if (raiderSpeed > playerSpeed) {
      this.enemyGoesFirst = true;
      this.addLog(`⚡ ${raiderInfo.name} is faster — they strike first!`);
    } else if (raiderSpeed === playerSpeed) {
      // Tie: 50/50
      this.enemyGoesFirst = Math.random() < 0.5;
      if (this.enemyGoesFirst) {
        this.addLog(`⚡ You react at the same time — but ${raiderInfo.name} edges ahead!`);
      } else {
        this.addLog(`⚡ You react at the same time — you edge ahead!`);
      }
    } else {
      this.addLog(`⚡ You're faster — you act first!`);
    }

    if (!this.enemyGoesFirst) {
      this.addLog(`Choose your action.`);
    }

    gameStateManager.setState(GameStates.COMBAT);
    // Emit combatStart so UI can react/animate
    try { this._emit('combatStart', { raider }); } catch (e) { /* ignore */ }
  }

  /** Get difficulty scaling based on days elapsed — gradual curve */
  getDayScaling() {
    const day = (typeof dayNight !== 'undefined') ? dayNight.getDaysElapsed() : 0;
    const speed = window.DIFFICULTY_CONFIG?.dayScalingSpeed || 1;
    return {
      strengthBonus: Math.min(4, Math.floor(day / (25 / speed))),     // +1 per 25 days, cap +4
      hpBonus: Math.min(6, Math.floor(day / (20 / speed))),            // +1 per 20 days, cap +6
      extraInputs: day >= (80 / speed) ? 1 : 0,                        // extra input only after day 80
      timerReduction: Math.min(100, Math.floor(day / (15 / speed)) * 8), // max 100ms faster
    };
  }

  getPlayerStrength() {
    const p = this._getPlayerRef();
    if (!p) {
      return { total: 3, base: 3, weapon: WEAPONS['Fists'], weaponName: 'Fists', speed: 2 };
    }
    let str = 3;
    str += Math.min(p.party.length, 3); // Cap party bonus at 3

    let bestWeapon = { damage: 0, crit: 0.05, speed: 0 };
    let bestWeaponName = 'Fists';

    // If weapon was dropped due to fumble, force Fists
    if (this._droppedWeapon) {
      bestWeaponName = 'Fists';
      bestWeapon = WEAPONS['Fists'];
    } else if (p.equippedWeapon && p.inventory.has(p.equippedWeapon) && WEAPONS[p.equippedWeapon]) {
      bestWeapon = WEAPONS[p.equippedWeapon];
      bestWeaponName = p.equippedWeapon;
    } else {
      // Fall back: auto-detect best weapon in inventory
      for (const item of p.inventory.keys()) {
        const weapon = WEAPONS[item];
        if (weapon && weapon.damage > bestWeapon.damage) {
          bestWeapon = weapon;
          bestWeaponName = item;
        }
      }
    }
    if (p.inventory.has('Tools')) str += 1;

    this._resolvedWeaponName = bestWeaponName;
    this._resolvedWeapon = bestWeapon;
    return {
      total: str + bestWeapon.damage,
      base: str,
      weapon: bestWeapon,
      weaponName: bestWeaponName,
      speed: (p.speed || 2) + (bestWeapon.speed || 0),
    };
  }

  getPlayerCritChance() {
    const p = this._getPlayerRef();
    if (!p) return 0.05;
    // Fumble: dropped weapon means fists
    if (this._droppedWeapon) return 0.05;
    // Prefer equipped weapon
    if (p.equippedWeapon && p.inventory.has(p.equippedWeapon) && WEAPONS[p.equippedWeapon]) {
      return WEAPONS[p.equippedWeapon].crit;
    }
    let crit = 0.05;
    for (const item of p.inventory.keys()) {
      const weapon = WEAPONS[item];
      if (weapon && weapon.crit > crit) crit = weapon.crit;
    }
    return crit;
  }

  getTerrain() {
    return this.currentTerrain;
  }

  getTerrainBonus(type) {
    const terrain = TERRAIN_BONUSES[this.currentTerrain] || TERRAIN_BONUSES['Grass'];
    return terrain[type] || 0;
  }

  getRaiderType() {
    return this.raiderType || 'bandit';
  }

  _getRaiderMagicPower() {
    // Wraiths are the strongest casters, dragons a bit lower, others scale down.
    const magicByType = {
      wraith: 9,
      dragon: 7,
      blackKnight: 5,
      boss: 4,
      seaMonster: 4,
      pirate: 3,
      scout: 3,
      marauder: 3,
      raider: 2,
      bandit: 1,
    };
    const key = this.getRaiderType();
    const byType = magicByType[key] || 2;
    const strengthBonus = Math.max(0, Math.floor(((this.raider?.strength || 0) - 3) / 2));
    return Math.max(1, byType + strengthBonus);
  }

  // Generate a pattern sequence for the fight mini-game
  // Pattern varies by equipped/best weapon type
  // Timers tighten with raider strength, day scaling, and fatigue
  generatePattern() {
    const strength = this.raider ? this.raider.strength : 3;
    // Resolve current weapon
    if (!this._resolvedWeaponName) this.getPlayerStrength();
    const weaponName = this._resolvedWeaponName || 'Fists';
    const directions = ['left', 'up', 'down', 'right'];
    const dayScale = this.getDayScaling();
    const fatigueMul = this._getFatigueTimerMultiplier();

    switch (weaponName) {
      case 'Axe': {
        const swings = Math.min(4, 2 + Math.floor(strength / 4)) + dayScale.extraInputs;
        let timePerSwing = Math.max(1000, 1800 - strength * 80) - dayScale.timerReduction;
        timePerSwing = Math.max(800, Math.round(timePerSwing));
        return {
          qteType: 'powerMeter', weaponType: weaponName,
          swings, timePerSwing, totalTime: swings * timePerSwing,
          sweetSpotSize: Math.max(0.10, 0.22 - strength * 0.012),
        };
      }
      case 'Bow': {
        const targets = Math.min(8, 3 + Math.floor(strength / 2)) + dayScale.extraInputs;
        let timePerTarget = Math.max(1000, 1800 - strength * 100) - dayScale.timerReduction;
        timePerTarget = Math.max(800, Math.round(timePerTarget));
        return {
          qteType: 'clickTarget', weaponType: weaponName,
          targetCount: targets, timePerTarget,
          totalTime: targets * timePerTarget,
        };
      }
      case 'Crossbow': {
        const targets = Math.min(10, 4 + Math.floor(strength / 2)) + dayScale.extraInputs;
        let timePerTarget = Math.max(650, 1200 - strength * 80) - dayScale.timerReduction;
        timePerTarget = Math.max(400, Math.round(timePerTarget * fatigueMul));
        return {
          qteType: 'clickTarget', weaponType: weaponName,
          targetCount: targets, timePerTarget,
          totalTime: targets * timePerTarget,
        };
      }
      case 'Staff': {
        const magicPower = this._getRaiderMagicPower();
        const requiredPresses = Math.min(
          90,
          10 + (magicPower * 3) + Math.floor(strength / 2) + (dayScale.extraInputs * 2)
        );
        let totalTime = Math.max(2200, 5200 - magicPower * 240 - strength * 90 - dayScale.timerReduction);
        totalTime = Math.max(1800, Math.round(totalTime * fatigueMul));
        return {
          qteType: 'spellMash', weaponType: weaponName,
          requiredPresses, totalTime, enemyMagic: magicPower,
        };
      }
      case 'Dagger': {
        const count = Math.min(8, 4 + Math.floor(strength / 3)) + dayScale.extraInputs;
        let timePerArrow = Math.max(550, 800 - strength * 35) - dayScale.timerReduction;
        timePerArrow = Math.max(450, Math.round(timePerArrow));
        const arrows = [];
        for (let i = 0; i < count; i++) {
          arrows.push(directions[Math.floor(Math.random() * 4)]);
        }
        return {
          qteType: 'arrows', weaponType: weaponName,
          arrows, timePerArrow, totalTime: count * timePerArrow,
          theme: { emoji: '🗡️', label: 'Slash the pattern!', arrowClass: 'ws-arrow-dagger' },
        };
      }
      case 'Sword': {
        const count = Math.min(5, 2 + Math.floor(strength / 3)) + dayScale.extraInputs;
        let timePerArrow = Math.max(900, 1500 - strength * 80) - dayScale.timerReduction;
        timePerArrow = Math.max(700, Math.round(timePerArrow));
        const arrows = [];
        for (let i = 0; i < count; i++) {
          arrows.push(directions[Math.floor(Math.random() * 4)]);
        }
        return {
          qteType: 'arrows', weaponType: weaponName,
          arrows, timePerArrow, totalTime: count * timePerArrow,
          theme: { emoji: '⚔️', label: 'Strike the pattern!', arrowClass: 'ws-arrow-sword' },
        };
      }
      default: {
        const count = Math.min(10, 3 + Math.floor(strength / 2)) + dayScale.extraInputs;
        let timePerArrow = Math.max(500, 750 - strength * 50) - dayScale.timerReduction;
        timePerArrow = Math.max(400, Math.round(timePerArrow));
        const arrows = [];
        for (let i = 0; i < count; i++) {
          arrows.push(directions[Math.floor(Math.random() * 4)]);
        }
        return {
          qteType: 'arrows', weaponType: 'Fists',
          arrows, timePerArrow, totalTime: count * timePerArrow,
          theme: { emoji: '👊', label: 'Match the pattern!', arrowClass: 'ws-arrow-fists' },
        };
      }
    }
  }

  /** Get timer multiplier based on fatigue. Always 1 — fatigue only affects accuracy now. */
  _getFatigueTimerMultiplier() {
    return 1;
  }

  /** Accuracy cap — no fatigue system, always return 1 */
  _getFatigueAccuracyCap() {
    return 1;
  }

  // Phase 1: Player attacks — accuracy from attack QTE (0-1)
  doPlayerAttack(accuracy) {
    const p = this._getPlayerRef();
    if (!p) return { message: 'No player context', resolved: true, won: false, fled: false, loot: null };
    this.turnCount++;
    const raiderType = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];

    // Activate any deferred weapon drop from the previous turn.
    if (this._pendingDroppedWeapon) {
      this._droppedWeapon = true;
      this._pendingDroppedWeapon = false;
      this.addLog(`🗡️ You're still recovering your weapon — fighting with fists this round.`);
    }

    // --- Apply status effects at start of round ---
    const statusResult = this._applyStatusEffects();
    if (statusResult.playerStunned) {
      this.addLog(`--- Round ${this.turnCount} ---`);
      this.addLog(`💫 You're stunned and can't act!`);
      if (this.playerHP <= 0) {
        this.result = 'lose';
        this.addLog(`Defeat! The ${raiderType.name} overwhelms you.`);
        this.resolveCombat();
      }
      return {
        message: this.log[this.log.length - 1] || '',
        enemyKilled: false, playerDmg: 0, playerMiss: true, playerCritHit: false,
        playerStunned: true,
        resolved: this.result !== null, won: false, fled: false, loot: null,
      };
    }

    const playerStr = this.getPlayerStrength();
    const weaponName = playerStr.weaponName || 'Fists';
    const usingFists = weaponName === 'Fists' || this._droppedWeapon;

    // --- Fumble check: low accuracy (<30%) ---
    const fumbleThreshold = usingFists ? 0.22 : 0.3;
    if (accuracy !== null && accuracy !== undefined && accuracy < fumbleThreshold && accuracy > 0) {
      const fumbleRoll = Math.random();
      if (fumbleRoll < 0.55) {
        // Self-damage
        const selfDmg = 1 + Math.floor(Math.random() * 2);
        this.playerHP -= selfDmg;
        this.addLog(`💥 You fumble and cut yourself for ${selfDmg} damage!`);
      } else if (fumbleRoll < 0.8 && !usingFists) {
        // Drop weapon for NEXT turn
        this._pendingDroppedWeapon = true;
        this.addLog(`🗡️ Your weapon flies from your grip! Next round you'll fight with fists.`);
      } else {
        // Stumble — enemy gets +2 next attack
        this._stumbleBonus = 2;
        this.addLog(`🦶 You stumble, leaving an opening!`);
      }
    }

    const playerCrit = this.getPlayerCritChance();

    let playerAttack = playerStr.total + this.getTerrainBonus('offense') + (p.bonusAttack || 0);

    // Armor: Black Knight takes 1 less damage per hit
    let armorReduction = raiderType.special === 'armor' ? 1 : 0;

    // Shield: raider type gets +2 defense first 2 turns, then +1
    let shieldBonus = 0;
    if (raiderType.special === 'shield') {
      shieldBonus = this.turnCount <= 2 ? 2 : 1;
    }

    // Smooth QTE scaling: no hard miss / guaranteed-hit cliffs.
    const acc = (accuracy !== null && accuracy !== undefined)
      ? Math.max(0, Math.min(1, accuracy))
      : null;
    const playerDie = Math.floor(Math.random() * 6) + 1;
    const accuracyBonus = (acc === null)
      ? 0
      : (usingFists ? Math.round((acc - 0.4) * 2) : Math.round((acc - 0.5) * 3));
    const perfectExecution = acc !== null && acc >= 0.99;
    const forceCrit = perfectExecution;
    const perfectMiss = perfectExecution ? (Math.random() < 0.05) : false;
    const executionMult = (acc === null) ? 1 : (0.65 + acc * 0.70);          // 0.65x..1.35x
    const defensePenaltyFromAccuracy = (acc === null)
      ? (usingFists ? 1 : 0)
      : Math.min(3, Math.round(acc * 2) + (usingFists ? 1 : 0));
    const playerRoll = playerDie + playerAttack + accuracyBonus;

    // Enemy defense — strength-based with shield bonus and daze penalty
    let raiderDefMod = this.raider.strength + shieldBonus;
    // Daze: raider rolls at -2
    if (this._hasStatusEffect(this.raiderStatusEffects, 'daze')) {
      raiderDefMod = Math.max(0, raiderDefMod - 2);
      this.addLog(`😵 ${raiderType.name} is dazed — defenses lowered!`);
    }
    const raiderDefRoll = Math.floor(Math.random() * 6) + 1 + Math.max(0, raiderDefMod - defensePenaltyFromAccuracy);

    this.addLog(`--- Round ${this.turnCount} ---`);
    const accLabel = (accuracy !== null && accuracy !== undefined)
      ? `${Math.round(accuracy * 100)}%` : 'd6';
    const bonusStr = accuracyBonus > 0 ? `+${accuracyBonus}` : '';
    if (this._droppedWeapon) this.addLog(`👊 Fighting with fists!`);
    this.addLog(`⚔️ You attack! Roll ${playerRoll} (${accLabel}+${playerAttack}${bonusStr})`);

    // Wraith phase: 30% chance to dodge
    // Perfect execution should almost always connect; cap miss chance at 5% total.
    let wraithDodge = !perfectExecution && raiderType.special === 'phase' && Math.random() < 0.3;
    let enemyKilled = false;
    let playerDmg = 0;
    let playerMiss = false;
    let playerCritHit = false;

    if (perfectMiss) {
      this.addLog(`So close! Your perfect setup still slips at the last second.`);
      playerMiss = true;
    } else if (wraithDodge) {
      this.addLog(`The ${raiderType.name} phases out — your attack passes through!`);
      playerMiss = true;
    } else if (perfectExecution || (playerRoll + (usingFists ? 1 : 0)) > raiderDefRoll) {
      const baseHit = Math.max(1, playerRoll - raiderDefRoll - armorReduction);
      playerDmg = Math.max(usingFists ? 2 : 1, Math.round(baseHit * executionMult));
      if (forceCrit || Math.random() < playerCrit) {
        playerDmg *= 2;
        playerCritHit = true;
        this.addLog(forceCrit ? `🌟 PERFECT STRIKE — CRITICAL HIT!` : `💥 CRITICAL HIT!`);
        // Player crits apply bleed to raiders
        this._applyStatusToRaider('bleed');
      }
      // Magic weapons get full bonus damage from bonusMagic
      if (WEAPONS[weaponName]?.magic && (p.bonusMagic || 0) > 0) {
        const magicDmg = p.bonusMagic;
        playerDmg += magicDmg;
        this.addLog(`🔮 Magic surge! +${magicDmg} arcane damage!`);
      } else if ((p.bonusMagic || 0) > 0) {
        // Non-magic weapons: chance of minor arcane damage
        const magicChance = Math.min((p.bonusMagic || 0) * 0.10, 0.50);
        if (Math.random() < magicChance) {
          const minorDmg = Math.max(1, Math.floor(p.bonusMagic / 2));
          playerDmg += minorDmg;
          this.addLog(`✨ Arcane flicker! +${minorDmg} magic damage!`);
        }
      }
      // Staff attacks: perfect cast stuns, otherwise 30% chance to daze
      if (weaponName === 'Staff' && !this._droppedWeapon) {
        if (forceCrit) {
          this._applyStatusToRaider('stun');
          this.addLog(`💫 Perfect spell — the ${raiderType.name} is stunned!`);
        } else if (Math.random() < 0.3) {
          this._applyStatusToRaider('daze');
          this.addLog(`✨ Your spell dazes the ${raiderType.name}!`);
        }
      }
      if (armorReduction > 0) this.addLog(`${raiderType.name}'s armor absorbs some damage.`);
      if (shieldBonus > 0) this.addLog(`${raiderType.name}'s shield blocks some force.`);
      this.raiderHP -= playerDmg;
      try {
        // Emit hpChanged for UI
        this._emit('hpChanged');
      } catch (e) {}
      // Visual/sound effects: spawn hit particles & damage splash in combat UI
      try {
        // Determine effect scale from prefs
        const intensity = (localStorage.getItem('pref_combat_effects_intensity') || 'medium');
        const scaleMap = { subtle: 0.7, medium: 1.0, heavy: 1.4 };
        const scale = scaleMap[intensity] || 1.0;
        if (localStorage.getItem('pref_combat_effects') !== 'false' && typeof particleSystem !== 'undefined') {
          const el = document.getElementById('enemyHpBar');
          const canvasEl = document.querySelector('canvas');
          if (el && canvasEl) {
            const r = el.getBoundingClientRect();
            const cvsRect = canvasEl.getBoundingClientRect();
            const xCss = (r.left - cvsRect.left) + r.width/2;
            const yCss = (r.top - cvsRect.top) + r.height/2;
            const pixelScale = (canvasEl && canvasEl.width && cvsRect.width) ? (canvasEl.width / cvsRect.width) : 1;
            const color = playerCritHit ? '#ffd54f' : '#ff8a65';
            particleSystem.spawnBurst(xCss * pixelScale, yCss * pixelScale, { count: Math.round(18 * scale), color, size: Math.round(5 * scale), speed: 140 * scale, frame: null, screen: true });
          }
        }
        // Show transient dmg on enemy bar (UI helper)
        if (typeof _showDmgSplash === 'function') _showDmgSplash('enemyHpBar', playerDmg);
        // Small camera nudge for crits
        if (typeof startCameraShake === 'function') startCameraShake(playerCritHit ? 6 * scale : 3 * scale, playerCritHit ? 320 : 180);
      } catch (e) { console.error('combat hit effect error:', e); }
      this.addLog(`You strike for ${playerDmg} damage! Enemy HP: ${Math.max(0, this.raiderHP)}`);
    } else {
      // Miss — no more graze; a miss is a miss
      this.addLog(`Your attack misses!`);
      playerMiss = true;
    }

    // Command: boss heals 1 HP per turn
    if (raiderType.special === 'command' && this.raiderHP > 0) {
      this.raiderHP = Math.min(this._initRaiderHP, this.raiderHP + 1);
      this.addLog(`📯 ${raiderType.name} rallies — recovers 1 HP!`);
    }

    // Recover dropped weapon after this attack
    if (this._droppedWeapon) {
      this._droppedWeapon = false;
      this.addLog(`You recover your weapon.`);
    }

    if (this.raiderHP <= 0) {
      this.result = 'win';
      this.addLog(`Victory! The ${raiderType.name} is defeated.`);
      this.resolveCombat();
      enemyKilled = true;
    }

    return {
      message: this.log[this.log.length - 1] || '',
      enemyKilled,
      playerDmg,
      playerMiss,
      playerCritHit,
      resolved: this.result !== null,
      won: this.result === 'win',
      fled: this.result === 'fled',
      loot: this.result === 'win' ? this.raider?.loot : null,
    };
  }

  // Phase 2: Enemy attacks, player blocks — blockAccuracy from block QTE (0-1)
  doEnemyAttack(blockAccuracy, opts = {}) {
    const p = this._getPlayerRef();
    if (!p) return { message: 'No player context', resolved: true, won: false, fled: false, loot: null };
    const raiderType = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];

    // Check raider stun — skip attack and tick down the effect
    if (this._hasStatusEffect(this.raiderStatusEffects, 'stun')) {
      this.addLog(`💫 ${raiderType.name} is stunned and can't attack!`);
      for (let i = this.raiderStatusEffects.length - 1; i >= 0; i--) {
        if (this.raiderStatusEffects[i].type === 'stun') {
          this.raiderStatusEffects[i].remainingTurns--;
          if (this.raiderStatusEffects[i].remainingTurns <= 0) {
            this.addLog(`💫 ${raiderType.name} shakes off the stun.`);
            this.raiderStatusEffects.splice(i, 1);
          }
        }
      }
      return {
        message: `💫 ${raiderType.name} is stunned and can't attack!`,
        raiderStunned: true, finalDmg: 0, enemyMiss: false, raiderCritHit: false,
        resolved: this.result !== null, won: this.result === 'win', fled: false, loot: null,
      };
    }

    let raiderAttack = this.raider.strength;

    if (raiderType.special === 'rage') {
      raiderAttack += Math.floor(this.raiderRage / 2);
      this.raiderRage++;
      if (this.raiderRage >= 2) this.addLog(`🔥 ${raiderType.name} seethes with rage!`);
    }

    // Command: boss gets +1 attack
    if (raiderType.special === 'command') {
      raiderAttack += 1;
    }

    // Stumble bonus from player fumble
    if (this._stumbleBonus > 0) {
      raiderAttack += this._stumbleBonus;
      this.addLog(`${raiderType.name} exploits your stumble!`);
      this._stumbleBonus = 0;
    }

    // Enemy attack roll
    const raiderDie = Math.floor(Math.random() * 6) + 1;
    const raiderRoll = raiderDie + raiderAttack;

    // Player base defense
    const playerDef = this.getTerrainBonus('defense') + 2 + (p.bonusDefense || 0);

    // Enemy miss: low roll vs player defense
    const enemyMiss = raiderRoll <= playerDef;

    // Block reduces damage: 100% block = 75% reduction, 0% = 0%
    const blockReduction = (blockAccuracy || 0) * 0.75;

    let rawDmg = Math.max(1, raiderRoll - playerDef);

    // Dragon fire special — now has 30% stun chance (only on hit)
    if (raiderType.special === 'fire' && !enemyMiss && this.turnCount % 2 === 0) {
      const fireDmg = 1 + Math.floor(Math.random() * 3);
      rawDmg += fireDmg;
      this.addLog(`🔥 ${raiderType.name} breathes fire for +${fireDmg} damage!`);
      if (Math.random() < 0.3) {
        this._applyStatusToPlayer('stun');
        this.addLog(`💫 The flames stun you!`);
      }
    }

    // Wraith poison on hit
    if (raiderType.special === 'phase' && !enemyMiss) {
      this._applyStatusToPlayer('poison');
      this.addLog(`🤢 The ${raiderType.name}'s touch poisons you!`);
    }

    // Marauder bleed on crit (only on hit)
    const raiderCrit = raiderType.critChance || 0.10;
    let raiderCritHit = false;
    if (!enemyMiss && Math.random() < raiderCrit) {
      rawDmg *= 2;
      raiderCritHit = true;
      this.addLog(`💀 ${raiderType.name} CRITS!`);
      if (raiderType.special === 'rage') {
        this._applyStatusToPlayer('bleed');
        this.addLog(`🩸 The marauder's fury opens a wound — you're bleeding!`);
      }
    }

    // Stun on very bad block (<10%)
    if (!enemyMiss && (blockAccuracy || 0) < 0.1 && !raiderCritHit) {
      if (Math.random() < 0.3) {
        this._applyStatusToPlayer('stun');
        this.addLog(`💫 The unblocked blow stuns you!`);
      }
    }

    let finalDmg;
    if (enemyMiss) {
      finalDmg = 0;
      this.addLog(`🛡️ ${raiderType.name} attacks but misses!`);
    } else {
      finalDmg = Math.round(rawDmg * (1 - blockReduction));
      // Perfect block (>=90%) can fully negate damage
      if (blockAccuracy < 0.9) finalDmg = Math.max(1, finalDmg);
      if (opts.timeout === true && finalDmg > 0) {
        const bonusDmg = Math.max(1, Math.floor(finalDmg * 0.5));
        finalDmg += bonusDmg;
        this.addLog(`⌛ Unguarded! +${bonusDmg} bonus damage from hesitation!`);
      }
      const blockPct = Math.round((blockAccuracy || 0) * 100);
      if (finalDmg <= 0) {
        finalDmg = 0;
        this.addLog(`🛡️ Perfect block! (${blockPct}%) — You deflect the attack completely!`);
      } else if (blockAccuracy >= 0.8) {
        this.addLog(`🛡️ Strong block! (${blockPct}%) — ${raiderType.name} deals ${finalDmg} damage.`);
      } else if (blockAccuracy >= 0.5) {
        this.addLog(`🛡️ Partial block (${blockPct}%) — ${raiderType.name} deals ${finalDmg} damage.`);
      } else {
        this.addLog(`${raiderType.name} hits you for ${finalDmg} damage!`);
      }
      this.playerHP -= finalDmg;
      try {
        this._emit('hpChanged');
      } catch (e) {}
      try {
        const intensity = (localStorage.getItem('pref_combat_effects_intensity') || 'medium');
        const scaleMap = { subtle: 0.7, medium: 1.0, heavy: 1.4 };
        const scale = scaleMap[intensity] || 1.0;
        if (localStorage.getItem('pref_combat_effects') !== 'false' && typeof particleSystem !== 'undefined') {
          const el = document.getElementById('playerHpBar');
          const canvasEl = document.querySelector('canvas');
          if (el && canvasEl) {
            const r = el.getBoundingClientRect();
            const cvsRect = canvasEl.getBoundingClientRect();
            const xCss = (r.left - cvsRect.left) + r.width/2;
            const yCss = (r.top - cvsRect.top) + r.height/2;
            const pixelScale = (canvasEl && canvasEl.width && cvsRect.width) ? (canvasEl.width / cvsRect.width) : 1;
            particleSystem.spawnBurst(xCss * pixelScale, yCss * pixelScale, { count: Math.round(20 * scale), color: '#ff5252', size: Math.round(6 * scale), speed: 150 * scale, frame: null, screen: true });
          }
        }
        if (typeof _showDmgSplash === 'function' && finalDmg > 0) _showDmgSplash('playerHpBar', finalDmg);
        if (typeof startCameraShake === 'function' && finalDmg > 0) startCameraShake(7 * scale, 260);
      } catch (e) { console.error('combat land enemy hit effect error:', e); }
    }

    // Ambush special on first round (turnCount increments in doPlayerAttack, so check <= 1)
    if (raiderType.special === 'ambush' && this.turnCount <= 1) {
      const ambushDmg = Math.floor(Math.random() * 3) + 1;
      this.playerHP -= ambushDmg;
      this.addLog(`${raiderType.name} ambushes you for ${ambushDmg} extra damage!`);
      try { this._emit('hpChanged'); } catch (e) {}
      try {
        const intensity = (localStorage.getItem('pref_combat_effects_intensity') || 'medium');
        const scaleMap = { subtle: 0.7, medium: 1.0, heavy: 1.4 };
        const scale = scaleMap[intensity] || 1.0;
        if (localStorage.getItem('pref_combat_effects') !== 'false' && typeof particleSystem !== 'undefined') {
          const el = document.getElementById('playerHpBar');
          const canvasEl = document.querySelector('canvas');
          if (el && canvasEl) {
            const r = el.getBoundingClientRect();
            const cvsRect = canvasEl.getBoundingClientRect();
            const xCss = (r.left - cvsRect.left) + r.width/2;
            const yCss = (r.top - cvsRect.top) + r.height/2;
            const pixelScale = (canvasEl && canvasEl.width && cvsRect.width) ? (canvasEl.width / cvsRect.width) : 1;
            particleSystem.spawnBurst(xCss * pixelScale, yCss * pixelScale, { count: Math.round(16 * scale), color: '#ff5252', size: Math.round(5 * scale), speed: 130 * scale, frame: null, screen: true });
          }
        }
        if (typeof _showDmgSplash === 'function') _showDmgSplash('playerHpBar', ambushDmg);
        if (typeof startCameraShake === 'function') startCameraShake(7 * scale, 260);
      } catch (e) { console.error('combat ambush effect error:', e); }
    }

    this.addLog(`Your HP: ${Math.max(0, this.playerHP)}`);

    if (this.playerHP <= 0) {
      this.result = 'lose';
      this.addLog(`Defeat! The ${raiderType.name} overwhelms you.`);
      this.resolveCombat();
    }

    return {
      message: this.log[this.log.length - 1] || '',
      enemyDmg: finalDmg,
      enemyMiss,
      raiderCritHit,
      resolved: this.result !== null,
      won: this.result === 'win',
      fled: this.result === 'fled',
      loot: this.result === 'win' ? this.raider?.loot : null,
    };
  }

  /** QTE timeout penalty: enemy gets a free unblockable hit */
  doTimeoutPenalty() {
    const raiderType = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];
    const freeDmg = this.raider.strength + 1 + Math.floor(Math.random() * 3);
    this.playerHP -= freeDmg;
    this.addLog(`⌛ You hesitate — ${raiderType.name} strikes while you're off guard for ${freeDmg} damage!`);
    try { this._emit('hpChanged'); } catch (e) {}
    try {
      const intensity = (localStorage.getItem('pref_combat_effects_intensity') || 'medium');
      const scaleMap = { subtle: 0.7, medium: 1.0, heavy: 1.4 };
      const scale = scaleMap[intensity] || 1.0;
      if (localStorage.getItem('pref_combat_effects') !== 'false' && typeof particleSystem !== 'undefined') {
        const el = document.getElementById('playerHpBar');
        const canvasEl = document.querySelector('canvas');
        if (el && canvasEl) {
          const r = el.getBoundingClientRect();
          const cvsRect = canvasEl.getBoundingClientRect();
          const xCss = (r.left - cvsRect.left) + r.width/2;
          const yCss = (r.top - cvsRect.top) + r.height/2;
          const pixelScale = (canvasEl && canvasEl.width && cvsRect.width) ? (canvasEl.width / cvsRect.width) : 1;
          particleSystem.spawnBurst(xCss * pixelScale, yCss * pixelScale, { count: Math.round(18 * scale), color: '#ff5252', size: Math.round(6 * scale), speed: 150 * scale, frame: null, screen: true });
        }
      }
      if (typeof _showDmgSplash === 'function') _showDmgSplash('playerHpBar', freeDmg);
      if (typeof startCameraShake === 'function') startCameraShake(7 * scale, 260);
    } catch (e) { console.error('combat timeout effect error:', e); }
    if (this.playerHP <= 0) {
      this.result = 'lose';
      this.addLog(`Defeat! The ${raiderType.name} overwhelms you.`);
      this.resolveCombat();
    }
    return {
      message: this.log[this.log.length - 1] || '',
      enemyDmg: freeDmg,
      enemyMiss: false,
      resolved: this.result !== null,
      won: false,
      fled: false,
    };
  }

  // Generate block pattern for defensive QTE
  generateBlockPattern() {
    const raiderType = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];
    const strength = this.raider ? this.raider.strength : 3;
    const directions = ['left', 'up', 'down', 'right'];
    const dayScale = this.getDayScaling();

    let count = Math.min(6, 2 + Math.floor(strength / 3)) + dayScale.extraInputs;
    let timePerBlock = Math.max(700, 900 - strength * 30) - dayScale.timerReduction;
    timePerBlock = Math.max(600, Math.round(timePerBlock));
    // Scroll approach time — how long arrows are visible before reaching target
    const approachTime = 2200;
    // Time between spawns
    const spawnInterval = timePerBlock;

    // Scouts attack faster
    if (raiderType.special === 'strike') { timePerBlock -= 50; count += 1; }
    // Rage adds more attacks
    if (raiderType.special === 'rage') { count += Math.floor(this.raiderRage / 2); }
    // Cap
    count = Math.min(8, count);

    const attacks = [];
    for (let i = 0; i < count; i++) {
      attacks.push(directions[Math.floor(Math.random() * 4)]);
    }

    return {
      qteType: 'block',
      attacks,
      timePerBlock,
      spawnInterval: timePerBlock,
      approachTime,
      totalTime: approachTime + count * timePerBlock + 400,
      raiderName: raiderType.name,
    };
  }

  // Player chooses to flee
  doFlee() {
    const p = this._getPlayerRef();
    if (!p) return;
    const raiderType = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];
    let fleeChance = TERRAIN_BONUSES[this.currentTerrain]?.flee || 0.40;

    // Apply difficulty flee bonus/penalty
    const diffFleeBonus = window.DIFFICULTY_CONFIG?.fleeChanceBonus || 0;
    fleeChance = Math.max(0.05, Math.min(0.95, fleeChance + diffFleeBonus));

    if (raiderType.special === 'ambush') {
      fleeChance -= 0.10;
      this.addLog(`${raiderType.name} is watching for escape attempts!`);
    }
    fleeChance = Math.max(0.05, Math.min(0.95, fleeChance));

    this.addLog(`You attempt to flee... (${Math.floor(fleeChance * 100)}% chance on ${this.currentTerrain})`);

    if (Math.random() < fleeChance) {
      this.result = 'fled';
      this.addLog(`You escape! But drop some supplies in your haste.`);

      // Lose 1 random item
      const items = [...p.inventory.keys()];
      if (items.length > 0) {
        const lostItem = items[Math.floor(Math.random() * items.length)];
        p.removeItem({ name: lostItem });
        this.addLog(`Lost 1 ${lostItem}.`);
      }

      this.resolveCombat();
    } else {
      const raiderType = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];
      this.addLog(`${raiderType.name} catches you!`);
      const raiderRoll = Math.floor(Math.random() * 6) + 1 + this.raider.strength;
      const dmg = Math.max(1, raiderRoll - 3);
      this.playerHP -= dmg;
      this.addLog(`${raiderType.name} strikes for ${dmg} damage! Your HP: ${Math.max(0, this.playerHP)}`);

      if (this.playerHP <= 0) {
        this.result = 'lose';
        this.addLog(`You collapse from the blow.`);
        this.resolveCombat();
      }
    }
  }

  // Calculate bribe cost (deterministic per combat, cached)
  getBribeCost() {
    if (this._cachedBribeCost != null) return this._cachedBribeCost;
    const raiderType = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];
    if (raiderType.monster) return -1; // cannot bribe
    let cost = this.raider.strength * (15 + Math.floor(Math.random() * 15));
    if (raiderType.special === 'command') cost = Math.floor(cost * 1.5);
    // Difficulty bribe multiplier
    const bribeMul = window.DIFFICULTY_CONFIG?.bribeCostMultiplier || 1;
    cost = Math.floor(cost * bribeMul);
    // Conflict Resolution book reduces bribe cost
    if (typeof player !== 'undefined' && player.modifiers?.bribeCostReduction > 0) {
      cost = Math.floor(cost * (1 - player.modifiers.bribeCostReduction));
    }
    this._cachedBribeCost = cost;
    return cost;
  }

  // Player chooses to bribe (confirmed = true to actually pay)
  doBribe(confirmed) {
    const raiderType = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];

    // Monsters cannot be bribed
    if (raiderType.monster) {
      this.addLog(`The ${raiderType.name} cannot be reasoned with!`);
      const raiderRoll = Math.floor(Math.random() * 6) + 1 + this.raider.strength;
      const dmg = Math.max(1, raiderRoll - 2);
      this.playerHP -= dmg;
      this.addLog(`${raiderType.name} strikes for ${dmg} damage! Your HP: ${Math.max(0, this.playerHP)}`);
      if (this.playerHP <= 0) {
        this.result = 'lose';
        this.addLog(`You collapse from the blow.`);
        this.resolveCombat();
      }
      return;
    }

    const cost = this.getBribeCost();

    if (!confirmed) {
      // Preview only — UI will show confirm/cancel
      return;
    }

    if (raiderType.special === 'command') {
      this.addLog(`The Raider Captain demands a premium for safe passage!`);
    }
    this.addLog(`The ${raiderType.name} demands ${cost} gold for safe passage.`);

    if (player.gold >= cost) {
      player.spendGold(cost);
      this.result = 'bribed';
      this.addLog(`You pay ${cost} gold. The raiders let you pass.`);
      this.resolveCombat();
    } else {
      this.addLog(`You don't have enough gold! They attack!`);
      const raiderRoll = Math.floor(Math.random() * 6) + 1 + this.raider.strength;
      const dmg = Math.max(1, raiderRoll - 2);
      this.playerHP -= dmg;
      this.addLog(`${raiderType.name} strikes for ${dmg} damage! Your HP: ${Math.max(0, this.playerHP)}`);
      if (this.playerHP <= 0) {
        this.result = 'lose';
        this.resolveCombat();
      }
    }
  }

  // ─── Status effect helpers ──────────────────────────────────

  /** Apply a status effect to the player */
  _applyStatusToPlayer(type) {
    const def = STATUS_EFFECTS[type];
    if (!def) return;
    if (!def.stackable) {
      // Refresh duration if already exists
      const existing = this.playerStatusEffects.find(e => e.type === type);
      if (existing) { existing.remainingTurns = def.duration; return; }
    } else {
      // Cap stackable effects at 3 stacks
      const stacks = this.playerStatusEffects.filter(e => e.type === type).length;
      if (stacks >= 3) return;
    }
    this.playerStatusEffects.push({
      type,
      remainingTurns: def.duration,
      dmgPerTurn: def.dmgPerTurn,
    });
  }

  /** Apply a status effect to the raider */
  _applyStatusToRaider(type) {
    const def = STATUS_EFFECTS[type];
    if (!def) return;
    if (!def.stackable) {
      const existing = this.raiderStatusEffects.find(e => e.type === type);
      if (existing) { existing.remainingTurns = def.duration; return; }
    }
    this.raiderStatusEffects.push({
      type,
      remainingTurns: def.duration,
      dmgPerTurn: def.dmgPerTurn,
    });
  }

  /** Check if a status effect is active */
  _hasStatusEffect(effectsArray, type) {
    return effectsArray.some(e => e.type === type && e.remainingTurns > 0);
  }

  /** Apply all status effects at the start of a round. Returns { playerStunned } */
  _applyStatusEffects() {
    let playerStunned = false;
    const raiderType = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];

    // Player status effects
    for (let i = this.playerStatusEffects.length - 1; i >= 0; i--) {
      const effect = this.playerStatusEffects[i];
      const def = STATUS_EFFECTS[effect.type];
      if (!def) { this.playerStatusEffects.splice(i, 1); continue; }

      if (effect.type === 'stun') {
        playerStunned = true;
      }
      if (effect.dmgPerTurn > 0) {
        this.playerHP -= effect.dmgPerTurn;
        this.addLog(`${def.icon} ${def.name} deals ${effect.dmgPerTurn} damage! (HP: ${Math.max(0, this.playerHP)})`);
        try { this._emit('hpChanged'); } catch (e) {}
        try {
          const intensity = (localStorage.getItem('pref_combat_effects_intensity') || 'medium');
          const scaleMap = { subtle: 0.7, medium: 1.0, heavy: 1.4 };
          const scale = scaleMap[intensity] || 1.0;
          if (localStorage.getItem('pref_combat_effects') !== 'false' && typeof particleSystem !== 'undefined') {
            const el = document.getElementById('playerHpBar');
            const canvasEl = document.querySelector('canvas');
            if (el && canvasEl) {
              const r = el.getBoundingClientRect();
              const cvsRect = canvasEl.getBoundingClientRect();
              const xCss = (r.left - cvsRect.left) + r.width/2;
              const yCss = (r.top - cvsRect.top) + r.height/2;
              const pixelScale = (canvasEl && canvasEl.width && cvsRect.width) ? (canvasEl.width / cvsRect.width) : 1;
              particleSystem.spawnBurst(xCss * pixelScale, yCss * pixelScale, { count: Math.round(10 * scale), color: '#ff8a65', size: Math.round(5 * scale), speed: 100 * scale, frame: null, screen: true });
            }
          }
          if (typeof _showDmgSplash === 'function') _showDmgSplash('playerHpBar', effect.dmgPerTurn);
        } catch (e) { console.error('status effect player dmg effect error:', e); }
      }
      effect.remainingTurns--;
      if (effect.remainingTurns <= 0) {
        this.addLog(`${def.icon} ${def.name} wears off.`);
        this.playerStatusEffects.splice(i, 1);
      }
    }

    // Raider status effects
    let raiderStunned = false;
    for (let i = this.raiderStatusEffects.length - 1; i >= 0; i--) {
      const effect = this.raiderStatusEffects[i];
      const def = STATUS_EFFECTS[effect.type];
      if (!def) { this.raiderStatusEffects.splice(i, 1); continue; }

      if (effect.type === 'stun') {
        raiderStunned = true;
      }
      if (effect.dmgPerTurn > 0) {
        this.raiderHP -= effect.dmgPerTurn;
        this.addLog(`${def.icon} ${raiderType.name} takes ${effect.dmgPerTurn} ${def.name.toLowerCase()} damage! (HP: ${Math.max(0, this.raiderHP)})`);
        try { this._emit('hpChanged'); } catch (e) {}
        try {
          const intensity = (localStorage.getItem('pref_combat_effects_intensity') || 'medium');
          const scaleMap = { subtle: 0.7, medium: 1.0, heavy: 1.4 };
          const scale = scaleMap[intensity] || 1.0;
          if (localStorage.getItem('pref_combat_effects') !== 'false' && typeof particleSystem !== 'undefined') {
            const el = document.getElementById('enemyHpBar');
            const canvasEl = document.querySelector('canvas');
            if (el && canvasEl) {
              const r = el.getBoundingClientRect();
              const cvsRect = canvasEl.getBoundingClientRect();
              const xCss = (r.left - cvsRect.left) + r.width/2;
              const yCss = (r.top - cvsRect.top) + r.height/2;
              const pixelScale = (canvasEl && canvasEl.width && cvsRect.width) ? (canvasEl.width / cvsRect.width) : 1;
              particleSystem.spawnBurst(xCss * pixelScale, yCss * pixelScale, { count: Math.round(10 * scale), color: '#ffd54f', size: Math.round(5 * scale), speed: 100 * scale, frame: null, screen: true });
            }
          }
          if (typeof _showDmgSplash === 'function') _showDmgSplash('enemyHpBar', effect.dmgPerTurn);
        } catch (e) { console.error('status effect raider dmg effect error:', e); }
      }
      effect.remainingTurns--;
      if (effect.remainingTurns <= 0) {
        if (effect.type === 'stun') this.addLog(`💫 ${raiderType.name} shakes off the stun.`);
        this.raiderStatusEffects.splice(i, 1);
      }
    }

    return { playerStunned, raiderStunned };
  }

  /** Get active player status effect summary for UI */
  getPlayerStatusSummary() {
    return this.playerStatusEffects.map(e => {
      const def = STATUS_EFFECTS[e.type];
      return { type: e.type, name: def?.name || e.type, icon: def?.icon || '?', turns: e.remainingTurns };
    });
  }

  /** Get active raider status effect summary for UI */
  getRaiderStatusSummary() {
    return this.raiderStatusEffects.map(e => {
      const def = STATUS_EFFECTS[e.type];
      return { type: e.type, name: def?.name || e.type, icon: def?.icon || '?', turns: e.remainingTurns };
    });
  }

  // ─── Naval combat helpers ───────────────────────────────────

  /** Initialise NxN grids and place ships */
  _collectPlayerEscorts() {
    const fleet = Array.isArray(player?.fleet) ? player.fleet : [];
    const escorts = [];
    this.playerUncrewedSupport = 0;
    for (const boat of fleet) {
      if (!boat || boat === player.activeBoat) continue;
      if (!boat.captain) {
        this.playerUncrewedSupport++;
        continue;
      }
      const maxHP = Math.max(1, Math.ceil(boat.getEffectiveHP() * 0.8));
      escorts.push({
        boat,
        captain: boat.captain,
        hp: maxHP,
        maxHP,
        alive: true,
      });
      if (escorts.length >= 4) break;
    }
    return escorts;
  }

  _getEnemyFleetSize() {
    const day = (typeof dayNight !== 'undefined' && dayNight.getDaysElapsed) ? dayNight.getDaysElapsed() : 0;
    const diff = window._newGameDifficulty || 'normal';
    const startByDiff = { easy: 12, normal: 10, hard: 8, hardcore: 6 };
    const threshold = startByDiff[diff] ?? 10;
    if (day < threshold) return 1;
    const progress = Math.min(1, (day - threshold) / 25);
    const baseChance = { easy: 0.12, normal: 0.20, hard: 0.32, hardcore: 0.40 }[diff] ?? 0.20;
    let ships = 1;
    if (Math.random() < baseChance + progress * 0.25) ships++;
    if (Math.random() < baseChance * 0.4 + progress * 0.18) ships++;
    return Math.min(3, ships);
  }

  _alliedEscortVolley() {
    if (!this.playerEscortFleet.length || this.result) return;
    let hitCount = 0;
    let totalDamage = 0;
    for (const escort of this.playerEscortFleet) {
      if (!escort.alive || escort.hp <= 0) continue;
      const cap = escort.captain || {};
      const acc = Math.max(0.15, Math.min(0.95, cap.accuracy || 0.4));
      if (Math.random() > acc) continue;
      const atk = (BoatLibrary[escort.boat.type]?.attack || 1);
      const dmg = Math.max(1, Math.round(atk * (1 + (acc - 0.4))));
      this.raiderHP = Math.max(0, this.raiderHP - dmg);
      totalDamage += dmg;
      hitCount++;
    }
    if (hitCount > 0) {
      this.addLog(`🧭 Captains' volley lands ${hitCount} hit${hitCount > 1 ? 's' : ''} for ${totalDamage} damage.`);
      this._emit('hpChanged');
    }
  }

  _aliveEscorts() {
    return this.playerEscortFleet.filter(e => e.alive && e.hp > 0);
  }

  _enemyEscortVolley(baseEnemyAttack = 1) {
    const supportShots = Math.max(0, this.enemyFleetShips - 1);
    if (supportShots <= 0 || this.result) return;
    for (let i = 0; i < supportShots; i++) {
      const escorts = this._aliveEscorts();
      const shootEscort = escorts.length > 0 && Math.random() < 0.65;
      if (shootEscort) {
        const target = escorts[Math.floor(Math.random() * escorts.length)];
        const evade = Math.max(0, Math.min(0.85, target.captain?.evasion || 0.1));
        if (Math.random() < evade) {
          this.addLog(`💨 ${target.captain?.name || 'Escort captain'} evades incoming fire.`);
          continue;
        }
        const dmg = Math.max(1, Math.round(baseEnemyAttack * 0.8));
        target.hp = Math.max(0, target.hp - dmg);
        if (target.hp <= 0) {
          target.alive = false;
          this.addLog(`💥 Escort "${target.boat.name}" is disabled!`);
        } else {
          this.addLog(`🎯 Escort "${target.boat.name}" takes ${dmg} damage.`);
        }
        continue;
      }

      const dmg = Math.max(1, Math.round(baseEnemyAttack * 0.7));
      this.playerHP = Math.max(0, this.playerHP - dmg);
      this.addLog(`💣 Pirate escort fire hits your flagship for ${dmg} damage! (${this.playerHP} HP left)`);
      this._emit('hpChanged');
      if (this.playerHP <= 0) break;
    }
  }

  _applyEscortBattleWear() {
    if (!Array.isArray(this.playerEscortFleet) || this.playerEscortFleet.length === 0) return;
    for (const escort of this.playerEscortFleet) {
      if (!escort.boat) continue;
      const hpLossRatio = 1 - (escort.hp / Math.max(1, escort.maxHP));
      let condDmg = Math.round(hpLossRatio * 28);
      if (!escort.alive || escort.hp <= 0) condDmg += 18;
      if (condDmg > 0) escort.boat.applyDamage(condDmg);
      if (escort.boat.condition <= 0) {
        const idx = player.fleet.indexOf(escort.boat);
        if (idx >= 0) player.fleet.splice(idx, 1);
        this.addLog(`💀 Escort "${escort.boat.name}" sinks during the battle.`);
      }
    }
  }

  _initNavalGrids(playerSize, enemySize) {
    this.playerGrid = Array.from({ length: NAVAL_GRID_SIZE }, () => Array(NAVAL_GRID_SIZE).fill(null));
    this.enemyGrid  = Array.from({ length: NAVAL_GRID_SIZE }, () => Array(NAVAL_GRID_SIZE).fill(null));

    // Player ship — movable, starts centered
    this.playerShipHorizontal = (playerSize <= NAVAL_GRID_SIZE);
    const pStartC = Math.max(0, Math.floor((NAVAL_GRID_SIZE - (this.playerShipHorizontal ? playerSize : 1)) / 2));
    const pStartR = Math.max(0, Math.floor((NAVAL_GRID_SIZE - (this.playerShipHorizontal ? 1 : playerSize)) / 2));
    this.playerShipPos = { r: pStartR, c: pStartC };

    // Enemy ship — movable, starts at random valid position
    this.enemyShipHorizontal = Math.random() < 0.5;
    const eMaxC = NAVAL_GRID_SIZE - (this.enemyShipHorizontal ? enemySize : 1);
    const eMaxR = NAVAL_GRID_SIZE - (this.enemyShipHorizontal ? 1 : enemySize);
    this.enemyShipPos = {
      r: Math.floor(Math.random() * (eMaxR + 1)),
      c: Math.floor(Math.random() * (eMaxC + 1))
    };

    this.enemyTargetCell = null;
    this._generateEnvironment();
  }

  /** Get current player ship cells based on movable position */
  getPlayerShipCells() {
    if (!this.playerShipPos) return [];
    const size = (BoatLibrary[this.playerBoatType] || BoatLibrary.rowboat).gridSize;
    const cells = [];
    for (let i = 0; i < size; i++) {
      if (this.playerShipHorizontal) {
        cells.push({ r: this.playerShipPos.r, c: this.playerShipPos.c + i });
      } else {
        cells.push({ r: this.playerShipPos.r + i, c: this.playerShipPos.c });
      }
    }
    return cells;
  }

  /** Move player ship in a direction. Returns true if moved. */
  movePlayerShip(direction) {
    if (this.result || !this.isNavalCombat || !this.playerShipPos) return false;
    const size = (BoatLibrary[this.playerBoatType] || BoatLibrary.rowboat).gridSize;
    let { r, c } = this.playerShipPos;

    if (direction === 'up') r--;
    else if (direction === 'down') r++;
    else if (direction === 'left') c--;
    else if (direction === 'right') c++;
    else return false;

    // Boundary check
    if (this.playerShipHorizontal) {
      if (r < 0 || r >= NAVAL_GRID_SIZE) return false;
      if (c < 0 || c + size > NAVAL_GRID_SIZE) return false;
    } else {
      if (c < 0 || c >= NAVAL_GRID_SIZE) return false;
      if (r < 0 || r + size > NAVAL_GRID_SIZE) return false;
    }

    // Block movement into island cells
    const newCells = this._computeShipCells(r, c, this.playerShipHorizontal,
      (BoatLibrary[this.playerBoatType] || BoatLibrary.rowboat).gridSize);
    const blocked = newCells.some(cell =>
      this.environmentCells.some(e => e.type === 'island' && e.r === cell.r && e.c === cell.c)
    );
    if (blocked) {
      this.addLog(`⛰️ Island blocks your path!`);
      return false;
    }

    this.playerShipPos = { r, c };
    const arrows = { up: '⬆', down: '⬇', left: '⬅', right: '➡' };
    this.addLog(`${arrows[direction] || '↗'} Ship repositioned!`);
    this._emit('gridUpdated');
    return true;
  }

  /** Get current enemy ship cells based on movable position */
  getEnemyShipCells() {
    if (!this.enemyShipPos) return [];
    const size = (BoatLibrary[this.enemyBoatType] || BoatLibrary.rowboat).gridSize;
    const cells = [];
    for (let i = 0; i < size; i++) {
      if (this.enemyShipHorizontal) {
        cells.push({ r: this.enemyShipPos.r, c: this.enemyShipPos.c + i });
      } else {
        cells.push({ r: this.enemyShipPos.r + i, c: this.enemyShipPos.c });
      }
    }
    return cells;
  }

  /** Enemy AI moves its ship to a random adjacent valid position.
   *  Only clears hit cells (misses stay — ship moved away from them). */
  _moveEnemyShip() {
    if (!this.enemyShipPos) return;
    const size = (BoatLibrary[this.enemyBoatType] || BoatLibrary.rowboat).gridSize;
    const dirs = ['up', 'down', 'left', 'right'];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    for (const d of dirs) {
      let { r, c } = this.enemyShipPos;
      if (d === 'up') r--;
      else if (d === 'down') r++;
      else if (d === 'left') c--;
      else if (d === 'right') c++;

      if (this.enemyShipHorizontal) {
        if (r < 0 || r >= NAVAL_GRID_SIZE || c < 0 || c + size > NAVAL_GRID_SIZE) continue;
      } else {
        if (c < 0 || c >= NAVAL_GRID_SIZE || r < 0 || r + size > NAVAL_GRID_SIZE) continue;
      }
      this.enemyShipPos = { r, c };
      // Clear entire enemy grid — ship moved, all old shot info is stale
      for (let gr = 0; gr < NAVAL_GRID_SIZE; gr++)
        for (let gc = 0; gc < NAVAL_GRID_SIZE; gc++)
          this.enemyGrid[gr][gc] = null;
      this.addLog(`🏴‍☠️ Enemy ship maneuvers! Grid reset.`);
      this._emit('gridUpdated');
      return;
    }
  }

  /** Get enemy maneuver chance based on boat type + AI behavior */
  _getEnemyManeuverChance() {
    const base = { rowboat: 0.7, sloop: 0.5, galleon: 0.3 }[this.enemyBoatType] || 0.5;
    const mods = { aggressive: -0.15, evasive: +0.30, flanker: 0 };
    return Math.min(1, base + (mods[this.enemyBehavior] || 0));
  }

  /** AI picks next target cell — accuracy scales with enemy boat type + behavior */
  _pickEnemyTarget(aimPenalty = 0) {
    const shipCells = this.getPlayerShipCells();
    const smartChance = { rowboat: 0.15, sloop: 0.25, galleon: 0.35 };
    const behaviorMods = { aggressive: +0.20, evasive: -0.10, flanker: +0.10 };
    const chance = Math.max(0, (smartChance[this.enemyBoatType] || 0.2)
      + (behaviorMods[this.enemyBehavior] || 0) - aimPenalty);
    if (shipCells.length > 0 && Math.random() < chance) {
      const t = shipCells[Math.floor(Math.random() * shipCells.length)];
      return { r: t.r, c: t.c };
    }
    // Prefer cells not yet fired at
    const unfired = [];
    for (let r = 0; r < NAVAL_GRID_SIZE; r++)
      for (let c = 0; c < NAVAL_GRID_SIZE; c++)
        if (this.playerGrid[r][c] === null) unfired.push({ r, c });
    if (unfired.length > 0) return unfired[Math.floor(Math.random() * unfired.length)];
    return { r: Math.floor(Math.random() * NAVAL_GRID_SIZE), c: Math.floor(Math.random() * NAVAL_GRID_SIZE) };
  }

  /** Player fires at (row,col) on enemy grid. Returns { hit, nearMiss, alreadyFired, resolved } */
  playerNavalFire(row, col) {
    if (this.result) return { hit: false, resolved: true };
    if (!this.isNavalCombat) return { hit: false, resolved: false };
    if (this.enemyGrid[row][col] !== null) return { hit: false, alreadyFired: true };

    this.navalRound++;
    const pBoat = BoatLibrary[this.playerBoatType] || BoatLibrary.rowboat;
    const enemyCells = this.getEnemyShipCells();
    const isHit = enemyCells.some(c => c.r === row && c.c === col);
    this.enemyGrid[row][col] = isHit ? 'hit' : 'miss';
    this._emit('gridUpdated');

    let nearMiss = false;
    if (isHit) {
      const dmg = pBoat.attack;
      this.raiderHP = Math.max(0, this.raiderHP - dmg);
      this.addLog(`💥 Direct hit! ${dmg} damage! (${this.raiderHP} HP left)`);
      this._emit('hpChanged');
    } else {
      nearMiss = enemyCells.some(c => Math.abs(c.r - row) <= 1 && Math.abs(c.c - col) <= 1);
      if (nearMiss) {
        this.addLog(`💨 Close! Your shot just missed!`);
      } else {
        this.addLog(`🌊 Splash! Nothing but open water.`);
      }
    }

    // AI captains fire their own shots after the player's action.
    this._alliedEscortVolley();

    if (this.raiderHP <= 0) {
      this.result = 'win';
      this.addLog(`🏆 The pirate ship sinks! Victory!`);
      this.resolveCombat();
      this._emit('combatEnd', { result: 'win', loot: this.raider?.loot });
      return { hit: isHit, resolved: true };
    }
    return { hit: isHit, nearMiss, resolved: false };
  }

  /** Telegraph: pick and show upcoming enemy target. Returns the target cell. */
  telegraphEnemyTarget() {
    if (this.result || !this.isNavalCombat) return null;
    this.enemyTargetCell = this._pickEnemyTarget();
    this.addLog(`🎯 Enemy taking aim...`);
    this._emit('gridUpdated');
    return this.enemyTargetCell;
  }

  /** Enemy AI fires at the telegraphed target. Returns { row, col, hit, resolved } or null */
  enemyNavalFire() {
    if (this.result || !this.isNavalCombat) return null;
    const eBoat = BoatLibrary[this.enemyBoatType] || BoatLibrary.rowboat;

    // Flanker moves before firing
    if (this.enemyBehavior === 'flanker') this._moveEnemyShip();

    // Chain Shot effect — suppress maneuver and reduce aim accuracy
    let overrideManeuver = false;
    let aimPenalty = 0;
    if (this._activeEffects.chainShot) {
      overrideManeuver = true;
      aimPenalty = 0.25;
      this._activeEffects.chainShot = false;
      this.addLog(`⛓️ Chain shot slows the enemy — aim disrupted!`);
    }

    // Smoke Screen — 50% flat miss chance
    if (this._activeEffects.smokeScreen && Math.random() < 0.5) {
      this._activeEffects.smokeScreen = false;
      const target = this.enemyTargetCell || this._pickEnemyTarget(aimPenalty);
      this.enemyTargetCell = null;
      this.playerGrid[target.r][target.c] = 'miss';
      this.addLog(`💨 Enemy shot lost in the smoke — miss!`);
      this._tickAbilityCooldowns();
      this._tickBehavior();
      this._emit('gridUpdated');
      this._emit('hpChanged');
      return { row: target.r, col: target.c, hit: false, resolved: false };
    }
    this._activeEffects.smokeScreen = false;

    // Fire at telegraphed cell (fallback to fresh pick with aim penalty)
    const target = this.enemyTargetCell || this._pickEnemyTarget(aimPenalty);
    this.enemyTargetCell = null;
    const shipCells = this.getPlayerShipCells();
    const isHit = shipCells.some(c => c.r === target.r && c.c === target.c);

    this.playerGrid[target.r][target.c] = isHit ? 'hit' : 'miss';

    if (isHit) {
      const dmg = eBoat.attack;
      this.playerHP = Math.max(0, this.playerHP - dmg);
      this.addLog(`💣 Enemy hits your ship! ${dmg} damage! (${this.playerHP} HP left)`);
      this._emit('hpChanged');
      // Visual/sound effects for player being hit
      try {
        const intensity = (localStorage.getItem('pref_combat_effects_intensity') || 'medium');
        const scaleMap = { subtle: 0.7, medium: 1.0, heavy: 1.4 };
        const scale = scaleMap[intensity] || 1.0;
        if (localStorage.getItem('pref_combat_effects') !== 'false' && typeof particleSystem !== 'undefined') {
          const el = document.getElementById('playerHpBar');
          const canvasEl = document.querySelector('canvas');
          if (el && canvasEl) {
            const r = el.getBoundingClientRect();
            const cvsRect = canvasEl.getBoundingClientRect();
            const xCss = (r.left - cvsRect.left) + r.width/2;
            const yCss = (r.top - cvsRect.top) + r.height/2;
            const pixelScale = (canvasEl && canvasEl.width && cvsRect.width) ? (canvasEl.width / cvsRect.width) : 1;
            particleSystem.spawnBurst(xCss * pixelScale, yCss * pixelScale, { count: Math.round(22 * scale), color: '#ff5252', size: Math.round(6 * scale), speed: 160 * scale, frame: null, screen: true });
          }
        }
        if (typeof _showDmgSplash === 'function') _showDmgSplash('playerHpBar', dmg);
        if (typeof startCameraShake === 'function') startCameraShake(8 * scale, 300);
      } catch (e) { console.error('combat enemy hit effect error:', e); }
    } else {
      this.addLog(`🌊 Enemy cannonball misses!`);
    }
    this._emit('gridUpdated');

    if (this.playerHP <= 0) {
      this.result = 'lose';
      this.addLog(`🚢 Your ship is sinking! Defeat.`);
      this.resolveCombat();
      this._emit('combatEnd', { result: 'lose' });
      return { row: target.r, col: target.c, hit: isHit, resolved: true };
    }

    // Enemy maneuvers after firing (suppressed by chain shot)
    if (!overrideManeuver && Math.random() < this._getEnemyManeuverChance()) this._moveEnemyShip();

    // Storm damage — player ship on a storm cell takes 1 HP
    const stormCells = this.environmentCells.filter(e => e.type === 'storm');
    for (const sc of stormCells) {
      if (shipCells.some(s => s.r === sc.r && s.c === sc.c)) {
        this.playerHP = Math.max(0, this.playerHP - 1);
        this.addLog(`⛈️ Storm cell hits your hull! −1 HP (${this.playerHP} left)`);
        this._emit('hpChanged');
        if (this.playerHP <= 0) {
          this.result = 'lose';
          this.addLog(`🚢 Your ship is sinking! Defeat.`);
          this.resolveCombat();
          this._emit('combatEnd', { result: 'lose' });
          this._tickAbilityCooldowns();
          return { row: target.r, col: target.c, hit: isHit, resolved: true };
        }
      }
    }

    // Additional pirates in fleet fire supporting volleys.
    this._enemyEscortVolley(eBoat.attack || 1);
    if (this.playerHP <= 0) {
      this.result = 'lose';
      this.addLog(`🚢 Your ship is sinking! Defeat.`);
      this.resolveCombat();
      this._emit('combatEnd', { result: 'lose' });
      this._tickAbilityCooldowns();
      return { row: target.r, col: target.c, hit: isHit, resolved: true };
    }

    this._tickAbilityCooldowns();
    this._tickBehavior();
    return { row: target.r, col: target.c, hit: isHit, resolved: false };
  }

  // ─── Phase engine ────────────────────────────────────────────

  _startNavalPhaseEngine() {
    this.navalPhase = 'player_aim';
    this._emit('phaseStart', { phase: 'player_aim' });
    const cycle = () => {
      if (this.result) return;
      this._navalTelegraphTimeout = setTimeout(() => {
        if (this.result) return;
        this.navalPhase = 'telegraph';
        this.telegraphEnemyTarget();
        this._emit('phaseStart', { phase: 'telegraph' });
        this._navalFireTimeout = setTimeout(() => {
          if (this.result) return;
          this.navalPhase = 'enemy_fire';
          this._emit('phaseStart', { phase: 'enemy_fire' });
          const r = this.enemyNavalFire();
          if (r?.resolved) return;
          this.navalPhase = 'player_aim';
          this._emit('phaseStart', { phase: 'player_aim' });
          cycle();
        }, NAVAL_TELEGRAPH_MS);
      }, NAVAL_TICK_MS - NAVAL_TELEGRAPH_MS);
    };
    cycle();
  }

  _stopNavalPhaseEngine() {
    clearTimeout(this._navalTelegraphTimeout);
    clearTimeout(this._navalFireTimeout);
    this._navalTelegraphTimeout = null;
    this._navalFireTimeout = null;
    this.navalPhase = null;
  }

  // ─── Special abilities ───────────────────────────────────────

  useChainShot() {
    if (this._abilityCooldowns.chainShot > 0 || this.result) return false;
    this._activeEffects.chainShot = true;
    this._abilityCooldowns.chainShot = 3;
    this.addLog(`⛓️ Chain Shot loaded — enemy maneuver and aim disrupted next turn!`);
    this._emit('gridUpdated');
    return true;
  }

  useSmokeScreen() {
    if (this._abilityCooldowns.smokeScreen > 0 || this.result) return false;
    this._activeEffects.smokeScreen = true;
    this._abilityCooldowns.smokeScreen = 4;
    this.addLog(`💨 Smoke Screen deployed — 50% miss chance on incoming fire!`);
    this._emit('gridUpdated');
    return true;
  }

  useRepair() {
    if (this._abilityCooldowns.repair > 0 || this.result) return false;
    this.playerHP = Math.min(this._initPlayerHP, this.playerHP + 1);
    this._abilityCooldowns.repair = 5;
    this.addLog(`🔧 Emergency repair — restored 1 hull HP! (${this.playerHP} HP)`);
    this._emit('hpChanged');
    return true;
  }

  _tickAbilityCooldowns() {
    for (const k of Object.keys(this._abilityCooldowns)) {
      if (this._abilityCooldowns[k] > 0) this._abilityCooldowns[k]--;
    }
  }

  // ─── AI behavior states ──────────────────────────────────────

  _tickBehavior() {
    this._behaviorRoundsLeft--;
    if (this._behaviorRoundsLeft > 0) return;
    const behaviors = ['aggressive', 'evasive', 'flanker'];
    const next = behaviors.filter(b => b !== this.enemyBehavior);
    this.enemyBehavior = next[Math.floor(Math.random() * next.length)];
    this._behaviorRoundsLeft = 2 + Math.floor(Math.random() * 4);
    const labels = { aggressive: '🔴 Aggressive', evasive: '🔵 Evasive', flanker: '🟡 Flanking' };
    this.addLog(`⚓ Enemy shifts to ${labels[this.enemyBehavior]} stance!`);
    this._emit('behaviorChanged', { behavior: this.enemyBehavior });
  }

  // ─── Environmental effects ───────────────────────────────────

  /** Returns ship cells for any anchor position (shared by player + island-check) */
  _computeShipCells(r, c, horizontal, size) {
    const cells = [];
    for (let i = 0; i < size; i++) {
      cells.push(horizontal ? { r, c: c + i } : { r: r + i, c });
    }
    return cells;
  }

  _generateEnvironment() {
    this.environmentCells = [];
    const occupied = new Set(this.getPlayerShipCells().map(c => `${c.r},${c.c}`));

    const tryPlace = (type) => {
      for (let attempts = 0; attempts < 20; attempts++) {
        const r = Math.floor(Math.random() * NAVAL_GRID_SIZE);
        const c = Math.floor(Math.random() * NAVAL_GRID_SIZE);
        if (!occupied.has(`${r},${c}`)) {
          this.environmentCells.push({ r, c, type });
          occupied.add(`${r},${c}`);
          return true;
        }
      }
      return false;
    };

    if (Math.random() < 0.25) tryPlace('storm');
    if (Math.random() < 0.20) tryPlace('island');
    if (Math.random() < 0.15) tryPlace('island');

    if (this.environmentCells.length > 0) {
      const descs = this.environmentCells.map(e => e.type === 'island' ? '⛰️ island' : '⛈️ storm zone');
      this.addLog(`Environment: ${descs.join(', ')} on the battlefield!`);
    }
  }

  /** Attempt to flee naval combat. Returns true if escaped. */
  attemptNavalFlee() {
    if (this.result || !this.isNavalCombat) return false;
    const pBoat = BoatLibrary[this.playerBoatType] || BoatLibrary.rowboat;
    const eBoat = BoatLibrary[this.enemyBoatType] || BoatLibrary.rowboat;
    // Compare speeds — lower ms = faster
    const speedRatio = eBoat.speed / pBoat.speed; // >1 means player is faster
    const fleeChance = Math.min(0.75, 0.15 + speedRatio * 0.2);
    if (Math.random() < fleeChance) {
      this.result = 'fled';
      this.addLog(`🏃 You escape into the fog! The pirates lose sight of you.`);
      this.resolveCombat();
      return true;
    } else {
      this.addLog(`🏴‍☠️ The pirates cut off your escape! Keep fighting!`);
      return false;
    }
  }

  resolveCombat() {
    const p = this._getPlayerRef();
    const allCities = this._getCitiesRef();
    if (!p) return;
    const raiderType = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];
    if (this.isNavalCombat) this._applyEscortBattleWear();

    if (this.result === 'win') {
      const lootGold = this.raider.loot.gold;
      p.earnGold(lootGold);
      this.addLog(`Looted ${lootGold} gold!`);

      // XP reward scales with raider strength
      const xpGain = Math.max(5, this.raider.strength * 12);
      if (p.gainXP) {
        p.gainXP(xpGain);
        this.addLog(`Gained ${xpGain} XP!`);
      }

      const lootedWeapons = [];
      for (const lootItem of this.raider.loot.items) {
        const displayName = ItemLibrary[lootItem.name]?.name || lootItem.name;
        const added = p.addItem({ name: lootItem.name, quantity: lootItem.quantity });
        if (added) {
          this.addLog(`Found ${lootItem.quantity}x ${displayName}!`);
          if (lootItem.quantity > 0 && lootItem.name !== 'Fists' && WEAPONS[lootItem.name]) {
            lootedWeapons.push(lootItem.name);
          }
        } else {
          const base = ItemLibrary[lootItem.name]?.baseValue || 10;
          const salvageGold = Math.max(1, Math.floor(base * 0.6 * (lootItem.quantity || 1)));
          p.earnGold(salvageGold);
          this.addLog(`Cargo full: converted ${lootItem.quantity}x ${displayName} into ${salvageGold}g salvage.`);
        }
      }

      if (lootedWeapons.length > 0 && typeof notificationManager !== 'undefined') {
        lootedWeapons.sort((a, b) => {
          const wa = WEAPONS[a] || WEAPONS.Fists;
          const wb = WEAPONS[b] || WEAPONS.Fists;
          if ((wb.damage || 0) !== (wa.damage || 0)) return (wb.damage || 0) - (wa.damage || 0);
          return (wb.crit || 0) - (wa.crit || 0);
        });
        const bestWeapon = lootedWeapons[0];
        notificationManager.log(
          `⚔️ Found new weapon: ${bestWeapon}`,
          "info",
          10000,
          {
            label: `Equip ${bestWeapon}`,
            onClick: () => {
              const ok = p.equipWeapon(bestWeapon);
              if (ok) notificationManager.log(`Equipped ${bestWeapon}.`, "success");
              else notificationManager.log(`Couldn't equip ${bestWeapon}.`, "warning");
            },
          }
        );
      }

      this.raider.state = 'defeated';

      // Bounty board check — reward for defeating named raiders
      if (typeof bountyBoard !== 'undefined' && bountyBoard && this.raider) {
        bountyBoard.onRaiderDefeated(this.raider);
      }

      // Treasure fragment drop (15% chance)
      if (typeof treasureSystem !== 'undefined' && treasureSystem && Math.random() < 0.15) {
        const regions = ['northern', 'southern', 'eastern', 'western', 'central'];
        const region = regions[Math.floor(Math.random() * regions.length)];
        treasureSystem.addFragment(region);
        this.addLog(`Found a treasure map fragment (${region})!`);
      }

      // Reputation boost for cities within 8 tiles of the defeated raider
      if (allCities && this.raider) {
        for (let ci = 0; ci < allCities.length; ci++) {
          const loc = allCities[ci].location;
          const dist = Math.abs(this.raider.x - loc.x) + Math.abs(this.raider.y - loc.y);
          if (dist <= 8 && allCities[ci].adjustReputation) {
            allCities[ci].adjustReputation(3);
          }
        }
      }

      // Apply hull damage from combat (naval)
      if (this.isNavalCombat && p.activeBoat && this._initPlayerHP > 0) {
        const hpRatio = 1 - (this.playerHP / this._initPlayerHP);
        const winHullMul = window.DIFFICULTY_CONFIG?.hullDamageMultiplier || 1;
        const condDmg = Math.round(hpRatio * 40 * winHullMul); // up to 40 pts * difficulty
        if (condDmg > 0) {
          p.activeBoat.applyDamage(condDmg);
          this.addLog(`🔧 Hull took ${condDmg} wear (${p.activeBoat.condition}% condition).`);
        }
        this._checkBoatSinking();
      }

      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Victory! Looted ${lootGold} gold.`, "success");
      }
    } else if (this.result === 'lose') {
      const dc = window.DIFFICULTY_CONFIG;
      const lossRange = dc?.combatLossGoldPercent || [0.10, 0.30];
      const goldLost = Math.min(p.gold, Math.floor(p.gold * (lossRange[0] + Math.random() * (lossRange[1] - lossRange[0]))));
      if (goldLost > 0) p.spendGold(goldLost);
      this.addLog(`Lost ${goldLost} gold.`);

      const itemRange = dc?.combatLossItemCount || [1, 2];
      const loseCount = itemRange[0] + Math.floor(Math.random() * (itemRange[1] - itemRange[0] + 1));
      const items = [...p.inventory.keys()];
      const lostItemKeys = [];  // track lost items before mutation for insurance
      for (let i = 0; i < loseCount && items.length > 0; i++) {
        const idx = Math.floor(Math.random() * items.length);
        const itemKey = items[idx];
        lostItemKeys.push(itemKey);
        p.removeItem({ name: itemKey });
        items.splice(idx, 1);
        this.addLog(`${raiderType.name} stole 1 ${itemKey}.`);
      }

      if (this.raider) {
        this.raider.state = 'patrolling';
        this.raider.path = [];
        this.raider.bribedCooldown = 2; // Leave player alone for 2 days after winning
        // Conflict Resolution book extends cooldown
        if (p.modifiers?.bribeCooldownBonus > 0) {
          this.raider.bribedCooldown += p.modifiers.bribeCooldownBonus;
        }
        const dx = this.raider.x - p.x;
        const dy = this.raider.y - p.y;
        const pushDist = 3;
        this.raider.x = Math.max(0, Math.min(cols - 1, this.raider.x + (dx >= 0 ? pushDist : -pushDist)));
        this.raider.y = Math.max(0, Math.min(rows - 1, this.raider.y + (dy >= 0 ? pushDist : -pushDist)));
      }

      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Defeated! Lost ${goldLost} gold and supplies.`, "error");
      }

      // Insurance claim: if player has active insurance, auto-claim for lost cargo value
      if (typeof bankingSystem !== 'undefined' && bankingSystem && bankingSystem.insuranceActive) {
        let lostCargoValue = 0;
        for (let li = 0; li < lostItemKeys.length; li++) {
          const lib = typeof ItemLibrary !== 'undefined' ? ItemLibrary[lostItemKeys[li]] : null;
          if (lib) lostCargoValue += lib.baseValue || 10;
        }
        if (lostCargoValue > 0) {
          const payout = bankingSystem.claimInsurance(lostCargoValue + goldLost, true);
          if (payout > 0) {
            this.addLog(`🛡️ Insurance payout: +${payout}g!`);
          }
        }
      }

      // Losing a naval battle is brutal on the hull
      if (this.isNavalCombat && p.activeBoat) {
        const hullMul = window.DIFFICULTY_CONFIG?.hullDamageMultiplier || 1;
        const condDmg = Math.round((25 + Math.floor(Math.random() * 16)) * hullMul); // 25-40 pts * difficulty
        p.activeBoat.applyDamage(condDmg);
        this.addLog(`🔧 Your hull is battered! -${condDmg} condition (${p.activeBoat.condition}%).`);
        this._checkBoatSinking();
      }
      // Naval loss on permadeath = death
      if (this.result === 'lose' && window.DIFFICULTY_CONFIG?.permadeath) {
        this._permadeathTriggered = true;
      }
    } else if (this.result === 'fled') {
      if (this.raider) {
        this.raider.state = 'patrolling';
        this.raider.path = [];
        this.raider.stunTimer = 5000; // 5s real-time freeze
      }

      // Fleeing costs hull condition (naval)
      if (this.isNavalCombat && p.activeBoat) {
        p.activeBoat.applyDamage(5);
        this.addLog(`🔧 Hasty escape cost 5 hull condition (${p.activeBoat.condition}%).`);
        this._checkBoatSinking();
      }

      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Escaped from ${raiderType.name}!`, "warning");
      }
    } else if (this.result === 'bribed') {
      this.raider.bribedCooldown = 3; // 3 days before they can attack again
      // Conflict Resolution book extends cooldown
      if (p.modifiers?.bribeCooldownBonus > 0) {
        this.raider.bribedCooldown += p.modifiers.bribeCooldownBonus;
      }
      this.raider.state = 'patrolling';
      this.raider.path = [];
      this.raider.stunTimer = 5000; // 5s real-time freeze
      // Push raider away so they don't immediately crowd the player
      if (this.raider) {
        const dx = this.raider.x - p.x;
        const dy = this.raider.y - p.y;
        const pushDist = 4;
        this.raider.x = Math.max(0, Math.min(cols - 1, this.raider.x + (dx >= 0 ? pushDist : -pushDist)));
        this.raider.y = Math.max(0, Math.min(rows - 1, this.raider.y + (dy >= 0 ? pushDist : -pushDist)));
      }
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Bribed the ${raiderType.name} for safe passage.`, "info");
      }
    }

    // --- Persist remaining HP back to player (land combat only) ---
    if (!this.isNavalCombat && p.getMaxHP) {
      const maxHP = p.getMaxHP();
      // On permadeath, dying in combat (HP→0) is permanent — delete save immediately
      if (this.result === 'lose' && window.DIFFICULTY_CONFIG?.permadeath) {
        p.currentHP = 0;
        this._permadeathTriggered = true;
        window._permadeathTriggered = true;
        if (typeof SaveSystem !== 'undefined') SaveSystem.deleteSave();
      } else {
        p.currentHP = Math.min(maxHP, Math.max(1, this.playerHP));
      }
    }

    // Note: this.active stays true until endCombat() so UI can still refresh bars
  }

  /** If active boat condition ≤ 0, destroy it and teleport player to nearest city */
  _checkBoatSinking() {
    const p = this._getPlayerRef();
    if (!p || !p.activeBoat || p.activeBoat.condition > 0) return;
    const name = p.activeBoat.name;
    const type = p.activeBoat.displayName;
    const idx = p.fleet.indexOf(p.activeBoat);
    if (idx >= 0) p.fleet.splice(idx, 1);
    p.activeBoat = p.fleet[0] || null;
    p.isSailing = false;
    p.pathMoveInterval = p.landSpeed;
    this.addLog(`💀 Your ${type} "${name}" has sunk!`);
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`💀 Your ${type} "${name}" has sunk! The wreckage disappears beneath the waves.`, "error");
    }

    // Rescue: teleport player to the nearest city so they aren't stranded on water
    const allCities = this._getCitiesRef();
    if (Array.isArray(allCities) && allCities.length > 0) {
      let bestCity = null;
      let bestDist = Infinity;
      for (let i = 0; i < allCities.length; i++) {
        const loc = allCities[i].location;
        const dist = Math.abs(p.x - loc.x) + Math.abs(p.y - loc.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestCity = allCities[i];
        }
      }
      if (bestCity) {
        p.x = bestCity.location.x;
        p.y = bestCity.location.y;
        p.path = [];
        this.addLog(`🏊 You washed ashore near ${bestCity.name}.`);
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log(`🏊 You washed ashore near ${bestCity.name}.`, "info");
        }
      }
    }
  }

  endCombat() {
    this.log = [];
    this.result = null;
    this.active = false;
    this.raider = null;
    this._cachedBribeCost = null;

    // Clear combat enhancement state
    this.enemyGoesFirst = false;
    this._mustBlockFirst = false;
    this.playerStatusEffects = [];
    this.raiderStatusEffects = [];
    this.fumbleEffect = null;
    this._droppedWeapon = false;
    this._pendingDroppedWeapon = false;
    this._stumbleBonus = 0;

    // Clear naval state
    this._stopNavalPhaseEngine();
    this.isNavalCombat = false;
    this.playerBoatType = null;
    this.enemyBoatType = null;
    this.playerGrid = null;
    this.enemyGrid = null;
    this.playerShipPos = null;
    this.playerShipHorizontal = true;
    this.enemyShipPos = null;
    this.enemyShipHorizontal = true;
    this.enemyTargetCell = null;
    this.navalRound = 0;
    this.playerEscortFleet = [];
    this.enemyFleetShips = 1;
    this.playerUncrewedSupport = 0;
    this._initPlayerHP = 0;
    this._initRaiderHP = 0;
    if (this._navalTickTimer) { clearInterval(this._navalTickTimer); this._navalTickTimer = null; }

    // Reset ability + AI + environment state
    this._abilityCooldowns = { chainShot: 0, smokeScreen: 0, repair: 0 };
    this._activeEffects = { chainShot: false, smokeScreen: false };
    this.enemyBehavior = 'aggressive';
    this._behaviorRoundsLeft = 3 + Math.floor(Math.random() * 3);
    this.environmentCells = [];
    this._handlers = {};
    const returnState = this._returnState
      || ((window._isCityManageMode && typeof GameStates !== 'undefined') ? GameStates.CITY_MANAGE : GameStates.PLAYING);
    this._returnState = null;

    // Brief cooldown to prevent instant re-trigger
    window._combatCooldown = true;
    setTimeout(() => { window._combatCooldown = false; }, 2000);

    // Check for game over — permadeath: any combat death is fatal
    if (this._permadeathTriggered) {
      this._permadeathTriggered = false;
      if (typeof triggerGameLose === 'function') triggerGameLose();
      else gameStateManager.setState(GameStates.GAMELOSE);
    } else if (player.gold <= 0 && player.inventory.size === 0) {
      if (typeof triggerGameLose === 'function') triggerGameLose();
      else gameStateManager.setState(GameStates.GAMELOSE);
    } else {
      gameStateManager.setState(returnState);
      // Transition safety net: never leave the game stuck in COMBAT.
      if (gameStateManager?.is?.(GameStates.COMBAT)) {
        gameStateManager.setState(GameStates.PLAYING);
      }
    }
  }
}
