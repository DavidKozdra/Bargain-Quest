const { calculateItemValue, ItemRegistry } = require("../../Koz_Engine_Lib/items/itemFactory");

describe("Koz_Engine_Lib/items/itemFactory", () => {
  test("calculateItemValue applies multipliers", () => {
    const value = calculateItemValue(
      { baseValue: 10, rarity: 2, seasonality: ["Winter"] },
      { season: "Winter", demandFactor: 1.5, supplyFactor: 1, distanceFactor: 1, holidayDemandBoost: 1 },
      5000
    );
    expect(value).toBe(38);
  });

  test("registry supports key lookups and category filters", () => {
    const reg = new ItemRegistry({
      A: { category: "Food", tags: new Set(["x"]) },
      B: { category: "Tool", tags: new Set(["y"]) },
    });
    expect(reg.has("A")).toBe(true);
    expect(reg.byCategory("Food").length).toBe(1);
    expect(reg.byTag("x").length).toBe(1);
  });
});
