// ui/spaceTravel.js — Space Travel HUD and screens
// Renders ship readout, route selector, travel progress, fuel gauge, and phase controls.
// Registered into the global uiManager so it participates in the existing screen system.

(function() {
  'use strict';

  if (typeof uiManager === 'undefined') {
    console.warn('spaceTravel UI: uiManager not found, deferring.');
    return;
  }

  // ── Helper: get the active travel system ──
  function _sys() {
    return window._spaceTravelSystem
      || (typeof player !== 'undefined' && player?._spaceTravelSystem)
      || null;
  }

  function _ship() {
    if (typeof player !== 'undefined' && typeof player.getActiveSpaceShip === 'function') {
      return player.getActiveSpaceShip();
    }
    const sys = _sys();
    return sys?.activeShip || null;
  }

  // ── Ship Readout Panel ──────────────────────────────
  function renderShipReadout(parent) {
    const ship = _ship();
    if (!ship) {
      createElement('div', 'No ship selected. Buy one at a spaceport city.')
        .parent(parent).style('color', '#aaa').style('padding', '12px');
      return;
    }

    const box = createDiv().parent(parent)
      .style('background', 'rgba(11,17,30,0.95)')
      .style('border', '1px solid rgba(125,201,255,0.18)')
      .style('border-radius', '12px')
      .style('padding', '14px')
      .style('margin-bottom', '12px');

    const header = createDiv().parent(box)
      .style('display', 'flex').style('justify-content', 'space-between').style('align-items', 'center');
    createSpan(`🚀 ${ship.name}`).parent(header)
      .style('font-weight', 'bold').style('color', '#fff').style('font-size', '16px');
    createSpan(ship.displayName).parent(header)
      .style('color', '#7dc9ff').style('font-size', '12px');

    const stats = createDiv().parent(box)
      .style('display', 'grid').style('grid-template-columns', '1fr 1fr 1fr')
      .style('gap', '6px').style('margin-top', '10px');

    const addStat = (label, value, color = '#fff') => {
      const cell = createDiv().parent(stats)
        .style('background', '#191929').style('padding', '6px 8px').style('border-radius', '6px');
      createDiv(label).parent(cell).style('color', '#8ea8c2').style('font-size', '10px');
      createDiv(String(value)).parent(cell).style('color', color).style('font-weight', 'bold').style('font-size', '13px');
    };

    addStat('Condition', `${ship.condition}%`, ship.conditionColor());
    addStat('Fuel', `${ship.fuel}/${typeof ship.getEffectiveFuelCapacity === 'function' ? ship.getEffectiveFuelCapacity() : ship.fuelCapacity}`, ship.fuel <= 10 ? '#f44336' : '#4caf50');
    addStat('Cargo', `${typeof ship.getStorageWeight === 'function' ? ship.getStorageWeight() : 0}/${typeof ship.getStorageCapacity === 'function' ? ship.getStorageCapacity() : ship.cargoBonus}`, '#ccc');
    addStat('HP', `${typeof ship.getEffectiveHP === 'function' ? ship.getEffectiveHP() : ship.hp}`, '#ffcc00');
    addStat('Speed', `${typeof ship.getEffectiveSpeed === 'function' ? ship.getEffectiveSpeed() : ship.speed}ms`, '#8ea8c2');
    addStat('Captain', ship.captain ? `${ship.captain.icon} ${ship.captain.name}` : 'None', ship.captain ? '#ffd700' : '#888');
  }

  // ── Fuel Gauge Bar ──────────────────────────────────
  function renderFuelGauge(parent) {
    const ship = _ship();
    if (!ship) return;
    const max = typeof ship.getEffectiveFuelCapacity === 'function' ? ship.getEffectiveFuelCapacity() : ship.fuelCapacity;
    const pct = max > 0 ? Math.round((ship.fuel / max) * 100) : 0;
    const color = pct > 50 ? '#4caf50' : pct > 20 ? '#ff9800' : '#f44336';

    const bar = createDiv().parent(parent)
      .style('background', '#111').style('border-radius', '6px').style('height', '18px')
      .style('position', 'relative').style('margin', '8px 0').style('overflow', 'hidden');
    createDiv().parent(bar)
      .style('background', color).style('height', '100%').style('width', `${pct}%`)
      .style('border-radius', '6px').style('transition', 'width 0.3s');
    createDiv(`⛽ ${ship.fuel}/${max}`).parent(bar)
      .style('position', 'absolute').style('top', '0').style('left', '8px')
      .style('line-height', '18px').style('font-size', '11px').style('color', '#fff');
  }

  // ── Phase Status Display ────────────────────────────
  function renderPhaseStatus(parent) {
    const sys = _sys();
    const phase = sys?.phase || 'grounded';
    const labels = {
      grounded: '🏙️ Grounded',
      launch_prep: '🔧 Launch Prep',
      ascending: '🚀 Ascending',
      in_orbit: '🌍 In Orbit',
      en_route: '🛰️ En Route',
      docking: '🔗 Docking',
      landed: '🪐 Landed',
      reentry: '🔥 Re-entry',
    };
    const label = labels[phase] || phase;
    const statusDiv = createDiv().parent(parent)
      .style('display', 'flex').style('align-items', 'center').style('gap', '10px')
      .style('padding', '8px 12px').style('background', '#0d1526').style('border-radius', '8px')
      .style('margin-bottom', '8px');
    createSpan(label).parent(statusDiv)
      .style('font-weight', 'bold').style('color', '#7dc9ff').style('font-size', '15px');
    if (sys?.currentNode) {
      createSpan(`@ ${sys.currentNode}`).parent(statusDiv)
        .style('color', '#96a7b9').style('font-size', '12px');
    }
    if (phase === 'en_route' && sys?.routeProgress != null) {
      const pct = Math.round(sys.routeProgress * 100);
      createSpan(`${pct}% complete`).parent(statusDiv)
        .style('color', '#ffd700').style('font-size', '12px');
    }
  }

  // ── Route Selector ──────────────────────────────────
  function renderRouteSelector(parent) {
    const sys = _sys();
    if (!sys) return;
    const routes = sys.getAvailableRoutes();
    if (routes.length === 0) {
      createDiv('No routes available from this location.').parent(parent)
        .style('color', '#888').style('font-size', '12px');
      return;
    }

    createElement('h4', '📡 Available Routes').parent(parent)
      .style('color', '#7dc9ff').style('margin', '0 0 8px');

    for (const route of routes) {
      const row = createDiv().parent(parent)
        .style('display', 'flex').style('align-items', 'center').style('justify-content', 'space-between')
        .style('background', '#191929').style('padding', '8px 12px').style('border-radius', '8px')
        .style('margin-bottom', '6px');

      const info = createDiv().parent(row);
      createDiv(route.label || `→ ${route.destination}`).parent(info)
        .style('font-weight', 'bold').style('color', '#fff').style('font-size', '13px');
      createDiv(`Distance: ${route.distance} · Fuel: ${route.fuelCost} · Danger: ${Math.round(route.dangerRating * 100)}%`).parent(info)
        .style('color', '#8ea8c2').style('font-size', '11px');

      const btn = createButton(route.canAfford ? 'Travel' : 'No Fuel').parent(row);
      btn.addClass(route.canAfford ? 'buy-btn' : 'buy-btn-disabled');
      if (route.canAfford) {
        btn.mousePressed(() => {
          const result = sys.beginRoute(route.destination);
          if (result.ok) {
            if (typeof notificationManager !== 'undefined') {
              notificationManager.log(`En route to ${route.destination}. Fuel used: ${result.fuelUsed}.`, 'info');
            }
            _refreshSpaceUI();
          }
        });
      } else {
        btn.attribute('disabled', 'true');
      }
    }
  }

  // ── Action Buttons ──────────────────────────────────
  function renderActions(parent) {
    const sys = _sys();
    if (!sys) return;
    const phase = sys.phase;
    const btnRow = createDiv().parent(parent)
      .style('display', 'flex').style('gap', '8px').style('flex-wrap', 'wrap').style('margin-top', '10px');

    if (phase === 'grounded') {
      const ship = _ship();
      const city = sys.launchCity || window._spaceLaunchCity;
      const canLaunch = !!(ship && city && (city.hasSpaceport || city.progression?.spaceAccess?.launchReady));
      const btn = createButton('🚀 Launch').parent(btnRow).addClass(canLaunch ? 'buy-btn' : 'buy-btn-disabled');
      if (canLaunch) {
        btn.mousePressed(() => {
          const result = sys.beginLaunch(city, ship, player);
          if (result.ok) {
            const confirm = sys.confirmLaunch();
            if (confirm.ok) {
              // Launch QTE
              if (typeof minigameManager !== 'undefined') {
                minigameManager.launch('spaceLaunch', {}, (qteResult) => {
                  sys.completeAscent(qteResult.success);
                  if (qteResult.success && qteResult.fuelSaved > 0) {
                    ship.refuel(qteResult.fuelSaved);
                  }
                  if (typeof player !== 'undefined') player.launchToSpace(city);
                  if (typeof notificationManager !== 'undefined') {
                    const msg = qteResult.perfect ? 'Perfect launch! Fuel saved.' :
                      qteResult.success ? 'Launch successful!' : 'Rough launch — extra fuel burned.';
                    notificationManager.log(msg, qteResult.success ? 'success' : 'warning');
                  }
                  _refreshSpaceUI();
                });
              } else {
                // Fallback: auto-complete
                sys.completeAscent(true);
                if (typeof player !== 'undefined') player.launchToSpace(city);
                _refreshSpaceUI();
              }
            }
          } else {
            if (typeof notificationManager !== 'undefined') {
              notificationManager.log(`Launch failed: ${result.reason}`, 'warning');
            }
          }
        });
      }

      // Refuel button
      if (ship && ship.fuel < ship.getEffectiveFuelCapacity()) {
        const refuelAmt = ship.getEffectiveFuelCapacity() - ship.fuel;
        const cost = ship.getRefuelCost(refuelAmt);
        const canRefuel = player && player.gold >= cost;
        const refuelBtn = createButton(`⛽ Refuel (${cost}g)`).parent(btnRow).addClass(canRefuel ? 'buy-btn' : 'buy-btn-disabled');
        if (canRefuel) {
          refuelBtn.mousePressed(() => {
            if (typeof player.spendGold === 'function') player.spendGold(cost);
            else player.gold -= cost;
            ship.refuel(refuelAmt);
            if (typeof notificationManager !== 'undefined') {
              notificationManager.log(`Refueled ${refuelAmt} units for ${cost}g.`, 'success');
            }
            _refreshSpaceUI();
          });
        }
      }

      // Repair button
      if (ship && ship.condition < 100) {
        const repCost = ship.getRepairCost();
        const canRepair = player && player.gold >= repCost.goldOnly;
        const repBtn = createButton(`🔧 Repair (${repCost.goldOnly}g)`).parent(btnRow).addClass(canRepair ? 'buy-btn' : 'buy-btn-disabled');
        if (canRepair) {
          repBtn.mousePressed(() => {
            if (typeof player.spendGold === 'function') player.spendGold(repCost.goldOnly);
            else player.gold -= repCost.goldOnly;
            ship.repair(100);
            if (typeof notificationManager !== 'undefined') {
              notificationManager.log(`Ship fully repaired for ${repCost.goldOnly}g.`, 'success');
            }
            _refreshSpaceUI();
          });
        }
      }
    }

    if (phase === 'in_orbit') {
      const reentryBtn = createButton('🔥 Return to Ground').parent(btnRow).addClass('buy-btn');
      reentryBtn.mousePressed(() => {
        const result = sys.beginReentry();
        if (result.ok) {
          // Reentry QTE
          if (typeof minigameManager !== 'undefined') {
            minigameManager.launch('spaceReentry', { duration: 6000 }, (qteResult) => {
              sys.completeReentry(qteResult.success);
              if (qteResult.heatDamage > 0 && sys.activeShip) {
                sys.activeShip.takeDamage(qteResult.heatDamage);
              }
              if (typeof player !== 'undefined') player.returnFromSpace();
              if (typeof notificationManager !== 'undefined') {
                const msg = qteResult.success
                  ? 'Clean re-entry! Welcome home.'
                  : `Re-entry damage: ${qteResult.heatDamage}% hull lost.`;
                notificationManager.log(msg, qteResult.success ? 'success' : 'warning');
              }
              if (typeof gameStateManager !== 'undefined') gameStateManager.setState(GameStates.PLAYING);
            });
          } else {
            sys.completeReentry(true);
            if (typeof player !== 'undefined') player.returnFromSpace();
            if (typeof notificationManager !== 'undefined') {
              notificationManager.log('Re-entry successful. Welcome home.', 'success');
            }
            if (typeof gameStateManager !== 'undefined') gameStateManager.setState(GameStates.PLAYING);
          }
        } else {
          if (typeof notificationManager !== 'undefined') {
            notificationManager.log(`Re-entry failed: ${result.reason}`, 'warning');
          }
        }
      });
    }

    if (phase === 'landed') {
      const liftBtn = createButton('🚀 Lift Off').parent(btnRow).addClass('buy-btn');
      liftBtn.mousePressed(() => {
        const result = sys.liftOff();
        if (result.ok) {
          if (typeof notificationManager !== 'undefined') {
            notificationManager.log('Lifted off. Back in orbit.', 'info');
          }
          _refreshSpaceUI();
        }
      });
    }

    if (phase === 'en_route') {
      const emergBtn = createButton('⚠️ Emergency Return').parent(btnRow).addClass('sell-btn');
      emergBtn.mousePressed(() => {
        if (confirm('Emergency return will damage your ship. Continue?')) {
          sys.emergencyReturn();
          if (typeof player !== 'undefined') player.returnFromSpace();
          if (typeof notificationManager !== 'undefined') {
            notificationManager.log('Emergency return! Ship took damage.', 'warning');
          }
          if (typeof gameStateManager !== 'undefined') gameStateManager.setState(GameStates.PLAYING);
        }
      });
    }

    // Universal: buy ship (if grounded and no ship)
    if (phase === 'grounded' && !_ship()) {
      createElement('h4', '🛒 Buy a Ship').parent(parent)
        .style('color', '#ffd700').style('margin', '12px 0 6px');
      if (typeof SpaceShipLibrary !== 'undefined') {
        for (const [key, def] of Object.entries(SpaceShipLibrary)) {
          const shopRow = createDiv().parent(parent)
            .style('display', 'flex').style('align-items', 'center').style('justify-content', 'space-between')
            .style('background', '#191929').style('padding', '8px 12px').style('border-radius', '8px')
            .style('margin-bottom', '6px');
          const info = createDiv().parent(shopRow);
          createDiv(`${def.icon} ${def.displayName} — ${def.cost}g`).parent(info)
            .style('font-weight', 'bold').style('color', '#fff').style('font-size', '13px');
          createDiv(def.description).parent(info)
            .style('color', '#8ea8c2').style('font-size', '11px');
          createDiv(`Cargo: ${def.cargoBonus} · Fuel: ${def.fuelCapacity} · HP: ${def.hp} · Attack: ${def.attack}`).parent(info)
            .style('color', '#7ec8e3').style('font-size', '10px');

          const canBuy = player && player.gold >= def.cost;
          const buyBtn = createButton(canBuy ? 'Buy' : `Need ${def.cost}g`).parent(shopRow);
          buyBtn.addClass(canBuy ? 'buy-btn' : 'buy-btn-disabled');
          if (canBuy) {
            buyBtn.mousePressed(() => {
              const result = player.buySpaceShip(key);
              if (result.ok) {
                if (typeof notificationManager !== 'undefined') {
                  notificationManager.log(`Purchased ${result.ship.name} (${def.displayName}).`, 'success');
                }
                _refreshSpaceUI();
              }
            });
          }
        }
      }
    }
  }

  // ── Tech Tree Quick View ────────────────────────────
  function renderTechTreeSummary(parent) {
    const city = window._spaceLaunchCity;
    if (!city || typeof city.getAllTechNodes !== 'function') return;

    createElement('h4', '🔬 Research Branches').parent(parent)
      .style('color', '#7dc9ff').style('margin', '14px 0 8px');

    const branches = typeof City !== 'undefined' ? City.TECH_BRANCHES : [];
    for (const branch of branches) {
      const nodes = city.getTechBranch(branch);
      const done = nodes.filter(n => n.researched).length;
      const total = nodes.length;
      const nextNode = nodes.find(n => n.canResearch);

      const row = createDiv().parent(parent)
        .style('display', 'flex').style('align-items', 'center').style('justify-content', 'space-between')
        .style('background', '#191929').style('padding', '6px 10px').style('border-radius', '6px')
        .style('margin-bottom', '4px');

      createSpan(`${branch.charAt(0).toUpperCase() + branch.slice(1)} (${done}/${total})`).parent(row)
        .style('color', done === total ? '#4caf50' : '#ccc').style('font-size', '12px').style('font-weight', 'bold');

      if (nextNode) {
        const researchBtn = createButton(`${nextNode.label} (${nextNode.researchCost}RP + ${nextNode.goldCost}g)`).parent(row);
        researchBtn.addClass('filter-btn');
        researchBtn.style('font-size', '10px');
        researchBtn.mousePressed(() => {
          const result = city.researchTechNode(nextNode.key, player);
          if (result.ok) {
            _refreshSpaceUI();
          } else {
            if (typeof notificationManager !== 'undefined') {
              notificationManager.log(`Research failed: ${result.reason}`, 'warning');
            }
          }
        });
      } else if (done === total) {
        createSpan('✅ Complete').parent(row).style('color', '#4caf50').style('font-size', '11px');
      } else {
        createSpan('🔒 Locked').parent(row).style('color', '#888').style('font-size', '11px');
      }
    }
  }

  // ── Treasury Upgrades Quick View ────────────────────
  function renderTreasuryUpgrades(parent) {
    const city = window._spaceLaunchCity;
    if (!city || typeof CityManagement === 'undefined' || !CityManagement.TREASURY_UPGRADES) return;

    createElement('h4', '💰 Treasury Upgrades').parent(parent)
      .style('color', '#ffd700').style('margin', '14px 0 8px');

    for (const key of Object.keys(CityManagement.TREASURY_UPGRADES)) {
      const state = CityManagement.getTreasuryUpgradeState(city, key);
      if (!state) continue;

      const row = createDiv().parent(parent)
        .style('display', 'flex').style('align-items', 'center').style('justify-content', 'space-between')
        .style('background', '#191929').style('padding', '6px 10px').style('border-radius', '6px')
        .style('margin-bottom', '4px');

      createSpan(`${state.emoji} ${state.name} (${state.currentTier}/${state.maxTier})`).parent(row)
        .style('color', state.atMax ? '#4caf50' : '#ccc').style('font-size', '12px').style('font-weight', 'bold');

      if (!state.atMax) {
        const budget = city.management?.budget || 0;
        const canBuy = budget >= state.nextCost;
        const btn = createButton(`${state.nextCost}g treasury`).parent(row);
        btn.addClass(canBuy ? 'filter-btn' : 'buy-btn-disabled');
        btn.style('font-size', '10px');
        if (canBuy) {
          btn.mousePressed(() => {
            CityManagement.buyTreasuryUpgrade(city, key);
            _refreshSpaceUI();
          });
        }
      } else {
        createSpan('✅ Max').parent(row).style('color', '#4caf50').style('font-size', '11px');
      }
    }
  }

  // ── Main Refresh ────────────────────────────────────
  function _refreshSpaceUI() {
    const container = select('#spaceTravelUI');
    if (!container) return;
    container.html('');

    renderPhaseStatus(container);
    renderShipReadout(container);
    renderFuelGauge(container);

    const sys = _sys();
    const phase = sys?.phase || 'grounded';

    // Route selector only when in orbit or landed
    if (phase === 'in_orbit' || phase === 'landed') {
      renderRouteSelector(container);
    }

    renderActions(container);

    // City-based features (tech tree, treasury) when grounded
    if (phase === 'grounded') {
      renderTechTreeSummary(container);
      renderTreasuryUpgrades(container);
    }
  }

  // ── Register as uiManager Screen ───────────────────
  uiManager.registerScreen('spaceTravelHUD', {
    validStates: [GameStates.SPACE],
    create: () => {
      const wrapper = createDiv().id('spaceTravelUI')
        .style('position', 'fixed')
        .style('top', '60px')
        .style('right', '12px')
        .style('width', '380px')
        .style('max-height', 'calc(100vh - 80px)')
        .style('overflow-y', 'auto')
        .style('background', 'rgba(8,14,28,0.97)')
        .style('border', '1px solid rgba(125,201,255,0.15)')
        .style('border-radius', '14px')
        .style('padding', '16px')
        .style('z-index', '900')
        .style('font-family', 'inherit')
        .style('color', '#ccc');

      createElement('h3', '🛰️ Space Travel').parent(wrapper)
        .style('color', '#7dc9ff').style('margin', '0 0 12px').style('font-size', '18px');

      _refreshSpaceUI();
    },
    update: () => {
      // Tick travel system if en_route
      const sys = _sys();
      if (sys && sys.phase === 'en_route') {
        const now = performance.now();
        const lastTick = window._spaceLastTickMs || now;
        const delta = now - lastTick;
        window._spaceLastTickMs = now;
        if (delta > 0 && delta < 5000) {
          const result = sys.tickTravel(delta);
          if (result?.event === 'arrived') {
            // Docking QTE
            if (typeof minigameManager !== 'undefined') {
              minigameManager.launch('spaceDocking', { timeLimit: 8000 }, (qteResult) => {
                sys.completeDocking(qteResult.success);
                if (!qteResult.success && sys.activeShip) {
                  sys.activeShip.takeDamage(Math.abs(qteResult.conditionBonus));
                }
                if (typeof player !== 'undefined' && typeof player.visitPlanet === 'function') {
                  player.visitPlanet(sys.currentNode);
                }
                if (typeof notificationManager !== 'undefined') {
                  const msg = qteResult.success
                    ? `Docked at ${sys.currentNode} smoothly!`
                    : `Rough docking at ${sys.currentNode} — ship took damage.`;
                  notificationManager.log(msg, qteResult.success ? 'success' : 'warning');
                }
                _refreshSpaceUI();
              });
            } else {
              sys.completeDocking(true);
              if (typeof player !== 'undefined' && typeof player.visitPlanet === 'function') {
                player.visitPlanet(sys.currentNode);
              }
              if (typeof notificationManager !== 'undefined') {
                notificationManager.log(`Arrived at ${sys.currentNode}!`, 'success');
              }
              _refreshSpaceUI();
            }
          } else if (result?.event === 'travelling') {
            // Update progress display
            const progEl = select('#spaceTravelUI');
            if (progEl) {
              // Refresh on ~10% increments to avoid constant DOM churn
              const pct = Math.round(result.progress * 100);
              if (pct % 10 === 0) _refreshSpaceUI();
            }
          }
        }
      }
    },
    destroy: () => {
      const el = select('#spaceTravelUI');
      if (el) el.remove();
    },
  });

  // Expose refresh for external calls
  window._refreshSpaceUI = _refreshSpaceUI;

})();
