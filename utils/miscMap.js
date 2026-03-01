
function findSafeNode() {
  // Spawn next to a random city so the player is never stranded
  if (cities && cities.length > 0) {
    const shuffledCities = [...cities].sort(() => Math.random() - 0.5);
    for (const city of shuffledCities) {
      const cx = city.location.x;
      const cy = city.location.y;
      // Check adjacent tiles (including diagonals)
      const offsets = [
        {x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},
        {x:1,y:1},{x:-1,y:-1},{x:1,y:-1},{x:-1,y:1}
      ];
      for (const off of offsets) {
        const nx = cx + off.x;
        const ny = cy + off.y;
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
          const tile = grid[ny][nx]?.options?.[0];
          if (tile && tile !== 'Water') {
            const isCity = cities.some(c => c.location.x === nx && c.location.y === ny);
            if (!isCity) return { x: nx, y: ny };
          }
        }
      }
    }
  }

  // Fallback: any non-water tile (shouldn't normally reach here)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tile = grid[y][x]?.options?.[0];
      if (tile && tile !== 'Water') return { x, y };
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

function findClosestCity(currentCity, cities) {
  let closest = null;
  let minDist = Infinity;

  for (const city of cities) {
    if (city === currentCity) continue;

    const dx = city.location.x - currentCity.location.x;
    const dy = city.location.y - currentCity.location.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < minDist) {
      minDist = dist;
      closest = city;
    }
  }

  return closest ? {
    name: closest.name,
    x: closest.location.x,
    y: closest.location.y,
    city: closest
  } : null;
}
