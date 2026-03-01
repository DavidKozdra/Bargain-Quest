// SaveSystem.js — Single-slot localStorage save/load

const SAVE_KEY = 'bargainquest_save';
const SAVE_VERSION = 2;

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

        player: {
          x: player.x,
          y: player.y,
          gold: player.gold,
          inventory: [...player.inventory].map(([k, v]) => [k, v.quantity]),
          party: player.party,
          direction: player.direction || 'down',
          hasWon: player.hasWon,
          cargoCapacity: player.cargoCapacity || 50,
          combatStrength: player.combatStrength || 3,
          fleet: player.fleet.map(b => b.toJSON()),
          activeBoatIndex: player.activeBoat ? player.fleet.indexOf(player.activeBoat) : -1,
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
          priceHistory: c.priceHistory || {},
        })),

        traders: typeof traderManager !== 'undefined' ? traderManager.toJSON() : [],
        raiders: typeof raiderManager !== 'undefined' ? raiderManager.toJSON() : [],
        events: typeof eventSystem !== 'undefined' ? eventSystem.toJSON() : {},
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
      if (!data || data.version !== SAVE_VERSION) {
        console.warn("Save version mismatch or corrupt save.");
        return false;
      }

      // Restore map dimensions and seed
      cols = data.cols || 100;
      rows = data.rows || 100;
      window._mapSeed = data.mapSeed;

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
        // Restore inventory
        city.inventory.clear();
        for (const [key, qty] of cd.inventory) {
          if (ItemLibrary[key]) {
            city.inventory.set(key, { item: ItemLibrary[key], quantity: qty });
          }
        }
        city.holidays = cd.holidays || [];
        city.priceHistory = cd.priceHistory || {};
        cities.push(city);
      }

      // Restore player
      player.x = data.player.x;
      player.y = data.player.y;
      player.gold = data.player.gold;
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
