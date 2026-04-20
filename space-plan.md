# Space Expansion Plan

## Goal
Make space travel feel like an extension of Bargain Quest, not a separate mini-game.

The current problem is that off-world landing still has too much custom space-only behavior. The fix is to reuse the same world loop, player, cities, combat, contracts, traders, raiders, and QTE/minigame systems that already power the main game.

## What Must Stay True

- Earth should land back into the normal BQ world map.
- Non-Earth planets should become real playable surface worlds, not a fake overlay.
- The player must still be the same player object.
- Combat, traders, raiders, contracts, treasure, and city entry should work on planetary surfaces the same way they do on Earth.
- Space should remain the orbital layer only.

## Fix Plan

### Phase 1: Make World Sessions Real

Create a real `world session` model for playable surfaces.

- Keep one active session at a time.
- Store the active session’s `grid`, `elevationMap`, `difficultyMap`, `temperatureMap`, `cities`, `portCityLocations`, and runtime systems.
- Add helpers to activate and suspend a session cleanly.
- Use the current Earth world as the baseline session.

### Phase 2: Replace Fake Planet Surfaces

Remove the custom landed-only space surface behavior.

- Stop rendering off-world landings as a separate fake scene.
- When docking on a planet, generate or load a real surface session.
- Use real BQ tiles, real player movement, real city placement, and the normal world rules.
- Do not introduce placeholder labels like `Dock Hub` or other space-only pseudo-locations.

### Phase 3: Reuse the Main Game Loop

Route planetary landings into `PLAYING`, not a custom landed view.

- Let the normal `draw()` and `handleMovement()` path run.
- Let `player.update()` drive city entry, movement, and encounter checks.
- Let `RenderMap()`, `renderVisibleCities()`, traders, raiders, contracts, and treasure run normally.
- Keep `SPACE` reserved for orbit, launch, dock, and route selection.

### Phase 4: Add Planet Launch and Return Points

Make each planet have a real surface landing point and a real way back to orbit.

- Generate a landing city or spaceport on each world session.
- Use that city as the launch anchor.
- Pressing `E` at the launch city should return to `SPACE`.
- Earth should still return directly to the normal adventure world.

### Phase 5: Keep Existing Systems Working

Make sure the current game systems remain attached to the active session.

- Rehydrate or snapshot traders and raiders per session.
- Keep contracts, treasure maps, and random events tied to the current world.
- Make combat and QTE/minigame hooks work unchanged on planetary surfaces.
- Ensure `player.currentCity` and city-management logic still behave correctly.

### Phase 6: Save and Load

Extend persistence so a run can resume the current surface session cleanly.

- Save the active session key.
- Save the active world state for Earth or a planet.
- Restore the correct session on load.
- Do not lose the player, cities, or active contracts when switching between orbit and surface.

## Success Criteria

- Landing on Earth returns to the normal world map.
- Landing on a planet drops you into a real BQ surface world.
- You can move, enter cities, trade, fight, dig, and trigger events on that surface.
- Launching from the surface city returns you to orbit.
- Save/load works across Earth and off-world sessions.

## Recommended Implementation Order

1. Finish the world-session activation/suspension layer.
2. Replace the remaining fake off-world landing path.
3. Wire launch-back-to-orbit to the real surface city.
4. Add session-aware save/load.
5. Clean up placeholder labels and old custom surface code.

