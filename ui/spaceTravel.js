// ui/spaceTravel.js — Strategic star-map overlay for the playable space state

(function() {
  'use strict';

  if (typeof uiManager === 'undefined') return;

  const SPACE_FALLBACK_GRAPH = Object.freeze({
    systems: {
      orbit:   { key: 'orbit', label: 'Earth Orbit', kindLabel: 'Home System', description: 'Blue-world home orbit.', accent: '#63c7ff', x: 0.22, y: 0.56 },
      luna:    { key: 'luna', label: 'Luna Reach', kindLabel: 'Station System', description: 'A logistics-heavy system.', accent: '#d6dfff', x: 0.55, y: 0.22 },
      aurelia: { key: 'aurelia', label: 'Aurelia Bloom', kindLabel: 'Trade System', description: 'A bright commercial system.', accent: '#7ff0b4', x: 0.77, y: 0.60 },
      vanta:   { key: 'vanta', label: 'Vanta Rift', kindLabel: 'Hazard System', description: 'A volatile frontier.', accent: '#ff9d7a', x: 0.46, y: 0.84 },
    },
    routes: [
      { from: 'orbit', to: 'luna' },
      { from: 'orbit', to: 'aurelia' },
      { from: 'orbit', to: 'vanta' },
      { from: 'luna', to: 'aurelia' },
      { from: 'luna', to: 'vanta' },
      { from: 'aurelia', to: 'vanta' },
    ],
  });

  function _sys() {
    return window._spaceTravelSystem
      || (typeof player !== 'undefined' && player?._spaceTravelSystem)
      || null;
  }

  function _player() {
    return (typeof player !== 'undefined') ? player : null;
  }

  function _graph() {
    if (typeof window.BQGetSpaceWorldGraph === 'function') {
      const graph = window.BQGetSpaceWorldGraph();
      if (graph && graph.systems) return graph;
    }
    return SPACE_FALLBACK_GRAPH;
  }

  function _nodeLayoutMap() {
    const systems = _graph().systems || {};
    const layout = {};
    for (const [key, system] of Object.entries(systems)) {
      const firstChar = String(system.label || key).trim().charAt(0).toUpperCase() || '?';
      layout[key] = {
        x: Number.isFinite(Number(system.x)) ? Number(system.x) : 0.5,
        y: Number.isFinite(Number(system.y)) ? Number(system.y) : 0.5,
        accent: system.accent || '#9fb5ce',
        icon: firstChar,
      };
    }
    return layout;
  }

  function _routeLayout() {
    return Array.isArray(_graph().routes) ? _graph().routes : [];
  }

  function _ship() {
    const sys = _sys();
    if (sys?.activeShip) return sys.activeShip;
    const currentPlayer = _player();
    if (typeof currentPlayer?.getActiveSpaceShip === 'function') {
      return currentPlayer.getActiveSpaceShip();
    }
    return null;
  }

  function _spaceCities() {
    if (Array.isArray(window.cities)) return window.cities;
    if (typeof cities !== 'undefined' && Array.isArray(cities)) return cities;
    return [];
  }

  function _findCityByName(name) {
    if (!name) return null;
    return _spaceCities().find((city) => city && city.name === name) || null;
  }

  function _launchCity() {
    const sys = _sys();
    if (sys?.launchCity) return sys.launchCity;
    if (window._spaceLaunchCity) return window._spaceLaunchCity;
    return _findCityByName(_player()?.spaceTravel?.lastLaunchCity || null);
  }

  function _spaceReturnState() {
    if (window._spaceReturnState) return window._spaceReturnState;
    return window._isCityManageMode ? GameStates.CITY_MANAGE : GameStates.PLAYING;
  }

  function _normalizeNodeKey(nodeKey) {
    if (!nodeKey || typeof nodeKey !== 'string') return null;
    const systems = _graph().systems || {};
    return Object.prototype.hasOwnProperty.call(systems, nodeKey) ? nodeKey : null;
  }

  function _setSelectedNode(nodeKey) {
    window._spaceSelectedNode = _normalizeNodeKey(nodeKey);
    return window._spaceSelectedNode;
  }

  function _getSelectedNode() {
    const sys = _sys();
    const preferred = _normalizeNodeKey(window._spaceSelectedNode)
      || _normalizeNodeKey(sys?.targetNode)
      || _normalizeNodeKey(sys?.currentNode)
      || 'orbit';
    window._spaceSelectedNode = preferred;
    return preferred;
  }

  function _nodeMeta(nodeKey) {
    const normalized = _normalizeNodeKey(nodeKey);
    if (!normalized) return null;
    const system = _graph().systems?.[normalized] || null;
    const layout = _nodeLayoutMap()[normalized] || { accent: '#9fb5ce' };

    return {
      key: normalized,
      label: system?.label || normalized,
      kind: system?.kindLabel || 'System',
      description: system?.description || 'Star system',
      accent: layout.accent,
    };
  }

  function _availableRoutes() {
    const sys = _sys();
    const routeNode = sys?.phase === 'grounded' ? 'orbit' : (sys?.currentNode || 'orbit');
    return (typeof sys?.getAvailableRoutes === 'function')
      ? sys.getAvailableRoutes(routeNode)
      : [];
  }

  function _selectedRoute() {
    const selected = _getSelectedNode();
    return _availableRoutes().find((route) => route.destination === selected) || null;
  }

  function _phaseLabel(phase) {
    switch (phase) {
      case 'grounded': return 'Grounded';
      case 'launch_prep':
      case 'ascending': return 'Launching';
      case 'in_orbit': return 'In System';
      case 'landed': return 'Docked';
      case 'reentry': return 'Re-entry';
      default: return 'Space';
    }
  }

  function _syncLegacySpaceState() {
    const currentPlayer = _player();
    if (!currentPlayer) return;
    currentPlayer.spaceTravel = currentPlayer.spaceTravel || {};
    const sys = _sys();
    const launchCity = _launchCity();
    const launchCityName = launchCity?.name || currentPlayer.spaceTravel.lastLaunchCity || null;
    if (launchCityName) currentPlayer.spaceTravel.lastLaunchCity = launchCityName;

    if (!sys || sys.phase === 'grounded') {
      if (typeof currentPlayer.returnFromSpace === 'function') currentPlayer.returnFromSpace();
      if (launchCityName) currentPlayer.spaceTravel.lastLaunchCity = launchCityName;
      return;
    }

    currentPlayer.spaceTravel.currentCity = launchCityName;
    currentPlayer.spaceTravel.inOrbit = sys.phase === 'in_orbit' || sys.phase === 'ascending' || sys.phase === 'reentry';
    currentPlayer.spaceTravel.currentPlanet = sys.currentBodyKey || sys.currentNode || 'orbit';
    if (!Array.isArray(currentPlayer.spaceTravel.visitedPlanets)) currentPlayer.spaceTravel.visitedPlanets = [];
    if (sys.currentNode && !currentPlayer.spaceTravel.visitedPlanets.includes(sys.currentNode)) {
      currentPlayer.spaceTravel.visitedPlanets.push(sys.currentNode);
    }
  }

  function _closeSpaceMode() {
    const currentPlayer = _player();
    if (typeof currentPlayer?.returnFromSpace === 'function') {
      currentPlayer.returnFromSpace();
    }
    if (typeof gameStateManager !== 'undefined') gameStateManager.setState(_spaceReturnState());
  }

  function _attemptLaunch() {
    const sys = _sys();
    const ship = _ship();
    const city = _launchCity();
    const destination = _getSelectedNode();
    if (!sys || !ship || !city) return;

    const result = sys.beginLaunch(city, ship, _player(), destination);
    if (!result.ok) {
      if (typeof notificationManager !== 'undefined') notificationManager.log(`Launch failed: ${result.reason}`, 'warning');
      return;
    }
    const confirm = sys.confirmLaunch();
    if (!confirm.ok) {
      if (typeof notificationManager !== 'undefined') notificationManager.log(`Launch failed: ${confirm.reason}`, 'warning');
      return;
    }
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Launch burn started for ${_nodeMeta(destination)?.label || destination}.`, 'info');
    }
    window._spaceMapOpen = false;
    _syncLegacySpaceState();
    _refreshSpaceUI();
  }

  function _attemptPlotRoute(destinationNode = null) {
    const sys = _sys();
    const routeTarget = _normalizeNodeKey(destinationNode || _getSelectedNode());
    if (!sys || !routeTarget || typeof sys.plotRoute !== 'function') return;
    const result = sys.plotRoute(routeTarget);
    if (!result.ok) {
      if (typeof notificationManager !== 'undefined') notificationManager.log(`Plot failed: ${result.reason}`, 'warning');
      return;
    }
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Route plotted to ${_nodeMeta(routeTarget)?.label || routeTarget}. Reach the system edge to jump.`, 'info');
    }
    window._spaceMapOpen = false;
    _refreshSpaceUI();
  }

  function _attemptReentry() {
    const sys = _sys();
    if (!sys || typeof sys.beginReentry !== 'function') return;
    const result = sys.beginReentry();
    if (!result.ok) {
      if (typeof notificationManager !== 'undefined') notificationManager.log(`Re-entry failed: ${result.reason}`, 'warning');
      return;
    }
    if (typeof notificationManager !== 'undefined') notificationManager.log('Re-entry corridor confirmed.', 'info');
    window._spaceMapOpen = false;
    _refreshSpaceUI();
  }

  function _attemptDock() {
    const sys = _sys();
    if (!sys || typeof sys.dockNearestBody !== 'function') return;
    const result = sys.dockNearestBody();
    if (!result.ok) {
      if (typeof notificationManager !== 'undefined') notificationManager.log('No dockable body nearby.', 'warning');
      return;
    }
    if (result.body?.key === 'homeworld' && typeof sys.returnToAdventureSurface === 'function') {
      sys.returnToAdventureSurface();
      if (typeof window.BQActivateWorldSession === 'function') {
        window.BQActivateWorldSession(window.BQ_WORLD_SESSION_KEYS?.HOMEWORLD || 'homeworld');
      }
      const currentPlayer = _player();
      if (typeof currentPlayer?.returnFromSpace === 'function') currentPlayer.returnFromSpace();
      if (typeof notificationManager !== 'undefined') notificationManager.log('Landed on Earth. Back on the world map.', 'success');
      if (typeof gameStateManager !== 'undefined') gameStateManager.setState(_spaceReturnState());
      return;
    }
    if (result.body && typeof window.BQEnterPlanetSurfaceFromSpace === 'function') {
      const landed = window.BQEnterPlanetSurfaceFromSpace(sys, result.body);
      if (!landed?.ok) {
        if (typeof notificationManager !== 'undefined') notificationManager.log('Surface generation failed.', 'warning');
        return;
      }
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Landed on ${result.body.name}. Explore the surface and launch from its spaceport to return to orbit.`, 'success');
      }
      if (typeof gameStateManager !== 'undefined') gameStateManager.setState(GameStates.PLAYING);
      return;
    }
    if (typeof notificationManager !== 'undefined') notificationManager.log(`Docked at ${result.body.name}.`, 'success');
    _syncLegacySpaceState();
    _refreshSpaceUI();
  }

  function _attemptLiftOff() {
    const sys = _sys();
    if (!sys || typeof sys.liftOff !== 'function') return;
    const result = sys.liftOff();
    if (!result.ok) {
      if (typeof notificationManager !== 'undefined') notificationManager.log(`Lift-off failed: ${result.reason}`, 'warning');
      return;
    }
    if (typeof notificationManager !== 'undefined') notificationManager.log('Lift-off complete. Thrusters online.', 'info');
    _syncLegacySpaceState();
    _refreshSpaceUI();
  }

  function _button(parent, label, enabled, onClick, className = 'travel-map-go-btn') {
    const btn = createButton(label).parent(parent);
    btn.addClass(enabled ? className : `${className} travel-map-go-btn-disabled`);
    if (enabled) btn.mousePressed(onClick);
    else btn.attribute('disabled', 'true');
    return btn;
  }

  function _drawSpaceChart(canvas) {
    const ctx = canvas.getContext('2d');
    const sys = _sys();
    const width = canvas.width;
    const height = canvas.height;
    const nodeLayout = _nodeLayoutMap();
    const currentNode = _normalizeNodeKey(sys?.currentNode);
    const targetNode = _normalizeNodeKey(sys?.targetNode);
    const selectedNode = _getSelectedNode();
    const routes = new Set(_availableRoutes().map((route) => route.destination));

    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0f1b30');
    gradient.addColorStop(0.5, '#0a111d');
    gradient.addColorStop(1, '#060b13');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 50; i += 1) {
      ctx.fillStyle = `rgba(255,255,255,${0.12 + ((i % 4) * 0.13)})`;
      ctx.fillRect(((i * 53) % width) + 8, ((i * 97) % height) + 4, 2, 2);
    }

    const pointFor = (nodeKey) => ({
      x: nodeLayout[nodeKey].x * width,
      y: nodeLayout[nodeKey].y * height,
    });

    for (const edge of _routeLayout()) {
      if (!nodeLayout[edge.from] || !nodeLayout[edge.to]) continue;
      const from = pointFor(edge.from);
      const to = pointFor(edge.to);
      const highlighted = (
        (edge.from === currentNode && edge.to === targetNode)
        || (edge.to === currentNode && edge.from === targetNode)
      );
      const reachable = routes.has(edge.from) || routes.has(edge.to) || sys?.phase === 'grounded';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.lineWidth = highlighted ? 4 : 2;
      ctx.strokeStyle = highlighted
        ? 'rgba(255,208,105,0.95)'
        : reachable
          ? 'rgba(125,201,255,0.45)'
          : 'rgba(255,255,255,0.14)';
      if (!reachable && !highlighted) ctx.setLineDash([8, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const [nodeKey, layout] of Object.entries(nodeLayout)) {
      const point = pointFor(nodeKey);
      const meta = _nodeMeta(nodeKey);
      const isCurrent = currentNode === nodeKey;
      const isSelected = selectedNode === nodeKey;
      const isTarget = targetNode === nodeKey;

      if (isCurrent || isSelected) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, isCurrent ? 22 : 18, 0, Math.PI * 2);
        ctx.fillStyle = isCurrent ? 'rgba(255,208,105,0.24)' : 'rgba(125,201,255,0.18)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(point.x, point.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = layout.accent;
      ctx.fill();
      ctx.lineWidth = isTarget ? 3 : 2;
      ctx.strokeStyle = isTarget ? '#ffd069' : isCurrent ? '#ffffff' : 'rgba(255,255,255,0.35)';
      ctx.stroke();

      ctx.fillStyle = '#07111a';
      ctx.font = '700 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(layout.icon, point.x, point.y);

      ctx.fillStyle = isSelected ? '#f7fbff' : '#b8c9de';
      ctx.font = isSelected ? '700 12px sans-serif' : '600 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(meta.label, point.x, point.y + 18);
    }
  }

  function _renderMapOverlay(parent) {
    const sys = _sys();
    const selected = _getSelectedNode();
    const selectedMeta = _nodeMeta(selected);
    const selectedRoute = _selectedRoute();
    const ship = _ship();

    const shell = createDiv().parent(parent).addClass('space-command-shell');
    const header = createDiv().parent(shell).addClass('space-command-header');
    const titleCol = createDiv().parent(header);
    createDiv(`Star Map • ${_launchCity()?.name || 'No Launch Site'}`).parent(titleCol).addClass('space-command-eyebrow');
    createElement('h2', `Space Command · ${_phaseLabel(sys?.phase || 'grounded')}`).parent(titleCol).addClass('space-command-title');
    const actionCol = createDiv().parent(header).addClass('space-command-header-actions');
    _button(actionCol, sys?.phase === 'grounded' ? 'Close' : 'Resume Flight', true, () => {
      if (sys?.phase === 'grounded') _closeSpaceMode();
      else {
        window._spaceMapOpen = false;
        _refreshSpaceUI();
      }
    }, 'space-command-nav-btn space-command-close-btn');

    const status = createDiv().parent(shell).addClass('space-status-strip');
    const row = createDiv().parent(status).addClass('space-status-row');
    createDiv(_phaseLabel(sys?.phase || 'grounded')).parent(row).addClass('space-status-chip');
    if (ship) {
      createDiv(`${ship.displayName} · ${ship.condition}% · ⛽ ${ship.fuel}/${ship.getEffectiveFuelCapacity()}`).parent(row).addClass('space-status-chip space-status-chip-dim');
    }
    if (sys?.currentNode) {
      createDiv(`Current: ${_nodeMeta(sys.currentNode)?.label || sys.currentNode}`).parent(row).addClass('space-status-chip space-status-chip-dim');
    }
    if (sys?.targetNode) {
      createDiv(`Plotted: ${_nodeMeta(sys.targetNode)?.label || sys.targetNode}`).parent(row).addClass('space-status-chip').style('color', '#ffd069');
    }

    const overlay = createDiv().parent(shell).addClass('travel-map-overlay space-command-layout');
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
      for (const [nodeKey, layout] of Object.entries(_nodeLayoutMap())) {
        const x = layout.x * canvasEl.elt.width;
        const y = layout.y * canvasEl.elt.height;
        const dx = mx - x;
        const dy = my - y;
        if ((dx * dx) + (dy * dy) <= (24 * 24)) {
          _setSelectedNode(nodeKey);
          _refreshSpaceUI();
          break;
        }
      }
    });

    const sidebar = createDiv().parent(overlay).addClass('travel-map-sidebar space-command-sidebar');
    const card = createDiv().parent(sidebar).addClass('space-command-card');
    createElement('h3', selectedMeta.label).parent(card).addClass('space-command-card-title');
    createP(selectedMeta.description).parent(card).addClass('space-command-card-copy');
    const chips = createDiv().parent(card).addClass('space-command-chip-row');
    createSpan(selectedMeta.kind).parent(chips).addClass('space-command-chip');
    if (sys?.currentNode === selected) createSpan('Current System').parent(chips).addClass('space-command-chip space-command-chip-success');
    if (sys?.targetNode === selected) createSpan('Jump Plotted').parent(chips).addClass('space-command-chip space-command-chip-alert');

    const metrics = createDiv().parent(card).addClass('space-command-metrics');
    if (selectedRoute) {
      const mk = (label, value) => {
        const metric = createDiv().parent(metrics).addClass('space-command-metric');
        createDiv(label).parent(metric).addClass('space-command-metric-label');
        createDiv(value).parent(metric).addClass('space-command-metric-value');
      };
      mk('Distance', String(selectedRoute.distance));
      mk('Fuel', String(selectedRoute.fuelCost));
      mk('Danger', `${Math.round(selectedRoute.dangerRating * 100)}%`);
    }

    const actions = createDiv().parent(sidebar).addClass('space-command-card');
    createElement('h4', 'Actions').parent(actions).addClass('space-command-card-title');
    const actionStack = createDiv().parent(actions).addClass('space-command-action-stack');

    if (sys?.phase === 'grounded') {
      const canLaunch = !!(ship && _launchCity() && (selected === 'orbit' || !!selectedRoute));
      const launchLabel = !ship
        ? 'Need a Ship'
        : (selected === 'orbit' || selectedRoute)
          ? `Launch to ${selectedMeta.label}`
          : 'Launch Route Locked';
      _button(actionStack, launchLabel, canLaunch, _attemptLaunch);
    } else if (sys?.phase === 'in_orbit') {
      if (selectedRoute) _button(actionStack, `Plot Jump to ${selectedMeta.label}`, true, () => _attemptPlotRoute(selected));
      _button(actionStack, 'Dock Nearest Body', !!sys.getNearestBody?.(), _attemptDock, 'travel-map-go-btn-secondary');
      _button(actionStack, sys.currentNode === 'orbit' ? 'Return to Ground' : 'Re-entry Locked', sys.currentNode === 'orbit', _attemptReentry, 'travel-map-go-btn-secondary');
    } else if (sys?.phase === 'landed') {
      _button(actionStack, 'Lift Off', true, _attemptLiftOff);
    }

    const routeCard = createDiv().parent(sidebar).addClass('space-command-card');
    createElement('h4', sys?.phase === 'grounded' ? 'Launch Corridors' : 'Connected Systems').parent(routeCard).addClass('space-command-card-title');
    const routeList = createDiv().parent(routeCard).addClass('space-command-route-list');
    const routes = _availableRoutes();
    for (const route of routes) {
      const meta = _nodeMeta(route.destination);
      const routeRow = createDiv().parent(routeList).addClass('space-command-route-row');
      const copy = createDiv().parent(routeRow).addClass('space-command-route-copy');
      createDiv(meta.label).parent(copy).addClass('space-command-route-title');
      createDiv(`Fuel ${route.fuelCost} · Danger ${Math.round(route.dangerRating * 100)}%`).parent(copy).addClass('space-command-route-meta');
      _button(routeRow, sys?.phase === 'grounded' ? 'Select' : 'Plot', true, () => {
        _setSelectedNode(route.destination);
        if (sys?.phase !== 'grounded') _attemptPlotRoute(route.destination);
        else _refreshSpaceUI();
      }, 'travel-map-go-btn-secondary');
    }
  }

  function _renderCompactOverlay(parent) {
    const sys = _sys();
    const selectedMeta = _nodeMeta(sys?.currentNode || 'orbit');
    const nearest = typeof sys?.getNearestBody === 'function' ? sys.getNearestBody() : null;
    const shell = createDiv().parent(parent).addClass('space-compact-shell');

    const card = createDiv().parent(shell).addClass('space-compact-card');
    createDiv(`${selectedMeta.label} · ${_phaseLabel(sys?.phase || 'grounded')}`).parent(card).addClass('space-compact-title');
    createDiv(sys?.phase === 'landed'
      ? `Landed at ${sys.getBodyByKey?.(sys.currentBodyKey)?.name || 'surface site'}`
      : sys?.targetNode
      ? `Plotted jump: ${_nodeMeta(sys.targetNode)?.label || sys.targetNode}`
      : nearest
        ? `Nearby: ${nearest.name}`
        : 'Free flight').parent(card).addClass('space-compact-copy');

    const row = createDiv().parent(card).addClass('space-compact-actions');
    _button(row, 'Star Map', true, () => {
      window._spaceMapOpen = true;
      _refreshSpaceUI();
    }, 'travel-map-go-btn-secondary');
    if (sys?.phase === 'in_orbit') {
      _button(row, 'Dock', !!nearest, _attemptDock, 'travel-map-go-btn-secondary');
      _button(row, sys.currentNode === 'orbit' ? 'Ground' : 'Locked', sys.currentNode === 'orbit', _attemptReentry, 'travel-map-go-btn-secondary');
    } else if (sys?.phase === 'landed') {
      _button(row, 'Lift Off', true, _attemptLiftOff, 'travel-map-go-btn-secondary');
    }
  }

  function _refreshSpaceUI() {
    const container = select('#spaceTravelUI');
    if (!container) return;
    container.html('');

    const sys = _sys();
    const hideForEarthSurface = !!(
      sys
      && sys.phase === 'landed'
      && typeof sys.getCurrentSurfaceState === 'function'
      && sys.getCurrentSurfaceState()?.mode === 'earth_world'
      && !window._spaceMapOpen
    );
    if (hideForEarthSurface) {
      container.style('pointer-events', 'none');
      return;
    }
    const showMap = !sys || sys.phase === 'grounded' || !!window._spaceMapOpen;
    container.style('pointer-events', showMap ? 'auto' : 'none');
    if (showMap) _renderMapOverlay(container);
    else _renderCompactOverlay(container);
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
      const now = performance.now();
      if (!window._spaceUiLastRefresh || (now - window._spaceUiLastRefresh) > 250) {
        window._spaceUiLastRefresh = now;
        _refreshSpaceUI();
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
