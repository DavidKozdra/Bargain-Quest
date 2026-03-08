# Koz Engine Lib

`Koz_Engine_Lib` is intended to become a standalone reusable engine layer.

That means:

1. The engine must not know it is being used by Bargain Quest.
2. Bargain Quest may depend on the engine.
3. The engine may not depend on Bargain Quest.

## Current State

The folder is mid-migration, not fully decoupled yet.

Known problems:

- many modules still self-register into `window.BQLib`
- some modules still keep `BQLib.systems` compatibility aliases
- some engine files still reference game globals, DOM, p5, or save/UI runtime details
- a few folder names are still too vague

Use [migration-roadmap.md](/home/davidk/Documents/CODE/GITHUB/Bargain-Quest/Koz_Engine_Lib/docs/migration-roadmap.md) as the source of truth for the final standalone target.

## Final Rules

Modules in `Koz_Engine_Lib` should eventually follow these rules:

1. Export code only. No global namespace mutation.
2. No direct `window`, `document`, `localStorage`, or p5 dependency in engine modules.
3. No Bargain Quest nouns, globals, content tables, or screen logic.
4. Host-specific bootstrapping belongs in a separate bootstrap/composition layer.
5. Content packs belong to the game, not the engine.

## Target Folder Names

The active folder structure should be explicit:

- `AI/`: pathfinding and agent-support logic
- `Assets/`: asset lookup and atlas registry helpers
- `Audio/`: reusable audio services
- `Core/`: generic runtime primitives and bootstrap entrypoints
- `Economy/`: reusable staged ownership/economy helpers
- `Events/`: generic event rules and notification delivery helpers
- `Guidance/`: tutorial and tip helpers
- `Input/`: host input math and helpers
- `Items/`: generic item math and registries
- `Minigames/`: minigame orchestration and runtimes
- `SaveLoad/`: save/load APIs, drivers, and schemas
- `Simulation/`: clocks, timers, and simulation helpers
- `UI/`: renderer-agnostic UI primitives
- `Visual/`: reusable visual effect logic
- `World/`: deterministic/world-generation helpers

Removed vague buckets:

- `api/`
- `io/`
- `progression/`
- `browser/`

## What Does Not Belong Here

- Bargain Quest item/event/city content
- game-specific UI flow
- host game globals
- game save orchestration
- DOM input wiring
- p5 rendering behavior

## Short Principle

If a new game could not use a module without learning Bargain Quest internals, that module is not ready to live in `Koz_Engine_Lib`.
