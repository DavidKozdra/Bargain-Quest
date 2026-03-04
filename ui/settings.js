// ============================
// SETTINGS MENU (moved out of ui.js)
// ============================
uiManager.registerScreen("settingsMenu", {
  validStates: [GameStates.SETTINGS],

  create: () => {
    const wrapper = createDiv().id("settingsMenu").class("screen");
    wrapper.style("max-width", "560px").style("max-height", "90vh").style("overflow-y", "hidden");

    createElement("h2", "Settings").parent(wrapper);

    // ── Tab Bar ──
    const tabBar = createDiv().class("settings-tab-bar").parent(wrapper);
    const tabDefs = [
      { label: "Audio", key: "audio" },
      { label: "Game", key: "game" },
      { label: "Controls", key: "controls" },
      { label: "Visual", key: "visual" },
    ];

    function switchSettingsTab(tabKey) {
      window._settingsTab = tabKey;
      selectAll(".settings-tab-btn").forEach(btn => {
        if (btn.attribute("data-tab") === tabKey) btn.addClass("settings-tab-active");
        else btn.removeClass("settings-tab-active");
      });
      for (const t of tabDefs) {
        const panel = select(`#settingsTab_${t.key}`);
        if (panel) panel.style("display", t.key === tabKey ? "block" : "none");
      }
    }

    for (const t of tabDefs) {
      createButton(t.label)
        .parent(tabBar)
        .addClass("settings-tab-btn")
        .attribute("data-tab", t.key)
        .mousePressed(() => switchSettingsTab(t.key));
    }

    // ══════════════════════════════════
    //  TAB: Audio
    // ══════════════════════════════════
    const audioPanel = createDiv().id("settingsTab_audio").class("settings-tab-panel").parent(wrapper);

    // ── Audio ──
    const audioSection = createDiv().addClass("config-section").parent(audioPanel);
    createElement("h3", "Audio").parent(audioSection).style("margin-bottom", "8px");

    const musicRow = createDiv().addClass("settings-slider-row").parent(audioSection);
    createSpan("Music").addClass("settings-slider-label").parent(musicRow);
    createSlider(0, 1, 0.5, 0.01).id("musicSlider").addClass("size-slider").parent(musicRow);

    const sfxRow = createDiv().addClass("settings-slider-row").parent(audioSection);
    createSpan("Sound").addClass("settings-slider-label").parent(sfxRow);
    createSlider(0, 1, 0.5, 0.01).id("gameSlider").addClass("size-slider").parent(sfxRow);

    // (Game Speed moved to Game tab)

    // ══════════════════════════════════
    //  TAB: Game
    // ══════════════════════════════════
    const gamePanel = createDiv().id("settingsTab_game").class("settings-tab-panel").parent(wrapper);

    // ── Game & Performance ──
    const aiSection = createDiv().addClass("config-section").parent(gamePanel);
    createElement("h3", "Game & Performance").parent(aiSection).style("margin-bottom","8px");
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

    // ── Game Speed (moved here from Audio tab) ──
    const speedSection = createDiv().addClass("config-section").parent(gamePanel);
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

    // ══════════════════════════════════
    //  TAB: Controls
    // ══════════════════════════════════
    const controlsPanel = createDiv().id("settingsTab_controls").class("settings-tab-panel").parent(wrapper);

    // ── Controls ──
    const controlsSection = createDiv().addClass("config-section").parent(controlsPanel);
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

    // ══════════════════════════════════
    //  TAB: Visual
    // ══════════════════════════════════
    const visualPanel = createDiv().id("settingsTab_visual").class("settings-tab-panel").parent(wrapper);

    // ── Visual Effects ──
    const effectsSection = createDiv().addClass("config-section").parent(visualPanel);
    createElement("h3", "Visual Effects").parent(effectsSection).style("margin-bottom", "8px");
    const effectsRow = createDiv().addClass("settings-row").parent(effectsSection);
    createSpan("Enable Combat Effects").addClass("settings-slider-label").parent(effectsRow);
    const enabled = (localStorage.getItem('pref_combat_effects') !== 'false');
    const effectsToggle = createCheckbox('', enabled).id('combatEffectsToggle').parent(effectsRow);
    effectsToggle.changed(() => {
      const v = document.getElementById('combatEffectsToggle').checked;
      localStorage.setItem('pref_combat_effects', v ? 'true' : 'false');
    });

    const intensityRow = createDiv().addClass("settings-row").parent(effectsSection);
    createSpan("Effects Intensity").addClass("settings-slider-label").parent(intensityRow);
    const intensitySelect = createSelect().id('combatEffectsIntensity').parent(intensityRow).addClass('setting-select');
    intensitySelect.option('Subtle', 'subtle');
    intensitySelect.option('Medium', 'medium');
    intensitySelect.option('Heavy', 'heavy');
    const cur = localStorage.getItem('pref_combat_effects_intensity') || 'medium';
    intensitySelect.selected(cur);
    intensitySelect.changed(() => {
      localStorage.setItem('pref_combat_effects_intensity', intensitySelect.value());
    });

    // ── Danger Zone ──
    const dangerSection = createDiv().addClass("config-section").parent(visualPanel).style("margin-top", "12px").style("border-color", "#6b2020");
    createElement("h3", "Danger Zone").parent(dangerSection).style("margin-bottom", "8px").style("color", "#e74c3c");
    createButton("Clear All Saved Data")
      .parent(dangerSection)
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

    // ── Back button (always visible, outside tabs) ──
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

      // ── Activate correct tab ──
      const tab = window._settingsTab || "audio";
      const tabKeys = ["audio", "game", "controls", "visual"];
      selectAll(".settings-tab-btn").forEach(btn => {
        if (btn.attribute("data-tab") === tab) btn.addClass("settings-tab-active");
        else btn.removeClass("settings-tab-active");
      });
      for (const t of tabKeys) {
        const panel = select(`#settingsTab_${t}`);
        if (panel) panel.style("display", t === tab ? "block" : "none");
      }

      // ── Sync Audio tab ──
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

      // ── Sync Controls tab ──
      if (typeof _buildKeybindRows === 'function') _buildKeybindRows();

      // ── Sync World tab ──
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
