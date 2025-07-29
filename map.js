
  let smoothingPasses = 1;

// --- Terrain generation (unchanged) ---
  function initTerrain() {
    for (let i = 0; i < rows; i++) {
      grid[i] = [];
      elevationMap[i] = [];
      difficultyMap[i] = [];
      for (let j = 0; j < cols; j++) {
        grid[i][j] = { options: tileTypes.slice(), collapsed: false };
      }
    }
    collapseWave();
    genElevation();
    smoothElevation(smoothingPasses);
    calcDifficulty();
  }

  function collapseWave() {
    while (true) {
      let minE = Infinity, choices = [];
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        let c = grid[i][j];
        if (!c.collapsed) {
          let e = c.options.length;
          if (e < minE) { minE = e; choices = [[i,j]]; }
          else if (e === minE) choices.push([i,j]);
        }
      }
      if (!choices.length) return;
      let [r,c] = random(choices);
      let cell = grid[r][c]; cell.collapsed = true;
      cell.options = [weightedRandom(cell.options)];
      propagate(r,c);
    }
  }

  function propagate(r, c) {
    let q = [[r,c]];
    while (q.length) {
      let [x,y] = q.shift(), t = grid[x][y].options[0];
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
        let nx = x + dx, ny = y + dy;
        if (nx>=0&&nx<rows&&ny>=0&&ny<cols) {
          let n = grid[nx][ny];
          if (!n.collapsed) {
            let b = n.options.length;
            n.options = n.options.filter(o => adjacency[o].includes(t));
            if (n.options.length < b) q.push([nx,ny]);
          }
        }
      });
    }
  }

  function weightedRandom(opts) {
    let sum = opts.reduce((s,o) => s + weights[o], 0);
    let r = random(sum);
    for (let o of opts) { r -= weights[o]; if (r < 0) return o; }
    return opts[opts.length - 1];
  }

  function genElevation() {
    noiseSeed(floor(random(10000)));
    let s = 0.1;
    for (let i=0; i<rows; i++) for (let j=0; j<cols; j++)
      elevationMap[i][j] = noise(i*s,j*s);
  }

  function smoothElevation(passes) {
    for (let p=0; p<passes; p++) {
      let temp = [];
      for (let i=0; i<rows; i++) {
        temp[i] = [];
        for (let j=0; j<cols; j++) {
          let sum = 0, count = 0;
          for (let di=-1; di<=1; di++) for (let dj=-1; dj<=1; dj++) {
            let ni=i+di, nj=j+dj;
            if (ni>=0&&ni<rows&&nj>=0&&nj<cols) {
              sum += elevationMap[ni][nj];
              count++;
            }
          }
          temp[i][j] = sum / count;
        }
      }
      elevationMap = temp;
    }
  }

  function calcDifficulty() {
    for (let i=0; i<rows; i++) for (let j=0; j<cols; j++) {
      let t = grid[i][j].options[0];
      let e = elevationMap[i][j];
      difficultyMap[i][j] = baseDiff[t] + e * 5;
    }
  }