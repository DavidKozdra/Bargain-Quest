const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../ui.js'), 'utf8');

function createHarness() {
  const stats = { mutations: 0, queries: 0, rasters: 0, encodes: 0, speedCalls: 0 };
  const ids = new Map();
  const frames = new Map();
  let serial = 0;
  const atlasSource = {};
  for (const name of ['Normal', 'Hard', 'Crate', 'Shield', 'Globe', 'Eye']) {
    frames.set(name, { image: atlasSource, x: 0, y: 0, w: 32, h: 32 });
  }

  function element(tag = 'div') {
    let text = '';
    let html = '';
    let id = '';
    const node = {
      tagName: tag.toUpperCase(), children: [], dataset: {}, attributes: {},
      style: new Proxy({}, { set(target, key, value) { stats.mutations++; target[key] = value; return true; } }),
      classList: {
        add() { stats.mutations++; },
        toggle() { stats.mutations++; },
      },
      addEventListener() {},
      appendChild(child) { stats.mutations++; this.children.push(child); return child; },
      replaceChildren(...children) { stats.mutations++; this.children = children; },
      setAttribute(name, value) { stats.mutations++; this.attributes[name] = value; },
      querySelector(selector) { stats.queries++; return ids.get(selector.slice(1)) || null; },
    };
    Object.defineProperties(node, {
      id: { get: () => id, set(value) { id = value; ids.set(value, node); } },
      textContent: { get: () => text, set(value) { stats.mutations++; text = String(value); node.children = []; } },
      innerHTML: { get: () => html, set(value) { stats.mutations++; html = String(value); node.children = []; } },
    });
    return node;
  }

  function wrapper(tag, initial = '') {
    const elt = element(tag);
    elt.textContent = initial;
    const w = { elt };
    w.id = value => { elt.id = value; return w; };
    w.class = value => { elt.className = value; return w; };
    w.style = (key, value) => { elt.style[key] = value; return w; };
    w.attribute = (name, value) => { elt.setAttribute(name, value); return w; };
    w.parent = parent => { (parent.elt || parent).appendChild(elt); return w; };
    w.mousePressed = callback => { elt.onPress = callback; return w; };
    w.size = () => w;
    return w;
  }

  const context = {
    window: { DIFFICULTY_CONFIG: { label: 'Normal', icon: 'N' }, cities: [{ management: { budget: 100 } }] },
    document: {
      createElement: element,
      createTextNode: text => { const e = element('#text'); e.textContent = text; return e; },
      getElementById: id => { stats.queries++; return ids.get(id) || null; },
    },
    resolveAtlasFrameName: name => name,
    AtlasManager: {
      getFrame: name => frames.get(name) || null,
      createDOMCanvas() {
        stats.rasters++;
        const canvas = element('canvas');
        const imageSerial = ++serial;
        canvas.toDataURL = () => { stats.encodes++; return `data:image/png;mock,${imageSerial}`; };
        return canvas;
      },
    },
    createDiv: () => wrapper('div'),
    createSpan: text => wrapper('span', text),
    createButton: text => wrapper('button', text),
    createAtlasIconEl: () => element('canvas'),
    createSeasonIconEl: () => element('canvas'),
    createItemIconEl: () => element('canvas'),
    appendAtlasIcon: (host, frame) => {
      const icon = frames.has(frame) ? context.AtlasManager.createDOMCanvas(frame, 16) : element('span');
      (host.elt || host).appendChild(icon);
    },
    atlasLabelHTML: (frame, label, size, fallback) => `${context.atlasIconHTML(frame, size, fallback)} ${label}`,
    getActionDisplay: name => name,
    gameStateManager: { setState() {} },
    GameStates: { PLAYING: 1, PLANET_SURFACE: 2, INVENTORY: 3, PAUSED: 4, SPACE: 5, LEVEL_EDITOR: 6 },
    uiManager: { screens: {}, registerScreen(name, spec) { this.screens[name] = spec; } },
    select() { throw new Error('HUD updates must not create p5 wrappers or read layout'); },
    player: {
      name: 'Captain', statPoints: 0, currentHP: 8, gold: 250, ownedCities: [0],
      inventory: new Map([['Wood', { quantity: 2 }]]),
      getMaxHP: () => 10, getEffectiveCargoCapacity: () => 50,
    },
    ItemLibrary: { Wood: { name: 'Wood', weight: 3 } },
    dayNight: {
      getDaysElapsed: () => 1, getDayOfWeek: () => 'Monday', getSeason: () => 'Spring',
      getYear: () => 1, getTimeString: () => '12:00', getLightFactor: () => 0.5,
    },
    gameSpeed: 1, gameSpeedIndex: 3, SPEED_STEPS: [0, 0.25, 0.5, 1, 2, 4, 8],
    syncSpeedDisplay() { stats.speedCalls++; ids.get('speedLabel').textContent = `${context.gameSpeed}×`; },
    width: 1280, camZoom: 1, _minimapMode: 'regional',
    _getMinimapMode: () => context._minimapMode,
    constrain: (value, min, max) => Math.max(min, Math.min(max, value)),
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('const _atlasIconHTMLCache'), source.indexOf('function cashIconHTML')), context);
  vm.runInContext(source.slice(source.indexOf('let _playerHudElements'), source.indexOf('// INVENTORY VIEW (press I)')), context);
  vm.runInContext(source.slice(source.indexOf('let _minimapControlsElements'), source.indexOf('// COMBAT VIEW')), context);
  return { context, stats, ids, frames, element, reset: () => { for (const key of Object.keys(stats)) stats[key] = 0; } };
}

describe('HUD rendering caches', () => {
  test('unchanged HUD frames perform no DOM writes, layout lookups, or icon rasterization', () => {
    const h = createHarness();
    const screen = h.context.uiManager.screens.playerView;
    screen.create();
    screen.update();
    assert.equal(h.ids.get('hudHpText').textContent, '8/10');
    assert(h.ids.get('playerCargo').innerHTML.endsWith(' 6/50'));
    h.reset();
    for (let i = 0; i < 100; i++) screen.update();
    assert.deepEqual(h.stats, { mutations: 0, queries: 0, rasters: 0, encodes: 0, speedCalls: 0 });
  });

  test('health, capacity, budgets, difficulty, clock and speed refresh independently of inventory changes', () => {
    const h = createHarness();
    const screen = h.context.uiManager.screens.playerView;
    screen.create();
    screen.update();
    h.context.player.getMaxHP = () => 20;
    h.context.player.getEffectiveCargoCapacity = () => 80;
    h.context.window.cities[0].management.budget = 700;
    h.context.window.DIFFICULTY_CONFIG = { label: 'Hard', icon: 'H' };
    h.context.dayNight.getTimeString = () => '13:00';
    h.context.gameSpeed = 4;
    screen.update();
    assert.equal(h.ids.get('hudHpText').textContent, '8/20');
    assert.equal(h.ids.get('hudHpBarInner').style.width, '40%');
    assert(h.ids.get('playerCargo').innerHTML.endsWith(' 6/80'));
    assert(h.ids.get('hudEmpireBadge').innerHTML.endsWith(' 1 city · 700g'));
    assert(h.ids.get('hudDiffBadge').innerHTML.endsWith(' Hard'));
    assert.equal(h.ids.get('timeLabel').textContent, '13:00');
    assert.equal(h.ids.get('speedLabel').textContent, '4×');
    h.context.player.ownedCities = [];
    screen.update();
    assert.equal(h.ids.get('hudEmpireBadge').style.display, 'none');
  });

  test('recreated HUD uses new elements and rebuilds identical inventory chips', () => {
    const h = createHarness();
    const screen = h.context.uiManager.screens.playerView;
    const original = screen.create().elt;
    screen.update();
    const replacement = screen.create().elt;
    screen.show();
    assert.notEqual(original, replacement);
    assert.equal(replacement.style.display, 'flex');
    assert.equal(h.ids.get('hudHpText').textContent, '8/10');
    assert.equal(h.ids.get('hudInventoryChips').children.length, 1);
    screen.hide();
    assert.equal(replacement.style.display, 'none');
    screen.show();
    assert.equal(replacement.style.display, 'flex');
  });

  test('atlas cache retries missing frames and invalidates source, geometry and size changes', () => {
    const h = createHarness();
    const icon = h.context.atlasIconHTML;
    assert.equal(icon('Late', 16, '?'), '?');
    h.frames.set('Late', { image: {}, x: 0, y: 0, w: 32, h: 32 });
    const first = icon('Late', 16, '?');
    assert(first.startsWith('<img'));
    assert.equal(icon('Late', 16, '?'), first);
    assert.equal(h.stats.rasters, 1);
    h.frames.get('Late').x = 32;
    assert.notEqual(icon('Late', 16, '?'), first);
    icon('Late', 24, '?');
    h.frames.get('Late').image = {};
    icon('Late', 24, '?');
    assert.equal(h.stats.rasters, 4);
    assert.equal(h.stats.encodes, 4);
  });

  test('minimap controls retain icons and positions until mode, viewport or atlas changes', () => {
    const h = createHarness();
    const screen = h.context.uiManager.screens.minimapControls;
    screen.create();
    screen.update();
    const originalIcon = h.ids.get('mmMode').children[0];
    h.reset();
    for (let i = 0; i < 100; i++) screen.update();
    assert.deepEqual(h.stats, { mutations: 0, queries: 0, rasters: 0, encodes: 0, speedCalls: 0 });
    h.context.width = 1920;
    screen.update();
    assert.equal(h.ids.get('mmMode').style.left, '1710px');
    assert.equal(h.ids.get('mmMode').children[0], originalIcon);
    assert.equal(h.stats.rasters, 0);
    h.context._minimapMode = 'world';
    screen.update();
    assert.equal(h.ids.get('mmMode').attributes.title, 'Switch to Region view');
    assert.notEqual(h.ids.get('mmMode').children[0], originalIcon);
    h.frames.get('Eye').image = {};
    screen.update();
    assert.equal(h.stats.rasters, 2);
    screen.create();
    screen.update();
    assert.equal(h.ids.get('mmMode').children.length, 1);
  });
});
