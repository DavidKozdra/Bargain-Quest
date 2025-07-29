class City {
  constructor({ name, location, population }) {
    this.name = name;
    this.location = location; // { x: col, y: row } in tile grid
    this.population = population;
    this.inventory = new Map(); // future: itemName -> { item, quantity }
    this.holidays = [];
    this.traders = {};
    this.reputation = {};
  }

  /**
   * Draw the city as a big brown circle at its location in the terrain.
   * Assumes p5.js WebGL mode.
   */
render(tileSize, maxHeight) {
  const { x, y } = this.location;
  const posX = x * tileSize;
  const posZ = y * tileSize;
  const elevation = elevationMap[y][x] * maxHeight;

  push();
  translate(-cols * tileSize / 2, 0, -rows * tileSize / 2); // center map
  translate(posX + tileSize / 2, elevation + 5, posZ + tileSize / 2); // above terrain

  fill(148, 94, 73); // city color
  noStroke();

  // Draw city as flat circle in 3D space
  rotateX(-HALF_PI);
  ellipse(0, 0, tileSize * 0.8, tileSize * 0.8);

  pop();

    push();
    translate(0, 20, 0); // lift text
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(10);
    text(this.name, 0, 0);
    pop();

}


  /**
   * Generate a list of cities randomly placed on valid terrain (non-Water).
   * @param {Array} grid - Grid with biome types assigned.
   * @param {number} count - Number of cities to generate.
   * @param {Array<string>} namePool - Names to assign to cities.
   * @returns {Array<City>} - Generated cities.
   */
  static generateCities(grid, count, namePool) {

    const validTiles = [];

    // Collect valid (non-water) tiles
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        console.log(grid)
        const type = grid[i][j].options[0];
        if (type !== 'Water') {
          validTiles.push({ x: j, y: i });
        }
      }
    }

    // Shuffle valid tiles randomly
    for (let i = validTiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [validTiles[i], validTiles[j]] = [validTiles[j], validTiles[i]];
    }

    const cities = [];
    const usedNames = new Set();

    for (let i = 0; i < count && i < validTiles.length; i++) {
      const { x, y } = validTiles[i];

      // Pick a unique name
      let name;
      do {
        name = namePool[Math.floor(Math.random() * namePool.length)];
      } while (usedNames.has(name));
      usedNames.add(name);

      const population = Math.floor(random(300, 1200));

      cities.push(new City({
        name,
        location: { x, y },
        population
      }));
    }

    return cities;
  }
}


class NameGenerator {
  static generateNames(min = 50, max = 100) {
    const prefixes = [
      // Geography/Nature
      "Bald", "Bank", "Belle", "Box", "Bridge", "Camp", "Cannon", "Castle", "Clear", "Day", "East",
      "Edge", "Ever", "Fern", "Forest", "Fresh", "Great", "King", "Knob", "Knox", "Mount", "Morning",
      "New", "North", "Pacific", "Queens", "Red", "Ridge", "Ring", "River", "Rose", "Sand",
      "South", "Spring", "Strath", "Stock", "Stoke", "Stone", "Water", "Well", "West", "Wood",

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
      "view", "village", "ville", "water", "well", "wharf", "wick", "wood", "worth"
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
