# Standalone Engine Plan

This is the hardening plan for ending with two clean outcomes:

1. Bargain Quest still works with no player-facing regression.
2. `Koz_Engine_Lib` can be copied into another project without dragging Bargain Quest glue with it.

## End State

- `game.js` is the only composition root for Bargain Quest runtime services.
- `Koz_Engine_Lib` exposes standalone modules through `window.BQLib` and Node-compatible exports.
- The game keeps only true adapters:
  - save/runtime serialization
  - tutorial content and storage behavior
  - city ownership translation
- Compatibility bridge files are gone unless they solve a still-active migration problem.

## Architecture Rules

- Engine code must not require Bargain Quest files to exist.
- Engine code may expose globals for browser convenience, but the canonical access path is `window.BQLib.*`.
- Adapters are allowed only when translating game data into an engine contract.
- Wrappers that only re-export a constructor are forbidden in the final state.
- Game-specific content, copy, tuning, rendering feel, and UI screens remain in the game repo.

## Current Audit

### Removed or removable now

- `classes/gameState.js`
- `classes/UI_Manager.js`
- `classes/notificationManager.js`
- `classes/dayNight.js`
- `classes/SeededRNG.js`
- `classes/item.js`
- `classes/SpatialGrid.js`
- `classes/EventSystem.js`
- `classes/Minigames.js`
- `classes/TutorialSystem.js`

These were migration shims, not architecture.

### Still legitimate adapters or hybrids

- `adapters/bargainQuestSaveAdapter.js`
- `adapters/tutorialSystemAdapter.js`
- `adapters/cityOwnershipAdapter.js`
- `classes/SaveSystem.js`
- `classes/MobileSupport.js`

### Remaining extraction targets

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

## Bullet-Proof Execution Plan

## Phase 1. Bootstrap Hardening

Goal:
- make the engine load directly, with no unnecessary bridge files

Tasks:
- remove redundant wrapper scripts from `index.html`
- ensure direct service construction happens in `game.js`
- ensure engine utilities expose both `BQLib` and browser globals where needed
- keep only real adapters

Exit criteria:
- no deleted bridge file is referenced anywhere
- game boot path is readable from `index.html` and `game.js` alone

## Phase 2. Adapter Hardening

Goal:
- push all game-specific translation into adapters, not wrappers

Tasks:
- move remaining save normalization and load/apply behavior into `adapters/bargainQuestSaveAdapter.js`
- shrink `classes/SaveSystem.js` to orchestration only
- split `classes/MobileSupport.js` into engine touch math vs game HUD/input wiring
- ensure tutorial content is loaded through the adapter or explicit game config

Exit criteria:
- adapters are the only game-specific code touching engine contracts
- wrappers are no longer hiding business logic

## Phase 3. Engine API Hardening

Goal:
- make engine modules reusable outside Bargain Quest

Tasks:
- define constructor inputs and required hooks for each reusable module
- remove hidden reads of Bargain Quest globals from engine candidates
- replace fallback behavior with explicit dependency injection where practical
- add docs for each module's public API and expected host responsibilities

Exit criteria:
- another project can instantiate a module with documented inputs only
- engine modules are understandable without reading Bargain Quest code

## Phase 4. High-Risk System Extraction

Goal:
- move real reusable systems out without breaking gameplay

Order:
1. NPC lifecycle primitives
2. Trader/Raider runtime
3. Combat kernel
4. Economy family modules

Rules:
- extract kernels, not whole files blindly
- keep screen flow and presentation in the game
- each extraction must ship with tests and smoke checks

Exit criteria:
- the game layer composes systems instead of containing their reusable rules

## Phase 5. Standalone Validation

Goal:
- prove `Koz_Engine_Lib` is portable

Tasks:
- verify all engine files work in Node tests without Bargain Quest globals
- create a minimal host checklist for outside projects
- verify browser globals are convenience exports, not hidden dependencies
- document required script order for browser usage

Exit criteria:
- `Koz_Engine_Lib` can be dropped into another project with docs alone

## Verification Matrix

### Engine verification

- each engine module has a Node test
- no engine module imports Bargain Quest adapters
- no engine module hardcodes Bargain Quest names/content

### Game verification

- new game boot
- custom map boot
- save load
- travel and city entry
- trading flow
- random events
- combat start and finish
- minigames
- tutorial panel
- mobile controls

### Boundary verification

- no wrapper file exists just to alias a constructor
- every adapter has a clear reason to exist
- `index.html` script list reflects actual architecture

## Definition of Done

The work is done only when all of the following are true:

- Bargain Quest starts and plays through the core loops without regression
- the engine no longer needs bridge files for already-extracted systems
- adapters are few, obvious, and justified
- engine modules are documented and testable in isolation
- another project could use `Koz_Engine_Lib` without copying Bargain Quest runtime files
