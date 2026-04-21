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

function _bqCloneLevelEditorValue(value) {
  if (Array.isArray(value)) return value.map(_bqCloneLevelEditorValue);
  if (value && Object.prototype.toString.call(value) === '[object Object]') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = _bqCloneLevelEditorValue(value[key]);
    return out;
  }
  return value;
}

function _bqWorldEditorLib() {
  if (typeof window === 'undefined') return null;
  return window.KozEngine?.World || null;
}

function _bqClampLevelEditorNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function _bqNormalizeLevelEditorWorldGenConfig(worldGenerators, rawCfg) {
  if (worldGenerators && typeof worldGenerators.normalizeWorldGenConfig === 'function') {
    return worldGenerators.normalizeWorldGenConfig(rawCfg);
  }

  const raw = (rawCfg && typeof rawCfg === 'object') ? rawCfg : {};
  return {
    warp: _bqClampLevelEditorNumber(raw.warp, 1.0, 0, 2),
    ruggedness: _bqClampLevelEditorNumber(raw.ruggedness, 1.0, 0.5, 2),
    temperatureVariance: _bqClampLevelEditorNumber(raw.temperatureVariance, 1.0, 0, 2),
    moistureVariance: _bqClampLevelEditorNumber(raw.moistureVariance, 1.0, 0, 2),
    coastalDropoff: _bqClampLevelEditorNumber(raw.coastalDropoff, 1.0, 0.4, 2.2),
  };
}

function _bqTerrainMixToLandmass(terrainMix) {
  if (terrainMix === 'archipelago') return 0;
  if (terrainMix === 'inland') return 2;
  return 1;
}

function _bqNormalizeLevelEditorLandmass(worldGenerators, value, terrainMix) {
  if (worldGenerators && typeof worldGenerators.normalizeLandmassMode === 'function') {
    return worldGenerators.normalizeLandmassMode(value, _bqTerrainMixToLandmass(terrainMix));
  }

  const landmass = Math.floor(Number(value));
  if (landmass === 0 || landmass === 1 || landmass === 2) return landmass;
  return _bqTerrainMixToLandmass(terrainMix);
}

function _bqCreateLevelEditorRng(seed) {
  let state = ((Number(seed) >>> 0) || 0x9e3779b9) >>> 0;

  return {
    random() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 4294967296;
    },
    shuffle(list) {
      const out = Array.isArray(list) ? list.slice() : [];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    int(min, max) {
      const lo = Math.floor(Math.min(min, max));
      const hi = Math.floor(Math.max(min, max));
      return lo + Math.floor(this.random() * (hi - lo + 1));
    },
  };
}

function _bqIsLevelEditorLand(type) {
  return typeof type === 'string' && type !== 'Water';
}

class LevelEditor {
  constructor() {
    // Map dimensions
    this.cols = 60;
    this.rows = 60;
    this.tileSize = 32;

    this.grid = [];
    this.cities = [];
    this.raiderSpawns = [];
    this.playerStart = null;
    this._selectedCityIndex = -1;
    this._selectedRaiderIndex = -1;
    this._selectedPlayerStart = false;

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
    this.raiderSpawnType = 'bandit'; // 'bandit','dragon','blackKnight','wraith','sandWorm','iceGolem','voidHound','thornBeast','magmaSerpent','grazer'
    this.raiderSpawnIsPirate = false;
    this.raiderSpawnStrength = 3;
    this.raiderSpawnName = ''; // optional custom name

    // Next city name (editable in sidebar)
    this.nextCityName = ''; // blank = auto-generate

    // City name counter
    this._cityNameIdx = 1;

    this._lastPaintCell = null;
    this._worldLib = _bqWorldEditorLib();
    this._world = null;
    this._editor = null;
    this.lastGeneratedMapConfig = null;

    Object.defineProperties(this, {
      selectedCityIndex: {
        enumerable: true,
        get: () => this._selectedCityIndex,
        set: (value) => this._setSelectionByKindIndex('city', value),
      },
      selectedRaiderIndex: {
        enumerable: true,
        get: () => this._selectedRaiderIndex,
        set: (value) => this._setSelectionByKindIndex('raiderSpawn', value),
      },
      selectedPlayerStart: {
        enumerable: true,
        get: () => this._selectedPlayerStart,
        set: (value) => this._setPlayerStartSelection(value),
      },
    });

    this._createWorldRuntime();
    this._initGrid();
  }

  _createWorldRuntime() {
    if (!this._worldLib?.worldSpace || !this._worldLib?.worldEditor) {
      throw new Error('KozEngine.World worldSpace/worldEditor must be loaded before LevelEditor.');
    }
    this._world = this._worldLib.worldSpace.createWorldSpace({
      cols: this.cols,
      rows: this.rows,
      defaultCell: 'Water',
    });
    this._editor = this._worldLib.worldEditor.createWorldEditor({ world: this._world });
    this._syncPublicState();
  }

  _syncPublicState() {
    this.grid = this._world ? this._world.grid : [];
    this.cities = this._editor ? this._editor.listElements('city') : [];
    this.raiderSpawns = this._editor ? this._editor.listElements('raiderSpawn') : [];
    this.playerStart = this._editor ? (this._editor.listElements('playerStart')[0] || null) : null;

    const selected = this._editor ? this._editor.getSelectedElement() : null;
    this._selectedCityIndex = -1;
    this._selectedRaiderIndex = -1;
    this._selectedPlayerStart = false;

    if (!selected) return;
    if (selected.kind === 'city') {
      this._selectedCityIndex = this.cities.findIndex(c => c.id === selected.id);
    } else if (selected.kind === 'raiderSpawn') {
      this._selectedRaiderIndex = this.raiderSpawns.findIndex(s => s.id === selected.id);
    } else if (selected.kind === 'playerStart') {
      this._selectedPlayerStart = true;
    }
  }

  _setSelectionByKindIndex(kind, value) {
    if (!this._editor) {
      if (kind === 'city') this._selectedCityIndex = value;
      else this._selectedRaiderIndex = value;
      return;
    }

    const current = this._editor.getSelectedElement();
    const index = Math.floor(Number(value));
    const list = kind === 'city' ? this.cities : this.raiderSpawns;
    if (!Number.isFinite(index) || index < 0 || index >= list.length) {
      if (current && current.kind === kind) this._editor.clearSelection();
      this._syncPublicState();
      return;
    }

    this._editor.selectElementById(list[index].id);
    this._syncPublicState();
  }

  _setPlayerStartSelection(value) {
    if (!this._editor) {
      this._selectedPlayerStart = !!value;
      return;
    }

    const current = this._editor.getSelectedElement();
    if (!value) {
      if (current && current.kind === 'playerStart') this._editor.clearSelection();
      this._syncPublicState();
      return;
    }

    if (this.playerStart) this._editor.selectElementById(this.playerStart.id);
    this._syncPublicState();
  }

  _setPlayerStart(x, y) {
    this._editor.placeElement('playerStart', x, y, {}, {
      uniqueKind: true,
      select: true,
    });
    this._syncPublicState();
  }

  _initGrid() {
    this._world.resize(this.cols, this.rows, { defaultCell: 'Water' });
    this._world.fillCells('Water');
    this._world.clearElements();
    this._editor.clearHistory();
    this._editor.clearSelection();
    this._cityNameIdx = 1;
    this._lastPaintCell = null;
    this._syncPublicState();
  }

  /** Resize the map, preserving existing tiles where possible */
  resize(newCols, newRows) {
    this.cols = newCols;
    this.rows = newRows;
    this._world.resize(newCols, newRows, { defaultCell: 'Water' });
    this._syncPublicState();
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
      this._setPlayerStart(x, y);
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
    if (this._lastPaintCell) {
      this._paintLine(this._lastPaintCell.x, this._lastPaintCell.y, x, y, type);
    } else {
      this._paintTerrain(x, y, type);
    }
    this._lastPaintCell = { x, y };
  }

  onMouseReleased() {
    this._panning = false;
    this._editor.endStroke();
    this._lastPaintCell = null;
    this._syncPublicState();
  }

  onMouseWheel(delta) {
    this.camZoom = constrain(this.camZoom + (delta > 0 ? -0.08 : 0.08), 0.2, 3);
  }

  // ─── Terrain painting ───────────────────────────────────

  _startStroke() {
    this._editor.beginStroke();
  }

  _paintTerrain(cx, cy, type) {
    this._editor.paintArea(cx, cy, type, { brushSize: this.brushSize });
    this._syncPublicState();
  }

  _paintLine(x0, y0, x1, y1, type) {
    this._editor.paintLine(x0, y0, x1, y1, type, { brushSize: this.brushSize });
    this._syncPublicState();
  }

  _placeCity(x, y) {
    if (this.grid[y][x] === 'Water') return;
    const existing = this.cities.findIndex(c => c.x === x && c.y === y);
    if (existing >= 0) {
      this._editor.selectElementById(this.cities[existing].id);
      this._syncPublicState();
      if (typeof _editorOnCityChanged === 'function') _editorOnCityChanged(existing);
      if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
      return;
    }
    const name = (this.nextCityName && this.nextCityName.trim()) ? this.nextCityName.trim() : `City ${this._cityNameIdx++}`;
    this._editor.placeElement('city', x, y, { name, preset: 'none', items: {} }, {
      uniqueKindPerTile: true,
      select: true,
      allowPlacement: () => this.grid[y][x] !== 'Water',
    });
    this._syncPublicState();
    if (typeof _editorOnCityChanged === 'function') _editorOnCityChanged(this.selectedCityIndex);
    if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
  }

  /** Place or select a raider spawn point */
  _placeRaiderSpawn(x, y) {
    const existing = this.raiderSpawns.findIndex(s => s.x === x && s.y === y);
    if (existing >= 0) {
      this._editor.selectElementById(this.raiderSpawns[existing].id);
      this._syncPublicState();
      if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
      return;
    }
    const rName = (this.raiderSpawnName && this.raiderSpawnName.trim()) ? this.raiderSpawnName.trim() : '';
    this._editor.placeElement('raiderSpawn', x, y, {
      type: this.raiderSpawnType,
      strength: this.raiderSpawnStrength,
      isPirate: this.raiderSpawnIsPirate,
      name: rName,
    }, {
      uniqueKindPerTile: true,
      select: true,
    });
    this._syncPublicState();
    if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
  }

  selectEntityAt(x, y) {
    const selected = this._editor.selectElementAt(x, y, ['city', 'raiderSpawn', 'playerStart']);
    this._syncPublicState();
    if (selected && selected.kind === 'city' && typeof _editorOnCityChanged === 'function') {
      _editorOnCityChanged(this.selectedCityIndex);
    }
    if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
  }

  deleteSelectedEntity() {
    const removed = this._editor.deleteSelection();
    if (!removed) return false;
    this._syncPublicState();
    if (removed.kind === 'city') {
      if (typeof _editorOnCityChanged === 'function') _editorOnCityChanged();
      if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
      return true;
    }
    if (typeof _editorOnSelectionChanged === 'function') _editorOnSelectionChanged();
    return true;
  }

  /** Undo last paint stroke */
  undo() {
    if (!this._editor.undo()) return;
    this._syncPublicState();
  }

  redo() {
    if (!this._editor.redo()) return;
    this._syncPublicState();
  }

  // ─── Fill tool ──────────────────────────────────────────

  floodFill(startX, startY, newType) {
    if (!this._editor.floodFill(startX, startY, newType)) return;
    this._syncPublicState();
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
      sandWorm: [212, 176, 96],
      iceGolem: [175, 225, 255],
      voidHound: [104, 84, 190],
      thornBeast: [108, 160, 76],
      magmaSerpent: [214, 72, 34],
      grazer: [144, 180, 118],
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

    this._renderMinimap();
  }

  _renderMinimap() {
    const MM_W = 160;
    const MM_H = Math.round(MM_W * (this.rows / this.cols));
    const clampedH = Math.min(MM_H, 120);
    const scaleX = MM_W / this.cols;
    const scaleY = clampedH / this.rows;

    const PAD = 8;
    const ox = width - MM_W - PAD;
    // Place below the topbar so it is never covered
    const topbar = document.getElementById('editorTopBar');
    const topbarBottom = topbar ? topbar.getBoundingClientRect().bottom : 0;
    const oy = topbarBottom + PAD;

    push();
    // Background
    fill(10, 10, 20, 200);
    stroke(180, 160, 80, 180);
    strokeWeight(1);
    rect(ox - 1, oy - 1, MM_W + 2, clampedH + 2, 3);

    noStroke();
    const tileColors = {
      Water: [0, 119, 190],
      Sand:  [194, 178, 128],
      Grass: [95, 159, 53],
      Forest:[34, 85, 28],
      Rock:  [120, 120, 120],
      Snow:  [220, 232, 255],
    };
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const type = this.grid[row][col];
        const c = tileColors[type] || [60, 60, 60];
        fill(c[0], c[1], c[2]);
        rect(ox + col * scaleX, oy + row * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
      }
    }

    // Cities
    fill(255, 220, 60);
    noStroke();
    for (const c of this.cities) {
      ellipse(ox + c.x * scaleX + scaleX / 2, oy + c.y * scaleY + scaleY / 2, Math.max(3, scaleX * 2), Math.max(3, scaleY * 2));
    }

    // Player start
    if (this.playerStart) {
      fill(80, 255, 80);
      ellipse(ox + this.playerStart.x * scaleX + scaleX / 2, oy + this.playerStart.y * scaleY + scaleY / 2, Math.max(3, scaleX * 2), Math.max(3, scaleY * 2));
    }

    // Viewport rect
    const vpHalfW = (width / 2) / this.camZoom / this.tileSize;
    const vpHalfH = (height / 2) / this.camZoom / this.tileSize;
    const vpCX = this.camX / this.tileSize;
    const vpCY = this.camY / this.tileSize;
    noFill();
    stroke(255, 255, 255, 160);
    strokeWeight(1);
    rect(
      ox + (vpCX - vpHalfW) * scaleX,
      oy + (vpCY - vpHalfH) * scaleY,
      vpHalfW * 2 * scaleX,
      vpHalfH * 2 * scaleY
    );

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

  buildWorldSnapshot() {
    return {
      cols: this.cols,
      rows: this.rows,
      grid: _bqCloneLevelEditorValue(this.grid),
      elements: [
        ...this.cities.map(city => _bqCloneLevelEditorValue({ ...city, kind: 'city' })),
        ...this.raiderSpawns.map(spawn => _bqCloneLevelEditorValue({ ...spawn, kind: 'raiderSpawn' })),
        ...(this.playerStart ? [_bqCloneLevelEditorValue({ ...this.playerStart, kind: 'playerStart' })] : []),
      ],
    };
  }

  loadWorldSnapshot(snapshot) {
    const source = snapshot || {};
    this.cols = Number.isFinite(Number(source.cols)) ? Math.floor(Number(source.cols)) : this.cols;
    this.rows = Number.isFinite(Number(source.rows)) ? Math.floor(Number(source.rows)) : this.rows;

    let elements = [];
    if (Array.isArray(source.elements) && source.elements.length > 0) {
      elements = source.elements.map(_bqCloneLevelEditorValue).map(element => {
        if (element.kind === 'city') {
          element.preset = element.preset || 'none';
          element.items = element.items || {};
        }
        return element;
      });
    } else {
      elements = [
        ...((source.cities || []).map(city => ({
          ..._bqCloneLevelEditorValue(city),
          kind: 'city',
          preset: city.preset || 'none',
          items: city.items || {},
        }))),
        ...((source.raiderSpawns || []).map(spawn => ({
          ..._bqCloneLevelEditorValue(spawn),
          kind: 'raiderSpawn',
        }))),
        ...(source.playerStart ? [{ ..._bqCloneLevelEditorValue(source.playerStart), kind: 'playerStart' }] : []),
      ];
    }

    this._world.replaceState({
      cols: this.cols,
      rows: this.rows,
      defaultCell: 'Water',
      grid: source.grid || [],
      elements: elements,
    });
    this._editor.clearHistory();
    this._editor.clearSelection();
    this._syncPublicState();
    this._cityNameIdx = this.cities.length + 1;
  }

  saveToStorage(slotName) {
    const data = {
      ...this.buildWorldSnapshot(),
      cities: _bqCloneLevelEditorValue(this.cities),
      raiderSpawns: _bqCloneLevelEditorValue(this.raiderSpawns),
      playerStart: _bqCloneLevelEditorValue(this.playerStart),
    };
    localStorage.setItem(`editorMap_${slotName}`, JSON.stringify(data));
  }

  loadFromStorage(slotName) {
    const raw = localStorage.getItem(`editorMap_${slotName}`);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      this.loadWorldSnapshot(data);
      return true;
    } catch (e) {
      console.error('Failed to load editor map:', e);
      return false;
    }
  }

  /**
   * Legacy procedural generator retained as a fallback if shared terrain
   * modules are unavailable.
   * @param {object} opts
   * @param {number} opts.landPct   0–100 target % land tiles
   * @param {number} opts.cityCount number of cities to scatter
   * @param {number} opts.raiderCount number of raider spawns
   * @param {string} opts.terrainMix 'coastal'|'inland'|'archipelago'
   */
  _generateLegacyMap({ landPct = 40, cityCount = 4, raiderCount = 3, terrainMix = 'coastal' } = {}) {
    this._initGrid();

    const cols = this.cols;
    const rows = this.rows;
    const targetLand = Math.round((landPct / 100) * cols * rows);

    // ── 1. Noise-based terrain ───────────────────────────────
    // Use a simple multi-octave value noise seeded by Math.random.
    const seed = Math.random() * 10000;
    const noise2d = (x, y, freq) => {
      // deterministic hash via sine
      const s = Math.sin(x * 127.1 * freq + y * 311.7 * freq + seed) * 43758.5453;
      return s - Math.floor(s);
    };
    const sample = (x, y) => {
      let v = 0;
      v += noise2d(x / cols, y / rows, 1.0) * 0.5;
      v += noise2d(x / cols, y / rows, 2.1) * 0.3;
      v += noise2d(x / cols, y / rows, 4.3) * 0.2;
      if (terrainMix === 'archipelago') {
        // Island falloff from multiple centres
        const islands = [[0.25, 0.35], [0.75, 0.65], [0.5, 0.5]];
        let falloff = 0;
        for (const [cx, cy] of islands) {
          const dx = x / cols - cx, dy = y / rows - cy;
          falloff = Math.max(falloff, 1 - Math.sqrt(dx * dx + dy * dy) * 3.0);
        }
        v *= Math.max(0, falloff);
      } else if (terrainMix === 'inland') {
        // Strong centre island, water edges
        const dx = x / cols - 0.5, dy = y / rows - 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        v *= Math.max(0, 1 - dist * 2.2);
      } else {
        // coastal: mild falloff toward map edge
        const edgeDist = Math.min(x, cols - 1 - x, y, rows - 1 - y) / (Math.min(cols, rows) * 0.12);
        v *= Math.min(1, edgeDist);
      }
      return v;
    };

    // Collect all tile values, sort to find threshold for target land %
    const values = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        values.push({ x, y, v: sample(x, y) });
      }
    }
    values.sort((a, b) => b.v - a.v);
    const landThreshold = values[targetLand - 1]?.v ?? 0.3;

    // Terrain mix ratios (of land tiles)
    const mixRanges = {
      coastal:    { Sand: 0.15, Grass: 0.45, Forest: 0.25, Rock: 0.10, Snow: 0.05 },
      inland:     { Sand: 0.05, Grass: 0.35, Forest: 0.35, Rock: 0.15, Snow: 0.10 },
      archipelago:{ Sand: 0.30, Grass: 0.40, Forest: 0.15, Rock: 0.10, Snow: 0.05 },
    };
    const mix = mixRanges[terrainMix] || mixRanges.coastal;
    const types = Object.keys(mix);
    const cumulative = [];
    let acc = 0;
    for (const t of types) { acc += mix[t]; cumulative.push({ type: t, cum: acc }); }

    for (const { x, y, v } of values) {
      if (v >= landThreshold) {
        // Pick terrain by noise-derived sub-value mapped to mix ratios
        const sub = noise2d(x / cols + 0.5, y / rows + 0.5, 3.7);
        let type = 'Grass';
        for (const { type: t, cum } of cumulative) {
          if (sub <= cum) { type = t; break; }
        }
        this._world.setCell(x, y, type);
      }
      // else stays Water (default from _initGrid)
    }
    this._syncPublicState();

    // ── 2. Scatter cities on land tiles adjacent to water (coastal) ──
    const landTiles = values.filter(({ x, y, v }) => v >= landThreshold);
    // Score each tile: prefer coastal (next to water)
    const isWater = (x, y) => this.grid[y]?.[x] === 'Water';
    const coastalTiles = landTiles.filter(({ x, y }) =>
      [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => isWater(x+dx, y+dy))
    );
    const cityPool = coastalTiles.length >= cityCount ? coastalTiles : landTiles;
    // Shuffle
    for (let i = cityPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cityPool[i], cityPool[j]] = [cityPool[j], cityPool[i]];
    }
    const cityPresetKeys = Object.keys(CITY_PRESETS).filter(k => k !== 'none');
    const minDist = Math.min(cols, rows) / (cityCount * 1.5);
    const placed = [];
    for (const { x, y } of cityPool) {
      if (placed.length >= cityCount) break;
      // Enforce minimum spacing
      const tooClose = placed.some(p => Math.hypot(p.x - x, p.y - y) < minDist);
      if (tooClose) continue;
      const preset = cityPresetKeys[placed.length % cityPresetKeys.length];
      const name = `City ${this._cityNameIdx++}`;
      this._editor.placeElement('city', x, y, { name, preset, items: { ...CITY_PRESETS[preset].items } }, {
        uniqueKindPerTile: true,
        select: false,
        allowPlacement: () => this.grid[y][x] !== 'Water',
      });
      placed.push({ x, y });
    }
    this._syncPublicState();

    // ── 3. Place player start on land near map centre ──
    const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
    let bestStart = null, bestDist = Infinity;
    for (const { x, y, v } of landTiles) {
      if (v < landThreshold) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d < bestDist) { bestDist = d; bestStart = { x, y }; }
    }
    if (bestStart) {
      this._editor.placeElement('playerStart', bestStart.x, bestStart.y, {}, { uniqueKind: true, select: false });
      this._syncPublicState();
    }

    // ── 4. Scatter raider spawns ──
    const raiderTypes = ['bandit', 'dragon', 'blackKnight', 'wraith', 'sandWorm', 'iceGolem', 'voidHound', 'thornBeast', 'magmaSerpent', 'grazer'];
    const raiderPool = [...landTiles];
    for (let i = raiderPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [raiderPool[i], raiderPool[j]] = [raiderPool[j], raiderPool[i]];
    }
    let rPlaced = 0;
    for (const { x, y, v } of raiderPool) {
      if (rPlaced >= raiderCount) break;
      if (v < landThreshold) continue;
      const tooClose = placed.some(p => Math.hypot(p.x - x, p.y - y) < 5);
      if (tooClose) continue;
      const type = raiderTypes[rPlaced % raiderTypes.length];
      this._editor.placeElement('raiderSpawn', x, y, { type, strength: 3 + Math.floor(Math.random() * 5), isPirate: false, name: '' }, {
        uniqueKindPerTile: true,
        select: false,
      });
      rPlaced++;
    }
    this._syncPublicState();

    const generated = {
      seed: null,
      landmass: _bqTerrainMixToLandmass(terrainMix),
      worldGenConfig: _bqNormalizeLevelEditorWorldGenConfig(null, null),
      cityCount: Math.max(0, Math.floor(Number(cityCount)) || 0),
      raiderCount: Math.max(0, Math.floor(Number(raiderCount)) || 0),
    };
    this.lastGeneratedMapConfig = generated;
    return generated;
  }

  /**
   * Procedurally generate a map using the same terrain model as the
   * configurator preview/game world generator.
   * @param {object} opts
   * @param {number} opts.cityCount number of cities to scatter
   * @param {number} opts.raiderCount number of raider spawns
   * @param {number} opts.landmass 0=islands, 1=normal, 2=continents
   * @param {number|null} opts.seed deterministic seed; null picks a random seed
   * @param {object|null} opts.worldGenConfig configurator-style terrain tuning
   * @param {number} opts.landPct legacy fallback option
   * @param {string} opts.terrainMix legacy fallback option
   */
  generateMap({
    cityCount = 4,
    raiderCount = 3,
    landmass = 1,
    seed = null,
    worldGenConfig = null,
    landPct = 40,
    terrainMix = 'coastal',
  } = {}) {
    const worldGenerators = this._worldLib?.worldGenerators || (typeof window !== 'undefined' ? window.BQWorldGenerators : null);
    if (!worldGenerators || typeof worldGenerators.generateTerrainFields !== 'function') {
      return this._generateLegacyMap({ landPct, cityCount, raiderCount, terrainMix });
    }

    this._initGrid();

    const cols = this.cols;
    const rows = this.rows;
    const normalizedCityCount = Math.max(0, Math.floor(Number(cityCount)) || 0);
    const normalizedRaiderCount = Math.max(0, Math.floor(Number(raiderCount)) || 0);
    const normalizedLandmass = _bqNormalizeLevelEditorLandmass(worldGenerators, landmass, terrainMix);
    const normalizedWorldGen = _bqNormalizeLevelEditorWorldGenConfig(worldGenerators, worldGenConfig);
    const hasExplicitSeed = seed !== null && seed !== undefined && seed !== '';
    const rawSeed = hasExplicitSeed ? Number(seed) : NaN;
    const effectiveSeed = Number.isFinite(rawSeed)
      ? (Math.floor(Math.abs(rawSeed)) >>> 0)
      : (Math.floor(Math.random() * 0x100000000) >>> 0);
    const terrain = worldGenerators.generateTerrainFields({
      cols,
      rows,
      seed: effectiveSeed,
      landmassMode: normalizedLandmass,
      worldGenConfig: normalizedWorldGen,
    });
    const biomeGrid = typeof worldGenerators.buildBiomeGridFromFlat === 'function'
      ? worldGenerators.buildBiomeGridFromFlat(terrain.biomeFlat, rows, cols)
      : worldGenerators.generateBiomeGrid({
          cols,
          rows,
          seed: effectiveSeed,
          landmassMode: normalizedLandmass,
          worldGenConfig: normalizedWorldGen,
        });

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        this._world.setCell(x, y, biomeGrid[y]?.[x] || 'Water');
      }
    }
    this._syncPublicState();

    const placementRng = _bqCreateLevelEditorRng((effectiveSeed ^ 0x85ebca6b) >>> 0);
    const landTiles = [];
    const coastalTiles = [];
    const isWaterNearby = (x, y, radius = 2) => {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
          if (this.grid[ny]?.[nx] === 'Water') return true;
        }
      }
      return false;
    };

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const type = biomeGrid[y]?.[x] || 'Water';
        if (!_bqIsLevelEditorLand(type)) continue;
        const tile = { x, y };
        landTiles.push(tile);
        if (isWaterNearby(x, y, 2)) coastalTiles.push(tile);
      }
    }

    const cityPresetKeys = Object.keys(CITY_PRESETS).filter(key => key !== 'none');
    const cityCandidates = placementRng.shuffle(coastalTiles.length >= normalizedCityCount ? coastalTiles : landTiles);
    const minDist = Math.max(6, Math.floor(Math.max(cols, rows) / 15));
    const minDistSq = minDist * minDist;
    const placedCities = [];

    for (const { x, y } of cityCandidates) {
      if (placedCities.length >= normalizedCityCount) break;
      const tooClose = placedCities.some(city => {
        const dx = city.x - x;
        const dy = city.y - y;
        return dx * dx + dy * dy < minDistSq;
      });
      if (tooClose) continue;

      const preset = cityPresetKeys[placedCities.length % cityPresetKeys.length];
      const name = `City ${this._cityNameIdx++}`;
      this._editor.placeElement('city', x, y, {
        name,
        preset,
        items: { ...CITY_PRESETS[preset].items },
      }, {
        uniqueKindPerTile: true,
        select: false,
        allowPlacement: () => this.grid[y][x] !== 'Water',
      });
      placedCities.push({ x, y });
    }
    this._syncPublicState();

    const cityKeys = new Set(placedCities.map(city => `${city.x},${city.y}`));
    const centerX = Math.floor(cols / 2);
    const centerY = Math.floor(rows / 2);
    let bestStart = null;
    let bestDist = Infinity;
    for (const { x, y } of landTiles) {
      if (cityKeys.has(`${x},${y}`)) continue;
      const dist = Math.hypot(x - centerX, y - centerY);
      if (dist < bestDist) {
        bestDist = dist;
        bestStart = { x, y };
      }
    }
    if (!bestStart && landTiles.length > 0) {
      bestStart = landTiles[0];
    }
    if (bestStart) {
      this._editor.placeElement('playerStart', bestStart.x, bestStart.y, {}, {
        uniqueKind: true,
        select: false,
      });
      this._syncPublicState();
    }

    const raiderTypes = ['bandit', 'dragon', 'blackKnight', 'wraith', 'sandWorm', 'iceGolem', 'voidHound', 'thornBeast', 'magmaSerpent', 'grazer'];
    const raiderCandidates = placementRng.shuffle(landTiles);
    let placedRaiders = 0;
    for (const { x, y } of raiderCandidates) {
      if (placedRaiders >= normalizedRaiderCount) break;
      const key = `${x},${y}`;
      if (cityKeys.has(key)) continue;
      if (bestStart && key === `${bestStart.x},${bestStart.y}`) continue;

      const nearCity = placedCities.some(city => {
        const dx = city.x - x;
        const dy = city.y - y;
        return dx * dx + dy * dy < 25;
      });
      if (nearCity) continue;

      const type = raiderTypes[placedRaiders % raiderTypes.length];
      this._editor.placeElement('raiderSpawn', x, y, {
        type,
        strength: 3 + placementRng.int(0, 4),
        isPirate: false,
        name: '',
      }, {
        uniqueKindPerTile: true,
        select: false,
      });
      placedRaiders++;
    }
    this._syncPublicState();

    const generated = {
      seed: effectiveSeed,
      landmass: normalizedLandmass,
      worldGenConfig: normalizedWorldGen,
      cityCount: normalizedCityCount,
      raiderCount: normalizedRaiderCount,
    };
    this.lastGeneratedMapConfig = generated;
    return generated;
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
