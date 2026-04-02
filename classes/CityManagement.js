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
    this._eventIntervalDays = 5;    // deterministic cadence after first trigger
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
    this._unitPersistIntervalMs = 750;
    this._unitPersistAccumMs = 0;
    this._nextAIDecisionDay = 4;
    this._lastPlayerInvasionDay = -999;
    this._playerInvasionCooldownDays = 4;
    this._pendingPlayerInvasions = [];
    this._nextPlayerInvasionId = 1;
    this._activeCampaigns = [];
    this._nextCampaignId = 1;

    // ─── New systems (v6) ───────────────────────────────
    this.diplomacy = (typeof DiplomacySystem !== 'undefined') ? new DiplomacySystem() : null;
    this.espionage = (typeof EspionageSystem !== 'undefined') ? new EspionageSystem() : null;
    this.advisors  = (typeof CityAdvisors !== 'undefined') ? new CityAdvisors() : null;

    this._onDayChanged = (e) => {
      const d = Number(e?.detail?.daysElapsed);
      const day = Number.isFinite(d) ? d : this._getDaysElapsed();
      this._processDaily(day);
    };
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('dayChanged', this._onDayChanged);
    }
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

  _getOwnedCityRefs() {
    const p = this._getPlayerRef();
    const owned = [];
    const seen = new Set();
    const addCity = (city) => {
      if (!city || seen.has(city)) return;
      seen.add(city);
      owned.push(city);
    };

    if (p && typeof p.getOwnedCities === 'function') {
      const refs = p.getOwnedCities();
      if (Array.isArray(refs)) {
        for (const city of refs) addCity(city);
      }
    } else if (p && Array.isArray(p.ownedCities) && Array.isArray(this.world.cities)) {
      for (const idx of p.ownedCities) addCity(this.world.cities[idx]);
    }

    addCity(this.myCity);
    return owned;
  }

  _getCityWealthValue(city, opts = {}) {
    if (!city) return 0;
    const includeOwnerPayout = !!(opts && opts.includeOwnerPayout);
    let wealth = Math.max(0, Math.floor(Number(city.management?.budget) || 0));
    if (includeOwnerPayout) {
      wealth += Math.max(0, Math.floor(Number(city.management?.ownerPayoutDue) || 0));
    }
    if (city.inventory && typeof city.inventory[Symbol.iterator] === 'function') {
      for (const [key, entry] of city.inventory) {
        wealth += (entry.quantity || 0) * (ItemLibrary[key]?.baseValue || 5);
      }
    }
    return wealth;
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

  _normalizeCityFeedEntries(entries) {
    return Array.isArray(entries)
      ? entries
        .map((entry) => ({
          day: Math.max(0, Math.floor(Number(entry?.day) || 0)),
          ts: Math.max(0, Math.floor(Number(entry?.ts) || 0)),
          type: (typeof entry?.type === 'string' && entry.type.trim()) ? entry.type.trim() : 'info',
          category: (typeof entry?.category === 'string' && entry.category.trim()) ? entry.category.trim() : 'city',
          message: (typeof entry?.message === 'string') ? entry.message.trim() : '',
        }))
        .filter((entry) => entry.message)
        .slice(0, 24)
      : [];
  }

  _normalizeCityDailySnapshot(entry) {
    if (!entry || typeof entry !== 'object') return null;
    return {
      day: Math.max(0, Math.floor(Number(entry.day) || 0)),
      budget: Math.max(0, Math.floor(Number(entry.budget) || 0)),
      payoutDue: Math.max(0, Math.floor(Number(entry.payoutDue) || 0)),
      population: Math.max(0, Math.floor(Number(entry.population) || 0)),
      reputation: Number.isFinite(Number(entry.reputation)) ? Number(entry.reputation) : 0,
      foodDays: Math.max(0, Math.floor(Number(entry.foodDays) || 0)),
      happiness: Number.isFinite(Number(entry.happiness)) ? Number(entry.happiness) : 0,
      routeCompleted: Math.max(0, Math.floor(Number(entry.routeCompleted) || 0)),
      routeLost: Math.max(0, Math.floor(Number(entry.routeLost) || 0)),
      queueCount: Math.max(0, Math.floor(Number(entry.queueCount) || 0)),
      developmentScore: Math.max(0, Math.floor(Number(entry.developmentScore) || 0)),
      unitCount: Math.max(0, Math.floor(Number(entry.unitCount) || 0)),
      unitHpTotal: Math.max(0, Math.floor(Number(entry.unitHpTotal) || 0)),
      directiveCount: Math.max(0, Math.floor(Number(entry.directiveCount) || 0)),
    };
  }

  _normalizeCityDailyBrief(entry) {
    if (!entry || typeof entry !== 'object') return null;
    return {
      day: Math.max(0, Math.floor(Number(entry.day) || 0)),
      headline: (typeof entry.headline === 'string') ? entry.headline : '',
      tone: (typeof entry.tone === 'string' && entry.tone.trim()) ? entry.tone.trim() : 'neutral',
      budgetDelta: Math.floor(Number(entry.budgetDelta) || 0),
      payoutDelta: Math.floor(Number(entry.payoutDelta) || 0),
      populationDelta: Math.floor(Number(entry.populationDelta) || 0),
      reputationDelta: Number.isFinite(Number(entry.reputationDelta)) ? Number(entry.reputationDelta) : 0,
      foodDays: Math.max(0, Math.floor(Number(entry.foodDays) || 0)),
      foodDelta: Math.floor(Number(entry.foodDelta) || 0),
      routeCompletedDelta: Math.max(0, Math.floor(Number(entry.routeCompletedDelta) || 0)),
      routeLostDelta: Math.max(0, Math.floor(Number(entry.routeLostDelta) || 0)),
      developmentDelta: Math.max(0, Math.floor(Number(entry.developmentDelta) || 0)),
      unitHpDelta: Math.floor(Number(entry.unitHpDelta) || 0),
      alerts: Array.isArray(entry.alerts)
        ? entry.alerts
          .map((alert) => ({
            label: (typeof alert?.label === 'string') ? alert.label : '',
            detail: (typeof alert?.detail === 'string') ? alert.detail : '',
            tone: (typeof alert?.tone === 'string' && alert.tone.trim()) ? alert.tone.trim() : '#d7e3f2',
            tabKey: (typeof alert?.tabKey === 'string' && alert.tabKey.trim()) ? alert.tabKey.trim() : null,
          }))
          .filter((alert) => alert.label)
          .slice(0, 4)
        : [],
    };
  }

  _pushCityFeed(city, message, type = 'info', opts = {}) {
    if (!city || typeof message !== 'string' || !message.trim()) return null;
    this._ensureManagement(city);
    const entry = {
      day: Math.max(0, Math.floor(Number(opts.day) || this._getDaysElapsed())),
      ts: Date.now(),
      type,
      category: (typeof opts.category === 'string' && opts.category.trim()) ? opts.category.trim() : 'city',
      message: message.trim(),
    };
    city.management.activityFeed.unshift(entry);
    city.management.activityFeed = city.management.activityFeed.slice(0, 24);
    return entry;
  }

  getCityFeed(city, limit = 12) {
    this._ensureManagement(city);
    return Array.isArray(city?.management?.activityFeed)
      ? city.management.activityFeed.slice(0, Math.max(1, Math.floor(Number(limit) || 12)))
      : [];
  }

  _getCityDevelopmentScore(city) {
    if (!city) return 0;
    const features = [
      city.hasBank,
      city.hasGamblingDen,
      city.hasBountyBoard,
      city.hasWeaponShop,
      city.hasWinery,
      city.hasSchool,
      city.hasBlackMarket,
    ].filter(Boolean).length;
    const upgrades = Object.values(city.management?.upgradeLevels || {}).reduce((sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)), 0);
    const districts = Object.values(city.management?.districts || {}).reduce((sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)), 0);
    return features + upgrades + districts;
  }

  _buildCityDailySnapshot(city, day = this._getDaysElapsed()) {
    if (!city) return null;
    this._ensureManagement(city);
    const food = this.getFoodStatus(city);
    const routes = Array.isArray(city.management?.routes) ? city.management.routes : [];
    const units = Array.isArray(city.management?.units) ? city.management.units : [];
    return {
      day: Math.max(0, Math.floor(Number(day) || 0)),
      budget: Math.max(0, Math.floor(Number(city.management?.budget) || 0)),
      payoutDue: Math.max(0, Math.floor(Number(city.management?.ownerPayoutDue) || 0)),
      population: Math.max(0, Math.floor(Number(city.population) || 0)),
      reputation: Number(city.reputation) || 0,
      foodDays: Math.max(0, Math.floor(Number(food?.daysLeft) || 0)),
      happiness: Number(this.getHappiness(city)) || 0,
      routeCompleted: routes.reduce((sum, route) => sum + Math.max(0, Math.floor(Number(route?.shipmentsCompleted) || 0)), 0),
      routeLost: routes.reduce((sum, route) => sum + Math.max(0, Math.floor(Number(route?.shipmentsLost) || 0)), 0),
      queueCount: routes && city.management?.buildingQueue ? city.management.buildingQueue.length : 0,
      developmentScore: this._getCityDevelopmentScore(city),
      unitCount: units.reduce((sum, unit) => sum + (((Number(unit?.hp) || 0) > 0 && unit?.state !== 'defeated') ? 1 : 0), 0),
      unitHpTotal: units.reduce((sum, unit) => sum + Math.max(0, Math.floor(Number(unit?.hp) || 0)), 0),
      directiveCount: Array.isArray(city.management?.directives) ? city.management.directives.length : 0,
    };
  }

  _buildCityDailyBrief(city, previousSnapshot, nextSnapshot) {
    if (!city || !nextSnapshot) return null;
    const previous = previousSnapshot || nextSnapshot;
    const budgetDelta = nextSnapshot.budget - previous.budget;
    const payoutDelta = nextSnapshot.payoutDue - previous.payoutDue;
    const populationDelta = nextSnapshot.population - previous.population;
    const reputationDelta = +(nextSnapshot.reputation - previous.reputation).toFixed(1);
    const foodDelta = nextSnapshot.foodDays - previous.foodDays;
    const routeCompletedDelta = Math.max(0, nextSnapshot.routeCompleted - previous.routeCompleted);
    const routeLostDelta = Math.max(0, nextSnapshot.routeLost - previous.routeLost);
    const developmentDelta = Math.max(0, nextSnapshot.developmentScore - previous.developmentScore);
    const unitHpDelta = nextSnapshot.unitHpTotal - previous.unitHpTotal;
    const alerts = [];
    if (nextSnapshot.foodDays <= 3) {
      alerts.push({ label: 'Food Critical', detail: `${nextSnapshot.foodDays} day${nextSnapshot.foodDays === 1 ? '' : 's'} of food left.`, tone: '#ef9a9a', tabKey: 'build' });
    } else if (foodDelta < 0) {
      alerts.push({ label: 'Food Falling', detail: `Reserves dropped by ${Math.abs(foodDelta)} day${Math.abs(foodDelta) === 1 ? '' : 's'}.`, tone: '#ffcc80', tabKey: 'build' });
    }
    if (routeLostDelta > 0) {
      alerts.push({ label: 'Routes Hit', detail: `${routeLostDelta} convoy${routeLostDelta === 1 ? '' : 's'} failed yesterday.`, tone: '#ffb74d', tabKey: 'trade' });
    }
    if (unitHpDelta < 0) {
      alerts.push({ label: 'Garrison Hurt', detail: `${Math.abs(unitHpDelta)} total HP lost across city units.`, tone: '#ef9a9a', tabKey: 'units' });
    }
    if (nextSnapshot.directiveCount > 0) {
      alerts.push({ label: 'Directives Open', detail: `${nextSnapshot.directiveCount} city directive${nextSnapshot.directiveCount === 1 ? '' : 's'} waiting on action.`, tone: '#d6c6ff', tabKey: 'quests' });
    }

    let headline = 'City held steady through the day.';
    let tone = 'neutral';
    if (routeLostDelta > 0) {
      headline = `${routeLostDelta} convoy${routeLostDelta === 1 ? '' : 's'} were disrupted on the trade lanes.`;
      tone = 'warning';
    } else if (budgetDelta >= 60) {
      headline = `Treasury climbed by ${budgetDelta}g over the last day.`;
      tone = 'good';
    } else if (developmentDelta > 0) {
      headline = `New development completed and the city footprint expanded.`;
      tone = 'good';
    } else if (populationDelta > 0) {
      headline = `${populationDelta} new citizens joined the city yesterday.`;
      tone = 'good';
    } else if (populationDelta < 0) {
      headline = `${Math.abs(populationDelta)} citizens were lost over the last day.`;
      tone = 'warning';
    } else if (unitHpDelta < 0) {
      headline = `The garrison took ${Math.abs(unitHpDelta)} damage holding the frontier.`;
      tone = 'warning';
    }

    return {
      day: nextSnapshot.day,
      headline,
      tone,
      budgetDelta,
      payoutDelta,
      populationDelta,
      reputationDelta,
      foodDays: nextSnapshot.foodDays,
      foodDelta,
      routeCompletedDelta,
      routeLostDelta,
      developmentDelta,
      unitHpDelta,
      alerts,
    };
  }

  _updateCityDailyBrief(city, day = this._getDaysElapsed()) {
    if (!city) return null;
    this._ensureManagement(city);
    const nextSnapshot = this._buildCityDailySnapshot(city, day);
    const previousSnapshot = city.management.dailySnapshot || null;
    city.management.dailyBrief = this._buildCityDailyBrief(city, previousSnapshot, nextSnapshot);
    city.management.dailySnapshot = nextSnapshot;
    return city.management.dailyBrief;
  }

  getCityDailyBrief(city, day = this._getDaysElapsed()) {
    this._ensureManagement(city);
    if (!city.management.dailyBrief || !city.management.dailySnapshot || city.management.dailySnapshot.day !== Math.max(0, Math.floor(Number(day) || 0))) {
      return this._updateCityDailyBrief(city, day);
    }
    return city.management.dailyBrief;
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

  onExit() {
    if (this._unitCityRef) this._persistUnitsForCity(this._unitCityRef);
    this._clearCityEventTimer();
    if (typeof window !== 'undefined' && this._onDayChanged && typeof window.removeEventListener === 'function') {
      window.removeEventListener('dayChanged', this._onDayChanged);
      this._onDayChanged = null;
    }
  }

  destroy() {
    this.onExit();
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
        accuracy: Math.max(0.4, Math.min(0.95, Number.isFinite(Number(u?.accuracy)) ? Number(u.accuracy) : 0.72)),
        critChance: Math.max(0, Math.min(0.5, Number.isFinite(Number(u?.critChance)) ? Number(u.critChance) : 0.08)),
        state: (u?.state === 'moving' || u?.state === 'fighting') ? u.state : 'idle',
        direction: (u?.direction === 'left' || u?.direction === 'right' || u?.direction === 'up') ? u.direction : 'down',
        classKey: (typeof u?.classKey === 'string' && u.classKey.trim()) ? u.classKey : 'militia',
        movementType: (u?.movementType === 'naval') ? 'naval' : 'land',
        attackRangeMin: Math.max(1, Math.floor(Number(u?.attackRangeMin) || 1)),
        attackRangeMax: Math.max(
          Math.max(1, Math.floor(Number(u?.attackRangeMin) || 1)),
          Math.floor(Number(u?.attackRangeMax) || Number(u?.attackRangeMin) || 1)
        ),
        reactionRange: Math.max(
          Math.max(
            Math.max(1, Math.floor(Number(u?.attackRangeMin) || 1)),
            Math.floor(Number(u?.attackRangeMax) || Number(u?.attackRangeMin) || 1)
          ),
          Math.floor(Number(u?.reactionRange) || Number(u?.attackRangeMax) || Number(u?.attackRangeMin) || 1)
        ),
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
      ownerPayoutDue: Math.max(0, Math.floor(Number(m.ownerPayoutDue) || 0)),
      ownerTaxShare: Math.max(0.10, Math.min(0.80, Number.isFinite(Number(m.ownerTaxShare)) ? Number(m.ownerTaxShare) : 0.35)),
      districts: this._normalizeDistrictState(m.districts),
      districtEffects: this._sanitizeEffectMap(m.districtEffects),
      focusKey: (typeof m.focusKey === 'string' && CityManagement.FOCUS_DEFS[m.focusKey]) ? m.focusKey : 'balanced',
      focusEffects: this._sanitizeEffectMap(m.focusEffects),
      activeOperations: this._normalizeActiveOperations(m.activeOperations),
      operationBuffs: this._normalizeOperationBuffs(m.operationBuffs),
      operationHistory: Array.isArray(m.operationHistory) ? m.operationHistory.slice(-12).map((entry) => ({
        key: typeof entry?.key === 'string' ? entry.key : 'unknown',
        label: typeof entry?.label === 'string' ? entry.label : 'Operation',
        completedDay: Math.max(0, Math.floor(Number(entry?.completedDay) || 0)),
        summary: typeof entry?.summary === 'string' ? entry.summary : '',
      })) : [],
      operationCooldowns: (m.operationCooldowns && typeof m.operationCooldowns === 'object') ? { ...m.operationCooldowns } : {},
      directives: this._normalizeDirectiveEntries(m.directives),
      directiveHistory: this._normalizeDirectiveEntries(m.directiveHistory),
      directiveCooldowns: (m.directiveCooldowns && typeof m.directiveCooldowns === 'object') ? { ...m.directiveCooldowns } : {},
      activityFeed: this._normalizeCityFeedEntries(m.activityFeed),
      dailySnapshot: this._normalizeCityDailySnapshot(m.dailySnapshot),
      dailyBrief: this._normalizeCityDailyBrief(m.dailyBrief),
    };
    if (Object.keys(city.management.focusEffects).length <= 0) {
      city.management.focusEffects = {
        ...(CityManagement.FOCUS_DEFS[city.management.focusKey]?.effects || {}),
      };
    }
    if (Object.keys(city.management.districtEffects).length <= 0) {
      city.management.districtEffects = CityManagement.computeDistrictEffects(city.management.districts);
    }
    this._pruneExpiredCityBonuses(city);
    for (const u of units) {
      if (Number.isFinite(u.id)) this._nextUnitId = Math.max(this._nextUnitId, u.id + 1);
    }
    return city.management;
  }

  _sanitizeEffectMap(raw) {
    const allowed = new Set([
      'happiness',
      'routeIncome',
      'taxIncome',
      'buildSpeed',
      'productionChance',
      'productionDouble',
      'popGrowth',
      'defense',
      'unitCap',
      'unitCostDiscount',
      'foodSaving',
    ]);
    const out = {};
    const src = (raw && typeof raw === 'object') ? raw : {};
    for (const [key, value] of Object.entries(src)) {
      if (!allowed.has(key)) continue;
      const num = Number(value);
      if (!Number.isFinite(num) || Math.abs(num) < 0.0001) continue;
      out[key] = num;
    }
    return out;
  }

  _normalizeDistrictState(raw) {
    const src = (raw && typeof raw === 'object') ? raw : {};
    const out = {};
    for (const [key, def] of Object.entries(CityManagement.DISTRICT_DEFS || {})) {
      const tier = Math.max(0, Math.min(def.tiers.length, Math.floor(Number(src[key]) || 0)));
      if (tier > 0) out[key] = tier;
    }
    return out;
  }

  _refreshDistrictEffects(city) {
    if (!city) return {};
    this._ensureManagement(city);
    city.management.districtEffects = CityManagement.computeDistrictEffects(city.management.districts);
    return city.management.districtEffects;
  }

  _normalizeActiveOperations(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry) => ({
        key: (typeof entry?.key === 'string' && CityManagement.OPERATION_DEFS[entry.key]) ? entry.key : null,
        label: (typeof entry?.label === 'string' && entry.label.trim()) ? entry.label.trim() : 'Operation',
        startedDay: Math.max(0, Math.floor(Number(entry?.startedDay) || 0)),
        completeDay: Math.max(0, Math.floor(Number(entry?.completeDay) || 0)),
        durationDays: Math.max(1, Math.floor(Number(entry?.durationDays) || 1)),
        summary: typeof entry?.summary === 'string' ? entry.summary : '',
        costs: {
          gold: Math.max(0, Math.floor(Number(entry?.costs?.gold) || 0)),
          items: (entry?.costs?.items && typeof entry.costs.items === 'object') ? { ...entry.costs.items } : {},
        },
      }))
      .filter((entry) => entry.key);
  }

  _normalizeOperationBuffs(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry) => ({
        key: typeof entry?.key === 'string' ? entry.key : 'city_buff',
        label: (typeof entry?.label === 'string' && entry.label.trim()) ? entry.label.trim() : 'City Bonus',
        sourceOperation: typeof entry?.sourceOperation === 'string' ? entry.sourceOperation : null,
        grantedDay: Math.max(0, Math.floor(Number(entry?.grantedDay) || 0)),
        expiresDay: Math.max(0, Math.floor(Number(entry?.expiresDay) || 0)),
        effects: this._sanitizeEffectMap(entry?.effects),
        summary: typeof entry?.summary === 'string' ? entry.summary : '',
      }))
      .filter((entry) => Object.keys(entry.effects).length > 0);
  }

  _normalizeDirectiveEntries(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry) => ({
        key: (typeof entry?.key === 'string' && CityManagement.DIRECTIVE_DEFS[entry.key]) ? entry.key : null,
        label: (typeof entry?.label === 'string' && entry.label.trim()) ? entry.label.trim() : 'Directive',
        detail: typeof entry?.detail === 'string' ? entry.detail : '',
        createdDay: Math.max(0, Math.floor(Number(entry?.createdDay) || 0)),
        deadlineDay: Math.max(0, Math.floor(Number(entry?.deadlineDay) || 0)),
        status: entry?.status === 'completed' || entry?.status === 'failed' ? entry.status : 'active',
        reward: {
          gold: Math.max(0, Math.floor(Number(entry?.reward?.gold) || 0)),
          reputation: Math.max(0, Math.floor(Number(entry?.reward?.reputation) || 0)),
        },
        target: {
          type: typeof entry?.target?.type === 'string' ? entry.target.type : 'value',
          value: Number.isFinite(Number(entry?.target?.value)) ? Number(entry.target.value) : 0,
        },
        recommendedOperationKey: (typeof entry?.recommendedOperationKey === 'string' && CityManagement.OPERATION_DEFS[entry.recommendedOperationKey])
          ? entry.recommendedOperationKey
          : null,
        summary: typeof entry?.summary === 'string' ? entry.summary : '',
      }))
      .filter((entry) => entry.key);
  }

  _pruneExpiredCityBonuses(city, day = this._getDaysElapsed()) {
    if (!city || !city.management || typeof city.management !== 'object') return;
    if (!Array.isArray(city.management.operationBuffs)) city.management.operationBuffs = [];
    const currentDay = Math.max(0, Math.floor(Number(day) || 0));
    city.management.operationBuffs = (city.management.operationBuffs || []).filter((buff) => {
      const expires = Math.max(0, Math.floor(Number(buff?.expiresDay) || 0));
      return !(expires > 0 && currentDay > expires);
    });
  }

  getCityFocusDefs() {
    return Object.values(CityManagement.FOCUS_DEFS);
  }

  getCityFocus(city) {
    this._ensureManagement(city);
    const key = city?.management?.focusKey || 'balanced';
    return CityManagement.FOCUS_DEFS[key] || CityManagement.FOCUS_DEFS.balanced;
  }

  setCityFocus(city, focusKey) {
    if (!city || !CityManagement.FOCUS_DEFS[focusKey]) return { ok: false, reason: 'bad_focus' };
    this._ensureManagement(city);
    const prevKey = city.management.focusKey || 'balanced';
    city.management.focusKey = focusKey;
    city.management.focusEffects = {
      ...(CityManagement.FOCUS_DEFS[focusKey]?.effects || {}),
    };
    if (focusKey !== prevKey && typeof city.adjustReputation === 'function') {
      city.adjustReputation(-1);
    }
    return { ok: true, focus: this.getCityFocus(city) };
  }

  getCityScalarEffect(city, effectKey, day = this._getDaysElapsed()) {
    if (!city || !effectKey) return 0;
    this._ensureManagement(city);
    this._pruneExpiredCityBonuses(city, day);
    let total = Number(city.management?.focusEffects?.[effectKey]) || 0;
    total += Number(city.management?.districtEffects?.[effectKey]) || 0;
    for (const buff of city.management?.operationBuffs || []) {
      total += Number(buff?.effects?.[effectKey]) || 0;
    }
    return total;
  }

  getDistrictDefs() {
    return Object.values(CityManagement.DISTRICT_DEFS);
  }

  getCityDistricts(city) {
    if (!city) return [];
    this._ensureManagement(city);
    return Object.values(CityManagement.DISTRICT_DEFS).map((def) => {
      const currentTier = Math.max(0, Math.floor(Number(city.management?.districts?.[def.key]) || 0));
      const currentTierDef = currentTier > 0 ? def.tiers[currentTier - 1] : null;
      const nextTierDef = currentTier < def.tiers.length ? def.tiers[currentTier] : null;
      const queueEntry = (city.management?.buildingQueue || []).find((entry) => entry.type === `district:${def.key}`);
      let lockedReason = '';
      if (def.coastalOnly && !city.isCoastal) lockedReason = 'Requires a coastal city.';
      if (currentTier >= def.tiers.length) lockedReason = 'Max tier reached.';
      if (queueEntry) lockedReason = 'Upgrade already in progress.';
      return {
        ...def,
        currentTier,
        currentTierDef,
        nextTierDef,
        queueEntry,
        canUpgrade: !!nextTierDef && !lockedReason,
        lockedReason,
      };
    });
  }

  getCityDistrictSynergies(city) {
    if (!city) return [];
    this._ensureManagement(city);
    const tiers = city.management?.districts || {};
    return Object.values(CityManagement.DISTRICT_SYNERGY_DEFS || {})
      .map((def) => {
        const districtStates = (def.districtKeys || []).map((key) => ({
          key,
          tier: Math.max(0, Math.floor(Number(tiers[key]) || 0)),
          district: CityManagement.DISTRICT_DEFS[key] || null,
        }));
        const active = districtStates.length > 0 && districtStates.every((entry) => entry.tier > 0);
        return {
          ...def,
          active,
          districtStates,
          tierTotal: districtStates.reduce((sum, entry) => sum + entry.tier, 0),
        };
      })
      .filter((entry) => entry.active)
      .sort((a, b) => b.tierTotal - a.tierTotal);
  }

  queueDistrictProject(city, districtKey) {
    if (!city || !CityManagement.DISTRICT_DEFS[districtKey]) return { ok: false, reason: 'bad_district' };
    const district = this.getCityDistricts(city).find((entry) => entry.key === districtKey);
    if (!district || !district.nextTierDef) return { ok: false, reason: 'max_tier' };
    if (district.lockedReason) return { ok: false, reason: 'locked', message: district.lockedReason };
    const tierDef = district.nextTierDef;
    const res = this.enqueueBuild(city, `district:${districtKey}`, tierDef.cost, tierDef.time);
    if (!res.ok) return res;
    this._notify(`${city.name}: started ${district.label} tier ${district.currentTier + 1}.`, 'info');
    return { ok: true, district, tier: district.currentTier + 1 };
  }

  getActiveCityBonuses(city, day = this._getDaysElapsed()) {
    if (!city) return [];
    this._ensureManagement(city);
    this._pruneExpiredCityBonuses(city, day);
    return (city.management?.operationBuffs || []).map((buff) => {
      const expiresDay = Math.max(0, Math.floor(Number(buff?.expiresDay) || 0));
      return {
        ...buff,
        remainingDays: Math.max(0, expiresDay - Math.max(0, Math.floor(Number(day) || 0))),
      };
    });
  }

  getOperationCapacity(city) {
    if (!city) return 1;
    let cap = 1;
    if (city.hasBank) cap += 1;
    if (city.hasSchool) cap += 1;
    return Math.min(3, cap);
  }

  getCityDirectives(city, opts = {}) {
    if (!city) return [];
    this._ensureManagement(city);
    const status = opts.status || 'active';
    const day = Math.max(0, Math.floor(Number(opts.day ?? this._getDaysElapsed()) || 0));
    const entries = status === 'history' ? (city.management?.directiveHistory || []) : (city.management?.directives || []);
    return entries
      .filter((entry) => !status || entry.status === status || status === 'history')
      .map((entry) => {
        const progress = this._getDirectiveProgress(city, entry);
        return {
          ...entry,
          progress,
          remainingDays: Math.max(0, (entry.deadlineDay || day) - day),
        };
      })
      .sort((a, b) => (a.deadlineDay || 0) - (b.deadlineDay || 0));
  }

  getCityDirectiveHistory(city) {
    return this.getCityDirectives(city, { status: 'history' }).slice().reverse();
  }

  _ensureRouteRuntime(route) {
    if (!route || typeof route !== 'object') return null;
    route.itemsToSend = Array.isArray(route.itemsToSend) ? route.itemsToSend : [];
    route._goodsCarry = Number.isFinite(Number(route._goodsCarry)) ? Number(route._goodsCarry) : 0;
    route._goldCarry = Number.isFinite(Number(route._goldCarry)) ? Number(route._goldCarry) : 0;
    route.activeShipment = (route.activeShipment && typeof route.activeShipment === 'object') ? route.activeShipment : null;
    route.lastShipment = (route.lastShipment && typeof route.lastShipment === 'object') ? route.lastShipment : null;
    route.shipmentHistory = Array.isArray(route.shipmentHistory) ? route.shipmentHistory.slice(-8) : [];
    route.shipmentsDispatched = Math.max(0, Math.floor(Number(route.shipmentsDispatched) || 0));
    route.shipmentsCompleted = Math.max(0, Math.floor(Number(route.shipmentsCompleted) || 0));
    route.shipmentsLost = Math.max(0, Math.floor(Number(route.shipmentsLost) || 0));
    route.lastIncident = typeof route.lastIncident === 'string' ? route.lastIncident : '';
    return route;
  }

  _summarizeShipmentManifest(manifest) {
    if (!Array.isArray(manifest) || manifest.length <= 0) return 'gold transfer';
    return manifest.map((entry) => `${entry.itemKey}×${entry.qty}`).join(', ');
  }

  _rollRouteIncident(distance, successChance, city, dest) {
    const strategic = this._getCityStrategicPressure(city);
    const destinationStrategic = this._getCityStrategicPressure(dest);
    const hostile = this.getHostilePressure(city, 18);
    const pressurePenalty = Math.min(0.18,
      strategic.routeRisk
      + (destinationStrategic.routeRisk * 0.45)
      + ((hostile.hostileCities || 0) * 0.01)
      + ((hostile.hostileUnits || 0) * 0.003)
    );
    const defenseOffset = Math.min(0.08, strategic.defenseRelief * 0.75);
    const adjustedSuccess = Math.max(0.28, Math.min(0.98, successChance - pressurePenalty + defenseOffset));
    const roll = Math.random();
    if (roll > adjustedSuccess) {
      if (strategic.synergyKeys.includes('portside_exchange') && Math.random() < 0.5) {
        return { key: 'privateers', label: 'Privateer Hit', detail: 'Rivals targeted the exchange lanes with hired privateers.' };
      }
      if (strategic.foodRisk > 0.05 && Math.random() < 0.35) {
        return { key: 'theft', label: 'Storehouse Theft', detail: 'Smugglers skimmed part of the shipment after tracking your surplus.' };
      }
      if (distance > 24 && Math.random() < 0.45) return { key: 'storm', label: 'Storm Loss', detail: 'A storm scattered the convoy at sea.' };
      if ((dest?.management?.upgradeLevels?.walls || 0) > (city?.management?.upgradeLevels?.walls || 0) && Math.random() < 0.45) {
        return { key: 'customs', label: 'Customs Seizure', detail: 'Border inspectors seized part of the shipment.' };
      }
      return { key: 'raided', label: 'Raider Hit', detail: 'Raiders hit the convoy before it reached the gate.' };
    }
    if (distance > 18 && Math.random() < 0.15) return { key: 'delay', label: 'Delayed', detail: 'The convoy was slowed by weather and rough roads.' };
    return { key: 'clear', label: 'Clear Run', detail: 'The convoy arrived on schedule.' };
  }

  _getRouteTravelDays(distance, incidentKey = 'clear') {
    const base = Math.max(1, Math.min(6, 1 + Math.floor(distance / 8)));
    return incidentKey === 'delay' ? base + 1 : base;
  }

  _getRouteManifest(city, route, goodsToMove) {
    let candidateKeys;
    if (goodsToMove > 0 && route.itemsToSend && route.itemsToSend.length > 0) {
      candidateKeys = route.itemsToSend.filter((k) => {
        const e = city.inventory.get(k);
        return e && e.quantity > 0;
      });
    }
    if (goodsToMove > 0 && (!candidateKeys || candidateKeys.length === 0)) {
      candidateKeys = [...city.inventory.keys()];
    }
    if (goodsToMove <= 0 || !candidateKeys || candidateKeys.length === 0) return [];
    const manifest = [];
    let moved = 0;
    for (const k of candidateKeys) {
      if (moved >= goodsToMove) break;
      const entry = city.inventory.get(k);
      if (!entry || entry.quantity <= 0) continue;
      const qty = Math.min(entry.quantity, goodsToMove - moved);
      if (qty <= 0) continue;
      entry.quantity -= qty;
      if (entry.quantity <= 0) city.inventory.delete(k);
      manifest.push({ itemKey: k, qty });
      moved += qty;
    }
    return manifest;
  }

  _resolveIncomingRouteShipment(city, route, shipment, dest, day) {
    if (!city || !route || !shipment || !dest) return null;
    this._ensureManagement(city);
    const diplomacyIncomeMod = ((city === this.myCity || this._isPlayerOwnedCity(city)) && this.diplomacy && typeof this.diplomacy.getRouteIncomeMod === 'function')
      ? this.diplomacy.getRouteIncomeMod(dest.name)
      : 1;
    let routeIncomeMult = diplomacyIncomeMod;
    if (typeof CityPolicies !== 'undefined') routeIncomeMult *= CityPolicies.getTradeIncomeMult(city);
    if (typeof CitySpecialization !== 'undefined') routeIncomeMult *= (1 + CitySpecialization.getBonus(city, 'tradeIncome'));
    routeIncomeMult *= (1 + this.getCityScalarEffect(city, 'routeIncome', day));

    const manifest = Array.isArray(shipment.manifest) ? shipment.manifest : [];
    const moved = manifest.reduce((sum, entry) => sum + Math.max(0, Number(entry.qty) || 0), 0);
    let net = 0;
    if (shipment.success) {
      for (const entry of manifest) dest._addOrIncrement(entry.itemKey, entry.qty);
      if (moved > 0) {
        const fillRatio = shipment.goodsToMove > 0 ? (moved / shipment.goodsToMove) : 0;
        const distancePenalty = Math.min(0.65, shipment.distance * 0.004);
        const gross = Math.max(0, Math.floor(shipment.goldToSettle * fillRatio * (1 - distancePenalty)));
        const upkeep = Math.max(0, Math.floor((shipment.distance / 18) + (moved * 0.4)));
        net = Math.max(0, Math.floor((gross - upkeep) * routeIncomeMult));
      } else if (shipment.goldToSettle > 0) {
        const upkeep = Math.max(0, Math.floor(shipment.distance / 24));
        net = Math.max(0, Math.floor((shipment.goldToSettle - upkeep) * routeIncomeMult));
      }
      city.management.budget = Math.max(0, (city.management.budget || 0) + net);
      route.shipmentsCompleted = (route.shipmentsCompleted || 0) + 1;
    } else {
      route.shipmentsLost = (route.shipmentsLost || 0) + 1;
    }

    const result = {
      destName: shipment.destName || dest.name,
      departedDay: shipment.departedDay,
      arrivalDay: day,
      success: !!shipment.success,
      incidentKey: shipment.incidentKey || 'clear',
      incidentLabel: shipment.incidentLabel || 'Clear Run',
      detail: shipment.detail || '',
      moved,
      goldNet: net,
      manifestLabel: this._summarizeShipmentManifest(manifest),
    };
    route.lastShipment = result;
    route.lastIncident = result.incidentLabel;
    route.shipmentHistory.unshift(result);
    route.shipmentHistory = route.shipmentHistory.slice(0, 8);
    this._pushCityFeed(
      city,
      result.success
        ? `Convoy reached ${dest.name}: ${result.manifestLabel}${net > 0 ? ` · +${net}g` : ''}.`
        : `Convoy to ${dest.name} failed: ${result.incidentLabel}.`,
      result.success ? 'success' : 'warning',
      { category: 'trade', day }
    );
    if (city === this.myCity || this._isPlayerOwnedCity(city)) {
      this._notify(
        result.success
          ? `Convoy to ${dest.name} arrived: ${result.manifestLabel}${net > 0 ? ` · +${net}g` : ''}.`
          : `Convoy to ${dest.name} was lost: ${result.incidentLabel}.`,
        result.success ? 'success' : 'warning'
      );
    }
    return result;
  }

  getRouteSnapshots(city, day = this._getDaysElapsed()) {
    if (!city) return [];
    this._ensureManagement(city);
    return (city.management?.routes || []).map((route) => {
      this._ensureRouteRuntime(route);
      const dest = this.world.cities?.find((c) => c.name === route.destName) || null;
      const shipment = route.activeShipment;
      const progress = shipment
        ? Math.max(0, Math.min(1, (day - shipment.departedDay) / Math.max(1, shipment.arrivalDay - shipment.departedDay)))
        : 0;
      return {
        route,
        dest,
        activeShipment: shipment ? {
          ...shipment,
          progress,
          remainingDays: Math.max(0, shipment.arrivalDay - day),
          manifestLabel: this._summarizeShipmentManifest(shipment.manifest),
        } : null,
        lastShipment: route.lastShipment || null,
        shipmentHistory: route.shipmentHistory || [],
      };
    });
  }

  _describeThreatLevel(score) {
    const safeScore = Math.max(0, Number(score) || 0);
    if (safeScore >= 5.4) return { label: 'Red Lane', tone: '#ef5350', severity: 'high' };
    if (safeScore >= 3.7) return { label: 'Contested', tone: '#ffb74d', severity: 'medium' };
    if (safeScore >= 2.1) return { label: 'Watched', tone: '#ffd54f', severity: 'elevated' };
    return { label: 'Quiet', tone: '#9be7ad', severity: 'low' };
  }

  getCityThreatReport(city, day = this._getDaysElapsed()) {
    if (!city) {
      return { strategic: this._getCityStrategicPressure(null), routeThreats: [], rivalThreats: [], hottestRoute: null, topRival: null };
    }
    this._ensureManagement(city);
    const strategic = this._getCityStrategicPressure(city);
    const routeSnapshots = this.getRouteSnapshots(city, day);
    const routeThreats = routeSnapshots.map((snap) => {
      const dest = snap.dest || this.world.cities?.find((entry) => entry.name === snap.route?.destName) || null;
      const sourcePressure = this.getHostilePressure(city, 18);
      const destPressure = dest ? this.getHostilePressure(dest, 14) : { hostileCities: 0, hostileUnits: 0 };
      const distance = Math.max(1, Number(snap.route?.activeShipment?.distance) || Number(snap.lastShipment?.distance) || Number(snap.route?.distance) || Math.hypot(
        (dest?.location?.x || 0) - (city.location?.x || 0),
        (dest?.location?.y || 0) - (city.location?.y || 0)
      ));
      const embargoed = !!(this.diplomacy && typeof this.diplomacy.isEmbargoed === 'function' && dest?.name && this.diplomacy.isEmbargoed(dest.name));
      const lost = Math.max(0, Number(snap.route?.shipmentsLost) || 0);
      const completed = Math.max(0, Number(snap.route?.shipmentsCompleted) || 0);
      const lossRatio = lost > 0 ? (lost / Math.max(1, lost + completed)) : 0;
      const incidentPenalty = snap.activeShipment && !snap.activeShipment.success
        ? 1.4
        : (!snap.lastShipment?.success && snap.lastShipment ? 0.9 : 0);
      const score = Math.max(0,
        (distance / 7)
        + (sourcePressure.hostileCities * 0.5)
        + (sourcePressure.hostileUnits * 0.12)
        + (destPressure.hostileCities * 0.2)
        + (destPressure.hostileUnits * 0.05)
        + (strategic.routeRisk * 10)
        + (lossRatio * 3)
        + incidentPenalty
        + (embargoed ? 3.5 : 0)
      );
      const threat = this._describeThreatLevel(score);
      return {
        ...snap,
        distance: Math.round(distance),
        embargoed,
        threatScore: Math.round(score * 10) / 10,
        threatLabel: threat.label,
        threatTone: threat.tone,
        threatSeverity: threat.severity,
      };
    }).sort((a, b) => b.threatScore - a.threatScore);

    const rivalThreats = (this.world.cities || [])
      .filter((entry) => entry && entry !== city && !this._isPlayerOwnedCity(entry))
      .map((entry) => {
        const dx = (entry.location?.x || 0) - (city.location?.x || 0);
        const dy = (entry.location?.y || 0) - (city.location?.y || 0);
        const distance = Math.hypot(dx, dy);
        const units = Array.isArray(entry.management?.units) ? entry.management.units.filter((unit) => (unit?.hp || 0) > 0).length : 0;
        const preview = this._getAIInvasionPreview(entry, city);
        const score = Math.max(0,
          (distance <= 18 ? (3.2 - (distance / 7)) : 0)
          + Math.min(2.6, units * 0.35)
          + (preview ? ((preview.winChance || 0) * 2.2) : 0)
          + (strategic.rivalAttention * 0.35)
          - (strategic.defenseRelief * 1.4)
        );
        const threat = this._describeThreatLevel(score);
        return {
          city: entry,
          distance: Math.round(distance),
          units,
          preview,
          threatScore: Math.round(score * 10) / 10,
          threatLabel: threat.label,
          threatTone: threat.tone,
          threatSeverity: threat.severity,
        };
      })
      .filter((entry) => entry.distance <= 22)
      .sort((a, b) => b.threatScore - a.threatScore);

    return {
      strategic,
      routeThreats,
      rivalThreats,
      hottestRoute: routeThreats[0] || null,
      topRival: rivalThreats[0] || null,
    };
  }

  _runStrategicDiplomacy(city, day = this._getDaysElapsed()) {
    if (!city || !this.diplomacy) return [];
    const currentDay = Math.max(0, Math.floor(Number(day) || 0));
    const report = this.getCityThreatReport(city, currentDay);
    const actions = [];

    const tryAction = (cityName, note, fn) => {
      if (!cityName || !this.diplomacy.canAIDecide(cityName, currentDay, 4)) return false;
      const result = fn();
      if (!result?.ok) return false;
      this.diplomacy.markAIDecision(cityName, currentDay, note);
      actions.push({ cityName, note, msg: result.msg });
      return true;
    };

    for (const routeThreat of report.routeThreats || []) {
      const partnerName = routeThreat.dest?.name || routeThreat.route?.destName;
      if (!partnerName) continue;
      const score = this.diplomacy.getScore(partnerName);
      if (routeThreat.threatScore <= 1.8 && score >= 18 && !this.diplomacy.hasPact(partnerName, 'trade_pact') && !this.diplomacy.hasPact(partnerName, 'embargo')) {
        tryAction(
          partnerName,
          `Trade lane is calm and profitable (${routeThreat.threatLabel.toLowerCase()}).`,
          () => this.diplomacy.proposePact(partnerName, 'trade_pact', currentDay)
        );
      }
      if (routeThreat.threatScore >= 4.6 && score < 22 && !this.diplomacy.hasPact(partnerName, 'embargo')) {
        tryAction(
          partnerName,
          `Convoys are under strain on this lane (${routeThreat.threatLabel.toLowerCase()}).`,
          () => this.diplomacy.proposePact(partnerName, 'embargo', currentDay)
        );
      } else if (routeThreat.threatScore >= 3.2 && score < 18 && !this.diplomacy.hasPact(partnerName, 'rivalry') && !this.diplomacy.hasPact(partnerName, 'embargo')) {
        tryAction(
          partnerName,
          `Competition on this lane has turned hostile (${routeThreat.threatLabel.toLowerCase()}).`,
          () => this.diplomacy.proposePact(partnerName, 'rivalry', currentDay)
        );
      }
    }

    for (const rival of report.rivalThreats || []) {
      const rivalName = rival.city?.name;
      if (!rivalName) continue;
      const score = this.diplomacy.getScore(rivalName);
      if (rival.threatScore >= 4.8 && score < 30 && !this.diplomacy.hasPact(rivalName, 'embargo')) {
        tryAction(
          rivalName,
          `Border pressure is rising and this rival controls a dangerous approach.`,
          () => this.diplomacy.proposePact(rivalName, 'embargo', currentDay)
        );
      } else if (rival.threatScore >= 3.4 && score < 20 && !this.diplomacy.hasPact(rivalName, 'rivalry') && !this.diplomacy.hasPact(rivalName, 'embargo')) {
        tryAction(
          rivalName,
          `Relations hardened as this rival massed near your frontier.`,
          () => this.diplomacy.proposePact(rivalName, 'rivalry', currentDay)
        );
      } else if (rival.threatScore >= 2.8 && score >= 50 && !this.diplomacy.hasPact(rivalName, 'alliance')) {
        tryAction(
          rivalName,
          `Mutual danger on the frontier pushed this city into a defensive pact.`,
          () => this.diplomacy.proposePact(rivalName, 'alliance', currentDay)
        );
      }
    }

    return actions;
  }

  _createDirective(city, key, day = this._getDaysElapsed()) {
    if (!city || !CityManagement.DIRECTIVE_DEFS[key]) return null;
    const def = CityManagement.DIRECTIVE_DEFS[key];
    const ctx = this._getOperationContext(city);
    const currentDay = Math.max(0, Math.floor(Number(day) || 0));
    let targetValue = 0;
    let detail = def.desc;
    let recommendedOperationKey = def.recommendedOperationKey || null;
    let rewardGold = def.baseRewardGold || 100;
    let rewardReputation = def.baseRewardReputation || 1;

    if (key === 'stock_granaries') {
      targetValue = Math.max(7, Math.min(12, ctx.food.daysLeft + 4));
      detail = `Raise food reserves to ${targetValue} days before the shortage turns into panic.`;
      rewardGold += Math.floor(ctx.pop * 0.2);
    } else if (key === 'calm_streets') {
      targetValue = Math.max(58, Math.min(72, ctx.happiness + 12));
      detail = `Lift happiness to ${targetValue} to stop unrest from spreading through the wards.`;
      rewardGold += Math.floor(ctx.pop * 0.14);
      rewardReputation = 2;
    } else if (key === 'open_market') {
      targetValue = 1;
      detail = 'Establish at least one trade route so the treasury starts moving instead of stagnating.';
      rewardGold += 35;
      rewardReputation = 2;
      recommendedOperationKey = 'caravan_surge';
    } else if (key === 'arm_the_watch') {
      targetValue = Math.max(2, Math.min(4, 2 + Math.floor(ctx.hostileScore / 4)));
      detail = `Raise a ready watch of ${targetValue} unit${targetValue === 1 ? '' : 's'} before rivals test the walls.`;
      rewardGold += Math.floor(ctx.hostileScore * 15);
      rewardReputation = 2;
    } else if (key === 'secure_convoys') {
      targetValue = Math.max(2, Math.min(5, 1 + Math.ceil(ctx.routes / 1.5)));
      detail = `Put ${targetValue} escort unit${targetValue === 1 ? '' : 's'} on readiness so convoys stop looking like easy prey.`;
      rewardGold += 40 + (ctx.routes * 20);
      rewardReputation = 2;
      recommendedOperationKey = 'militia_drill';
    } else if (key === 'showcase_contracts') {
      targetValue = Math.max(2, Math.min(3, ctx.routes + 1));
      detail = `Open ${targetValue} trade routes so the guild showcase has buyers beyond your own walls.`;
      rewardGold += 55 + Math.floor(ctx.pop * 0.08);
      rewardReputation = 2;
      recommendedOperationKey = 'caravan_surge';
    } else if (key === 'guard_storehouses') {
      targetValue = Math.max(2, Math.min(4, 1 + Math.ceil(ctx.food.daysLeft / 5)));
      detail = `Keep ${targetValue} guard unit${targetValue === 1 ? '' : 's'} ready while the storehouses are full enough to tempt thieves.`;
      rewardGold += 35 + Math.floor(ctx.food.daysLeft * 6);
      rewardReputation = 1;
      recommendedOperationKey = 'militia_drill';
    }

    return {
      key,
      label: def.label,
      detail,
      createdDay: currentDay,
      deadlineDay: currentDay + def.durationDays,
      status: 'active',
      reward: { gold: rewardGold, reputation: rewardReputation },
      target: { type: def.targetType, value: targetValue },
      recommendedOperationKey,
      summary: '',
    };
  }

  _getDirectiveProgress(city, directive) {
    if (!city || !directive) return { current: 0, target: 0, ratio: 0, completed: false, text: '' };
    const target = Number(directive?.target?.value) || 0;
    let current = 0;
    let text = '';
    if (directive.key === 'stock_granaries') {
      current = this.getFoodStatus(city).daysLeft;
      text = `${current}/${target} food days secured`;
    } else if (directive.key === 'calm_streets') {
      current = this.getHappiness(city);
      text = `${current}/${target} happiness`;
    } else if (directive.key === 'open_market') {
      current = Array.isArray(city.management?.routes) ? city.management.routes.length : 0;
      text = `${current}/${target} trade route${target === 1 ? '' : 's'}`;
    } else if (directive.key === 'arm_the_watch') {
      const ready = this.getReadyUnitCount(city);
      const roster = Array.isArray(city.management?.units) ? city.management.units.length : 0;
      current = Math.max(ready, roster);
      text = `${current}/${target} guards ready`;
    } else if (directive.key === 'secure_convoys') {
      const ready = this.getReadyUnitCount(city);
      const roster = Array.isArray(city.management?.units) ? city.management.units.length : 0;
      current = Math.max(ready, roster);
      text = `${current}/${target} convoy escorts ready`;
    } else if (directive.key === 'showcase_contracts') {
      current = Array.isArray(city.management?.routes) ? city.management.routes.length : 0;
      text = `${current}/${target} showcase contracts active`;
    } else if (directive.key === 'guard_storehouses') {
      const ready = this.getReadyUnitCount(city);
      const roster = Array.isArray(city.management?.units) ? city.management.units.length : 0;
      current = Math.max(ready, roster);
      text = `${current}/${target} granary guards ready`;
    }
    const completed = current >= target;
    return {
      current,
      target,
      ratio: target > 0 ? Math.max(0, Math.min(1, current / target)) : 0,
      completed,
      text,
    };
  }

  _completeDirective(city, directive, day) {
    if (!city || !directive) return null;
    this._ensureManagement(city);
    const def = CityManagement.DIRECTIVE_DEFS[directive.key] || { cooldownDays: 4 };
    const summary = `${directive.label} resolved: +${directive.reward.gold}g${directive.reward.reputation > 0 ? ` · +${directive.reward.reputation} reputation` : ''}.`;
    city.management.budget = (city.management?.budget || 0) + Math.max(0, Math.floor(Number(directive.reward?.gold) || 0));
    if (typeof city.adjustReputation === 'function') city.adjustReputation(Math.max(0, Math.floor(Number(directive.reward?.reputation) || 0)));
    if (directive.key === 'open_market') {
      this._addCityBuff(city, {
        key: 'market_confidence',
        label: 'Market Confidence',
        sourceOperation: directive.key,
        durationDays: 4,
        effects: { routeIncome: 0.12, happiness: 2 },
        summary: 'Merchants trust the city again.',
      }, day);
    } else if (directive.key === 'arm_the_watch') {
      this._addCityBuff(city, {
        key: 'watch_bonus',
        label: 'Watch Bonus',
        sourceOperation: directive.key,
        durationDays: 4,
        effects: { defense: 0.12 },
        summary: 'The guard stays sharp after the drill.',
      }, day);
    } else if (directive.key === 'secure_convoys') {
      this._addCityBuff(city, {
        key: 'escorted_lanes',
        label: 'Escorted Lanes',
        sourceOperation: directive.key,
        durationDays: 5,
        effects: { routeIncome: 0.14, defense: 0.08 },
        summary: 'Visible escorts keep trade moving and rivals guessing.',
      }, day);
    } else if (directive.key === 'showcase_contracts') {
      this._addCityBuff(city, {
        key: 'showcase_buyers',
        label: 'Showcase Buyers',
        sourceOperation: directive.key,
        durationDays: 5,
        effects: { routeIncome: 0.10, productionChance: 0.08 },
        summary: 'Outside buyers keep workshops and markets busy.',
      }, day);
    } else if (directive.key === 'guard_storehouses') {
      this._addCityBuff(city, {
        key: 'sealed_storehouses',
        label: 'Sealed Storehouses',
        sourceOperation: directive.key,
        durationDays: 5,
        effects: { foodSaving: 0.18, defense: 0.06, happiness: 1 },
        summary: 'Granaries stay secure and losses fall.',
      }, day);
    }
    city.management.directiveCooldowns[directive.key] = day + Math.max(1, Number(def.cooldownDays) || 4);
    directive.status = 'completed';
    directive.summary = summary;
    city.management.directiveHistory.push({ ...directive });
    city.management.directiveHistory = city.management.directiveHistory.slice(-12);
    this._pushCityFeed(city, summary, 'success', { category: 'directive', day });
    return summary;
  }

  _failDirective(city, directive, day) {
    if (!city || !directive) return null;
    this._ensureManagement(city);
    const def = CityManagement.DIRECTIVE_DEFS[directive.key] || { cooldownDays: 4 };
    const penalty = Math.max(0, Math.floor((directive.reward?.gold || 0) * 0.2));
    city.management.budget = Math.max(0, (city.management?.budget || 0) - penalty);
    if (typeof city.adjustReputation === 'function') city.adjustReputation(-1);
    if (directive.key === 'guard_storehouses') {
      const stolenFood = Math.max(4, Math.floor((Number(directive?.target?.value) || 2) * 3));
      this._removeFoodFromCity(city, stolenFood);
    } else if (directive.key === 'secure_convoys') {
      city.management.budget = Math.max(0, (city.management?.budget || 0) - 25);
    } else if (directive.key === 'showcase_contracts' && typeof city.adjustReputation === 'function') {
      city.adjustReputation(-1);
    }
    const summary = `${directive.label} failed: lost ${penalty}g in emergency costs.`;
    city.management.directiveCooldowns[directive.key] = day + Math.max(1, Number(def.cooldownDays) || 4);
    directive.status = 'failed';
    directive.summary = summary;
    city.management.directiveHistory.push({ ...directive });
    city.management.directiveHistory = city.management.directiveHistory.slice(-12);
    this._pushCityFeed(city, summary, 'warning', { category: 'directive', day });
    return summary;
  }

  _updateCityDirectives(city, day = this._getDaysElapsed()) {
    if (!city) return;
    this._ensureManagement(city);
    const currentDay = Math.max(0, Math.floor(Number(day) || 0));
    if (!Array.isArray(city.management.directives)) city.management.directives = [];
    for (let i = city.management.directives.length - 1; i >= 0; i--) {
      const directive = city.management.directives[i];
      const progress = this._getDirectiveProgress(city, directive);
      if (progress.completed) {
        const summary = this._completeDirective(city, directive, currentDay);
        if (city === this.myCity || this._isPlayerOwnedCity(city)) this._notify(summary, 'success');
        city.management.directives.splice(i, 1);
        continue;
      }
      if (directive.deadlineDay > 0 && currentDay > directive.deadlineDay) {
        const summary = this._failDirective(city, directive, currentDay);
        if (city === this.myCity || this._isPlayerOwnedCity(city)) this._notify(summary, 'warning');
        city.management.directives.splice(i, 1);
      }
    }

    const activeCount = city.management.directives.length;
    if (activeCount >= 2) return;
    const pressures = this.getCityPressures(city);
    for (const pressure of pressures) {
      const directiveKey = pressure.directiveKey;
      if (!directiveKey || !CityManagement.DIRECTIVE_DEFS[directiveKey]) continue;
      const alreadyActive = city.management.directives.some((entry) => entry.key === directiveKey);
      const cooldownUntil = Math.max(0, Math.floor(Number(city.management?.directiveCooldowns?.[directiveKey]) || 0));
      if (alreadyActive || cooldownUntil > currentDay) continue;
      const directive = this._createDirective(city, directiveKey, currentDay);
      if (!directive) continue;
      city.management.directives.push(directive);
      if (city === this.myCity || this._isPlayerOwnedCity(city)) {
        this._notify(`Directive issued: ${directive.label}. ${directive.detail}`, 'quest');
      }
      break;
    }
  }

  getActiveCityOperations(city, day = this._getDaysElapsed()) {
    if (!city) return [];
    this._ensureManagement(city);
    const currentDay = Math.max(0, Math.floor(Number(day) || 0));
    return (city.management?.activeOperations || []).map((op) => {
      const elapsed = Math.max(0, currentDay - (op.startedDay || currentDay));
      const duration = Math.max(1, Number(op.durationDays) || 1);
      return {
        ...op,
        remainingDays: Math.max(0, (op.completeDay || currentDay) - currentDay),
        progress: Math.max(0, Math.min(1, elapsed / duration)),
      };
    });
  }

  _addCityBuff(city, buff, day = this._getDaysElapsed()) {
    if (!city || !buff || !buff.effects) return null;
    this._ensureManagement(city);
    const durationDays = Math.max(1, Math.floor(Number(buff.durationDays) || 1));
    const currentDay = Math.max(0, Math.floor(Number(day) || 0));
    const next = {
      key: typeof buff.key === 'string' ? buff.key : 'city_buff',
      label: (typeof buff.label === 'string' && buff.label.trim()) ? buff.label.trim() : 'City Bonus',
      sourceOperation: typeof buff.sourceOperation === 'string' ? buff.sourceOperation : null,
      grantedDay: currentDay,
      expiresDay: currentDay + durationDays,
      effects: this._sanitizeEffectMap(buff.effects),
      summary: typeof buff.summary === 'string' ? buff.summary : '',
    };
    if (Object.keys(next.effects).length <= 0) return null;
    city.management.operationBuffs.push(next);
    return next;
  }

  _isCityEventEligible(event, city, day = this._getDaysElapsed()) {
    if (!event || !city) return false;
    const currentDay = Math.max(0, Math.floor(Number(day) || 0));
    if (event.minDay && currentDay < event.minDay) return false;
    if (typeof event.isEligible === 'function' && !event.isEligible(city, this, currentDay)) return false;
    return true;
  }

  _getCityEventWeight(event, city, day = this._getDaysElapsed()) {
    const rawWeight = (typeof event?.weight === 'function')
      ? event.weight(city, this, Math.max(0, Math.floor(Number(day) || 0)))
      : event?.weight;
    return Math.max(0.01, Number(rawWeight) || 1);
  }

  _formatOperationCosts(costs) {
    const parts = [];
    const gold = Math.max(0, Math.floor(Number(costs?.gold) || 0));
    if (gold > 0) parts.push(`${gold}g`);
    const items = (costs?.items && typeof costs.items === 'object') ? costs.items : {};
    for (const [itemKey, qty] of Object.entries(items)) {
      const amount = Math.max(0, Math.floor(Number(qty) || 0));
      if (amount > 0) parts.push(`${amount} ${itemKey}`);
    }
    return parts.join(' · ');
  }

  _getOperationContext(city) {
    const food = this.getFoodStatus(city);
    const happiness = this.getHappiness(city);
    const routes = Array.isArray(city?.management?.routes) ? city.management.routes.length : 0;
    const queue = Array.isArray(city?.management?.buildingQueue) ? city.management.buildingQueue.length : 0;
    const units = Array.isArray(city?.management?.units) ? city.management.units.length : 0;
    const pop = Math.max(10, Number(city?.population) || 10);
    const pressure = this.getHostilePressure(city);
    const hostileScore = (pressure.hostileCities * 2) + pressure.hostileUnits;
    return { food, happiness, routes, queue, units, pop, pressure, hostileScore };
  }

  _getCityStrategicPressure(city) {
    if (!city) {
      return {
        synergyKeys: [],
        rivalAttention: 0,
        routeRisk: 0,
        foodRisk: 0,
        defenseRelief: 0,
      };
    }
    const synergies = this.getCityDistrictSynergies(city);
    const synergyKeys = synergies.map((entry) => entry.key);
    const routeCount = Array.isArray(city.management?.routes) ? city.management.routes.length : 0;
    const food = this.getFoodStatus(city);
    let rivalAttention = 0;
    let routeRisk = 0;
    let foodRisk = 0;
    let defenseRelief = 0;

    if (synergyKeys.includes('portside_exchange')) {
      rivalAttention += 1.2 + Math.min(1.6, routeCount * 0.45);
      routeRisk += 0.08 + Math.min(0.12, routeCount * 0.03);
    }
    if (synergyKeys.includes('guild_showcase')) {
      rivalAttention += 0.7;
      routeRisk += 0.05;
    }
    if (synergyKeys.includes('harvest_jubilee') && food.daysLeft >= 7) {
      rivalAttention += 0.8;
      foodRisk += 0.08 + Math.min(0.08, Math.max(0, food.daysLeft - 7) * 0.01);
    }
    if (synergyKeys.includes('citizen_watch')) {
      rivalAttention += 0.35;
      defenseRelief += 0.08 + Math.min(0.06, (this.getReadyUnitCount(city) || 0) * 0.015);
    }

    return {
      synergyKeys,
      rivalAttention,
      routeRisk,
      foodRisk,
      defenseRelief,
    };
  }

  getCityPressures(city) {
    if (!city) return [];
    const ctx = this._getOperationContext(city);
    const strategic = this._getCityStrategicPressure(city);
    const out = [];
    if (strategic.synergyKeys.includes('portside_exchange') && ctx.routes >= 2 && ctx.hostileScore >= 2) {
      out.push({
        key: 'trade_raids',
        label: 'Convoys Targeted',
        tone: ctx.hostileScore >= 6 ? '#ef5350' : '#ffb74d',
        detail: `${ctx.routes} routes are drawing privateer attention`,
        recommendedOperationKey: 'militia_drill',
        directiveKey: 'secure_convoys',
      });
    }
    if (strategic.synergyKeys.includes('guild_showcase') && ctx.routes < 2 && (city.management?.budget || 0) >= 220) {
      out.push({
        key: 'buyers_needed',
        label: 'Showcase Needs Buyers',
        tone: '#90caf9',
        detail: 'Workshops need more outbound contracts to keep showcase demand hot',
        recommendedOperationKey: 'caravan_surge',
        directiveKey: 'showcase_contracts',
      });
    }
    if (strategic.synergyKeys.includes('harvest_jubilee') && ctx.food.daysLeft >= 7 && ctx.hostileScore >= 1) {
      out.push({
        key: 'storehouse_risk',
        label: 'Storehouses Exposed',
        tone: ctx.hostileScore >= 5 ? '#ef5350' : '#ffca28',
        detail: `${ctx.food.daysLeft} days of food are worth stealing`,
        recommendedOperationKey: 'militia_drill',
        directiveKey: 'guard_storehouses',
      });
    }
    if (ctx.food.daysLeft < 5) {
      out.push({
        key: 'food',
        label: ctx.food.daysLeft < 2 ? 'Food Crisis' : 'Tight Granaries',
        tone: ctx.food.daysLeft < 2 ? '#ef5350' : '#ffb74d',
        detail: `${ctx.food.daysLeft} day${ctx.food.daysLeft === 1 ? '' : 's'} of food left`,
        recommendedOperationKey: 'harvest_drive',
        directiveKey: 'stock_granaries',
      });
    }
    if (ctx.happiness < 48) {
      out.push({
        key: 'morale',
        label: ctx.happiness < 30 ? 'Unrest Rising' : 'Morale Slipping',
        tone: ctx.happiness < 30 ? '#ef5350' : '#ffca28',
        detail: `Happiness ${ctx.happiness}`,
        recommendedOperationKey: 'founders_festival',
        directiveKey: 'calm_streets',
      });
    }
    if (ctx.hostileScore >= 4) {
      out.push({
        key: 'frontier',
        label: ctx.hostileScore >= 8 ? 'Border Emergency' : 'Hostile Frontier',
        tone: ctx.hostileScore >= 8 ? '#ef5350' : '#ffb74d',
        detail: `${ctx.pressure.hostileCities} hostile city · ${ctx.pressure.hostileUnits} hostile unit`,
        recommendedOperationKey: 'militia_drill',
        directiveKey: 'arm_the_watch',
      });
    }
    if (ctx.routes <= 0 && (city.management?.budget || 0) >= 180) {
      out.push({
        key: 'trade',
        label: 'Market Stagnation',
        tone: '#90caf9',
        detail: 'Treasury is idle without active trade routes',
        recommendedOperationKey: 'builders_guild',
        directiveKey: 'open_market',
      });
    }
    if (ctx.queue > 0) {
      out.push({
        key: 'projects',
        label: 'Construction Momentum',
        tone: '#ce93d8',
        detail: `${ctx.queue} project${ctx.queue === 1 ? '' : 's'} can be accelerated`,
        recommendedOperationKey: 'builders_guild',
      });
    }
    if (ctx.routes > 0) {
      out.push({
        key: 'commerce',
        label: 'Trade Window',
        tone: '#80cbc4',
        detail: `${ctx.routes} route${ctx.routes === 1 ? '' : 's'} ready for a convoy push`,
        recommendedOperationKey: 'caravan_surge',
      });
    }
    return out.slice(0, 5);
  }

  _getOperationPlan(city, key, day = this._getDaysElapsed()) {
    if (!city || !CityManagement.OPERATION_DEFS[key]) return null;
    this._ensureManagement(city);
    this._pruneExpiredCityBonuses(city, day);
    const def = CityManagement.OPERATION_DEFS[key];
    const ctx = this._getOperationContext(city);
    const activeOps = this.getActiveCityOperations(city, day);
    const currentDay = Math.max(0, Math.floor(Number(day) || 0));
    const cooldownUntil = Math.max(0, Math.floor(Number(city.management?.operationCooldowns?.[key]) || 0));
    const active = activeOps.find((entry) => entry.key === key) || null;
    const opCap = this.getOperationCapacity(city);
    let lockedReason = '';
    let costs = { gold: 0, items: {} };
    let payoff = '';
    let recommended = false;
    let recommendation = '';

    if (key === 'harvest_drive') {
      const farmLevel = Math.max(0, Number(city.management?.upgradeLevels?.farm) || 0);
      const wheatGain = 14 + (farmLevel * 8) + Math.ceil(ctx.pop * 0.04);
      const fishGain = city.isCoastal ? 4 + Math.floor(farmLevel / 2) : 0;
      costs = { gold: 80 + Math.floor(ctx.pop * 0.12), items: {} };
      payoff = `+${wheatGain} Wheat${fishGain > 0 ? ` · +${fishGain} Fish` : ''} · 5d food-saving bonus`;
      recommended = ctx.food.daysLeft < 5;
      recommendation = recommended ? 'Recommended: food reserves are getting tight.' : 'Best before shortages become visible.';
    } else if (key === 'founders_festival') {
      costs = { gold: 120 + Math.floor(ctx.pop * 0.14), items: {} };
      payoff = `+morale surge · +population growth · may consume Wine for extra prestige`;
      recommended = ctx.happiness < 55;
      recommendation = recommended ? 'Recommended: morale is soft and unrest can snowball.' : 'Great when you want a growth burst.';
    } else if (key === 'builders_guild') {
      costs = { gold: 135 + (ctx.queue * 18), items: {} };
      payoff = '+build speed for 6 days · +Tools stock';
      recommended = ctx.queue > 0;
      recommendation = recommended ? 'Recommended: you already have projects waiting for faster crews.' : 'Preps your city for a building sprint.';
    } else if (key === 'caravan_surge') {
      costs = { gold: 140 + (ctx.routes * 20), items: {} };
      payoff = `+route income for 6 days · +${40 + (ctx.routes * 35)}g on completion`;
      if (ctx.routes <= 0) lockedReason = 'Needs at least 1 trade route.';
      recommended = ctx.routes > 0;
      recommendation = recommended ? 'Recommended: active routes can immediately monetize the convoy push.' : 'Build a route first.';
    } else if (key === 'militia_drill') {
      costs = { gold: 105 + (ctx.units * 15), items: {} };
      payoff = '+defense posture for 6 days · cheaper units · +2 unit cap';
      recommended = ctx.hostileScore >= 4;
      recommendation = recommended ? 'Recommended: hostile pressure is climbing on your frontier.' : 'Use when you expect raids or war.';
    }

    if (!lockedReason && activeOps.length >= opCap && !active) lockedReason = `Operations cap reached (${opCap}).`;
    if (!lockedReason && cooldownUntil > currentDay && !active) lockedReason = `Cooldown: ${cooldownUntil - currentDay} day${cooldownUntil - currentDay === 1 ? '' : 's'} left.`;
    return {
      ...def,
      costs,
      costLabel: this._formatOperationCosts(costs),
      payoff,
      recommended,
      recommendation,
      active,
      operationCap: opCap,
      activeCount: activeOps.length,
      cooldownRemaining: Math.max(0, cooldownUntil - currentDay),
      lockedReason,
      canStart: !active && !lockedReason,
    };
  }

  getAvailableOperations(city, day = this._getDaysElapsed()) {
    return Object.keys(CityManagement.OPERATION_DEFS)
      .map((key) => this._getOperationPlan(city, key, day))
      .filter(Boolean)
      .sort((a, b) => {
        if (!!a.recommended !== !!b.recommended) return a.recommended ? -1 : 1;
        if (!!a.canStart !== !!b.canStart) return a.canStart ? -1 : 1;
        return a.durationDays - b.durationDays;
      });
  }

  _canAffordOperation(city, costs) {
    if ((city.management?.budget || 0) < Math.max(0, Math.floor(Number(costs?.gold) || 0))) return false;
    const items = (costs?.items && typeof costs.items === 'object') ? costs.items : {};
    for (const [itemKey, qty] of Object.entries(items)) {
      const available = Math.max(0, Number(city.inventory?.get(itemKey)?.quantity) || 0);
      if (available < Math.max(0, Math.floor(Number(qty) || 0))) return false;
    }
    return true;
  }

  _applyOperationCosts(city, costs) {
    const gold = Math.max(0, Math.floor(Number(costs?.gold) || 0));
    if (gold > 0) city.management.budget = Math.max(0, (city.management?.budget || 0) - gold);
    const items = (costs?.items && typeof costs.items === 'object') ? costs.items : {};
    for (const [itemKey, qty] of Object.entries(items)) {
      const amount = Math.max(0, Math.floor(Number(qty) || 0));
      if (amount <= 0) continue;
      const entry = city.inventory?.get(itemKey);
      if (!entry) continue;
      entry.quantity -= amount;
      if (entry.quantity <= 0) city.inventory.delete(itemKey);
    }
  }

  startCityOperation(city, key) {
    const day = this._getDaysElapsed();
    const plan = this._getOperationPlan(city, key, day);
    if (!plan) return { ok: false, reason: 'bad_operation' };
    if (plan.active) return { ok: false, reason: 'active' };
    if (plan.lockedReason) return { ok: false, reason: 'locked', message: plan.lockedReason };
    if (!this._canAffordOperation(city, plan.costs)) return { ok: false, reason: 'no_money' };
    this._applyOperationCosts(city, plan.costs);
    city.management.activeOperations.push({
      key,
      label: plan.label,
      startedDay: day,
      completeDay: day + plan.durationDays,
      durationDays: plan.durationDays,
      summary: plan.payoff,
      costs: plan.costs,
    });
    this._notify(`${city.name}: ${plan.label} started. ${plan.payoff}`, 'info');
    return { ok: true, operation: plan };
  }

  _completeCityOperation(city, op, day) {
    if (!city || !op) return null;
    this._ensureManagement(city);
    const currentDay = Math.max(0, Math.floor(Number(day) || 0));
    let summary = '';
    if (op.key === 'harvest_drive') {
      const farmLevel = Math.max(0, Number(city.management?.upgradeLevels?.farm) || 0);
      const wheatGain = 14 + (farmLevel * 8) + Math.ceil((Number(city.population) || 0) * 0.04);
      const fishGain = city.isCoastal ? 4 + Math.floor(farmLevel / 2) : 0;
      city._addOrIncrement('Wheat', wheatGain);
      if (fishGain > 0) city._addOrIncrement('Fish', fishGain);
      this._addCityBuff(city, {
        key: 'granary_reserves',
        label: 'Granary Reserves',
        sourceOperation: op.key,
        durationDays: 5,
        effects: { happiness: 2, foodSaving: 0.15 },
        summary: 'Food lasts longer and morale stays steady.',
      }, currentDay);
      if (typeof city.adjustReputation === 'function') city.adjustReputation(1);
      summary = `Harvest Drive complete: +${wheatGain} Wheat${fishGain > 0 ? `, +${fishGain} Fish` : ''}.`;
    } else if (op.key === 'founders_festival') {
      const wineEntry = city.inventory?.get('Wine');
      const wineSpent = Math.min(2, Math.max(0, Number(wineEntry?.quantity) || 0));
      if (wineSpent > 0 && wineEntry) {
        wineEntry.quantity -= wineSpent;
        if (wineEntry.quantity <= 0) city.inventory.delete('Wine');
      }
      const popGain = Math.max(6, Math.floor((Number(city.population) || 0) * 0.02));
      city.population += popGain;
      this._addCityBuff(city, {
        key: 'festival_spirit',
        label: 'Festival Spirit',
        sourceOperation: op.key,
        durationDays: 5,
        effects: { happiness: 8 + (wineSpent * 2), popGrowth: 0.012 },
        summary: 'Citizens celebrate and growth surges.',
      }, currentDay);
      if (typeof city.adjustReputation === 'function') city.adjustReputation(2 + wineSpent);
      summary = `Founders Festival complete: +${popGain} population and a citywide morale surge.`;
    } else if (op.key === 'builders_guild') {
      const toolGain = 4 + Math.max(0, Math.floor(Number(city.management?.upgradeLevels?.warehouse) || 0));
      city._addOrIncrement('Tools', toolGain);
      this._addCityBuff(city, {
        key: 'builders_guild',
        label: 'Builders Guild',
        sourceOperation: op.key,
        durationDays: 6,
        effects: { buildSpeed: 0.45, productionChance: 0.08 },
        summary: 'Crews work faster and workshops stay organized.',
      }, currentDay);
      summary = `Builders Guild complete: +${toolGain} Tools and faster construction for 6 days.`;
    } else if (op.key === 'caravan_surge') {
      const routeCount = Array.isArray(city.management?.routes) ? city.management.routes.length : 0;
      const bonusGold = 40 + (routeCount * 35);
      city.management.budget = (city.management?.budget || 0) + bonusGold;
      this._addCityBuff(city, {
        key: 'convoy_contracts',
        label: 'Convoy Contracts',
        sourceOperation: op.key,
        durationDays: 6,
        effects: { routeIncome: 0.30, taxIncome: 0.05 },
        summary: 'Merchants pay more while convoy lanes stay hot.',
      }, currentDay);
      if (typeof city.adjustReputation === 'function') city.adjustReputation(2);
      summary = `Caravan Surge complete: +${bonusGold}g and boosted trade lanes.`;
    } else if (op.key === 'militia_drill') {
      if (Array.isArray(city.management?.units)) {
        for (const unit of city.management.units) {
          if (!unit) continue;
          const maxHp = Math.max(1, Number(unit.maxHp) || 1);
          unit.hp = Math.min(maxHp, Math.max(0, Number(unit.hp) || 0) + 2);
        }
      }
      this._addCityBuff(city, {
        key: 'raised_watch',
        label: 'Raised Watch',
        sourceOperation: op.key,
        durationDays: 6,
        effects: { defense: 0.30, unitCostDiscount: 0.18, unitCap: 2 },
        summary: 'Guards are drilled and the watch is reinforced.',
      }, currentDay);
      if (typeof city.adjustReputation === 'function') city.adjustReputation(1);
      summary = 'Militia Drill complete: city defenses tightened and units are cheaper to train.';
    }
    const def = CityManagement.OPERATION_DEFS[op.key] || { label: op.label, cooldownDays: 5 };
    city.management.operationCooldowns[op.key] = currentDay + Math.max(1, Number(def.cooldownDays) || 5);
    city.management.operationHistory.push({
      key: op.key,
      label: op.label,
      completedDay: currentDay,
      summary,
    });
    city.management.operationHistory = city.management.operationHistory.slice(-12);
    this._pushCityFeed(city, summary, 'success', { category: 'operation', day: currentDay });
    if (summary) this._notify(summary, 'success');
    return summary;
  }

  _advanceCityOperations(city, day) {
    if (!city) return [];
    this._ensureManagement(city);
    this._pruneExpiredCityBonuses(city, day);
    const completed = [];
    for (let i = city.management.activeOperations.length - 1; i >= 0; i--) {
      const op = city.management.activeOperations[i];
      if ((Number(op?.completeDay) || 0) > day) continue;
      const summary = this._completeCityOperation(city, op, day);
      completed.push({ ...op, summary });
      city.management.activeOperations.splice(i, 1);
    }
    return completed;
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
    this._emitUnitsChanged(city, 'loaded');
  }

  _persistUnitsForCity(city) {
    if (!city || !this.unitManager) return;
    this._ensureManagement(city);
    city.management.units = this.unitManager.toJSON();
    this._emitUnitsChanged(city, 'persisted');
  }

  _emitUnitsChanged(city, reason = 'updated') {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    let detail = null;
    try {
      detail = {
        city,
        cityName: city?.name || null,
        reason,
        units: this.getUnitsForCity(city).map((unit) => ({
          id: Number.isFinite(Number(unit?.id)) ? Number(unit.id) : null,
          hp: Math.max(0, Number(unit?.hp) || 0),
          maxHp: Math.max(1, Number(unit?.maxHp) || 1),
          state: typeof unit?.state === 'string' ? unit.state : 'idle',
          level: Math.max(1, Number(unit?.level) || 1),
          selected: !!unit?.selected,
        })),
      };
      const EventCtor = (typeof window.CustomEvent === 'function')
        ? window.CustomEvent
        : (typeof CustomEvent === 'function' ? CustomEvent : null);
      if (EventCtor) {
        window.dispatchEvent(new EventCtor('citymgmt:units-changed', { detail }));
      } else {
        window.dispatchEvent({ type: 'citymgmt:units-changed', detail });
      }
    } catch (_e) {}
  }

  getUnitsForCity(city) {
    if (!city) return [];
    if (this.unitManager && this._unitCityRef === city) return this.unitManager.units.slice();
    this._ensureManagement(city);
    return Array.isArray(city.management?.units) ? city.management.units.slice() : [];
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
    // Give the city its starting budget; founding already seeded lean starter supplies.
    const startingBudget = window._cityMgmtStartingBudget || 600;
    this.myCity.management.budget += startingBudget;
    window._cityMgmtStartingBudget = 0;
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

  _syncPortCityLocation(city) {
    if (!city?.isCoastal || !city.location) return;
    const portList = Array.isArray(this.world?.portCityLocations)
      ? this.world.portCityLocations
      : ((typeof portCityLocations !== 'undefined' && Array.isArray(portCityLocations)) ? portCityLocations : null);
    if (!portList) return;
    const x = Number(city.location.x);
    const y = Number(city.location.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (!portList.some((loc) => Number(loc?.x) === x && Number(loc?.y) === y)) {
      portList.push({ x, y });
    }
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
      city.management = { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [], units: [], ownerPayoutDue: 0, ownerTaxShare: 0.35, districts: {}, districtEffects: {} };
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
    this._ensureManagement(city);
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

    // Wine reserves create a strong morale boost for feasts, taverns, and festivals.
    const wineQty = Math.max(0, Number(city.inventory?.get("Wine")?.quantity) || 0);
    if (wineQty > 0) {
      const reserveTarget = Math.max(3, Math.ceil((Number(city.population) || 0) * 0.025));
      const wineCoverage = Math.min(1.5, wineQty / reserveTarget);
      h += Math.round(wineCoverage * 8); // up to +12 happiness from strong wine reserves
    }

    // Reputation contributes
    h += (city.reputation - 50) * 0.2; // -10 to +10

    // Custom buildings (upgradeLevels) add small boosts
    const upgrades = city.management?.upgradeLevels || {};
    for (const key of Object.keys(upgrades)) {
      h += (upgrades[key] || 0) * 1.5;
    }

    // Policy happiness bonus (v6)
    if (typeof CityPolicies !== 'undefined') {
      h += CityPolicies.getHappinessBonus(city);
    }
    // Specialization happiness bonus (v6)
    if (typeof CitySpecialization !== 'undefined') {
      h += CitySpecialization.getHappinessBonus(city);
    }
    h += this.getCityScalarEffect(city, 'happiness');

    return Math.max(0, Math.min(100, Math.round(h)));
  }

  /** Get happiness tier label */
  getHappinessTier(happiness) {
    if (happiness >= 80) return { label: 'Thriving',  emoji: '😄', atlasFrame: 'Love',     color: '#4caf50' };
    if (happiness >= 60) return { label: 'Content',   emoji: '🙂', atlasFrame: 'Friendly', color: '#8bc34a' };
    if (happiness >= 40) return { label: 'Neutral',   emoji: '😐', atlasFrame: 'Neutral',  color: '#ffc107' };
    if (happiness >= 20) return { label: 'Unhappy',   emoji: '😟', atlasFrame: 'Hostile',  color: '#ff9800' };
    return                       { label: 'Miserable', emoji: '😡', atlasFrame: 'Hate',     color: '#f44336' };
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
    const foodMult = (typeof CityPolicies !== 'undefined') ? CityPolicies.getFoodConsumptionMult(city) : 1.0;
    const dailyNeed = Math.max(1, Math.ceil(city.population * 0.05 * foodMult));
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
      this._pushCityFeed(city, `Tax rate changed from ${Math.round(old * 100)}% to ${Math.round(r * 100)}%.`, diff > 0 ? 'warning' : 'info', { category: 'finance' });
    }
    return true;
  }

  setOwnerTaxShare(city, share) {
    if (!city) return false;
    this._ensureManagement(city);
    const next = Math.max(0.10, Math.min(0.80, Number(share) || 0.35));
    city.management.ownerTaxShare = next;
    this._pushCityFeed(city, `Owner payout share set to ${Math.round(next * 100)}% of taxes.`, 'info', { category: 'finance' });
    return true;
  }

  getCityOperationHistory(city) {
    this._ensureManagement(city);
    return Array.isArray(city?.management?.operationHistory) ? city.management.operationHistory.slice().reverse() : [];
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
    this._pushCityFeed(city, `Deposited ${amt}g into the city treasury.`, 'success', { category: 'finance' });
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
    this._pushCityFeed(city, `Withdrew ${amt}g from the city treasury.`, 'warning', { category: 'finance' });
    return { ok: true, amount: amt };
  }

  /** Collect owner tax payouts accrued separately from the city treasury. */
  collectOwnerPayout(city, amount = null) {
    if (!city || !this.world.player) return { ok: false, reason: 'no_city' };
    this._ensureManagement(city);
    const due = Math.max(0, Math.floor(Number(city.management?.ownerPayoutDue) || 0));
    if (due <= 0) return { ok: false, reason: 'no_payout' };

    const requested = amount == null ? due : Math.floor(Number(amount) || 0);
    if (requested <= 0) return { ok: false, reason: 'bad_amount' };

    const amt = Math.min(due, requested);
    city.management.ownerPayoutDue = Math.max(0, due - amt);
    if (typeof this.world.player.earnGold === 'function') this.world.player.earnGold(amt);
    else this.world.player.gold = (this.world.player.gold || 0) + amt;
    this._pushCityFeed(city, `Collected ${amt}g in owner payout from city taxes.`, 'success', { category: 'finance' });
    return { ok: true, amount: amt, remaining: city.management.ownerPayoutDue };
  }

  // ─── Building ───────────────────────────────────────────
  getBuildOptions(city) {
    if (!city) return [];
    const opts = [];
    if (!city.hasBank)        opts.push({ type: 'bank',        label: 'Bank',         cost: 650, time: 100, emoji: '🏦', atlasFrame: 'Bank',        desc: 'Enables banking services and improves tax efficiency' });
    if (!city.hasGamblingDen) opts.push({ type: 'gamblingDen', label: 'Gambling Den', cost: 450, time: 70,  emoji: '🎲', atlasFrame: 'Dice',        desc: 'Attracts visitors, with small happiness risk' });
    if (!city.hasBountyBoard) opts.push({ type: 'bountyBoard', label: 'Bounty Board', cost: 340, time: 55,  emoji: '📜', atlasFrame: 'Chart',       desc: 'Post bounties and improve defense readiness' });
    if (!city.hasWeaponShop)  opts.push({ type: 'weaponShop',  label: 'Weapon Shop',  cost: 560, time: 85,  emoji: '⚔️', atlasFrame: 'Sword',       desc: 'Sell weapons, helps city defense' });
    if (!city.hasWinery) opts.push({
      type: 'winery',
      label: 'Winery',
      cost: 520,
      time: 80,
      emoji: '🍷',
      atlasFrame: 'Wine',
      desc: 'Unlocks daily wheat -> wine conversion and morale bonus',
    });
    else opts.push({
      type: 'wineryExpansion',
      label: 'Winery Expansion',
      cost: 420,
      time: 70,
      emoji: '🍷',
      atlasFrame: 'Wine',
      desc: 'Increases daily wine throughput',
    });
    if (!city.hasSchool)      opts.push({ type: 'school',      label: 'School',       cost: 720, time: 110, emoji: '🏫', atlasFrame: 'Book', desc: 'Improves civic stability and long-term growth' });
    // Removable
    if (city.hasBlackMarket)  opts.push({ type: 'removeBlackMarket', label: 'Remove Black Market', cost: 780, time: 40, emoji: '🚫', atlasFrame: 'StolenGoods', desc: 'Makes people happier' });
    // Generic upgrades (repeatable)
    opts.push({ type: 'temple',    label: 'Temple',    cost: 420, time: 75,  emoji: '⛪', desc: '+Happiness, +Reputation' });
    opts.push({ type: 'farm',      label: 'Farm',      cost: 320, time: 60,  emoji: '🌾', atlasFrame: 'Wheat', desc: '+Food production' });
    opts.push({ type: 'housing',   label: 'Housing',   cost: 260, time: 55,  emoji: '🏘️', desc: '+Population cap' });
    opts.push({ type: 'warehouse', label: 'Warehouse', cost: 390, time: 65,  emoji: '📦', atlasFrame: 'Crate',  desc: '+Storage capacity' });
    opts.push({ type: 'walls',     label: 'Walls',     cost: 900, time: 120, emoji: '🏰', atlasFrame: 'Shield', desc: '+Raider defense' });
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
    this._pushCityFeed(city, `Construction started: ${buildingType} (${cost}g).`, 'info', { category: 'build' });
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
    this._pushCityFeed(city, `City expansion approved: +${popGain} population capacity and fresh starter supplies.`, 'success', { category: 'build' });
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
    const newCity = new City({
      name: cityName,
      location: { x: gx, y: gy },
      population: 100,
      stockProfile: 'founded',
    });
    if (typeof newCity.applyFoundedSettlementProfile === 'function') {
      newCity.applyFoundedSettlementProfile({ starterSupplies: { Wheat: 30 } });
    }
    if (typeof newCity.refreshCoastalStatus === 'function') {
      newCity.refreshCoastalStatus(this.world.grid);
    }
    newCity.management = { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [], units: [], ownerPayoutDue: 0, ownerTaxShare: 0.35, districts: {}, districtEffects: {} };

    this.world.cities.push(newCity);
    this._syncPortCityLocation(newCity);
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
      activeShipment: null,
      lastShipment: null,
      shipmentHistory: [],
      shipmentsDispatched: 0,
      shipmentsCompleted: 0,
      shipmentsLost: 0,
      lastIncident: '',
    };
    srcCity.management.routes.push(route);
    this._pushCityFeed(srcCity, `Trade route opened to ${destCity.name}.`, 'success', { category: 'trade' });
    this._notify(`Trade route: ${srcCity.name} → ${destCity.name}`, 'success');
    return { ok: true, route };
  }

  removeTradeRoute(city, routeIndex) {
    if (!city?.management?.routes) return;
    const removed = city.management.routes[routeIndex] || null;
    city.management.routes.splice(routeIndex, 1);
    if (removed?.destName) {
      this._pushCityFeed(city, `Trade route to ${removed.destName} was closed.`, 'warning', { category: 'trade' });
    }
  }

  _processRoutes(city, day) {
    if (!city.management?.routes) return;
    for (const r of city.management.routes) {
      this._ensureRouteRuntime(r);
      // Find destination by name (more robust than index)
      // Backward compat: also check destIndex for old saves
      let dest = this.world.cities?.find(c => c.name === r.destName);
      if (!dest && typeof r.destIndex === 'number') {
        dest = this.world.cities?.[r.destIndex];
      }
      if (!dest) continue;

      if (r.activeShipment && day >= (Number(r.activeShipment.arrivalDay) || 0)) {
        this._resolveIncomingRouteShipment(city, r, r.activeShipment, dest, day);
        r.activeShipment = null;
      }

      const freq = Math.max(1, Number(r.frequencyDays) || 7);
      const goodsPerTransfer = Math.max(0, Number(r.goodsPerTransfer) || 0);
      const goldPerTransfer = Math.max(0, Number(r.goldPerTransfer) || 0);
      const diplomacyIncomeMod = ((city === this.myCity || this._isPlayerOwnedCity(city)) && this.diplomacy && typeof this.diplomacy.getRouteIncomeMod === 'function')
        ? this.diplomacy.getRouteIncomeMod(dest.name)
        : 1;
      if (diplomacyIncomeMod <= 0) {
        r.lastTransferDay = day;
        continue;
      }
      if (r.activeShipment) continue;

      r._goodsCarry = (Number(r._goodsCarry) || 0) + (goodsPerTransfer / freq);
      r._goldCarry = (Number(r._goldCarry) || 0) + (goldPerTransfer / freq);
      const goodsToMove = Math.floor(r._goodsCarry);
      const goldToSettle = Math.floor(r._goldCarry);
      const dx = (dest.location?.x || 0) - (city.location?.x || 0);
      const dy = (dest.location?.y || 0) - (city.location?.y || 0);
      const distance = Math.hypot(dx, dy);
      const srcWalls = city.management?.upgradeLevels?.walls || 0;
      const destWalls = dest.management?.upgradeLevels?.walls || 0;
      const successChance = Math.max(0.35, Math.min(0.98, 0.92 - (distance * 0.003) + ((srcWalls + destWalls) * 0.02)));

      const manifest = this._getRouteManifest(city, r, goodsToMove);
      if (goodsToMove > 0 && manifest.length === 0) {
        r._goodsCarry = Math.max(0, r._goodsCarry - goodsToMove);
        r._goldCarry = Math.max(0, r._goldCarry - goldToSettle);
        r.lastTransferDay = day;
        r.lastIncident = 'No Stock';
        continue;
      }

      // Consume pending transfer budget for this cycle (even if stock was low/failed)
      r._goodsCarry = Math.max(0, r._goodsCarry - goodsToMove);
      r._goldCarry = Math.max(0, r._goldCarry - goldToSettle);
      if (manifest.length <= 0 && goldToSettle <= 0) {
        r.lastTransferDay = day;
        continue;
      }
      const incident = this._rollRouteIncident(distance, successChance, city, dest);
      const travelDays = this._getRouteTravelDays(distance, incident.key);
      r.activeShipment = {
        destName: dest.name,
        departedDay: day,
        arrivalDay: day + travelDays,
        distance: Math.round(distance),
        goodsToMove,
        goldToSettle,
        manifest,
        success: !['raided', 'storm', 'customs', 'privateers', 'theft'].includes(incident.key),
        incidentKey: incident.key,
        incidentLabel: incident.label,
        detail: incident.detail,
      };
      r.shipmentsDispatched = (r.shipmentsDispatched || 0) + 1;
      r.lastIncident = incident.label;
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

  /**
   * Deliver materials to a specific city demand quest.
   * By default uses city stock; optionally also uses player inventory.
   */
  deliverDemandQuest(city, questRef, opts = {}) {
    if (!city || !questRef) return { ok: false, reason: 'bad_args' };
    const cityIdx = this.world.cities.indexOf(city);
    if (cityIdx < 0 || questRef.cityIndex !== cityIdx) return { ok: false, reason: 'wrong_city' };

    const useCity = opts.useCity !== false;
    const usePlayer = !!opts.usePlayer;
    const needed = Math.max(0, (questRef.qtyNeeded || 0) - (questRef.qtyDelivered || 0));
    if (needed <= 0) return { ok: false, reason: 'already_complete' };

    let fromCity = 0;
    let fromPlayer = 0;

    if (useCity) {
      const cityEntry = city.inventory.get(questRef.itemName);
      const cityQty = cityEntry?.quantity || 0;
      const deliverCity = Math.min(needed, Math.max(0, cityQty));
      if (deliverCity > 0) {
        cityEntry.quantity -= deliverCity;
        if (cityEntry.quantity <= 0) city.inventory.delete(questRef.itemName);
        questRef.qtyDelivered += deliverCity;
        fromCity = deliverCity;
      }
    }

    if (usePlayer) {
      const p = this._getPlayerRef();
      if (p?.inventory && typeof p.inventory.get === 'function') {
        const stillNeeded = Math.max(0, (questRef.qtyNeeded || 0) - (questRef.qtyDelivered || 0));
        const pEntry = p.inventory.get(questRef.itemName);
        const pQty = pEntry?.quantity || 0;
        const deliverPlayer = Math.min(stillNeeded, Math.max(0, pQty));
        if (deliverPlayer > 0) {
          pEntry.quantity -= deliverPlayer;
          if (pEntry.quantity <= 0) p.inventory.delete(questRef.itemName);
          if (typeof p.recalcModifiers === 'function') p.recalcModifiers();
          questRef.qtyDelivered += deliverPlayer;
          fromPlayer = deliverPlayer;
        }
      }
    }

    const totalDelivered = fromCity + fromPlayer;
    if (totalDelivered <= 0) return { ok: false, reason: 'no_stock' };

    let completed = false;
    if (questRef.qtyDelivered >= questRef.qtyNeeded) {
      if (city.management) city.management.budget = (city.management.budget || 0) + questRef.reward;
      if (typeof city.adjustReputation === 'function') city.adjustReputation(5);
      this._notify(`Quest complete! +${questRef.reward}g — ${city.name} supplied ${questRef.itemName}`, 'success');
      const idx = this.demandQuests.indexOf(questRef);
      if (idx >= 0) this.demandQuests.splice(idx, 1);
      completed = true;
    } else {
      this._notify(
        `Delivered ${totalDelivered} ${questRef.itemName} (${questRef.qtyDelivered}/${questRef.qtyNeeded}).`,
        'info'
      );
    }

    return { ok: true, delivered: totalDelivered, fromCity, fromPlayer, completed };
  }

  // ─── Victory tracking ──────────────────────────────────
  _updateWealthRanking(opts = {}) {
    const advanceVictory = !!(opts && opts.advanceVictory);
    const ranking = [];
    const ownedCities = this._getOwnedCityRefs();
    const ownedSet = new Set(ownedCities);

    // Aggregate every city under player control so conquest meaningfully advances victory.
    let myCityWealth = 0;
    if (ownedCities.length > 0) {
      for (const city of ownedCities) {
        myCityWealth += this._getCityWealthValue(city, { includeOwnerPayout: true });
      }
    } else {
      // Fallback before settling: use player gold
      myCityWealth = this.world.player?.gold || 0;
    }
    this.playerWealth = myCityWealth;
    const myName = ownedCities.length > 1
      ? `${this.myCity?.name || 'Your'} Dominion`
      : (this.myCity?.name || this.world.player?.captainName || 'You');
    ranking.push({ name: myName, wealth: myCityWealth, isPlayer: true });

    // Rival wealth only includes cities outside the player's control.
    if (this.world.cities) {
      for (const c of this.world.cities) {
        if (ownedSet.has(c)) continue;
        const w = this._getCityWealthValue(c);
        ranking.push({ name: c.name, wealth: w, isPlayer: false });
      }
    }

    ranking.sort((a, b) => b.wealth - a.wealth);
    this.wealthRanking = ranking;

    if (!advanceVictory) return;

    // Check if player is #1
    if (ranking.length > 0 && ranking[0].isPlayer) {
      this.richestStreak = Math.min(this.victoryDays, this.richestStreak + 1);
      if (this.richestStreak >= this.victoryDays && !this.won) {
        this.won = true;
        this._notify(`VICTORY! You've led the richest realm for ${this.victoryDays} days!`, 'success');
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
        resolve: (city, choice, mgr, extra) => {
          if (choice === 0) {
            // Quarantine: lose some population but contain it
            const loss = Math.max(5, Math.floor(city.population * 0.05));
            city.population = Math.max(10, city.population - loss);
            return { message: `Quarantine enforced — lost ${loss} citizens, but the plague is contained.`, type: 'warning' };
          } else {
            const minigamePerf = this._cityEventPerfScore(extra?.minigameResult);
            // Spend gold on medicine. Minigame can lower cost and reduce casualties.
            const baseCost = Math.floor(city.population * 0.5);
            const costDiscount = Math.floor(baseCost * 0.35 * minigamePerf);
            const cost = Math.max(20, baseCost - costDiscount);
            if (mgr && mgr._spendPooled(city, cost)) {
              if (extra?.minigameResult) {
                if (minigamePerf >= 0.75) {
                  if (typeof city.adjustReputation === 'function') city.adjustReputation(2);
                  return { message: `Medical triage succeeded! Spent ${cost}g and stabilized the outbreak (+reputation).`, type: 'success' };
                }
                const loss = Math.max(4, Math.floor(city.population * 0.02));
                city.population = Math.max(10, city.population - loss);
                return { message: `Triage was partial. Spent ${cost}g, but ${loss} citizens were lost.`, type: 'warning' };
              }
              return { message: `Spent ${cost}g on medicine — plague cured quickly!`, type: 'success' };
            } else {
              const loss = Math.max(10, Math.floor(city.population * 0.1));
              city.population = Math.max(10, city.population - loss);
              return { message: `Not enough gold for medicine! Lost ${loss} citizens.`, type: 'error' };
            }
          }
        },
        choices: [
          'Enforce quarantine (lose ~5% pop)',
          { text: 'Run medical triage (minigame, lowers medicine cost)', action: 'minigame', minigame: 'memoryMatch', minigameConfig: { entryFee: 0 } },
        ],
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
        resolve: (city, choice, mgr, extra) => {
          if (choice === 0) {
            const minigamePerf = this._cityEventPerfScore(extra?.minigameResult);
            // Organize bucket brigade: minigame performance influences response efficiency.
            const baseCost = 50 + Math.floor(Math.random() * 50);
            const adjustedCost = Math.max(20, Math.round(baseCost * (1 - (0.35 * minigamePerf))));
            if (mgr && mgr._spendPooled(city, adjustedCost)) {
              if (extra?.minigameResult) {
                if (minigamePerf >= 0.8) {
                  if (typeof city.adjustReputation === 'function') city.adjustReputation(2);
                  return { message: `Bucket brigade nailed it! Fire contained for ${adjustedCost}g (+reputation).`, type: 'success' };
                }
                if (minigamePerf >= 0.45) {
                  return { message: `Fire mostly contained. Spent ${adjustedCost}g; only minor scorch damage.`, type: 'warning' };
                }
                const bqMinor = city.management?.buildingQueue || [];
                if (bqMinor.length > 0) bqMinor[0].progress = Math.max(0, (bqMinor[0].progress || 0) - 10);
                return { message: `Slow response. Spent ${adjustedCost}g and a project lost some progress.`, type: 'warning' };
              }
              return { message: `Fire contained! Spent ${adjustedCost}g organizing the response.`, type: 'success' };
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
        choices: [
          { text: 'Fight the fire (bucket brigade minigame)', action: 'minigame', minigame: 'harvesting' },
          'Evacuate the area (lose some population)',
        ],
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
      {
        name: 'Portside Exchange',
        emoji: '⚓',
        description: 'Harbor brokers and market guilds want to turn the waterfront into a regional exchange for one intense trading week.',
        minDay: 6,
        weight: (city, mgr) => {
          const routeCount = Array.isArray(city?.management?.routes) ? city.management.routes.length : 0;
          return 1.4 + Math.min(1.2, routeCount * 0.45);
        },
        isEligible: (city, mgr) => mgr.getCityDistrictSynergies(city).some((entry) => entry.key === 'portside_exchange'),
        resolve: (city, choice, mgr) => {
          const routeCount = Array.isArray(city?.management?.routes) ? city.management.routes.length : 0;
          const marketTier = Math.max(1, Number(city.management?.districts?.market) || 1);
          const harborTier = Math.max(1, Number(city.management?.districts?.harbor) || 1);
          if (choice === 0) {
            const cost = 95 + (routeCount * 22) + (marketTier * 18);
            if (!(mgr && mgr._spendPooled(city, cost))) {
              return { message: `The exchange needed ${cost}g in dockside subsidies that the treasury could not provide.`, type: 'warning' };
            }
            city._addOrIncrement('Spices', 1 + harborTier);
            city._addOrIncrement('Silk', 1 + Math.floor(marketTier / 2));
            mgr._addCityBuff(city, {
              key: 'exchange_season',
              label: 'Exchange Season',
              sourceOperation: 'portside_exchange',
              durationDays: 6,
              effects: { routeIncome: 0.22 + (harborTier * 0.03), taxIncome: 0.06, happiness: 3 },
              summary: 'Dockside trading surges as merchants flood the waterfront.',
            });
            if (typeof city.adjustReputation === 'function') city.adjustReputation(3);
            return { message: `You backed the exchange: -${cost}g, new luxury stock arrived, and trade lanes are surging.`, type: 'success' };
          }
          const goldGain = 120 + (routeCount * 45) + (marketTier * 30);
          city.management.budget = (city.management?.budget || 0) + goldGain;
          mgr._addCityBuff(city, {
            key: 'dock_tolls',
            label: 'Dock Tolls',
            sourceOperation: 'portside_exchange',
            durationDays: 4,
            effects: { taxIncome: 0.12, happiness: -2 },
            summary: 'Tariffs fill the treasury, but traders grumble about every crate.',
          });
          if (typeof city.adjustReputation === 'function') city.adjustReputation(-3);
          return { message: `You squeezed the exchange for +${goldGain}g in tolls. Traders paid up, but goodwill took a hit.`, type: 'warning' };
        },
        choices: ['Subsidize the exchange week (-gold, strong trade buff)', 'Levy premium dock tolls (+gold, lower goodwill)'],
        timeLimit: 18,
        worstChoice: 1,
      },
      {
        name: 'Guild Showcase',
        emoji: '🛠️',
        description: 'Master artisans and merchants propose a public showcase of new wares, tools, and contracts to put your city on the map.',
        minDay: 6,
        weight: 1.5,
        isEligible: (city, mgr) => mgr.getCityDistrictSynergies(city).some((entry) => entry.key === 'guild_showcase'),
        resolve: (city, choice, mgr) => {
          const craftsTier = Math.max(1, Number(city.management?.districts?.crafts) || 1);
          const routeCount = Array.isArray(city?.management?.routes) ? city.management.routes.length : 0;
          if (choice === 0) {
            const cost = 90 + (craftsTier * 28);
            if (!(mgr && mgr._spendPooled(city, cost))) {
              return { message: `The guild exhibition needed ${cost}g in sponsorship that your treasury lacks.`, type: 'warning' };
            }
            city._addOrIncrement('Tools', 4 + (craftsTier * 2));
            mgr._addCityBuff(city, {
              key: 'showcase_orders',
              label: 'Showcase Orders',
              sourceOperation: 'guild_showcase',
              durationDays: 6,
              effects: { buildSpeed: 0.24, productionChance: 0.12, productionDouble: 0.05 },
              summary: 'Guild orders pour in and workshops hit a faster tempo.',
            });
            if (typeof city.adjustReputation === 'function') city.adjustReputation(2);
            return { message: `You funded the guild showcase: -${cost}g, workshops are flush with orders and new tools.`, type: 'success' };
          }
          const goldGain = 110 + (craftsTier * 35) + (routeCount * 20);
          city.management.budget = (city.management?.budget || 0) + goldGain;
          mgr._addCityBuff(city, {
            key: 'licensed_designs',
            label: 'Licensed Designs',
            sourceOperation: 'guild_showcase',
            durationDays: 4,
            effects: { routeIncome: 0.10, productionChance: 0.05 },
            summary: 'Foreign buyers pay for your designs, shifting attention toward export contracts.',
          });
          if (typeof city.adjustReputation === 'function') city.adjustReputation(-1);
          return { message: `You sold guild designs abroad for +${goldGain}g. It pays well, though locals resent the favoritism.`, type: 'info' };
        },
        choices: ['Sponsor the guild exhibition (-gold, production surge)', 'Auction the designs abroad (+gold, export tilt)'],
        timeLimit: 18,
        worstChoice: 1,
      },
      {
        name: 'Harvest Jubilee',
        emoji: '🌾',
        description: 'Granaries are full enough for the square to call for a harvest jubilee. The crowds want either a feast or strict reserve discipline.',
        minDay: 6,
        weight: 1.4,
        isEligible: (city, mgr) => mgr.getCityDistrictSynergies(city).some((entry) => entry.key === 'harvest_jubilee'),
        resolve: (city, choice, mgr) => {
          const granaryTier = Math.max(1, Number(city.management?.districts?.granary) || 1);
          if (choice === 0) {
            const foodCost = 10 + (granaryTier * 6) + Math.floor((Number(city.population) || 0) * 0.03);
            const availableFood = mgr._getFoodQty(city);
            if (availableFood < foodCost) {
              if (typeof city.adjustReputation === 'function') city.adjustReputation(-1);
              return { message: `The city only had ${availableFood} food available; not enough for the planned jubilee feast (${foodCost} needed).`, type: 'warning' };
            }
            mgr._removeFoodFromCity(city, foodCost);
            mgr._addCityBuff(city, {
              key: 'jubilee_spirit',
              label: 'Jubilee Spirit',
              sourceOperation: 'harvest_jubilee',
              durationDays: 5,
              effects: { happiness: 10, popGrowth: 0.012, foodSaving: 0.08 },
              summary: 'Shared tables and public confidence lift the whole city.',
            });
            if (typeof city.adjustReputation === 'function') city.adjustReputation(3);
            return { message: `You opened the granaries for a public feast: -${foodCost} food, but morale and growth both surged.`, type: 'success' };
          }
          mgr._addCityBuff(city, {
            key: 'tight_ledgers',
            label: 'Tight Ledgers',
            sourceOperation: 'harvest_jubilee',
            durationDays: 5,
            effects: { foodSaving: 0.24, happiness: -4, taxIncome: 0.03 },
            summary: 'Reserve discipline cuts waste, but the streets go quiet.',
          });
          if (typeof city.adjustReputation === 'function') city.adjustReputation(-2);
          return { message: 'You kept the reserves locked down. Food efficiency improved, but the public read it as austerity.', type: 'warning' };
        },
        choices: ['Host a public feast (-food, strong morale and growth)', 'Keep the stores sealed (better reserves, lower morale)'],
        timeLimit: 16,
        worstChoice: 1,
      },
      {
        name: 'Citizen Watch Oath',
        emoji: '🛡️',
        description: 'The barracks and civic square are aligned enough for the watch to swear a public oath. You can build loyalty or demand harder service.',
        minDay: 7,
        weight: 1.3,
        isEligible: (city, mgr) => mgr.getCityDistrictSynergies(city).some((entry) => entry.key === 'citizen_watch'),
        resolve: (city, choice, mgr) => {
          const garrisonTier = Math.max(1, Number(city.management?.districts?.garrison) || 1);
          if (choice === 0) {
            const cost = 105 + (garrisonTier * 25);
            if (!(mgr && mgr._spendPooled(city, cost))) {
              return { message: `A proper oath ceremony required ${cost}g in stipends and supplies that you do not have.`, type: 'warning' };
            }
            if (Array.isArray(city.management?.units)) {
              for (const unit of city.management.units) {
                if (!unit) continue;
                const maxHp = Math.max(1, Number(unit.maxHp) || 1);
                unit.hp = Math.min(maxHp, Math.max(0, Number(unit.hp) || 0) + 2);
              }
            }
            mgr._addCityBuff(city, {
              key: 'sworn_watch',
              label: 'Sworn Watch',
              sourceOperation: 'citizen_watch',
              durationDays: 6,
              effects: { defense: 0.24, happiness: 4, unitCap: 1 },
              summary: 'The watch is publicly respected and the walls feel secure.',
            });
            if (typeof city.adjustReputation === 'function') city.adjustReputation(2);
            return { message: `You funded the oath ceremony: -${cost}g, the watch is steadier and the streets feel safer.`, type: 'success' };
          }
          mgr._addCityBuff(city, {
            key: 'forced_levy',
            label: 'Forced Levy',
            sourceOperation: 'citizen_watch',
            durationDays: 6,
            effects: { defense: 0.30, unitCostDiscount: 0.15, happiness: -5, unitCap: 2 },
            summary: 'Mandatory service swells the watch at the cost of public patience.',
          });
          if (typeof city.adjustReputation === 'function') city.adjustReputation(-3);
          return { message: 'You ordered a harder levy. The city is safer on paper, but resentment is building in the wards.', type: 'warning' };
        },
        choices: ['Fund a public oath ceremony (-gold, loyal defense buff)', 'Impose a hard levy (stronger defense, morale hit)'],
        timeLimit: 16,
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
    const eligible = events.filter((event) => this._isCityEventEligible(event, this.myCity, day));
    if (eligible.length === 0) return;

    // Weighted random selection
    const totalWeight = eligible.reduce((sum, event) => sum + this._getCityEventWeight(event, this.myCity, day), 0);
    let roll = Math.random() * totalWeight;
    let chosen = eligible[0];
    for (const event of eligible) {
      roll -= this._getCityEventWeight(event, this.myCity, day);
      if (roll <= 0) { chosen = event; break; }
    }

    const gs = this._getGameStates();
    const gsm = this._getGameStateManager();
    const inCityManage = !!(gs && gsm && typeof gsm.is === 'function' && gsm.is(gs.CITY_MANAGE));
    const defaultReturnState = (gs && gs.CITY_MANAGE && gs.PLAYING)
      ? (inCityManage ? gs.CITY_MANAGE : gs.PLAYING)
      : null;

    this._activeCityEvent = {
      ...chosen,
      triggered: day,
      // Keep game-time deadline for backward compatibility with old flows.
      deadlineGameTimeMs: chosen.timeLimit ? this._getCurrentGameTimeMs() + chosen.timeLimit * 1000 : 0,
      // Use wall-clock deadline so countdown continues while RANDOM_EVENT pauses dayNight.
      deadlineWallTimeMs: chosen.timeLimit ? Date.now() + chosen.timeLimit * 1000 : 0,
      returnState: defaultReturnState,
    };

    this._scheduleActiveCityEventTimeout();

    this._notify(`${chosen.emoji} City Event: ${chosen.name}!`, 'quest');
    // Transition to the global random event view so the player sees and
    // resolves the city event using the shared event UI.
    if (gs && gs.RANDOM_EVENT) {
      // Expose the active city event for the UI to consume
      window._cityEventActive = this._activeCityEvent;
      this._setState(gs.RANDOM_EVENT);
    }
  }

  _cityEventPerfScore(result) {
    if (!result || !result.success) return 0;
    let perf = 0.55;
    if (result.caught !== undefined) perf = result.caught / Math.max(1, result.total);
    else if (result.hits !== undefined) perf = result.hits / Math.max(1, result.total);
    else if (result.collected !== undefined) perf = result.collected / Math.max(1, result.collected + result.missed);
    else if (result.goodChops !== undefined) perf = result.goodChops / Math.max(1, result.total);
    else if (result.found !== undefined) perf = result.found / Math.max(1, result.total);
    else if (result.avgAccuracy !== undefined) perf = result.avgAccuracy;
    return Math.max(0, Math.min(1, Number(perf) || 0));
  }

  launchCityEventChoiceMinigame(choiceIndex, onDone) {
    if (!this._activeCityEvent || !this.myCity) return false;
    const evt = this._activeCityEvent;
    const choice = evt?.choices?.[choiceIndex];
    if (!choice || typeof choice !== 'object' || choice.action !== 'minigame' || !choice.minigame) return false;

    const mm = this._getMinigameManager();
    const gs = this._getGameStates();
    const gsm = this._getGameStateManager();
    if (!mm || !gs || !gsm) return false;

    this._clearCityEventTimer();
    mm.launch(choice.minigame, choice.minigameConfig || {}, (miniResult) => {
      // Return to RANDOM_EVENT so the shared event result UI is visible.
      this._setState(gs.RANDOM_EVENT);
      const result = this.resolveCityEvent(choiceIndex, { minigameResult: miniResult });
      if (typeof onDone === 'function') onDone(result);
    });
    this._setState(gs.MINIGAME);
    return true;
  }

  /** Resolve the active city event with the player's choice */
  resolveCityEvent(choiceIndex, extra = null) {
    if (!this._activeCityEvent || !this.myCity) return null;
    this._clearCityEventTimer();
    const evt = this._activeCityEvent;
    const result = evt.resolve(this.myCity, choiceIndex, this, extra);
    this._activeCityEvent = null;
    this._pushCityFeed(this.myCity, result.message, result.type || 'info', { category: 'event' });
    this._notify(result.message, result.type || 'info');
    return result;
  }

  /** Auto-resolve event if timer expires */
  _checkCityEventTimeout() {
    if (!this._activeCityEvent) return;
    const gsm = this._getGameStateManager();
    const gs = this._getGameStates();
    // Pause city-event timeout while any minigame is active.
    if (gsm && gs && typeof gsm.is === 'function' && gs.MINIGAME && gsm.is(gs.MINIGAME)) return;
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
    if (template.portOnly && !city.port) return { ok: false, reason: 'non_port' };
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
      accuracy: template.accuracy,
      critChance: template.critChance,
      attackRangeMin: template.attackRangeMin,
      attackRangeMax: template.attackRangeMax,
      reactionRange: template.reactionRange,
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
      { key: 'militia', label: 'Militia', emoji: '🛡️', atlasFrame: 'Shield', baseCost: 140, hp: 12, attack: 2, defense: 1, accuracy: 0.72, critChance: 0.06, attackRangeMin: 1, attackRangeMax: 1, reactionRange: 1, movementType: 'land', desc: 'Cheap front line.' },
      { key: 'guard', label: 'Guard', emoji: '🗡️', atlasFrame: 'Dagger', baseCost: 180, hp: 16, attack: 3, defense: 2, accuracy: 0.76, critChance: 0.08, attackRangeMin: 1, attackRangeMax: 1, reactionRange: 1, movementType: 'land', desc: 'Tough defender.' },
      { key: 'ranger', label: 'Ranger', emoji: '🏹', atlasFrame: 'Bow', baseCost: 170, hp: 11, attack: 4, defense: 1, accuracy: 0.7, critChance: 0.18, attackRangeMin: 1, attackRangeMax: 4, reactionRange: 4, movementType: 'land', desc: 'Ranged skirmisher that can attack raiders from several tiles away.' },
      { key: 'corsair', label: 'Corsair', emoji: '⛵', atlasFrame: 'sloop', baseCost: 220, hp: 13, attack: 4, defense: 2, accuracy: 0.75, critChance: 0.1, attackRangeMin: 1, attackRangeMax: 2, reactionRange: 3, movementType: 'naval', coastalOnly: true, portOnly: true, desc: 'Naval unit: water movement, anti-pirate bonus.' },
    ];
  }

  getUnitCap(city) {
    if (!city) return this._unitBaseCap;
    const walls = city.management?.upgradeLevels?.walls || 0;
    const bonus = Math.max(0, Math.floor(this.getCityScalarEffect(city, 'unitCap')));
    return this._unitBaseCap + (walls * 2) + bonus;
  }

  getUnitTrainCost(city, classKey = 'militia') {
    if (!city) return this._unitBaseCost;
    const unitCount = Array.isArray(city.management?.units) ? city.management.units.length : 0;
    const days = this._getDaysElapsed();
    const inflation = Math.min(60, Math.floor(days / 12) * 5);
    const rosterPressure = Math.floor(unitCount / 3) * 20;
    const tpl = this.getUnitTemplates().find((t) => t.key === classKey);
    const base = tpl ? tpl.baseCost : this._unitBaseCost;
    const discount = Math.max(0, Math.min(0.65, this.getCityScalarEffect(city, 'unitCostDiscount')));
    return Math.max(40, Math.floor((base + inflation + rosterPressure) * (1 - discount)));
  }

  getReadyUnitCount(city) {
    if (!city || !this.unitManager) return 0;
    if (this._unitCityRef !== city) this._loadUnitsForCity(city);
    return this.unitManager.units.filter((u) => u && u.hp > 0 && u.state !== 'defeated' && u._combatCooldown <= 0).length;
  }

  _getUnitAttackRange(unit) {
    if (!unit) return { min: 1, max: 1 };
    if (typeof unit.getAttackRange === 'function') return unit.getAttackRange();
    const min = Math.max(1, Math.floor(Number(unit.attackRangeMin) || 1));
    const max = Math.max(min, Math.floor(Number(unit.attackRangeMax) || min));
    return { min, max };
  }

  _getUnitReactionRange(unit) {
    if (!unit) return 1;
    if (typeof unit.getReactionRange === 'function') return unit.getReactionRange();
    const range = this._getUnitAttackRange(unit);
    return Math.max(range.max, Math.floor(Number(unit.reactionRange) || range.max));
  }

  _isUnitTargetInRange(unit, targetOrDistance) {
    if (!unit) return false;
    if (typeof unit.isTargetInRange === 'function') return unit.isTargetInRange(targetOrDistance);
    const range = this._getUnitAttackRange(unit);
    const dist = (typeof targetOrDistance === 'number')
      ? Math.max(0, Math.floor(Number(targetOrDistance) || 0))
      : Math.abs((targetOrDistance?.x || 0) - unit.x) + Math.abs((targetOrDistance?.y || 0) - unit.y);
    return dist >= range.min && dist <= range.max;
  }

  _normalizeWarBattlePayload(payload = null) {
    if (!payload || typeof payload !== 'object') return null;
    const expiresAtRaw = Number(payload.expiresAt);
    const hasFutureExpiry = Number.isFinite(expiresAtRaw) && expiresAtRaw > Date.now();
    return {
      grade: String(payload.grade || 'C').toUpperCase(),
      score: Math.max(0, Math.min(100, Math.floor(Number(payload.score) || 0))),
      winBonus: Math.max(-0.1, Math.min(0.3, Number(payload.winBonus) || 0)),
      lootBonus: Math.max(0, Math.min(1, Number(payload.lootBonus) || 0)),
      tacticalMomentum: Math.max(-0.24, Math.min(0.24, Number(payload.tacticalMomentum) || 0)),
      casualtyMitigation: Math.max(-0.15, Math.min(0.18, Number(payload.casualtyMitigation) || 0)),
      timedOut: !!payload.timedOut,
      playerBattleWon: !!payload.playerBattleWon,
      playerUnitsRemaining: Math.max(0, Math.floor(Number(payload.playerUnitsRemaining) || 0)),
      enemyUnitsRemaining: Math.max(0, Math.floor(Number(payload.enemyUnitsRemaining) || 0)),
      playerMaterial: Math.max(0, Number(payload.playerMaterial) || 0),
      enemyMaterial: Math.max(0, Number(payload.enemyMaterial) || 0),
      cardsPlayed: Math.max(0, Math.floor(Number(payload.cardsPlayed) || 0)),
      enemyCardsPlayed: Math.max(0, Math.floor(Number(payload.enemyCardsPlayed) || 0)),
      seed: Number.isFinite(Number(payload.seed)) ? (Number(payload.seed) >>> 0) : null,
      expiresAt: hasFutureExpiry ? expiresAtRaw : null,
    };
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
    const range = this._getUnitAttackRange(unit);
    const rangeValue = Math.max(0, range.max - 1) * 0.7;
    return (unit.attack * 2.1) + (unit.defense * 1.5) + ((unit.level || 1) * 1.6) + (hpRatio * 2.5) + rangeValue;
  }

  _getUnitCombatPowerFromData(unitData) {
    if (!unitData) return 0;
    const hp = Math.max(0, Number(unitData.hp) || 0);
    if (hp <= 0) return 0;
    const maxHp = Math.max(1, Number(unitData.maxHp) || 1);
    const hpRatio = hp / maxHp;
    const minRange = Math.max(1, Math.floor(Number(unitData.attackRangeMin) || 1));
    const maxRange = Math.max(minRange, Math.floor(Number(unitData.attackRangeMax) || minRange));
    const rangeValue = Math.max(0, maxRange - 1) * 0.7;
    return ((Number(unitData.attack) || 2) * 2.1)
      + ((Number(unitData.defense) || 1) * 1.5)
      + ((Number(unitData.level) || 1) * 1.6)
      + (hpRatio * 2.5)
      + rangeValue;
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
    const base = (city.population / 45) + (walls * 7) + (hasWeaponShop ? 7 : 0) + unitPower + 9;
    const defenseBonus = Math.max(0, this.getCityScalarEffect(city, 'defense'));
    return base * (1 + defenseBonus);
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
    const hasPort = !!city.port;
    const candidateKeys = ['militia', 'guard', 'ranger'];
    if (canCoastal && hasPort) candidateKeys.push('corsair');
    const key = candidateKeys[Math.floor(Math.random() * candidateKeys.length)];
    const tpl = templates.find((t) => t.key === key) || templates[0];
    if (tpl.portOnly && !hasPort) return;
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

  getIncomingInvasions(city = null) {
    const targetCity = city || this.myCity;
    if (!targetCity) return [];
    const targetIdx = this.world.cities?.indexOf(targetCity);
    if (!(targetIdx >= 0) || !Array.isArray(this._pendingPlayerInvasions)) return [];
    return this._pendingPlayerInvasions
      .filter((inv) => inv && Number(inv.targetIndex) === targetIdx)
      .sort((a, b) => (Number(a.arrivalDay) || 0) - (Number(b.arrivalDay) || 0))
      .map((inv) => ({ ...inv }));
  }

  _resolvePlayerCityInvasion(inv, day) {
    if (!inv || !this.myCity) return;
    const attacker = this.world.cities?.[inv.attackerIndex] || null;
    if (!attacker || attacker === this.myCity || this._isPlayerOwnedCity(attacker)) return;
    const myCity = this.myCity;
    const preview = inv.preview || this._getAIInvasionPreview(attacker, myCity);
    if (!preview) return;

    const defended = Math.random() >= preview.winChance;
    const attackerLoss = this._applyAICampaignCasualties(attacker, !defended);
    const defenderLoss = this._applyAICampaignCasualties(myCity, defended);
    if (defended) {
      const bounty = Math.max(30, Math.floor((Number(inv.warCost) || preview.warCost || 0) * 0.28));
      if (myCity.management) myCity.management.budget = Math.max(0, (myCity.management.budget || 0) + bounty);
      if (typeof myCity.adjustReputation === 'function') myCity.adjustReputation(2);
      this._notify(`🛡️ ${myCity.name} repelled an invasion from ${attacker.name}. (+${bounty}g)`, 'success');
      this._pushUnitFeed(`${attacker.name} failed to invade ${myCity.name}. Losses: A${attackerLoss}/D${defenderLoss}.`, 'success');
      return;
    }

    const treasury = Math.max(0, Number(myCity.management?.budget) || 0);
    const raidRatio = Math.max(0.08, Math.min(0.24, 0.1 + ((preview.attackPower - preview.defensePower) * 0.004)));
    const goldLoss = Math.max(20, Math.floor(treasury * raidRatio));
    const pop = Math.max(10, Number(myCity.population) || 10);
    const popLoss = Math.max(1, Math.floor(pop * (0.01 + (raidRatio * 0.05))));
    if (myCity.management) myCity.management.budget = Math.max(0, treasury - goldLoss);
    myCity.population = Math.max(10, pop - popLoss);
    if (typeof myCity.adjustReputation === 'function') myCity.adjustReputation(-2);
    this._notify(`🔥 ${attacker.name} invaded ${myCity.name}: -${goldLoss}g, -${popLoss} population.`, 'error');
    this._pushUnitFeed(`${attacker.name} broke through ${myCity.name}. Losses: A${attackerLoss}/D${defenderLoss}.`, 'error');
  }

  _processPendingPlayerInvasions(day) {
    if (!Array.isArray(this._pendingPlayerInvasions) || this._pendingPlayerInvasions.length === 0) return;
    for (let i = this._pendingPlayerInvasions.length - 1; i >= 0; i--) {
      const inv = this._pendingPlayerInvasions[i];
      if (!inv) {
        this._pendingPlayerInvasions.splice(i, 1);
        continue;
      }
      const arrival = Number(inv.arrivalDay) || 0;
      if (day < arrival) continue;
      this._resolvePlayerCityInvasion(inv, day);
      this._pendingPlayerInvasions.splice(i, 1);
    }
  }

  _runAICityWarfare(day) {
    if (!this.world.cities || day < this._nextAIDecisionDay) return;
    const p = this._getPlayerRef();
    let playerCityAttackResolved = false;
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
      const canAttackMyCity = !!(this.isSettled
        && this.myCity
        && attacker !== this.myCity
        && !playerCityAttackResolved
        && this.getIncomingInvasions(this.myCity).length <= 0
        && (day - this._lastPlayerInvasionDay) >= this._playerInvasionCooldownDays);
      if (canAttackMyCity) {
        const myCity = this.myCity;
        const myPreview = this._getAIInvasionPreview(attacker, myCity);
        if (myPreview) {
          const closeFactor = Math.max(0, 1 - ((myPreview.distance || 0) / 140));
          const pressure = this.getHostilePressure(myCity, 16);
          const pressureFactor = Math.min(0.2, ((pressure.hostileCities || 0) * 0.04) + ((pressure.hostileUnits || 0) * 0.01));
          const strategic = this._getCityStrategicPressure(myCity);
          const valueFactor = Math.min(0.14, (strategic.rivalAttention * 0.03) + (strategic.routeRisk * 0.45) + (strategic.foodRisk * 0.3));
          const deterrence = Math.min(0.08, strategic.defenseRelief * 0.75);
          const strikeChance = 0.08 + (closeFactor * 0.18) + pressureFactor + valueFactor - deterrence;
          const warCostOk = (attacker.management?.budget || 0) >= myPreview.warCost;
          if (warCostOk && Math.random() < strikeChance) {
            attacker.management.budget = Math.max(0, (attacker.management?.budget || 0) - myPreview.warCost);
            playerCityAttackResolved = true;
            this._lastPlayerInvasionDay = day;
            const arrivalDay = day + 1;
            this._pendingPlayerInvasions.push({
              id: this._nextPlayerInvasionId++,
              attackerIndex: this.world.cities.indexOf(attacker),
              attackerName: attacker.name || 'Rival City',
              targetIndex: this.world.cities.indexOf(myCity),
              targetName: myCity.name || 'Your City',
              announcedDay: day,
              arrivalDay,
              warCost: myPreview.warCost,
              distance: myPreview.distance,
              preview: {
                attackPower: myPreview.attackPower,
                defensePower: myPreview.defensePower,
                winChance: myPreview.winChance,
                warCost: myPreview.warCost,
                distance: myPreview.distance,
              },
            });
            this._notify(`🚨 Incoming invasion: ${attacker.name} marching on ${myCity.name} (impact on Day ${arrivalDay}).`, 'warning');
            this._pushUnitFeed(`${attacker.name} is marching on ${myCity.name}. ETA 1 day.`, 'warning');
            continue;
          }
        }
      }
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
    const battlePlan = (typeof CityWarBattle !== 'undefined' && CityWarBattle && typeof CityWarBattle.describeBattlePlan === 'function')
      ? CityWarBattle.describeBattlePlan({
          preview: { attackPower, defensePower, winChance, warCost, distance: Math.round(distance), qteBonus },
          sourceCity: srcCity,
          targetCity,
          day: this._getDaysElapsed(),
        })
      : null;
    return { attackPower, defensePower, winChance, warCost, distance: Math.round(distance), qteBonus, battlePlan };
  }

  setWarQTEBuff(payload = {}) {
    const durationMs = Math.max(10000, Math.min(10 * 60 * 1000, Math.floor(Number(payload.durationMs) || (3 * 60 * 1000))));
    this._warQteBuff = this._normalizeWarBattlePayload({
      ...payload,
      expiresAt: Date.now() + durationMs,
    });
    const grade = this._warQteBuff?.grade || 'C';
    const score = this._warQteBuff?.score || 0;
    const winBonus = this._warQteBuff?.winBonus || 0;
    const lootBonus = this._warQteBuff?.lootBonus || 0;
    this._pushUnitFeed(`War plan ${grade} (${score}) armed: +${Math.round(winBonus * 100)}% invasion, +${Math.round(lootBonus * 100)}% loot.`, 'success');
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

    const qteBuff = this._normalizeWarBattlePayload(qteOverride) || this._consumeWarQTEBuff();
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
    let finalWinChance = Math.max(0.05, Math.min(0.95, Number(preview.winChance) || 0.5));
    let tacticalMomentum = 0;
    let casualtyMitigation = 0;
    if (campaign.controlledByPlayer && campaign.qteBuff && Number.isFinite(Number(campaign.qteBuff.score))) {
      qteScore = Math.max(0, Math.min(100, Number(campaign.qteBuff.score)));
      tacticalMomentum = Math.max(-0.24, Math.min(0.24, Number(campaign.qteBuff.tacticalMomentum) || 0));
      casualtyMitigation = Math.max(-0.15, Math.min(0.18, Number(campaign.qteBuff.casualtyMitigation) || 0));
      const cardTempo = Math.max(
        -0.04,
        Math.min(
          0.08,
          ((Number(campaign.qteBuff.cardsPlayed) || 0) - (Number(campaign.qteBuff.enemyCardsPlayed) || 0)) * 0.015
        )
      );
      const battleBias = campaign.qteBuff.playerBattleWon === true ? 0.06 : -0.08;
      finalWinChance = Math.max(
        0.08,
        Math.min(
          0.96,
          finalWinChance
            + tacticalMomentum
            + cardTempo
            + battleBias
            + ((Number(campaign.qteBuff.winBonus) || 0) * 0.35)
        )
      );
      qteThreshold = Math.round(finalWinChance * 100);
      won = Math.random() < finalWinChance;
      campaign._qteThreshold = qteThreshold;
    } else {
      won = Math.random() < finalWinChance;
    }
    let attackersLost = 0;
    const casualtyPressure = Math.max(
      0.05,
      Math.min(
        0.88,
        (won ? (0.12 + (1 - finalWinChance) * 0.22) : (0.3 + (1 - finalWinChance) * 0.28))
          - casualtyMitigation
      )
    );
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
      if (!targetCity.management) targetCity.management = { budget: 0, taxRate: 0.05, buildingQueue: [], upgradeLevels: {}, routes: [], units: [], ownerPayoutDue: 0, ownerTaxShare: 0.35, districts: {}, districtEffects: {} };
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
      const lootBonus = campaign.qteBuff
        ? Math.max(0, (campaign.qteBuff.lootBonus || 0) + Math.max(0, tacticalMomentum * 0.45))
        : 0;
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
        ? ` Battle ${Math.round(qteScore)} vs ${Math.round(qteThreshold)}.`
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
      ? ` Battle ${Math.round(qteScore)} vs ${Math.round(qteThreshold)}.`
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

    const attackDistance = Math.max(1, Math.floor(Number(opts.attackDistance) || 1));
    const range = this._getUnitAttackRange(unit);
    const unitAccuracy = Math.max(0.4, Math.min(0.95, Number(unit.accuracy) || 0.72));
    const unitCrit = Math.max(0, Math.min(0.5, Number(unit.critChance) || 0.08));
    const isRangedAttack = range.max > 1 && attackDistance > 1;
    const rangePressure = isRangedAttack ? Math.max(0, attackDistance - Math.max(1, range.min)) : 0;

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
    const accuracyBonus = ((unitAccuracy - 0.68) * 0.32) - (rangePressure * 0.02);
    const critBonus = unitCrit * 0.14;
    const rangeBonus = isRangedAttack ? Math.min(0.12, 0.05 + ((attackDistance - 1) * 0.02)) : 0;
    const defenseBonus = (wallLevel * 0.04) + (hasWeaponShop ? 0.06 : 0) + navalBonus + contextBonus + postureBonus + accuracyBonus + critBonus + rangeBonus;
    const winChance = Math.max(0.16, Math.min(0.88, 0.44 + ((unitPower - raiderPower) * 0.10) + defenseBonus));

    const qteControl = Math.max(-1, Math.min(1, Number(opts.qteControl || 0)));
    const retaliationBias = Number(opts.retaliationBias || 0);
    let retaliationChance = Math.max(
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
    if (isRangedAttack) retaliationChance = Math.max(0.04, retaliationChance * 0.4);

    if (Math.random() < winChance) {
      let retaliationDamage = 0;
      let retaliated = false;
      if (Math.random() < retaliationChance) {
        retaliated = true;
        retaliationDamage = Math.max(
          1,
          Math.ceil(raiderPower * (isRangedAttack ? 0.4 : 0.55))
            - Math.floor(unit.defense * 0.5)
            + Math.floor(Math.random() * 3)
        );
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
    const damageMultiplier = (isRangedAttack ? 0.68 : 0.82) + (failureSeverity * 0.25);
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
      const inRange = this._isUnitTargetInRange(selected, dist);
      if ((selected._combatCooldown || 0) > 0) return { handled: true, action: 'cooldown', unit: selected };
      if (inRange) {
        selected._chaseRaiderId = null;
        selected._chaseRaiderRef = null;
        if (opts?.requireQTE) {
          return { handled: true, action: 'attack_qte', unit: selected, raider: targetRaider };
        }
        const result = this._engageUnitVsRaider(selected, targetRaider, city, {
          bountyBase: 14,
          contextBonus: 0.03,
          engagementType: 'manual',
          attackDistance: dist,
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
    const attackDistance = Math.abs((raider?.x || 0) - unit.x) + Math.abs((raider?.y || 0) - unit.y);
    const result = this._engageUnitVsRaider(unit, raider, city, {
      bountyBase: 14,
      contextBonus: 0.02 + qteBonus,
      engagementType: 'manual',
      attackDistance,
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
      const reactionRange = this._getUnitReactionRange(unit);

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
      if (!this._isUnitTargetInRange(unit, bestDist)) {
        const targetTile = this.world.grid?.[target.y]?.[target.x];
        const targetType = targetTile?.options?.[0];
        const cityMap = this.world.cityLocationMap || (typeof cityLocationMap !== 'undefined' ? cityLocationMap : null);
        const isCityTile = !!(cityMap && typeof cityMap.has === 'function' && cityMap.has(`${target.x},${target.y}`));
        const canPursue = isManualChase ? true : (bestDist <= Math.max(5, reactionRange + 1));
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
        attackDistance: bestDist,
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
      const reach = this._getUnitReactionRange(unit);
      if (dist > reach) continue;
      if (dist < bestDist) {
        bestDist = dist;
        defender = unit;
      }
    }
    // Allow intercept if unit is close enough to respond around the city.
    if (!defender) return { attempted: false, intercepted: false };

    const result = this._engageUnitVsRaider(defender, raider, city, {
      bountyBase: 12,
      engagementType: 'auto',
      attackDistance: bestDist,
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

  _applyCivilUnrest(city) {
    if (!city) return;
    const h = this.getHappiness(city);
    if (h >= 30) return;

    const isPlayerCity = city === this.myCity;
    const pop = Math.max(10, Number(city.population) || 10);
    const severity = Math.max(0, (30 - h) / 30); // 0..1

    // Emigration pressure: unhappy citizens leave each day at low happiness.
    const leavePct = 0.005 + (severity * 0.018); // 0.5%..2.3%
    const leaving = Math.max(1, Math.floor(pop * leavePct));
    city.population = Math.max(10, pop - leaving);
    if (typeof city.adjustReputation === 'function') city.adjustReputation(-(1 + Math.floor(severity * 2)));

    if (isPlayerCity) {
      this._notify(`⚠️ Civil unrest: ${leaving} citizens left ${city.name} due to low happiness.`, 'warning');
    }

    // Severe misery can escalate into revolt with tangible penalties.
    if (h > 12) return;
    const revoltChance = Math.min(0.65, 0.20 + ((12 - h) * 0.04)); // 20%..65%
    if (Math.random() > revoltChance) return;

    const treasuryHit = Math.max(0, Math.floor((city.management?.budget || 0) * (0.08 + (severity * 0.12))));
    if (city.management) city.management.budget = Math.max(0, (city.management.budget || 0) - treasuryHit);

    let sabotage = false;
    const bq = city.management?.buildingQueue || [];
    if (bq.length > 0) {
      bq[0].progress = Math.max(0, (bq[0].progress || 0) - 20);
      sabotage = true;
    }

    if (isPlayerCity) {
      this._notify(
        `🔥 Revolt in ${city.name}! Lost ${treasuryHit}g${sabotage ? ' and construction was sabotaged' : ''}.`,
        'error'
      );
    }
  }

  _processDaily(day) {
    if (!(day > 0) || day === this._lastProcessedDay) return;
    this._lastProcessedDay = day;

    // Update wealth ranking & victory check
    this._updateWealthRanking({ advanceVictory: true });

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

    // Trigger city events on deterministic day cadence.
    if (this.isSettled && day >= this._nextEventDay) {
      this._triggerCityEvent(day);
      this._nextEventDay = day + Math.max(1, this._eventIntervalDays);
    }

    // Daily tax + route processing
    for (const c of this.world.cities) {
      this._applyCivilUnrest(c);
      if (typeof c.applyWeeklyTax === 'function') {
        const revenue = c.applyWeeklyTax(1);
        const taxBonus = this.getCityScalarEffect(c, 'taxIncome', day);
        if (revenue > 0 && taxBonus > 0 && c.management) {
          c.management.budget += Math.max(0, Math.floor(revenue * taxBonus));
        }
      }
      this._processRoutes(c, day);
      this._musterAICityUnits(c, day);
    }
    this._processActiveCampaigns(day);
    this._processPendingPlayerInvasions(day);
    this._runAICityWarfare(day);

    // ─── New systems daily tick (v6) ─────────────────────
    if (this.isSettled && this.myCity) {
      // Policies: deduct daily costs (auto-disables if broke)
      if (typeof CityPolicies !== 'undefined') {
        const polResult = CityPolicies.processDailyCosts(this.myCity);
        if (polResult.disabled?.length > 0) {
          this._notify(`Budget empty! Disabled: ${polResult.disabled.join(', ')}`, 'warning');
        }
      }
      // Specialization: check tier advancement
      if (typeof CitySpecialization !== 'undefined') {
        const advanced = CitySpecialization.checkAdvancement(this.myCity);
        if (advanced) {
          const tier = CitySpecialization.getCurrentTierDef(this.myCity);
          this._notify(`City specialization advanced to ${tier?.name || 'next tier'}!`, 'achievement');
        }
        // Tourism income
        const tourism = CitySpecialization.getTourismIncome(this.myCity);
        if (tourism > 0 && this.myCity.management) {
          this.myCity.management.budget += tourism;
        }
      }
      // Diplomacy: daily decay & pact expiry
      if (this.diplomacy) {
        this.diplomacy.processDaily(day);
        const diploActions = this._runStrategicDiplomacy(this.myCity, day);
        for (const action of diploActions) {
          this._notify(`Diplomacy shift: ${action.msg}`, 'info');
        }
      }
      // Espionage: process returning spies
      if (this.espionage) {
        const spyResults = this.espionage.processDaily(day, this.world.cities || [], this.myCity);
        for (const r of spyResults) {
          if (r.type === 'caught' && this.diplomacy) {
            this.diplomacy.adjustScore(r.city, -15);
          }
          this._notify(r.msg, r.type === 'caught' ? 'error' : 'info');
        }
      }
      // Advisors: unlock check, quest generation, progress check
      if (this.advisors) {
        const newUnlocks = this.advisors.checkUnlocks(this.myCity);
        for (const a of newUnlocks) {
          this._notify(`${a.emoji} ${a.name} has joined your council!`, 'achievement');
        }
        this.advisors.generateQuests(day, this.myCity);
        const completed = this.advisors.checkProgress(this.myCity, this, day);
        for (const q of completed) {
          this._notify(`Advisor quest complete! Collect your ${q.reward}g reward.`, 'achievement');
        }
      }
      for (const ownedCity of this._getOwnedCityRefs()) {
        this._advanceCityOperations(ownedCity, day);
        this._updateCityDirectives(ownedCity, day);
      }
    }
    for (const c of this.world.cities) {
      this._updateCityDailyBrief(c, day);
    }
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
      this._resolveUnitRaiderSkirmishes(dt);
      this._unitPersistAccumMs += Math.max(0, Number(dt) || 0);
      if (this._unitPersistAccumMs >= this._unitPersistIntervalMs) {
        this._persistUnitsForCity(this._unitCityRef);
        this._unitPersistAccumMs = 0;
      }
    }

    // Check city event timeout every frame
    this._checkCityEventTimeout();

    // Fallback polling in case dayChanged was missed (e.g., load edge-cases).
    this._processDaily(day);
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
      _eventIntervalDays: this._eventIntervalDays,
      _nextUnitId: this._nextUnitId,
      _nextAIDecisionDay: this._nextAIDecisionDay,
      _lastPlayerInvasionDay: this._lastPlayerInvasionDay,
      _playerInvasionCooldownDays: this._playerInvasionCooldownDays,
      _pendingPlayerInvasions: this._pendingPlayerInvasions,
      _nextPlayerInvasionId: this._nextPlayerInvasionId,
      _nextCampaignId: this._nextCampaignId,
      _warQteBuff: this._normalizeWarBattlePayload(this._warQteBuff),
      activeCampaigns: this._activeCampaigns.map((campaign) => ({
        ...campaign,
        qteBuff: this._normalizeWarBattlePayload(campaign?.qteBuff),
      })),
      _lastProcessedDay: this._lastProcessedDay,
      _lastWeekDay: this._lastWeekDay,
      selectedUnitId: this.getSelectedUnit()?.id ?? null,
      activeCityEvent: this._activeCityEvent ? {
        name: this._activeCityEvent.name,
        triggered: this._activeCityEvent.triggered || this._getDaysElapsed(),
        remainingMs: this.getCityEventTimerRemainingMs(),
      } : null,
      // v6 systems
      diplomacy: this.diplomacy ? this.diplomacy.toJSON() : null,
      espionage: this.espionage ? this.espionage.toJSON() : null,
      advisors: this.advisors ? this.advisors.toJSON() : null,
      policies: (this.myCity && typeof CityPolicies !== 'undefined') ? CityPolicies.toJSON(this.myCity) : null,
      specialization: (this.myCity && typeof CitySpecialization !== 'undefined') ? CitySpecialization.toJSON(this.myCity) : null,
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
    cm._eventIntervalDays = Math.max(1, Number(obj._eventIntervalDays) || 5);
    cm._nextUnitId = Math.max(1, Number(obj._nextUnitId) || 1);
    cm._nextAIDecisionDay = Math.max(1, Number(obj._nextAIDecisionDay) || 4);
    cm._lastPlayerInvasionDay = Number.isFinite(Number(obj._lastPlayerInvasionDay)) ? Number(obj._lastPlayerInvasionDay) : -999;
    cm._playerInvasionCooldownDays = Math.max(2, Math.min(12, Number(obj._playerInvasionCooldownDays) || 4));
    cm._pendingPlayerInvasions = Array.isArray(obj._pendingPlayerInvasions) ? obj._pendingPlayerInvasions : [];
    cm._nextPlayerInvasionId = Math.max(1, Number(obj._nextPlayerInvasionId) || 1);
    cm._nextCampaignId = Math.max(1, Number(obj._nextCampaignId) || 1);
    cm._warQteBuff = cm._normalizeWarBattlePayload(obj._warQteBuff);
    cm._activeCampaigns = Array.isArray(obj.activeCampaigns)
      ? obj.activeCampaigns.map((campaign) => ({
          ...campaign,
          qteBuff: cm._normalizeWarBattlePayload(campaign?.qteBuff),
        }))
      : [];
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
    // Restore v6 systems
    if (typeof DiplomacySystem !== 'undefined') {
      cm.diplomacy = DiplomacySystem.fromJSON(obj.diplomacy);
    }
    if (typeof EspionageSystem !== 'undefined') {
      cm.espionage = EspionageSystem.fromJSON(obj.espionage);
    }
    if (typeof CityAdvisors !== 'undefined') {
      cm.advisors = CityAdvisors.fromJSON(obj.advisors);
    }
    if (cm.myCity) {
      if (typeof CityPolicies !== 'undefined') CityPolicies.fromJSON(cm.myCity, obj.policies);
      if (typeof CitySpecialization !== 'undefined') CitySpecialization.fromJSON(cm.myCity, obj.specialization);
    }
    return cm;
  }
}

CityManagement.FOCUS_DEFS = {
  balanced: {
    key: 'balanced',
    label: 'Balanced Council',
    atlasFrame: 'Chart',
    emoji: '⚖️',
    desc: 'Steady growth with no sharp penalties. A safe default while you learn the city.',
    effects: { happiness: 1, taxIncome: 0.03 },
  },
  mercantile: {
    key: 'mercantile',
    label: 'Mercantile Push',
    atlasFrame: 'Cash',
    emoji: '💰',
    desc: 'Lean into trade lanes, customs, and market throughput.',
    effects: { routeIncome: 0.18, taxIncome: 0.06, happiness: -2 },
  },
  civic: {
    key: 'civic',
    label: 'Civic Renewal',
    atlasFrame: 'Friendly',
    emoji: '🏛️',
    desc: 'Spend on public order and morale to keep the city loyal and growing.',
    effects: { happiness: 8, popGrowth: 0.01, taxIncome: -0.04 },
  },
  industrial: {
    key: 'industrial',
    label: 'Industrial Drive',
    atlasFrame: 'Tools',
    emoji: '⚒️',
    desc: 'Push crews and workshops hard to build faster and craft more.',
    effects: { buildSpeed: 0.35, productionChance: 0.12, taxIncome: 0.04, happiness: -4 },
  },
  martial: {
    key: 'martial',
    label: 'Martial Posture',
    atlasFrame: 'Shield',
    emoji: '🛡️',
    desc: 'Prepare for raids and war with a stronger watch and cheaper troops.',
    effects: { defense: 0.24, unitCap: 4, unitCostDiscount: 0.12, happiness: -3, routeIncome: -0.08 },
  },
};

CityManagement.OPERATION_DEFS = {
  harvest_drive: {
    key: 'harvest_drive',
    label: 'Harvest Drive',
    atlasFrame: 'Wheat',
    emoji: '🌾',
    durationDays: 3,
    cooldownDays: 5,
    desc: 'Hire field crews, gather stores, and restock your granaries before shortages bite.',
  },
  founders_festival: {
    key: 'founders_festival',
    label: 'Founders Festival',
    atlasFrame: 'Festival',
    emoji: '🎉',
    durationDays: 4,
    cooldownDays: 6,
    desc: 'Stage a civic celebration to lift morale and attract new families to the city.',
  },
  builders_guild: {
    key: 'builders_guild',
    label: 'Builders Guild',
    atlasFrame: 'Tools',
    emoji: '🏗️',
    durationDays: 4,
    cooldownDays: 6,
    desc: 'Contract master builders to speed projects and organize workshops.',
  },
  caravan_surge: {
    key: 'caravan_surge',
    label: 'Caravan Surge',
    atlasFrame: 'trader',
    emoji: '🐪',
    durationDays: 3,
    cooldownDays: 6,
    desc: 'Flood your routes with convoy contracts and aggressive merchant traffic.',
  },
  militia_drill: {
    key: 'militia_drill',
    label: 'Militia Drill',
    atlasFrame: 'Shield',
    emoji: '🪖',
    durationDays: 3,
    cooldownDays: 6,
    desc: 'Run a citywide readiness drill to harden defenses and tighten the watch.',
  },
};

CityManagement.DIRECTIVE_DEFS = {
  stock_granaries: {
    key: 'stock_granaries',
    label: 'Stock The Granaries',
    atlasFrame: 'Bread',
    emoji: '🍞',
    desc: 'Secure food stores before shortages trigger panic.',
    targetType: 'food_days',
    durationDays: 4,
    cooldownDays: 5,
    baseRewardGold: 110,
    baseRewardReputation: 1,
    recommendedOperationKey: 'harvest_drive',
  },
  calm_streets: {
    key: 'calm_streets',
    label: 'Calm The Streets',
    atlasFrame: 'Friendly',
    emoji: '🎭',
    desc: 'Raise morale before unrest starts costing population and gold.',
    targetType: 'happiness',
    durationDays: 5,
    cooldownDays: 5,
    baseRewardGold: 100,
    baseRewardReputation: 2,
    recommendedOperationKey: 'founders_festival',
  },
  open_market: {
    key: 'open_market',
    label: 'Open The Market',
    atlasFrame: 'trader',
    emoji: '🧭',
    desc: 'Get a route online so the city starts earning through trade again.',
    targetType: 'routes',
    durationDays: 5,
    cooldownDays: 5,
    baseRewardGold: 125,
    baseRewardReputation: 2,
    recommendedOperationKey: 'caravan_surge',
  },
  arm_the_watch: {
    key: 'arm_the_watch',
    label: 'Arm The Watch',
    atlasFrame: 'Shield',
    emoji: '🛡️',
    desc: 'Raise enough defenders to make the frontier think twice.',
    targetType: 'units',
    durationDays: 4,
    cooldownDays: 5,
    baseRewardGold: 120,
    baseRewardReputation: 2,
    recommendedOperationKey: 'militia_drill',
  },
  secure_convoys: {
    key: 'secure_convoys',
    label: 'Secure The Convoys',
    atlasFrame: 'sloop',
    emoji: '⛵',
    desc: 'Put visible escorts on the roads and sea lanes before privateers cut into the exchange.',
    targetType: 'units',
    durationDays: 5,
    cooldownDays: 6,
    baseRewardGold: 145,
    baseRewardReputation: 2,
    recommendedOperationKey: 'militia_drill',
  },
  showcase_contracts: {
    key: 'showcase_contracts',
    label: 'Broker Showcase Contracts',
    atlasFrame: 'Tools',
    emoji: '📦',
    desc: 'Find more buyers for your showcase so guild momentum turns into durable commercial ties.',
    targetType: 'routes',
    durationDays: 5,
    cooldownDays: 6,
    baseRewardGold: 150,
    baseRewardReputation: 2,
    recommendedOperationKey: 'caravan_surge',
  },
  guard_storehouses: {
    key: 'guard_storehouses',
    label: 'Guard The Storehouses',
    atlasFrame: 'Bread',
    emoji: '🔐',
    desc: 'Put reliable guards over the granaries before full storehouses become a target.',
    targetType: 'units',
    durationDays: 4,
    cooldownDays: 6,
    baseRewardGold: 130,
    baseRewardReputation: 1,
    recommendedOperationKey: 'militia_drill',
  },
};

CityManagement.DISTRICT_SYNERGY_DEFS = {
  portside_exchange: {
    key: 'portside_exchange',
    label: 'Portside Exchange',
    emoji: '⚓',
    atlasFrame: 'Cash',
    districtKeys: ['market', 'harbor'],
    desc: 'Market Quarter and Harbor District combine into a dockside trading engine that can trigger major exchange events.',
  },
  guild_showcase: {
    key: 'guild_showcase',
    label: 'Guild Showcase',
    emoji: '🛠️',
    atlasFrame: 'Tools',
    districtKeys: ['market', 'crafts'],
    desc: 'Crafts Ward and Market Quarter create commercial guild politics, demonstrations, and showcase opportunities.',
  },
  harvest_jubilee: {
    key: 'harvest_jubilee',
    label: 'Harvest Jubilee',
    emoji: '🌾',
    atlasFrame: 'Bread',
    districtKeys: ['granary', 'civic'],
    desc: 'Granary Ward and Civic Square can turn full stores into public feasts or tense austerity decisions.',
  },
  citizen_watch: {
    key: 'citizen_watch',
    label: 'Citizen Watch',
    emoji: '🛡️',
    atlasFrame: 'Shield',
    districtKeys: ['garrison', 'civic'],
    desc: 'Garrison Ward and Civic Square shape whether the city raises a loyal watch or a resented levy.',
  },
};

CityManagement.DISTRICT_DEFS = {
  market: {
    key: 'market',
    label: 'Market Quarter',
    atlasFrame: 'Cash',
    emoji: '🛍️',
    desc: 'Shops, stalls, and customs offices that turn movement into revenue.',
    tiers: [
      { label: 'Bazaar Rows', cost: 380, time: 70, effects: { routeIncome: 0.10, taxIncome: 0.04 }, desc: '+10% route income · +4% tax income' },
      { label: 'Merchant Arcade', cost: 560, time: 88, effects: { routeIncome: 0.18, taxIncome: 0.07, happiness: 1 }, desc: '+18% route income · +7% tax income' },
      { label: 'Grand Exchange', cost: 820, time: 110, effects: { routeIncome: 0.28, taxIncome: 0.12, happiness: 2 }, desc: '+28% route income · +12% tax income' },
    ],
  },
  granary: {
    key: 'granary',
    label: 'Granary Ward',
    atlasFrame: 'Bread',
    emoji: '🌾',
    desc: 'Storage silos, bakeries, and rationing halls that keep the city fed.',
    tiers: [
      { label: 'Storehouses', cost: 340, time: 65, effects: { foodSaving: 0.12, happiness: 1 }, desc: '-12% food use · +1 happiness' },
      { label: 'Public Granary', cost: 520, time: 82, effects: { foodSaving: 0.22, happiness: 3, popGrowth: 0.004 }, desc: '-22% food use · +3 happiness' },
      { label: 'Bread District', cost: 780, time: 104, effects: { foodSaving: 0.32, happiness: 5, popGrowth: 0.008 }, desc: '-32% food use · +5 happiness' },
    ],
  },
  crafts: {
    key: 'crafts',
    label: 'Crafts Ward',
    atlasFrame: 'Tools',
    emoji: '⚒️',
    desc: 'Workshops and guildhalls that accelerate production and construction.',
    tiers: [
      { label: 'Workshop Lane', cost: 360, time: 68, effects: { buildSpeed: 0.16, productionChance: 0.06 }, desc: '+16% build speed · +6% production chance' },
      { label: 'Guildhall District', cost: 540, time: 86, effects: { buildSpeed: 0.30, productionChance: 0.10, productionDouble: 0.05 }, desc: '+30% build speed · +10% production chance' },
      { label: 'Industrial Terrace', cost: 810, time: 110, effects: { buildSpeed: 0.46, productionChance: 0.16, productionDouble: 0.12 }, desc: '+46% build speed · +16% production chance' },
    ],
  },
  garrison: {
    key: 'garrison',
    label: 'Garrison Ward',
    atlasFrame: 'Shield',
    emoji: '🛡️',
    desc: 'Barracks, armories, and drill grounds that harden the city.',
    tiers: [
      { label: 'Barracks Block', cost: 400, time: 72, effects: { defense: 0.12, unitCap: 1, unitCostDiscount: 0.06 }, desc: '+12% defense · +1 unit cap' },
      { label: 'Drill Square', cost: 610, time: 92, effects: { defense: 0.22, unitCap: 2, unitCostDiscount: 0.12 }, desc: '+22% defense · +2 unit cap' },
      { label: 'Citadel Ward', cost: 900, time: 118, effects: { defense: 0.35, unitCap: 4, unitCostDiscount: 0.20 }, desc: '+35% defense · +4 unit cap' },
    ],
  },
  civic: {
    key: 'civic',
    label: 'Civic Square',
    atlasFrame: 'Friendly',
    emoji: '🏛️',
    desc: 'Plazas, baths, and monuments that stabilize morale and population growth.',
    tiers: [
      { label: 'Public Plaza', cost: 330, time: 66, effects: { happiness: 4, popGrowth: 0.004 }, desc: '+4 happiness · +0.4% population growth' },
      { label: 'Forum Ring', cost: 500, time: 84, effects: { happiness: 8, popGrowth: 0.007, taxIncome: 0.02 }, desc: '+8 happiness · +2% tax income' },
      { label: 'Golden Forum', cost: 760, time: 104, effects: { happiness: 12, popGrowth: 0.010, taxIncome: 0.04 }, desc: '+12 happiness · +4% tax income' },
    ],
  },
  harbor: {
    key: 'harbor',
    label: 'Harbor District',
    atlasFrame: 'sloop',
    emoji: '⚓',
    coastalOnly: true,
    desc: 'Docks, cranes, and ship chandlers that turn a coast into a trading machine.',
    tiers: [
      { label: 'Dock Row', cost: 420, time: 72, effects: { routeIncome: 0.12, buildSpeed: 0.08 }, desc: '+12% route income · +8% build speed' },
      { label: 'Port Basin', cost: 620, time: 92, effects: { routeIncome: 0.22, taxIncome: 0.04, buildSpeed: 0.12 }, desc: '+22% route income · +4% tax income' },
      { label: 'Admiralty Quay', cost: 920, time: 118, effects: { routeIncome: 0.34, taxIncome: 0.08, buildSpeed: 0.18 }, desc: '+34% route income · +8% tax income' },
    ],
  },
};

CityManagement.computeDistrictEffects = function computeDistrictEffects(districts) {
  const src = (districts && typeof districts === 'object') ? districts : {};
  const out = {};
  for (const [key, def] of Object.entries(CityManagement.DISTRICT_DEFS || {})) {
    const tier = Math.max(0, Math.floor(Number(src[key]) || 0));
    if (tier <= 0) continue;
    const tierDef = def.tiers[Math.min(def.tiers.length, tier) - 1];
    if (!tierDef || !tierDef.effects) continue;
    for (const [effectKey, value] of Object.entries(tierDef.effects)) {
      out[effectKey] = (out[effectKey] || 0) + (Number(value) || 0);
    }
  }
  return out;
};

window.CityManagement = CityManagement;
