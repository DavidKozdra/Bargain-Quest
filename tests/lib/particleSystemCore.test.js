const { ParticleSystemCore } = require("../../Koz_Engine_Lib/fx/particleSystemCore");

describe("Koz_Engine_Lib/fx/particleSystemCore", () => {
  test("spawns and updates particles", () => {
    const ps = new ParticleSystemCore({ poolSize: 10, random: () => 0.5 });
    ps.spawn(10, 20, { life: 100, vx: 0, vy: 0 });
    expect(ps.activeCount()).toBe(1);
    ps.update(50);
    expect(ps.activeCount()).toBe(1);
    ps.update(60);
    expect(ps.activeCount()).toBe(0);
  });
});
