const CityWarBattle = require("../../classes/CityWarBattle.js");

describe("CityWarBattle", () => {
  test("builds deterministic opening state from the same battle inputs", () => {
    const opts = {
      preview: { attackPower: 21, defensePower: 17, distance: 14, winChance: 0.58 },
      sourceCity: { name: "Harbor", location: { x: 2, y: 3 }, hasWeaponShop: true, management: { upgradeLevels: { walls: 1 } } },
      targetCity: { name: "Ironhold", location: { x: 18, y: 7 }, hasBlackMarket: true, management: { upgradeLevels: { walls: 2 } } },
      day: 9,
    };
    const first = CityWarBattle.createBattle(opts);
    const second = CityWarBattle.createBattle(opts);

    expect(first.seed).toBe(second.seed);
    expect(first.pieces.map((piece) => ({
      side: piece.side,
      type: piece.pieceType,
      x: piece.x,
      y: piece.y,
      hp: piece.hp,
    }))).toEqual(second.pieces.map((piece) => ({
      side: piece.side,
      type: piece.pieceType,
      x: piece.x,
      y: piece.y,
      hp: piece.hp,
    })));
    expect(first.getHand("player").map((card) => card.id)).toEqual(second.getHand("player").map((card) => card.id));
  });

  test("playing a volley card creates a live ranged bonus effect", () => {
    const battle = CityWarBattle.createBattle({
      preview: { attackPower: 18, defensePower: 16, distance: 10, winChance: 0.55 },
      sourceCity: { name: "Harbor", hasWeaponShop: true, management: { upgradeLevels: {} } },
      targetCity: { name: "Ironhold", management: { upgradeLevels: {} } },
      day: 4,
    });

    battle.sides.player.hand = [{
      instanceId: 999,
      id: "volley",
      title: "Volley",
      desc: "Next two ranged attacks gain reach, hit chance, and damage.",
    }];

    const play = battle.playCard("player", 999);
    const effects = battle.getActiveEffects("player").map((entry) => entry.title);

    expect(play.ok).toBe(true);
    expect(effects).toContain("Volley");

    const result = battle.finishBattle();
    expect(result.seed).toBe(battle.seed);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test("describes battle plans from city doctrine and deck sources", () => {
    const summary = CityWarBattle.describeBattlePlan({
      preview: { attackPower: 24, defensePower: 20, distance: 11, winChance: 0.61 },
      sourceCity: {
        name: "Harbor",
        hasWeaponShop: true,
        hasWinery: true,
        hasSchool: true,
        management: { upgradeLevels: { walls: 1 } },
      },
      targetCity: {
        name: "Ironhold",
        hasBlackMarket: true,
        hasBank: true,
        port: true,
        management: { upgradeLevels: { walls: 2 } },
      },
      day: 12,
    });

    expect(summary.playerDeckSize).toBeGreaterThan(8);
    expect(summary.enemyDeckSize).toBeGreaterThan(8);
    expect(summary.attackerDoctrines).toContain("Arsenal");
    expect(summary.attackerDoctrines).toContain("Morale");
    expect(summary.defenderDoctrines).toContain("Sabotage");
    expect(summary.defenderDoctrines).toContain("Coastal");
    expect(summary.attackerCards.some((entry) => entry.id === "volley")).toBe(true);
    expect(summary.defenderCards.some((entry) => entry.id === "brace")).toBe(true);
  });

  test("uses the real city rosters to compose the tactical armies", () => {
    const battle = CityWarBattle.createBattle({
      preview: { attackPower: 40, defensePower: 40, distance: 8, winChance: 0.5 },
      sourceCity: {
        name: "Harbor",
        management: { upgradeLevels: {}, units: [
          { name: "Longbow One", classKey: "ranger", hp: 10 },
          { name: "Gate Guard", classKey: "guard", hp: 12 },
        ] },
      },
      targetCity: {
        name: "Ironhold",
        management: { upgradeLevels: {}, units: [
          { name: "Motor Lancers", classKey: "motorCorps", hp: 14 },
        ] },
      },
      day: 3,
    });

    expect(battle.living("player")).toHaveLength(2);
    expect(battle.living("enemy")).toHaveLength(1);
    expect(battle.living("player").map((unit) => unit.name)).toContain("Longbow One");
    expect(battle.living("player").find((unit) => unit.name === "Longbow One").pieceType).toBe("ranger");
    expect(battle.living("enemy")[0].pieceType).toBe("knight");
  });

  test("deploys the strongest seven units and carries veteran condition into battle", () => {
    const rookies = Array.from({ length: 7 }, (_, i) => ({
      id: i + 1, name: `Rookie ${i + 1}`, classKey: "guard", hp: 4, maxHp: 12, attack: 2, defense: 1, level: 1,
    }));
    const veteran = { id: 99, name: "Veteran", classKey: "guard", hp: 24, maxHp: 24, attack: 8, defense: 7, accuracy: 0.9, critChance: 0.3, level: 9 };
    const battle = CityWarBattle.createBattle({
      preview: { attackPower: 70, defensePower: 10, distance: 4, winChance: 0.8 },
      sourceCity: { name: "Harbor", management: { upgradeLevels: {}, units: rookies.concat(veteran) } },
      targetCity: { name: "Outpost", management: { upgradeLevels: {}, units: [{ id: 200, classKey: "militia", hp: 10, maxHp: 10 }] } },
      day: 2,
    });

    const deployed = battle.living("player");
    expect(deployed).toHaveLength(7);
    expect(deployed.map((unit) => unit.name)).toContain("Veteran");
    expect(deployed.find((unit) => unit.name === "Veteran").maxHp).toBeGreaterThan(3);
    expect(deployed.find((unit) => unit.name === "Veteran").ruleOverrides.damage).toBeGreaterThan(2);
  });

  test("autopilot resolves both sides through the seeded tactical rules", () => {
    const opts = {
      preview: { attackPower: 25, defensePower: 23, distance: 9, winChance: 0.54 },
      sourceCity: { name: "Harbor", hasWeaponShop: true, management: { upgradeLevels: {}, units: [
        { id: 1, name: "Harbor Guard", classKey: "guard", hp: 12, maxHp: 12, attack: 4, defense: 3 },
        { id: 2, name: "Harbor Bow", classKey: "ranger", hp: 9, maxHp: 10, attack: 4, defense: 1 },
      ] } },
      targetCity: { name: "Ironhold", management: { upgradeLevels: { walls: 1 }, units: [
        { id: 3, name: "Iron Guard", classKey: "guard", hp: 12, maxHp: 12, attack: 3, defense: 3 },
        { id: 4, name: "Iron Levy", classKey: "militia", hp: 10, maxHp: 10, attack: 3, defense: 1 },
      ] } },
      day: 6,
    };
    const run = () => {
      const battle = CityWarBattle.createBattle(opts);
      let decisions = 0;
      while (!battle.finished && decisions < 512) {
        battle.takeAutoStep(battle.turn);
        decisions++;
      }
      return { decisions, result: battle.getResult(), log: battle.log };
    };
    const first = run();
    const second = run();

    expect(first.result).toEqual(second.result);
    expect(first.log).toEqual(second.log);
    expect(first.result.playerBattleWon === true || first.result.playerBattleWon === false).toBe(true);
    expect(first.decisions).toBeLessThan(512);
    expect(first.result.cardsPlayed + first.result.enemyCardsPlayed).toBeGreaterThan(0);
  });
});
