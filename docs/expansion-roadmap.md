# Bargain Quest Expansion Roadmap

This document turns the current 5-phase expansion outline into a repo-aware delivery plan.

The core principle is simple:

1. Phase 1 and Phase 2 ship together as the new progression and traversal foundation.
2. Phase 3 follows once space travel has stable controls, rules, and save data.
3. Phase 4 and Phase 5 layer on top as content-scale expansion work.

One design rule overrides everything else:

- space must feel like the main game scaled up, not replaced

Unlocking space should increase scope, danger, and opportunity while preserving the existing Bargain Quest identity:

- trade first
- city growth still matters
- cargo and routes still matter
- ownership and expansion still matter
- the same player remains at the center of one continuous run

## Current Baseline In The Repo

The project already has starter support for both city progression and space unlocks.

- `classes/Cities.js` already contains a lightweight research ladder, space unlock flags, a small planet catalog, and daily progression hooks.
- `classes/CityManagement.js` already owns long-running city systems such as budget, routes, units, daily processing, and player-owned city progression.
- `classes/CitySpecialization.js` already provides specialization infrastructure, but the current paths do not yet match the intended end-state.
- `classes/player.js` and `adapters/bargainQuestSaveAdapter.js` already persist basic `spaceTravel` state.
- `game.js` already defines a `GameStates.SPACE` state, so the travel layer can be expanded instead of introduced from scratch.

That means the right move is not a rewrite. The right move is to promote the existing prototypes into a coherent city-to-space progression stack.

## Phase 1 And 2 Foundation Release

These two phases should ship together because they depend on the same progression model and save structure.

### Phase 1 Goals

- Expand the current research ladder into a full city tech tree.
- Replace or extend city specialization so it supports these explicit paths:
  - trade hub
  - naval port
  - science city
  - military fortress
  - black market city
- Add treasury-funded permanent city upgrades for:
  - improved stock
  - better prices
  - faster research
  - cheaper travel
  - stronger defenses

### Phase 2 Goals

- Turn the current space unlock into a real travel layer with launch prep, fuel, orbit routes, docking permissions, and landing permissions.
- Make space movement operate like ships at sea: active vessel, cargo capacity, speed, condition, and docking rules.
- Add space-specific QTE hooks for launch, docking, emergency maneuvers, and re-entry.

### Recommended Implementation Slice

#### 1. Normalize city progression data first

Expand `city.progression` beyond the current prototype so it can support long-term growth without bolting on separate systems later.

Recommended new progression buckets:

- `techTree`
- `researchedNodes`
- `queuedResearch`
- `specialization`
- `treasuryUpgrades`
- `spaceAccess`
- `factionStanding`

Implementation targets:

- `classes/Cities.js`
- `adapters/bargainQuestSaveAdapter.js`
- `classes/SaveSystem.js` if additional migration glue is needed

#### 2. Split research into branches instead of a single ladder

The current line from `market_network` to `xeno_exchange` works as a prototype, but it will collapse under the new design.

Use a branch-based tree with at least these families:

- commerce
- infrastructure
- science
- naval
- defense
- covert
- orbital

Suggested examples:

- commerce: stock depth, local demand forecasting, tariff efficiency, barter leverage
- infrastructure: treasury throughput, district efficiency, construction speed
- science: research generation, lab output, unlock discounts, alien analysis
- naval: harbor efficiency, travel discounts, fleet upkeep, port defenses
- defense: walls, militia, garrison regen, invasion resistance
- covert: smuggling protection, espionage defense, black market reach
- orbital: launch prep, fuel efficiency, docking rights, re-entry safety

#### 3. Refactor specialization to align with the new city fantasy

`classes/CitySpecialization.js` already contains tier logic. Reuse that structure and replace the path catalog so it matches the intended city identities.

Target specialization paths:

- trade hub
- naval port
- science city
- military fortress
- black market city

Suggested system ownership:

- path definitions and tier bonuses stay in `classes/CitySpecialization.js`
- path advancement checks remain in `classes/CityManagement.js`
- city feature rendering and passive stock effects remain in `classes/Cities.js`

#### 4. Make treasury spending a first-class strategic layer

Right now the treasury mostly supports city-management operations and upgrades. Expand it into a permanent investment layer rather than a passive budget sink.

Recommended treasury upgrade families:

- market charter: deeper stock, faster restock, better buy modifiers
- port authority: cheaper travel, better docking throughput, route income bonuses
- academy grants: more research, shorter research cycles, scholar events
- defense bureau: stronger city defense, lower raid losses, better unit upkeep
- underground network: black market access, smuggling protection, covert income

The key design rule is that player gold and city treasury should remain distinct. City-scale progression should come from city treasury or explicit treasury transfers so the economy stays legible.

#### 5. Promote space travel from flags into runtime systems

The current fields in `player.spaceTravel` are enough for persistence, but not for moment-to-moment play.

Add a dedicated space travel runtime model with:

- active ship
- fuel
- cargo capacity
- hull integrity
- orbital route position
- docking clearance
- landing clearance
- current sector or orbit node
- encounter seed or route danger rating

Recommended implementation targets:

- `classes/player.js` for persistent player-owned travel state
- `game.js` for the active SPACE loop and state transitions
- a new `classes/SpaceTravelSystem.js` for route rules, docking, fuel, and encounter resolution
- a new UI surface under `ui/` for route selection, ship readouts, and launch flow

#### 6. Reuse boat patterns instead of inventing a parallel model

Boat travel already solves several problems that space travel will also need:

- active vessel selection
- cargo constraints
- storage capacity
- travel identity tied to a vehicle

Mirror the same player mental model where possible:

- boats own sea travel
- ships own orbital travel
- both have capacity, durability, and role identity

That reduces onboarding cost and keeps the new loop readable.

### Phase 1 And 2 Deliverables

- branch-based city tech tree with visible prerequisites and node effects
- 5 specialization paths aligned with the target fantasy
- treasury-funded permanent city unlocks
- launch-to-orbit-to-docking travel loop inside `GameStates.SPACE`
- basic ship stats and space cargo rules
- QTE framework for launch, docking, emergency maneuvers, and re-entry
- save compatibility for all new progression and travel state

### Phase 1 And 2 Acceptance Criteria

- owning a city changes long-term strategy even before space travel begins
- reaching orbit feels like a playable mode, not a one-click unlock
- players can explain why one city is their science city and another is their port city
- the save format can resume a run while docked, in orbit, or mid-progression without corruption

## Phase 3 Asteroid Belt Combat

Phase 3 should start only after Phase 1 and 2 are stable in saves, controls, and UI.

### Goals

- asteroid navigation hazards
- mining nodes and salvage pockets
- pirate ambush zones and meteor storms
- space combat with weapons, boosts, shields, evasive movement, and repair windows

### Recommended System Split

- `classes/SpaceTravelSystem.js` owns route traversal and hazard spawning
- a new `classes/SpaceCombatSystem.js` owns combat rules and encounter resolution
- a new `classes/SpaceEncounterTable.js` or content module owns weighted events
- `content/itemCatalog.js` expands with ore, salvage, fuel, ship parts, and encounter rewards

### Design Constraint

Do not make combat mandatory on every route. The travel layer needs room for merchant play, mining play, smuggling play, and risk-managed hauling.

### Deliverables

- asteroid field biome rules
- hazard-driven travel events
- ship combat controls and damage model
- mining, salvage, and pirate encounter tables

## Phase 4 Alien Planet Content Pack

This is the point where content scale starts to matter more than foundation work.

### Goals

- 3 to 5 alien worlds with distinct loops, cultures, and hazards
- alien factions with reputation, treaties, smuggling hooks, and faction goods
- worlds that introduce playstyle variety rather than just new shops

### Planet Loop Targets

- barter-focused market planet
- hostile survival planet
- diplomatic alien capital
- relic-hunting ruin world
- bio-luminescent agriculture world

### Recommended Content Structure

Move the current inline `_bqSpaceCatalog()` approach into data-driven content modules.

Suggested additions:

- `content/spacePlanets.js`
- `content/alienFactions.js`
- `content/spaceEncounters.js`
- `content/spaceTradeGoods.js` if the item catalog starts getting too dense

### Deliverables

- 3 to 5 authored planets
- faction reputation and treaty rules
- planet-specific goods and hazards
- new trade and smuggling opportunities tied to faction identity

## Phase 5 Endgame And Meta Progression

This phase should behave like an empire layer built on top of everything earlier.

### Goals

- star lanes and sector control
- flagship upgrades
- multi-city space logistics
- fleet management with role assignment
- DLC-friendly hooks for planets, factions, ships, and story events

### Recommended Systems

- fleet roster and role assignment on the player object or a dedicated fleet manager
- sector ownership or influence layer separate from city ownership
- automated trade, escort, mining, exploration, and smuggling missions
- story-event injection points keyed by sector, faction, and fleet composition

### Deliverables

- multi-ship fleet system
- automated logistics layer
- sector control endgame campaign
- extension points for future planets, factions, ship classes, and rare events

## Suggested Shipping Order

### Milestone A

- branch-based city tech tree
- new specialization paths
- treasury upgrade framework
- save migration for city progression state

### Milestone B

- space launch flow
- orbit route map
- docking and landing permissions
- ship stats and cargo rules
- space QTE framework

### Milestone C

- asteroid hazards
- combat systems
- mining and salvage
- encounter tables

### Milestone D

- alien planets
- factions and treaties
- unique planetary loops

### Milestone E

- endgame sectors
- fleet roles
- logistics automation
- DLC extension hooks

## Immediate Next Build Steps

If work starts now, the most efficient first sequence is:

1. Replace the current city progression prototype with a branch-based schema while preserving save compatibility.
2. Update `classes/CitySpecialization.js` to the new five-path model.
3. Add treasury-backed permanent unlock definitions and UI surfacing in city management.
4. Create `classes/SpaceTravelSystem.js` and move travel rules out of ad hoc flags.
5. Expand the SPACE state UI to support launch, route choice, docking, and ship condition.
6. Add tests for save normalization around the new progression and travel fields.

That sequence builds the foundation once and avoids redoing save migrations later.
