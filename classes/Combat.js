// Combat.js — Turn-based tactical combat system
// Crit chance, weapon bonuses, terrain effects, and complex raider behaviors

const WEAPONS = {
  'Fists': { damage: 0, crit: 0.05 },
  'Dagger': { damage: 1, crit: 0.10 },
  'Sword': { damage: 2, crit: 0.15 },
  'Axe': { damage: 3, crit: 0.20 },
  'Bow': { damage: 2, crit: 0.15, range: true },
  'Crossbow': { damage: 3, crit: 0.25, range: true },
  'Staff': { damage: 2, crit: 0.10, magic: true },
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
  'bandit': { name: 'Bandit', critChance: 0.10, special: 'ambush', desc: 'May strike first' },
  'marauder': { name: 'Marauder', critChance: 0.15, special: 'rage', desc: 'Gets stronger when hurt' },
  'raider': { name: 'Raider', critChance: 0.12, special: 'shield', desc: 'Has defensive bonus' },
  'boss': { name: 'Raider Captain', critChance: 0.20, special: 'command', desc: 'Boosts nearby allies' },
  'scout': { name: 'Scout', critChance: 0.25, special: 'strike', desc: 'High crit, low health' },
};

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
  }

  addLog(message) {
    this.log.push(message);
  }

  playerAction(type) {
    if (this.result) return { message: '', resolved: true, won: this.result === 'win', fled: this.result === 'fled' };
    if (type === 'fight') this.doFight();
    else if (type === 'flee') this.doFlee();
    else if (type === 'bribe') this.doBribe();

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

    const playerStr = this.getPlayerStrength();
    const terrain = TERRAIN_BONUSES[this.currentTerrain];
    this.playerHP = (playerStr.total + this.getTerrainBonus('defense')) * 2;
    this.raiderHP = raider.strength * 2;
    this.log = [];
    this.turnCount = 0;
    this.result = null;

    const raiderInfo = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];
    this.addLog(`You encounter a ${raiderInfo.name} on ${this.currentTerrain}!`);
    if (terrain.description) this.addLog(`Terrain: ${terrain.description}`);
    if (raiderInfo.desc) this.addLog(`Enemy: ${raiderInfo.desc}`);
    this.addLog(`Choose your action.`);

    gameStateManager.setState(GameStates.COMBAT);
  }

  getPlayerStrength() {
    let str = 3;
    str += player.party.length;

    let bestWeapon = { damage: 0, crit: 0.05 };
    for (const item of player.inventory.keys()) {
      const weapon = WEAPONS[item];
      if (weapon && weapon.damage > bestWeapon.damage) {
        bestWeapon = weapon;
      }
    }
    if (player.inventory.has('Tools')) str += 1;

    return { total: str + bestWeapon.damage, base: str, weapon: bestWeapon };
  }

  getPlayerCritChance() {
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

  // Player chooses to fight
  doFight() {
    this.turnCount++;
    const playerStr = this.getPlayerStrength();
    const terrain = TERRAIN_BONUSES[this.currentTerrain];
    const raiderType = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];
    const playerCrit = this.getPlayerCritChance();

    let playerAttack = playerStr.total + this.getTerrainBonus('offense');
    let raiderAttack = this.raider.strength;

    if (raiderType.special === 'rage') {
      raiderAttack += Math.floor(this.raiderRage / 2);
    }

    const playerRoll = Math.floor(Math.random() * 6) + 1 + playerAttack;
    const raiderRoll = Math.floor(Math.random() * 6) + 1 + raiderAttack;

    this.addLog(`--- Round ${this.turnCount} ---`);
    this.addLog(`You roll ${playerRoll} (d6+${playerAttack}) vs ${raiderType.name} ${raiderRoll} (d6+${raiderAttack})`);

    const playerCritRoll = Math.random();
    const raiderCritRoll = Math.random();
    let playerHit = false;
    let raiderHit = false;

    if (playerRoll > raiderRoll) {
      let dmg = playerRoll - raiderRoll;
      if (playerCritRoll < playerCrit) {
        dmg *= 2;
        this.addLog(`CRITICAL HIT!`);
      }
      this.raiderHP -= dmg;
      this.addLog(`You strike for ${dmg} damage! Raiders HP: ${Math.max(0, this.raiderHP)}`);
      playerHit = true;
    } else if (raiderRoll > playerRoll) {
      let dmg = raiderRoll - playerRoll;
      const raiderCrit = raiderType.critChance || 0.10;
      if (raiderCritRoll < raiderCrit) {
        dmg *= 2;
        this.addLog(`${raiderType.name} CRITS!`);
      }
      this.playerHP -= dmg;
      this.addLog(`${raiderType.name} hits you for ${dmg} damage! Your HP: ${Math.max(0, this.playerHP)}`);
      raiderHit = true;
    } else {
      this.addLog(`Clash! No damage dealt.`);
    }

    if (raiderType.special === 'ambush' && this.turnCount === 1 && !playerHit) {
      const ambushDmg = Math.floor(Math.random() * 3) + 1;
      this.playerHP -= ambushDmg;
      this.addLog(`${raiderType.name} ambushes you for ${ambushDmg} extra damage!`);
    }

    if (raiderHit) this.raiderRage++;

    if (this.raiderHP <= 0) {
      this.result = 'win';
      this.addLog(`Victory! The ${raiderType.name} is defeated.`);
      this.resolveCombat();
    } else if (this.playerHP <= 0) {
      this.result = 'lose';
      this.addLog(`Defeat! The ${raiderType.name} overwhelms you.`);
      this.resolveCombat();
    }
  }

  // Player chooses to flee
  doFlee() {
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

  // Player chooses to bribe
  doBribe() {
    const raiderType = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];
    let cost = this.raider.strength * (15 + Math.floor(Math.random() * 15));

    if (raiderType.special === 'command') {
      cost = Math.floor(cost * 1.5);
      this.addLog(`The Raider Captain demands a premium for safe passage!`);
    }

    this.addLog(`The ${raiderType.name} demands ${cost} gold for safe passage.`);

    if (player.gold >= cost) {
      player.spendGold(cost);
      this.result = 'bribed';
      this.addLog(`You pay ${cost} gold. The raiders let you pass.`);
      this.resolveCombat();
    } else {
      const raiderType = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];
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

  resolveCombat() {
    const raiderType = RAIDER_TYPES[this.raiderType] || RAIDER_TYPES['bandit'];

    if (this.result === 'win') {
      const lootGold = this.raider.loot.gold;
      player.earnGold(lootGold);
      this.addLog(`Looted ${lootGold} gold!`);

      for (const lootItem of this.raider.loot.items) {
        player.addItem({ name: lootItem.name, quantity: lootItem.quantity });
        this.addLog(`Found ${lootItem.quantity}x ${lootItem.name}!`);
      }

      this.raider.state = 'defeated';
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
        const dx = this.raider.x - player.x;
        const dy = this.raider.y - player.y;
        const pushDist = 3;
        this.raider.x = Math.max(0, Math.min(cols - 1, this.raider.x + (dx >= 0 ? pushDist : -pushDist)));
        this.raider.y = Math.max(0, Math.min(rows - 1, this.raider.y + (dy >= 0 ? pushDist : -pushDist)));
      }

      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Defeated! Lost ${goldLost} gold and supplies.`, "error");
      }
    } else if (this.result === 'fled') {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Escaped from ${raiderType.name}!`, "warning");
      }
    } else if (this.result === 'bribed') {
      this.raider.bribedCooldown = 3; // 3 days before they can attack again
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Bribed the ${raiderType.name} for safe passage.`, "info");
      }
    }

    this.active = false;
  }

  endCombat() {
    this.log = [];
    this.result = null;
    this.active = false;
    this.raider = null;

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
