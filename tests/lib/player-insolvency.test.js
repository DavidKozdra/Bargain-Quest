const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createHarness(difficulty = 'normal') {
  const context = {
    console,
    Map,
    Set,
    Date,
    window: {
      DIFFICULTY_CONFIG: { insolvencyGraceDays: difficulty === 'easy' ? 4 : (difficulty === 'normal' ? 2 : 1) },
      _newGameDifficulty: difficulty,
      cities: [],
      addEventListener() {},
      removeEventListener() {},
    },
    ItemLibrary: {},
    gameStateManager: { is: () => false, setState: jest.fn() },
    GameStates: { GAMEWON: 'won', GAMELOSE: 'lose' },
    triggerGameLose: jest.fn(),
    bankingSystem: { balance: 0, loanAmount: 0, investments: [] },
    smugglingSystem: { smugglingCargo: [] },
  };
  context.globalThis = context;
  vm.createContext(context);
  const filename = path.resolve(__dirname, '..', '..', 'classes/player.js');
  vm.runInContext(`${fs.readFileSync(filename, 'utf8')}\nthis.Player = Player;`, context, { filename });

  const player = Object.assign(Object.create(context.Player.prototype), {
    gold: 0,
    inventory: new Map(),
    fleet: [],
    spaceTravel: { spaceFleet: [] },
    ownedCities: [],
    emergencyDebt: 0,
    insolventSinceDay: null,
    insolvencyDays: 0,
    _lastInsolvencyCheckDay: -1,
    _assetsCacheValue: null,
    _assetsCacheUntil: 0,
  });
  return { context, player };
}

describe('Player insolvency and economy snapshot', () => {
  test('passive healing is slow while traveling and four times faster in a city', () => {
    const { player } = createHarness();
    Object.assign(player, { currentHP: 5, bonusMaxHP: 0, _hpRegenBuffer: 0, currentCity: null, currentTileCity: null });

    player.regenHP(8);
    expect(player.currentHP).toBe(7);
    player.currentTileCity = { name: 'Harbor' };
    player.regenHP(1);
    expect(player.currentHP).toBe(8);
  });

  test('zero gold with saleable cargo is not insolvent', () => {
    const { player } = createHarness();
    player.inventory.set('Wheat', { item: { baseValue: 20, tags: new Set() }, quantity: 3 });

    const snapshot = player.getEconomySnapshot();
    const result = player.processInsolvencyDay(5);

    expect(snapshot.cargo).toBe(30);
    expect(snapshot.netWorth).toBe(30);
    expect(result.insolvent).toBe(false);
  });

  test('normal difficulty waits two complete days before defeat', () => {
    const { context, player } = createHarness('normal');

    expect(player.processInsolvencyDay(5)).toMatchObject({ insolvent: true, days: 0, defeated: false });
    expect(player.processInsolvencyDay(6)).toMatchObject({ insolvent: true, days: 1, defeated: false });
    expect(player.processInsolvencyDay(7)).toMatchObject({ insolvent: true, days: 2, defeated: true });
    expect(context.triggerGameLose).toHaveBeenCalledTimes(1);
  });

  test('hard difficulty waits one complete day and duplicate events do not advance it', () => {
    const { context, player } = createHarness('hard');

    player.processInsolvencyDay(3);
    expect(player.processInsolvencyDay(3)).toMatchObject({ days: 0, defeated: false });
    expect(player.processInsolvencyDay(4)).toMatchObject({ days: 1, defeated: true });
    expect(context.triggerGameLose).toHaveBeenCalledTimes(1);
  });

  test('recovering any conservative asset clears the countdown', () => {
    const { player } = createHarness('normal');
    player.processInsolvencyDay(2);
    player.inventory.set('Fish', { item: { baseValue: 12, tags: new Set() }, quantity: 1 });

    expect(player.processInsolvencyDay(3)).toMatchObject({ insolvent: false, days: 0, defeated: false });
    expect(player.insolventSinceDay).toBeNull();
  });

  test('mandatory expense shortfalls become repayable emergency debt', () => {
    const { player } = createHarness();
    player.gold = 3;

    expect(player.chargeMandatoryExpense(10, 'taxes')).toMatchObject({ due: 10, paid: 3, unpaid: 7 });
    expect(player.gold).toBe(0);
    expect(player.emergencyDebt).toBe(7);
    player.gold = 5;
    expect(player.repayEmergencyDebt(4)).toBe(4);
    expect(player).toMatchObject({ gold: 1, emergencyDebt: 3 });
  });

  test('bank funds, investments, vessels, city equity and loans share one snapshot', () => {
    const { context, player } = createHarness();
    context.bankingSystem.balance = 25;
    context.bankingSystem.loanAmount = 40;
    context.bankingSystem.investments = [{ amount: 100 }];
    context.BoatLibrary = { sloop: { cost: 600 } };
    player.fleet = [{ type: 'sloop', condition: 50, storage: new Map() }];
    context.window.cities = [{
      getAppraisal: () => ({ value: 1000 }),
      management: { budget: 10, ownerPayoutDue: 5 },
    }];
    player.ownedCities = [0];

    expect(player.getEconomySnapshot()).toMatchObject({
      bank: 25,
      investments: 50,
      vessels: 150,
      cityEquity: 815,
      loanDebt: 40,
      recoverableAssets: 1040,
      netWorth: 1000,
    });
  });
});
