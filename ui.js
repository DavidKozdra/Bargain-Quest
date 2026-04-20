/**
 * Returns an <img> data-URL tag for any atlas frame, or a fallback emoji.
 * @param {string|object} frameName - atlas frame key, alias, or icon-carrying object
 * @param {number} size - px size
 * @param {string} fallback - emoji if atlas not ready
 */
const ATLAS_FRAME_ALIASES = Object.freeze({
  gold: 'Cash',
  cash: 'Cash',
  coin: 'Cash',
  hp: 'heart',
  health: 'heart',
  globe: 'Cash',
  map: 'Cash',
  world: 'Cash',
  fall: 'Autumn',
  autumn: 'Autumn',
});

const SEASON_ICON_FALLBACKS = Object.freeze({
  Winter: '❄️',
  Spring: '🌱',
  Summer: '☀️',
  Fall: '🍂',
  Autumn: '🍂',
});

const REPUTATION_ICON_SIZE = 18;

function resolveAtlasFrameName(frameName) {
  if (!frameName) return null;
  if (typeof frameName === 'object') {
    if (frameName.atlasFrame) return resolveAtlasFrameName(frameName.atlasFrame);
    if (frameName.iconFrame) return resolveAtlasFrameName(frameName.iconFrame);
    if (frameName.frame) return resolveAtlasFrameName(frameName.frame);
    if (frameName.type) return resolveAtlasFrameName(frameName.type);
    return null;
  }
  const raw = String(frameName);
  return ATLAS_FRAME_ALIASES[raw] || ATLAS_FRAME_ALIASES[raw.toLowerCase()] || raw;
}

function createAtlasIconEl(frameName, size = 18, fallback = '❓') {
  const resolved = resolveAtlasFrameName(frameName);
  if (typeof AtlasManager !== 'undefined' && resolved && AtlasManager.has(resolved)) {
    const canvas = AtlasManager.createDOMCanvas(resolved, size);
    if (canvas) return canvas;
  }
  const span = document.createElement('span');
  span.textContent = fallback;
  span.style.fontSize = `${size}px`;
  span.style.lineHeight = '1';
  span.style.display = 'inline-block';
  span.style.verticalAlign = 'middle';
  return span;
}

function appendAtlasIcon(host, frameName, size = 18, fallback = '❓', className = '') {
  const parent = host?.elt || host;
  if (!parent || typeof parent.appendChild !== 'function') return null;
  const iconEl = createAtlasIconEl(frameName, size, fallback);
  if (className) {
    className.split(/\s+/).filter(Boolean).forEach((cls) => iconEl.classList.add(cls));
  }
  parent.appendChild(iconEl);
  return iconEl;
}

function createSeasonIconEl(seasonName, size = 16) {
  const seasonLabel = String(seasonName || '');
  const fallback = SEASON_ICON_FALLBACKS[seasonLabel] || '📅';
  const iconEl = createAtlasIconEl(seasonLabel, size, fallback);
  iconEl.title = seasonLabel;
  iconEl.style.marginRight = '4px';
  return iconEl;
}

window.resolveAtlasFrameName = resolveAtlasFrameName;
window.createAtlasIconEl = createAtlasIconEl;
window.appendAtlasIcon = appendAtlasIcon;

function atlasIconHTML(frameName, size = 18, fallback = '❓') {
  const resolved = resolveAtlasFrameName(frameName);
  if (typeof AtlasManager !== 'undefined' && resolved && AtlasManager.has(resolved)) {
    const canvas = AtlasManager.createDOMCanvas(resolved, size);
    if (canvas) {
      const url = canvas.toDataURL();
      return `<img src="${url}" width="${size}" height="${size}" style="vertical-align:middle;image-rendering:pixelated;margin-right:2px">`;
    }
  }
  return fallback;
}
function cashIconHTML(size = 18) { return atlasIconHTML('Cash', size, '💰'); }
function atlasLabelHTML(frameName, label, size = 18, fallback = '❓') {
  return `${atlasIconHTML(frameName, size, fallback)} ${label}`;
}
// Shared tabs now live in Koz_Engine_Lib/UI/tabs.js and are published as window.BQTabs.

// Shared UI helpers for common guards and localStorage parsing.
window.BQUI = window.BQUI || {};
window.BQUI.notify = function notify(msg, type = "info", duration) {
  if (typeof notificationManager !== "undefined" && notificationManager && typeof notificationManager.log === "function") {
    notificationManager.log(msg, type, duration);
    return;
  }
  if (typeof window.showToast === "function") {
    window.showToast(msg, type);
    return;
  }
  if (typeof window.toast === "function") {
    window.toast(msg, type);
    return;
  }
  console.log(`[${type}] ${msg}`);
};
window.BQUI.readNumberPref = function readNumberPref(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const val = Number(raw);
    return Number.isFinite(val) ? val : fallback;
  } catch (_e) {
    return fallback;
  }
};

// ============================
// MAIN MENU
// ============================
// MAIN MENU moved to ui/mainMenu.js
// See: ui/mainMenu.js


// NEW GAME CONFIG moved to ui/newGameConfig.js
// See: ui/newGameConfig.js


// ============================
// LEVEL EDITOR TOOLBAR
// ============================
// LEVEL EDITOR TOOLBAR moved to ui/levelEditorToolbar.js
// See: ui/levelEditorToolbar.js


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
        // Return to the state that explicitly opened Pause.
        const returnState = window._pauseReturnState || gameStateManager.prev || GameStates.PLAYING;
        gameStateManager.setState(returnState);
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
      .mousePressed(async () => {
        await _ensureOptionalUIScreen("settingsMenu");
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
// Moved to ui/settings.js


// ============================
// CREDITS
// ============================
uiManager.registerScreen("credits", {
  validStates: [GameStates.CREDITS],

  create: () => {
    const wrapper = createDiv().id("credits").class("screen");
    const _leaveCredits = () => {
      const prev = gameStateManager?.prev;
      if (prev && prev !== GameStates.CREDITS) gameStateManager.setState(prev);
      else gameStateManager.setState(GameStates.MAIN_MENU);
    };

    createButton("✕")
      .parent(wrapper)
      .addClass("credits-close-btn")
      .attribute("aria-label", "Close credits")
      .attribute("title", "Back")
      .mousePressed(_leaveCredits);

    // Match main menu atmosphere.
    const bgDecor = createDiv().class("menu-bg-decor").parent(wrapper);
    for (let i = 0; i < 30; i++) {
      const star = createDiv().class("menu-star").parent(bgDecor);
      star.style("--x", Math.random() * 100 + "%");
      star.style("--y", Math.random() * 100 + "%");
      star.style("--delay", Math.random() * 3 + "s");
      star.style("--duration", (2 + Math.random() * 2) + "s");
    }

    const logoSection = createDiv().class("menu-logo-section").parent(wrapper);
    createImg("./assets/images/bargain quest logo.gif", "Game Logo")
      .class("menu-logo")
      .style("image-rendering", "pixelated")
      .attribute("data-menu-logo-src", "./assets/images/bargain quest logo.gif")
      .parent(logoSection);
    createElement("h1", "CREDITS").class("main-title").parent(logoSection);
    createElement("div", "Bargain Quest").addClass("menu-subtitle").parent(logoSection);

    const content = createDiv()
      .class("credits-content")
      .parent(wrapper);

    const intro = createDiv()
      .class("credits-intro")
      .parent(content);
    createElement("p", "People, tools, and audio contributions behind Bargain Quest.")
      .parent(intro);

    const ledger = createDiv()
      .class("credits-ledger")
      .parent(content);

    const makeSection = (title, delayMs) => {
      const section = createDiv()
        .class("credits-section")
        .parent(ledger)
        .style("--section-delay", `${delayMs}ms`);
      createElement("h3", title).class("credits-section-title").parent(section);
      return section;
    };

    const addPersonRow = (parent, name, url, handle, note) => {
      const row = createDiv().class("credits-item").parent(parent);
      const identity = createDiv().class("credits-item-identity").parent(row);
      createA(url, name, "_blank")
        .attribute("rel", "noopener noreferrer")
        .class("credits-name-link")
        .parent(identity);
      if (handle) {
        createSpan(` (${handle})`)
          .class("credits-handle")
          .parent(identity);
      }
      if (note) {
        createElement("div", note)
          .class("credits-note")
          .parent(row);
      }
    };

    const designSection = makeSection("Game Design & Programming", 0);
    addPersonRow(designSection, "David Kozdra", "https://davidkozdra.com/", "MagentaAutumn", "Core systems, game logic, and balancing.");

    const artSection = makeSection("Art & Assets", 90);
    addPersonRow(artSection, "Forrest H Lowe", "https://realsketchyguy.itch.io/", "realsketchyguy", "Visual assets and sprite support.");

    const audioSection = makeSection("Music and Sounds", 180);
    addPersonRow(audioSection, "Tetaban", "https://tetaban.itch.io/", "Esteban SORIA--LEYGUE", "Music and sound design contributions.");
    addPersonRow(audioSection, "Deklaswas", "https://deklaswas.itch.io/", "", "Additional music and audio support.");

    const thanksSection = makeSection("Special Thanks", 270);
    createElement("p", "To all playtesters, supporters, Itch, P5, and the open source community.")
      .class("credits-thanks-copy")
      .parent(thanksSection);
    createElement("p", "Your feedback keeps the game sharp and the trading loop fun.")
      .class("credits-thanks-copy credits-thanks-copy--muted")
      .parent(thanksSection);

    const btnWrap = createDiv().class("menu-buttons").parent(wrapper);
    createButton("Back")
      .parent(btnWrap)
      .addClass("menu-btn credits-back-btn")
      .mousePressed(_leaveCredits);

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

function isTravelWindowVisible() {
  const win = document.getElementById("travelMapWindow");
  return !!(win && window.getComputedStyle(win).display !== "none");
}

function hideTravelWindow() {
  select("#travelMapWindow")?.style("display", "none");
}

function buildTravelPanel(panelId) {
  const panel = select("#" + (panelId || "travelPanelInfo"));
  if (!panel || !player.currentCity) return;
  panel.style("display", "flex");
  panel.html("");

  const current = player.currentCity;
  const loc = current.location;

  // === Header bar with title + close button ===
  const headerBar = createDiv().parent(panel).class("travel-window-header");
  createElement("h3", "").parent(headerBar)
    .html(`${atlasIconHTML('Cash', 16, '🗺️')} World Map`)
    .style("margin", "0").style("color", "#d4af37").style("font-size", "15px");
  createButton("✕").parent(headerBar).class("travel-window-close").mousePressed(() => {
    hideTravelWindow();
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

  // Zoom and pan state for travel map
  let _travelMapZoom = 1;
  let _travelMapPanX = 0;
  let _travelMapPanY = 0;
  let _isPanning = false;
  let _panStartX = 0;
  let _panStartY = 0;

  // Zoom controls
  const zoomControls = createDiv().parent(mapWrap).class("travel-map-zoom-controls");
  zoomControls.style("position", "absolute");
  zoomControls.style("bottom", "6px");
  zoomControls.style("left", "6px");
  zoomControls.style("display", "flex");
  zoomControls.style("gap", "4px");

  const zoomInBtn = createButton("+").parent(zoomControls);
  zoomInBtn.style("background", "rgba(30,30,40,0.9)");
  zoomInBtn.style("border", "1px solid #555");
  zoomInBtn.style("color", "#ccc");
  zoomInBtn.style("width", "24px");
  zoomInBtn.style("height", "24px");
  zoomInBtn.style("border-radius", "4px");
  zoomInBtn.style("cursor", "pointer");
  zoomInBtn.style("font-size", "14px");
  zoomInBtn.style("line-height", "1");
  zoomInBtn.mousePressed(() => {
    _travelMapZoom = Math.min(4, _travelMapZoom * 1.25);
    drawTravelMap();
  });

  const zoomOutBtn = createButton("−").parent(zoomControls);
  zoomOutBtn.style("background", "rgba(30,30,40,0.9)");
  zoomOutBtn.style("border", "1px solid #555");
  zoomOutBtn.style("color", "#ccc");
  zoomOutBtn.style("width", "24px");
  zoomOutBtn.style("height", "24px");
  zoomOutBtn.style("border-radius", "4px");
  zoomOutBtn.style("cursor", "pointer");
  zoomOutBtn.style("font-size", "14px");
  zoomOutBtn.style("line-height", "1");
  zoomOutBtn.mousePressed(() => {
    _travelMapZoom = Math.max(0.5, _travelMapZoom / 1.25);
    drawTravelMap();
  });

  const resetBtn = createButton("⟲").parent(zoomControls);
  resetBtn.style("background", "rgba(30,30,40,0.9)");
  resetBtn.style("border", "1px solid #555");
  resetBtn.style("color", "#ccc");
  resetBtn.style("width", "24px");
  resetBtn.style("height", "24px");
  resetBtn.style("border-radius", "4px");
  resetBtn.style("cursor", "pointer");
  resetBtn.style("font-size", "14px");
  resetBtn.style("line-height", "1");
  resetBtn.mousePressed(() => {
    _travelMapZoom = 1;
    _travelMapPanX = 0;
    _travelMapPanY = 0;
    drawTravelMap();
  });

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

  // Add owned city legend entry
  const ownedLegend = createDiv().parent(legend).style("display", "flex").style("align-items", "center").style("gap", "4px");
  const ownedDot = createElement("span", "").parent(ownedLegend);
  ownedDot.style("width", "8px");
  ownedDot.style("height", "8px");
  ownedDot.style("border-radius", "50%");
  ownedDot.style("background", "#9b6dff");
  ownedDot.style("border", "1px solid #d2bcff");
  createElement("span", "Yours").parent(ownedLegend).style("color", "#ccc").style("font-size", "11px");

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
  // Use willReadFrequently for canvases where we may read pixels.
  const ctx = cvs.getContext("2d", { willReadFrequently: true });
  const baseScale = mapSize / Math.max(cols, rows);

  // === Hover/click state ===
  let hoveredEntry = null;
  let selectedEntry = null;

  // Function to draw the travel map with zoom and pan
  function drawTravelMap(highlightEntry = null, highlightColor = null, highlightWidth = 0) {
    const scale = baseScale * _travelMapZoom;
    const panX = _travelMapPanX;
    const panY = _travelMapPanY;

    // Clear canvas
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, mapSize, mapSize);

    // Draw terrain from minimapGraphics - scaled and panned to align with markers
    if (minimapGraphics) {
      const mmSize = 200; // minimapGraphics is 200x200
      const zoomedSize = mapSize * _travelMapZoom;
      
      // Draw minimap stretched to cover the transformed space
      // The pan offset shifts the view into the zoomed terrain
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, mapSize, mapSize);
      ctx.clip();
      
      // Draw minimap scaled: source fills dest, offset by pan
      ctx.drawImage(
        minimapGraphics.canvas || minimapGraphics.elt,
        0, 0, mmSize, mmSize,  // source
        panX, panY, zoomedSize, zoomedSize  // dest (offset by pan)
      );
      ctx.restore();
    }

    // Slightly darken to make markers pop
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(0, 0, mapSize, mapSize);

    // Draw route lines from current city to all others (faded)
    for (const entry of cityEntries) {
      const cx1 = loc.x * scale + panX;
      const cy1 = loc.y * scale + panY;
      const cx2 = entry.city.location.x * scale + panX;
      const cy2 = entry.city.location.y * scale + panY;
      ctx.beginPath();
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx2, cy2);
      ctx.strokeStyle = "rgba(212,175,55,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Highlighted route
    if (highlightEntry) {
      const cx1 = loc.x * scale + panX;
      const cy1 = loc.y * scale + panY;
      const cx2 = highlightEntry.city.location.x * scale + panX;
      const cy2 = highlightEntry.city.location.y * scale + panY;

      // Glow
      ctx.beginPath();
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx2, cy2);
      ctx.strokeStyle = highlightColor.replace("1)", "0.3)");
      ctx.lineWidth = highlightWidth + 4;
      ctx.stroke();

      // Line
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx2, cy2);
      ctx.strokeStyle = highlightColor;
      ctx.lineWidth = highlightWidth;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw city markers
    const markerRadius = Math.max(5, Math.min(8, scale * 1.5));
    const cityMarkers = []; // for hit detection - store RAW map coords

    for (const city of cities) {
      const cx = city.location.x * scale + panX;
      const cy = city.location.y * scale + panY;
      const isCurrent = city === current;
      const isSelected = highlightEntry && highlightEntry.city === city;
      const isOwned = player && player.ownsCity && player.ownsCity(city);

      // Outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, markerRadius + 2, 0, Math.PI * 2);
      if (isCurrent) {
        ctx.fillStyle = "rgba(255,80,80,0.3)";
      } else if (isSelected) {
        ctx.fillStyle = "rgba(255,255,100,0.3)";
      } else if (isOwned) {
        ctx.fillStyle = "rgba(156,109,255,0.32)";
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
      } else if (isSelected) {
        ctx.fillStyle = "#ffe066";
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
      } else if (isOwned) {
        ctx.fillStyle = "#9b6dff";
        ctx.strokeStyle = "#d2bcff";
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

      // City name label
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = isSelected ? "#ffe066" : "#fff";
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.lineWidth = 2.5;
      ctx.strokeText(city.name, cx, cy - markerRadius - 4);
      ctx.fillText(city.name, cx, cy - markerRadius - 4);

      if (!isCurrent) {
        // Store RAW map coordinates, not scaled
        cityMarkers.push({ city, mapX: city.location.x, mapY: city.location.y, radius: markerRadius + 4 });
      }
    }

    // Draw player icon at current city
    const px = loc.x * scale + panX;
    const py = loc.y * scale + panY;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ff3333";
    ctx.fill();

    return { cityMarkers, markerRadius };
  }

  // Initial draw
  let _cityMarkers = [];
  let _markerRadius = 5;
  const initialDraw = drawTravelMap();
  _cityMarkers = initialDraw.cityMarkers;
  _markerRadius = initialDraw.markerRadius;

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
    subtitle.html(city.isCoastal ? atlasLabelHTML('sloop', 'Coastal Port City', 14, '⚓') : "Inland City");

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
    const travelBtn = createButton(canAfford ? "" : "Can't Afford")
      .parent(body)
      .addClass("travel-map-go-btn" + (canAfford ? "" : " travel-map-go-btn-disabled"));
    if (canAfford) travelBtn.html(atlasLabelHTML('sloop', `Travel for ${entry.cost}g`, 14, '⛵'));

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
    const scale = baseScale * _travelMapZoom;
    const mapX = (mx - _travelMapPanX) / scale;
    const mapY = (my - _travelMapPanY) / scale;
    for (const m of _cityMarkers) {
      const ddx = mapX - m.mapX;
      const ddy = mapY - m.mapY;
      const r = m.radius / scale;
      if (ddx * ddx + ddy * ddy <= r * r) {
        return cityEntries.find(e => e.city === m.city) || null;
      }
    }
    return null;
  }

  // Mouse wheel zoom - simpler approach
  canvasEl.elt.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = cvs.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.2 : 0.8;
    const newZoom = Math.max(0.5, Math.min(4, _travelMapZoom * zoomFactor));

    // Adjust pan to zoom toward mouse position
    _travelMapPanX = mx - (mx - _travelMapPanX) * (newZoom / _travelMapZoom);
    _travelMapPanY = my - (my - _travelMapPanY) * (newZoom / _travelMapZoom);
    _travelMapZoom = newZoom;

    const drawResult = drawTravelMap();
    _cityMarkers = drawResult.cityMarkers;
    _markerRadius = drawResult.markerRadius;
  }, { passive: false });

  // Mouse drag panning
  canvasEl.elt.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      _isPanning = true;
      _panStartX = e.clientX;
      _panStartY = e.clientY;
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (_isPanning) {
      const dx = e.clientX - _panStartX;
      const dy = e.clientY - _panStartY;
      _travelMapPanX += dx;
      _travelMapPanY += dy;
      _panStartX = e.clientX;
      _panStartY = e.clientY;

      const drawResult = drawTravelMap();
      _cityMarkers = drawResult.cityMarkers;
      _markerRadius = drawResult.markerRadius;
    } else {
      // Hover detection (only when not panning)
      const rect = cvs.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (mapSize / rect.width);
      const my = (e.clientY - rect.top) * (mapSize / rect.height);
      const entry = getEntryAt(mx, my);

      if (entry !== hoveredEntry) {
        hoveredEntry = entry;
        cvs.style.cursor = entry ? "pointer" : "default";
        // Redraw with hover highlight if no selection
        if (!selectedEntry) {
          if (entry) {
            const drawResult = drawTravelMap(entry, "rgba(255,255,100,1)", 2);
            _cityMarkers = drawResult.cityMarkers;
            _markerRadius = drawResult.markerRadius;
            updateSidebar(entry);
          } else {
            const drawResult = drawTravelMap();
            _cityMarkers = drawResult.cityMarkers;
            _markerRadius = drawResult.markerRadius;
            updateSidebar(null);
          }
        }
      }
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (_isPanning) {
      _isPanning = false;
    }
  });

  canvasEl.elt.addEventListener("click", (e) => {
    if (_isPanning) return; // Don't select city if was panning
    const rect = cvs.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (mapSize / rect.width);
    const my = (e.clientY - rect.top) * (mapSize / rect.height);
    const entry = getEntryAt(mx, my);

    if (entry) {
      selectedEntry = entry;
      const drawResult = drawTravelMap(entry, "rgba(255,200,50,1)", 2.5);
      _cityMarkers = drawResult.cityMarkers;
      _markerRadius = drawResult.markerRadius;
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
      const drawResult = drawTravelMap();
      _cityMarkers = drawResult.cityMarkers;
      _markerRadius = drawResult.markerRadius;
      updateSidebar(null);
    }
  });

  // Build compact list in sidebar — PAGINATED
  const CITIES_PER_PAGE = 10;
  let _travelPage = 0;
  let _travelSearch = "";
  let _filteredEntries = [...cityEntries];

  // Search input
  const searchWrap = createDiv().parent(sidebar).class("travel-search-wrap");
  const searchInput = createElement("input")
    .parent(searchWrap)
    .class("travel-search-input")
    .attribute("type", "text")
    .attribute("placeholder", "Search cities...");

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

  function _applyTravelFilter() {
    const q = (_travelSearch || "").trim().toLowerCase();
    if (!q) {
      _filteredEntries = [...cityEntries];
    } else {
      _filteredEntries = cityEntries.filter(entry => entry.city?.name?.toLowerCase().includes(q));
    }
    _travelPage = 0;
  }

  function renderCityPage() {
    listWrap.html("");
    const totalPages = Math.max(1, Math.ceil(_filteredEntries.length / CITIES_PER_PAGE));
    const start = _travelPage * CITIES_PER_PAGE;
    const pageEntries = _filteredEntries.slice(start, start + CITIES_PER_PAGE);

    if (_filteredEntries.length === 0) {
      createDiv("No cities match your search.")
        .parent(listWrap)
        .style("color", "#888")
        .style("font-size", "12px")
        .style("padding", "8px 4px");
    }

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
        const drawResult = drawTravelMap(entry, "rgba(255,200,50,1)", 2.5);
        _cityMarkers = drawResult.cityMarkers;
        _markerRadius = drawResult.markerRadius;
        updateSidebar(entry);
        selectAll(".travel-list-row").forEach(r => r.removeClass("travel-list-row-selected"));
        row.addClass("travel-list-row-selected");
      });

      // Restore selection highlight if this entry was selected
      if (selectedEntry && selectedEntry.city === entry.city) {
        row.addClass("travel-list-row-selected");
      }
    }

    pageLabel.html(_filteredEntries.length > 0 ? `${_travelPage + 1} / ${totalPages}` : "0 / 0");
    // Use opacity + pointer-events instead of disabled attribute (p5 mousePressed ignores disabled elements)
    const prevDisabled = _travelPage === 0 || _filteredEntries.length === 0;
    const nextDisabled = _travelPage >= totalPages - 1 || _filteredEntries.length === 0;
    prevBtn.style("opacity", prevDisabled ? "0.4" : "1");
    prevBtn.style("pointer-events", prevDisabled ? "none" : "auto");
    nextBtn.style("opacity", nextDisabled ? "0.4" : "1");
    nextBtn.style("pointer-events", nextDisabled ? "none" : "auto");
  }

  prevBtn.mousePressed(() => {
    if (_travelPage > 0) { _travelPage--; renderCityPage(); }
  });
  nextBtn.mousePressed(() => {
    const totalPages = Math.max(1, Math.ceil(_filteredEntries.length / CITIES_PER_PAGE));
    if (_travelPage < totalPages - 1) { _travelPage++; renderCityPage(); }
  });
  searchInput.input(() => {
    _travelSearch = searchInput.value();
    _applyTravelFilter();
    renderCityPage();
  });

  _applyTravelFilter();
  renderCityPage();
}

// ============================
// CITY VIEW (expanded shop with trends)
// ============================
const CITY_VIEW_TAB_DEFS = [
  { label: "Shop", key: "shop", atlasFrame: "trader", icon: "🛒" },
  { label: "Port", key: "port", atlasFrame: "sloop", icon: "⚓" },
  { label: "Services", key: "services", atlasFrame: "Wheel", icon: "🛠" },
  { label: "Info", key: "info", atlasFrame: "Chart", icon: "ⓘ" },
];

function _setMobileCityViewOpen(isOpen) {
  try {
    document.body.classList.toggle("city-view-open", !!isOpen);
  } catch (_e) {}
}

function _isMobileUiViewport() {
  try {
    if (typeof window !== "undefined" && typeof window.getMobileContext === "function") {
      return !!window.getMobileContext().mobile;
    }
    if (typeof window !== "undefined" && typeof window.isMobile === "function" && window.isMobile()) return true;
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return true;
  } catch (_e) {}
  return false;
}

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

    // City reputation row
    const infoRow = createDiv().class("city-info-row").parent(wrapper);
    createSpan("").id("cityRepBadge").parent(infoRow)
      .style("font-size", "13px");

    // Ownership banner — shown only for owned cities
    const ownerBanner = createDiv().id("cityOwnerBanner").parent(wrapper)
      .style("display", "none")
      .style("background", "linear-gradient(135deg, rgba(27,94,32,0.3), rgba(56,142,60,0.15))")
      .style("border", "1px solid rgba(76,175,80,0.3)")
      .style("border-radius", "6px")
      .style("padding", "6px 12px")
      .style("margin", "0 0 4px 0")
      .style("display", "flex")
      .style("justify-content", "space-between")
      .style("align-items", "center")
      .style("font-size", "12px");
    createSpan("").id("cityOwnerLabel").parent(ownerBanner)
      .style("color", "#81c784").style("font-weight", "bold");
    const ownerActions = createDiv().id("cityOwnerActions").parent(ownerBanner)
      .style("display", "flex").style("gap", "6px").style("align-items", "center");
    createSpan("").id("cityOwnerBudget").parent(ownerActions)
      .style("color", "#a5d6a7").style("font-size", "11px");
    const cityCollectBtn = createButton("").id("cityCollectBtn").parent(ownerActions);
    cityCollectBtn.html(atlasLabelHTML('Cash', 'Collect', 12, '💰'));
    cityCollectBtn
      .addClass("city-leave-btn")
      .style("padding", "3px 10px").style("font-size", "11px")
      .style("background", "linear-gradient(135deg,#2e7d32,#388e3c)")
      .style("color", "#fff").style("border", "none").style("border-radius", "4px")
      .style("cursor", "pointer")
      .mousePressed(() => {
        const city = player.currentCity;
        if (!city || !player.ownsCity(city) || !city.management) return;
        const payout = Math.max(0, Math.floor(Number(city.management.ownerPayoutDue || 0)));
        if (payout <= 0) {
          if (typeof notificationManager !== 'undefined') notificationManager.log("No revenue to collect.", "warning");
          return;
        }
        player.earnGold(payout);
        city.management.ownerPayoutDue = 0;
        if (typeof notificationManager !== 'undefined')
          notificationManager.log(`Collected ${payout}g owner payout from ${city.name}.`, "success");
        uiManager.screens["cityView"].show();
      });
    const cityInvestBtn = createButton("").id("cityInvestBtn").parent(ownerActions);
    cityInvestBtn.html(atlasLabelHTML('Cash', 'Invest', 12, '💸'));
    cityInvestBtn
      .addClass("city-leave-btn")
      .style("padding", "3px 10px").style("font-size", "11px")
      .style("background", "linear-gradient(135deg,#1565c0,#1976d2)")
      .style("color", "#fff").style("border", "none").style("border-radius", "4px")
      .style("cursor", "pointer")
      .mousePressed(() => {
        const city = player.currentCity;
        if (!city || !player.ownsCity(city) || !city.management) return;
        const amount = parseInt(prompt(`Invest gold into ${city.name}'s budget?\nYou have ${player.gold}g. Enter amount:`));
        if (!amount || amount <= 0 || isNaN(amount)) return;
        const actual = Math.min(amount, player.gold);
        if (actual <= 0) {
          if (typeof notificationManager !== 'undefined') notificationManager.log("Not enough gold!", "warning");
          return;
        }
        player.spendGold(actual);
        city.management.budget = (city.management.budget || 0) + actual;
        if (typeof notificationManager !== 'undefined')
          notificationManager.log(`Invested ${actual}g into ${city.name}. City budget: ${city.management.budget}g`, "success");
        uiManager.screens["cityView"].show();
      });

    // ── Tab Bar ──
    const tabBar = createDiv().class("city-tab-bar").parent(wrapper);
    for (const t of CITY_VIEW_TAB_DEFS) {
      const btn = createButton("")
        .parent(tabBar)
        .addClass("city-tab-btn")
        .attribute("data-tab", t.key)
        .mousePressed(() => {
          window._cityTab = t.key;
          uiManager.screens["cityView"].show();
        });
      btn.attribute("aria-label", t.label);
      btn.attribute("title", t.label);
      const iconWrap = document.createElement("span");
      iconWrap.className = "city-tab-icon";
      iconWrap.setAttribute("aria-hidden", "true");
      iconWrap.appendChild(createAtlasIconEl(t.atlasFrame || t.key, 16, t.icon || "•"));
      btn.elt.appendChild(iconWrap);

      const labelEl = document.createElement("span");
      labelEl.className = "city-tab-label";
      labelEl.textContent = t.label;
      btn.elt.appendChild(labelEl);
    }

    // ── Tab Panels ──
    createDiv().id("cityTab_shop").class("city-tab-panel").parent(wrapper);
    createDiv().id("cityTab_port").class("city-tab-panel").parent(wrapper);
    createDiv().id("cityTab_services").class("city-tab-panel").parent(wrapper);
    createDiv().id("cityTab_info").class("city-tab-panel").parent(wrapper);

    // ── Bottom Buttons (shared across all tabs) ──
    const bottomButtonRow = createDiv().id("cityBottomButtons").parent(wrapper);

    // Adventure button: returns to adventure mode

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

    // "Manage City" button — visible only when player owns this city
    const manageCityBtn = createButton("")
      .parent(bottomButtonRow)
      .id("cityManageBtn")
      .addClass("city-leave-btn")
      .style("background", "linear-gradient(135deg,#1b5e20,#388e3c)")
      .style("color", "#fff")
      .style("display", "none")
      .mousePressed(() => {
        if (typeof _enterOwnedCityManagement === 'function' && player.currentCity && player.ownsCity(player.currentCity)) {
          _enterOwnedCityManagement(player.currentCity);
        }
      });
    manageCityBtn.html(atlasLabelHTML('Shield', 'Manage City', 16, '🏛️'));

    // "Buy City" button — visible only when player doesn't own this city and has enough gold
    const buyCityBtn = createButton("")
      .parent(bottomButtonRow)
      .id("cityBuyBtn")
      .addClass("city-leave-btn")
      .style("background", "linear-gradient(135deg,#b8860b,#daa520)")
      .style("color", "#fff")
      .style("display", "none")
      .mousePressed(() => {
        const city = player.currentCity;
        if (!city || typeof city.getOwnershipAcquisitionState !== 'function') return;
        const stage = city.getOwnershipAcquisitionState(player);
        if (stage.stepKey === 'offer' && typeof tutorialSystem !== 'undefined' && tutorialSystem) {
          if (!window._cityOwnershipTalkTipForcedOnce) {
            window._cityOwnershipTalkTipForcedOnce = true;
            if (typeof tutorialSystem.showTip === 'function') tutorialSystem.showTip('cityOwnership', { force: true });
            else tutorialSystem.tryShow('cityOwnership');
          }
        }
        if (stage.stepKey === 'complete') {
          if (typeof notificationManager !== 'undefined') notificationManager.log("You already own this city.", 'info');
          return;
        }
        if (stage.stepKey === 'offer' && !stage.canOfferNow) {
          const missing = Math.max(0, stage.offerRequirement - stage.offerScore);
          if (typeof notificationManager !== 'undefined') {
            notificationManager.log(
              `Need ${missing} more persuasion (${stage.offerScore}/${stage.offerRequirement}). Raise city reputation, add Charm, or carry NegotiationForDummies.`,
              'warning'
            );
          }
          return;
        }
        if (typeof buyExistingCity === 'function' && player.currentCity) {
          const promptText = stage.stepKey === 'offer'
            ? `Offer to buy ${city.name} from ${stage.ownerName}?\nRequirement: persuasion ${stage.offerRequirement} (you have ${stage.offerScore}).\n\nFull ownership requires all stages: Offer -> Bank -> Buildings -> Shop.`
            : `Buy step "${stage.stepLabel}" in ${city.name} for ${stage.cost}g?\nProgress: ${stage.progressCount}/${stage.progressTotal}\n\nFull ownership requires all stages: Offer -> Bank -> Buildings -> Shop.`;
          if (confirm(promptText)) {
            const res = buyExistingCity(player.currentCity);
            if (!res.ok) {
              const need = Math.max(0, (stage.cost || 0) - player.gold);
              const msgs = {
                no_gold: `Not enough gold! Need ${need}g more.`,
                already_owned: 'You already own this city!',
                no_city: 'No city to buy.',
                offer_rejected: `Offer rejected. Need persuasion ${stage.offerRequirement}, you have ${stage.offerScore}.`,
                invalid_city: 'City ownership data is unavailable.',
              };
              if (typeof notificationManager !== 'undefined')
                notificationManager.log(msgs[res.reason] || 'Failed to buy city.', 'error');
            } else {
              sound?.playTradeBuy?.();
              // Refresh city view to show the manage button
              uiManager.screens["cityView"].show();
            }
          }
        }
      });
    buyCityBtn.html(atlasLabelHTML('Cash', 'Buy City', 16, '💰'));

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
          mapWin.style("display", "none");
          createDiv().id("travelPanelInfo").parent(mapWin);
        }
        const isVisible = isTravelWindowVisible();
        if (isVisible) {
          hideTravelWindow();
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
    _setMobileCityViewOpen(true);

    const city = player.currentCity;
    const tab = CITY_VIEW_TAB_DEFS.some((t) => t.key === window._cityTab) ? window._cityTab : "shop";
    window._cityTab = tab;

    // ── Toggle Manage/Buy city buttons based on ownership ──
    const manageBtn = select("#cityManageBtn");
    const buyBtn = select("#cityBuyBtn");
    if (manageBtn) {
      manageBtn.style("display", player.ownsCity(city) ? "inline-block" : "none");
    }
    if (buyBtn) {
      const isOwned = player.ownsCity(city);
      const stage = (city && typeof city.getOwnershipAcquisitionState === 'function')
        ? city.getOwnershipAcquisitionState(player)
        : { stepKey: 'complete', stepLabel: 'Complete', cost: 0 };
      const hasNegotiationBonus = !!(player?.modifiers?.negotiationDiscount > 0);
      const persuasionHint = `Persuasion = City Reputation + (Charm x5) + ${hasNegotiationBonus ? '5' : '0'} book bonus`;
      const fullOwnershipHint = `Full ownership requires all 4 stages: Offer -> Bank -> Buildings -> Shop`;
      const canAfford = stage.stepKey === 'offer' ? true : player.gold >= (stage.cost || 0);
      if (isOwned) {
        buyBtn.style("display", "none");
      } else {
        buyBtn.style("display", "inline-block");
        if (canAfford) {
          buyBtn.style("opacity", "1").style("cursor", "pointer");
          buyBtn.removeAttribute("disabled");
          if (stage.stepKey === 'offer') {
            buyBtn.html(atlasLabelHTML('Friendly', `Talk To Owner (${stage.offerScore}/${stage.offerRequirement})`, 16, '🤝'));
            buyBtn.attribute("title", `${persuasionHint} | ${stage.offerScore}/${stage.offerRequirement} | ${fullOwnershipHint}`);
          } else {
            buyBtn.html(atlasLabelHTML('Cash', `${stage.stepLabel} (${stage.cost}g) • ${stage.progressCount}/${stage.progressTotal}`, 16, '💰'));
            buyBtn.attribute("title", fullOwnershipHint);
          }
        } else {
          buyBtn.style("opacity", "0.45").style("cursor", "not-allowed");
          buyBtn.attribute("disabled", "true");
          if (stage.stepKey === 'offer') {
            buyBtn.style("opacity", "1").style("cursor", "pointer");
            buyBtn.removeAttribute("disabled");
            buyBtn.html(atlasLabelHTML('Friendly', `Talk To Owner (${stage.offerScore}/${stage.offerRequirement})`, 16, '🤝'));
            buyBtn.attribute("title", `${persuasionHint} | ${stage.offerScore}/${stage.offerRequirement} | ${fullOwnershipHint}`);
          } else {
            buyBtn.html(atlasLabelHTML('Cash', `${stage.stepLabel} (${stage.cost}g) — need ${stage.cost - player.gold}g more`, 16, '💰'));
            buyBtn.attribute("title", `Need ${stage.cost}g total for this step. You have ${player.gold}g. Missing ${Math.max(0, stage.cost - player.gold)}g. | ${fullOwnershipHint}`);
          }
        }
      }
    }

    // ── Ownership banner ──
    const ownerBanner = select("#cityOwnerBanner");
    if (ownerBanner) {
      const isOwned = player.ownsCity(city);
      ownerBanner.style("display", isOwned ? "flex" : "none");
      if (isOwned) {
        const budget = Math.max(0, Math.floor(Number(city.management?.budget || 0)));
        const payout = Math.max(0, Math.floor(Number(city.management?.ownerPayoutDue || 0)));
        const taxPct = Math.round((city.management?.taxRate ?? 0.05) * 100);
        select("#cityOwnerLabel")?.html(player.isKing
          ? atlasLabelHTML('Love', 'Crown City', 16, '👑')
          : atlasLabelHTML('Shield', 'You own this city', 16, '🏛️'));
        select("#cityOwnerBudget")?.html(`Treasury: ${budget}g · Payout: ${payout}g · Tax: ${taxPct}%`);
        const collectBtn = select("#cityCollectBtn");
        if (collectBtn) {
          if (payout > 0) {
            collectBtn.style("opacity", "1").style("cursor", "pointer").html(atlasLabelHTML('Cash', `Collect ${payout}g`, 12, '💰'));
            collectBtn.removeAttribute("disabled");
          } else {
            collectBtn.style("opacity", "0.45").style("cursor", "not-allowed").html(atlasLabelHTML('Cash', 'No Revenue', 12, '💰'));
            collectBtn.attribute("disabled", "true");
          }
        }
      }
    }

    // ── Header info ──
    select("#cityNameWrapper")?.html(city.name);
    select("#cityPopulation")?.html(`Pop: ${city.population}`);
    // Reputation badge in header
    const repBadge = select("#cityRepBadge");
    if (repBadge && city.getReputationTier) {
      const tier = city.getReputationTier();
      repBadge.html(`${atlasIconHTML(tier.atlasFrame || tier.name, REPUTATION_ICON_SIZE, tier.emoji)} ${tier.name}`);
      repBadge.style("color", tier.color);
    }

    window.BQTabs?.applyTabState({
      tab,
      defs: CITY_VIEW_TAB_DEFS,
      btnSelector: ".city-tab-btn",
      panelPrefix: "cityTab_",
      activeClass: "city-tab-active",
      dataAttr: "data-tab",
    });

    // ═══════════════════════════════
    //  SHOP TAB
    // ═══════════════════════════════
    if (tab === "shop") {
      const shopPanel = select("#cityTab_shop");

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

        // Update reputation badge
        const _repBadge = select("#cityRepBadge");
        if (_repBadge && city.getReputationTier) {
          const _tier = city.getReputationTier();
          _repBadge.html(`${atlasIconHTML(_tier.atlasFrame || _tier.name, REPUTATION_ICON_SIZE, _tier.emoji)} ${_tier.name}`);
          _repBadge.style("color", _tier.color);
        }
      };

      // ── Filter state (persisted across refreshes) ──
      if (!window._shopFilters) {
        window._shopFilters = { category: 'all', tag: 'all', priceSort: 'none', priceMin: 0, priceMax: Infinity, stock: 'all' };
      }
      const sf = window._shopFilters;
      const isMobileShopView = _isMobileUiViewport();
      const initialShopFiltersCollapsed = typeof window._shopFiltersCollapsed === "boolean"
        ? window._shopFiltersCollapsed
        : true;

      const _syncShopFilterPanel = (shellEl, toggleEl, collapsed = false) => {
        if (!shellEl || !toggleEl) return;
        const shouldCollapse = !!(isMobileShopView && collapsed);
        shellEl.classList.toggle("shop-filter-shell-mobile", isMobileShopView);
        shellEl.classList.toggle("shop-filter-shell-collapsed", shouldCollapse);
        toggleEl.style.display = isMobileShopView ? "inline-flex" : "none";
        toggleEl.setAttribute("aria-expanded", shouldCollapse ? "false" : "true");
        toggleEl.textContent = shouldCollapse ? "Show Filters" : "Hide Filters";
      };

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
          const grid = document.querySelector('#cityTab_shop .shop-grid');
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
      const existingGrid = select("#cityTab_shop .shop-grid");
      if (existingGrid && window._shopCity === city.name) {
        const existingFilterShell = document.querySelector("#cityTab_shop .shop-filter-shell");
        const existingFilterToggle = document.querySelector("#cityTab_shop .shop-filter-toggle");
        _syncShopFilterPanel(existingFilterShell, existingFilterToggle, initialShopFiltersCollapsed);

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

      const filterShell = createDiv().class("shop-filter-shell").parent(shopPanel);
      const filterToggle = createButton("Show Filters")
        .class("shop-filter-toggle")
        .attribute("type", "button")
        .parent(filterShell);
      const filterBar = createDiv().class("shop-filter-bar").parent(filterShell);
      filterToggle.mousePressed(() => {
        const nextCollapsed = !filterShell.elt.classList.contains("shop-filter-shell-collapsed");
        window._shopFiltersCollapsed = nextCollapsed;
        _syncShopFilterPanel(filterShell.elt, filterToggle.elt, nextCollapsed);
      });
      _syncShopFilterPanel(filterShell.elt, filterToggle.elt, initialShopFiltersCollapsed);

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
      let totalWeight = 0;
      for (let [key, entry] of player.inventory) {
        const item = ItemLibrary[key];
        if (item) totalWeight += item.weight * entry.quantity;
      }

      const sortedItems = Object.entries(ItemLibrary)
        .filter(([, data]) => !(data.tags && data.tags.has('space')))
        .sort(([a], [b]) => {
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
              if (ce.quantity <= 0) city.inventory.delete(itemKey);
              sound?.playTradeBuy?.();
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
              sound?.playTradeSell?.();
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
      const portPanel = select("#cityTab_port");
      portPanel.html("");

      if (!(city.isCoastal || city.port)) {
        // Landlocked city — no port
        const noPort = createDiv().parent(portPanel).style("text-align", "center").style("padding", "40px 20px");
        createElement("h3", "🚫 No Port").parent(noPort).style("color", "#666").style("margin", "0 0 8px");
        createP("This city is landlocked. Travel to a coastal city to access port services.")
          .parent(noPort).style("color", "#888").style("font-size", "13px");
      } else {
        createElement("h3", "")
          .parent(portPanel)
          .html(atlasLabelHTML('sloop', 'Harbor — Buy Vessels', 16, '⚓'))
          .style("margin", "8px 0 6px")
          .style("color", "#6cc");

        // Available boats for purchase
        const boatGrid = createDiv().class("shop-grid").parent(portPanel);

        for (const [boatKey, boatDef] of Object.entries(typeof BoatLibrary !== 'undefined' ? BoatLibrary : {})) {
          const canAfford = player.gold >= boatDef.cost;

          const boatCard = createDiv().class("shop-item").parent(boatGrid);

          const nameRow = createDiv().style("display", "flex").style("align-items", "center").style("gap", "8px").parent(boatCard);
          appendAtlasIcon(nameRow, boatDef, 24, boatDef.icon, 'cfg-boat-icon');
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
                sound?.playTradeBuy?.();
                if (typeof notificationManager !== 'undefined') {
                  notificationManager.log(`Purchased ${boatDef.displayName} "${newBoat.name}"!`, "success");
                }
                uiManager.screens["cityView"].show();
              }
            });
        }

        // Player's fleet
        if (player.fleet && player.fleet.length > 0) {
          createElement("h3", "")
            .parent(portPanel)
            .html(atlasLabelHTML('sloop', 'Your Fleet', 16, '🚢'))
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
            appendAtlasIcon(row, boatDef || boat.type, 20, boatDef?.icon || '🚢');
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

            if (boat.captain) {
              const cap = boat.captain;
              createP(`${cap.icon || '🧭'} Captain ${cap.name} (${cap.label || cap.tier}) • Accuracy ${(Math.round((cap.accuracy || 0) * 100))}% • Evasion ${(Math.round((cap.evasion || 0) * 100))}%`)
                .style("font-size", "11px").style("color", "#9ec").style("margin", "2px 0").parent(card);
            } else if (!isActive) {
              createP("No captain assigned — this ship cannot assist in naval battles.")
                .style("font-size", "11px").style("color", "#888").style("margin", "2px 0").parent(card);
            } else {
              createP("You command this ship directly.")
                .style("font-size", "11px").style("color", "#9ac").style("margin", "2px 0").parent(card);
            }

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

            if (!isActive) {
              if (!boat.captain) {
                for (const tierKey of ['greenhorn', 'seasoned', 'elite']) {
                  const t = CaptainLibrary?.[tierKey];
                  if (!t) continue;
                  const canAffordCap = player.gold >= t.hireCost;
                  createButton(`${t.icon} Hire ${t.label} ($${t.hireCost})`)
                    .parent(btnRow)
                    .addClass(canAffordCap ? "buy-btn" : "buy-btn-disabled")
                    .mousePressed(() => {
                      if (player.gold < t.hireCost) {
                        if (typeof notificationManager !== 'undefined')
                          notificationManager.log(`Not enough gold! Need ${t.hireCost}g.`, 'warning');
                        return;
                      }
                      const defaultName = CaptainNames[Math.floor(Math.random() * CaptainNames.length)];
                      const capName = prompt(`Name your ${t.label} captain:`, defaultName);
                      if (capName === null) return;
                      player.spendGold(t.hireCost);
                      boat.captain = createCaptainProfile(tierKey, capName || defaultName);
                      if (typeof notificationManager !== 'undefined')
                        notificationManager.log(`${boat.captain.icon} Captain ${boat.captain.name} hired for "${boat.name}".`, 'success');
                      uiManager.screens["cityView"].show();
                    });
                }
              } else {
                createButton(`Dismiss Captain`)
                  .parent(btnRow).addClass("sell-btn")
                  .mousePressed(() => {
                    const capName = boat.captain?.name || 'captain';
                    boat.captain = null;
                    if (typeof notificationManager !== 'undefined')
                      notificationManager.log(`Captain ${capName} dismissed from "${boat.name}".`, 'info');
                    uiManager.screens["cityView"].show();
                  });
              }
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
                sound?.playTradeSell?.();
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
      const svcPanel = select("#cityTab_services");
      svcPanel.html("");

      const svcScroll = createDiv().class("svc-scroll").parent(svcPanel);

      // ── City Services ─────────────────────
      const features = city.getCityFeatures ? city.getCityFeatures() : [];

      const svcHdr = createDiv().class("svc-section-hdr").parent(svcScroll);
      const svcHdrIcon = createAtlasIconEl('Shield', 20, '🏛️');
      svcHdrIcon.classList.add('svc-hdr-icon');
      svcHdr.elt.appendChild(svcHdrIcon);
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
            atlasFrame: "Chart",
            emoji: "📜", label: "Bounty Board",
            desc: "Hunt wanted raiders for gold bounties. Higher bounties for boss targets.",
            state: GameStates.BOUNTY_BOARD,
          },
          bank: {
            atlasFrame: "Bank",
            emoji: "🏦", label: "Bank",
            desc: "Deposit savings at 3% weekly interest, take loans, or invest in trade routes.",
            state: GameStates.BANK,
          },
          gamblingDen: {
            atlasFrame: "Dice",
            emoji: "🎲", label: "Gambling Den",
            desc: "Dice poker, memory match, and the wheel of fortune await the bold.",
            state: GameStates.GAMBLING,
          },
          blackMarket: {
            atlasFrame: "StolenGoods",
            emoji: "🕶️", label: "Black Market",
            desc: "Trade contraband for big profits — but beware of checkpoint inspections.",
            state: GameStates.BLACK_MARKET,
          },
          researchLab: {
            atlasFrame: "Chart",
            emoji: "🔬", label: "Research Lab",
            desc: "Research points flow into city tech, space programs, and alien markets.",
            state: null,
          },
          spaceport: {
            atlasFrame: "sloop",
            emoji: "🚀", label: "Spaceport",
            desc: "Launch into orbit and open the space travel screen.",
            state: GameStates.SPACE,
          },
          alienExchange: {
            atlasFrame: "Friendly",
            emoji: "👽", label: "Alien Exchange",
            desc: "Trade with visitors from other worlds.",
            state: GameStates.SPACE,
          },
        };

        for (const feat of features) {
          const cfg = featureConfig[feat.id] || { atlasFrame: feat.atlasFrame || null, emoji: feat.emoji, label: feat.label, desc: "", state: null };
          const card = createDiv().class("svc-card").parent(grid);
          card.attribute("data-svc", feat.id);

          const iconEl = createAtlasIconEl(cfg.atlasFrame || feat.id, 28, cfg.emoji);
          iconEl.classList.add("svc-emoji");
          card.elt.appendChild(iconEl);
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
        createSpan("").class("svc-hdr-icon").parent(ctrHdr).html(atlasIconHTML('Chart', 16, '📋'));
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
          if (contract.item) createSpan(`${atlasIconHTML('Crate', 14, '📦')} ${contract.qty || '?'}× ${contract.item}`).parent(meta);
          if (contract.target) createSpan(`${atlasIconHTML('Cash', 14, '📍')} ${contract.target}`).parent(meta);
          // Survey contract: show location count and note about map markers
          if (contract.type === 'survey' && contract.surveyPoints) {
            createSpan(`📍 ${contract.surveyPoints.length} locations`).parent(meta);
            createSpan(`${atlasIconHTML('Cash', 14, '🗺️')} Shown on map`).parent(meta).style('color', '#ffb74d');
          }
          if (contract.deadline) {
            const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;
            const daysLeft = Math.max(0, contract.deadline - day);
            createSpan(`${atlasIconHTML('Clock', 14, '⏰')} ${daysLeft}d left`).parent(meta).style("color", daysLeft < 3 ? "#f44" : "#667");
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
          createSpan("").class("svc-hdr-icon").parent(actHdr).html(atlasIconHTML('Chart', 16, '📌'));
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
          const fragHdrIcon = createAtlasIconEl('Cash', 20, '🗺️');
          fragHdrIcon.classList.add('svc-hdr-icon');
          fragHdr.elt.appendChild(fragHdrIcon);
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
      const infoPanel = select("#cityTab_info");
      infoPanel.html("");

      // City stats
      const statsBox = createDiv().class("info-stats-box").parent(infoPanel);
      createElement("h3", "").parent(statsBox).html(`${atlasIconHTML('Chart', 16, '📊')} City Info`).style("color", "#d4af37").style("margin", "0 0 8px");

      const statsList = createDiv().parent(statsBox).style("display", "flex").style("flex-direction", "column").style("gap", "4px");

      const addStat = (label, value) => {
        const row = createDiv().parent(statsList).style("display", "flex").style("justify-content", "space-between");
        createSpan(label).parent(row).style("color", "#aaa").style("font-size", "13px");
        createSpan(value).parent(row).style("color", "#fff").style("font-size", "13px").style("font-weight", "bold");
      };

      addStat("Population", city.population.toString());
      addStat("Unique Items", city.inventory.size.toString());
      addStat("Coastal", (city.isCoastal || city.port) ? `${atlasIconHTML('sloop', 14, '⚓')} Yes` : "No");

      // Total city wealth (sum of item values)
      let cityWealth = 0;
      for (const [key, entry] of city.inventory) {
        cityWealth += city.calculateItemPrice(key, cities, false) * entry.quantity;
      }
      addStat("Market Value", `$${cityWealth}`);

      // Reputation display
      const repVal = typeof city.reputation === 'number' ? city.reputation : 50;
      const repTier = city.getReputationTier ? city.getReputationTier() : { name: 'Neutral', color: '#aaa', emoji: '😐', atlasFrame: 'Neutral' };
      const repPriceMod = city.getReputationPriceModifier ? city.getReputationPriceModifier(false) : 1;
      const repPct = Math.round((1 - repPriceMod) * 100);
      const repLabel = repPct > 0 ? `${repPct}% discount` : repPct < 0 ? `${Math.abs(repPct)}% markup` : 'no effect';

      const repRow = createDiv().parent(statsList)
        .style("display", "flex").style("justify-content", "space-between").style("align-items", "center");
      createSpan("Reputation").parent(repRow).style("color", "#aaa").style("font-size", "13px");
      const repRight = createDiv().parent(repRow).style("display", "flex").style("align-items", "center").style("gap", "6px");
      createSpan(`${atlasIconHTML(repTier.atlasFrame || repTier.name, REPUTATION_ICON_SIZE, repTier.emoji)} ${repTier.name}`).parent(repRight)
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

      // ── Ownership Management Section ──
      if (player.ownsCity(city)) {
        const mgmtBox = createDiv().class("info-stats-box").parent(infoPanel);
        createElement("h3", "").parent(mgmtBox).html(`${atlasIconHTML('Shield', 16, '🏛️')} Your City`).style("color", "#66bb6a").style("margin", "0 0 8px");

        const mgmtStats = createDiv().parent(mgmtBox).style("display", "flex").style("flex-direction", "column").style("gap", "4px");
        const addMgmt = (label, value, color) => {
          const r = createDiv().parent(mgmtStats).style("display", "flex").style("justify-content", "space-between");
          createSpan(label).parent(r).style("color", "#aaa").style("font-size", "13px");
          createSpan(value).parent(r).style("color", color || "#fff").style("font-size", "13px").style("font-weight", "bold");
        };

        const budget = city.management?.budget || 0;
        const taxPct = Math.round((city.management?.taxRate ?? 0.05) * 100);
        const wallLvl = city.management?.upgradeLevels?.walls || 0;
        const queueLen = city.management?.buildingQueue?.length || 0;
        const routeCount = city.management?.routes?.length || 0;

        addMgmt("City Budget", `${budget}g`, budget > 0 ? "#a5d6a7" : "#ef9a9a");
        addMgmt("Tax Rate", `${taxPct}%`);
        addMgmt("Defense", wallLvl > 0 ? `Walls Lv${wallLvl}` : "None — build walls!", wallLvl > 0 ? "#81c784" : "#ef9a9a");
        if (queueLen > 0) addMgmt("Building", `${queueLen} project${queueLen > 1 ? 's' : ''} in progress`, "#64b5f6");
        if (routeCount > 0) addMgmt("Trade Routes", `${routeCount} active`, "#ce93d8");

        // Buildings list
        const bldgs = [];
        if (city.hasBank) bldgs.push(`${atlasIconHTML('Bank', 14, '🏦')} Bank`);
        if (city.hasGamblingDen) bldgs.push(`${atlasIconHTML('Dice', 14, '🎲')} Gambling Den`);
        if (city.hasBountyBoard) bldgs.push(`${atlasIconHTML('Chart', 14, '📜')} Bounty Board`);
        if (city.hasWeaponShop) bldgs.push(`${atlasIconHTML('Sword', 14, '⚔️')} Weapon Shop`);
        if (city.hasBlackMarket) bldgs.push(`${atlasIconHTML('StolenGoods', 14, '🏴')} Black Market`);
        if (city.hasResearchLab) bldgs.push(`${atlasIconHTML('Chart', 14, '🔬')} Research Lab`);
        if (city.hasSpaceport) bldgs.push(`${atlasIconHTML('sloop', 14, '🚀')} Spaceport`);
        if (city.hasAlienExchange) bldgs.push(`${atlasIconHTML('Friendly', 14, '👽')} Alien Exchange`);
        if (wallLvl > 0) bldgs.push(`${atlasIconHTML('Shield', 14, '🧱')} Walls Lv${wallLvl}`);
        const upgrades = city.management?.upgradeLevels || {};
        for (const [k, v] of Object.entries(upgrades)) {
          if (v > 0 && k !== 'walls') bldgs.push(`${k} Lv${v}`);
        }
        if (bldgs.length > 0) {
          addMgmt("Buildings", bldgs.join(" · "));
        }
        if (player.isKing) {
          addMgmt("Title", `${atlasIconHTML('Love', 14, '👑')} Crowned King`, "#ffd54f");
        }
      } else if (typeof city.getOwnershipAcquisitionState === 'function') {
        const deal = city.getOwnershipAcquisitionState(player);
        const dealBox = createDiv().class("info-stats-box").parent(infoPanel);
        createElement("h3", "").parent(dealBox).html(`${atlasIconHTML('Shield', 16, '👔')} City Ownership`).style("color", "#ffb74d").style("margin", "0 0 8px");

        const dealStats = createDiv().parent(dealBox).style("display", "flex").style("flex-direction", "column").style("gap", "4px");
        const addDeal = (label, value, color) => {
          const r = createDiv().parent(dealStats).style("display", "flex").style("justify-content", "space-between");
          createSpan(label).parent(r).style("color", "#aaa").style("font-size", "13px");
          createSpan(value).parent(r).style("color", color || "#fff").style("font-size", "13px").style("font-weight", "bold");
        };
        addDeal("Current Owner", deal.ownerName, "#ffe0b2");
        addDeal("Progress", `${deal.progressCount} / ${deal.progressTotal}`);
        addDeal("Full Ownership", "Requires all 4 stages", "#ffcc80");
        if (deal.stepKey === 'offer') {
          const rep = Math.floor(city.reputation || 50);
          const charm = (player.bonusCharm || 0) * 5;
          const book = player?.modifiers?.negotiationDiscount > 0 ? 5 : 0;
          addDeal("Next Step", "Convince Owner");
          addDeal("Persuasion", `${deal.offerScore} / ${deal.offerRequirement}`, deal.canOfferNow ? "#81c784" : "#ef9a9a");
          addDeal("Formula", `${rep} (Rep) + ${charm} (Charm) + ${book} (Book)`);
        } else {
          addDeal("Next Step", `${deal.stepLabel} (${deal.cost}g)`, player.gold >= deal.cost ? "#81c784" : "#ef9a9a");
        }
      }

      if (city.holidays && city.holidays.length > 0) {
        createElement("h4", "").parent(statsBox).html(`${atlasIconHTML('Festival', 16, '🎉')} Holidays`)
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
        createElement("h4", "").parent(statsBox).html(`${atlasIconHTML('Book', 16, '📚')} Book Festivals`)
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
            createSpan(`${atlasIconHTML('Cash', 12, '💰')}${t.gold}`).parent(rightCol)
              .style("color", "#d4af37").style("font-size", "11px");
            createSpan(`${atlasIconHTML('Crate', 12, '📦')}${t.inventory.size} items`).parent(rightCol)
              .style("color", "#aaa").style("font-size", "11px");
            const stateLabel = t.state === 'trading'
              ? `${atlasIconHTML('Chart', 12, '🔄')} Trading`
              : `${atlasIconHTML('Clock', 12, '⏳')} Resting`;
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

        let threatLabel = `${atlasIconHTML('Friendly', 14, '✅')} Safe`;
        let threatColor = "#4a4";
        if (nearbyRaiders.length >= 3) {
          threatLabel = `${atlasIconHTML('Hate', 14, '🔴')} Dangerous`;
          threatColor = "#c44";
        } else if (nearbyRaiders.length >= 1) {
          threatLabel = `${atlasIconHTML('Hostile', 14, '⚠️')} Threats Nearby`;
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
              ? (r.type === 'dragon' ? '🐉 Dragon' : r.type === 'blackKnight' ? '⚫ Black Knight' : r.type === 'seaMonster' ? '🦑 Sea Monster' : '👻 Wraith')
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
    _setMobileCityViewOpen(false);
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
    } else {
      _setMobileCityViewOpen(shouldBeVisible && isVisible);
    }
  }
});

uiManager.registerScreen("spaceView", {
  validStates: [GameStates.SPACE],
  excludeWhen: () => !!window._spaceTravelSystem,

  create: () => {
    const wrapper = createDiv().id("spaceView").class("screen").style("display", "none");
    wrapper.style("background", "radial-gradient(circle at top, rgba(23,34,65,0.98), rgba(3,7,18,0.98) 60%, rgba(0,0,0,0.98))");
    wrapper.style("color", "#d6e8ff");
    wrapper.style("padding", "18px");
    wrapper.style("overflow-y", "auto");

    const shell = createDiv().parent(wrapper)
      .style("max-width", "1100px")
      .style("margin", "0 auto")
      .style("display", "flex")
      .style("flex-direction", "column")
      .style("gap", "14px");

    const header = createDiv().parent(shell)
      .style("display", "flex")
      .style("justify-content", "space-between")
      .style("align-items", "center")
      .style("gap", "12px")
      .style("background", "rgba(12,18,34,0.88)")
      .style("border", "1px solid rgba(125,201,255,0.28)")
      .style("border-radius", "14px")
      .style("padding", "14px 16px");

    const titleWrap = createDiv().parent(header).style("display", "flex").style("flex-direction", "column").style("gap", "4px");
    createElement("h2", "").parent(titleWrap).html(`${atlasIconHTML('sloop', 18, '🚀')} Space Command`).style("margin", "0").style("color", "#7dc9ff");
    createSpan("").id("spaceViewSubtitle").parent(titleWrap).style("color", "#9bb4cc").style("font-size", "12px");

    const headerBtns = createDiv().parent(header).style("display", "flex").style("gap", "8px").style("flex-wrap", "wrap");
    const returnBtn = createButton("Return to City").parent(headerBtns)
      .addClass("city-leave-btn")
      .style("background", "linear-gradient(135deg,#334155,#475569)")
      .style("color", "#fff");
    returnBtn.mousePressed(() => {
      if (player && typeof player.returnFromSpace === 'function') player.returnFromSpace();
      if (typeof gameStateManager !== 'undefined') gameStateManager.setState(GameStates.PLAYING);
    });

    createDiv().id("spaceLaunchBanner").parent(shell)
      .style("background", "rgba(18,26,42,0.88)")
      .style("border", "1px solid rgba(125,201,255,0.15)")
      .style("border-radius", "12px")
      .style("padding", "12px 14px")
      .style("font-size", "13px")
      .style("line-height", "1.6")
      .html("Launch from an owned city with a spaceport to visit planets, trade with aliens, and bring back rare goods.");

    createDiv().id("spacePlanetGrid").parent(shell)
      .style("display", "grid")
      .style("grid-template-columns", "repeat(auto-fit, minmax(240px, 1fr))")
      .style("gap", "12px");

    return wrapper;
  },

  show: () => {
    const el = select("#spaceView");
    if (!el) return;
    el.style("display", "block");
  },

  hide: () => {
    const el = select("#spaceView");
    if (el) el.style("display", "none");
  },

  update: () => {
    if (typeof player === 'undefined' || !player) return;
    const el = select("#spaceView");
    if (!el || el.elt.style.display === "none") return;

    const city = window._spaceLaunchCity || player.currentCity || (typeof player.getOwnedCities === 'function' ? player.getOwnedCities()[0] : null);
    select("#spaceViewSubtitle")?.html(city ? `Launched from ${city.name}. Choose a planet to visit.` : "No launch city selected.");

    const progress = city?.getProgressionState ? city.getProgressionState(player) : null;
    const banner = select("#spaceLaunchBanner");
    if (banner) {
      banner.html(city && city.hasSpaceport
        ? `Orbit is open above <b>${city.name}</b>. Use the live space map to choose routes and docking targets.`
        : "Space travel is locked. Return to an owned city and finish the Orbital Program.");
    }

    const grid = select("#spacePlanetGrid");
    if (!grid) return;
    grid.html("");
  }
});


// ============================
// PLAYER HUD (bottom bar)
// ============================
uiManager.registerScreen("playerView", {
  validStates: [GameStates.PLAYING, GameStates.INVENTORY, GameStates.PAUSED, GameStates.SPACE],
  excludeWhen: ({ state }) => (
    state === GameStates.PAUSED
    && window._pauseReturnState === GameStates.LEVEL_EDITOR
  ),

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
    // Gold progress bar
    const goldWrapper = createDiv().id("hudGoldWrapper").class("hud-gold-wrapper").parent(statsWrapper);
    createSpan("🪙")
      .class("hud-gold-icon")
      .attribute("aria-label", "Gold")
      .parent(goldWrapper);
    const goldBarOuter = createDiv().class("hud-gold-bar-outer").parent(goldWrapper);
    createDiv().id("hudGoldBarInner").class("hud-gold-bar-inner").parent(goldBarOuter);
    createSpan("").id("hudGoldText").class("hud-gold-text").parent(goldWrapper);

    createSpan("").id("playerCargo").parent(statsWrapper);
    createSpan("").id("hudEmpireBadge").parent(statsWrapper)
      .style("display", "none")
      .style("color", "#81c784").style("font-size", "11px")
      .style("background", "rgba(27,94,32,0.25)")
      .style("border", "1px solid rgba(76,175,80,0.3)")
      .style("border-radius", "8px")
      .style("padding", "1px 8px")
      .style("margin-left", "6px");

    // HP bar
    const hpWrapper = createDiv().id("hudHpWrapper").class("hud-hp-wrapper").parent(statsWrapper);
    appendAtlasIcon(hpWrapper, 'heart', 18, '❤️', 'hud-hp-icon');
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
    helpBtn.setAttribute("aria-label", "Game Guide");
    helpBtn.appendChild(createAtlasIconEl('Book', 16, '?'));
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

    const nameEl = select("#playerName");
    if (nameEl) {
      nameEl.html(player.name || 'Captain');
      if (player.statPoints > 0) nameEl.addClass("hud-name-pulse");
      else nameEl.removeClass("hud-name-pulse");
    }
    // Difficulty badge
    const diffBadge = select("#hudDiffBadge");
    if (diffBadge && window.DIFFICULTY_CONFIG) {
      const dc = window.DIFFICULTY_CONFIG;
      const colors = { Easy: '#2e7d32', Normal: '#b8860b', Hard: '#c62828', Hardcore: '#6a1b9a' };
      const bgColors = { Easy: '#1b5e2022', Normal: '#b8860b22', Hard: '#c6282822', Hardcore: '#6a1b9a22' };
      diffBadge.html(`${atlasIconHTML(dc.atlasFrame || dc.label, 14, dc.icon)} ${dc.label}`);
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

    // Gold progress bar update
    const goldGoal = window._newGameGoldTarget || 5000;
    const goldPct = Math.max(0, Math.min(100, (player.gold / goldGoal) * 100));
    const goldBar = select("#hudGoldBarInner");
    if (goldBar) {
      goldBar.style("width", `${goldPct}%`);
      if (goldPct >= 100) goldBar.style("background", "linear-gradient(90deg, #FFD700, #FFC107)");
      else if (goldPct >= 50) goldBar.style("background", "linear-gradient(90deg, #d4af37, #e6c84d)");
      else goldBar.style("background", "linear-gradient(90deg, #8B7332, #b8962e)");
    }
    select("#hudGoldText")?.html(`${player.gold}/${goldGoal}`);

    // Cargo weight
    let totalWeight = 0;
    for (let [key, entry] of player.inventory) {
      const item = ItemLibrary[key];
      if (item) totalWeight += item.weight * entry.quantity;
    }
    select("#playerCargo")?.html(`${atlasIconHTML('Crate', 16, '📦')} ${totalWeight}/${player.getEffectiveCargoCapacity ? player.getEffectiveCargoCapacity() : (player.cargoCapacity || 50)}`);

    // Empire badge — show owned cities count + total budget
    const empireBadge = select("#hudEmpireBadge");
    if (empireBadge) {
      const ownedCount = player.ownedCities ? player.ownedCities.length : 0;
      if (ownedCount > 0) {
        let totalBudget = 0;
        const cityList = window.cities;
        for (const idx of player.ownedCities) {
          const c = cityList && cityList[idx];
          if (c && c.management) totalBudget += c.management.budget || 0;
        }
        empireBadge.html(`${atlasIconHTML('Shield', 16, '🏛️')} ${ownedCount} cit${ownedCount === 1 ? 'y' : 'ies'} · ${totalBudget}g`);
        empireBadge.style("display", "inline");
      } else {
        empireBadge.style("display", "none");
      }
    }

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
          const boatIcon = createAtlasIconEl(b, 18, b.icon || '⛵');
          boatIcon.style.marginRight = '6px';
          boatTag.appendChild(boatIcon);
          boatTag.appendChild(document.createTextNode(`${b.name} — ${b.condition}%`));
          boatTag.style.borderLeft = `3px solid ${b.conditionColor()}`;
          chipsEl.appendChild(boatTag);
        }

        if (entries.length === 0) {
          const empty = document.createElement('span');
          empty.className = 'hud-inv-empty';
          empty.innerHTML = atlasLabelHTML('Bag', 'Empty', 14, '🎒');
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

      // Keep a tooltip for the current light phase, but render the season in the HUD icon slot.
      const t = dayNight.getLightFactor();
      let iconTitle = 'Night';
      if (t < 0.2) { iconTitle = 'Day'; }
      else if (t < 0.4) { iconTitle = 'Dawn'; }
      else if (t < 0.6) { iconTitle = 'Day'; }
      else if (t < 0.8) { iconTitle = 'Dusk'; }

      const iconEl = select("#dayCycleIcon");
      if (iconEl) {
        const iconHost = iconEl.elt;
        if (iconHost?.dataset?.seasonIcon !== season) {
          iconHost.dataset.seasonIcon = season;
          iconHost.textContent = '';
          iconHost.appendChild(createSeasonIconEl(season, 18));
        }
        iconEl.attribute('title', `${season} · ${iconTitle}`);
      }
      select("#timeLabel")?.attribute('title', iconTitle);
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
  const questsContent = select("#invTabQuests");
  if (invContent)    invContent.style("display",    tab === 'inventory' ? "block" : "none");
  if (playerContent) playerContent.style("display", tab === 'player'    ? "block" : "none");
  if (questsContent) questsContent.style("display", tab === 'quests'    ? "block" : "none");
  selectAll(".inv-tab").forEach(t => {
    if (t.elt.dataset.invTab === tab) t.addClass("inv-tab-active");
    else t.removeClass("inv-tab-active");
  });
  if (tab === 'quests') _invUpdateQuests();
}

/** Append action buttons (Read / Equip) to an inventory row element */
function _invRowButtons(row, entry) {
  if (entry.item.tags && entry.item.tags.has('book')) {
    const readBtn = createButton("").parent(row);
    readBtn.html(atlasLabelHTML('Book', 'Read', 12, '📖'));
    readBtn
      .addClass("book-read-btn")
      .style("margin-left", "auto").style("padding", "2px 10px")
      .style("font-size", "11px").style("cursor", "pointer")
      .style("background", "#2a2a4a").style("color", "#c8d6e5")
      .style("border", "1px solid #4a4a7a").style("border-radius", "4px")
      .mousePressed(() => openBookPopup(entry.name));
  }
  if (entry.item.category === 'Weapon') {
    const isEquipped = player.equippedWeapon === entry.name;
    const wk = entry.name;
    const weaponBtn = createButton(isEquipped ? '✓ Unequip' : '').parent(row);
    if (!isEquipped) weaponBtn.html(atlasLabelHTML('Sword', 'Equip', 12, '⚔️'));
    weaponBtn
      .addClass(isEquipped ? 'weapon-unequip-btn' : 'weapon-equip-btn')
      .style('margin-left', 'auto').style('padding', '2px 10px')
      .style('font-size', '11px').style('cursor', 'pointer').style('border-radius', '4px')
      .style('background', isEquipped ? '#2e7d32' : '#3a1a1a')
      .style('color', isEquipped ? '#fff' : '#e0c8c8')
      .style('border', isEquipped ? '1px solid #4caf50' : '1px solid #7a3a3a')
      .mousePressed(() => {
        if (player.equippedWeapon === wk) player.unequipWeapon(); else player.equipWeapon(wk);
        window._invLastFingerprint = null;
        uiManager.screens['inventoryView'].update();
      });
  }
  if (entry.item.category === 'Bag') {
    const isEquipped = player.equippedBag === entry.name;
    const bagData = typeof BAGS !== 'undefined' ? BAGS[entry.name] : null;
    const bk = entry.name;
    const bagBtn = createButton(isEquipped ? '✓ Unequip' : '').parent(row);
    if (!isEquipped) bagBtn.html(atlasLabelHTML('Bag', `Equip (+${bagData ? bagData.cargoBonus : '?'})`, 12, '🎒'));
    bagBtn
      .addClass(isEquipped ? 'weapon-unequip-btn' : 'weapon-equip-btn')
      .style('margin-left', 'auto').style('padding', '2px 10px')
      .style('font-size', '11px').style('cursor', 'pointer').style('border-radius', '4px')
      .style('background', isEquipped ? '#2e7d32' : '#1a2a3a')
      .style('color', isEquipped ? '#fff' : '#c8d8e8')
      .style('border', isEquipped ? '1px solid #4caf50' : '1px solid #3a5a7a')
      .mousePressed(() => {
        if (player.equippedBag === bk) player.unequipBag(); else player.equipBag(bk);
        window._invLastFingerprint = null;
        uiManager.screens['inventoryView'].update();
      });
  }
}

// Pagination state for quests tab
if (!window._questsPages) window._questsPages = { contracts: 0, bounties: 0 };
const QUESTS_PER_PAGE = 4;

function _questsPaginate(section, items, pageKey, renderFn) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / QUESTS_PER_PAGE));
  window._questsPages[pageKey] = Math.min(window._questsPages[pageKey], pages - 1);
  const page = window._questsPages[pageKey];
  const slice = items.slice(page * QUESTS_PER_PAGE, (page + 1) * QUESTS_PER_PAGE);
  slice.forEach(item => renderFn(item, section));

  if (pages > 1) {
    const nav = createDiv().parent(section)
      .style("display", "flex").style("align-items", "center")
      .style("justify-content", "center").style("gap", "10px")
      .style("margin-top", "6px").style("margin-bottom", "4px");
    const prevBtn = createButton("◀").parent(nav)
      .style("padding", "2px 10px").style("cursor", page > 0 ? "pointer" : "default")
      .style("opacity", page > 0 ? "1" : "0.35").style("background", "#1a2a1a")
      .style("color", "#aaa").style("border", "1px solid #2a4a2a").style("border-radius", "4px");
    createSpan(`${page + 1} / ${pages}`).parent(nav)
      .style("color", "#888").style("font-size", "12px");
    const nextBtn = createButton("▶").parent(nav)
      .style("padding", "2px 10px").style("cursor", page < pages - 1 ? "pointer" : "default")
      .style("opacity", page < pages - 1 ? "1" : "0.35").style("background", "#1a2a1a")
      .style("color", "#aaa").style("border", "1px solid #2a4a2a").style("border-radius", "4px");
    prevBtn.mousePressed(() => {
      if (window._questsPages[pageKey] > 0) { window._questsPages[pageKey]--; _invUpdateQuests(); }
    });
    nextBtn.mousePressed(() => {
      if (window._questsPages[pageKey] < pages - 1) { window._questsPages[pageKey]++; _invUpdateQuests(); }
    });
  }
}

function _invUpdateQuests() {
  const container = select("#invQuestsContent");
  if (!container) return;
  container.html("");

  const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;
  const CONTRACT_ICONS = {
    delivery: atlasIconHTML('Crate', 14, '📦'),
    bulkOrder: atlasIconHTML('Crate', 14, '🏭'),
    escort: atlasIconHTML('Shield', 14, '🛡️'),
    rareFind: atlasIconHTML('Chart', 14, '🔍'),
    survey: atlasIconHTML('Cash', 14, '🗺️'),
  };

  // ── Contracts ──────────────────────────────────────
  const contractSection = createDiv().parent(container);
  createElement("h3", "").parent(contractSection)
    .html(atlasLabelHTML('Chart', 'Active Contracts', 16, '📜'))
    .style("margin", "0 0 8px").style("color", "#d4af37");

  const active = (typeof contractSystem !== 'undefined') ? contractSystem.active : [];
  if (active.length === 0) {
    createP("No active contracts. Visit a city's contract board to accept one.")
      .parent(contractSection).style("color", "#666").style("font-size", "13px");
  } else {
    _questsPaginate(contractSection, active, 'contracts', (c, section) => {
      const card = createDiv().parent(section);
      Object.assign(card.elt.style, {
        background: '#0d1a0d', border: '1px solid #2a4a2a', borderRadius: '8px',
        padding: '10px 12px', marginBottom: '8px',
      });

      const titleRow = createDiv().parent(card).style("display", "flex").style("justify-content", "space-between").style("align-items", "flex-start");
      createSpan(`${CONTRACT_ICONS[c.type] || atlasIconHTML('Chart', 14, '📋')} ${c.title}`)
        .parent(titleRow).style("color", "#c8e6c9").style("font-size", "13px").style("font-weight", "bold");
      createSpan(`${cashIconHTML(14)} ${c.reward}g`).parent(titleRow).style("color", "#d4af37").style("font-size", "13px").style("font-weight", "bold");

      const details = createDiv().parent(card).style("margin-top", "4px");
      if (c.source && c.target) {
        createSpan(`${c.source} → ${c.target}`).parent(details).style("color", "#aaa").style("font-size", "12px");
        createSpan("  ·  ").parent(details).style("color", "#555");
      }
      if (c.item && c.qty) {
        createSpan(`${c.qty}× ${c.item}`).parent(details).style("color", "#80cbc4").style("font-size", "12px");
        createSpan("  ·  ").parent(details).style("color", "#555");
      }
      const daysLeft = c.deadline != null ? c.deadline - day : null;
      if (daysLeft != null) {
        const deadlineColor = daysLeft <= 3 ? '#e74c3c' : daysLeft <= 7 ? '#f39c12' : '#aaa';
        createSpan(daysLeft > 0
          ? `${atlasIconHTML('Clock', 14, '⏰')} ${daysLeft}d left`
          : 'OVERDUE').parent(details)
          .style("color", deadlineColor).style("font-size", "12px").style("font-weight", daysLeft <= 3 ? "bold" : "normal");
      } else {
        createSpan("No deadline").parent(details).style("color", "#aaa").style("font-size", "12px");
      }

      if (c.type === 'survey' && c.surveyPoints) {
        const visited = (c.surveyVisited || []).filter(Boolean).length;
        createSpan(`Survey progress: ${visited}/${c.surveyPoints.length}`)
          .parent(createDiv().parent(card).style("margin-top", "6px"))
          .style("color", "#80cbc4").style("font-size", "12px");
        const barWrap = createDiv().parent(card).style("background", "#1a2a1a").style("border-radius", "4px")
          .style("height", "6px").style("margin-top", "4px").style("overflow", "hidden");
        createDiv().parent(barWrap).style("background", "#4caf50")
          .style("width", `${(visited / c.surveyPoints.length) * 100}%`).style("height", "100%");
      }

      if (c.repReward) {
        createSpan(`+${c.repReward} rep`).parent(card).style("display", "inline-block")
          .style("margin-top", "6px").style("font-size", "11px").style("color", "#81d4fa")
          .style("background", "#0a1a2a").style("border-radius", "4px").style("padding", "1px 6px");
      }

      const cid = c.id;
      createButton("✕ Cancel").parent(card)
        .style("float", "right").style("margin-top", "-22px").style("padding", "2px 8px")
        .style("font-size", "11px").style("cursor", "pointer").style("background", "#2a1010")
        .style("color", "#e88").style("border", "1px solid #5a2020").style("border-radius", "4px")
        .mousePressed(() => {
          if (typeof contractSystem !== 'undefined') contractSystem.cancel(cid);
          window._questsPages.contracts = 0;
          _invUpdateQuests();
        });
    });
  }

  // ── Bounties ───────────────────────────────────────
  const bountySection = createDiv().parent(container).style("margin-top", "16px");
  createElement("h3", "").parent(bountySection)
    .html(atlasLabelHTML('Dagger', 'Bounties', 16, '🎯'))
    .style("margin", "0 0 8px").style("color", "#d4af37");

  const claimable = (typeof bountyBoard !== 'undefined') ? (bountyBoard.claimable || []) : [];
  const allBounties = (typeof bountyBoard !== 'undefined') ? (bountyBoard.bounties || []) : [];
  const activeBounties = allBounties.filter(b => !b.claimed);
  const allBountyItems = [...claimable.map(b => ({ ...b, _claimable: true })), ...activeBounties];

  if (allBountyItems.length === 0) {
    createP("No active bounties. Visit a city's bounty board to take one.")
      .parent(bountySection).style("color", "#666").style("font-size", "13px");
  } else {
    _questsPaginate(bountySection, allBountyItems, 'bounties', (b, section) => {
      if (b._claimable) {
        const card = createDiv().parent(section);
        Object.assign(card.elt.style, {
          background: '#0d1a0d', border: '1px solid #4caf50', borderRadius: '8px',
          padding: '10px 12px', marginBottom: '8px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
        });
        const left = createDiv().parent(card);
        createSpan(`${atlasIconHTML('Friendly', 14, '✅')} ${b.name}`).parent(left).style("color", "#a5d6a7").style("font-weight", "bold").style("font-size", "13px");
        createDiv().parent(left).style("color", "#aaa").style("font-size", "12px")
          .html(`${b.isBoss ? `${atlasIconHTML('Love', 12, '👑')} Boss` : b.type} · ${cashIconHTML(12)} ${b.reward}g`);
        const bid = b.id;
        createButton("Collect").parent(card)
          .style("padding", "4px 14px").style("font-size", "12px").style("cursor", "pointer")
          .style("background", "#1b5e20").style("color", "#a5d6a7")
          .style("border", "1px solid #4caf50").style("border-radius", "4px")
          .mousePressed(() => {
            if (typeof bountyBoard !== 'undefined') bountyBoard.collectBounty(bid, true);
            window._questsPages.bounties = 0;
            _invUpdateQuests();
          });
      } else {
        const card = createDiv().parent(section);
        Object.assign(card.elt.style, {
          background: '#1a0d0d', border: '1px solid #4a2a2a', borderRadius: '8px',
          padding: '10px 12px', marginBottom: '8px',
        });
        const titleRow = createDiv().parent(card).style("display", "flex").style("justify-content", "space-between");
        createSpan(`${b.isBoss ? atlasIconHTML('Love', 14, '👑') : atlasIconHTML('Dagger', 14, '🗡️')} ${b.name}`).parent(titleRow)
          .style("color", "#ef9a9a").style("font-size", "13px").style("font-weight", "bold");
        createSpan(`${cashIconHTML(14)} ${b.reward}g`).parent(titleRow).style("color", "#d4af37").style("font-size", "13px");

        createSpan(`${b.type} · Str ${b.strength} · ${b.lastKnownTerrain}`)
          .parent(createDiv().parent(card).style("margin-top", "4px"))
          .style("color", "#aaa").style("font-size", "12px");

        const daysLeft = b.deadline - day;
        const deadlineColor = daysLeft <= 3 ? '#e74c3c' : daysLeft <= 7 ? '#f39c12' : '#aaa';
        createDiv().parent(card).style("margin-top", "4px")
          .html(`<span style="color:#888;font-size:12px">Last seen: (${b.lastKnownX}, ${b.lastKnownY})</span>` +
                `<span style="color:${deadlineColor};font-size:12px;margin-left:12px">${daysLeft > 0 ? daysLeft + 'd left' : 'OVERDUE'}</span>`);
      }
    });
  }
}

uiManager.registerScreen("inventoryView", {
  validStates: [GameStates.INVENTORY],

  create: () => {
    const wrapper = createDiv().id("inventoryView").class("screen inventory-screen").style("display", "none");

    // Header (always visible)
    const header = createDiv().class("inv-header").parent(wrapper);
    createElement("h2", "").parent(header).html(atlasLabelHTML('Bag', 'Inventory', 18, '🎒'));
    createSpan("").id("invGold").parent(header);
    createSpan("").id("invCargo").parent(header);

    // Tab bar
    const tabBar = createDiv().class("inv-tab-bar").parent(wrapper);
    const invTabBtn = createButton("").parent(tabBar).addClass("inv-tab inv-tab-active");
    invTabBtn.html(atlasLabelHTML('Bag', 'Inventory', 14, '🎒'));
    invTabBtn.elt.dataset.invTab = 'inventory';
    invTabBtn.mousePressed(() => _invSwitchTab('inventory'));
    const playerTabBtn = createButton("").parent(tabBar).addClass("inv-tab");
    playerTabBtn.html(atlasLabelHTML('player', 'Player', 14, '⚔️'));
    playerTabBtn.elt.dataset.invTab = 'player';
    playerTabBtn.mousePressed(() => _invSwitchTab('player'));
    const questsTabBtn = createButton("").parent(tabBar).addClass("inv-tab");
    questsTabBtn.html(atlasLabelHTML('Chart', 'Quests', 14, '📋'));
    questsTabBtn.elt.dataset.invTab = 'quests';
    questsTabBtn.mousePressed(() => _invSwitchTab('quests'));

    // ── Inventory tab ──
    const invTabContent = createDiv().id("invTabInventory").class("inv-tab-content").parent(wrapper);
    createDiv().id("invFilterBar").class("inv-filter-bar").parent(invTabContent);
    createDiv().id("invItemList").class("inv-item-list").parent(invTabContent);
    createElement("h3", "").parent(invTabContent).html(atlasLabelHTML('sloop', 'Fleet', 16, '⛵')).style("margin-top", "16px");
    createDiv().id("invFleet").class("inv-fleet").parent(invTabContent);

    // ── Player tab ──
    const playerTabContent = createDiv().id("invTabPlayer").class("inv-tab-content").parent(wrapper);
    const statsDiv = createDiv().id("invStats").class("inv-stats").parent(playerTabContent);
    // Progress bar for win condition
    const progressWrapper = createDiv().id("invProgressWrapper").class("inv-progress-wrapper").parent(statsDiv)
      .style("margin", "16px 0 8px 0");
    createSpan("").parent(progressWrapper).html(atlasLabelHTML('Chart', 'Win Progress:', 14, '🏆')).style("margin-right", "8px");
    const progressBarOuter = createDiv().class("inv-progress-bar-outer").parent(progressWrapper)
      .style("display", "inline-block").style("width", "220px").style("height", "18px")
      .style("background", "#222").style("border-radius", "9px").style("vertical-align", "middle");
    createDiv().id("invProgressBarInner").class("inv-progress-bar-inner").parent(progressBarOuter)
      .style("height", "100%")
      .style("width", "0%")
      .style("background", "linear-gradient(90deg, #ffd700, #4caf50)")
      .style("border-radius", "9px");
    createSpan("").id("invProgressText").parent(progressWrapper)
      .style("margin-left", "10px").style("font-weight", "bold");
    // --- Update win progress bar in Player tab ---
    const assets = player.getTotalAssets ? player.getTotalAssets() : player.gold;
    const goal = window._newGameGoldTarget || 5000;
    const pct = Math.max(0, Math.min(100, (assets / goal) * 100));
    const barInner = select("#invProgressBarInner");
    if (barInner) {
      barInner.style("width", `${pct}%`);
      if (pct >= 100) barInner.style("background", "linear-gradient(90deg, #4caf50, #ffd700)");
      else barInner.style("background", "linear-gradient(90deg, #ffd700, #4caf50)");
    }
    const progText = select("#invProgressText");
    if (progText) {
      progText.html(`${assets} / ${goal}g` + (pct >= 100 ? "  🎉" : ""));
    }

    // ── Quests tab ──
    const questsTabContent = createDiv().id("invTabQuests").class("inv-tab-content").parent(wrapper);
    questsTabContent.style("display", "none");
    createDiv().id("invQuestsContent").parent(questsTabContent);

    // Close button (show mapped inventory key)
    const invKey = (keyBindings && keyBindings.inventory && keyBindings.inventory.display) ? keyBindings.inventory.display : 'I';
    const closeBtn = createButton(`Close (${invKey})`)
      .parent(wrapper)
      .addClass("menu-btn")
      .id("invCloseBtn")
      .style("margin-top", "16px")
      .mousePressed(() => {
        gameStateManager.setState(window._isCityManageMode ? GameStates.CITY_MANAGE : GameStates.PLAYING);
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

    if (!window._invFilters) window._invFilters = { category: 'all', sort: 'default' };
    const invF = window._invFilters;

    // Build a fingerprint of current data to skip DOM rebuild if unchanged
    let fp = `${player.gold}|${player.combatStrength}|${player.cargoCapacity}|${player.fleet.length}|${player.activeBoat?.name || ""}|eq:${player.equippedWeapon || 'Fists'}|lv:${player.level}|xp:${player.xp}|sp:${player.statPoints}|hp:${player.bonusMaxHP}|atk:${player.bonusAttack}|def:${player.bonusDefense}|mag:${player.bonusMagic}|cha:${player.bonusCharm}|spd:${player.bonusSpeed}`;
    for (const [key, entry] of player.inventory) {
      fp += `|${key}:${entry.quantity}`;
    }
    if (typeof dayNight !== 'undefined') fp += `|d${dayNight.getDaysElapsed()}`;
    fp += `|icat:${invF.category}|isort:${invF.sort}`;
    if (fp === window._invLastFingerprint) return;
    window._invLastFingerprint = fp;

    // Gold & cargo
    select("#invGold")?.html(`${cashIconHTML(14)} Gold: ${player.gold}`);
    let totalWeight = 0;
    for (const [key, entry] of player.inventory) {
      const item = ItemLibrary[key];
      if (item) totalWeight += item.weight * entry.quantity;
    }
    const cap = player.getEffectiveCargoCapacity ? player.getEffectiveCargoCapacity() : (player.cargoCapacity || 50);
    select("#invCargo")?.html(`${atlasIconHTML('Crate', 14, '📦')} Cargo: ${totalWeight}/${cap}`);

    // Equipped weapon display
    let invWeaponEl = select("#invWeapon");
    if (!invWeaponEl) {
      invWeaponEl = createSpan("").id("invWeapon");
      const hdr = select(".inv-header");
      if (hdr) invWeaponEl.parent(hdr);
    }
    if (invWeaponEl) {
      const eqName = player.equippedWeapon || 'Fists';
      invWeaponEl.html(`${atlasIconHTML('Sword', 14, '⚔️')} ${eqName}`);
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

    // ── Filter bar ──
    const filterBar = select("#invFilterBar");
    if (filterBar) {
      filterBar.html("");
      const allCats = Object.keys(byCategory).sort();

      // Category pills — only when multiple categories present
      if (allCats.length > 1) {
        createSpan("All").parent(filterBar)
          .class("inv-filter-tag" + (invF.category === 'all' ? ' active' : ''))
          .mousePressed(() => { window._invFilters.category = 'all'; window._invLastFingerprint = null; uiManager.screens['inventoryView'].update(); });
        for (const cat of allCats) {
          createSpan(cat).parent(filterBar)
            .class("inv-filter-tag" + (invF.category === cat ? ' active' : ''))
            .mousePressed(() => { window._invFilters.category = cat; window._invLastFingerprint = null; uiManager.screens['inventoryView'].update(); });
        }
      }

      // Sort dropdown — native addEventListener so it fires reliably after DOM rebuild
      createSpan("Sort:").parent(filterBar).class("inv-filter-label");
      const sortSel = createElement("select").parent(filterBar);
      [["Default", "default"], ["Name A–Z", "name"], ["Heaviest", "weight"], ["Most qty", "qty"]]
        .forEach(([label, val]) => {
          const opt = createElement("option", label).parent(sortSel).attribute("value", val);
          if (invF.sort === val) opt.attribute("selected", "selected");
        });
      sortSel.elt.addEventListener('change', () => {
        window._invFilters.sort = sortSel.elt.value;
        window._invLastFingerprint = null;
        uiManager.screens['inventoryView'].update();
      });

      // Reset — shown when any filter is active
      if (invF.category !== 'all' || invF.sort !== 'default') {
        createSpan("✕").parent(filterBar).class("inv-filter-reset")
          .mousePressed(() => {
            window._invFilters.category = 'all';
            window._invFilters.sort = 'default';
            window._invLastFingerprint = null;
            uiManager.screens['inventoryView'].update();
          });
      }
    }

    // Flatten and sort all entries when a non-default sort is active
    const allEntries = Object.values(byCategory).flat();
    if (invF.sort === 'name')        allEntries.sort((a, b) => (a.item.name || a.name).localeCompare(b.item.name || b.name));
    else if (invF.sort === 'weight') allEntries.sort((a, b) => (b.item.weight * b.qty) - (a.item.weight * a.qty));
    else if (invF.sort === 'qty')    allEntries.sort((a, b) => b.qty - a.qty);

    if (Object.keys(byCategory).length === 0) {
      createP("No items in inventory.").parent(itemList).style("color", "#666");
    } else if (invF.sort !== 'default') {
      // Flat sorted list — no category headers
      const flatDiv = createDiv().class("inv-category").parent(itemList);
      for (const entry of allEntries) {
        if (invF.category !== 'all' && entry.item.category !== invF.category) continue;
        const row = createDiv().class("inv-item-row").parent(flatDiv);
        const iconEl = createItemIconEl(entry.name, 20);
        iconEl.classList.add('inv-item-icon');
        row.elt.appendChild(iconEl);
        createSpan(entry.item.name || entry.name).class("inv-item-name").parent(row);
        createSpan(`×${entry.qty}`).class("inv-item-qty").parent(row);
        createSpan(`${entry.item.weight}kg ea`).class("inv-item-weight").parent(row);
        if (entry.avgPrice > 0) createSpan(`avg ${Math.round(entry.avgPrice)}g`).class("inv-item-price").parent(row);
        _invRowButtons(row, entry);
      }
    } else {
      let anyVisible = false;
      for (const cat of Object.keys(byCategory).sort()) {
        if (invF.category !== 'all' && cat !== invF.category) continue;
        const entries = byCategory[cat];
        if (entries.length === 0) continue;
        anyVisible = true;

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
          _invRowButtons(row, entry);
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
          appendAtlasIcon(nameRow, BoatLibrary[boat.type] || boat.type, 18, icon, 'inv-item-icon');
          createSpan(boat.name).class("inv-fleet-boat-name").parent(nameRow);
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
          if (boat.captain) {
            createSpan(`${boat.captain.icon || '🧭'} Captain ${boat.captain.name} (${boat.captain.label || boat.captain.tier})`)
              .class("inv-fleet-details")
              .style("color", "#9ec")
              .parent(bRow);
          }
          if (boat.condition !== undefined) {
            const condPct = Math.max(0, Math.min(100, boat.condition));
            const condColor = condPct > 66 ? '#4caf50' : condPct > 33 ? '#ff9800' : '#f44336';
            const condOuter = createDiv().class("inv-fleet-cond-bar").parent(bRow);
            createDiv().class("inv-fleet-cond-fill").style("width", condPct + "%").style("background", condColor).parent(condOuter);
            createSpan(`Hull: ${condPct}%${boat.conditionLabel ? ` (${boat.conditionLabel()})` : ''}`).class("inv-fleet-cond-text").parent(bRow);
          }
          // Manage Hold button
          const holdBtn = createButton('').parent(bRow);
          holdBtn.html(atlasLabelHTML('sloop', 'Manage Hold', 12, '⚓'));
          holdBtn.style('margin-top', '6px').style('padding', '4px 12px').style('font-size', '11px')
            .style('cursor', 'pointer').style('border-radius', '4px')
            .style('background', '#1a2a3a').style('color', '#7ec8e3').style('border', '1px solid #3a6a8a');
          holdBtn.mousePressed(() => openBoatHoldPanel(boat));
        }
      }
    }

    // Quests tab — refresh if visible
    const questsTab = select("#invTabQuests");
    if (questsTab && questsTab.elt.style.display !== 'none') _invUpdateQuests();

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


function removeOverlayIfExists(overlayId) {
  const lib = window.KozEngine?.UI?.modalPrimitives;
  if (lib && typeof lib.removeById === 'function') {
    lib.removeById(document, overlayId);
    return;
  }
  document.getElementById(overlayId)?.remove();
}

function closeOverlayToPlaying(overlay) {
  overlay?.remove();
  gameStateManager.setState(GameStates.PLAYING);
}

function createModalCloseIcon(onClick) {
  const lib = window.KozEngine?.UI?.modalPrimitives;
  if (lib && typeof lib.createCloseIconButton === 'function') {
    return lib.createCloseIconButton(document, onClick);
  }
  const btn = document.createElement('button');
  btn.textContent = '✕';
  Object.assign(btn.style, {
    position: 'absolute', top: '10px', right: '12px', background: 'none', color: '#fff',
    border: 'none', fontSize: '20px', cursor: 'pointer', lineHeight: '1',
  });
  btn.onclick = onClick;
  return btn;
}

function createBackToCityButton(onClick, options = {}) {
  const lib = window.KozEngine?.UI?.modalPrimitives;
  if (lib && typeof lib.createBackButton === 'function') {
    return lib.createBackButton(document, onClick, options);
  }
  const btn = document.createElement('button');
  btn.textContent = '← Back to City';
  Object.assign(btn.style, {
    background: '#333', color: '#fff', border: '1px solid #555', padding: '10px 20px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
    marginTop: options.marginTop || '8px',
    width: options.width || '100%',
  });
  btn.onclick = onClick;
  return btn;
}

// ============================
// BOAT HOLD TRANSFER PANEL
// ============================
function openBoatHoldPanel(boat) {
  if (typeof tutorialSystem !== 'undefined' && tutorialSystem) {
    tutorialSystem.tryShow('boatHold');
  }
  removeOverlayIfExists('boatHoldOverlay');

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
  const boatDef = BoatLibrary[boat.type] || null;
  const boatIcon = createAtlasIconEl(boatDef || boat.type, 20, boatDef?.icon || '🚢');
  boatIcon.style.marginRight = '8px';
  titleEl.appendChild(boatIcon);
  titleEl.appendChild(document.createTextNode(`${boat.name} — Hold`));
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
    h.innerHTML = text;
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
    Object.assign(info.style, { display: 'flex', alignItems: 'center', gap: '6px' });
    const iconEl = createItemIconEl(itemKey, 16);
    iconEl.style.flexShrink = '0';
    info.appendChild(iconEl);
    const wt = itemObj?.weight || 1;
    const infoText = document.createElement('span');
    infoText.innerHTML = `<strong>${itemKey.replace(/([A-Z])/g,' $1').trim()}</strong> ×${qty} <span style="color:#556;font-size:10px">(${wt * qty}w)</span>`;
    infoText.style.fontSize = '12px';
    info.appendChild(infoText);
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
    colHeader(playerCol, `${atlasIconHTML('Bag', 16, '🎒')} Player Inventory (${pw}/${pc}w)`);
    colHeader(boatCol,   `${atlasIconHTML('sloop', 16, '⚓')} Boat Hold (${boat.getStorageWeight ? boat.getStorageWeight() : 0}/${boat.getStorageCapacity ? boat.getStorageCapacity() : 0}w)`);

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
  overlay.addEventListener('click', function _dismiss(e) { if (e.target === overlay) { overlay.removeEventListener('click', _dismiss); overlay.remove(); } });
}

// ============================
// MINIMAP CONTROLS (zoom +/-, mode toggle)
// ============================
uiManager.registerScreen("minimapControls", {
  validStates: [GameStates.PLAYING, GameStates.INVENTORY, GameStates.PAUSED],
  excludeWhen: ({ state }) => (
    (state === GameStates.PAUSED
    && window._pauseReturnState === GameStates.LEVEL_EDITOR)
    || (typeof window !== "undefined"
      && typeof window.isMobile === "function"
      && window.isMobile())
  ),

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
      btn.style('z-index', 'var(--z-layer-map-controls)');
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
  if (hint) hint.textContent = (window.isMobile && window.isMobile())
    ? 'Tap the enemy grid to fire and keep moving when warnings appear.'
    : 'Click the enemy grid to fire and use WASD to dodge warning shots.';

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
    if (!combatSystem.navalPhase) return;
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
      player_aim: { text: '⚓ Firing Window',      color: '#4caf50' },
      telegraph:  { text: '⚠️ Incoming Warning',  color: '#ff9800' },
      enemy_fire: { text: '💣 Incoming Fire!',     color: '#f44336' },
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
        ? 'linear-gradient(90deg,#ff9800,#ffd54f)'
        : phase === 'enemy_fire'
          ? 'linear-gradient(90deg,#f44336,#ff7043)'
          : 'linear-gradient(90deg,#2e7d32,#66bb6a)';
    }
    if (pct > 0 && combatSystem && !combatSystem.result && combatSystem.navalPhase === phase) {
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
    const escorts = Array.isArray(cs.playerEscortFleet) ? cs.playerEscortFleet.filter(e => e.alive && e.hp > 0) : [];
    const escortText = escorts.length > 0 ? ` • Escorts: ${escorts.length}` : '';
    hullEl.textContent = `Hull: ${b.condition}% (${b.conditionLabel()})${escortText}`;
    hullEl.style.color = b.conditionColor();
  }
  const escortEl = document.getElementById('navalEscortStatus');
  if (escortEl) {
    const escorts = Array.isArray(cs.playerEscortFleet) ? cs.playerEscortFleet : [];
    if (escorts.length > 0) {
      const parts = escorts.map(e => {
        const hp = Math.max(0, e.hp);
        const max = Math.max(1, e.maxHP || 1);
        const state = e.alive && hp > 0 ? `${hp}/${max}` : 'disabled';
        const cap = e.captain?.name || 'Captain';
        return `${e.boat?.name || 'Escort'} (${cap}: ${state})`;
      });
      escortEl.textContent = `Escorts in battle: ${parts.join(' • ')}`;
      escortEl.style.color = '#9ec';
    } else if ((cs.playerUncrewedSupport || 0) > 0) {
      escortEl.textContent = `${cs.playerUncrewedSupport} owned ship${cs.playerUncrewedSupport > 1 ? 's' : ''} not participating (no captain).`;
      escortEl.style.color = '#caa';
    } else {
      escortEl.textContent = 'No escort ships assigned.';
      escortEl.style.color = '#889';
    }
  }
  const escortGridWrap = document.getElementById('navalEscortGridWrap');
  if (escortGridWrap) {
    const escorts = Array.isArray(cs.playerEscortFleet) ? cs.playerEscortFleet : [];
    escortGridWrap.innerHTML = '';
    if (escorts.length > 0) {
      for (const escort of escorts) {
        const card = document.createElement('div');
        card.style.border = '1px solid #3a5a68';
        card.style.background = '#13202b';
        card.style.borderRadius = '6px';
        card.style.padding = '6px';

        const title = document.createElement('div');
        const hp = Math.max(0, escort.hp || 0);
        const max = Math.max(1, escort.maxHP || 1);
        const cap = escort.captain?.name || 'Captain';
        title.textContent = `🧭 ${escort.boat?.name || 'Escort'} • ${cap} • ${escort.alive && hp > 0 ? `${hp}/${max}` : 'disabled'}`;
        title.style.fontSize = '10px';
        title.style.color = escort.alive && hp > 0 ? '#9ec' : '#f88';
        title.style.marginBottom = '4px';
        card.appendChild(title);

        const mini = document.createElement('div');
        mini.style.display = 'grid';
        mini.style.gridTemplateColumns = `repeat(${NAVAL_GRID_SIZE}, 1fr)`;
        mini.style.gap = '2px';

        const size = BoatLibrary?.[escort.boat?.type]?.gridSize || 1;
        const startCol = Math.max(0, Math.floor((NAVAL_GRID_SIZE - size) / 2));
        const shipRow = Math.floor(NAVAL_GRID_SIZE / 2);
        const hpRatio = hp / max;
        const intactCells = Math.max(0, Math.round(size * hpRatio));

        for (let r = 0; r < NAVAL_GRID_SIZE; r++) {
          for (let c = 0; c < NAVAL_GRID_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'naval-cell';
            cell.style.minHeight = '18px';
            const onShip = r === shipRow && c >= startCol && c < startCol + size;
            if (onShip) {
              const seg = c - startCol;
              if (seg < intactCells && escort.alive) {
                cell.classList.add('naval-cell-ship');
                cell.textContent = '🚢';
              } else {
                cell.classList.add('naval-cell-ship-hit');
                cell.textContent = '💥';
              }
            } else {
              cell.classList.add('naval-cell-water');
              cell.textContent = '~';
            }
            mini.appendChild(cell);
          }
        }
        card.appendChild(mini);
        escortGridWrap.appendChild(card);
      }
    } else {
      const none = document.createElement('div');
      none.style.fontSize = '11px';
      none.style.opacity = '0.75';
      none.textContent = 'No captain escorts visible.';
      escortGridWrap.appendChild(none);
    }
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
          cell.textContent = '○';
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
  // Use event delegation on the grid container to avoid per-cell listener leaks
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
          cell.textContent = '○';
        } else {
          cell.classList.add('naval-cell-fog');
          cell.textContent = '?';
          cell.dataset.navR = r;
          cell.dataset.navC = c;
        }
        eGrid.appendChild(cell);
      }
    }
    // Single delegated listener (idempotent — only one per grid element)
    if (!eGrid._hasDelegatedClick) {
      eGrid.addEventListener('click', (e) => {
        const cell = e.target.closest('.naval-cell-fog');
        if (cell && cell.dataset.navR != null) {
          _navalCellClicked(+cell.dataset.navR, +cell.dataset.navC);
        }
      });
      eGrid._hasDelegatedClick = true;
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

  const pattern = _tunePatternForMobile(combatSystem.generatePattern());
  const actions = document.getElementById('combatActions');
  if (actions) actions.style.display = 'none';

  // Show "Get Ready!" countdown before the QTE starts
  _showQTECountdown(pattern.theme ? `${pattern.theme.emoji} Get Ready!` : '⚔️ Get Ready!', () => {
    switch (pattern.qteType) {
      case 'powerMeter':  _startAxeQTE(pattern); break;
      case 'clickTarget': _startCrossbowQTE(pattern); break;
      case 'spellMash':   _startStaffQTE(pattern); break;
      case 'spellTiming': _startStaffQTE(pattern); break; // backward compatibility
      default:            _startArrowQTE(pattern); break;
    }
  });
}

// ====== Shared QTE helpers ======

function _isMobileQTE() {
  try {
    if (typeof window !== 'undefined' && typeof window.getMobileContext === 'function') {
      return !!window.getMobileContext().mobile;
    }
    if (typeof window !== 'undefined' && typeof window.isMobile === 'function' && window.isMobile()) return true;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
  } catch (_e) {}
  return false;
}

function _makeQTEButton(label, onPress, extraClass = '') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `qte-touch-btn${extraClass ? ` ${extraClass}` : ''}`;
  btn.textContent = label;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onPress === 'function') onPress();
  });
  return btn;
}

function _renderArrowTouchControls(patternArea, pressFn) {
  if (!patternArea || !_isMobileQTE() || typeof pressFn !== 'function') return;
  const wrap = document.createElement('div');
  wrap.className = 'qte-touch-controls';
  wrap.innerHTML = '<div class="qte-touch-title">Touch Controls</div>';

  const dpad = document.createElement('div');
  dpad.className = 'qte-touch-dpad';
  dpad.appendChild(_makeQTEButton('←', () => pressFn(37), 'qte-touch-arrow'));
  dpad.appendChild(_makeQTEButton('↑', () => pressFn(38), 'qte-touch-arrow'));
  dpad.appendChild(_makeQTEButton('↓', () => pressFn(40), 'qte-touch-arrow'));
  dpad.appendChild(_makeQTEButton('→', () => pressFn(39), 'qte-touch-arrow'));
  wrap.appendChild(dpad);
  patternArea.appendChild(wrap);
}

function _renderTapTouchControl(patternArea, pressFn, label = 'Tap') {
  if (!patternArea || !_isMobileQTE() || typeof pressFn !== 'function') return;
  const wrap = document.createElement('div');
  wrap.className = 'qte-touch-controls';
  wrap.innerHTML = '<div class="qte-touch-title">Touch Controls</div>';
  wrap.appendChild(_makeQTEButton(label, () => pressFn(32), 'qte-touch-main'));
  patternArea.appendChild(wrap);
}

function _tunePatternForMobile(basePattern) {
  if (!basePattern || !_isMobileQTE()) return basePattern;
  const tuned = { ...basePattern };
  const type = tuned.qteType || '';
  tuned.totalTime = Math.round((Number(tuned.totalTime) || 0) * 1.18);

  if (type === 'powerMeter' && Number.isFinite(tuned.sweetSpotSize)) {
    tuned.sweetSpotSize = Math.min(0.46, tuned.sweetSpotSize * 1.2);
  }
  if (type === 'clickTarget') {
    if (Number.isFinite(tuned.timePerTarget)) tuned.timePerTarget = Math.round(tuned.timePerTarget * 1.22);
    if (Number.isFinite(tuned.targetCount)) tuned.targetCount = Math.max(3, tuned.targetCount - 1);
  }
  if (type === 'spellMash' && Number.isFinite(tuned.requiredPresses)) {
    tuned.requiredPresses = Math.max(6, Math.floor(tuned.requiredPresses * 0.78));
  }
  return tuned;
}

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

function _qteDirectionFromKeyCode(kc) {
  return ({
    37: 'left',
    38: 'up',
    39: 'right',
    40: 'down',
    65: 'left',
    68: 'right',
    83: 'down',
    87: 'up',
  })[kc] || null;
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
    const dir = _qteDirectionFromKeyCode(kc);
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
  _renderArrowTouchControls(patternArea, window._handlePatternKey);
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
  _renderTapTouchControl(patternArea, window._handlePatternKey, 'Tap Swing');
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
  _renderTapTouchControl(patternArea, window._handlePatternKey, 'Tap Shoot');
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
    removeTimers: [],
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

    const onTargetHit = (e) => {
      e.stopPropagation();
      if (state.done || target.dataset.alive !== 'true') return;
      target.dataset.alive = 'false';
      state.hits++;
      state.resolved++;
      target.classList.add('qte-crossbow-hit');
      const score = document.getElementById('crossbowScore');
      if (score) score.textContent = `${state.hits} / ${state.total}`;
      state.removeTimers.push(setTimeout(() => target.remove(), 200));
      checkComplete();
    };
    target.addEventListener('click', onTargetHit);
    target.addEventListener('touchstart', onTargetHit, { passive: true });

    field.appendChild(target);

    // Target expires after lifespan
    const fadeTimer = setTimeout(() => {
      if (target.dataset.alive === 'true') {
        target.dataset.alive = 'false';
        state.resolved++;
        target.classList.add('qte-crossbow-expired');
        state.removeTimers.push(setTimeout(() => target.remove(), 300));
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

// ====== Staff QTE — Arcane Mash (spacebar mashing) ======

function _startStaffQTE(pattern) {
  const patternArea = document.getElementById('patternArea');
  if (!patternArea) return;

  const needed = Math.max(1, Math.floor(pattern.requiredPresses || 18));
  const enemyMagic = Math.max(1, Math.floor(pattern.enemyMagic || 1));
  let html = `<p class="pattern-info">🪄 Mash SPACE to charge your spell! Enemy magic: ${enemyMagic}</p>`;
  html += `<div class="pattern-timer-wrap"><div class="pattern-timer-bar" id="patternTimerBar"></div></div>`;
  html += `<div class="qte-spell-center" style="display:flex;flex-direction:column;gap:8px;justify-content:center;align-items:center;min-height:170px">`;
  html += `  <div style="font-size:38px;line-height:1">✨</div>`;
  html += `  <div id="staffMashCount" style="font-size:26px;font-weight:700;color:#ffdca8">0 / ${needed}</div>`;
  html += `  <div style="width:78%;height:12px;background:rgba(255,255,255,0.12);border-radius:10px;overflow:hidden">`;
  html += `    <div id="staffMashFill" style="height:100%;width:0%;background:linear-gradient(90deg,#6fd3ff,#b26bff)"></div>`;
  html += `  </div>`;
  html += `</div>`;
  html += `<p class="qte-spell-cast" id="spellCast">Press SPACE ${needed} times before time runs out</p>`;
  html += `<p class="pattern-feedback" id="patternFeedback"></p>`;
  patternArea.innerHTML = html;
  patternArea.style.display = 'block';

  const countEl = document.getElementById('staffMashCount');
  const fillEl = document.getElementById('staffMashFill');

  const state = {
    total: needed, totalTime: pattern.totalTime,
    presses: 0,
    done: false, startTime: performance.now(),
  };

  function refreshProgress() {
    const pct = Math.max(0, Math.min(100, Math.round((state.presses / state.total) * 100)));
    if (countEl) countEl.textContent = `${state.presses} / ${state.total}`;
    if (fillEl) fillEl.style.width = `${pct}%`;
  }

  state.onTimeout = () => {
    state.timedOut = true;
    state.computedAccuracy = state.total > 0 ? Math.min(1, state.presses / state.total) : 0;
    _finishAttackPhase();
  };
  _patternState = state;
  window._combatPatternActive = true;
  _qteTimerBar(state);
  refreshProgress();

  window._handlePatternKey = (kc) => {
    if (state.done || state.presses >= state.total) return;
    if (kc !== 32) return; // Space only
    state.presses++;
    refreshProgress();

    // Visual feedback
    const center = document.querySelector('.qte-spell-center');
    if (center) { center.classList.add('qte-spell-hit'); setTimeout(() => center.classList.remove('qte-spell-hit'), 140); }

    if (state.presses >= state.total) {
      state.computedAccuracy = 1;
      _finishAttackPhase();
    }
  };
  _renderTapTouchControl(patternArea, window._handlePatternKey, 'Tap Cast');
}

// ====== Finish ATTACK phase (shared by all weapon QTEs) ======

function _finishAttackPhase() {
  if (!_patternState || _patternState.done) return;
  _patternState.done = true;
  window._combatPatternActive = false;
  window._handlePatternKey = null;

  // Clean up pending timers
  if (_patternState.spawnTimers) _patternState.spawnTimers.forEach(t => clearTimeout(t));
  if (_patternState.removeTimers) _patternState.removeTimers.forEach(t => clearTimeout(t));
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
  sound?.playEffect?.(pct >= 50 ? 'qteGood' : 'qteBad');

  // Snapshot HP before player attack sequence
  const hpBefore = { player: combatSystem.playerHP, enemy: combatSystem.raiderHP };

  setTimeout(() => {
    // --- QTE Timeout penalty: enemy gets a free hit before player attacks ---
    if (wasTimeout && pct === 0) {
      const timeoutResult = combatSystem.playerAction('attackTimeout');
      const pDelta = hpBefore.player - combatSystem.playerHP;
      if (pDelta > 0) _showDmgSplash('playerHpBar', pDelta);
      _refreshCombatBars();
      updateCombatLog(timeoutResult);
      if (timeoutResult.resolved) {
        const patternArea = document.getElementById('patternArea');
        if (patternArea) patternArea.style.display = 'none';
        return;
      }
      // Continue from post-timeout HP so follow-up attack deltas are not double-counted.
      hpBefore.player = combatSystem.playerHP;
      hpBefore.enemy = combatSystem.raiderHP;
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
  if (_isMobileQTE() && pattern) {
    pattern.totalTime = Math.round((Number(pattern.totalTime) || 0) * 1.2);
    pattern.approachTime = Math.round((Number(pattern.approachTime) || 2000) * 1.14);
    pattern.spawnInterval = Math.round((Number(pattern.spawnInterval || pattern.timePerBlock || 430)) * 1.08);
  }

  // Show countdown first, then launch the rhythm game
  _showQTECountdown(`🛡️ ${pattern.raiderName} Attacks!`, () => {
    _launchBlockRhythmQTE(pattern);
  });
}

function _launchBlockRhythmQTE(pattern) {
  const patternArea = document.getElementById('patternArea');
  if (!patternArea) return;

  const arrowSymbols = { left: '←', up: '↑', down: '↓', right: '→' };

  let html = `<p class="pattern-info qte-block-header">🛡️ Block incoming attacks!</p>`;
  html += `<div class="pattern-timer-wrap"><div class="pattern-timer-bar qte-block-timer" id="patternTimerBar"></div></div>`;
  html += `<div class="qte-rhythm-track" id="rhythmTrack">`;
  html += `  <div class="qte-rhythm-target-zone" id="rhythmTargetZone">`;
  html += `    <div class="qte-rhythm-target-inner"></div>`;
  html += `  </div>`;
  html += `  <div class="qte-rhythm-lane" id="rhythmLane"></div>`;
  html += `</div>`;
  html += `<p class="qte-block-score" id="blockScore">Blocked: 0 / ${pattern.attacks.length}</p>`;
  html += `<p class="qte-rhythm-hint">Press the matching arrow key or WASD as icons reach the shield zone!</p>`;
  html += `<p class="pattern-feedback" id="patternFeedback"></p>`;
  patternArea.innerHTML = html;
  patternArea.style.display = 'block';

  const trackEl = document.getElementById('rhythmTrack');
  const laneEl = document.getElementById('rhythmLane');
  const trackWidth = trackEl ? trackEl.offsetWidth : 400;

  // Target zone is on the left side — center at 14% of track width
  // Hit windows are in progress units
  // progress = 1.0 = arrow center at target zone center (visually centered = perfect)
  const mobileFactor = _isMobileQTE() ? 1.2 : 1.0;
  const perfectWindow = 0.09 * mobileFactor; // ±9% base
  const goodWindow = 0.18 * mobileFactor;    // ±18% base
  const missThreshold = 1.35; // arrow passes beyond target = missed

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
    const dir = _qteDirectionFromKeyCode(kc);
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
  _renderArrowTouchControls(patternArea, window._handlePatternKey);
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
  sound?.playEffect?.(pct >= 50 ? 'qteGood' : 'qteBad');

  const hpBefore = { player: combatSystem.playerHP, enemy: combatSystem.raiderHP };

  setTimeout(() => {
    // Timeout/hesitation punishment is resolved by CombatSystem (single source of truth).
    const result = (wasTimeout && pct === 0)
      ? combatSystem.playerAction('blockTimeout', blockAccuracy)
      : combatSystem.playerAction('block', blockAccuracy);

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
    createP("").id("navalEscortStatus").class("naval-hull-status").style("margin-top", "2px").parent(pSection);
    createDiv().id("playerNavalGrid").class("naval-grid").parent(pSection);

    // D-pad movement buttons for dodging — mobile only
    if (window.isMobile && window.isMobile()) {
      const dpad = createDiv().class("naval-dpad").parent(pSection);
      createDiv().class("naval-dpad-row").parent(dpad)
        .child(createButton("▲").class("naval-dpad-btn").mousePressed(() => { if (combatSystem) combatSystem.movePlayerShip('up'); }));
      const midRow = createDiv().class("naval-dpad-row").parent(dpad);
      createButton("◀").class("naval-dpad-btn").mousePressed(() => { if (combatSystem) combatSystem.movePlayerShip('left'); }).parent(midRow);
      createDiv().class("naval-dpad-center").parent(midRow);
      createButton("▶").class("naval-dpad-btn").mousePressed(() => { if (combatSystem) combatSystem.movePlayerShip('right'); }).parent(midRow);
      createDiv().class("naval-dpad-row").parent(dpad)
        .child(createButton("▼").class("naval-dpad-btn").mousePressed(() => { if (combatSystem) combatSystem.movePlayerShip('down'); }));
    }

    const eSection = createDiv().class("naval-grid-section").parent(navalGrids);
    const eLabelRow = createDiv().style("display","flex").style("align-items","center").style("gap","8px").parent(eSection);
    createP("🎯 Enemy Ship").class("naval-grid-label").style("margin","0").parent(eLabelRow);
    createSpan("").id("enemyBehaviorLabel").style("font-size","11px").style("opacity","0.7").parent(eLabelRow);
    createDiv().id("enemyNavalGrid").class("naval-grid").parent(eSection);

    createDiv().id("navalEscortGridWrap")
      .style("display", "grid")
      .style("grid-template-columns", "repeat(auto-fit, minmax(140px, 1fr))")
      .style("gap", "8px")
      .style("margin-top", "8px")
      .parent(navalArea);

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

    createP("Click the enemy grid to fire and use WASD to dodge warning shots.").id("navalHint").class("naval-hint").parent(navalArea);

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
          if (typeof gameStateManager !== 'undefined' && gameStateManager.is(GameStates.COMBAT)) {
            gameStateManager.setState(GameStates.PLAYING);
          }
        } else {
          gameStateManager.setState(GameStates.PLAYING);
        }
      });

    return wrapper;
  },

  show: () => {
    const view = select("#combatView");
    if (view) {
      view.show().style("display", "flex").style("opacity", "1");
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
          if (enemyName) enemyName.textContent = combatSystem.raider?.name || `Pirate ${eBoat.displayName}`;

          // Hide land-combat actions, show naval UI
          select("#combatActions")?.style("display", "none");
          _initNavalUI();
          _refreshCombatBars();

          // Render initial log
          if (combatSystem.log && combatSystem.log.length > 0) {
            const log = select("#combatLog");
            if (log) {
              combatSystem.log.forEach(msg => {
                if (!msg) return;
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
        const namedEnemy = combatSystem.raider?.name || '';
        if (title) {
          title.html(isMonster ? `🐉 ${(namedEnemy || rType.name)} Appears!` : "⚔️ Raiders Attack!");
        }
        select("#combatDesc")?.html(
          isMonster
            ? (namedEnemy
              ? `A fearsome ${rType.name}, <b>${namedEnemy}</b>, blocks your path! (Str: ${combatSystem.raider.strength})`
              : `A fearsome ${rType.name} blocks your path! (Str: ${combatSystem.raider.strength})`)
            : (namedEnemy
              ? `<b>${namedEnemy}</b>, a ${rType.name.toLowerCase()}, blocks your path! (Str: ${combatSystem.raider.strength})`
              : `A band of ${combatSystem.raider.strength} raiders blocks your path!`)
        );

        // Restore player icon for land combat
        const playerIcon = document.querySelector('.player-icon');
        if (playerIcon) playerIcon.innerHTML = atlasIconHTML('player', 48, '🛡️');

        const enemyIcon = document.getElementById('enemyIcon');
        if (enemyIcon) {
          const iconMap = { dragon: '🐉', blackKnight: '🗡️', wraith: '👻', seaMonster: '🦑' };
          enemyIcon.innerHTML = iconMap[combatSystem.raiderType]
            || atlasIconHTML('raider', 48, '💀');
        }
        const enemyName = document.getElementById('enemyNameLabel');
        if (enemyName) enemyName.textContent = namedEnemy || rType.name;

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
        const targetState = window._eventReturnState
          || (window._isCityManageMode ? GameStates.CITY_MANAGE : GameStates.PLAYING);
        window._eventReturnState = null;
        if (gameStateManager.currentState !== targetState) {
          gameStateManager.setState(targetState);
        }
        // Force-close stale event UI even if state was already changed before Continue.
        uiManager.hideScreen("eventView");
      });

    return wrapper;
  },

  show: () => {
    const view = select("#eventView");
    if (view) {
      view.show().style("opacity", "1");
      if (view.elt) {
        view.elt.scrollTop = 0;
        view.elt.scrollLeft = 0;
      }
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
      // Default travel/random events return to the active game mode.
      window._eventReturnState = window._isCityManageMode ? GameStates.CITY_MANAGE : GameStates.PLAYING;
      const evt = eventSystem.currentEvent;
      select("#eventTitle")?.html(`${atlasIconHTML('Dice', 16, '🎲')} ${evt.name}`);
      select("#eventDesc")?.html(evt.description);

      const choicesDiv = select("#eventChoices");
      choicesDiv?.html("");

      // Start animated timer bar if event has a time limit
      if (evt.timeLimit && eventSystem.getTimerRemaining() > 0) {
        select("#eventTimerWrap")?.style("display", "block");
        const totalMs = evt.timeLimit * 1000;
        const deadline = eventSystem._countdown._deadline;

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
    } else if (window._cityEventActive && typeof cityManagement !== 'undefined') {
      // City events return to the mode they were triggered from.
      const evt = window._cityEventActive;
      window._eventReturnState = evt.returnState
        || (window._isCityManageMode ? GameStates.CITY_MANAGE : GameStates.PLAYING);
      // Render city-management events inside the shared event view so UX is consistent
      select("#eventTitle")?.html(`${atlasIconHTML('Dice', 16, '🎲')} ${evt.name}`);
      select("#eventDesc")?.html(evt.description);

      const choicesDiv = select("#eventChoices");
      choicesDiv?.html("");

      // Timer handling for city events (in-game timer, not wall-clock)
      const cityRemainingMs = (typeof cityManagement.getCityEventTimerRemainingMs === 'function')
        ? cityManagement.getCityEventTimerRemainingMs()
        : 0;
      if (evt.timeLimit && cityRemainingMs > 0) {
        select("#eventTimerWrap")?.style("display", "block");
        const totalMs = evt.timeLimit * 1000;

        function animateCityEventBar() {
          const remaining = (typeof cityManagement.getCityEventTimerRemainingMs === 'function')
            ? cityManagement.getCityEventTimerRemainingMs()
            : 0;
          const pct = Math.max(0, remaining / totalMs);
          const bar = document.getElementById('eventTimerBar');
          if (bar) {
            bar.style.width = (pct * 100) + '%';
            if (pct > 0.5) {
              bar.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
            } else if (pct > 0.25) {
              bar.style.background = 'linear-gradient(90deg, #ff9800, #FFC107)';
            } else {
              bar.style.background = 'linear-gradient(90deg, #f44336, #ff5722)';
            }
          }
          if (pct > 0 && window._cityEventActive) {
            window._eventTimerAnim = requestAnimationFrame(animateCityEventBar);
          }
        }
        window._eventTimerAnim = requestAnimationFrame(animateCityEventBar);
      }

      if (evt.choices) {
        for (let i = 0; i < evt.choices.length; i++) {
          const choice = evt.choices[i];
          const choiceLabel = typeof choice === 'string' ? choice
            : (typeof choice.text === 'function' ? choice.text() : choice.text);
          createButton(choiceLabel)
            .parent(choicesDiv)
            .addClass("event-choice-btn")
            .mousePressed(() => {
              if (window._eventTimerAnim) { cancelAnimationFrame(window._eventTimerAnim); window._eventTimerAnim = null; }
              select("#eventTimerWrap")?.style("display", "none");
              const isMinigameChoice = choice && typeof choice === 'object' && choice.action === 'minigame';
              if (isMinigameChoice && typeof cityManagement.launchCityEventChoiceMinigame === 'function') {
                const launched = cityManagement.launchCityEventChoiceMinigame(i, (mgResult) => {
                  window._cityEventActive = null;
                  showEventResult(mgResult);
                });
                if (launched) return;
              }
              const result = cityManagement.resolveCityEvent(i);
              // Clear the global reference; Continue handles the mode return.
              window._cityEventActive = null;
              showEventResult(result);
            });
        }
      }
    } else {
      // Safety fallback: RANDOM_EVENT is active but payload was already consumed.
      if (!window._eventReturnState) {
        window._eventReturnState = window._isCityManageMode ? GameStates.CITY_MANAGE : GameStates.PLAYING;
      }
      select("#eventTitle")?.html(atlasLabelHTML('Dice', 'Event', 16, '🎲'));
      select("#eventChoices")?.html("");
      select("#eventDesc")
        ?.html("This event has already been resolved. Click Continue to resume.")
        .style("color", "#ccc");
      select("#eventContinueBtn")?.style("display", "block");
    }
  },

  hide: () => {
    const view = select("#eventView");
    if (view) { view.style("opacity", "0"); uiManager.scheduleFadeHide("eventView", 200); }
  }
});

function showEventResult(result) {
  // Safety: still render a result state even if resolution payload is missing.
  if (!result) {
    result = {
      message: "The event concludes.",
      type: "info",
    };
  }

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

  // Scroll result into view before showing the continue button so the text is readable.
  const eventViewEl = select("#eventView");
  if (eventViewEl && eventViewEl.elt) {
    eventViewEl.elt.scrollTop = 0;
    eventViewEl.elt.scrollLeft = 0;
  }
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
    const tradeIncome = Number(summary.income) || 0;
    const stageIncome = Number(summary.stageIncome) || 0;
    const spending = Number(summary.spending) || 0;
    const tax = Number(summary.tax) || 0;
    const storageCost = Number(summary.storageCost) || 0;
    const portMaintenance = Number(summary.portMaintenance) || 0;
    const taxRatePercent = Number.isFinite(Number(summary.taxRatePercent))
      ? Number(summary.taxRatePercent)
      : Math.round((((window.DIFFICULTY_CONFIG?.taxRate) ?? player?.taxRate ?? 0) || 0) * 100);
    const boatDetails = Array.isArray(summary.boatDetails) ? summary.boatDetails : [];

    // Income / spending this week
    lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
      <span>${cashIconHTML(14)} Trade Income</span><span style="color:#4caf50">+${tradeIncome}g</span></div>`);
    if (stageIncome > 0) {
      lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
        <span>🏙️ City Stakes Income</span><span style="color:#66bb6a">+${stageIncome}g</span></div>`);
      if (Array.isArray(summary.stageIncomeDetails)) {
        for (const d of summary.stageIncomeDetails) {
          if (!d || !d.amount) continue;
          const src = d.source === 'bank' ? 'Bank Interest' : d.source === 'shop' ? 'Shop Dividend' : 'Stake';
          lines.push(`<div style="display:flex;justify-content:space-between;padding:2px 0 4px 14px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px;opacity:.9">
            <span>• ${d.city} — ${src}</span><span style="color:#81c784">+${d.amount}g</span></div>`);
        }
      }
    }
    lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
      <span>${atlasIconHTML('trader', 14, '🛒')} Purchases</span><span style="color:#ff9800">-${spending}g</span></div>`);

    // Tax
    const taxColor = summary.taxPaid ? "#ff9800" : "#ff4f4f";
    const taxLabel = summary.taxPaid ? `-${tax}g` : `-${tax}g (unpaid!)`;
    lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
      <span>${cashIconHTML(14)} Tax (${taxRatePercent}%)</span><span style="color:${taxColor}">${taxLabel}</span></div>`);

    // Port maintenance: boats
    if (boatDetails.length > 0) {
      for (const b of boatDetails) {
        lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
          <span>${atlasIconHTML('sloop', 14, '⚓')} ${b.name} (${b.type})</span><span style="color:#ff9800">-${b.fee}g</span></div>`);
      }
    }

    // Storage upkeep
    if (storageCost > 0) {
      lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
        <span>${atlasIconHTML('Crate', 14, '📦')} Storage Upkeep</span><span style="color:#ff9800">-${storageCost}g</span></div>`);
    }

    // No maintenance
    if (portMaintenance === 0) {
      lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
        <span>${atlasIconHTML('sloop', 14, '⚓')} Port Maintenance</span><span style="color:#888">0g</span></div>`);
    }

    // Hull wear
    if (summary.wearApplied && boatDetails.length > 0) {
      for (const boat of boatDetails) {
        const cColor = boat.conditionColor || '#888';
        const cLabel = boat.conditionLabel || '';
        const conditionText = boat.sunk ? cLabel : `${boat.condition}% ${cLabel}`.trim();
        lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
          <span>${atlasIconHTML('Tools', 14, '🔧')} "${boat.name}" hull wear</span><span style="color:${cColor}">${conditionText}</span></div>`);
      }
    }

    // Bank lines
    if (summary.bankInterest > 0) {
      lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
        <span>${atlasIconHTML('Bank', 14, '🏦')} Deposit Interest (1%)</span><span style="color:#4caf50">+${summary.bankInterest}g</span></div>`);
    }
    if (summary.loanInterest > 0) {
      lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
        <span>${atlasIconHTML('Bank', 14, '📝')} Loan Interest (8%)</span><span style="color:#f44336">+${summary.loanInterest}g owed</span></div>`);
    }
    if (summary.investmentReturns > 0) {
      lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
        <span>${atlasIconHTML('Chart', 14, '📈')} Investment Returns</span><span style="color:#4fc3f7">+${summary.investmentReturns}g</span></div>`);
    }

    // Totals
    const netWeek = tradeIncome + stageIncome - spending - (Number(summary.totalCosts) || 0);
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

    window._gameWonTextEl = createP("")
      .id("gameWonText")
      .style("margin-bottom", "20px")
      .parent(wrapper);

    createButton("Keep Playing")
      .parent(wrapper)
      .addClass("menu-btn")
      .mousePressed(() => {
        player.hasWon = true;
        player.continuedAfterWin = true;
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
    if (window.BQInfo && typeof window.BQInfo.recordWinFromRuntime === 'function') {
      window.BQInfo.recordWinFromRuntime();
    }
    const goldTarget = window._newGameGoldTarget || 5000;
    const days = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : '?';
    const txt = window._gameWonTextEl || select("#gameWonText");
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

    window._gameLoseMsgEl = createP("").id("gameLoseMessage")
      .style("margin-bottom", "20px")
      .parent(wrapper);

    // Retry button (hidden on hardcore)
    window._gameLoseRetryBtn = createButton("Retry")
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
    const msgEl = window._gameLoseMsgEl || select("#gameLoseMessage");
    const retryBtn = window._gameLoseRetryBtn || select("#gameLoseRetryBtn");
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
    case 'MarketAnalysis':        showMarketAnalysisBook(); break;
    case 'HolidaysBook':          showHolidaysBook(); break;
    case 'NegotiationForDummies': showNegotiationBook(); break;
    case 'ConflictResolution':    showConflictResolutionBook(); break;
    case 'TreasureHunter':        showTreasureHunterBook(); break;
    case 'SeaLegs':               showSeaLegsBook(); break;
    case 'Pirating101':           showPiratingBook(); break;
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
  overlay.addEventListener('click', function _dismiss(e) { if (e.target === overlay) { overlay.removeEventListener('click', _dismiss); overlay.remove(); } });

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
    position: 'sticky', top: '0', background: '#1a1a2e', zIndex: '4',
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
      Object.assign(seasonP.style, { fontSize: '12px', margin: '0 0 12px', color: '#8bc34a' });
      const seasonLabel = document.createElement('span');
      seasonLabel.textContent = 'High demand seasons:';
      seasonLabel.style.color = '#aaa';
      seasonP.appendChild(seasonLabel);

      for (const seasonName of itemData.seasonality) {
        const seasonChip = document.createElement('span');
        Object.assign(seasonChip.style, {
          display: 'inline-flex',
          alignItems: 'center',
          marginLeft: '8px',
        });
        seasonChip.appendChild(createSeasonIconEl(seasonName, 16));
        seasonChip.appendChild(document.createTextNode(seasonName));
        seasonP.appendChild(seasonChip);
      }

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
      const svgW = 300, svgH = 50;
      const axisH = 10; // space for x-axis labels
      const plotH = svgH - axisH;
      const minVal = Math.min(...history);
      const maxVal = Math.max(...history);
      const range = maxVal - minVal || 1;
      const points = history.map((v, i) => {
        const x = history.length > 1 ? (i / (history.length - 1)) * svgW : svgW / 2;
        const y = plotH - ((v - minVal) / range) * (plotH - 4) - 2;
        return `${x},${y}`;
      }).join(' ');

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', svgW);
      svg.setAttribute('height', svgH);
      svg.style.background = '#111';
      svg.style.borderRadius = '4px';

      // X-axis baseline
      const axisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      axisLine.setAttribute('x1', 0); axisLine.setAttribute('y1', plotH);
      axisLine.setAttribute('x2', svgW); axisLine.setAttribute('y2', plotH);
      axisLine.setAttribute('stroke', '#333'); axisLine.setAttribute('stroke-width', '1');
      svg.appendChild(axisLine);

      // X-axis labels: first and last sample index
      const mkText = (txt, x, anchor) => {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.textContent = txt;
        t.setAttribute('x', x); t.setAttribute('y', svgH - 1);
        t.setAttribute('text-anchor', anchor);
        t.setAttribute('font-size', '8');
        t.setAttribute('fill', '#555');
        return t;
      };
      svg.appendChild(mkText('1', 2, 'start'));
      svg.appendChild(mkText(String(history.length), svgW - 2, 'end'));

      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('points', points);
      polyline.setAttribute('fill', 'none');
      polyline.setAttribute('stroke', cityColors[ci % cityColors.length]);
      polyline.setAttribute('stroke-width', '2');
      svg.appendChild(polyline);

      chartRow.appendChild(svg);

      // Current value + min/max range
      const val = document.createElement('span');
      val.innerHTML = `<b style="color:#fff">${history[history.length - 1]}g</b><br><span style="color:#555;font-size:10px">${minVal}–${maxVal}</span>`;
      Object.assign(val.style, { fontSize: '11px', color: '#aaa', width: '60px', lineHeight: '1.3' });
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

// ───────────────────────────────────────────────────
//  TREASURE HUNTER'S GUIDE BOOK
// ───────────────────────────────────────────────────
function showTreasureHunterBook() {
  const { overlay, popup } = _createBookOverlay("Treasure Hunter's Guide", "🗺️");
  const bookData = ItemLibrary['TreasureHunter'];
  const bonus = player.modifiers?.treasureValueBonus || 0;

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
  effectTitle.textContent = '⛏️ Active Effects';
  Object.assign(effectTitle.style, { color: '#d4af37', margin: '0 0 8px' });
  effectBox.appendChild(effectTitle);

  const effects = [
    { label: 'Treasure Value Bonus', value: `+${(bonus * 100).toFixed(0)}%`, color: '#d4af37' },
  ];

  // Show fragment count if treasure system available
  if (typeof treasureSystem !== 'undefined') {
    const fragments = treasureSystem.fragments || [];
    const grouped = {};
    for (const f of fragments) {
      grouped[f.region] = (grouped[f.region] || 0) + 1;
    }
    const regionNames = Object.keys(grouped);
    if (regionNames.length > 0) {
      effects.push({ label: 'Map Fragments Held', value: `${fragments.length} total`, color: '#c8d6e5' });
      for (const r of regionNames) {
        effects.push({ label: `  ${r} region`, value: `${grouped[r]}/3`, color: grouped[r] >= 3 ? '#4CAF50' : '#aaa' });
      }
    } else {
      effects.push({ label: 'Map Fragments Held', value: 'None yet', color: '#666' });
    }
  }

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
  Object.assign(flavorBox.style, { background: '#1a1505', border: '1px solid #4a3a05', borderRadius: '8px', padding: '12px', marginTop: '10px' });
  popup.appendChild(flavorBox);
  const flavorText = document.createElement('p');
  flavorText.innerHTML = `<i>"X marks the spot — but knowing which X to follow is the real treasure."</i><br><br>` +
    `Collect <b>3 map fragments from the same region</b> to assemble a complete treasure map. ` +
    `Dig sites yield <b>${(bonus * 100).toFixed(0)}% more gold</b> while this book is in your possession.`;
  Object.assign(flavorText.style, { color: '#c8b870', fontSize: '12px', margin: '0', lineHeight: '1.5' });
  flavorBox.appendChild(flavorText);
}

// ───────────────────────────────────────────────────
//  SEA LEGS BOOK
// ───────────────────────────────────────────────────
function showSeaLegsBook() {
  const { popup } = _createBookOverlay("Sea Legs", "🌊");
  const bookData = ItemLibrary['SeaLegs'];
  const hasEffect = player.modifiers?.seaLegs || false;

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
  effectTitle.textContent = '⚓ Active Effects';
  Object.assign(effectTitle.style, { color: '#4ecdc4', margin: '0 0 8px' });
  effectBox.appendChild(effectTitle);

  const effects = [
    { label: 'Free Coastline Boarding', value: hasEffect ? '✔ Active' : '✘ Inactive', color: hasEffect ? '#4CAF50' : '#e74c3c' },
    { label: 'Port Restriction (WASD)', value: hasEffect ? 'Bypassed' : 'Enforced', color: hasEffect ? '#4CAF50' : '#aaa' },
    { label: 'Port Restriction (Click-move)', value: hasEffect ? 'Bypassed' : 'Enforced', color: hasEffect ? '#4CAF50' : '#aaa' },
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
  Object.assign(flavorBox.style, { background: '#051520', border: '1px solid #0a3050', borderRadius: '8px', padding: '12px', marginTop: '10px' });
  popup.appendChild(flavorBox);
  const flavorText = document.createElement('p');
  flavorText.innerHTML = `<i>"Any beach is a port to a sailor who knows the tides."</i><br><br>` +
    `Without this book, boarding or leaving your vessel requires a port city nearby. ` +
    `With Sea Legs, you can step off <b>anywhere along the coastline</b> — useful for reaching inland cities that lack port access, ` +
    `or escaping trouble quickly.`;
  Object.assign(flavorText.style, { color: '#80b8d0', fontSize: '12px', margin: '0', lineHeight: '1.5' });
  flavorBox.appendChild(flavorText);
}

// ───────────────────────────────────────────────────
//  PIRATING 101 BOOK
// ───────────────────────────────────────────────────
function showPiratingBook() {
  const { popup } = _createBookOverlay("Pirating 101", "🏴‍☠️");
  const bookData = ItemLibrary['Pirating101'];
  const hasEffect = player.modifiers?.traderPiracy || false;

  const desc = document.createElement('p');
  desc.textContent = bookData?.bookDescription || '';
  Object.assign(desc.style, { color: '#aaa', fontSize: '13px', lineHeight: '1.5', margin: '0 0 16px' });
  popup.appendChild(desc);

  const effectBox = document.createElement('div');
  Object.assign(effectBox.style, {
    background: '#0d0d1a', border: '1px solid #333', borderRadius: '8px',
    padding: '14px', marginBottom: '12px',
  });
  popup.appendChild(effectBox);

  const effectTitle = document.createElement('h4');
  effectTitle.textContent = '⚔️ Active Effects';
  Object.assign(effectTitle.style, { color: '#ff9f43', margin: '0 0 8px' });
  effectBox.appendChild(effectTitle);

  const rows = [
    { label: 'Raid Trader Boats', value: hasEffect ? '✔ Unlocked' : '✘ Locked', color: hasEffect ? '#4CAF50' : '#e74c3c' },
    { label: 'Encounter Prompt', value: hasEffect ? 'Shown on collision with traveling trader' : 'Unavailable', color: '#c8d6e5' },
  ];

  for (const r of rows) {
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', justifyContent: 'space-between', padding: '4px 0' });
    const lbl = document.createElement('span');
    lbl.textContent = r.label;
    Object.assign(lbl.style, { color: '#aaa', fontSize: '13px' });
    row.appendChild(lbl);
    const val = document.createElement('span');
    val.textContent = r.value;
    Object.assign(val.style, { color: r.color, fontSize: '13px', fontWeight: 'bold' });
    row.appendChild(val);
    effectBox.appendChild(row);
  }

  const flavorBox = document.createElement('div');
  Object.assign(flavorBox.style, { background: '#201208', border: '1px solid #5e3b18', borderRadius: '8px', padding: '12px', marginTop: '10px' });
  popup.appendChild(flavorBox);
  const flavorText = document.createElement('p');
  flavorText.innerHTML = `<i>"Strike fast, strike hard, leave no ledger behind."</i><br><br>` +
    `When you collide with a traveling trader, you can choose to raid them. ` +
    `Victory sinks their operation and grants cargo loot.`;
  Object.assign(flavorText.style, { color: '#d4b08a', fontSize: '12px', margin: '0', lineHeight: '1.5' });
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
    closeOverlayToPlaying(overlay);
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
    removeOverlayIfExists('bountyBoardOverlay');

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
    header.innerHTML = `${atlasIconHTML('Chart', 18, '📜')} Bounty Board — ${city.name}`;
    Object.assign(header.style, { color: '#d4af37', margin: '0 0 16px', textAlign: 'center' });
    popup.appendChild(header);
    const closeIconBtn = createModalCloseIcon(() => closeOverlayToPlaying(overlay));
    popup.appendChild(closeIconBtn);

    // Generate bounties for this city
    const activeBounties = bountyBoard.getBountiesForCity(city.name);
    const claimable = bountyBoard.claimable || [];
    const bounties = [...activeBounties];

    // Show claimable bounties section first
    if (claimable.length > 0) {
      const claimTitle = document.createElement('h4');
      claimTitle.innerHTML = atlasLabelHTML('Cash', 'Ready to Collect', 16, '💰');
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
        info.innerHTML = `${b.isBoss ? atlasIconHTML('Hardcore', 14, '💀') : atlasIconHTML('Dagger', 14, '🗡️')} ${b.name} — ${b.reward}g`;
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
      name.innerHTML = `${b.isBoss ? atlasIconHTML('Hardcore', 14, '💀') : atlasIconHTML('Dagger', 14, '🗡️')} ${b.name}`;
      Object.assign(name.style, { color: b.isBoss ? '#f44336' : '#ff9800', fontWeight: 'bold', fontSize: '14px' });
      topRow.appendChild(name);

      const reward = document.createElement('span');
      reward.innerHTML = `${cashIconHTML(14)} ${b.reward}g`;
      Object.assign(reward.style, { color: '#d4af37', fontWeight: 'bold', fontSize: '14px' });
      topRow.appendChild(reward);

      const desc = document.createElement('div');
      desc.textContent = `${b.type.toUpperCase()} — Last seen near ${b.lastKnownTerrain}. Deadline: day ${b.deadline}.`;
      Object.assign(desc.style, { color: '#aaa', fontSize: '12px' });
      card.appendChild(desc);
    }

    // Close button
    const closeBtn = createBackToCityButton(() => closeOverlayToPlaying(overlay), { marginTop: '12px' });
    popup.appendChild(closeBtn);
  },

  hide: () => {
    removeOverlayIfExists('bountyBoardOverlay');
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

    removeOverlayIfExists('bankOverlay');

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
    header.innerHTML = `${atlasIconHTML('Bank', 18, '🏦')} Bank of ${city.name}`;
    Object.assign(header.style, { color: '#d4af37', margin: '0 0 16px', textAlign: 'center' });
    popup.appendChild(header);
    const closeIconBtn = createModalCloseIcon(() => closeOverlayToPlaying(overlay));
    popup.appendChild(closeIconBtn);

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
    depTitle.innerHTML = atlasLabelHTML('Cash', 'Deposits (1% weekly interest)', 16, '💰');
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
    loanTitle.innerHTML = atlasLabelHTML('Bank', 'Loans (8% weekly interest)', 16, '📝');
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
    invTitle.innerHTML = atlasLabelHTML('Chart', 'Investments (10-20 day maturity)', 16, '📈');
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
    insTitle.innerHTML = atlasLabelHTML('Shield', 'Insurance (10% premium, 70% payout)', 16, '🛡️');
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
    const closeBtn = createBackToCityButton(() => closeOverlayToPlaying(overlay));
    popup.appendChild(closeBtn);
  },

  hide: () => {
    removeOverlayIfExists('bankOverlay');
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

    removeOverlayIfExists('gamblingOverlay');

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
    header.innerHTML = `${atlasIconHTML('Dice', 18, '🎲')} Gambling Den — ${city.name}`;
    Object.assign(header.style, { color: '#d4af37', margin: '0 0 16px', textAlign: 'center' });
    popup.appendChild(header);
    const closeIconBtn = createModalCloseIcon(() => closeOverlayToPlaying(overlay));
    popup.appendChild(closeIconBtn);

    const goldInfo = document.createElement('div');
    goldInfo.innerHTML = `${cashIconHTML(14)} Your Gold: ${player.gold}g`;
    Object.assign(goldInfo.style, { color: '#d4af37', textAlign: 'center', fontSize: '14px', marginBottom: '16px' });
    popup.appendChild(goldInfo);

    const games = [
      { nameHTML: atlasLabelHTML('Dice', 'Dice Poker', 16, '🎲'), desc: 'Roll 5 dice, make poker hands. Bet and play!', minBet: 20, id: 'dicePoker' },
      { nameHTML: atlasLabelHTML('Book', 'Memory Match', 16, '🧠'), desc: 'Match pairs of cards. Win prizes for a sharp memory!', minBet: 15, id: 'memoryMatch' },
      { nameHTML: atlasLabelHTML('Wheel', 'Wheel of Fortune', 16, '🎡'), desc: 'Spin the wheel and pray to the gods of luck!', minBet: 10, id: 'wheelOfFortune' },
    ];

    for (const game of games) {
      const card = document.createElement('div');
      Object.assign(card.style, {
        background: '#1a1a2e', padding: '14px', borderRadius: '8px',
        marginBottom: '10px', borderLeft: '4px solid #d4af37',
      });
      popup.appendChild(card);

      const title = document.createElement('div');
      title.innerHTML = game.nameHTML;
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
    const closeBtn = createBackToCityButton(() => closeOverlayToPlaying(overlay));
    popup.appendChild(closeBtn);
  },

  hide: () => {
    removeOverlayIfExists('gamblingOverlay');
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

    removeOverlayIfExists('blackMarketOverlay');

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
    header.innerHTML = `${atlasIconHTML('StolenGoods', 18, '🕶️')} Black Market — ${city.name}`;
    Object.assign(header.style, { color: '#888', margin: '0 0 16px', textAlign: 'center' });
    popup.appendChild(header);
    const closeIconBtn = createModalCloseIcon(() => closeOverlayToPlaying(overlay));
    popup.appendChild(closeIconBtn);

    const goldInfo = document.createElement('div');
    goldInfo.innerHTML = `${cashIconHTML(14)} Your Gold: ${player.gold}g`;
    Object.assign(goldInfo.style, { color: '#d4af37', textAlign: 'center', fontSize: '14px', marginBottom: '16px' });
    popup.appendChild(goldInfo);

    // --- Buy Contraband ---
    const buyTitle = document.createElement('h4');
    buyTitle.innerHTML = atlasLabelHTML('StolenGoods', 'Buy Contraband', 16, '🛒');
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
      Object.assign(info.style, { color: '#fff', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start' });
      const iconEl = createItemIconEl(item.key, 20);
      iconEl.style.flexShrink = '0';
      info.appendChild(iconEl);
      const infoText = document.createElement('div');
      const displayName = libEntry ? libEntry.name : item.name;
      infoText.innerHTML = `<strong>${displayName}</strong><br><span style="color:#888;font-size:11px">Buy: ${item.buyPrice}g | Sell: ${item.sellPrice}g</span>`;
      info.appendChild(infoText);
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
        const bought = smugglingSystem.buyContraband(item.key);
        if (bought) sound?.playTradeBuy?.();
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
          const sold = smugglingSystem.sellContraband(item.key);
          if (sold) sound?.playTradeSell?.();
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
      eqHeader.innerHTML = atlasLabelHTML('Bag', 'Equipment', 16, '⚙️');
      Object.assign(eqHeader.style, { color: '#aaa', margin: '16px 0 8px', fontSize: '14px', borderTop: '1px solid #333', paddingTop: '12px' });
      popup.appendChild(eqHeader);

      for (const bk of availBags) {
        const bagItem = ItemLibrary[bk];
        const bagData = BAGS[bk];
        if (!bagItem || !bagData) continue;
        const price = Math.floor(bagItem.baseValue * 1.3);
        const brow = document.createElement('div');
        Object.assign(brow.style, {
          background: '#0d1a2a', padding: '10px', borderRadius: '6px',
          marginBottom: '6px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', borderLeft: '3px solid #2196f3',
        });
        popup.appendChild(brow);

        const info = document.createElement('div');
        Object.assign(info.style, { color: '#fff', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start' });
        const iconEl = createItemIconEl(bk, 20);
        iconEl.style.flexShrink = '0';
        info.appendChild(iconEl);
        const infoText = document.createElement('div');
        infoText.innerHTML = `<strong>${bagItem.name}</strong> <span style="color:#4fc3f7;font-size:11px">+${bagData.cargoBonus} cargo</span><br>`
          + `<span style="color:#888;font-size:11px">Buy: ${price}g &nbsp;|&nbsp; ${bagData.rarity}</span>`;
        info.appendChild(infoText);
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
            sound?.playTradeBuy?.();
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
    warn.innerHTML = `${atlasIconHTML('Hostile', 14, '⚠️')} Carrying contraband increases checkpoint inspection chance!`;
    Object.assign(warn.style, { color: '#f44336', fontSize: '11px', marginTop: '12px', textAlign: 'center' });
    popup.appendChild(warn);

    // Close button
    const closeBtn = createBackToCityButton(() => closeOverlayToPlaying(overlay), { marginTop: '12px' });
    popup.appendChild(closeBtn);
  },

  hide: () => {
    removeOverlayIfExists('blackMarketOverlay');
  },

  update: () => {}
});


// ═══════════════════════════════════════════════════════════
//  FOUND CITY HUD — Shows "Found City" button when standing
//  on an empty land tile with enough gold (adventure mode)
// ═══════════════════════════════════════════════════════════
uiManager.registerScreen("foundCityHUD", {
  validStates: [GameStates.PLAYING],

  create: () => {
    const bar = document.createElement('div');
    bar.id = 'foundCityHUD';
    Object.assign(bar.style, {
      position: 'fixed',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '800',
      background: 'rgba(20,16,28,0.92)',
      border: '1px solid rgba(202,163,80,0.5)',
      borderRadius: '10px',
      padding: '10px 20px',
      gap: '12px',
      alignItems: 'center',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    });
    bar.style.display = 'none'; // must be set AFTER Object.assign to avoid override

    const label = document.createElement('span');
    label.textContent = '🏗️ Found a new city here?';
    Object.assign(label.style, { color: '#caa350', fontSize: '13px', fontWeight: 'bold' });
    bar.appendChild(label);

    const costLabel = document.createElement('span');
    costLabel.id = 'foundCityCost';
    Object.assign(costLabel.style, { color: '#aaa', fontSize: '11px' });
    costLabel.textContent = '(5000g)';
    bar.appendChild(costLabel);

    const foundBtn = document.createElement('button');
    foundBtn.textContent = '🏠 Found City';
    foundBtn.id = 'foundCityBtn';
    Object.assign(foundBtn.style, {
      background: 'linear-gradient(135deg,#b8860b,#daa520)',
      color: '#fff', border: 'none', padding: '8px 18px',
      borderRadius: '6px', fontSize: '13px', fontWeight: 'bold',
      cursor: 'pointer',
    });
    foundBtn.onclick = () => {
      if (typeof foundPlayerCityAdventure !== 'function') return;
      const name = prompt('Name your new city:', `Settlement ${Math.floor(Math.random() * 1000)}`);
      if (name === null) return; // cancelled
      const res = foundPlayerCityAdventure(name || undefined);
      if (!res.ok) {
        const msgs = { no_gold: 'Not enough gold! Need 5000g.', water: "Can't found on water!", occupied: 'A city already exists here!', out_of_bounds: 'Invalid location!' };
        if (typeof notificationManager !== 'undefined')
          notificationManager.log(msgs[res.reason] || 'Failed to found city.', 'error');
      }
    };
    bar.appendChild(foundBtn);

    document.body.appendChild(bar);
    // Wrap in a p5 element for consistency
    return select('#foundCityHUD');
  },

  show: () => {
    // Don't force-show — let update() decide visibility based on conditions
    // This prevents the HUD from flashing when entering PLAYING state
  },

  hide: () => {
    const el = document.getElementById('foundCityHUD');
    if (el) el.style.display = 'none';
  },

  update: () => {
    const el = document.getElementById('foundCityHUD');
    if (!el) return;
    if (typeof player === 'undefined' || !player) { el.style.display = 'none'; return; }

    // Show only when: player is on an empty land tile, NOT in a city, has >= 5000 gold
    const inCity = !!player.currentCity;
    const hasGold = player.gold >= 5000;
    const gx = player.x, gy = player.y;
    const onMap = typeof grid !== 'undefined' && grid && grid[gy] && grid[gy][gx];
    const onWater = onMap && grid[gy][gx].options[0] === 'Water';
    const cityHere = typeof cityLocationMap !== 'undefined' && cityLocationMap.has(`${gx},${gy}`);

    const shouldShow = !inCity && hasGold && onMap && !onWater && !cityHere;
    el.style.display = shouldShow ? 'flex' : 'none';
  }
});
