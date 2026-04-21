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
});
