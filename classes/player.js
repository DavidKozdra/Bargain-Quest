class Player {
  /**
   * @param {Array<Array>} grid
   * @param {number} startX
   * @param {number} startY
   * @param {number} partyLimit
   */
  constructor(grid, startX = 0, startY = 0, partyLimit = 4) {
    this.grid = grid;
    this.x = startX;
    this.y = startY;
    this.partyLimit = partyLimit;

    // Core state
    this.inventory = new Map(); // itemName -> { item, quantity }
    this.gold = 100;
    this.party = [];
    this.currentPlayer = {};
    this.path = [];
    this.facingAngle = 0;
    this.hasWon = false;
    this.currentCity = null;

    this.taxRate = 0.05;           // 5% of current gold per week
    this.foodPerMemberPerDay = 1;  // food units consumed per member each day

    // give them 5 fish at the very start:
    this.addItem({ name: 'Fish', quantity: 5 });

    // hook into your existing day change event
    window.addEventListener("dayChanged", (e) => {
      this.onDayChanged();
      console.log("player new day")
    });
  }

  // called every time the “dayChanged” event fires
  onDayChanged() {

    // 1) Daily food usage
    this.consumeDailyFood();

    // 2) Every 7 days: collect taxes
    if (dayNight.daysElapsed % 7 === 0) {
      this.applyWeeklyTax();
    }
  }

  /** subtracts food for each party member; logs a warning if you run out */
  consumeDailyFood() {
    const needed = this.party.length * this.foodPerMemberPerDay + 1;
    const entry = this.inventory.get('Fish');
    const have = entry ? entry.quantity : 0;

    if (have >= needed) {
      entry.quantity -= needed;
      if (entry.quantity === 0) {
        this.inventory.delete('Fish');
      }
      notificationManager.log(`Consumed ${needed} food.`);
    } else {
      // not enough food: remove what you can, then suffer penalty
      if (have > 0) {
        this.inventory.delete('Fish');
        notificationManager.log(`Consumed ${have} food, but ran out!`);
      }
      // e.g. lose gold as penalty, or health (you could define health)
      const penalty = 10;
      if(this.spendGold(penalty)){

      }else {
        this.gold = 0
      }

      notificationManager.log(`Starvation penalty: lost ${penalty} gold.`);
    }
  }

  /** deducts a % of current gold as “taxes” */
  applyWeeklyTax() {
    const tax = Math.floor(this.gold * this.taxRate) +1;
    if (this.spendGold(tax)) {
      notificationManager.log(`Paid weekly taxes of ${tax} gold.`);
    } else {
      notificationManager.log(`Couldn’t pay taxes (${tax}); you're in debt!`);
      // handle debt states here if desired
    }
  }
  /**
   * Update player state: move along path
   */
  update() {
    if (this.path.length > 0) {
      const next = this.path[0];

      if (next.x === this.x && next.y === this.y) {
        this.path.shift();
        return;
      }

      const dx = next.x - this.x;
      const dy = next.y - this.y;
      this.facingAngle = atan2(dy, dx);

      this.x = next.x;
      this.y = next.y;
      this.path.shift();
    }

    // Interact with tile (optional)
    const tile = this.grid[this.y][this.x];
    if (tile.item) {
      this.addItem(tile.item);
      delete tile.item;
    }

    //check citiy collision 

    const cityHere = cities.find(city => city.location.x === this.x && city.location.y === this.y);

    if (cityHere && (!this.currentCity || this.currentCity.name !== cityHere.name)) {
      this.currentCity = cityHere;
    } else if (!cityHere && this.currentCity) {
      this.currentCity = null;
    }

    
    if(this.gold >= 5000 && !this.hasWon){
        gameStateManager.setState(GameStates.GAMEWON);
    }
    if(this.gold <= 0){
        gameStateManager.setState(GameStates.GAMELOSE);
    }

    // console.log("Current :", grid[player.x][player.y])
  }

  /**
   * Render the player as a triangle pointing in the movement direction
   */
  render(tileSize, cols, rows, maxHeight) {
    const posX = this.x * tileSize + tileSize / 2;
    const posZ = this.y * tileSize + tileSize / 2;
    const elevation = elevationMap[this.y][this.x] * maxHeight;

    push();
    translate(-cols * tileSize / 2, 0, -rows * tileSize / 2);
    translate(posX, elevation + 10, posZ);
    rotateY(-this.facingAngle + HALF_PI);
    fill('#FF0000');
    noStroke();

    beginShape();
    vertex(0, 0, tileSize / 2);
    vertex(-tileSize / 3, 0, -tileSize / 3);
    vertex(tileSize / 3, 0, -tileSize / 3);
    endShape(CLOSE);
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
      this.facingAngle = atan2(dy, dx);
      this.x = newX;
      this.y = newY;

      // Pickup item if any
      const tile = this.grid[newY][newX];
      if (tile.item) {
        this.addItem(tile.item);
        delete tile.item;
      }
    }
  }
  addItem(item) {
    const entry = this.inventory.get(item.name);

    if (entry) {
      entry.quantity += item.quantity ?? 1;
    } else {
      this.inventory.set(item.name, {
        item: ItemLibrary[item.name],
        quantity: item.quantity ?? 1,
      });
    }
  }

  removeItem(item) {
    const entry = this.inventory.get(item.name);

    if (entry && entry.quantity > 0) {
      entry.quantity -= 1;

      if (entry.quantity <= 0) {
        this.inventory.delete(item.name);
      }
    } else {
      console.error("Item not found or quantity is zero:", item.name);
    }
  }

  /**
   * Add a party member
   */
  addPartyMember(member) {
    if (this.party.length < this.partyLimit) {
      this.party.push(member);
      return true;
    }
    return false;
  }

  /**
   * Remove a party member by index
   */
  removePartyMember(index) {
    if (index >= 0 && index < this.party.length) {
      this.party.splice(index, 1);
    }
  }

  /**
   * Spend gold if you have enough
   */
  spendGold(amount) {
    if (this.gold >= amount) {
      this.gold -= amount;
      return true;
    }
    return false;
  }

  /**
   * Earn gold
   */
  earnGold(amount) {
    this.gold += amount;
  }

  /**
   * Set destination path using A* pathfinding
   */
  setPathTo(targetX, targetY) {
    const start = { x: this.x, y: this.y };
    const goal = { x: targetX, y: targetY };
    const path = aStar(this.grid, start, goal);
    if (path.length > 0) {
      this.path = path;
    }
  }

  fastTravelToCity(city) {
  this.x = city.location.x;
  this.y = city.location.y;
  this.currentCity = city;
  this.spendGold(20)
  notificationManager.log("You have gone to !", city.name);
}

}
