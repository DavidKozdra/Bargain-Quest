// ui/spaceTravel.js — Full-screen space command view
// Uses the existing screen system and travel-map layout patterns instead of a floating HUD.

(function() {
  'use strict';

  if (typeof uiManager === 'undefined') {
    console.warn('spaceTravel UI: uiManager not found, deferring.');
    return;
  }

  const SPACE_NODE_LAYOUT = Object.freeze({
    orbit:   { x: 0.22, y: 0.56, accent: '#7dc9ff', icon: 'O' },
    luna:    { x: 0.55, y: 0.22, accent: '#d6dfff', icon: 'L' },
    aurelia: { x: 0.77, y: 0.60, accent: '#7ff0b4', icon: 'A' },
    vanta:   { x: 0.46, y: 0.84, accent: '#ff9d7a', icon: 'V' },
  });

  const SPACE_ROUTE_LAYOUT = Object.freeze([
    { from: 'orbit', to: 'luna' },
    { from: 'orbit', to: 'aurelia' },
    { from: 'orbit', to: 'vanta' },
    { from: 'luna', to: 'aurelia' },
    { from: 'luna', to: 'vanta' },
    { from: 'aurelia', to: 'vanta' },
  ]);

  function _sys() {
    return window._spaceTravelSystem
      || (typeof player !== 'undefined' && player?._spaceTravelSystem)
      || null;
  }

  function _ship() {
    const sys = _sys();
    if (sys?.activeShip) return sys.activeShip;
    if (typeof player !== 'undefined' && typeof player.getActiveSpaceShip === 'function') {
      return player.getActiveSpaceShip();
    }
    return null;
  }

  function _spaceCities() {
    if (Array.isArray(window.cities)) return window.cities;
    if (typeof cities !== 'undefined' && Array.isArray(cities)) return cities;
    return [];
  }

  function _findCityByName(name) {
    if (!name || typeof name !== 'string') return null;
    return _spaceCities().find((city) => city && city.name === name) || null;
  }

  function _launchCity() {
    const sys = _sys();
    if (sys?.phase === 'grounded' && window._spaceLaunchCity) return window._spaceLaunchCity;
    if (sys?.launchCity) return sys.launchCity;
    if (window._spaceLaunchCity) return window._spaceLaunchCity;
    const lastLaunchCity = (typeof player !== 'undefined' && player && player.spaceTravel)
      ? player.spaceTravel.lastLaunchCity
      : null;
    return _findCityByName(lastLaunchCity || null);
  }

  function _spaceReturnState() {
    if (window._spaceReturnState) return window._spaceReturnState;
    return window._isCityManageMode ? GameStates.CITY_MANAGE : GameStates.PLAYING;
  }

  function _spaceReturnLabel() {
    return _spaceReturnState() === GameStates.CITY_MANAGE ? 'City Management' : 'Adventure Map';
  }

  function _isPlanetNode(nodeKey) {
    if (!nodeKey || typeof City === 'undefined' || typeof City.getSpacePlanets !== 'function') return false;
    return City.getSpacePlanets().some((planet) => planet.key === nodeKey);
  }

  function _normalizeNodeKey(nodeKey) {
    if (!nodeKey || typeof nodeKey !== 'string') return null;
    return Object.prototype.hasOwnProperty.call(SPACE_NODE_LAYOUT, nodeKey) ? nodeKey : null;
  }

  function _queuedDestination() {
    return _normalizeNodeKey(window._spaceLaunchPlanet || null);
  }

  function _setSelectedNode(nodeKey, syncQueuedPlanet = false) {
    const normalized = _normalizeNodeKey(nodeKey);
    window._spaceSelectedNode = normalized;
    if (syncQueuedPlanet) {
      window._spaceLaunchPlanet = _isPlanetNode(normalized) ? normalized : null;
    }
    return normalized;
  }

  function _getSelectedNode() {
    const sys = _sys();
    const preferred = _normalizeNodeKey(window._spaceSelectedNode)
      || _queuedDestination()
      || _normalizeNodeKey(sys?.targetNode)
      || _normalizeNodeKey(sys?.currentNode)
      || 'orbit';
    window._spaceSelectedNode = preferred;
    return preferred;
  }

  function _nodeMeta(nodeKey) {
    const normalized = _normalizeNodeKey(nodeKey);
    if (!normalized) return null;

    if (normalized === 'orbit') {
      return {
        key: 'orbit',
        label: 'Home Orbit',
        kind: 'Launch Corridor',
        description: 'Stable orbit above your launch city. Re-entry and safe disengage only work from here.',
        accent: SPACE_NODE_LAYOUT.orbit.accent,
      };
    }

    if (normalized === 'luna') {
      return {
        key: 'luna',
        label: 'Luna Station',
        kind: 'Orbital Station',
        description: 'Neutral dockyard for repairs, cargo swaps, and staging deeper routes.',
        accent: SPACE_NODE_LAYOUT.luna.accent,
      };
    }

    const planet = (typeof City !== 'undefined' && typeof City.getSpacePlanets === 'function')
      ? City.getSpacePlanets().find((entry) => entry.key === normalized)
      : null;

    if (!planet) {
      return {
        key: normalized,
        label: normalized,
        kind: 'Unknown Node',
        description: 'Uncharted destination.',
        accent: SPACE_NODE_LAYOUT[normalized]?.accent || '#9fb5ce',
      };
    }

    return {
      key: normalized,
      label: planet.name,
      kind: 'Planet',
      description: planet.description || planet.alienText || 'A catalogued world on your orbital network.',
      accent: SPACE_NODE_LAYOUT[normalized]?.accent || '#9fb5ce',
      alienPresence: planet.alienPresence,
      alienTone: planet.alienTone,
    };
  }

  function _availableRoutesMap() {
    const sys = _sys();
    const routes = (sys && sys.phase === 'in_orbit' && typeof sys.getAvailableRoutes === 'function')
      ? sys.getAvailableRoutes()
      : [];
    return new Map(routes.map((route) => [route.destination, route]));
  }

  function _selectedRoute() {
    const selected = _getSelectedNode();
    return _availableRoutesMap().get(selected) || null;
  }

  function _routeBetween(nodeA, nodeB) {
    if (!nodeA || !nodeB || nodeA === nodeB) return null;
    const available = _availableRoutesMap();
    if (available.has(nodeB) && _sys()?.currentNode === nodeA) return available.get(nodeB);
    if (available.has(nodeA) && _sys()?.currentNode === nodeB) return available.get(nodeA);
    const sys = _sys();
    const state = sys?.getState ? sys.getState() : null;
    const fromCurrent = Array.isArray(state?.availableRoutes)
      ? state.availableRoutes.find((route) => route.destination === nodeB)
      : null;
    if (fromCurrent && sys?.currentNode === nodeA) return fromCurrent;
    return null;
  }

  function _phaseCopy(phase) {
    switch (phase) {
      case 'grounded':
        return {
          label: 'Grounded',
          summary: 'Ground crew is active. Prep your ship, pick a destination, and launch when ready.',
        };
      case 'launch_prep':
      case 'ascending':
        return {
          label: 'Launching',
          summary: 'Launch sequence is active. Complete the ascent to enter orbit.',
        };
      case 'in_orbit':
        return {
          label: 'In Orbit',
          summary: 'Use the orbital chart to inspect reachable nodes and plot your next burn.',
        };
      case 'en_route':
        return {
          label: 'En Route',
          summary: 'Your ship is committed to the current transfer. Track progress from the chart.',
        };
      case 'docking':
        return {
          label: 'Docking',
          summary: 'Docking alignment is in progress. Hold steady until the approach resolves.',
        };
      case 'landed':
        return {
          label: 'Landed',
          summary: 'Surface operations are complete. Lift off to rejoin the orbital network.',
        };
      case 'reentry':
        return {
          label: 'Re-entry',
          summary: 'Atmospheric descent is active. Complete re-entry before leaving the command screen.',
        };
      default:
        return {
          label: 'Space Command',
          summary: 'Monitor launch readiness, route choices, and return windows from a single screen.',
        };
    }
  }

  function _syncLegacySpaceState() {
    if (typeof player === 'undefined' || !player) return;
    player.spaceTravel = player.spaceTravel || {};
    const sys = _sys();
    const launchCity = _launchCity();
    const launchCityName = launchCity?.name || player.spaceTravel.lastLaunchCity || null;
    if (launchCityName) player.spaceTravel.lastLaunchCity = launchCityName;

    if (!sys || sys.phase === 'grounded') {
      if (typeof player.returnFromSpace === 'function') player.returnFromSpace();
      if (launchCityName) player.spaceTravel.lastLaunchCity = launchCityName;
      return;
    }

    player.spaceTravel.currentCity = launchCityName;
    const orbitalPhase = sys.phase === 'in_orbit'
      || sys.phase === 'en_route'
      || sys.phase === 'docking'
      || sys.phase === 'reentry';
    const landedPlanet = sys.phase === 'landed' && _isPlanetNode(sys.currentNode);

    player.spaceTravel.inOrbit = orbitalPhase;
    player.spaceTravel.currentPlanet = landedPlanet ? sys.currentNode : (orbitalPhase ? 'orbit' : null);

    if (landedPlanet) {
      if (!Array.isArray(player.spaceTravel.visitedPlanets)) player.spaceTravel.visitedPlanets = [];
      if (!player.spaceTravel.visitedPlanets.includes(sys.currentNode)) {
        player.spaceTravel.visitedPlanets.push(sys.currentNode);
      }
    }
  }

  function _unlockCurrentPlanet() {
    const sys = _sys();
    const launchCity = _launchCity();
    if (!sys || !_isPlanetNode(sys.currentNode)) return;
    if (typeof player !== 'undefined' && typeof player.visitPlanet === 'function') {
      player.visitPlanet(sys.currentNode);
    }
    if (launchCity && typeof launchCity.unlockPlanet === 'function') {
      launchCity.unlockPlanet(sys.currentNode, player);
    }
  }

  function _leaveSpaceScreen() {
    const sys = _sys();
    if (sys && sys.phase !== 'grounded') {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('Return to ground before leaving Space Command.', 'info');
      }
      return { ok: false, reason: 'not_grounded' };
    }
    window._spaceSelectedNode = null;
    if (typeof player !== 'undefined' && player && typeof player.returnFromSpace === 'function') {
      player.returnFromSpace();
    }
    if (typeof gameStateManager !== 'undefined') gameStateManager.setState(_spaceReturnState());
    return { ok: true };
  }

  function _attemptLaunch() {
    const sys = _sys();
    const ship = _ship();
    const city = _launchCity();
    if (!sys || !ship || !city) return;

    const result = sys.beginLaunch(city, ship, player);
    if (!result.ok) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Launch failed: ${result.reason}`, 'warning');
      }
      return;
    }

    const confirm = sys.confirmLaunch();
    if (!confirm.ok) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Launch failed: ${confirm.reason}`, 'warning');
      }
      return;
    }

    const onLaunchResolved = (qteResult) => {
      sys.completeAscent(!!qteResult.success);
      if (qteResult.success && qteResult.fuelSaved > 0) ship.refuel(qteResult.fuelSaved);
      if (qteResult.success && typeof player !== 'undefined' && typeof player.launchToSpace === 'function') {
        player.launchToSpace(city);
      }
      _syncLegacySpaceState();
      if (typeof notificationManager !== 'undefined') {
        const queued = _queuedDestination();
        const queuedCopy = queued ? ` ${_nodeMeta(queued)?.label || queued} is selected on the chart.` : '';
        const msg = qteResult.perfect
          ? `Perfect launch.${queuedCopy}`
          : qteResult.success
            ? `Launch successful.${queuedCopy}`
            : 'Launch was rough. Fuel burned during ascent.';
        notificationManager.log(msg.trim(), qteResult.success ? 'success' : 'warning');
      }
      _refreshSpaceUI();
    };

    if (typeof minigameManager !== 'undefined') {
      minigameManager.launch('spaceLaunch', {}, onLaunchResolved);
      return;
    }

    onLaunchResolved({ success: true, perfect: false, fuelSaved: 0 });
  }

  function _attemptTravelToSelected() {
    const sys = _sys();
    const route = _selectedRoute();
    if (!sys || !route) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('Select a reachable node on the chart first.', 'warning');
      }
      return;
    }
    const result = sys.beginRoute(route.destination);
    if (!result.ok) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Route failed: ${result.reason}`, 'warning');
      }
      return;
    }
    window._spaceSelectedNode = route.destination;
    if (!_isPlanetNode(route.destination)) window._spaceLaunchPlanet = null;
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Transfer burn started for ${route.destination}. Fuel used: ${result.fuelUsed}.`, 'info');
    }
    _refreshSpaceUI();
  }

  function _attemptReentry() {
    const sys = _sys();
    if (!sys) return;
    const result = sys.beginReentry();
    if (!result.ok) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Re-entry failed: ${result.reason}`, 'warning');
      }
      return;
    }

    const onReentryResolved = (qteResult) => {
      sys.completeReentry(!!qteResult.success, qteResult.heatDamage);
      _syncLegacySpaceState();
      if (typeof notificationManager !== 'undefined') {
        const msg = qteResult.success
          ? (qteResult.heatDamage > 0
            ? `Re-entry successful. Hull stress: ${qteResult.heatDamage}%.`
            : 'Re-entry complete. Ground crew has control again.')
          : `Re-entry damage: ${qteResult.heatDamage}% hull lost.`;
        notificationManager.log(msg, qteResult.success ? 'success' : 'warning');
      }
      if (typeof gameStateManager !== 'undefined') gameStateManager.setState(_spaceReturnState());
    };

    if (typeof minigameManager !== 'undefined') {
      minigameManager.launch('spaceReentry', { duration: 6000 }, onReentryResolved);
      return;
    }

    onReentryResolved({ success: true, heatDamage: 0 });
  }

  function _attemptLiftOff() {
    const sys = _sys();
    if (!sys) return;
    const result = sys.liftOff();
    if (!result.ok) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Lift-off failed: ${result.reason}`, 'warning');
      }
      return;
    }
    _syncLegacySpaceState();
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log('Lift-off complete. Back in local orbit.', 'info');
    }
    _refreshSpaceUI();
  }

  function _attemptEmergencyReturn() {
    const sys = _sys();
    if (!sys) return;
    if (!confirm('Emergency return will damage your ship. Continue?')) return;
    sys.emergencyReturn();
    _syncLegacySpaceState();
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log('Emergency return triggered. Mission aborted and hull damage taken.', 'warning');
    }
    if (typeof gameStateManager !== 'undefined') gameStateManager.setState(_spaceReturnState());
  }

  function _attemptRefuel() {
    const ship = _ship();
    if (!ship || typeof player === 'undefined' || !player) return;
    const refuelAmount = ship.getEffectiveFuelCapacity() - ship.fuel;
    const cost = ship.getRefuelCost(refuelAmount);
    if (refuelAmount <= 0 || player.gold < cost) return;
    if (typeof player.spendGold === 'function') player.spendGold(cost);
    else player.gold -= cost;
    ship.refuel(refuelAmount);
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Refueled ${refuelAmount} units for ${cost}g.`, 'success');
    }
    _refreshSpaceUI();
  }

  function _attemptRepair() {
    const ship = _ship();
    if (!ship || typeof player === 'undefined' || !player) return;
    const repairCost = ship.getRepairCost();
    if (ship.condition >= 100 || player.gold < repairCost.goldOnly) return;
    if (typeof player.spendGold === 'function') player.spendGold(repairCost.goldOnly);
    else player.gold -= repairCost.goldOnly;
    ship.repair(100);
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Ship fully repaired for ${repairCost.goldOnly}g.`, 'success');
    }
    _refreshSpaceUI();
  }

  function _attemptShipPurchase(type) {
    if (typeof player === 'undefined' || !player || typeof player.buySpaceShip !== 'function') return;
    const result = player.buySpaceShip(type);
    if (result.ok) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Purchased ${result.ship.name} (${result.ship.displayName}).`, 'success');
      }
      const sys = _sys();
      if (sys) sys.activeShip = result.ship;
      _refreshSpaceUI();
    }
  }

  function _button(parent, label, enabled, onClick, extraClass = 'travel-map-go-btn') {
    const btn = createButton(label).parent(parent);
    btn.addClass(enabled ? extraClass : `${extraClass} travel-map-go-btn-disabled`);
    if (enabled) {
      btn.mousePressed(onClick);
    } else {
      btn.attribute('disabled', 'true');
    }
    return btn;
  }

  function _renderStatCard(parent, label, value, copy) {
    const card = createDiv().parent(parent).addClass('space-command-stat-card');
    createDiv(label).parent(card).addClass('space-command-stat-label');
    createDiv(value).parent(card).addClass('space-command-stat-value');
    if (copy) createDiv(copy).parent(card).addClass('space-command-stat-copy');
    return card;
  }

  function _renderMetric(parent, label, value) {
    const metric = createDiv().parent(parent).addClass('space-command-metric');
    createDiv(label).parent(metric).addClass('space-command-metric-label');
    createDiv(value).parent(metric).addClass('space-command-metric-value');
    return metric;
  }

  function _drawSpaceChart(canvas) {
    const sys = _sys();
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const currentNode = _normalizeNodeKey(sys?.currentNode);
    const targetNode = _normalizeNodeKey(sys?.targetNode);
    const selectedNode = _getSelectedNode();
    const queuedNode = _queuedDestination();
    const availableRoutes = _availableRoutesMap();

    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0f1b30');
    gradient.addColorStop(0.5, '#0a111d');
    gradient.addColorStop(1, '#060b13');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 40; i += 1) {
      const starX = ((i * 53) % width) + 6;
      const starY = ((i * 97) % height) + 4;
      const alpha = 0.18 + ((i % 5) * 0.1);
      ctx.fillStyle = `rgba(255,255,255,${Math.min(alpha, 0.72)})`;
      ctx.fillRect(starX, starY, 2, 2);
    }

    const pointFor = (nodeKey) => {
      const layout = SPACE_NODE_LAYOUT[nodeKey];
      return {
        x: layout.x * width,
        y: layout.y * height,
      };
    };

    for (const edge of SPACE_ROUTE_LAYOUT) {
      const from = pointFor(edge.from);
      const to = pointFor(edge.to);
      const isCurrentRoute = currentNode && (
        (edge.from === currentNode && edge.to === targetNode)
        || (edge.to === currentNode && edge.from === targetNode)
      );
      const isSelectedRoute = currentNode && selectedNode && (
        (edge.from === currentNode && edge.to === selectedNode)
        || (edge.to === currentNode && edge.from === selectedNode)
      );
      const isReachable = currentNode && (
        (edge.from === currentNode && availableRoutes.has(edge.to))
        || (edge.to === currentNode && availableRoutes.has(edge.from))
      );

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.lineWidth = isCurrentRoute ? 4 : isSelectedRoute ? 3 : 2;
      ctx.strokeStyle = isCurrentRoute
        ? 'rgba(255, 208, 105, 0.95)'
        : isSelectedRoute
          ? 'rgba(125, 201, 255, 0.92)'
          : isReachable
            ? 'rgba(125, 201, 255, 0.42)'
            : 'rgba(255, 255, 255, 0.12)';
      if (!isReachable && !isSelectedRoute && !isCurrentRoute) ctx.setLineDash([8, 8]);
      ctx.stroke();
      ctx.restore();
    }

    for (const [nodeKey, layout] of Object.entries(SPACE_NODE_LAYOUT)) {
      const meta = _nodeMeta(nodeKey);
      const point = pointFor(nodeKey);
      const isCurrent = currentNode === nodeKey;
      const isSelected = selectedNode === nodeKey;
      const isQueued = queuedNode === nodeKey;
      const isTarget = targetNode === nodeKey;
      const isReachable = availableRoutes.has(nodeKey);
      const radius = isCurrent ? 15 : 12;

      if (isSelected || isCurrent || isQueued) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + 7, 0, Math.PI * 2);
        ctx.fillStyle = isCurrent
          ? 'rgba(255, 208, 105, 0.24)'
          : isQueued
            ? 'rgba(84, 196, 138, 0.18)'
            : 'rgba(125, 201, 255, 0.18)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = layout.accent;
      ctx.fill();
      ctx.lineWidth = isTarget ? 3 : 2;
      ctx.strokeStyle = isTarget ? '#ffd069' : isReachable || isCurrent ? '#f3f8ff' : 'rgba(255,255,255,0.28)';
      ctx.stroke();

      ctx.fillStyle = '#04111b';
      ctx.font = '700 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(layout.icon, point.x, point.y);

      ctx.fillStyle = isSelected ? '#f7fbff' : '#b8c9de';
      ctx.font = isSelected ? '700 12px sans-serif' : '600 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(meta?.label || nodeKey, point.x, point.y + radius + 10);
    }
  }

  function _renderHeader(parent) {
    const sys = _sys();
    const launchCity = _launchCity();
    const phase = _phaseCopy(sys?.phase || 'grounded');
    const header = createDiv().parent(parent).addClass('space-command-header');

    const titleCol = createDiv().parent(header);
    createDiv(`Orbital Network • ${launchCity?.name || 'No Launch Site'}`)
      .parent(titleCol)
      .addClass('space-command-eyebrow');
    createElement('h2', 'Space Command').parent(titleCol).addClass('space-command-title');
    createP(phase.summary).parent(titleCol).addClass('space-command-subtitle');

    const actionCol = createDiv().parent(header).addClass('space-command-header-actions');
    const canLeave = !sys || sys.phase === 'grounded';
    _button(
      actionCol,
      canLeave ? `Back to ${_spaceReturnLabel()}` : 'Ground To Leave',
      canLeave,
      _leaveSpaceScreen,
      canLeave ? 'space-command-nav-btn' : 'space-command-nav-btn space-command-nav-btn-disabled'
    );
  }

  function _renderMissionStrip(parent) {
    const sys = _sys();
    const ship = _ship();
    const launchCity = _launchCity();
    const phase = _phaseCopy(sys?.phase || 'grounded');
    const selectedNode = _getSelectedNode();
    const selectedMeta = _nodeMeta(selectedNode);
    const grid = createDiv().parent(parent).addClass('space-command-stat-grid');

    _renderStatCard(grid, 'Mission Phase', phase.label, sys?.currentNode ? `Current node: ${sys.currentNode}` : 'Ship is on the pad.');
    _renderStatCard(grid, 'Launch Site', launchCity?.name || 'Unset', launchCity ? 'Ground services, research, and treasury routes key off this city.' : 'Pick an owned city with a spaceport.');
    _renderStatCard(
      grid,
      'Active Ship',
      ship ? `${ship.displayName} • ${ship.condition}%` : 'No Ship Selected',
      ship
        ? `Fuel ${ship.fuel}/${ship.getEffectiveFuelCapacity ? ship.getEffectiveFuelCapacity() : ship.fuelCapacity} · Cargo ${ship.getStorageWeight ? ship.getStorageWeight() : 0}/${ship.getStorageCapacity ? ship.getStorageCapacity() : ship.cargoBonus}`
        : 'Buy a ship from ground control to start space travel.'
    );
    _renderStatCard(
      grid,
      window._spaceLaunchPlanet ? 'Queued Destination' : 'Chart Focus',
      selectedMeta?.label || 'Home Orbit',
      window._spaceLaunchPlanet
        ? 'Queued from city management. Launch first, then burn when ready.'
        : 'Use the chart to inspect a node and expose route options.'
    );
  }

  function _renderSelectedNodeCard(parent) {
    const sys = _sys();
    const selectedNode = _getSelectedNode();
    const selectedMeta = _nodeMeta(selectedNode);
    const route = _selectedRoute();
    const card = createDiv().parent(parent).addClass('space-command-card');
    createElement('h3', selectedMeta?.label || 'Orbital Node').parent(card).addClass('space-command-card-title');
    createP(selectedMeta?.description || 'Select a node to inspect route details.').parent(card).addClass('space-command-card-copy');

    const chips = createDiv().parent(card).addClass('space-command-chip-row');
    const kindChip = createSpan(selectedMeta?.kind || 'Node').parent(chips).addClass('space-command-chip');
    if (sys?.currentNode === selectedNode) createSpan('Current Position').parent(chips).addClass('space-command-chip space-command-chip-success');
    if (sys?.targetNode === selectedNode) createSpan('Transfer Locked').parent(chips).addClass('space-command-chip space-command-chip-alert');
    if (_queuedDestination() === selectedNode && sys?.phase === 'grounded') {
      createSpan('Queued').parent(chips).addClass('space-command-chip');
    }

    if (selectedMeta?.alienPresence) {
      const alienChip = createSpan(`Alien Presence: ${selectedMeta.alienPresence}`).parent(chips);
      alienChip.addClass('space-command-chip');
    }

    const metrics = createDiv().parent(card).addClass('space-command-metrics');
    if (route) {
      _renderMetric(metrics, 'Distance', String(route.distance));
      _renderMetric(metrics, 'Fuel', String(route.fuelCost));
      _renderMetric(metrics, 'Danger', `${Math.round(route.dangerRating * 100)}%`);
    } else if (selectedNode === 'orbit') {
      _renderMetric(metrics, 'Function', 'Re-entry');
      _renderMetric(metrics, 'Status', sys?.currentNode === 'orbit' ? 'Ready' : 'Route Home');
      _renderMetric(metrics, 'Node Type', 'Safe');
    } else {
      _renderMetric(metrics, 'Node Type', selectedMeta?.kind || 'Unknown');
      _renderMetric(metrics, 'Status', sys?.currentNode === selectedNode ? 'On Site' : 'Inspect');
      _renderMetric(metrics, 'Phase', _phaseCopy(sys?.phase || 'grounded').label);
    }

    void kindChip;
  }

  function _renderRouteList(parent) {
    const sys = _sys();
    if (!sys || sys.phase !== 'in_orbit') return;
    const routes = sys.getAvailableRoutes();
    const card = createDiv().parent(parent).addClass('space-command-card');
    createElement('h4', 'Reachable Nodes').parent(card).addClass('space-command-card-title');
    createP('This mirrors the existing map flow: inspect on the chart, then commit from the sidebar.').parent(card).addClass('space-command-card-copy');

    if (!routes.length) {
      createDiv('No orbital transfers are available from this node.').parent(card).addClass('space-command-empty');
      return;
    }

    const list = createDiv().parent(card).addClass('space-command-route-list');
    const selectedNode = _getSelectedNode();
    for (const route of routes) {
      const meta = _nodeMeta(route.destination);
      const row = createDiv().parent(list).addClass('space-command-route-row');
      const copy = createDiv().parent(row).addClass('space-command-route-copy');
      createDiv(meta?.label || route.destination).parent(copy).addClass('space-command-route-title');
      createDiv(`Fuel ${route.fuelCost} · Distance ${route.distance} · Danger ${Math.round(route.dangerRating * 100)}%`).parent(copy).addClass('space-command-route-meta');
      _button(
        row,
        selectedNode === route.destination ? 'Selected' : 'Inspect',
        true,
        () => {
          _setSelectedNode(route.destination, _isPlanetNode(route.destination));
          _refreshSpaceUI();
        },
        selectedNode === route.destination ? 'travel-map-go-btn-secondary' : 'travel-map-go-btn-secondary'
      );
    }
  }

  function _renderActionPanel(parent) {
    const sys = _sys();
    const ship = _ship();
    const playerRef = (typeof player !== 'undefined') ? player : null;
    const route = _selectedRoute();
    const selectedNode = _getSelectedNode();
    const selectedMeta = _nodeMeta(selectedNode);
    const launchCity = _launchCity();
    const card = createDiv().parent(parent).addClass('space-command-card');
    createElement('h4', 'Command Actions').parent(card).addClass('space-command-card-title');
    const copyLine = (() => {
      if (!sys) return 'Space travel system is unavailable.';
      if (sys.phase === 'grounded') return 'Prepare the ship on the ground. Leave the screen only from this phase.';
      if (sys.phase === 'in_orbit') return 'Select a highlighted route or route home for atmospheric re-entry.';
      if (sys.phase === 'landed') return `Surface operations at ${selectedMeta?.label || selectedNode} are complete.`;
      if (sys.phase === 'en_route') return 'The ship is in transfer burn. Only an emergency abort is available.';
      return 'A travel minigame is active. Resolve it before issuing another command.';
    })();
    createP(copyLine).parent(card).addClass('space-command-card-copy');

    const actionStack = createDiv().parent(card).addClass('space-command-action-stack');
    if (!sys) return;

    if (sys.phase === 'grounded') {
      const canLaunch = !!(ship && launchCity && (launchCity.hasSpaceport || launchCity.progression?.spaceAccess?.launchReady));
      _button(actionStack, ship ? 'Launch to Orbit' : 'Ship Required', canLaunch, _attemptLaunch);
      if (ship && ship.fuel < ship.getEffectiveFuelCapacity()) {
        const refuelAmount = ship.getEffectiveFuelCapacity() - ship.fuel;
        _button(actionStack, `Refuel (${ship.getRefuelCost(refuelAmount)}g)`, !!(playerRef && playerRef.gold >= ship.getRefuelCost(refuelAmount)), _attemptRefuel, 'travel-map-go-btn-secondary');
      }
      if (ship && ship.condition < 100) {
        const repairCost = ship.getRepairCost();
        _button(actionStack, `Repair (${repairCost.goldOnly}g)`, !!(playerRef && playerRef.gold >= repairCost.goldOnly), _attemptRepair, 'travel-map-go-btn-secondary');
      }
      return;
    }

    if (sys.phase === 'in_orbit') {
      _button(actionStack, route ? `Plot Course to ${selectedMeta?.label || selectedNode}` : 'Select Reachable Node', !!route, _attemptTravelToSelected);
      const canReenter = sys.currentNode === 'orbit';
      _button(actionStack, canReenter ? 'Return to Ground' : 'Route Home Orbit First', canReenter, _attemptReentry, 'travel-map-go-btn-secondary');
      return;
    }

    if (sys.phase === 'landed') {
      _button(actionStack, 'Lift Off to Local Orbit', true, _attemptLiftOff);
      return;
    }

    if (sys.phase === 'en_route') {
      _button(actionStack, 'Emergency Return', true, _attemptEmergencyReturn, 'travel-map-go-btn-secondary');
      return;
    }

    createDiv('Additional commands unlock after the current sequence resolves.').parent(actionStack).addClass('space-command-empty');
  }

  function _renderGroundServices(parent) {
    const ship = _ship();
    const playerRef = (typeof player !== 'undefined') ? player : null;
    const launchCity = _launchCity();
    const wrap = createDiv().parent(parent).addClass('space-command-support-grid');

    const services = createDiv().parent(wrap).addClass('space-command-card');
    createElement('h4', ship ? 'Ground Services' : 'Shipyard').parent(services).addClass('space-command-card-title');
    createP(
      ship
        ? `Prep ${ship.name} before launch. All ground support is tied to ${launchCity?.name || 'your launch city'}.`
        : 'Buy a ship before trying to launch. This is the one place where leaving the screen is safe and obvious.'
    ).parent(services).addClass('space-command-card-copy');

    const list = createDiv().parent(services).addClass('space-command-service-list');
    if (ship) {
      const fuelMax = ship.getEffectiveFuelCapacity();
      const refuelAmount = fuelMax - ship.fuel;
      const repairCost = ship.getRepairCost();

      if (refuelAmount > 0) {
        const row = createDiv().parent(list).addClass('space-command-service-row');
        const copy = createDiv().parent(row).addClass('space-command-service-copy');
        createDiv('Refuel Tanks').parent(copy).addClass('space-command-service-title');
        createDiv(`Fill ${refuelAmount} fuel for ${ship.getRefuelCost(refuelAmount)}g.`).parent(copy).addClass('space-command-service-meta');
        _button(row, 'Refuel', !!(playerRef && playerRef.gold >= ship.getRefuelCost(refuelAmount)), _attemptRefuel, 'travel-map-go-btn-secondary');
      }

      if (ship.condition < 100) {
        const row = createDiv().parent(list).addClass('space-command-service-row');
        const copy = createDiv().parent(row).addClass('space-command-service-copy');
        createDiv('Repair Hull').parent(copy).addClass('space-command-service-title');
        createDiv(`Restore to 100% condition for ${repairCost.goldOnly}g.`).parent(copy).addClass('space-command-service-meta');
        _button(row, 'Repair', !!(playerRef && playerRef.gold >= repairCost.goldOnly), _attemptRepair, 'travel-map-go-btn-secondary');
      }

      if (refuelAmount <= 0 && ship.condition >= 100) {
        createDiv('The ship is fully fueled and repaired. Launch whenever you are ready.').parent(list).addClass('space-command-empty');
      }
    } else if (typeof SpaceShipLibrary !== 'undefined') {
      for (const [key, def] of Object.entries(SpaceShipLibrary)) {
        const row = createDiv().parent(list).addClass('space-command-service-row');
        const copy = createDiv().parent(row).addClass('space-command-service-copy');
        createDiv(`${def.displayName} • ${def.cost}g`).parent(copy).addClass('space-command-service-title');
        createDiv(`${def.description} Cargo ${def.cargoBonus} · Fuel ${def.fuelCapacity} · HP ${def.hp}`).parent(copy).addClass('space-command-service-meta');
        _button(row, playerRef && playerRef.gold >= def.cost ? 'Buy' : `Need ${def.cost}g`, !!(playerRef && playerRef.gold >= def.cost), () => _attemptShipPurchase(key), 'travel-map-go-btn-secondary');
      }
    }

    const intel = createDiv().parent(wrap).addClass('space-command-card');
    createElement('h4', 'Ground Control').parent(intel).addClass('space-command-card-title');
    createP('Research and treasury upgrades still happen from the city layer, but their space impact is summarized here.').parent(intel).addClass('space-command-card-copy');
    renderTechTreeSummary(intel);
    renderTreasuryUpgrades(intel);
  }

  function renderTechTreeSummary(parent) {
    const city = _launchCity();
    if (!city || typeof city.getAllTechNodes !== 'function') return;

    const branches = typeof City !== 'undefined' ? City.TECH_BRANCHES : [];
    const list = createDiv().parent(parent).addClass('space-command-service-list');
    for (const branch of branches) {
      const nodes = city.getTechBranch(branch);
      const done = nodes.filter((n) => n.researched).length;
      const total = nodes.length;
      const nextNode = nodes.find((n) => n.canResearch);

      const row = createDiv().parent(list).addClass('space-command-service-row');
      const copy = createDiv().parent(row).addClass('space-command-service-copy');
      createDiv(`${branch.charAt(0).toUpperCase() + branch.slice(1)} ${done}/${total}`).parent(copy).addClass('space-command-service-title');
      createDiv(nextNode ? `Next: ${nextNode.label} · ${nextNode.researchCost} RP + ${nextNode.goldCost}g` : (done === total ? 'Branch complete.' : 'Locked by earlier research.')).parent(copy).addClass('space-command-service-meta');
      if (nextNode) {
        _button(row, 'Research', true, () => {
          const result = city.researchTechNode(nextNode.key, player);
          if (result.ok) _refreshSpaceUI();
          else if (typeof notificationManager !== 'undefined') notificationManager.log(`Research failed: ${result.reason}`, 'warning');
        }, 'travel-map-go-btn-secondary');
      } else {
        _button(row, done === total ? 'Complete' : 'Locked', false, () => {}, 'travel-map-go-btn-secondary');
      }
    }
  }

  function renderTreasuryUpgrades(parent) {
    const city = _launchCity();
    if (!city || typeof CityManagement === 'undefined' || !CityManagement.TREASURY_UPGRADES) return;

    const list = createDiv().parent(parent).addClass('space-command-service-list');
    for (const key of Object.keys(CityManagement.TREASURY_UPGRADES)) {
      const state = CityManagement.getTreasuryUpgradeState(city, key);
      if (!state) continue;
      const row = createDiv().parent(list).addClass('space-command-service-row');
      const copy = createDiv().parent(row).addClass('space-command-service-copy');
      createDiv(`${state.emoji} ${state.name}`).parent(copy).addClass('space-command-service-title');
      createDiv(state.atMax ? 'Maximum tier reached.' : `Tier ${state.currentTier}/${state.maxTier} · Next tier costs ${state.nextCost}g treasury.`).parent(copy).addClass('space-command-service-meta');
      if (!state.atMax) {
        const budget = city.management?.budget || 0;
        _button(row, budget >= state.nextCost ? 'Upgrade' : 'Insufficient', budget >= state.nextCost, () => {
          CityManagement.buyTreasuryUpgrade(city, key);
          _refreshSpaceUI();
        }, 'travel-map-go-btn-secondary');
      } else {
        _button(row, 'Maxed', false, () => {}, 'travel-map-go-btn-secondary');
      }
    }
  }

  function _renderMapWorkspace(parent) {
    const overlay = createDiv().parent(parent).addClass('travel-map-overlay space-command-layout');
    const mapWrap = createDiv().parent(overlay).addClass('travel-map-canvas-wrap space-command-map-wrap');
    const canvasEl = createElement('canvas').parent(mapWrap);
    canvasEl.attribute('width', '420');
    canvasEl.attribute('height', '320');
    canvasEl.addClass('travel-map-canvas');
    canvasEl.addClass('space-command-map-canvas');
    _drawSpaceChart(canvasEl.elt);
    canvasEl.elt.addEventListener('click', (event) => {
      const rect = canvasEl.elt.getBoundingClientRect();
      const scaleX = canvasEl.elt.width / rect.width;
      const scaleY = canvasEl.elt.height / rect.height;
      const mx = (event.clientX - rect.left) * scaleX;
      const my = (event.clientY - rect.top) * scaleY;
      let clicked = null;
      for (const [nodeKey, layout] of Object.entries(SPACE_NODE_LAYOUT)) {
        const x = layout.x * canvasEl.elt.width;
        const y = layout.y * canvasEl.elt.height;
        const dx = mx - x;
        const dy = my - y;
        if ((dx * dx) + (dy * dy) <= (24 * 24)) {
          clicked = nodeKey;
          break;
        }
      }
      if (clicked) {
        _setSelectedNode(clicked, _isPlanetNode(clicked));
        _refreshSpaceUI();
      }
    });

    createDiv('Click a node on the orbital chart to inspect it. Highlighted links are reachable from your current position, exactly like the travel map flow used elsewhere in the game.')
      .parent(mapWrap)
      .addClass('space-command-map-copy');

    const sidebar = createDiv().parent(overlay).addClass('travel-map-sidebar space-command-sidebar');
    _renderSelectedNodeCard(sidebar);
    _renderActionPanel(sidebar);
    _renderRouteList(sidebar);
  }

  function _refreshSpaceUI() {
    const container = select('#spaceTravelUI');
    if (!container) return;
    container.html('');

    const shell = createDiv().parent(container).addClass('space-command-shell');
    _renderHeader(shell);
    _renderMissionStrip(shell);
    _renderMapWorkspace(shell);

    const sys = _sys();
    if (!sys || sys.phase === 'grounded') {
      _renderGroundServices(shell);
    }
  }

  uiManager.registerScreen('spaceTravelHUD', {
    validStates: [GameStates.SPACE],
    create: () => createDiv().id('spaceTravelUI').addClass('screen').style('display', 'none'),
    show: () => {
      const el = select('#spaceTravelUI');
      if (!el) return;
      el.addClass('screen-visible');
      _refreshSpaceUI();
    },
    hide: () => {
      const el = select('#spaceTravelUI');
      if (!el) return;
      el.removeClass('screen-visible');
    },
    update: () => {
      const sys = _sys();
      if (sys && sys.phase === 'en_route') {
        const now = performance.now();
        const lastTick = window._spaceLastTickMs || now;
        const delta = now - lastTick;
        window._spaceLastTickMs = now;
        if (delta > 0 && delta < 5000) {
          const result = sys.tickTravel(delta);
          if (result?.event === 'arrived') {
            const onDockResolved = (qteResult) => {
              const dockingResult = sys.completeDocking(qteResult.success, Math.abs(qteResult.conditionBonus || 0));
              if (dockingResult.ok && dockingResult.landed) {
                _unlockCurrentPlanet();
                window._spaceLaunchPlanet = sys.currentNode;
              }
              _setSelectedNode(sys.currentNode, _isPlanetNode(sys.currentNode));
              _syncLegacySpaceState();
              if (typeof notificationManager !== 'undefined') {
                const msg = dockingResult.ok
                  ? (dockingResult.landed ? `Surface contact confirmed on ${sys.currentNode}.` : `Docked at ${sys.currentNode}.`)
                  : `Docking approach failed at ${sys.currentNode}. Hull damage taken.`;
                notificationManager.log(msg, dockingResult.ok ? 'success' : 'warning');
              }
              _refreshSpaceUI();
            };

            if (typeof minigameManager !== 'undefined') {
              minigameManager.launch('spaceDocking', { timeLimit: 8000 }, onDockResolved);
            } else {
              onDockResolved({ success: true, conditionBonus: 0 });
            }
          } else if (result?.event === 'travelling') {
            const pct = Math.round(result.progress * 100);
            if (pct % 10 === 0) _refreshSpaceUI();
          }
        }
      }
    },
    destroy: () => {
      const el = select('#spaceTravelUI');
      if (el) el.remove();
    },
  });

  window._refreshSpaceUI = _refreshSpaceUI;
  window._syncPlayerSpaceTravelFromSystem = _syncLegacySpaceState;
})();
