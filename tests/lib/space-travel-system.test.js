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

  function makeCity() {
    return {
      name: "Harbor",
      hasSpaceport: true,
      progression: {
        spaceAccess: { launchReady: true },
      },
    };
  }

  test("launches into the selected star system and generates a live system state", () => {
    const sys = new global.window.SpaceTravelSystem();
    const ship = new global.window.SpaceShip("shuttle", "Test Ship");
    const city = makeCity();

    expect(sys.beginLaunch(city, ship, null, "aurelia")).toEqual({ ok: true, destination: "aurelia" });
    expect(sys.confirmLaunch().ok).toBe(true);
    expect(sys.completeAscent(true)).toEqual({ ok: true, node: "aurelia" });
    expect(sys.phase).toBe("in_orbit");
    expect(sys.currentNode).toBe("aurelia");
    expect(sys.getCurrentSystemState().nodeKey).toBe("aurelia");
    expect(Array.isArray(sys.getCurrentSystemState().bodies)).toBe(true);
    expect(sys.getCurrentSystemState().bodies.length > 0).toBe(true);
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

    expect(sys.beginLaunch(city, ship, null, "aurelia").ok).toBe(true);
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

  test("builds a seeded frontier graph that changes between runs", () => {
    const graphA = global.window.BQConfigureSpaceWorldGraph(101);
    const frontierA = Object.keys(graphA.systems).filter((key) => key.startsWith("frontier-"));
    const firstA = frontierA[0];

    const graphARepeat = global.window.BQConfigureSpaceWorldGraph(101);
    const graphB = global.window.BQConfigureSpaceWorldGraph(202);
    const frontierB = Object.keys(graphB.systems).filter((key) => key.startsWith("frontier-"));
    const firstB = frontierB[0];

    expect(frontierA.length).toBeGreaterThanOrEqual(4);
    expect(graphARepeat.systems[firstA].label).toBe(graphA.systems[firstA].label);
    expect(graphARepeat.systems[firstA].x).toBe(graphA.systems[firstA].x);
    expect(
      graphB.systems[firstB].label !== graphA.systems[firstA].label
      || graphB.systems[firstB].x !== graphA.systems[firstA].x
      || graphB.routes.length !== graphA.routes.length
    ).toBe(true);

    global.window.BQConfigureSpaceWorldGraph(0);
  });
});
