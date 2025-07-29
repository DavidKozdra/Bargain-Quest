function aStar(grid, start, goal) {
  const rows = grid.length;
  const cols = grid[0].length;

  const openSet = [start];
  const cameFrom = new Map();

  const gScore = Array(rows).fill().map(() => Array(cols).fill(Infinity));
  const fScore = Array(rows).fill().map(() => Array(cols).fill(Infinity));

  gScore[start.y][start.x] = 0;
  fScore[start.y][start.x] = heuristic(start, goal);

  function heuristic(a, b) {
    return abs(a.x - b.x) + abs(a.y - b.y); // Manhattan distance
  }

  while (openSet.length > 0) {
    // Get node with lowest fScore
    openSet.sort((a, b) => fScore[a.y][a.x] - fScore[b.y][b.x]);
    var current = openSet.shift();

    if (current.x === goal.x && current.y === goal.y) {
      // Reconstruct path
      const path = [];
      let currKey = `${current.x},${current.y}`;
      while (cameFrom.has(currKey)) {
        path.unshift(current);
        current = cameFrom.get(currKey);
        currKey = `${current.x},${current.y}`;
      }
      return path;
    }

    for (const [dx, dy] of [
      [0, 1], [1, 0], [0, -1], [-1, 0]
    ]) {
      const nx = current.x + dx;
      const ny = current.y + dy;

      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;

      const tile = grid[ny][nx];
        if (!tile || tile.options[0] === 'Water') continue;
    const elevationCost = abs(elevationMap[ny][nx] - elevationMap[current.y][current.x]) * 10;
    const baseTileCost = baseDiff[grid[ny][nx].options[0]] || 1;
    const tentativeG = gScore[current.y][current.x] + baseTileCost + elevationCost;

      if (tentativeG < gScore[ny][nx]) {
        cameFrom.set(`${nx},${ny}`, current);
        gScore[ny][nx] = tentativeG;
        fScore[ny][nx] = tentativeG + heuristic({ x: nx, y: ny }, goal);

        if (!openSet.some(n => n.x === nx && n.y === ny)) {
          openSet.push({ x: nx, y: ny });
        }
      }
    }
  }

  return []; // No path found
}
