// Binary Min-Heap for efficient A* open set
class MinHeap {
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

/**
 * A* pathfinding with binary heap.
 * @param {Array} grid - 2D grid array
 * @param {Object} start - {x, y}
 * @param {Object} goal - {x, y}
 * @param {boolean} allowWater - if true, water tiles are walkable (for boats)
 * @param {Array} portCities - array of port city locations [{x,y},...] for land/water transition gating
 */
function aStar(grid, start, goal, allowWater = false, portCities = null) {
  const rows = grid.length;
  const cols = grid[0].length;

  const gScore = Array(rows).fill().map(() => Array(cols).fill(Infinity));
  const fScore = Array(rows).fill().map(() => Array(cols).fill(Infinity));
  const inClosed = Array(rows).fill().map(() => Array(cols).fill(false));
  const inOpen = Array(rows).fill().map(() => Array(cols).fill(false));
  const cameFrom = new Map();

  function heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  gScore[start.y][start.x] = 0;
  fScore[start.y][start.x] = heuristic(start, goal);

  const openSet = new MinHeap(n => fScore[n.y][n.x]);
  openSet.push(start);
  inOpen[start.y][start.x] = true;

  // Pre-compute port tile set for fast lookup
  let portTileSet = null;
  if (portCities && portCities.length > 0) {
    portTileSet = new Set();
    for (const pc of portCities) {
      // Mark tiles within 1 of each port city as valid transition points
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = pc.x + dx, py = pc.y + dy;
          if (px >= 0 && px < cols && py >= 0 && py < rows) {
            portTileSet.add(py * cols + px);
          }
        }
      }
    }
  }

  while (openSet.size > 0) {
    const current = openSet.pop();
    inOpen[current.y][current.x] = false;

    if (current.x === goal.x && current.y === goal.y) {
      const path = [];
      let c = current;
      let key = `${c.x},${c.y}`;
      while (cameFrom.has(key)) {
        path.unshift(c);
        c = cameFrom.get(key);
        key = `${c.x},${c.y}`;
      }
      return path;
    }

    inClosed[current.y][current.x] = true;

    const currentType = grid[current.y][current.x].options[0];

    for (const [dx, dy] of [[0,1],[1,0],[0,-1],[-1,0]]) {
      const nx = current.x + dx;
      const ny = current.y + dy;

      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (inClosed[ny][nx]) continue;

      const tile = grid[ny][nx];
      if (!tile) continue;

      const nextType = tile.options[0];

      // Water traversal rules
      if (nextType === 'Water' && !allowWater) continue;

      // Port-only land↔water transitions
      if (portTileSet && currentType !== nextType) {
        const isTransition = (currentType === 'Water' && nextType !== 'Water') ||
                             (currentType !== 'Water' && nextType === 'Water');
        if (isTransition) {
          // The LAND side of the transition must be near a port
          const landIdx = (nextType === 'Water')
            ? current.y * cols + current.x
            : ny * cols + nx;
          if (!portTileSet.has(landIdx)) continue;
        }
      }

      // Cost calculation
      const elevationCost = Math.abs(elevationMap[ny][nx] - elevationMap[current.y][current.x]) * 10;
      const baseTileCost = nextType === 'Water' ? 2 : (baseDiff[nextType] || 1);
      const tentativeG = gScore[current.y][current.x] + baseTileCost + (nextType === 'Water' ? 0 : elevationCost);

      if (tentativeG < gScore[ny][nx]) {
        cameFrom.set(`${nx},${ny}`, current);
        gScore[ny][nx] = tentativeG;
        fScore[ny][nx] = tentativeG + heuristic({ x: nx, y: ny }, goal);

        if (!inOpen[ny][nx]) {
          openSet.push({ x: nx, y: ny });
          inOpen[ny][nx] = true;
        }
      }
    }
  }

  return []; // No path found
}
