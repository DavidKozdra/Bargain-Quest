# Class to Lib Status

Use [docs/engine-boundary-audit.md](/home/davidk/Documents/CODE/GITHUB/Bargain-Quest/docs/engine-boundary-audit.md) as the source of truth for file-by-file status.

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

Preferred end state: `game.js` constructs engine classes directly from `window.BQLib`.

## Hybrid wrappers that still need thinning

- `classes/MobileSupport.js`

## Adapter-backed coordinators

- `classes/SaveSystem.js`

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

## Deferred

- `classes/Boat.js`
- `classes/LevelEditor.js`
- `classes/musicSystem.js`
- `classes/CityUnit.js`
- `classes/CityUnitManager.js`
