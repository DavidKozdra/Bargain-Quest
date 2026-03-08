(function initEventEngineLib(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.BQLib = root.BQLib || {};
    root.BQLib.systems = root.BQLib.systems || {};
    root.BQLib.systems.eventEngine = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createEventEngineApi() {
  function evaluateConditionSet(eventDef, context) {
    if (!eventDef || !context) return true;

    if (eventDef.minDay && context.day < eventDef.minDay) return false;
    if (Array.isArray(eventDef.terrain) && eventDef.terrain.length > 0) {
      if (eventDef.terrain.indexOf(context.terrain) === -1) return false;
    }
    if (Array.isArray(eventDef.season) && eventDef.season.length > 0) {
      if (eventDef.season.indexOf(context.season) === -1) return false;
    }

    return true;
  }

  function filterEligibleEvents(events, context) {
    if (!Array.isArray(events) || events.length === 0) return [];
    return events.filter(function checkEligibility(eventDef) {
      return evaluateConditionSet(eventDef, context);
    });
  }

  function pickRandomEvent(events, randomFn) {
    if (!Array.isArray(events) || events.length === 0) return null;
    const rng = typeof randomFn === "function" ? randomFn : Math.random;
    const idx = Math.floor(rng() * events.length);
    return events[Math.max(0, Math.min(events.length - 1, idx))] || null;
  }

  function appendHistory(history, item, maxHistory) {
    const next = Array.isArray(history) ? history.slice() : [];
    next.push(item);
    const max = Math.max(1, Number(maxHistory) || 30);
    while (next.length > max) next.shift();
    return next;
  }

  return {
    evaluateConditionSet: evaluateConditionSet,
    filterEligibleEvents: filterEligibleEvents,
    pickRandomEvent: pickRandomEvent,
    appendHistory: appendHistory,
  };
});
