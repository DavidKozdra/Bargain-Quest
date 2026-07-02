// MAIN MENU (extracted from ui.js)
const BQ_MENU_LOGO_SRC = "./assets/images/bargain quest logo.gif";

function _refreshMenuLogoImages(forceReload = false) {
  if (typeof document === "undefined") return;
  const logos = document.querySelectorAll(".menu-logo");
  for (const imgEl of logos) {
    if (!imgEl) continue;
    const baseSrc = imgEl.dataset.menuLogoSrc || imgEl.getAttribute("src") || BQ_MENU_LOGO_SRC;
    if (!imgEl.dataset.menuLogoSrc) imgEl.dataset.menuLogoSrc = baseSrc;
    const shouldReload = forceReload || !imgEl.complete || !imgEl.naturalWidth;
    if (!shouldReload) continue;
    const bust = `${baseSrc}${baseSrc.includes("?") ? "&" : "?"}menuRefresh=${Date.now()}`;
    imgEl.setAttribute("src", bust);
  }
}

window.BQRefreshMenuLogoImages = _refreshMenuLogoImages;

// Direct references to the jukebox FAB + modal. They live on document.body
// (outside #mainMenu), so the screen container's show()/hide() never touch
// them — show()/hide() below must toggle them explicitly. Holding direct
// element refs (rather than re-querying by id every time) keeps them in sync
// even if the DOM id lookup goes stale during a render/state churn.
const _bqJukebox = { fab: null, modal: null };

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

    createImg(BQ_MENU_LOGO_SRC, "Game Logo")
      .class("menu-logo")
      .style("image-rendering", "pixelated")
      .attribute("data-menu-logo-src", BQ_MENU_LOGO_SRC)
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
        sound?.playUiClick?.();
        if (typeof loadExistingGame === 'function') {
          loadExistingGame();
        }
      });
    continueBtn.id("continueBtn");

    createButton("New Game")
      .parent(buttonsSection)
      .addClass("menu-btn")
      .mousePressed(async () => {
        sound?.playUiClick?.();
        await _ensureOptionalUIScreen("newGameConfig");
        gameStateManager.setState(GameStates.NEW_GAME_CONFIG);
      });

    createButton("Settings")
      .parent(buttonsSection)
      .addClass("menu-btn")
      .mousePressed(async () => {
        sound?.playUiClick?.();
        await _ensureOptionalUIScreen("settingsMenu");
        gameStateManager.setState(GameStates.SETTINGS);
      });

    createButton("Info")
      .parent(buttonsSection)
      .addClass("menu-btn")
      .mousePressed(async () => {
        sound?.playUiClick?.();
        await _ensureOptionalUIScreen("infoMenu");
        gameStateManager.setState(GameStates.INFO);
      });

    createButton("Custom Map Editor")
      .parent(buttonsSection)
      .addClass("menu-btn")
      .mousePressed(async () => {
        sound?.playUiClick?.();
        await _ensureOptionalUIScreen("levelEditorToolbar");
        if (typeof _ensureEditorEngineModules === 'function') {
          _ensureEditorEngineModules();
        }
        if (!levelEditor) levelEditor = new LevelEditor();
        levelEditor.centreCamera();
        gameStateManager.setState(GameStates.LEVEL_EDITOR);
      });

    createButton("Credits")
      .parent(buttonsSection)
      .addClass("menu-btn")
      .mousePressed(() => {
        sound?.playUiClick?.();
        gameStateManager.setState(GameStates.CREDITS);
      });
    
    // ── Jukebox ────────────────────────────────────────────────────────────────
    const _jbState  = { open: false, selectedId: null };
    const _jbDur    = new Map(); // trackId → formatted duration string
    const _jbTracks = typeof sound?.getTrackPlan === "function" ? sound.getTrackPlan() : [];
    let   _jbSearchEl = null;   // assigned after DOM creation below
    let   _jbVizCanvas = null;   // assigned during DOM creation below
    let   _jbAudioCtx  = null;
    let   _jbAnalyser  = null;
    let   _jbVizRafId  = null;
    let   _jbLastFocus = null;
    const _jbSrcNodes  = new WeakMap();

    // Format seconds → m:ss
    function _jbFmt(s) {
      if (!Number.isFinite(s) || s <= 0) return "--:--";
      return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
    }

    // SVG icons for transport controls
    const _SVG_CLOSE = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="1.5" y1="1.5" x2="10.5" y2="10.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="10.5" y1="1.5" x2="1.5" y2="10.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    const _SVG_PREV  = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="2.5" height="12" rx="1" fill="currentColor"/><path d="M14 3.5L6 8L14 12.5Z" fill="currentColor"/></svg>';
    const _SVG_PLAY  = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2.5L13 8L4 13.5Z" fill="currentColor"/></svg>';
    const _SVG_STOP  = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor"/></svg>';
    const _SVG_NEXT  = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L10 8L2 12.5Z" fill="currentColor"/><rect x="11.5" y="2" width="2.5" height="12" rx="1" fill="currentColor"/></svg>';

    // Stop every registered track directly + clear the MusicSystem's state.
    // sound.stopMusic() only stops musicSystem.current, missing anything played outside it.
    function _jbStopAll() {
      _jbTracks.forEach((t) => {
        const tr = typeof sound?.getTrack === "function" ? sound.getTrack(t.id) : null;
        if (tr?.isPlaying?.()) tr.stop?.();
      });
      sound?.stopMusic?.(); // clears musicSystem.current and cancels pendingMode
      _jbStopViz();
    }

    // Play a track directly, looped, at current music volume
    function _jbPlayTrack(id) {
      const vol = typeof sound?.getMusicVolume === "function" ? sound.getMusicVolume() : 0.5;
      _jbStopAll();
      const track = typeof sound?.getTrack === "function" ? sound.getTrack(id) : null;
      if (!track) {
        console.warn(`[Jukebox] Track not found: ${id}`);
        return;
      }
      track.setVolume?.(vol);
      track.setLoop?.(true);
      Promise.resolve(typeof track.load === "function" ? track.load() : null)
        .then(() => { track.play?.(); _jbLoadDur(id); _jbStartViz(id); })
        .catch((err) => {
          console.error(`[Jukebox] Failed to load/play track "${id}":`, err);
          _jbNowStatus.html("Error loading track");
        })
        .finally(() => _jbRefresh());
    }

    // Attempt to read / register the duration for a track
    function _jbLoadDur(id) {
      const track = typeof sound?.getTrack === "function" ? sound.getTrack(id) : null;
      const el    = typeof track?.getAudioElement === "function" ? track.getAudioElement() : null;
      if (!el) return;
      const apply = () => {
        if (Number.isFinite(el.duration) && el.duration > 0) {
          _jbDur.set(id, _jbFmt(el.duration));
          _jbRenderList();
        }
      };
      if (Number.isFinite(el.duration) && el.duration > 0) {
        _jbDur.set(id, _jbFmt(el.duration));
      } else {
        el.addEventListener("loadedmetadata", apply, { once: true });
      }
    }

    // Tracks visible after applying search filter
    function _jbVisible() {
      const q = (_jbSearchEl ? String(_jbSearchEl.value() || "").toLowerCase().trim() : "");
      if (!q) return _jbTracks;
      return _jbTracks.filter((t) =>
        (t.label || t.id).toLowerCase().includes(q) ||
        (t.artist || "").toLowerCase().includes(q)
      );
    }

    // Step through the visible list by ±1
    function _jukeBoxGoto(dir) {
      const visible = _jbVisible();
      if (visible.length === 0) return;
      const cur  = visible.findIndex((t) => t.id === _jbState.selectedId);
      const next = (cur + dir + visible.length) % visible.length;
      _jbState.selectedId = visible[next].id;
      _jbPlayTrack(_jbState.selectedId);
    }

    // ── Modal overlay (replaces inline panel) ────────────────────────────────
    const _jbOverlay = document.createElement("div");
    _jbOverlay.id = "jukeboxModal";
    _jbOverlay.setAttribute("role", "dialog");
    _jbOverlay.setAttribute("aria-modal", "true");
    _jbOverlay.setAttribute("aria-hidden", "true");
    Object.assign(_jbOverlay.style, {
      display: "none", position: "fixed", inset: "0",
      zIndex: "10050", background: "rgba(6,10,16,0.88)",
      alignItems: "center", justifyContent: "center",
    });
    document.body.appendChild(_jbOverlay);

    // ── Panel ─────────────────────────────────────────────────────────────────
    const _jbPanel = createDiv().class("menu-jukebox-panel");
    _jbPanel.parent(_jbOverlay);

    // Header
    const _jbHeader = createDiv().class("menu-jukebox-header");
    _jbHeader.parent(_jbPanel);
    const _jbTitle = createElement("h3", "Jukebox").class("menu-jukebox-title");
    _jbTitle.id("jukeboxTitle");
    _jbTitle.parent(_jbHeader);
    _jbOverlay.setAttribute("aria-labelledby", "jukeboxTitle");
    const _jbCloseBtn = createButton("").addClass("menu-btn menu-jukebox-close");
    _jbCloseBtn.html(_SVG_CLOSE);
    _jbCloseBtn.attribute("aria-label", "Close");
    _jbCloseBtn.parent(_jbHeader);
    _jbCloseBtn.elt.addEventListener("click", () => _jbSetOpen(false));

    // Now-playing card
    const _jbNow = createDiv().class("menu-jukebox-now");
    _jbNow.parent(_jbPanel);
    const _jbNowArt = createDiv().class("menu-jukebox-now-art");
    _jbNowArt.html(
      '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="32" cy="32" r="29" fill="rgba(30,18,8,0.7)" stroke="rgba(202,163,80,0.55)" stroke-width="1.5"/>' +
      '<circle cx="32" cy="32" r="16" fill="rgba(202,163,80,0.07)" stroke="rgba(202,163,80,0.22)" stroke-width="1"/>' +
      '<circle cx="32" cy="32" r="5" fill="rgba(202,163,80,0.75)"/>' +
      '</svg>'
    );
    _jbNowArt.parent(_jbNow);
    const _jbNowCopy   = createDiv().class("menu-jukebox-now-copy");
    _jbNowCopy.parent(_jbNow);
    const _jbNowTitle  = createElement("div", "Nothing playing").class("menu-jukebox-now-title");
    _jbNowTitle.parent(_jbNowCopy);
    const _jbNowArtist = createElement("div", "").class("menu-jukebox-now-meta");
    _jbNowArtist.parent(_jbNowCopy);
    const _jbNowStatus = createElement("div", "").class("menu-jukebox-now-status");
    _jbNowStatus.parent(_jbNowCopy);
    const _jbNowDur    = createElement("div", "").class("menu-jukebox-now-file");
    _jbNowDur.parent(_jbNowCopy);

    // ── Visualizer canvas ────────────────────────────────────────────────────
    _jbVizCanvas = document.createElement("canvas");
    _jbVizCanvas.className = "menu-jukebox-visualizer";
    _jbVizCanvas.height = 48;
    _jbPanel.elt.appendChild(_jbVizCanvas);

    function _jbEnsureAnalyser(audioEl) {
      if (!_jbAudioCtx) {
        _jbAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (!_jbAnalyser) {
        _jbAnalyser = _jbAudioCtx.createAnalyser();
        _jbAnalyser.fftSize = 64;
        _jbAnalyser.smoothingTimeConstant = 0.82;
        _jbAnalyser.connect(_jbAudioCtx.destination);
      }
      if (!_jbSrcNodes.has(audioEl)) {
        const src = _jbAudioCtx.createMediaElementSource(audioEl);
        src.connect(_jbAnalyser);
        _jbSrcNodes.set(audioEl, src);
      }
    }

    function _jbDrawViz() {
      const canvas = _jbVizCanvas;
      if (!canvas) { _jbVizRafId = requestAnimationFrame(_jbDrawViz); return; }
      const ctx = canvas.getContext("2d");
      const W   = canvas.offsetWidth;
      const H   = canvas.height;
      if (W > 0 && canvas.width !== W) canvas.width = W;
      ctx.clearRect(0, 0, canvas.width, H);

      if (_jbAnalyser && canvas.width > 0) {
        const bufLen   = _jbAnalyser.frequencyBinCount;
        const data     = new Uint8Array(bufLen);
        _jbAnalyser.getByteFrequencyData(data);
        const barCount = Math.min(bufLen, 32);
        const gap      = 2;
        const barW     = Math.max(1, (canvas.width - gap * (barCount - 1)) / barCount);
        for (let i = 0; i < barCount; i++) {
          const norm = data[i] / 255;
          const barH = Math.max(2, norm * H);
          const x    = i * (barW + gap);
          const y    = H - barH;
          ctx.fillStyle = `rgba(247,213,139,${(0.4 + norm * 0.6).toFixed(2)})`;
          ctx.fillRect(x, y, barW, barH);
        }
      }
      _jbVizRafId = requestAnimationFrame(_jbDrawViz);
    }

    function _jbStartViz(trackId) {
      const track   = typeof sound?.getTrack === "function" ? sound.getTrack(trackId) : null;
      const audioEl = typeof track?.getAudioElement === "function" ? track.getAudioElement() : null;
      if (audioEl) {
        try {
          _jbEnsureAnalyser(audioEl);
          if (_jbAudioCtx?.state === "suspended") _jbAudioCtx.resume();
        } catch (err) {
          console.warn("[Jukebox viz]", err);
        }
      }
      if (!_jbVizRafId) _jbDrawViz();
    }

    function _jbStopViz() {
      if (_jbVizRafId) { cancelAnimationFrame(_jbVizRafId); _jbVizRafId = null; }
      if (_jbVizCanvas) {
        const ctx = _jbVizCanvas.getContext("2d");
        ctx.clearRect(0, 0, _jbVizCanvas.width, _jbVizCanvas.height);
      }
    }

    // Transport controls: Prev | Play/Stop | Next
    const _jbControls = createDiv().class("menu-jukebox-controls");
    _jbControls.parent(_jbPanel);

    const _jbPrevBtn = createButton("")
      .addClass("menu-btn menu-jukebox-control-btn menu-jukebox-control-btn--secondary");
    _jbPrevBtn.html(`${_SVG_PREV}<span>Prev</span>`);
    _jbPrevBtn.attribute("aria-label", "Previous track");
    _jbPrevBtn.parent(_jbControls);
    _jbPrevBtn.mousePressed(() => _jukeBoxGoto(-1));

    const _jbPlayBtn = createButton("").addClass("menu-btn menu-jukebox-control-btn");
    _jbPlayBtn.html(`${_SVG_PLAY}<span>Play</span>`);
    _jbPlayBtn.attribute("aria-label", "Play");
    _jbPlayBtn.parent(_jbControls);
    _jbPlayBtn.attribute("disabled", true);
    _jbPlayBtn.mousePressed(() => {
      if (!_jbState.selectedId) return;
      const tr = sound?.getTrack?.(_jbState.selectedId);
      if (tr?.isPlaying?.()) {
        _jbStopAll();
        _jbRefresh();
      } else {
        _jbPlayTrack(_jbState.selectedId);
      }
    });

    const _jbNextBtn = createButton("")
      .addClass("menu-btn menu-jukebox-control-btn menu-jukebox-control-btn--secondary");
    _jbNextBtn.html(`${_SVG_NEXT}<span>Next</span>`);
    _jbNextBtn.attribute("aria-label", "Next track");
    _jbNextBtn.parent(_jbControls);
    _jbNextBtn.mousePressed(() => _jukeBoxGoto(1));

    // Volume row
    const _jbVolRow = createDiv().class("menu-jukebox-volume");
    _jbVolRow.parent(_jbPanel);
    createElement("span", "Vol").class("menu-jukebox-volume-label").parent(_jbVolRow);
    const _initVol    = typeof sound?.getMusicVolume === "function" ? sound.getMusicVolume() : 0.5;
    const _jbVolSlider = createSlider(0, 1, _initVol, 0.01).addClass("menu-jukebox-volume-slider");
    _jbVolSlider.attribute("aria-label", "Music volume");
    _jbVolSlider.parent(_jbVolRow);
    const _jbVolValue = createElement("span", Math.round(_initVol * 100) + "%").class("menu-jukebox-volume-value");
    _jbVolValue.parent(_jbVolRow);
    _jbVolSlider.input(() => {
      const v = _jbVolSlider.value();
      _jbVolValue.html(Math.round(v * 100) + "%");
      sound?.setMusicVolume?.(v);
    });

    // Search input
    const _jbSearchRow = createDiv().class("menu-jukebox-search-row").style("margin-top", "14px");
    _jbSearchRow.parent(_jbPanel);
    _jbSearchEl = createInput("", "text").addClass("menu-jukebox-search");
    _jbSearchEl.attribute("placeholder", "Search tracks…");
    _jbSearchEl.attribute("aria-label", "Search tracks");
    _jbSearchEl.parent(_jbSearchRow);
    _jbSearchEl.input(() => _jbRenderList());

    // Track list header + scrollable container
    createElement("div", "Tracks").class("menu-jukebox-list-title").parent(_jbPanel);
    const _jbResultsCount = createElement("div", "").class("menu-jukebox-list-results");
    _jbResultsCount.parent(_jbPanel);
    const _jbTrackList = createDiv().class("menu-jukebox-track-list");
    _jbTrackList.attribute("role", "listbox");
    _jbTrackList.attribute("aria-label", "Jukebox tracks");
    _jbTrackList.parent(_jbPanel);

    // Render (or re-render) the filtered track list
    function _jbRenderList() {
      _jbTrackList.elt.innerHTML = "";
      const visible = _jbVisible();
      _jbResultsCount.html(`${visible.length} track${visible.length === 1 ? "" : "s"}`);
      if (visible.length === 0) {
        createElement("div", "No tracks found.").class("menu-jukebox-empty").parent(_jbTrackList);
        return;
      }
      visible.forEach((t) => {
        const btn = createButton("").addClass("menu-btn menu-jukebox-track-btn");
        btn.parent(_jbTrackList);
        btn.attribute("data-jb-track-id", t.id);
        btn.attribute("role", "option");
        btn.attribute("aria-selected", t.id === _jbState.selectedId ? "true" : "false");
        btn.elt.classList.toggle("is-selected", t.id === _jbState.selectedId);
        const tr = typeof sound?.getTrack === "function" ? sound.getTrack(t.id) : null;
        btn.elt.classList.toggle("is-playing", !!tr?.isPlaying?.());

        createElement("span", t.label || t.id).class("menu-jukebox-track-name").parent(btn);

        const footer = createDiv().class("menu-jukebox-track-footer");
        footer.parent(btn);
        createElement("span", t.artist || "—").class("menu-jukebox-track-meta").parent(footer);
        createElement("span", _jbDur.get(t.id) || "--:--").class("menu-jukebox-track-duration").parent(footer);

        btn.mousePressed(() => {
          _jbState.selectedId = t.id;
          _jbPlayTrack(t.id);
        });
      });
    }

    // Refresh the now-playing card, play button label, and launch subtitle
    function _jbRefresh() {
      const playingDef = _jbTracks.find((t) => {
        const tr = typeof sound?.getTrack === "function" ? sound.getTrack(t.id) : null;
        return !!tr?.isPlaying?.();
      }) || null;

      const displayDef = playingDef ||
        (_jbState.selectedId ? _jbTracks.find((t) => t.id === _jbState.selectedId) : null);

      if (displayDef) {
        _jbNowTitle.html(displayDef.label || displayDef.id);
        _jbNowArtist.html(displayDef.artist || "Unknown Artist");
        _jbNowStatus.html(playingDef ? "Now Playing" : "Selected");
        _jbNowDur.html(_jbDur.get(displayDef.id) || "--:--");
      } else {
        _jbNowTitle.html("Nothing playing");
        _jbNowArtist.html("");
        _jbNowStatus.html("");
        _jbNowDur.html("");
      }

      // Play button: toggle label and disabled state
      const selPlaying = _jbState.selectedId
        ? !!sound?.getTrack?.(_jbState.selectedId)?.isPlaying?.()
        : false;
      _jbPlayBtn.html(selPlaying ? `${_SVG_STOP}<span>Stop</span>` : `${_SVG_PLAY}<span>Play</span>`);
      if (_jbState.selectedId) _jbPlayBtn.removeAttribute("disabled");
      else                     _jbPlayBtn.attribute("disabled", true);

      // Launch button subtitle
      if (typeof _jbLaunchSub !== "undefined") {
        _jbLaunchSub.html(playingDef ? (playingDef.label || playingDef.id) : "No track playing");
      }

      _jbRenderList();
    }

    // Start reading durations when the panel is first opened
    function _jbPrefetchDurations() {
      _jbTracks.forEach((t) => _jbLoadDur(t.id));
    }

    // ── Launch button (fixed FAB, parented to body outside #mainMenu) ─────────
    const _jbLaunch = createDiv()
      .class("menu-jukebox-launch")
      .id("jukeboxFab")
      .attribute("tabindex", "0")
      .attribute("role", "button")
      .attribute("aria-expanded", "false")
      .attribute("aria-controls", "jukeboxModal")
      .attribute("aria-label", "Open jukebox");
    // p5 appends to body by default; hide until mainMenu.show()
    _jbLaunch.elt.style.display = "none";

    // Expose the FAB + modal to the screen's show()/hide() (defined outside this
    // closure) so they always toggle the real elements, not a stale id lookup.
    _bqJukebox.fab = _jbLaunch.elt;
    _bqJukebox.modal = _jbOverlay;

    const _jbLaunchArt = createDiv().class("menu-jukebox-launch-art");
    _jbLaunchArt.html(
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">'
      + '<path d="M3 9v6h4l5 5V4L7 9H3z" fill="rgba(202,163,80,0.95)"/>'
      + '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" fill="rgba(202,163,80,0.85)"/>'
      + '<path d="M19 12c0-3.04-1.73-5.64-4.25-6.97v2.04C16.38 8.17 17.5 9.97 17.5 12s-1.12 3.83-2.75 4.93v2.04C17.27 17.64 19 15.04 19 12z" fill="rgba(202,163,80,0.52)"/>'
      + '</svg>'
    );
    _jbLaunchArt.parent(_jbLaunch);

    const _jbLaunchCopy = createDiv().class("menu-jukebox-launch-copy");
    _jbLaunchCopy.parent(_jbLaunch);
    createElement("strong", "Jukebox").parent(_jbLaunchCopy);
    const _jbLaunchSub = createElement("span", "No track playing");
    _jbLaunchSub.parent(_jbLaunchCopy);

    function _jbSetOpen(open) {
      _jbState.open = !!open;
      _jbOverlay.style.display = _jbState.open ? "flex" : "none";
      _jbOverlay.setAttribute("aria-hidden", _jbState.open ? "false" : "true");
      _jbLaunch.attribute("aria-expanded", _jbState.open ? "true" : "false");
      _jbLaunch.attribute("aria-label", _jbState.open ? "Close jukebox" : "Open jukebox");

      if (_jbState.open) {
        _jbLastFocus = document.activeElement;
        _jbPrefetchDurations();
        _jbRenderList();
        _jbRefresh();
        const _openPlayingDef = _jbTracks.find((t) => {
          const tr = typeof sound?.getTrack === "function" ? sound.getTrack(t.id) : null;
          return !!tr?.isPlaying?.();
        });
        if (_openPlayingDef) _jbStartViz(_openPlayingDef.id);
        _jbSearchEl?.elt?.focus?.();
      } else {
        _jbStopViz();
        if (_jbLastFocus && typeof _jbLastFocus.focus === "function") {
          _jbLastFocus.focus();
        } else {
          _jbLaunch?.elt?.focus?.();
        }
      }
    }

    _jbOverlay.addEventListener("click", (e) => {
      if (e.target === _jbOverlay) _jbSetOpen(false);
    });

    _jbOverlay.addEventListener("keydown", (e) => {
      if (!_jbState.open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        _jbSetOpen(false);
        return;
      }

      if (e.key === "Tab") {
        const focusables = _jbOverlay.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    _jbLaunch.mousePressed(() => {
      sound?.playUiClick?.();
      _jbSetOpen(!_jbState.open);
    });

    _jbLaunch.elt.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      sound?.playUiClick?.();
      _jbSetOpen(!_jbState.open);
    });

    _jbRenderList();
    _jbRefresh();
    // ── End Jukebox ───────────────────────────────────────────────────────────

    // Footer
    const footer = createP("");
    footer.class("menu-footer");
    footer.parent(parent);
    createSpan("v1.2").parent(footer);
    createSpan("  •  ").parent(footer);
    createA("https://github.com/DavidKozdra/Bargain-Quest", "GitHub", "_blank")
      .attribute("rel", "noopener noreferrer")
      .parent(footer);
      
    return parent;
  },

  show: () => {
    if (typeof queueMenuPresentationWarmup === "function") queueMenuPresentationWarmup("mainMenu.show");
    _refreshMenuLogoImages(false);
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
    const jbFab = _bqJukebox.fab || document.getElementById("jukeboxFab");
    if (jbFab) jbFab.style.display = "";
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
    const jbFab = _bqJukebox.fab || document.getElementById("jukeboxFab");
    if (jbFab) {
      jbFab.style.display = "none";
      jbFab.setAttribute("aria-expanded", "false");
      jbFab.setAttribute("aria-label", "Open jukebox");
    }
    const jbModal = _bqJukebox.modal || document.getElementById("jukeboxModal");
    if (jbModal) {
      jbModal.style.display = "none";
      jbModal.setAttribute("aria-hidden", "true");
    }
  }
});
