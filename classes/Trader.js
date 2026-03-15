// Trader.js — NPC trader agents that travel and trade between cities

function _bqTraderEntityStream() {
  if (typeof window !== 'undefined' && window.BQSeededRNG && typeof window.BQSeededRNG.stream === 'function') {
    return window.BQSeededRNG.stream('trader:entity');
  }
  return null;
}
function _bqTraderEntityRand() {
  const s = _bqTraderEntityStream();
  return s ? s.random() : Math.random();
}

const TRADER_PERSONALITY_TRAITS = {
  brave: {
    label: 'Brave',
    margin: 1.1,           // takes risks on thin margins
    moveInterval: 120,     // fast mover
    maxBuyQty: 15,         // buys aggressively
    maxDistinctPurchases: 2,
    dealThreshold: 34,
    waitDaysBase: 1,       // short rest
    waitDaysRand: 2,       // 1-2 days
    bankruptThreshold: 2,  // harder to kill off
    startGoldBonus: 100,   // extra starting gold
    startCargoBonus: 0,
    luckyPriceBonus: 0,    // no luck bonus
    luckySaleChance: 0,
    boatChance: 0.42,
    rivalPenalty: 8,       // standard rival penalty
  },
  slow: {
    label: 'Slow',
    margin: 1.4,           // careful buyer
    moveInterval: 200,     // takes their time
    maxBuyQty: 5,          // buys small amounts
    maxDistinctPurchases: 1,
    dealThreshold: 48,
    waitDaysBase: 4,       // long rest
    waitDaysRand: 4,       // 4-7 days
    bankruptThreshold: 5,
    startGoldBonus: 0,
    startCargoBonus: 30,   // big pockets, slow pace
    luckyPriceBonus: 0.10, // 10% lucky sell bonus
    luckySaleChance: 0.35,
    boatChance: 0.22,
    rivalPenalty: 12,      // hates competition, avoids it hard
  },
  competitive: {
    label: 'Competitive',
    margin: 1.0,           // razor-thin margins, wins on volume
    moveInterval: 150,     // normal speed
    maxBuyQty: 12,         // buys smart
    maxDistinctPurchases: 2,
    dealThreshold: 42,
    waitDaysBase: 2,       // medium rest
    waitDaysRand: 3,       // 2-4 days
    bankruptThreshold: 5,
    startGoldBonus: 50,
    startCargoBonus: 10,
    luckyPriceBonus: 0,
    luckySaleChance: 0,
    boatChance: 0.30,
    rivalPenalty: 5,       // thrives in competition
  },
};

function _normalizeTraderPersonality(personality) {
  const map = {
    greedy: 'brave',
    cautious: 'slow',
    balanced: 'competitive',
  };
  const normalized = map[personality] || personality;
  return TRADER_PERSONALITY_TRAITS[normalized] ? normalized : 'brave';
}

function _getTraderPersonalityTraits(personality) {
  return TRADER_PERSONALITY_TRAITS[_normalizeTraderPersonality(personality)];
}

class Trader {
  constructor({ name, homeCityIndex, personality, gold, cargoCapacity }) {
    this.name = name;
    this.personality = _normalizeTraderPersonality(personality);
    const traits = _getTraderPersonalityTraits(this.personality);
    this.gold = gold || 200 + Math.floor(_bqTraderEntityRand() * 300) + traits.startGoldBonus;
    this.inventory = new Map(); // itemName -> { item, quantity }
    this.cargoCapacity = cargoCapacity || 80 + Math.floor(_bqTraderEntityRand() * 40) + traits.startCargoBonus;
    this.reputation = 50; // 0-100

    this.homeCityIndex = homeCityIndex;
    this.targetCityIndex = -1;
    this.currentCityIndex = homeCityIndex;

    // Position
    const city = cities[homeCityIndex];
    this.x = city.location.x;
    this.y = city.location.y;
    this.path = [];
    this.direction = 'down';
    this.animFrame = 0;
    this.animTimer = 0;

    // State machine
    this.state = 'trading'; // 'trading', 'traveling', 'idle', 'dead'
    this.waitDays = 0;
    this.tradeLog = []; // Last 10 trades for price memory
    this.totalProfit = 0;

    // Movement timing — personality-driven
    this.moveTimer = 0;
    this.moveInterval = traits.moveInterval;

    this.hasBoat = _bqTraderEntityRand() < traits.boatChance;
    this.isSailing = false;

    // Abstract simulation — when ≥ 0 this trader is far from the player and will
    // be teleported to their target city on the day this value is reached.
    // -1 means full A* simulation is active.
    this.abstractArrivalDay = -1;

    // Identity & relationships
    this.id = `t${++Trader._idCounter}`;
    this.relations = new Map(); // Map<traderId, {score:0-100, rival:bool, lastDay:number}>

    // Emote overlay
    this._emoteText  = '';
    this._emoteTimer = 0;
  }

  getCargoWeight() {
    let total = 0;
    for (const [key, entry] of this.inventory) {
      total += (entry.item.weight || 1) * entry.quantity;
    }
    return total;
  }

  _getTraits() {
    return _getTraderPersonalityTraits(this.personality);
  }

  _getTradersAtCity(cityIndex) {
    if (typeof traderManager === 'undefined' || !traderManager || typeof traderManager.getTradersAtCity !== 'function') {
      return [];
    }
    try {
      return traderManager.getTradersAtCity(cityIndex) || [];
    } catch (err) {
      return [];
    }
  }

  _getTradersHeadingToCity(cityIndex) {
    if (typeof traderManager === 'undefined' || !traderManager || typeof traderManager.getTradersHeadingToCity !== 'function') {
      return [];
    }
    try {
      return traderManager.getTradersHeadingToCity(cityIndex) || [];
    } catch (err) {
      return [];
    }
  }

  _getDistanceToCity(cityIndex) {
    const city = cities[cityIndex];
    if (!city || !city.location) return Infinity;
    return Math.hypot((city.location.x || 0) - this.x, (city.location.y || 0) - this.y);
  }

  _estimateAdjustedSellPrice(cityIndex, itemKey) {
    const city = cities[cityIndex];
    if (!city || typeof city.calculateItemPrice !== 'function') return 0;
    let est = city.calculateItemPrice(itemKey, cities, true);
    const tax = (city.management && typeof city.management.taxRate === 'number') ? city.management.taxRate : 0;
    est = Math.floor(est * (1 - Math.min(0.5, tax * 0.5)));
    return Math.max(0, est);
  }

  _getCompetitionSnapshot(cityIndex, traits = this._getTraits()) {
    const seen = new Set();
    let crowding = 0;
    let rivalPressure = 0;
    let support = 0;
    const addTrader = (other, weight) => {
      if (!other || other === this || !other.id || seen.has(other.id)) return;
      seen.add(other.id);
      crowding += weight;
      const rel = this.relations.get(other.id);
      if (rel?.rival) rivalPressure += traits.rivalPenalty * weight;
      else if (rel && rel.score >= 60) support += weight;
    };

    for (const other of this._getTradersAtCity(cityIndex)) addTrader(other, 1);
    for (const other of this._getTradersHeadingToCity(cityIndex)) addTrader(other, 0.6);

    return { crowding, rivalPressure, support };
  }

  _getCategoryDealBonus(item) {
    const category = item?.category || '';
    if (this.personality === 'brave') {
      if (category === 'Luxury' || category === 'Weapon') return 14;
      if (category === 'Contraband') return 18;
      if (category === 'Ore' || category === 'Material') return 2;
      return 0;
    }
    if (this.personality === 'slow') {
      if (category === 'Luxury' || category === 'Medicine' || category === 'Spice') return 10;
      if (category === 'Bag') return 8;
      if (category === 'Food') return 4;
      return 0;
    }
    if ((item?.baseValue || 0) >= 40) return 4;
    if (category === 'Equipment' || category === 'Goods' || category === 'Weapon') return 3;
    return 0;
  }

  _scoreDealOpportunity(opportunity, traits = this._getTraits()) {
    const item = opportunity.item || {};
    const rarity = Number(item.rarity) || 1;
    const weight = Number(item.weight) || 1;
    const baseValue = Number(item.baseValue) || 10;
    const valueDensity = baseValue / (weight + 1);
    const categoryBonus = this._getCategoryDealBonus(item);
    const taxPercent = (Number(opportunity.destinationTax) || 0) * 100;
    const marginBonus = Math.max(0, opportunity.marginRatio - 1);
    const localSurplus = Math.max(0, opportunity.localSurplus || 0);
    const seasonalBonus = opportunity.inSeason ? 1 : 0;
    const profitPerStep = opportunity.unitProfit / Math.max(1, opportunity.distance || 1);

    if (this.personality === 'slow') {
      return (
        opportunity.unitProfit * 0.70 +
        Math.max(0, marginBonus + traits.luckyPriceBonus) * 20 +
        rarity * 9 +
        valueDensity * 0.90 +
        localSurplus * 0.60 +
        seasonalBonus * 8 +
        categoryBonus +
        (Number(opportunity.destinationReputation) || 50) * 0.14 +
        opportunity.support * 3 -
        opportunity.distance * 1.20 -
        taxPercent * 1.00 -
        opportunity.crowding * 4 -
        opportunity.rivalPressure * 1.10 -
        weight * 1.40 +
        (weight <= 2 ? 6 : 0)
      );
    }

    if (this.personality === 'competitive') {
      return (
        opportunity.unitProfit * 1.10 +
        marginBonus * 22 +
        profitPerStep * 6 +
        valueDensity * 0.40 +
        localSurplus * 0.90 +
        seasonalBonus * 6 +
        categoryBonus +
        opportunity.support -
        opportunity.distance * 0.25 -
        taxPercent * 1.20 -
        opportunity.crowding * 2.20 -
        opportunity.rivalPressure * 0.45 -
        weight * 0.50
      );
    }

    return (
      opportunity.unitProfit * 1.20 +
      marginBonus * 18 +
      opportunity.distance * 0.60 +
      rarity * 6 +
      valueDensity * 0.70 +
      localSurplus * 1.10 +
      seasonalBonus * 10 +
      categoryBonus +
      opportunity.support * 2 -
      taxPercent * 0.80 -
      opportunity.crowding * 2 -
      opportunity.rivalPressure * 0.40 -
      weight * 0.70
    );
  }

  _evaluateMarketOpportunities(city = cities[this.currentCityIndex]) {
    const traits = this._getTraits();
    if (!city || !(city.inventory instanceof Map)) return [];

    const season = (typeof dayNight !== 'undefined' && dayNight && typeof dayNight.getSeason === 'function')
      ? dayNight.getSeason()
      : null;
    const originCompetition = this._getCompetitionSnapshot(this.currentCityIndex, traits);
    const destinationCompetitionCache = new Map();
    const getDestinationCompetition = (cityIndex) => {
      if (!destinationCompetitionCache.has(cityIndex)) {
        destinationCompetitionCache.set(cityIndex, this._getCompetitionSnapshot(cityIndex, traits));
      }
      return destinationCompetitionCache.get(cityIndex);
    };

    const opportunities = [];
    for (const [itemKey, entry] of city.inventory) {
      const item = ItemLibrary[itemKey];
      if (!item || item.tradable === false || !entry || entry.quantity <= 2) continue;
      const buyPrice = city.calculateItemPrice(itemKey, cities);
      if (!(buyPrice > 0) || buyPrice > this.gold) continue;

      let best = null;
      for (let i = 0; i < cities.length; i++) {
        if (i === this.currentCityIndex) continue;
        const targetCity = cities[i];
        if (!targetCity) continue;
        const adjustedSellPrice = this._estimateAdjustedSellPrice(i, itemKey);
        const unitProfit = adjustedSellPrice - buyPrice;
        if (unitProfit <= 0) continue;

        const destinationCompetition = getDestinationCompetition(i);
        const distance = this._getDistanceToCity(i);
        const opportunity = {
          itemKey,
          item,
          buyPrice,
          sellPrice: adjustedSellPrice,
          bestCityIdx: i,
          unitProfit,
          marginRatio: adjustedSellPrice / Math.max(1, buyPrice),
          distance,
          localSurplus: entry.quantity - 2,
          destinationTax: targetCity.management?.taxRate || 0,
          destinationReputation: targetCity.reputation ?? 50,
          crowding: originCompetition.crowding + destinationCompetition.crowding,
          rivalPressure: originCompetition.rivalPressure + destinationCompetition.rivalPressure,
          support: originCompetition.support + destinationCompetition.support,
          inSeason: !!(season && Array.isArray(item.seasonality) && item.seasonality.includes(season)),
        };
        opportunity.score = this._scoreDealOpportunity(opportunity, traits);
        if (!best || opportunity.score > best.score) best = opportunity;
      }

      if (best) opportunities.push(best);
    }

    opportunities.sort((a, b) =>
      (b.score - a.score) ||
      (b.unitProfit - a.unitProfit) ||
      (a.distance - b.distance)
    );
    return opportunities;
  }

  _getDesiredPurchaseQty(opportunity, available, buyPrice, traits = this._getTraits()) {
    if (this.personality === 'slow') {
      const appetite = 1 + Math.floor(opportunity.score / 30) + ((opportunity.item?.weight || 1) <= 2 ? 1 : 0);
      return Math.min(traits.maxBuyQty, appetite);
    }
    if (this.personality === 'competitive') {
      const appetite = 3 + Math.floor(opportunity.marginRatio * 2) + Math.min(3, Math.floor(opportunity.unitProfit / 12));
      return Math.min(traits.maxBuyQty, appetite, available);
    }
    const appetite = 4 + Math.floor((opportunity.unitProfit / Math.max(1, buyPrice)) * 6) + Math.min(4, Math.floor(opportunity.distance / 8));
    return Math.min(traits.maxBuyQty, appetite, available);
  }

  _estimateCityStockValue(cityIndex) {
    const city = cities[cityIndex];
    if (!city || !(city.inventory instanceof Map)) return 0;
    const scores = [];
    for (const [itemKey, entry] of city.inventory) {
      const item = ItemLibrary[itemKey];
      if (!item || item.tradable === false || !entry || entry.quantity <= 2) continue;
      const baseValue = Number(item.baseValue) || 10;
      const weight = Number(item.weight) || 1;
      const rarity = Number(item.rarity) || 1;
      const available = Math.min(8, Math.max(0, entry.quantity - 2));
      scores.push((baseValue * rarity * available) / (weight + 1));
    }
    scores.sort((a, b) => b - a);
    return scores.slice(0, 3).reduce((sum, value) => sum + value, 0);
  }

  _estimateInventorySaleValue(cityIndex) {
    let total = 0;
    for (const [itemKey, entry] of this.inventory) {
      total += this._estimateAdjustedSellPrice(cityIndex, itemKey) * (entry?.quantity || 0);
    }
    return total;
  }

  _scoreRouteCity(cityIndex) {
    const city = cities[cityIndex];
    if (!city) return -Infinity;
    const distance = this._getDistanceToCity(cityIndex);
    const inventorySaleValue = this._estimateInventorySaleValue(cityIndex);
    const stockValue = this._estimateCityStockValue(cityIndex);
    const reputation = Number(city.reputation) || 50;
    const taxPercent = (Number(city.management?.taxRate) || 0) * 100;
    const competition = this._getCompetitionSnapshot(cityIndex);
    const coastalBonus = (city.isCoastal || city.port) ? 1 : 0;

    if (this.personality === 'slow') {
      return (
        inventorySaleValue * 0.05 +
        stockValue * 0.08 +
        180 / (distance + 3) +
        reputation * 0.28 +
        coastalBonus * 8 +
        _bqTraderEntityRand() * 6 -
        taxPercent * 1.00 -
        competition.crowding * 4 -
        competition.rivalPressure * 1.10
      );
    }

    if (this.personality === 'competitive') {
      return (
        inventorySaleValue * 0.08 +
        stockValue * 0.12 +
        reputation * 0.18 +
        _bqTraderEntityRand() * 4 -
        distance * 0.80 -
        taxPercent * 1.40 -
        competition.crowding * 2.40 -
        competition.rivalPressure * 0.50
      );
    }

    return (
      inventorySaleValue * 0.06 +
      stockValue * 0.12 +
      distance * 0.85 +
      reputation * 0.18 +
      coastalBonus * 6 +
      _bqTraderEntityRand() * 8 -
      taxPercent * 0.70 -
      competition.crowding * 2 -
      competition.rivalPressure * 0.40
    );
  }

  update(dt) {
    if (this.state === 'dead') return;
    if (this.abstractArrivalDay >= 0) return; // abstract mode — waiting for day-tick teleport

    if (this.state === 'trading') {
      this.doTrading();
    } else if (this.state === 'traveling') {
      this.doTraveling(dt);
    } else if (this.state === 'idle') {
      // Waiting at city
      this.waitDays--;
      if (this.waitDays <= 0) {
        this.planRoute();
      }
    }

    // Tick emote overlay
    if (this._emoteTimer > 0) this._emoteTimer = Math.max(0, this._emoteTimer - dt);

    // Bankruptcy check
    if (this.gold <= this._getTraits().bankruptThreshold && this.inventory.size === 0) {
      this.state = 'dead';
      if (typeof traderGrid !== 'undefined') traderGrid.remove(this);
    }
  }

  doTrading() {
    const city = cities[this.currentCityIndex];
    if (!city) { this.state = 'idle'; return; }

    const goldBefore = this.gold;
    const traits = this._getTraits();
    let luckySale = false;

    // Sell what we have
    for (const [itemKey, entry] of [...this.inventory]) {
      const sellPrice = city.calculateItemPrice(itemKey, cities, true);
      if (sellPrice > 0 && entry.quantity > 0) {
        const qty = entry.quantity;
        let totalSaleValue = sellPrice * qty;
        const rolledLuckySale = traits.luckySaleChance > 0 && _bqTraderEntityRand() < traits.luckySaleChance;
        if (rolledLuckySale) {
          totalSaleValue += Math.max(1, Math.floor(totalSaleValue * traits.luckyPriceBonus));
          luckySale = true;
        }
        this.gold += totalSaleValue;
        this.totalProfit += totalSaleValue;
        city._addOrIncrement(itemKey, qty);
        this.inventory.delete(itemKey);

        // Notify for player's managed city
        if (city._isManagedCity && typeof notificationManager !== 'undefined') {
          notificationManager.log(`Trader ${this.name} sold ${qty}x ${itemKey} to ${city.name} for ${totalSaleValue}g`, 'info');
        }

        this.tradeLog.push({ type: 'sell', item: itemKey, qty, price: Math.floor(totalSaleValue / qty), city: city.name, lucky: rolledLuckySale });
        if (this.tradeLog.length > 20) this.tradeLog.shift();
      }
    }

    const coTraders = this._getTradersAtCity(this.currentCityIndex);
    const opportunities = this._evaluateMarketOpportunities(city)
      .filter((opportunity) => opportunity.marginRatio >= traits.margin && opportunity.score >= traits.dealThreshold)
      .slice(0, traits.maxDistinctPurchases);
    const destinationWeights = new Map();

    for (const opportunity of opportunities) {
      if (this.getCargoWeight() >= this.cargoCapacity) break;
      const entry = city.inventory.get(opportunity.itemKey);
      if (!entry || entry.quantity <= 2) continue;

      const itemWeight = ItemLibrary[opportunity.itemKey]?.weight || 1;
      const available = entry.quantity - 2;
      const canAfford = Math.floor(this.gold / opportunity.buyPrice);
      const weightRoom = Math.floor((this.cargoCapacity - this.getCargoWeight()) / itemWeight);
      const desiredQty = this._getDesiredPurchaseQty(opportunity, available, opportunity.buyPrice, traits);
      const qty = Math.min(canAfford, available, weightRoom, desiredQty);

      if (qty <= 0) continue;

      this.gold -= opportunity.buyPrice * qty;
      entry.quantity -= qty;
      if (entry.quantity <= 0) city.inventory.delete(opportunity.itemKey);

      const existing = this.inventory.get(opportunity.itemKey);
      if (existing) {
        existing.quantity += qty;
      } else {
        this.inventory.set(opportunity.itemKey, { item: ItemLibrary[opportunity.itemKey], quantity: qty });
      }

      if (city._isManagedCity && typeof notificationManager !== 'undefined') {
        notificationManager.log(`Trader ${this.name} bought ${qty}x ${opportunity.itemKey} from ${city.name} for ${opportunity.buyPrice * qty}g`, 'info');
      }

      this.tradeLog.push({ type: 'buy', item: opportunity.itemKey, qty, price: opportunity.buyPrice, city: city.name });
      if (this.tradeLog.length > 20) this.tradeLog.shift();

      const routeWeight = qty * Math.max(1, opportunity.unitProfit + opportunity.score);
      destinationWeights.set(opportunity.bestCityIdx, (destinationWeights.get(opportunity.bestCityIdx) || 0) + routeWeight);
    }

    if (destinationWeights.size > 0) {
      let bestTarget = -1;
      let bestWeight = -Infinity;
      for (const [cityIdx, weight] of destinationWeights) {
        if (weight > bestWeight) {
          bestWeight = weight;
          bestTarget = cityIdx;
        }
      }
      this.targetCityIndex = bestTarget;
    }

    // Set emote based on session profit
    const sessionProfit = this.gold - goldBefore;
    if (luckySale)          { this._emoteText = '🍀'; this._emoteTimer = 2500; }
    else if (sessionProfit > 40)  { this._emoteText = '💰'; this._emoteTimer = 3000; }
    else if (sessionProfit > 0) { this._emoteText = '🤝'; this._emoteTimer = 2000; }
    else                     { this._emoteText = '😢'; this._emoteTimer = 2500; }

    // Update relations with co-present traders
    for (const t of coTraders) {
      const rel = this.relations.get(t.id);
      if (!rel) continue;
      if (rel.rival) {
        rel.score = Math.max(0, rel.score - 3);
      } else if (rel.score >= 60) {
        rel.score = Math.min(100, rel.score + 1);
      }
    }

    // Done trading, plan route or wait
    this.waitDays = traits.waitDaysBase + Math.floor(_bqTraderEntityRand() * traits.waitDaysRand);
    this.state = 'idle';
  }

  planRoute() {
    if (this.targetCityIndex < 0 || this.targetCityIndex === this.currentCityIndex) {
      let bestScore = -Infinity;
      let bestIdx = -1;

      for (let i = 0; i < cities.length; i++) {
        if (i === this.currentCityIndex) continue;
        const score = this._scoreRouteCity(i);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      this.targetCityIndex = bestIdx;
    }

    if (this.targetCityIndex >= 0) {
      const target = cities[this.targetCityIndex];
      const ports = this.hasBoat && typeof portCityLocations !== 'undefined' ? portCityLocations : null;
      const pathResult = aStar(grid, { x: this.x, y: this.y }, target.location, this.hasBoat, ports);
      if (pathResult && pathResult.length > 0) {
        this.path = pathResult;
        // Decrement docked count for the city we're leaving
        if (this.currentCityIndex >= 0 && cities[this.currentCityIndex]) {
          cities[this.currentCityIndex].dockedTraderCount =
            Math.max(0, (cities[this.currentCityIndex].dockedTraderCount || 0) - 1);
        }
        this.state = 'traveling';
      } else {
        // Can't path — long cooldown so we don't hammer A* on unreachable routes.
        // On large maps with water barriers this can be a genuine dead-end.
        this.targetCityIndex = -1;
        this.state = 'idle';
        this.waitDays = 15 + Math.floor(_bqTraderEntityRand() * 15); // 15–30 days before retry
      }
    }
  }

  doTraveling(dt) {
    this.moveTimer += dt;
    if (this.moveTimer < this.moveInterval) return;
    this.moveTimer = 0;

    if (this.path.length === 0) {
      // Arrived at destination
      this.arriveAtCity();
      return;
    }

    const next = this.path[0];

    // Update direction for sprite
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
    if (typeof traderGrid !== 'undefined') traderGrid.move(this, this.x, this.y);

    // Animate
    this.animTimer++;
    if (this.animTimer >= 8) {
      this.animFrame = (this.animFrame + 1) % 3;
      this.animTimer = 0;
    }

    // Check if arrived at target city
    if (this.targetCityIndex >= 0) {
      const target = cities[this.targetCityIndex];
      if (this.x === target.location.x && this.y === target.location.y) {
        this.arriveAtCity();
        return;
      }
    }

    // Check if at any city — O(1) lookup via cityLocationMap
    if (this.state !== 'trading') {
      const cityAtTile = (typeof cityLocationMap !== 'undefined' && cityLocationMap.size > 0)
        ? cityLocationMap.get(`${this.x},${this.y}`) : null;
      if (cityAtTile) {
        const i = cities.indexOf(cityAtTile);
        if (i >= 0) {
          this.currentCityIndex = i;
          if (this.path.length <= 2) {
            this.arriveAtCity();
            return;
          }
        }
      }
    }
  }

  arriveAtCity() {
    this.path = [];
    this.state = 'trading';
    // O(1) lookup via cityLocationMap
    const cityAtTile = (typeof cityLocationMap !== 'undefined' && cityLocationMap.size > 0)
      ? cityLocationMap.get(`${this.x},${this.y}`) : null;
    if (cityAtTile) {
      this.currentCityIndex = cityAtTile.cityIndex >= 0 ? cityAtTile.cityIndex : cities.indexOf(cityAtTile);
      cityAtTile.dockedTraderCount++;
      if (cityAtTile._isManagedCity && typeof notificationManager !== 'undefined') {
        notificationManager.log(`Trader ${this.name} has arrived at ${cityAtTile.name}!`, 'info');
      }
      return;
    }
    // Fallback linear scan (should be rare — cityLocationMap covers all cities)
    for (let i = 0; i < cities.length; i++) {
      const c = cities[i];
      if (this.x === c.location.x && this.y === c.location.y) {
        this.currentCityIndex = i;
        c.dockedTraderCount++;
        break;
      }
    }
  }

  render(tileSize) {
    if (this.state === 'dead') return;

    const px = this.x * tileSize;
    const py = this.y * tileSize;

    // Viewport culling — skip offscreen traders
    if (typeof isOnScreen === 'function' && !isOnScreen(px, py)) return;

    // Check if on water — render as boat
    const tile = grid[this.y]?.[this.x];
    const onWater = tile && tile.options[0] === 'Water' && this.hasBoat;
    this.isSailing = onWater;

    if (onWater) {
      // Render as sloop (traders use sloops)
      const boatSprites = SpriteSheet.boats?.sloop;
      if (boatSprites && boatSprites[this.direction]) {
        const frame = boatSprites[this.direction][this.animFrame] || boatSprites[this.direction][0];
        image(frame, px, py, tileSize, tileSize);
      } else {
        push();
        fill(100, 70, 40);
        noStroke();
        rect(px + 2, py + 4, tileSize - 4, tileSize - 8, 4);
        pop();
      }
    } else {
      const sprites = SpriteSheet.trader?.[this.personality];
      if (sprites && sprites[this.direction]) {
        const frame = sprites[this.direction][this.animFrame] || sprites[this.direction][0];
        image(frame, px, py, tileSize, tileSize);
      } else {
        // Fallback colored square
        push();
        fill(100, 180, 100);
        noStroke();
        rect(px + 4, py + 4, tileSize - 8, tileSize - 8, 3);
        pop();
      }
    }

    // Name label
    push();
    fill(255, 255, 255, 180);
    noStroke();
    textAlign(CENTER, BOTTOM);
    textSize(9);
    text(this.name, px + tileSize / 2, py - 2);

    // Show state badge when docked at city
    if (this.state === 'trading' || this.state === 'idle') {
      fill(80, 200, 120, 200);
      noStroke();
      ellipse(px + tileSize - 3, py + 3, 6, 6);
    }
    pop();

    // Emote overlay (trade mood bubble)
    if (this._emoteTimer > 0) {
      push();
      noStroke();
      textSize(14);
      textAlign(CENTER, BOTTOM);
      text(this._emoteText, px + tileSize / 2, py - 14);
      pop();
    }
  }

  // Serialize for save
  toJSON() {
    return {
      name: this.name,
      personality: this.personality,
      gold: this.gold,
      inventory: [...this.inventory].map(([k, v]) => [k, v.quantity]),
      cargoCapacity: this.cargoCapacity,
      reputation: this.reputation,
      homeCityIndex: this.homeCityIndex,
      targetCityIndex: this.targetCityIndex,
      currentCityIndex: this.currentCityIndex,
      x: this.x,
      y: this.y,
      state: this.state,
      waitDays: this.waitDays,
      totalProfit: this.totalProfit,
      hasBoat: this.hasBoat,
      abstractArrivalDay: this.abstractArrivalDay,
      id: this.id,
      relations: [...this.relations].map(([id, rel]) => [id, { ...rel }]),
    };
  }

  static fromJSON(data) {
    const t = new Trader({
      name: data.name,
      homeCityIndex: data.homeCityIndex,
      personality: data.personality,
      gold: data.gold,
      cargoCapacity: data.cargoCapacity,
    });
    t.reputation = data.reputation;
    t.targetCityIndex = data.targetCityIndex;
    t.currentCityIndex = data.currentCityIndex;
    t.x = data.x;
    t.y = data.y;
    t.state = data.state;
    t.waitDays = data.waitDays;
    t.totalProfit = data.totalProfit;
    t.hasBoat = data.hasBoat || false;
    t.isSailing = false;
    t.abstractArrivalDay = data.abstractArrivalDay ?? -1;
    // Restore identity and relations (backwards-compat: old saves get fresh id/empty relations)
    t.id = data.id || `t${++Trader._idCounter}`;
    t.relations = new Map((data.relations || []).map(([id, rel]) => [id, rel]));
    t._emoteText  = '';
    t._emoteTimer = 0;
    for (const [key, qty] of (Array.isArray(data.inventory) ? data.inventory : [])) {
      if (ItemLibrary[key]) {
        t.inventory.set(key, { item: ItemLibrary[key], quantity: qty });
      }
    }
    return t;
  }
}

Trader._idCounter = 0;
