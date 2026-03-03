// TutorialSystem.js — Interactive tutorial & game guide
// Multi-page startup walkthrough + contextual warnings for critical moments.
// Progress persisted in localStorage.

class TutorialSystem {
  constructor() {
    this._storageKey = 'bargainquest_tutorial';
    this._shown = new Set(JSON.parse(localStorage.getItem(this._storageKey) || '[]'));
    this._overlay = null;
    this._enabled = true;
    this._savedSpeed = undefined;

    // ── Startup guide pages (paged walkthrough on first game) ──
    this.guidePages = [
      {
        id: 'guide_welcome',
        title: 'Your Quest',
        icon: '\u2693',
        text: 'You are a traveling merchant sailing between cities.\n\nYour goal: accumulate ' + (window._newGameGoldTarget || 5000) + ' gold through trading, contracts, and cunning.\n\nThe world is dangerous \u2014 raiders roam the land, storms batter the seas, and your crew needs feeding. Good luck, Captain.',
      },
      {
        id: 'guide_controls',
        title: 'Controls',
        icon: '\ud83e\udded',
        text: '\u2022 WASD / Arrow Keys \u2014 Move one tile\n\u2022 Click any tile \u2014 Auto-walk via pathfinding\n\u2022 Q / E \u2014 Slow down / speed up time\n\u2022 I \u2014 Open inventory\n\u2022 Esc \u2014 Pause menu\n\nWalk onto a city to enter it. The HUD bar at the bottom shows your gold, cargo, and the current day.',
      },
      {
        id: 'guide_trading',
        title: 'Trading',
        icon: '\ud83d\udcb0',
        text: 'Trading is how you make money.\n\nEach city sells and buys goods at different prices. Buy cheap in one city, travel to another, and sell high.\n\nPrices change with the seasons, supply, and demand. Check the shop\u2019s price comparison arrows to spot good deals.',
      },
      {
        id: 'guide_survival',
        title: 'Survival',
        icon: '\u26a0\ufe0f',
        text: 'Two things will drain your gold if you\u2019re not careful:\n\n\ud83c\udf5e FOOD \u2014 Your crew eats every day. Run out and you lose gold to starvation. Always keep Bread or Fish stocked.\n\n\ud83d\udcb8 TAXES \u2014 Every 7 days, 5% of your gold is taken as taxes, plus port fees.\n\nGo broke with no inventory and it\u2019s game over.',
      },
      {
        id: 'guide_world',
        title: 'The World',
        icon: '\ud83d\uddfa\ufe0f',
        text: '\u2694\ufe0f RAIDERS \u2014 Bandits and pirates roam the map. When caught you can Fight (QTE minigame), Flee, or Bribe.\n\n\u26f5 BOATS \u2014 Port cities sell boats for sea travel. Boats degrade weekly and need repair.\n\n\ud83c\udfe6 SERVICES \u2014 Cities offer banks, contracts, bounty boards, gambling dens, and black markets. Explore to find them!',
      },
    ];

    // ── Contextual tips (only for truly surprising/critical moments) ──
    this.contextTips = [
      {
        id: 'combat',
        title: 'Combat!',
        icon: '\u2694\ufe0f',
        text: 'A raider attacks! You have three options:\n\n\u2694\ufe0f Fight \u2014 Play a Quick-Time Event. Each weapon type has a different pattern.\n\ud83c\udfc3 Flee \u2014 Attempt to escape. Success depends on terrain.\n\ud83d\udcb0 Bribe \u2014 Pay gold to avoid the fight.\n\nCombat gets harder as days pass.',
      },
      {
        id: 'lowFood',
        title: 'Food Running Low!',
        icon: '\ud83c\udf5e',
        text: 'Your food supply is critically low! Your crew eats every day.\n\nBuy Bread, Fish, or other food at city shops before you starve. Starvation costs gold each day and can end your game.',
      },
    ];

    // Combined for the help panel
    this.allSteps = [...this.guidePages, ...this.contextTips];
  }

  // ─── Startup guide (multi-page) ──────────────────────

  /** Show the multi-page startup guide. */
  showStartupGuide() {
    if (!this._enabled) return;
    if (this._shown.has('guide_welcome')) return;
    this._showGuide(0);
  }

  _showGuide(pageIndex) {
    this._removeOverlay();

    // Pause game
    if (typeof gameSpeed !== 'undefined' && this._savedSpeed === undefined) {
      this._savedSpeed = gameSpeed;
      gameSpeed = 0;
    }

    const pages = this.guidePages;
    const page = pages[pageIndex];
    if (!page) return;

    const overlay = document.createElement('div');
    overlay.className = 'tutorial-overlay';

    const panel = document.createElement('div');
    panel.className = 'tutorial-panel';

    // Icon
    const iconEl = document.createElement('div');
    iconEl.className = 'tutorial-icon';
    iconEl.textContent = page.icon;
    panel.appendChild(iconEl);

    // Title
    const titleEl = document.createElement('div');
    titleEl.className = 'tutorial-title';
    titleEl.textContent = page.title;
    panel.appendChild(titleEl);

    // Body
    const bodyEl = document.createElement('div');
    bodyEl.className = 'tutorial-body';
    bodyEl.textContent = page.text;
    panel.appendChild(bodyEl);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'tutorial-footer';

    // Page indicator
    const counter = document.createElement('span');
    counter.className = 'tutorial-counter';
    counter.textContent = (pageIndex + 1) + ' / ' + pages.length;
    footer.appendChild(counter);

    // Button row
    const btnRow = document.createElement('div');
    btnRow.className = 'tutorial-btn-row';

    // Skip button
    const skipBtn = document.createElement('button');
    skipBtn.className = 'tutorial-skip-btn';
    skipBtn.textContent = 'Skip Tutorial';
    skipBtn.addEventListener('click', () => this._finishGuide(true));
    btnRow.appendChild(skipBtn);

    // Back button
    if (pageIndex > 0) {
      const backBtn = document.createElement('button');
      backBtn.className = 'tutorial-nav-btn';
      backBtn.textContent = '\u2190 Back';
      backBtn.addEventListener('click', () => this._showGuide(pageIndex - 1));
      btnRow.appendChild(backBtn);
    }

    // Next / Done button
    const isLast = pageIndex === pages.length - 1;
    const nextBtn = document.createElement('button');
    nextBtn.className = 'tutorial-dismiss-btn';
    nextBtn.textContent = isLast ? 'Start Playing \u2192' : 'Next \u2192';
    nextBtn.addEventListener('click', () => {
      if (isLast) {
        this._finishGuide(false);
      } else {
        this._showGuide(pageIndex + 1);
      }
    });
    btnRow.appendChild(nextBtn);

    footer.appendChild(btnRow);
    panel.appendChild(footer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this._overlay = overlay;

    requestAnimationFrame(() => overlay.classList.add('tutorial-visible'));
  }

  _finishGuide(skipped) {
    for (var i = 0; i < this.guidePages.length; i++) {
      this._shown.add(this.guidePages[i].id);
    }
    if (skipped) {
      for (var j = 0; j < this.contextTips.length; j++) {
        this._shown.add(this.contextTips[j].id);
      }
      this._enabled = false;
    }
    this._save();
    this._removeOverlay();
    this._resumeGame();

    if (skipped && typeof notificationManager !== 'undefined') {
      notificationManager.log('Tutorial skipped. Press ? on the HUD to read the Game Guide anytime.', 'info');
    }
  }

  // ─── Contextual tips (single popup) ──────────────────

  /** Show a contextual tip if not already shown. */
  tryShow(tipId) {
    if (!this._enabled) return;
    if (this._shown.has(tipId)) return;
    if (this._overlay) return;
    var tip = null;
    for (var i = 0; i < this.contextTips.length; i++) {
      if (this.contextTips[i].id === tipId) { tip = this.contextTips[i]; break; }
    }
    if (!tip) return;
    this._showContextTip(tip);
  }

  hasShown(id) {
    return this._shown.has(id);
  }

  _showContextTip(tip) {
    this._removeOverlay();

    if (typeof gameSpeed !== 'undefined') {
      this._savedSpeed = gameSpeed;
      gameSpeed = 0;
    }

    const overlay = document.createElement('div');
    overlay.className = 'tutorial-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._dismissTip(tip.id);
    });

    const panel = document.createElement('div');
    panel.className = 'tutorial-panel';

    const iconEl = document.createElement('div');
    iconEl.className = 'tutorial-icon';
    iconEl.textContent = tip.icon;
    panel.appendChild(iconEl);

    const titleEl = document.createElement('div');
    titleEl.className = 'tutorial-title';
    titleEl.textContent = tip.title;
    panel.appendChild(titleEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'tutorial-body';
    bodyEl.textContent = tip.text;
    panel.appendChild(bodyEl);

    const footer = document.createElement('div');
    footer.className = 'tutorial-footer';

    const spacer = document.createElement('span');
    footer.appendChild(spacer);

    const btn = document.createElement('button');
    btn.className = 'tutorial-dismiss-btn';
    btn.textContent = 'Continue \u2192';
    btn.addEventListener('click', () => this._dismissTip(tip.id));
    footer.appendChild(btn);

    panel.appendChild(footer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this._overlay = overlay;

    requestAnimationFrame(() => overlay.classList.add('tutorial-visible'));
  }

  _dismissTip(tipId) {
    this._shown.add(tipId);
    this._save();
    this._removeOverlay();
    this._resumeGame();
  }

  // ─── Shared helpers ──────────────────────────────────

  _resumeGame() {
    if (typeof gameSpeed !== 'undefined' && this._savedSpeed !== undefined) {
      gameSpeed = this._savedSpeed;
      this._savedSpeed = undefined;
    }
  }

  _removeOverlay() {
    if (this._overlay) {
      this._overlay.classList.remove('tutorial-visible');
      var el = this._overlay;
      setTimeout(function() { el.remove(); }, 250);
      this._overlay = null;
    }
  }

  _save() {
    localStorage.setItem(this._storageKey, JSON.stringify([...this._shown]));
  }

  get enabled() { return this._enabled; }
  set enabled(v) { this._enabled = !!v; }

  resetAll() {
    this._shown.clear();
    this._enabled = true;
    localStorage.removeItem(this._storageKey);
  }

  getProgress() {
    return { shown: this._shown.size, total: this.allSteps.length };
  }

  // ─── Help panel (full game guide reference) ──────────

  showHelpPanel() {
    document.getElementById('tutorialHelpPanel')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'tutorialHelpPanel';
    overlay.className = 'tutorial-help-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    const panel = document.createElement('div');
    panel.className = 'tutorial-help-panel';

    const hdr = document.createElement('h2');
    hdr.textContent = '\ud83d\udcd6 Game Guide';
    hdr.style.cssText = 'color:#d4af37;margin:0 0 16px;text-align:center;font-size:20px;';
    panel.appendChild(hdr);

    // All guide pages + tips shown as readable reference — no discovery gating
    for (var i = 0; i < this.allSteps.length; i++) {
      var step = this.allSteps[i];
      var section = document.createElement('div');
      section.className = 'tutorial-help-row discovered';

      var icon = document.createElement('span');
      icon.className = 'tutorial-help-icon';
      icon.textContent = step.icon;
      section.appendChild(icon);

      var info = document.createElement('div');
      info.className = 'tutorial-help-info';

      var rowTitle = document.createElement('div');
      rowTitle.className = 'tutorial-help-title';
      rowTitle.textContent = step.title;
      info.appendChild(rowTitle);

      var rowText = document.createElement('div');
      rowText.className = 'tutorial-help-text';
      rowText.textContent = step.text;
      info.appendChild(rowText);

      section.appendChild(info);
      panel.appendChild(section);
    }

    // Action buttons
    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;margin-top:16px;';

    var self = this;

    var replayBtn = document.createElement('button');
    replayBtn.textContent = '\ud83d\udd04 Replay Tutorial';
    replayBtn.className = 'tutorial-help-btn-action';
    replayBtn.addEventListener('click', function() {
      overlay.remove();
      self.resetAll();
      self._showGuide(0);
    });
    btnRow.appendChild(replayBtn);

    var toggleBtn = document.createElement('button');
    toggleBtn.textContent = this._enabled ? '\ud83d\udd15 Disable Tips' : '\ud83d\udd14 Enable Tips';
    toggleBtn.className = 'tutorial-help-btn-action';
    toggleBtn.addEventListener('click', function() {
      self._enabled = !self._enabled;
      toggleBtn.textContent = self._enabled ? '\ud83d\udd15 Disable Tips' : '\ud83d\udd14 Enable Tips';
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(self._enabled ? 'Tutorial tips enabled.' : 'Tutorial tips disabled.', 'info');
      }
    });
    btnRow.appendChild(toggleBtn);

    panel.appendChild(btnRow);

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715 Close';
    closeBtn.className = 'tutorial-help-close';
    closeBtn.addEventListener('click', function() { overlay.remove(); });
    panel.appendChild(closeBtn);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }
}
