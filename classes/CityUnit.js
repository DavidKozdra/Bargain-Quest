// CityUnit.js — Represents a controllable unit spawned by a city

class CityUnit {
  /**
   * @param {Object} opts - Options for the unit
   * @param {Object} opts.city - The city that spawned this unit
   * @param {Object} opts.location - { x, y } spawn location
   * @param {string} [opts.name] - Optional unit name
   */
  constructor(opts = {}) {
    this.city = opts.city;
    this.x = opts.location?.x || 0;
    this.y = opts.location?.y || 0;
    this.name = opts.name || `Unit #${Math.floor(Math.random() * 10000)}`;
    this.hp = 10;
    this.maxHp = 10;
    this.attack = 2;
    this.defense = 1;
    this.state = 'idle'; // idle, moving, fighting
    this.target = null; // {x, y} or enemy
    this.selected = false;
  }

  /** Move to a target location */
  moveTo(x, y) {
    this.target = { x, y };
    this.state = 'moving';
  }

  /** Called every frame/tick */
  update() {
    // Simple movement logic (replace with pathfinding as needed)
    if (this.state === 'moving' && this.target) {
      if (this.x !== this.target.x) this.x += Math.sign(this.target.x - this.x);
      else if (this.y !== this.target.y) this.y += Math.sign(this.target.y - this.y);
      if (this.x === this.target.x && this.y === this.target.y) {
        this.state = 'idle';
        this.target = null;
      }
    }
    // ...combat and other logic...
  }

  /** Render the unit (placeholder) */
  render(tileSize = 32) {
    // Implement drawing logic using your rendering system
    // Example: draw a colored square or sprite at (this.x, this.y)
  }
}

// Export for use in other modules
if (typeof module !== 'undefined') module.exports = CityUnit;
