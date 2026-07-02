// ui/spaceTravel.js — Live orbital navigation HUD for the playable space state

(function() {
  'use strict';

  if (typeof uiManager === 'undefined') return;

  const SPACE_FALLBACK_GRAPH = Object.freeze({
    systems: {
      orbit:   { key: 'orbit', label: 'Earth Orbit', kindLabel: 'Home System', description: 'Blue-world home orbit.', accent: '#63c7ff', x: 0.22, y: 0.56 },
      luna:    { key: 'luna', label: 'Luna Reach', kindLabel: 'Station System', description: 'A logistics-heavy system.', accent: '#d6dfff', x: 0.55, y: 0.22 },
      solara:  { key: 'solara', label: 'Solara Prime', kindLabel: 'Forge World', description: 'Industrial cargo and heat lanes.', accent: '#ffb177', x: 0.60, y: 0.18 },
      verdana: { key: 'verdana', label: 'Verdana Canopy', kindLabel: 'Living Trade World', description: 'A diplomatic bio-market world.', accent: '#7ff0b4', x: 0.76, y: 0.50 },
      cryonis: { key: 'cryonis', label: 'Cryonis Deep', kindLabel: 'Frozen Archive World', description: 'Research logistics and buried ruins.', accent: '#bfe8ff', x: 0.60, y: 0.78 },
      nebulith:{ key: 'nebulith', label: 'Nebulith Station', kindLabel: 'Freeport Bazaar', description: 'Volatile broker station.', accent: '#d2c0ff', x: 0.42, y: 0.53 },
      obsidium:{ key: 'obsidium', label: 'Obsidium Reach', kindLabel: 'Pirate Frontier', description: 'Bear pressure and pirate tolls.', accent: '#ff8f86', x: 0.86, y: 0.82 },
    },
    routes: [
      { from: 'orbit', to: 'luna' },
      { from: 'luna', to: 'nebulith' },
      { from: 'luna', to: 'solara' },
      { from: 'nebulith', to: 'verdana' },
      { from: 'solara', to: 'cryonis' },
      { from: 'verdana', to: 'cryonis' },
      { from: 'cryonis', to: 'obsidium' },
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

  function _bearSystem() {
    if (typeof window.BQGetBearEmpireSystem === 'function') {
      const system = window.BQGetBearEmpireSystem();
      if (system && typeof system.getSystemStatus === 'function') return system;
    }
    return null;
  }

  function _bearState() {
    if (typeof window.BQGetBearEmpireState === 'function') {
      const state = window.BQGetBearEmpireState();
      if (state && typeof state === 'object') return state;
    }
    return null;
  }

  function _bearStatus(nodeKey) {
    const system = _bearSystem();
    return system ? system.getSystemStatus(nodeKey) : null;
  }

  function _bearIncident(nodeKey) {
    const system = _bearSystem();
    if (!system || typeof system.getPendingIncidents !== 'function') return null;
    const incidents = system.getPendingIncidents(nodeKey);
    return Array.isArray(incidents) && incidents.length > 0 ? incidents[0] : null;
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
    if (window._isCityManageMode) return GameStates.CITY_MANAGE;
    return (typeof window.BQGetPlayableReturnState === 'function')
      ? window.BQGetPlayableReturnState()
      : GameStates.PLAYING;
  }

  function _normalizeNodeKey(nodeKey) {
    if (!nodeKey || typeof nodeKey !== 'string') return null;
    if (typeof window.BQResolveSpaceNodeKey === 'function') {
      nodeKey = window.BQResolveSpaceNodeKey(nodeKey);
    }
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
      faction: system?.faction || null,
      storyRole: system?.storyRole || null,
      totalRegionScale: Number(system?.totalRegionScale) || (system?.kindLabel === 'Freeport Bazaar' ? 0.7 : 1),
    };
  }

  function _destinationRules(nodeKey, body = null) {
    if (typeof window.BQGetSpaceDestinationRules !== 'function') return null;
    const normalized = _normalizeNodeKey(nodeKey) || nodeKey;
    const graphSystem = normalized ? (_graph().systems?.[normalized] || null) : null;
    const ruleBody = body || graphSystem || null;
    const rules = window.BQGetSpaceDestinationRules(normalized, ruleBody);
    return rules && typeof rules === 'object' ? rules : null;
  }

  function _itemLabel(itemKey) {
    if (!itemKey) return '';
    const lib = (typeof ItemLibrary !== 'undefined') ? ItemLibrary : null;
    return lib?.[itemKey]?.name || itemKey;
  }

  function _formatItemList(items, max = 4) {
    if (!Array.isArray(items) || items.length === 0) return 'None posted';
    const labels = items.slice(0, max).map(_itemLabel);
    if (items.length > max) labels.push(`+${items.length - max}`);
    return labels.join(', ');
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
    const finalizeLaunch = (qteResult = {}) => {
      if (typeof sys.resolveLaunchManeuver === 'function') {
        const maneuver = sys.resolveLaunchManeuver(qteResult.score);
        if (maneuver.damage > 0 && typeof notificationManager !== 'undefined') {
          notificationManager.log(`Rough launch correction: -${maneuver.damage}% hull.`, 'warning');
        }
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
    };

    _runSpaceManeuverQTE(
      typeof sys.getLaunchManeuverConfig === 'function' ? sys.getLaunchManeuverConfig(destination) : null,
      finalizeLaunch
    );
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

  function _attemptAidResistance(nodeKey = null) {
    const system = _bearSystem();
    const target = _normalizeNodeKey(nodeKey || _getSelectedNode());
    if (!system || !target || typeof system.supportResistance !== 'function') return;
    const result = system.supportResistance(target);
    if (!result.ok && typeof notificationManager !== 'undefined') {
      notificationManager.log(`Resistance aid failed: ${result.reason}`, 'warning');
    }
    _refreshSpaceUI();
  }

  function _attemptAidBears(nodeKey = null) {
    const system = _bearSystem();
    const target = _normalizeNodeKey(nodeKey || _getSelectedNode());
    if (!system || !target || typeof system.supportBears !== 'function') return;
    const result = system.supportBears(target);
    if (!result.ok && typeof notificationManager !== 'undefined') {
      notificationManager.log(`Bear support failed: ${result.reason}`, 'warning');
    }
    _refreshSpaceUI();
  }

  function _attemptResolveWarIncident(nodeKey = null) {
    const system = _bearSystem();
    const target = _normalizeNodeKey(nodeKey || _getSelectedNode());
    const incident = target ? _bearIncident(target) : null;
    if (!system || !incident || typeof system.resolveIncident !== 'function') {
      if (typeof notificationManager !== 'undefined') notificationManager.log('No live war incident to resolve here.', 'warning');
      return;
    }

    const finalize = (qteResult = {}) => {
      const result = system.resolveIncident(incident.id, { score: qteResult?.score || 0 });
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(result?.message || `Incident failed: ${result?.reason || 'unknown'}`, result?.ok ? (result.outcome === 'failed' ? 'warning' : 'success') : 'warning');
      }
      _refreshSpaceUI();
    };

    if (typeof window.BQRunSpaceRouteQTE === 'function') {
      window.BQRunSpaceRouteQTE(incident, finalize);
    } else {
      finalize({ score: 0 });
    }
  }

  function _attemptRaymondAssault(nodeKey = null) {
    const system = _bearSystem();
    const sys = _sys();
    const target = _normalizeNodeKey(nodeKey || sys?.currentNode || _getSelectedNode());
    if (!system || !target || typeof system.getRaymondAssaultConfig !== 'function') {
      if (typeof notificationManager !== 'undefined') notificationManager.log('Raymond assault is not available.', 'warning');
      return;
    }
    if (!sys || sys.phase !== 'in_orbit' || sys.currentNode !== target) {
      if (typeof notificationManager !== 'undefined') notificationManager.log('Reach Raymond\'s capital system before starting the assault.', 'warning');
      return;
    }

    const config = system.getRaymondAssaultConfig(target);
    if (!config?.ok) {
      if (typeof notificationManager !== 'undefined') notificationManager.log(`Final assault locked: ${config?.reason || 'unavailable'}.`, 'warning');
      return;
    }

    const beginCombat = (qteResult = {}) => {
      const approach = typeof system.resolveRaymondAssaultApproach === 'function'
        ? system.resolveRaymondAssaultApproach(target, qteResult?.score || 0)
        : { ok: false, reason: 'missing_assault_resolver' };
      if (!approach?.ok) {
        if (typeof notificationManager !== 'undefined') notificationManager.log(`Final assault failed: ${approach?.reason || 'unknown'}.`, 'warning');
        return;
      }

      const ship = _ship();
      if (approach.shipDamage > 0 && ship && typeof ship.applyDamage === 'function') {
        ship.applyDamage(approach.shipDamage);
      }
      if (typeof notificationManager !== 'undefined') {
        const damageText = approach.shipDamage > 0 ? ` Hull -${approach.shipDamage}%.` : '';
        notificationManager.log(`${approach.message}${damageText}`, approach.rating === 'failed' || approach.rating === 'rough' ? 'warning' : 'success');
      }

      if (typeof combatSystem === 'undefined' || !combatSystem || typeof combatSystem.startCombat !== 'function' || typeof Raider === 'undefined') {
        if (typeof notificationManager !== 'undefined') notificationManager.log('Combat system is not ready for Raymond.', 'error');
        return;
      }

      const currentPlayer = _player();
      const raymond = new Raider({
        x: Number.isFinite(Number(currentPlayer?.x)) ? currentPlayer.x : 0,
        y: Number.isFinite(Number(currentPlayer?.y)) ? currentPlayer.y : 0,
        strength: approach.raymondStrength,
        patrolPoints: [],
        type: 'raymond',
        name: 'Raymond the Bear',
        onDefeated: () => {
          if (typeof system.markRaymondDefeated === 'function') system.markRaymondDefeated();
          if (typeof notificationManager !== 'undefined') {
            notificationManager.log('Raymond the Bear is defeated. The Bear Empire fractures across the galaxy.', 'success');
          }
          if (typeof window._refreshSpaceUI === 'function') window._refreshSpaceUI();
        },
      });
      raymond.loot.gold = Math.max(1200, 1800 + (Number(system.empireStrength) || 0) * 8);
      raymond.loot.items = Array.isArray(raymond.loot.items) ? raymond.loot.items : [];
      combatSystem.startCombat(raymond);
    };

    if (typeof window.BQRunSpaceRouteQTE === 'function') {
      window.BQRunSpaceRouteQTE(config, beginCombat);
    } else {
      beginCombat({ score: 0, skipped: true });
    }
  }

  function _attemptReentry() {
    const sys = _sys();
    if (!sys || typeof sys.beginReentry !== 'function') return;
    _runSpaceManeuverQTE(
      typeof sys.getReentryManeuverConfig === 'function' ? sys.getReentryManeuverConfig() : null,
      (qteResult = {}) => {
        const result = sys.beginReentry({ qteScore: qteResult.score });
        if (!result.ok) {
          if (typeof notificationManager !== 'undefined') notificationManager.log(`Re-entry failed: ${result.reason}`, 'warning');
          return;
        }
        if (typeof notificationManager !== 'undefined') notificationManager.log('Re-entry corridor confirmed.', 'info');
        window._spaceMapOpen = false;
        _refreshSpaceUI();
      }
    );
  }

  function _attemptDock() {
    const sys = _sys();
    if (!sys || typeof sys.dockNearestBody !== 'function') return;
    const nearest = typeof sys.getNearestBody === 'function' ? sys.getNearestBody() : null;
    if (!nearest) {
      if (typeof notificationManager !== 'undefined') notificationManager.log('No dockable body nearby.', 'warning');
      return;
    }
    _runSpaceManeuverQTE(
      typeof sys.getDockingManeuverConfig === 'function' ? sys.getDockingManeuverConfig(nearest) : null,
      (qteResult = {}) => {
        const result = sys.dockNearestBody({ qteScore: qteResult.score });
        if (!result.ok) {
          if (typeof notificationManager !== 'undefined') notificationManager.log('No dockable body nearby.', 'warning');
          return;
        }
        if (result.damage > 0 && typeof notificationManager !== 'undefined') {
          notificationManager.log(`Rough approach: -${result.damage}% hull.`, 'warning');
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
          if (typeof gameStateManager !== 'undefined') {
            const targetState = (typeof window.BQGetSurfaceGameplayState === 'function')
              ? window.BQGetSurfaceGameplayState(landed.session)
              : GameStates.PLAYING;
            gameStateManager.setState(targetState);
          }
          return;
        }
        if (typeof notificationManager !== 'undefined') notificationManager.log(`Docked at ${result.body.name}.`, 'success');
        _syncLegacySpaceState();
        _refreshSpaceUI();
      }
    );
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

  function _spaceRouteQteAssistScore() {
    const mods = _player()?.modifiers || null;
    if (!mods?.qteAssist) return null;
    return Math.max(0, Math.min(100, Number(mods.qteRaidScore) || 78));
  }

  function _spaceRouteQteSequence(seedInput, length) {
    const dirs = [
      { code: 37, label: '←' },
      { code: 38, label: '↑' },
      { code: 39, label: '→' },
      { code: 40, label: '↓' },
    ];
    let seed = 0;
    const str = String(seedInput || 'space-qte');
    for (let i = 0; i < str.length; i += 1) {
      seed = ((seed * 31) + str.charCodeAt(i)) >>> 0;
    }
    const nextRand = () => {
      seed = ((seed * 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const out = [];
    let lastCode = null;
    for (let i = 0; i < length; i += 1) {
      let entry = dirs[Math.floor(nextRand() * dirs.length)];
      if (entry.code === lastCode) {
        entry = dirs[(dirs.indexOf(entry) + 1) % dirs.length];
      }
      out.push(entry);
      lastCode = entry.code;
    }
    return out;
  }

  function _runSpaceRouteQTE(config, onDone) {
    const finish = (result) => {
      window._spaceRouteQTEActive = false;
      if (typeof onDone === 'function') onDone(result || { score: 0, timedOut: true });
    };

    const assistScore = _spaceRouteQteAssistScore();
    if (assistScore != null) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`${config?.autopilotText || 'Tactical Autopilot handled the space maneuver'} (${assistScore}).`, 'info');
      }
      finish({ score: assistScore, timedOut: false, auto: true });
      return;
    }

    if (typeof document === 'undefined' || !document.body) {
      finish({ score: 0, timedOut: true, missingUi: true });
      return;
    }

    document.getElementById('spaceRouteQTEOverlay')?.remove();
    window._spaceRouteQTEActive = true;

    const qte = config?.qte || {};
    const sequence = _spaceRouteQteSequence(qte.seed || config?.title || 'space-route', Math.max(3, Math.floor(Number(qte.sequenceLength) || 4)));
    const timeLimitMs = Math.max(2200, Math.floor(Number(qte.timeLimitMs) || 4200));
    const passScore = Math.max(0, Math.floor(Number(qte.passScore) || 64));
    const overlay = document.createElement('div');
    overlay.id = 'spaceRouteQTEOverlay';
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:99999',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:rgba(4,9,18,0.92)',
      'font-family:monospace',
    ].join(';');

    const card = document.createElement('div');
    card.style.cssText = [
      'width:min(540px,92vw)',
      'padding:22px 24px',
      'border-radius:18px',
      'border:1px solid rgba(135,176,255,0.28)',
      'background:linear-gradient(180deg, rgba(14,24,41,0.96), rgba(8,13,24,0.98))',
      'box-shadow:0 30px 80px rgba(0,0,0,0.42)',
      'color:#e9f2ff',
    ].join(';');
    overlay.appendChild(card);

    const eyebrow = document.createElement('div');
    eyebrow.textContent = config?.eyebrow || (config?.routeThreat === 'fortified' ? 'FORTIFIED CORRIDOR' : 'SPACE QTE');
    eyebrow.style.cssText = 'font-size:11px;letter-spacing:0.22em;color:#8bb5ff;margin-bottom:10px;';
    card.appendChild(eyebrow);

    const title = document.createElement('div');
    title.textContent = config?.title || 'Blockade Break';
    title.style.cssText = 'font-size:28px;font-weight:700;margin-bottom:8px;';
    card.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = config?.subtitle || 'Match the route commands before the blockade closes.';
    subtitle.style.cssText = 'font-size:14px;line-height:1.5;color:#bcd0e9;margin-bottom:16px;';
    card.appendChild(subtitle);

    const status = document.createElement('div');
    status.textContent = config?.statusText || `Input ${sequence.length} course corrections. Pass score ${passScore}.`;
    status.style.cssText = 'font-size:13px;color:#ffd78e;margin-bottom:14px;';
    card.appendChild(status);

    const timerWrap = document.createElement('div');
    timerWrap.style.cssText = 'height:10px;border-radius:999px;background:rgba(255,255,255,0.08);overflow:hidden;margin-bottom:18px;';
    const timerBar = document.createElement('div');
    timerBar.style.cssText = 'height:100%;width:100%;background:linear-gradient(90deg,#69e8d1,#ffd069,#ff8b8b);transform-origin:left center;';
    timerWrap.appendChild(timerBar);
    card.appendChild(timerWrap);

    const seqWrap = document.createElement('div');
    seqWrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));gap:10px;margin-bottom:18px;';
    card.appendChild(seqWrap);
    const seqNodes = sequence.map((entry) => {
      const el = document.createElement('div');
      el.textContent = entry.label;
      el.style.cssText = [
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'height:64px',
        'border-radius:14px',
        'border:1px solid rgba(255,255,255,0.12)',
        'background:rgba(255,255,255,0.04)',
        'font-size:30px',
        'font-weight:700',
        'color:#dfeaff',
      ].join(';');
      seqWrap.appendChild(el);
      return el;
    });

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:space-between;gap:14px;align-items:center;font-size:12px;color:#9bb0c9;';
    footer.innerHTML = `
      <span>Arrow keys only. Wrong inputs cut score.</span>
      <span>${Math.round(timeLimitMs / 100) / 10}s window</span>
    `;
    card.appendChild(footer);

    document.body.appendChild(overlay);

    let index = 0;
    let mistakes = 0;
    let closed = false;
    const startedAt = performance.now();

    const cleanup = (result) => {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      finish(result);
    };

    const updateTimer = () => {
      if (closed) return;
      const elapsed = performance.now() - startedAt;
      const remaining = Math.max(0, 1 - (elapsed / timeLimitMs));
      timerBar.style.transform = `scaleX(${remaining})`;
      if (remaining <= 0) {
        const completion = index / sequence.length;
        const score = Math.max(0, Math.round((completion * 70) - (mistakes * 10)));
        cleanup({ score, timedOut: true, completed: index >= sequence.length });
        return;
      }
      requestAnimationFrame(updateTimer);
    };

    const markProgress = () => {
      seqNodes.forEach((node, nodeIndex) => {
        if (nodeIndex < index) {
          node.style.background = 'rgba(84, 208, 166, 0.22)';
          node.style.borderColor = 'rgba(84, 208, 166, 0.8)';
          node.style.color = '#c9ffea';
        } else if (nodeIndex === index) {
          node.style.background = 'rgba(255, 208, 105, 0.20)';
          node.style.borderColor = 'rgba(255, 208, 105, 0.88)';
          node.style.color = '#fff2c5';
        } else {
          node.style.background = 'rgba(255,255,255,0.04)';
          node.style.borderColor = 'rgba(255,255,255,0.12)';
          node.style.color = '#dfeaff';
        }
      });
    };

    const onKey = (event) => {
      if (closed) return;
      const expected = sequence[index];
      if (!expected) return;
      if (![37, 38, 39, 40].includes(event.keyCode || event.which)) return;
      event.preventDefault();
      event.stopPropagation();

      const code = event.keyCode || event.which;
      if (code === expected.code) {
        index += 1;
        status.textContent = index >= sequence.length
          ? 'Corridor aligned. Breaking through.'
          : `Good. ${sequence.length - index} corrections left.`;
      } else {
        mistakes += 1;
        status.textContent = 'Wrong correction. Recover the line.';
      }
      markProgress();

      if (index >= sequence.length) {
        const elapsed = performance.now() - startedAt;
        const timeScore = Math.max(0.55, 1 - (elapsed / timeLimitMs));
        const precision = Math.max(0.2, 1 - (mistakes * 0.18));
        const score = Math.max(0, Math.min(100, Math.round(100 * timeScore * precision)));
        cleanup({ score, timedOut: false, completed: true, mistakes });
      }
    };

    markProgress();
    document.addEventListener('keydown', onKey, true);
    requestAnimationFrame(updateTimer);
  }

  function _runSpaceManeuverQTE(config, onDone) {
    if (!config || typeof onDone !== 'function') {
      if (typeof onDone === 'function') onDone({ score: 70, skipped: true });
      return;
    }
    if (typeof window.BQRunSpaceRouteQTE === 'function') {
      window.BQRunSpaceRouteQTE(config, onDone);
      return;
    }
    _runSpaceRouteQTE(config, onDone);
  }

  function _drawConflictMarker(ctx, point, status, opts = {}) {
    if (!status) return;
    const radius = opts.minimap ? 10 : 18;
    const resistanceRadius = opts.minimap ? 3 : 5;

    if (status.visibility === 'fortified') {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 72, 72, 0.18)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 6, 0, Math.PI * 2);
      ctx.lineWidth = opts.minimap ? 1.5 : 2.5;
      ctx.strokeStyle = 'rgba(255, 138, 138, 0.92)';
      ctx.stroke();
    } else if (status.visibility === 'occupied') {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 80, 80, 0.12)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 3, 0, Math.PI * 2);
      ctx.lineWidth = opts.minimap ? 1.3 : 2.2;
      ctx.strokeStyle = 'rgba(255, 110, 110, 0.9)';
      ctx.stroke();
    } else if (status.visibility === 'confirmed' || status.visibility === 'rumored') {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 2, 0, Math.PI * 2);
      ctx.lineWidth = opts.minimap ? 1.2 : 2;
      ctx.strokeStyle = status.visibility === 'confirmed'
        ? 'rgba(255, 193, 92, 0.95)'
        : 'rgba(255, 221, 143, 0.75)';
      ctx.setLineDash(opts.minimap ? [2, 3] : [6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (status.resistanceKnown) {
      ctx.save();
      ctx.translate(point.x, point.y - (opts.minimap ? 11 : 17));
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = 'rgba(74, 232, 201, 0.95)';
      ctx.fillRect(-resistanceRadius, -resistanceRadius, resistanceRadius * 2, resistanceRadius * 2);
      ctx.restore();
    }
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
      const crisis = _bearStatus(nodeKey);

      if (isCurrent || isSelected) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, isCurrent ? 26 : 20, 0, Math.PI * 2);
        ctx.fillStyle = isCurrent ? 'rgba(255,208,105,0.24)' : 'rgba(125,201,255,0.18)';
        ctx.fill();
      }

      _drawConflictMarker(ctx, point, crisis);

      const regionScale = Math.max(0.62, Math.min(1.55, Number(meta.totalRegionScale) || 1));
      const nodeRadius = meta.kind === 'Freeport Bazaar' ? 18 : Math.round(13 + (regionScale * 8));
      ctx.beginPath();
      ctx.arc(point.x, point.y, nodeRadius + 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(202, 163, 80, 0.08)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(point.x, point.y, nodeRadius, 0, Math.PI * 2);
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
      ctx.fillText(meta.label, point.x, point.y + nodeRadius + 6);
      if (meta.totalRegionScale && meta.totalRegionScale >= 1.15) {
        ctx.fillStyle = '#caa350';
        ctx.font = '600 9px sans-serif';
        ctx.fillText(`${meta.totalRegionScale.toFixed(2)}× Earth regions`, point.x, point.y + nodeRadius + 20);
      }
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
      const crisis = _bearStatus(nodeKey);
      _drawConflictMarker(ctx, point, crisis, { minimap: true });
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

  function _localBodies() {
    const sys = _sys();
    const state = typeof sys?.getCurrentSystemState === 'function' ? sys.getCurrentSystemState() : null;
    if (!state?.bodies) return [];
    const ship = state.ship || null;
    return state.bodies
      .filter((body) => body && body.kind !== 'asteroid')
      .map((body) => {
        const rawDistance = ship ? Math.hypot((ship.x || 0) - (body.x || 0), (ship.y || 0) - (body.y || 0)) : null;
        return {
          ...body,
          distanceFromShip: rawDistance == null ? null : Math.max(0, Math.round(rawDistance - (body.radius || 0))),
          isNearest: state.nearestBodyKey === body.key,
        };
      })
      .sort((a, b) => {
        if (a.isNearest && !b.isNearest) return -1;
        if (!a.isNearest && b.isNearest) return 1;
        return (a.distanceFromShip ?? Number.POSITIVE_INFINITY) - (b.distanceFromShip ?? Number.POSITIVE_INFINITY);
      });
  }

  function _routeMetaBits(route) {
    const bits = [
      `Distance ${route.distance}`,
      `Danger ${Math.round(route.dangerRating * 100)}%`,
    ];
    if (route.conflict?.routeThreat && route.conflict.routeThreat !== 'clear') {
      bits.push(route.conflict.routeThreat === 'occupied' ? 'Bear blockade' : `${route.conflict.routeThreat} zone`);
    }
    return bits.join(' · ');
  }

  function _canvasElement(parent, width, height, className) {
    const canvas = createElement('canvas').parent(parent);
    canvas.attribute('width', String(width));
    canvas.attribute('height', String(height));
    if (className) canvas.addClass(className);
    return canvas;
  }

  function _renderStarChartCard(parent, sys, selectedMeta) {
    const chartCard = createDiv().parent(parent).addClass('space-command-card');
    createElement('h4', 'Trade Star Map').parent(chartCard).addClass('space-command-card-title');
    createDiv(
      sys?.phase === 'grounded'
        ? 'Linked systems, launch costs, market pressure, and route danger before leaving port.'
        : 'Frontier trade lanes, blockade pressure, and nearby docking opportunities.'
    ).parent(chartCard).addClass('space-command-card-copy');

    const mapWrap = createDiv().parent(chartCard).addClass('space-command-map-wrap');
    const toolbar = createDiv().parent(mapWrap).addClass('space-command-map-toolbar');
    createDiv(
      `Focused system: ${selectedMeta?.label || 'Unknown'}`
    ).parent(toolbar).addClass('space-command-map-toolbar-copy');
    const controls = createDiv().parent(toolbar).addClass('space-command-map-controls');

    const chartCanvas = _canvasElement(mapWrap, 1080, 680, 'space-command-map-canvas');
    const mainCanvas = chartCanvas.elt;
    const mapState = _spaceUiMapState();
    if (!mapState.initialCenteredNode) {
      _centerSpaceMapOnNode(mainCanvas, _getSelectedNode() || _normalizeNodeKey(sys?.currentNode) || 'orbit', 1.08);
      mapState.initialCenteredNode = _getSelectedNode() || _normalizeNodeKey(sys?.currentNode) || 'orbit';
    }

    const redraw = () => {
      _drawSpaceChart(mainCanvas);
      _drawSpaceMinimap(minimapCanvas.elt, mainCanvas);
      _drawSystemPreview(previewCanvas.elt, _getSelectedNode());
    };

    _button(controls, 'Zoom In', true, () => {
      mapState.zoom = _clampSpaceZoom((Number(mapState.zoom) || 1) * 1.15);
      _markSpaceUiInteractive();
      redraw();
    }, 'travel-map-go-btn-secondary');
    _button(controls, 'Zoom Out', true, () => {
      mapState.zoom = _clampSpaceZoom((Number(mapState.zoom) || 1) * 0.87);
      _markSpaceUiInteractive();
      redraw();
    }, 'travel-map-go-btn-secondary');
    _button(controls, 'Center Current', !!_normalizeNodeKey(sys?.currentNode), () => {
      _centerSpaceMapOnNode(mainCanvas, _normalizeNodeKey(sys?.currentNode) || 'orbit');
      redraw();
    }, 'travel-map-go-btn-secondary');

    const miniShell = createDiv().parent(mapWrap).addClass('space-command-minimap-shell');
    createDiv('Ledger View').parent(miniShell).addClass('space-command-minimap-title');
    createDiv('Route shape, local bodies, and selected-system trade context.').parent(miniShell).addClass('space-command-minimap-copy');
    const minimapCanvas = _canvasElement(miniShell, 320, 208, 'space-command-minimap-canvas');
    const previewCanvas = _canvasElement(miniShell, 320, 208, 'space-command-system-preview-canvas');

    _drawSpaceChart(mainCanvas);
    _drawSpaceMinimap(minimapCanvas.elt, mainCanvas);
    _drawSystemPreview(previewCanvas.elt, _getSelectedNode());
    _attachSpaceMapInteractions(mainCanvas, minimapCanvas.elt);
    _attachSpaceMinimapInteractions(minimapCanvas.elt, mainCanvas);
  }

  function _renderCollapsedHud(parent) {
    const sys = _sys();
    const nearest = typeof sys?.getNearestBody === 'function' ? sys.getNearestBody() : null;
    const meta = _nodeMeta(sys?.currentNode || 'orbit');
    const shell = createDiv().parent(parent).addClass('space-compact-shell');
    const card = createDiv().parent(shell).addClass('space-compact-card');
    createDiv(`${meta.label} · ${_phaseLabel(sys?.phase || 'grounded')}`).parent(card).addClass('space-compact-title');
    createDiv(sys?.targetNode
      ? `Plotted jump: ${_nodeMeta(sys.targetNode)?.label || sys.targetNode}`
      : nearest
        ? `Nearby: ${nearest.name}`
        : 'Navigation panel hidden').parent(card).addClass('space-compact-copy');
    const row = createDiv().parent(card).addClass('space-compact-actions');
    _button(row, 'Show Nav', true, () => {
      window._spaceHudCollapsed = false;
      _refreshSpaceUI();
    }, 'travel-map-go-btn-secondary');
  }

  function _renderFlightOverlay(parent) {
    const sys = _sys();
    const selected = _getSelectedNode();
    const selectedMeta = _nodeMeta(selected) || _nodeMeta(sys?.currentNode || 'orbit') || {
      key: 'orbit',
      label: 'Earth Orbit',
      kind: 'System',
      description: 'Orbital navigation',
    };
    const selectedRoute = _selectedRoute();
    const ship = _ship();
    const crisis = _bearState();
    const bearStatus = _bearStatus(selected);
    const bearIncident = _bearIncident(selected);
    const nearest = typeof sys?.getNearestBody === 'function' ? sys.getNearestBody() : null;
    const localBodies = _localBodies();
    const routes = _availableRoutes();
    const currentMeta = _nodeMeta(sys?.currentNode || 'orbit') || selectedMeta;
    const shell = createDiv().parent(parent).addClass('space-flight-shell');
    const panel = createDiv().parent(shell).addClass('space-flight-panel');

    const header = createDiv().parent(panel).addClass('space-command-card');
    createDiv(sys?.phase === 'grounded' ? 'Launch Office' : 'Frontier Route Board').parent(header).addClass('space-command-eyebrow');
    createElement('h3', `${currentMeta.label} · ${_phaseLabel(sys?.phase || 'grounded')}`).parent(header).addClass('space-command-card-title');
    createDiv(
      sys?.phase === 'grounded'
        ? `Plan a profitable launch from ${_launchCity()?.name || 'your launch site'}.`
        : 'Keep the same merchant routine: watch cargo, hull, fuel, danger, and the next good market.'
    ).parent(header).addClass('space-command-card-copy');

    const headerActions = createDiv().parent(header).addClass('space-compact-actions');
    if (sys?.phase === 'grounded') {
      _button(headerActions, 'Close', true, _closeSpaceMode, 'space-command-nav-btn space-command-close-btn');
    } else {
      _button(headerActions, 'Hide Nav', true, () => {
        window._spaceHudCollapsed = true;
        _refreshSpaceUI();
      }, 'travel-map-go-btn-secondary');
    }

    const status = createDiv().parent(panel).addClass('space-status-strip');
    const row = createDiv().parent(status).addClass('space-status-row');
    createDiv(_phaseLabel(sys?.phase || 'grounded')).parent(row).addClass('space-status-chip');
    if (ship) {
      createDiv(`${ship.displayName} · ${ship.condition}% hull`).parent(row).addClass('space-status-chip space-status-chip-dim');
    }
    if (sys?.currentNode) {
      createDiv(`Current: ${currentMeta.label}`).parent(row).addClass('space-status-chip space-status-chip-dim');
    }
    if (sys?.targetNode) {
      createDiv(`Plotted: ${_nodeMeta(sys.targetNode)?.label || sys.targetNode}`).parent(row).addClass('space-status-chip').style('color', '#ffd069');
    }
    if (nearest) {
      createDiv(`Nearest: ${nearest.name}`).parent(row).addClass('space-status-chip space-status-chip-dim');
    }
    if (crisis?.active && crisis.raymondDefeated) {
      createDiv('Galaxy Liberated').parent(row).addClass('space-status-chip space-status-chip-success');
    } else if (crisis?.active) {
      createDiv(`Bear Pressure ${crisis.empireStrength}`).parent(row).addClass('space-status-chip space-status-chip-alert');
      createDiv(`Resistance ${crisis.resistanceStrength}`).parent(row).addClass('space-status-chip').style('color', '#7ef2d5');
      const alignmentChip = _bearAlignmentChip(crisis.alignment);
      if (alignmentChip) createDiv(alignmentChip.label).parent(row).addClass('space-status-chip').style('color', alignmentChip.color);
      if (crisis.intelPoints > 0) createDiv(`Intel ${crisis.intelPoints}`).parent(row).addClass('space-status-chip space-status-chip-dim');
      if (crisis.tributeCollected > 0) createDiv(`Tribute ${crisis.tributeCollected}`).parent(row).addClass('space-status-chip space-status-chip-dim');
    }

    _renderStarChartCard(panel, sys, selectedMeta);

    const focusCard = createDiv().parent(panel).addClass('space-command-card');
    createElement('h4', selectedMeta.label).parent(focusCard).addClass('space-command-card-title');
    createP(selectedMeta.description || 'Orbital destination').parent(focusCard).addClass('space-command-card-copy');
    const selectedRules = _destinationRules(selected);
    if (selectedRules?.thesis) {
      createDiv(selectedRules.thesis).parent(focusCard).addClass('space-command-route-meta');
    }
    const chips = createDiv().parent(focusCard).addClass('space-command-chip-row');
    createSpan(selectedMeta.kind).parent(chips).addClass('space-command-chip');
    if (selectedRules?.hazard) createSpan(selectedRules.hazard).parent(chips).addClass('space-command-chip space-command-chip-alert');
    if (selectedRules?.factionName) createSpan(selectedRules.factionName).parent(chips).addClass('space-command-chip');
    if (sys?.currentNode === selected) createSpan('Current System').parent(chips).addClass('space-command-chip space-command-chip-success');
    if (sys?.targetNode === selected) createSpan('Jump Plotted').parent(chips).addClass('space-command-chip space-command-chip-alert');
    if (bearStatus?.visibility === 'rumored') createSpan('Bear Rumors').parent(chips).addClass('space-command-chip');
    if (bearStatus?.visibility === 'confirmed') createSpan('Bear Threat').parent(chips).addClass('space-command-chip space-command-chip-alert');
    if (bearStatus?.visibility === 'occupied') createSpan('Bear Occupied').parent(chips).addClass('space-command-chip space-command-chip-alert');
    if (bearStatus?.visibility === 'fortified') createSpan('Bear Stronghold').parent(chips).addClass('space-command-chip space-command-chip-alert');
    if (bearStatus?.resistanceKnown) createSpan('DK Resistance').parent(chips).addClass('space-command-chip space-command-chip-success');
    if (bearIncident?.title) createSpan(bearIncident.title).parent(chips).addClass('space-command-chip space-command-chip-alert');

    const metrics = createDiv().parent(focusCard).addClass('space-command-metrics');
    const addMetric = (label, value) => {
      const metric = createDiv().parent(metrics).addClass('space-command-metric');
      createDiv(label).parent(metric).addClass('space-command-metric-label');
      createDiv(value).parent(metric).addClass('space-command-metric-value');
    };
    if (selectedRoute) {
      addMetric('Distance', String(selectedRoute.distance));
      addMetric('Danger', `${Math.round(selectedRoute.dangerRating * 100)}%`);
      if (selectedRoute.conflict?.routeThreat && selectedRoute.conflict.routeThreat !== 'clear') {
        addMetric('Threat', selectedRoute.conflict.routeThreat.replace(/^\w/, (m) => m.toUpperCase()));
      }
    } else if (sys?.currentNode === selected && localBodies.length > 0) {
      addMetric('Dockables', String(localBodies.length));
      addMetric('Nearest', nearest?.name || 'None');
      addMetric('Focus', sys?.targetNode ? 'Jump Armed' : 'Free Flight');
    }
    if (crisis?.active && bearStatus) {
      if (bearStatus.visibility) addMetric('Bear Status', bearStatus.visibility.replace(/^\w/, (m) => m.toUpperCase()));
      if (bearStatus.dangerModifier > 0) addMetric('War Risk', `+${Math.round(bearStatus.dangerModifier * 100)}%`);
      if (bearStatus.tradePenalty > 0) addMetric('Trade Tax', `+${Math.round(bearStatus.tradePenalty * 100)}%`);
    }
    if (selectedRules) {
      addMetric('Buys', _formatItemList(selectedRules.imports));
      addMetric('Sells', _formatItemList(selectedRules.exports));
      if (selectedRules.opportunity) addMetric('Opportunity', selectedRules.opportunity);
      if (selectedRules.localRule) addMetric('Local Rule', selectedRules.localRule);
    }

    const actions = createDiv().parent(panel).addClass('space-command-card');
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
    } else if (sys?.phase === 'launch_prep' || sys?.phase === 'ascending') {
      createElement('div', sys?.phase === 'launch_prep' ? 'Launch QTE active — press arrow keys' : 'Ascending to orbit…')
        .parent(actionStack)
        .style('color', '#8bb5ff')
        .style('font-size', '13px')
        .style('padding', '6px 0');
    } else if (sys?.phase === 'in_orbit') {
      if (selectedRoute) _button(actionStack, `Plot Jump to ${selectedMeta.label}`, true, () => _attemptPlotRoute(selected));
      if (sys?.targetNode) {
        _button(actionStack, 'Clear Plotted Jump', typeof sys.clearRoute === 'function', () => {
          if (typeof sys.clearRoute === 'function') sys.clearRoute();
          _refreshSpaceUI();
        }, 'travel-map-go-btn-secondary');
      }
      _button(actionStack, 'Dock Nearest Body', !!nearest, _attemptDock, 'travel-map-go-btn-secondary');
      _button(actionStack, sys.currentNode === 'orbit' ? 'Return to Ground' : 'Re-entry Locked', sys.currentNode === 'orbit', _attemptReentry, 'travel-map-go-btn-secondary');
    } else if (sys?.phase === 'landed') {
      _button(actionStack, 'Lift Off', true, _attemptLiftOff);
    }
    if (sys?.currentNode && selected !== sys.currentNode) {
      _button(actionStack, `Focus ${currentMeta.label}`, true, () => {
        _setSelectedNode(sys.currentNode);
        _refreshSpaceUI();
      }, 'travel-map-go-btn-secondary');
    }

    if (crisis?.active && bearStatus && selected !== 'orbit') {
      _button(
        actionStack,
        bearStatus.occupied ? 'Run Resistance Relief' : 'Deliver Resistance Aid',
        !!bearStatus.canAidResistance,
        () => _attemptAidResistance(selected),
        'travel-map-go-btn-secondary'
      );
      _button(
        actionStack,
        bearStatus.occupied ? 'Haul Bear Tribute' : 'Take Bear Contract',
        !!bearStatus.canAidBears,
        () => _attemptAidBears(selected),
        'travel-map-go-btn-secondary'
      );
      if (bearIncident) {
        _button(
          actionStack,
          bearIncident.type === 'signal_trace'
            ? 'Run Signal Trace'
            : bearIncident.type === 'bear_inspection'
              ? 'Face Inspection'
              : 'Open Aid Corridor',
          true,
          () => _attemptResolveWarIncident(selected),
          'travel-map-go-btn-secondary'
        );
      }
      const raymondCheck = typeof crisis.capitalSystemKey === 'string' && typeof _bearSystem()?.canStartRaymondAssault === 'function'
        ? _bearSystem().canStartRaymondAssault(selected)
        : null;
      const atRaymondCapital = !!(
        raymondCheck?.ok
        && sys?.phase === 'in_orbit'
        && sys?.currentNode === selected
      );
      if (raymondCheck?.reason === 'bear_aligned' && bearStatus.fortified) {
        _button(actionStack, 'Assault Locked · Bear Collaborator', false, () => {}, 'travel-map-go-btn-secondary');
      } else if (raymondCheck?.ok || bearStatus.fortified) {
        _button(
          actionStack,
          atRaymondCapital ? 'Assault Raymond' : 'Reach Capital to Assault',
          atRaymondCapital,
          () => _attemptRaymondAssault(selected),
          'travel-map-go-btn'
        );
      }
    }

    if (localBodies.length > 0 && sys?.phase !== 'grounded') {
      const bodyCard = createDiv().parent(panel).addClass('space-command-card');
      createElement('h4', 'Docking Targets').parent(bodyCard).addClass('space-command-card-title');
      const bodyList = createDiv().parent(bodyCard).addClass('space-command-route-list');
      for (const body of localBodies) {
        const bodyRow = createDiv().parent(bodyList).addClass('space-command-route-row');
        const copy = createDiv().parent(bodyRow).addClass('space-command-route-copy');
        createDiv(body.name).parent(copy).addClass('space-command-route-title');
        const bodyBits = [
          body.kind,
          body.distanceFromShip == null ? 'No lock' : `${body.distanceFromShip}u`,
        ];
        if (body.isNearest) bodyBits.push('Nearest');
        if (sys?.currentBodyKey === body.key) bodyBits.push('Docked');
        createDiv(bodyBits.join(' · ')).parent(copy).addClass('space-command-route-meta');
        createDiv(body.isNearest ? 'Nearest' : 'Local').parent(bodyRow).addClass(`space-command-chip ${body.isNearest ? 'space-command-chip-success' : ''}`);
      }
    }

    const routeCard = createDiv().parent(panel).addClass('space-command-card');
    createElement('h4', sys?.phase === 'grounded' ? 'Launch Corridors' : 'Connected Systems').parent(routeCard).addClass('space-command-card-title');
    const routeList = createDiv().parent(routeCard).addClass('space-command-route-list');
    if (routes.length === 0) {
      createDiv('No linked systems available from here yet.').parent(routeCard).addClass('space-command-empty');
    } else {
      for (const route of routes) {
        const meta = _nodeMeta(route.destination);
        const routeRow = createDiv().parent(routeList).addClass('space-command-route-row');
        const copy = createDiv().parent(routeRow).addClass('space-command-route-copy');
        createDiv(meta.label).parent(copy).addClass('space-command-route-title');
        createDiv(_routeMetaBits(route)).parent(copy).addClass('space-command-route-meta');
        if (selected === route.destination) {
          createDiv(sys?.phase === 'grounded' ? 'Selected' : (sys?.targetNode === route.destination ? 'Plotted' : 'Focused'))
            .parent(routeRow)
            .addClass(`space-command-chip ${sys?.targetNode === route.destination ? 'space-command-chip-alert' : 'space-command-chip-success'}`);
        } else {
          _button(routeRow, 'Focus', true, () => {
            _setSelectedNode(route.destination);
            _refreshSpaceUI();
          }, 'travel-map-go-btn-secondary');
        }
      }
    }

    if (bearIncident) {
      const incidentCard = createDiv().parent(panel).addClass('space-command-card');
      createElement('h4', 'War Incident').parent(incidentCard).addClass('space-command-card-title');
      createDiv(bearIncident.title).parent(incidentCard).addClass('space-command-route-title');
      createDiv(bearIncident.summary || bearIncident.subtitle || '').parent(incidentCard).addClass('space-command-card-copy');
      if (bearIncident.rewardText) createDiv(`Reward: ${bearIncident.rewardText}`).parent(incidentCard).addClass('space-command-route-meta');
      if (bearIncident.riskText) createDiv(`Risk: ${bearIncident.riskText}`).parent(incidentCard).addClass('space-command-route-meta');
      if (bearIncident.expiresDay) createDiv(`Expires: Day ${bearIncident.expiresDay}`).parent(incidentCard).addClass('space-command-route-meta');
    }

    if (crisis?.active) _renderWarLogCard(panel, crisis);

    if (sys?.phase !== 'grounded') _renderIPOCard(panel, sys);
  }

  // Compact label + colour for the current war alignment, or null when neutral.
  function _bearAlignmentChip(alignment) {
    switch (alignment) {
      case 'resistance_aligned': return { label: 'Resistance Ally', color: '#7ef2d5' };
      case 'bear_aligned': return { label: 'Bear Collaborator', color: '#ff9e6b' };
      case 'double_dealing': return { label: 'Double-Dealing', color: '#ffd069' };
      default: return null;
    }
  }

  // Renders the Bear Empire activity feed (already carried on getState()) as a
  // scrollable war-log card so the war's history is legible to the player.
  function _renderWarLogCard(parent, crisis) {
    const feed = Array.isArray(crisis?.activityFeed) ? crisis.activityFeed : [];
    if (feed.length === 0) return;
    const card = createDiv().parent(parent).addClass('space-command-card');
    createElement('h4', 'War Log').parent(card).addClass('space-command-card-title');
    const list = createDiv().parent(card).addClass('space-command-route-list');
    for (const entry of feed.slice(0, 8)) {
      if (!entry || !entry.message) continue;
      const rowEl = createDiv().parent(list).addClass('space-command-route-row');
      const copy = createDiv().parent(rowEl).addClass('space-command-route-copy');
      createDiv(entry.message).parent(copy).addClass('space-command-route-meta');
      const dayLabel = Number.isFinite(Number(entry.day)) ? `Day ${entry.day}` : '';
      if (dayLabel) createDiv(dayLabel).parent(rowEl).addClass('space-command-chip').style('opacity', '0.6');
    }
  }

  function _renderIPOCard(parent, sys) {
    if (!sys || typeof sys.getIPOStatus !== 'function') return;
    const status = sys.getIPOStatus();
    const card = createDiv().parent(parent).addClass('space-command-card');
    createElement('h4', status.campaignName || 'Intergalactic Penny Operation').parent(card).addClass('space-command-card-title');
    createDiv(status.campaignSummary || 'Commodity movement now acts as route intel for physical cargo, city supply chains, and Bear pressure.').parent(card).addClass('space-command-card-copy');

    const tickerGrid = createDiv().parent(card).addClass('space-commodity-grid');

    for (const [commodity, entry] of Object.entries(status.index || {})) {
      const cur = entry.currentPrice || status.prices?.[commodity] || entry.basePrice || 0;
      const pct = Number.isFinite(Number(entry.changePct))
        ? Number(entry.changePct)
        : Math.round(((cur - (entry.basePrice || cur)) / Math.max(1, entry.basePrice || cur)) * 100);
      const up = pct >= 0;
      const cell = createDiv().parent(tickerGrid).addClass('space-commodity-cell');
      createDiv(commodity).parent(cell).addClass('space-commodity-name');
      createDiv(`${cur}g`).parent(cell).addClass('space-commodity-price');
      createDiv(`${up ? '+' : ''}${pct}%`).parent(cell).addClass(up ? 'space-commodity-change-up' : 'space-commodity-change-down');
    }

    const credit = Math.max(0, Math.round(Number(status.migrationCredit) || 0));
    if (credit > 0) {
      const row = createDiv().parent(card).addClass('space-command-route-row');
      const copy = createDiv().parent(row).addClass('space-command-route-copy');
      createDiv('Retired share contracts').parent(copy).addClass('space-command-route-title');
      createDiv(`${credit}g payout is ready from the old frontier commodity board.`).parent(copy).addClass('space-command-route-meta');
      _button(row, 'Claim', true, () => {
        const result = (typeof sys.claimIPOMigrationCredit === 'function')
          ? sys.claimIPOMigrationCredit(typeof player !== 'undefined' ? player : null)
          : { ok: false };
        if (result?.ok && typeof notificationManager !== 'undefined') {
          notificationManager.log(`Claimed retired IPO payout: ${result.payout}g.`, 'success');
        }
        _refreshSpaceUI();
      }, 'travel-map-go-btn-secondary');
    } else {
      createDiv('Trade contracts now resolve through cargo, routes, factions, and city supply chains. Use the index to pick profitable destinations.').parent(card).addClass('space-command-empty');
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
    );
    if (hideForEarthSurface) {
      container.style('pointer-events', 'none');
      return;
    }

    container.style('pointer-events', 'none');
    if (window._spaceHudCollapsed && sys?.phase !== 'grounded') _renderCollapsedHud(container);
    else _renderFlightOverlay(container);
  }

  uiManager.registerScreen('spaceTravelHUD', {
    validStates: [GameStates.SPACE],
    create: () => createDiv().id('spaceTravelUI').addClass('screen').style('display', 'none'),
    show: () => {
      const el = select('#spaceTravelUI');
      if (!el) return;
      el.show();
      el.addClass('screen-visible');
      _refreshSpaceUI();
    },
    hide: () => {
      const el = select('#spaceTravelUI');
      if (!el) return;
      el.removeClass('screen-visible');
      el.hide();
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
  window.BQRunSpaceRouteQTE = _runSpaceRouteQTE;
})();
