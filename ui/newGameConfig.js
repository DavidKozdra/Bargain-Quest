// NEW GAME CONFIG (extracted from ui.js)
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
    window._newGameCityManageMode = false;

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
    window._newGameGracePeriod = 30;
    const graceRow = createDiv().addClass("cfg-row").parent(loadoutSection);
    createDiv().html("Grace Period").addClass("cfg-row-label").parent(graceRow);
    const graceInput = createElement("input").parent(graceRow).addClass("config-custom-input").style("max-width", "80px");
    graceInput.attribute("type", "number");
    graceInput.attribute("min", "0");
    graceInput.attribute("max", "120");
    graceInput.attribute("step", "1");
    graceInput.attribute("value", "30");
    graceInput.input(() => {
      const v = parseInt(graceInput.value());
      window._newGameGracePeriod = (!isNaN(v) && v >= 0) ? v : 30;
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

    // ── Game Mode ─────────────────────────────────────────
    const modeSection = createDiv().addClass("config-section").parent(advancedPanel);
    createElement("h3", "🏛️ Game Mode").parent(modeSection).style("margin-bottom", "10px");

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
