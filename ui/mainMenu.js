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

    // Format seconds → m:ss
    function _jbFmt(s) {
      if (!Number.isFinite(s) || s <= 0) return "--:--";
      return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
    }

    // Stop every registered track directly + clear the MusicSystem's state.
    // sound.stopMusic() only stops musicSystem.current, missing anything played outside it.
    function _jbStopAll() {
      _jbTracks.forEach((t) => {
        const tr = typeof sound?.getTrack === "function" ? sound.getTrack(t.id) : null;
        if (tr?.isPlaying?.()) tr.stop?.();
      });
      sound?.stopMusic?.(); // clears musicSystem.current and cancels pendingMode
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
        .then(() => { track.play?.(); _jbLoadDur(id); })
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
    Object.assign(_jbOverlay.style, {
      display: "none", position: "fixed", inset: "0",
      zIndex: "10050", background: "rgba(6,10,16,0.88)",
      alignItems: "center", justifyContent: "center",
    });
    _jbOverlay.addEventListener("click", (e) => {
      if (e.target === _jbOverlay) { _jbState.open = false; _jbOverlay.style.display = "none"; }
    });
    document.body.appendChild(_jbOverlay);

    // ── Panel ─────────────────────────────────────────────────────────────────
    const _jbPanel = createDiv().class("menu-jukebox-panel");
    _jbPanel.parent(_jbOverlay);

    // Header
    const _jbHeader = createDiv().class("menu-jukebox-header");
    _jbHeader.parent(_jbPanel);
    createElement("h3", "Jukebox").class("menu-jukebox-title").parent(_jbHeader);
    const _jbCloseBtn = createButton("✕").addClass("menu-btn menu-jukebox-close");
    _jbCloseBtn.parent(_jbHeader);
    _jbCloseBtn.mousePressed(() => {
      _jbState.open = false;
      _jbOverlay.style.display = "none";
    });

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

    // Transport controls: ⏮ Prev | ▶/■ Play | ⏭ Next
    const _jbControls = createDiv().class("menu-jukebox-controls");
    _jbControls.parent(_jbPanel);

    const _jbPrevBtn = createButton("⏮ Prev")
      .addClass("menu-btn menu-jukebox-control-btn menu-jukebox-control-btn--secondary");
    _jbPrevBtn.parent(_jbControls);
    _jbPrevBtn.mousePressed(() => _jukeBoxGoto(-1));

    const _jbPlayBtn = createButton("▶ Play").addClass("menu-btn menu-jukebox-control-btn");
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

    const _jbNextBtn = createButton("Next ⏭")
      .addClass("menu-btn menu-jukebox-control-btn menu-jukebox-control-btn--secondary");
    _jbNextBtn.parent(_jbControls);
    _jbNextBtn.mousePressed(() => _jukeBoxGoto(1));

    // Volume row
    const _jbVolRow = createDiv().class("menu-jukebox-volume");
    _jbVolRow.parent(_jbPanel);
    createElement("span", "Vol").class("menu-jukebox-volume-label").parent(_jbVolRow);
    const _initVol    = typeof sound?.getMusicVolume === "function" ? sound.getMusicVolume() : 0.5;
    const _jbVolSlider = createSlider(0, 1, _initVol, 0.01).addClass("menu-jukebox-volume-slider");
    _jbVolSlider.parent(_jbVolRow);
    const _jbVolValue = createElement("span", Math.round(_initVol * 100) + "%").class("menu-jukebox-volume-value");
    _jbVolValue.parent(_jbVolRow);
    _jbVolSlider.input(() => {
      const v = _jbVolSlider.value();
      _jbVolValue.html(Math.round(v * 100) + "%");
      sound?.setMusicVolume?.(v);
    });

    // Search input
    const _jbSearchRow = createDiv().style("margin-top", "14px");
    _jbSearchRow.parent(_jbPanel);
    _jbSearchEl = createInput("", "text").addClass("menu-jukebox-search");
    _jbSearchEl.attribute("placeholder", "Search tracks…");
    _jbSearchEl.parent(_jbSearchRow);
    _jbSearchEl.input(() => _jbRenderList());

    // Track list header + scrollable container
    createElement("div", "Tracks").class("menu-jukebox-list-title").parent(_jbPanel);
    const _jbTrackList = createDiv().class("menu-jukebox-track-list");
    _jbTrackList.parent(_jbPanel);

    // Render (or re-render) the filtered track list
    function _jbRenderList() {
      _jbTrackList.elt.innerHTML = "";
      const visible = _jbVisible();
      if (visible.length === 0) {
        createElement("div", "No tracks found.").class("menu-jukebox-empty").parent(_jbTrackList);
        return;
      }
      visible.forEach((t) => {
        const btn = createButton("").addClass("menu-btn menu-jukebox-track-btn");
        btn.parent(_jbTrackList);
        btn.attribute("data-jb-track-id", t.id);
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
        _jbNowArtist.html(displayDef.artist || "—");
        _jbNowStatus.html(playingDef ? "Now Playing" : "Stopped");
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
      _jbPlayBtn.html(selPlaying ? "■ Stop" : "▶ Play");
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
      .attribute("role", "button");
    // p5 appends to body by default; hide until mainMenu.show()
    _jbLaunch.elt.style.display = "none";

    const _jbLaunchArt = createDiv().class("menu-jukebox-launch-art");
    _jbLaunchArt.html(
      '<svg viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="19" cy="19" r="17" fill="rgba(30,18,8,0.7)" stroke="rgba(202,163,80,0.55)" stroke-width="1.5"/>' +
      '<circle cx="19" cy="19" r="9" fill="rgba(202,163,80,0.07)" stroke="rgba(202,163,80,0.22)" stroke-width="1"/>' +
      '<circle cx="19" cy="19" r="3.5" fill="rgba(202,163,80,0.75)"/>' +
      '</svg>'
    );
    _jbLaunchArt.parent(_jbLaunch);

    const _jbLaunchCopy = createDiv().class("menu-jukebox-launch-copy");
    _jbLaunchCopy.parent(_jbLaunch);
    createElement("strong", "Jukebox").parent(_jbLaunchCopy);
    const _jbLaunchSub = createElement("span", "No track playing");
    _jbLaunchSub.parent(_jbLaunchCopy);

    _jbLaunch.mousePressed(() => {
      sound?.playUiClick?.();
      _jbState.open = !_jbState.open;
      if (_jbState.open) {
        _jbOverlay.style.display = "flex";
        _jbPrefetchDurations();
        _jbRenderList();
        _jbRefresh();
      } else {
        _jbOverlay.style.display = "none";
      }
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
    const jbFab = document.getElementById("jukeboxFab");
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
    const jbFab = document.getElementById("jukeboxFab");
    if (jbFab) jbFab.style.display = "none";
    const jbModal = document.getElementById("jukeboxModal");
    if (jbModal) jbModal.style.display = "none";
  }
});
