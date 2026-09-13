(function initPathfindingSchedulerLib(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPathfindingSchedulerApi() {
  function defaultNow() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  /**
   * Schedule incremental searches without making pathfinding depend on visibility.
   * Only two searches can own working buffers: one background and one player.
   * Queued requests retain inputs but allocate no search until pump() dispatches them.
   *
   * A pump grants one background batch before prioritizing player work, preventing
   * starvation. Deadlines are checked between factory/step/callback calls; a single
   * call cannot be interrupted. The work cap charges each requested step allowance,
   * including immediately complete searches, so tiny jobs cannot bypass the cap.
   */
  function createPathfindingScheduler({
    createSearch,
    now = defaultNow,
    budgetMs = 2,
    stepSize = 128,
    maxStepsPerTick = 8192,
  } = {}) {
    if (typeof createSearch !== 'function') throw new TypeError('createSearch must be a function');
    if (typeof now !== 'function') throw new TypeError('now must be a function');
    if (!Number.isFinite(budgetMs) || budgetMs < 0) throw new RangeError('budgetMs must be finite and nonnegative');
    if (!Number.isInteger(stepSize) || stepSize < 1) throw new RangeError('stepSize must be a positive integer');
    if (!Number.isInteger(maxStepsPerTick) || maxStepsPerTick < 0) throw new RangeError('maxStepsPerTick must be a nonnegative integer');

    // Intrusive FIFO lists allow immediate O(1) removal of cancelled requests.
    // No Array.shift(), tombstones, or cancelled world references accumulate.
    const queues = {
      background: { head: null, tail: null, size: 0 },
      player: { head: null, tail: null, size: 0 },
    };
    const active = { background: null, player: null };
    const pending = { background: 0, player: 0 };
    const counters = {
      requested: 0, completed: 0, cancelled: 0, pumpCount: 0,
      totalStepUnits: 0, totalBatches: 0,
      lastPumpMs: 0, lastPumpSteps: 0, lastPumpBatches: 0, lastPumpCompleted: 0,
    };
    let pumping = false;

    function unlink(job) {
      const queue = job.queue;
      if (!queue) return;
      if (job.previous) job.previous.next = job.next;
      else queue.head = job.next;
      if (job.next) job.next.previous = job.previous;
      else queue.tail = job.previous;
      queue.size--;
      job.queue = job.previous = job.next = null;
    }

    function release(job, status) {
      unlink(job);
      if (active[job.priority] === job) active[job.priority] = null;
      job.status = status;
      pending[job.priority]--;
      job.options = job.search = job.onComplete = null;
    }

    function cancel(job) {
      if (job.status !== 'pending') return false;
      const search = job.search;
      release(job, 'cancelled');
      counters.cancelled++;
      if (search && typeof search.cancel === 'function') search.cancel();
      return true;
    }

    function request(options, onComplete) {
      if (!options || typeof options !== 'object') throw new TypeError('Path request options are required');
      if (typeof onComplete !== 'function') throw new TypeError('onComplete must be a function');
      if (options.createSearch !== undefined && typeof options.createSearch !== 'function') {
        throw new TypeError('A request createSearch override must be a function');
      }
      const priority = options.priority === 'player' ? 'player' : 'background';
      const queue = queues[priority];
      const job = {
        priority, status: 'pending', search: null, onComplete,
        options: {
          grid: options.grid, elevationMap: options.elevationMap, baseDiff: options.baseDiff,
          start: options.start ? { x: options.start.x, y: options.start.y } : options.start,
          goal: options.goal ? { x: options.goal.x, y: options.goal.y } : options.goal,
          allowWater: options.allowWater, portCities: options.portCities, waterOnly: options.waterOnly,
          createSearch: options.createSearch,
        },
        queue, previous: queue.tail, next: null,
      };
      if (queue.tail) queue.tail.next = job;
      else queue.head = job;
      queue.tail = job;
      queue.size++;
      pending[priority]++;
      counters.requested++;
      return {
        get status() { return job.status; },
        cancel() { return cancel(job); },
      };
    }

    function getStats() {
      return {
        ...counters,
        pending: pending.background + pending.player,
        pendingBackground: pending.background, pendingPlayer: pending.player,
        queuedBackground: queues.background.size, queuedPlayer: queues.player.size,
        activeBackground: active.background ? 1 : 0, activePlayer: active.player ? 1 : 0,
      };
    }

    function pump() {
      // A completion callback can enqueue/cancel work, but cannot recursively
      // grant itself another frame budget.
      if (pumping) return getStats();
      pumping = true;
      const started = now();
      const deadline = started + budgetMs;
      const completedBefore = counters.completed;
      let charged = 0;
      let batches = 0;

      function canWork() {
        return charged < maxStepsPerTick && now() < deadline;
      }

      function runBatch(priority) {
        let job = active[priority];
        if (!job) {
          job = queues[priority].head;
          if (!job) return;
          unlink(job);
          active[priority] = job;
        }
        const allowance = Math.min(stepSize, maxStepsPerTick - charged);
        charged += allowance;
        batches++;
        try {
          if (!job.search) {
            const opts = job.options;
            const searchFactory = opts.createSearch || createSearch;
            const search = searchFactory(opts.grid, opts.start, opts.goal,
              opts.allowWater, opts.portCities, opts.waterOnly,
              { elevationMap: opts.elevationMap, baseDiff: opts.baseDiff });
            // A supplied factory may reenter the scheduler and cancel its job.
            if (job.status !== 'pending') {
              if (search && typeof search.cancel === 'function') search.cancel();
              return;
            }
            job.search = search;
            if (!search || typeof search.step !== 'function') throw new TypeError('createSearch must return an incremental search');
          }
          const search = job.search;
          if (!search.done && now() < deadline) search.step(allowance);
          if (job.status === 'pending' && search.done) {
            const path = search.result;
            const complete = job.onComplete;
            release(job, 'completed');
            counters.completed++;
            complete(path);
          }
        } catch (error) {
          // Callback exceptions propagate after completion cleanup. Search
          // exceptions cancel the failing job and do not strand its buffers.
          if (job.status === 'pending') cancel(job);
          throw error;
        }
      }

      try {
        if (pending.background > 0 && canWork()) runBatch('background');
        while ((pending.player > 0 || pending.background > 0) && canWork()) {
          runBatch(pending.player > 0 ? 'player' : 'background');
        }
      } finally {
        counters.pumpCount++;
        counters.lastPumpMs = Math.max(0, now() - started);
        counters.lastPumpSteps = charged;
        counters.lastPumpBatches = batches;
        counters.lastPumpCompleted = counters.completed - completedBefore;
        counters.totalStepUnits += charged;
        counters.totalBatches += batches;
        pumping = false;
      }
      return getStats();
    }

    function cancelAll() {
      let firstError = null;
      for (const priority of ['player', 'background']) {
        while (active[priority] || queues[priority].head) {
          try { cancel(active[priority] || queues[priority].head); }
          catch (error) { if (!firstError) firstError = error; }
        }
      }
      if (firstError) throw firstError;
    }

    return { request, pump, cancelAll, getStats };
  }

  return { createPathfindingScheduler };
});
