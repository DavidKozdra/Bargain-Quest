// Minigames.js — 7 standalone minigame engines
// Each minigame: start(), update(dt), render(ctx), handleInput(e), isComplete(), getResult()

class MinigameManager {
  constructor() {
    this.active = null;       // current MinigameBase instance
    this.onComplete = null;   // callback(result) when minigame finishes
    this._keyHandler = null;
    this._clickHandler = null;
  }

  /** Launch a minigame by name. Returns the instance. */
  launch(name, config, onComplete) {
    const classes = {
      haggling:    HagglingMinigame,
      lockpicking: LockPickingMinigame,
      dicePoker:   DicePokerMinigame,
      memoryMatch: MemoryMatchMinigame,
      wheelOfFortune: WheelOfFortuneMinigame,
      bluffMeter:  BluffMeterMinigame,
      navigationDodge: NavigationDodgeMinigame,
    };
    const Cls = classes[name];
    if (!Cls) { console.warn(`Unknown minigame: ${name}`); return null; }

    this.active = new Cls(config || {});
    this.onComplete = onComplete || null;
    this.active.start();

    // Wire input
    this._keyHandler = (e) => {
      if (!this.active || this.active._done) return;
      if (e.code === 'Escape') { e.preventDefault(); this.active._doForfeit(); return; }
      this.active.handleKeyInput(e);
    };
    this._clickHandler = (e) => {
      if (!this.active || this.active._done) return;
      // Check quit button click before passing to the minigame
      if (this.active._quitBtn) {
        const qb = this.active._quitBtn;
        if (typeof mouseX !== 'undefined' &&
            mouseX >= qb.x && mouseX <= qb.x + qb.w &&
            mouseY >= qb.y && mouseY <= qb.y + qb.h) {
          this.active._doForfeit();
          return;
        }
      }
      this.active.handleClickInput(e);
    };
    window.addEventListener('keydown', this._keyHandler);
    window.addEventListener('click', this._clickHandler);

    return this.active;
  }

  /** Called every frame from game.js draw() when a minigame is active */
  update(dt) {
    if (!this.active) return;
    this.active.update(dt);
    if (this.active.isComplete()) {
      const result = this.active.getResult();
      this._cleanup();
      if (this.onComplete) this.onComplete(result);
      this.onComplete = null;
    }
  }

  /** Render the active minigame overlay (called in draw()) */
  render() {
    if (!this.active) return;
    this.active.render();
  }

  /** Cancel/abort the active minigame */
  cancel() {
    if (this.active) {
      this.active._done = true;
      this._cleanup();
    }
  }

  _cleanup() {
    if (this._keyHandler) { window.removeEventListener('keydown', this._keyHandler); this._keyHandler = null; }
    if (this._clickHandler) { window.removeEventListener('click', this._clickHandler); this._clickHandler = null; }
    this.active = null;
  }

  get isActive() { return this.active !== null; }
}

// ══════════════════════════════════════════════════════════
//  BASE CLASS
// ══════════════════════════════════════════════════════════
class MinigameBase {
  constructor(config) {
    this.config = config;
    this._done = false;
    this._result = null;
    this._elapsed = 0;
    this._quitBtn = null;
  }
  start() {}
  update(dt) { this._elapsed += dt; }
  render() {}
  handleKeyInput(e) {}
  handleClickInput(e) {}
  isComplete() { return this._done; }
  getResult() { return this._result; }

  /** Override in subclasses to provide a forfeit result. Return null to block quitting. */
  _buildForfeitResult() { return null; }

  /** Called by MinigameManager on Escape or quit button click. */
  _doForfeit() {
    if (this._done) return;
    const result = this._buildForfeitResult();
    if (result === null) return;
    this._result = result;
    this._done = true;
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log('Game forfeited.', 'warning');
    }
  }

  /** Utility: draw a dark overlay behind the minigame */
  drawOverlay(alpha = 180) {
    push();
    resetMatrix();
    fill(0, 0, 0, alpha);
    noStroke();
    rect(0, 0, width, height);
    pop();
  }

  /** Utility: centered panel — also draws the ✕ quit button (top-right corner) */
  drawPanel(w, h, title) {
    push();
    resetMatrix();
    const x = (width - w) / 2;
    const y = (height - h) / 2;

    // Panel bg
    fill(30, 30, 40, 240);
    stroke(120, 100, 60);
    strokeWeight(2);
    rect(x, y, w, h, 12);

    // Title
    if (title) {
      fill(255, 220, 100);
      noStroke();
      textAlign(CENTER, TOP);
      textSize(20);
      text(title, width / 2, y + 14);
    }

    // ✕ Quit button (top-right corner)
    const qbSize = 22;
    const qbX = x + w - qbSize - 8;
    const qbY = y + 7;
    fill(80, 40, 40);
    stroke(160, 70, 70);
    strokeWeight(1);
    rect(qbX, qbY, qbSize, qbSize, 4);
    fill(255, 110, 110);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(14);
    text('✕', qbX + qbSize / 2, qbY + qbSize / 2);
    this._quitBtn = { x: qbX, y: qbY, w: qbSize, h: qbSize };

    pop();
    return { x, y, w, h };
  }
}

// ══════════════════════════════════════════════════════════
//  1. HAGGLING BAR
// ══════════════════════════════════════════════════════════
class HagglingMinigame extends MinigameBase {
  start() {
    this.basePrice = this.config.basePrice || 100;
    this.reputation = this.config.reputation || 50; // 0-100
    this.isBuying = this.config.isBuying !== false;

    // Sweet spot width: 10-40% of bar based on rep
    this.sweetSpotWidth = 0.10 + (this.reputation / 100) * 0.30;
    // Negotiation book bonus
    if (this.config.hasNegotiationBook) this.sweetSpotWidth += 0.05;
    this.sweetSpotWidth = Math.min(0.50, this.sweetSpotWidth);

    this.rounds = 3;
    this.currentRound = 0;
    this.roundResults = [];

    // Bar state
    this.barPos = 0;       // 0-1, indicator position
    this.barSpeed = 1.8;   // cycles per second
    this.barDir = 1;
    this.stopped = false;

    // Sweet spot center per round (randomized)
    this.sweetSpotCenter = 0.3 + Math.random() * 0.4;

    this._startRound();
  }

  _startRound() {
    this.barPos = 0;
    this.barDir = 1;
    this.stopped = false;
    // Each round has slightly different sweet spot and speed
    this.sweetSpotCenter = 0.2 + Math.random() * 0.6;
    this.barSpeed = 1.5 + this.currentRound * 0.4 + Math.random() * 0.3;
  }

  update(dt) {
    super.update(dt);
    if (this._done || this.stopped) return;

    this.barPos += this.barDir * this.barSpeed * (dt / 1000);
    if (this.barPos >= 1) { this.barPos = 1; this.barDir = -1; }
    if (this.barPos <= 0) { this.barPos = 0; this.barDir = 1; }
  }

  handleKeyInput(e) {
    if (this._done || this.stopped) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      this._stopBar();
    }
  }

  handleClickInput(e) {
    if (this._done || this.stopped) return;
    this._stopBar();
  }

  _stopBar() {
    this.stopped = true;
    const dist = Math.abs(this.barPos - this.sweetSpotCenter);
    const inSweet = dist <= this.sweetSpotWidth / 2;
    const accuracy = inSweet ? 1 - (dist / (this.sweetSpotWidth / 2)) : -(dist - this.sweetSpotWidth / 2);
    this.roundResults.push({ pos: this.barPos, dist, inSweet, accuracy });
    this.currentRound++;

    if (this.currentRound >= this.rounds) {
      // Calculate final modifier
      setTimeout(() => this._finish(), 600);
    } else {
      setTimeout(() => this._startRound(), 500);
    }
  }

  _finish() {
    const avgAccuracy = this.roundResults.reduce((s, r) => s + r.accuracy, 0) / this.roundResults.length;
    let modifier;
    if (avgAccuracy > 0) {
      // Good: up to 20% better price
      modifier = avgAccuracy * 0.20;
    } else {
      // Bad: up to 5% worse
      modifier = avgAccuracy * 0.05;
    }

    // For buying, lower is better (negative modifier = discount)
    // For selling, higher is better (positive modifier = bonus)
    this._result = {
      success: avgAccuracy > 0,
      modifier: this.isBuying ? -modifier : modifier,
      avgAccuracy,
      roundDetails: this.roundResults,
    };
    this._done = true;
  }

  render() {
    this.drawOverlay(160);
    const p = this.drawPanel(450, 260, '⚖️ Haggle!');

    push();
    resetMatrix();
    const cx = p.x + p.w / 2;
    const barY = p.y + 80;
    const barW = 380;
    const barH = 30;
    const barX = cx - barW / 2;

    // Bar background
    fill(50, 50, 60);
    stroke(80);
    strokeWeight(1);
    rect(barX, barY, barW, barH, 6);

    // Sweet spot zone
    const ssLeft = barX + (this.sweetSpotCenter - this.sweetSpotWidth / 2) * barW;
    const ssW = this.sweetSpotWidth * barW;
    noStroke();
    fill(0, 180, 80, 120);
    rect(ssLeft, barY, ssW, barH, 6);

    // Indicator
    if (!this.stopped || this.currentRound < this.rounds) {
      const indX = barX + this.barPos * barW;
      stroke(255, 220, 50);
      strokeWeight(3);
      line(indX, barY - 4, indX, barY + barH + 4);
      noStroke();
      fill(255, 220, 50);
      ellipse(indX, barY - 6, 10, 10);
    }

    // Round info
    fill(200);
    noStroke();
    textAlign(CENTER, TOP);
    textSize(14);
    text(`Round ${Math.min(this.currentRound + 1, this.rounds)} / ${this.rounds}`, cx, barY + barH + 16);

    // Round results dots
    for (let i = 0; i < this.roundResults.length; i++) {
      const r = this.roundResults[i];
      const dotX = barX + r.pos * barW;
      fill(r.inSweet ? color(0, 255, 100) : color(255, 60, 60));
      noStroke();
      ellipse(dotX, barY + barH + 46, 12, 12);
    }

    // Instructions
    fill(160);
    textSize(12);
    text('Press SPACE or CLICK to stop the bar in the green zone!', cx, p.y + p.h - 40);

    if (this.stopped && this.currentRound < this.rounds) {
      const last = this.roundResults[this.roundResults.length - 1];
      fill(last.inSweet ? color(0, 255, 100) : color(255, 80, 80));
      textSize(16);
      text(last.inSweet ? '✓ Nice!' : '✗ Missed!', cx, barY - 30);
    }

    pop();
  }
}

// ══════════════════════════════════════════════════════════
//  2. LOCK PICKING
// ══════════════════════════════════════════════════════════
class LockPickingMinigame extends MinigameBase {
  start() {
    this.numTumblers = this.config.tumblers || 4;
    this.timeLimit = (this.config.timeLimit || 20) * 1000;
    this.positions = 3; // left, center, right
    // Generate correct combo
    this.solution = [];
    for (let i = 0; i < this.numTumblers; i++) {
      this.solution.push(Math.floor(Math.random() * this.positions));
    }
    // Player's current guess
    this.current = new Array(this.numTumblers).fill(0);
    this.selectedTumbler = 0;
    this.locked = new Array(this.numTumblers).fill(false);
    this.attempts = 0;
  }

  update(dt) {
    super.update(dt);
    if (this._done) return;
    if (this._elapsed >= this.timeLimit) {
      this._result = { success: false, reason: 'timeout' };
      this._done = true;
    }
  }

  handleKeyInput(e) {
    if (this._done) return;
    const key = e.code;

    if (key === 'ArrowLeft' || key === 'KeyA') {
      this.selectedTumbler = Math.max(0, this.selectedTumbler - 1);
    } else if (key === 'ArrowRight' || key === 'KeyD') {
      this.selectedTumbler = Math.min(this.numTumblers - 1, this.selectedTumbler + 1);
    } else if (key === 'ArrowUp' || key === 'KeyW') {
      if (!this.locked[this.selectedTumbler]) {
        this.current[this.selectedTumbler] = (this.current[this.selectedTumbler] + 1) % this.positions;
      }
    } else if (key === 'ArrowDown' || key === 'KeyS') {
      if (!this.locked[this.selectedTumbler]) {
        this.current[this.selectedTumbler] = (this.current[this.selectedTumbler] + this.positions - 1) % this.positions;
      }
    } else if (key === 'Space' || key === 'Enter') {
      e.preventDefault();
      this._tryLock();
    }
  }

  _tryLock() {
    const idx = this.selectedTumbler;
    if (this.locked[idx]) return;
    this.attempts++;

    if (this.current[idx] === this.solution[idx]) {
      this.locked[idx] = true;
      // Check if all locked
      if (this.locked.every(l => l)) {
        this._result = { success: true, attempts: this.attempts };
        this._done = true;
      }
    }
    // Wrong guess: tumbler stays unlocked, player can try again
  }

  render() {
    this.drawOverlay(160);
    const p = this.drawPanel(420, 300, '🔓 Pick the Lock!');

    push();
    resetMatrix();
    const cx = p.x + p.w / 2;

    // Timer bar
    const timeRatio = Math.max(0, 1 - this._elapsed / this.timeLimit);
    const timerY = p.y + 48;
    fill(50, 50, 60);
    noStroke();
    rect(p.x + 30, timerY, p.w - 60, 8, 4);
    const timerColor = timeRatio > 0.5 ? color(0, 200, 80) : timeRatio > 0.25 ? color(255, 165, 0) : color(255, 50, 50);
    fill(timerColor);
    rect(p.x + 30, timerY, (p.w - 60) * timeRatio, 8, 4);

    // Tumblers
    const tumblerW = 60;
    const tumblerH = 100;
    const gap = 16;
    const totalW = this.numTumblers * tumblerW + (this.numTumblers - 1) * gap;
    const startX = cx - totalW / 2;
    const tumY = p.y + 80;

    const posLabels = ['◁', '◇', '▷'];

    for (let i = 0; i < this.numTumblers; i++) {
      const tx = startX + i * (tumblerW + gap);
      const selected = i === this.selectedTumbler;

      // Tumbler bg
      fill(this.locked[i] ? color(0, 100, 50) : selected ? color(60, 60, 80) : color(40, 40, 50));
      stroke(this.locked[i] ? color(0, 255, 100) : selected ? color(255, 220, 50) : color(80));
      strokeWeight(selected ? 2 : 1);
      rect(tx, tumY, tumblerW, tumblerH, 8);

      // Position indicator
      fill(this.locked[i] ? color(0, 255, 100) : color(220));
      noStroke();
      textAlign(CENTER, CENTER);
      textSize(28);
      text(posLabels[this.current[i]], tx + tumblerW / 2, tumY + tumblerH / 2);

      // Lock icon
      if (this.locked[i]) {
        textSize(16);
        text('✓', tx + tumblerW / 2, tumY + tumblerH - 14);
      }

      // Hint: proximity feedback
      if (!this.locked[i] && this.attempts > 0) {
        const diff = Math.abs(this.current[i] - this.solution[i]);
        if (diff === 0) {
          fill(0, 255, 100, 80);
        } else if (diff === 1 || diff === this.positions - 1) {
          fill(255, 200, 0, 60);
        } else {
          fill(255, 50, 50, 40);
        }
        noStroke();
        ellipse(tx + tumblerW / 2, tumY - 10, 14, 14);
      }
    }

    // Instructions
    fill(160);
    noStroke();
    textAlign(CENTER, TOP);
    textSize(12);
    text('← → select tumbler  |  ↑ ↓ rotate  |  SPACE to try locking', cx, p.y + p.h - 48);
    textSize(11);
    fill(120);
    text('🟢 = correct  🟡 = close  🔴 = wrong', cx, p.y + p.h - 28);

    pop();
  }
}

// ══════════════════════════════════════════════════════════
//  3. DICE POKER
// ══════════════════════════════════════════════════════════
class DicePokerMinigame extends MinigameBase {
  start() {
    this.bet = this.config.bet || 50;
    this.maxRerolls = 2;
    this.rerollsLeft = this.maxRerolls;
    this.dice = [];
    this.held = [false, false, false, false, false];
    this.phase = 'rolling'; // rolling, holding, done
    this._rollDice();
    this._rollAnim = 0;
  }

  _rollDice() {
    for (let i = 0; i < 5; i++) {
      if (!this.held[i]) {
        this.dice[i] = 1 + Math.floor(Math.random() * 6);
      }
    }
    this._rollAnim = 300; // animation ms
    this.phase = 'holding';
  }

  _buildForfeitResult() {
    return { hand: 'Folded', multiplier: 0, bet: this.bet, winnings: 0, profit: -this.bet, dice: [...this.dice] };
  }

  handleKeyInput(e) {
    if (this._done) return;
    const key = e.code;

    if (this.phase === 'holding') {
      // 1-5 to toggle hold
      if (key >= 'Digit1' && key <= 'Digit5') {
        const idx = parseInt(key.charAt(5)) - 1;
        this.held[idx] = !this.held[idx];
      }
      // Space/Enter to reroll or finalize
      if (key === 'Space' || key === 'Enter') {
        e.preventDefault();
        if (this.rerollsLeft > 0) {
          this.rerollsLeft--;
          this._rollDice();
          if (this.rerollsLeft === 0) {
            this.phase = 'done';
            setTimeout(() => this._evaluate(), 400);
          }
        } else {
          this.phase = 'done';
          setTimeout(() => this._evaluate(), 400);
        }
      }
      // 'K' to keep all and finalize early
      if (key === 'KeyK') {
        this.phase = 'done';
        setTimeout(() => this._evaluate(), 400);
      }
    }
  }

  _evaluate() {
    const hand = this._getHand();
    const multiplier = hand.multiplier;
    const winnings = Math.floor(this.bet * multiplier);
    this._result = {
      hand: hand.name,
      multiplier,
      bet: this.bet,
      winnings,
      profit: winnings - this.bet,
      dice: [...this.dice],
    };
    this._done = true;
  }

  _getHand() {
    const counts = {};
    for (const d of this.dice) counts[d] = (counts[d] || 0) + 1;
    const vals = Object.values(counts).sort((a, b) => b - a);

    if (vals[0] === 5) return { name: 'Five of a Kind!', multiplier: 8 };
    if (vals[0] === 4) return { name: 'Four of a Kind', multiplier: 5 };
    if (vals[0] === 3 && vals[1] === 2) return { name: 'Full House', multiplier: 4 };
    if (vals[0] === 3) return { name: 'Three of a Kind', multiplier: 3 };
    if (vals[0] === 2 && vals[1] === 2) return { name: 'Two Pair', multiplier: 2 };
    if (vals[0] === 2) return { name: 'One Pair', multiplier: 0 };

    // Check straight
    const sorted = [...new Set(this.dice)].sort((a, b) => a - b);
    if (sorted.length === 5 && sorted[4] - sorted[0] === 4) return { name: 'Straight', multiplier: 4 };

    return { name: 'High Card', multiplier: 0 };
  }

  update(dt) {
    super.update(dt);
    if (this._rollAnim > 0) this._rollAnim = Math.max(0, this._rollAnim - dt);
  }

  render() {
    this.drawOverlay(160);
    const p = this.drawPanel(480, 300, '🎲 Dice Poker');

    push();
    resetMatrix();
    const cx = p.x + p.w / 2;

    // Dice
    const diceSize = 56;
    const diceGap = 14;
    const totalDW = 5 * diceSize + 4 * diceGap;
    const diceStartX = cx - totalDW / 2;
    const diceY = p.y + 70;

    const diceFaces = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

    for (let i = 0; i < 5; i++) {
      const dx = diceStartX + i * (diceSize + diceGap);
      const isRolling = this._rollAnim > 0 && !this.held[i];

      // Dice background
      fill(this.held[i] ? color(60, 100, 60) : color(250, 245, 230));
      stroke(this.held[i] ? color(0, 200, 80) : color(120));
      strokeWeight(this.held[i] ? 2 : 1);
      rect(dx, diceY, diceSize, diceSize, 8);

      // Dice face
      fill(this.held[i] ? color(200, 255, 200) : color(30));
      noStroke();
      textAlign(CENTER, CENTER);
      textSize(36);
      const faceVal = isRolling ? (1 + Math.floor(Math.random() * 6)) : this.dice[i];
      text(diceFaces[faceVal] || faceVal, dx + diceSize / 2, diceY + diceSize / 2);

      // Hold label
      if (this.held[i]) {
        fill(0, 200, 80);
        textSize(10);
        text('HELD', dx + diceSize / 2, diceY + diceSize + 12);
      }

      // Number key hint
      fill(100);
      textSize(10);
      text(`[${i + 1}]`, dx + diceSize / 2, diceY - 10);
    }

    // Info
    fill(200);
    noStroke();
    textAlign(CENTER, TOP);
    textSize(14);
    text(`Bet: ${this.bet}g  |  Rerolls left: ${this.rerollsLeft}`, cx, diceY + diceSize + 32);

    // Hand display (evaluate current)
    const hand = this._getHand();
    fill(255, 220, 100);
    textSize(16);
    text(`${hand.name} (×${hand.multiplier})`, cx, diceY + diceSize + 54);

    // Instructions
    fill(140);
    textSize(11);
    text('1-5 to hold/release  |  SPACE to reroll  |  K to keep', cx, p.y + p.h - 36);

    pop();
  }
}

// ══════════════════════════════════════════════════════════
//  4. MEMORY MATCH
// ══════════════════════════════════════════════════════════
class MemoryMatchMinigame extends MinigameBase {
  start() {
    this.entryFee = this.config.entryFee || 50;
    this.gridCols = 4;
    this.gridRows = 4;
    this.maxFlips = this.config.maxFlips || 18;
    this.flipsUsed = 0;

    // Create pairs: 8 pairs with gold values
    const values = [5, 8, 10, 12, 15, 20, 30, 45];
    const cards = [];
    for (const v of values) { cards.push(v, v); }

    // Shuffle
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }

    this.cards = cards;
    this.revealed = new Array(16).fill(false);
    this.matched = new Array(16).fill(false);
    this.selection = []; // indices of currently flipped cards (max 2)
    this.totalWon = 0;
    this.matchPairs = 0;
    this.selectedCell = 0; // keyboard cursor
    this._matchTimer = 0;
  }

  _buildForfeitResult() {
    return { totalWon: this.totalWon, entryFee: this.entryFee, profit: this.totalWon - this.entryFee, matchPairs: this.matchPairs, flipsUsed: this.flipsUsed };
  }

  handleKeyInput(e) {
    if (this._done) return;
    const key = e.code;
    const c = this.selectedCell % this.gridCols;
    const r = Math.floor(this.selectedCell / this.gridCols);

    if (key === 'ArrowLeft' || key === 'KeyA') {
      this.selectedCell = r * this.gridCols + Math.max(0, c - 1);
    } else if (key === 'ArrowRight' || key === 'KeyD') {
      this.selectedCell = r * this.gridCols + Math.min(this.gridCols - 1, c + 1);
    } else if (key === 'ArrowUp' || key === 'KeyW') {
      this.selectedCell = Math.max(0, r - 1) * this.gridCols + c;
    } else if (key === 'ArrowDown' || key === 'KeyS') {
      this.selectedCell = Math.min(this.gridRows - 1, r + 1) * this.gridCols + c;
    } else if (key === 'Space' || key === 'Enter') {
      e.preventDefault();
      this._flipCard(this.selectedCell);
    }
  }

  handleClickInput(e) {
    // Map canvas click to grid cell using p5 mouseX/mouseY
    if (typeof mouseX === 'undefined' || typeof width === 'undefined') return;
    const panelW = 420, panelH = 380;
    const px = (width - panelW) / 2;
    const py = (height - panelH) / 2;
    const cx = px + panelW / 2;
    const cardSize = 64, cardGap = 8;
    const totalGW = this.gridCols * cardSize + (this.gridCols - 1) * cardGap;
    const gridX = cx - totalGW / 2;
    const gridY = py + 55;
    const col = Math.floor((mouseX - gridX) / (cardSize + cardGap));
    const row = Math.floor((mouseY - gridY) / (cardSize + cardGap));
    if (col >= 0 && col < this.gridCols && row >= 0 && row < this.gridRows) {
      const idx = row * this.gridCols + col;
      this.selectedCell = idx;
      this._flipCard(idx);
    }
  }

  _flipCard(idx) {
    if (this._done || this.matched[idx] || this.revealed[idx] || this.selection.length >= 2) return;
    if (this.flipsUsed >= this.maxFlips) return;

    this.revealed[idx] = true;
    this.selection.push(idx);
    this.flipsUsed++;

    if (this.selection.length === 2) {
      const [a, b] = this.selection;
      if (this.cards[a] === this.cards[b]) {
        // Match!
        this.matched[a] = true;
        this.matched[b] = true;
        this.totalWon += this.cards[a];
        this.matchPairs++;
        this._matchTimer = 500;
        setTimeout(() => { this.selection = []; }, 500);
      } else {
        // No match — hide after delay
        this._matchTimer = 800;
        setTimeout(() => {
          this.revealed[a] = false;
          this.revealed[b] = false;
          this.selection = [];
        }, 800);
      }

      // Check end conditions
      setTimeout(() => {
        if (this.matchPairs >= 8 || this.flipsUsed >= this.maxFlips) {
          this._result = {
            totalWon: this.totalWon,
            entryFee: this.entryFee,
            profit: this.totalWon - this.entryFee,
            matchPairs: this.matchPairs,
            flipsUsed: this.flipsUsed,
          };
          this._done = true;
        }
      }, 900);
    }
  }

  render() {
    this.drawOverlay(160);
    const p = this.drawPanel(420, 380, '🃏 Memory Match');

    push();
    resetMatrix();
    const cx = p.x + p.w / 2;

    const cardSize = 64;
    const cardGap = 8;
    const totalGW = this.gridCols * cardSize + (this.gridCols - 1) * cardGap;
    const totalGH = this.gridRows * cardSize + (this.gridRows - 1) * cardGap;
    const gridX = cx - totalGW / 2;
    const gridY = p.y + 55;

    for (let i = 0; i < 16; i++) {
      const col = i % this.gridCols;
      const row = Math.floor(i / this.gridCols);
      const cx2 = gridX + col * (cardSize + cardGap);
      const cy = gridY + row * (cardSize + cardGap);
      const isSelected = i === this.selectedCell;

      if (this.matched[i]) {
        // Matched card — dim
        fill(30, 80, 40, 120);
        stroke(0, 100, 50, 80);
        strokeWeight(1);
        rect(cx2, cy, cardSize, cardSize, 6);
        fill(0, 200, 80);
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(14);
        text(`${this.cards[i]}g ✓`, cx2 + cardSize / 2, cy + cardSize / 2);
      } else if (this.revealed[i]) {
        // Revealed card
        fill(250, 240, 220);
        stroke(200, 180, 100);
        strokeWeight(isSelected ? 3 : 1);
        rect(cx2, cy, cardSize, cardSize, 6);
        fill(40);
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(18);
        text(`${this.cards[i]}g`, cx2 + cardSize / 2, cy + cardSize / 2);
      } else {
        // Face-down card
        fill(70, 70, 100);
        stroke(isSelected ? color(255, 220, 50) : color(90, 90, 120));
        strokeWeight(isSelected ? 3 : 1);
        rect(cx2, cy, cardSize, cardSize, 6);
        fill(100, 100, 140);
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(20);
        text('?', cx2 + cardSize / 2, cy + cardSize / 2);
      }
    }

    // Info bar
    fill(200);
    noStroke();
    textAlign(CENTER, TOP);
    textSize(13);
    const fy = gridY + totalGH + 12;
    text(`Flips: ${this.flipsUsed}/${this.maxFlips}  |  Won: ${this.totalWon}g  |  Pairs: ${this.matchPairs}/8`, cx, fy);

    fill(140);
    textSize(11);
    text('Arrow keys to move  |  SPACE to flip', cx, fy + 22);

    pop();
  }
}

// ══════════════════════════════════════════════════════════
//  5. WHEEL OF FORTUNE
// ══════════════════════════════════════════════════════════
class WheelOfFortuneMinigame extends MinigameBase {
  start() {
    this.bet = this.config.bet || 25;
    this.segments = [
      { label: '−2×', multiplier: -2, weight: 3,  color: [90, 10, 10] },
      { label: '−1×', multiplier: -1, weight: 7,  color: [150, 20, 20] },
      { label: '×0',  multiplier: 0,  weight: 28, color: [200, 30, 30] },
      { label: '×½',  multiplier: 0.5,weight: 18, color: [200, 100, 30] },
      { label: '×1',  multiplier: 1,  weight: 20, color: [180, 180, 60] },
      { label: '×2',  multiplier: 2,  weight: 13, color: [60, 180, 60] },
      { label: '×3',  multiplier: 3,  weight: 6,  color: [30, 150, 200] },
      { label: '×5',  multiplier: 5,  weight: 3,  color: [140, 60, 200] },
      { label: '×10', multiplier: 10, weight: 2,  color: [255, 215, 0] },
    ];
    this.angle = Math.random() * TWO_PI;
    this.spinning = false;
    this.spinSpeed = 0;
    this.resultSegment = null;
    this._targetAngle = 0;
    this._totalSpin = 0;
    this._spinDuration = 0;
    this._spinElapsed = 0;
    this._startAngle = 0;
  }

  _buildForfeitResult() {
    // Can't quit once the wheel is spinning — wait for it to stop
    if (this.spinning) return null;
    // Refund the bet if they quit before spinning, lose it if result is already in
    if (this.resultSegment) return null;
    return { segment: 'Quit', multiplier: 1, bet: this.bet, winnings: this.bet, profit: 0 };
  }

  handleKeyInput(e) {
    if (this._done) return;
    if ((e.code === 'Space' || e.code === 'Enter') && !this.spinning) {
      e.preventDefault();
      this._startSpin();
    }
  }

  handleClickInput(e) {
    if (this._done || this.spinning) return;
    this._startSpin();
  }

  _startSpin() {
    this.spinning = true;
    // Pick the result first via weighted random
    this.resultSegment = this._weightedPick();
    const segIndex = this.segments.indexOf(this.resultSegment);
    const totalSegs = this.segments.length;
    const arcSize = TWO_PI / totalSegs;

    // The pointer is at the top (angle 0 = -HALF_PI in screen coords).
    // We want the target segment to end up under the pointer.
    // Segment i covers angle range [i*arcSize, (i+1)*arcSize] relative to wheel rotation.
    // The pointer reads the angle at -HALF_PI (top of circle).
    // Target: make the midpoint of the result segment align with -HALF_PI.
    const segMidAngle = segIndex * arcSize + arcSize / 2;
    // Where pointer is in wheel-space: (-HALF_PI - this.angle) mod TWO_PI
    // We need finalAngle such that: (-HALF_PI - finalAngle) mod TWO_PI = segMidAngle
    // => finalAngle = -HALF_PI - segMidAngle  (mod TWO_PI)
    let targetAngle = -HALF_PI - segMidAngle;
    // Add some randomness within the segment (so it doesn't always hit dead center)
    targetAngle += (Math.random() - 0.5) * arcSize * 0.7;
    // Normalize to [0, TWO_PI)
    targetAngle = ((targetAngle % TWO_PI) + TWO_PI) % TWO_PI;

    // Calculate how far we need to spin: at least 4 full rotations + distance to target
    const currentNorm = ((this.angle % TWO_PI) + TWO_PI) % TWO_PI;
    let delta = targetAngle - currentNorm;
    if (delta < 0) delta += TWO_PI;
    this._totalSpin = TWO_PI * (4 + Math.floor(Math.random() * 3)) + delta;
    this._spinDuration = 3000 + Math.random() * 1500; // 3-4.5 seconds
    this._spinElapsed = 0;
    this._startAngle = this.angle;
  }

  update(dt) {
    super.update(dt);
    if (this._done) return;
    if (!this.spinning) return;

    this._spinElapsed += dt;
    // Ease-out cubic: fast start, slow finish
    const t = Math.min(1, this._spinElapsed / this._spinDuration);
    const eased = 1 - Math.pow(1 - t, 3);
    this.angle = this._startAngle + this._totalSpin * eased;

    if (t >= 1) {
      this.spinning = false;
      // Finalize angle
      this.angle = this._startAngle + this._totalSpin;
      const winnings = Math.floor(this.bet * this.resultSegment.multiplier);
      this._result = {
        segment: this.resultSegment.label,
        multiplier: this.resultSegment.multiplier,
        bet: this.bet,
        winnings,
        profit: winnings - this.bet,
      };
      setTimeout(() => { this._done = true; }, 1500);
    }
  }

  _weightedPick() {
    const totalWeight = this.segments.reduce((s, seg) => s + seg.weight, 0);
    let r = Math.random() * totalWeight;
    for (const seg of this.segments) {
      r -= seg.weight;
      if (r <= 0) return seg;
    }
    return this.segments[this.segments.length - 1];
  }

  render() {
    this.drawOverlay(160);
    const p = this.drawPanel(400, 400, '🎡 Wheel of Fortune');

    push();
    resetMatrix();
    const cx = p.x + p.w / 2;
    const cy = p.y + 210;
    const radius = 120;

    // Draw wheel
    const totalSegs = this.segments.length;
    const arcSize = TWO_PI / totalSegs;

    for (let i = 0; i < totalSegs; i++) {
      const seg = this.segments[i];
      const startAngle = this.angle + i * arcSize;
      fill(seg.color[0], seg.color[1], seg.color[2]);
      stroke(40);
      strokeWeight(1);
      arc(cx, cy, radius * 2, radius * 2, startAngle, startAngle + arcSize, PIE);

      // Label
      const midAngle = startAngle + arcSize / 2;
      const labelR = radius * 0.65;
      const lx = cx + Math.cos(midAngle) * labelR;
      const ly = cy + Math.sin(midAngle) * labelR;
      fill(255);
      noStroke();
      textAlign(CENTER, CENTER);
      textSize(13);
      text(seg.label, lx, ly);
    }

    // Pointer at top of wheel
    fill(255, 220, 50);
    noStroke();
    triangle(cx - 10, cy - radius - 14, cx + 10, cy - radius - 14, cx, cy - radius + 4);

    // Center hub
    fill(60);
    stroke(100);
    strokeWeight(2);
    ellipse(cx, cy, 18, 18);

    // Result text
    if (this.resultSegment && !this.spinning) {
      fill(255, 220, 100);
      textSize(22);
      textAlign(CENTER, TOP);
      text(`${this.resultSegment.label}`, cx, cy + radius + 14);
      textSize(14);
      const winnings = Math.floor(this.bet * this.resultSegment.multiplier);
      if (winnings > this.bet) {
        fill(100, 255, 100);
        text(`Won ${winnings}g! (+${winnings - this.bet}g profit)`, cx, cy + radius + 40);
      } else if (winnings === this.bet) {
        fill(200, 200, 100);
        text(`Got your ${winnings}g back — break even!`, cx, cy + radius + 40);
      } else if (winnings > 0) {
        fill(200, 150, 80);
        text(`Won ${winnings}g (lost ${this.bet - winnings}g)`, cx, cy + radius + 40);
      } else if (winnings === 0) {
        fill(255, 80, 80);
        text(`Lost ${this.bet}g! Better luck next time...`, cx, cy + radius + 40);
      } else {
        // Negative multiplier — lost more than the bet
        const totalLoss = this.bet + Math.abs(winnings);
        fill(255, 30, 30);
        text(`OUCH! Lost ${totalLoss}g total!`, cx, cy + radius + 40);
      }
    }

    // Instructions
    if (!this.spinning && !this.resultSegment) {
      fill(160);
      textSize(13);
      textAlign(CENTER, TOP);
      text(`Bet: ${this.bet}g  —  Press SPACE or click to spin!`, cx, p.y + p.h - 30);
    } else if (this.spinning) {
      fill(200, 200, 100);
      textSize(13);
      textAlign(CENTER, TOP);
      text(`Spinning...`, cx, p.y + p.h - 30);
    }

    pop();
  }
}

// ══════════════════════════════════════════════════════════
//  6. BLUFF METER
// ══════════════════════════════════════════════════════════
class BluffMeterMinigame extends MinigameBase {
  start() {
    this.timeLimit = (this.config.timeLimit || 10) * 1000;
    this.targetBPM = 72; // ideal heartbeat rhythm (taps per minute)
    this.targetInterval = 60000 / this.targetBPM; // ms between taps
    this.tolerance = 200; // ms tolerance window
    this.taps = [];
    this.score = 0;
    this.maxTaps = 8;
    this.feedback = ''; // last tap feedback
    this._pulsePhase = 0;
  }

  handleKeyInput(e) {
    if (this._done) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      this._tap();
    }
  }

  handleClickInput(e) {
    if (this._done) return;
    this._tap();
  }

  _tap() {
    const now = this._elapsed;
    this.taps.push(now);

    if (this.taps.length >= 2) {
      const interval = now - this.taps[this.taps.length - 2];
      const diff = Math.abs(interval - this.targetInterval);

      if (diff < this.tolerance * 0.3) {
        this.score += 2;
        this.feedback = '♥ Perfect rhythm!';
      } else if (diff < this.tolerance) {
        this.score += 1;
        this.feedback = '♡ Good';
      } else if (interval < this.targetInterval * 0.5) {
        this.score -= 1;
        this.feedback = '💢 Too fast — nervous!';
      } else {
        this.score -= 1;
        this.feedback = '😰 Too slow — suspicious!';
      }
    } else {
      this.feedback = '♥ Tap to the heartbeat...';
    }

    if (this.taps.length >= this.maxTaps) {
      this._finish();
    }
  }

  _finish() {
    const maxScore = (this.maxTaps - 1) * 2;
    const ratio = Math.max(0, this.score / maxScore);
    this._result = {
      success: ratio >= 0.4,
      score: this.score,
      maxScore,
      ratio,
    };
    this._done = true;
  }

  update(dt) {
    super.update(dt);
    if (this._done) return;
    this._pulsePhase = (this._elapsed / this.targetInterval) % 1;
    if (this._elapsed >= this.timeLimit) {
      this._finish();
    }
  }

  render() {
    this.drawOverlay(180);
    const p = this.drawPanel(400, 280, '🫀 Stay Calm — Bluff Check');

    push();
    resetMatrix();
    const cx = p.x + p.w / 2;

    // Heartbeat visual guide
    const pulseY = p.y + 80;
    const pulseRadius = 30 + Math.sin(this._pulsePhase * TWO_PI) * 10;
    fill(180, 40, 40, 180);
    noStroke();
    ellipse(cx, pulseY, pulseRadius, pulseRadius);
    fill(220, 60, 60);
    textAlign(CENTER, CENTER);
    textSize(20);
    text('♥', cx, pulseY);

    // Tap count
    fill(200);
    noStroke();
    textAlign(CENTER, TOP);
    textSize(14);
    text(`Taps: ${this.taps.length} / ${this.maxTaps}`, cx, pulseY + 40);

    // Score bar
    const barW = 260;
    const barH = 20;
    const barX = cx - barW / 2;
    const barY = pulseY + 70;
    fill(50, 50, 60);
    rect(barX, barY, barW, barH, 6);
    const maxScore = (this.maxTaps - 1) * 2;
    const ratio = Math.max(0, Math.min(1, this.score / maxScore));
    const barColor = ratio > 0.6 ? color(0, 200, 80) : ratio > 0.3 ? color(255, 165, 0) : color(255, 50, 50);
    fill(barColor);
    rect(barX, barY, barW * ratio, barH, 6);
    fill(255);
    textSize(11);
    textAlign(CENTER, CENTER);
    text(`Confidence: ${Math.round(ratio * 100)}%`, cx, barY + barH / 2);

    // Feedback
    if (this.feedback) {
      fill(255, 220, 100);
      textSize(15);
      textAlign(CENTER, TOP);
      text(this.feedback, cx, barY + barH + 16);
    }

    // Timer
    const timeRatio = Math.max(0, 1 - this._elapsed / this.timeLimit);
    fill(50, 50, 60);
    noStroke();
    rect(p.x + 30, p.y + p.h - 30, p.w - 60, 8, 4);
    fill(timeRatio > 0.4 ? color(100, 100, 180) : color(255, 80, 80));
    rect(p.x + 30, p.y + p.h - 30, (p.w - 60) * timeRatio, 8, 4);

    fill(120);
    textSize(11);
    textAlign(CENTER, TOP);
    text('Tap SPACE in rhythm with the heartbeat — not too fast, not too slow!', cx, p.y + p.h - 18);

    pop();
  }
}

// ══════════════════════════════════════════════════════════
//  7. NAVIGATION DODGE
// ══════════════════════════════════════════════════════════
class NavigationDodgeMinigame extends MinigameBase {
  start() {
    this.timeLimit = (this.config.timeLimit || 12) * 1000;
    this.laneCount = 3;
    this.playerLane = 1; // center
    this.obstacles = [];
    this.spawnTimer = 0;
    this.spawnInterval = 800; // ms
    this.scrollSpeed = 0.3;  // px/ms
    this.hits = 0;
    this.maxHits = 3;
    this.dodged = 0;
    this._invulnTimer = 0;
  }

  handleKeyInput(e) {
    if (this._done) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      this.playerLane = Math.max(0, this.playerLane - 1);
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      this.playerLane = Math.min(this.laneCount - 1, this.playerLane + 1);
    }
  }

  update(dt) {
    super.update(dt);
    if (this._done) return;
    if (this._invulnTimer > 0) this._invulnTimer -= dt;

    // Spawn obstacles
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      const lane = Math.floor(Math.random() * this.laneCount);
      // Sometimes spawn 2 obstacles in different lanes
      this.obstacles.push({ lane, y: 0 });
      if (Math.random() < 0.3) {
        const lane2 = (lane + 1 + Math.floor(Math.random() * (this.laneCount - 1))) % this.laneCount;
        this.obstacles.push({ lane: lane2, y: 0 });
      }
      // Speed up over time
      this.spawnInterval = Math.max(400, 800 - this._elapsed * 0.03);
      this.scrollSpeed = 0.3 + this._elapsed * 0.00003;
    }

    // Move obstacles
    for (const obs of this.obstacles) {
      obs.y += this.scrollSpeed * dt;
    }

    // Collision check (obstacle in player lane near bottom)
    const hitZone = 0.75; // normalized Y where player sits
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];

      if (obs.y > 300) {
        // Past player — dodged
        this.dodged++;
        this.obstacles.splice(i, 1);
        continue;
      }

      if (obs.lane === this.playerLane && obs.y > 240 && obs.y < 290 && this._invulnTimer <= 0) {
        this.hits++;
        this._invulnTimer = 500;
        this.obstacles.splice(i, 1);
        if (this.hits >= this.maxHits) {
          this._result = { success: false, hits: this.hits, dodged: this.dodged };
          this._done = true;
          return;
        }
      }
    }

    // Time's up — survived!
    if (this._elapsed >= this.timeLimit) {
      this._result = { success: this.hits < this.maxHits, hits: this.hits, dodged: this.dodged };
      this._done = true;
    }
  }

  render() {
    this.drawOverlay(180);
    const p = this.drawPanel(300, 360, '🌊 Navigate!');

    push();
    resetMatrix();
    const cx = p.x + p.w / 2;
    const laneW = 70;
    const lanesStartX = cx - (this.laneCount * laneW) / 2;
    const trackY = p.y + 50;
    const trackH = 280;

    // Lanes
    for (let i = 0; i < this.laneCount; i++) {
      const lx = lanesStartX + i * laneW;
      fill(30, 50, 70, 200);
      stroke(50, 80, 110);
      strokeWeight(1);
      rect(lx, trackY, laneW, trackH);
    }

    // Obstacles
    for (const obs of this.obstacles) {
      const ox = lanesStartX + obs.lane * laneW + 10;
      const oy = trackY + obs.y;
      if (oy < trackY || oy > trackY + trackH - 20) continue;
      fill(200, 50, 50);
      noStroke();
      rect(ox, oy, laneW - 20, 25, 4);
      fill(255);
      textAlign(CENTER, CENTER);
      textSize(14);
      text('🪨', ox + (laneW - 20) / 2, oy + 12);
    }

    // Player boat
    const playerX = lanesStartX + this.playerLane * laneW + laneW / 2;
    const playerY = trackY + 260;
    const flash = this._invulnTimer > 0 && Math.floor(this._elapsed / 80) % 2;
    if (!flash) {
      fill(60, 160, 220);
      noStroke();
      triangle(playerX - 15, playerY + 15, playerX + 15, playerY + 15, playerX, playerY - 10);
      fill(255);
      textAlign(CENTER, CENTER);
      textSize(14);
      text('⛵', playerX, playerY + 2);
    }

    // HP display
    fill(200);
    noStroke();
    textAlign(CENTER, TOP);
    textSize(12);
    const hearts = '❤️'.repeat(this.maxHits - this.hits) + '🖤'.repeat(this.hits);
    text(hearts, cx, trackY + trackH + 4);

    // Timer
    const timeRatio = Math.max(0, 1 - this._elapsed / this.timeLimit);
    fill(50);
    rect(p.x + 20, p.y + p.h - 20, p.w - 40, 6, 3);
    fill(timeRatio > 0.3 ? color(60, 180, 220) : color(255, 80, 80));
    rect(p.x + 20, p.y + p.h - 20, (p.w - 40) * timeRatio, 6, 3);

    pop();
  }
}

// ── Global instance ──
var minigameManager = null; // Initialized in startNewGame
