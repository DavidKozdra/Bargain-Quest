// ui/cityManagement.js — City Management UI
// Two UIManager screens:
//   "cityMgmtSettle" — placement phase (walk to a spot, click Settle Here)
//   "cityMgmtPanel"  — management phase (right-side panel, tabs)
(function () {
  if (typeof uiManager === 'undefined' || typeof GameStates === 'undefined') return;
  const cityMoveHint = () => `${getActionDisplay('moveUp')}/${getActionDisplay('moveDown')}/${getActionDisplay('moveLeft')}/${getActionDisplay('moveRight')}`;

  // ═══════════════════════════════════════════════════════════
  //  ONBOARDING — First-time overlay explaining the mode
  // ═══════════════════════════════════════════════════════════
  uiManager.registerScreen("cityMgmtOnboard", {
    validStates: [GameStates.CITY_MANAGE],
    create: () => {
      const overlay = createDiv().id("cityMgmtOnboard")
        .style("display", "none")
        .style("position", "fixed").style("inset", "0")
        .style("background", "rgba(10,8,15,0.88)")
        .style("z-index", "2000")
        .style("display", "flex").style("align-items", "center").style("justify-content", "center");

      const card = createDiv().parent(overlay)
        .style("background", "rgba(28,24,35,0.98)")
        .style("border", "1px solid rgba(202,163,80,0.4)")
        .style("border-radius", "12px")
        .style("padding", "32px 36px")
        .style("max-width", "480px")
        .style("color", "#ccc")
        .style("font-size", "13px")
        .style("line-height", "1.7");

      card.html(`
        <h2 style="color:#caa350;font-size:20px;margin:0 0 16px">City Management Mode</h2>
        <p style="margin:0 0 12px">You are the city. Pan the map with <b>${cityMoveHint()}</b> and <b>click a land tile</b> to found your settlement.</p>
        <div style="display:grid;gap:8px;margin-bottom:20px">
          <div style="display:flex;gap:10px;align-items:center"><span style="font-size:18px">🍞</span><span><b>Food</b> — your population consumes food daily. Build farms or import via trade routes to prevent starvation.</span></div>
          <div style="display:flex;gap:10px;align-items:center"><span style="font-size:18px">💰</span><span><b>Tax</b> — set your tax rate in the Overview tab. Higher tax = more income, lower happiness.</span></div>
          <div style="display:flex;gap:10px;align-items:center"><span style="font-size:18px">🏗️</span><span><b>Build</b> — spend your city treasury on buildings. They take in-game seconds to complete.</span></div>
          <div style="display:flex;gap:10px;align-items:center"><span style="font-size:18px">🏆</span><span><b>Win</b> — be the wealthiest city for 10 consecutive days to win the game.</span></div>
        </div>
        <p style="color:#888;font-size:11px;margin:0 0 16px">Tip: recenter the camera anytime with the 🎯 button (bottom right).</p>
      `);

      const dismissBtn = createButton("Let's Build! →").parent(card)
        .style("background", "linear-gradient(135deg,#c8a030,#e8c860)")
        .style("color", "#1a1520").style("border", "none").style("padding", "10px 24px")
        .style("border-radius", "6px").style("font-size", "14px").style("font-weight", "bold")
        .style("cursor", "pointer").style("width", "100%");
      dismissBtn.mousePressed(() => {
        overlay.style("display", "none");
        try { localStorage.setItem('bq_cityOnboarded', '1'); } catch (_e) {}
      });

      overlay.style("display", "none");
      return overlay;
    },

    show: () => {
      const el = select("#cityMgmtOnboard");
      if (!el) return;
      // Only show once per browser session (or if never seen)
      let seen = false;
      try { seen = !!localStorage.getItem('bq_cityOnboarded'); } catch (_e) {}
      const alreadySettled = typeof cityManagement !== 'undefined' && cityManagement && cityManagement.isSettled;
      el.style("display", (!seen && !alreadySettled) ? "flex" : "none");
    },

    hide: () => { const el = select("#cityMgmtOnboard"); if (el) el.style("display", "none"); },
    update: () => {
      // Auto-dismiss once player settles
      if (typeof cityManagement !== 'undefined' && cityManagement && cityManagement.isSettled) {
        const el = select("#cityMgmtOnboard"); if (el) el.style("display", "none");
      }
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  SCREEN 1 — Settlement Placement Bar
  //  Shown during CITY_MANAGE when isSettled === false
  // ═══════════════════════════════════════════════════════════
  uiManager.registerScreen("cityMgmtSettle", {
    validStates: [GameStates.CITY_MANAGE],

    create: () => {
      const bar = createDiv().id("cityMgmtSettle").addClass("citymgmt-settle-bar");
      bar.style("display", "none");

      createSpan(`🏠 Pan the map with ${cityMoveHint()}, then click a tile to settle your city.`)
        .addClass("citymgmt-settle-text").parent(bar);

      // Terrain legend
      createSpan("🟢 Valid tile  🔴 Water (no settle)")
        .parent(bar).style("font-size", "11px").style("color", "#aaa").style("margin-left", "12px");

      return bar;
    },

    show: () => {
      const el = select("#cityMgmtSettle");
      if (!el) return;
      if (typeof cityManagement !== 'undefined' && cityManagement && cityManagement.isSettled) {
        el.style("display", "none");
        return;
      }
      el.style("display", "flex");
    },

    hide: () => {
      const el = select("#cityMgmtSettle");
      if (el) el.style("display", "none");
    },

    update: () => {
      // Auto-hide once settled
      if (typeof cityManagement !== 'undefined' && cityManagement && cityManagement.isSettled) {
        const el = select("#cityMgmtSettle");
        if (el) el.style("display", "none");
      }
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  SCREEN 2 — City Management Panel (right-side)
  //  Shown during CITY_MANAGE when isSettled === true
  // ═══════════════════════════════════════════════════════════
  window._cityMgmtTab = "overview";
  const CITY_MGMT_TAB_DEFS = [
    { label: "Overview", key: "overview" },
    { label: "Build", key: "build" },
    { label: "Trade", key: "trade" },
    { label: "Quests", key: "quests" },
    { label: "Units", key: "units" },
    { label: "Actions", key: "actions" },
  ];

  function _isCityMgmtSettled() {
    return typeof cityManagement !== "undefined" && cityManagement && cityManagement.isSettled;
  }

  function _setDisplay(el, on, onValue = "flex") {
    if (!el) return;
    el.style("display", on ? onValue : "none");
  }

  function _notifyCityMgmt(msg, type = "info") {
    window.BQUI?.notify(msg, type);
  }

  function _renderCityMgmtHeader(city) {
    const nameEl = select("#citymgmtCityName");
    if (nameEl) nameEl.html(`🏰 ${city.name}`);

    const statsEl = select("#citymgmtCityStats");
    if (!statsEl) return;

    const h = cityManagement.getHappiness(city);
    const tier = cityManagement.getHappinessTier(h);
    const food = cityManagement.getFoodStatus(city);
    const budget = city.management?.budget || 0;
    const playerGold = (typeof player !== "undefined" && player) ? player.gold : 0;
    const totalFunds = budget + playerGold;
    statsEl.html(
      `<span>Pop: <b>${city.population}</b></span>` +
      `<span style="color:${tier.color}">${tier.emoji} ${tier.label} (${h})</span>` +
      `<span style="color:${food.color}">🍞 ${food.label} (${food.daysLeft}d)</span>` +
      `<span>💰 ${budget}g <span style="color:#aaa;font-size:11px">(+${playerGold}g yours = ${totalFunds}g)</span></span>`
    );
  }

  uiManager.registerScreen("cityMgmtPanel", {
    validStates: [GameStates.CITY_MANAGE],

    create: () => {
      const panel = createDiv().id("cityMgmtPanel").addClass("citymgmt-panel");
      panel.style("display", "none");

      // Header
      const header = createDiv().addClass("citymgmt-header").parent(panel);
      // Close button (top right)
      const closeBtn = createButton("✕").addClass("citymgmt-close-btn").parent(header);
      closeBtn.attribute("aria-label", "Hide city management panel");
      closeBtn.attribute("title", "Hide panel (stay in city management mode)");
      closeBtn.mousePressed(() => {
        // Always just hide the panel and stay in city management mode,
        // regardless of whether the city is settled.
        if (typeof uiManager !== 'undefined' && uiManager && typeof uiManager.hideScreen === 'function') {
          uiManager.hideScreen('cityMgmtPanel');
        } else {
          const el = select('#cityMgmtPanel'); if (el) el.style('display','none');
        }
      });
      createDiv().id("citymgmtCityName").addClass("citymgmt-city-name").parent(header);
      createDiv().id("citymgmtCityStats").addClass("citymgmt-city-stats").parent(header);

      // Tab bar
      const tabBar = createDiv().addClass("citymgmt-tab-bar").parent(panel);
      for (const t of CITY_MGMT_TAB_DEFS) {
        createButton(t.label)
          .parent(tabBar)
          .addClass("citymgmt-tab-btn")
          .attribute("data-citymgmt-tab", t.key)
          .mousePressed(() => {
            window._cityMgmtTab = t.key;
            _refreshCityMgmtPanel();
          });
      }

      // Tab content area
      createDiv().id("citymgmtTabContent").addClass("citymgmt-tab-content").parent(panel);

      return panel;
    },

    show: () => {
      const el = select("#cityMgmtPanel");
      if (!el) return;
      if (!_isCityMgmtSettled()) {
        _setDisplay(el, false);
        return;
      }
      _setDisplay(el, true);
      _refreshCityMgmtPanel();
    },

    hide: () => {
      const el = select("#cityMgmtPanel");
      if (el) el.style("display", "none");
    },

    update: () => {
      if (!_isCityMgmtSettled()) {
        const el = select("#cityMgmtPanel");
        _setDisplay(el, false);
        return;
      }
      // Light refresh — update dynamic values without rebuilding DOM
      _updateCityMgmtDynamic();
    }
  });

  // Floating action buttons — always visible when settled (bottom-right)
  uiManager.registerScreen("cityMgmtRecenter", {
    validStates: [GameStates.CITY_MANAGE],
    create: () => {
      const container = createDiv().id('cityMgmtFloatingBtns');
      container.style('display', 'none');
      container.style('position', 'fixed');
      container.style('right', '14px');
      container.style('bottom', '14px');
      container.style('z-index', '1002');
      container.style('display', 'flex');
      container.style('flex-direction', 'column');
      container.style('gap', '8px');
      container.style('align-items', 'flex-end');

      // Return to Adventure button (prominent, only if _adventureCityManage)
      const returnBtn = createButton('🗺️ Return to Adventure').id('cityMgmtAdventureBtn');
      returnBtn.style('display', 'none');
      returnBtn.style('padding', '10px 18px');
      returnBtn.style('border-radius', '8px');
      returnBtn.style('background', 'linear-gradient(135deg,#2e7d32,#4caf50)');
      returnBtn.style('color', '#fff');
      returnBtn.style('font-size', '14px');
      returnBtn.style('font-weight', 'bold');
      returnBtn.style('border', '2px solid rgba(255,255,255,0.25)');
      returnBtn.style('cursor', 'pointer');
      returnBtn.style('box-shadow', '0 2px 8px rgba(0,0,0,0.4)');
      returnBtn.style('white-space', 'nowrap');
      returnBtn.mousePressed(() => {
        try {
          if (typeof _returnToAdventure === 'function') _returnToAdventure();
        } catch (e) {
          if (typeof window !== 'undefined' && typeof window._reportRuntimeError === 'function') {
            window._reportRuntimeError('cityMgmtAdventureBtn', e);
          } else {
            console.error('cityMgmtAdventureBtn error', e);
          }
        }
      });
      container.child(returnBtn);

      // Recenter camera button
      const recenterBtn = createButton('🎯 Recenter').id('cityMgmtRecenterBtn');
      recenterBtn.style('padding', '8px 14px');
      recenterBtn.style('border-radius', '8px');
      recenterBtn.style('background', 'rgba(20,18,25,0.95)');
      recenterBtn.style('border', '1px solid rgba(125,90,41,0.3)');
      recenterBtn.style('color', '#ccc');
      recenterBtn.style('font-size', '12px');
      recenterBtn.style('cursor', 'pointer');
      recenterBtn.style('white-space', 'nowrap');
      recenterBtn.mousePressed(() => {
        window._cityMgmtCamOffX = 0;
        window._cityMgmtCamOffY = 0;
      });
      container.child(recenterBtn);

      return container;
    },

    show: () => {
      const container = select('#cityMgmtFloatingBtns');
      const adventureBtn = select('#cityMgmtAdventureBtn');
      const should = _isCityMgmtSettled();
      if (container) container.style('display', should ? 'flex' : 'none');
      if (adventureBtn) adventureBtn.style('display', (should && window._adventureCityManage) ? 'flex' : 'none');
    },

    hide: () => {
      const container = select('#cityMgmtFloatingBtns');
      if (container) container.style('display', 'none');
    },

    update: () => {
      const container = select('#cityMgmtFloatingBtns');
      const adventureBtn = select('#cityMgmtAdventureBtn');
      const should = _isCityMgmtSettled();
      if (container) container.style('display', should ? 'flex' : 'none');
      if (adventureBtn) adventureBtn.style('display', (should && window._adventureCityManage) ? 'flex' : 'none');
    }
  });

  // Small persistent reopen button — appears when panel hidden while in CITY_MANAGE
  uiManager.registerScreen("cityMgmtReopen", {
    validStates: [GameStates.CITY_MANAGE],
    create: () => {
      const btn = createButton('🏰 City Panel').id('cityMgmtReopenBtn').addClass('citymgmt-reopen-btn');
      btn.style('display', 'none');
      btn.style('position', 'fixed');
      btn.style('right', '14px');
      btn.style('bottom', '14px');
      btn.style('z-index', '1002');
      btn.attribute("aria-label", "Open city management panel");
      btn.attribute("title", "Open city management panel");
      btn.mousePressed(() => {
        if (typeof uiManager !== 'undefined' && uiManager && typeof uiManager.showScreen === 'function') {
          uiManager.showScreen('cityMgmtPanel');
        } else {
          const s = uiManager.screens['cityMgmtPanel'];
          if (s && !s.initialized) { s.container = s.create(); s.initialized = true; }
          if (s) { s.container.show(); s.show(); }
        }
        try { _refreshCityMgmtPanel(); } catch (_e) {}
      });
      return btn;
    },

    show: () => {
      const el = select('#cityMgmtReopenBtn');
      const panel = select('#cityMgmtPanel');
      if (!el) return;
      // show reopen button only when panel is hidden and settlement exists
      const should = _isCityMgmtSettled() && (!panel || panel.style('display') === 'none');
      el.style('display', should ? 'flex' : 'none');
    },

    hide: () => {
      const el = select('#cityMgmtReopenBtn'); if (el) el.style('display', 'none');
    },

    update: () => {
      const el = select('#cityMgmtReopenBtn');
      const panel = select('#cityMgmtPanel');
      if (!el) return;
      const should = _isCityMgmtSettled() && (!panel || panel.style('display') === 'none');
      el.style('display', should ? 'flex' : 'none');
    }
  });

  // ─── Panel Refresh (full rebuild of active tab) ─────────
  function _refreshCityMgmtPanel() {
    if (!cityManagement || !cityManagement.myCity) return;
    const city = cityManagement.myCity;
    const tab = window._cityMgmtTab || "overview";

    _renderCityMgmtHeader(city);

    // Highlight active tab
    window.BQTabs?.applyTabState({
      tab,
      defs: CITY_MGMT_TAB_DEFS,
      btnSelector: ".citymgmt-tab-btn",
      activeClass: "citymgmt-tab-active",
      dataAttr: "data-citymgmt-tab",
    });

    // Build tab content
    const content = select("#citymgmtTabContent");
    if (!content) return;
    content.html("");

    switch (tab) {
      case "overview": _buildOverviewTab(content, city); break;
      case "build":    _buildBuildTab(content, city); break;
      case "trade":    _buildTradeTab(content, city); break;
      case "quests":   _buildQuestsTab(content, city); break;
      case "units":    _buildUnitsTab(content, city); break;
      case "actions":  _buildActionsTab(content, city); break;
    }
  }

  // ─── Light dynamic update (every frame) ─────────────────
  function _updateCityMgmtDynamic() {
    if (!cityManagement || !cityManagement.myCity) return;
    const city = cityManagement.myCity;

    _renderCityMgmtHeader(city);

    // Update build queue progress bars if on build tab
    if (window._cityMgmtTab === "build") {
      const _typeLabels = {
        bank: 'Bank', gamblingDen: 'Gambling Den', bountyBoard: 'Bounty Board',
        weaponShop: 'Weapon Shop', temple: 'Temple', farm: 'Farm',
        warehouse: 'Warehouse', walls: 'Walls', removeBlackMarket: 'Remove Black Market',
      };
      const queue = city.management?.buildingQueue || [];
      queue.forEach((item, idx) => {
        const bar = document.getElementById(`citymgmt-qprog-${idx}`);
        if (bar) {
          const pct = Math.min(100, Math.floor(((item.progress || 0) / (item.buildTime || 60)) * 100));
          bar.style.width = pct + "%";
          // Label is a sibling of the track, not inside it — go up two levels to .citymgmt-queue-item
          const lbl = bar.parentElement?.parentElement?.querySelector('.citymgmt-q-label');
          if (lbl) lbl.textContent = `${_typeLabels[item.type] || item.type} — ${pct}%`;
        }
      });
    }

    // Update ranking if on overview tab
    if (window._cityMgmtTab === "overview") {
      const rankEl = document.getElementById("citymgmt-ranking");
      if (rankEl && cityManagement.wealthRanking.length > 0) {
        rankEl.innerHTML = cityManagement.wealthRanking.slice(0, 5).map((r, i) =>
          `<div class="citymgmt-rank-row${r.isPlayer ? ' citymgmt-rank-you' : ''}">`
          + `<span>#${i + 1}</span><span>${r.name}</span><span>${r.wealth}g</span></div>`
        ).join("");
      }
      // Victory progress bar
      const streakEl = document.getElementById("citymgmt-streak");
      const victoryBar = document.getElementById("citymgmt-victory-bar");
      const streak = cityManagement.richestStreak;
      const goal = cityManagement.victoryDays;
      const pct = Math.min(100, Math.round((streak / goal) * 100));
      if (victoryBar) victoryBar.style.width = pct + "%";
      if (streakEl) {
        const isLeading = streak > 0;
        streakEl.textContent = isLeading
          ? `🏆 ${streak} / ${goal} days as richest (${pct}%)`
          : `Not currently the wealthiest city`;
        streakEl.style.color = streak >= goal ? "#ffe066" : isLeading ? "#ffd54f" : "#666";
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  TAB BUILDERS
  // ═══════════════════════════════════════════════════════════

  function _buildTreasurySection(parent, city) {
    const treasuryBox = createDiv().addClass("citymgmt-section").parent(parent);
    createElement("h3", "Treasury").parent(treasuryBox);
    const playerGold = (typeof player !== 'undefined' && player) ? Math.floor(player.gold || 0) : 0;
    const cityGold = Math.floor(city.management?.budget || 0);
    createDiv().html(
      `<div class="citymgmt-stat"><label>Your Gold</label><span>${playerGold}g</span></div>` +
      `<div class="citymgmt-stat"><label>City Treasury</label><span>${cityGold}g</span></div>`
    ).parent(treasuryBox);

    const trRow = createDiv().addClass("citymgmt-row").parent(treasuryBox);
    const trInput = createInput(String(Math.min(100, Math.max(1, playerGold))), "number")
      .parent(trRow).addClass("citymgmt-input")
      .attribute("min", "1").attribute("step", "1");

    const depBtn = createButton("Deposit →").addClass("citymgmt-build-btn").parent(trRow);
    depBtn.mousePressed(() => {
      const amount = Math.floor(Number(trInput.value()) || 0);
      const res = cityManagement.transferToCity(city, amount);
      if (!res.ok) {
        const msg = res.reason === 'no_player_gold' ? "Not enough personal gold."
          : res.reason === 'bad_amount' ? "Enter a valid amount."
          : "Transfer failed.";
        _notifyCityMgmt(msg, "warning");
        return;
      }
      _notifyCityMgmt(`Deposited ${res.amount}g to city treasury.`, "success");
      _refreshCityMgmtPanel();
    });

    const wdBtn = createButton("← Withdraw").addClass("citymgmt-build-btn").parent(trRow);
    wdBtn.mousePressed(() => {
      const amount = Math.floor(Number(trInput.value()) || 0);
      const res = cityManagement.withdrawFromCity(city, amount);
      if (!res.ok) {
        const msg = res.reason === 'no_city_gold' ? "City treasury doesn't have that much."
          : res.reason === 'bad_amount' ? "Enter a valid amount."
          : "Transfer failed.";
        _notifyCityMgmt(msg, "warning");
        return;
      }
      _notifyCityMgmt(`Withdrew ${res.amount}g from city treasury.`, "success");
      _refreshCityMgmtPanel();
    });

    const quickRow = createDiv().addClass("citymgmt-row").parent(treasuryBox)
      .style("margin-top", "6px").style("gap", "6px");
    const maxDepBtn = createButton("Max Deposit").addClass("citymgmt-build-btn").parent(quickRow);
    maxDepBtn.mousePressed(() => { trInput.value(String(Math.max(1, playerGold))); });
    const maxWdBtn = createButton("Max Withdraw").addClass("citymgmt-build-btn").parent(quickRow);
    maxWdBtn.mousePressed(() => { trInput.value(String(Math.max(1, cityGold))); });
    createP("Move funds between your wallet and city treasury.")
      .parent(treasuryBox).style("font-size", "11px").style("color", "#888").style("margin", "6px 0 0");
  }

  // ─── Overview ───────────────────────────────────────────
  function _buildOverviewTab(container, city) {
    const wrap = createDiv().addClass("citymgmt-tab-inner").parent(container);

    // City info
    const infoBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "City Overview").parent(infoBox);

    const h = cityManagement.getHappiness(city);
    const tier = cityManagement.getHappinessTier(h);
    const food = cityManagement.getFoodStatus(city);
    const tax = city.management?.taxRate ?? 0.05;

    createDiv().html(
      `<div class="citymgmt-stat"><label>Population</label><span>${city.population}</span></div>` +
      `<div class="citymgmt-stat"><label>Happiness</label><span style="color:${tier.color}">${tier.emoji} ${tier.label} (${h}/100)</span></div>` +
      `<div class="citymgmt-stat"><label>Food</label><span style="color:${food.color}">${food.label} — ${food.qty} units (${food.daysLeft} days)</span></div>` +
      `<div class="citymgmt-stat"><label>Budget</label><span>💰 ${city.management?.budget || 0} gold</span></div>` +
      `<div class="citymgmt-stat"><label>Reputation</label><span>${city.reputation}/100</span></div>`
    ).parent(infoBox);

    // Tax control
    const taxBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "Tax Rate").parent(taxBox);
    const taxRow = createDiv().addClass("citymgmt-row").parent(taxBox);
    const taxSlider = createSlider(0, 50, Math.round(tax * 100), 1).parent(taxRow)
      .addClass("citymgmt-slider");
    const taxLabel = createSpan(`${Math.round(tax * 100)}%`).parent(taxRow)
      .addClass("citymgmt-tax-label");
    taxSlider.input(() => {
      taxLabel.html(`${taxSlider.value()}%`);
    });
    taxSlider.changed(() => {
      const newRate = taxSlider.value() / 100;
      cityManagement.setTaxRate(city, newRate);
      if (typeof notificationManager !== 'undefined')
        notificationManager.log(`Tax set to ${taxSlider.value()}%`, "info");
    });
    createP("Higher taxes = more revenue but lower happiness.").parent(taxBox)
      .style("font-size", "11px").style("color", "#888").style("margin", "4px 0 0 0");

    _buildTreasurySection(wrap, city);

    // Buildings summary
    const bldgBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "Buildings").parent(bldgBox);
    const features = [];
    if (city.hasBank) features.push("🏦 Bank");
    if (city.hasGamblingDen) features.push("🎲 Gambling Den");
    if (city.hasBountyBoard) features.push("📜 Bounty Board");
    if (city.hasWeaponShop) features.push("⚔️ Weapon Shop");
    if (city.hasWinery) features.push("🍷 Winery");
    if (city.hasSchool) features.push("🏫 School");
    if (city.hasBlackMarket) features.push("🏴 Black Market");
    const upgrades = city.management?.upgradeLevels || {};
    for (const [k, v] of Object.entries(upgrades)) {
      if (v > 0) features.push(`${k} (Lv${v})`);
    }
    createDiv().html(features.length > 0 ? features.join(" &nbsp;·&nbsp; ") : "<em>No buildings yet</em>")
      .parent(bldgBox).style("color", "#ccc");

    // Victory progress
    const victoryBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "Victory Condition").parent(victoryBox);
    createDiv().html(
      `<div style="font-size:11px;color:#aaa;margin-bottom:6px">Be the wealthiest city for ${cityManagement.victoryDays} consecutive days</div>` +
      `<div class="citymgmt-q-track" style="height:12px;border-radius:6px">` +
        `<div id="citymgmt-victory-bar" class="citymgmt-q-fill" style="width:0%;background:linear-gradient(90deg,#c8a030,#ffe066)"></div>` +
      `</div>` +
      `<div id="citymgmt-streak" style="font-size:12px;color:#888;margin-top:5px">0 / ${cityManagement.victoryDays} days as richest</div>`
    ).parent(victoryBox);

    // Wealth ranking
    const rankBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "Wealth Ranking").parent(rankBox);
    createDiv().id("citymgmt-ranking").parent(rankBox);

    // City inventory
    const invBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "City Inventory").parent(invBox);
    const invGrid = createDiv().addClass("citymgmt-inv-grid").parent(invBox);
    if (city.inventory.size === 0) {
      invGrid.html("<em>Empty</em>");
    } else {
      for (const [key, entry] of city.inventory) {
        if (entry.quantity <= 0) continue;
        createDiv().html(`<b>${key}</b> ×${entry.quantity}`)
          .addClass("citymgmt-inv-item").parent(invGrid);
      }
    }
  }

  // ─── Build ──────────────────────────────────────────────
  function _buildBuildTab(container, city) {
    const wrap = createDiv().addClass("citymgmt-tab-inner").parent(container);

    // Available builds
    const optBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "Available Projects").parent(optBox);

    const options = cityManagement.getBuildOptions(city);
    if (options.length === 0) {
      createP("All unique buildings constructed!").parent(optBox);
    }
    for (const opt of options) {
      const row = createDiv().addClass("citymgmt-build-row").parent(optBox);
      createSpan(`${opt.emoji} ${opt.label}`).addClass("citymgmt-build-name").parent(row);
      createSpan(`${opt.cost}g · ${opt.time}s`).addClass("citymgmt-build-cost").parent(row);
      createSpan(opt.desc).addClass("citymgmt-build-desc").parent(row);
      const btn = createButton("Build").addClass("citymgmt-build-btn").parent(row);
      btn.mousePressed(() => {
        const res = cityManagement.enqueueBuild(city, opt.type, opt.cost, opt.time);
        if (!res.ok) {
          if (typeof notificationManager !== 'undefined')
            notificationManager.log(res.reason === 'no_money' ? "Not enough city treasury gold." : "Can't build that.", "error");
          return;
        }
        _refreshCityMgmtPanel();
      });
    }

    // Active queue
    const qBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "Build Queue").parent(qBox);
    const queue = city.management?.buildingQueue || [];
    if (queue.length === 0) {
      createP("No projects in progress.").parent(qBox).style("color", "#888");
    }
    const _typeLabels = {
      bank: 'Bank', gamblingDen: 'Gambling Den', bountyBoard: 'Bounty Board',
      weaponShop: 'Weapon Shop', winery: 'Winery', school: 'School',
      temple: 'Temple', farm: 'Farm',
      warehouse: 'Warehouse', walls: 'Walls', removeBlackMarket: 'Remove Black Market',
    };
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      const pct = Math.min(100, Math.floor(((item.progress || 0) / (item.buildTime || 60)) * 100));
      const qRow = createDiv().addClass("citymgmt-queue-item").parent(qBox);
      createSpan(`${_typeLabels[item.type] || item.type} — ${pct}%`).addClass("citymgmt-q-label").parent(qRow);
      const track = createDiv().addClass("citymgmt-q-track").parent(qRow);
      createDiv().id(`citymgmt-qprog-${i}`).addClass("citymgmt-q-fill").parent(track)
        .style("width", pct + "%");
    }

    // Expand city
    const expBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "Expansion").parent(expBox);
    const expBtn = createButton("Expand City (200g)").addClass("citymgmt-build-btn").parent(expBox);
    expBtn.mousePressed(() => {
      const res = cityManagement.expandCity(city, 200);
      if (!res.ok) {
        if (typeof notificationManager !== 'undefined')
          notificationManager.log("Not enough city treasury gold to expand!", "error");
        return;
      }
      if (typeof notificationManager !== 'undefined')
        notificationManager.log(`City expanded! +${res.popGain} population`, "success");
      _refreshCityMgmtPanel();
    });
    createP("Costs 200g from city treasury. Adds population and food.").parent(expBox)
      .style("font-size", "11px").style("color", "#888").style("margin-top", "4px");
    createP("Transfer personal gold via Treasury if needed.").parent(expBox)
      .style("font-size", "11px").style("color", "#888").style("margin-top", "2px");
  }

  // ─── Trade ──────────────────────────────────────────────
  function _buildTradeTab(container, city) {
    const wrap = createDiv().addClass("citymgmt-tab-inner").parent(container);
    const _appendItemVisual = (parentEl, itemKey, qtyText = "", isSelectable = false) => {
      const pill = isSelectable
        ? createButton("").addClass("citymgmt-item-tag").parent(parentEl)
        : createDiv("").addClass("citymgmt-item-pill").parent(parentEl);

      if (typeof createItemIconEl === 'function') {
        const iconEl = createItemIconEl(itemKey, 16);
        if (iconEl) {
          iconEl.classList.add("citymgmt-item-tag-icon");
          pill.elt.appendChild(iconEl);
        }
      }

      const name = ItemLibrary?.[itemKey]?.name || itemKey;
      const label = document.createElement("span");
      label.className = "citymgmt-item-tag-label";
      label.textContent = qtyText ? `${name} ${qtyText}` : name;
      pill.elt.appendChild(label);
      return pill;
    };

    // Existing routes
    const routeBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "Active Trade Routes").parent(routeBox);
    const routes = city.management?.routes || [];
    if (routes.length === 0) {
      createP("No trade routes established.").parent(routeBox).style("color", "#888");
    }
    for (let i = 0; i < routes.length; i++) {
      const r = routes[i];
      // Find destination by name (more robust than index)
      // Backward compat: also check destIndex for old saves
      let destCity = window.cities?.find(c => c.name === r.destName);
      if (!destCity && typeof r.destIndex === 'number') {
        destCity = window.cities?.[r.destIndex];
      }
      const row = createDiv().addClass("citymgmt-route-row citymgmt-trade-route-row").parent(routeBox);
      createSpan(`→ ${destCity ? destCity.name : r.destName || '???'}`).addClass("citymgmt-route-dest").parent(row);
      const goldPart = r.goldPerTransfer > 0 ? ` · ${r.goldPerTransfer}g` : '';
      const infoCol = createDiv().addClass("citymgmt-route-info citymgmt-route-info-col").parent(row);
      createDiv(`Every ${r.frequencyDays}d${goldPart}`).parent(infoCol);
      const itemsWrap = createDiv().addClass("citymgmt-route-items").parent(infoCol);
      if (r.itemsToSend && r.itemsToSend.length > 0) {
        for (const itemKey of r.itemsToSend) {
          _appendItemVisual(itemsWrap, itemKey);
        }
      } else {
        createSpan("All goods").addClass("citymgmt-route-all").parent(itemsWrap);
      }
      const rmBtn = createButton("✕").addClass("citymgmt-route-rm").parent(row);
      rmBtn.mousePressed(() => {
        cityManagement.removeTradeRoute(city, i);
        if (typeof notificationManager !== 'undefined')
          notificationManager.log("Trade route removed.", "info");
        _refreshCityMgmtPanel();
      });
    }

    // New route form
    const newBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "Create Trade Route").parent(newBox);

    if (!window.cities || window.cities.length < 2) {
      createP("Need other cities to trade with!").parent(newBox).style("color", "#888");
      return;
    }

    // Build city data sorted by distance from player's city
    const myLoc = city.location;
    const cityEntries = [];
    for (let i = 0; i < window.cities.length; i++) {
      const c = window.cities[i];
      if (c === city) continue;
      const dx = c.location.x - myLoc.x;
      const dy = c.location.y - myLoc.y;
      const dist = Math.round(Math.sqrt(dx * dx + dy * dy));
      cityEntries.push({ city: c, index: i, dist });
    }
    cityEntries.sort((a, b) => a.dist - b.dist);

    // Pagination
    const CITIES_PER_PAGE = 8;
    let _routePage = 0;
    const totalPages = Math.max(1, Math.ceil(cityEntries.length / CITIES_PER_PAGE));

    // Selected destination
    let selectedDestCity = null;

    // City list container
    const listContainer = createDiv().parent(newBox)
      .style("max-height", "200px")
      .style("overflow-y", "auto")
      .style("border", "1px solid #444")
      .style("border-radius", "6px")
      .style("background", "rgba(30,28,35,0.6)")
      .style("margin-bottom", "8px");

    function renderCityPage() {
      listContainer.html("");
      const start = _routePage * CITIES_PER_PAGE;
      const pageEntries = cityEntries.slice(start, start + CITIES_PER_PAGE);

      for (const entry of pageEntries) {
        const row = createDiv().parent(listContainer)
          .style("display", "flex")
          .style("justify-content", "space-between")
          .style("align-items", "center")
          .style("padding", "6px 10px")
          .style("cursor", "pointer")
          .style("border-bottom", "1px solid #333")
          .style("transition", "background 0.15s");

        const isSelected = selectedDestCity === entry.city;
        row.style("background", isSelected ? "rgba(80,160,80,0.3)" : "transparent");

        row.mousePressed(() => {
          selectedDestCity = entry.city;
          renderCityPage();
        });

        row.mouseOver(() => {
          if (selectedDestCity !== entry.city) {
            row.style("background", "rgba(255,255,255,0.05)");
          }
        });
        row.mouseOut(() => {
          if (selectedDestCity !== entry.city) {
            row.style("background", "transparent");
          }
        });

        createSpan(entry.city.name).parent(row)
          .style("color", isSelected ? "#9f9" : "#ccc")
          .style("font-weight", isSelected ? "bold" : "normal");
        createSpan(`${entry.dist}t`).parent(row)
          .style("color", "#888")
          .style("font-size", "11px");
      }
    }

    // Pagination controls
    const pageRow = createDiv().parent(newBox)
      .style("display", "flex")
      .style("justify-content", "center")
      .style("align-items", "center")
      .style("gap", "8px")
      .style("margin-bottom", "12px");

    const prevPageBtn = createButton("◀").parent(pageRow)
      .style("background", "#2a2a35").style("border", "1px solid #555").style("color", "#ccc")
      .style("cursor", "pointer").style("padding", "2px 8px").style("border-radius", "4px").style("font-size", "11px");
    const pageInfo = createSpan("").parent(pageRow).style("color", "#aaa").style("font-size", "11px").style("min-width", "60px").style("text-align", "center");
    const nextPageBtn = createButton("▶").parent(pageRow)
      .style("background", "#2a2a35").style("border", "1px solid #555").style("color", "#ccc")
      .style("cursor", "pointer").style("padding", "2px 8px").style("border-radius", "4px").style("font-size", "11px");

    function updatePagination() {
      pageInfo.html(`${_routePage + 1} / ${totalPages}`);
      prevPageBtn.style("opacity", _routePage === 0 ? "0.4" : "1");
      prevPageBtn.style("pointer-events", _routePage === 0 ? "none" : "auto");
      nextPageBtn.style("opacity", _routePage >= totalPages - 1 ? "0.4" : "1");
      nextPageBtn.style("pointer-events", _routePage >= totalPages - 1 ? "none" : "auto");
    }

    prevPageBtn.mousePressed(() => {
      if (_routePage > 0) { _routePage--; renderCityPage(); updatePagination(); }
    });
    nextPageBtn.mousePressed(() => {
      if (_routePage < totalPages - 1) { _routePage++; renderCityPage(); updatePagination(); }
    });

    renderCityPage();
    updatePagination();

    // Frequency
    const optRow = createDiv().addClass("citymgmt-form-row").parent(newBox);
    createSpan("Every ").parent(optRow);
    const freqInput = createInput("7", "number").parent(optRow).addClass("citymgmt-input")
      .attribute("min", "1").attribute("max", "30").attribute("step", "1");
    createSpan(" days").parent(optRow);

    // Gold (optional)
    const optRow2 = createDiv().addClass("citymgmt-form-row").parent(newBox);
    createSpan("Gold/transfer: ").parent(optRow2);
    const goldInput = createInput("0", "number").parent(optRow2).addClass("citymgmt-input")
      .attribute("min", "0").attribute("max", "500").attribute("step", "10");

    // Items to export — show city inventory as toggleable tags
    createElement("p", "Export items (select or leave blank for all):").parent(newBox)
      .style("font-size", "11px").style("color", "#aaa").style("margin", "6px 0 4px");
    const tagRow = createDiv().parent(newBox)
      .style("display", "flex").style("flex-wrap", "wrap").style("gap", "4px").style("margin-bottom", "8px");

    const selectedItems = new Set();
    const inventoryKeys = [...city.inventory.keys()].filter(k => {
      const e = city.inventory.get(k); return e && e.quantity > 0;
    });

    for (const key of inventoryKeys) {
      const entry = city.inventory.get(key);
      const tag = _appendItemVisual(tagRow, key, `×${entry.quantity}`, true);
      tag.mousePressed(() => {
        if (selectedItems.has(key)) {
          selectedItems.delete(key);
          tag.removeClass("selected");
        } else {
          selectedItems.add(key);
          tag.addClass("selected");
        }
      });
    }
    if (inventoryKeys.length === 0) {
      createP("No items in inventory to export.").parent(newBox).style("color", "#666").style("font-size", "11px");
    }

    const createBtn = createButton("Create Route").addClass("citymgmt-build-btn").parent(newBox);
    createBtn.mousePressed(() => {
      if (!selectedDestCity) {
        if (typeof notificationManager !== 'undefined')
          notificationManager.log("Select a destination city!", "error");
        return;
      }
      const freq = Math.max(1, parseInt(freqInput.value()) || 7);
      const gold = Math.max(0, parseInt(goldInput.value()) || 0);
      const res = cityManagement.createTradeRoute(city, selectedDestCity, {
        frequencyDays: freq,
        goldPerTransfer: gold,
        goodsPerTransfer: 5,
        itemsToSend: [...selectedItems],
      });
      if (!res.ok) {
        if (typeof notificationManager !== 'undefined')
          notificationManager.log(res.reason === 'duplicate' ? "Route already exists!" : "Failed to create route.", "error");
        return;
      }
      selectedDestCity = null;
      _refreshCityMgmtPanel();
    });
  }

  // ─── Quests ─────────────────────────────────────────────
  function _buildQuestsTab(container, city) {
    const wrap = createDiv().addClass("citymgmt-tab-inner").parent(container);
    const cityIdx = window.cities ? window.cities.indexOf(city) : -1;

    // Filter quests for this city
    const myQuests = (cityManagement.demandQuests || []).filter(q => q.cityIndex === cityIdx);
    // Other cities' quests
    const otherQuests = (cityManagement.demandQuests || []).filter(q => q.cityIndex !== cityIdx);

    const myBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", `Your City's Quests (${myQuests.length})`).parent(myBox);
    if (myQuests.length === 0) {
      createP("No quests targeting your city right now.").parent(myBox).style("color", "#888");
    }
    for (const q of myQuests) {
      const card = createDiv().addClass("citymgmt-quest-card").parent(myBox);
      const progress = `${q.qtyDelivered}/${q.qtyNeeded}`;
      const day = typeof dayNight !== 'undefined' && dayNight.getDaysElapsed ? dayNight.getDaysElapsed() : 0;
      const daysLeft = Math.max(0, q.deadline - day);
      card.html(
        `<div class="citymgmt-quest-title">${q.itemName} ×${q.qtyNeeded}</div>` +
        `<div class="citymgmt-quest-detail">Progress: ${progress} · Reward: ${q.reward}g · ${daysLeft}d left</div>`
      );
      const fulfillBtn = createButton("Fulfill").addClass("citymgmt-build-btn").parent(card);
      fulfillBtn.mousePressed(() => {
        cityManagement.fulfillDemandQuests(city);
        _refreshCityMgmtPanel();
      });
    }

    // Show other quests too (info only)
    if (otherQuests.length > 0) {
      const otherBox = createDiv().addClass("citymgmt-section").parent(wrap);
      createElement("h3", `Other Cities' Quests (${otherQuests.length})`).parent(otherBox);
      for (const q of otherQuests) {
        const day = typeof dayNight !== 'undefined' && dayNight.getDaysElapsed ? dayNight.getDaysElapsed() : 0;
        const daysLeft = Math.max(0, q.deadline - day);
        createDiv().addClass("citymgmt-quest-card citymgmt-quest-other").parent(otherBox)
          .html(`<div class="citymgmt-quest-title">${q.cityName}: ${q.itemName} ×${q.qtyNeeded}</div>` +
                `<div class="citymgmt-quest-detail">${q.qtyDelivered}/${q.qtyNeeded} · ${q.reward}g · ${daysLeft}d left</div>`);
      }
    }
  }

  // ─── Actions ────────────────────────────────────────────
  function _buildUnitsTab(container, city) {
    const wrap = createDiv().addClass("citymgmt-tab-inner").parent(container);

    const unitBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "City Units").parent(unitBox);
    createP("Train units, select them on the map, click raider tiles to attack/chase, or click valid tiles to move. Land units use land; Corsairs use water/city tiles.")
      .parent(unitBox).style("font-size", "11px").style("color", "#888").style("margin", "4px 0 10px");

    const units = (city.management?.units || []);
    const unitCap = (cityManagement && typeof cityManagement.getUnitCap === 'function')
      ? cityManagement.getUnitCap(city)
      : 12;
    const readyUnits = (cityManagement && typeof cityManagement.getReadyUnitCount === 'function')
      ? cityManagement.getReadyUnitCount(city)
      : units.length;
    const nearbyRaiders = (typeof raiderManager !== 'undefined' && raiderManager && typeof raiderManager.getRaidersInRect === 'function')
      ? raiderManager.getRaidersInRect(city.location.x - 8, city.location.x + 8, city.location.y - 8, city.location.y + 8).length
      : 0;
    const hostilePressure = (cityManagement && typeof cityManagement.getHostilePressure === 'function')
      ? cityManagement.getHostilePressure(city)
      : { hostileCities: 0, hostileUnits: 0 };
    createP(`Units: ${units.length}/${unitCap} · Ready: ${readyUnits} · Nearby Raiders: ${nearbyRaiders}`)
      .parent(unitBox).style("font-size", "11px").style("color", nearbyRaiders > 0 ? "#ffb74d" : "#aaa").style("margin", "0 0 8px");
    createP(`Hostile Pressure: ${hostilePressure.hostileCities} rival cities · ${hostilePressure.hostileUnits} hostile units in region`)
      .parent(unitBox).style("font-size", "11px").style("color", hostilePressure.hostileUnits > 0 ? "#ef9a9a" : "#8bc34a").style("margin", "0 0 8px");

    const templates = (cityManagement && typeof cityManagement.getUnitTemplates === 'function')
      ? cityManagement.getUnitTemplates()
      : [{ key: 'militia', label: 'Militia', emoji: '🛡️' }];

    const spawnRow = createDiv().addClass("citymgmt-row").parent(unitBox);
    const nameInput = createInput("", "text").parent(spawnRow).addClass("citymgmt-input")
      .attribute("placeholder", "Optional name");

    const classSelect = createSelect().parent(spawnRow).addClass("citymgmt-input");
    for (const t of templates) classSelect.option(`${t.emoji} ${t.label}`, t.key);
    const tplInfo = createP("").parent(unitBox).style("font-size", "11px").style("color", "#9fa8b5").style("margin", "4px 0 8px");

    const unitCost = (cityManagement && typeof cityManagement.getUnitTrainCost === 'function')
      ? cityManagement.getUnitTrainCost(city, classSelect.value())
      : 140;
    const spawnBtn = createButton(`Train (${unitCost}g)`).addClass("citymgmt-build-btn").parent(spawnRow);
    const _syncTemplateInfo = () => {
      const sel = templates.find((t) => t.key === classSelect.value()) || templates[0];
      const badge = sel.movementType === 'naval' ? 'Naval' : 'Land';
      const coastal = sel.coastalOnly ? ' · Coastal city required' : '';
      tplInfo.html(`${sel.emoji} ${sel.label}: ${sel.desc || ''} · ${badge}${coastal}`);
    };
    _syncTemplateInfo();
    classSelect.changed(() => {
      const c = (cityManagement && typeof cityManagement.getUnitTrainCost === 'function')
        ? cityManagement.getUnitTrainCost(city, classSelect.value())
        : 140;
      spawnBtn.html(`Train (${c}g)`);
      _syncTemplateInfo();
    });
    spawnBtn.mousePressed(() => {
      if (!cityManagement || typeof cityManagement.spawnUnit !== 'function') return;
      const selectedClass = classSelect.value();
      const dynamicCost = (typeof cityManagement.getUnitTrainCost === 'function')
        ? cityManagement.getUnitTrainCost(city, selectedClass)
        : unitCost;
      const res = cityManagement.spawnUnit(city, nameInput.value(), selectedClass);
      if (!res.ok) {
        const msg = res.reason === 'no_money'
          ? `Not enough city treasury gold (need ${dynamicCost}g).`
          : res.reason === 'unit_cap'
          ? `Unit cap reached (${unitCap}). Build walls to increase cap.`
          : res.reason === 'non_coastal'
          ? "Corsairs require a coastal city."
          : "Couldn't train unit.";
        _notifyCityMgmt(msg, "error");
        return;
      }
      nameInput.value("");
      _refreshCityMgmtPanel();
    });

    if (units.length === 0) {
      createP("No units trained yet.").parent(unitBox).style("color", "#888");
    } else {
      const sortRow = createDiv().addClass("citymgmt-row").parent(unitBox).style("margin-bottom", "6px");
      createSpan("Sort").parent(sortRow).style("font-size", "11px").style("color", "#aaa");
      const sortSelect = createSelect().parent(sortRow).addClass("citymgmt-input");
      sortSelect.option("Level", "level");
      sortSelect.option("Health", "hp");
      sortSelect.option("Name", "name");
      const sortedUnits = units.slice();
      const mode = sortSelect.value() || "level";
      if (mode === "hp") sortedUnits.sort((a, b) => (b.hp / Math.max(1, b.maxHp)) - (a.hp / Math.max(1, a.maxHp)));
      else if (mode === "name") sortedUnits.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      else sortedUnits.sort((a, b) => (b.level || 1) - (a.level || 1));

      const selected = cityManagement?.getSelectedUnit ? cityManagement.getSelectedUnit() : null;
      for (const unit of sortedUnits) {
        const row = createDiv().addClass("citymgmt-route-row").parent(unitBox);
        const selectedMark = (selected && selected.id === unit.id) ? "⭐ " : "";
        const classLabel = unit.classKey ? ` [${unit.classKey}${unit.movementType === 'naval' ? '/naval' : ''}]` : "";
        createSpan(`${selectedMark}${unit.name}${classLabel}`).addClass("citymgmt-route-dest").parent(row);
        const tgt = unit.target ? ` → (${unit.target.x},${unit.target.y})` : "";
        const toNext = 20 + ((Math.max(1, unit.level || 1) - 1) * 16);
        createSpan(`Lv${unit.level || 1} · XP ${(unit.xp || 0)}/${toNext} · Kills ${unit.kills || 0} · HP ${unit.hp}/${unit.maxHp} · (${unit.x},${unit.y}) · ${unit.state}${tgt}`)
          .addClass("citymgmt-route-info").parent(row);

        const selBtn = createButton("Select").addClass("citymgmt-build-btn").parent(row);
        selBtn.mousePressed(() => {
          cityManagement.selectUnitById(city, unit.id);
          _refreshCityMgmtPanel();
        });
      }
    }

    const disbandRow = createDiv().addClass("citymgmt-row").parent(unitBox).style("margin-top", "8px");
    const disbandBtn = createButton("Disband Selected").addClass("citymgmt-build-btn citymgmt-danger-btn").parent(disbandRow);
    disbandBtn.mousePressed(() => {
      const res = cityManagement.disbandSelectedUnit(city);
      if (!res.ok) {
        _notifyCityMgmt("No unit selected.", "warning");
        return;
      }
      _refreshCityMgmtPanel();
    });

    const warBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "War Room").parent(warBox);
    createP("Launch campaigns to conquer rival cities and expand your dominion.")
      .parent(warBox).style("font-size", "11px").style("color", "#888").style("margin", "2px 0 8px");

    createP("Invade opens a dedicated tactical QTE window. Campaign outcome uses your QTE performance.")
      .parent(warBox).style("font-size", "11px").style("color", "#9fa8b5").style("margin", "2px 0 10px");

    const runInvasionGridQTE = (preview, target, onDone) => {
      const GRID_SIZE = 8;
      const PIECE_RULES = {
        rook:   { iconPlayer: '♖', iconEnemy: '♜', value: 5, label: 'Rook' },
        bishop: { iconPlayer: '♗', iconEnemy: '♝', value: 3, label: 'Bishop' },
        knight: { iconPlayer: '♘', iconEnemy: '♞', value: 3, label: 'Knight' },
        ranger: { iconPlayer: '🏹', iconEnemy: '🏹', value: 4, label: 'Ranger' },
      };
      const PIECE_ORDER = ['rook', 'ranger', 'knight', 'bishop', 'ranger', 'knight', 'rook'];
      const defenseEdge = Math.max(0, ((preview?.defensePower || 0) - (preview?.attackPower || 0)));
      const maxTurns = Math.max(9, Math.min(16, 11 + Math.floor(defenseEdge / 7)));
      const playerSlots = Math.max(3, Math.min(7, Math.round((preview?.attackPower || 10) / 5)));
      const enemySlots = Math.max(3, Math.min(7, Math.round((preview?.defensePower || 10) / 5)));
      let finished = false;
      document.getElementById('invasionQTEOverlay')?.remove();

      const overlay = document.createElement('div');
      overlay.id = 'invasionQTEOverlay';
      overlay.className = 'invasion-qte-overlay';

      const modal = document.createElement('div');
      modal.className = 'invasion-qte-window';
      overlay.appendChild(modal);

      const head = document.createElement('div');
      head.className = 'invasion-qte-head';
      modal.appendChild(head);

      const title = document.createElement('div');
      title.className = 'invasion-qte-title';
      title.textContent = 'Invasion Chess QTE';
      head.appendChild(title);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'invasion-qte-close';
      closeBtn.textContent = '✕';
      closeBtn.setAttribute('aria-label', 'Close invasion QTE');
      head.appendChild(closeBtn);

      const route = document.createElement('div');
      route.className = 'invasion-qte-route';
      route.textContent = `${city.name} → ${target?.name || 'Target City'} · ${preview?.distance || '?'} tiles`;
      modal.appendChild(route);

      const lane = document.createElement('div');
      lane.className = 'invasion-qte-lane';
      lane.innerHTML = `
        <span class="invasion-qte-lane-dot active"></span>
        <span class="invasion-qte-lane-link"></span>
        <span class="invasion-qte-lane-dot"></span>
        <span class="invasion-qte-lane-link"></span>
        <span class="invasion-qte-lane-dot"></span>
      `;
      modal.appendChild(lane);

      const stats = document.createElement('div');
      stats.className = 'invasion-qte-stats';
      stats.innerHTML = `
        <span>Win: ${Math.round((preview?.winChance || 0) * 100)}%</span>
        <span>Cost: ${preview?.warCost || 0}g</span>
        <span>Atk ${Math.round(preview?.attackPower || 0)} vs Def ${Math.round(preview?.defensePower || 0)}</span>
      `;
      modal.appendChild(stats);

      const qteStatus = document.createElement('div');
      qteStatus.className = 'invasion-qte-status';
      qteStatus.textContent = 'Player turn: select a piece, then make a legal chess move or capture.';
      modal.appendChild(qteStatus);

      const timerWrap = document.createElement('div');
      timerWrap.className = 'invasion-qte-timer-wrap';
      const timerBar = document.createElement('div');
      timerBar.className = 'invasion-qte-timer-bar';
      timerWrap.appendChild(timerBar);
      modal.appendChild(timerWrap);

      const qteTimer = document.createElement('div');
      qteTimer.className = 'invasion-qte-timer-text';
      modal.appendChild(qteTimer);

      const gridWrap = document.createElement('div');
      gridWrap.className = 'invasion-qte-grid tactical-grid';
      modal.appendChild(gridWrap);

      const actions = document.createElement('div');
      actions.className = 'invasion-qte-actions';
      modal.appendChild(actions);

      const primaryBtn = document.createElement('button');
      primaryBtn.className = 'citymgmt-build-btn';
      primaryBtn.textContent = 'Finish Battle';
      primaryBtn.disabled = true;
      actions.appendChild(primaryBtn);

      const endTurnBtn = document.createElement('button');
      endTurnBtn.className = 'citymgmt-build-btn';
      endTurnBtn.textContent = 'End Turn';
      actions.appendChild(endTurnBtn);

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'citymgmt-build-btn citymgmt-danger-btn';
      cancelBtn.textContent = 'Cancel';
      actions.appendChild(cancelBtn);

      document.body.appendChild(overlay);
      window._invasionQTEActive = true;

      const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
      const occupied = new Set();
      const pieces = [];
      let nextPieceId = 1;

      const key = (x, y) => `${x},${y}`;
      const inBounds = (x, y) => x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE;
      const pieceAt = (x, y) => pieces.find((p) => p.hp > 0 && p.x === x && p.y === y) || null;
      const living = (side) => pieces.filter((p) => p.hp > 0 && p.side === side);
      const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      const getRule = (unit) => PIECE_RULES[unit?.pieceType] || PIECE_RULES.knight;
      const pieceValue = (unit) => getRule(unit).value;

      const collectSlidingTargets = (unit, dirs, mode = 'move') => {
        const out = [];
        for (const [dx, dy] of dirs) {
          let nx = unit.x + dx;
          let ny = unit.y + dy;
          while (inBounds(nx, ny)) {
            const occ = pieceAt(nx, ny);
            if (!occ) {
              if (mode === 'move') out.push({ x: nx, y: ny });
            } else {
              if (mode === 'attack' && occ.side !== unit.side) out.push({ x: nx, y: ny, id: occ.id });
              break;
            }
            nx += dx;
            ny += dy;
          }
        }
        return out;
      };

      const collectKnightTargets = (unit, mode = 'move') => {
        const jumps = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
        const out = [];
        for (const [dx, dy] of jumps) {
          const nx = unit.x + dx;
          const ny = unit.y + dy;
          if (!inBounds(nx, ny)) continue;
          const occ = pieceAt(nx, ny);
          if (!occ && mode === 'move') out.push({ x: nx, y: ny });
          if (occ && occ.side !== unit.side && mode === 'attack') out.push({ x: nx, y: ny, id: occ.id });
        }
        return out;
      };

      const collectRangerShots = (unit) => {
        const out = [];
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [dx, dy] of dirs) {
          let nx = unit.x + dx;
          let ny = unit.y + dy;
          let step = 1;
          while (inBounds(nx, ny) && step <= 3) {
            const occ = pieceAt(nx, ny);
            if (occ) {
              if (occ.side !== unit.side && step >= 2) out.push({ x: nx, y: ny, id: occ.id, ranged: true });
              break;
            }
            nx += dx;
            ny += dy;
            step++;
          }
        }
        return out;
      };

      const spawnPiece = (side, idx) => {
        for (let tries = 0; tries < 80; tries++) {
          const x = side === 'player' ? randInt(0, 1) : randInt(GRID_SIZE - 2, GRID_SIZE - 1);
          const y = randInt(0, GRID_SIZE - 1);
          const k = key(x, y);
          if (occupied.has(k)) continue;
          occupied.add(k);
          const pieceType = PIECE_ORDER[idx % PIECE_ORDER.length];
          pieces.push({
            id: nextPieceId++,
            side,
            name: `${side === 'player' ? 'Unit' : 'Guard'} ${idx + 1}`,
            x,
            y,
            hp: 1,
            maxHp: 1,
            pieceType,
            acted: false,
          });
          return;
        }
      };

      for (let i = 0; i < playerSlots; i++) spawnPiece('player', i);
      for (let i = 0; i < enemySlots; i++) spawnPiece('enemy', i);

      let turn = 'player';
      let turnNumber = 1;
      let selectedId = null;
      let enemyActing = false;
      let resultWon = false;
      let resultScore = 0;
      let resultGrade = 'C';
      let lastOutcome = '';

      const getSelected = () => pieces.find((p) => p.id === selectedId && p.hp > 0) || null;
      const moveTargetsFor = (unit) => {
        if (!unit || unit.acted) return [];
        if (unit.pieceType === 'rook') {
          return collectSlidingTargets(unit, [[1, 0], [-1, 0], [0, 1], [0, -1]], 'move');
        }
        if (unit.pieceType === 'bishop') {
          return collectSlidingTargets(unit, [[1, 1], [1, -1], [-1, 1], [-1, -1]], 'move');
        }
        if (unit.pieceType === 'ranger') {
          const out = [];
          const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (const [dx, dy] of dirs) {
            const nx = unit.x + dx;
            const ny = unit.y + dy;
            if (!inBounds(nx, ny) || pieceAt(nx, ny)) continue;
            out.push({ x: nx, y: ny });
          }
          return out;
        }
        return collectKnightTargets(unit, 'move');
      };
      const attackTargetsFor = (unit) => {
        if (!unit || unit.acted) return [];
        if (unit.pieceType === 'rook') {
          return collectSlidingTargets(unit, [[1, 0], [-1, 0], [0, 1], [0, -1]], 'attack');
        }
        if (unit.pieceType === 'bishop') {
          return collectSlidingTargets(unit, [[1, 1], [1, -1], [-1, 1], [-1, -1]], 'attack');
        }
        if (unit.pieceType === 'ranger') {
          return collectRangerShots(unit);
        }
        return collectKnightTargets(unit, 'attack');
      };

      const renderBoard = () => {
        const selected = getSelected();
        const moveTargets = selected ? moveTargetsFor(selected) : [];
        const attackTargets = selected ? attackTargetsFor(selected) : [];
        const moveSet = new Set(moveTargets.map((m) => key(m.x, m.y)));
        const attackSet = new Set(attackTargets.map((a) => key(a.x, a.y)));
        endTurnBtn.disabled = finished || enemyActing || turn !== 'player';

        qteTimer.textContent = `Turn ${turnNumber}/${maxTurns} · Your pieces ${living('player').length} · Enemy pieces ${living('enemy').length}`;
        const turnPct = Math.max(0, Math.min(100, Math.round(((maxTurns - turnNumber + 1) / maxTurns) * 100)));
        timerBar.style.width = `${turnPct}%`;
        gridWrap.innerHTML = '';

        for (let y = 0; y < GRID_SIZE; y++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            const cell = document.createElement('button');
            cell.className = `invasion-qte-cell tactical checker-${(x + y) % 2 ? 'a' : 'b'}`;
            if (moveSet.has(key(x, y))) cell.classList.add('move-target');
            if (attackSet.has(key(x, y))) cell.classList.add('attack-target');
            const unit = pieceAt(x, y);
            if (unit) {
              const pieceEl = document.createElement('div');
              pieceEl.className = `invasion-qte-piece ${unit.side}`;
              if (unit.id === selectedId) pieceEl.classList.add('selected');
              const rule = getRule(unit);
              pieceEl.textContent = unit.side === 'player' ? rule.iconPlayer : rule.iconEnemy;
              cell.appendChild(pieceEl);
            }
            cell.addEventListener('click', () => {
              if (finished || enemyActing || turn !== 'player') return;
              const clicked = pieceAt(x, y);
              const selectedUnit = getSelected();
              if (clicked && clicked.side === 'player' && !clicked.acted) {
                selectedId = clicked.id;
                const rule = getRule(clicked);
                qteStatus.textContent = `${clicked.name} (${rule.label}) selected.`;
                renderBoard();
                return;
              }
              if (!selectedUnit) return;
              if (moveSet.has(key(x, y))) {
                selectedUnit.x = x;
                selectedUnit.y = y;
                selectedUnit.acted = true;
                selectedId = null;
                qteStatus.textContent = `${selectedUnit.name} repositioned.`;
                postPlayerAction();
                return;
              }
              if (attackSet.has(key(x, y)) && clicked && clicked.side === 'enemy') {
                clicked.hp = 0;
                selectedUnit.acted = true;
                if (selectedUnit.pieceType === 'ranger') {
                  qteStatus.textContent = `${selectedUnit.name} shot ${clicked.name} from range.`;
                } else {
                  selectedUnit.x = x;
                  selectedUnit.y = y;
                  qteStatus.textContent = `${selectedUnit.name} captured ${clicked.name}.`;
                }
                selectedId = null;
                postPlayerAction();
              }
            });
            gridWrap.appendChild(cell);
          }
        }
      };

      const closeOverlay = () => {
        finished = true;
        enemyActing = false;
        window._invasionQTEActive = false;
        overlay.remove();
      };

      closeBtn.addEventListener('click', closeOverlay);
      cancelBtn.addEventListener('click', closeOverlay);
      endTurnBtn.addEventListener('click', () => {
        if (finished || enemyActing || turn !== 'player') return;
        for (const u of living('player')) u.acted = true;
        selectedId = null;
        qteStatus.textContent = 'You ended your turn.';
        beginEnemyTurn();
      });

      const computeResult = () => {
        const playerAlive = living('player');
        const enemyAlive = living('enemy');
        const playerMaterial = playerAlive.reduce((s, u) => s + pieceValue(u), 0);
        const enemyMaterial = enemyAlive.reduce((s, u) => s + pieceValue(u), 0);
        const cleared = enemySlots - enemyAlive.length;
        const losses = playerSlots - playerAlive.length;
        const remainingTurns = Math.max(0, maxTurns - turnNumber + 1);

        if (enemyAlive.length === 0) {
          resultWon = true;
          resultScore = Math.round(76 + (playerMaterial * 2.2) + (remainingTurns * 1.4));
          lastOutcome = 'Decisive victory';
        } else if (playerAlive.length === 0) {
          resultWon = false;
          resultScore = Math.round(12 + (cleared * 9));
          lastOutcome = 'Army routed';
        } else {
          const materialEdge = playerMaterial - enemyMaterial;
          resultWon = materialEdge >= 0;
          resultScore = Math.round(48 + materialEdge * 3.5 + (cleared * 6) - (losses * 5));
          lastOutcome = resultWon ? 'Tactical advantage held' : 'Defensive line held';
        }
        resultScore = Math.max(0, Math.min(100, resultScore));
        if (resultScore >= 88) resultGrade = 'S';
        else if (resultScore >= 72) resultGrade = 'A';
        else if (resultScore >= 56) resultGrade = 'B';
        else resultGrade = 'C';
      };

      const finishBattle = () => {
        if (finished) return;
        finished = true;
        computeResult();
        const buffs = {
          S: { winBonus: 0.22, lootBonus: 0.52 },
          A: { winBonus: 0.15, lootBonus: 0.36 },
          B: { winBonus: 0.09, lootBonus: 0.22 },
          C: { winBonus: 0.03, lootBonus: 0.08 },
        }[resultGrade];
        const playerMaterial = living('player').reduce((s, u) => s + pieceValue(u), 0);
        const enemyMaterial = living('enemy').reduce((s, u) => s + pieceValue(u), 0);
        qteStatus.textContent = `${lastOutcome}. ${resultGrade} rank (${resultScore}).`;
        qteTimer.textContent = `Material ${playerMaterial} vs ${enemyMaterial} · ${resultWon ? 'Advantage attacker' : 'Advantage defender'}`;
        primaryBtn.disabled = false;
        primaryBtn.textContent = `Deploy Army (${resultGrade})`;
        primaryBtn.onclick = () => {
          closeOverlay();
          if (typeof onDone === 'function') {
            onDone({
              grade: resultGrade,
              score: resultScore,
              winBonus: buffs.winBonus,
              lootBonus: buffs.lootBonus,
              timedOut: false,
            });
          }
        };
        endTurnBtn.disabled = true;
        cancelBtn.disabled = true;
      };

      const enemyStep = () => {
        const enemies = living('enemy');
        const players = living('player');
        if (enemies.length === 0 || players.length === 0) {
          finishBattle();
          return;
        }
        const unit = enemies.find((e) => !e.acted);
        if (!unit) {
          turn = 'player';
          enemyActing = false;
          turnNumber++;
          for (const e of living('enemy')) e.acted = false;
          for (const p of living('player')) p.acted = false;
          if (turnNumber > maxTurns) {
            finishBattle();
            return;
          }
          qteStatus.textContent = 'Player turn: select a piece, then move or capture.';
          renderBoard();
          return;
        }
        const captureTargets = attackTargetsFor(unit);
        if (captureTargets.length > 0) {
          let bestCapture = null;
          for (const t of captureTargets) {
            const targetUnit = pieces.find((p) => p.id === t.id && p.hp > 0);
            if (!targetUnit) continue;
            const value = pieceValue(targetUnit);
            if (!bestCapture || value > bestCapture.value) {
              bestCapture = { ...t, targetUnit, value };
            }
          }
          if (bestCapture?.targetUnit) {
            bestCapture.targetUnit.hp = 0;
            if (unit.pieceType === 'ranger') {
              qteStatus.textContent = `${unit.name} fired on ${bestCapture.targetUnit.name}.`;
            } else {
              unit.x = bestCapture.x;
              unit.y = bestCapture.y;
              qteStatus.textContent = `${unit.name} captured ${bestCapture.targetUnit.name}.`;
            }
          }
        } else {
          const moves = moveTargetsFor(unit);
          const target = players.slice().sort((a, b) => dist(unit, a) - dist(unit, b))[0];
          let best = null;
          for (const m of moves) {
            const d2 = Math.abs(m.x - target.x) + Math.abs(m.y - target.y);
            const centerBias = Math.abs(m.x - (GRID_SIZE - 1) / 2) + Math.abs(m.y - (GRID_SIZE - 1) / 2);
            const score = d2 * 10 + centerBias;
            if (!best || score < best.score) best = { ...m, score };
          }
          if (best) {
            unit.x = best.x;
            unit.y = best.y;
            qteStatus.textContent = `${unit.name} repositioned.`;
          }
        }
        unit.acted = true;
        renderBoard();
        setTimeout(enemyStep, 220);
      };

      const beginEnemyTurn = () => {
        if (finished) return;
        turn = 'enemy';
        enemyActing = true;
        selectedId = null;
        for (const e of living('enemy')) e.acted = false;
        qteStatus.textContent = 'Enemy turn...';
        renderBoard();
        setTimeout(enemyStep, 200);
      };

      const postPlayerAction = () => {
        const players = living('player');
        const enemies = living('enemy');
        if (players.length === 0 || enemies.length === 0) {
          finishBattle();
          return;
        }
        if (players.every((p) => p.acted)) beginEnemyTurn();
        else renderBoard();
      };

      renderBoard();
    };
    const warTargets = (cityManagement && typeof cityManagement.getWarTargets === 'function')
      ? cityManagement.getWarTargets(city)
      : [];
    const activeCampaigns = (cityManagement && typeof cityManagement.getActiveCampaigns === 'function')
      ? cityManagement.getActiveCampaigns().filter(c => c && c.sourceName === city.name)
      : [];
    if (activeCampaigns.length > 0) {
      const activeBox = createDiv().addClass("citymgmt-section").parent(warBox);
      createElement("h3", "Marching Campaigns").parent(activeBox);
      const dayNow = (typeof dayNight !== 'undefined' && dayNight.getDaysElapsed) ? dayNight.getDaysElapsed() : 0;
      for (const c of activeCampaigns) {
        const rem = Math.max(0, (c.arrivalDay || 0) - dayNow);
        createDiv().parent(activeBox)
          .style("font-size", "11px")
          .style("color", "#c7c2a0")
          .style("margin", "0 0 4px")
          .html(`🧭 ${c.sourceName} → ${c.targetName} · ETA ${rem} day${rem !== 1 ? 's' : ''}`);
      }
    }
    if (!warTargets || warTargets.length === 0) {
      createP("No rival cities remain.").parent(warBox).style("color", "#9ccc65");
    } else {
      for (const target of warTargets) {
        const row = createDiv().addClass("citymgmt-route-row").parent(warBox);
        const preview = (cityManagement && typeof cityManagement.getInvasionPreview === 'function')
          ? cityManagement.getInvasionPreview(city, target)
          : null;
        const bonusText = (preview && preview.qteBonus > 0) ? ` (+${Math.round(preview.qteBonus * 100)}%)` : "";
        const chance = preview ? `${Math.round(preview.winChance * 100)}%${bonusText}` : "??%";
        const cost = preview ? `${preview.warCost}g` : "??g";
        const dist = preview ? `${preview.distance}t` : "??t";
        createSpan(`⚔️ ${target.name}`).addClass("citymgmt-route-dest").parent(row);
        createSpan(`Win ${chance} · Cost ${cost} · Dist ${dist}`).addClass("citymgmt-route-info").parent(row);
        const invadeBtn = createButton("Invade").addClass("citymgmt-build-btn").parent(row);
        invadeBtn.mousePressed(() => {
          runInvasionGridQTE(preview, target, (qteResult) => {
            if (!cityManagement || typeof cityManagement.launchInvasion !== 'function') return;
            const res = cityManagement.launchInvasion(city, target, qteResult);
            if (!res.ok) {
              const msg = res.reason === 'no_units' ? "No units available for campaign."
                : res.reason === 'no_money' ? `Need ${res.needed || preview?.warCost || 0}g in treasury.`
                : res.reason === 'campaign_busy' ? "This city already has an army marching."
                : "Campaign could not start.";
              _notifyCityMgmt(msg, "warning");
              return;
            }
            if (res.marching) {
              const rem = Math.max(0, (res.arrivalDay || 0) - ((typeof dayNight !== 'undefined' && dayNight.getDaysElapsed) ? dayNight.getDaysElapsed() : 0));
              _notifyCityMgmt(`QTE ${qteResult.grade} (${qteResult.score}). Army marching to ${target.name}. ETA ${rem} day${rem !== 1 ? 's' : ''}.`, "info");
            } else {
              _notifyCityMgmt(res.won
                ? `Victory at ${target.name}!${res.spoilsGold ? ` +${res.spoilsGold}g spoils.` : ''}`
                : `Campaign failed at ${target.name}.`, res.won ? "success" : "error");
            }
            _refreshCityMgmtPanel();
          });
        });
      }
    }

    const feedBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "Combat Feed").parent(feedBox);
    const feed = (cityManagement && typeof cityManagement.getUnitCombatFeed === 'function')
      ? cityManagement.getUnitCombatFeed()
      : [];
    if (!feed || feed.length === 0) {
      createP("No recent combat reports.").parent(feedBox).style("color", "#888");
      return;
    }
    for (const ev of feed) {
      const line = createDiv().parent(feedBox)
        .style("font-size", "11px")
        .style("margin", "0 0 4px")
        .style("color", ev.type === 'error' ? "#ef9a9a" : ev.type === 'warning' ? "#ffcc80" : "#a5d6a7");
      line.html(`• ${ev.message}`);
    }
  }

  // ─── Actions ────────────────────────────────────────────
  function _buildActionsTab(container, city) {
    const wrap = createDiv().addClass("citymgmt-tab-inner").parent(container);

    _buildTreasurySection(wrap, city);

    // Save game
    const saveBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "Game").parent(saveBox);
    const saveBtn = createButton("💾 Save Game").addClass("citymgmt-build-btn").parent(saveBox);
    saveBtn.mousePressed(() => {
      if (typeof SaveSystem !== 'undefined') {
        SaveSystem.save();
        if (typeof notificationManager !== 'undefined')
          notificationManager.log("Game saved!", "success");
      }
    });

    // Show "Return to Adventure" button if we entered city management from adventure mode
    // (Return to Adventure button moved to floating bottom right group)

    const menuBtn = createButton("🏠 Main Menu").addClass("citymgmt-build-btn citymgmt-danger-btn").parent(saveBox);
    menuBtn.mousePressed(() => {
      if (confirm("Return to main menu? Unsaved progress will be lost.")) {
        gameStateManager.setState(GameStates.MAIN_MENU);
      }
    });
  }

})();
