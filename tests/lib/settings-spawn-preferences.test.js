const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
const gameSource = read('game.js');

function fixture() {
  const stored = new Map([
    ['pref_ai_radius', '40'], ['pref_ai_skip', '32'], ['pref_spawn_rate', '1.5'],
  ]);
  const reads = [];
  const c = vm.createContext({
    rows: 1500, cols: 1500, window: {},
    localStorage: {
      getItem(key) { reads.push(key); return stored.get(key) ?? null; },
      setItem(key, value) { stored.set(key, String(value)); },
    },
  });
  const radiusDeclaration = gameSource.match(/^let TRADER_NOTICE_RADIUS = [^;]+;/m)[0];
  vm.runInContext(radiusDeclaration + '\n' + gameSource.slice(
    gameSource.indexOf('function _tuneAIForMapSize()'),
    gameSource.indexOf('function _isCityTile('),
  ), c);
  return { c, stored, reads };
}

describe('trader settings after simulation throttling retirement', () => {
  test('settings expose and save only the active spawn preference', () => {
    const { c, stored, reads } = fixture();
    const settingsSource = read('ui/settings.js');
    vm.runInContext(settingsSource.slice(0, settingsSource.indexOf('function _applySettingsTabState'))
      + ';globalThis.sliderRows = SETTINGS_AI_ROWS;', c);
    assert.deepEqual(Array.from(c.sliderRows, row => row.key), ['pref_spawn_rate']);
    const label = {};
    c.select = selector => {
      assert.equal(selector, '#spawnRateSlider');
      return { value: () => 1.8 };
    };
    c.document = { getElementById: () => label };
    const uiSource = read('ui.js');
    const from = uiSource.indexOf('function saveAISettings()');
    vm.runInContext(uiSource.slice(from, uiSource.indexOf('// ============================', from)), c);
    c.saveAISettings();
    assert.equal(stored.get('pref_spawn_rate'), '1.8');
    assert.equal(c.window.TRADER_SPAWN_RATE, 1.8);
    assert.equal(label.textContent, '1.8');
    assert.deepEqual(reads, ['pref_spawn_rate']);
    assert.equal(stored.get('pref_ai_radius'), '40');
    assert.equal(stored.get('pref_ai_skip'), '32');
  });

  test('world-size calibration changes notification distance without reading retired preferences', () => {
    const { c, reads } = fixture();
    c._tuneAIForMapSize();
    assert.equal(vm.runInContext('TRADER_NOTICE_RADIUS', c), 105);
    assert.equal(c.window.TRADER_SPAWN_RATE, 1.5);
    c.rows = 500;
    c._tuneAIForMapSize();
    assert.equal(vm.runInContext('TRADER_NOTICE_RADIUS', c), 80);
    c.rows = c.cols = 10000;
    c._tuneAIForMapSize();
    assert.equal(vm.runInContext('TRADER_NOTICE_RADIUS', c), 200);
    assert(reads.every(key => key === 'pref_spawn_rate'));
  });

  test('spawn preferences preserve supported bounds and reset invalid values', () => {
    const { c, stored } = fixture();
    for (const [value, expected] of [['0.5', 0.5], ['2', 2], ['0.4', 1], ['2.1', 1], ['invalid', 1], [null, 1]]) {
      if (value === null) stored.delete('pref_spawn_rate');
      else stored.set('pref_spawn_rate', value);
      c._applyAIPrefs();
      assert.equal(c.window.TRADER_SPAWN_RATE, expected);
    }
  });

  test('rivalry notifications use the renamed distance with an inclusive boundary', () => {
    const { c } = fixture();
    c._tuneAIForMapSize();
    const messages = [];
    c.player = { x: 0, y: 0 };
    c.notificationManager = { log: message => messages.push(message) };
    vm.runInContext(read('classes/TraderManager.js') + ';globalThis.Manager = TraderManager;', c);
    const notify = c.Manager.prototype._notifyRivalry;
    notify.call({}, { x: 105, y: 0, name: 'Near' }, { x: 500, y: 0, name: 'Far' });
    notify.call({}, { x: 106, y: 0, name: 'Outside' }, { x: 500, y: 0, name: 'Far' });
    assert.equal(messages.length, 1);
    assert(messages[0].includes('Near'));
  });
});
