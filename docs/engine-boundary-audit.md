# Engine Boundary Audit

This file is the Phase 0 classification pass for the current codebase. It decides what belongs in `Koz_Engine_Lib`, what stays in Bargain Quest, and what must be split instead of moved wholesale.

## Decision Rules

- `wrapper`: class should only expose an engine module to the game.
- `split`: extract a reusable kernel, but keep Bargain Quest presentation/composition local.
- `extract`: strong engine candidate with clear reusable rule logic.
- `keep`: game-owned by design.
- `defer`: do not move until a second project or clearer contract proves reuse.

## Current Boundary Summary

- Engine-backed wrappers already exist for state, timing, notifications, items, minigames, and several adapters.
- `SaveSystem` and `MobileSupport` are still hybrid wrappers and need thinning.
- `SeededRNG`, NPC runtime, combat, and economy rules are the strongest remaining extraction targets.
- `player`, `Cities`, `map`, presentation-heavy UI, art generation, and city-management mode should remain Bargain Quest-owned.

## File-by-File Classification

| File | Decision | Target | Reason | Next action |
| --- | --- | --- | --- | --- |
| `classes/EventSystem.js` | wrapper | engine | Thin bridge to engine event system. | Keep thin; remove fallback growth only if not needed. |
| `classes/SpatialGrid.js` | wrapper | engine | Thin bridge to reusable grid primitive. | No action beyond wrapper cleanup. |
| `classes/UI_Manager.js` | wrapper | engine | Thin bridge to reusable screen controller. | Keep game screens out of engine. |
| `classes/dayNight.js` | wrapper | engine | Thin bridge to reusable time/day-night core. | No major work. |
| `classes/gameState.js` | wrapper | engine | Thin bridge to reusable state machine. | No major work. |
| `classes/notificationManager.js` | wrapper | engine | Thin bridge to reusable notification layer. | No major work. |
| `classes/item.js` | wrapper | engine | Thin bridge to item catalog/factory runtime. | Keep content packs game-owned. |
| `classes/Minigames.js` | wrapper | engine | Thin bridge to generic minigame runtime. | Keep game launch points local. |
| `classes/TutorialSystem.js` | wrapper | adapters | Adapter-first bridge already in place. | Keep as adapter bridge. |
| `classes/SeededRNG.js` | wrapper | engine | Generic deterministic RNG runtime with no game flavor. | Completed this turn; keep as bridge only. |
| `classes/SaveSystem.js` | split | engine + adapters | Reusable save API exists, but class still contains large Bargain Quest-specific compatibility and fallback logic. | Thin the wrapper and push remaining normalization/serialization into adapters. |
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

1. Harden existing wrappers: `SaveSystem`, `MobileSupport`, and any remaining duplicate fallback logic.
2. Finish low-risk reusable primitives: `SeededRNG` is now moved; next only add primitives with clear consumers.
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
