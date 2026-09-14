const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const atlasPath = path.resolve(__dirname, '../../assets/atlas/items_atlas.js');

function loadAtlasData() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(atlasPath, 'utf8'), context, { filename: atlasPath });
  return vm.runInContext('ITEMS_ATLAS_DATA', context);
}

describe('item atlas frame mappings', () => {
  test('cash uses the gold coin rather than the Earth sprite', () => {
    const { frames } = loadAtlasData();

    assert.deepEqual({ ...frames.Cash }, { x: 24, y: 0 });
    assert.deepEqual({ ...frames.Globe }, { x: 216, y: 72 });
    assert.notDeepEqual({ ...frames.Cash }, { ...frames.Globe });
  });

  test('the ancient coin uses the silver coin cell rather than Earth', () => {
    const { frames } = loadAtlasData();

    assert.deepEqual({ ...frames.AncientCoin }, { x: 48, y: 0 });
    assert.notDeepEqual({ ...frames.AncientCoin }, { ...frames.Globe });
  });
});
