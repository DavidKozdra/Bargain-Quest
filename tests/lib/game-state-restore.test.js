const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { GameStateManager } = require('../../Koz_Engine_Lib/Core/gameStateManager');

const gameSource = fs.readFileSync(path.resolve(__dirname, '../../game.js'), 'utf8');
const restoreStart = gameSource.indexOf('function _enterRestoredGameplayState(');
const restoreEnd = gameSource.indexOf('function _enterSpaceState(', restoreStart);
const restoreSource = gameSource.slice(restoreStart, restoreEnd);
const listenerStart = gameSource.indexOf('  // Menu-only states that should NOT trigger an auto-save');
const listenerEnd = gameSource.indexOf('  gameStateManager.setState(GameStates.MAIN_MENU);', listenerStart);
const stateListenerSource = gameSource.slice(listenerStart, listenerEnd);

const GameStates = Object.freeze({
  MAIN_MENU: 'mainMenu',
  NEW_GAME_CONFIG: 'newGameConfig',
  INFO: 'infoMenu',
  CREDITS: 'credits',
  PLAYING: 'playing',
  PLANET_SURFACE: 'planetSurface',
  SETTINGS: 'settings',
  GAMEWON: 'won',
  GAMELOSE: 'lose',
  CITY_MANAGE: 'cityManage',
  SPACE: 'space',
  PAUSED: 'paused',
  COMBAT: 'combat',
  RANDOM_EVENT: 'randomEvent',
  MINIGAME: 'minigame',
  INVENTORY: 'inventory',
});

function createHarness({ allowPlaying = true } = {}) {
  const gameStateManager = new GameStateManager();
  Object.values(GameStates).forEach((state) => gameStateManager.addState(state, {}));
  gameStateManager.setTransitionRules({
    '*': [GameStates.MAIN_MENU],
    [GameStates.MAIN_MENU]: allowPlaying ? [GameStates.PLAYING] : [],
    [GameStates.PLAYING]: [
      GameStates.PLANET_SURFACE,
      GameStates.SETTINGS,
      GameStates.GAMEWON,
      GameStates.GAMELOSE,
    ],
    [GameStates.GAMEWON]: [GameStates.PLAYING, GameStates.MAIN_MENU],
    [GameStates.GAMELOSE]: [GameStates.MAIN_MENU],
  });
  gameStateManager.setState(GameStates.MAIN_MENU);

  const context = vm.createContext({ gameStateManager, GameStates });
  vm.runInContext(`${restoreSource}\nthis.enterRestoredState = _enterRestoredGameplayState;`, context);
  return { context, gameStateManager };
}

describe('restored gameplay state transitions', () => {
  test('enters normal gameplay without redirecting', () => {
    const { context, gameStateManager } = createHarness();

    const result = context.enterRestoredState(GameStates.PLAYING);

    expect(result.ok).toBe(true);
    expect(result.state).toBe(GameStates.PLAYING);
    expect(result.redirected).toBe(undefined);
    expect(gameStateManager.currentState).toBe(GameStates.PLAYING);
  });

  test('accepts a synchronous victory redirect while restoring gameplay', () => {
    const { context, gameStateManager } = createHarness();
    gameStateManager.onChange((_from, to) => {
      if (to === GameStates.PLAYING) gameStateManager.setState(GameStates.GAMEWON);
    });

    const result = context.enterRestoredState(GameStates.PLAYING);

    expect(result.ok).toBe(true);
    expect(result.state).toBe(GameStates.GAMEWON);
    expect(result.redirected).toBe(true);
    expect(result.requestedState).toBe(GameStates.PLAYING);
    expect(gameStateManager.currentState).toBe(GameStates.GAMEWON);
  });

  test('does not let an outer gameplay callback hide a nested victory screen', () => {
    const { gameStateManager } = createHarness();
    const uiManager = { onGameStateChange: jest.fn() };
    const player = {
      checkEndConditions() {
        gameStateManager.setState(GameStates.GAMEWON);
      },
    };
    const context = vm.createContext({
      GameStates,
      SaveSystem: { save: jest.fn() },
      _cleanupTransientUiState: jest.fn(),
      _reportRuntimeError: jest.fn(),
      cityManagement: null,
      gameStateManager,
      notificationManager: null,
      player,
      tutorialSystem: null,
      uiManager,
      window: { _permadeathTriggered: false },
      worldInitialized: true,
    });
    vm.runInContext(stateListenerSource, context);

    gameStateManager.setState(GameStates.PLAYING);

    expect(gameStateManager.currentState).toBe(GameStates.GAMEWON);
    expect(uiManager.onGameStateChange.mock.calls).toEqual([[GameStates.GAMEWON]]);
  });

  test('continued wins remain in gameplay when no terminal redirect is requested', () => {
    const { context, gameStateManager } = createHarness();
    const player = { hasWon: true, continuedAfterWin: true };
    gameStateManager.onChange((_from, to) => {
      if (to === GameStates.PLAYING && player.hasWon && !player.continuedAfterWin) {
        gameStateManager.setState(GameStates.GAMEWON);
      }
    });

    const result = context.enterRestoredState(GameStates.PLAYING);

    expect(result.ok).toBe(true);
    expect(result.state).toBe(GameStates.PLAYING);
    expect(gameStateManager.currentState).toBe(GameStates.PLAYING);
  });

  test('stops at a terminal redirect reached during a bridge transition', () => {
    const { context, gameStateManager } = createHarness();
    gameStateManager.onChange((_from, to) => {
      if (to === GameStates.PLAYING) gameStateManager.setState(GameStates.GAMELOSE);
    });

    const result = context.enterRestoredState(GameStates.PLANET_SURFACE, {
      bridgeState: GameStates.PLAYING,
    });

    expect(result.ok).toBe(true);
    expect(result.state).toBe(GameStates.GAMELOSE);
    expect(result.redirected).toBe(true);
    expect(result.requestedState).toBe(GameStates.PLANET_SURFACE);
    expect(gameStateManager.currentState).toBe(GameStates.GAMELOSE);
  });

  test('still reports blocked and unrelated transitions as failures', () => {
    const blocked = createHarness({ allowPlaying: false });
    const blockedResult = blocked.context.enterRestoredState(GameStates.PLAYING);
    expect(blockedResult.ok).toBe(false);
    expect(blockedResult.reason).toBe('state_transition_failed');
    expect(blockedResult.current).toBe(GameStates.MAIN_MENU);

    const unrelated = createHarness();
    unrelated.gameStateManager.onChange((_from, to) => {
      if (to === GameStates.PLAYING) unrelated.gameStateManager.setState(GameStates.SETTINGS);
    });
    const unrelatedResult = unrelated.context.enterRestoredState(GameStates.PLAYING);
    expect(unrelatedResult.ok).toBe(false);
    expect(unrelatedResult.reason).toBe('state_transition_failed');
    expect(unrelatedResult.current).toBe(GameStates.SETTINGS);
  });
});
