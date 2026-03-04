/**
 * Returns an <img> data-URL tag for any atlas frame, or a fallback emoji.
 * @param {string} frameName - key in ITEMS_ATLAS_DATA.frames
 * @param {number} size - px size
 * @param {string} fallback - emoji if atlas not ready
 */
function atlasIconHTML(frameName, size = 18, fallback = '❓') {
  if (typeof AtlasManager !== 'undefined' && AtlasManager.has(frameName)) {
    const canvas = AtlasManager.createDOMCanvas(frameName, size);
    if (canvas) {
      const url = canvas.toDataURL();
      return `<img src="${url}" width="${size}" height="${size}" style="vertical-align:middle;image-rendering:pixelated;margin-right:2px">`;
    }
  }
  return fallback;
}
function cashIconHTML(size = 18) { return atlasIconHTML('Cash', size, '💰'); }

// ============================
// MAIN MENU
// ============================
uiManager.registerScreen("mainMenu", {
  validStates: [GameStates.MAIN_MENU],

  create: () => {
    const parent = createDiv().id("mainMenu").class("screen");

    // Background decoration
    const bgDecor = createDiv().class("menu-bg-decor");
    bgDecor.parent(parent);
    // Add stars
    for (let i = 0; i < 30; i++) {
      const star = createDiv().class("menu-star");
      star.style("--x", Math.random() * 100 + "%");
      star.style("--y", Math.random() * 100 + "%");
      star.style("--delay", Math.random() * 3 + "s");
      star.style("--duration", (2 + Math.random() * 2) + "s");
      star.parent(bgDecor);
    }

    // Title logo section
    const logoSection = createDiv().class("menu-logo-section");
    logoSection.parent(parent);

    createImg("./assets/working/bargain quest logo.gif", "Game Logo")
      .class("menu-logo")
      .style("image-rendering", "pixelated")
      .parent(logoSection);
    createElement("h1", "BARGAIN QUEST")
      .class("main-title")
      .parent(logoSection);

    // Subtitle shown directly beneath the main title
    createElement("div", "Sales and Sails")
      .addClass("menu-subtitle")
      .parent(logoSection);

    // Menu buttons section
    const buttonsSection = createDiv().class("menu-buttons");
    buttonsSection.parent(parent);

    const continueBtn = createButton("Continue")
      .parent(buttonsSection)
      .addClass("menu-btn")
      .mousePressed(() => {
        if (typeof loadExistingGame === 'function') {
          loadExistingGame();
        }
      });
    continueBtn.id("continueBtn");

    createButton("New Game")
      .parent(buttonsSection)
      .addClass("menu-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.NEW_GAME_CONFIG);
      });

    createButton("Settings")
      .parent(buttonsSection)
      .addClass("menu-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.SETTINGS);
      });

    createButton("Custom Map Editor")
      .parent(buttonsSection)
      .addClass("menu-btn")
      .mousePressed(() => {
        if (!levelEditor) levelEditor = new LevelEditor();
        levelEditor.centreCamera();
        gameStateManager.setState(GameStates.LEVEL_EDITOR);
      });

    createButton("Credits")
      .parent(buttonsSection)
      .addClass("menu-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.CREDITS);
      });
    
    // Footer
    const footer = createP("v1.0");
    footer.class("menu-footer");
    footer.parent(parent);

    return parent;
  },

  show: () => {
    const m = select("#mainMenu");
    if (m) {
      m.addClass("screen-visible");
    }
    const madeBy = select(".menu-made-by");
    if (madeBy) madeBy.show();
    const githubLink = select(".menu-github-link");
    if (githubLink) githubLink.show();
    const cb = select("#continueBtn");
    if (cb) {
      const hasSave = typeof SaveSystem !== 'undefined' && SaveSystem.hasSave();
      cb.style("display", hasSave ? "block" : "none");
    }
  },

  hide: () => {
    const m = select("#mainMenu");
    if (m) {
      m.removeClass("screen-visible");
    }
    const madeBy = select(".menu-made-by");
    if (madeBy) madeBy.hide();
    const githubLink = select(".menu-github-link");
    if (githubLink) githubLink.hide();
  }
});


// ============================
// NEW GAME CONFIG (map size selection)
// ============================
uiManager.registerScreen("newGameConfig", {
  validStates: [GameStates.NEW_GAME_CONFIG],

  create: () => {
    const wrapper = createDiv().id("newGameConfig").class("screen");

    // Animated title with pulsing / drifting
    const titleEl = createElement("h2", "New Voyage").parent(wrapper);
    titleEl.addClass("voyage-title-animated");
    createP("Choose the size of the world and set sail!")
      .parent(wrapper)
      .style("color", "#aaa")
      .style("margin-bottom", "20px")
      .style("font-style", "italic");

    // ── Difficulty ────────────────────────────────────────
    const diffSection = createDiv().addClass("config-section").parent(wrapper);
    createElement("h3", "⚔️ Difficulty").parent(diffSection).style("margin-bottom", "10px");

    window._newGameDifficulty = 'normal';

    const diffGrid = createDiv().addClass("size-card-grid").parent(diffSection);
    const diffOptions = [
      { key: 'easy',     icon: '🟢', label: 'Easy',     desc: 'Relaxed trading, minimal penalties. Very hard to lose.' },
      { key: 'normal',   icon: '🟡', label: 'Normal',   desc: 'Balanced challenge. Death costs gold and items.' },
      { key: 'hard',     icon: '🔴', label: 'Hard',     desc: 'Punishing losses. Tougher raiders, higher costs.' },
      { key: 'hardcore', icon: '💀', label: 'Hardcore',  desc: 'One life. Death deletes your save. No second chances.' },
    ];

    for (const opt of diffOptions) {
      const card = createDiv().addClass("size-card").parent(diffGrid);
      card.attribute("data-diff", opt.key);
      createDiv().html(`${opt.icon} ${opt.label}`).addClass("size-card-label").parent(card);
      createDiv().html(opt.desc).addClass("size-card-desc").parent(card);

      card.mousePressed(() => {
        window._newGameDifficulty = opt.key;
        selectAll("[data-diff]").forEach(c => c.removeClass("size-card-active"));
        card.addClass("size-card-active");
      });

      if (opt.key === 'normal') card.addClass("size-card-active");
    }

    // ── Map Size ──────────────────────────────────────────
    const sizeSection = createDiv().addClass("config-section").parent(wrapper);
    createElement("h3", "World Size").parent(sizeSection).style("margin-bottom", "10px");

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
      const card = createDiv().addClass("size-card").parent(presetGrid);
      card.attribute("data-cols", preset.cols);
      card.attribute("data-rows", preset.rows);
      createDiv().html(preset.label).addClass("size-card-label").parent(card);
      createDiv().html(`${preset.cols} x ${preset.rows}`).addClass("size-card-dim").parent(card);
      createDiv().html(preset.desc).addClass("size-card-desc").parent(card);

      card.mousePressed(() => {
        window._newGameMapCols = preset.cols;
        window._newGameMapRows = preset.rows;
        selectAll(".size-card").forEach(c => c.removeClass("size-card-active"));
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
      selectAll(".size-card").forEach(c => {
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
    const citySection = createDiv().addClass("config-section").parent(wrapper);
    createElement("h3", "City Count").parent(citySection).style("margin-bottom", "8px");

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
    const settingsSection = createDiv().addClass("config-section").parent(wrapper);
    createElement("h3", "World Config").parent(settingsSection).style("margin-bottom", "10px");

    const settingsGrid = createDiv().addClass("settings-grid").parent(settingsSection);

    // Radio-button group helper — pill-style toggle buttons with descriptions
    let _radioUid = 0;
    function makeRadioGroup(parentEl, label, groupName, options, defaultValue, onChange) {
      const card = createDiv().addClass("setting-card").parent(parentEl);
      createDiv().html(label).addClass("setting-card-label").parent(card);
      const pillWrap = createDiv().addClass("pill-group").parent(card);
      const pillIds = [];
      for (const opt of options) {
        const id = `pill_${groupName}_${_radioUid++}`;
        pillIds.push(id);
        const pill = createDiv().parent(pillWrap).addClass("pill-option").id(id);
        if (opt.icon) createSpan(opt.icon).addClass("pill-icon").parent(pill);
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
    window._newGameGoldTarget = 10000;
    window._newGameDayLimit = 0; // 0 = no limit

    makeRadioGroup(settingsGrid, "⚡ Events", "events", [
      { label: "Low", value: 0.03, icon: "🌤️", desc: "Rare random events — peaceful voyages" },
      { label: "Medium", value: 0.10, icon: "🌦️", desc: "Balanced events — some surprises along the way" },
      { label: "High", value: 0.22, icon: "⛈️", desc: "Frequent events — expect the unexpected" },
    ], "Medium", (v) => { window._newGameEventChance = parseFloat(v); });

    makeRadioGroup(settingsGrid, "💀 Raiders", "raiders", [
      { label: "Few", value: 90, icon: "😌", desc: "Raiders are scarce — safer roads" },
      { label: "Normal", value: 60, icon: "⚔️", desc: "Bandits roam regularly — stay alert" },
      { label: "Many", value: 30, icon: "💀", desc: "Danger everywhere — fight or pay up" },
    ], "Normal", (v) => { window._newGameRaiderInterval = parseInt(v); });

    makeRadioGroup(settingsGrid, "🗺️ Landmass", "landmass", [
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
          window._newGameLandmass = -1;
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

    // ══════════════════════════════════════════════════════
    //  ADVANCED OPTIONS (collapsible)
    // ══════════════════════════════════════════════════════
    const advancedToggle = createDiv().addClass("advanced-toggle").parent(wrapper);
    advancedToggle.html('<span class="advanced-arrow">▶</span> Advanced Options');
    const advancedPanel = createDiv().addClass("advanced-panel").id("advancedPanel").parent(wrapper);
    advancedPanel.style("display", "none");

    advancedToggle.mousePressed(() => {
      const panel = select("#advancedPanel");
      const arrow = advancedToggle.elt.querySelector('.advanced-arrow');
      if (panel.elt.style.display === 'none') {
        panel.style("display", "block");
        if (arrow) arrow.textContent = '▼';
        advancedToggle.addClass("advanced-toggle-open");
      } else {
        panel.style("display", "none");
        if (arrow) arrow.textContent = '▶';
        advancedToggle.removeClass("advanced-toggle-open");
      }
    });

    // ── Win Condition ─────────────────────────────────────
    const winSection = createDiv().addClass("config-section").parent(advancedPanel);
    createElement("h3", "Win Condition").parent(winSection).style("margin-bottom", "10px");
    const winGrid = createDiv().addClass("settings-grid").style("grid-template-columns", "1fr 1fr").parent(winSection);

    // Gold target
    const goldCard = createDiv().parent(winGrid);
    createDiv().html("Gold Target").parent(goldCard);
    const goldInput = createElement("input").parent(goldCard).addClass("config-custom-input");
    goldInput.attribute("type", "number");
    goldInput.attribute("min", "200");
    goldInput.attribute("step", "500");
    goldInput.attribute("value", "5000");
    goldInput.attribute("placeholder", "5000");
    goldInput.input(() => {
      const v = parseInt(goldInput.value());
      window._newGameGoldTarget = (!isNaN(v) && v > 0) ? v : 5000;
    });

    // Day limit
    const dayCard = createDiv().parent(winGrid);
    createDiv().html("Day Limit").parent(dayCard);
    const dayInput = createElement("input").parent(dayCard).addClass("config-custom-input");
    dayInput.attribute("type", "number");
    dayInput.attribute("min", "1");
    dayInput.attribute("step", "10");
    dayInput.attribute("value", "20");
    dayInput.attribute("placeholder", "0 = no limit");
    dayInput.input(() => {
      const v = parseInt(dayInput.value());
      window._newGameDayLimit = (!isNaN(v) && v >= 0) ? v : 0;
    });

    // ══════════════════════════════════════════════════════
    //  PLAYER IDENTITY
    // ══════════════════════════════════════════════════════
    const idSection = createDiv().addClass("config-section").parent(advancedPanel);
    createElement("h3", "🧑 Player").parent(idSection).style("margin-bottom", "10px");

    window._newGamePlayerName = '';

    const nameRow = createDiv().addClass("cfg-row").parent(idSection);
    createDiv().html("Captain Name").addClass("cfg-row-label").parent(nameRow);
    const nameInput = createElement("input").parent(nameRow).addClass("config-custom-input").style("max-width", "200px").style("text-align", "left");
    nameInput.attribute("type", "text");
    nameInput.attribute("maxlength", "24");
    nameInput.attribute("placeholder", "Random");
    nameInput.input(() => { window._newGamePlayerName = nameInput.value().trim(); });

    // ══════════════════════════════════════════════════════
    //  STARTING LOADOUT
    // ══════════════════════════════════════════════════════
    const loadoutSection = createDiv().addClass("config-section").parent(advancedPanel);
    createElement("h3", "📦 Starting Loadout").parent(loadoutSection).style("margin-bottom", "10px");

    // Starting Gold
    window._newGameStartGold = 100;
    const goldRow = createDiv().addClass("cfg-row").parent(loadoutSection);
    createDiv().html("Starting Gold").addClass("cfg-row-label").parent(goldRow);
    const startGoldInput = createElement("input").parent(goldRow).addClass("config-custom-input").style("max-width", "100px");
    startGoldInput.attribute("type", "number");
    startGoldInput.attribute("min", "0");
    startGoldInput.attribute("step", "50");
    startGoldInput.attribute("value", "100");
    startGoldInput.input(() => {
      const v = parseInt(startGoldInput.value());
      window._newGameStartGold = (!isNaN(v) && v >= 0) ? v : 100;
    });

    // Grace Period
    window._newGameGracePeriod = 5;
    const graceRow = createDiv().addClass("cfg-row").parent(loadoutSection);
    createDiv().html("Grace Period").addClass("cfg-row-label").parent(graceRow);
    const graceInput = createElement("input").parent(graceRow).addClass("config-custom-input").style("max-width", "80px");
    graceInput.attribute("type", "number");
    graceInput.attribute("min", "0");
    graceInput.attribute("max", "120");
    graceInput.attribute("step", "1");
    graceInput.attribute("value", "5");
    graceInput.input(() => {
      const v = parseInt(graceInput.value());
      window._newGameGracePeriod = (!isNaN(v) && v >= 0) ? v : 5;
    });
    createSpan("sec").parent(graceRow).style("color", "#888").style("font-size", "12px").style("margin-left", "4px");

    // ── Starting Items ───────────────────────────────────
    createDiv().html("Starting Items").addClass("cfg-row-label").style("margin-top", "12px").parent(loadoutSection);
    createP("Click items to add to your starting pack. Click again to remove.")
      .parent(loadoutSection).style("color", "#667").style("font-size", "11px").style("margin", "2px 0 8px");

    window._newGameStartItems = { Fish: 5, Wheat: 3 }; // defaults match Player constructor

    const tradeableItems = ['Fish', 'Wheat', 'Iron', 'Wood', 'Clay', 'Stone', 'Salt', 'Herbs',
                            'Fur', 'Bread', 'Tools', 'Pottery', 'SaltedFish', 'Spices', 'Wine', 'Silk', 'Jewelry'];
    const itemGrid = createDiv().addClass("cfg-item-grid").parent(loadoutSection);

    function refreshItemChips() {
      itemGrid.html('');
      for (const itemName of tradeableItems) {
        const qty = window._newGameStartItems[itemName] || 0;
        const chip = createDiv().parent(itemGrid).addClass("cfg-item-chip");
        if (qty > 0) chip.addClass("cfg-item-active");

        const iconWrapper = createDiv().addClass("cfg-item-icon").parent(chip);
        iconWrapper.elt.appendChild(createItemIconEl(itemName, 20));
        createSpan(itemName.replace(/([A-Z])/g, ' $1').trim()).addClass("cfg-item-name").parent(chip);

        if (qty > 0) {
          const qtySpan = createSpan(`×${qty}`).addClass("cfg-item-qty").parent(chip);
        }

        chip.mousePressed(() => {
          if (qty > 0) {
            // Remove
            delete window._newGameStartItems[itemName];
          } else {
            // Add with default quantity
            window._newGameStartItems[itemName] = 3;
          }
          refreshItemChips();
        });

        // Right-click to adjust quantity
        chip.elt.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (qty > 0) {
            const newQty = parseInt(prompt(`Quantity for ${itemName}:`, qty));
            if (!isNaN(newQty) && newQty > 0) {
              window._newGameStartItems[itemName] = Math.min(99, newQty);
            } else if (newQty === 0 || isNaN(newQty)) {
              delete window._newGameStartItems[itemName];
            }
            refreshItemChips();
          }
        });
      }
    }
    refreshItemChips();

    // ── Starting Boat ────────────────────────────────────
    createDiv().html("Starting Boat").addClass("cfg-row-label").style("margin-top", "14px").parent(loadoutSection);
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

      createSpan(opt.icon).addClass("cfg-boat-icon").parent(card);
      createDiv().html(opt.label).addClass("cfg-boat-label").parent(card);
      createDiv().html(opt.desc).addClass("cfg-boat-desc").parent(card);
      createDiv().html(opt.cost).addClass("cfg-boat-cost").parent(card);

      card.mousePressed(() => {
        window._newGameStartBoat = opt.key;
        selectAll(".cfg-boat-card").forEach(c => c.removeClass("cfg-boat-active"));
        card.addClass("cfg-boat-active");
      });
    }

    // ── Starting Bag ─────────────────────────────────────
    createDiv().html("Starting Bag").addClass("cfg-row-label").style("margin-top", "14px").parent(loadoutSection);
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

      createSpan(opt.icon).addClass("cfg-boat-icon").parent(card);
      createDiv().html(opt.label).addClass("cfg-boat-label").parent(card);
      createDiv().html(opt.desc).addClass("cfg-boat-desc").parent(card);
      if (opt.bonus) createDiv().html(opt.bonus).addClass("cfg-boat-cost").parent(card);

      card.mousePressed(() => {
        window._newGameStartBag = opt.key;
        selectAll("[data-bag]").forEach(c => c.removeClass("cfg-boat-active"));
        card.addClass("cfg-boat-active");
      });
    }

    // ── Buttons ───────────────────────────────────────────
    const btnRow = createDiv().style("margin-top", "18px").parent(wrapper);

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
      .addClass("settings-btn")
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
      const autoCities = Math.max(20, Math.floor((c * r) / 900));
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


// ============================
// LEVEL EDITOR TOOLBAR
// ============================
uiManager.registerScreen("levelEditorToolbar", {
  validStates: [GameStates.LEVEL_EDITOR],

  create: () => {
    // Invisible wrapper that owns both panels — UIManager shows/hides this
    const wrapper = createDiv().id("editorToolbar");
    wrapper.style("position", "fixed").style("inset", "0")
      .style("pointer-events", "none").style("z-index", "200");

    // ═══════════════════════════════════════
    // TOP BAR — drawing / painting tools
    // ═══════════════════════════════════════
    const topBar = createDiv().id("editorTopBar").addClass("editor-topbar").parent(wrapper);

    // — Terrain swatches —
    const terrainTypes = [
      { type: 'Water',  color: '#0077BE', label: '🌊', tip: 'Water' },
      { type: 'Sand',   color: '#C2B280', label: '🏖️', tip: 'Sand' },
      { type: 'Grass',  color: '#5F9F35', label: '🌿', tip: 'Grass' },
      { type: 'Forest', color: '#22551C', label: '🌲', tip: 'Forest' },
      { type: 'Rock',   color: '#787878', label: '⛰️', tip: 'Rock' },
      { type: 'Snow',   color: '#E8F0FF', label: '❄️', tip: 'Snow' },
    ];
    for (const t of terrainTypes) {
      const btn = createButton(t.label).parent(topBar).addClass("editor-topbar-btn");
      btn.style("border-bottom", `3px solid ${t.color}`);
      btn.attribute("data-tool", t.type);
      btn.attribute("title", t.tip);
      btn.mousePressed(() => {
        if (levelEditor) levelEditor.currentTool = t.type;
        _highlightEditorTool(t.type);
      });
    }

    // Divider
    createSpan("").parent(topBar).addClass("editor-topbar-divider");

    // — Placement tools —
    const placeTools = [
      { tool: 'city',        label: '🏘️', tip: 'Place City' },
      { tool: 'playerStart', label: '🧑', tip: 'Player Start' },
      { tool: 'raiderSpawn', label: '💀', tip: 'Raider Spawn' },
      { tool: 'eraser',      label: '🧹', tip: 'Eraser' },
    ];
    for (const p of placeTools) {
      const btn = createButton(p.label).parent(topBar).addClass("editor-topbar-btn");
      btn.attribute("data-tool", p.tool);
      btn.attribute("title", p.tip);
      btn.mousePressed(() => {
        if (levelEditor) levelEditor.currentTool = p.tool;
        _highlightEditorTool(p.tool);
      });
    }

    // Divider
    createSpan("").parent(topBar).addClass("editor-topbar-divider");

    // — Brush size presets —
    const brushPresets = [
      { size: 1, label: "1×1" },
      { size: 2, label: "3×3" },
      { size: 3, label: "5×5" },
      { size: 5, label: "9×9" },
    ];
    for (const bp of brushPresets) {
      const btn = createButton(bp.label).parent(topBar).addClass("editor-topbar-btn editor-topbar-btn-sm");
      btn.attribute("data-brush", bp.size);
      btn.attribute("title", `Brush ${bp.label}`);
      btn.mousePressed(() => {
        if (levelEditor) levelEditor.brushSize = bp.size;
        _highlightEditorBrush(bp.size);
      });
    }

    // Custom brush input
    const customBrushInp = createElement("input").parent(topBar).addClass("editor-topbar-input");
    customBrushInp.attribute("type", "number").attribute("min", "1").attribute("max", "20");
    customBrushInp.attribute("value", "1").attribute("title", "Custom brush radius");
    customBrushInp.id("editorCustomBrush");
    customBrushInp.input(() => {
      const v = constrain(parseInt(customBrushInp.value()) || 1, 1, 20);
      if (levelEditor) levelEditor.brushSize = v;
      _highlightEditorBrush(v);
    });
    const brushAreaLabel = createSpan("1×1").parent(topBar)
      .style("color", "#888").style("font-size", "10px").style("white-space", "nowrap");
    brushAreaLabel.id("editorBrushAreaLabel");

    // Divider
    createSpan("").parent(topBar).addClass("editor-topbar-divider");

    // — Quick actions —
    createButton("↩ Undo").parent(topBar).addClass("editor-topbar-btn editor-topbar-btn-sm")
      .attribute("title", `Undo (${getActionDisplay('editorUndo')})`)
      .mousePressed(() => { if (levelEditor) levelEditor.undo(); });
    createButton("🪣 Fill").parent(topBar).addClass("editor-topbar-btn editor-topbar-btn-sm")
      .attribute("title", `Flood Fill (${getActionDisplay('editorFlood')})`)
      .mousePressed(() => {
        if (levelEditor) {
          const { x, y } = levelEditor.screenToGrid(mouseX, mouseY);
          const type = levelEditor.currentTool === 'eraser' ? 'Water' : levelEditor.currentTool;
          if (['Water','Sand','Grass','Forest','Rock','Snow'].includes(type)) {
            levelEditor.floodFill(x, y, type);
          }
        }
      });
    createButton("🗑️ Clear").parent(topBar).addClass("editor-topbar-btn editor-topbar-btn-sm editor-action-danger")
      .attribute("title", "Clear entire map")
      .mousePressed(() => {
        if (levelEditor && confirm("Clear entire map?")) {
          levelEditor._initGrid();
          levelEditor.centreCamera();
        }
      });

    // ═══════════════════════════════════════
    // LEFT SIDEBAR — settings / config
    // ═══════════════════════════════════════
    const sidebar = createDiv().id("editorSidebar").addClass("editor-sidebar").parent(wrapper);

    // ── Map Size ──
    const sizeSection = createDiv().addClass("editor-section").parent(sidebar);
    createElement("h4", "Map Size").parent(sizeSection);
    const sizeRow = createDiv().style("display", "flex").style("gap", "4px").style("align-items", "center").parent(sizeSection);
    const colInp = createElement("input").parent(sizeRow).addClass("editor-num-input");
    colInp.attribute("type", "number"); colInp.attribute("min", "10"); colInp.attribute("max", "500");
    colInp.attribute("value", "60"); colInp.id("editorCols");
    createSpan("×").parent(sizeRow).style("color", "#888");
    const rowInp = createElement("input").parent(sizeRow).addClass("editor-num-input");
    rowInp.attribute("type", "number"); rowInp.attribute("min", "10"); rowInp.attribute("max", "500");
    rowInp.attribute("value", "60"); rowInp.id("editorRows");
    createButton("Resize").parent(sizeRow).addClass("editor-small-btn").mousePressed(() => {
      const c = parseInt(colInp.value()) || 60;
      const r = parseInt(rowInp.value()) || 60;
      if (levelEditor) {
        levelEditor.resize(
          constrain(c, 10, 500),
          constrain(r, 10, 500)
        );
        levelEditor.centreCamera();
      }
    });

    // ── Raider / Monster Config ──
    const raiderSection = createDiv().addClass("editor-section").parent(sidebar);
    createElement("h4", "Raider Config").parent(raiderSection);

    const raiderOpts = createDiv().style("display", "flex").style("flex-direction", "column").style("gap", "4px").parent(raiderSection);

    // Type selector
    const typeRow = createDiv().style("display", "flex").style("gap", "4px").style("align-items", "center").parent(raiderOpts);
    createSpan("Type:").parent(typeRow).style("color", "#aaa").style("font-size", "11px").style("min-width", "36px");
    const raiderTypeSelect = createElement("select").parent(typeRow).style("flex", "1")
      .style("background", "#2a2a2a").style("color", "#ddd").style("border", "1px solid #555")
      .style("border-radius", "4px").style("padding", "2px 4px").style("font-size", "11px");
    const raiderTypes = [
      { value: 'bandit', label: '🗡️ Bandit' },
      { value: 'dragon', label: '🐉 Dragon' },
      { value: 'blackKnight', label: '⚔️ Black Knight' },
      { value: 'wraith', label: '👻 Wraith' },
    ];
    for (const rt of raiderTypes) {
      createElement("option", rt.label).parent(raiderTypeSelect).attribute("value", rt.value);
    }
    raiderTypeSelect.changed(() => {
      if (levelEditor) levelEditor.raiderSpawnType = raiderTypeSelect.value();
    });

    // Pirate checkbox
    const pirateRow = createDiv().style("display", "flex").style("gap", "4px").style("align-items", "center").parent(raiderOpts);
    const pirateCb = createElement("input").parent(pirateRow).attribute("type", "checkbox").id("editorPirateCb");
    createElement("label", "Pirate (water)").parent(pirateRow).attribute("for", "editorPirateCb")
      .style("color", "#aaa").style("font-size", "11px");
    pirateCb.changed(() => {
      if (levelEditor) levelEditor.raiderSpawnIsPirate = pirateCb.elt.checked;
    });

    // Name input
    const nameRow = createDiv().style("display", "flex").style("gap", "4px").style("align-items", "center").parent(raiderOpts);
    createSpan("Name:").parent(nameRow).style("color", "#aaa").style("font-size", "11px").style("min-width", "36px");
    const raiderNameInput = createElement("input").parent(nameRow).attribute("type", "text")
      .attribute("placeholder", "(auto)").style("flex", "1")
      .style("background", "#2a2a2a").style("color", "#ddd").style("border", "1px solid #555")
      .style("border-radius", "4px").style("padding", "2px 4px").style("font-size", "11px");
    raiderNameInput.input(() => {
      if (levelEditor) levelEditor.raiderSpawnName = raiderNameInput.value();
    });

    // Strength slider
    const strRow = createDiv().style("display", "flex").style("gap", "4px").style("align-items", "center").parent(raiderOpts);
    createSpan("Str:").parent(strRow).style("color", "#aaa").style("font-size", "11px").style("min-width", "24px");
    const strSlider = createElement("input").parent(strRow).attribute("type", "range")
      .attribute("min", "1").attribute("max", "10").attribute("value", "3")
      .style("flex", "1").style("height", "14px");
    const strLabel = createSpan("3").parent(strRow).style("color", "#ddd").style("font-size", "11px").style("min-width", "14px");
    strSlider.input(() => {
      const v = parseInt(strSlider.value());
      strLabel.html(v);
      if (levelEditor) levelEditor.raiderSpawnStrength = v;
    });

    // ── City Item Editor ──
    const cityItemSection = createDiv().addClass("editor-section").parent(sidebar);
    createElement("h4", "City Items").parent(cityItemSection);
    const cityItemInfo = createSpan("Select a city to edit items").parent(cityItemSection)
      .style("font-size", "10px").style("color", "#888").style("display", "block").style("margin-bottom", "4px");
    cityItemInfo.id("editorCityItemInfo");

    // City selector dropdown
    const citySelectRow = createDiv().style("display", "flex").style("gap", "4px").style("align-items", "center").parent(cityItemSection);
    const citySelect = createElement("select").parent(citySelectRow).style("flex", "1")
      .style("background", "#2a2a2a").style("color", "#ddd").style("border", "1px solid #555")
      .style("border-radius", "4px").style("padding", "2px 4px").style("font-size", "11px");
    citySelect.id("editorCitySelect");
    createElement("option", "— none —").parent(citySelect).attribute("value", "");
    const refreshCityBtn = createButton("↻").parent(citySelectRow).addClass("editor-small-btn")
      .style("padding", "2px 6px");
    refreshCityBtn.mousePressed(() => _refreshEditorCitySelect());

    // City name input — renames selected city, or sets name for next placed city
    const cityNameRow = createDiv().style("display", "flex").style("gap", "4px").style("align-items", "center").style("margin-top", "4px").parent(cityItemSection);
    createSpan("Name:").parent(cityNameRow).style("color", "#aaa").style("font-size", "11px").style("min-width", "36px");
    const cityNameInput = createElement("input").parent(cityNameRow).attribute("type", "text")
      .attribute("placeholder", "next city name (auto)").style("flex", "1")
      .style("background", "#2a2a2a").style("color", "#ddd").style("border", "1px solid #555")
      .style("border-radius", "4px").style("padding", "2px 4px").style("font-size", "11px");
    cityNameInput.id("editorCityNameInput");
    cityNameInput.input(() => {
      if (!levelEditor) return;
      const sel = document.getElementById('editorCitySelect');
      const idx = sel ? parseInt(sel.value) : NaN;
      if (!isNaN(idx) && idx >= 0 && idx < levelEditor.cities.length) {
        // Rename the selected city
        levelEditor.cities[idx].name = cityNameInput.value();
        // Update the dropdown option text without resetting selection
        const opt = sel.options[idx + 1]; // +1 for "— none —"
        if (opt) opt.textContent = `${cityNameInput.value()} (${levelEditor.cities[idx].x},${levelEditor.cities[idx].y})`;
      } else {
        // No city selected — set name for next placed city
        levelEditor.nextCityName = cityNameInput.value();
      }
    });

    // City Preset row
    const presetRow = createDiv().style("margin-top", "4px").parent(cityItemSection);
    createSpan("Preset:").parent(presetRow).style("color", "#aaa").style("font-size", "11px")
      .style("display", "block").style("margin-bottom", "2px");
    const presetSel = createSelect().id("cityPresetSel").parent(presetRow).style("width", "100%")
      .style("background", "#2a2a2a").style("color", "#ddd").style("border", "1px solid #555")
      .style("border-radius", "4px").style("padding", "2px 4px").style("font-size", "11px");
    if (typeof levelEditor !== 'undefined' && levelEditor && typeof levelEditor.getPresetLabels === 'function') {
      for (const { key, label } of levelEditor.getPresetLabels()) {
        presetSel.option(label, key);
      }
    } else {
      // Fallback if levelEditor not yet initialized
      for (const [key, label] of [['none','Default'],['port','Port City'],['mining','Mining Town'],['farming','Farming Village'],['market','Trade Hub']]) {
        presetSel.option(label, key);
      }
    }
    presetSel.changed(() => {
      if (!levelEditor || levelEditor.cities.length === 0) return;
      const citySelEl = document.getElementById('editorCitySelect');
      const idx = citySelEl ? parseInt(citySelEl.value) : NaN;
      const targetIdx = (!isNaN(idx) && idx >= 0 && idx < levelEditor.cities.length)
        ? idx : levelEditor.cities.length - 1;
      levelEditor.setCityPreset(targetIdx, presetSel.value());
      _refreshEditorCityInventory();
    });

    // Item add row
    const itemAddRow = createDiv().style("display", "flex").style("gap", "4px").style("align-items", "center").style("margin-top", "4px").parent(cityItemSection);
    const itemSelect = createElement("select").parent(itemAddRow).style("flex", "1")
      .style("background", "#2a2a2a").style("color", "#ddd").style("border", "1px solid #555")
      .style("border-radius", "4px").style("padding", "2px 4px").style("font-size", "11px");
    itemSelect.id("editorItemSelect");
    if (typeof ItemLibrary !== 'undefined') {
      for (const key of Object.keys(ItemLibrary)) {
        const icon = (typeof ITEM_ICONS !== 'undefined' && ITEM_ICONS[key]) || null;
        let prefix = '📦 ';
        if (icon && icon.emoji) prefix = icon.emoji + ' ';
        createElement("option", `${prefix}${key}`).parent(itemSelect).attribute("value", key);
      }
    }
    const itemQtyInp = createElement("input").parent(itemAddRow).addClass("editor-num-input").style("width", "40px");
    itemQtyInp.attribute("type", "number"); itemQtyInp.attribute("min", "1"); itemQtyInp.attribute("max", "999");
    itemQtyInp.attribute("value", "10"); itemQtyInp.id("editorItemQty");

    createButton("Add").parent(itemAddRow).addClass("editor-small-btn").mousePressed(() => {
      _editorAddItemToCity();
    });

    // City inventory display
    const cityInvDiv = createDiv().parent(cityItemSection)
      .style("max-height", "100px").style("overflow-y", "auto").style("font-size", "10px")
      .style("color", "#ccc").style("margin-top", "4px").style("background", "#1a1a2e")
      .style("border-radius", "4px").style("padding", "4px");
    cityInvDiv.id("editorCityInvList");
    cityInvDiv.html("<em>No city selected</em>");

    citySelect.changed(() => {
      _refreshEditorCityInventory();
      // Sync name input with selected city
      const nameInp = document.getElementById('editorCityNameInput');
      if (!nameInp || !levelEditor) return;
      const idx = parseInt(citySelect.value());
      if (!isNaN(idx) && idx >= 0 && idx < levelEditor.cities.length) {
        nameInp.value = levelEditor.cities[idx].name || '';
        nameInp.placeholder = 'rename city';
        // Sync preset dropdown
        const presetSelEl = document.getElementById('cityPresetSel');
        if (presetSelEl) presetSelEl.value = levelEditor.cities[idx].preset || 'none';
      } else {
        nameInp.value = levelEditor.nextCityName || '';
        nameInp.placeholder = 'next city name (auto)';
      }
    });

    // ── Save / Load ──
    const saveSection = createDiv().addClass("editor-section").parent(sidebar);
    createElement("h4", "Save / Load").parent(saveSection);

    const slotRow = createDiv().style("display", "flex").style("gap", "4px").style("margin-bottom", "6px").parent(saveSection);
    const slotInp = createElement("input").parent(slotRow).addClass("editor-num-input").style("flex", "1");
    slotInp.attribute("type", "text"); slotInp.attribute("placeholder", "Map name");
    slotInp.attribute("value", "mymap"); slotInp.id("editorSlotName");

    const saveBtnRow = createDiv().style("display", "flex").style("gap", "4px").parent(saveSection);
    createButton("Save").parent(saveBtnRow).addClass("editor-small-btn").mousePressed(() => {
      const name = select("#editorSlotName")?.value() || 'mymap';
      if (levelEditor) { levelEditor.saveToStorage(name); alert(`Map "${name}" saved!`); }
    });
    createButton("Load").parent(saveBtnRow).addClass("editor-small-btn").mousePressed(() => {
      const name = select("#editorSlotName")?.value() || 'mymap';
      if (levelEditor) {
        if (levelEditor.loadFromStorage(name)) {
          levelEditor.centreCamera();
          select("#editorCols")?.value(levelEditor.cols);
          select("#editorRows")?.value(levelEditor.rows);
        } else {
          alert(`No saved map named "${name}"`);
        }
      }
    });
    createButton("Delete").parent(saveBtnRow).addClass("editor-small-btn editor-action-danger").mousePressed(() => {
      const name = select("#editorSlotName")?.value() || 'mymap';
      if (confirm(`Delete map "${name}"?`)) {
        LevelEditor.deleteSavedMap(name);
      }
    });

    // List saved maps
    const listBtn = createButton("List Saved Maps").parent(saveSection).addClass("editor-action-btn").style("margin-top", "4px");
    const listDiv = createDiv().parent(saveSection).style("max-height", "80px").style("overflow-y", "auto").style("font-size", "11px").style("color", "#aaa");
    listDiv.id("editorMapList");
    listBtn.mousePressed(() => {
      const maps = LevelEditor.listSavedMaps();
      const ld = select("#editorMapList");
      if (ld) ld.html(maps.length ? maps.map(m => `<div style="cursor:pointer;padding:2px 0" class="editor-saved-item" data-name="${m}">📄 ${m}</div>`).join('') : '<em>No saved maps</em>');
      document.querySelectorAll('.editor-saved-item').forEach(el => {
        el.addEventListener('click', () => {
          const n = el.getAttribute('data-name');
          select("#editorSlotName")?.value(n);
          if (levelEditor && levelEditor.loadFromStorage(n)) {
            levelEditor.centreCamera();
            select("#editorCols")?.value(levelEditor.cols);
            select("#editorRows")?.value(levelEditor.rows);
          }
        });
      });
    });

    // ── Play / Back ──
    const bottomSection = createDiv().addClass("editor-section").style("margin-top", "auto").parent(sidebar);

    createButton("▶ Play This Map").parent(bottomSection).addClass("editor-play-btn")
      .mousePressed(() => {
        if (typeof startGameFromEditor === 'function') startGameFromEditor();
      });

    createButton("← Back to Menu").parent(bottomSection).addClass("editor-action-btn")
      .style("margin-top", "6px")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.MAIN_MENU);
      });

    // ── Help text ──
    const helpDiv = createDiv().parent(sidebar).style("font-size", "10px").style("color", "#666").style("margin-top", "8px").style("line-height", "1.4");
    helpDiv.html(`WASD / Right-drag: Pan &nbsp;|&nbsp; Scroll: Zoom<br>${getActionDisplay('editorFlood')}: Fill &nbsp;|&nbsp; 1-9: Brush &nbsp;|&nbsp; ${getActionDisplay('editorUndo')}: Undo`);

    return wrapper;
  },

  show: () => {
    const w = select("#editorToolbar");
    if (w) w.style("display", "block");
    document.addEventListener('contextmenu', _editorBlockContext);
    setTimeout(() => {
      if (levelEditor) {
        _highlightEditorTool(levelEditor.currentTool);
        _highlightEditorBrush(levelEditor.brushSize);
        _refreshEditorCitySelect();
      }
    }, 50);
  },

  hide: () => {
    const w = select("#editorToolbar");
    if (w) w.style("display", "none");
    document.removeEventListener('contextmenu', _editorBlockContext);
  }
});

function _editorBlockContext(e) { e.preventDefault(); }

/** Highlight the active tool button */
function _highlightEditorTool(toolName) {
  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.classList.toggle('editor-tool-active', btn.getAttribute('data-tool') === toolName);
  });
}

/** Highlight the active brush size button */
function _highlightEditorBrush(size) {
  document.querySelectorAll('[data-brush]').forEach(btn => {
    btn.classList.toggle('editor-tool-active', parseInt(btn.getAttribute('data-brush')) === size);
  });
  // Update custom input and area label
  const ci = select("#editorCustomBrush");
  if (ci) ci.value(size);
  const dim = (size - 1) * 2 + 1;
  const lbl = select("#editorBrushAreaLabel");
  if (lbl) lbl.html(`${dim}×${dim}`);
}

/** Refresh the city dropdown in the editor */
function _refreshEditorCitySelect() {
  const sel = document.getElementById('editorCitySelect');
  if (!sel || !levelEditor) return;
  sel.innerHTML = '<option value="">— none —</option>';
  for (let i = 0; i < levelEditor.cities.length; i++) {
    const c = levelEditor.cities[i];
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${c.name} (${c.x},${c.y})`;
    sel.appendChild(opt);
  }
  // Reset name input to "next city" mode
  const nameInp = document.getElementById('editorCityNameInput');
  if (nameInp) {
    nameInp.value = levelEditor.nextCityName || '';
    nameInp.placeholder = 'next city name (auto)';
  }
  _refreshEditorCityInventory();
}

/** Show the current inventory of the selected city */
function _refreshEditorCityInventory() {
  const sel = document.getElementById('editorCitySelect');
  const invDiv = document.getElementById('editorCityInvList');
  if (!sel || !invDiv || !levelEditor) return;
  const idx = parseInt(sel.value);
  if (isNaN(idx) || idx < 0 || idx >= levelEditor.cities.length) {
    invDiv.innerHTML = '<em>No city selected</em>';
    return;
  }
  const city = levelEditor.cities[idx];
  if (!city.items || Object.keys(city.items).length === 0) {
    invDiv.innerHTML = '<em>No items — uses terrain defaults</em>';
    return;
  }
  invDiv.innerHTML = '';
  for (const [key, qty] of Object.entries(city.items)) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:2px 0';
    // Left side: icon + name
    const left = document.createElement('span');
    left.style.cssText = 'display:flex;align-items:center;gap:3px';
    if (typeof createItemIconEl === 'function') {
      left.appendChild(createItemIconEl(key, 14));
    }
    const nameSpan = document.createElement('span');
    nameSpan.textContent = key;
    left.appendChild(nameSpan);
    row.appendChild(left);
    // Right side: quantity + remove button
    const right = document.createElement('span');
    right.style.cssText = 'display:flex;gap:2px;align-items:center';
    const qtySpan = document.createElement('span');
    qtySpan.style.color = '#ffd700';
    qtySpan.textContent = `×${qty}`;
    right.appendChild(qtySpan);
    const rmBtn = document.createElement('button');
    rmBtn.className = 'editor-city-item-remove';
    rmBtn.setAttribute('data-city', idx);
    rmBtn.setAttribute('data-item', key);
    rmBtn.style.cssText = 'background:#522;border:1px solid #744;color:#f88;padding:0 4px;border-radius:3px;cursor:pointer;font-size:9px';
    rmBtn.textContent = '✕';
    right.appendChild(rmBtn);
    row.appendChild(right);
    invDiv.appendChild(row);
  }
  // Bind remove buttons
  invDiv.querySelectorAll('.editor-city-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const ci = parseInt(btn.getAttribute('data-city'));
      const item = btn.getAttribute('data-item');
      if (levelEditor && levelEditor.cities[ci] && levelEditor.cities[ci].items) {
        delete levelEditor.cities[ci].items[item];
        _refreshEditorCityInventory();
      }
    });
  });
}

/** Add an item to the selected city */
function _editorAddItemToCity() {
  const cityIdx = parseInt(document.getElementById('editorCitySelect')?.value);
  const itemKey = document.getElementById('editorItemSelect')?.value;
  const qty = parseInt(document.getElementById('editorItemQty')?.value) || 10;
  if (!levelEditor || isNaN(cityIdx) || cityIdx < 0 || cityIdx >= levelEditor.cities.length) return;
  if (!itemKey) return;
  const city = levelEditor.cities[cityIdx];
  if (!city.items) city.items = {};
  city.items[itemKey] = (city.items[itemKey] || 0) + qty;
  _refreshEditorCityInventory();
}

/** Called when a city is placed/toggled — auto-refresh the select */
function _editorOnCityChanged() {
  _refreshEditorCitySelect();
  // Sync preset dropdown to the last placed city
  const presetSelEl = document.getElementById('cityPresetSel');
  if (presetSelEl && typeof levelEditor !== 'undefined' && levelEditor?.cities.length > 0) {
    presetSelEl.value = levelEditor.cities[levelEditor.cities.length - 1].preset || 'none';
  }
}


// ============================
// PAUSE MENU (with save/load)
// ============================
uiManager.registerScreen("pauseMenu", {
  validStates: [GameStates.PAUSED],

  create: () => {
    const wrapper = createDiv().id("pauseMenu").class("screen");

    createElement("h2", "Game Paused").parent(wrapper);

    createButton("Resume")
      .parent(wrapper)
      .addClass("pause-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.PLAYING);
      });

    createButton("Save Game")
      .parent(wrapper)
      .addClass("pause-btn")
      .mousePressed(() => {
        if (typeof SaveSystem !== 'undefined') {
          SaveSystem.save();
          if (typeof notificationManager !== 'undefined') {
            notificationManager.log("Game Saved!", "success");
          }
        }
      });

    createButton("Load Game")
      .parent(wrapper)
      .addClass("pause-btn")
      .mousePressed(() => {
        if (typeof SaveSystem !== 'undefined' && SaveSystem.hasSave() && typeof loadExistingGame === 'function') {
          // Use the full load pipeline that cleans up old objects, regenerates sprites, etc.
          gameStateManager.setState(GameStates.PLAYING); // close pause menu first
          loadExistingGame();
        }
      });

    createButton("Settings")
      .parent(wrapper)
      .addClass("pause-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.SETTINGS);
      });

    createButton("Quit to Main Menu")
      .parent(wrapper)
      .addClass("pause-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.MAIN_MENU);
      });

    return wrapper;
  },

  show: () => {
    const w = select("#pauseMenu");
    if (w) { w.show(); w.style("opacity", "1"); }
  },

  hide: () => {
    const w = select("#pauseMenu");
    if (w) { w.style("opacity", "0"); uiManager.scheduleFadeHide("pauseMenu", 200); }
  }
});


// ============================
// SETTINGS MENU
// ============================
uiManager.registerScreen("settingsMenu", {
  validStates: [GameStates.SETTINGS],

  create: () => {
    const wrapper = createDiv().id("settingsMenu").class("screen");
    wrapper.style("max-width", "560px").style("max-height", "90vh").style("overflow-y", "auto");

    createElement("h2", "Settings").parent(wrapper);

    // ── Audio ──
    const audioSection = createDiv().addClass("config-section").parent(wrapper);
    createElement("h3", "Audio").parent(audioSection).style("margin-bottom", "8px");

    const musicRow = createDiv().addClass("settings-slider-row").parent(audioSection);
    createSpan("Music").addClass("settings-slider-label").parent(musicRow);
    createSlider(0, 1, 0.5, 0.01).id("musicSlider").addClass("size-slider").parent(musicRow);

    const sfxRow = createDiv().addClass("settings-slider-row").parent(audioSection);
    createSpan("Sound").addClass("settings-slider-label").parent(sfxRow);
    createSlider(0, 1, 0.5, 0.01).id("gameSlider").addClass("size-slider").parent(sfxRow);

    // ── Game Speed ──
    const speedSection = createDiv().addClass("config-section").parent(wrapper);
    createElement("h3", "Game Speed").parent(speedSection).style("margin-bottom", "8px");
    const speedSelect = createSelect().id("speedSelect").parent(speedSection).addClass("setting-select");
    speedSelect.option("0.25×", 0);
    speedSelect.option("0.5×", 1);
    speedSelect.option("1× (Normal)", 2);
    speedSelect.option("2×", 3);
    speedSelect.option("4×", 4);
    speedSelect.selected("1× (Normal)");
    speedSelect.changed(() => {
      const idx = parseInt(speedSelect.value());
      if (typeof SPEED_STEPS !== 'undefined') {
        gameSpeedIndex = idx;
        gameSpeed = SPEED_STEPS[idx];
        syncSpeedDisplay();
      }
    });

    // ── World & Performance ──
    const aiSection = createDiv().addClass("config-section").parent(wrapper);
    createElement("h3", "World & Performance").parent(aiSection).style("margin-bottom","8px");
    const aiRows = [
      { label:"Active AI Radius", id:"aiRadiusSlider",  min:40,  max:200, step:10,  key:"pref_ai_radius",  def:80  },
      { label:"AI Frame Skip",    id:"aiSkipSlider",    min:4,   max:32,  step:4,   key:"pref_ai_skip",    def:8   },
      { label:"Spawn Rate",       id:"spawnRateSlider", min:0.5, max:2.0, step:0.1, key:"pref_spawn_rate", def:1.0 },
    ];
    for (const row of aiRows) {
      const r = createDiv().addClass("settings-slider-row").parent(aiSection);
      createSpan(row.label).addClass("settings-slider-label").parent(r);
      createSpan("").id(`${row.id}Val`).addClass("settings-slider-val").style("min-width","30px").style("text-align","right").parent(r);
      createSlider(row.min, row.max, row.def, row.step).id(row.id).addClass("size-slider").parent(r);
    }

    // ── Controls ──
    const controlsSection = createDiv().addClass("config-section").parent(wrapper);
    createElement("h3", "Controls").parent(controlsSection).style("margin-bottom", "8px");

    const keybindGrid = createDiv().id("keybindGrid").addClass("keybind-grid").parent(controlsSection);

    // Build keybinding rows (will be populated/refreshed in show())
    function buildKeybindRows() {
      const grid = document.getElementById("keybindGrid");
      if (!grid) return;
      grid.innerHTML = "";

      const actions = Object.keys(keyBindings);
      for (const action of actions) {
        const binding = keyBindings[action];

        const row = document.createElement("div");
        row.className = "keybind-row";

        const label = document.createElement("span");
        label.className = "keybind-label";
        label.textContent = binding.label;
        row.appendChild(label);

        const keyDisplay = document.createElement("button");
        keyDisplay.className = "keybind-btn";
        keyDisplay.textContent = getActionDisplay(action);
        keyDisplay.title = "Click to rebind, then press a new key";
        keyDisplay.addEventListener("click", (e) => {
          e.stopPropagation();
          // Enter listening mode
          keyDisplay.textContent = "Press a key...";
          keyDisplay.classList.add("keybind-listening");

          function onKey(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            const code = ev.keyCode;
            // Set this action to the single pressed key
            keyBindings[action].keys = [code];
            keyBindings[action].display = _keyCodeToName(code);
            saveKeyBindings();
            keyDisplay.textContent = getActionDisplay(action);
            keyDisplay.classList.remove("keybind-listening");
            document.removeEventListener("keydown", onKey, true);
            if (typeof notificationManager !== 'undefined') {
              notificationManager.log(`${binding.label} bound to ${_keyCodeToName(code)}`, "info");
            }
          }
          document.addEventListener("keydown", onKey, true);
        });
        row.appendChild(keyDisplay);

        grid.appendChild(row);
      }
    }

    // Expose for refresh
    window._buildKeybindRows = buildKeybindRows;

    // Reset controls button
    const controlsBtnRow = createDiv().style("margin-top", "8px").style("text-align", "center").parent(controlsSection);
    const resetKeysBtn = document.createElement("button");
    resetKeysBtn.className = "settings-btn";
    resetKeysBtn.textContent = "Reset to Defaults";
    resetKeysBtn.style.width = "auto";
    resetKeysBtn.style.display = "inline-block";
    resetKeysBtn.style.padding = "6px 16px";
    resetKeysBtn.style.fontSize = "0.85em";
    resetKeysBtn.addEventListener("click", () => {
      resetKeyBindings();
      buildKeybindRows();
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log("Controls reset to defaults", "info");
      }
    });
    controlsBtnRow.elt.appendChild(resetKeysBtn);

    // ── Danger Zone ──
    createDiv().style("margin-top", "12px").parent(wrapper);
    createButton("Clear All Saved Data")
      .parent(wrapper)
      .addClass("danger-btn")
      .mousePressed(() => {
        if (confirm("Are you sure? This will delete all saved settings and game data.")) {
          localStorage.clear();
          select("#musicSlider")?.value(0.5);
          select("#gameSlider")?.value(0.5);
          if (typeof sound !== "undefined") {
            if (sound.setMusicVolume) sound.setMusicVolume(0.5);
            if (sound.setGameVolume) sound.setGameVolume(0.5);
          }
          resetKeyBindings();
          buildKeybindRows();


          
          window.location.reload();
        }
      });

    createButton("Back")
      .parent(wrapper)
      .addClass("settings-btn")
      .mousePressed(() => {
        gameStateManager.setState(gameStateManager.prev);
      });

    return wrapper;
  },

  show: () => {
    const m = select("#settingsMenu");
    if (m) {
      m.show();
      m.style("opacity", "1");
      const music = parseFloat(localStorage.getItem("music_vol")) || 0.5;
      const game = parseFloat(localStorage.getItem("game_vol")) || 0.5;
      select("#musicSlider")?.value(music);
      select("#gameSlider")?.value(game);
      const ms = select("#musicSlider");
      const gs = select("#gameSlider");
      if (ms) ms.elt.oninput = () => saveSettings();
      if (gs) gs.elt.oninput = () => saveSettings();
      // Sync speed selector
      if (typeof gameSpeedIndex !== 'undefined') {
        select("#speedSelect")?.value(gameSpeedIndex);
      }
      // Rebuild keybind rows to reflect current bindings
      if (typeof _buildKeybindRows === 'function') _buildKeybindRows();

      // Sync AI tuning sliders
      const aiDefs = [
        { id:'aiRadiusSlider',  key:'pref_ai_radius',  def:80  },
        { id:'aiSkipSlider',    key:'pref_ai_skip',    def:8   },
        { id:'spawnRateSlider', key:'pref_spawn_rate', def:1.0 },
      ];
      for (const d of aiDefs) {
        const stored = localStorage.getItem(d.key);
        const val = stored != null ? parseFloat(stored) : d.def;
        const sl = select(`#${d.id}`);
        if (sl) {
          sl.value(val);
          sl.elt.oninput = () => saveAISettings();
        }
        const lbl = document.getElementById(`${d.id}Val`);
        if (lbl) lbl.textContent = val.toFixed(1);
      }
    }
  },

  hide: () => {
    const m = select("#settingsMenu");
    if (m) { m.style("opacity", "0"); uiManager.scheduleFadeHide("settingsMenu", 200); }
  }
});


// ============================
// CREDITS
// ============================
uiManager.registerScreen("credits", {
  validStates: [GameStates.CREDITS],

  create: () => {
    const wrapper = createDiv().id("credits").class("screen");
    createElement("h2", "Credits").parent(wrapper).addClass("credits-title");

    const container = createDiv().addClass("credits-container").parent(wrapper);

    // Card: Game design & code
    const card1 = createDiv().addClass("credits-card").parent(container);
    createElement("h3", "Game Design & Code").parent(card1);
    createDiv("David Kozdra (MagentaAutumn)").addClass("credits-desc").parent(card1);
    const link1 = createA("https://davidkozdra.com/", "davidkozdra.com", "_blank");
    link1.addClass("credits-link").parent(card1);

    // Card: Art
    const card2 = createDiv().addClass("credits-card").parent(container);
    createElement("h3", "Art / Assets").parent(card2);
    createDiv("  Art & assets by Forrest H Lowe").addClass("credits-desc").parent(card2);
    const link2 = createA("https://realsketchyguy.itch.io/", "realsketchyguy.itch.io", "_blank");
    link2.addClass("credits-link").parent(card2);

    createButton("Back")
      .parent(wrapper)
      .addClass("menu-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.MAIN_MENU);
      });

    createDiv("Thanks for playing!").addClass("credits-note").parent(wrapper);
    return wrapper;
  },

  show: () => {
    const c = select("#credits");
    if (c) c.addClass("screen-visible");
  },

  hide: () => {
    const c = select("#credits");
    if (c) c.removeClass("screen-visible");
  }
});

function saveSettings() {
  const musicVal = parseFloat(select("#musicSlider")?.value()) || 0;
  const gameVal = parseFloat(select("#gameSlider")?.value()) || 0;
  localStorage.setItem("music_vol", musicVal.toFixed(2));
  localStorage.setItem("game_vol", gameVal.toFixed(2));
  if (typeof sound !== "undefined") {
    if (sound.setMusicVolume) sound.setMusicVolume(musicVal);
    if (sound.setGameVolume) sound.setGameVolume(gameVal);
  }
}

function saveAISettings() {
  const defs = [
    { id:'aiRadiusSlider',  key:'pref_ai_radius'  },
    { id:'aiSkipSlider',    key:'pref_ai_skip'    },
    { id:'spawnRateSlider', key:'pref_spawn_rate' },
  ];
  for (const d of defs) {
    const v = select(`#${d.id}`)?.value();
    if (v != null) {
      localStorage.setItem(d.key, v);
      const lbl = document.getElementById(`${d.id}Val`);
      if (lbl) lbl.textContent = parseFloat(v).toFixed(1);
    }
  }
  if (typeof _applyAIPrefs === 'function') _applyAIPrefs();
}


// ============================
// TRAVEL MAP — Interactive map overlay for fast travel
// ============================

/** Lightweight refresh: update affordability styling in the travel list without rebuilding */
function refreshTravelAffordability() {
  const tw = select("#travelMapWindow");
  if (!tw || tw.style("display") === "none" || !player.currentCity) return;
  const gold = player.gold;
  const rows = selectAll(".travel-list-row");
  for (const row of rows) {
    const costEl = row.elt.querySelector(".travel-list-cost");
    if (!costEl) continue;
    const cost = parseInt(costEl.textContent) || 0;
    const canAfford = gold >= cost;
    row.elt.classList.toggle("travel-list-row-disabled", !canAfford);
    costEl.classList.toggle("travel-list-cost-expensive", !canAfford);
  }
  // Update sidebar gold display if visible
  const goldEls = document.querySelectorAll(".travel-sidebar-stats .tss-value");
  for (const el of goldEls) {
    if (el.textContent.endsWith('g') && el.previousElementSibling?.textContent === 'Your Gold') {
      el.textContent = `${gold}g`;
    }
  }
}

function buildTravelPanel(panelId) {
  const panel = select("#" + (panelId || "travelPanelInfo"));
  if (!panel || !player.currentCity) return;
  panel.html("");

  const current = player.currentCity;
  const loc = current.location;

  // === Header bar with title + close button ===
  const headerBar = createDiv().parent(panel).class("travel-window-header");
  createElement("h3", "🗺️ World Map").parent(headerBar)
    .style("margin", "0").style("color", "#d4af37").style("font-size", "15px");
  createButton("✕").parent(headerBar).class("travel-window-close").mousePressed(() => {
    panel.style("display", "none");
  });

  // === Create the travel map content (two-column: map | info) ===
  const overlay = createDiv().parent(panel).class("travel-map-overlay");

  // --- Left: Interactive map canvas ---
  const mapWrap = createDiv().parent(overlay).class("travel-map-canvas-wrap");

  const mapSize = 320;
  const canvasEl = createElement("canvas").parent(mapWrap);
  canvasEl.attribute("width", mapSize);
  canvasEl.attribute("height", mapSize);
  canvasEl.class("travel-map-canvas");

  // --- Right: Destination info sidebar ---
  const sidebar = createDiv().parent(overlay).class("travel-map-sidebar");

  const sidebarHeader = createDiv().parent(sidebar).class("travel-sidebar-header");
  createElement("h3", "Select a City").parent(sidebarHeader).id("travelSidebarTitle")
    .style("margin", "0").style("color", "#d4af37").style("font-size", "14px");
  createP("Click a city on the map").parent(sidebarHeader).id("travelSidebarSubtitle")
    .style("margin", "2px 0 0").style("color", "#888").style("font-size", "11px");

  const sidebarBody = createDiv().parent(sidebar).id("travelSidebarBody").class("travel-sidebar-body");

  // Legend
  const legend = createDiv().parent(sidebar).class("travel-map-legend");
  createElement("span", "").parent(legend).class("legend-dot legend-dot-player");
  createElement("span", "You").parent(legend).style("color", "#ccc").style("font-size", "11px");
  createElement("span", "").parent(legend).class("legend-dot legend-dot-city");
  createElement("span", "City").parent(legend).style("color", "#ccc").style("font-size", "11px");
  createElement("span", "").parent(legend).class("legend-dot legend-dot-port");
  createElement("span", "Port").parent(legend).style("color", "#ccc").style("font-size", "11px");
  createElement("span", "").parent(legend).class("legend-dot legend-dot-current");
  createElement("span", "Current").parent(legend).style("color", "#ccc").style("font-size", "11px");

  // City list below map (compact)
  const listWrap = createDiv().parent(sidebar).class("travel-list-compact");

  // Build city data
  const cityEntries = [];
  for (const city of cities) {
    if (city === current) continue;
    const dx = city.location.x - loc.x;
    const dy = city.location.y - loc.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const tileDist = Math.round(dist);
    const cost = Math.max(5, Math.floor(5 + dist * 0.5));
    cityEntries.push({ city, dist, tileDist, cost });
  }
  cityEntries.sort((a, b) => a.dist - b.dist);

  // === Draw on the HTML canvas ===
  const cvs = canvasEl.elt;
  const ctx = cvs.getContext("2d");
  const scale = mapSize / Math.max(cols, rows);

  // Draw terrain from minimapGraphics if available, else solid background
  if (minimapGraphics) {
    ctx.drawImage(minimapGraphics.canvas || minimapGraphics.elt, 0, 0, mapSize, mapSize);
  } else {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, mapSize, mapSize);
  }

  // Slightly darken to make markers pop
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(0, 0, mapSize, mapSize);

  // Draw route lines from current city to all others (faded)
  for (const entry of cityEntries) {
    const cx1 = loc.x * scale;
    const cy1 = loc.y * scale;
    const cx2 = entry.city.location.x * scale;
    const cy2 = entry.city.location.y * scale;
    ctx.beginPath();
    ctx.moveTo(cx1, cy1);
    ctx.lineTo(cx2, cy2);
    ctx.strokeStyle = "rgba(212,175,55,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw city markers
  const markerRadius = Math.max(5, Math.min(8, scale * 1.5));
  const cityMarkers = []; // for hit detection

  for (const city of cities) {
    const cx = city.location.x * scale;
    const cy = city.location.y * scale;
    const isCurrent = city === current;

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, markerRadius + 2, 0, Math.PI * 2);
    if (isCurrent) {
      ctx.fillStyle = "rgba(255,80,80,0.3)";
    } else if (city.isCoastal) {
      ctx.fillStyle = "rgba(0,200,255,0.25)";
    } else {
      ctx.fillStyle = "rgba(212,175,55,0.25)";
    }
    ctx.fill();

    // Inner dot
    ctx.beginPath();
    ctx.arc(cx, cy, markerRadius, 0, Math.PI * 2);
    if (isCurrent) {
      ctx.fillStyle = "#ff5050";
      ctx.strokeStyle = "#ff9999";
    } else if (city.isCoastal) {
      ctx.fillStyle = "#00c8ff";
      ctx.strokeStyle = "#66ddff";
    } else {
      ctx.fillStyle = "#d4af37";
      ctx.strokeStyle = "#f0d060";
    }
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    // City name label
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = 2.5;
    ctx.strokeText(city.name, cx, cy - markerRadius - 4);
    ctx.fillText(city.name, cx, cy - markerRadius - 4);

    if (!isCurrent) {
      cityMarkers.push({ city, cx, cy, radius: markerRadius + 4 });
    }
  }

  // Draw player icon at current city
  const px = loc.x * scale;
  const py = loc.y * scale;
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#ff3333";
  ctx.fill();

  // === Hover/click state ===
  let hoveredEntry = null;
  let selectedEntry = null;

  // Reusable function to draw highlighted route
  function drawHighlightRoute(entry, color, lineW) {
    // Redraw entire canvas — copy minimap then overlay
    if (minimapGraphics) {
      ctx.drawImage(minimapGraphics.canvas || minimapGraphics.elt, 0, 0, mapSize, mapSize);
    }
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(0, 0, mapSize, mapSize);

    // Faded routes
    for (const e of cityEntries) {
      const cx1 = loc.x * scale;
      const cy1 = loc.y * scale;
      const cx2 = e.city.location.x * scale;
      const cy2 = e.city.location.y * scale;
      ctx.beginPath();
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx2, cy2);
      ctx.strokeStyle = "rgba(212,175,55,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Highlighted route
    if (entry) {
      const cx1 = loc.x * scale;
      const cy1 = loc.y * scale;
      const cx2 = entry.city.location.x * scale;
      const cy2 = entry.city.location.y * scale;

      // Glow
      ctx.beginPath();
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx2, cy2);
      ctx.strokeStyle = color.replace("1)", "0.3)");
      ctx.lineWidth = lineW + 4;
      ctx.stroke();

      // Line
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx2, cy2);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Redraw all markers
    for (const city of cities) {
      const cx = city.location.x * scale;
      const cy = city.location.y * scale;
      const isCurrent = city === current;
      const isSelected = entry && entry.city === city;

      ctx.beginPath();
      ctx.arc(cx, cy, (isSelected ? markerRadius + 3 : markerRadius) + 2, 0, Math.PI * 2);
      if (isCurrent) {
        ctx.fillStyle = "rgba(255,80,80,0.3)";
      } else if (isSelected) {
        ctx.fillStyle = "rgba(255,255,100,0.3)";
      } else if (city.isCoastal) {
        ctx.fillStyle = "rgba(0,200,255,0.25)";
      } else {
        ctx.fillStyle = "rgba(212,175,55,0.25)";
      }
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, isSelected ? markerRadius + 3 : markerRadius, 0, Math.PI * 2);
      if (isCurrent) {
        ctx.fillStyle = "#ff5050";
        ctx.strokeStyle = "#ff9999";
      } else if (isSelected) {
        ctx.fillStyle = "#ffe066";
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
      } else if (city.isCoastal) {
        ctx.fillStyle = "#00c8ff";
        ctx.strokeStyle = "#66ddff";
      } else {
        ctx.fillStyle = "#d4af37";
        ctx.strokeStyle = "#f0d060";
      }
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.fill();
      ctx.stroke();

      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = isSelected ? "#ffe066" : "#fff";
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.lineWidth = 2.5;
      ctx.strokeText(city.name, cx, cy - (isSelected ? markerRadius + 5 : markerRadius) - 4);
      ctx.fillText(city.name, cx, cy - (isSelected ? markerRadius + 5 : markerRadius) - 4);
    }

    // Player dot
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ff3333";
    ctx.fill();
  }

  function updateSidebar(entry) {
    const body = select("#travelSidebarBody");
    const title = select("#travelSidebarTitle");
    const subtitle = select("#travelSidebarSubtitle");
    if (!body) return;
    body.html("");

    if (!entry) {
      title.html("Select a City");
      subtitle.html("Click a city on the map");
      return;
    }

    const city = entry.city;
    const canAfford = player.gold >= entry.cost;

    title.html(city.name);
    subtitle.html(city.isCoastal ? "⚓ Coastal Port City" : "Inland City");

    // Stats
    const statsDiv = createDiv().parent(body).class("travel-sidebar-stats");
    createDiv().parent(statsDiv).html(`<span class="tss-label">Distance</span><span class="tss-value">${entry.tileDist} tiles</span>`);
    createDiv().parent(statsDiv).html(`<span class="tss-label">Population</span><span class="tss-value">${city.population}</span>`);
    createDiv().parent(statsDiv).html(`<span class="tss-label">Travel Cost</span><span class="tss-value ${canAfford ? 'tss-gold' : 'tss-expensive'}">${entry.cost}g</span>`);
    createDiv().parent(statsDiv).html(`<span class="tss-label">Your Gold</span><span class="tss-value">${player.gold}g</span>`);

    // Goods preview
    const goodsList = [];
    for (const [key, val] of city.inventory) {
      if (val.quantity > 0) goodsList.push(key);
    }
    if (goodsList.length > 0) {
      createDiv().parent(body).html(`<span style="color:#888;font-size:11px">Available goods: ${goodsList.slice(0, 6).join(", ")}${goodsList.length > 6 ? "..." : ""}</span>`)
        .style("margin-top", "8px");
    }

    // Travel button
    const travelBtn = createButton(canAfford ? `⛵ Travel for ${entry.cost}g` : "Can't Afford")
      .parent(body)
      .addClass("travel-map-go-btn" + (canAfford ? "" : " travel-map-go-btn-disabled"));

    if (canAfford) {
      travelBtn.mousePressed(() => {
        player.currentCity = null;
        player.fastTravelToCity(city, entry.cost);
        select("#travelMapWindow")?.style("display", "none");
        uiManager.screens["cityView"].show();
      });
    }
  }

  // Canvas mouse events
  function getEntryAt(mx, my) {
    for (const m of cityMarkers) {
      const ddx = mx - m.cx;
      const ddy = my - m.cy;
      if (ddx * ddx + ddy * ddy <= m.radius * m.radius) {
        return cityEntries.find(e => e.city === m.city) || null;
      }
    }
    return null;
  }

  canvasEl.elt.addEventListener("mousemove", (e) => {
    const rect = cvs.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (mapSize / rect.width);
    const my = (e.clientY - rect.top) * (mapSize / rect.height);
    const entry = getEntryAt(mx, my);

    if (entry !== hoveredEntry) {
      hoveredEntry = entry;
      cvs.style.cursor = entry ? "pointer" : "default";
      // Redraw with hover highlight if no selection
      if (!selectedEntry) {
        drawHighlightRoute(entry, "rgba(255,255,100,1)", 2);
        if (entry) updateSidebar(entry);
        else updateSidebar(null);
      }
    }
  });

  canvasEl.elt.addEventListener("click", (e) => {
    const rect = cvs.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (mapSize / rect.width);
    const my = (e.clientY - rect.top) * (mapSize / rect.height);
    const entry = getEntryAt(mx, my);

    if (entry) {
      selectedEntry = entry;
      drawHighlightRoute(entry, "rgba(255,200,50,1)", 2.5);
      updateSidebar(entry);

      // Highlight corresponding list row
      selectAll(".travel-list-row").forEach(r => r.removeClass("travel-list-row-selected"));
      const rowEl = select(`[data-travel-city="${entry.city.name}"]`);
      if (rowEl) rowEl.addClass("travel-list-row-selected");
    }
  });

  canvasEl.elt.addEventListener("mouseleave", () => {
    hoveredEntry = null;
    if (!selectedEntry) {
      drawHighlightRoute(null, "", 0);
      updateSidebar(null);
    }
  });

  // Build compact list in sidebar — PAGINATED
  const CITIES_PER_PAGE = 10;
  let _travelPage = 0;
  const totalPages = Math.max(1, Math.ceil(cityEntries.length / CITIES_PER_PAGE));

  // Pagination controls
  const paginationBar = createDiv().parent(sidebar).class("travel-pagination")
    .style("display", "flex").style("align-items", "center").style("justify-content", "center")
    .style("gap", "8px").style("padding", "4px 0").style("font-size", "11px").style("color", "#aaa");

  const prevBtn = createButton("◀").parent(paginationBar)
    .style("background", "#2a2a35").style("border", "1px solid #555").style("color", "#ccc")
    .style("cursor", "pointer").style("padding", "3px 10px").style("border-radius", "4px")
    .style("font-size", "13px");
  const pageLabel = createElement("span", "").parent(paginationBar).style("min-width", "60px").style("text-align", "center");
  const nextBtn = createButton("▶").parent(paginationBar)
    .style("background", "#2a2a35").style("border", "1px solid #555").style("color", "#ccc")
    .style("cursor", "pointer").style("padding", "3px 10px").style("border-radius", "4px")
    .style("font-size", "13px");

  function renderCityPage() {
    listWrap.html("");
    const start = _travelPage * CITIES_PER_PAGE;
    const pageEntries = cityEntries.slice(start, start + CITIES_PER_PAGE);

    for (const entry of pageEntries) {
      const canAfford = player.gold >= entry.cost;
      const row = createDiv().parent(listWrap).class("travel-list-row" + (canAfford ? "" : " travel-list-row-disabled"));
      row.attribute("data-travel-city", entry.city.name);

      const dot = createElement("span", "").parent(row).class("travel-list-dot");
      dot.style("background", entry.city.isCoastal ? "#00c8ff" : "#d4af37");

      createElement("span", entry.city.name).parent(row).class("travel-list-name");
      createElement("span", `${entry.tileDist}t`).parent(row).class("travel-list-dist");
      createElement("span", `${entry.cost}g`).parent(row).class("travel-list-cost" + (canAfford ? "" : " travel-list-cost-expensive"));

      row.mousePressed(() => {
        selectedEntry = entry;
        drawHighlightRoute(entry, "rgba(255,200,50,1)", 2.5);
        updateSidebar(entry);
        selectAll(".travel-list-row").forEach(r => r.removeClass("travel-list-row-selected"));
        row.addClass("travel-list-row-selected");
      });

      // Restore selection highlight if this entry was selected
      if (selectedEntry && selectedEntry.city === entry.city) {
        row.addClass("travel-list-row-selected");
      }
    }

    pageLabel.html(`${_travelPage + 1} / ${totalPages}`);
    // Use opacity + pointer-events instead of disabled attribute (p5 mousePressed ignores disabled elements)
    prevBtn.style("opacity", _travelPage === 0 ? "0.4" : "1");
    prevBtn.style("pointer-events", _travelPage === 0 ? "none" : "auto");
    nextBtn.style("opacity", _travelPage >= totalPages - 1 ? "0.4" : "1");
    nextBtn.style("pointer-events", _travelPage >= totalPages - 1 ? "none" : "auto");
  }

  prevBtn.mousePressed(() => {
    if (_travelPage > 0) { _travelPage--; renderCityPage(); }
  });
  nextBtn.mousePressed(() => {
    if (_travelPage < totalPages - 1) { _travelPage++; renderCityPage(); }
  });

  renderCityPage();
}

// ============================
// CITY VIEW (expanded shop with trends)
// ============================
uiManager.registerScreen("cityView", {
  validStates: [GameStates.PLAYING],

  create: () => {
    const wrapper = createDiv().id("cityView").class("screen").style("display", "none");

    // ── Header ──
    const headerBox = createDiv().class("city-header").parent(wrapper);

    createDiv().id("cityNameWrapper")
      .style("background", "linear-gradient(160deg, #8B6343 0%, #A07850 50%, #7A5230 100%)")
      .style("border", "3px solid #5C3820")
      .style("border-radius", "4px")
      .style("box-shadow", "2px 2px 8px rgba(0,0,0,0.6), inset 0 0 10px rgba(0,0,0,0.3)")
      .style("height", "5dvh")
      .style("width", "10dvw")
      .style("padding", "0 20px")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("font-size", "24px")
      .style("font-weight", "bold")
      .style("color", "#fff")
      .parent(headerBox);

    const popRow = createDiv()
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "8px")
      .parent(headerBox);

    const _popIconEl = (typeof AtlasManager !== 'undefined' && AtlasManager.has('trader'))
      ? AtlasManager.createDOMCanvas('trader', 28)
      : (() => { const s = document.createElement('span'); s.textContent = '👥'; s.style.fontSize = '28px'; s.style.lineHeight = '1'; return s; })();
    _popIconEl.style.verticalAlign = 'middle';
    popRow.elt.appendChild(_popIconEl);

    createSpan("").id("cityPopulation")
      .style("font-size", "16px")
      .style("color", "#aaa")
      .parent(popRow);

    // Player info row
    const infoRow = createDiv().class("city-info-row").parent(wrapper);

    const _cashEl = (typeof AtlasManager !== 'undefined' && AtlasManager.has('Cash'))
      ? AtlasManager.createDOMCanvas('Cash', 24)
      : (() => { const s = document.createElement('span'); s.textContent = '💰'; s.style.fontSize = '20px'; s.style.lineHeight = '1'; return s; })();
    infoRow.elt.appendChild(_cashEl);
    createSpan("").id("cityPlayerGold").parent(infoRow);
    createSpan("").id("cityPlayerCargo").parent(infoRow);
    createSpan("").id("cityRepBadge").parent(infoRow)
      .style("font-size", "12px").style("margin-left", "auto");

    // ── Tab Bar ──
    const tabBar = createDiv().class("city-tab-bar").parent(wrapper);
    const tabs = ["Shop", "Port", "Services", "Info"];
    for (const tabName of tabs) {
      createButton(tabName)
        .parent(tabBar)
        .addClass("city-tab-btn")
        .attribute("data-tab", tabName.toLowerCase())
        .mousePressed(() => {
          window._cityTab = tabName.toLowerCase();
          uiManager.screens["cityView"].show();
        });
    }

    // ── Tab Panels ──
    createDiv().id("cityTabShop").class("city-tab-panel").parent(wrapper);
    createDiv().id("cityTabPort").class("city-tab-panel").parent(wrapper);
    createDiv().id("cityTabServices").class("city-tab-panel").parent(wrapper);
    createDiv().id("cityTabInfo").class("city-tab-panel").parent(wrapper);

    // ── Bottom Buttons (shared across all tabs) ──
    const bottomButtonRow = createDiv().id("cityBottomButtons").parent(wrapper);

    createButton("Leave City")
      .parent(bottomButtonRow)
      .addClass("city-leave-btn")
      .mousePressed(() => {
        const safe = findNearestSafeTile(player.x, player.y, cities);
        if (safe) { player.x = safe.x; player.y = safe.y; }
        player.currentCity = null;
        select("#travelMapWindow")?.style("display", "none");
        uiManager.screens["cityView"].hide();
      });

    createButton("Travel")
      .parent(bottomButtonRow)
      .addClass("city-travel-btn")
      .mousePressed(() => {
        let mapWin = select("#travelMapWindow");
        if (!mapWin) {
          // Must live outside #cityView because cityView has CSS transform,
          // which breaks position:fixed on children. Lifecycle is managed
          // by cityView's hide() which hides this element explicitly.
          mapWin = createDiv().id("travelMapWindow").class("travel-map-window");
          createDiv().id("travelPanelInfo").parent(mapWin);
        }
        const isVisible = mapWin.style("display") !== "none";
        if (isVisible) {
          mapWin.style("display", "none");
        } else {
          buildTravelPanel("travelPanelInfo");
          mapWin.style("display", "flex");
        }
      });

    return wrapper;
  },

  show: () => {
    const view = select("#cityView");
    if (!view || typeof player === 'undefined' || !player || !player.currentCity) return;
    view.show().style("opacity", "1");

    const city = player.currentCity;
    const tab = window._cityTab || "shop";

    // ── Header info ──
    select("#cityNameWrapper")?.html(city.name);
    select("#cityPopulation")?.html(`Pop: ${city.population}`);
    select("#cityPlayerGold")?.html(`Gold: ${player.gold}`);

    let totalWeight = 0;
    for (let [key, entry] of player.inventory) {
      const item = ItemLibrary[key];
      if (item) totalWeight += item.weight * entry.quantity;
    }
    select("#cityPlayerCargo")?.html(`Cargo: ${totalWeight} / ${player.getEffectiveCargoCapacity ? player.getEffectiveCargoCapacity() : (player.cargoCapacity || 50)}`);

    // Reputation badge in header
    const repBadge = select("#cityRepBadge");
    if (repBadge && city.getReputationTier) {
      const tier = city.getReputationTier();
      repBadge.html(`${tier.emoji} ${tier.name}`);
      repBadge.style("color", tier.color);
    }

    // ── Highlight active tab ──
    selectAll(".city-tab-btn").forEach(btn => {
      const t = btn.attribute("data-tab");
      if (t === tab) {
        btn.addClass("city-tab-active");
      } else {
        btn.removeClass("city-tab-active");
      }
    });

    // ── Show/hide panels ──
    select("#cityTabShop")?.style("display", tab === "shop" ? "block" : "none");
    select("#cityTabPort")?.style("display", tab === "port" ? "block" : "none");
    select("#cityTabServices")?.style("display", tab === "services" ? "block" : "none");
    select("#cityTabInfo")?.style("display", tab === "info" ? "block" : "none");

    // ═══════════════════════════════
    //  SHOP TAB
    // ═══════════════════════════════
    if (tab === "shop") {
      const shopPanel = select("#cityTabShop");

      // Helper: refresh a single item row's dynamic content (qty, prices, button states)
      const _refreshShopRow = (itemKey) => {
        const row = select(`[data-shop-item="${itemKey}"]`);
        if (!row) return;

        const cityEntry = city.inventory.get(itemKey);
        const playerEntry = player.inventory.get(itemKey);
        const cityQty = cityEntry?.quantity || 0;
        const playerQty = playerEntry?.quantity || 0;
        const itemData = ItemLibrary[itemKey];
        const buyPrice = city.calculateItemPrice(itemKey, cities, false);
        const sellPrice = city.calculateItemPrice(itemKey, cities, true);

        let tw = 0;
        for (let [key, entry] of player.inventory) {
          const it = ItemLibrary[key];
          if (it) tw += it.weight * entry.quantity;
        }

        const isBook = itemData.tags && itemData.tags.has('book');
        const alreadyOwned = isBook && player.inventory.has(itemKey);

        const canAfford = player.gold >= buyPrice;
        const hasStock = cityQty > 0;
        const hasCargoSpace = tw + itemData.weight <= (player.getEffectiveCargoCapacity ? player.getEffectiveCargoCapacity() : (player.cargoCapacity || 50));
        const canBuy = canAfford && hasStock && hasCargoSpace && !alreadyOwned;
        const canSell = playerQty > 0;

        // Apply negotiation modifier + charm to displayed prices
        const negDiscount = player.modifiers?.negotiationDiscount || 0;
        const charmDisc = (player.bonusCharm || 0) * 0.015;
        const totalDisplayDisc = Math.min(negDiscount + charmDisc, 0.50);
        const displayBuyPrice = totalDisplayDisc > 0 ? Math.floor(buyPrice * (1 - totalDisplayDisc)) : buyPrice;
        const displaySellPrice = totalDisplayDisc > 0 ? Math.ceil(sellPrice * (1 + totalDisplayDisc)) : sellPrice;

        // Update qty text
        const qtyEl = select(`[data-shop-qty="${itemKey}"]`);
        if (qtyEl) qtyEl.html(`City: ×${cityQty}  |  You: ×${playerQty}  |  Wt: ${itemData.weight}`);

        // Update buy button
        const buyBtn = select(`[data-shop-buy="${itemKey}"]`);
        if (buyBtn) {
          if (alreadyOwned) {
            buyBtn.html(`Owned`);
          } else {
            buyBtn.html(`Buy $${displayBuyPrice}`);
          }
          buyBtn.removeClass("buy-btn").removeClass("buy-btn-disabled");
          buyBtn.addClass(canBuy ? "buy-btn" : "buy-btn-disabled");
        }

        // Update sell button
        const sellBtn = select(`[data-shop-sell="${itemKey}"]`);
        if (sellBtn) {
          sellBtn.html(`Sell $${displaySellPrice}`);
          sellBtn.removeClass("sell-btn").removeClass("sell-btn-disabled");
          sellBtn.addClass(canSell ? "sell-btn" : "sell-btn-disabled");
        }

        // Update header gold/cargo
        select("#cityPlayerGold")?.html(`Gold: ${player.gold}`);
        let totalW2 = 0;
        for (let [key, entry] of player.inventory) {
          const it = ItemLibrary[key];
          if (it) totalW2 += it.weight * entry.quantity;
        }
        select("#cityPlayerCargo")?.html(`Cargo: ${totalW2} / ${player.getEffectiveCargoCapacity ? player.getEffectiveCargoCapacity() : (player.cargoCapacity || 50)}`);

        // Update reputation badge
        const _repBadge = select("#cityRepBadge");
        if (_repBadge && city.getReputationTier) {
          const _tier = city.getReputationTier();
          _repBadge.html(`${_tier.emoji} ${_tier.name}`);
          _repBadge.style("color", _tier.color);
        }
      };

      // ── Filter state (persisted across refreshes) ──
      if (!window._shopFilters) {
        window._shopFilters = { category: 'all', tag: 'all', priceSort: 'none', priceMin: 0, priceMax: Infinity, stock: 'all' };
      }
      const sf = window._shopFilters;

      // Apply filters to decide visibility of each item
      const _applyShopFilters = () => {
        const items = document.querySelectorAll('[data-shop-item]');
        for (const el of items) {
          const key = el.getAttribute('data-shop-item');
          const itemData = ItemLibrary[key];
          if (!itemData) { el.style.display = 'none'; continue; }

          const buyPrice = city.calculateItemPrice(key, cities, false);
          const cityQty = city.inventory.get(key)?.quantity || 0;
          const playerQty = player.inventory.get(key)?.quantity || 0;

          let visible = true;
          // Category filter
          if (sf.category !== 'all' && itemData.category !== sf.category) visible = false;
          // Tag filter
          if (sf.tag !== 'all' && !(itemData.tags && itemData.tags.has(sf.tag))) visible = false;
          // Price range filter
          if (buyPrice < sf.priceMin) visible = false;
          if (sf.priceMax < Infinity && buyPrice > sf.priceMax) visible = false;
          // Stock filter
          if (sf.stock === 'inStock' && cityQty <= 0) visible = false;
          if (sf.stock === 'owned' && playerQty <= 0) visible = false;

          el.style.display = visible ? '' : 'none';
        }

        // Price sort (reorder DOM children)
        if (sf.priceSort === 'asc' || sf.priceSort === 'desc') {
          const grid = document.querySelector('#cityTabShop .shop-grid');
          if (grid) {
            const children = [...grid.children];
            children.sort((a, b) => {
              const prA = city.calculateItemPrice(a.getAttribute('data-shop-item'), cities, false);
              const prB = city.calculateItemPrice(b.getAttribute('data-shop-item'), cities, false);
              return sf.priceSort === 'asc' ? prA - prB : prB - prA;
            });
            for (const c of children) grid.appendChild(c);
          }
        }
      };

      // Only rebuild full DOM if shop grid doesn't exist yet or city changed
      const existingGrid = select("#cityTabShop .shop-grid");
      if (existingGrid && window._shopCity === city.name) {
        // Fast path: just refresh all dynamic values
        for (const itemKey of Object.keys(ItemLibrary)) {
          _refreshShopRow(itemKey);
        }
        _applyShopFilters();
      } else {
        // Full rebuild (first open or city changed)
        window._shopCity = city.name;
        shopPanel.html("");

      // ── Build filter bar ──
      const allCategories = [...new Set(Object.values(ItemLibrary).map(i => i.category))].sort();
      const allTags = [...new Set(Object.values(ItemLibrary).flatMap(i => i.tags ? [...i.tags] : []))].sort();

      const filterBar = createDiv().class("shop-filter-bar").parent(shopPanel);

      // Category dropdown
      createElement("label", "Category:").parent(filterBar);
      const catSel = createElement("select").parent(filterBar);
      createElement("option", "All").parent(catSel).attribute("value", "all");
      for (const cat of allCategories) {
        const opt = createElement("option", cat).parent(catSel).attribute("value", cat);
        if (sf.category === cat) opt.attribute("selected", "selected");
      }
      catSel.changed(() => { sf.category = catSel.value(); _applyShopFilters(); });

      // Tag pills
      createElement("label", "Tag:").parent(filterBar);
      const tagWrap = createDiv().parent(filterBar).style("display", "flex").style("flex-wrap", "wrap").style("gap", "3px");
      const tagAll = createSpan("All").parent(tagWrap).class("shop-filter-tag" + (sf.tag === 'all' ? ' active' : ''));
      tagAll.mousePressed(() => {
        sf.tag = 'all';
        tagWrap.elt.querySelectorAll('.shop-filter-tag').forEach(e => e.classList.remove('active'));
        tagAll.elt.classList.add('active');
        _applyShopFilters();
      });
      for (const tag of allTags) {
        const pill = createSpan(tag).parent(tagWrap).class("shop-filter-tag" + (sf.tag === tag ? ' active' : ''));
        pill.mousePressed(() => {
          sf.tag = tag;
          tagWrap.elt.querySelectorAll('.shop-filter-tag').forEach(e => e.classList.remove('active'));
          pill.elt.classList.add('active');
          _applyShopFilters();
        });
      }

      // Price sort
      createElement("label", "Price:").parent(filterBar);
      const priceSel = createElement("select").parent(filterBar);
      createElement("option", "Default").parent(priceSel).attribute("value", "none");
      const prAsc = createElement("option", "Low → High").parent(priceSel).attribute("value", "asc");
      const prDesc = createElement("option", "High → Low").parent(priceSel).attribute("value", "desc");
      if (sf.priceSort === 'asc') prAsc.attribute("selected", "selected");
      if (sf.priceSort === 'desc') prDesc.attribute("selected", "selected");
      priceSel.changed(() => { sf.priceSort = priceSel.value(); _applyShopFilters(); });

      // Price range inputs
      createElement("label", "Min:").parent(filterBar);
      const minInput = createElement("input").parent(filterBar).attribute("type", "number").attribute("min", "0")
        .attribute("placeholder", "0").style("width", "50px").value(sf.priceMin > 0 ? sf.priceMin : '');
      minInput.input(() => { sf.priceMin = parseInt(minInput.value()) || 0; _applyShopFilters(); });

      createElement("label", "Max:").parent(filterBar);
      const maxInput = createElement("input").parent(filterBar).attribute("type", "number").attribute("min", "0")
        .attribute("placeholder", "∞").style("width", "50px").value(sf.priceMax < Infinity ? sf.priceMax : '');
      maxInput.input(() => { const v = parseInt(maxInput.value()); sf.priceMax = v > 0 ? v : Infinity; _applyShopFilters(); });

      // Stock filter
      createElement("label", "Show:").parent(filterBar);
      const stockSel = createElement("select").parent(filterBar);
      createElement("option", "Everything").parent(stockSel).attribute("value", "all");
      const s1 = createElement("option", "In Stock").parent(stockSel).attribute("value", "inStock");
      const s2 = createElement("option", "Owned").parent(stockSel).attribute("value", "owned");
      if (sf.stock === 'inStock') s1.attribute("selected", "selected");
      if (sf.stock === 'owned') s2.attribute("selected", "selected");
      stockSel.changed(() => { sf.stock = stockSel.value(); _applyShopFilters(); });

      // Reset button
      const resetBtn = createSpan("✕ Reset").parent(filterBar).class("shop-filter-reset");
      resetBtn.mousePressed(() => {
        sf.category = 'all'; sf.tag = 'all'; sf.priceSort = 'none'; sf.priceMin = 0; sf.priceMax = Infinity; sf.stock = 'all';
        // Reset UI
        catSel.value('all'); priceSel.value('none'); stockSel.value('all');
        minInput.value(''); maxInput.value('');
        tagWrap.elt.querySelectorAll('.shop-filter-tag').forEach(e => e.classList.remove('active'));
        tagAll.elt.classList.add('active');
        _applyShopFilters();
      });

      const shopScroll = createDiv().class("shop-grid").parent(shopPanel);

      const sortedItems = Object.entries(ItemLibrary).sort(([a], [b]) => {
        return (city.inventory.has(b) ? 1 : 0) - (city.inventory.has(a) ? 1 : 0);
      });

      for (const [itemKey, itemData] of sortedItems) {
        const cityEntry = city.inventory.get(itemKey);
        const playerEntry = player.inventory.get(itemKey);
        const cityQty = cityEntry?.quantity || 0;
        const playerQty = playerEntry?.quantity || 0;
        const buyPrice = city.calculateItemPrice(itemKey, cities, false);
        const sellPrice = city.calculateItemPrice(itemKey, cities, true);

        const canAfford = player.gold >= buyPrice;
        const hasStock = cityQty > 0;
        const hasCargoSpace = totalWeight + itemData.weight <= (player.getEffectiveCargoCapacity ? player.getEffectiveCargoCapacity() : (player.cargoCapacity || 50));
        const isBook = itemData.tags && itemData.tags.has('book');
        const alreadyOwned = isBook && player.inventory.has(itemKey);
        const canBuy = canAfford && hasStock && hasCargoSpace && !alreadyOwned;
        const canSell = playerQty > 0;

        // Apply negotiation modifier + charm to displayed prices
        const negDiscount = player.modifiers?.negotiationDiscount || 0;
        const charmDisc = (player.bonusCharm || 0) * 0.015;
        const totalDisplayDisc = Math.min(negDiscount + charmDisc, 0.50);
        const displayBuyPrice = totalDisplayDisc > 0 ? Math.floor(buyPrice * (1 - totalDisplayDisc)) : buyPrice;
        const displaySellPrice = totalDisplayDisc > 0 ? Math.ceil(sellPrice * (1 + totalDisplayDisc)) : sellPrice;

        const itemDiv = createDiv().class("shop-item").parent(shopScroll);
        itemDiv.attribute("data-shop-item", itemKey);

        // Item image + name
        const imgRow = createDiv().style("display", "flex").style("align-items", "center").style("gap", "8px").parent(itemDiv);

        // Use icon system (emoji fallback for missing sprites)
        const shopIconEl = createItemIconEl(itemKey, 32);
        shopIconEl.style.imageRendering = 'pixelated';
        imgRow.elt.appendChild(shopIconEl);

        const nameRow = createDiv().class("shop-item-name").parent(imgRow);
        createSpan(itemData.name).style("font-weight", "bold").style("color", "#fff").parent(nameRow);

        // Price trend
        if (city.getPriceTrend) {
          const trend = city.getPriceTrend(itemKey);
          let trendIcon = "→";
          let trendColor = "#aaa";
          if (trend > 0) { trendIcon = "↑"; trendColor = "#4CAF50"; }
          if (trend < 0) { trendIcon = "↓"; trendColor = "#f44336"; }
          createSpan(` ${trendIcon}`).style("color", trendColor).style("font-size", "14px").parent(nameRow);
        }

        // Category tag
        createSpan(itemData.category).class("category-tag").parent(itemDiv);

        // Quantities + weight (tagged for fast update)
        createP(`City: ×${cityQty}  |  You: ×${playerQty}  |  Wt: ${itemData.weight}`)
          .style("font-size", "12px").style("margin", "4px 0").style("color", "#aaa")
          .attribute("data-shop-qty", itemKey)
          .parent(itemDiv);

        // Buy/Sell
        const btnRow = createDiv().class("shop-btn-row").parent(itemDiv);

        createButton(alreadyOwned ? `Owned` : `Buy $${displayBuyPrice}`)
          .parent(btnRow)
          .addClass(canBuy ? "buy-btn" : "buy-btn-disabled")
          .attribute("data-shop-buy", itemKey)
          .mousePressed(() => {
            // Block duplicate book purchases
            const bookCheck = ItemLibrary[itemKey];
            if (bookCheck && bookCheck.tags && bookCheck.tags.has('book') && player.inventory.has(itemKey)) {
              if (typeof notificationManager !== 'undefined') {
                notificationManager.log('You already own this book!', 'warning');
              }
              return;
            }
            let freshBuyPrice = city.calculateItemPrice(itemKey, cities, false);
            // Apply negotiation discount + charm bonus
            const nd = player.modifiers?.negotiationDiscount || 0;
            const cb = (player.bonusCharm || 0) * 0.015;
            const totalDisc = Math.min(nd + cb, 0.50);
            if (totalDisc > 0) freshBuyPrice = Math.floor(freshBuyPrice * (1 - totalDisc));
            const ce = city.inventory.get(itemKey);
            if (player.gold >= freshBuyPrice && ce && ce.quantity > 0) {
              if (!player.addItem(itemData)) return; // cargo full
              player.spendGold(freshBuyPrice);
              ce.quantity--;
              // Reputation boost for trading
              if (city.adjustReputation) city.adjustReputation(0.5);
              for (const k of Object.keys(ItemLibrary)) _refreshShopRow(k);
              // Refresh travel panel affordability if it's open
              refreshTravelAffordability();
            }
          });

        createButton(`Sell $${displaySellPrice}`)
          .parent(btnRow)
          .addClass(canSell ? "sell-btn" : "sell-btn-disabled")
          .attribute("data-shop-sell", itemKey)
          .mousePressed(() => {
            const pe = player.inventory.get(itemKey);
            if (pe && pe.quantity > 0) {
              let freshSellPrice = city.calculateItemPrice(itemKey, cities, true);
              // Apply negotiation bonus + charm bonus to sell
              const nd = player.modifiers?.negotiationDiscount || 0;
              const cb = (player.bonusCharm || 0) * 0.015;
              const totalDisc = Math.min(nd + cb, 0.50);
              if (totalDisc > 0) freshSellPrice = Math.ceil(freshSellPrice * (1 + totalDisc));
              player.earnGold(freshSellPrice);
              player.removeItem(itemData);
              const ce = city.inventory.get(itemKey);
              if (!ce) {
                city.inventory.set(itemKey, { item: itemData, quantity: 1 });
              } else {
                ce.quantity++;
              }
              // Reputation boost for trading
              if (city.adjustReputation) city.adjustReputation(0.3);
              for (const k of Object.keys(ItemLibrary)) _refreshShopRow(k);
              // Refresh travel panel affordability if it's open
              refreshTravelAffordability();
            }
          });
      }
      _applyShopFilters();
      } // end full rebuild
    }

    // ═══════════════════════════════
    //  PORT TAB
    // ═══════════════════════════════
    if (tab === "port") {
      const portPanel = select("#cityTabPort");
      portPanel.html("");

      if (!(city.isCoastal || city.port)) {
        // Landlocked city — no port
        const noPort = createDiv().parent(portPanel).style("text-align", "center").style("padding", "40px 20px");
        createElement("h3", "🚫 No Port").parent(noPort).style("color", "#666").style("margin", "0 0 8px");
        createP("This city is landlocked. Travel to a coastal city to access port services.")
          .parent(noPort).style("color", "#888").style("font-size", "13px");
      } else {
        createElement("h3", "⚓ Harbor — Buy Vessels")
          .parent(portPanel)
          .style("margin", "8px 0 6px")
          .style("color", "#6cc");

        // Available boats for purchase
        const boatGrid = createDiv().class("shop-grid").parent(portPanel);

        for (const [boatKey, boatDef] of Object.entries(typeof BoatLibrary !== 'undefined' ? BoatLibrary : {})) {
          const canAfford = player.gold >= boatDef.cost;

          const boatCard = createDiv().class("shop-item").parent(boatGrid);

          const nameRow = createDiv().style("display", "flex").style("align-items", "center").style("gap", "8px").parent(boatCard);
          createSpan(boatDef.icon).style("font-size", "24px").parent(nameRow);
          createSpan(boatDef.displayName).style("font-weight", "bold").style("color", "#fff").parent(nameRow);

          createP(boatDef.description)
            .style("font-size", "11px").style("color", "#aaa").style("margin", "4px 0").parent(boatCard);

          createP(`Speed: ${boatDef.speed}ms/tile  •  Cargo: +${boatDef.cargoBonus}  •  Crew: ${boatDef.crewSize}`)
            .style("font-size", "11px").style("color", "#888").style("margin", "2px 0").parent(boatCard);

          createButton(`Buy $${boatDef.cost}`)
            .parent(boatCard)
            .addClass(canAfford ? "buy-btn" : "buy-btn-disabled")
            .mousePressed(() => {
              if (player.gold >= boatDef.cost) {
                const defaultName = Boat.randomName();
                const boatName = prompt(`Name your new ${boatDef.displayName}:`, defaultName);
                if (boatName === null) return;
                player.spendGold(boatDef.cost);
                const newBoat = new Boat(boatKey, boatName || defaultName);
                player.fleet.push(newBoat);
                if (!player.activeBoat) player.activeBoat = newBoat;
                if (typeof notificationManager !== 'undefined') {
                  notificationManager.log(`Purchased ${boatDef.displayName} "${newBoat.name}"!`, "success");
                }
                uiManager.screens["cityView"].show();
              }
            });
        }

        // Player's fleet
        if (player.fleet && player.fleet.length > 0) {
          createElement("h3", "🚢 Your Fleet")
            .parent(portPanel)
            .style("margin", "16px 0 6px")
            .style("color", "#acd");

          const fleetGrid = createDiv().class("shop-grid").parent(portPanel);

          for (let i = 0; i < player.fleet.length; i++) {
            const boat = player.fleet[i];
            const isActive = player.activeBoat === boat;
            const boatDef = typeof BoatLibrary !== 'undefined' ? BoatLibrary[boat.type] : null;

            const card = createDiv().class("shop-item").parent(fleetGrid);
            if (isActive) card.style("border", "2px solid #d4af37");

            const row = createDiv().style("display", "flex").style("align-items", "center").style("gap", "8px").parent(card);
            createSpan(boatDef?.icon || '🚢').style("font-size", "20px").parent(row);
            createSpan(`"${boat.name}"`).style("font-weight", "bold").style("color", "#fff").parent(row);
            createSpan(`(${boat.displayName})`).style("color", "#aaa").style("font-size", "12px").parent(row);

            if (isActive) {
              createSpan("★ ACTIVE").style("color", "#d4af37").style("font-size", "11px").style("margin-left", "auto").parent(row);
            }

            // Condition bar
            const condRow = createDiv().class("boat-condition-row").parent(card);
            createSpan(`Hull: ${boat.condition}% — ${boat.conditionLabel()}`)
              .style("font-size", "11px").style("color", boat.conditionColor()).parent(condRow);
            const barOuter = createDiv().class("boat-condition-bar-outer").parent(condRow);
            createDiv().class("boat-condition-bar-fill")
              .style("width", boat.condition + "%")
              .style("background", boat.conditionColor())
              .parent(barOuter);

            // Effective stats (show degradation if applicable)
            const effSpeed = boat.getEffectiveSpeed();
            const effCargo = boat.getEffectiveCargo();
            const speedNote = effSpeed !== boat.speed ? ` (base ${boat.speed})` : '';
            const cargoNote = effCargo !== boat.cargoBonus ? ` (base +${boat.cargoBonus})` : '';
            createP(`Speed: ${effSpeed}ms${speedNote}  •  Cargo: +${effCargo}${cargoNote}`)
              .style("font-size", "11px").style("color", "#888").style("margin", "4px 0").parent(card);

            const btnRow = createDiv().style("display", "flex").style("gap", "6px").style("flex-wrap", "wrap").parent(card);

            if (!isActive) {
              createButton("Set Active")
                .parent(btnRow).addClass("buy-btn")
                .mousePressed(() => {
                  player.activeBoat = boat;
                  if (typeof notificationManager !== 'undefined') {
                    notificationManager.log(`"${boat.name}" is now your active vessel.`, "info");
                  }
                  uiManager.screens["cityView"].show();
                });
            }

            // Repair button (only at coastal cities)
            if (boat.condition < 100) {
              const cost = boat.getRepairCost();
              const woodEntry = player.inventory.get('Wood');
              const playerWood = woodEntry ? woodEntry.quantity : 0;
              const hasWood = playerWood >= cost.wood;

              // Option 1: Repair with wood (cheaper)
              if (hasWood) {
                const canAfford = player.gold >= cost.gold;
                createButton(`🔧 Repair (${cost.gold}g + ${cost.wood} Wood)`)
                  .parent(btnRow)
                  .addClass(canAfford ? "repair-btn" : "repair-btn-disabled")
                  .mousePressed(() => {
                    if (player.gold < cost.gold) {
                      if (typeof notificationManager !== 'undefined')
                        notificationManager.log(`Not enough gold! Need ${cost.gold}g.`, 'warning');
                      return;
                    }
                    player.spendGold(cost.gold);
                    for (let w = 0; w < cost.wood; w++) player.removeItem({ name: 'Wood' });
                    boat.repair(100 - boat.condition);
                    if (typeof notificationManager !== 'undefined')
                      notificationManager.log(`🔧 "${boat.name}" fully repaired!`, 'success');
                    uiManager.screens["cityView"].show();
                  });
              }

              // Option 2: Gold-only repair (premium)
              const goldOnlyCost = hasWood ? null : cost.goldOnly; // show only if no wood option
              {
                const price = hasWood ? cost.goldOnly : cost.goldOnly;
                const label = hasWood
                  ? `🔧 Gold Only (${price}g)`
                  : `🔧 Repair (${price}g — no Wood)`;
                const canPay = player.gold >= price;
                createButton(label)
                  .parent(btnRow)
                  .addClass(canPay ? "repair-btn" : "repair-btn-disabled")
                  .style("font-size", hasWood ? "10px" : "12px")
                  .mousePressed(() => {
                    if (player.gold < price) {
                      if (typeof notificationManager !== 'undefined')
                        notificationManager.log(`Not enough gold! Need ${price}g.`, 'warning');
                      return;
                    }
                    player.spendGold(price);
                    boat.repair(100 - boat.condition);
                    if (typeof notificationManager !== 'undefined')
                      notificationManager.log(`🔧 "${boat.name}" repaired (gold only — premium rate).`, 'success');
                    uiManager.screens["cityView"].show();
                  });
              }
            } else {
              createSpan("✅ Hull Pristine").style("font-size", "11px").style("color", "#4caf50")
                .style("align-self", "center").parent(btnRow);
            }

            const baseSell = boatDef ? Math.floor(boatDef.cost * 0.4) : 50;
            const sellPrice = Math.max(1, Math.floor(baseSell * boat.condition / 100));
            createButton(`Sell $${sellPrice}`)
              .parent(btnRow).addClass("sell-btn")
              .mousePressed(() => {
                if (player.isSailing) {
                  if (typeof notificationManager !== 'undefined') {
                    notificationManager.log("You can't sell a boat while at sea!", "warning");
                  }
                  return;
                }
                player.earnGold(sellPrice);
                player.fleet.splice(i, 1);
                if (player.activeBoat === boat) player.activeBoat = player.fleet[0] || null;
                if (typeof notificationManager !== 'undefined') {
                  notificationManager.log(`Sold "${boat.name}" for $${sellPrice}.`, "info");
                }
                uiManager.screens["cityView"].show();
              });

            createButton("Rename")
              .parent(btnRow).addClass("filter-btn")
              .mousePressed(() => {
                const newName = prompt(`Rename "${boat.name}":`, boat.name);
                if (newName && newName.trim()) {
                  boat.name = newName.trim();
                  uiManager.screens["cityView"].show();
                }
              });
          }
        }
      }
    }

    // ═══════════════════════════════
    //  SERVICES TAB (new economy features)
    // ═══════════════════════════════
    if (tab === "services") {
      const svcPanel = select("#cityTabServices");
      svcPanel.html("");

      const svcScroll = createDiv().class("svc-scroll").parent(svcPanel);

      // ── City Services ─────────────────────
      const features = city.getCityFeatures ? city.getCityFeatures() : [];

      const svcHdr = createDiv().class("svc-section-hdr").parent(svcScroll);
      createSpan("🏛️").class("svc-hdr-icon").parent(svcHdr);
      createSpan("City Services").class("svc-hdr-title").style("color", "#d4af37").parent(svcHdr);
      if (features.length > 0)
        createSpan(`${features.length} available`).class("svc-hdr-badge").parent(svcHdr);

      if (features.length === 0) {
        const empty = createDiv().class("svc-empty").parent(svcScroll);
        createSpan("🚫").class("svc-empty-icon").parent(empty);
        createSpan("This city has no special services.").parent(empty);
      } else {
        const grid = createDiv().class("svc-grid").parent(svcScroll);

        const featureConfig = {
          bountyBoard: {
            emoji: "📜", label: "Bounty Board",
            desc: "Hunt wanted raiders for gold bounties. Higher bounties for boss targets.",
            state: GameStates.BOUNTY_BOARD,
          },
          bank: {
            emoji: "🏦", label: "Bank",
            desc: "Deposit savings at 3% weekly interest, take loans, or invest in trade routes.",
            state: GameStates.BANK,
          },
          gamblingDen: {
            emoji: "🎲", label: "Gambling Den",
            desc: "Dice poker, memory match, and the wheel of fortune await the bold.",
            state: GameStates.GAMBLING,
          },
          blackMarket: {
            emoji: "🕶️", label: "Black Market",
            desc: "Trade contraband for big profits — but beware of checkpoint inspections.",
            state: GameStates.BLACK_MARKET,
          },
        };

        for (const feat of features) {
          const cfg = featureConfig[feat.id] || { emoji: feat.emoji, label: feat.label, desc: "", state: null };
          const card = createDiv().class("svc-card").parent(grid);
          card.attribute("data-svc", feat.id);

          createSpan(cfg.emoji).class("svc-emoji").parent(card);
          createDiv().class("svc-name").parent(card).html(cfg.label);
          createDiv().class("svc-desc").parent(card).html(cfg.desc);

          const btn = createButton("Enter →").class("svc-enter-btn").parent(card);
          btn.mousePressed(() => {
            window._currentServiceCity = city;
            if (cfg.state) gameStateManager.setState(cfg.state);
          });
        }
      }

      // ── Contracts ──────────────────────────
      if (typeof contractSystem !== 'undefined' && contractSystem) {
        // Use cached contracts if they exist; only generate when empty
        let available = contractSystem.getContractsForCity(city.name);
        if (!available || available.length === 0) {
          available = contractSystem.generateForCity(city);
        }
        const active = contractSystem.active || [];

        const ctrHdr = createDiv().class("svc-section-hdr").parent(svcScroll);
        createSpan("📋").class("svc-hdr-icon").parent(ctrHdr);
        createSpan("Contracts").class("svc-hdr-title").style("color", "#4fc3f7").parent(ctrHdr);
        if (active.length > 0)
          createSpan(`${active.length} active`).class("svc-hdr-badge").style("color", "#66bb6a").style("border-color", "#2e7d32").parent(ctrHdr);

        if (available.length === 0 && active.length === 0) {
          createP("No contracts available in this city right now.")
            .parent(svcScroll).style("color", "#556").style("font-size", "12px").style("margin", "4px 0 8px 28px");
        }

        for (const contract of available) {
          const card = createDiv().class("svc-contract").parent(svcScroll);

          const top = createDiv().class("svc-ctr-top").parent(card);
          createSpan(contract.type.replace(/([A-Z])/g, ' $1').trim()).class("svc-ctr-type").parent(top);
          createSpan(`${contract.reward}g`).class("svc-ctr-reward").parent(top);

          createDiv().class("svc-ctr-desc").parent(card)
            .html(contract.description || `${contract.title || contract.type} contract`);

          const meta = createDiv().class("svc-ctr-meta").parent(card);
          if (contract.item) createSpan(`📦 ${contract.qty || '?'}× ${contract.item}`).parent(meta);
          if (contract.target) createSpan(`📍 ${contract.target}`).parent(meta);
          // Survey contract: show location count and note about map markers
          if (contract.type === 'survey' && contract.surveyPoints) {
            createSpan(`📍 ${contract.surveyPoints.length} locations`).parent(meta);
            createSpan('🗺️ Shown on map').parent(meta).style('color', '#ffb74d');
          }
          if (contract.deadline) {
            const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;
            const daysLeft = Math.max(0, contract.deadline - day);
            createSpan(`⏰ ${daysLeft}d left`).parent(meta).style("color", daysLeft < 3 ? "#f44" : "#667");
          }

          const contractRef = contract;
          const acceptBtn = createElement("button", "Accept Contract").class("svc-ctr-accept").parent(card);
          acceptBtn.mousePressed(() => {
            // acceptContract returns boolean and handles notifications internally
            contractSystem.acceptContract(contractRef);
            uiManager.screens["cityView"].show();
          });
        }

        // Active contracts
        if (active.length > 0) {
          const actHdr = createDiv().class("svc-section-hdr").parent(svcScroll);
          createSpan("📌").class("svc-hdr-icon").parent(actHdr);
          createSpan("Active Contracts").class("svc-hdr-title").style("color", "#66bb6a").parent(actHdr);

          for (const ac of active) {
            const row = createDiv().class("svc-active-ctr").parent(svcScroll);
            createDiv().class("svc-ac-dot").parent(row);
            let desc = ac.title || ac.description || `${ac.type} contract`;
            // Survey: show progress
            if (ac.type === 'survey' && ac.surveyVisited) {
              const visited = ac.surveyVisited.filter(v => v).length;
              desc += ` (${visited}/${ac.surveyVisited.length} surveyed)`;
            }
            createSpan(desc).class("svc-ac-text").parent(row);
            createSpan(`${ac.reward}g`).class("svc-ac-reward").parent(row);

            // Cancel button
            const cancelRef = ac;
            const cancelBtn = createElement("button", "✕ Cancel").class("svc-ac-cancel").parent(row);
            cancelBtn.mousePressed(() => {
              if (confirm(`Abandon "${cancelRef.title}"? You'll lose some reputation.`)) {
                contractSystem.abandonContract(cancelRef);
                uiManager.screens["cityView"].show();
              }
            });
          }
        }
      }

      // ── Treasure Fragments ─────────────────
      if (typeof treasureSystem !== 'undefined' && treasureSystem) {
        const fragArray = treasureSystem.fragments || [];
        const total = fragArray.length;
        if (total > 0) {
          // Build { region: count } map from fragment array
          const fragCounts = {};
          for (const f of fragArray) {
            fragCounts[f.region] = (fragCounts[f.region] || 0) + 1;
          }

          const fragHdr = createDiv().class("svc-section-hdr").parent(svcScroll);
          createSpan("🗺️").class("svc-hdr-icon").parent(fragHdr);
          createSpan("Treasure Fragments").class("svc-hdr-title").style("color", "#ff9800").parent(fragHdr);
          createSpan(`${total} collected`).class("svc-hdr-badge").style("color", "#ff9800").style("border-color", "#6d4c00").parent(fragHdr);

          for (const [region, count] of Object.entries(fragCounts)) {
            if (count <= 0) continue;
            const row = createDiv().class("svc-frag-row").parent(svcScroll);
            createSpan(`${region.charAt(0).toUpperCase() + region.slice(1)}`).class("svc-frag-label").parent(row);
            const bar = createDiv().class("svc-frag-bar").parent(row);
            const fill = createDiv().class("svc-frag-fill").parent(bar);
            fill.style("width", `${Math.min(100, (count / 3) * 100)}%`);
            if (count >= 3) fill.addClass("complete");
            createSpan(`${count} / 3`).class("svc-frag-count").parent(row);
            if (count >= 3)
              createSpan("✨").parent(row).style("font-size", "14px");
          }
        }
      }
    }

    // ═══════════════════════════════
    //  INFO TAB
    // ═══════════════════════════════
    if (tab === "info") {
      const infoPanel = select("#cityTabInfo");
      infoPanel.html("");

      // City stats
      const statsBox = createDiv().class("info-stats-box").parent(infoPanel);
      createElement("h3", "📊 City Info").parent(statsBox).style("color", "#d4af37").style("margin", "0 0 8px");

      const statsList = createDiv().parent(statsBox).style("display", "flex").style("flex-direction", "column").style("gap", "4px");

      const addStat = (label, value) => {
        const row = createDiv().parent(statsList).style("display", "flex").style("justify-content", "space-between");
        createSpan(label).parent(row).style("color", "#aaa").style("font-size", "13px");
        createSpan(value).parent(row).style("color", "#fff").style("font-size", "13px").style("font-weight", "bold");
      };

      addStat("Population", city.population.toString());
      addStat("Unique Items", city.inventory.size.toString());
      addStat("Coastal", (city.isCoastal || city.port) ? "Yes ⚓" : "No");

      // Total city wealth (sum of item values)
      let cityWealth = 0;
      for (const [key, entry] of city.inventory) {
        cityWealth += city.calculateItemPrice(key, cities, false) * entry.quantity;
      }
      addStat("Market Value", `$${cityWealth}`);

      // Reputation display
      const repVal = typeof city.reputation === 'number' ? city.reputation : 50;
      const repTier = city.getReputationTier ? city.getReputationTier() : { name: 'Neutral', color: '#aaa', emoji: '😐' };
      const repPriceMod = city.getReputationPriceModifier ? city.getReputationPriceModifier(false) : 1;
      const repPct = Math.round((1 - repPriceMod) * 100);
      const repLabel = repPct > 0 ? `${repPct}% discount` : repPct < 0 ? `${Math.abs(repPct)}% markup` : 'no effect';

      const repRow = createDiv().parent(statsList)
        .style("display", "flex").style("justify-content", "space-between").style("align-items", "center");
      createSpan("Reputation").parent(repRow).style("color", "#aaa").style("font-size", "13px");
      const repRight = createDiv().parent(repRow).style("display", "flex").style("align-items", "center").style("gap", "6px");
      createSpan(`${repTier.emoji} ${repTier.name}`).parent(repRight)
        .style("color", repTier.color).style("font-size", "13px").style("font-weight", "bold");
      createSpan(`(${repLabel})`).parent(repRight)
        .style("color", "#888").style("font-size", "11px");

      // Reputation bar
      const repBarOuter = createDiv().parent(statsList)
        .style("height", "8px").style("background", "#1a1a2e")
        .style("border-radius", "4px").style("overflow", "hidden").style("margin-top", "2px");
      createDiv().parent(repBarOuter)
        .style("height", "100%").style("width", `${repVal}%`)
        .style("background", repTier.color).style("border-radius", "4px")
        .style("transition", "width 0.3s");

      if (city.holidays && city.holidays.length > 0) {
        createElement("h4", "🎉 Holidays").parent(statsBox)
          .style("color", "#d4af37").style("margin", "10px 0 4px");

        const holidayList = createDiv().parent(statsBox)
          .style("display", "flex").style("flex-direction", "column").style("gap", "4px");

        for (const h of city.holidays) {
          const row = createDiv().parent(holidayList)
            .style("display", "flex").style("justify-content", "space-between")
            .style("background", "#222").style("padding", "4px 8px")
            .style("border-radius", "4px");
          createSpan(h.name || "Festival").parent(row)
            .style("color", "#fff").style("font-size", "12px");
          createSpan(`Day ${h.day} • ${h.season}`).parent(row)
            .style("color", "#aaa").style("font-size", "12px");
        }
      }

      // Book-themed holidays (discounts)
      if (city.bookHolidays && city.bookHolidays.length > 0) {
        createElement("h4", "📚 Book Festivals").parent(statsBox)
          .style("color", "#8b9dc3").style("margin", "10px 0 4px");

        const bookHolList = createDiv().parent(statsBox)
          .style("display", "flex").style("flex-direction", "column").style("gap", "4px");

        for (const bh of city.bookHolidays) {
          const bookItem = ItemLibrary[bh.bookKey];
          const bookName = bookItem ? bookItem.name : bh.bookKey;
          const row = createDiv().parent(bookHolList)
            .style("display", "flex").style("justify-content", "space-between")
            .style("background", "#1a1a2e").style("padding", "4px 8px")
            .style("border-radius", "4px").style("border-left", "3px solid #8b9dc3");
          createSpan(`${bh.name}`).parent(row)
            .style("color", "#c8d6e5").style("font-size", "12px");
          createSpan(`Day ${bh.day} • ${bh.season} • ${Math.round(bh.discount * 100)}% off ${bookName}`).parent(row)
            .style("color", "#7f8fa6").style("font-size", "11px");
        }
      }

      // ── Traders in City ──
      const cityIdx = cities.indexOf(city);
      if (typeof traderManager !== 'undefined' && cityIdx >= 0) {
        const tradersHere = traderManager.getTradersAtCity(cityIdx);
        const tradersIncoming = traderManager.getTradersHeadingToCity(cityIdx);

        createElement("h4", '').parent(statsBox).html(`${atlasIconHTML('trader', 16, '🧑‍💼')} Traders (${tradersHere.length})`)
          .style("color", "#6c6").style("margin", "10px 0 4px");

        if (tradersHere.length === 0 && tradersIncoming.length === 0) {
          createP("No traders in town.").parent(statsBox)
            .style("color", "#666").style("font-size", "12px").style("margin", "2px 0");
        } else {
          const traderList = createDiv().parent(statsBox)
            .style("display", "flex").style("flex-direction", "column").style("gap", "4px");

          for (const t of tradersHere) {
            const row = createDiv().parent(traderList)
              .style("display", "flex").style("justify-content", "space-between").style("align-items", "center")
              .style("background", "#1a2a1a").style("padding", "4px 8px")
              .style("border-radius", "4px").style("border-left", "3px solid #4a4");

            const leftCol = createDiv().parent(row).style("display", "flex").style("gap", "6px").style("align-items", "center");
            const _tIconEl = (typeof AtlasManager !== 'undefined' && AtlasManager.has('trader'))
              ? AtlasManager.createDOMCanvas('trader', 20)
              : (() => { const s = document.createElement('span'); s.textContent = '🧑‍💼'; s.style.fontSize = '14px'; return s; })();
            leftCol.elt.appendChild(_tIconEl);
            createSpan(t.name).parent(leftCol)
              .style("color", "#fff").style("font-size", "12px").style("font-weight", "bold");
            createSpan(`(${t.personality})`).parent(leftCol)
              .style("color", "#888").style("font-size", "11px");

            const rightCol = createDiv().parent(row).style("display", "flex").style("gap", "8px").style("align-items", "center");
            createSpan(`💰${t.gold}`).parent(rightCol)
              .style("color", "#d4af37").style("font-size", "11px");
            createSpan(`📦${t.inventory.size} items`).parent(rightCol)
              .style("color", "#aaa").style("font-size", "11px");
            const stateLabel = t.state === 'trading' ? '🔄 Trading' : '⏳ Resting';
            createSpan(stateLabel).parent(rightCol)
              .style("color", t.state === 'trading' ? "#6c6" : "#cc6").style("font-size", "11px");
          }

          for (const t of tradersIncoming) {
            const row = createDiv().parent(traderList)
              .style("display", "flex").style("justify-content", "space-between").style("align-items", "center")
              .style("background", "#1a1a2a").style("padding", "4px 8px")
              .style("border-radius", "4px").style("border-left", "3px solid #66a");

            const leftCol2 = createDiv().parent(row).style("display", "flex").style("gap", "6px").style("align-items", "center");
            const _tIconEl2 = (typeof AtlasManager !== 'undefined' && AtlasManager.has('trader'))
              ? AtlasManager.createDOMCanvas('trader', 20)
              : (() => { const s = document.createElement('span'); s.textContent = '🧑‍💼'; s.style.fontSize = '14px'; return s; })();
            leftCol2.elt.appendChild(_tIconEl2);
            createSpan(t.name).parent(leftCol2)
              .style("color", "#aac").style("font-size", "12px");
            createSpan("→ En route").parent(leftCol2)
              .style("color", "#668").style("font-size", "11px").style("font-style", "italic");
          }
        }
      }

      // ── Nearby Raiders / Threats ──
      if (typeof raiderManager !== 'undefined' && cityIdx >= 0) {
        const nearbyRaiders = raiderManager.getRaidersNearCity(cityIdx, 12);

        let threatLabel = "✅ Safe";
        let threatColor = "#4a4";
        if (nearbyRaiders.length >= 3) {
          threatLabel = "🔴 Dangerous";
          threatColor = "#c44";
        } else if (nearbyRaiders.length >= 1) {
          threatLabel = "⚠️ Threats Nearby";
          threatColor = "#ca4";
        }

        createElement("h4", '').parent(statsBox).html(`${atlasIconHTML('raider', 16, '⚔️')} Threats (${nearbyRaiders.length})`)
          .style("color", threatColor).style("margin", "10px 0 4px");

        const threatInfo = createDiv().parent(statsBox)
          .style("display", "flex").style("justify-content", "space-between")
          .style("background", "#222").style("padding", "4px 8px")
          .style("border-radius", "4px");
        createSpan("Road Safety").parent(threatInfo)
          .style("color", "#aaa").style("font-size", "12px");
        createSpan(threatLabel).parent(threatInfo)
          .style("color", threatColor).style("font-size", "12px").style("font-weight", "bold");

        if (nearbyRaiders.length > 0) {
          const raiderList = createDiv().parent(statsBox)
            .style("display", "flex").style("flex-direction", "column").style("gap", "4px").style("margin-top", "4px");

          for (const r of nearbyRaiders) {
            const row = createDiv().parent(raiderList)
              .style("display", "flex").style("justify-content", "space-between").style("align-items", "center")
              .style("background", "#2a1a1a").style("padding", "4px 8px")
              .style("border-radius", "4px").style("border-left", "3px solid #a44");

            const loc = cities[cityIdx].location;
            const dist = Math.abs(r.x - loc.x) + Math.abs(r.y - loc.y);
            const dirX = r.x - loc.x;
            const dirY = r.y - loc.y;
            let compass = "";
            if (Math.abs(dirY) > Math.abs(dirX)) {
              compass = dirY < 0 ? "North" : "South";
            } else {
              compass = dirX < 0 ? "West" : "East";
            }

            const name = r.isMonster
              ? (r.type === 'dragon' ? '🐉 Dragon' : r.type === 'blackKnight' ? '⚫ Black Knight' : '👻 Wraith')
              : null;
            if (name) {
              createSpan(name).parent(row)
                .style("color", "#c6f").style("font-size", "12px");
            } else {
              const _rIconEl = (typeof AtlasManager !== 'undefined' && AtlasManager.has('raider'))
                ? AtlasManager.createDOMCanvas('raider', 20)
                : (() => { const s = document.createElement('span'); s.textContent = '🗡️'; s.style.fontSize = '14px'; return s; })();
              const rLabel = createDiv().parent(row)
                .style("display", "flex").style("gap", "4px").style("align-items", "center");
              rLabel.elt.appendChild(_rIconEl);
              createSpan('Raiders').parent(rLabel).style("color", "#f88").style("font-size", "12px");
            }

            const rightCol = createDiv().parent(row).style("display", "flex").style("gap", "8px");
            createSpan(`Str:${r.strength}`).parent(rightCol)
              .style("color", "#f88").style("font-size", "11px");
            createSpan(`${dist} tiles ${compass}`).parent(rightCol)
              .style("color", "#aaa").style("font-size", "11px");
          }
        }
      }
    }
  },

  hide: () => {
    const view = select("#cityView");
    if (view) { view.style("opacity", "0"); uiManager.scheduleFadeHide("cityView", 200); }
    // Also close the travel map window
    select("#travelMapWindow")?.style("display", "none");
  },

  update: () => {
    if (typeof player === 'undefined' || !player) return;
    const view = select("#cityView");
    if (!view) return;
    const shouldBeVisible = !!player.currentCity;
    const isVisible = view.elt.style.display !== "none" && view.elt.style.opacity !== "0";
    if (shouldBeVisible && !isVisible) {
      uiManager._cancelFade("cityView"); // cancel any pending fade-out
      uiManager.screens["cityView"].show();
    } else if (!shouldBeVisible && isVisible) {
      uiManager.screens["cityView"].hide();
    }
  }
});


// ============================
// PLAYER HUD (bottom bar)
// ============================
uiManager.registerScreen("playerView", {
  validStates: [GameStates.PLAYING, GameStates.INVENTORY],

  create: () => {
    const bar = createDiv().id("playerView").class("hud-bar");

    // Left section: name + gold + cargo badges
    const statsWrapper = createDiv().class("hud-stats").parent(bar);
    createSpan("").id("playerName")
      .style("color", "#d4af37").style("font-weight", "bold").style("margin-right", "8px")
      .style("cursor", "pointer").style("text-decoration", "underline dotted")
      .attribute("title", `Open Inventory (${getActionDisplay('inventory')})`)
      .parent(statsWrapper)
      .mousePressed(() => gameStateManager.setState(GameStates.INVENTORY));

    // Difficulty badge
    createSpan("").id("hudDiffBadge")
      .style("font-size", "11px").style("padding", "1px 7px").style("border-radius", "8px")
      .style("margin-right", "8px").style("font-weight", "bold").style("letter-spacing", "0.5px")
      .parent(statsWrapper);
    createSpan("").id("playerGold").parent(statsWrapper);
    createSpan("").id("playerCargo").parent(statsWrapper);

    // HP bar
    const hpWrapper = createDiv().id("hudHpWrapper").class("hud-hp-wrapper").parent(statsWrapper);
    createSpan("❤️").class("hud-hp-icon").parent(hpWrapper);
    const hpBarOuter = createDiv().class("hud-hp-bar-outer").parent(hpWrapper);
    createDiv().id("hudHpBarInner").class("hud-hp-bar-inner").parent(hpBarOuter);
    createSpan("").id("hudHpText").class("hud-hp-text").parent(hpWrapper);

    // Center section: inventory chips (flex-expands to fill space)
    createDiv().id("hudInventoryChips").class("hud-inv-chips").parent(bar);

    // Right section: time/date + speed controls
    const rightSection = createDiv().style("display", "flex").style("align-items", "center").style("gap", "10px").style("flex-shrink", "0").parent(bar);

    const timeWrapper = createDiv().class("hud-time").parent(rightSection);
    createSpan("").id("dayCycleIcon").parent(timeWrapper);
    createSpan("").id("dayLabel").parent(timeWrapper);
    createSpan("").id("timeLabel").parent(timeWrapper);

    // Speed controls
    const speedWrapper = createDiv().class("hud-speed").parent(rightSection);

    const slowBtn = document.createElement("button");
    slowBtn.className = "speed-btn";
    slowBtn.textContent = "<<";
    slowBtn.title = `Slow down (${getActionDisplay('speedDown')})`;
    slowBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (typeof gameSpeedIndex !== 'undefined' && gameSpeedIndex > 0) {
        gameSpeedIndex--;
        gameSpeed = SPEED_STEPS[gameSpeedIndex];
        syncSpeedDisplay();
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log(`Speed: ${gameSpeed}×`, "info");
        }
      }
    });
    speedWrapper.elt.appendChild(slowBtn);

    const speedLabel = document.createElement("span");
    speedLabel.id = "speedLabel";
    speedLabel.textContent = "1×";
    speedWrapper.elt.appendChild(speedLabel);

    const fastBtn = document.createElement("button");
    fastBtn.className = "speed-btn";
    fastBtn.textContent = ">>";
    fastBtn.title = `Speed up (${getActionDisplay('speedUp')})`;
    fastBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (typeof gameSpeedIndex !== 'undefined' && gameSpeedIndex < SPEED_STEPS.length - 1) {
        gameSpeedIndex++;
        gameSpeed = SPEED_STEPS[gameSpeedIndex];
        syncSpeedDisplay();
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log(`Speed: ${gameSpeed}×`, "info");
        }
      }
    });
    speedWrapper.elt.appendChild(fastBtn);

    // ── Tutorial help "?" button ──
    const helpBtn = document.createElement("button");
    helpBtn.className = "tutorial-hud-btn";
    helpBtn.textContent = "?";
    helpBtn.title = "Game Guide";
    helpBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (typeof tutorialSystem !== 'undefined' && tutorialSystem) {
        tutorialSystem.showHelpPanel();
      }
    });
    rightSection.elt.appendChild(helpBtn);

    return bar;
  },

  show: () => {
    const view = select("#playerView");
    if (view) {
      view.style("display", "flex");
    }
    uiManager.screens["playerView"].update();
  },

  hide: () => {
    const view = select("#playerView");
    if (view) view.style("display", "none");
  },

  update: () => {
    if (!player) return;

    select("#playerName")?.html(player.name || 'Captain');
    select("#playerGold")?.html(`💰 ${player.gold}`);

    // Difficulty badge
    const diffBadge = select("#hudDiffBadge");
    if (diffBadge && window.DIFFICULTY_CONFIG) {
      const dc = window.DIFFICULTY_CONFIG;
      const colors = { Easy: '#2e7d32', Normal: '#b8860b', Hard: '#c62828', Hardcore: '#6a1b9a' };
      const bgColors = { Easy: '#1b5e2022', Normal: '#b8860b22', Hard: '#c6282822', Hardcore: '#6a1b9a22' };
      diffBadge.html(`${dc.icon} ${dc.label}`);
      diffBadge.style("color", colors[dc.label] || '#aaa');
      diffBadge.style("background", bgColors[dc.label] || 'transparent');
      diffBadge.style("border", `1px solid ${colors[dc.label] || '#555'}44`);
    }

    // HP bar update
    const maxHP = player.getMaxHP ? player.getMaxHP() : 10;
    const curHP = player.currentHP != null ? player.currentHP : maxHP;
    const hpPct = Math.max(0, Math.min(100, (curHP / maxHP) * 100));
    const hpBar = select("#hudHpBarInner");
    if (hpBar) {
      hpBar.style("width", `${hpPct}%`);
      if (hpPct > 60) hpBar.style("background", "linear-gradient(90deg, #4CAF50, #66BB6A)");
      else if (hpPct > 30) hpBar.style("background", "linear-gradient(90deg, #FF9800, #FFC107)");
      else hpBar.style("background", "linear-gradient(90deg, #f44336, #FF5722)");
    }
    select("#hudHpText")?.html(`${curHP}/${maxHP}`);

    // Cargo weight
    let totalWeight = 0;
    for (let [key, entry] of player.inventory) {
      const item = ItemLibrary[key];
      if (item) totalWeight += item.weight * entry.quantity;
    }
    select("#playerCargo")?.html(`📦 ${totalWeight}/${player.getEffectiveCargoCapacity ? player.getEffectiveCargoCapacity() : (player.cargoCapacity || 50)}`);

    // --- Inventory icon chips ---
    const chipsEl = document.getElementById('hudInventoryChips');
    if (chipsEl) {
      // Fingerprint to avoid rebuilding every frame
      let invFp = '';
      const entries = [...player.inventory.entries()].filter(([k]) => k in ItemLibrary);
      for (const [k, e] of entries) invFp += `${k}:${e.quantity}|`;
      if (player.isSailing && player.activeBoat) invFp += `boat:${player.activeBoat.name}:${player.activeBoat.condition}`;

      if (invFp !== window._hudInvFp) {
        window._hudInvFp = invFp;
        chipsEl.innerHTML = '';

        // Boat prefix with condition
        if (player.isSailing && player.activeBoat) {
          const b = player.activeBoat;
          const boatTag = document.createElement('span');
          boatTag.className = 'hud-boat-tag';
          if (b.isCritical()) boatTag.classList.add('hud-boat-critical');
          boatTag.textContent = `⛵ ${b.name} — ${b.condition}%`;
          boatTag.style.borderLeft = `3px solid ${b.conditionColor()}`;
          chipsEl.appendChild(boatTag);
        }

        if (entries.length === 0) {
          const empty = document.createElement('span');
          empty.className = 'hud-inv-empty';
          empty.textContent = '🎒 Empty';
          chipsEl.appendChild(empty);
        } else {
          const MAX_CHIPS = 6;
          const shown = entries.slice(0, MAX_CHIPS);
          for (const [key, entry] of shown) {
            const chip = document.createElement('div');
            chip.className = 'hud-item-chip';
            chip.title = `${ItemLibrary[key].name} — ${entry.quantity} (${ItemLibrary[key].weight * entry.quantity}kg)`;
            chip.appendChild(createItemIconEl(key, 18));
            const qty = document.createElement('span');
            qty.className = 'hud-chip-qty';
            qty.textContent = `×${entry.quantity}`;
            chip.appendChild(qty);
            chipsEl.appendChild(chip);
          }
          if (entries.length > MAX_CHIPS) {
            const more = document.createElement('span');
            more.className = 'hud-chip-more';
            more.textContent = `+${entries.length - MAX_CHIPS}`;
            chipsEl.appendChild(more);
          }
        }
      }
    }

    if (typeof dayNight !== 'undefined') {
      const dayNum = dayNight.getDaysElapsed();
      const weekday = dayNight.getDayOfWeek();
      const season = dayNight.getSeason();
      const year = dayNight.getYear();
      select("#dayLabel")?.html(`Year ${year}, ${season} — Day ${dayNum} (${weekday})`);
      if (dayNight.getTimeString) {
        select("#timeLabel")?.html(dayNight.getTimeString());
      }
      // Update day/night cycle icon
      const t = dayNight.getLightFactor();
      let icon = '🌙';
      let iconTitle = 'Night';
      if (t < 0.2) { icon = '☀️'; iconTitle = 'Day'; }
      else if (t < 0.4) { icon = '🌅'; iconTitle = 'Dawn'; }
      else if (t < 0.6) { icon = '☀️'; iconTitle = 'Day'; }
      else if (t < 0.8) { icon = '🌇'; iconTitle = 'Dusk'; }
      else { icon = '🌙'; iconTitle = 'Night'; }
      const iconEl = select("#dayCycleIcon");
      if (iconEl) {
        iconEl.html(icon);
        iconEl.attribute('title', iconTitle);
      }
    }

    // Speed display (syncs with keyboard Q/E changes too)
    syncSpeedDisplay();
  }
});


// ============================
// INVENTORY VIEW (press I)
// ============================
function _invSwitchTab(tab) {
  const invContent    = select("#invTabInventory");
  const playerContent = select("#invTabPlayer");
  if (invContent)    invContent.style("display",    tab === 'inventory' ? "block" : "none");
  if (playerContent) playerContent.style("display", tab === 'player'    ? "block" : "none");
  selectAll(".inv-tab").forEach(t => {
    if (t.elt.dataset.invTab === tab) t.addClass("inv-tab-active");
    else t.removeClass("inv-tab-active");
  });
}

uiManager.registerScreen("inventoryView", {
  validStates: [GameStates.INVENTORY],

  create: () => {
    const wrapper = createDiv().id("inventoryView").class("screen inventory-screen").style("display", "none");

    // Header (always visible)
    const header = createDiv().class("inv-header").parent(wrapper);
    createElement("h2", "🎒 Inventory").parent(header);
    createSpan("").id("invGold").parent(header);
    createSpan("").id("invCargo").parent(header);

    // Tab bar
    const tabBar = createDiv().class("inv-tab-bar").parent(wrapper);
    const invTabBtn = createButton("🎒 Inventory").parent(tabBar).addClass("inv-tab inv-tab-active");
    invTabBtn.elt.dataset.invTab = 'inventory';
    invTabBtn.mousePressed(() => _invSwitchTab('inventory'));
    const playerTabBtn = createButton("⚔️ Player").parent(tabBar).addClass("inv-tab");
    playerTabBtn.elt.dataset.invTab = 'player';
    playerTabBtn.mousePressed(() => _invSwitchTab('player'));

    // ── Inventory tab ──
    const invTabContent = createDiv().id("invTabInventory").class("inv-tab-content").parent(wrapper);
    createDiv().id("invFilterBar").class("inv-filter-bar").parent(invTabContent);
    createDiv().id("invItemList").class("inv-item-list").parent(invTabContent);
    createElement("h3", "⛵ Fleet").parent(invTabContent).style("margin-top", "16px");
    createDiv().id("invFleet").class("inv-fleet").parent(invTabContent);

    // ── Player tab ──
    const playerTabContent = createDiv().id("invTabPlayer").class("inv-tab-content").parent(wrapper);
    createDiv().id("invStats").class("inv-stats").parent(playerTabContent);

    // Close button (show mapped inventory key)
    const invKey = (keyBindings && keyBindings.inventory && keyBindings.inventory.display) ? keyBindings.inventory.display : 'I';
    const closeBtn = createButton(`Close (${invKey})`)
      .parent(wrapper)
      .addClass("menu-btn")
      .id("invCloseBtn")
      .style("margin-top", "16px")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.PLAYING);
      });

    return wrapper;
  },

  show: () => {
    const view = select("#inventoryView");
    if (view) {
      view.show().style("opacity", "1");
    }
    _invSwitchTab('inventory'); // always open on inventory tab
    uiManager.screens["inventoryView"].update();
    // Show contextual tutorial tip the first time inventory is opened
    if (typeof tutorialSystem !== 'undefined' && tutorialSystem) {
      tutorialSystem.tryShow('inventory');
    }
    // Refresh close button label in case keybindings changed
    const btn = select("#invCloseBtn");
    if (btn) {
      const lbl = (keyBindings && keyBindings.inventory && keyBindings.inventory.display) ? keyBindings.inventory.display : 'I';
      btn.html(`Close (${lbl})`);
    }
  },

  hide: () => {
    const view = select("#inventoryView");
    if (view) { view.style("opacity", "0"); uiManager.scheduleFadeHide("inventoryView", 200); }
  },

  update: () => {
    if (typeof player === 'undefined' || !player) return;

    if (!window._invFilters) window._invFilters = { category: 'all', sort: 'default', tag: 'all' };
    const invF = window._invFilters;

    // Build a fingerprint of current data to skip DOM rebuild if unchanged
    let fp = `${player.gold}|${player.combatStrength}|${player.cargoCapacity}|${player.fleet.length}|${player.activeBoat?.name || ""}|eq:${player.equippedWeapon || 'Fists'}|lv:${player.level}|xp:${player.xp}|sp:${player.statPoints}|hp:${player.bonusMaxHP}|atk:${player.bonusAttack}|def:${player.bonusDefense}|mag:${player.bonusMagic}|cha:${player.bonusCharm}|spd:${player.bonusSpeed}`;
    for (const [key, entry] of player.inventory) {
      fp += `|${key}:${entry.quantity}`;
    }
    if (typeof dayNight !== 'undefined') fp += `|d${dayNight.getDaysElapsed()}`;
    fp += `|icat:${invF.category}|isort:${invF.sort}|itag:${invF.tag}`;
    if (fp === window._invLastFingerprint) return;
    window._invLastFingerprint = fp;

    // Gold & cargo
    select("#invGold")?.html(`💰 Gold: ${player.gold}`);
    let totalWeight = 0;
    for (const [key, entry] of player.inventory) {
      const item = ItemLibrary[key];
      if (item) totalWeight += item.weight * entry.quantity;
    }
    const cap = player.getEffectiveCargoCapacity ? player.getEffectiveCargoCapacity() : (player.cargoCapacity || 50);
    select("#invCargo")?.html(`📦 Cargo: ${totalWeight}/${cap}`);

    // Equipped weapon display
    let invWeaponEl = select("#invWeapon");
    if (!invWeaponEl) {
      invWeaponEl = createSpan("").id("invWeapon");
      const hdr = select(".inv-header");
      if (hdr) invWeaponEl.parent(hdr);
    }
    if (invWeaponEl) {
      const eqName = player.equippedWeapon || 'Fists';
      invWeaponEl.html(`⚔️ ${eqName}`);
    }

    // Items grouped by category
    const itemList = select("#invItemList");
    if (!itemList) return;
    itemList.html("");

    const byCategory = {};
    for (const [key, entry] of player.inventory) {
      const item = ItemLibrary[key];
      if (!item) continue;
      const cat = item.category || "Other";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push({ name: key, item, qty: entry.quantity, avgPrice: entry.avgPrice || 0 });
    }

    // Collect tags present in the player's current inventory
    const allInvTags = [...new Set(
      [...player.inventory.keys()]
        .map(k => ItemLibrary[k]).filter(Boolean)
        .flatMap(item => item.tags ? [...item.tags] : [])
    )].sort();

    // ── Filter bar ──
    const filterBar = select("#invFilterBar");
    if (filterBar) {
      filterBar.html("");
      const allCats = Object.keys(byCategory).sort();

      // Category pills — only shown when there are multiple categories
      if (allCats.length > 1) {
        createSpan("Cat:").parent(filterBar).class("inv-filter-label");
        createSpan("All").parent(filterBar)
          .class("inv-filter-tag" + (invF.category === 'all' ? ' active' : ''))
          .mousePressed(() => { window._invFilters.category = 'all'; window._invLastFingerprint = null; uiManager.screens['inventoryView'].update(); });
        for (const cat of allCats) {
          createSpan(cat).parent(filterBar)
            .class("inv-filter-tag" + (invF.category === cat ? ' active' : ''))
            .mousePressed(() => { window._invFilters.category = cat; window._invLastFingerprint = null; uiManager.screens['inventoryView'].update(); });
        }
      }

      // Tag pills — shown whenever tags exist in the inventory
      if (allInvTags.length > 0) {
        createSpan("Tag:").parent(filterBar).class("inv-filter-label");
        createSpan("All").parent(filterBar)
          .class("inv-filter-tag" + (invF.tag === 'all' ? ' active' : ''))
          .mousePressed(() => { window._invFilters.tag = 'all'; window._invLastFingerprint = null; uiManager.screens['inventoryView'].update(); });
        for (const tag of allInvTags) {
          createSpan(tag).parent(filterBar)
            .class("inv-filter-tag" + (invF.tag === tag ? ' active' : ''))
            .mousePressed(() => { window._invFilters.tag = tag; window._invLastFingerprint = null; uiManager.screens['inventoryView'].update(); });
        }
      }

      // Sort dropdown
      createSpan("").parent(filterBar).class("inv-filter-sep"); // push sort right
      createSpan("Sort:").parent(filterBar).class("inv-filter-label");
      const sortSel = createElement("select").parent(filterBar);
      [["Default", "default"], ["Name A–Z", "name"], ["Heaviest", "weight"], ["Most qty", "qty"]]
        .forEach(([label, val]) => {
          const opt = createElement("option", label).parent(sortSel).attribute("value", val);
          if (invF.sort === val) opt.attribute("selected", "selected");
        });
      sortSel.changed(() => { window._invFilters.sort = sortSel.value(); window._invLastFingerprint = null; uiManager.screens['inventoryView'].update(); });

      // Reset — only shown when any filter is active
      if (invF.category !== 'all' || invF.sort !== 'default' || invF.tag !== 'all') {
        createSpan("✕ Reset").parent(filterBar).class("inv-filter-reset")
          .mousePressed(() => {
            window._invFilters.category = 'all';
            window._invFilters.sort = 'default';
            window._invFilters.tag = 'all';
            window._invLastFingerprint = null;
            uiManager.screens['inventoryView'].update();
          });
      }
    }

    if (Object.keys(byCategory).length === 0) {
      createP("No items in inventory.").parent(itemList).style("color", "#666");
    } else {
      let anyVisible = false;
      for (const cat of Object.keys(byCategory).sort()) {
        if (invF.category !== 'all' && cat !== invF.category) continue;

        let entries = byCategory[cat];
        if (invF.tag !== 'all') entries = entries.filter(e => e.item.tags && e.item.tags.has(invF.tag));
        if (entries.length === 0) continue;
        anyVisible = true;

        if (invF.sort === 'name')   entries.sort((a, b) => (a.item.name || a.name).localeCompare(b.item.name || b.name));
        else if (invF.sort === 'weight') entries.sort((a, b) => (b.item.weight * b.qty) - (a.item.weight * a.qty));
        else if (invF.sort === 'qty')    entries.sort((a, b) => b.qty - a.qty);

        const catDiv = createDiv().class("inv-category").parent(itemList);
        createElement("h4", cat).parent(catDiv);
        for (const entry of entries) {
          const row = createDiv().class("inv-item-row").parent(catDiv);
          // Icon element (img or emoji)
          const iconEl = createItemIconEl(entry.name, 20);
          iconEl.classList.add('inv-item-icon');
          row.elt.appendChild(iconEl);
          createSpan(entry.item.name || entry.name).class("inv-item-name").parent(row);
          createSpan(`×${entry.qty}`).class("inv-item-qty").parent(row);
          createSpan(`${entry.item.weight}kg ea`).class("inv-item-weight").parent(row);
          if (entry.avgPrice > 0) {
            createSpan(`avg ${Math.round(entry.avgPrice)}g`).class("inv-item-price").parent(row);
          }
          // Book "Read" button
          if (entry.item.tags && entry.item.tags.has('book')) {
            const readBtn = createButton("📖 Read").parent(row)
              .addClass("book-read-btn")
              .style("margin-left", "auto")
              .style("padding", "2px 10px")
              .style("font-size", "11px")
              .style("cursor", "pointer")
              .style("background", "#2a2a4a")
              .style("color", "#c8d6e5")
              .style("border", "1px solid #4a4a7a")
              .style("border-radius", "4px");
            readBtn.mousePressed(() => {
              openBookPopup(entry.name);
            });
          }
          // Weapon equip / unequip button
          if (entry.item.category === 'Weapon') {
            const isEquipped = player.equippedWeapon === entry.name;
            const eqBtn = createButton(isEquipped ? '✓ Unequip' : '⚔️ Equip').parent(row)
              .addClass(isEquipped ? 'weapon-unequip-btn' : 'weapon-equip-btn')
              .style('margin-left', 'auto')
              .style('padding', '2px 10px')
              .style('font-size', '11px')
              .style('cursor', 'pointer')
              .style('border-radius', '4px');
            if (isEquipped) {
              eqBtn.style('background', '#2e7d32').style('color', '#fff').style('border', '1px solid #4caf50');
            } else {
              eqBtn.style('background', '#3a1a1a').style('color', '#e0c8c8').style('border', '1px solid #7a3a3a');
            }
            const wk = entry.name;
            eqBtn.mousePressed(() => {
              if (player.equippedWeapon === wk) {
                player.unequipWeapon();
              } else {
                player.equipWeapon(wk);
              }
              window._invLastFingerprint = null; // force rebuild
              uiManager.screens['inventoryView'].update();
            });
          }
          // Bag equip / unequip button
          if (entry.item.category === 'Bag') {
            const isEquipped = player.equippedBag === entry.name;
            const bagData = typeof BAGS !== 'undefined' ? BAGS[entry.name] : null;
            const label = isEquipped ? '✓ Unequip' : `🎒 Equip (+${bagData ? bagData.cargoBonus : '?'})`;
            const eqBtn = createButton(label).parent(row)
              .addClass(isEquipped ? 'weapon-unequip-btn' : 'weapon-equip-btn')
              .style('margin-left', 'auto')
              .style('padding', '2px 10px')
              .style('font-size', '11px')
              .style('cursor', 'pointer')
              .style('border-radius', '4px');
            if (isEquipped) {
              eqBtn.style('background', '#2e7d32').style('color', '#fff').style('border', '1px solid #4caf50');
            } else {
              eqBtn.style('background', '#1a2a3a').style('color', '#c8d8e8').style('border', '1px solid #3a5a7a');
            }
            const bk = entry.name;
            eqBtn.mousePressed(() => {
              if (player.equippedBag === bk) {
                player.unequipBag();
              } else {
                player.equipBag(bk);
              }
              window._invLastFingerprint = null;
              uiManager.screens['inventoryView'].update();
            });
          }
        }
      }
      if (!anyVisible) {
        createP("No items match the current filters.").parent(itemList).style("color", "#666");
      }
    }

    // Fleet
    const fleetDiv = select("#invFleet");
    if (fleetDiv) {
      fleetDiv.html("");
      if (player.fleet.length === 0) {
        createP("No boats owned.").parent(fleetDiv).style("color", "#666");
      } else {
        for (const boat of player.fleet) {
          const isActive = player.activeBoat === boat;
          const bRow = createDiv().class("inv-fleet-row" + (isActive ? " inv-fleet-active" : "")).parent(fleetDiv);
          const icon = BoatLibrary[boat.type]?.icon || "🚢";
          const nameRow = createDiv().class("inv-fleet-name-row").parent(bRow);
          createSpan(`${icon} ${boat.name}`).class("inv-fleet-boat-name").parent(nameRow);
          if (isActive) createSpan("✓ Active").class("inv-fleet-active-badge").parent(nameRow);
          // Hold usage badge
          if (boat.getStorageCapacity) {
            const hw = boat.getStorageWeight();
            const hc = boat.getStorageCapacity();
            const holdColor = hw >= hc ? '#f44336' : hw >= hc * 0.8 ? '#ff9800' : '#4caf50';
            createSpan(`Hold: ${hw}/${hc}`)
              .class("inv-fleet-active-badge")
              .style("color", holdColor)
              .style("border-color", holdColor + '44')
              .parent(nameRow);
          }
          createSpan(`${boat.displayName} • Cargo +${boat.cargoBonus}`).class("inv-fleet-details").parent(bRow);
          if (boat.condition !== undefined) {
            const condPct = Math.max(0, Math.min(100, boat.condition));
            const condColor = condPct > 66 ? '#4caf50' : condPct > 33 ? '#ff9800' : '#f44336';
            const condOuter = createDiv().class("inv-fleet-cond-bar").parent(bRow);
            createDiv().class("inv-fleet-cond-fill").style("width", condPct + "%").style("background", condColor).parent(condOuter);
            createSpan(`Hull: ${condPct}%${boat.conditionLabel ? ` (${boat.conditionLabel()})` : ''}`).class("inv-fleet-cond-text").parent(bRow);
          }
          // Manage Hold button
          const holdBtn = createButton('⚓ Manage Hold').parent(bRow);
          holdBtn.style('margin-top', '6px').style('padding', '4px 12px').style('font-size', '11px')
            .style('cursor', 'pointer').style('border-radius', '4px')
            .style('background', '#1a2a3a').style('color', '#7ec8e3').style('border', '1px solid #3a6a8a');
          holdBtn.mousePressed(() => openBoatHoldPanel(boat));
        }
      }
    }

    // Stats
    const statsDiv = select("#invStats");
    if (statsDiv) {
      statsDiv.html("");

      // ── Hero card: name + level + XP ──
      const heroCard = createDiv().class("inv-hero-card").parent(statsDiv);
      if (player.name) {
        createSpan(player.name).class("inv-hero-name").parent(heroCard);
      }
      const heroLvlRow = createDiv().class("inv-hero-level-row").parent(heroCard);
      createSpan(`⭐ Level ${player.level}`).class("inv-level-badge").parent(heroLvlRow);
      if (typeof dayNight !== 'undefined') {
        createSpan(`📅 Day ${dayNight.getDaysElapsed()}, Year ${dayNight.getYear()}`).class("inv-hero-day").parent(heroLvlRow);
      }
      const xpNeeded = player.getXPForNextLevel ? player.getXPForNextLevel() : (player.level * 50);
      const xpPct = Math.min(100, Math.floor((player.xp / xpNeeded) * 100));
      const xpBarOuter = createDiv().class("inv-xp-bar-outer").parent(heroCard);
      createDiv().class("inv-xp-bar-fill").style("width", xpPct + "%").parent(xpBarOuter);
      createDiv().class("inv-xp-label").html(`XP ${player.xp} / ${xpNeeded}`).parent(heroCard);

      // ── Stat point spend buttons (prominent, shown above stat grid) ──
      if (player.statPoints > 0) {
        const spRow = createDiv().class("inv-statpoint-row").parent(statsDiv);
        createP(`✨ ${player.statPoints} Stat Point${player.statPoints > 1 ? 's' : ''} to Spend`)
          .class("inv-sp-label").parent(spRow);
        const btnRow = createDiv().class("inv-sp-btns").parent(spRow);
        const makeBtn = (label, stat) => {
          createButton(label).parent(btnRow).addClass("inv-sp-btn inv-sp-btn-" + stat)
            .mousePressed(() => {
              if (player.spendStatPoint && player.spendStatPoint(stat)) {
                window._invLastFingerprint = null;
                uiManager.screens['inventoryView'].update();
                if (typeof notificationManager !== 'undefined') {
                  const names = { hp: 'Max HP', attack: 'Attack', defense: 'Defense', magic: 'Magic', charm: 'Charm', speed: 'Speed' };
                  notificationManager.log(`💪 ${names[stat]} increased!`, 'info');
                }
              }
            });
        };
        makeBtn('❤️ HP +2', 'hp');
        makeBtn('⚔️ ATK +1', 'attack');
        makeBtn('🛡️ DEF +1', 'defense');
        makeBtn('🔮 MAG +1', 'magic');
        makeBtn('💬 CHA +1', 'charm');
        makeBtn('⚡ SPD +1', 'speed');
      }

      // ── Stat cards grid ──
      createElement("h4", "Combat Stats").class("inv-section-heading").parent(statsDiv);
      const statGrid = createDiv().class("inv-stat-grid").parent(statsDiv);
      const statDefs = [
        { icon: '❤️', label: 'Max HP',  val: player.bonusMaxHP,   cls: 'hp',  desc: '+2 / pt' },
        { icon: '⚔️', label: 'Attack',  val: player.bonusAttack,  cls: 'atk', desc: '+1 / pt' },
        { icon: '🛡️', label: 'Defense', val: player.bonusDefense, cls: 'def', desc: '+1 / pt' },
        { icon: '🔮', label: 'Magic',   val: player.bonusMagic,   cls: 'mag', desc: '+1 / pt' },
        { icon: '💬', label: 'Charm',   val: player.bonusCharm,   cls: 'cha', desc: '+2% price' },
        { icon: '⚡', label: 'Speed',   val: player.bonusSpeed,   cls: 'spd', desc: '+1 initiative' },
      ];
      for (const s of statDefs) {
        const card = createDiv().class(`inv-stat-card inv-stat-card-${s.cls}`).parent(statGrid);
        createSpan(s.icon).class("inv-stat-card-icon").parent(card);
        createSpan(s.label).class("inv-stat-card-label").parent(card);
        createSpan(`+${s.val}`).class("inv-stat-card-val").parent(card);
        createSpan(s.desc).class("inv-stat-card-desc").parent(card);
      }

      // ── Info strip ──
      createElement("h4", "Character Info").class("inv-section-heading").parent(statsDiv);
      const infoStrip = createDiv().class("inv-info-strip").parent(statsDiv);
      const infoCells = [
        { label: 'Combat', val: player.combatStrength },
        { label: 'Cargo',  val: player.getEffectiveCargoCapacity ? player.getEffectiveCargoCapacity() : player.cargoCapacity },
        { label: 'Tax',    val: `${(player.taxRate * 100).toFixed(0)}%` },
      ];
      if (player.isSailing && player.activeBoat) {
        const b = player.activeBoat;
        infoCells.push({ label: b.name, val: `Hull ${b.condition}%` });
      }
      for (const c of infoCells) {
        const cell = createDiv().class("inv-info-cell").parent(infoStrip);
        createSpan(c.label).class("inv-info-cell-label").parent(cell);
        createSpan(String(c.val)).class("inv-info-cell-val").parent(cell);
      }

      // ── Active bonuses (book modifiers + charm) ──
      const mods = player.modifiers || {};
      const activeMods = [];
      if (mods.negotiationDiscount > 0)
        activeMods.push({ icon: '📘', text: 'Negotiation', val: `−${(mods.negotiationDiscount * 100).toFixed(0)}% buy price` });
      if (mods.bribeCostReduction > 0)
        activeMods.push({ icon: '📙', text: 'Conflict Res.', val: `−${(mods.bribeCostReduction * 100).toFixed(0)}% bribes` });
      if (mods.bribeCooldownBonus > 0)
        activeMods.push({ icon: '📙', text: 'Bribe Cooldown', val: `+${mods.bribeCooldownBonus} days` });
      if (mods.treasureValueBonus > 0)
        activeMods.push({ icon: '📗', text: 'Treasure Hunter', val: `+${(mods.treasureValueBonus * 100).toFixed(0)}% dig value` });
      if (mods.seaLegs)
        activeMods.push({ icon: '🌊', text: 'Sea Legs', val: 'Land anywhere' });
      const charmPct = (player.bonusCharm || 0) * 1.5;
      if (charmPct > 0)
        activeMods.push({ icon: '💬', text: 'Charm Bonus', val: `+${charmPct}% prices` });
      if (activeMods.length > 0) {
        createElement("h4", "Active Bonuses").class("inv-section-heading").parent(statsDiv);
        const modList = createDiv().class("inv-mod-list").parent(statsDiv);
        for (const m of activeMods) {
          const row = createDiv().class("inv-mod-row").parent(modList);
          createSpan(m.icon).class("inv-mod-icon").parent(row);
          createSpan(m.text).class("inv-mod-text").parent(row);
          createSpan(m.val).class("inv-mod-val").parent(row);
        }
      }
    }
  }
});


// ============================
// BOAT HOLD TRANSFER PANEL
// ============================
function openBoatHoldPanel(boat) {
  if (typeof tutorialSystem !== 'undefined' && tutorialSystem) {
    tutorialSystem.tryShow('boatHold');
  }
  document.getElementById('boatHoldOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'boatHoldOverlay';
  Object.assign(overlay.style, {
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
    background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 10500,
  });
  document.body.appendChild(overlay);

  const popup = document.createElement('div');
  Object.assign(popup.style, {
    background: '#0d1520', border: '2px solid #3a6a8a', borderRadius: '12px',
    padding: '20px', width: '760px', maxWidth: '95vw', maxHeight: '82vh',
    display: 'flex', flexDirection: 'column', color: '#fff', fontFamily: 'monospace',
  });
  overlay.appendChild(popup);

  // ── Header ──
  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' });
  popup.appendChild(header);

  const titleEl = document.createElement('h2');
  titleEl.style.margin = '0';
  titleEl.style.color = '#7ec8e3';
  const boatIcon = BoatLibrary[boat.type]?.icon || '🚢';
  titleEl.textContent = `${boatIcon} ${boat.name} — Hold`;
  header.appendChild(titleEl);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  Object.assign(closeBtn.style, {
    background: 'none', border: 'none', color: '#aaa', fontSize: '20px', cursor: 'pointer',
  });
  closeBtn.onclick = () => overlay.remove();
  header.appendChild(closeBtn);

  // ── Capacity bar ──
  const capRow = document.createElement('div');
  Object.assign(capRow.style, { marginBottom: '14px', fontSize: '12px', color: '#888' });
  popup.appendChild(capRow);

  function renderCapBar() {
    const hw = boat.getStorageWeight ? boat.getStorageWeight() : 0;
    const hc = boat.getStorageCapacity ? boat.getStorageCapacity() : 0;
    const pct = hc > 0 ? Math.min(100, (hw / hc) * 100) : 0;
    const col = pct >= 100 ? '#f44336' : pct >= 80 ? '#ff9800' : '#4caf50';
    capRow.innerHTML =
      `<span style="color:${col}">Hold: ${hw} / ${hc} weight used</span>` +
      `<div style="background:#222;border-radius:4px;height:6px;margin-top:4px;overflow:hidden">` +
      `<div style="width:${pct}%;height:100%;background:${col};transition:width .2s"></div></div>`;
  }
  renderCapBar();

  // ── Hint ──
  const hint = document.createElement('p');
  hint.textContent = 'Click → / ← to transfer 1 unit · Shift+click = 5 · Ctrl/Cmd+click = max';
  Object.assign(hint.style, { fontSize: '11px', color: '#556', margin: '0 0 12px' });
  popup.appendChild(hint);

  // ── Two-column body ──
  const body = document.createElement('div');
  Object.assign(body.style, { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', overflowY: 'auto', flex: '1' });
  popup.appendChild(body);

  const playerCol = document.createElement('div');
  const boatCol   = document.createElement('div');
  body.appendChild(playerCol);
  body.appendChild(boatCol);

  function colHeader(el, text) {
    const h = document.createElement('h3');
    h.textContent = text;
    Object.assign(h.style, { color: '#aaa', margin: '0 0 8px', fontSize: '13px', borderBottom: '1px solid #333', paddingBottom: '6px' });
    el.appendChild(h);
  }

  function makeItemRow(parentEl, itemKey, qty, itemObj, arrowLabel, arrowTitle, onTransfer) {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '5px 6px', borderRadius: '5px', marginBottom: '4px', background: '#141e2a',
    });
    parentEl.appendChild(row);

    const info = document.createElement('span');
    const icon = (typeof ITEM_ICONS !== 'undefined' && ITEM_ICONS[itemKey]?.emoji) || '📦';
    const wt = itemObj?.weight || 1;
    info.innerHTML = `${icon} <strong>${itemKey.replace(/([A-Z])/g,' $1').trim()}</strong> ×${qty} <span style="color:#556;font-size:10px">(${wt * qty}w)</span>`;
    info.style.fontSize = '12px';
    row.appendChild(info);

    const btn = document.createElement('button');
    btn.textContent = arrowLabel;
    btn.title = arrowTitle;
    Object.assign(btn.style, {
      background: '#1c3a50', color: '#7ec8e3', border: '1px solid #3a6a8a',
      borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '12px',
    });
    btn.onclick = (e) => {
      const amount = e.ctrlKey || e.metaKey ? qty : e.shiftKey ? Math.min(5, qty) : 1;
      onTransfer(itemKey, amount, itemObj);
    };
    row.appendChild(btn);
  }

  function rebuildColumns() {
    playerCol.innerHTML = '';
    boatCol.innerHTML = '';

    const pw = player.getCargoWeight ? player.getCargoWeight() : 0;
    const pc = player.getEffectiveCargoCapacity ? player.getEffectiveCargoCapacity() : (player.cargoCapacity || 50);
    colHeader(playerCol, `🎒 Player Inventory (${pw}/${pc}w)`);
    colHeader(boatCol,   `⚓ Boat Hold (${boat.getStorageWeight ? boat.getStorageWeight() : 0}/${boat.getStorageCapacity ? boat.getStorageCapacity() : 0}w)`);

    // Player items → arrow to boat
    if (player.inventory.size === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No items';
      empty.style.color = '#555';
      playerCol.appendChild(empty);
    }
    for (const [key, entry] of player.inventory) {
      makeItemRow(
        playerCol, key, entry.quantity, entry.item, '→', 'Transfer to boat hold (Shift=5, Ctrl=max)',
        (k, amount) => {
          const libItem = typeof ItemLibrary !== 'undefined' ? ItemLibrary[k] : entry.item;
          const w = (libItem?.weight || 1) * amount;
          if (!boat.getAvailableStorageSpace || w > boat.getAvailableStorageSpace()) {
            if (typeof notificationManager !== 'undefined') notificationManager.log('Boat hold full!', 'warning');
            return;
          }
          if (player.removeItemQuantity(k, amount)) {
            boat.addItemToStorage(k, amount, false);
            if (typeof SaveSystem !== 'undefined') SaveSystem.save();
            renderCapBar();
            rebuildColumns();
          }
        }
      );
    }

    // Boat hold items ← arrow to player
    if (boat.storage.size === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'Hold is empty';
      empty.style.color = '#555';
      boatCol.appendChild(empty);
    }
    for (const [key, entry] of boat.storage) {
      makeItemRow(
        boatCol, key, entry.quantity, entry.item, '←', 'Transfer to player inventory (Shift=5, Ctrl=max)',
        (k, amount) => {
          const libItem = (typeof ItemLibrary !== 'undefined' ? ItemLibrary[k] : null) || entry.item;
          const w = (libItem?.weight || 1) * amount;
          const playerCap = player.getEffectiveCargoCapacity ? player.getEffectiveCargoCapacity() : (player.cargoCapacity || 50);
          const playerUsed = player.getCargoWeight ? player.getCargoWeight() : 0;
          if (playerUsed + w > playerCap) {
            if (typeof notificationManager !== 'undefined') notificationManager.log('Player cargo full!', 'warning');
            return;
          }
          if (boat.removeItemFromStorage(k, amount)) {
            player.addItem({ name: k, quantity: amount }, true);
            if (typeof SaveSystem !== 'undefined') SaveSystem.save();
            renderCapBar();
            rebuildColumns();
          }
        }
      );
    }
  }

  rebuildColumns();

  // Close on backdrop click
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// ============================
// MINIMAP CONTROLS (zoom +/-, mode toggle)
// ============================
uiManager.registerScreen("minimapControls", {
  validStates: [GameStates.PLAYING, GameStates.INVENTORY],

  create: () => {
    // Invisible wrapper — we just need UIManager to manage visibility
    const wrapper = createDiv().id("minimapControls").style("display", "none");

    const btnStyle = (btn) => {
      btn.style('background', '#333');
      btn.style('color', '#fff');
      btn.style('border', '1px solid #555');
      btn.style('border-radius', '4px');
      btn.style('cursor', 'pointer');
      btn.style('position', 'fixed');
      btn.style('z-index', '1100');
      btn.size(24, 24);
      btn.parent(wrapper);
      return btn;
    };

    const zoomOut = btnStyle(createButton('−'));
    zoomOut.id('mmZoomOut');
    zoomOut.style('font-size', '16px');
    zoomOut.style('font-weight', 'bold');
    zoomOut.mousePressed(() => {
      if (typeof camZoom !== 'undefined') {
        camZoom = constrain(camZoom - 0.1, 0.15, 2);
        if (Math.abs(camZoom - 1) < 0.06) camZoom = 1;
      }
    });

    const zoomIn = btnStyle(createButton('+'));
    zoomIn.id('mmZoomIn');
    zoomIn.style('font-size', '16px');
    zoomIn.style('font-weight', 'bold');
    zoomIn.mousePressed(() => {
      if (typeof camZoom !== 'undefined') {
        camZoom = constrain(camZoom + 0.1, 0.15, 2);
        if (Math.abs(camZoom - 1) < 0.06) camZoom = 1;
      }
    });

    const modeBtn = btnStyle(createButton('🔄'));
    modeBtn.id('mmMode');
    modeBtn.style('font-size', '14px');
    modeBtn.mousePressed(() => {
      if (typeof _getMinimapMode === 'function') {
        const cur = _getMinimapMode();
        _minimapMode = (cur === 'regional') ? 'world' : 'regional';
      }
    });

    return wrapper;
  },

  show: () => {
    const w = select("#minimapControls");
    if (w) w.show();
  },

  hide: () => {
    const w = select("#minimapControls");
    if (w) w.hide();
  },

  update: () => {
    // Reposition buttons each frame to stay aligned with minimap
    const mmSize = 200;
    const mmX = (typeof width !== 'undefined' ? width : window.innerWidth) - mmSize - 10;
    const mmY = 10;
    const btnRow = mmY + mmSize + 4;

    const modeBtn = select("#mmMode");
    const zoomOut = select("#mmZoomOut");
    const zoomIn = select("#mmZoomIn");

    if (modeBtn) {
      modeBtn.position(mmX, btnRow);
      if (typeof _getMinimapMode === 'function') {
        const mode = _getMinimapMode();
        modeBtn.html(mode === 'regional' ? '🌍' : '🔍');
        modeBtn.attribute('title', mode === 'regional' ? 'Switch to World view' : 'Switch to Region view');
      }
    }
    if (zoomOut) zoomOut.position(mmX + mmSize - 52, btnRow);
    if (zoomIn) zoomIn.position(mmX + mmSize - 26, btnRow);
  }
});


// ============================
// COMBAT VIEW
// ============================

/* ---- combat helpers (module-scoped) ---- */
let _patternState = null;

function _restoreCombatButtons() {
  const fightBtn = select(".fight-btn");
  if (fightBtn) {
    fightBtn.html("⚔️ Fight");
    fightBtn.style("animation", "none");
  }
  const fleeBtn = select(".flee-btn");
  if (fleeBtn) { fleeBtn.style("opacity", "1"); fleeBtn.style("pointer-events", "auto"); }
  const bribeBtn = select(".bribe-btn");
  if (bribeBtn) { bribeBtn.style("pointer-events", "auto"); }
  // Re-check monster bribe status
  if (typeof combatSystem !== 'undefined') {
    const rType = RAIDER_TYPES[combatSystem.raiderType] || RAIDER_TYPES['bandit'];
    if (bribeBtn) bribeBtn.style("opacity", rType.monster ? "0.4" : "1");
  }
}

function _refreshCombatBars() {
  if (typeof combatSystem === 'undefined' || !combatSystem.active) return;
  const pBar = document.getElementById('playerHpBar');
  const eBar = document.getElementById('enemyHpBar');
  const pLabel = document.getElementById('playerHpLabel');
  const eLabel = document.getElementById('enemyHpLabel');
  if (!pBar) return;

  const pMax = (player && player.getMaxHP) ? player.getMaxHP() : (combatSystem._initPlayerHP || combatSystem.playerHP);
  const eMax = combatSystem._initRaiderHP || combatSystem.raiderHP;
  const pPct = Math.max(0, combatSystem.playerHP / pMax * 100);
  const ePct = Math.max(0, combatSystem.raiderHP / eMax * 100);

  pBar.style.width = pPct + '%';
  pBar.style.background = pPct > 50 ? '#4CAF50' : pPct > 25 ? '#ff9800' : '#f44336';
  eBar.style.width = ePct + '%';
  eBar.style.background = ePct > 50 ? '#f44336' : ePct > 25 ? '#ff9800' : '#4CAF50';

  if (pLabel) pLabel.textContent = `${Math.max(0, combatSystem.playerHP)}/${pMax} HP`;
  if (eLabel) eLabel.textContent = `${Math.max(0, combatSystem.raiderHP)} HP`;

  // Status effects
  const pStatus = document.getElementById('playerStatusEffects');
  if (pStatus && combatSystem.getPlayerStatusSummary) {
    const effects = combatSystem.getPlayerStatusSummary();
    pStatus.innerHTML = effects.length > 0 ? effects.map(e => `<span class="status-badge status-${e.type}" title="${e.type} (${e.turns}t)">${_statusIcon(e.type)}${e.turns}</span>`).join('') : '';
  }
  const eStatus = document.getElementById('enemyStatusEffects');
  if (eStatus && combatSystem.getRaiderStatusSummary) {
    const effects = combatSystem.getRaiderStatusSummary();
    eStatus.innerHTML = effects.length > 0 ? effects.map(e => `<span class="status-badge status-${e.type}" title="${e.type} (${e.turns}t)">${_statusIcon(e.type)}${e.turns}</span>`).join('') : '';
  }
}

function _statusIcon(type) {
  const icons = { poison: '🧪', bleed: '🩸', stun: '⚡', daze: '💫' };
  return icons[type] || '❓';
}

function _showDmgSplash(barId, delta) {
  const bar = document.getElementById(barId);
  if (!bar || !bar.parentElement) return;
  const splash = document.createElement('span');
  splash.className = 'dmg-splash';
  splash.textContent = delta > 0 ? `-${delta}` : `${delta}`;
  splash.style.color = delta > 0 ? '#f44336' : '#4CAF50';
  bar.parentElement.appendChild(splash);
  splash.addEventListener('animationend', () => splash.remove());
}

// ────────── Naval combat UI helpers ──────────

function _initNavalUI() {
  const navalArea = document.getElementById('navalArea');
  if (!navalArea) return;
  navalArea.style.display = 'block';

  // Reset log tracking index to current log length (initial messages already rendered by show())
  _navalLogIndex = combatSystem ? combatSystem.log.length : 0;

  const hint = document.getElementById('navalHint');
  if (hint) hint.textContent = 'WASD to dodge \u00b7 Click enemy grid to fire!';

  // Initialize behavior label
  const behEl = document.getElementById('enemyBehaviorLabel');
  if (behEl && combatSystem) {
    const labels = { aggressive: '🔴 Aggressive', evasive: '🔵 Evasive', flanker: '🟡 Flanking' };
    behEl.textContent = labels[combatSystem.enemyBehavior] || '';
  }

  // Subscribe to CombatSystem events
  combatSystem.on('phaseStart', _onNavalPhaseStart);
  combatSystem.on('gridUpdated', () => { _renderNavalGrids(); _appendNavalLog(); });
  combatSystem.on('hpChanged', () => {
    _refreshCombatBars(); _appendNavalLog();
    const navalArea = document.getElementById('navalArea');
    if (navalArea) { navalArea.classList.remove('hud-shake'); void navalArea.offsetWidth; navalArea.classList.add('hud-shake'); }
  });
  combatSystem.on('combatEnd', _navalCombatEnd);
  combatSystem.on('behaviorChanged', ({ behavior }) => {
    const el = document.getElementById('enemyBehaviorLabel');
    if (el) {
      const labels = { aggressive: '🔴 Aggressive', evasive: '🔵 Evasive', flanker: '🟡 Flanking' };
      el.textContent = labels[behavior] || '';
    }
  });

  _renderNavalGrids();
  _refreshCombatBars();

  // Start the phase engine now that subscriptions are in place
  combatSystem._startNavalPhaseEngine();

  // WASD / arrow-key movement handler
  window._navalKeyHandler = (e) => {
    if (!combatSystem || !combatSystem.isNavalCombat || combatSystem.result) return;
    if (combatSystem.navalPhase !== 'player_aim') return;
    const keyMap = { w: 'up', W: 'up', a: 'left', A: 'left', s: 'down', S: 'down', d: 'right', D: 'right',
                     ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const dir = keyMap[e.key];
    if (dir) {
      e.preventDefault();
      combatSystem.movePlayerShip(dir);
    }
  };
  window.addEventListener('keydown', window._navalKeyHandler);
}

function _onNavalPhaseStart({ phase }) {
  // Phase indicator label
  const label = document.getElementById('navalPhaseLabel');
  if (label) {
    const configs = {
      player_aim: { text: '⚓ Your Turn — Fire or Move!', color: '#4caf50' },
      telegraph:  { text: '⚠️ Enemy Targeting…',          color: '#ff9800' },
      enemy_fire: { text: '💣 Incoming!',                  color: '#f44336' },
    };
    const cfg = configs[phase] || {};
    label.textContent = cfg.text || '';
    label.style.color = cfg.color || '#aaa';
  }

  // Countdown bar rAF (cancel previous, start new)
  cancelAnimationFrame(window._navalAnimFrame);
  const phaseDuration = phase === 'telegraph' ? NAVAL_TELEGRAPH_MS : (NAVAL_TICK_MS - NAVAL_TELEGRAPH_MS);
  const start = performance.now();
  const animateBar = () => {
    const pct = Math.max(0, 1 - (performance.now() - start) / phaseDuration);
    const bar = document.getElementById('navalTimerBar');
    if (bar) {
      bar.style.width = (pct * 100) + '%';
      bar.style.background = phase === 'telegraph'
        ? 'linear-gradient(90deg,#ff0000,#ff4444)'
        : 'linear-gradient(90deg,#f44336,#ff9800)';
    }
    if (pct > 0 && combatSystem && !combatSystem.result) {
      window._navalAnimFrame = requestAnimationFrame(animateBar);
    }
  };
  window._navalAnimFrame = requestAnimationFrame(animateBar);

  // Input gating: disable enemy grid clicks during non-player phases
  const eGrid = document.getElementById('enemyNavalGrid');
  if (eGrid) eGrid.style.pointerEvents = phase === 'player_aim' ? 'auto' : 'none';

  _refreshAbilityButtons();
}

function _refreshAbilityButtons() {
  if (!combatSystem) return;
  const cd = combatSystem._abilityCooldowns;
  const isPlayerTurn = combatSystem.navalPhase === 'player_aim';
  const defs = [
    { id: 'abilityChainShot',   key: 'chainShot',   label: '⛓️ Chain Shot'   },
    { id: 'abilitySmokeScreen', key: 'smokeScreen', label: '💨 Smoke Screen'  },
    { id: 'abilityRepair',      key: 'repair',      label: '🔧 Repair'        },
  ];
  for (const d of defs) {
    const btn = document.getElementById(d.id);
    if (!btn) continue;
    const remaining = cd[d.key] || 0;
    btn.disabled = remaining > 0 || !isPlayerTurn;
    btn.textContent = remaining > 0 ? `${d.label} (${remaining})` : d.label;
    btn.classList.toggle('cooldown', remaining > 0);
  }
}

function _renderNavalGrids() {
  const cs = combatSystem;
  if (!cs || !cs.isNavalCombat) return;

  // Hull condition status
  const hullEl = document.getElementById('navalHullStatus');
  if (hullEl && player.activeBoat) {
    const b = player.activeBoat;
    hullEl.textContent = `Hull: ${b.condition}% (${b.conditionLabel()})`;
    hullEl.style.color = b.conditionColor();
  }

  // Player grid — player sees own ship, enemy shots, and telegraph warnings
  const pGrid = document.getElementById('playerNavalGrid');
  if (pGrid) {
    pGrid.style.gridTemplateColumns = `repeat(${NAVAL_GRID_SIZE}, 1fr)`;
    pGrid.innerHTML = '';
    const shipCells = cs.getPlayerShipCells();
    for (let r = 0; r < NAVAL_GRID_SIZE; r++) {
      for (let c = 0; c < NAVAL_GRID_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'naval-cell';
        const isShip = shipCells.some(s => s.r === r && s.c === c);
        const state = cs.playerGrid[r][c];
        const isTelegraph = cs.enemyTargetCell && cs.enemyTargetCell.r === r && cs.enemyTargetCell.c === c;

        const envCell = cs.environmentCells?.find(e => e.r === r && e.c === c);
        if (state === 'hit' && isShip) {
          cell.classList.add('naval-cell-ship-hit');
          cell.textContent = '🚢💥';
        } else if (state === 'hit') {
          cell.classList.add('naval-cell-hit');
          cell.textContent = '💥';
        } else if (state === 'miss') {
          cell.classList.add('naval-cell-miss');
          cell.textContent = '🌊';
        } else if (isTelegraph && isShip) {
          cell.classList.add('naval-cell-danger');
          cell.textContent = '🚢';
        } else if (isTelegraph) {
          cell.classList.add('naval-cell-target');
          cell.textContent = '🎯';
        } else if (isShip) {
          cell.classList.add('naval-cell-ship');
          cell.textContent = '🚢';
        } else if (envCell) {
          if (envCell.type === 'island') {
            cell.classList.add('naval-cell-island');
            cell.textContent = '⛰️';
          } else if (envCell.type === 'storm') {
            cell.classList.add('naval-cell-storm');
            cell.textContent = '⛈️';
          }
        } else {
          cell.classList.add('naval-cell-water');
          cell.textContent = '~';
        }
        pGrid.appendChild(cell);
      }
    }
  }

  // Enemy grid — fog of war, player clicks to fire
  const eGrid = document.getElementById('enemyNavalGrid');
  if (eGrid) {
    eGrid.style.gridTemplateColumns = `repeat(${NAVAL_GRID_SIZE}, 1fr)`;
    eGrid.innerHTML = '';
    for (let r = 0; r < NAVAL_GRID_SIZE; r++) {
      for (let c = 0; c < NAVAL_GRID_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'naval-cell';
        const state = cs.enemyGrid[r][c];

        if (state === 'hit') {
          cell.classList.add('naval-cell-hit');
          cell.textContent = '💥';
        } else if (state === 'miss') {
          cell.classList.add('naval-cell-miss');
          cell.textContent = '🌊';
        } else {
          cell.classList.add('naval-cell-fog');
          cell.textContent = '?';
          const row = r, col = c;
          cell.addEventListener('click', () => _navalCellClicked(row, col));
        }
        eGrid.appendChild(cell);
      }
    }
  }
}

let _navalLogIndex = 0;

function _appendNavalLog() {
  const log = select("#combatLog");
  if (!log || !combatSystem || !combatSystem.log.length) return;

  // Show all new messages since last render
  while (_navalLogIndex < combatSystem.log.length) {
    const msg = combatSystem.log[_navalLogIndex];
    const isGood = msg.includes('hit!') || msg.includes('Victory') || msg.includes('Direct') || msg.includes('Looted') || msg.includes('Found');
    const isBad = msg.includes('Enemy hits') || msg.includes('sinking') || msg.includes('Lost') || msg.includes('stole');
    const color = isGood ? '#4CAF50' : isBad ? '#f44336' : '#ff9800';

    const entry = createP(msg).style("margin", "4px 0").style("color", color);
    entry.parent(log);
    _navalLogIndex++;
  }
  log.elt.scrollTop = log.elt.scrollHeight;
}

function _navalCellClicked(row, col) {
  if (!combatSystem || !combatSystem.isNavalCombat || combatSystem.result) return;
  if (combatSystem.navalPhase !== 'player_aim') return;

  const result = combatSystem.playerNavalFire(row, col);
  if (result.alreadyFired) return;

  if (result.hit) _showDmgSplash('enemyHpBar', (BoatLibrary[combatSystem.playerBoatType] || BoatLibrary.rowboat).attack);
  // Events (gridUpdated, hpChanged, combatEnd) drive the UI refresh
}

// _startNavalTimer removed — phase engine is now owned by CombatSystem._startNavalPhaseEngine()

function _stopNavalTimer() {
  // CombatSystem._stopNavalPhaseEngine() handles timeouts; we just cancel rAF + key handler
  cancelAnimationFrame(window._navalAnimFrame);
  window._navalAnimFrame = null;
  if (window._navalKeyHandler) {
    window.removeEventListener('keydown', window._navalKeyHandler);
    window._navalKeyHandler = null;
  }
}

/** Shared end-of-naval-combat UI teardown — also called via combatEnd event */
function _navalCombatEnd() {
  // Unsubscribe all naval events
  if (combatSystem) {
    combatSystem.off('phaseStart', _onNavalPhaseStart);
    // gridUpdated, hpChanged, combatEnd, behaviorChanged were registered as anonymous closures;
    // clearing _handlers in endCombat() handles full cleanup.
  }
  cancelAnimationFrame(window._navalAnimFrame);
  window._navalAnimFrame = null;
  _stopNavalTimer();
  _refreshCombatBars();
  _renderNavalGrids();
  _appendNavalLog();   // flush all remaining log messages (loot, defeat text, etc.)
  select("#combatContinueBtn")?.style("display", "block");
  const hint = document.getElementById('navalHint');
  if (hint) hint.textContent = combatSystem?.result === 'win' ? '🏆 Victory!' : '💀 Defeat!';
  // Disable ability buttons
  ['abilityChainShot','abilitySmokeScreen','abilityRepair'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = true;
  });
}

// ────────── End naval UI helpers ──────────

function _showBribeConfirm() {
  if (typeof combatSystem === 'undefined') return;
  const area = document.getElementById('bribeConfirmArea');
  if (!area) return;

  const rType = RAIDER_TYPES[combatSystem.raiderType] || RAIDER_TYPES['bandit'];
  if (rType.monster) {
    // Monsters can't be bribed — execute the penalty attack directly
    const result = combatSystem.playerAction('bribe', true);
    _refreshCombatBars();
    updateCombatLog(result);
    return;
  }

  const cost = combatSystem.getBribeCost();
  const canAfford = player.gold >= cost;
  const txt = area.querySelector('.bribe-confirm-text');
  if (txt) {
    txt.innerHTML = `The ${rType.name} wants <b style="color:var(--accent)">${cost} gold</b> for safe passage.<br>`
      + `You have <b>${player.gold}</b> gold.`
      + (!canAfford ? '<br><span style="color:#f44336">Not enough gold — they will attack!</span>' : '');
  }

  // Show area, hide actions
  area.style.display = 'block';
  const actions = document.getElementById('combatActions');
  if (actions) actions.style.display = 'none';
}

function _startPatternMiniGame() {
  if (typeof combatSystem === 'undefined') return;
  // Double-click guard
  if (_patternState && !_patternState.done) return;

  const pattern = combatSystem.generatePattern();
  const actions = document.getElementById('combatActions');
  if (actions) actions.style.display = 'none';

  // Show "Get Ready!" countdown before the QTE starts
  _showQTECountdown(pattern.theme ? `${pattern.theme.emoji} Get Ready!` : '⚔️ Get Ready!', () => {
    switch (pattern.qteType) {
      case 'powerMeter':  _startAxeQTE(pattern); break;
      case 'clickTarget': _startCrossbowQTE(pattern); break;
      case 'spellTiming': _startStaffQTE(pattern); break;
      default:            _startArrowQTE(pattern); break;
    }
  });
}

// ====== Shared QTE helpers ======

function _qteTimerBar(state, barId) {
  const timerBar = document.getElementById(barId || 'patternTimerBar');
  function tick() {
    if (state.done) return;
    const elapsed = performance.now() - state.startTime;
    const pct = Math.max(0, 1 - elapsed / state.totalTime);
    if (timerBar) timerBar.style.width = (pct * 100) + '%';
    if (elapsed >= state.totalTime) {
      if (!state.done && state.onTimeout) state.onTimeout();
      return;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/** Show a "Get Ready!" countdown before a QTE starts */
function _showQTECountdown(text, callback) {
  const patternArea = document.getElementById('patternArea');
  if (!patternArea) { callback(); return; }

  patternArea.innerHTML = `<div class="qte-countdown"><span class="qte-countdown-text">${text}</span><span class="qte-countdown-number" id="qteCountNum">3</span></div>`;
  patternArea.style.display = 'block';

  const numEl = document.getElementById('qteCountNum');
  let count = 3;
  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      if (numEl) { numEl.textContent = count; numEl.classList.remove('qte-countdown-pop'); void numEl.offsetWidth; numEl.classList.add('qte-countdown-pop'); }
    } else {
      clearInterval(interval);
      if (numEl) { numEl.textContent = 'GO!'; numEl.style.color = '#4CAF50'; numEl.classList.remove('qte-countdown-pop'); void numEl.offsetWidth; numEl.classList.add('qte-countdown-pop'); }
      setTimeout(callback, 300);
    }
  }, 400);
}

// ====== Arrow QTE — Pattern matching (Fists, Dagger, Sword) ======

function _startArrowQTE(pattern) {
  const patternArea = document.getElementById('patternArea');
  if (!patternArea) return;

  const arrowSymbols = { left: '←', up: '↑', down: '↓', right: '→' };
  const keyCodes = { 37: 'left', 38: 'up', 40: 'down', 39: 'right' };

  const theme = pattern.theme || { emoji: '👊', label: 'Match the pattern!', arrowClass: 'ws-arrow-fists' };
  let html = `<p class="pattern-info">${theme.emoji} ${theme.label}</p>`;
  html += `<div class="pattern-timer-wrap"><div class="pattern-timer-bar" id="patternTimerBar"></div></div>`;
  html += `<div class="pattern-arrows-row">`;
  pattern.arrows.forEach((dir, i) => {
    html += `<div class="pattern-arrow ${theme.arrowClass}" id="patArrow${i}">${arrowSymbols[dir]}</div>`;
  });
  html += `</div>`;
  html += `<p class="pattern-feedback" id="patternFeedback"></p>`;
  patternArea.innerHTML = html;
  patternArea.style.display = 'block';

  const state = {
    arrows: pattern.arrows, total: pattern.arrows.length,
    totalTime: pattern.totalTime, current: 0, hits: 0,
    done: false, startTime: performance.now(),
  };
  state.onTimeout = () => {
    state.timedOut = true;
    for (let i = state.current; i < state.total; i++) {
      const el = document.getElementById(`patArrow${i}`);
      if (el) el.classList.add('arrow-miss');
    }
    state.current = state.total;
    _finishAttackPhase();
  };
  _patternState = state;

  const firstArrow = document.getElementById('patArrow0');
  if (firstArrow) firstArrow.classList.add('active');
  window._combatPatternActive = true;
  _qteTimerBar(state);

  window._handlePatternKey = (kc) => {
    if (state.done || state.current >= state.total) return;
    const dir = keyCodes[kc];
    if (!dir) return;
    const expected = state.arrows[state.current];
    const el = document.getElementById(`patArrow${state.current}`);
    if (dir === expected) {
      state.hits++;
      if (el) { el.classList.remove('active'); el.classList.add('arrow-correct'); }
    } else {
      if (el) { el.classList.remove('active'); el.classList.add('arrow-wrong'); }
    }
    state.current++;
    if (state.current < state.total) {
      const next = document.getElementById(`patArrow${state.current}`);
      if (next) next.classList.add('active');
    } else {
      _finishAttackPhase();
    }
  };
}

// ====== (Dagger and Sword QTEs removed — they now use unified Arrow QTE) ======

// ====== Axe QTE — Power Meter (press Space in sweet spot) ======

function _startAxeQTE(pattern) {
  const patternArea = document.getElementById('patternArea');
  if (!patternArea) return;

  let html = `<p class="pattern-info">🪓 Press SPACE in the gold zone!</p>`;
  html += `<div class="pattern-timer-wrap"><div class="pattern-timer-bar" id="patternTimerBar"></div></div>`;
  html += `<div class="qte-axe-meter">`;
  html += `  <div class="qte-axe-track" id="axeTrack">`;
  html += `    <div class="qte-axe-sweetspot" id="axeSweetSpot"></div>`;
  html += `    <div class="qte-axe-indicator" id="axeIndicator"></div>`;
  html += `  </div>`;
  html += `</div>`;
  html += `<p class="qte-axe-swing" id="axeSwing">Swing 1 / ${pattern.swings}</p>`;
  html += `<p class="pattern-feedback" id="patternFeedback"></p>`;
  patternArea.innerHTML = html;
  patternArea.style.display = 'block';

  // Position sweet spot
  const spotSize = pattern.sweetSpotSize * 100;
  let spotCenter = 35 + Math.random() * 30;
  const sweetSpot = document.getElementById('axeSweetSpot');
  if (sweetSpot) {
    sweetSpot.style.left = (spotCenter - spotSize / 2) + '%';
    sweetSpot.style.width = spotSize + '%';
  }

  const state = {
    total: pattern.swings, totalTime: pattern.totalTime,
    currentSwing: 0, accuracySum: 0,
    done: false, startTime: performance.now(),
    indicatorPos: 0, direction: 1, speed: 2.0,
    sweetCenter: spotCenter / 100, sweetSize: pattern.sweetSpotSize,
    animating: true,
  };

  const indicator = document.getElementById('axeIndicator');
  function animateIndicator() {
    if (state.done || !state.animating) return;
    state.indicatorPos += state.direction * state.speed;
    if (state.indicatorPos >= 100) { state.indicatorPos = 100; state.direction = -1; }
    if (state.indicatorPos <= 0) { state.indicatorPos = 0; state.direction = 1; }
    if (indicator) indicator.style.left = state.indicatorPos + '%';
    requestAnimationFrame(animateIndicator);
  }

  state.onTimeout = () => {
    state.timedOut = true;
    state.animating = false;
    state.currentSwing = state.total;
    state.computedAccuracy = state.total > 0 ? state.accuracySum / state.total : 0;
    _finishAttackPhase();
  };
  _patternState = state;
  window._combatPatternActive = true;
  _qteTimerBar(state);
  requestAnimationFrame(animateIndicator);

  window._handlePatternKey = (kc) => {
    if (state.done || state.currentSwing >= state.total) return;
    if (kc !== 32) return; // Space only

    const pos = state.indicatorPos / 100;
    const dist = Math.abs(pos - state.sweetCenter);
    const halfSweet = state.sweetSize / 2;
    let swingAcc;
    if (dist <= halfSweet) {
      swingAcc = 1.0 - (dist / halfSweet) * 0.3; // In sweet spot: 0.7–1.0
    } else {
      swingAcc = Math.max(0, 0.5 - (dist - halfSweet) * 1.5); // Outside: 0–0.5
    }
    state.accuracySum += swingAcc;
    state.currentSwing++;

    // Visual feedback
    const track = document.getElementById('axeTrack');
    if (swingAcc >= 0.7) {
      if (track) { track.classList.add('qte-axe-hit'); setTimeout(() => track.classList.remove('qte-axe-hit'), 300); }
    } else {
      if (track) { track.classList.add('qte-axe-miss'); setTimeout(() => track.classList.remove('qte-axe-miss'), 300); }
    }

    const swingLabel = document.getElementById('axeSwing');
    if (state.currentSwing >= state.total) {
      state.animating = false;
      state.computedAccuracy = state.accuracySum / state.total;
      _finishAttackPhase();
    } else {
      if (swingLabel) swingLabel.textContent = `Swing ${state.currentSwing + 1} / ${state.total}`;
      // Randomize sweet spot for next swing
      spotCenter = 25 + Math.random() * 50;
      if (sweetSpot) {
        sweetSpot.style.left = (spotCenter - spotSize / 2) + '%';
      }
      state.sweetCenter = spotCenter / 100;
      state.speed += 0.3; // Gets faster each swing
    }
  };
}

// ====== Bow QTE — Aim Shot (vertical bouncing reticle) ======

function _startBowQTE(pattern) {
  const patternArea = document.getElementById('patternArea');
  if (!patternArea) return;

  let html = `<p class="pattern-info">🏹 Press SPACE when the arrow is in the green zone!</p>`;
  html += `<div class="pattern-timer-wrap"><div class="pattern-timer-bar" id="patternTimerBar"></div></div>`;
  html += `<div class="qte-bow-aim">`;
  html += `  <div class="qte-bow-track" id="bowTrack">`;
  html += `    <div class="qte-bow-target" id="bowTarget"></div>`;
  html += `    <div class="qte-bow-reticle" id="bowReticle">➤</div>`;
  html += `  </div>`;
  html += `</div>`;
  html += `<p class="qte-bow-shot" id="bowShot">Shot 1 / ${pattern.shots}</p>`;
  html += `<p class="pattern-feedback" id="patternFeedback"></p>`;
  patternArea.innerHTML = html;
  patternArea.style.display = 'block';

  let targetSizePct = pattern.targetSize * 100;
  let targetCenter = 30 + Math.random() * 40;
  const targetZone = document.getElementById('bowTarget');
  if (targetZone) {
    targetZone.style.top = (targetCenter - targetSizePct / 2) + '%';
    targetZone.style.height = targetSizePct + '%';
  }

  const state = {
    total: pattern.shots, totalTime: pattern.totalTime,
    currentShot: 0, accuracySum: 0,
    done: false, startTime: performance.now(),
    reticlePos: 0, direction: 1, speed: 0.6,
    targetCenter: targetCenter / 100, targetSize: pattern.targetSize,
    animating: true,
  };

  const reticle = document.getElementById('bowReticle');
  function animateReticle() {
    if (state.done || !state.animating) return;
    state.reticlePos += state.direction * state.speed;
    if (state.reticlePos >= 100) { state.reticlePos = 100; state.direction = -1; }
    if (state.reticlePos <= 0) { state.reticlePos = 0; state.direction = 1; }
    if (reticle) reticle.style.top = state.reticlePos + '%';
    requestAnimationFrame(animateReticle);
  }

  state.onTimeout = () => {
    state.timedOut = true;
    state.animating = false;
    state.currentShot = state.total;
    state.computedAccuracy = state.total > 0 ? state.accuracySum / state.total : 0;
    _finishAttackPhase();
  };
  _patternState = state;
  window._combatPatternActive = true;
  _qteTimerBar(state);
  requestAnimationFrame(animateReticle);

  window._handlePatternKey = (kc) => {
    if (state.done || state.currentShot >= state.total) return;
    if (kc !== 32) return; // Space only

    const pos = state.reticlePos / 100;
    const dist = Math.abs(pos - state.targetCenter);
    const halfTarget = state.targetSize / 2;
    let shotAcc;
    if (dist <= halfTarget) {
      shotAcc = 1.0 - (dist / halfTarget) * 0.3;
    } else {
      shotAcc = Math.max(0, 0.5 - (dist - halfTarget) * 1.5);
    }
    state.accuracySum += shotAcc;
    state.currentShot++;

    const track = document.getElementById('bowTrack');
    if (shotAcc >= 0.7) {
      if (track) { track.classList.add('qte-bow-hit'); setTimeout(() => track.classList.remove('qte-bow-hit'), 300); }
    } else {
      if (track) { track.classList.add('qte-bow-miss'); setTimeout(() => track.classList.remove('qte-bow-miss'), 300); }
    }

    const shotLabel = document.getElementById('bowShot');
    if (state.currentShot >= state.total) {
      state.animating = false;
      state.computedAccuracy = state.accuracySum / state.total;
      _finishAttackPhase();
    } else {
      if (shotLabel) shotLabel.textContent = `Shot ${state.currentShot + 1} / ${state.total}`;
      // Move target and shrink slightly
      targetCenter = 20 + Math.random() * 60;
      targetSizePct = Math.max(8, targetSizePct - 2);
      if (targetZone) {
        targetZone.style.top = (targetCenter - targetSizePct / 2) + '%';
        targetZone.style.height = targetSizePct + '%';
      }
      state.targetCenter = targetCenter / 100;
      state.targetSize = targetSizePct / 100;
      state.speed += 0.07;
    }
  };
}

// ====== Crossbow QTE — Click Targets (mouse-based) ======

function _startCrossbowQTE(pattern) {
  const patternArea = document.getElementById('patternArea');
  if (!patternArea) return;

  let html = `<p class="pattern-info">🎯 Click the targets!</p>`;
  html += `<div class="pattern-timer-wrap"><div class="pattern-timer-bar" id="patternTimerBar"></div></div>`;
  html += `<div class="qte-crossbow-field" id="crossbowField"></div>`;
  html += `<p class="qte-crossbow-score" id="crossbowScore">0 / ${pattern.targetCount}</p>`;
  html += `<p class="pattern-feedback" id="patternFeedback"></p>`;
  patternArea.innerHTML = html;
  patternArea.style.display = 'block';

  const field = document.getElementById('crossbowField');
  const state = {
    total: pattern.targetCount, totalTime: pattern.totalTime,
    spawned: 0, hits: 0, resolved: 0,
    done: false, startTime: performance.now(),
    spawnTimers: [],
  };

  function checkComplete() {
    if (state.done) return;
    if (state.resolved >= state.total) {
      state.computedAccuracy = state.hits / state.total;
      _finishAttackPhase();
    }
  }

  function spawnTarget() {
    if (state.done || state.spawned >= state.total) return;
    state.spawned++;
    const target = document.createElement('div');
    target.className = 'qte-crossbow-target';
    target.textContent = '🎯';
    target.style.left = (8 + Math.random() * 78) + '%';
    target.style.top = (8 + Math.random() * 68) + '%';
    target.dataset.alive = 'true';

    target.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.done || target.dataset.alive !== 'true') return;
      target.dataset.alive = 'false';
      state.hits++;
      state.resolved++;
      target.classList.add('qte-crossbow-hit');
      const score = document.getElementById('crossbowScore');
      if (score) score.textContent = `${state.hits} / ${state.total}`;
      setTimeout(() => target.remove(), 200);
      checkComplete();
    });

    field.appendChild(target);

    // Target expires after lifespan
    const fadeTimer = setTimeout(() => {
      if (target.dataset.alive === 'true') {
        target.dataset.alive = 'false';
        state.resolved++;
        target.classList.add('qte-crossbow-expired');
        setTimeout(() => target.remove(), 300);
        checkComplete();
      }
    }, pattern.timePerTarget);
    state.spawnTimers.push(fadeTimer);
  }

  // Spawn targets with staggered timing
  const spawnInterval = Math.max(400, pattern.timePerTarget * 0.6);
  for (let i = 0; i < pattern.targetCount; i++) {
    state.spawnTimers.push(setTimeout(() => spawnTarget(), i * spawnInterval));
  }

  state.onTimeout = () => {
    state.timedOut = true;
    state.spawnTimers.forEach(t => clearTimeout(t));
    state.computedAccuracy = state.total > 0 ? state.hits / state.total : 0;
    _finishAttackPhase();
  };
  _patternState = state;
  window._combatPatternActive = true;
  _qteTimerBar(state);
  // No keyboard handler — mouse only
  window._handlePatternKey = null;
}

// ====== Staff QTE — Spell Timing (expanding ring meets target circle) ======

function _startStaffQTE(pattern) {
  const patternArea = document.getElementById('patternArea');
  if (!patternArea) return;

  let html = `<p class="pattern-info">🪄 Press SPACE when the ring hits the circle!</p>`;
  html += `<div class="pattern-timer-wrap"><div class="pattern-timer-bar" id="patternTimerBar"></div></div>`;
  html += `<div class="qte-spell-center">`;
  html += `  <div class="qte-spell-target" id="spellTarget"></div>`;
  html += `  <div class="qte-spell-ring" id="spellRing"></div>`;
  html += `  <div class="qte-spell-icon">✨</div>`;
  html += `</div>`;
  html += `<p class="qte-spell-cast" id="spellCast">Cast 1 / ${pattern.casts}</p>`;
  html += `<p class="pattern-feedback" id="patternFeedback"></p>`;
  patternArea.innerHTML = html;
  patternArea.style.display = 'block';

  const ring = document.getElementById('spellRing');
  const targetEl = document.getElementById('spellTarget');
  const containerSize = 160; // px — matches .qte-spell-center width/height
  const targetRadius = 0.35; // Target circle normalized (0-1 where 1=full container)
  const targetHalf = pattern.targetSize / 2;
  if (targetEl) {
    const tPx = targetRadius * containerSize;
    targetEl.style.width = tPx + 'px';
    targetEl.style.height = tPx + 'px';
  }

  const state = {
    total: pattern.casts, totalTime: pattern.totalTime,
    currentCast: 0, accuracySum: 0,
    done: false, startTime: performance.now(),
    ringPos: 0, animating: true, speed: 0.007,
    targetRadius, targetHalf: pattern.targetSize / 2,
  };

  function animateRing() {
    if (state.done || !state.animating) return;
    state.ringPos += state.speed;
    if (state.ringPos >= 1) {
      // Missed — ring expanded past everything
      state.currentCast++;
      updateCastLabel();
      if (state.currentCast >= state.total && !state.done) { state.computedAccuracy = state.accuracySum / state.total; _finishAttackPhase(); return; }
      state.ringPos = 0;
      state.speed += 0.0005; // slightly faster each cast
    }
    if (ring) {
      const pct = state.ringPos * 100;
      ring.style.width = pct + '%';
      ring.style.height = pct + '%';
    }
    requestAnimationFrame(animateRing);
  }

  function updateCastLabel() {
    const label = document.getElementById('spellCast');
    if (label && state.currentCast < state.total) label.textContent = `Cast ${state.currentCast + 1} / ${state.total}`;
  }

  state.onTimeout = () => {
    state.timedOut = true;
    state.animating = false;
    state.computedAccuracy = state.total > 0 ? state.accuracySum / state.total : 0;
    _finishAttackPhase();
  };
  _patternState = state;
  window._combatPatternActive = true;
  _qteTimerBar(state);
  requestAnimationFrame(animateRing);

  window._handlePatternKey = (kc) => {
    if (state.done || state.currentCast >= state.total) return;
    if (kc !== 32) return; // Space only

    const dist = Math.abs(state.ringPos - state.targetRadius);
    let castAcc;
    if (dist <= state.targetHalf) {
      castAcc = 1.0 - (dist / state.targetHalf) * 0.3;
    } else {
      castAcc = Math.max(0, 0.5 - (dist - state.targetHalf) * 2);
    }
    state.accuracySum += castAcc;
    state.currentCast++;

    // Visual feedback
    const center = document.querySelector('.qte-spell-center');
    if (castAcc >= 0.7) {
      if (center) { center.classList.add('qte-spell-hit'); setTimeout(() => center.classList.remove('qte-spell-hit'), 300); }
    } else {
      if (center) { center.classList.add('qte-spell-miss'); setTimeout(() => center.classList.remove('qte-spell-miss'), 300); }
    }

    if (state.currentCast >= state.total) {
      state.animating = false;
      state.computedAccuracy = state.accuracySum / state.total;
      _finishAttackPhase();
    } else {
      state.ringPos = 0; // Reset ring for next cast
      state.speed += 0.0005;
      updateCastLabel();
    }
  };
}

// ====== Finish ATTACK phase (shared by all weapon QTEs) ======

function _finishAttackPhase() {
  if (!_patternState || _patternState.done) return;
  _patternState.done = true;
  window._combatPatternActive = false;
  window._handlePatternKey = null;

  // Clean up pending timers
  if (_patternState.spawnTimers) _patternState.spawnTimers.forEach(t => clearTimeout(t));
  if (_patternState.roundTimer) clearTimeout(_patternState.roundTimer);
  if (_patternState.slashTimer) clearTimeout(_patternState.slashTimer);

  // Check if this was a timeout (no hits, timer expired)
  const wasTimeout = _patternState.timedOut || false;

  // Compute accuracy
  let accuracy;
  if (_patternState.computedAccuracy !== undefined) {
    accuracy = _patternState.computedAccuracy;
  } else {
    const total = _patternState.total || _patternState.arrows?.length || 1;
    accuracy = total > 0 ? _patternState.hits / total : 0;
  }
  accuracy = Math.max(0, Math.min(1, accuracy));

  const pct = Math.round(accuracy * 100);
  let label, color;
  if (pct === 100)     { label = 'PERFECT!'; color = '#FFD700'; }
  else if (pct >= 80)  { label = 'Great!';   color = '#4CAF50'; }
  else if (pct >= 50)  { label = 'OK';       color = '#ff9800'; }
  else                 { label = 'Poor...';  color = '#f44336'; }

  const fb = document.getElementById('patternFeedback');
  if (fb) { fb.textContent = `⚔️ ${label} (${pct}%)`; fb.style.color = color; }

  // Snapshot HP before player attack
  const hpBefore = { player: combatSystem.playerHP, enemy: combatSystem.raiderHP };

  setTimeout(() => {
    // --- QTE Timeout penalty: enemy gets a free hit before player attacks ---
    if (wasTimeout && pct === 0) {
      const timeoutResult = combatSystem.doTimeoutPenalty();
      const pDelta = hpBefore.player - combatSystem.playerHP;
      if (pDelta > 0) _showDmgSplash('playerHpBar', pDelta);
      _refreshCombatBars();
      updateCombatLog(timeoutResult);
      if (timeoutResult.resolved) {
        const patternArea = document.getElementById('patternArea');
        if (patternArea) patternArea.style.display = 'none';
        return;
      }
    }

    // Execute PLAYER ATTACK
    const result = combatSystem.playerAction('fight', accuracy);

    // Damage splashes
    const eDelta = hpBefore.enemy - combatSystem.raiderHP;
    if (eDelta > 0) _showDmgSplash('enemyHpBar', eDelta);
    // Check if player took self-damage from fumble or status effects
    const pDelta2 = hpBefore.player - combatSystem.playerHP;
    if (pDelta2 > 0) _showDmgSplash('playerHpBar', pDelta2);
    _refreshCombatBars();
    updateCombatLog(result);

    if (result.resolved) {
      const patternArea = document.getElementById('patternArea');
      if (patternArea) patternArea.style.display = 'none';
      return;
    }

    // If player was stunned, skip to block QTE (enemy gets free attack)
    if (result.playerStunned) {
      setTimeout(() => {
        _startBlockQTE();
      }, 800);
      return;
    }

    // Enemy alive → pause, then Block QTE with countdown
    setTimeout(() => {
      _startBlockQTE();
    }, 1200);
  }, 600);
}

// ====== Block QTE — Scrolling Rhythm Game ======

function _startBlockQTE() {
  if (typeof combatSystem === 'undefined' || combatSystem.result) return;

  const pattern = combatSystem.generateBlockPattern();

  // Show countdown first, then launch the rhythm game
  _showQTECountdown(`🛡️ ${pattern.raiderName} Attacks!`, () => {
    _launchBlockRhythmQTE(pattern);
  });
}

function _launchBlockRhythmQTE(pattern) {
  const patternArea = document.getElementById('patternArea');
  if (!patternArea) return;

  const arrowSymbols = { left: '←', up: '↑', down: '↓', right: '→' };
  const keyCodes = { 37: 'left', 38: 'up', 40: 'down', 39: 'right' };

  let html = `<p class="pattern-info qte-block-header">🛡️ Block incoming attacks!</p>`;
  html += `<div class="pattern-timer-wrap"><div class="pattern-timer-bar qte-block-timer" id="patternTimerBar"></div></div>`;
  html += `<div class="qte-rhythm-track" id="rhythmTrack">`;
  html += `  <div class="qte-rhythm-target-zone" id="rhythmTargetZone">`;
  html += `    <div class="qte-rhythm-target-inner"></div>`;
  html += `  </div>`;
  html += `  <div class="qte-rhythm-lane" id="rhythmLane"></div>`;
  html += `</div>`;
  html += `<p class="qte-block-score" id="blockScore">Blocked: 0 / ${pattern.attacks.length}</p>`;
  html += `<p class="qte-rhythm-hint">Press the matching arrow key as icons reach the shield zone!</p>`;
  html += `<p class="pattern-feedback" id="patternFeedback"></p>`;
  patternArea.innerHTML = html;
  patternArea.style.display = 'block';

  const trackEl = document.getElementById('rhythmTrack');
  const laneEl = document.getElementById('rhythmLane');
  const trackWidth = trackEl ? trackEl.offsetWidth : 400;

  // Target zone is on the left side — center at 14% of track width
  // Hit windows are in progress units (progress = 1.0 at target center)
  const perfectWindow = 0.06; // ±6% = ±120ms with 2s approach (inner golden zone)
  const goodWindow = 0.12;    // ±12% = ±240ms with 2s approach (outer green zone)
  const missThreshold = 1.25; // arrow passes beyond target = missed

  const approachTime = pattern.approachTime || 2000;
  const spawnInterval = pattern.spawnInterval || pattern.timePerBlock;

  const state = {
    attacks: pattern.attacks,
    total: pattern.attacks.length,
    totalTime: pattern.totalTime,
    current: 0, // next arrow to spawn
    hits: 0,
    partialHits: 0,
    done: false,
    startTime: performance.now(),
    spawned: [],      // { dir, el, spawnTime, resolved }
    nextToHit: 0,     // index in spawned[] of next arrow the player should hit
    spawnTimers: [],
  };

  // Spawn arrows staggered over time
  for (let i = 0; i < pattern.attacks.length; i++) {
    const timer = setTimeout(() => {
      if (state.done) return;
      const dir = pattern.attacks[i];
      const arrowEl = document.createElement('div');
      arrowEl.className = 'qte-rhythm-arrow';
      arrowEl.textContent = arrowSymbols[dir];
      arrowEl.dataset.dir = dir;
      arrowEl.dataset.idx = i;
      if (laneEl) laneEl.appendChild(arrowEl);
      state.spawned.push({
        dir, el: arrowEl, spawnTime: performance.now(), resolved: false, idx: i,
      });
    }, i * spawnInterval);
    state.spawnTimers.push(timer);
  }

  // Animation loop — move arrows from right to left
  function animate() {
    if (state.done) return;
    const now = performance.now();
    let allResolved = true;

    for (const arrow of state.spawned) {
      if (arrow.resolved) continue;
      allResolved = false;
      const elapsed = now - arrow.spawnTime;
      const progress = elapsed / approachTime; // 0 = just spawned (right), 1 = at target zone
      // Arrow moves from 95% (right edge) to 14% (target center) over approachTime
      const startPct = 95;
      const endPct = 14; // center of target zone
      const pct = startPct - progress * (startPct - endPct);
      arrow.el.style.left = Math.max(-5, pct) + '%';

      // If arrow has passed well beyond the target zone, mark as missed
      if (progress > missThreshold) {
        arrow.resolved = true;
        arrow.el.classList.add('qte-rhythm-miss');
        // Advance nextToHit if this was the one we were waiting for
        if (arrow.idx === state.nextToHit) {
          state.nextToHit++;
          _updateBlockScore(state);
        }
      }
    }

    // Check if all arrows spawned and resolved
    if (state.spawned.length >= state.total && allResolved && state.spawned.length > 0) {
      if (!state.done) _finishBlockPhase();
      return;
    }

    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  state.onTimeout = () => {
    state.timedOut = true;
    state.spawnTimers.forEach(t => clearTimeout(t));
    // Mark all unresolved as missed
    for (const arrow of state.spawned) {
      if (!arrow.resolved) {
        arrow.resolved = true;
        arrow.el.classList.add('qte-rhythm-miss');
      }
    }
    _finishBlockPhase();
  };
  _patternState = state;
  window._combatPatternActive = true;
  _qteTimerBar(state);

  window._handlePatternKey = (kc) => {
    if (state.done) return;
    const dir = keyCodes[kc];
    if (!dir) return;

    // Find the closest unresolved arrow near the target zone
    const now = performance.now();
    let bestArrow = null;
    let bestDist = Infinity;

    for (const arrow of state.spawned) {
      if (arrow.resolved) continue;
      const elapsed = now - arrow.spawnTime;
      const progress = elapsed / approachTime;
      const dist = Math.abs(progress - 1.0); // 1.0 = exactly at target zone left edge
      // Only consider arrows within the good window and matching direction
      if (dist < goodWindow * 3 && arrow.dir === dir && dist < bestDist) {
        bestDist = dist;
        bestArrow = arrow;
      }
    }

    if (!bestArrow) return; // No matching arrow nearby — ignore input

    bestArrow.resolved = true;
    const elapsed = now - bestArrow.spawnTime;
    const progress = elapsed / approachTime;
    const dist = Math.abs(progress - 1.0);

    if (dist <= perfectWindow) {
      // Perfect block
      state.hits++;
      bestArrow.el.classList.add('qte-rhythm-perfect');
      bestArrow.el.textContent = '✓';
    } else if (dist <= goodWindow) {
      // Good block (partial credit)
      state.hits += 0.7;
      state.partialHits++;
      bestArrow.el.classList.add('qte-rhythm-good');
      bestArrow.el.textContent = '~';
    } else {
      // Too early/late
      bestArrow.el.classList.add('qte-rhythm-miss');
      bestArrow.el.textContent = '✗';
    }

    // Update nextToHit
    while (state.nextToHit < state.spawned.length && state.spawned[state.nextToHit].resolved) {
      state.nextToHit++;
    }
    _updateBlockScore(state);

    // Check if all done
    const allDone = state.spawned.length >= state.total && state.spawned.every(a => a.resolved);
    if (allDone && !state.done) {
      setTimeout(() => { if (!state.done) _finishBlockPhase(); }, 300);
    }
  };
}

function _updateBlockScore(state) {
  const score = document.getElementById('blockScore');
  const blocked = Math.round(state.hits * 10) / 10;
  if (score) score.textContent = `Blocked: ${blocked} / ${state.total}`;
}

// ====== Finish BLOCK phase ======

function _finishBlockPhase() {
  if (!_patternState || _patternState.done) return;
  _patternState.done = true;
  window._combatPatternActive = false;
  window._handlePatternKey = null;
  if (_patternState.spawnTimers) _patternState.spawnTimers.forEach(t => clearTimeout(t));

  const wasTimeout = _patternState.timedOut || false;
  const blockAccuracy = _patternState.total > 0 ? _patternState.hits / _patternState.total : 0;
  const pct = Math.round(blockAccuracy * 100);

  let label, color;
  if (pct === 100)     { label = 'Perfect Block!'; color = '#FFD700'; }
  else if (pct >= 80)  { label = 'Strong Block!';  color = '#4CAF50'; }
  else if (pct >= 50)  { label = 'Partial Block';  color = '#ff9800'; }
  else                 { label = 'Weak Block...';  color = '#f44336'; }

  if (wasTimeout && pct === 0) {
    label = 'No Block!';
    color = '#f44336';
  }

  const fb = document.getElementById('patternFeedback');
  if (fb) { fb.textContent = `🛡️ ${label} (${pct}%)`; fb.style.color = color; }

  const hpBefore = { player: combatSystem.playerHP, enemy: combatSystem.raiderHP };

  setTimeout(() => {
    const result = combatSystem.playerAction('block', blockAccuracy);

    // If block timed out, apply extra punishment damage
    if (wasTimeout && pct === 0 && !result.enemyMiss) {
      const bonusDmg = Math.max(1, Math.floor((result.enemyDmg || 1) * 0.5));
      combatSystem.playerHP -= bonusDmg;
      combatSystem.addLog(`⌛ Unguarded! +${bonusDmg} bonus damage from hesitation!`);
      if (combatSystem.playerHP <= 0 && !result.resolved) {
        combatSystem.result = 'lose';
        const raiderType = RAIDER_TYPES[combatSystem.raiderType] || RAIDER_TYPES['bandit'];
        combatSystem.addLog(`Defeat! The ${raiderType.name} overwhelms you.`);
        combatSystem.resolveCombat();
        result.resolved = true;
      }
    }

    // Damage splash
    const pDelta = hpBefore.player - combatSystem.playerHP;
    if (pDelta > 0) _showDmgSplash('playerHpBar', pDelta);
    _refreshCombatBars();
    updateCombatLog(result);

    // Hide pattern area, show actions again
    const patternArea = document.getElementById('patternArea');
    if (patternArea) patternArea.style.display = 'none';
    if (!result.resolved) {
      const actions = document.getElementById('combatActions');
      if (actions) actions.style.display = 'flex';
      // Restore normal buttons after enemy-first block turn
      _restoreCombatButtons();
    }
  }, 800);
}

uiManager.registerScreen("combatView", {
  validStates: [GameStates.COMBAT],

  create: () => {
    const wrapper = createDiv().id("combatView").class("screen combat-screen").style("display", "none");

    createElement("h2", "⚔️ Raiders Attack!").id("combatTitle").parent(wrapper);
    createP("").id("combatDesc").parent(wrapper);

    // --- Combatants display (icons + HP bars) ---
    const combatants = createDiv().class("combatants-area").parent(wrapper);

    // Player side
    const pSide = createDiv().class("combatant-side").parent(combatants);
    createDiv().class("combatant-icon player-icon").html(atlasIconHTML('player', 48, '🛡️')).parent(pSide);
    createP("You").class("combatant-name").parent(pSide);
    const pBarWrap = createDiv().class("hp-bar-wrap").parent(pSide);
    createDiv().class("hp-bar player-hp-bar").id("playerHpBar").parent(pBarWrap);
    createP("").class("hp-label").id("playerHpLabel").parent(pSide);
    // Status effects
    createDiv().class("status-effects").id("playerStatusEffects").parent(pSide);

    // VS divider
    createDiv().class("vs-divider").html("⚔").parent(combatants);

    // Enemy side
    const eSide = createDiv().class("combatant-side").parent(combatants);
    createDiv().class("combatant-icon enemy-icon").id("enemyIcon").html(atlasIconHTML('raider', 48, '💀')).parent(eSide);
    createP("Enemy").class("combatant-name").id("enemyNameLabel").parent(eSide);
    const eBarWrap = createDiv().class("hp-bar-wrap").parent(eSide);
    createDiv().class("hp-bar enemy-hp-bar").id("enemyHpBar").parent(eBarWrap);
    createP("").class("hp-label").id("enemyHpLabel").parent(eSide);
    // Enemy status effects
    createDiv().class("status-effects").id("enemyStatusEffects").parent(eSide);

    // --- Pattern mini-game area (hidden) ---
    createDiv().id("patternArea").class("pattern-area").style("display", "none").parent(wrapper);

    // --- Naval combat area (hidden) ---
    const navalArea = createDiv().id("navalArea").class("naval-area").style("display", "none").parent(wrapper);
    const navalGrids = createDiv().class("naval-grids").parent(navalArea);

    const pSection = createDiv().class("naval-grid-section").parent(navalGrids);
    createP("⚓ Your Ship").class("naval-grid-label").parent(pSection);
    createP("").id("navalHullStatus").class("naval-hull-status").parent(pSection);
    createDiv().id("playerNavalGrid").class("naval-grid").parent(pSection);

    const eSection = createDiv().class("naval-grid-section").parent(navalGrids);
    const eLabelRow = createDiv().style("display","flex").style("align-items","center").style("gap","8px").parent(eSection);
    createP("🎯 Enemy Ship").class("naval-grid-label").style("margin","0").parent(eLabelRow);
    createSpan("").id("enemyBehaviorLabel").style("font-size","11px").style("opacity","0.7").parent(eLabelRow);
    createDiv().id("enemyNavalGrid").class("naval-grid").parent(eSection);

    // Phase indicator
    createDiv().id("navalPhaseLabel").class("naval-phase-label").parent(navalArea);

    const timerWrap = createDiv().class("naval-timer-wrap").parent(navalArea);
    createDiv().class("naval-timer-bar").id("navalTimerBar").parent(timerWrap);

    // Ability buttons
    const abilitiesRow = createDiv().class("naval-abilities").parent(navalArea);
    createButton("⛓️ Chain Shot").class("naval-ability-btn").id("abilityChainShot").parent(abilitiesRow)
      .mousePressed(() => { if (combatSystem) combatSystem.useChainShot(); });
    createButton("💨 Smoke Screen").class("naval-ability-btn").id("abilitySmokeScreen").parent(abilitiesRow)
      .mousePressed(() => { if (combatSystem) combatSystem.useSmokeScreen(); });
    createButton("🔧 Repair").class("naval-ability-btn").id("abilityRepair").parent(abilitiesRow)
      .mousePressed(() => { if (combatSystem) combatSystem.useRepair(); });

    createP("WASD to dodge · Click enemy grid to fire!").id("navalHint").class("naval-hint").parent(navalArea);

    // Naval flee button
    createButton("🏃 Flee")
      .id("navalFleeBtn")
      .class("combat-btn flee-btn")
      .style("margin-top", "6px")
      .parent(navalArea)
      .mousePressed(() => {
        if (!combatSystem || !combatSystem.isNavalCombat || combatSystem.result) return;
        const escaped = combatSystem.attemptNavalFlee();
        _appendNavalLog();
        if (escaped) {
          _navalCombatEnd();
        } else {
          _refreshCombatBars();
        }
      });

    // --- Bribe confirm area (hidden) ---
    const bribeArea = createDiv().id("bribeConfirmArea").class("bribe-confirm-area").style("display", "none").parent(wrapper);
    createP("").class("bribe-confirm-text").parent(bribeArea);
    const bribeBtns = createDiv().class("bribe-confirm-btns").parent(bribeArea);
    createButton("Pay")
      .parent(bribeBtns)
      .addClass("combat-btn bribe-pay-btn")
      .mousePressed(() => {
        const area = document.getElementById('bribeConfirmArea');
        if (area) area.style.display = 'none';
        const result = combatSystem.playerAction('bribe', true);
        _refreshCombatBars();
        updateCombatLog(result);
        if (!result.resolved) {
          const actions = document.getElementById('combatActions');
          if (actions) actions.style.display = 'flex';
        }
      });
    createButton("Cancel")
      .parent(bribeBtns)
      .addClass("combat-btn bribe-cancel-btn")
      .mousePressed(() => {
        const area = document.getElementById('bribeConfirmArea');
        if (area) area.style.display = 'none';
        const actions = document.getElementById('combatActions');
        if (actions) actions.style.display = 'flex';
      });

    // Combat log
    createDiv().id("combatLog").class("combat-log").parent(wrapper);

    // Action buttons
    const actions = createDiv().id("combatActions").class("combat-actions").parent(wrapper);

    createButton("⚔️ Fight")
      .parent(actions)
      .addClass("combat-btn fight-btn")
      .mousePressed(() => {
        if (typeof combatSystem !== 'undefined') {
          if (combatSystem._mustBlockFirst) {
            // Enemy goes first — start block QTE, then restore normal buttons after
            combatSystem._mustBlockFirst = false;
            const actions = document.getElementById('combatActions');
            if (actions) actions.style.display = 'none';
            _startBlockQTE();
          } else {
            _startPatternMiniGame();
          }
        }
      });

    createButton("🏃 Flee")
      .parent(actions)
      .addClass("combat-btn flee-btn")
      .mousePressed(() => {
        if (typeof combatSystem !== 'undefined') {
          const result = combatSystem.playerAction('flee');
          _refreshCombatBars();
          updateCombatLog(result);
        }
      });

    createButton("💰 Bribe")
      .parent(actions)
      .addClass("combat-btn bribe-btn")
      .mousePressed(() => {
        if (typeof combatSystem !== 'undefined') {
          _showBribeConfirm();
        }
      });

    // Continue button (shown after combat ends)
    createButton("Continue")
      .id("combatContinueBtn")
      .parent(wrapper)
      .addClass("menu-btn")
      .style("display", "none")
      .mousePressed(() => {
        if (typeof combatSystem !== 'undefined') {
          combatSystem.endCombat();
        } else {
          gameStateManager.setState(GameStates.PLAYING);
        }
      });

    return wrapper;
  },

  show: () => {
    const view = select("#combatView");
    if (view) {
      view.show().style("opacity", "1");
      select("#combatLog")?.html("");
      select("#combatContinueBtn")?.style("display", "none");
      select("#combatActions")?.style("display", "flex");

      // Reset sub-areas
      const patternArea = document.getElementById('patternArea');
      if (patternArea) patternArea.style.display = 'none';
      const bribeArea = document.getElementById('bribeConfirmArea');
      if (bribeArea) bribeArea.style.display = 'none';
      const navalArea = document.getElementById('navalArea');
      if (navalArea) navalArea.style.display = 'none';

      if (typeof combatSystem !== 'undefined' && combatSystem.raider) {

        // ─── Naval combat ───
        if (combatSystem.isNavalCombat) {
          const pBoat = BoatLibrary[combatSystem.playerBoatType] || BoatLibrary.rowboat;
          const eBoat = BoatLibrary[combatSystem.enemyBoatType] || BoatLibrary.rowboat;

          const title = select("#combatTitle");
          if (title) title.html(`⚓ Naval Battle!`);
          select("#combatDesc")?.html(
            `Your <b>${pBoat.displayName}</b> vs Pirate <b>${eBoat.displayName}</b>`
          );

          // Update icons for naval combat
        const playerIcon = document.querySelector('.player-icon');
        if (playerIcon) playerIcon.textContent = '⛵';
          const enemyIcon = document.getElementById('enemyIcon');
          if (enemyIcon) enemyIcon.textContent = '☠️';
          const enemyName = document.getElementById('enemyNameLabel');
          if (enemyName) enemyName.textContent = `Pirate ${eBoat.displayName}`;

          // Hide land-combat actions, show naval UI
          select("#combatActions")?.style("display", "none");
          _initNavalUI();
          _refreshCombatBars();

          // Render initial log
          if (combatSystem.log && combatSystem.log.length > 0) {
            const log = select("#combatLog");
            if (log) {
              combatSystem.log.forEach(msg => {
                const entry = createP(msg).style("margin", "4px 0").style("color", "#aaa");
                entry.parent(log);
              });
              log.elt.scrollTop = log.elt.scrollHeight;
            }
          }
          return;
        }

        // ─── Standard land combat ───
        const rType = RAIDER_TYPES[combatSystem.raiderType] || RAIDER_TYPES['bandit'];
        const isMonster = rType.monster;

        const title = select("#combatTitle");
        if (title) {
          title.html(isMonster ? `🐉 ${rType.name} Appears!` : "⚔️ Raiders Attack!");
        }
        select("#combatDesc")?.html(
          isMonster
            ? `A fearsome ${rType.name} blocks your path! (Str: ${combatSystem.raider.strength})`
            : `A band of ${combatSystem.raider.strength} raiders blocks your path!`
        );

        // Restore player icon for land combat
        const playerIcon = document.querySelector('.player-icon');
        if (playerIcon) playerIcon.innerHTML = atlasIconHTML('player', 48, '🛡️');

        const enemyIcon = document.getElementById('enemyIcon');
        if (enemyIcon) {
          const iconMap = { dragon: '🐉', blackKnight: '🗡️', wraith: '👻' };
          enemyIcon.innerHTML = iconMap[combatSystem.raiderType]
            || atlasIconHTML('raider', 48, '💀');
        }
        const enemyName = document.getElementById('enemyNameLabel');
        if (enemyName) enemyName.textContent = rType.name;

        _refreshCombatBars();

        // Disable bribe button for monsters
        const bribeBtn = select(".bribe-btn");
        if (bribeBtn) {
          if (isMonster) {
            bribeBtn.html("💰 Bribe (N/A)");
            bribeBtn.style("opacity", "0.4");
          } else {
            bribeBtn.html("💰 Bribe");
            bribeBtn.style("opacity", "1");
          }
        }

        // Render initial log messages
        if (combatSystem.log && combatSystem.log.length > 0) {
          const log = select("#combatLog");
          if (log) {
            combatSystem.log.forEach(msg => {
              const entry = createP(msg).style("margin", "4px 0").style("color", "#aaa");
              entry.parent(log);
            });
            log.elt.scrollTop = log.elt.scrollHeight;
          }
          _lastCombatLogIndex = combatSystem.log.length;
        } else {
          _lastCombatLogIndex = 0;
        }

        // Enemy goes first — swap Fight to Brace, disable Flee but keep Bribe
        if (combatSystem.enemyGoesFirst) {
          combatSystem._mustBlockFirst = true;
          const fightBtn = select(".fight-btn");
          if (fightBtn) {
            fightBtn.html("🛡️ Brace!");
            fightBtn.style("animation", "pulse-warn 1s infinite");
          }
          const fleeBtn = select(".flee-btn");
          if (fleeBtn) { fleeBtn.style("opacity", "0.3"); fleeBtn.style("pointer-events", "none"); }
        }
      }
    }
  },

  hide: () => {
    // Clean up pattern state & pending QTE timers
    if (_patternState) {
      _patternState.done = true;
      _patternState.animating = false;
      if (_patternState.spawnTimers) _patternState.spawnTimers.forEach(t => clearTimeout(t));
      if (_patternState.roundTimer) clearTimeout(_patternState.roundTimer);
      if (_patternState.slashTimer) clearTimeout(_patternState.slashTimer);
      if (_patternState.blockTimer) clearTimeout(_patternState.blockTimer);
    }
    window._combatPatternActive = false;
    window._handlePatternKey = null;
    _patternState = null;

    // Clean up naval timer
    _stopNavalTimer();

    const view = select("#combatView");
    if (view) { view.style("opacity", "0"); uiManager.scheduleFadeHide("combatView", 200); }
  }
});

let _lastCombatLogIndex = 0;

function updateCombatLog(result) {
  if (!result) return;

  const log = select("#combatLog");
  if (log && combatSystem.log) {
    // Flush all new log entries since last update
    const newEntries = combatSystem.log.slice(_lastCombatLogIndex);
    _lastCombatLogIndex = combatSystem.log.length;

    for (const msg of newEntries) {
      const isGood = msg.includes('strike for') || msg.includes('CRITICAL')
        || msg.includes('PERFECT') || msg.includes('grazes') || msg.includes('Victory')
        || msg.includes('block') || msg.includes('Block') || msg.includes('misses');
      const isBad = msg.includes('hits you') || msg.includes('damage!') || msg.includes('Defeat')
        || msg.includes('CRITS') || msg.includes('breathes fire') || msg.includes('ambush');
      const isRound = msg.startsWith('---');
      let color = '#aaa';
      if (result.won) color = '#4CAF50';
      else if (result.fled) color = '#ff9800';
      else if (isRound) color = '#888';
      else if (isGood) color = '#4CAF50';
      else if (isBad) color = '#f44336';
      const entry = createP(msg).style("margin", "4px 0").style("color", color);
      entry.parent(log);
    }

    // Auto-scroll
    log.elt.scrollTop = log.elt.scrollHeight;
  }

  if (result.resolved) {
    select("#combatActions")?.style("display", "none");
    select("#combatContinueBtn")?.style("display", "block");

    // Show loot summary
    if (result.won && result.loot) {
      const lootText = `Loot: ${result.loot.gold || 0} gold` +
        (result.loot.items ? `, ${result.loot.items.length} items` : "");
      const lootP = createP(lootText)
        .style("color", "#d4af37")
        .style("font-weight", "bold");
      lootP.parent(select("#combatLog"));
    }
  }
}


// ============================
// RANDOM EVENT VIEW
// ============================
uiManager.registerScreen("eventView", {
  validStates: [GameStates.RANDOM_EVENT],

  create: () => {
    const wrapper = createDiv().id("eventView").class("screen event-screen").style("display", "none");

    createElement("h2", "").id("eventTitle").parent(wrapper);
    // Countdown timer bar (matches combat timer style)
    const timerWrap = createDiv().id("eventTimerWrap").parent(wrapper)
      .style("display", "none")
      .style("width", "100%")
      .style("height", "6px")
      .style("background", "#222")
      .style("border-radius", "3px")
      .style("overflow", "hidden")
      .style("margin", "8px 0");
    createDiv().id("eventTimerBar").parent(timerWrap)
      .style("width", "100%")
      .style("height", "100%")
      .style("background", "linear-gradient(90deg, #f44336, #ff9800)")
      .style("border-radius", "3px")
      .style("transition", "none");
    createP("").id("eventDesc").parent(wrapper);
    createDiv().id("eventChoices").class("event-choices").parent(wrapper);

    // Pre-created continue button (hidden by default)
    createButton("Continue")
      .id("eventContinueBtn")
      .addClass("menu-btn")
      .style("display", "none")
      .parent(wrapper)
      .mousePressed(() => {
        gameStateManager.setState(GameStates.PLAYING);
      });

    return wrapper;
  },

  show: () => {
    const view = select("#eventView");
    if (view) {
      view.show().style("opacity", "1");
    }

    // Hide continue button until event resolves
    select("#eventContinueBtn")?.style("display", "none");
    // Hide timer bar by default
    select("#eventTimerWrap")?.style("display", "none");
    // Cancel any previous animation frame
    if (window._eventTimerAnim) {
      cancelAnimationFrame(window._eventTimerAnim);
      window._eventTimerAnim = null;
    }

    if (typeof eventSystem !== 'undefined' && eventSystem.currentEvent) {
      const evt = eventSystem.currentEvent;
      select("#eventTitle")?.html(`🎲 ${evt.name}`);
      select("#eventDesc")?.html(evt.description);

      const choicesDiv = select("#eventChoices");
      choicesDiv?.html("");

      // Start animated timer bar if event has a time limit
      if (evt.timeLimit && eventSystem.getTimerRemaining() > 0) {
        select("#eventTimerWrap")?.style("display", "block");
        const totalMs = evt.timeLimit * 1000;
        const deadline = eventSystem._eventDeadline;

        function animateEventBar() {
          const remaining = deadline - Date.now();
          const pct = Math.max(0, remaining / totalMs);
          const bar = document.getElementById('eventTimerBar');
          if (bar) {
            bar.style.width = (pct * 100) + '%';
            // Color shift: green → orange → red as time runs out
            if (pct > 0.5) {
              bar.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
            } else if (pct > 0.25) {
              bar.style.background = 'linear-gradient(90deg, #ff9800, #FFC107)';
            } else {
              bar.style.background = 'linear-gradient(90deg, #f44336, #ff5722)';
            }
          }
          if (pct > 0 && eventSystem.currentEvent) {
            window._eventTimerAnim = requestAnimationFrame(animateEventBar);
          }
        }
        window._eventTimerAnim = requestAnimationFrame(animateEventBar);
      }

      if (evt.choices) {
        for (let i = 0; i < evt.choices.length; i++) {
          const choice = evt.choices[i];
          const choiceLabel = typeof choice.text === 'function' ? choice.text() : choice.text;
          createButton(choiceLabel)
            .parent(choicesDiv)
            .addClass("event-choice-btn")
            .mousePressed(() => {
              // Stop countdown animation
              if (window._eventTimerAnim) {
                cancelAnimationFrame(window._eventTimerAnim);
                window._eventTimerAnim = null;
              }
              select("#eventTimerWrap")?.style("display", "none");
              const result = eventSystem.resolveChoice(i);
              // If a minigame was launched, skip showing the event result
              // (the minigame's completion callback handles the outcome)
              if (gameStateManager.currentState !== GameStates.MINIGAME) {
                showEventResult(result);
              }
            });
        }
      }
    }
  },

  hide: () => {
    const view = select("#eventView");
    if (view) { view.style("opacity", "0"); uiManager.scheduleFadeHide("eventView", 200); }
  }
});

function showEventResult(result) {
  if (!result) return;

  // Stop timer bar animation
  if (window._eventTimerAnim) {
    cancelAnimationFrame(window._eventTimerAnim);
    window._eventTimerAnim = null;
  }
  select("#eventTimerWrap")?.style("display", "none");

  select("#eventChoices")?.html("");
  // Support newlines in timeout messages
  const html = (result.message || "The event concludes.").replace(/\n/g, "<br>");
  select("#eventDesc")?.html(html);

  // Color the result text based on type
  const colors = { error: "#f44336", warning: "#ff9800", success: "#4CAF50", info: "#aaa" };
  select("#eventDesc")?.style("color", colors[result.type] || "#ccc");

  // Show the pre-created continue button
  select("#eventContinueBtn")?.style("display", "block");
}


// ============================
// WEEKLY SUMMARY VIEW (registered with UIManager)
// ============================

/** Store weekly summary data for the UI to consume */
window._weeklySummaryData = null;

/**
 * Called from player.js — stores summary data and transitions to the WEEKLY_SUMMARY state.
 */
function showWeeklySummary(summary) {
  window._weeklySummaryData = summary;
  if (typeof gameStateManager !== 'undefined' && typeof GameStates !== 'undefined') {
    gameStateManager.setState(GameStates.WEEKLY_SUMMARY);
  }
}

uiManager.registerScreen("weeklySummaryView", {
  validStates: [GameStates.WEEKLY_SUMMARY],

  create: () => {
    const wrapper = createDiv().id("weeklySummaryView").class("screen").style("display", "none");

    createElement("h2", "📊 Weekly Summary")
      .parent(wrapper)
      .style("color", "var(--accent)")
      .style("margin-bottom", "12px");

    createDiv().id("weeklySummaryBody")
      .style("text-align", "left")
      .style("margin", "12px 0")
      .parent(wrapper);

    createButton("Continue")
      .parent(wrapper)
      .addClass("menu-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.PLAYING);
      });

    return wrapper;
  },

  show: () => {
    const el = select("#weeklySummaryView");
    if (el) { el.show(); el.addClass("screen-visible"); }

    const summary = window._weeklySummaryData;
    const body = select("#weeklySummaryBody");
    if (!summary || !body) return;

    const lines = [];

    // Income / spending this week
    lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
      <span>💰 Trade Income</span><span style="color:#4caf50">+${summary.income}g</span></div>`);
    lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
      <span>🛒 Purchases</span><span style="color:#ff9800">-${summary.spending}g</span></div>`);

    // Tax
    const taxColor = summary.taxPaid ? "#ff9800" : "#ff4f4f";
    const taxLabel = summary.taxPaid ? `-${summary.tax}g` : `-${summary.tax}g (unpaid!)`;
    lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
      <span>💸 Tax (${(player.taxRate * 100).toFixed(0)}%)</span><span style="color:${taxColor}">${taxLabel}</span></div>`);

    // Port maintenance: boats
    if (summary.boatDetails.length > 0) {
      for (const b of summary.boatDetails) {
        lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
          <span>⚓ ${b.name} (${b.type})</span><span style="color:#ff9800">-${b.fee}g</span></div>`);
      }
    }

    // Storage upkeep
    if (summary.storageCost > 0) {
      lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
        <span>📦 Storage Upkeep</span><span style="color:#ff9800">-${summary.storageCost}g</span></div>`);
    }

    // No maintenance
    if (summary.portMaintenance === 0) {
      lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
        <span>⚓ Port Maintenance</span><span style="color:#888">0g</span></div>`);
    }

    // Hull wear
    if (summary.wearApplied && player.fleet.length > 0) {
      for (const boat of player.fleet) {
        const cColor = boat.conditionColor ? boat.conditionColor() : '#888';
        const cLabel = boat.conditionLabel ? boat.conditionLabel() : '';
        lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
          <span>🔧 "${boat.name}" hull wear</span><span style="color:${cColor}">${boat.condition}% ${cLabel}</span></div>`);
      }
    }

    // Bank lines
    if (summary.bankInterest > 0) {
      lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
        <span>🏦 Deposit Interest (1%)</span><span style="color:#4caf50">+${summary.bankInterest}g</span></div>`);
    }
    if (summary.loanInterest > 0) {
      lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
        <span>📝 Loan Interest (8%)</span><span style="color:#f44336">+${summary.loanInterest}g owed</span></div>`);
    }
    if (summary.investmentReturns > 0) {
      lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
        <span>📈 Investment Returns</span><span style="color:#4fc3f7">+${summary.investmentReturns}g</span></div>`);
    }

    // Totals
    const bankNet = (summary.bankInterest || 0) - 0; // deposit interest is already in bank, not player gold
    const netWeek = summary.income - summary.spending - summary.totalCosts;
    const netColor = netWeek >= 0 ? "#4caf50" : "#ff4f4f";
    const netSign = netWeek >= 0 ? "+" : "";
    lines.push(`<div style="display:flex;justify-content:space-between;padding:8px 0;margin-top:4px;border-top:2px solid var(--border);font-weight:bold">
      <span>Net Change</span><span style="color:${netColor}">${netSign}${netWeek}g</span></div>`);
    lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:1.1em">
      <span>Gold Remaining</span><span style="color:var(--accent)">${summary.goldAfter}g</span></div>`);

    body.html(lines.join(""));
  },

  hide: () => {
    const el = select("#weeklySummaryView");
    if (el) { el.removeClass("screen-visible"); el.hide(); }
    window._weeklySummaryData = null;
  }
});


// ============================
// GAME WON VIEW
// ============================
uiManager.registerScreen("gameWonView", {
  validStates: [GameStates.GAMEWON],

  create: () => {
    const wrapper = createDiv().id("gameWonView").class("screen").style("display", "none");

    createElement("h1", "🏆 Victory!")
      .parent(wrapper)
      .style("color", "var(--accent)");

    createP("")
      .id("gameWonText")
      .style("margin-bottom", "20px")
      .parent(wrapper);

    createButton("Keep Playing")
      .parent(wrapper)
      .addClass("menu-btn")
      .mousePressed(() => {
        player.hasWon = true;
        gameStateManager.setState(GameStates.PLAYING);
      });

    createButton("Main Menu")
      .parent(wrapper)
      .addClass("menu-btn")
      .style("margin-top", "8px")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.MAIN_MENU);
      });

    return wrapper;
  },

  show: () => {
    const el = select("#gameWonView");
    if (el) { el.show(); el.addClass("screen-visible"); }
    const goldTarget = window._newGameGoldTarget || 5000;
    const days = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : '?';
    const txt = select("#gameWonText");
    if (txt) txt.html(`You've reached ${goldTarget.toLocaleString()} gold in ${days} days! You may continue playing.`);
  },
  hide: () => {
    const el = select("#gameWonView");
    if (el) { el.removeClass("screen-visible"); el.hide(); }
  }
});


// ============================
// GAME LOSE VIEW
// ============================
uiManager.registerScreen("gameLoseView", {
  validStates: [GameStates.GAMELOSE],

  create: () => {
    const wrapper = createDiv().id("gameLoseView").class("screen").style("display", "none");

    createElement("h1", "💀 Defeat")
      .parent(wrapper)
      .style("color", "#ff4f4f");

    createP("").id("gameLoseMessage")
      .style("margin-bottom", "20px")
      .parent(wrapper);

    // Retry button (hidden on hardcore)
    const retryBtn = createButton("Retry")
      .parent(wrapper)
      .addClass("menu-btn")
      .id("gameLoseRetryBtn")
      .mousePressed(() => {
        location.reload();
      });

    createButton("Main Menu")
      .parent(wrapper)
      .addClass("menu-btn")
      .style("margin-top", "8px")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.MAIN_MENU);
      });

    return wrapper;
  },

  show: () => {
    const el = select("#gameLoseView");
    if (el) { el.show(); el.addClass("screen-visible"); }

    // Update message and retry button based on difficulty
    const isHardcore = window.DIFFICULTY_CONFIG?.permadeath === true;
    const msgEl = select("#gameLoseMessage");
    const retryBtn = select("#gameLoseRetryBtn");
    if (msgEl) {
      if (isHardcore) {
        msgEl.html("💀 <strong>Hardcore mode</strong> — Your journey ends here. Your save has been erased. No second chances.");
      } else {
        msgEl.html("You've run out of gold and supplies. Try again?");
      }
    }
    if (retryBtn) {
      if (isHardcore) {
        retryBtn.style("display", "none");
      } else {
        retryBtn.style("display", "");
      }
    }
  },
  hide: () => {
    const el = select("#gameLoseView");
    if (el) { el.removeClass("screen-visible"); el.hide(); }
  }
});

// ═══════════════════════════════════════════════════
//  BOOK POPUP SYSTEM
// ═══════════════════════════════════════════════════

/** Open the appropriate book popup by item key */
function openBookPopup(bookKey) {
  // Remove any existing book popup
  const existing = document.getElementById('bookPopupOverlay');
  if (existing) existing.remove();

  switch (bookKey) {
    case 'MarketAnalysis':       showMarketAnalysisBook(); break;
    case 'HolidaysBook':         showHolidaysBook(); break;
    case 'NegotiationForDummies': showNegotiationBook(); break;
    case 'ConflictResolution':   showConflictResolutionBook(); break;
    default:
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log("Can't read this item.", "warning");
      }
  }
}

/** Create the shared book overlay wrapper */
function _createBookOverlay(title, emoji) {
  const overlay = document.createElement('div');
  overlay.id = 'bookPopupOverlay';
  Object.assign(overlay.style, {
    position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
    background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: '9999',
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const popup = document.createElement('div');
  Object.assign(popup.style, {
    background: '#1a1a2e', border: '2px solid #4a4a7a', borderRadius: '12px',
    padding: '20px', width: '700px', maxWidth: '90vw', maxHeight: '80vh',
    overflowY: 'auto', color: '#c8d6e5', fontFamily: 'inherit', position: 'relative',
  });
  overlay.appendChild(popup);

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '16px', borderBottom: '1px solid #333', paddingBottom: '10px',
  });
  popup.appendChild(header);

  const titleEl = document.createElement('h2');
  titleEl.textContent = `${emoji} ${title}`;
  Object.assign(titleEl.style, { margin: '0', color: '#d4af37', fontSize: '18px' });
  header.appendChild(titleEl);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  Object.assign(closeBtn.style, {
    background: '#333', color: '#fff', border: 'none', borderRadius: '4px',
    padding: '4px 10px', cursor: 'pointer', fontSize: '14px',
  });
  closeBtn.onclick = () => overlay.remove();
  header.appendChild(closeBtn);

  document.body.appendChild(overlay);
  return { overlay, popup };
}

// ───────────────────────────────────────────────────
//  MARKET ANALYSIS BOOK
// ───────────────────────────────────────────────────
function showMarketAnalysisBook() {
  const { overlay, popup } = _createBookOverlay("Market Analysis", "📊");

  // Build sidebar + content layout
  const layout = document.createElement('div');
  Object.assign(layout.style, { display: 'flex', gap: '12px', height: '60vh' });
  popup.appendChild(layout);

  // Sidebar: item list (non-book items only)
  const sidebar = document.createElement('div');
  Object.assign(sidebar.style, {
    width: '160px', minWidth: '130px', overflowY: 'auto',
    background: '#111', borderRadius: '8px', padding: '6px',
  });
  layout.appendChild(sidebar);

  // Content panel
  const content = document.createElement('div');
  Object.assign(content.style, {
    flex: '1', overflowY: 'auto', padding: '10px', background: '#0d0d1a', borderRadius: '8px',
  });
  layout.appendChild(content);

  const nonBookItems = Object.entries(ItemLibrary).filter(([k, v]) => !v.tags?.has('book'));

  // Visited cities tracker
  const visitedCities = (typeof cities !== 'undefined') ? cities : [];

  function showItemPage(itemKey, itemData) {
    content.innerHTML = '';

    // Item header
    const h = document.createElement('h3');
    h.textContent = itemData.name;
    Object.assign(h.style, { margin: '0 0 6px', color: '#fff' });
    content.appendChild(h);

    const meta = document.createElement('p');
    meta.innerHTML = `<span style="color:#aaa">Category:</span> ${itemData.category} &nbsp; <span style="color:#aaa">Weight:</span> ${itemData.weight}kg &nbsp; <span style="color:#aaa">Rarity:</span> ${itemData.rarity}x`;
    Object.assign(meta.style, { fontSize: '12px', margin: '0 0 4px', color: '#888' });
    content.appendChild(meta);

    if (itemData.seasonality && itemData.seasonality.length > 0) {
      const seasonP = document.createElement('p');
      seasonP.innerHTML = `<span style="color:#aaa">High demand seasons:</span> ${itemData.seasonality.join(', ')}`;
      Object.assign(seasonP.style, { fontSize: '12px', margin: '0 0 12px', color: '#8bc34a' });
      content.appendChild(seasonP);
    }

    // Price table across cities
    const table = document.createElement('table');
    Object.assign(table.style, {
      width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '12px',
    });
    const thead = document.createElement('tr');
    for (const th of ['City', 'Stock', 'Buy Price', 'Sell Price', 'Trend']) {
      const cell = document.createElement('th');
      cell.textContent = th;
      Object.assign(cell.style, {
        textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid #333', color: '#d4af37',
      });
      thead.appendChild(cell);
    }
    table.appendChild(thead);

    for (const city of visitedCities) {
      const row = document.createElement('tr');
      const buyP = city.calculateItemPrice(itemKey, visitedCities, false);
      const sellP = city.calculateItemPrice(itemKey, visitedCities, true);
      const stock = city.inventory.get(itemKey)?.quantity || 0;
      const trend = city.getPriceTrend ? city.getPriceTrend(itemKey) : 0;
      const trendStr = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';
      const trendColor = trend > 0 ? '#4CAF50' : trend < 0 ? '#f44336' : '#aaa';

      const vals = [city.name, stock, `${buyP}g`, `${sellP}g`];
      for (const v of vals) {
        const cell = document.createElement('td');
        cell.textContent = v;
        Object.assign(cell.style, { padding: '4px 6px', borderBottom: '1px solid #222', color: '#ccc' });
        row.appendChild(cell);
      }
      const tCell = document.createElement('td');
      tCell.textContent = trendStr;
      Object.assign(tCell.style, { padding: '4px 6px', borderBottom: '1px solid #222', color: trendColor, fontWeight: 'bold' });
      row.appendChild(tCell);
      table.appendChild(row);
    }
    content.appendChild(table);

    // Price history chart (SVG sparkline per city)
    const chartTitle = document.createElement('h4');
    chartTitle.textContent = 'Price History';
    Object.assign(chartTitle.style, { color: '#d4af37', margin: '8px 0 6px' });
    content.appendChild(chartTitle);

    const cityColors = ['#4ecdc4', '#ff6b6b', '#ffe66d', '#a29bfe', '#fd79a8', '#55efc4', '#74b9ff', '#ffeaa7'];

    for (let ci = 0; ci < visitedCities.length; ci++) {
      const city = visitedCities[ci];
      const history = city.priceHistory?.[itemKey];
      if (!history || history.length < 2) continue;

      const chartRow = document.createElement('div');
      Object.assign(chartRow.style, { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' });
      content.appendChild(chartRow);

      const label = document.createElement('span');
      label.textContent = city.name;
      Object.assign(label.style, { fontSize: '11px', color: cityColors[ci % cityColors.length], width: '80px', flexShrink: '0' });
      chartRow.appendChild(label);

      // SVG sparkline
      const svgW = 300, svgH = 40;
      const minVal = Math.min(...history);
      const maxVal = Math.max(...history);
      const range = maxVal - minVal || 1;
      const points = history.map((v, i) => {
        const x = (i / (history.length - 1)) * svgW;
        const y = svgH - ((v - minVal) / range) * (svgH - 4) - 2;
        return `${x},${y}`;
      }).join(' ');

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', svgW);
      svg.setAttribute('height', svgH);
      svg.style.background = '#111';
      svg.style.borderRadius = '4px';

      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('points', points);
      polyline.setAttribute('fill', 'none');
      polyline.setAttribute('stroke', cityColors[ci % cityColors.length]);
      polyline.setAttribute('stroke-width', '2');
      svg.appendChild(polyline);

      chartRow.appendChild(svg);

      // Current value
      const val = document.createElement('span');
      val.textContent = `${history[history.length - 1]}g`;
      Object.assign(val.style, { fontSize: '11px', color: '#aaa', width: '50px' });
      chartRow.appendChild(val);
    }
  }

  // Populate sidebar
  for (const [itemKey, itemData] of nonBookItems) {
    const btn = document.createElement('div');
    btn.textContent = itemData.name;
    Object.assign(btn.style, {
      padding: '6px 8px', margin: '2px 0', borderRadius: '4px', cursor: 'pointer',
      fontSize: '12px', color: '#ccc', background: '#1a1a2e',
    });
    btn.onmouseenter = () => btn.style.background = '#2a2a4a';
    btn.onmouseleave = () => btn.style.background = '#1a1a2e';
    btn.onclick = () => showItemPage(itemKey, itemData);
    sidebar.appendChild(btn);
  }

  // Show first item by default
  if (nonBookItems.length > 0) {
    showItemPage(nonBookItems[0][0], nonBookItems[0][1]);
  }
}

// ───────────────────────────────────────────────────
//  HOLIDAYS ALMANAC BOOK
// ───────────────────────────────────────────────────
function showHolidaysBook() {
  const { overlay, popup } = _createBookOverlay("Holidays Almanac", "🎉");
  const visitedCities = (typeof cities !== 'undefined') ? cities : [];
  const currentDay = (typeof dayNight !== 'undefined') ? dayNight.getDaysElapsed() % 100 : 0;
  const currentDayAbs = (typeof dayNight !== 'undefined') ? dayNight.getDaysElapsed() : 0;

  // Find the next holiday globally
  let nextGlobal = null;
  let nextGlobalCity = null;
  let nextGlobalDays = Infinity;

  for (const city of visitedCities) {
    if (!city.holidays) continue;
    for (const h of city.holidays) {
      let daysUntil = h.day - currentDay;
      if (daysUntil < 0) daysUntil += 100; // wraps to next year
      if (daysUntil < nextGlobalDays) {
        nextGlobalDays = daysUntil;
        nextGlobal = h;
        nextGlobalCity = city;
      }
    }
    // Also check book holidays
    if (city.bookHolidays) {
      for (const bh of city.bookHolidays) {
        let daysUntil = bh.day - currentDay;
        if (daysUntil < 0) daysUntil += 100;
        if (daysUntil < nextGlobalDays) {
          nextGlobalDays = daysUntil;
          nextGlobal = bh;
          nextGlobalCity = city;
        }
      }
    }
  }

  // Banner: next holiday anywhere
  if (nextGlobal && nextGlobalCity) {
    const banner = document.createElement('div');
    Object.assign(banner.style, {
      background: 'linear-gradient(135deg, #2a1a3e, #1a2a3e)', padding: '12px 16px',
      borderRadius: '8px', marginBottom: '16px', border: '1px solid #4a3a6a',
    });
    const boosted = nextGlobal.item ? ItemLibrary[nextGlobal.item]?.name || nextGlobal.item :
                    nextGlobal.bookKey ? ItemLibrary[nextGlobal.bookKey]?.name || nextGlobal.bookKey : '?';
    const isBookHoliday = !!nextGlobal.bookKey;
    banner.innerHTML = `
      <div style="font-size:14px;color:#d4af37;font-weight:bold;margin-bottom:4px">⭐ Next Holiday Anywhere</div>
      <div style="font-size:13px;color:#fff">${nextGlobal.name} in <b>${nextGlobalCity.name}</b></div>
      <div style="font-size:12px;color:#aaa;margin-top:2px">
        Day ${nextGlobal.day} • ${nextGlobal.season} • In ${nextGlobalDays} day${nextGlobalDays !== 1 ? 's' : ''}
        ${isBookHoliday ? `<br><span style="color:#8b9dc3">📚 ${Math.round((nextGlobal.discount || 0.3) * 100)}% off ${boosted}</span>` : `<br>Boosts: <span style="color:#4ecdc4">${boosted}</span> prices ×1.5`}
      </div>`;
    popup.appendChild(banner);
  }

  // Per-city holiday listings
  for (const city of visitedCities) {
    const allHolidays = [
      ...(city.holidays || []).map(h => ({ ...h, type: 'item' })),
      ...(city.bookHolidays || []).map(bh => ({ ...bh, type: 'book' })),
    ];
    if (allHolidays.length === 0) continue;

    // Sort by distance from currentDay
    allHolidays.sort((a, b) => {
      let da = a.day - currentDay; if (da < 0) da += 100;
      let db = b.day - currentDay; if (db < 0) db += 100;
      return da - db;
    });

    const section = document.createElement('div');
    Object.assign(section.style, { marginBottom: '14px' });
    popup.appendChild(section);

    const cityHeader = document.createElement('h4');
    cityHeader.textContent = `🏘️ ${city.name}`;
    Object.assign(cityHeader.style, { color: '#c8d6e5', margin: '0 0 6px' });
    section.appendChild(cityHeader);

    for (const h of allHolidays) {
      let daysUntil = h.day - currentDay;
      if (daysUntil < 0) daysUntil += 100;

      const row = document.createElement('div');
      const isActive = daysUntil === 0;
      const bg = h.type === 'book' ? '#1a1a2e' : '#222';
      const border = isActive ? '2px solid #d4af37' : h.type === 'book' ? '1px solid #4a4a7a' : '1px solid #333';
      Object.assign(row.style, {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: bg, padding: '6px 10px', borderRadius: '6px', margin: '3px 0', border,
      });

      const left = document.createElement('div');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = h.name || 'Festival';
      Object.assign(nameSpan.style, { color: '#fff', fontSize: '12px', fontWeight: isActive ? 'bold' : 'normal' });
      left.appendChild(nameSpan);

      if (h.type === 'item' && h.item) {
        const boostSpan = document.createElement('span');
        boostSpan.textContent = ` → ${ItemLibrary[h.item]?.name || h.item} ×1.5`;
        Object.assign(boostSpan.style, { color: '#4ecdc4', fontSize: '11px' });
        left.appendChild(boostSpan);
      } else if (h.type === 'book' && h.bookKey) {
        const discountSpan = document.createElement('span');
        discountSpan.textContent = ` → ${ItemLibrary[h.bookKey]?.name || h.bookKey} ${Math.round((h.discount || 0.3) * 100)}% off`;
        Object.assign(discountSpan.style, { color: '#8b9dc3', fontSize: '11px' });
        left.appendChild(discountSpan);
      }
      row.appendChild(left);

      const right = document.createElement('span');
      right.textContent = isActive ? '🎆 TODAY!' : `Day ${h.day} • ${h.season} • in ${daysUntil}d`;
      Object.assign(right.style, { color: isActive ? '#d4af37' : '#888', fontSize: '11px' });
      row.appendChild(right);

      section.appendChild(row);
    }
  }
}

// ───────────────────────────────────────────────────
//  NEGOTIATION FOR DUMMIES BOOK
// ───────────────────────────────────────────────────
function showNegotiationBook() {
  const { overlay, popup } = _createBookOverlay("Negotiation for Dummies", "🤝");
  const bookData = ItemLibrary['NegotiationForDummies'];
  const discount = player.modifiers?.negotiationDiscount || 0;

  const desc = document.createElement('p');
  desc.textContent = bookData?.bookDescription || '';
  Object.assign(desc.style, { color: '#aaa', fontSize: '13px', lineHeight: '1.5', margin: '0 0 16px' });
  popup.appendChild(desc);

  // Active effects panel
  const effectBox = document.createElement('div');
  Object.assign(effectBox.style, {
    background: '#0d0d1a', border: '1px solid #333', borderRadius: '8px',
    padding: '14px', marginBottom: '12px',
  });
  popup.appendChild(effectBox);

  const effectTitle = document.createElement('h4');
  effectTitle.textContent = '📈 Active Effects';
  Object.assign(effectTitle.style, { color: '#4ecdc4', margin: '0 0 8px' });
  effectBox.appendChild(effectTitle);

  const effects = [
    { label: 'Buy Price Discount', value: `${(discount * 100).toFixed(0)}%`, color: '#4CAF50' },
    { label: 'Sell Price Bonus', value: `+${(discount * 100).toFixed(0)}%`, color: '#4CAF50' },
  ];

  for (const eff of effects) {
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', justifyContent: 'space-between', padding: '4px 0' });
    const lbl = document.createElement('span');
    lbl.textContent = eff.label;
    Object.assign(lbl.style, { color: '#aaa', fontSize: '13px' });
    row.appendChild(lbl);
    const val = document.createElement('span');
    val.textContent = eff.value;
    Object.assign(val.style, { color: eff.color, fontSize: '13px', fontWeight: 'bold' });
    row.appendChild(val);
    effectBox.appendChild(row);
  }

  // Example savings
  const exampleBox = document.createElement('div');
  Object.assign(exampleBox.style, { background: '#1a2a1a', border: '1px solid #2a4a2a', borderRadius: '8px', padding: '12px' });
  popup.appendChild(exampleBox);
  const exTitle = document.createElement('h4');
  exTitle.textContent = '💡 Example Savings';
  Object.assign(exTitle.style, { color: '#8bc34a', margin: '0 0 8px' });
  exampleBox.appendChild(exTitle);
  const exText = document.createElement('p');
  exText.innerHTML = `On a 100g item: Buy for <b style="color:#4ecdc4">${Math.floor(100 * (1 - discount))}g</b> instead of 100g<br>` +
    `Sell for <b style="color:#4ecdc4">${Math.ceil(80 * (1 + discount))}g</b> instead of 80g`;
  Object.assign(exText.style, { color: '#ccc', fontSize: '12px', margin: '0', lineHeight: '1.6' });
  exampleBox.appendChild(exText);
}

// ───────────────────────────────────────────────────
//  CONFLICT RESOLUTION BOOK
// ───────────────────────────────────────────────────
function showConflictResolutionBook() {
  const { overlay, popup } = _createBookOverlay("Conflict Resolution", "🕊️");
  const bookData = ItemLibrary['ConflictResolution'];
  const bribeReduction = player.modifiers?.bribeCostReduction || 0;
  const cooldownBonus = player.modifiers?.bribeCooldownBonus || 0;

  const desc = document.createElement('p');
  desc.textContent = bookData?.bookDescription || '';
  Object.assign(desc.style, { color: '#aaa', fontSize: '13px', lineHeight: '1.5', margin: '0 0 16px' });
  popup.appendChild(desc);

  // Active effects panel
  const effectBox = document.createElement('div');
  Object.assign(effectBox.style, {
    background: '#0d0d1a', border: '1px solid #333', borderRadius: '8px',
    padding: '14px', marginBottom: '12px',
  });
  popup.appendChild(effectBox);

  const effectTitle = document.createElement('h4');
  effectTitle.textContent = '🛡️ Active Effects';
  Object.assign(effectTitle.style, { color: '#4ecdc4', margin: '0 0 8px' });
  effectBox.appendChild(effectTitle);

  const effects = [
    { label: 'Bribe Cost Reduction', value: `${(bribeReduction * 100).toFixed(0)}%`, color: '#4CAF50' },
    { label: 'Extra Cooldown After Bribe', value: `+${cooldownBonus} days`, color: '#4CAF50' },
    { label: 'Bribe Cooldown (Total)', value: `${3 + cooldownBonus} days (was 3)`, color: '#8bc34a' },
    { label: 'Post-Loss Cooldown (Total)', value: `${2 + cooldownBonus} days (was 2)`, color: '#8bc34a' },
  ];

  for (const eff of effects) {
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', justifyContent: 'space-between', padding: '4px 0' });
    const lbl = document.createElement('span');
    lbl.textContent = eff.label;
    Object.assign(lbl.style, { color: '#aaa', fontSize: '13px' });
    row.appendChild(lbl);
    const val = document.createElement('span');
    val.textContent = eff.value;
    Object.assign(val.style, { color: eff.color, fontSize: '13px', fontWeight: 'bold' });
    row.appendChild(val);
    effectBox.appendChild(row);
  }

  // Flavor text
  const flavorBox = document.createElement('div');
  Object.assign(flavorBox.style, { background: '#2a1a1a', border: '1px solid #4a2a2a', borderRadius: '8px', padding: '12px', marginTop: '10px' });
  popup.appendChild(flavorBox);
  const flavorText = document.createElement('p');
  flavorText.innerHTML = `<i>"Violence is the last refuge of the incompetent."</i><br><br>` +
    `When raiders demand a toll, your diplomatic training helps you negotiate lower bribes. ` +
    `After paying, the raider will leave you alone for <b>${3 + cooldownBonus}</b> days instead of the usual 3.`;
  Object.assign(flavorText.style, { color: '#c8a0a0', fontSize: '12px', margin: '0', lineHeight: '1.5' });
  flavorBox.appendChild(flavorText);
}

// ═══════════════════════════════════════════════════════
//  NEW SERVICE SCREENS (Bounty Board, Bank, Gambling, Black Market)
// ═══════════════════════════════════════════════════════

// --- Helper: standard overlay with close button ---
function _createServiceOverlay(title, emoji) {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
    background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 10000,
  });
  document.body.appendChild(overlay);

  const popup = document.createElement('div');
  Object.assign(popup.style, {
    background: '#0d0f1a', border: '2px solid #d4af37', borderRadius: '12px',
    padding: '20px', maxWidth: '550px', width: '90%', maxHeight: '80vh',
    overflowY: 'auto', color: '#fff', fontFamily: 'monospace',
  });
  overlay.appendChild(popup);

  const header = document.createElement('h2');
  header.textContent = `${emoji} ${title}`;
  Object.assign(header.style, { color: '#d4af37', margin: '0 0 16px', textAlign: 'center' });
  popup.appendChild(header);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ Close';
  Object.assign(closeBtn.style, {
    position: 'absolute', top: '10px', right: '10px', background: '#333',
    color: '#fff', border: '1px solid #555', padding: '6px 12px', borderRadius: '4px',
    cursor: 'pointer', fontSize: '12px',
  });
  popup.style.position = 'relative';
  popup.appendChild(closeBtn);
  closeBtn.onclick = () => {
    overlay.remove();
    gameStateManager.setState(GameStates.PLAYING);
  };

  return { overlay, popup };
}

// ═══════════════════════════════════════
//  BOUNTY BOARD SCREEN
// ═══════════════════════════════════════
uiManager.registerScreen("bountyBoardView", {
  validStates: [GameStates.BOUNTY_BOARD],

  create: () => {
    return createDiv().id("bountyBoardView").class("screen").style("display", "none");
  },

  show: () => {
    const city = window._currentServiceCity;
    if (!city || typeof bountyBoard === 'undefined') return;

    // Remove old overlay
    document.getElementById('bountyBoardOverlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'bountyBoardOverlay';
    Object.assign(overlay.style, {
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 10000,
    });
    document.body.appendChild(overlay);

    const popup = document.createElement('div');
    Object.assign(popup.style, {
      background: '#0d0f1a', border: '2px solid #d4af37', borderRadius: '12px',
      padding: '20px', maxWidth: '550px', width: '90%', maxHeight: '80vh',
      overflowY: 'auto', color: '#fff', fontFamily: 'monospace', position: 'relative',
    });
    overlay.appendChild(popup);

    const header = document.createElement('h2');
    header.textContent = `📜 Bounty Board — ${city.name}`;
    Object.assign(header.style, { color: '#d4af37', margin: '0 0 16px', textAlign: 'center' });
    popup.appendChild(header);

    // Generate bounties for this city
    const activeBounties = bountyBoard.getBountiesForCity(city.name);
    const claimable = bountyBoard.claimable || [];
    const bounties = [...activeBounties];

    // Show claimable bounties section first
    if (claimable.length > 0) {
      const claimTitle = document.createElement('h4');
      claimTitle.textContent = '💰 Ready to Collect';
      Object.assign(claimTitle.style, { color: '#4caf50', margin: '0 0 8px' });
      popup.appendChild(claimTitle);

      for (const b of claimable) {
        const card = document.createElement('div');
        Object.assign(card.style, {
          background: '#1a2e1a', padding: '12px', borderRadius: '8px',
          marginBottom: '8px', borderLeft: '4px solid #4caf50',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        });
        popup.appendChild(card);

        const info = document.createElement('span');
        info.textContent = `${b.isBoss ? '💀' : '🗡️'} ${b.name} — ${b.reward}g`;
        Object.assign(info.style, { color: '#4caf50', fontWeight: 'bold', fontSize: '14px' });
        card.appendChild(info);

        const collectBtn = document.createElement('button');
        collectBtn.textContent = `Collect ${b.reward}g`;
        Object.assign(collectBtn.style, {
          background: '#4caf50', color: '#fff', border: 'none', padding: '6px 12px',
          borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px',
        });
        card.appendChild(collectBtn);
        collectBtn.onclick = () => {
          bountyBoard.collectBounty(b.id);
          uiManager.screens["bountyBoardView"].show(); // refresh
        };
      }
    }

    if (bounties.length === 0) {
      const p = document.createElement('p');
      p.textContent = 'No bounties available in this city right now.';
      Object.assign(p.style, { color: '#666', textAlign: 'center' });
      popup.appendChild(p);
    }

    for (const b of bounties) {
      const card = document.createElement('div');
      Object.assign(card.style, {
        background: '#1a1a2e', padding: '12px', borderRadius: '8px',
        marginBottom: '8px', borderLeft: b.isBoss ? '4px solid #f44336' : '4px solid #ff9800',
      });
      popup.appendChild(card);

      const topRow = document.createElement('div');
      Object.assign(topRow.style, { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' });
      card.appendChild(topRow);

      const name = document.createElement('span');
      name.textContent = `${b.isBoss ? '💀' : '🗡️'} ${b.name}`;
      Object.assign(name.style, { color: b.isBoss ? '#f44336' : '#ff9800', fontWeight: 'bold', fontSize: '14px' });
      topRow.appendChild(name);

      const reward = document.createElement('span');
      reward.textContent = `${b.reward}g`;
      Object.assign(reward.style, { color: '#d4af37', fontWeight: 'bold', fontSize: '14px' });
      topRow.appendChild(reward);

      const desc = document.createElement('div');
      desc.textContent = `${b.type.toUpperCase()} — Last seen near ${b.lastKnownTerrain}. Deadline: day ${b.deadline}.`;
      Object.assign(desc.style, { color: '#aaa', fontSize: '12px' });
      card.appendChild(desc);
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '← Back to City';
    Object.assign(closeBtn.style, {
      background: '#333', color: '#fff', border: '1px solid #555', padding: '10px 20px',
      borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginTop: '12px', width: '100%',
    });
    popup.appendChild(closeBtn);
    closeBtn.onclick = () => {
      overlay.remove();
      gameStateManager.setState(GameStates.PLAYING);
    };
  },

  hide: () => {
    document.getElementById('bountyBoardOverlay')?.remove();
  },

  update: () => {}
});

// ═══════════════════════════════════════
//  BANK SCREEN
// ═══════════════════════════════════════
uiManager.registerScreen("bankView", {
  validStates: [GameStates.BANK],

  create: () => {
    return createDiv().id("bankView").class("screen").style("display", "none");
  },

  show: () => {
    const city = window._currentServiceCity;
    if (!city || typeof bankingSystem === 'undefined') return;

    document.getElementById('bankOverlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'bankOverlay';
    Object.assign(overlay.style, {
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 10000,
    });
    document.body.appendChild(overlay);

    const popup = document.createElement('div');
    Object.assign(popup.style, {
      background: '#0d0f1a', border: '2px solid #d4af37', borderRadius: '12px',
      padding: '20px', maxWidth: '550px', width: '90%', maxHeight: '80vh',
      overflowY: 'auto', color: '#fff', fontFamily: 'monospace', position: 'relative',
    });
    overlay.appendChild(popup);

    const header = document.createElement('h2');
    header.textContent = `🏦 Bank of ${city.name}`;
    Object.assign(header.style, { color: '#d4af37', margin: '0 0 16px', textAlign: 'center' });
    popup.appendChild(header);

    // Balance info
    const balBox = document.createElement('div');
    Object.assign(balBox.style, {
      background: '#111', padding: '12px', borderRadius: '8px', marginBottom: '12px',
      display: 'flex', justifyContent: 'space-around', textAlign: 'center',
    });
    popup.appendChild(balBox);

    const addStat = (label, value, color) => {
      const col = document.createElement('div');
      const lbl = document.createElement('div');
      lbl.textContent = label;
      Object.assign(lbl.style, { color: '#888', fontSize: '11px', marginBottom: '4px' });
      col.appendChild(lbl);
      const val = document.createElement('div');
      val.textContent = value;
      Object.assign(val.style, { color: color || '#fff', fontSize: '16px', fontWeight: 'bold' });
      col.appendChild(val);
      balBox.appendChild(col);
    };

    addStat('Your Gold', `${player.gold}g`, '#d4af37');
    addStat('Deposited', `${bankingSystem.deposits || 0}g`, '#4caf50');
    addStat('Loan Owed', `${bankingSystem.loanAmount || 0}g`, bankingSystem.loanAmount > 0 ? '#f44336' : '#666');

    // --- Deposit/Withdraw ---
    const depSection = document.createElement('div');
    Object.assign(depSection.style, { marginBottom: '12px' });
    popup.appendChild(depSection);

    const depTitle = document.createElement('h4');
    depTitle.textContent = '💰 Deposits (1% weekly interest)';
    Object.assign(depTitle.style, { color: '#4caf50', margin: '0 0 8px' });
    depSection.appendChild(depTitle);

    const depRow = document.createElement('div');
    Object.assign(depRow.style, { display: 'flex', gap: '8px' });
    depSection.appendChild(depRow);

    const depInput = document.createElement('input');
    depInput.type = 'number';
    depInput.placeholder = 'Amount';
    depInput.min = 1;
    depInput.max = Math.max(0, player.gold - 1);
    depInput.value = Math.min(100, Math.max(0, player.gold - 1));
    Object.assign(depInput.style, {
      background: '#1a1a2e', color: '#fff', border: '1px solid #444',
      padding: '8px', borderRadius: '4px', flex: 1, fontSize: '13px',
    });
    depRow.appendChild(depInput);

    const depBtn = document.createElement('button');
    depBtn.textContent = 'Deposit';
    Object.assign(depBtn.style, {
      background: '#4caf50', color: '#fff', border: 'none', padding: '8px 16px',
      borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold',
    });
    depRow.appendChild(depBtn);
    depBtn.onclick = () => {
      const amt = parseInt(depInput.value);
      if (amt > 0) {
        bankingSystem.deposit(amt);
        uiManager.screens["bankView"].show();
      }
    };

    const wdBtn = document.createElement('button');
    wdBtn.textContent = 'Withdraw';
    Object.assign(wdBtn.style, {
      background: '#ff9800', color: '#fff', border: 'none', padding: '8px 16px',
      borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold',
    });
    depRow.appendChild(wdBtn);
    wdBtn.onclick = () => {
      const amt = parseInt(depInput.value);
      if (amt > 0) {
        bankingSystem.withdraw(amt);
        uiManager.screens["bankView"].show();
      }
    };

    // --- Loans ---
    const loanSection = document.createElement('div');
    Object.assign(loanSection.style, { marginBottom: '12px' });
    popup.appendChild(loanSection);

    const loanTitle = document.createElement('h4');
    loanTitle.textContent = '📝 Loans (8% weekly interest)';
    Object.assign(loanTitle.style, { color: '#f44336', margin: '0 0 8px' });
    loanSection.appendChild(loanTitle);

    if (bankingSystem.loanAmount > 0) {
      const loanInfo = document.createElement('div');
      loanInfo.textContent = `Current loan: ${bankingSystem.loanAmount}g (Week ${bankingSystem.loanWeeks || 0}/3 until default)`;
      Object.assign(loanInfo.style, { color: '#f88', fontSize: '12px', marginBottom: '8px' });
      loanSection.appendChild(loanInfo);

      const repayBtn = document.createElement('button');
      const repayAmt = Math.min(player.gold, bankingSystem.loanAmount);
      repayBtn.textContent = `Repay ${repayAmt}g`;
      Object.assign(repayBtn.style, {
        background: '#f44336', color: '#fff', border: 'none', padding: '8px 16px',
        borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold',
      });
      loanSection.appendChild(repayBtn);
      repayBtn.onclick = () => {
        bankingSystem.repayLoan(repayAmt);
        uiManager.screens["bankView"].show();
      };
    } else {
      const loanRow = document.createElement('div');
      Object.assign(loanRow.style, { display: 'flex', gap: '8px' });
      loanSection.appendChild(loanRow);

      for (const amt of [100, 250, 500]) {
        const btn = document.createElement('button');
        btn.textContent = `Borrow ${amt}g`;
        Object.assign(btn.style, {
          background: '#333', color: '#fff', border: '1px solid #555', padding: '8px 12px',
          borderRadius: '4px', cursor: 'pointer', fontSize: '12px', flex: 1,
        });
        loanRow.appendChild(btn);
        btn.onclick = () => {
          bankingSystem.takeLoan(amt);
          uiManager.screens["bankView"].show();
        };
      }
    }

    // --- Investments ---
    const invSection = document.createElement('div');
    Object.assign(invSection.style, { marginBottom: '12px' });
    popup.appendChild(invSection);

    const invTitle = document.createElement('h4');
    invTitle.textContent = '📈 Investments (10-20 day maturity)';
    Object.assign(invTitle.style, { color: '#4fc3f7', margin: '0 0 8px' });
    invSection.appendChild(invTitle);

    const activeInv = bankingSystem.investments || [];
    if (activeInv.length > 0) {
      for (const inv of activeInv) {
        const row = document.createElement('div');
        Object.assign(row.style, {
          background: '#0a1929', padding: '8px', borderRadius: '4px',
          marginBottom: '4px', display: 'flex', justifyContent: 'space-between',
        });
        invSection.appendChild(row);
        const left = document.createElement('span');
        const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;
        const daysLeft = Math.max(0, (inv.startDay + inv.durationDays) - day);
        left.textContent = `${inv.cityName}: ${inv.amount}g invested`;
        Object.assign(left.style, { color: '#4fc3f7', fontSize: '12px' });
        row.appendChild(left);
        const right = document.createElement('span');
        right.textContent = inv.matured ? '✅ Matured!' : `${daysLeft} days left`;
        Object.assign(right.style, { color: inv.matured ? '#4caf50' : '#aaa', fontSize: '12px' });
        row.appendChild(right);
      }
    }

    const investBtn = document.createElement('button');
    investBtn.textContent = 'Invest 100g in Trade Route';
    Object.assign(investBtn.style, {
      background: '#0a1929', color: '#4fc3f7', border: '1px solid #4fc3f7', padding: '8px 16px',
      borderRadius: '4px', cursor: 'pointer', fontSize: '12px', width: '100%',
    });
    invSection.appendChild(investBtn);
    investBtn.onclick = () => {
      if (player.gold >= 100) {
        bankingSystem.invest(city.name, 100);
        uiManager.screens["bankView"].show();
      } else {
        if (typeof notificationManager !== 'undefined') notificationManager.log('Not enough gold to invest.', 'warning');
      }
    };

    // --- Insurance ---
    const insSection = document.createElement('div');
    Object.assign(insSection.style, { marginBottom: '12px' });
    popup.appendChild(insSection);

    const insTitle = document.createElement('h4');
    insTitle.textContent = '🛡️ Insurance (10% premium, 70% payout)';
    Object.assign(insTitle.style, { color: '#9c27b0', margin: '0 0 8px' });
    insSection.appendChild(insTitle);

    if (bankingSystem.insuranceActive) {
      const insInfo = document.createElement('div');
      insInfo.textContent = `Policy active! Coverage: ${bankingSystem.insuranceCoverage || 0}g — ${bankingSystem.insuranceDaysLeft || 0} days remaining`;
      Object.assign(insInfo.style, { color: '#ce93d8', fontSize: '12px' });
      insSection.appendChild(insInfo);
    } else {
      const insBtn = document.createElement('button');
      // Calculate cargo value the same way purchaseInsurance() does
      let cargoVal = 0;
      if (typeof player !== 'undefined') {
        for (const [key, entry] of player.inventory) {
          const lib = typeof ItemLibrary !== 'undefined' ? ItemLibrary[key] : null;
          if (lib && !lib.tags?.has('book')) cargoVal += (lib.baseValue || 10) * entry.quantity;
        }
      }
      const premium = Math.floor(cargoVal * 0.10);
      insBtn.textContent = cargoVal > 0 ? `Buy Insurance (${premium}g premium, covers ${cargoVal}g cargo)` : 'No insurable cargo';
      if (cargoVal <= 0) insBtn.disabled = true;
      Object.assign(insBtn.style, {
        background: '#333', color: '#ce93d8', border: '1px solid #9c27b0', padding: '8px 16px',
        borderRadius: '4px', cursor: 'pointer', fontSize: '12px', width: '100%',
      });
      insSection.appendChild(insBtn);
      insBtn.onclick = () => {
        bankingSystem.purchaseInsurance();
        uiManager.screens["bankView"].show();
      };
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '← Back to City';
    Object.assign(closeBtn.style, {
      background: '#333', color: '#fff', border: '1px solid #555', padding: '10px 20px',
      borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginTop: '8px', width: '100%',
    });
    popup.appendChild(closeBtn);
    closeBtn.onclick = () => {
      overlay.remove();
      gameStateManager.setState(GameStates.PLAYING);
    };
  },

  hide: () => {
    document.getElementById('bankOverlay')?.remove();
  },

  update: () => {}
});

// ═══════════════════════════════════════
//  GAMBLING DEN SCREEN
// ═══════════════════════════════════════
uiManager.registerScreen("gamblingView", {
  validStates: [GameStates.GAMBLING],

  create: () => {
    return createDiv().id("gamblingView").class("screen").style("display", "none");
  },

  show: () => {
    const city = window._currentServiceCity;
    if (!city) return;

    document.getElementById('gamblingOverlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gamblingOverlay';
    Object.assign(overlay.style, {
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 10000,
    });
    document.body.appendChild(overlay);

    const popup = document.createElement('div');
    Object.assign(popup.style, {
      background: '#0d0f1a', border: '2px solid #d4af37', borderRadius: '12px',
      padding: '20px', maxWidth: '500px', width: '90%', maxHeight: '80vh',
      overflowY: 'auto', color: '#fff', fontFamily: 'monospace', position: 'relative',
    });
    overlay.appendChild(popup);

    const header = document.createElement('h2');
    header.textContent = `🎲 Gambling Den — ${city.name}`;
    Object.assign(header.style, { color: '#d4af37', margin: '0 0 16px', textAlign: 'center' });
    popup.appendChild(header);

    const goldInfo = document.createElement('div');
    goldInfo.textContent = `Your Gold: ${player.gold}g`;
    Object.assign(goldInfo.style, { color: '#d4af37', textAlign: 'center', fontSize: '14px', marginBottom: '16px' });
    popup.appendChild(goldInfo);

    const games = [
      { name: '🎲 Dice Poker', desc: 'Roll 5 dice, make poker hands. Bet and play!', minBet: 20, id: 'dicePoker' },
      { name: '🧠 Memory Match', desc: 'Match pairs of cards. Win prizes for a sharp memory!', minBet: 15, id: 'memoryMatch' },
      { name: '🎡 Wheel of Fortune', desc: 'Spin the wheel and pray to the gods of luck!', minBet: 10, id: 'wheelOfFortune' },
    ];

    for (const game of games) {
      const card = document.createElement('div');
      Object.assign(card.style, {
        background: '#1a1a2e', padding: '14px', borderRadius: '8px',
        marginBottom: '10px', borderLeft: '4px solid #d4af37',
      });
      popup.appendChild(card);

      const title = document.createElement('div');
      title.textContent = game.name;
      Object.assign(title.style, { color: '#fff', fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' });
      card.appendChild(title);

      const desc = document.createElement('div');
      desc.textContent = game.desc;
      Object.assign(desc.style, { color: '#888', fontSize: '12px', marginBottom: '8px' });
      card.appendChild(desc);

      const betRow = document.createElement('div');
      Object.assign(betRow.style, { display: 'flex', gap: '8px', alignItems: 'center' });
      card.appendChild(betRow);

      const betLabel = document.createElement('span');
      betLabel.textContent = `Min bet: ${game.minBet}g`;
      Object.assign(betLabel.style, { color: '#aaa', fontSize: '11px' });
      betRow.appendChild(betLabel);

      const playBtn = document.createElement('button');
      playBtn.textContent = `Play (${game.minBet}g)`;
      Object.assign(playBtn.style, {
        background: '#d4af37', color: '#000', border: 'none', padding: '8px 16px',
        borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px',
        marginLeft: 'auto',
      });
      betRow.appendChild(playBtn);

      playBtn.onclick = () => {
        if (player.gold < game.minBet) {
          if (typeof notificationManager !== 'undefined') notificationManager.log('Not enough gold!', 'warning');
          return;
        }
        // Gold is deducted inside the gambling system methods — don't double-charge
        overlay.remove();

        if (typeof gamblingSystem !== 'undefined') {
          if (game.id === 'dicePoker') {
            gamblingSystem.playDicePoker(game.minBet);
          } else if (game.id === 'memoryMatch') {
            gamblingSystem.playMemoryMatch();
          } else if (game.id === 'wheelOfFortune') {
            gamblingSystem.playWheelOfFortune(game.minBet);
          }
        }
      };
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '← Back to City';
    Object.assign(closeBtn.style, {
      background: '#333', color: '#fff', border: '1px solid #555', padding: '10px 20px',
      borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginTop: '8px', width: '100%',
    });
    popup.appendChild(closeBtn);
    closeBtn.onclick = () => {
      overlay.remove();
      gameStateManager.setState(GameStates.PLAYING);
    };
  },

  hide: () => {
    document.getElementById('gamblingOverlay')?.remove();
  },

  update: () => {}
});

// ═══════════════════════════════════════
//  BLACK MARKET SCREEN
// ═══════════════════════════════════════
uiManager.registerScreen("blackMarketView", {
  validStates: [GameStates.BLACK_MARKET],

  create: () => {
    return createDiv().id("blackMarketView").class("screen").style("display", "none");
  },

  show: () => {
    const city = window._currentServiceCity;
    if (!city || typeof smugglingSystem === 'undefined') return;

    document.getElementById('blackMarketOverlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'blackMarketOverlay';
    Object.assign(overlay.style, {
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 10000,
    });
    document.body.appendChild(overlay);

    const popup = document.createElement('div');
    Object.assign(popup.style, {
      background: '#0a0a14', border: '2px solid #666', borderRadius: '12px',
      padding: '20px', maxWidth: '550px', width: '90%', maxHeight: '80vh',
      overflowY: 'auto', color: '#fff', fontFamily: 'monospace', position: 'relative',
    });
    overlay.appendChild(popup);

    const header = document.createElement('h2');
    header.textContent = `🕶️ Black Market — ${city.name}`;
    Object.assign(header.style, { color: '#888', margin: '0 0 16px', textAlign: 'center' });
    popup.appendChild(header);

    const goldInfo = document.createElement('div');
    goldInfo.textContent = `Your Gold: ${player.gold}g`;
    Object.assign(goldInfo.style, { color: '#d4af37', textAlign: 'center', fontSize: '14px', marginBottom: '16px' });
    popup.appendChild(goldInfo);

    // --- Buy Contraband ---
    const buyTitle = document.createElement('h4');
    buyTitle.textContent = '🛒 Buy Contraband';
    Object.assign(buyTitle.style, { color: '#f44336', margin: '0 0 8px' });
    popup.appendChild(buyTitle);

    const catalogObj = typeof SmugglingSystem !== 'undefined' ? SmugglingSystem.getContrabandCatalog() : {};
    const contrabandCatalog = Object.entries(catalogObj).map(([key, v]) => ({ key, ...v }));

    for (const item of contrabandCatalog) {
      const libEntry = ItemLibrary[item.key];

      const row = document.createElement('div');
      Object.assign(row.style, {
        background: '#1a0a0a', padding: '10px', borderRadius: '6px',
        marginBottom: '6px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', borderLeft: '3px solid #f44336',
      });
      popup.appendChild(row);

      const info = document.createElement('div');
      const icon = item.emoji || ITEM_ICONS?.[item.key]?.emoji || '📦';
      const displayName = libEntry ? libEntry.name : item.name;
      info.innerHTML = `${icon} <strong>${displayName}</strong><br><span style="color:#888;font-size:11px">Buy: ${item.buyPrice}g | Sell: ${item.sellPrice}g</span>`;
      Object.assign(info.style, { color: '#fff', fontSize: '13px' });
      row.appendChild(info);

      const btnCol = document.createElement('div');
      Object.assign(btnCol.style, { display: 'flex', gap: '6px' });
      row.appendChild(btnCol);

      const buyBtn = document.createElement('button');
      buyBtn.textContent = `Buy`;
      Object.assign(buyBtn.style, {
        background: '#f44336', color: '#fff', border: 'none', padding: '6px 12px',
        borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
      });
      btnCol.appendChild(buyBtn);
      buyBtn.onclick = () => {
        smugglingSystem.buyContraband(item.key);
        uiManager.screens["blackMarketView"].show();
      };

      // Sell button — check smuggling cargo
      const hasCargo = smugglingSystem.smugglingCargo?.find(c => c.itemKey === item.key && c.quantity > 0);
      if (hasCargo) {
        const sellBtn = document.createElement('button');
        sellBtn.textContent = `Sell`;
        Object.assign(sellBtn.style, {
          background: '#4caf50', color: '#fff', border: 'none', padding: '6px 12px',
          borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
        });
        btnCol.appendChild(sellBtn);
        sellBtn.onclick = () => {
          smugglingSystem.sellContraband(item.key);
          uiManager.screens["blackMarketView"].show();
        };
      }
    }

    // ── Equipment section (bags) ──
    if (typeof BAGS !== 'undefined' && typeof ItemLibrary !== 'undefined') {
      const bagKeys = ['Pouch', 'TravelerBag', 'BargainSack', 'Chest'];
      // Pick 1-3 bags randomly (re-rolled each visit for variety)
      const availBags = bagKeys.filter(() => Math.random() < 0.6).slice(0, 3);
      if (availBags.length === 0) availBags.push('Pouch');

      const eqHeader = document.createElement('h3');
      eqHeader.textContent = '⚙️ Equipment';
      Object.assign(eqHeader.style, { color: '#aaa', margin: '16px 0 8px', fontSize: '14px', borderTop: '1px solid #333', paddingTop: '12px' });
      popup.appendChild(eqHeader);

      for (const bk of availBags) {
        const bagItem = ItemLibrary[bk];
        const bagData = BAGS[bk];
        if (!bagItem || !bagData) continue;
        const price = Math.floor(bagItem.baseValue * 1.3);
        const icon = ITEM_ICONS?.[bk]?.emoji || '🎒';

        const brow = document.createElement('div');
        Object.assign(brow.style, {
          background: '#0d1a2a', padding: '10px', borderRadius: '6px',
          marginBottom: '6px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', borderLeft: '3px solid #2196f3',
        });
        popup.appendChild(brow);

        const info = document.createElement('div');
        info.innerHTML = `${icon} <strong>${bagItem.name}</strong> <span style="color:#4fc3f7;font-size:11px">+${bagData.cargoBonus} cargo</span><br>`
          + `<span style="color:#888;font-size:11px">Buy: ${price}g &nbsp;|&nbsp; ${bagData.rarity}</span>`;
        Object.assign(info.style, { color: '#fff', fontSize: '13px' });
        brow.appendChild(info);

        const canAfford = player.gold >= price;
        const buyBagBtn = document.createElement('button');
        buyBagBtn.textContent = canAfford ? `Buy ${price}g` : `${price}g`;
        Object.assign(buyBagBtn.style, {
          background: canAfford ? '#1565c0' : '#333', color: canAfford ? '#fff' : '#888',
          border: 'none', padding: '6px 12px', borderRadius: '4px',
          cursor: canAfford ? 'pointer' : 'default', fontSize: '12px',
        });
        brow.appendChild(buyBagBtn);
        if (canAfford) {
          buyBagBtn.onclick = () => {
            if (player.gold < price) return;
            player.spendGold(price);
            player.addItem(bagItem, true);
            if (typeof notificationManager !== 'undefined') {
              notificationManager.log(`Bought ${bagItem.name} for ${price}g`, 'success');
            }
            uiManager.screens["blackMarketView"].show();
          };
        }
      }
    }

    // Warning
    const warn = document.createElement('div');
    warn.textContent = '⚠️ Carrying contraband increases checkpoint inspection chance!';
    Object.assign(warn.style, { color: '#f44336', fontSize: '11px', marginTop: '12px', textAlign: 'center' });
    popup.appendChild(warn);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '← Back to City';
    Object.assign(closeBtn.style, {
      background: '#333', color: '#fff', border: '1px solid #555', padding: '10px 20px',
      borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginTop: '12px', width: '100%',
    });
    popup.appendChild(closeBtn);
    closeBtn.onclick = () => {
      overlay.remove();
      gameStateManager.setState(GameStates.PLAYING);
    };
  },

  hide: () => {
    document.getElementById('blackMarketOverlay')?.remove();
  },

  update: () => {}
});


