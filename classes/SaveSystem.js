// SaveSystem.js — Single-slot localStorage save/load

const SAVE_KEY = 'bargainquest_save';
const SAVE_VERSION = 5;

class SaveSystem {
  static hasSave() {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  static deleteSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  static save() {
    try {
      const data = {
        version: SAVE_VERSION,
        timestamp: Date.now(),
        mapSeed: window._mapSeed || 0,
        cols: cols,
        rows: rows,
        landmass: typeof window._newGameLandmass === 'number' ? window._newGameLandmass : 1,
        gameSpeed: typeof gameSpeedIndex !== 'undefined' ? gameSpeedIndex : 2,

        player: {
          x: player.x,
          y: player.y,
          gold: player.gold,
          name: player.name || 'Captain',
          inventory: [...player.inventory].map(([k, v]) => [k, v.quantity]),
          party: player.party,
          direction: player.direction || 'down',
          hasWon: player.hasWon,
          cargoCapacity: player.cargoCapacity || 50,
          combatStrength: player.combatStrength || 3,
          equippedWeapon: player.equippedWeapon || null,
          fleet: player.fleet.map(b => b.toJSON()),
          activeBoatIndex: player.activeBoat ? player.fleet.indexOf(player.activeBoat) : -1,
          modifiers: player.modifiers || {},
          level: player.level || 1,
          xp: player.xp || 0,
          statPoints: player.statPoints || 0,
          bonusMaxHP: player.bonusMaxHP || 0,
          bonusAttack: player.bonusAttack || 0,
          bonusDefense: player.bonusDefense || 0,
        },

        dayNight: {
          timeOfDay: dayNight.timeOfDay,
          daysElapsed: dayNight.daysElapsed,
        },

        cities: cities.map(c => ({
          name: c.name,
          location: c.location,
          population: c.population,
          inventory: [...c.inventory].map(([k, v]) => [k, v.quantity]),
          holidays: c.holidays,
          bookHolidays: c.bookHolidays || [],
          stockedBooks: c.stockedBooks || [],
          priceHistory: c.priceHistory || {},
          buildingVariant: c.buildingVariant || 0,
          reputation: typeof c.reputation === 'number' ? c.reputation : 50,
          // v5 city features
          hasGamblingDen: c.hasGamblingDen || false,
          hasBank: c.hasBank || false,
          hasBlackMarket: c.hasBlackMarket || false,
          hasBountyBoard: c.hasBountyBoard || false,
        })),

        traders: typeof traderManager !== 'undefined' ? traderManager.toJSON() : [],
        raiders: typeof raiderManager !== 'undefined' ? raiderManager.toJSON() : [],
        events: typeof eventSystem !== 'undefined' ? eventSystem.toJSON() : {},

        // v5 new systems
        contractSystem: typeof contractSystem !== 'undefined' && contractSystem ? contractSystem.toJSON() : null,
        treasureSystem: typeof treasureSystem !== 'undefined' && treasureSystem ? treasureSystem.toJSON() : null,
        bankingSystem: typeof bankingSystem !== 'undefined' && bankingSystem ? bankingSystem.toJSON() : null,
        smugglingSystem: typeof smugglingSystem !== 'undefined' && smugglingSystem ? smugglingSystem.toJSON() : null,
        bountyBoard: typeof bountyBoard !== 'undefined' && bountyBoard ? bountyBoard.toJSON() : null,
        gamblingSystem: typeof gamblingSystem !== 'undefined' && gamblingSystem ? gamblingSystem.toJSON() : null,
      };

      const json = JSON.stringify(data);
      localStorage.setItem(SAVE_KEY, json);

      if (typeof notificationManager !== 'undefined') {
        notificationManager.log("Game saved.", "success");
      }
      return true;
    } catch (e) {
      console.error("Save failed:", e);
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log("Save failed!", "error");
      }
      return false;
    }
  }

  static load() {
    try {
      const json = localStorage.getItem(SAVE_KEY);
      if (!json) return false;

      const data = JSON.parse(json);
      if (!data || (data.version !== SAVE_VERSION && data.version !== 4 && data.version !== 3)) {
        console.warn("Save version mismatch or corrupt save.");
        return false;
      }

      // Restore map dimensions and seed
      cols = data.cols || 100;
      rows = data.rows || 100;
      window._mapSeed = data.mapSeed;

      // Restore landmass mode BEFORE terrain gen (critical for correct terrain)
      window._newGameLandmass = typeof data.landmass === 'number' ? data.landmass : 1;

      // Restore game speed
      if (typeof data.gameSpeed === 'number' && typeof SPEED_STEPS !== 'undefined') {
        gameSpeedIndex = data.gameSpeed;
        gameSpeed = SPEED_STEPS[gameSpeedIndex] || 1;
      }

      // Reset terrain arrays
      grid = [];
      elevationMap = [];
      difficultyMap = [];
      temperatureMap = [];

      noiseSeed(data.mapSeed);
      initTerrain();

      // Restore cities
      cities.length = 0;
      for (const cd of data.cities) {
        const city = new City({
          name: cd.name,
          location: cd.location,
          population: cd.population,
        });
        // Restore city features (v5)
        if (cd.hasGamblingDen !== undefined) city.hasGamblingDen = cd.hasGamblingDen;
        if (cd.hasBank !== undefined) city.hasBank = cd.hasBank;
        if (cd.hasBlackMarket !== undefined) city.hasBlackMarket = cd.hasBlackMarket;
        if (cd.hasBountyBoard !== undefined) city.hasBountyBoard = cd.hasBountyBoard;
        // Restore inventory
        city.inventory.clear();
        for (const [key, qty] of cd.inventory) {
          if (ItemLibrary[key]) {
            city.inventory.set(key, { item: ItemLibrary[key], quantity: qty });
          }
        }
        city.holidays = cd.holidays || [];
        city.bookHolidays = cd.bookHolidays || [];
        city.stockedBooks = cd.stockedBooks || [];
        city.priceHistory = cd.priceHistory || {};
        city.buildingVariant = cd.buildingVariant || 0;
        city.reputation = typeof cd.reputation === 'number' ? cd.reputation : 50;
        cities.push(city);
      }

      // Restore player
      player.x = data.player.x;
      player.y = data.player.y;
      player.gold = data.player.gold;
      player.name = data.player.name || 'Captain';
      player.inventory.clear();
      for (const [key, qty] of data.player.inventory) {
        if (ItemLibrary[key]) {
          player.inventory.set(key, { item: ItemLibrary[key], quantity: qty });
        }
      }
      player.party = data.player.party || [];
      player.direction = data.player.direction || 'down';
      player.hasWon = data.player.hasWon || false;
      player.cargoCapacity = data.player.cargoCapacity || 50;
      player.combatStrength = data.player.combatStrength || 3;
      player.equippedWeapon = data.player.equippedWeapon || null;

      // Restore leveling stats
      player.level = data.player.level || 1;
      player.xp = data.player.xp || 0;
      player.statPoints = data.player.statPoints || 0;
      player.bonusMaxHP = data.player.bonusMaxHP || 0;
      player.bonusAttack = data.player.bonusAttack || 0;
      player.bonusDefense = data.player.bonusDefense || 0;
      player.bonusMagic = data.player.bonusMagic || 0;
      player.bonusCharm = data.player.bonusCharm || 0;

      // Restore modifiers (or recalculate from inventory)
      if (data.player.modifiers) {
        player.modifiers = Object.assign({
          negotiationDiscount: 0,
          bribeCostReduction: 0,
          bribeCooldownBonus: 0,
        }, data.player.modifiers);
      }
      player.recalcModifiers(); // always recalc to be safe

      // Restore boat fleet
      player.fleet = (data.player.fleet || []).map(bd => Boat.fromJSON(bd));
      const abi = data.player.activeBoatIndex;
      player.activeBoat = (abi >= 0 && abi < player.fleet.length) ? player.fleet[abi] : null;
      player.isSailing = false;

      // Restore day/night
      dayNight.timeOfDay = data.dayNight.timeOfDay;
      dayNight.daysElapsed = data.dayNight.daysElapsed;

      // Restore traders
      if (data.traders && data.traders.length > 0) {
        traderManager = TraderManager.fromJSON(data.traders);
      }

      // Restore raiders
      if (data.raiders && data.raiders.length > 0) {
        raiderManager = RaiderManager.fromJSON(data.raiders);
      }

      // Restore events
      if (data.events) {
        eventSystem = EventSystem.fromJSON(data.events);
      }

      // Restore v5 new systems
      if (data.contractSystem && typeof ContractSystem !== 'undefined') {
        contractSystem = ContractSystem.fromJSON(data.contractSystem);
      } else if (typeof ContractSystem !== 'undefined') {
        contractSystem = new ContractSystem();
      }
      if (data.treasureSystem && typeof TreasureSystem !== 'undefined') {
        treasureSystem = TreasureSystem.fromJSON(data.treasureSystem);
      } else if (typeof TreasureSystem !== 'undefined') {
        treasureSystem = new TreasureSystem();
      }
      if (data.bankingSystem && typeof BankingSystem !== 'undefined') {
        bankingSystem = BankingSystem.fromJSON(data.bankingSystem);
      } else if (typeof BankingSystem !== 'undefined') {
        bankingSystem = new BankingSystem();
      }
      if (data.smugglingSystem && typeof SmugglingSystem !== 'undefined') {
        smugglingSystem = SmugglingSystem.fromJSON(data.smugglingSystem);
      } else if (typeof SmugglingSystem !== 'undefined') {
        smugglingSystem = new SmugglingSystem();
      }
      if (data.bountyBoard && typeof BountyBoard !== 'undefined') {
        bountyBoard = BountyBoard.fromJSON(data.bountyBoard);
      } else if (typeof BountyBoard !== 'undefined') {
        bountyBoard = new BountyBoard();
      }
      if (typeof MinigameManager !== 'undefined' && !minigameManager) {
        minigameManager = new MinigameManager();
      }
      if (data.gamblingSystem && typeof GamblingSystem !== 'undefined') {
        gamblingSystem = GamblingSystem.fromJSON(data.gamblingSystem);
      } else if (typeof GamblingSystem !== 'undefined') {
        gamblingSystem = new GamblingSystem();
      }

      if (typeof notificationManager !== 'undefined') {
        notificationManager.log("Game loaded.", "success");
      }
      return true;
    } catch (e) {
      console.error("Load failed:", e);
      return false;
    }
  }
}
