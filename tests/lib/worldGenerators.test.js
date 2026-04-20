const {
  BIOME_NAMES,
  createField,
  smoothField,
  normalizeField,
  classifyField,
  buildWorldCells,
  normalizeWorldGenConfig,
  generateTerrainFields,
  generateBiomeGrid,
  buildWorldGridFromTerrain,
  DEFAULT_BASE_DIFF,
} = require("../../Koz_Engine_Lib/World/worldGenerators");

describe("Koz_Engine_Lib/World/worldGenerators", () => {
  test("builds and classifies scalar fields", () => {
    const field = createField(3, 2, (x, y) => x + y);
    const normalized = normalizeField(field);
    const cells = classifyField(normalized, (value) => value >= 0.5 ? "Land" : "Water");

    expect(field[1][2]).toBe(3);
    expect(normalized[0][0]).toBe(0);
    expect(cells[1][2]).toBe("Land");
  });

  test("supports smoothing and one-pass terrain classification", () => {
    const smoothed = smoothField([[0, 1, 0], [1, 1, 1], [0, 1, 0]], 1);
    const cells = buildWorldCells(2, 2, {
      sample: (x, y) => x + y,
      smoothingPasses: 0,
      classify: (value) => value > 0.5 ? "High" : "Low",
    });

    expect(smoothed[0][0]).toBeGreaterThan(smoothed[1][1]);
    expect(cells).toEqual([
      ["Low", "Low"],
      ["Low", "High"],
    ]);
  });

  test("normalizes world generation config bounds", () => {
    expect(normalizeWorldGenConfig({
      warp: -2,
      ruggedness: 8,
      temperatureVariance: "bad",
      moistureVariance: 1.25,
      coastalDropoff: 99,
    })).toEqual({
      warp: 0,
      ruggedness: 2,
      temperatureVariance: 1,
      moistureVariance: 1.25,
      coastalDropoff: 2.2,
    });
  });

  test("generates deterministic terrain fields for matching inputs", () => {
    const options = {
      cols: 24,
      rows: 18,
      seed: 123456,
      landmassMode: 1,
      worldGenConfig: {
        warp: 1.2,
        ruggedness: 0.9,
        temperatureVariance: 1.4,
        moistureVariance: 0.8,
        coastalDropoff: 1.1,
      },
    };

    const a = generateTerrainFields(options);
    const b = generateTerrainFields(options);
    const grid = generateBiomeGrid(options);

    expect(Array.from(a.biomeFlat)).toEqual(Array.from(b.biomeFlat));
    expect(Array.from(a.elevationFlat)).toEqual(Array.from(b.elevationFlat));
    expect(grid.flat()).toEqual(Array.from(a.biomeFlat, idx => BIOME_NAMES[idx]));
    expect(new Set(grid.flat()).size).toBeGreaterThan(1);
  });

  test("changes biome output when landmass mode changes", () => {
    const baseOptions = {
      cols: 32,
      rows: 20,
      seed: 424242,
      worldGenConfig: {
        warp: 1,
        ruggedness: 1,
        temperatureVariance: 1,
        moistureVariance: 1,
        coastalDropoff: 1,
      },
    };

    const islands = generateTerrainFields({ ...baseOptions, landmassMode: 0 });
    const continents = generateTerrainFields({ ...baseOptions, landmassMode: 2 });

    expect(Array.from(islands.biomeFlat)).not.toEqual(Array.from(continents.biomeFlat));
  });

  test("builds full world maps from terrain with overrides and difficulty", () => {
    const terrain = generateTerrainFields({
      cols: 12,
      rows: 10,
      seed: 777,
      landmassMode: 1,
      worldGenConfig: {
        warp: 1,
        ruggedness: 1,
        temperatureVariance: 1,
        moistureVariance: 1,
        coastalDropoff: 1,
      },
    });

    const world = buildWorldGridFromTerrain({
      terrain,
      decorRng: () => 0.99,
      resolveBiome: ({ baseBiome }) => (baseBiome === "Water" ? "Rock" : baseBiome),
    });

    expect(world.grid).toHaveLength(10);
    expect(world.grid[0]).toHaveLength(12);
    expect(world.elevationMap).toHaveLength(10);
    expect(world.temperatureMap).toHaveLength(10);
    expect(world.difficultyMap).toHaveLength(10);
    expect(world.grid.flat().some((cell) => cell.options[0] === "Water")).toBe(false);

    const sampleX = 3;
    const sampleY = 4;
    const elevation = world.elevationMap[sampleY][sampleX];
    const biome = world.grid[sampleY][sampleX].options[0];
    expect(world.difficultyMap[sampleY][sampleX]).toBeCloseTo((DEFAULT_BASE_DIFF[biome] || 0) + elevation * 5, 5);
  });
});
