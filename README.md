
# Bargain Quest

<img width="351" height="255" alt="Logo" src="https://github.com/user-attachments/assets/e1108116-7973-42cd-b963-131a672635b1" />

**Bargain Quest** is a browser-based, turn-based trading strategy game. It borrows the travel-and-progression feel of *Mount & Blade*, but the core loop is economics rather than conquest: buy low, sell high, follow seasonal demand, manage cargo, and grow wealth across a living map.

This repository also contains **`Koz_Engine_Lib/`**, a reusable engine layer being extracted from the game. If you are here for the engine rather than the game, start with [`Koz_Engine_Lib/README.md`](/home/davidk/Documents/CODE/GITHUB/Bargain-Quest/Koz_Engine_Lib/README.md).

## What Is In This Repo

- The Bargain Quest game runtime, content, and UI.
- `Koz_Engine_Lib/`, a transitional reusable engine library.
- Unit tests under `tests/lib/` (run with `node tests/run-unit-tests.js`) that double as usage examples for many engine modules.

## Run The Game Locally

The game entry point is [`index.html`](/home/davidk/Documents/CODE/GITHUB/Bargain-Quest/index.html), not `game.html`.

Serve the repository over a simple local HTTP server from the repo root, then open `http://localhost:8000/index.html`.

Example:

```bash
python3 -m http.server 8000
```

Why use a server:

- It matches how the browser loads the project in normal use.
- It avoids `file://` quirks around script and asset loading.

## New To The Engine

Use these docs in this order:

1. [`Koz_Engine_Lib/README.md`](/home/davidk/Documents/CODE/GITHUB/Bargain-Quest/Koz_Engine_Lib/README.md)
2. [`Koz_Engine_Lib/docs/new-user-guide.md`](/home/davidk/Documents/CODE/GITHUB/Bargain-Quest/Koz_Engine_Lib/docs/new-user-guide.md)
3. [`Koz_Engine_Lib/docs/module-catalog.md`](/home/davidk/Documents/CODE/GITHUB/Bargain-Quest/Koz_Engine_Lib/docs/module-catalog.md)
4. `tests/lib/*.test.js` for concrete usage patterns

## Project Links

- [Play the demo on itch.io](https://magentaautumn.itch.io/bargain-quest?secret=lttUL2Dty90R7A501pSZ0pfZWu4)
- [GitHub repository](https://github.com/DavidKozdra/Bargain-Quest)

![Project image](image.png)

## Screenshots

<img width="1569" height="1103" alt="Gameplay" src="https://github.com/user-attachments/assets/9d5c6da9-b45f-405a-8409-742d896eaee2" />

---

<img width="2245" height="1432" alt="Shop UI" src="https://github.com/user-attachments/assets/57555490-9b54-4a9c-8f7f-353adb4379ef" />
