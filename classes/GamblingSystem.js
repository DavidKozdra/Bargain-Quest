// GamblingSystem.js — Gambling den management (city feature)
// Wraps MinigameManager's dice poker, memory match, and wheel of fortune

class GamblingSystem {
  constructor() {
    this.sessionsPlayed = 0;
    this.totalWon = 0;
    this.totalLost = 0;
  }

  /** Check if a city has a gambling den */
  static cityHasGamblingDen(city) {
    return city && city.hasGamblingDen === true;
  }

  // ─── Game launchers ─────────────────────────────────────

  /** Launch dice poker at a gambling den. Bet is deducted up-front. */
  playDicePoker(bet, onComplete) {
    if (!this._validateBet(bet, 10, 200)) return false;

    player.spendGold(bet);
    this.sessionsPlayed++;

    if (typeof minigameManager !== 'undefined') {
      minigameManager.launch('dicePoker', { bet }, (result) => {
        this._resolveDicePoker(result);
        if (onComplete) onComplete(result);
      });
      if (typeof gameStateManager !== 'undefined') {
        gameStateManager.setState(GameStates.MINIGAME);
      }
    }
    return true;
  }

  /** Launch memory match. Entry fee deducted up-front. */
  playMemoryMatch(onComplete) {
    const fee = 50;
    if (!this._validateBet(fee, fee, fee)) return false;

    player.spendGold(fee);
    this.sessionsPlayed++;

    if (typeof minigameManager !== 'undefined') {
      minigameManager.launch('memoryMatch', { entryFee: fee }, (result) => {
        this._resolveMemoryMatch(result);
        if (onComplete) onComplete(result);
      });
      if (typeof gameStateManager !== 'undefined') {
        gameStateManager.setState(GameStates.MINIGAME);
      }
    }
    return true;
  }

  /** Launch wheel of fortune. Bet deducted up-front. */
  playWheelOfFortune(bet, onComplete) {
    if (!this._validateBet(bet, 10, 100)) return false;

    player.spendGold(bet);
    this.sessionsPlayed++;

    if (typeof minigameManager !== 'undefined') {
      minigameManager.launch('wheelOfFortune', { bet }, (result) => {
        this._resolveWheel(result);
        if (onComplete) onComplete(result);
      });
      if (typeof gameStateManager !== 'undefined') {
        gameStateManager.setState(GameStates.MINIGAME);
      }
    }
    return true;
  }

  // ─── Resolution ─────────────────────────────────────────

  _resolveDicePoker(result) {
    if (!result) return;
    if (result.winnings > 0) {
      player.earnGold(result.winnings);
      this.totalWon += result.winnings;
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`🎲 ${result.hand}! Won ${result.winnings}g (profit: ${result.profit}g)`, result.profit > 0 ? 'success' : 'info');
      }
    } else {
      this.totalLost += result.bet;
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`🎲 ${result.hand}... Lost ${result.bet}g!`, 'error');
      }
    }
    this._returnToGamblingDen();
  }

  _resolveMemoryMatch(result) {
    if (!result) return;
    if (result.totalWon > 0) {
      player.earnGold(result.totalWon);
      this.totalWon += result.totalWon;
      if (typeof notificationManager !== 'undefined') {
        const msg = result.profit >= 0
          ? `🃏 Memory match! Won ${result.totalWon}g (profit: ${result.profit}g)`
          : `🃏 Memory match over. Won ${result.totalWon}g but paid ${result.entryFee}g entry (net: ${result.profit}g)`;
        notificationManager.log(msg, result.profit >= 0 ? 'success' : 'warning');
      }
    } else {
      this.totalLost += result.entryFee;
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`🃏 No matches found! Lost ${result.entryFee}g entry fee.`, 'error');
      }
    }
    this._returnToGamblingDen();
  }

  _resolveWheel(result) {
    if (!result) return;
    if (result.winnings > 0) {
      player.earnGold(result.winnings);
      this.totalWon += result.winnings;
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`🎡 ${result.segment}! Won ${result.winnings}g!`, result.profit > 0 ? 'success' : 'info');
      }
    } else if (result.winnings < 0) {
      // Negative multiplier — player loses MORE than their bet
      const extraLoss = Math.abs(result.winnings);
      const actualExtra = Math.min(extraLoss, player.gold); // can't go below 0 gold
      if (actualExtra > 0) player.spendGold(actualExtra);
      this.totalLost += result.bet + actualExtra;
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`🎡 ${result.segment}! Lost ${result.bet + actualExtra}g total!`, 'error');
      }
    } else {
      this.totalLost += result.bet;
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`🎡 ${result.segment}... Lost ${result.bet}g!`, 'error');
      }
    }
    this._returnToGamblingDen();
  }

  _returnToGamblingDen() {
    if (typeof gameStateManager !== 'undefined' && gameStateManager.is(GameStates.MINIGAME)) {
      gameStateManager.setState(GameStates.GAMBLING);
    }
  }

  // ─── Helpers ────────────────────────────────────────────

  _validateBet(bet, min, max) {
    if (typeof player === 'undefined') return false;
    if (bet < min || bet > max) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Bet must be between ${min}g and ${max}g.`, 'warning');
      }
      return false;
    }
    if (player.gold < bet) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Not enough gold! You have ${player.gold}g.`, 'warning');
      }
      return false;
    }
    return true;
  }

  // ─── Stats ──────────────────────────────────────────────

  getStats() {
    return {
      sessionsPlayed: this.sessionsPlayed,
      totalWon: this.totalWon,
      totalLost: this.totalLost,
      netProfit: this.totalWon - this.totalLost,
    };
  }

  toJSON() {
    return {
      sessionsPlayed: this.sessionsPlayed,
      totalWon: this.totalWon,
      totalLost: this.totalLost,
    };
  }

  static fromJSON(data) {
    const gs = new GamblingSystem();
    gs.sessionsPlayed = data.sessionsPlayed || 0;
    gs.totalWon = data.totalWon || 0;
    gs.totalLost = data.totalLost || 0;
    return gs;
  }
}
