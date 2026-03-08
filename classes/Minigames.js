(function bridgeMinigamesRuntime(root) {
  const api = root.BQLib?.minigames?.runtime;
  if (!api) return;
  if (typeof root.MinigameManager !== "function") root.MinigameManager = api.MinigameManager;
  if (typeof root.MinigameBase !== "function") root.MinigameBase = api.MinigameBase;
  if (typeof root.HagglingMinigame !== "function") root.HagglingMinigame = api.HagglingMinigame;
  if (typeof root.LockPickingMinigame !== "function") root.LockPickingMinigame = api.LockPickingMinigame;
  if (typeof root.DicePokerMinigame !== "function") root.DicePokerMinigame = api.DicePokerMinigame;
  if (typeof root.MemoryMatchMinigame !== "function") root.MemoryMatchMinigame = api.MemoryMatchMinigame;
  if (typeof root.WheelOfFortuneMinigame !== "function") root.WheelOfFortuneMinigame = api.WheelOfFortuneMinigame;
  if (typeof root.BluffMeterMinigame !== "function") root.BluffMeterMinigame = api.BluffMeterMinigame;
  if (typeof root.NavigationDodgeMinigame !== "function") root.NavigationDodgeMinigame = api.NavigationDodgeMinigame;
  if (typeof root.ShipRaceMinigame !== "function") root.ShipRaceMinigame = api.ShipRaceMinigame;
  if (typeof root.FishingMinigame !== "function") root.FishingMinigame = api.FishingMinigame;
  if (typeof root.MiningMinigame !== "function") root.MiningMinigame = api.MiningMinigame;
  if (typeof root.HarvestMinigame !== "function") root.HarvestMinigame = api.HarvestMinigame;
  if (typeof root.WoodcuttingMinigame !== "function") root.WoodcuttingMinigame = api.WoodcuttingMinigame;
  if (typeof root.SandDigMinigame !== "function") root.SandDigMinigame = api.SandDigMinigame;
})(typeof globalThis !== "undefined" ? globalThis : this);
