const { SeededRNG, SeededStream, namedRandom } = require("../../Koz_Engine_Lib/utils/seededRng");

describe("Koz_Engine_Lib/utils/seededRng", () => {
  test("replays named streams deterministically across runs", () => {
    SeededRNG.startRun(12345, { installGlobalMathRandom: false });
    const firstRun = [
      SeededRNG.stream("terrain").random(),
      SeededRNG.stream("terrain").random(),
      SeededRNG.stream("trader").random(),
    ];

    const snapshot = SeededRNG.getState();

    SeededRNG.startRun(12345, { installGlobalMathRandom: false });
    const replayRun = [
      SeededRNG.stream("terrain").random(),
      SeededRNG.stream("terrain").random(),
      SeededRNG.stream("trader").random(),
    ];

    expect(replayRun).toEqual(firstRun);

    SeededRNG.setState(snapshot);
    expect(SeededRNG.stream("terrain").random()).toBeGreaterThanOrEqual(0);
    expect(SeededRNG.stream("terrain").random()).toBeLessThan(1);
  });

  test("supports stream helpers without mutating the input array", () => {
    const stream = new SeededStream(99);
    const values = ["a", "b", "c", "d"];
    const shuffled = stream.shuffle(values);

    expect(values).toEqual(["a", "b", "c", "d"]);
    expect(shuffled).toHaveLength(values.length);
    expect(stream.int(2, 4)).toBeGreaterThanOrEqual(2);
    expect(stream.int(2, 4)).toBeLessThanOrEqual(4);
    expect(typeof stream.chance(0.5)).toBe("boolean");
  });

  test("falls back safely when namedRandom receives no runtime", () => {
    const value = namedRandom(null, "missing");
    expect(typeof value).toBe("number");
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});
