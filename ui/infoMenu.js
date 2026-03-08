// INFO MENU (main-menu subpage)
(function initInfoMenu() {
  const INFO_KEY = "bq_info_stats_v1";
  const MAX_WINS = 50;

  function _defaultStats() {
    return {
      highScore: 0,
      bestDays: null,
      wins: [],
      lastVictory: null,
    };
  }

  function _loadStats() {
    try {
      const raw = localStorage.getItem(INFO_KEY);
      if (!raw) return _defaultStats();
      const parsed = JSON.parse(raw);
      const base = _defaultStats();
      return {
        highScore: Number(parsed.highScore) || 0,
        bestDays: parsed.bestDays == null ? null : Number(parsed.bestDays),
        wins: Array.isArray(parsed.wins) ? parsed.wins : [],
        lastVictory: parsed.lastVictory || null,
        ...base,
        ...parsed,
      };
    } catch (_e) {
      return _defaultStats();
    }
  }

  function _saveStats(stats) {
    try {
      localStorage.setItem(INFO_KEY, JSON.stringify(stats));
    } catch (_e) {
      // ignore storage failures
    }
  }

  function _recordWinFromRuntime() {
    if (typeof player === "undefined" || !player) return;
    const target = Number(window._newGameGoldTarget) || 5000;
    const days = (typeof dayNight !== "undefined" && dayNight && typeof dayNight.getDaysElapsed === "function")
      ? dayNight.getDaysElapsed()
      : null;
    const totalAssets = (typeof player.getTotalAssets === "function")
      ? Number(player.getTotalAssets(true) || 0)
      : Number(player.gold || 0);
    const signature = `${totalAssets}|${days}|${target}|${window._mapSeed || 0}`;
    if (window._bqLastVictorySignature === signature) return; // avoid duplicate inserts
    window._bqLastVictorySignature = signature;

    const stats = _loadStats();
    const entry = {
      ts: Date.now(),
      date: new Date().toISOString(),
      assets: totalAssets,
      days: days,
      target: target,
      difficulty: window._newGameDifficulty || "normal",
      map: `${window._newGameMapCols || "?"}x${window._newGameMapRows || "?"}`,
    };
    stats.wins.unshift(entry);
    if (stats.wins.length > MAX_WINS) stats.wins.length = MAX_WINS;
    stats.highScore = Math.max(Number(stats.highScore) || 0, totalAssets);
    if (typeof days === "number" && days >= 0) {
      stats.bestDays = (stats.bestDays == null) ? days : Math.min(Number(stats.bestDays) || days, days);
    }
    stats.lastVictory = entry.date;
    _saveStats(stats);
  }

  function _fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString();
    } catch (_e) {
      return String(iso || "");
    }
  }

  function _buildQuestionHTML() {
    return [
      { q: "How do I win?", a: "Reach your gold target (plus city value) before the day limit if enabled." },
      { q: "What counts as high score?", a: "Highest total assets seen on a winning run." },
      { q: "Can I inspect my current world?", a: "Use Open World Viewer to load the minimap world page." },
      { q: "Are books different from items?", a: "Yes. Books are listed separately and typically scale by goal percent." },
    ].map(pair =>
      `<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08)">` +
      `<div style="color:#d4af37;font-weight:700">${pair.q}</div>` +
      `<div style="color:#c8d6e5">${pair.a}</div>` +
      `</div>`
    ).join("");
  }

  function _itemRows({ booksOnly }) {
    if (typeof ItemLibrary === "undefined" || !ItemLibrary) {
      return `<div style="color:#aaa">Item library unavailable.</div>`;
    }
    const keys = Object.keys(ItemLibrary);
    const filtered = keys.filter((k) => {
      const it = ItemLibrary[k];
      const isBook = !!(it && it.tags && typeof it.tags.has === "function" && it.tags.has("book"));
      return booksOnly ? isBook : !isBook;
    });
    if (filtered.length === 0) return `<div style="color:#aaa">No entries found.</div>`;
    filtered.sort((a, b) => {
      const an = ItemLibrary[a]?.name || a;
      const bn = ItemLibrary[b]?.name || b;
      return an.localeCompare(bn);
    });
    return filtered.map((k) => {
      const it = ItemLibrary[k];
      const base = Number(it.baseValue || 0);
      const rar = Number(it.rarity || 1);
      const cat = it.category || "Misc";
      return `<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06)">` +
        `<span style="color:#e8e8e8">${it.name}</span>` +
        `<span style="color:#a9bbcf">${cat}</span>` +
        `<span style="color:#7ec8e3">${base}g</span>` +
        `<span style="color:#a5d6a7">r${rar.toFixed(2)}</span>` +
      `</div>`;
    }).join("");
  }

  function _renderTab(tab) {
    const host = document.getElementById("infoContent");
    if (!host) return;
    const stats = _loadStats();

    if (tab === "wins") {
      const wins = Array.isArray(stats.wins) ? stats.wins : [];
      if (wins.length === 0) {
        host.innerHTML = `<div style="color:#aaa">No wins recorded yet.</div>`;
        return;
      }
      host.innerHTML = wins.map((w, i) =>
        `<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08)">` +
        `<div style="color:#d4af37">#${i + 1} • ${_fmtDate(w.date)}</div>` +
        `<div style="color:#c8d6e5">Assets: ${Number(w.assets || 0).toLocaleString()}g • Days: ${w.days ?? "?"} • Target: ${Number(w.target || 0).toLocaleString()}g</div>` +
        `<div style="color:#96a7b9">Difficulty: ${w.difficulty || "normal"} • Map: ${w.map || "?"}</div>` +
      `</div>`
      ).join("");
      return;
    }

    if (tab === "score") {
      host.innerHTML =
        `<div style="padding:8px 0;color:#c8d6e5">High Score: <span style="color:#ffd700;font-weight:700">${Number(stats.highScore || 0).toLocaleString()}g</span></div>` +
        `<div style="padding:8px 0;color:#c8d6e5">Best Win Days: <span style="color:#7ec8e3;font-weight:700">${stats.bestDays == null ? "N/A" : stats.bestDays}</span></div>` +
        `<div style="padding:8px 0;color:#96a7b9">Last Victory: ${stats.lastVictory ? _fmtDate(stats.lastVictory) : "N/A"}</div>`;
      return;
    }

    if (tab === "items") {
      host.innerHTML = _itemRows({ booksOnly: false });
      return;
    }

    if (tab === "books") {
      host.innerHTML = _itemRows({ booksOnly: true });
      return;
    }

    host.innerHTML = _buildQuestionHTML();
  }

  function _setActiveTab(tab) {
    document.querySelectorAll("[data-info-tab]").forEach((el) => {
      const active = el.getAttribute("data-info-tab") === tab;
      el.style.background = active ? "#2a3b4f" : "#1a2a3a";
      el.style.color = active ? "#eaf7ff" : "#9fb4c7";
      el.style.borderColor = active ? "#5c93b8" : "#2f4960";
    });
    _renderTab(tab);
  }

  window.BQInfo = {
    loadStats: _loadStats,
    saveStats: _saveStats,
    recordWinFromRuntime: _recordWinFromRuntime,
  };

  uiManager.registerScreen("infoMenu", {
    validStates: [GameStates.INFO],

    create: () => {
      const wrapper = createDiv().id("infoMenu").class("screen");
      createElement("h1", "Info").parent(wrapper).class("main-title");
      createElement("div", "Win history, scores, items, books, and help")
        .parent(wrapper)
        .addClass("menu-subtitle");

      const actions = createDiv().parent(wrapper)
        .style("display", "flex")
        .style("gap", "8px")
        .style("justify-content", "center")
        .style("margin", "8px 0 14px");

      createButton("Open World Viewer")
        .parent(actions)
        .addClass("menu-btn")
        .mousePressed(() => {
          try {
            if (typeof SaveSystem !== "undefined" && worldInitialized) SaveSystem.save({ silent: true });
          } catch (_e) {
            // continue regardless
          }
          window.location.href = "minimap-background.html";
        });

      const tabs = createDiv().parent(wrapper)
        .style("display", "flex")
        .style("gap", "6px")
        .style("justify-content", "center")
        .style("flex-wrap", "wrap")
        .style("margin-bottom", "10px");

      const tabDefs = [
        { key: "wins", label: "Win History" },
        { key: "score", label: "High Score" },
        { key: "items", label: "Items" },
        { key: "books", label: "Books" },
        { key: "questions", label: "Questions" },
      ];
      for (const t of tabDefs) {
        const btn = createButton(t.label).parent(tabs);
        btn.attribute("data-info-tab", t.key);
        btn.addClass("menu-btn");
        btn.style("padding", "7px 12px");
        btn.style("font-size", "13px");
        btn.style("min-width", "120px");
        btn.mousePressed(() => _setActiveTab(t.key));
      }

      createDiv()
        .id("infoContent")
        .parent(wrapper)
        .style("max-width", "760px")
        .style("margin", "0 auto")
        .style("height", "46vh")
        .style("overflow-y", "auto")
        .style("padding", "8px 16px")
        .style("background", "rgba(12,16,24,0.72)")
        .style("border", "1px solid rgba(126,200,227,0.24)")
        .style("border-radius", "8px")
        .style("text-align", "left");

      const bottom = createDiv().parent(wrapper)
        .style("margin-top", "14px");
      createButton("Back")
        .parent(bottom)
        .addClass("menu-btn")
        .mousePressed(() => gameStateManager.setState(GameStates.MAIN_MENU));

      return wrapper;
    },

    show: () => {
      const m = select("#infoMenu");
      if (m) m.addClass("screen-visible");
      _setActiveTab("wins");
    },

    hide: () => {
      const m = select("#infoMenu");
      if (m) m.removeClass("screen-visible");
    },
  });
})();
