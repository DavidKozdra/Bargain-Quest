// AchievementSystem.js — Persistent cross-playthrough achievement & stats tracking
// Stores lifetime stats and unlocked achievements in localStorage (separate from game save).
// Unlockable themes tied to achievements for meta-progression rewards.

class AchievementSystem {
  static STORAGE_KEY = 'bq_achievements_v1';

  constructor() {
    this._data = AchievementSystem._load();
    this._definitions = AchievementSystem._defineAchievements();
    this._justUnlocked = []; // queue for UI notifications

    // Listen for game events
    this._listeners = {
      questCompleted: (e) => this._onQuestCompleted(e.detail?.quest),
      dayChanged: () => this._onDayTick(),
    };
    for (const [evt, fn] of Object.entries(this._listeners)) {
      window.addEventListener(evt, fn);
    }
  }

  destroy() {
    for (const [evt, fn] of Object.entries(this._listeners)) {
      window.removeEventListener(evt, fn);
    }
  }

  // ─── Achievement Definitions ──────────────────────────────

  static _defineAchievements() {
    return [
      // ── Trading ──
      { id: 'first_trade', name: 'First Sale', description: 'Complete your first trade.', icon: '💰', category: 'trading', secret: false },
      { id: 'earn_1000', name: 'Pocket Change', description: 'Earn 1,000 gold in a single run.', icon: '🪙', category: 'trading', secret: false },
      { id: 'earn_5000', name: 'Wealthy Merchant', description: 'Earn 5,000 gold in a single run.', icon: '💎', category: 'trading', secret: false },
      { id: 'earn_10000', name: 'Trade Baron', description: 'Earn 10,000 gold in a single run.', icon: '👑', category: 'trading', secret: false },
      { id: 'lifetime_gold_50k', name: 'Golden Legacy', description: 'Earn 50,000 gold across all playthroughs.', icon: '🏦', category: 'trading', secret: false },
      { id: 'profit_500_single', name: 'Big Score', description: 'Make 500+ gold profit on a single trade.', icon: '📈', category: 'trading', secret: false },

      // ── Exploration ──
      { id: 'visit_5_cities', name: 'Wanderer', description: 'Visit 5 different cities in a single run.', icon: '🗺️', category: 'exploration', secret: false },
      { id: 'visit_all_cities', name: 'World Traveler', description: 'Visit every city on the map.', icon: '🌍', category: 'exploration', secret: false },
      { id: 'sail_100_tiles', name: 'Sea Dog', description: 'Sail 100 water tiles.', icon: '⛵', category: 'exploration', secret: false },
      { id: 'travel_1000_tiles', name: 'Marathon', description: 'Travel 1,000 tiles in a single run.', icon: '🏃', category: 'exploration', secret: false },

      // ── Combat ──
      { id: 'first_combat_win', name: 'First Blood', description: 'Win your first combat encounter.', icon: '⚔️', category: 'combat', secret: false },
      { id: 'win_10_combats', name: 'Veteran Fighter', description: 'Win 10 combat encounters.', icon: '🛡️', category: 'combat', secret: false },
      { id: 'survive_1hp', name: 'By a Thread', description: 'Survive a combat with 1 HP remaining.', icon: '💀', category: 'combat', secret: true },
      { id: 'bribe_raider', name: 'Silver Tongue', description: 'Successfully bribe a raider.', icon: '🤝', category: 'combat', secret: false },

      // ── Quests ──
      { id: 'first_quest', name: 'Adventurer', description: 'Complete your first quest.', icon: '📜', category: 'quests', secret: false },
      { id: 'complete_5_quests', name: 'Questmaster', description: 'Complete 5 quests.', icon: '🏅', category: 'quests', secret: false },
      { id: 'complete_10_quests', name: 'Legendary Adventurer', description: 'Complete 10 quests across all runs.', icon: '⭐', category: 'quests', secret: false },

      // ── Victory ──
      { id: 'first_win', name: 'Victor', description: 'Win the game for the first time.', icon: '🏆', category: 'victory', secret: false },
      { id: 'win_easy', name: 'Easy Sailing', description: 'Win on Easy difficulty.', icon: '🌊', category: 'victory', secret: false },
      { id: 'win_normal', name: 'Fair Trader', description: 'Win on Normal difficulty.', icon: '⚖️', category: 'victory', secret: false },
      { id: 'win_hard', name: 'Iron Will', description: 'Win on Hard difficulty.', icon: '🔥', category: 'victory', secret: false },
      { id: 'win_hardcore', name: 'Immortal', description: 'Win on Hardcore difficulty.', icon: '☠️', category: 'victory', secret: false, themeReward: 'crimson' },
      { id: 'speed_win_30', name: 'Speed Demon', description: 'Win in under 30 days.', icon: '⚡', category: 'victory', secret: false },
      { id: 'speed_win_20', name: 'Lightning Merchant', description: 'Win in under 20 days.', icon: '🌩️', category: 'victory', secret: true },
      { id: 'win_3_runs', name: 'Consistent', description: 'Win 3 separate runs.', icon: '🎯', category: 'victory', secret: false },
      { id: 'win_10_runs', name: 'Master Merchant', description: 'Win 10 separate runs.', icon: '🌟', category: 'victory', secret: false, themeReward: 'amethyst' },

      // ── Empire ──
      { id: 'own_city', name: 'Landlord', description: 'Own your first city.', icon: '🏰', category: 'empire', secret: false },
      { id: 'own_3_cities', name: 'Governor', description: 'Own 3 cities simultaneously.', icon: '🏛️', category: 'empire', secret: false },
      { id: 'own_5_cities', name: 'Emperor', description: 'Own 5 cities simultaneously.', icon: '👑', category: 'empire', secret: false, themeReward: 'emerald' },
      { id: 'become_king', name: 'King of the Realm', description: 'Achieve the title of King.', icon: '♔', category: 'empire', secret: true },

      // ── Space ──
      { id: 'first_launch', name: 'Liftoff', description: 'Launch into space for the first time.', icon: '🚀', category: 'space', secret: false },
      { id: 'visit_all_planets', name: 'Star Explorer', description: 'Visit all known planets.', icon: '🌌', category: 'space', secret: false, themeReward: 'ocean' },
      { id: 'alien_trader', name: 'First Contact', description: 'Trade with an alien civilization.', icon: '👽', category: 'space', secret: false },
      { id: 'space_profit', name: 'Cosmic Merchant', description: 'Earn 1,000 gold from space goods.', icon: '🛸', category: 'space', secret: false },

      // ── Minigames ──
      { id: 'win_dice_poker', name: 'Lucky Dice', description: 'Win a game of Dice Poker.', icon: '🎲', category: 'minigames', secret: false },
      { id: 'pick_lock', name: 'Locksmith', description: 'Successfully pick a lock.', icon: '🔓', category: 'minigames', secret: false },
      { id: 'win_5_minigames', name: 'Jack of All Trades', description: 'Win 5 different minigames.', icon: '🃏', category: 'minigames', secret: false },

      // ── Contracts ──
      { id: 'complete_10_contracts', name: 'Reliable', description: 'Complete 10 contracts.', icon: '📋', category: 'contracts', secret: false },
      { id: 'complete_25_contracts', name: 'Contract King', description: 'Complete 25 contracts across all runs.', icon: '📑', category: 'contracts', secret: false, themeReward: 'parchment' },

      // ── Misc / Secret ──
      { id: 'full_cargo', name: 'Packed to the Brim', description: 'Fill your cargo to 100% capacity.', icon: '📦', category: 'misc', secret: false },
      { id: 'collect_all_books', name: 'Scholar', description: 'Collect all 7 books in a single run.', icon: '📚', category: 'misc', secret: true },
      { id: 'starvation_survivor', name: 'Stubborn', description: 'Survive starvation damage 3 times.', icon: '🦴', category: 'misc', secret: true },
      { id: 'play_50_days', name: 'Long Haul', description: 'Play for 50 days in a single run.', icon: '📅', category: 'misc', secret: false },
      { id: 'ng_plus', name: 'New Game Plus', description: 'Start a New Game+ run.', icon: '🔄', category: 'misc', secret: false },
    ];
  }

  // ─── Data Persistence ─────────────────────────────────────

  static _load() {
    try {
      const raw = localStorage.getItem(AchievementSystem.STORAGE_KEY);
      if (!raw) return AchievementSystem._defaultData();
      const parsed = JSON.parse(raw);
      return { ...AchievementSystem._defaultData(), ...parsed };
    } catch (e) {
      return AchievementSystem._defaultData();
    }
  }

  static _defaultData() {
    return {
      unlocked: {},        // { achievementId: { ts: timestamp, runId: string } }
      lifetimeStats: {
        totalGold: 0,
        totalTrades: 0,
        totalTilesTraveled: 0,
        totalSeaTiles: 0,
        totalCombatWins: 0,
        totalBribes: 0,
        totalQuestsCompleted: 0,
        totalContractsCompleted: 0,
        totalMinigameWins: 0,
        totalWins: 0,
        totalRuns: 0,
        totalDaysPlayed: 0,
        bestSpeedWin: null,
        highestSingleTradeProfit: 0,
        minigameTypesWon: [],
        starvationsSurvived: 0,
        spaceGoldEarned: 0,
      },
      // Run-scoped stats (reset each new game, accumulated into lifetime on end)
      runStats: {
        goldEarned: 0,
        tradesMade: 0,
        tilesTraveled: 0,
        seaTiles: 0,
        combatWins: 0,
        bribes: 0,
        questsCompleted: 0,
        contractsCompleted: 0,
        minigameWins: 0,
        citiesVisited: [],
        daysPlayed: 0,
        singleTradeProfit: 0,
        starvationsSurvived: 0,
      },
      unlockedThemes: [],  // theme keys unlocked via achievements
      ngPlusCount: 0,      // how many NG+ runs started
      ngPlusBonuses: [],   // persistent bonuses from NG+ (e.g. ['keep_book_MarketAnalysis'])
    };
  }

  _save() {
    try {
      localStorage.setItem(AchievementSystem.STORAGE_KEY, JSON.stringify(this._data));
    } catch (e) {
      // Ignore storage failures
    }
  }

  // ─── Event Tracking ───────────────────────────────────────

  /** Call when a trade is completed. */
  recordTrade(profit) {
    this._data.runStats.tradesMade++;
    this._data.runStats.goldEarned += Math.max(0, profit);
    this._data.runStats.singleTradeProfit = Math.max(this._data.runStats.singleTradeProfit, profit);
    this._data.lifetimeStats.totalTrades++;
    this._data.lifetimeStats.totalGold += Math.max(0, profit);
    this._data.lifetimeStats.highestSingleTradeProfit = Math.max(
      this._data.lifetimeStats.highestSingleTradeProfit, profit
    );

    if (this._data.runStats.tradesMade === 1) this._tryUnlock('first_trade');
    if (profit >= 500) this._tryUnlock('profit_500_single');
    this._checkGoldAchievements();
    this._save();
  }

  /** Call when player moves a tile. */
  recordTileMove(isWater = false) {
    this._data.runStats.tilesTraveled++;
    this._data.lifetimeStats.totalTilesTraveled++;
    if (isWater) {
      this._data.runStats.seaTiles++;
      this._data.lifetimeStats.totalSeaTiles++;
      if (this._data.runStats.seaTiles >= 100) this._tryUnlock('sail_100_tiles');
    }
    if (this._data.runStats.tilesTraveled >= 1000) this._tryUnlock('travel_1000_tiles');
    // Save periodically, not every tile
    if (this._data.runStats.tilesTraveled % 50 === 0) this._save();
  }

  /** Call when combat is won. */
  recordCombatWin(remainingHP) {
    this._data.runStats.combatWins++;
    this._data.lifetimeStats.totalCombatWins++;
    if (this._data.runStats.combatWins === 1) this._tryUnlock('first_combat_win');
    if (this._data.lifetimeStats.totalCombatWins >= 10) this._tryUnlock('win_10_combats');
    if (remainingHP === 1) this._tryUnlock('survive_1hp');
    this._save();
  }

  /** Call when a raider is bribed. */
  recordBribe() {
    this._data.runStats.bribes++;
    this._data.lifetimeStats.totalBribes++;
    this._tryUnlock('bribe_raider');
    this._save();
  }

  /** Call when a city is visited. */
  recordCityVisit(cityName) {
    if (!this._data.runStats.citiesVisited.includes(cityName)) {
      this._data.runStats.citiesVisited.push(cityName);
      if (this._data.runStats.citiesVisited.length >= 5) this._tryUnlock('visit_5_cities');
      if (typeof cities !== 'undefined' && this._data.runStats.citiesVisited.length >= cities.length) {
        this._tryUnlock('visit_all_cities');
      }
    }
    this._save();
  }

  /** Call when a contract is completed. */
  recordContractComplete() {
    this._data.runStats.contractsCompleted++;
    this._data.lifetimeStats.totalContractsCompleted++;
    if (this._data.lifetimeStats.totalContractsCompleted >= 10) this._tryUnlock('complete_10_contracts');
    if (this._data.lifetimeStats.totalContractsCompleted >= 25) this._tryUnlock('complete_25_contracts');
    this._save();
  }

  /** Call when a minigame is won. */
  recordMinigameWin(minigameType) {
    this._data.runStats.minigameWins++;
    this._data.lifetimeStats.totalMinigameWins++;
    if (!this._data.lifetimeStats.minigameTypesWon.includes(minigameType)) {
      this._data.lifetimeStats.minigameTypesWon.push(minigameType);
    }
    if (minigameType === 'dicePoker') this._tryUnlock('win_dice_poker');
    if (minigameType === 'lockpicking') this._tryUnlock('pick_lock');
    if (this._data.lifetimeStats.minigameTypesWon.length >= 5) this._tryUnlock('win_5_minigames');
    this._save();
  }

  /** Call when player launches to space. */
  recordSpaceLaunch() {
    this._tryUnlock('first_launch');
    this._save();
  }

  /** Call when all planets have been visited. */
  recordPlanetVisit() {
    if (typeof player !== 'undefined') {
      const catalog = typeof City !== 'undefined' && City.getSpacePlanets ? City.getSpacePlanets() : [];
      if (catalog.length > 0 && player.spaceTravel?.visitedPlanets?.length >= catalog.length) {
        this._tryUnlock('visit_all_planets');
      }
    }
    this._save();
  }

  /** Call when an alien trade is made. */
  recordAlienTrade(goldAmount) {
    this._tryUnlock('alien_trader');
    this._data.lifetimeStats.spaceGoldEarned += goldAmount;
    if (this._data.lifetimeStats.spaceGoldEarned >= 1000) this._tryUnlock('space_profit');
    this._save();
  }

  /** Call when the player starves and survives. */
  recordStarvationSurvived() {
    this._data.runStats.starvationsSurvived++;
    this._data.lifetimeStats.starvationsSurvived++;
    if (this._data.runStats.starvationsSurvived >= 3) this._tryUnlock('starvation_survivor');
    this._save();
  }

  /** Call when a city is purchased. */
  recordCityOwned(count) {
    if (count >= 1) this._tryUnlock('own_city');
    if (count >= 3) this._tryUnlock('own_3_cities');
    if (count >= 5) this._tryUnlock('own_5_cities');
    this._save();
  }

  /** Call when the game is won. */
  recordWin(days, difficulty) {
    this._data.lifetimeStats.totalWins++;
    this._tryUnlock('first_win');
    if (this._data.lifetimeStats.totalWins >= 3) this._tryUnlock('win_3_runs');
    if (this._data.lifetimeStats.totalWins >= 10) this._tryUnlock('win_10_runs');

    if (difficulty === 'easy') this._tryUnlock('win_easy');
    if (difficulty === 'normal') this._tryUnlock('win_normal');
    if (difficulty === 'hard') this._tryUnlock('win_hard');
    if (difficulty === 'hardcore') this._tryUnlock('win_hardcore');

    if (typeof days === 'number') {
      if (days <= 30) this._tryUnlock('speed_win_30');
      if (days <= 20) this._tryUnlock('speed_win_20');
      if (this._data.lifetimeStats.bestSpeedWin === null || days < this._data.lifetimeStats.bestSpeedWin) {
        this._data.lifetimeStats.bestSpeedWin = days;
      }
    }
    this._save();
  }

  /** Call when NG+ is started. */
  recordNGPlus() {
    this._data.ngPlusCount++;
    this._tryUnlock('ng_plus');
    this._save();
  }

  /** Reset run-scoped stats for a new game. */
  resetRunStats() {
    this._data.lifetimeStats.totalRuns++;
    this._data.runStats = AchievementSystem._defaultData().runStats;
    this._save();
  }

  // ─── Quest event handler ──────────────────────────────────

  _onQuestCompleted(quest) {
    if (!quest) return;
    this._data.runStats.questsCompleted++;
    this._data.lifetimeStats.totalQuestsCompleted++;
    if (this._data.runStats.questsCompleted >= 1) this._tryUnlock('first_quest');
    if (this._data.runStats.questsCompleted >= 5) this._tryUnlock('complete_5_quests');
    if (this._data.lifetimeStats.totalQuestsCompleted >= 10) this._tryUnlock('complete_10_quests');
    this._save();
  }

  // ─── Day tick: check conditional achievements ─────────────

  _onDayTick() {
    this._data.runStats.daysPlayed++;
    this._data.lifetimeStats.totalDaysPlayed++;

    if (this._data.runStats.daysPlayed >= 50) this._tryUnlock('play_50_days');

    // Check inventory-based achievements
    if (typeof player !== 'undefined') {
      // Full cargo
      if (typeof player.getCargoWeight === 'function' && typeof player.getEffectiveCargoCapacity === 'function') {
        if (player.getCargoWeight() >= player.getEffectiveCargoCapacity()) {
          this._tryUnlock('full_cargo');
        }
      }
      // All books
      const bookKeys = ['MarketAnalysis', 'HolidaysBook', 'NegotiationForDummies', 'ConflictResolution', 'TreasureHunter', 'SeaLegs', 'Pirating101'];
      if (bookKeys.every(k => player.inventory.has(k))) {
        this._tryUnlock('collect_all_books');
      }
      // King achievement
      if (player.isKing) this._tryUnlock('become_king');

      // City ownership
      if (player.ownedCities?.length > 0) {
        this.recordCityOwned(player.ownedCities.length);
      }
    }

    this._checkGoldAchievements();

    // Save periodically
    if (this._data.runStats.daysPlayed % 5 === 0) this._save();
  }

  _checkGoldAchievements() {
    const gold = this._data.runStats.goldEarned;
    if (gold >= 1000) this._tryUnlock('earn_1000');
    if (gold >= 5000) this._tryUnlock('earn_5000');
    if (gold >= 10000) this._tryUnlock('earn_10000');
    if (this._data.lifetimeStats.totalGold >= 50000) this._tryUnlock('lifetime_gold_50k');
  }

  // ─── Unlock Logic ─────────────────────────────────────────

  _tryUnlock(achievementId) {
    if (this._data.unlocked[achievementId]) return false;

    const def = this._definitions.find(a => a.id === achievementId);
    if (!def) return false;

    this._data.unlocked[achievementId] = {
      ts: Date.now(),
      runId: window._mapSeed || 'unknown',
    };

    // Check for theme reward
    if (def.themeReward && !this._data.unlockedThemes.includes(def.themeReward)) {
      this._data.unlockedThemes.push(def.themeReward);
    }

    this._justUnlocked.push(def);
    this._save();

    // Show notification
    if (typeof notificationManager !== 'undefined') {
      const secretTag = def.secret ? ' (Secret!)' : '';
      notificationManager.log(`Achievement Unlocked: ${def.icon} ${def.name}${secretTag}`, 'success');
      if (def.themeReward) {
        notificationManager.log(`Theme unlocked: "${def.themeReward}"!`, 'success');
      }
    }

    return true;
  }

  // ─── Public API ───────────────────────────────────────────

  /** Get all achievement definitions with unlock status. */
  getAll() {
    return this._definitions.map(def => ({
      ...def,
      unlocked: !!this._data.unlocked[def.id],
      unlockedAt: this._data.unlocked[def.id]?.ts || null,
    }));
  }

  /** Get achievements filtered by category. */
  getByCategory(category) {
    return this.getAll().filter(a => a.category === category);
  }

  /** Get count of unlocked achievements. */
  getUnlockedCount() {
    return Object.keys(this._data.unlocked).length;
  }

  /** Get total achievement count. */
  getTotalCount() {
    return this._definitions.length;
  }

  /** Get progress percentage. */
  getProgressPercent() {
    return Math.round((this.getUnlockedCount() / this.getTotalCount()) * 100);
  }

  /** Get recently unlocked (for popup/toast display). */
  popJustUnlocked() {
    const batch = this._justUnlocked.slice();
    this._justUnlocked.length = 0;
    return batch;
  }

  /** Get lifetime stats. */
  getLifetimeStats() {
    return { ...this._data.lifetimeStats };
  }

  /** Get run stats. */
  getRunStats() {
    return { ...this._data.runStats };
  }

  /** Check if a specific theme has been unlocked. */
  isThemeUnlocked(themeKey) {
    return this._data.unlockedThemes.includes(themeKey);
  }

  /** Get all unlocked themes. */
  getUnlockedThemes() {
    return this._data.unlockedThemes.slice();
  }

  /** NG+ data accessors */
  getNGPlusCount() {
    return this._data.ngPlusCount;
  }

  getNGPlusBonuses() {
    return this._data.ngPlusBonuses.slice();
  }

  addNGPlusBonus(bonus) {
    if (!this._data.ngPlusBonuses.includes(bonus)) {
      this._data.ngPlusBonuses.push(bonus);
      this._save();
    }
  }

  /** Hard reset — clears all achievement data. Use with caution. */
  static resetAll() {
    try {
      localStorage.removeItem(AchievementSystem.STORAGE_KEY);
    } catch (e) {}
  }
}
