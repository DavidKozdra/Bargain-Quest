(function bridgeEventSystem(root) {
  if (typeof root.EventSystem === "function") return;
  const api = root.BQLib?.systems?.eventSystem;
  if (api && typeof api.EventSystem === "function") {
    root.EventSystem = api.EventSystem;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
