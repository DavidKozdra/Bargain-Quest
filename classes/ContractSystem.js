// ContractSystem.js — Delivery, bounty, escort, and survey mission system

function _bqContractRoot() {
  if (typeof window !== 'undefined') return window;
  if (typeof globalThis !== 'undefined') return globalThis;
  return null;
}

function _bqContractBearEmpire() {
  const root = _bqContractRoot();
  return typeof root?.BQGetBearEmpireSystem === 'function' ? root.BQGetBearEmpireSystem() : null;
}

function _bqContractWorldSession() {
  const root = _bqContractRoot();
  return typeof root?.BQGetWorldSession === 'function' ? root.BQGetWorldSession() : null;
}

function _bqContractCurrentNodeKey() {
  return _bqContractWorldSession()?.spaceContext?.nodeKey || null;
}

function _bqContractCurrentWarStatus() {
  const bearEmpire = _bqContractBearEmpire();
  const nodeKey = _bqContractCurrentNodeKey();
  if (!bearEmpire || !nodeKey || typeof bearEmpire.getSystemStatus !== 'function') return null;
  return bearEmpire.getSystemStatus(nodeKey) || null;
}

const _BQ_CONTRACT_RESISTANCE_ITEMS = ['Tools', 'Iron', 'Wheat', 'Fish', 'Herbs', 'Wood', 'Bread', 'Salt'];
const _BQ_CONTRACT_TRIBUTE_ITEMS = ['Wine', 'Silk', 'Spices', 'Jewelry', 'Tools', 'Iron', 'Bread'];

class ContractSystem {
  constructor() {
    /** @type {Contract[]} */
    this.available = new Map(); // cityName -> Contract[]
    this.active = [];           // player's accepted contracts (max 3)
    this.completed = [];        // history
    this.maxActive = 3;
    this.refreshIntervalDays = 3;
    this._lastRefreshDay = 0;

    this._onDayChanged = () => this.onDayChanged();
    window.addEventListener('dayChanged', this._onDayChanged);
  }

  destroy() {
    window.removeEventListener('dayChanged', this._onDayChanged);
  }

  // ─── Contract generation ───────────────────────────────────

  _progressScale(day) {
    return 1 + Math.min(0.50, Math.max(0, Number(day) || 0) / 160);
  }

  _routeDistance(source, target) {
    if (!source?.location || !target?.location) return 0;
    return Math.abs(source.location.x - target.location.x) + Math.abs(source.location.y - target.location.y);
  }

  _routeDeadline(day, distance, preparationDays = 3) {
    return day + preparationDays + Math.max(1, Math.ceil(Math.max(0, distance) / 75));
  }

  /** Generate 2-4 contracts for a city */
  generateForCity(city) {
    const contracts = [];
    const count = 2 + Math.floor(Math.random() * 3); // 2-4

    const types = ['delivery', 'bulkOrder', 'escort', 'rareFind', 'survey'];
    const usedTypes = new Set();

    for (let i = 0; i < count; i++) {
      // Pick a type not yet used (variety)
      let type;
      do {
        type = types[Math.floor(Math.random() * types.length)];
      } while (usedTypes.has(type) && usedTypes.size < types.length);

      const contract = this._createContract(type, city);
      if (contract) {
        usedTypes.add(type);
        contracts.push(contract);
      }
    }

    const crisisContract = this._maybeCreateCrisisContract(city);
    if (crisisContract) contracts.push(crisisContract);

    this.available.set(city.name, contracts);
    return contracts;
  }

  _createContract(type, sourceCity) {
    const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;
    // Inflation follows world age modestly; wealth never raises payment for
    // an otherwise identical job.
    const goldScale = this._progressScale(day);

    switch (type) {
      case 'delivery': return this._makeDelivery(sourceCity, day, goldScale);
      case 'bulkOrder': return this._makeBulkOrder(sourceCity, day, goldScale);
      case 'escort': return this._makeEscort(sourceCity, day, goldScale);
      case 'rareFind': return this._makeRareFind(sourceCity, day, goldScale);
      case 'survey': return this._makeSurvey(sourceCity, day, goldScale);
      default: return null;
    }
  }

  _makeDelivery(city, day, scale) {
    if (typeof cities === 'undefined' || cities.length < 2) return null;
    const otherCities = cities.filter(c => c.name !== city.name);
    const target = otherCities[Math.floor(Math.random() * otherCities.length)];
    const tradeItems = ['Iron', 'Wheat', 'Fish', 'Clay', 'Wood', 'Salt', 'Herbs', 'Fur', 'Spices', 'Wine', 'Silk'];
    const item = tradeItems[Math.floor(Math.random() * tradeItems.length)];
    const qty = 2 + Math.floor(Math.random() * 4);
    const distance = this._routeDistance(city, target);
    const itemValue = (ItemLibrary[item]?.baseValue || 20) * qty;
    const routePremium = 0.65 + Math.min(1.25, distance / 120);
    const reward = Math.floor(itemValue * routePremium * scale);
    const deadline = this._routeDeadline(day, distance, 3);

    return {
      id: `del_${day}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'delivery',
      title: `Deliver ${qty} ${item} to ${target.name}`,
      description: `The merchants of ${city.name} need ${qty} ${item} delivered to ${target.name}. Time-sensitive!`,
      source: city.name,
      target: target.name,
      item, qty, reward, deadline, routeDistance: distance,
      repReward: 3 + Math.floor(Math.random() * 3),
      accepted: false,
      completed: false,
    };
  }

  _makeBulkOrder(city, day, scale) {
    const tradeItems = ['Iron', 'Wheat', 'Fish', 'Wood', 'Bread', 'Tools', 'Pottery'];
    const item = tradeItems[Math.floor(Math.random() * tradeItems.length)];
    const qty = 5 + Math.floor(Math.random() * 6);
    const baseReward = (ItemLibrary[item]?.baseValue || 20) * qty * 2;
    const reward = Math.floor(baseReward * Math.min(3, scale));
    const deadline = day + 7 + Math.floor(Math.random() * 14);

    return {
      id: `bulk_${day}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'bulkOrder',
      title: `Sell ${qty} ${item} here`,
      description: `${city.name} has a bulk order for ${qty} ${item}. Sell them here before the deadline for a premium price!`,
      source: city.name,
      target: city.name,
      item, qty, reward, deadline,
      repReward: 4 + Math.floor(Math.random() * 4),
      accepted: false,
      completed: false,
    };
  }

  _makeEscort(city, day, scale) {
    if (typeof cities === 'undefined' || cities.length < 2) return null;
    const otherCities = cities.filter(c => c.name !== city.name);
    const target = otherCities[Math.floor(Math.random() * otherCities.length)];
    const distance = this._routeDistance(city, target);
    const reward = Math.floor((55 + distance * 1.2) * scale);
    const deadline = this._routeDeadline(day, distance, 4);

    return {
      id: `esc_${day}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'escort',
      title: `Escort trader to ${target.name}`,
      description: `A nervous merchant needs protection traveling to ${target.name}. Ambush chance en route!`,
      source: city.name,
      target: target.name,
      reward, deadline, routeDistance: distance,
      repReward: 5 + Math.floor(Math.random() * 4),
      accepted: false,
      completed: false,
    };
  }

  _makeRareFind(city, day, scale) {
    const luxItems = ['Jewelry', 'Spices', 'Silk', 'Wine'];
    const item = luxItems[Math.floor(Math.random() * luxItems.length)];
    const baseReward = (ItemLibrary[item]?.baseValue || 50) * (2 + Math.random() * 2);
    const reward = Math.floor(baseReward * Math.min(3, scale));

    return {
      id: `rare_${day}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'rareFind',
      title: `Acquire 1 ${item}`,
      description: `A wealthy patron in ${city.name} seeks ${item}. Bring one here for a generous reward. No deadline!`,
      source: city.name,
      target: city.name,
      item, qty: 1, reward, deadline: null, // no time limit
      repReward: 6 + Math.floor(Math.random() * 3),
      accepted: false,
      completed: false,
    };
  }

  _makeSurvey(city, day, scale) {
    const targets = [];
    const origin = city?.location || { x: 0, y: 0 };
    const worldWidth = typeof cols !== 'undefined' ? cols : 100;
    const worldHeight = typeof rows !== 'undefined' ? rows : 100;
    const radius = Math.max(25, Math.min(100, Math.round(Math.max(worldWidth, worldHeight) * 0.12)));
    for (let i = 0; i < 3; i++) {
      let tx, ty, attempts = 0;
      do {
        tx = Math.max(0, Math.min(worldWidth - 1, origin.x + Math.floor((Math.random() * 2 - 1) * radius)));
        ty = Math.max(0, Math.min(worldHeight - 1, origin.y + Math.floor((Math.random() * 2 - 1) * radius)));
        attempts++;
      } while (attempts < 200 && (typeof grid === 'undefined' || !grid[ty]?.[tx] || grid[ty][tx].options[0] === 'Water'));
      // Only add the point if it's on land — skip if all attempts failed
      if (typeof grid !== 'undefined' && grid[ty]?.[tx]?.options[0] !== 'Water') {
        targets.push({ x: tx, y: ty });
      }
    }
    if (targets.length === 0) return null;
    let routeDistance = 0;
    let previous = origin;
    for (const target of targets) {
      routeDistance += Math.abs(previous.x - target.x) + Math.abs(previous.y - target.y);
      previous = target;
    }
    const reward = Math.floor((45 + routeDistance * 0.7) * scale);
    const deadline = this._routeDeadline(day, routeDistance, 4);

    return {
      id: `surv_${day}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'survey',
      title: `Survey ${targets.length} locations`,
      description: `Cartographers need tiles mapped. Visit all ${targets.length} marked locations.`,
      source: city.name,
      target: null,
      surveyPoints: targets,
      surveyVisited: targets.map(() => false),
      reward, deadline, routeDistance,
      repReward: 3 + Math.floor(Math.random() * 3),
      accepted: false,
      completed: false,
    };
  }

  _maybeCreateCrisisContract(city) {
    const bearEmpire = _bqContractBearEmpire();
    const nodeKey = _bqContractCurrentNodeKey();
    const status = _bqContractCurrentWarStatus();
    if (!bearEmpire?.active || bearEmpire?.raymondDefeated || !nodeKey || !status) return null;
    if (!(status.occupied || status.threatened || status.resistanceCell)) return null;

    const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;
    const goldTarget = window._newGameGoldTarget || 5000;
    const playerGold = typeof player !== 'undefined' ? player.gold : 100;
    const goldProgress = playerGold / (goldTarget * 0.35);
    const dayProgress = day / 40;
    const goldScale = Math.min(4.0, Math.max(1, 1 + Math.max(goldProgress, dayProgress) * 1.5));

    if (status.resistanceCell || status.threatened || (status.occupied && bearEmpire.alignment !== 'bear_aligned' && Math.random() < 0.7)) {
      return this._makeResistanceCrisisContract(city, day, goldScale, nodeKey, status);
    }
    return this._makeBearCrisisContract(city, day, goldScale, nodeKey, status);
  }

  _pickContractTarget(city) {
    if (typeof cities === 'undefined' || cities.length < 2) return null;
    const otherCities = cities.filter((candidate) => candidate.name !== city.name);
    if (otherCities.length === 0) return null;
    return otherCities[Math.floor(Math.random() * otherCities.length)];
  }

  _makeResistanceCrisisContract(city, day, scale, nodeKey, status) {
    const target = this._pickContractTarget(city);
    if (!target) return null;
    const useEscort = Math.random() < (status.occupied ? 0.45 : 0.25);
    if (useEscort) {
      const reward = Math.floor((95 + Math.random() * 160) * Math.min(3.5, scale + 0.4));
      return {
        id: `resc_${day}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'escort',
        title: `Escort DK aid convoy to ${target.name}`,
        description: `DK Resistance couriers need an armed escort from ${city.name} to ${target.name} before bear patrols lock the roads.`,
        source: city.name,
        target: target.name,
        reward,
        deadline: day + 8,
        repReward: 7 + Math.floor(Math.random() * 3),
        accepted: false,
        completed: false,
        crisisContract: true,
        crisisSide: 'resistance',
        crisisEffect: 'escort',
        crisisNodeKey: nodeKey,
      };
    }

    const validItems = _BQ_CONTRACT_RESISTANCE_ITEMS.filter((item) => ItemLibrary?.[item]);
    const item = validItems[Math.floor(Math.random() * validItems.length)] || 'Tools';
    const qty = 3 + Math.floor(Math.random() * 4);
    const baseReward = (ItemLibrary[item]?.baseValue || 22) * qty * (1.8 + Math.random());
    const reward = Math.floor(baseReward * Math.min(3.5, scale + 0.25));
    return {
      id: `raid_${day}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'delivery',
      title: `Aid run to ${target.name}`,
      description: `Resistance quartermasters need ${qty} ${item} moved from ${city.name} to ${target.name} before the bear patrol net closes.`,
      source: city.name,
      target: target.name,
      item,
      qty,
      reward,
      deadline: day + 7 + Math.floor(Math.random() * 4),
      repReward: 6 + Math.floor(Math.random() * 3),
      accepted: false,
      completed: false,
      crisisContract: true,
      crisisSide: 'resistance',
      crisisEffect: 'aid',
      crisisNodeKey: nodeKey,
    };
  }

  _makeBearCrisisContract(city, day, scale, nodeKey, status) {
    const target = this._pickContractTarget(city);
    if (!target) return null;
    const useEscort = status.occupied && Math.random() < 0.35;
    if (useEscort) {
      const reward = Math.floor((110 + Math.random() * 180) * Math.min(3.5, scale + 0.45));
      return {
        id: `bear_${day}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'escort',
        title: `Escort tribute caravan to ${target.name}`,
        description: `Bear tribute officers demand a protected caravan from ${city.name} to ${target.name}. Desertion is not advised.`,
        source: city.name,
        target: target.name,
        reward,
        deadline: day + 6,
        repReward: 6 + Math.floor(Math.random() * 2),
        accepted: false,
        completed: false,
        crisisContract: true,
        crisisSide: 'bears',
        crisisEffect: 'escort',
        crisisNodeKey: nodeKey,
      };
    }

    const validItems = _BQ_CONTRACT_TRIBUTE_ITEMS.filter((item) => ItemLibrary?.[item]);
    const item = validItems[Math.floor(Math.random() * validItems.length)] || 'Wine';
    const qty = 2 + Math.floor(Math.random() * 3);
    const baseReward = (ItemLibrary[item]?.baseValue || 35) * qty * (1.9 + Math.random());
    const reward = Math.floor(baseReward * Math.min(3.7, scale + 0.35));
    return {
      id: `trib_${day}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'delivery',
      title: `Deliver tribute to ${target.name}`,
      description: `Bear tribute officers in ${city.name} demand ${qty} ${item} delivered to ${target.name}. Payment is generous, refusal is not.`,
      source: city.name,
      target: target.name,
      item,
      qty,
      reward,
      deadline: day + 6 + Math.floor(Math.random() * 3),
      repReward: 5 + Math.floor(Math.random() * 2),
      accepted: false,
      completed: false,
      crisisContract: true,
      crisisSide: 'bears',
      crisisEffect: 'tribute',
      crisisNodeKey: nodeKey,
    };
  }

  _applyCrisisOutcome(contract) {
    if (!contract?.crisisContract) return;
    const bearEmpire = _bqContractBearEmpire();
    const nodeKey = contract.crisisNodeKey || _bqContractCurrentNodeKey();
    if (!bearEmpire || !nodeKey) return;

    if (contract.crisisSide === 'resistance') {
      bearEmpire.supportResistance(nodeKey);
      if (contract.crisisEffect === 'escort') {
        bearEmpire.recordBlockadeRun(nodeKey, 72);
      }
      return;
    }

    if (contract.crisisSide === 'bears') {
      bearEmpire.supportBears(nodeKey);
    }
  }

  // ─── Player actions ─────────────────────────────────────

  acceptContract(contract) {
    if (this.active.length >= this.maxActive) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('You can only hold 3 active contracts!', 'warning');
      }
      return false;
    }
    if (contract.type === 'delivery') {
      if (!this._provisionDeliveryItems(contract)) return false;
    }
    contract.accepted = true;
    this.active.push(contract);

    // Remove from available
    for (const [cityName, contracts] of this.available) {
      const idx = contracts.indexOf(contract);
      if (idx >= 0) { contracts.splice(idx, 1); break; }
    }

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Contract accepted: ${contract.title}`, 'success');
    }
    return true;
  }

  /** Check all active contracts for completion. Called on sell, visit city, move, etc. */
  checkCompletion() {
    const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;

    for (let i = this.active.length - 1; i >= 0; i--) {
      const c = this.active[i];

      // Check expiry first
      if (c.deadline && day > c.deadline) {
        this._failContract(c, i);
        continue;
      }

      let complete = false;

      switch (c.type) {
        case 'delivery':
          // Player at target city with enough items
          if (player.currentCity?.name === c.target && this._playerHasItem(c.item, c.qty)) {
            complete = true;
          }
          break;

        case 'bulkOrder':
          // Player at source city with enough items
          if (player.currentCity?.name === c.target && this._playerHasItem(c.item, c.qty)) {
            complete = true;
          }
          break;

        case 'escort':
          // Player reached target city
          if (player.currentCity?.name === c.target) {
            complete = true;
          }
          break;

        case 'rareFind':
          // Player at source city with the item
          if (player.currentCity?.name === c.target && this._playerHasItem(c.item, c.qty)) {
            complete = true;
          }
          break;

        case 'survey':
          // Check if player is on any survey point
          if (c.surveyPoints) {
            for (let j = 0; j < c.surveyPoints.length; j++) {
              if (!c.surveyVisited[j]) {
                const sp = c.surveyPoints[j];
                if (Math.abs(player.x - sp.x) <= 1 && Math.abs(player.y - sp.y) <= 1) {
                  c.surveyVisited[j] = true;
                  if (typeof notificationManager !== 'undefined') {
                    notificationManager.log(`Survey point ${j + 1}/${c.surveyPoints.length} discovered!`, 'success');
                  }
                }
              }
            }
            if (c.surveyVisited.every(v => v)) complete = true;
          }
          break;
      }

      if (complete) {
        this._completeContract(c, i);
      }
    }
  }

  _playerHasItem(itemName, qty) {
    const entry = player.inventory.get(itemName);
    return entry && entry.quantity >= qty;
  }

  _completeContract(contract, index) {
    // Remove items from player and add to destination city if delivery/bulk/rareFind
    if (contract.item && contract.qty && contract.type !== 'escort' && contract.type !== 'survey') {
      for (let i = 0; i < contract.qty; i++) {
        player.removeItem({ name: contract.item });
      }
      // Give items to the destination city so city inventories stay balanced
      if (typeof cities !== 'undefined') {
        const destName = contract.target || contract.source;
        const destCity = cities.find(c => c.name === destName);
        if (destCity && ItemLibrary[contract.item]) {
          const ce = destCity.inventory.get(contract.item);
          if (ce) {
            ce.quantity += contract.qty;
          } else {
            destCity.inventory.set(contract.item, { item: ItemLibrary[contract.item], quantity: contract.qty });
          }
        }
      }
    }

    player.earnGold(contract.reward);
    contract.completed = true;

    // Reputation boost at source city
    if (typeof cities !== 'undefined') {
      const city = cities.find(c => c.name === contract.source);
      if (city && city.adjustReputation) {
        city.adjustReputation(contract.repReward || 5);
      }
    }

    this._applyCrisisOutcome(contract);

    this.active.splice(index, 1);
    this.completed.push(contract);

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Contract complete: "${contract.title}" — Earned ${contract.reward}g!`, 'success');
    }
  }

  _provisionDeliveryItems(contract) {
    if (!contract || !contract.item || !contract.qty || typeof player === 'undefined') return false;
    const existingQty = player.inventory.get(contract.item)?.quantity || 0;
    const needed = Math.max(0, contract.qty - existingQty);
    if (needed <= 0) {
      contract.cargoEscrow = { item: contract.item, qty: 0, source: contract.source };
      return true;
    }

    let sourceCity = null;
    let cityEntry = null;
    if (typeof cities !== 'undefined' && Array.isArray(cities)) {
      sourceCity = cities.find((c) => c.name === contract.source);
      if (sourceCity && sourceCity.inventory) {
        cityEntry = sourceCity.inventory.get(contract.item);
      }
    }
    if (!cityEntry || cityEntry.quantity < needed) {
      if (typeof notificationManager !== 'undefined') notificationManager.log(`${contract.source} does not have enough ${contract.item} to issue this contract.`, 'warning');
      return false;
    }
    if (!player.addItem({ name: contract.item, quantity: needed })) return false;
    cityEntry.quantity -= needed;
    if (cityEntry.quantity <= 0) sourceCity.inventory.delete(contract.item);
    contract.cargoEscrow = { item: contract.item, qty: needed, source: contract.source };
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Loaded ${needed} ${contract.item} from ${contract.source} for ${contract.title}.`, 'info');
    }
    return true;
  }

  _reclaimDeliveryEscrow(contract) {
    const escrow = contract?.cargoEscrow;
    if (!escrow || escrow.qty <= 0 || typeof player === 'undefined') return 0;
    const held = player.inventory.get(escrow.item)?.quantity || 0;
    const reclaimed = Math.min(held, escrow.qty);
    if (reclaimed > 0 && typeof player.removeItemQuantity === 'function') player.removeItemQuantity(escrow.item, reclaimed);
    const sourceCity = typeof cities !== 'undefined' ? cities.find((city) => city.name === escrow.source) : null;
    if (sourceCity && reclaimed > 0) sourceCity._addOrIncrement(escrow.item, reclaimed);
    escrow.qty = Math.max(0, escrow.qty - reclaimed);
    return reclaimed;
  }

  _failContract(contract, index) {
    this._reclaimDeliveryEscrow(contract);
    this.active.splice(index, 1);

    // Reputation loss at source city
    if (typeof cities !== 'undefined') {
      const city = cities.find(c => c.name === contract.source);
      if (city && city.adjustReputation) {
        city.adjustReputation(-5);
      }
    }

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Contract expired: "${contract.title}" — Reputation lost!`, 'error');
    }
  }

  /** Voluntarily abandon an active contract. Costs a small reputation penalty. */
  abandonContract(contract) {
    const idx = this.active.indexOf(contract);
    if (idx < 0) return false;

    this._reclaimDeliveryEscrow(contract);
    this.active.splice(idx, 1);

    // Smaller rep hit than expiry (-3 vs -5)
    if (typeof cities !== 'undefined') {
      const city = cities.find(c => c.name === contract.source);
      if (city && city.adjustReputation) {
        city.adjustReputation(-3);
      }
    }

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Contract abandoned: "${contract.title}" — Minor reputation lost.`, 'warning');
    }
    return true;
  }

  // ─── Daily tick ─────────────────────────────────────────

  onDayChanged() {
    const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;

    // Refresh city contracts periodically
    if (day - this._lastRefreshDay >= this.refreshIntervalDays) {
      this._lastRefreshDay = day;
      if (typeof cities !== 'undefined') {
        for (const city of cities) {
          this.generateForCity(city);
        }
      }
    }

    // Check expirations
    this.checkCompletion();

    // Escort ambush chance (10% per day if escort active)
    for (const c of this.active) {
      if (c.type === 'escort' && Math.random() < 0.10) {
        if (typeof combatSystem !== 'undefined' && typeof Raider !== 'undefined') {
          const bandit = new Raider({
            x: player.x, y: player.y,
            strength: 2 + Math.floor(Math.random() * 3),
            patrolPoints: [],
          });
          bandit.loot.gold = 20 + Math.floor(Math.random() * 30);
          combatSystem.startCombat(bandit);
          if (typeof notificationManager !== 'undefined') {
            notificationManager.log('Escort ambush! Bandits attack!', 'warning');
          }
          break; // only one ambush per day
        }
      }
    }
  }

  // ─── Serialization ──────────────────────────────────────

  toJSON() {
    const avail = {};
    for (const [k, v] of this.available) {
      avail[k] = v;
    }
    return {
      available: avail,
      active: this.active,
      completed: this.completed.slice(-20), // keep last 20
      lastRefreshDay: this._lastRefreshDay,
    };
  }

  static fromJSON(data) {
    const cs = new ContractSystem();
    if (data.available) {
      for (const [k, v] of Object.entries(data.available)) {
        cs.available.set(k, v);
      }
    }
    cs.active = data.active || [];
    cs.completed = data.completed || [];
    cs._lastRefreshDay = data.lastRefreshDay || 0;
    return cs;
  }

  /** Get contracts available at a specific city */
  getContractsForCity(cityName) {
    return this.available.get(cityName) || [];
  }
}

if (typeof window !== 'undefined') {
  window.ContractSystem = ContractSystem;
}
