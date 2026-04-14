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

    const liftResult = sys.liftOff();
    expect(liftResult.ok).toBe(true);
    expect(sys.phase).toBe("in_orbit");
    expect(sys.currentBodyKey).toBe(null);
  });
});
