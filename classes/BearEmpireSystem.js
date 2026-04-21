// BearEmpireSystem.js — Global galactic crisis controller for Intergalactic Penny Operation.

function _bqBearRoot() {
  if (typeof window !== 'undefined') return window;
  if (typeof globalThis !== 'undefined') return globalThis;
  return null;
}

function _bqBearClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function _bqBearHash(input) {
  const str = String(input || '');
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function _bqBearScore(seed, label) {
  return (_bqBearHash(`${seed}:${label}`) % 1000000) / 1000000;
}

function _bqBearUnique(list) {
  return [...new Set((Array.isArray(list) ? list : []).filter(Boolean))];
}

function _bqBearCurrentDay(root) {
  const raw = Number(root?.dayNight?.daysElapsed);
  return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}

function _bqBearGraphAdjacency(graph) {
  const adjacency = new Map();
  const systems = graph?.systems || {};
  for (const key of Object.keys(systems)) adjacency.set(key, new Set());
  const routes = Array.isArray(graph?.routes) ? graph.routes : [];
  for (const route of routes) {
    const from = route?.from;
    const to = route?.to;
    if (!from || !to) continue;
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    if (!adjacency.has(to)) adjacency.set(to, new Set());
    adjacency.get(from).add(to);
    adjacency.get(to).add(from);
  }
  return adjacency;
}

function _bqBearBfsDepths(graph, startKey = 'orbit') {
  const adjacency = _bqBearGraphAdjacency(graph);
  const depths = new Map();
  if (!adjacency.has(startKey)) return depths;
  const queue = [startKey];
  depths.set(startKey, 0);
  while (queue.length > 0) {
    const current = queue.shift();
    const currentDepth = depths.get(current) || 0;
    for (const next of adjacency.get(current) || []) {
      if (depths.has(next)) continue;
      depths.set(next, currentDepth + 1);
      queue.push(next);
    }
  }
  return depths;
}

function _bqBearSortKeys(keys, seed, label) {
  return _bqBearUnique(keys).sort((a, b) => {
    const diff = _bqBearScore(seed, `${label}:${b}`) - _bqBearScore(seed, `${label}:${a}`);
    if (Math.abs(diff) > 0.000001) return diff > 0 ? 1 : -1;
    return String(a).localeCompare(String(b));
  });
}

class BearEmpireSystem {
  constructor(options = {}) {
    const root = _bqBearRoot();
    this.seed = Number.isFinite(Number(options.seed))
      ? Math.floor(Number(options.seed))
      : Math.floor(Date.now() % 1000000000);
    this.spreadIntervalDays = Math.max(1, Math.floor(Number(options.spreadIntervalDays) || 2));
    this.graphResolver = (typeof options.graphResolver === 'function')
      ? options.graphResolver
      : (() => (typeof root?.BQGetSpaceWorldGraph === 'function' ? root.BQGetSpaceWorldGraph() : null));
    this.playerGetter = (typeof options.playerGetter === 'function')
      ? options.playerGetter
      : (() => root?.player || null);
    this.citiesGetter = (typeof options.citiesGetter === 'function')
      ? options.citiesGetter
      : (() => (Array.isArray(root?.cities) ? root.cities : []));
    this.notificationGetter = (typeof options.notificationGetter === 'function')
      ? options.notificationGetter
      : (() => root?.notificationManager || null);

    this.active = false;
    this.dayStarted = 0;
    this.lastProcessedDay = 0;
    this.empireStrength = 0;
    this.systemsControlled = [];
    this.systemsThreatened = [];
    this.capitalSystemKey = null;
    this.raymondRevealed = false;
    this.raymondDefeated = false;
    this.intelPoints = 0;
    this.visibilityLevel = 0;
    this.knownBearSystems = [];
    this.knownResistanceSystems = [];
    this.tributeCollected = 0;
    this.spreadCounter = 0;
    this.difficultyTier = 1;
    this.resistanceStrength = 0;
    this.alignment = 'neutral';
    this.bearStanding = 0;
    this.resistanceStanding = 0;
    this.resistanceCells = [];
    this.activityFeed = [];
    this.pendingIncidents = [];

    if (!options.skipSeed) {
      this._seedInitialState();
    }

    this._onDayChanged = (event) => {
      const detailDay = Number(event?.detail?.daysElapsed);
      this.onDayChanged(Number.isFinite(detailDay) ? detailDay : null);
    };
    if (root && typeof root.addEventListener === 'function') {
      root.addEventListener('dayChanged', this._onDayChanged);
    }

    if (!options.skipActivation) {
      this.evaluateActivation();
    }
  }

  destroy() {
    const root = _bqBearRoot();
    if (root && typeof root.removeEventListener === 'function' && this._onDayChanged) {
      root.removeEventListener('dayChanged', this._onDayChanged);
    }
    this._onDayChanged = null;
  }

  _notify(message, level = 'info') {
    const manager = this.notificationGetter();
    if (manager && typeof manager.log === 'function' && message) {
      manager.log(message, level);
    }
  }

  _appendFeed(type, message, extra = {}) {
    if (!message) return;
    this.activityFeed.unshift({
      day: this.lastProcessedDay || this.dayStarted || 0,
      type,
      message,
      ...extra,
    });
    if (this.activityFeed.length > 24) this.activityFeed.length = 24;
  }

  _currentContextNodeKey() {
    const root = _bqBearRoot();
    const session = typeof root?.BQGetWorldSession === 'function' ? root.BQGetWorldSession() : null;
    const sessionNode = session?.spaceContext?.nodeKey;
    if (sessionNode && this._systemKeys().includes(sessionNode)) return sessionNode;

    const liveSpaceSystem = root?._spaceTravelSystem || this.playerGetter()?._spaceTravelSystem || null;
    const liveNode = liveSpaceSystem?.currentNode;
    if (liveNode && this._systemKeys().includes(liveNode)) return liveNode;

    const player = this.playerGetter();
    const fallbackNode = player?.spaceTravel?.currentPlanet;
    if (fallbackNode && this._systemKeys().includes(fallbackNode)) return fallbackNode;
    return null;
  }

  _incidentSeed(dayNumber, nodeKey, label) {
    return _bqBearScore(this.seed + (Number(dayNumber) || 0), `${nodeKey || 'unknown'}:${label}`);
  }

  _graph() {
    const graph = this.graphResolver();
    if (graph && graph.systems && graph.routes) return graph;
    return { systems: {}, routes: [] };
  }

  _systemKeys() {
    return Object.keys(this._graph().systems || {});
  }

  _playableSystemKeys() {
    return this._systemKeys().filter((key) => key && key !== 'orbit');
  }

  _adjacency() {
    return _bqBearGraphAdjacency(this._graph());
  }

  _depths() {
    return _bqBearBfsDepths(this._graph(), 'orbit');
  }

  _seedInitialState() {
    const graph = this._graph();
    const nodes = this._playableSystemKeys();
    if (nodes.length === 0) return;

    const depths = this._depths();
    const maxDepth = nodes.reduce((max, key) => Math.max(max, depths.get(key) || 0), 0);
    const farthest = nodes.filter((key) => (depths.get(key) || 0) === maxDepth);
    this.capitalSystemKey = _bqBearSortKeys(farthest.length > 0 ? farthest : nodes, this.seed, 'capital')[0] || nodes[0];
    this.systemsControlled = this.capitalSystemKey ? [this.capitalSystemKey] : [];

    const adjacency = this._adjacency();
    const capitalNeighbors = _bqBearSortKeys(
      [...(adjacency.get(this.capitalSystemKey) || [])].filter((key) => key !== 'orbit'),
      this.seed,
      'capital-neighbor'
    );
    this.systemsThreatened = capitalNeighbors.slice(0, 2);

    const resistanceCandidates = _bqBearSortKeys(
      nodes.filter((key) => key !== this.capitalSystemKey && !this.systemsThreatened.includes(key)),
      this.seed,
      'resistance'
    ).sort((a, b) => {
      const depthA = depths.get(a) || 0;
      const depthB = depths.get(b) || 0;
      if (depthA !== depthB) return depthA - depthB;
      return String(a).localeCompare(String(b));
    });
    this.resistanceCells = resistanceCandidates.slice(0, Math.min(2, resistanceCandidates.length));
    this.knownResistanceSystems = this.resistanceCells.slice();
    this.knownBearSystems = this.systemsThreatened.slice(0, 1);
    this.visibilityLevel = 0.16;
    this.intelPoints = 1;
    this.dayStarted = _bqBearCurrentDay(_bqBearRoot());
    this.lastProcessedDay = this.dayStarted;
    this._recomputeState();
  }

  _canUnlockSpace() {
    const player = this.playerGetter();
    if (player?.spaceTravel?.inOrbit) return true;
    if (Array.isArray(player?.spaceTravel?.visitedPlanets) && player.spaceTravel.visitedPlanets.length > 0) return true;

    const cities = this.citiesGetter();
    return Array.isArray(cities) && cities.some((city) => {
      const prog = city?.progression;
      return !!(
        city?.hasSpaceport
        || prog?.spaceProgram
        || prog?.spaceportBuilt
        || prog?.spaceAccess?.launchReady
        || prog?.spaceAccess?.dockingRights
      );
    });
  }

  evaluateActivation(force = false) {
    if (this.active) return true;
    if (!force && !this._canUnlockSpace()) return false;
    const currentDay = _bqBearCurrentDay(_bqBearRoot());
    this.active = true;
    this.dayStarted = currentDay;
    this.lastProcessedDay = currentDay;
    this._updateVisibility();
    this._notify('Galactic reports warn that bear tribute fleets are mobilizing beyond known space.', 'warning');
    this._appendFeed('crisis_awakened', 'The Bear Empire begins to move in the outer systems.');
    return true;
  }

  _pruneInvalidSystems() {
    const valid = new Set(this._systemKeys());
    const filterKeys = (list) => _bqBearUnique(list).filter((key) => valid.has(key));
    this.systemsControlled = filterKeys(this.systemsControlled);
    this.systemsThreatened = filterKeys(this.systemsThreatened);
    this.knownBearSystems = filterKeys(this.knownBearSystems);
    this.knownResistanceSystems = filterKeys(this.knownResistanceSystems);
    this.resistanceCells = filterKeys(this.resistanceCells);
    if (!valid.has(this.capitalSystemKey)) {
      this.capitalSystemKey = this.systemsControlled[0] || this._playableSystemKeys()[0] || null;
    }
    if (this.capitalSystemKey && !this.systemsControlled.includes(this.capitalSystemKey)) {
      this.systemsControlled.unshift(this.capitalSystemKey);
    }
  }

  _updateAlignment() {
    if (this.bearStanding >= 10 && this.resistanceStanding >= 10) {
      this.alignment = 'double_dealing';
      return;
    }
    if (this.bearStanding >= this.resistanceStanding + 6 && this.bearStanding >= 8) {
      this.alignment = 'bear_aligned';
      return;
    }
    if (this.resistanceStanding >= this.bearStanding + 6 && this.resistanceStanding >= 8) {
      this.alignment = 'resistance_aligned';
      return;
    }
    this.alignment = 'neutral';
  }

  _updateVisibility() {
    if (!this.active) {
      this.knownBearSystems = [];
      this.knownResistanceSystems = [];
      return;
    }

    const depths = this._depths();
    const knownBear = new Set(_bqBearUnique(this.knownBearSystems));
    const revealBudget = Math.max(
      1,
      Math.floor(this.visibilityLevel * 6)
      + Math.floor(this.intelPoints / 2)
      + Math.floor(this.spreadCounter / 2)
    );

    const threatened = this.systemsThreatened
      .slice()
      .sort((a, b) => (depths.get(a) || 0) - (depths.get(b) || 0));
    const occupied = this.systemsControlled
      .filter((key) => key !== this.capitalSystemKey)
      .slice()
      .sort((a, b) => (depths.get(a) || 0) - (depths.get(b) || 0));

    for (const key of threatened) {
      if (knownBear.size >= revealBudget) break;
      knownBear.add(key);
    }
    for (const key of occupied) {
      if (knownBear.size >= revealBudget + 1) break;
      knownBear.add(key);
    }
    if (this.raymondRevealed && this.capitalSystemKey) {
      knownBear.add(this.capitalSystemKey);
    }
    this.knownBearSystems = [...knownBear];

    const knownResistance = new Set(_bqBearUnique(this.knownResistanceSystems));
    for (const key of this.resistanceCells) knownResistance.add(key);
    this.knownResistanceSystems = [...knownResistance];
  }

  _recomputeState() {
    this._pruneInvalidSystems();
    this.empireStrength = Math.max(
      10,
      (this.systemsControlled.length * 14)
      + (this.systemsThreatened.length * 6)
      + Math.max(0, this.spreadCounter * 2)
      + Math.max(0, this.bearStanding)
    );
    this.resistanceStrength = Math.max(
      4,
      (this.resistanceCells.length * 10)
      + Math.max(0, this.resistanceStanding)
      + Math.floor(this.intelPoints / 2)
    );
    this.difficultyTier = 1 + Math.floor(this.systemsControlled.length / 2);
    this.visibilityLevel = _bqBearClamp(this.visibilityLevel, 0, 1);
    this._updateAlignment();
    this._updateVisibility();
  }

  _expandThreats(dayNumber) {
    const adjacency = this._adjacency();
    const controlled = new Set(this.systemsControlled);
    const threatened = new Set(this.systemsThreatened);
    const candidates = [];
    for (const key of this.systemsControlled) {
      for (const neighbor of adjacency.get(key) || []) {
        if (!neighbor || neighbor === 'orbit') continue;
        if (controlled.has(neighbor) || threatened.has(neighbor)) continue;
        candidates.push(neighbor);
      }
    }
    const ranked = _bqBearSortKeys(candidates, this.seed + dayNumber + this.spreadCounter, 'spread');
    const depthMap = this._depths();
    ranked.sort((a, b) => {
      const depthA = depthMap.get(a) || 0;
      const depthB = depthMap.get(b) || 0;
      if (depthA !== depthB) return depthA - depthB;
      return String(a).localeCompare(String(b));
    });
    return ranked.slice(0, Math.min(2, ranked.length));
  }

  _advanceSpread(dayNumber) {
    const graph = this._graph();
    if (!graph.systems || Object.keys(graph.systems).length === 0) {
      return { occupied: [], threatened: [] };
    }

    const occupiedNow = [];
    const threatenedNow = [];
    const reliefLost = [];
    const pressure = this.systemsThreatened.slice();
    if (pressure.length > 0) {
      const ranked = _bqBearSortKeys(pressure, this.seed + dayNumber, 'occupy');
      const target = ranked[0];
      const resistancePenalty = this.resistanceCells.includes(target) ? 0.35 : 0;
      const force = _bqBearScore(this.seed + dayNumber, `occupation-force:${target}`) - resistancePenalty;
      if (force >= 0.35) {
        this.systemsThreatened = this.systemsThreatened.filter((key) => key !== target);
        if (!this.systemsControlled.includes(target)) this.systemsControlled.push(target);
        occupiedNow.push(target);
        if (this.resistanceCells.includes(target) && force >= 0.7) {
          this.resistanceCells = this.resistanceCells.filter((key) => key !== target);
          reliefLost.push(target);
        }
      }
    }

    const newThreats = this._expandThreats(dayNumber);
    for (const key of newThreats) {
      if (!this.systemsThreatened.includes(key) && !this.systemsControlled.includes(key)) {
        this.systemsThreatened.push(key);
        threatenedNow.push(key);
      }
    }

    if (!this.raymondRevealed && (this.intelPoints >= 8 || this.systemsControlled.length >= 4 || this.spreadCounter >= 6)) {
      this.raymondRevealed = true;
    }

    this.visibilityLevel += 0.09;
    this.tributeCollected += this.systemsControlled.length * 30;
    this.spreadCounter += 1;
    this._recomputeState();

    return {
      occupied: occupiedNow,
      threatened: threatenedNow,
      lostResistanceCells: reliefLost,
    };
  }

  onDayChanged(dayNumber = null) {
    this.evaluateActivation();
    if (!this.active || this.raymondDefeated) return { ok: false, reason: 'inactive' };

    const resolvedDay = Number.isFinite(Number(dayNumber))
      ? Math.max(0, Math.floor(Number(dayNumber)))
      : _bqBearCurrentDay(_bqBearRoot());
    if (resolvedDay <= this.lastProcessedDay) return { ok: true, event: 'noop' };

    const occupied = [];
    const threatened = [];
    const lostResistanceCells = [];
    for (let day = this.lastProcessedDay + 1; day <= resolvedDay; day++) {
      this.lastProcessedDay = day;
      this._pruneIncidents(day);
      if (((day - this.dayStarted) % this.spreadIntervalDays) !== 0) continue;
      const step = this._advanceSpread(day);
      occupied.push(...step.occupied);
      threatened.push(...step.threatened);
      lostResistanceCells.push(...step.lostResistanceCells);
    }

    const incident = this._rollContextIncident(resolvedDay);

    if (occupied.length > 0) {
      const label = this._systemLabel(occupied[0]);
      this._notify(`Bear fleets occupied ${label}${occupied.length > 1 ? ` and ${occupied.length - 1} more system${occupied.length === 2 ? '' : 's'}` : ''}.`, 'warning');
      this._appendFeed('occupied', `Bear fleets occupied ${label}.`, { systems: occupied.slice() });
    } else if (threatened.length > 0) {
      const label = this._systemLabel(threatened[0]);
      this._notify(`Distress traffic reports bear pressure building around ${label}.`, 'info');
      this._appendFeed('threatened', `Bear scouts were sighted near ${label}.`, { systems: threatened.slice() });
    }

    if (lostResistanceCells.length > 0) {
      this._appendFeed('resistance_lost', `A DK Resistance cell was overrun in ${this._systemLabel(lostResistanceCells[0])}.`, {
        systems: lostResistanceCells.slice(),
      });
    }

    return {
      ok: true,
      event: occupied.length > 0 ? 'occupied' : threatened.length > 0 ? 'threatened' : 'idle',
      occupied,
      threatened,
      lostResistanceCells,
      incident,
    };
  }

  _systemLabel(nodeKey) {
    const system = this._graph().systems?.[nodeKey];
    return system?.label || nodeKey || 'unknown space';
  }

  _pruneIncidents(currentDay = this.lastProcessedDay) {
    const validSystems = new Set(this._systemKeys());
    const expired = [];
    this.pendingIncidents = (Array.isArray(this.pendingIncidents) ? this.pendingIncidents : []).filter((incident) => {
      if (!incident?.id || !validSystems.has(incident.nodeKey)) return false;
      const expiresDay = Math.floor(Number(incident.expiresDay) || 0);
      if (expiresDay > 0 && currentDay > expiresDay) {
        expired.push(incident);
        return false;
      }
      return true;
    });
    for (const incident of expired) {
      this._appendFeed(
        'incident_expired',
        `${incident.title || 'A war incident'} expired in ${this._systemLabel(incident.nodeKey)}.`,
        { system: incident.nodeKey, incidentType: incident.type }
      );
    }
  }

  _buildIncident(nodeKey, type, dayNumber) {
    const label = this._systemLabel(nodeKey);
    const suffix = Math.floor(this._incidentSeed(dayNumber, nodeKey, `${type}:id`) * 100000).toString(36);
    const incident = {
      id: `${type}_${dayNumber}_${suffix}`,
      nodeKey,
      day: dayNumber,
      expiresDay: dayNumber + 4,
      passScore: 64,
    };

    if (type === 'resistance_aid') {
      return {
        ...incident,
        type,
        title: 'Aid Corridor Sprint',
        subtitle: `DK Resistance couriers are trying to punch relief cargo into ${label}. Keep the corridor open long enough for the convoy to slip through.`,
        summary: 'A resistance convoy needs a clean aid window before the bears lock the system down.',
        rewardText: '+Resistance standing · +intel · chance to relieve pressure',
        riskText: 'Failure lets the bears tighten the corridor',
        autopilotText: 'Tactical Autopilot threaded the aid corridor',
        eyebrow: 'RESISTANCE INCIDENT',
        qte: {
          kind: 'space_resistance_aid',
          seed: `${this.seed}:${nodeKey}:${dayNumber}:aid`,
          sequenceLength: 4,
          timeLimitMs: 4300,
          passScore: 64,
        },
      };
    }

    if (type === 'bear_inspection') {
      return {
        ...incident,
        type,
        title: 'Tribute Inspection Sweep',
        subtitle: `Bear inspectors are shaking down ships near ${label}. Juke the scan pattern before they freeze your hold for "tribute review".`,
        summary: 'Bear patrols are sweeping cargo lanes and skimming tribute from slow captains.',
        rewardText: 'Good evasion denies tribute and leaks intel',
        riskText: 'Failure costs gold and strengthens the bears',
        autopilotText: 'Tactical Autopilot slipped through the inspection net',
        eyebrow: 'BEAR INCIDENT',
        passScore: 66,
        qte: {
          kind: 'space_bear_inspection',
          seed: `${this.seed}:${nodeKey}:${dayNumber}:inspection`,
          sequenceLength: 4,
          timeLimitMs: 3900,
          passScore: 66,
        },
      };
    }

    return {
      ...incident,
      type: 'signal_trace',
      title: "Raymond Signal Trace",
      subtitle: `DK Resistance analysts found a weak command echo near ${label}. Nail the pulse sequence before the bears scrub the trace.`,
      summary: "A live command-signal spike might expose Raymond's capital.",
      rewardText: '+Major intel · can reveal Raymond early',
      riskText: 'Failure burns the trace and wastes the window',
      autopilotText: 'Tactical Autopilot stabilized the signal trace',
      eyebrow: 'SIGNAL TRACE',
      passScore: 68,
      qte: {
        kind: 'space_signal_trace',
        seed: `${this.seed}:${nodeKey}:${dayNumber}:signal`,
        sequenceLength: 5,
        timeLimitMs: 3600,
        passScore: 68,
      },
    };
  }

  _queueIncident(incident) {
    if (!incident?.id || !incident.nodeKey) return null;
    const duplicate = this.pendingIncidents.find((entry) => entry.nodeKey === incident.nodeKey && entry.type === incident.type);
    if (duplicate) return duplicate;
    this.pendingIncidents.push(incident);
    if (this.pendingIncidents.length > 8) this.pendingIncidents = this.pendingIncidents.slice(-8);
    this._notify(`${incident.title} detected in ${this._systemLabel(incident.nodeKey)}.`, incident.type === 'bear_inspection' ? 'warning' : 'info');
    this._appendFeed('incident', `${incident.title} is live in ${this._systemLabel(incident.nodeKey)}.`, {
      system: incident.nodeKey,
      incidentType: incident.type,
      incidentId: incident.id,
    });
    return incident;
  }

  _rollContextIncident(dayNumber) {
    if (!this.active || this.raymondDefeated) return null;
    const nodeKey = this._currentContextNodeKey();
    if (!nodeKey || nodeKey === 'orbit') return null;
    const status = this.getSystemStatus(nodeKey);
    if (!status || !(status.occupied || status.threatened || status.resistanceCell)) return null;
    if (this.pendingIncidents.some((incident) => incident.nodeKey === nodeKey)) return null;

    const options = [];
    if (!this.raymondRevealed && this.intelPoints >= 4 && (status.resistanceCell || status.threatened)) {
      options.push({
        type: 'signal_trace',
        threshold: status.resistanceCell ? 0.45 : 0.62,
      });
    }
    if (status.occupied) {
      options.push({
        type: 'bear_inspection',
        threshold: this.alignment === 'bear_aligned' ? 0.78 : 0.42,
      });
    }
    if (status.occupied || status.threatened || status.resistanceCell) {
      options.push({
        type: 'resistance_aid',
        threshold: status.occupied ? 0.38 : 0.5,
      });
    }

    const ranked = options.sort((a, b) => a.threshold - b.threshold);
    for (const option of ranked) {
      if (this._incidentSeed(dayNumber, nodeKey, option.type) >= option.threshold) {
        return this._queueIncident(this._buildIncident(nodeKey, option.type, dayNumber));
      }
    }
    return null;
  }

  getPendingIncidents(nodeKey = null) {
    const normalized = nodeKey && this._systemKeys().includes(nodeKey) ? nodeKey : null;
    this._pruneIncidents(this.lastProcessedDay);
    return this.pendingIncidents
      .filter((incident) => !normalized || incident.nodeKey === normalized)
      .map((incident) => ({ ...incident }));
  }

  resolveIncident(incidentId, resolution = {}) {
    this.evaluateActivation();
    const index = this.pendingIncidents.findIndex((incident) => incident.id === incidentId);
    if (index < 0) return { ok: false, reason: 'missing_incident' };

    const incident = this.pendingIncidents[index];
    const score = _bqBearClamp(Math.floor(Number(resolution?.score) || 0), 0, 100);
    const passScore = Math.max(0, Math.floor(Number(incident?.qte?.passScore) || Number(incident?.passScore) || 64));
    const nodeKey = incident.nodeKey;
    const label = this._systemLabel(nodeKey);
    const player = this.playerGetter();
    let outcome = 'failed';
    let message = '';

    if (incident.type === 'resistance_aid') {
      if (score >= passScore + 18) {
        this.supportResistance(nodeKey);
        this.recordBlockadeRun(nodeKey, score);
        this.intelPoints += 1;
        outcome = 'breakthrough';
        message = `Resistance aid slipped cleanly into ${label}.`;
      } else if (score >= passScore) {
        this.supportResistance(nodeKey);
        outcome = 'success';
        message = `Aid reached DK Resistance contacts in ${label}.`;
      } else {
        this.bearStanding += 1;
        this.visibilityLevel += 0.02;
        message = `Bear patrols shredded the aid window around ${label}.`;
      }
    } else if (incident.type === 'bear_inspection') {
      if (score >= passScore + 14) {
        this.intelPoints += 2;
        this.resistanceStanding += 1;
        outcome = 'clean';
        message = `You slipped the tribute inspection in ${label} and leaked patrol intel to the DK Resistance.`;
      } else if (score >= passScore) {
        this.intelPoints += 1;
        outcome = 'evaded';
        message = `You dodged the worst of the inspection sweep in ${label}.`;
      } else {
        const goldLoss = Math.max(0, Math.min(Number(player?.gold) || 0, 25 + Math.round((passScore - score) * 1.5)));
        if (goldLoss > 0 && typeof player?.spendGold === 'function') player.spendGold(goldLoss);
        else if (goldLoss > 0 && typeof player?.gold === 'number') player.gold = Math.max(0, player.gold - goldLoss);
        this.supportBears(nodeKey);
        message = `Bear inspectors seized ${goldLoss}g in tribute around ${label}.`;
      }
    } else if (incident.type === 'signal_trace') {
      if (score >= passScore + 12) {
        this.intelPoints += 3;
        this.forceRevealRaymond('live_signal_trace');
        outcome = 'decoded';
        message = `The signal trace from ${label} exposed Raymond's capital.`;
      } else if (score >= passScore) {
        this.intelPoints += 2;
        this.visibilityLevel += 0.08;
        outcome = 'partial';
        message = `You stabilized enough of the command echo near ${label} to sharpen DK Resistance intel.`;
      } else {
        this.bearStanding += 1;
        this._appendFeed('signal_lost', `A Raymond signal trace collapsed near ${label}.`, { system: nodeKey, score });
        message = `The signal trace near ${label} collapsed before the relay locked on.`;
      }
    }

    this.pendingIncidents.splice(index, 1);
    this._recomputeState();
    this._appendFeed('incident_resolved', message, {
      system: nodeKey,
      incidentType: incident.type,
      outcome,
      score,
    });
    return {
      ok: true,
      incident: { ...incident },
      outcome,
      score,
      message,
    };
  }

  _revealNearbyBearSystems(nodeKey, count = 1) {
    const adjacency = this._adjacency();
    const revealed = [];
    const nearby = _bqBearSortKeys(
      [...(adjacency.get(nodeKey) || [])].filter((neighbor) => this.systemsThreatened.includes(neighbor) || this.systemsControlled.includes(neighbor)),
      this.seed + this.intelPoints + this.spreadCounter,
      `reveal:${nodeKey}`
    );
    for (const key of nearby) {
      if (this.knownBearSystems.includes(key)) continue;
      this.knownBearSystems.push(key);
      revealed.push(key);
      if (revealed.length >= count) break;
    }
    return revealed;
  }

  supportResistance(nodeKey) {
    this.evaluateActivation(true);
    if (!nodeKey || nodeKey === 'orbit') return { ok: false, reason: 'invalid_node' };
    const valid = new Set(this._systemKeys());
    if (!valid.has(nodeKey)) return { ok: false, reason: 'unknown_node' };

    let relieved = false;
    if (this.systemsThreatened.includes(nodeKey)) {
      this.systemsThreatened = this.systemsThreatened.filter((key) => key !== nodeKey);
      relieved = true;
    }
    if (!this.resistanceCells.includes(nodeKey)) this.resistanceCells.push(nodeKey);
    if (!this.knownResistanceSystems.includes(nodeKey)) this.knownResistanceSystems.push(nodeKey);

    this.intelPoints += 2;
    this.visibilityLevel += 0.08;
    this.resistanceStanding += 4;
    this.bearStanding = Math.max(-20, this.bearStanding - 1);
    const revealed = this._revealNearbyBearSystems(nodeKey, relieved ? 2 : 1);
    this._recomputeState();

    const label = this._systemLabel(nodeKey);
    this._notify(
      relieved
        ? `DK Resistance pushed the bears back from ${label}.`
        : `Aid delivered to DK Resistance contacts in ${label}.`,
      'success'
    );
    this._appendFeed('aid_run', `Resistance aid landed in ${label}.`, { system: nodeKey, relieved, revealed });
    return { ok: true, nodeKey, relieved, revealed };
  }

  supportBears(nodeKey) {
    this.evaluateActivation(true);
    if (!nodeKey || nodeKey === 'orbit') return { ok: false, reason: 'invalid_node' };
    const valid = new Set(this._systemKeys());
    if (!valid.has(nodeKey)) return { ok: false, reason: 'unknown_node' };

    let escalated = false;
    if (this.resistanceCells.includes(nodeKey)) {
      this.resistanceCells = this.resistanceCells.filter((key) => key !== nodeKey);
      escalated = true;
    }
    if (!this.systemsControlled.includes(nodeKey)) {
      this.systemsThreatened = this.systemsThreatened.filter((key) => key !== nodeKey);
      this.systemsControlled.push(nodeKey);
      escalated = true;
    }
    if (!this.knownBearSystems.includes(nodeKey)) this.knownBearSystems.push(nodeKey);

    this.bearStanding += 4;
    this.resistanceStanding = Math.max(-20, this.resistanceStanding - 2);
    this.visibilityLevel += 0.05;
    this.tributeCollected += 45;
    this._recomputeState();

    const label = this._systemLabel(nodeKey);
    this._notify(
      escalated
        ? `Bear occupiers gained leverage in ${label}.`
        : `Bear tribute officers in ${label} accepted your support.`,
      'warning'
    );
    this._appendFeed('bear_support', `Bear tribute lines were reinforced in ${label}.`, { system: nodeKey, escalated });
    return { ok: true, nodeKey, escalated };
  }

  forceRevealRaymond(reason = 'intel_breakthrough') {
    this.evaluateActivation(true);
    if (!this.active || this.raymondDefeated) return { ok: false, reason: 'inactive' };

    const alreadyRevealed = !!this.raymondRevealed;
    this.raymondRevealed = true;
    this.visibilityLevel = Math.max(this.visibilityLevel, 0.85);
    this.intelPoints = Math.max(this.intelPoints, 8);
    if (this.capitalSystemKey && !this.knownBearSystems.includes(this.capitalSystemKey)) {
      this.knownBearSystems.push(this.capitalSystemKey);
    }
    this._recomputeState();

    if (!alreadyRevealed) {
      const capitalLabel = this._systemLabel(this.capitalSystemKey);
      this._notify(`DK Resistance traced Raymond's capital signal to ${capitalLabel}.`, 'warning');
      this._appendFeed('raymond_revealed', `Raymond the Bear was traced to ${capitalLabel}.`, {
        system: this.capitalSystemKey,
        reason,
      });
    }

    return {
      ok: true,
      alreadyRevealed,
      capitalSystemKey: this.capitalSystemKey,
    };
  }

  markRaymondDefeated() {
    this.raymondDefeated = true;
    this.systemsThreatened = [];
    this._notify('Raymond the Bear has fallen. The empire begins to fracture.', 'success');
    this._appendFeed('raymond_defeated', 'Raymond the Bear was defeated and the empire splintered.');
  }

  getThreatenedSystems() {
    return this.systemsThreatened.slice();
  }

  getOccupiedSystems() {
    return this.systemsControlled.slice();
  }

  getResistanceCells() {
    return this.resistanceCells.slice();
  }

  getKnownBearSystems() {
    return this.knownBearSystems.slice();
  }

  getKnownResistanceSystems() {
    return this.knownResistanceSystems.slice();
  }

  getSystemStatus(nodeKey) {
    if (!nodeKey) return null;
    const occupied = this.systemsControlled.includes(nodeKey);
    const threatened = this.systemsThreatened.includes(nodeKey);
    const resistanceCell = this.resistanceCells.includes(nodeKey);
    const fortified = occupied && this.raymondRevealed && nodeKey === this.capitalSystemKey;
    const bearKnown = this.knownBearSystems.includes(nodeKey) || fortified;
    const resistanceKnown = this.knownResistanceSystems.includes(nodeKey) || resistanceCell;
    let visibility = null;
    if (fortified) visibility = 'fortified';
    else if (occupied && bearKnown) visibility = 'occupied';
    else if (threatened && bearKnown) visibility = 'confirmed';
    else if (bearKnown) visibility = 'rumored';
    return {
      key: nodeKey,
      occupied,
      threatened,
      fortified,
      resistanceCell,
      bearKnown,
      resistanceKnown,
      visibility,
      canAidResistance: this.active && !this.raymondDefeated && nodeKey !== 'orbit',
      canAidBears: this.active && !this.raymondDefeated && nodeKey !== 'orbit',
      tradePenalty: occupied ? 0.18 : threatened ? 0.08 : 0,
      dangerModifier: occupied ? 0.22 : threatened ? 0.1 : 0,
    };
  }

  getRoutePressure(fromNode, toNode) {
    const origin = this.getSystemStatus(fromNode);
    const destination = this.getSystemStatus(toNode);
    const active = !!(this.active && !this.raymondDefeated);
    if (!active) {
      return {
        active: false,
        origin,
        destination,
        dangerBonus: 0,
        fuelSurcharge: 0,
        routeThreat: 'clear',
        alignment: this.alignment,
      };
    }

    const originDanger = Number(origin?.dangerModifier) || 0;
    const destDanger = Number(destination?.dangerModifier) || 0;
    const dangerBonus = _bqBearClamp((originDanger * 0.55) + (destDanger * 0.9), 0, 0.42);
    const fuelSurcharge = Math.max(
      0,
      (destination?.occupied ? 2 : destination?.threatened ? 1 : 0)
      + (origin?.occupied ? 1 : 0)
      + (destination?.fortified ? 1 : 0)
    );

    let routeThreat = 'clear';
    if (destination?.fortified) routeThreat = 'fortified';
    else if (destination?.occupied || origin?.occupied) routeThreat = 'occupied';
    else if (destination?.threatened || origin?.threatened) routeThreat = 'threatened';
    else if (destination?.bearKnown || origin?.bearKnown) routeThreat = 'rumored';

    return {
      active: true,
      origin,
      destination,
      dangerBonus,
      fuelSurcharge,
      routeThreat,
      alignment: this.alignment,
      resistanceKnown: !!(origin?.resistanceKnown || destination?.resistanceKnown),
    };
  }

  recordBlockadeRun(nodeKey, score = 0) {
    this.evaluateActivation();
    if (!this.active) return { ok: false, reason: 'inactive' };

    const resolvedScore = _bqBearClamp(Math.floor(Number(score) || 0), 0, 100);
    const label = this._systemLabel(nodeKey);
    let rating = 'failed';
    if (resolvedScore >= 82) rating = 'breakthrough';
    else if (resolvedScore >= 62) rating = 'success';
    else if (resolvedScore >= 40) rating = 'scraped_through';

    if (rating === 'breakthrough') {
      this.intelPoints += 2;
      this.resistanceStanding += 2;
      this.visibilityLevel += 0.08;
      this._revealNearbyBearSystems(nodeKey, 2);
      this._appendFeed('blockade_break', `A blockade was broken cleanly near ${label}.`, { system: nodeKey, score: resolvedScore });
    } else if (rating === 'success') {
      this.intelPoints += 1;
      this.resistanceStanding += 1;
      this.visibilityLevel += 0.04;
      this._revealNearbyBearSystems(nodeKey, 1);
      this._appendFeed('blockade_run', `A resistance blockade run slipped through ${label}.`, { system: nodeKey, score: resolvedScore });
    } else if (rating === 'scraped_through') {
      this.intelPoints += 1;
      this._appendFeed('blockade_scrape', `A rough blockade run still reached ${label}.`, { system: nodeKey, score: resolvedScore });
    } else {
      this._appendFeed('blockade_fail', `A blockade run near ${label} was mauled by bear patrols.`, { system: nodeKey, score: resolvedScore });
    }

    this._recomputeState();
    return { ok: true, rating, score: resolvedScore };
  }

  getState() {
    return {
      active: !!this.active,
      dayStarted: this.dayStarted,
      lastProcessedDay: this.lastProcessedDay,
      empireStrength: this.empireStrength,
      systemsControlled: this.getOccupiedSystems(),
      systemsThreatened: this.getThreatenedSystems(),
      capitalSystemKey: this.capitalSystemKey,
      raymondRevealed: !!this.raymondRevealed,
      raymondDefeated: !!this.raymondDefeated,
      intelPoints: this.intelPoints,
      visibilityLevel: this.visibilityLevel,
      knownBearSystems: this.getKnownBearSystems(),
      knownResistanceSystems: this.getKnownResistanceSystems(),
      tributeCollected: this.tributeCollected,
      spreadCounter: this.spreadCounter,
      difficultyTier: this.difficultyTier,
      resistanceStrength: this.resistanceStrength,
      alignment: this.alignment,
      bearStanding: this.bearStanding,
      resistanceStanding: this.resistanceStanding,
      resistanceCells: this.getResistanceCells(),
      activityFeed: this.activityFeed.slice(),
      pendingIncidents: this.getPendingIncidents(),
    };
  }

  toJSON() {
    return {
      seed: this.seed,
      spreadIntervalDays: this.spreadIntervalDays,
      active: !!this.active,
      dayStarted: this.dayStarted,
      lastProcessedDay: this.lastProcessedDay,
      empireStrength: this.empireStrength,
      systemsControlled: this.getOccupiedSystems(),
      systemsThreatened: this.getThreatenedSystems(),
      capitalSystemKey: this.capitalSystemKey,
      raymondRevealed: !!this.raymondRevealed,
      raymondDefeated: !!this.raymondDefeated,
      intelPoints: this.intelPoints,
      visibilityLevel: this.visibilityLevel,
      knownBearSystems: this.getKnownBearSystems(),
      knownResistanceSystems: this.getKnownResistanceSystems(),
      tributeCollected: this.tributeCollected,
      spreadCounter: this.spreadCounter,
      difficultyTier: this.difficultyTier,
      resistanceStrength: this.resistanceStrength,
      alignment: this.alignment,
      bearStanding: this.bearStanding,
      resistanceStanding: this.resistanceStanding,
      resistanceCells: this.getResistanceCells(),
      activityFeed: this.activityFeed.slice(),
      pendingIncidents: this.getPendingIncidents(),
    };
  }

  static fromJSON(data, options = {}) {
    const sys = new BearEmpireSystem({
      ...options,
      seed: Number.isFinite(Number(data?.seed)) ? Number(data.seed) : options.seed,
      spreadIntervalDays: Number.isFinite(Number(data?.spreadIntervalDays)) ? Number(data.spreadIntervalDays) : options.spreadIntervalDays,
      skipSeed: true,
      skipActivation: true,
    });

    sys.active = !!data?.active;
    sys.dayStarted = Math.max(0, Math.floor(Number(data?.dayStarted) || 0));
    sys.lastProcessedDay = Math.max(sys.dayStarted, Math.floor(Number(data?.lastProcessedDay) || sys.dayStarted || 0));
    sys.empireStrength = Math.max(0, Math.floor(Number(data?.empireStrength) || 0));
    sys.systemsControlled = _bqBearUnique(data?.systemsControlled);
    sys.systemsThreatened = _bqBearUnique(data?.systemsThreatened);
    sys.capitalSystemKey = (typeof data?.capitalSystemKey === 'string' && data.capitalSystemKey.trim()) ? data.capitalSystemKey.trim() : null;
    sys.raymondRevealed = !!data?.raymondRevealed;
    sys.raymondDefeated = !!data?.raymondDefeated;
    sys.intelPoints = Math.max(0, Math.floor(Number(data?.intelPoints) || 0));
    sys.visibilityLevel = _bqBearClamp(Number(data?.visibilityLevel) || 0, 0, 1);
    sys.knownBearSystems = _bqBearUnique(data?.knownBearSystems);
    sys.knownResistanceSystems = _bqBearUnique(data?.knownResistanceSystems);
    sys.tributeCollected = Math.max(0, Math.floor(Number(data?.tributeCollected) || 0));
    sys.spreadCounter = Math.max(0, Math.floor(Number(data?.spreadCounter) || 0));
    sys.difficultyTier = Math.max(1, Math.floor(Number(data?.difficultyTier) || 1));
    sys.resistanceStrength = Math.max(0, Math.floor(Number(data?.resistanceStrength) || 0));
    sys.alignment = (typeof data?.alignment === 'string' && data.alignment.trim()) ? data.alignment.trim() : 'neutral';
    sys.bearStanding = Math.floor(Number(data?.bearStanding) || 0);
    sys.resistanceStanding = Math.floor(Number(data?.resistanceStanding) || 0);
    sys.resistanceCells = _bqBearUnique(data?.resistanceCells);
    sys.activityFeed = Array.isArray(data?.activityFeed) ? data.activityFeed.slice(0, 24) : [];
    sys.pendingIncidents = Array.isArray(data?.pendingIncidents) ? data.pendingIncidents.slice(0, 8) : [];

    sys._recomputeState();
    sys._pruneIncidents(sys.lastProcessedDay);
    return sys;
  }
}

const _bqBearGlobal = _bqBearRoot();
if (_bqBearGlobal) {
  _bqBearGlobal.BearEmpireSystem = BearEmpireSystem;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BearEmpireSystem };
}
