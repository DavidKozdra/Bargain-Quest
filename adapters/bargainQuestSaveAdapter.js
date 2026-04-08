(function initBQSaveAdapter(root, factory) {
  const api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.BQAdapters = root.BQAdapters || {};
    root.BQAdapters.bargainQuest = root.BQAdapters.bargainQuest || {};
    root.BQAdapters.bargainQuest.save = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createBQSaveAdapter(root) {
  const SAVE_KEY = "bargainquest_save";
  const SHARE_PREFIX = "BQ_SAVE_V1:";
  const SAVE_VERSION = 6;
  const COMPAT_VERSIONS = new Set([3, 4, 5, 6]);

  function _buildApi() {
    const saveApiFactory = root?.KozEngine?.SaveLoad?.saveApi;
    const drivers = root?.KozEngine?.SaveLoad?.storageDrivers;
    if (!saveApiFactory?.SaveAPI || !drivers?.createLocalStorageDriver) return null;
    const driver = drivers.createLocalStorageDriver(localStorage);
    return new saveApiFactory.SaveAPI({
      driver,
      key: SAVE_KEY,
      sharePrefix: SHARE_PREFIX,
      serializer: JSON,
    });
  }

  function validateParsedSave(parsed) {
    const okVersion = parsed && COMPAT_VERSIONS.has(Number(parsed.version));
    if (!okVersion) return { ok: false, reason: "bad_version" };
    if (!parsed.player || !Array.isArray(parsed.cities)) return { ok: false, reason: "invalid_payload" };
    return { ok: true };
  }

  function normalizeCityManagement(raw) {
    const m = (raw && typeof raw === "object") ? raw : {};
    const districtTiers = (m.districts && typeof m.districts === "object")
      ? Object.fromEntries(
          Object.entries(m.districts)
            .map(([key, value]) => [key, Math.max(0, Math.floor(Number(value) || 0))])
            .filter(([, value]) => value > 0)
        )
      : {};
    const districtEffects = (m.districtEffects && typeof m.districtEffects === "object")
      ? Object.fromEntries(
          Object.entries(m.districtEffects)
            .map(([key, value]) => [key, Number(value)])
            .filter(([, value]) => Number.isFinite(value) && Math.abs(value) >= 0.0001)
        )
      : {};
    const units = Array.isArray(m.units)
      ? m.units.map((u) => ({
          id: Number.isFinite(Number(u?.id)) ? Number(u.id) : null,
          x: Math.floor(Number(u?.x) || 0),
          y: Math.floor(Number(u?.y) || 0),
          name: (typeof u?.name === "string" && u.name.trim()) ? u.name.trim() : `Unit #${Math.floor(Math.random() * 10000)}`,
          hp: Math.max(1, Math.floor(Number(u?.hp) || 10)),
          maxHp: Math.max(1, Math.floor(Number(u?.maxHp) || 10)),
          attack: Math.max(1, Math.floor(Number(u?.attack) || 2)),
          defense: Math.max(0, Math.floor(Number(u?.defense) || 1)),
          accuracy: Math.max(0.4, Math.min(0.95, Number.isFinite(Number(u?.accuracy)) ? Number(u.accuracy) : 0.72)),
          critChance: Math.max(0, Math.min(0.5, Number.isFinite(Number(u?.critChance)) ? Number(u.critChance) : 0.08)),
          state: (u?.state === "moving" || u?.state === "fighting") ? u.state : "idle",
          direction: (u?.direction === "left" || u?.direction === "right" || u?.direction === "up") ? u.direction : "down",
          classKey: (typeof u?.classKey === "string" && u.classKey.trim()) ? u.classKey : "militia",
          movementType: (u?.movementType === "naval") ? "naval" : "land",
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
      : [];
    return {
      budget: Math.max(0, Math.floor(Number(m.budget) || 0)),
      taxRate: Math.max(0, Math.min(0.5, Number.isFinite(Number(m.taxRate)) ? Number(m.taxRate) : 0.05)),
      buildingQueue: Array.isArray(m.buildingQueue) ? m.buildingQueue : [],
      upgradeLevels: (m.upgradeLevels && typeof m.upgradeLevels === "object") ? m.upgradeLevels : {},
      routes: Array.isArray(m.routes) ? m.routes : [],
      ownerPayoutDue: Math.max(0, Math.floor(Number(m.ownerPayoutDue) || 0)),
      ownerTaxShare: Math.max(0.10, Math.min(0.80, Number.isFinite(Number(m.ownerTaxShare)) ? Number(m.ownerTaxShare) : 0.35)),
      districts: districtTiers,
      districtEffects,
      focusKey: (typeof m.focusKey === "string" && m.focusKey.trim()) ? m.focusKey.trim() : "balanced",
      focusEffects: (m.focusEffects && typeof m.focusEffects === "object") ? { ...m.focusEffects } : {},
      activeOperations: Array.isArray(m.activeOperations) ? m.activeOperations.map((op) => ({
        key: (typeof op?.key === "string" && op.key.trim()) ? op.key.trim() : "unknown",
        label: (typeof op?.label === "string" && op.label.trim()) ? op.label.trim() : "Operation",
        startedDay: Math.max(0, Math.floor(Number(op?.startedDay) || 0)),
        completeDay: Math.max(0, Math.floor(Number(op?.completeDay) || 0)),
        durationDays: Math.max(1, Math.floor(Number(op?.durationDays) || 1)),
        summary: (typeof op?.summary === "string") ? op.summary : "",
        costs: {
          gold: Math.max(0, Math.floor(Number(op?.costs?.gold) || 0)),
          items: (op?.costs?.items && typeof op.costs.items === "object") ? { ...op.costs.items } : {},
        },
      })) : [],
      operationBuffs: Array.isArray(m.operationBuffs) ? m.operationBuffs.map((buff) => ({
        key: (typeof buff?.key === "string" && buff.key.trim()) ? buff.key.trim() : "city_buff",
        label: (typeof buff?.label === "string" && buff.label.trim()) ? buff.label.trim() : "City Bonus",
        sourceOperation: (typeof buff?.sourceOperation === "string" && buff.sourceOperation.trim()) ? buff.sourceOperation.trim() : null,
        grantedDay: Math.max(0, Math.floor(Number(buff?.grantedDay) || 0)),
        expiresDay: Math.max(0, Math.floor(Number(buff?.expiresDay) || 0)),
        effects: (buff?.effects && typeof buff.effects === "object") ? { ...buff.effects } : {},
        summary: (typeof buff?.summary === "string") ? buff.summary : "",
      })) : [],
      operationHistory: Array.isArray(m.operationHistory) ? m.operationHistory.map((entry) => ({
        key: (typeof entry?.key === "string" && entry.key.trim()) ? entry.key.trim() : "unknown",
        label: (typeof entry?.label === "string" && entry.label.trim()) ? entry.label.trim() : "Operation",
        completedDay: Math.max(0, Math.floor(Number(entry?.completedDay) || 0)),
        summary: (typeof entry?.summary === "string") ? entry.summary : "",
      })) : [],
      operationCooldowns: (m.operationCooldowns && typeof m.operationCooldowns === "object") ? { ...m.operationCooldowns } : {},
      directives: Array.isArray(m.directives) ? m.directives.map((entry) => ({
        key: (typeof entry?.key === "string" && entry.key.trim()) ? entry.key.trim() : "unknown",
        label: (typeof entry?.label === "string" && entry.label.trim()) ? entry.label.trim() : "Directive",
        detail: (typeof entry?.detail === "string") ? entry.detail : "",
        createdDay: Math.max(0, Math.floor(Number(entry?.createdDay) || 0)),
        deadlineDay: Math.max(0, Math.floor(Number(entry?.deadlineDay) || 0)),
        status: entry?.status === "completed" || entry?.status === "failed" ? entry.status : "active",
        reward: {
          gold: Math.max(0, Math.floor(Number(entry?.reward?.gold) || 0)),
          reputation: Math.max(0, Math.floor(Number(entry?.reward?.reputation) || 0)),
        },
        target: {
          type: (typeof entry?.target?.type === "string" && entry.target.type.trim()) ? entry.target.type.trim() : "value",
          value: Number.isFinite(Number(entry?.target?.value)) ? Number(entry.target.value) : 0,
        },
        recommendedOperationKey: (typeof entry?.recommendedOperationKey === "string" && entry.recommendedOperationKey.trim())
          ? entry.recommendedOperationKey.trim()
          : null,
        summary: (typeof entry?.summary === "string") ? entry.summary : "",
      })) : [],
      directiveHistory: Array.isArray(m.directiveHistory) ? m.directiveHistory.map((entry) => ({
        key: (typeof entry?.key === "string" && entry.key.trim()) ? entry.key.trim() : "unknown",
        label: (typeof entry?.label === "string" && entry.label.trim()) ? entry.label.trim() : "Directive",
        detail: (typeof entry?.detail === "string") ? entry.detail : "",
        createdDay: Math.max(0, Math.floor(Number(entry?.createdDay) || 0)),
        deadlineDay: Math.max(0, Math.floor(Number(entry?.deadlineDay) || 0)),
        status: entry?.status === "failed" ? "failed" : "completed",
        reward: {
          gold: Math.max(0, Math.floor(Number(entry?.reward?.gold) || 0)),
          reputation: Math.max(0, Math.floor(Number(entry?.reward?.reputation) || 0)),
        },
        target: {
          type: (typeof entry?.target?.type === "string" && entry.target.type.trim()) ? entry.target.type.trim() : "value",
          value: Number.isFinite(Number(entry?.target?.value)) ? Number(entry.target.value) : 0,
        },
        recommendedOperationKey: (typeof entry?.recommendedOperationKey === "string" && entry.recommendedOperationKey.trim())
          ? entry.recommendedOperationKey.trim()
          : null,
        summary: (typeof entry?.summary === "string") ? entry.summary : "",
      })) : [],
      directiveCooldowns: (m.directiveCooldowns && typeof m.directiveCooldowns === "object") ? { ...m.directiveCooldowns } : {},
      activityFeed: Array.isArray(m.activityFeed) ? m.activityFeed.map((entry) => ({
        day: Math.max(0, Math.floor(Number(entry?.day) || 0)),
        ts: Math.max(0, Math.floor(Number(entry?.ts) || 0)),
        type: (typeof entry?.type === "string" && entry.type.trim()) ? entry.type.trim() : "info",
        category: (typeof entry?.category === "string" && entry.category.trim()) ? entry.category.trim() : "city",
        message: (typeof entry?.message === "string") ? entry.message : "",
      })).filter((entry) => entry.message).slice(0, 24) : [],
      dailySnapshot: (m.dailySnapshot && typeof m.dailySnapshot === "object") ? {
        day: Math.max(0, Math.floor(Number(m.dailySnapshot?.day) || 0)),
        budget: Math.max(0, Math.floor(Number(m.dailySnapshot?.budget) || 0)),
        payoutDue: Math.max(0, Math.floor(Number(m.dailySnapshot?.payoutDue) || 0)),
        population: Math.max(0, Math.floor(Number(m.dailySnapshot?.population) || 0)),
        reputation: Number.isFinite(Number(m.dailySnapshot?.reputation)) ? Number(m.dailySnapshot.reputation) : 0,
        foodDays: Math.max(0, Math.floor(Number(m.dailySnapshot?.foodDays) || 0)),
        happiness: Number.isFinite(Number(m.dailySnapshot?.happiness)) ? Number(m.dailySnapshot.happiness) : 0,
        routeCompleted: Math.max(0, Math.floor(Number(m.dailySnapshot?.routeCompleted) || 0)),
        routeLost: Math.max(0, Math.floor(Number(m.dailySnapshot?.routeLost) || 0)),
        queueCount: Math.max(0, Math.floor(Number(m.dailySnapshot?.queueCount) || 0)),
        developmentScore: Math.max(0, Math.floor(Number(m.dailySnapshot?.developmentScore) || 0)),
        unitCount: Math.max(0, Math.floor(Number(m.dailySnapshot?.unitCount) || 0)),
        unitHpTotal: Math.max(0, Math.floor(Number(m.dailySnapshot?.unitHpTotal) || 0)),
        directiveCount: Math.max(0, Math.floor(Number(m.dailySnapshot?.directiveCount) || 0)),
      } : null,
      dailyBrief: (m.dailyBrief && typeof m.dailyBrief === "object") ? {
        day: Math.max(0, Math.floor(Number(m.dailyBrief?.day) || 0)),
        headline: (typeof m.dailyBrief?.headline === "string") ? m.dailyBrief.headline : "",
        tone: (typeof m.dailyBrief?.tone === "string" && m.dailyBrief.tone.trim()) ? m.dailyBrief.tone.trim() : "neutral",
        budgetDelta: Math.floor(Number(m.dailyBrief?.budgetDelta) || 0),
        payoutDelta: Math.floor(Number(m.dailyBrief?.payoutDelta) || 0),
        populationDelta: Math.floor(Number(m.dailyBrief?.populationDelta) || 0),
        reputationDelta: Number.isFinite(Number(m.dailyBrief?.reputationDelta)) ? Number(m.dailyBrief.reputationDelta) : 0,
        foodDays: Math.max(0, Math.floor(Number(m.dailyBrief?.foodDays) || 0)),
        foodDelta: Math.floor(Number(m.dailyBrief?.foodDelta) || 0),
        routeCompletedDelta: Math.max(0, Math.floor(Number(m.dailyBrief?.routeCompletedDelta) || 0)),
        routeLostDelta: Math.max(0, Math.floor(Number(m.dailyBrief?.routeLostDelta) || 0)),
        developmentDelta: Math.max(0, Math.floor(Number(m.dailyBrief?.developmentDelta) || 0)),
        unitHpDelta: Math.floor(Number(m.dailyBrief?.unitHpDelta) || 0),
        alerts: Array.isArray(m.dailyBrief?.alerts) ? m.dailyBrief.alerts.map((alert) => ({
          label: (typeof alert?.label === "string") ? alert.label : "",
          detail: (typeof alert?.detail === "string") ? alert.detail : "",
          tone: (typeof alert?.tone === "string" && alert.tone.trim()) ? alert.tone.trim() : "#d7e3f2",
          tabKey: (typeof alert?.tabKey === "string" && alert.tabKey.trim()) ? alert.tabKey.trim() : null,
        })).filter((alert) => alert.label).slice(0, 4) : [],
      } : null,
      units,
    };
  }

  function normalizeCityProgression(raw) {
    const p = (raw && typeof raw === "object") ? raw : {};

    // ── Normalize tech tree branches ──
    const BRANCHES = ['commerce', 'infrastructure', 'science', 'naval', 'defense', 'covert', 'orbital'];
    const rawTree = (p.techTree && typeof p.techTree === "object") ? p.techTree : {};
    const techTree = {};
    for (const branch of BRANCHES) {
      const b = (rawTree[branch] && typeof rawTree[branch] === "object") ? rawTree[branch] : {};
      techTree[branch] = {
        researched: Array.isArray(b.researched) ? b.researched.filter(k => typeof k === "string" && k.trim()) : [],
        queued: (typeof b.queued === "string" && b.queued.trim()) ? b.queued.trim() : null,
      };
    }

    // ── Normalize treasury upgrades ──
    const rawUpgrades = (p.treasuryUpgrades && typeof p.treasuryUpgrades === "object") ? p.treasuryUpgrades : {};
    const treasuryUpgrades = {};
    for (const [key, val] of Object.entries(rawUpgrades)) {
      if (typeof key === "string" && key.trim()) {
        treasuryUpgrades[key.trim()] = Math.max(0, Math.floor(Number(val) || 0));
      }
    }

    // ── Normalize space access ──
    const rawAccess = (p.spaceAccess && typeof p.spaceAccess === "object") ? p.spaceAccess : {};
    const spaceAccess = {
      launchReady: !!rawAccess.launchReady,
      dockingRights: !!rawAccess.dockingRights,
      landingRights: !!rawAccess.landingRights,
      orbitClearance: !!rawAccess.orbitClearance,
    };

    // ── Normalize faction standing ──
    const rawFactions = (p.factionStanding && typeof p.factionStanding === "object") ? p.factionStanding : {};
    const factionStanding = {};
    for (const [key, val] of Object.entries(rawFactions)) {
      if (typeof key === "string" && key.trim()) {
        factionStanding[key.trim()] = Math.max(-100, Math.min(100, Math.floor(Number(val) || 0)));
      }
    }

    return {
      researchPoints: Math.max(0, Math.floor(Number(p.researchPoints) || 0)),
      completedProjects: Array.isArray(p.completedProjects) ? p.completedProjects.filter((entry) => typeof entry === "string" && entry.trim()) : [],
      unlockedProjects: Array.isArray(p.unlockedProjects) ? p.unlockedProjects.filter((entry) => typeof entry === "string" && entry.trim()) : [],
      activeProject: (typeof p.activeProject === "string" && p.activeProject.trim()) ? p.activeProject.trim() : null,
      spaceProgram: !!p.spaceProgram,
      spaceportBuilt: !!p.spaceportBuilt,
      alienContact: !!p.alienContact,
      planetVisits: Array.isArray(p.planetVisits) ? p.planetVisits.filter((entry) => typeof entry === "string" && entry.trim()) : [],
      researchFocus: (typeof p.researchFocus === "string" && p.researchFocus.trim()) ? p.researchFocus.trim() : "trade",
      lastResearchTickDay: Number.isFinite(Number(p.lastResearchTickDay)) ? Math.floor(Number(p.lastResearchTickDay)) : -1,
      lastSpaceStockDay: Number.isFinite(Number(p.lastSpaceStockDay)) ? Math.floor(Number(p.lastSpaceStockDay)) : -1,
      techTree,
      treasuryUpgrades,
      spaceAccess,
      factionStanding,
    };
  }

  function normalizeCityOwnership(raw, cityName = "City") {
    const fallbackOwner = `${cityName} Council`;
    const o = (raw && typeof raw === "object") ? raw : {};
    const purchased = (o.purchased && typeof o.purchased === "object") ? o.purchased : {};
    return {
      ownerName: (typeof o.ownerName === "string" && o.ownerName.trim()) ? o.ownerName.trim() : fallbackOwner,
      offerAccepted: !!o.offerAccepted,
      purchased: {
        bank: !!purchased.bank,
        buildings: !!purchased.buildings,
        shop: !!purchased.shop,
      },
    };
  }

  function serializeRuntimeSnapshot(ctx) {
    const c = ctx || {};
    const player = c.player;
    const cities = c.cities || [];
    const dayNight = c.dayNight;
    const data = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      mapSeed: c.mapSeed || 0,
      rngState: (c.seededRng && typeof c.seededRng.getState === "function") ? c.seededRng.getState() : null,
      cols: c.cols,
      rows: c.rows,
      isCustomMap: !!c.isCustomMap,
      landmass: typeof c.landmass === "number" ? c.landmass : 1,
      worldGenConfig: (c.worldGenConfig && typeof c.worldGenConfig === "object")
        ? {
            warp: Number(c.worldGenConfig.warp),
            ruggedness: Number(c.worldGenConfig.ruggedness),
            temperatureVariance: Number(c.worldGenConfig.temperatureVariance),
            moistureVariance: Number(c.worldGenConfig.moistureVariance),
            coastalDropoff: Number(c.worldGenConfig.coastalDropoff),
          }
        : null,
      difficulty: c.difficulty || "normal",
      gameSpeed: typeof c.gameSpeedIndex !== "undefined" ? c.gameSpeedIndex : 2,
      goldTarget: typeof c.goldTarget === "number" ? c.goldTarget : 5000,
      dayLimit: typeof c.dayLimit === "number" ? c.dayLimit : 0,
      coastalVersion: 1,
      portCityLocations: Array.isArray(c.portCityLocations) ? c.portCityLocations : [],
      player: {
        x: player.x,
        y: player.y,
        gold: player.gold,
        name: player.name || "Captain",
        inventory: [...player.inventory].map(([k, v]) => [k, v.quantity]),
        party: player.party,
        direction: player.direction || "down",
        hasWon: player.hasWon,
        continuedAfterWin: !!player.continuedAfterWin,
        cargoCapacity: player.cargoCapacity || 50,
        combatStrength: player.combatStrength || 3,
        equippedWeapon: player.equippedWeapon || null,
        equippedBag: player.equippedBag || null,
        fleet: player.fleet.map((b) => b.toJSON()),
        activeBoatIndex: player.activeBoat ? player.fleet.indexOf(player.activeBoat) : -1,
        modifiers: player.modifiers || {},
        spaceTravel: {
          currentCity: player.spaceTravel?.currentCity || null,
          currentPlanet: player.spaceTravel?.currentPlanet || null,
          visitedPlanets: Array.isArray(player.spaceTravel?.visitedPlanets) ? player.spaceTravel.visitedPlanets.slice() : [],
          lastLaunchCity: player.spaceTravel?.lastLaunchCity || null,
          inOrbit: !!player.spaceTravel?.inOrbit,
          spaceFleet: (Array.isArray(player.spaceTravel?.spaceFleet)
            ? player.spaceTravel.spaceFleet.map(s => (typeof s.toJSON === 'function' ? s.toJSON() : s))
            : []),
          activeShipIndex: typeof player.spaceTravel?.activeShipIndex === 'number' ? player.spaceTravel.activeShipIndex : -1,
          travelSystemState: (player._spaceTravelSystem && typeof player._spaceTravelSystem.toJSON === 'function')
            ? player._spaceTravelSystem.toJSON()
            : (player.spaceTravel?.travelSystemState || null),
        },
        level: player.level || 1,
        xp: player.xp || 0,
        statPoints: player.statPoints || 0,
        bonusMaxHP: player.bonusMaxHP || 0,
        bonusAttack: player.bonusAttack || 0,
        bonusDefense: player.bonusDefense || 0,
        bonusMagic: player.bonusMagic || 0,
        bonusCharm: player.bonusCharm || 0,
        bonusSpeed: player.bonusSpeed || 0,
        currentHP: player.currentHP != null ? player.currentHP : (10 + (player.bonusMaxHP || 0)),
        _lastRegenHour: player._lastRegenHour || 0,
        weeklyIncome: player.weeklyIncome || 0,
        weeklySpending: player.weeklySpending || 0,
        _startingGold: player._startingGold || 100,
        _pendingInvestment: player._pendingInvestment || null,
        ownedCities: player.ownedCities || [],
        ownedCityRefs: (player.ownedCities || [])
          .map((idx) => {
            const cRef = cities[idx];
            if (!cRef || !cRef.location) return null;
            return {
              index: idx,
              name: cRef.name || null,
              location: {
                x: Number(cRef.location.x),
                y: Number(cRef.location.y),
              },
            };
          })
          .filter(Boolean),
        isKing: !!player.isKing,
      },
      dayNight: {
        timeOfDay: dayNight.timeOfDay,
        daysElapsed: dayNight.daysElapsed,
      },
      cities: cities.map((city) => ({
        name: city.name,
        location: city.location,
        population: city.population,
        isCoastal: !!city.isCoastal,
        inventory: [...city.inventory].map(([k, v]) => [k, v.quantity]),
        holidays: city.holidays,
        bookHolidays: city.bookHolidays || [],
        stockedBooks: city.stockedBooks || [],
        priceHistory: city.priceHistory || {},
        buildingVariant: city.buildingVariant || 0,
        reputation: typeof city.reputation === "number" ? city.reputation : 50,
        hasGamblingDen: city.hasGamblingDen || false,
        hasBank: city.hasBank || false,
        hasBlackMarket: city.hasBlackMarket || false,
        hasBountyBoard: city.hasBountyBoard || false,
        hasWeaponShop: city.hasWeaponShop || false,
        hasWinery: city.hasWinery || false,
        hasSchool: city.hasSchool || false,
        hasResearchLab: city.hasResearchLab || false,
        hasSpaceport: city.hasSpaceport || false,
        hasAlienExchange: city.hasAlienExchange || false,
        stockedWeapons: city.stockedWeapons || [],
        progression: normalizeCityProgression(city.progression || null),
        management: normalizeCityManagement(
          (city.management && typeof city.management.toJSON === "function") ? city.management.toJSON() : (city.management || null)
        ),
        ownership: normalizeCityOwnership(city.ownership, city.name),
      })),
      traders: c.traderManager ? c.traderManager.toJSON() : [],
      raiders: c.raiderManager ? c.raiderManager.toJSON() : [],
      events: c.eventSystem ? c.eventSystem.toJSON() : {},
      contractSystem: c.contractSystem && typeof c.contractSystem.toJSON === "function" ? c.contractSystem.toJSON() : null,
      treasureSystem: c.treasureSystem && typeof c.treasureSystem.toJSON === "function" ? c.treasureSystem.toJSON() : null,
      bankingSystem: c.bankingSystem && typeof c.bankingSystem.toJSON === "function" ? c.bankingSystem.toJSON() : null,
      smugglingSystem: c.smugglingSystem && typeof c.smugglingSystem.toJSON === "function" ? c.smugglingSystem.toJSON() : null,
      bountyBoard: c.bountyBoard && typeof c.bountyBoard.toJSON === "function" ? c.bountyBoard.toJSON() : null,
      gamblingSystem: c.gamblingSystem && typeof c.gamblingSystem.toJSON === "function" ? c.gamblingSystem.toJSON() : null,
      isCityManageMode: !!c.isCityManageMode,
      adventureCityManage: !!c.adventureCityManage,
      playerPreCityPos: c.playerPreCityPos || null,
      cityManagement: (c.cityManagement && typeof c.cityManagement.toJSON === "function") ? c.cityManagement.toJSON() : null,
    };

    if (data.isCustomMap && Array.isArray(c.grid) && c.grid.length > 0) {
      const biomeIndex = { Water: 0, Sand: 1, Grass: 2, Forest: 3, Snow: 4, Rock: 5 };
      const decorIndex = { bush: 1, tree: 2, rock: 3, pebbles: 4, snowdrift: 5, lily: 6, seaweed: 7 };
      const totalCells = data.rows * data.cols;
      const biomeArr = new Array(totalCells);
      const decorArr = new Array(totalCells);
      const elevArr = new Array(totalCells);
      const tempArr = new Array(totalCells);
      const diffArr = new Array(totalCells);
      for (let i = 0; i < data.rows; i++) {
        for (let j = 0; j < data.cols; j++) {
          const idx = i * data.cols + j;
          const cell = c.grid[i] && c.grid[i][j];
          const biome = cell && cell.options ? cell.options[0] : "Grass";
          biomeArr[idx] = biomeIndex[biome] !== undefined ? biomeIndex[biome] : 2;
          decorArr[idx] = cell && cell.decor && decorIndex[cell.decor] ? decorIndex[cell.decor] : 0;
          elevArr[idx] = c.elevationMap[i] ? +(c.elevationMap[i][j] || 0).toFixed(3) : 0;
          tempArr[idx] = c.temperatureMap[i] ? +(c.temperatureMap[i][j] || 0).toFixed(3) : 0;
          diffArr[idx] = c.difficultyMap[i] ? +(c.difficultyMap[i][j] || 0).toFixed(2) : 1;
        }
      }
      data.customTerrain = { biomes: biomeArr, decor: decorArr, elevation: elevArr, temperature: tempArr, difficulty: diffArr };
    }

    return data;
  }

  function has() {
    const api = _buildApi();
    if (!api) return localStorage.getItem(SAVE_KEY) !== null;
    return api.has();
  }

  function remove() {
    const api = _buildApi();
    if (!api) {
      localStorage.removeItem(SAVE_KEY);
      return;
    }
    api.delete();
  }

  function exportToken() {
    const api = _buildApi();
    const raw = api ? api.readRaw() : localStorage.getItem(SAVE_KEY);
    if (!raw) return { ok: false, reason: "no_save" };
    try {
      const token = api ? api.exportShareToken(raw) : `${SHARE_PREFIX}${btoa(unescape(encodeURIComponent(raw)))}`;
      return { ok: true, data: token };
    } catch (_e) {
      return { ok: false, reason: "export_failed" };
    }
  }

  function importToken(text) {
    try {
      const api = _buildApi();
      const input = String(text || "").trim();
      if (!input) return { ok: false, reason: "empty" };
      const raw = api ? api.importShareToken(input) : (() => {
        if (!input.startsWith(SHARE_PREFIX)) return input;
        const encoded = input.slice(SHARE_PREFIX.length).trim();
        return decodeURIComponent(escape(atob(encoded)));
      })();
      const parsed = JSON.parse(raw);
      const valid = validateParsedSave(parsed);
      if (!valid.ok) return valid;
      if (!api) localStorage.setItem(SAVE_KEY, raw);
      return { ok: true };
    } catch (_e) {
      return { ok: false, reason: "parse_error" };
    }
  }

  function readParsedSave() {
    const api = _buildApi();
    const raw = api ? (api.readRaw() || localStorage.getItem(SAVE_KEY)) : localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const valid = validateParsedSave(parsed);
    if (!valid.ok) return null;
    return parsed;
  }

  function _clampNumber(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function _restoreTerrain(data, terrain, deps) {
    const nextGrid = [];
    const nextElevationMap = [];
    const nextDifficultyMap = [];
    const nextTemperatureMap = [];

    if (data.isCustomMap && data.customTerrain) {
      const biomeNames = ["Water", "Sand", "Grass", "Forest", "Snow", "Rock"];
      const decorNames = [null, "bush", "tree", "rock", "pebbles", "snowdrift", "lily", "seaweed"];
      const customTerrain = data.customTerrain;

      for (let i = 0; i < terrain.rows; i++) {
        nextGrid[i] = new Array(terrain.cols);
        nextElevationMap[i] = new Array(terrain.cols);
        nextTemperatureMap[i] = new Array(terrain.cols);
        nextDifficultyMap[i] = new Array(terrain.cols);
        for (let j = 0; j < terrain.cols; j++) {
          const idx = i * terrain.cols + j;
          const biome = biomeNames[customTerrain.biomes[idx]] || "Grass";
          nextGrid[i][j] = { options: [biome], collapsed: true };
          const decor = decorNames[customTerrain.decor[idx]];
          if (decor) nextGrid[i][j].decor = decor;
          nextElevationMap[i][j] = customTerrain.elevation[idx] || 0;
          nextTemperatureMap[i][j] = customTerrain.temperature[idx] || 0;
          nextDifficultyMap[i][j] = customTerrain.difficulty[idx] || 1;
        }
      }
    }

    return {
      grid: nextGrid,
      elevationMap: nextElevationMap,
      difficultyMap: nextDifficultyMap,
      temperatureMap: nextTemperatureMap,
      generated: !(data.isCustomMap && data.customTerrain),
    };
  }

  function _restoreCities(data, deps) {
    const CityCtor = deps.City;
    const itemLibrary = deps.ItemLibrary || {};
    const restoredCities = [];
    const hasSavedCoastal = Array.isArray(data.cities)
      && data.cities.every((cityData) => Object.prototype.hasOwnProperty.call(cityData, "isCoastal"));

    for (const cityData of data.cities) {
      const city = new CityCtor({
        name: cityData.name,
        location: cityData.location,
        population: cityData.population,
      });
      if (hasSavedCoastal) city.isCoastal = !!cityData.isCoastal;
      if (cityData.hasGamblingDen !== undefined) city.hasGamblingDen = cityData.hasGamblingDen;
      if (cityData.hasBank !== undefined) city.hasBank = cityData.hasBank;
      if (cityData.hasBlackMarket !== undefined) city.hasBlackMarket = cityData.hasBlackMarket;
      if (cityData.hasBountyBoard !== undefined) city.hasBountyBoard = cityData.hasBountyBoard;
      if (cityData.hasWeaponShop !== undefined) city.hasWeaponShop = cityData.hasWeaponShop;
      if (cityData.hasWinery !== undefined) city.hasWinery = cityData.hasWinery;
      if (cityData.hasSchool !== undefined) city.hasSchool = cityData.hasSchool;
      if (cityData.hasResearchLab !== undefined) city.hasResearchLab = cityData.hasResearchLab;
      if (cityData.hasSpaceport !== undefined) city.hasSpaceport = cityData.hasSpaceport;
      if (cityData.hasAlienExchange !== undefined) city.hasAlienExchange = cityData.hasAlienExchange;
      city.stockedWeapons = Array.isArray(cityData.stockedWeapons) ? cityData.stockedWeapons : (city.stockedWeapons || []);
      city.progression = normalizeCityProgression(cityData.progression || city.progression || null);

      city.inventory.clear();
      if (Array.isArray(cityData.inventory)) {
        for (const [key, qty] of cityData.inventory) {
          if (itemLibrary[key]) {
            city.inventory.set(key, { item: itemLibrary[key], quantity: Math.max(0, Math.floor(Number(qty) || 0)) });
          }
        }
      } else if (cityData.inventory && typeof cityData.inventory === "object") {
        for (const [key, qty] of Object.entries(cityData.inventory)) {
          if (itemLibrary[key]) {
            city.inventory.set(key, { item: itemLibrary[key], quantity: Math.max(0, Math.floor(Number(qty) || 0)) });
          }
        }
      }

      city.holidays = cityData.holidays || [];
      city.bookHolidays = cityData.bookHolidays || [];
      city.stockedBooks = cityData.stockedBooks || [];
      city.priceHistory = cityData.priceHistory || {};
      city.buildingVariant = cityData.buildingVariant || 0;
      city.reputation = typeof cityData.reputation === "number" ? cityData.reputation : 50;
      city.ownership = normalizeCityOwnership(cityData.ownership, cityData.name || city.name);
      city.management = normalizeCityManagement(cityData.management || null);
      restoredCities.push(city);
    }

    return {
      cities: restoredCities,
      hasSavedCoastal,
    };
  }

  function _normalizeGridCoord(value, fallback = 0) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? n : fallback;
  }

  function _isInBounds(x, y, cols, rows) {
    return x >= 0 && x < cols && y >= 0 && y < rows;
  }

  function _isLandTile(grid, x, y, cols, rows) {
    if (!_isInBounds(x, y, cols, rows)) return false;
    return grid?.[y]?.[x]?.options?.[0] !== "Water";
  }

  function _hasNearbyWater(grid, x, y, cols, rows, radius = 2) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (!_isInBounds(nx, ny, cols, rows)) continue;
        if (grid?.[ny]?.[nx]?.options?.[0] === "Water") return true;
      }
    }
    return false;
  }

  function _findNearestCityTile(grid, startX, startY, cols, rows, occupied, preferCoastal = false) {
    if (!Array.isArray(grid) || rows <= 0 || cols <= 0) return null;

    const originX = Math.max(0, Math.min(cols - 1, _normalizeGridCoord(startX)));
    const originY = Math.max(0, Math.min(rows - 1, _normalizeGridCoord(startY)));
    const queue = [{ x: originX, y: originY }];
    const visited = new Set([`${originX},${originY}`]);
    let head = 0;
    let firstLandFallback = null;

    while (head < queue.length) {
      const current = queue[head++];
      const key = `${current.x},${current.y}`;

      if (!occupied.has(key) && _isLandTile(grid, current.x, current.y, cols, rows)) {
        if (!preferCoastal || _hasNearbyWater(grid, current.x, current.y, cols, rows)) {
          return current;
        }
        if (!firstLandFallback) firstLandFallback = current;
      }

      const nextSteps = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ];
      for (const next of nextSteps) {
        if (!_isInBounds(next.x, next.y, cols, rows)) continue;
        const nextKey = `${next.x},${next.y}`;
        if (visited.has(nextKey)) continue;
        visited.add(nextKey);
        queue.push(next);
      }
    }

    return firstLandFallback;
  }

  function _recomputeCoastalFlags(cityList, grid, cols, rows) {
    for (const city of cityList) {
      const x = _normalizeGridCoord(city?.location?.x);
      const y = _normalizeGridCoord(city?.location?.y);
      const coastal = _hasNearbyWater(grid, x, y, cols, rows);
      city.isCoastal = coastal;
      city.port = coastal;
    }
  }

  function _reconcileRestoredCities(cityList, grid, cols, rows, hasSavedCoastal) {
    if (!Array.isArray(cityList) || !Array.isArray(grid) || !grid.length) {
      return { cities: cityList, relocatedCount: 0, coastalRecomputed: false };
    }

    const occupied = new Set();
    let relocatedCount = 0;

    for (const city of cityList) {
      const targetX = _normalizeGridCoord(city?.location?.x);
      const targetY = _normalizeGridCoord(city?.location?.y);
      const targetKey = `${targetX},${targetY}`;
      const wantsCoastal = !!city?.isCoastal;
      let resolved = null;

      if (!occupied.has(targetKey) && _isLandTile(grid, targetX, targetY, cols, rows)) {
        resolved = { x: targetX, y: targetY };
      } else {
        resolved = _findNearestCityTile(grid, targetX, targetY, cols, rows, occupied, wantsCoastal)
          || _findNearestCityTile(grid, targetX, targetY, cols, rows, occupied, false);
      }

      if (!resolved) continue;

      if (resolved.x !== targetX || resolved.y !== targetY) {
        relocatedCount += 1;
      }

      city.location = { x: resolved.x, y: resolved.y };
      occupied.add(`${resolved.x},${resolved.y}`);
    }

    const coastalRecomputed = relocatedCount > 0 || !hasSavedCoastal;
    if (coastalRecomputed) _recomputeCoastalFlags(cityList, grid, cols, rows);

    return { cities: cityList, relocatedCount, coastalRecomputed };
  }

  function _restorePlayer(data, runtime, deps, restoredCities) {
    const player = runtime.player;
    const itemLibrary = deps.ItemLibrary || {};
    const BoatCtor = deps.Boat;
    const playerData = data.player || {};

    player.x = playerData.x;
    player.y = playerData.y;
    player.gold = playerData.gold;
    player.name = playerData.name || "Captain";
    player.inventory.clear();
    for (const [key, qty] of (playerData.inventory || [])) {
      if (itemLibrary[key]) {
        player.inventory.set(key, { item: itemLibrary[key], quantity: qty });
      }
    }
    player.party = playerData.party || [];
    player.direction = playerData.direction || "down";
    player.hasWon = !!playerData.hasWon;
    player.continuedAfterWin = !!playerData.continuedAfterWin;
    player.cargoCapacity = playerData.cargoCapacity || 50;
    player.combatStrength = playerData.combatStrength || 3;
    player.equippedWeapon = playerData.equippedWeapon || null;
    player.equippedBag = playerData.equippedBag || null;
    player.level = playerData.level || 1;
    player.xp = playerData.xp || 0;
    player.statPoints = playerData.statPoints || 0;
    player.bonusMaxHP = playerData.bonusMaxHP || 0;
    player.bonusAttack = playerData.bonusAttack || 0;
    player.bonusDefense = playerData.bonusDefense || 0;
    player.bonusMagic = playerData.bonusMagic || 0;
    player.bonusCharm = playerData.bonusCharm || 0;
    player.bonusSpeed = playerData.bonusSpeed || 0;
    player.speed = 2 + (playerData.bonusSpeed || 0);
    const maxHP = player.getMaxHP ? player.getMaxHP() : (10 + (player.bonusMaxHP || 0));
    player.currentHP = playerData.currentHP != null ? Math.min(playerData.currentHP, maxHP) : maxHP;
    player._lastRegenHour = playerData._lastRegenHour || 0;
    player.weeklyIncome = playerData.weeklyIncome || 0;
    player.weeklySpending = playerData.weeklySpending || 0;
    player._startingGold = playerData._startingGold || 100;
    player._pendingInvestment = playerData._pendingInvestment || null;
    player.isKing = !!playerData.isKing;
    player.spaceTravel = {
      currentCity: playerData.spaceTravel?.currentCity || null,
      currentPlanet: playerData.spaceTravel?.currentPlanet || null,
      visitedPlanets: Array.isArray(playerData.spaceTravel?.visitedPlanets) ? playerData.spaceTravel.visitedPlanets.slice() : [],
      lastLaunchCity: playerData.spaceTravel?.lastLaunchCity || null,
      inOrbit: !!playerData.spaceTravel?.inOrbit,
      spaceFleet: [],
      activeShipIndex: -1,
    };
    // Restore space fleet (array of serialised SpaceShip objects)
    const rawFleet = playerData.spaceTravel?.spaceFleet;
    if (Array.isArray(rawFleet)) {
      for (const shipData of rawFleet) {
        if (shipData && typeof shipData === 'object') {
          if (typeof SpaceShip !== 'undefined' && typeof SpaceShip.fromJSON === 'function') {
            player.spaceTravel.spaceFleet.push(SpaceShip.fromJSON(shipData));
          } else {
            player.spaceTravel.spaceFleet.push(shipData);
          }
        }
      }
    }
    const rawIdx = Number(playerData.spaceTravel?.activeShipIndex);
    if (Number.isFinite(rawIdx) && rawIdx >= 0 && rawIdx < player.spaceTravel.spaceFleet.length) {
      player.spaceTravel.activeShipIndex = rawIdx;
    }
    // Restore SpaceTravelSystem state onto player for later hydration
    if (playerData.spaceTravel?.travelSystemState && typeof playerData.spaceTravel.travelSystemState === 'object') {
      player.spaceTravel.travelSystemState = playerData.spaceTravel.travelSystemState;
    }
    const rawOwned = Array.isArray(playerData.ownedCities) ? playerData.ownedCities : [];
    const refs = Array.isArray(playerData.ownedCityRefs) ? playerData.ownedCityRefs : [];
    const resolvedOwned = [];
    const seenOwned = new Set();
    const pushOwned = (idx) => {
      const n = Math.floor(Number(idx));
      if (!Number.isFinite(n) || n < 0 || n >= restoredCities.length) return;
      if (seenOwned.has(n)) return;
      seenOwned.add(n);
      resolvedOwned.push(n);
    };
    if (refs.length > 0) {
      for (const ref of refs) {
        const lx = Number(ref?.location?.x);
        const ly = Number(ref?.location?.y);
        const refName = (typeof ref?.name === "string") ? ref.name : null;
        let idx = -1;
        if (Number.isFinite(lx) && Number.isFinite(ly)) {
          idx = restoredCities.findIndex((c) => c?.location?.x === lx && c?.location?.y === ly);
        }
        if (idx < 0 && refName) {
          idx = restoredCities.findIndex((c) => c?.name === refName);
        }
        if (idx < 0 && Number.isFinite(Number(ref?.index))) {
          idx = Number(ref.index);
        }
        pushOwned(idx);
      }
    }
    if (resolvedOwned.length === 0) {
      for (const idx of rawOwned) pushOwned(idx);
    }
    player.ownedCities = resolvedOwned;

    for (const idx of player.ownedCities) {
      if (restoredCities[idx]) {
        restoredCities[idx]._isManagedCity = true;
        restoredCities[idx].ownership = normalizeCityOwnership(restoredCities[idx].ownership, restoredCities[idx].name);
        restoredCities[idx].ownership.offerAccepted = true;
        restoredCities[idx].ownership.purchased = { bank: true, buildings: true, shop: true };
      }
    }

    player.modifiers = Object.assign({
      negotiationDiscount: 0,
      bribeCostReduction: 0,
      bribeCooldownBonus: 0,
      treasureValueBonus: 0,
      seaLegs: false,
    }, playerData.modifiers || {});
    if (typeof player.recalcModifiers === "function") player.recalcModifiers();

    player.fleet = (playerData.fleet || []).map((boatData) => BoatCtor.fromJSON(boatData));
    const activeBoatIndex = playerData.activeBoatIndex;
    player.activeBoat = (activeBoatIndex >= 0 && activeBoatIndex < player.fleet.length) ? player.fleet[activeBoatIndex] : null;
    player.isSailing = false;

    return player;
  }

  function _restoreSystems(data, runtime, deps) {
    const systems = {};
    systems.traderManager = (data.traders && data.traders.length > 0)
      ? deps.TraderManager.fromJSON(data.traders)
      : runtime.systems.traderManager;

    if (data.raiders) {
      const hasRaiders =
        Array.isArray(data.raiders) ? data.raiders.length > 0
        : Array.isArray(data.raiders.raiders) ? data.raiders.raiders.length > 0
        : false;
      systems.raiderManager = hasRaiders ? deps.RaiderManager.fromJSON(data.raiders) : runtime.systems.raiderManager;
    } else {
      systems.raiderManager = runtime.systems.raiderManager;
    }

    systems.eventSystem = data.events ? deps.EventSystem.fromJSON(data.events) : runtime.systems.eventSystem;
    systems.contractSystem = data.contractSystem ? deps.ContractSystem.fromJSON(data.contractSystem) : new deps.ContractSystem();
    systems.treasureSystem = data.treasureSystem ? deps.TreasureSystem.fromJSON(data.treasureSystem) : new deps.TreasureSystem();
    systems.bankingSystem = data.bankingSystem ? deps.BankingSystem.fromJSON(data.bankingSystem) : new deps.BankingSystem();
    systems.smugglingSystem = data.smugglingSystem ? deps.SmugglingSystem.fromJSON(data.smugglingSystem) : new deps.SmugglingSystem();
    systems.bountyBoard = data.bountyBoard ? deps.BountyBoard.fromJSON(data.bountyBoard) : new deps.BountyBoard();
    systems.gamblingSystem = data.gamblingSystem ? deps.GamblingSystem.fromJSON(data.gamblingSystem) : new deps.GamblingSystem();
    systems.minigameManager = runtime.systems.minigameManager || deps.createMinigameManager();

    return systems;
  }

  async function applyRuntimeSnapshot(ctx) {
    const payload = ctx || {};
    const data = payload.data || {};
    const runtime = payload.runtime || {};
    const deps = runtime.deps || {};
    const dimensions = {
      cols: data.cols || 100,
      rows: data.rows || 100,
    };

    const worldGenConfig = (data.worldGenConfig && typeof data.worldGenConfig === "object") ? data.worldGenConfig : {};
    const difficulty = data.difficulty || "normal";
    const difficultyConfig = (typeof deps.getDifficultyConfig === "function")
      ? deps.getDifficultyConfig(difficulty)
      : null;
    const gameSpeedIndex = (typeof data.gameSpeed === "number" && Array.isArray(deps.SPEED_STEPS))
      ? data.gameSpeed
      : null;

    const terrain = _restoreTerrain(data, dimensions, deps);
    if (terrain.generated) {
      if (typeof deps.noiseSeed === "function") deps.noiseSeed(data.mapSeed);
      await deps.initTerrainWorker();
      const currentTerrain = (typeof runtime.readTerrainState === "function") ? runtime.readTerrainState() : {};
      terrain.grid = currentTerrain.grid || [];
      terrain.elevationMap = currentTerrain.elevationMap || [];
      terrain.difficultyMap = currentTerrain.difficultyMap || [];
      terrain.temperatureMap = currentTerrain.temperatureMap || [];
    }

    const restoredCities = _restoreCities(data, deps);
    const reconciledCities = _reconcileRestoredCities(
      restoredCities.cities,
      terrain.grid,
      dimensions.cols,
      dimensions.rows,
      restoredCities.hasSavedCoastal
    );
    if (reconciledCities.relocatedCount > 0 && root?.console?.warn) {
      root.console.warn(`[save] Relocated ${reconciledCities.relocatedCount} restored city${reconciledCities.relocatedCount === 1 ? "" : "ies"} onto valid land tiles.`);
    }
    _restorePlayer(data, runtime, deps, restoredCities.cities);

    // Trader/Raider restore paths still read the live runtime city array during
    // construction, so publish restored cities before rehydrating those systems.
    if (Array.isArray(runtime.cities)) {
      runtime.cities.length = 0;
      restoredCities.cities.forEach((city) => runtime.cities.push(city));
    }

    runtime.dayNight.timeOfDay = data.dayNight.timeOfDay;
    runtime.dayNight.daysElapsed = data.dayNight.daysElapsed;

    const systems = _restoreSystems(data, runtime, deps);
    const portCityLocations = (restoredCities.hasSavedCoastal && !reconciledCities.coastalRecomputed)
      ? ((Array.isArray(data.portCityLocations) && data.portCityLocations.length > 0)
          ? data.portCityLocations.map((loc) => ({
              x: _normalizeGridCoord(loc?.x),
              y: _normalizeGridCoord(loc?.y),
            }))
          : restoredCities.cities.filter((city) => city.isCoastal).map((city) => ({
              x: _normalizeGridCoord(city?.location?.x),
              y: _normalizeGridCoord(city?.location?.y),
            })))
      : [];

    if (reconciledCities.coastalRecomputed) {
      for (const city of restoredCities.cities) {
        if (!city.isCoastal) continue;
        portCityLocations.push({
          x: _normalizeGridCoord(city?.location?.x),
          y: _normalizeGridCoord(city?.location?.y),
        });
      }
    }

    return {
      dimensions,
      config: {
        mapSeed: data.mapSeed,
        landmass: typeof data.landmass === "number" ? data.landmass : 1,
        worldGenConfig: {
          warp: _clampNumber(worldGenConfig.warp, 1.0, 0, 2),
          ruggedness: _clampNumber(worldGenConfig.ruggedness, 1.0, 0.5, 2),
          temperatureVariance: _clampNumber(worldGenConfig.temperatureVariance, 1.0, 0, 2),
          moistureVariance: _clampNumber(worldGenConfig.moistureVariance, 1.0, 0, 2),
          coastalDropoff: _clampNumber(worldGenConfig.coastalDropoff, 1.0, 0.4, 2.2),
        },
        difficulty,
        difficultyConfig,
        gameSpeedIndex,
        goldTarget: (typeof data.goldTarget === "number" && data.goldTarget > 0) ? data.goldTarget : 5000,
        dayLimit: (typeof data.dayLimit === "number" && data.dayLimit >= 0) ? data.dayLimit : 0,
        isCustomMap: !!data.isCustomMap,
      },
      terrain,
      cities: restoredCities.cities,
      dayNight: {
        timeOfDay: runtime.dayNight.timeOfDay,
        daysElapsed: runtime.dayNight.daysElapsed,
      },
      systems,
      flags: {
        portCityLocations,
        saveHasCoastalData: !!restoredCities.hasSavedCoastal && data.coastalVersion === 1,
        savedCityManagementData: data.cityManagement || null,
        savedIsCityManageMode: !!data.isCityManageMode,
        savedAdventureCityManage: !!data.adventureCityManage,
        savedPlayerPreCityPos: data.playerPreCityPos || null,
        savedRngState: data.rngState || null,
      },
    };
  }

  // Future migration surface:
  return {
    constants: { SAVE_KEY, SHARE_PREFIX, SAVE_VERSION },
    validateParsedSave,
    normalizeCityManagement,
    normalizeCityOwnership,
    normalizeCityProgression,
    serializeRuntimeSnapshot,
    readParsedSave,
    applyRuntimeSnapshot,
    has,
    remove,
    exportToken,
    importToken,
  };
});
