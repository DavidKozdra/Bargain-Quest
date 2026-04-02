// ============================================================
//  Theme Editor Modal
//  Opens as a DOM overlay on top of Settings.
//  No GameState change required.
// ============================================================

const THEME_EDITOR_VARS = [
  { key: "--bg",           label: "Background",      hint: "Main page/canvas background" },
  { key: "--panel",        label: "Panel",            hint: "Cards, screens, drawers" },
  { key: "--accent",       label: "Accent",           hint: "Highlights, active borders, headings" },
  { key: "--accent-hover", label: "Accent Hover",     hint: "Accent on hover / brighter version" },
  { key: "--text",         label: "Text",             hint: "Primary body text" },
  { key: "--text-muted",   label: "Text Muted",       hint: "Secondary / dimmed text" },
  { key: "--btn-bg",       label: "Button BG",        hint: "Button resting background" },
  { key: "--btn-hover",    label: "Button Hover BG",  hint: "Button hover background" },
  { key: "--border",       label: "Border",           hint: "Borders, dividers, card edges" },
  { key: "--danger",       label: "Danger",           hint: "Error / destructive action colour" },
];

// Built-in theme default values (matches themes.css + :root in style.css)
const THEME_EDITOR_PRESETS = {
  default:   { "--bg":"#0b0a10","--panel":"#14121e","--accent":"#caa350","--accent-hover":"#e8c860","--text":"#eae0c2","--text-muted":"#7a7060","--btn-bg":"#2a2520","--btn-hover":"#3a3530","--border":"#7d5a29","--danger":"#f44336" },
  parchment: { "--bg":"#1c1208","--panel":"#2a1e0e","--accent":"#d4903a","--accent-hover":"#f0b050","--text":"#f5e8c8","--text-muted":"#9a7a50","--btn-bg":"#3a2a14","--btn-hover":"#4e3a1e","--border":"#8b5e2a","--danger":"#e53935" },
  ocean:     { "--bg":"#060d1a","--panel":"#0c1828","--accent":"#4fc3f7","--accent-hover":"#81d4fa","--text":"#d6eaf8","--text-muted":"#5b8fa8","--btn-bg":"#122030","--btn-hover":"#1e3040","--border":"#1e5070","--danger":"#ef5350" },
  emerald:   { "--bg":"#050f08","--panel":"#0b1c10","--accent":"#4caf7d","--accent-hover":"#6fcf97","--text":"#d4edda","--text-muted":"#4a7a5a","--btn-bg":"#112818","--btn-hover":"#1a3a22","--border":"#266040","--danger":"#e53935" },
  crimson:   { "--bg":"#0d0505","--panel":"#1a0a0a","--accent":"#e53935","--accent-hover":"#ef5350","--text":"#fde8e8","--text-muted":"#7a4040","--btn-bg":"#2a1010","--btn-hover":"#3a1a1a","--border":"#6b2020","--danger":"#ff7043" },
  slate:     { "--bg":"#0a0c10","--panel":"#141820","--accent":"#90a4ae","--accent-hover":"#b0bec5","--text":"#eceff1","--text-muted":"#607080","--btn-bg":"#1e2430","--btn-hover":"#2a3040","--border":"#3a4858","--danger":"#ef5350" },
  amethyst:  { "--bg":"#080610","--panel":"#120e20","--accent":"#ab87e8","--accent-hover":"#c9a7ff","--text":"#ede8ff","--text-muted":"#6a5a8a","--btn-bg":"#1e1830","--btn-hover":"#2e2448","--border":"#4a3478","--danger":"#ef5350" },
  light:     { "--bg":"#f0ece0","--panel":"#fff8ec","--accent":"#8b5e10","--accent-hover":"#a07020","--text":"#1a1208","--text-muted":"#5a4a30","--btn-bg":"#e0d4b8","--btn-hover":"#ccc0a0","--border":"#9a7a40","--danger":"#c62828" },
};

const CUSTOM_THEMES_KEY = "bq_custom_themes";

function _loadCustomThemes() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_THEMES_KEY) || "{}");
  } catch (_) { return {}; }
}

function _saveCustomThemes(obj) {
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(obj));
}

// Resolve all vars for a given theme key (built-in or custom)
function _resolveThemeVars(themeKey) {
  const customs = _loadCustomThemes();
  if (customs[themeKey]) return Object.assign({}, THEME_EDITOR_PRESETS.default, customs[themeKey].vars);
  return Object.assign({}, THEME_EDITOR_PRESETS[themeKey] || THEME_EDITOR_PRESETS.default);
}

// Apply a vars object as inline style overrides on :root for live preview,
// OR pass null to clear and fall back to the body[data-theme] stylesheet.
function _applyVarsToRoot(vars) {
  const root = document.documentElement;
  if (!vars) {
    THEME_EDITOR_VARS.forEach(v => root.style.removeProperty(v.key));
    return;
  }
  THEME_EDITOR_VARS.forEach(v => {
    if (vars[v.key]) root.style.setProperty(v.key, vars[v.key]);
  });
}

// ── Build and open the modal ──────────────────────────────────
window.openThemeEditor = function openThemeEditor() {
  // Remove any existing instance
  const existing = document.getElementById("themeEditorOverlay");
  if (existing) existing.remove();

  // Working copy of vars being edited
  let editVars = _resolveThemeVars(localStorage.getItem("pref_theme") || "default");
  let themeName = "";

  // ── Overlay backdrop ──
  const overlay = document.createElement("div");
  overlay.id = "themeEditorOverlay";
  overlay.className = "te-overlay";

  // ── Modal container ──
  const modal = document.createElement("div");
  modal.className = "te-modal";
  overlay.appendChild(modal);

  // Close on backdrop click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeEditor(false);
  });

  // ── Header ──
  const header = document.createElement("div");
  header.className = "te-header";
  header.innerHTML = `<h2 class="te-title">🎨 Theme Editor</h2>`;
  const closeBtn = document.createElement("button");
  closeBtn.className = "menu-close-btn te-close-btn";
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", "Close theme editor");
  closeBtn.addEventListener("click", () => closeEditor(false));
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // ── Body: two-column layout ──
  const body = document.createElement("div");
  body.className = "te-body";
  modal.appendChild(body);

  // ── LEFT: controls ──
  const left = document.createElement("div");
  left.className = "te-left";
  body.appendChild(left);

  // Load from preset
  const presetRow = document.createElement("div");
  presetRow.className = "te-row";
  presetRow.innerHTML = `<label class="te-label">Start from preset</label>`;
  const presetSel = document.createElement("select");
  presetSel.className = "setting-select te-preset-sel";
  const presetEntries = [
    ...Object.keys(THEME_EDITOR_PRESETS).map(k => ({ value: k, label: k.charAt(0).toUpperCase() + k.slice(1) })),
    ...(Object.keys(_loadCustomThemes()).map(k => ({ value: `custom:${k}`, label: `✏️ ${k}` }))),
  ];
  for (const p of presetEntries) {
    const opt = document.createElement("option");
    opt.value = p.value;
    opt.textContent = p.label;
    presetSel.appendChild(opt);
  }
  presetSel.value = localStorage.getItem("pref_theme") || "default";
  presetRow.appendChild(presetSel);
  left.appendChild(presetRow);

  presetSel.addEventListener("change", () => {
    const val = presetSel.value;
    if (val.startsWith("custom:")) {
      const customs = _loadCustomThemes();
      const name = val.slice(7);
      editVars = Object.assign({}, THEME_EDITOR_PRESETS.default, customs[name]?.vars || {});
    } else {
      editVars = Object.assign({}, THEME_EDITOR_PRESETS[val] || THEME_EDITOR_PRESETS.default);
    }
    syncPickers();
    _applyVarsToRoot(editVars);
    updatePreview();
  });

  // Color picker rows
  const pickersWrap = document.createElement("div");
  pickersWrap.className = "te-pickers";
  left.appendChild(pickersWrap);

  const pickerEls = {};

  for (const v of THEME_EDITOR_VARS) {
    const row = document.createElement("div");
    row.className = "te-picker-row";

    const swatch = document.createElement("input");
    swatch.type = "color";
    swatch.className = "te-color-swatch";
    swatch.value = rgbToHex(editVars[v.key] || "#888888");
    swatch.title = v.hint;
    swatch.setAttribute("aria-label", v.label);

    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.className = "config-custom-input te-hex-input";
    textInput.value = rgbToHex(editVars[v.key] || "#888888");
    textInput.setAttribute("aria-label", `${v.label} hex value`);
    textInput.maxLength = 9;

    const labelEl = document.createElement("span");
    labelEl.className = "te-var-label";
    labelEl.textContent = v.label;
    labelEl.title = v.hint;

    pickerEls[v.key] = { swatch, textInput };

    swatch.addEventListener("input", () => {
      editVars[v.key] = swatch.value;
      textInput.value = swatch.value;
      _applyVarsToRoot(editVars);
      updatePreview();
    });

    textInput.addEventListener("input", () => {
      const raw = textInput.value.trim();
      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) {
        editVars[v.key] = raw;
        swatch.value = raw;
        _applyVarsToRoot(editVars);
        updatePreview();
      }
    });

    textInput.addEventListener("blur", () => {
      // Snap back to last valid value if invalid on blur
      textInput.value = rgbToHex(editVars[v.key] || "#888888");
    });

    row.appendChild(swatch);
    row.appendChild(labelEl);
    row.appendChild(textInput);
    pickersWrap.appendChild(row);
  }

  function syncPickers() {
    for (const v of THEME_EDITOR_VARS) {
      const hex = rgbToHex(editVars[v.key] || "#888888");
      pickerEls[v.key].swatch.value = hex;
      pickerEls[v.key].textInput.value = hex;
    }
  }

  // Theme name input + save
  const saveRow = document.createElement("div");
  saveRow.className = "te-save-row";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "config-custom-input te-name-input";
  nameInput.placeholder = "Theme name…";
  nameInput.maxLength = 30;
  nameInput.setAttribute("aria-label", "Custom theme name");
  nameInput.addEventListener("input", () => { themeName = nameInput.value.trim(); });

  const saveBtn = document.createElement("button");
  saveBtn.className = "settings-btn te-save-btn";
  saveBtn.textContent = "💾 Save";
  saveBtn.addEventListener("click", () => saveTheme());

  saveRow.appendChild(nameInput);
  saveRow.appendChild(saveBtn);
  left.appendChild(saveRow);

  // Saved custom themes list
  const customListWrap = document.createElement("div");
  customListWrap.className = "te-custom-list";
  left.appendChild(customListWrap);

  function rebuildCustomList() {
    customListWrap.innerHTML = "";
    const customs = _loadCustomThemes();
    const keys = Object.keys(customs);
    if (keys.length === 0) {
      customListWrap.innerHTML = `<p class="te-empty">No saved custom themes yet.</p>`;
      return;
    }
    const listTitle = document.createElement("p");
    listTitle.className = "te-list-title";
    listTitle.textContent = "Saved custom themes";
    customListWrap.appendChild(listTitle);

    for (const k of keys) {
      const row = document.createElement("div");
      row.className = "te-custom-row";

      const swatchStrip = document.createElement("div");
      swatchStrip.className = "te-theme-strip";
      const vars = customs[k].vars || {};
      ["--bg","--panel","--accent","--text","--border"].forEach(varKey => {
        const dot = document.createElement("span");
        dot.className = "te-strip-dot";
        dot.style.background = vars[varKey] || "#888";
        swatchStrip.appendChild(dot);
      });

      const nameSpan = document.createElement("span");
      nameSpan.className = "te-custom-name";
      nameSpan.textContent = k;

      const applyBtn = document.createElement("button");
      applyBtn.className = "settings-btn te-mini-btn";
      applyBtn.textContent = "Apply";
      applyBtn.addEventListener("click", () => {
        saveAndApplyCustom(k, customs[k].vars);
      });

      const editBtn = document.createElement("button");
      editBtn.className = "settings-btn te-mini-btn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => {
        editVars = Object.assign({}, THEME_EDITOR_PRESETS.default, customs[k].vars || {});
        nameInput.value = k;
        themeName = k;
        syncPickers();
        _applyVarsToRoot(editVars);
        updatePreview();
      });

      const delBtn = document.createElement("button");
      delBtn.className = "danger-btn te-mini-btn";
      delBtn.textContent = "✕";
      delBtn.setAttribute("aria-label", `Delete theme ${k}`);
      delBtn.addEventListener("click", () => {
        if (!confirm(`Delete custom theme "${k}"?`)) return;
        const all = _loadCustomThemes();
        delete all[k];
        _saveCustomThemes(all);
        // If this was the active theme, revert to default
        if (localStorage.getItem("pref_theme") === `custom:${k}`) {
          localStorage.setItem("pref_theme", "default");
          if (typeof _applyThemePref === "function") _applyThemePref();
        }
        rebuildCustomList();
        rebuildPresetDropdown();
      });

      row.appendChild(swatchStrip);
      row.appendChild(nameSpan);
      row.appendChild(applyBtn);
      row.appendChild(editBtn);
      row.appendChild(delBtn);
      customListWrap.appendChild(row);
    }
  }

  function rebuildPresetDropdown() {
    presetSel.innerHTML = "";
    const entries = [
      ...Object.keys(THEME_EDITOR_PRESETS).map(k => ({ value: k, label: k.charAt(0).toUpperCase() + k.slice(1) })),
      ...Object.keys(_loadCustomThemes()).map(k => ({ value: `custom:${k}`, label: `✏️ ${k}` })),
    ];
    for (const p of entries) {
      const opt = document.createElement("option");
      opt.value = p.value;
      opt.textContent = p.label;
      presetSel.appendChild(opt);
    }
  }

  rebuildCustomList();

  // ── RIGHT: live preview ──
  const right = document.createElement("div");
  right.className = "te-right";
  body.appendChild(right);

  const previewTitle = document.createElement("p");
  previewTitle.className = "te-preview-title";
  previewTitle.textContent = "Live Preview";
  right.appendChild(previewTitle);

  const preview = document.createElement("div");
  preview.className = "te-preview";
  right.appendChild(preview);

  function updatePreview() {
    const v = editVars;
    preview.style.background = v["--bg"] || "#0b0a10";
    preview.style.color = v["--text"] || "#eae0c2";
    preview.style.borderColor = v["--border"] || "#7d5a29";
    preview.innerHTML = `
      <div class="te-prev-panel" style="background:${v["--panel"]};border-color:${v["--border"]}">
        <div class="te-prev-heading" style="color:${v["--accent"]}">⚓ Bargain Quest</div>
        <p class="te-prev-body" style="color:${v["--text"]}">The sea awaits, merchant. Choose your route.</p>
        <p class="te-prev-muted" style="color:${v["--text-muted"]}">Day 1 · Port Sable · 500g</p>
        <div class="te-prev-btns">
          <button class="te-prev-btn" style="background:linear-gradient(180deg,${v["--btn-hover"]},${v["--btn-bg"]});color:${v["--text"]};border-color:${v["--border"]}">Set Sail</button>
          <button class="te-prev-btn" style="background:linear-gradient(180deg,${v["--btn-hover"]},${v["--btn-bg"]});color:${v["--text-muted"]};border-color:${v["--border"]}">Inventory</button>
        </div>
        <div class="te-prev-card" style="background:${v["--btn-bg"]};border-color:${v["--accent"]}">
          <span style="color:${v["--accent"]}">📦 Trade Route</span>
          <span style="color:${v["--text-muted"]}">+120g profit</span>
        </div>
        <div class="te-prev-danger" style="color:${v["--danger"]}">⚠ Raider spotted nearby!</div>
      </div>
    `;
  }
  updatePreview();

  // ── Footer ──
  const footer = document.createElement("div");
  footer.className = "te-footer";

  const applyCurrentBtn = document.createElement("button");
  applyCurrentBtn.className = "menu-btn te-apply-btn";
  applyCurrentBtn.textContent = "✔ Apply as Active Theme";
  applyCurrentBtn.addEventListener("click", () => {
    // Apply inline vars without saving — temporary live preview mode
    _applyVarsToRoot(editVars);
    // Store as a temp anonymous custom if not named
    const n = nameInput.value.trim() || "Custom";
    saveAndApplyCustom(n, editVars);
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "settings-btn";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => closeEditor(false));

  footer.appendChild(applyCurrentBtn);
  footer.appendChild(cancelBtn);
  modal.appendChild(footer);

  // ── Helpers ──
  function saveTheme() {
    const n = nameInput.value.trim();
    if (!n) {
      window.BQUI?.notify("Enter a theme name first.", "warning");
      return;
    }
    const all = _loadCustomThemes();
    all[n] = { vars: Object.assign({}, editVars) };
    _saveCustomThemes(all);
    window.BQUI?.notify(`Theme "${n}" saved.`, "success");
    rebuildCustomList();
    rebuildPresetDropdown();
  }

  function saveAndApplyCustom(n, vars) {
    const all = _loadCustomThemes();
    all[n] = { vars: Object.assign({}, vars) };
    _saveCustomThemes(all);
    localStorage.setItem("pref_theme", `custom:${n}`);
    _applyCustomTheme(vars);
    window.BQUI?.notify(`Theme "${n}" applied.`, "success");
    // Sync the settings dropdown if it exists
    const sel = document.getElementById("themeSelect");
    if (sel) {
      // Add option if missing
      if (!sel.querySelector(`option[value="custom:${n}"]`)) {
        const opt = document.createElement("option");
        opt.value = `custom:${n}`;
        opt.textContent = `✏️ ${n}`;
        sel.appendChild(opt);
      }
      sel.value = `custom:${n}`;
    }
  }

  function closeEditor(keepVars) {
    if (!keepVars) {
      // Restore the saved theme on close without applying
      const storedKey = localStorage.getItem("pref_theme") || "default";
      if (storedKey.startsWith("custom:")) {
        const customs = _loadCustomThemes();
        const name = storedKey.slice(7);
        _applyCustomTheme(customs[name]?.vars || {});
      } else {
        window.applyThemePref();
      }
    }
    overlay.classList.remove("te-overlay-visible");
    setTimeout(() => overlay.remove(), 200);
  }

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("te-overlay-visible"));

  // Apply live preview immediately on open
  _applyVarsToRoot(editVars);
};

// Apply a custom vars object as a stylesheet-equivalent via :root inline styles
function _applyCustomTheme(vars) {
  // Remove the body data-theme so stylesheet themes don't override
  document.body.removeAttribute("data-theme");
  _applyVarsToRoot(vars);
}

// Patch window.applyThemePref to handle custom: keys, then apply on load.
// _origApplyThemePref is settings.js's _applyThemePref — handles built-in themes.
const _origApplyThemePref = window.applyThemePref;
window.applyThemePref = function() {
  const theme = localStorage.getItem("pref_theme") || "default";
  if (theme.startsWith("custom:")) {
    const customs = _loadCustomThemes();
    const name = theme.slice(7);
    if (customs[name]) {
      _applyCustomTheme(customs[name].vars);
      return;
    }
    // Custom theme deleted — fall back to default
    localStorage.setItem("pref_theme", "default");
  }
  // Clear any inline var overrides, then let the stylesheet theme take effect
  _applyVarsToRoot(null);
  _origApplyThemePref();
};

// Apply the stored theme on script load (handles custom: keys that settings.js couldn't)
window.applyThemePref();

// ── Utility: convert any CSS color string to #rrggbb ──────────
function rgbToHex(color) {
  if (!color) return "#000000";
  color = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    return "#" + color[1]+color[1]+color[2]+color[2]+color[3]+color[3];
  }
  // Parse rgb()/rgba() via a throwaway element
  const tmp = document.createElement("div");
  tmp.style.color = color;
  document.body.appendChild(tmp);
  const computed = getComputedStyle(tmp).color;
  document.body.removeChild(tmp);
  const m = computed.match(/\d+/g);
  if (!m || m.length < 3) return "#000000";
  return "#" + [m[0], m[1], m[2]].map(n => parseInt(n).toString(16).padStart(2, "0")).join("");
}
