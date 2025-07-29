class Player {
  /**
   * @param {Array<Array>} grid - 2D array of tile objects
   * @param {number} startX - Initial column
   * @param {number} startY - Initial row
   * @param {number} partyLimit - Max party size
   */
  constructor(grid, startX = 0, startY = 0, partyLimit = 4) {
    this.grid = grid;
    this.x = startX;
    this.y = startY;
    this.partyLimit = partyLimit;
    this.inventory = [];
    this.gold = 0;
    this.party = [];

    this.path = [];         // Array of { x, y } for current route
    this.facingAngle = 0;   // Radians
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

        // Triangle body
        beginShape();
        vertex(0, 0, -tileSize / 2);
        vertex(-tileSize / 3, 0, tileSize / 3);
        vertex(tileSize / 3, 0, tileSize / 3);
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

  /**
   * Add item to inventory
   */
  addItem(item) {
    const idx = this.inventory.findIndex(i => i.id === item.id);
    if (idx !== -1) {
      this.inventory[idx].quantity += item.quantity;
    } else {
      this.inventory.push({ ...item });
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
}
