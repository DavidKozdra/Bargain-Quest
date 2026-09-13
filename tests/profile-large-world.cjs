#!/usr/bin/env node
'use strict';

// Run against a separately served checkout; this script never edits game files.
// Example: node tests/profile-large-world.cjs --size 1500 --cities 600 --extended
// Playwright must be installed, or set PLAYWRIGHT_MODULE to its package path.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function optionsFromArgs(argv) {
  const args = {};
  const positional = [];
  const flags = new Set(['dense', 'extended', 'no-cpu-profile', 'no-screenshots', 'help']);
  const values = new Set(['size', 'cities', 'seed', 'url', 'width', 'height', 'dpr', 'only',
    'duration-ms', 'extended-duration-ms', 'warmup-timeout-ms', 'generation-timeout-ms', 'output-dir', 'label']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const name = arg.slice(2);
    if (flags.has(name)) args[name] = true;
    else if (values.has(name) && argv[i + 1] && !argv[i + 1].startsWith('--')) args[name] = argv[++i];
    else throw new Error(`Unknown option or missing value: ${arg}`);
  }
  if (positional.length > 2) throw new Error('Only world size and city count may be positional arguments');
  const number = (key, fallback, min = 1, integer = true) => {
    const value = Number(args[key] ?? fallback);
    if (!Number.isFinite(value) || value < min || (integer && !Number.isInteger(value))) throw new Error(`Invalid --${key}`);
    return value;
  };
  return {
    help: !!args.help, size: number('size', positional[0] || 1500), cities: number('cities', positional[1] || 600),
    seed: number('seed', 12345, 0), url: args.url || 'http://127.0.0.1:8000',
    width: number('width', 1920), height: number('height', 1080), dpr: number('dpr', 1, 0.1, false),
    durationMs: number('duration-ms', 6000), extendedDurationMs: number('extended-duration-ms', 30000, 30000),
    warmupTimeoutMs: number('warmup-timeout-ms', 120000), generationTimeoutMs: number('generation-timeout-ms', 180000),
    dense: !!args.dense, extended: !!args.extended, cpuProfile: !args['no-cpu-profile'], screenshots: !args['no-screenshots'],
    only: args.only ? args.only.split(',') : null, outputDir: args['output-dir'], label: args.label || 'current',
  };
}

function readGitMetadata() {
  try {
    const cwd = path.resolve(__dirname, '..');
    return {
      commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim(),
      dirty: !!execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' }).trim(),
    };
  } catch (_) { return { commit: null, dirty: null }; }
}

async function main() {
  const options = optionsFromArgs(process.argv.slice(2));
  if (options.help) {
    console.log(`Usage: node tests/profile-large-world.cjs [size cities] [options]
  --url URL                  Served game, default http://127.0.0.1:8000
  --size N --cities N         Requested world dimensions and city count
  --seed N                   Deterministic fixture seed, default 12345
  --width N --height N --dpr N Browser viewport and requested device scale
  --dense                    Add synthetic cities to reach the requested count
  --extended                 Also run live 8x for >=30s and scripted pan/zoom
  --only NAME[,NAME]          Filter scenarios (extended names require --extended)
  --duration-ms N             Standard sample duration, default 6000
  --extended-duration-ms N    Live 8x sample, minimum/default 30000
  --warmup-timeout-ms N       Terrain completion deadline, default 120000
  --generation-timeout-ms N   World generation deadline, default 180000
  --output-dir DIR --label S  Artifact destination (default new temp directory)
  --no-cpu-profile --no-screenshots
Scenarios: live-zoom1, render-only-zoom1, render-only-zoom015,
  live-zoom015-8x, render-only-pan-zoom
Environment: PLAYWRIGHT_MODULE (package name/path), CHROMIUM_EXECUTABLE (optional).`);
    return;
  }

  let scenarios = [
    { name: 'live-zoom1', zoom: 1, renderOnly: false, speed: 1, durationMs: options.durationMs },
    { name: 'render-only-zoom1', zoom: 1, renderOnly: true, speed: 1, durationMs: options.durationMs },
    { name: 'render-only-zoom015', zoom: 0.15, renderOnly: true, speed: 1, durationMs: options.durationMs },
  ];
  if (options.extended) scenarios.push(
    { name: 'live-zoom015-8x', zoom: 0.15, renderOnly: false, speed: 8, durationMs: options.extendedDurationMs, minimumDays: 2 },
    { name: 'render-only-pan-zoom', zoom: 1, renderOnly: true, speed: 1, durationMs: Math.max(8000, options.durationMs), pan: true },
  );
  if (options.only) {
    for (const name of options.only) if (!scenarios.some(s => s.name === name)) throw new Error(`Unavailable scenario: ${name}; extended scenarios require --extended`);
    scenarios = scenarios.filter(s => options.only.includes(s.name));
  }

  let chromium;
  try { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')); }
  catch (error) { throw new Error(`Install Playwright or set PLAYWRIGHT_MODULE to its package path. ${error.message}`); }
  const outputDir = options.outputDir ? path.resolve(options.outputDir) : fs.mkdtempSync(path.join(os.tmpdir(), 'bq-world-profile-'));
  fs.mkdirSync(outputDir, { recursive: true });
  const tag = `${options.size}-${options.cities}-${options.dense ? 'synthetic-dense' : 'generated'}-${options.label}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const manifest = {
    startedAt: new Date().toISOString(), status: 'running', options, outputDir, git: readGitMetadata(),
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    caveats: [
      'CPU profiling and browser automation add overhead; compare matching viewport, DPR, fixture, scenario order and hardware.',
      'Render-only scenarios intentionally suspend actor/day/pathfinding updates in this disposable browser.',
      'Synthetic dense fixtures add cities after generation; actual actor/city counts are reported separately.',
      'Rivalry, encounters and game-state transitions remain active in live scenarios; unexpected states fail the sample.',
    ],
    scenarios: [], pageErrors: [],
  };
  const writeManifest = () => fs.writeFileSync(path.join(outputDir, `${tag}-manifest.json`), JSON.stringify(manifest, null, 2));
  writeManifest();
  console.log(`ARTIFACTS ${outputDir}`);
  let browser = null;
  try {
    browser = await chromium.launch({ headless: true,
      ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
    manifest.browser = browser.version();
    const context = await browser.newContext({ viewport: { width: options.width, height: options.height },
      deviceScaleFactor: options.dpr, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', error => {
      manifest.pageErrors.push({ at: new Date().toISOString(), message: error.message });
      console.error(`PAGE_ERROR ${error.message}`);
    });
    page.on('dialog', dialog => dialog.dismiss());
    await page.goto(options.url, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof _gameBootstrapComplete !== 'undefined' && _gameBootstrapComplete,
      null, { timeout: 60000 });
    console.log('BOOTSTRAPPED');
    await page.evaluate(({ size, cities: cityCount, seed }) => {
      window._newGameSeed = seed;
      window._newGameCityCount = cityCount;
      window._newGameEventChance = 0;
      if (typeof TutorialSystem !== 'undefined') TutorialSystem.prototype.showStartupGuide = function () {};
      window._profileStart = performance.now();
      window._profileReady = false;
      window._profileError = null;
      startNewGame(size, size).then(() => { window._profileReady = true; })
        .catch(error => { window._profileError = error.stack || String(error); });
    }, options);
    await page.waitForFunction(() => window._profileReady || window._profileError,
      null, { timeout: options.generationTimeoutMs });
    const generation = await page.evaluate(() => ({ error: window._profileError,
      durationMs: performance.now() - window._profileStart, cols, rows, cities: cities.length,
      traders: traderManager?.traders.length, raiders: raiderManager?.raiders.length }));
    manifest.generation = generation;
    if (generation.error) throw new Error(`World generation failed: ${generation.error}`);

    manifest.fixture = await page.evaluate(({ cities: requestedCities, dense, seed }) => {
      const generatedCities = cities.length;
      if (dense) {
        for (let y = 10; y < rows && cities.length < requestedCities; y += 25) {
          for (let x = 10; x < cols && cities.length < requestedCities; x += 25) {
            if (grid[y][x].options[0] === 'Water' || _isCityTile(x, y)) continue;
            const city = new City({ name: `Synthetic Stress City ${cities.length + 1}`, location: { x, y }, population: 600 });
            city.addInventoryBasedOnTerrain(grid, 1);
            cities.push(city);
          }
        }
        if (cities.length !== requestedCities) throw new Error(`Synthetic fixture reached ${cities.length}/${requestedCities} cities`);
        City.detectCoastalCities(cities, grid, rows, cols);
        portCityLocations = cities.filter(city => city.isCoastal).map(city => city.location);
        buildCityLocationMap();
        rebuildSpatialGrids();
      }
      const centerX = Math.floor(cols / 2), centerY = Math.floor(rows / 2);
      let position = null;
      // Manhattan-nearest non-city land, with deterministic north-to-south,
      // west-before-east tie breaking. This removes random-spawn camera variance.
      for (let radius = 0; radius <= rows + cols && !position; radius++) {
        for (let dy = -radius; dy <= radius && !position; dy++) {
          const dx = radius - Math.abs(dy);
          for (const x of dx === 0 ? [centerX] : [centerX - dx, centerX + dx]) {
            const y = centerY + dy;
            if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
            if (grid[y][x].options[0] !== 'Water' && !_isCityTile(x, y)) { position = { x, y }; break; }
          }
        }
      }
      if (!position) throw new Error('No non-city land tile available for deterministic player placement');
      const originalSpawn = { x: player.x, y: player.y };
      player.cancelPath?.();
      player.path = [];
      player.x = position.x;
      player.y = position.y;
      player.currentCity = null;
      camX = targetCamX = (position.x + 0.5) * tileSize;
      camY = targetCamY = (position.y + 0.5) * tileSize;
      camZoom = 1;
      invalidateMapBuffer();
      generateMinimap();
      return { seedRequested: seed, mapSeed: window._mapSeed ?? null, generatedCities, actualCities: cities.length,
        traders: traderManager?.traders.length, raiders: raiderManager?.raiders.length,
        syntheticDense: dense, addedSyntheticCities: cities.length - generatedCities,
        originalSpawn, playerPosition: position, placement: 'Manhattan-nearest non-city land to world center; north-to-south, west-first ties',
        camera: { x: camX, y: camY, zoom: camZoom }, eventChance: 0, startupGuideSuppressed: true };
    }, options);
    console.log('FIXTURE', JSON.stringify(manifest.fixture));
    await page.evaluate(() => {
      const bench = window._bench = { enabled: false, renderOnly: true, measures: {}, frames: [], raf: [],
        lastDraw: null, lastRaf: null, stateCounts: {}, started: 0, durationMs: 0, pan: false,
        center: { x: camX, y: camY }, snapshots: [] };
      const hook = (object, key, name, skip = false) => {
        const original = object[key];
        if (typeof original !== 'function') return;
        object[key] = function (...args) {
          if (skip && bench.renderOnly) return;
          if (!bench.enabled) return original.apply(this, args);
          const start = performance.now();
          try { return original.apply(this, args); }
          finally { (bench.measures[name] ||= []).push(performance.now() - start); }
        };
      };
      for (const name of ['RenderMap', 'renderMinimap', 'renderVisibleCities']) hook(window, name, name);
      hook(window, 'pumpWorldPaths', 'pathfinding', true);
      for (const [name, object] of [['TraderManager', traderManager], ['RaiderManager', raiderManager], ['player', player]]) {
        if (!object) continue;
        hook(object, 'update', `${name}.update`, true);
        hook(object, 'render', `${name}.render`);
      }
      hook(dayNight, 'update', 'dayNight.update', true);
      hook(uiManager, 'updateAll', 'UI');
      hook(City.prototype, 'calculateItemPrice', 'price');
      const originalBounds = window._updateViewportBounds;
      window._updateViewportBounds = function (...args) {
        if (bench.enabled && bench.pan) {
          const t = Math.min(1, (performance.now() - bench.started) / bench.durationMs);
          const zooms = [1, 0.5, 0.15, 0.5, 1];
          camZoom = zooms[Math.min(4, Math.floor(t * 5))];
          const amplitude = Math.min(rows, cols) * tileSize * 0.1;
          camX = bench.center.x + Math.sin(t * Math.PI * 2) * amplitude;
          camY = bench.center.y + Math.sin(t * Math.PI * 4) * amplitude;
        }
        return originalBounds.apply(this, args);
      };
      const originalDraw = window.draw;
      window.draw = function () {
        const start = performance.now();
        if (bench.enabled) {
          if (bench.lastDraw !== null) bench.frames.push(start - bench.lastDraw);
          bench.lastDraw = start;
          const state = gameStateManager.currentState;
          bench.stateCounts[state] = (bench.stateCounts[state] || 0) + 1;
        }
        try { return originalDraw(); }
        finally { if (bench.enabled) (bench.measures.draw ||= []).push(performance.now() - start); }
      };
      const raf = time => {
        if (bench.enabled) {
          if (bench.lastRaf !== null) bench.raf.push(time - bench.lastRaf);
          bench.lastRaf = time;
        }
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
      bench.snapshot = () => {
        const debt = entities => {
          let totalMs = 0, maxMs = 0, pendingPaths = 0, dueSteps = 0, owingEntities = 0;
          for (const entity of entities || []) {
            if (entity.state === 'dead' || entity.state === 'defeated') continue;
            const value = Math.max(0, Number(entity.moveTimer) || 0);
            const interval = Math.max(1, Number(entity.state === 'chasing' ? entity.chaseInterval : entity.moveInterval) || 1);
            totalMs += value; maxMs = Math.max(maxMs, value);
            dueSteps += Math.floor(value / interval);
            if (value >= interval) owingEntities++;
            if (entity._pathRequest) pendingPaths++;
          }
          return { totalMs, maxMs, dueSteps, owingEntities, pendingPaths };
        };
        const canvas = typeof drawingContext !== 'undefined' ? drawingContext.canvas : document.querySelector('canvas');
        return { atMs: performance.now(), state: gameStateManager.currentState,
          daysElapsed: dayNight.getDaysElapsed(), timeOfDay: dayNight.timeOfDay,
          worldDays: dayNight.getDaysElapsed() + dayNight.timeOfDay / (2 * Math.PI), dayCycleLength: dayNight.dayCycleLength,
          player: { x: player.x, y: player.y }, camera: { x: camX, y: camY, zoom: camZoom }, gameSpeed,
          canvas: { logicalWidth: width, logicalHeight: height, p5Density: pixelDensity(),
            devicePixelRatio: window.devicePixelRatio, backingWidth: canvas?.width, backingHeight: canvas?.height },
          entities: { cities: cities.length, traders: traderManager?.traders.length, raiders: raiderManager?.raiders.length },
          terrain: window.BQGetTerrainRenderStats?.() || null, pathfinding: window.BQGetPathfindingStats?.() || null,
          movementDebt: { traders: debt(traderManager?.traders), raiders: debt(raiderManager?.raiders) },
          runtimeError: window._lastRuntimeError || null };
      };
    });

    const cdp = options.cpuProfile ? await context.newCDPSession(page) : null;
    if (cdp) await cdp.send('Profiler.enable');
    for (const scenario of scenarios) {
      const record = { scenario, startedAt: new Date().toISOString(), status: 'running', requestedDpr: options.dpr };
      const artifactBase = path.join(outputDir, `${tag}-${scenario.name}`);
      let profiling = false;
      let samplingTimer = null;
      let phase = 'warmup';
      console.log(`SCENARIO ${scenario.name}`);
      try {
        const setupFrame = await page.evaluate(s => {
          window._bench.enabled = false;
          window._bench.renderOnly = true;
          window._bench.pan = false;
          camZoom = s.zoom;
          camX = window._bench.center.x;
          camY = window._bench.center.y;
          gameSpeed = s.speed;
          return frameCount;
        }, scenario);
        const warmupStart = Date.now();
        await page.waitForFunction(frame => frameCount >= frame + 3
          && window.BQGetTerrainRenderStats?.().pendingChunks === 0,
        setupFrame, { timeout: options.warmupTimeoutMs, polling: 100 });
        record.warmup = { status: 'completed', elapsedMs: Date.now() - warmupStart };
        phase = 'sample';
        record.before = await page.evaluate(s => {
          const b = window._bench;
          b.measures = {}; b.frames = []; b.raf = []; b.stateCounts = {}; b.snapshots = [];
          b.lastDraw = b.lastRaf = null;
          b.started = performance.now(); b.durationMs = s.durationMs; b.pan = !!s.pan;
          b.renderOnly = s.renderOnly; b.enabled = true;
          return b.snapshot();
        }, scenario);
        if (cdp) { await cdp.send('Profiler.start'); profiling = true; }
        // State snapshots are sampled once per second outside frame timings.
        samplingTimer = setInterval(() => {
          page.evaluate(() => { if (window._bench.enabled) window._bench.snapshots.push(window._bench.snapshot()); })
            .catch(error => { record.snapshotError = error.message; });
        }, 1000);
        await page.waitForTimeout(scenario.durationMs);
        clearInterval(samplingTimer); samplingTimer = null;
        if (cdp) {
          const { profile } = await cdp.send('Profiler.stop'); profiling = false;
          fs.writeFileSync(`${artifactBase}.cpuprofile`, JSON.stringify(profile));
          record.cpuProfile = `${artifactBase}.cpuprofile`;
        }
        const sample = await page.evaluate(() => {
          const b = window._bench;
          b.enabled = false;
          b.renderOnly = true;
          const stats = values => {
            const sorted = [...values].sort((a, b) => a - b);
            const totalMs = values.reduce((sum, value) => sum + value, 0);
            const at = quantile => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * quantile))] : null;
            return { n: values.length, totalMs, meanMs: values.length ? totalMs / values.length : null,
              p50: at(0.5), p95: at(0.95), p99: at(0.99), max: at(1) };
          };
          return { after: b.snapshot(), stateCounts: b.stateCounts, snapshots: b.snapshots,
            frameIntervals: stats(b.frames), rafIntervals: stats(b.raf),
            measures: Object.fromEntries(Object.entries(b.measures).map(([key, values]) => [key, stats(values)])),
            gameplayState: GameStates.PLAYING };
        });
        Object.assign(record, sample);
        record.worldDaysAdvanced = record.after.worldDays - record.before.worldDays;
        record.dayTicksAdvanced = record.after.daysElapsed - record.before.daysElapsed;
        const violations = [];
        if (!record.measures.draw?.n) violations.push('No draw frames captured');
        if (Object.keys(record.stateCounts).some(state => state !== record.gameplayState)) violations.push('Game left PLAYING during sample');
        if (scenario.minimumDays && record.dayTicksAdvanced < scenario.minimumDays) violations.push(`Only ${record.dayTicksAdvanced}/${scenario.minimumDays} day ticks advanced`);
        if (record.after.runtimeError) violations.push('Game reported a runtime error');
        if (record.snapshotError) violations.push(`Snapshot failure: ${record.snapshotError}`);
        if (violations.length) throw new Error(violations.join('; '));
        record.status = 'completed';
      } catch (error) {
        record.status = 'failed';
        record.failure = { phase, message: error.message };
        if (phase === 'warmup') record.warmup = { status: 'failed', timeoutMs: options.warmupTimeoutMs };
        process.exitCode = 1;
      } finally {
        if (samplingTimer) clearInterval(samplingTimer);
        if (profiling) await cdp.send('Profiler.stop').catch(() => {});
        await page.evaluate(() => { window._bench.enabled = false; window._bench.renderOnly = true; window._bench.pan = false; }).catch(() => {});
        if (options.screenshots) {
          try { await page.screenshot({ path: `${artifactBase}.png` }); record.screenshot = `${artifactBase}.png`; }
          catch (error) { record.screenshotError = error.message; }
        }
        record.finishedAt = new Date().toISOString();
        fs.writeFileSync(`${artifactBase}.json`, JSON.stringify(record, null, 2));
        manifest.scenarios.push(record);
        writeManifest();
      }
      console.log('RESULT', scenario.name, JSON.stringify({ status: record.status, failure: record.failure,
        frameIntervals: record.frameIntervals, draw: record.measures?.draw, terrain: record.after?.terrain,
        pathfinding: record.after?.pathfinding, movementDebt: record.after?.movementDebt, dayTicksAdvanced: record.dayTicksAdvanced }));
    }
    manifest.status = manifest.scenarios.every(s => s.status === 'completed') && !manifest.pageErrors.length ? 'completed' : 'failed';
    if (manifest.status === 'failed') process.exitCode = 1;
  } catch (error) {
    manifest.status = 'failed';
    manifest.failure = error.stack || String(error);
    process.exitCode = 1;
    console.error(manifest.failure);
  } finally {
    manifest.finishedAt = new Date().toISOString();
    writeManifest();
    if (browser) await browser.close();
  }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
