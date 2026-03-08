(function bridgeDayNightCycle(root) {
  if (typeof root.DayNightCycle === "function") return;
  const api = root.BQLib?.systems?.dayNightCycle;
  if (api && typeof api.DayNightCycle === "function") {
    root.DayNightCycle = api.DayNightCycle;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
