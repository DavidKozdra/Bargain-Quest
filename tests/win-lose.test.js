'use strict';
/**
 * win-lose.test.js
 *
 * Tests for all win / lose conditions.
 *
 * The logic is extracted verbatim from classes/player.js Player.update()
 * lines 402-419 into a pure function so it can be exercised without needing
 * the full p5/game-state environment.  Any change to those conditions in
 * player.js must be mirrored here to keep the tests meaningful.
 *
 * Source lines:
 *   402  const goldTarget = window._newGameGoldTarget || 5000;
 *   403  const dayLimit   = window._newGameDayLimit   || 0;
 *   406  if (this.gold >= goldTarget && !this.hasWon &&
 *           (goldTarget <= this._startingGold || this.gold > this._startingGold))
 *   410  if (dayLimit > 0 && daysElapsed >= dayLimit && !this.hasWon)
 *   411    if (this.gold < goldTarget)  → GAMELOSE
 *   416  if (this.gold <= 0 && this.inventory.size === 0) → GAMELOSE
 */

/**
 * Pure re-implementation of the win/lose conditions in Player.update().
 * Returns { outcome: 'GAMEWON' | 'GAMELOSE' | null, hasWon: boolean }.
 *
 * @param {{
 *   gold:          number,
 *   hasWon:        boolean,
 *   inventorySize: number,
 *   _startingGold: number,
 *   goldTarget?:   number,   // defaults to 5000
 *   dayLimit?:     number,   // defaults to 0
 *   daysElapsed?:  number,   // defaults to 0
 * }} state
 */
function evalConditions(state) {
  const goldTarget  = state.goldTarget  ?? 5000;
  const dayLimit    = state.dayLimit    ?? 0;
  const daysElapsed = state.daysElapsed ?? 0;
  let { gold, hasWon, inventorySize, _startingGold } = state;

  // ── Win condition (player.js:406) ─────────────────────────────────────────
  if (gold >= goldTarget && !hasWon &&
      (goldTarget <= _startingGold || gold > _startingGold)) {
    return { outcome: 'GAMEWON', hasWon: true };
  }

  // ── Time-limit lose (player.js:410-414) ───────────────────────────────────
  if (dayLimit > 0 && daysElapsed >= dayLimit && !hasWon) {
    if (gold < goldTarget) {
      return { outcome: 'GAMELOSE', hasWon };
    }
  }

  // ── Bankruptcy lose (player.js:416-419) ───────────────────────────────────
  if (gold <= 0 && inventorySize === 0) {
    return { outcome: 'GAMELOSE', hasWon };
  }

  return { outcome: null, hasWon };
}

// ── Win condition ─────────────────────────────────────────────────────────────

describe('Win condition', () => {
  test('triggers GAMEWON when gold exactly equals target', () => {
    const r = evalConditions({ gold: 5000, hasWon: false, inventorySize: 0, _startingGold: 100, goldTarget: 5000 });
    expect(r.outcome).toBe('GAMEWON');
    expect(r.hasWon).toBe(true);
  });

  test('triggers GAMEWON when gold exceeds target', () => {
    const r = evalConditions({ gold: 7500, hasWon: false, inventorySize: 0, _startingGold: 100, goldTarget: 5000 });
    expect(r.outcome).toBe('GAMEWON');
  });

  test('does not trigger if already hasWon', () => {
    const r = evalConditions({ gold: 5000, hasWon: true, inventorySize: 0, _startingGold: 100, goldTarget: 5000 });
    expect(r.outcome).toBeNull();
  });

  test('does not trigger when gold is one below target', () => {
    const r = evalConditions({ gold: 4999, hasWon: false, inventorySize: 0, _startingGold: 100, goldTarget: 5000 });
    expect(r.outcome).toBeNull();
  });

  test('uses default goldTarget of 5000 when not specified', () => {
    const r = evalConditions({ gold: 5000, hasWon: false, inventorySize: 0, _startingGold: 100 });
    expect(r.outcome).toBe('GAMEWON');
  });

  // ── Guard condition behaviour ──────────────────────────────────────────────
  // The guard `(goldTarget <= _startingGold || gold > _startingGold)` is
  // always true when gold >= goldTarget (proof: if goldTarget > _startingGold
  // then gold >= goldTarget > _startingGold, so gold > _startingGold).
  // Consequence: the win condition reduces to `gold >= goldTarget && !hasWon`.

  test('wins when goldTarget < startingGold and gold reaches target', () => {
    // target below starting gold — goldTarget <= _startingGold fires immediately
    const r = evalConditions({ gold: 200, hasWon: false, inventorySize: 0, _startingGold: 200, goldTarget: 100 });
    expect(r.outcome).toBe('GAMEWON');
  });

  test('wins when goldTarget === startingGold (target met at game start)', () => {
    const r = evalConditions({ gold: 200, hasWon: false, inventorySize: 0, _startingGold: 200, goldTarget: 200 });
    expect(r.outcome).toBe('GAMEWON');
  });

  test('wins when goldTarget > startingGold and gold reaches target (normal gameplay)', () => {
    const r = evalConditions({ gold: 1000, hasWon: false, inventorySize: 0, _startingGold: 100, goldTarget: 1000 });
    expect(r.outcome).toBe('GAMEWON');
  });
});

// ── Bankruptcy condition ──────────────────────────────────────────────────────

describe('Bankruptcy lose condition (gold ≤ 0 AND empty inventory)', () => {
  test('triggers GAMELOSE when gold is 0 and inventory is empty', () => {
    const r = evalConditions({ gold: 0, hasWon: false, inventorySize: 0, _startingGold: 100, goldTarget: 5000 });
    expect(r.outcome).toBe('GAMELOSE');
  });

  test('triggers GAMELOSE when gold is negative and inventory is empty', () => {
    const r = evalConditions({ gold: -50, hasWon: false, inventorySize: 0, _startingGold: 100, goldTarget: 5000 });
    expect(r.outcome).toBe('GAMELOSE');
  });

  test('does NOT trigger when gold ≤ 0 but player still has inventory', () => {
    const r = evalConditions({ gold: 0, hasWon: false, inventorySize: 3, _startingGold: 100, goldTarget: 5000 });
    expect(r.outcome).toBeNull();
  });

  test('does NOT trigger when inventory is empty but gold > 0', () => {
    const r = evalConditions({ gold: 1, hasWon: false, inventorySize: 0, _startingGold: 100, goldTarget: 5000 });
    expect(r.outcome).toBeNull();
  });

  test('does NOT trigger when both gold and inventory are positive', () => {
    const r = evalConditions({ gold: 50, hasWon: false, inventorySize: 2, _startingGold: 100, goldTarget: 5000 });
    expect(r.outcome).toBeNull();
  });
});

// ── Time-limit condition ──────────────────────────────────────────────────────

describe('Time-limit lose condition', () => {
  test('triggers GAMELOSE when days elapsed equals the limit and gold < target', () => {
    const r = evalConditions({
      gold: 1000, hasWon: false, inventorySize: 5,
      _startingGold: 100, goldTarget: 5000, dayLimit: 30, daysElapsed: 30,
    });
    expect(r.outcome).toBe('GAMELOSE');
  });

  test('triggers GAMELOSE when days elapsed exceeds the limit', () => {
    const r = evalConditions({
      gold: 1000, hasWon: false, inventorySize: 5,
      _startingGold: 100, goldTarget: 5000, dayLimit: 30, daysElapsed: 45,
    });
    expect(r.outcome).toBe('GAMELOSE');
  });

  test('does NOT trigger one day before the limit', () => {
    const r = evalConditions({
      gold: 1000, hasWon: false, inventorySize: 5,
      _startingGold: 100, goldTarget: 5000, dayLimit: 30, daysElapsed: 29,
    });
    expect(r.outcome).toBeNull();
  });

  test('does NOT trigger when dayLimit is 0 (no time limit)', () => {
    const r = evalConditions({
      gold: 1000, hasWon: false, inventorySize: 5,
      _startingGold: 100, goldTarget: 5000, dayLimit: 0, daysElapsed: 9999,
    });
    expect(r.outcome).toBeNull();
  });

  test('does NOT trigger if player has already won', () => {
    const r = evalConditions({
      gold: 1000, hasWon: true, inventorySize: 5,
      _startingGold: 100, goldTarget: 5000, dayLimit: 30, daysElapsed: 50,
    });
    expect(r.outcome).toBeNull();
  });

  test('does NOT lose when day limit reached but gold >= target (win fires first)', () => {
    // At day 30, player has exactly 5000 g — win condition fires before time-limit check
    const r = evalConditions({
      gold: 5000, hasWon: false, inventorySize: 5,
      _startingGold: 100, goldTarget: 5000, dayLimit: 30, daysElapsed: 30,
    });
    expect(r.outcome).toBe('GAMEWON');
  });
});

// ── Condition priority ────────────────────────────────────────────────────────

describe('Condition evaluation order', () => {
  test('win fires before time-limit lose when both thresholds are met', () => {
    // player.js checks win FIRST, then time-limit
    const r = evalConditions({
      gold: 5000, hasWon: false, inventorySize: 0,
      _startingGold: 100, goldTarget: 5000, dayLimit: 1, daysElapsed: 5,
    });
    expect(r.outcome).toBe('GAMEWON');
  });

  test('win fires before bankruptcy when gold hits target and is also 0', () => {
    // goldTarget = 0 (edge case), starting gold 0, gold is 0 — win fires before bankruptcy
    const r = evalConditions({
      gold: 0, hasWon: false, inventorySize: 0,
      _startingGold: 0, goldTarget: 0,
    });
    // gold(0) >= goldTarget(0) AND goldTarget(0) <= startingGold(0) → GAMEWON
    expect(r.outcome).toBe('GAMEWON');
  });
});
