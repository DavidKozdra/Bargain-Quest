const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf8');
const start = source.indexOf('function _hashWorldSessionSeed(');
const end = source.indexOf('\nfunction _isPlanetSurfaceSession', start);

function loadSeedHelpers() {
  assert(start >= 0 && end > start);
  const context = vm.createContext({ Math, Number });
  vm.runInContext(
    `${source.slice(start, end)}\nthis.surfaceSeed = _planetWorldGenerationSeed; this.surfaceRng = _createPlanetWorldRng;`,
    context,
  );
  return context;
}

describe('seeded planet generation', () => {
  test('derives stable planet terrain seeds from campaign, system, and body', () => {
    const helpers = loadSeedHelpers();
    const body = { key: 'solara', name: 'Solara Prime' };
    const first = helpers.surfaceSeed(101, 'solara', body);

    expect(helpers.surfaceSeed(101, 'solara', body)).toBe(first);
    expect(helpers.surfaceSeed(202, 'solara', body)).not.toBe(first);
    expect(helpers.surfaceSeed(101, 'cryonis', body)).not.toBe(first);
    expect(helpers.surfaceSeed(101, 'solara', { key: 'solara-moon' })).not.toBe(first);
  });

  test('planet generation streams replay without depending on visit order', () => {
    const helpers = loadSeedHelpers();
    const sample = (seed, stream) => {
      const rng = helpers.surfaceRng(seed, stream);
      return [rng(), rng(), rng(), rng()];
    };

    expect(JSON.stringify(sample(9182, 'cities'))).toBe(JSON.stringify(sample(9182, 'cities')));
    expect(JSON.stringify(sample(9182, 'cities'))).not.toBe(JSON.stringify(sample(9183, 'cities')));
    expect(JSON.stringify(sample(9182, 'cities'))).not.toBe(JSON.stringify(sample(9182, 'dig-sites')));
  });
});
