(function bridgeGameStateManager(root) {
  if (typeof root.GameStateManager === "function") return;
  const api = root.BQLib?.core?.gameStateManager;
  if (api && typeof api.GameStateManager === "function") {
    root.GameStateManager = api.GameStateManager;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
