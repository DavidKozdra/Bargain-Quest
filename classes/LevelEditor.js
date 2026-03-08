// ============================================================
// LevelEditor.js — Paint terrain, place cities & player start
// ============================================================

const CITY_PRESETS = {
  none:    { label: 'Default',          items: {} },
  port:    { label: 'Port City',        items: { Fish: 15, SaltedFish: 10, Wood: 8, Rope: 6 } },
  mining:  { label: 'Mining Town',      items: { Iron: 20, Coal: 15, Stone: 12 } },
  farming: { label: 'Farming Village',  items: { Wheat: 20, Bread: 15, Fruit: 10 } },
  market:  { label: 'Trade Hub',        items: { Silk: 6, Spice: 8, SpicedRum: 5 } },
};

class LevelEditor {
  constructor() {
    // Map dimensions
    this.cols = 60;
    this.rows = 60;
    this.tileSize = 32;

    // Grid: each cell = terrain type string
    this.grid = [];
    // Placed cities: [{x, y, name, items?}]
    this.cities = [];
    // Raider spawn points: [{x, y, type, strength, isPirate}]
    this.raiderSpawns = [];
    // Player start position
    this.playerStart = null;
    this.selectedCityIndex = -1;
    this.selectedRaiderIndex = -1;
    this.selectedPlayerStart = false;

    // Camera
    this.camX = 0;
    this.camY = 0;
    this.camZoom = 1;
    this._panning = false;
    this._panStartX = 0;
    this._panStartY = 0;
    this._camStartX = 0;
    this._camStartY = 0;

    // Tools: 'Water','Sand','Grass','Forest','Rock','Snow','inspect','city','playerStart','eraser','raiderSpawn'
    this.currentTool = 'Grass';
    this.brushSize = 1; // 1 = 1×1, 2 = 3×3, etc.

    // Raider spawn tool settings
    this.raiderSpawnType = 'bandit'; // 'bandit','dragon','blackKnight','wraith'
    this.raiderSpawnIsPirate = false;
    this.raiderSpawnStrength = 3;
    this.raiderSpawnName = ''; // optional custom name

    // Next city name (editable in sidebar)
    this.nextCityName = ''; // blank = auto-generate

    // City name counter
    this._cityNameIdx = 1;

    // Undo history
    this._undoStack = [];
    this._redoStack = [];
    this._currentStroke = null;
    this._currentStrokeSeen = null;
    this._lastPaintCell = null;

    this._initGrid();
  }

  /** Fill grid with default terrain */
  _initGrid() {
    this.grid = [];
    for (let i = 0; i < this.rows; i++) {
      this.grid[i] = [];
      for (let j = 0; j < this.cols; j++) {
        this.grid[i][j] = 'Water';
      }
    }
    this.cities = [];
    this.raiderSpawns = [];
    this.playerStart = null;
    this.selectedCityIndex = -1;
    this.selectedRaiderIndex = -1;
    this.selectedPlayerStart = false;
    this._cityNameIdx = 1;
    this._undoStack = [];
    this._redoStack = [];
    this._currentStroke = null;
    this._currentStrokeSeen = null;
    this._lastPaintCell = null;
  }

  /** Resize the map, preserving existing tiles where possible */
  resize(newCols, newRows) {
    const oldGrid = this.grid;
    const oldCols = this.cols;
    const oldRows = this.rows;
    this.cols = newCols;
    this.rows = newRows;
    this.grid = [];
    for (let i = 0; i < newRows; i++) {
      this.grid[i] = [];
      for (let j = 0; j < newCols; j++) {
        if (i < oldRows && j < oldCols) {
          this.grid[i][j] = oldGrid[i][j];
        } else {
          this.grid[i][j] = 'Water';
        }
      }
    }
    // Remove cities / raiderSpawns / playerStart outside bounds
    this.cities = this.cities.filter(c => c.x < newCols && c.y < newRows);
    this.raiderSpawns = this.raiderSpawns.filter(s => s.x < newCols && s.y < newRows);
    if (this.playerStart && (this.playerStart.x >= newCols || this.playerStart.y >= newRows)) {
      this.playerStart = null;
      this.selectedPlayerStart = false;
    }
    if (this.selectedCityIndex >= this.cities.length) this.selectedCityIndex = -1;
    if (this.selectedRaiderIndex >= this.raiderSpawns.length) this.selectedRaiderIndex = -1;
  }

  /** Centre camera on map */
  centreCamera() {
    this.camX = (this.cols * this.tileSize) / 2;
    this.camY = (this.rows * this.tileSize) / 2;
  }

  // ─── Input handlers ─────────────────────────────────────

  /** Convert screen px → grid coord */
  screenToGrid(sx, sy) {
    const wx = (sx - width / 2) / this.camZoom + this.camX;
    const wy = (sy - height / 2) / this.camZoom + this.camY;
    return {
      x: Math.floor(wx / this.tileSize),
      y: Math.floor(wy / this.tileSize),
    };
  }

  /** Start a paint stroke */
  onMousePressed(mx, my, btn) {
    // Right-click = pan
    if (btn === RIGHT) {
      this._panning = true;
      this._panStartX = mx;
      this._panStartY = my;
      this._camStartX = this.camX;
      this._camStartY = this.camY;
      return;
    }

    const { x, y } = this.screenToGrid(mx, my);
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;

    if (this.currentTool === 'inspect') {
      this.selectEntityAt(x, y);
    } else if (this.currentTool === 'city') {
      this._placeCity(x, y);
    } else if (this.currentTool === 'playerStart') {
      this.playerStart = { x, y };
      this.selectedPlayerStart = true;
      this.selectedCityIndex = -1;
      this.selectedRaiderIndex = -1;
      if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
    } else if (this.currentTool === 'raiderSpawn') {
      this._placeRaiderSpawn(x, y);
    } else if (this.currentTool === 'eraser') {
      this._startStroke();
      this._lastPaintCell = { x, y };
      this._paintTerrain(x, y, 'Water');
    } else {
      // Terrain brush
      this._startStroke();
      this._lastPaintCell = { x, y };
      this._paintTerrain(x, y, this.currentTool);
    }
  }

  onMouseDragged(mx, my) {
    if (this._panning) {
      const dx = (mx - this._panStartX) / this.camZoom;
      const dy = (my - this._panStartY) / this.camZoom;
      this.camX = this._camStartX - dx;
      this.camY = this._camStartY - dy;
      return;
    }

    const { x, y } = this.screenToGrid(mx, my);
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;

    if (this.currentTool === 'inspect' || this.currentTool === 'city' || this.currentTool === 'playerStart' || this.currentTool === 'raiderSpawn') return;

    const type = this.currentTool === 'eraser' ? 'Water' : this.currentTool;
    if (!this._currentStroke) this._startStroke();
    if (this._lastPaintCell) {
      this._paintLine(this._lastPaintCell.x, this._lastPaintCell.y, x, y, type);
    } else {
      this._paintTerrain(x, y, type);
    }
    this._lastPaintCell = { x, y };
  }

  onMouseReleased() {
    this._panning = false;
    if (this._currentStroke && this._currentStroke.length > 0) {
      this._undoStack.push(this._currentStroke);
      if (this._undoStack.length > 200) this._undoStack.shift();
      this._redoStack = [];
    }
    this._currentStroke = null;
    this._currentStrokeSeen = null;
    this._lastPaintCell = null;
  }

  onMouseWheel(delta) {
    this.camZoom = constrain(this.camZoom + (delta > 0 ? -0.08 : 0.08), 0.2, 3);
  }

  // ─── Terrain painting ───────────────────────────────────

  _startStroke() {
    this._currentStroke = [];
    this._currentStrokeSeen = new Set();
  }

  _paintTerrain(cx, cy, type) {
    const r = this.brushSize - 1;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) continue;
        const prev = this.grid[ny][nx];
        if (prev === type) continue;
        if (this._currentStroke) {
          const k = `${nx},${ny}`;
          if (!this._currentStrokeSeen || !this._currentStrokeSeen.has(k)) {
            this._currentStroke.push({ x: nx, y: ny, prev });
            if (this._currentStrokeSeen) this._currentStrokeSeen.add(k);
          }
        }
        this.grid[ny][nx] = type;
      }
    }
  }

  _paintLine(x0, y0, x1, y1, type) {
    let cx = x0;
    let cy = y0;
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
      this._paintTerrain(cx, cy, type);
      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        cx += sx;
      }
      if (e2 <= dx) {
        err += dx;
        cy += sy;
      }
    }
  }

  _placeCity(x, y) {
    // Can't place on water
    if (this.grid[y][x] === 'Water') return;
    // Existing city: select it (no destructive toggle behavior)
    const existing = this.cities.findIndex(c => c.x === x && c.y === y);
    if (existing >= 0) {
      this.selectedCityIndex = existing;
      this.selectedRaiderIndex = -1;
      this.selectedPlayerStart = false;
      if (typeof _editorOnCityChanged === 'function') _editorOnCityChanged(existing);
      if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
      return;
    }
    const name = (this.nextCityName && this.nextCityName.trim()) ? this.nextCityName.trim() : `City ${this._cityNameIdx++}`;
    this.cities.push({ x, y, name, preset: 'none', items: {} });
    this.selectedCityIndex = this.cities.length - 1;
    this.selectedRaiderIndex = -1;
    this.selectedPlayerStart = false;
    if (typeof _editorOnCityChanged === 'function') _editorOnCityChanged(this.selectedCityIndex);
    if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
  }

  /** Place or select a raider spawn point */
  _placeRaiderSpawn(x, y) {
    const existing = this.raiderSpawns.findIndex(s => s.x === x && s.y === y);
    if (existing >= 0) {
      this.selectedRaiderIndex = existing;
      this.selectedCityIndex = -1;
      this.selectedPlayerStart = false;
      if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
      return;
    }
    const rName = (this.raiderSpawnName && this.raiderSpawnName.trim()) ? this.raiderSpawnName.trim() : '';
    this.raiderSpawns.push({
      x, y,
      type: this.raiderSpawnType,
      strength: this.raiderSpawnStrength,
      isPirate: this.raiderSpawnIsPirate,
      name: rName,
    });
    this.selectedRaiderIndex = this.raiderSpawns.length - 1;
    this.selectedCityIndex = -1;
    this.selectedPlayerStart = false;
    if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
  }

  selectEntityAt(x, y) {
    const cityIdx = this.cities.findIndex(c => c.x === x && c.y === y);
    if (cityIdx >= 0) {
      this.selectedCityIndex = cityIdx;
      this.selectedRaiderIndex = -1;
      this.selectedPlayerStart = false;
      if (typeof _editorOnCityChanged === 'function') _editorOnCityChanged(cityIdx);
      if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
      return;
    }

    const raiderIdx = this.raiderSpawns.findIndex(s => s.x === x && s.y === y);
    if (raiderIdx >= 0) {
      this.selectedRaiderIndex = raiderIdx;
      this.selectedCityIndex = -1;
      this.selectedPlayerStart = false;
      if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
      return;
    }

    if (this.playerStart && this.playerStart.x === x && this.playerStart.y === y) {
      this.selectedPlayerStart = true;
      this.selectedCityIndex = -1;
      this.selectedRaiderIndex = -1;
      if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
      return;
    }

    this.selectedPlayerStart = false;
    this.selectedCityIndex = -1;
    this.selectedRaiderIndex = -1;
    if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
  }

  deleteSelectedEntity() {
    if (this.selectedCityIndex >= 0 && this.selectedCityIndex < this.cities.length) {
      this.cities.splice(this.selectedCityIndex, 1);
      this.selectedCityIndex = -1;
      if (typeof _editorOnCityChanged === 'function') _editorOnCityChanged();
      if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
      return true;
    }

    if (this.selectedRaiderIndex >= 0 && this.selectedRaiderIndex < this.raiderSpawns.length) {
      this.raiderSpawns.splice(this.selectedRaiderIndex, 1);
      this.selectedRaiderIndex = -1;
      if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
      return true;
    }

    if (this.selectedPlayerStart && this.playerStart) {
      this.playerStart = null;
      this.selectedPlayerStart = false;
      if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
      return true;
    }

    return false;
  }

  /** Undo last paint stroke */
  undo() {
    const stroke = this._undoStack.pop();
    if (!stroke) return;
    const redoStroke = [];
    for (let i = stroke.length - 1; i >= 0; i--) {
      const { x, y, prev } = stroke[i];
      redoStroke.push({ x, y, prev: this.grid[y][x] });
      this.grid[y][x] = prev;
    }
    this._redoStack.push(redoStroke);
    if (this._redoStack.length > 200) this._redoStack.shift();
  }

  redo() {
    const stroke = this._redoStack.pop();
    if (!stroke) return;
    const undoStroke = [];
    for (let i = stroke.length - 1; i >= 0; i--) {
      const { x, y, prev } = stroke[i];
      undoStroke.push({ x, y, prev: this.grid[y][x] });
      this.grid[y][x] = prev;
    }
    this._undoStack.push(undoStroke);
    if (this._undoStack.length > 200) this._undoStack.shift();
  }

  // ─── Fill tool ──────────────────────────────────────────

  floodFill(startX, startY, newType) {
    if (startX < 0 || startX >= this.cols || startY < 0 || startY >= this.rows) return;
    const oldType = this.grid[startY][startX];
    if (oldType === newType) return;
    const stroke = [];
    const stack = [[startX, startY]];
    const visited = new Set();
    while (stack.length > 0) {
      const [x, y] = stack.pop();
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) continue;
      if (this.grid[y][x] !== oldType) continue;
      stroke.push({ x, y, prev: oldType });
      this.grid[y][x] = newType;
      stack.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
    }
    if (stroke.length > 0) {
      this._undoStack.push(stroke);
      if (this._undoStack.length > 200) this._undoStack.shift();
    }
  }

  // ─── Rendering ──────────────────────────────────────────

  render() {
    background(10);

    push();
    translate(width / 2, height / 2);
    scale(this.camZoom);
    translate(-this.camX, -this.camY);

    // Visible tile range
    const halfW = width / 2 / this.camZoom;
    const halfH = height / 2 / this.camZoom;
    const startCol = Math.max(0, Math.floor((this.camX - halfW) / this.tileSize) - 1);
    const startRow = Math.max(0, Math.floor((this.camY - halfH) / this.tileSize) - 1);
    const endCol = Math.min(this.cols - 1, Math.ceil((this.camX + halfW) / this.tileSize) + 1);
    const endRow = Math.min(this.rows - 1, Math.ceil((this.camY + halfH) / this.tileSize) + 1);

    const ts = this.tileSize;
    const tileColors = {
      Water: '#0077BE', Sand: '#C2B280', Grass: '#5F9F35',
      Forest: '#22551C', Snow: '#F0F8FF', Rock: '#787878'
    };

    // Draw tiles
    noStroke();
    for (let i = startRow; i <= endRow; i++) {
      for (let j = startCol; j <= endCol; j++) {
        const type = this.grid[i][j];
        // Use sprites if available, else fallback
        if (SpriteSheet && SpriteSheet.tiles && SpriteSheet.tiles[type]) {
          image(SpriteSheet.tiles[type], j * ts, i * ts, ts, ts);
        } else {
          fill(tileColors[type] || '#000');
          rect(j * ts, i * ts, ts, ts);
        }
      }
    }

    // Grid lines
    stroke(0, 0, 0, 30);
    strokeWeight(0.5);
    for (let i = startRow; i <= endRow + 1; i++) {
      line(startCol * ts, i * ts, (endCol + 1) * ts, i * ts);
    }
    for (let j = startCol; j <= endCol + 1; j++) {
      line(j * ts, startRow * ts, j * ts, (endRow + 1) * ts);
    }
    noStroke();

    // Map boundary
    stroke(255, 200, 50, 120);
    strokeWeight(2);
    noFill();
    rect(0, 0, this.cols * ts, this.rows * ts);
    noStroke();

    // Draw cities
    for (const c of this.cities) {
      if (c.x < startCol - 1 || c.x > endCol + 1 || c.y < startRow - 1 || c.y > endRow + 1) continue;
      // City marker
      fill(255, 200, 50);
      noStroke();
      rect(c.x * ts + 2, c.y * ts + 2, ts - 4, ts - 4, 4);
      // Label
      fill(255);
      textAlign(CENTER, BOTTOM);
      textSize(10);
      text(c.name, c.x * ts + ts / 2, c.y * ts - 2);
    }
    if (this.selectedCityIndex >= 0 && this.selectedCityIndex < this.cities.length) {
      const c = this.cities[this.selectedCityIndex];
      noFill();
      stroke(255, 243, 133, 230);
      strokeWeight(2.4);
      rect(c.x * ts + 1.5, c.y * ts + 1.5, ts - 3, ts - 3, 6);
      noStroke();
    }

    // Draw player start
    if (this.playerStart) {
      const ps = this.playerStart;
      fill(100, 255, 100);
      noStroke();
      ellipse(ps.x * ts + ts / 2, ps.y * ts + ts / 2, ts * 0.7, ts * 0.7);
      fill(255);
      textAlign(CENTER, BOTTOM);
      textSize(10);
      text('START', ps.x * ts + ts / 2, ps.y * ts - 2);
      if (this.selectedPlayerStart) {
        noFill();
        stroke(180, 255, 190, 240);
        strokeWeight(2.6);
        ellipse(ps.x * ts + ts / 2, ps.y * ts + ts / 2, ts * 0.92, ts * 0.92);
        noStroke();
      }
    }

    // Draw raider spawn points
    const raiderColors = {
      bandit: [255, 80, 80],
      dragon: [255, 140, 0],
      blackKnight: [100, 0, 130],
      wraith: [140, 200, 255],
    };
    for (const s of this.raiderSpawns) {
      if (s.x < startCol - 1 || s.x > endCol + 1 || s.y < startRow - 1 || s.y > endRow + 1) continue;
      const c = raiderColors[s.type] || [255, 80, 80];
      // Skull-shaped marker
      fill(c[0], c[1], c[2], 200);
      stroke(0, 0, 0, 120);
      strokeWeight(1);
      ellipse(s.x * ts + ts / 2, s.y * ts + ts / 2, ts * 0.7, ts * 0.7);
      noStroke();
      // Pirate flag indicator
      if (s.isPirate) {
        fill(0);
        triangle(
          s.x * ts + ts * 0.3, s.y * ts + ts * 0.2,
          s.x * ts + ts * 0.7, s.y * ts + ts * 0.2,
          s.x * ts + ts * 0.5, s.y * ts + ts * 0.45
        );
      }
      // Label
      fill(255);
      textAlign(CENTER, BOTTOM);
      textSize(8);
      const rLabel = s.name ? s.name : (s.isPirate ? `🏴‍☠️ ${s.strength}` : `💀 ${s.strength}`);
      text(rLabel, s.x * ts + ts / 2, s.y * ts - 1);
    }
    if (this.selectedRaiderIndex >= 0 && this.selectedRaiderIndex < this.raiderSpawns.length) {
      const s = this.raiderSpawns[this.selectedRaiderIndex];
      noFill();
      stroke(255, 200, 120, 230);
      strokeWeight(2.4);
      ellipse(s.x * ts + ts / 2, s.y * ts + ts / 2, ts * 0.9, ts * 0.9);
      noStroke();
    }

    // Brush preview (cursor position) — only for terrain & eraser tools
    const _terrainTools = ['Water','Sand','Grass','Forest','Rock','Snow','eraser'];
    if (_terrainTools.includes(this.currentTool) && mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
      const { x: gx, y: gy } = this.screenToGrid(mouseX, mouseY);
      if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
        const r = this.brushSize - 1;
        noFill();
        stroke(255, 255, 255, 150);
        strokeWeight(1.5);
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = gx + dx;
            const ny = gy + dy;
            if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
              rect(nx * ts, ny * ts, ts, ts);
            }
          }
        }
        noStroke();
      }
    } else if (!_terrainTools.includes(this.currentTool) && mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
      // Single-tile highlight for placement tools
      const { x: gx, y: gy } = this.screenToGrid(mouseX, mouseY);
      if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
        noFill();
        stroke(255, 255, 100, 180);
        strokeWeight(2);
        rect(gx * ts, gy * ts, ts, ts);
        noStroke();
      }
    }

    pop();

    // HUD: coordinates
    const { x: hx, y: hy } = this.screenToGrid(mouseX, mouseY);
    if (typeof _refreshEditorHud === 'function') {
      _refreshEditorHud({ x: hx, y: hy });
    }
    push();
    fill(255, 255, 255, 180);
    noStroke();
    textAlign(LEFT, BOTTOM);
    textSize(12);
    text(`Tile: ${hx}, ${hy}  |  Zoom: ${Math.round(this.camZoom * 100)}%  |  ${this.cols}×${this.rows}`, 10, height - 10);
    pop();
  }

  // ─── Continuous camera pan (called every frame) ─────────

  updateCamera() {
    const panSpeed = 300 * (deltaTime / 1000) / this.camZoom;
    const down = (action, fallbackCodes) => {
      if (typeof isActionDown === 'function') return isActionDown(action);
      return fallbackCodes.some((k) => keyIsDown(k));
    };
    if (down('moveUp', [87, UP_ARROW])) this.camY -= panSpeed;
    if (down('moveDown', [83, DOWN_ARROW])) this.camY += panSpeed;
    if (down('moveLeft', [65, LEFT_ARROW])) this.camX -= panSpeed;
    if (down('moveRight', [68, RIGHT_ARROW])) this.camX += panSpeed;
  }

  // ─── Keyboard shortcuts ─────────────────────────────────

  handleKey(kCode) {
    // Single-press actions only (panning is in updateCamera now)

    // Ctrl+Z undo (use binding check; still require Ctrl modifier)
    if (isActionKey('editorUndo', kCode) && (keyIsDown(17) || keyIsDown(91))) {
      this.undo();
      return;
    }

    // Ctrl+Y redo
    if (kCode === 89 && (keyIsDown(17) || keyIsDown(91))) {
      this.redo();
      return;
    }

    // Delete selected entity
    if (kCode === DELETE || kCode === BACKSPACE) {
      this.deleteSelectedEntity();
      return;
    }

    // Fast tool hotkeys
    const toolHotkeys = {
      81: 'Water',      // Q
      69: 'Sand',       // E
      82: 'Grass',      // R
      84: 'Forest',     // T
      89: 'Rock',       // Y
      85: 'Snow',       // U
      73: 'inspect',    // I
      67: 'city',       // C
      80: 'playerStart',// P
      75: 'raiderSpawn',// K
      88: 'eraser',     // X
    };
    if (toolHotkeys[kCode]) {
      this.currentTool = toolHotkeys[kCode];
      if (typeof _highlightEditorTool === 'function') _highlightEditorTool(this.currentTool);
      return;
    }

    // Number keys for brush size (1-9)
    if (kCode >= 49 && kCode <= 57) {
      this.brushSize = kCode - 48;
      if (typeof _highlightEditorBrush === 'function') _highlightEditorBrush(this.brushSize);
      return;
    }

    // [ and ] adjust brush size
    if (kCode === 219) {
      this.brushSize = Math.max(1, this.brushSize - 1);
      if (typeof _highlightEditorBrush === 'function') _highlightEditorBrush(this.brushSize);
      return;
    }
    if (kCode === 221) {
      this.brushSize = Math.min(20, this.brushSize + 1);
      if (typeof _highlightEditorBrush === 'function') _highlightEditorBrush(this.brushSize);
      return;
    }

    // F = flood fill at cursor
    if (isActionKey('editorFlood', kCode)) {
      const { x, y } = this.screenToGrid(mouseX, mouseY);
      const type = (this.currentTool === 'eraser') ? 'Water' : this.currentTool;
      if (['Water', 'Sand', 'Grass', 'Forest', 'Rock', 'Snow'].includes(type)) {
        this.floodFill(x, y, type);
      }
      return;
    }
  }

  getValidationReport() {
    const warnings = [];
    let waterTiles = 0;
    let landTiles = 0;
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    const passable = (x, y) => this.grid[y]?.[x] && this.grid[y][x] !== 'Water';

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.grid[y][x] === 'Water') waterTiles++;
        else landTiles++;
      }
    }

    if (this.cities.length === 0) warnings.push({ level: 'error', text: 'No cities placed.' });
    if (!this.playerStart) warnings.push({ level: 'error', text: 'Player start is not placed.' });
    if (this.playerStart && !passable(this.playerStart.x, this.playerStart.y)) {
      warnings.push({ level: 'error', text: 'Player start is on water.' });
    }

    let coastalCities = 0;
    for (const c of this.cities) {
      if (!passable(c.x, c.y)) {
        warnings.push({ level: 'error', text: `City "${c.name}" is on water.` });
        continue;
      }
      for (const [dx, dy] of dirs) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows && this.grid[ny][nx] === 'Water') {
          coastalCities++;
          break;
        }
      }
    }
    if (this.cities.length > 0 && coastalCities === 0) {
      warnings.push({ level: 'warn', text: 'No coastal cities found (boat gameplay may be limited).' });
    }

    for (const s of this.raiderSpawns) {
      const onWater = this.grid[s.y]?.[s.x] === 'Water';
      if (s.isPirate && !onWater) warnings.push({ level: 'warn', text: `Pirate spawn at ${s.x},${s.y} is not on water.` });
      if (!s.isPirate && onWater) warnings.push({ level: 'warn', text: `Land raider spawn at ${s.x},${s.y} is on water.` });
    }

    // Count disconnected land regions
    const seen = new Set();
    let landRegions = 0;
    const flood = (sx, sy, stopAtCity = false) => {
      const q = [[sx, sy]];
      seen.add(`${sx},${sy}`);
      const reached = new Set();
      while (q.length) {
        const [x, y] = q.shift();
        reached.add(`${x},${y}`);
        if (stopAtCity && this.cities.some(c => c.x === x && c.y === y)) return { reachedCity: true, reached };
        for (const [dx, dy] of dirs) {
          const nx = x + dx, ny = y + dy;
          const key = `${nx},${ny}`;
          if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) continue;
          if (!passable(nx, ny) || seen.has(key)) continue;
          seen.add(key);
          q.push([nx, ny]);
        }
      }
      return { reachedCity: false, reached };
    };

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const key = `${x},${y}`;
        if (!passable(x, y) || seen.has(key)) continue;
        landRegions++;
        flood(x, y);
      }
    }
    if (landRegions > 1) {
      warnings.push({ level: 'warn', text: `Map has ${landRegions} disconnected landmasses.` });
    }

    if (this.playerStart && this.cities.length > 0 && passable(this.playerStart.x, this.playerStart.y)) {
      // Reachability from start to any city through land path
      const v = new Set([`${this.playerStart.x},${this.playerStart.y}`]);
      const q = [[this.playerStart.x, this.playerStart.y]];
      let cityReachable = this.cities.some(c => c.x === this.playerStart.x && c.y === this.playerStart.y);
      while (!cityReachable && q.length) {
        const [x, y] = q.shift();
        for (const [dx, dy] of dirs) {
          const nx = x + dx, ny = y + dy;
          const key = `${nx},${ny}`;
          if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) continue;
          if (!passable(nx, ny) || v.has(key)) continue;
          v.add(key);
          if (this.cities.some(c => c.x === nx && c.y === ny)) {
            cityReachable = true;
            break;
          }
          q.push([nx, ny]);
        }
      }
      if (!cityReachable) warnings.push({ level: 'warn', text: 'No land path from player start to any city.' });
    }

    return {
      warnings,
      stats: {
        mapSize: `${this.cols}x${this.rows}`,
        landTiles,
        waterTiles,
        waterPct: Math.round((waterTiles / Math.max(1, this.cols * this.rows)) * 100),
        cityCount: this.cities.length,
        raiderCount: this.raiderSpawns.length,
        landRegions,
      }
    };
  }

  // ─── Save / Load custom map to localStorage ────────────

  saveToStorage(slotName) {
    const data = {
      cols: this.cols,
      rows: this.rows,
      grid: this.grid,
      cities: this.cities,
      raiderSpawns: this.raiderSpawns,
      playerStart: this.playerStart,
    };
    localStorage.setItem(`editorMap_${slotName}`, JSON.stringify(data));
  }

  loadFromStorage(slotName) {
    const raw = localStorage.getItem(`editorMap_${slotName}`);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      this.cols = data.cols;
      this.rows = data.rows;
      this.grid = data.grid;
      // Backwards-compat: older saves lack preset/items fields
      this.cities = (data.cities || []).map(c => ({
        ...c,
        preset: c.preset || 'none',
        items:  c.items  || {},
      }));
      this.raiderSpawns = data.raiderSpawns || [];
      this.playerStart = data.playerStart || null;
      this._cityNameIdx = this.cities.length + 1;
      this._undoStack = [];
      return true;
    } catch (e) {
      console.error('Failed to load editor map:', e);
      return false;
    }
  }

  /** Apply a city preset to a placed city by index */
  setCityPreset(cityIdx, presetKey) {
    const city = this.cities[cityIdx];
    if (!city || !CITY_PRESETS[presetKey]) return;
    city.preset = presetKey;
    city.items  = { ...CITY_PRESETS[presetKey].items };
  }

  /** Return preset options for UI dropdowns */
  getPresetLabels() {
    return Object.entries(CITY_PRESETS).map(([key, v]) => ({ key, label: v.label }));
  }

  /** List available saved maps */
  static listSavedMaps() {
    const maps = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('editorMap_')) {
        maps.push(key.replace('editorMap_', ''));
      }
    }
    return maps;
  }

  static deleteSavedMap(slotName) {
    localStorage.removeItem(`editorMap_${slotName}`);
  }

  // ─── Export to game world ───────────────────────────────

  /**
   * Build the global grid/elevationMap/etc from editor data
   * and start a game. Returns the config needed by startNewGame.
   */
  exportToGame() {
    // Validation
    if (this.cities.length === 0) {
      return { error: 'Place at least one city before playing!' };
    }

    // Build the global arrays
    cols = this.cols;
    rows = this.rows;
    grid = [];
    elevationMap = [];
    difficultyMap = [];
    temperatureMap = [];

    const elevForType = {
      Water: 0.3, Sand: 0.45, Grass: 0.55,
      Forest: 0.6, Rock: 0.75, Snow: 0.9
    };
    const baseDiffMap = {
      Water: 5, Sand: 2, Grass: 1, Forest: 3, Snow: 4, Rock: 6
    };

    for (let i = 0; i < this.rows; i++) {
      grid[i] = [];
      elevationMap[i] = [];
      difficultyMap[i] = [];
      temperatureMap[i] = [];
      for (let j = 0; j < this.cols; j++) {
        const type = this.grid[i][j];
        grid[i][j] = { options: [type], collapsed: true };
        const e = elevForType[type] || 0.5;
        elevationMap[i][j] = e + (Math.random() * 0.05 - 0.025);
        const lat = i / this.rows;
        temperatureMap[i][j] = 1.0 - Math.abs(lat - 0.5) * 2;
        difficultyMap[i][j] = (baseDiffMap[type] || 1) + e * 5;
      }
    }

    // Place decorations
    if (typeof placeDecorations === 'function') placeDecorations();

    // Build city objects
    const namePool = NameGenerator.generateNames(Math.max(80, this.cities.length + 20));
    let nameIdx = 0;
    const exportedCities = [];
    for (let idx = 0; idx < this.cities.length; idx++) {
      const ec = this.cities[idx];
      const name = (ec.name && ec.name.trim()) ? ec.name.trim() : (nameIdx < namePool.length ? namePool[nameIdx++] : `City ${idx + 1}`);
      const population = Math.floor(Math.random() * 900 + 300);
      const city = new City({ name, location: { x: ec.x, y: ec.y }, population });
      // Apply editor-placed items to the city
      if (ec.items) {
        for (const [itemKey, qty] of Object.entries(ec.items)) {
          if (qty > 0) city._addOrIncrement(itemKey, qty);
        }
      }
      exportedCities.push(city);
    }

    // Detect coastal cities
    City.detectCoastalCities(exportedCities, grid, rows, cols);

    // Build raider spawn data for RaiderManager
    const exportedRaiderSpawns = this.raiderSpawns.map(s => ({
      x: s.x,
      y: s.y,
      type: s.type,
      strength: s.strength,
      isPirate: s.isPirate,
      name: s.name || '',
    }));

    // Player start
    let startX, startY;
    if (this.playerStart) {
      startX = this.playerStart.x;
      startY = this.playerStart.y;
    } else {
      // Default to first city location
      startX = this.cities[0].x;
      startY = this.cities[0].y;
    }

    return {
      cities: exportedCities,
      raiderSpawns: exportedRaiderSpawns,
      startX,
      startY,
    };
  }
}

// Singleton
var levelEditor = null;
