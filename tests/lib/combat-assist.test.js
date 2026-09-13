const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const ui = fs.readFileSync(path.join(root, 'ui.js'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const player = fs.readFileSync(path.join(root, 'classes/player.js'), 'utf8');
const cityManagementUi = fs.readFileSync(path.join(root, 'ui/cityManagement.js'), 'utf8');

describe('optional Tactical Autopilot', () => {
  test('Primer unlocks fixed assistance without enabling a fight automatically', () => {
    assert.match(player, /this\.assistModes\s*=\s*\{[\s\S]*?land:\s*false/);
    assert.match(player, /qteAttackAccuracy\s*=\s*0\.70/);
    assert.match(player, /qteBlockAccuracy\s*=\s*0\.72/);
    assert.match(ui, /if \(!mods\?\.qteAssist \|\| !_combatAssistEnabled\(\)\) return null/);
  });

  test('combat exposes an accessible T toggle and useful forecast values', () => {
    assert.match(ui, /id\('combatAssistToggle'\)/);
    assert.match(ui, /attribute\('aria-pressed', 'false'\)/);
    assert.match(ui, /Assist forecast: \$\{values\.hit\}% hit/);
    assert.match(game, /combatAssistToggle:\s*\{[^}]*keys:\s*\[84\]/);
    assert.match(game, /isActionKey\('combatAssistToggle', keyCode\)[\s\S]*?window\.toggleCombatAssist\(\)/);
  });

  test('disabling assist cancels only the matching pending timer before manual play', () => {
    assert.match(ui, /if \(state\.assistTimer\) clearTimeout\(state\.assistTimer\)/);
    assert.match(ui, /if \(_patternState === state && !state\.done\) _finishAttackPhase\(\)/);
    assert.match(ui, /if \(_patternState === state && !state\.done\) _finishBlockPhase\(\)/);
    assert.match(ui, /interruptedPhase === 'attack'[\s\S]*?_startPatternMiniGame\(\)/);
    assert.match(ui, /interruptedPhase === 'block'[\s\S]*?_startBlockQTE\(\)/);
  });

  test('war assist runs the seeded tactical model instead of a preview boolean shortcut', () => {
    assert.doesNotMatch(cityManagementUi, /playerBattleWon:\s*\(preview\?\.winChance/);
    assert.match(cityManagementUi, /player\?\.assistModes\?\.war === true/);
    assert.match(cityManagementUi, /while \(!battle\.finished && decisions < 512\)/);
    assert.match(cityManagementUi, /battle\.takeAutoStep\(battle\.turn\)/);
  });
});
