
function findSafeNode() {
  const shuffled = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      shuffled.push({ x, y });
    }
  }

  // Shuffle to randomize search
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  for (const { x, y } of shuffled) {
    const tileType = grid[y][x]?.options?.[0];
    const isWater = tileType === "Water";
    const isCity = cities?.some(city => city.location.x === x && city.location.y === y);

    if (!isWater && !isCity) {
      return { x, y };
    }
  }

  console.warn("No safe node found.");
  return null;
}

function findNearestSafeTile(startX, startY, cityList) {
  const queue = [{ x: startX, y: startY }];
  const visited = new Set();

  const key = (x, y) => `${x},${y}`;
  visited.add(key(startX, startY));

  while (queue.length > 0) {
    const { x, y } = queue.shift();
    const tile = grid[y]?.[x];
    if (!tile) continue;

    const tileType = tile.options[0];
    const isCity = cityList.some(city => city.location.x === x && city.location.y === y);

    if (tileType !== 'Water' && !isCity) {
      return { x, y };
    }

    for (const [dx, dy] of [[0,1], [1,0], [0,-1], [-1,0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (
        nx >= 0 && nx < cols &&
        ny >= 0 && ny < rows &&
        !visited.has(key(nx, ny))
      ) {
        visited.add(key(nx, ny));
        queue.push({ x: nx, y: ny });
      }
    }
  }

  console.warn("No safe tile found near", startX, startY);
  return null;
}
