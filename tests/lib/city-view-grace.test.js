const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const gameSource = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const blockStart = gameSource.indexOf('function _getPlayerTileCity()');
const blockEndMarker = "if (typeof window !== 'undefined') window.BQCloseCityView = _closeCityView;";
const blockEnd = gameSource.indexOf(blockEndMarker, blockStart) + blockEndMarker.length;
assert(blockStart >= 0 && blockEnd > blockStart, 'Missing city-view control block');

function harness() {
  let now = 1000;
  const calls = { shown: 0, hidden: 0, cancelled: 0 };
  const city = { name: 'Harbor', location: { x: 0, y: 0 } };
  const otherCity = { name: 'Market', location: { x: 2, y: 0 } };
  const player = {
    x: 0, y: 0, currentCity: city, currentTileCity: city, path: [{ x: 1, y: 0 }], pathMoveTimer: 50,
    cancelPath() { calls.cancelled++; },
  };
  const context = vm.createContext({
    player,
    cities: [city, otherCity],
    cityLocationMap: new Map([['0,0', city], ['2,0', otherCity]]),
    Date: { now: () => now },
    window: {},
    _getCityAtTile(x, y) { return context.cityLocationMap.get(`${x},${y}`) || null; },
    findNearestSafeTile: () => ({ x: 1, y: 0 }),
    select: () => ({ style() {} }),
    uiManager: {
      showScreen(name) { assert.equal(name, 'cityView'); calls.shown++; },
      hideScreen(name) { assert.equal(name, 'cityView'); calls.hidden++; },
    },
  });
  vm.runInContext(gameSource.slice(blockStart, blockEnd), context);
  return { context, player, city, otherCity, calls, setNow(value) { now = value; } };
}

describe('city re-entry grace period', () => {
  test('leaving blocks the same city for two real-time seconds', () => {
    const h = harness();
    assert.equal(h.context._closeCityView({ leaveTile: true }).ok, true);
    assert.deepEqual([h.player.x, h.player.y], [1, 0]);
    assert.equal(h.calls.hidden, 1);

    let result = h.context._openCityView(h.city);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'reentry_grace');
    assert.equal(result.remainingMs, 2000);
    assert.equal(h.calls.shown, 0);

    h.setNow(2999);
    result = h.context._openCityView(h.city);
    assert.equal(result.reason, 'reentry_grace');
    assert.equal(result.remainingMs, 1);

    h.setNow(3000);
    assert.equal(h.context._openCityView(h.city).ok, true);
    assert.equal(h.calls.shown, 1);
  });

  test('the grace period does not block entering a different city', () => {
    const h = harness();
    h.context._closeCityView({ leaveTile: true });
    assert.equal(h.context._openCityView(h.otherCity).ok, true);
    assert.equal(h.player.currentCity, h.otherCity);
  });

  test('closing without leaving the tile does not start the grace period', () => {
    const h = harness();
    h.context._closeCityView({ leaveTile: false });
    assert.equal(h.context._openCityView(h.city).ok, true);
  });
});
