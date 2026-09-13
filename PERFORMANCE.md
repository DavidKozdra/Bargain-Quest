# Large-world rendering and simulation

Measured September 12–13, 2026; baseline commit `805916f`.

The main rendering fault was terrain-cache churn: minimum zoom requested more
chunks than the fixed cache could hold, so a stationary camera rebuilt terrain
every frame. Repeated HUD DOM work and icon PNG encoding added a separate steady
cost. Regional pricing and synchronous route searches caused simulation spikes.

## What changed

- Terrain draws only intersecting chunks. Its density-1
  backing canvases use zoom-dependent detail and a 128 MiB pixel-storage budget.
  Missing terrain is rasterized in approximately 3 ms batches, prioritized around
  the camera; obsolete work is cancelled. Old detail remains usable during zoom
  changes, with temporary color placeholders for genuinely uncached areas.
- The main canvas has an 8,294,400-pixel budget, independent of CSS/input size.
  High-DPI smaller screens retain detail; a 4K CSS viewport no longer allocates an
  8K backing canvas at device-pixel ratio 2. Resize ordering also avoids oversized
  intermediate allocations. DOM text remains at the display's native resolution.
- HUD elements and atlas icons are retained; unchanged values do not cause DOM
  writes. Regional minimaps query their own spatial bounds. Offscreen unit bodies,
  labels and overlays are culled; selected routes and crossing lines are handled
  independently of whether their source entity is visible.
- Prices cache geographical neighbors, not prices: current inventory and
  population still affect every quote. City topology changes rebuild the index.
  City threat counts use local raider queries; empty construction queues exit early.
- Weighted A* and city-unit BFS now support incremental searches. The shared queue
  has an approximately 2 ms frame budget, prioritizes player requests, and keeps
  background work progressing. A shared incremental land/water/port connectivity
  index rejects proven-unreachable routes without a repeated continent-wide A*
  search. Short player routes get a bounded 2,048-work head start before waiting
  for that index. Requests are cancelled on world/target changes.
  Unit BFS retains its original shortest-step semantics and neighbor order.
- Traders and raiders receive elapsed simulation time regardless of distance.
  Distant travel no longer teleports or freezes because of camera position.
  Movement retains remainder/deferred time, releases at most eight steps per
  update, and respects pause and encounters. Pending NPC/unit travel time survives
  saves; runtime request handles are never serialized. Obsolete AI frame-skipping
  controls have been removed; trader spawn-rate controls remain.

## Measured evidence

Instrumented headless Chromium on this host, 1920×1080 / DPR 1, 1500×1500 terrain,
120 traders and 100 raiders. Requesting 600 cities generated only 140 with seed
12345, so the explicitly synthetic dense fixture added real, initialized cities
on land to reach 600. City-generation spacing was not changed by this work.

Representative captures, mean milliseconds per call. The final profiler fixes the
camera at the nearest non-city land to the world center (742,750 in this fixture);
earlier captures used the starting camera, so these are not a matched-camera A/B
test. The live sample includes cold connectivity work and deferred route requests.

| Scenario / measurement | Baseline | Final connected-1080p run |
| --- | ---: | ---: |
| Normal zoom, live: total draw | 24.02 | 5.99 |
| Normal zoom, live: terrain | 12.20 | 0.10 |
| Normal zoom, live: HUD | 8.16 | 0.36 |
| Minimum zoom, render-only: total draw | 283.69 | 11.95 |
| Minimum zoom, render-only: terrain | 270.32 | 10.19 |
| Minimum zoom: new chunks after warmup | 2 every frame | 0 |
| Minimum zoom: terrain backing pixels retained | 800 MiB | 67 MiB |

The final normal live draw p95 was 8.3 ms; mean frame interval was 16.67 ms.
The minimum-zoom render-only frame interval averaged 18.20 ms, with one 337 ms
outlier. These are not GPU frame measurements or a stable 60 FPS guarantee.
Earlier post-change minimum-zoom terrain samples varied down to 0.35 ms: renderer
backend, scene and capture effects matter. An explicit source-crop experiment
regressed fractional-zoom drawing and was reverted; the canvas clips boundary
chunks instead.

The 30-second **8× live** sample advanced two full day ticks, stayed in PLAYING,
and reported no runtime errors. Draw averaged 14.16 ms (p95 19.3 ms); frame intervals
averaged 18.57 ms, with a 359 ms outlier. No warmed terrain chunks were rebuilt.
However, **150 routes were still queued** at the end: 52 traders and 98 raiders
were waiting, with up to 237 seconds of deferred simulation movement on one raider.
This passes the profiler's state/day/cache checks, not a simulation-throughput or
latency target. Faster drawing must not be mistaken for completed simulation work.

Before shared connectivity, the same extended scenario completed no route requests
for 30 seconds while the queue grew to 152. With connectivity, 310 additional
requests completed during the extended sample, but expensive reachable routes
still limit throughput. The independent 1500² connectivity test retained about
9 MB and took 0.71–0.91 seconds total CPU, spread across roughly 6–7 seconds of
2 ms frame budgets at 60 Hz. Player short-path prefix behavior is regression-tested.

Enabling formerly distant NPC simulation initially reproduced a **15-second
synchronous route-search burst**. After queue integration, the normal live sample's
  pathfinding averaged 2.16 ms per frame (5.1 ms maximum in that early sample).
Synthetic regional-pricing comparisons improved approximately 77–91%; 750 seeded
weighted-route comparisons matched the original A* routes exactly.

4K/DPR-2 testing independently exposed the main-canvas resolution problem. Before
the pixel budget, its normal live terrain draw averaged 92.79 ms; the bounded
4K backing canvas reduced that to 28.98 ms in a subsequent sample. This headless
software-rendered case is **still not smooth 60 FPS**. The stationary cache remains
bounded, but a newly exposed 104-chunk viewport needs a longer warmup than 1080p.

The final isolated 4K minimum-zoom run finished that warmup in 6.70 seconds: all
104 chunks ready, 26 MiB cached, no further builds. Device DPR was 2 while the main
backing canvas correctly stayed 3840×2160 at density 1. Draw averaged 4.38 ms
(terrain 0.56 ms); frame intervals averaged 19.24 ms with a 387 ms outlier. No
simulation work ran in this isolated render-only measurement. Screenshot review
found no unfilled chunks or visible seams.

## Verification and reproduction

Run deterministic regression tests with:

```sh
node tests/run-unit-tests.js
```

Final result: **314 passed, 0 failed**. All changed JavaScript files were also
syntax checked, and `git diff --check` passed.

Coverage includes stationary 1080p/4K cache convergence, memory and raster-work
bounds, camera jumps/shake, partial world edges, minimap/line culling, unchanged HUD
writes, live price parity, weighted/BFS route parity, search cancellation, world
changes, elapsed movement, paused debt, pickups/encounters and save normalization.

The browser profiler is `tests/profile-large-world.cjs`. It needs Playwright and
an installed Chromium browser, plus a separately running local HTTP server. It
never saves a game. See its `--help` for environment overrides and scenario options.
The profiling method follows Chrome's
[runtime performance workflow](https://developer.chrome.com/docs/devtools/performance).

```sh
python3 -m http.server 8000 --bind 127.0.0.1
# In a second terminal, with Playwright/Chromium available:
node tests/profile-large-world.cjs --size 1500 --cities 600 --dense --extended
```

## Remaining limits / next measurements

This is not a lockstep simulation or a promise that all hardware can maintain
60 FPS. Deferred movement is retained, but an expensive queued route delays its
actor until the route is available; it does not rewind earlier world interactions.
Shared connectivity removes repeated impossible-route work, but long reachable
searches can still hold up background requests. The measured queue backlog makes
shared city-route caches, hierarchical navigation and worker execution the next
simulation priorities. Simply increasing the frame budget would sacrifice the
rendering gains; exact route parity versus hierarchical approximation is a design
tradeoff to decide before that next phase.

Raster allocation, one search batch, garbage collection and browser composition
cannot be interrupted by JavaScript deadlines. Terrain warmup may briefly show
placeholders. The 30-second 8×/two-day and pan/zoom samples are not long-running
soak tests. Test real hardware, longer economy runs, city-management battles and
long journeys before claiming a stable frame-rate target. Do not restore
visibility-based simulation skipping to hide these costs.

Runtime diagnostics are available in the browser console:

```js
BQGetTerrainRenderStats() // visible/pending chunks, build time, cache bytes/limit
BQGetPathfindingStats()   // pending player/background jobs and per-frame work
```
