// CityUnitManager.js — Manages all city-spawned units

class CityUnitManager {
  constructor() {
    this.units = [];
  }

  /** Add a new unit */
  add(unit) {
    this.units.push(unit);
  }

  /** Update all units */
  update() {
    for (const unit of this.units) {
      unit.update();
    }
  }

  /** Render all units */
  render(tileSize = 32) {
    for (const unit of this.units) {
      unit.render(tileSize);
    }
  }

  /** Get units at a specific location */
  getUnitsAt(x, y) {
    return this.units.filter(u => u.x === x && u.y === y);
  }

  /** Remove a unit */
  remove(unit) {
    const idx = this.units.indexOf(unit);
    if (idx !== -1) this.units.splice(idx, 1);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined') module.exports = CityUnitManager;
