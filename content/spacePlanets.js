// spacePlanets.js — Extended planet catalog, alien factions, and space encounters
// Supplements the base 3 planets in Cities.js with additional content.

/**
 * Extended planet catalog — these are merged into _bqSpaceCatalog() results
 * when the expansion content is loaded.
 */
function _bqSpacePlanetsExpansion() {
  return [
    {
      key: 'solara',
      name: 'Solara Prime',
      biome: 'volcanic',
      travelCost: 550,
      researchCost: 80,
      description: 'A tidally locked world split between blazing heat and frozen dark. Miners flock to the terminator zone.',
      goods: ['MoonOre', 'VoidCrystal', 'StellarGlass'],
      alienPresence: 'medium',
      alienTone: 'pragmatic',
      alienText: 'The Solarans respect hard bargains. Bring Iron and Tools — they pay triple.',
      faction: 'solaran_guild',
    },
    {
      key: 'nebulith',
      name: 'Nebulith Station',
      biome: 'station',
      travelCost: 380,
      researchCost: 40,
      description: 'A massive orbital bazaar built from derelict ships. Every faction trades here — if you can handle the chaos.',
      goods: ['StellarGlass', 'XenoFiber', 'StarSpice'],
      alienPresence: 'high',
      alienTone: 'chaotic',
      alienText: 'No rules, no tariffs, no refunds. The Nebulith market changes prices hourly.',
      faction: 'freeport',
    },
    {
      key: 'cryonis',
      name: 'Cryonis Deep',
      biome: 'ice',
      travelCost: 680,
      researchCost: 120,
      description: 'An ancient frozen world beneath miles of ice. Alien ruins from an extinct civilization lie buried in the glaciers.',
      goods: ['AlienRelic', 'VoidCrystal', 'FrozenCore'],
      alienPresence: 'low',
      alienTone: 'silent',
      alienText: 'No living aliens remain. Only the echoes of their technology... and the treasure hunters who came before.',
      faction: 'none',
    },
    {
      key: 'verdana',
      name: 'Verdana Canopy',
      biome: 'jungle',
      travelCost: 490,
      researchCost: 90,
      description: 'A world-spanning jungle with bio-luminescent forests. The Verdani cultivate living ships and organic technology.',
      goods: ['XenoFiber', 'BioLumen', 'StarSpice'],
      alienPresence: 'high',
      alienTone: 'diplomatic',
      alienText: 'The Verdani trade only in trust. Build reputation before expecting their finest wares.',
      faction: 'verdani',
    },
    {
      key: 'obsidium',
      name: 'Obsidium Reach',
      biome: 'asteroid',
      travelCost: 900,
      researchCost: 180,
      description: 'A lawless asteroid field controlled by pirate warlords. Extreme risk, extreme reward.',
      goods: ['AlienRelic', 'VoidCrystal', 'MoonOre', 'SmuggledGems'],
      alienPresence: 'medium',
      alienTone: 'hostile',
      alienText: 'Pay the Warlord\'s toll or fight your way through. Contraband flows freely here.',
      faction: 'void_pirates',
    },
  ];
}

function _bqPlanetWorldProfileCatalog() {
  return {
    defaults: {
      cols: 84,
      rows: 84,
      cityCount: 5,
      landmassMode: 1,
      landingSuffix: 'Port',
      worldGenConfig: {
        warp: 1.0,
        ruggedness: 1.0,
        temperatureVariance: 1.0,
        moistureVariance: 1.0,
        coastalDropoff: 1.0,
      },
      biomeOverrides: {},
      decorTable: {
        Grass: [['bush', 0.07], ['tree', 0.12]],
        Forest: [['rock', 0.09]],
        Sand: [['pebbles', 0.08]],
        Rock: [['rock', 0.08], ['pebbles', 0.13]],
        Snow: [['snowdrift', 0.10]],
        Water: [['lily', 0.04], ['seaweed', 0.08]],
      },
    },
    byKind: {
      station: {
        cols: 64,
        rows: 64,
        cityCount: 4,
        landmassMode: 2,
        airless: true,
        landingSuffix: 'Port',
        worldGenConfig: {
          warp: 0.4,
          ruggedness: 1.2,
          temperatureVariance: 0.3,
          moistureVariance: 0.1,
          coastalDropoff: 2.0,
        },
        biomeOverrides: {
          Water: 'Rock',
          Forest: 'Rock',
          Grass: { split: 0.4, low: 'Sand', high: 'Rock' },
          Snow: 'Rock',
        },
      },
    },
    byBiome: {
      moon: {
        cols: 72,
        rows: 72,
        cityCount: 4,
        landmassMode: 2,
        airless: true,
        landingSuffix: 'Port',
        worldGenConfig: {
          warp: 0.55,
          ruggedness: 1.55,
          temperatureVariance: 0.2,
          moistureVariance: 0.1,
          coastalDropoff: 2.0,
        },
        biomeOverrides: {
          Water: 'Rock',
          Forest: { split: 0.55, low: 'Rock', high: 'Snow' },
          Grass: { split: 0.55, low: 'Rock', high: 'Snow' },
          Sand: 'Rock',
        },
      },
      ice: {
        cols: 78,
        rows: 78,
        cityCount: 4,
        landmassMode: 2,
        airless: true,
        landingSuffix: 'Outpost',
        worldGenConfig: {
          warp: 0.7,
          ruggedness: 1.35,
          temperatureVariance: 0.25,
          moistureVariance: 0.35,
          coastalDropoff: 1.8,
        },
        biomeOverrides: {
          Water: 'Snow',
          Sand: 'Snow',
          Forest: 'Snow',
          Grass: { split: 0.45, low: 'Snow', high: 'Rock' },
        },
      },
      lush: {
        cols: 90,
        rows: 90,
        cityCount: 6,
        landmassMode: 2,
        landingSuffix: 'Gate',
        worldGenConfig: {
          warp: 1.1,
          ruggedness: 0.9,
          temperatureVariance: 1.15,
          moistureVariance: 1.55,
          coastalDropoff: 0.9,
        },
      },
      garden: {
        cols: 86,
        rows: 86,
        cityCount: 5,
        landmassMode: 2,
        landingSuffix: 'Enclave',
        worldGenConfig: {
          warp: 1.05,
          ruggedness: 0.85,
          temperatureVariance: 1.05,
          moistureVariance: 1.45,
          coastalDropoff: 0.95,
        },
      },
      hazard: {
        cols: 88,
        rows: 88,
        cityCount: 5,
        landmassMode: 1,
        airless: true,
        volatile: true,
        landingSuffix: 'Prospect',
        worldGenConfig: {
          warp: 1.35,
          ruggedness: 1.7,
          temperatureVariance: 1.6,
          moistureVariance: 0.3,
          coastalDropoff: 1.5,
        },
        biomeOverrides: {
          Water: 'Rock',
          Snow: 'Rock',
          Forest: 'Rock',
          Grass: { split: 0.5, low: 'Sand', high: 'Rock' },
        },
      },
      volcanic: {
        cols: 88,
        rows: 88,
        cityCount: 5,
        landmassMode: 1,
        airless: true,
        volatile: true,
        landingSuffix: 'Terminus',
        worldGenConfig: {
          warp: 1.45,
          ruggedness: 1.8,
          temperatureVariance: 1.7,
          moistureVariance: 0.25,
          coastalDropoff: 1.45,
        },
        biomeOverrides: {
          Water: 'Rock',
          Snow: 'Rock',
          Forest: 'Rock',
          Grass: { split: 0.55, low: 'Sand', high: 'Rock' },
        },
      },
      asteroid: {
        cols: 76,
        rows: 76,
        cityCount: 4,
        landmassMode: 1,
        airless: true,
        volatile: true,
        landingSuffix: 'Hold',
        worldGenConfig: {
          warp: 1.5,
          ruggedness: 1.9,
          temperatureVariance: 0.6,
          moistureVariance: 0.1,
          coastalDropoff: 1.9,
        },
        biomeOverrides: {
          Water: 'Rock',
          Forest: 'Rock',
          Grass: 'Rock',
          Snow: 'Rock',
        },
      },
      jungle: {
        cols: 92,
        rows: 92,
        cityCount: 6,
        landmassMode: 2,
        landingSuffix: 'Canopy',
        worldGenConfig: {
          warp: 1.15,
          ruggedness: 0.95,
          temperatureVariance: 1.2,
          moistureVariance: 1.7,
          coastalDropoff: 0.85,
        },
      },
    },
    byBodyKey: {
      'luna-dock': { landingCityName: 'Luna Port' },
      grayhold: { landingCityName: 'Grayhold Port' },
      'ice-veil': { landingCityName: 'Ice Veil Outpost' },
      'aurelia-prime': { landingCityName: 'Aurelia Gate' },
      'bloom-moon': { landingCityName: 'Bloom Moon Enclave' },
      'vanta-major': { landingCityName: 'Vanta Prospect' },
      solara: { landingCityName: 'Solara Terminus' },
      cryonis: { landingCityName: 'Cryonis Outpost' },
      verdana: { landingCityName: 'Verdana Canopy' },
      obsidium: { landingCityName: 'Obsidium Hold' },
    },
  };
}

function _bqMergePlanetWorldProfile(base, extra) {
  if (!extra || typeof extra !== 'object') return { ...base };
  return {
    ...base,
    ...extra,
    worldGenConfig: {
      ...(base.worldGenConfig || {}),
      ...(extra.worldGenConfig || {}),
    },
    biomeOverrides: {
      ...(base.biomeOverrides || {}),
      ...(extra.biomeOverrides || {}),
    },
    decorTable: {
      ...(base.decorTable || {}),
      ...(extra.decorTable || {}),
    },
  };
}

function _bqResolvePlanetWorldProfile(nodeKey, body) {
  const catalog = _bqPlanetWorldProfileCatalog();
  let profile = _bqMergePlanetWorldProfile({}, catalog.defaults);

  if (body?.kind && catalog.byKind?.[body.kind]) {
    profile = _bqMergePlanetWorldProfile(profile, catalog.byKind[body.kind]);
  }
  if (body?.biome && catalog.byBiome?.[body.biome]) {
    profile = _bqMergePlanetWorldProfile(profile, catalog.byBiome[body.biome]);
  }
  if (body?.key && catalog.byBodyKey?.[body.key]) {
    profile = _bqMergePlanetWorldProfile(profile, catalog.byBodyKey[body.key]);
  }
  if (nodeKey && catalog.byNode?.[nodeKey]) {
    profile = _bqMergePlanetWorldProfile(profile, catalog.byNode[nodeKey]);
  }

  if (!profile.landingCityName) {
    profile.landingCityName = `${body?.name || 'Surface'} ${profile.landingSuffix || 'Port'}`;
  }
  return profile;
}

/**
 * New space-exclusive trade goods to add to ItemLibrary.
 * These supplement the base 4 space items (MoonOre, StellarGlass, XenoFiber, AlienRelic).
 */
function _bqSpaceItemsExpansion() {
  if (typeof Item === 'undefined') return {};
  return {
    VoidCrystal: new Item({
      name: 'Void Crystal',
      sprite: 'void_crystal.png',
      baseValue: 280,
      category: 'Space',
      weight: 1,
      rarity: 4.5,
      tags: new Set(['space', 'rare', 'rock']),
    }),
    StarSpice: new Item({
      name: 'Star Spice',
      sprite: 'star_spice.png',
      baseValue: 160,
      category: 'Space',
      weight: 1,
      rarity: 3.2,
      tags: new Set(['space', 'alien', 'food']),
    }),
    BioLumen: new Item({
      name: 'Bio-Lumen',
      sprite: 'bio_lumen.png',
      baseValue: 200,
      category: 'Space',
      weight: 1,
      rarity: 3.8,
      tags: new Set(['space', 'alien', 'organic']),
    }),
    FrozenCore: new Item({
      name: 'Frozen Core',
      sprite: 'frozen_core.png',
      baseValue: 340,
      category: 'Artifact',
      weight: 2,
      rarity: 5.0,
      tags: new Set(['space', 'rare', 'ancient']),
    }),
  };
}

/**
 * Alien faction definitions.
 * Each faction has a reputation track, trade preferences, and special events.
 */
function _bqAlienFactions() {
  return {
    solaran_guild: {
      id: 'solaran_guild',
      name: 'Solaran Mining Guild',
      description: 'Industrial pragmatists who value ore and tools above all else.',
      homeworld: 'solara',
      tradePreferences: {
        wants: ['Iron', 'Tools', 'Wood'],
        offers: ['MoonOre', 'VoidCrystal'],
        wantMultiplier: 2.5,  // pay 2.5x for goods they want
        offerDiscount: 0.8,   // sell their goods at 80% base
      },
      reputationTiers: [
        { level: 0, name: 'Stranger', bonus: null },
        { level: 20, name: 'Known Trader', bonus: '5% price discount' },
        { level: 50, name: 'Guild Partner', bonus: '10% discount + bulk orders' },
        { level: 80, name: 'Guild Elder', bonus: '15% discount + exclusive ore' },
      ],
    },
    verdani: {
      id: 'verdani',
      name: 'Verdani Collective',
      description: 'Bio-engineers who grow technology from living organisms. Value diplomacy and reputation.',
      homeworld: 'verdana',
      tradePreferences: {
        wants: ['Herbs', 'Wheat', 'Fish'],
        offers: ['XenoFiber', 'BioLumen', 'StarSpice'],
        wantMultiplier: 2.0,
        offerDiscount: 0.85,
      },
      reputationTiers: [
        { level: 0, name: 'Outsider', bonus: null },
        { level: 25, name: 'Seedling', bonus: 'Access to BioLumen' },
        { level: 55, name: 'Sapling', bonus: '10% discount + Star Spice' },
        { level: 85, name: 'Elder Root', bonus: '20% discount + unique XenoFiber variants' },
      ],
    },
    freeport: {
      id: 'freeport',
      name: 'Nebulith Freeport',
      description: 'Anarchic trading hub. No rules, volatile prices, everything available.',
      homeworld: 'nebulith',
      tradePreferences: {
        wants: ['Silk', 'Wine', 'Jewelry', 'SmuggledGems'],
        offers: ['StellarGlass', 'XenoFiber', 'StarSpice'],
        wantMultiplier: 1.5,
        offerDiscount: 0.7, // cheap but volatile
      },
      reputationTiers: [
        { level: 0, name: 'Nobody', bonus: null },
        { level: 15, name: 'Regular', bonus: 'Fewer scams' },
        { level: 40, name: 'Connected', bonus: 'Black market access' },
        { level: 70, name: 'Boss', bonus: 'Set your own prices (within reason)' },
      ],
    },
    void_pirates: {
      id: 'void_pirates',
      name: 'Void Pirates',
      description: 'Ruthless space raiders. Respect only strength and gold.',
      homeworld: 'obsidium',
      tradePreferences: {
        wants: ['Weapons', 'SmuggledGems', 'Wine'],
        offers: ['AlienRelic', 'VoidCrystal', 'MoonOre'],
        wantMultiplier: 3.0,
        offerDiscount: 0.6, // heavily discounted if you survive
      },
      reputationTiers: [
        { level: 0, name: 'Target', bonus: 'Will attack on sight' },
        { level: 30, name: 'Tolerated', bonus: 'Safe passage (usually)' },
        { level: 60, name: 'Ally', bonus: 'Raider escort on routes' },
        { level: 90, name: 'Warlord', bonus: 'Command pirate fleet + tribute' },
      ],
    },
  };
}

/**
 * Space encounter table — random events that occur during space travel.
 */
function _bqSpaceEncounters() {
  return [
    {
      id: 'asteroid_field',
      name: 'Asteroid Field',
      weight: 15,
      description: 'Dense asteroid field ahead! Navigate carefully or risk hull damage.',
      choices: [
        { text: 'Navigate carefully (Slower, safe)', effect: { timeCost: 1 } },
        { text: 'Punch through (Fast, risky)', effect: { hpRisk: 3, timeSave: 1 } },
        { text: 'Mine as you go (Speed bonus for ore)', effect: { timeCost: 1, loot: 'MoonOre', lootQty: 2 } },
      ],
    },
    {
      id: 'derelict_ship',
      name: 'Derelict Ship',
      weight: 10,
      description: 'A damaged ship drifts nearby. It could contain salvage... or a trap.',
      choices: [
        { text: 'Board and salvage', effect: { loot: 'StellarGlass', lootQty: 1, hpRisk: 2, trapChance: 0.3 } },
        { text: 'Scan from distance', effect: { info: true } },
        { text: 'Ignore and continue', effect: {} },
      ],
    },
    {
      id: 'alien_merchant',
      name: 'Wandering Alien Merchant',
      weight: 12,
      description: 'A lone alien vessel hails you. They want to trade — unusual goods at unusual prices.',
      choices: [
        { text: 'Trade (spend 100g for rare goods)', effect: { goldCost: 100, loot: 'VoidCrystal', lootQty: 1 } },
        { text: 'Barter (offer Iron for Xeno Fiber)', effect: { itemCost: 'Iron', itemCostQty: 3, loot: 'XenoFiber', lootQty: 1 } },
        { text: 'Decline politely', effect: {} },
      ],
    },
    {
      id: 'pirate_ambush',
      name: 'Pirate Ambush',
      weight: 8,
      biomeFilter: ['asteroid', 'hazard'],
      description: 'Space pirates emerge from the asteroid shadow! Fight or pay the toll.',
      choices: [
        { text: 'Fight! (Combat encounter)', effect: { combat: true, combatStrength: 5 } },
        { text: 'Pay toll (200g)', effect: { goldCost: 200 } },
        { text: 'Flee (risk cargo loss)', effect: { cargoRisk: 0.2 } },
      ],
    },
    {
      id: 'solar_storm',
      name: 'Solar Storm',
      weight: 10,
      description: 'A massive solar storm rolls in! Seek shelter or ride it out.',
      choices: [
        { text: 'Shelter behind asteroid (wait it out)', effect: { timeCost: 2 } },
        { text: 'Full speed through', effect: { hpRisk: 4 } },
        { text: 'Use the storm (risky speed boost)', effect: { speedBoost: true, hpRisk: 2 } },
      ],
    },
    {
      id: 'signal_beacon',
      name: 'Mysterious Signal',
      weight: 7,
      description: 'An encrypted signal beacon pulses from a nearby moon. Investigate?',
      choices: [
        { text: 'Investigate (may find treasure or danger)', effect: { loot: 'AlienRelic', lootQty: 1, hpRisk: 3, trapChance: 0.4 } },
        { text: 'Record coordinates for later', effect: { info: true } },
        { text: 'Ignore', effect: {} },
      ],
    },
    {
      id: 'fuel_cache',
      name: 'Abandoned Fuel Cache',
      weight: 9,
      description: 'An abandoned depot floats ahead. Fuel cells and supplies are visible.',
      choices: [
        { text: 'Salvage fuel and supplies', effect: { goldGain: 80, healHP: 2 } },
        { text: 'Quick grab and go', effect: { goldGain: 40 } },
        { text: 'Leave it (could be bait)', effect: {} },
      ],
    },
    {
      id: 'alien_distress',
      name: 'Alien Distress Signal',
      weight: 6,
      description: 'An alien vessel sends a distress signal. Help could mean a powerful ally... or a clever ambush.',
      choices: [
        { text: 'Help them (reputation gain)', effect: { factionRep: 15, timeCost: 1 } },
        { text: 'Demand payment first', effect: { goldGain: 150, factionRep: -5 } },
        { text: 'Ignore', effect: { factionRep: -10 } },
      ],
    },
    {
      id: 'nebula_shortcut',
      name: 'Nebula Shortcut',
      weight: 8,
      description: 'A dense nebula blocks your path. A shortcut through could save days, but navigation is treacherous.',
      choices: [
        { text: 'Take the shortcut (skill check)', effect: { timeSave: 2, hpRisk: 3, skillCheck: 'magic' } },
        { text: 'Go around (safe but slow)', effect: { timeCost: 2 } },
        { text: 'Scan for anomalies', effect: { info: true, loot: 'StellarGlass', lootQty: 1 } },
      ],
    },
    {
      id: 'trade_convoy',
      name: 'Alien Trade Convoy',
      weight: 5,
      description: 'A large alien trade convoy passes through. They offer bulk deals on rare goods.',
      choices: [
        { text: 'Buy in bulk (500g for mixed goods)', effect: { goldCost: 500, loot: 'StarSpice', lootQty: 3, bonusLoot: 'BioLumen', bonusLootQty: 2 } },
        { text: 'Trade cargo (exchange 5 Silk)', effect: { itemCost: 'Silk', itemCostQty: 5, loot: 'XenoFiber', lootQty: 3 } },
        { text: 'Just observe', effect: { info: true } },
      ],
    },
  ];
}

// Register expansion items into ItemLibrary when loaded
(function _registerSpaceExpansion() {
  if (typeof window === 'undefined') return;

  // Register new items
  const newItems = _bqSpaceItemsExpansion();
  if (typeof ItemLibrary !== 'undefined') {
    for (const [key, item] of Object.entries(newItems)) {
      if (!ItemLibrary[key]) {
        ItemLibrary[key] = item;
      }
    }
  }

  // Merge expanded planets into the base catalog
  const origCatalog = window._bqSpaceCatalog;
  if (typeof origCatalog === 'function') {
    window._bqSpaceCatalogBase = origCatalog;
    window._bqSpaceCatalog = function () {
      const base = window._bqSpaceCatalogBase();
      const expansion = _bqSpacePlanetsExpansion();
      // Deduplicate by key
      const keys = new Set(base.map(p => p.key));
      for (const p of expansion) {
        if (!keys.has(p.key)) {
          base.push(p);
          keys.add(p.key);
        }
      }
      return base;
    };
    // Also update the static method on City if it exists
    if (typeof City !== 'undefined' && City.getSpacePlanets) {
      const origMethod = City.getSpacePlanets;
      City.getSpacePlanets = function () {
        const dynamic = (typeof window.BQGetSpaceDestinationCatalog === 'function')
          ? window.BQGetSpaceDestinationCatalog()
          : null;
        if (Array.isArray(dynamic) && dynamic.length > 0) return dynamic;
        return (typeof origMethod === 'function') ? origMethod.call(this) : window._bqSpaceCatalog();
      };
    }
  }

  // Make faction and encounter data globally accessible
  window.BQSpaceFactions = _bqAlienFactions;
  window.BQSpaceEncounters = _bqSpaceEncounters;
  window.BQSpacePlanetWorldProfiles = _bqPlanetWorldProfileCatalog();
  window.BQGetSpacePlanetWorldProfile = _bqResolvePlanetWorldProfile;
})();
