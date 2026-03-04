// ui/cityManagement.js — City Management UI
// Two UIManager screens:
//   "cityMgmtSettle" — placement phase (walk to a spot, click Settle Here)
//   "cityMgmtPanel"  — management phase (right-side panel, tabs)
(function () {
  if (typeof uiManager === 'undefined' || typeof GameStates === 'undefined') return;

  // ═══════════════════════════════════════════════════════════
  //  SCREEN 1 — Settlement Placement Bar
  //  Shown during CITY_MANAGE when isSettled === false
  // ═══════════════════════════════════════════════════════════
  uiManager.registerScreen("cityMgmtSettle", {
    validStates: [GameStates.CITY_MANAGE],

    create: () => {
      const bar = createDiv().id("cityMgmtSettle").addClass("citymgmt-settle-bar");
      bar.style("display", "none");

      createSpan("🏠 Pan the map with WASD, then click a tile to settle your city.")
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

  uiManager.registerScreen("cityMgmtPanel", {
    validStates: [GameStates.CITY_MANAGE],

    create: () => {
      const panel = createDiv().id("cityMgmtPanel").addClass("citymgmt-panel");
      panel.style("display", "none");

      // Header
      const header = createDiv().addClass("citymgmt-header").parent(panel);
      // Close button (top right)
      const closeBtn = createButton("✕").addClass("citymgmt-close-btn").parent(header);
      closeBtn.attribute("aria-label", "Close");
      closeBtn.style("float", "right").style("font-size", "20px").style("background", "none").style("border", "none").style("color", "#fff").style("cursor", "pointer").style("margin-left", "8px");
      closeBtn.mousePressed(() => {
        if (typeof _exitCityManageMode === 'function') {
          _exitCityManageMode();
          return;
        }
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
      const tabs = ["Overview", "Build", "Trade", "Quests", "Actions"];
      for (const tabName of tabs) {
        createButton(tabName)
          .parent(tabBar)
          .addClass("citymgmt-tab-btn")
          .attribute("data-citymgmt-tab", tabName.toLowerCase())
          .mousePressed(() => {
            window._cityMgmtTab = tabName.toLowerCase();
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
      if (typeof cityManagement === 'undefined' || !cityManagement || !cityManagement.isSettled) {
        el.style("display", "none");
        return;
      }
      el.style("display", "flex");
      _refreshCityMgmtPanel();
    },

    hide: () => {
      const el = select("#cityMgmtPanel");
      if (el) el.style("display", "none");
    },

    update: () => {
      if (typeof cityManagement === 'undefined' || !cityManagement || !cityManagement.isSettled) {
        const el = select("#cityMgmtPanel");
        if (el) el.style("display", "none");
        return;
      }
      // Light refresh — update dynamic values without rebuilding DOM
      _updateCityMgmtDynamic();
    }
  });

  // Recenter camera button — always visible when settled, resets pan offset to city
  uiManager.registerScreen("cityMgmtRecenter", {
    validStates: [GameStates.CITY_MANAGE],
    create: () => {
      const btn = createButton('🎯').id('cityMgmtRecenterBtn').addClass('citymgmt-reopen-btn');
      btn.style('display', 'none');
      btn.style('position', 'fixed');
      btn.style('right', '62px');
      btn.style('bottom', '14px');
      btn.style('width', '42px');
      btn.style('height', '42px');
      btn.style('border-radius', '8px');
      btn.style('background', 'rgba(20,18,25,0.95)');
      btn.style('border', '1px solid rgba(125,90,41,0.2)');
      btn.style('z-index', '1002');
      btn.attribute('title', 'Recenter on your city');
      btn.mousePressed(() => {
        window._cityMgmtCamOffX = 0;
        window._cityMgmtCamOffY = 0;
      });
      return btn;
    },

    show: () => {
      const el = select('#cityMgmtRecenterBtn');
      if (!el) return;
      const should = typeof cityManagement !== 'undefined' && cityManagement && cityManagement.isSettled;
      el.style('display', should ? 'flex' : 'none');
    },

    hide: () => {
      const el = select('#cityMgmtRecenterBtn'); if (el) el.style('display', 'none');
    },

    update: () => {
      const el = select('#cityMgmtRecenterBtn');
      if (!el) return;
      const should = typeof cityManagement !== 'undefined' && cityManagement && cityManagement.isSettled;
      el.style('display', should ? 'flex' : 'none');
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
        try { _refreshCityMgmtPanel(); } catch (e) {}
      });
      return btn;
    },

    show: () => {
      const el = select('#cityMgmtReopenBtn');
      const panel = select('#cityMgmtPanel');
      if (!el) return;
      // show reopen button only when panel is hidden and settlement exists
      const should = (typeof cityManagement !== 'undefined' && cityManagement && cityManagement.isSettled) && (!panel || panel.style('display') === 'none');
      el.style('display', should ? 'flex' : 'none');
    },

    hide: () => {
      const el = select('#cityMgmtReopenBtn'); if (el) el.style('display', 'none');
    },

    update: () => {
      const el = select('#cityMgmtReopenBtn');
      const panel = select('#cityMgmtPanel');
      if (!el) return;
      const should = (typeof cityManagement !== 'undefined' && cityManagement && cityManagement.isSettled) && (!panel || panel.style('display') === 'none');
      el.style('display', should ? 'flex' : 'none');
    }
  });

  // ─── Panel Refresh (full rebuild of active tab) ─────────
  function _refreshCityMgmtPanel() {
    if (!cityManagement || !cityManagement.myCity) return;
    const city = cityManagement.myCity;
    const tab = window._cityMgmtTab || "overview";

    // Header
    const nameEl = select("#citymgmtCityName");
    if (nameEl) nameEl.html(`🏰 ${city.name}`);

    const statsEl = select("#citymgmtCityStats");
    if (statsEl) {
      const h = cityManagement.getHappiness(city);
      const tier = cityManagement.getHappinessTier(h);
      const food = cityManagement.getFoodStatus(city);
      const budget = city.management?.budget || 0;
      statsEl.html(
        `<span>Pop: <b>${city.population}</b></span>` +
        `<span style="color:${tier.color}">${tier.emoji} ${tier.label} (${h})</span>` +
        `<span style="color:${food.color}">🍞 ${food.label} (${food.daysLeft}d)</span>` +
        `<span>💰 ${budget}g</span>`
      );
    }

    // Highlight active tab
    selectAll(".citymgmt-tab-btn").forEach(btn => {
      const t = btn.attribute("data-citymgmt-tab");
      if (t === tab) btn.addClass("citymgmt-tab-active");
      else btn.removeClass("citymgmt-tab-active");
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

    // Update header stats
    const statsEl = select("#citymgmtCityStats");
    if (statsEl) {
      const h = cityManagement.getHappiness(city);
      const tier = cityManagement.getHappinessTier(h);
      const food = cityManagement.getFoodStatus(city);
      const budget = city.management?.budget || 0;
      statsEl.html(
        `<span>Pop: <b>${city.population}</b></span>` +
        `<span style="color:${tier.color}">${tier.emoji} ${tier.label} (${h})</span>` +
        `<span style="color:${food.color}">🍞 ${food.label} (${food.daysLeft}d)</span>` +
        `<span>💰 ${budget}g</span>`
      );
    }

    // Update build queue progress bars if on build tab
    if (window._cityMgmtTab === "build") {
      const queue = city.management?.buildingQueue || [];
      queue.forEach((item, idx) => {
        const bar = document.getElementById(`citymgmt-qprog-${idx}`);
        if (bar) {
          const pct = Math.min(100, Math.floor(((item.progress || 0) / (item.buildTime || 60)) * 100));
          bar.style.width = pct + "%";
          const lbl = bar.parentElement?.querySelector('.citymgmt-q-label');
          if (lbl) lbl.textContent = `${item.type} — ${pct}%`;
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
      // Streak
      const streakEl = document.getElementById("citymgmt-streak");
      if (streakEl) {
        streakEl.textContent = `🏆 Richest streak: ${cityManagement.richestStreak} / ${cityManagement.victoryDays} days`;
        streakEl.style.color = cityManagement.richestStreak > 0 ? "#ffd54f" : "#888";
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  TAB BUILDERS
  // ═══════════════════════════════════════════════════════════

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

    // Buildings summary
    const bldgBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "Buildings").parent(bldgBox);
    const features = [];
    if (city.hasBank) features.push("🏦 Bank");
    if (city.hasGamblingDen) features.push("🎲 Gambling Den");
    if (city.hasBountyBoard) features.push("📜 Bounty Board");
    if (city.hasWeaponShop) features.push("⚔️ Weapon Shop");
    if (city.hasBlackMarket) features.push("🏴 Black Market");
    const upgrades = city.management?.upgradeLevels || {};
    for (const [k, v] of Object.entries(upgrades)) {
      if (v > 0) features.push(`${k} (Lv${v})`);
    }
    createDiv().html(features.length > 0 ? features.join(" &nbsp;·&nbsp; ") : "<em>No buildings yet</em>")
      .parent(bldgBox).style("color", "#ccc");

    // Wealth ranking
    const rankBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "Wealth Ranking").parent(rankBox);
    createDiv().id("citymgmt-ranking").parent(rankBox);
    createDiv().id("citymgmt-streak").parent(rankBox).style("margin-top", "6px").style("font-size", "13px");

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
            notificationManager.log(res.reason === 'no_money' ? "Not enough budget!" : "Can't build that.", "error");
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
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      const pct = Math.min(100, Math.floor(((item.progress || 0) / (item.buildTime || 60)) * 100));
      const qRow = createDiv().addClass("citymgmt-queue-item").parent(qBox);
      createSpan(`${item.type} — ${pct}%`).addClass("citymgmt-q-label").parent(qRow);
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
          notificationManager.log("Not enough budget to expand!", "error");
        return;
      }
      if (typeof notificationManager !== 'undefined')
        notificationManager.log(`City expanded! +${res.popGain} population`, "success");
      _refreshCityMgmtPanel();
    });
    createP("Costs 200g from budget. Adds population and food.").parent(expBox)
      .style("font-size", "11px").style("color", "#888").style("margin-top", "4px");
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
      const destCity = window.cities?.[r.destIndex];
      const row = createDiv().addClass("citymgmt-route-row").parent(routeBox);
      createSpan(`→ ${destCity ? destCity.name : '???'}`).addClass("citymgmt-route-dest").parent(row);
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

    // Destination
    const formRow = createDiv().addClass("citymgmt-form-row").parent(newBox);
    createSpan("To: ").parent(formRow);
    const destSelect = createSelect().parent(formRow).addClass("citymgmt-select");
    destSelect.option("-- select --", "-1");
    for (let i = 0; i < window.cities.length; i++) {
      const c = window.cities[i];
      if (c === city) continue;
      destSelect.option(c.name, String(i));
    }

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
      const destIdx = parseInt(destSelect.value());
      if (isNaN(destIdx) || destIdx < 0) {
        if (typeof notificationManager !== 'undefined')
          notificationManager.log("Select a destination city!", "error");
        return;
      }
      const destCity = window.cities[destIdx];
      const freq = Math.max(1, parseInt(freqInput.value()) || 7);
      const gold = Math.max(0, parseInt(goldInput.value()) || 0);
      const res = cityManagement.createTradeRoute(city, destCity, {
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

    // Found a new city (click-to-place on map)
    const foundBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "Found New City").parent(foundBox);
    createP("Click a tile on the map to found a new settlement. Costs 500g from your city budget.")
      .parent(foundBox).style("font-size", "12px").style("color", "#aaa");

    if (!window._cityMgmtFoundingMode) {
      const foundBtn = createButton("🏗️ Enter Founding Mode (500g)").addClass("citymgmt-build-btn").parent(foundBox);
      foundBtn.mousePressed(() => {
        if (!city.management || (city.management.budget || 0) < 500) {
          if (typeof notificationManager !== 'undefined')
            notificationManager.log("Need 500g in city budget!", "error");
          return;
        }
        window._cityMgmtFoundingMode = true;
        if (typeof notificationManager !== 'undefined')
          notificationManager.log("Founding mode ON — click a tile on the map to place your new city.", "info");
        _refreshCityMgmtPanel();
      });
    } else {
      const cancelBtn = createButton("✕ Cancel Founding Mode").addClass("citymgmt-build-btn citymgmt-danger-btn").parent(foundBox);
      cancelBtn.mousePressed(() => {
        window._cityMgmtFoundingMode = false;
        _refreshCityMgmtPanel();
      });
      createP("Click a valid tile on the map to place your new city...").parent(foundBox)
        .style("color", "#ffd54f").style("font-size", "12px").style("font-style", "italic");
    }

    // Overlay mode
    const overlayBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "Map Overlays").parent(overlayBox);
    const overlayRow = createDiv().addClass("citymgmt-form-row").parent(overlayBox);
    window._cityOverlayMode = window._cityOverlayMode || 'heatmap';
    const overlaySelect = createSelect().parent(overlayRow).addClass("citymgmt-select");
    overlaySelect.option("None", "none");
    overlaySelect.option("Reputation Heatmap", "heatmap");
    overlaySelect.option("Building Footprints", "footprints");
    overlaySelect.option("Build Queue", "queue");
    overlaySelect.option("All", "all");
    overlaySelect.selected(window._cityOverlayMode);
    overlaySelect.changed(() => {
      window._cityOverlayMode = overlaySelect.value();
      try { localStorage.setItem('cityOverlayMode', window._cityOverlayMode); } catch (e) {}
    });

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

    const menuBtn = createButton("🏠 Main Menu").addClass("citymgmt-build-btn citymgmt-danger-btn").parent(saveBox);
    menuBtn.mousePressed(() => {
      if (confirm("Return to main menu? Unsaved progress will be lost.")) {
        gameStateManager.setState(GameStates.MAIN_MENU);
      }
    });
  }

})();
