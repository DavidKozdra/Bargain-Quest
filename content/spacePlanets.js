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
      carbonLevel: 35,
      sulfurLevel: 0,
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
        carbonLevel: 10,
        sulfurLevel: 0,
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
        carbonLevel: 18,
        sulfurLevel: 12,
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
        carbonLevel: 24,
        sulfurLevel: 8,
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
        carbonLevel: 72,
        sulfurLevel: 4,
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
        carbonLevel: 68,
        sulfurLevel: 6,
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
        carbonLevel: 44,
        sulfurLevel: 22,
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
        carbonLevel: 34,
        sulfurLevel: 38,
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
        carbonLevel: 8,
        sulfurLevel: 28,
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
        carbonLevel: 82,
        sulfurLevel: 10,
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
      'luna-dock': { landingCityName: 'Luna Port', carbonLevel: 12, sulfurLevel: 10 },
      grayhold: { landingCityName: 'Grayhold Port', carbonLevel: 16, sulfurLevel: 14 },
      'ice-veil': { landingCityName: 'Ice Veil Outpost', carbonLevel: 22, sulfurLevel: 10 },
      'aurelia-prime': { landingCityName: 'Aurelia Gate', carbonLevel: 76, sulfurLevel: 5 },
      'bloom-moon': { landingCityName: 'Bloom Moon Enclave', carbonLevel: 64, sulfurLevel: 8 },
      'vanta-major': { landingCityName: 'Vanta Prospect', carbonLevel: 48, sulfurLevel: 30 },
      solara: { landingCityName: 'Solara Terminus', carbonLevel: 36, sulfurLevel: 42 },
      cryonis: { landingCityName: 'Cryonis Outpost', carbonLevel: 20, sulfurLevel: 12 },
      verdana: { landingCityName: 'Verdana Canopy', carbonLevel: 86, sulfurLevel: 9 },
      obsidium: { landingCityName: 'Obsidium Hold', carbonLevel: 6, sulfurLevel: 34 },
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

function _bqGetHomeworldPlanetReferenceSize() {
  const root = (typeof window !== 'undefined') ? window : globalThis;
  const getSession = root?.BQGetWorldSession;
  const homeKey = root?.BQ_WORLD_SESSION_KEYS?.HOMEWORLD || 'homeworld';
  const homeSession = (typeof getSession === 'function') ? getSession(homeKey) : null;
  const activeSession = (typeof getSession === 'function') ? getSession() : null;
  const candidates = [homeSession, activeSession, { cols: root?.cols, rows: root?.rows }];

  for (const candidate of candidates) {
    if (!candidate || candidate.sessionType === 'planet_surface') continue;
    const cols = Math.round(Number(candidate.cols));
    const rows = Math.round(Number(candidate.rows));
    if (cols > 0 && rows > 0) return { cols, rows };
  }

  return { cols: 150, rows: 150 };
}

function _bqPlanetWorldSizeFactor(body) {
  if (body?.kind === 'station') return 0.62;
  switch (body?.biome) {
    case 'moon': return 0.9;
    case 'ice': return 0.94;
    case 'hazard': return 1.0;
    case 'volcanic': return 1.02;
    case 'lush': return 1.08;
    case 'garden': return 1.04;
    case 'asteroid': return 0.9;
    case 'jungle': return 1.14;
    default: return 1.0;
  }
}

function _bqScalePlanetWorldProfile(profile, nodeKey, body) {
  void nodeKey;
  if (!profile || typeof profile !== 'object') return profile;

  const authoredCols = Math.max(1, Math.round(Number(profile.cols) || 84));
  const authoredRows = Math.max(1, Math.round(Number(profile.rows) || 84));
  const authoredCityCount = Math.max(1, Math.round(Number(profile.cityCount) || 5));
  const reference = _bqGetHomeworldPlanetReferenceSize();
  const factor = _bqPlanetWorldSizeFactor(body);
  const scaledCols = Math.max(
    authoredCols,
    Math.min(2400, Math.round(reference.cols * factor))
  );
  const scaledRows = Math.max(
    authoredRows,
    Math.min(2400, Math.round(reference.rows * factor))
  );
  const geometricScale = Math.sqrt((scaledCols * scaledRows) / Math.max(1, authoredCols * authoredRows));
  const scaledCityCount = Math.max(
    authoredCityCount,
    Math.min(240, Math.round(authoredCityCount * geometricScale))
  );

  return {
    ...profile,
    cols: scaledCols,
    rows: scaledRows,
    cityCount: scaledCityCount,
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
  profile = _bqScalePlanetWorldProfile(profile, nodeKey, body);

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

function _bqSpaceDestinationRulesCatalog() {
  return {
    orbit: {
      thesis: 'Safe launch hub and baseline market.',
      imports: ['Tools', 'Iron', 'Fish', 'Wheat'],
      exports: ['StellarGlass'],
      hazard: 'Low patrol risk',
      opportunity: 'Reliable ship services and orbital freight.',
      localRule: 'Best place to reset routes and return to Earth.',
      importSellMultiplier: 1.12,
      exportBuyMultiplier: 0.96,
    },
    luna: {
      thesis: 'Ore logistics and early space hauling.',
      imports: ['Tools', 'Wood', 'Bread', 'Fish'],
      exports: ['MoonOre', 'StellarGlass'],
      hazard: 'Low gravity docking lanes',
      opportunity: 'Cheap ore runs for new captains.',
      localRule: 'Mining cities restock Moon Ore more often.',
      importSellMultiplier: 1.22,
      exportBuyMultiplier: 0.88,
    },
    'luna-station': {
      thesis: 'Dependable ore exchange and dock services.',
      imports: ['Tools', 'Wood', 'Bread', 'Fish'],
      exports: ['MoonOre', 'StellarGlass'],
      hazard: 'Customs delays',
      opportunity: 'Stable starter routes.',
      localRule: 'Lower volatility than frontier worlds.',
      importSellMultiplier: 1.18,
      exportBuyMultiplier: 0.9,
    },
    'luna-dock': {
      thesis: 'Short-haul moon cargo and fuel depot work.',
      imports: ['Tools', 'Iron', 'Wheat'],
      exports: ['MoonOre', 'StellarGlass'],
      hazard: 'Crater approach corridors',
      opportunity: 'Fast mining resupply contracts.',
      localRule: 'Tools sell especially well here.',
      importSellMultiplier: 1.24,
      exportBuyMultiplier: 0.88,
    },
    grayhold: {
      thesis: 'Heavy industry mining colony.',
      imports: ['Tools', 'Wood', 'Bread', 'Wine'],
      exports: ['MoonOre', 'Iron', 'StellarGlass'],
      hazard: 'Industrial dust storms',
      opportunity: 'Bulk ore and salvage supply.',
      localRule: 'Freighters earn stronger margins than scouts.',
      importSellMultiplier: 1.25,
      exportBuyMultiplier: 0.86,
    },
    'ice-veil': {
      thesis: 'Cold extraction moon and survival logistics.',
      imports: ['Wood', 'Bread', 'Tools', 'Salt'],
      exports: ['FrozenCore', 'StellarGlass'],
      hazard: 'Cryo fronts slow surface movement.',
      opportunity: 'Rare frozen cores and life-support contracts.',
      localRule: 'Food and fuel-adjacent goods command premiums.',
      importSellMultiplier: 1.28,
      exportBuyMultiplier: 0.92,
    },
    aurelia: {
      thesis: 'Diplomatic garden trade and botanical luxuries.',
      imports: ['Herbs', 'Fish', 'Wheat', 'Pottery'],
      exports: ['XenoFiber', 'BioLumen', 'StarSpice'],
      hazard: 'Permit inspections',
      opportunity: 'Reputation-gated organic goods.',
      localRule: 'Friendly trade rewards patient route building.',
      importSellMultiplier: 1.2,
      exportBuyMultiplier: 0.9,
    },
    'aurelia-prime': {
      thesis: 'Living-planet fiber markets.',
      imports: ['Herbs', 'Fish', 'Wheat', 'Pottery'],
      exports: ['XenoFiber', 'BioLumen', 'StarSpice'],
      hazard: 'Bio-customs checks',
      opportunity: 'Best source of organic space goods.',
      localRule: 'Reputation should gate the best inventory later.',
      importSellMultiplier: 1.22,
      exportBuyMultiplier: 0.88,
    },
    'bloom-moon': {
      thesis: 'Research enclave and seed vault.',
      imports: ['Herbs', 'Silk', 'Pottery', 'Jewelry'],
      exports: ['BioLumen', 'XenoFiber'],
      hazard: 'Research quarantine windows',
      opportunity: 'Science contracts and rare samples.',
      localRule: 'Luxury and research-adjacent goods sell well.',
      importSellMultiplier: 1.18,
      exportBuyMultiplier: 0.9,
    },
    'verdant-ring': {
      thesis: 'Brokered alien customs station.',
      imports: ['Silk', 'Wine', 'Jewelry'],
      exports: ['XenoFiber', 'StarSpice'],
      hazard: 'Broker fees',
      opportunity: 'Fast access to multiple alien buyers.',
      localRule: 'High value goods beat bulk freight.',
      importSellMultiplier: 1.16,
      exportBuyMultiplier: 0.9,
    },
    vanta: {
      thesis: 'Dangerous relic frontier and outlaw salvage.',
      imports: ['Weapons', 'Wine', 'Tools', 'SmuggledGems'],
      exports: ['AlienRelic', 'VoidCrystal', 'MoonOre'],
      hazard: 'Pirates, unstable ruins, and tribute pressure',
      opportunity: 'Highest risk routes with the richest finds.',
      localRule: 'Armed ships reduce the cost of doing business.',
      importSellMultiplier: 1.34,
      exportBuyMultiplier: 0.76,
    },
    'vanta-major': {
      thesis: 'Hostile ruins and black-market relic caches.',
      imports: ['Weapons', 'Wine', 'Tools', 'SmuggledGems'],
      exports: ['AlienRelic', 'VoidCrystal', 'MoonOre'],
      hazard: 'Raider tolls and ruin traps',
      opportunity: 'Premium relic recovery.',
      localRule: 'Cargo profit is high, but surface danger is higher.',
      importSellMultiplier: 1.38,
      exportBuyMultiplier: 0.74,
    },
    'rift-anchor': {
      thesis: 'Fortified fence for salvage and contraband.',
      imports: ['Wine', 'Jewelry', 'SmuggledGems'],
      exports: ['AlienRelic', 'StellarGlass'],
      hazard: 'Privateer inspections',
      opportunity: 'Black-market flips and protection contracts.',
      localRule: 'Contraband has better margins than honest freight.',
      importSellMultiplier: 1.3,
      exportBuyMultiplier: 0.8,
    },
    solara: {
      thesis: 'Tidally locked forge world for hard bargains.',
      imports: ['Iron', 'Tools', 'Wood'],
      exports: ['MoonOre', 'VoidCrystal', 'StellarGlass'],
      hazard: 'Terminator heat surges',
      opportunity: 'Mining guilds pay aggressively for industrial cargo.',
      localRule: 'Tools and Iron sell far above normal rates.',
      importSellMultiplier: 1.42,
      exportBuyMultiplier: 0.82,
    },
    nebulith: {
      thesis: 'Chaotic freeport with volatile prices.',
      imports: ['Silk', 'Wine', 'Jewelry', 'SmuggledGems'],
      exports: ['StellarGlass', 'XenoFiber', 'StarSpice'],
      hazard: 'Scams and price swings',
      opportunity: 'Cheap rare goods if you can absorb the chaos.',
      localRule: 'Prices favor bold bulk buys, not predictable routes.',
      importSellMultiplier: 1.18,
      exportBuyMultiplier: 0.7,
    },
    cryonis: {
      thesis: 'Frozen relic world for patient explorers.',
      imports: ['Wood', 'Bread', 'Tools', 'Salt'],
      exports: ['AlienRelic', 'VoidCrystal', 'FrozenCore'],
      hazard: 'Whiteout travel and buried traps',
      opportunity: 'Ancient artifacts and frozen cores.',
      localRule: 'Small cargoes can outperform bulk routes.',
      importSellMultiplier: 1.3,
      exportBuyMultiplier: 0.84,
    },
    verdana: {
      thesis: 'Trust-first bio-engineering world.',
      imports: ['Herbs', 'Wheat', 'Fish'],
      exports: ['XenoFiber', 'BioLumen', 'StarSpice'],
      hazard: 'Living terrain and diplomatic restrictions',
      opportunity: 'Organic technology and reputation trade.',
      localRule: 'Repeated fair trade should unlock better goods.',
      importSellMultiplier: 1.26,
      exportBuyMultiplier: 0.85,
    },
    obsidium: {
      thesis: 'Pirate asteroid economy with brutal upside.',
      imports: ['Weapons', 'SmuggledGems', 'Wine'],
      exports: ['AlienRelic', 'VoidCrystal', 'MoonOre'],
      hazard: 'Pirate tolls and ambush corridors',
      opportunity: 'The best prices if your ship survives.',
      localRule: 'Combat strength matters as much as cargo space.',
      importSellMultiplier: 1.5,
      exportBuyMultiplier: 0.62,
    },
  };
}

function _bqResolveSpaceDestinationRules(nodeKey, body = null) {
  const catalog = _bqSpaceDestinationRulesCatalog();
  const bodyKey = typeof body?.bodyKey === 'string' ? body.bodyKey : body?.key;
  const candidates = [bodyKey, nodeKey, body?.biome, body?.kind].filter(Boolean);
  let rules = null;
  for (const key of candidates) {
    if (catalog[key]) {
      rules = { key, ...catalog[key] };
      break;
    }
  }
  if (!rules) {
    rules = {
      key: nodeKey || bodyKey || 'frontier',
      thesis: 'Uncharted frontier trade.',
      imports: ['Tools', 'Bread', 'Iron'],
      exports: Array.isArray(body?.goods) ? body.goods.slice() : ['StellarGlass'],
      hazard: 'Unknown local hazards',
      opportunity: 'Scout the market before committing cargo.',
      localRule: 'Prices vary until better intel is available.',
      importSellMultiplier: 1.12,
      exportBuyMultiplier: 0.92,
    };
  }

  const factionId = body?.faction || rules.faction || null;
  const factions = _bqAlienFactions();
  const faction = factionId && factions[factionId] ? factions[factionId] : null;
  if (faction?.tradePreferences) {
    const prefs = faction.tradePreferences;
    rules = {
      ...rules,
      faction: faction.id,
      factionName: faction.name,
      imports: [...new Set([...(rules.imports || []), ...(prefs.wants || [])])],
      exports: [...new Set([...(rules.exports || []), ...(prefs.offers || [])])],
      importSellMultiplier: Math.max(Number(rules.importSellMultiplier) || 1, Number(prefs.wantMultiplier) || 1),
      exportBuyMultiplier: Math.min(Number(rules.exportBuyMultiplier) || 1, Number(prefs.offerDiscount) || 1),
    };
  }

  return {
    ...rules,
    imports: Array.isArray(rules.imports) ? rules.imports.slice() : [],
    exports: Array.isArray(rules.exports) ? rules.exports.slice() : [],
  };
}

function _bqCurrentSpaceSurfaceContext() {
  const root = (typeof window !== 'undefined') ? window : globalThis;
  const session = typeof root?.BQGetWorldSession === 'function' ? root.BQGetWorldSession() : null;
  if (!session || session.sessionType !== 'planet_surface') return null;
  return session.spaceContext || null;
}

function _bqIsSpaceItemMatch(itemKey, matchKey) {
  if (!itemKey || !matchKey) return false;
  if (itemKey === matchKey) return true;
  if (matchKey === 'Weapons') {
    const item = typeof ItemLibrary !== 'undefined' ? ItemLibrary[itemKey] : null;
    return item?.category === 'Weapon' || item?.tags?.has?.('weapon');
  }
  return false;
}

function _bqSpaceMarketPriceMultiplier(itemKey, isSelling, context = null) {
  const ctx = context || _bqCurrentSpaceSurfaceContext();
  if (!ctx) return 1;
  const rules = _bqResolveSpaceDestinationRules(ctx.nodeKey, ctx);
  if (!rules) return 1;

  let multiplier = 1;
  if (isSelling && rules.imports.some((key) => _bqIsSpaceItemMatch(itemKey, key))) {
    multiplier *= Math.max(1, Number(rules.importSellMultiplier) || 1);
  }
  if (!isSelling && rules.exports.some((key) => _bqIsSpaceItemMatch(itemKey, key))) {
    multiplier *= Math.max(0.35, Math.min(1, Number(rules.exportBuyMultiplier) || 1));
  }
  return Math.max(0.25, Math.min(4, multiplier));
}

function _bqApplySpaceMarketStock(city, context = null) {
  const ctx = context || _bqCurrentSpaceSurfaceContext();
  if (!city || !ctx || typeof ItemLibrary === 'undefined') return;
  const rules = _bqResolveSpaceDestinationRules(ctx.nodeKey, ctx);
  const exports = Array.isArray(rules?.exports) ? rules.exports : [];
  const imports = Array.isArray(rules?.imports) ? rules.imports : [];
  for (const itemKey of exports) {
    if (ItemLibrary[itemKey] && typeof city._addOrIncrement === 'function') {
      city._addOrIncrement(itemKey, 2 + Math.floor(Math.random() * 3));
    }
  }
  for (const itemKey of imports) {
    if (ItemLibrary[itemKey] && typeof city._addOrIncrement === 'function' && Math.random() < 0.35) {
      city._addOrIncrement(itemKey, 1);
    }
  }
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
      name: 'Abandoned Supply Cache',
      weight: 9,
      description: 'An abandoned depot floats ahead. Emergency rations and spare parts are visible.',
      choices: [
        { text: 'Salvage supplies', effect: { goldGain: 80, healHP: 2 } },
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
  window.BQSpaceDestinationRules = _bqSpaceDestinationRulesCatalog;
  window.BQGetSpaceDestinationRules = _bqResolveSpaceDestinationRules;
  window.BQGetSpaceMarketPriceMultiplier = _bqSpaceMarketPriceMultiplier;
  window.BQApplySpaceMarketStock = _bqApplySpaceMarketStock;
  window.BQSpacePlanetWorldProfiles = _bqPlanetWorldProfileCatalog();
  window.BQScaleSpacePlanetWorldProfile = _bqScalePlanetWorldProfile;
  window.BQGetSpacePlanetWorldProfile = _bqResolvePlanetWorldProfile;
})();
