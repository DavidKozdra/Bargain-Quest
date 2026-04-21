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
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log(`Surface handoff failed: ${landed?.reason || 'unknown'}`, 'warning');
        }
        return;
      }
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Landed on ${result.body.name}. Enter the landing city and use Return To Orbit when you're ready to leave.`, 'success');
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

  const SPACE_MAP_WORLD = Object.freeze({
    width: 1000,
    height: 680,
    paddingX: 110,
    paddingY: 90,
  });

  function _spaceUiMapState() {
    const state = (typeof window !== 'undefined' && window._spaceUiMapState && typeof window._spaceUiMapState === 'object')
      ? window._spaceUiMapState
      : {};
    state.zoom = Number.isFinite(Number(state.zoom)) ? Number(state.zoom) : 1;
    state.panX = Number.isFinite(Number(state.panX)) ? Number(state.panX) : 0;
    state.panY = Number.isFinite(Number(state.panY)) ? Number(state.panY) : 0;
    if (typeof window !== 'undefined') window._spaceUiMapState = state;
    return state;
  }

  function _markSpaceUiInteractive(durationMs = 450) {
    if (typeof window === 'undefined') return;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    window._spaceUiInteractiveUntil = now + Math.max(120, Number(durationMs) || 0);
  }

  function _clampSpaceZoom(value) {
    return Math.max(0.75, Math.min(3.1, Number(value) || 1));
  }

  function _nodeWorldPoint(nodeKey) {
    const layout = _nodeLayoutMap()[nodeKey];
    if (!layout) return null;
    return {
      x: SPACE_MAP_WORLD.paddingX + layout.x * (SPACE_MAP_WORLD.width - (SPACE_MAP_WORLD.paddingX * 2)),
      y: SPACE_MAP_WORLD.paddingY + layout.y * (SPACE_MAP_WORLD.height - (SPACE_MAP_WORLD.paddingY * 2)),
    };
  }

  function _spaceMapTransform(canvas, stateOverride = null) {
    const state = stateOverride || _spaceUiMapState();
    const fitScale = Math.min(
      (canvas?.width || SPACE_MAP_WORLD.width) / SPACE_MAP_WORLD.width,
      (canvas?.height || SPACE_MAP_WORLD.height) / SPACE_MAP_WORLD.height,
    );
    const scale = fitScale * _clampSpaceZoom(state.zoom);
    const baseOffsetX = (((canvas?.width || 0) - (SPACE_MAP_WORLD.width * scale)) / 2);
    const baseOffsetY = (((canvas?.height || 0) - (SPACE_MAP_WORLD.height * scale)) / 2);
    return {
      scale,
      fitScale,
      offsetX: baseOffsetX + (Number(state.panX) || 0),
      offsetY: baseOffsetY + (Number(state.panY) || 0),
    };
  }

  function _spaceMapToScreen(point, transform) {
    return {
      x: transform.offsetX + (point.x * transform.scale),
      y: transform.offsetY + (point.y * transform.scale),
    };
  }

  function _spaceMapToWorld(point, transform) {
    return {
      x: (point.x - transform.offsetX) / transform.scale,
      y: (point.y - transform.offsetY) / transform.scale,
    };
  }

  function _canvasPoint(canvas, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width || canvas.width || 1);
    const scaleY = canvas.height / Math.max(1, rect.height || canvas.height || 1);
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function _spaceMapNodeAtPoint(canvas, point) {
    const transform = _spaceMapTransform(canvas);
    for (const nodeKey of Object.keys(_nodeLayoutMap())) {
      const world = _nodeWorldPoint(nodeKey);
      if (!world) continue;
      const screen = _spaceMapToScreen(world, transform);
      const dx = point.x - screen.x;
      const dy = point.y - screen.y;
      if ((dx * dx) + (dy * dy) <= (26 * 26)) return nodeKey;
    }
    return null;
  }

  function _centerSpaceMapOnWorldPoint(canvas, worldPoint, zoom = null) {
    if (!canvas || !worldPoint) return;
    const state = _spaceUiMapState();
    if (zoom != null) state.zoom = _clampSpaceZoom(zoom);
    const transform = _spaceMapTransform(canvas, state);
    const current = _spaceMapToScreen(worldPoint, transform);
    state.panX += (canvas.width / 2) - current.x;
    state.panY += (canvas.height / 2) - current.y;
    _markSpaceUiInteractive();
  }

  function _centerSpaceMapOnNode(canvas, nodeKey, zoom = null) {
    const worldPoint = _nodeWorldPoint(nodeKey);
    if (!worldPoint) return;
    _centerSpaceMapOnWorldPoint(canvas, worldPoint, zoom);
  }

  function _spaceMapViewportWorld(canvas) {
    const transform = _spaceMapTransform(canvas);
    const topLeft = _spaceMapToWorld({ x: 0, y: 0 }, transform);
    const bottomRight = _spaceMapToWorld({ x: canvas.width, y: canvas.height }, transform);
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }

  function _drawSpaceBackdrop(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#101a2d');
    gradient.addColorStop(0.45, '#0a111d');
    gradient.addColorStop(1, '#050912');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 68; i += 1) {
      const size = 1 + (i % 3);
      ctx.fillStyle = `rgba(255,255,255,${0.12 + ((i % 4) * 0.12)})`;
      ctx.fillRect(((i * 61) % width) + 10, ((i * 97) % height) + 6, size, size);
    }

    ctx.strokeStyle = 'rgba(125, 201, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 30; x < width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 26; y < height; y += 68) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
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
    const transform = _spaceMapTransform(canvas);

    _drawSpaceBackdrop(ctx, width, height);

    const pointFor = (nodeKey) => {
      const world = _nodeWorldPoint(nodeKey);
      return world ? _spaceMapToScreen(world, transform) : null;
    };

    for (const edge of _routeLayout()) {
      if (!nodeLayout[edge.from] || !nodeLayout[edge.to]) continue;
      const from = pointFor(edge.from);
      const to = pointFor(edge.to);
      if (!from || !to) continue;
      const highlighted = (
        (edge.from === currentNode && edge.to === targetNode)
        || (edge.to === currentNode && edge.from === targetNode)
      );
      const reachable = routes.has(edge.from) || routes.has(edge.to) || sys?.phase === 'grounded' || edge.from === currentNode || edge.to === currentNode;
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
      if (!point) continue;
      const meta = _nodeMeta(nodeKey);
      const isCurrent = currentNode === nodeKey;
      const isSelected = selectedNode === nodeKey;
      const isTarget = targetNode === nodeKey;

      if (isCurrent || isSelected) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, isCurrent ? 26 : 20, 0, Math.PI * 2);
        ctx.fillStyle = isCurrent ? 'rgba(255,208,105,0.24)' : 'rgba(125,201,255,0.18)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(point.x, point.y, 13, 0, Math.PI * 2);
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

  function _drawSpaceMinimap(canvas, mainCanvas = null) {
    const ctx = canvas.getContext('2d');
    const nodeLayout = _nodeLayoutMap();
    const sys = _sys();
    const currentNode = _normalizeNodeKey(sys?.currentNode);
    const targetNode = _normalizeNodeKey(sys?.targetNode);
    const selectedNode = _getSelectedNode();
    const transform = _spaceMapTransform(canvas, { zoom: 1, panX: 0, panY: 0 });

    _drawSpaceBackdrop(ctx, canvas.width, canvas.height);

    const pointFor = (nodeKey) => {
      const world = _nodeWorldPoint(nodeKey);
      return world ? _spaceMapToScreen(world, transform) : null;
    };

    for (const edge of _routeLayout()) {
      if (!nodeLayout[edge.from] || !nodeLayout[edge.to]) continue;
      const from = pointFor(edge.from);
      const to = pointFor(edge.to);
      if (!from || !to) continue;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(125,201,255,0.34)';
      ctx.stroke();
    }

    for (const [nodeKey, layout] of Object.entries(nodeLayout)) {
      const point = pointFor(nodeKey);
      if (!point) continue;
      const isCurrent = currentNode === nodeKey;
      const isSelected = selectedNode === nodeKey;
      const isTarget = targetNode === nodeKey;
      ctx.beginPath();
      ctx.arc(point.x, point.y, isCurrent ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = layout.accent;
      ctx.fill();
      ctx.lineWidth = isTarget ? 2.5 : 1.5;
      ctx.strokeStyle = isTarget ? '#ffd069' : isSelected ? '#f7fbff' : 'rgba(255,255,255,0.35)';
      ctx.stroke();
    }

    if (mainCanvas) {
      const viewport = _spaceMapViewportWorld(mainCanvas);
      const topLeft = _spaceMapToScreen({ x: viewport.x, y: viewport.y }, transform);
      const bottomRight = _spaceMapToScreen({ x: viewport.x + viewport.width, y: viewport.y + viewport.height }, transform);
      ctx.strokeStyle = 'rgba(255, 208, 105, 0.92)';
      ctx.lineWidth = 2;
      ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    }
  }

  function _spaceSystemPreview(nodeKey) {
    const sys = _sys();
    const liveSystem = (sys?.currentNode === nodeKey && typeof sys?.getCurrentSystemState === 'function')
      ? sys.getCurrentSystemState()
      : null;
    if (liveSystem?.bodies) {
      return {
        width: liveSystem.width || 2400,
        height: liveSystem.height || 2400,
        centerX: liveSystem.centerX || ((liveSystem.width || 2400) / 2),
        centerY: liveSystem.centerY || ((liveSystem.height || 2400) / 2),
        starColor: liveSystem.starColor || '#7dc9ff',
        bodies: liveSystem.bodies || [],
        ship: liveSystem.ship || null,
        nearestBodyKey: liveSystem.nearestBodyKey || null,
      };
    }

    const system = _graph().systems?.[nodeKey];
    if (!system) return null;
    const width = 2400;
    const height = 2400;
    const centerX = width / 2;
    const centerY = height / 2;
    const srcBodies = Array.isArray(system.bodies) ? system.bodies : [];
    const bodies = srcBodies.map((body, index) => {
      const orbitRadius = Math.max(180, Number(body?.orbitRadius) || (360 + (index * 210)));
      const angle = Number.isFinite(Number(body?.angle))
        ? Number(body.angle)
        : ((Math.PI * 2 * index) / Math.max(1, srcBodies.length));
      return {
        ...body,
        orbitRadius,
        angle,
        radius: Math.max(14, Number(body?.radius) || (body?.kind === 'station' ? 34 : 58)),
        x: centerX + (Math.cos(angle) * orbitRadius),
        y: centerY + (Math.sin(angle) * orbitRadius),
      };
    });

    return {
      width,
      height,
      centerX,
      centerY,
      starColor: system.accent || '#7dc9ff',
      bodies,
      ship: null,
      nearestBodyKey: null,
    };
  }

  function _drawSystemPreview(canvas, nodeKey) {
    const ctx = canvas.getContext('2d');
    const preview = _spaceSystemPreview(nodeKey);
    _drawSpaceBackdrop(ctx, canvas.width, canvas.height);
    if (!preview) return;

    const points = [
      { x: preview.centerX, y: preview.centerY, r: 140 },
      ...preview.bodies.map((body) => ({ x: body.x, y: body.y, r: Math.max(24, body.radius + 18) })),
    ];
    if (preview.ship) points.push({ x: preview.ship.x, y: preview.ship.y, r: 24 });

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const point of points) {
      minX = Math.min(minX, point.x - point.r);
      minY = Math.min(minY, point.y - point.r);
      maxX = Math.max(maxX, point.x + point.r);
      maxY = Math.max(maxY, point.y + point.r);
    }
    const pad = 26;
    const scale = Math.min(
      (canvas.width - (pad * 2)) / Math.max(1, maxX - minX),
      (canvas.height - (pad * 2)) / Math.max(1, maxY - minY),
    );
    const offsetX = ((canvas.width - ((maxX - minX) * scale)) / 2) - (minX * scale);
    const offsetY = ((canvas.height - ((maxY - minY) * scale)) / 2) - (minY * scale);
    const toScreen = (x, y) => ({ x: offsetX + (x * scale), y: offsetY + (y * scale) });

    const star = toScreen(preview.centerX, preview.centerY);
    ctx.fillStyle = preview.starColor || '#7dc9ff';
    ctx.beginPath();
    ctx.arc(star.x, star.y, Math.max(16, 54 * scale), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.arc(star.x, star.y, Math.max(24, 84 * scale), 0, Math.PI * 2);
    ctx.fill();

    for (const body of preview.bodies) {
      if (body.kind !== 'asteroid') {
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(star.x, star.y, Math.max(16, body.orbitRadius * scale), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    for (const body of preview.bodies) {
      const screen = toScreen(body.x, body.y);
      const radius = Math.max(5, body.radius * scale);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = body.accent || '#9fb5ce';
      ctx.fill();
      if (body.kind === 'station') {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, radius * 1.6, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (body.key === preview.nearestBodyKey) {
        ctx.strokeStyle = '#ffd069';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (preview.ship) {
      const ship = toScreen(preview.ship.x, preview.ship.y);
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(preview.ship.heading || 0);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(-10, -6);
      ctx.lineTo(-10, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function _attachSpaceMapInteractions(canvas, minimapCanvas = null) {
    if (!canvas) return;
    const state = _spaceUiMapState();
    let dragging = false;
    let pointerId = null;
    let lastPoint = null;
    let startPoint = null;
    let moved = false;

    const redraw = () => {
      _drawSpaceChart(canvas);
      if (minimapCanvas) _drawSpaceMinimap(minimapCanvas, canvas);
    };

    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const point = _canvasPoint(canvas, event.clientX, event.clientY);
      const previousState = { zoom: state.zoom, panX: state.panX, panY: state.panY };
      const previousTransform = _spaceMapTransform(canvas, previousState);
      const worldPoint = _spaceMapToWorld(point, previousTransform);
      const factor = event.deltaY < 0 ? 1.12 : 0.89;
      state.zoom = _clampSpaceZoom(state.zoom * factor);
      const updatedTransform = _spaceMapTransform(canvas, state);
      const screenPoint = _spaceMapToScreen(worldPoint, updatedTransform);
      state.panX += point.x - screenPoint.x;
      state.panY += point.y - screenPoint.y;
      _markSpaceUiInteractive();
      redraw();
    }, { passive: false });

    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      pointerId = event.pointerId;
      dragging = true;
      moved = false;
      startPoint = _canvasPoint(canvas, event.clientX, event.clientY);
      lastPoint = startPoint;
      canvas.setPointerCapture?.(pointerId);
      _markSpaceUiInteractive(800);
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!dragging || event.pointerId !== pointerId || !lastPoint) return;
      const nextPoint = _canvasPoint(canvas, event.clientX, event.clientY);
      const dx = nextPoint.x - lastPoint.x;
      const dy = nextPoint.y - lastPoint.y;
      if (Math.abs(nextPoint.x - startPoint.x) > 4 || Math.abs(nextPoint.y - startPoint.y) > 4) moved = true;
      state.panX += dx;
      state.panY += dy;
      lastPoint = nextPoint;
      _markSpaceUiInteractive(800);
      redraw();
    });

    const stopDrag = (event) => {
      if (event.pointerId !== pointerId) return;
      if (dragging && !moved) {
        const point = _canvasPoint(canvas, event.clientX, event.clientY);
        const hit = _spaceMapNodeAtPoint(canvas, point);
        if (hit) {
          _setSelectedNode(hit);
          _markSpaceUiInteractive();
          _refreshSpaceUI();
        }
      }
      dragging = false;
      pointerId = null;
      startPoint = null;
      lastPoint = null;
      canvas.releasePointerCapture?.(event.pointerId);
    };

    canvas.addEventListener('pointerup', stopDrag);
    canvas.addEventListener('pointercancel', stopDrag);
  }

  function _attachSpaceMinimapInteractions(minimapCanvas, mainCanvas) {
    if (!minimapCanvas || !mainCanvas) return;
    minimapCanvas.addEventListener('click', (event) => {
      const point = _canvasPoint(minimapCanvas, event.clientX, event.clientY);
      const transform = _spaceMapTransform(minimapCanvas, { zoom: 1, panX: 0, panY: 0 });
      const worldPoint = _spaceMapToWorld(point, transform);
      _centerSpaceMapOnWorldPoint(mainCanvas, worldPoint);
      _drawSpaceChart(mainCanvas);
      _drawSpaceMinimap(minimapCanvas, mainCanvas);
      _markSpaceUiInteractive();
    });
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
    if (sys?.systemState?.nearestBodyKey) {
      createDiv(`Nearest: ${sys.getBodyByKey?.(sys.systemState.nearestBodyKey)?.name || sys.systemState.nearestBodyKey}`).parent(row).addClass('space-status-chip space-status-chip-dim');
    }

    const overlay = createDiv().parent(shell).addClass('travel-map-overlay space-command-layout');
    const mapWrap = createDiv().parent(overlay).addClass('travel-map-canvas-wrap space-command-map-wrap');
    const canvasEl = createElement('canvas').parent(mapWrap);
    canvasEl.attribute('width', '920');
    canvasEl.attribute('height', '560');
    canvasEl.addClass('travel-map-canvas');
    canvasEl.addClass('space-command-map-canvas');
    _drawSpaceChart(canvasEl.elt);

    const mapToolbar = createDiv().parent(mapWrap).addClass('space-command-map-toolbar');
    createDiv('Drag to pan • Mouse wheel to zoom • Click a system to inspect it').parent(mapToolbar).addClass('space-command-map-toolbar-copy');
    const mapControls = createDiv().parent(mapToolbar).addClass('space-command-map-controls');
    _button(mapControls, 'Fit Map', true, () => {
      const state = _spaceUiMapState();
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
      _markSpaceUiInteractive();
      _refreshSpaceUI();
    }, 'travel-map-go-btn-secondary');
    _button(mapControls, 'Center Current', !!sys?.currentNode, () => {
      if (!sys?.currentNode) return;
      _centerSpaceMapOnNode(canvasEl.elt, sys.currentNode, Math.max(1, _spaceUiMapState().zoom));
      _refreshSpaceUI();
    }, 'travel-map-go-btn-secondary');

    const minimapShell = createDiv().parent(mapWrap).addClass('space-command-minimap-shell');
    createDiv('Galaxy Minimap').parent(minimapShell).addClass('space-command-minimap-title');
    const minimapCopy = createDiv().parent(minimapShell).addClass('space-command-minimap-copy');
    minimapCopy.html('Viewport frame follows the main chart.<br>Click to recenter the map.');
    const minimapCanvasEl = createElement('canvas').parent(minimapShell);
    minimapCanvasEl.attribute('width', '228');
    minimapCanvasEl.attribute('height', '170');
    minimapCanvasEl.addClass('space-command-minimap-canvas');
    _drawSpaceMinimap(minimapCanvasEl.elt, canvasEl.elt);
    _attachSpaceMapInteractions(canvasEl.elt, minimapCanvasEl.elt);
    _attachSpaceMinimapInteractions(minimapCanvasEl.elt, canvasEl.elt);

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

    const systemCard = createDiv().parent(sidebar).addClass('space-command-card');
    createElement('h4', 'System Scope').parent(systemCard).addClass('space-command-card-title');
    createDiv(
      selected === sys?.currentNode
        ? 'Live orbital view of your current system.'
        : `Preview of ${selectedMeta.label}'s local orbit layout.`
    ).parent(systemCard).addClass('space-command-card-copy');
    const systemCanvasEl = createElement('canvas').parent(systemCard);
    systemCanvasEl.attribute('width', '280');
    systemCanvasEl.attribute('height', '220');
    systemCanvasEl.addClass('space-command-system-preview-canvas');
    _drawSystemPreview(systemCanvasEl.elt, selected);

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
      if ((Number(window._spaceUiInteractiveUntil) || 0) > now) return;
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
