class City {
constructor({ name, location, population }) {
  this.name = name;
  this.location = location;
  this.population = population;
  this.inventory = new Map();
  this.holidays = [];
  this.traders = {};
  this.reputation = {};
  this.indicators = [];

  // Precompute 3D structure
  this.buildings = [];
  const numBuildings = 3 + floor(random(3));
  for (let i = 0; i < numBuildings; i++) {
    this.buildings.push({
      x: random(-tileSize / 4, tileSize / 4),
      z: random(-tileSize / 4, tileSize / 4),
      w: random(5, 10),
      d: random(5, 10),
      h: random(20, 60),
      color: [160 + i * 20, 140, 200 - i * 15]
    });
  }

  this.generateHolidays()
  window.addEventListener("dayChanged", (e) => {
    const prev = this.population;
    this.growPopulation();
    this.restockInventory();
    const delta = this.population - prev;
    const symbol = delta > 0 ? "+" : delta < 0 ? "-" : "=";
    this.spawnIndicator(symbol);
  });
this._addOrIncrement("Wheat", Math.floor(random(5, 40)));
this._addOrIncrement("Fish", Math.floor(random(0, 20)));

}


isHolidayForItem(itemName, currentDay) {
  const seasonIndex = Math.floor(currentDay % 100 / 25); // 100 days/year, 25 days/season
  const currentSeason = ["Winter", "Spring", "Summer", "Fall"][seasonIndex];

  return this.holidays.some(holiday =>
    holiday.item === itemName &&
    holiday.day === currentDay &&
    holiday.season === currentSeason
  );
}

generateHolidays() {
  const itemKeys = Object.keys(ItemLibrary);
  const holidayCount = floor(random(0, 11)); // 0 to 10 holidays

  for (let i = 0; i < holidayCount; i++) {
    const itemKey = random(itemKeys);
    const day = floor(random(0, 100));
    const seasonIndex = floor(day / (100 / 4));
    const season = ["Winter", "Spring", "Summer", "Fall"][seasonIndex];

    this.holidays.push({
      name: `${ItemLibrary[itemKey].name} Festival`,
      item: itemKey,
      day: day,
      season: season
    });
  }
}


growPopulation() {
  const currentPop = this.population;
  const foodItems = ["Wheat", "Fish"];
  let foodQty = 0;

  for (let item of foodItems) {
    const entry = this.inventory.get(item);
    if (entry) foodQty += entry.quantity;
  }

  const goldEstimate = this.inventory.get("Gold")?.quantity || 0;
  const foodFactor = Math.min(foodQty / currentPop, 1);
  const goldFactor = Math.min(goldEstimate / 1000, 1);
  const overpopPenalty = 1 / (1 + currentPop / 1000);

  const baseGrowth = 0.001;
  const maxBonus = 0.004;
  const growthRate = baseGrowth + maxBonus * foodFactor * goldFactor * overpopPenalty;

  const newPop = Math.floor(currentPop * (1 + growthRate));
  const popIncrease = newPop - currentPop;
  this.population = newPop;

  // Consume food: 1 unit per 2 people
  const foodToConsume = Math.floor(popIncrease / 2);
  this._consumeFood(foodToConsume);
}
_consumeFood(amount) {
  const foodItems = ["Wheat", "Fish"];
  let remaining = amount;

  for (let item of foodItems) {
    const entry = this.inventory.get(item);
    if (entry && remaining > 0) {
      const consumed = Math.min(remaining, entry.quantity);
      entry.quantity -= consumed;
      if (entry.quantity <= 0) this.inventory.delete(item);
      remaining -= consumed;
    }
  }
}


  restockInventory() {
    const { x, y } = this.location;
    const terrainCounts = { Water: 0, Grass: 0, Rock: 0, Sand: 0 };

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
          const tile = grid[ny][nx];
          const type = tile.options[0];
          if (terrainCounts[type] !== undefined) {
            terrainCounts[type]++;
          }
        }
      }
    }

    if (terrainCounts.Rock > 0 && Math.random() < 0.7) {
      this._addOrIncrement("Iron", terrainCounts.Rock);
    }
    if (terrainCounts.Grass > 0 && Math.random() < 0.8) {
      this._addOrIncrement("Wheat", terrainCounts.Grass);
    }
    if (terrainCounts.Water > 0 && Math.random() < 0.8) {
      this._addOrIncrement("Fish", terrainCounts.Water);
    }
    if (terrainCounts.Sand > 0 && Math.random() < 0.5) {
      this._addOrIncrement("Clay", terrainCounts.Sand);
    }
  }

  _addOrIncrement(itemKey, amount = 1) {
    if (!ItemLibrary[itemKey]) return;
    if (this.inventory.has(itemKey)) {
      this.inventory.get(itemKey).quantity += amount;
    } else {
      this.inventory.set(itemKey, {
        item: ItemLibrary[itemKey],
        quantity: amount
      });
    }
  }

  spawnIndicator(symbol) {
    this.indicators.push({
      symbol,
      age: 0,
      yOffset: 0
    });
  }

render(tileSize, maxHeight) {
  const { x, y } = this.location;
  const posX = x * tileSize;
  const posZ = y * tileSize;
  const elevation = elevationMap[y][x] * maxHeight;

  push();
  translate(-cols * tileSize / 2, 0, -rows * tileSize / 2);
  translate(posX + tileSize / 2, elevation, posZ + tileSize / 2);

  // Base platform
  fill(100, 100, 120);
  box(tileSize * 0.8, 4, tileSize * 0.8);

  // Render stored buildings
  for (let b of this.buildings) {
    push();
    translate(b.x, b.h / 2 + 2, b.z);
    ambientMaterial(...b.color);
    box(b.w, b.h, b.d);
    pop();
  }

  // Central dome/spire
  push();
  const domeHeight = 20;
  translate(0, domeHeight / 2 + 4, 0);
  ambientMaterial(255, 215, 0);
  cone(tileSize * 0.15, domeHeight);
  pop();

  pop();

  // Indicators (unchanged)
  for (let indicator of this.indicators) {
    indicator.age++;
    indicator.yOffset += 0.2;

    push();
    translate(-cols * tileSize / 2, 0, -rows * tileSize / 2);
    translate(
      posX + tileSize / 2,
      elevation + 50 + indicator.yOffset,
      posZ + tileSize / 2
    );

    rotateX(-HALF_PI);
    noFill();
    strokeWeight(2);

    if (indicator.symbol === "+") {
      stroke(0, 255, 0);
      line(-4, 0, 4, 0);
      line(0, -4, 0, 4);
    } else if (indicator.symbol === "-") {
      stroke(255, 0, 0);
      line(-4, 0, 4, 0);
    } else {
      stroke(255);
      line(-4, 0, 4, 0);
      line(-4, 3, 4, 3);
    }

    pop();
  }

  this.indicators = this.indicators.filter(i => i.age < 60);
}



  static generateCities(grid, count, namePool) {
    const validTiles = [];
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const type = grid[i][j].options[0];
        if (type !== 'Water') validTiles.push({ x: j, y: i });
      }
    }

    for (let i = validTiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [validTiles[i], validTiles[j]] = [validTiles[j], validTiles[i]];
    }

    const cities = [];
    const usedNames = new Set();

    for (let i = 0; i < count && i < validTiles.length; i++) {
      const { x, y } = validTiles[i];
      let name;
      do {
        name = namePool[Math.floor(Math.random() * namePool.length)];
      } while (usedNames.has(name));
      usedNames.add(name);

      const population = Math.floor(random(300, 1200));
      cities.push(new City({ name, location: { x, y }, population }));
    }

    return cities;
  }

  addInventoryBasedOnTerrain(grid, radius = 1) {
    const { x, y } = this.location;
    const counts = { Water: 0, Grass: 0, Rock: 0, Sand: 0 , Forest: 0, Snow:0 };

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
          const tile = grid[ny][nx];
          if (!tile || !tile.options) continue;
          const type = tile.options[0];
          console.log(type)
          if (counts[type] !== undefined) {
            counts[type]++;
          }
        }
      }
    }
    console.log(counts)
    if (counts.Rock > 0) {
      this.inventory.set("Iron", {
        item: ItemLibrary.Iron,
        quantity: counts.Rock * 2
      });
    }

    if (counts.Grass > 0) {
      this.inventory.set("Wheat", {
        item: ItemLibrary.Wheat,
        quantity: counts.Grass * 3
      });
    }

    if (counts.Sand > 0) {
      this.inventory.set("Clay", {
        item: ItemLibrary.Clay,
        quantity: counts.Sand * 3
      });
    }

    if (counts.Water > 0) {
      this.inventory.set("Fish", {
        item: ItemLibrary.Fish,
        quantity: counts.Water * 4
      });
    }

    if (counts.Forest > 0) {
      this.inventory.set("Iron", {
        item: ItemLibrary.Iron,
        quantity: counts.Forest * 4
      });

      console.log(this.inventory, "Forrest should give iron")
    }
       if (counts.Snow > 0) {
      this.inventory.set("Fish", {
        item: ItemLibrary.Fish,
        quantity: counts.Snow * 4
      });
    
  }
  }
calculateItemPrice(itemName, allCities, isSelling = false) {
  const basePrice = this.getBasePrice(itemName);
  const inv = this.inventory.get(itemName);
  const localQty = inv ? inv.quantity : 0;
  const demand = this.population / (localQty + 1);

  // Nearby cities within radius
  const nearbyCities = allCities.filter(c => {
    if (c === this) return false;
    const dx = c.location.x - this.location.x;
    const dy = c.location.y - this.location.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist <= 25;
  });

  let totalQty = 0;
  let totalPop = 0;
  for (let city of nearbyCities) {
    const item = city.inventory.get(itemName);
    if (item) {
      totalQty += item.quantity;
      totalPop += city.population;
    }
  }

  const regionalDemand = totalPop / (totalQty + 1);
  const marketPressure = regionalDemand / demand;

  let finalPrice = basePrice + demand * 0.5 + marketPressure * 2;

  // 🔻 Penalize if city has low/no supply but neighbors have a lot
  const hasLowLocalSupply = localQty < 3;
  const regionalAbundance = totalQty > totalPop / 5; // crude abundance ratio
  if (hasLowLocalSupply && regionalAbundance) {
    finalPrice *= 0.75; // reduce price by 25% due to easy regional availability
  }

  // 🎉 Holiday price boost
  const today = dayNight.getDaysElapsed();
  if (this.isHolidayForItem(itemName, today)) {
    finalPrice *= 1.5;
  }

  finalPrice = Math.floor(finalPrice);

  // 💱 Selling prices are always lower
  if (isSelling) {
    finalPrice = Math.floor(finalPrice * 0.8);
  }

  return finalPrice;
}


  getBasePrice(itemName) {
    const lib = ItemLibrary[itemName];
    return lib?.basePrice ?? 10;
  }
}



class NameGenerator {
  static generateNames(min = 50, max = 100) {
    const prefixes = [
      // Geography/Nature
      "Bald", "Bank", "Belle", "Box", "Bridge", "Camp", "Cannon", "Castle", "Clear", "Day", "East",
      "Edge", "Ever", "Fern", "Forest", "Fresh", "Great", "King", "Knob", "Knox", "Mount", "Morning",
      "New", "North", "Pacific", "Queens", "Red", "Ridge", "Ring", "River", "Rose", "Sand",
      "South", "Spring", "Strath", "Stock", "Stoke", "Stone", "Water", "Well", "West", "Wood", "Kiah",

      // Animals
      "Bear", "Bee", "Bird", "Crane", "Crow", "Eagle", "Fox", "Moose", "Owl", "Swan", "Wolf",

      // Occupations
      "Baker", "Gillmen", "WaveMan", "Swoard",

      // Colours
      "Black", "Blue", "Brown", "Copper", "Gold", "Green", "Grey", "Hazel", "Orange",
      "Plum", "Red", "Silver", "White", "Yellow",

      // Names
      "Alexandra", "Brad", "Carole", "Clare", "Cooper", "Craig", "Elizabeth", "Erin",
      "Evan", "Glen", "Kirk", "Lea", "Mary", "Scott",

      // Minerals & Woods
      "Copper", "Diamond", "Gold", "Iron", "Lime", "Marble", "Pumice", "Sandstone", "Silver", "Slate",
      "Ash", "Cedar", "Cherry", "Elm", "Maple", "Oak", "Pine", "Willow",

    ];

    const suffixes = [
      "bank", "bark", "barrow", "bay", "beach", "bell", "borough", "bourne", "broad", "bridge",
      "brook", "brough", "burgh", "burn", "bury", "by", "canyon", "caster", "chester", "cliffe",
      "combe", "cot", "cott", "cote", "cove", "creek", "croft", "crook", "dale", "den", "din",
      "dine", "don", "downs", "falls", "field", "fin", "flats", "ford", "fork", "gate", "grove",
      "gum", "ham", "harbour", "heights", "hill", "holm", "hurst", "ing", "kirk", "land", "lake",
      "latch", "lea", "leigh", "ley", "marsh", "mere", "minster", "mond", "mont", "more", "ness",
      "park", "pilly", "pine", "point", "pond", "ridge", "river", "rock", "sett", "side", "son",
      "stead", "stoke", "stone", "stow", "terrace", "thorpe", "ton", "tor", "town", "vale", "valley",
      "view", "village", "ville", "water", "well", "wharf", "wick", "wood", "worth", "Romea",
    ];

    const names = new Set();
    const total = Math.floor(Math.random() * (max - min + 1)) + min;

    while (names.size < total) {
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      const name = prefix + suffix.charAt(0).toUpperCase() + suffix.slice(1);
      names.add(name);
    }

    return [...names];
  }
}
