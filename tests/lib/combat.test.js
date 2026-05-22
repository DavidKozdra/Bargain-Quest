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
    GameStates: { PLAYING: "playing", COMBAT: "combat", SPACE: "space", CITY_MANAGE: "city_manage", PLANET_SURFACE: "planet_surface" },
    gameStateManager: {
      is: () => false,
      setState: () => {},
    },
    ItemLibrary: {},
  };
  context.global = context;
  context.globalThis = context;
  return context;
}

describe("classes/Combat perfect block", () => {
  test("still lets a small amount of damage through on a perfect block", () => {
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

    expect(result.enemyDmg).toBe(1);
    expect(combat.playerHP).toBe(11);
    expect(combat.log).toContain("🛡️ Perfect block! (100%) — You still take 1 glancing damage.");
  });

  test("Raymond defeat callback runs when final boss combat is won", () => {
    const context = createCombatContext();
    const CombatSystem = loadBrowserScript("classes/Combat.js", context, "CombatSystem");
    const player = {
      gold: 0,
      bonusDefense: 0,
      party: [],
      inventory: new Map(),
      speed: 2,
      currentHP: 12,
      earnGold(amount) { this.gold += amount; },
      gainXP(amount) { this.xp = (this.xp || 0) + amount; },
      addItem: () => true,
      getMaxHP: () => 12,
    };
    const combat = new CombatSystem({ player, cities: [] });
    let defeated = false;
    let emittedResult = null;
    combat.on("combatEnd", ({ result }) => { emittedResult = result; });

    combat.raider = {
      x: 0,
      y: 0,
      strength: 10,
      type: "raymond",
      state: "patrolling",
      loot: { gold: 2500, items: [] },
      onDefeated: () => { defeated = true; },
    };
    combat.raiderType = "raymond";
    combat.playerHP = 9;
    combat.result = "win";

    combat.resolveCombat();

    expect(defeated).toBe(true);
    expect(emittedResult).toBe("win");
    expect(player.gold).toBe(2500);
  });
});
