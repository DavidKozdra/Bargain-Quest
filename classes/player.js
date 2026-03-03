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
    this.currentCity = null;

    // Economy
    this.taxRate = 0.05;
    this.foodPerMemberPerDay = 1;
    this.cargoCapacity = 50;
    this.combatStrength = 3;
    this.speed = 2; // Base combat speed (initiative rolls)

    // Equipped weapon (ItemLibrary key string, or null for Fists)
    this.equippedWeapon = null;

    // Book-derived modifiers (recalculated when inventory changes)
    this.modifiers = {
      negotiationDiscount: 0,   // fraction off buy price / added to sell price
      bribeCostReduction: 0,    // fraction off bribe cost
      bribeCooldownBonus: 0,    // extra days of cooldown after bribe
      treasureValueBonus: 0,    // fraction bonus to treasure dig rewards
    };

    // Weekly income tracking (reset each week)
    this.weeklyIncome = 0;   // gold earned via trades this week
    this.weeklySpending = 0; // gold spent on purchases this week

    // Boat fleet system
    this.fleet = [];         // Array of Boat instances
    this.activeBoat = null;  // Currently selected Boat (or null)
    this.isSailing = false;  // True when on water with a boat
    this.landSpeed = 100;    // Default land pathMoveInterval
    this._sailNotified = false;

    // Listen for day changes to consume food & apply costs
    this._onDayChanged = () => this.onDayChanged();
    window.addEventListener('dayChanged', this._onDayChanged);

    // Give starting items
    this.addItem({ name: 'Fish', quantity: 5 });
    this.addItem({ name: 'Wheat', quantity: 3 });

    // Path following
    this.pathMoveTimer = 0;
    this.pathMoveInterval = 100;

    this._onDayChanged = () => this.onDayChanged();
    window.addEventListener("dayChanged", this._onDayChanged);
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

  /** Effective cargo capacity including active boat bonus when sailing */
  getEffectiveCargoCapacity() {
    let cap = this.cargoCapacity;
    if (this.isSailing && this.activeBoat) {
      cap += this.activeBoat.getEffectiveCargo();
    }
    return cap;
  }

  onDayChanged() {
    this.consumeDailyFood();
    this.applyCursedItemDrain();
    if (dayNight.daysElapsed % 7 === 0) {
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
    const needed = this.party.length * this.foodPerMemberPerDay + 1;
    const foodPriority = ['Bread', 'SaltedFish', 'Fish', 'Wheat'];
    let remaining = needed;

    for (const foodName of foodPriority) {
      if (remaining <= 0) break;
      const entry = this.inventory.get(foodName);
      if (entry && entry.quantity > 0) {
        const consumed = Math.min(remaining, entry.quantity);
        entry.quantity -= consumed;
        if (entry.quantity <= 0) this.inventory.delete(foodName);
        remaining -= consumed;
      }
    }

    if (remaining > 0) {
      const penalty = Math.min(10, this.gold);
      this.gold -= penalty;
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log("Starvation! Lost " + penalty + " gold.", "warning");
      }

      // Check game over from starvation
      if (this.gold <= 0 && this.inventory.size === 0) {
        if (typeof gameStateManager !== 'undefined') {
          gameStateManager.setState(GameStates.GAMELOSE);
        }
      }
    } else {
      // Check food running low — tutorial hint
      let totalFood = 0;
      for (const foodName of foodPriority) {
        const entry = this.inventory.get(foodName);
        if (entry) totalFood += entry.quantity;
      }
      if (totalFood <= 3 && typeof tutorialSystem !== 'undefined' && tutorialSystem) {
        tutorialSystem.tryShow('lowFood');
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
      spending: this.weeklySpending,
      tax: 0,
      taxPaid: false,
      portMaintenance: 0,
      portPaid: false,
      boatDetails: [],
      storageCost: 0,
      totalCosts: 0,
      goldAfter: 0,
    };

    // --- Tax ---
    summary.tax = Math.floor(this.gold * this.taxRate) + 1;
    if (this.gold >= summary.tax) {
      this.gold -= summary.tax;
      summary.taxPaid = true;
    } else {
      summary.taxPaid = false;
    }

    // --- Port maintenance: per-boat docking fee ---
    let boatMaintenance = 0;
    for (const boat of this.fleet) {
      const template = typeof BoatLibrary !== 'undefined' ? BoatLibrary[boat.type] : null;
      const baseCost = template ? template.cost : 200;
      const fee = Math.max(1, Math.floor(baseCost * 0.02)); // 2% of boat value per week
      summary.boatDetails.push({ name: boat.name, type: boat.displayName || boat.type, fee });
      boatMaintenance += fee;
    }

    // --- Storage upkeep: scales with cargo capacity above base ---
    const baseCargo = 50;
    const extraCargo = Math.max(0, this.cargoCapacity - baseCargo);
    summary.storageCost = Math.floor(extraCargo * 0.5); // 0.5g per extra cargo unit

    // --- Weekly hull wear: 2 condition per boat ---
    for (const boat of this.fleet) {
      boat.applyDamage(2);
      if (boat.isCritical() && typeof notificationManager !== 'undefined') {
        notificationManager.log(`⚠ "${boat.name}" is in critical condition (${boat.condition}%)! Seek repairs!`, 'warning');
      }
      // Sinking from neglect (0 condition)
      if (boat.condition <= 0) {
        const sinkIdx = this.fleet.indexOf(boat);
        if (sinkIdx >= 0) this.fleet.splice(sinkIdx, 1);
        if (this.activeBoat === boat) {
          this.activeBoat = this.fleet[0] || null;
          this.isSailing = false;
          this.pathMoveInterval = this.landSpeed;
        }
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log(`💀 "${boat.name}" has rotted away and sank!`, 'error');
        }
      }
    }
    summary.wearApplied = true;

    summary.portMaintenance = boatMaintenance + summary.storageCost;
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
    // Follow path (click-to-move)
    if (this.path.length > 0) {
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
    if (cityHere && (!this.currentCity || this.currentCity.name !== cityHere.name)) {
      this.currentCity = cityHere;
      // Dock boat when entering city
      if (this.isSailing) {
        this.isSailing = false;
        this.pathMoveInterval = this.landSpeed;
      }
    } else if (!cityHere && this.currentCity) {
      this.currentCity = null;
    }

    // Win/lose
    const goldTarget = window._newGameGoldTarget || 5000;
    const dayLimit = window._newGameDayLimit || 0;
    // Trigger win when gold target is reached; guard against instant-win only when target > starting gold
    if (this.gold >= goldTarget && !this.hasWon && (goldTarget <= this._startingGold || this.gold > this._startingGold)) {
      this.hasWon = true;
      gameStateManager.setState(GameStates.GAMEWON);
    }
    if (dayLimit > 0 && typeof dayNight !== 'undefined' && dayNight.getDaysElapsed() >= dayLimit && !this.hasWon) {
      if (this.gold < goldTarget) {
        gameStateManager.setState(GameStates.GAMELOSE);
      }
    }
    if (this.gold <= 0 && this.inventory.size === 0) {
      gameStateManager.setState(GameStates.GAMELOSE);
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
      const bName = boat.name;
      const bType = boat.displayName;
      const idx = this.fleet.indexOf(boat);
      if (idx >= 0) this.fleet.splice(idx, 1);
      this.activeBoat = this.fleet[0] || null;
      this.isSailing = false;
      this.pathMoveInterval = this.landSpeed;
      this.path = []; // stop moving
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`💀 "${bName}" (${bType}) has sunk beneath the waves!`, 'error');
      }
    } else if (boat.isCritical()) {
      if (typeof notificationManager !== 'undefined' && !this._criticalWarned) {
        notificationManager.log(`⚠ "${boat.name}" is critically damaged (${boat.condition}%)! Seek repairs!`, 'warning');
        this._criticalWarned = true;
        setTimeout(() => { this._criticalWarned = false; }, 15000);
      }
    }
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
      const tileType = this.grid[newY][newX].options[0];
      const canSail = this.activeBoat !== null;

      // Block water unless we have a boat
      if (tileType === 'Water' && !canSail) return;

      // Port gating: land→water only near port cities
      const currentType = this.grid[this.y]?.[this.x]?.options[0];
      if (currentType !== 'Water' && tileType === 'Water') {
        // Transitioning from land to water — must be near a port
        if (!this._isNearPort(this.x, this.y)) return;
      }
      if (currentType === 'Water' && tileType !== 'Water') {
        // Transitioning from water to land — must be near a port
        if (!this._isNearPort(newX, newY)) return;
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

      const tile = this.grid[newY][newX];
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
        // Auto-unequip weapon if it was the last one
        if (this.equippedWeapon === inventoryKey) {
          this.equippedWeapon = null;
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

  /** Recalculate passive bonuses from books in inventory */
  recalcModifiers() {
    this.modifiers.negotiationDiscount = 0;
    this.modifiers.bribeCostReduction = 0;
    this.modifiers.bribeCooldownBonus = 0;
    this.modifiers.treasureValueBonus = 0;

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
      return true;
    }
    return false;
  }

  earnGold(amount) {
    this.gold += amount;
    this.weeklyIncome += amount;
  }

  setPathTo(targetX, targetY, allowWater = false) {
    const start = { x: this.x, y: this.y };
    const goal = { x: targetX, y: targetY };
    const ports = allowWater && typeof portCityLocations !== 'undefined' ? portCityLocations : null;
    const path = aStar(this.grid, start, goal, allowWater, ports);
    if (path && path.length > 0) {
      this.path = path;
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
