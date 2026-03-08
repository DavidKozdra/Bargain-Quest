(function initSpatialGridLib(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createSpatialGridApi() {
  class SpatialGrid {
    constructor(cellSize = 32) {
      this._cs = cellSize;
      this._cells = new Map();
    }

    _key(tx, ty) {
      return `${Math.floor(tx / this._cs)},${Math.floor(ty / this._cs)}`;
    }

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

    move(entity, newTx, newTy) {
      const newKey = this._key(newTx, newTy);
      if (entity._sgKey === newKey) return;
      this.remove(entity);
      this.insert(entity, newTx, newTy);
    }

    queryViewport(viewportBounds) {
      const cs = this._cs;
      const vp = viewportBounds || {
        minX: typeof _vpMinX !== "undefined" ? _vpMinX : 0,
        maxX: typeof _vpMaxX !== "undefined" ? _vpMaxX : 0,
        minY: typeof _vpMinY !== "undefined" ? _vpMinY : 0,
        maxY: typeof _vpMaxY !== "undefined" ? _vpMaxY : 0,
        tileSize: typeof tileSize !== "undefined" ? tileSize : 1,
      };

      const minCX = Math.floor((vp.minX / vp.tileSize) / cs);
      const maxCX = Math.floor((vp.maxX / vp.tileSize) / cs);
      const minCY = Math.floor((vp.minY / vp.tileSize) / cs);
      const maxCY = Math.floor((vp.maxY / vp.tileSize) / cs);

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

    clear() {
      this._cells.clear();
    }
  }

  return { SpatialGrid };
});
