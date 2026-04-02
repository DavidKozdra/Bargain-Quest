// NEW GAME CONFIG (extracted from ui.js)
uiManager.registerScreen("newGameConfig", {
  validStates: [GameStates.NEW_GAME_CONFIG],

  create: () => {
    const wrapper = createDiv().id("newGameConfig").class("screen");
    const NEW_GAME_TAB_DEFS = [
      { key: "default", label: "Default", atlasFrame: "Chart", fallback: "⚓" },
      { key: "worldConfig", label: "World Config", atlasFrame: "Cash", fallback: "🗺️" },
      { key: "gameplay", label: "Gameplay", atlasFrame: "player", fallback: "🧑" },
      { key: "worldGen", label: "World Gen", atlasFrame: "Cash", fallback: "🗺️" },
    ];

    function createFallbackIconEl(fallback, size) {
      const span = document.createElement("span");
      span.textContent = fallback;
      span.style.fontSize = `${size}px`;
      span.style.lineHeight = "1";
      span.style.display = "inline-flex";
      span.style.alignItems = "center";
      span.style.justifyContent = "center";
      return span;
    }

    function createConfigLabelEl({ text, atlasFrame, fallback = "❓", size = 16, rowClass = "", iconClass = "" }) {
      const row = document.createElement("span");
      row.className = ["cfg-label-row", rowClass].filter(Boolean).join(" ");

      const iconEl = (typeof createAtlasIconEl === "function")
        ? createAtlasIconEl(atlasFrame, size, fallback)
        : createFallbackIconEl(fallback, size);
      iconEl.classList.add("cfg-label-icon");
      if (iconClass) iconClass.split(/\s+/).filter(Boolean).forEach((cls) => iconEl.classList.add(cls));
      iconEl.setAttribute("aria-hidden", "true");
      row.appendChild(iconEl);

      const textEl = document.createElement("span");
      textEl.className = "cfg-label-text";
      textEl.textContent = text;
      row.appendChild(textEl);

      return row;
    }

    function setConfigLabel(host, opts) {
      const parent = host?.elt || host;
      if (!parent) return;
      parent.textContent = "";
      parent.appendChild(createConfigLabelEl(opts));
    }

    function createConfigSectionTitle(parent, text, atlasFrame, fallback) {
      const heading = createElement("h3", "").parent(parent);
      heading.addClass("cfg-section-title");
      setConfigLabel(heading, { text, atlasFrame, fallback, size: 18 });
      return heading;
    }

    function createConfigLabelDiv(parent, className, text, atlasFrame, fallback, size = 16) {
      const label = createDiv().addClass(className).parent(parent);
      setConfigLabel(label, { text, atlasFrame, fallback, size });
      return label;
    }

    createButton("✕")
      .parent(wrapper)
      .addClass("menu-close-btn")
      .attribute("aria-label", "Close new game setup")
      .attribute("title", "Back")
      .mousePressed(() => gameStateManager.setState(GameStates.MAIN_MENU));

    // Animated title with pulsing / drifting
    const titleEl = createElement("h2", "New Voyage").parent(wrapper);
    titleEl.addClass("voyage-title-animated");
    createP("Choose the size of the world and set sail!")
      .parent(wrapper)
      .style("color", "#aaa")
      .style("margin-bottom", "20px")
      .style("font-style", "italic");

    const tabBar = createDiv().addClass("settings-tab-bar").parent(wrapper);
    for (const def of NEW_GAME_TAB_DEFS) {
      const btn = createButton("")
        .parent(tabBar)
        .addClass("settings-tab-btn newgame-tab-btn")
        .attribute("data-tab", def.key);
      setConfigLabel(btn, {
        text: def.label,
        atlasFrame: def.atlasFrame,
        fallback: def.fallback,
        size: 14,
        rowClass: "cfg-tab-label",
        iconClass: "cfg-tab-icon",
      });
    }

    const defaultTab = createDiv().id("newGameTab_default").addClass("settings-tab-panel").parent(wrapper);
    const worldConfigTab = createDiv().id("newGameTab_worldConfig").addClass("settings-tab-panel").parent(wrapper);
    const gameplayTab = createDiv().id("newGameTab_gameplay").addClass("settings-tab-panel").parent(wrapper);
    const worldGenTab = createDiv().id("newGameTab_worldGen").addClass("settings-tab-panel").parent(wrapper);

    function setNewGameConfigTab(tab) {
      window._newGameConfigTab = tab;
      const result = window.BQTabs?.applyTabState({
        root: wrapper.elt,
        tab,
        defs: NEW_GAME_TAB_DEFS,
        btnSelector: ".newgame-tab-btn",
        panelPrefix: "newGameTab_",
        activeClass: "settings-tab-active",
        dataAttr: "data-tab",
      });
      if (result) return;

      NEW_GAME_TAB_DEFS.forEach((def) => {
        const panel = document.getElementById(`newGameTab_${def.key}`);
        if (panel) panel.style.display = def.key === tab ? "block" : "none";
      });
      tabBar.elt.querySelectorAll(".newgame-tab-btn").forEach((btn) => {
        const active = (btn.getAttribute("data-tab") || "") === tab;
        btn.classList.toggle("settings-tab-active", active);
      });
    }

    tabBar.elt.querySelectorAll(".newgame-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => setNewGameConfigTab(btn.getAttribute("data-tab") || "default"));
    });
    setNewGameConfigTab(window._newGameConfigTab || "default");

    // ── Difficulty ────────────────────────────────────────
    const diffSection = createDiv().addClass("config-section").parent(defaultTab);
    createConfigSectionTitle(diffSection, "Difficulty", "Sword", "⚔️").style("margin-bottom", "10px");

    window._newGameDifficulty = 'normal';

    const diffGrid = createDiv().addClass("size-card-grid").parent(diffSection);
    const diffOptions = [
      { key: 'easy',     atlasFrame: 'Easy',   fallback: '🟢', label: 'Easy',     desc: 'Relaxed trading, minimal penalties. Very hard to lose.' },
      { key: 'normal',   atlasFrame: 'Medium', fallback: '🟡', label: 'Normal',   desc: 'Balanced challenge. Death costs gold and items.' },
      { key: 'hard',     atlasFrame: 'Hard',   fallback: '🔴', label: 'Hard',     desc: 'Punishing losses. Tougher raiders, higher costs.' },
      { key: 'hardcore', atlasFrame: 'Hardcore', fallback: '💀', label: 'Hardcore', desc: 'One life. Death deletes your save. No second chances.' },
    ];

    for (const opt of diffOptions) {
      const card = createDiv().addClass("size-card").parent(diffGrid);
      card.attribute("data-diff", opt.key);
      const labelRow = createDiv().addClass("size-card-label").parent(card);
      const iconEl = (typeof createItemIconEl === 'function')
        ? createItemIconEl(opt.atlasFrame, 24)
        : (() => {
            const span = document.createElement('span');
            span.textContent = opt.fallback;
            return span;
          })();
      iconEl.classList.add("cfg-diff-icon");
      iconEl.setAttribute("aria-hidden", "true");
      labelRow.elt.appendChild(iconEl);
      createSpan(opt.label).parent(labelRow);
      createDiv().html(opt.desc).addClass("size-card-desc").parent(card);

      card.mousePressed(() => {
        window._newGameDifficulty = opt.key;
        selectAll("[data-diff]").forEach(c => c.removeClass("size-card-active"));
        card.addClass("size-card-active");
      });

      if (opt.key === 'normal') card.addClass("size-card-active");
    }

    // ── Map Size ──────────────────────────────────────────
    const sizeSection = createDiv().addClass("config-section").parent(defaultTab);
    createConfigSectionTitle(sizeSection, "World Size", "Cash", "🗺️").style("margin-bottom", "10px");

    const presets = [
      { label: "Small",     cols: 75,   rows: 75,   desc: "Quick game" },
      { label: "Medium",    cols: 150,  rows: 150,  desc: "Balanced" },
      { label: "Large",     cols: 300,  rows: 300,  desc: "Epic voyages" },
      { label: "Huge",      cols: 600,  rows: 600,  desc: "Massive world" },
      { label: "Giant",     cols: 1000, rows: 1000, desc: "Continent" },
      { label: "Epic",      cols: 1500, rows: 1500, desc: "Mega world" },
    ];

    window._newGameMapCols = 150;
    window._newGameMapRows = 150;

    const presetGrid = createDiv().addClass("size-card-grid").parent(sizeSection);

    for (const preset of presets) {
      const card = createDiv().addClass("size-card cfg-size-card").parent(presetGrid);
      card.attribute("data-cols", preset.cols);
      card.attribute("data-rows", preset.rows);
      createDiv().html(preset.label).addClass("size-card-label").parent(card);
      createDiv().html(`${preset.cols} x ${preset.rows}`).addClass("size-card-dim").parent(card);
      createDiv().html(preset.desc).addClass("size-card-desc").parent(card);

      card.mousePressed(() => {
        window._newGameMapCols = preset.cols;
        window._newGameMapRows = preset.rows;
        selectAll(".cfg-size-card").forEach(c => c.removeClass("size-card-active"));
        card.addClass("size-card-active");
        // Sync slider and custom input
        const sl = select("#sizeSlider");
        if (sl) sl.value(preset.cols);
        select("#sizeCustomInput")?.value(preset.cols);
        select("#sizeSliderVal")?.html(`${preset.cols} x ${preset.rows}`);
        updateMapSizeInfo();
      });

      if (preset.cols === 150) card.addClass("size-card-active");
    }

    // Custom slider for fine control
    const sliderWrap = createDiv().addClass("size-slider-row").parent(sizeSection);
    createSpan("Custom").addClass("size-slider-label").parent(sliderWrap);
    const sizeSlider = createSlider(50, 1500, 150, 25)
      .id("sizeSlider")
      .addClass("size-slider")
      .parent(sliderWrap);
    createSpan("150 x 150").id("sizeSliderVal").addClass("size-slider-val").parent(sliderWrap);
    const sizeCustomInput = createElement('input')
      .id("sizeCustomInput")
      .attribute('type', 'number')
      .attribute('min', '50')
      .attribute('placeholder', '…')
      .addClass('custom-num-input')
      .parent(sliderWrap);
    sizeCustomInput.value(150);

    function syncMapSize(val) {
      val = Math.max(50, val);
      window._newGameMapCols = val;
      window._newGameMapRows = val;
      select("#sizeSliderVal")?.html(`${val} x ${val}`);
      select("#sizeSlider")?.value(Math.min(val, 1500));
      select("#sizeCustomInput")?.value(val);
      selectAll(".cfg-size-card").forEach(c => {
        const cardCols = parseInt(c.attribute("data-cols"));
        if (cardCols === val) c.addClass("size-card-active");
        else c.removeClass("size-card-active");
      });
      updateMapSizeInfo();
    }

    sizeSlider.input(() => syncMapSize(parseInt(sizeSlider.value())));

    sizeCustomInput.input(() => {
      const raw = parseInt(sizeCustomInput.value());
      if (!isNaN(raw) && raw >= 50) syncMapSize(raw);
    });

    // Info line
    createP("").id("mapInfoLine")
      .parent(sizeSection)
      .style("color", "#888")
      .style("font-size", "12px")
      .style("margin", "8px 0 0");

    // ── City Count ────────────────────────────────────────
    const citySection = createDiv().addClass("config-section").parent(defaultTab);
    createConfigSectionTitle(citySection, "City Count", "trader", "🏙️").style("margin-bottom", "8px");

    window._newGameCityCount = 0; // 0 = auto

    const cityRow = createDiv().addClass("size-slider-row").parent(citySection);

    const citySlider = createSlider(0, 500, 0, 1)
      .id("citySlider")
      .addClass("size-slider")
      .parent(cityRow);
    createSpan("Auto").id("citySliderVal").addClass("size-slider-val").parent(cityRow);
    const cityCustomInput = createElement('input')
      .attribute('type', 'number')
      .attribute('min', '0')
      .attribute('placeholder', 'Auto')
      .addClass('custom-num-input')
      .parent(cityRow);

    function getAutoCityCount() {
      return 25;
    }

    function updateCityDisplay() {
      const val = parseInt(citySlider.value());
      const valEl = select("#citySliderVal");
      if (val === 0) {
        window._newGameCityCount = 0;
        if (valEl) valEl.html(`Auto (~${getAutoCityCount()})`);
        cityCustomInput.value('');
      } else {
        window._newGameCityCount = val;
        if (valEl) valEl.html(`${val} cities`);
        cityCustomInput.value(val);
      }
    }

    citySlider.input(() => updateCityDisplay());

    cityCustomInput.input(() => {
      const raw = parseInt(cityCustomInput.value());
      const val = isNaN(raw) || raw < 0 ? 0 : raw;
      window._newGameCityCount = val;
      citySlider.value(Math.min(val, 500));
      const valEl = select("#citySliderVal");
      if (val === 0) {
        if (valEl) valEl.html(`Auto (~${getAutoCityCount()})`);
      } else {
        if (valEl) valEl.html(`${val} cities`);
      }
    });


    // ── Game Settings ─────────────────────────────────────
    const settingsSection = createDiv().addClass("config-section").parent(worldConfigTab);
    createConfigSectionTitle(settingsSection, "World Config", "Cash", "🗺️").style("margin-bottom", "10px");

    const settingsGrid = createDiv().addClass("settings-grid").parent(settingsSection);

    // Radio-button group helper — pill-style toggle buttons with descriptions
    let _radioUid = 0;
    function makeRadioGroup(parentEl, labelDef, groupName, options, defaultValue, onChange) {
      const card = createDiv().addClass("setting-card").parent(parentEl);
      const labelEl = createDiv().addClass("setting-card-label").parent(card);
      if (labelDef && typeof labelDef === "object") {
        setConfigLabel(labelEl, {
          text: labelDef.text,
          atlasFrame: labelDef.atlasFrame,
          fallback: labelDef.fallback,
          size: 16,
        });
      } else {
        labelEl.html(labelDef);
      }
      const pillWrap = createDiv().addClass("pill-group").parent(card);
      const pillIds = [];
      for (const opt of options) {
        const id = `pill_${groupName}_${_radioUid++}`;
        pillIds.push(id);
        const pill = createDiv().parent(pillWrap).addClass("pill-option").id(id);
        if (opt.atlasFrame) {
          const iconEl = (typeof createAtlasIconEl === "function")
            ? createAtlasIconEl(opt.atlasFrame, 14, opt.fallback || opt.icon || "❓")
            : createFallbackIconEl(opt.fallback || opt.icon || "❓", 14);
          iconEl.classList.add("pill-icon");
          iconEl.setAttribute("aria-hidden", "true");
          pill.elt.appendChild(iconEl);
        } else if (opt.icon) {
          createSpan(opt.icon).addClass("pill-icon").parent(pill);
        }
        createSpan(opt.label).addClass("pill-label").parent(pill);
        if (opt.label === defaultValue) pill.addClass("pill-active");
        pill.mousePressed(() => {
          // Deactivate all pills in this group
          pillIds.forEach(pid => select('#' + pid)?.removeClass("pill-active"));
          pill.addClass("pill-active");
          onChange(opt.value);
          // Update description
          const descEl = select(`#desc_${groupName}`);
          if (descEl && opt.desc) descEl.html(opt.desc);
          else if (descEl) descEl.html('');
        });
      }
      // Description area
      const defaultOpt = options.find(o => o.label === defaultValue);
      createP(defaultOpt?.desc || '').id(`desc_${groupName}`).addClass("pill-desc").parent(card);
    }

    // Store selections globally
    window._newGameEventChance = 0.10;
    window._newGameRaiderInterval = 60;
    window._newGameLandmass = 1;
    window._newGameCustomMap = null; // name of saved editor map, or null
    window._newGameGoldTarget = 5000;
    window._newGameDayLimit = 20;
    window._newGameCityManageMode = false;
    window._newGameSeed = null;
    window._newGameWorldGen = Object.assign({
      warp: 1.0,
      ruggedness: 1.0,
      temperatureVariance: 1.0,
      moistureVariance: 1.0,
      coastalDropoff: 1.0,
    }, window._newGameWorldGen || {});

    makeRadioGroup(settingsGrid, { text: "Events", atlasFrame: "Wheel", fallback: "⚡" }, "events", [
      { label: "Low", value: 0.03, atlasFrame: "Easy", fallback: "🌤️", desc: "Rare random events — peaceful voyages" },
      { label: "Medium", value: 0.10, atlasFrame: "Medium", fallback: "🌦️", desc: "Balanced events — some surprises along the way" },
      { label: "High", value: 0.22, atlasFrame: "Hard", fallback: "⛈️", desc: "Frequent events — expect the unexpected" },
    ], "Medium", (v) => { window._newGameEventChance = parseFloat(v); });

    makeRadioGroup(settingsGrid, { text: "Raiders", atlasFrame: "raider", fallback: "💀" }, "raiders", [
      { label: "Few", value: 90, atlasFrame: "Easy", fallback: "😌", desc: "Raiders are scarce — safer roads" },
      { label: "Normal", value: 60, atlasFrame: "Hard", fallback: "⚔️", desc: "Bandits roam regularly — stay alert" },
      { label: "Many", value: 30, atlasFrame: "Hardcore", fallback: "💀", desc: "Danger everywhere — fight or pay up" },
    ], "Normal", (v) => { window._newGameRaiderInterval = parseInt(v); });

    makeRadioGroup(settingsGrid, { text: "Landmass", atlasFrame: "Cash", fallback: "🗺️" }, "landmass", [
      { label: "Islands", value: 0, icon: "🏝️", desc: "Small scattered islands — lots of sailing" },
      { label: "Normal", value: 1, icon: "🌍", desc: "Mix of land and sea — balanced exploration" },
      { label: "Continents", value: 2, icon: "🏔️", desc: "Large landmasses — overland trade routes" },
    ], "Normal", (v) => { window._newGameLandmass = parseInt(v); window._newGameCustomMap = null; });

    // ── Custom Map picker (appended to landmass card) ─────
    const allCards = settingsGrid.elt.querySelectorAll('.setting-card');
    const landmassCard = allCards[allCards.length - 1];
    if (landmassCard) {
      const pillGroup = landmassCard.querySelector('.pill-group');
      if (pillGroup) {
        // Add a "Custom Map" pill
        const custPill = document.createElement('div');
        custPill.className = 'pill-option';
        custPill.id = 'pill_landmass_custom';
        custPill.innerHTML = '<span class="pill-icon">📁</span><span class="pill-label">Custom</span>';
        pillGroup.appendChild(custPill);

        // Dropdown of saved maps
        const mapSelect = document.createElement('select');
        mapSelect.className = 'config-custom-input';
        mapSelect.id = 'customMapSelect';
        mapSelect.disabled = true;
        mapSelect.style.width = '100%';
        mapSelect.style.marginTop = '6px';
        landmassCard.appendChild(mapSelect);

        function refreshMapList() {
          const maps = typeof LevelEditor !== 'undefined' ? LevelEditor.listSavedMaps() : [];
          mapSelect.innerHTML = '';
          if (maps.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = 'No saved maps — use Custom Map Editor first';
            opt.value = '';
            mapSelect.appendChild(opt);
          } else {
            for (const m of maps) {
              const opt = document.createElement('option');
              opt.value = m;
              opt.textContent = m;
              mapSelect.appendChild(opt);
            }
          }
        }
        refreshMapList();

        custPill.addEventListener('click', () => {
          // Deactivate all other pills in this group
          pillGroup.querySelectorAll('.pill-option').forEach(p => p.classList.remove('pill-active'));
          custPill.classList.add('pill-active');
          mapSelect.disabled = false;
          refreshMapList();
          const descEl = document.getElementById('desc_landmass');
          if (descEl) descEl.textContent = 'Play on a map you built in the Custom Map Editor';
          const selected = mapSelect.value;
          window._newGameCustomMap = selected || null;
          window._newGameLandmass = 1;
        });

        mapSelect.addEventListener('change', () => {
          window._newGameCustomMap = mapSelect.value || null;
        });

        // When any standard landmass pill is clicked, disable map dropdown
        pillGroup.querySelectorAll('.pill-option').forEach(p => {
          if (p !== custPill) {
            p.addEventListener('click', () => {
              mapSelect.disabled = true;
              window._newGameCustomMap = null;
            });
          }
        });
      }
    }

    // ── Win Condition ─────────────────────────────────────
    const winSection = createDiv().addClass("config-section").parent(gameplayTab);
    createConfigSectionTitle(winSection, "Win Condition", "Cash", "🏆").style("margin-bottom", "10px");
    const winGrid = createDiv().addClass("settings-grid").style("grid-template-columns", "1fr 1fr").parent(winSection);

    // Gold target
    const goldCard = createDiv().parent(winGrid);
    createConfigLabelDiv(goldCard, "setting-card-label", "Gold Target", "Cash", "💰");
    const goldInput = createElement("input").parent(goldCard).addClass("config-custom-input");
    goldInput.attribute("type", "number");
    goldInput.attribute("min", "200");
    goldInput.attribute("step", "500");
    goldInput.attribute("value", "5000");
    goldInput.attribute("placeholder", "5000");
    goldInput.attribute("aria-label", "Gold target to win");
    goldInput.input(() => {
      const v = parseInt(goldInput.value());
      window._newGameGoldTarget = (!isNaN(v) && v >= 200) ? v : 5000;
    });

    // Day limit
    const dayCard = createDiv().parent(winGrid);
    createConfigLabelDiv(dayCard, "setting-card-label", "Day Limit", "clock", "⏱️");
    const dayInput = createElement("input").parent(dayCard).addClass("config-custom-input");
    dayInput.attribute("type", "number");
    dayInput.attribute("min", "1");
    dayInput.attribute("step", "10");
    dayInput.attribute("value", "20");
    dayInput.attribute("placeholder", "0 = no limit");
    dayInput.attribute("aria-label", "Day limit (0 for no limit)");
    dayInput.input(() => {
      const v = parseInt(dayInput.value());
      window._newGameDayLimit = (!isNaN(v) && v >= 0) ? v : 0;
    });

    // ══════════════════════════════════════════════════════
    //  PLAYER IDENTITY
    // ══════════════════════════════════════════════════════
    const idSection = createDiv().addClass("config-section").parent(gameplayTab);
    createConfigSectionTitle(idSection, "Player", "player", "🧑").style("margin-bottom", "10px");

    window._newGamePlayerName = '';

    const nameRow = createDiv().addClass("cfg-row").parent(idSection);
    createConfigLabelDiv(nameRow, "cfg-row-label", "Captain Name", "player", "🧑");
    const nameInput = createElement("input").parent(nameRow).addClass("config-custom-input").style("max-width", "200px").style("text-align", "left");
    nameInput.attribute("type", "text");
    nameInput.attribute("maxlength", "24");
    nameInput.attribute("placeholder", "Random");
    nameInput.attribute("aria-label", "Captain name");
    nameInput.input(() => { window._newGamePlayerName = nameInput.value().trim(); });

    // ══════════════════════════════════════════════════════
    //  STARTING LOADOUT
    // ══════════════════════════════════════════════════════
    const loadoutSection = createDiv().addClass("config-section").parent(gameplayTab);
    createConfigSectionTitle(loadoutSection, "Starting Loadout", "Crate", "📦").style("margin-bottom", "10px");

    // Starting Gold
    window._newGameStartGold = 100;
    const goldRow = createDiv().addClass("cfg-row").parent(loadoutSection);
    createConfigLabelDiv(goldRow, "cfg-row-label", "Starting Gold", "Cash", "💰");
    const startGoldInput = createElement("input").parent(goldRow).addClass("config-custom-input").style("max-width", "100px");
    startGoldInput.attribute("type", "number");
    startGoldInput.attribute("min", "0");
    startGoldInput.attribute("step", "50");
    startGoldInput.attribute("value", "100");
    startGoldInput.attribute("aria-label", "Starting gold amount");
    startGoldInput.input(() => {
      const v = parseInt(startGoldInput.value());
      window._newGameStartGold = (!isNaN(v) && v >= 0) ? v : 100;
    });

    // Grace Period
    window._newGameGracePeriod = 30;
    const graceRow = createDiv().addClass("cfg-row").parent(loadoutSection);
    createConfigLabelDiv(graceRow, "cfg-row-label", "Grace Period", "clock", "⏱️");
    const graceInput = createElement("input").parent(graceRow).addClass("config-custom-input").style("max-width", "80px");
    graceInput.attribute("type", "number");
    graceInput.attribute("min", "0");
    graceInput.attribute("max", "120");
    graceInput.attribute("step", "1");
    graceInput.attribute("value", "30");
    graceInput.attribute("aria-label", "Grace period in seconds");
    graceInput.input(() => {
      const v = parseInt(graceInput.value());
      window._newGameGracePeriod = (!isNaN(v) && v >= 0) ? v : 30;
    });
    createSpan("in-game sec").parent(graceRow).style("color", "#888").style("font-size", "12px").style("margin-left", "4px");

    // ── Starting Items ───────────────────────────────────
    createConfigLabelDiv(loadoutSection, "cfg-row-label", "Starting Items", "Crate", "📦").style("margin-top", "12px");
    createP("Search and set quantities for any ownable item in your starting pack. Set to 0 to remove.")
      .parent(loadoutSection).style("color", "#667").style("font-size", "11px").style("margin", "2px 0 8px");

    window._newGameStartItems = { Fish: 5, Wheat: 3 }; // defaults match Player constructor

    const startableItems = (typeof ItemLibrary !== 'undefined')
      ? Object.keys(ItemLibrary)
          .filter(k => ItemLibrary[k] && typeof ItemLibrary[k] === 'object')
      .sort((a, b) => {
        const an = ItemLibrary[a]?.name || a;
        const bn = ItemLibrary[b]?.name || b;
        return an.localeCompare(bn);
      })
      : [];

    const itemSearch = createElement("input")
      .parent(loadoutSection)
      .addClass("cfg-item-search")
      .attribute("type", "text")
      .attribute("placeholder", "Search starting items...");

    const itemGrid = createDiv().addClass("cfg-item-grid").parent(loadoutSection);
    let itemSearchText = '';

    function itemDefaultQty(itemKey) {
      return ItemLibrary[itemKey]?.tags?.has('book') ? 1 : 3;
    }

    function setItemQty(itemKey, qty) {
      const clamped = Math.max(0, Math.min(99, qty));
      if (clamped <= 0) delete window._newGameStartItems[itemKey];
      else window._newGameStartItems[itemKey] = clamped;
      refreshItemChips();
    }

    function refreshItemChips() {
      itemGrid.html('');
      const query = itemSearchText.toLowerCase();
      const filtered = startableItems.filter(itemKey => {
        if (!query) return true;
        const display = (ItemLibrary[itemKey]?.name || itemKey).toLowerCase();
        return display.includes(query) || itemKey.toLowerCase().includes(query);
      });

      if (filtered.length === 0) {
        createP("No items match your search.")
          .parent(itemGrid)
          .addClass("cfg-item-empty");
        return;
      }

      for (const itemKey of filtered) {
        const qty = window._newGameStartItems[itemKey] || 0;
        const chip = createDiv().parent(itemGrid).addClass("cfg-item-chip");
        if (qty > 0) chip.addClass("cfg-item-active");

        const left = createDiv().addClass("cfg-item-main").parent(chip);
        const iconWrapper = createDiv().addClass("cfg-item-icon").parent(left);
        iconWrapper.elt.appendChild(createItemIconEl(itemKey, 20));
        createSpan(ItemLibrary[itemKey]?.name || itemKey).addClass("cfg-item-name").parent(left);

        const controls = createDiv().addClass("cfg-item-controls").parent(chip);
        const decBtn = createButton("-").parent(controls).addClass("cfg-item-step");
        const qtyInput = createElement("input").parent(controls).addClass("cfg-item-qty-input");
        qtyInput.attribute("type", "number");
        qtyInput.attribute("min", "0");
        qtyInput.attribute("max", "99");
        qtyInput.value(qty);
        const incBtn = createButton("+").parent(controls).addClass("cfg-item-step");

        left.mousePressed(() => {
          if (qty > 0) setItemQty(itemKey, 0);
          else setItemQty(itemKey, itemDefaultQty(itemKey));
        });

        decBtn.mousePressed(() => setItemQty(itemKey, qty - 1));
        incBtn.mousePressed(() => setItemQty(itemKey, qty + 1));

        qtyInput.input(() => {
          const raw = parseInt(qtyInput.value());
          if (isNaN(raw)) return;
          setItemQty(itemKey, raw);
        });
        qtyInput.elt.addEventListener("blur", () => {
          const raw = parseInt(qtyInput.value());
          setItemQty(itemKey, isNaN(raw) ? 0 : raw);
        });
      }
    }

    itemSearch.input(() => {
      itemSearchText = itemSearch.value().trim();
      refreshItemChips();
    });
    refreshItemChips();

    // ── Starting Boat ────────────────────────────────────
    createConfigLabelDiv(loadoutSection, "cfg-row-label", "Starting Boat", "sloop", "⛵").style("margin-top", "14px");
    createP("Choose a vessel to begin your voyage (or start on foot).")
      .parent(loadoutSection).style("color", "#667").style("font-size", "11px").style("margin", "2px 0 8px");

    window._newGameStartBoat = null; // null = no boat

    const boatOptions = [
      { key: null, icon: '🚶', label: 'No Boat', desc: 'Start on land — buy one later', cost: 'Free' },
      { key: 'rowboat', icon: '🚣', label: 'Rowboat', desc: 'Slow but gets you sailing', cost: '200g value' },
      { key: 'sloop', icon: '⛵', label: 'Sloop', desc: 'Fast & decent cargo', cost: '600g value' },
      { key: 'galleon', icon: '🚢', label: 'Galleon', desc: 'Massive hold, top speed', cost: '1500g value' },
    ];
    const boatGrid = createDiv().addClass("cfg-boat-grid").parent(loadoutSection);

    for (const opt of boatOptions) {
      const card = createDiv().addClass("cfg-boat-card").parent(boatGrid);
      if (opt.key === null) card.addClass("cfg-boat-active");
      card.attribute("data-boat", opt.key || 'none');

      const iconEl = (typeof createAtlasIconEl === 'function')
        ? createAtlasIconEl(opt.key, 24, opt.icon)
        : (() => {
            const span = document.createElement('span');
            span.textContent = opt.icon;
            return span;
          })();
      iconEl.classList.add("cfg-boat-icon");
      card.elt.appendChild(iconEl);
      createDiv().html(opt.label).addClass("cfg-boat-label").parent(card);
      createDiv().html(opt.desc).addClass("cfg-boat-desc").parent(card);
      createDiv().html(opt.cost).addClass("cfg-boat-cost").parent(card);

      card.mousePressed(() => {
        window._newGameStartBoat = opt.key;
        selectAll("[data-boat]").forEach(c => c.removeClass("cfg-boat-active"));
        card.addClass("cfg-boat-active");
      });
    }

    // ── Starting Bag ─────────────────────────────────────
    createConfigLabelDiv(loadoutSection, "cfg-row-label", "Starting Bag", "Bag", "🎒").style("margin-top", "14px");
    createP("Equip a bag to expand your starting cargo capacity.")
      .parent(loadoutSection).style("color", "#667").style("font-size", "11px").style("margin", "2px 0 8px");

    window._newGameStartBag = null; // null = no bag

    const bagOptions = [
      { key: null,          icon: '🎽', label: 'None',         desc: 'No bag — base 50 cargo',      bonus: '' },
      { key: 'Pouch',       icon: '👝', label: 'Pouch',        desc: 'A small pouch for extra pockets', bonus: '+5 cargo' },
      { key: 'TravelerBag', icon: '🎒', label: 'Traveler Bag', desc: 'A well-worn satchel',          bonus: '+10 cargo' },
      { key: 'BargainSack', icon: '💼', label: 'Bargain Sack', desc: 'A roomy merchant sack',        bonus: '+20 cargo' },
    ];
    const bagGrid = createDiv().addClass("cfg-boat-grid").parent(loadoutSection);

    for (const opt of bagOptions) {
      const card = createDiv().addClass("cfg-boat-card").parent(bagGrid);
      if (opt.key === null) card.addClass("cfg-boat-active");
      card.attribute("data-bag", opt.key || 'none');

      const iconEl = opt.key
        ? createItemIconEl(opt.key, 24)
        : (() => {
            const span = document.createElement('span');
            span.textContent = opt.icon;
            return span;
          })();
      iconEl.classList.add("cfg-boat-icon");
      card.elt.appendChild(iconEl);
      createDiv().html(opt.label).addClass("cfg-boat-label").parent(card);
      createDiv().html(opt.desc).addClass("cfg-boat-desc").parent(card);
      if (opt.bonus) createDiv().html(opt.bonus).addClass("cfg-boat-cost").parent(card);

      card.mousePressed(() => {
        window._newGameStartBag = opt.key;
        selectAll("[data-bag]").forEach(c => c.removeClass("cfg-boat-active"));
        card.addClass("cfg-boat-active");
      });
    }

    // ── Game Mode ─────────────────────────────────────────
    const modeSection = createDiv().addClass("config-section").parent(gameplayTab);
    createConfigSectionTitle(modeSection, "Game Mode", "Shield", "🏛️").style("margin-bottom", "10px");

    const modeRow = createDiv().addClass("cfg-row").parent(modeSection);
    const cmCheckbox = createElement('input').parent(modeRow);
    cmCheckbox.attribute('type', 'checkbox');
    cmCheckbox.attribute('id', 'cityManageToggle');
    cmCheckbox.style('width', '18px').style('height', '18px').style('cursor', 'pointer').style('accent-color', '#f0c040');
    const cmLabel = createElement('label', ' City Management Mode').parent(modeRow);
    cmLabel.attribute('for', 'cityManageToggle');
    cmLabel.style('color', '#ddd').style('cursor', 'pointer').style('margin-left', '6px').style('font-size', '14px');

    createP("Manage cities instead of trading. Set taxes, build structures, create trade routes, defend against raiders, and become the richest ruler in the world.")
      .parent(modeSection).style("color", "#889").style("font-size", "11px").style("margin", "6px 0 0");

    cmCheckbox.changed(() => {
      window._newGameCityManageMode = cmCheckbox.elt.checked;
    });

    // ── World Generation Params ───────────────────────────
    const genSection = createDiv().addClass("config-section").parent(worldGenTab);
    createConfigSectionTitle(genSection, "World Generation", "Cash", "🗺️").style("margin-bottom", "10px");
    createP("Tune terrain style before you start. 1.0 is the default generator behavior.")
      .parent(genSection).style("color", "#889").style("font-size", "11px").style("margin", "2px 0 10px");

    const seedRow = createDiv().addClass("cfg-row").parent(genSection);
    createConfigLabelDiv(seedRow, "cfg-row-label", "World Seed", "Wheel", "🎲");
    const seedInput = createElement("input").parent(seedRow).addClass("config-custom-input").style("max-width", "180px");
    seedInput.attribute("type", "number");
    seedInput.attribute("placeholder", "Random each run");
    seedInput.attribute("aria-label", "World seed number");
    seedInput.input(() => {
      const raw = seedInput.value().trim();
      if (raw === "") {
        window._newGameSeed = null;
        return;
      }
      const v = Number(raw);
      window._newGameSeed = Number.isFinite(v) ? Math.floor(Math.abs(v)) : null;
      seedInput.value(window._newGameSeed ?? "");
    });
    createP("Same seed + same settings = same generated world.")
      .parent(genSection).style("color", "#667").style("font-size", "11px").style("margin", "2px 0 8px");

    function clampGen(v, min, max, d = 1) {
      const n = Number(v);
      if (!Number.isFinite(n)) return d;
      return Math.max(min, Math.min(max, n));
    }

    function makeGenSlider(label, key, min, max, step, hint) {
      const row = createDiv().addClass("cfg-row").parent(genSection);
      createDiv().html(label).addClass("cfg-row-label").parent(row);
      const controlRow = createDiv().addClass("size-slider-row").parent(row);
      const slider = createSlider(min, max, window._newGameWorldGen[key], step)
        .addClass("size-slider")
        .parent(controlRow);
      const valueEl = createSpan(Number(window._newGameWorldGen[key]).toFixed(2))
        .addClass("size-slider-val")
        .style("min-width", "42px")
        .parent(controlRow);
      slider.input(() => {
        const val = clampGen(parseFloat(slider.value()), min, max);
        window._newGameWorldGen[key] = val;
        valueEl.html(val.toFixed(2));
      });
      createP(hint).parent(row).style("color", "#667").style("font-size", "11px").style("margin", "2px 0 0");
    }

    makeGenSlider("Coast Warp", "warp", 0, 2, 0.05, "Higher = twistier coastlines and more irregular land shapes.");
    makeGenSlider("Terrain Ruggedness", "ruggedness", 0.5, 2, 0.05, "Higher = more crags/mountains and rougher transitions.");
    makeGenSlider("Temperature Variance", "temperatureVariance", 0, 2, 0.05, "Higher = stronger hot/cold regional shifts.");
    makeGenSlider("Moisture Variance", "moistureVariance", 0, 2, 0.05, "Higher = bigger desert/forest contrast.");
    makeGenSlider("Coastal Dropoff", "coastalDropoff", 0.4, 2.2, 0.05, "Higher = sharper ocean-edge falloff (more island bias).");

    // ── Buttons ───────────────────────────────────────────
    const btnRow = createDiv().addClass("newgame-btn-row").style("margin-top", "18px").parent(wrapper);

    createButton("Set Sail")
      .parent(btnRow)
      .addClass("menu-btn start-voyage-btn")
      .mousePressed(() => {
        if (typeof startNewGame === 'function') {
          startNewGame(window._newGameMapCols, window._newGameMapRows);
        }
      });

    createButton("Back")
      .parent(btnRow)
      .addClass("settings-btn newgame-back-btn")
      .style("margin-top", "8px")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.MAIN_MENU);
      });

    function updateMapSizeInfo() {
      const c = window._newGameMapCols;
      const r = window._newGameMapRows;
      select("#sizeSliderVal")?.html(`${c} x ${r}`);
      let warn = '';
      if (c > 2000) warn = ' — Very large, may be slow!';
      else if (c > 500) warn = ' — Generation may take a moment';
      const autoCities = Math.min(800, Math.max(20, Math.floor((c * r) / 900)));
      select("#mapInfoLine")?.html(`~${autoCities} default cities${warn}`);
      // Update city slider auto display too
      if (typeof updateCityDisplay === 'function') updateCityDisplay();
    }
    updateMapSizeInfo();

    return wrapper;
  },

  show: () => {
    const w = select("#newGameConfig");
    if (w) { w.show(); w.style("opacity", "1"); }
  },

  hide: () => {
    const w = select("#newGameConfig");
    if (w) { w.style("opacity", "0"); uiManager.scheduleFadeHide("newGameConfig", 200); }
  }
});
