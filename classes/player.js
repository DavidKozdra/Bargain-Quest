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
      const penalty = 10;
      if (!this.spendGold(penalty)) this.gold = 0;
      notificationManager.log("Starvation! Lost " + penalty + " gold.", "warning");
    }
  }

  applyWeeklyTax() {
    const tax = Math.floor(this.gold * this.taxRate) + 1;
    if (this.spendGold(tax)) {
      notificationManager.log("Paid " + tax + " gold in weekly taxes.", "info");
    } else {
      notificationManager.log("Couldn't pay taxes (" + tax + " gold)!", "warning");
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

  render(tileSize) {
    const px = this.x * tileSize;
    const py = this.y * tileSize;

    const sprites = SpriteSheet.player;
    if (sprites && sprites[this.direction]) {
      const frame = sprites[this.direction][this.animFrame] || sprites[this.direction][0];
      image(frame, px, py, tileSize, tileSize);
    } else {
      fill(255, 50, 50);
      noStroke();
      rect(px + 4, py + 4, tileSize - 8, tileSize - 8);
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
      newY >= 0 && newY < this.grid.length &&
      this.grid[newY][newX].options[0] !== 'Water'
    ) {
      if (Math.abs(dx) > Math.abs(dy)) {
        this.direction = dx > 0 ? 'right' : 'left';
      } else {
        this.direction = dy > 0 ? 'down' : 'up';
      }

      this.x = newX;
      this.y = newY;
      this.path = [];

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

  setPathTo(targetX, targetY) {
    const start = { x: this.x, y: this.y };
    const goal = { x: targetX, y: targetY };
    const path = aStar(this.grid, start, goal);
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
