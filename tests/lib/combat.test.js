const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadBrowserScript(relPath, context, exportName) {
  const filename = path.resolve(__dirname, "..", "..", relPath);
  const source = fs.readFileSync(filename, "utf8");
  vm.runInNewContext(`${source}\nthis.__exported = ${exportName};`, context, { filename });
  return context.__exported;
}

function createCombatContext() {
  const math = Object.create(Math);
  math.random = () => 0.5;

  const context = {
    console,
    Math: math,
    Map,
    Set,
    Date,
    grid: [[{ options: ["Grass"] }]],
    dayNight: { getDaysElapsed: () => 0 },
    localStorage: { getItem: () => null },
    window: {},
  };
  context.global = context;
  context.globalThis = context;
  return context;
}

describe("classes/Combat perfect block", () => {
  test("fully negates damage on a perfect block", () => {
    const context = createCombatContext();
    const CombatSystem = loadBrowserScript("classes/Combat.js", context, "CombatSystem");
    const player = {
      bonusDefense: 0,
      party: [],
      inventory: new Map(),
      speed: 2,
      currentHP: 12,
    };
    const combat = new CombatSystem({ player });

    combat.raider = { strength: 4, type: "bandit" };
    combat.raiderType = "bandit";
    combat.currentTerrain = "Grass";
    combat.playerHP = 12;

    const result = combat.doEnemyAttack(1);

    expect(result.enemyDmg).toBe(0);
    expect(combat.playerHP).toBe(12);
    expect(combat.log).toContain("🛡️ Perfect block! (100%) — You deflect the attack completely!");
  });
});
