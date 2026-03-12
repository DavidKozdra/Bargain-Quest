// INFO MENU (main-menu subpage)
(function initInfoMenu() {
  const INFO_KEY = "bq_info_stats_v1";
  const MAX_WINS = 50;
  const INFO_TAB_DEFS = [
    { key: "wins", label: "Win History" },
    { key: "score", label: "High Score" },
    { key: "items", label: "Items" },
    { key: "books", label: "Books" },
    { key: "questions", label: "Questions" },
  ];
  const INFO_DEFAULT_TAB = "wins";

  const _uiState = {
    items: { search: "", category: "all", sort: "name", selectedKey: null },
    books: { search: "", category: "all", sort: "name", selectedKey: null },
  };

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
      const merged = {
        ..._defaultStats(),
        ...(parsed && typeof parsed === "object" ? parsed : {}),
      };
      return {
        highScore: Number(merged.highScore) || 0,
        bestDays: merged.bestDays == null ? null : Number(merged.bestDays),
        wins: Array.isArray(merged.wins) ? merged.wins : [],
        lastVictory: merged.lastVictory || null,
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
    if (window._bqLastVictorySignature === signature) return;
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
      seed: (typeof window._mapSeed === "number" && Number.isFinite(window._mapSeed))
        ? window._mapSeed
        : null,
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
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso || "");
    return d.toLocaleString();
  }

  function _fmtGold(value) {
    const n = Number(value || 0);
    return `${n.toLocaleString()}g`;
  }

  function _getTutorialSource() {
    if (typeof tutorialSystem !== "undefined" && tutorialSystem && Array.isArray(tutorialSystem.allSteps)) {
      return tutorialSystem;
    }
    const TutorialCtor =
      window.BQAdapters?.tutorialSystem?.TutorialSystem ||
      window.TutorialSystem;
    if (typeof TutorialCtor === "function") {
      try { return new TutorialCtor(); } catch (_e) { return null; }
    }
    return null;
  }

  function _buildQuestionHTMLFromTutorial() {
    const src = _getTutorialSource();
    // Show only guidePages (comprehensive reference) — contextTips are abbreviated
    // in-game reminders that duplicate guide content and clutter the FAQ.
    const steps = src && Array.isArray(src.guidePages) ? src.guidePages
      : (src && Array.isArray(src.allSteps) ? src.allSteps : []);
    if (steps.length === 0) return `<div style="color:#aaa">Guide data unavailable.</div>`;
    return steps.map((step) =>
      `<div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08)">` +
      `<span style="width:20px;flex:0 0 20px">${step.icon || "•"}</span>` +
      `<div>` +
      `<div style="color:#d4af37;font-weight:700">${step.title || "Guide"}</div>` +
      `<div style="color:#c8d6e5;white-space:pre-wrap">${step.text || ""}</div>` +
      `</div>` +
      `</div>`
    ).join("");
  }

  function _isBookItem(item) {
    return !!(item && item.tags && typeof item.tags.has === "function" && item.tags.has("book"));
  }

  function _compendiumEntries({ booksOnly }) {
    if (typeof ItemLibrary === "undefined" || !ItemLibrary) return [];
    const out = [];
    for (const [key, item] of Object.entries(ItemLibrary)) {
      if (!item) continue;
      const isBook = _isBookItem(item);
      if (booksOnly ? !isBook : isBook) continue;
      out.push({
        key,
        item,
        name: item.name || key,
        category: item.category || "Misc",
        value: Number(item.baseValue || 0),
        weight: Number(item.weight || 0),
        rarity: Number(item.rarity || 1),
        isBook,
      });
    }
    return out;
  }

  function _appendIcon(hostEl, itemKey, size) {
    if (!hostEl) return;
    if (typeof createItemIconEl === "function") {
      const el = createItemIconEl(itemKey, size);
      if (el) {
        el.classList.add("info-item-icon");
        hostEl.appendChild(el);
        return;
      }
    }
    if (typeof atlasIconHTML === "function") {
      hostEl.innerHTML = atlasIconHTML(itemKey, size, "📦");
      const img = hostEl.querySelector("img");
      if (img) img.classList.add("info-item-icon");
      return;
    }
    hostEl.textContent = "📦";
  }

  function _bookEffectsSummary(itemKey) {
    const map = {
      MarketAnalysis: ["City-by-city prices and trends", "Compare stock, buy/sell values, and history"],
      HolidaysBook: ["City holiday calendar", "Shows active and upcoming boosts/discounts"],
      NegotiationForDummies: ["Better buy/sell deals in markets"],
      ConflictResolution: ["Cheaper bribes", "Longer protection after paying raiders"],
      TreasureHunter: ["Higher treasure payout when digging"],
      SeaLegs: ["Board and disembark from coastline without port lock"],
      Pirating101: ["Unlock raid options against trader boats"],
    };
    return map[itemKey] || ["Passive bonus while carried in inventory"];
  }

  function _rarityInfo(rarity) {
    const r = Number(rarity || 0);
    if (r >= 4.5) return { label: "Mythic", className: "rarity-mythic", color: "#ff75b5" };
    if (r >= 3.0) return { label: "Legendary", className: "rarity-legendary", color: "#f6b73c" };
    if (r >= 2.0) return { label: "Rare", className: "rarity-rare", color: "#6ab0ff" };
    if (r >= 1.2) return { label: "Uncommon", className: "rarity-uncommon", color: "#67d887" };
    return { label: "Common", className: "rarity-common", color: "#b8c2cd" };
  }

  function _entryLore(entry) {
    const item = entry.item || {};
    const tags = (item.tags && typeof item.tags.forEach === "function") ? [...item.tags] : [];
    const fromTag = {
      crafted: "Master-crafted by local guild artisans.",
      contraband: "Whispered about in smuggler coves and back-alley markets.",
      treasure: "Recovered from ruins, shipwrecks, or forgotten vaults.",
      book: "Collected as a specialist manual for expert traders.",
      weapon: "Favored by captains who expect trouble on the route.",
      bag: "Designed for long hauls where capacity is profit.",
      cursed: "Merchants pass this hand to hand with unease.",
      illegal: "Possession carries risk in tightly governed ports.",
      forest: "Often sourced from deep woodland settlements.",
      water: "Its supply depends on harbors, fisheries, and tides.",
      rock: "Mined and traded through heavy overland caravans.",
      grass: "Linked to fertile plains and growing seasons.",
      snow: "Most sought after when winter trade routes open.",
    };
    const tagLine = tags.map((t) => fromTag[t]).find(Boolean) || "";
    const seasonLine = (item.seasonality && item.seasonality.length)
      ? `${entry.name} peaks in ${item.seasonality.join(", ")}.`
      : "";
    const rarity = _rarityInfo(entry.rarity).label.toLowerCase();
    const base = `${entry.name} is a ${rarity} ${entry.category.toLowerCase()} commodity with a base value of ${entry.value}g.`;
    return [base, tagLine, seasonLine].filter(Boolean).join(" ");
  }

  function _buildMarketTips(entry, allEntries) {
    const tips = [];
    const valuePerKg = entry.weight > 0 ? entry.value / entry.weight : entry.value;
    if (valuePerKg >= 40) tips.push(`High value density (${valuePerKg.toFixed(1)}g/kg). Great for tight cargo space.`);
    else if (valuePerKg <= 6) tips.push(`Low value density (${valuePerKg.toFixed(1)}g/kg). Move only if you have spare capacity.`);
    else tips.push(`Balanced haul efficiency at ${valuePerKg.toFixed(1)}g/kg.`);

    const sortedByValue = [...allEntries].sort((a, b) => b.value - a.value);
    const rank = Math.max(1, sortedByValue.findIndex((e) => e.key === entry.key) + 1);
    tips.push(`Value rank: #${rank} of ${Math.max(1, allEntries.length)} catalog entries.`);

    if (entry.item.perishable) tips.push("Perishable: prioritize short routes and quick turnover.");
    if (entry.item.tradable === false) tips.push("Usually cannot be sold in standard market stalls.");

    if (typeof dayNight !== "undefined" && dayNight && typeof dayNight.getSeason === "function") {
      const nowSeason = dayNight.getSeason();
      if (entry.item.seasonality && entry.item.seasonality.includes(nowSeason)) {
        tips.push(`In-season now (${nowSeason}): expect stronger demand.`);
      } else if (entry.item.seasonality && entry.item.seasonality.length) {
        tips.push(`Not in-season now (${nowSeason}); peak seasons: ${entry.item.seasonality.join(", ")}.`);
      }
    }

    if (typeof cities !== "undefined" && Array.isArray(cities) && cities.length > 1) {
      try {
        const prices = [];
        for (const c of cities) {
          if (!c || typeof c.calculateItemPrice !== "function") continue;
          prices.push({ city: c.name || "City", price: Number(c.calculateItemPrice(entry.key, cities, false) || 0) });
        }
        if (prices.length >= 2) {
          prices.sort((a, b) => a.price - b.price);
          const low = prices[0];
          const high = prices[prices.length - 1];
          const spread = Math.max(0, high.price - low.price);
          tips.push(`Current buy spread: ${spread}g (${low.city} ${low.price}g → ${high.city} ${high.price}g).`);
        }
      } catch (_e) {
        // ignore city price failures in menu context
      }
    }
    return tips;
  }

  function _renderBookPreview(entry, host) {
    if (!entry || !host) return;
    const key = entry.key;
    const box = document.createElement("div");
    box.className = "info-book-preview";
    host.appendChild(box);

    const title = document.createElement("div");
    title.className = "info-book-preview-title";
    title.textContent = "Interactive Preview";
    box.appendChild(title);

    const body = document.createElement("div");
    body.className = "info-book-preview-body";
    box.appendChild(body);

    const mkLine = (label, value, cls = "") => {
      const row = document.createElement("div");
      row.className = "info-preview-line";
      row.innerHTML = `<span>${label}</span><span class="${cls}">${value}</span>`;
      body.appendChild(row);
    };

    if (key === "MarketAnalysis") {
      const nonBooks = _compendiumEntries({ booksOnly: false });
      const spreadRows = [];
      if (typeof cities !== "undefined" && Array.isArray(cities) && cities.length > 1) {
        for (const e of nonBooks) {
          try {
            const prices = cities
              .filter((c) => c && typeof c.calculateItemPrice === "function")
              .map((c) => Number(c.calculateItemPrice(e.key, cities, false) || 0));
            if (prices.length < 2) continue;
            const min = Math.min(...prices);
            const max = Math.max(...prices);
            spreadRows.push({ name: e.name, spread: max - min, min, max });
          } catch (_e) {
            // ignore single failures
          }
        }
      }
      spreadRows.sort((a, b) => b.spread - a.spread);
      const top = spreadRows.slice(0, 3);
      if (!top.length) {
        body.innerHTML = `<div class="info-preview-empty">Start a run to compute live city spreads.</div>`;
      } else {
        for (const r of top) mkLine(r.name, `${r.spread}g spread (${r.min}-${r.max}g)`, "info-preview-good");
      }
      return;
    }

    if (key === "HolidaysBook") {
      let best = null;
      if (typeof cities !== "undefined" && Array.isArray(cities) && typeof dayNight !== "undefined" && dayNight) {
        const day = Number(dayNight.getDaysElapsed ? dayNight.getDaysElapsed() : 0) % 100;
        for (const city of cities) {
          const hols = [...(city.holidays || []), ...(city.bookHolidays || [])];
          for (const h of hols) {
            let d = Number(h.day || 0) - day;
            if (d < 0) d += 100;
            if (!best || d < best.days) best = { city: city.name || "City", holiday: h.name || "Festival", days: d };
          }
        }
      }
      if (!best) body.innerHTML = `<div class="info-preview-empty">No upcoming holiday data found.</div>`;
      else {
        mkLine("Next Festival", best.holiday, "info-preview-good");
        mkLine("Location", best.city);
        mkLine("Starts In", `${best.days} day${best.days === 1 ? "" : "s"}`);
      }
      return;
    }

    if (key === "NegotiationForDummies") {
      const discount = (typeof player !== "undefined" && player && player.modifiers?.negotiationDiscount != null)
        ? player.modifiers.negotiationDiscount
        : 0.05;
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "20";
      slider.max = "500";
      slider.value = "140";
      slider.className = "info-preview-range";
      body.appendChild(slider);

      const out = document.createElement("div");
      out.className = "info-preview-calc";
      body.appendChild(out);

      const repaint = () => {
        const base = Number(slider.value || 0);
        const buy = Math.floor(base * (1 - discount));
        const sell = Math.ceil(base * 0.8 * (1 + discount));
        out.innerHTML = `List ${base}g → Buy <b>${buy}g</b> / Sell <b>${sell}g</b>`;
      };
      slider.addEventListener("input", repaint);
      repaint();
      return;
    }

    if (key === "ConflictResolution") {
      const reduction = (typeof player !== "undefined" && player && player.modifiers?.bribeCostReduction != null)
        ? player.modifiers.bribeCostReduction
        : 0.15;
      const bonus = (typeof player !== "undefined" && player && player.modifiers?.bribeCooldownBonus != null)
        ? player.modifiers.bribeCooldownBonus
        : 2;
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "80";
      slider.max = "1600";
      slider.value = "500";
      slider.className = "info-preview-range";
      body.appendChild(slider);

      const out = document.createElement("div");
      out.className = "info-preview-calc";
      body.appendChild(out);

      const repaint = () => {
        const base = Number(slider.value || 0);
        const finalCost = Math.floor(base * (1 - reduction));
        out.innerHTML = `Bribe ${base}g → <b>${finalCost}g</b> • Protection: <b>${3 + bonus} days</b>`;
      };
      slider.addEventListener("input", repaint);
      repaint();
      return;
    }

    if (key === "TreasureHunter") {
      const bonus = (typeof player !== "undefined" && player && player.modifiers?.treasureValueBonus != null)
        ? player.modifiers.treasureValueBonus
        : 0.10;
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "50";
      slider.max = "2500";
      slider.value = "600";
      slider.className = "info-preview-range";
      body.appendChild(slider);

      const out = document.createElement("div");
      out.className = "info-preview-calc";
      body.appendChild(out);

      const repaint = () => {
        const base = Number(slider.value || 0);
        const finalGold = Math.floor(base * (1 + bonus));
        out.innerHTML = `Dig value ${base}g → <b>${finalGold}g</b> (+${Math.round(bonus * 100)}%)`;
      };
      slider.addEventListener("input", repaint);
      repaint();
      return;
    }

    if (key === "SeaLegs") {
      const states = ["Port", "Coastline", "Open Sea"];
      let idx = 0;
      const btn = document.createElement("button");
      btn.className = "info-preview-toggle";
      body.appendChild(btn);
      const result = document.createElement("div");
      result.className = "info-preview-calc";
      body.appendChild(result);
      const repaint = () => {
        const s = states[idx];
        btn.textContent = `Location: ${s} (switch)`;
        const seaLegsOn = (typeof player !== "undefined" && player && player.modifiers)
          ? !!player.modifiers.seaLegs
          : true;
        const allowed = seaLegsOn ? (s !== "Open Sea") : (s === "Port");
        result.innerHTML = allowed
          ? `<b>Can disembark here.</b>`
          : `<b>Cannot disembark here.</b> Needs port access.`;
      };
      btn.onclick = () => { idx = (idx + 1) % states.length; repaint(); };
      repaint();
      return;
    }

    if (key === "Pirating101") {
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "50";
      slider.max = "1200";
      slider.value = "300";
      slider.className = "info-preview-range";
      body.appendChild(slider);
      const out = document.createElement("div");
      out.className = "info-preview-calc";
      body.appendChild(out);
      const repaint = () => {
        const cargoValue = Number(slider.value || 0);
        const expected = Math.floor(cargoValue * 0.35);
        out.innerHTML = `Target cargo ${cargoValue}g • Estimated post-fight gain: <b>${expected}g</b>`;
      };
      slider.addEventListener("input", repaint);
      repaint();
      return;
    }

    body.innerHTML = `<div class="info-preview-empty">Preview unavailable for this book.</div>`;
  }

  function _showBookFallback(bookKey) {
    const item = ItemLibrary && ItemLibrary[bookKey];
    if (!item) return;

    const existing = document.getElementById("bookPopupOverlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "bookPopupOverlay";
    Object.assign(overlay.style, {
      position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh",
      background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: "9999",
    });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

    const modal = document.createElement("div");
    Object.assign(modal.style, {
      width: "620px", maxWidth: "92vw", maxHeight: "80vh", overflowY: "auto",
      background: "#111724", border: "1px solid rgba(126,200,227,0.32)", borderRadius: "12px",
      padding: "16px", color: "#dbe8f5",
    });

    const top = document.createElement("div");
    Object.assign(top.style, { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" });

    const titleWrap = document.createElement("div");
    Object.assign(titleWrap.style, { display: "flex", alignItems: "center", gap: "10px" });

    const icon = document.createElement("div");
    _appendIcon(icon, bookKey, 30);
    titleWrap.appendChild(icon);

    const title = document.createElement("h2");
    title.textContent = item.name || bookKey;
    Object.assign(title.style, { margin: "0", fontSize: "18px", color: "#d4af37" });
    titleWrap.appendChild(title);

    const close = document.createElement("button");
    close.textContent = "Close";
    close.className = "menu-btn";
    close.style.padding = "4px 10px";
    close.style.fontSize = "12px";
    close.onclick = () => overlay.remove();

    top.appendChild(titleWrap);
    top.appendChild(close);

    const desc = document.createElement("p");
    desc.textContent = item.bookDescription || item.description || "No description.";
    Object.assign(desc.style, { color: "#b8c9da", lineHeight: "1.5" });

    const hint = document.createElement("div");
    hint.innerHTML = `<b>Book Effects</b><br>${_bookEffectsSummary(bookKey).join("<br>")}`;
    Object.assign(hint.style, {
      background: "rgba(78, 205, 196, 0.08)", border: "1px solid rgba(78,205,196,0.25)",
      borderRadius: "8px", padding: "10px", fontSize: "13px", lineHeight: "1.55", color: "#d0e2f0",
    });

    const note = document.createElement("div");
    note.textContent = "Full interactive book pages are available during an active run (when world/player systems are loaded).";
    Object.assign(note.style, { marginTop: "10px", color: "#8ca5bf", fontSize: "12px" });

    modal.appendChild(top);
    modal.appendChild(desc);
    modal.appendChild(hint);
    modal.appendChild(note);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  function _canOpenRuntimeBook(bookKey) {
    if (typeof openBookPopup !== "function") return false;
    if (bookKey === "MarketAnalysis" || bookKey === "HolidaysBook") return true;
    return typeof player !== "undefined" && !!player;
  }

  function _readBookFromInfo(bookKey) {
    if (_canOpenRuntimeBook(bookKey)) {
      try {
        openBookPopup(bookKey);
        return;
      } catch (_e) {
        // fall through
      }
    }
    _showBookFallback(bookKey);
  }

  function _compendiumStats(entries) {
    if (!entries.length) {
      return {
        total: 0,
        avgValue: 0,
        topValue: null,
        topWeight: null,
        categories: 0,
      };
    }
    const totalValue = entries.reduce((sum, e) => sum + e.value, 0);
    const topValue = [...entries].sort((a, b) => b.value - a.value)[0] || null;
    const topWeight = [...entries].sort((a, b) => b.weight - a.weight)[0] || null;
    const categorySet = new Set(entries.map((e) => e.category));
    return {
      total: entries.length,
      avgValue: Math.round(totalValue / Math.max(1, entries.length)),
      topValue,
      topWeight,
      categories: categorySet.size,
    };
  }

  function _renderCompendiumTab({ tabKey, booksOnly }) {
    const host = document.getElementById(`infoTab_${tabKey}`);
    if (!host) return;

    const tabState = _uiState[tabKey];
    const allEntries = _compendiumEntries({ booksOnly });
    const categories = ["all", ...new Set(allEntries.map((e) => e.category).sort((a, b) => a.localeCompare(b)))];

    host.innerHTML = "";

    const stats = _compendiumStats(allEntries);
    const statsStrip = document.createElement("div");
    statsStrip.className = "info-stat-strip";
    statsStrip.innerHTML =
      `<div class="info-stat-card"><div class="info-stat-label">Entries</div><div class="info-stat-value">${stats.total}</div></div>` +
      `<div class="info-stat-card"><div class="info-stat-label">Categories</div><div class="info-stat-value">${stats.categories}</div></div>` +
      `<div class="info-stat-card"><div class="info-stat-label">Avg Value</div><div class="info-stat-value">${stats.avgValue.toLocaleString()}g</div></div>` +
      `<div class="info-stat-card"><div class="info-stat-label">Most Valuable</div><div class="info-stat-value">${stats.topValue ? stats.topValue.name : "-"}</div></div>`;
    host.appendChild(statsStrip);

    const shell = document.createElement("div");
    shell.className = "info-comp-shell";
    host.appendChild(shell);

    const left = document.createElement("div");
    left.className = "info-comp-left";
    shell.appendChild(left);

    const right = document.createElement("div");
    right.className = "info-comp-right";
    shell.appendChild(right);

    const controls = document.createElement("div");
    controls.className = "info-comp-controls";
    left.appendChild(controls);

    const search = document.createElement("input");
    search.type = "text";
    search.value = tabState.search;
    search.placeholder = booksOnly ? "Search books..." : "Search items...";
    search.className = "info-comp-search";
    controls.appendChild(search);

    const catSel = document.createElement("select");
    catSel.className = "info-comp-select";
    for (const c of categories) {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c === "all" ? "All Categories" : c;
      if (tabState.category === c) opt.selected = true;
      catSel.appendChild(opt);
    }
    controls.appendChild(catSel);

    const sortSel = document.createElement("select");
    sortSel.className = "info-comp-select";
    const sorts = [
      ["name", "Name A-Z"],
      ["value", "Value High-Low"],
      ["rarity", "Rarity High-Low"],
      ["weight", "Weight High-Low"],
    ];
    for (const [k, label] of sorts) {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = label;
      if (tabState.sort === k) opt.selected = true;
      sortSel.appendChild(opt);
    }
    controls.appendChild(sortSel);

    const list = document.createElement("div");
    list.className = "info-comp-list";
    left.appendChild(list);

    function _filteredEntries() {
      const q = tabState.search.trim().toLowerCase();
      const filtered = allEntries.filter((e) => {
        if (tabState.category !== "all" && e.category !== tabState.category) return false;
        if (!q) return true;
        const tags = (e.item.tags && typeof e.item.tags.forEach === "function")
          ? [...e.item.tags].join(" ").toLowerCase()
          : "";
        return e.name.toLowerCase().includes(q)
          || e.key.toLowerCase().includes(q)
          || e.category.toLowerCase().includes(q)
          || tags.includes(q);
      });

      if (tabState.sort === "value") filtered.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
      else if (tabState.sort === "rarity") filtered.sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
      else if (tabState.sort === "weight") filtered.sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
      else filtered.sort((a, b) => a.name.localeCompare(b.name));
      return filtered;
    }

    function _renderDetail(entry) {
      right.innerHTML = "";

      if (!entry) {
        right.innerHTML = `<div class="info-empty">No entries match current filters.</div>`;
        return;
      }

      const hero = document.createElement("div");
      hero.className = "info-item-hero";

      const iconWrap = document.createElement("div");
      iconWrap.className = "info-item-hero-icon";
      _appendIcon(iconWrap, entry.key, 40);
      hero.appendChild(iconWrap);

      const textWrap = document.createElement("div");
      const title = document.createElement("h3");
      title.className = "info-item-title";
      title.textContent = entry.name;
      textWrap.appendChild(title);

      const rarityInfo = _rarityInfo(entry.rarity);
      const rarityLabel = document.createElement("div");
      rarityLabel.className = `info-rarity-badge ${rarityInfo.className}`;
      rarityLabel.textContent = `${rarityInfo.label} • r${entry.rarity.toFixed(2)}`;
      textWrap.appendChild(rarityLabel);

      const keyMeta = document.createElement("div");
      keyMeta.className = "info-item-key";
      keyMeta.textContent = entry.key;
      textWrap.appendChild(keyMeta);

      const chips = document.createElement("div");
      chips.className = "info-item-chips";
      const chipVals = [entry.category, `${entry.value.toLocaleString()}g`, `${entry.weight}kg`];
      for (const v of chipVals) {
        const chip = document.createElement("span");
        chip.className = "info-item-chip";
        chip.textContent = v;
        chips.appendChild(chip);
      }
      textWrap.appendChild(chips);

      hero.appendChild(textWrap);
      right.appendChild(hero);

      const desc = document.createElement("p");
      desc.className = "info-item-desc";
      desc.textContent = entry.item.bookDescription || entry.item.description || "No description available.";
      right.appendChild(desc);

      const lore = document.createElement("div");
      lore.className = "info-lore";
      lore.innerHTML = `<div class="info-lore-title">Lore</div><div>${_entryLore(entry)}</div>`;
      right.appendChild(lore);

      const detailGrid = document.createElement("div");
      detailGrid.className = "info-detail-grid";
      const fields = [
        ["Tradable", entry.item.tradable === false ? "No" : "Yes"],
        ["Seasonality", (entry.item.seasonality && entry.item.seasonality.length) ? entry.item.seasonality.join(", ") : "None"],
        ["Weight Class", entry.weight >= 4 ? "Heavy" : (entry.weight >= 2 ? "Medium" : "Light")],
      ];
      for (const [k, v] of fields) {
        const cell = document.createElement("div");
        cell.className = "info-detail-cell";
        cell.innerHTML = `<div class="info-detail-k">${k}</div><div class="info-detail-v">${v}</div>`;
        detailGrid.appendChild(cell);
      }
      right.appendChild(detailGrid);

      const tags = (entry.item.tags && typeof entry.item.tags.forEach === "function") ? [...entry.item.tags] : [];
      if (tags.length) {
        const tagsBox = document.createElement("div");
        tagsBox.className = "info-tags";
        for (const t of tags) {
          const tg = document.createElement("span");
          tg.className = "info-tag";
          tg.textContent = t;
          tagsBox.appendChild(tg);
        }
        right.appendChild(tagsBox);
      }

      const tips = _buildMarketTips(entry, allEntries);
      if (tips.length) {
        const tipsBox = document.createElement("div");
        tipsBox.className = "info-market-tips";
        const lines = tips.map((t) => `<li>${t}</li>`).join("");
        tipsBox.innerHTML = `<div class="info-market-title">Dynamic Market Tips</div><ul>${lines}</ul>`;
        right.appendChild(tipsBox);
      }

      if (booksOnly) {
        const effect = document.createElement("div");
        effect.className = "info-book-effects";
        const lines = _bookEffectsSummary(entry.key).map((l) => `<li>${l}</li>`).join("");
        effect.innerHTML = `<div class="info-book-effects-title">Book Effects</div><ul>${lines}</ul>`;
        right.appendChild(effect);

        const readBtn = document.createElement("button");
        readBtn.className = "menu-btn info-read-btn";
        readBtn.textContent = "Read This Book";
        readBtn.onclick = () => _readBookFromInfo(entry.key);
        right.appendChild(readBtn);

        _renderBookPreview(entry, right);
      }
    }

    function _renderRows() {
      list.innerHTML = "";
      const filtered = _filteredEntries();

      if (!filtered.length) {
        list.innerHTML = `<div class="info-empty">No entries match current filters.</div>`;
        _renderDetail(null);
        return;
      }

      if (!filtered.some((e) => e.key === tabState.selectedKey)) {
        tabState.selectedKey = filtered[0].key;
      }

      for (const entry of filtered) {
        const rarityInfo = _rarityInfo(entry.rarity);
        const row = document.createElement("div");
        row.className = `info-row ${entry.key === tabState.selectedKey ? "active" : ""} ${rarityInfo.className}`;

        const lead = document.createElement("div");
        lead.className = "info-row-lead";

        const icon = document.createElement("div");
        icon.className = "info-row-icon";
        _appendIcon(icon, entry.key, 24);
        lead.appendChild(icon);

        const txt = document.createElement("div");
        txt.className = "info-row-text";
        txt.innerHTML =
          `<div class="info-row-name">${entry.name}</div>` +
          `<div class="info-row-meta">${entry.category} • ${entry.value.toLocaleString()}g • ${entry.weight}kg</div>`;
        lead.appendChild(txt);

        row.appendChild(lead);

        const rarityBadge = document.createElement("span");
        rarityBadge.className = `info-rarity-badge info-rarity-sm ${rarityInfo.className}`;
        rarityBadge.textContent = rarityInfo.label;
        row.appendChild(rarityBadge);

        if (booksOnly) {
          const read = document.createElement("button");
          read.className = "info-row-read";
          read.textContent = "📖 Read";
          read.onclick = (ev) => {
            ev.stopPropagation();
            _readBookFromInfo(entry.key);
          };
          row.appendChild(read);
        }

        row.onclick = () => {
          tabState.selectedKey = entry.key;
          _renderRows();
        };

        list.appendChild(row);
      }

      const selected = filtered.find((e) => e.key === tabState.selectedKey) || filtered[0];
      _renderDetail(selected || null);
    }

    search.addEventListener("input", () => {
      tabState.search = search.value;
      _renderRows();
    });
    catSel.addEventListener("change", () => {
      tabState.category = catSel.value;
      _renderRows();
    });
    sortSel.addEventListener("change", () => {
      tabState.sort = sortSel.value;
      _renderRows();
    });

    _renderRows();
  }

  function _renderTab(tab) {
    const host = document.getElementById(`infoTab_${tab}`);
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
        `<div style="color:#96a7b9">Difficulty: ${w.difficulty || "normal"} • Map: ${w.map || "?"} • Seed: ${((typeof w.seed === "number" && Number.isFinite(w.seed)) ? w.seed : "?")}</div>` +
      `</div>`
      ).join("");
      return;
    }

    if (tab === "score") {
      const wins = Array.isArray(stats.wins) ? stats.wins : [];
      const validDaysWins = wins.filter((w) => Number.isFinite(Number(w.days)) && Number(w.days) >= 0);
      const bestAssetWin = wins.reduce((best, w) =>
        (best == null || Number(w.assets || 0) > Number(best.assets || 0)) ? w : best
      , null);
      const fastestWin = validDaysWins.reduce((best, w) =>
        (best == null || Number(w.days) < Number(best.days)) ? w : best
      , null);
      const avgAssets = wins.length > 0
        ? Math.round(wins.reduce((sum, w) => sum + Number(w.assets || 0), 0) / wins.length)
        : null;
      const avgDays = validDaysWins.length > 0
        ? (validDaysWins.reduce((sum, w) => sum + Number(w.days), 0) / validDaysWins.length).toFixed(1)
        : null;
      const recent = wins.slice(0, 5);
      const recentTrend = recent.length >= 2
        ? (Number(recent[0].assets || 0) - Number(recent[recent.length - 1].assets || 0))
        : null;
      const byDifficulty = {};
      for (const w of wins) {
        const key = String(w.difficulty || "normal");
        byDifficulty[key] = (byDifficulty[key] || 0) + 1;
      }
      const difficultyText = Object.entries(byDifficulty)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}: ${v}`)
        .join(" • ");

      host.innerHTML =
        `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-bottom:12px">` +
          `<div style="border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px;background:rgba(20,24,32,0.55)">` +
            `<div style="color:#96a7b9;font-size:11px">High Score</div>` +
            `<div style="color:#ffd700;font-weight:700;font-size:18px">${_fmtGold(stats.highScore || 0)}</div>` +
          `</div>` +
          `<div style="border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px;background:rgba(20,24,32,0.55)">` +
            `<div style="color:#96a7b9;font-size:11px">Total Wins</div>` +
            `<div style="color:#d4af37;font-weight:700;font-size:18px">${wins.length}</div>` +
          `</div>` +
          `<div style="border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px;background:rgba(20,24,32,0.55)">` +
            `<div style="color:#96a7b9;font-size:11px">Best Win Days</div>` +
            `<div style="color:#7ec8e3;font-weight:700;font-size:18px">${stats.bestDays == null ? "N/A" : stats.bestDays}</div>` +
          `</div>` +
          `<div style="border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px;background:rgba(20,24,32,0.55)">` +
            `<div style="color:#96a7b9;font-size:11px">Last Victory</div>` +
            `<div style="color:#c8d6e5;font-weight:700;font-size:13px">${stats.lastVictory ? _fmtDate(stats.lastVictory) : "N/A"}</div>` +
          `</div>` +
        `</div>` +
        `<div style="padding:8px 0;color:#c8d6e5">Average Assets (wins): <span style="color:#ffd700;font-weight:700">${avgAssets == null ? "N/A" : _fmtGold(avgAssets)}</span></div>` +
        `<div style="padding:4px 0 8px;color:#c8d6e5">Average Win Days: <span style="color:#7ec8e3;font-weight:700">${avgDays == null ? "N/A" : avgDays}</span></div>` +
        `<div style="padding:8px 0;color:#96a7b9">Difficulty Breakdown: ${difficultyText || "N/A"}</div>` +
        `<div style="padding:8px 0;color:#96a7b9">Recent 5 Trend: ${recentTrend == null ? "N/A" : `${recentTrend >= 0 ? "+" : ""}${_fmtGold(recentTrend)}`}</div>` +
        `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08)">` +
          `<div style="color:#d4af37;font-weight:700;margin-bottom:6px">Best Asset Run</div>` +
          (bestAssetWin
            ? `<div style="color:#c8d6e5">Assets: ${_fmtGold(bestAssetWin.assets)} • Days: ${bestAssetWin.days ?? "?"} • Difficulty: ${bestAssetWin.difficulty || "normal"} • Seed: ${((typeof bestAssetWin.seed === "number" && Number.isFinite(bestAssetWin.seed)) ? bestAssetWin.seed : "?")}</div>` +
              `<div style="color:#96a7b9;font-size:12px">${bestAssetWin.date ? _fmtDate(bestAssetWin.date) : ""} • Map: ${bestAssetWin.map || "?"}</div>`
            : `<div style="color:#aaa">No wins recorded yet.</div>`) +
        `</div>` +
        `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08)">` +
          `<div style="color:#d4af37;font-weight:700;margin-bottom:6px">Fastest Win</div>` +
          (fastestWin
            ? `<div style="color:#c8d6e5">Days: ${fastestWin.days} • Assets: ${_fmtGold(fastestWin.assets)} • Difficulty: ${fastestWin.difficulty || "normal"} • Seed: ${((typeof fastestWin.seed === "number" && Number.isFinite(fastestWin.seed)) ? fastestWin.seed : "?")}</div>` +
              `<div style="color:#96a7b9;font-size:12px">${fastestWin.date ? _fmtDate(fastestWin.date) : ""} • Map: ${fastestWin.map || "?"}</div>`
            : `<div style="color:#aaa">No valid day data yet.</div>`) +
        `</div>`;
      return;
    }

    if (tab === "items") {
      _renderCompendiumTab({ tabKey: "items", booksOnly: false });
      return;
    }

    if (tab === "books") {
      _renderCompendiumTab({ tabKey: "books", booksOnly: true });
      return;
    }

    const canOpenPanel = typeof tutorialSystem !== "undefined" && tutorialSystem && typeof tutorialSystem.showHelpPanel === "function";
    host.innerHTML =
      (canOpenPanel
        ? `<div style="margin-bottom:8px"><button id="infoOpenFaqBtn" style="border:1px solid #3a6a8a;background:#1a2a3a;color:#cfe8f7;border-radius:6px;padding:6px 10px;cursor:pointer">Open Full FAQ Panel</button></div>`
        : "") +
      _buildQuestionHTMLFromTutorial();
    const faqBtn = document.getElementById("infoOpenFaqBtn");
    if (faqBtn && canOpenPanel) {
      faqBtn.onclick = function() { tutorialSystem.showHelpPanel(); };
    }
  }

  function _setActiveTab(tab) {
    window._infoTab = tab;
    window.BQTabs?.applyTabState({
      tab,
      defs: INFO_TAB_DEFS,
      btnSelector: "[data-info-tab]",
      panelPrefix: "infoTab_",
      activeClass: "settings-tab-active",
      dataAttr: "data-info-tab",
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
      const _leaveInfoMenu = () => {
        const prev = gameStateManager?.prev;
        if (prev && prev !== GameStates.INFO) gameStateManager.setState(prev);
        else gameStateManager.setState(GameStates.MAIN_MENU);
      };
      createButton("✕")
        .parent(wrapper)
        .addClass("menu-close-btn")
        .attribute("aria-label", "Close info")
        .attribute("title", "Back")
        .mousePressed(_leaveInfoMenu);
      const bgDecor = createDiv().class("menu-bg-decor").parent(wrapper);
      for (let i = 0; i < 30; i++) {
        const star = createDiv().class("menu-star").parent(bgDecor);
        star.style("--x", Math.random() * 100 + "%");
        star.style("--y", Math.random() * 100 + "%");
        star.style("--delay", Math.random() * 3 + "s");
        star.style("--duration", (2 + Math.random() * 2) + "s");
      }

      const header = createDiv().class("menu-logo-section").parent(wrapper);
      createElement("h1", "Info").parent(header).class("main-title");
      createElement("div", "Win history, scores, items, books, and help")
        .parent(header)
        .addClass("menu-subtitle");

      const actions = createDiv().parent(wrapper)
        .style("display", "flex")
        .style("gap", "8px")
        .style("justify-content", "center")
        .style("margin", "8px 0 14px")
        .style("position", "relative")
        .style("z-index", "1");

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

      const tabs = createDiv().parent(wrapper).class("settings-tab-bar")
        .style("position", "relative")
        .style("z-index", "1");

      for (const t of INFO_TAB_DEFS) {
        const btn = createButton(t.label).parent(tabs);
        btn.attribute("data-info-tab", t.key);
        btn.addClass("settings-tab-btn");
        btn.mousePressed(() => _setActiveTab(t.key));
      }

      for (const t of INFO_TAB_DEFS) {
        createDiv()
          .id(`infoTab_${t.key}`)
          .class("settings-tab-panel")
          .parent(wrapper)
          .style("max-width", "1000px")
          .style("width", "96vw")
          .style("margin", "0 auto")
          .style("height", "52vh")
          .style("overflow-y", "auto")
          .style("padding", "10px 14px")
          .style("background", "rgba(12,16,24,0.72)")
          .style("border", "1px solid rgba(126,200,227,0.24)")
          .style("border-radius", "8px")
          .style("text-align", "left")
          .style("display", "none");
      }

      const bottom = createDiv().parent(wrapper)
        .style("margin-top", "14px")
        .style("position", "relative")
        .style("z-index", "1");
      createButton("Back")
        .parent(bottom)
        .addClass("menu-btn info-back-btn")
        .mousePressed(_leaveInfoMenu);

      return wrapper;
    },

    show: () => {
      const m = select("#infoMenu");
      if (m) m.addClass("screen-visible");
      const tab = INFO_TAB_DEFS.some((t) => t.key === window._infoTab) ? window._infoTab : INFO_DEFAULT_TAB;
      _setActiveTab(tab);
    },

    hide: () => {
      const m = select("#infoMenu");
      if (m) m.removeClass("screen-visible");
    },
  });
})();
