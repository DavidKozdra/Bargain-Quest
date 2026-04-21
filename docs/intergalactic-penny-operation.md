# BQ Intergalactic Penny Operation

This document defines a repo-aware implementation plan for a new galactic crisis campaign:

- primary villain: `Raymond the Bear`
- enemy faction: a violent bear empire that wants to conquer the galaxy
- counter-faction: `DK Resistance`, a loose alliance of fighters, smugglers, and survivors trying to push the bears back
- core pressure: the bear empire spreads every day and grows stronger over time
- player goal: find the empire on the galaxy map, disrupt its expansion, and kill Raymond before the galaxy is overrun

This should ship as a run-level crisis system, not a one-off boss spawn.
It should also remain an addition to the main game, not a hard pivot away from Bargain Quest's normal loop.

## Design Guardrails

This feature only works if unlocking space makes the same game feel bigger.

### Non-Negotiables

- the game stays trading-first
- city growth, cargo, owned routes, and profit still matter after space unlocks
- Earth, orbit, stations, and planet surfaces remain one connected game
- the player should feel increasing scale, not a genre change
- the bear crisis adds pressure to the sandbox instead of replacing it

### What Space Unlock Should Mean

Once space unlocks:

1. the map gets larger
2. the stakes get higher
3. the rewards get better
4. the same core loop becomes more dangerous and more interesting

That means the player should still be thinking about:

- cargo
- route profit
- city ownership
- upgrades
- survival
- long-term growth

The bear empire should make those systems more dramatic, not irrelevant.

### What To Avoid

- a separate story campaign that ignores trade and cities
- constant forced combat that crowds out normal play
- bear content that only matters in isolated scripted moments
- a late-game mode that feels detached from the early and mid game

## Core Fantasy

The player leaves Earth, explores a growing galaxy, uncovers the location of the bear empire, and fights a losing war until they turn it around.

The experience should feel like this:

1. Strange attacks and tribute demands begin showing up in space.
2. Small cells of the `DK Resistance` begin asking for fuel, cargo, escorts, and aid.
3. More systems fall under bear control every few days and become more visible on the galaxy map over time.
4. Trade lanes become hostile and occupied systems get worse over time.
5. The player gathers intel, chooses who to help, hunts bear fleets, and destroys or supports strongholds.
6. Raymond the Bear is revealed as the final boss in a fortified system.
7. Killing Raymond collapses the empire and ends the crisis.

The important feeling is:

- "space opened the game up and now everything matters more"

Not:

- "the old game ended and a new one started"

## Simple Story Frame

The story should stay blunt and readable.

- A brutal bear race has built an intergalactic empire.
- They claim all planets, all trade, and all wealth belong to them.
- Their tribute currency is pennies. Every occupied world pays in metal, labor, fuel, and coin.
- The `DK Resistance` is an improvised anti-bear network made of local militias, traders, station crews, smugglers, and fugitives.
- Raymond the Bear is the warlord at the center of the empire.
- If the player does nothing, the empire spreads every day and becomes harder to stop.
- The player is allowed to side with the resistance, side with the bears, or opportunistically play both for a while.

## Main Gameplay Loop

This feature works best as a repeating loop:

1. Receive alerts that the bear empire has occupied or attacked a system.
2. Open the galaxy map and inspect bear-controlled territory.
3. Watch bear activity become more visible as rumors, sightings, and occupied systems accumulate.
4. Travel to nearby threatened systems.
5. Gather intel from stations, cities, contracts, distress calls, and resistance cells.
6. Choose who to support: bears, resistance, or temporary self-interest.
7. Fight bear patrols, clear blockades, run tribute cargo, or sabotage resistance routes.
8. Reduce local bear strength or reveal the next stronghold.
9. Push toward Raymond's flagship system.
10. Defeat Raymond in a multi-phase boss battle.

This loop should sit on top of normal travel, trading, and expansion play.
It should intensify the sandbox, not suppress it.

## Galaxy Pressure Model

The crisis should advance automatically every day.

### Bear Empire State

Add a new run-level state object:

- `active`
- `dayStarted`
- `empireStrength`
- `systemsControlled`
- `systemsThreatened`
- `capitalSystemKey`
- `raymondRevealed`
- `raymondDefeated`
- `intelPoints`
- `visibilityLevel`
- `knownBearSystems`
- `knownResistanceSystems`
- `tributeCollected`
- `spreadCounter`
- `difficultyTier`
- `resistanceStrength`
- `alignment`
- `bearStanding`
- `resistanceStanding`

This state is global to the run. It should not belong to a single world session.

### Spread Rules

Every few in-game days:

- the empire threatens one or more connected systems
- threatened systems can become occupied if not contested
- occupied systems raise bear strength
- higher empire strength unlocks stronger bear fleets, harsher taxes, and more dangerous boss guards
- occupied systems also become more legible on the map over time through sightings, tolls, and trade disruption

The spread system should prefer:

- routes connected to current bear territory
- high-value trade systems
- frontier systems with fewer defenses

### Occupied System Effects

When a system is occupied:

- travel danger increases
- new bear encounters appear
- station and city prices worsen
- tribute events reduce local wealth
- contracts shift toward rescue, sabotage, convoy defense, and liberation

Occupation should bend the existing economy instead of bypassing it.
Players should still solve problems using trade, movement, city support, and route choice.

## Visibility Model

The bear empire should not be fully visible at the start.

### Visibility Stages

- `rumored`: traders and stations mention trouble, but the map is vague
- `confirmed`: the system is marked as threatened
- `occupied`: the system is visibly under bear control
- `fortified`: the system contains a bear stronghold, tribute hub, or boss guard layer

Visibility should rise through:

- daily spread
- failed convoys
- distress calls
- scouting
- resistance reports
- direct travel into contested space

This gives the galaxy a feeling of slowly darkening as the crisis grows.

## Finding The Bear Empire

The player should not know the full empire immediately.

### Discovery Rules

- only nearby bear activity is visible at first
- deeper bear territory must be revealed through intel
- intel comes from:
  - station rumors
  - captured officers
  - salvaged logs
  - alien diplomats
  - contracts
  - liberated outposts

### Map UI

The galaxy map should gain a bear overlay:

- `threatened systems`
- `occupied systems`
- `known strongholds`
- `suspected capital routes`
- `Raymond signal trace` once late-game intel is high enough

This should layer onto the existing space map rather than replace it.

## DK Resistance

The resistance makes the crisis feel alive and gives the player a meaningful counter-force to support.

### Role

The `DK Resistance` should act as:

- scouts
- smugglers
- convoy defenders
- saboteurs
- local liberators

They should not feel like a polished state faction.
They are improvised and underfunded, which makes player aid matter.

### Ways To Help

- donate fuel
- deliver medicine, food, tools, and weapons
- escort resistance convoys
- break bear blockades
- extract trapped agents
- sabotage tribute lines
- liberate occupied outposts

### Resistance Effects

Supporting the resistance should:

- slow local bear spread
- reveal new intel
- improve safe trade in nearby systems
- unlock rescue and liberation missions
- make Raymond easier to find over time

## Alignment Model

The player should be able to lean toward either side.

### Alignment States

- `neutral`
- `resistance_aligned`
- `bear_aligned`
- `double_dealing`

This should not be a single irreversible click.
Alignment should emerge from repeated actions.

### Bear-Aligned Actions

- deliver tribute
- escort bear convoys
- suppress resistance cells
- sell intel to bear officers
- accept bear toll contracts

### Resistance-Aligned Actions

- deliver aid
- evacuate civilians
- escort resistance fleets
- sabotage occupation infrastructure
- help liberate systems

### Consequences

Bear alignment should grant:

- safer travel in bear territory
- tribute pay
- access to dark markets
- easier passage through occupied systems

Resistance alignment should grant:

- better intel
- aid caches
- hidden routes
- lower threat in liberated corridors
- access to Raymond-hunt missions

The player should be able to exploit both sides for a while, but eventually the war should react to that behavior.

## Enemy Set

The bear empire needs its own space and ground forces.

### Standard Enemies

- `Penny Collector`: weak tribute troops
- `Claw Marine`: standard assault infantry
- `Hull Mauler`: anti-ship breacher
- `Coin Priest`: support unit that buffs bear forces
- `Siege Bear`: elite heavy unit

### Space Threats

- bear patrol ships
- blockade frigates
- tribute convoys
- dreadnought escorts

### Boss

`Raymond the Bear` should be a staged fight:

1. flagship phase in space
2. boarding or command-deck phase
3. final duel or heavy combat phase

Raymond should feel distinct from normal raiders. He is not just a larger stat block.

## Mission Structure

This feature needs recurring crisis content, not just one quest.

### Mission Types

- `Scout`: reveal bear movement in a target system
- `Intercept`: destroy a tribute convoy
- `Liberate`: remove bear occupation from a system
- `Aid Run`: bring supplies to a resistance cell
- `Purge Cell`: help the bears wipe out a resistance pocket
- `Sabotage`: damage spread rate or supply strength
- `Rescue`: save a station or colony under attack
- `Signal Trace`: gather enough intel to reveal Raymond
- `Final Assault`: travel to the capital system and fight Raymond

### Failure Model

Failure should matter but not instantly end the run.

- more occupied systems
- stronger bear fleets
- worse route danger
- higher tribute drain
- fewer safe markets

Failure should create pressure inside the normal game loop.
It should not lock the player out of ordinary progression for too long.

## QTE and Boss Hooks

This campaign should use the space improvements already underway.

### Space QTE Hooks

- `blockade break`
- `tribute convoy intercept`
- `resistance aid docking`
- `smuggled cargo transfer`
- `occupation checkpoint bluff`
- `liberation assault breach`
- `flagship approach`
- `capital shield breach`
- `Raymond escape denial`

### QTE Design Role

QTEs should matter here because this is a war of timing, pressure, and risky delivery work.

They should decide outcomes like:

- whether aid reaches a resistance cell intact
- whether a blockade run succeeds
- whether the player slips past a bear inspection
- whether a tribute convoy escapes
- whether a liberation strike gets momentum

The key rule is that QTEs should modify mission quality, loss, payout, and faction standing.
They should not exist as random interruptions with no strategic consequence.

All new QTEs must support the existing accessibility direction:

- captain assists
- module assists
- `AutopilotPrimer`

## Repo Ownership

This feature lines up with the current codebase like this.

### New System

Create:

- `classes/BearEmpireSystem.js`

Responsibilities:

- own global campaign state
- daily spread
- intel and reveal logic
- visibility state
- resistance support state
- alignment tracking
- occupied system effects
- serialization

### Space Runtime

Update:

- `classes/SpaceTravelSystem.js`
- `ui/spaceTravel.js`

Responsibilities:

- render bear territory on the galaxy map
- expose occupied and threatened systems
- inject bear encounter pressure into travel
- provide capital-system and blockade hooks

Key rule:

- modify the existing space runtime
- do not create a disconnected crisis-only map

### Content Data

Update:

- `content/spacePlanets.js`

Responsibilities:

- bear faction definition
- bear encounter tables
- bear contract text
- Raymond system flavor
- occupied-system event copy

### Quest Layer

Update:

- `classes/QuestSystem.js`
- `game.js`

Responsibilities:

- operation stages
- mission generation
- crisis progression notifications
- victory and failure state transitions

The quest layer should keep pointing back into travel, trade, and territory control.

### Combat Layer

Update:

- `classes/Combat.js`
- `classes/Raider.js`
- `classes/sprites.js`

Responsibilities:

- bear enemy archetypes
- Raymond boss behavior
- visuals and special attacks

### Save Layer

Update:

- `adapters/bargainQuestSaveAdapter.js`
- `classes/SaveSystem.js`

Responsibilities:

- persist bear empire state
- restore occupied systems and active crisis progress

## Recommended Delivery Order

### Phase 1: Crisis Backbone

- add `BearEmpireSystem`
- add daily spread
- save/load support
- bear territory data on the galaxy map

### Phase 2: Occupation Gameplay

- occupied-system penalties
- new bear encounters
- DK resistance support loops
- first bear mission types
- intel and reveal system

### Phase 3: Hunt Loop

- strongholds
- convoy intercepts
- blockade systems
- alignment consequences
- capital-system discovery

### Phase 4: Raymond Boss

- flagship system
- staged boss fight
- ending resolution

## Acceptance Criteria

This feature is ready when:

- the bear empire visibly spreads on its own over time
- bear control becomes more visible in readable stages over time
- the galaxy map clearly shows the threat
- the DK resistance feels present and useful
- the player can meaningfully aid the resistance
- the player can also choose to align with the bears
- the player can slow or reverse expansion through action
- occupied systems feel mechanically different
- Raymond is discoverable through play, not just spawned immediately
- the Raymond fight is a real climax, not a normal combat reskin
- save/load preserves the active campaign state correctly
- unlocking space feels like the game expanded outward instead of changing genres
- trade, city growth, and route choices remain relevant throughout the crisis

## Immediate First Slice

The best first implementation slice is:

1. add `BearEmpireSystem`
2. seed one hidden capital system, 1-2 known threatened systems, and 1-2 resistance cells
3. tick daily spread and visibility growth in the main game loop
4. paint threatened, occupied, and resistance systems on `ui/spaceTravel.js`
5. add simple bear encounters, resistance aid hooks, and alignment notifications

That gets the campaign visible in-game fast and gives the rest of the content a stable foundation.
