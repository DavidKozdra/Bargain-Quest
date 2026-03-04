/**
 * MobileSupport.js — Touch input, pinch-zoom, and virtual HUD for mobile play.
 *
 * Exports on window:
 *   isMobile()          — true when running on a touch device with width < 1024
 *   mobileSupport       — singleton; call mobileSupport.init(canvasEl) in setup()
 */

'use strict';

/* ─── Detection ─────────────────────────────────────────────────────────── */

window.isMobile = function isMobile() {
  return ('ontouchstart' in window || navigator.maxTouchPoints > 0)
      && window.innerWidth < 1024;
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
    this._el = canvasEl;
    this._active = false;
    this._t1 = null;
    this._t2 = null;
    this._initialDist = 0;
    this._initialZoom = 1;
    this._midX = 0;
    this._midY = 0;

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

    const t1 = e.touches[0];
    const t2 = e.touches[1];
    this._initialDist = this._dist(t1, t2);
    this._initialZoom = typeof camZoom !== 'undefined' ? camZoom : 1;
    this._midX = (t1.clientX + t2.clientX) / 2;
    this._midY = (t1.clientY + t2.clientY) / 2;
    this._t1 = { x: t1.clientX, y: t1.clientY };
    this._t2 = { x: t2.clientX, y: t2.clientY };
  }

  _onMove(e) {
    if (!this._active || e.touches.length < 2) return;
    if (!this._gameIsNavigable()) return;

    e.preventDefault();

    const t1 = e.touches[0];
    const t2 = e.touches[1];

    // ── Pinch zoom ──────────────────────────────────────────────────────────
    const newDist = this._dist(t1, t2);
    if (this._initialDist > 0 && typeof camZoom !== 'undefined') {
      const raw = this._initialZoom * (newDist / this._initialDist);
      camZoom = Math.min(2, Math.max(0.15, raw));
      if (Math.abs(camZoom - 1) < 0.03) camZoom = 1;
    }

    // ── 2-finger pan ────────────────────────────────────────────────────────
    const newMidX = (t1.clientX + t2.clientX) / 2;
    const newMidY = (t1.clientY + t2.clientY) / 2;
    const dx = newMidX - this._midX;
    const dy = newMidY - this._midY;

    if (typeof camX !== 'undefined' && typeof camY !== 'undefined') {
      const z = typeof camZoom !== 'undefined' ? camZoom : 1;
      camX -= dx / z;
      camY -= dy / z;
    }

    this._midX = newMidX;
    this._midY = newMidY;
    this._t1 = { x: t1.clientX, y: t1.clientY };
    this._t2 = { x: t2.clientX, y: t2.clientY };
  }

  _onEnd(e) {
    if (e.touches.length < 2) {
      this._active = false;
      this._initialDist = 0;
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
      b.innerHTML = `<span class="hud-btn-inner"><span>${icon}</span><span class="hud-label">${label}</span></span>`;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); onClick(e); });
      hud.appendChild(b);
      return b;
    };

    // Minimap toggle
    btn('🗺', 'MAP', () => {
      if (typeof _getMinimapMode !== 'undefined') {
        const cur = _getMinimapMode();
        window._minimapMode = (cur === 'regional') ? 'world' : 'regional';
      }
    });

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
    this._speedLbl = document.createElement('span');
    this._speedLbl.className = 'hud-speed-display';
    this._speedLbl.textContent = '1×';
    speedB.innerHTML = '<span class="hud-btn-inner"><span>⏩</span></span>';
    speedB.querySelector('.hud-btn-inner').appendChild(this._speedLbl);
    speedB.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._cycleSpeed();
    });
    hud.appendChild(speedB);

    // Pause / resume
    btn('⏸', 'PAUSE', () => {
      if (typeof gameStateManager === 'undefined') return;
      if (gameStateManager.is(GameStates.PLAYING) || gameStateManager.is(GameStates.CITY_MANAGE)) {
        gameStateManager.setState(GameStates.PAUSED);
      } else if (gameStateManager.is(GameStates.PAUSED)) {
        gameStateManager.setState(GameStates.PLAYING);
      }
    });

    // Inventory toggle
    btn('🎒', 'BAG', () => {
      if (typeof gameStateManager === 'undefined') return;
      if (gameStateManager.is(GameStates.PLAYING)) {
        gameStateManager.setState(GameStates.INVENTORY);
      } else if (gameStateManager.is(GameStates.INVENTORY)) {
        gameStateManager.setState(GameStates.PLAYING);
      }
    });

    document.body.appendChild(hud);
    this._el = hud;
  }

  _cycleSpeed() {
    if (typeof SPEED_STEPS === 'undefined' || typeof gameSpeedIndex === 'undefined') return;
    window.gameSpeedIndex = (gameSpeedIndex + 1) % SPEED_STEPS.length;
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

    const shouldShow = isMobile()
      && (currentState === GameStates.PLAYING || currentState === GameStates.CITY_MANAGE
          || currentState === GameStates.INVENTORY || currentState === GameStates.PAUSED)
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

  /**
   * Call from p5.js setup() after createCanvas():
   *   mobileSupport.init(canvas.elt);
   */
  init(canvasEl) {
    if (!isMobile()) return;

    this.pinchZoom = new PinchZoomHandler(canvasEl);

    this.hud = new MobileHUD();
    this.hud.init();

    // remember canvas element for coordinate mapping
    this._canvasEl = canvasEl;

    // mark document for mobile-specific CSS rules
    try { document.body.classList.add('mobile'); } catch (e) {}

    // Prevent double-tap-to-zoom on the page (only when mobile support active)
    document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  },

  /** Call from draw() each frame. */
  update(currentState) {
    if (this.hud) this.hud.update(currentState);
  },
};

// Helper: map a DOM client coordinate into canvas pixel coordinates
// Uses the canvas boundingClientRect and the backing buffer ratio (elt.width/rect.width)
window.mobileSupport.mapClientToCanvas = function(clientX, clientY) {
  const el = window.mobileSupport._canvasEl || document.querySelector('canvas');
  if (!el) return { x: clientX, y: clientY };
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
    if (this._canvasEl) this._canvasEl = null;
    document.body.classList.remove('mobile');
  } catch (e) {}
};
