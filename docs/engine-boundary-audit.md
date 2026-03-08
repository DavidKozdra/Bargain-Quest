# Engine Boundary Audit

This file is the Phase 0 classification pass for the current codebase. It decides what belongs in `Koz_Engine_Lib`, what stays in Bargain Quest, and what must be split instead of moved wholesale.

## Decision Rules

- `wrapper`: class should only expose an engine module to the game.
- `split`: extract a reusable kernel, but keep Bargain Quest presentation/composition local.
- `extract`: strong engine candidate with clear reusable rule logic.
- `keep`: game-owned by design.
- `defer`: do not move until a second project or clearer contract proves reuse.

## Current Boundary Summary

- Core wrapper files that only re-exported engine constructors have now been removed from the active load path.
- `SaveSystem` is now an adapter-backed coordinator instead of a large hybrid serializer/loader.
- `MobileSupport` is now the main remaining hybrid wrapper that still needs splitting.
- `SeededRNG`, NPC runtime, combat, and economy rules are the strongest remaining extraction targets.
- `player`, `Cities`, `map`, presentation-heavy UI, art generation, and city-management mode should remain Bargain Quest-owned.

## Simpler Target Architecture

- `game.js` is the composition root.
- `game.js` should construct engine services directly from `window.BQLib`.
- `ui/*.js` should register screens against a standalone `UIManager` instance, not a wrapper class.
- Tutorial flow should be loaded by the game through explicit config/content, not hidden behind extra indirection.
- Adapters should be rare and obvious:
  - save/persistence mapping
  - city ownership translation
  - any genuinely game-specific integration point that the engine should not know about

If a system can be created directly with explicit dependencies, do that instead of adding a bridge.

## File-by-File Classification

| File | Decision | Target | Reason | Next action |
| --- | --- | --- | --- | --- |
| `classes/EventSystem.js` | wrapper | engine | Redundant constructor re-export. | Removed from load path; file should stay deleted. |
| `classes/SpatialGrid.js` | wrapper | engine | Redundant constructor re-export. | Removed from load path; file should stay deleted. |
| `classes/UI_Manager.js` | wrapper | engine | Redundant constructor re-export. | Removed from load path; file should stay deleted. |
| `classes/dayNight.js` | wrapper | engine | Redundant constructor re-export. | Removed from load path; file should stay deleted. |
| `classes/gameState.js` | wrapper | engine | Redundant constructor re-export. | Removed from load path; file should stay deleted. |
| `classes/notificationManager.js` | wrapper | engine | Redundant constructor re-export. | Removed from load path; file should stay deleted. |
| `classes/item.js` | wrapper | engine | Redundant item/global alias bridge. | Removed from load path; file should stay deleted. |
| `classes/Minigames.js` | wrapper | engine | Redundant runtime alias bridge. | Removed from load path; file should stay deleted. |
| `classes/TutorialSystem.js` | wrapper | adapters | Redundant adapter alias bridge. | Removed from load path; file should stay deleted. |
| `classes/SeededRNG.js` | wrapper | engine | Redundant RNG alias bridge. | Removed from load path; file should stay deleted. |
| `classes/SaveSystem.js` | split | engine + adapters | Save serialization and runtime rehydrate now live in the save adapter; the class mainly orchestrates save/load calls and runtime assignment. | Keep trimming orchestration, but the heavy logic is now in the right place. |
| `classes/MobileSupport.js` | split | engine + game | Touch detection and zoom math are reusable; mobile HUD, canvas wiring, and game speed UX are not. | Keep HUD/game controls local and shrink wrapper around engine input helpers. |
| `classes/Trader.js` | extract | engine + adapters | Autonomous agent behavior, inventory decisions, and travel state are reusable patterns. | Define agent contract and move runtime logic to engine. |
| `classes/TraderManager.js` | extract | engine + adapters | Spawn/tick/despawn orchestration is reusable if city/world hooks are injected. | Extract manager kernel after agent contract exists. |
| `classes/Raider.js` | extract | engine + adapters | Patrol/chase/loot state is reusable combat-encounter AI. | Share primitives with trader/agent runtime. |
| `classes/RaiderManager.js` | extract | engine + adapters | Spawn cadence, caps, and orchestration fit engine if world hooks stay injected. | Move after shared agent lifecycle exists. |
| `classes/Combat.js` | split | engine + game | Turn rules, status effects, and resolution are reusable; battle presentation and timing are game-owned. | Extract combat kernel without moving full UI/animation stack. |
| `classes/BankingSystem.js` | extract | engine + adapters | Loans, deposits, interest, and insurance rules are portable. | Move rules and validation into engine economy modules. |
| `classes/ContractSystem.js` | extract | engine + adapters | Contract generation and reward/deadline rules are reusable. | Separate contract rule generation from city flavor/content. |
| `classes/BountyBoard.js` | extract | engine + adapters | Mission board logic and target/reward lifecycle are portable. | Group with contracts as quest-board primitives. |
| `classes/GamblingSystem.js` | split | engine + game | Betting rules and session accounting are reusable; game-specific minigame launch flow is not. | Extract rule helpers and keep UX/local launch flow. |
| `classes/SmugglingSystem.js` | extract | engine + adapters | Contraband inventory, risk, inspections, and profit rules are portable. | Move black-market rule logic into engine; keep world flavor local. |
| `classes/TreasureSystem.js` | split | engine + game | Reward generation and fragment assembly are reusable; map-region flavor is game-owned. | Extract reward/assembly kernel and keep placement flavor local. |
| `classes/Boat.js` | defer | engine candidate | Boat and captain data are portable, but the clean contract depends on naval combat and travel extraction. | Revisit after combat/naval rules are stabilized. |
| `classes/player.js` | keep | game | This is the player fantasy/composition layer tying inventory, boats, cities, progression, and UI-facing behavior together. | Keep local; only extract narrow helpers if repeated elsewhere. |
| `classes/Cities.js` | keep | game | City identity, content, ownership flow, pricing flavor, and rendering hooks are heavily Bargain Quest-specific. | Keep local; only peel off pure pricing/production helpers if they become reusable. |
| `classes/CityManagement.js` | keep | game | Entirely tied to Bargain Quest's alternate city-management mode and victory pacing. | Keep local. |
| `classes/CityUnit.js` | defer | game | Small experimental unit model with no current reuse proof. | Keep local until the mode matures. |
| `classes/CityUnitManager.js` | defer | game | Companion manager for the experimental city-unit system. | Keep local until the mode matures. |
| `classes/LevelEditor.js` | defer | game | Could become tooling later, but it is still strongly tied to this game's terrain/entities. | Keep local unless a second map consumer appears. |
| `classes/map.js` | keep | game | World generation and rendering are tightly coupled to this game's terrain, map size, and p5 pipeline. | Keep local; optional extraction only after a second project proves reuse. |
| `classes/sprites.js` | keep | game | Pure Bargain Quest art generation and rendering output. | Keep local. |
| `classes/menuBackground.js` | keep | game | Decorative menu experience, not an engine concern. | Keep local. |
| `classes/musicSystem.js` | defer | game | Audio service extraction is possible, but this implementation is still bound to localStorage, p5 audio, and game flow. | Defer until a clean generic audio contract exists. |
| `classes/sound.js` | keep | game | Legacy/game-specific sound handling with direct runtime assumptions. | Keep local or replace later; do not generalize yet. |
| `ui/mainMenu.js` | keep | game | Full screen composition and branding. | Keep local. |
| `ui/newGameConfig.js` | keep | game | Bargain Quest setup flow and tuning UI. | Keep local. |
| `ui/settings.js` | keep | game | Player preferences and save import/export UX are game-owned. | Keep local; extract only generic widgets if repetition appears. |
| `ui/infoMenu.js` | keep | game | Content browser, history, and lore UI are project-specific. | Keep local. |
| `ui/cityManagement.js` | keep | game | Dedicated city-management presentation layer. | Keep local. |
| `ui/levelEditorToolbar.js` | keep | game | Editor UX is specific to this toolset and map model. | Keep local. |
| `game.js` | keep | game | Main composition root and runtime orchestration layer. | Keep local; continue moving only narrow kernels out. |

## Immediate Extraction Order

1. Remove unnecessary wrapper indirection for already-extracted engine systems by constructing them directly in `game.js`.
2. Harden the true adapters and hybrids: `SaveSystem`, `MobileSupport`, and any remaining duplicate fallback logic.
3. Define shared agent lifecycle contracts, then extract `Trader*` and `Raider*`.
4. Extract combat rules after agent/runtime contracts are stable.
5. Extract economy family modules in grouped rule sets, not one giant manager.

## Explicitly Game-Owned

- Content tables and naming
- Screen flow and UI layout
- p5 rendering behavior and sprite generation
- Worldgen tuning and map assumptions
- Player progression feel and economy pacing
- City management mode and its win condition
