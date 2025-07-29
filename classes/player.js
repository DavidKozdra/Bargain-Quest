class Player {
  /**
   * @param {Array<Array>} grid - Reference to the world grid (2D array of tile objects)
   * @param {number} startX - Starting X coordinate (column index)
   * @param {number} startY - Starting Y coordinate (row index)
   * @param {number} partyLimit - Maximum party size
   */
  constructor(grid, startX = 0, startY = 0, partyLimit = 4) {
    this.grid = grid;
    this.x = startX;
    this.y = startY;

    // Inventory: array of items ({ id, name, quantity })
    this.inventory = [];

    // Currency
    this.gold = 0;

    // Party management
    this.partyLimit = partyLimit;
    this.party = [];
  }

  /**
   * Main update loop: handle movement & interactions
   */
  update() {
    // Example WASD movement (ensure within bounds)
    if (keyIsDown(65) && this.x > 0)                 this.x--; // A
    if (keyIsDown(68) && this.x < this.grid[0].length - 1) this.x++; // D
    if (keyIsDown(87) && this.y > 0)                 this.y--; // W
    if (keyIsDown(83) && this.y < this.grid.length - 1)    this.y++; // S

    // Interact with current tile (e.g., pick up items)
    const tile = this.grid[this.y][this.x];
    if (tile.item) {
      this.addItem(tile.item);
      delete tile.item;
    }
  }

  /**
   * Draw the player avatar in the 3D world
   */
  render(tileSize, cols, rows) {
    push();
      // Center the world then offset to player's position
      translate(-cols * tileSize / 2, 0, -rows * tileSize / 2);
      // Position at cell center, lift above ground
      translate(
        this.x * tileSize + tileSize / 2,
        -tileSize,
        this.y * tileSize + tileSize / 2
      );
      fill('#FF0000');
      sphere(tileSize * 0.4);
    pop();
  }

  /**
   * Add an item to inventory (stack if existing)
   * @param {{id:string,name:string,quantity:number}} item
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
   * Add a new member to the party if space allows
   * @param {Object} member
   * @returns {boolean} success
   */
  addPartyMember(member) {
    if (this.party.length < this.partyLimit) {
      this.party.push(member);
      return true;
    }
    return false;
  }

  /**
   * Remove a member from the party by index
   * @param {number} index
   */
  removePartyMember(index) {
    if (index >= 0 && index < this.party.length) {
      this.party.splice(index, 1);
    }
  }

  /**
   * Spend gold (return true if enough)
   * @param {number} amount
   * @returns {boolean}
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
   * @param {number} amount
   */
  earnGold(amount) {
    this.gold += amount;
  }
}

// Usage example:
// const player = new Player(grid, 5, 5, 3);
// In draw loop: player.update(); player.render(tileSize, cols, rows);
