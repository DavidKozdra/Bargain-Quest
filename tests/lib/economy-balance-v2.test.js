const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { DicePokerMinigame } = require('../../Koz_Engine_Lib/Minigames/minigamesRuntime.js');

describe('V2 economy balance safeguards', () => {
  test('delivery contracts issue only real city stock and reclaim it on abandon', () => {
    const context = vm.createContext({
      window: { addEventListener() {}, removeEventListener() {} },
      ItemLibrary: { Wheat: { name: 'Wheat', baseValue: 4, weight: 1 } },
      notificationManager: { log() {} },
    });
    const source = fs.readFileSync(path.join(__dirname, '../../classes/ContractSystem.js'), 'utf8');
    vm.runInContext(source + '\nthis.ContractSystem = ContractSystem;', context);
    const inventory = new Map();
    context.player = {
      inventory,
      addItem(entry) {
        inventory.set(entry.name, { item: context.ItemLibrary[entry.name], quantity: entry.quantity });
        return true;
      },
      removeItemQuantity(name, quantity) {
        const entry = inventory.get(name);
        if (!entry || entry.quantity < quantity) return false;
        entry.quantity -= quantity;
        if (entry.quantity <= 0) inventory.delete(name);
        return true;
      },
    };
    const city = {
      name: 'A',
      inventory: new Map([['Wheat', { item: context.ItemLibrary.Wheat, quantity: 1 }]]),
      _addOrIncrement(name, quantity) {
        const entry = this.inventory.get(name);
        if (entry) entry.quantity += quantity;
        else this.inventory.set(name, { item: context.ItemLibrary[name], quantity });
      },
    };
    context.cities = [city];
    const system = new context.ContractSystem();
    const contract = { type: 'delivery', title: 'Grain run', source: 'A', target: 'B', item: 'Wheat', qty: 3 };

    expect(system.acceptContract(contract)).toBe(false);
    expect(inventory.size).toBe(0);
    city.inventory.get('Wheat').quantity = 3;
    expect(system.acceptContract(contract)).toBe(true);
    expect(city.inventory.has('Wheat')).toBe(false);
    expect(system.abandonContract(contract)).toBe(true);
    expect(inventory.size).toBe(0);
    expect(city.inventory.get('Wheat').quantity).toBe(3);
  });

  test('player trade quotes preserve a same-city spread after maximum bonuses', () => {
    const context = vm.createContext({
      window: { DIFFICULTY_CONFIG: {} },
      ItemLibrary: { Iron: { baseValue: 20 } },
    });
    const source = fs.readFileSync(path.join(__dirname, '../../classes/Cities.js'), 'utf8');
    vm.runInContext(source, context);
    const City = context.window.City;
    const city = {
      calculateItemPrice(_item, _cities, selling) { return selling ? 80 : 100; },
    };
    const quote = City.prototype.calculatePlayerTradeQuote.call(city, 'Iron', [city], {
      negotiationDiscount: 0.25,
      bonusCharm: 10,
      buyHaggle: -0.20,
      sellHaggle: 0.20,
    });
    expect(quote.sellPrice).toBeLessThanOrEqual(Math.floor(quote.buyPrice * 0.90));
  });

  test('contraband has finite stock, uses capacity, and cannot be sold at its origin', () => {
    const context = vm.createContext({
      window: { addEventListener() {}, removeEventListener() {} },
      ItemLibrary: { ExoticSpices: { weight: 2 } },
      dayNight: { getDaysElapsed: () => 4 },
      notificationManager: { log() {} },
    });
    const source = fs.readFileSync(path.join(__dirname, '../../classes/SmugglingSystem.js'), 'utf8');
    vm.runInContext(source + '\nthis.SmugglingSystem = SmugglingSystem;', context);
    context.player = {
      gold: 1000,
      currentCity: { name: 'A' },
      getCargoWeight: () => 0,
      getEffectiveCargoCapacity: () => 4,
      spendGold(value) { this.gold -= value; },
      earnGold(value) { this.gold += value; },
    };
    const system = new context.SmugglingSystem();
    expect(system.buyContraband('ExoticSpices', 2, 'A')).toBe(true);
    expect(system.buyContraband('ExoticSpices', 1, 'A')).toBe(false);
    expect(system.sellContraband('ExoticSpices', 1, 'A')).toBe(false);
    expect(system.sellContraband('ExoticSpices', 2, 'B')).toBe(true);
  });

  test('dice poker payout table no longer pays stake on common hands', () => {
    const game = new DicePokerMinigame();
    game.dice = [1, 1, 2, 2, 3];
    expect(game._getHand().multiplier).toBe(0.22);
    game.dice = [1, 1, 1, 2, 3];
    expect(game._getHand().multiplier).toBe(0.55);
    game.dice = [1, 2, 3, 4, 5];
    expect(game._getHand().multiplier).toBe(1.65);
  });

  test('investment outcomes are capped and loans block new investments', () => {
    const context = vm.createContext({
      window: { addEventListener() {}, removeEventListener() {}, _newGameGoldTarget: 5000 },
      cities: [{ name: 'A', population: 2000 }],
      dayNight: { getDaysElapsed: () => 10 },
      notificationManager: { log() {} },
      player: {
        gold: 1000,
        currentCity: { hasBank: true },
        spendGold(value) { this.gold -= value; },
      },
    });
    const source = fs.readFileSync(path.join(__dirname, '../../classes/BankingSystem.js'), 'utf8');
    vm.runInContext(source + '\nthis.BankingSystem = BankingSystem;', context);
    const bank = new context.BankingSystem();
    expect(bank.invest('A', 100)).toBe(true);
    expect(bank.investments[0].returnMul).toBeLessThanOrEqual(1.25);
    expect(bank.investments[0].returnMul).toBeGreaterThanOrEqual(0.80);
    bank.loanAmount = 100;
    expect(bank.invest('A', 100)).toBe(false);
  });
});
