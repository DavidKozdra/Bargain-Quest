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
    expect(pressure.fuelSurcharge).toBeGreaterThan(0);

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
});
