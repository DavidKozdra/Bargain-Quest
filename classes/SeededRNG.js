(function bridgeSeededRng(root) {
  const api = root.BQLib?.utils?.seededRng;
  if (!api) return;

  if (!root.BQSeededRNG) {
    root.BQSeededRNG = api.SeededRNG;
  }

  if (typeof root.BQRandom !== "function") {
    root.BQRandom = function BQRandom(streamName) {
      return api.namedRandom(root.BQSeededRNG, streamName || "default");
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
