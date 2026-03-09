// CityManagement.js — controller for city-management mode
// Works with existing City objects; adds happiness, food tracking, demand quests,
// victory condition, and per-frame ticking of all cities.

class CityManagement {
  constructor(world, services = {}) {
    this.world = world || window;
    this.services = services || {};
    this.selectedCity = null;       // City object currently being managed (panel open)
    this.selectedCityIndex = -1;

    // Player-becomes-city: two-phase system
    this.myCity = null;             // The player IS this city after settling
    this.myCityIndex = -1;
    this.isSettled = false;         // false = placement phase, true = management phase

    // Demand quests: { cityIndex, itemName, qtyNeeded, qtyDelivered, reward, deadline }
    this.demandQuests = [];
    this._nextQuestDay = 3;         // first quest spawns on day 3
    this._questInterval = 5;        // new quest every ~5 days

    // Victory: richest for N consecutive days
    this.richestStreak = 0;
    this.victoryDays = 10;
    this.won = false;

    // Tracking
    this._lastProcessedDay = -1;
    this._lastWeekDay = -1;

    // City events
    this._activeCityEvent = null;
    this._nextEventDay = 5;         // first event on day 5
    this._cityEventTimer = null;    // wall-clock timeout handle

    // Global wealth ranking (recalculated daily)
    this.wealthRanking = [];        // [{name, wealth, isPlayer}]
    this.playerWealth = 0;

    // Unit management (active manager mirrors selected city's unit list)
    this.unitManager = (typeof CityUnitManager !== 'undefined') ? new CityUnitManager() : null;
    this._unitCityRef = null;
    this._nextUnitId = 1;
    this._lastUnitCombatNotifyMs = 0;
    this._unitBaseCost = 140;
    this._unitBaseCap = 12;
    this._unitCombatCooldownMs = 2200;
    this._unitRetaliationBaseChance = 0.26;
    this._unitCombatFeed = [];
    this._warQteBuff = null; // { grade, score, winBonus, lootBonus, expiresAt }
    this._nextAIDecisionDay = 4;
    this._activeCampaigns = [];
    this._nextCampaignId = 1;
  }

  _getNotifier() {
    return this.services.notificationManager
      || this.world.notificationManager
      || (typeof notificationManager !== 'undefined' ? notificationManager : null);
  }

  _getGameStateManager() {
    return this.services.gameStateManager
      || this.world.gameStateManager
      || (typeof gameStateManager !== 'undefined' ? gameStateManager : null);
  }

  _getGameStates() {
    return this.services.GameStates
      || this.world.GameStates
      || (typeof GameStates !== 'undefined' ? GameStates : null);
  }

  _getDayNight() {
    return this.services.dayNight
      || this.world.dayNight
      || (typeof dayNight !== 'undefined' ? dayNight : null);
  }

  _getMinigameManager() {
    return this.services.minigameManager
      || this.world.minigameManager
      || (typeof minigameManager !== 'undefined' ? minigameManager : null);
  }

  _getRaiderManager() {
    return this.services.raiderManager
      || this.world.raiderManager
      || (typeof raiderManager !== 'undefined' ? raiderManager : null);
  }

  _getPlayerRef() {
    return this.services.player
      || this.world.player
      || (typeof player !== 'undefined' ? player : null);
  }

  _getPlayerUnitPowerBaseline() {
    const p = this._getPlayerRef();
    if (!p) return 8;

    const weaponDamageByName = {
      Fists: 0,
      Dagger: 1,
      Sword: 2,
      Axe: 3,
      Bow: 2,
      Crossbow: 3,
      Staff: 2,
    };

    const partyCount = Array.isArray(p.party) ? p.party.length : 0;
    const inventoryHas = (key) => !!(p.inventory && typeof p.inventory.has === 'function' && p.inventory.has(key));
    const equippedWeapon = (typeof p.equippedWeapon === 'string' && p.equippedWeapon.trim()) ? p.equippedWeapon : 'Fists';
    const weaponDamage = Number(weaponDamageByName[equippedWeapon] || 0);
    const hasToolsBonus = inventoryHas('Tools') ? 1 : 0;

    const baseAttack = 3 + Math.min(3, partyCount) + hasToolsBonus + weaponDamage + Math.max(0, Number(p.bonusAttack) || 0);
    const baseDefense = 2 + Math.max(0, Number(p.bonusDefense) || 0);
    const maxHp = (typeof p.getMaxHP === 'function') ? p.getMaxHP() : (10 + Math.max(0, Number(p.bonusMaxHP) || 0));
    const level = Math.max(1, Number(p.level) || 1);

    return baseAttack + (baseDefense * 0.9) + (Math.max(6, maxHp) / 8) + (level * 0.4);
  }

  _notify(message, type = 'info') {
    const notifier = this._getNotifier();
    if (notifier && typeof notifier.log === 'function') notifier.log(message, type);
  }

  _pushUnitFeed(message, type = 'info') {
    this._unitCombatFeed.unshift({
      ts: Date.now(),
      type,
      message,
    });
    if (this._unitCombatFeed.length > 12) this._unitCombatFeed.length = 12;
  }

  getUnitCombatFeed() {
    return this._unitCombatFeed.slice(0, 8);
  }

  _setState(state) {
    const gsm = this._getGameStateManager();
    const gs = this._getGameStates();
    if (!gsm || typeof gsm.setState !== 'function') return;
    if (gs && typeof gsm.is === 'function') {
      const inEndState = gsm.is(gs.GAMEWON) || gsm.is(gs.GAMELOSE);
      const wantsTransientCityState =
        state === gs.CITY_MANAGE
        || state === gs.MINIGAME
        || state === gs.RANDOM_EVENT;
      if (inEndState && wantsTransientCityState) return;
    }
    gsm.setState(state);
  }

  _getDaysElapsed() {
    const dn = this._getDayNight();
    if (!dn) return 0;
    if (typeof dn.getDaysElapsed === 'function') return dn.getDaysElapsed();
    return typeof dn.daysElapsed === 'number' ? dn.daysElapsed : 0;
  }

  _getCurrentGameTimeMs() {
    const dn = this._getDayNight();
    if (!dn) return 0;
    const cycleSeconds = (typeof dn.dayCycleLength === 'number' && dn.dayCycleLength > 0)
      ? dn.dayCycleLength
      : (typeof CYCLEVALUE === 'number' && CYCLEVALUE > 0 ? CYCLEVALUE : 120);
    const dayMs = cycleSeconds * 1000;
    const daysElapsed = (typeof dn.daysElapsed === 'number')
      ? dn.daysElapsed
      : (typeof dn.getDaysElapsed === 'function' ? dn.getDaysElapsed() : 0);
    const timeOfDay = (typeof dn.timeOfDay === 'number') ? dn.timeOfDay : 0;
    const dayFraction = Math.max(0, Math.min(1, timeOfDay / (Math.PI * 2)));
    return (daysElapsed * dayMs) + (dayFraction * dayMs);
  }

  _clearCityEventTimer() {
    if (this._cityEventTimer) {
      clearTimeout(this._cityEventTimer);
      this._cityEventTimer = null;
    }
  }

  _ensureManagement(city) {
    if (!city) return null;
    const m = (city.management && typeof city.management === 'object') ? city.management : {};
    const rawUnits = Array.isArray(m.units) ? m.units : [];
    const units = rawUnits
      .map((u) => ({
        id: Number.isFinite(Number(u?.id)) ? Number(u.id) : null,
        x: Math.floor(Number(u?.x) || 0),
        y: Math.floor(Number(u?.y) || 0),
        name: (typeof u?.name === 'string' && u.name.trim()) ? u.name.trim() : `Unit #${Math.floor(Math.random() * 10000)}`,
        hp: Math.max(1, Math.floor(Number(u?.hp) || 10)),
        maxHp: Math.max(1, Math.floor(Number(u?.maxHp) || 10)),
        attack: Math.max(1, Math.floor(Number(u?.attack) || 2)),
        defense: Math.max(0, Math.floor(Number(u?.defense) || 1)),
        state: (u?.state === 'moving' || u?.state === 'fighting') ? u.state : 'idle',
        direction: (u?.direction === 'left' || u?.direction === 'right' || u?.direction === 'up') ? u.direction : 'down',
        classKey: (typeof u?.classKey === 'string' && u.classKey.trim()) ? u.classKey : 'militia',
        movementType: (u?.movementType === 'naval') ? 'naval' : 'land',
        level: Math.max(1, Math.floor(Number(u?.level) || 1)),
        xp: Math.max(0, Math.floor(Number(u?.xp) || 0)),
        kills: Math.max(0, Math.floor(Number(u?.kills) || 0)),
        target: (u?.target && Number.isFinite(Number(u.target.x)) && Number.isFinite(Number(u.target.y)))
          ? { x: Math.floor(Number(u.target.x)), y: Math.floor(Number(u.target.y)) }
          : null,
      }))
      .filter((u) => Number.isFinite(u.x) && Number.isFinite(u.y));
    city.management = {
      budget: Math.max(0, Math.floor(Number(m.budget) || 0)),
      taxRate: Math.max(0, Math.min(0.5, Number.isFinite(Number(m.taxRate)) ? Number(m.taxRate) : 0.05)),
      buildingQueue: Array.isArray(m.buildingQueue) ? m.buildingQueue : [],
      upgradeLevels: (m.upgradeLevels && typeof m.upgradeLevels === 'object') ? m.upgradeLevels : {},
      routes: Array.isArray(m.routes) ? m.routes : [],
      units,
    };
    for (const u of units) {
      if (Number.isFinite(u.id)) this._nextUnitId = Math.max(this._nextUnitId, u.id + 1);
    }
    return city.management;
  }

  _loadUnitsForCity(city) {
    if (!this.unitManager) return;
    this._ensureManagement(city);
    this.unitManager.clear();
    const raw = city?.management?.units || [];
    for (const entry of raw) {
      let unit = null;
      if (typeof CityUnit !== 'undefined' && typeof CityUnit.fromJSON === 'function') {
        unit = CityUnit.fromJSON(entry, city);
      } else if (typeof CityUnit !== 'undefined') {
        unit = new CityUnit({ city, location: { x: entry.x, y: entry.y }, name: entry.name, id: entry.id });
      }
      if (!unit) continue;
      if (!Number.isFinite(unit.id)) {
        unit.id = this._nextUnitId++;
      } else {
        this._nextUnitId = Math.max(this._nextUnitId, unit.id + 1);
      }
      unit.city = city;
      this.unitManager.add(unit);
    }
    this._unitCityRef = city;
  }

  _persistUnitsForCity(city) {
    if (!city || !this.unitManager) return;
    this._ensureManagement(city);
    city.management.units = this.unitManager.toJSON();
  }

  _scheduleActiveCityEventTimeout() {
    this._clearCityEventTimer();
    if (!this._activeCityEvent) return;
    const remainingMs = this.getCityEventTimerRemainingMs();
    if (!(remainingMs > 0)) return;
    this._cityEventTimer = setTimeout(() => {
      this._cityEventTimer = null;
      if (!this._activeCityEvent) return;
      const worst = this._activeCityEvent.worstChoice ?? this._activeCityEvent.choices.length - 1;
      const result = this.resolveCityEvent(worst) || { message: 'The event resolves on its own.', type: 'warning' };
      window._cityEventActive = null;
      if (typeof showEventResult === 'function') showEventResult({
        ...result,
        message: `⏰ You hesitated too long!\n\n${result.message || ''}`.trim(),
      });
    }, remainingMs);
  }

  // ─── Settlement (player becomes a city) ────────────────
  /**
   * Settle at the player's current position — player disappears,
   * camera locks to the new city, management begins.
   */
  /**
   * Settle at a specific grid location — player disappears,
   * camera locks to the new city, management begins.
   * @param {number} gx - grid X coordinate
   * @param {number} gy - grid Y coordinate
   * @param {string} [name] - optional city name
   */
  settleAt(gx, gy, name) {
    const result = this.foundCityAt(gx, gy, name);
    if (!result.ok) return result;
    this.myCity = result.city;
    this.myCityIndex = this.world.cities.indexOf(result.city);
    this.isSettled = true;
    this.selectCity(this.myCity);
    // Give the city its starting budget and food stockpile
    const startingBudget = window._cityMgmtStartingBudget || 600;
    this.myCity.management.budget += startingBudget;
    window._cityMgmtStartingBudget = 0;
    // Ensure a comfortable starting food supply (30 days at 100 pop)
    this.myCity._addOrIncrement('Wheat', 80);
    this.myCity._addOrIncrement('Fish', 40);
    this.myCity._isManagedCity = true;
    this._notify(`You have settled ${result.city.name}! You are now the city.`, 'success');
    // Mark player as being in this city to suppress player-targeted combat
    // Also sync player position to city location so raider detection uses the city coords
    try {
      if (this.world && this.world.player) {
        this.world.player.currentCity = this.myCity;
        this.world.player.x = gx;
        this.world.player.y = gy;
      }
    } catch (e) {}
    return { ok: true, city: result.city };
  }

  /** Legacy wrapper — settle at the player's current position */
  settleHere(name) {
    if (!this.world.player) return { ok: false, reason: 'no_player' };
    return this.settleAt(this.world.player.x, this.world.player.y, name);
  }

  // ─── City selection (walk-up interaction) ───────────────
  /** Select a city for management (opens the side panel) */
  selectCity(city) {
    if (this._unitCityRef && this._unitCityRef !== city) {
      this._persistUnitsForCity(this._unitCityRef);
    }
    if (!city) return;
    this.selectedCity = city;
    this.selectedCityIndex = this.world.cities ? this.world.cities.indexOf(city) : -1;
    // ensure management payload
    if (!city.management) {
      city.management = { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [], units: [] };
    }
    if (!Array.isArray(city.management.routes)) city.management.routes = [];
    if (!Array.isArray(city.management.units)) city.management.units = [];
    this._loadUnitsForCity(city);
  }

  deselectCity() {
    this.selectedCity = null;
    this.selectedCityIndex = -1;
  }

  // ─── Happiness ──────────────────────────────────────────
  /** Compute composite happiness for a city (0-100) */
  getHappiness(city) {
    if (!city) return 50;
    let h = 50;

    // Food supply: +0 to +20
    const foodQty = this._getFoodQty(city);
    const foodRatio = Math.min(foodQty / Math.max(city.population * 0.1, 1), 1);
    h += foodRatio * 20;

    // Tax rate: low = happy, high = unhappy  (-15 to +10)
    const tax = city.management?.taxRate ?? 0.05;
    h += (0.1 - tax) * 100; // 0% tax = +10, 10% = 0, 25% = -15

    // Buildings boost happiness
    if (city.hasBank)        h += 3;
    if (city.hasGamblingDen) h += 2;
    if (city.hasBountyBoard) h += 3;
    if (city.hasWeaponShop)  h += 2;
    if (city.hasWinery)      h += 2;
    if (city.hasSchool)      h += 4;
    if (city.hasBlackMarket) h -= 5; // people dislike black markets

    // Reputation contributes
    h += (city.reputation - 50) * 0.2; // -10 to +10

    // Custom buildings (upgradeLevels) add small boosts
    const upgrades = city.management?.upgradeLevels || {};
    for (const key of Object.keys(upgrades)) {
      h += (upgrades[key] || 0) * 1.5;
    }

    return Math.max(0, Math.min(100, Math.round(h)));
  }

  /** Get happiness tier label */
  getHappinessTier(happiness) {
    if (happiness >= 80) return { label: 'Thriving',  emoji: '😄', color: '#4caf50' };
    if (happiness >= 60) return { label: 'Content',   emoji: '🙂', color: '#8bc34a' };
    if (happiness >= 40) return { label: 'Neutral',   emoji: '😐', color: '#ffc107' };
    if (happiness >= 20) return { label: 'Unhappy',   emoji: '😟', color: '#ff9800' };
    return                       { label: 'Miserable', emoji: '😡', color: '#f44336' };
  }

  // ─── Food ───────────────────────────────────────────────
  _getFoodQty(city) {
    const foodItems = ['Wheat', 'Fish', 'Bread', 'SaltedFish'];
    let total = 0;
    for (const item of foodItems) {
      const e = city.inventory.get(item);
      if (e) total += e.quantity;
    }
    return total;
  }

  getFoodStatus(city) {
    if (!city) return { qty: 0, need: 0, ratio: 0, label: 'N/A' };
    const qty = this._getFoodQty(city);
    const dailyNeed = Math.max(1, Math.ceil(city.population * 0.05));
    const daysLeft = dailyNeed > 0 ? Math.floor(qty / dailyNeed) : 999;
    let label, color;
    if (daysLeft >= 10) { label = 'Abundant'; color = '#4caf50'; }
    else if (daysLeft >= 5) { label = 'Sufficient'; color = '#8bc34a'; }
    else if (daysLeft >= 2) { label = 'Low'; color = '#ff9800'; }
    else { label = 'Starving!'; color = '#f44336'; }
    return { qty, need: dailyNeed, daysLeft, ratio: Math.min(qty / Math.max(dailyNeed, 1), 1), label, color };
  }

  // ─── Tax ────────────────────────────────────────────────
  setTaxRate(city, rate) {
    if (!city) return false;
    this._ensureManagement(city);
    const old = city.management.taxRate || 0.05;
    const r = Math.max(0, Math.min(0.5, rate));
    city.management.taxRate = r;
    // reputation impact
    const diff = r - old;
    if (Math.abs(diff) > 0.001) {
      const repDelta = Math.round(-diff * 50);
      if (typeof city.adjustReputation === 'function') city.adjustReputation(repDelta);
    }
    return true;
  }

  // ─── Treasury ───────────────────────────────────────────
  /** Move gold from player to city treasury. */
  transferToCity(city, amount) {
    if (!city || !this.world.player) return { ok: false, reason: 'no_city' };
    this._ensureManagement(city);
    const amt = Math.floor(Number(amount) || 0);
    if (amt <= 0) return { ok: false, reason: 'bad_amount' };
    if ((this.world.player.gold || 0) < amt) return { ok: false, reason: 'no_player_gold' };
    if (typeof this.world.player.spendGold === 'function') this.world.player.spendGold(amt);
    else this.world.player.gold = Math.max(0, (this.world.player.gold || 0) - amt);
    city.management.budget = (city.management.budget || 0) + amt;
    return { ok: true, amount: amt };
  }

  /** Move gold from city treasury to player. */
  withdrawFromCity(city, amount) {
    if (!city || !this.world.player) return { ok: false, reason: 'no_city' };
    this._ensureManagement(city);
    const amt = Math.floor(Number(amount) || 0);
    if (amt <= 0) return { ok: false, reason: 'bad_amount' };
    const budget = city.management.budget || 0;
    if (budget < amt) return { ok: false, reason: 'no_city_gold' };
    city.management.budget = budget - amt;
    if (typeof this.world.player.earnGold === 'function') this.world.player.earnGold(amt);
    else this.world.player.gold = (this.world.player.gold || 0) + amt;
    return { ok: true, amount: amt };
  }

  // ─── Building ───────────────────────────────────────────
  getBuildOptions(city) {
    if (!city) return [];
    const opts = [];
    if (!city.hasBank)        opts.push({ type: 'bank',        label: 'Bank',         cost: 650, time: 100, emoji: '🏦', desc: 'Enables banking services and improves tax efficiency' });
    if (!city.hasGamblingDen) opts.push({ type: 'gamblingDen', label: 'Gambling Den', cost: 450, time: 70,  emoji: '🎲', desc: 'Attracts visitors, with small happiness risk' });
    if (!city.hasBountyBoard) opts.push({ type: 'bountyBoard', label: 'Bounty Board', cost: 340, time: 55,  emoji: '📜', desc: 'Post bounties and improve defense readiness' });
    if (!city.hasWeaponShop)  opts.push({ type: 'weaponShop',  label: 'Weapon Shop',  cost: 560, time: 85,  emoji: '⚔️', desc: 'Sell weapons, helps city defense' });
    if (!city.hasWinery)      opts.push({ type: 'winery',      label: 'Winery',       cost: 520, time: 80,  emoji: '🍷', desc: 'Converts surplus grain into trade value and morale' });
    if (!city.hasSchool)      opts.push({ type: 'school',      label: 'School',       cost: 720, time: 110, emoji: '🏫', desc: 'Improves civic stability and long-term growth' });
    // Removable
    if (city.hasBlackMarket)  opts.push({ type: 'removeBlackMarket', label: 'Remove Black Market', cost: 780, time: 40, emoji: '🚫', desc: 'Makes people happier' });
    // Generic upgrades (repeatable)
    opts.push({ type: 'temple',    label: 'Temple',    cost: 420, time: 75,  emoji: '⛪', desc: '+Happiness, +Reputation' });
    opts.push({ type: 'farm',      label: 'Farm',      cost: 320, time: 60,  emoji: '🌾', desc: '+Food production' });
    opts.push({ type: 'warehouse', label: 'Warehouse', cost: 390, time: 65,  emoji: '📦', desc: '+Storage capacity' });
    opts.push({ type: 'walls',     label: 'Walls',     cost: 900, time: 120, emoji: '🏰', desc: '+Raider defense' });
    return opts;
  }

  /**
   * Spend gold from city budget only.
   * Player gold is never auto-spent in city-management actions; use Treasury transfer explicitly.
   */
  _spendPooled(city, cost) {
    this._ensureManagement(city);
    const budget = city.management?.budget || 0;
    if (budget < cost) return false;
    city.management.budget = budget - cost;
    return true;
  }

  /**
   * Funds available for city-management spending (city treasury only).
   */
  _availableFunds(city) {
    this._ensureManagement(city);
    return (city.management?.budget || 0);
  }

  enqueueBuild(city, buildingType, cost, buildTime) {
    if (!city) return { ok: false, reason: 'no_city' };
    this._ensureManagement(city);
    if (this._availableFunds(city) < cost) return { ok: false, reason: 'no_money' };
    this._spendPooled(city, cost);

    // Special: removing black market
    if (buildingType === 'removeBlackMarket') {
      city.hasBlackMarket = false;
      if (typeof city.adjustReputation === 'function') city.adjustReputation(5);
      this._notify(`Black market removed from ${city.name}!`, 'success');
      return { ok: true };
    }

    city.management.buildingQueue.push({ type: buildingType, cost, buildTime: buildTime || 60, progress: 0 });
    this._notify(`${city.name}: started building ${buildingType}`, 'info');
    return { ok: true };
  }

  // ─── Expand ─────────────────────────────────────────────
  expandCity(city, cost = 200) {
    if (!city) return { ok: false, reason: 'no_city' };
    this._ensureManagement(city);
    if (this._availableFunds(city) < cost) return { ok: false, reason: 'no_money' };
    this._spendPooled(city, cost);
    const popGain = Math.floor(city.population * 0.05) + 20;
    city.population += popGain;
    city._addOrIncrement('Wheat', 10);
    city._addOrIncrement('Fish', 6);
    this._notify(`${city.name} expanded (+${popGain} pop).`, 'info');
    return { ok: true, popGain };
  }

  // ─── Found new city ─────────────────────────────────────
  /**
   * Found a city at specific grid coordinates.
   * Does NOT require a player.
   * @param {number} gx - grid X coordinate
   * @param {number} gy - grid Y coordinate
   * @param {string} [name] - optional city name
   * @param {number} [budget=0] - budget to deduct from (0 = free for initial settle)
   */
  foundCityAt(gx, gy, name, budget) {
    if (!this.world.grid || !this.world.grid[gy] || !this.world.grid[gy][gx])
      return { ok: false, reason: 'out_of_bounds' };
    if (this.world.grid[gy][gx].options[0] === 'Water')
      return { ok: false, reason: 'water' };
    if (this.world.cityLocationMap && this.world.cityLocationMap.has(`${gx},${gy}`))
      return { ok: false, reason: 'occupied' };

    const cityName = name || `Settlement ${Math.floor(Math.random() * 1000)}`;
    const newCity = new City({ name: cityName, location: { x: gx, y: gy }, population: 100 });
    newCity.addInventoryBasedOnTerrain(this.world.grid, 1);
    newCity.management = { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [], units: [] };

    this.world.cities.push(newCity);
    if (typeof buildCityLocationMap === 'function') buildCityLocationMap();
    if (typeof rebuildSpatialGrids === 'function') rebuildSpatialGrids();
    this._notify(`Founded ${cityName}!`, 'success');
    return { ok: true, city: newCity };
  }

  /** Legacy wrapper — found a city at the player's current position (500g from player gold) */
  foundCityAtPlayer(name) {
    if (!this.world.player) return { ok: false, reason: 'no_player' };
    const cost = 500;
    if (this.world.player.gold < cost) return { ok: false, reason: 'no_gold' };
    this.world.player.gold -= cost;
    const result = this.foundCityAt(this.world.player.x, this.world.player.y, name);
    if (!result.ok) {
      // Refund on failure
      this.world.player.gold += cost;
    }
    return result;
  }

  // ─── Trade routes ───────────────────────────────────────
  createTradeRoute(srcCity, destCity, opts = {}) {
    if (!srcCity || !destCity) return { ok: false, reason: 'bad_cities' };
    this._ensureManagement(srcCity);

    // Check for duplicate by destination name
    const destName = destCity.name;
    if (srcCity.management.routes.some(r => r.destName === destName)) return { ok: false, reason: 'duplicate' };

    const route = {
      destName: destName,
      frequencyDays: Math.max(1, Number(opts.frequencyDays) || 7),
      lastTransferDay: -999,
      goldPerTransfer: Math.max(0, Number(opts.goldPerTransfer) || 0),
      goodsPerTransfer: Math.max(0, Number(opts.goodsPerTransfer) || 5),
      itemsToSend: Array.isArray(opts.itemsToSend) ? opts.itemsToSend : [], // [] = all items (random)
      _goodsCarry: 0,
      _goldCarry: 0,
    };
    srcCity.management.routes.push(route);
    this._notify(`Trade route: ${srcCity.name} → ${destCity.name}`, 'success');
    return { ok: true, route };
  }

  removeTradeRoute(city, routeIndex) {
    if (!city?.management?.routes) return;
    city.management.routes.splice(routeIndex, 1);
  }

  _processRoutes(city, day) {
    if (!city.management?.routes) return;
    for (const r of city.management.routes) {
      // Find destination by name (more robust than index)
      // Backward compat: also check destIndex for old saves
      let dest = this.world.cities?.find(c => c.name === r.destName);
      if (!dest && typeof r.destIndex === 'number') {
        dest = this.world.cities?.[r.destIndex];
      }
      if (!dest) continue;

      const freq = Math.max(1, Number(r.frequencyDays) || 7);
      const goodsPerTransfer = Math.max(0, Number(r.goodsPerTransfer) || 0);
      const goldPerTransfer = Math.max(0, Number(r.goldPerTransfer) || 0);

      r._goodsCarry = (Number(r._goodsCarry) || 0) + (goodsPerTransfer / freq);
      r._goldCarry = (Number(r._goldCarry) || 0) + (goldPerTransfer / freq);
      const goodsToMove = Math.floor(r._goodsCarry);
      const goldToSettle = Math.floor(r._goldCarry);
      if (goodsToMove <= 0) continue;

      // Prefer player-specified items; fall back to random if none configured or unavailable
      let candidateKeys;
      if (r.itemsToSend && r.itemsToSend.length > 0) {
        candidateKeys = r.itemsToSend.filter(k => {
          const e = city.inventory.get(k);
          return e && e.quantity > 0;
        });
      }
      if (!candidateKeys || candidateKeys.length === 0) {
        candidateKeys = [...city.inventory.keys()];
      }
      if (!candidateKeys || candidateKeys.length === 0) {
        r._goodsCarry = Math.max(0, r._goodsCarry - goodsToMove);
        r._goldCarry = Math.max(0, r._goldCarry - goldToSettle);
        r.lastTransferDay = day;
        continue;
      }

      const dx = (dest.location?.x || 0) - (city.location?.x || 0);
      const dy = (dest.location?.y || 0) - (city.location?.y || 0);
      const distance = Math.hypot(dx, dy);
      const srcWalls = city.management?.upgradeLevels?.walls || 0;
      const destWalls = dest.management?.upgradeLevels?.walls || 0;
      const successChance = Math.max(0.35, Math.min(0.98, 0.92 - (distance * 0.003) + ((srcWalls + destWalls) * 0.02)));
      const shipmentSucceeded = Math.random() <= successChance;
      let moved = 0;
      if (shipmentSucceeded) {
        for (const k of candidateKeys) {
          if (moved >= goodsToMove) break;
          const entry = city.inventory.get(k);
          if (!entry || entry.quantity <= 0) continue;
          const qty = Math.min(entry.quantity, goodsToMove - moved);
          if (qty <= 0) continue;
          entry.quantity -= qty;
          if (entry.quantity <= 0) city.inventory.delete(k);
          dest._addOrIncrement(k, qty);
          moved += qty;
        }
      }

      // Consume pending transfer budget for this cycle (even if stock was low/failed)
      r._goodsCarry = Math.max(0, r._goodsCarry - goodsToMove);
      r._goldCarry = Math.max(0, r._goldCarry - goldToSettle);

      // Route earnings are now tied to successful, non-zero deliveries and distance/upkeep.
      if (moved > 0 && shipmentSucceeded) {
        const fillRatio = goodsToMove > 0 ? (moved / goodsToMove) : 0;
        const distancePenalty = Math.min(0.65, distance * 0.004);
        const gross = Math.max(0, Math.floor(goldToSettle * fillRatio * (1 - distancePenalty)));
        const upkeep = Math.max(0, Math.floor((distance / 18) + (moved * 0.4)));
        const net = gross - upkeep;
        city.management.budget = Math.max(0, (city.management.budget || 0) + net);
      }
      r.lastTransferDay = day;
    }
  }

  // ─── Demand quests ──────────────────────────────────────
  _generateDemandQuest(day) {
    if (!this.world.cities || this.world.cities.length === 0) return;
    const tradeables = ['Fish', 'Wheat', 'Iron', 'Wood', 'Clay', 'Stone', 'Salt', 'Herbs',
                        'Fur', 'Bread', 'Tools', 'Pottery', 'SaltedFish', 'Spices', 'Wine', 'Silk', 'Jewelry'];
    const cityIdx = Math.floor(Math.random() * this.world.cities.length);
    const city = this.world.cities[cityIdx];
    if (!city) return;
    const itemName = tradeables[Math.floor(Math.random() * tradeables.length)];
    const qtyNeeded = 3 + Math.floor(Math.random() * 8);
    const reward = qtyNeeded * (10 + Math.floor(Math.random() * 15));
    const deadline = day + 10 + Math.floor(Math.random() * 10);
    this.demandQuests.push({ cityIndex: cityIdx, cityName: city.name, itemName, qtyNeeded, qtyDelivered: 0, reward, deadline });
    this._notify(`${city.name} demands ${qtyNeeded}x ${itemName}! Reward: ${reward}g`, 'quest');
  }

  /** Try to fulfill demand quests at a city using city's own inventory */
  fulfillDemandQuests(city) {
    if (!city) return [];
    const cityIdx = this.world.cities.indexOf(city);
    const fulfilled = [];
    for (let i = this.demandQuests.length - 1; i >= 0; i--) {
      const q = this.demandQuests[i];
      if (q.cityIndex !== cityIdx) continue;
      const needed = q.qtyNeeded - q.qtyDelivered;
      if (needed <= 0) continue;
      // In city-management: use the city's own inventory (Map-based)
      const entry = city.inventory.get(q.itemName);
      if (!entry || entry.quantity <= 0) continue;
      const deliver = Math.min(needed, entry.quantity);
      entry.quantity -= deliver;
      if (entry.quantity <= 0) city.inventory.delete(q.itemName);
      q.qtyDelivered += deliver;
      if (q.qtyDelivered >= q.qtyNeeded) {
        // Quest complete! Reward goes into city budget
        if (city.management) city.management.budget = (city.management.budget || 0) + q.reward;
        if (typeof city.adjustReputation === 'function') city.adjustReputation(5);
        this._notify(`Quest complete! +${q.reward}g — ${city.name} supplied ${q.itemName}`, 'success');
        fulfilled.push(q);
        this.demandQuests.splice(i, 1);
      }
    }
    return fulfilled;
  }

  // ─── Victory tracking ──────────────────────────────────
  _updateWealthRanking() {
    const ranking = [];

    // "Player" wealth is now myCity's wealth (budget + inventory value)
    let myCityWealth = 0;
    if (this.myCity) {
      myCityWealth += this.myCity.management?.budget || 0;
      for (const [key, entry] of this.myCity.inventory) {
        myCityWealth += (entry.quantity || 0) * (ItemLibrary[key]?.baseValue || 5);
      }
    } else {
      // Fallback before settling: use player gold
      myCityWealth = this.world.player?.gold || 0;
    }
    this.playerWealth = myCityWealth;
    const myName = this.myCity?.name || this.world.player?.captainName || 'You';
    ranking.push({ name: myName, wealth: myCityWealth, isPlayer: true });

    // Each OTHER city's wealth: budget + inventory value
    if (this.world.cities) {
      for (const c of this.world.cities) {
        if (c === this.myCity) continue; // already counted above
        let w = c.management?.budget || 0;
        for (const [key, entry] of c.inventory) {
          w += (entry.quantity || 0) * (ItemLibrary[key]?.baseValue || 5);
        }
        ranking.push({ name: c.name, wealth: w, isPlayer: false });
      }
    }

    ranking.sort((a, b) => b.wealth - a.wealth);
    this.wealthRanking = ranking;

    // Check if player is #1
    if (ranking.length > 0 && ranking[0].isPlayer) {
      this.richestStreak++;
      if (this.richestStreak >= this.victoryDays && !this.won) {
        this.won = true;
        this._notify(`VICTORY! You've been the richest for ${this.victoryDays} days!`, 'success');
        const gs = this._getGameStates();
        if (gs && gs.GAMEWON) this._setState(gs.GAMEWON);
      }
    } else {
      this.richestStreak = 0;
    }
  }

  // ─── City Events (periodic random events for settled cities) ──────
  _initCityEvents() {
    return [
      {
        name: 'Drought',
        emoji: '☀️',
        description: 'A severe drought strikes! Your crops wither and food supplies dwindle.',
        weight: 1,
        resolve: (city, choice, mgr) => {
          if (choice === 0) {
            // Ration food: lose some food but preserve happiness
            const food = this._getFoodQty(city);
            const loss = Math.max(1, Math.floor(food * 0.3));
            this._removeFoodFromCity(city, loss);
            return { message: `Rationed food — lost ${loss} units, but people understand.`, type: 'warning' };
          } else {
            // Ignore: lose more food AND happiness drops
            const food = this._getFoodQty(city);
            const loss = Math.max(2, Math.floor(food * 0.5));
            this._removeFoodFromCity(city, loss);
            if (typeof city.adjustReputation === 'function') city.adjustReputation(-5);
            return { message: `Ignored the drought — lost ${loss} food and people are angry!`, type: 'error' };
          }
        },
        choices: ['Ration supplies (lose 30% food)', 'Ignore it (lose 50% food, -reputation)'],
        timeLimit: 15,
        worstChoice: 1,
      },
      {
        name: 'Plague',
        emoji: '🦠',
        description: 'A mysterious sickness spreads through the city! People are falling ill.',
        weight: 1,
        resolve: (city, choice, mgr) => {
          if (choice === 0) {
            // Quarantine: lose some population but contain it
            const loss = Math.max(5, Math.floor(city.population * 0.05));
            city.population = Math.max(10, city.population - loss);
            return { message: `Quarantine enforced — lost ${loss} citizens, but the plague is contained.`, type: 'warning' };
          } else {
            // Spend gold on medicine
            const cost = Math.floor(city.population * 0.5);
            if (mgr && mgr._spendPooled(city, cost)) {
              return { message: `Spent ${cost}g on medicine — plague cured quickly!`, type: 'success' };
            } else {
              const loss = Math.max(10, Math.floor(city.population * 0.1));
              city.population = Math.max(10, city.population - loss);
              return { message: `Not enough gold for medicine! Lost ${loss} citizens.`, type: 'error' };
            }
          }
        },
        choices: ['Enforce quarantine (lose ~5% pop)', 'Buy medicine (costs gold)'],
        timeLimit: 12,
        worstChoice: 0,
      },
      {
        name: 'Trade Caravan',
        emoji: '🐪',
        description: 'A wealthy trade caravan passes through and offers to trade!',
        weight: 2,
        resolve: (city, choice, mgr) => {
          if (choice === 0) {
            // Welcome them: gain gold and goods
            const goldGain = 50 + Math.floor(Math.random() * 100);
            city.management.budget = (city.management?.budget || 0) + goldGain;
            city._addOrIncrement('Spices', 2 + Math.floor(Math.random() * 3));
            city._addOrIncrement('Silk', 1 + Math.floor(Math.random() * 2));
            if (typeof city.adjustReputation === 'function') city.adjustReputation(3);
            return { message: `Welcomed the caravan! +${goldGain}g and exotic goods!`, type: 'success' };
          } else {
            // Tax them heavily
            const goldGain = 100 + Math.floor(Math.random() * 150);
            city.management.budget = (city.management?.budget || 0) + goldGain;
            if (typeof city.adjustReputation === 'function') city.adjustReputation(-5);
            return { message: `Taxed the caravan heavily! +${goldGain}g but traders won't return soon.`, type: 'warning' };
          }
        },
        choices: ['Welcome them warmly (+goods, +reputation)', 'Tax them heavily (+more gold, -reputation)'],
        timeLimit: 20,
        worstChoice: 1,
      },
      {
        name: 'Festival',
        emoji: '🎉',
        description: 'The citizens want to hold a festival! Should you fund it?',
        weight: 2,
        resolve: (city, choice, mgr) => {
          if (choice === 0) {
            const cost = 80 + Math.floor(city.population * 0.3);
            if (mgr && mgr._spendPooled(city, cost)) {
              if (typeof city.adjustReputation === 'function') city.adjustReputation(8);
              city.population += Math.floor(city.population * 0.03) + 5;
              return { message: `Festival was a success! -${cost}g, +reputation, +population!`, type: 'success' };
            } else {
              return { message: `Can't afford the festival (${cost}g needed). People are disappointed.`, type: 'warning' };
            }
          } else {
            if (typeof city.adjustReputation === 'function') city.adjustReputation(-3);
            return { message: `You declined the festival. People are a bit disappointed.`, type: 'warning' };
          }
        },
        choices: ['Fund the festival (costs gold)', 'Decline (slight reputation loss)'],
        timeLimit: 20,
        worstChoice: 1,
      },
      {
        name: 'Fire!',
        emoji: '🔥',
        description: 'A fire has broken out in the city! Buildings are at risk!',
        weight: 1,
        resolve: (city, choice, mgr) => {
          if (choice === 0) {
            // Organize bucket brigade: spend gold, save buildings
            const cost = 50 + Math.floor(Math.random() * 50);
            if (mgr && mgr._spendPooled(city, cost)) {
              return { message: `Fire contained! Spent ${cost}g organizing the response.`, type: 'success' };
            } else {
              // Can't afford — damage a building
              const bq = city.management?.buildingQueue || [];
              if (bq.length > 0) {
                bq[0].progress = Math.max(0, (bq[0].progress || 0) - 20);
                return { message: `Couldn't afford firefighting! A construction project was damaged.`, type: 'error' };
              }
              return { message: `No gold for firefighting — luckily damage was minor.`, type: 'warning' };
            }
          } else {
            // Evacuate: lose some population but no gold cost
            const loss = Math.max(3, Math.floor(city.population * 0.02));
            city.population = Math.max(10, city.population - loss);
            return { message: `Evacuated the area — ${loss} people left the city.`, type: 'warning' };
          }
        },
        choices: ['Fight the fire (costs gold)', 'Evacuate the area (lose some population)'],
        timeLimit: 10,
        worstChoice: 1,
      },
      {
        name: 'Refugee Arrival',
        emoji: '🚶',
        description: 'A group of refugees arrives seeking shelter in your city.',
        weight: 2,
        resolve: (city, choice, mgr) => {
          if (choice === 0) {
            const popGain = 10 + Math.floor(Math.random() * 15);
            city.population += popGain;
            if (typeof city.adjustReputation === 'function') city.adjustReputation(5);
            return { message: `Welcomed ${popGain} refugees! Population and reputation grew.`, type: 'success' };
          } else {
            if (typeof city.adjustReputation === 'function') city.adjustReputation(-3);
            return { message: `Turned the refugees away. People question your compassion.`, type: 'warning' };
          }
        },
        choices: ['Welcome them (+population, +reputation)', 'Turn them away (-reputation)'],
        timeLimit: 15,
        worstChoice: 1,
      },
      {
        name: 'Mine Discovery',
        emoji: '⛏️',
        description: 'Workers discovered a rich mineral vein near the city!',
        weight: 1,
        minDay: 5,
        resolve: (city, choice, mgr) => {
          if (choice === 0) {
            const cost = 150;
            if (mgr && mgr._spendPooled(city, cost)) {
              city._addOrIncrement('Iron', 8 + Math.floor(Math.random() * 6));
              city._addOrIncrement('Stone', 5 + Math.floor(Math.random() * 4));
              if (Math.random() < 0.3) city._addOrIncrement('Gems', 1 + Math.floor(Math.random() * 2));
              return { message: `Invested ${cost}g in the mine — rich resources extracted!`, type: 'success' };
            }
            return { message: `Can't afford to develop the mine (${cost}g needed).`, type: 'warning' };
          } else {
            city._addOrIncrement('Iron', 3);
            city._addOrIncrement('Stone', 2);
            return { message: `Collected some surface minerals without investment.`, type: 'info' };
          }
        },
        choices: ['Invest in mining (150g for lots of resources)', 'Collect surface minerals (free, less yield)'],
        timeLimit: 20,
        worstChoice: 1,
      },
      {
        name: 'Merchant Guild Offer',
        emoji: '💼',
        description: 'The Merchant Guild offers to set up a branch in your city — for a fee.',
        weight: 1,
        minDay: 8,
        resolve: (city, choice, mgr) => {
          if (choice === 0) {
            const cost = 200;
            if (mgr && mgr._spendPooled(city, cost)) {
              // Boost weekly tax income via reputation
              if (typeof city.adjustReputation === 'function') city.adjustReputation(10);
              return { message: `Merchant Guild established! -${cost}g, big reputation boost!`, type: 'success' };
            }
            return { message: `Can't afford the Merchant Guild fee (${cost}g).`, type: 'warning' };
          } else {
            return { message: `Declined the Merchant Guild's offer.`, type: 'info' };
          }
        },
        choices: ['Accept (200g, +big reputation)', 'Decline (no cost)'],
        timeLimit: 20,
        worstChoice: 1,
      },
    ];
  }

  /** Remove food items from a city's inventory */
  _removeFoodFromCity(city, amount) {
    const foodItems = ['Wheat', 'Fish', 'Bread', 'SaltedFish'];
    let remaining = amount;
    for (const item of foodItems) {
      if (remaining <= 0) break;
      const e = city.inventory.get(item);
      if (!e || e.quantity <= 0) continue;
      const take = Math.min(remaining, e.quantity);
      e.quantity -= take;
      if (e.quantity <= 0) city.inventory.delete(item);
      remaining -= take;
    }
  }

  /** Trigger a random city event for the player's city */
  _triggerCityEvent(day) {
    if (!this.myCity || !this.isSettled) return;
    if (this._activeCityEvent) return; // one at a time

    const events = this._initCityEvents();
    const eligible = events.filter(e => {
      if (e.minDay && day < e.minDay) return false;
      return true;
    });
    if (eligible.length === 0) return;

    // Weighted random selection
    const totalWeight = eligible.reduce((s, e) => s + (e.weight || 1), 0);
    let roll = Math.random() * totalWeight;
    let chosen = eligible[0];
    for (const e of eligible) {
      roll -= (e.weight || 1);
      if (roll <= 0) { chosen = e; break; }
    }

    this._activeCityEvent = {
      ...chosen,
      triggered: day,
      // Keep game-time deadline for backward compatibility with old flows.
      deadlineGameTimeMs: chosen.timeLimit ? this._getCurrentGameTimeMs() + chosen.timeLimit * 1000 : 0,
      // Use wall-clock deadline so countdown continues while RANDOM_EVENT pauses dayNight.
      deadlineWallTimeMs: chosen.timeLimit ? Date.now() + chosen.timeLimit * 1000 : 0,
    };

    this._scheduleActiveCityEventTimeout();

    this._notify(`${chosen.emoji} City Event: ${chosen.name}!`, 'quest');
    // Transition to the global random event view so the player sees and
    // resolves the city event using the shared event UI.
    const gs = this._getGameStates();
    if (gs && gs.RANDOM_EVENT) {
      // Expose the active city event for the UI to consume
      window._cityEventActive = this._activeCityEvent;
      this._setState(gs.RANDOM_EVENT);
    }
  }

  /** Resolve the active city event with the player's choice */
  resolveCityEvent(choiceIndex) {
    if (!this._activeCityEvent || !this.myCity) return null;
    this._clearCityEventTimer();
    const evt = this._activeCityEvent;
    const result = evt.resolve(this.myCity, choiceIndex, this);
    this._activeCityEvent = null;
    this._notify(result.message, result.type || 'info');
    return result;
  }

  /** Auto-resolve event if timer expires */
  _checkCityEventTimeout() {
    if (!this._activeCityEvent) return;
    const wallExpired = this._activeCityEvent.deadlineWallTimeMs && Date.now() > this._activeCityEvent.deadlineWallTimeMs;
    const gameExpired = this._activeCityEvent.deadlineGameTimeMs && this._getCurrentGameTimeMs() > this._activeCityEvent.deadlineGameTimeMs;
    if (wallExpired || gameExpired) {
      const worst = this._activeCityEvent.worstChoice ?? this._activeCityEvent.choices.length - 1;
      this._notify(`⏰ You hesitated too long!`, 'error');
      this.resolveCityEvent(worst);
    }
  }

  getCityEventTimerRemainingMs() {
    if (!this._activeCityEvent) return 0;
    if (this._activeCityEvent.deadlineWallTimeMs) {
      return Math.max(0, this._activeCityEvent.deadlineWallTimeMs - Date.now());
    }
    if (this._activeCityEvent.deadlineGameTimeMs) {
      return Math.max(0, this._activeCityEvent.deadlineGameTimeMs - this._getCurrentGameTimeMs());
    }
    return 0;
  }

  // ─── Resource Gathering (terrain minigames) ─────────────
  /**
   * Get available resource gathering options based on terrain around myCity.
   * Returns array of { terrain, minigame, label, emoji, resources }
   */
  getGatherOptions() {
    if (!this.myCity || !this.isSettled) return [];
    const loc = this.myCity.location;
    const g = this.world.grid;
    if (!g) return [];

    const terrainCounts = { Water: 0, Grass: 0, Rock: 0, Forest: 0, Sand: 0, Snow: 0 };
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = loc.x + dx;
        const ny = loc.y + dy;
        if (ny >= 0 && ny < (this.world.rows || 100) && nx >= 0 && nx < (this.world.cols || 100)) {
          const tile = g[ny]?.[nx];
          if (tile && tile.options && terrainCounts[tile.options[0]] !== undefined) {
            terrainCounts[tile.options[0]]++;
          }
        }
      }
    }

    const options = [];
    if (terrainCounts.Water > 0) options.push({
      terrain: 'Water', minigame: 'fishing', label: 'Go Fishing', emoji: '🎣',
      resources: [{ item: 'Fish', base: terrainCounts.Water }, { item: 'Salt', base: Math.floor(terrainCounts.Water / 3) }],
    });
    if (terrainCounts.Rock > 0) options.push({
      terrain: 'Rock', minigame: 'mining', label: 'Mine Ore', emoji: '⛏️',
      resources: [{ item: 'Iron', base: terrainCounts.Rock }, { item: 'Stone', base: Math.floor(terrainCounts.Rock / 2) }],
    });
    if (terrainCounts.Grass > 0) options.push({
      terrain: 'Grass', minigame: 'harvesting', label: 'Harvest Crops', emoji: '🌾',
      resources: [{ item: 'Wheat', base: terrainCounts.Grass }, { item: 'Herbs', base: Math.floor(terrainCounts.Grass / 3) }],
    });
    if (terrainCounts.Forest > 0) options.push({
      terrain: 'Forest', minigame: 'woodcutting', label: 'Chop Wood', emoji: '🪓',
      resources: [{ item: 'Wood', base: terrainCounts.Forest }, { item: 'Fur', base: Math.floor(terrainCounts.Forest / 3) }],
    });
    if (terrainCounts.Sand > 0) options.push({
      terrain: 'Sand', minigame: 'sandDig', label: 'Dig for Treasure', emoji: '⏳',
      resources: [{ item: 'Clay', base: terrainCounts.Sand }, { item: 'Gems', base: Math.max(1, Math.floor(terrainCounts.Sand / 4)) }],
    });
    if (terrainCounts.Snow > 0) options.push({
      terrain: 'Snow', minigame: 'fishing', label: 'Ice Fishing', emoji: '🧊',
      resources: [{ item: 'Fur', base: terrainCounts.Snow }, { item: 'Fish', base: Math.floor(terrainCounts.Snow / 2) }],
    });
    return options;
  }

  /**
   * Launch a resource gathering minigame. On completion, awards resources to the city.
   * @param {object} gatherOpt - from getGatherOptions()
   */
  launchGathering(gatherOpt) {
    if (!this.myCity || !gatherOpt) return;
    const mm = this._getMinigameManager();
    const gs = this._getGameStates();
    const gsm = this._getGameStateManager();
    if (!mm || !gs || !gsm) return;

    const city = this.myCity;
    mm.launch(gatherOpt.minigame, {}, (result) => {
      if (!result || !result.success) {
        this._notify('Gathering failed — no resources collected.', 'warning');
        this._setState(gs.CITY_MANAGE);
        return;
      }

      // Calculate yield based on minigame performance
      let perfMultiplier = 1;
      if (result.caught !== undefined) perfMultiplier = result.caught / Math.max(1, result.total);
      else if (result.hits !== undefined) perfMultiplier = result.hits / Math.max(1, result.total);
      else if (result.collected !== undefined) perfMultiplier = result.collected / Math.max(1, result.collected + result.missed);
      else if (result.goodChops !== undefined) perfMultiplier = result.goodChops / Math.max(1, result.total);
      else if (result.found !== undefined) perfMultiplier = result.found / Math.max(1, result.total);
      perfMultiplier = Math.max(0.2, perfMultiplier); // minimum 20% yield

      const gained = [];
      for (const r of gatherOpt.resources) {
        const qty = Math.max(1, Math.round(r.base * perfMultiplier * (1 + Math.random() * 0.5)));
        city._addOrIncrement(r.item, qty);
        gained.push(`${r.item} ×${qty}`);
      }

      this._notify(`Gathered: ${gained.join(', ')}!`, 'success');
      this._setState(gs.CITY_MANAGE);
    });

    this._setState(gs.MINIGAME);
  }

  spawnUnit(city, name, classKey = 'militia') {
    if (!city || !this.unitManager) return { ok: false, reason: 'no_city' };
    if (typeof CityUnit === 'undefined') return { ok: false, reason: 'unit_class_missing' };
    if (this._unitCityRef !== city) this._loadUnitsForCity(city);
    const currentUnits = this.unitManager.units.length;
    const cap = this.getUnitCap(city);
    if (currentUnits >= cap) return { ok: false, reason: 'unit_cap' };
    const templates = this.getUnitTemplates();
    const template = templates.find((t) => t.key === classKey) || templates[0];
    if (template.coastalOnly && !city.isCoastal) return { ok: false, reason: 'non_coastal' };
    const cost = this.getUnitTrainCost(city, template.key);
    if (this._availableFunds(city) < cost) return { ok: false, reason: 'no_money' };
    if (!this._spendPooled(city, cost)) return { ok: false, reason: 'no_money' };
    const unitName = (typeof name === 'string' && name.trim()) ? name.trim() : `${template.label} #${this._nextUnitId}`;
    const unit = new CityUnit({
      id: this._nextUnitId++,
      city,
      location: { x: city.location?.x || 0, y: city.location?.y || 0 },
      name: unitName,
      classKey: template.key,
      movementType: template.movementType || 'land',
      hp: template.hp,
      maxHp: template.hp,
      attack: template.attack,
      defense: template.defense,
    });
    this.unitManager.deselectAll();
    unit.selected = true;
    this.unitManager.add(unit);
    this._persistUnitsForCity(city);
    this._notify(`${city.name}: trained ${template.label} ${unit.name} (-${cost}g).`, 'success');
    this._pushUnitFeed(`Trained ${template.label} ${unit.name}.`, 'success');
    return { ok: true, unit, cost };
  }

  getUnitTemplates() {
    return [
      { key: 'militia', label: 'Militia', emoji: '🛡️', baseCost: 140, hp: 12, attack: 2, defense: 1, movementType: 'land', desc: 'Cheap front line.' },
      { key: 'guard', label: 'Guard', emoji: '🗡️', baseCost: 180, hp: 16, attack: 3, defense: 2, movementType: 'land', desc: 'Tough defender.' },
      { key: 'ranger', label: 'Ranger', emoji: '🏹', baseCost: 170, hp: 11, attack: 4, defense: 1, movementType: 'land', desc: 'High damage skirmisher.' },
      { key: 'corsair', label: 'Corsair', emoji: '⛵', baseCost: 220, hp: 13, attack: 4, defense: 2, movementType: 'naval', coastalOnly: true, desc: 'Naval unit: water movement, anti-pirate bonus.' },
    ];
  }

  getUnitCap(city) {
    if (!city) return this._unitBaseCap;
    const walls = city.management?.upgradeLevels?.walls || 0;
    return this._unitBaseCap + (walls * 2);
  }

  getUnitTrainCost(city, classKey = 'militia') {
    if (!city) return this._unitBaseCost;
    const unitCount = Array.isArray(city.management?.units) ? city.management.units.length : 0;
    const days = this._getDaysElapsed();
    const inflation = Math.min(60, Math.floor(days / 12) * 5);
    const rosterPressure = Math.floor(unitCount / 3) * 20;
    const tpl = this.getUnitTemplates().find((t) => t.key === classKey);
    const base = tpl ? tpl.baseCost : this._unitBaseCost;
    return base + inflation + rosterPressure;
  }

  getReadyUnitCount(city) {
    if (!city || !this.unitManager) return 0;
    if (this._unitCityRef !== city) this._loadUnitsForCity(city);
    return this.unitManager.units.filter((u) => u && u.hp > 0 && u.state !== 'defeated' && u._combatCooldown <= 0).length;
  }

  getWarTargets(city) {
    const p = this._getPlayerRef();
    if (!city || !this.world.cities || !p) return [];
    return this.world.cities.filter((c) => c && c !== city && !(typeof p.ownsCity === 'function' && p.ownsCity(c)));
  }

  getHostilePressure(city, radius = 14) {
    if (!city || !this.world.cities) return { hostileCities: 0, hostileUnits: 0 };
    let hostileCities = 0;
    let hostileUnits = 0;
    for (const c of this.world.cities) {
      if (!c || c === city || this._isPlayerOwnedCity(c)) continue;
      const dx = (c.location?.x || 0) - (city.location?.x || 0);
      const dy = (c.location?.y || 0) - (city.location?.y || 0);
      const dist = Math.hypot(dx, dy);
      if (dist <= radius) {
        hostileCities++;
        hostileUnits += Array.isArray(c.management?.units) ? c.management.units.filter((u) => (u?.hp || 0) > 0).length : 0;
      }
    }
    return { hostileCities, hostileUnits };
  }

  _isPlayerOwnedCity(city) {
    const p = this._getPlayerRef();
    return !!(p && typeof p.ownsCity === 'function' && p.ownsCity(city));
  }

  _getUnitCombatPower(unit) {
    if (!unit || unit.hp <= 0 || unit.state === 'defeated') return 0;
    const hpRatio = unit.hp / Math.max(1, unit.maxHp);
    return (unit.attack * 2.1) + (unit.defense * 1.5) + ((unit.level || 1) * 1.6) + (hpRatio * 2.5);
  }

  _getUnitCombatPowerFromData(unitData) {
    if (!unitData) return 0;
    const hp = Math.max(0, Number(unitData.hp) || 0);
    if (hp <= 0) return 0;
    const maxHp = Math.max(1, Number(unitData.maxHp) || 1);
    const hpRatio = hp / maxHp;
    return ((Number(unitData.attack) || 2) * 2.1)
      + ((Number(unitData.defense) || 1) * 1.5)
      + ((Number(unitData.level) || 1) * 1.6)
      + (hpRatio * 2.5);
  }

  _getCityDefensePower(city) {
    if (!city) return 0;
    const walls = city.management?.upgradeLevels?.walls || 0;
    const hasWeaponShop = !!city.hasWeaponShop;
    const garrison = Array.isArray(city.management?.units) ? city.management.units : [];
    let unitPower = 0;
    for (const u of garrison) {
      const hp = Math.max(0, Number(u.hp) || 0);
      const maxHp = Math.max(1, Number(u.maxHp) || 1);
      const hpRatio = hp / maxHp;
      if (hp <= 0) continue;
      unitPower += ((Number(u.attack) || 2) * 1.8) + ((Number(u.defense) || 1) * 1.3) + ((Number(u.level) || 1) * 1.2) + (hpRatio * 2);
    }
    return (city.population / 45) + (walls * 7) + (hasWeaponShop ? 7 : 0) + unitPower + 9;
  }

  _getCityAttackPower(city) {
    if (!city) return 0;
    const units = Array.isArray(city.management?.units) ? city.management.units : [];
    let p = 0;
    for (const u of units) p += this._getUnitCombatPowerFromData(u);
    return p;
  }

  _getAIInvasionPreview(attacker, defender) {
    if (!attacker || !defender) return null;
    const attackPower = this._getCityAttackPower(attacker);
    const defensePower = this._getCityDefensePower(defender);
    const dx = (defender.location?.x || 0) - (attacker.location?.x || 0);
    const dy = (defender.location?.y || 0) - (attacker.location?.y || 0);
    const distance = Math.hypot(dx, dy);
    const distancePenalty = Math.min(0.3, distance * 0.0025);
    const budgetBonus = Math.min(0.12, (attacker.management?.budget || 0) / 6000);
    const raw = 0.42 + ((attackPower - defensePower) * 0.0075) - distancePenalty + budgetBonus;
    const winChance = Math.max(0.1, Math.min(0.88, raw));
    const warCost = 150 + Math.floor(distance * 2.2) + Math.max(0, Math.floor((defender.population - attacker.population) * 0.08));
    return { attackPower, defensePower, winChance, warCost, distance: Math.round(distance) };
  }

  _musterAICityUnits(city, day) {
    if (!city || !city.management) return;
    if (this._isPlayerOwnedCity(city) || city === this.myCity) return;
    if (city._nextAIMusterDay && day < city._nextAIMusterDay) return;

    const unitCap = this.getUnitCap(city);
    const curUnits = Array.isArray(city.management.units) ? city.management.units : [];
    if (curUnits.length >= unitCap) {
      city._nextAIMusterDay = day + 2;
      return;
    }

    const templates = this.getUnitTemplates();
    const canCoastal = !!city.isCoastal;
    const candidateKeys = ['militia', 'guard', 'ranger'];
    if (canCoastal) candidateKeys.push('corsair');
    const key = candidateKeys[Math.floor(Math.random() * candidateKeys.length)];
    const tpl = templates.find((t) => t.key === key) || templates[0];
    if (tpl.coastalOnly && !canCoastal) return;

    const cost = Math.floor(this.getUnitTrainCost(city, tpl.key) * 0.85);
    if ((city.management.budget || 0) < cost) {
      city._nextAIMusterDay = day + 1;
      return;
    }

    city.management.budget = Math.max(0, (city.management.budget || 0) - cost);
    const unitData = new CityUnit({
      id: this._nextUnitId++,
      city,
      location: { x: city.location?.x || 0, y: city.location?.y || 0 },
      name: `${tpl.label} ${Math.floor(Math.random() * 900 + 100)}`,
      classKey: tpl.key,
      movementType: tpl.movementType || 'land',
      hp: tpl.hp,
      maxHp: tpl.hp,
      attack: tpl.attack,
      defense: tpl.defense,
    }).toJSON();
    if (!Array.isArray(city.management.units)) city.management.units = [];
    city.management.units.push(unitData);
    city._nextAIMusterDay = day + 1 + Math.floor(Math.random() * 2);
  }

  _applyAICampaignCasualties(city, won) {
    if (!city || !Array.isArray(city.management?.units)) return 0;
    const units = city.management.units;
    let lost = 0;
    for (let i = units.length - 1; i >= 0; i--) {
      const u = units[i];
      const pressure = won ? 0.16 : 0.34;
      if (Math.random() < pressure * 0.32) {
        const maxHp = Math.max(1, Number(u.maxHp) || 10);
        u.hp = Math.max(0, (Number(u.hp) || maxHp) - Math.floor(maxHp * (0.35 + Math.random() * 0.3)));
      }
      if ((Number(u.hp) || 0) <= 0) {
        units.splice(i, 1);
        lost++;
      }
    }
    return lost;
  }

  _runAICityWarfare(day) {
    if (!this.world.cities || day < this._nextAIDecisionDay) return;
    const p = this._getPlayerRef();
    const attackers = this.world.cities.filter((c) => {
      if (!c || !c.management) return false;
      if (this._isPlayerOwnedCity(c)) return false;
      const units = Array.isArray(c.management.units) ? c.management.units.length : 0;
      return units >= 2 && (c.management.budget || 0) >= 180;
    });
    if (attackers.length === 0) {
      this._nextAIDecisionDay = day + 2;
      return;
    }

    for (const attacker of attackers) {
      if (Math.random() > 0.32) continue;
      const targets = this.world.cities.filter((c) => c && c !== attacker);
      if (targets.length === 0) continue;

      const playerTargets = targets.filter((c) => this._isPlayerOwnedCity(c) && c !== this.myCity);
      const pool = playerTargets.length > 0 ? playerTargets : targets;
      let target = pool[0];
      let best = Infinity;
      for (const t of pool) {
        const d = Math.hypot((t.location?.x || 0) - (attacker.location?.x || 0), (t.location?.y || 0) - (attacker.location?.y || 0));
        if (d < best) { best = d; target = t; }
      }
      if (!target) continue;

      const preview = this._getAIInvasionPreview(attacker, target);
      if (!preview) continue;
      if ((attacker.management?.budget || 0) < preview.warCost) continue;
      attacker.management.budget = Math.max(0, (attacker.management?.budget || 0) - preview.warCost);

      const won = Math.random() < preview.winChance;
      const attackerLoss = this._applyAICampaignCasualties(attacker, won);
      const defenderLoss = this._applyAICampaignCasualties(target, !won);

      if (won) {
        if (p && typeof p.removeOwnedCity === 'function' && this._isPlayerOwnedCity(target)) {
          p.removeOwnedCity(target);
          this._notify(`🔥 ${attacker.name} conquered your city ${target.name}.`, 'error');
          this._pushUnitFeed(`${attacker.name} seized ${target.name}. Losses: A${attackerLoss}/D${defenderLoss}.`, 'error');
        } else {
          this._notify(`⚔️ ${attacker.name} conquered ${target.name}.`, 'warning');
          this._pushUnitFeed(`${attacker.name} conquered ${target.name}.`, 'warning');
        }
        if (target.ownership && typeof target.ownership === 'object') {
          target.ownership.offerAccepted = false;
          target.ownership.ownerName = `${attacker.name} Dominion`;
          target.ownership.purchased = { bank: false, buildings: false, shop: false };
        }
      } else {
        this._pushUnitFeed(`${attacker.name}'s assault on ${target.name} failed.`, 'info');
      }
    }

    this._nextAIDecisionDay = day + 2 + Math.floor(Math.random() * 2);
  }

  getInvasionPreview(srcCity, targetCity) {
    if (!srcCity || !targetCity || !this.unitManager) return null;
    if (this._unitCityRef !== srcCity) this._loadUnitsForCity(srcCity);
    const attackers = this.unitManager.units.filter((u) => u && u.hp > 0 && u.state !== 'defeated');
    let attackPower = 0;
    for (const u of attackers) attackPower += this._getUnitCombatPower(u);
    const defensePower = this._getCityDefensePower(targetCity);
    const dx = (targetCity.location?.x || 0) - (srcCity.location?.x || 0);
    const dy = (targetCity.location?.y || 0) - (srcCity.location?.y || 0);
    const distance = Math.hypot(dx, dy);
    const distancePenalty = Math.min(0.25, distance * 0.0025);
    const budgetBonus = Math.min(0.15, (srcCity.management?.budget || 0) / 5000);
    const qte = this.getWarQTEBuff();
    const qteBonus = qte ? Math.max(0, Number(qte.winBonus) || 0) : 0;
    const raw = 0.48 + ((attackPower - defensePower) * 0.008) - distancePenalty + budgetBonus + qteBonus;
    const winChance = Math.max(0.12, Math.min(0.9, raw));
    const warCost = 180 + Math.floor(distance * 2.4) + Math.max(0, Math.floor((targetCity.population - srcCity.population) * 0.12));
    return { attackPower, defensePower, winChance, warCost, distance: Math.round(distance), qteBonus };
  }

  setWarQTEBuff(payload = {}) {
    const grade = String(payload.grade || 'C').toUpperCase();
    const score = Math.max(0, Math.min(100, Math.floor(Number(payload.score) || 0)));
    const winBonus = Math.max(0, Math.min(0.3, Number(payload.winBonus) || 0));
    const lootBonus = Math.max(0, Math.min(1, Number(payload.lootBonus) || 0));
    const durationMs = Math.max(10000, Math.min(10 * 60 * 1000, Math.floor(Number(payload.durationMs) || (3 * 60 * 1000))));
    this._warQteBuff = {
      grade,
      score,
      winBonus,
      lootBonus,
      expiresAt: Date.now() + durationMs,
    };
    this._pushUnitFeed(`War QTE ${grade} (${score}) armed: +${Math.round(winBonus * 100)}% invasion, +${Math.round(lootBonus * 100)}% loot.`, 'success');
    return this._warQteBuff;
  }

  getWarQTEBuff() {
    if (!this._warQteBuff) return null;
    if (Date.now() > this._warQteBuff.expiresAt) {
      this._warQteBuff = null;
      return null;
    }
    return this._warQteBuff;
  }

  _consumeWarQTEBuff() {
    const buff = this.getWarQTEBuff();
    this._warQteBuff = null;
    return buff;
  }

  getActiveCampaigns() {
    return Array.isArray(this._activeCampaigns) ? this._activeCampaigns.slice() : [];
  }

  launchInvasion(srcCity, targetCity, qteOverride = null) {
    const p = this._getPlayerRef();
    if (!p || !srcCity || !targetCity || !this.unitManager) return { ok: false, reason: 'invalid' };
    if (typeof p.ownsCity === 'function' && p.ownsCity(targetCity)) return { ok: false, reason: 'already_owned' };
    if (this._unitCityRef !== srcCity) this._loadUnitsForCity(srcCity);
    const attackers = this.unitManager.units.filter((u) => u && u.hp > 0 && u.state !== 'defeated');
    if (attackers.length === 0) return { ok: false, reason: 'no_units' };
    const srcIdx = this.world.cities?.indexOf(srcCity);
    const tgtIdx = this.world.cities?.indexOf(targetCity);
    if (srcIdx < 0 || tgtIdx < 0) return { ok: false, reason: 'invalid' };
    const busy = this._activeCampaigns.some((c) => c.status === 'marching' && c.sourceIndex === srcIdx);
    if (busy) return { ok: false, reason: 'campaign_busy' };

    const preview = this.getInvasionPreview(srcCity, targetCity);
    if (!preview) return { ok: false, reason: 'invalid' };
    if ((srcCity.management?.budget || 0) < preview.warCost) return { ok: false, reason: 'no_money', needed: preview.warCost };
    srcCity.management.budget = Math.max(0, (srcCity.management?.budget || 0) - preview.warCost);

    const qteBuff = qteOverride || this._consumeWarQTEBuff();
    const day = this._getDaysElapsed();
    const travelDays = Math.max(1, Math.min(8, Math.ceil((preview.distance || 1) / 12)));
    const campaign = {
      id: this._nextCampaignId++,
      status: 'marching',
      controlledByPlayer: true,
      sourceIndex: srcIdx,
      targetIndex: tgtIdx,
      sourceName: srcCity.name,
      targetName: targetCity.name,
      startedDay: day,
      arrivalDay: day + travelDays,
      travelDays,
      preview,
      qteBuff,
    };
    this._activeCampaigns.push(campaign);
    this._pushUnitFeed(`Campaign launched: ${srcCity.name} -> ${targetCity.name} (ETA ${travelDays}d).`, 'info');
    this._notify(`🗺️ Army marching to ${targetCity.name}. Arrival in ${travelDays} day${travelDays > 1 ? 's' : ''}.`, 'info');
    return {
      ok: true,
      marching: true,
      campaignId: campaign.id,
      arrivalDay: campaign.arrivalDay,
      travelDays,
      warCost: preview.warCost,
      qteGrade: qteBuff?.grade || null,
    };
  }

  _resolveCampaign(campaign) {
    const p = this._getPlayerRef();
    const srcCity = this.world.cities?.[campaign.sourceIndex];
    const targetCity = this.world.cities?.[campaign.targetIndex];
    if (!p || !srcCity || !targetCity || !this.unitManager) {
      return { ok: false, reason: 'invalid' };
    }
    if (typeof p.ownsCity === 'function' && p.ownsCity(targetCity)) {
      return { ok: false, reason: 'already_owned' };
    }
    if (this._unitCityRef !== srcCity) this._loadUnitsForCity(srcCity);
    const preview = campaign.preview || this.getInvasionPreview(srcCity, targetCity);
    if (!preview) return { ok: false, reason: 'invalid' };

    let won = false;
    let qteScore = null;
    let qteThreshold = null;
    if (campaign.controlledByPlayer && campaign.qteBuff && Number.isFinite(Number(campaign.qteBuff.score))) {
      qteScore = Math.max(0, Math.min(100, Number(campaign.qteBuff.score)));
      qteThreshold = Math.max(12, Math.min(95, 52 + ((preview.defensePower - preview.attackPower) * 0.55)));
      won = qteScore >= qteThreshold;
      campaign._qteThreshold = qteThreshold;
    } else {
      won = Math.random() < preview.winChance;
    }
    let attackersLost = 0;
    const casualtyPressure = won ? (0.12 + (1 - preview.winChance) * 0.22) : (0.3 + (1 - preview.winChance) * 0.28);
    for (let i = this.unitManager.units.length - 1; i >= 0; i--) {
      const u = this.unitManager.units[i];
      if (!u || u.hp <= 0) continue;
      const roll = Math.random();
      if (roll < casualtyPressure * 0.4) {
        const dmg = Math.max(1, Math.floor(u.maxHp * (0.45 + Math.random() * 0.35)));
        u.takeDamage(dmg);
      }
      if (u.hp <= 0) {
        this.unitManager.units.splice(i, 1);
        attackersLost++;
      } else if (won) {
        const xpGain = 6 + Math.floor(preview.defensePower * 0.05);
        const lv = u.gainXp(xpGain);
        if (lv?.leveled) this._pushUnitFeed(`${u.name} reached level ${u.level} after the campaign.`, 'success');
      }
    }

    if (won) {
      if (typeof p.addOwnedCity === 'function') p.addOwnedCity(targetCity);
      targetCity._isManagedCity = true;
      if (targetCity.ownership && typeof targetCity.ownership === 'object') {
        targetCity.ownership.offerAccepted = true;
        targetCity.ownership.purchased = { bank: true, buildings: true, shop: true };
        targetCity.ownership.ownerName = `${srcCity.name} Dominion`;
      }
      if (!targetCity.management) targetCity.management = { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [], units: [] };
      if (!Array.isArray(targetCity.management.units)) targetCity.management.units = [];
      const garrisonCount = Math.max(1, Math.min(3, Math.floor(this.unitManager.units.length / 3)));
      for (let i = 0; i < garrisonCount; i++) {
        if (this.unitManager.units.length === 0) break;
        const idx = this.unitManager.units.length - 1;
        const unit = this.unitManager.units[idx];
        this.unitManager.units.splice(idx, 1);
        unit.x = targetCity.location.x;
        unit.y = targetCity.location.y;
        unit.city = targetCity;
        unit._combatCooldown = this._unitCombatCooldownMs;
        targetCity.management.units.push(unit.toJSON());
      }
      this._persistUnitsForCity(srcCity);
      const lootBonus = campaign.qteBuff ? (campaign.qteBuff.lootBonus || 0) : 0;
      const spoilsGold = Math.floor((90 + (preview.defensePower * 5)) * (1 + lootBonus));
      srcCity.management.budget = Math.max(0, (srcCity.management?.budget || 0) + spoilsGold);
      const spoilsItems = [];
      const addSpoil = (key, qty) => {
        if (qty <= 0) return;
        srcCity._addOrIncrement(key, qty);
        spoilsItems.push({ key, qty });
      };
      addSpoil('Iron', 1 + Math.floor(Math.random() * 3 + lootBonus * 3));
      addSpoil('Tools', Math.random() < (0.45 + lootBonus * 0.4) ? 1 + Math.floor(Math.random() * 2) : 0);
      addSpoil('Spices', Math.random() < (0.3 + lootBonus * 0.45) ? 1 : 0);

      const qteMsg = (qteScore !== null && qteThreshold !== null)
        ? ` QTE ${Math.round(qteScore)} vs ${Math.round(qteThreshold)}.`
        : '';
      this._notify(`⚔️ ${srcCity.name} conquered ${targetCity.name}!${qteMsg} Spoils: +${spoilsGold}g.`, 'success');
      this._pushUnitFeed(`Campaign won at ${targetCity.name}. Lost ${attackersLost} units.`, 'success');

      const allOwned = Array.isArray(this.world.cities)
        && this.world.cities.length > 0
        && (p.ownedCities?.length || 0) >= this.world.cities.length;
      if (allOwned) {
        p.isKing = true;
        this._notify(`👑 World domination achieved. You control every city.`, 'success');
        this._pushUnitFeed(`World domination completed.`, 'success');
        const gs = this._getGameStates();
        if (gs && gs.GAMEWON) this._setState(gs.GAMEWON);
      }
      return {
        ok: true,
        won: true,
        attackersLost,
        warCost: campaign.preview?.warCost || preview.warCost,
        spoilsGold,
        spoilsItems,
        qteGrade: campaign.qteBuff?.grade || null,
        qteThreshold: qteThreshold ?? campaign._qteThreshold ?? null,
      };
    }

    this._persistUnitsForCity(srcCity);
    const qteFailMsg = (qteScore !== null && qteThreshold !== null)
      ? ` QTE ${Math.round(qteScore)} vs ${Math.round(qteThreshold)}.`
      : '';
    this._notify(`❌ Invasion of ${targetCity.name} failed.${qteFailMsg}`, 'warning');
    this._pushUnitFeed(`Campaign failed at ${targetCity.name}. Lost ${attackersLost} units.`, 'error');
    return {
      ok: true,
      won: false,
      attackersLost,
      warCost: campaign.preview?.warCost || preview.warCost,
      qteGrade: campaign.qteBuff?.grade || null,
      qteThreshold: qteThreshold ?? campaign._qteThreshold ?? null,
    };
  }

  _processActiveCampaigns(day) {
    if (!Array.isArray(this._activeCampaigns) || this._activeCampaigns.length === 0) return;
    for (let i = this._activeCampaigns.length - 1; i >= 0; i--) {
      const c = this._activeCampaigns[i];
      if (!c || c.status !== 'marching') {
        this._activeCampaigns.splice(i, 1);
        continue;
      }
      if (day < (c.arrivalDay || 0)) continue;
      c.status = 'resolving';
      this._resolveCampaign(c);
      this._activeCampaigns.splice(i, 1);
    }
  }

  _grantUnitKillRewards(unit, raider, city) {
    if (!unit || !city) return;
    unit.kills = (unit.kills || 0) + 1;
    const xpGain = 8 + Math.floor((raider?.strength || 1) * 3) + ((raider?.isMonster || raider?.isPirate) ? 4 : 0);
    const xpResult = (typeof unit.gainXp === 'function') ? unit.gainXp(xpGain) : { leveled: false, level: unit.level || 1 };
    this._pushUnitFeed(`${unit.name} defeated a raider (+${xpGain} XP).`, 'success');
    if (xpResult?.leveled) {
      this._notify(`⭐ ${unit.name} reached level ${unit.level}!`, 'success');
      this._pushUnitFeed(`${unit.name} leveled up to ${unit.level}.`, 'success');
    }
  }

  _engageUnitVsRaider(unit, raider, city, opts = {}) {
    if (!unit || !raider || !city) return { ok: false, reason: 'invalid' };
    if (unit.hp <= 0 || unit.state === 'defeated') return { ok: false, reason: 'unit_dead' };
    if (raider.state === 'defeated') return { ok: false, reason: 'raider_dead' };
    if ((unit._combatCooldown || 0) > 0) return { ok: false, reason: 'cooldown' };

    const rawUnitPower = unit.attack + (unit.defense * 0.5) + ((unit.hp / Math.max(1, unit.maxHp)) * 2);
    const playerBaseline = this._getPlayerUnitPowerBaseline();
    const unitPowerCap = Math.max(3.2, playerBaseline * 0.72);
    const unitPower = Math.min(rawUnitPower, unitPowerCap);
    const raiderPower = (raider.strength || 1) + (raider.isMonster ? 2 : 0) + (raider.isPirate ? 1 : 0);
    const wallLevel = city.management?.upgradeLevels?.walls || 0;
    const hasWeaponShop = !!city.hasWeaponShop;
    const navalBonus = (unit.classKey === 'corsair' && raider.isPirate) ? 0.14 : 0;
    const contextBonus = Number(opts.contextBonus || 0);
    const isManualEngagement = opts.engagementType === 'manual';
    const postureBonus = isManualEngagement ? 0.02 : -0.03;
    const defenseBonus = (wallLevel * 0.04) + (hasWeaponShop ? 0.06 : 0) + navalBonus + contextBonus + postureBonus;
    const winChance = Math.max(0.16, Math.min(0.82, 0.46 + ((unitPower - raiderPower) * 0.10) + defenseBonus));

    const qteControl = Math.max(-1, Math.min(1, Number(opts.qteControl || 0)));
    const retaliationBias = Number(opts.retaliationBias || 0);
    const retaliationChance = Math.max(
      0.08,
      Math.min(
        0.85,
        this._unitRetaliationBaseChance
          + (raiderPower * 0.05)
          - (unit.defense * 0.02)
          - (qteControl * 0.18)
          + retaliationBias
      )
    );

    if (Math.random() < winChance) {
      let retaliationDamage = 0;
      let retaliated = false;
      if (Math.random() < retaliationChance) {
        retaliated = true;
        retaliationDamage = Math.max(1, Math.ceil(raiderPower * 0.55) - Math.floor(unit.defense * 0.5) + Math.floor(Math.random() * 3));
        unit.takeDamage(retaliationDamage);
      }

      raider.state = 'defeated';
      if (typeof raiderGrid !== 'undefined' && raiderGrid && typeof raiderGrid.remove === 'function') {
        raiderGrid.remove(raider);
      }
      const bounty = (opts.bountyBase || 12) + Math.floor((raider.strength || 1) * 4);
      city.management.budget = Math.max(0, (city.management?.budget || 0) + bounty);
      if (typeof city.adjustReputation === 'function') city.adjustReputation(1);
      this._grantUnitKillRewards(unit, raider, city);
      unit._combatCooldown = this._unitCombatCooldownMs;
      if (retaliated) {
        if (unit.hp <= 0) this._pushUnitFeed(`${unit.name} killed a raider but was lost in the counterattack.`, 'error');
        else this._pushUnitFeed(`${unit.name} won but took ${retaliationDamage} counter damage.`, 'warning');
      }
      return { ok: true, won: true, bounty, retaliated, retaliationDamage, unitDied: unit.hp <= 0 };
    }

    const failureSeverity = Math.max(0, Math.min(1, Number(opts.failureSeverity || 0)));
    const damageMultiplier = 0.82 + (failureSeverity * 0.25);
    const damage = Math.max(1, Math.ceil(raiderPower * damageMultiplier) - unit.defense + Math.floor(Math.random() * 3));
    unit.takeDamage(damage);
    unit._combatCooldown = this._unitCombatCooldownMs;
    if (unit.hp <= 0) this._pushUnitFeed(`${unit.name} fell in battle.`, 'error');
    else this._pushUnitFeed(`${unit.name} took ${damage} damage.`, 'warning');
    return { ok: true, won: false, damage, unitDied: unit.hp <= 0 };
  }

  getSelectedUnit() {
    if (!this.unitManager) return null;
    return this.unitManager.getSelected();
  }

  isRaiderTrackedByUnit(raiderRef) {
    if (!raiderRef || !this.unitManager) return false;
    const rid = (raiderRef && raiderRef.id != null) ? raiderRef.id : null;
    return this.unitManager.units.some((u) => {
      if (!u || u.state === 'defeated' || u.hp <= 0) return false;
      if (rid != null && u._chaseRaiderId != null && u._chaseRaiderId === rid) return true;
      return !!(u._chaseRaiderRef && u._chaseRaiderRef === raiderRef);
    });
  }

  selectUnitById(city, unitId) {
    if (!city || !this.unitManager) return null;
    if (this._unitCityRef !== city) this._loadUnitsForCity(city);
    const selected = this.unitManager.selectById(unitId);
    this._persistUnitsForCity(city);
    return selected;
  }

  disbandSelectedUnit(city) {
    if (!city || !this.unitManager) return { ok: false, reason: 'no_city' };
    if (this._unitCityRef !== city) this._loadUnitsForCity(city);
    const selected = this.unitManager.getSelected();
    if (!selected) return { ok: false, reason: 'no_selection' };
    this.unitManager.remove(selected);
    this._persistUnitsForCity(city);
    this._notify(`${selected.name} disbanded.`, 'info');
    return { ok: true, unit: selected };
  }

  handleUnitMapClick(city, gx, gy, opts = {}) {
    if (!city || !this.unitManager) return { handled: false };
    if (this._unitCityRef !== city) this._loadUnitsForCity(city);
    const clickedUnits = this.unitManager.getUnitsAt(gx, gy);
    if (clickedUnits.length > 0) {
      this.unitManager.deselectAll();
      clickedUnits[0].selected = true;
      this._persistUnitsForCity(city);
      return { handled: true, action: 'select', unit: clickedUnits[0] };
    }
    const selected = this.unitManager.getSelected();
    if (!selected) return { handled: false };
    const rm = this._getRaiderManager();
    const clickedRaiders = (rm && typeof rm.getRaidersInRect === 'function')
      ? rm.getRaidersInRect(gx, gx, gy, gy)
      : [];
    if (clickedRaiders.length > 0) {
      const targetRaider = clickedRaiders[0];
      const dist = Math.abs(targetRaider.x - selected.x) + Math.abs(targetRaider.y - selected.y);
      if ((selected._combatCooldown || 0) > 0) return { handled: true, action: 'cooldown', unit: selected };
      if (dist <= 1) {
        selected._chaseRaiderId = null;
        selected._chaseRaiderRef = null;
        if (opts?.requireQTE) {
          return { handled: true, action: 'attack_qte', unit: selected, raider: targetRaider };
        }
        const result = this._engageUnitVsRaider(selected, targetRaider, city, {
          bountyBase: 14,
          contextBonus: 0.03,
          engagementType: 'manual',
        });
        this.unitManager.units = this.unitManager.units.filter((u) => u && u.hp > 0 && u.state !== 'defeated');
        if (!this.unitManager.getSelected() && this.unitManager.units.length > 0) this.unitManager.units[0].selected = true;
        this._persistUnitsForCity(city);
        if (result.ok && result.won) return { handled: true, action: 'attack_win', unit: selected, bounty: result.bounty };
        if (result.ok && !result.won) return { handled: true, action: 'attack_loss', unit: selected, damage: result.damage };
      } else {
        selected._chaseRaiderId = (targetRaider && targetRaider.id != null) ? targetRaider.id : null;
        selected._chaseRaiderRef = targetRaider || null;
        selected.moveTo(gx, gy);
        this._persistUnitsForCity(city);
        return { handled: true, action: 'chase', unit: selected };
      }
    }
    const tile = this.world.grid?.[gy]?.[gx];
    const tileType = tile?.options?.[0];
    const cityMap = this.world.cityLocationMap || (typeof cityLocationMap !== 'undefined' ? cityLocationMap : null);
    const isCityTile = !!(cityMap && typeof cityMap.has === 'function' && cityMap.has(`${gx},${gy}`));
    if (!tile || (typeof selected.canTraverseTile === 'function' && !selected.canTraverseTile(tileType, isCityTile))) {
      return { handled: true, action: 'blocked' };
    }
    selected._chaseRaiderId = null;
    selected._chaseRaiderRef = null;
    selected.moveTo(gx, gy);
    this._persistUnitsForCity(city);
    return { handled: true, action: 'move', unit: selected, target: { x: gx, y: gy } };
  }

  resolveUnitRaidWithQTE(city, unitRef, raiderRef, qteScore = 50) {
    if (!city || !this.unitManager) return { ok: false, reason: 'no_city' };
    if (this._unitCityRef !== city) this._loadUnitsForCity(city);
    const unitId = (typeof unitRef === 'object' && unitRef) ? unitRef.id : unitRef;
    const raiderId = (typeof raiderRef === 'object' && raiderRef) ? raiderRef.id : raiderRef;
    const unit = this.unitManager.units.find((u) => u && (u === unitRef || (unitId != null && u.id === unitId)));
    if (!unit) return { ok: false, reason: 'unit_missing' };

    const rm = this._getRaiderManager();
    if (!rm) return { ok: false, reason: 'no_raider_manager' };
    const allRaiders = Array.isArray(rm.raiders) ? rm.raiders : [];
    const raider = allRaiders.find((r) => r && (r === raiderRef || (raiderId != null && r.id === raiderId)));
    if (!raider || raider.state === 'defeated') return { ok: false, reason: 'raider_missing' };

    const score = Math.max(0, Math.min(100, Math.floor(Number(qteScore) || 0)));
    const centered = (score - 50) / 50; // -1..1
    const qteBonus = centered * 0.12;   // -0.12..0.12 chance swing
    const result = this._engageUnitVsRaider(unit, raider, city, {
      bountyBase: 14,
      contextBonus: 0.02 + qteBonus,
      engagementType: 'manual',
      qteControl: centered,
      retaliationBias: centered < 0 ? Math.abs(centered) * 0.1 : -centered * 0.05,
      failureSeverity: centered < 0 ? Math.abs(centered) : 0,
    });
    if (result?.ok && result.won) {
      unit._chaseRaiderId = null;
      unit._chaseRaiderRef = null;
    } else if (result?.ok && !result.unitDied) {
      // Keep lock-on after a failed QTE exchange so the chase remains meaningful.
      unit._chaseRaiderId = (raider && raider.id != null) ? raider.id : unit._chaseRaiderId;
      unit._chaseRaiderRef = raider || unit._chaseRaiderRef;
      if (Number.isFinite(raider?.x) && Number.isFinite(raider?.y)) unit.moveTo(raider.x, raider.y);
    } else {
      unit._chaseRaiderId = null;
      unit._chaseRaiderRef = null;
    }
    this.unitManager.units = this.unitManager.units.filter((u) => u && u.hp > 0 && u.state !== 'defeated');
    if (!this.unitManager.getSelected() && this.unitManager.units.length > 0) this.unitManager.units[0].selected = true;
    this._persistUnitsForCity(city);
    return { ...result, qteScore: score };
  }

  _startUnitRaidQTE(city, unit, raider) {
    if (!city || !unit || !raider) return false;
    if (typeof window === 'undefined' || typeof window._runUnitRaidQTE !== 'function') return false;
    if (window._unitRaidQTEActive || window._invasionQTEActive) return true;

    const lockId = (raider.id != null) ? `id:${raider.id}` : `ref:${Date.now()}`;
    if (unit._pendingRaidQTE === lockId) return true;
    unit._pendingRaidQTE = lockId;

    window._runUnitRaidQTE(unit, raider, (qte) => {
      try {
        const finalRes = this.resolveUnitRaidWithQTE(city, unit, raider, qte?.score);
        if (!finalRes || !finalRes.ok) {
          this._notify(`Skirmish with ${raider.name || 'raider'} failed to resolve.`, 'warning');
          return;
        }
        if (finalRes.won) this._notify(`${unit.name} defeated the raider!`, 'success');
        else if (finalRes.unitDied) this._notify(`${unit.name} fell in battle.`, 'error');
        else this._notify(`${unit.name} was repelled and took ${finalRes.damage} damage.`, 'warning');
      } catch (_e) {
        this._notify('Skirmish QTE resolution failed.', 'error');
      } finally {
        unit._pendingRaidQTE = null;
      }
    });
    return true;
  }

  renderUnits(tileSize = 32) {
    if (!this.unitManager || !this._unitCityRef) return;
    this.unitManager.render(tileSize);
  }

  _resolveUnitRaiderSkirmishes(dt) {
    if (!this.unitManager || !this._unitCityRef) return;
    const rm = this._getRaiderManager();
    if (!rm) return;
    const myCity = this._unitCityRef;
    const cityLoc = myCity?.location;
    if (!cityLoc) return;

    const localRaiders = (typeof rm.getRaidersInRect === 'function')
      ? rm.getRaidersInRect(cityLoc.x - 14, cityLoc.x + 14, cityLoc.y - 14, cityLoc.y + 14)
      : (Array.isArray(rm.raiders) ? rm.raiders : []);
    const allRaiders = Array.isArray(rm.raiders) ? rm.raiders : [];
    if ((!localRaiders || localRaiders.length === 0) && allRaiders.length === 0) return;

    const bountyBase = 18;
    let raidersDefeated = 0;
    let unitsLost = 0;
    let totalDamageTaken = 0;
    let damageEvents = 0;
    for (const unit of this.unitManager.units) {
      if (!unit || unit.state === 'defeated' || unit.hp <= 0) continue;
      if (unit._combatCooldown > 0) continue;

      let target = null;
      let bestDist = Infinity;
      let isManualChase = false;

      // Manual chase order: keep following the clicked raider while it lives.
      if (unit._chaseRaiderId != null || unit._chaseRaiderRef) {
        const ordered = allRaiders.find((r) =>
          r
          && r.state !== 'defeated'
          && (r === unit._chaseRaiderRef || (unit._chaseRaiderId != null && r.id === unit._chaseRaiderId))
        );
        if (ordered) {
          target = ordered;
          bestDist = Math.abs(ordered.x - unit.x) + Math.abs(ordered.y - unit.y);
          isManualChase = true;
        } else {
          // Raider no longer exists or was defeated.
          unit._chaseRaiderId = null;
          unit._chaseRaiderRef = null;
          if (unit.state === 'moving') {
            unit.target = null;
            unit.path = [];
            unit.state = 'idle';
          }
        }
      }

      if (!target) {
        for (const r of localRaiders) {
          if (!r || r.state === 'defeated') continue;
          const dist = Math.abs(r.x - unit.x) + Math.abs(r.y - unit.y);
          if (dist < bestDist) {
            bestDist = dist;
            target = r;
          }
        }
      }
      if (!target) continue;
      if (bestDist > 1) {
        const targetTile = this.world.grid?.[target.y]?.[target.x];
        const targetType = targetTile?.options?.[0];
        const cityMap = this.world.cityLocationMap || (typeof cityLocationMap !== 'undefined' ? cityLocationMap : null);
        const isCityTile = !!(cityMap && typeof cityMap.has === 'function' && cityMap.has(`${target.x},${target.y}`));
        const canPursue = isManualChase ? true : (bestDist <= 5);
        if (canPursue && unit.canTraverseTile(targetType, isCityTile)) {
          // Keep refreshing destination so units follow moving raiders.
          unit.moveTo(target.x, target.y);
        } else if (canPursue && isManualChase) {
          // Try adjacent tiles around target so chase doesn't stall on occupied/blocked target tile.
          const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          let fallback = null;
          let fallbackDist = Infinity;
          for (const [dx, dy] of dirs) {
            const nx = target.x + dx;
            const ny = target.y + dy;
            const ntile = this.world.grid?.[ny]?.[nx];
            const ntype = ntile?.options?.[0];
            const nisCity = !!(cityMap && typeof cityMap.has === 'function' && cityMap.has(`${nx},${ny}`));
            if (!ntile || !unit.canTraverseTile(ntype, nisCity)) continue;
            const nd = Math.abs(nx - unit.x) + Math.abs(ny - unit.y);
            if (nd < fallbackDist) {
              fallbackDist = nd;
              fallback = { x: nx, y: ny };
            }
          }
          if (fallback) unit.moveTo(fallback.x, fallback.y);
        }
        continue;
      }

      // Manual chase should resolve through QTE when contact is made.
      if (isManualChase) {
        if (this._startUnitRaidQTE(myCity, unit, target)) continue;
      }

      const result = this._engageUnitVsRaider(unit, target, myCity, {
        bountyBase,
        engagementType: 'auto',
        contextBonus: -0.03,
        retaliationBias: 0.08,
      });
      if (!result.ok) continue;
      if (result.won) {
        unit._chaseRaiderId = null;
        unit._chaseRaiderRef = null;
        raidersDefeated++;
      } else if (result.unitDied) {
        unit._chaseRaiderId = null;
        unit._chaseRaiderRef = null;
        unitsLost++;
      } else {
        // Stay locked on this raider after a failed exchange so unit keeps pursuing.
        if (target && target.id != null) unit._chaseRaiderId = target.id;
        unit._chaseRaiderRef = target;
        if (result.damage) {
          totalDamageTaken += result.damage;
          damageEvents++;
        }
      }
    }

    const before = this.unitManager.units.length;
    this.unitManager.units = this.unitManager.units.filter((u) => u && u.hp > 0 && u.state !== 'defeated');
    if (before !== this.unitManager.units.length && !this.unitManager.getSelected() && this.unitManager.units.length > 0) {
      this.unitManager.units[0].selected = true;
    }
    this._persistUnitsForCity(myCity);

    const now = Date.now();
    if (now - this._lastUnitCombatNotifyMs >= 800) {
      if (raidersDefeated > 0) this._notify(`🛡️ Units defeated ${raidersDefeated} raider${raidersDefeated > 1 ? 's' : ''}.`, 'success');
      if (unitsLost > 0) this._notify(`💀 Lost ${unitsLost} unit${unitsLost > 1 ? 's' : ''} in combat.`, 'error');
      if (damageEvents > 0 && unitsLost === 0) this._notify(`⚔️ Units took ${totalDamageTaken} damage across ${damageEvents} skirmish${damageEvents > 1 ? 'es' : ''}.`, 'warning');
      if (raidersDefeated > 0 || unitsLost > 0 || damageEvents > 0) this._lastUnitCombatNotifyMs = now;
    }
  }

  /**
   * Try to intercept an incoming raider with a nearby city unit.
   * Called from the city-raid resolution path so units can actively defend.
   */
  tryUnitIntercept(city, raider) {
    if (!city || !raider || !this.unitManager) return { attempted: false, intercepted: false };
    if (this._unitCityRef !== city) this._loadUnitsForCity(city);
    const activeUnits = this.unitManager.units.filter((u) => u && u.hp > 0 && u.state !== 'defeated' && u._combatCooldown <= 0);
    if (activeUnits.length === 0) return { attempted: false, intercepted: false };

    let defender = null;
    let bestDist = Infinity;
    for (const unit of activeUnits) {
      const dist = Math.abs(unit.x - raider.x) + Math.abs(unit.y - raider.y);
      if (dist < bestDist) {
        bestDist = dist;
        defender = unit;
      }
    }
    // Allow intercept if unit is close enough to respond around the city.
    if (!defender || bestDist > 3) return { attempted: false, intercepted: false };

    const result = this._engageUnitVsRaider(defender, raider, city, {
      bountyBase: 12,
      engagementType: 'auto',
      contextBonus: -0.04,
      retaliationBias: 0.1,
    });
    this.unitManager.units = this.unitManager.units.filter((u) => u && u.hp > 0 && u.state !== 'defeated');
    if (!this.unitManager.getSelected() && this.unitManager.units.length > 0) {
      this.unitManager.units[0].selected = true;
    }
    this._persistUnitsForCity(city);
    if (!result.ok) return { attempted: true, intercepted: false, unit: defender };
    if (result.won) {
      if (result.retaliated && result.unitDied) {
        this._notify(`🛡️ ${defender.name} intercepted a raider (+${result.bounty}g) but died to the counterattack.`, 'warning');
      } else if (result.retaliated) {
        this._notify(`🛡️ ${defender.name} intercepted a raider (+${result.bounty}g) and took ${result.retaliationDamage} damage.`, 'success');
      } else {
        this._notify(`🛡️ ${defender.name} intercepted a raider before it hit the city (+${result.bounty}g).`, 'success');
      }
      return { attempted: true, intercepted: true, unit: defender };
    }
    if (result.unitDied) {
      this._notify(`💀 ${defender.name} was killed intercepting raiders.`, 'error');
    } else {
      this._notify(`⚔️ ${defender.name} failed to intercept and took ${result.damage} damage.`, 'warning');
    }
    return { attempted: true, intercepted: false, unit: defender };
  }

  // ─── Main tick (called every frame from draw) ──────────
  tick(dt) {
    if (!this.world.cities) return;
    const day = this._getDaysElapsed();

    // Per-frame: tick all city build queues
    for (const c of this.world.cities) {
      if (typeof c.tickManagement === 'function') c.tickManagement(dt);
    }

    if (this.unitManager && this._unitCityRef) {
      this.unitManager.update(dt);
      this._persistUnitsForCity(this._unitCityRef);
      this._resolveUnitRaiderSkirmishes(dt);
    }

    // Check city event timeout every frame
    this._checkCityEventTimeout();

    // Daily processing (once per day)
    if (day !== this._lastProcessedDay && day > 0) {
      this._lastProcessedDay = day;

      // Update wealth ranking & victory check
      this._updateWealthRanking();

      // Spawn demand quests periodically
      if (day >= this._nextQuestDay) {
        this._generateDemandQuest(day);
        this._nextQuestDay = day + this._questInterval + Math.floor(Math.random() * 3);
      }

      // Expire old quests
      for (let i = this.demandQuests.length - 1; i >= 0; i--) {
        if (this.demandQuests[i].deadline <= day) {
          const q = this.demandQuests[i];
          this._notify(`Quest expired: ${q.cityName} no longer needs ${q.itemName}`, 'error');
          this.demandQuests.splice(i, 1);
        }
      }

      // Trigger random city events (every 5-10 days once settled)
      if (this.isSettled && day >= this._nextEventDay) {
        this._triggerCityEvent(day);
        this._nextEventDay = day + 5 + Math.floor(Math.random() * 6);
      }
      // Daily tax + route processing (previously weekly)
      for (const c of this.world.cities) {
        if (typeof c.applyWeeklyTax === 'function') c.applyWeeklyTax(1); // apply 1 day worth
        this._processRoutes(c, day);
        this._musterAICityUnits(c, day);
      }
      this._processActiveCampaigns(day);
      this._runAICityWarfare(day);
    }
  }

  // ─── Serialization ──────────────────────────────────────
  toJSON() {
    if (this._unitCityRef) this._persistUnitsForCity(this._unitCityRef);
    return {
      selectedCityIndex: this.selectedCityIndex,
      myCityIndex: this.myCityIndex,
      myCityRef: this.myCity && this.myCity.location
        ? {
            name: this.myCity.name || null,
            location: {
              x: Number(this.myCity.location.x),
              y: Number(this.myCity.location.y),
            },
          }
        : null,
      isSettled: this.isSettled,
      demandQuests: this.demandQuests,
      richestStreak: this.richestStreak,
      won: this.won,
      _nextQuestDay: this._nextQuestDay,
      _nextEventDay: this._nextEventDay,
      _nextUnitId: this._nextUnitId,
      _nextAIDecisionDay: this._nextAIDecisionDay,
      _nextCampaignId: this._nextCampaignId,
      activeCampaigns: this._activeCampaigns,
      _lastProcessedDay: this._lastProcessedDay,
      _lastWeekDay: this._lastWeekDay,
      selectedUnitId: this.getSelectedUnit()?.id ?? null,
      activeCityEvent: this._activeCityEvent ? {
        name: this._activeCityEvent.name,
        triggered: this._activeCityEvent.triggered || this._getDaysElapsed(),
        remainingMs: this.getCityEventTimerRemainingMs(),
      } : null,
    };
  }

  static fromJSON(obj, world, services = {}) {
    const cm = new CityManagement(world, services);
    if (!obj) return cm;
    cm.demandQuests = obj.demandQuests || [];
    cm.richestStreak = obj.richestStreak || 0;
    cm.won = obj.won || false;
    cm._nextQuestDay = obj._nextQuestDay || 3;
    cm._nextEventDay = obj._nextEventDay || 5;
    cm._nextUnitId = Math.max(1, Number(obj._nextUnitId) || 1);
    cm._nextAIDecisionDay = Math.max(1, Number(obj._nextAIDecisionDay) || 4);
    cm._nextCampaignId = Math.max(1, Number(obj._nextCampaignId) || 1);
    cm._activeCampaigns = Array.isArray(obj.activeCampaigns) ? obj.activeCampaigns : [];
    cm._lastProcessedDay = obj._lastProcessedDay || -1;
    cm._lastWeekDay = obj._lastWeekDay || -1;
    // Restore settlement (prefer stable city reference over raw index).
    const resolveMyCityIndex = () => {
      const all = Array.isArray(world.cities) ? world.cities : [];
      const rawIdx = Number(obj.myCityIndex);
      const ref = obj.myCityRef || null;
      const rx = Number(ref?.location?.x);
      const ry = Number(ref?.location?.y);
      const rn = (typeof ref?.name === 'string') ? ref.name : null;
      if (Number.isFinite(rx) && Number.isFinite(ry)) {
        const byLoc = all.findIndex((c) => c?.location?.x === rx && c?.location?.y === ry);
        if (byLoc >= 0) return byLoc;
      }
      if (rn) {
        const byName = all.findIndex((c) => c?.name === rn);
        if (byName >= 0) return byName;
      }
      if (Number.isFinite(rawIdx) && rawIdx >= 0 && rawIdx < all.length) return rawIdx;
      return -1;
    };
    const restoredMyCityIdx = resolveMyCityIndex();
    if (obj.isSettled && restoredMyCityIdx >= 0 && world.cities?.[restoredMyCityIdx]) {
      cm.myCity = world.cities[restoredMyCityIdx];
      cm.myCityIndex = restoredMyCityIdx;
      cm.isSettled = true;
      cm.myCity._isManagedCity = true;
      cm.selectCity(cm.myCity);
    } else if (typeof obj.selectedCityIndex === 'number' && obj.selectedCityIndex >= 0 && world.cities?.[obj.selectedCityIndex]) {
      cm.selectCity(world.cities[obj.selectedCityIndex]);
    }
    if (obj.activeCityEvent && cm.isSettled && cm.myCity) {
      const eventDefs = cm._initCityEvents();
      const def = eventDefs.find(e => e.name === obj.activeCityEvent.name);
      if (def) {
        const remainingMs = Math.max(0, Math.floor(Number(obj.activeCityEvent.remainingMs) || 0));
        cm._activeCityEvent = {
          ...def,
          triggered: Number(obj.activeCityEvent.triggered) || cm._getDaysElapsed(),
          deadlineGameTimeMs: remainingMs > 0 ? (cm._getCurrentGameTimeMs() + remainingMs) : 0,
          deadlineWallTimeMs: remainingMs > 0 ? (Date.now() + remainingMs) : 0,
        };
        window._cityEventActive = cm._activeCityEvent;
        cm._scheduleActiveCityEventTimeout();
      }
    }
    if (obj.selectedUnitId && cm.selectedCity && typeof cm.selectUnitById === 'function') {
      cm.selectUnitById(cm.selectedCity, obj.selectedUnitId);
    }
    return cm;
  }
}

window.CityManagement = CityManagement;
