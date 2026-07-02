describe("BearEmpireSystem", () => {
  const prevWindow = global.window;
  const prevBearEmpireSystem = global.BearEmpireSystem;
  const prevSpaceTravelSystem = global.SpaceTravelSystem;

  beforeAll(() => {
    global.window = global.window || {};
    require("../../classes/SpaceTravelSystem.js");
    require("../../classes/BearEmpireSystem.js");
    global.SpaceTravelSystem = global.window.SpaceTravelSystem;
    global.BearEmpireSystem = global.window.BearEmpireSystem;
  });

  afterAll(() => {
    if (prevWindow === undefined) delete global.window;
    else global.window = prevWindow;

    if (prevBearEmpireSystem === undefined) delete global.BearEmpireSystem;
    else global.BearEmpireSystem = prevBearEmpireSystem;

    if (prevSpaceTravelSystem === undefined) delete global.SpaceTravelSystem;
    else global.SpaceTravelSystem = prevSpaceTravelSystem;
  });

  function makeCities(spaceReady = true) {
    return [{
      name: "Harbor Prime",
      hasSpaceport: spaceReady,
      progression: {
        spaceProgram: !!spaceReady,
        spaceportBuilt: !!spaceReady,
        spaceAccess: { launchReady: !!spaceReady, dockingRights: !!spaceReady },
      },
    }];
  }

  test("seeds a hidden capital, early threat systems, and resistance cells", () => {
    global.window.BQConfigureSpaceWorldGraph(101);
    const system = new global.window.BearEmpireSystem({
      seed: 101,
      citiesGetter: () => makeCities(true),
      playerGetter: () => ({ spaceTravel: { visitedPlanets: [] } }),
      notificationGetter: () => null,
    });

    expect(system.active).toBe(true);
    expect(system.capitalSystemKey).toBeTruthy();
    expect(system.getOccupiedSystems()).toContain(system.capitalSystemKey);
    expect(system.getThreatenedSystems().length).toBeGreaterThan(0);
    expect(system.getResistanceCells().length).toBeGreaterThan(0);
    expect(system.getKnownBearSystems()).not.toContain(system.capitalSystemKey);

    system.destroy();
  });

  test("stays dormant until space is unlocked, then begins the crisis", () => {
    global.window.BQConfigureSpaceWorldGraph(202);
    const system = new global.window.BearEmpireSystem({
      seed: 202,
      citiesGetter: () => makeCities(false),
      playerGetter: () => ({ spaceTravel: { visitedPlanets: [], inOrbit: false } }),
      notificationGetter: () => null,
    });

    expect(system.active).toBe(false);
    expect(system.evaluateActivation()).toBe(false);
    expect(system.evaluateActivation(true)).toBe(true);
    expect(system.active).toBe(true);

    system.destroy();
  });

  test("advances bear spread on day changes once active", () => {
    global.window.BQConfigureSpaceWorldGraph(303);
    const system = new global.window.BearEmpireSystem({
      seed: 303,
      citiesGetter: () => makeCities(true),
      playerGetter: () => ({ spaceTravel: { visitedPlanets: [] } }),
      notificationGetter: () => null,
    });

    const beforeControlled = system.getOccupiedSystems().length;
    const beforeThreats = system.getThreatenedSystems().length;
    const result = system.onDayChanged(4);

    expect(result.ok).toBe(true);
    expect(system.spreadCounter).toBeGreaterThan(0);
    expect(system.getOccupiedSystems().length).toBeGreaterThanOrEqual(beforeControlled);
    expect(system.getThreatenedSystems().length).toBeGreaterThanOrEqual(0);
    expect(
      system.getOccupiedSystems().length > beforeControlled
      || system.getThreatenedSystems().length !== beforeThreats
    ).toBe(true);

    system.destroy();
  });

  test("support actions shift alignment and local system status", () => {
    global.window.BQConfigureSpaceWorldGraph(404);
    const system = new global.window.BearEmpireSystem({
      seed: 404,
      citiesGetter: () => makeCities(true),
      playerGetter: () => ({ spaceTravel: { visitedPlanets: [] } }),
      notificationGetter: () => null,
    });

    const target = system.getThreatenedSystems()[0] || system.getResistanceCells()[0];
    const aidResult = system.supportResistance(target);
    expect(aidResult.ok).toBe(true);
    expect(system.resistanceStanding).toBeGreaterThan(0);
    expect(system.getSystemStatus(target).resistanceKnown).toBe(true);

    const bearResult = system.supportBears(target);
    expect(bearResult.ok).toBe(true);
    expect(system.bearStanding).toBeGreaterThan(0);
    expect(system.getSystemStatus(target).occupied).toBe(true);

    const restored = global.window.BearEmpireSystem.fromJSON(system.toJSON(), {
      citiesGetter: () => makeCities(true),
      playerGetter: () => ({ spaceTravel: { visitedPlanets: ['luna'] } }),
      notificationGetter: () => null,
    });
    expect(restored.getSystemStatus(target).occupied).toBe(true);
    expect(restored.bearStanding).toBe(system.bearStanding);

    system.destroy();
    restored.destroy();
  });

  test("route pressure and blockade records scale with occupied bear corridors", () => {
    global.window.BQConfigureSpaceWorldGraph(505);
    const system = new global.window.BearEmpireSystem({
      seed: 505,
      citiesGetter: () => makeCities(true),
      playerGetter: () => ({ spaceTravel: { visitedPlanets: ['luna'] } }),
      notificationGetter: () => null,
    });

    const target = system.getThreatenedSystems()[0];
    system.supportBears(target);
    const pressure = system.getRoutePressure('orbit', target);
    expect(pressure.active).toBe(true);
    expect(pressure.routeThreat).toBe('occupied');
    expect(pressure.dangerBonus).toBeGreaterThan(0);
    expect(pressure.fuelSurcharge).toBeGreaterThanOrEqual(0);

    const beforeIntel = system.intelPoints;
    const beforeStanding = system.resistanceStanding;
    const record = system.recordBlockadeRun(target, 88);
    expect(record.ok).toBe(true);
    expect(record.rating).toBe('breakthrough');
    expect(system.intelPoints).toBeGreaterThan(beforeIntel);
    expect(system.resistanceStanding).toBeGreaterThan(beforeStanding);

    system.destroy();
  });

  test("war incidents persist across saves and signal traces can reveal Raymond", () => {
    global.window.BQConfigureSpaceWorldGraph(606);
    const system = new global.window.BearEmpireSystem({
      seed: 606,
      citiesGetter: () => makeCities(true),
      playerGetter: () => ({ spaceTravel: { visitedPlanets: ['luna'], currentPlanet: 'luna' } }),
      notificationGetter: () => null,
    });

    const nodeKey = system.getThreatenedSystems()[0] || system.getResistanceCells()[0];
    system.intelPoints = 5;
    if (!system.resistanceCells.includes(nodeKey)) system.resistanceCells.push(nodeKey);
    if (!system.knownResistanceSystems.includes(nodeKey)) system.knownResistanceSystems.push(nodeKey);
    system._recomputeState();

    const incident = system._queueIncident(system._buildIncident(nodeKey, 'signal_trace', 12));
    expect(incident).toBeTruthy();
    expect(system.getPendingIncidents(nodeKey)).toHaveLength(1);

    const restored = global.window.BearEmpireSystem.fromJSON(system.toJSON(), {
      citiesGetter: () => makeCities(true),
      playerGetter: () => ({ spaceTravel: { visitedPlanets: ['luna'], currentPlanet: 'luna' } }),
      notificationGetter: () => null,
    });
    expect(restored.getPendingIncidents(nodeKey)).toHaveLength(1);

    const result = restored.resolveIncident(incident.id, { score: 95 });
    expect(result.ok).toBe(true);
    expect(restored.raymondRevealed).toBe(true);
    expect(restored.getKnownBearSystems()).toContain(restored.capitalSystemKey);
    expect(restored.getPendingIncidents(nodeKey)).toHaveLength(0);

    system.destroy();
    restored.destroy();
  });

  test("Raymond final assault is gated to the revealed capital and defeat ends the crisis", () => {
    global.window.BQConfigureSpaceWorldGraph(707);
    const system = new global.window.BearEmpireSystem({
      seed: 707,
      citiesGetter: () => makeCities(true),
      playerGetter: () => ({ spaceTravel: { visitedPlanets: ["luna"] } }),
      notificationGetter: () => null,
    });

    const capital = system.capitalSystemKey;
    const wrongNode = system.getThreatenedSystems()[0] || system.getResistanceCells()[0];

    expect(system.canStartRaymondAssault(capital).ok).toBe(false);
    expect(system.canStartRaymondAssault(capital).reason).toBe("raymond_hidden");

    system.forceRevealRaymond("test");
    expect(system.canStartRaymondAssault(wrongNode).ok).toBe(false);
    expect(system.canStartRaymondAssault(capital).ok).toBe(true);

    const config = system.getRaymondAssaultConfig(capital);
    expect(config.ok).toBe(true);
    expect(config.qte.kind).toBe("space_raymond_final_assault");

    const approach = system.resolveRaymondAssaultApproach(capital, 95);
    expect(approach.ok).toBe(true);
    expect(approach.rating).toBe("perfect");
    expect(approach.raymondStrength).toBeGreaterThanOrEqual(9);

    const defeated = system.markRaymondDefeated();
    expect(defeated.ok).toBe(true);
    expect(system.raymondDefeated).toBe(true);
    expect(system.getThreatenedSystems()).toHaveLength(0);
    expect(system.getOccupiedSystems()).toHaveLength(0);
    expect(system.canStartRaymondAssault(capital).reason).toBe("raymond_defeated");

    system.destroy();
  });

  test("defeating Raymond pays a one-time war-chest bounty, liberates the galaxy, and is idempotent", () => {
    global.window.BQConfigureSpaceWorldGraph(808);
    let gold = 100;
    let recalcCalls = 0;
    const player = {
      gold,
      spaceTravel: { visitedPlanets: ["luna"] },
      earnGold(amount) { this.gold += amount; },
      recalcModifiers() { recalcCalls += 1; },
    };
    const system = new global.window.BearEmpireSystem({
      seed: 808,
      citiesGetter: () => makeCities(true),
      playerGetter: () => player,
      notificationGetter: () => null,
    });

    system.forceRevealRaymond("test");
    const startGold = player.gold;

    const first = system.markRaymondDefeated();
    expect(first.ok).toBe(true);
    expect(first.bounty).toBeGreaterThan(0);
    expect(player.gold).toBe(startGold + first.bounty);
    expect(system.galaxyLiberated).toBe(true);
    expect(system.victoryBountyPaid).toBe(first.bounty);
    expect(recalcCalls).toBeGreaterThan(0); // perk re-derive was requested

    // Re-entry / reload must never double-pay.
    const goldAfterFirst = player.gold;
    const second = system.markRaymondDefeated();
    expect(second.alreadyDefeated).toBe(true);
    expect(second.bounty).toBe(0);
    expect(player.gold).toBe(goldAfterFirst);

    // Liberation state survives a save round-trip and the bounty stays paid.
    const restored = global.window.BearEmpireSystem.fromJSON(system.toJSON(), {
      citiesGetter: () => makeCities(true),
      playerGetter: () => player,
      notificationGetter: () => null,
    });
    expect(restored.galaxyLiberated).toBe(true);
    expect(restored.victoryBountyPaid).toBe(first.bounty);
    expect(restored.markRaymondDefeated().bounty).toBe(0);
    expect(player.gold).toBe(goldAfterFirst);

    system.destroy();
    restored.destroy();
  });

  test("a legacy save that already defeated Raymond is treated as liberated", () => {
    global.window.BQConfigureSpaceWorldGraph(909);
    const restored = global.window.BearEmpireSystem.fromJSON(
      { seed: 909, active: true, raymondDefeated: true },
      {
        citiesGetter: () => makeCities(true),
        playerGetter: () => ({ spaceTravel: { visitedPlanets: ["luna"] } }),
        notificationGetter: () => null,
      }
    );
    expect(restored.galaxyLiberated).toBe(true);
    restored.destroy();
  });

  function makeReputationCities() {
    return [{
      name: "Harbor Prime",
      hasSpaceport: true,
      reputation: 50,
      progression: { spaceProgram: true, spaceportBuilt: true, spaceAccess: { launchReady: true, dockingRights: true } },
      adjustReputation(delta) { this.reputation = Math.max(0, Math.min(100, this.reputation + delta)); },
    }];
  }

  test("supporting the bears pays a tribute kickback and docks city reputation", () => {
    global.window.BQConfigureSpaceWorldGraph(1010);
    const cities = makeReputationCities();
    const player = {
      gold: 200,
      spaceTravel: { visitedPlanets: ["luna"] },
      earnGold(amount) { this.gold += amount; },
    };
    const system = new global.window.BearEmpireSystem({
      seed: 1010,
      citiesGetter: () => cities,
      playerGetter: () => player,
      notificationGetter: () => null,
    });

    const target = system.getThreatenedSystems()[0] || system.getResistanceCells()[0];
    const startGold = player.gold;
    const startRep = cities[0].reputation;
    const result = system.supportBears(target);

    expect(result.ok).toBe(true);
    expect(result.payout).toBeGreaterThan(0);
    expect(player.gold).toBe(startGold + result.payout);
    expect(cities[0].reputation).toBeLessThan(startRep);

    system.destroy();
  });

  test("bear-aligned captains get softened occupied trade friction and cannot assault Raymond", () => {
    global.window.BQConfigureSpaceWorldGraph(1111);
    const player = {
      gold: 500,
      spaceTravel: { visitedPlanets: ["luna"] },
      earnGold(amount) { this.gold += amount; },
    };
    const system = new global.window.BearEmpireSystem({
      seed: 1111,
      citiesGetter: () => makeCities(true),
      playerGetter: () => player,
      notificationGetter: () => null,
    });

    // Occupy a system, then push standing firmly into bear_aligned.
    const target = system.getThreatenedSystems()[0] || system.getResistanceCells()[0];
    system.supportBears(target);
    const neutralPenalty = system.getSystemStatus(target).tradePenalty;
    for (let i = 0; i < 3; i++) system.supportBears(target);
    expect(system.alignment).toBe("bear_aligned");

    const alignedPenalty = system.getSystemStatus(target).tradePenalty;
    expect(alignedPenalty).toBeLessThan(neutralPenalty);

    system.forceRevealRaymond("test");
    const assault = system.canStartRaymondAssault(system.capitalSystemKey);
    expect(assault.ok).toBe(false);
    expect(assault.reason).toBe("bear_aligned");

    system.destroy();
  });

  test("double-dealing carries a seeded exposure risk that can seize gold", () => {
    global.window.BQConfigureSpaceWorldGraph(1212);
    const player = {
      gold: 1000,
      spaceTravel: { visitedPlanets: ["luna"] },
      earnGold(amount) { this.gold += amount; },
      spendGold(amount) { this.gold = Math.max(0, this.gold - amount); },
    };
    const system = new global.window.BearEmpireSystem({
      seed: 1212,
      citiesGetter: () => makeCities(true),
      playerGetter: () => player,
      notificationGetter: () => null,
    });

    // Force a double_dealing alignment (both standings high).
    system.bearStanding = 12;
    system.resistanceStanding = 12;
    system._recomputeState();
    expect(system.alignment).toBe("double_dealing");

    // Neutral alignment never triggers exposure.
    system.alignment = "neutral";
    expect(system._rollDoubleDealingExposure(3)).toBeNull();
    system.alignment = "double_dealing";

    // Scan enough days to hit at least one seeded exposure (~22% per day).
    let seizedTotal = 0;
    for (let day = 1; day <= 40; day++) {
      const exposure = system._rollDoubleDealingExposure(day);
      if (exposure) seizedTotal += exposure.seized;
    }
    expect(seizedTotal).toBeGreaterThan(0);
    expect(player.gold).toBeLessThan(1000);

    system.destroy();
  });
});
