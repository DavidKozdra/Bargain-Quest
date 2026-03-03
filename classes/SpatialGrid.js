// SpatialGrid.js — Spatial hash grid for O(viewport) entity iteration
//
// Divides the world into coarse cells (cellSize × cellSize tiles).
// Entities register with insert(), notify the grid on movement with move(),
// and are removed with remove(). queryViewport() returns only entities whose
// cells overlap the current visible viewport — using the _vpMinX/MaxX/Y
// globals cached once per frame by _updateViewportBounds() in game.js.

class SpatialGrid {
  /**
   * @param {number} cellSize  Width/height of each grid cell in TILES.
   *                           Larger = fewer cells but more entities per query.
   *                           Default 32 tiles ≈ 1024px at tileSize 32.
   */
  constructor(cellSize = 32) {
    this._cs = cellSize;      // cell size in tiles
    this._cells = new Map();  // "cx,cy" -> Set of entities
  }

  /** @private  Map key for the cell that contains tile position (tx, ty) */
  _key(tx, ty) {
    return `${Math.floor(tx / this._cs)},${Math.floor(ty / this._cs)}`;
  }

  /**
   * Register an entity at tile position (tx, ty).
   * Caches the cell key on entity._sgKey for O(1) removal later.
   */
  insert(entity, tx, ty) {
    const key = this._key(tx, ty);
    let cell = this._cells.get(key);
    if (!cell) {
      cell = new Set();
      this._cells.set(key, cell);
    }
    cell.add(entity);
    entity._sgKey = key;
  }

  /**
   * Remove an entity from its current cell (uses entity._sgKey).
   * Safe to call if the entity was never inserted.
   */
  remove(entity) {
    const key = entity._sgKey;
    if (key == null) return;
    const cell = this._cells.get(key);
    if (cell) {
      cell.delete(entity);
      if (cell.size === 0) this._cells.delete(key);
    }
    entity._sgKey = null;
  }

  /**
   * Update an entity's cell after it moves to tile (newTx, newTy).
   * No-op when the entity stays in the same cell — safe to call every step.
   */
  move(entity, newTx, newTy) {
    const newKey = this._key(newTx, newTy);
    if (entity._sgKey === newKey) return; // still in same cell, nothing to do
    this.remove(entity);
    this.insert(entity, newTx, newTy);
  }

  /**
   * Return all entities in cells that overlap the visible viewport.
   * Reads the _vpMinX/MaxX/Y world-pixel globals from game.js (updated
   * once per frame by _updateViewportBounds()) and the global tileSize.
   *
   * @returns {Array} Flat array of entities whose cells are on-screen.
   */
  queryViewport() {
    const cs = this._cs;
    // World-pixel VP bounds → tile space → cell space
    const minCX = Math.floor((_vpMinX / tileSize) / cs);
    const maxCX = Math.floor((_vpMaxX / tileSize) / cs);
    const minCY = Math.floor((_vpMinY / tileSize) / cs);
    const maxCY = Math.floor((_vpMaxY / tileSize) / cs);

    const result = [];
    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const cell = this._cells.get(`${cx},${cy}`);
        if (cell) {
          for (const e of cell) result.push(e);
        }
      }
    }
    return result;
  }

  /** Remove all entries. Call on world reset before re-populating. */
  clear() {
    this._cells.clear();
  }
}
