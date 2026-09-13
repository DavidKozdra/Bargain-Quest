(function initAStarLib(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createAStarApi() {
/**
 * Binary Min-Heap implementation for efficient priority queue operations.
 * Used by A* pathfinding to manage the open set of nodes to explore.
 * @private
 */
class MinHeap {
  /**
   * Creates a new MinHeap.
   * @param {Function} scoreFn - Function to extract score from heap items
   */
  constructor(scoreFn) {
    this.data = [];
    this.scoreFn = scoreFn;
  }
  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }
  get size() { return this.data.length; }
  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.scoreFn(this.data[i]) < this.scoreFn(this.data[parent])) {
        [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
        i = parent;
      } else break;
    }
  }
  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.scoreFn(this.data[l]) < this.scoreFn(this.data[smallest])) smallest = l;
      if (r < n && this.scoreFn(this.data[r]) < this.scoreFn(this.data[smallest])) smallest = r;
      if (smallest !== i) {
        [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
        i = smallest;
      } else break;
    }
  }
}

const DIRECTIONS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const PAGE_SHIFT = 5;
const PAGE_SIZE = 1 << PAGE_SHIFT;
const PAGE_MASK = PAGE_SIZE - 1;
const PAGE_CELLS = PAGE_SIZE * PAGE_SIZE;

/**
 * Incremental weighted A*. Each search owns lazily allocated 32x32 pages, so
 * searches can interleave without corrupting another search's score buffers.
 * Construction never allocates or clears buffers for the entire world.
 *
 * Call step(maxWork) until done, then consume result ([] means no route).
 * The budget includes port setup, stale heap entries, and route reconstruction.
 * It bounds algorithmic work, not wall-clock time. A scheduler can combine small
 * steps with a deadline. cancel() releases unfinished work without a callback.
 *
 * Keep grid/port topology stable for the search lifetime, or cancel and recreate.
 * options.elevationMap/baseDiff override the globals, captured at creation so a
 * suspended search never starts reading a different world's globals mid-route.
 */
function createPathSearch(grid, start, goal, allowWater = false, portCities = null, waterOnly = false, options = {}) {
  const rows = grid?.length || 0;
  const cols = grid?.[0]?.length || 0;
  const sx = start?.x, sy = start?.y, gx = goal?.x, gy = goal?.y;
  const elevations = options.elevationMap ?? (typeof elevationMap !== 'undefined' ? elevationMap : null);
  const terrainCosts = options.baseDiff ?? (typeof baseDiff !== 'undefined' ? baseDiff : {});
  const pageCols = Math.ceil(cols / PAGE_SIZE);
  const pages = new Map();
  const openSet = new MinHeap(node => node.f);
  const portTileSet = portCities ? new Set() : null;
  let phase = portCities?.length ? 'ports' : 'search';
  let portIndex = 0;
  let portOffset = 0;
  let cursor = -1;
  let reverseLeft = 0;
  let reverseRight = -1;
  const path = [];

  const search = {
    done: false,
    cancelled: false,
    result: null,
    expandedNodes: 0,
    processedWork: 0,
    get allocatedCells() { return pages.size * PAGE_CELLS; },
    step,
    cancel() {
      if (search.done) return;
      search.cancelled = true;
      finish([]);
    },
  };

  function finish(result) {
    search.done = true;
    search.result = result;
    if (result !== path) path.length = 0;
    pages.clear();
    openSet.data.length = 0;
    if (portTileSet) portTileSet.clear();
    return search.done;
  }

  function pageAt(x, y, create = false) {
    const key = (y >> PAGE_SHIFT) * pageCols + (x >> PAGE_SHIFT);
    let page = pages.get(key);
    if (!page && create) {
      page = {
        g: new Float64Array(PAGE_CELLS),
        f: new Float64Array(PAGE_CELLS),
        parent: new Int32Array(PAGE_CELLS),
        state: new Uint8Array(PAGE_CELLS), // 0 unseen, 1 open, 2 closed
      };
      pages.set(key, page);
    }
    return page;
  }

  function offsetAt(x, y) {
    return ((y & PAGE_MASK) << PAGE_SHIFT) | (x & PAGE_MASK);
  }

  function heuristic(x, y) {
    return (Math.abs(x - gx) + Math.abs(y - gy)) * 1.2;
  }

  function inBounds(x, y) {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < cols && y < rows;
  }

  if (!inBounds(sx, sy) || !inBounds(gx, gy) || !grid[sy]?.[sx] || !grid[gy]?.[gx] || (sx === gx && sy === gy)) {
    finish([]);
    return search;
  }
  const goalType = grid[gy][gx].options[0];
  if ((goalType === 'Water' && !allowWater) || (waterOnly && goalType !== 'Water')) {
    finish([]);
    return search;
  }

  const startPage = pageAt(sx, sy, true);
  const startOffset = offsetAt(sx, sy);
  startPage.state[startOffset] = 1;
  startPage.parent[startOffset] = -1;
  startPage.f[startOffset] = heuristic(sx, sy);
  openSet.push({ x: sx, y: sy, f: startPage.f[startOffset] });

  function step(maxWork = 256) {
    if (search.done) return true;
    let remaining = Number.isFinite(maxWork) ? Math.max(0, Math.floor(maxWork)) : (maxWork === Infinity ? Infinity : 0);
    while (remaining > 0 && !search.done) {
      remaining--;
      search.processedWork++;

      if (phase === 'ports') {
        const port = portCities[portIndex];
        const px = port.x + portOffset % 5 - 2;
        const py = port.y + Math.floor(portOffset / 5) - 2;
        if (px >= 0 && px < cols && py >= 0 && py < rows) portTileSet.add(py * cols + px);
        portOffset++;
        if (portOffset === 25) {
          portOffset = 0;
          portIndex++;
          if (portIndex === portCities.length) phase = 'search';
        }
        continue;
      }

      if (phase === 'reconstruct') {
        const x = cursor % cols, y = Math.floor(cursor / cols);
        const from = pageAt(x, y).parent[offsetAt(x, y)];
        if (from === -1) {
          phase = 'reverse';
          reverseRight = path.length - 1;
        } else {
          path.push({ x, y });
          cursor = from;
        }
        continue;
      }

      if (phase === 'reverse') {
        if (reverseLeft >= reverseRight) return finish(path);
        const left = path[reverseLeft];
        path[reverseLeft++] = path[reverseRight];
        path[reverseRight--] = left;
        continue;
      }

      if (openSet.size === 0) return finish([]);
      const current = openSet.pop();
      const currentPage = pageAt(current.x, current.y);
      const ci = offsetAt(current.x, current.y);
      // Scores are immutable on heap entries; improved nodes may leave stale
      // entries behind. Counting these pops also bounds unsuccessful work.
      if (currentPage.state[ci] === 2 || current.f !== currentPage.f[ci]) continue;
      if (current.x === gx && current.y === gy) {
        cursor = current.y * cols + current.x;
        phase = 'reconstruct';
        continue;
      }
      currentPage.state[ci] = 2;
      search.expandedNodes++;
      const currentType = grid[current.y][current.x].options[0];

      for (const [dx, dy] of DIRECTIONS) {
        const nx = current.x + dx, ny = current.y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        let nextPage = pageAt(nx, ny);
        const ni = offsetAt(nx, ny);
        if (nextPage?.state[ni] === 2) continue;
        const tile = grid[ny][nx];
        if (!tile) continue;
        const nextType = tile.options[0];
        if (nextType === 'Water' && !allowWater) continue;
        if (waterOnly && nextType !== 'Water') continue;

        if (portTileSet !== null && (currentType === 'Water') !== (nextType === 'Water')) {
          const landIdx = nextType === 'Water' ? current.y * cols + current.x : ny * cols + nx;
          if (!portTileSet.has(landIdx)) continue;
        }

        const elevationCost = Math.abs(elevations[ny][nx] - elevations[current.y][current.x]) * 3;
        const baseTileCost = nextType === 'Water' ? 2 : (terrainCosts[nextType] || 1);
        const tentativeG = currentPage.g[ci] + baseTileCost + (nextType === 'Water' ? 0 : elevationCost);
        const previousG = nextPage?.state[ni] ? nextPage.g[ni] : Infinity;
        if (tentativeG < previousG) {
          if (!nextPage) nextPage = pageAt(nx, ny, true);
          nextPage.state[ni] = 1;
          nextPage.parent[ni] = current.y * cols + current.x;
          nextPage.g[ni] = tentativeG;
          nextPage.f[ni] = tentativeG + heuristic(nx, ny);
          openSet.push({ x: nx, y: ny, f: nextPage.f[ni] });
        }
      }
    }
    return search.done;
  }

  return search;
}

/** Synchronous compatibility API with the same route and traversal rules. */
function aStar(grid, start, goal, allowWater = false, portCities = null, waterOnly = false) {
  const search = createPathSearch(grid, start, goal, allowWater, portCities, waterOnly);
  search.step(Infinity);
  return search.result;
}

return {
  MinHeap,
  aStar,
  createPathSearch,
};
});
