describe("QuestSystem Raymond reveal quests", () => {
  const prevWindow = global.window;
  const prevBearEmpireSystem = global.BearEmpireSystem;
  const prevSpaceTravelSystem = global.SpaceTravelSystem;
  const prevQuestSystem = global.QuestSystem;
  const prevPlayer = global.player;
  const prevCities = global.cities;
  const prevDayNight = global.dayNight;
  const prevNotificationManager = global.notificationManager;
  const prevCustomEvent = global.CustomEvent;
  const prevGrid = global.grid;
  const prevRows = global.rows;
  const prevCols = global.cols;
  const prevRaider = global.Raider;
  const prevCombatSystem = global.combatSystem;

  beforeAll(() => {
    global.window = global.window || {};
    global.window.addEventListener = () => {};
    global.window.removeEventListener = () => {};
    global.window.dispatchEvent = () => true;
    global.CustomEvent = function CustomEvent(type, init) {
      this.type = type;
      this.detail = init?.detail;
    };

    delete require.cache[require.resolve("../../classes/SpaceTravelSystem.js")];
    delete require.cache[require.resolve("../../classes/BearEmpireSystem.js")];
    delete require.cache[require.resolve("../../classes/QuestSystem.js")];
    require("../../classes/SpaceTravelSystem.js");
    require("../../classes/BearEmpireSystem.js");
    require("../../classes/QuestSystem.js");

    global.SpaceTravelSystem = global.window.SpaceTravelSystem;
    global.BearEmpireSystem = global.window.BearEmpireSystem;
    global.QuestSystem = global.window.QuestSystem;
  });

  afterAll(() => {
    if (prevWindow === undefined) delete global.window;
    else global.window = prevWindow;

    if (prevBearEmpireSystem === undefined) delete global.BearEmpireSystem;
    else global.BearEmpireSystem = prevBearEmpireSystem;

    if (prevSpaceTravelSystem === undefined) delete global.SpaceTravelSystem;
    else global.SpaceTravelSystem = prevSpaceTravelSystem;

    if (prevQuestSystem === undefined) delete global.QuestSystem;
    else global.QuestSystem = prevQuestSystem;

    if (prevPlayer === undefined) delete global.player;
    else global.player = prevPlayer;

    if (prevCities === undefined) delete global.cities;
    else global.cities = prevCities;

    if (prevDayNight === undefined) delete global.dayNight;
    else global.dayNight = prevDayNight;

    if (prevNotificationManager === undefined) delete global.notificationManager;
    else global.notificationManager = prevNotificationManager;

    if (prevCustomEvent === undefined) delete global.CustomEvent;
    else global.CustomEvent = prevCustomEvent;

    if (prevGrid === undefined) delete global.grid;
    else global.grid = prevGrid;

    if (prevRows === undefined) delete global.rows;
    else global.rows = prevRows;

    if (prevCols === undefined) delete global.cols;
    else global.cols = prevCols;

    if (prevRaider === undefined) delete global.Raider;
    else global.Raider = prevRaider;

    if (prevCombatSystem === undefined) delete global.combatSystem;
    else global.combatSystem = prevCombatSystem;
  });

  test("signal trace quests can reveal Raymond's capital", () => {
    global.dayNight = { getDaysElapsed: () => 24 };
    global.notificationManager = { log: () => {} };
    global.rows = 8;
    global.cols = 8;
    global.grid = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ options: ["Grass"] })));

    global.cities = [
      { name: "Signal Rest", adjustReputation: () => {} },
      { name: "Relay Point", adjustReputation: () => {} },
      { name: "Ash Gate", adjustReputation: () => {} },
    ];
    global.player = {
      gold: 1200,
      inventory: new Map(),
      currentCity: { name: "Signal Rest" },
      spaceTravel: { visitedPlanets: ["luna"] },
      earnGold(amount) { this.gold += amount; },
      gainXP: () => {},
      addItem: () => {},
    };

    global.window.BQConfigureSpaceWorldGraph(707);
    const bearEmpire = new global.BearEmpireSystem({
      seed: 707,
      citiesGetter: () => [{ hasSpaceport: true, progression: { spaceProgram: true, spaceportBuilt: true, spaceAccess: { launchReady: true, dockingRights: true } } }],
      playerGetter: () => ({ spaceTravel: { visitedPlanets: ["luna"] } }),
      notificationGetter: () => null,
    });
    const nodeKey = bearEmpire.getThreatenedSystems()[0];
    bearEmpire.supportResistance(nodeKey);
    bearEmpire.supportResistance(nodeKey);
    global.window.BQGetBearEmpireSystem = () => bearEmpire;
    global.window.BQGetWorldSession = () => ({ sessionType: "planet_surface", spaceContext: { nodeKey } });

    const quests = new global.QuestSystem();
    quests.templates = quests.templates.filter((template) => template.id === "raymond_signal_trace");
    const offer = quests.tryGenerateOffer();

    expect(offer).toBeTruthy();
    expect(offer.templateId).toBe("raymond_signal_trace");

    quests.acceptOffer();
    quests._completeQuest(offer);

    expect(bearEmpire.raymondRevealed).toBe(true);
    expect(bearEmpire.getKnownBearSystems()).toContain(bearEmpire.capitalSystemKey);

    quests.destroy();
    bearEmpire.destroy();
  });

  test("scholar visits grant both required texts", () => {
    global.dayNight = { getDaysElapsed: () => 3 };
    global.notificationManager = { log: () => {} };
    const inventory = new Map();
    global.player = {
      currentCity: null,
      inventory,
      addItem(item) {
        const entry = inventory.get(item.name);
        if (entry) entry.quantity += item.quantity;
        else inventory.set(item.name, { quantity: item.quantity });
        return true;
      },
    };
    const system = new global.QuestSystem();
    const template = system.templates.find(entry => entry.id === 'scholar_texts');
    const cityList = [{ name: 'Patron' }, { name: 'Library A' }, { name: 'Library B' }];
    const quest = template.generate({ pickCities: () => cityList, scaleGold: value => value, uid: () => 'scholar_test', day: 3 });
    global.player.currentCity = cityList[1];
    expect(system._checkStage(quest, quest.stages[0])).toBe(true);
    global.player.currentCity = cityList[2];
    expect(system._checkStage(quest, quest.stages[1])).toBe(true);
    expect(inventory.get('ForbiddenTexts').quantity).toBe(2);
    system.destroy();
  });

  test("pirate quest advances only after its target is defeated", () => {
    global.notificationManager = { log: () => {} };
    global.player = { x: 1, y: 2, currentCity: { name: 'Hideout' } };
    global.Raider = class Raider { constructor(opts) { Object.assign(this, opts); this.loot = {}; } };
    let combatHandler = null;
    global.combatSystem = {
      active: false,
      on(_event, handler) { combatHandler = handler; },
      off() {},
      startCombat(raider) { this.active = true; this.raider = raider; },
    };
    const system = new global.QuestSystem();
    const stage = { id: 'fight', type: 'visit_city', targetCity: 'Hideout', triggerCombat: true, complete: false };
    const quest = { id: 'pirate_test', title: 'Pirate Test', stages: [stage, { id: 'return', complete: false }], currentStage: 0 };
    system.active = [quest];
    expect(system._checkStage(quest, stage)).toBe(false);
    expect(stage.complete).toBe(false);
    combatHandler({ result: 'fled', raider: global.combatSystem.raider });
    expect(stage.complete).toBe(false);
    global.combatSystem.active = false;
    expect(system._checkStage(quest, stage)).toBe(false);
    combatHandler({ result: 'win', raider: global.combatSystem.raider });
    expect(stage.complete).toBe(true);
    expect(quest.currentStage).toBe(1);
    system.destroy();
  });
});
