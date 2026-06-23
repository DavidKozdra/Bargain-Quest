// LEVEL EDITOR TOOLBAR (extracted from ui.js)
function _editorSetAtlasContent(host, frameName, label = "", size = 16, fallback = "") {
  const parent = host?.elt || host;
  if (!parent || typeof parent.replaceChildren !== "function") return;
  parent.replaceChildren();
  if (frameName && typeof createAtlasIconEl === "function") {
    const iconEl = createAtlasIconEl(frameName, size, fallback);
    iconEl.style.marginRight = label ? "4px" : "0";
    iconEl.style.verticalAlign = "-3px";
    parent.appendChild(iconEl);
  }
  if (label) parent.appendChild(document.createTextNode(label));
}

function _editorCreateAtlasButton(parent, frameName, label, title, className, size = 16, fallback = "") {
  const btn = createButton("").parent(parent);
  if (className) btn.addClass(className);
  if (title) {
    btn.attribute("title", title);
    btn.attribute("aria-label", title);
  }
  _editorSetAtlasContent(btn, frameName, label, size, fallback);
  return btn;
}

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
    const topBarBrand = createDiv().addClass("editor-topbar-brand").parent(topBar);
    createSpan("Map Forge").addClass("editor-topbar-brand-title").parent(topBarBrand);
    createSpan("Level Editor").addClass("editor-topbar-brand-subtitle").parent(topBarBrand);

    const terrainGroup = createDiv().addClass("editor-topbar-group").parent(topBar);
    createSpan("Terrain").addClass("editor-topbar-group-label").parent(terrainGroup);
    const terrainButtons = createDiv().addClass("editor-topbar-group-buttons").parent(terrainGroup);

    // — Terrain swatches —
    const terrainTypes = [
      { type: 'Water',  color: '#0077BE', frame: 'sloop', tip: 'Water (Q)' },
      { type: 'Sand',   color: '#C2B280', frame: 'Stone', tip: 'Sand (E)' },
      { type: 'Grass',  color: '#5F9F35', frame: 'Wheat', tip: 'Grass (R)' },
      { type: 'Forest', color: '#22551C', frame: 'Wood', tip: 'Forest (T)' },
      { type: 'Rock',   color: '#787878', frame: 'Stone', tip: 'Rock (Y)' },
      { type: 'Snow',   color: '#E8F0FF', frame: 'Hard', tip: 'Snow (U)' },
    ];
    for (const t of terrainTypes) {
      const btn = _editorCreateAtlasButton(terrainButtons, t.frame, "", t.tip, "editor-topbar-btn", 18);
      btn.style("border-bottom", `3px solid ${t.color}`);
      btn.attribute("data-tool", t.type);
      btn.mousePressed(() => {
        if (levelEditor) levelEditor.currentTool = t.type;
        _highlightEditorTool(t.type);
      });
    }

    createSpan("").parent(topBar).addClass("editor-topbar-divider");
    const placeGroup = createDiv().addClass("editor-topbar-group").parent(topBar);
    createSpan("Objects").addClass("editor-topbar-group-label").parent(placeGroup);
    const placeButtons = createDiv().addClass("editor-topbar-group-buttons").parent(placeGroup);

    // — Placement tools —
    const placeTools = [
      { tool: 'inspect',     frame: 'Eye', tip: 'Select Entity' },
      { tool: 'city',        frame: 'Shield', tip: 'Place City' },
      { tool: 'playerStart', frame: 'player', tip: 'Player Start' },
      { tool: 'raiderSpawn', frame: 'Skull', tip: 'Raider Spawn' },
      { tool: 'eraser',      frame: 'Tools', tip: 'Eraser' },
    ];
    for (const p of placeTools) {
      const btn = _editorCreateAtlasButton(placeButtons, p.frame, "", p.tip, "editor-topbar-btn", 18);
      btn.attribute("data-tool", p.tool);
      btn.mousePressed(() => {
        if (levelEditor) levelEditor.currentTool = p.tool;
        _highlightEditorTool(p.tool);
      });
    }

    createSpan("").parent(topBar).addClass("editor-topbar-divider");
    const brushGroup = createDiv().addClass("editor-topbar-group").parent(topBar);
    createSpan("Brush").addClass("editor-topbar-group-label").parent(brushGroup);
    const brushButtons = createDiv().addClass("editor-topbar-group-buttons").parent(brushGroup);

    // — Brush size presets —
    const brushPresets = [
      { size: 1, label: "1×1" },
      { size: 2, label: "3×3" },
      { size: 3, label: "5×5" },
      { size: 5, label: "9×9" },
    ];
    for (const bp of brushPresets) {
      const btn = createButton(bp.label).parent(brushButtons).addClass("editor-topbar-btn editor-topbar-btn-sm");
      btn.attribute("data-brush", bp.size);
      btn.attribute("title", `Brush ${bp.label}`);
      btn.mousePressed(() => {
        if (levelEditor) levelEditor.brushSize = bp.size;
        _highlightEditorBrush(bp.size);
      });
    }

    // Custom brush input
    const customBrushInp = createElement("input").parent(brushButtons).addClass("editor-topbar-input");
    customBrushInp.attribute("type", "number").attribute("min", "1").attribute("max", "20");
    customBrushInp.attribute("value", "1").attribute("title", "Custom brush radius");
    customBrushInp.id("editorCustomBrush");
    customBrushInp.input(() => {
      const v = constrain(parseInt(customBrushInp.value()) || 1, 1, 20);
      if (levelEditor) levelEditor.brushSize = v;
      _highlightEditorBrush(v);
    });
    const brushAreaLabel = createSpan("1×1").parent(brushButtons).addClass("editor-topbar-brush-label");
    brushAreaLabel.id("editorBrushAreaLabel");

    createSpan("").parent(topBar).addClass("editor-topbar-divider");
    const actionGroup = createDiv().addClass("editor-topbar-group").parent(topBar);
    createSpan("Actions").addClass("editor-topbar-group-label").parent(actionGroup);
    const actionButtons = createDiv().addClass("editor-topbar-group-buttons").parent(actionGroup);

    // — Quick actions —
    createButton("Undo").parent(actionButtons).addClass("editor-topbar-btn editor-topbar-btn-sm")
      .attribute("title", `Undo (${getActionDisplay('editorUndo')})`)
      .mousePressed(() => { if (levelEditor) levelEditor.undo(); _refreshEditorHud(); });
    createButton("Redo").parent(actionButtons).addClass("editor-topbar-btn editor-topbar-btn-sm")
      .attribute("title", "Redo (Ctrl+Y)")
      .mousePressed(() => { if (levelEditor) levelEditor.redo(); _refreshEditorHud(); });
    _editorCreateAtlasButton(actionButtons, "Tools", "Fill", `Flood Fill (${getActionDisplay('editorFlood')})`, "editor-topbar-btn editor-topbar-btn-sm", 14)
      .attribute("title", `Flood Fill (${getActionDisplay('editorFlood')})`)
      .mousePressed(() => {
        if (levelEditor) {
          const { x, y } = levelEditor.screenToGrid(mouseX, mouseY);
          const type = levelEditor.currentTool === 'eraser' ? 'Water' : levelEditor.currentTool;
          if (['Water','Sand','Grass','Forest','Rock','Snow'].includes(type)) {
            levelEditor.floodFill(x, y, type);
            _refreshEditorHud();
          }
        }
      });

    const editorStatus = createDiv().id("editorHudStats").addClass("editor-topbar-status").parent(topBar);
    createSpan("Tool: Grass").id("editorStatusTool").addClass("editor-status-chip").parent(editorStatus);
    createSpan("Brush: 1x1").id("editorStatusBrush").addClass("editor-status-chip").parent(editorStatus);
    createSpan("Tile: -,-").id("editorStatusTile").addClass("editor-status-chip").parent(editorStatus);
    createSpan("Cities: 0 | Raiders: 0").id("editorStatusCounts").addClass("editor-status-chip").parent(editorStatus);
    // ═══════════════════════════════════════
    // LEFT SIDEBAR — settings / config
    // ═══════════════════════════════════════
    const sidebar = createDiv().id("editorSidebar").addClass("editor-sidebar").parent(wrapper);

    // ── Selection ──
    const selectionSection = createDiv().addClass("editor-section editor-card").parent(sidebar);
    createElement("h4", "Selection").parent(selectionSection);
    const selectionInfo = createDiv("Nothing selected").id("editorSelectionInfo").addClass("editor-muted-note").parent(selectionSection);
    selectionInfo.style("min-height", "32px");
    const selectionBtns = createDiv().addClass("editor-form-row").parent(selectionSection);
    createButton("Focus").parent(selectionBtns).addClass("editor-small-btn").mousePressed(() => _focusSelectedEntity());
    createButton("Delete Selected").parent(selectionBtns).addClass("editor-small-btn editor-action-danger").mousePressed(() => {
      if (!levelEditor) return;
      if (levelEditor.deleteSelectedEntity()) {
        _refreshEditorCitySelect();
        _refreshEditorSelectionPanel();
        _refreshEditorHud();
      }
    });

    // ── Map Size ──
    const sizeSection = createDiv().addClass("editor-section editor-card").parent(sidebar);
    createElement("h4", "Map Size").parent(sizeSection);
    const sizeRow = createDiv().addClass("editor-form-row").parent(sizeSection);
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
        _refreshEditorHud();
      }
    });

    // ── Raider / Monster Config ──
    const raiderSection = createDiv().addClass("editor-section editor-card").parent(sidebar);
    createElement("h4", "Raider Config").parent(raiderSection);

    const raiderOpts = createDiv().addClass("editor-field-column").parent(raiderSection);

    // Type selector
    const typeRow = createDiv().addClass("editor-form-row").parent(raiderOpts);
    createSpan("Type:").parent(typeRow).addClass("editor-field-label");
    const raiderTypeSelect = createElement("select").parent(typeRow).addClass("editor-select-input").style("flex", "1");
    const raiderTypes = [
      { value: 'bandit', label: 'Bandit' },
      { value: 'dragon', label: 'Dragon' },
      { value: 'blackKnight', label: 'Black Knight' },
      { value: 'wraith', label: 'Wraith' },
      { value: 'sandWorm', label: 'Sand Worm' },
      { value: 'iceGolem', label: 'Ice Golem' },
      { value: 'voidHound', label: 'Void Hound' },
      { value: 'thornBeast', label: 'Thorn Beast' },
      { value: 'magmaSerpent', label: 'Magma Serpent' },
      { value: 'grazer', label: 'Grazer' },
    ];
    for (const rt of raiderTypes) {
      createElement("option", rt.label).parent(raiderTypeSelect).attribute("value", rt.value);
    }
    raiderTypeSelect.changed(() => {
      if (levelEditor) levelEditor.raiderSpawnType = raiderTypeSelect.value();
    });

    // Pirate checkbox
    const pirateRow = createDiv().addClass("editor-form-row").parent(raiderOpts);
    const pirateCb = createElement("input").parent(pirateRow).attribute("type", "checkbox").id("editorPirateCb").addClass("editor-check-input");
    createElement("label", "Pirate (water)").parent(pirateRow).attribute("for", "editorPirateCb")
      .addClass("editor-inline-label");
    pirateCb.changed(() => {
      if (levelEditor) levelEditor.raiderSpawnIsPirate = pirateCb.elt.checked;
    });

    // Name input
    const nameRow = createDiv().addClass("editor-form-row").parent(raiderOpts);
    createSpan("Name:").parent(nameRow).addClass("editor-field-label");
    const raiderNameInput = createElement("input").parent(nameRow).attribute("type", "text")
      .attribute("placeholder", "(auto)").addClass("editor-text-input").style("flex", "1");
    raiderNameInput.input(() => {
      if (levelEditor) levelEditor.raiderSpawnName = raiderNameInput.value();
    });

    // Strength slider
    const strRow = createDiv().addClass("editor-form-row").parent(raiderOpts);
    createSpan("Str:").parent(strRow).addClass("editor-field-label");
    const strSlider = createElement("input").parent(strRow).attribute("type", "range")
      .attribute("min", "1").attribute("max", "10").attribute("value", "3")
      .style("flex", "1").style("height", "14px");
    const strLabel = createSpan("3").parent(strRow).addClass("editor-inline-value");
    strSlider.input(() => {
      const v = parseInt(strSlider.value());
      strLabel.html(v);
      if (levelEditor) levelEditor.raiderSpawnStrength = v;
    });

    // ── City Item Editor ──
    const cityItemSection = createDiv().addClass("editor-section editor-card").parent(sidebar);
    createElement("h4", "City Items").parent(cityItemSection);
    const cityItemInfo = createSpan("Select a city to edit items").parent(cityItemSection).addClass("editor-muted-note");
    cityItemInfo.id("editorCityItemInfo");

    // City selector dropdown
    const citySelectRow = createDiv().addClass("editor-form-row").parent(cityItemSection);
    const citySelect = createElement("select").parent(citySelectRow).addClass("editor-select-input").style("flex", "1");
    citySelect.id("editorCitySelect");
    createElement("option", "— none —").parent(citySelect).attribute("value", "");
    const refreshCityBtn = createButton("↻").parent(citySelectRow).addClass("editor-small-btn")
      .style("padding", "2px 6px");
    refreshCityBtn.mousePressed(() => _refreshEditorCitySelect());

    // City name input — renames selected city, or sets name for next placed city
    const cityNameRow = createDiv().addClass("editor-form-row").style("margin-top", "4px").parent(cityItemSection);
    createSpan("Name:").parent(cityNameRow).addClass("editor-field-label");
    const cityNameInput = createElement("input").parent(cityNameRow).attribute("type", "text")
      .attribute("placeholder", "next city name (auto)").style("flex", "1").addClass("editor-text-input");
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
    createSpan("Preset:").parent(presetRow).addClass("editor-field-label editor-field-label-block");
    const presetSel = createSelect().id("cityPresetSel").parent(presetRow).style("width", "100%").addClass("editor-select-input");
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
    const itemAddRow = createDiv().addClass("editor-form-row").style("margin-top", "4px").parent(cityItemSection);
    const itemSelect = createElement("select").parent(itemAddRow).style("flex", "1").addClass("editor-select-input");
    itemSelect.id("editorItemSelect");
    if (typeof ItemLibrary !== 'undefined') {
      for (const key of Object.keys(ItemLibrary)) {
        createElement("option", key).parent(itemSelect).attribute("value", key);
      }
    }
    const itemQtyInp = createElement("input").parent(itemAddRow).addClass("editor-num-input").style("width", "40px");
    itemQtyInp.attribute("type", "number"); itemQtyInp.attribute("min", "1"); itemQtyInp.attribute("max", "999");
    itemQtyInp.attribute("value", "10"); itemQtyInp.id("editorItemQty");

    createButton("Add").parent(itemAddRow).addClass("editor-small-btn").mousePressed(() => {
      _editorAddItemToCity();
    });

    // City inventory display
    const cityInvDiv = createDiv().parent(cityItemSection).addClass("editor-city-inventory");
    cityInvDiv.id("editorCityInvList");
    cityInvDiv.html("<em>No city selected</em>");

    citySelect.changed(() => {
      _refreshEditorCityInventory();
      // Sync name input with selected city
      const nameInp = document.getElementById('editorCityNameInput');
      if (!nameInp || !levelEditor) return;
      const idx = parseInt(citySelect.value());
      if (!isNaN(idx) && idx >= 0 && idx < levelEditor.cities.length) {
        levelEditor.selectedCityIndex = idx;
        levelEditor.selectedRaiderIndex = -1;
        levelEditor.selectedPlayerStart = false;
        nameInp.value = levelEditor.cities[idx].name || '';
        nameInp.placeholder = 'rename city';
        // Sync preset dropdown
        const presetSelEl = document.getElementById('cityPresetSel');
        if (presetSelEl) presetSelEl.value = levelEditor.cities[idx].preset || 'none';
      } else {
        levelEditor.selectedCityIndex = -1;
        nameInp.value = levelEditor.nextCityName || '';
        nameInp.placeholder = 'next city name (auto)';
      }
      _refreshEditorSelectionPanel();
      _refreshEditorHud();
    });

    // ── Generate Map ──
    const genSection = createDiv().addClass("editor-section editor-card").parent(sidebar);
    createElement("h4", "Generate Map").parent(genSection);

    const genOpts = createDiv().addClass("editor-field-column").parent(genSection);

    // City count
    const genCityRow = createDiv().addClass("editor-form-row").parent(genOpts);
    createSpan("Cities:").parent(genCityRow).addClass("editor-field-label");
    const genCityInp = createElement("input").parent(genCityRow).attribute("type", "number")
      .attribute("min", "0").attribute("max", "20").attribute("value", "4")
      .addClass("editor-num-input").style("width", "44px");

    // Raider count
    const genRaiderRow = createDiv().addClass("editor-form-row").parent(genOpts);
    createSpan("Raiders:").parent(genRaiderRow).addClass("editor-field-label");
    const genRaiderInp = createElement("input").parent(genRaiderRow).attribute("type", "number")
      .attribute("min", "0").attribute("max", "20").attribute("value", "3")
      .addClass("editor-num-input").style("width", "44px");

    const genSeedRow = createDiv().addClass("editor-form-row").parent(genOpts);
    createSpan("Seed:").parent(genSeedRow).addClass("editor-field-label");
    const genSeedInp = createElement("input").parent(genSeedRow)
      .attribute("type", "number")
      .attribute("placeholder", "Random each generate")
      .addClass("editor-num-input")
      .style("flex", "1");
    const genSeedLockBtn = _editorCreateAtlasButton(genSeedRow, "Eye", "", "Seed unlocked", "editor-small-btn", 16)
      .style("min-width", "36px")
      .style("padding", "4px 8px");
    let genSeedLocked = false;
    let lastGeneratedSeed = null;
    let autoSeedPinned = false;

    function updateGenSeedUi() {
      const lastSeedText = Number.isFinite(lastGeneratedSeed) ? ` (last ${lastGeneratedSeed})` : '';
      const placeholder = genSeedLocked
        ? `Locked seed${lastSeedText}`
        : `Random each generate${lastSeedText}`;
      genSeedInp.attribute("placeholder", placeholder);
      _editorSetAtlasContent(genSeedLockBtn, genSeedLocked ? "Shield" : "Eye", "", 16);
      genSeedLockBtn.attribute(
        "title",
        genSeedLocked
          ? "Seed locked: Generate reuses the current seed"
          : "Seed unlocked: blank seed randomizes on every Generate"
      );
      if (genSeedLocked) genSeedLockBtn.addClass("editor-tool-active");
      else genSeedLockBtn.removeClass("editor-tool-active");
    }

    genSeedInp.input(() => {
      autoSeedPinned = false;
    });
    genSeedLockBtn.mousePressed(() => {
      genSeedLocked = !genSeedLocked;
      if (genSeedLocked) {
        const rawSeed = String(genSeedInp.value() || '').trim();
        if (rawSeed === '' && Number.isFinite(lastGeneratedSeed)) {
          genSeedInp.value(String(lastGeneratedSeed));
          autoSeedPinned = true;
        }
      } else if (autoSeedPinned) {
        genSeedInp.value('');
        autoSeedPinned = false;
      }
      updateGenSeedUi();
    });
    updateGenSeedUi();

    const genLandmassRow = createDiv().addClass("editor-form-row").parent(genOpts);
    createSpan("Landmass:").parent(genLandmassRow).addClass("editor-field-label");
    const genLandmassSel = createElement("select").parent(genLandmassRow).addClass("editor-select-input").style("flex", "1");
    for (const [v, l] of [[0, "Islands"], [1, "Normal"], [2, "Continents"]]) {
      createElement("option", l).parent(genLandmassSel).attribute("value", String(v));
    }
    genLandmassSel.value("1");

    function makeGenSlider(label, min, max, step, value) {
      const row = createDiv().addClass("editor-form-row").parent(genOpts);
      createSpan(`${label}:`).parent(row).addClass("editor-field-label");
      const slider = createElement("input").parent(row).attribute("type", "range")
        .attribute("min", String(min))
        .attribute("max", String(max))
        .attribute("step", String(step))
        .attribute("value", String(value))
        .style("flex", "1")
        .style("height", "14px");
      const readout = createSpan(Number(value).toFixed(2)).parent(row).addClass("editor-inline-value");
      slider.input(() => readout.html(Number(slider.value() || value).toFixed(2)));
      return slider;
    }

    const genWarpSlider = makeGenSlider("Warp", 0, 2, 0.05, 1.0);
    const genRuggedSlider = makeGenSlider("Rugged", 0.5, 2, 0.05, 1.0);
    const genTempSlider = makeGenSlider("Temp", 0, 2, 0.05, 1.0);
    const genMoistureSlider = makeGenSlider("Moisture", 0, 2, 0.05, 1.0);
    const genCoastSlider = makeGenSlider("Coast", 0.4, 2.2, 0.05, 1.0);

    function readNonNegativeInt(inputEl, fallback) {
      const n = parseInt(inputEl.value(), 10);
      return Number.isFinite(n) ? Math.max(0, n) : fallback;
    }

    function readSlider(sliderEl, fallback) {
      const n = parseFloat(sliderEl.value());
      return Number.isFinite(n) ? n : fallback;
    }

    createP("Uses the same seed, landmass, and terrain sliders as the new-game configurator.")
      .parent(genSection)
      .style("color", "#9aa7b5")
      .style("font-size", "11px")
      .style("margin", "6px 0 0");

    _editorCreateAtlasButton(genSection, "Globe", "Generate", "Generate map", "editor-play-btn", 16).style("margin-top", "6px")
      .mousePressed(() => {
        if (!levelEditor) return;
        _editorToast("Generating map…", "info");
        setTimeout(() => {
          const rawSeed = String(genSeedInp.value() || '').trim();
          const hasExplicitSeed = rawSeed !== '';
          const result = levelEditor.generateMap({
            seed: hasExplicitSeed ? Number(rawSeed) : null,
            landmass: Number(genLandmassSel.value()),
            worldGenConfig: {
              warp: readSlider(genWarpSlider, 1.0),
              ruggedness: readSlider(genRuggedSlider, 1.0),
              temperatureVariance: readSlider(genTempSlider, 1.0),
              moistureVariance: readSlider(genMoistureSlider, 1.0),
              coastalDropoff: readSlider(genCoastSlider, 1.0),
            },
            cityCount: readNonNegativeInt(genCityInp, 4),
            raiderCount: readNonNegativeInt(genRaiderInp, 3),
          });
          if (result && Number.isFinite(result.seed)) {
            lastGeneratedSeed = result.seed;
            if (hasExplicitSeed || genSeedLocked) {
              genSeedInp.value(String(result.seed));
              autoSeedPinned = !hasExplicitSeed;
            } else {
              genSeedInp.value('');
              autoSeedPinned = false;
            }
            updateGenSeedUi();
          }
          levelEditor.centreCamera();
          _refreshEditorCitySelect();
          _refreshEditorSelectionPanel();
          _refreshEditorHud();
          const seedSuffix = result && Number.isFinite(result.seed) ? ` Seed ${result.seed}.` : '';
          _editorToast(`Map generated.${seedSuffix}`, "success");
        }, 30);
      });

    // ── Save / Load ──
    const saveSection = createDiv().addClass("editor-section editor-card").parent(sidebar);
    createElement("h4", "Save / Load").parent(saveSection);

    const slotRow = createDiv().addClass("editor-form-row").style("margin-bottom", "6px").parent(saveSection);
    const slotInp = createElement("input").parent(slotRow).addClass("editor-num-input").style("flex", "1");
    slotInp.attribute("type", "text"); slotInp.attribute("placeholder", "Map name");
    slotInp.attribute("value", "mymap"); slotInp.id("editorSlotName");

    const saveBtnRow = createDiv().addClass("editor-form-row").parent(saveSection);
    createButton("Save").parent(saveBtnRow).addClass("editor-small-btn").mousePressed(() => {
      const name = select("#editorSlotName")?.value() || 'mymap';
      if (levelEditor) {
        levelEditor.saveToStorage(name);
        _refreshEditorHud();
        _editorToast(`Map "${name}" saved!`, "success");
      }
    });
    createButton("Load").parent(saveBtnRow).addClass("editor-small-btn").mousePressed(() => {
      const name = select("#editorSlotName")?.value() || 'mymap';
      if (levelEditor) {
        if (levelEditor.loadFromStorage(name)) {
          levelEditor.centreCamera();
          select("#editorCols")?.value(levelEditor.cols);
          select("#editorRows")?.value(levelEditor.rows);
          _refreshEditorCitySelect();
          _refreshEditorSelectionPanel();
          _refreshEditorHud();
          _editorToast(`Map "${name}" loaded!`, "success");
        } else {
          _editorToast(`No saved map named "${name}"`, "error");
        }
      }
    });
    createButton("Delete").parent(saveBtnRow).addClass("editor-small-btn editor-action-danger").mousePressed(() => {
      const name = select("#editorSlotName")?.value() || 'mymap';
      _editorConfirm(`Delete map "${name}"?`, () => {
        LevelEditor.deleteSavedMap(name);
        _refreshEditorHud();
        _editorToast(`Map "${name}" deleted.`, "info");
      });
    });
    createButton("Clear Map").parent(saveBtnRow).addClass("editor-small-btn editor-action-danger").mousePressed(() => {
      if (!levelEditor) return;
      _editorConfirm("Clear entire map? This cannot be undone.", () => {
        levelEditor._initGrid();
        levelEditor.centreCamera();
        _refreshEditorCitySelect();
        _refreshEditorSelectionPanel();
        _refreshEditorHud();
        _editorToast("Map cleared.", "info");
      });
    });

    // List saved maps
    const listBtn = createButton("List Saved Maps").parent(saveSection).addClass("editor-action-btn").style("margin-top", "4px");
    const listDiv = createDiv().parent(saveSection).addClass("editor-map-list");
    listDiv.id("editorMapList");
    listBtn.mousePressed(() => {
      const maps = LevelEditor.listSavedMaps();
      const ld = select("#editorMapList");
      if (ld) {
        const node = ld.elt;
        node.replaceChildren();
        if (maps.length) {
          maps.forEach((m) => {
            const row = document.createElement("div");
            row.className = "editor-saved-item";
            row.setAttribute("data-name", m);
            _editorSetAtlasContent(row, "Book", m, 14);
            node.appendChild(row);
          });
        } else {
          node.innerHTML = '<em>No saved maps</em>';
        }
      }
      document.querySelectorAll('.editor-saved-item').forEach(el => {
        el.addEventListener('click', () => {
          const n = el.getAttribute('data-name');
          select("#editorSlotName")?.value(n);
          if (levelEditor && levelEditor.loadFromStorage(n)) {
            levelEditor.centreCamera();
            select("#editorCols")?.value(levelEditor.cols);
            select("#editorRows")?.value(levelEditor.rows);
            _refreshEditorCitySelect();
            _refreshEditorSelectionPanel();
            _refreshEditorHud();
          }
        });
      });
    });

    // ── JSON Export / Import ──
    const jsonSection = createDiv().addClass("editor-section editor-card").parent(sidebar);
    createElement("h4", "Share Map").parent(jsonSection);

    const exportRow = createDiv().addClass("editor-form-row").parent(jsonSection);
    _editorCreateAtlasButton(exportRow, "Chart", "Export JSON", "Export JSON", "editor-small-btn", 14).mousePressed(() => {
      if (!levelEditor) return;
      const json = JSON.stringify(levelEditor.buildWorldSnapshot(), null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const name = select("#editorSlotName")?.value() || 'mymap';
      a.href = url;
      a.download = `${name}.bqmap.json`;
      a.click();
      URL.revokeObjectURL(url);
      _editorToast("Map exported!", "success");
    });
    _editorCreateAtlasButton(exportRow, "Book", "Copy JSON", "Copy JSON", "editor-small-btn", 14).mousePressed(() => {
      if (!levelEditor) return;
      const json = JSON.stringify(levelEditor.buildWorldSnapshot());
      navigator.clipboard?.writeText(json).then(() => {
        _editorToast("JSON copied to clipboard!", "success");
      }).catch(() => {
        _editorToast("Clipboard not available.", "error");
      });
    });

    // Hidden file input for import
    const fileInput = createElement("input").attribute("type", "file").attribute("accept", ".json,.bqmap.json,.bqmap")
      .style("display", "none").id("editorImportFile").parent(jsonSection);

    const importRow = createDiv().addClass("editor-form-row").style("margin-top", "4px").parent(jsonSection);
    _editorCreateAtlasButton(importRow, "Chart", "Import File", "Import File", "editor-small-btn", 14).mousePressed(() => {
      document.getElementById('editorImportFile')?.click();
    });

    const pasteImportBtn = _editorCreateAtlasButton(importRow, "Book", "Paste JSON", "Paste JSON", "editor-small-btn", 14);
    pasteImportBtn.mousePressed(async () => {
      try {
        const text = await navigator.clipboard?.readText();
        if (!text) { _editorToast("Clipboard is empty.", "error"); return; }
        _editorImportJSON(text);
      } catch (e) {
        _editorToast("Cannot read clipboard — use Import File instead.", "error");
      }
    });

    fileInput.elt.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => _editorImportJSON(ev.target.result, file.name.replace(/\.(bqmap\.json|json|bqmap)$/, ''));
      reader.readAsText(file);
      e.target.value = '';
    });

    // ── Play / Back ──
    const bottomSection = createDiv().addClass("editor-section editor-card").style("margin-top", "auto").parent(sidebar);

    createButton("Play This Map").parent(bottomSection).addClass("editor-play-btn")
      .mousePressed(() => {
        if (typeof startGameFromEditor === 'function') startGameFromEditor();
      });

    createButton("Back to Menu").parent(bottomSection).addClass("editor-action-btn")
      .style("margin-top", "6px")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.MAIN_MENU);
      });

    // ── Help text ──
    createDiv().id("editorHelpText").parent(sidebar).addClass("editor-help-text");
    _refreshEditorHelpText();

    // Mobile panel toggles (hidden on desktop via CSS)
    const mobileToggles = createDiv().id("editorMobileToggles").addClass("editor-mobile-toggles").parent(wrapper);
    createButton("Tools").id("editorToggleTopbar").addClass("editor-mobile-toggle-btn").parent(mobileToggles)
      .mousePressed(() => _toggleEditorMobilePanel("topbar"));
    createButton("Panels").id("editorToggleSidebar").addClass("editor-mobile-toggle-btn").parent(mobileToggles)
      .mousePressed(() => _toggleEditorMobilePanel("sidebar"));

    return wrapper;
  },

  show: () => {
    const w = select("#editorToolbar");
    if (w) w.style("display", "block");
    _syncEditorMobilePanelDefaults();
    document.addEventListener('contextmenu', _editorBlockContext);
    setTimeout(() => {
      if (levelEditor) {
        _highlightEditorTool(levelEditor.currentTool);
        _highlightEditorBrush(levelEditor.brushSize);
        _refreshEditorCitySelect();
        _refreshEditorHud();
        _refreshEditorHelpText();
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

function _isMobileEditorViewport() {
  if (typeof window === 'undefined') return false;
  try {
    if (typeof window.getMobileContext === 'function' && window.getMobileContext().mobile) return true;
    if (typeof window.isMobile === 'function' && window.isMobile()) return true;
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 1024) return true;
  } catch (_e) {}
  return window.innerWidth <= 700;
}

function _syncEditorMobilePanelDefaults() {
  const toolbar = document.getElementById("editorToolbar");
  if (!toolbar) return;
  if (_isMobileEditorViewport()) {
    toolbar.classList.add("editor-mobile-sidebar-hidden");
    toolbar.classList.remove("editor-mobile-topbar-hidden");
  } else {
    toolbar.classList.remove("editor-mobile-sidebar-hidden", "editor-mobile-topbar-hidden");
  }
}

function _toggleEditorMobilePanel(panel) {
  const toolbar = document.getElementById("editorToolbar");
  if (!toolbar || !_isMobileEditorViewport()) return;
  if (panel === "topbar") {
    toolbar.classList.toggle("editor-mobile-topbar-hidden");
  } else if (panel === "sidebar") {
    toolbar.classList.toggle("editor-mobile-sidebar-hidden");
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("resize", _syncEditorMobilePanelDefaults);
}

function _editorImportJSON(text, suggestedName) {
  try {
    const data = JSON.parse(text);
    if (!data || (!data.grid && !Array.isArray(data.elements))) {
      _editorToast("Invalid map JSON.", "error");
      return;
    }
    if (!levelEditor) return;
    levelEditor.loadWorldSnapshot(data);
    levelEditor.centreCamera();
    select("#editorCols")?.value(levelEditor.cols);
    select("#editorRows")?.value(levelEditor.rows);
    if (suggestedName) {
      const slotInp = select("#editorSlotName");
      if (slotInp) slotInp.value(suggestedName);
    }
    _refreshEditorCitySelect();
    _refreshEditorSelectionPanel();
    _refreshEditorHud();
    _editorToast("Map imported!", "success");
  } catch (e) {
    _editorToast("Failed to parse JSON.", "error");
    console.error("Editor import error:", e);
  }
}

function _refreshEditorHelpText() {
  const help = select("#editorHelpText");
  if (!help) return;
  const move = `${getActionDisplay('moveUp')}/${getActionDisplay('moveDown')}/${getActionDisplay('moveLeft')}/${getActionDisplay('moveRight')}`;
  help.html(`${move} / Right-drag: Pan &nbsp;|&nbsp; Scroll: Zoom<br>Terrain: Q/E/R/T/Y/U &nbsp;|&nbsp; I: Select &nbsp;|&nbsp; Del: Remove Selection<br>${getActionDisplay('editorFlood')}: Fill &nbsp;|&nbsp; 1-9: Brush &nbsp;|&nbsp; ${getActionDisplay('editorUndo')}: Undo &nbsp;|&nbsp; Ctrl+Y: Redo`);
}

/** Highlight the active tool button */
function _highlightEditorTool(toolName) {
  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.classList.toggle('editor-tool-active', btn.getAttribute('data-tool') === toolName);
  });
  _refreshEditorHud();
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
  _refreshEditorHud();
}

/** Refresh the city dropdown in the editor */
function _refreshEditorCitySelect() {
  const sel = document.getElementById('editorCitySelect');
  if (!sel || !levelEditor) return;
  const selectedIdx = levelEditor.selectedCityIndex;
  sel.innerHTML = '<option value="">— none —</option>';
  for (let i = 0; i < levelEditor.cities.length; i++) {
    const c = levelEditor.cities[i];
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${c.name} (${c.x},${c.y})`;
    sel.appendChild(opt);
  }
  if (selectedIdx >= 0 && selectedIdx < levelEditor.cities.length) {
    sel.value = String(selectedIdx);
  }
  // Reset name input to "next city" mode
  const nameInp = document.getElementById('editorCityNameInput');
  if (nameInp && selectedIdx >= 0 && selectedIdx < levelEditor.cities.length) {
    nameInp.value = levelEditor.cities[selectedIdx].name || '';
    nameInp.placeholder = 'rename city';
  } else if (nameInp) {
    nameInp.value = levelEditor.nextCityName || '';
    nameInp.placeholder = 'next city name (auto)';
  }
  _refreshEditorCityInventory();
  _refreshEditorSelectionPanel();
  _refreshEditorHud();
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
    row.className = 'editor-city-item-row';
    // Left side: icon + name
    const left = document.createElement('span');
    left.className = 'editor-city-item-left';
    if (typeof createItemIconEl === 'function') {
      left.appendChild(createItemIconEl(key, 14));
    }
    const nameSpan = document.createElement('span');
    nameSpan.textContent = key;
    left.appendChild(nameSpan);
    row.appendChild(left);
    // Right side: quantity + remove button
    const right = document.createElement('span');
    right.className = 'editor-city-item-right';
    const qtySpan = document.createElement('span');
    qtySpan.className = 'editor-city-item-qty';
    qtySpan.textContent = `×${qty}`;
    right.appendChild(qtySpan);
    const rmBtn = document.createElement('button');
    rmBtn.className = 'editor-city-item-remove';
    rmBtn.setAttribute('data-city', idx);
    rmBtn.setAttribute('data-item', key);
    rmBtn.textContent = '\u2715';
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
        _refreshEditorHud();
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
  _refreshEditorHud();
}

/** Called when a city is placed/toggled — auto-refresh the select */
function _editorOnCityChanged() {
  _refreshEditorCitySelect();
  // Sync preset dropdown to selected city or fallback to last placed city
  const presetSelEl = document.getElementById('cityPresetSel');
  if (presetSelEl && typeof levelEditor !== 'undefined' && levelEditor?.cities.length > 0) {
    const idx = (levelEditor.selectedCityIndex >= 0 && levelEditor.selectedCityIndex < levelEditor.cities.length)
      ? levelEditor.selectedCityIndex
      : levelEditor.cities.length - 1;
    presetSelEl.value = levelEditor.cities[idx].preset || 'none';
  }
  _refreshEditorSelectionPanel();
  _refreshEditorHud();
}

function _editorOnSelectionChanged() {
  _refreshEditorSelectionPanel();
  _refreshEditorHud();
}

function _refreshEditorHud(hoverTile) {
  if (!levelEditor) return;
  const toolEl = document.getElementById('editorStatusTool');
  if (toolEl) toolEl.textContent = `Tool: ${levelEditor.currentTool}`;
  const dim = (Math.max(1, levelEditor.brushSize) - 1) * 2 + 1;
  const brushEl = document.getElementById('editorStatusBrush');
  if (brushEl) brushEl.textContent = `Brush: ${dim}x${dim}`;
  const tileEl = document.getElementById('editorStatusTile');
  if (tileEl) {
    const mx = (typeof mouseX === 'number') ? mouseX : 0;
    const my = (typeof mouseY === 'number') ? mouseY : 0;
    const tile = hoverTile || levelEditor.screenToGrid(mx, my);
    tileEl.textContent = `Tile: ${tile.x},${tile.y}`;
  }
  const countsEl = document.getElementById('editorStatusCounts');
  if (countsEl) {
    let selectionText = 'None';
    if (levelEditor.selectedCityIndex >= 0) selectionText = 'City';
    else if (levelEditor.selectedRaiderIndex >= 0) selectionText = 'Raider';
    else if (levelEditor.selectedPlayerStart) selectionText = 'Start';
    countsEl.textContent = `Cities: ${levelEditor.cities.length} | Raiders: ${levelEditor.raiderSpawns.length} | Sel: ${selectionText}`;
  }
}

function _focusSelectedEntity() {
  if (!levelEditor) return;
  let target = null;
  if (levelEditor.selectedCityIndex >= 0 && levelEditor.selectedCityIndex < levelEditor.cities.length) {
    target = levelEditor.cities[levelEditor.selectedCityIndex];
  } else if (levelEditor.selectedRaiderIndex >= 0 && levelEditor.selectedRaiderIndex < levelEditor.raiderSpawns.length) {
    target = levelEditor.raiderSpawns[levelEditor.selectedRaiderIndex];
  } else if (levelEditor.selectedPlayerStart && levelEditor.playerStart) {
    target = levelEditor.playerStart;
  }
  if (!target) return;
  levelEditor.camX = target.x * levelEditor.tileSize + levelEditor.tileSize / 2;
  levelEditor.camY = target.y * levelEditor.tileSize + levelEditor.tileSize / 2;
}

/**
 * Show a brief toast notification inside the level editor.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
function _editorToast(message, type = 'info') {
  let container = document.getElementById('editorToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'editorToastContainer';
    container.style.cssText = 'position:fixed;bottom:56px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;';
    document.body.appendChild(container);
  }
  const colors = { success: '#2e7d32', error: '#b71c1c', info: '#1565c0' };
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    background:${colors[type] || colors.info};
    color:#fff;font-size:13px;padding:7px 16px;border-radius:8px;
    box-shadow:0 2px 12px rgba(0,0,0,0.5);
    opacity:1;transition:opacity 0.4s;white-space:nowrap;
  `;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; }, 2000);
  setTimeout(() => { toast.remove(); }, 2450);
}

/**
 * Show an inline confirmation banner inside the editor (replaces confirm()).
 * @param {string} message
 * @param {Function} onConfirm
 */
function _editorConfirm(message, onConfirm) {
  // Remove any existing confirm banner
  document.getElementById('editorConfirmBanner')?.remove();

  const banner = document.createElement('div');
  banner.id = 'editorConfirmBanner';
  banner.style.cssText = `
    position:fixed;bottom:0;left:0;right:0;z-index:10000;
    background:#1a1210;border-top:2px solid #c0392b;
    color:#fde8e8;font-size:14px;padding:10px 16px;
    display:flex;align-items:center;justify-content:space-between;gap:12px;
  `;
  const msg = document.createElement('span');
  msg.textContent = message;
  banner.appendChild(msg);

  const btns = document.createElement('span');
  btns.style.cssText = 'display:flex;gap:8px;flex-shrink:0;';

  const yes = document.createElement('button');
  yes.textContent = 'Yes, do it';
  yes.style.cssText = 'background:#c0392b;color:#fff;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:13px;';
  yes.onclick = () => { banner.remove(); onConfirm(); };

  const no = document.createElement('button');
  no.textContent = 'Cancel';
  no.style.cssText = 'background:#333;color:#ccc;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:13px;';
  no.onclick = () => banner.remove();

  btns.appendChild(yes);
  btns.appendChild(no);
  banner.appendChild(btns);
  document.body.appendChild(banner);

  // Auto-dismiss after 8s
  setTimeout(() => { if (document.body.contains(banner)) banner.remove(); }, 8000);
}

function _refreshEditorSelectionPanel() {
  const info = document.getElementById('editorSelectionInfo');
  if (!info || !levelEditor) return;

  if (levelEditor.selectedCityIndex >= 0 && levelEditor.selectedCityIndex < levelEditor.cities.length) {
    const c = levelEditor.cities[levelEditor.selectedCityIndex];
    info.innerHTML = `<strong>City</strong>: ${c.name}<br><span class="editor-selection-meta">Tile ${c.x},${c.y}</span>`;
    const citySel = document.getElementById('editorCitySelect');
    if (citySel) citySel.value = String(levelEditor.selectedCityIndex);
    return;
  }

  if (levelEditor.selectedRaiderIndex >= 0 && levelEditor.selectedRaiderIndex < levelEditor.raiderSpawns.length) {
    const r = levelEditor.raiderSpawns[levelEditor.selectedRaiderIndex];
    const rName = r.name && r.name.trim() ? r.name : `${r.type} (${r.strength})`;
    info.innerHTML = `<strong>Raider</strong>: ${rName}<br><span class="editor-selection-meta">Tile ${r.x},${r.y}</span>`;
    return;
  }

  if (levelEditor.selectedPlayerStart && levelEditor.playerStart) {
    const ps = levelEditor.playerStart;
    info.innerHTML = `<strong>Player Start</strong><br><span class="editor-selection-meta">Tile ${ps.x},${ps.y}</span>`;
    return;
  }

  info.textContent = 'Nothing selected';
}
