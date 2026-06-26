describe("SpaceTravelSystem live system flow", () => {
  const prevWindow = global.window;
  const prevSpaceShip = global.SpaceShip;
  const prevSpaceTravelSystem = global.SpaceTravelSystem;

  beforeAll(() => {
    global.window = global.window || {};
    require("../../classes/SpaceTravelSystem.js");
    global.SpaceShip = global.window.SpaceShip;
    global.SpaceTravelSystem = global.window.SpaceTravelSystem;
  });

  afterAll(() => {
    if (prevWindow === undefined) delete global.window;
    else global.window = prevWindow;

    if (prevSpaceShip === undefined) delete global.SpaceShip;
    else global.SpaceShip = prevSpaceShip;

    if (prevSpaceTravelSystem === undefined) delete global.SpaceTravelSystem;
    else global.SpaceTravelSystem = prevSpaceTravelSystem;
  });

  function makeCity(overrides = {}) {
    return {
      name: "Harbor",
      hasSpaceport: true,
      progression: {
        techEffects: {},
        spaceAccess: { launchReady: true },
        ...(overrides.progression || {}),
      },
      hasUniversity: !!overrides.hasUniversity,
      hasResearchLab: !!overrides.hasResearchLab,
      management: {
        upgradeLevels: {},
        ...(overrides.management || {}),
      },
    };
  }

  test("launches into the selected star system and generates a live system state", () => {
    const sys = new global.window.SpaceTravelSystem();
    const ship = new global.window.SpaceShip("shuttle", "Test Ship");
    const city = makeCity();

    expect(sys.beginLaunch(city, ship, null, "luna")).toEqual({ ok: true, destination: "luna" });
    expect(sys.confirmLaunch().ok).toBe(true);
    expect(sys.completeAscent(true)).toEqual({ ok: true, node: "luna" });
    expect(sys.phase).toBe("in_orbit");
    expect(sys.currentNode).toBe("luna");
    expect(sys.getCurrentSystemState().nodeKey).toBe("luna");
    expect(Array.isArray(sys.getCurrentSystemState().bodies)).toBe(true);
    expect(sys.getCurrentSystemState().bodies.length > 0).toBe(true);
  });

  test("builds a much larger explorable local system field than the old tiny orbit map", () => {
    const sys = new global.window.SpaceTravelSystem();
    const ship = new global.window.SpaceShip("shuttle", "Wide System");
    const city = makeCity();

    expect(sys.beginLaunch(city, ship, null, "orbit").ok).toBe(true);
    expect(sys.confirmLaunch().ok).toBe(true);
    expect(sys.completeAscent(true).ok).toBe(true);

    const state = sys.getCurrentSystemState();
    expect(state.width).toBeGreaterThan(5000);
    expect(state.height).toBeGreaterThan(4000);
  });

  test("launching from Earth places the ship just above the homeworld instead of at a generic edge", () => {
    const sys = new global.window.SpaceTravelSystem();
    const ship = new global.window.SpaceShip("shuttle", "Earth Spawn");
    const city = makeCity();

    expect(sys.beginLaunch(city, ship, null, "orbit").ok).toBe(true);
    expect(sys.confirmLaunch().ok).toBe(true);
    expect(sys.completeAscent(true).ok).toBe(true);

    const state = sys.getCurrentSystemState();
    const earth = state.bodies.find((body) => body.key === "homeworld");
    const distanceFromEarth = Math.hypot(state.ship.x - earth.x, state.ship.y - earth.y);
    const distanceFromCenter = Math.hypot(state.ship.x - state.centerX, state.ship.y - state.centerY);

    expect(distanceFromEarth).toBeGreaterThan(earth.radius + 100);
    expect(distanceFromEarth).toBeLessThan(earth.radius + 220);
    expect(distanceFromCenter).toBeGreaterThan(earth.orbitRadius);
    expect(state.nearestBodyKey).toBe("homeworld");
  });

  test("launch readiness speeds ascent for logistics-heavy cities", () => {
    const slowSys = new global.window.SpaceTravelSystem();
    const fastSys = new global.window.SpaceTravelSystem();
    const slowShip = new global.window.SpaceShip("shuttle", "Slow Launch");
    const fastShip = new global.window.SpaceShip("shuttle", "Fast Launch");
    const slowCity = makeCity();
    const fastCity = makeCity({
      hasUniversity: true,
      hasResearchLab: true,
      progression: {
        techEffects: { spaceReadiness: 0.35 },
        spaceAccess: { launchReady: true },
      },
      management: {
        upgradeLevels: { wagonDepot: 1, motorPool: 1 },
      },
    });

    expect(slowSys.beginLaunch(slowCity, slowShip, null, "orbit").ok).toBe(true);
    expect(fastSys.beginLaunch(fastCity, fastShip, null, "orbit").ok).toBe(true);
    expect(slowSys.confirmLaunch().ok).toBe(true);
    expect(fastSys.confirmLaunch().ok).toBe(true);

    const slowTick = slowSys.tickFrame(1000, {});
    const fastTick = fastSys.tickFrame(1000, {});
    expect(fastTick.progress).toBeGreaterThan(slowTick.progress);
  });

  test("plots linked-system travel and jumps when the ship reaches the boundary", () => {
    const sys = new global.window.SpaceTravelSystem();
    const ship = new global.window.SpaceShip("corvette", "Jump Ship");
    const city = makeCity();

    expect(sys.beginLaunch(city, ship, null, "orbit").ok).toBe(true);
    expect(sys.confirmLaunch().ok).toBe(true);
    expect(sys.completeAscent(true).ok).toBe(true);
    expect(sys.plotRoute("luna").ok).toBe(true);

    const state = sys.getCurrentSystemState();
    state.ship.x = state.width - 20;
    state.ship.y = state.centerY;

    const result = sys.tickFrame(16, {});
    expect(result.event).toBe("jumped");
    expect(sys.currentNode).toBe("luna");
    expect(sys.targetNode).toBe(null);
  });

  test("space travel still works when a saved ship has no fuel", () => {
    const sys = new global.window.SpaceTravelSystem();
    const ship = new global.window.SpaceShip("shuttle", "Dry Tank");
    const city = makeCity();
    ship.fuel = 0;

    expect(sys.beginLaunch(city, ship, null, "orbit").ok).toBe(true);
    expect(sys.confirmLaunch().ok).toBe(true);
    expect(sys.completeAscent(true).ok).toBe(true);
    expect(sys.plotRoute("luna").ok).toBe(true);

    const state = sys.getCurrentSystemState();
    state.ship.x = state.width - 20;
    state.ship.y = state.centerY;

    const result = sys.tickFrame(16, {});
    expect(result.event).toBe("jumped");
    expect(sys.currentNode).toBe("luna");
  });

  test("can dock with the nearest body and lift off again", () => {
    const sys = new global.window.SpaceTravelSystem();
    const ship = new global.window.SpaceShip("shuttle", "Dock Ship");
    const city = makeCity();

    expect(sys.beginLaunch(city, ship, null, "orbit").ok).toBe(true);
    expect(sys.confirmLaunch().ok).toBe(true);
    expect(sys.completeAscent(true).ok).toBe(true);

    const state = sys.getCurrentSystemState();
    const target = state.bodies.find((body) => body.kind === "planet" || body.kind === "station");
    state.ship.x = target.x;
    state.ship.y = target.y + target.radius + 10;

    const dockResult = sys.dockNearestBody();
    expect(dockResult.ok).toBe(true);
    expect(sys.phase).toBe("landed");
    expect(sys.currentBodyKey).toBe(target.key);
    expect(sys.getCurrentSurfaceState()).toBeTruthy();
    expect(sys.getCurrentSurfaceState().bodyKey).toBe(target.key);

    const liftResult = sys.liftOff();
    expect(liftResult.ok).toBe(true);
    expect(sys.phase).toBe("in_orbit");
    expect(sys.currentBodyKey).toBe(null);
    expect(sys.getCurrentSurfaceState()).toBe(null);
  });

  test("landing on Earth uses the world-map surface mode", () => {
    const sys = new global.window.SpaceTravelSystem();
    const ship = new global.window.SpaceShip("shuttle", "Homefall");
    const city = makeCity();

    expect(sys.beginLaunch(city, ship, null, "orbit").ok).toBe(true);
    expect(sys.confirmLaunch().ok).toBe(true);
    expect(sys.completeAscent(true).ok).toBe(true);

    const state = sys.getCurrentSystemState();
    const earth = state.bodies.find((body) => body.key === "homeworld");
    state.ship.x = earth.x;
    state.ship.y = earth.y + earth.radius + 10;

    expect(sys.dockNearestBody().ok).toBe(true);
    expect(sys.getCurrentSurfaceState().mode).toBe("earth_world");
    expect(sys.tickFrame(32, { thrustX: 1, thrustY: 0, boost: false }).event).toBe("earth_surface");
  });

  test("Earth landing can reset space travel back to grounded adventure state", () => {
    const sys = new global.window.SpaceTravelSystem();
    const ship = new global.window.SpaceShip("shuttle", "Ground Return");
    const city = makeCity();

    expect(sys.beginLaunch(city, ship, null, "orbit").ok).toBe(true);
    expect(sys.confirmLaunch().ok).toBe(true);
    expect(sys.completeAscent(true).ok).toBe(true);

    const state = sys.getCurrentSystemState();
    const earth = state.bodies.find((body) => body.key === "homeworld");
    state.ship.x = earth.x;
    state.ship.y = earth.y + earth.radius + 10;

    expect(sys.dockNearestBody().ok).toBe(true);
    expect(sys.returnToAdventureSurface().ok).toBe(true);
    expect(sys.phase).toBe("grounded");
    expect(sys.currentNode).toBe(null);
    expect(sys.currentBodyKey).toBe(null);
    expect(sys.getCurrentSurfaceState()).toBe(null);
    expect(sys.getCurrentSystemState()).toBe(null);
  });

  test("non-earth landings keep orbit state docked without creating a fake planetary surface", () => {
    const sys = new global.window.SpaceTravelSystem();
    const ship = new global.window.SpaceShip("shuttle", "Surface Ship");
    const city = makeCity();

    expect(sys.beginLaunch(city, ship, null, "luna").ok).toBe(true);
    expect(sys.confirmLaunch().ok).toBe(true);
    expect(sys.completeAscent(true).ok).toBe(true);

    const state = sys.getCurrentSystemState();
    const target = state.bodies.find((body) => body.kind === "planet");
    state.ship.x = target.x;
    state.ship.y = target.y + target.radius + 10;

    expect(sys.dockNearestBody().ok).toBe(true);
    expect(sys.phase).toBe("landed");
    expect(sys.currentBodyKey).toBe(target.key);
    expect(sys.getCurrentSurfaceState()).toBe(null);

    const landed = sys.tickFrame(32, { thrustX: 1, thrustY: 0, boost: false });
    expect(landed.event).toBe("docked");
    expect(landed.bodyKey).toBe(target.key);
  });

  test("launch support reduces failed reentry damage", () => {
    const weakSys = new global.window.SpaceTravelSystem();
    const strongSys = new global.window.SpaceTravelSystem();
    const weakShip = new global.window.SpaceShip("shuttle", "Weak Return");
    const strongShip = new global.window.SpaceShip("shuttle", "Strong Return");
    const weakCity = makeCity();
    const strongCity = makeCity({
      hasUniversity: true,
      hasResearchLab: true,
      progression: {
        techEffects: { spaceReadiness: 0.35 },
        spaceAccess: { launchReady: true },
      },
      management: {
        upgradeLevels: { wagonDepot: 1, motorPool: 1 },
      },
    });

    expect(weakSys.beginLaunch(weakCity, weakShip, null, "orbit").ok).toBe(true);
    expect(strongSys.beginLaunch(strongCity, strongShip, null, "orbit").ok).toBe(true);
    expect(weakSys.confirmLaunch().ok).toBe(true);
    expect(strongSys.confirmLaunch().ok).toBe(true);
    expect(weakSys.completeAscent(true).ok).toBe(true);
    expect(strongSys.completeAscent(true).ok).toBe(true);
    expect(weakSys.beginReentry().ok).toBe(true);
    expect(strongSys.beginReentry().ok).toBe(true);

    const weakResult = weakSys.completeReentry(false);
    const strongResult = strongSys.completeReentry(false);
    expect(strongResult.damage).toBeLessThan(weakResult.damage);
  });

  test("space maneuver QTE scores affect launch, docking, and reentry risk", () => {
    const sys = new global.window.SpaceTravelSystem();
    const ship = new global.window.SpaceShip("shuttle", "QTE Ship");
    const city = makeCity();

    expect(sys.beginLaunch(city, ship, null, "orbit").ok).toBe(true);
    const launchConfig = sys.getLaunchManeuverConfig();
    expect(launchConfig.kind).toBe("space_launch_burn");
    const launchResult = sys.resolveLaunchManeuver(20);
    expect(launchResult.damage).toBeGreaterThan(0);
    expect(ship.condition).toBeLessThan(100);
    expect(sys.confirmLaunch().ok).toBe(true);
    expect(sys.completeAscent(true).ok).toBe(true);

    const state = sys.getCurrentSystemState();
    const earth = state.bodies.find((body) => body.key === "homeworld");
    state.ship.x = earth.x;
    state.ship.y = earth.y + earth.radius + 10;

    const dockConfig = sys.getDockingManeuverConfig(earth);
    expect(dockConfig.kind).toBe("space_docking_approach");
    const conditionBeforeDock = ship.condition;
    const dockResult = sys.dockNearestBody({ qteScore: 10 });
    expect(dockResult.damage).toBeGreaterThan(0);
    expect(ship.condition).toBeLessThan(conditionBeforeDock);
    expect(sys.liftOff().ok).toBe(true);

    const reentryConfig = sys.getReentryManeuverConfig();
    expect(reentryConfig.kind).toBe("space_reentry_corridor");
    expect(sys.beginReentry({ qteScore: 100 }).ok).toBe(true);
    expect(sys.reentrySupport).toBeGreaterThan(0);
  });

  test("launch QTE destruction aborts instead of continuing ascent", () => {
    const sys = new global.window.SpaceTravelSystem();
    const ship = new global.window.SpaceShip("shuttle", "Fragile Launch");
    const city = makeCity();
    ship.condition = 5;

    expect(sys.beginLaunch(city, ship, null, "orbit").ok).toBe(true);
    const maneuver = sys.resolveLaunchManeuver(0);
    expect(maneuver.damage).toBeGreaterThan(0);
    expect(ship.condition).toBe(0);

    const confirm = sys.confirmLaunch();
    expect(confirm.ok).toBe(false);
    expect(confirm.reason).toBe("ship_destroyed");
    expect(sys.phase).toBe("grounded");
  });

  test("docking QTE destruction aborts the landing state", () => {
    const sys = new global.window.SpaceTravelSystem();
    const ship = new global.window.SpaceShip("shuttle", "Fragile Dock");
    const city = makeCity();
    ship.condition = 5;

    expect(sys.beginLaunch(city, ship, null, "orbit").ok).toBe(true);
    expect(sys.confirmLaunch().ok).toBe(true);
    expect(sys.completeAscent(true).ok).toBe(true);

    const state = sys.getCurrentSystemState();
    const earth = state.bodies.find((body) => body.key === "homeworld");
    state.ship.x = earth.x;
    state.ship.y = earth.y + earth.radius + 10;

    const result = sys.dockNearestBody({ qteScore: 0 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("ship_destroyed");
    expect(ship.condition).toBe(0);
    expect(sys.phase).toBe("grounded");
    expect(sys.currentBodyKey).toBe(null);
  });

  test("restored landed or orbit states without an active ship fail cleanly", () => {
    const landed = global.window.SpaceTravelSystem.fromJSON({
      phase: "landed",
      currentNode: "orbit",
      currentBodyKey: "homeworld",
    });
    expect(landed.liftOff()).toEqual({ ok: false, reason: "no_ship" });

    const orbiting = global.window.SpaceTravelSystem.fromJSON({
      phase: "in_orbit",
      currentNode: "orbit",
    });
    expect(orbiting.beginReentry()).toEqual({ ok: false, reason: "no_ship" });
  });

  test("landed tick and render do not activate planet sessions as a side effect", () => {
    const prevHandoff = global.window.BQEnterPlanetSurfaceFromSpace;
    let handoffCalls = 0;
    global.window.BQEnterPlanetSurfaceFromSpace = () => {
      handoffCalls += 1;
      return { ok: true };
    };

    const sys = new global.window.SpaceTravelSystem();
    const ship = new global.window.SpaceShip("shuttle", "Quiet Dock");
    const city = makeCity();
    expect(sys.beginLaunch(city, ship, null, "luna").ok).toBe(true);
    expect(sys.confirmLaunch().ok).toBe(true);
    expect(sys.completeAscent(true).ok).toBe(true);

    const state = sys.getCurrentSystemState();
    const target = state.bodies.find((body) => body.kind === "planet");
    state.ship.x = target.x;
    state.ship.y = target.y + target.radius + 10;
    expect(sys.dockNearestBody({ qteScore: 100 }).ok).toBe(true);

    const ticked = sys.tickFrame(32, {});
    expect(ticked.event).toBe("docked");
    expect(handoffCalls).toBe(0);

    const prevBackground = global.background;
    global.background = () => {};
    expect(() => sys.renderScene(800, 600)).not.toThrow();
    expect(handoffCalls).toBe(0);

    if (prevBackground === undefined) delete global.background;
    else global.background = prevBackground;
    global.window.BQEnterPlanetSurfaceFromSpace = prevHandoff;
  });

  test("builds the authored IPO campaign graph instead of procedural frontier filler", () => {
    const graphA = global.window.BQConfigureSpaceWorldGraph(101);
    const graphARepeat = global.window.BQConfigureSpaceWorldGraph(101);
    const graphB = global.window.BQConfigureSpaceWorldGraph(202);

    expect(Object.keys(graphA.systems).filter((key) => key.startsWith("frontier-"))).toHaveLength(0);
    const systemKeys = Object.keys(graphA.systems);
    for (const key of ["orbit", "luna", "solara", "verdana", "cryonis", "nebulith", "obsidium"]) {
      expect(systemKeys).toContain(key);
    }
    expect(graphA.systems.verdana.totalRegionScale).toBeGreaterThan(1);
    expect(graphA.systems.obsidium.storyRole).toContain("raymond");
    expect(graphARepeat.systems.verdana.label).toBe(graphA.systems.verdana.label);
    expect(graphB.systems.verdana.label).toBe(graphA.systems.verdana.label);

    global.window.BQConfigureSpaceWorldGraph(0);
  });

  test("space graph stays pinned when planet sessions change the runtime map seed", () => {
    const prevSeed = global.window._mapSeed;
    global.window._mapSeed = 101;
    const sys = new global.window.SpaceTravelSystem();
    const graphA = global.window.BQGetSpaceWorldGraph();
    const verdanaA = graphA.systems.verdana;

    global.window._mapSeed = 202;
    sys.getAvailableRoutes("orbit");
    const graphAfterPlanetSeed = global.window.BQGetSpaceWorldGraph();
    expect(graphAfterPlanetSeed.systems.verdana.label).toBe(verdanaA.label);
    expect(graphAfterPlanetSeed.systems.verdana.x).toBe(verdanaA.x);
    expect(sys.toJSON().graphSeed).toBe(101);

    const otherSys = new global.window.SpaceTravelSystem(202);
    const graphB = global.window.BQGetSpaceWorldGraph();
    expect(graphB.systems.verdana.label).toBe(verdanaA.label);
    expect(graphB.systems.verdana.x).toBe(verdanaA.x);
    expect(graphB.routes.length).toBe(graphA.routes.length);
    expect(otherSys.toJSON().graphSeed).toBe(202);

    if (prevSeed === undefined) delete global.window._mapSeed;
    else global.window._mapSeed = prevSeed;
    global.window.BQConfigureSpaceWorldGraph(0);
  });

  test("legacy space node aliases migrate onto authored campaign worlds", () => {
    expect(global.window.BQResolveSpaceNodeKey("aurelia")).toBe("verdana");
    expect(global.window.BQResolveSpaceNodeKey("vanta")).toBe("obsidium");

    const restored = global.window.SpaceTravelSystem.fromJSON({
      phase: "in_orbit",
      currentNode: "aurelia",
      targetNode: "vanta",
      activeShip: { type: "shuttle", name: "Alias Ship", condition: 100, fuel: 50, storage: [] },
      systemState: { nodeKey: "aurelia" },
    });

    expect(restored.currentNode).toBe("verdana");
    expect(restored.targetNode).toBe("obsidium");
    expect(restored.getCurrentSystemState().nodeKey).toBe("verdana");
  });

  test("retired IPO holdings migrate to a claimable payout and share buying is disabled", () => {
    const restored = global.window.SpaceTravelSystem.fromJSON({
      ipoHoldings: [
        { commodity: "MoonOre", shares: 2, buyPrice: 45 },
        { commodity: "AlienRelic", shares: 1, buyPrice: 200 },
      ],
      ipoPrices: { MoonOre: 50, AlienRelic: 220 },
    });
    const playerRef = { gold: 10 };

    expect(restored.getIPOStatus().retired).toBe(true);
    expect(restored.getIPOStatus().migrationCredit).toBe(320);
    expect(restored.buyIPOShares("MoonOre", 1, playerRef).ok).toBe(false);
    expect(restored.claimIPOMigrationCredit(playerRef)).toEqual({ ok: true, payout: 320 });
    expect(playerRef.gold).toBe(330);
    expect(restored.getIPOStatus().migrationCredit).toBe(0);
  });

  test("occupied bear corridors add route danger without blocking travel", () => {
    const prevBearGetter = global.window.BQGetBearEmpireSystem;
    global.window.BQGetBearEmpireSystem = () => ({
      getSystemStatus: () => null,
      getRoutePressure: () => ({
        active: true,
        dangerBonus: 0.28,
        fuelSurcharge: 3,
        routeThreat: 'occupied',
        alignment: 'neutral',
        resistanceKnown: false,
      }),
    });

    const sys = new global.window.SpaceTravelSystem();
    const ship = new global.window.SpaceShip("shuttle", "War Route");
    sys.activeShip = ship;
    sys.currentNode = "orbit";

    const route = sys.getRouteTo("luna");
    expect(route.conflict.routeThreat).toBe("occupied");
    expect(route.canAfford).toBe(true);
    expect(route.fuelCost).toBe(0);
    expect(route.dangerRating).toBeGreaterThan(route.baseDangerRating);

    global.window.BQGetBearEmpireSystem = prevBearGetter;
  });

  test("restores destroyed ship condition without reviving it", () => {
    const ship = global.window.SpaceShip.fromJSON({
      type: "shuttle",
      name: "Broken Shuttle",
      condition: 0,
      fuel: 5,
      storage: [],
    });

    expect(ship.condition).toBe(0);
  });
});
