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
      const closeBtn = createButton("Hide Panel").addClass("citymgmt-close-btn").parent(header);
      closeBtn.attribute("aria-label", "Hide city management panel");
      closeBtn.attribute("title", "Hide panel (stay in city management mode)");
      closeBtn.style("float", "right").style("font-size", "20px").style("background", "none").style("border", "none").style("color", "#fff").style("cursor", "pointer").style("margin-left", "8px");
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
      const btn = createButton('🏰').id('cityMgmtReopenBtn').addClass('citymgmt-reopen-btn');
      btn.style('display', 'none');
      btn.style('position', 'fixed');
      btn.style('right', '14px');
      btn.style('bottom', '14px');
      btn.style('width', '42px');
      btn.style('height', '42px');
      btn.style('border-radius', '8px');
      btn.style('background', 'rgba(20,18,25,0.95)');
      btn.style('border', '1px solid rgba(125,90,41,0.2)');
      btn.style('z-index', '1002');
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
      const row = createDiv().addClass("citymgmt-route-row").parent(routeBox);
      createSpan(`→ ${destCity ? destCity.name : r.destName || '???'}`).addClass("citymgmt-route-dest").parent(row);
      const itemLabel = r.itemsToSend && r.itemsToSend.length > 0
        ? r.itemsToSend.join(', ')
        : 'all goods';
      const goldPart = r.goldPerTransfer > 0 ? ` · ${r.goldPerTransfer}g` : '';
      createSpan(`Every ${r.frequencyDays}d · ${itemLabel}${goldPart}`)
        .addClass("citymgmt-route-info").parent(row);
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
      const tag = createButton(`${key} ×${entry.quantity}`).parent(tagRow)
        .style("padding", "2px 8px").style("border-radius", "12px")
        .style("font-size", "11px").style("cursor", "pointer")
        .style("background", "rgba(60,55,70,0.8)").style("border", "1px solid #555")
        .style("color", "#ccc").style("transition", "all 0.15s");
      tag.mousePressed(() => {
        if (selectedItems.has(key)) {
          selectedItems.delete(key);
          tag.style("background", "rgba(60,55,70,0.8)").style("border", "1px solid #555").style("color", "#ccc");
        } else {
          selectedItems.add(key);
          tag.style("background", "rgba(80,160,80,0.4)").style("border", "1px solid #6c6").style("color", "#9f9");
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
