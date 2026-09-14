const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf8');
const start = source.indexOf('function _isPlanetSurfaceControlActive()');
const end = source.indexOf('\nfunction _withSessionDimensions', start);

function createHarness(initialState) {
  assert(start >= 0 && end > start);
  const GameStates = {
    PLANET_SURFACE: 'planetSurface',
    SPACE: 'space',
    COMBAT: 'combat',
    INVENTORY: 'inventory',
    PAUSED: 'paused',
  };
  const system = { phase: 'landed' };
  const session = { sessionType: 'planet_surface' };
  const context = vm.createContext({
    GameStates,
    gameStateManager: { currentState: initialState },
    _getActiveSpaceSystem: () => system,
    _isPlanetSurfaceSession: (value) => value?.sessionType === 'planet_surface',
    getWorldSession: () => session,
  });
  vm.runInContext(`${source.slice(start, end)}\nthis.hasPlanetControls = _isPlanetSurfaceControlActive;`, context);
  return { context, GameStates, system, session };
}

describe('planet surface input lock', () => {
  test('allows controls only in the planet surface and space handoff states', () => {
    const fixture = createHarness('planetSurface');

    expect(fixture.context.hasPlanetControls()).toBe(true);
    fixture.context.gameStateManager.currentState = fixture.GameStates.SPACE;
    expect(fixture.context.hasPlanetControls()).toBe(true);
  });

  test('combat and modal states cannot inherit planet movement controls', () => {
    const fixture = createHarness('combat');

    expect(fixture.context.hasPlanetControls()).toBe(false);
    fixture.context.gameStateManager.currentState = fixture.GameStates.INVENTORY;
    expect(fixture.context.hasPlanetControls()).toBe(false);
    fixture.context.gameStateManager.currentState = fixture.GameStates.PAUSED;
    expect(fixture.context.hasPlanetControls()).toBe(false);
  });

  test('requires both a landed ship and an active planet session', () => {
    const fixture = createHarness('planetSurface');

    fixture.system.phase = 'in_orbit';
    expect(fixture.context.hasPlanetControls()).toBe(false);
    fixture.system.phase = 'landed';
    fixture.session.sessionType = 'homeworld';
    expect(fixture.context.hasPlanetControls()).toBe(false);
  });
});
