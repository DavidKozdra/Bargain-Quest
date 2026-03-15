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
});
