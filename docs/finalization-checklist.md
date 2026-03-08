# Bargain Quest Finalization Checklist

Use this after each migration phase in `TODO.md` and `Koz_Engine_Lib/docs/migration-roadmap.md`.

## Boundary Check
- [ ] Engine changes stayed inside reusable contracts
- [ ] Bargain Quest-specific translation stayed in `adapters/` or the game layer
- [ ] No new engine module reads game globals directly
- [ ] No content flavor or screen copy leaked into `Koz_Engine_Lib`

## Code Check
- [ ] Wrapper classes are thinner after the phase, not thicker
- [ ] Duplicated legacy paths were either removed or explicitly marked temporary
- [ ] Config and data are separated from reusable rule logic
- [ ] Load order changes were documented in `index.html` comments or docs if needed

## Experience Check
- [ ] Core gameplay loop still feels unchanged unless a regression note says otherwise
- [ ] UI flow remains understandable on desktop
- [ ] Mobile/touch behavior still works where affected
- [ ] Save/load behavior still matches current player expectations

## Verification Check
- [ ] Relevant unit tests were added or updated
- [ ] Relevant adapter tests were added or updated
- [ ] Relevant smoke checklist items passed
- [ ] Known issues for the phase were logged explicitly

## Release Check
- [ ] Dead code introduced by the migration was removed
- [ ] Docs reflect the new boundary accurately
- [ ] The phase can be handed off without hidden assumptions
