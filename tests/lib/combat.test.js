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
    cols: 20,
    rows: 20,
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
    expect(combat.log).toContain("\uD83D\uDEE1\uFE0F Perfect block! (100%) — You still take 1 glancing damage.");
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
    let emittedSummary = null;
    combat.on("combatEnd", ({ result, summary }) => {
      emittedResult = result;
      emittedSummary = summary;
    });

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
    expect(emittedSummary.gold.gained).toBe(2500);
    expect(emittedSummary.xp.gained).toBe(120);
    expect(player.gold).toBe(2500);
  });
});

describe("classes/Combat battle summaries", () => {
  test("records awarded items, cargo salvage, and XP across a level-up", () => {
    const context = createCombatContext();
    context.ItemLibrary = {
      Sword: { name: "Sword", baseValue: 40 },
      Clay: { name: "Clay", baseValue: 20 },
    };
    const CombatSystem = loadBrowserScript("classes/Combat.js", context, "CombatSystem");
    const player = {
      gold: 10,
      level: 1,
      xp: 45,
      currentHP: 10,
      party: [],
      inventory: new Map(),
      earnGold(amount) { this.gold += amount; },
      getXPForNextLevel() { return this.level * 50; },
      gainXP(amount) {
        this.xp += amount;
        while (this.xp >= this.getXPForNextLevel()) {
          this.xp -= this.getXPForNextLevel();
          this.level += 1;
        }
      },
      addItem(item) { return item.name === "Sword"; },
      getMaxHP: () => 10,
    };
    const combat = new CombatSystem({ player, cities: [] });
    combat.raider = {
      x: 0,
      y: 0,
      name: "Loot Tester",
      strength: 2,
      type: "bandit",
      loot: {
        gold: 50,
        items: [
          { name: "Sword", quantity: 1 },
          { name: "Clay", quantity: 2 },
        ],
      },
    };
    combat.raiderType = "bandit";
    combat.playerHP = 8;
    combat._battleStartPlayerHP = 10;
    combat.result = "win";

    combat.resolveCombat();

    expect(combat.summary.outcome).toBe("win");
    expect(combat.summary.gold.gained).toBe(50);
    expect(combat.summary.gold.salvage).toBe(24);
    expect(combat.summary.items.gained[0].name).toBe("Sword");
    expect(combat.summary.items.salvaged[0].name).toBe("Clay");
    expect(combat.summary.items.salvaged[0].gold).toBe(24);
    expect(combat.summary.xp.gained).toBe(24);
    expect(combat.summary.xp.before.level).toBe(1);
    expect(combat.summary.xp.before.xp).toBe(45);
    expect(combat.summary.xp.after.level).toBe(2);
    expect(combat.summary.xp.after.xp).toBe(19);
    expect(combat.summary.playerHP.lost).toBe(2);
    expect(player.gold).toBe(84);
  });

  test("records the exact gold and item removed after a defeat", () => {
    const context = createCombatContext();
    context.window.DIFFICULTY_CONFIG = {
      combatLossGoldPercent: [0.1, 0.1],
      combatLossItemCount: [1, 1],
    };
    context.ItemLibrary = { Wood: { name: "Wood", baseValue: 8 } };
    const CombatSystem = loadBrowserScript("classes/Combat.js", context, "CombatSystem");
    const player = {
      x: 5,
      y: 5,
      gold: 100,
      level: 3,
      xp: 20,
      currentHP: 10,
      modifiers: {},
      party: [],
      inventory: new Map([["Wood", { quantity: 2 }]]),
      spendGold(amount) { this.gold -= amount; },
      removeItem({ name }) { this.inventory.get(name).quantity -= 1; },
      getXPForNextLevel() { return this.level * 50; },
      getMaxHP: () => 10,
    };
    const combat = new CombatSystem({ player, cities: [] });
    combat.raider = {
      x: 6,
      y: 5,
      strength: 2,
      type: "bandit",
      state: "attacking",
      loot: { gold: 0, items: [] },
    };
    combat.raiderType = "bandit";
    combat.playerHP = 0;
    combat._battleStartPlayerHP = 10;
    combat.result = "lose";

    combat.resolveCombat();

    expect(combat.summary.outcome).toBe("lose");
    expect(combat.summary.gold.lost).toBe(10);
    expect(combat.summary.items.lost.length).toBe(1);
    expect(combat.summary.items.lost[0].name).toBe("Wood");
    expect(combat.summary.items.lost[0].quantity).toBe(1);
    expect(combat.summary.playerHP.remaining).toBe(0);
    expect(combat.summary.xp.gained).toBe(0);
    expect(player.gold).toBe(90);
    expect(player.inventory.get("Wood").quantity).toBe(1);
  });
});

describe("classes/Combat unarmed balance", () => {
  function attackWith(weaponName, accuracy) {
    const context = createCombatContext();
    const CombatSystem = loadBrowserScript("classes/Combat.js", context, "CombatSystem");
    const inventory = new Map();
    if (weaponName) inventory.set(weaponName, { quantity: 1 });
    const player = {
      bonusAttack: 0,
      bonusMagic: 0,
      party: [],
      inventory,
      equippedWeapon: weaponName || null,
      speed: 2,
      currentHP: 12,
    };
    const combat = new CombatSystem({ player });
    combat.raider = { strength: 4, type: "bandit" };
    combat.raiderType = "bandit";
    combat.currentTerrain = "Grass";
    combat.playerHP = 12;
    combat.raiderHP = 100;
    combat._initRaiderHP = 100;
    return combat.doPlayerAttack(accuracy);
  }

  test("fists no longer receive a hidden hit advantage at middling accuracy", () => {
    expect(attackWith(null, 0.6).playerMiss).toBe(true);
    expect(attackWith("Dagger", 0.6).playerMiss).toBe(false);
  });

  test("fists remain usable but deal less damage than real weapons", () => {
    const fists = attackWith(null, 0.8);
    const dagger = attackWith("Dagger", 0.8);
    const sword = attackWith("Sword", 0.8);

    expect(fists.playerMiss).toBe(false);
    expect(fists.playerDmg).toBeGreaterThan(0);
    expect(fists.playerDmg).toBeLessThan(dagger.playerDmg);
    expect(dagger.playerDmg).toBeLessThan(sword.playerDmg);
  });
});
