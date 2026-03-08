(function bridgeSpatialGrid(root) {
  if (typeof root.SpatialGrid === "function") return;
  const api = root.BQLib?.core?.spatialGrid;
  if (api && typeof api.SpatialGrid === "function") {
    root.SpatialGrid = api.SpatialGrid;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
