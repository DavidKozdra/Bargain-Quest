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

    createImg("./assets/images/logo.png", "Game Logo")
      .class("menu-logo")
      .parent(logoSection);

    createElement("h1", "BARGAIN QUEST")
      .class("main-title")
      .parent(logoSection);

    // Menu buttons section
    const buttonsSection = createDiv().class("menu-buttons");
    buttonsSection.parent(parent);

    createButton("New Game")
      .parent(buttonsSection)
      .addClass("menu-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.NEW_GAME_CONFIG);
      });

    const continueBtn = createButton("Continue")
      .parent(buttonsSection)
      .addClass("menu-btn")
      .mousePressed(() => {
        if (typeof loadExistingGame === 'function') {
          loadExistingGame();
        }
      });
    continueBtn.id("continueBtn");

    createButton("Settings")
      .parent(buttonsSection)
      .addClass("menu-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.SETTINGS);
      });

    createButton("Level Editor")
      .parent(buttonsSection)
      .addClass("menu-btn")
      .mousePressed(() => {
        if (!levelEditor) levelEditor = new LevelEditor();
        levelEditor.centreCamera();
        gameStateManager.setState(GameStates.LEVEL_EDITOR);
      });

    createButton("Quit Game")
      .parent(buttonsSection)
      .addClass("menu-btn")
      .mousePressed(() => {
        // close tab ? 
        if (confirm("Are you sure you want to quit?")) {
          
          // close this tab - note this may not work in all browsers due to security restrictions
          window.close();
          
        }


      });

  
    // Footer
    const footer = createP("v1.0 — A Merchant's Journey");
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
        // Sync slider
        const sl = select("#sizeSlider");
        if (sl) sl.value(preset.cols);
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

    sizeSlider.input(() => {
      const val = parseInt(sizeSlider.value());
      window._newGameMapCols = val;
      window._newGameMapRows = val;
      select("#sizeSliderVal")?.html(`${val} x ${val}`);
      // Deselect preset cards unless it matches one exactly
      selectAll(".size-card").forEach(c => {
        const cardCols = parseInt(c.attribute("data-cols"));
        if (cardCols === val) c.addClass("size-card-active");
        else c.removeClass("size-card-active");
      });
      updateMapSizeInfo();
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

    const citySlider = createSlider(5, 500, 0, 1)
      .id("citySlider")
      .addClass("size-slider")
      .parent(cityRow);
    createSpan("Auto").id("citySliderVal").addClass("size-slider-val").parent(cityRow);

    function getAutoCityCount() {
      const c = window._newGameMapCols;
      const r = window._newGameMapRows;
      return Math.max(5, Math.floor((c * r) / 300));
    }

    function updateCityDisplay() {
      const val = parseInt(citySlider.value());
      const valEl = select("#citySliderVal");
      if (val === 0 || val < 5) {
        window._newGameCityCount = 0;
        if (valEl) valEl.html(`Auto (~${getAutoCityCount()})`);
      } else {
        window._newGameCityCount = val;
        if (valEl) valEl.html(`${val} cities`);
      }
    }

    citySlider.input(() => updateCityDisplay());


    // ── Game Settings ─────────────────────────────────────
    const settingsSection = createDiv().addClass("config-section").parent(wrapper);
    createElement("h3", "World Config").parent(settingsSection).style("margin-bottom", "10px");

    const settingsGrid = createDiv().addClass("settings-grid").parent(settingsSection);

    // Radio-button group helper
    let _radioUid = 0;
    function makeRadioGroup(parentEl, label, groupName, options, defaultValue, onChange) {
      const card = createDiv().addClass("setting-card").parent(parentEl);
      createDiv().html(label).addClass("setting-card-label").parent(card);
      const radioWrap = createDiv().addClass("radio-group").parent(card);
      const customId = `custom_${groupName}_${_radioUid}`;
      for (const opt of options) {
        const id = `radio_${groupName}_${_radioUid++}`;
        const lbl = createElement("label").parent(radioWrap).addClass("radio-option");
        const inp = createElement("input").parent(lbl);
        inp.attribute("type", "radio");
        inp.attribute("name", groupName);
        inp.attribute("value", opt.value);
        inp.id(id);
        if (opt.label === defaultValue) inp.attribute("checked", "true");
        createSpan(`${opt.label} (${opt.value})`).parent(lbl).addClass("radio-label-text");
        inp.changed(() => {
          const ci = select('#' + customId);
          if (ci) ci.attribute("disabled", "true");
          onChange(opt.value);
        });
      }
      // Custom option
      const custLbl = createElement("label").parent(radioWrap).addClass("radio-option");
      const custInp = createElement("input").parent(custLbl);
      custInp.attribute("type", "radio");
      custInp.attribute("name", groupName);
      custInp.attribute("value", "custom");
      const custUid = `radio_${groupName}_${_radioUid++}`;
      custInp.id(custUid);
      createSpan("Custom").parent(custLbl).addClass("radio-label-text");
      const custNum = createElement("input").parent(card).addClass("config-custom-input");
      custNum.attribute("type", "number");
      custNum.attribute("step", "any");
      custNum.attribute("disabled", "true");
      custNum.id(customId);
      custNum.attribute("placeholder", "value");
      custInp.changed(() => {
        custNum.removeAttribute("disabled");
        const v = parseFloat(custNum.value());
        if (!isNaN(v)) onChange(v);
      });
      custNum.input(() => {
        const v = parseFloat(custNum.value());
        if (!isNaN(v)) onChange(v);
      });
    }

    // Store selections globally
    window._newGameEventChance = 0.10;
    window._newGameRaiderInterval = 60;
    window._newGameLandmass = 1;
    window._newGameCustomMap = null; // name of saved editor map, or null
    window._newGameGoldTarget = 5000;
    window._newGameDayLimit = 0; // 0 = no limit

    makeRadioGroup(settingsGrid, "Events", "events", [
      { label: "Low", value: 0.03 },
      { label: "Medium", value: 0.10 },
      { label: "High", value: 0.22 },
    ], "Medium", (v) => { window._newGameEventChance = parseFloat(v); });

    makeRadioGroup(settingsGrid, "Raiders", "raiders", [
      { label: "Few", value: 90 },
      { label: "Normal", value: 60 },
      { label: "Many", value: 30 },
    ], "Normal", (v) => { window._newGameRaiderInterval = parseInt(v); });

    makeRadioGroup(settingsGrid, "Landmass", "landmass", [
      { label: "Islands", value: 0 },
      { label: "Normal", value: 1 },
      { label: "Continents", value: 2 },
    ], "Normal", (v) => { window._newGameLandmass = parseInt(v); window._newGameCustomMap = null; });

    // ── Custom Map picker (appended to landmass card) ─────
    // Find the landmass card we just made (last .setting-card in settingsGrid)
    const allCards = settingsGrid.elt.querySelectorAll('.setting-card');
    const landmassCard = allCards[allCards.length - 1];
    if (landmassCard) {
      // "Custom Map" radio inside the existing radio-group
      const radioGroup = landmassCard.querySelector('.radio-group');
      if (radioGroup) {
        const custMapLbl = document.createElement('label');
        custMapLbl.className = 'radio-option';
        const custMapInp = document.createElement('input');
        custMapInp.type = 'radio';
        custMapInp.name = 'landmass';
        custMapInp.value = 'custom_map';
        custMapLbl.appendChild(custMapInp);
        const custMapSpan = document.createElement('span');
        custMapSpan.className = 'radio-label-text';
        custMapSpan.textContent = '🗺️ Custom Map';
        custMapLbl.appendChild(custMapSpan);
        radioGroup.appendChild(custMapLbl);

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
            opt.textContent = 'No saved maps — use Level Editor first';
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

        custMapInp.addEventListener('change', () => {
          mapSelect.disabled = false;
          refreshMapList();
          // Disable the custom-number input from makeRadioGroup
          const ci = landmassCard.querySelector('.config-custom-input[type="number"]');
          if (ci) ci.disabled = true;
          const selected = mapSelect.value;
          window._newGameCustomMap = selected || null;
          window._newGameLandmass = -1; // signal custom
        });

        mapSelect.addEventListener('change', () => {
          window._newGameCustomMap = mapSelect.value || null;
        });

        // When any other landmass radio is picked, disable map dropdown
        radioGroup.querySelectorAll('input[type="radio"]').forEach(r => {
          if (r !== custMapInp) {
            r.addEventListener('change', () => {
              mapSelect.disabled = true;
              window._newGameCustomMap = null;
            });
          }
        });
      }
    }

    // ── Win Condition ─────────────────────────────────────
    const winSection = createDiv().addClass("config-section").parent(wrapper);
    createElement("h3", "Win Condition").parent(winSection).style("margin-bottom", "10px");
    const winGrid = createDiv().addClass("settings-grid").style("grid-template-columns", "1fr 1fr").parent(winSection);

    // Gold target
    const goldCard = createDiv().addClass("setting-card").parent(winGrid);
    createDiv().html("Gold Target").addClass("setting-card-label").parent(goldCard);
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
    const dayCard = createDiv().addClass("setting-card").parent(winGrid);
    createDiv().html("Day Limit").addClass("setting-card-label").parent(dayCard);
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
      const autoCities = Math.max(5, Math.floor((c * r) / 300));
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
    const wrapper = createDiv().id("editorToolbar").addClass("editor-toolbar");

    // Title
    createElement("h3", "Level Editor").parent(wrapper).style("margin", "0 0 8px").style("text-align", "center");

    // ── Map Size ──
    const sizeSection = createDiv().addClass("editor-section").parent(wrapper);
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

    // ── Terrain Tools ──
    const terrainSection = createDiv().addClass("editor-section").parent(wrapper);
    createElement("h4", "Terrain").parent(terrainSection);
    const terrainGrid = createDiv().addClass("editor-tool-grid").parent(terrainSection);

    const terrainTypes = [
      { type: 'Water',  color: '#0077BE', label: '🌊 Water' },
      { type: 'Sand',   color: '#C2B280', label: '🏖️ Sand' },
      { type: 'Grass',  color: '#5F9F35', label: '🌿 Grass' },
      { type: 'Forest', color: '#22551C', label: '🌲 Forest' },
      { type: 'Rock',   color: '#787878', label: '⛰️ Rock' },
      { type: 'Snow',   color: '#E8F0FF', label: '❄️ Snow' },
    ];

    for (const t of terrainTypes) {
      const btn = createButton(t.label).parent(terrainGrid).addClass("editor-tool-btn");
      btn.style("border-left", `4px solid ${t.color}`);
      btn.attribute("data-tool", t.type);
      btn.mousePressed(() => {
        if (levelEditor) levelEditor.currentTool = t.type;
        _highlightEditorTool(t.type);
      });
    }

    // ── Placement Tools ──
    const placeSection = createDiv().addClass("editor-section").parent(wrapper);
    createElement("h4", "Placement").parent(placeSection);
    const placeGrid = createDiv().addClass("editor-tool-grid").parent(placeSection);

    createButton("🏘️ City").parent(placeGrid).addClass("editor-tool-btn")
      .attribute("data-tool", "city")
      .mousePressed(() => { if (levelEditor) levelEditor.currentTool = 'city'; _highlightEditorTool('city'); });
    createButton("🧑 Start").parent(placeGrid).addClass("editor-tool-btn")
      .attribute("data-tool", "playerStart")
      .mousePressed(() => { if (levelEditor) levelEditor.currentTool = 'playerStart'; _highlightEditorTool('playerStart'); });
    createButton("🧹 Eraser").parent(placeGrid).addClass("editor-tool-btn")
      .attribute("data-tool", "eraser")
      .mousePressed(() => { if (levelEditor) levelEditor.currentTool = 'eraser'; _highlightEditorTool('eraser'); });

    // ── Brush Size ──
    const brushSection = createDiv().addClass("editor-section").parent(wrapper);
    createElement("h4", "Brush Size").parent(brushSection);
    const brushRow = createDiv().style("display", "flex").style("gap", "4px").parent(brushSection);
    for (let s = 1; s <= 3; s++) {
      const btn = createButton(`${s}`).parent(brushRow).addClass("editor-small-btn");
      btn.attribute("data-brush", s);
      btn.mousePressed(() => {
        if (levelEditor) levelEditor.brushSize = s;
        _highlightEditorBrush(s);
      });
    }

    // ── Actions ──
    const actionSection = createDiv().addClass("editor-section").parent(wrapper);
    createElement("h4", "Actions").parent(actionSection);

    createButton("Undo (Ctrl+Z)").parent(actionSection).addClass("editor-action-btn")
      .mousePressed(() => { if (levelEditor) levelEditor.undo(); });
    createButton("Fill (F)").parent(actionSection).addClass("editor-action-btn")
      .mousePressed(() => {
        if (levelEditor) {
          const { x, y } = levelEditor.screenToGrid(mouseX, mouseY);
          const type = levelEditor.currentTool === 'eraser' ? 'Water' : levelEditor.currentTool;
          if (['Water','Sand','Grass','Forest','Rock','Snow'].includes(type)) {
            levelEditor.floodFill(x, y, type);
          }
        }
      });
    createButton("Clear Map").parent(actionSection).addClass("editor-action-btn editor-action-danger")
      .mousePressed(() => {
        if (levelEditor && confirm("Clear entire map?")) {
          levelEditor._initGrid();
          levelEditor.centreCamera();
        }
      });

    // ── Save / Load ──
    const saveSection = createDiv().addClass("editor-section").parent(wrapper);
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
          // Update size inputs
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
      // Click to load
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
    const bottomSection = createDiv().addClass("editor-section").style("margin-top", "auto").parent(wrapper);

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
    const helpDiv = createDiv().parent(wrapper).style("font-size", "10px").style("color", "#666").style("margin-top", "8px").style("line-height", "1.4");
    helpDiv.html("WASD: Pan &nbsp;|&nbsp; Scroll: Zoom<br>Right-click drag: Pan<br>F: Flood fill &nbsp;|&nbsp; 1-3: Brush size<br>Ctrl+Z: Undo");

    return wrapper;
  },

  show: () => {
    const w = select("#editorToolbar");
    if (w) w.show();
    // Prevent context menu so right-click panning works
    document.addEventListener('contextmenu', _editorBlockContext);
    // Highlight current tool
    setTimeout(() => {
      if (levelEditor) {
        _highlightEditorTool(levelEditor.currentTool);
        _highlightEditorBrush(levelEditor.brushSize);
      }
    }, 50);
  },

  hide: () => {
    const w = select("#editorToolbar");
    if (w) w.hide();
    document.removeEventListener('contextmenu', _editorBlockContext);
  }
});

function _editorBlockContext(e) { e.preventDefault(); }

/** Highlight the active tool button */
function _highlightEditorTool(toolName) {
  document.querySelectorAll('.editor-tool-btn').forEach(btn => {
    btn.classList.toggle('editor-tool-active', btn.getAttribute('data-tool') === toolName);
  });
}

/** Highlight the active brush size button */
function _highlightEditorBrush(size) {
  document.querySelectorAll('[data-brush]').forEach(btn => {
    btn.classList.toggle('editor-tool-active', parseInt(btn.getAttribute('data-brush')) === size);
  });
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
    }
  },

  hide: () => {
    const m = select("#settingsMenu");
    if (m) { m.style("opacity", "0"); uiManager.scheduleFadeHide("settingsMenu", 200); }
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


// ============================
// TRAVEL MAP — Interactive map overlay for fast travel
// ============================
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

  // Build compact list in sidebar
  for (const entry of cityEntries) {
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
  }
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
      .style("background", "url('./assets/images/Sign.png') no-repeat center center")
      .style("background-size", "contain")
      .style("height", "10dvh")
      .style("width", "25dvw")
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

    createImg("./assets/images/people.png", "population")
      .style("width", "40px")
      .style("height", "40px")
      .parent(popRow);

    createSpan("").id("cityPopulation")
      .style("font-size", "16px")
      .style("color", "#aaa")
      .parent(popRow);

    // Player info row
    const infoRow = createDiv().class("city-info-row").parent(wrapper);

    createImg("./assets/images/cash.png", "gold")
      .style("width", "24px").style("height", "24px").parent(infoRow);
    createSpan("").id("cityPlayerGold").parent(infoRow);
    createSpan("").id("cityPlayerCargo").parent(infoRow);

    // ── Tab Bar ──
    const tabBar = createDiv().class("city-tab-bar").parent(wrapper);
    const tabs = ["Shop", "Port", "Info"];
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
          // Create standalone floating window (not inside cityView)
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

        const canAfford = player.gold >= buyPrice;
        const hasStock = cityQty > 0;
        const hasCargoSpace = tw + itemData.weight <= (player.getEffectiveCargoCapacity ? player.getEffectiveCargoCapacity() : (player.cargoCapacity || 50));
        const canBuy = canAfford && hasStock && hasCargoSpace;
        const canSell = playerQty > 0;

        // Update qty text
        const qtyEl = select(`[data-shop-qty="${itemKey}"]`);
        if (qtyEl) qtyEl.html(`City: ×${cityQty}  |  You: ×${playerQty}  |  Wt: ${itemData.weight}`);

        // Update buy button
        const buyBtn = select(`[data-shop-buy="${itemKey}"]`);
        if (buyBtn) {
          buyBtn.html(`Buy $${buyPrice}`);
          buyBtn.removeClass("buy-btn").removeClass("buy-btn-disabled");
          buyBtn.addClass(canBuy ? "buy-btn" : "buy-btn-disabled");
        }

        // Update sell button
        const sellBtn = select(`[data-shop-sell="${itemKey}"]`);
        if (sellBtn) {
          sellBtn.html(`Sell $${sellPrice}`);
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
      };

      // Only rebuild full DOM if shop grid doesn't exist yet or city changed
      const existingGrid = select("#cityTabShop .shop-grid");
      if (existingGrid && window._shopCity === city.name) {
        // Fast path: just refresh all dynamic values
        for (const itemKey of Object.keys(ItemLibrary)) {
          _refreshShopRow(itemKey);
        }
      } else {
        // Full rebuild (first open or city changed)
        window._shopCity = city.name;
        shopPanel.html("");

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
        const canBuy = canAfford && hasStock && hasCargoSpace;
        const canSell = playerQty > 0;

        const itemDiv = createDiv().class("shop-item").parent(shopScroll);
        itemDiv.attribute("data-shop-item", itemKey);

        // Item image + name
        const imgRow = createDiv().style("display", "flex").style("align-items", "center").style("gap", "8px").parent(itemDiv);
  
        createImg(`./assets/images/${itemData.sprite}`, itemData.name)
          .style("width", "32px")
          .style("height", "32px")
          .style("image-rendering", "pixelated")
          .attribute("onerror", "this.style.display='none'")
          .parent(imgRow);

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

        createButton(`Buy $${buyPrice}`)
          .parent(btnRow)
          .addClass(canBuy ? "buy-btn" : "buy-btn-disabled")
          .attribute("data-shop-buy", itemKey)
          .mousePressed(() => {
            const freshBuyPrice = city.calculateItemPrice(itemKey, cities, false);
            const ce = city.inventory.get(itemKey);
            if (player.gold >= freshBuyPrice && ce && ce.quantity > 0) {
              if (!player.addItem(itemData)) return; // cargo full
              player.spendGold(freshBuyPrice);
              ce.quantity--;
              _refreshShopRow(itemKey);
            }
          });

        createButton(`Sell $${sellPrice}`)
          .parent(btnRow)
          .addClass(canSell ? "sell-btn" : "sell-btn-disabled")
          .attribute("data-shop-sell", itemKey)
          .mousePressed(() => {
            const pe = player.inventory.get(itemKey);
            if (pe && pe.quantity > 0) {
              const freshSellPrice = city.calculateItemPrice(itemKey, cities, true);
              player.earnGold(freshSellPrice);
              player.removeItem(itemData);
              const ce = city.inventory.get(itemKey);
              if (!ce) {
                city.inventory.set(itemKey, { item: itemData, quantity: 1 });
              } else {
                ce.quantity++;
              }
              _refreshShopRow(itemKey);
            }
          });
      }
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

            createP(`Speed: ${boat.speed}ms  •  Cargo: +${boat.cargoBonus}`)
              .style("font-size", "11px").style("color", "#888").style("margin", "4px 0").parent(card);

            const btnRow = createDiv().style("display", "flex").style("gap", "6px").parent(card);

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

            const sellPrice = boatDef ? Math.floor(boatDef.cost * 0.4) : 50;
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

      // ── Traders in City ──
      const cityIdx = cities.indexOf(city);
      if (typeof traderManager !== 'undefined' && cityIdx >= 0) {
        const tradersHere = traderManager.getTradersAtCity(cityIdx);
        const tradersIncoming = traderManager.getTradersHeadingToCity(cityIdx);

        createElement("h4", `🧑‍💼 Traders (${tradersHere.length})`).parent(statsBox)
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
            createSpan("🧑‍💼").parent(leftCol).style("font-size", "14px");
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

            const leftCol = createDiv().parent(row).style("display", "flex").style("gap", "6px").style("align-items", "center");
            createSpan("🧑‍💼").parent(leftCol).style("font-size", "14px");
            createSpan(t.name).parent(leftCol)
              .style("color", "#aac").style("font-size", "12px");
            createSpan("→ En route").parent(leftCol)
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

        createElement("h4", `⚔️ Threats (${nearbyRaiders.length})`).parent(statsBox)
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
              : '🗡️ Raiders';
            createSpan(name).parent(row)
              .style("color", r.isMonster ? "#c6f" : "#f88").style("font-size", "12px");

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
  validStates: [GameStates.PLAYING],

  create: () => {
    const bar = createDiv().id("playerView").class("hud-bar");

    const statsWrapper = createDiv().class("hud-stats").parent(bar);
    createSpan("").id("playerGold").parent(statsWrapper);
    createSpan("").id("playerCargo").parent(statsWrapper);

    // Inventory icon chips container (replaces old text span)
    createDiv().id("hudInventoryChips").class("hud-inv-chips").parent(statsWrapper);

    const timeWrapper = createDiv().class("hud-time").parent(bar);
    createSpan("").id("dayCycleIcon").parent(timeWrapper);
    createSpan("").id("dayLabel").parent(timeWrapper);
    createSpan("").id("timeLabel").parent(timeWrapper);

    // Speed controls
    const speedWrapper = createDiv().class("hud-speed").parent(bar);

    const slowBtn = document.createElement("button");
    slowBtn.className = "speed-btn";
    slowBtn.textContent = "<<";
    slowBtn.title = "Slow down (Q)";
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
    fastBtn.title = "Speed up (E)";
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

    return bar;
  },

  show: () => {
    const view = select("#playerView");
    if (view) view.show();
    uiManager.screens["playerView"].update();
  },

  hide: () => {
    const view = select("#playerView");
    if (view) view.hide();
  },

  update: () => {
    if (!player) return;

    select("#playerGold")?.html(`💰 ${player.gold}`);

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
      if (player.isSailing && player.activeBoat) invFp += `boat:${player.activeBoat.name}`;

      if (invFp !== window._hudInvFp) {
        window._hudInvFp = invFp;
        chipsEl.innerHTML = '';

        // Boat prefix
        if (player.isSailing && player.activeBoat) {
          const boatTag = document.createElement('span');
          boatTag.className = 'hud-boat-tag';
          boatTag.textContent = `⛵ ${player.activeBoat.name}`;
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
uiManager.registerScreen("inventoryView", {
  validStates: [GameStates.INVENTORY],

  create: () => {
    const wrapper = createDiv().id("inventoryView").class("screen inventory-screen").style("display", "none");

    // Header
    const header = createDiv().class("inv-header").parent(wrapper);
    createElement("h2", "🎒 Inventory").parent(header);
    createSpan("").id("invGold").parent(header);
    createSpan("").id("invCargo").parent(header);

    // Items list
    createDiv().id("invItemList").class("inv-item-list").parent(wrapper);

    // Fleet section
    createElement("h3", "⛵ Fleet").parent(wrapper).style("margin-top", "16px");
    createDiv().id("invFleet").class("inv-fleet").parent(wrapper);

    // Stats section
    createElement("h3", "📊 Stats").parent(wrapper).style("margin-top", "16px");
    createDiv().id("invStats").class("inv-stats").parent(wrapper);

    // Close button
    createButton("Close (I)")
      .parent(wrapper)
      .addClass("menu-btn")
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
    // Populate on show
    uiManager.screens["inventoryView"].update();
  },

  hide: () => {
    const view = select("#inventoryView");
    if (view) { view.style("opacity", "0"); uiManager.scheduleFadeHide("inventoryView", 200); }
  },

  update: () => {
    if (typeof player === 'undefined' || !player) return;

    // Build a fingerprint of current data to skip DOM rebuild if unchanged
    let fp = `${player.gold}|${player.combatStrength}|${player.cargoCapacity}|${player.fleet.length}|${player.activeBoat?.name || ""}`;
    for (const [key, entry] of player.inventory) {
      fp += `|${key}:${entry.quantity}`;
    }
    if (typeof dayNight !== 'undefined') fp += `|d${dayNight.getDaysElapsed()}`;
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

    if (Object.keys(byCategory).length === 0) {
      createP("No items in inventory.").parent(itemList).style("color", "#666");
    } else {
      for (const cat of Object.keys(byCategory).sort()) {
        const catDiv = createDiv().class("inv-category").parent(itemList);
        createElement("h4", cat).parent(catDiv);
        for (const entry of byCategory[cat]) {
          const row = createDiv().class("inv-item-row").parent(catDiv);
          // Icon element (img or emoji)
          const iconEl = createItemIconEl(entry.name, 20);
          iconEl.classList.add('inv-item-icon');
          row.elt.appendChild(iconEl);
          createSpan(entry.name).class("inv-item-name").parent(row);
          createSpan(`×${entry.qty}`).class("inv-item-qty").parent(row);
          createSpan(`${entry.item.weight}kg ea`).class("inv-item-weight").parent(row);
          if (entry.avgPrice > 0) {
            createSpan(`avg ${Math.round(entry.avgPrice)}g`).class("inv-item-price").parent(row);
          }
        }
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
          const bRow = createDiv().class("inv-fleet-row").parent(fleetDiv);
          const isActive = player.activeBoat === boat;
          const icon = BoatLibrary[boat.type]?.icon || "🚢";
          createSpan(`${icon} ${boat.name}`).parent(bRow).style("color", isActive ? "var(--accent)" : "#ccc");
          createSpan(`${boat.displayName} • Cargo +${boat.cargoBonus}`).parent(bRow).style("color", "#888").style("font-size", "12px");
          if (isActive) {
            createSpan("✓ Active").parent(bRow).style("color", "var(--accent)").style("font-size", "11px");
          }
        }
      }
    }

    // Stats
    const statsDiv = select("#invStats");
    if (statsDiv) {
      statsDiv.html("");
      const stats = [
        `⚔️ Combat Strength: ${player.combatStrength}`,
        `📦 Base Cargo: ${player.cargoCapacity}`,
        `💸 Tax Rate: ${(player.taxRate * 100).toFixed(0)}%`,
      ];
      if (player.isSailing && player.activeBoat) {
        stats.push(`⛵ Sailing: ${player.activeBoat.name}`);
      }
      if (typeof dayNight !== 'undefined') {
        stats.push(`📅 Day ${dayNight.getDaysElapsed()}, Year ${dayNight.getYear()}`);
      }
      for (const s of stats) {
        createP(s).parent(statsDiv).style("margin", "2px 0");
      }
    }
  }
});


// ============================
// MINIMAP CONTROLS (zoom +/-, mode toggle)
// ============================
uiManager.registerScreen("minimapControls", {
  validStates: [GameStates.PLAYING],

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

function _refreshCombatBars() {
  if (typeof combatSystem === 'undefined' || !combatSystem.active) return;
  const pBar = document.getElementById('playerHpBar');
  const eBar = document.getElementById('enemyHpBar');
  const pLabel = document.getElementById('playerHpLabel');
  const eLabel = document.getElementById('enemyHpLabel');
  if (!pBar) return;

  const pMax = combatSystem._initPlayerHP || combatSystem.playerHP;
  const eMax = combatSystem._initRaiderHP || combatSystem.raiderHP;
  const pPct = Math.max(0, combatSystem.playerHP / pMax * 100);
  const ePct = Math.max(0, combatSystem.raiderHP / eMax * 100);

  pBar.style.width = pPct + '%';
  pBar.style.background = pPct > 50 ? '#4CAF50' : pPct > 25 ? '#ff9800' : '#f44336';
  eBar.style.width = ePct + '%';
  eBar.style.background = ePct > 50 ? '#f44336' : ePct > 25 ? '#ff9800' : '#4CAF50';

  if (pLabel) pLabel.textContent = `${Math.max(0, combatSystem.playerHP)} HP`;
  if (eLabel) eLabel.textContent = `${Math.max(0, combatSystem.raiderHP)} HP`;
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

  _renderNavalGrids();
  _startNavalTimer();

  // WASD / arrow-key movement handler
  window._navalKeyHandler = (e) => {
    if (!combatSystem || !combatSystem.isNavalCombat || combatSystem.result) return;
    const keyMap = { w: 'up', W: 'up', a: 'left', A: 'left', s: 'down', S: 'down', d: 'right', D: 'right',
                     ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const dir = keyMap[e.key];
    if (dir) {
      e.preventDefault();
      if (combatSystem.movePlayerShip(dir)) _renderNavalGrids();
    }
  };
  window.addEventListener('keydown', window._navalKeyHandler);
}

function _renderNavalGrids() {
  const cs = combatSystem;
  if (!cs || !cs.isNavalCombat) return;

  // Player grid — player sees own ship, plus enemy shots
  const pGrid = document.getElementById('playerNavalGrid');
  if (pGrid) {
    pGrid.innerHTML = '';
    for (let r = 0; r < NAVAL_GRID_SIZE; r++) {
      for (let c = 0; c < NAVAL_GRID_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'naval-cell';
        const isShip = cs.playerShipCells.some(s => s.r === r && s.c === c);
        const state = cs.playerGrid[r][c];

        if (state === 'hit') {
          cell.classList.add('naval-cell-hit');
          cell.textContent = '💥';
        } else if (state === 'miss') {
          cell.classList.add('naval-cell-miss');
          cell.textContent = '🌊';
        } else if (isShip) {
          cell.classList.add('naval-cell-ship');
          cell.textContent = '🚢';
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

  const result = combatSystem.playerNavalFire(row, col);
  if (result.alreadyFired) return;

  if (result.hit) _showDmgSplash('enemyHpBar', (BoatLibrary[combatSystem.playerBoatType] || BoatLibrary.rowboat).attack);

  _refreshCombatBars();
  _renderNavalGrids();
  _appendNavalLog();

  if (result.resolved) {
    _navalCombatEnd();
  }
}

function _startNavalTimer() {
  if (!combatSystem || !combatSystem.isNavalCombat) return;
  window._navalTimerStart = performance.now();

  function tick() {
    if (!combatSystem || !combatSystem.isNavalCombat || combatSystem.result) {
      _stopNavalTimer();
      return;
    }

    const enemyResult = combatSystem.enemyNavalFire();
    if (enemyResult) {
      if (enemyResult.hit) _showDmgSplash('playerHpBar', (BoatLibrary[combatSystem.enemyBoatType] || BoatLibrary.rowboat).attack);

      _refreshCombatBars();
      _renderNavalGrids();
      _appendNavalLog();

      if (enemyResult.resolved) {
        _navalCombatEnd();
        return;
      }
    }
    window._navalTimerStart = performance.now();
  }

  combatSystem._navalTickTimer = setInterval(tick, NAVAL_TICK_MS);

  // Countdown bar animation
  function animateBar() {
    if (!combatSystem || !combatSystem.isNavalCombat || combatSystem.result) return;
    const elapsed = performance.now() - (window._navalTimerStart || performance.now());
    const pct = Math.max(0, 1 - elapsed / NAVAL_TICK_MS);
    const bar = document.getElementById('navalTimerBar');
    if (bar) bar.style.width = (pct * 100) + '%';
    requestAnimationFrame(animateBar);
  }
  requestAnimationFrame(animateBar);
}

function _stopNavalTimer() {
  if (combatSystem && combatSystem._navalTickTimer) {
    clearInterval(combatSystem._navalTickTimer);
    combatSystem._navalTickTimer = null;
  }
  // Remove WASD handler
  if (window._navalKeyHandler) {
    window.removeEventListener('keydown', window._navalKeyHandler);
    window._navalKeyHandler = null;
  }
}

/** Shared end-of-naval-combat UI teardown */
function _navalCombatEnd() {
  _stopNavalTimer();
  _refreshCombatBars();
  _renderNavalGrids();
  _appendNavalLog();   // flush all remaining log messages (loot, defeat text, etc.)
  select("#combatContinueBtn")?.style("display", "block");
  const hint = document.getElementById('navalHint');
  if (hint) hint.textContent = combatSystem.result === 'win' ? '🏆 Victory!' : '💀 Defeat!';
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
  const patternArea = document.getElementById('patternArea');
  if (!patternArea) return;

  // Hide action buttons
  const actions = document.getElementById('combatActions');
  if (actions) actions.style.display = 'none';

  // Build arrow display
  const arrowSymbols = { left: '←', up: '↑', down: '↓', right: '→' };
  const keyCodes = { 37: 'left', 38: 'up', 40: 'down', 39: 'right' };

  let html = `<p class="pattern-info">Match the pattern!</p>`;
  html += `<div class="pattern-timer-wrap"><div class="pattern-timer-bar" id="patternTimerBar"></div></div>`;
  html += `<div class="pattern-arrows-row">`;
  pattern.arrows.forEach((dir, i) => {
    html += `<div class="pattern-arrow" id="patArrow${i}">${arrowSymbols[dir]}</div>`;
  });
  html += `</div>`;
  html += `<p class="pattern-feedback" id="patternFeedback"></p>`;
  patternArea.innerHTML = html;
  patternArea.style.display = 'block';

  // State
  const state = {
    arrows: pattern.arrows,
    totalTime: pattern.totalTime,
    current: 0,
    hits: 0,
    misses: 0,
    done: false,
    startTime: performance.now()
  };
  _patternState = state;

  // Highlight first arrow
  const firstArrow = document.getElementById('patArrow0');
  if (firstArrow) firstArrow.classList.add('active');

  // Activate input immediately — no delay
  window._combatPatternActive = true;

  // Timer bar via requestAnimationFrame
  const timerBar = document.getElementById('patternTimerBar');
  function tickTimer() {
    if (state.done) return;
    const elapsed = performance.now() - state.startTime;
    const pct = Math.max(0, 1 - elapsed / state.totalTime);
    if (timerBar) timerBar.style.width = (pct * 100) + '%';
    if (elapsed >= state.totalTime) {
      // Mark remaining arrows as missed
      for (let i = state.current; i < state.arrows.length; i++) {
        const el = document.getElementById(`patArrow${i}`);
        if (el) el.classList.add('arrow-miss');
        state.misses++;
      }
      state.current = state.arrows.length;
      _finishPattern();
      return;
    }
    requestAnimationFrame(tickTimer);
  }
  requestAnimationFrame(tickTimer);

  // Key handler
  window._handlePatternKey = (kc) => {
    if (state.done || state.current >= state.arrows.length) return;
    const dir = keyCodes[kc];
    if (!dir) return;

    const expected = state.arrows[state.current];
    const el = document.getElementById(`patArrow${state.current}`);
    if (dir === expected) {
      state.hits++;
      if (el) { el.classList.remove('active'); el.classList.add('arrow-correct'); }
    } else {
      state.misses++;
      if (el) { el.classList.remove('active'); el.classList.add('arrow-wrong'); }
    }
    state.current++;

    // Highlight next or finish
    if (state.current < state.arrows.length) {
      const next = document.getElementById(`patArrow${state.current}`);
      if (next) next.classList.add('active');
    } else {
      _finishPattern();
    }
  };
}

function _finishPattern() {
  if (!_patternState || _patternState.done) return;
  _patternState.done = true;
  window._combatPatternActive = false;
  window._handlePatternKey = null;

  const total = _patternState.arrows.length;
  const accuracy = total > 0 ? _patternState.hits / total : 0;
  const pct = Math.round(accuracy * 100);

  let label, color;
  if (pct === 100)     { label = 'PERFECT!'; color = '#FFD700'; }
  else if (pct >= 80)  { label = 'Great!';   color = '#4CAF50'; }
  else if (pct >= 50)  { label = 'OK';       color = '#ff9800'; }
  else                 { label = 'Poor...';  color = '#f44336'; }

  const fb = document.getElementById('patternFeedback');
  if (fb) { fb.textContent = `${label} (${pct}%)`; fb.style.color = color; }

  // Snapshot HP before fight
  const hpBefore = { player: combatSystem.playerHP, enemy: combatSystem.raiderHP };

  // Execute fight with accuracy after a brief pause to show feedback
  setTimeout(() => {
    const result = combatSystem.playerAction('fight', accuracy);

    // Damage splashes
    const pDelta = hpBefore.player - combatSystem.playerHP;
    const eDelta = hpBefore.enemy - combatSystem.raiderHP;
    if (pDelta > 0) _showDmgSplash('playerHpBar', pDelta);
    if (eDelta > 0) _showDmgSplash('enemyHpBar', eDelta);

    _refreshCombatBars();
    updateCombatLog(result);

    // Hide pattern area, show actions again
    const patternArea = document.getElementById('patternArea');
    if (patternArea) patternArea.style.display = 'none';
    if (!result.resolved) {
      const actions = document.getElementById('combatActions');
      if (actions) actions.style.display = 'flex';
    }
  }, 600);
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
    createDiv().class("combatant-icon player-icon").html("🛡️").parent(pSide);
    createP("You").class("combatant-name").parent(pSide);
    const pBarWrap = createDiv().class("hp-bar-wrap").parent(pSide);
    createDiv().class("hp-bar player-hp-bar").id("playerHpBar").parent(pBarWrap);
    createP("").class("hp-label").id("playerHpLabel").parent(pSide);

    // VS divider
    createDiv().class("vs-divider").html("⚔").parent(combatants);

    // Enemy side
    const eSide = createDiv().class("combatant-side").parent(combatants);
    createDiv().class("combatant-icon enemy-icon").id("enemyIcon").html("💀").parent(eSide);
    createP("Enemy").class("combatant-name").id("enemyNameLabel").parent(eSide);
    const eBarWrap = createDiv().class("hp-bar-wrap").parent(eSide);
    createDiv().class("hp-bar enemy-hp-bar").id("enemyHpBar").parent(eBarWrap);
    createP("").class("hp-label").id("enemyHpLabel").parent(eSide);

    // --- Pattern mini-game area (hidden) ---
    createDiv().id("patternArea").class("pattern-area").style("display", "none").parent(wrapper);

    // --- Naval combat area (hidden) ---
    const navalArea = createDiv().id("navalArea").class("naval-area").style("display", "none").parent(wrapper);
    const navalGrids = createDiv().class("naval-grids").parent(navalArea);

    const pSection = createDiv().class("naval-grid-section").parent(navalGrids);
    createP("Your Waters").class("naval-grid-label").parent(pSection);
    createDiv().id("playerNavalGrid").class("naval-grid").parent(pSection);

    const eSection = createDiv().class("naval-grid-section").parent(navalGrids);
    createP("Enemy Waters").class("naval-grid-label").parent(eSection);
    createDiv().id("enemyNavalGrid").class("naval-grid").parent(eSection);

    const timerWrap = createDiv().class("naval-timer-wrap").parent(navalArea);
    createDiv().class("naval-timer-bar").id("navalTimerBar").parent(timerWrap);

    createP("Click an enemy cell to fire!").id("navalHint").class("naval-hint").parent(navalArea);

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
          _startPatternMiniGame();
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
        combatSystem._initPlayerHP = combatSystem.playerHP;
        combatSystem._initRaiderHP = combatSystem.raiderHP;

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
        if (playerIcon) playerIcon.textContent = '🛡️';

        const enemyIcon = document.getElementById('enemyIcon');
        if (enemyIcon) {
          const iconMap = { dragon: '🐉', blackKnight: '🗡️', wraith: '👻' };
          enemyIcon.textContent = iconMap[combatSystem.raiderType] || '💀';
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
        }
      }
    }
  },

  hide: () => {
    // Clean up pattern state
    window._combatPatternActive = false;
    window._handlePatternKey = null;
    _patternState = null;

    // Clean up naval timer
    _stopNavalTimer();

    const view = select("#combatView");
    if (view) { view.style("opacity", "0"); uiManager.scheduleFadeHide("combatView", 200); }
  }
});

function updateCombatLog(result) {
  if (!result) return;

  const log = select("#combatLog");
  if (log) {
    const msg = result.message || "...";
    const isGood = result.won || msg.includes('strike for') || msg.includes('CRITICAL')
      || msg.includes('PERFECT') || msg.includes('grazes');
    const entry = createP(msg)
      .style("margin", "4px 0")
      .style("color", result.won ? "#4CAF50" : result.fled ? "#ff9800" : isGood ? "#4CAF50" : "#f44336");
    entry.parent(log);

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

    if (typeof eventSystem !== 'undefined' && eventSystem.currentEvent) {
      const evt = eventSystem.currentEvent;
      select("#eventTitle")?.html(`🎲 ${evt.name}`);
      select("#eventDesc")?.html(evt.description);

      const choicesDiv = select("#eventChoices");
      choicesDiv?.html("");

      if (evt.choices) {
        for (let i = 0; i < evt.choices.length; i++) {
          const choice = evt.choices[i];
          createButton(choice.text)
            .parent(choicesDiv)
            .addClass("event-choice-btn")
            .mousePressed(() => {
              const result = eventSystem.resolveChoice(i);
              showEventResult(result);
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

  select("#eventChoices")?.html("");
  select("#eventDesc")?.html(result.message || "The event concludes.");

  // Show the pre-created continue button
  select("#eventContinueBtn")?.style("display", "block");
}


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

    createP("You've run out of gold and supplies. Try again?")
      .style("margin-bottom", "20px")
      .parent(wrapper);

    createButton("Retry")
      .parent(wrapper)
      .addClass("menu-btn")
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
  },
  hide: () => {
    const el = select("#gameLoseView");
    if (el) { el.removeClass("screen-visible"); el.hide(); }
  }
});
