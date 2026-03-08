# Koz Engine Standalone Decoupling Plan

This replaces the earlier migration roadmap.

The goal is not "move more files into `Koz_Engine_Lib`."

The goal is:

1. `Koz_Engine_Lib` can be copied into another project without dragging Bargain Quest with it.
2. Bargain Quest depends on the engine.
3. The engine does not depend on Bargain Quest.
4. Browser/global bootstrap code is optional host glue, not the engine itself.

## Current Problems

The engine is still coupled in four different ways.

### 1. Export coupling

Many modules still self-register into `window.BQLib.*` or `root.BQLib.*`.

That means the engine currently assumes:

- a browser-like global exists
- the global name is `BQLib`
- the host wants namespace side effects during module load

That is not standalone engine behavior. That is Bargain Quest bootstrap behavior.

### 2. Legacy alias coupling

Some modules still maintain compatibility paths like:

- `root.BQLib.systems = root.BQLib.systems || {}`
- `root.BQLib.systems.dayNightCycle = api`
- `root.BQLib.systems.eventEngine = api`

That `systems` alias is migration debt. It should not survive into the final engine.

### 3. Runtime coupling

Some engine files still know about Bargain Quest runtime objects, globals, or presentation.

Critical examples:

- `Koz_Engine_Lib/events/eventSystem.js`
  - depends on `GameStates`
  - depends on `gameStateManager`
  - depends on `notificationManager`
  - depends on `ItemLibrary`
  - depends on `window._isCityManageMode`
  - contains Bargain Quest event content and rewards
- `Koz_Engine_Lib/time/dayNightCycle.js`
  - depends on `SaveSystem`
  - depends on `gameStateManager`
  - depends on `GameStates`
  - renders directly with p5 globals
- `Koz_Engine_Lib/minigames/minigamesRuntime.js`
  - depends on `window`
  - depends on `document`
  - injects p5 mouse globals
  - contains browser input wiring
- `Koz_Engine_Lib/assets/atlasHelper.js`
  - directly creates DOM canvas elements
  - explicitly targets p5 image behavior

These are not standalone engine modules yet.

### 4. Folder naming is still misleading

Current names hide responsibility:

- `api/` is too vague
- `io/` is too vague
- `progression/` groups unrelated concepts

That makes the engine harder to understand and harder to move.

## Required End State

The final architecture is simple.

### Rule 1. Engine modules export code only

Every engine module should be loadable in isolation via module import or require.

Allowed:

- pure functions
- classes
- explicit constructor injection
- explicit config objects

Not allowed inside engine modules:

- `window.BQLib`
- `BQAdapters`
- Bargain Quest globals
- p5 globals
- `document`
- `localStorage` fallback lookup
- screen composition

### Rule 2. Host bootstrap is separate from the engine

If the browser build wants a global namespace, that happens in a host bootstrap file, not inside every module.

Target pattern:

- engine modules: standard exports only
- optional host bridge: `Koz_Engine_Lib/browser/koz-engine.global.js`
- game bootstrap imports modules and assigns `window.KozEngine` if desired

If globals are needed temporarily, they should be produced by one composition file, not repeated in every module.

### Rule 3. Bargain Quest content stays outside the engine

Game-owned data stays in the game:

- items
- cities
- event text
- event rewards
- tuning values
- UI copy
- holiday flavor
- difficulty settings

The engine may provide:

- item math
- registry helpers
- event filtering
- save/load primitives
- generic agent logic

But not Bargain Quest content packs.

### Rule 4. The engine defines contracts, the game supplies them

Engine code should depend on injected contracts such as:

- storage driver
- renderer hooks
- state transition hooks
- clock/timer hooks
- content registries
- input adapters
- logging hooks

If a module needs the host, it should receive the host explicitly.

## Target Folder Structure

Current structure is better than before, but still not final.

Target names:

- `ai/`
  - pathfinding
  - agent runtime primitives
  - behavior helpers
- `assets/`
  - asset lookup helpers only
  - no DOM creation
  - no p5-specific drawing
- `audio/`
  - engine audio rules and registries
- `core/`
  - generic primitives with no game meaning
- `events/`
  - generic event rules only
  - no Bargain Quest event tables
- `guidance/`
  - tutorial/tip tracking helpers
- `persistence/`
  - save/load API
  - storage drivers
  - schema registry
- `simulation/`
  - timekeeping
  - world/system update helpers
- `ui/`
  - renderer-agnostic UI primitives only
- `visual/`
  - visual effect math and render-agnostic particle logic
- `utils/`
  - small pure utilities only

Folders that should disappear:

- `api/` -> merge into `persistence/`
- `io/` -> merge into `persistence/`
- `progression/` -> split by real responsibility

## File-by-File Direction

### Keep in engine after cleanup

- `core/gameStateManager.js`
- `core/spatialGrid.js`
- `core/countdownTimer.js`
- `core/uiScreenController.js`
- `utils/seededRng.js`
- `ai/astar.js`
- `items/itemFactory.js`
- `audio/musicSystem.js`
- `audio/soundRegistry.js`
- `events/eventEngine.js`
- `time/dayNightCore.js`

These still need export cleanup, but the concepts are reusable.

### Split before they can stay in engine

- `time/dayNightCycle.js`
  - keep engine: clock/day progression state machine
  - move out: p5 rendering, autosave, game-state checks, dispatch side effects
- `assets/atlasHelper.js`
  - keep engine: atlas lookup and frame registry
  - move out: DOM canvas creation, p5-specific drawing helpers
- `minigames/minigamesRuntime.js`
  - keep engine: minigame orchestration state
  - move out: DOM event listeners, p5 mouse injection, canvas coordinate plumbing

### Move back out of engine completely

- `events/eventSystem.js`

Reason:

It is currently a Bargain Quest system living in the engine folder.
It should move back to the game until it is split into:

- engine: generic event runner and resolution pipeline
- game: Bargain Quest event content, rewards, UI flow, and state transitions

### Already correctly game-owned

- `content/itemCatalog.js`

## Execution Phases

### Phase 0. Freeze the architecture

Deliverables:

- no new engine file is allowed to reference `BQLib`, `BQAdapters`, or Bargain Quest globals
- all new extraction work must target the end-state contract model
- `TODO.md` and `README.md` reflect the standalone goal

Exit condition:

- the team has one source of truth for the target architecture

### Phase 1. Remove engine self-registration

Goal:

Stop having every module mutate `window.BQLib`.

Work:

- remove `root.BQLib.*` registration from engine modules
- remove all `root.BQLib.systems.*` aliases
- keep standard exports only
- add a single optional browser bootstrap file if global access is still needed temporarily

Exit condition:

- engine modules can be required/imported without side effects

### Phase 2. Rename unclear folders

Goal:

Make the engine legible without project history.

Work:

- `api/` + `io/` -> `persistence/`
- `progression/tipTracker.js` -> `guidance/tipTracker.js`
- `progression/stagedAcquisition.js` -> either:
  - keep in game if it proves Bargain Quest-specific
  - or move to a clearly named domain such as `economy/ownershipStages.js`
- `fx/` -> `visual/` if it contains reusable render-support code only

Exit condition:

- folder names describe responsibility directly

### Phase 3. Evict game runtime knowledge from engine modules

Goal:

Stop engine modules from knowing the host game.

Priority files:

1. `events/eventSystem.js`
2. `time/dayNightCycle.js`
3. `minigames/minigamesRuntime.js`
4. `assets/atlasHelper.js`

Required changes:

- inject dependencies instead of reading globals
- remove DOM/p5/storage assumptions
- move Bargain Quest content and presentation back into game-owned files

Exit condition:

- engine modules can run with host-provided hooks only

### Phase 4. Rebuild Bargain Quest as a consumer

Goal:

Make `game.js` and adapters the only composition layer.

Work:

- game imports/loads engine modules
- adapters convert Bargain Quest data to engine contracts
- game owns all UI flow, content, and presentation
- remove legacy global fallbacks once stable

Exit condition:

- Bargain Quest uses the engine
- the engine does not mention Bargain Quest

### Phase 5. Verification gates

Required before calling the engine standalone:

- module import/require tests for every engine file
- zero engine references to:
  - `BQLib`
  - `BQAdapters`
  - `ItemLibrary`
  - `GameStates`
  - `gameStateManager`
  - `SaveSystem`
  - `document`
  - `window`
  - `localStorage` fallback lookup
  - p5 globals
- browser smoke pass:
  - boot
  - new game
  - travel
  - city enter/exit
  - trading
  - random events
  - combat
  - minigames
  - save/load
  - mobile controls

## Definition of Done

The engine is only "done" when all of the following are true:

1. `Koz_Engine_Lib` can be copied to another project without Bargain Quest files.
2. Engine modules load without mutating global namespaces.
3. Engine modules do not reference Bargain Quest nouns or globals.
4. Bargain Quest still runs by composing the engine from `game.js` and adapters.
5. Folder names are understandable without prior repo knowledge.
