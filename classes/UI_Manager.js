(function bridgeUIManager(root) {
  if (typeof root.UIManager === "function") return;
  const managerApi = root.BQLib?.ui?.uiManager;
  if (managerApi && typeof managerApi.UIManager === "function") {
    root.UIManager = managerApi.UIManager;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
