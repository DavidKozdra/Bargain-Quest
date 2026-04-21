// ui/cityManagement.js — City Management UI
// Two UIManager screens:
//   "cityMgmtSettle" — placement phase (walk to a spot, click Settle Here)
//   "cityMgmtPanel"  — management phase (right-side panel, tabs)
(function () {
  if (typeof uiManager === 'undefined' || typeof GameStates === 'undefined') return;
  const cityMoveHint = () => `${getActionDisplay('moveUp')}/${getActionDisplay('moveDown')}/${getActionDisplay('moveLeft')}/${getActionDisplay('moveRight')}`;
  const cityMgmtIconHTML = (frameName, size = 14, fallback = '❓') =>
    (typeof atlasIconHTML === 'function') ? atlasIconHTML(frameName, size, fallback) : fallback;
  const cityMgmtLabelHTML = (frameName, label, size = 14, fallback = '❓') =>
    `${cityMgmtIconHTML(frameName, size, fallback)} ${label}`;

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
        .style("z-index", "var(--z-layer-overlay)")
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
          <div style="display:flex;gap:10px;align-items:center"><span style="font-size:18px">${cityMgmtIconHTML('Bread', 18, '🍞')}</span><span><b>Food</b> — your population consumes food daily. Build farms or import via trade routes to prevent starvation.</span></div>
          <div style="display:flex;gap:10px;align-items:center"><span style="font-size:18px">${cityMgmtIconHTML('Cash', 18, '💰')}</span><span><b>Tax</b> — set your tax rate in the Overview tab. Higher tax = more income, lower happiness.</span></div>
          <div style="display:flex;gap:10px;align-items:center"><span style="font-size:18px">${cityMgmtIconHTML('Tools', 18, '🏗️')}</span><span><b>Build</b> — spend your city treasury on buildings. They take in-game seconds to complete.</span></div>
          <div style="display:flex;gap:10px;align-items:center"><span style="font-size:18px">${cityMgmtIconHTML('Love', 18, '🏆')}</span><span><b>Win</b> — be the wealthiest realm for 10 consecutive days to win the game.</span></div>
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
    { label: "Overview", key: "overview", atlasFrame: "Chart", icon: "◈", summary: "Daily brief, treasury health, food pressure, and city momentum." },
    { label: "Build", key: "build", atlasFrame: "Tools", icon: "⚒", summary: "District identity, project costs, and the live construction queue." },
    { label: "Trade", key: "trade", atlasFrame: "trader", icon: "⇄", summary: "Routes, imports, exports, and treasury throughput." },
    { label: "Quests", key: "quests", atlasFrame: "Chart", icon: "✦", summary: "Directives, contracts, and unresolved city pressure." },
    { label: "Units", key: "units", atlasFrame: "Shield", icon: "🛡", summary: "Garrison readiness, patrol orders, and invasion response." },
    { label: "Policy", key: "policies", atlasFrame: "Book", icon: "⚖", summary: "Long-term levers, specialization, and advisor guidance." },
    { label: "Diplo", key: "diplomacy", atlasFrame: "Friendly", icon: "☍", summary: "Relations, pacts, gifts, and covert pressure." },
    { label: "Actions", key: "actions", atlasFrame: "Wheel", icon: "⋯", summary: "Save flow, exits, and realm-level control actions." },
    { label: "Research", key: "research", atlasFrame: "Chart", icon: "🛰", summary: "Unlock city tech, orbital access, and long-range progression." },
  ];
  const CITY_MGMT_BUILD_GROUP_META = {
    economy: { label: "Economy & Trade", note: "Unlock cashflow, production loops, and merchant infrastructure." },
    growth: { label: "Food, Housing & Capacity", note: "Keep the city fed, growing, and able to hold more goods." },
    defense: { label: "Defense & Security", note: "Prepare the city for raids, invasions, and equipment demand." },
    civic: { label: "Civic Stability", note: "Raise morale, reputation, and long-term civic strength." },
    cleanup: { label: "Cleanup & Control", note: "Remove liabilities that are dragging the city down." },
    other: { label: "Other Projects", note: "Special projects that do not fit the standard lanes." },
  };

  function _isCityMgmtSettled() {
    return typeof cityManagement !== "undefined" && cityManagement && cityManagement.isSettled;
  }

  function _getCityMgmtActiveTabDef() {
    const activeKey = window._cityMgmtTab || "overview";
    return CITY_MGMT_TAB_DEFS.find((def) => def.key === activeKey) || CITY_MGMT_TAB_DEFS[0];
  }

  function _setDisplay(el, on, onValue = "flex") {
    if (!el) return;
    el.style("display", on ? onValue : "none");
  }

  function _notifyCityMgmt(msg, type = "info") {
    window.BQUI?.notify(msg, type);
  }

  function _getCityMgmtUnitsSnapshot(city) {
    if (!cityManagement || typeof cityManagement.getUnitsForCity !== "function") {
      return Array.isArray(city?.management?.units) ? city.management.units.slice() : [];
    }
    return cityManagement.getUnitsForCity(city);
  }

  function _getCityMgmtUnitSig(city) {
    const units = _getCityMgmtUnitsSnapshot(city);
    return JSON.stringify(units.map((unit) => [
      Number.isFinite(Number(unit?.id)) ? Number(unit.id) : null,
      Math.max(0, Number(unit?.hp) || 0),
      Math.max(1, Number(unit?.maxHp) || 1),
      typeof unit?.state === "string" ? unit.state : "idle",
      Math.max(1, Number(unit?.level) || 1),
      !!unit?.selected,
      Number.isFinite(Number(unit?.target?.x)) ? Math.floor(Number(unit.target.x)) : null,
      Number.isFinite(Number(unit?.target?.y)) ? Math.floor(Number(unit.target.y)) : null,
    ]));
  }

  if (typeof window !== "undefined" && typeof window.addEventListener === "function" && !window._cityMgmtUnitsChangedBound) {
    window.addEventListener("citymgmt:units-changed", (evt) => {
      try {
        if (window._cityMgmtTab !== "units") return;
        if (!_isCityMgmtSettled() || !cityManagement?.myCity) return;
        const detailCity = evt?.detail?.city || null;
        if (detailCity && detailCity !== cityManagement.myCity) return;
        window._cityMgmtUnitsSig = JSON.stringify({
          units: _getCityMgmtUnitSig(cityManagement.myCity),
          ready: (typeof cityManagement.getReadyUnitCount === "function")
            ? cityManagement.getReadyUnitCount(cityManagement.myCity)
            : 0,
        });
        _refreshCityMgmtPanel();
      } catch (_e) {}
    });
    window._cityMgmtUnitsChangedBound = true;
  }

  // ─── Floating Build Queue Overlay (top-right, always visible) ───
  function _updateFloatingBuildQueue() {
    if (!cityManagement || !cityManagement.myCity) {
      const el = document.getElementById('cityMgmtFloatingQueue');
      if (el) el.style.display = 'none';
      return;
    }
    const city = cityManagement.myCity;
    const queue = city.management?.buildingQueue || [];

    let wrap = document.getElementById('cityMgmtFloatingQueue');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'cityMgmtFloatingQueue';
      wrap.className = 'citymgmt-floating-queue';
      document.body.appendChild(wrap);
    }

    if (queue.length === 0) {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = '';

    const _typeLabels = {
      bank: 'Bank', gamblingDen: 'Gambling Den', bountyBoard: 'Bounty Board',
      weaponShop: 'Weapon Shop', winery: 'Winery', wineryExpansion: 'Winery Expansion', school: 'School',
      temple: 'Temple', farm: 'Farm', housing: 'Housing',
      warehouse: 'Warehouse', walls: 'Walls', removeBlackMarket: 'Remove Black Market',
    };

    let html = '<div class="citymgmt-fq-header">📋 Build Queue</div>';
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      const pct = Math.min(100, Math.floor(((item.progress || 0) / (item.buildTime || 60)) * 100));
      let label = _typeLabels[item.type] || item.type;
      if (typeof item.type === 'string' && item.type.startsWith('district:') && cityManagement && typeof cityManagement.getDistrictDefs === 'function') {
        const key = item.type.slice('district:'.length);
        const def = cityManagement.getDistrictDefs().find(e => e.key === key);
        if (def) label = def.label;
      }
      html += `<div class="citymgmt-fq-item">`
        + `<span class="citymgmt-fq-label">${label} — ${pct}%</span>`
        + `<div class="citymgmt-fq-track"><div class="citymgmt-fq-fill" style="width:${pct}%"></div></div>`
        + `</div>`;
    }
    wrap.innerHTML = html;
  }

  function _hideFloatingBuildQueue() {
    const el = document.getElementById('cityMgmtFloatingQueue');
    if (el) el.style.display = 'none';
  }

  function _ensureCityMgmtFloatingBtnsContainer() {
    let container = select('#cityMgmtFloatingBtns');
    if (container) return container;

    container = createDiv().id('cityMgmtFloatingBtns');
    container.style('display', 'none');
    container.style('position', 'fixed');
    container.style('right', '14px');
    container.style('bottom', '14px');
    container.style('z-index', 'var(--z-layer-popover)');
    container.style('flex-direction', 'column');
    container.style('gap', '8px');
    container.style('align-items', 'flex-end');
    return container;
  }

  function _collectOwnerPayoutForCity(city, amount = null) {
    if (!cityManagement || typeof cityManagement.collectOwnerPayout !== "function") {
      _notifyCityMgmt("Owner payout collection is unavailable.", "warning");
      return false;
    }
    const res = cityManagement.collectOwnerPayout(city, amount);
    if (!res.ok) {
      const msg = res.reason === "no_payout" ? "No owner payout is ready yet."
        : res.reason === "bad_amount" ? "Enter a valid amount."
        : "Payout collection failed.";
      _notifyCityMgmt(msg, "warning");
      return false;
    }
    _notifyCityMgmt(`Collected ${res.amount}g in owner taxes.`, "success");
    _refreshCityMgmtPanel();
    return true;
  }

  function _switchCityMgmtTab(nextTab) {
    if (!nextTab) return;
    window._cityMgmtTab = nextTab;
    _refreshCityMgmtPanel();
  }

  let _lastWealthRefreshMs = 0;
  let _leaderboardPage = 1;
  let _leaderboardPageSize = 10;
  let _leaderboardFilter = "all";
  let _closeWarRoomMapOverlay = null;
  let _closeTradeMapOverlay = null;
  let _lastWarDrillSummary = null;
  const CITY_MGMT_PANEL_WIDTH_STORAGE_KEY = "bq_cityMgmtPanelWidth";
  const CITY_MGMT_PANEL_MIN_WIDTH = 420;
  const CITY_MGMT_PANEL_MAX_WIDTH = 980;

  function _getCityMgmtPanelMaxWidth() {
    const vw = (typeof window !== "undefined" && Number.isFinite(window.innerWidth)) ? window.innerWidth : 1600;
    const capped = Math.max(CITY_MGMT_PANEL_MIN_WIDTH, Math.floor(vw * 0.96));
    return Math.min(CITY_MGMT_PANEL_MAX_WIDTH, capped);
  }

  function _clampCityMgmtPanelWidth(width) {
    const w = Number(width);
    if (!Number.isFinite(w)) return null;
    const minW = CITY_MGMT_PANEL_MIN_WIDTH;
    const maxW = _getCityMgmtPanelMaxWidth();
    return Math.max(minW, Math.min(maxW, Math.round(w)));
  }

  function _loadCityMgmtPanelWidth() {
    try {
      return _clampCityMgmtPanelWidth(localStorage.getItem(CITY_MGMT_PANEL_WIDTH_STORAGE_KEY));
    } catch (_e) {
      return null;
    }
  }

  function _saveCityMgmtPanelWidth(width) {
    const w = _clampCityMgmtPanelWidth(width);
    if (!w) return;
    try { localStorage.setItem(CITY_MGMT_PANEL_WIDTH_STORAGE_KEY, String(w)); } catch (_e) {}
  }

  function _applyCityMgmtPanelWidth(panelEl, width = null) {
    if (!panelEl) return;
    const isMobile = (() => {
      try {
        if (typeof window !== "undefined" && typeof window.getMobileContext === "function") {
          return !!window.getMobileContext().mobile;
        }
        if (typeof window !== "undefined" && typeof window.isMobile === "function") {
          return !!window.isMobile();
        }
      } catch (_e) {}
      return (typeof window !== "undefined" && Number.isFinite(window.innerWidth)) ? window.innerWidth <= 700 : false;
    })();
    if (isMobile) {
      panelEl.style.removeProperty("width");
      return;
    }
    const w = _clampCityMgmtPanelWidth(width != null ? width : _loadCityMgmtPanelWidth());
    if (w) panelEl.style.width = `${w}px`;
  }

  function _attachCityMgmtPanelResizer(panelEl, handleEl) {
    if (!panelEl || !handleEl || handleEl.__cityMgmtResizeBound) return;
    handleEl.__cityMgmtResizeBound = true;
    let isDragging = false;
    let startX = 0;
    let startW = 0;
    let prevUserSelect = "";
    let prevCursor = "";

    const stopResize = () => {
      if (!isDragging) return;
      isDragging = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
      _saveCityMgmtPanelWidth(panelEl.getBoundingClientRect().width);
    };

    const onMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const nextW = _clampCityMgmtPanelWidth(startW + dx);
      if (nextW) panelEl.style.width = `${nextW}px`;
    };

    const onUp = () => stopResize();

    handleEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      isDragging = true;
      startX = e.clientX;
      startW = panelEl.getBoundingClientRect().width;
      prevUserSelect = document.body.style.userSelect || "";
      prevCursor = document.body.style.cursor || "";
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ew-resize";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });

    if (typeof window !== "undefined" && !window._cityMgmtPanelResizeWatch) {
      window.addEventListener("resize", () => {
        const panel = document.getElementById("cityMgmtPanel");
        if (!panel) return;
        _applyCityMgmtPanelWidth(panel, panel.getBoundingClientRect().width);
      });
      window._cityMgmtPanelResizeWatch = true;
    }
  }

  function _ensureWealthRankingFresh(force = false) {
    if (!cityManagement || typeof cityManagement._updateWealthRanking !== "function") return;
    const now = Date.now();
    if (!force && (now - _lastWealthRefreshMs) < 1200) return;
    cityManagement._updateWealthRanking();
    _lastWealthRefreshMs = now;
  }

  function _getWealthRankData() {
    _ensureWealthRankingFresh();
    const ranking = Array.isArray(cityManagement?.wealthRanking) ? cityManagement.wealthRanking : [];
    const total = ranking.length;
    if (total <= 0) return { ranking: [], rank: null, total: 0, playerEntry: null };
    let rank = null;
    let playerEntry = null;
    for (let i = 0; i < ranking.length; i++) {
      if (ranking[i]?.isPlayer) {
        rank = i + 1;
        playerEntry = ranking[i];
        break;
      }
    }
    return { ranking, rank, total, playerEntry };
  }

  function _refreshWealthWidgets() {
    _ensureWealthRankingFresh();
    const { ranking, rank, total } = _getWealthRankData();
    const rankEl = document.getElementById("citymgmt-ranking-preview");
    if (rankEl) {
      rankEl.innerHTML = ranking.slice(0, 5).map((r, i) =>
        `<div class="citymgmt-rank-row${r.isPlayer ? ' citymgmt-rank-you' : ''}">`
        + `<span>#${i + 1}</span><span>${r.name}</span><span>${r.wealth}g</span></div>`
      ).join("");
      if (ranking.length <= 0) {
        rankEl.innerHTML = `<div class="citymgmt-empty-state citymgmt-empty-state-compact">No ranking data available yet.</div>`;
      }
    }

    const rankSummaryEl = document.getElementById("citymgmt-rank-summary");
    if (rankSummaryEl) {
      rankSummaryEl.textContent = (rank && total > 0)
        ? `Your rank: #${rank} of ${total}`
        : "Your rank: unavailable";
      rankSummaryEl.style.color = (rank === 1) ? "#ffd54f" : "#bbb";
    }

    if (document.getElementById("citymgmtLeaderboardModal")) {
      _renderLeaderboardModal();
    }
  }

  function _getCityMgmtDay() {
    const dn = (typeof dayNight !== "undefined" && dayNight) ? dayNight : null;
    if (!dn) return 0;
    return (typeof dn.getDaysElapsed === "function")
      ? dn.getDaysElapsed()
      : Math.floor(Number(dn.daysElapsed) || 0);
  }

  function _refreshIncomingInvasionWidget(city = null) {
    const holder = document.getElementById("citymgmt-invasion-warning");
    if (!holder || !cityManagement) return;
    const targetCity = city || cityManagement.myCity;
    if (!targetCity || typeof cityManagement.getIncomingInvasions !== "function") {
      holder.innerHTML = `<div class="citymgmt-empty-state citymgmt-empty-state-compact">Borders are quiet. No invasion warnings.</div>`;
      return;
    }
    const incoming = cityManagement.getIncomingInvasions(targetCity);
    if (!Array.isArray(incoming) || incoming.length <= 0) {
      holder.innerHTML = `<div class="citymgmt-empty-state citymgmt-empty-state-compact">Borders are quiet. No invasion warnings.</div>`;
      return;
    }
    const day = _getCityMgmtDay();
    holder.innerHTML = incoming.map((inv) => {
      const eta = Math.max(0, (Number(inv.arrivalDay) || day) - day);
      const preview = inv.preview || {};
      const threat = Math.round(Math.max(0, Number(preview.winChance) || 0) * 100);
      const threatBand = threat >= 65 ? "High" : threat >= 45 ? "Moderate" : "Low";
      const threatColor = threat >= 65 ? "#ef9a9a" : threat >= 45 ? "#ffcc80" : "#c5e1a5";
      return `<div class="citymgmt-invasion-row">`
        + `<div class="citymgmt-invasion-title">⚠️ ${inv.attackerName || "Rival City"} marching on ${inv.targetName || targetCity.name}</div>`
        + `<div class="citymgmt-invasion-meta">Arrives Day ${inv.arrivalDay} · ETA ${eta} day${eta === 1 ? "" : "s"} · Distance ${inv.distance || "?"}</div>`
        + `<div class="citymgmt-invasion-threat" style="color:${threatColor}">Threat: ${threatBand} (${threat}% success chance)</div>`
        + `</div>`;
    }).join("");
  }

  function _closeLeaderboardModal() {
    document.getElementById("citymgmtLeaderboardModal")?.remove();
  }

  function _getLeaderboardViewData() {
    const { ranking, rank, total } = _getWealthRankData();
    const filtered = _leaderboardFilter === "rivals" ? ranking.filter((r) => !r.isPlayer) : ranking.slice();
    const totalPages = Math.max(1, Math.ceil(filtered.length / Math.max(1, _leaderboardPageSize)));
    _leaderboardPage = Math.max(1, Math.min(_leaderboardPage, totalPages));
    const start = (_leaderboardPage - 1) * _leaderboardPageSize;
    const pageRows = filtered.slice(start, start + _leaderboardPageSize);
    return { ranking, filtered, pageRows, rank, total, totalPages, start };
  }

  function _renderLeaderboardModal() {
    const wrap = document.getElementById("citymgmtLeaderboardRows");
    const pageLabel = document.getElementById("citymgmtLeaderboardPage");
    const prevBtn = document.getElementById("citymgmtLeaderboardPrev");
    const nextBtn = document.getElementById("citymgmtLeaderboardNext");
    const subtitle = document.getElementById("citymgmtLeaderboardSubtitle");
    if (!wrap || !pageLabel || !prevBtn || !nextBtn || !subtitle) return;

    const { pageRows, rank, total, totalPages, start, filtered } = _getLeaderboardViewData();
    subtitle.textContent = (rank && total > 0)
      ? `Your rank: #${rank} of ${total} • Victory: richest realm for ${cityManagement.victoryDays} consecutive days`
      : `Victory: richest realm for ${cityManagement.victoryDays} consecutive days`;

    if (filtered.length <= 0) {
      wrap.innerHTML = `<div style="color:#888;font-size:12px">No cities match this filter.</div>`;
    } else {
      wrap.innerHTML = pageRows.map((r, i) => {
        const n = start + i + 1;
        return `<div class="citymgmt-rank-row${r.isPlayer ? ' citymgmt-rank-you' : ''}" style="padding:6px 8px;border-radius:6px;background:${r.isPlayer ? 'rgba(202,163,80,0.2)' : 'rgba(255,255,255,0.03)'}">`
          + `<span>#${n}</span><span>${r.name}${r.isPlayer ? ' (You)' : ''}</span><span>${r.wealth}g</span></div>`;
      }).join("");
    }

    pageLabel.textContent = `Page ${_leaderboardPage} / ${totalPages}`;
    prevBtn.disabled = _leaderboardPage <= 1;
    nextBtn.disabled = _leaderboardPage >= totalPages;
  }

  function _openLeaderboardModal() {
    _closeLeaderboardModal();
    _ensureWealthRankingFresh(true);

    const overlay = document.createElement("div");
    overlay.id = "citymgmtLeaderboardModal";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(9,8,14,0.82)";
    overlay.style.zIndex = "2200";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";

    const card = document.createElement("div");
    card.style.width = "min(620px, 94vw)";
    card.style.maxHeight = "84vh";
    card.style.overflow = "auto";
    card.style.background = "rgba(24,21,30,0.98)";
    card.style.border = "1px solid rgba(202,163,80,0.5)";
    card.style.borderRadius = "10px";
    card.style.padding = "14px";
    card.style.color = "#ddd";

    card.innerHTML = `
      <div style="font-size:18px;font-weight:700;color:#e6cb7b">Wealth Leaderboard</div>
      <div id="citymgmtLeaderboardSubtitle" style="font-size:12px;margin:4px 0 10px;color:#bbb"></div>
      <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:8px">
        <div style="display:flex;gap:8px;align-items:center">
          <label style="font-size:12px;color:#bbb">Show</label>
          <select id="citymgmtLeaderboardFilter" class="citymgmt-input" style="min-width:140px">
            <option value="all">All Cities</option>
            <option value="rivals">Rivals Only</option>
          </select>
          <label style="font-size:12px;color:#bbb">Rows</label>
          <select id="citymgmtLeaderboardPageSize" class="citymgmt-input" style="min-width:84px">
            <option value="8">8</option>
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="20">20</option>
          </select>
        </div>
        <div style="font-size:12px;color:#888">Sorted by wealth (highest first)</div>
      </div>
      <div id="citymgmtLeaderboardRows" style="display:grid;gap:6px"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;gap:8px;flex-wrap:wrap">
        <div style="display:flex;gap:8px;align-items:center">
          <button id="citymgmtLeaderboardPrev" class="citymgmt-build-btn">Prev</button>
          <div id="citymgmtLeaderboardPage" style="font-size:12px;color:#bbb"></div>
          <button id="citymgmtLeaderboardNext" class="citymgmt-build-btn">Next</button>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button id="citymgmtLeaderboardMyRank" class="citymgmt-build-btn">Jump To My Rank</button>
          <button id="citymgmtLeaderboardClose" class="citymgmt-build-btn">Close</button>
        </div>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const filterSel = document.getElementById("citymgmtLeaderboardFilter");
    const sizeSel = document.getElementById("citymgmtLeaderboardPageSize");
    if (filterSel) filterSel.value = _leaderboardFilter;
    if (sizeSel) sizeSel.value = String(_leaderboardPageSize);

    filterSel?.addEventListener("change", () => {
      _leaderboardFilter = filterSel.value === "rivals" ? "rivals" : "all";
      _leaderboardPage = 1;
      _renderLeaderboardModal();
    });
    sizeSel?.addEventListener("change", () => {
      const n = Math.max(5, Math.min(50, Number(sizeSel.value) || 10));
      _leaderboardPageSize = n;
      _leaderboardPage = 1;
      _renderLeaderboardModal();
    });
    document.getElementById("citymgmtLeaderboardPrev")?.addEventListener("click", () => {
      _leaderboardPage = Math.max(1, _leaderboardPage - 1);
      _renderLeaderboardModal();
    });
    document.getElementById("citymgmtLeaderboardNext")?.addEventListener("click", () => {
      _leaderboardPage += 1;
      _renderLeaderboardModal();
    });
    document.getElementById("citymgmtLeaderboardMyRank")?.addEventListener("click", () => {
      const { ranking } = _getWealthRankData();
      const idx = ranking.findIndex((r) => r && r.isPlayer);
      if (idx >= 0) {
        _leaderboardPage = Math.floor(idx / Math.max(1, _leaderboardPageSize)) + 1;
        _renderLeaderboardModal();
      }
    });
    document.getElementById("citymgmtLeaderboardClose")?.addEventListener("click", _closeLeaderboardModal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) _closeLeaderboardModal(); });

    _renderLeaderboardModal();
  }

  function _renderCityMgmtHeader(city) {
    const nameEl = select("#citymgmtCityName");
    if (nameEl) nameEl.html(cityMgmtLabelHTML('Shield', city.name, 18, '🏰'));

    const subtitleEl = select("#citymgmtCitySubtitle");
    const tabStateEl = select("#citymgmtTabState");
    const statsEl = select("#citymgmtCityStats");
    if (!statsEl) return;

    const activeTab = _getCityMgmtActiveTabDef();
    const h = cityManagement.getHappiness(city);
    const tier = cityManagement.getHappinessTier(h);
    const food = cityManagement.getFoodStatus(city);
    const budget = city.management?.budget || 0;
    const playerGold = (typeof player !== "undefined" && player) ? player.gold : 0;
    const popCap = (typeof city.getPopulationCap === "function") ? city.getPopulationCap() : city.population;
    const queueCount = city.management?.buildingQueue?.length || 0;
    const routeCount = city.management?.routes?.length || 0;
    const unitCount = city.management?.units?.length || 0;
    const hostilePressure = (cityManagement && typeof cityManagement.getHostilePressure === "function")
      ? cityManagement.getHostilePressure(city) : { hostileCities: 0, hostileUnits: 0 };
    const pressureScore = (hostilePressure.hostileCities * 2) + hostilePressure.hostileUnits;
    const pressureLabel = pressureScore <= 0 ? "Quiet" : pressureScore <= 3 ? "Low threat" : pressureScore <= 7 ? "Elevated threat" : "High threat";
    const dn = (typeof dayNight !== "undefined" && dayNight) ? dayNight : null;
    const day = dn
      ? (typeof dn.getDaysElapsed === "function" ? dn.getDaysElapsed() : Math.floor(Number(dn.daysElapsed) || 0))
      : 0;
    const tod = dn ? Number(dn.timeOfDay) : 0;
    const dayFrac = Math.max(0, Math.min(1, Number.isFinite(tod) ? (tod / (Math.PI * 2)) : 0));
    const totalMinutes = Math.floor(dayFrac * 24 * 60);
    const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    const season = (dn && typeof dn.getSeason === "function") ? dn.getSeason() : "";
    const seasonHTML = season ? `${cityMgmtIconHTML(season, 14, '📅')} ${season}` : "";
    const speedTxt = (typeof gameSpeed === "number") ? ` · ⏩ ${gameSpeed.toFixed(1)}x` : "";
    if (subtitleEl) {
      subtitleEl.html(
        `${queueCount} project${queueCount === 1 ? "" : "s"} live · `
        + `${routeCount} route${routeCount === 1 ? "" : "s"} · `
        + `${unitCount} unit${unitCount === 1 ? "" : "s"} · ${pressureLabel}`
      );
    }
    if (tabStateEl && activeTab) {
      tabStateEl.html(
        `<span class="citymgmt-tab-state-kicker">Selected Tab</span>`
        + `<span class="citymgmt-tab-state-label">${cityMgmtIconHTML(activeTab.atlasFrame || activeTab.key, 14, activeTab.icon || "•")} ${activeTab.label}</span>`
        + `<span class="citymgmt-tab-state-note">${activeTab.summary || ""}</span>`
      );
    }
    statsEl.html(
      `<span class="citymgmt-header-chip citymgmt-header-chip-primary">${cityMgmtIconHTML('Clock', 14, '📅')} Day ${day} · ${cityMgmtIconHTML('Clock', 14, '🕒')} ${hh}:${mm}${seasonHTML ? ` · ${seasonHTML}` : ""}${speedTxt}</span>` +
      `<span class="citymgmt-header-chip">${cityMgmtIconHTML('trader', 14, '👥')} ${city.population}/${popCap} pop</span>` +
      `<span class="citymgmt-header-chip" style="color:${tier.color}">${cityMgmtIconHTML(tier.atlasFrame || tier.label, 14, tier.emoji)} ${tier.label} (${h})</span>` +
      `<span class="citymgmt-header-chip" style="color:${food.color}">${cityMgmtIconHTML('Bread', 14, '🍞')} ${food.label} · ${food.daysLeft}d</span>` +
      `<span class="citymgmt-header-chip">${cityMgmtIconHTML('Cash', 14, '💰')} ${budget}g treasury · ${playerGold}g wallet</span>`
    );
  }

  function _mountCityMgmtInlineNodeMap(parentEl, opts = {}) {
    if (!parentEl) return () => {};

    const shell = document.createElement("div");
    shell.className = "citymgmt-inline-map-shell";
    parentEl.appendChild(shell);

    const head = document.createElement("div");
    head.className = "citymgmt-inline-map-header";
    shell.appendChild(head);

    const headCopy = document.createElement("div");
    headCopy.className = "citymgmt-inline-map-copy";
    head.appendChild(headCopy);

    const titleEl = document.createElement("div");
    titleEl.className = "citymgmt-inline-map-title";
    titleEl.textContent = opts.title || "Map";
    headCopy.appendChild(titleEl);

    const subtitleEl = document.createElement("div");
    subtitleEl.className = "citymgmt-inline-map-subtitle";
    subtitleEl.textContent = opts.subtitle || "Click a node to inspect it.";
    headCopy.appendChild(subtitleEl);

    const overlay = document.createElement("div");
    overlay.className = "travel-map-overlay citymgmt-inline-map-layout";
    shell.appendChild(overlay);

    const mapWrap = document.createElement("div");
    mapWrap.className = "travel-map-canvas-wrap citymgmt-inline-map-canvas-wrap";
    overlay.appendChild(mapWrap);

    const canvasSize = Math.max(220, Math.min(360, Number(opts.canvasSize) || 320));
    const canvasEl = document.createElement("canvas");
    canvasEl.width = canvasSize;
    canvasEl.height = canvasSize;
    canvasEl.className = "travel-map-canvas citymgmt-inline-map-canvas";
    mapWrap.appendChild(canvasEl);

    const sidebar = document.createElement("div");
    sidebar.className = "travel-map-sidebar citymgmt-inline-map-sidebar";
    overlay.appendChild(sidebar);

    const sideHead = document.createElement("div");
    sideHead.className = "travel-sidebar-header";
    sidebar.appendChild(sideHead);

    const sideTitle = document.createElement("h3");
    sideTitle.className = "citymgmt-inline-map-side-title";
    sideHead.appendChild(sideTitle);

    const sideSub = document.createElement("p");
    sideSub.className = "citymgmt-inline-map-side-subtitle";
    sideHead.appendChild(sideSub);

    const sideBody = document.createElement("div");
    sideBody.className = "travel-sidebar-body";
    sidebar.appendChild(sideBody);

    if (opts.legendHTML) {
      const legend = document.createElement("div");
      legend.className = "travel-map-legend citymgmt-inline-map-legend";
      legend.innerHTML = opts.legendHTML;
      sidebar.appendChild(legend);
    }

    const ctx = canvasEl.getContext("2d");
    const baseScale = Number(opts.baseScale) > 0
      ? Number(opts.baseScale)
      : (canvasSize / Math.max(typeof cols !== "undefined" ? cols : 100, typeof rows !== "undefined" ? rows : 100));
    const entries = Array.isArray(opts.entries) ? opts.entries : [];
    const getPos = typeof opts.getEntryPosition === "function"
      ? opts.getEntryPosition
      : (entry) => ({ x: Number(entry?.x) || 0, y: Number(entry?.y) || 0 });
    const getLabel = typeof opts.getEntryLabel === "function"
      ? opts.getEntryLabel
      : (entry) => String(entry?.name || entry?.city?.name || "Node");
    const defaultSidebarTitle = opts.defaultSidebarTitle || "Select a node";
    const defaultSidebarSubtitle = opts.defaultSidebarSubtitle || "Click a map node to inspect it.";

    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let selected = entries.find((entry) => typeof opts.isInitiallySelected === "function" && opts.isInitiallySelected(entry)) || null;
    let hovered = null;
    let nodeMarkers = [];

    const setDefaultSidebar = () => {
      sideTitle.textContent = defaultSidebarTitle;
      sideSub.textContent = defaultSidebarSubtitle;
    };

    const updateSidebar = (entry) => {
      sideBody.innerHTML = "";
      const handled = typeof opts.renderSidebar === "function"
        ? opts.renderSidebar({ entry, sideTitle, sideSub, sideBody })
        : false;
      if (handled === false) setDefaultSidebar();
    };

    const drawMap = () => {
      const scale = baseScale * zoom;
      ctx.fillStyle = opts.backgroundColor || "#0a0a1a";
      ctx.fillRect(0, 0, canvasSize, canvasSize);
      if (typeof minimapGraphics !== "undefined" && minimapGraphics) {
        const mmSize = 200;
        const zoomedSize = canvasSize * zoom;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, canvasSize, canvasSize);
        ctx.clip();
        ctx.drawImage(minimapGraphics.canvas || minimapGraphics.elt, 0, 0, mmSize, mmSize, panX, panY, zoomedSize, zoomedSize);
        ctx.restore();
      }
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(0, 0, canvasSize, canvasSize);

      if (typeof opts.drawConnections === "function") {
        opts.drawConnections({ ctx, scale, panX, panY, entries });
      }

      nodeMarkers = [];
      const markerRadius = Math.max(5, Math.min(8, scale * 1.5));
      for (const entry of entries) {
        const pos = getPos(entry);
        if (!Number.isFinite(pos?.x) || !Number.isFinite(pos?.y)) continue;
        const cx = pos.x * scale + panX;
        const cy = pos.y * scale + panY;
        const isSelected = !!(selected && selected === entry);
        const isHover = !!(hovered && hovered === entry);
        const style = (typeof opts.getMarkerStyle === "function")
          ? opts.getMarkerStyle(entry, { selected: isSelected, hovered: isHover })
          : {};

        ctx.beginPath();
        ctx.arc(cx, cy, markerRadius + 2, 0, Math.PI * 2);
        ctx.fillStyle = style.glow || "rgba(212,175,55,0.24)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, markerRadius, 0, Math.PI * 2);
        ctx.fillStyle = style.fill || "#d4af37";
        ctx.strokeStyle = style.stroke || "#f0d060";
        ctx.lineWidth = style.lineWidth || ((isSelected || isHover) ? 2.4 : 1.5);
        ctx.fill();
        ctx.stroke();

        const label = getLabel(entry);
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = style.labelColor || ((isSelected || isHover) ? "#ffe066" : "#fff");
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.lineWidth = 2.5;
        ctx.strokeText(label, cx, cy - markerRadius - 4);
        ctx.fillText(label, cx, cy - markerRadius - 4);

        nodeMarkers.push({ entry, x: pos.x, y: pos.y, r: markerRadius + 4 });
      }
    };

    const getEntryAt = (mx, my) => {
      const scale = baseScale * zoom;
      const mapX = (mx - panX) / scale;
      const mapY = (my - panY) / scale;
      for (const marker of nodeMarkers) {
        const dx = mapX - marker.x;
        const dy = mapY - marker.y;
        const rr = marker.r / scale;
        if ((dx * dx) + (dy * dy) <= rr * rr) return marker.entry;
      }
      return null;
    };

    const onDragMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      panX += dx;
      panY += dy;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      drawMap();
    };

    const stopDrag = () => {
      isDragging = false;
    };

    canvasEl.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = canvasEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.2 : 0.8;
      const newZoom = Math.max(0.5, Math.min(4, zoom * factor));
      panX = mx - (mx - panX) * (newZoom / zoom);
      panY = my - (my - panY) * (newZoom / zoom);
      zoom = newZoom;
      drawMap();
    }, { passive: false });

    canvasEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
    });

    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", stopDrag);

    canvasEl.addEventListener("mousemove", (e) => {
      if (isDragging) return;
      const rect = canvasEl.getBoundingClientRect();
      const hit = getEntryAt(e.clientX - rect.left, e.clientY - rect.top);
      if (hit !== hovered) {
        hovered = hit;
        canvasEl.style.cursor = hit ? "pointer" : "default";
        drawMap();
      }
    });

    canvasEl.addEventListener("mouseleave", () => {
      hovered = null;
      canvasEl.style.cursor = "default";
      drawMap();
    });

    canvasEl.addEventListener("click", (e) => {
      if (isDragging) return;
      const rect = canvasEl.getBoundingClientRect();
      const hit = getEntryAt(e.clientX - rect.left, e.clientY - rect.top);
      if (!hit) return;
      selected = hit;
      updateSidebar(hit);
      drawMap();
      if (typeof opts.onEntrySelect === "function") {
        opts.onEntrySelect(hit);
      }
    });

    let touchStartX = 0;
    let touchStartY = 0;
    let touchIsDrag = false;
    canvasEl.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      dragStartX = t.clientX;
      dragStartY = t.clientY;
      touchIsDrag = false;
    }, { passive: true });

    canvasEl.addEventListener("touchmove", (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - dragStartX;
      const dy = t.clientY - dragStartY;
      if (Math.abs(t.clientX - touchStartX) > 8 || Math.abs(t.clientY - touchStartY) > 8) touchIsDrag = true;
      panX += dx;
      panY += dy;
      dragStartX = t.clientX;
      dragStartY = t.clientY;
      drawMap();
      e.preventDefault();
    }, { passive: false });

    canvasEl.addEventListener("touchend", () => {
      if (touchIsDrag) return;
      const rect = canvasEl.getBoundingClientRect();
      const hit = getEntryAt(touchStartX - rect.left, touchStartY - rect.top);
      if (!hit) return;
      selected = hit;
      updateSidebar(hit);
      drawMap();
      if (typeof opts.onEntrySelect === "function") {
        opts.onEntrySelect(hit);
      }
    }, { passive: true });

    updateSidebar(selected);
    drawMap();

    return () => {
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", stopDrag);
    };
  }

  uiManager.registerScreen("cityMgmtPanel", {
    validStates: [GameStates.CITY_MANAGE],

    create: () => {
      const panel = createDiv().id("cityMgmtPanel").addClass("citymgmt-panel");
      panel.style("display", "none");
      const panelEl = panel.elt;
      _applyCityMgmtPanelWidth(panelEl);

      const resizeHandle = createDiv().addClass("citymgmt-panel-resize-handle").parent(panel);
      resizeHandle.attribute("aria-label", "Resize city management panel");
      resizeHandle.attribute("title", "Drag to resize panel");
      _attachCityMgmtPanelResizer(panelEl, resizeHandle.elt);

      // Header
      const header = createDiv().addClass("citymgmt-header").parent(panel);
      const headerTop = createDiv().addClass("citymgmt-header-top").parent(header);
      const headerMain = createDiv().addClass("citymgmt-header-main").parent(headerTop);
      createDiv("").html(cityMgmtLabelHTML('Shield', 'City Command', 14, '🏛️')).addClass("citymgmt-header-kicker").parent(headerMain);
      createDiv().id("citymgmtCityName").addClass("citymgmt-city-name").parent(headerMain);
      createDiv("Manage taxes, building, trade, units, and policy.")
        .id("citymgmtCitySubtitle")
        .addClass("citymgmt-city-subtitle")
        .parent(headerMain);
      createDiv()
        .id("citymgmtTabState")
        .addClass("citymgmt-tab-state")
        .parent(headerMain);

      // Close button (top right)
      const closeBtn = createButton("✕").addClass("citymgmt-close-btn").parent(headerTop);
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
      createDiv().id("citymgmtCityStats").addClass("citymgmt-city-stats").parent(header);

      // Tab bar
      const tabBar = createDiv().addClass("citymgmt-tab-bar").parent(header);
      for (const t of CITY_MGMT_TAB_DEFS) {
        const btn = createButton("")
          .parent(tabBar)
          .addClass("citymgmt-tab-btn")
          .attribute("data-citymgmt-tab", t.key)
          .mousePressed(() => {
            _switchCityMgmtTab(t.key);
          });
        btn.attribute("aria-label", t.label);
        btn.attribute("title", t.label);
        btn.html(
          `<span class="citymgmt-tab-icon">${cityMgmtIconHTML(t.atlasFrame || t.key, 14, t.icon || "•")}</span>`
          + `<span class="citymgmt-tab-label">${t.label}</span>`
        );
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
      _applyCityMgmtPanelWidth(el.elt || el);
      _setDisplay(el, true);
      _refreshCityMgmtPanel();
    },

    hide: () => {
      const el = select("#cityMgmtPanel");
      if (el) el.style("display", "none");
      _closeLeaderboardModal();
      if (typeof _closeWarRoomMapOverlay === 'function') _closeWarRoomMapOverlay();
      _closeWarRoomMapOverlay = null;
      if (typeof _closeTradeMapOverlay === 'function') _closeTradeMapOverlay();
      _closeTradeMapOverlay = null;
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
      const container = _ensureCityMgmtFloatingBtnsContainer();

      // Return to Adventure button (prominent, only if _adventureCityManage)
      const returnBtn = createButton('').id('cityMgmtAdventureBtn');
      returnBtn.html(`${atlasIconHTML('Cash', 16, '🗺️')} Return to Adventure`);
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
      _hideFloatingBuildQueue();
    },

    update: () => {
      const container = select('#cityMgmtFloatingBtns');
      const adventureBtn = select('#cityMgmtAdventureBtn');
      const should = _isCityMgmtSettled();
      if (container) container.style('display', should ? 'flex' : 'none');
      if (adventureBtn) adventureBtn.style('display', (should && window._adventureCityManage) ? 'flex' : 'none');
      if (should) _updateFloatingBuildQueue();
      else _hideFloatingBuildQueue();
    }
  });

  // Small persistent reopen button — appears when panel hidden while in CITY_MANAGE
  uiManager.registerScreen("cityMgmtReopen", {
    validStates: [GameStates.CITY_MANAGE],
    create: () => {
      const container = _ensureCityMgmtFloatingBtnsContainer();
      const btn = createButton('').id('cityMgmtReopenBtn').addClass('citymgmt-reopen-btn');
      btn.html(cityMgmtLabelHTML('Shield', 'Open City Panel', 16, '🏰'));
      btn.style('display', 'none');
      btn.attribute("aria-label", "Open city panel");
      btn.attribute("title", "Open city panel");
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
      container.child(btn);
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
    if (typeof document !== "undefined") {
      document.querySelectorAll(".citymgmt-tab-btn").forEach((btn) => {
        const isActive = btn.getAttribute("data-citymgmt-tab") === tab;
        btn.setAttribute("aria-current", isActive ? "page" : "false");
        btn.setAttribute("data-active", isActive ? "true" : "false");
      });
    }

    // Build tab content
    const content = select("#citymgmtTabContent");
    if (!content) return;
    if (typeof _closeWarRoomMapOverlay === "function") _closeWarRoomMapOverlay();
    _closeWarRoomMapOverlay = null;
    if (typeof _closeTradeMapOverlay === "function") _closeTradeMapOverlay();
    _closeTradeMapOverlay = null;
    content.html("");

    switch (tab) {
      case "overview":  _buildOverviewTab(content, city); break;
      case "build":     _buildBuildTab(content, city); break;
      case "trade":     _buildTradeTab(content, city); break;
      case "quests":    _buildQuestsTab(content, city); break;
      case "units":     _buildUnitsTab(content, city); break;
      case "policies":  _buildPoliciesTab(content, city); break;
      case "diplomacy": _buildDiplomacyTab(content, city); break;
      case "actions":   _buildActionsTab(content, city); break;
      case "research":  _buildResearchTab(content, city); break;
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
        weaponShop: 'Weapon Shop', winery: 'Winery', wineryExpansion: 'Winery Expansion', school: 'School',
        temple: 'Temple', farm: 'Farm', housing: 'Housing',
        warehouse: 'Warehouse', walls: 'Walls', removeBlackMarket: 'Remove Black Market',
      };
      const queue = city.management?.buildingQueue || [];
      const queueRows = document.querySelectorAll('#citymgmtTabContent .citymgmt-queue-item').length;
      // Queue structure changed (completed/added/reordered): rebuild to avoid stale 99% rows.
      if (queueRows !== queue.length) {
        _refreshCityMgmtPanel();
        return;
      }
      for (let idx = 0; idx < queue.length; idx++) {
        const item = queue[idx];
        const bar = document.getElementById(`citymgmt-qprog-${idx}`);
        if (!bar) {
          _refreshCityMgmtPanel();
          return;
        }
        const pct = Math.min(100, Math.floor(((item.progress || 0) / (item.buildTime || 60)) * 100));
        bar.style.width = pct + "%";
        // Label is a sibling of the track, not inside it — go up two levels to .citymgmt-queue-item
        const lbl = bar.parentElement?.parentElement?.querySelector('.citymgmt-q-label');
        let label = _typeLabels[item.type] || item.type;
        if (typeof item.type === "string" && item.type.startsWith("district:") && cityManagement && typeof cityManagement.getDistrictDefs === "function") {
          const key = item.type.slice("district:".length);
          const def = cityManagement.getDistrictDefs().find((entry) => entry.key === key);
          if (def) label = def.label;
        }
        if (lbl) lbl.textContent = `${label} — ${pct}%`;
      }
    }

    // Update ranking if on overview tab
    if (window._cityMgmtTab === "overview") {
      const dailyBrief = (cityManagement && typeof cityManagement.getCityDailyBrief === "function")
        ? cityManagement.getCityDailyBrief(city)
        : null;
      const cityFeed = (cityManagement && typeof cityManagement.getCityFeed === "function")
        ? cityManagement.getCityFeed(city, 1)
        : [];
      const overviewSig = JSON.stringify({
        day: (typeof dayNight !== "undefined" && dayNight?.getDaysElapsed) ? dayNight.getDaysElapsed() : 0,
        budget: Math.floor(Number(city.management?.budget) || 0),
        payoutDue: Math.floor(Number(city.management?.ownerPayoutDue) || 0),
        population: Math.floor(Number(city.population) || 0),
        reputation: Math.round(Number(city.reputation) || 0),
        taxRate: Math.round((Number(city.management?.taxRate) || 0) * 1000),
        happiness: Math.round(Number(cityManagement.getHappiness?.(city)) || 0),
        foodDays: Math.floor(Number(cityManagement.getFoodStatus?.(city)?.daysLeft) || 0),
        queue: (city.management?.buildingQueue || []).map((entry) => [entry.type, Math.floor(Number(entry.progress) || 0)]),
        routes: (city.management?.routes || []).length,
        units: (city.management?.units || []).length,
        brief: dailyBrief ? [dailyBrief.day, dailyBrief.budgetDelta, dailyBrief.routeLostDelta, dailyBrief.populationDelta] : null,
        feedHead: cityFeed[0] ? [cityFeed[0].day, cityFeed[0].message] : null,
        districts: (typeof cityManagement.getCityDistricts === "function")
          ? cityManagement.getCityDistricts(city).map((entry) => [entry.key, entry.currentTier, !!entry.queueEntry])
          : [],
      });
      if (window._cityMgmtOverviewSig !== overviewSig) {
        window._cityMgmtOverviewSig = overviewSig;
        _refreshCityMgmtPanel();
        return;
      }
      _refreshWealthWidgets();
      _refreshIncomingInvasionWidget(city);
      // Victory progress bar
      const streakEl = document.getElementById("citymgmt-streak");
      const victoryBar = document.getElementById("citymgmt-victory-bar");
      const streak = Math.max(0, Number(cityManagement.richestStreak) || 0);
      const goal = cityManagement.victoryDays;
      const streakShown = Math.min(goal, streak);
      const pct = Math.min(100, Math.round((streakShown / Math.max(1, goal)) * 100));
      if (victoryBar) victoryBar.style.width = pct + "%";
      if (streakEl) {
        const isLeading = streak > 0;
        streakEl.innerHTML = isLeading
          ? `${cityMgmtLabelHTML('Love', `${streakShown} / ${goal} consecutive days as richest realm (${pct}%)`, 14, '🏆')}`
          : `Not currently the wealthiest realm`;
        streakEl.style.color = streak >= goal ? "#ffe066" : isLeading ? "#ffd54f" : "#666";
      }
    }

    if (window._cityMgmtTab === "actions") {
      const ops = (typeof cityManagement.getActiveCityOperations === "function")
        ? cityManagement.getActiveCityOperations(city)
        : [];
      const buffs = (typeof cityManagement.getActiveCityBonuses === "function")
        ? cityManagement.getActiveCityBonuses(city)
        : [];
      const sig = JSON.stringify({
        ops: ops.map((op) => [op.key, op.remainingDays]),
        buffs: buffs.map((buff) => [buff.key, buff.remainingDays]),
      });
      if (window._cityMgmtActionsSig !== sig) {
        window._cityMgmtActionsSig = sig;
        _refreshCityMgmtPanel();
      }
    }

    if (window._cityMgmtTab === "quests") {
      const directives = (typeof cityManagement.getCityDirectives === "function")
        ? cityManagement.getCityDirectives(city)
        : [];
      const cityIdx = Array.isArray(window.cities) ? window.cities.indexOf(city) : -1;
      const myQuests = Array.isArray(cityManagement?.demandQuests)
        ? cityManagement.demandQuests.filter((q) => q.cityIndex === cityIdx)
        : [];
      const sig = JSON.stringify({
        day: (typeof dayNight !== "undefined" && dayNight?.getDaysElapsed) ? dayNight.getDaysElapsed() : 0,
        directives: directives.map((entry) => [entry.key, entry.remainingDays, entry.progress?.current]),
        quests: myQuests.map((q) => [q.itemName, q.qtyDelivered, q.deadline]),
      });
      if (window._cityMgmtQuestSig !== sig) {
        window._cityMgmtQuestSig = sig;
        _refreshCityMgmtPanel();
      }
    }

    if (window._cityMgmtTab === "trade") {
      const threatReport = (typeof cityManagement.getCityThreatReport === "function")
        ? cityManagement.getCityThreatReport(city)
        : null;
      const snaps = threatReport?.routeThreats || ((typeof cityManagement.getRouteSnapshots === "function")
        ? cityManagement.getRouteSnapshots(city)
        : []);
      const sig = JSON.stringify({
        day: (typeof dayNight !== "undefined" && dayNight?.getDaysElapsed) ? dayNight.getDaysElapsed() : 0,
        routes: snaps.map((snap) => [
          snap.route?.destName,
          snap.threatScore ?? null,
          snap.activeShipment?.remainingDays ?? null,
          snap.activeShipment?.incidentKey ?? null,
          snap.lastShipment?.arrivalDay ?? null,
          snap.lastShipment?.incidentKey ?? null,
        ]),
        rivals: (threatReport?.rivalThreats || []).slice(0, 3).map((entry) => [entry.city?.name, entry.threatScore, entry.units]),
      });
      if (window._cityMgmtTradeSig !== sig) {
        window._cityMgmtTradeSig = sig;
        _refreshCityMgmtPanel();
      }
    }

    if (window._cityMgmtTab === "units") {
      const sig = JSON.stringify({
        units: _getCityMgmtUnitSig(city),
        ready: (cityManagement && typeof cityManagement.getReadyUnitCount === "function")
          ? cityManagement.getReadyUnitCount(city)
          : 0,
      });
      if (window._cityMgmtUnitsSig !== sig) {
        window._cityMgmtUnitsSig = sig;
        _refreshCityMgmtPanel();
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
    const payoutDue = Math.floor(city.management?.ownerPayoutDue || 0);
    const ownerShare = Math.round((Math.max(0.10, Math.min(0.80, Number(city.management?.ownerTaxShare) || 0.35))) * 100);
    createDiv().html(
      `<div class="citymgmt-stat"><label>Your Gold</label><span>${playerGold}g</span></div>` +
      `<div class="citymgmt-stat"><label>City Treasury</label><span>${cityGold}g</span></div>` +
      `<div class="citymgmt-stat"><label>Owner Payout Due</label><span>${payoutDue}g</span></div>` +
      `<div class="citymgmt-stat"><label>Owner Tax Share</label><span>${ownerShare}%</span></div>`
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
    const maxPayoutBtn = createButton("Max Payout").addClass("citymgmt-build-btn").parent(quickRow);
    maxPayoutBtn.mousePressed(() => { trInput.value(String(Math.max(1, payoutDue))); });

    const payoutRow = createDiv().addClass("citymgmt-row").parent(treasuryBox)
      .style("margin-top", "8px").style("gap", "6px");
    const collectBtn = createButton("Collect Payout").addClass("citymgmt-build-btn").parent(payoutRow);
    collectBtn.mousePressed(() => {
      _collectOwnerPayoutForCity(city, Math.floor(Number(trInput.value()) || 0));
    });
    const collectAllBtn = createButton("Collect All").addClass("citymgmt-build-btn").parent(payoutRow);
    collectAllBtn.mousePressed(() => {
      _collectOwnerPayoutForCity(city);
    });

    const ownerRow = createDiv().addClass("citymgmt-row").parent(treasuryBox).style("margin-top", "8px");
    const ownerShareSlider = createSlider(10, 80, ownerShare, 1).parent(ownerRow).addClass("citymgmt-slider");
    const ownerShareLabel = createSpan(`${ownerShare}% to owner · ${100 - ownerShare}% to treasury`).parent(ownerRow)
      .addClass("citymgmt-tax-label");
    ownerShareSlider.input(() => {
      const v = Math.max(10, Math.min(80, Number(ownerShareSlider.value()) || 35));
      ownerShareLabel.html(`${v}% to owner · ${100 - v}% to treasury`);
    });
    ownerShareSlider.changed(() => {
      const v = Math.max(10, Math.min(80, Number(ownerShareSlider.value()) || 35));
      if (cityManagement && typeof cityManagement.setOwnerTaxShare === "function") {
        cityManagement.setOwnerTaxShare(city, v / 100);
      } else {
        city.management.ownerTaxShare = v / 100;
      }
      _notifyCityMgmt(`Owner tax share set to ${v}%.`, "info");
      _refreshCityMgmtPanel();
    });
    createP("Move funds between your wallet and city treasury. Owner payout is separate tax income and can be collected directly.")
      .parent(treasuryBox).style("font-size", "11px").style("color", "#888").style("margin", "6px 0 0");
  }

  function _formatCityMgmtEffectText(effectKey, value) {
    const labels = {
      happiness: "Happiness",
      routeIncome: "Route Income",
      taxIncome: "Tax Income",
      buildSpeed: "Build Speed",
      productionChance: "Production",
      productionDouble: "Double Output",
      popGrowth: "Pop Growth",
      defense: "Defense",
      unitCap: "Unit Cap",
      unitCostDiscount: "Unit Cost",
      foodSaving: "Food Use",
    };
    const percentKeys = new Set([
      "routeIncome",
      "taxIncome",
      "buildSpeed",
      "productionChance",
      "productionDouble",
      "popGrowth",
      "defense",
      "unitCostDiscount",
      "foodSaving",
    ]);
    const numeric = Number(value) || 0;
    const sign = numeric >= 0 ? "+" : "";
    const formatted = percentKeys.has(effectKey)
      ? `${sign}${Math.round(numeric * 100)}%`
      : `${sign}${Math.round(numeric * 100) / 100}`;
    return `${labels[effectKey] || effectKey} ${formatted}`;
  }

  // ─── Overview ───────────────────────────────────────────
  function _buildOverviewTab(container, city) {
    const wrap = createDiv().addClass("citymgmt-tab-inner citymgmt-overview-tab").parent(container);

    const h = cityManagement.getHappiness(city);
    const tier = cityManagement.getHappinessTier(h);
    const food = cityManagement.getFoodStatus(city);
    const tax = city.management?.taxRate ?? 0.05;
    const repRaw = Math.max(0, Math.min(100, Number(city.reputation) || 0));
    const popCap = (typeof city.getPopulationCap === "function") ? city.getPopulationCap() : city.population;
    const playerGold = (typeof player !== "undefined" && player) ? Math.floor(player.gold || 0) : 0;
    const cityGold = Math.floor(city.management?.budget || 0);
    const payoutDue = Math.floor(city.management?.ownerPayoutDue || 0);
    const ownerShare = Math.round((Math.max(0.10, Math.min(0.80, Number(city.management?.ownerTaxShare) || 0.35))) * 100);
    const routeCount = city.management?.routes?.length || 0;
    const queueCount = city.management?.buildingQueue?.length || 0;
    const unitCount = city.management?.units?.length || 0;
    const readyUnits = (cityManagement && typeof cityManagement.getReadyUnitCount === "function")
      ? cityManagement.getReadyUnitCount(city) : unitCount;
    const unitCap = (cityManagement && typeof cityManagement.getUnitCap === "function")
      ? cityManagement.getUnitCap(city) : 12;
    const hostilePressure = (cityManagement && typeof cityManagement.getHostilePressure === "function")
      ? cityManagement.getHostilePressure(city) : { hostileCities: 0, hostileUnits: 0 };
    const pressureScore = (hostilePressure.hostileCities * 2) + hostilePressure.hostileUnits;
    const pressureLabel = pressureScore <= 0 ? "Quiet" : pressureScore <= 3 ? "Low" : pressureScore <= 7 ? "Elevated" : "High";
    const pressureTone = pressureScore <= 0 ? "#9be7ad" : pressureScore <= 3 ? "#d7e3f2" : pressureScore <= 7 ? "#ffcc80" : "#ef9a9a";
    const cityIdx = Array.isArray(window.cities) ? window.cities.indexOf(city) : -1;
    const questCount = Array.isArray(cityManagement?.demandQuests)
      ? cityManagement.demandQuests.filter((q) => q.cityIndex === cityIdx).length : 0;
    const directiveCount = (cityManagement && typeof cityManagement.getCityDirectives === "function")
      ? cityManagement.getCityDirectives(city).length
      : 0;
    const inventoryEntries = city.inventory
      ? [...city.inventory.entries()].filter(([, entry]) => entry && entry.quantity > 0).sort((a, b) => (b[1].quantity || 0) - (a[1].quantity || 0))
      : [];
    const visibleInventory = inventoryEntries.slice(0, 6);
    const hiddenInventoryCount = Math.max(0, inventoryEntries.length - visibleInventory.length);
    const totalStockQty = inventoryEntries.reduce((sum, [, entry]) => sum + Math.max(0, Number(entry.quantity) || 0), 0);
    const warTargetCount = (cityManagement && typeof cityManagement.getWarTargets === "function")
      ? cityManagement.getWarTargets(city).length : 0;
    const focus = (cityManagement && typeof cityManagement.getCityFocus === "function")
      ? cityManagement.getCityFocus(city)
      : { label: "Balanced Council", desc: "No city focus selected.", atlasFrame: "Chart", emoji: "⚖️" };
    const activeOps = (cityManagement && typeof cityManagement.getActiveCityOperations === "function")
      ? cityManagement.getActiveCityOperations(city)
      : [];
    const activeBonuses = (cityManagement && typeof cityManagement.getActiveCityBonuses === "function")
      ? cityManagement.getActiveCityBonuses(city)
      : [];
    const pressures = (cityManagement && typeof cityManagement.getCityPressures === "function")
      ? cityManagement.getCityPressures(city)
      : [];
    const opCap = (cityManagement && typeof cityManagement.getOperationCapacity === "function")
      ? cityManagement.getOperationCapacity(city)
      : 1;
    const threatReport = (cityManagement && typeof cityManagement.getCityThreatReport === "function")
      ? cityManagement.getCityThreatReport(city)
      : { hottestRoute: null, topRival: null };
    const districts = (cityManagement && typeof cityManagement.getCityDistricts === "function")
      ? cityManagement.getCityDistricts(city)
      : [];
    const developedDistricts = districts.filter((entry) => entry.currentTier > 0);
    const districtTierTotal = developedDistricts.reduce((sum, entry) => sum + entry.currentTier, 0);
    const districtSynergies = (cityManagement && typeof cityManagement.getCityDistrictSynergies === "function")
      ? cityManagement.getCityDistrictSynergies(city)
      : [];
    const dailyBrief = (cityManagement && typeof cityManagement.getCityDailyBrief === "function")
      ? cityManagement.getCityDailyBrief(city)
      : null;
    const cityFeed = (cityManagement && typeof cityManagement.getCityFeed === "function")
      ? cityManagement.getCityFeed(city, 8)
      : [];

    const features = [];
    if (city.hasBank) features.push(cityMgmtLabelHTML('Bank', 'Bank', 14, '🏦'));
    if (city.hasGamblingDen) features.push(cityMgmtLabelHTML('Dice', 'Gambling', 14, '🎲'));
    if (city.hasBountyBoard) features.push(cityMgmtLabelHTML('Chart', 'Bounty', 14, '📜'));
    if (city.hasWeaponShop) features.push(cityMgmtLabelHTML('Sword', 'Weapons', 14, '⚔️'));
    if (city.hasWinery) features.push(cityMgmtLabelHTML('Wine', 'Winery', 14, '🍷'));
    if (city.hasSchool) features.push(cityMgmtLabelHTML('Book', 'School', 14, '🏫'));
    if (city.hasBlackMarket) features.push(cityMgmtLabelHTML('StolenGoods', 'Black Market', 14, '🏴'));
    const upgrades = city.management?.upgradeLevels || {};
    for (const [key, value] of Object.entries(upgrades)) {
      if (value > 0) features.push(`${key} Lv${value}`);
    }

    const overviewGrid = createDiv().addClass("citymgmt-overview-grid").parent(wrap);
    const overviewColumns = createDiv().addClass("citymgmt-overview-columns").parent(overviewGrid);
    const overviewPrimaryCol = createDiv().addClass("citymgmt-overview-column").parent(overviewColumns);
    const overviewSecondaryCol = createDiv().addClass("citymgmt-overview-column").parent(overviewColumns);

    const addSummaryStat = (parent, label, value, detail = "", tone = "#d7e3f2") => {
      const card = createDiv().addClass("citymgmt-summary-stat").parent(parent);
      createDiv(label).addClass("citymgmt-summary-label").parent(card);
      createDiv(String(value)).addClass("citymgmt-summary-value").parent(card).style("color", tone);
      if (detail) createDiv(detail).addClass("citymgmt-summary-detail").parent(card);
      return card;
    };

    const addOverviewAction = (parent, label, tabKey) => {
      const btn = createButton(label).addClass("citymgmt-build-btn").parent(parent);
      btn.mousePressed(() => _switchCityMgmtTab(tabKey));
      return btn;
    };
    const formatSigned = (value, suffix = "") => {
      const n = Number(value) || 0;
      return `${n > 0 ? "+" : ""}${n}${suffix}`;
    };
    const feedToneByType = {
      success: "#9be7ad",
      warning: "#ffcc80",
      error: "#ef9a9a",
      achievement: "#ffd54f",
      info: "#d7e3f2",
    };

    const briefBox = createDiv().addClass("citymgmt-section").parent(overviewPrimaryCol);
    createElement("h3", "Daily Brief").parent(briefBox);
    createDiv((dailyBrief && dailyBrief.headline) ? dailyBrief.headline : "City reporting is still spinning up. Advance one day to get a clean brief.")
      .addClass("citymgmt-section-text")
      .parent(briefBox)
      .style("color",
        dailyBrief?.tone === "good" ? "#9be7ad"
          : dailyBrief?.tone === "warning" ? "#ffcc80"
          : "#d7e3f2");
    if (dailyBrief) {
      const briefGrid = createDiv().addClass("citymgmt-summary-grid citymgmt-summary-grid-dense").parent(briefBox);
      addSummaryStat(briefGrid, "Net Gold", `${formatSigned(dailyBrief.budgetDelta)}g`, dailyBrief.payoutDelta !== 0 ? `Payout ${formatSigned(dailyBrief.payoutDelta)}g` : "treasury delta", dailyBrief.budgetDelta >= 0 ? "#9be7ad" : "#ef9a9a");
      addSummaryStat(briefGrid, "Population", formatSigned(dailyBrief.populationDelta), dailyBrief.populationDelta !== 0 ? "population shifted" : "stable headcount", dailyBrief.populationDelta >= 0 ? "#d7e3f2" : "#ef9a9a");
      addSummaryStat(briefGrid, "Trade", `${dailyBrief.routeCompletedDelta} in / ${dailyBrief.routeLostDelta} lost`, dailyBrief.routeLostDelta > 0 ? "lane friction detected" : "lanes held", dailyBrief.routeLostDelta > 0 ? "#ffcc80" : "#80cbc4");
      addSummaryStat(briefGrid, "Garrison", dailyBrief.unitHpDelta < 0 ? `${Math.abs(dailyBrief.unitHpDelta)} HP lost` : "Held", dailyBrief.unitHpDelta < 0 ? "recent combat damage" : "no major losses", dailyBrief.unitHpDelta < 0 ? "#ef9a9a" : "#b6defa");
      addSummaryStat(briefGrid, "Development", dailyBrief.developmentDelta > 0 ? `+${dailyBrief.developmentDelta}` : "0", dailyBrief.developmentDelta > 0 ? "new build progress landed" : "no completed upgrades", dailyBrief.developmentDelta > 0 ? "#d6c6ff" : "#d7e3f2");
      if ((dailyBrief.alerts || []).length > 0) {
        const briefAlertWrap = createDiv().addClass("citymgmt-pill-wrap").parent(briefBox);
        for (const alert of dailyBrief.alerts.slice(0, 4)) {
          createDiv(`${alert.label} · ${alert.detail}`)
            .addClass("citymgmt-badge citymgmt-badge-subtle")
            .parent(briefAlertWrap)
            .style("border-color", alert.tone || "rgba(255,255,255,0.12)")
            .style("color", alert.tone || "#d7e3f2");
        }
        const topAlert = dailyBrief.alerts.find((alert) => alert.tabKey) || null;
        if (topAlert) {
          const briefActions = createDiv().addClass("citymgmt-button-row").parent(briefBox);
          createButton(`Open ${topAlert.tabKey[0].toUpperCase()}${topAlert.tabKey.slice(1)}`)
            .addClass("citymgmt-build-btn")
            .parent(briefActions)
            .mousePressed(() => _switchCityMgmtTab(topAlert.tabKey));
        }
      }
    }

    const recommendation = (() => {
      if (dailyBrief?.alerts?.length) return dailyBrief.alerts[0];
      const topPressure = pressures[0] || null;
      if (topPressure) {
        return {
          label: topPressure.label,
          detail: topPressure.detail,
          tone: topPressure.tone || "#d7e3f2",
          tabKey: topPressure.recommendedOperationKey ? "actions" : (topPressure.directiveKey === "open_market" ? "trade" : topPressure.directiveKey === "arm_the_watch" ? "units" : "actions"),
        };
      }
      if (threatReport?.hottestRoute) {
        return {
          label: "Stabilize Trade",
          detail: `${threatReport.hottestRoute.route?.destName || "Hot lane"} is ${threatReport.hottestRoute.threatLabel.toLowerCase()}.`,
          tone: threatReport.hottestRoute.threatTone || "#ffcc80",
          tabKey: "trade",
        };
      }
      if (threatReport?.topRival) {
        return {
          label: "Watch The Frontier",
          detail: `${threatReport.topRival.city?.name || "A rival"} is applying ${threatReport.topRival.threatLabel.toLowerCase()} pressure.`,
          tone: threatReport.topRival.threatTone || pressureTone,
          tabKey: "units",
        };
      }
      return {
        label: "Shape The City",
        detail: routeCount > 0 ? "Use Actions to push a focus or operation." : "Open Build or Trade to give the city a stronger identity.",
        tone: "#9be7ad",
        tabKey: routeCount > 0 ? "actions" : "build",
      };
    })();

    const recommendBox = createDiv().addClass("citymgmt-section").parent(overviewPrimaryCol);
    createElement("h3", "Do This Now").parent(recommendBox);
    createDiv(recommendation.label)
      .addClass("citymgmt-section-text")
      .parent(recommendBox)
      .style("color", recommendation.tone || "#d7e3f2")
      .style("font-weight", "700");
    createDiv(recommendation.detail)
      .addClass("citymgmt-inline-note")
      .parent(recommendBox);
    const recommendMeta = createDiv().addClass("citymgmt-summary-grid citymgmt-summary-grid-dense").parent(recommendBox);
    addSummaryStat(recommendMeta, "Focus", focus.label, activeOps.length > 0 ? `${activeOps.length}/${opCap} ops active` : "no active operations", "#b8d6ff");
    const recommendActions = createDiv().addClass("citymgmt-button-row").parent(recommendBox);
    createButton(`Open ${recommendation.tabKey[0].toUpperCase()}${recommendation.tabKey.slice(1)}`)
      .addClass("citymgmt-build-btn")
      .parent(recommendActions)
      .mousePressed(() => _switchCityMgmtTab(recommendation.tabKey));
    addOverviewAction(recommendActions, "Actions", "actions");
    addOverviewAction(recommendActions, "Trade", "trade");

    const feedBox = createDiv().addClass("citymgmt-section").parent(overviewSecondaryCol);
    createElement("h3", "Recent Feed").parent(feedBox);
    createDiv("Last few changes only. Use the other tabs for detail.")
      .addClass("citymgmt-section-text")
      .parent(feedBox);
    if (!cityFeed || cityFeed.length <= 0) {
      createDiv("No city reports yet. Start a route, adjust policy, or advance the day.")
        .addClass("citymgmt-empty-state citymgmt-empty-state-compact")
        .parent(feedBox);
    } else {
      const feedWrap = createDiv().parent(feedBox).style("display", "grid").style("gap", "8px");
      for (const entry of cityFeed.slice(0, 3)) {
        const row = createDiv().addClass("citymgmt-control-group").parent(feedWrap);
        const head = createDiv().addClass("citymgmt-control-head").parent(row);
        createDiv(`Day ${entry.day || 0}`).addClass("citymgmt-control-label").parent(head)
          .style("color", feedToneByType[entry.type] || "#d7e3f2");
        if (entry.category) {
          createDiv(entry.category[0].toUpperCase() + entry.category.slice(1))
            .addClass("citymgmt-inline-note")
            .parent(head)
            .style("color", "#8fa0b2");
        }
        createDiv(entry.message)
          .addClass("citymgmt-inline-note")
          .parent(row)
          .style("color", feedToneByType[entry.type] || "#d7e3f2");
      }
    }
  }

  // ─── Build ──────────────────────────────────────────────
  function _buildBuildTab(container, city) {
    const wrap = createDiv().addClass("citymgmt-tab-inner").parent(container);

    const districtBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "").parent(districtBox).html(cityMgmtLabelHTML('Friendly', 'District Development', 16, '🏙️'));
    createDiv("Permanent quarters turn the city into something specific. Districts stack lasting bonuses and define how this settlement actually plays.")
      .addClass("citymgmt-section-text")
      .parent(districtBox);
    const districts = (cityManagement && typeof cityManagement.getCityDistricts === "function")
      ? cityManagement.getCityDistricts(city)
      : [];
    for (const district of districts) {
      const row = createDiv().addClass("citymgmt-policy-row").parent(districtBox);
      const info = createDiv().parent(row).style("flex", "1");
      createDiv(`${cityMgmtIconHTML(district.atlasFrame || district.label, 14, district.emoji || "🏙️")} ${district.label} · Tier ${district.currentTier}/${district.tiers.length}`)
        .parent(info)
        .style("font-weight", "700")
        .style("color", district.currentTier > 0 ? "#d8e7ff" : "#c4d0dd");
      createDiv(district.desc)
        .parent(info)
        .style("font-size", "11px")
        .style("color", "#96a7b9");
      if (district.currentTierDef?.effects && Object.keys(district.currentTierDef.effects).length > 0) {
        const liveWrap = createDiv().parent(info)
          .style("display", "flex")
          .style("gap", "6px")
          .style("flex-wrap", "wrap")
          .style("margin-top", "6px");
        for (const [effectKey, value] of Object.entries(district.currentTierDef.effects)) {
          createDiv(`Live: ${_formatCityMgmtEffectText(effectKey, value)}`)
            .parent(liveWrap)
            .style("font-size", "10px")
            .style("padding", "2px 6px")
            .style("border-radius", "999px")
            .style("background", "rgba(76,175,80,0.16)")
            .style("color", "#9be7ad");
        }
      }
      const note = createDiv().addClass("citymgmt-inline-note").parent(info).style("margin-top", "6px");
      if (district.queueEntry) {
        const pct = Math.min(100, Math.floor(((district.queueEntry.progress || 0) / (district.queueEntry.buildTime || 60)) * 100));
        note.html(`Upgrading to tier ${district.currentTier + 1} · ${pct}% complete`);
      } else if (district.nextTierDef) {
        note.html(`Next: ${district.nextTierDef.label} · ${district.nextTierDef.cost}g · ${district.nextTierDef.time}s`);
      } else {
        note.html("All tiers complete.");
      }
      if (district.nextTierDef?.effects && Object.keys(district.nextTierDef.effects).length > 0) {
        const nextWrap = createDiv().parent(info)
          .style("display", "flex")
          .style("gap", "6px")
          .style("flex-wrap", "wrap")
          .style("margin-top", "4px");
        for (const [effectKey, value] of Object.entries(district.nextTierDef.effects)) {
          createDiv(`Next: ${_formatCityMgmtEffectText(effectKey, value)}`)
            .parent(nextWrap)
            .style("font-size", "10px")
            .style("padding", "2px 6px")
            .style("border-radius", "999px")
            .style("background", "rgba(255,255,255,0.06)")
            .style("color", "#d7e3f2");
        }
      }
      if (district.lockedReason && !district.queueEntry && district.nextTierDef) {
        createDiv(district.lockedReason)
          .addClass("citymgmt-inline-note")
          .parent(info)
          .style("margin-top", "4px")
          .style("color", "#ffb3b3");
      }
      const btnLabel = district.queueEntry ? "Queued" : (!district.nextTierDef ? "Maxed" : `Upgrade ${district.currentTier + 1}`);
      const btn = createButton(btnLabel).addClass("citymgmt-build-btn").parent(row).style("align-self", "center");
      if (!district.canUpgrade) {
        btn.attribute("disabled", "true");
        btn.style("opacity", "0.65");
      }
      btn.mousePressed(() => {
        if (!district.canUpgrade || !cityManagement || typeof cityManagement.queueDistrictProject !== "function") return;
        const res = cityManagement.queueDistrictProject(city, district.key);
        if (!res.ok) {
          _notifyCityMgmt(res.message || "Could not queue district upgrade.", "warning");
          return;
        }
        _notifyCityMgmt(`${district.label} upgrade queued.`, "success");
        _refreshCityMgmtPanel();
      });
    }

    // Available builds
    const optBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "").parent(optBox).html(cityMgmtLabelHTML('Tools', 'Project Board', 16, '🏗️'));
    createDiv("Districts lock in the city's long-term identity. Projects below are the practical service unlocks and repeatable upgrades you can fund from the treasury right now.")
      .addClass("citymgmt-section-text")
      .parent(optBox);

    const queue = city.management?.buildingQueue || [];
    const budget = Math.max(0, Math.floor(Number(city.management?.budget) || 0));
    const options = cityManagement.getBuildOptions(city);
    const affordableOptions = options.filter((opt) => budget >= opt.cost);
    const cheapestOption = options.reduce((best, opt) => {
      if (!best || opt.cost < best.cost) return opt;
      return best;
    }, null);
    const cheapestAffordable = affordableOptions.reduce((best, opt) => {
      if (!best || opt.cost < best.cost) return opt;
      return best;
    }, null);
    const queuedSpend = queue.reduce((sum, item) => sum + Math.max(0, Number(item?.cost) || 0), 0);

    const summary = createDiv().addClass("citymgmt-build-summary").parent(optBox);
    const addBuildSummaryCard = (label, value, note, tone = "neutral") => {
      const card = createDiv().addClass(`citymgmt-build-summary-card citymgmt-build-summary-card-${tone}`).parent(summary);
      createDiv(label).addClass("citymgmt-build-summary-label").parent(card);
      createDiv(value).addClass("citymgmt-build-summary-value").parent(card);
      createDiv(note).addClass("citymgmt-build-summary-note").parent(card);
    };
    addBuildSummaryCard(
      "Treasury Ready",
      `${budget}g`,
      queue.length > 0
        ? `${queue.length} queued project${queue.length === 1 ? "" : "s"} already consuming build slots.`
        : "No build backlog. New projects will start immediately.",
      "accent"
    );
    addBuildSummaryCard(
      "Affordable Now",
      `${affordableOptions.length}/${options.length}`,
      cheapestAffordable
        ? `${cheapestAffordable.label} is the cheapest live option at ${cheapestAffordable.cost}g.`
        : `Need ${Math.max(0, (cheapestOption?.cost || 0) - budget)}g more to unlock the next project.`,
      affordableOptions.length > 0 ? "positive" : "warning"
    );
    addBuildSummaryCard(
      "Queued Spend",
      `${queuedSpend}g`,
      "Districts are permanent identity plays. Projects are your quick operational upgrades.",
      queue.length > 0 ? "warning" : "neutral"
    );

    if (options.length === 0) {
      createDiv("All current projects are already unlocked.").addClass("citymgmt-empty-state citymgmt-empty-state-compact").parent(optBox);
    } else {
      const groupedOptions = new Map();
      for (const opt of options) {
        const groupKey = Object.prototype.hasOwnProperty.call(CITY_MGMT_BUILD_GROUP_META, opt.group) ? opt.group : "other";
        if (!groupedOptions.has(groupKey)) groupedOptions.set(groupKey, []);
        groupedOptions.get(groupKey).push(opt);
      }

      const orderedGroupKeys = [
        ...Object.keys(CITY_MGMT_BUILD_GROUP_META).filter((key) => groupedOptions.has(key)),
        ...Array.from(groupedOptions.keys()).filter((key) => !Object.prototype.hasOwnProperty.call(CITY_MGMT_BUILD_GROUP_META, key)),
      ];

      for (const groupKey of orderedGroupKeys) {
        const entries = groupedOptions.get(groupKey) || [];
        if (entries.length <= 0) continue;
        const meta = CITY_MGMT_BUILD_GROUP_META[groupKey] || CITY_MGMT_BUILD_GROUP_META.other;
        entries.sort((a, b) => {
          const aAffordable = budget >= a.cost ? 0 : 1;
          const bAffordable = budget >= b.cost ? 0 : 1;
          if (aAffordable !== bAffordable) return aAffordable - bAffordable;
          if (a.cost !== b.cost) return a.cost - b.cost;
          return String(a.label || "").localeCompare(String(b.label || ""));
        });

        const affordableInGroup = entries.filter((opt) => budget >= opt.cost).length;
        const groupBox = createDiv().addClass("citymgmt-build-group").parent(optBox);
        const groupHead = createDiv().addClass("citymgmt-build-group-head").parent(groupBox);
        const groupCopy = createDiv().addClass("citymgmt-build-group-copy").parent(groupHead);
        createDiv(meta.label).addClass("citymgmt-build-group-title").parent(groupCopy);
        createDiv(meta.note).addClass("citymgmt-build-group-note").parent(groupCopy);
        createDiv(`${affordableInGroup}/${entries.length} affordable`).addClass("citymgmt-build-group-count").parent(groupHead);

        const groupGrid = createDiv().addClass("citymgmt-build-group-grid").parent(groupBox);
        for (const opt of entries) {
          const canAfford = budget >= opt.cost;
          const budgetDelta = budget - opt.cost;
          const row = createDiv().addClass("citymgmt-build-row").parent(groupGrid);
          row.addClass(canAfford ? "citymgmt-build-row-affordable" : "citymgmt-build-row-locked");

          const main = createDiv().addClass("citymgmt-build-row-main").parent(row);
          const topLine = createDiv().addClass("citymgmt-build-topline").parent(main);
          createSpan("")
            .html(cityMgmtLabelHTML(opt.atlasFrame || opt.type || opt.label, opt.label, 14, opt.emoji || '•'))
            .addClass("citymgmt-build-name")
            .parent(topLine);
          createSpan(opt.repeatable ? "Repeatable" : "Unlock")
            .addClass("citymgmt-build-chip citymgmt-build-chip-neutral")
            .parent(topLine);
          if (canAfford) {
            createSpan("Affordable now")
              .addClass("citymgmt-build-chip citymgmt-build-chip-positive")
              .parent(topLine);
          }

          createDiv(opt.desc).addClass("citymgmt-build-desc").parent(main);

          const chipRow = createDiv().addClass("citymgmt-build-chip-row").parent(main);
          const addChip = (label, tone = "neutral") => {
            createSpan(label).addClass(`citymgmt-build-chip citymgmt-build-chip-${tone}`).parent(chipRow);
          };
          addChip(`${opt.cost}g`, "cost");
          addChip(`${opt.time}s`, "time");
          for (const highlight of opt.highlights || []) addChip(highlight, "neutral");

          const action = createDiv().addClass("citymgmt-build-action").parent(row);
          const btn = createButton(canAfford ? "Build" : "Unavailable").addClass("citymgmt-build-btn").parent(action);
          if (!canAfford) btn.attribute("disabled", "true");
          createDiv(canAfford ? `${budgetDelta}g left after build` : `${Math.abs(budgetDelta)}g short`)
            .addClass(`citymgmt-build-afford-note ${canAfford ? "citymgmt-build-afford-note-positive" : "citymgmt-build-afford-note-negative"}`)
            .parent(action);
          btn.mousePressed(() => {
            const res = cityManagement.enqueueBuild(city, opt.type, opt.cost, opt.time);
            if (!res.ok) {
              if (typeof notificationManager !== 'undefined') {
                notificationManager.log(res.reason === 'no_money' ? "Not enough city treasury gold." : "Can't build that.", "error");
              }
              return;
            }
            _refreshCityMgmtPanel();
          });
        }
      }
    }

    // Active queue
    const qBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "").parent(qBox).html(cityMgmtLabelHTML('Chart', 'Build Queue', 16, '📋'));
    if (queue.length === 0) {
      createP("No projects in progress.").parent(qBox).style("color", "#888");
    }
    const _typeLabels = {
      bank: 'Bank', gamblingDen: 'Gambling Den', bountyBoard: 'Bounty Board',
      weaponShop: 'Weapon Shop', winery: 'Winery', wineryExpansion: 'Winery Expansion', school: 'School',
      temple: 'Temple', farm: 'Farm', housing: 'Housing',
      warehouse: 'Warehouse', walls: 'Walls', removeBlackMarket: 'Remove Black Market',
    };
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      const pct = Math.min(100, Math.floor(((item.progress || 0) / (item.buildTime || 60)) * 100));
      const qRow = createDiv().addClass("citymgmt-queue-item").parent(qBox);
      let itemLabel = _typeLabels[item.type] || item.type;
      if (typeof item.type === "string" && item.type.startsWith("district:") && cityManagement && typeof cityManagement.getDistrictDefs === "function") {
        const key = item.type.slice("district:".length);
        const def = cityManagement.getDistrictDefs().find((entry) => entry.key === key);
        if (def) itemLabel = def.label;
      }
      createSpan(`${itemLabel} — ${pct}%`).addClass("citymgmt-q-label").parent(qRow);
      const track = createDiv().addClass("citymgmt-q-track").parent(qRow);
      createDiv().id(`citymgmt-qprog-${i}`).addClass("citymgmt-q-fill").parent(track)
        .style("width", pct + "%");
    }

    const growthBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "Population Capacity").parent(growthBox);
    const popCap = (typeof city.getPopulationCap === 'function') ? city.getPopulationCap() : city.population;
    const housingLv = Math.max(0, Number(city.management?.upgradeLevels?.housing) || 0);
    createDiv().html(
      `<div class="citymgmt-stat"><label>Population</label><span>${city.population} / ${popCap}</span></div>` +
      `<div class="citymgmt-stat"><label>Housing Level</label><span>${housingLv}</span></div>`
    ).parent(growthBox);
    createP("Build Housing in Available Projects to raise max population.")
      .parent(growthBox).style("font-size", "11px").style("color", "#888").style("margin-top", "4px");
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
        if (iconEl) { iconEl.classList.add("citymgmt-item-tag-icon"); pill.elt.appendChild(iconEl); }
      }
      const label = document.createElement("span");
      label.className = "citymgmt-item-tag-label";
      label.textContent = qtyText ? `${(ItemLibrary?.[itemKey]?.name || itemKey)} ${qtyText}` : (ItemLibrary?.[itemKey]?.name || itemKey);
      pill.elt.appendChild(label);
      return pill;
    };

    // ── Active routes ──
    const threatReport = (cityManagement && typeof cityManagement.getCityThreatReport === "function")
      ? cityManagement.getCityThreatReport(city)
      : { routeThreats: [], rivalThreats: [], hottestRoute: null };
    const routeSnapshots = threatReport.routeThreats || ((cityManagement && typeof cityManagement.getRouteSnapshots === "function")
      ? cityManagement.getRouteSnapshots(city)
      : []);
    const routes = city.management?.routes || [];
    if ((threatReport.hottestRoute || (threatReport.rivalThreats || []).length > 0) && routeSnapshots.length > 0) {
      const threatBox = createDiv().addClass("citymgmt-section").parent(wrap);
      createElement("h3", "Trade Threat Board").parent(threatBox);
      if (threatReport.hottestRoute) {
        createDiv(`Hottest lane: ${threatReport.hottestRoute.dest?.name || threatReport.hottestRoute.route?.destName || "Unknown"} · ${threatReport.hottestRoute.threatLabel} · score ${threatReport.hottestRoute.threatScore}`)
          .addClass("citymgmt-section-text")
          .parent(threatBox)
          .style("color", threatReport.hottestRoute.threatTone || "#ffcc80");
      }
      const threatGrid = createDiv().addClass("citymgmt-summary-grid citymgmt-summary-grid-dense").parent(threatBox);
      const topRivals = (threatReport.rivalThreats || []).slice(0, 3);
      if (topRivals.length <= 0) {
        createDiv("No rival cities are applying notable trade pressure right now.")
          .addClass("citymgmt-inline-note")
          .parent(threatBox);
      } else {
        for (const rival of topRivals) {
          const card = createDiv().addClass("citymgmt-summary-stat").parent(threatGrid);
          createDiv(rival.city?.name || "Rival").addClass("citymgmt-summary-label").parent(card);
          createDiv(rival.threatLabel).addClass("citymgmt-summary-value").parent(card).style("color", rival.threatTone || "#ffcc80");
          createDiv(`${rival.distance} tiles · ${rival.units} unit${rival.units === 1 ? "" : "s"}`).addClass("citymgmt-summary-detail").parent(card);
        }
      }
    }
    if (routeSnapshots.length > 0) {
      const routeBox = createDiv().addClass("citymgmt-section").parent(wrap);
      createElement("h3", `Routes (${routeSnapshots.length})`).parent(routeBox);
      for (let i = 0; i < routeSnapshots.length; i++) {
        const snap = routeSnapshots[i];
        const r = snap.route;
        const destCity = snap.dest || (window.cities?.find(c => c.name === r.destName));
        const row = createDiv().addClass("citymgmt-route-row citymgmt-trade-route-row").parent(routeBox);
        const goldPart = r.goldPerTransfer > 0 ? ` +${r.goldPerTransfer}g` : '';
        createSpan(`→ ${destCity ? destCity.name : r.destName || '???'}`).addClass("citymgmt-route-dest").parent(row);
        const infoCol = createDiv().addClass("citymgmt-route-info citymgmt-route-info-col").parent(row);
        createDiv(`Every ${r.frequencyDays}d${goldPart} · ${r.shipmentsCompleted || 0} arrived / ${r.shipmentsLost || 0} lost`).parent(infoCol);
        if (snap.threatLabel) {
          createDiv(`Threat: ${snap.threatLabel} · score ${snap.threatScore}`)
            .addClass("citymgmt-inline-note")
            .parent(infoCol)
            .style("color", snap.threatTone || "#ffcc80");
        }
        const itemsWrap = createDiv().addClass("citymgmt-route-items").parent(infoCol);
        if (r.itemsToSend && r.itemsToSend.length > 0) {
          for (const itemKey of r.itemsToSend) _appendItemVisual(itemsWrap, itemKey);
        } else {
          createSpan("All goods").addClass("citymgmt-route-all").parent(itemsWrap);
        }
        if (snap.activeShipment) {
          const convoyBox = createDiv().addClass("citymgmt-control-group").parent(infoCol);
          createDiv(`Convoy in transit · ${snap.activeShipment.remainingDays}d left · ${snap.activeShipment.incidentLabel}`)
            .addClass("citymgmt-inline-note")
            .parent(convoyBox)
            .style("color", snap.activeShipment.success ? "#9be7ad" : "#ffcc80");
          createDiv(`<div class="citymgmt-q-track"><div class="citymgmt-q-fill" style="width:${Math.round((snap.activeShipment.progress || 0) * 100)}%"></div></div>`)
            .parent(convoyBox);
          createDiv(`${snap.activeShipment.manifestLabel}${snap.activeShipment.detail ? ` · ${snap.activeShipment.detail}` : ""}`)
            .addClass("citymgmt-inline-note")
            .parent(convoyBox);
        } else if (snap.lastShipment) {
          createDiv(`${snap.lastShipment.incidentLabel} · ${snap.lastShipment.manifestLabel}${snap.lastShipment.goldNet > 0 ? ` · +${snap.lastShipment.goldNet}g` : ""}`)
            .addClass("citymgmt-inline-note")
            .parent(infoCol)
            .style("color", snap.lastShipment.success ? "#9be7ad" : "#ef9a9a");
        } else {
          createDiv(`Idle route${r.lastIncident ? ` · last issue: ${r.lastIncident}` : ""}`)
            .addClass("citymgmt-inline-note")
            .parent(infoCol);
        }
        const rmBtn = createButton("✕").addClass("citymgmt-route-rm").parent(row);
        rmBtn.mousePressed(() => {
          cityManagement.removeTradeRoute(city, i);
          if (typeof notificationManager !== 'undefined') notificationManager.log("Route removed.", "info");
          _refreshCityMgmtPanel();
        });
      }

      const logBox = createDiv().addClass("citymgmt-section").parent(wrap);
      createElement("h3", "Trade Ledger").parent(logBox);
      const ledger = [];
      for (const snap of routeSnapshots) {
        for (const entry of (snap.shipmentHistory || []).slice(0, 3)) {
          ledger.push({
            ...entry,
            destName: snap.dest?.name || snap.route?.destName || entry.destName,
          });
        }
      }
      ledger.sort((a, b) => (b.arrivalDay || 0) - (a.arrivalDay || 0));
      if (ledger.length <= 0) {
        createP("No convoy records yet. Routes will log arrivals and losses here.").parent(logBox).style("color", "#888");
      } else {
        for (const entry of ledger.slice(0, 6)) {
          createDiv(`Day ${entry.arrivalDay} · ${entry.destName} · ${entry.incidentLabel}${entry.goldNet > 0 ? ` · +${entry.goldNet}g` : ""}${entry.manifestLabel ? ` · ${entry.manifestLabel}` : ""}`)
            .addClass("citymgmt-inline-note")
            .parent(logBox)
            .style("color", entry.success ? "#9be7ad" : "#ef9a9a");
        }
      }
    }

    // ── New route ──
    const newBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "New Route").parent(newBox);

    if (!window.cities || window.cities.length < 2) {
      createP("Need other cities to trade with.").parent(newBox).style("color", "#888").style("font-size", "12px");
      return;
    }

    const myLoc = city.location;
    const cityEntries = [];
    for (let i = 0; i < window.cities.length; i++) {
      const c = window.cities[i];
      if (c === city) continue;
      const dx = c.location.x - myLoc.x, dy = c.location.y - myLoc.y;
      cityEntries.push({ city: c, index: i, dist: Math.round(Math.sqrt(dx * dx + dy * dy)) });
    }
    cityEntries.sort((a, b) => a.dist - b.dist);

    let selectedDestCity = null;
    const updateDestinationLabel = () => {
      if (selectedDestCity) {
        const dist = cityEntries.find((entry) => entry.city === selectedDestCity)?.dist ?? "?";
        destLabel.html(`<span style="color:#d4af37">${selectedDestCity.name}</span> <span style="color:#7f8da0">(${dist} tiles)</span>`);
      } else {
        destLabel.html("Select a destination from the route map below.");
      }
    };

    // Destination display
    const destRow = createDiv().addClass("citymgmt-row").parent(newBox).style("margin-bottom", "6px");
    createSpan("Destination").parent(destRow).style("font-size", "12px").style("color", "#96a7b9");
    const destLabel = createSpan("").parent(destRow)
      .style("font-size", "12px").style("color", "#96a7b9").style("flex", "1");
    updateDestinationLabel();

    // Settings row
    const settingsRow = createDiv().addClass("citymgmt-row").parent(newBox).style("margin-bottom", "6px");
    createSpan("Every").parent(settingsRow).style("font-size", "12px").style("color", "#96a7b9");
    const freqInput = createInput("7", "number").parent(settingsRow).addClass("citymgmt-input")
      .attribute("min", "1").attribute("max", "30").attribute("step", "1").style("width", "50px");
    createSpan("days").parent(settingsRow).style("font-size", "12px").style("color", "#96a7b9");
    createSpan("·").parent(settingsRow).style("color", "#555");
    createSpan("Gold").parent(settingsRow).style("font-size", "12px").style("color", "#96a7b9");
    const goldInput = createInput("0", "number").parent(settingsRow).addClass("citymgmt-input")
      .attribute("min", "0").attribute("max", "500").attribute("step", "10").style("width", "55px");

    // Export items
    const selectedItems = new Set();
    const inventoryKeys = [...city.inventory.keys()].filter(k => {
      const e = city.inventory.get(k); return e && e.quantity > 0;
    });
    if (inventoryKeys.length > 0) {
      createDiv("Export (tap to select, or leave blank for all)").parent(newBox)
        .style("font-size", "11px").style("color", "#96a7b9").style("margin", "2px 0 4px");
      const tagRow = createDiv().parent(newBox)
        .style("display", "flex").style("flex-wrap", "wrap").style("gap", "4px").style("margin-bottom", "6px");
      for (const key of inventoryKeys) {
        const entry = city.inventory.get(key);
        const tag = _appendItemVisual(tagRow, key, `×${entry.quantity}`, true);
        tag.mousePressed(() => {
          if (selectedItems.has(key)) { selectedItems.delete(key); tag.removeClass("selected"); }
          else { selectedItems.add(key); tag.addClass("selected"); }
        });
      }
    }

    const createBtn = createButton("Create Route").addClass("citymgmt-build-btn").parent(newBox);
    createBtn.mousePressed(() => {
      if (!selectedDestCity) {
        if (typeof notificationManager !== 'undefined') notificationManager.log("Select a destination on the map!", "error");
        return;
      }
      const res = cityManagement.createTradeRoute(city, selectedDestCity, {
        frequencyDays: Math.max(1, parseInt(freqInput.value()) || 7),
        goldPerTransfer: Math.max(0, parseInt(goldInput.value()) || 0),
        goodsPerTransfer: 5,
        itemsToSend: [...selectedItems],
      });
      if (!res.ok) {
        if (typeof notificationManager !== 'undefined')
          notificationManager.log(res.reason === 'duplicate' ? "Route already exists!" : "Failed.", "error");
        return;
      }
      selectedDestCity = null;
      _refreshCityMgmtPanel();
    });

    const tradeEntries = cityEntries.map((entry) => {
      const embargoed = (cityManagement?.diplomacy && typeof cityManagement.diplomacy.isEmbargoed === "function")
        ? cityManagement.diplomacy.isEmbargoed(entry.city.name)
        : (city.management?.diplomacy && typeof city.management.diplomacy.isEmbargoed === "function"
          ? city.management.diplomacy.isEmbargoed(entry.city.name)
          : false);
      const activeRoute = routeSnapshots.find((snap) => (snap.dest?.name || snap.route?.destName) === entry.city.name) || null;
      const rivalThreat = (threatReport.rivalThreats || []).find((snap) => snap.city === entry.city) || null;
      return {
        ...entry,
        isCurrent: false,
        embargoed,
        activeRoute,
        rivalThreat,
        threatTone: activeRoute?.threatTone || rivalThreat?.threatTone || null,
        threatLabel: activeRoute?.threatLabel || rivalThreat?.threatLabel || null,
      };
    });
    const allEntries = [{ city, dist: 0, isCurrent: true, embargoed: false }, ...tradeEntries];
    const mapHost = createDiv().addClass("citymgmt-inline-map-host").parent(newBox);
    _closeTradeMapOverlay = _mountCityMgmtInlineNodeMap(mapHost.elt, {
      title: "Trade Route Map",
      subtitle: "Choose a destination inside the panel. Drag to pan and scroll to zoom.",
      legendHTML: `
        <span class="legend-dot legend-dot-current"></span><span style="color:#ccc;font-size:11px">Your City</span>
        <span class="legend-dot legend-dot-city"></span><span style="color:#ccc;font-size:11px">Trade City</span>
      `,
      entries: allEntries,
      defaultSidebarTitle: "Select a City",
      defaultSidebarSubtitle: "Click a city node to set the route destination.",
      isInitiallySelected: (entry) => !!(selectedDestCity && entry.city === selectedDestCity),
      getEntryPosition: (entry) => ({ x: entry.city.location?.x || 0, y: entry.city.location?.y || 0 }),
      getEntryLabel: (entry) => entry.city?.name || "City",
      drawConnections: ({ ctx, scale, panX, panY }) => {
        const srcX = (city.location?.x || 0) * scale + panX;
        const srcY = (city.location?.y || 0) * scale + panY;
        for (const entry of tradeEntries) {
          ctx.beginPath();
          ctx.moveTo(srcX, srcY);
          ctx.lineTo((entry.city.location?.x || 0) * scale + panX, (entry.city.location?.y || 0) * scale + panY);
          if (entry.embargoed) {
            ctx.strokeStyle = "rgba(239,83,80,0.24)";
            ctx.lineWidth = 1.7;
          } else if (entry.activeRoute?.threatSeverity === "high") {
            ctx.strokeStyle = "rgba(239,83,80,0.32)";
            ctx.lineWidth = 2.4;
          } else if (entry.activeRoute?.threatSeverity === "medium") {
            ctx.strokeStyle = "rgba(255,183,77,0.28)";
            ctx.lineWidth = 2;
          } else if (entry.activeRoute) {
            ctx.strokeStyle = "rgba(212,175,55,0.18)";
            ctx.lineWidth = 1.4;
          } else {
            ctx.strokeStyle = "rgba(212,175,55,0.12)";
            ctx.lineWidth = 1;
          }
          ctx.stroke();
        }
      },
      getMarkerStyle: (entry, state) => {
        if (entry.isCurrent) {
          return {
            glow: "rgba(100,180,255,0.35)",
            fill: "#64b5f6",
            stroke: "#90caf9",
            labelColor: state.selected || state.hovered ? "#ffe066" : "#fff",
          };
        }
        if (entry.embargoed) {
          return {
            glow: "rgba(239,83,80,0.25)",
            fill: "#ef5350",
            stroke: "#ef9a9a",
            labelColor: state.selected || state.hovered ? "#ffe066" : "#fff",
          };
        }
        if (entry.activeRoute?.threatSeverity === "high") {
          return {
            glow: "rgba(239,83,80,0.28)",
            fill: "#ef5350",
            stroke: "#ffb3b3",
            labelColor: state.selected || state.hovered ? "#ffe066" : "#fff",
          };
        }
        if (entry.activeRoute?.threatSeverity === "medium") {
          return {
            glow: "rgba(255,183,77,0.25)",
            fill: "#ffb74d",
            stroke: "#ffe0b2",
            labelColor: state.selected || state.hovered ? "#ffe066" : "#fff",
          };
        }
        return {
          glow: "rgba(212,175,55,0.25)",
          fill: "#d4af37",
          stroke: "#f0d060",
          labelColor: state.selected || state.hovered ? "#ffe066" : "#fff",
        };
      },
      renderSidebar: ({ entry, sideTitle, sideSub, sideBody }) => {
        if (!entry || entry.isCurrent) return false;
        sideTitle.textContent = entry.city.name;
        sideSub.textContent = entry.embargoed ? "Embargoed" : (entry.activeRoute?.threatLabel || "Trade partner");

        const stats = document.createElement("div");
        stats.className = "travel-sidebar-stats";
        const pop = entry.city?.population || 0;
        const rep = entry.city?.reputation != null ? Math.round(entry.city.reputation) : "?";
        stats.innerHTML = `
          <div><span class="tss-label">Distance</span><span class="tss-value">${entry.dist} tiles</span></div>
          <div><span class="tss-label">Population</span><span class="tss-value">${pop}</span></div>
          <div><span class="tss-label">Reputation</span><span class="tss-value">${rep}</span></div>
          ${entry.activeRoute ? `<div><span class="tss-label">Lane Risk</span><span class="tss-value" style="color:${entry.activeRoute.threatTone || "#ffcc80"}">${entry.activeRoute.threatLabel} (${entry.activeRoute.threatScore})</span></div>` : ""}
          ${entry.embargoed ? '<div><span class="tss-label">Status</span><span class="tss-value" style="color:#ef5350">Embargoed</span></div>' : ""}
        `;
        sideBody.appendChild(stats);
        if (entry.activeRoute?.activeShipment || entry.activeRoute?.lastShipment) {
          const note = document.createElement("div");
          note.className = "citymgmt-inline-note";
          note.style.marginTop = "8px";
          note.style.color = entry.activeRoute.threatTone || "#ccc";
          const shipment = entry.activeRoute.activeShipment || entry.activeRoute.lastShipment;
          note.textContent = entry.activeRoute.activeShipment
            ? `In transit: ${shipment.incidentLabel} · ETA ${shipment.remainingDays}d`
            : `Last lane result: ${shipment.incidentLabel}`;
          sideBody.appendChild(note);
        }

        const goBtn = document.createElement("button");
        goBtn.className = `travel-map-go-btn${entry.embargoed ? " travel-map-go-btn-disabled" : ""}`;
        goBtn.textContent = entry.embargoed ? "Embargoed" : "Set Destination";
        if (!entry.embargoed) {
          goBtn.onclick = () => {
            selectedDestCity = entry.city;
            updateDestinationLabel();
          };
        }
        sideBody.appendChild(goBtn);
        return true;
      },
      onEntrySelect: (entry) => {
        if (!entry || entry.isCurrent) return;
        selectedDestCity = entry.city;
        updateDestinationLabel();
      },
    });
  }

  // ─── Quests ─────────────────────────────────────────────
  function _buildQuestsTab(container, city) {
    const wrap = createDiv().addClass("citymgmt-tab-inner").parent(container);
    const cityIdx = window.cities ? window.cities.indexOf(city) : -1;
    const directives = (cityManagement && typeof cityManagement.getCityDirectives === "function")
      ? cityManagement.getCityDirectives(city)
      : [];
    const directiveHistory = (cityManagement && typeof cityManagement.getCityDirectiveHistory === "function")
      ? cityManagement.getCityDirectiveHistory(city)
      : [];

    // Filter quests for this city
    const myQuests = (cityManagement.demandQuests || []).filter(q => q.cityIndex === cityIdx);
    // Other cities' quests
    const otherQuests = (cityManagement.demandQuests || []).filter(q => q.cityIndex !== cityIdx);

    const directiveBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", `City Directives (${directives.length})`).parent(directiveBox);
    if (directives.length === 0) {
      createP("No active directives. The city is stable for now.").parent(directiveBox).style("color", "#888");
    }
    for (const directive of directives) {
      const def = (typeof CityManagement !== "undefined" && CityManagement.DIRECTIVE_DEFS)
        ? CityManagement.DIRECTIVE_DEFS[directive.key]
        : null;
      const progress = directive.progress || { current: 0, target: 0, ratio: 0, text: "" };
      const card = createDiv().addClass("citymgmt-quest-card").parent(directiveBox);
      const title = createDiv().addClass("citymgmt-quest-title").parent(card);
      createSpan(cityMgmtLabelHTML(def?.atlasFrame || directive.label, directive.label, 14, def?.emoji || "✦")).parent(title);
      createDiv()
        .addClass("citymgmt-quest-detail")
        .html(`${directive.detail}`)
        .parent(card);
      createDiv()
        .addClass("citymgmt-quest-detail")
        .style("color", "#98a5b6")
        .html(`${progress.text || `${progress.current}/${progress.target}`} · Reward: ${directive.reward.gold}g${directive.reward.reputation > 0 ? ` · +${directive.reward.reputation} rep` : ""} · ${directive.remainingDays}d left`)
        .parent(card);
      createDiv(`<div class="citymgmt-q-track"><div class="citymgmt-q-fill" style="width:${Math.round((progress.ratio || 0) * 100)}%"></div></div>`)
        .parent(card);
      const actions = createDiv().addClass("citymgmt-button-row").parent(card);
      if (directive.recommendedOperationKey && typeof cityManagement.getAvailableOperations === "function") {
        const op = cityManagement.getAvailableOperations(city).find((entry) => entry.key === directive.recommendedOperationKey);
        if (op) {
          createButton(op.canStart ? `Start ${op.label}` : "Operations Room")
            .addClass("citymgmt-build-btn citymgmt-sm-btn")
            .parent(actions)
            .mousePressed(() => {
              if (op.canStart && typeof cityManagement.startCityOperation === "function") {
                const res = cityManagement.startCityOperation(city, op.key);
                if (!res.ok) {
                  _notifyCityMgmt(res.message || "Operation unavailable.", "warning");
                  return;
                }
                _notifyCityMgmt(`${op.label} is underway.`, "success");
                _refreshCityMgmtPanel();
                return;
              }
              _switchCityMgmtTab("actions");
            });
        }
      }
      const followTab = directive.key === "open_market" ? "trade"
        : directive.key === "showcase_contracts" ? "trade"
        : directive.key === "secure_convoys" ? "units"
        : directive.key === "guard_storehouses" ? "units"
        : directive.key === "arm_the_watch" ? "units"
        : directive.key === "stock_granaries" ? "build"
        : "actions";
      createButton("View Controls")
        .addClass("citymgmt-build-btn citymgmt-sm-btn")
        .parent(actions)
        .mousePressed(() => _switchCityMgmtTab(followTab));
    }
    if (directiveHistory.length > 0) {
      const historyBox = createDiv().addClass("citymgmt-control-group").parent(directiveBox);
      createDiv("Recent Directives").addClass("citymgmt-control-label").parent(historyBox);
      for (const entry of directiveHistory.slice(0, 4)) {
        createDiv(`Day ${entry.deadlineDay} · ${entry.label}${entry.summary ? ` · ${entry.summary}` : ""}`)
          .addClass("citymgmt-inline-note")
          .parent(historyBox);
      }
    }

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
      const needed = Math.max(0, q.qtyNeeded - q.qtyDelivered);
      const cityQty = city.inventory.get(q.itemName)?.quantity || 0;
      const playerQty = (typeof player !== 'undefined' && player && player.inventory)
        ? (player.inventory.get(q.itemName)?.quantity || 0)
        : 0;

      const title = createDiv().addClass("citymgmt-quest-title").parent(card);
      if (typeof createItemIconEl === 'function') {
        const iconEl = createItemIconEl(q.itemName, 18);
        if (iconEl) {
          iconEl.classList.add("citymgmt-quest-item-icon");
          title.elt.appendChild(iconEl);
        }
      }
      createSpan(`${ItemLibrary?.[q.itemName]?.name || q.itemName} ×${q.qtyNeeded}`).parent(title);

      createDiv()
        .addClass("citymgmt-quest-detail")
        .html(`Progress: ${progress} · Reward: ${q.reward}g · ${daysLeft}d left`)
        .parent(card);
      createDiv()
        .addClass("citymgmt-quest-detail")
        .style("color", "#98a5b6")
        .html(`Available: City ${cityQty} · You ${playerQty} · Needed ${needed}`)
        .parent(card);

      const canDeliver = needed > 0 && (cityQty + playerQty) > 0;
      const fulfillBtn = createButton(canDeliver ? "Deliver Materials" : (needed <= 0 ? "Complete" : "No Materials"))
        .addClass("citymgmt-build-btn").parent(card);
      if (!canDeliver) {
        fulfillBtn.attribute("disabled", "true");
        fulfillBtn.style("opacity", "0.55");
        fulfillBtn.style("cursor", "not-allowed");
      }
      fulfillBtn.mousePressed(() => {
        if (!canDeliver) return;
        const res = cityManagement.deliverDemandQuest(city, q, { useCity: true, usePlayer: true });
        if (!res?.ok && typeof notificationManager !== 'undefined') {
          const msg = res?.reason === 'no_stock' ? "No matching materials available."
            : res?.reason === 'already_complete' ? "Quest already complete."
            : "Could not deliver materials.";
          notificationManager.log(msg, "warning");
        }
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
        const otherCard = createDiv().addClass("citymgmt-quest-card citymgmt-quest-other").parent(otherBox);
        const otherTitle = createDiv().addClass("citymgmt-quest-title").parent(otherCard);
        if (typeof createItemIconEl === 'function') {
          const iconEl = createItemIconEl(q.itemName, 16);
          if (iconEl) {
            iconEl.classList.add("citymgmt-quest-item-icon");
            otherTitle.elt.appendChild(iconEl);
          }
        }
        createSpan(`${q.cityName}: ${ItemLibrary?.[q.itemName]?.name || q.itemName} ×${q.qtyNeeded}`).parent(otherTitle);
        createDiv().addClass("citymgmt-quest-detail").parent(otherCard)
          .html(`${q.qtyDelivered}/${q.qtyNeeded} · ${q.reward}g · ${daysLeft}d left`);
      }
    }
  }

  // ─── Actions ────────────────────────────────────────────
  function _buildUnitsTab(container, city) {
    const wrap = createDiv().addClass("citymgmt-tab-inner").parent(container);

    // ── Metrics ──
    const units = _getCityMgmtUnitsSnapshot(city);
    const unitCap = (cityManagement && typeof cityManagement.getUnitCap === 'function')
      ? cityManagement.getUnitCap(city) : 12;
    const readyUnits = (cityManagement && typeof cityManagement.getReadyUnitCount === 'function')
      ? cityManagement.getReadyUnitCount(city) : units.length;
    const nearbyRaiders = (typeof raiderManager !== 'undefined' && raiderManager && typeof raiderManager.getRaidersInRect === 'function')
      ? raiderManager.getRaidersInRect(city.location.x - 8, city.location.x + 8, city.location.y - 8, city.location.y + 8).length : 0;
    const hostilePressure = (cityManagement && typeof cityManagement.getHostilePressure === 'function')
      ? cityManagement.getHostilePressure(city) : { hostileCities: 0, hostileUnits: 0 };
    const pressureScore = (hostilePressure.hostileCities * 2) + hostilePressure.hostileUnits;
    const pressureLabel = pressureScore <= 0 ? "Clear" : pressureScore <= 3 ? "Low" : pressureScore <= 7 ? "Moderate" : "High";
    const pressureTone = pressureScore <= 0 ? "#9be7ad" : pressureScore <= 3 ? "#cfd8dc" : pressureScore <= 7 ? "#ffcc80" : "#ef9a9a";

    const metricGrid = createDiv().addClass("citymgmt-metrics").parent(wrap);
    const addMetric = (label, value, tone = "#cfd8dc", detail = "") => {
      const card = createDiv().addClass("citymgmt-metric").parent(metricGrid);
      createDiv(label).addClass("citymgmt-metric-label").parent(card);
      createDiv(String(value)).addClass("citymgmt-metric-value").parent(card).style("color", tone);
      if (detail) createDiv(detail).addClass("citymgmt-metric-detail").parent(card);
    };
    addMetric("Capacity", `${units.length}/${unitCap}`, units.length >= unitCap ? "#ef9a9a" : "#d7e3f2");
    addMetric("Ready", readyUnits, readyUnits > 0 ? "#9be7ad" : "#cfd8dc");
    addMetric("Raiders", nearbyRaiders, nearbyRaiders > 0 ? "#ffcc80" : "#b0bec5");
    addMetric("Threat", pressureLabel, pressureTone,
      `${hostilePressure.hostileCities} rival · ${hostilePressure.hostileUnits} hostile`);

    // ── Train ──
    const templates = (cityManagement && typeof cityManagement.getUnitTemplates === 'function')
      ? cityManagement.getUnitTemplates() : [{ key: 'militia', label: 'Militia', emoji: '🛡️', atlasFrame: 'Shield' }];
    const templateByKey = new Map(templates.map((t) => [t.key, t]));

    const trainBox = createDiv().addClass("citymgmt-train-box").parent(wrap);
    createDiv("").html(cityMgmtLabelHTML('Shield', 'Train New Unit', 16, '🛡️')).addClass("citymgmt-train-title").parent(trainBox);
    const spawnRow = createDiv().addClass("citymgmt-row").parent(trainBox);
    const nameInput = createInput("", "text").parent(spawnRow).addClass("citymgmt-input")
      .attribute("placeholder", "Name");
    const classSelect = createSelect().parent(spawnRow).addClass("citymgmt-input").style("min-width", "150px");
    for (const t of templates) classSelect.option(t.label, t.key);
    const tplInfo = createP("").parent(trainBox).style("font-size", "11px").style("color", "#c5d2df").style("margin", "4px 0 0");

    const unitCost = (cityManagement && typeof cityManagement.getUnitTrainCost === 'function')
      ? cityManagement.getUnitTrainCost(city, classSelect.value()) : 140;
    const spawnBtn = createButton(`Train (${unitCost}g)`).addClass("citymgmt-build-btn").parent(spawnRow);
    const _syncTemplateInfo = () => {
      const sel = templates.find((t) => t.key === classSelect.value()) || templates[0];
      const badge = sel.movementType === 'naval' ? 'Naval' : 'Land';
      const coastal = sel.coastalOnly ? ' · Coastal' : '';
      const portReq = sel.portOnly ? ' · Port req.' : '';
      tplInfo.html(`${cityMgmtIconHTML(sel.atlasFrame || sel.key || sel.label, 14, sel.emoji || '•')} ${sel.label}: ${sel.desc || ''} · ${badge}${coastal}${portReq}`);
    };
    _syncTemplateInfo();
    classSelect.changed(() => {
      const c = (cityManagement && typeof cityManagement.getUnitTrainCost === 'function')
        ? cityManagement.getUnitTrainCost(city, classSelect.value()) : 140;
      spawnBtn.html(`Train (${c}g)`);
      _syncTemplateInfo();
    });
    spawnBtn.mousePressed(() => {
      if (!cityManagement || typeof cityManagement.spawnUnit !== 'function') return;
      const selectedClass = classSelect.value();
      const dynamicCost = (typeof cityManagement.getUnitTrainCost === 'function')
        ? cityManagement.getUnitTrainCost(city, selectedClass) : unitCost;
      const res = cityManagement.spawnUnit(city, nameInput.value(), selectedClass);
      if (!res.ok) {
        const msg = res.reason === 'no_money' ? `Need ${dynamicCost}g.`
          : res.reason === 'unit_cap' ? `Cap reached (${unitCap}).`
          : res.reason === 'non_port' ? "Needs a port."
          : res.reason === 'non_coastal' ? "Needs coastal city."
          : "Can't train.";
        _notifyCityMgmt(msg, "error");
        return;
      }
      nameInput.value("");
      _refreshCityMgmtPanel();
    });

    // ── Roster ──
    const rosterSection = createDiv().addClass("citymgmt-section").parent(wrap);
    const rosterHead = createDiv().addClass("citymgmt-roster-head").parent(rosterSection);
    createDiv("Roster").addClass("citymgmt-roster-title").parent(rosterHead);
    const sortRow = createDiv().addClass("citymgmt-row").parent(rosterHead).style("gap", "6px");
    const sortSelect = createSelect().parent(sortRow).addClass("citymgmt-input");
    sortSelect.option("Level", "level");
    sortSelect.option("Health", "hp");
    sortSelect.option("Name", "name");
    sortSelect.value(window._cityUnitSortMode || "level");
    sortSelect.changed(() => {
      window._cityUnitSortMode = sortSelect.value() || "level";
      _refreshCityMgmtPanel();
    });

    const rosterWrap = createDiv().addClass("citymgmt-roster").parent(rosterSection);

    if (units.length === 0) {
      createP("No units trained yet.").parent(rosterWrap).style("color", "#888").style("margin", "4px 0");
    } else {
      const sortedUnits = units.slice();
      const mode = window._cityUnitSortMode || "level";
      if (mode === "hp") sortedUnits.sort((a, b) => (b.hp / Math.max(1, b.maxHp)) - (a.hp / Math.max(1, a.maxHp)));
      else if (mode === "name") sortedUnits.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      else sortedUnits.sort((a, b) => (b.level || 1) - (a.level || 1));

      const selected = cityManagement?.getSelectedUnit ? cityManagement.getSelectedUnit() : null;
      for (const unit of sortedUnits) {
        const isSelected = !!(selected && selected.id === unit.id);
        const tpl = templateByKey.get(unit.classKey) || null;
        const card = createDiv().addClass(`citymgmt-unit-card${isSelected ? " selected" : ""}`).parent(rosterWrap);

        const topRow = createDiv().addClass("citymgmt-unit-top").parent(card);
        const avatarWrap = createDiv().addClass("citymgmt-unit-avatar").parent(topRow);
        const portrait = unit.portrait || tpl?.portrait || tpl?.image || tpl?.icon || "";
        if (typeof portrait === "string" && portrait && /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(portrait)) {
          const img = document.createElement("img");
          img.src = portrait;
          img.alt = tpl?.label || "Unit";
          avatarWrap.elt.appendChild(img);
        } else {
          const avatarIcon = (typeof createAtlasIconEl === "function")
            ? createAtlasIconEl(tpl?.atlasFrame || tpl?.key || tpl?.label, 18, tpl?.emoji || "🛡️")
            : null;
          if (avatarIcon) avatarWrap.elt.appendChild(avatarIcon);
          else createSpan(tpl?.emoji || "🛡️").parent(avatarWrap);
        }
        const nameCol = createDiv().parent(topRow).style("flex", "1");
        const selectedMark = isSelected ? `${cityMgmtIconHTML('Love', 12, '⭐')} ` : "";
        createDiv(`${selectedMark}${unit.name}`).addClass("citymgmt-unit-name").parent(nameCol);
        createDiv(tpl?.label || unit.classKey || "unit").addClass("citymgmt-unit-class").parent(nameCol);

        const hpRatio = Math.max(0, Math.min(1, (unit.hp || 0) / Math.max(1, unit.maxHp || 1)));
        const hpTrack = createDiv().addClass("citymgmt-unit-hp").parent(card);
        createDiv("").addClass("citymgmt-unit-hp-fill").parent(hpTrack)
          .style("width", `${Math.round(hpRatio * 100)}%`)
          .style("background", hpRatio > 0.6 ? "#8bc34a" : hpRatio > 0.3 ? "#ffb74d" : "#ef9a9a");

        const toNext = 20 + ((Math.max(1, unit.level || 1) - 1) * 16);
        const tgt = unit.target ? ` → ${unit.target.x},${unit.target.y}` : "";
        const minRange = Math.max(1, Math.floor(Number(unit.attackRangeMin) || 1));
        const maxRange = Math.max(minRange, Math.floor(Number(unit.attackRangeMax) || minRange));
        const rangeText = maxRange > 1 ? ` · R ${minRange}-${maxRange}` : "";
        createDiv(`Lv${unit.level || 1} · HP ${unit.hp}/${unit.maxHp} · XP ${unit.xp || 0}/${toNext} · K${unit.kills || 0}${rangeText} · ${unit.state}${tgt}`)
          .addClass("citymgmt-unit-stats").parent(card);

        const selBtn = createButton(isSelected ? "Selected" : "Select").addClass("citymgmt-build-btn citymgmt-sm-btn").parent(card);
        if (isSelected) selBtn.attribute("disabled", "true");
        selBtn.mousePressed(() => {
          cityManagement.selectUnitById(city, unit.id);
          _refreshCityMgmtPanel();
        });
      }
    }

    const disbandRow = createDiv().addClass("citymgmt-row").parent(rosterSection).style("margin-top", "6px").style("justify-content", "flex-end");
    const disbandBtn = createButton("Disband Selected").addClass("citymgmt-build-btn citymgmt-danger-btn").parent(disbandRow);
    disbandBtn.mousePressed(() => {
      const res = cityManagement.disbandSelectedUnit(city);
      if (!res.ok) { _notifyCityMgmt("No unit selected.", "warning"); return; }
      _refreshCityMgmtPanel();
    });

    const warBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "War Room").parent(warBox);

    const _getWarPreviewForTarget = (target) => (
      cityManagement && typeof cityManagement.getInvasionPreview === 'function'
        ? cityManagement.getInvasionPreview(city, target)
        : null
    );

    const _getWarScenarioTone = (preview) => {
      const chancePct = Math.round((preview?.winChance || 0) * 100);
      if (chancePct >= 68) return { label: 'Favorable', tone: 'favorable' };
      if (chancePct >= 48) return { label: 'Contested', tone: 'contested' };
      return { label: 'Hard Push', tone: 'hard' };
    };

    const _formatDoctrineSummary = (tags, fallback = 'No doctrine edge') => (
      Array.isArray(tags) && tags.length > 0 ? tags.slice(0, 2).join(' · ') : fallback
    );

    const _formatCardPreview = (cards, fallback = 'No standout cards') => {
      const lines = (Array.isArray(cards) ? cards : [])
        .slice(0, 2)
        .map((entry) => `${entry.title} x${entry.count}`);
      return lines.length > 0 ? lines.join(', ') : fallback;
    };

    const runInvasionGridQTE = (preview, target, onDone, opts = {}) => {
      const isDrill = opts?.mode === 'drill';
      const qteAssistScore = (typeof player !== 'undefined' && player?.modifiers?.qteAssist)
        ? Math.max(0, Math.min(100, Number(player.modifiers.qteRaidScore) || 78))
        : null;
      if (qteAssistScore != null) {
        const autoResult = {
          grade: qteAssistScore >= 85 ? 'A' : qteAssistScore >= 70 ? 'B' : 'C',
          score: qteAssistScore,
          tacticalMomentum: qteAssistScore >= 75 ? 0.12 : 0.04,
          playerBattleWon: (preview?.winChance || 0) >= 0.45,
          cardsPlayed: 1,
          enemyCardsPlayed: 1,
          timedOut: false,
        };
        if (typeof onDone === 'function') onDone(autoResult);
        _notifyCityMgmt(`${isDrill ? 'War drill' : 'War council'} auto-resolved by Tactical Autopilot (${qteAssistScore}).`, 'info');
        return;
      }
      const warBattle = (typeof CityWarBattle !== 'undefined' && CityWarBattle && typeof CityWarBattle.createBattle === 'function')
        ? CityWarBattle
        : (window?.CityWarBattle || null);
      if (!warBattle) {
        _notifyCityMgmt("War battle system unavailable.", "error");
        return;
      }

      document.getElementById('invasionQTEOverlay')?.remove();
      const battle = warBattle.createBattle({
        preview,
        sourceCity: city,
        targetCity: target,
        day: (typeof dayNight !== 'undefined' && typeof dayNight.getDaysElapsed === 'function') ? dayNight.getDaysElapsed() : 0,
      });

      let closed = false;
      let enemyTimer = null;
      let resultShown = false;
      let finalResult = null;
      let completionSent = false;
      const targetName = target?.name || 'Target City';

      const PIECE_ICONS = {
        rook: { player: '♖', enemy: '♜' },
        bishop: { player: '♗', enemy: '♝' },
        knight: { player: '♘', enemy: '♞' },
        ranger: { player: '🏹', enemy: '🏹' },
      };

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
      title.textContent = isDrill ? 'War Drill' : 'War Council';
      head.appendChild(title);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'invasion-qte-close';
      closeBtn.textContent = '✕';
      closeBtn.setAttribute('aria-label', 'Close invasion battle');
      head.appendChild(closeBtn);

      const route = document.createElement('div');
      route.className = 'invasion-qte-route';
      route.textContent = `${city.name} -> ${targetName} · ${preview?.distance || '?'} tiles${isDrill ? ' · no gold, no march' : ''}`;
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
      modal.appendChild(stats);

      const qteStatus = document.createElement('div');
      qteStatus.className = 'invasion-qte-status';
      qteStatus.textContent = `${isDrill ? 'Drill' : 'Player'} turn: play one card or command a unit.`;
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

      const briefWrap = document.createElement('div');
      briefWrap.className = 'invasion-qte-brief';
      briefWrap.innerHTML = `
        <div class="invasion-qte-brief-title">${isDrill ? 'Demo Flow' : 'Battle Flow'}</div>
        <div class="invasion-qte-brief-steps">
          <span class="invasion-qte-brief-chip">1. Play 1 card</span>
          <span class="invasion-qte-brief-chip">2. Move or attack</span>
          <span class="invasion-qte-brief-chip">3. End turn</span>
        </div>
        <div class="invasion-qte-brief-legend">
          <span><i class="invasion-qte-brief-swatch move"></i>Green tiles = move</span>
          <span><i class="invasion-qte-brief-swatch attack"></i>Red tiles = attack</span>
          <span><i class="invasion-qte-brief-swatch range"></i>Rangers fire 2-4 tiles</span>
        </div>
      `;
      modal.appendChild(briefWrap);

      const planWrap = document.createElement('div');
      planWrap.className = 'invasion-qte-plan';
      modal.appendChild(planWrap);

      const effectsWrap = document.createElement('div');
      effectsWrap.className = 'invasion-qte-effects';
      modal.appendChild(effectsWrap);

      const cardsWrap = document.createElement('div');
      cardsWrap.className = 'invasion-qte-card-hand';
      modal.appendChild(cardsWrap);

      const gridWrap = document.createElement('div');
      gridWrap.className = 'invasion-qte-grid tactical-grid';
      modal.appendChild(gridWrap);

      const logWrap = document.createElement('div');
      logWrap.className = 'invasion-qte-log';
      modal.appendChild(logWrap);

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
      cancelBtn.textContent = isDrill ? 'Abort Drill' : 'Cancel';
      actions.appendChild(cancelBtn);

      document.body.appendChild(overlay);
      window._invasionQTEActive = true;

      const finishAndReport = () => {
        if (completionSent || !finalResult) return;
        completionSent = true;
        if (typeof onDone === 'function') onDone(finalResult);
      };

      const closeOverlay = (deliverResult = false) => {
        closed = true;
        if (enemyTimer) clearTimeout(enemyTimer);
        enemyTimer = null;
        window._invasionQTEActive = false;
        overlay.remove();
        if (deliverResult) finishAndReport();
      };

      const finishBattle = () => {
        if (resultShown) return;
        resultShown = true;
        const result = battle.getResult() || battle.finishBattle();
        finalResult = result;
        const outcome = result.playerBattleWon
          ? (isDrill ? 'Drill result: attacker keeps the edge.' : 'Battle plan favors the attacker.')
          : (isDrill ? 'Drill result: defense keeps the edge.' : 'Defense keeps the advantage.');
        qteStatus.textContent = `${outcome} ${result.grade} rank (${result.score}).`;
        qteTimer.textContent = `Cards ${result.cardsPlayed} vs ${result.enemyCardsPlayed} · Momentum ${Math.round((result.tacticalMomentum || 0) * 100)}%`;
        primaryBtn.disabled = false;
        primaryBtn.textContent = isDrill ? `Close Drill (${result.grade})` : `Deploy Army (${result.grade})`;
        primaryBtn.onclick = () => {
          closeOverlay(true);
        };
        endTurnBtn.disabled = true;
        cancelBtn.disabled = true;
        renderBattle();
      };

      const renderEffects = () => {
        effectsWrap.innerHTML = '';
        const buildRow = (label, side) => {
          const row = document.createElement('div');
          row.className = 'invasion-qte-effect-row';
          const titleEl = document.createElement('div');
          titleEl.className = 'invasion-qte-effect-title';
          titleEl.textContent = label;
          row.appendChild(titleEl);
          const entries = battle.getActiveEffects(side);
          if (entries.length === 0) {
            const empty = document.createElement('span');
            empty.className = 'invasion-qte-effect-chip muted';
            empty.textContent = 'No active effects';
            row.appendChild(empty);
          } else {
            for (const entry of entries) {
              const chip = document.createElement('span');
              chip.className = 'invasion-qte-effect-chip';
              chip.textContent = entry.title;
              row.appendChild(chip);
            }
          }
          return row;
        };
        effectsWrap.appendChild(buildRow('Your Effects', 'player'));
        effectsWrap.appendChild(buildRow('Enemy Effects', 'enemy'));
      };

      const renderPlanSummary = () => {
        planWrap.innerHTML = '';
        const plan = battle.getPlanSummary ? battle.getPlanSummary() : null;
        if (!plan) return;

        const buildColumn = (titleText, doctrineList, cardList) => {
          const col = document.createElement('div');
          col.className = 'invasion-qte-plan-col';

          const titleEl = document.createElement('div');
          titleEl.className = 'invasion-qte-plan-title';
          titleEl.textContent = titleText;
          col.appendChild(titleEl);

          const doctrineRow = document.createElement('div');
          doctrineRow.className = 'invasion-qte-plan-tags';
          if (Array.isArray(doctrineList) && doctrineList.length > 0) {
            for (const tag of doctrineList) {
              const chip = document.createElement('span');
              chip.className = 'invasion-qte-plan-chip';
              chip.textContent = tag;
              doctrineRow.appendChild(chip);
            }
          } else {
            const chip = document.createElement('span');
            chip.className = 'invasion-qte-plan-chip muted';
            chip.textContent = 'No doctrine bonuses';
            doctrineRow.appendChild(chip);
          }
          col.appendChild(doctrineRow);

          const cardRow = document.createElement('div');
          cardRow.className = 'invasion-qte-plan-cards';
          for (const entry of (cardList || []).slice(0, 4)) {
            const line = document.createElement('div');
            line.className = 'invasion-qte-plan-card';
            line.textContent = `${entry.title} x${entry.count}`;
            cardRow.appendChild(line);
          }
          col.appendChild(cardRow);
          return col;
        };

        planWrap.appendChild(buildColumn('Attacker Doctrine', plan.attackerDoctrines, plan.attackerCards));
        planWrap.appendChild(buildColumn('Defender Doctrine', plan.defenderDoctrines, plan.defenderCards));
      };

      const renderCards = () => {
        cardsWrap.innerHTML = '';
        const hand = battle.getHand('player');
        if (hand.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'invasion-qte-card empty';
          empty.textContent = 'No cards in hand.';
          cardsWrap.appendChild(empty);
          return;
        }
        for (const card of hand) {
          const btn = document.createElement('button');
          btn.className = 'invasion-qte-card';
          btn.disabled = closed || battle.turn !== 'player' || battle.finished || battle.sides?.player?.playedCardThisTurn;
          btn.innerHTML = `<strong>${card.title}</strong><span>${card.desc}</span>`;
          btn.addEventListener('click', () => {
            if (btn.disabled) return;
            const result = battle.playCard('player', card.instanceId);
            qteStatus.textContent = result.message || 'Card played.';
            renderBattle();
            if (battle.finished) finishBattle();
          });
          cardsWrap.appendChild(btn);
        }
      };

      const renderLog = () => {
        logWrap.innerHTML = '';
        for (const entry of battle.getLog(6)) {
          const item = document.createElement('div');
          item.className = 'invasion-qte-log-entry';
          item.textContent = entry;
          logWrap.appendChild(item);
        }
      };

      const renderBattle = () => {
        const live = battle.getLiveSummary();
        stats.innerHTML = `
          <span>${isDrill ? 'Drill Run' : 'Live Campaign'}</span>
          <span>Win: ${Math.round((preview?.winChance || 0) * 100)}%</span>
          <span>Cost: ${preview?.warCost || 0}g</span>
          <span>Atk ${Math.round(preview?.attackPower || 0)} vs Def ${Math.round(preview?.defensePower || 0)}</span>
          <span>Momentum: ${Math.round(live.momentum || 0)}%</span>
          <span>Cards: ${battle.getHand('player').length}</span>
        `;

        const selected = battle.getSelected();
        const moveTargets = selected ? battle.moveTargetsFor(selected) : [];
        const attackTargets = selected ? battle.attackTargetsFor(selected) : [];
        const moveSet = new Set(moveTargets.map((m) => `${m.x},${m.y}`));
        const attackSet = new Set(attackTargets.map((a) => `${a.x},${a.y}`));
        const turnPct = Math.max(0, Math.min(100, Math.round(((battle.maxTurns - battle.turnNumber + 1) / battle.maxTurns) * 100)));
        timerBar.style.width = `${turnPct}%`;
        qteTimer.textContent = resultShown && finalResult
          ? `Cards ${finalResult.cardsPlayed} vs ${finalResult.enemyCardsPlayed} · Momentum ${Math.round((finalResult.tacticalMomentum || 0) * 100)}%`
          : `Turn ${battle.turnNumber}/${battle.maxTurns} · Your units ${live.playerUnits} · Enemy units ${live.enemyUnits}`;

        endTurnBtn.disabled = closed || battle.finished || battle.turn !== 'player';
        cancelBtn.disabled = closed || resultShown;
        renderPlanSummary();
        renderEffects();
        renderCards();
        renderLog();

        gridWrap.innerHTML = '';
        for (let y = 0; y < battle.gridSize; y++) {
          for (let x = 0; x < battle.gridSize; x++) {
            const cell = document.createElement('button');
            cell.className = `invasion-qte-cell tactical checker-${(x + y) % 2 ? 'a' : 'b'}`;
            if (moveSet.has(`${x},${y}`)) cell.classList.add('move-target');
            if (attackSet.has(`${x},${y}`)) cell.classList.add('attack-target');
            const unit = battle.pieceAt(x, y);
            if (unit) {
              const pieceEl = document.createElement('div');
              pieceEl.className = `invasion-qte-piece ${unit.side}`;
              if (selected && unit.id === selected.id) pieceEl.classList.add('selected');
              if (unit.acted) pieceEl.classList.add('spent');
              const rule = battle.getRule(unit);
              const icon = PIECE_ICONS[unit.pieceType] || PIECE_ICONS.knight;
              pieceEl.textContent = unit.side === 'player' ? icon.player : icon.enemy;
              pieceEl.title = `${unit.name} · ${rule.label}`;
              const hpBadge = document.createElement('div');
              hpBadge.className = 'invasion-qte-piece-hp';
              hpBadge.textContent = unit.hp;
              pieceEl.appendChild(hpBadge);
              cell.appendChild(pieceEl);
            }
            cell.addEventListener('click', () => {
              if (closed || battle.finished || battle.turn !== 'player') return;
              const result = battle.resolvePlayerClick(x, y);
              if (result?.message) qteStatus.textContent = result.message;
              renderBattle();
              if (battle.finished) finishBattle();
            });
            gridWrap.appendChild(cell);
          }
        }
      };

      const runEnemyLoop = () => {
        if (closed || battle.finished || battle.turn !== 'enemy') {
          renderBattle();
          if (battle.finished) finishBattle();
          return;
        }
        const step = battle.takeEnemyStep();
        if (step?.message) qteStatus.textContent = step.message;
        renderBattle();
        if (battle.finished) {
          finishBattle();
          return;
        }
        if (battle.turn === 'enemy') {
          enemyTimer = setTimeout(runEnemyLoop, 260);
        }
      };

      closeBtn.addEventListener('click', () => closeOverlay(Boolean(finalResult)));
      cancelBtn.addEventListener('click', () => closeOverlay(false));
      endTurnBtn.addEventListener('click', () => {
        if (closed || battle.finished || battle.turn !== 'player') return;
        const result = battle.endPlayerTurn();
        qteStatus.textContent = result?.message || 'Enemy turn...';
        renderBattle();
        if (battle.finished) {
          finishBattle();
          return;
        }
        runEnemyLoop();
      });

      renderBattle();
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

    const _storeWarDrillSummary = (target, preview, result) => {
      const dayNow = (typeof dayNight !== 'undefined' && dayNight.getDaysElapsed) ? dayNight.getDaysElapsed() : 0;
      _lastWarDrillSummary = {
        sourceName: city?.name || 'City',
        targetName: target?.name || 'Target City',
        day: dayNow,
        distance: Math.round(Number(preview?.distance) || 0),
        winChance: Math.round((preview?.winChance || 0) * 100),
        grade: result?.grade || 'C',
        score: Math.round(Number(result?.score) || 0),
        momentum: Math.round((result?.tacticalMomentum || 0) * 100),
        cardsPlayed: Math.round(Number(result?.cardsPlayed) || 0),
        enemyCardsPlayed: Math.round(Number(result?.enemyCardsPlayed) || 0),
        playerBattleWon: !!result?.playerBattleWon,
      };
      _notifyCityMgmt(
        `Drill ${_lastWarDrillSummary.grade} at ${_lastWarDrillSummary.targetName} (${_lastWarDrillSummary.score}). ${_lastWarDrillSummary.playerBattleWon ? 'Attacker kept momentum.' : 'Defender held the line.'}`,
        _lastWarDrillSummary.playerBattleWon ? 'info' : 'warning'
      );
      _refreshCityMgmtPanel();
    };

    const _launchWarDrill = (target, preview = null) => {
      const livePreview = _getWarPreviewForTarget(target) || preview;
      if (!livePreview) {
        _notifyCityMgmt("Could not build a drill preview for that target.", "warning");
        return;
      }
      runInvasionGridQTE(livePreview, target, (qteResult) => {
        _storeWarDrillSummary(target, livePreview, qteResult);
      }, { mode: 'drill' });
    };

    const _launchWarCampaign = (target, preview = null) => {
      const livePreview = _getWarPreviewForTarget(target) || preview;
      if (!livePreview) {
        _notifyCityMgmt("Could not build a campaign preview for that target.", "warning");
        return;
      }
      runInvasionGridQTE(livePreview, target, (qteResult) => {
        if (!cityManagement || typeof cityManagement.launchInvasion !== 'function') return;
        const res = cityManagement.launchInvasion(city, target, qteResult);
        if (!res.ok) {
          const msg = res.reason === 'no_units' ? "No units available for campaign."
            : res.reason === 'no_money' ? `Need ${res.needed || livePreview?.warCost || 0}g in treasury.`
            : res.reason === 'campaign_busy' ? "This city already has an army marching."
            : "Campaign could not start.";
          _notifyCityMgmt(msg, "warning");
          return;
        }
        if (res.marching) {
          const rem = Math.max(0, (res.arrivalDay || 0) - ((typeof dayNight !== 'undefined' && dayNight.getDaysElapsed) ? dayNight.getDaysElapsed() : 0));
          _notifyCityMgmt(`Battle ${qteResult.grade} (${qteResult.score}). Army marching to ${target.name}. ETA ${rem} day${rem !== 1 ? 's' : ''}.`, "info");
        } else {
          _notifyCityMgmt(res.won
            ? `Victory at ${target.name}!${res.spoilsGold ? ` +${res.spoilsGold}g spoils.` : ''}`
            : `Campaign failed at ${target.name}.`, res.won ? "success" : "error");
        }
        _refreshCityMgmtPanel();
      });
    };

    const warMapEntries = (Array.isArray(window.cities) ? window.cities : []).map((c) => {
      const dx = (c.location?.x || 0) - (city.location?.x || 0);
      const dy = (c.location?.y || 0) - (city.location?.y || 0);
      const distRaw = Math.sqrt(dx * dx + dy * dy);
      const tileDist = Math.round(distRaw);
      const isCurrent = c === city;
      const isTarget = warTargets.includes(c);
      const preview = isTarget && cityManagement && typeof cityManagement.getInvasionPreview === "function"
        ? cityManagement.getInvasionPreview(city, c)
        : null;
      return { city: c, tileDist, isCurrent, isTarget, preview };
    });
    const drillEntries = warMapEntries
      .filter((entry) => entry.isTarget && entry.preview)
      .sort((a, b) => {
        const distA = a.preview?.distance ?? a.tileDist;
        const distB = b.preview?.distance ?? b.tileDist;
        if (distA !== distB) return distA - distB;
        return (b.preview?.winChance || 0) - (a.preview?.winChance || 0);
      })
      .slice(0, 3);

    if (!warTargets || warTargets.length === 0) {
      createP("No rival cities remain.").parent(warBox).style("color", "#9ccc65");
    } else {
      if (drillEntries.length > 0) {
        const drillBox = createDiv().addClass("citymgmt-war-demo").parent(warBox);
        const drillHead = createDiv().addClass("citymgmt-war-demo-head").parent(drillBox);
        const drillCopy = createDiv().parent(drillHead);
        createDiv("Battle Drill").addClass("citymgmt-war-demo-title").parent(drillCopy);
        createDiv("Run a seeded tactics battle instantly. No gold spent, no army committed.")
          .addClass("citymgmt-war-demo-sub").parent(drillCopy);
        createDiv(drillEntries.length < warTargets.length ? `Showing ${drillEntries.length} quick-start scenarios` : "Ready to demo")
          .addClass("citymgmt-war-demo-kicker").parent(drillHead);

        if (_lastWarDrillSummary && _lastWarDrillSummary.sourceName === city.name) {
          const recap = createDiv().addClass("citymgmt-war-demo-result").parent(drillBox);
          const outcome = _lastWarDrillSummary.playerBattleWon ? 'Attacker kept the edge' : 'Defense held the line';
          createDiv(`Last Drill · ${_lastWarDrillSummary.targetName}`).addClass("citymgmt-war-demo-result-title").parent(recap);
          createDiv(`${_lastWarDrillSummary.grade} rank (${_lastWarDrillSummary.score}) · ${outcome}`).addClass("citymgmt-war-demo-line").parent(recap);
          createDiv(`Momentum ${_lastWarDrillSummary.momentum}% · Cards ${_lastWarDrillSummary.cardsPlayed} vs ${_lastWarDrillSummary.enemyCardsPlayed} · Day ${_lastWarDrillSummary.day}`)
            .addClass("citymgmt-war-demo-result-meta").parent(recap);
        }

        const drillGrid = createDiv().addClass("citymgmt-war-demo-grid").parent(drillBox);
        for (const entry of drillEntries) {
          const preview = entry.preview || {};
          const battlePlan = preview.battlePlan || {};
          const chancePct = Math.round((preview.winChance || 0) * 100);
          const scenario = _getWarScenarioTone(preview);
          const card = createDiv().addClass("citymgmt-war-demo-card").parent(drillGrid);
          const cardHead = createDiv().addClass("citymgmt-war-demo-card-head").parent(card);
          createDiv(entry.city?.name || "Target City").addClass("citymgmt-war-demo-city").parent(cardHead);
          createDiv(scenario.label).addClass(`citymgmt-war-demo-badge ${scenario.tone}`).parent(cardHead);
          createDiv(`Win ${chancePct}% · ${preview.distance ?? entry.tileDist} tiles · ${preview.warCost || 0}g live cost`)
            .addClass("citymgmt-war-demo-meta").parent(card);
          createDiv(`Attack: ${_formatDoctrineSummary(battlePlan.attackerDoctrines)}`).addClass("citymgmt-war-demo-line").parent(card);
          createDiv(`Defense: ${_formatDoctrineSummary(battlePlan.defenderDoctrines)}`).addClass("citymgmt-war-demo-line").parent(card);
          createDiv(`Deck ${battlePlan.playerDeckSize || 0} vs ${battlePlan.enemyDeckSize || 0} · ${_formatCardPreview(battlePlan.attackerCards)}`)
            .addClass("citymgmt-war-demo-line").parent(card);
          const actionRow = createDiv().addClass("citymgmt-war-demo-actions").parent(card);
          const drillBtn = createButton("Run Drill").addClass("citymgmt-build-btn citymgmt-sm-btn").parent(actionRow);
          drillBtn.mousePressed(() => _launchWarDrill(entry.city, preview));
          const launchBtn = createButton("Launch").addClass("citymgmt-build-btn citymgmt-sm-btn").parent(actionRow);
          launchBtn.mousePressed(() => _launchWarCampaign(entry.city, preview));
        }
      }

      const summary = createDiv().addClass("citymgmt-row").parent(warBox);
      createSpan(`${warTargets.length} rival target${warTargets.length === 1 ? '' : 's'} available.`)
        .parent(summary)
        .style("font-size", "11px")
        .style("color", "#c7c2a0");
      createSpan("Run a drill for a quick demo, or pick a target below to launch the real campaign.")
        .parent(summary)
        .style("font-size", "11px")
        .style("color", "#8fa1b3");

      const mapHost = createDiv().addClass("citymgmt-inline-map-host").parent(warBox);
      _closeWarRoomMapOverlay = _mountCityMgmtInlineNodeMap(mapHost.elt, {
        title: "War Room Map",
        subtitle: "Select a rival city in-panel to preview invasion odds, run a drill, or launch the campaign.",
        legendHTML: `
          <span class="legend-dot legend-dot-current"></span><span style="color:#ccc;font-size:11px">Your City</span>
          <span class="legend-dot legend-dot-city"></span><span style="color:#ccc;font-size:11px">Rival City</span>
          <span class="legend-dot legend-dot-player"></span><span style="color:#ccc;font-size:11px">Owned/Allied</span>
        `,
        entries: warMapEntries,
        defaultSidebarTitle: "Select a Target",
        defaultSidebarSubtitle: "Click a rival city node to review the campaign or run a drill.",
        getEntryPosition: (entry) => ({ x: entry.city.location?.x || 0, y: entry.city.location?.y || 0 }),
        getEntryLabel: (entry) => entry.city?.name || "City",
        drawConnections: ({ ctx, scale, panX, panY }) => {
          const srcX = (city.location?.x || 0) * scale + panX;
          const srcY = (city.location?.y || 0) * scale + panY;
          for (const entry of warMapEntries) {
            if (entry.isCurrent) continue;
            ctx.beginPath();
            ctx.moveTo(srcX, srcY);
            ctx.lineTo((entry.city.location?.x || 0) * scale + panX, (entry.city.location?.y || 0) * scale + panY);
            ctx.strokeStyle = entry.isTarget ? "rgba(212,175,55,0.12)" : "rgba(140,140,160,0.1)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        },
        getMarkerStyle: (entry, state) => {
          if (entry.isCurrent) {
            return {
              glow: "rgba(255,80,80,0.35)",
              fill: "#ff5050",
              stroke: "#ff9999",
              labelColor: state.selected || state.hovered ? "#ffe066" : "#fff",
            };
          }
          if (entry.isTarget) {
            return {
              glow: "rgba(212,175,55,0.25)",
              fill: "#d4af37",
              stroke: "#f0d060",
              labelColor: state.selected || state.hovered ? "#ffe066" : "#fff",
            };
          }
          return {
            glow: "rgba(130,120,180,0.24)",
            fill: "#9b6dff",
            stroke: "#d2bcff",
            labelColor: state.selected || state.hovered ? "#ffe066" : "#fff",
          };
        },
        renderSidebar: ({ entry, sideTitle, sideSub, sideBody }) => {
          if (!entry || entry.isCurrent) return false;
          sideTitle.textContent = entry.city.name;
          sideSub.textContent = entry.isTarget ? "Rival city" : "Owned or allied city";

          const stats = document.createElement("div");
          stats.className = "travel-sidebar-stats";
          const pop = entry.city?.population || 0;
          const dist = entry.preview?.distance ?? entry.tileDist;
          const cost = entry.preview?.warCost ?? null;
          const chancePct = entry.preview ? Math.round((entry.preview.winChance || 0) * 100) : null;
          const battlePlan = entry.preview?.battlePlan || null;
          stats.innerHTML = `
            <div><span class="tss-label">Distance</span><span class="tss-value">${dist} tiles</span></div>
            <div><span class="tss-label">Population</span><span class="tss-value">${pop}</span></div>
            <div><span class="tss-label">War Cost</span><span class="tss-value">${cost != null ? `${cost}g` : "N/A"}</span></div>
            <div><span class="tss-label">Win Chance</span><span class="tss-value">${chancePct != null ? `${chancePct}%` : "N/A"}</span></div>
          `;
          sideBody.appendChild(stats);

          if (battlePlan) {
            const doctrine = document.createElement("div");
            doctrine.className = "travel-sidebar-doctrine";
            const attackerTags = Array.isArray(battlePlan.attackerDoctrines) ? battlePlan.attackerDoctrines : [];
            const defenderTags = Array.isArray(battlePlan.defenderDoctrines) ? battlePlan.defenderDoctrines : [];
            doctrine.innerHTML = `
              <div class="travel-sidebar-doctrine-title">Battle Plan</div>
              <div class="travel-sidebar-doctrine-row"><span>Attack</span><span>${attackerTags.length ? attackerTags.join(" · ") : "No bonuses"}</span></div>
              <div class="travel-sidebar-doctrine-row"><span>Defense</span><span>${defenderTags.length ? defenderTags.join(" · ") : "No bonuses"}</span></div>
              <div class="travel-sidebar-doctrine-row"><span>Decks</span><span>${battlePlan.playerDeckSize || 0} vs ${battlePlan.enemyDeckSize || 0} cards</span></div>
            `;
            sideBody.appendChild(doctrine);

            const deckPreview = document.createElement("div");
            deckPreview.className = "travel-sidebar-deck-preview";
            const topAttack = (battlePlan.attackerCards || []).slice(0, 3).map((c) => `${c.title} x${c.count}`).join(", ");
            const topDefense = (battlePlan.defenderCards || []).slice(0, 3).map((c) => `${c.title} x${c.count}`).join(", ");
            deckPreview.innerHTML = `
              <div><strong>Attack Deck:</strong> ${topAttack || "None"}</div>
              <div><strong>Defense Deck:</strong> ${topDefense || "None"}</div>
            `;
            sideBody.appendChild(deckPreview);
          }

          if (entry.isTarget) {
            const drillBtn = document.createElement("button");
            drillBtn.className = "travel-map-go-btn travel-map-go-btn-secondary";
            drillBtn.textContent = "Run Battle Drill";
            drillBtn.onclick = () => _launchWarDrill(entry.city, entry.preview);
            sideBody.appendChild(drillBtn);
          }

          const goBtn = document.createElement("button");
          goBtn.className = `travel-map-go-btn${entry.isTarget ? "" : " travel-map-go-btn-disabled"}`;
          goBtn.textContent = entry.isTarget ? "Launch Campaign" : "Cannot Attack";
          if (entry.isTarget) {
            goBtn.onclick = () => _launchWarCampaign(entry.city, entry.preview);
          }
          sideBody.appendChild(goBtn);
          return true;
        },
      });
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

  // ─── Unit-vs-Raider QTE ────────────────────────────────
  window._runUnitRaidQTE = function(unit, raider, onDone) {
    const qteAssistScore = (typeof player !== 'undefined' && player?.modifiers?.qteAssist)
      ? Math.max(0, Math.min(100, Number(player.modifiers.qteRaidScore) || 78))
      : null;
    if (qteAssistScore != null) {
      if (typeof onDone === 'function') onDone({ score: qteAssistScore });
      _notifyCityMgmt(`Skirmish auto-resolved by Tactical Autopilot (${qteAssistScore}).`, 'info');
      return;
    }
    document.getElementById('unitRaidQTEOverlay')?.remove();
    window._unitRaidQTEActive = true;

    const dirs = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    const arrows = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
    const classKey = String(unit?.classKey || 'militia');
    const qteProfileByClass = {
      militia: { label: 'Militia Drill', noteBias: 0, intervalBias: 0, perfectBias: 0, goodBias: 0, comboWeight: 0.22, patternBias: ['ArrowUp', 'ArrowRight', 'ArrowLeft', 'ArrowDown'], burstChance: 0.08, jitter: 60 },
      guard: { label: 'Guard Formation', noteBias: -1, intervalBias: 40, perfectBias: 18, goodBias: 24, comboWeight: 0.14, patternBias: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'], burstChance: 0.05, jitter: 40 },
      ranger: { label: 'Ranger Volley', noteBias: 2, intervalBias: -40, perfectBias: -14, goodBias: -20, comboWeight: 0.30, patternBias: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowRight'], burstChance: 0.18, jitter: 90 },
      corsair: { label: 'Corsair Broadside', noteBias: 1, intervalBias: -15, perfectBias: -6, goodBias: -8, comboWeight: 0.26, patternBias: ['ArrowLeft', 'ArrowRight', 'ArrowRight', 'ArrowLeft'], burstChance: 0.32, jitter: 110 },
    };
    const qteProfile = qteProfileByClass[classKey] || qteProfileByClass.militia;
    const strength = Math.max(1, Math.floor(Number(raider?.strength) || 2));
    const isMobileQTE = (() => {
      try {
        if (typeof window !== 'undefined' && typeof window.getMobileContext === 'function') {
          return !!window.getMobileContext().mobile;
        }
        if (typeof window !== 'undefined' && typeof window.isMobile === 'function' && window.isMobile()) return true;
        if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
      } catch (_e) {}
      return false;
    })();
    let noteCount = Math.max(5, Math.min(12, 6 + Math.floor(strength / 2) + qteProfile.noteBias));
    let intervalMs = Math.max(280, 430 - (strength * 15) + qteProfile.intervalBias);
    let startDelayMs = 900;
    let perfectWindow = Math.max(58, 85 + qteProfile.perfectBias);
    let goodWindow = Math.max(perfectWindow + 30, 170 + qteProfile.goodBias);

    if (isMobileQTE) {
      noteCount = Math.max(4, noteCount - 1);
      intervalMs = Math.round(intervalMs * 1.2);
      startDelayMs = 1100;
      perfectWindow = Math.round(perfectWindow * 1.32);
      goodWindow = Math.max(perfectWindow + 34, Math.round(goodWindow * 1.34));
    }
    const totalMs = startDelayMs + (noteCount * intervalMs) + 800;

    const overlay = document.createElement('div');
    overlay.id = 'unitRaidQTEOverlay';
    overlay.className = 'invasion-qte-overlay';
    const modal = document.createElement('div');
    modal.className = 'invasion-qte-window';
    overlay.appendChild(modal);

    const head = document.createElement('div');
    head.className = 'invasion-qte-head';
    modal.appendChild(head);

    const title = document.createElement('div');
    title.className = 'invasion-qte-title';
    title.textContent = `Skirmish: ${unit?.name || 'Unit'} vs ${raider?.name || 'Raider'}`;
    head.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'invasion-qte-close';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Cancel skirmish QTE');
    head.appendChild(closeBtn);

    const hint = document.createElement('div');
    hint.className = 'invasion-qte-status';
    hint.textContent = `${qteProfile.label}: hit arrows inside the green zone. Perfect timing gives stronger combat control.`;
    modal.appendChild(hint);

    const stats = document.createElement('div');
    stats.className = 'invasion-qte-stats';
    stats.innerHTML = `
      <span id="unitQtePerfect">Perfect: 0</span>
      <span id="unitQteGood">Good: 0</span>
      <span id="unitQteMiss">Miss: 0</span>
      <span id="unitQteCombo">Combo: 0</span>
    `;
    modal.appendChild(stats);

    const timerWrap = document.createElement('div');
    timerWrap.className = 'invasion-qte-timer-wrap';
    const timerBar = document.createElement('div');
    timerBar.className = 'invasion-qte-timer-bar';
    timerWrap.appendChild(timerBar);
    modal.appendChild(timerWrap);

    const previewRow = document.createElement('div');
    previewRow.style.display = 'flex';
    previewRow.style.gap = '5px';
    previewRow.style.flexWrap = 'wrap';
    previewRow.style.margin = '8px 0 6px';
    previewRow.style.minHeight = '28px';
    modal.appendChild(previewRow);

    const track = document.createElement('div');
    track.className = 'qte-rhythm-track';
    const targetZone = document.createElement('div');
    targetZone.className = 'qte-rhythm-target-zone';
    const targetInner = document.createElement('div');
    targetInner.className = 'qte-rhythm-target-inner';
    targetZone.appendChild(targetInner);
    const lane = document.createElement('div');
    lane.className = 'qte-rhythm-lane';
    track.appendChild(targetZone);
    track.appendChild(lane);
    modal.appendChild(track);

    const laneHint = document.createElement('div');
    laneHint.className = 'qte-rhythm-hint';
    laneHint.textContent = 'Perfect <= 85ms, Good <= 170ms';
    modal.appendChild(laneHint);

    const status = document.createElement('div');
    status.className = 'invasion-qte-timer-text';
    modal.appendChild(status);

    if (isMobileQTE) {
      const touchWrap = document.createElement('div');
      touchWrap.className = 'qte-touch-controls city-unit-qte-touch';
      const touchTitle = document.createElement('div');
      touchTitle.className = 'qte-touch-title';
      touchTitle.textContent = 'Touch Controls';
      touchWrap.appendChild(touchTitle);

      const dpad = document.createElement('div');
      dpad.className = 'qte-touch-dpad';
      touchWrap.appendChild(dpad);

      const addTouchBtn = (dir) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'qte-touch-btn qte-touch-arrow city-unit-qte-btn';
        btn.textContent = arrows[dir];
        btn.setAttribute('aria-label', `Press ${dir.replace('Arrow', '')}`);
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          processDirection(dir);
        });
        dpad.appendChild(btn);
      };
      addTouchBtn('ArrowLeft');
      addTouchBtn('ArrowUp');
      addTouchBtn('ArrowDown');
      addTouchBtn('ArrowRight');

      modal.appendChild(touchWrap);
    }

    const finishBtn = document.createElement('button');
    finishBtn.className = 'citymgmt-build-btn';
    finishBtn.textContent = 'Confirm Strike';
    finishBtn.style.marginTop = '8px';
    finishBtn.disabled = true;
    modal.appendChild(finishBtn);

    document.body.appendChild(overlay);

    const notes = [];
    let perfectHits = 0;
    let goodHits = 0;
    let misses = 0;
    let combo = 0;
    let maxCombo = 0;
    let started = false;
    let done = false;
    const start = performance.now();
    const strongPatternBias = qteProfile.patternBias;

    const cleanup = () => {
      window.removeEventListener('keydown', onKey, true);
      overlay.remove();
      window._unitRaidQTEActive = false;
    };

    const renderPreview = () => {
      previewRow.innerHTML = '';
      const pending = notes.filter((n) => !n.resolved).slice(0, 8);
      for (const n of pending) {
        const chip = document.createElement('span');
        chip.textContent = arrows[n.dir];
        chip.style.minWidth = '24px';
        chip.style.textAlign = 'center';
        chip.style.padding = '3px 6px';
        chip.style.borderRadius = '6px';
        chip.style.border = '1px solid rgba(202,163,80,0.35)';
        chip.style.background = 'rgba(255,255,255,0.05)';
        chip.style.color = '#ddd';
        previewRow.appendChild(chip);
      }
    };

    const updateStats = () => {
      const pEl = document.getElementById('unitQtePerfect');
      const gEl = document.getElementById('unitQteGood');
      const mEl = document.getElementById('unitQteMiss');
      const cEl = document.getElementById('unitQteCombo');
      if (pEl) pEl.textContent = `Perfect: ${perfectHits}`;
      if (gEl) gEl.textContent = `Good: ${goodHits}`;
      if (mEl) mEl.textContent = `Miss: ${misses}`;
      if (cEl) cEl.textContent = `Combo: ${combo}`;
    };

    const resolveNow = (score) => {
      cleanup();
      if (typeof onDone === 'function') onDone({ score });
    };

    const finish = (forceMiss = false) => {
      if (done) return;
      done = true;
      if (forceMiss) misses = Math.max(misses, noteCount);
      const weightedHits = (perfectHits * 1.0) + (goodHits * 0.72);
      const accuracy = weightedHits / Math.max(1, noteCount);
      const comboScore = Math.min(1, maxCombo / Math.max(4, noteCount - 1));
      const penalty = Math.min(0.45, (misses / Math.max(1, noteCount)) * 0.45);
      const comboWeight = Math.max(0.08, Math.min(0.40, Number(qteProfile.comboWeight) || 0.22));
      const accuracyWeight = 1 - comboWeight;
      const score = Math.max(0, Math.min(100, Math.round(((accuracy * accuracyWeight) + (comboScore * comboWeight) - penalty) * 100)));
      status.textContent = `QTE score: ${score}`;
      finishBtn.disabled = false;
      finishBtn.onclick = () => resolveNow(score);
      setTimeout(() => {
        if (window._unitRaidQTEActive) resolveNow(score);
      }, 900);
    };

    for (let i = 0; i < noteCount; i++) {
      const dir = (Math.random() < 0.24)
        ? strongPatternBias[i % strongPatternBias.length]
        : dirs[Math.floor(Math.random() * dirs.length)];
      const burstPush = (Math.random() < qteProfile.burstChance) ? Math.floor(intervalMs * 0.22) : 0;
      const jitter = qteProfile.jitter || 60;
      const hitAt = startDelayMs + (i * intervalMs) - burstPush + Math.floor((Math.random() * jitter) - (jitter / 2));
      const el = document.createElement('div');
      el.className = 'qte-rhythm-arrow';
      el.textContent = arrows[dir];
      lane.appendChild(el);
      notes.push({ dir, hitAt, el, resolved: false });
    }
    laneHint.textContent = `Mode: ${qteProfile.label} · Perfect <= ${perfectWindow}ms, Good <= ${goodWindow}ms`;
    renderPreview();
    updateStats();

    const tick = () => {
      if (done) return;
      const elapsed = performance.now() - start;
      const rem = Math.max(0, totalMs - elapsed);
      timerBar.style.width = `${Math.round((rem / totalMs) * 100)}%`;

      const trackRect = track.getBoundingClientRect();
      const targetRect = targetInner.getBoundingClientRect();
      const targetX = (targetRect.left - trackRect.left) + (targetRect.width / 2);
      const speedPxPerMs = Math.max(0.16, trackRect.width / 2300);

      for (const note of notes) {
        if (note.resolved) {
          continue;
        }
        if (elapsed >= note.hitAt - 2400) started = true;
        const delta = note.hitAt - elapsed;
        const x = targetX + (delta * speedPxPerMs);
        note.el.style.left = `${Math.round(x - 24)}px`;

        if (elapsed > note.hitAt + goodWindow) {
          note.resolved = true;
          note.el.classList.add('qte-rhythm-miss');
          misses++;
          combo = 0;
          updateStats();
          renderPreview();
        }
      }

      const left = notes.filter((n) => !n.resolved).length;
      status.textContent = `Hits ${perfectHits + goodHits}/${noteCount} · Miss ${misses} · ${Math.ceil(rem / 1000)}s`;
      if ((started && left <= 0) || rem <= 0) {
        finish(rem <= 0 && (perfectHits + goodHits + misses) === 0);
        return;
      }
      requestAnimationFrame(tick);
    };

    const processDirection = (dirKey) => {
      if (done || !arrows[dirKey]) return;
      const elapsed = performance.now() - start;
      const candidates = notes
        .filter((n) => !n.resolved && n.dir === dirKey)
        .map((n) => ({ note: n, dt: Math.abs(elapsed - n.hitAt) }))
        .sort((a, b) => a.dt - b.dt);
      const match = candidates[0];

      if (!match || match.dt > goodWindow) {
        misses++;
        combo = 0;
        updateStats();
        hint.textContent = 'Miss timing. Stay on rhythm and strike in the zone.';
        return;
      }

      const note = match.note;
      note.resolved = true;
      if (match.dt <= perfectWindow) {
        perfectHits++;
        combo++;
        maxCombo = Math.max(maxCombo, combo);
        note.el.classList.add('qte-rhythm-perfect');
        hint.textContent = 'Perfect hit!';
      } else {
        goodHits++;
        combo++;
        maxCombo = Math.max(maxCombo, combo);
        note.el.classList.add('qte-rhythm-good');
        hint.textContent = 'Good hit.';
      }
      updateStats();
      renderPreview();
    };

    const onKey = (e) => {
      if (done) return;
      if (!arrows[e.key]) return;
      e.preventDefault();
      e.stopPropagation();
      processDirection(e.key);
    };

    closeBtn.onclick = () => {
      if (!done) finish(true);
    };

    window.addEventListener('keydown', onKey, true);
    requestAnimationFrame(tick);
  };

  // ─── Actions ────────────────────────────────────────────
  function _buildActionsTab(container, city) {
    const wrap = createDiv().addClass("citymgmt-tab-inner").parent(container);

    _buildTreasurySection(wrap, city);

    const focusBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "").parent(focusBox).html(cityMgmtLabelHTML('Chart', 'City Focus', 16, '⚖️'));
    const currentFocus = (cityManagement && typeof cityManagement.getCityFocus === "function")
      ? cityManagement.getCityFocus(city)
      : { key: "balanced", label: "Balanced Council", desc: "Default city focus." };
    createDiv(`${cityMgmtIconHTML(currentFocus.atlasFrame || currentFocus.label, 14, currentFocus.emoji || "⚖️")} ${currentFocus.label}`)
      .parent(focusBox)
      .style("font-weight", "700")
      .style("color", "#d8e7ff")
      .style("margin-bottom", "4px");
    createDiv(currentFocus.desc || "Switch the city posture to shape its strengths.")
      .addClass("citymgmt-inline-note")
      .parent(focusBox);
    const focusDefs = (cityManagement && typeof cityManagement.getCityFocusDefs === "function")
      ? cityManagement.getCityFocusDefs()
      : [];
    for (const def of focusDefs) {
      const row = createDiv().addClass("citymgmt-policy-row").parent(focusBox);
      const info = createDiv().parent(row).style("flex", "1");
      createDiv(`${cityMgmtIconHTML(def.atlasFrame || def.label, 14, def.emoji || "•")} ${def.label}`)
        .parent(info).style("font-weight", "700").style("color", def.key === currentFocus.key ? "#9be7ad" : "#d7e3f2");
      createDiv(def.desc).parent(info).style("font-size", "11px").style("color", "#96a7b9");
      const effects = createDiv().parent(info).style("display", "flex").style("gap", "6px").style("flex-wrap", "wrap").style("margin-top", "4px");
      for (const [ek, ev] of Object.entries(def.effects || {})) {
        const sign = ev >= 0 ? "+" : "";
        const value = Math.abs(ev) < 1 ? `${sign}${Math.round(ev * 100)}%` : `${sign}${ev}`;
        createDiv(`${ek}: ${value}`)
          .parent(effects)
          .style("font-size", "10px")
          .style("padding", "2px 6px")
          .style("border-radius", "999px")
          .style("background", "rgba(255,255,255,0.06)")
          .style("color", ev >= 0 ? "#8be3a7" : "#ffb3b3");
      }
      const btn = createButton(def.key === currentFocus.key ? "Active" : "Set Focus")
        .addClass("citymgmt-build-btn")
        .parent(row)
        .style("align-self", "center");
      if (def.key === currentFocus.key) btn.style("background", "rgba(76,175,80,0.2)").style("border-color", "#4caf50");
      btn.mousePressed(() => {
        if (!cityManagement || typeof cityManagement.setCityFocus !== "function") return;
        const res = cityManagement.setCityFocus(city, def.key);
        if (!res.ok) {
          _notifyCityMgmt("Could not change city focus.", "warning");
          return;
        }
        _notifyCityMgmt(`${def.label} is now guiding the city.`, "success");
        _refreshCityMgmtPanel();
      });
    }

    const opsBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "").parent(opsBox).html(cityMgmtLabelHTML('Wheel', 'Operations Room', 16, '🎯'));
    const pressures = (cityManagement && typeof cityManagement.getCityPressures === "function")
      ? cityManagement.getCityPressures(city)
      : [];
    const activeOps = (cityManagement && typeof cityManagement.getActiveCityOperations === "function")
      ? cityManagement.getActiveCityOperations(city)
      : [];
    const activeBonuses = (cityManagement && typeof cityManagement.getActiveCityBonuses === "function")
      ? cityManagement.getActiveCityBonuses(city)
      : [];
    const opCap = (cityManagement && typeof cityManagement.getOperationCapacity === "function")
      ? cityManagement.getOperationCapacity(city)
      : 1;
    createDiv(`Active operations: ${activeOps.length}/${opCap}${activeBonuses.length > 0 ? ` · ${activeBonuses.length} live boost${activeBonuses.length === 1 ? "" : "s"}` : ""}`)
      .addClass("citymgmt-inline-note")
      .parent(opsBox);
    if (pressures.length > 0) {
      const pressureWrap = createDiv().addClass("citymgmt-pill-wrap").parent(opsBox);
      for (const pressure of pressures.slice(0, 5)) {
        createDiv(`${pressure.label} · ${pressure.detail}`)
          .addClass("citymgmt-badge citymgmt-badge-subtle")
          .parent(pressureWrap)
          .style("border-color", pressure.tone || "rgba(255,255,255,0.12)")
          .style("color", pressure.tone || "#d7e3f2");
      }
    }
    if (activeOps.length > 0) {
      createDiv("Running Operations").addClass("citymgmt-subheading").parent(opsBox);
      for (const op of activeOps) {
        const row = createDiv().addClass("citymgmt-control-group").parent(opsBox);
        createDiv(`${op.label} · ${op.remainingDays} day${op.remainingDays === 1 ? "" : "s"} left`).addClass("citymgmt-control-label").parent(row);
        if (op.summary) createDiv(op.summary).addClass("citymgmt-inline-note").parent(row);
        createDiv(`<div class="citymgmt-q-track"><div class="citymgmt-q-fill" style="width:${Math.round((op.progress || 0) * 100)}%"></div></div>`)
          .parent(row);
      }
    }
    if (activeBonuses.length > 0) {
      createDiv("Active Bonuses").addClass("citymgmt-subheading").parent(opsBox);
      const buffWrap = createDiv().addClass("citymgmt-pill-wrap").parent(opsBox);
      for (const buff of activeBonuses) {
        createDiv(`${buff.label} · ${buff.remainingDays}d${buff.summary ? ` · ${buff.summary}` : ""}`)
          .addClass("citymgmt-badge citymgmt-badge-subtle")
          .parent(buffWrap)
          .style("color", "#80cbc4");
      }
    }
    createDiv("Launch Operation").addClass("citymgmt-subheading").parent(opsBox);
    const opDefs = (cityManagement && typeof cityManagement.getAvailableOperations === "function")
      ? cityManagement.getAvailableOperations(city)
      : [];
    for (const op of opDefs) {
      const row = createDiv().addClass("citymgmt-policy-row").parent(opsBox);
      const info = createDiv().parent(row).style("flex", "1");
      createDiv(`${cityMgmtIconHTML(op.atlasFrame || op.label, 14, op.emoji || "•")} ${op.label}`)
        .parent(info).style("font-weight", "700").style("color", op.recommended ? "#ffd54f" : "#d7e3f2");
      createDiv(op.desc || "").parent(info).style("font-size", "11px").style("color", "#96a7b9");
      createDiv(`${op.costLabel || "Free"} · ${op.durationDays}d · ${op.payoff}`)
        .parent(info).style("font-size", "11px").style("color", "#b8d6ff").style("margin-top", "3px");
      if (op.recommendation) {
        createDiv(op.recommendation)
          .parent(info).style("font-size", "10px").style("color", op.recommended ? "#ffd54f" : "#7ec8e3").style("margin-top", "2px");
      }
      const btn = createButton(op.active ? "Running" : op.canStart ? "Start" : "Locked")
        .addClass("citymgmt-build-btn")
        .parent(row)
        .style("align-self", "center");
      if (!op.canStart) btn.style("opacity", "0.55");
      if (op.active) btn.style("background", "rgba(76,175,80,0.2)").style("border-color", "#4caf50");
      btn.mousePressed(() => {
        if (!op.canStart || !cityManagement || typeof cityManagement.startCityOperation !== "function") {
          if (op.lockedReason) _notifyCityMgmt(op.lockedReason, "warning");
          return;
        }
        const res = cityManagement.startCityOperation(city, op.key);
        if (!res.ok) {
          _notifyCityMgmt(res.message || (res.reason === "no_money" ? "Not enough treasury or supplies." : "Operation unavailable."), "warning");
          return;
        }
        _notifyCityMgmt(`${op.label} is underway.`, "success");
        _refreshCityMgmtPanel();
      });
    }
    const history = (cityManagement && typeof cityManagement.getCityOperationHistory === "function")
      ? cityManagement.getCityOperationHistory(city)
      : [];
    if (history.length > 0) {
      const historyBox = createDiv().addClass("citymgmt-control-group").parent(opsBox);
      createDiv("Recent Completed Operations").addClass("citymgmt-control-label").parent(historyBox);
      for (const entry of history.slice(0, 4)) {
        createDiv(`Day ${entry.completedDay} · ${entry.label}${entry.summary ? ` · ${entry.summary}` : ""}`)
          .addClass("citymgmt-inline-note")
          .parent(historyBox);
      }
    }

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

  // ═══════════════════════════════════════════════════════════
  //  POLICIES TAB — Toggleable policies + Specialization + Advisors
  // ═══════════════════════════════════════════════════════════
  function _buildPoliciesTab(container, city) {
    const wrap = createDiv().addClass("citymgmt-tab-inner").parent(container);

    // ─── Active Policies ───────────────────────────────
    const polBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "").parent(polBox).html(cityMgmtLabelHTML('Book', 'City Policies', 16, '⚖️'));
    const dailyCost = (typeof CityPolicies !== "undefined") ? CityPolicies.getDailyCost(city) : 0;
    createElement("div", `Daily policy upkeep: ${dailyCost}g`)
      .parent(polBox).style("color", "#96a7b9").style("font-size", "12px").style("margin-bottom", "6px");

    if (typeof CityPolicies !== "undefined") {
      for (const [key, def] of Object.entries(CityPolicies.DEFS)) {
        const active = CityPolicies.isActive(city, key);
        const row = createDiv().addClass("citymgmt-policy-row").parent(polBox);

        const info = createDiv().parent(row).style("flex", "1");
        createElement("div", `${cityMgmtIconHTML(def.atlasFrame || key || def.name, 14, def.emoji || '•')} ${def.name}`)
          .parent(info).style("font-weight", "700").style("color", active ? "#4caf50" : "#c8d6e5");
        createElement("div", def.desc)
          .parent(info).style("font-size", "11px").style("color", "#96a7b9");

        // Effects chips
        const chips = createDiv().parent(info).style("display", "flex").style("gap", "6px").style("margin-top", "3px").style("flex-wrap", "wrap");
        for (const [ek, ev] of Object.entries(def.effects)) {
          const sign = ev >= 0 ? "+" : "";
          const color = ev >= 0 ? "#67d887" : "#ff7b7b";
          createElement("span", `${ek}: ${sign}${typeof ev === "number" && ev < 1 && ev > -1 ? Math.round(ev * 100) + "%" : ev}`)
            .parent(chips).style("font-size", "10px").style("color", color)
            .style("background", "rgba(255,255,255,0.06)").style("padding", "1px 5px").style("border-radius", "4px");
        }
        if (def.dailyCost > 0) {
          createElement("span", `cost: ${def.dailyCost}g/day`)
            .parent(chips).style("font-size", "10px").style("color", "#ffc107")
            .style("background", "rgba(255,255,255,0.06)").style("padding", "1px 5px").style("border-radius", "4px");
        }
        if (def.conflicts.length > 0) {
          const conflictNames = def.conflicts.map(c => CityPolicies.DEFS[c]?.name || c).join(", ");
          createElement("span", `conflicts: ${conflictNames}`)
            .parent(chips).style("font-size", "10px").style("color", "#ff9800")
            .style("background", "rgba(255,255,255,0.06)").style("padding", "1px 5px").style("border-radius", "4px");
        }

        const btn = createButton(active ? "Active ✓" : "Enable")
          .addClass("citymgmt-build-btn").parent(row)
          .style("min-width", "80px").style("align-self", "center");
        if (active) btn.style("background", "rgba(76,175,80,0.2)").style("border-color", "#4caf50");
        btn.mousePressed(() => {
          const conflicts = CityPolicies.DEFS[key].conflicts || [];
          const wasActive = conflicts.filter(c => CityPolicies.isActive(city, c));
          const nowOn = CityPolicies.toggle(city, key);
          if (nowOn && wasActive.length > 0 && typeof notificationManager !== "undefined") {
            const names = wasActive.map(c => CityPolicies.DEFS[c]?.name || c).join(", ");
            notificationManager.log(`${def.name} conflicts with ${names} — disabled.`, "warning");
          }
          _refreshCityMgmtPanel();
        });
      }
    } else {
      createElement("div", "Policy system unavailable.").parent(polBox).style("color", "#aaa");
    }

    // ─── Specialization ───────────────────────────────
    const specBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "").parent(specBox).html(cityMgmtLabelHTML('Wheel', 'City Specialization', 16, '🎭'));

    if (typeof CitySpecialization !== "undefined") {
      const path = CitySpecialization.getPath(city);
      if (!path) {
        // Show selection
        if (CitySpecialization.canChoose(city)) {
          createElement("div", "Choose a specialization path for your city (permanent choice):")
            .parent(specBox).style("color", "#c8d6e5").style("margin-bottom", "8px");
          for (const [key, def] of Object.entries(CitySpecialization.PATHS)) {
            const row = createDiv().addClass("citymgmt-policy-row").parent(specBox);
            const info = createDiv().parent(row).style("flex", "1");
            createElement("div", `${cityMgmtIconHTML(def.atlasFrame || key || def.name, 14, def.emoji || '•')} ${def.name}`).parent(info).style("font-weight", "700").style("color", "#d4af37");
            createElement("div", def.desc).parent(info).style("font-size", "11px").style("color", "#96a7b9");
            const tiers = def.tiers.map(t => `${t.name} (pop ${t.pop}): ${t.desc}`).join(" → ");
            createElement("div", tiers).parent(info).style("font-size", "10px").style("color", "#7ec8e3").style("margin-top", "2px");
            const btn = createButton("Choose").addClass("citymgmt-build-btn").parent(row).style("align-self", "center");
            btn.mousePressed(() => {
              if (confirm(`Choose ${def.name}? This is permanent.`)) {
                CitySpecialization.choose(city, key);
                _refreshCityMgmtPanel();
              }
            });
          }
        } else {
          createElement("div", `Reach population 250 to unlock specialization (current: ${city.population}).`)
            .parent(specBox).style("color", "#aaa");
        }
      } else {
        // Show current path + tier
        const spec = city.management.specialization;
        const tierDef = CitySpecialization.getCurrentTierDef(city);
        const nextDef = CitySpecialization.getNextTierDef(city);
        createElement("div", `${cityMgmtIconHTML(path.atlasFrame || path.name, 14, path.emoji || '•')} ${path.name} — Tier ${spec.tier + 1}: ${tierDef?.name || "?"}`)
          .parent(specBox).style("font-weight", "700").style("color", "#d4af37").style("font-size", "15px");
        createElement("div", tierDef?.desc || "").parent(specBox).style("color", "#8bc34a").style("margin", "4px 0");
        if (nextDef) {
          createElement("div", `Next: ${nextDef.name} at pop ${nextDef.pop} — ${nextDef.desc}`)
            .parent(specBox).style("color", "#7ec8e3").style("font-size", "12px");
        } else {
          createElement("div", "Max tier reached!").parent(specBox).style("color", "#ffd700").style("font-size", "12px");
        }
      }
    } else {
      createElement("div", "Specialization system unavailable.").parent(specBox).style("color", "#aaa");
    }

    // ─── Advisors ────────────────────────────────────
    const advBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "").parent(advBox).html(cityMgmtLabelHTML('Book', 'City Advisors', 16, '📚'));

    if (typeof cityManagement !== "undefined" && cityManagement.advisors) {
      const advisors = cityManagement.advisors.getUnlockedAdvisors();
      if (advisors.length === 0) {
        createElement("div", "Advisors unlock as your city grows (first at pop 150).")
          .parent(advBox).style("color", "#aaa");
      } else {
        for (const adv of advisors) {
          const row = createDiv().addClass("citymgmt-policy-row").parent(advBox);
          const info = createDiv().parent(row).style("flex", "1");
          createElement("div", `${cityMgmtIconHTML(adv.atlasFrame || adv.key || adv.name, 14, adv.emoji || '•')} ${adv.name}`).parent(info).style("font-weight", "700").style("color", "#d4af37");
          createElement("div", adv.desc).parent(info).style("font-size", "11px").style("color", "#96a7b9");
          const tip = cityManagement.advisors.getTip(adv.key);
          if (tip) createElement("div", `"${tip}"`).parent(info).style("font-size", "11px").style("color", "#7ec8e3").style("font-style", "italic").style("margin-top", "3px");
        }

        // Active advisor quests
        const quests = cityManagement.advisors.activeQuests.filter(q => !q.collected);
        if (quests.length > 0) {
          createElement("h3", "").parent(advBox).html(cityMgmtLabelHTML('Chart', 'Advisor Quests', 16, '📋')).style("margin-top", "10px");
          for (const q of quests) {
            const advDef = CityAdvisors.ADVISOR_DEFS[q.advisor];
            const qRow = createDiv().addClass("citymgmt-policy-row").parent(advBox);
            const info = createDiv().parent(qRow).style("flex", "1");
            const statusColor = q.completed ? (q.failed ? "#f44336" : "#4caf50") : "#ffc107";
            const statusText = q.completed ? (q.failed ? "Failed" : "Complete!") : `Due day ${q.deadline}`;
            createElement("div", `${cityMgmtIconHTML(advDef?.atlasFrame || advDef?.name || 'Chart', 14, advDef?.emoji || "📋")} ${q.text}`)
              .parent(info).style("font-size", "12px").style("color", "#c8d6e5");
            createElement("div", `${statusText} — Reward: ${q.reward}g`)
              .parent(info).style("font-size", "11px").style("color", statusColor);
            if (q.completed && !q.failed && !q.collected) {
              const btn = createButton("Collect Reward").addClass("citymgmt-build-btn").parent(qRow).style("align-self", "center");
              btn.mousePressed(() => {
                cityManagement.advisors.collectReward(q.id, city);
                _refreshCityMgmtPanel();
              });
            }
          }
        }
      }
    } else {
      createElement("div", "Advisor system unavailable.").parent(advBox).style("color", "#aaa");
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  DIPLOMACY TAB — Relations, pacts, gifts, espionage
  // ═══════════════════════════════════════════════════════════
  function _buildDiplomacyTab(container, city) {
    const wrap = createDiv().addClass("citymgmt-tab-inner").parent(container);
    const allCities = (typeof cities !== "undefined" && Array.isArray(cities)) ? cities : [];
    const otherCities = allCities.filter(c => c !== city);
    const day = (typeof dayNight !== "undefined" && dayNight) ? dayNight.getDaysElapsed() : 0;

    // ─── Diplomacy overview ───────────────────────────
    const dipBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "").parent(dipBox).html(cityMgmtLabelHTML('Friendly', 'City Relations', 16, '🤝'));
    const threatReport = (typeof cityManagement !== "undefined" && typeof cityManagement.getCityThreatReport === "function")
      ? cityManagement.getCityThreatReport(city)
      : { routeThreats: [], rivalThreats: [] };
    const routeThreatByCity = new Map((threatReport.routeThreats || []).map((entry) => [entry.dest?.name || entry.route?.destName, entry]));
    const rivalThreatByCity = new Map((threatReport.rivalThreats || []).map((entry) => [entry.city?.name, entry]));

    if (typeof cityManagement !== "undefined" && cityManagement.diplomacy && otherCities.length > 0) {
      for (const oc of otherCities) {
        const tier = cityManagement.diplomacy.getTier(oc.name);
        const score = cityManagement.diplomacy.getScore(oc.name);
        const pacts = cityManagement.diplomacy.getActivePacts(oc.name);
        const strategicNote = typeof cityManagement.diplomacy.getStrategicNote === "function"
          ? cityManagement.diplomacy.getStrategicNote(oc.name)
          : "";
        const laneThreat = routeThreatByCity.get(oc.name) || null;
        const rivalThreat = rivalThreatByCity.get(oc.name) || null;
        const row = createDiv().addClass("citymgmt-diplo-row").parent(dipBox);

        const info = createDiv().parent(row).style("flex", "1");
        createElement("div", `${cityMgmtIconHTML(tier.atlasFrame || tier.label, 14, tier.emoji || '•')} ${oc.name}`)
          .parent(info).style("font-weight", "700").style("color", tier.color);
        createElement("div", `${tier.label} (${score > 0 ? "+" : ""}${Math.round(score)}) — Pop: ${oc.population}`)
          .parent(info).style("font-size", "11px").style("color", "#96a7b9");
        if (laneThreat || rivalThreat) {
          const detail = laneThreat
            ? `Lane ${laneThreat.threatLabel} (${laneThreat.threatScore})`
            : `Frontier ${rivalThreat.threatLabel} (${rivalThreat.threatScore})`;
          createElement("div", detail)
            .parent(info)
            .style("font-size", "10px")
            .style("color", (laneThreat?.threatTone || rivalThreat?.threatTone || "#ffcc80"));
        }
        if (strategicNote) {
          createElement("div", strategicNote)
            .parent(info)
            .style("font-size", "10px")
            .style("color", "#b4c7d9");
        }

        // Active pacts
        if (pacts.length > 0) {
          const pactText = pacts.map(p => `${cityMgmtIconHTML(p.atlasFrame || p.key || p.name, 12, p.emoji || '•')} ${p.name} (expires day ${p.expires})`).join(", ");
          createElement("div", pactText).parent(info).style("font-size", "10px").style("color", "#7ec8e3");
        }

        // Action buttons
        const btns = createDiv().parent(row).style("display", "flex").style("gap", "4px").style("flex-wrap", "wrap").style("align-self", "center");

        const goldGiftGain = typeof cityManagement.diplomacy.getGiftGain === "function"
          ? cityManagement.diplomacy.getGiftGain(100, "gold")
          : 5;
        const giftBtn = createButton("").addClass("citymgmt-build-btn citymgmt-sm-btn").parent(btns);
        giftBtn.html(cityMgmtLabelHTML('Cash', `Gift 100g (+${goldGiftGain})`, 12, '🎁'));
        giftBtn.mousePressed(() => {
          if (!city.management || city.management.budget < 100) {
            if (typeof notificationManager !== "undefined") notificationManager.log("Not enough gold for a gift.", "error");
            return;
          }
          const r = cityManagement.diplomacy.sendGift(oc.name, 100, day);
          if (r.ok) city.management.budget -= 100;
          if (typeof notificationManager !== "undefined") notificationManager.log(r.msg, r.ok ? "info" : "error");
          _refreshCityMgmtPanel();
        });

        const wineGiftCost = 3;
        const wineStock = Math.max(0, Number(city.inventory?.get("Wine")?.quantity) || 0);
        const wineGiftGain = typeof cityManagement.diplomacy.sendWineGift === "function"
          && typeof cityManagement.diplomacy.getGiftGain === "function"
          ? cityManagement.diplomacy.getGiftGain(wineGiftCost, "wine")
          : 16;
        const wineGiftBtn = createButton("")
          .addClass("citymgmt-build-btn citymgmt-sm-btn")
          .parent(btns);
        wineGiftBtn.html(cityMgmtLabelHTML('Wine', `Gift ${wineGiftCost} Wine (+${wineGiftGain})`, 12, '🍷'));
        wineGiftBtn.attribute("title", `Wine stock: ${wineStock}`);
        if (wineStock < wineGiftCost) {
          wineGiftBtn.style("opacity", "0.45").style("cursor", "not-allowed");
        }
        wineGiftBtn.mousePressed(() => {
          const wineEntry = city.inventory?.get("Wine");
          const available = Math.max(0, Number(wineEntry?.quantity) || 0);
          if (available < wineGiftCost) {
            if (typeof notificationManager !== "undefined") notificationManager.log(`Need ${wineGiftCost} Wine for a diplomatic gift.`, "error");
            return;
          }
          wineEntry.quantity -= wineGiftCost;
          if (wineEntry.quantity <= 0) city.inventory.delete("Wine");
          const r = cityManagement.diplomacy.sendWineGift(oc.name, wineGiftCost, day);
          if (!r.ok) city._addOrIncrement("Wine", wineGiftCost);
          if (typeof notificationManager !== "undefined") notificationManager.log(r.msg, r.ok ? "info" : "error");
          _refreshCityMgmtPanel();
        });

        if (!cityManagement.diplomacy.hasPact(oc.name, "trade_pact") && !cityManagement.diplomacy.hasPact(oc.name, "embargo")) {
          const pactBtn = createButton("").addClass("citymgmt-build-btn citymgmt-sm-btn").parent(btns);
          pactBtn.html(cityMgmtLabelHTML('Friendly', 'Trade Pact', 12, '🤝'));
          pactBtn.mousePressed(() => {
            const r = cityManagement.diplomacy.proposePact(oc.name, "trade_pact", day);
            if (typeof notificationManager !== "undefined") notificationManager.log(r.msg, r.ok ? "info" : "error");
            _refreshCityMgmtPanel();
          });
        }

        if (!cityManagement.diplomacy.hasPact(oc.name, "alliance") && score >= 40) {
          const allyBtn = createButton("").addClass("citymgmt-build-btn citymgmt-sm-btn").parent(btns);
          allyBtn.html(cityMgmtLabelHTML('Shield', 'Alliance', 12, '🛡️'));
          allyBtn.mousePressed(() => {
            const r = cityManagement.diplomacy.proposePact(oc.name, "alliance", day);
            if (typeof notificationManager !== "undefined") notificationManager.log(r.msg, r.ok ? "info" : "error");
            _refreshCityMgmtPanel();
          });
        }

        if (!cityManagement.diplomacy.hasPact(oc.name, "embargo")) {
          const embargoBtn = createButton("").addClass("citymgmt-build-btn citymgmt-sm-btn citymgmt-danger-btn").parent(btns);
          embargoBtn.html(cityMgmtLabelHTML('Hostile', 'Embargo', 12, '🚫'));
          embargoBtn.mousePressed(() => {
            const r = cityManagement.diplomacy.proposePact(oc.name, "embargo", day);
            if (typeof notificationManager !== "undefined") notificationManager.log(r.msg, r.ok ? "info" : "error");
            _refreshCityMgmtPanel();
          });
        }

        // Cancel existing pacts
        for (const p of pacts) {
          const cancelBtn = createButton(`Cancel ${p.name}`).addClass("citymgmt-build-btn citymgmt-sm-btn").parent(btns);
          cancelBtn.mousePressed(() => {
            cityManagement.diplomacy.cancelPact(oc.name, p.key);
            _refreshCityMgmtPanel();
          });
        }
      }
    } else {
      createElement("div", "No other cities to negotiate with.").parent(dipBox).style("color", "#aaa");
    }

    // ─── Espionage ────────────────────────────────────
    const spyBox = createDiv().addClass("citymgmt-section").parent(wrap);
    createElement("h3", "").parent(spyBox).html(cityMgmtLabelHTML('Chart', 'Espionage', 16, '🔍'));

    if (typeof cityManagement !== "undefined" && cityManagement.espionage) {
      const esp = cityManagement.espionage;
      const idle = esp.getIdleSpies();
      const deployed = esp.getDeployedSpies();

      createElement("div", `Spies: ${esp.spies.length}/${EspionageSystem.MAX_SPIES} (${idle.length} idle, ${deployed.length} deployed)${esp.counterActive ? ` | ${cityMgmtLabelHTML('Shield', 'Counter-intel active', 12, '🛡️')}` : ""}`)
        .parent(spyBox).style("color", "#c8d6e5").style("font-size", "12px").style("margin-bottom", "6px");

      // Hire button
      if (esp.spies.length < EspionageSystem.MAX_SPIES) {
        const hireBtn = createButton(`Hire Spy (${EspionageSystem.SPY_COST}g)`).addClass("citymgmt-build-btn").parent(spyBox);
        hireBtn.mousePressed(() => {
          if (!city.management || city.management.budget < EspionageSystem.SPY_COST) {
            if (typeof notificationManager !== "undefined") notificationManager.log("Not enough gold.", "error");
            return;
          }
          const r = esp.hireSpy(city.management.budget);
          if (r.ok) city.management.budget -= r.cost;
          if (typeof notificationManager !== "undefined") notificationManager.log(r.msg, r.ok ? "info" : "error");
          _refreshCityMgmtPanel();
        });
      }

      // Idle spies — deploy
      if (idle.length > 0 && otherCities.length > 0) {
        createElement("h3", "").parent(spyBox).html(cityMgmtLabelHTML('Chart', 'Deploy Spy', 16, '🕵️')).style("margin-top", "8px");
        for (const spy of idle) {
          const row = createDiv().addClass("citymgmt-policy-row").parent(spyBox);
          createElement("div", `Spy #${spy.id} — Idle`)
            .parent(row).style("flex", "1").style("color", "#c8d6e5").style("font-size", "12px");

          const controls = createDiv().parent(row).style("display", "flex").style("gap", "4px").style("flex-wrap", "wrap");

          // Mission type select
          const missionSel = document.createElement("select");
          missionSel.className = "citymgmt-input";
          missionSel.style.minWidth = "130px";
          missionSel.style.minHeight = "32px";
          for (const [mk, mdef] of Object.entries(EspionageSystem.MISSION_TYPES)) {
            const opt = document.createElement("option");
            opt.value = mk;
            opt.textContent = mdef.name;
            missionSel.appendChild(opt);
          }
          controls.elt.appendChild(missionSel);

          // Target select (not needed for counterEspionage)
          const targetSel = document.createElement("select");
          targetSel.className = "citymgmt-input";
          targetSel.style.minWidth = "120px";
          targetSel.style.minHeight = "32px";
          for (const oc of otherCities) {
            const opt = document.createElement("option");
            opt.value = oc.name;
            opt.textContent = oc.name;
            targetSel.appendChild(opt);
          }
          controls.elt.appendChild(targetSel);

          const deployBtn = createButton("Deploy").addClass("citymgmt-build-btn citymgmt-sm-btn").parent(controls);
          deployBtn.mousePressed(() => {
            const missionKey = missionSel.value;
            const target = missionKey === "counterEspionage" ? null : targetSel.value;
            const r = esp.deploySpy(spy.id, target, missionKey, day);
            if (typeof notificationManager !== "undefined") notificationManager.log(r.msg, r.ok ? "info" : "error");
            _refreshCityMgmtPanel();
          });

          const dismissBtn = createButton("Dismiss").addClass("citymgmt-build-btn citymgmt-sm-btn citymgmt-danger-btn").parent(controls);
          dismissBtn.mousePressed(() => {
            esp.dismissSpy(spy.id);
            _refreshCityMgmtPanel();
          });
        }
      }

      // Deployed spies status
      if (deployed.length > 0) {
        createElement("h3", "").parent(spyBox).html(cityMgmtLabelHTML('Chart', 'Active Missions', 16, '📋')).style("margin-top", "8px");
        for (const spy of deployed) {
          const mission = EspionageSystem.MISSION_TYPES[spy.mission];
          const daysLeft = spy.returnDay > 0 ? Math.max(0, spy.returnDay - day) : "∞";
          const row = createDiv().addClass("citymgmt-policy-row").parent(spyBox);
          createElement("div", `Spy #${spy.id} — ${cityMgmtIconHTML(mission?.atlasFrame || mission?.name || spy.mission, 12, mission?.emoji || "?")} ${mission?.name || spy.mission} ${spy.targetCity ? "→ " + spy.targetCity : "(guarding)"} — ${daysLeft} days left`)
            .parent(row).style("flex", "1").style("color", "#7ec8e3").style("font-size", "12px");
          if (spy.mission === "counterEspionage") {
            const recallBtn = createButton("Recall").addClass("citymgmt-build-btn citymgmt-sm-btn").parent(row);
            recallBtn.mousePressed(() => { esp.recallSpy(spy.id); _refreshCityMgmtPanel(); });
          }
        }
      }

      // Intel reports
      const intelKeys = Object.keys(esp.intel);
      if (intelKeys.length > 0) {
        createElement("h3", "").parent(spyBox).html(cityMgmtLabelHTML('Chart', 'Intel Reports', 16, '📄')).style("margin-top", "8px");
        for (const cityName of intelKeys) {
          const intel = esp.intel[cityName];
          const row = createDiv().addClass("citymgmt-policy-row").parent(spyBox);
          const info = createDiv().parent(row).style("flex", "1");
          createElement("div", `${cityMgmtIconHTML('Chart', 14, '🔍')} ${cityName} (day ${intel.day})`)
            .parent(info).style("font-weight", "700").style("color", "#d4af37").style("font-size", "12px");
          createElement("div", `Pop: ${intel.population} | Budget: ${intel.budget}g | Military: ${intel.military} units | Rep: ${intel.reputation}`)
            .parent(info).style("font-size", "11px").style("color", "#96a7b9");
          if (intel.topItems && intel.topItems.length > 0) {
            createElement("div", `Top stock: ${intel.topItems.map(i => `${i.name}×${i.qty}`).join(", ")}`)
              .parent(info).style("font-size", "10px").style("color", "#7ec8e3");
          }
        }
      }
    } else {
      createElement("div", "Espionage system unavailable.").parent(spyBox).style("color", "#aaa");
    }
  }

  // ─── Research / Space Program ──────────────────────────────
  function _buildResearchTab(container, city) {
    const wrap = createDiv().addClass("citymgmt-tab-inner").parent(container);
    const state = city.getProgressionState ? city.getProgressionState(player) : null;

    // Research Office header
    const summary = createDiv().addClass("info-stats-box").parent(wrap);
    createElement("h3", "").parent(summary)
      .html(`${cityMgmtIconHTML('Chart', 16, '🛰')} Research Office`)
      .style("color", "#7dc9ff").style("margin", "0 0 8px");

    const stats = createDiv().parent(summary)
      .style("display", "grid").style("grid-template-columns", "1fr 1fr").style("gap", "6px");
    const addStat = (label, value) => {
      const row = createDiv().parent(stats)
        .style("display", "flex").style("justify-content", "space-between")
        .style("background", "#191929").style("padding", "6px 8px").style("border-radius", "6px");
      createSpan(label).parent(row).style("color", "#8ea8c2").style("font-size", "12px");
      createSpan(value).parent(row).style("color", "#fff").style("font-size", "12px").style("font-weight", "bold");
    };
    addStat("Research", `${state?.researchPoints || 0} RP`);
    addStat("Spaceport", city.hasSpaceport ? "Online" : "Offline");
    addStat("Alien Trade", city.hasAlienExchange ? "Active" : "Locked");
    addStat("Planet Visits", `${state?.planetVisits?.length || 0}`);

    createP("Research projects unlock your space economy. Build them in order to reach orbit, contact aliens, and open new markets.")
      .parent(summary).style("color", "#b3c7d8").style("font-size", "12px").style("line-height", "1.6");

    // Project cards
    const projects = city.getProgressionProjects ? city.getProgressionProjects() : [];
    const projectGrid = createDiv().addClass("shop-grid").parent(wrap);

    for (const project of projects) {
      const card = createDiv().addClass("shop-item").parent(projectGrid);
      card.style("border-left", project.completed ? "4px solid #4caf50" : project.canBuy ? "4px solid #7dc9ff" : "4px solid #666");

      const titleRow = createDiv().style("display", "flex").style("align-items", "center").style("gap", "8px").parent(card);
      createElement("span", "").parent(titleRow)
        .html(cityMgmtIconHTML(project.key === 'orbital_program' ? 'sloop' : 'Chart', 18, project.completed ? '✅' : '🛰'));
      createSpan(project.label).style("font-weight", "bold").style("color", "#fff").parent(titleRow);
      createSpan(project.completed ? "Done" : project.canBuy ? "Available" : "Locked")
        .style("margin-left", "auto").style("font-size", "11px")
        .style("color", project.completed ? "#4caf50" : project.canBuy ? "#7dc9ff" : "#888").parent(titleRow);

      createP(project.description)
        .parent(card).style("font-size", "12px").style("color", "#aaa").style("margin", "4px 0");
      createP(`Cost: ${project.researchCost} RP + ${project.goldCost}g`)
        .parent(card).style("font-size", "11px").style("color", "#9bb").style("margin", "2px 0");
      createP(`Unlocks: ${project.unlocks.join(" · ")}`)
        .parent(card).style("font-size", "11px").style("color", "#86a").style("margin", "2px 0");

      const btnRow = createDiv().style("display", "flex").style("gap", "6px").style("flex-wrap", "wrap").parent(card);
      const buyBtn = createButton(project.completed ? "Unlocked" : project.canBuy ? "Research" : "Locked").parent(btnRow);
      buyBtn.addClass(project.completed ? "sell-btn" : project.canBuy ? "buy-btn" : "buy-btn-disabled");
      if (project.completed) {
        buyBtn.attribute("disabled", "true");
      } else if (project.canBuy) {
        buyBtn.mousePressed(() => {
          const res = city.buyResearchProject(project.key, player);
          if (!res.ok) {
            const msg = res.reason === 'insufficient_research' ? "Not enough research points."
              : res.reason === 'insufficient_gold' ? "Not enough gold."
              : res.reason === 'locked' ? "Research is still locked."
              : "Research failed.";
            _notifyCityMgmt(msg, "warning");
          }
          _refreshCityMgmtPanel();
        });
      } else {
        buyBtn.attribute("disabled", "true");
      }
    }

    // Space Program section
    const spaceBox = createDiv().addClass("info-stats-box").parent(wrap);
    createElement("h3", "").parent(spaceBox)
      .html(`${cityMgmtIconHTML('sloop', 16, '🚀')} Space Program`)
      .style("color", "#7dc9ff").style("margin", "0 0 8px");
    createP(city.hasSpaceport
      ? "Your city has a spaceport. Open orbit to travel to planets and meet alien traders."
      : "Complete the Orbital Program to build a spaceport and launch into orbit.")
      .parent(spaceBox).style("color", "#b3c7d8").style("font-size", "12px").style("line-height", "1.6");

    const spaceRow = createDiv().style("display", "flex").style("gap", "8px").style("flex-wrap", "wrap").parent(spaceBox);
    const launchBtn = createButton(city.hasSpaceport ? "Open Orbit" : "Space Locked").parent(spaceRow);
    launchBtn.addClass(city.hasSpaceport ? "buy-btn" : "buy-btn-disabled");
    if (city.hasSpaceport) {
      launchBtn.mousePressed(() => {
        const result = (typeof window.BQLaunchToSpaceFromCity === 'function')
          ? window.BQLaunchToSpaceFromCity(city, { destination: 'orbit', returnState: GameStates.CITY_MANAGE })
          : { ok: false, reason: 'launch_unavailable' };
        if (!result?.ok && typeof notificationManager !== 'undefined') {
          notificationManager.log(`Launch failed: ${result?.reason || 'unknown'}`, 'warning');
        }
      });
    } else {
      launchBtn.attribute("disabled", "true");
    }

  }

})();
