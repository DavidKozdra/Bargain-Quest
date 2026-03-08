(function bridgeTutorialSystem(root) {
  if (typeof root.TutorialSystem === "function") return;
  const adapter = root.BQAdapters?.tutorialSystem;
  if (adapter && typeof adapter.TutorialSystem === "function") {
    root.TutorialSystem = adapter.TutorialSystem;
    return;
  }
  const lib = root.BQLib?.systems?.tutorialSystem;
  if (lib && typeof lib.TutorialSystem === "function") {
    root.TutorialSystem = lib.TutorialSystem;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
