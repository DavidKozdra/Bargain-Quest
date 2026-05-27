/**
 * MobileSupport.js — Touch input, pinch-zoom, and virtual HUD for mobile play.
 *
 * Exports on window:
 *   isMobile()          — true when running on a mobile/touch-first device
 *   mobileSupport       — singleton; call mobileSupport.init(canvasEl) in setup()
 */

'use strict';

function _bqMobileInputLib() {
  return window.KozEngine?.UI?.mobileInput || null;
}

/* ─── Detection ─────────────────────────────────────────────────────────── */

const MOBILE_VIEWPORT_MAX_WIDTH = 1024;

function _bqMatchMedia(query) {
  try {
    return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia(query).matches);
  } catch (_e) {
    return false;
  }
}

function _bqMinPositive(...values) {
  let out = 0;
  for (const value of values) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) continue;
    if (!out || num < out) out = num;
  }
  return out;
}

window.getMobileContext = function getMobileContext() {
  const width = (typeof window !== 'undefined' && Number.isFinite(window.innerWidth))
    ? window.innerWidth
    : 0;
  const visualViewportWidth = (typeof window !== 'undefined' && window.visualViewport && Number.isFinite(window.visualViewport.width))
    ? window.visualViewport.width
    : 0;
  const screenWidth = (typeof screen !== 'undefined' && Number.isFinite(screen.width))
    ? screen.width
    : 0;
  const screenHeight = (typeof screen !== 'undefined' && Number.isFinite(screen.height))
    ? screen.height
    : 0;
  const hasTouch = (typeof window !== 'undefined') && ('ontouchstart' in window);
  const maxTouchPoints = (typeof navigator !== 'undefined') ? (navigator.maxTouchPoints || 0) : 0;
  const coarsePointer = _bqMatchMedia('(pointer: coarse)');
  const anyCoarsePointer = _bqMatchMedia('(any-pointer: coarse)');
  const hoverNone = _bqMatchMedia('(hover: none)');
  const anyHoverNone = _bqMatchMedia('(any-hover: none)');
  const userAgentMobile = (typeof navigator !== 'undefined' && navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean')
    ? navigator.userAgentData.mobile
    : null;
  const userAgent = (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string')
    ? navigator.userAgent
    : '';
  const platform = (typeof navigator !== 'undefined' && typeof navigator.platform === 'string')
    ? navigator.platform
    : '';
  const touchCapable = !!(hasTouch || maxTouchPoints > 0);
  const viewportWidth = _bqMinPositive(width, visualViewportWidth);
  const shortestScreenSide = _bqMinPositive(screenWidth, screenHeight);
  const compactViewport = viewportWidth > 0 && viewportWidth <= MOBILE_VIEWPORT_MAX_WIDTH;
  const compactScreen = shortestScreenSide > 0 && shortestScreenSide <= MOBILE_VIEWPORT_MAX_WIDTH;
  const looksLikeMobileUa = userAgentMobile === true
    || (platform === 'MacIntel' && maxTouchPoints > 1)
    || /\b(android|iphone|ipod|ipad|mobile|windows phone|blackberry|bb10|opera mini|iemobile|silk|kindle|playbook|tablet)\b/i.test(userAgent);

  const lib = _bqMobileInputLib();
  const touchMobile = (lib && typeof lib.isTouchMobile === 'function')
    ? lib.isTouchMobile({
        hasTouch,
        maxTouchPoints,
        width,
        visualViewportWidth,
        screenWidth,
        screenHeight,
        maxWidth: MOBILE_VIEWPORT_MAX_WIDTH,
        coarsePointer,
        anyCoarsePointer,
        hoverNone,
        anyHoverNone,
        userAgentDataMobile: userAgentMobile,
        userAgent,
        platform,
      })
    : ((looksLikeMobileUa && (compactViewport || compactScreen || touchCapable))
        || (touchCapable && compactViewport)
        || (compactScreen && (coarsePointer || anyCoarsePointer || hoverNone || anyHoverNone)));

  return {
    width,
    visualViewportWidth,
    screenWidth,
    screenHeight,
    maxWidth: MOBILE_VIEWPORT_MAX_WIDTH,
    hasTouch,
    maxTouchPoints,
    coarsePointer,
    anyCoarsePointer,
    hoverNone,
    anyHoverNone,
    userAgentMobile,
    userAgent,
    platform,
    touchCapable,
    mobile: !!touchMobile,
  };
};

window.isMobile = function isMobile() {
  return window.getMobileContext().mobile;
};

/* ─── PinchZoomHandler ───────────────────────────────────────────────────── */
/**
 * Attaches raw touch listeners to the canvas DOM element.
 * - 2-finger pinch  → scales camZoom
 * - 2-finger drag   → pans camera (both fingers moving same direction)
 * Single-finger events are left for p5.js to translate into mouse events.
 */
class PinchZoomHandler {
  constructor(canvasEl) {
    if (!canvasEl || typeof canvasEl.addEventListener !== 'function') {
      throw new Error('PinchZoomHandler: canvasEl is undefined or invalid. Make sure to call mobileSupport.init(canvas.elt) after createCanvas().');
    }
    this._el = canvasEl;
    this._active = false;
    this._gesture = null;

    this._onStart = this._onStart.bind(this);
    this._onMove  = this._onMove.bind(this);
    this._onEnd   = this._onEnd.bind(this);

    canvasEl.addEventListener('touchstart', this._onStart, { passive: false });
    canvasEl.addEventListener('touchmove',  this._onMove,  { passive: false });
    canvasEl.addEventListener('touchend',   this._onEnd,   { passive: false });
    canvasEl.addEventListener('touchcancel',this._onEnd,   { passive: false });
  }

  _gameIsNavigable() {
    if (typeof gameStateManager === 'undefined') return false;
    return gameStateManager.is(GameStates.PLAYING)
        || gameStateManager.is(GameStates.CITY_MANAGE);
  }

  _onStart(e) {
    if (e.touches.length < 2) return;
    if (!this._gameIsNavigable()) return;

    e.preventDefault();
    this._active = true;
    const lib = _bqMobileInputLib();
    this._gesture = (lib && typeof lib.beginPinchGesture === 'function')
      ? lib.beginPinchGesture({
          touches: Array.from(e.touches),
          currentZoom: (typeof camZoom !== 'undefined') ? camZoom : 1,
        })
      : null;
  }

  _onMove(e) {
    if (!this._active || e.touches.length < 2) return;
    if (!this._gameIsNavigable()) return;

    e.preventDefault();

    const lib = _bqMobileInputLib();
    if (lib && typeof lib.updatePinchGesture === 'function') {
      const next = lib.updatePinchGesture(this._gesture, {
        touches: Array.from(e.touches),
        currentZoom: (typeof camZoom !== 'undefined') ? camZoom : 1,
        camX: (typeof camX !== 'undefined') ? camX : 0,
        camY: (typeof camY !== 'undefined') ? camY : 0,
        zoomOptions: { min: 0.15, max: 2, snap: 1, snapEpsilon: 0.03 },
      });
      if (!next || next.active === false) {
        this._active = false;
        this._gesture = null;
        return;
      }
      this._gesture = next;
      if (typeof camZoom !== 'undefined' && typeof next.zoom === 'number') camZoom = next.zoom;
      if (typeof camX !== 'undefined' && typeof next.camX === 'number') camX = next.camX;
      if (typeof camY !== 'undefined' && typeof next.camY === 'number') camY = next.camY;
      return;
    }

    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const newDist = this._dist(t1, t2);
    if (this._gesture && this._gesture.initialDist > 0 && typeof camZoom !== 'undefined') {
      const raw = this._gesture.initialZoom * (newDist / this._gesture.initialDist);
      camZoom = Math.min(2, Math.max(0.15, raw));
      if (Math.abs(camZoom - 1) < 0.03) camZoom = 1;
    }
    const newMidX = (t1.clientX + t2.clientX) / 2;
    const newMidY = (t1.clientY + t2.clientY) / 2;
    const dx = newMidX - (this._gesture?.midX || newMidX);
    const dy = newMidY - (this._gesture?.midY || newMidY);
    if (typeof camX !== 'undefined' && typeof camY !== 'undefined') {
      const z = typeof camZoom !== 'undefined' ? camZoom : 1;
      camX -= dx / z;
      camY -= dy / z;
    }
    this._gesture = {
      active: true,
      initialDist: this._gesture?.initialDist || newDist,
      initialZoom: this._gesture?.initialZoom || ((typeof camZoom !== 'undefined') ? camZoom : 1),
      midX: newMidX,
      midY: newMidY,
    };
  }

  _onEnd(e) {
    if (e.touches.length < 2) {
      this._active = false;
      this._gesture = null;
    }
  }

  _dist(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  destroy() {
    this._el.removeEventListener('touchstart',  this._onStart);
    this._el.removeEventListener('touchmove',   this._onMove);
    this._el.removeEventListener('touchend',    this._onEnd);
    this._el.removeEventListener('touchcancel', this._onEnd);
  }
}

/* ─── MobileHUD ──────────────────────────────────────────────────────────── */
/**
 * A fixed bottom strip of buttons for core keyboard actions on mobile.
 * Rendered as a DOM element over the canvas.
 */
class MobileHUD {
  constructor() {
    this._el = null;
    this._speedLbl = null;
    this._mapBtn = null;
    this._mapIcon = null;
    this._mapLabel = null;
    this._pauseBtn = null;
    this._pauseIcon = null;
    this._pauseLabel = null;
    this._visible = false;
  }

  init() {
    if (this._el) return;

    const hud = document.createElement('div');
    hud.id = 'mobile-hud';
    hud.style.display = 'none';

    // Helper to build a button
    const btn = (icon, label, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<span class="hud-btn-inner"><span>${icon}</span><span class="hud-label">${label}</span></span>`;
      b.addEventListener('click', onClick);
      hud.appendChild(b);
      return b;
    };

    // Minimap toggle
    const mapBtn = btn('🗺', 'MAP', () => {
      if (typeof window.toggleMinimapVisibility === 'function') {
        window.toggleMinimapVisibility();
        return;
      }
      if (typeof _getMinimapMode !== 'undefined') {
        const cur = _getMinimapMode();
        window._minimapMode = (cur === 'regional') ? 'world' : 'regional';
      }
    });
    const mapWrap = mapBtn.querySelector('.hud-btn-inner');
    this._mapBtn = mapBtn;
    this._mapIcon = mapWrap ? mapWrap.children[0] : null;
    this._mapLabel = mapWrap ? mapWrap.children[1] : null;

    // Zoom out
    btn('🔍−', 'ZOOM−', () => {
      if (typeof camZoom !== 'undefined') {
        camZoom = Math.max(0.15, camZoom - 0.2);
      }
    });

    // Zoom in
    btn('🔍+', 'ZOOM+', () => {
      if (typeof camZoom !== 'undefined') {
        camZoom = Math.min(2, camZoom + 0.2);
        if (Math.abs(camZoom - 1) < 0.03) camZoom = 1;
      }
    });

    // Speed cycle — shows current multiplier
    const speedB = document.createElement('button');
    speedB.type = 'button';
    this._speedLbl = document.createElement('span');
    this._speedLbl.className = 'hud-speed-display';
    this._speedLbl.textContent = '1×';
    speedB.innerHTML = '<span class="hud-btn-inner"><span>⏩</span></span>';
    speedB.querySelector('.hud-btn-inner').appendChild(this._speedLbl);
    speedB.addEventListener('click', () => this._cycleSpeed());
    hud.appendChild(speedB);

    // Pause / resume
    const pauseBtn = btn('⏸', 'PAUSE', () => {
      if (typeof gameStateManager === 'undefined') return;
      const surfaceState = (typeof window !== 'undefined' && typeof window.BQGetSurfaceGameplayState === 'function')
        ? window.BQGetSurfaceGameplayState()
        : GameStates.PLAYING;
      if (gameStateManager.is(GameStates.PAUSED)) {
        gameStateManager.setState(window._pauseReturnState || gameStateManager.prev || surfaceState);
      } else if (gameStateManager.is(GameStates.PLAYING) || gameStateManager.is(GameStates.PLANET_SURFACE) || gameStateManager.is(GameStates.CITY_MANAGE)) {
        window._pauseReturnState = gameStateManager.currentState;
        gameStateManager.setState(GameStates.PAUSED);
      }
    });
    const pauseWrap = pauseBtn.querySelector('.hud-btn-inner');
    this._pauseBtn = pauseBtn;
    this._pauseIcon = pauseWrap ? pauseWrap.children[0] : null;
    this._pauseLabel = pauseWrap ? pauseWrap.children[1] : null;

    // Inventory toggle
    btn('🎒', 'BAG', () => {
      if (typeof gameStateManager === 'undefined') return;
      const surfaceState = (typeof window !== 'undefined' && typeof window.BQGetSurfaceGameplayState === 'function')
        ? window.BQGetSurfaceGameplayState()
        : GameStates.PLAYING;
      if (gameStateManager.is(GameStates.PLAYING) || gameStateManager.is(GameStates.PLANET_SURFACE)) {
        gameStateManager.setState(GameStates.INVENTORY);
      } else if (gameStateManager.is(GameStates.INVENTORY)) {
        gameStateManager.setState(surfaceState);
      }
    });

    document.body.appendChild(hud);
    this._el = hud;
  }

  _syncPauseButton(currentState) {
    if (!this._pauseBtn) return;
    const paused = currentState === GameStates.PAUSED;
    if (this._pauseIcon) this._pauseIcon.textContent = paused ? '▶' : '⏸';
    if (this._pauseLabel) this._pauseLabel.textContent = paused ? 'RESUME' : 'PAUSE';
    this._pauseBtn.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
    this._pauseBtn.setAttribute('title', paused ? 'Resume game' : 'Pause game');
  }

  _syncMapButton() {
    if (!this._mapBtn) return;
    const minimapVisible = (typeof window.isMinimapVisible === 'function')
      ? window.isMinimapVisible()
      : true;
    if (this._mapIcon) this._mapIcon.textContent = minimapVisible ? '✕' : '🗺';
    if (this._mapLabel) this._mapLabel.textContent = minimapVisible ? 'HIDE' : 'MAP';
    this._mapBtn.setAttribute('aria-label', minimapVisible ? 'Hide minimap' : 'Show minimap');
    this._mapBtn.setAttribute('title', minimapVisible ? 'Hide minimap' : 'Show minimap');
  }

  _cycleSpeed() {
    if (typeof SPEED_STEPS === 'undefined' || typeof gameSpeedIndex === 'undefined') return;
    const lib = _bqMobileInputLib();
    if (lib && typeof lib.cycleIndex === 'function') {
      window.gameSpeedIndex = lib.cycleIndex(gameSpeedIndex, SPEED_STEPS.length);
    } else {
      window.gameSpeedIndex = (gameSpeedIndex + 1) % SPEED_STEPS.length;
    }
    window.gameSpeed = SPEED_STEPS[window.gameSpeedIndex];
    if (typeof syncSpeedDisplay === 'function') syncSpeedDisplay();
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Speed: ${window.gameSpeed}×`, 'info');
    }
    if (this._speedLbl) this._speedLbl.textContent = `${window.gameSpeed}×`;
  }

  /** Call once per frame to show/hide and keep speed label in sync. */
  update(currentState) {
    if (!this._el) return;
    this._syncMapButton();
    this._syncPauseButton(currentState);

    const isEditorPauseContext = currentState === GameStates.PAUSED
      && window._pauseReturnState === GameStates.LEVEL_EDITOR;
    const isCityViewOpen = !!(typeof document !== 'undefined'
      && document.body
      && document.body.classList.contains('city-view-open'));

    const shouldShow = isMobile()
      && (currentState === GameStates.PLAYING || currentState === GameStates.PLANET_SURFACE
          || currentState === GameStates.CITY_MANAGE
          || currentState === GameStates.INVENTORY || currentState === GameStates.PAUSED)
      && !isEditorPauseContext
      && !isCityViewOpen
      && (typeof minigameManager === 'undefined' || !minigameManager.active);

    if (shouldShow !== this._visible) {
      this._el.style.display = shouldShow ? 'flex' : 'none';
      this._visible = shouldShow;
    }

    // Keep speed label in sync with keyboard changes
    if (this._speedLbl && typeof gameSpeed !== 'undefined') {
      const txt = `${gameSpeed}×`;
      if (this._speedLbl.textContent !== txt) this._speedLbl.textContent = txt;
    }
  }

  destroy() {
    if (this._el) this._el.remove();
    this._el = null;
  }
}

/* ─── Singleton ──────────────────────────────────────────────────────────── */

window.mobileSupport = {
  pinchZoom: null,
  hud: null,
  _canvasEl: null,
  _dblClickBound: false,
  _onDblClickPrevent: null,

  /**
   * Call from p5.js setup() after createCanvas():
   *   mobileSupport.init(canvas.elt);
   */
  init(canvasEl) {
    if (canvasEl) this._canvasEl = canvasEl;
    this.refresh(this._canvasEl || document.querySelector('canvas'));
  },

  refresh(canvasEl) {
    if (canvasEl) this._canvasEl = canvasEl;
    const activeCanvas = this._canvasEl || document.querySelector('canvas');
    const mobile = isMobile();

    try { document.body.classList.toggle('mobile', mobile); } catch (_e) {}

    if (mobile) {
      if (!this.pinchZoom && activeCanvas) this.pinchZoom = new PinchZoomHandler(activeCanvas);
      if (!this.hud) {
        this.hud = new MobileHUD();
        this.hud.init();
      }
      if (!this._dblClickBound) {
        this._onDblClickPrevent = (e) => e.preventDefault();
        document.addEventListener('dblclick', this._onDblClickPrevent, { passive: false });
        this._dblClickBound = true;
      }
      return;
    }

    if (this.pinchZoom) { this.pinchZoom.destroy(); this.pinchZoom = null; }
    if (this.hud) { this.hud.destroy(); this.hud = null; }
    if (this._dblClickBound && this._onDblClickPrevent) {
      document.removeEventListener('dblclick', this._onDblClickPrevent);
      this._dblClickBound = false;
      this._onDblClickPrevent = null;
    }
  },

  /** Call from draw() each frame. */
  update(currentState) {
    this.refresh();
    if (this.hud) this.hud.update(currentState);
  },
};

// Helper: map a DOM client coordinate into canvas pixel coordinates
// Uses the canvas boundingClientRect and the backing buffer ratio (elt.width/rect.width)
window.mobileSupport.mapClientToCanvas = function(clientX, clientY) {
  const el = window.mobileSupport._canvasEl || document.querySelector('canvas');
  if (!el) return { x: clientX, y: clientY };
  const lib = _bqMobileInputLib();
  if (lib && typeof lib.mapClientToCanvas === 'function') {
    return lib.mapClientToCanvas({
      clientX,
      clientY,
      rect: el.getBoundingClientRect(),
      bufferWidth: el.width,
      bufferHeight: el.height,
    });
  }
  const rect = el.getBoundingClientRect();
  const cssX = clientX - rect.left;
  const cssY = clientY - rect.top;
  const ratioX = (el.width && rect.width) ? (el.width / rect.width) : 1;
  const ratioY = (el.height && rect.height) ? (el.height / rect.height) : ratioX;
  return { x: Math.round(cssX * ratioX), y: Math.round(cssY * ratioY) };
};

// Destroy mobile hooks and cleanup
window.mobileSupport.destroy = function() {
  try {
    if (this.pinchZoom) { this.pinchZoom.destroy(); this.pinchZoom = null; }
    if (this.hud) { this.hud.destroy(); this.hud = null; }
    if (this._dblClickBound && this._onDblClickPrevent) {
      document.removeEventListener('dblclick', this._onDblClickPrevent);
      this._dblClickBound = false;
      this._onDblClickPrevent = null;
    }
    if (this._canvasEl) this._canvasEl = null;
    document.body.classList.remove('mobile');
  } catch (e) {}
};
