// Raider.js — Raider bands that patrol the map and ambush the player

function _bqRaiderEntityStream() {
  if (typeof window !== 'undefined' && window.BQSeededRNG && typeof window.BQSeededRNG.stream === 'function') {
    return window.BQSeededRNG.stream('raider:entity');
  }
  return null;
}
function _bqRaiderEntityRand() {
  const s = _bqRaiderEntityStream();
  return s ? s.random() : Math.random();
}

function _bqRaiderIsCityTile(x, y) {
  const key = `${x},${y}`;
  if (typeof cityLocationMap !== 'undefined' && cityLocationMap && typeof cityLocationMap.has === 'function') {
    return cityLocationMap.has(key);
  }
  if (typeof cities !== 'undefined' && Array.isArray(cities)) {
    return cities.some((city) => city?.location?.x === x && city?.location?.y === y);
  }
  return false;
}
let _bqNextRaiderId = 1;

const RAIDER_TYPE_LABELS = {
  bandit: 'Bandit',
  marauder: 'Marauder',
  raider: 'Raider',
  boss: 'Raider Captain',
  scout: 'Scout',
  pirate: 'Pirate',
  dragon: 'Dragon',
  blackKnight: 'Black Knight',
  wraith: 'Wraith',
  seaMonster: 'Sea Monster',
  sandWorm: 'Sand Worm',
  iceGolem: 'Ice Golem',
  voidHound: 'Void Hound',
  thornBeast: 'Thorn Beast',
  magmaSerpent: 'Magma Serpent',
  grazer: 'Grazer',
  pennyCollector: 'Penny Collector',
  clawMarine: 'Claw Marine',
  siegeBear: 'Siege Bear',
  raymond: 'Raymond the Bear',
};

const MONSTER_RAIDER_TYPES = new Set([
  'dragon',
  'blackKnight',
  'wraith',
  'seaMonster',
  'sandWorm',
  'iceGolem',
  'voidHound',
  'thornBeast',
  'magmaSerpent',
  'siegeBear',
  'raymond',
]);

const NEUTRAL_RAIDER_TYPES = new Set(['grazer']);

const RAIDER_SHARED_NOUNS = [
  'Ash Wolf', 'Black Banner', 'Coin Knife', 'Dust Crown', 'Ember Fang',
  'Grim Lantern', 'Hollow Helm', 'Iron Wake', 'Moon Hook', 'Red Tide',
  'Ridge Hound', 'Salt Crown', 'Storm Eye', 'Torchbearer', 'White Maw',
  'Bone Ledger', 'Broken Compass', 'Cold Anvil', 'Copper Fang', 'Crooked Mile',
  'Dead Lantern', 'Dry Well', 'Empty Purse', 'Fallow Crown', 'Gallows Road',
  'Grey Tithe', 'Hungry Wheel', 'Last Toll', 'Long Winter', 'Low Tide',
  'Nine Debts', 'Old Gallows', 'Pale Sigil', 'Rust Collar', 'Scorched Mile',
  'Shattered Oar', 'Silent Bell', 'Split Antler', 'Thirteen Knives', 'Widow Road',
];

const RAIDER_SHARED_VERBS = [
  'counts scars', 'hunts gold', 'keeps trophies', 'breaks gates', 'marks maps',
  'follows smoke', 'never kneels', 'waits at dusk', 'reads tracks', 'calls storms',
  'burns the ledger', 'buys no mercy', 'collects debts', 'eats the weak',
  'fears no banner', 'forgets no slight', 'grinds the road', 'knows your route',
  'leaves no witness', 'names the price', 'outlives kings', 'owes nobody',
  'sells the dead', 'sleeps in armor', 'takes the first cut', 'trades in fear',
  'walks through fire', 'weighs every coin',
];

const RAIDER_NAME_POOLS = {
  bandit: {
    first: ['Rook', 'Kylo', 'Paul Kuntz', 'Smudge', 'Robin', 'Klubberlang', 'Matty P', 'Vox Mania', 'Trump', 'Glen',
      'Nibs', 'Tuppence Hale', 'Crooked Ivo', 'Wiley Fen', 'Half Coin Marl', 'Scratch', 'Dodge Pallo', 'Mud Larky',
      'Two Thumb Tam', 'Quill', 'Sly Bennet', 'Rat King Dunn', 'Cutty', 'Fingers Malloy', 'Whistling Odd'],
    nouns: ['Knife Hand', 'Crow Hood', 'Road Jackal', 'Coin Finger', 'Dust Fox',
      'Cut Purse', 'Ditch Weasel', 'Hedge Thief', 'Lamp Snuffer', 'Pocket Ghost',
      'Quick Latch', 'Shrub Wolf', 'Slip Knot', 'Toll Dodger', 'Wagon Rat'],
    verbs: ['cuts purses', 'bites wrists', 'shakes wagons', 'picks locks', 'robs softly',
      'counts your change', 'hides in hedges', 'knows every ditch', 'lifts the latch',
      'runs before the guard', 'sells your boots', 'smiles while stealing',
      'trips the lantern', 'vanishes at noon', 'whistles once'],
  },
  marauder: {
    first: ['Grond', 'Oscar', 'Talla', 'Hask', 'Rul', 'Korga', 'Brine', 'Drekk',
      'Vargo', 'Mulg', 'Sarna', 'Boruk', 'Hettra', 'Zhek', 'Ormund', 'Krell',
      'Bragga', 'Tusk Jenna', 'Halvor', 'Ogrim'],
    nouns: ['War Cry', 'Gate Breaker', 'The Gruchy', 'Red Fang', 'Siege Horn',
      'Axe Tide', 'Bone Hammer', 'Charge Line', 'Ram Head', 'Ruin Fist',
      'Shield Splitter', 'Smoke Column', 'Wall Eater', 'War Drum', 'Wrath Banner'],
    verbs: ['breaks shields', 'burns wagons', 'splits helmets', 'laughs at arrows',
      'charges first', 'drinks after ruin', 'drives the ram', 'fells the gate',
      'heaves the log', 'ignores the parley', 'kicks down doors', 'roars at walls',
      'salts the fields', 'shrugs off spears', 'tramples the line'],
  },
  raider: {
    first: ['Renn', 'Vale', 'Ossa', 'Brigg', 'Kest', 'Mora', 'Jarr', 'Syre',
      'Ilda', 'Fenn', 'Dagna', 'Torve', 'Sella', 'Hoyt', 'Ravna', 'Cael',
      'Brakk', 'Nessa', 'Oryn', 'Tam Vesk'],
    nouns: ['Torch Hand', 'Road Wolf', 'Night Pike', 'Toll Hound', 'Ruin Flag',
      'Ash Rider', 'Barn Burner', 'Cart Hunter', 'Dust Rider', 'Ford Wolf',
      'Grain Reaver', 'Hill Raider', 'Lantern Cutter', 'Tribute Lash', 'Wheel Breaker'],
    verbs: ['hunts caravans', 'tracks smoke', 'takes tribute', 'circles farms',
      'burns the granary', 'cuts the traces', 'empties the barn', 'fires the thatch',
      'follows the ruts', 'names the tithe', 'rides the ridge', 'scatters the herd',
      'strikes at harvest', 'takes the lead ox', 'watches the ford'],
  },
  boss: {
    first: ['Maeve', 'Varo', 'Morrow', 'Sable Jack', 'Thane', 'Corvin', 'Rhea', 'Hal',
      'Lady Ashcroft', 'Baron Vex', 'Old Mother Quill', 'Dread Cass', 'Warden Holt',
      'Sirrah Blackvane', 'The Magistrate', 'Grand Toll Ubek', 'Countess Dree', 'Ser Malidan',
      'Ledger Lord Pym', 'Widow Marrow'],
    nouns: ['Iron Crown', 'Toll King', 'War Ledger', 'Banner Lord', 'Bridge Tyrant',
      'Crown Debt', 'Gallows Warden', 'Hundred Knives', 'Road Sovereign', 'Scale Tyrant',
      'Seal of Ash', 'Tithe Throne', 'Vault Regent', 'Warlord Standard', 'Writ of Ruin'],
    verbs: ['keeps tribute', 'owns roads', 'breaks captains', 'counts the fallen',
      'appoints the hangman', 'buys whole towns', 'chooses who eats', 'dictates the toll',
      'holds the passes', 'never negotiates twice', 'pardons no debt', 'sets the price of passage',
      'signs in blood', 'taxes the dead', 'writes the law'],
  },
  scout: {
    first: ['Lark', 'Whisp', 'Tern', 'Flick', 'Mire', 'Needle', 'Kite', 'Swift',
      'Pip', 'Vane', 'Skein', 'Wren', 'Dart', 'Hush Eda', 'Cinderlight', 'Rill',
      'Thistle', 'Sparrow Jo', 'Glim', 'Quiver'],
    nouns: ['Far Eye', 'Fox Step', 'Wind Mark', 'Quick Shadow', 'Thin Blade',
      'Crow Watch', 'Dawn Runner', 'Ghost Trail', 'Hare Foot', 'Long Sight',
      'Mist Walker', 'Path Finder', 'Ridge Eye', 'Silent Boot', 'Tree Line'],
    verbs: ['sees first', 'runs rooftops', 'reads tracks', 'never rests',
      'counts the guards', 'crosses no bridge twice', 'drops from branches',
      'leaves false trails', 'maps the gaps', 'marks the treeline', 'moves at dawn',
      'names the weak gate', 'outruns horses', 'sleeps in the open', 'whistles the warning'],
  },
  pirate: {
    first: ['Barnacle Ben', 'Penny Snatching Dave Gentry', 'Calab', 'Riptide Rick', 'Ms Black Etta', 'Hook Bram', 'One Eyed Brontes',
      'Salty Mag', 'Captain Dredge', 'Wet Powder Pell', 'Lucky Corso', 'Tooth Rot Tavi', 'Anchor Anne',
      'Gutter Sloop Kade', 'Bilge Rat Rory', 'Shark Bait Silas', 'Grog Mother Ines', 'Cannon Shy Cobb',
      'Three Sheet Tolliver', 'Old Kraken Quay'],
    nouns: ['Black Wake', 'Salt Fang', 'Harbor Ghost', 'Rope King', 'Storm Hook',
      'Bilge Crown', 'Broken Keel', 'Chain Shot', 'Dead Reckoner', 'Flotsam Lord',
      'Gale Runner', 'Pale Sail', 'Plunder Tide', 'Shark Flag', 'Wreck Diver'],
    verbs: ['counts wrecks', 'chases storms', 'steals pennies !', 'hunts horizons',
      'boards at midnight', 'burns the manifest', 'cuts the anchor line', 'drinks the cargo',
      'follows the gulls', 'keeps no charts', 'loves a low harbor', 'never pays dock fees',
      'sinks what he cannot carry', 'sings off key', 'swims with the debt'],
  },
  dragon: {
    first: ['Azrith', 'Balthromaw', 'Cindervale', 'Shenron', 'Pyreclaw', 'Kiah', 'Albion', 'Thalara', 'Vulkrin',
      'Ignareth', 'Sablewyrm', 'Auronax', 'Vermithrax', 'Skarnak', 'Emberlyth', 'Drakoth', 'Gloamscale',
      'Tyrenvar', 'Molthar', 'Quessaryn'],
    nouns: ['Ash Throne', 'Sky Furnace', 'Gold Hunger', 'Cinder Crown', 'Ember Maw',
      'Burning Sky', 'Hoard Keeper', 'Molten Wing', 'Scorched Peak', 'Sky Tyrant',
      'Smoke Sovereign', 'Star Scorcher', 'Sun Eater', 'Thunder Scale', 'Vault of Flame'],
    verbs: ['hoards crowns', 'melts towers', 'drinks thunder', 'wakes volcanoes',
      'blots out the sun', 'counts coins by weight', 'eclipses the valley', 'names your thief',
      'remembers every theft', 'roosts on ruins', 'shrugs off ballistae', 'sleeps for centuries',
      'smells gold for miles', 'swallows knights whole', 'turns sand to glass'],
  },
  blackKnight: {
    first: ['Sir Veyn', 'Dame Mordra', 'Ghal', 'Tyrone', 'Cleese', 'Thorn Vale', 'Malkor', 'Ysra',
      'Sir Calder', 'Dame Ruth Grave', 'Lord Ashen', 'Ser Vund', 'Knight Hollow', 'Dame Pellara',
      'Sir Nocturne', 'Oath Breaker Rhun', 'Sir Grimwald', 'Dame Vespera', 'Black Ser Tolm', 'Knight of Cinders'],
    nouns: ['Grave Helm', 'Iron Oath', 'Night Lance', 'Ruin Banner', 'Black Vow',
      'Cold Gauntlet', 'Dusk Pennant', 'Faithless Blade', 'Funeral Guard', 'Grim Chevron',
      'Last Vigil', 'Mourning Plate', 'Silent Visor', 'Sable Spur', 'Widow Standard'],
    verbs: ['keeps vigil', 'breaks oaths', 'marches at dusk', 'never forgives',
      'answers no horn', 'bows to no crown', 'buries his own', 'guards a dead lord',
      'never lifts the visor', 'rides without banner', 'speaks once per battle',
      'still holds the pass', 'takes no ransom', 'waits at the chapel', 'wears his shame'],
  },
  wraith: {
    first: ['Nhal', 'Velis', 'Mourn', 'Syth', 'Iria', 'Vaunt', 'Leth', 'Nyxen',
      'Ossuary', 'Threnody', 'Vellum', 'Hollowe', 'Sorrin', 'Ashkin', 'Quell', 'Requiem',
      'Grievous Wynn', 'Palethorn', 'Umbra', 'Lachrym'],
    nouns: ['Pale Whisper', 'Hollow Choir', 'Moon Echo', 'Grief Lantern', 'Mist Hand',
      'Cold Vigil', 'Dirge Bearer', 'Empty Shroud', 'Fading Name', 'Grave Breath',
      'Last Lament', 'Shade Crown', 'Silent Wake', 'Sorrow Veil', 'Thin Veil'],
    verbs: ['drinks light', 'waits in fog', 'calls the lost', 'crosses walls',
      'chills the lantern', 'counts the unburied', 'forgets its own name', 'hums at midnight',
      'knows your grief', 'leaves no footprints', 'mourns forever', 'remembers the drowned',
      'stills the wind', 'unmakes courage', 'weeps salt'],
  },
  seaMonster: {
    first: ['Brinejaw', 'Kelpthorn', 'Abyssa', 'Mirefin', 'Razorwake', 'Undertow', 'Trenchmaw', 'Crestcoil',
      'Fathomgut', 'Saltcrush', 'Drownbell', 'Barnaclemaw', 'Squallfin', 'Gulperax', 'Nettlecoil',
      'Blackreef', 'Tidebreaker', 'Chumhowl', 'Leviath', 'Gribbleback'],
    nouns: ['Tide Maw', 'Deep Coil', 'Storm Eye', 'Sunken Crown', 'Hull Breaker',
      'Anchor Eater', 'Black Fathom', 'Drowned Bell', 'Kelp Throne', 'Mast Snapper',
      'Reef Terror', 'Salt Gullet', 'Ship Swallower', 'Trench Lord', 'Whirl Maw'],
    verbs: ['The man eater', 'the barnacle lover', 'biki bottomer', 'stirs trenches',
      'bends the keel', 'coils round masts', 'drags crews under', 'eats the anchor',
      'follows blood in water', 'hates lighthouses', 'makes the sea boil', 'rises at low tide',
      'sings under the hull', 'swallows longboats', 'wrecks the harbor chain'],
  },
  sandWorm: {
    first: ['Dustmaw', 'Khepra', 'Siroc', 'Dunebore', 'Rattle Maw', 'Scarp',
      'Gritgullet', 'Sandreave', 'Thirstcoil', 'Boneglass', 'Hollowdune', 'Sunscour',
      'Grindmaw', 'Ochrecoil', 'Mirage Eater', 'Wadi Wrath'],
    nouns: ['Dune Hunger', 'Glass Maw', 'Buried Crown', 'Salt Coil', 'Dust Throne',
      'Blind Burrower', 'Caravan Grave', 'Deep Grit', 'Sand Sovereign', 'Silent Quake',
      'Sun Bleached Coil', 'Thirst Maw', 'Under Road', 'Well Breaker', 'Wind Scar'],
    verbs: ['erupts beneath caravans', 'swallows tracks', 'shakes the dunes', 'waits below campfires',
      'drinks the oasis dry', 'feels every footstep', 'hates the drum', 'hunts by vibration',
      'leaves glass behind', 'never surfaces twice', 'rolls the dunes over', 'sleeps under wells',
      'splits the trade road', 'takes the whole wagon', 'turns camps to craters'],
  },
  iceGolem: {
    first: ['Rimeguard', 'Thalos', 'Brumal', 'Frostwake', 'Old Icestone', 'Shardhelm',
      'Hoarfast', 'Glacius', 'Sleetmarrow', 'Coldvault', 'Frostmoot', 'Bittercairn',
      'Winterhold', 'Icebound Orn', 'Snowmarch', 'Palefrost'],
    nouns: ['White Bastion', 'Glacier Fist', 'Winter Wall', 'Silent Cairn', 'Blue Core',
      'Black Ice', 'Cold Keep', 'Crevasse Guard', 'Frost Anvil', 'Frozen Oath',
      'Hail Bulwark', 'Rime Sentinel', 'Snowfall Lord', 'Sleet Hammer', 'Thaw Denier'],
    verbs: ['cracks shields', 'walks in blizzards', 'freezes steel', 'never thaws',
      'breathes no air', 'buries the pass', 'counts the seasons', 'feels no fire',
      'grinds boulders flat', 'guards the white road', 'hardens in the cold',
      'ignores the spring', 'shatters and reforms', 'stills running water', 'weighs a mountain'],
  },
  voidHound: {
    first: ['Nyxfang', 'Null', 'Vesper Maw', 'Shadepaw', 'Hush', 'Graven',
      'Duskmuzzle', 'Eclipse', 'Starvebite', 'Hollowhowl', 'Gloamfang', 'Nought',
      'Blackwhisker', 'Ebonpaw', 'Umbraclaw', 'Quietfang'],
    nouns: ['Night Bite', 'Starless Fang', 'Shadow Lung', 'Black Echo', 'Void Step',
      'Dark Between', 'Empty Howl', 'Hunger of Dusk', 'Lightless Jaw', 'Moonless Hunt',
      'Silence Pack', 'Sky Gap', 'Soundless Paw', 'Torn Veil', 'Unlit Trail'],
    verbs: ['hunts starlight', 'blinks through fog', 'sniffs fear', 'circles lanterns',
      'casts no shadow', 'eats the campfire', 'finds you by dreaming', 'howls without sound',
      'hunts between heartbeats', 'leaves cold prints', 'outpaces the moon',
      'runs on nothing', 'smells the dying lamp', 'steps out of walls', 'unmakes the light'],
  },
  thornBeast: {
    first: ['Briarhide', 'Rootlash', 'Spine Buck', 'Needleback', 'Thorn Maw', 'Gorse',
      'Bramblehoof', 'Nettlecrown', 'Sapgore', 'Burrhide', 'Hawthorne', 'Snarlroot',
      'Barbtine', 'Wildhedge', 'Pricklebough', 'Tanglehorn'],
    nouns: ['Bramble Crown', 'Rose Fang', 'Vine Hide', 'Green Ruin', 'Hooked Antler',
      'Bark Plate', 'Briar Warden', 'Grasping Root', 'Hedge Tyrant', 'Nettle King',
      'Sap Blood', 'Snag Horn', 'Thicket Lord', 'Thorn Mantle', 'Wild Growth'],
    verbs: ['charges hedgerows', 'breaks spears', 'drags hunters', 'bleeds sap',
      'chokes the trade path', 'grows back overnight', 'guards the old grove',
      'hates axes', 'hooks the horses', 'knits its own wounds', 'roots where it stands',
      'snares the whole column', 'spreads with the season', 'takes the hedge with it', 'tears cloth to ribbons'],
  },
  magmaSerpent: {
    first: ['Cindercoil', 'Basalt Tongue', 'Pyra', 'Lavabite', 'Ashscale', 'Riftcoil',
      'Slagfang', 'Emberwind', 'Obsidia', 'Kilnmaw', 'Scoriath', 'Brimstone Vell',
      'Magmara', 'Char Coil', 'Fumarole', 'Tephra'],
    nouns: ['Melt Spine', 'Fire Vein', 'Crater Coil', 'Smolder Fang', 'Furnace Eye',
      'Ash Cloud', 'Basalt Crown', 'Cinder Tide', 'Glowing Rift', 'Lava Throne',
      'Molten Thread', 'Obsidian Scale', 'Slag Lord', 'Sulfur Breath', 'Vent Keeper'],
    verbs: ['splits bedrock', 'spits embers', 'sleeps in lava', 'glows at dusk',
      'boils the spring', 'burns its own trail', 'cools into stone', 'cracks the caldera',
      'follows the heat', 'lights the night sky', 'melts the ore cart', 'nests in vents',
      'sheds glass scales', 'turns rain to steam', 'wakes with the quake'],
  },
  grazer: {
    first: ['Mossback', 'Dapplehorn', 'Softhoof', 'Lichenhide', 'Willowtail', 'Meadowback',
      'Cloverkin', 'Bramblechew', 'Fernstep', 'Dewnose', 'Hayflank', 'Thistledown',
      'Barleyback', 'Quietmuzzle', 'Sedgehoof', 'Bellow'],
    nouns: ['Quiet Grazer', 'Fern Antler', 'Soft Step', 'Hill Eater', 'Moss Crown',
      'Clover Warden', 'Dawn Browser', 'Gentle Flank', 'Grass Keeper', 'Meadow Heart',
      'Pasture Elder', 'Slow Horn', 'Still Water', 'Valley Roamer', 'Warm Hide'],
    verbs: ['chews clover', 'wanders slowly', 'sniffs the wind', 'grazes at dawn',
      'bothers no one', 'dozes in sunlight', 'drinks from the ford', 'follows the green',
      'ignores the road', 'keeps to the valley', 'lows at nothing', 'naps by the fence',
      'shelters from the rain', 'trusts too easily', 'wades the shallows'],
  },
  pennyCollector: {
    first: ['Copperpaw', 'Tallysnout', 'Minter', 'Ledgerclaw', 'Pennybite', 'Brassnose',
      'Abacus', 'Coinwhisker', 'Tithepaw', 'Receipt', 'Farthing', 'Shillingtooth',
      'Auditclaw', 'Stampjaw', 'Interest', 'Small Print'],
    nouns: ['Tribute Clerk', 'Coin Snatcher', 'Tax Paw', 'Copper Hood', 'Toll Cub',
      'Arrears Agent', 'Balance Sheet', 'Fine Print', 'Levy Warden', 'Overdue Notice',
      'Petty Cash', 'Receipt Keeper', 'Rounding Error', 'Surcharge', 'Wage Docker'],
    verbs: ['counts every penny', 'tags cargo holds', 'shakes down captains', 'marks unpaid routes',
      'adds a service fee', 'audits the manifest', 'charges for the paperwork',
      'compounds the interest', 'files it in triplicate', 'finds a discrepancy',
      'never rounds down', 'reminds you politely', 'stamps everything twice',
      'takes it out of wages', 'weighs your purse by eye'],
  },
  clawMarine: {
    first: ['Grask', 'Ursik', 'Vorn', 'Maulek', 'Brund', 'Karrax',
      'Threx', 'Gormak', 'Vessik', 'Durn', 'Halbrek', 'Skorra',
      'Vantek', 'Murgo', 'Rekka', 'Thulvek'],
    nouns: ['Claw Marine', 'Boarding Paw', 'Hull Ripper', 'Deck Breaker', 'Flagship Guard',
      'Airlock Fang', 'Boarding Spike', 'Breach Corps', 'Cutter Squad', 'Grav Boot',
      'Hard Vacuum', 'Pressure Seal', 'Salvage Fist', 'Tether Line', 'Vacuum Wolf'],
    verbs: ['breaches airlocks', 'guards tribute vaults', 'storms command decks', 'hunts resistance cells',
      'cuts the power first', 'fights in the dark', 'flushes the corridors', 'holds the boarding tube',
      'never drops the seal', 'sweeps deck by deck', 'takes the bridge in minutes',
      'trains in zero g', 'welds the doors shut'],
  },
  siegeBear: {
    first: ['Ironhide', 'Maulhold', 'Bastion', 'Gravemaw', 'Tonnar', 'Bulwark',
      'Rampart', 'Anvilback', 'Grustav', 'Blockade', 'Hulkbrow', 'Dreadnought',
      'Stonegut', 'Barricade', 'Ballast', 'Keeploft'],
    nouns: ['Siege Bear', 'Armor Crown', 'Wall Breaker', 'Heavy Paw', 'Dread Guard',
      'Battering Hide', 'Bulk Plate', 'Gate Toppler', 'Immovable Line', 'Rampart Fist',
      'Shield Mountain', 'Slow Advance', 'Tower Shoulder', 'Trench Filler', 'Weight of Iron'],
    verbs: ['breaks station gates', 'carries shield plates', 'crushes convoy hulls', 'holds the line',
      'absorbs the barrage', 'advances through fire', 'anchors the formation', 'does not retreat',
      'shrugs off artillery', 'stands where it falls', 'walks through barricades', 'wears the gate down'],
  },
  raymond: {
    first: ['Raymond'],
    nouns: ['Bear Emperor', 'Penny Warlord', 'Capital Tyrant', 'Tribute King',
      'Sovereign of Coin', 'The Final Ledger', 'Throne of Claws', 'Warden of All Debts',
      'Crown of Iron Fur', 'Last Collector'],
    verbs: ['claims every world', 'hoards every penny', 'rules the capital shield', 'breaks galaxies',
      'audits the stars', 'forgives nothing', 'holds the last vault', 'names every debtor',
      'owns the road between worlds', 'remembers every coin'],
  },
};

function _isMonsterRaiderType(type) {
  return MONSTER_RAIDER_TYPES.has(type);
}

function _isNeutralRaiderType(type) {
  return NEUTRAL_RAIDER_TYPES.has(type);
}

function _getRaiderLootGold(raider) {
  const _days = (typeof dayNight !== 'undefined') ? dayNight.getDaysElapsed() : 0;
  const _dayLootBonus = Math.floor(_days / 10) * 4;
  if (raider?.isMonster) {
    return raider.strength * (18 + Math.floor(_bqRaiderEntityRand() * 30)) + _dayLootBonus * 2;
  }
  if (raider?.isNeutral) {
    return Math.max(1, Math.floor(raider.strength * (3 + Math.floor(_bqRaiderEntityRand() * 4)) + Math.floor(_dayLootBonus * 0.25)));
  }
  return raider.strength * (12 + Math.floor(_bqRaiderEntityRand() * 22)) + _dayLootBonus;
}

function _getRaiderNameArchetype(type, isPirate) {
  if (isPirate) return 'pirate';
  return RAIDER_NAME_POOLS[type] ? type : 'bandit';
}

function _pickRaiderNamePart(parts) {
  if (!Array.isArray(parts) || parts.length === 0) return '';
  return parts[Math.floor(_bqRaiderEntityRand() * parts.length)];
}

function _generateRaiderName(type, isPirate, explicitName) {
  if (typeof explicitName === 'string' && explicitName.trim()) return explicitName.trim();

  const archetype = _getRaiderNameArchetype(type, isPirate);
  const pool = RAIDER_NAME_POOLS[archetype] || RAIDER_NAME_POOLS.bandit;
  const first = _pickRaiderNamePart(pool.first);
  const noun = _pickRaiderNamePart([...(pool.nouns || []), ...RAIDER_SHARED_NOUNS]);
  const verb = _pickRaiderNamePart([...(pool.verbs || []), ...RAIDER_SHARED_VERBS]);
  const patternRoll = _bqRaiderEntityRand();

  if (patternRoll < 0.34 && first && noun && verb) return `${first} the ${noun} who ${verb}`;
  if (patternRoll < 0.67 && first && noun) return `${first} the ${noun}`;
  if (first && verb) return `${first} who ${verb}`;
  return first || noun || verb || 'Nameless Raider';
}

function _getRaiderTypeLabel(type, isPirate) {
  const key = isPirate ? 'pirate' : type;
  return RAIDER_TYPE_LABELS[key] || 'Raider';
}

class Raider {
  constructor({ x, y, strength, patrolPoints, type, isPirate, boat, id, name, onDefeated }) {
    if (Number.isFinite(Number(id))) {
      this.id = Number(id);
      _bqNextRaiderId = Math.max(_bqNextRaiderId, this.id + 1);
    } else {
      this.id = _bqNextRaiderId++;
    }
    this.x = x;
    this.y = y;
    // Base strength + day scaling: +1 per 20 days, capped at +5
    const dayBonus = (typeof dayNight !== 'undefined') ? Math.min(5, Math.floor(dayNight.getDaysElapsed() / 20)) : 0;
    this.strength = (strength || 2 + Math.floor(_bqRaiderEntityRand() * 3)) + dayBonus; // 2-4 + dayBonus
    // Combat speed varies by type — set after type is determined
    this.speed = 1 + Math.floor(_bqRaiderEntityRand() * 2); // 1-2 base, adjusted below
    this.detectionRadius = 4 + Math.floor(_bqRaiderEntityRand() * 2); // 4-5 tiles
    this.state = 'patrolling'; // 'patrolling', 'chasing', 'defeated'
    this.bribedCooldown = 0;  // Days until raider can attack again after being bribed

    // Type — most are normal raiders, rare monsters
    this.type = type || 'bandit';
    this.isMonster = _isMonsterRaiderType(this.type);
    this.isNeutral = _isNeutralRaiderType(this.type);

    // Pirate — water-only raiders with boats
    this.isPirate = isPirate || false;
    this.boat = boat || null; // boat type string: 'rowboat', 'sloop', 'galleon'
    if (this.isPirate && !this.boat) {
      this.boat = (typeof getPirateBoatType === 'function')
        ? getPirateBoatType(this.strength) : 'rowboat';
    }
    if (this.isPirate) {
      this.detectionRadius += 1; // pirates have slightly better sea vision
    }

    // Monsters are stronger and have wider detection
    if (this.isMonster) {
      this.strength = Math.max(this.strength, 5 + Math.floor(_bqRaiderEntityRand() * 4)); // 5-8
      this.detectionRadius += 2;
    } else if (this.isNeutral) {
      this.strength = Math.max(1, Math.min(this.strength, 2));
      this.detectionRadius = 1;
    }

    this.name = _generateRaiderName(this.type, this.isPirate, name);
    this.onDefeated = typeof onDefeated === 'function' ? onDefeated : null;

    this.patrolPoints = patrolPoints || [];
    this.currentPatrolIndex = 0;
    this._activePatrolGoal = null;
    this.path = [];
    this.pathFailCooldown = 0; // frames to skip before retrying a failed A* call
    this.direction = 'down';
    this.animFrame = 0;
    this.animTimer = 0;

    this.loot = {
      gold: _getRaiderLootGold(this),
      items: [],
    };

    // Generate random loot
    const itemKeys = Object.keys(ItemLibrary);
    const numLoot = this.isNeutral ? 0 : Math.floor(_bqRaiderEntityRand() * 3);
    for (let i = 0; i < numLoot; i++) {
      const key = itemKeys[Math.floor(_bqRaiderEntityRand() * itemKeys.length)];
      this.loot.items.push({ name: key, quantity: 1 + Math.floor(_bqRaiderEntityRand() * 3) });
    }

    if (this.isNeutral) {
      const forageLoot = ['Fur', 'Herbs', 'Fish', 'Wheat'].filter((key) => (
        typeof ItemLibrary !== 'undefined' && !!ItemLibrary[key]
      ));
      if (forageLoot.length > 0) {
        const key = forageLoot[Math.floor(_bqRaiderEntityRand() * forageLoot.length)];
        this.loot.items.push({ name: key, quantity: 1 + Math.floor(_bqRaiderEntityRand() * 2) });
      }
    }

    // Tiered bag drops (independent roll)
    if (!this.isNeutral) {
      const bagRoll = _bqRaiderEntityRand();
      let bagDrop = null;
      if      (bagRoll < 0.002) bagDrop = 'Chest';
      else if (bagRoll < 0.012) bagDrop = 'BargainSack';
      else if (bagRoll < 0.040) bagDrop = 'TravelerBag';
      else if (bagRoll < 0.120) bagDrop = 'Pouch';
      if (bagDrop) this.loot.items.push({ name: bagDrop, quantity: 1 });
    }

    // Movement timing
    this.moveTimer = 0;
    this.moveInterval = this.isNeutral ? 380 : 300; // slower than player
    this.chaseInterval = this.isNeutral ? 380 : 180; // faster when chasing
    this.stunTimer = 0;      // real-time ms freeze (flee/bribe)
  }

  getTypeLabel() {
    return _getRaiderTypeLabel(this.type, this.isPirate);
  }

  getDisplayName(includeType = false) {
    if (!includeType) return this.name || this.getTypeLabel();
    return this.name ? `${this.name} (${this.getTypeLabel()})` : this.getTypeLabel();
  }

  update(dt, playerX, playerY) {
    if (this.state === 'defeated') { this._cancelPathRequest(); return; }
    dt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    if (this._pathRequest && !this._isPathRequestCurrent(this._pathRequest)) this._cancelPathRequest();

    // Stun countdown — raider does nothing while stunned
    if (this.stunTimer > 0) {
      const stunnedTime = Math.min(this.stunTimer, dt);
      this.stunTimer -= stunnedTime;
      dt -= stunnedTime;
      if (dt === 0) return;
    }

    if (this.isNeutral) {
      this.doPatrol(dt);
      return;
    }

    const distToPlayer = Math.abs(this.x - playerX) + Math.abs(this.y - playerY);

    // Don't detect player if they're in a city
    const playerInCity = (typeof player !== 'undefined' && player.currentCity != null) || _bqRaiderIsCityTile(playerX, playerY);

    // Detection - skip if bribed recently
    if (!playerInCity && this.bribedCooldown === 0 && distToPlayer <= this.detectionRadius && this.state !== 'chasing') {
      this._cancelPathRequest();
      this._activePatrolGoal = null;
      this.state = 'chasing';
      this.path = [];
      // One-time warning
      if (typeof notificationManager !== 'undefined') {
        const label = this.isPirate
          ? `\u2620\ufe0f ${this.getDisplayName(true)} spotted on the water!`
          : this.isMonster
          ? `\uD83D\uDC09 ${this.getDisplayName(true)} spotted nearby!`
          : `\u2694 ${this.getDisplayName(true)} spotted nearby!`;
        notificationManager.log(label, "warning");
      }
    }

    // Stop chasing if on cooldown (bribed / just defeated player)
    if (this.bribedCooldown > 0 && this.state === 'chasing') {
      this._cancelPathRequest();
      this.state = 'patrolling';
      this.path = [];
    }

    // If player entered a city, stop chasing
    if (playerInCity && this.state === 'chasing') {
      this._cancelPathRequest();
      this.state = 'patrolling';
      this.path = [];
    }

    if (this.state === 'chasing') {
      this.doChase(dt, playerX, playerY);
    } else {
      this.doPatrol(dt);
    }

    // If player moved far away, go back to patrolling
    if (this.state === 'chasing' && distToPlayer > this.detectionRadius * 2) {
      this._cancelPathRequest();
      this.state = 'patrolling';
      this.path = [];
    }
  }

  doPatrol(dt) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    this.moveTimer += Number.isFinite(dt) ? Math.max(0, dt) : 0;
    if (this._pathRequest) return;
    const interval = Math.max(1, this.moveInterval);
    for (let steps = 0; steps < 8 && this.moveTimer >= interval; steps++) {
      if (this._patrolStep() === false) break;
      this.moveTimer -= interval;
      // Do not consume a long frame's whole route through an encounter. The
      // next update performs detection and retains the remaining movement time.
      if (!this.isNeutral && this.bribedCooldown === 0 && typeof player !== 'undefined'
        && player.currentCity == null && !_bqRaiderIsCityTile(player.x, player.y)
        && Math.abs(this.x - player.x) + Math.abs(this.y - player.y) <= this.detectionRadius) break;
    }
  }

  _patrolStep() {
    if (this.pathFailCooldown > 0) {
      this.pathFailCooldown--;
    } else if (this.path.length === 0 && this.patrolPoints.length > 0) {
      const target = this._activePatrolGoal || this.patrolPoints[this.currentPatrolIndex];
      this._requestRoute(target, 'patrol');
      if (this._pathRequest) return false;
    }

    if (this.path.length > 0) {
      this.moveToNext();
    } else {
      // No path available — random walk so raiders always visibly wander
      this._takeRandomStep();
    }
  }

  _cancelPathRequest() {
    const request = this._pathRequest;
    this._pathRequest = null;
    if (request?.handle && typeof request.handle.cancel === 'function') request.handle.cancel();
  }

  _isPathRequestCurrent(request) {
    if (request.handle?.status === 'cancelled' || request.handle?.cancelled
      || this.state !== request.state || this.x !== request.start.x || this.y !== request.start.y) return false;
    if (request.kind === 'patrol') {
      const target = this._activePatrolGoal || this.patrolPoints[this.currentPatrolIndex];
      return this.currentPatrolIndex === request.patrolIndex && target?.x === request.goal.x && target?.y === request.goal.y;
    }
    // A moving player does not invalidate an in-flight search. Follow the
    // completed route for a step before requesting a more recent destination.
    return this.state === 'chasing';
  }

  _requestRoute(target, kind) {
    if (this._pathRequest) return;
    const request = { start: { x: this.x, y: this.y }, goal: { ...target }, kind,
      state: this.state, patrolIndex: this.currentPatrolIndex,
      resumingPatrol: kind === 'patrol' && !!this._activePatrolGoal, handle: null };
    const accept = pathResult => {
      this.path = pathResult || [];
      if (kind === 'patrol') {
        if (this.path.length === 0) this.pathFailCooldown = 20;
        this._activePatrolGoal = this.path.length > 0 ? { ...request.goal } : null;
        if (!request.resumingPatrol) this.currentPatrolIndex = (request.patrolIndex + 1) % this.patrolPoints.length;
      } else {
        this._chaseGoal = request.goal;
        this._chaseStepsSincePath = 0;
        if (this.path.length === 0) this._chaseRepathCooldown = 8;
      }
    };
    if (typeof requestWorldPath === 'function') {
      this._pathRequest = request;
      request.handle = requestWorldPath({ start: request.start, goal: request.goal,
        allowWater: !!this.isPirate, waterOnly: !!this.isPirate, priority: 'background' }, pathResult => {
        if (this._pathRequest !== request) return;
        const current = this._isPathRequestCurrent(request);
        this._pathRequest = null;
        if (current) accept(pathResult);
      });
    } else {
      accept(aStar(grid, request.start, request.goal, !!this.isPirate, null, !!this.isPirate));
    }
  }

  /**
   * Take one random step to an adjacent walkable tile.
   * Used as a fallback when A* has no path (fail cooldown, unreachable points,
   * or no patrol points assigned).  Always produces visible movement.
   * Pirates stay on water; land raiders avoid water.
   */
  _takeRandomStep() {
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    // Fisher-Yates shuffle
    for (let i = 3; i > 0; i--) {
      const j = Math.floor(_bqRaiderEntityRand() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }

    // Optional bias: slightly prefer walking toward next patrol point
    if (this.patrolPoints.length > 0) {
      const pt = this.patrolPoints[this.currentPatrolIndex];
      const bx = Math.sign(pt.x - this.x);
      const by = Math.sign(pt.y - this.y);
      if (bx !== 0) dirs.unshift([bx, 0]);
      if (by !== 0) dirs.unshift([0, by]);
    }

    for (const [dx, dy] of dirs) {
      const nx = this.x + dx;
      const ny = this.y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const tileType = grid[ny]?.[nx]?.options[0];
      if (!tileType) continue;
      const walkable = this.isPirate ? tileType === 'Water' : tileType !== 'Water';
      if (!walkable) continue;

      this.direction = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      this.x = nx;
      this.y = ny;
      if (typeof raiderGrid !== 'undefined' && raiderGrid && typeof raiderGrid.move === 'function') {
        raiderGrid.move(this, this.x, this.y);
      }
      this.animTimer++;
      if (this.animTimer >= 6) { this.animFrame = (this.animFrame + 1) % 3; this.animTimer = 0; }
      break;
    }
  }

  doChase(dt, playerX, playerY) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    this.moveTimer += Number.isFinite(dt) ? Math.max(0, dt) : 0;
    if (this._pathRequest) return;
    const interval = Math.max(1, this.chaseInterval);
    for (let steps = 0; steps < 8 && this.moveTimer >= interval; steps++) {
      // Adjacent chasing raiders collide with the player; keep that encounter
      // visible instead of skipping across the player during a long frame.
      if (Math.abs(this.x - playerX) + Math.abs(this.y - playerY) <= 1) break;
      if (this._chaseStep(playerX, playerY) === false) break;
      this.moveTimer -= interval;
    }
  }

  _chaseStep(playerX, playerY) {
    if (this._chaseRepathCooldown > 0) {
      this._chaseRepathCooldown--;
    } else if (this.path.length === 0 || ((this._chaseStepsSincePath || 0) > 0
      && (this._chaseGoal?.x !== playerX || this._chaseGoal?.y !== playerY) && _bqRaiderEntityRand() < 0.3)) {
      this._requestRoute({ x: playerX, y: playerY }, 'chase');
      if (this._pathRequest) return false;
    }

    if (this.path.length > 0) {
      this.moveToNext();
      this._chaseStepsSincePath = (this._chaseStepsSincePath || 0) + 1;
    }
  }

  moveToNext() {
    const next = this.path[0];
    if (!next) return;

    const dx = next.x - this.x;
    const dy = next.y - this.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.direction = dx > 0 ? 'right' : 'left';
    } else {
      this.direction = dy > 0 ? 'down' : 'up';
    }

    this.x = next.x;
    this.y = next.y;
    this.path.shift();
    if (this.path.length === 0) this._activePatrolGoal = null;
    if (typeof raiderGrid !== 'undefined' && raiderGrid && typeof raiderGrid.move === 'function') {
      raiderGrid.move(this, this.x, this.y);
    }

    this.animTimer++;
    if (this.animTimer >= 6) {
      this.animFrame = (this.animFrame + 1) % 3;
      this.animTimer = 0;
    }
  }

  render(tileSize) {
    if (this.state === 'defeated') return;

    const px = this.x * tileSize;
    const py = this.y * tileSize;

    // Viewport culling — skip offscreen raiders
    if (typeof isOnScreen === 'function' && !isOnScreen(px, py)) return;

    // Draw detection radius indicator (subtle red glow when player is near)
    const playerDist = Math.abs(this.x - player.x) + Math.abs(this.y - player.y);
    if (!this.isNeutral && playerDist <= this.detectionRadius * 2) {
      push();
      noFill();
      stroke(200, 40, 40, 40);
      strokeWeight(1);
      ellipse(px + tileSize / 2, py + tileSize / 2, this.detectionRadius * tileSize * 2, this.detectionRadius * tileSize * 2);
      pop();
    }

    // Mark raiders that a city unit is currently locked onto.
    const trackedByUnit = !!(typeof cityManagement !== 'undefined'
      && cityManagement
      && typeof cityManagement.isRaiderTrackedByUnit === 'function'
      && cityManagement.isRaiderTrackedByUnit(this));
    if (trackedByUnit) {
      push();
      noFill();
      stroke(235, 70, 70, 230);
      strokeWeight(2);
      ellipse(px + tileSize / 2, py + tileSize / 2, tileSize * 0.9, tileSize * 0.9);
      pop();
    }

    // Raider sprite — use monster sprite, boat sprite for pirates, or normal raider
    let spriteSet = null;
    const customSpriteSet = (!this.isPirate && SpriteSheet.monsters?.[this.type]) ? SpriteSheet.monsters[this.type] : null;
    if (this.isPirate && this.boat && SpriteSheet.boats?.[this.boat]) {
      spriteSet = SpriteSheet.boats[this.boat];
    } else if (customSpriteSet) {
      spriteSet = customSpriteSet;
    } else {
      spriteSet = SpriteSheet.raider;
    }

    const useLargeSprite = this.isMonster || this.isPirate || this.isNeutral;
    if (spriteSet && spriteSet[this.direction]) {
      const frame = spriteSet[this.direction][this.animFrame] || spriteSet[this.direction][0];
      const drawSize = useLargeSprite ? tileSize * 1.3 : tileSize;
      const offset = useLargeSprite ? (drawSize - tileSize) / 2 : 0;
      image(frame, px - offset, py - offset, drawSize, drawSize);
    } else {
      // Fallback colored square
      push();
      fill(this.isPirate ? [40, 80, 160] : this.isMonster ? [120, 0, 180] : this.isNeutral ? [118, 168, 92] : [200, 60, 60]);
      noStroke();
      rect(px + 4, py + 4, tileSize - 8, tileSize - 8, 3);
      pop();
    }

    // Icon above: pirate flag, skull, or bribed cooldown
    if (this.bribedCooldown > 0) {
      push();
      fill(100, 200, 100);
      noStroke();
      textAlign(CENTER, BOTTOM);
      textSize(8);
      text(`${this.bribedCooldown}d`, px + tileSize / 2, py - 14);
      pop();
    } else if (this.isPirate) {
      push();
      noStroke();
      textAlign(CENTER, BOTTOM);
      textSize(12);
      text('\u2620\ufe0f', px + tileSize / 2, py - 6);
      pop();
    } else if (this.isNeutral) {
      push();
      noStroke();
      textAlign(CENTER, BOTTOM);
      textSize(11);
      text('\uD83C\uDF3F', px + tileSize / 2, py - 6);
      pop();
    } else if (SpriteSheet.icons?.skull) {
      image(SpriteSheet.icons.skull, px + tileSize / 2 - 8, py - 14, 16, 16);
    }

    // Strength indicator
    push();
    fill(this.isNeutral ? 180 : 255, this.isNeutral ? 220 : 80, this.isNeutral ? 160 : 80);
    noStroke();
    textAlign(CENTER, BOTTOM);
    textSize(8);
    text(`Str:${this.strength}`, px + tileSize / 2, py - 14);
    pop();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      x: this.x, y: this.y,
      strength: this.strength,
      detectionRadius: this.detectionRadius,
      patrolPoints: this.patrolPoints,
      currentPatrolIndex: this.currentPatrolIndex,
      activePatrolGoal: this.state === 'patrolling' && this._activePatrolGoal
        ? { x: this._activePatrolGoal.x, y: this._activePatrolGoal.y } : null,
      moveTimer: this.moveTimer,
      state: this.state,
      loot: this.loot,
      direction: this.direction,
      bribedCooldown: this.bribedCooldown,
      type: this.type,
      isPirate: this.isPirate,
      boat: this.boat,
    };
  }

  static fromJSON(data) {
    const r = new Raider({
      id: data?.id,
      name: data?.name,
      x: data.x, y: data.y,
      strength: data.strength,
      patrolPoints: data.patrolPoints,
      type: data.type || 'bandit',
      isPirate: data.isPirate || false,
      boat: data.boat || null,
    });
    if (Number.isFinite(Number(data.strength))) {
      r.strength = Number(data.strength);
    }
    r.detectionRadius = data.detectionRadius;
    r.currentPatrolIndex = data.currentPatrolIndex;
    // Older saves have only the next patrol index; keep their existing behavior.
    // New saves keep the current leg's destination without serializing its path.
    if (data.state === 'patrolling' && Number.isInteger(data.activePatrolGoal?.x)
      && Number.isInteger(data.activePatrolGoal?.y)) {
      r._activePatrolGoal = { x: data.activePatrolGoal.x, y: data.activePatrolGoal.y };
    }
    r.moveTimer = Number.isFinite(data.moveTimer) ? Math.max(0, data.moveTimer) : 0;
    r.state = data.state;
    r.loot = data.loot && typeof data.loot === 'object' ? data.loot : r.loot;
    // Refresh gold so saved raiders don't keep stale day-0 loot values
    r.loot.gold = _getRaiderLootGold(r);
    r.direction = data.direction;
    r.bribedCooldown = data.bribedCooldown || 0;
    return r;
  }
}
