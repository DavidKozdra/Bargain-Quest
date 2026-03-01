class Player {
  constructor(grid, startX = 0, startY = 0, partyLimit = 4) {
    this.grid = grid;
    this.x = startX;
    this.y = startY;
    this.partyLimit = partyLimit;

    // Core state
    this.inventory = new Map();
    this.gold = 100;
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

    // Boat fleet system
    this.fleet = [];         // Array of Boat instances
    this.activeBoat = null;  // Currently selected Boat (or null)
    this.isSailing = false;  // True when on water with a boat
    this.landSpeed = 100;    // Default land pathMoveInterval
    this._sailNotified = false;

    // Give starting items
    this.addItem({ name: 'Fish', quantity: 5 });
    this.addItem({ name: 'Wheat', quantity: 3 });

    // Path following
    this.pathMoveTimer = 0;
    this.pathMoveInterval = 100;

    window.addEventListener("dayChanged", () => this.onDayChanged());
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
      cap += this.activeBoat.cargoBonus;
    }
    return cap;
  }

  onDayChanged() {
    this.consumeDailyFood();
    if (dayNight.daysElapsed % 7 === 0) {
      this.applyWeeklyTax();
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
    }
  }

  applyWeeklyTax() {
    const tax = Math.floor(this.gold * this.taxRate) + 1;
    if (this.spendGold(tax)) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log("Paid " + tax + " gold in weekly taxes.", "info");
      }
    } else {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log("Couldn't pay taxes (" + tax + " gold)!", "warning");
      }
    }
  }

  update() {
    // Follow path (click-to-move)
    if (this.path.length > 0) {
      this.pathMoveTimer += deltaTime;
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

    // Pickup items on tile
    const tile = this.grid[this.y] && this.grid[this.y][this.x];
    if (tile && tile.item) {
      this.addItem(tile.item);
      delete tile.item;
    }

    // City collision
    const cityHere = cities.find(city => city.location.x === this.x && city.location.y === this.y);
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
    if (this.gold >= 5000 && !this.hasWon) {
      gameStateManager.setState(GameStates.GAMEWON);
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
      this.pathMoveInterval = this.activeBoat.speed;
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
        this.addItem(tile.item);
        delete tile.item;
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

  addItem(item) {
    const entry = this.inventory.get(item.name);
    if (entry) {
      entry.quantity += item.quantity || 1;
    } else {
      this.inventory.set(item.name, {
        item: ItemLibrary[item.name],
        quantity: item.quantity || 1,
      });
    }
  }

  removeItem(item) {
    const entry = this.inventory.get(item.name);
    if (entry && entry.quantity > 0) {
      entry.quantity -= 1;
      if (entry.quantity <= 0) this.inventory.delete(item.name);
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
      return true;
    }
    return false;
  }

  earnGold(amount) {
    this.gold += amount;
  }

  setPathTo(targetX, targetY, allowWater = false) {
    const start = { x: this.x, y: this.y };
    const goal = { x: targetX, y: targetY };
    const ports = allowWater && typeof portCityLocations !== 'undefined' ? portCityLocations : null;
    const path = aStar(this.grid, start, goal, allowWater, ports);
    if (path && path.length > 0) {
      this.path = path;
    }
  }

  fastTravelToCity(city) {
    this.x = city.location.x;
    this.y = city.location.y;
    this.currentCity = city;
    this.spendGold(20);
    notificationManager.log("Traveled to " + city.name + "!", "info");
  }
}
