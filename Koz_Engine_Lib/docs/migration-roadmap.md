# Koz Engine Lib Migration Roadmap

This roadmap is ordered by dependency and regression risk, not by file size.

## Objective

Move reusable systems into `Koz_Engine_Lib` while preserving three boundaries:

1. Engine modules are reusable and project-agnostic.
2. Adapters translate Bargain Quest state, globals, storage, and rendering hooks into engine contracts.
3. Bargain Quest keeps ownership of content, presentation, pacing, and player-facing identity.

Secondary objective:

- Remove temporary wrapper indirection once the game can construct engine systems directly.

## What Belongs in the Engine

- Reusable state machines
- Registries, schemas, and factories
- Tick/update lifecycles
- Pure rules engines
- Cross-project UI helpers with no Bargain Quest copy or screen layout assumptions
- Storage APIs and portable drivers

## What Does Not Need a Bridge

- Standalone engine classes that the game can instantiate directly from `game.js`
- Utilities with no Bargain Quest compatibility burden
- UI infrastructure such as `UIManager` when game screens can register against the engine class directly
- Tutorial/runtime systems when the game can pass content/config at construction time

Bridges are acceptable only as temporary migration shims or where global backward compatibility is still buying us something real.

## What Must Stay in the Game

- Item, city, holiday, and event content
- Narrative flavor, dialogue, and naming
- p5 rendering details and animation feel
- Screen composition and UX flow specific to Bargain Quest
- Worldgen assumptions tied to this map/game mode
- Balance numbers unless a system truly needs portable defaults

## Phase 0. Baseline and Boundary Audit

Goal: stop accidental over-extraction before more code moves.

Deliverables:
- module contracts for every file already living in `Koz_Engine_Lib`
- explicit list of systems that stay game-local
- wrapper audit for `classes/*`
- confirmed script load order

Exit criteria:
- every extracted module has a defined adapter surface
- no new engine code depends on Bargain Quest globals

## Phase 1. Harden Existing Extractions

Goal: make current engine-backed systems stable before adding new ones.

In scope:
- event system
- day/night
- item catalog/factory
- notifications
- UI screen controller
- save API and drivers
- minigame manager
- game state manager
- spatial grid
- particle core

Exit criteria:
- wrappers are thin and readable
- tests cover core engine logic plus adapter seams
- stale duplicate logic is removed
- direct construction from `game.js` is used wherever compatibility wrappers are no longer justified

## Phase 1.5. Remove Wrapper Indirection

Goal: stop paying permanent complexity tax for migration-era bridges.

In scope:
- `GameStateManager`
- `UIManager`
- `NotificationManager`
- `DayNightCycle`
- `MinigameManager`
- `TutorialSystem` where a direct constructor path exists

Preferred end state:
- `game.js` creates engine services from `window.BQLib.*`
- game-owned config/content is passed in explicitly
- old bridge files are deleted once no call sites require them

Exit criteria:
- engine systems can be understood from the bootstrap path in `game.js`
- wrapper classes exist only for systems still mid-migration

## Phase 2. Shared Simulation Primitives

Goal: create the narrow foundations needed by larger systems.

In scope:
- agent lifecycle primitives
- encounter/action resolution primitives
- economy rule primitives

Rules:
- do not invent a framework broader than the current reuse case
- every primitive must be justified by at least two consuming systems or a clearly shared contract

Exit criteria:
- trader/raider and combat can target shared primitives instead of custom one-off extraction layers

## Phase 3. NPC Runtime Extraction

Goal: generalize autonomous actor behavior without dragging world flavor into the engine.

In scope:
- trader runtime behavior
- raider runtime behavior
- manager-level spawn/tick/despawn orchestration

Game-owned:
- spawn tables
- loot flavor
- faction labels
- map/world hooks

Exit criteria:
- `TraderManager` and `RaiderManager` mainly compose adapters and config
- travel/trade/threat behavior matches existing gameplay

## Phase 4. Combat Kernel

Goal: extract battle rules without moving the entire battle presentation stack.

In scope:
- turn order
- actions and outcomes
- state transitions
- rewards and end-state handling

Game-owned:
- encounter triggers
- animation timing
- UI presentation
- audiovisual feedback

Exit criteria:
- combat rules can run without p5 or DOM access
- land and naval combat differences are expressed through rules/config where sensible

## Phase 5. Economy Systems

Goal: move reusable rule logic while keeping Bargain Quest's economy flavor intact.

In scope:
- contracts
- bounties
- banking/loans
- gambling rule logic
- smuggling rule logic
- treasure reward generation

Game-owned:
- copy and narrative framing
- city-specific tuning
- screen flow
- content tables

Exit criteria:
- no oversized monolithic economy module
- shared math and eligibility rules are centralized
- Bargain Quest balance remains configurable outside engine code

## Phase 6. Selective UI Generalization

Goal: reduce duplication without turning game UI into an engine dumping ground.

In scope:
- modal orchestration helpers
- reusable panel/list controllers
- shared notification/prompt patterns

Out of scope by default:
- full screen implementations
- menu choreography
- game-specific layout composition

Exit criteria:
- extracted UI helpers have obvious reuse value
- `ui.js` is smaller because game screens were modularized, not because all UI was pushed into the engine

## Phase 7. Optional Systems

Only extract these if a clean reusable contract appears:

- audio
- level editor
- worldgen tooling
- sprite tooling

If reuse is not obvious, keep them in Bargain Quest.

## Phase 8. Hardening and Release

Goal: finish with a stable reusable baseline instead of a half-generalized tree.

Required checks:
- unit tests for new engine modules
- adapter tests for each Bargain Quest bridge
- smoke pass for trading, travel, combat, events, save/load, and mobile
- docs for both engine reuse and game-owned layers

Release condition:
- the game still plays like Bargain Quest
- the engine can be understood without reading Bargain Quest game files
