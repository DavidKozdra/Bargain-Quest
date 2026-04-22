# City Management Progression Plan

This document defines the direction for turning city management from a prototype panel into a full progression game mode.

The core rule is simple:

- city management must compound

Every major investment should either:

- unlock a new system
- speed up an existing system
- scale an existing output
- feed a later-game branch

## Design Goals

- make `Research Points` the main long-term expansion currency
- make the tech tree broad and layered, not a short ladder
- make build speed and unit training speed part of progression
- make trade, combat, transport, and space feed back into each other
- make space feel like the late-game payoff of city development

## Core Loop

1. grow a city enough to support specialization
2. invest in education, industry, and logistics
3. generate more `Research Points`
4. spend research to unlock stronger buildings, units, and transport
5. use those systems to produce more money, more security, and more research
6. reach orbital and space-tier progression
7. bring back space rewards that further strengthen the city layer

This loop should create a clear snowball:

- education improves research
- research unlocks better buildings and systems
- better buildings improve build speed, trade, and military
- stronger trade and industry fund more expansion
- stronger cities support rockets, lasers, and orbital trade

## Progression Pillars

### 1. Research

`Research Points` should be the main city-scale progression currency.

Research should unlock:

- new buildings
- new unit classes
- faster construction
- faster unit training
- better logistics
- better trade systems
- orbital and alien systems

Research should come from:

- base population output
- education buildings
- city specialization bonuses
- district bonuses
- artifacts, surveys, and late-game space rewards

### 2. Build Speed

Construction speed should be a first-class progression axis.

Players should be able to unlock:

- faster base build times
- additional build queue capacity
- better project acceleration tools
- industrial districts that shorten large projects
- advanced materials that reduce late-game build bottlenecks

Build speed is important because it makes the city feel more alive and lets the player convert plans into momentum.

### 3. Unit Training

Military progression should not just unlock stronger units. It should also improve the speed and quality of force generation.

Players should be able to unlock:

- faster militia recruitment
- barracks and training grounds
- advanced weapon programs
- specialist units
- mechanized and energy-based late-game forces

### 4. Trade

Trade progression should move from simple market upgrades into a real logistics tree.

Trade should unlock:

- deeper stock
- better prices
- stronger caravans
- route throughput
- warehouses
- advanced contracts
- freight systems
- interplanetary trade charters

### 5. Space

Space should be the late-game extension of city progression, not a detached side mode.

Space progression should require:

- research output
- advanced industry
- transport infrastructure
- enough treasury and logistics to sustain launches

Space should return:

- artifacts
- rare materials
- alien trade access
- military upgrades
- advanced research opportunities

## Main Tech Branches

The city game should use six major branches.

### Trade

Purpose:

- improve city wealth, inventory depth, and route profitability

Example unlocks:

- market stalls
- merchant guilds
- contract law
- warehouse expansion
- commodity exchanges
- automated trade networks
- interplanetary trade charters

### Industry

Purpose:

- improve construction speed, material output, and advanced production

Example unlocks:

- workshops
- foundries
- machine tooling
- assembly lines
- advanced materials
- fuel processing
- rocket fabrication

### Research

Purpose:

- increase `Research Points`, unlock advanced science, and support other branches

Example unlocks:

- schools
- libraries
- universities
- research institutes
- applied physics
- advanced materials science
- laser theory
- alien analysis

### Military

Purpose:

- improve defense, unlock better units, and support later combat escalation

Example unlocks:

- militia doctrine
- steel arms
- ballistics
- fortifications
- heavy weapons
- mechanized forces
- energy weapons
- orbital defense systems

### Transport

Purpose:

- connect the economy and move the player from carts to cars to rockets

Example unlocks:

- pack routes
- paved roads
- wagons
- freight depots
- engines
- cars
- trucks
- rocket fuel logistics
- space freight handling

### Space

Purpose:

- unlock orbit, deep-space expansion, and late-game warfare and trade

Example unlocks:

- launch prep
- spaceport construction
- orbital handling
- docking rights
- landing rights
- orbital warfare
- colony support
- deep-space logistics

## Era Structure

The tree should feel like an expanding game, not a flat spreadsheet.

### Early Game

Theme:

- survival, local trade, basic defense, literacy

Examples:

- carts
- roads
- market stalls
- schools
- militia
- workshops

### Mid Game

Theme:

- specialization, scaling, industrial growth

Examples:

- warehouses
- universities
- contract systems
- rifles
- better barracks
- engines
- cars or trucks
- factories

### Late Game

Theme:

- mechanization, orbital infrastructure, energy weaponry

Examples:

- advanced logistics
- mechanized units
- rockets
- launch complexes
- lasers
- orbital stations
- interplanetary trade routes

## Education Building Ladder

Research needs visible buildings, not just hidden passive gains.

Recommended ladder:

1. `School`
2. `Library`
3. `University`
4. `Research Institute`
5. `Orbital Academy`

Each should matter:

- `School`: unlocks basic research generation
- `Library`: improves population-derived research and civic stability
- `University`: major research spike and prerequisite for advanced science
- `Research Institute`: enables high-tier scientific and military research
- `Orbital Academy`: converts space rewards into research and orbital bonuses

## Unlock Rules

Every node should unlock at least one of the following:

- a building
- a unit or weapon class
- a transport mode
- a system rule upgrade

Avoid nodes that only provide a tiny flat bonus with no gameplay change.

## Space Cohesion Rules

To keep space tied to city growth:

- rockets should require advanced research and industrial infrastructure
- lasers should require research plus advanced military and energy tech
- cars should sit on the transport branch before rockets
- interplanetary trade should depend on both trade and space branches
- space should provide rewards that improve research, trade, and military back on the ground

## UI Direction

City management should present fewer, clearer tabs.

Recommended top-level tabs:

- `Overview`
- `Build`
- `Trade`
- `Military`
- `Research`
- `City Identity`
- `Actions`

The `Research` tab should show:

- current `Research Points`
- research per day breakdown
- active queue
- branch map
- next important unlock
- current contribution to orbital progress

## Acceptance Criteria

This direction is working when:

- the player can explain why one city is their research city
- universities feel like a major milestone
- build speed and unit speed feel upgradeable and important
- trade, combat, and space all use the same progression foundation
- space travel feels earned through city growth
- late-game cities can plausibly build rockets, lasers, and interplanetary trade systems

## First Implementation Slice

Recommended first delivery:

1. make `Research Points` the primary visible progression currency
2. replace the old linear research ladder in the UI with the main branch tree
3. add `Library` and `University`
4. expose research-per-day breakdown in the city UI
5. add construction-speed and unit-training-speed unlocks to the tree
6. connect the `Space` branch directly to launch, docking, and landing progression

