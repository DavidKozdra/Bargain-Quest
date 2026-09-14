const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const cityManagementUi = fs.readFileSync(path.join(root, 'ui/cityManagement.js'), 'utf8');
const citySource = fs.readFileSync(path.join(root, 'classes/Cities.js'), 'utf8');

describe('minimal city management UI', () => {
  test('exposes only City, Build, Research, and unlocked Trade', () => {
    assert.match(cityManagementUi, /const CITY_MGMT_CORE_TABS = \["overview", "build", "research", "trade"\]/);
    assert.match(cityManagementUi, /tabKey !== "trade" \|\| _cityHasSimpleResearch\(cityManagement\?\.myCity, "simple_trade"\)/);
    assert.doesNotMatch(cityManagementUi, /id\("citymgmtAdvancedToggle"\)/);
    assert.doesNotMatch(cityManagementUi, /id\("citymgmtAdvancedNav"\)/);
    assert.doesNotMatch(cityManagementUi, /id\("citymgmtSecondaryNav"\)/);
  });

  test('renders the small overview plus a clear tax and happiness control', () => {
    const start = cityManagementUi.indexOf('function _buildSimpleCityOverview');
    const end = cityManagementUi.indexOf('function _buildSimpleBuildScreen', start);
    const overview = cityManagementUi.slice(start, end);
    assert.match(overview, /label: "City"/);
    assert.match(overview, /label: "Gold"/);
    assert.match(overview, /label: "Population"/);
    assert.match(overview, /"Tax Rate"/);
    assert.match(overview, /Happiness/);
    assert.match(overview, /each day to city treasury/);
    assert.match(overview, /createSlider\(0, 25/);
    assert.doesNotMatch(overview, /Food|Threat|Policy|Agenda/);
  });

  test('limits construction to the five simple building types', () => {
    const start = cityManagementUi.indexOf('const CITY_MGMT_SIMPLE_BUILDINGS');
    const end = cityManagementUi.indexOf('function _getCityMgmtSimpleBuildType', start);
    const buildings = cityManagementUi.slice(start, end);
    for (const key of ['farm', 'winery', 'housing', 'school', 'market']) {
      assert.match(buildings, new RegExp(`key: "${key}"`));
    }
    assert.doesNotMatch(buildings, /bank|policy|wall|district|warehouse|weapon/i);
    assert.match(buildings, /Market[\s\S]*12 gold/);
  });

  test('uses one research line for winery, schools, multitasking, trade, and space', () => {
    assert.match(citySource, /simple_winery[\s\S]*simple_schools[\s\S]*simple_multitasking[\s\S]*simple_trade[\s\S]*simple_space/);
    assert.match(citySource, /hasSimpleResearch\('simple_multitasking'\) \? 2 : 1/);
    assert.match(citySource, /node\.key === 'simple_space'[\s\S]*this\.hasSpaceport = true/);
  });

  test('starts automatic trade with only a town selection', () => {
    const start = cityManagementUi.indexOf('function _buildSimpleTradeScreen');
    const end = cityManagementUi.indexOf('// ─── Panel Refresh', start);
    const trade = cityManagementUi.slice(start, end);
    assert.match(trade, /createSelect\(\)/);
    assert.match(trade, /Start Trade/);
    assert.match(trade, /frequencyDays: 7/);
    assert.match(trade, /itemsToSend: \[\]/);
    assert.doesNotMatch(trade, /createInput|route map|threat|ledger/i);
  });
});
