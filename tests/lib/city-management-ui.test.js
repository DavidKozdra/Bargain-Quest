const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const cityManagementUi = fs.readFileSync(path.join(root, 'ui/cityManagement.js'), 'utf8');
const citySource = fs.readFileSync(path.join(root, 'classes/Cities.js'), 'utf8');

describe('minimal city management UI', () => {
  test('exposes City, Build, Inventory, Research, and unlocked Trade', () => {
    assert.match(cityManagementUi, /const CITY_MGMT_CORE_TABS = \["overview", "build", "inventory", "research", "trade"\]/);
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

  test('limits construction to the simple building types including universities', () => {
    const start = cityManagementUi.indexOf('const CITY_MGMT_SIMPLE_BUILDINGS');
    const end = cityManagementUi.indexOf('function _getCityMgmtSimpleBuildType', start);
    const buildings = cityManagementUi.slice(start, end);
    for (const key of ['farm', 'winery', 'housing', 'school', 'university', 'forge', 'market']) {
      assert.match(buildings, new RegExp(`key: "${key}"`));
    }
    assert.doesNotMatch(buildings, /bank|policy|wall|district|warehouse/i);
    assert.match(buildings, /Market[\s\S]*12 gold/);
    assert.match(cityManagementUi, /simple_crop_rotation[\s\S]*50% more food/);
    assert.match(cityManagementUi, /simple_town_planning[\s\S]*maximum population by 180/);
    assert.match(cityManagementUi, /simple_marketplaces[\s\S]*18 gold/);
  });

  test('offers local gathering minigames from the simple Build screen', () => {
    const start = cityManagementUi.indexOf('function _buildSimpleBuildScreen');
    const end = cityManagementUi.indexOf('function _buildSimpleInventoryScreen', start);
    const buildScreen = cityManagementUi.slice(start, end);
    assert.match(buildScreen, /Gather local supplies/);
    assert.match(buildScreen, /getGatherOptions/);
    assert.match(buildScreen, /Play gathering game/);
    assert.match(buildScreen, /launchGathering/);
    assert.match(buildScreen, /city inventory/);
  });

  test('lets the player price city stock and advertise item demand', () => {
    const start = cityManagementUi.indexOf('function _buildSimpleInventoryScreen');
    const end = cityManagementUi.indexOf('function _buildSimpleResearchScreen', start);
    const inventory = cityManagementUi.slice(start, end);
    assert.match(inventory, /For sale/);
    assert.match(inventory, /Default \$\{quote\.defaultPrice\}g/);
    assert.match(inventory, /setManagedSalePrice/);
    assert.match(inventory, /Advertise demand/);
    assert.match(inventory, /setManagedDemandOrder/);
    assert.match(inventory, /directly into the city treasury/);
    assert.match(inventory, /_createCityMgmtImageSelect/);
    assert.match(inventory, /frame: key/);
    assert.doesNotMatch(inventory, /createSelect\(\)/);
  });

  test('uses accessible image choices instead of native city-management selects', () => {
    assert.match(cityManagementUi, /function _createCityMgmtImageSelect/);
    assert.match(cityManagementUi, /aria-haspopup", "listbox/);
    assert.match(cityManagementUi, /citymgmt-simple-image-select-option/);
    assert.match(cityManagementUi, /choice\?\.frame/);
    assert.match(cityManagementUi, /\["Enter", " "\][\s\S]*choose\(choices\[index\]\.value\)/);
  });

  test('uses a simple research tree with knowledge, growth, commerce, craft, and future branches', () => {
    assert.match(citySource, /simple_schools[\s\S]*researchCost: 2[\s\S]*simple_universities[\s\S]*researchCost: 10[\s\S]*simple_learned_culture[\s\S]*researchCost: 20/);
    assert.match(citySource, /key: 'growth'[\s\S]*simple_crop_rotation[\s\S]*simple_town_planning[\s\S]*simple_multitasking/);
    assert.match(citySource, /key: 'commerce'[\s\S]*simple_marketplaces[\s\S]*simple_trade[\s\S]*simple_merchant_guilds/);
    assert.match(citySource, /key: 'craft'[\s\S]*simple_forging[\s\S]*weapon-forging minigame/);
    assert.match(cityManagementUi, /getSimpleResearchTree/);
    assert.match(cityManagementUi, /Choose a branch/);
    assert.match(citySource, /hasSimpleResearch\('simple_multitasking'\) \? 2 : 1/);
    assert.match(citySource, /node\.key === 'simple_space'[\s\S]*this\.hasSpaceport = true/);
  });

  test('starts automatic trade with only a town selection', () => {
    const start = cityManagementUi.indexOf('function _buildSimpleTradeScreen');
    const end = cityManagementUi.indexOf('// ─── Panel Refresh', start);
    const trade = cityManagementUi.slice(start, end);
    assert.match(trade, /_createCityMgmtImageSelect/);
    assert.match(trade, /frame: "Shield"/);
    assert.doesNotMatch(trade, /createSelect\(\)/);
    assert.match(trade, /Start Trade/);
    assert.match(trade, /frequencyDays: 7/);
    assert.match(trade, /itemsToSend: \[\]/);
    assert.doesNotMatch(trade, /createInput|route map|threat|ledger/i);
  });
});
