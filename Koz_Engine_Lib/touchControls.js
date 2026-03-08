/*******************************************************
 * touchControls.js — Mobile Touch Input System
 * Provides: virtual joystick, action buttons, touch aim
 * Only activates on touch-capable devices.
 *******************************************************/

// ─── Device Detection ───────────────────────────────
var isMobileDevice = false;

function detectMobile() {
  // Primary check: CSS media query (most reliable across all devices)
  const coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  // Fallback: touch API check
  const hasTouch = (
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0) ||
    (navigator.msMaxTouchPoints > 0)
  );
  // A device is "mobile" if it has a coarse pointer (finger),
  // OR has touch AND a small screen (filters out touch-enabled laptops)
  isMobileDevice = coarsePointer || (hasTouch && window.innerWidth <= 1366);
  console.log('[Mobile] detected:', isMobileDevice, '| coarse:', coarsePointer, '| touch:', hasTouch, '| width:', window.innerWidth);
  return isMobileDevice;
}

// Run on load
detectMobile();

// Re-detect on orientation change and resize (handles rotation, split-screen, etc.)
window.addEventListener('orientationchange', function() {
  setTimeout(function() {
    const wasMobile = isMobileDevice;
    detectMobile();
    if (isMobileDevice && !wasMobile && typeof createTouchControlsUI === 'function') {
      createTouchControlsUI();
    }
  }, 300); // Delay to let viewport settle
});
window.addEventListener('resize', (function() {
  let resizeTimer;
  return function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      const wasMobile = isMobileDevice;
      detectMobile();
      if (isMobileDevice && !wasMobile && typeof createTouchControlsUI === 'function') {
        createTouchControlsUI();
      }
    }, 500);
  };
})());

// ─── Global Touch State ─────────────────────────────
var touchJoystick = {
  active: false,
  identifier: -1,
  origin: { x: 0, y: 0 },   // center of joystick
  current: { x: 0, y: 0 },   // current thumb position
  vector: { x: 0, y: 0 },    // normalized direction (-1 to 1)
  radius: 60,                 // max joystick radius
  deadzone: 0.15
};

var touchAim = {
  active: false,
  identifier: -1,
  x: 0,
  y: 0,
  startX: 0,
  startY: 0,
  isTap: false,
  tapThreshold: 15,
  tapTime: 0,
  tapMaxDuration: 250  // ms
};

// Track which action button is being pressed
var touchActions = {
  dig: false,
  fill: false,        // right-click equivalent
  interact: false,
  inventory: false,
  crafting: false,
  build: false,
  pause: false,
  dash: false,
  hotbarLeft: false,
  hotbarRight: false
};

// ─── Touch Controls DOM ─────────────────────────────
var _touchControlsRoot = null;
var _joystickContainer = null;
var _joystickBase = null;
var _joystickThumb = null;
var _actionButtons = {};

function createTouchControlsUI() {
  if (_touchControlsRoot) return; // already created
  // Re-detect in case the initial check at script parse time was wrong
  if (!isMobileDevice) detectMobile();
  if (!isMobileDevice) {
    // Schedule a final fallback check after layout is fully complete
    requestAnimationFrame(function() {
      detectMobile();
      if (isMobileDevice && !_touchControlsRoot) {
        console.log('[Mobile] Late detection triggered — creating touch controls');
        createTouchControlsUI();
      }
    });
    return;
  }

  // ── CSS ──
  const style = document.createElement('style');
  style.id = 'touch-controls-styles';
  style.textContent = `
    /* ─── Visible Joystick ─── */
    #touch-joystick-area {
      position: fixed;
      left: 16px;
      bottom: 56px;
      width: 120px;
      height: 120px;
      z-index: 9990;
      touch-action: none;
      pointer-events: auto;
    }

    #touch-joystick-base {
      position: absolute;
      left: 0; top: 0;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.07);
      border: 3px solid rgba(255, 255, 255, 0.2);
      box-sizing: border-box;
      pointer-events: none;
    }

    #touch-joystick-thumb {
      position: absolute;
      left: 50%; top: 50%;
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,0.55), rgba(255,255,255,0.15));
      border: 2px solid rgba(255, 255, 255, 0.4);
      transform: translate(-50%, -50%);
      pointer-events: none;
      transition: background 0.1s;
    }

    #touch-joystick-thumb.active {
      background: radial-gradient(circle, rgba(255,255,255,0.75), rgba(255,255,255,0.3));
      border-color: rgba(255, 255, 255, 0.7);
    }

    /* ─── USE Button (single action button) ─── */
    #touch-use-btn {
      position: fixed;
      right: 16px;
      bottom: 140px;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: 3px solid rgba(255, 200, 80, 0.5);
      background: rgba(90, 60, 20, 0.5);
      color: white;
      font-family: 'Press Start 2P', monospace;
      font-size: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      touch-action: none;
      pointer-events: auto;
      user-select: none;
      -webkit-user-select: none;
      z-index: 9990;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
      transition: transform 0.1s;
    }

    #touch-use-btn:active, #touch-use-btn.pressed {
      transform: scale(0.88);
      background: rgba(160, 120, 40, 0.5);
      border-color: rgba(255, 200, 80, 0.8);
    }

    /* ─── DASH Button ─── */
    #touch-dash-btn {
      position: fixed;
      right: 90px;
      bottom: 110px;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      border: 3px solid rgba(80, 200, 255, 0.5);
      background: rgba(20, 60, 90, 0.5);
      color: white;
      font-family: 'Press Start 2P', monospace;
      font-size: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      touch-action: none;
      pointer-events: auto;
      user-select: none;
      -webkit-user-select: none;
      z-index: 9990;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
      transition: transform 0.1s;
    }

    #touch-dash-btn:active, #touch-dash-btn.pressed {
      transform: scale(0.88);
      background: rgba(40, 120, 160, 0.5);
      border-color: rgba(80, 200, 255, 0.8);
    }

    /* ─── Right-side Menu Toggle + Dropdown ─── */
    #touch-menu-toggle {
      position: fixed;
      top: 32px;
      right: 8px;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      background: rgba(0, 0, 0, 0.6);
      color: white;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      touch-action: none;
      pointer-events: auto;
      user-select: none;
      -webkit-user-select: none;
      z-index: 9992;
      transition: transform 0.1s;
    }

    #touch-menu-toggle:active {
      transform: scale(0.88);
      background: rgba(255, 255, 255, 0.2);
    }

    #touch-menu-dropdown {
      position: fixed;
      top: 72px;
      right: 8px;
      z-index: 9991;
      display: none;
      flex-direction: column;
      gap: 6px;
      pointer-events: none;
    }

    #touch-menu-dropdown.menu-open {
      display: flex;
    }

    .touch-top-btn {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      border: 2px solid rgba(255, 255, 255, 0.25);
      background: rgba(0, 0, 0, 0.7);
      color: white;
      font-family: 'Press Start 2P', monospace;
      font-size: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      touch-action: none;
      pointer-events: auto;
      user-select: none;
      -webkit-user-select: none;
      line-height: 1.2;
      transition: transform 0.1s;
    }

    .touch-top-btn:active, .touch-top-btn.pressed {
      transform: scale(0.88);
      background: rgba(255, 255, 255, 0.2);
    }

    /* ─── Aim/dig area — covers game canvas except joystick corner ─── */
    #touch-aim-area {
      position: fixed;
      left: 0;
      top: 0;
      width: 100vw;
      height: 100vh;
      z-index: 9985;
      touch-action: none;
      pointer-events: auto;
    }

    /* ─── Hotbar swipe arrows — vertical, left of item arc ─── */
    #touch-hotbar-arrows {
      position: fixed;
      bottom: 70px;
      right: 155px;
      z-index: 10001;
      display: flex;
      flex-direction: column;
      gap: 6px;
      pointer-events: none;
    }

    .touch-hotbar-arrow {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      background: rgba(0, 0, 0, 0.5);
      color: white;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      touch-action: none;
      pointer-events: auto;
      user-select: none;
      -webkit-user-select: none;
    }

    .touch-hotbar-arrow:active {
      transform: scale(0.88);
      background: rgba(255, 255, 255, 0.2);
    }

    /* Tablet: hotbar arrows nudged left of item arc */
    @media (min-width: 768px) {
      #touch-hotbar-arrows {
        right: 175px;
      }
    }

    /* Hide keyboard-only hints on mobile */
    .mobile-hidden {
      display: none !important;
    }
  `;
  document.head.appendChild(style);

  // ── Root Container ──
  _touchControlsRoot = document.createElement('div');
  _touchControlsRoot.id = 'touch-controls-root';

  // ── Joystick Area (left side, always visible) ──
  _joystickContainer = document.createElement('div');
  _joystickContainer.id = 'touch-joystick-area';

  _joystickBase = document.createElement('div');
  _joystickBase.id = 'touch-joystick-base';

  _joystickThumb = document.createElement('div');
  _joystickThumb.id = 'touch-joystick-thumb';

  _joystickContainer.appendChild(_joystickBase);
  _joystickContainer.appendChild(_joystickThumb);

  // ── Aim Area (right side, for drag-to-aim digging) ──
  const aimArea = document.createElement('div');
  aimArea.id = 'touch-aim-area';

  // ── Single USE button (uses held item or interacts) ──
  const useBtn = document.createElement('div');
  useBtn.id = 'touch-use-btn';
  useBtn.textContent = 'USE';
  useBtn.dataset.action = 'use';
  _actionButtons.use = useBtn;

  // ── DASH button ──
  const dashBtn = document.createElement('div');
  dashBtn.id = 'touch-dash-btn';
  dashBtn.textContent = 'DASH';
  dashBtn.dataset.action = 'dash';
  _actionButtons.dash = dashBtn;

  // ── Menu Toggle (hamburger) ──
  const menuToggle = document.createElement('div');
  menuToggle.id = 'touch-menu-toggle';
  menuToggle.textContent = '☰';
  menuToggle.addEventListener('pointerdown', function(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('touch-menu-dropdown');
    if (dropdown) dropdown.classList.toggle('menu-open');
  });

  // ── Dropdown menu (INV, CRFT, BLD, PAUSE) ──
  const dropdown = document.createElement('div');
  dropdown.id = 'touch-menu-dropdown';

  _actionButtons.inventory = _createButton('INV', 'touch-top-btn', 'inventory');
  _actionButtons.crafting = _createButton('CRFT', 'touch-top-btn', 'crafting');
  _actionButtons.build = _createButton('BLD', 'touch-top-btn', 'build');
  _actionButtons.team = _createButton('TEAM', 'touch-top-btn', 'team');
  _actionButtons.pause = _createButton('', 'touch-top-btn', 'pause');
  _actionButtons.pause.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" style="width:24px;height:24px;min-width:24px;min-height:24px;display:block"><rect x="5" y="3" width="5" height="18" rx="1.5"/><rect x="14" y="3" width="5" height="18" rx="1.5"/></svg>';

  dropdown.appendChild(_actionButtons.inventory);
  dropdown.appendChild(_actionButtons.crafting);
  dropdown.appendChild(_actionButtons.build);
  dropdown.appendChild(_actionButtons.team);
  dropdown.appendChild(_actionButtons.pause);

  // ── Hotbar Arrows ──
  const hotbarArrows = document.createElement('div');
  hotbarArrows.id = 'touch-hotbar-arrows';

  _actionButtons.hotbarLeft = _createButton('▲', 'touch-hotbar-arrow', 'hotbarLeft');
  _actionButtons.hotbarRight = _createButton('▼', 'touch-hotbar-arrow', 'hotbarRight');

  hotbarArrows.appendChild(_actionButtons.hotbarLeft);
  hotbarArrows.appendChild(_actionButtons.hotbarRight);

  // ── Assemble ──
  _touchControlsRoot.appendChild(_joystickContainer);
  _touchControlsRoot.appendChild(aimArea);
  _touchControlsRoot.appendChild(useBtn);
  _touchControlsRoot.appendChild(dashBtn);
  _touchControlsRoot.appendChild(menuToggle);
  _touchControlsRoot.appendChild(dropdown);
  _touchControlsRoot.appendChild(hotbarArrows);
  document.body.appendChild(_touchControlsRoot);

  // ── Attach Event Listeners ──
  _attachJoystickListeners();
  _attachAimListeners(aimArea);
  _attachButtonListeners();
}

function _createRow() {
  const row = document.createElement('div');
  row.className = 'touch-btn-row';
  return row;
}

function _createButton(label, className, action) {
  const btn = document.createElement('div');
  btn.className = className;
  btn.textContent = label;
  btn.dataset.action = action;
  return btn;
}

// ─── Joystick Listeners ─────────────────────────────
function _attachJoystickListeners() {
  var joyRect; // cached bounding rect
  var joyRadius = 60; // half of 120px base
  var thumbRadius = 45; // max travel distance for thumb
  var deadzone = 0.15;

  function _getCenterOfJoystick() {
    joyRect = _joystickContainer.getBoundingClientRect();
    return { x: joyRect.left + joyRect.width / 2, y: joyRect.top + joyRect.height / 2 };
  }

  _joystickContainer.addEventListener('touchstart', function(e) {
    e.preventDefault();
    if (touchJoystick.active) return;
    var t = e.changedTouches[0];
    var center = _getCenterOfJoystick();
    touchJoystick.active = true;
    touchJoystick.identifier = t.identifier;
    touchJoystick.origin.x = center.x;
    touchJoystick.origin.y = center.y;
    _updateJoystick(t.clientX, t.clientY);
    _joystickThumb.classList.add('active');
  }, { passive: false });

  _joystickContainer.addEventListener('touchmove', function(e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier === touchJoystick.identifier) {
        _updateJoystick(t.clientX, t.clientY);
        break;
      }
    }
  }, { passive: false });

  var _endJoystick = function(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchJoystick.identifier) {
        touchJoystick.active = false;
        touchJoystick.identifier = -1;
        touchJoystick.vector.x = 0;
        touchJoystick.vector.y = 0;
        // Snap thumb back to center
        _joystickThumb.style.left = '50%';
        _joystickThumb.style.top = '50%';
        _joystickThumb.classList.remove('active');
        break;
      }
    }
  };

  _joystickContainer.addEventListener('touchend', _endJoystick, { passive: false });
  _joystickContainer.addEventListener('touchcancel', _endJoystick, { passive: false });

  function _updateJoystick(cx, cy) {
    var dx = cx - touchJoystick.origin.x;
    var dy = cy - touchJoystick.origin.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    // Clamp to radius
    if (dist > thumbRadius) {
      dx = (dx / dist) * thumbRadius;
      dy = (dy / dist) * thumbRadius;
      dist = thumbRadius;
    }

    // Normalize to -1..1
    var nx = dx / thumbRadius;
    var ny = dy / thumbRadius;
    var mag = Math.sqrt(nx * nx + ny * ny);

    if (mag < deadzone) {
      touchJoystick.vector.x = 0;
      touchJoystick.vector.y = 0;
    } else {
      touchJoystick.vector.x = nx;
      touchJoystick.vector.y = ny;
    }

    // Move thumb visual relative to center of base
    _joystickThumb.style.left = 'calc(50% + ' + dx + 'px)';
    _joystickThumb.style.top = 'calc(50% + ' + dy + 'px)';
  }
}

// ─── Aim Area Listeners — touch = dig/use at that position ───
function _attachAimListeners(aimArea) {
  aimArea.addEventListener('touchstart', function(e) {
    e.preventDefault();
    if (touchAim.active) return;
    const t = e.changedTouches[0];
    touchAim.active = true;
    touchAim.identifier = t.identifier;
    touchAim.startX = t.clientX;
    touchAim.startY = t.clientY;
    touchAim.x = t.clientX;
    touchAim.y = t.clientY;
    touchAim.tapTime = performance.now();
    touchAim.isTap = true;
    // Immediately start digging at touch position
    touchActions.dig = true;
    // Sync p5 mouse position
    if (typeof mouseX !== 'undefined') {
      mouseX = t.clientX;
      mouseY = t.clientY;
    }
  }, { passive: false });

  aimArea.addEventListener('touchmove', function(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === touchAim.identifier) {
        touchAim.x = t.clientX;
        touchAim.y = t.clientY;
        // Keep p5.js mouseX/mouseY in sync for ghost-build, portal hover, etc.
        if (typeof mouseX !== 'undefined') {
          mouseX = t.clientX;
          mouseY = t.clientY;
        }
        // Check if moved beyond tap threshold
        const dx = touchAim.x - touchAim.startX;
        const dy = touchAim.y - touchAim.startY;
        if (Math.sqrt(dx * dx + dy * dy) > touchAim.tapThreshold) {
          touchAim.isTap = false;
        }
        break;
      }
    }
  }, { passive: false });

  const endAim = function(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchAim.identifier) {
        // Stop digging
        touchActions.dig = false;
        const elapsed = performance.now() - touchAim.tapTime;
        if (touchAim.isTap && elapsed < touchAim.tapMaxDuration) {
          // Short tap = interact with object at that point
          _handleAimTap(touchAim.x, touchAim.y);
        }
        touchAim.active = false;
        touchAim.identifier = -1;
        break;
      }
    }
  };

  aimArea.addEventListener('touchend', endAim, { passive: false });
  aimArea.addEventListener('touchcancel', endAim, { passive: false });
}

function _handleAimTap(screenX, screenY) {
  // Synthesize a real p5.js mouse click so ALL mouse-dependent game code
  // (teleport portals, interactions, chat-blur, etc.) works on mobile.
  // p5.js exposes mouseX, mouseY, mouseButton, mouseIsPressed as globals.
  if (typeof mouseX !== 'undefined') {
    mouseX = screenX;
    mouseY = screenY;
    mouseButton = LEFT;
    mouseIsPressed = true;
    // Fire the p5 mouseReleased handler (handles teleport, chat, etc.)
    if (typeof mouseReleased === 'function') mouseReleased();
    mouseIsPressed = false;
  }

  // Also run the proximity-based interact check for objects near the tap
  if (typeof camera === 'undefined' || typeof curPlayer === 'undefined' || !curPlayer) return;
  if (gameState !== 'playing') return;

  const worldX = screenX + camera.pos.x - (width / 2);
  const worldY = screenY + camera.pos.y - (height / 2);

  if (typeof testMap !== 'undefined') {
    const chunkPos = testMap.globalToChunk(worldX, worldY);
    const chunk = getChunkFromPos(testMap.chunks, chunkPos);
    if (!chunk) return;

    let closest = null;
    let closestDist = Infinity;

    for (let i = 0; i < chunk.objects.length; i++) {
      const obj = chunk.objects[i];
      const isInteractable = obj.type === 'InvObj' || obj.objName === 'Door' ||
        (obj.type === 'Plant' &&
          obj.stage === (objImgs[obj.imgNum].length - 1));

      if (isInteractable) {
        const dist = createVector(worldX, worldY).dist(obj.pos);
        const maxDist = obj.objName === 'ItemBag' ? 3 * TILESIZE : 4 * TILESIZE;
        if (dist < maxDist && dist < closestDist) {
          closest = obj;
          closestDist = dist;
        }
      }
    }

    if (closest) {
      const clickRange = closest.objName === 'ItemBag' ? 1.5 * TILESIZE : 2 * TILESIZE;
      if (closestDist < clickRange) {
        if (closest.type === 'InvObj') closest.useInv();
        else if (closest.type === 'Plant') closest.usePlant();
        else if (closest.objName === 'Door') closest.useDoor();
      }
    }
  }
}

// ─── Action Button Listeners ────────────────────────
function _attachButtonListeners() {
  // USE button — uses held item (left-click equivalent) or interacts
  const useBtn = _actionButtons.use;
  if (useBtn) {
    useBtn.addEventListener('touchstart', function(e) {
      e.preventDefault();
      touchActions.dig = true; // left-click equivalent
      useBtn.classList.add('pressed');
    }, { passive: false });

    useBtn.addEventListener('touchend', function(e) {
      e.preventDefault();
      touchActions.dig = false;
      useBtn.classList.remove('pressed');
      // Also try interact on release (for doors, items, etc.)
      _simulateInteract();
    }, { passive: false });

    useBtn.addEventListener('touchcancel', function(e) {
      touchActions.dig = false;
      useBtn.classList.remove('pressed');
    }, { passive: false });
  }

  // One-shot actions (inventory, crafting, build, team, pause)
  const oneShotActions = ['inventory', 'crafting', 'build', 'team', 'pause'];
  oneShotActions.forEach(function(action) {
    const btn = _actionButtons[action];
    if (!btn) return;

    btn.addEventListener('touchstart', function(e) {
      e.preventDefault();
      btn.classList.add('pressed');
    }, { passive: false });

    btn.addEventListener('touchend', function(e) {
      e.preventDefault();
      btn.classList.remove('pressed');
      _handleOneShotAction(action);
      // Close menu dropdown after action
      const dd = document.getElementById('touch-menu-dropdown');
      if (dd) dd.classList.remove('menu-open');
    }, { passive: false });

    btn.addEventListener('touchcancel', function(e) {
      btn.classList.remove('pressed');
    }, { passive: false });
  });

  // Dash button (one-shot)
  if (_actionButtons.dash) {
    const dashBtnEl = _actionButtons.dash;
    dashBtnEl.addEventListener('touchstart', function(e) {
      e.preventDefault();
      dashBtnEl.classList.add('pressed');
    }, { passive: false });

    dashBtnEl.addEventListener('touchend', function(e) {
      e.preventDefault();
      dashBtnEl.classList.remove('pressed');
      _handleOneShotAction('dash');
    }, { passive: false });

    dashBtnEl.addEventListener('touchcancel', function(e) {
      dashBtnEl.classList.remove('pressed');
    }, { passive: false });
  }

  // Hotbar arrows (one-shot with repeat ability)
  ['hotbarLeft', 'hotbarRight'].forEach(function(action) {
    const btn = _actionButtons[action];
    if (!btn) return;

    btn.addEventListener('touchstart', function(e) {
      e.preventDefault();
      btn.classList.add('pressed');
      _handleHotbarScroll(action === 'hotbarLeft' ? -1 : 1);
    }, { passive: false });

    btn.addEventListener('touchend', function(e) {
      e.preventDefault();
      btn.classList.remove('pressed');
    }, { passive: false });

    btn.addEventListener('touchcancel', function(e) {
      btn.classList.remove('pressed');
    }, { passive: false });
  });
}

function _handleOneShotAction(action) {
  if (typeof curPlayer === 'undefined' || !curPlayer) return;

  switch (action) {
    case 'interact':
      if (gameState === 'playing') {
        // Trigger the interact key release code path
        _simulateInteract();
      }
      break;

    case 'inventory':
      if (gameState === 'playing') {
        gameState = 'inventory';
        curPlayer.invBlock.curItem = '';
        if (typeof updateItemList === 'function') updateItemList();
        if (typeof updatecurItemDiv === 'function') updatecurItemDiv();
        if (typeof invDiv !== 'undefined') invDiv.show();
        curPlayer.holding = { w: false, a: false, s: false, d: false };
      } else if (gameState === 'inventory') {
        gameState = 'playing';
        if (typeof invDiv !== 'undefined') invDiv.hide();
        if (typeof spaceBarDiv !== 'undefined') spaceBarDiv.hide();
        const heldItemName = curPlayer.invBlock.hotbar[curPlayer.invBlock.selectedHotBar];
        const heldItem = heldItemName ? curPlayer.invBlock.items[heldItemName] : null;
        if (heldItem && heldItem.type === 'Seed') {
          ghostBuild = createObject(heldItem.plantName, 0, 0, 0, curPlayer.color, ' ', ' ');
          renderGhost = true;
        }
      } else if (gameState === 'swap_inv') {
        if (typeof closeSwapInv === 'function') closeSwapInv();
      } else if (gameState === 'crafting') {
        // Switch from crafting to inventory
        gameState = 'inventory';
        if (typeof invDiv !== 'undefined') invDiv.show();
        curPlayer.invBlock.curItem = '';
        if (typeof updateItemList === 'function') updateItemList();
        if (typeof craftDiv !== 'undefined') craftDiv.hide();
      }
      break;

    case 'crafting':
      if (gameState === 'playing') {
        gameState = 'crafting';
        // Exit build mode when opening crafting
        buildMode = false;
        renderGhost = false;
        if (typeof buildDiv !== 'undefined' && buildDiv) buildDiv.hide();
        curPlayer.invBlock.curItem = '';
        if (typeof updateCraftList === 'function') updateCraftList();
        if (typeof updatecurCraftItemDiv === 'function') updatecurCraftItemDiv();
        if (typeof craftDiv !== 'undefined') craftDiv.show();
        curPlayer.holding = { w: false, a: false, s: false, d: false };
      } else if (gameState === 'crafting') {
        gameState = 'playing';
        if (typeof craftDiv !== 'undefined') craftDiv.hide();
      } else if (gameState === 'inventory') {
        gameState = 'crafting';
        if (typeof craftDiv !== 'undefined') craftDiv.show();
        curPlayer.invBlock.curItem = '';
        if (typeof updateCraftList === 'function') updateCraftList();
        if (typeof invDiv !== 'undefined') invDiv.hide();
        if (typeof spaceBarDiv !== 'undefined') spaceBarDiv.hide();
      }
      break;

    case 'build':
      if (gameState !== 'playing') return;
      const slot = curPlayer.invBlock.selectedHotBar;
      const option = typeof buildOptions !== 'undefined' ? buildOptions[slot] : null;
      if (!option) return;
      ghostBuild = createObject(option.objName, 0, 0, 0, 0, curPlayer.id, curPlayer.name);
      buildMode = !buildMode;
      renderGhost = buildMode;
      if (buildMode) {
        if (typeof buildDiv !== 'undefined' && buildDiv) buildDiv.show();
        if (typeof renderBuildOptions === 'function') renderBuildOptions();
      } else {
        if (typeof buildDiv !== 'undefined' && buildDiv) buildDiv.hide();
        if (curPlayer.invBlock.selectedHotBar > 4) {
          curPlayer.invBlock.selectedHotBar = 4;
        }
      }
      break;

    case 'pause':
      if (gameState === 'playing') {
        gameState = 'pause';
        // Exit build mode when pausing
        buildMode = false;
        renderGhost = false;
        if (typeof buildDiv !== 'undefined' && buildDiv) buildDiv.hide();
        if (typeof pauseDiv !== 'undefined') {
          pauseDiv.show();
          pauseDiv.style('display', 'flex');
        }
      } else if (gameState === 'pause') {
        gameState = 'playing';
        if (typeof pauseDiv !== 'undefined') pauseDiv.hide();
      }
      // Close menu dropdown after action
      const dd1 = document.getElementById('touch-menu-dropdown');
      if (dd1) dd1.classList.remove('menu-open');
      break;

    case 'team':
      if (gameState !== 'playing' || !curPlayer) return;
      gameState = 'team_select';
      if (typeof teamPickDiv !== 'undefined' && teamPickDiv) {
        if (typeof updateTeamManagementUI === 'function') updateTeamManagementUI();
        teamPickDiv.show();
      }
      // Close menu dropdown
      const dd2 = document.getElementById('touch-menu-dropdown');
      if (dd2) dd2.classList.remove('menu-open');
      break;

    case 'dash':
      if (gameState !== 'playing' || !curPlayer) return;
      const dashAbility = (window.magicAbilities || []).find(a => a.name.toLowerCase() === 'dash');
      if (dashAbility && typeof dashAbility.activate === 'function') {
        dashAbility.activate(curPlayer);
      }
      break;
  }
}

function _simulateInteract() {
  if (!curPlayer || gameState !== 'playing') return;

  // Use player position for interaction (auto-interact with nearest object)
  const searchPos = curPlayer.pos.copy();
  const chunkPos = testMap.globalToChunk(searchPos.x, searchPos.y);
  const chunk = getChunkFromPos(testMap.chunks, chunkPos);
  if (!chunk) return;

  let closest = null;
  let closestDist = Infinity;

  for (let i = 0; i < chunk.objects.length; i++) {
    const obj = chunk.objects[i];
    const isInteractable = obj.type === 'InvObj' || obj.objName === 'Door' ||
      (obj.type === 'Plant' &&
        obj.stage === (objImgs[obj.imgNum].length - 1));

    if (isInteractable) {
      const maxDist = obj.objName === 'ItemBag' ? 3 * TILESIZE : 4 * TILESIZE;
      const dist = curPlayer.pos.dist(obj.pos);
      if (dist < maxDist && dist < closestDist) {
        closest = obj;
        closestDist = dist;
      }
    }
  }

  if (closest) {
    if (closest.type === 'InvObj') closest.useInv();
    else if (closest.type === 'Plant') closest.usePlant();
    else if (closest.objName === 'Door') closest.useDoor();
  }
}

function _handleHotbarScroll(direction) {
  if (typeof curPlayer === 'undefined' || !curPlayer) return;
  if (gameState !== 'playing' && gameState !== 'inventory') return;

  hotBarOffset = direction;
  mouseWheelMoved = true;
  if (typeof updatePlayerHotBarOffset === 'function') {
    updatePlayerHotBarOffset();
  }
  mouseWheelMoved = false;
}

// ─── Touch → Game Input Bridge (called every frame) ─
function applyTouchInput() {
  if (!isMobileDevice || !_touchControlsRoot) return;
  if (typeof curPlayer === 'undefined' || !curPlayer) return;
  if (gameState !== 'playing') return;

  // ── Joystick → Movement ──
  if (touchJoystick.active) {
    var vx = touchJoystick.vector.x;
    var vy = touchJoystick.vector.y;
    curPlayer.holding.w = vy < -0.3;
    curPlayer.holding.a = vx < -0.3;
    curPlayer.holding.s = vy > 0.3;
    curPlayer.holding.d = vx > 0.3;
  } else {
    // Joystick released — stop the player
    curPlayer.holding.w = false;
    curPlayer.holding.a = false;
    curPlayer.holding.s = false;
    curPlayer.holding.d = false;
  }

  // ── Dig/Use (touch on screen or USE button held) ──
  if (touchActions.dig) {
    if (curPlayer.isConcentrating) return;

    // Determine world aim position from touch or joystick
    let aimWorldX, aimWorldY;

    if (touchAim.active) {
      // Use finger touch position on screen
      aimWorldX = touchAim.x + camera.pos.x - width / 2;
      aimWorldY = touchAim.y + camera.pos.y - height / 2;
    } else {
      // USE button pressed without aiming — use joystick direction or facing
      const aimDist = 3 * TILESIZE;
      if (touchJoystick.active && (Math.abs(touchJoystick.vector.x) > 0.1 || Math.abs(touchJoystick.vector.y) > 0.1)) {
        aimWorldX = curPlayer.pos.x + touchJoystick.vector.x * aimDist;
        aimWorldY = curPlayer.pos.y + touchJoystick.vector.y * aimDist;
      } else {
        const facing = _getPlayerFacingDir();
        aimWorldX = curPlayer.pos.x + facing.x * aimDist;
        aimWorldY = curPlayer.pos.y + facing.y * aimDist;
      }
    }

    // Left-click equivalent — use held item or dig
    if (!buildMode) {
      if (curPlayer.invBlock.hotbar[curPlayer.invBlock.selectedHotBar] !== '') {
        const heldItem = curPlayer.invBlock.items[curPlayer.invBlock.hotbar[curPlayer.invBlock.selectedHotBar]];
        if (heldItem) heldItem.use(aimWorldX, aimWorldY, LEFT);
      } else {
        if (typeof dirtInv !== 'undefined' && typeof maxDirtInv !== 'undefined' && typeof DIGSPEED !== 'undefined') {
          if (dirtInv < maxDirtInv - DIGSPEED) {
            playerDig(aimWorldX, aimWorldY, DIGSPEED);
          } else {
            dirtBagUI.shake = { intensity: dirtBagUI.shake.intensity + 0.1, length: 1 };
          }
        }
      }
    } else {
      // Build mode - place building at aim position
      if (ghostBuild && ghostBuild.openBool) {
        _touchPlaceBuild(aimWorldX, aimWorldY);
      }
    }
  }
}

function _getPlayerFacingDir() {
  // Determine player facing from curPlayer.direction (persists after stopping)
  if (typeof curPlayer === 'undefined' || !curPlayer) return { x: 1, y: 0 };

  // First check active movement keys
  const h = curPlayer.holding;
  let fx = 0, fy = 0;
  if (h.d) fx += 1;
  if (h.a) fx -= 1;
  if (h.s) fy += 1;
  if (h.w) fy -= 1;

  if (fx !== 0 || fy !== 0) {
    const mag = Math.sqrt(fx * fx + fy * fy);
    return { x: fx / mag, y: fy / mag };
  }

  // Fall back to player's last facing direction
  switch (curPlayer.direction) {
    case 'up':    return { x: 0, y: -1 };
    case 'down':  return { x: 0, y: 1 };
    case 'left':  return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
    default:      return { x: 0, y: 1 }; // default down
  }
}

function _touchPlaceBuild(worldX, worldY) {
  if (!ghostBuild || typeof objDic === 'undefined') return;

  let hasCost = true;
  for (let i = 0; i < objDic[ghostBuild.objName].cost.length; i++) {
    const costItem = objDic[ghostBuild.objName].cost[i];
    if (costItem[0] === 'dirt') {
      if (dirtInv < costItem[1]) hasCost = false;
    } else {
      const inv = curPlayer.invBlock.items[costItem[0]];
      if (!inv || inv.amount < costItem[1]) hasCost = false;
    }
    if (!hasCost) break;
  }

  if (hasCost) {
    for (let i = 0; i < objDic[ghostBuild.objName].cost.length; i++) {
      const costItem = objDic[ghostBuild.objName].cost[i];
      if (costItem[0] === 'dirt') dirtInv -= costItem[1];
      else curPlayer.invBlock.decreaseAmount(costItem[0], costItem[1]);
    }

    const chunkPos = testMap.globalToChunk(worldX, worldY);
    const chunkKey = chunkPos.key || getChunkKey(chunkPos.x, chunkPos.y);
    const chunk = testMap.chunks[chunkKey];
    if (!chunk) return;

    const temp = createObject(ghostBuild.objName, ghostBuild.pos.x, ghostBuild.pos.y, ghostBuild.rot, curPlayer.color, curPlayer.id, curPlayer.name);
    chunk.objects.push(temp);
    chunk.objects.sort(function(a, b) { return a.z - b.z; });
    socket.emit('new_object', { cx: chunkPos.x, cy: chunkPos.y, obj: temp });

    curPlayer.animationCreate('put');
    if (typeof renderBuildOptions === 'function') renderBuildOptions();
  }
}

function _touchDeleteBuild(worldX, worldY) {
  const chunkPos = testMap.globalToChunk(worldX, worldY);
  const chunk = getChunkFromPos(testMap.chunks, chunkPos);
  if (!chunk) return;

  for (let i = 0; i < chunk.objects.length; i++) {
    const obj = chunk.objects[i];
    if (createVector(worldX, worldY).dist(obj.pos) < (obj.size.w + obj.size.h) / 4) {
      if ((obj.color === 0 && obj.ownerName === curPlayer.name) ||
          (obj.color !== 0 && obj.color === curPlayer.color)) {
        socket.emit('delete_obj', {
          cx: chunkPos.x, cy: chunkPos.y,
          objName: obj.objName,
          pos: { x: obj.pos.x, y: obj.pos.y },
          z: obj.z
        });
        chunk.objects.splice(i, 1);
        break;
      }
    }
  }
}

// ─── Show / Hide Controls Based on Game State ───────
function updateTouchControlsVisibility() {
  if (!isMobileDevice || !_touchControlsRoot) return;

  const inGame = (gameState === 'playing');
  const inMenu = (gameState === 'inventory' || gameState === 'crafting' ||
                  gameState === 'swap_inv' || gameState === 'pause' ||
                  gameState === 'dead' || gameState === 'player_status');

  // Joystick area - only during gameplay
  _joystickContainer.style.display = inGame ? '' : 'none';

  // Aim area
  document.getElementById('touch-aim-area').style.display = inGame ? '' : 'none';

  // USE button - only during gameplay
  var useBtnEl = document.getElementById('touch-use-btn');
  if (useBtnEl) useBtnEl.style.display = inGame ? '' : 'none';

  // DASH button - only during gameplay
  var dashBtnEl = document.getElementById('touch-dash-btn');
  if (dashBtnEl) dashBtnEl.style.display = inGame ? '' : 'none';

  // Hotbar arrows - only during gameplay
  document.getElementById('touch-hotbar-arrows').style.display = inGame ? '' : 'none';

  // Menu toggle + dropdown - always visible in game (to let them close menus)
  var menuToggleEl = document.getElementById('touch-menu-toggle');
  if (menuToggleEl) menuToggleEl.style.display = (inGame || inMenu) ? '' : 'none';
  var menuDropdownEl = document.getElementById('touch-menu-dropdown');
  if (menuDropdownEl && !inGame && !inMenu) menuDropdownEl.classList.remove('menu-open');

  // Reset pressed states when switching states
  if (!inGame) {
    touchActions.dig = false;
    touchJoystick.vector.x = 0;
    touchJoystick.vector.y = 0;
    Object.values(_actionButtons).forEach(function(btn) {
      if (btn && btn.classList) btn.classList.remove('pressed');
    });
  }
}

// ─── Ghost Build Positioning for Touch ──────────────
function updateGhostBuildTouch() {
  if (!isMobileDevice || !renderGhost || !ghostBuild) return;
  if (gameState !== 'playing') return;

  // Position ghost at aim point or in front of player
  if (touchAim.active) {
    ghostBuild.pos.x = touchAim.x + camera.pos.x - width / 2;
    ghostBuild.pos.y = touchAim.y + camera.pos.y - height / 2;
  } else if (touchJoystick.active) {
    const aimDist = 3 * TILESIZE;
    ghostBuild.pos.x = curPlayer.pos.x + touchJoystick.vector.x * aimDist;
    ghostBuild.pos.y = curPlayer.pos.y + touchJoystick.vector.y * aimDist;
  }
}
