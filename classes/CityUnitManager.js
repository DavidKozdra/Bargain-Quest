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
  update(dt = 16) {
    for (const unit of this.units) {
      unit.update(dt);
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

  clear() {
    this.units.length = 0;
  }

  getById(id) {
    return this.units.find((u) => u.id === id) || null;
  }

  deselectAll() {
    for (const u of this.units) u.selected = false;
  }

  getSelected() {
    return this.units.find((u) => u.selected) || null;
  }

  selectById(id) {
    this.deselectAll();
    const u = this.getById(id);
    if (u) u.selected = true;
    return u;
  }

  toJSON() {
    return this.units.map((u) => (typeof u.toJSON === 'function' ? u.toJSON() : null)).filter(Boolean);
  }
}

if (typeof window !== 'undefined') window.CityUnitManager = CityUnitManager;
if (typeof module !== 'undefined') module.exports = CityUnitManager;
