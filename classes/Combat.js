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
  constructor() {
    this.active = false;
    this.raider = null;
    this.playerHP = 0;
    this.raiderHP = 0;
    this.log = [];
    this.turnCount = 0;
    this.result = null;
    this.onComplete = null;
    this.currentTerrain = 'Grass';
    this.raiderType = null;
    this.raiderRage = 0;
    this.lastCombatEvents = [];
    this._cachedBribeCost = null;

    // Initiative & turn order
    this.enemyGoesFirst = false;
    this._mustBlockFirst = false;

    // Stamina / fatigue
    this.playerStamina = 0;
    this.maxStamina = 0;

    // Status effects: arrays of { type, remainingTurns, dmgPerTurn }
    this.playerStatusEffects = [];
    this.raiderStatusEffects = [];

    // Fumble state (persists for 1 turn)
    this.fumbleEffect = null; // null | 'selfDamage' | 'dropWeapon' | 'stumble'
    this._droppedWeapon = false; // if true, next attack uses Fists
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
    this._initPlayerHP = 0;
    this._initRaiderHP = 0;
  }

  addLog(message) {
    this.log.push(message);
  }

  playerAction(type, secondArg) {
    if (this.result) return { message: '', resolved: true, won: this.result === 'win', fled: this.result === 'fled' };
    if (type === 'fight') return this.doPlayerAttack(secondArg);  // secondArg = accuracy 0-1
    if (type === 'block') return this.doEnemyAttack(secondArg);   // secondArg = blockAccuracy 0-1
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
    this.active = true;
    this.raider = raider;
    this.currentTerrain = grid[player.y]?.[player.x]?.options[0] || 'Grass';
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
    this._stumbleBonus = 0;

    // --- Naval combat detection ---
    this.isNavalCombat = !!(raider.isPirate && player.isSailing && player.activeBoat);

    if (this.isNavalCombat) {
      this.raiderType = 'pirate';
      this.playerBoatType = player.activeBoat.type;
      this.enemyBoatType = raider.boat || 'rowboat';

      const pBoat = BoatLibrary[this.playerBoatType] || BoatLibrary.rowboat;
      const eBoat = BoatLibrary[this.enemyBoatType] || BoatLibrary.rowboat;

      // Scale enemy HP by raider strength; player HP scales by boat condition
      const strMul = 1 + (raider.strength || 1) * 0.1;
      this.playerHP = player.activeBoat.getEffectiveHP();
      this.raiderHP = Math.ceil(eBoat.hp * 2 * strMul);
      this._initPlayerHP = this.playerHP;
      this._initRaiderHP = this.raiderHP;

      this._initNavalGrids(pBoat.gridSize, eBoat.gridSize);

      this.log = [];
      this.turnCount = 0;
      this.result = null;
      this.navalRound = 0;

      this.addLog(`⚓ Naval Battle! Your ${pBoat.displayName} vs Pirate ${eBoat.displayName}!`);
      this.addLog(`Find the enemy ship (${eBoat.gridSize} cell${eBoat.gridSize > 1 ? 's' : ''}) and sink it!`);
      this.addLog(`WASD to dodge · Click enemy grid to fire!`);
      this.addLog(`Watch for 🎯 warnings — move before the cannon fires!`);

      gameStateManager.setState(GameStates.COMBAT);
      return;
    }

    // --- Standard land combat ---
    const playerStr = this.getPlayerStrength();
    const terrain = TERRAIN_BONUSES[this.currentTerrain];
    const dayScale = this.getDayScaling();

    // HP balance: player is fragile, raiders are tough
    this.playerHP = Math.floor(playerStr.total + this.getTerrainBonus('defense') + 2);
    this.raiderHP = raider.strength * 3 + 4 + dayScale.hpBonus;
    this._initPlayerHP = this.playerHP;
    this._initRaiderHP = this.raiderHP;

    // Stamina system: base 6 + party (capped at 2) — runs out fast
    this.maxStamina = 6 + Math.min(player.party.length, 2);
    this.playerStamina = this.maxStamina;

    this.log = [];
    this.turnCount = 0;
    this.result = null;

    const raiderInfo = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];
    this.addLog(`You encounter a ${raiderInfo.name} on ${this.currentTerrain}!`);
    if (terrain.description) this.addLog(`Terrain: ${terrain.description}`);
    if (raiderInfo.desc) this.addLog(`Enemy: ${raiderInfo.desc}`);
    if (raiderInfo.monster) this.addLog(`⚠ This creature cannot be bribed!`);

    // --- Initiative system ---
    const playerSpeed = (player.speed || 2) + (playerStr.weapon.speed || 0) + Math.floor(Math.random() * 6) + 1;
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
  }

  /** Get difficulty scaling based on days elapsed — aggressive curve */
  getDayScaling() {
    const day = (typeof dayNight !== 'undefined') ? dayNight.getDaysElapsed() : 0;
    return {
      strengthBonus: Math.min(8, Math.floor(day / 15)),     // +1 str per 15 days, cap +8
      hpBonus: Math.min(12, Math.floor(day / 12)),           // +1 HP per 12 days, cap +12
      extraInputs: day >= 60 ? 2 : (day >= 25 ? 1 : 0),     // extra QTE inputs earlier
      timerReduction: Math.min(250, Math.floor(day / 10) * 15), // ms faster QTE, steeper
    };
  }

  getPlayerStrength() {
    let str = 3;
    str += Math.min(player.party.length, 3); // Cap party bonus at 3

    let bestWeapon = { damage: 0, crit: 0.05, speed: 0 };
    let bestWeaponName = 'Fists';

    // If weapon was dropped due to fumble, force Fists
    if (this._droppedWeapon) {
      bestWeaponName = 'Fists';
      bestWeapon = WEAPONS['Fists'];
    } else if (player.equippedWeapon && player.inventory.has(player.equippedWeapon) && WEAPONS[player.equippedWeapon]) {
      bestWeapon = WEAPONS[player.equippedWeapon];
      bestWeaponName = player.equippedWeapon;
    } else {
      // Fall back: auto-detect best weapon in inventory
      for (const item of player.inventory.keys()) {
        const weapon = WEAPONS[item];
        if (weapon && weapon.damage > bestWeapon.damage) {
          bestWeapon = weapon;
          bestWeaponName = item;
        }
      }
    }
    if (player.inventory.has('Tools')) str += 1;

    this._resolvedWeaponName = bestWeaponName;
    this._resolvedWeapon = bestWeapon;
    return {
      total: str + bestWeapon.damage,
      base: str,
      weapon: bestWeapon,
      weaponName: bestWeaponName,
      speed: (player.speed || 2) + (bestWeapon.speed || 0),
    };
  }

  getPlayerCritChance() {
    // Prefer equipped weapon
    if (player.equippedWeapon && player.inventory.has(player.equippedWeapon) && WEAPONS[player.equippedWeapon]) {
      return WEAPONS[player.equippedWeapon].crit;
    }
    let crit = 0.05;
    for (const item of player.inventory.keys()) {
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
        const swings = Math.min(5, 2 + Math.floor(strength / 3)) + dayScale.extraInputs;
        let timePerSwing = Math.max(900, 1600 - strength * 100) - dayScale.timerReduction;
        timePerSwing = Math.max(600, Math.round(timePerSwing));
        return {
          qteType: 'powerMeter', weaponType: weaponName,
          swings, timePerSwing, totalTime: swings * timePerSwing,
          sweetSpotSize: Math.max(0.08, 0.18 - strength * 0.015),
        };
      }
      case 'Bow': {
        const targets = Math.min(8, 3 + Math.floor(strength / 2)) + dayScale.extraInputs;
        let timePerTarget = Math.max(750, 1400 - strength * 100) - dayScale.timerReduction;
        timePerTarget = Math.max(500, Math.round(timePerTarget));
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
        const casts = Math.min(7, 3 + Math.floor(strength / 2)) + dayScale.extraInputs;
        let timePerCast = Math.max(900, 1800 - strength * 120) - dayScale.timerReduction;
        timePerCast = Math.max(550, Math.round(timePerCast * fatigueMul));
        return {
          qteType: 'spellTiming', weaponType: weaponName,
          casts, timePerCast, totalTime: casts * timePerCast,
          targetSize: Math.max(0.08, 0.14 - strength * 0.01),
        };
      }
      case 'Dagger': {
        const count = Math.min(10, 5 + Math.floor(strength / 2)) + dayScale.extraInputs;
        let timePerArrow = Math.max(450, 700 - strength * 40) - dayScale.timerReduction;
        timePerArrow = Math.max(350, Math.round(timePerArrow));
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
        const count = Math.min(6, 2 + Math.floor(strength / 2)) + dayScale.extraInputs;
        let timePerArrow = Math.max(800, 1400 - strength * 100) - dayScale.timerReduction;
        timePerArrow = Math.max(600, Math.round(timePerArrow));
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

  /** Get max accuracy cap based on fatigue — kicks in earlier */
  _getFatigueAccuracyCap() {
    if (this.maxStamina <= 0) return 1;
    const ratio = this.playerStamina / this.maxStamina;
    if (ratio <= 0) return 0.5;     // exhausted: maxes at 50%
    if (ratio <= 0.25) return 0.7;  // very tired: maxes at 70%
    if (ratio <= 0.5) return 0.85;  // tired: maxes at 85%
    return 1;
  }

  // Phase 1: Player attacks — accuracy from attack QTE (0-1)
  doPlayerAttack(accuracy) {
    this.turnCount++;
    const raiderType = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];

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

    // --- Stamina drain ---
    const weaponName = this._resolvedWeaponName || 'Fists';
    const heavyWeapons = ['Axe', 'Crossbow', 'Staff'];
    const staminaCost = heavyWeapons.includes(weaponName) ? 3 : 2;
    this.playerStamina = Math.max(0, this.playerStamina - staminaCost);

    // Stamina warnings
    if (this.maxStamina > 0) {
      const ratio = this.playerStamina / this.maxStamina;
      if (ratio <= 0) this.addLog(`⚠️ You can barely lift your weapon!`);
      else if (ratio <= 0.25) this.addLog(`⚠️ Exhaustion sets in!`);
      else if (ratio <= 0.5 && this.turnCount > 1) this.addLog(`⚠️ You're tiring...`);
    }

    // --- Cap accuracy by fatigue ---
    const accCap = this._getFatigueAccuracyCap();
    if (accuracy !== null && accuracy !== undefined) {
      accuracy = Math.min(accuracy, accCap);
    }

    // --- Fumble check: low accuracy (<30%) ---
    let fumbleTriggered = false;
    if (accuracy !== null && accuracy !== undefined && accuracy < 0.3 && accuracy > 0) {
      const fumbleRoll = Math.random();
      const fumbleChance = this.playerStamina <= 0 ? 1.0 : 1.0; // always fumble on <20%
      if (fumbleRoll < 0.5) {
        // Self-damage
        const selfDmg = 1 + Math.floor(Math.random() * 2);
        this.playerHP -= selfDmg;
        this.addLog(`💥 You fumble and cut yourself for ${selfDmg} damage!`);
        fumbleTriggered = true;
      } else if (fumbleRoll < 0.8) {
        // Drop weapon for 1 turn
        this._droppedWeapon = true;
        this.addLog(`🗡️ Your weapon flies from your grip! Fighting with fists next round!`);
        fumbleTriggered = true;
      } else {
        // Stumble — enemy gets +2 next attack
        this._stumbleBonus = 2;
        this.addLog(`🦶 You stumble, leaving an opening!`);
        fumbleTriggered = true;
      }
    }

    const playerStr = this.getPlayerStrength();
    const playerCrit = this.getPlayerCritChance();

    let playerAttack = playerStr.total + this.getTerrainBonus('offense');

    // Armor: Black Knight takes 1 less damage per hit
    let armorReduction = raiderType.special === 'armor' ? 1 : 0;

    // Shield: raider type gets +2 defense first 2 turns, then +1
    let shieldBonus = 0;
    if (raiderType.special === 'shield') {
      shieldBonus = this.turnCount <= 2 ? 2 : 1;
    }

    // Player roll: accuracy directly scales damage — low accuracy = whiff
    let playerDie;
    let accuracyBonus = 0;
    let forceCrit = false;
    let accuracyMiss = false;
    if (accuracy !== null && accuracy !== undefined) {
      // Below 40% accuracy: guaranteed miss
      if (accuracy < 0.4) {
        accuracyMiss = true;
        playerDie = 1;
      } else {
        playerDie = Math.max(1, Math.ceil(accuracy * 6));
      }
      if (accuracy >= 1.0) { accuracyBonus = 2; forceCrit = true; }
      else if (accuracy >= 0.9) { accuracyBonus = 1; }
    } else {
      playerDie = Math.floor(Math.random() * 6) + 1;
    }
    const playerRoll = playerDie + playerAttack + accuracyBonus;

    // Enemy defense — strength-based with shield bonus and daze penalty
    let raiderDefMod = this.raider.strength + shieldBonus;
    // Daze: raider rolls at -2
    if (this._hasStatusEffect(this.raiderStatusEffects, 'daze')) {
      raiderDefMod = Math.max(0, raiderDefMod - 2);
      this.addLog(`😵 ${raiderType.name} is dazed — defenses lowered!`);
    }
    const raiderDefRoll = Math.floor(Math.random() * 6) + 1 + raiderDefMod;

    this.addLog(`--- Round ${this.turnCount} ---`);
    const accLabel = (accuracy !== null && accuracy !== undefined)
      ? `${Math.round(accuracy * 100)}%` : 'd6';
    const bonusStr = accuracyBonus > 0 ? `+${accuracyBonus}` : '';
    if (this._droppedWeapon) this.addLog(`👊 Fighting with fists!`);
    this.addLog(`⚔️ You attack! Roll ${playerRoll} (${accLabel}+${playerAttack}${bonusStr})`);

    // Wraith phase: 30% chance to dodge
    let wraithDodge = raiderType.special === 'phase' && Math.random() < 0.3;
    let enemyKilled = false;
    let playerDmg = 0;
    let playerMiss = false;
    let playerCritHit = false;

    if (accuracyMiss) {
      this.addLog(`Your attack is too sloppy — it goes wide!`);
      playerMiss = true;
    } else if (wraithDodge) {
      this.addLog(`The ${raiderType.name} phases out — your attack passes through!`);
      playerMiss = true;
    } else if (playerRoll > raiderDefRoll) {
      playerDmg = Math.max(1, playerRoll - raiderDefRoll - armorReduction);
      if (forceCrit || Math.random() < playerCrit) {
        playerDmg *= 2;
        playerCritHit = true;
        this.addLog(forceCrit ? `🌟 PERFECT STRIKE — CRITICAL HIT!` : `💥 CRITICAL HIT!`);
        // Player crits apply bleed to raiders
        this._applyStatusToRaider('bleed');
      }
      // Staff attacks apply daze
      if (weaponName === 'Staff' && !this._droppedWeapon && Math.random() < 0.3) {
        this._applyStatusToRaider('daze');
        this.addLog(`✨ Your spell dazes the ${raiderType.name}!`);
      }
      if (armorReduction > 0) this.addLog(`${raiderType.name}'s armor absorbs some damage.`);
      if (shieldBonus > 0) this.addLog(`${raiderType.name}'s shield blocks some force.`);
      this.raiderHP -= playerDmg;
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
  doEnemyAttack(blockAccuracy) {
    const raiderType = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];
    let raiderAttack = this.raider.strength;

    // Stamina cost for blocking — heavier enemies cost more to block
    const blockStaminaCost = this.raider.strength >= 5 ? 2 : 1;
    this.playerStamina = Math.max(0, this.playerStamina - blockStaminaCost);

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
    const playerDef = this.getTerrainBonus('defense') + 2;

    // Enemy miss: low roll vs player defense
    const enemyMiss = raiderRoll <= playerDef;

    // Block reduces damage: 100% block = 57.5% reduction, 0% = 0%
    const blockReduction = (blockAccuracy || 0) * 0.575;

    let rawDmg = Math.max(2, raiderRoll - playerDef);

    // Dragon fire special — now has 30% stun chance
    if (raiderType.special === 'fire' && this.turnCount % 2 === 0) {
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

    // Marauder bleed on crit
    const raiderCrit = raiderType.critChance || 0.10;
    let raiderCritHit = false;
    if (Math.random() < raiderCrit) {
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
      finalDmg = Math.max(1, Math.round(rawDmg * (1 - blockReduction)));
      const blockPct = Math.round((blockAccuracy || 0) * 100);
      if (blockAccuracy >= 0.8) {
        this.addLog(`🛡️ Strong block! (${blockPct}%) — ${raiderType.name} deals ${finalDmg} damage.`);
      } else if (blockAccuracy >= 0.5) {
        this.addLog(`🛡️ Partial block (${blockPct}%) — ${raiderType.name} deals ${finalDmg} damage.`);
      } else {
        this.addLog(`${raiderType.name} hits you for ${finalDmg} damage!`);
      }
      this.playerHP -= finalDmg;
    }

    // Ambush special on turn 1
    if (raiderType.special === 'ambush' && this.turnCount === 1) {
      const ambushDmg = Math.floor(Math.random() * 3) + 1;
      this.playerHP -= ambushDmg;
      this.addLog(`${raiderType.name} ambushes you for ${ambushDmg} extra damage!`);
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

    let count = Math.min(8, 3 + Math.floor(strength / 2)) + dayScale.extraInputs;
    let timePerBlock = Math.max(500, 800 - strength * 40) - dayScale.timerReduction;
    timePerBlock = Math.max(500, Math.round(timePerBlock));
    // Scroll approach time — how long arrows are visible before reaching target
    const approachTime = 2000;
    // Time between spawns
    const spawnInterval = timePerBlock;

    // Scouts attack faster
    if (raiderType.special === 'strike') { timePerBlock -= 50; count += 1; }
    // Rage adds more attacks
    if (raiderType.special === 'rage') { count += Math.floor(this.raiderRage / 2); }
    // Cap
    count = Math.min(10, count);

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

  // Player chooses to flee — recovers 1 stamina
  doFlee() {
    this.playerStamina = Math.min(this.maxStamina, this.playerStamina + 1);
    const raiderType = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];
    let fleeChance = TERRAIN_BONUSES[this.currentTerrain]?.flee || 0.40;

    if (raiderType.special === 'ambush') {
      fleeChance -= 0.10;
      this.addLog(`${raiderType.name} is watching for escape attempts!`);
    }

    this.addLog(`You attempt to flee... (${Math.floor(fleeChance * 100)}% chance on ${this.currentTerrain})`);

    if (Math.random() < fleeChance) {
      this.result = 'fled';
      this.addLog(`You escape! But drop some supplies in your haste.`);

      // Lose 1 random item
      const items = [...player.inventory.keys()];
      if (items.length > 0) {
        const lostItem = items[Math.floor(Math.random() * items.length)];
        player.removeItem({ name: lostItem });
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
        this.addLog(`💫 You're stunned — you can't act this turn!`);
      }
      if (effect.dmgPerTurn > 0) {
        this.playerHP -= effect.dmgPerTurn;
        this.addLog(`${def.icon} ${def.name} deals ${effect.dmgPerTurn} damage! (HP: ${Math.max(0, this.playerHP)})`);
      }
      effect.remainingTurns--;
      if (effect.remainingTurns <= 0) {
        this.addLog(`${def.icon} ${def.name} wears off.`);
        this.playerStatusEffects.splice(i, 1);
      }
    }

    // Raider status effects
    for (let i = this.raiderStatusEffects.length - 1; i >= 0; i--) {
      const effect = this.raiderStatusEffects[i];
      const def = STATUS_EFFECTS[effect.type];
      if (!def) { this.raiderStatusEffects.splice(i, 1); continue; }

      if (effect.dmgPerTurn > 0) {
        this.raiderHP -= effect.dmgPerTurn;
        this.addLog(`${def.icon} ${raiderType.name} takes ${effect.dmgPerTurn} ${def.name.toLowerCase()} damage! (HP: ${Math.max(0, this.raiderHP)})`);
      }
      effect.remainingTurns--;
      if (effect.remainingTurns <= 0) {
        this.raiderStatusEffects.splice(i, 1);
      }
    }

    return { playerStunned };
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

    this.playerShipPos = { r, c };
    const arrows = { up: '⬆', down: '⬇', left: '⬅', right: '➡' };
    this.addLog(`${arrows[direction] || '↗'} Ship repositioned!`);
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
      return;
    }
  }

  /** Get enemy maneuver chance based on boat type */
  _getEnemyManeuverChance() {
    const chances = { rowboat: 0.7, sloop: 0.5, galleon: 0.3 };
    return chances[this.enemyBoatType] || 0.5;
  }

  /** AI picks next target cell — accuracy scales with enemy boat type */
  _pickEnemyTarget() {
    const shipCells = this.getPlayerShipCells();
    const smartChance = { rowboat: 0.15, sloop: 0.25, galleon: 0.35 };
    const chance = smartChance[this.enemyBoatType] || 0.2;
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

    let nearMiss = false;
    if (isHit) {
      const dmg = pBoat.attack;
      this.raiderHP = Math.max(0, this.raiderHP - dmg);
      this.addLog(`💥 Direct hit! ${dmg} damage! (${this.raiderHP} HP left)`);
    } else {
      nearMiss = enemyCells.some(c => Math.abs(c.r - row) <= 1 && Math.abs(c.c - col) <= 1);
      if (nearMiss) {
        this.addLog(`💨 Close! Your shot just missed!`);
      } else {
        this.addLog(`🌊 Splash! Nothing but open water.`);
      }
    }

    if (this.raiderHP <= 0) {
      this.result = 'win';
      this.addLog(`🏆 The pirate ship sinks! Victory!`);
      this.resolveCombat();
      return { hit: isHit, resolved: true };
    }
    return { hit: isHit, nearMiss, resolved: false };
  }

  /** Telegraph: pick and show upcoming enemy target. Returns the target cell. */
  telegraphEnemyTarget() {
    if (this.result || !this.isNavalCombat) return null;
    this.enemyTargetCell = this._pickEnemyTarget();
    this.addLog(`🎯 Enemy taking aim...`);
    return this.enemyTargetCell;
  }

  /** Enemy AI fires at the telegraphed target. Returns { row, col, hit, resolved } or null */
  enemyNavalFire() {
    if (this.result || !this.isNavalCombat) return null;
    const eBoat = BoatLibrary[this.enemyBoatType] || BoatLibrary.rowboat;

    // Fire at telegraphed cell (fallback to random if null)
    const target = this.enemyTargetCell || this._pickEnemyTarget();
    this.enemyTargetCell = null;
    const shipCells = this.getPlayerShipCells();
    const isHit = shipCells.some(c => c.r === target.r && c.c === target.c);

    this.playerGrid[target.r][target.c] = isHit ? 'hit' : 'miss';

    if (isHit) {
      const dmg = eBoat.attack;
      this.playerHP = Math.max(0, this.playerHP - dmg);
      this.addLog(`💣 Enemy hits your ship! ${dmg} damage! (${this.playerHP} HP left)`);
    } else {
      this.addLog(`🌊 Enemy cannonball misses!`);
    }

    if (this.playerHP <= 0) {
      this.result = 'lose';
      this.addLog(`🚢 Your ship is sinking! Defeat.`);
      this.resolveCombat();
      return { row: target.r, col: target.c, hit: isHit, resolved: true };
    }

    // Enemy maneuvers after firing (chance varies by boat type)
    if (Math.random() < this._getEnemyManeuverChance()) this._moveEnemyShip();

    return { row: target.r, col: target.c, hit: isHit, resolved: false };
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
    const raiderType = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];

    if (this.result === 'win') {
      const lootGold = this.raider.loot.gold;
      player.earnGold(lootGold);
      this.addLog(`Looted ${lootGold} gold!`);

      for (const lootItem of this.raider.loot.items) {
        player.addItem({ name: lootItem.name, quantity: lootItem.quantity });
        const displayName = ItemLibrary[lootItem.name]?.name || lootItem.name;
        this.addLog(`Found ${lootItem.quantity}x ${displayName}!`);
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
      if (typeof cities !== 'undefined' && this.raider) {
        for (let ci = 0; ci < cities.length; ci++) {
          const loc = cities[ci].location;
          const dist = Math.abs(this.raider.x - loc.x) + Math.abs(this.raider.y - loc.y);
          if (dist <= 8 && cities[ci].adjustReputation) {
            cities[ci].adjustReputation(3);
          }
        }
      }

      // Apply hull damage from combat (naval)
      if (this.isNavalCombat && player.activeBoat && this._initPlayerHP > 0) {
        const hpRatio = 1 - (this.playerHP / this._initPlayerHP);
        const condDmg = Math.round(hpRatio * 40); // up to 40 pts lost
        if (condDmg > 0) {
          player.activeBoat.applyDamage(condDmg);
          this.addLog(`🔧 Hull took ${condDmg} wear (${player.activeBoat.condition}% condition).`);
        }
        this._checkBoatSinking();
      }

      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Victory! Looted ${lootGold} gold.`, "success");
      }
    } else if (this.result === 'lose') {
      const goldLost = Math.min(player.gold, Math.floor(player.gold * (0.1 + Math.random() * 0.2)));
      player.gold -= goldLost;
      this.addLog(`Lost ${goldLost} gold.`);

      const loseCount = 1 + Math.floor(Math.random() * 2);
      const items = [...player.inventory.keys()];
      for (let i = 0; i < loseCount && items.length > 0; i++) {
        const idx = Math.floor(Math.random() * items.length);
        const itemKey = items[idx];
        player.removeItem({ name: itemKey });
        items.splice(idx, 1);
        this.addLog(`${raiderType.name} stole 1 ${itemKey}.`);
      }

      if (this.raider) {
        this.raider.state = 'patrolling';
        this.raider.path = [];
        this.raider.bribedCooldown = 2; // Leave player alone for 2 days after winning
        // Conflict Resolution book extends cooldown
        if (typeof player !== 'undefined' && player.modifiers?.bribeCooldownBonus > 0) {
          this.raider.bribedCooldown += player.modifiers.bribeCooldownBonus;
        }
        const dx = this.raider.x - player.x;
        const dy = this.raider.y - player.y;
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
        for (let li = 0; li < loseCount && li < items.length; li++) {
          const lib = typeof ItemLibrary !== 'undefined' ? ItemLibrary[items[li]] : null;
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
      if (this.isNavalCombat && player.activeBoat) {
        const condDmg = 25 + Math.floor(Math.random() * 16); // 25-40 pts
        player.activeBoat.applyDamage(condDmg);
        this.addLog(`🔧 Your hull is battered! -${condDmg} condition (${player.activeBoat.condition}%).`);
        this._checkBoatSinking();
      }
    } else if (this.result === 'fled') {
      if (this.raider) {
        this.raider.state = 'patrolling';
        this.raider.path = [];
        this.raider.stunTimer = 5000; // 5s real-time freeze
      }

      // Fleeing costs hull condition (naval)
      if (this.isNavalCombat && player.activeBoat) {
        player.activeBoat.applyDamage(5);
        this.addLog(`🔧 Hasty escape cost 5 hull condition (${player.activeBoat.condition}%).`);
        this._checkBoatSinking();
      }

      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Escaped from ${raiderType.name}!`, "warning");
      }
    } else if (this.result === 'bribed') {
      this.raider.bribedCooldown = 3; // 3 days before they can attack again
      // Conflict Resolution book extends cooldown
      if (typeof player !== 'undefined' && player.modifiers?.bribeCooldownBonus > 0) {
        this.raider.bribedCooldown += player.modifiers.bribeCooldownBonus;
      }
      this.raider.state = 'patrolling';
      this.raider.path = [];
      this.raider.stunTimer = 5000; // 5s real-time freeze
      // Push raider away so they don't immediately crowd the player
      if (this.raider) {
        const dx = this.raider.x - player.x;
        const dy = this.raider.y - player.y;
        const pushDist = 4;
        this.raider.x = Math.max(0, Math.min(cols - 1, this.raider.x + (dx >= 0 ? pushDist : -pushDist)));
        this.raider.y = Math.max(0, Math.min(rows - 1, this.raider.y + (dy >= 0 ? pushDist : -pushDist)));
      }
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Bribed the ${raiderType.name} for safe passage.`, "info");
      }
    }

    // Note: this.active stays true until endCombat() so UI can still refresh bars
  }

  /** If active boat condition ≤ 0, destroy it and teleport player to nearest city */
  _checkBoatSinking() {
    if (!player.activeBoat || player.activeBoat.condition > 0) return;
    const name = player.activeBoat.name;
    const type = player.activeBoat.displayName;
    const idx = player.fleet.indexOf(player.activeBoat);
    if (idx >= 0) player.fleet.splice(idx, 1);
    player.activeBoat = player.fleet[0] || null;
    player.isSailing = false;
    player.pathMoveInterval = player.landSpeed;
    this.addLog(`💀 Your ${type} "${name}" has sunk!`);
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`💀 Your ${type} "${name}" has sunk! The wreckage disappears beneath the waves.`, "error");
    }

    // Rescue: teleport player to the nearest city so they aren't stranded on water
    if (typeof cities !== 'undefined' && cities.length > 0) {
      let bestCity = null;
      let bestDist = Infinity;
      for (let i = 0; i < cities.length; i++) {
        const loc = cities[i].location;
        const dist = Math.abs(player.x - loc.x) + Math.abs(player.y - loc.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestCity = cities[i];
        }
      }
      if (bestCity) {
        player.x = bestCity.location.x;
        player.y = bestCity.location.y;
        player.path = [];
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
    this.playerStamina = 0;
    this.maxStamina = 0;
    this.playerStatusEffects = [];
    this.raiderStatusEffects = [];
    this.fumbleEffect = null;
    this._droppedWeapon = false;
    this._stumbleBonus = 0;

    // Clear naval state
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
    this._initPlayerHP = 0;
    this._initRaiderHP = 0;
    if (this._navalTickTimer) { clearInterval(this._navalTickTimer); this._navalTickTimer = null; }

    // Brief cooldown to prevent instant re-trigger
    window._combatCooldown = true;
    setTimeout(() => { window._combatCooldown = false; }, 2000);

    // Check for game over
    if (player.gold <= 0 && player.inventory.size === 0) {
      gameStateManager.setState(GameStates.GAMELOSE);
    } else {
      gameStateManager.setState(GameStates.PLAYING);
    }
  }
}
