describe("SpaceTravelSystem phase rules", () => {
  const prevWindow = global.window;
  const prevCity = global.City;
  const prevSpaceShip = global.SpaceShip;
  const prevSpaceTravelSystem = global.SpaceTravelSystem;

  beforeAll(() => {
    global.window = global.window || {};
    global.City = {
      getSpacePlanets() {
        return [
          { key: "aurelia", name: "Aurelia Bloom" },
          { key: "vanta", name: "Vanta Rift" },
        ];
      },
    };
    require("../../classes/SpaceTravelSystem.js");
    global.SpaceShip = global.window.SpaceShip;
    global.SpaceTravelSystem = global.window.SpaceTravelSystem;
  });

  afterAll(() => {
    if (prevWindow === undefined) delete global.window;
    else global.window = prevWindow;

    if (prevCity === undefined) delete global.City;
    else global.City = prevCity;

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

  function launchIntoOrbit() {
    const sys = new global.window.SpaceTravelSystem();
    const ship = new global.window.SpaceShip("shuttle", "Test Ship");
    const city = makeCity();
    expect(sys.beginLaunch(city, ship).ok).toBe(true);
    expect(sys.confirmLaunch().ok).toBe(true);
    expect(sys.completeAscent(true).ok).toBe(true);
    return { sys, ship, city };
  }

  test("requires lift-off before routing away from a landed planet", () => {
    const { sys } = launchIntoOrbit();

    expect(sys.beginRoute("aurelia").ok).toBe(true);
    expect(sys.tickTravel(999999).event).toBe("arrived");
    expect(sys.completeDocking(true)).toEqual({ ok: true, landed: true, node: "aurelia" });
    expect(sys.phase).toBe("landed");
    expect(sys.beginRoute("vanta")).toEqual({ ok: false, reason: "wrong_phase" });

    expect(sys.liftOff().ok).toBe(true);
    expect(sys.phase).toBe("in_orbit");
    expect(sys.currentNode).toBe("aurelia");
  });

  test("only allows re-entry from home orbit and applies qte damage once", () => {
    const { sys, ship } = launchIntoOrbit();

    expect(sys.beginRoute("luna").ok).toBe(true);
    expect(sys.tickTravel(999999).event).toBe("arrived");
    expect(sys.completeDocking(true)).toEqual({ ok: true, landed: false, node: "luna" });
    expect(sys.beginReentry()).toEqual({ ok: false, reason: "not_home_orbit" });

    expect(sys.beginRoute("orbit").ok).toBe(true);
    expect(sys.tickTravel(999999).event).toBe("arrived");
    expect(sys.completeDocking(true)).toEqual({ ok: true, landed: false, node: "orbit" });

    const conditionBeforeReentry = ship.condition;
    expect(sys.beginReentry().ok).toBe(true);
    expect(sys.completeReentry(true, 5)).toEqual({ ok: true, damage: 5 });
    expect(ship.condition).toBe(conditionBeforeReentry - 5);
    expect(sys.phase).toBe("grounded");
  });

  test("uses provided docking damage for failed qte results", () => {
    const { sys, ship } = launchIntoOrbit();

    expect(sys.beginRoute("luna").ok).toBe(true);
    expect(sys.tickTravel(999999).event).toBe("arrived");

    const conditionBeforeDock = ship.condition;
    expect(sys.completeDocking(false, 6)).toEqual({
      ok: false,
      reason: "docking_failed",
      damage: 6,
      landed: false,
    });
    expect(ship.condition).toBe(conditionBeforeDock - 6);
    expect(sys.phase).toBe("in_orbit");
  });
});
