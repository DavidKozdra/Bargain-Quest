// LEVEL EDITOR TOOLBAR (extracted from ui.js)
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
    createButton("Clear Map").parent(saveBtnRow).addClass("editor-small-btn editor-action-danger").mousePressed(() => {
      if (levelEditor && confirm("Clear entire map?")) {
        levelEditor._initGrid();
        levelEditor.centreCamera();
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
