# Class to Lib Status

Use [docs/engine-boundary-audit.md](/home/davidk/Documents/CODE/GITHUB/Bargain-Quest/docs/engine-boundary-audit.md) as the source of truth for file-by-file status.

## Critical blockers

These files are still the main reasons the engine is not standalone:

- `Koz_Engine_Lib/Events/eventSystem.js`
- `Koz_Engine_Lib/Time/dayNightCycle.js`
- `Koz_Engine_Lib/Minigames/minigamesRuntime.js`
- `Koz_Engine_Lib/Assets/atlasHelper.js`

They still contain host/game knowledge and should not be treated as "finished engine modules."

## Wrapper status

The constructor-only wrapper layer has been removed from the intended runtime path.

Deleted/retired wrappers:

- `classes/EventSystem.js`
- `classes/dayNight.js`
- `classes/item.js`
- `classes/notificationManager.js`
- `classes/UI_Manager.js`
- `classes/TutorialSystem.js`
- `classes/Minigames.js`
- `classes/gameState.js`
- `classes/SpatialGrid.js`
- `classes/SeededRNG.js`

Preferred end state: `game.js` composes engine modules directly, with no engine-side `window.BQLib` dependency.

## Hybrid wrappers that still need thinning

- `classes/MobileSupport.js`

## Adapter-backed coordinators

- `classes/SaveSystem.js`

## Partially split into engine helpers

- `classes/MobileSupport.js` now delegates touch math and coordinate mapping to `Koz_Engine_Lib/UI/mobileInput.js`

## Next extraction candidates

- `classes/Trader.js`
- `classes/TraderManager.js`
- `classes/Raider.js`
- `classes/RaiderManager.js`
- `classes/Combat.js`
- `classes/BankingSystem.js`
- `classes/ContractSystem.js`
- `classes/BountyBoard.js`
- `classes/GamblingSystem.js`
- `classes/SmugglingSystem.js`
- `classes/TreasureSystem.js`

## Keep in Bargain Quest unless reuse becomes clear

- `classes/player.js`
- `classes/Cities.js`
- `classes/CityManagement.js`
- `classes/map.js`
- `classes/sprites.js`
- `classes/menuBackground.js`
- `ui/*.js`
- `game.js`
- `content/itemCatalog.js`
- Bargain Quest event definitions and reward tables
- Bargain Quest UI flow and presentation

## Deferred

- `classes/Boat.js`
- `classes/LevelEditor.js`
- `classes/CityUnit.js`
- `classes/CityUnitManager.js`

## Moved to engine audio surface

- `classes/musicSystem.js` -> `Koz_Engine_Lib/Audio/musicSystem.js`
- `classes/sound.js` -> `Koz_Engine_Lib/Audio/soundRegistry.js`

## Structure status

Current structure is transitional.

Target cleanup still required:

- keep `SaveLoad/` as the single save/serialization boundary
- keep tutorial tracking under `Events/` and keep `Economy/` separate by real responsibility
- keep `Time/` for timers and world-time helpers
- keep `World/` for deterministic/world-generation helpers
- remove remaining engine-side `BQLib.systems` aliases
