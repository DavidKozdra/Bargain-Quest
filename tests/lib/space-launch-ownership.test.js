const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const gameSource = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf8');
const helperStart = gameSource.indexOf('function _playerOwnsLaunchCity(');
const helperEnd = gameSource.indexOf('function _launchToSpaceFromCity(', helperStart);
const helperSource = gameSource.slice(helperStart, helperEnd);

function loadHelper(overrides = {}) {
  const city = overrides.city || { name: 'Capital', _isManagedCity: true };
  const context = {
    window: { BQGetWorldSession: () => ({ key: 'homeworld' }) },
    cities: overrides.cities || [city],
    player: overrides.player || { ownedCities: [], ownsCity: () => false },
    cityManagement: overrides.cityManagement || { isSettled: true, myCity: city },
  };
  vm.runInNewContext(`${helperSource}\nthis.helper = _playerOwnsLaunchCity;`, context);
  return { helper: context.helper, context, city };
}

describe('space launch city ownership', () => {
  test('repairs and accepts the standalone managed capital', () => {
    const { helper, context, city } = loadHelper();

    assert.equal(helper(city), true);
    assert.deepEqual(Array.from(context.player.ownedCities), [0]);
  });

  test('still rejects an unrelated managed city', () => {
    const capital = { name: 'Capital', _isManagedCity: true };
    const other = { name: 'Other', _isManagedCity: true };
    const { helper } = loadHelper({ city: other, cities: [capital, other], cityManagement: { isSettled: true, myCity: capital } });

    assert.equal(helper(other), false);
  });

  test('still rejects a homeworld capital while an off-world session is active', () => {
    const { helper, context, city } = loadHelper();
    context.window.BQGetWorldSession = () => ({ key: 'mars' });

    assert.equal(helper(city), false);
  });
});
