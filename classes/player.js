class Player {
  constructor(grid, startX = 0, startY = 0, partyLimit = 4) {
    this.grid = grid;
    this.x = startX;
    this.y = startY;
    this.partyLimit = partyLimit;

    // Core state
    this.inventory = new Map();
    this.gold = 100;
    this._startingGold = 100;
    this.name = 'Captain';
    this.party = [];
    this.path = [];
    this.direction = 'down';
    this.animFrame = 0;
    this.animTimer = 0;
    this.hasWon = false;
    this.continuedAfterWin = false;
    this.isKing = false;
    this.currentCity = null;

    // Economy
    this.taxRate = 0.05; // base — overridden by difficulty config
    this.foodPerMemberPerDay = 1;
    this.cargoCapacity = 50;
    this.combatStrength = 3;
    this.speed = 2; // Base combat speed (initiative rolls)

    // Leveling / stats
    this.level = 1;
    this.xp = 0;
    this.statPoints = 0;
    this.bonusMaxHP = 0;
    this.bonusAttack = 0;
    this.bonusDefense = 0;
    this.bonusMagic = 0;
    this.bonusCharm = 0;
    this.bonusSpeed = 0;
    this.currentHP = this.getMaxHP(); // persistent health

    // Equipped weapon (ItemLibrary key string, or null for Fists)
    this.equippedWeapon = null;
    // Equipped bag (ItemLibrary key string, or null for no bag)
    this.equippedBag = null;

    // Book-derived modifiers (recalculated when inventory changes)
    this.modifiers = {
      negotiationDiscount: 0,   // fraction off buy price / added to sell price
      bribeCostReduction: 0,    // fraction off bribe cost
      bribeCooldownBonus: 0,    // extra days of cooldown after bribe
      treasureValueBonus: 0,    // fraction bonus to treasure dig rewards
      seaLegs: false,             // bypass port-only docking restriction
      traderPiracy: false,      // can initiate trader-boat raid encounters
    };

    // Weekly income tracking (reset each week)
    this.weeklyIncome = 0;   // gold earned via trades this week
    this.weeklySpending = 0; // gold spent on purchases this week
    this._lastWeeklyCostDay = -1;

    // Boat fleet system
    this.fleet = [];         // Array of Boat instances
    this.activeBoat = null;  // Currently selected Boat (or null)
    this.isSailing = false;  // True when on water with a boat
    this.landSpeed = 100;    // Default land pathMoveInterval
    this._sailNotified = false;
    this.spaceTravel = {
      currentCity: null,
      currentPlanet: null,
      visitedPlanets: [],
      lastLaunchCity: null,
      inOrbit: false,
      // ── Space fleet and ship state ──
      spaceFleet: [],          // Array of SpaceShip serialized data
      activeShipIndex: -1,     // Index into spaceFleet (-1 = none)
    };

    // Space travel system instance (runtime, not serialized directly)
    this._spaceTravelSystem = null;

    // HP regen tracking (hour-based)
    this._lastRegenHour = 0;

    // Owned cities (adventure-mode empire building)
    // Array of city indices into window.cities[]
    this.ownedCities = [];

    // Listen for day changes to consume food & apply costs
    this._onDayChanged = () => this.onDayChanged();
    window.addEventListener('dayChanged', this._onDayChanged);

    // Give starting items
    this.addItem({ name: 'Fish', quantity: 5 });
    this.addItem({ name: 'Wheat', quantity: 3 });

    // Path following
    this.pathMoveTimer = 0;
    this.pathMoveInterval = 100;

    // Win/lose checks can be expensive with owned cities; throttle in update().
    this._nextEndCheckTime = 0;
    this._assetsCacheValue = null;
    this._assetsCacheUntil = 0;
    this._lastLowFoodWarnDay = -9999;
  }

  /** Remove event listeners to prevent leaks on new game */
  destroy() {
    if (this._onDayChanged) {
      window.removeEventListener("dayChanged", this._onDayChanged);
      this._onDayChanged = null;
    }
  }

  getCargoWeight() {
    let total = 0;
    for (const [key, entry] of this.inventory) {
      total += (entry.item?.weight || 1) * entry.quantity;
    }
    return total;
  }

  /** Maximum HP = base 10 + bonusMaxHP (from stat points: +3 each) */
  getMaxHP() {
    return 10 + (this.bonusMaxHP || 0);
  }

  /** Take damage, clamped to 0. Returns actual damage dealt. */
  takeDamage(amount) {
    const actual = Math.min(this.currentHP, Math.max(0, amount));
    this.currentHP -= actual;
    // Visual feedback: spawn small damage particles at player world position and trigger camera/HUD shake
    try {
      if (typeof particleSystem !== 'undefined' && particleSystem && typeof window !== 'undefined') {
        const px = this.x * (typeof tileSize !== 'undefined' ? tileSize : 32) + (typeof tileSize !== 'undefined' ? tileSize/2 : 16);
        const py = this.y * (typeof tileSize !== 'undefined' ? tileSize : 32) + (typeof tileSize !== 'undefined' ? tileSize/2 : 16);
        particleSystem.spawnBurst(px, py, { count: 18, color: '#ff5252', size: 4, speed: 90 });
      }
      if (typeof startCameraShake === 'function') startCameraShake(5, 220);
      const hud = document.getElementById('playerView');
      if (hud) {
        hud.classList.remove('hud-shake'); void hud.offsetWidth; hud.classList.add('hud-shake');
      }
    } catch (e) { /* ignore */ }
    return actual;
  }

  /** Heal HP, clamped to maxHP. Returns actual healing. */
  heal(amount) {
    if (amount <= 0) return 0;
    const max = this.getMaxHP();
    const actual = Math.min(amount, max - this.currentHP);
    this.currentHP = Math.min(max, this.currentHP + actual);
    return actual;
  }

  /** Passive HP regen: recover 1-2 HP per in-game hour. Cities heal 2, traveling heals 1. Scaled by difficulty. */
  regenHP(hours = 1) {
    const max = this.getMaxHP();
    if (this.currentHP >= max) return;
    const regenMul = window.DIFFICULTY_CONFIG?.hpRegenMultiplier || 1;
    const perHour = (this.currentCity ? 2 : 1) * regenMul;
    const regenAmount = Math.max(1, Math.round(perHour * hours));
    const healed = this.heal(regenAmount);
    if (healed > 0 && typeof notificationManager !== 'undefined') {
      if (this.currentHP < max) {
        notificationManager.log(`❤️ +${healed} HP (${this.currentHP}/${max})`, 'info');
      } else {
        notificationManager.log(`❤️ Fully healed! (${this.currentHP}/${max})`, 'success');
      }
    }
  }

  /** Effective cargo capacity including active boat bonus when sailing, equipped bag, and attack stat */
  getEffectiveCargoCapacity() {
    let cap = this.cargoCapacity;
    if (this.isSailing && this.activeBoat) {
      cap += this.activeBoat.getEffectiveCargo();
    }
    if (this.equippedBag && typeof BAGS !== 'undefined' && BAGS[this.equippedBag]) {
      cap += BAGS[this.equippedBag].cargoBonus;
    }
    cap += Math.floor((this.bonusAttack || 0) / 2);
    return cap;
  }

  onDayChanged() {
    // In City Management mode the city has its own food/budget system —
    // don't drain the dormant player entity's personal resources.
    if (window._isCityManageMode) return;
    this.consumeDailyFood();
    this.applyCursedItemDrain();
    const currentDay = Number(dayNight?.daysElapsed) || 0;
    if (currentDay > 0 && currentDay % 7 === 0 && this._lastWeeklyCostDay !== currentDay) {
      this._lastWeeklyCostDay = currentDay;
      this.applyWeeklyCosts();
    }
  }

  /** Cursed items drain gold each day */
  applyCursedItemDrain() {
    const cursedItems = [...this.inventory.keys()].filter(k => ItemLibrary[k]?.tags?.has('cursed'));
    if (cursedItems.length === 0) return;
    let totalDrain = 0;
    for (const key of cursedItems) {
      const entry = this.inventory.get(key);
      const qty = entry ? entry.quantity : 1;
      totalDrain += 5 * qty; // 5 gold per cursed item per day
    }
    const actualDrain = Math.min(totalDrain, this.gold);
    if (actualDrain > 0) {
      this.gold -= actualDrain;
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`🔮 Cursed items drain ${actualDrain} gold!`, 'warning');
      }
    }
  }

  consumeDailyFood() {
    const foodPriority = ['Bread', 'SaltedFish', 'Fish', 'Wheat'];
    // Crew demand includes captain + party + additional sailors required by active boat.
    const extraBoatCrew = (this.activeBoat && Number.isFinite(this.activeBoat.crewSize))
      ? Math.max(0, this.activeBoat.crewSize - 1)
      : 0;
    const crewCount = 1 + this.party.length + extraBoatCrew;
    const needed = Math.max(1, crewCount * this.foodPerMemberPerDay);

    const sources = [this.inventory];
    // Active boat hold should count as ship provisions.
    if (this.activeBoat && this.activeBoat.storage instanceof Map) {
      sources.push(this.activeBoat.storage);
    }

    let remaining = needed;

    for (const src of sources) {
      for (const foodName of foodPriority) {
        if (remaining <= 0) break;
        const entry = src.get(foodName);
        if (entry && entry.quantity > 0) {
          const consumed = Math.min(remaining, entry.quantity);
          entry.quantity -= consumed;
          if (entry.quantity <= 0) src.delete(foodName);
          remaining -= consumed;
        }
      }
      if (remaining <= 0) break;
    }

    let totalFood = 0;
    for (const src of sources) {
      for (const foodName of foodPriority) {
        const entry = src.get(foodName);
        if (entry) totalFood += entry.quantity;
      }
    }

    if (remaining > 0) {
      const starvMul = window.DIFFICULTY_CONFIG?.starvationPenaltyMult || 1;
      // Penalty scales with wealth so it always hurts — minimum 10g, then 5% of gold
      const basePenalty = Math.max(10, Math.floor(this.gold * 0.05));
      const penalty = Math.min(Math.ceil(basePenalty * starvMul), this.gold);
      this.gold -= penalty;
      this.takeDamage(1);
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Starvation! Missing ${remaining}/${needed} rations. Lost ${penalty} gold and 1 HP (${this.currentHP}/${this.getMaxHP()}).`, "warning");
      }

      // Check game over from starvation
      if ((this.getTotalAssets() <= 0 && this.inventory.size === 0) || this.currentHP <= 0) {
        if (typeof gameStateManager !== 'undefined') {
          if (typeof triggerGameLose === 'function') triggerGameLose();
          else gameStateManager.setState(GameStates.GAMELOSE);
        }
      }
    } else {
      // Low-food warning should trigger consistently as you approach shortages.
      const lowThreshold = Math.max(3, needed * 2);
      if (totalFood <= lowThreshold) {
        if (typeof tutorialSystem !== 'undefined' && tutorialSystem) {
          tutorialSystem.tryShow('lowFood');
        }
        if (typeof notificationManager !== 'undefined') {
          const day = (typeof dayNight !== 'undefined' && dayNight && typeof dayNight.getDaysElapsed === 'function')
            ? dayNight.getDaysElapsed()
            : 0;
          if (day > this._lastLowFoodWarnDay) {
            this._lastLowFoodWarnDay = day;
            const daysLeft = needed > 0 ? (totalFood / needed).toFixed(1) : '?';
            notificationManager.log(`Food running low: ${totalFood} rations left (~${daysLeft} days).`, 'warning');
          }
        }
      }
    }
  }

  /**
   * Calculate and apply all weekly costs, then show a summary popup.
   * Costs: taxes + port maintenance (fleet docking + storage upkeep).
   */
  applyWeeklyCosts() {
    const summary = {
      goldBefore: this.gold,
      income: this.weeklyIncome,
      stageIncome: 0,
      stageIncomeDetails: [],
      spending: this.weeklySpending,
      taxRatePercent: Math.round(((window.DIFFICULTY_CONFIG?.taxRate || this.taxRate) || 0) * 100),
      tax: 0,
      taxPaid: false,
      portMaintenance: 0,
      portPaid: false,
      captainPayroll: 0,
      boatDetails: [],
      storageCost: 0,
      totalCosts: 0,
      goldAfter: 0,
    };

    // --- Tax (scaled by difficulty) ---
    const effectiveTaxRate = window.DIFFICULTY_CONFIG?.taxRate || this.taxRate;
    summary.tax = Math.floor(this.gold * effectiveTaxRate) + 1;
    if (this.gold >= summary.tax) {
      this.gold -= summary.tax;
      summary.taxPaid = true;
    } else {
      // Partial tax: pay what we can
      summary.tax = this.gold;
      this.gold = 0;
      summary.taxPaid = summary.tax > 0;
    }

    // --- Port maintenance: per-boat docking fee ---
    let boatMaintenance = 0;
    const boatSummaryByBoat = new Map();
    for (const boat of this.fleet) {
      const template = typeof BoatLibrary !== 'undefined' ? BoatLibrary[boat.type] : null;
      const baseCost = template ? template.cost : 200;
      const fee = Math.max(1, Math.floor(baseCost * 0.02)); // 2% of boat value per week
      const captainSalary = boat.captain?.salary || 0;
      const boatSummary = {
        name: boat.name,
        type: boat.displayName || boat.type,
        fee,
        captain: boat.captain?.name || null,
        captainSalary,
        condition: boat.condition,
        conditionColor: boat.conditionColor ? boat.conditionColor() : '#888',
        conditionLabel: boat.conditionLabel ? boat.conditionLabel() : '',
        sunk: false,
      };
      summary.boatDetails.push(boatSummary);
      boatSummaryByBoat.set(boat, boatSummary);
      boatMaintenance += fee;
      summary.captainPayroll += captainSalary;
    }

    // --- Storage upkeep: scales with cargo capacity above base ---
    const baseCargo = 50;
    const extraCargo = Math.max(0, this.cargoCapacity - baseCargo);
    summary.storageCost = Math.floor(extraCargo * 0.5); // 0.5g per extra cargo unit

    // --- Weekly hull wear: 2 condition per boat ---
    for (let i = this.fleet.length - 1; i >= 0; i--) {
      const boat = this.fleet[i];
      const boatSummary = boatSummaryByBoat.get(boat);
      boat.applyDamage(2);
      if (boatSummary) {
        boatSummary.condition = boat.condition;
        boatSummary.conditionColor = boat.conditionColor ? boat.conditionColor() : '#888';
        boatSummary.conditionLabel = boat.conditionLabel ? boat.conditionLabel() : '';
      }
      if (boat.isCritical() && typeof notificationManager !== 'undefined') {
        notificationManager.log(`⚠ "${boat.name}" is in critical condition (${boat.condition}%)! Seek repairs!`, 'warning');
      }
      // Sinking from neglect (0 condition)
      if (boat.condition <= 0) {
        if (boatSummary) {
          boatSummary.sunk = true;
          boatSummary.condition = 0;
          boatSummary.conditionColor = '#f44336';
          boatSummary.conditionLabel = 'Sunk';
        }
        this._handleBoatSinking(boat, 'neglect');
      }
    }
    summary.wearApplied = true;

    summary.portMaintenance = boatMaintenance + summary.storageCost + summary.captainPayroll;
    if (summary.portMaintenance > 0 && this.gold >= summary.portMaintenance) {
      this.gold -= summary.portMaintenance;
      summary.portPaid = true;
    } else if (summary.portMaintenance > 0) {
      // Partial: take what we can
      const taken = Math.min(this.gold, summary.portMaintenance);
      this.gold -= taken;
      summary.portPaid = false;
    }

    summary.totalCosts = (summary.taxPaid ? summary.tax : 0) + summary.portMaintenance;
    summary.goldAfter = this.gold;

    // --- Banking weekly processing ---
    if (typeof bankingSystem !== 'undefined' && bankingSystem) {
      const bankResult = bankingSystem.processWeekly();
      if (bankResult) {
        summary.bankInterest = bankResult.depositInterest || 0;
        summary.loanInterest = bankResult.loanInterest || 0;
        summary.investmentReturns = bankResult.investmentReturns || 0;
      }
    }

    // --- Partial city-ownership payouts (bank/shop stakes before full city control) ---
    const cityList = (typeof window !== 'undefined' && Array.isArray(window.cities)) ? window.cities : [];
    if (cityList.length > 0) {
      for (const city of cityList) {
        if (!city || this.ownsCity(city)) continue; // full owners already get direct city control
        const stake = city.ownership?.purchased;
        if (!stake) continue;
        const baseValue = Math.max(100, Math.floor(city.getMarketValue ? city.getMarketValue() : 0));

        let cityPayout = 0;
        if (stake.bank) {
          // Keep partial-ownership income intentionally low so active trading remains primary.
          const bankPayout = Math.max(1, Math.min(30, Math.floor(baseValue * 0.004))); // 0.4% weekly, capped
          cityPayout += bankPayout;
          summary.stageIncomeDetails.push({ city: city.name, source: 'bank', amount: bankPayout });
        }
        if (stake.shop) {
          const shopPayout = Math.max(2, Math.min(45, Math.floor(baseValue * 0.006))); // 0.6% weekly, capped
          cityPayout += shopPayout;
          summary.stageIncomeDetails.push({ city: city.name, source: 'shop', amount: shopPayout });
        }

        if (cityPayout > 0) {
          this.gold += cityPayout;
          summary.stageIncome += cityPayout;
        }
      }
    }

    // Reset weekly trackers
    this.weeklyIncome = 0;
    this.weeklySpending = 0;

    // Show the summary popup
    if (typeof showWeeklySummary === 'function') {
      showWeeklySummary(summary);
    } else if (typeof notificationManager !== 'undefined') {
      // Fallback to notification if popup not available
      notificationManager.log(`Weekly costs: ${summary.totalCosts}g (tax ${summary.tax}g + port ${summary.portMaintenance}g)`, 'info');
    }
  }

  update() {
    // --- Hourly HP regen tick ---
    if (typeof dayNight !== 'undefined') {
      const currentHour = Math.floor((dayNight.timeOfDay / (Math.PI * 2)) * 24) + (dayNight.daysElapsed * 24);
      if (currentHour > this._lastRegenHour) {
        const hoursPassed = currentHour - this._lastRegenHour;
        this._lastRegenHour = currentHour;
        this.regenHP(hoursPassed);
      }

      // --- Pending investment payout (fallback for Merchant Guild event) ---
      if (this._pendingInvestment && dayNight.daysElapsed >= this._pendingInvestment.returnDay) {
        const returnGold = this._pendingInvestment.returnGold;
        this.earnGold(returnGold);
        if (typeof notificationManager !== 'undefined')
          notificationManager.log(`Investment returned ${returnGold} gold!`, 'success');
        this._pendingInvestment = null;
      }
    }
    // Resolve boat destruction from non-combat sources (events, hazards, wear) immediately.
    if (this.activeBoat && this.activeBoat.condition <= 0) {
      this._handleBoatSinking(this.activeBoat, 'damage');
    }

    // Follow path (click-to-move) only while actively roaming.
    if (!this.currentCity && this.path.length > 0) {
      const speed = typeof gameSpeed !== 'undefined' ? gameSpeed : 1;
      this.pathMoveTimer += deltaTime * speed;
      if (this.pathMoveTimer >= this.pathMoveInterval) {
        this.pathMoveTimer = 0;
        const next = this.path[0];

        if (next.x === this.x && next.y === this.y) {
          this.path.shift();
        } else {
          const dx = next.x - this.x;
          const dy = next.y - this.y;
          if (Math.abs(dx) > Math.abs(dy)) {
            this.direction = dx > 0 ? 'right' : 'left';
          } else {
            this.direction = dy > 0 ? 'down' : 'up';
          }

          this.x = next.x;
          this.y = next.y;
          this.path.shift();

          // Check if we transitioned between land and water
          this._updateSailingState();

          // Random sea events while sailing
          if (this.isSailing && this.activeBoat) {
            this._rollSeaEvent();
          }

          this.animTimer++;
          if (this.animTimer >= 4) {
            this.animFrame = (this.animFrame + 1) % 3;
            this.animTimer = 0;
          }

          if (typeof eventSystem !== 'undefined') {
            eventSystem.onPlayerMoved();
          }
        }
      }
    }

    // Pickup items on tile (only if cargo space available)
    const tile = this.grid[this.y] && this.grid[this.y][this.x];
    if (tile && tile.item) {
      if (this.addItem(tile.item)) {
        delete tile.item;
      }
    }

    // City collision — O(1) lookup via cityLocationMap
    const cityHere = (typeof cityLocationMap !== 'undefined' && cityLocationMap.size > 0)
      ? cityLocationMap.get(`${this.x},${this.y}`) || null
      : cities.find(city => city.location.x === this.x && city.location.y === this.y);
    const shouldEnterCity = !!cityHere && this.path.length === 0;
    if (shouldEnterCity && (!this.currentCity || this.currentCity.name !== cityHere.name)) {
      this.currentCity = cityHere;
      // Dock boat when actually stopping in a city.
      if (this.isSailing) {
        this.isSailing = false;
        this.pathMoveInterval = this.landSpeed;
      }
    } else if ((!cityHere || !shouldEnterCity) && this.currentCity) {
      this.currentCity = null;
    }

    // Win/lose (throttled to avoid expensive per-frame city valuation spikes)
    const nowMs = (typeof millis === 'function') ? millis() : Date.now();
    if (nowMs >= this._nextEndCheckTime) {
      this._nextEndCheckTime = nowMs + 750;
      this.checkEndConditions();
    }
  }

  /** Total gold + owned city equity (purchase value + budget) used for win/lose checks. */
  getTotalAssets(force = false) {
    const nowMs = (typeof millis === 'function') ? millis() : Date.now();
    if (!force && this._assetsCacheValue !== null && nowMs < this._assetsCacheUntil) {
      return this._assetsCacheValue;
    }

    let total = this.gold;
    if (this.ownedCities && this.ownedCities.length > 0) {
      const cityList = window.cities;
      for (const idx of this.ownedCities) {
        const city = cityList && cityList[idx];
        // Count the city's market value plus its treasury
        const cityValue = city && city.getMarketValue ? city.getMarketValue() : 0;
        total += cityValue;
        if (city && city.management) {
          total += city.management.budget || 0;
          total += city.management.ownerPayoutDue || 0;
        }
      }
    }
    this._assetsCacheValue = total;
    this._assetsCacheUntil = nowMs + 750;
    return total;
  }

  checkEndConditions(force = false) {
    if (typeof gameStateManager === 'undefined') return;
    // Don't re-check if we're already in an end state
    if (gameStateManager.is(GameStates.GAMEWON) || gameStateManager.is(GameStates.GAMELOSE)) return;

    // Save/load safety: if a loaded profile is already marked as won,
    // immediately return to the win state.
    if (this.hasWon && !this.continuedAfterWin) {
      gameStateManager.setState(GameStates.GAMEWON);
      return;
    }

    const goldTarget = window._newGameGoldTarget || 5000;
    const dayLimit = window._newGameDayLimit || 0;
    const totalAssets = this.getTotalAssets(force);
    // Trigger win when gold target is reached; require player has earned beyond starting assets
    if (totalAssets >= goldTarget && !this.hasWon && totalAssets > this._startingGold) {
      this.hasWon = true;
      gameStateManager.setState(GameStates.GAMEWON);
      return;
    }
    if (dayLimit > 0 && typeof dayNight !== 'undefined' && dayNight.getDaysElapsed() >= dayLimit && !this.hasWon) {
      if (totalAssets < goldTarget) {
        if (typeof triggerGameLose === 'function') triggerGameLose();
        else gameStateManager.setState(GameStates.GAMELOSE);
        return;
      }
    }
    if (totalAssets <= 0) {
      if (typeof triggerGameLose === 'function') triggerGameLose();
      else gameStateManager.setState(GameStates.GAMELOSE);
    }
  }

  /** Switch between sailing/walking based on current tile type */
  _updateSailingState() {
    const tile = this.grid[this.y]?.[this.x];
    if (!tile) return;
    const onWater = tile.options[0] === 'Water';

    if (onWater && this.activeBoat && !this.isSailing) {
      // Starting to sail
      this.isSailing = true;
      this.pathMoveInterval = this.activeBoat.getEffectiveSpeed();
      if (typeof notificationManager !== 'undefined' && !this._sailNotified) {
        notificationManager.log(`⛵ Sailing aboard the ${this.activeBoat.name}!`, "info");
        this._sailNotified = true;
        setTimeout(() => { this._sailNotified = false; }, 5000);
      }
    } else if (!onWater && this.isSailing) {
      // Disembarking
      this.isSailing = false;
      this.pathMoveInterval = this.landSpeed;
    }
  }

  /** Roll for random sea events each water tile moved (~1% chance) */
  _rollSeaEvent() {
    if (Math.random() > 0.01) return; // 1% per tile
    const boat = this.activeBoat;
    if (!boat) return;

    const roll = Math.random();
    if (roll < 0.60) {
      // Storm — 60%
      const dmg = 3 + Math.floor(Math.random() * 6); // 3-8
      boat.applyDamage(dmg);
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`⛈ A storm batters "${boat.name}"! -${dmg} condition (${boat.condition}%)`, 'warning');
      }
    } else if (roll < 0.90) {
      // Reef — 30%
      const dmg = 5 + Math.floor(Math.random() * 8); // 5-12
      boat.applyDamage(dmg);
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`🪸 Your hull scrapes a reef! -${dmg} condition (${boat.condition}%)`, 'warning');
      }
    } else {
      // Smooth sailing — 10%
      boat.repair(1);
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`🌤 Smooth sailing — minor repairs made (+1 condition)`, 'success');
      }
    }

    // Sinking check
    if (boat.condition <= 0) {
      this._handleBoatSinking(boat, 'sea');
    } else if (boat.isCritical()) {
      if (typeof notificationManager !== 'undefined' && !this._criticalWarned) {
        notificationManager.log(`⚠ "${boat.name}" is critically damaged (${boat.condition}%)! Seek repairs!`, 'warning');
        this._criticalWarned = true;
        setTimeout(() => { this._criticalWarned = false; }, 15000);
      }
    }
  }

  /** Handle any boat sinking; active-boat sink on water forces a shore rescue. */
  _handleBoatSinking(boat, cause = 'damage') {
    if (!boat) return false;
    const wasActive = this.activeBoat === boat;
    const bName = boat.name;
    const bType = boat.displayName || boat.type || 'boat';

    const idx = this.fleet.indexOf(boat);
    if (idx >= 0) this.fleet.splice(idx, 1);

    if (wasActive) {
      this.activeBoat = this.fleet[0] || null;
      this.isSailing = false;
      this.pathMoveInterval = this.landSpeed;
      this.path = [];

      // If we were at sea, wash up on the nearest safe land tile.
      const onWater = this.grid?.[this.y]?.[this.x]?.options?.[0] === 'Water';
      if (onWater) {
        const safe = (typeof findNearestSafeTile === 'function')
          ? findNearestSafeTile(this.x, this.y, (typeof cities !== 'undefined' ? cities : []))
          : null;
        if (safe) {
          this.x = safe.x;
          this.y = safe.y;
        }
      }
    }

    if (typeof notificationManager !== 'undefined') {
      if (wasActive && cause === 'sea') {
        notificationManager.log(`💀 "${bName}" (${bType}) sank! You wash ashore battered but alive.`, 'error');
      } else if (wasActive) {
        notificationManager.log(`💀 "${bName}" (${bType}) was destroyed. You wash ashore safely.`, 'error');
      } else {
        notificationManager.log(`💀 "${bName}" (${bType}) has sunk.`, 'error');
      }
    }
    return true;
  }

  render(tileSize) {
    const px = this.x * tileSize;
    const py = this.y * tileSize;

    if (this.isSailing && this.activeBoat) {
      // Draw boat sprite
      const boatSprites = SpriteSheet.boats?.[this.activeBoat.type];
      if (boatSprites && boatSprites[this.direction]) {
        const frame = boatSprites[this.direction][this.animFrame] || boatSprites[this.direction][0];
        // Boat drawn slightly larger for visual impact
        const boatSize = tileSize * 1.3;
        const offset = (boatSize - tileSize) / 2;
        image(frame, px - offset, py - offset, boatSize, boatSize);
      } else {
        // Fallback boat shape
        fill(140, 90, 50);
        noStroke();
        rect(px + 2, py + 4, tileSize - 4, tileSize - 8, 4);
      }

      // Boat name label
      push();
      fill(200, 240, 255, 200);
      noStroke();
      textAlign(CENTER, BOTTOM);
      textSize(8);
      text(this.activeBoat.name, px + tileSize / 2, py - 4);
      pop();
    } else {
      // Normal player sprite
      const sprites = SpriteSheet.player;
      if (sprites && sprites[this.direction]) {
        const frame = sprites[this.direction][this.animFrame] || sprites[this.direction][0];
        image(frame, px, py, tileSize, tileSize);
      } else {
        fill(255, 50, 50);
        noStroke();
        rect(px + 4, py + 4, tileSize - 8, tileSize - 8);
      }
    }

    // Player highlight ring
    push();
    noFill();
    stroke(255, 220, 50, 120);
    strokeWeight(2);
    ellipse(px + tileSize / 2, py + tileSize / 2, tileSize + 4, tileSize + 4);
    pop();
  }

  move(dx, dy) {
    const newX = this.x + dx;
    const newY = this.y + dy;

    if (
      newX >= 0 && newX < this.grid[0].length &&
      newY >= 0 && newY < this.grid.length
    ) {
      const cell = this.grid[newY]?.[newX];
      if (!cell) return;
      const tileType = cell.options[0];
      const canSail = this.activeBoat !== null;

      // Block water unless we have a boat
      if (tileType === 'Water' && !canSail) return;

      // Port gating: land↔water only near port cities (Sea Legs bypasses this)
      if (!this.modifiers.seaLegs) {
        const currentType = this.grid[this.y]?.[this.x]?.options[0];
        if (currentType !== 'Water' && tileType === 'Water') {
          if (!this._isNearPort(this.x, this.y)) return;
        }
        if (currentType === 'Water' && tileType !== 'Water') {
          if (!this._isNearPort(newX, newY)) return;
        }
      }

      if (Math.abs(dx) > Math.abs(dy)) {
        this.direction = dx > 0 ? 'right' : 'left';
      } else {
        this.direction = dy > 0 ? 'down' : 'up';
      }

      this.x = newX;
      this.y = newY;
      this.path = [];

      this._updateSailingState();

      this.animTimer++;
      if (this.animTimer >= 4) {
        this.animFrame = (this.animFrame + 1) % 3;
        this.animTimer = 0;
      }

      const tile = cell;
      if (tile && tile.item) {
        if (this.addItem(tile.item)) {
          delete tile.item;
        }
      }
    }
  }

  /** Check if a land tile is near a port city (within 2 tiles) */
  _isNearPort(lx, ly) {
    if (typeof portCityLocations === 'undefined' || !portCityLocations.length) return false;
    for (const pc of portCityLocations) {
      if (Math.abs(pc.x - lx) <= 2 && Math.abs(pc.y - ly) <= 2) return true;
    }
    return false;
  }

  /**
   * Add item(s) to inventory. Respects cargo capacity.
   * @param {object} item  – must have .name, optional .quantity
   * @param {boolean} force – if true, skip cargo check (e.g. quest rewards)
   * @returns {boolean} true if added, false if cargo full
   */
  addItem(item, force = false) {
    const qty = item.quantity || 1;
    // Resolve canonical inventory key. Two call patterns exist:
    //   addItem(ItemLibrary['NegotiationForDummies'])  → item.name = 'Negotiation for Dummies' (display name)
    //   addItem({ name: 'NegotiationForDummies', quantity: 1 }) → item.name IS the ItemLibrary key
    // We always want to store under the ItemLibrary key for consistency.
    let inventoryKey = item.name;
    if (!ItemLibrary[inventoryKey]) {
      const found = Object.keys(ItemLibrary).find(k => ItemLibrary[k] === item);
      if (found) inventoryKey = found;
    }
    const libEntry = ItemLibrary[inventoryKey];
    const itemWeight = libEntry ? libEntry.weight : (item.weight || 1);

    if (!force) {
      const currentWeight = this.getCargoWeight();
      const cap = this.getEffectiveCargoCapacity();
      if (currentWeight + itemWeight * qty > cap) {
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log('Cargo full! Cannot carry more.', 'warning');
        }
        return false;
      }
    }

    const entry = this.inventory.get(inventoryKey);
    if (entry) {
      entry.quantity += qty;
    } else {
      this.inventory.set(inventoryKey, {
        item: libEntry || item,
        quantity: qty,
      });
    }
    this.recalcModifiers();
    // Contextual tutorial tips on first acquisition
    if (libEntry && libEntry.tags && libEntry.tags.has) {
      if (libEntry.tags.has('book') && typeof tutorialSystem !== 'undefined' && tutorialSystem) {
        tutorialSystem.tryShow('foundBook');
      }
      if (libEntry.tags.has('bag') && typeof tutorialSystem !== 'undefined' && tutorialSystem) {
        tutorialSystem.tryShow('foundBag');
      }
    }
    return true;
  }

  removeItem(item) {
    // Resolve the same inventory key used by addItem
    let inventoryKey = item.name;
    if (!this.inventory.has(inventoryKey)) {
      const found = Object.keys(ItemLibrary).find(k => ItemLibrary[k] === item);
      if (found) inventoryKey = found;
    }
    const entry = this.inventory.get(inventoryKey);
    if (entry && entry.quantity > 0) {
      entry.quantity -= 1;
      if (entry.quantity <= 0) {
        this.inventory.delete(inventoryKey);
        // Auto-unequip weapon/bag if it was the last one
        if (this.equippedWeapon === inventoryKey) {
          this.equippedWeapon = null;
        }
        if (this.equippedBag === inventoryKey) {
          this.equippedBag = null;
        }
      }
    }
    this.recalcModifiers();
  }

  /** Equip a weapon from inventory. Must be a valid WEAPONS key and in inventory. */
  equipWeapon(itemKey) {
    if (!this.inventory.has(itemKey)) return false;
    // Verify it's a weapon (check Combat.js WEAPONS constant)
    if (typeof WEAPONS !== 'undefined' && !WEAPONS[itemKey]) return false;
    this.equippedWeapon = itemKey;
    return true;
  }

  /** Unequip current weapon (revert to Fists). */
  unequipWeapon() {
    this.equippedWeapon = null;
  }

  /** Equip a bag from inventory. Must be a valid BAGS key and in inventory. */
  equipBag(itemKey) {
    if (!this.inventory.has(itemKey)) return false;
    if (typeof BAGS === 'undefined' || !BAGS[itemKey]) return false;
    this.equippedBag = itemKey;
    return true;
  }

  /** Unequip current bag. */
  unequipBag() {
    this.equippedBag = null;
  }

  /**
   * Remove exactly qty units of itemKey from inventory.
   * Handles auto-unequip for weapons/bags. Returns true on success.
   */
  removeItemQuantity(itemKey, qty) {
    const entry = this.inventory.get(itemKey);
    if (!entry || entry.quantity < qty) return false;
    entry.quantity -= qty;
    if (entry.quantity <= 0) {
      this.inventory.delete(itemKey);
      if (this.equippedWeapon === itemKey) this.equippedWeapon = null;
      if (this.equippedBag === itemKey) this.equippedBag = null;
    }
    this.recalcModifiers();
    return true;
  }

  // ─── Leveling System ────────────────────────────────────

  /** XP needed to reach the next level (linear: level × 50) */
  getXPForNextLevel() {
    return this.level * 50;
  }

  /** Award XP and check for level-ups */
  gainXP(amount) {
    if (amount <= 0) return;
    this.xp += amount;
    this._checkLevelUp();
  }

  /** Internal: process any pending level-ups */
  _checkLevelUp() {
    let levelsGained = 0;
    while (this.xp >= this.getXPForNextLevel()) {
      this.xp -= this.getXPForNextLevel();
      this.level++;
      this.statPoints++;
      levelsGained++;
    }
    if (levelsGained > 0 && typeof notificationManager !== 'undefined') {
      notificationManager.log(
        `⬆️ Level Up! You are now level ${this.level}. You have ${this.statPoints} stat point${this.statPoints > 1 ? 's' : ''} to spend.`,
        'success'
      );
    }
  }

  /**
   * Spend one stat point on a chosen stat.
   * @param {'hp'|'attack'|'defense'|'magic'|'charm'} stat
   * @returns {boolean} true if spent successfully
   */
  spendStatPoint(stat) {
    if (this.statPoints <= 0) return false;
    switch (stat) {
      case 'hp':      this.bonusMaxHP += 3; this.currentHP += 3; break;
      case 'attack':  this.bonusAttack += 1; break;
      case 'defense': this.bonusDefense += 1; break;
      case 'magic':   this.bonusMagic += 1; break;
      case 'charm':   this.bonusCharm += 1; break;
      case 'speed':   this.bonusSpeed += 1; this.speed += 1; break;
      default: return false;
    }
    this.statPoints--;
    return true;
  }

  /** Recalculate passive bonuses from books in inventory */
  recalcModifiers() {
    this.modifiers.negotiationDiscount = 0;
    this.modifiers.bribeCostReduction = 0;
    this.modifiers.bribeCooldownBonus = 0;
    this.modifiers.treasureValueBonus = 0;
    this.modifiers.traderPiracy = false;

    if (this.inventory.has('NegotiationForDummies')) {
      this.modifiers.negotiationDiscount = 0.05; // 5%
    }
    if (this.inventory.has('ConflictResolution')) {
      this.modifiers.bribeCostReduction = 0.15; // 15%
      this.modifiers.bribeCooldownBonus = 2;    // +2 days
    }
    if (this.inventory.has('TreasureHunter')) {
      this.modifiers.treasureValueBonus = 0.10; // +10% treasure value
    }
    this.modifiers.seaLegs = this.inventory.has('SeaLegs');
    this.modifiers.traderPiracy = this.inventory.has('Pirating101');
  }

  /** Returns true when the player has access to a city's orbital program. */
  hasSpaceAccess(city = null) {
    if (!city) return false;
    const prog = city.progression;
    return !!(prog && (prog.spaceProgram || prog.spaceportBuilt || city.hasSpaceport));
  }

  /** Launch from an owned city into space orbit. */
  launchToSpace(city, planetKey = null) {
    if (!city || !this.ownsCity(city)) return { ok: false, reason: 'not_owned' };
    if (!this.hasSpaceAccess(city)) return { ok: false, reason: 'space_locked' };
    this.spaceTravel.currentCity = city.name;
    this.spaceTravel.lastLaunchCity = city.name;
    this.spaceTravel.currentPlanet = planetKey || 'orbit';
    this.spaceTravel.inOrbit = true;
    if (!Array.isArray(this.spaceTravel.visitedPlanets)) this.spaceTravel.visitedPlanets = [];
    if (planetKey && !this.spaceTravel.visitedPlanets.includes(planetKey)) {
      this.spaceTravel.visitedPlanets.push(planetKey);
    }
    return { ok: true };
  }

  /** Return from space back to the source city. */
  returnFromSpace() {
    this.spaceTravel.currentPlanet = null;
    this.spaceTravel.inOrbit = false;
    this.spaceTravel.currentCity = null;
    return { ok: true };
  }

  /** Apply a planet visit to the player's travel log. */
  visitPlanet(planetKey) {
    if (!planetKey) return { ok: false, reason: 'missing_planet' };
    if (!Array.isArray(this.spaceTravel.visitedPlanets)) this.spaceTravel.visitedPlanets = [];
    if (!this.spaceTravel.visitedPlanets.includes(planetKey)) this.spaceTravel.visitedPlanets.push(planetKey);
    this.spaceTravel.currentPlanet = planetKey;
    return { ok: true };
  }

  // ─── Space Fleet Management ─────────────────────────

  /** Get the SpaceTravelSystem instance (lazy-init) */
  getSpaceTravelSystem() {
    if (!this._spaceTravelSystem && typeof SpaceTravelSystem !== 'undefined') {
      this._spaceTravelSystem = new SpaceTravelSystem();
    }
    return this._spaceTravelSystem;
  }

  /** Buy a new space ship and add it to the fleet */
  buySpaceShip(type, name = null) {
    if (typeof SpaceShipLibrary === 'undefined') return { ok: false, reason: 'system_unavailable' };
    const template = SpaceShipLibrary[type];
    if (!template) return { ok: false, reason: 'unknown_type' };
    if (this.gold < template.cost) return { ok: false, reason: 'insufficient_gold' };

    if (typeof this.spendGold === 'function') this.spendGold(template.cost);
    else this.gold -= template.cost;

    const ship = new SpaceShip(type, name);
    if (!Array.isArray(this.spaceTravel.spaceFleet)) this.spaceTravel.spaceFleet = [];
    this.spaceTravel.spaceFleet.push(ship);

    // Auto-select if first ship
    if (this.spaceTravel.activeShipIndex < 0) {
      this.spaceTravel.activeShipIndex = this.spaceTravel.spaceFleet.length - 1;
    }
    return { ok: true, ship };
  }

  /** Get the currently active SpaceShip instance (or null) */
  getActiveSpaceShip() {
    const fleet = this.spaceTravel.spaceFleet;
    const idx = this.spaceTravel.activeShipIndex;
    if (!Array.isArray(fleet) || idx < 0 || idx >= fleet.length) return null;
    const entry = fleet[idx];
    // If it's already a SpaceShip instance, return it directly
    if (entry instanceof SpaceShip) return entry;
    // Otherwise reconstruct from serialized data
    if (typeof SpaceShip !== 'undefined') {
      const ship = SpaceShip.fromJSON(entry);
      if (ship) fleet[idx] = ship; // cache the live instance
      return ship;
    }
    return null;
  }

  /** Select a ship from the fleet by index */
  selectSpaceShip(index) {
    const fleet = this.spaceTravel.spaceFleet;
    if (!Array.isArray(fleet) || index < 0 || index >= fleet.length) return { ok: false, reason: 'invalid_index' };
    this.spaceTravel.activeShipIndex = index;
    return { ok: true };
  }

  /** Get count of space ships owned */
  getSpaceFleetSize() {
    return Array.isArray(this.spaceTravel.spaceFleet) ? this.spaceTravel.spaceFleet.length : 0;
  }

  // ─── Owned Cities (Adventure Mode) ──────────────────

  /** Check if the player owns a specific city */
  ownsCity(city) {
    if (!city) return false;
    const cities = window.cities;
    if (!cities) return false;
    const idx = cities.indexOf(city);
    return idx >= 0 && this.ownedCities.includes(idx);
  }

  /** Add an owned city by reference */
  addOwnedCity(city) {
    const cities = window.cities;
    if (!cities) return false;
    const idx = cities.indexOf(city);
    if (idx < 0 || this.ownedCities.includes(idx)) return false;
    this.ownedCities.push(idx);
    city._isManagedCity = true;
    if (city.ownership && typeof city.ownership === 'object') {
      city.ownership.offerAccepted = true;
      city.ownership.purchased = { bank: true, buildings: true, shop: true };
    }
    // Initialize management object if missing
    if (!city.management) {
      city.management = {
        budget: 0,
        taxRate: 0.05,
        buildingQueue: [],
        upgradeLevels: {},
        routes: [],
        units: [],
        ownerPayoutDue: 0,
        ownerTaxShare: 0.35,
      };
    }
    if (!Array.isArray(city.management.routes)) city.management.routes = [];
    if (!Array.isArray(city.management.units)) city.management.units = [];
    if (!Number.isFinite(Number(city.management.ownerTaxShare))) city.management.ownerTaxShare = 0.35;
    city.management.ownerPayoutDue = 0;
    if (!city.progression && typeof city._createProgressionState === 'function') {
      city.progression = city._createProgressionState();
    }
    if (typeof city._ensureProgressionState === 'function') city._ensureProgressionState();
    // Keep world minimap ownership colors in sync immediately after acquisition.
    if (typeof invalidateMinimap === 'function') invalidateMinimap(false);
    if (typeof generateMinimap === 'function') generateMinimap();
    return true;
  }

  /** Remove an owned city by reference */
  removeOwnedCity(city) {
    const cities = window.cities;
    if (!cities) return false;
    const idx = cities.indexOf(city);
    const pos = this.ownedCities.indexOf(idx);
    if (pos < 0) return false;
    this.ownedCities.splice(pos, 1);
    city._isManagedCity = false;
    // Refresh minimap when ownership is removed.
    if (typeof invalidateMinimap === 'function') invalidateMinimap(false);
    if (typeof generateMinimap === 'function') generateMinimap();
    return true;
  }

  /** Get all owned City objects */
  getOwnedCities() {
    const cities = window.cities;
    if (!cities) return [];
    return this.ownedCities.map(i => cities[i]).filter(Boolean);
  }

  addPartyMember(member) {
    if (this.party.length < this.partyLimit) {
      this.party.push(member);
      return true;
    }
    return false;
  }

  removePartyMember(index) {
    if (index >= 0 && index < this.party.length) {
      this.party.splice(index, 1);
    }
  }

  spendGold(amount) {
    if (this.gold >= amount) {
      this.gold -= amount;
      this.weeklySpending += amount;
      // UI juice: spawn spend particles at HUD gold location and show transient -amount label
      try {
        const el = document.getElementById('playerGold');
        if (el && typeof particleSystem !== 'undefined' && particleSystem) {
          const r = el.getBoundingClientRect();
          // Map page coords into canvas coords for screen-space particle rendering
          const canvasEl = document.querySelector('canvas');
          const cvsRect = canvasEl ? canvasEl.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth };
          const xCss = (r.left - cvsRect.left) + r.width/2;
          const yCss = (r.top - cvsRect.top) + r.height/2;
          const scale = (canvasEl && canvasEl.width && cvsRect.width) ? (canvasEl.width / cvsRect.width) : 1;
          particleSystem.spawnBurst(xCss * scale, yCss * scale, { count: 14, color: '#ff8a65', size: 6, speed: 80, frame: 'Cash', screen: true });
          // small pop on the gold number
          el.classList.add('gold-pop');
          setTimeout(() => el.classList.remove('gold-pop'), 260);

          // transient -amount label
          const change = document.createElement('span');
          change.className = 'gold-change gold-change-spend';
          change.textContent = `-${amount}g`;
          // Prefer anchoring to HUD container if present so layout/stacking is stable
          const hud = document.getElementById('playerView');
          if (hud) {
            hud.appendChild(change);
            const hudRect = hud.getBoundingClientRect();
            change.style.left = (r.left - hudRect.left + r.width/2 - 12) + 'px';
            change.style.top = (r.top - hudRect.top - 8) + 'px';
          } else {
            document.body.appendChild(change);
            change.style.left = (r.left + r.width/2 - 12) + 'px';
            change.style.top = (r.top - 8) + 'px';
          }
          change.addEventListener('animationend', () => change.remove());
        }
      } catch (e) {}
      return true;
    }
    return false;
  }

  earnGold(amount) {
    this.gold += amount;
    this.weeklyIncome += amount;
    // UI juice: spawn earn particles at HUD gold location and show transient +amount label
    try {
      const el = document.getElementById('playerGold');
      if (el && typeof particleSystem !== 'undefined' && particleSystem) {
        const r = el.getBoundingClientRect();
        const canvasEl = document.querySelector('canvas');
        const cvsRect = canvasEl ? canvasEl.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth };
        const xCss = (r.left - cvsRect.left) + r.width/2;
        const yCss = (r.top - cvsRect.top) + r.height/2;
        const scale = (canvasEl && canvasEl.width && cvsRect.width) ? (canvasEl.width / cvsRect.width) : 1;
        particleSystem.spawnBurst(xCss * scale, yCss * scale, { count: 20, color: '#ffd54f', size: 7, speed: 120, frame: 'Cash', screen: true });
        // small pop on the gold number
        el.classList.add('gold-pop');
        setTimeout(() => el.classList.remove('gold-pop'), 260);

        // transient +amount label
        const change = document.createElement('span');
        change.className = 'gold-change gold-change-earn';
        change.textContent = `+${amount}g`;
        const hud = document.getElementById('playerView');
        if (hud) {
          hud.appendChild(change);
          const hudRect = hud.getBoundingClientRect();
          change.style.left = (r.left - hudRect.left + r.width/2 - 12) + 'px';
          change.style.top = (r.top - hudRect.top - 8) + 'px';
        } else {
          document.body.appendChild(change);
          change.style.left = (r.left + r.width/2 - 12) + 'px';
          change.style.top = (r.top - 8) + 'px';
        }
        change.addEventListener('animationend', () => change.remove());
      }
    } catch (e) {}
  }

  setPathTo(targetX, targetY, allowWater = false) {
    // Clicking your current tile means "stop moving".
    if (targetX === this.x && targetY === this.y) {
      this.path = [];
      this.pathMoveTimer = 0;
      return;
    }
    const start = { x: this.x, y: this.y };
    const goal = { x: targetX, y: targetY };
    const ports = allowWater && !this.modifiers.seaLegs && typeof portCityLocations !== 'undefined' ? portCityLocations : null;
    const path = aStar(this.grid, start, goal, allowWater, ports);
    if (path && path.length > 0) {
      this.path = path;
      this.currentCity = null;
    } else if (typeof notificationManager !== 'undefined') {
      notificationManager.log("Can't find a path there.", "warning");
    }
  }

  fastTravelToCity(city, cost) {
    const travelCost = cost || 20;
    this.x = city.location.x;
    this.y = city.location.y;
    this.currentCity = city;
    this.spendGold(travelCost);
    notificationManager.log(`Traveled to ${city.name} for ${travelCost}g!`, "info");
  }
}
