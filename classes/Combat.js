// Combat.js — Turn-based tactical combat system

class CombatSystem {
  constructor() {
    this.active = false;
    this.raider = null;
    this.playerHP = 0;
    this.raiderHP = 0;
    this.log = [];
    this.turnCount = 0;
    this.result = null; // 'win', 'lose', 'fled', 'bribed'
    this.onComplete = null;
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
    this.playerHP = this.getPlayerStrength() * 2;
    this.raiderHP = raider.strength * 2;
    this.log = [];
    this.turnCount = 0;
    this.result = null;

    this.addLog(`You encounter a raider band (Strength: ${raider.strength})!`);
    this.addLog(`Choose your action.`);

    gameStateManager.setState(GameStates.COMBAT);
  }

  getPlayerStrength() {
    let str = 3; // base
    str += player.party.length; // +1 per party member

    // Weapons bonus
    if (player.inventory.has('Sword')) str += 2;
    if (player.inventory.has('Tools')) str += 1;

    return str;
  }

  // Player chooses to fight
  doFight() {
    this.turnCount++;
    const playerStr = this.getPlayerStrength();
    const raiderStr = this.raider.strength;

    const playerRoll = Math.floor(Math.random() * 6) + 1 + playerStr;
    const raiderRoll = Math.floor(Math.random() * 6) + 1 + raiderStr;

    this.addLog(`--- Round ${this.turnCount} ---`);
    this.addLog(`You roll ${playerRoll} (d6+${playerStr}) vs Raiders ${raiderRoll} (d6+${raiderStr})`);

    if (playerRoll > raiderRoll) {
      const dmg = playerRoll - raiderRoll;
      this.raiderHP -= dmg;
      this.addLog(`You strike for ${dmg} damage! Raiders HP: ${Math.max(0, this.raiderHP)}`);
    } else if (raiderRoll > playerRoll) {
      const dmg = raiderRoll - playerRoll;
      this.playerHP -= dmg;
      this.addLog(`Raiders hit you for ${dmg} damage! Your HP: ${Math.max(0, this.playerHP)}`);
    } else {
      this.addLog(`Clash! No damage dealt.`);
    }

    // Check victory/defeat
    if (this.raiderHP <= 0) {
      this.result = 'win';
      this.addLog(`Victory! The raiders are defeated.`);
      this.resolveCombat();
    } else if (this.playerHP <= 0) {
      this.result = 'lose';
      this.addLog(`Defeat! The raiders overwhelm you.`);
      this.resolveCombat();
    }
  }

  // Player chooses to flee
  doFlee() {
    const terrain = grid[player.y]?.[player.x]?.options[0] || 'Grass';
    let fleeChance = 0.4;

    // Terrain modifiers
    if (terrain === 'Forest') fleeChance = 0.65;
    if (terrain === 'Grass') fleeChance = 0.5;
    if (terrain === 'Sand') fleeChance = 0.35;
    if (terrain === 'Rock') fleeChance = 0.3;
    if (terrain === 'Snow') fleeChance = 0.25;

    this.addLog(`You attempt to flee... (${Math.floor(fleeChance * 100)}% chance on ${terrain})`);

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
      this.addLog(`Failed to flee! The raiders catch you.`);
      // Raiders get a free hit
      const raiderRoll = Math.floor(Math.random() * 6) + 1 + this.raider.strength;
      const dmg = Math.max(1, raiderRoll - 3);
      this.playerHP -= dmg;
      this.addLog(`Raiders strike for ${dmg} damage! Your HP: ${Math.max(0, this.playerHP)}`);

      if (this.playerHP <= 0) {
        this.result = 'lose';
        this.addLog(`You collapse from the blow.`);
        this.resolveCombat();
      }
    }
  }

  // Player chooses to bribe
  doBribe() {
    const cost = this.raider.strength * (15 + Math.floor(Math.random() * 15));
    this.addLog(`The raiders demand ${cost} gold for safe passage.`);

    if (player.gold >= cost) {
      player.spendGold(cost);
      this.result = 'bribed';
      this.addLog(`You pay ${cost} gold. The raiders let you pass.`);
      this.resolveCombat();
    } else {
      this.addLog(`You don't have enough gold! They attack!`);
      // Free hit from raiders
      const raiderRoll = Math.floor(Math.random() * 6) + 1 + this.raider.strength;
      const dmg = Math.max(1, raiderRoll - 2);
      this.playerHP -= dmg;
      this.addLog(`Raiders strike for ${dmg} damage! Your HP: ${Math.max(0, this.playerHP)}`);

      if (this.playerHP <= 0) {
        this.result = 'lose';
        this.resolveCombat();
      }
    }
  }

  resolveCombat() {
    if (this.result === 'win') {
      // Collect loot
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
      // Lose items and gold
      const goldLost = Math.min(player.gold, Math.floor(player.gold * (0.1 + Math.random() * 0.2)));
      player.gold -= goldLost;
      this.addLog(`Lost ${goldLost} gold.`);

      // Lose 1-3 random items
      const loseCount = 1 + Math.floor(Math.random() * 2);
      const items = [...player.inventory.keys()];
      for (let i = 0; i < loseCount && items.length > 0; i++) {
        const idx = Math.floor(Math.random() * items.length);
        const itemKey = items[idx];
        player.removeItem({ name: itemKey });
        items.splice(idx, 1);
        this.addLog(`Raiders stole 1 ${itemKey}.`);
      }

      // Raider moves away after winning — prevents instant re-trigger
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
        notificationManager.log("You escaped the raiders!", "warning");
      }
    } else if (this.result === 'bribed') {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log("Bribed the raiders for safe passage.", "info");
      }
    }

    // Delay return to playing to let player read
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
