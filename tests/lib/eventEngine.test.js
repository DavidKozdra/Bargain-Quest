const eventEngine = require("../../Koz_Engine_Lib/events/eventEngine");

describe("Koz_Engine_Lib/events/eventEngine", () => {
  test("filters eligible events by context", () => {
    const events = [
      { name: "A", minDay: 5, terrain: ["Grass"], season: ["Summer"] },
      { name: "B", minDay: 1, terrain: ["Grass"], season: ["Winter"] },
    ];
    const eligible = eventEngine.filterEligibleEvents(events, { day: 10, terrain: "Grass", season: "Summer" });
    expect(eligible.map((e) => e.name)).toEqual(["A"]);
  });

  test("appends history with max length", () => {
    const out = eventEngine.appendHistory([{ id: 1 }, { id: 2 }], { id: 3 }, 2);
    expect(out).toEqual([{ id: 2 }, { id: 3 }]);
  });
});
