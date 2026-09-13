const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const uiSource = fs.readFileSync(path.join(root, 'ui.js'), 'utf8');
const servicesStart = uiSource.indexOf('if (tab === "services") {', uiSource.indexOf('//  SERVICES TAB'));
const servicesEnd = uiSource.indexOf('//  INFO TAB', servicesStart);
assert(servicesStart > 0 && servicesEnd > servicesStart, 'Missing Services/Info branch boundaries');
const servicesSource = uiSource.slice(servicesStart, servicesEnd);

function harness(overrides = {}) {
  const calls = { states: [], notices: [], refreshes: 0, confirmations: [] };
  function element(tag, text = '') {
    const classes = new Set();
    const elt = {
      tagName: tag, text: String(text), children: [], styles: {}, attributes: {}, classes,
      classList: { add: (...names) => names.forEach(name => classes.add(name)) },
      appendChild(child) { this.children.push(child); return child; },
    };
    const wrapped = {
      elt,
      class(names) { classes.clear(); names.split(/\s+/).filter(Boolean).forEach(name => classes.add(name)); return this; },
      addClass(names) { names.split(/\s+/).filter(Boolean).forEach(name => classes.add(name)); return this; },
      style(name, value) { elt.styles[name] = value; return this; },
      attribute(name, value) { elt.attributes[name] = value; return this; },
      parent(parent) { (parent.elt || parent).appendChild(elt); return this; },
      html(text) { elt.text = String(text); elt.children = []; return this; },
      mousePressed(callback) { elt.onPress = callback; return this; },
    };
    return wrapped;
  }
  const panel = element('div');
  const context = vm.createContext({
    window: {}, player: {},
    GameStates: { BOUNTY_BOARD: 'bounty', BANK: 'bank', GAMBLING: 'gambling', BLACK_MARKET: 'blackMarket', SPACE: 'space' },
    gameStateManager: { setState: state => calls.states.push(state) },
    uiManager: { screens: { cityView: { show: () => calls.refreshes++ } } },
    notificationManager: { log: (message, kind) => calls.notices.push({ message, kind }) },
    confirm: message => { calls.confirmations.push(message); return context.confirmResult; },
    confirmResult: true,
    select: selector => { assert.equal(selector, '#cityTab_services'); return panel; },
    createDiv: () => element('div'), createSpan: text => element('span', text),
    createP: text => element('p', text), createButton: text => element('button', text),
    createElement: (tag, text) => element(tag, text),
    createAtlasIconEl: frame => { const icon = element('canvas').elt; icon.frame = frame; return icon; },
    appendAtlasIcon: (host, frame) => { const icon = element('canvas').elt; icon.frame = frame; (host.elt || host).appendChild(icon); },
    atlasIconHTML: frame => `<icon data-frame="${frame}"></icon>`,
    ItemLibrary: {}, dayNight: { getDaysElapsed: () => 10 },
    ...overrides,
  });
  vm.runInContext(`this.renderServices = function(city, tab = 'services') {\n${servicesSource}\n};`, context);
  function nodes(parent = panel.elt) {
    return parent.children.flatMap(child => [child, ...nodes(child)]);
  }
  function withClass(name) { return nodes().filter(node => node.classes.has(name)); }
  function button(text) {
    const matches = nodes().filter(node => node.tagName === 'button' && (typeof text === 'string' ? node.text === text : text.test(node.text)));
    assert.equal(matches.length, 1, `Expected one button matching ${text}; found ${matches.length}`);
    assert.equal(typeof matches[0].onPress, 'function', `Unbound button ${matches[0].text}`);
    return matches[0];
  }
  return { context, panel, calls, nodes, withClass, button,
    render: city => context.renderServices(city || { name: 'Harbor' }) };
}

function shipFixture() {
  const events = { repairs: [], upgrades: [], bought: [], selected: [], captainTiers: [] };
  const inventory = new Map([['Wood', { quantity: 2 }], ['Book', { quantity: 1 }],
    ['Bag', { quantity: 1 }], ['Sword', { quantity: 1 }], ['Armor', { quantity: 1 }], ['Relic', { quantity: 1 }]]);
  const storage = new Map([['Fish', { quantity: 1 }]]);
  const adjust = (map, key, amount) => {
    const quantity = (map.get(key)?.quantity || 0) + amount;
    if (quantity > 0) map.set(key, { quantity }); else map.delete(key);
  };
  const levels = { cargoPods: 0, hullPlating: 3, navComputer: 1 };
  const ship = {
    name: 'Wayfarer', displayName: 'Scout', condition: 70, attack: 4, crewSize: 2, captain: null, storage,
    getStorageWeight: () => [...storage.values()].reduce((sum, entry) => sum + entry.quantity, 0),
    getStorageCapacity: () => 16,
    addItemToStorage(key, quantity) { adjust(storage, key, quantity); return true; },
    removeItemFromStorage(key, quantity) { adjust(storage, key, -quantity); return true; },
    getRepairCost: () => ({ goldOnly: 120 }),
    repair(amount) { events.repairs.push(amount); this.condition = Math.min(100, this.condition + amount); },
    getUpgradeLevel: key => levels[key],
    getUpgradeCost: key => levels[key] === 3 ? null : key === 'cargoPods' ? 50 : 100,
    installUpgrade(key) { events.upgrades.push(key); return { ok: true, level: ++levels[key] }; },
  };
  const second = { name: 'Reserve', displayName: 'Transport' }, travelSystem = {};
  const player = {
    inventory, gold: 1000, spaceTravel: { spaceFleet: [ship, second], activeShipIndex: 0 },
    getActiveSpaceShip() { return this.spaceTravel.spaceFleet[this.spaceTravel.activeShipIndex]; },
    removeItemQuantity(key, quantity) { adjust(inventory, key, -quantity); return true; },
    addItem({ name, quantity }) { adjust(inventory, name, quantity); return true; },
    spendGold(amount) { this.gold -= amount; },
    buySpaceShip(type) {
      events.bought.push(type);
      const purchased = { name: 'New Horizon', displayName: 'Courier' };
      this.spaceTravel.spaceFleet.push(purchased);
      return { ok: true, ship: purchased };
    },
    selectSpaceShip(index) { events.selected.push(index); this.spaceTravel.activeShipIndex = index; },
    getSpaceTravelSystem: () => travelSystem,
  };
  const h = harness({
    player,
    ItemLibrary: { Wood: { name: 'Wood' }, Fish: { name: 'Fish' }, Book: { tags: new Set(['book']) },
      Bag: { tags: new Set(['bag']) }, Sword: { category: 'Weapon' }, Armor: { category: 'Armor' }, Relic: { tradable: false } },
    SpaceCaptainLibrary: { cadet: { label: 'Cadet', hireCost: 20 } },
    createSpaceCaptainProfile(tier) { events.captainTiers.push(tier); return { name: 'Aster', label: 'Cadet' }; },
    SpaceShipLibrary: { courier: { displayName: 'Courier', cost: 300 } },
  });
  h.render({ name: 'Harbor', hasSpaceport: true });
  return { ...h, player, ship, inventory, storage, levels, events, second, travelSystem };
}

describe('Services tab gameplay bindings', () => {
  test('each city service retains its state destination and current service-city reference', () => {
    const mapping = { bountyBoard: 'bounty', bank: 'bank', gamblingDen: 'gambling', blackMarket: 'blackMarket',
      researchLab: null, spaceport: 'space', alienExchange: 'space', custom: null };
    const city = { name: 'Crossroads', getCityFeatures: () => Object.keys(mapping).map(id => ({ id, label: id, emoji: '?' })) };
    const h = harness();
    h.render(city);
    const cards = h.withClass('svc-card');
    assert.equal(cards.length, Object.keys(mapping).length);
    for (const [id, state] of Object.entries(mapping)) {
      const card = cards.find(node => node.attributes['data-svc'] === id);
      assert(card, `Missing ${id} card`);
      const button = h.nodes(card).find(node => node.tagName === 'button');
      const count = h.calls.states.length;
      button.onPress();
      assert.equal(h.context.window._currentServiceCity, city);
      assert.equal(h.calls.states.length, count + (state ? 1 : 0));
      if (state) assert.equal(h.calls.states[h.calls.states.length - 1], state);
    }
  });

  test('a city without optional services or systems renders safely and clears the previous content', () => {
    const h = harness();
    h.panel.elt.appendChild({ text: 'Old screen', children: [], classes: new Set() });
    h.render({ name: 'Outpost' });
    h.render({ name: 'Outpost' });
    assert.equal(h.withClass('svc-scroll').length, 1);
    assert.equal(h.withClass('svc-empty').length, 1);
    assert(h.nodes().some(node => node.text === 'This city has no special services.'));
    assert(!h.nodes().some(node => node.text === 'Old screen'));
    assert.equal(h.nodes().filter(node => node.tagName === 'button').length, 0);
  });

  test('cached contracts retain accept and confirmed-abandon callbacks with the original contract objects', () => {
    const offered = { type: 'survey', reward: 80, title: 'Chart the coast', surveyPoints: [{}, {}], deadline: 11 };
    const active = { type: 'survey', reward: 120, title: 'Northern passage', surveyVisited: [true, false, true] };
    const accepted = [], abandoned = [];
    const h = harness({ contractSystem: {
      getContractsForCity(name) { assert.equal(name, 'Harbor'); return [offered]; },
      generateForCity() { throw new Error('Cached contracts must not be regenerated'); },
      active: [active], acceptContract: contract => accepted.push(contract), abandonContract: contract => abandoned.push(contract),
    } });
    h.render();
    assert(h.withClass('svc-ac-text').some(node => node.text === 'Northern passage (2/3 surveyed)'));
    h.button('Accept Contract').onPress();
    assert.equal(accepted[0], offered);
    assert.equal(h.calls.refreshes, 1);
    h.context.confirmResult = false;
    h.button('✕ Cancel').onPress();
    assert.equal(abandoned.length, 0);
    assert.equal(h.calls.refreshes, 1);
    h.context.confirmResult = true;
    h.button('✕ Cancel').onPress();
    assert.equal(abandoned[0], active);
    assert.equal(h.calls.refreshes, 2);
    assert(h.calls.confirmations.every(message => message.includes(active.title)));
  });

  test('empty cached contracts are generated once and an empty result retains its placeholder', () => {
    let generations = 0;
    const city = { name: 'Outpost' };
    const h = harness({ contractSystem: { active: [], getContractsForCity: () => [],
      generateForCity(value) { assert.equal(value, city); generations++; return []; } } });
    h.render(city);
    assert.equal(generations, 1);
    assert(h.nodes().some(node => node.text === 'No contracts available in this city right now.'));
    assert.equal(h.withClass('svc-ctr-accept').length, 0);
  });

  test('shipyard load and unload transfer goods while leaving books, bags, equipment and nontradables alone', () => {
    const h = shipFixture();
    h.button('Load Trade Goods').onPress();
    assert.equal(h.storage.get('Wood').quantity, 2);
    assert.equal(h.inventory.has('Wood'), false);
    for (const key of ['Book', 'Bag', 'Sword', 'Armor', 'Relic']) {
      assert.equal(h.inventory.get(key).quantity, 1);
      assert.equal(h.storage.has(key), false);
    }
    h.button('Unload To Pack').onPress();
    assert.equal(h.storage.size, 0);
    assert.equal(h.inventory.get('Wood').quantity, 2);
    assert.equal(h.inventory.get('Fish').quantity, 1);
    assert.equal(h.calls.refreshes, 2);
    assert.deepEqual(h.calls.notices.map(notice => notice.kind), ['success', 'success']);
  });

  test('failed cargo removal rolls back storage and a full pack leaves ship cargo intact', () => {
    const h = shipFixture();
    h.player.removeItemQuantity = () => false;
    h.button('Load Trade Goods').onPress();
    assert.equal(h.storage.has('Wood'), false);
    assert.equal(h.inventory.get('Wood').quantity, 2);
    h.player.addItem = () => false;
    h.button('Unload To Pack').onPress();
    assert.equal(h.storage.get('Fish').quantity, 1);
    assert(h.calls.notices.every(notice => notice.kind === 'info'));
  });

  test('repair, refit and captain actions keep affordability guards and apply their existing gameplay effects', () => {
    const h = shipFixture();
    h.player.gold = 10;
    h.button('Repair Hull · 120g').onPress();
    h.button('Cargo Pods Lv1 · 50g').onPress();
    h.button('Hire Cadet · 20g').onPress();
    assert.equal(h.player.gold, 10);
    assert.equal(h.ship.condition, 70);
    assert.equal(h.events.repairs.length + h.events.upgrades.length + h.events.captainTiers.length, 0);
    assert.equal(h.calls.refreshes, 0);
    h.player.gold = 1000;
    h.button('Repair Hull · 120g').onPress();
    h.button('Cargo Pods Lv1 · 50g').onPress();
    h.button('Hire Cadet · 20g').onPress();
    assert.equal(h.player.gold, 810);
    assert.equal(h.ship.condition, 100);
    assert.deepEqual(h.events.repairs, [30]);
    assert.deepEqual(h.events.upgrades, ['cargoPods']);
    assert.deepEqual(h.events.captainTiers, ['cadet']);
    assert.equal(h.ship.captain.name, 'Aster');
    assert.equal(h.calls.refreshes, 3);
  });

  test('failed refits and purchases do not spend gold or select a ship', () => {
    const h = shipFixture();
    h.ship.installUpgrade = () => ({ ok: false, reason: 'maximumLevel' });
    h.player.buySpaceShip = () => ({ ok: false, reason: 'fleetFull' });
    h.button('Cargo Pods Lv1 · 50g').onPress();
    h.button('Buy Courier · 300g').onPress();
    assert.equal(h.player.gold, 1000);
    assert.equal(h.events.selected.length, 0);
    assert.equal(h.calls.refreshes, 0);
    assert(h.calls.notices.every(notice => notice.kind === 'warning'));
  });

  test('purchasing and switching ships still synchronize the player fleet and travel system', () => {
    const h = shipFixture();
    h.button('Buy Courier · 300g').onPress();
    assert.deepEqual(h.events.bought, ['courier']);
    assert.equal(h.player.spaceTravel.activeShipIndex, 2);
    assert.equal(h.travelSystem.activeShip, h.player.spaceTravel.spaceFleet[2]);
    h.button('Set Active · Reserve').onPress();
    assert.equal(h.player.spaceTravel.activeShipIndex, 1);
    assert.equal(h.travelSystem.activeShip, h.second);
    assert.equal(h.calls.refreshes, 2);
  });
});

describe('Services tab semantic styling', () => {
  test('section titles and completed upgrades use themeable classes instead of inline palette overrides', () => {
    const h = shipFixture();
    assert(h.withClass('svc-hdr-title').length >= 2);
    for (const title of h.withClass('svc-hdr-title')) assert.equal(title.styles.color, undefined);
    assert(h.withClass('svc-status-complete').some(node => node.text === 'Hull Plating Lv3'));
    assert.equal(h.withClass('svc-actions').length, 3);
    for (const row of h.withClass('svc-actions')) assert.equal(row.styles.display, undefined);
  });

  test('contract deadlines, survey notices and fragment progress keep semantic status classes', () => {
    const contracts = [
      { type: 'survey', reward: 30, surveyPoints: [{}, {}], deadline: 11 },
      { type: 'delivery', reward: 40, deadline: 15 },
    ];
    const h = harness({ contractSystem: { active: [], getContractsForCity: () => contracts },
      treasureSystem: { fragments: [{ region: 'north' }, { region: 'north' }, { region: 'north' }, { region: 'south' }] } });
    h.render();
    const deadlines = h.withClass('svc-ctr-deadline');
    assert.equal(deadlines.length, 2);
    assert(deadlines[0].text.includes('1d left'));
    assert(deadlines[0].classes.has('svc-meta-urgent'));
    assert(!deadlines[1].classes.has('svc-meta-urgent'));
    assert(h.withClass('svc-meta-notice').some(node => node.text.includes('Shown on map')));
    for (const node of deadlines) assert.equal(node.styles.color, undefined);
    const fills = h.withClass('svc-frag-fill');
    assert.equal(fills.length, 2);
    assert.equal(fills[0].styles.width, '100%');
    assert(fills[0].classes.has('complete'));
    assert(!fills[1].classes.has('complete'));
    assert(Math.abs(parseFloat(fills[1].styles.width) - 100 / 3) < 1e-8);
  });

  test('shared theme variables control service titles, surfaces and primary actions', () => {
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    const start = css.indexOf('   Services Tab');
    const end = css.indexOf('/* Shop filter bar */', start);
    assert(start >= 0 && end > start, 'Missing Services CSS boundaries');
    const servicesCss = css.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...servicesCss.matchAll(/([^{}]+)\{([^}]*)\}/g)];
    for (const [selector, property] of [['.svc-section-hdr .svc-hdr-title', 'color'],
      ['.svc-card', 'background'], ['.svc-card .svc-enter-btn', 'background']]) {
      const exactRules = rules.filter(match => match[1].split(',').map(value => value.trim()).includes(selector));
      assert(exactRules.some(match => new RegExp(`${property}\\s*:[^;]*var\\(--`).test(match[2])),
        `${selector} needs a theme-backed ${property}`);
    }
  });
});
