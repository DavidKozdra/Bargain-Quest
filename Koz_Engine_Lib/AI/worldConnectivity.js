(function initWorldConnectivityLib(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createWorldConnectivityApi() {
  const UNKNOWN_LAND = 0x7fffffff;
  const UNKNOWN_WATER = -0x7fffffff;
  const HOLE = -0x80000000;
  const QUEUE_PAGE_SIZE = 1024;

  /**
   * Build shared four-neighbor land/water connectivity incrementally. A signed
   * label per tile preserves terrain kind without rereading terrain in queries.
   * Port edges connect components only through land tiles within the same 5x5
   * square used by A*. Keep terrain and ports immutable, or cancel and rebuild.
   *
   * step() charges seed scans, queue pops, neighbor attempts, port setup and
   * union-find traversals individually. It returns done, and processedWork is
   * cumulative. No terrain cells are read during construction or canReach().
   */
  function createWorldConnectivity(grid, portCities = null) {
    const rows = grid?.length || 0;
    const cols = grid?.[0]?.length || 0;
    const count = rows * cols;
    const validSize = Number.isSafeInteger(count) && count > 0 && count < UNKNOWN_LAND;
    let labels = validSize ? new Int32Array(count) : null;
    let parents = null;
    let ranks = null;
    let cancelled = false;
    let ready = !validSize;
    let phase = ready ? 'ready' : 'scan';
    let processedWork = 0, lastStepWork = 0, classifiedTiles = 0, componentCount = 0;
    let scan = 0, floodCell = 0, floodKind = 0, floodLabel = 0, neighbor = 0;
    const queuePages = new Map();
    let queueHead = 0, queueTail = 0, peakQueueLength = 0;
    const portCount = Array.isArray(portCities) ? portCities.length : 0;
    let portsReliable = Array.isArray(portCities);
    let portIndex = 0, portOffset = 0, portX = 0, portY = 0, landCell = 0, landLabel = 0;
    let findCursor = 0, rootA = 0, unionB = 0, flattenIndex = 1;

    function enqueue(index) {
      const pageId = Math.floor(queueTail / QUEUE_PAGE_SIZE);
      let page = queuePages.get(pageId);
      if (!page) queuePages.set(pageId, page = new Uint32Array(QUEUE_PAGE_SIZE));
      page[queueTail % QUEUE_PAGE_SIZE] = index;
      queueTail++;
      peakQueueLength = Math.max(peakQueueLength, queueTail - queueHead);
    }

    function dequeue() {
      const pageId = Math.floor(queueHead / QUEUE_PAGE_SIZE);
      const value = queuePages.get(pageId)[queueHead % QUEUE_PAGE_SIZE];
      queueHead++;
      if (queueHead % QUEUE_PAGE_SIZE === 0) queuePages.delete(pageId);
      return value;
    }

    function classify(index) {
      if (labels[index] !== 0) return labels[index];
      const tile = grid[Math.floor(index / cols)]?.[index % cols];
      labels[index] = !tile ? HOLE : tile.options?.[0] === 'Water' ? UNKNOWN_WATER : UNKNOWN_LAND;
      classifiedTiles++;
      return labels[index];
    }

    function adjacent(index, direction) {
      const x = index % cols;
      if (direction === 0) return x + 1 < cols ? index + 1 : -1;
      if (direction === 1) return x > 0 ? index - 1 : -1;
      if (direction === 2) return index + cols < count ? index + cols : -1;
      return index >= cols ? index - cols : -1;
    }

    function finish() {
      ready = true;
      phase = 'ready';
      ranks = null;
      queuePages.clear();
      queueHead = queueTail = 0;
    }

    function advancePortTile() {
      portOffset++;
      if (portOffset === 25) {
        portOffset = 0;
        portIndex++;
        phase = 'portSetup';
      } else phase = 'portTile';
    }

    function step(maxWork = 256) {
      lastStepWork = 0;
      if (ready || cancelled) return true;
      let remaining = Number.isFinite(maxWork) ? Math.max(0, Math.floor(maxWork)) : maxWork === Infinity ? Infinity : 0;
      while (remaining > 0 && !ready && !cancelled) {
        remaining--;
        processedWork++;
        lastStepWork++;
        if (phase === 'scan') {
          if (scan === count) {
            if (portCount === 0) { finish(); continue; }
            parents = new Uint32Array(componentCount + 1);
            ranks = new Uint8Array(componentCount + 1);
            phase = 'portSetup';
            continue;
          }
          const index = scan++;
          const kind = classify(index);
          if (kind !== UNKNOWN_LAND && kind !== UNKNOWN_WATER) continue;
          floodKind = kind;
          floodLabel = ++componentCount * (kind === UNKNOWN_LAND ? 1 : -1);
          labels[index] = floodLabel;
          enqueue(index);
          phase = 'floodPop';
        } else if (phase === 'floodPop') {
          if (queueHead === queueTail) {
            queuePages.clear();
            queueHead = queueTail = 0;
            phase = 'scan';
            continue;
          }
          floodCell = dequeue();
          neighbor = 0;
          phase = 'floodNeighbor';
        } else if (phase === 'floodNeighbor') {
          const next = adjacent(floodCell, neighbor++);
          if (next >= 0 && classify(next) === floodKind) {
            labels[next] = floodLabel;
            enqueue(next);
          }
          if (neighbor === 4) phase = 'floodPop';
        } else if (phase === 'portSetup') {
          if (portIndex === portCount) {
            flattenIndex = findCursor = 1;
            phase = 'flatten';
            continue;
          }
          const port = portCities[portIndex];
          portX = port?.x;
          portY = port?.y;
          if (!Number.isInteger(portX) || !Number.isInteger(portY)) {
            // Exotic/fractional port keys may behave differently in A*. Keep
            // land/water answers but decline boat rejections for this topology.
            portsReliable = false;
            portIndex++;
          } else phase = 'portTile';
        } else if (phase === 'portTile') {
          const x = portX + portOffset % 5 - 2;
          const y = portY + Math.floor(portOffset / 5) - 2;
          if (x < 0 || y < 0 || x >= cols || y >= rows) { advancePortTile(); continue; }
          landCell = y * cols + x;
          landLabel = labels[landCell];
          if (landLabel <= 0) { advancePortTile(); continue; }
          neighbor = 0;
          phase = 'portNeighbor';
        } else if (phase === 'portNeighbor') {
          if (neighbor === 4) { advancePortTile(); continue; }
          const next = adjacent(landCell, neighbor++);
          if (next < 0 || labels[next] >= 0 || labels[next] === HOLE) continue;
          findCursor = landLabel;
          unionB = -labels[next];
          phase = 'findA';
        } else if (phase === 'findA') {
          if (parents[findCursor]) findCursor = parents[findCursor];
          else { rootA = findCursor; findCursor = unionB; phase = 'findB'; }
        } else if (phase === 'findB') {
          if (parents[findCursor]) findCursor = parents[findCursor];
          else {
            if (rootA !== findCursor) {
              if (ranks[rootA] < ranks[findCursor]) parents[rootA] = findCursor;
              else {
                parents[findCursor] = rootA;
                if (ranks[rootA] === ranks[findCursor]) ranks[rootA]++;
              }
            }
            phase = 'portNeighbor';
          }
        } else if (phase === 'flatten') {
          if (flattenIndex > componentCount) { finish(); continue; }
          if (parents[findCursor]) findCursor = parents[findCursor];
          else {
            if (flattenIndex !== findCursor) parents[flattenIndex] = findCursor;
            findCursor = ++flattenIndex;
          }
        }
      }
      return ready || cancelled;
    }

    function canReach(start, goal, allowWater = false, ports = null, waterOnly = false) {
      if (!ready || cancelled || !labels) return true;
      const valid = point => point && Number.isInteger(point.x) && Number.isInteger(point.y)
        && point.x >= 0 && point.x < cols && point.y >= 0 && point.y < rows;
      if (!valid(start) || !valid(goal)) return true;
      const a = labels[start.y * cols + start.x], b = labels[goal.y * cols + goal.x];
      if (!a || !b || a === HOLE || b === HOLE) return true;
      if (start.x === goal.x && start.y === goal.y) return true;
      if (waterOnly) {
        // A* permits a land start to escape to water; that exceptional first
        // transition is directed and is not represented by water components.
        if (a > 0) return true;
        return !!allowWater && b < 0 && a === b;
      }
      if (!allowWater) {
        // Likewise, land searches can escape a water start onto adjacent land.
        if (a < 0) return true;
        return b > 0 && a === b;
      }
      if (!portsReliable || ports !== portCities || !Array.isArray(ports) || ports.length !== portCount) return true;
      const idA = Math.abs(a), idB = Math.abs(b);
      return (parents?.[idA] || idA) === (parents?.[idB] || idB);
    }

    function cancel() {
      if (cancelled) return;
      cancelled = true;
      phase = 'cancelled';
      labels = parents = ranks = null;
      grid = portCities = null;
      queuePages.clear();
      queueHead = queueTail = 0;
    }

    function getStats() {
      const labelBytes = labels?.byteLength || 0;
      const unionBytes = (parents?.byteLength || 0) + (ranks?.byteLength || 0);
      const queueBytes = queuePages.size * QUEUE_PAGE_SIZE * Uint32Array.BYTES_PER_ELEMENT;
      return { done: ready || cancelled, cancelled, phase, rows, cols, processedWork, lastStepWork,
        classifiedTiles, componentCount, portsProcessed: portIndex, portsReliable,
        queueLength: queueTail - queueHead, peakQueueLength,
        labelBytes, unionBytes, queueBytes, allocatedBytes: labelBytes + unionBytes + queueBytes };
    }

    return { step, canReach, cancel, getStats,
      get done() { return ready || cancelled; },
      get processedWork() { return processedWork; } };
  }

  return { createWorldConnectivity };
});
