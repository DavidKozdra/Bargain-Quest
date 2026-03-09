const {
  quantizeVolume,
  computePositionalVolume,
  buildRepeatedSources,
  createSoundRegistry,
} = require("../../Koz_Engine_Lib/Audio/soundRegistry");

describe("Koz_Engine_Lib/Audio/soundRegistry", () => {
  test("computes and quantizes positional volume", () => {
    expect(computePositionalVolume(0, 100)).toBe(1);
    expect(computePositionalVolume(100, 100)).toBe(0);
    expect(quantizeVolume(0.53, 20)).toBe(0.55);
  });

  test("builds repeated sources and registry entries", () => {
    expect(buildRepeatedSources("audio/hit.ogg", 3)).toEqual([
      "audio/hit.ogg",
      "audio/hit.ogg",
      "audio/hit.ogg",
    ]);

    const registry = createSoundRegistry();
    registry.register("hit", { path: "audio/hit.ogg", volume: 0.5, variants: 3 });
    expect(registry.get("hit").variants).toHaveLength(3);
    expect(registry.list()).toHaveLength(1);
  });
});
